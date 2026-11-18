/**
 * 관리자 편집 초안(draft) — 순수 함수 모음.
 * 원본 = src/data/*.json (원본 파일의 키 순서를 그대로 유지하려고 Zod parse 결과가 아니라 raw JSON 을 복제해 쓴다).
 */
import type { Diagram, DiagramEdge, DiagramNode, DiagramNodeKind, EquipmentImage, EquipmentType, GapAssessment, Layer } from '../schema';
import {
  ROUTE_BUS_HH,
  ROUTE_EP_H,
  ROUTE_EP_W,
  ROUTE_TILE_H,
  ROUTE_TILE_W,
  boxMapOf,
  boxOf,
  defaultRoute,
  pathHits,
  routeEdge,
  type Pt,
  type RouteBox,
} from '../diagram/router';

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
  if (e.gapAssessment) out.gapAssessment = canonicalGap(e.gapAssessment);
  return out as EquipmentType;
}

/** 공백 판정 근거 — 생성기 출력 순서, 빈 선택 필드 생략 */
function canonicalGap(g: GapAssessment): GapAssessment {
  const out: Record<string, unknown> = { supplyMode: g.supplyMode, basis: g.basis, confidence: g.confidence };
  const ev = (g.evidence ?? []).filter((x) => x.ref.trim());
  if (ev.length) out.evidence = ev.map((x) => (x.note?.trim() ? { type: x.type, ref: x.ref.trim(), note: x.note.trim() } : { type: x.type, ref: x.ref.trim() }));
  if (g.verifiedBy?.trim()) out.verifiedBy = g.verifiedBy.trim();
  if (g.verifiedAt) out.verifiedAt = g.verifiedAt;
  if (g.reviewDue) out.reviewDue = g.reviewDue;
  const rs: Record<string, string> = {};
  if (g.ratingScope?.required?.trim()) rs.required = g.ratingScope.required.trim();
  if (g.ratingScope?.offered?.trim()) rs.offered = g.ratingScope.offered.trim();
  if (Object.keys(rs).length) out.ratingScope = rs;
  return out as GapAssessment;
}

function canonicalEdge(e: DiagramEdge): DiagramEdge {
  const out: Record<string, unknown> = { id: e.id, from: e.from, to: e.to };
  if (e.kind) out.kind = e.kind;
  if (e.voltage) out.voltage = e.voltage;
  if (e.label) out.label = e.label;
  if (e.points) out.points = e.points.map((p) => ({ x: p.x, y: p.y }));
  return out as DiagramEdge;
}

/** 노드 종류 (kind 생략 = 기기) */
export const nodeKind = (n: Pick<DiagramNode, 'kind'>): DiagramNodeKind => n.kind ?? 'equipment';

/** 노드 경계 맵 (노드 종류별 크기) */
export const boxesOf = (diagram: Diagram) => boxMapOf(diagram.nodes);

/** 두 노드 경계가 최소 간격(MIN_GAP) 안으로 가까운지 — 생성기 겹침 검사 */
export const boxesOverlap = (a: RouteBox, b: RouteBox) =>
  Math.abs(a.x - b.x) < a.hw + b.hw + MIN_GAP && Math.abs(a.y - b.y) < a.hh + b.hh + MIN_GAP;

/** 새 노드의 반폭·반높이 */
export interface NodeShape {
  kind: 'equipment' | 'ref' | 'bus' | 'endpoint';
  hw: number;
  hh: number;
}
export const TILE_SHAPE: NodeShape = { kind: 'equipment', hw: HW, hh: HH };
export function shapeOf(kind: NodeShape['kind'], width = 0): NodeShape {
  if (kind === 'bus') return { kind, hw: Math.floor(width / 2), hh: ROUTE_BUS_HH };
  if (kind === 'endpoint') return { kind, hw: ROUTE_EP_W / 2, hh: ROUTE_EP_H / 2 };
  return { kind, hw: HW, hh: HH };
}
export const shapeOfNode = (n: DiagramNode): NodeShape => {
  const b = boxOf(n);
  return { kind: b.kind, hw: b.hw, hh: b.hh };
};

