/**
 * 연결선 경로 계산 — 계통도 연결선 기하의 단일 출처 (개선 R4: 화면 model.ts·관리자·무결성 검사가 모두 사용).
 * scripts/build-diagram-data.py 의 default_route / path_hits / astar_route TypeScript 포팅 (순수 함수, 같은 상수·같은 힙 순서).
 *
 * - 노드 크기·여유 상수는 geometry.ts (타일·참조 타일 120×116, 끝점 120×44, 모선 width×8)
 * - 모선 연결 (개선 R4, DI-46): 모선 위 점(기기 x)에서 **수직**으로만 잇는다.
 *   기기가 모선 범위 밖이면 'bus-range', 수직 경로가 다른 노드에 막히면 'bus-blocked' 로 실패 (A* 우회 안 함)
 * - 그 밖의 연결: 기본 직교 경로가 노드를 지나가면 A* 우회 경로
 */
import { ROUTE_BUS_CLEAR, ROUTE_CLEAR, halfSize, nodeKindOf, type NodeKind } from './geometry';

export interface Pt {
  x: number;
  y: number;
}

/** 선과 타일 사이 최소 여유(px) — Python CLEAR (모선은 ROUTE_BUS_CLEAR) */
export const CLEAR = ROUTE_CLEAR;
/** 꺾임 벌점 — Python TURN */
const TURN = 400;

export type RouteBoxKind = NodeKind;

/** 노드 경계: 중심(x, y)과 반폭·반높이 (Python Box) */
export interface RouteBox {
  id: string;
  kind: RouteBoxKind;
  x: number;
  y: number;
  hw: number;
  hh: number;
}

/** nodeId → 경계 */
export type BoxMap = ReadonlyMap<string, RouteBox>;

/** diagram.json 노드 → 경계 (Python main() 의 boxes 생성과 같은 규칙) */
export function boxOf(n: { id: string; kind?: string; ref?: boolean; x: number; y: number; width?: number }): RouteBox {
  const kind = nodeKindOf(n);
  const { hw, hh } = halfSize(n);
  // 모선 반폭은 Python 정수 나눗셈(width // 2)과 같게
  return { id: n.id, kind, x: n.x, y: n.y, hw: kind === 'bus' ? Math.floor(hw) : hw, hh };
}

export function boxMapOf(
  nodes: readonly { id: string; kind?: string; ref?: boolean; x: number; y: number; width?: number }[],
): Map<string, RouteBox> {
  return new Map(nodes.map((n) => [n.id, boxOf(n)]));
}

/** Python round() — 0.5 는 짝수 쪽으로 (banker's rounding) */
export function pyRound(v: number): number {
  const f = Math.floor(v);
  const d = v - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

/**
 * 기본 직교 경로 (노드 가장자리 → 꺾어서 → 가장자리). 모선 연결은 모선 위 (기기 x) 점에서 수직 — 모선 범위 밖이면 null.
 */
export function defaultRoute(a: RouteBox, b: RouteBox): Pt[] | null {
  if (a.kind === 'bus' || b.kind === 'bus') {
    const [bus, o] = a.kind === 'bus' ? [a, b] : [b, a];
    if (!(bus.x - bus.hw <= o.x && o.x <= bus.x + bus.hw)) return null;
    const oy = o.y > bus.y ? o.y - o.hh : o.y + o.hh;
    const pts = [
      { x: o.x, y: bus.y },
      { x: o.x, y: oy },
    ];
    return a.kind === 'bus' ? pts : pts.reverse();
  }
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dy) >= a.hh + b.hh + 20) {
    const s = dy > 0 ? 1 : -1;
    const y1 = a.y + s * a.hh;
    const y2 = b.y - s * b.hh;
    if (Math.abs(dx) < 4) return [{ x: a.x, y: y1 }, { x: a.x, y: y2 }];
    const my = pyRound((y1 + y2) / 2);
    return [
      { x: a.x, y: y1 },
      { x: a.x, y: my },
      { x: b.x, y: my },
      { x: b.x, y: y2 },
    ];
  }
  const s = dx >= 0 ? 1 : -1;
  const x1 = a.x + s * a.hw;
  const x2 = b.x - s * b.hw;
  if (Math.abs(dy) < 4) return [{ x: x1, y: a.y }, { x: x2, y: a.y }];
  const mx = pyRound((x1 + x2) / 2);
  return [
    { x: x1, y: a.y },
    { x: mx, y: a.y },
    { x: mx, y: b.y },
    { x: x2, y: b.y },
  ];
}

const clearOf = (bx: RouteBox) => (bx.kind === 'bus' ? ROUTE_BUS_CLEAR : CLEAR);

function segHits(p: Pt, q: Pt, bx: RouteBox): boolean {
  const c = clearOf(bx);
  const loX = Math.min(p.x, q.x);
  const hiX = Math.max(p.x, q.x);
  const loY = Math.min(p.y, q.y);
  const hiY = Math.max(p.y, q.y);
  return loX < bx.x + bx.hw + c && hiX > bx.x - bx.hw - c && loY < bx.y + bx.hh + c && hiY > bx.y - bx.hh - c;
}

