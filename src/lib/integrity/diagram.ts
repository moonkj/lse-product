/**
 * 계통도(diagram.json) 규칙 — DI-04·30~46.
 * 연결선 경로는 lib/diagram/router.ts(정본)의 defaultRoute, 노드 크기·종류는 lib/diagram/geometry.ts 를 쓴다.
 */
import { LAYERS, type Diagram, type DiagramEdge, type DiagramNode, type EquipmentType, type Layer } from '../schema';
import {
  MIN_GAP,
  MIN_NODE_DISTANCE,
  edgeKind,
  halfSize,
  isBus,
  isEndpoint,
  isEquipmentNode,
  isPrimaryEquipmentNode,
  isRef,
  nodeKindOf,
  type EdgeKind,
} from '../diagram/geometry';
import { boxOf, defaultRoute, type Pt } from '../diagram/router';
import { Collector, duplicates } from './types';

const MAIN_LAYERS: readonly Layer[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'];

/** 판정 여유: 타일·끝점 1px (생성기 CLEAR=10 은 생성 여유), 모선 높이 8 + 2px */
export const HIT_CLEAR_TILE = 1;
export const HIT_CLEAR_BUS = 2;

/** R-05 리더 결정: 패널·일괄설비 그룹 표시용으로 연결선 없이 두는 system 노드 (의도됨) */
export const KNOWN_ISOLATED_SYSTEM_NODES = ['n-substation', 'n-mv-swgr', 'n-lv-swgr', 'n-modular', 'n-railway'];

type EqMap = ReadonlyMap<string, EquipmentType>;

/** 사람이 읽는 노드 이름 — 모선/끝점은 라벨, 기기는 약어(이름), 참조 타일은 "… 참조·라벨" */
export function nodeLabel(n: DiagramNode | undefined, eqById: EqMap, fallbackId = ''): string {
  if (!n) return fallbackId;
  if (isBus(n)) return `모선 ${n.label ?? n.id}`;
  if (isEndpoint(n)) return `끝점 ${n.label ?? n.id}`;
  const eq = n.equipmentTypeId ? eqById.get(n.equipmentTypeId) : undefined;
  const base = eq ? (eq.abbr ? `${eq.abbr}(${eq.name})` : eq.name) : n.id;
  return n.ref ? `${base} 참조${n.label ? `·${n.label}` : ''}` : base;
}

/** 노드 소속 계층: 기기 노드(참조 포함) = 기기 layer, 모선·끝점 = node.layer */
export function nodeLayerOf(n: DiagramNode, eqById: EqMap): Layer | undefined {
  if (isEquipmentNode(n)) return n.equipmentTypeId ? eqById.get(n.equipmentTypeId)?.layer : undefined;
  return n.layer;
}

/** 밴드 사각형 (x·width 생략 = 0·diagram.width) */
export const bandRect = (l: Diagram['layers'][number], diagramWidth: number) => ({ x: l.x ?? 0, y: l.y, w: l.width ?? diagramWidth, h: l.height });

/** 화면에 그려지는 경로: points 우선, 없으면 기본 직교 경로 (모선 연결에 points 가 없으면 null → DI-46) */
export function edgePath(e: DiagramEdge, byId: ReadonlyMap<string, DiagramNode>): Pt[] | null {
  if (e.points) return e.points;
  const a = byId.get(e.from);
  const b = byId.get(e.to);
  if (!a || !b || isBus(a) || isBus(b)) return null;
  return defaultRoute(boxOf(a), boxOf(b));
}

/** 선분이 노드 상자(종류별 크기 + 판정 여유)를 지나가는지 — DI-44a */
export function segHitsNode(p: Pt, q: Pt, n: DiagramNode): boolean {
  const { hw, hh } = halfSize(n);
  const [lx, hx, ly, hy] = [Math.min(p.x, q.x), Math.max(p.x, q.x), Math.min(p.y, q.y), Math.max(p.y, q.y)];
  if (isBus(n)) {
    const c = HIT_CLEAR_BUS;
    return lx < n.x + hw + c && hx > n.x - hw - c && ly < n.y + hh + c && hy > n.y - hh - c;
  }
  const c = HIT_CLEAR_TILE;
  return lx < n.x + hw - c && hx > n.x - hw + c && ly < n.y + hh - c && hy > n.y - hh + c;
}

export interface Seg {
  p: Pt;
  q: Pt;
}
/** 직교 선분 교차: 가로·세로가 서로의 내부에서 만남 / 같은 방향이면 같은 선 위에서 양의 길이로 겹침 — DI-45 */
export function segsCross(s: Seg, t: Seg): boolean {
  const horiz = (g: Seg) => g.p.y === g.q.y;
  const lo = Math.min;
  const hi = Math.max;
  if (horiz(s) !== horiz(t)) {
    const [h, v] = horiz(s) ? [s, t] : [t, s];
    const x = v.p.x;
    const y = h.p.y;
    return lo(h.p.x, h.q.x) < x && x < hi(h.p.x, h.q.x) && lo(v.p.y, v.q.y) < y && y < hi(v.p.y, v.q.y);
  }
  if (horiz(s)) return s.p.y === t.p.y && lo(s.p.x, s.q.x) < hi(t.p.x, t.q.x) && lo(t.p.x, t.q.x) < hi(s.p.x, s.q.x);
  return s.p.x === t.p.x && lo(s.p.y, s.q.y) < hi(t.p.y, t.q.y) && lo(t.p.y, t.q.y) < hi(s.p.y, s.q.y);
}

/** 공통 끝 노드가 없는 연결선 쌍 중 선분이 교차·겹치는 것 — DI-45 */
export function edgeCrossings(diagram: Diagram, kinds: readonly EdgeKind[]): { a: DiagramEdge; b: DiagramEdge }[] {
  const byId = new Map(diagram.nodes.map((n) => [n.id, n]));
  const es = diagram.edges.filter((e) => kinds.includes(edgeKind(e)));
  const segs = new Map(
    es.map((e) => {
      const pts = edgePath(e, byId) ?? [];
      return [e.id, pts.slice(1).map((q, i) => ({ p: pts[i], q }))] as const;
    }),
  );
  const out: { a: DiagramEdge; b: DiagramEdge }[] = [];
  for (let i = 0; i < es.length; i++) {
    for (let j = i + 1; j < es.length; j++) {
      const a = es[i];
      const b = es[j];
      if ([a.from, a.to].some((id) => id === b.from || id === b.to)) continue;
      const sa = segs.get(a.id)!;
      const sb = segs.get(b.id)!;
      if (sa.some((s) => sb.some((t) => segsCross(s, t)))) out.push({ a, b });
    }
  }
  return out;
}

export interface DiagramRuleOptions {
  /**
   * DI-43 "배치 안 됨"을 따지지 않을 기기 id — 다른 계통도(예: 데이터센터)에 기기 노드가 있는 기기 (2026-11-23 계통 종류 추가).
   */
  placedElsewhere?: ReadonlySet<string>;
  /**
   * 보조 계통도(데이터센터 등): 계통 일부 계층만 그린다 → DI-33·34 는 이 계통도에 정의한 계층만,
   * DI-43 은 "한 계통도 안에서 한 번만 배치"만 검사 (모든 기기 배치는 기본 계통도 + 보조 계통도 합으로 따진다)
   */
  auxiliary?: boolean;
}

export function diagramRules(c: Collector, diagram: Diagram, equipment: readonly EquipmentType[], opts: DiagramRuleOptions = {}) {
  const eqById: EqMap = new Map(equipment.map((e) => [e.id, e]));
  const nodes = diagram.nodes;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const name = (id: string) => nodeLabel(byId.get(id), eqById, id);
  const edgeText = (e: DiagramEdge) => `연결선 ${e.id} (${name(e.from)} → ${name(e.to)})`;
  const layerOf = (n: DiagramNode) => nodeLayerOf(n, eqById);
  const degree = new Map<string, number>();
  for (const e of diagram.edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }

  c.run('DI-04', () => {
    for (const id of duplicates(nodes.map((n) => n.id))) c.error('DI-04', `노드 id 중복: ${id}`, { nodeId: id });
    for (const id of duplicates(diagram.edges.map((e) => e.id))) c.error('DI-04', `연결선 id 중복: ${id}`, { edgeId: id });
    for (const id of duplicates(diagram.layers.map((l) => l.id))) c.error('DI-04', `계층 밴드 id 중복: ${id}`);
  });
  c.run('DI-30', () => {
    for (const n of nodes) {
      if (isEquipmentNode(n)) {
        if (!eqById.has(n.equipmentTypeId ?? '')) c.error('DI-30', `노드 ${n.id}: 없는 기기 ${n.equipmentTypeId ?? '(지정 안 됨)'}`, { nodeId: n.id });
      } else {
        if (!n.label?.trim() || !n.layer || n.equipmentTypeId || n.ref)
          c.error('DI-30', `${isBus(n) ? '모선' : '끝점'} ${n.id}: 라벨·계층이 필요하고 기기·참조 표시는 쓸 수 없습니다`, { nodeId: n.id });
        if (isBus(n) && !((n.width ?? 0) > 0)) c.error('DI-30', `모선 ${n.id}: 길이(width)가 필요합니다`, { nodeId: n.id });
      }
    }
  });
  c.run('DI-31', () => {
    for (const e of diagram.edges)
      for (const id of [e.from, e.to]) if (!byId.has(id)) c.error('DI-31', `연결선 ${e.id}: 없는 노드 ${id}`, { edgeId: e.id });
  });
  c.run('DI-32', () => {
    for (const e of diagram.edges) if (e.from === e.to) c.error('DI-32', `연결선 ${e.id}: 자기 자신과 연결`, { edgeId: e.id, nodeId: e.from });
    const seen = new Map<string, string>();
    for (const e of diagram.edges) {
      const k = [e.from, e.to].sort().join('↔');
      const prev = seen.get(k);
      if (prev) c.error('DI-32', `${edgeText(e)}: ${prev} 와 같은 노드 쌍 중복 연결`, { edgeId: e.id, nodeId: e.from });
      else seen.set(k, e.id);
    }
  });
  c.run('DI-33', () => {
    const defined = new Set<string>(diagram.layers.map((l) => l.id));
    const used = new Set(nodes.map(layerOf).filter((l): l is Layer => !!l));
    for (const id of new Set<string>([...(opts.auxiliary ? [] : MAIN_LAYERS), ...used])) if (!defined.has(id)) c.error('DI-33', `${id} 계층 밴드가 계통도에 없습니다`);
    for (const id of used) if (!(LAYERS as readonly string[]).includes(id)) c.error('DI-33', `계약 밖 계층 ${id}`);
  });
  c.run('DI-34', () => {
    for (const l of MAIN_LAYERS.filter((m) => !opts.auxiliary || diagram.layers.some((b) => b.id === m)))
      if (!nodes.some((n) => isPrimaryEquipmentNode(n) && layerOf(n) === l)) c.error('DI-34', `${l} 계층에 기기 노드(참조 타일 제외)가 하나도 없습니다`);
  });
  c.run('DI-35', () => {
    const band = new Map(diagram.layers.map((l) => [l.id as string, l]));
    for (const n of nodes) {
      if (isRef(n)) continue; // 참조 타일: 같은 기기가 다른 계층 자리에 다시 나옴
      const l = band.get(layerOf(n) ?? '');
      if (!l) continue;
      const r = bandRect(l, diagram.width);
      const xs = isBus(n) ? [n.x - (n.width ?? 0) / 2, n.x + (n.width ?? 0) / 2] : [n.x];
      if (n.y < r.y || n.y > r.y + r.h || xs.some((x) => x < r.x || x > r.x + r.w))
        c.error('DI-35', `${name(n.id)}: (${n.x}, ${n.y}) 이(가) ${l.id} ${l.label} 밴드를 벗어났습니다`, { nodeId: n.id });
    }
  });
  c.run('DI-36', () => {
    for (const n of nodes) {
      const { hw, hh } = halfSize(n);
      if (n.x - hw < 0 || n.y - hh < 0 || n.x + hw > diagram.width || n.y + hh > diagram.height)
        c.error('DI-36', `${name(n.id)}: 계통도 영역 밖 (${n.x}, ${n.y})`, { nodeId: n.id });
    }
  });
  c.run('DI-37', () => {
    const rects = diagram.layers.map((l) => ({ id: l.id, ...bandRect(l, diagram.width) }));
    rects.forEach((r, i) => {
      if (r.h <= 0 || r.w <= 0) c.error('DI-37', `${r.id} 밴드: 크기가 0 이하`);
      if (r.x < 0 || r.y < 0 || r.x + r.w > diagram.width || r.y + r.h > diagram.height) c.error('DI-37', `${r.id} 밴드: 계통도 영역 밖`);
      for (const o of rects.slice(i + 1)) {
        if (r.x < o.x + o.w && o.x < r.x + r.w && r.y < o.y + o.h && o.y < r.y + r.h) c.error('DI-37', `${r.id} ↔ ${o.id} 밴드 겹침`);
      }
    });
  });
  c.run('DI-38', () => {
    // 보조 계통도는 정의한 주 계층만 순서 검사
    const ids = opts.auxiliary ? MAIN_LAYERS.filter((m) => diagram.layers.some((b) => b.id === m)) : MAIN_LAYERS;
    const ys = ids.map((id) => diagram.layers.find((l) => l.id === id)?.y ?? Number.NaN);
    if (!ys.every((y, i) => i === 0 || y > ys[i - 1])) c.error('DI-38', `L1→L7 밴드가 위에서 아래 순서가 아닙니다 (y = ${ys.join(', ')})`);
  });
  c.run('DI-39', () => {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const A = halfSize(a);
        const B = halfSize(b);
        const gx = Math.abs(a.x - b.x) - A.hw - B.hw;
        const gy = Math.abs(a.y - b.y) - A.hh - B.hh;
        const refs = { nodeId: a.id };
        if (gx < 0 && gy < 0) c.error('DI-39', `노드 겹침: ${name(a.id)} ↔ ${name(b.id)}`, refs);
        else if (!isBus(a) && !isBus(b) && gx < MIN_GAP && gy < MIN_GAP) c.warn('DI-39', `노드 간격 ${MIN_GAP}px 미만: ${name(a.id)} ↔ ${name(b.id)}`, refs);
        if (Math.hypot(a.x - b.x, a.y - b.y) < MIN_NODE_DISTANCE)
          c.error('DI-39', `노드 중심 거리 ${MIN_NODE_DISTANCE}px 미만: ${name(a.id)} ↔ ${name(b.id)}`, refs);
      }
    }
  });
  c.run('DI-40', () => {
    for (const n of nodes) {
      const d = degree.get(n.id) ?? 0;
      const k = nodeKindOf(n);
      if (k === 'bus') {
        if (d < 2) c.error('DI-40', `${name(n.id)}: 모선은 연결선이 2개 이상 필요합니다 (지금 ${d}개)`, { nodeId: n.id });
      } else if (k === 'endpoint' || k === 'ref') {
        if (d < 1) c.error('DI-40', `${name(n.id)}: 연결선이 하나도 없습니다`, { nodeId: n.id });
      } else if (d === 0) {
        const eq = eqById.get(n.equipmentTypeId ?? '');
        if (eq?.layer !== 'MON' && eq?.category !== 'system') c.error('DI-40', `${name(n.id)}: 연결선이 하나도 없습니다 (감시·시스템 기기만 예외)`, { nodeId: n.id });
        else if (eq?.category === 'system' && !KNOWN_ISOLATED_SYSTEM_NODES.includes(n.id))
          c.warn('DI-40', `${name(n.id)}: 연결선 없는 시스템 기기 (R-05 목록 밖)`, { nodeId: n.id });
      }
    }
  });
  c.run('DI-41', () => {
    const adj = new Map<string, string[]>();
    for (const e of diagram.edges) {
      adj.set(e.from, [...(adj.get(e.from) ?? []), e.to]);
      adj.set(e.to, [...(adj.get(e.to) ?? []), e.from]);
    }
    // 시작 = 가장 위 주 계층 (기본 계통도는 L1, 보조 계통도는 정의한 첫 주 계층 — 예: 데이터센터 L4 수전)
    const top = opts.auxiliary ? (MAIN_LAYERS.find((m) => diagram.layers.some((b) => b.id === m)) ?? 'L1') : 'L1';
    const starts = nodes.filter((n) => layerOf(n) === top).map((n) => n.id);
    const targets = new Set(nodes.filter((n) => layerOf(n) === 'L7').map((n) => n.id));
    const seen = new Set<string>(starts);
    const queue = [...starts];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const nx of adj.get(cur) ?? []) {
        if (!seen.has(nx)) {
          seen.add(nx);
          queue.push(nx);
        }
      }
    }
    if (![...targets].some((t) => seen.has(t))) c.error('DI-41', `${top} 노드에서 L7 노드까지 이어지는 경로가 없습니다 (전원→부하 흐름이 끊김)`);
  });
  c.run('DI-42', () => {
    for (const e of diagram.edges) {
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      const la = a ? layerOf(a) : undefined;
      const lb = b ? layerOf(b) : undefined;
      const ia = la ? MAIN_LAYERS.indexOf(la) : -1;
      const ib = lb ? MAIN_LAYERS.indexOf(lb) : -1;
      if (ia >= 0 && ib >= 0 && Math.abs(ia - ib) > 1) c.error('DI-42', `${edgeText(e)}: ${la}–${lb} 계층을 건너뛰어 연결할 수 없습니다 (인접 계층만)`, { edgeId: e.id, nodeId: e.from });
    }
  });
  c.run('DI-43', () => {
    const main = nodes.filter(isPrimaryEquipmentNode);
    for (const e of equipment) {
      const list = main.filter((n) => n.equipmentTypeId === e.id);
      const elsewhere = !!opts.auxiliary || !!opts.placedElsewhere?.has(e.id);
      if (list.length === 0 && !elsewhere) c.error('DI-43', `${e.name}: 계통도에 배치되지 않았습니다 (모든 기기는 기기 노드가 1개 필요, 참조 타일 제외)`, { equipmentId: e.id });
      else if (list.length > 1)
        c.error('DI-43', `${e.name}: 기기 노드가 ${list.length}개입니다 — 같은 기기를 다시 그릴 때는 참조 타일을 쓰세요 (${list.map((n) => n.id).join(', ')})`, { equipmentId: e.id, nodeId: list[1].id });
    }
    for (const n of nodes) if (isRef(n) && !n.label?.trim()) c.error('DI-43', `참조 타일 ${n.id}: 라벨(예 "345/154kV")이 필요합니다 — 어느 자리인지 구분`, { nodeId: n.id });
  });
  c.run('DI-43b', () => {
    const r = diagram.review;
    if (!r) {
      c.warn('DI-43b', 'diagram.review 없음 — 검수 상태 표시 불가');
      return;
    }
    if (!['pending', 'approved'].includes(r.status)) c.error('DI-43b', `검수 상태 "${r.status}" 는 pending·approved 만 허용`);
    if (r.status === 'approved' && (!r.reviewedBy?.trim() || !r.reviewedAt)) c.error('DI-43b', '검수 승인(approved)에는 검수자(reviewedBy)·검수일(reviewedAt)이 필요합니다');
  });
  c.run('DI-43c', () => {
    const alts = diagram.edges.filter((e) => e.kind === 'alt');
    const groups = new Map<string, DiagramEdge[]>();
    for (const e of alts) {
      if (!e.label?.trim()) c.error('DI-43c', `${edgeText(e)}: 택1 연결선에는 라벨(어떤 기기 중 하나인지)이 필요합니다`, { edgeId: e.id, nodeId: e.from });
      else groups.set(e.label, [...(groups.get(e.label) ?? []), e]);
    }
    for (const [label, list] of groups)
      if (list.length < 2) c.error('DI-43c', `택1 그룹 "${label}": 연결선이 ${list.map((e) => e.id).join(',')} 1개뿐입니다 (2개 이상)`, { edgeId: list[0].id, nodeId: list[0].from });
  });
  c.run('DI-44a', () => {
    for (const e of diagram.edges) {
      const pts = edgePath(e, byId);
      if (!pts) continue; // DI-46
      const hit = new Set<string>();
      for (let i = 0; i + 1 < pts.length; i++) {
        for (const n of nodes) if (n.id !== e.from && n.id !== e.to && segHitsNode(pts[i], pts[i + 1], n)) hit.add(n.id);
      }
      if (hit.size) c.error('DI-44a', `${edgeText(e)}: ${[...hit].map(name).join(', ')}을(를) 지나갑니다`, { edgeId: e.id, nodeId: e.from });
    }
  });
  c.run('DI-44b', () => {
    const onEdge = (p: Pt, n: DiagramNode) => {
      const { hw, hh } = halfSize(n);
      const ex = Math.abs(Math.abs(p.x - n.x) - hw) <= 1 && Math.abs(p.y - n.y) <= hh + 1;
      const ey = Math.abs(Math.abs(p.y - n.y) - hh) <= 1 && Math.abs(p.x - n.x) <= hw + 1;
      return ex || ey;
    };
    for (const e of diagram.edges) {
      if (!e.points) continue;
      const pts = e.points;
      if (pts.slice(1).some((q, i) => pts[i].x !== q.x && pts[i].y !== q.y)) c.error('DI-44b', `${edgeText(e)}: 경로가 직교가 아닙니다 (사선)`, { edgeId: e.id, nodeId: e.from });
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      if (a && !isBus(a) && !onEdge(pts[0], a)) c.error('DI-44b', `${edgeText(e)}: 첫 점이 ${name(a.id)} 가장자리 밖`, { edgeId: e.id, nodeId: e.from });
      const last = pts[pts.length - 1];
      if (b && !isBus(b) && !onEdge(last, b)) c.error('DI-44b', `${edgeText(e)}: 끝 점이 ${name(b.id)} 가장자리 밖`, { edgeId: e.id, nodeId: e.to });
    }
  });
  c.run('DI-45a', () => {
    for (const { a, b } of edgeCrossings(diagram, ['power', 'alt']))
      c.error('DI-45a', `전력선 교차·겹침: ${edgeText(a)} ✕ ${edgeText(b)} — 노드를 옮겨 교차를 없애 주세요`, { edgeId: a.id, nodeId: a.from });
  });
  c.run('DI-46', () => {
    for (const e of diagram.edges) {
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      if (!a || !b) continue;
      for (const [bus, atStart] of [
        [a, true],
        [b, false],
      ] as const) {
        if (!isBus(bus)) continue;
        if (!e.points) {
          c.error('DI-46', `${edgeText(e)}: 모선 연결선에는 경로(points)가 필요합니다 — 노드를 옮기거나 다시 연결하세요`, { edgeId: e.id, nodeId: bus.id });
          continue;
        }
        const pts = atStart ? e.points : [...e.points].reverse();
        const [p, q] = pts;
        const x1 = bus.x - (bus.width ?? 0) / 2;
        const x2 = bus.x + (bus.width ?? 0) / 2;
        if (p.y !== bus.y || p.x < x1 || p.x > x2) c.error('DI-46', `${edgeText(e)}: 모선 쪽 끝 (${p.x}, ${p.y}) 이 모선 위가 아닙니다 — 모선 범위 밖이면 모선을 늘리거나 기기를 옮기세요`, { edgeId: e.id, nodeId: bus.id });
        if (q && q.x !== p.x) c.error('DI-46', `${edgeText(e)}: 모선에서 수직으로 내려가지 않습니다`, { edgeId: e.id, nodeId: bus.id });
      }
    }
  });
}
