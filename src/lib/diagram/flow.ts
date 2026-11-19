import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { DiagramEdge } from '../schema';
import type { EdgeKind } from './geometry';
import type { Pt } from './router';

/**
 * 계통도 전기 흐름 애니메이션 — 흐를 연결선 계산(순수 함수)과 `?flow=1` 상태 훅.
 * 근거: docs/personas-design/DEBATE.md 신규 안건 1, round2/d3-dataviz.md 3-1.
 *
 * - 대상: 전력선(power)만. 신호선(signal)은 흐르지 않는다. 택1(alt)은 선택 기기에 바로 붙은 선만(그 경로를 고른 것).
 * - 기기 없이 켜면 전체 전력선(택1 제외).
 * - 기기를 고르면: 상류 = 들어오는 선을 전원 쪽 끝까지, 하류 = 나가는 선 1단계(모선은 단계로 세지 않음 — 모선 너머 피더까지).
 * - 방향: 데이터 from→to, 엣지 flow 필드로 예외(reverse = to→from, bi = 양방향 → 움직이지 않고 ⇄ 표지).
 */

export type FlowDir = NonNullable<DiagramEdge['flow']>;

/** 대시 길이·간격(화면 px)과 속도(화면 px/s) — 속도는 시안 비교용으로 24(D3) / 48(D2)도 가능 */
export const FLOW_DASH = 10;
export const FLOW_GAP = 14;
export const FLOW_SPEED = 32; // 24 · 48 비교용
/** 한 주기(대시+간격)를 지나는 시간(초) — 배율과 무관하게 일정 (대시·간격을 배율로 나눠 화면 크기를 고정하므로) */
export const FLOW_PERIOD_SEC = (FLOW_DASH + FLOW_GAP) / FLOW_SPEED;

export interface FlowEdgeInput {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  d: string;
}

export interface FlowEdge {
  id: string;
  d: string;
  dir: FlowDir;
  /** up = 선택 기기의 상류, down = 하류, all = 기기 선택 없이 전체 */
  role: 'up' | 'down' | 'all';
}

/** diagram.json 엣지의 flow 필드 → id 별 방향 (생략 = forward 는 넣지 않음) */
export function flowDirMap(edges: readonly Pick<DiagramEdge, 'id' | 'flow'>[]): Map<string, FlowDir> {
  const m = new Map<string, FlowDir>();
  for (const e of edges) if (e.flow && e.flow !== 'forward') m.set(e.id, e.flow);
  return m;
}

interface Arc {
  edge: FlowEdgeInput;
  /** 이 방향으로 건너간 반대쪽 노드 */
  other: string;
}

/**
 * 흐를 연결선 목록.
 * @param selectedId 선택 기기 (null = 전체 전력선)
 * @param isBusId 모선 판정 (하류 단계 계산에서 모선은 건너뜀)
 * @param downDepth 하류 단계 수 (기본 1)
 */
