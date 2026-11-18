import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Layer } from '../../lib/schema';
import type { DiagramModel, NodeItem } from '../../lib/diagram/model';
import { PanZoom } from '../../lib/diagram/panzoom';
import type { ViewMode } from '../../lib/diagram/url';
import { Bands, Edges } from '../../components/diagram/DiagramCanvas';
import DiagramNode from '../../components/diagram/DiagramNode';
import { GRID, TILE_H, TILE_W, checkPlacement, snap, type Draft } from '../../lib/admin/draft';
import '../../components/diagram/DiagramCanvas.css';

export type Tool = 'select' | 'place' | 'connect';

export interface CanvasHandle {
  fitLayer(layer: Layer): void;
  centerOn(x: number, y: number): void;
  fitAll(): void;
  zoomBy(f: number): void;
}

interface Props {
  draft: Draft;
  model: DiagramModel;
  readOnly: boolean;
  viewMode: ViewMode;
  tool: Tool;
  /** 배치 모드에서 놓을 기기 */
  placeEquipmentId?: string;
  selectedNodeId?: string;
  selectedEdgeId?: string;
  connectFromId?: string;
  onNodeClick: (id: string) => void;
  onEdgeClick: (id: string) => void;
  onBackgroundClick: () => void;
  onPlace: (x: number, y: number) => void;
  /** 이동 확정 (검증은 부모가 다시 함) */
  onMove: (id: string, x: number, y: number) => void;
}

interface Ghost {
  x: number;
  y: number;
  reason: string | null;
}

interface DragState {
  id: string;
  sx: number;
  sy: number;
  ox: number;
  oy: number;
  active: boolean;
  pointerId: number;
}

const DRAG_THRESHOLD = 4;

