import { COVERAGES, LAYER_LABELS, type Coverage, type DiagramEdge, type DiagramLayer, type EquipmentType, type Layer } from '../schema';
import { equipmentThumbUrl, getData, type AppData } from '../../data/load';
import { isGapCoverage, isMainLayer } from '../labels';

/** 노드 사진 타일 크기 (diagram.json 좌표 = 타일 중심, 리더가 이 크기 기준으로 겹침 없음 보장) */
export const TILE_W = 120;
export const TILE_H = 116;
/** 끝점 라벨 상자 크기 (scripts/build-diagram-data.py EP_W/EP_H) */
export const ENDPOINT_W = 120;
export const ENDPOINT_H = 44;

export interface NodeItem {
  id: string;
  x: number;
  y: number;
  eq: EquipmentType;
  coverage: Coverage;
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

export type EdgeKind = 'power' | 'signal' | 'alt';

export interface BusItem {
  id: string;
  d: string;
}

export interface LayerStat {
  total: number;
  owned: number;
  /** 공백 수 = 미보유 + 일부 보유 */
  gaps: number;
}

export interface Neighbor {
  node: NodeItem;
  /** 상대 위치 화살표 ↑ ↓ ← → */
  arrow: string;
  kind: EdgeKind;
  /** 모선을 거쳐 연결된 경우 모선 라벨 */
  via?: string;
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
  /** 자동 모선 (한 기기에서 3갈래 이상 내려가는 전력선 묶음) */
  buses: BusItem[];
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

const isSideLayer = (l: Layer) => l === 'MON' || l === 'REN';
const isGap = isGapCoverage;

interface Box {
  x: number;
  y: number;
  hw: number;
  hh: number;
}

/**
 * 직교 경로 (노드 가장자리에서 출발 → 꺾어서 → 가장자리 도착). 노드 크기별 반폭·반높이 사용
 * (scripts/build-diagram-data.py default_route 와 같은 규칙, 모선 연결은 데이터에 points 가 있음)
 */
function route(a: Box, b: Box): Pt[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dy) >= a.hh + b.hh + 20) {
    const s = Math.sign(dy);
    const y1 = a.y + s * a.hh;
    const y2 = b.y - s * b.hh;
    if (Math.abs(dx) < 4) return [{ x: a.x, y: y1 }, { x: a.x, y: y2 }];
    const my = pyRound((y1 + y2) / 2);
    return [{ x: a.x, y: y1 }, { x: a.x, y: my }, { x: b.x, y: my }, { x: b.x, y: y2 }];
  }
  const s = Math.sign(dx) || 1;
  const x1 = a.x + s * a.hw;
  const x2 = b.x - s * b.hw;
  if (Math.abs(dy) < 4) return [{ x: x1, y: a.y }, { x: x2, y: a.y }];
  const mx = pyRound((x1 + x2) / 2);
  return [{ x: x1, y: a.y }, { x: mx, y: a.y }, { x: mx, y: b.y }, { x: x2, y: b.y }];
}

type Pt = { x: number; y: number };

/** Python round() 와 같은 은행원 반올림 (.5 → 짝수) — 생성기·router.ts 와 같은 중간점 */
function pyRound(v: number): number {
  const f = Math.floor(v);
  const d = v - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

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

/** 데이터가 지정한 우회 경로(타일 가장자리 → … → 타일 가장자리, 직교)를 그대로 잇는다 */
function polyline(points: readonly Pt[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join('');
}

function arrowOf(from: Pt, to: Pt): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dy) >= Math.abs(dx) * 0.6) return dy < 0 ? '↑' : '↓';
  return dx < 0 ? '←' : '→';
}

let cached: { data: AppData; model: DiagramModel } | undefined;

