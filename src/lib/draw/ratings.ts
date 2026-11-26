/**
 * 반 안 구성 — 차단기 품목의 프레임(옵션)·정격전류·극수 고르기 도우미.
 * 정격전류 후보: 고른 옵션의 카탈로그 값이 '범위(2개)'면 표준 정격 중 그 범위 안, 아니면 카탈로그에 적힌 값들.
 */
import type { SpecsMap } from '../../data/load';
import { productRatings } from '../builder/specParse';
import type { PanelItem } from './model';

/** 표준 정격전류 (A) */
export const STD_A = [1, 2, 3, 4, 5, 6, 10, 13, 15, 16, 20, 25, 30, 32, 40, 50, 60, 63, 75, 80, 100, 125, 150, 160, 175, 200, 225, 250, 300, 350, 400, 500, 600, 630, 700, 800, 1000, 1200, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6300];

/** 극수를 고르는 저압 차단기·개폐기 */
export const POLED_EQ = new Set(['acb', 'mccb', 'branch-mccb', 'elcb', 'mcb-rcbo', 'mms', 'lv-ats', 'ms']);
/** 정격전류를 고르는 기기 (차단기·개폐기·전자개폐기) */
export const RATED_EQ = new Set([...POLED_EQ, 'vcb', 'lbs', 'alts', 'busway', 'vc-vi', 'pf']);

export interface VariantOption {
  id: string;
  label: string;
  A: number[];
}

export function variantOptions(productId: string | undefined, specs?: SpecsMap): VariantOption[] {
  const s = productId ? specs?.get(productId) : undefined;
  if (!s) return [];
  return productRatings(s).variants.map((v) => ({ id: v.id, label: v.label, A: v.A }));
}

function fromValues(values: number[]): number[] {
  const u = [...new Set(values)].filter((n) => n > 0).sort((a, b) => a - b);
  if (!u.length) return [];
  if (u.length === 2) return STD_A.filter((n) => n >= u[0] && n <= u[1]);
  return u;
}

/** 고를 수 있는 정격전류 — 옵션 → 제품 → 표준 순 */
export function ampsOptions(productId: string | undefined, variantId: string | undefined, specs?: SpecsMap): number[] {
  const s = productId ? specs?.get(productId) : undefined;
  if (s) {
    const r = productRatings(s);
    const v = variantId ? r.variants.find((x) => x.id === variantId) : undefined;
    if (v && v.A.length) return fromValues(v.A);
    // 옵션을 아직 안 골랐으면 옵션마다의 범위를 합친다
    if (r.variants.length && !variantId) return [...new Set(r.variants.flatMap((x) => fromValues(x.A)))].sort((a, b) => a - b);
    if (r.A.length) return fromValues(r.A);
  }
  return STD_A;
}

/** 정격전류 a 를 낼 수 있는 가장 작은 옵션 */
export function variantFor(productId: string | undefined, amps: number | undefined, specs?: SpecsMap): VariantOption | undefined {
  const opts = variantOptions(productId, specs).filter((v) => v.A.length);
  if (!opts.length) return undefined;
  if (!amps) return opts[0];
  return opts
    .filter((v) => fromValues(v.A).includes(amps) || (Math.min(...v.A) <= amps && Math.max(...v.A) >= amps))
    .sort((a, b) => Math.max(...a.A) - Math.max(...b.A))[0];
}

/** 품목 차단용량 (kA) — 고른 옵션 → 제품 최대 */
export function itemKA(it: PanelItem, specs?: SpecsMap): number | undefined {
  const s = it.product ? specs?.get(it.product) : undefined;
  if (!s) return undefined;
  const r = productRatings(s);
  const v = it.variant ? r.variants.find((x) => x.id === it.variant) : undefined;
  const list = v && v.kA.length ? v.kA : r.kA;
  return list.length ? Math.max(...list) : undefined;
}
/** 차단용량 표시 — 프레임을 안 골랐으면 제품 최대값이라 '최대' 를 붙인다 */
export function kaText(it: PanelItem, specs?: SpecsMap): string {
  const ka = itemKA(it, specs);
  if (ka === undefined) return '';
  return it.variant ? `${ka}kA` : `최대 ${ka}kA`;
}

/** 차단용량 need kA 이상인 가장 작은 옵션 */
export function variantForKA(productId: string | undefined, needKA: number, amps: number | undefined, specs?: SpecsMap): { id: string; label: string } | undefined {
  const s = productId ? specs?.get(productId) : undefined;
  if (!s) return undefined;
  return productRatings(s)
    .variants.filter((v) => v.kA.length && Math.max(...v.kA) >= needKA && (!amps || !v.A.length || Math.max(...v.A) >= amps))
    .sort((a, b) => Math.max(...a.kA) - Math.max(...b.kA))[0];
}

/** 표준 정격 중 a 이상인 가장 작은 값 */
export const stdAtLeast = (a: number) => STD_A.find((n) => n >= a) ?? STD_A[STD_A.length - 1];

/** 품목이 고른 정격이 제품·옵션 범위 안인지 (모르면 true) */
export function ampsInRange(it: PanelItem, specs?: SpecsMap): boolean {
  if (!it.amps || !it.product || !specs?.get(it.product)) return true;
  const opts = ampsOptions(it.product, it.variant, specs);
  if (!opts.length) return true;
  return it.amps >= Math.min(...opts) && it.amps <= Math.max(...opts);
}

export function variantLabel(it: PanelItem, specs?: SpecsMap): string | undefined {
  if (!it.variant) return undefined;
  return variantOptions(it.product, specs).find((v) => v.id === it.variant)?.label;
}

/** 품목 사양 한 줄: "ABE50Fb (50AF) · 2P · 20A" */
export function itemSpecText(it: PanelItem, specs?: SpecsMap): string {
  return [variantLabel(it, specs), it.poles ? `${it.poles}P` : '', it.amps ? `${it.amps}A` : ''].filter(Boolean).join(' · ');
}

/** 반 종류·주/분기별 기본 정격전류·극수 */
export function defaultRating(panelType: string, eq: string, isMain: boolean): { amps?: number; poles?: 1 | 2 | 3 | 4 } {
  if (!RATED_EQ.has(eq)) return {};
  const poles = POLED_EQ.has(eq) ? (isMain ? (panelType === 'mcc' ? 3 : 4) : panelType === 'panelboard' ? 2 : 3) : undefined;
  let amps: number | undefined;
  // 저압 배전반 주차단기는 위 변압기 용량으로 정한다 (제품 채우기)
  if (isMain) amps = panelType === 'panelboard' ? 100 : panelType === 'mcc' ? 225 : panelType === 'mv-swgr' ? 630 : undefined;
  else
    amps =
      ({ 'mcb-rcbo': 20, elcb: 30, 'branch-mccb': 30, mms: 25, ms: 18, busway: 1000, lbs: 630, alts: 630, vcb: 630 } as Record<string, number>)[eq] ??
      (panelType === 'lv-swgr' ? 400 : panelType === 'panelboard' ? 50 : 100);
  return { amps, poles };
}
