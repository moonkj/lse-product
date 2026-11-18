/**
 * 관리자 편집 초안(draft) — 순수 함수 모음.
 * 원본 = src/data/*.json (원본 파일의 키 순서를 그대로 유지하려고 Zod parse 결과가 아니라 raw JSON 을 복제해 쓴다).
 */
import type { Diagram, DiagramEdge, DiagramNode, EquipmentImage, EquipmentType, Layer } from '../schema';
import { ROUTE_TILE_H, ROUTE_TILE_W, defaultRoute, pathHitsTiles, routeEdge, type Pt } from '../diagram/router';

export interface Draft {
  equipmentTypes: EquipmentType[];
  diagram: Diagram;
  /** equipment-images.json (key = 기기 id) */
  images: Record<string, EquipmentImage>;
}

export const TILE_W = ROUTE_TILE_W;
export const TILE_H = ROUTE_TILE_H;
const HW = TILE_W / 2;
const HH = TILE_H / 2;
/** 타일 사이 최소 여유 — 생성기 MIN_GAP */
export const MIN_GAP = 30;
/** 배치·이동 그리드 */
export const GRID = 10;

export const snap = (v: number) => Math.round(v / GRID) * GRID;

export const cloneDraft = (d: Draft): Draft => JSON.parse(JSON.stringify(d)) as Draft;

/** 원본 파일과 같은 키 순서(생성기 eq() 출력 순서)로 기기 객체를 만든다. 빈 선택 필드는 생략 */
export function canonicalEquipment(e: EquipmentType): EquipmentType {
  const out: Record<string, unknown> = {
    id: e.id,
    name: e.name,
    layer: e.layer,
    voltage: e.voltage,
    category: e.category,
    description: e.description,
    learnPoints: [...e.learnPoints],
    coverage: e.coverage,
    lseCategoryCodes: [...e.lseCategoryCodes],
  };
  if (e.abbr) out.abbr = e.abbr;
  if (e.productIds && e.productIds.length > 0) out.productIds = [...e.productIds];
  if (e.gapNote) out.gapNote = e.gapNote;
  if (e.affiliateName) out.affiliateName = e.affiliateName;
  return out as EquipmentType;
}

function canonicalEdge(e: DiagramEdge): DiagramEdge {
  const out: Record<string, unknown> = { id: e.id, from: e.from, to: e.to };
  if (e.kind) out.kind = e.kind;
  if (e.voltage) out.voltage = e.voltage;
  if (e.points) out.points = e.points.map((p) => ({ x: p.x, y: p.y }));
  return out as DiagramEdge;
}

export const posMapOf = (diagram: Diagram) => new Map<string, Pt>(diagram.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));

export function bandOf(diagram: Diagram, layer: Layer) {
  const l = diagram.layers.find((b) => b.id === layer);
  if (!l) return undefined;
  return { x: l.x ?? 0, y: l.y, w: l.width ?? diagram.width, h: l.height, label: l.label };
}

export function layerOfNode(draft: Draft, node: DiagramNode): Layer | undefined {
  return draft.equipmentTypes.find((e) => e.id === node.equipmentTypeId)?.layer;
}

export function nodeName(draft: Draft, nodeId: string): string {
  const n = draft.diagram.nodes.find((x) => x.id === nodeId);
  if (!n) return nodeId;
  const eq = draft.equipmentTypes.find((e) => e.id === n.equipmentTypeId);
  return eq ? (eq.abbr ? `${eq.abbr}(${eq.name})` : eq.name) : nodeId;
}

/**
 * 배치 검사: 타일 전체가 기기 계층 밴드 안, 다른 타일과 최소 여유(120×116 + 30) 확보.
 * 위반 사유(한국어) 또는 null.
 */
export function checkPlacement(
  draft: Draft,
  layer: Layer,
  x: number,
  y: number,
  ignoreNodeId?: string,
): string | null {
  const band = bandOf(draft.diagram, layer);
  if (!band) return `${layer} 계층 밴드가 계통도에 없습니다`;
  if (x - HW < band.x || x + HW > band.x + band.w || y - HH < band.y || y + HH > band.y + band.h) {
    return `${layer} ${band.label} 밴드 안에만 둘 수 있습니다`;
  }
  for (const n of draft.diagram.nodes) {
    if (n.id === ignoreNodeId) continue;
    if (Math.abs(n.x - x) < TILE_W + MIN_GAP && Math.abs(n.y - y) < TILE_H + MIN_GAP) {
      return `${nodeName(draft, n.id)} 타일과 너무 가깝습니다 (최소 간격 ${MIN_GAP}px)`;
    }
  }
  return null;
}

