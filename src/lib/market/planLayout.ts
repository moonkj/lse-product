import type { DiagramModel } from '../diagram/model';
import { ENDPOINT_H, ENDPOINT_W, TILE_H, TILE_W } from '../diagram/geometry';
import type { Layer } from '../schema';

/**
 * 계획 카드 자리 찾기 — 밴드 사각형 안에서 타일·모선·끝점·연결선·이름표를 피한 가장 큰 빈 사각형.
 * 계통도 좌표(시트 안). 레이아웃이 바뀌어도 자동으로 따라간다. 빈자리가 최소 크기보다 작으면 그 밴드는 카드 없음.
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 장애물 둘레 여백 */
const CLEAR = 14;
/** 밴드 안쪽 여백 */
const PAD = 12;
/** 밴드 왼쪽 위 이름표가 차지하는 칸 (Bands 의 LABEL_ZONE_H = 84, 이름표 폭은 넉넉히) */
const LABEL_W = 520;
const LABEL_H = 84;

export const PLAN_MIN_W = 260;
export const PLAN_MIN_H = 170;

/** 연결선 경로(M/L 절대 좌표, 라우터 출력)를 선분 상자로 */
export function segmentsOf(d: string): Box[] {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const out: Box[] = [];
  for (let i = 0; i + 3 < nums.length; i += 2) {
    const [x1, y1, x2, y2] = [nums[i], nums[i + 1], nums[i + 2], nums[i + 3]];
    out.push({ x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) });
  }
  return out;
}

const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const grow = (b: Box, m: number): Box => ({ x: b.x - m, y: b.y - m, w: b.w + 2 * m, h: b.h + 2 * m });

/** 밴드 하나의 가장 큰 빈 사각형 (넓이 최대, 같으면 오른쪽) */
export function largestFreeBox(band: Box, obstacles: readonly Box[], minW = PLAN_MIN_W, minH = PLAN_MIN_H): Box | undefined {
  const inner: Box = { x: band.x + PAD, y: band.y + PAD, w: band.w - 2 * PAD, h: band.h - 2 * PAD };
  const obs = obstacles.map((o) => grow(o, CLEAR)).filter((o) => hit(o, inner));
  const R = inner.x + inner.w;
  const B = inner.y + inner.h;
  const uniq = (a: number[]) => [...new Set(a)].sort((p, q) => p - q);
  const xs0 = uniq([inner.x, ...obs.map((o) => o.x + o.w)].filter((v) => v >= inner.x && v < R));
  const xs1 = uniq([R, ...obs.map((o) => o.x)].filter((v) => v > inner.x && v <= R));
  const ys0 = uniq([inner.y, ...obs.map((o) => o.y + o.h)].filter((v) => v >= inner.y && v < B));
  const ys1 = uniq([B, ...obs.map((o) => o.y)].filter((v) => v > inner.y && v <= B));
  let best: Box | undefined;
  let bestScore = -1;
  for (const x0 of xs0)
    for (const x1 of xs1) {
      if (x1 - x0 < minW) continue;
      for (const y0 of ys0)
        for (const y1 of ys1) {
          if (y1 - y0 < minH) continue;
          const c: Box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
          const area = c.w * c.h;
          if (area < bestScore) continue;
          if (obs.some((o) => hit(o, c))) continue;
          if (area > bestScore || (best && c.x > best.x)) {
            best = c;
            bestScore = area;
          }
        }
    }
  return best;
}

/** 각 밴드의 카드 자리 */
export function planSlots(model: DiagramModel, layers: readonly Layer[]): Map<Layer, Box> {
  const obstacles: Box[] = [];
  for (const n of [...model.nodes, ...model.refs]) obstacles.push({ x: n.x - TILE_W / 2, y: n.y - TILE_H / 2, w: TILE_W, h: TILE_H });
  for (const b of model.busNodes) obstacles.push({ x: b.x - b.width / 2, y: b.y - 6, w: b.width, h: 12 });
  for (const p of model.endpoints) obstacles.push({ x: p.x - ENDPOINT_W / 2, y: p.y - ENDPOINT_H / 2, w: ENDPOINT_W, h: ENDPOINT_H });
  for (const e of model.edges) obstacles.push(...segmentsOf(e.d));
  const out = new Map<Layer, Box>();
  for (const l of layers) {
    const r = model.layerRect.get(l);
    if (!r) continue;
    const label: Box = { x: r.x, y: r.y, w: LABEL_W, h: LABEL_H };
    const box = largestFreeBox(r, [...obstacles, label]);
    if (box) out.set(l, box);
  }
  return out;
}
