import { z } from 'zod';
import { SourcedValueSchema } from './source';

/**
 * 연간 전력시장 지표(접힌 섹션) + 공백 매트릭스(성장 방향 × 보유) 데이터 스키마.
 * 전력시장 10인 토론 합의: 별도 시장 화면 없음 · 합산 점수 없음 · 원화 시장 규모 축 없음 ·
 * 모든 수치는 SourcedValue(출처·기준일·실적/전망·방법). 데이터: src/data/market-annual.json, market-growth.json
 */

const Year = z.number().int().min(1990).max(2100);

export const YearPointSchema = SourcedValueSchema.extend({ year: Year });
export type YearPoint = z.infer<typeof YearPointSchema>;

export const INDICATOR_IDS = ['consumption', 'generation', 'capacity', 'smp'] as const;
export type IndicatorId = (typeof INDICATOR_IDS)[number];

export const IndicatorSchema = z.object({
  id: z.enum(INDICATOR_IDS),
  label: z.string().min(1),
  unit: z.string().min(1),
  /** 지표 정의 한 줄 */
  desc: z.string().min(1),
  /** 공식 통계 실적 (연 단위, 최소 5년) */
  actual: z.array(YearPointSchema).min(5),
  /** 전망 점선의 출발점 — 계획 문서에 실린 기준연도 값 (실적과 집계 범위가 다를 수 있음) */
  planBase: YearPointSchema.optional(),
  /** 공식 계획 전망 (점선) */
  forecast: z.array(YearPointSchema),
  /** 차트에 그리지 않는 참고 값 (단위가 달라 같은 축에 못 올리는 값) */
  refs: z.array(YearPointSchema.extend({ label: z.string().min(1) })),
  /** 전망이 비어 있는 이유 등 */
  gapNote: z.string().optional(),
});
export type Indicator = z.infer<typeof IndicatorSchema>;

export const MIX_KEYS = ['nuclear', 'coal', 'lng', 'renewable', 'other'] as const;
export type MixKey = (typeof MIX_KEYS)[number];
export const MIX_LABELS: Record<MixKey, string> = {
  nuclear: '원전',
  coal: '석탄',
  lng: 'LNG',
  renewable: '신재생',
  other: '기타',
};

const Share = z.number().min(0).max(100);
export const MixPointSchema = SourcedValueSchema.omit({ value: true }).extend({
  year: Year,
  shares: z.object({ nuclear: Share, coal: Share, lng: Share, renewable: Share, other: Share }),
});
export type MixPoint = z.infer<typeof MixPointSchema>;

export const MarketAnnualSchema = z.object({
  asof: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().min(1),
  indicators: z.array(IndicatorSchema).min(1),
  mix: z.object({
    label: z.string().min(1),
    desc: z.string().min(1),
    actual: z.array(MixPointSchema).min(5),
    planBase: MixPointSchema.optional(),
    forecast: z.array(MixPointSchema),
  }),
});
export type MarketAnnual = z.infer<typeof MarketAnnualSchema>;

// ───────────── 성장 방향 ─────────────

export const GROWTH_DIRECTIONS = ['up2', 'up', 'flat'] as const;
export type GrowthDirection = (typeof GROWTH_DIRECTIONS)[number];
/** 매트릭스 세로축 — 근거 없음(none)은 데이터에 없는 기기 전부 */
export type GrowthRow = GrowthDirection | 'none';
export const GROWTH_ROWS: readonly GrowthRow[] = ['up2', 'up', 'flat', 'none'];
export const GROWTH_SYMBOLS: Record<GrowthRow, string> = { up2: '↑↑', up: '↑', flat: '→', none: '—' };
export const GROWTH_LABELS: Record<GrowthRow, string> = {
  up2: '크게 증가',
  up: '증가',
  flat: '유지·감소',
  none: '근거 없음',
};

export const GrowthBasisSchema = YearPointSchema.extend({
  label: z.string().min(1),
  /** base=기준 물량, target=계획 물량, context=보조 수치 */
  role: z.enum(['base', 'target', 'context']),
});
export type GrowthBasis = z.infer<typeof GrowthBasisSchema>;

export const GrowthItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(1),
  direction: z.enum(GROWTH_DIRECTIONS),
  /** 수요처를 거친 간접 연결 — 최대 ↑ */
  indirect: z.boolean(),
  equipment: z.array(z.string().min(1)).min(1),
  reason: z.string().min(1),
  basis: z.array(GrowthBasisSchema).min(1),
});
export type GrowthItem = z.infer<typeof GrowthItemSchema>;

export const MarketGrowthSchema = z.object({
  asof: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rule: z.string().min(1),
  items: z.array(GrowthItemSchema),
});
export type MarketGrowth = z.infer<typeof MarketGrowthSchema>;

// ───────────── 무결성 규칙 (스키마로 못 거르는 관계 검사) ─────────────

const SHARE_TOLERANCE = 0.3;

function checkYears(where: string, points: { year: number }[], issues: string[]) {
  for (let i = 1; i < points.length; i++) {
    if (points[i].year <= points[i - 1].year) issues.push(`${where}: 연도가 오름차순·중복 없음이 아님 (${points[i].year})`);
  }
}

