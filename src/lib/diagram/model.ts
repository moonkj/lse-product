import { COVERAGES, LAYER_LABELS, type Coverage, type Diagram, type DiagramLayer, type EquipmentType, type Layer } from '../schema';
import { equipmentThumbUrl, getData, type AppData } from '../../data/load';
import { isGapCoverage, isMainLayer } from '../labels';
import { edgeKind, isPowerLike, type EdgeKind } from './geometry';
import { boxOf, defaultRoute, type Pt, type RouteBox } from './router';
import { busRelation, hopsAcrossBus } from './topology';

/**
 * 일반 계통도 화면 모델 — diagram.json + equipment-types.json 에서 화면에 그릴 노드·연결선·이웃·집계를 만든다.
 * 노드 크기·종류 판정은 geometry.ts, 연결선 경로는 router.ts(정본) 를 쓴다. 모선 = 데이터 kind:'bus' 노드.
 */

export type { EdgeKind };

export interface NodeItem {
  id: string;
  x: number;
  y: number;
  eq: EquipmentType;
  coverage: Coverage;
  /** 타일이 놓인 계층 — 기기 타일은 기기 계층, 참조 타일은 타일이 놓인 밴드 */
  layer: Layer;
  /** 타일 굵은 글씨 (약어, 없으면 이름) */
  title: string;
  /** 타일 아래 작은 글씨 (약어가 있을 때만 이름) */
  subtitle?: string;
  /** 타일용 160px 썸네일 (없으면 단선결선도 심볼) */
  imageUrl?: string;
  /** 참조 타일 (같은 기기가 계통에 다시 나오는 자리 — 흐리게, 집계·검색 제외) */
  ref?: boolean;
  /** 참조 타일 라벨 (예 "345/154kV") */
  refLabel?: string;
}

/** 모선 (굵은 가로선) — 중심 x, 길이 width */
export interface BusNodeItem {
  id: string;
  x: number;
  y: number;
  width: number;
  label: string;
  layer: Layer;
}

/** 끝점 라벨 (기기가 아닌 끝: 고압 전동기, 비상 부하, 연계 표시) */
export interface EndpointItem {
  id: string;
  x: number;
  y: number;
  label: string;
  layer: Layer;
}

/** 택1 배지 — 같은 label 의 alt 연결선 묶음마다 첫 번째 선 옆에 1개 */
export interface AltBadge {
  id: string;
  x: number;
  y: number;
  label: string;
  edgeIds: string[];
}

export interface EdgeItem {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  d: string;
  /** 연결선 설명 (택1 그룹 이름 등) */
  label?: string;
  /** 오른쪽 열(감시·신재생)과 왼쪽 계층을 잇는 긴 선 — 평소엔 옅게 */
  far: boolean;
}

export interface LayerStat {
  total: number;
  owned: number;
  /** 공백 수 = 미보유 + 일부 보유 */
  gaps: number;
}

export interface Neighbor {
  node: NodeItem;
  /** 상대 위치 화살표 ↑ ↓ ← → (모선 경유: 상위 ↑ · 하위 ↓ · 같은 모선의 형제 피더는 '') */
  arrow: string;
  kind: EdgeKind;
  /** 모선을 거쳐 연결된 경우 모선 라벨 */
  via?: string;
  /** 같은 모선에서 갈라진 형제 피더 */
  sibling?: boolean;
}

/** 연결된 끝점 라벨 (기기가 아님 — 칩 대신 텍스트로 표시) */
export interface EndpointNeighbor {
  id: string;
  label: string;
  arrow: string;
  kind: EdgeKind;
}