/** 선분이 양 끝(ends) 외의 노드(타일·끝점·모선, 여유 포함)를 지나가는지 — Python path_hits */
export function pathHits(pts: readonly Pt[], boxes: BoxMap, ends: readonly string[]): boolean {
  for (let i = 0; i + 1 < pts.length; i++) {
    for (const bx of boxes.values()) {
      if (ends.includes(bx.id)) continue;
      if (segHits(pts[i], pts[i + 1], bx)) return true;
    }
  }
  return false;
}

/** 경로가 지나가는 (양 끝 외) 노드 id 목록 — 검증 오류 메시지용 */
export function nodesHitBy(pts: readonly Pt[], boxes: BoxMap, ends: readonly string[]): string[] {
  const hit: string[] = [];
  for (const bx of boxes.values()) {
    if (ends.includes(bx.id)) continue;
    for (let i = 0; i + 1 < pts.length; i++) {
      if (segHits(pts[i], pts[i + 1], bx)) {
        hit.push(bx.id);
        break;
      }
    }
  }
  return hit;
}

// ── A* 우선순위 큐: Python heapq 의 튜플 (f, g, (x, y), d) 사전식 비교와 같은 순서 ──
type QItem = [f: number, g: number, x: number, y: number, d: number];

function less(a: QItem, b: QItem): boolean {
  for (let i = 0; i < 5; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

class MinHeap {
  private a: QItem[] = [];
  get size() {
    return this.a.length;
  }
  push(v: QItem) {
    const a = this.a;
    a.push(v);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!less(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop(): QItem {
    const a = this.a;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && less(a[l], a[m])) m = l;
        if (r < a.length && less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

const key = (x: number, y: number) => `${x},${y}`;
const skey = (x: number, y: number, d: number) => `${x},${y},${d}`;

/**
 * 직교 가시성 그래프 + A*(꺾임 벌점)로 노드를 피하는 경로. 후보 좌표 = 노드 중심선과 노드 바깥 여유선.
 * 양 끝은 노드 가장자리로 자른다. 모선 연결은 수직만 허용하므로 대상 아님(null).
 * 경로가 없으면 null (Python 은 AssertionError).
 */
export function astarRoute(boxes: BoxMap, a: string, b: string): Pt[] | null {
  const A = boxes.get(a);
  const B = boxes.get(b);
  if (!A || !B || A.kind === 'bus' || B.kind === 'bus') return null;
  const xsSet = new Set<number>();
  const ysSet = new Set<number>();
  for (const bx of boxes.values()) {
    xsSet.add(bx.x).add(bx.x - bx.hw - CLEAR - 8).add(bx.x + bx.hw + CLEAR + 8);
    ysSet.add(bx.y).add(bx.y - bx.hh - CLEAR - 8).add(bx.y + bx.hh + CLEAR + 8);
  }
  const start: Pt = { x: A.x, y: A.y };
  const goal: Pt = { x: B.x, y: B.y };
  xsSet.add(start.x).add(goal.x);
  ysSet.add(start.y).add(goal.y);
  const ends = [a, b];
  const inside = (x: number, y: number) => {
    for (const bx of boxes.values()) {
      if (bx.id === a || bx.id === b) continue;
      const c = clearOf(bx);
      if (Math.abs(x - bx.x) < bx.hw + c && Math.abs(y - bx.y) < bx.hh + c) return true;
    }
    return false;
  };

  const pts = new Map<string, Pt>();
  for (const x of xsSet) for (const y of ysSet) if (!inside(x, y)) pts.set(key(x, y), { x, y });
  pts.set(key(start.x, start.y), start);
  pts.set(key(goal.x, goal.y), goal);

  const byX = new Map<number, number[]>();
  const byY = new Map<number, number[]>();
  for (const { x, y } of pts.values()) {
    (byX.get(x) ?? byX.set(x, []).get(x)!).push(y);
    (byY.get(y) ?? byY.set(y, []).get(y)!).push(x);
  }
  const num = (p: number, q: number) => p - q;
  for (const v of byX.values()) v.sort(num);
  for (const v of byY.values()) v.sort(num);
  const idxInCol = new Map<string, number>();
  const idxInRow = new Map<string, number>();
  for (const [x, col] of byX) col.forEach((y, i) => idxInCol.set(key(x, y), i));
  for (const [y, row] of byY) row.forEach((x, j) => idxInRow.set(key(x, y), j));

  const neighbors = (x: number, y: number): [number, number, number][] => {
    const col = byX.get(x)!;
    const row = byY.get(y)!;
    const i = idxInCol.get(key(x, y))!;
    const j = idxInRow.get(key(x, y))!;
    const out: [number, number, number][] = [];
    if (i > 0) out.push([x, col[i - 1], 0]);
    if (i + 1 < col.length) out.push([x, col[i + 1], 0]);
    if (j > 0) out.push([row[j - 1], y, 1]);
    if (j + 1 < row.length) out.push([row[j + 1], y, 1]);
    return out;
  };

  const heap = new MinHeap();
  heap.push([0, 0, start.x, start.y, -1]);
  const best = new Map<string, number>([[skey(start.x, start.y, -1), 0]]);
  const came = new Map<string, [number, number, number]>();
  let found: [number, number, number] | null = null;
  while (heap.size > 0) {
    const [, g, cx, cy, d] = heap.pop();
    if (cx === goal.x && cy === goal.y) {
      found = [cx, cy, d];
      break;
    }
    if ((best.get(skey(cx, cy, d)) ?? Infinity) < g) continue;
    for (const [qx, qy, nd] of neighbors(cx, cy)) {
      if (pathHits([{ x: cx, y: cy }, { x: qx, y: qy }], boxes, ends)) continue;
      const ng = g + Math.abs(qx - cx) + Math.abs(qy - cy) + (d !== -1 && d !== nd ? TURN : 0);
      const k = skey(qx, qy, nd);
      if (ng < (best.get(k) ?? Infinity)) {
        best.set(k, ng);
        came.set(k, [cx, cy, d]);
        heap.push([ng + Math.abs(qx - goal.x) + Math.abs(qy - goal.y), ng, qx, qy, nd]);
      }
    }
  }
  if (!found) return null;

  const path: Pt[] = [{ x: found[0], y: found[1] }];
  let cur: [number, number, number] = found;
  for (;;) {
    const prev = came.get(skey(cur[0], cur[1], cur[2]));
    if (!prev) break;
    cur = prev;
    path.push({ x: cur[0], y: cur[1] });
  }
  path.reverse();

  const corners: Pt[] = [path[0]];
  for (let i = 0; i + 2 < path.length; i++) {
    const p = path[i];
    const q = path[i + 1];
    const r = path[i + 2];
    if ((q.x - p.x) * (r.y - q.y) !== (q.y - p.y) * (r.x - q.x)) corners.push(q);
  }
  corners.push(path[path.length - 1]);
  if (corners.length < 2) return null;

  const clip = (bx: RouteBox, nxt: Pt): Pt => {
    if (nxt.x === bx.x) return { x: bx.x, y: bx.y + (nxt.y > bx.y ? bx.hh : -bx.hh) };
    return { x: bx.x + (nxt.x > bx.x ? bx.hw : -bx.hw), y: bx.y };
  };
  corners[0] = clip(A, corners[1]);
  corners[corners.length - 1] = clip(B, corners[corners.length - 2]);
  return corners;
}

const samePts = (p: readonly Pt[] | null, q: readonly Pt[] | null) =>
  !!p && !!q && p.length === q.length && p.every((v, i) => v.x === q[i].x && v.y === q[i].y);

/** 경로 실패 사유 */
export type RouteFailure =
  /** 기기가 모선 범위(x1~x2) 밖 */
  | 'bus-range'
  /** 모선에서 기기까지 수직 경로가 다른 노드에 막힘 */
  | 'bus-blocked'
  /** 모선끼리 직접 연결 */
  | 'bus-to-bus'
  /** 우회 경로도 없음 (노드에 완전히 막힘) */
  | 'no-path'
  /** 노드 없음 */
  | 'missing-node';

export type RouteResult = { ok: true; points?: Pt[] } | { ok: false; reason: RouteFailure; blockedBy?: string[] };

/**
 * 연결선 경로 (생성기 main() 과 같은 규칙 + 개선 R4 모선 규칙).
 * - 모선 연결: 기본 수직 경로만. 범위 밖·막힘이면 실패 (DI-46: 모선 쪽 첫 선분 수직, 끝점이 모선 위)
 * - 그 밖: 기본 경로가 다른 노드를 지나가면 A* 우회. 결과가 기본 경로와 다르면 points
 * 모선 연결은 항상 points 를 돌려준다.
 */
export function routeEdge(boxes: BoxMap, from: string, to: string): RouteResult {
  const A = boxes.get(from);
  const B = boxes.get(to);
  if (!A || !B) return { ok: false, reason: 'missing-node' };
  const ends = [from, to];
  const def = defaultRoute(A, B);
  if (A.kind === 'bus' || B.kind === 'bus') {
    if (A.kind === 'bus' && B.kind === 'bus') return { ok: false, reason: 'bus-to-bus' };
    if (!def) return { ok: false, reason: 'bus-range' };
    const hit = nodesHitBy(def, boxes, ends);
    if (hit.length > 0) return { ok: false, reason: 'bus-blocked', blockedBy: hit };
    return { ok: true, points: def };
  }
  let pts = def;
  if (!pts || pathHits(pts, boxes, ends)) {
    pts = astarRoute(boxes, from, to);
    if (!pts || pathHits(pts, boxes, ends)) return { ok: false, reason: 'no-path' };
  }
  if (!samePts(pts, def)) return { ok: true, points: pts };
  return { ok: true };
}
