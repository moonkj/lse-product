/**
 * 단선도 그리기 (계통 구성 기본 화면, 2026-11-26 3차 고도화)
 * 상자(전원·모선·기기·반)를 캔버스에 놓고 선으로 잇는다. 반을 고르면 안에 들어갈 품목(ACB·MCCB…)을 구성한다.
 * 잘못 이은 곳·잘못 넣은 품목은 이유와 '제안대로 고치기'. 여러 장 저장, 되돌리기, 제품 목록·CSV.
 * 마우스 없이: 상자는 버튼(Tab), 방향키 이동, Delete 지우기, '연결하기' → 대상 상자 누르기.
 */
import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as RPointerEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getData, productImageUrl, type SpecsMap } from '../../data/load';
import CoverageBadge from '../../components/common/CoverageBadge';
import { useSpecs } from '../../components/compare/useSpecs';
import { announce } from '../../lib/announce';
import { COVERAGE_ORDER, todayIso } from '../../lib/labels';
import { LAYER_LABELS, type Layer } from '../../lib/schema';
import { downloadText } from '../../lib/pages/catalog';
import { maxOf, productRatings } from '../../lib/builder/specParse';
import { QTY_MAX, candidateProducts, isInstrumentProduct } from '../../lib/builder/validate';
import {
  CANVAS_H,
  CANVAS_W,
  PANEL_TYPES,
  VOLTAGES,
  eqName,
  isOffLine,
  isTransformer,
  makeNode,
  nodeSize,
  nodeTitle,
  panelTypeById,
  voltageLabel,
  voltageOf,
  type DNode,
  type Diagram,
  type VoltageId,
} from '../../lib/draw/model';
import { validateDiagram, summarizeDiagram, type DFix, type DIssue } from '../../lib/draw/validate';
import {
  addItem,
  addNode,
  applyDFix,
  connect,
  diagramBom,
  diagramBomCsv,
  fillProducts,
  moveItem,
  moveNode,
  removeEdge,
  removeItem,
  removeNode,
  reverseEdge,
  setItemQty,
  updateItem,
  updateNode,
} from '../../lib/draw/ops';
import { PRESETS } from '../../lib/draw/presets';
import { edgePath, portPoint } from '../../lib/draw/geometry';
import { decodeDiagram, diagramShareUrl } from '../../lib/draw/share';
import { diagramSvg } from '../../lib/draw/exportSvg';
import { useCurrentDiagram, useDrawStore } from '../../lib/draw/store';
import PanelEditor from './PanelEditor';
import { itemSpecText } from '../../lib/draw/ratings';
import './DrawEditor.css';

const DRAG_TYPE = 'text/x-lse-draw';
type Sel = { type: 'node'; id: string } | { type: 'edge'; id: string } | null;

const eqById = (id: string) => getData().equipmentTypeById.get(id);

/** 왼쪽 목록에 넣지 않는 기기 (반 종류로 따로 있거나 선에 놓지 않는 소프트웨어·제어기) */
const PALETTE_SKIP = new Set(['mv-swgr', 'lv-swgr', 'panelboard', 'mcc', 'substation', 'hmi', 'plc', 'servo', 'gearbox', 'dmc', 'smart-device', 'empr', 'elcb', 'mcb-rcbo', 'branch-mccb']);
const LAYER_ORDER: Layer[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'REN', 'MON'];

