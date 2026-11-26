/**
 * 반 안 구성 — 회로 부하(kW)·상(R·S·T) 배분 계산 (저압 380/220V 반).
 *  · 단상 회로(극수 1·2P): 220V, 고른 상 하나에 부하
 *  · 삼상 회로(극수 3·4P 또는 삼상 기기): 380V, 세 상에 1/3씩
 *  · 전류: 단상 I = P / (220 × 역률), 삼상 I = P / (√3 × 380 × 역률), 역률 0.9 가정
 *  · 설비불평형률 = (단상 부하가 가장 큰 상 − 가장 작은 상) / (총 부하 / 3) × 100 — 30% 넘으면 확인 (KEC 기준 참고)
 */
import { isTransformer, panelTypeById, type DNode, type Diagram, type PanelItem } from './model';
import { feederUses, isBuildingFeeders } from './feeder';

/** 부하(kW)를 받지 않는 품목 — 같은 전동기 피더의 전자개폐기·EMPR, 계측·보호 기기 (부하는 보호 차단기에만) */
export const NO_LOAD_EQ = new Set(['ms', 'empr', 'spd', 'power-meter', 'meter', 'smart-device', 'la', 'mof', 'ct-pt', 'protection-relay', 'aps', 'capacitor', 'sag-protector']);

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
  // MS·EMPR 등에 예전에 적힌 부하는 쓰지 않는다 (같은 전동기 중복)
  if (!it.loadKW || NO_LOAD_EQ.has(it.eq)) return 0;
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
  const auto: number[] = [];
  for (const it of items) {
    if (it.id === mainId || !it.loadKW || NO_LOAD_EQ.has(it.eq)) continue;
    counted++;
    const p = it.loadKW * (it.qty ?? 1);
    if (isThreePhase(it)) for (const ph of PHASES) kW[ph] += p / 3;
    else if (!it.phase) auto.push(p);
    else {
      kW[it.phase] += p;
      single[it.phase] += p;
    }
  }
  // 상을 '자동'으로 둔 단상 회로 — 큰 것부터 지금 가장 가벼운 상에 (상 자동 배분과 같은 방식)
  for (const p of auto.sort((a, b) => b - a)) {
    const ph = PHASES.reduce((m, x) => (kW[x] < kW[m] ? x : m), 'R' as Phase);
    kW[ph] += p;
    single[ph] += p;
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

/** 표준 변압기 용량 (kVA) */
export const STD_KVA = [50, 75, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000, 2500, 3000, 3750, 5000, 7500, 10000, 15000, 20000];

/** 상자 하나의 자기 부하 (kW) — 반: 회로 부하 합 × 수용률(아래 반으로 보내는 피더 회로는 빼서 이중 합산 방지), 부하 기기: kW × 대수 */
export function ownKW(n: DNode, d?: Diagram): number {
  if (n.kind === 'panel') {
    const pt = panelTypeById(n.eq);
    const mainId = (n.items ?? []).find((i) => pt?.main.includes(i.eq))?.id;
    // 아래 반·부하로 보내는 피더 회로는 그 회로 수만큼 빼서 이중 합산 방지 (수량 4 중 1회로가 피더면 1회로분만)
    const items = (n.items ?? []).map((i) => {
      const uses = d && i.loadKW ? feederUses(d, i.id) : 0;
      if (!uses) return i;
      const left = (i.qty ?? 1) - uses;
      return left > 0 ? { ...i, qty: left } : { ...i, loadKW: undefined };
    });
    return phaseSummary(items, mainId).totalKW * (n.demand ?? 1);
  }
  if (n.kind === 'equipment' && !isTransformer(n.eq) && n.loadKW) return n.loadKW * (n.qty ?? 1);
  return 0;
}

/** 이 상자 아래(부하 쪽)로 이어진 모든 부하 합 (kW) — 자기 부하 포함, 같은 상자는 한 번만 */
const kwMemo = new WeakMap<Diagram, Map<string, number>>();
export function downstreamKW(d: Diagram, nodeId: string): number {
  // 피더 자동 추정 중이 아닐 때만 단선도별로 메모 (끌기·검사 때 반복 계산 줄이기)
  const memo = isBuildingFeeders() ? undefined : (kwMemo.get(d) ?? kwMemo.set(d, new Map()).get(d)!);
  const hit = memo?.get(nodeId);
  if (hit !== undefined) return hit;
  const v = downstreamKWRaw(d, nodeId);
  memo?.set(nodeId, v);
  return v;
}
function downstreamKWRaw(d: Diagram, nodeId: string): number {
  const byId = new Map(d.nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const walk = (id: string): number => {
    if (seen.has(id)) return 0;
    seen.add(id);
    const n = byId.get(id);
    if (!n) return 0;
    return ownKW(n, d) + d.edges.filter((e) => e.from === id).reduce((s, e) => s + walk(e.to), 0);
  };
  return walk(nodeId);
}

/** 변압기 부하율 (%) — 아래쪽 합산 부하 / 역률 / 용량 */
export function transformerLoadPct(d: Diagram, tr: DNode): number | undefined {
  if (!tr.kVA) return undefined;
  const kw = downstreamKW(d, tr.id);
  if (!kw) return undefined;
  return (kw / PF / tr.kVA) * 100;
}
