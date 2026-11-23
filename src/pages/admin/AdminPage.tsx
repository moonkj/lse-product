import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData, type AppData } from '../../data/load';
import {
  COVERAGE_LABELS,
  DiagramSchema,
  EquipmentImagesSchema,
  EquipmentTypesSchema,
  LAYER_LABELS,
  LAYERS,
  type EquipmentImage,
  type EquipmentType,
  type Layer,
} from '../../lib/schema';
import { computeDiagramModel, type DiagramModel } from '../../lib/diagram/model';
import type { EdgeKind } from '../../lib/diagram/geometry';
import type { ViewMode } from '../../lib/diagram/url';
import { pageTitle } from '../../lib/labels';
import {
  addEdge,
  addNode,
  addSpecialNode,
  shapeOf,
  specPlacement,
  updateNode,
  type SpecialNodeSpec,
  deleteEdge,
  deleteEquipment,
  deleteNode,
  findFreeSpot,
  moveNode,
  nodeName,
  toJsonText,
  updateEdge,
  upsertEquipment,
  type Draft,
  type OpResult,
} from '../../lib/admin/draft';
import { changesMarkdown, computeChanges } from '../../lib/admin/diff';
import { koIssue, validateDraft, type Issue } from '../../lib/admin/integrity';
import { useAdminStore } from '../../lib/admin/store';
import { download } from '../../lib/admin/download';
import { computeSpecChanges, specChangesSection } from '../../lib/admin/specs';
import { useSpecsAdminStore } from '../../lib/admin/specsStore';
import BrandLogo from '../../components/common/BrandLogo';
import SpecReview from './SpecReview';
import AdminCanvas, { type CanvasHandle, type PlaceTarget, type Tool } from './AdminCanvas';
import EquipmentForm from './EquipmentForm';
import PublishDialog from './PublishDialog';
import { ChangesPanel, CheckPanel, EquipmentList, SelectionPanel, equipmentLabel } from './AdminPanels';
import './AdminPage.css';

type Selection = { type: 'node' | 'edge'; id: string } | null;
type LeftView = { kind: 'list' } | { kind: 'new' } | { kind: 'edit'; id: string };
type RightTab = 'selection' | 'changes' | 'check';
type AdminView = 'diagram' | 'specs';
type PlaceKind = 'equipment' | 'ref' | 'bus' | 'endpoint';
const PLACE_KIND_LABELS: Record<PlaceKind, string> = { equipment: '기기', ref: '참조 타일', bus: '모선', endpoint: '끝점' };

/**
 * 초안으로 계통도 모델 만들기 — 일반 화면과 같은 규칙(computeDiagramModel)으로 별도 인스턴스를 만든다
 * (일반 화면의 getDiagramModel 캐시를 덮어쓰지 않음, 리뷰 R5). 사진은 초안의 equipment-images 기준.
 */