export default function DrawEditor() {
  const d = useCurrentDiagram();
  const st = useDrawStore();
  const specsState = useSpecs('builder');
  const specs = specsState.status === 'ready' ? specsState.map : undefined;
  const issues = useMemo(() => validateDiagram(d, specs), [d, specs]);
  const summary = summarizeDiagram(d, issues);
  const [sel, setSel] = useState<Sel>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showBom, setShowBom] = useState(false);
  const [panelOpen, setPanelOpen] = useState<string | null>(null);
  const [name, setName] = useState(d.name);
  const canvasRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setName(d.name), [d.id, d.name]);

  /** 화면 맞추기 — 단선도 전체가 캔버스 창에 들어오도록 배율을 정하고 왼쪽 위로 */
  const fitView = () => {
    const w = wrapRef.current;
    if (!w || !d.nodes.length) return;
    const maxX = Math.max(...d.nodes.map((n) => n.x + nodeSize(n).w)) + 60;
    const maxY = Math.max(...d.nodes.map((n) => n.y + nodeSize(n).h)) + 60;
    const z = Math.max(0.5, Math.min(1, Math.floor(Math.min(w.clientWidth / maxX, w.clientHeight / maxY) * 10) / 10));
    setZoom(z);
    w.scrollTo({ left: 0, top: 0 });
  };
  useEffect(() => {
    setSel(null);
    setConnectFrom(null);
    // 단선도를 열면 한눈에 보이게
    const t = window.setTimeout(fitView, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.id]);
  // 지운 상자·선을 고르고 있으면 해제
  useEffect(() => {
    if (sel?.type === 'node' && !d.nodes.some((n) => n.id === sel.id)) setSel(null);
    if (sel?.type === 'edge' && !d.edges.some((e) => e.id === sel.id)) setSel(null);
  }, [d, sel]);

  // 되돌리기·다시 실행, Esc (입력란 밖에서만)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
      } else if (e.key === 'Escape') {
        setConnectFrom(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [st]);

  const commit = (next: Diagram, say?: string) => {
    st.commit(next);
    if (say) announce(say);
  };

  /** 보이는 화면 가운데 근처 빈 자리 */
  const freeSpot = (): { x: number; y: number } => {
    const w = wrapRef.current;
    const cx = w ? (w.scrollLeft + w.clientWidth / 2) / zoom - 75 : 300;
    const cy = w ? (w.scrollTop + 80) / zoom : 60;
    let y = cy;
    while (d.nodes.some((n) => Math.abs(n.x - cx) < 140 && Math.abs(n.y - y) < 100)) y += 120;
    return { x: cx, y };
  };

  const addFromPalette = (code: string, at?: { x: number; y: number }) => {
    const [kind, eq] = code.split(':') as [DNode['kind'], string | undefined];
    const p = at ?? freeSpot();
    const n = makeNode(kind, p.x, p.y, eq || undefined);
    let next = addNode(d, n);
    // 고른 상자 아래에 붙여 놓기: 고른 상자가 있으면 바로 잇는다
    if (!at && sel?.type === 'node' && kind !== 'source') next = connect(next, sel.id, n.id);
    commit(next, `${nodeTitle(n)}을(를) 놓았습니다`);
    setSel({ type: 'node', id: n.id });
  };

  const onCanvasDrop = (ev: DragEvent) => {
    const code = ev.dataTransfer.getData(DRAG_TYPE);
    if (!code || !canvasRef.current) return;
    ev.preventDefault();
    const r = canvasRef.current.getBoundingClientRect();
    addFromPalette(code, { x: (ev.clientX - r.left) / zoom - 70, y: (ev.clientY - r.top) / zoom - 30 });
  };

  /* ── 상자 끌어 옮기기 · 연결점 끌어 잇기 ── */
  const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; before: Diagram; moved: boolean } | null>(null);
  const [wire, setWire] = useState<{ from: string; x: number; y: number } | null>(null);

  const toCanvas = (cx: number, cy: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: (cx - r.left) / zoom, y: (cy - r.top) / zoom };
  };

  const onNodePointerDown = (ev: RPointerEvent, n: DNode) => {
    if (ev.button !== 0) return;
    if ((ev.target as HTMLElement).closest('.drw-port')) return;
    drag.current = { id: n.id, sx: ev.clientX, sy: ev.clientY, ox: n.x, oy: n.y, before: d, moved: false };
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
  };
  const onNodePointerMove = (ev: RPointerEvent) => {
    const g = drag.current;
    if (!g) return;
    const dx = (ev.clientX - g.sx) / zoom;
    const dy = (ev.clientY - g.sy) / zoom;
    if (!g.moved && Math.hypot(dx, dy) < 4) return;
    g.moved = true;
    st.replace(moveNode(useDrawStore.getState().diagrams[useDrawStore.getState().currentId], g.id, g.ox + dx, g.oy + dy));
  };
  const onNodePointerUp = (n: DNode) => {
    const g = drag.current;
    drag.current = null;
    if (g?.moved) st.commitFrom(g.before);
    else onNodeClick(n);
  };

  const onNodeClick = (n: DNode) => {
    if (connectFrom && connectFrom !== n.id) {
      commit(connect(d, connectFrom, n.id), `'${nodeTitle(d.nodes.find((x) => x.id === connectFrom)!)}'와 '${nodeTitle(n)}'을(를) 이었습니다`);
      setConnectFrom(null);
    }
    setSel({ type: 'node', id: n.id });
  };

  const onPortDown = (ev: RPointerEvent, n: DNode) => {
    ev.stopPropagation();
    ev.preventDefault();
    const p = toCanvas(ev.clientX, ev.clientY);
    setWire({ from: n.id, ...p });
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
  };
  const onPortMove = (ev: RPointerEvent) => {
    if (!wire) return;
    setWire({ ...wire, ...toCanvas(ev.clientX, ev.clientY) });
  };
  const onPortUp = (ev: RPointerEvent) => {
    if (!wire) return;
    const el = document.elementsFromPoint(ev.clientX, ev.clientY).find((x) => (x as HTMLElement).dataset?.node && (x as HTMLElement).dataset.node !== wire.from) as HTMLElement | undefined;
    const target = el?.dataset.node;
    if (target) {
      const a = d.nodes.find((x) => x.id === wire.from)!;
      const b = d.nodes.find((x) => x.id === target)!;
      commit(connect(d, wire.from, target), `'${nodeTitle(a)}'와 '${nodeTitle(b)}'을(를) 이었습니다`);
    }
    setWire(null);
  };

  const onNodeKey = (ev: React.KeyboardEvent, n: DNode) => {
    const step = 20;
    const mv: Record<string, [number, number]> = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] };
    if (mv[ev.key]) {
      ev.preventDefault();
      commit(moveNode(d, n.id, n.x + mv[ev.key][0], n.y + mv[ev.key][1]));
    } else if (ev.key === 'Delete' || ev.key === 'Backspace') {
      ev.preventDefault();
      commit(removeNode(d, n.id), `'${nodeTitle(n)}'을(를) 지웠습니다`);
    }
  };

  const apply = (f: DFix, say?: string) => commit(applyDFix(d, f), say);
  const nodeIssues = (id: string) => issues.filter((i) => i.node === id);
  const edgeIssues = new Map<string, DIssue['severity']>();
  for (const i of issues) if (i.edge && i.severity !== 'info') edgeIssues.set(i.edge, i.severity === 'error' || edgeIssues.get(i.edge) === 'error' ? 'error' : 'warn');

  const selNode = sel?.type === 'node' ? d.nodes.find((n) => n.id === sel.id) : undefined;
  const selEdge = sel?.type === 'edge' ? d.edges.find((e) => e.id === sel.id) : undefined;

  const [note, setNote] = useState<{ kind: 'loaded' | 'bad' | 'copied' | 'manual'; url?: string } | null>(null);
  const [params, setParams] = useSearchParams();
  const code = params.get('d');
  // 공유 링크(#/builder?d=…)로 들어오면 사본으로 추가
  useEffect(() => {
    if (!code) return;
    const shared = decodeDiagram(code);
    if (shared) {
      useDrawStore.getState().create(shared);
      setNote({ kind: 'loaded' });
      announce('공유받은 단선도를 사본으로 추가했습니다');
    } else setNote({ kind: 'bad' });
    setParams({}, { replace: true });
  }, [code, setParams]);

  const copyShare = async () => {
    const url = diagramShareUrl(d);
    try {
      await navigator.clipboard.writeText(url);
      setNote({ kind: 'copied' });
      announce('공유 링크를 복사했습니다');
    } catch {
      setNote({ kind: 'manual', url });
    }
  };
  const fileBase = `단선도_${d.name.replace(/[\\/:*?"<>|\s]+/g, '_')}_${todayIso()}`;
  const svgText = () => diagramSvg(d, issues, todayIso());
  const downloadSvg = () => {
    downloadText(`${fileBase}.svg`, svgText(), 'image/svg+xml;charset=utf-8');
    announce('단선도 그림(SVG)을 내려받았습니다');
  };
  const downloadPng = () => {
    const svg = svgText();
    const m = svg.match(/width="(\d+(?:\.\d+)?)" height="(\d+(?:\.\d+)?)"/);
    const w = m ? Number(m[1]) : 1200;
    const h = m ? Number(m[2]) : 800;
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = () => {
      const scale = 2;
      const c = document.createElement('canvas');
      c.width = w * scale;
      c.height = h * scale;
      const ctx = c.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${fileBase}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        announce('단선도 그림(PNG)을 내려받았습니다');
      }, 'image/png');
    };
    img.src = url;
  };
  const [printing, setPrinting] = useState(false);
  const printDiagram = () => {
    setPrinting(true);
    document.documentElement.classList.add('print-diagram');
    const done = () => {
      document.documentElement.classList.remove('print-diagram');
      setPrinting(false);
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    setTimeout(() => {
      window.print();
      // 일부 브라우저는 afterprint 를 보내지 않음
      setTimeout(done, 500);
    }, 50);
  };

  const exportCsv = () => {
    const rows = diagramBom(d, specs);
    downloadText(`단선도_${d.name.replace(/[\\/:*?"<>|\s]+/g, '_')}_${todayIso()}.csv`, diagramBomCsv(d, rows, todayIso()), 'text/csv;charset=utf-8');
    announce('제품 목록 CSV를 내려받았습니다');
  };

  return (
    <div className="drw" data-testid="draw-editor">
      {/* 단선도 고르기·관리 */}
      <div className="drw-bar" role="toolbar" aria-label="단선도">
        <label className="drw-bar__pick">
          <span className="visually-hidden">단선도 고르기</span>
          <select value={d.id} onChange={(e) => st.open(e.target.value)} data-testid="draw-pick">
            {st.order.map((id) => (
              <option key={id} value={id}>
                {st.diagrams[id].name}
              </option>
            ))}
          </select>
        </label>
        <label className="drw-bar__name">
          <span className="visually-hidden">단선도 이름</span>
          <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onBlur={() => st.rename(name)} onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} data-testid="draw-name" />
        </label>
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => (st.create(), announce('새 단선도를 만들었습니다'))} data-testid="draw-new">
          ＋ 새 단선도
        </button>
        <label className="drw-bar__preset">
          <span className="visually-hidden">예시로 시작</span>
          <select
            value=""
            onChange={(e) => {
              const p = PRESETS.find((x) => x.id === e.target.value);
              if (!p) return;
              st.create(fillProducts(p.make(), specs));
              announce(`${p.label} 예시로 새 단선도를 만들었습니다`);
            }}
            disabled={!specs}
            data-testid="draw-preset"
          >
            <option value="">{specs ? '예시로 시작…' : '정격 불러오는 중…'}</option>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => (st.duplicate(), announce('단선도를 복제했습니다'))} data-testid="draw-dup">
          복제
        </button>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => {
            if (window.confirm(`'${d.name}' 단선도를 지울까요? 이 브라우저에서 없어지며 되돌릴 수 없습니다.`)) {
              st.remove(d.id);
              announce('단선도를 지웠습니다');
            }
          }}
          data-testid="draw-delete"
        >
          지우기
        </button>
        <span className="drw-bar__sep" aria-hidden="true" />
        <button type="button" className="btn btn--secondary btn--sm" onClick={st.undo} disabled={!st.past.length} title="Ctrl+Z" data-testid="draw-undo">
          ↶ 되돌리기
        </button>
        <button type="button" className="btn btn--secondary btn--sm" onClick={st.redo} disabled={!st.future.length} title="Ctrl+Shift+Z" data-testid="draw-redo">
          ↷ 다시
        </button>
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => commit(fillProducts(d, specs), '비어 있는 제품을 정격이 맞는 자사 제품으로 채웠습니다')} disabled={!specs} data-testid="draw-fill">
          {specs ? '제품 채우기' : '정격 불러오는 중…'}
        </button>
        <span className="drw-bar__zoom" role="group" aria-label="확대·축소">
          <button type="button" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(1)))} aria-label="축소" data-testid="draw-zoom-out">
            −
          </button>
          <span aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(1)))} aria-label="확대" data-testid="draw-zoom-in">
            ＋
          </button>
          <button type="button" className="drw-bar__fit" onClick={fitView} data-testid="draw-fit">
            화면 맞추기
          </button>
        </span>
      </div>
      <div className="drw-bar drw-bar--out" role="toolbar" aria-label="내보내기">
        <button type="button" className="btn btn--secondary btn--sm" onClick={copyShare} disabled={!d.nodes.length} data-testid="draw-share">
          공유 링크 복사
        </button>
        <button type="button" className="btn btn--secondary btn--sm" onClick={downloadPng} disabled={!d.nodes.length} data-testid="draw-png">
          그림 PNG
        </button>
        <button type="button" className="btn btn--secondary btn--sm" onClick={downloadSvg} disabled={!d.nodes.length} data-testid="draw-svg">
          그림 SVG
        </button>
        <button type="button" className="btn btn--secondary btn--sm" onClick={printDiagram} disabled={!d.nodes.length} data-testid="draw-print">
          단선도 인쇄
        </button>
      </div>
      {note && (
        <div className={`bld-share-note${note.kind === 'bad' ? ' is-bad' : ''}`} role="status" data-testid="draw-share-note">
          {note.kind === 'loaded' && <span>공유받은 단선도를 내 목록에 사본으로 추가했습니다. 원래 단선도들은 그대로 있습니다.</span>}
          {note.kind === 'bad' && <span>공유 링크를 읽을 수 없습니다. 링크가 잘렸는지 확인하세요.</span>}
          {note.kind === 'copied' && <span>공유 링크를 복사했습니다. 받는 사람이 열면 이 단선도가 사본으로 추가됩니다.</span>}
          {note.kind === 'manual' && (
            <label>
              복사가 막혀 있습니다. 아래 링크를 직접 복사하세요.
              <input readOnly value={note.url} onFocus={(e) => e.currentTarget.select()} data-testid="draw-share-url" />
            </label>
          )}
          <button type="button" className="bld-share-note__x" onClick={() => setNote(null)} aria-label="알림 닫기">
            ×
          </button>
        </div>
      )}

      {connectFrom && (
        <p className="drw-connecting" role="status" data-testid="draw-connecting">
          '{nodeTitle(d.nodes.find((n) => n.id === connectFrom)!)}'에서 이을 상자를 누르세요. <button type="button" onClick={() => setConnectFrom(null)}>그만두기 (Esc)</button>
        </p>
      )}

      <div className="drw-grid">
        <Palette onPick={(c) => addFromPalette(c)} />

        <div
          ref={wrapRef}
          className="drw-wrap"
          onDragOver={(e) => e.dataTransfer.types.includes(DRAG_TYPE) && e.preventDefault()}
          onDrop={onCanvasDrop}
          data-testid="draw-canvas-wrap"
        >
          <div
            ref={canvasRef}
            className="drw-canvas"
            style={{ width: CANVAS_W * zoom, height: CANVAS_H * zoom }}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) setSel(null);
            }}
            role="region"
            aria-label={`${d.name} 캔버스 — 상자 ${d.nodes.length}개, 선 ${d.edges.length}개`}
            data-testid="draw-canvas"
          >
            <div className="drw-canvas__inner" style={{ transform: `scale(${zoom})`, width: CANVAS_W, height: CANVAS_H }}>
              <svg className="drw-edges" width={CANVAS_W} height={CANVAS_H} aria-hidden="true">
                {d.edges.map((e) => {
                  const a = d.nodes.find((n) => n.id === e.from);
                  const b = d.nodes.find((n) => n.id === e.to);
                  if (!a || !b) return null;
                  const path = edgePath(a, b);
                  const sev = edgeIssues.get(e.id);
                  return (
                    <g key={e.id} className={`drw-edge${sev ? ` drw-edge--${sev}` : ''}${sel?.type === 'edge' && sel.id === e.id ? ' is-selected' : ''}`} data-testid={`draw-edge-${e.id}`}>
                      <path d={path} className="drw-edge__hit" onPointerDown={(ev) => (ev.stopPropagation(), setSel({ type: 'edge', id: e.id }))} />
                      <path d={path} className="drw-edge__line" />
                    </g>
                  );
                })}
                {wire && (() => {
                  const a = d.nodes.find((n) => n.id === wire.from);
                  if (!a) return null;
                  const s = portPoint(a);
                  return <path className="drw-wire" d={`M${s.x},${s.y} L${wire.x},${wire.y}`} />;
                })()}
              </svg>
              {d.nodes.map((n) => (
                <NodeBox
                  key={n.id}
                  n={n}
                  issues={nodeIssues(n.id)}
                  selected={sel?.type === 'node' && sel.id === n.id}
                  connectTarget={!!connectFrom && connectFrom !== n.id}
                  onPointerDown={(e) => onNodePointerDown(e, n)}
                  onPointerMove={onNodePointerMove}
                  onPointerUp={() => onNodePointerUp(n)}
                  onKeyDown={(e) => onNodeKey(e, n)}
                  onClick={(e) => {
                    // 키보드(Enter·Space)로 누른 경우만 — 마우스는 pointerup 에서 처리
                    if (e.detail === 0) onNodeClick(n);
                  }}
                  onDoubleClick={() => n.kind === 'panel' && setPanelOpen(n.id)}
                  onPortDown={(e) => onPortDown(e, n)}
                  onPortMove={onPortMove}
                  onPortUp={onPortUp}
                />
              ))}
              {d.nodes.length === 0 && (
                <div className="drw-empty" data-testid="draw-empty">
                  <b>빈 단선도입니다</b>
                  <span>왼쪽 목록에서 전원·모선·반·기기를 끌어다 놓거나 누르세요.</span>
                  <span>
                    처음이면 위 <b>예시로 시작…</b>에서 수전설비·데이터센터·전체 계통을 골라 보세요.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {selNode && (
          <div className="drw-mobilebar" data-testid="draw-mobilebar">
            <b>{nodeTitle(selNode)}</b>
            {!(selNode.kind === 'equipment' && isOffLine(selNode.eq)) && (
              <button type="button" onClick={() => (setConnectFrom(selNode.id), announce('이을 상자를 누르세요'))}>
                연결하기
              </button>
            )}
            <button type="button" onClick={() => commit(removeNode(d, selNode.id), `'${nodeTitle(selNode)}'을(를) 지웠습니다`)}>
              지우기
            </button>
            <button type="button" onClick={() => document.querySelector('.drw-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              자세히 ↓
            </button>
          </div>
        )}

        <Inspector
          d={d}
          node={selNode}
          edge={selEdge}
          issues={issues}
          specs={specs}
          onCommit={commit}
          onApply={apply}
          onSelect={setSel}
          onConnect={(id) => (setConnectFrom(id), announce('이을 상자를 누르세요'))}
          onOpenPanel={setPanelOpen}
        />
      </div>

      <div className="bld-summary drw-summary" role="status" data-testid="draw-summary">
        <span>
          상자 <b>{summary.nodes}</b>
        </span>
        <span>
          선 <b>{summary.edges}</b>
        </span>
        <span className={summary.attention ? 'is-warn' : undefined}>
          확인할 점 <b>{summary.attention}</b>
        </span>
        <span>
          자사 보유 아님 <b>{summary.notOwned}</b>
        </span>
        <button type="button" className="bld-summary__btn" aria-expanded={showBom} onClick={() => setShowBom((v) => !v)} data-testid="draw-bom-toggle">
          제품 목록 {showBom ? '접기 ▴' : '보기 ▾'}
        </button>
      </div>
      {showBom && <Bom d={d} specs={specs} onCsv={exportCsv} />}
      {panelOpen && d.nodes.some((x) => x.id === panelOpen && x.kind === 'panel') && (
        <PanelEditor d={d} n={d.nodes.find((x) => x.id === panelOpen)!} specs={specs} issues={issues} onCommit={commit} onApply={apply} onClose={() => setPanelOpen(null)} />
      )}
      {printing && <div className="drw-print" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svgText() }} />}
    </div>
  );
}