/**
 * 연결선 경로 갱신. 생성기 규칙(기본 직교 경로가 타일을 지나가면 A* 우회 points, 아니면 points 없음)을
 * 바뀐 부분에만 적용한다:
 *  - affected 노드에 붙은 엣지 → 새로 계산
 *  - points 가 있는데 기본 경로가 이제 깨끗하거나 points 가 타일을 지나감 → 새로 계산
 *  - points 가 없는데 기본 경로가 타일을 지나감 → 새로 계산
 *  - 나머지는 그대로 (안정적: 바뀌지 않은 선은 움직이지 않는다)
 * 반환: 경로를 찾지 못한 엣지 id
 */
export function rerouteEdges(diagram: Diagram, affected: ReadonlySet<string>): { edges: DiagramEdge[]; failed: string[] } {
  const pos = posMapOf(diagram);
  const failed: string[] = [];
  const edges = diagram.edges.map((e) => {
    const pa = pos.get(e.from);
    const pb = pos.get(e.to);
    if (!pa || !pb) return e;
    const ends = [e.from, e.to];
    const touched = affected.has(e.from) || affected.has(e.to);
    let need = touched;
    if (!need) {
      const defHits = pathHitsTiles(defaultRoute(pa, pb), pos, ends);
      need = e.points ? !defHits || pathHitsTiles(e.points, pos, ends) : defHits;
    }
    if (!need) return e;
    const r = routeEdge(pos, e.from, e.to);
    if (!r.ok) {
      failed.push(e.id);
      const { points: _drop, ...rest } = e;
      return canonicalEdge(rest);
    }
    const { points: _old, ...rest } = e;
    return canonicalEdge(r.points ? { ...rest, points: r.points } : rest);
  });
  return { edges, failed };
}

export interface OpResult {
  draft: Draft;
  /** 결과 안내 (경로 실패 등) */
  notice?: string;
  error?: string;
  /** 새로 만든 노드·엣지 id */
  createdId?: string;
}

function withDiagram(draft: Draft, diagram: Diagram): Draft {
  return { ...draft, diagram };
}

function failNotice(failed: string[]) {
  return failed.length > 0 ? `우회 경로를 찾지 못한 연결선: ${failed.join(', ')} — 노드를 옮겨 길을 만들어 주세요` : undefined;
}

export function upsertEquipment(draft: Draft, eq: EquipmentType, image: EquipmentImage | null | undefined): Draft {
  const canon = canonicalEquipment(eq);
  const idx = draft.equipmentTypes.findIndex((e) => e.id === canon.id);
  const equipmentTypes =
    idx >= 0 ? draft.equipmentTypes.map((e, i) => (i === idx ? canon : e)) : [...draft.equipmentTypes, canon];
  const images = { ...draft.images };
  if (image === null) delete images[canon.id];
  else if (image) images[canon.id] = image;
  return { ...draft, equipmentTypes, images };
}

export function deleteEquipment(draft: Draft, id: string): OpResult {
  const used = draft.diagram.nodes.filter((n) => n.equipmentTypeId === id);
  if (used.length > 0) {
    return { draft, error: `계통도에 노드 ${used.length}개가 남아 있어 삭제할 수 없습니다. 노드를 먼저 지우세요 (${used.map((n) => n.id).join(', ')})` };
  }
  const images = { ...draft.images };
  delete images[id];
  return { draft: { ...draft, equipmentTypes: draft.equipmentTypes.filter((e) => e.id !== id), images } };
}

export function uniqueNodeId(draft: Draft, equipmentId: string): string {
  const ids = new Set(draft.diagram.nodes.map((n) => n.id));
  let id = `n-${equipmentId}`;
  for (let i = 2; ids.has(id); i++) id = `n-${equipmentId}-${i}`;
  return id;
}