export function computeFlowEdges(
  edges: readonly FlowEdgeInput[],
  dirs: ReadonlyMap<string, FlowDir>,
  selectedId: string | null,
  isBusId: (id: string) => boolean = () => false,
  downDepth = 1,
): FlowEdge[] {
  const dirOf = (e: FlowEdgeInput): FlowDir => dirs.get(e.id) ?? 'forward';
  if (!selectedId) {
    return edges.filter((e) => e.kind === 'power').map((e) => ({ id: e.id, d: e.d, dir: dirOf(e), role: 'all' }));
  }

  // 흐름 방향 기준 들어오는 선 / 나가는 선 (bi 는 양쪽 다)
  const inArcs = new Map<string, Arc[]>();
  const outArcs = new Map<string, Arc[]>();
  const push = (m: Map<string, Arc[]>, k: string, a: Arc) => {
    const l = m.get(k);
    if (l) l.push(a);
    else m.set(k, [a]);
  };
  for (const e of edges) {
    if (e.kind === 'signal') continue;
    // 택1 은 선택 기기에 바로 붙은 선만 (그 경로를 고른 것)
    if (e.kind === 'alt' && e.from !== selectedId && e.to !== selectedId) continue;
    const dir = dirOf(e);
    const [src, dst] = dir === 'reverse' ? [e.to, e.from] : [e.from, e.to];
    push(outArcs, src, { edge: e, other: dst });
    push(inArcs, dst, { edge: e, other: src });
    if (dir === 'bi') {
      push(outArcs, dst, { edge: e, other: src });
      push(inArcs, src, { edge: e, other: dst });
    }
  }

  const result = new Map<string, FlowEdge>();
  const add = (e: FlowEdgeInput, role: 'up' | 'down') => {
    if (!result.has(e.id)) result.set(e.id, { id: e.id, d: e.d, dir: dirOf(e), role });
  };

  // 상류: 전원 쪽 끝까지
  const seenUp = new Set<string>([selectedId]);
  const upQueue = [selectedId];
  while (upQueue.length) {
    const n = upQueue.shift()!;
    for (const a of inArcs.get(n) ?? []) {
      add(a.edge, 'up');
      if (!seenUp.has(a.other)) {
        seenUp.add(a.other);
        upQueue.push(a.other);
      }
    }
  }

  // 하류: downDepth 단계 (모선은 단계로 세지 않음)
  const seenDown = new Set<string>([selectedId]);
  let frontier: { id: string; depth: number }[] = [{ id: selectedId, depth: 0 }];
  while (frontier.length) {
    const next: typeof frontier = [];
    for (const { id, depth } of frontier) {
      for (const a of outArcs.get(id) ?? []) {
        add(a.edge, 'down');
        if (seenDown.has(a.other)) continue;
        seenDown.add(a.other);
        const d = isBusId(a.other) ? depth : depth + 1;
        if (d < downDepth) next.push({ id: a.other, depth: d });
      }
    }
    frontier = next;
  }
  return [...result.values()];
}

/** model 의 SVG path("M x y L x y …") → 점 목록 */
export function pathPoints(d: string): Pt[] {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
  return pts;
}

/** 경로 길이의 가운데 점과 그 자리의 진행 각도(도, from→to 기준) — 정지 화살표 ▸ · ⇄ 표지 위치 */
export function pathMidpoint(d: string): { x: number; y: number; angle: number } | null {
  const pts = pathPoints(d);
  if (pts.length < 2) return null;
  let total = 0;
  for (let i = 0; i + 1 < pts.length; i++) total += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  let half = total / 2;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len >= half || i + 2 === pts.length) {
      const t = len ? Math.min(1, half / len) : 0;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI };
    }
    half -= len;
  }
  return null;
}

/**
 * 흐름 상태 (2026-11-19 사용자: 애니메이션이 안 보인다 → 기본 켜짐)
 *  - 없음 = 켜짐: 기기를 고르면 그 기기의 상·하류 경로가 흐름
 *  - `?flow=0` = 꺼짐
 *  - `?flow=1` = 전체: 기기를 고르지 않아도 모든 전력선이 흐름(발표·공유용)
 */
export function parseFlow(v: string | null): boolean {
  return v !== '0';
}

export function useFlowOn(): boolean {
  const [params] = useSearchParams();
  return parseFlow(params.get('flow'));
}

/** `?flow=1` — 기기를 고르지 않아도 전체 전력선 흐름 */
export function useFlowAll(): boolean {
  const [params] = useSearchParams();
  return params.get('flow') === '1';
}

/** 흐름 켜기/끄기 — 끄면 주소 `?flow=0` (기록은 늘리지 않음, 다른 쿼리는 유지) */
export function useSetFlow() {
  const [, setParams] = useSearchParams();
  return useCallback(
    (on: boolean) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (on) next.delete('flow');
          else next.set('flow', '0');
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
}