/* ── 상자 ── */
interface NodeBoxProps {
  n: DNode;
  issues: DIssue[];
  selected: boolean;
  connectTarget: boolean;
  onPointerDown: (e: RPointerEvent) => void;
  onPointerMove: (e: RPointerEvent) => void;
  onPointerUp: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onPortDown: (e: RPointerEvent) => void;
  onPortMove: (e: RPointerEvent) => void;
  onPortUp: (e: RPointerEvent) => void;
}

function NodeBox({ n, issues, selected, connectTarget, onPointerDown, onPointerMove, onPointerUp, onKeyDown, onClick, onDoubleClick, onPortDown, onPortMove, onPortUp }: NodeBoxProps) {
  const s = nodeSize(n);
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warns = issues.filter((i) => i.severity === 'warn').length;
  const state = errors ? 'error' : warns ? 'warn' : 'ok';
  const title = nodeTitle(n);
  const p = n.product ? getData().productById.get(n.product) : undefined;
  const e = n.eq ? eqById(n.eq) : undefined;
  const pt = n.kind === 'panel' ? panelTypeById(n.eq) : undefined;
  const sub =
    n.kind === 'bus' || n.kind === 'source'
      ? voltageLabel(n.v)
      : isTransformer(n.eq)
        ? `${voltageLabel(n.hv)} → ${voltageLabel(n.lv)} · ${n.kVA ?? '-'}kVA`
        : n.kind === 'equipment' && isOffLine(n.eq)
          ? '신호·감시'
          : voltageLabel(n.v);
  const img = p ? productImageUrl(p.id, true) : undefined;
  const itemSummary = (n.items ?? []).map((i) => `${eqById(i.eq)?.abbr ?? eqName(i.eq)}${i.qty && i.qty > 1 ? `×${i.qty}` : ''}`);
  return (
    <div
      className={`drw-node drw-node--${n.kind} drw-node--${state}${selected ? ' is-selected' : ''}${connectTarget ? ' is-target' : ''}`}
      style={{ left: n.x, top: n.y, width: s.w, height: s.h }}
    >
      <button
        type="button"
        className="drw-node__body"
        data-node={n.id}
        aria-pressed={selected}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        data-testid={`draw-node-${n.id}`}
        data-kind={n.kind}
        data-eq={n.eq}
        data-state={state}
      >
        {n.kind === 'bus' ? (
          <span className="drw-node__buslabel">{title}</span>
        ) : n.kind === 'source' ? (
          <>
            <span className="drw-node__icon" aria-hidden="true">
              ⚡
            </span>
            <span className="drw-node__title">{title}</span>
            <span className="drw-node__sub">{sub}</span>
          </>
        ) : n.kind === 'panel' ? (
          <>
            <span className="drw-node__head">
              <b>{title}</b>
              <small>{sub}</small>
            </span>
            <span className="drw-node__items">{itemSummary.length ? itemSummary.slice(0, 8).join(' · ') + (itemSummary.length > 8 ? ' …' : '') : '안이 비어 있음'}</span>
            <span className="drw-node__product">{p ? p.name : pt?.label}</span>
          </>
        ) : (
          <>
            <span className="drw-node__pic" aria-hidden="true">
              {img ? <img src={img} alt="" loading="lazy" draggable={false} /> : e ? <CoverageBadge coverage={e.coverage} variant="icon" /> : null}
            </span>
            <span className="drw-node__title">
              {e?.abbr ? `${e.abbr} ` : ''}
              {n.label ?? e?.name}
              {n.qty && n.qty > 1 ? <span className="drw-node__qty"> ×{n.qty}</span> : null}
            </span>
            <span className="drw-node__sub">{sub}</span>
            <span className="drw-node__product">{p?.name ?? (e && e.coverage !== 'owned' && e.coverage !== 'partial' ? '자사 제품 없음' : '')}</span>
          </>
        )}
        {n.kind === 'bus' && <span className="visually-hidden">, {sub}</span>}
        {errors + warns > 0 && <span className="visually-hidden">, 확인할 점 {errors + warns}개</span>}
        {(errors > 0 || warns > 0) && (
          <span className={`drw-node__badge drw-node__badge--${errors ? 'error' : 'warn'}`} aria-hidden="true">
            {errors ? '⛔' : '⚠'} {errors + warns}
          </span>
        )}
      </button>
      {!(n.kind === 'equipment' && isOffLine(n.eq)) && (
        <span className="drw-port" title="끌어서 다른 상자에 놓으면 선이 이어집니다" onPointerDown={onPortDown} onPointerMove={onPortMove} onPointerUp={onPortUp} data-testid={`draw-port-${n.id}`} aria-hidden="true" />
      )}
    </div>
  );
}

