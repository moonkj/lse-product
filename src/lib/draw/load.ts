/**
 * 반 안 구성 — 회로 부하(kW)·상(R·S·T) 배분 계산 (저압 380/220V 반).
 *  · 단상 회로(극수 1·2P): 220V, 고른 상 하나에 부하
 *  · 삼상 회로(극수 3·4P 또는 삼상 기기): 380V, 세 상에 1/3씩
 *  · 전류: 단상 I = P / (220 × 역률), 삼상 I = P / (√3 × 380 × 역률), 역률 0.9 가정
 *  · 설비불평형률 = (단상 부하가 가장 큰 상 − 가장 작은 상) / (총 부하 / 3) × 100 — 30% 넘으면 확인 (KEC 기준 참고)
 */
import type { PanelItem } from './model';

export type Phase = 'R' | 'S' | 'T';
export const PHASES: Phase[] = ['R', 'S', 'T'];
export const PF = 0.9;
export const UNBALANCE_LIMIT = 30;

/** 삼상으로 보는 회로 */
export function isThreePhase(it: PanelItem): boolean {
  if (it.poles) return it.poles >= 3;
  return ['acb', 'mms', 'ms', 'lv-drive', 'soft-starter', 'empr'].includes(it.eq);
}

/** 회로 한 개(수량 1)의 부하 전류 (A) */
export function circuitAmps(it: PanelItem): number {
  if (!it.loadKW) return 0;
  return isThreePhase(it) ? (it.loadKW * 1000) / (Math.sqrt(3) * 380 * PF) : (it.loadKW * 1000) / (220 * PF);
}

export interface PhaseSummary {
  /** 상별 부하 kW (삼상 회로는 1/3씩 포함) */
  kW: Record<Phase, number>;
  /** 상별 단상 부하 kW (불평형률 계산용) */
  single: Record<Phase, number>;
  totalKW: number;
  /** 가장 큰 상 전류 (A) — 주차단기와 비교 */
  maxPhaseA: number;
  /** 설비불평형률 (%) — 단상 부하가 없으면 0 */
  unbalance: number;
  /** 부하를 적은 회로 수 */
  counted: number;
}

export function phaseSummary(items: PanelItem[], mainId?: string): PhaseSummary {
  const kW: Record<Phase, number> = { R: 0, S: 0, T: 0 };
  const single: Record<Phase, number> = { R: 0, S: 0, T: 0 };
  let counted = 0;
  for (const it of items) {
    if (it.id === mainId || !it.loadKW) continue;
    counted++;
    const p = it.loadKW * (it.qty ?? 1);
    if (isThreePhase(it)) for (const ph of PHASES) kW[ph] += p / 3;
    else {
      const ph = it.phase ?? 'R';
      kW[ph] += p;
      single[ph] += p;
    }
  }
  const totalKW = kW.R + kW.S + kW.T;
  const maxKW = Math.max(kW.R, kW.S, kW.T);
  // 상 하나의 전류 = 그 상 부하 / (상전압 220V × 역률)
  const maxPhaseA = maxKW ? (maxKW * 1000) / (220 * PF) : 0;
  const singles = PHASES.map((ph) => single[ph]);
  const unbalance = totalKW && singles.some((x) => x > 0) ? ((Math.max(...singles) - Math.min(...singles)) / (totalKW / 3)) * 100 : 0;
  return { kW, single, totalKW, maxPhaseA, unbalance, counted };
}

/** 상 자동 배분 — 단상 회로를 부하가 큰 것부터, 지금 가장 가벼운 상에 (수량 n 이면 n 개를 나눠 붙일 수 없으니 묶음으로) */
export function balancePhases(items: PanelItem[], mainId?: string): PanelItem[] {
  const load: Record<Phase, number> = { R: 0, S: 0, T: 0 };
  for (const it of items) if (it.id !== mainId && it.loadKW && isThreePhase(it)) for (const ph of PHASES) load[ph] += (it.loadKW * (it.qty ?? 1)) / 3;
  const singles = items.filter((it) => it.id !== mainId && !isThreePhase(it) && it.loadKW).sort((a, b) => b.loadKW! * (b.qty ?? 1) - a.loadKW! * (a.qty ?? 1));
  const assign = new Map<string, Phase>();
  for (const it of singles) {
    const ph = PHASES.reduce((m, x) => (load[x] < load[m] ? x : m), 'R' as Phase);
    assign.set(it.id, ph);
    load[ph] += it.loadKW! * (it.qty ?? 1);
  }
  return items.map((it) => (assign.has(it.id) && assign.get(it.id) !== it.phase ? { ...it, phase: assign.get(it.id) } : it));
}