export function nextEdgeId(draft: Draft): string {
  let max = 0;
  for (const e of draft.diagram.edges) {
    const m = /^e(\d+)$/.exec(e.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  const ids = new Set(draft.diagram.edges.map((e) => e.id));
  let n = max + 1;
  while (ids.has(`e${String(n).padStart(3, '0')}`)) n++;
  return `e${String(n).padStart(3, '0')}`;
}

export function addNode(draft: Draft, equipmentId: string, x: number, y: number): OpResult {
  const eq = draft.equipmentTypes.find((e) => e.id === equipmentId);
  if (!eq) return { draft, error: `기기 ${equipmentId} 가 없습니다` };
  const reason = checkPlacement(draft, eq.layer, x, y);
  if (reason) return { draft, error: reason };
  const id = uniqueNodeId(draft, equipmentId);
  const node: DiagramNode = { id, equipmentTypeId: equipmentId, x, y };
  const diagram = { ...draft.diagram, nodes: [...draft.diagram.nodes, node] };
  const { edges, failed } = rerouteEdges(diagram, new Set([id]));
  return { draft: withDiagram(draft, { ...diagram, edges }), createdId: id, notice: failNotice(failed) };
}

export function moveNode(draft: Draft, nodeId: string, x: number, y: number): OpResult {
  const node = draft.diagram.nodes.find((n) => n.id === nodeId);
  if (!node) return { draft, error: `노드 ${nodeId} 가 없습니다` };
  const layer = layerOfNode(draft, node);
  if (!layer) return { draft, error: `노드 ${nodeId} 의 기기를 찾을 수 없습니다` };
  const reason = checkPlacement(draft, layer, x, y, nodeId);
  if (reason) return { draft, error: reason };
  if (node.x === x && node.y === y) return { draft };
  const diagram = {
    ...draft.diagram,
    nodes: draft.diagram.nodes.map((n) => (n.id === nodeId ? { ...n, x, y } : n)),
  };
  const { edges, failed } = rerouteEdges(diagram, new Set([nodeId]));
  return { draft: withDiagram(draft, { ...diagram, edges }), notice: failNotice(failed) };
}

export function deleteNode(draft: Draft, nodeId: string): OpResult {
  const diagram = {
    ...draft.diagram,
    nodes: draft.diagram.nodes.filter((n) => n.id !== nodeId),
    edges: draft.diagram.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
  };
  const { edges, failed } = rerouteEdges(diagram, new Set());
  return { draft: withDiagram(draft, { ...diagram, edges }), notice: failNotice(failed) };
}

export function addEdge(
  draft: Draft,
  from: string,
  to: string,
  kind: 'power' | 'signal',
  voltage?: string,
): OpResult {
  if (from === to) return { draft, error: '같은 노드끼리는 연결할 수 없습니다' };
  const nodes = new Set(draft.diagram.nodes.map((n) => n.id));
  if (!nodes.has(from) || !nodes.has(to)) return { draft, error: '연결할 노드를 찾을 수 없습니다' };
  const dup = draft.diagram.edges.find(
    (e) => (e.from === from && e.to === to) || (e.from === to && e.to === from),
  );
  if (dup) return { draft, error: `이미 연결되어 있습니다 (${dup.id})` };
  const id = nextEdgeId(draft);
  const edge = canonicalEdge({ id, from, to, kind, voltage: voltage?.trim() || undefined });
  const pos = posMapOf(draft.diagram);
  const r = routeEdge(pos, from, to);
  const placed = r.ok && r.points ? canonicalEdge({ ...edge, points: r.points }) : edge;
  const diagram = { ...draft.diagram, edges: [...draft.diagram.edges, placed] };
  return {
    draft: withDiagram(draft, diagram),
    createdId: id,
    notice: r.ok ? undefined : failNotice([id]),
  };
}

export function deleteEdge(draft: Draft, edgeId: string): Draft {
  return withDiagram(draft, { ...draft.diagram, edges: draft.diagram.edges.filter((e) => e.id !== edgeId) });
}

export function updateEdge(draft: Draft, edgeId: string, patch: { kind?: 'power' | 'signal'; voltage?: string }): Draft {
  return withDiagram(draft, {
    ...draft.diagram,
    edges: draft.diagram.edges.map((e) =>
      e.id === edgeId
        ? canonicalEdge({ ...e, kind: patch.kind ?? e.kind, voltage: patch.voltage !== undefined ? patch.voltage.trim() || undefined : e.voltage })
        : e,
    ),
  });
}

/** 한글 이름·약어에서 kebab id 제안 (영문·숫자만 남김). 비면 new-equipment */
export function suggestId(abbr: string | undefined, name: string, taken: ReadonlySet<string>): string {
  const src = (abbr && /[a-z0-9]/i.test(abbr) ? abbr : name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = src || 'new-equipment';
  let id = base;
  for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
  return id;
}

/** JSON 파일 텍스트 — 원본과 같은 형식(2칸 들여쓰기, 끝 줄바꿈) */
export const toJsonText = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;

/** 원본 대비 초안 비교용 간단 서명 (저장된 초안이 어느 원본에서 출발했는지) */
export function signature(d: Draft): string {
  const s = toJsonText(d);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${s.length}-${(h >>> 0).toString(16)}`;
}

/** 계층 밴드 안에서 놓을 수 있는 첫 자리 (밴드 가운데에서 가까운 순). 키보드 배치·자동 배치용 */
export function findFreeSpot(draft: Draft, layer: Layer): Pt | null {
  const band = bandOf(draft.diagram, layer);
  if (!band) return null;
  const cx = band.x + band.w / 2;
  const cy = band.y + band.h / 2;
  const spots: Pt[] = [];
  for (let y = snap(band.y + HH + GRID); y + HH <= band.y + band.h; y += GRID) {
    for (let x = snap(band.x + HW + GRID); x + HW <= band.x + band.w; x += GRID) spots.push({ x, y });
  }
  spots.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
  return spots.find((p) => checkPlacement(draft, layer, p.x, p.y) === null) ?? null;
}