/* ── 왼쪽 목록 ── */
function Palette({ onPick }: { onPick: (code: string) => void }) {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const all = [...getData().equipmentTypeById.values()].filter((e) => !PALETTE_SKIP.has(e.id) && e.coverage !== undefined);
    const match = (s: string) => !q || s.toLowerCase().includes(q.toLowerCase());
    const rank = (c: string) => COVERAGE_ORDER.indexOf(c as never);
    return LAYER_ORDER.map((layer) => ({
      layer,
      items: all.filter((e) => e.layer === layer && match(`${e.abbr ?? ''} ${e.name}`)).sort((a, b) => rank(a.coverage) - rank(b.coverage)),
    })).filter((g) => g.items.length);
  }, [q]);
  const item = (code: string, label: string, extra?: React.ReactNode) => (
    <li key={code}>
      <button
        type="button"
        className="drw-pal-item"
        draggable
        onDragStart={(ev) => {
          ev.dataTransfer.setData(DRAG_TYPE, code);
          ev.dataTransfer.effectAllowed = 'copy';
        }}
        onClick={() => onPick(code)}
        data-testid={`draw-pal-${code.replace(':', '-')}`}
      >
        {extra}
        <span>{label}</span>
      </button>
    </li>
  );
  return (
    <aside className="drw-palette" aria-label="상자 목록">
      <h2 className="drw-palette__title">상자 목록</h2>
      <p className="drw-palette__hint">캔버스로 끌어 놓거나 누르세요. 상자를 고른 채 누르면 그 아래에 이어 붙습니다.</p>
      <h3 className="drw-palette__h">기본</h3>
      <ul className="drw-palette__list">
        {item('source:', '전원 (한전 수전)', <span className="drw-pal-ico" aria-hidden="true">⚡</span>)}
        {item('bus:', '모선', <span className="drw-pal-ico" aria-hidden="true">━</span>)}
      </ul>
      <h3 className="drw-palette__h">반 (안에 제품 구성)</h3>
      <ul className="drw-palette__list">{PANEL_TYPES.map((p) => item(`panel:${p.id}`, p.label, <span className="drw-pal-ico" aria-hidden="true">▤</span>))}</ul>
      <label className="visually-hidden" htmlFor="drw-pal-q">
        기기 검색
      </label>
      <input id="drw-pal-q" className="drw-palette__search" type="search" placeholder="기기 검색 (예: VCB, 변압기)" value={q} onChange={(e) => setQ(e.target.value)} />
      {groups.map((g) => (
        <section key={g.layer}>
          <h3 className="drw-palette__h">{LAYER_LABELS[g.layer]}</h3>
          <ul className="drw-palette__list">{g.items.map((e) => item(`equipment:${e.id}`, `${e.abbr ? `${e.abbr} ` : ''}${e.name}`, <CoverageBadge coverage={e.coverage} variant="icon" />))}</ul>
        </section>
      ))}
    </aside>
  );
}