export interface DiagramModel {
  width: number;
  height: number;
  layers: DiagramLayer[];
  layerRect: Map<Layer, { x: number; y: number; w: number; h: number }>;
  /** 기기 타일 (참조 타일 제외 — 기기 종류마다 1개, 집계·검색·범례 기준) */
  nodes: NodeItem[];
  /** 참조 타일 */
  refs: NodeItem[];
  /** 기기 + 참조 타일 (선택 가능한 노드) */
  nodeById: Map<string, NodeItem>;
  edges: EdgeItem[];
  /** 데이터 모선 노드 */
  busNodes: BusNodeItem[];
  endpoints: EndpointItem[];
  altBadges: AltBadge[];
  /** nodeId → 연결 엣지 id */
  edgesByNode: Map<string, string[]>;
  neighbors: Map<string, Neighbor[]>;
  endpointNeighbors: Map<string, EndpointNeighbor[]>;
  layerStats: Map<Layer, LayerStat>;
  coverageCounts: Record<Coverage, number>;
}

type LayerRects = DiagramModel['layerRect'];

const isSideLayer = (l: Layer) => l === 'MON' || l === 'REN';

/** 가장 긴 선분의 가운데 (택1 배지 위치) */
function longestMid(pts: Pt[]): Pt {
  let best = { x: pts[0].x, y: pts[0].y };
  let len = -1;
  for (let i = 0; i + 1 < pts.length; i++) {
    const l = Math.abs(pts[i + 1].x - pts[i].x) + Math.abs(pts[i + 1].y - pts[i].y);
    if (l > len) {
      len = l;
      best = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
    }
  }
  return best;
}

/** 직교 경로(점 목록)를 SVG path 로 */
function polyline(points: readonly Pt[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join('');
}

function arrowOf(from: Pt, to: Pt): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dy) >= Math.abs(dx) * 0.6) return dy < 0 ? '↑' : '↓';
  return dx < 0 ? '←' : '→';
}

/** 점이 속한 계층 밴드 (없으면 가장 가까운 밴드) */
function bandLayerAt(rects: LayerRects, x: number, y: number): Layer | null {
  let best: Layer | null = null;
  let bestDist = Infinity;
  for (const [id, r] of rects) {
    const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
    const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
    const d = dx * dx + dy * dy;
    if (d === 0) return id;
    if (d < bestDist) {
      bestDist = d;
      best = id;
    }
  }
  return best;
}

// ───────────── 단계별 빌더 (리뷰 R9) ─────────────

interface BuiltNodes {
  nodes: NodeItem[];
  refs: NodeItem[];
  busNodes: BusNodeItem[];
  endpoints: EndpointItem[];
  /** 그릴 수 있는 노드의 경계(라우터 기준)와 계층 */
  boxes: Map<string, RouteBox & { layer: Layer }>;
}

function buildNodes(data: AppData, rects: LayerRects): BuiltNodes {
  const out: BuiltNodes = { nodes: [], refs: [], busNodes: [], endpoints: [], boxes: new Map() };
  for (const n of data.diagram.nodes) {
    if (n.kind === 'bus') {
      if (!n.layer || !n.width) continue;
      out.busNodes.push({ id: n.id, x: n.x, y: n.y, width: n.width, label: n.label ?? '', layer: n.layer });
      out.boxes.set(n.id, { ...boxOf(n), layer: n.layer });
      continue;
    }
    if (n.kind === 'endpoint') {
      if (!n.layer) continue;
      out.endpoints.push({ id: n.id, x: n.x, y: n.y, label: n.label ?? '', layer: n.layer });
      out.boxes.set(n.id, { ...boxOf(n), layer: n.layer });
      continue;
    }
    const eq = n.equipmentTypeId ? data.equipmentTypeById.get(n.equipmentTypeId) : undefined;
    if (!eq) continue;
    // 참조 타일의 계층 = 타일이 놓인 밴드 (원래 기기 계층은 eq.layer) — 패널·같은 계층 공백 기준 (T2 M5)
    const layer = n.ref ? (bandLayerAt(rects, n.x, n.y) ?? eq.layer) : eq.layer;
    const item: NodeItem = {
      id: n.id,
      x: n.x,
      y: n.y,
      eq,
      coverage: eq.coverage,
      layer,
      title: eq.abbr ?? eq.name,
      subtitle: n.ref ? n.label : eq.abbr ? (n.label ?? eq.name) : undefined,
      imageUrl: equipmentThumbUrl(eq.id),
    };
    if (n.ref) {
      item.ref = true;
      item.refLabel = n.label;
      out.refs.push(item);
    } else out.nodes.push(item);
    out.boxes.set(n.id, { ...boxOf(n), layer });
  }
  return out;
}

