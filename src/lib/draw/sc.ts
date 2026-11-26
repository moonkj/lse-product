/**
 * 단선도 — 예상 단락전류 (3상, 참고 계산).
 *  · 변압기 임피던스 Zt = V² / S × %Z (리액턴스로 봄), 상위 계통은 무한 모선
 *  · 피더 전선(선에 굵기·길이를 넣은 경우): R = 0.0225 × L / A [Ω] (구리, 운전 온도), X = 0.08 Ω/km
 *  · Isc = V / (√3 × |Z|)
 * 반에서 위로 올라가며 변압기를 찾는다. 다른 반에서 나온 선(피더)은 굵기·길이가 있어야 계산 — 없으면 '피더 정보 없음'.
 */
import { isTransformer, voltageOf, type DEdge, type DNode, type Diagram } from './model';

export const CU_RHO = 0.0225;
export const CABLE_X_PER_M = 0.00008;

export function cableZ(mm2: number, lengthM: number): { r: number; x: number } {
  return { r: (CU_RHO * lengthM) / mm2, x: CABLE_X_PER_M * lengthM };
}

export type ScInfo =
  | { kind: 'ok'; ka: number; tr: DNode; feeders: number }
  | { kind: 'missing'; edge: DEdge; from: DNode }
  | { kind: 'none' };

/** 상자 nodeId 의 예상 단락전류 */
export function shortCircuitAt(d: Diagram, nodeId: string): ScInfo {
  const byId = new Map(d.nodes.map((n) => [n.id, n]));
  /** seg: 지난번 반(또는 시작)부터 전선 정보가 있는 선을 지났는지 */
  type Step = { id: string; r: number; x: number; feeders: number; seg: boolean; via?: DEdge };
  let frontier: Step[] = [{ id: nodeId, r: 0, x: 0, feeders: 0, seg: false }];
  const seen = new Set([nodeId]);
  let missing: ScInfo | undefined;
  for (let depth = 0; depth < 8 && frontier.length; depth++) {
    const next: Step[] = [];
    for (const st of frontier)
      for (const e of d.edges.filter((x) => x.to === st.id)) {
        const up = byId.get(e.from);
        if (!up || seen.has(up.id)) continue;
        seen.add(up.id);
        let { r, x, feeders, seg } = st;
        const via = st.via ?? e;
        if (e.cable && e.lengthM) {
          const z = cableZ(e.cable, e.lengthM);
          r += z.r;
          x += z.x;
          feeders++;
          seg = true;
        }
        if (up.kind === 'panel') {
          // 다른 반에서 오는 길에 피더 전선 정보가 하나도 없으면 단락전류가 크게 달라 계산하지 않는다
          if (!seg) {
            missing ??= { kind: 'missing', edge: via, from: up };
            continue;
          }
          seg = false;
        }
        if (up.kind === 'equipment' && isTransformer(up.eq)) {
          const lv = voltageOf(up.lv);
          if (!up.kVA || !lv || lv.dc) return { kind: 'none' };
          const v = lv.kV * 1000;
          const zt = ((v * v) / (up.kVA * 1000)) * ((up.pctZ ?? 6) / 100);
          const z = Math.hypot(r, x + zt);
          return { kind: 'ok', ka: v / (Math.sqrt(3) * z) / 1000, tr: up, feeders };
        }
        if (up.kind === 'bus' || up.kind === 'equipment' || up.kind === 'panel') next.push({ id: up.id, r, x, feeders, seg, via: up.kind === 'panel' ? undefined : via });
      }
    frontier = next;
  }
  return missing ?? { kind: 'none' };
}

export const shortCircuitKA = (d: Diagram, nodeId: string): number | undefined => {
  const s = shortCircuitAt(d, nodeId);
  return s.kind === 'ok' ? s.ka : undefined;
};