function buildModel(data: AppData, draft: Draft): DiagramModel {
  const appData: AppData = {
    ...data,
    equipmentTypes: draft.equipmentTypes,
    diagram: draft.diagram,
    equipmentTypeById: new Map(draft.equipmentTypes.map((e) => [e.id, e])),
    equipmentImageById: new Map(Object.entries(draft.images)),
  };
  const m = computeDiagramModel(appData);
  const base = import.meta.env.BASE_URL;
  const withImage = (n: DiagramModel['nodes'][number]) => {
    const img = draft.images[n.eq.id];
    return { ...n, imageUrl: img ? `${base}${img.thumb}` : undefined };
  };
  return { ...m, nodes: m.nodes.map(withImage), refs: m.refs.map(withImage) };
}

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/** /#/admin — 계통도 편집 (정적 사이트: 이 브라우저에 초안 저장 → JSON 내보내기 → 저장소 커밋) */
export default function AdminPage() {
  const data = useData();
  const { draft, base, past, future, staleBase, restoredAt, saveStatus, commit, undo, redo, resetToBase } = useAdminStore();
  const model = useMemo(() => buildModel(data, draft), [data, draft]);
  const changes = useMemo(() => computeChanges(base, draft), [base, draft]);
  const ref = useMemo(() => ({ categories: data.categories, products: data.products }), [data]);

  const canvasRef = useRef<CanvasHandle>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [placeEquipmentId, setPlaceEquipmentId] = useState<string>();
  const [connectFrom, setConnectFrom] = useState<string>();
  const [edgeKind, setEdgeKind] = useState<EdgeKind>('power');
  const [edgeVoltage, setEdgeVoltage] = useState('');
  const [edgeLabel, setEdgeLabel] = useState('');
  const [placeKind, setPlaceKind] = useState<PlaceKind>('equipment');
  const [placeLabel, setPlaceLabel] = useState('');
  const [placeLayer, setPlaceLayer] = useState<Layer>('L6');
  const [placeWidth, setPlaceWidth] = useState(400);
  const [selection, setSelection] = useState<Selection>(null);
  const [left, setLeft] = useState<LeftView>({ kind: 'list' });
  const [tab, setTab] = useState<RightTab>('selection');
  const [preview, setPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<ViewMode>('product');
  const [previewNode, setPreviewNode] = useState<string>();
  const [toast, setToast] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [check, setCheck] = useState<{ issues: Issue[]; at: number } | null>(null);
  const [exported, setExported] = useState<string[]>([]);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const [view, setView] = useState<AdminView>('diagram');
  const specsUndo = useSpecsAdminStore((s) => s.undo);
  const specsRedo = useSpecsAdminStore((s) => s.redo);

  useEffect(() => {
    document.title = pageTitle('관리자 모드');
  }, []);

  // 초안이 바뀌면 지난 검사 결과는 무효
  useEffect(() => {
    setCheck((c) => (c ? null : c));
    setExported((x) => (x.length ? [] : x));
  }, [draft]);

  // 선택한 대상이 없어지면(되돌리기 등) 선택 해제
  useEffect(() => {
    if (selection?.type === 'node' && !draft.diagram.nodes.some((n) => n.id === selection.id)) setSelection(null);
    if (selection?.type === 'edge' && !draft.diagram.edges.some((e) => e.id === selection.id)) setSelection(null);
  }, [draft, selection]);

  // 안내 알림은 6초 뒤 자동으로 닫힘 (오류는 직접 닫을 때까지 유지)
  useEffect(() => {
    if (toast?.kind !== 'info') return;
    const t = setTimeout(() => setToast((cur) => (cur === toast ? null : cur)), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const info = (text: string) => setToast({ kind: 'info', text });
  const fail = (text: string) => setToast({ kind: 'error', text });

  const apply = useCallback(
    (r: OpResult, okText?: string): boolean => {
      if (r.error) {
        setToast({ kind: 'error', text: r.error });
        return false;
      }
      commit(r.draft);
      if (r.notice) setToast({ kind: 'error', text: r.notice });
      else if (okText) setToast({ kind: 'info', text: okText });
      return true;
    },
    [commit],
  );

  // ── 단축키: 되돌리기/다시 실행, Esc 로 모드 취소 ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const [u, r] = view === 'specs' ? [specsUndo, specsRedo] : [undo, redo];
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) r();
        else u();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        r();
      } else if (e.key === 'Escape') {
        setConnectFrom(undefined);
        setTool('select');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, view, specsUndo, specsRedo]);

  // ── 캔버스 상호작용 ──
  const onNodeClick = (id: string) => {
    if (preview) {
      setPreviewNode(id);
      return;
    }
    // 배치 모드의 노드 클릭은 캔버스가 배치 시도로 처리
    if (tool === 'place' && placeTarget) return;
    if (tool === 'connect') {
      if (!connectFrom) {
        setConnectFrom(id);
        info(`${nodeName(draft, id)} 에서 시작 — 연결할 노드를 누르세요`);
        return;
      }
      if (connectFrom === id) {
        setConnectFrom(undefined);
        info('연결을 취소했습니다');
        return;
      }
      const r = addEdge(draft, connectFrom, id, edgeKind, edgeVoltage, edgeLabel);
      if (apply(r, `연결선 ${r.createdId} 추가: ${nodeName(draft, connectFrom)} → ${nodeName(draft, id)}`)) {
        setSelection({ type: 'edge', id: r.createdId! });
        setTab('selection');
      }
      setConnectFrom(undefined);
      return;
    }
    setSelection({ type: 'node', id });
    setTab('selection');
  };

  /** 배치할 노드 명세 (기기 외) */
  const specialSpec: SpecialNodeSpec | undefined =
    placeKind === 'ref'
      ? placeEquipmentId
        ? { kind: 'ref', equipmentId: placeEquipmentId, label: placeLabel }
        : undefined
      : placeKind === 'bus'
        ? { kind: 'bus', label: placeLabel, layer: placeLayer, width: placeWidth }
        : placeKind === 'endpoint'
          ? { kind: 'endpoint', label: placeLabel, layer: placeLayer }
          : undefined;
  const placeEqForTarget = draft.equipmentTypes.find((e) => e.id === placeEquipmentId);
  const placeTarget: PlaceTarget | undefined =
    placeKind === 'equipment'
      ? placeEqForTarget && { layer: placeEqForTarget.layer, shape: shapeOf('equipment'), title: placeEqForTarget.abbr ?? placeEqForTarget.name }
      : specialSpec && {
          ...specPlacement(specialSpec),
          title: `${PLACE_KIND_LABELS[placeKind]}${placeLabel.trim() ? ` · ${placeLabel.trim()}` : ''}`,
        };

  const onPlace = (x: number, y: number) => {
    if (placeKind !== 'equipment') {
      if (!specialSpec) return;
      const r = addSpecialNode(draft, specialSpec, x, y);
      if (apply(r, `${nodeName(r.draft, r.createdId ?? '')}을(를) (${x}, ${y})에 배치했습니다`)) {
        setSelection({ type: 'node', id: r.createdId! });
        setTool('select');
        setTab('selection');
      }
      return;
    }
    if (!placeEquipmentId) return;
    const r = addNode(draft, placeEquipmentId, x, y);
    if (apply(r, `${nodeName(r.draft, r.createdId ?? '')} 노드를 (${x}, ${y})에 배치했습니다`)) {
      setSelection({ type: 'node', id: r.createdId! });
      setTool('select');
      setTab('selection');
    }
  };

  const autoPlace = () => {
    if (!placeTarget) return;
    // 참조 타일은 밴드 제한이 없으므로 "표시 계층" 밴드에서 빈 자리를 찾는다
    const layer = placeTarget.layer ?? placeLayer;
    const p = findFreeSpot(draft, layer, placeTarget.shape);
    if (!p) {
      fail(`${layer} 밴드에 빈 자리가 없습니다`);
      return;
    }
    onPlace(p.x, p.y);
    canvasRef.current?.centerOn(p.x, p.y);
  };

  const onMove = (id: string, x: number, y: number) => {
    apply(moveNode(draft, id, x, y));
  };

  /** eqObj: 방금 저장해 아직 이번 렌더의 draft 에 없는 기기 */
  const startPlace = (id: string, eqObj?: EquipmentType) => {
    const eq = eqObj ?? draft.equipmentTypes.find((e) => e.id === id);
    if (!eq) return;
    setPreview(false);
    setPlaceKind('equipment');
    setPlaceEquipmentId(id);
    setTool('place');
    setConnectFrom(undefined);
    canvasRef.current?.fitLayer(eq.layer);
    info(`${equipmentLabel(eq)} — ${eq.layer} ${LAYER_LABELS[eq.layer]} 밴드 안을 클릭해 배치하세요`);
  };

  const confirmDeleteNode = (id: string) => {
    const n = draft.diagram.edges.filter((e) => e.from === id || e.to === id).length;
    const msg = `${nodeName(draft, id)} 노드를 삭제할까요?${n > 0 ? `\n연결선 ${n}개도 함께 삭제됩니다.` : ''}`;
    if (!window.confirm(msg)) return;
    if (apply(deleteNode(draft, id), `${nodeName(draft, id)} 노드${n > 0 ? `와 연결선 ${n}개` : ''}를 삭제했습니다`)) setSelection(null);
  };

  const onDeleteEquipment = (id: string) => {
    const eq = draft.equipmentTypes.find((e) => e.id === id);
    const r = deleteEquipment(draft, id);
    if (r.error) {
      fail(r.error);
      return;
    }
    if (!window.confirm(`기기 종류 "${eq?.name ?? id}" 를 삭제할까요?`)) return;
    apply(r, `기기 종류 ${eq?.name ?? id} 를 삭제했습니다`);
    if (left.kind === 'edit' && left.id === id) setLeft({ kind: 'list' });
  };

  const onSaveEquipment = (eq: EquipmentType, image: EquipmentImage | null | undefined) => {
    const isNew = !draft.equipmentTypes.some((e) => e.id === eq.id);
    commit(upsertEquipment(draft, eq, image));
    setLeft({ kind: 'list' });
    if (isNew) {
      startPlace(eq.id, eq);
      info(`${equipmentLabel(eq)} 추가 — ${eq.layer} 밴드 안을 클릭하거나 "빈 자리에 자동 배치"를 누르세요`);
    } else info(`${equipmentLabel(eq)} 수정 저장`);
  };

  // ── 검사·내보내기 ──
  const runCheck = () => {
    const issues = validateDraft(draft, ref);
    setCheck({ issues, at: Date.now() });
    setTab('check');
    return issues;
  };

  const imagesChanged = toJsonText(base.images) !== toJsonText(draft.images);
  const fileText = (f: string) => {
    if (f === 'equipment-types.json') return toJsonText(draft.equipmentTypes);
    if (f === 'diagram.json') return toJsonText(draft.diagram);
    if (f === 'equipment-images.json') return toJsonText(draft.images);
    const md = changesMarkdown(base, draft, changes);
    // 사양 검수 탭에서 고친 내용이 있으면 같은 요약에 사양 절을 붙인다
    const sp = useSpecsAdminStore.getState();
    if (sp.status !== 'ready' || !sp.base || !sp.draft) return md;
    const spec = specChangesSection(computeSpecChanges(sp.base, sp.draft), (id) => data.productById.get(id)?.name ?? id, sp.draft);
    return spec.length ? `${md}\n${spec.join('\n')}` : md;
  };
  const downloadFile = (f: string) => download(f, fileText(f), f.endsWith('.md') ? 'text/markdown' : 'application/json');

  const doExport = () => {
    const issues = runCheck();
    const n = issues.filter((i) => i.level === 'error').length;
    if (n > 0) {
      fail(`무결성 검사 오류 ${n}건 — 내보내기를 막았습니다`);
      setExported([]);
      return;
    }
    const files = ['equipment-types.json', 'diagram.json', ...(imagesChanged ? ['equipment-images.json'] : []), '변경요약.md'];
    files.forEach(downloadFile);
    setExported(files);
    info(`내보내기 완료 — ${files.join(', ')}`);
  };

  // ── 사이트에 반영 (검사 통과한 파일만 저장소에 커밋 → 자동 배포) ──
  const [publishFiles, setPublishFiles] = useState<Record<string, string> | null>(null);
  const openPublish = () => {
    const issues = runCheck();
    const n = issues.filter((i) => i.level === 'error').length;
    if (n > 0) {
      fail(`무결성 검사 오류 ${n}건 — 고친 뒤 반영할 수 있습니다`);
      return;
    }
    if (changes.length === 0 && !imagesChanged) {
      info('원본과 달라진 내용이 없습니다');
      return;
    }
    const files: Record<string, string> = {
      'equipment-types.json': fileText('equipment-types.json'),
      'diagram.json': fileText('diagram.json'),
    };
    if (imagesChanged) files['equipment-images.json'] = fileText('equipment-images.json');
    setPublishFiles(files);
  };

  const onImport = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const next: Draft = { ...draft };
    const lines: string[] = [];
    let ok = true;
    for (const file of [...list]) {
      try {
        const json: unknown = JSON.parse(await file.text());
        if (Array.isArray(json)) {
          const r = EquipmentTypesSchema.safeParse(json);
          if (!r.success) throw new Error(r.error.issues.slice(0, 5).map((i) => `[${i.path.join('.')}] ${koIssue(i)}`).join(' / '));
          next.equipmentTypes = json as EquipmentType[];
          lines.push(`${file.name}: 기기 ${json.length}종 (equipment-types)`);
        } else if (json && typeof json === 'object' && 'nodes' in json && 'layers' in json) {
          const r = DiagramSchema.safeParse(json);
          if (!r.success) throw new Error(r.error.issues.slice(0, 5).map((i) => `[${i.path.join('.')}] ${koIssue(i)}`).join(' / '));
          next.diagram = json as Draft['diagram'];
          lines.push(`${file.name}: 노드 ${r.data.nodes.length} · 연결선 ${r.data.edges.length} (diagram)`);
        } else if (json && typeof json === 'object') {
          const r = EquipmentImagesSchema.safeParse(json);
          if (!r.success) throw new Error('equipment-types / diagram / equipment-images 형식이 아닙니다');
          next.images = json as Record<string, EquipmentImage>;
          lines.push(`${file.name}: 사진 ${Object.keys(r.data).length}개 (equipment-images)`);
        } else throw new Error('알 수 없는 형식');
      } catch (e) {
        ok = false;
        lines.push(`${file.name}: 가져오기 실패 — ${e instanceof SyntaxError ? 'JSON 문법 오류' : (e as Error).message}`);
      }
    }
    if (ok) {
      commit(next);
      setSelection(null);
    }
    setImportMsg({ ok, lines: ok ? lines : [...lines, '파일 하나라도 실패하면 아무것도 바꾸지 않습니다'] });
    setTab('changes');
  };

  const onFocusIssue = (i: Issue) => {
    const node = i.nodeId
      ? draft.diagram.nodes.find((n) => n.id === i.nodeId)
      : draft.diagram.nodes.find((n) => n.equipmentTypeId === i.equipmentId);
    if (node) {
      setPreview(false);
      setSelection({ type: 'node', id: node.id });
      canvasRef.current?.centerOn(node.x, node.y);
    } else if (i.equipmentId) setLeft({ kind: 'edit', id: i.equipmentId });
  };

  const voltages = useMemo(
    () => [...new Set(draft.diagram.edges.map((e) => e.voltage).filter((v): v is string => !!v))].sort(),
    [draft],
  );
  const editingEq = left.kind === 'edit' ? draft.equipmentTypes.find((e) => e.id === left.id) : undefined;
  const previewEq = previewNode ? model.nodeById.get(previewNode)?.eq : undefined;

  return (
    <div className={`admin${preview ? ' admin--preview' : ''}`} data-testid="admin-page">
      <header className="admin__top">
        <div className="admin__titlebar">
          <Link to="/" className="admin__brand" aria-label="LS ELECTRIC 계통도 홈">
            <BrandLogo className="admin__logo" />
          </Link>
          <h1 className="admin__title">계통도 관리자 모드</h1>
          <div className="admin__views" role="tablist" aria-label="관리 화면">
            {(
              [
                ['diagram', '계통도 편집'],
                ['specs', '사양 검수'],
              ] as [AdminView, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={view === k}
                className={`admin__view${view === k ? ' is-on' : ''}`}
                onClick={() => {
                  setView(k);
                  setPreview(false);
                }}
                data-testid={`admin-tab-${k}`}
              >
                {label}
              </button>
            ))}
          </div>
          <Link to="/" className="admin__back">
            ← 사용자 화면
          </Link>
          <span className="admin__save" aria-live="polite">
            {view === 'specs'
              ? ''
              : saveStatus === 'unavailable'
              ? '⚠ 이 브라우저에 초안을 저장할 수 없습니다 (사생활 보호 모드?) — 창을 닫기 전에 내보내세요'
              : saveStatus === 'saved'
                ? '초안 자동 저장됨'
                : restoredAt
                  ? `저장된 초안을 불러왔습니다 (${new Date(restoredAt).toLocaleString('ko-KR')})`
                  : ''}
          </span>
        </div>
        <p className="admin__warn" role="note">
          편집은 먼저 <strong>이 브라우저에만 저장</strong>됩니다. <strong>사이트에 반영</strong>을 누르고 관리자 비밀번호를 넣으면 몇 분 뒤 모든 사용자 화면에 보입니다.
        </p>
        {view === 'diagram' && staleBase && (
          <p className="admin__stale" role="alert">
            저장된 초안이 만들어진 뒤 원본 데이터(src/data)가 바뀌었습니다. 변경 내역을 확인하고, 필요하면 "초안 초기화" 후 다시 편집하세요.
          </p>
        )}
        {view === 'diagram' && (
        <div className="admin__actions" role="toolbar" aria-label="편집 도구">
          <button type="button" className="abtn" onClick={undo} disabled={past.length === 0} data-testid="admin-undo" title="Ctrl/⌘+Z">
            ↶ 되돌리기 {past.length > 0 && <small>({past.length})</small>}
          </button>
          <button type="button" className="abtn" onClick={redo} disabled={future.length === 0} data-testid="admin-redo" title="Ctrl/⌘+Shift+Z">
            ↷ 다시 실행
          </button>
          <button
            type="button"
            className={`abtn${preview ? ' is-on' : ''}`}
            aria-pressed={preview}
            onClick={() => {
              setPreview((p) => !p);
              setPreviewNode(undefined);
              setConnectFrom(undefined);
            }}
            data-testid="admin-preview"
          >
            {preview ? '편집으로 돌아가기' : '사용자 화면으로 미리보기'}
          </button>
          <span className="admin__spacer" />
          <label className="abtn" htmlFor="admin-import-input">
            JSON 가져오기
          </label>
          <input
            id="admin-import-input"
            className="visually-hidden"
            type="file"
            accept=".json,application/json"
            multiple
            data-testid="admin-import"
            onChange={(e) => {
              void onImport(e.target.files);
              e.target.value = '';
            }}
          />
          <button type="button" className="abtn" onClick={doExport} data-testid="admin-export">
            검사 후 내보내기
          </button>
          <button type="button" className="abtn abtn--primary" onClick={openPublish} data-testid="admin-publish">
            사이트에 반영
          </button>
        </div>
        )}
      </header>

      {view === 'specs' ? (
        <SpecReview />
      ) : (
      <div className="admin__body">
        {!preview && (
          <aside className="admin__left" aria-label="기기 종류">
            {left.kind === 'list' ? (
              <EquipmentList
                draft={draft}
                placeEquipmentId={tool === 'place' && placeKind === 'equipment' ? placeEquipmentId : undefined}
                onAdd={() => setLeft({ kind: 'new' })}
                onEdit={(id) => setLeft({ kind: 'edit', id })}
                onPlace={(id) => startPlace(id)}
                onDelete={onDeleteEquipment}
              />
            ) : (
              <EquipmentForm
                key={left.kind === 'edit' ? left.id : 'new'}
                draft={draft}
                editing={editingEq}
                categories={data.categories}
                products={data.products}
                onSave={onSaveEquipment}
                onCancel={() => setLeft({ kind: 'list' })}
              />
            )}
          </aside>
        )}

        <section className="admin__center" aria-label="편집 계통도">
          {preview ? (
            <div className="admin__modes" role="group" aria-label="미리보기 보기 모드">
              <strong>미리보기</strong>
              {(['product', 'gap'] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`abtn abtn--sm${previewMode === m ? ' is-on' : ''}`}
                  aria-pressed={previewMode === m}
                  onClick={() => setPreviewMode(m)}
                >
                  {m === 'product' ? '제품 보기' : 'Gap 보기'}
                </button>
              ))}
              <span className="admin__hint">초안을 일반 계통도처럼 보여 줍니다 (편집 불가)</span>
            </div>
          ) : (
            <div className="admin__modes" role="group" aria-label="편집 모드">
              <button
                type="button"
                className={`abtn abtn--sm${tool === 'select' ? ' is-on' : ''}`}
                aria-pressed={tool === 'select'}
                onClick={() => {
                  setTool('select');
                  setConnectFrom(undefined);
                }}
                data-testid="admin-select-mode"
              >
                선택·이동
              </button>
              <button
                type="button"
                className={`abtn abtn--sm${tool === 'place' ? ' is-on' : ''}`}
                aria-pressed={tool === 'place'}
                onClick={() => {
                  setTool('place');
                  setConnectFrom(undefined);
                }}
                data-testid="admin-place-mode"
              >
                배치
              </button>
              <button
                type="button"
                className={`abtn abtn--sm${tool === 'connect' ? ' is-on' : ''}`}
                aria-pressed={tool === 'connect'}
                onClick={() => {
                  setTool('connect');
                  const sel = selection?.type === 'node' ? selection.id : undefined;
                  setConnectFrom(sel);
                  if (sel) info(`${nodeName(draft, sel)} 에서 시작 — 연결할 노드를 누르세요`);
                }}
                data-testid="admin-connect-mode"
              >
                연결
              </button>
              {tool === 'place' && (
                <>
                  <label className="admin__inline">
                    종류
                    <select value={placeKind} onChange={(e) => setPlaceKind(e.target.value as PlaceKind)} data-testid="admin-place-kind">
                      {(Object.keys(PLACE_KIND_LABELS) as PlaceKind[]).map((k) => (
                        <option key={k} value={k}>
                          {PLACE_KIND_LABELS[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {(placeKind === 'equipment' || placeKind === 'ref') && (
                    <label className="admin__inline">
                      기기
                      <select value={placeEquipmentId ?? ''} onChange={(e) => setPlaceEquipmentId(e.target.value || undefined)} data-testid="admin-place-equipment">
                        <option value="">— 고르세요 —</option>
                        {draft.equipmentTypes.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.layer} · {equipmentLabel(e)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {placeKind !== 'equipment' && (
                    <>
                      <label className="admin__inline">
                        라벨
                        <input
                          value={placeLabel}
                          onChange={(e) => setPlaceLabel(e.target.value)}
                          placeholder={placeKind === 'bus' ? '예: 380V 모선' : placeKind === 'ref' ? '예: 345/154kV' : '예: 비상 부하'}
                          size={12}
                          data-testid="admin-place-label"
                        />
                      </label>
                      <label className="admin__inline">
                        {placeKind === 'ref' ? '자동 배치 계층' : '계층'}
                        <select value={placeLayer} onChange={(e) => setPlaceLayer(e.target.value as Layer)} data-testid="admin-place-layer">
                          {LAYERS.map((l) => (
                            <option key={l} value={l}>
                              {l} {LAYER_LABELS[l]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                  {placeKind === 'bus' && (
                    <label className="admin__inline">
                      길이
                      <input
                        type="number"
                        min={60}
                        step={10}
                        value={placeWidth}
                        onChange={(e) => setPlaceWidth(Number(e.target.value))}
                        size={5}
                        data-testid="admin-place-width"
                      />
                    </label>
                  )}
                  <button type="button" className="abtn abtn--sm" onClick={autoPlace} disabled={!placeTarget} data-testid="admin-auto-place">
                    빈 자리에 자동 배치
                  </button>
                  <span className="admin__hint">
                    {!placeTarget
                      ? placeKind === 'equipment' || placeKind === 'ref'
                        ? '배치할 기기를 고르세요'
                        : '라벨을 입력하세요'
                      : placeTarget.layer
                        ? `${placeTarget.layer} ${LAYER_LABELS[placeTarget.layer]} 밴드 안을 클릭`
                        : '참조 타일 — 계통도 아무 곳이나 클릭 (같은 기기가 다시 나오는 자리)'}
                  </span>
                </>
              )}
              {tool === 'connect' && (
                <>
                  <label className="admin__inline">
                    종류
                    <select value={edgeKind} onChange={(e) => setEdgeKind(e.target.value as EdgeKind)} data-testid="admin-edge-kind">
                      <option value="power">전력선</option>
                      <option value="signal">신호선</option>
                      <option value="alt">택1 연결</option>
                    </select>
                  </label>
                  <label className="admin__inline">
                    설명 라벨
                    <input
                      value={edgeLabel}
                      onChange={(e) => setEdgeLabel(e.target.value)}
                      placeholder={edgeKind === 'alt' ? '택1 그룹 이름' : '없음'}
                      size={12}
                      data-testid="admin-edge-label"
                    />
                  </label>
                  <label className="admin__inline">
                    전압 라벨
                    <input
                      value={edgeVoltage}
                      onChange={(e) => setEdgeVoltage(e.target.value)}
                      list="admin-voltages"
                      placeholder="없음"
                      size={9}
                      data-testid="admin-edge-voltage"
                    />
                  </label>
                  <span className="admin__hint">
                    {connectFrom ? `${nodeName(draft, connectFrom)} → 연결할 노드를 누르세요 (Esc 취소)` : '시작 노드를 누르세요'}
                  </span>
                </>
              )}
              {tool === 'select' && <span className="admin__hint">노드를 끌어 옮기기 · 노드/연결선을 눌러 고치기</span>}
            </div>
          )}
          <datalist id="admin-voltages">
            {voltages.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <AdminCanvas
            ref={canvasRef}
            draft={draft}
            model={model}
            readOnly={preview}
            viewMode={preview ? previewMode : 'product'}
            tool={tool}
            place={placeTarget}
            selectedNodeId={preview ? previewNode : selection?.type === 'node' ? selection.id : undefined}
            selectedEdgeId={!preview && selection?.type === 'edge' ? selection.id : undefined}
            connectFromId={tool === 'connect' ? connectFrom : undefined}
            onNodeClick={onNodeClick}
            onEdgeClick={(id) => {
              setSelection({ type: 'edge', id });
              setTab('selection');
            }}
            onBackgroundClick={() => {
              setSelection(null);
              setPreviewNode(undefined);
            }}
            onPlace={onPlace}
            onMove={onMove}
          />
          {preview && previewEq && (
            <div className="admin__pcard" role="dialog" aria-label={`${previewEq.name} 미리보기`}>
              <button type="button" className="admin__pclose" onClick={() => setPreviewNode(undefined)} aria-label="닫기">
                ×
              </button>
              <h3>
                {previewEq.name} {previewEq.abbr && <small>{previewEq.abbr}</small>}
              </h3>
              <p className="admin__pmeta">
                {previewEq.layer} {LAYER_LABELS[previewEq.layer]} · {previewEq.voltage} · {COVERAGE_LABELS[previewEq.coverage]}
              </p>
              <p>{previewEq.description}</p>
              {previewEq.gapNote && <p className="admin__pgap">{previewEq.gapNote}</p>}
            </div>
          )}
          {toast && (
            <div className={`admin__toast admin__toast--${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'} data-testid="admin-toast">
              <span>{toast.text}</span>
              <button type="button" onClick={() => setToast(null)} aria-label="알림 닫기">
                ×
              </button>
            </div>
          )}
        </section>

        {!preview && (
          <aside className="admin__right" aria-label="선택·변경 내역·검사">
            <div className="admin__tabs" role="tablist" aria-label="오른쪽 패널">
              {(
                [
                  ['selection', '선택'],
                  ['changes', `변경 내역 ${changes.length}`],
                  ['check', '검사·내보내기'],
                ] as [RightTab, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  id={`admin-tab-${k}`}
                  aria-selected={tab === k}
                  aria-controls={`admin-tabpanel-${k}`}
                  className={`admin__tab${tab === k ? ' is-on' : ''}`}
                  onClick={() => setTab(k)}
                  data-testid={`admin-tab-${k}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="admin__tabpanel" role="tabpanel" id={`admin-tabpanel-${tab}`} aria-labelledby={`admin-tab-${tab}`}>
              {tab === 'selection' && (
                <SelectionPanel
                  draft={draft}
                  selection={selection}
                  onEditEquipment={(id) => setLeft({ kind: 'edit', id })}
                  onDeleteNode={confirmDeleteNode}
                  onStartConnect={(id) => {
                    setTool('connect');
                    setConnectFrom(id);
                    info(`${nodeName(draft, id)} 에서 시작 — 연결할 노드를 누르세요`);
                  }}
                  onMoveNode={onMove}
                  onSelectEdge={(id) => setSelection({ type: 'edge', id })}
                  onDeleteEdge={(id) => {
                    commit(deleteEdge(draft, id));
                    if (selection?.type === 'edge' && selection.id === id) setSelection(null);
                    info(`연결선 ${id} 를 삭제했습니다`);
                  }}
                  onUpdateEdge={(id, patch) => commit(updateEdge(draft, id, patch))}
                  onUpdateNode={(id, patch) => apply(updateNode(draft, id, patch))}
                />
              )}
              {tab === 'changes' && (
                <>
                  {importMsg && (
                    <div className={`admin__import${importMsg.ok ? '' : ' is-error'}`} role={importMsg.ok ? 'status' : 'alert'}>
                      <strong>{importMsg.ok ? '가져오기 완료' : '가져오기 실패'}</strong>
                      <ul>
                        {importMsg.lines.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <ChangesPanel
                    changes={changes}
                    canUndo={past.length > 0}
                    canRedo={future.length > 0}
                    onUndo={undo}
                    onRedo={redo}
                    onReset={() => {
                      if (window.confirm('초안을 원본(src/data)으로 되돌릴까요? (되돌리기로 취소할 수 있습니다)')) {
                        resetToBase();
                        setSelection(null);
                        info('초안을 원본으로 초기화했습니다');
                      }
                    }}
                    onDownloadSummary={() => downloadFile('변경요약.md')}
                  />
                </>
              )}
              {tab === 'check' && (
                <CheckPanel
                  issues={check?.issues ?? null}
                  checkedAt={check?.at ?? null}
                  exported={exported}
                  counts={{ equipment: draft.equipmentTypes.length, nodes: draft.diagram.nodes.length, edges: draft.diagram.edges.length }}
                  onCheck={runCheck}
                  onFocusIssue={onFocusIssue}
                  onDownload={downloadFile}
                />
              )}
            </div>
          </aside>
        )}
      </div>
      )}
      {publishFiles && (
        <PublishDialog
          files={publishFiles}
          defaultMessage={changes.length ? `${changes.length}건 수정` : '사진 정보 수정'}
          onClose={() => setPublishFiles(null)}
          onDone={() => info(`사이트 반영 요청 완료 — 약 4분 뒤 모두에게 보입니다`)}
        />
      )}
    </div>
  );
}
