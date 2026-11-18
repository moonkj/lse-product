import {
  COVERAGES,
  LAYER_LABELS,
  type Coverage,
  type DiagramEdge,
  type DiagramLayer,
  type EquipmentCategory,
  type EquipmentType,
  type Layer,
} from '../schema';
import { equipmentImageUrl, getData, type AppData } from '../../data/load';

/** 노드 사진 타일 크기 (diagram.json 좌표 = 타일 중심, 리더가 이 크기 기준으로 겹침 없음 보장) */
export const TILE_W = 120;
export const TILE_H = 116;
const HW = TILE_W / 2;
const HH = TILE_H / 2;

export const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  switching: '개폐',
  protection: '보호',
  transformation: '변압·변성',
  measurement: '계측',
  control: '제어',
  monitoring: '감시',
  generation: '발전·저장',
  conductor: '선로',
  load: '부하',
  system: '설비 시스템',
};

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
  imageUrl?: string;
}

export interface EdgeItem {
  id: string;
  from: string;
  to: string;
  kind: 'power' | 'signal';
  d: string;
  /** 오른쪽 열(감시·신재생)과 왼쪽 계층을 잇는 긴 선 — 평소엔 옅게 */
  far: boolean;
}

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
  kind: 'power' | 'signal';
}

export interface DiagramModel {
  width: number;
  height: number;
  layers: DiagramLayer[];
  layerRect: Map<Layer, { x: number; y: number; w: number; h: number }>;
  nodes: NodeItem[];
  nodeById: Map<string, NodeItem>;
  edges: EdgeItem[];
  buses: BusItem[];
  /** nodeId → 연결 엣지 id */
  edgesByNode: Map<string, string[]>;
  neighbors: Map<string, Neighbor[]>;
  layerStats: Map<Layer, LayerStat>;
  coverageCounts: Record<Coverage, number>;
}

const isSideLayer = (l: Layer) => l === 'MON' || l === 'REN';
const isGap = (c: Coverage) => c === 'missing' || c === 'partial';
export const isGapCoverage = isGap;

/** 직교 경로 (타일 가장자리에서 출발 → 꺾어서 → 타일 가장자리 도착) */
function route(ax: number, ay: number, bx: number, by: number, busY?: number): string {
  const dx = bx - ax;
  const dy = by - ay;
  if (Math.abs(dy) >= TILE_H + 20) {
    const s = Math.sign(dy);
    const y1 = ay + s * HH;
    const y2 = by - s * HH;
    if (Math.abs(dx) < 4) return `M${ax} ${y1}V${y2}`;
    const my = busY ?? Math.round((y1 + y2) / 2);
    return `M${ax} ${y1}V${my}H${bx}V${y2}`;
  }
  const s = Math.sign(dx) || 1;
  const x1 = ax + s * HW;
  const x2 = bx - s * HW;
  if (Math.abs(dy) < 4) return `M${x1} ${ay}H${x2}`;
  const mx = Math.round((x1 + x2) / 2);
  return `M${x1} ${ay}H${mx}V${by}H${x2}`;
}

function arrowOf(from: NodeItem, to: NodeItem): string {
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
  for (const n of diagram.nodes) {
    const eq = equipmentTypeById.get(n.equipmentTypeId);
    if (!eq) continue;
    const name = n.label ?? eq.name;
    nodes.push({
      id: n.id,
      x: n.x,
      y: n.y,
      eq,
      coverage: eq.coverage,
      layer: eq.layer,
      title: eq.abbr ?? name,
      subtitle: eq.abbr ? name : undefined,
      imageUrl: equipmentImageUrl(eq.id),
    });
  }
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const valid = diagram.edges.filter((e) => nodeById.has(e.from) && nodeById.has(e.to));
  const kindOf = (e: DiagramEdge) => e.kind ?? 'power';

  // 모선: 한 기기에서 아래로 3개 이상 전력선이 갈라지면 같은 높이에서 가로 모선(4px)으로 묶는다
  const busYByEdge = new Map<string, number>();
  const buses: BusItem[] = [];
  const downGroups = new Map<string, DiagramEdge[]>();
  for (const e of valid) {
    if (kindOf(e) !== 'power') continue;
    const a = nodeById.get(e.from)!;
    const b = nodeById.get(e.to)!;
    if (b.y - a.y >= TILE_H + 20) {
      const g = downGroups.get(e.from) ?? [];
      g.push(e);
      downGroups.set(e.from, g);
    }
  }
  for (const [fromId, group] of downGroups) {
    if (group.length < 3) continue;
    const a = nodeById.get(fromId)!;
    const tops = group.map((e) => nodeById.get(e.to)!.y - HH);
    const y1 = a.y + HH;
    const busY = Math.round(y1 + Math.min(30, (Math.min(...tops) - y1) / 2));
    const xs = [a.x, ...group.map((e) => nodeById.get(e.to)!.x)];
    buses.push({ id: `bus-${fromId}`, d: `M${Math.min(...xs)} ${busY}H${Math.max(...xs)}` });
    for (const e of group) busYByEdge.set(e.id, busY);
  }

  const edges: EdgeItem[] = valid.map((e) => {
    const a = nodeById.get(e.from)!;
    const b = nodeById.get(e.to)!;
    const far = isSideLayer(a.layer) !== isSideLayer(b.layer);
    return { id: e.id, from: e.from, to: e.to, kind: kindOf(e), d: route(a.x, a.y, b.x, b.y, busYByEdge.get(e.id)), far };
  });

  const edgesByNode = new Map<string, string[]>();
  const neighbors = new Map<string, Neighbor[]>();
  for (const e of edges) {
    for (const [self, other] of [
      [e.from, e.to],
      [e.to, e.from],
    ] as const) {
      edgesByNode.set(self, [...(edgesByNode.get(self) ?? []), e.id]);
      const list = neighbors.get(self) ?? [];
      const o = nodeById.get(other)!;
      if (!list.some((x) => x.node.id === other)) {
        list.push({ node: o, arrow: arrowOf(nodeById.get(self)!, o), kind: e.kind });
      }
      neighbors.set(self, list);
    }
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
    nodeById,
    edges,
    buses,
    edgesByNode,
    neighbors,
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
export const layerTitle = (l: Layer) => (/^L\d$/.test(l) ? `${l} ${LAYER_LABELS[l]}` : LAYER_LABELS[l]);
