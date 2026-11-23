import { useEffect, useMemo, useRef, useState } from 'react';
import { COVERAGE_LABELS, LAYER_LABELS, type EquipmentType } from '../../lib/schema';
import { COVERAGE_ICONS } from '../../lib/labels';
import { nodeKind, nodeName, type Draft } from '../../lib/admin/draft';
import { edgeKind, type EdgeKind } from '../../lib/diagram/geometry';
import { ENTITY_LABELS, KIND_LABELS, type Change, type ChangeEntity } from '../../lib/admin/diff';
import type { Issue } from '../../lib/admin/integrity';

// ───────────────────────── 기기 목록 ─────────────────────────
/** 기기 행 ⋯ 메뉴 — 배치(노드 하나 더)·삭제. Esc·바깥 누르기로 닫힘 */
function RowMenu({ name, canDelete, onPlace, onDelete }: { name: string; canDelete: boolean; onPlace: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (ev: PointerEvent) => {
      if (!ref.current?.contains(ev.target as Node)) setOpen(false);
    };
    const key = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  return (
    <span className="arow-menu" ref={ref}>
      <button type="button" className="abtn abtn--sm arow-menu__btn" aria-expanded={open} aria-label={`${name} 더 보기`} onClick={() => setOpen((o) => !o)}>
        ⋯
      </button>
      {open && (
        <span className="arow-menu__panel" role="group" aria-label={`${name} 작업`}>
          <button
            type="button"
            className="arow-menu__item"
            onClick={() => {
              setOpen(false);
              onPlace();
            }}
          >
            {name} 배치
          </button>
          <button
            type="button"
            className="arow-menu__item arow-menu__item--danger"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            title={canDelete ? undefined : '노드가 남아 있으면 삭제할 수 없습니다'}
          >
            {name} 기기 종류 삭제
          </button>
        </span>
      )}
    </span>
  );
}

export function EquipmentList({
  draft,
  placeEquipmentId,
  onAdd,
  onEdit,
  onPlace,
  onDelete,
}: {
  draft: Draft;
  placeEquipmentId?: string;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onPlace: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const count = useMemo(() => {
    const m = new Map<string, number>();
    // 기기 노드만 (참조 타일은 배치 수에 넣지 않음)
    for (const n of draft.diagram.nodes) if (n.equipmentTypeId && !n.ref) m.set(n.equipmentTypeId, (m.get(n.equipmentTypeId) ?? 0) + 1);
    return m;
  }, [draft]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = [...draft.equipmentTypes];
    // 배치 안 된 기기를 위로
    all.sort((a, b) => Number((count.get(a.id) ?? 0) > 0) - Number((count.get(b.id) ?? 0) > 0));
    return s ? all.filter((e) => `${e.id} ${e.name} ${e.abbr ?? ''} ${e.layer}`.toLowerCase().includes(s)) : all;
  }, [draft, q, count]);

  return (
    <div className="alist">
      <div className="alist__head">
        <h2 className="alist__title">기기 종류 {draft.equipmentTypes.length}</h2>
        <button type="button" className="abtn abtn--primary" onClick={onAdd} data-testid="admin-add-equipment">
          + 기기 추가
        </button>
      </div>
      <label className="visually-hidden" htmlFor="admin-eq-search">
        기기 검색
      </label>
      <input
        id="admin-eq-search"
        className="alist__search"
        type="search"
        placeholder="기기 검색 (이름·약어·id·계층)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className="alist__items">
        {list.map((e) => {
          const n = count.get(e.id) ?? 0;
          return (
            <li
              key={e.id}
              className={`alist__item${e.id === placeEquipmentId ? ' is-active' : ''}`}
              data-testid={`admin-eq-${e.id}`}
            >
              <span className={`alist__cov alist__cov--${e.coverage}`} title={COVERAGE_LABELS[e.coverage]} aria-label={COVERAGE_LABELS[e.coverage]}>
                {COVERAGE_ICONS[e.coverage]}
              </span>
              {/* 행(이름)을 누르면 수정 — 배치·삭제는 ⋯ 메뉴로 (2026-11-23 UX 토론: 80행마다 버튼 3개·빨간 삭제가 반복됐음) */}
              <button type="button" className="alist__name" onClick={() => onEdit(e.id)} data-testid={`admin-eq-edit-${e.id}`}>
                <strong>{e.abbr ?? e.name}</strong>
                {e.abbr && <span> {e.name}</span>}
                <small>
                  {e.layer} · {n > 0 ? `노드 ${n}` : <em className="alist__unplaced">미배치</em>}
                </small>
                <span className="visually-hidden"> 수정</span>
              </button>
              {n === 0 && (
                <button type="button" className="abtn abtn--sm" onClick={() => onPlace(e.id)} aria-label={`${e.name} 배치`}>
                  배치
                </button>
              )}
              <RowMenu name={e.name} canDelete={n === 0} onPlace={() => onPlace(e.id)} onDelete={() => onDelete(e.id)} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ───────────────────────── 선택 정보 ─────────────────────────
export function SelectionPanel({
  draft,
  selection,
  onEditEquipment,
  onDeleteNode,
  onStartConnect,
  onMoveNode,
  onSelectEdge,
  onDeleteEdge,
  onUpdateEdge,
  onUpdateNode,
}: {
  draft: Draft;
  selection: { type: 'node' | 'edge'; id: string } | null;
  onEditEquipment: (id: string) => void;
  onDeleteNode: (id: string) => void;
  onStartConnect: (id: string) => void;
  onMoveNode: (id: string, x: number, y: number) => void;
  onSelectEdge: (id: string) => void;
  onDeleteEdge: (id: string) => void;
  onUpdateEdge: (id: string, patch: { kind?: EdgeKind; voltage?: string; label?: string }) => void;
  onUpdateNode: (id: string, patch: { label?: string; width?: number }) => void;
}) {
  if (!selection) {
    return (
      <div className="asel asel--empty">
        <p>계통도에서 노드나 연결선을 누르면 여기에서 고치거나 지울 수 있습니다.</p>
        <ul className="asel__help">
          <li>
            <strong>선택·이동</strong>: 노드를 끌어 옮김 (10px 그리드), 포커스 후 화살표 키
          </li>
          <li>
            <strong>배치</strong>: 종류(기기·참조 타일·모선·끝점)를 고르고 계층 밴드 안을 클릭
          </li>
          <li>
            <strong>연결</strong>: 노드 A → 노드 B 순서로 클릭
          </li>
          <li>되돌리기 Ctrl/⌘+Z · 다시 실행 Ctrl/⌘+Shift+Z</li>
        </ul>
      </div>
    );
  }
  if (selection.type === 'node') {
    const n = draft.diagram.nodes.find((x) => x.id === selection.id);
    if (!n) return <p className="asel">선택한 노드가 없습니다.</p>;
    const eq = draft.equipmentTypes.find((e) => e.id === n.equipmentTypeId);
    const edges = draft.diagram.edges.filter((e) => e.from === n.id || e.to === n.id);
    const kind = nodeKind(n);
    const kindText = kind === 'bus' ? '모선' : kind === 'endpoint' ? '끝점 (기기 아님)' : n.ref ? '참조 타일 (같은 기기 재등장)' : '기기';
    return (
      <div className="asel" data-testid="admin-selection">
        <h3 className="asel__title">{nodeName(draft, n.id)}</h3>
        <dl className="asel__meta">
          <dt>노드 id</dt>
          <dd>{n.id}</dd>
          <dt>종류</dt>
          <dd data-testid="admin-node-kind">{kindText}</dd>
          {kind === 'equipment' ? (
            <>
              <dt>기기</dt>
              <dd>
                {eq ? `${eq.id} · ${eq.layer} ${LAYER_LABELS[eq.layer]} · ${COVERAGE_LABELS[eq.coverage]}` : `${n.equipmentTypeId ?? '-'} (없음)`}
              </dd>
            </>
          ) : (
            <>
              <dt>계층</dt>
              <dd>{n.layer ? `${n.layer} ${LAYER_LABELS[n.layer]}` : '-'}</dd>
            </>
          )}
        </dl>
        {(kind !== 'equipment' || n.ref) && (
          <NodeLabel
            key={`${n.id}-${n.label ?? ''}-${n.width ?? ''}`}
            label={n.label ?? ''}
            width={kind === 'bus' ? n.width : undefined}
            onApply={(patch) => onUpdateNode(n.id, patch)}
          />
        )}
        <NodePosition key={`${n.id}-${n.x}-${n.y}`} x={n.x} y={n.y} onApply={(x, y) => onMoveNode(n.id, x, y)} />
        <div className="asel__actions">
          {eq && (
            <button type="button" className="abtn" onClick={() => onEditEquipment(eq.id)}>
              기기 정보 수정
            </button>
          )}
          <button type="button" className="abtn" onClick={() => onStartConnect(n.id)}>
            여기서 연결 시작
          </button>
          <button type="button" className="abtn abtn--danger" onClick={() => onDeleteNode(n.id)} data-testid="admin-delete-node">
            노드 삭제
          </button>
        </div>
        <h4 className="asel__sub">연결선 {edges.length}</h4>
        <ul className="asel__edges">
          {edges.map((e) => (
            <li key={e.id}>
              <button type="button" className="asel__link" onClick={() => onSelectEdge(e.id)}>
                {e.id} {nodeName(draft, e.from)} → {nodeName(draft, e.to)}
              </button>
              <span className="asel__kind">{EDGE_KIND_SHORT[edgeKind(e)]}</span>
              <button type="button" className="abtn abtn--sm abtn--danger" onClick={() => onDeleteEdge(e.id)} aria-label={`연결선 ${e.id} 삭제`}>
                삭제
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const e = draft.diagram.edges.find((x) => x.id === selection.id);
  if (!e) return <p className="asel">선택한 연결선이 없습니다.</p>;
  return (
    <div className="asel" data-testid="admin-selection">
      <h3 className="asel__title">
        연결선 {e.id}
      </h3>
      <p>
        {nodeName(draft, e.from)} → {nodeName(draft, e.to)}
      </p>
      <p className="asel__note">{e.points ? `우회 경로 (꺾임 ${e.points.length - 2}회, 자동 계산)` : '기본 직교 경로'}</p>
      <div className="aform__field">
        <label htmlFor="asel-kind">종류</label>
        <select
          id="asel-kind"
          value={edgeKind(e)}
          onChange={(ev) => onUpdateEdge(e.id, { kind: ev.target.value as EdgeKind })}
          data-testid="admin-edge-kind-edit"
        >
          <option value="power">전력선 (굵은 실선)</option>
          <option value="signal">신호선 (가는 점선)</option>
          <option value="alt">택1 연결 (청록 점선 — 여러 기기 중 하나)</option>
        </select>
      </div>
      <EdgeVoltage key={`${e.id}-${e.voltage ?? ''}`} value={e.voltage ?? ''} onApply={(v) => onUpdateEdge(e.id, { voltage: v })} />
      <EdgeLabel key={`${e.id}-label-${e.label ?? ''}`} value={e.label ?? ''} alt={e.kind === 'alt'} onApply={(v) => onUpdateEdge(e.id, { label: v })} />
      <div className="asel__actions">
        <button type="button" className="abtn abtn--danger" onClick={() => onDeleteEdge(e.id)} data-testid="admin-delete-edge">
          연결선 삭제
        </button>
      </div>
    </div>
  );
}

const EDGE_KIND_SHORT: Record<EdgeKind, string> = { power: '전력', signal: '신호', alt: '택1' };

function NodeLabel({
  label,
  width,
  onApply,
}: {
  label: string;
  width?: number;
  onApply: (patch: { label?: string; width?: number }) => void;
}) {
  const [l, setL] = useState(label);
  const [w, setW] = useState(width !== undefined ? String(width) : '');
  return (
    <form
      className="asel__pos"
      onSubmit={(e) => {
        e.preventDefault();
        const patch: { label?: string; width?: number } = {};
        if (l !== label) patch.label = l;
        if (width !== undefined && Number(w) !== width) patch.width = Number(w);
        if (Object.keys(patch).length) onApply(patch);
      }}
    >
      <label>
        라벨 <input value={l} onChange={(e) => setL(e.target.value)} data-testid="admin-node-label" />
      </label>
      {width !== undefined && (
        <label>
          길이 <input type="number" step={10} min={60} value={w} onChange={(e) => setW(e.target.value)} data-testid="admin-node-width" />
        </label>
      )}
      <button type="submit" className="abtn abtn--sm">
        적용
      </button>
    </form>
  );
}

function EdgeLabel({ value, alt, onApply }: { value: string; alt: boolean; onApply: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <div className="aform__field">
      <label htmlFor="asel-label">설명 라벨{alt ? ' (택1 그룹 이름 — 같은 라벨끼리 한 묶음)' : ''}</label>
      <input
        id="asel-label"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== value && onApply(v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && v !== value) onApply(v);
        }}
        placeholder={alt ? '예: 기동 방식 택1: 직입 MS / 인버터' : '없으면 비움'}
        data-testid="admin-edge-label-edit"
      />
    </div>
  );
}

function NodePosition({ x, y, onApply }: { x: number; y: number; onApply: (x: number, y: number) => void }) {
  const [vx, setVx] = useState(String(x));
  const [vy, setVy] = useState(String(y));
  return (
    <form
      className="asel__pos"
      onSubmit={(e) => {
        e.preventDefault();
        const nx = Number(vx);
        const ny = Number(vy);
        if (Number.isFinite(nx) && Number.isFinite(ny)) onApply(Math.round(nx), Math.round(ny));
      }}
    >
      <label>
        x <input type="number" step={10} value={vx} onChange={(e) => setVx(e.target.value)} />
      </label>
      <label>
        y <input type="number" step={10} value={vy} onChange={(e) => setVy(e.target.value)} />
      </label>
      <button type="submit" className="abtn abtn--sm">
        위치 적용
      </button>
    </form>
  );
}

function EdgeVoltage({ value, onApply }: { value: string; onApply: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <div className="aform__field">
      <label htmlFor="asel-voltage">전압 라벨</label>
      <input
        id="asel-voltage"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== value && onApply(v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && v !== value) onApply(v);
        }}
        placeholder="예: 380V (없으면 비움)"
        list="admin-voltages"
      />
    </div>
  );
}

// ───────────────────────── 변경 내역 ─────────────────────────
export function ChangesPanel({
  changes,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onReset,
  onDownloadSummary,
}: {
  changes: Change[];
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onDownloadSummary: () => void;
}) {
  const groups: ChangeEntity[] = ['equipment', 'node', 'edge', 'image'];
  return (
    <div className="achg" data-testid="admin-changes">
      <div className="achg__head">
        <strong>원본 대비 변경 {changes.length}건</strong>
        <span className="achg__btns">
          <button type="button" className="abtn abtn--sm" onClick={onUndo} disabled={!canUndo}>
            되돌리기
          </button>
          <button type="button" className="abtn abtn--sm" onClick={onRedo} disabled={!canRedo}>
            다시 실행
          </button>
        </span>
      </div>
      {changes.length === 0 ? (
        <p className="achg__empty">원본(src/data)과 같습니다.</p>
      ) : (
        groups.map((g) => {
          const list = changes.filter((c) => c.entity === g);
          if (!list.length) return null;
          return (
            <section key={g} className="achg__group">
              <h4>
                {ENTITY_LABELS[g]} {list.length}
              </h4>
              <ul>
                {list.map((c) => (
                  <li key={`${c.entity}-${c.id}`} className={`achg__item achg__item--${c.kind}`} data-change-kind={c.kind}>
                    <span className="achg__kind">{KIND_LABELS[c.kind]}</span> {c.text}
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
      <div className="achg__foot">
        <button type="button" className="abtn" onClick={onDownloadSummary} disabled={changes.length === 0}>
          변경 요약 .md 내려받기
        </button>
        <button type="button" className="abtn abtn--danger" onClick={onReset} disabled={changes.length === 0} data-testid="admin-reset">
          초안 초기화
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── 검사·내보내기 ─────────────────────────
export function CheckPanel({
  issues,
  checkedAt,
  exported,
  counts,
  onCheck,
  onFocusIssue,
  onDownload,
}: {
  issues: Issue[] | null;
  checkedAt: number | null;
  exported: string[];
  counts: { equipment: number; nodes: number; edges: number };
  onCheck: () => void;
  onFocusIssue: (i: Issue) => void;
  onDownload: (file: string) => void;
}) {
  const errors = issues?.filter((i) => i.level === 'error') ?? [];
  const warns = issues?.filter((i) => i.level === 'warn') ?? [];
  const IssueRow = ({ i }: { i: Issue }) => (
    <li className={`achk__issue achk__issue--${i.level}`}>
      <span className="achk__area">{i.area}</span> {i.message}
      {(i.nodeId || i.equipmentId) && (
        <button type="button" className="abtn abtn--sm" onClick={() => onFocusIssue(i)}>
          보기
        </button>
      )}
    </li>
  );
  return (
    <div className="achk" data-testid="admin-check">
      <p className="achk__intro">
        내보내기 전에 데이터 무결성 테스트(DI 규칙)와 같은 기준으로 스키마·참조·노드 겹침·밴드 이탈·연결선 관통·전력선 교차·모선 연결·공백 판정 근거를 모두 검사합니다. 오류가 있으면 내보낼 수 없습니다.
      </p>
      <button type="button" className="abtn" onClick={onCheck} data-testid="admin-check-run">
        무결성 검사 실행
      </button>
      {issues && (
        <div className="achk__result" aria-live="polite">
          {errors.length === 0 ? (
            <p className="achk__ok" data-testid="admin-check-ok">
              ✓ 검사 통과 — 기기 {counts.equipment}종 · 노드 {counts.nodes} · 연결선 {counts.edges}
              {warns.length > 0 && ` (경고 ${warns.length})`}
            </p>
          ) : (
            <div className="achk__errors" role="alert" data-testid="admin-validation-errors">
              <strong>오류 {errors.length}건 — 고친 뒤 다시 내보내세요</strong>
              <ul>
                {errors.map((i, k) => (
                  <IssueRow key={k} i={i} />
                ))}
              </ul>
            </div>
          )}
          {warns.length > 0 && (
            <details className="achk__warns">
              <summary>경고 {warns.length}건 (내보내기는 가능)</summary>
              <ul>
                {warns.map((i, k) => (
                  <IssueRow key={k} i={i} />
                ))}
              </ul>
            </details>
          )}
          {checkedAt && <p className="achk__time">검사 시각 {new Date(checkedAt).toLocaleTimeString('ko-KR')}</p>}
        </div>
      )}
      {exported.length > 0 && (
        <div className="achk__exported" data-testid="admin-exported">
          <strong>내보낸 파일</strong>
          <ul>
            {exported.map((f) => (
              <li key={f}>
                <button type="button" className="asel__link" onClick={() => onDownload(f)}>
                  {f} 다시 받기
                </button>
              </li>
            ))}
          </ul>
          <ol className="achk__steps">
            <li>
              JSON 파일을 저장소 <code>src/data/</code> 에 덮어씁니다 (같은 이름).
            </li>
            <li>
              <code>npm run test:data</code> 로 데이터 검사를 돌립니다.
            </li>
            <li>변경 요약 .md 내용을 커밋 메시지로 커밋하면 배포 후 모두에게 반영됩니다.</li>
          </ol>
        </div>
      )}
      <div className="achk__gh">
        <button type="button" className="abtn" disabled aria-describedby="admin-gh-note">
          GitHub에 바로 반영 (준비 중)
        </button>
        <p id="admin-gh-note" className="aform__hint">
          원격 저장소를 연결한 뒤 2단계에서 제공합니다. 지금은 내보낸 파일을 직접 커밋하세요.
        </p>
      </div>
    </div>
  );
}

export function equipmentLabel(e: EquipmentType) {
  return e.abbr ? `${e.abbr} ${e.name}` : e.name;
}