export function bandOf(diagram: Diagram, layer: Layer) {
  const l = diagram.layers.find((b) => b.id === layer);
  if (!l) return undefined;
  return { x: l.x ?? 0, y: l.y, w: l.width ?? diagram.width, h: l.height, label: l.label };
}

/** 노드의 계층: 기기 = 기기 계층, 모선·끝점 = node.layer. 참조 타일은 밴드 검사를 하지 않으므로 null */
export function layerOfNode(draft: Draft, node: DiagramNode): Layer | null | undefined {
  if (nodeKind(node) !== 'equipment') return node.layer;
  if (node.ref) return null;
  return draft.equipmentTypes.find((e) => e.id === node.equipmentTypeId)?.layer;
}

export function nodeName(draft: Draft, nodeId: string): string {
  const n = draft.diagram.nodes.find((x) => x.id === nodeId);
  if (!n) return nodeId;
  const kind = nodeKind(n);
  if (kind === 'bus') return `모선 ${n.label ?? n.id}`;
  if (kind === 'endpoint') return `끝점 ${n.label ?? n.id}`;
  const eq = draft.equipmentTypes.find((e) => e.id === n.equipmentTypeId);
  const base = eq ? (eq.abbr ? `${eq.abbr}(${eq.name})` : eq.name) : nodeId;
  return n.ref ? `${base} 참조${n.label ? `·${n.label}` : ''}` : base;
}

/**
 * 배치 검사: 노드 전체가 계층 밴드 안(layer=null 이면 계통도 안 — 참조 타일), 다른 노드와 최소 여유(+30) 확보.
 * 모선은 겹침 검사 제외 (생성기와 같음). 위반 사유(한국어) 또는 null.
 */
export function checkPlacement(
  draft: Draft,
  layer: Layer | null,
  x: number,
  y: number,
  ignoreNodeId?: string,
  shape: NodeShape = TILE_SHAPE,
): string | null {
  const { hw, hh } = shape;
  if (layer) {
    const band = bandOf(draft.diagram, layer);
    if (!band) return `${layer} 계층 밴드가 계통도에 없습니다`;
    if (x - hw < band.x || x + hw > band.x + band.w || y - hh < band.y || y + hh > band.y + band.h) {
      return `${layer} ${band.label} 밴드 안에만 둘 수 있습니다`;
    }
  } else if (x - hw < 0 || y - hh < 0 || x + hw > draft.diagram.width || y + hh > draft.diagram.height) {
    return '계통도 영역 안에만 둘 수 있습니다';
  }
  if (shape.kind === 'bus') return null;
  const me: RouteBox = { id: '', kind: shape.kind, x, y, hw, hh };
  for (const n of draft.diagram.nodes) {
    if (n.id === ignoreNodeId || nodeKind(n) === 'bus') continue;
    if (boxesOverlap(me, boxOf(n))) {
      return `${nodeName(draft, n.id)}와(과) 너무 가깝습니다 (최소 간격 ${MIN_GAP}px)`;
    }
  }
  return null;
}

/**
 * 연결선 경로 갱신. 생성기 규칙(기본 직교 경로가 노드를 지나가면 A* 우회 points, 모선 연결은 항상 points)을
 * 바뀐 부분에만 적용한다:
 *  - affected 노드에 붙은 엣지 → 새로 계산
 *  - points 가 있는데 기본 경로가 이제 깨끗하거나 points 가 타일을 지나감 → 새로 계산
 *  - points 가 없는데 기본 경로가 타일을 지나감 → 새로 계산
 *  - 나머지는 그대로 (안정적: 바뀌지 않은 선은 움직이지 않는다)
 * 반환: 경로를 찾지 못한 엣지 id
 */