/** 관리자 편집 캔버스 — 일반 계통도의 밴드·연결선·노드 타일을 그대로 쓰고 배치·이동·연결 상호작용만 더한다 */
const AdminCanvas = forwardRef<CanvasHandle, Props>(function AdminCanvas(props, ref) {
  const {
    draft,
    model,
    readOnly,
    viewMode,
    tool,
    placeEquipmentId,
    selectedNodeId,
    selectedEdgeId,
    connectFromId,
    onEdgeClick,
    onBackgroundClick,
    onPlace,
    onMove,
  } = props;
  const vpRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const pzRef = useRef<PanZoom | null>(null);
  const [scalePct, setScalePct] = useState(100);

  // 최신 props 를 네이티브 이벤트 핸들러에서 읽기 위한 ref
  const live = useRef(props);
  live.current = props;

  useLayoutEffect(() => {
    const vp = vpRef.current;
    const sizer = sizerRef.current;
    const inner = innerRef.current;
    if (!vp || !sizer || !inner) return;
    const pz = new PanZoom(vp, sizer, inner, {
      width: model.width,
      height: model.height,
      maxScale: 2,
      onView: (v) => setScalePct(Math.round(v.scale * 100)),
    });
    pzRef.current = pz;
    const l6 = model.layerRect.get('L6');
    if (l6) pz.fitRect(l6, 1);
    else pz.fitAll();
    return () => {
      pz.destroy();
      pzRef.current = null;
    };
    // 캔버스 크기가 바뀔 때만 엔진을 다시 만든다 (편집마다 뷰가 튀지 않게)
  }, [model.width, model.height]);

  useImperativeHandle(
    ref,
    () => ({
      fitLayer: (layer) => {
        const r = model.layerRect.get(layer);
        if (r) pzRef.current?.fitRect(r, 1);
      },
      centerOn: (x, y) => pzRef.current?.centerOn(x, y),
      fitAll: () => pzRef.current?.fitAll(),
      zoomBy: (f) => pzRef.current?.zoomBy(f),
    }),
    [model],
  );

  // 사진: 편집 화면은 전부 바로 로드 (썸네일 160px)
  useEffect(() => {
    const vp = vpRef.current;
    vp?.querySelectorAll<HTMLImageElement>('img[data-src]').forEach((img) => {
      if (img.dataset.src && img.getAttribute('src') !== img.dataset.src) img.src = img.dataset.src;
    });
  });

  /** 화면 좌표 → 계통도 좌표 */
  const toDiagram = useCallback((clientX: number, clientY: number) => {
    const inner = innerRef.current;
    const s = pzRef.current?.scale ?? 1;
    if (!inner) return { x: 0, y: 0 };
    const r = inner.getBoundingClientRect();
    return { x: (clientX - r.left) / s, y: (clientY - r.top) / s };
  }, []);

  // ── 노드 드래그 이동 (그리드 스냅, 위반 시 빨간 미리보기) ──
  const [drag, setDrag] = useState<Ghost & { id: string } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const down = (e: PointerEvent) => {
      const p = live.current;
      if (p.readOnly || p.tool !== 'select' || e.button !== 0 || e.pointerType === 'touch') return;
      const el = (e.target as Element).closest<HTMLElement>('[data-node-id]');
      if (!el) return;
      const id = el.dataset.nodeId!;
      const n = p.draft.diagram.nodes.find((x) => x.id === id);
      if (!n) return;
      // 패닝 엔진(viewport)에 전달하지 않음 → 노드를 잡으면 화면 대신 노드가 움직인다
      e.stopPropagation();
      dragRef.current = { id, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y, active: false, pointerId: e.pointerId };
    };
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const s = pzRef.current?.scale ?? 1;
      const mx = e.clientX - d.sx;
      const my = e.clientY - d.sy;
      if (!d.active) {
        if (Math.hypot(mx, my) <= DRAG_THRESHOLD) return;
        d.active = true;
      }
      e.preventDefault();
      const x = snap(d.ox + mx / s);
      const y = snap(d.oy + my / s);
      const p = live.current;
      const node = p.draft.diagram.nodes.find((n) => n.id === d.id);
      const layer = node && p.draft.equipmentTypes.find((q) => q.id === node.equipmentTypeId)?.layer;
      const reason = layer ? checkPlacement(p.draft, layer, x, y, d.id) : '기기를 찾을 수 없습니다';
      setDrag((prev) => (prev && prev.x === x && prev.y === y && prev.id === d.id ? prev : { id: d.id, x, y, reason }));
    };
    const up = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      dragRef.current = null;
      if (!d.active) return;
      suppressClick.current = true;
      setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      const s = pzRef.current?.scale ?? 1;
      const x = snap(d.ox + (e.clientX - d.sx) / s);
      const y = snap(d.oy + (e.clientY - d.sy) / s);
      setDrag(null);
      live.current.onMove(d.id, x, y);
    };
    inner.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      inner.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  // ── 배치 미리보기 ──
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const placeEq = placeEquipmentId ? draft.equipmentTypes.find((e) => e.id === placeEquipmentId) : undefined;
  const placing = !readOnly && tool === 'place' && !!placeEq;
  useEffect(() => {
    if (!placing) setGhost(null);
  }, [placing]);

  const onPointerMoveInner = (e: React.PointerEvent) => {
    if (!placing || !placeEq) return;
    const { x, y } = toDiagram(e.clientX, e.clientY);
    const sx = snap(x);
    const sy = snap(y);
    if (ghost && ghost.x === sx && ghost.y === sy) return;
    setGhost({ x: sx, y: sy, reason: checkPlacement(draft, placeEq.layer, sx, sy) });
  };

  const onClickInner = (e: React.MouseEvent) => {
    if (readOnly) return;
    // 배치 모드: 노드 위를 눌러도 그 자리로 배치 시도 → 겹침 사유 안내
    if (!placing && (e.target as Element).closest('[data-node-id],[data-edge-hit]')) return;
    if (placing) {
      const { x, y } = toDiagram(e.clientX, e.clientY);
      onPlace(snap(x), snap(y));
      return;
    }
    onBackgroundClick();
  };

  const onActivate = useCallback(
    (id: string) => {
      if (suppressClick.current) return;
      live.current.onNodeClick(id);
    },
    [],
  );

  // 키보드: 선택(포커스)된 노드를 화살표로 10px 이동
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (readOnly || tool !== 'select') return;
    const el = (e.target as Element).closest<HTMLElement>('[data-node-id]');
    if (!el) return;
    const delta: Record<string, [number, number]> = {
      ArrowUp: [0, -GRID],
      ArrowDown: [0, GRID],
      ArrowLeft: [-GRID, 0],
      ArrowRight: [GRID, 0],
    };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    const n = draft.diagram.nodes.find((x) => x.id === el.dataset.nodeId);
    if (n) onMove(n.id, snap(n.x + d[0]), snap(n.y + d[1]));
  };

  const nodes: NodeItem[] = useMemo(
    () => (drag ? model.nodes.map((n) => (n.id === drag.id ? { ...n, x: drag.x, y: drag.y } : n)) : model.nodes),
    [model, drag],
  );

  const selectedEdges = useMemo<ReadonlySet<string>>(() => {
    const s = new Set<string>();
    if (selectedEdgeId) s.add(selectedEdgeId);
    if (selectedNodeId) for (const id of model.edgesByNode.get(selectedNodeId) ?? []) s.add(id);
    return s;
  }, [model, selectedNodeId, selectedEdgeId]);

  const frame = drag ?? (placing ? ghost : null);

  return (
    <div className={`admin-canvas diagram diagram--${viewMode} admin-canvas--${readOnly ? 'preview' : tool}`}>
      <div className="admin-canvas__zoom" role="group" aria-label="확대·축소">
        <button type="button" onClick={() => pzRef.current?.zoomBy(1 / 1.25)} aria-label="축소">
          −
        </button>
        <span aria-live="polite">{scalePct}%</span>
        <button type="button" onClick={() => pzRef.current?.zoomBy(1.25)} aria-label="확대">
          +
        </button>
        <button type="button" onClick={() => pzRef.current?.fitAll()}>
          전체
        </button>
      </div>
      <div className="diagram__stage">
        <div
          ref={vpRef}
          className="diagram__viewport"
          tabIndex={-1}
          role="group"
          aria-label="편집 계통도 — 드래그로 화면 이동, 휠로 확대·축소. 노드에 포커스 후 화살표로 10px 이동"
          data-testid="admin-canvas"
        >
          <div ref={sizerRef} className="diagram__sizer">
            <div
              ref={innerRef}
              className="diagram__inner"
              style={{ width: model.width, height: model.height }}
              onPointerMove={onPointerMoveInner}
              onPointerLeave={() => setGhost(null)}
              onClick={onClickInner}
              onKeyDown={onKeyDown}
            >
              <Bands model={model} mode={viewMode} />
              <Edges model={model} selectedEdges={selectedEdges} />
              {!readOnly && tool === 'select' && (
                <svg
                  className="admin-edge-hits"
                  width={model.width}
                  height={model.height}
                  viewBox={`0 0 ${model.width} ${model.height}`}
                  aria-hidden="true"
                  focusable="false"
                >
                  {model.edges.map((e) => (
                    <path
                      key={e.id}
                      d={e.d}
                      data-edge-hit={e.id}
                      data-testid={`admin-edge-hit-${e.id}`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEdgeClick(e.id);
                      }}
                    />
                  ))}
                </svg>
              )}
              {nodes.map((n) => (
                <DiagramNode
                  key={n.id}
                  item={n}
                  mode={viewMode}
                  selected={n.id === selectedNodeId || n.id === connectFromId}
                  onActivate={onActivate}
                />
              ))}
              {frame && (
                <div
                  className={`admin-ghost${frame.reason ? ' is-invalid' : ' is-valid'}`}
                  style={{ left: frame.x - TILE_W / 2, top: frame.y - TILE_H / 2, width: TILE_W, height: TILE_H }}
                  data-testid="admin-ghost"
                  data-valid={frame.reason ? 'false' : 'true'}
                  aria-hidden="true"
                >
                  {!drag && placeEq && <span className="admin-ghost__title">{placeEq.abbr ?? placeEq.name}</span>}
                  <span className="admin-ghost__reason">{frame.reason ?? `(${frame.x}, ${frame.y})`}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default AdminCanvas;