/* ── 오른쪽 패널 ── */
interface InspectorProps {
  d: Diagram;
  node?: DNode;
  edge?: { id: string; from: string; to: string };
  issues: DIssue[];
  specs?: SpecsMap;
  onCommit: (d: Diagram, say?: string) => void;
  onApply: (f: DFix, say?: string) => void;
  onSelect: (s: Sel) => void;
  onConnect: (id: string) => void;
  onOpenPanel: (id: string) => void;
}

function fitNote(productId: string, v: VoltageId | undefined, specs?: SpecsMap): { ok: boolean | null; text: string } {
  if (!specs) return { ok: null, text: '정격 불러오는 중' };
  const s = specs.get(productId);
  if (!s) return { ok: null, text: '정격 정보 없음' };
  if (isInstrumentProduct(productId)) return { ok: true, text: 'PT·CT로 연결' };
  const vo = voltageOf(v);
  const kv = maxOf(productRatings(s).kV);
  if (!vo || vo.dc || kv === undefined) return { ok: true, text: '정격 정보 있음' };
  return kv >= vo.kV * 0.95 ? { ok: true, text: '전압 맞음' } : { ok: false, text: `최대 ${kv}kV — 안 맞음` };
}

function Inspector({ d, node, edge, issues, specs, onCommit, onApply, onSelect, onConnect, onOpenPanel }: InspectorProps) {
  if (edge) {
    const a = d.nodes.find((n) => n.id === edge.from);
    const b = d.nodes.find((n) => n.id === edge.to);
    const list = issues.filter((i) => i.edge === edge.id);
    return (
      <aside className="drw-panel" aria-label="선" data-testid="draw-panel">
        <h2 className="drw-panel__title">선</h2>
        <p className="drw-panel__meta">
          {a ? nodeTitle(a) : '?'} → {b ? nodeTitle(b) : '?'}
        </p>
        {list.length > 0 && <IssueList issues={list} onApply={onApply} />}
        <div className="drw-panel__actions">
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => onCommit(reverseEdge(d, edge.id), '선 방향을 바꿨습니다')}>
            방향 바꾸기
          </button>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => onCommit(removeEdge(d, edge.id), '선을 지웠습니다')} data-testid="draw-edge-delete">
            선 지우기
          </button>
        </div>
      </aside>
    );
  }
  if (!node) {
    const list = issues.filter((i) => i.severity !== 'info');
    return (
      <aside className="drw-panel" aria-label="확인할 점" data-testid="draw-panel">
        <h2 className="drw-panel__title">확인할 점 {list.length}</h2>
        {d.nodes.length === 0 ? (
          <p className="drw-panel__ok">상자를 놓으면 연결·전압·반 구성·정격을 확인해 알려 줍니다.</p>
        ) : list.length === 0 ? (
          <p className="drw-panel__ok">지금 단선도에서 규칙에 걸리는 곳이 없습니다. 상자를 누르면 제품과 반 안 구성을 고를 수 있습니다.</p>
        ) : (
          <IssueList issues={list} onApply={onApply} onGo={(id) => onSelect({ type: 'node', id })} />
        )}
      </aside>
    );
  }
  const n = node;
  const title = nodeTitle(n);
  const list = issues.filter((i) => i.node === n.id && !i.item);
  const conns = d.edges.filter((e) => e.from === n.id || e.to === n.id);
  const set = (patch: Partial<DNode>, say?: string) => onCommit(updateNode(d, n.id, patch), say);
  const tr = n.kind === 'equipment' && isTransformer(n.eq);
  const offline = n.kind === 'equipment' && isOffLine(n.eq);
  const products = n.eq && n.kind !== 'bus' && n.kind !== 'source' ? candidateProducts(n.eq) : [];
  const pt = n.kind === 'panel' ? panelTypeById(n.eq) : undefined;
  const e = n.eq ? eqById(n.eq) : undefined;
  return (
    <aside className="drw-panel" aria-label={`${title} 상자`} data-testid="draw-panel">
      <h2 className="drw-panel__title">{title}</h2>
      <p className="drw-panel__meta">
        {n.kind === 'panel' ? pt?.hint : n.kind === 'bus' ? '여러 선이 붙는 모선' : n.kind === 'source' ? '전원 — 단선도의 시작점' : e ? `${LAYER_LABELS[e.layer]} · ${e.voltage}` : ''}
      </p>
      {e && n.kind === 'equipment' && <CoverageBadge coverage={e.coverage} />}

      <label className="drw-field">
        이름
        <input value={n.label ?? ''} placeholder={title} maxLength={30} onChange={(ev) => set({ label: ev.target.value || undefined })} data-testid="draw-label" />
      </label>

      {tr ? (
        <div className="drw-fields">
          <label className="drw-field">
            1차 전압
            <VoltageSelect value={n.hv} onChange={(v) => set({ hv: v })} testId="draw-hv" />
          </label>
          <label className="drw-field">
            2차 전압
            <VoltageSelect value={n.lv} onChange={(v) => set({ lv: v })} testId="draw-lv" />
          </label>
          <label className="drw-field">
            용량 (kVA)
            <input type="number" min={10} step={50} value={n.kVA ?? ''} onChange={(ev) => set({ kVA: Math.max(1, Number(ev.target.value) || 0) })} data-testid="draw-kva" />
          </label>
          <label className="drw-field">
            %Z
            <input type="number" min={1} max={20} step={0.5} value={n.pctZ ?? 6} onChange={(ev) => set({ pctZ: Math.max(0.5, Number(ev.target.value) || 0) })} />
          </label>
        </div>
      ) : !offline ? (
        <label className="drw-field">
          전압
          <VoltageSelect value={n.v} onChange={(v) => set({ v })} testId="draw-voltage" />
        </label>
      ) : (
        <p className="drw-panel__note">계전기·계측기·감시 기기는 PT·CT나 통신으로 연결되므로 선을 잇지 않아도 됩니다.</p>
      )}

      {n.kind === 'bus' && (
        <label className="drw-field">
          모선 길이 (px)
          <input type="number" min={160} max={2000} step={20} value={n.w ?? 420} onChange={(ev) => set({ w: Math.min(2000, Math.max(160, Number(ev.target.value) || 420)) })} data-testid="draw-bus-w" />
        </label>
      )}

      {products.length > 0 && (
        <label className="drw-field">
          {n.kind === 'panel' ? '반 제품 (함체)' : '자사 제품'}
          <select value={n.product ?? ''} onChange={(ev) => set({ product: ev.target.value || undefined })} data-testid="draw-product">
            <option value="">(제품 고르기)</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {fitNote(p.id, tr ? n.hv : n.v, specs).text}
              </option>
            ))}
          </select>
        </label>
      )}
      {n.product && (
        <p className="drw-panel__link">
          <Link to={`/product/${encodeURIComponent(n.product)}`}>제품 상세 보기 →</Link>
        </p>
      )}
      {n.kind === 'equipment' && n.eq && (
        <QtyField value={n.qty ?? 1} onChange={(q) => set({ qty: q > 1 ? q : undefined })} testId="draw-qty" />
      )}

      {pt && <PanelItems d={d} n={n} specs={specs} issues={issues} onCommit={onCommit} onApply={onApply} onOpen={() => onOpenPanel(n.id)} />}

      <h3 className="drw-panel__h">확인할 점</h3>
      {list.length === 0 ? <p className="drw-panel__ok">이 상자에는 확인할 점이 없습니다.</p> : <IssueList issues={list} onApply={onApply} />}

      <h3 className="drw-panel__h">연결 {conns.length}</h3>
      {conns.length > 0 && (
        <ul className="drw-conns">
          {conns.map((c) => {
            const other = d.nodes.find((x) => x.id === (c.from === n.id ? c.to : c.from));
            return (
              <li key={c.id}>
                <span>
                  {c.from === n.id ? '아래로 → ' : '위에서 ← '}
                  {other ? nodeTitle(other) : '?'}
                </span>
                <button type="button" onClick={() => onCommit(removeEdge(d, c.id), '선을 지웠습니다')} aria-label={`${other ? nodeTitle(other) : ''} 선 지우기`}>
                  지우기
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="drw-panel__actions">
        {!offline && (
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => onConnect(n.id)} data-testid="draw-connect">
            연결하기
          </button>
        )}
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => onCommit(removeNode(d, n.id), `'${title}'을(를) 지웠습니다`)} data-testid="draw-node-delete">
          상자 지우기
        </button>
      </div>
    </aside>
  );
}

function VoltageSelect({ value, onChange, testId }: { value?: VoltageId; onChange: (v: VoltageId) => void; testId: string }) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value as VoltageId)} data-testid={testId}>
      {!value && <option value="">(전압 없음)</option>}
      {VOLTAGES.map((v) => (
        <option key={v.id} value={v.id}>
          {v.label}
        </option>
      ))}
    </select>
  );
}