function buildEdges(diagram: Diagram, boxes: BuiltNodes['boxes']): { edges: EdgeItem[]; ptsById: Map<string, Pt[]> } {
  const ptsById = new Map<string, Pt[]>();
  const edges: EdgeItem[] = [];
  for (const e of diagram.edges) {
    const a = boxes.get(e.from);
    const b = boxes.get(e.to);
    if (!a || !b) continue;
    // points 가 없으면 라우터 기본 직교 경로 (모선 범위 밖 등 경로가 없으면 중심끼리 — 무결성 검사가 막는 데이터)
    const pts = e.points ?? defaultRoute(a, b) ?? [
      { x: a.x, y: a.y },
      { x: b.x, y: b.y },
    ];
    ptsById.set(e.id, pts);
    edges.push({ id: e.id, from: e.from, to: e.to, kind: edgeKind(e), d: polyline(pts), label: e.label, far: isSideLayer(a.layer) !== isSideLayer(b.layer) });
  }
  return { edges, ptsById };
}

/** 택1 배지: 같은 label 의 alt 선 묶음마다 첫 번째 선의 가장 긴 선분 가운데 */
function buildAltBadges(edges: readonly EdgeItem[], ptsById: ReadonlyMap<string, Pt[]>): AltBadge[] {
  const badges: AltBadge[] = [];
  for (const e of edges) {
    if (e.kind !== 'alt') continue;
    const label = e.label ?? '택1';
    const g = badges.find((b) => b.label === label);
    if (g) {
      g.edgeIds.push(e.id);
      continue;
    }
    const m = longestMid(ptsById.get(e.id)!);
    badges.push({ id: `alt-${e.id}`, x: Math.round(m.x), y: Math.round(m.y), label, edgeIds: [e.id] });
  }
  return badges;
}

/** 연결 기기: 모선은 건너뛰고 모선 너머 기기를 이웃으로(topology.hopsAcrossBus), 끝점은 라벨로 */
function buildNeighbors(
  edges: readonly EdgeItem[],
  nodeById: ReadonlyMap<string, NodeItem>,
  busById: ReadonlyMap<string, BusNodeItem>,
  endpointById: ReadonlyMap<string, EndpointItem>,
) {
  const neighbors = new Map<string, Neighbor[]>();
  const endpointNeighbors = new Map<string, EndpointNeighbor[]>();
  const isBusId = (id: string) => busById.has(id);
  for (const self of nodeById.values()) {
    const list: Neighbor[] = [];
    const eps: EndpointNeighbor[] = [];
    for (const h of hopsAcrossBus(self.id, edges, isBusId)) {
      const o = nodeById.get(h.id);
      if (o) {
        if (o.id === self.id || list.some((x) => x.node.id === o.id)) continue;
        if (!h.via) {
          list.push({ node: o, arrow: arrowOf(self, o), kind: h.edge.kind });
          continue;
        }
        const e2 = h.via.edge;
        const kind: EdgeKind = !isPowerLike(e2) || !isPowerLike(h.edge) ? 'signal' : e2.kind === 'alt' ? 'alt' : h.edge.kind;
        const rel = busRelation(h);
        const arrow = rel === 'up' ? '↑' : rel === 'down' ? '↓' : '';
        list.push({ node: o, arrow, kind, via: busById.get(h.via.busId)?.label, sibling: rel === 'sibling' || undefined });
        continue;
      }
      const ep = endpointById.get(h.id);
      if (ep && !eps.some((x) => x.id === ep.id)) eps.push({ id: ep.id, label: ep.label, arrow: arrowOf(self, ep), kind: (h.via?.edge ?? h.edge).kind });
    }
    if (list.length) neighbors.set(self.id, list);
    if (eps.length) endpointNeighbors.set(self.id, eps);
  }
  return { neighbors, endpointNeighbors };
}