export function getDiagramModel(data: AppData = getData()): DiagramModel {
  if (cached?.data === data) return cached.model;
  const { diagram, equipmentTypeById } = data;

  const nodes: NodeItem[] = [];
  const refs: NodeItem[] = [];
  const busNodes: BusNodeItem[] = [];
  const endpoints: EndpointItem[] = [];
  const boxes = new Map<string, Box & { layer: Layer; kind: 'tile' | 'bus' | 'endpoint' }>();
  for (const n of diagram.nodes) {
    const kind = n.kind ?? 'equipment';
    if (kind === 'bus') {
      if (!n.layer || !n.width) continue;
      busNodes.push({ id: n.id, x: n.x, y: n.y, width: n.width, label: n.label ?? '', layer: n.layer });
      boxes.set(n.id, { x: n.x, y: n.y, hw: n.width / 2, hh: 4, layer: n.layer, kind: 'bus' });
      continue;
    }
    if (kind === 'endpoint') {
      if (!n.layer) continue;
      endpoints.push({ id: n.id, x: n.x, y: n.y, label: n.label ?? '', layer: n.layer });
      boxes.set(n.id, { x: n.x, y: n.y, hw: ENDPOINT_W / 2, hh: ENDPOINT_H / 2, layer: n.layer, kind: 'endpoint' });
      continue;
    }
    const eq = n.equipmentTypeId ? equipmentTypeById.get(n.equipmentTypeId) : undefined;
    if (!eq) continue;
    const item: NodeItem = {
      id: n.id,
      x: n.x,
      y: n.y,
      eq,
      coverage: eq.coverage,
      layer: eq.layer,
      title: eq.abbr ?? eq.name,
      subtitle: n.ref ? n.label : eq.abbr ? (n.label ?? eq.name) : undefined,
      imageUrl: equipmentThumbUrl(eq.id),
    };
    if (n.ref) {
      item.ref = true;
      item.refLabel = n.label;
      refs.push(item);
    } else nodes.push(item);
    boxes.set(n.id, { x: n.x, y: n.y, hw: TILE_W / 2, hh: TILE_H / 2, layer: eq.layer, kind: 'tile' });
  }
  const nodeById = new Map([...nodes, ...refs].map((n) => [n.id, n]));
  const busById = new Map(busNodes.map((b) => [b.id, b]));
  const endpointById = new Map(endpoints.map((p) => [p.id, p]));

  const valid = diagram.edges.filter((e) => boxes.has(e.from) && boxes.has(e.to));
  const kindOf = (e: DiagramEdge): EdgeKind => e.kind ?? 'power';

  // 자동 모선(3갈래 이상 묶음)은 개선 R3에서 제거 — 모선은 데이터(kind: 'bus')로 그린다.
  // (자동 모선의 가로선이 380V 모선→ATS 선과 교차하던 문제, 생성기 기본 경로와 같게 그림)
  const buses: BusItem[] = [];

  const ptsById = new Map<string, Pt[]>();
  const edges: EdgeItem[] = valid.map((e) => {
    const a = boxes.get(e.from)!;
    const b = boxes.get(e.to)!;
    const far = isSideLayer(a.layer) !== isSideLayer(b.layer);
    const pts = e.points ?? route(a, b);
    ptsById.set(e.id, pts);
    return { id: e.id, from: e.from, to: e.to, kind: kindOf(e), d: polyline(pts), label: e.label, far };
  });

  // 택1 배지: 같은 label 의 alt 선 묶음마다 첫 번째 선의 가장 긴 선분 가운데
  const altBadges: AltBadge[] = [];
  for (const e of edges) {
    if (e.kind !== 'alt') continue;
    const label = e.label ?? '택1';
    const g = altBadges.find((b) => b.label === label);
    if (g) {
      g.edgeIds.push(e.id);
      continue;
    }
    const m = longestMid(ptsById.get(e.id)!);
    altBadges.push({ id: `alt-${e.id}`, x: Math.round(m.x), y: Math.round(m.y), label, edgeIds: [e.id] });
  }

  const edgesByNode = new Map<string, string[]>();
  const add = <T,>(map: Map<string, T[]>, k: string, v: T) => map.set(k, [...(map.get(k) ?? []), v]);
  for (const e of edges) {
    add(edgesByNode, e.from, e.id);
    add(edgesByNode, e.to, e.id);
  }

  // 연결 기기: 모선은 건너뛰고 모선 너머 기기를 이웃으로, 끝점은 라벨로
  const neighbors = new Map<string, Neighbor[]>();
  const endpointNeighbors = new Map<string, EndpointNeighbor[]>();
  const otherEnds = (selfId: string) =>
    edges.flatMap((e) => (e.from === selfId ? [{ id: e.to, e }] : e.to === selfId ? [{ id: e.from, e }] : []));
  for (const self of nodeById.values()) {
    const list: Neighbor[] = [];
    const eps: EndpointNeighbor[] = [];
    const push = (o: NodeItem, kind: EdgeKind, via?: string) => {
      if (o.id !== self.id && !list.some((x) => x.node.id === o.id)) list.push({ node: o, arrow: arrowOf(self, o), kind, via });
    };
    for (const { id, e } of otherEnds(self.id)) {
      const o = nodeById.get(id);
      if (o) {
        push(o, e.kind);
        continue;
      }
      const bus = busById.get(id);
      if (bus) {
        for (const { id: id2, e: e2 } of otherEnds(bus.id)) {
          const o2 = nodeById.get(id2);
          if (o2) push(o2, e2.kind === 'signal' || e.kind === 'signal' ? 'signal' : e2.kind === 'alt' ? 'alt' : e.kind, bus.label);
          const ep2 = endpointById.get(id2);
          if (ep2 && !eps.some((x) => x.id === ep2.id))
            eps.push({ id: ep2.id, label: ep2.label, arrow: arrowOf(self, ep2), kind: e2.kind });
        }
        continue;
      }
      const ep = endpointById.get(id);
      if (ep && !eps.some((x) => x.id === ep.id)) eps.push({ id: ep.id, label: ep.label, arrow: arrowOf(self, ep), kind: e.kind });
    }
    if (list.length) neighbors.set(self.id, list);
    if (eps.length) endpointNeighbors.set(self.id, eps);
  }

  const layerRect = new Map(
    diagram.layers.map((l) => [l.id, { x: l.x ?? 0, y: l.y, w: l.width ?? diagram.width, h: l.height }]),
  );

  const layerStats = new Map<Layer, LayerStat>();
  for (const l of diagram.layers) layerStats.set(l.id, { total: 0, owned: 0, gaps: 0 });
  const coverageCounts = Object.fromEntries(COVERAGES.map((c) => [c, 0])) as Record<Coverage, number>;
  for (const n of nodes) {
    coverageCounts[n.coverage] += 1;
    const s = layerStats.get(n.layer);
    if (!s) continue;
    s.total += 1;
    if (n.coverage === 'owned') s.owned += 1;
    if (isGap(n.coverage)) s.gaps += 1;
  }

  const model: DiagramModel = {
    width: diagram.width,
    height: diagram.height,
    layers: diagram.layers,
    layerRect,
    nodes,
    refs,
    nodeById,
    edges,
    buses,
    busNodes,
    endpoints,
    altBadges,
    edgesByNode,
    neighbors,
    endpointNeighbors,
    layerStats,
    coverageCounts,
  };
  cached = { data, model };
  return model;
}

/** 화면 중심점이 속한 계층 (없으면 가장 가까운 계층) */
export function layerAt(model: DiagramModel, x: number, y: number): Layer | null {
  let best: Layer | null = null;
  let bestDist = Infinity;
  for (const [id, r] of model.layerRect) {
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

/** "L4 수전설비" / "감시·제어" */
export const layerTitle = (l: Layer) => (isMainLayer(l) ? `${l} ${LAYER_LABELS[l]}` : LAYER_LABELS[l]);
