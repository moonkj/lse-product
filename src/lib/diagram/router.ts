/**
 * 연결선 우회 경로 계산 — scripts/build-diagram-data.py 의 default_route / path_hits_tiles / astar_route
 * TypeScript 포팅 (순수 함수, 같은 상수). 관리자 화면에서 노드를 옮기거나 연결선을 추가할 때 edge.points 를 다시 계산한다.
 *
 * 이 파일은 의존성 없이 자체 완결 (node 의 TS 실행으로 Python 결과와 대조 검증하기 위해 import 없음).
 * 상수는 src/lib/diagram/model.ts TILE_W/TILE_H 와 같아야 한다.
 */

export interface Pt {
  x: number;
  y: number;
}

/** 타일 크기 (model.ts 와 동일) */
export const ROUTE_TILE_W = 120;
export const ROUTE_TILE_H = 116;
const HW = ROUTE_TILE_W / 2;
const HH = ROUTE_TILE_H / 2;
/** 선과 타일 사이 최소 여유(px) — Python CLEAR */
export const CLEAR = 10;
/** 꺾임 벌점 — Python TURN */
const TURN = 400;

/** nodeId → 타일 중심 */
export type PosMap = ReadonlyMap<string, Pt>;

/** model.ts route() 와 같은 규칙 (모선 제외). 점 목록 반환 */
export function defaultRoute(pa: Pt, pb: Pt): Pt[] {
  const { x: ax, y: ay } = pa;
  const { x: bx, y: by } = pb;
  const dx = bx - ax;
  const dy = by - ay;
  if (Math.abs(dy) >= ROUTE_TILE_H + 20) {
    const s = dy > 0 ? 1 : -1;
    const y1 = ay + s * HH;
    const y2 = by - s * HH;
    if (Math.abs(dx) < 4) return [{ x: ax, y: y1 }, { x: ax, y: y2 }];
    const my = Math.round((y1 + y2) / 2);
    return [
      { x: ax, y: y1 },
      { x: ax, y: my },
      { x: bx, y: my },
      { x: bx, y: y2 },
    ];
  }
  const s = dx >= 0 ? 1 : -1;
  const x1 = ax + s * HW;
  const x2 = bx - s * HW;
  if (Math.abs(dy) < 4) return [{ x: x1, y: ay }, { x: x2, y: ay }];
  const mx = Math.round((x1 + x2) / 2);
  return [
    { x: x1, y: ay },
    { x: mx, y: ay },
    { x: mx, y: by },
    { x: x2, y: by },
  ];
}

/** 선분들이 양 끝 기기(ends) 외의 타일(여유 clear 포함)을 지나가는지 */
export function pathHitsTiles(pts: readonly Pt[], pos: PosMap, ends: readonly string[], clear = CLEAR): boolean {
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i];
    const q = pts[i + 1];
    const loX = Math.min(p.x, q.x);
    const hiX = Math.max(p.x, q.x);
    const loY = Math.min(p.y, q.y);
    const hiY = Math.max(p.y, q.y);
    for (const [nid, c] of pos) {
      if (ends.includes(nid)) continue;
      if (loX < c.x + HW + clear && hiX > c.x - HW - clear && loY < c.y + HH + clear && hiY > c.y - HH - clear) {
        return true;
      }
    }
  }
  return false;
}

/** 경로가 지나가는 (양 끝 외) 타일 id 목록 — 검증 오류 메시지용 */
export function tilesHitBy(pts: readonly Pt[], pos: PosMap, ends: readonly string[], clear = CLEAR): string[] {
  const hit: string[] = [];
  for (const [nid] of pos) {
    if (ends.includes(nid)) continue;
    const single = new Map([[nid, pos.get(nid)!]]);
    if (pathHitsTiles(pts, single, [], clear)) hit.push(nid);
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
 * 직교 가시성 그래프 + A*(꺾임 벌점)로 타일을 피하는 경로. 후보 좌표 = 타일 중심선과 타일 바깥 여유선.
 * 양 끝은 타일 가장자리로 자른다. 경로가 없으면 null (Python 은 AssertionError).
 */
export function astarRoute(pos: PosMap, a: string, b: string): Pt[] | null {
  const start = pos.get(a);
  const goal = pos.get(b);
  if (!start || !goal) return null;
  const offX = HW + CLEAR + 8;
  const offY = HH + CLEAR + 8;
  const xsSet = new Set<number>();
  const ysSet = new Set<number>();
  for (const c of pos.values()) {
    xsSet.add(c.x).add(c.x - offX).add(c.x + offX);
    ysSet.add(c.y).add(c.y - offY).add(c.y + offY);
  }
  const ends = [a, b];
  const inside = (x: number, y: number) => {
    for (const [nid, c] of pos) {
      if (nid === a || nid === b) continue;
      if (Math.abs(x - c.x) < HW + CLEAR && Math.abs(y - c.y) < HH + CLEAR) return true;
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
  // 정렬된 열/행 안에서의 위치 (Python list.index 대체)
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
      if (pathHitsTiles([{ x: cx, y: cy }, { x: qx, y: qy }], pos, ends)) continue;
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

  const clip = (center: Pt, nxt: Pt): Pt => {
    if (nxt.x === center.x) return { x: center.x, y: center.y + (nxt.y > center.y ? HH : -HH) };
    return { x: center.x + (nxt.x > center.x ? HW : -HW), y: center.y };
  };
  corners[0] = clip(corners[0], corners[1]);
  corners[corners.length - 1] = clip(corners[corners.length - 1], corners[corners.length - 2]);
  return corners;
}

export type RouteResult =
  | { ok: true; points?: Pt[] }
  /** 우회 경로도 없음 (타일에 완전히 막힘) */
  | { ok: false };

/**
 * 생성기 main() 과 같은 규칙: 기본 직교 경로가 다른 타일을 지나가면 A* 우회 경로(points), 아니면 points 없음.
 */
export function routeEdge(pos: PosMap, from: string, to: string): RouteResult {
  const pa = pos.get(from);
  const pb = pos.get(to);
  if (!pa || !pb) return { ok: false };
  if (!pathHitsTiles(defaultRoute(pa, pb), pos, [from, to])) return { ok: true };
  const pts = astarRoute(pos, from, to);
  if (!pts || pathHitsTiles(pts, pos, [from, to])) return { ok: false };
  return { ok: true, points: pts };
}
