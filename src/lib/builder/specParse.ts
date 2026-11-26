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

/**
 * 전류·차단용량 글자에서 숫자가 아닌 조건(전압·극수·%)을 먼저 지운다.
 * 예) "6 at 240/415VAC (1pole)" → 6, "10 @ 120/240 VAC, 480 Y/277 VAC" → 10, "42 (690Vac), Ics=100%" → 42
 */
function stripConditions(value: string): string {
  return value
    .replace(/\([^)]*\)/g, ' ')
    .replace(/(?:at|@)\s*[\d./\sY]+\s*V(?:AC|DC|ac|dc)?\b/g, ' ')
    .replace(/\d+(?:\.\d+)?(?:\s*Y?\s*\/\s*\d+(?:\.\d+)?)*\s*Y?\s*V(?:AC|DC|ac|dc)?\b/g, ' ')
    .replace(/\d+\s*(?:-\s*\d+\s*)?P(?:ole)?\b/gi, ' ')
    .replace(/Ics\s*=\s*\d+\s*%|\d+\s*%/g, ' ');
}

/**
 * 정격전압 → kV. 단위가 V·V AC·Vac 면 1000 으로 나누고, 단위 없이 "AC 480V"·"AC 1000V / DC 1500V" 처럼
 * 글자 안에 V 가 붙어 있으면 그 숫자를 V 로 본다 (2026-11-26: 단위 칸이 비어 690V 가 690kV 로 읽히던 문제).
 */
function voltageKV(value: string, unit?: string): number[] {
  const u = (unit ?? '').trim();
  if (/^kV/i.test(u)) return parseNumbers(value);
  if (/^V/i.test(u)) return parseNumbers(value).map((n) => n / 1000);
  const cleaned = value.replace(/\([^)]*\)/g, ' ');
  if (/\d\s*kV/i.test(cleaned)) return parseNumbers(cleaned);
  if (/\d\s*V/i.test(cleaned)) return parseNumbers(cleaned).map((n) => n / 1000);
  return parseNumbers(value);
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
    if (it.key === 'ratedVoltage') out.kV.push(...voltageKV(it.value, it.unit));
    else if (it.key === 'ratedCurrent' && (it.unit ?? 'A') === 'A') out.A.push(...parseNumbers(stripConditions(it.value)));
    else if (it.key === 'breakingCapacity' && (it.unit ?? 'kA') === 'kA') out.kA.push(...parseNumbers(stripConditions(it.value)));
    else if (it.key === 'capacity' && it.unit === 'kVA') out.kVA.push(...parseNumbers(it.value));
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