export function rerouteEdges(diagram: Diagram, affected: ReadonlySet<string>): { edges: DiagramEdge[]; failed: string[] } {
  const boxes = boxesOf(diagram);
  const failed: string[] = [];
  const edges = diagram.edges.map((e) => {
    const pa = boxes.get(e.from);
    const pb = boxes.get(e.to);
    if (!pa || !pb) return e;
    const ends = [e.from, e.to];
    const touched = affected.has(e.from) || affected.has(e.to);
    const bus = pa.kind === 'bus' || pb.kind === 'bus';
    let need = touched || (bus && !e.points);
    if (!need) {
      const def = defaultRoute(pa, pb);
      const defHits = !def || pathHits(def, boxes, ends);
      need = e.points ? (!bus && !defHits) || pathHits(e.points, boxes, ends) : defHits;
    }
    if (!need) return e;
    const r = routeEdge(boxes, e.from, e.to);
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
  return insertNode(draft, node);
}

function insertNode(draft: Draft, node: DiagramNode): OpResult {
  const diagram = { ...draft.diagram, nodes: [...draft.diagram.nodes, node] };
  const { edges, failed } = rerouteEdges(diagram, new Set([node.id]));
  return { draft: withDiagram(draft, { ...diagram, edges }), createdId: node.id, notice: failNotice(failed) };
}

/** 기기가 아닌 노드 / 참조 타일 추가 명세 */
export type SpecialNodeSpec =
  | { kind: 'ref'; equipmentId: string; label: string }
  | { kind: 'bus'; label: string; layer: Layer; width: number }
  | { kind: 'endpoint'; label: string; layer: Layer };

function uniqueId(draft: Draft, base: string): string {
  const ids = new Set(draft.diagram.nodes.map((n) => n.id));
  let id = base;
  for (let i = 2; ids.has(id); i++) id = `${base}-${i}`;
  return id;
}

/** 새 노드의 계층(밴드 검사용, 참조 타일은 null)·모양 */
export function specPlacement(spec: SpecialNodeSpec): { layer: Layer | null; shape: NodeShape } {
  if (spec.kind === 'ref') return { layer: null, shape: shapeOf('ref') };
  if (spec.kind === 'bus') return { layer: spec.layer, shape: shapeOf('bus', spec.width) };
  return { layer: spec.layer, shape: shapeOf('endpoint') };
}

/** 참조 타일·모선·끝점 추가 (키 순서는 생성기 출력과 같게) */
export function addSpecialNode(draft: Draft, spec: SpecialNodeSpec, x: number, y: number): OpResult {
  const label = spec.label.trim();
  if (spec.kind !== 'ref' && !label) return { draft, error: '라벨을 입력하세요' };
  if (spec.kind === 'bus' && !(spec.width >= 60)) return { draft, error: '모선 길이는 60px 이상이어야 합니다' };
  const { layer, shape } = specPlacement(spec);
  const reason = checkPlacement(draft, layer, x, y, undefined, shape);
  if (reason) return { draft, error: reason };
  let node: DiagramNode;
  if (spec.kind === 'ref') {
    const eq = draft.equipmentTypes.find((e) => e.id === spec.equipmentId);
    if (!eq) return { draft, error: `기기 ${spec.equipmentId} 가 없습니다` };
    if (!draft.diagram.nodes.some((n) => n.equipmentTypeId === eq.id && !n.ref)) {
      return { draft, error: `${eq.name}의 원래 기기 노드를 먼저 배치하세요 (참조 타일은 다시 나오는 자리)` };
    }
    const id = uniqueId(draft, `n-${eq.id}-ref`);
    node = label ? { id, equipmentTypeId: eq.id, ref: true, label, x, y } : { id, equipmentTypeId: eq.id, ref: true, x, y };
  } else if (spec.kind === 'bus') {
    node = { id: uniqueId(draft, 'bus'), kind: 'bus', label, layer: spec.layer, x, y, width: Math.round(spec.width) };
  } else {
    node = { id: uniqueId(draft, 'ep'), kind: 'endpoint', label, layer: spec.layer, x, y };
  }
  return insertNode(draft, node);
}

/** 모선·끝점·참조 타일 라벨, 모선 길이 수정 */
export function updateNode(draft: Draft, nodeId: string, patch: { label?: string; width?: number }): OpResult {
  const node = draft.diagram.nodes.find((n) => n.id === nodeId);
  if (!node) return { draft, error: `노드 ${nodeId} 가 없습니다` };
  const next: DiagramNode = { ...node };
  if (patch.label !== undefined) {
    const l = patch.label.trim();
    if (!l && nodeKind(node) !== 'equipment') return { draft, error: '라벨을 비울 수 없습니다' };
    if (l) next.label = l;
    else delete next.label;
  }
  if (patch.width !== undefined && nodeKind(node) === 'bus') {
    if (!(patch.width >= 60)) return { draft, error: '모선 길이는 60px 이상이어야 합니다' };
    next.width = Math.round(patch.width);
    const reason = checkPlacement(draft, node.layer ?? null, node.x, node.y, nodeId, shapeOfNode(next));
    if (reason) return { draft, error: reason };
  }
  const diagram = { ...draft.diagram, nodes: draft.diagram.nodes.map((n) => (n.id === nodeId ? next : n)) };
  const { edges, failed } = rerouteEdges(diagram, new Set([nodeId]));
  return { draft: withDiagram(draft, { ...diagram, edges }), notice: failNotice(failed) };
}

export function moveNode(draft: Draft, nodeId: string, x: number, y: number): OpResult {
  const node = draft.diagram.nodes.find((n) => n.id === nodeId);
  if (!node) return { draft, error: `노드 ${nodeId} 가 없습니다` };
  const layer = layerOfNode(draft, node);
  if (layer === undefined) return { draft, error: `노드 ${nodeId} 의 계층을 찾을 수 없습니다` };
  const reason = checkPlacement(draft, layer, x, y, nodeId, shapeOfNode(node));
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
  kind: EdgeKind,
  voltage?: string,
  label?: string,
): OpResult {
  if (from === to) return { draft, error: '같은 노드끼리는 연결할 수 없습니다' };
  const nodes = new Set(draft.diagram.nodes.map((n) => n.id));
  if (!nodes.has(from) || !nodes.has(to)) return { draft, error: '연결할 노드를 찾을 수 없습니다' };
  const dup = draft.diagram.edges.find(
    (e) => (e.from === from && e.to === to) || (e.from === to && e.to === from),
  );
  if (dup) return { draft, error: `이미 연결되어 있습니다 (${dup.id})` };
  const id = nextEdgeId(draft);
  const edge = canonicalEdge({ id, from, to, kind, voltage: voltage?.trim() || undefined, label: label?.trim() || undefined });
  const r = routeEdge(boxesOf(draft.diagram), from, to);
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

export type EdgeKind = 'power' | 'signal' | 'alt';

export function updateEdge(draft: Draft, edgeId: string, patch: { kind?: EdgeKind; voltage?: string; label?: string }): Draft {
  return withDiagram(draft, {
    ...draft.diagram,
    edges: draft.diagram.edges.map((e) =>
      e.id === edgeId
        ? canonicalEdge({
            ...e,
            kind: patch.kind ?? e.kind,
            voltage: patch.voltage !== undefined ? patch.voltage.trim() || undefined : e.voltage,
            label: patch.label !== undefined ? patch.label.trim() || undefined : e.label,
          })
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
export function findFreeSpot(draft: Draft, layer: Layer, shape: NodeShape = TILE_SHAPE): Pt | null {
  const band = bandOf(draft.diagram, layer);
  if (!band) return null;
  const { hw, hh } = shape;
  const cx = band.x + band.w / 2;
  const cy = band.y + band.h / 2;
  const spots: Pt[] = [];
  for (let y = snap(band.y + hh + GRID); y + hh <= band.y + band.h; y += GRID) {
    for (let x = snap(band.x + hw + GRID); x + hw <= band.x + band.w; x += GRID) spots.push({ x, y });
  }
  spots.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
  return spots.find((p) => checkPlacement(draft, layer, p.x, p.y, undefined, shape) === null) ?? null;
}