function buildStats(nodes: readonly NodeItem[], layers: readonly DiagramLayer[]) {
  const layerStats = new Map<Layer, LayerStat>();
  for (const l of layers) layerStats.set(l.id, { total: 0, owned: 0, gaps: 0 });
  const coverageCounts = Object.fromEntries(COVERAGES.map((c) => [c, 0])) as Record<Coverage, number>;
  for (const n of nodes) {
    coverageCounts[n.coverage] += 1;
    const s = layerStats.get(n.layer);
    // 해당 없음(자사 사업 범위 밖)은 보유 집계 분모에서 뺀다 (2026-11-20 사용자)
    if (!s || n.coverage === 'na') continue;
    s.total += 1;
    if (n.coverage === 'owned') s.owned += 1;
    if (isGapCoverage(n.coverage)) s.gaps += 1;
  }
  return { layerStats, coverageCounts };
}

/** 계통도 모델 계산 (캐시 없는 순수 함수 — 관리자 초안 미리보기는 이것을 쓴다) */
export function computeDiagramModel(data: AppData): DiagramModel {
  const { diagram } = data;
  const layerRect: LayerRects = new Map(diagram.layers.map((l) => [l.id, { x: l.x ?? 0, y: l.y, w: l.width ?? diagram.width, h: l.height }]));
  const { nodes, refs, busNodes, endpoints, boxes } = buildNodes(data, layerRect);
  const nodeById = new Map([...nodes, ...refs].map((n) => [n.id, n]));
  const { edges, ptsById } = buildEdges(diagram, boxes);
  const edgesByNode = new Map<string, string[]>();
  for (const e of edges) {
    edgesByNode.set(e.from, [...(edgesByNode.get(e.from) ?? []), e.id]);
    edgesByNode.set(e.to, [...(edgesByNode.get(e.to) ?? []), e.id]);
  }
  const { neighbors, endpointNeighbors } = buildNeighbors(
    edges,
    nodeById,
    new Map(busNodes.map((b) => [b.id, b])),
    new Map(endpoints.map((p) => [p.id, p])),
  );
  return {
    width: diagram.width,
    height: diagram.height,
    layers: diagram.layers,
    layerRect,
    nodes,
    refs,
    nodeById,
    edges,
    busNodes,
    endpoints,
    altBadges: buildAltBadges(edges, ptsById),
    edgesByNode,
    neighbors,
    endpointNeighbors,
    ...buildStats(nodes, diagram.layers),
  };
}

let cached: { data: AppData; model: DiagramModel } | undefined;

/** 일반 화면용 모델 (데이터 객체 기준 캐시). 관리자 초안은 computeDiagramModel 로 따로 만든다 (공용 캐시를 덮어쓰지 않게) */
export function getDiagramModel(data: AppData = getData()): DiagramModel {
  if (cached?.data === data) return cached.model;
  const model = computeDiagramModel(data);
  cached = { data, model };
  return model;
}

/** 화면 중심점이 속한 계층 (없으면 가장 가까운 계층) */
export function layerAt(model: DiagramModel, x: number, y: number): Layer | null {
  return bandLayerAt(model.layerRect, x, y);
}

/**
 * 계층 긴 이름 — diagram.json 의 계층 이름(계통도 밴드·내비 aria 와 같은 출처, 예: "분전반 및 부하")을 쓰고,
 * 없으면 schema LAYER_LABELS (UX 토론 B8: 화면마다 L7 이름이 달랐음)
 */
function layerLabel(l: Layer): string {
  try {
    return getData().diagram.layers.find((x) => x.id === l)?.label ?? LAYER_LABELS[l];
  } catch {
    return LAYER_LABELS[l];
  }
}

/** "L4 수전설비" / "감시·제어" */
export const layerTitle = (l: Layer) => (isMainLayer(l) ? `${l} ${layerLabel(l)}` : layerLabel(l));
