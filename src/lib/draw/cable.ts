/**
 * 반 안 구성 — 전선 굵기·전압강하·예상 단락전류 (참고 계산, 설계 검토 아님).
 *  · 전선 허용전류: 구리 XLPE/HFIX 전선관 배선 기준 대략값 (주위 30℃, 보정계수 없음)
 *  · 권장 굵기: 차단기 정격전류 이하로 허용전류가 충분한 가장 가는 전선 (차단기가 전선을 보호하도록)
 *  · 전압강하(간이식, 내선규정): 단상 2선 e = 35.6·L·I / (1000·A), 삼상 3선 e = 30.8·L·I / (1000·A) [V]
 *    → 단상 220V, 삼상 380V 기준 %. 3% 넘으면 안내, 5% 넘으면 확인 (KEC 수용가 설비 전압강하 참고)
 */
import type { PanelItem } from './model';
import { circuitAmps, isThreePhase } from './load';

export const CABLE_SIZES: { mm2: number; amps: number }[] = [
  { mm2: 1.5, amps: 18 },
  { mm2: 2.5, amps: 24 },
  { mm2: 4, amps: 32 },
  { mm2: 6, amps: 41 },
  { mm2: 10, amps: 57 },
  { mm2: 16, amps: 76 },
  { mm2: 25, amps: 101 },
  { mm2: 35, amps: 125 },
  { mm2: 50, amps: 151 },
  { mm2: 70, amps: 192 },
  { mm2: 95, amps: 232 },
  { mm2: 120, amps: 269 },
  { mm2: 150, amps: 300 },
  { mm2: 185, amps: 341 },
  { mm2: 240, amps: 400 },
  { mm2: 300, amps: 458 },
];
export const VDROP_INFO = 3;
export const VDROP_WARN = 5;

export const cableAmps = (mm2: number) => CABLE_SIZES.find((c) => c.mm2 === mm2)?.amps;

/** 차단기 정격전류를 감당하는 가장 가는 전선 (300mm² 넘으면 병렬 필요 → undefined) */
export function recommendCable(breakerA: number | undefined): number | undefined {
  if (!breakerA) return undefined;
  return CABLE_SIZES.find((c) => c.amps >= breakerA)?.mm2;
}

/** 회로 전류: 부하를 적었으면 부하 전류, 아니면 차단기 정격 */
export function designAmps(it: PanelItem): number {
  return circuitAmps(it) || it.amps || 0;
}

/** 전압강하 (%) — 길이·전선이 없으면 undefined */
export function voltageDrop(it: PanelItem, mm2?: number): number | undefined {
  const a = mm2 ?? it.cable ?? recommendCable(it.amps);
  if (!it.lengthM || !a) return undefined;
  const i = designAmps(it);
  if (!i) return undefined;
  const three = isThreePhase(it);
  const e = ((three ? 30.8 : 35.6) * it.lengthM * i) / (1000 * a);
  return (e / (three ? 380 : 220)) * 100;
}

/** 전압강하가 limit % 이하가 되는 가장 가는 전선 */
export function cableForDrop(it: PanelItem, limit = VDROP_WARN): number | undefined {
  const min = recommendCable(it.amps) ?? 0;
  return CABLE_SIZES.find((c) => c.mm2 >= min && (voltageDrop(it, c.mm2) ?? 0) <= limit)?.mm2;
}
