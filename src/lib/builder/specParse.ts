/**
 * 카탈로그 정격 문자열 → 숫자 (계통 구성 시뮬레이션 정격 확인용).
 * specs.json 값은 "200~2000 (In max)", "65 (690/600/550V) / 85 (500/480/460V)", "22.9 / 6.6 / 3.3 (1차)" 같은 글자다.
 * 괄호 안(주석·조건 전압)은 버리고 남은 숫자를 모두 읽는다. 못 읽으면 빈 배열 → 화면은 "정격 정보 없음"으로 판단을 보류한다.
 */
import type { ProductSpecs, SpecItem } from '../schema';

export function parseNumbers(value: string): number[] {
  const cleaned = value.replace(/\([^)]*\)/g, ' ');
  return [...cleaned.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0])).filter((n) => Number.isFinite(n));
}

/** 단위를 kV·A·kA 기준으로 맞춘다 (V → kV) */
function toBase(n: number, key: string, unit?: string): number {
  if (key === 'ratedVoltage' && unit === 'V') return n / 1000;
  return n;
}

export interface ProductRatings {
  /** 정격전압 후보 (kV) */
  kV: number[];
  /** 정격전류 후보 (A) */
  A: number[];
  /** 차단용량 후보 (kA) */
  kA: number[];
  /** 변압기 정격용량 후보 (kVA) */
  kVA: number[];
  /** 옵션(variant)별 값 — 추천 옵션 안내용 */
  variants: { id: string; label: string; A: number[]; kA: number[]; kV: number[]; kVA: number[] }[];
}

function collect(items: readonly SpecItem[]) {
  const out = { kV: [] as number[], A: [] as number[], kA: [] as number[], kVA: [] as number[] };
  for (const it of items) {
    const nums = parseNumbers(it.value).map((n) => toBase(n, it.key, it.unit));
    if (it.key === 'ratedVoltage') out.kV.push(...nums);
    else if (it.key === 'ratedCurrent' && (it.unit ?? 'A') === 'A') out.A.push(...nums);
    else if (it.key === 'breakingCapacity' && (it.unit ?? 'kA') === 'kA') out.kA.push(...nums);
    else if (it.key === 'capacity' && it.unit === 'kVA') out.kVA.push(...nums);
  }
  return out;
}

export function productRatings(spec: ProductSpecs | undefined): ProductRatings {
  const empty: ProductRatings = { kV: [], A: [], kA: [], kVA: [], variants: [] };
  if (!spec) return empty;
  const base = collect(spec.items);
  const variants = (spec.variants ?? []).map((v) => ({ id: v.id, label: v.label, ...collect(v.items) }));
  const all = (k: 'kV' | 'A' | 'kA' | 'kVA') => [...base[k], ...variants.flatMap((v) => v[k])];
  return { kV: all('kV'), A: all('A'), kA: all('kA'), kVA: all('kVA'), variants };
}

export const maxOf = (ns: number[]) => (ns.length ? Math.max(...ns) : undefined);

/** 변압기 2차 정격전류 (A) — I = kVA / (√3 · kV) */
export const trSecondaryA = (kVA: number, lvKV: number) => kVA / (Math.sqrt(3) * lvKV);

/** 변압기 2차 단락전류 근사 (kA) — 상위 계통 무한 모선 가정, Isc ≈ I₂ / %Z */
export const trShortCircuitKA = (kVA: number, lvKV: number, pctZ: number) => trSecondaryA(kVA, lvKV) / (pctZ / 100) / 1000;
