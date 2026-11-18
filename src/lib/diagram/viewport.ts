import type { Rect } from './panzoom';

/**
 * 계통도 "보이는 영역" 계산 (UX 토론 B3) — viewport 중 상세 패널·하단 시트·미니맵·비교 바에 가리지 않은 부분.
 * 가리는 요소의 크기는 고정값이 아니라 매번 실제 DOM 크기(getBoundingClientRect)로 잰다 → 레이아웃(압축 화면 등)이 바뀌어도 맞다.
 * 새 덮개 요소는 `data-diagram-obscures` 속성만 달면 계산에 들어간다.
 */
export const OBSCURER_SELECTOR = [
  '[data-testid="detail-panel"]',
  '[data-testid="compare-tray"]',
  '.minimap',
  '[data-diagram-obscures]',
].join(', ');

export interface VisibleArea {
  /** 큰 덮개(시트·비교 바·겹친 패널)를 잘라 낸 뒤 남은 가장 넓은 직사각형 — 자동 팬은 이 가운데로 */
  free: Rect;
  /** 잘라 내기엔 작은 덮개(미니맵 등) — 대상이 여기에 겹치면 "안 보임"으로 판정 */
  small: Rect[];
}

const right = (r: Rect) => r.x + r.w;
const bottom = (r: Rect) => r.y + r.h;

export function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const w = Math.min(right(a), right(b)) - x;
  const h = Math.min(bottom(a), bottom(b)) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : null;
}

/** 남은 영역이 이보다 작으면(덮개가 거의 다 덮음) 잘라 내지 않고 viewport 전체를 쓴다 */
const MIN_FREE_W = 120;
const MIN_FREE_H = 100;

/**
 * area(viewport 클라이언트 영역)에서 덮개들을 뺀다. 좌표계는 모두 같아야 한다.
 * 큰 덮개 = 한 변의 60% 이상을 가로지르거나 면적 20% 이상 → 위·아래·왼쪽·오른쪽 남은 조각 중 가장 넓은 것을 남김.
 */
export function subtractObstacles(area: Rect, obstacles: Rect[]): VisibleArea {
  let free = { ...area };
  const small: Rect[] = [];
  // 큰 것부터 잘라야 작은 덮개 판정이 안정적
  const hits = obstacles
    .map((o) => intersect(o, area))
    .filter((o): o is Rect => !!o)
    .sort((a, b) => b.w * b.h - a.w * a.h);
  for (const hit of hits) {
    const o = intersect(hit, free);
    if (!o) continue;
    const big = o.w >= free.w * 0.6 || o.h >= free.h * 0.6 || o.w * o.h >= free.w * free.h * 0.2;
    if (!big) {
      small.push(o);
      continue;
    }
    const parts: Rect[] = [
      { x: free.x, y: free.y, w: o.x - free.x, h: free.h },
      { x: right(o), y: free.y, w: right(free) - right(o), h: free.h },
      { x: free.x, y: free.y, w: free.w, h: o.y - free.y },
      { x: free.x, y: bottom(o), w: free.w, h: bottom(free) - bottom(o) },
    ].filter((p) => p.w > 0 && p.h > 0);
    const best = parts.sort((a, b) => b.w * b.h - a.w * a.h)[0];
    if (!best || best.w < MIN_FREE_W || best.h < MIN_FREE_H) continue;
    free = best;
  }
  return { free, small: small.filter((s) => intersect(s, free)) };
}

/** viewport(클라이언트 영역 왼쪽 위 = 0,0) 기준 보이는 영역 */
export function measureVisibleArea(vp: HTMLElement): VisibleArea {
  const vr = vp.getBoundingClientRect();
  const left = vr.left + vp.clientLeft;
  const top = vr.top + vp.clientTop;
  const area: Rect = { x: 0, y: 0, w: vp.clientWidth || vr.width, h: vp.clientHeight || vr.height };
  const obstacles: Rect[] = [];
  if (typeof document !== 'undefined') {
    for (const el of document.querySelectorAll<HTMLElement>(OBSCURER_SELECTOR)) {
      if (el === vp || el.contains(vp) || vp.contains(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (getComputedStyle(el).visibility === 'hidden') continue;
      obstacles.push({ x: r.left - left, y: r.top - top, w: r.width, h: r.height });
    }
  }
  return subtractObstacles(area, obstacles);
}

/** 화면 좌표 사각형 r 이 보이는 영역 안에 (여백 margin 포함) 다 들어오고 작은 덮개에도 안 겹치는지 */
export function isFullyVisible(r: Rect, va: VisibleArea, margin = 8): boolean {
  const { free } = va;
  const inside =
    r.x >= free.x + margin && r.y >= free.y + margin && right(r) <= right(free) - margin && bottom(r) <= bottom(free) - margin;
  return inside && !va.small.some((s) => intersect(s, r));
}

/** 보이는 영역의 가운데 (viewport 화면 좌표) */
export const centerOf = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