/** market-annual.json 관계 규칙 — 위반 메시지 목록 (빈 배열이면 통과) */
export function checkAnnual(data: MarketAnnual): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const ind of data.indicators) {
    if (seen.has(ind.id)) issues.push(`${ind.id}: 지표 중복`);
    seen.add(ind.id);
    checkYears(`${ind.id}.actual`, ind.actual, issues);
    checkYears(`${ind.id}.forecast`, ind.forecast, issues);
    const all = [...ind.actual, ...ind.forecast, ...(ind.planBase ? [ind.planBase] : [])];
    for (const p of all) if (p.unit !== ind.unit) issues.push(`${ind.id} ${p.year}: 단위 ${p.unit} ≠ ${ind.unit}`);
    for (const p of ind.actual) {
      if (p.kind !== 'actual') issues.push(`${ind.id}.actual ${p.year}: kind=actual 이어야 함`);
      if (p.source.confidence !== 'official-stat') issues.push(`${ind.id}.actual ${p.year}: 실적은 공식 통계만`);
    }
    for (const p of ind.forecast) {
      if (p.kind !== 'forecast') issues.push(`${ind.id}.forecast ${p.year}: kind=forecast 이어야 함`);
      if (p.source.confidence !== 'official-plan') issues.push(`${ind.id}.forecast ${p.year}: 전망은 공식 계획만`);
    }
    if (ind.forecast.length > 0 && !ind.planBase) issues.push(`${ind.id}: 전망이 있으면 planBase(계획 기준연도 값) 필요`);
    if (ind.planBase && ind.planBase.source.url !== ind.forecast[0]?.source.url)
      issues.push(`${ind.id}: planBase 와 전망의 출처 문서가 다름`);
    const lastActual = ind.actual[ind.actual.length - 1]?.year ?? 0;
    if (ind.forecast.some((p) => p.year <= lastActual)) issues.push(`${ind.id}: 전망 연도는 마지막 실적 연도 뒤여야 함`);
    if (ind.forecast.length === 0 && !ind.gapNote) issues.push(`${ind.id}: 전망이 없으면 gapNote 로 이유 표시`);
  }
  const mix = data.mix;
  checkYears('mix.actual', mix.actual, issues);
  checkYears('mix.forecast', mix.forecast, issues);
  const mixAll = [...mix.actual, ...mix.forecast, ...(mix.planBase ? [mix.planBase] : [])];
  for (const p of mixAll) {
    const sum = MIX_KEYS.reduce((s, k) => s + p.shares[k], 0);
    if (Math.abs(sum - 100) > SHARE_TOLERANCE) issues.push(`mix ${p.year}: 비중 합 ${sum.toFixed(1)}% (100±${SHARE_TOLERANCE})`);
    if (p.unit !== '%') issues.push(`mix ${p.year}: 단위는 %`);
  }
  for (const p of mix.actual) if (p.kind !== 'actual' || p.source.confidence !== 'official-stat') issues.push(`mix.actual ${p.year}: 공식 통계 실적만`);
  for (const p of mix.forecast) if (p.kind !== 'forecast' || p.source.confidence !== 'official-plan') issues.push(`mix.forecast ${p.year}: 공식 계획 전망만`);
  return issues;
}

/** market-growth.json 관계 규칙 — equipmentIds: equipment-types.json 의 id 집합 */
export function checkGrowth(data: MarketGrowth, equipmentIds: ReadonlySet<string>): string[] {
  const issues: string[] = [];
  const owner = new Map<string, string>();
  const ids = new Set<string>();
  for (const it of data.items) {
    if (ids.has(it.id)) issues.push(`${it.id}: id 중복`);
    ids.add(it.id);
    for (const eq of it.equipment) {
      if (!equipmentIds.has(eq)) issues.push(`${it.id}: 없는 기기 id ${eq}`);
      const prev = owner.get(eq);
      if (prev) issues.push(`${eq}: ${prev}·${it.id} 두 판정에 중복`);
      owner.set(eq, it.id);
    }
    if (it.indirect && it.direction === 'up2') issues.push(`${it.id}: 간접 연결은 ↑ 까지만`);
    if (/조\s*원|억\s*원|원\)?$/.test(it.basis.map((b) => b.unit).join(' '))) issues.push(`${it.id}: 원화 금액은 판정 근거로 쓰지 않음`);
    if (!it.basis.some((b) => b.role === 'target')) issues.push(`${it.id}: 계획 물량(target) 근거 필요`);
    const base = it.basis.find((b) => b.role === 'base');
    const target = it.basis.find((b) => b.role === 'target');
    if (base && target) {
      if (base.unit !== target.unit) issues.push(`${it.id}: base·target 단위 다름`);
      const ratio = target.value / base.value;
      if (it.direction === 'up2' && ratio < 2) issues.push(`${it.id}: ↑↑ 인데 배수 ${ratio.toFixed(2)} < 2`);
      if (it.direction === 'up' && ratio <= 1) issues.push(`${it.id}: ↑ 인데 증가 아님`);
      if (it.direction === 'flat' && ratio > 1.05) issues.push(`${it.id}: → 인데 5% 넘게 증가`);
    } else if (it.direction === 'up2') {
      issues.push(`${it.id}: ↑↑ 는 기준(base)·계획(target) 물량이 모두 있어야 함`);
    }
  }
  return issues;
}

/** 기기 id → 성장 판정 (없으면 근거 없음) */
export function growthByEquipment(data: MarketGrowth): Map<string, GrowthItem> {
  const m = new Map<string, GrowthItem>();
  for (const it of data.items) for (const eq of it.equipment) m.set(eq, it);
  return m;
}