function QtyField({ value, onChange, testId, label = '수량' }: { value: number; onChange: (q: number) => void; testId: string; label?: string }) {
  return (
    <div className="drw-qty" role="group" aria-label={label}>
      <button type="button" aria-label={`${label} 줄이기`} disabled={value <= 1} onClick={() => onChange(value - 1)}>
        −
      </button>
      <input type="number" min={1} max={QTY_MAX} aria-label={label} value={value} onChange={(e) => onChange(Math.min(QTY_MAX, Math.max(1, Number(e.target.value) || 1)))} data-testid={testId} />
      <button type="button" aria-label={`${label} 늘리기`} disabled={value >= QTY_MAX} onClick={() => onChange(value + 1)}>
        ＋
      </button>
    </div>
  );
}

/** 반 안 구성 — 품목마다 기기·제품·수량, 순서 바꾸기, 빼기 / 넣을 수 있는 기기 목록에서 넣기 */
function PanelItems({ d, n, specs, issues, onCommit, onApply, onOpen }: { d: Diagram; n: DNode; specs?: SpecsMap; issues: DIssue[]; onCommit: (d: Diagram, say?: string) => void; onApply: (f: DFix, say?: string) => void; onOpen: () => void }) {
  const pt = panelTypeById(n.eq)!;
  const [add, setAdd] = useState(pt.accepts[0]);
  useEffect(() => setAdd(pt.accepts[0]), [pt]);
  const items = n.items ?? [];
  return (
    <section className="drw-items" aria-labelledby={`drw-items-${n.id}`} data-testid="draw-items">
      <h3 id={`drw-items-${n.id}`} className="drw-panel__h">
        반 안 구성 <small>{items.length}종 · {items.reduce((s, i) => s + (i.qty ?? 1), 0)}개</small>
      </h3>
      <button type="button" className="btn btn--primary btn--sm drw-items__open" onClick={onOpen} data-testid="draw-panel-open">
        반 안 구성 열기 (회로표·결선도)
      </button>
      {items.length === 0 && <p className="drw-panel__note">비어 있습니다. 아래에서 기기를 넣으세요.</p>}
      <ol className="drw-items__list">
        {items.map((it, idx) => {
          const own = issues.filter((i) => i.node === n.id && i.item === it.id && i.severity !== 'info');
          const products = candidateProducts(it.eq);
          const isMain = pt.main.includes(it.eq) && items.findIndex((x) => pt.main.includes(x.eq)) === idx;
          return (
            <li key={it.id} className={`drw-item${own.some((i) => i.severity === 'error') ? ' is-error' : own.length ? ' is-warn' : ''}`} data-testid={`draw-item-${it.eq}`}>
              <div className="drw-item__head">
                <b>
                  {eqName(it.eq)}
                  {isMain && <span className="drw-item__tag">주차단기</span>}
                </b>
                <span className="drw-item__tools">
                  <button type="button" aria-label="위로" disabled={idx === 0} onClick={() => onCommit(moveItem(d, n.id, it.id, -1))}>
                    ↑
                  </button>
                  <button type="button" aria-label="아래로" disabled={idx === items.length - 1} onClick={() => onCommit(moveItem(d, n.id, it.id, 1))}>
                    ↓
                  </button>
                  <button type="button" aria-label={`${eqName(it.eq)} 빼기`} onClick={() => onCommit(removeItem(d, n.id, it.id), `${eqName(it.eq)}을(를) 뺐습니다`)} data-testid="draw-item-remove">
                    ✕
                  </button>
                </span>
              </div>
              {(it.name || itemSpecText(it, specs)) && (
                <span className="drw-item__spec">{[it.name, itemSpecText(it, specs)].filter(Boolean).join(' · ')}</span>
              )}
              <div className="drw-item__row">
                {products.length > 0 ? (
                  <select aria-label={`${eqName(it.eq)} 제품`} value={it.product ?? ''} onChange={(e) => onCommit(updateItem(d, n.id, it.id, { product: e.target.value || undefined }))} data-testid="draw-item-product">
                    <option value="">(제품 고르기)</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {fitNote(p.id, n.v, specs).text}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="drw-item__none">{eqById(it.eq)?.coverage === 'owned' ? '개별 제품 없음' : '자사 제품 없음'}</span>
                )}
                <QtyField value={it.qty ?? 1} onChange={(q) => onCommit(setItemQty(d, n.id, it.id, q))} testId="draw-item-qty" label={`${eqName(it.eq)} 수량`} />
              </div>
              {own.length > 0 && <IssueList issues={own} onApply={onApply} compact />}
            </li>
          );
        })}
      </ol>
      <div className="drw-items__add">
        <label>
          <span className="visually-hidden">넣을 기기</span>
          <select value={add} onChange={(e) => setAdd(e.target.value)} data-testid="draw-item-add-eq">
            {pt.accepts.map((id) => (
              <option key={id} value={id}>
                {eqName(id)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => onCommit(addItem(d, n.id, add), `${eqName(add)}을(를) 넣었습니다`)} data-testid="draw-item-add">
          ＋ 넣기
        </button>
      </div>
    </section>
  );
}

function IssueList({ issues, onApply, onGo, compact }: { issues: DIssue[]; onApply: (f: DFix, say?: string) => void; onGo?: (id: string) => void; compact?: boolean }) {
  return (
    <ul className={`bld-issues${compact ? ' drw-issues--compact' : ''}`} data-testid="draw-issues">
      {issues.map((i) => (
        <li key={i.key} className={`bld-issue bld-issue--${i.severity}`} data-rule={i.rule}>
          <span className="bld-issue__icon" aria-hidden="true">
            {i.severity === 'error' ? '⛔' : i.severity === 'warn' ? '⚠' : 'ℹ'}
          </span>
          <span className="visually-hidden">{i.severity === 'error' ? '규칙에 맞지 않음: ' : i.severity === 'warn' ? '확인 필요: ' : '안내: '}</span>
          <span className="bld-issue__msg">{i.message}</span>
          <span className="bld-issue__actions">
            {i.fix && (
              <button type="button" className="bld-fix" onClick={() => onApply(i.fix!.fix, `제안대로 고쳤습니다: ${i.fix!.label}`)} data-testid="draw-fix">
                {i.fix.label}
              </button>
            )}
            {onGo && i.node && (
              <button type="button" className="bld-go" onClick={() => onGo(i.node!)}>
                상자로
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Bom({ d, specs, onCsv }: { d: Diagram; specs?: SpecsMap; onCsv: () => void }) {
  const rows = diagramBom(d, specs);
  return (
    <section className="pg-card bld-bom" aria-labelledby="drw-bom-h" data-testid="draw-bom">
      <div className="bld-bom__head">
        <h2 id="drw-bom-h">제품 목록 {rows.length}</h2>
        <div className="bld-bom__actions">
          <button type="button" className="btn btn--secondary btn--sm" onClick={onCsv} data-testid="draw-csv">
            CSV 내려받기
          </button>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => window.print()}>
            인쇄
          </button>
        </div>
      </div>
      <div className="bld-bom__scroll">
        <table className="bld-table">
          <thead>
            <tr>
              <th scope="col">위치</th>
              <th scope="col">기기</th>
              <th scope="col">보유 상태</th>
              <th scope="col">선택 제품</th>
              <th scope="col">대표 정격</th>
              <th scope="col">수량</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{r.where}</td>
                <td>{r.equipment}</td>
                <td>{r.coverage}</td>
                <td>{r.product}</td>
                <td>{r.rating}</td>
                <td>{r.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
