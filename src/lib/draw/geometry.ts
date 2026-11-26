/** 단선도 그리기 — 선 경로 (캔버스·SVG 내보내기 공용) */
import { BUS_H, nodeSize, type DNode } from './model';

function center(n: DNode) {
  const s = nodeSize(n);
  return { x: n.x + s.w / 2, y: n.y + s.h / 2 };
}
export function portPoint(n: DNode) {
  const s = nodeSize(n);
  return { x: n.x + s.w / 2, y: n.y + s.h };
}
export function edgePath(a: DNode, b: DNode): string {
  const sa = nodeSize(a);
  const sb = nodeSize(b);
  const clamp = (v: number, n: DNode, s: { w: number }) => Math.min(n.x + s.w - 12, Math.max(n.x + 12, v));
  let x1 = a.x + sa.w / 2;
  let x2 = b.x + sb.w / 2;
  if (a.kind === 'bus') x1 = clamp(center(b).x, a, sa);
  if (b.kind === 'bus') x2 = clamp(center(a).x, b, sb);
  const y1 = a.y + (a.kind === 'bus' ? BUS_H : sa.h);
  const y2 = b.y;
  if (y2 >= y1) {
    const ym = y1 + Math.max(10, (y2 - y1) / 2);
    return `M${x1},${y1} V${ym} H${x2} V${y2}`;
  }
  // 아래 상자가 위에 있으면 옆으로 돌아간다
  const side = Math.max(a.x + sa.w, b.x + sb.w) + 30;
  return `M${x1},${y1} V${y1 + 16} H${side} V${y2 - 16} H${x2} V${y2}`;
}

