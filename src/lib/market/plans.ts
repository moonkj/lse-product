import { z } from 'zod';
import type { Coverage, EquipmentType } from '../schema';
import { SourceRefSchema, SourcedValueSchema } from './source';
import plansJson from '../../data/market-plans.json';

/**
 * 계획 파이프라인 레이어 (전력시장 10인 토론 P0-2) — 공식 계획 물량·사업 일정을 계통도 L1~L3·신재생 밴드에 겹치고,
 * 그 기기의 자사 보유 상태(미보유·일부 보유 강조)를 함께 보인다. 계획 차수 비교(10차↔11차)로 물량·일정 변동을 표시.
 * 표현은 "계획 기반 설비 소요" — 발주 예측이 아니다(B3). 합산 점수 없음. 모든 수치는 SourcedValue(출처·기준일·실적/전망·방법).
 */

export const PLAN_EDITION_IDS = ['tx10', 'tx11', 'bp10', 'bp11'] as const;
export type PlanEditionId = (typeof PLAN_EDITION_IDS)[number];

/** 계획을 얹는 밴드 */
export const PLAN_LAYERS = ['L1', 'L2', 'L3', 'REN'] as const;
export type PlanLayer = (typeof PLAN_LAYERS)[number];

const EditionSchema = z.object({
  id: z.enum(PLAN_EDITION_IDS),
  /** 짧은 이름 — "11차 송변전" */
  short: z.string().min(1),
  title: z.string().min(1),
  period: z.string().regex(/^\d{4}~\d{4}$/),
  source: SourceRefSchema,
});

/** 계획 물량 한 값 — SourcedValue + 목표·기준 연도 + 계획 차수(실적·기타 전망은 차수 없음) */
export const PlanFigureSchema = SourcedValueSchema.extend({
  year: z.number().int().min(2000).max(2060).optional(),
  edition: z.enum(PLAN_EDITION_IDS).optional(),
});
export type PlanFigure = z.infer<typeof PlanFigureSchema>;

const PlanItemSchema = z.object({
  id: z.string().min(1),
  layer: z.enum(PLAN_LAYERS),
  label: z.string().min(1),
  note: z.string().min(1).optional(),
  /** 연결 기기 id (equipment-types.json) — 보유 상태 겹쳐 보기 */
  equipment: z.array(z.string().min(1)),
  figures: z.array(PlanFigureSchema).min(1),
});
export type PlanItem = z.infer<typeof PlanItemSchema>;

/** 사업 일정 표지 — value = 준공 연도(unit "년"), month 는 있으면 */
export const MilestoneSchema = SourcedValueSchema.extend({
  edition: z.enum(PLAN_EDITION_IDS),
  value: z.number().int().min(2000).max(2060),
  month: z.number().int().min(1).max(12).optional(),
  label: z.string().min(1).optional(),
});
export type Milestone = z.infer<typeof MilestoneSchema>;

const PlanProjectSchema = z.object({
  id: z.string().min(1),
  layer: z.enum(PLAN_LAYERS),
  name: z.string().min(1),
  equipment: z.array(z.string().min(1)),
  milestones: z.array(MilestoneSchema).min(1),
});
export type PlanProject = z.infer<typeof PlanProjectSchema>;

export const PlansFileSchema = z
  .object({
    asof: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    title: z.literal('계획 기반 설비 소요'),
    note: z.string().min(1),
    editions: z.array(EditionSchema).min(1),
    compare: z.array(z.object({ from: z.enum(PLAN_EDITION_IDS), to: z.enum(PLAN_EDITION_IDS) })),
    items: z.array(PlanItemSchema),
    projects: z.array(PlanProjectSchema),
  })
  .superRefine((f, ctx) => {
    const eds = new Set(f.editions.map((e) => e.id));
    const ids = new Set<string>();
    const used = (ed: PlanEditionId | undefined, path: (string | number)[]) => {
      if (ed && !eds.has(ed)) ctx.addIssue({ code: 'custom', message: `없는 계획 차수 ${ed}`, path });
    };
    f.compare.forEach((c, i) => {
      used(c.from, ['compare', i, 'from']);
      used(c.to, ['compare', i, 'to']);
    });
    f.items.forEach((it, i) => {
      if (ids.has(it.id)) ctx.addIssue({ code: 'custom', message: `중복 id ${it.id}`, path: ['items', i, 'id'] });
      ids.add(it.id);
      it.figures.forEach((g, j) => used(g.edition, ['items', i, 'figures', j, 'edition']));
    });
    f.projects.forEach((p, i) => {
      if (ids.has(p.id)) ctx.addIssue({ code: 'custom', message: `중복 id ${p.id}`, path: ['projects', i, 'id'] });
      ids.add(p.id);
      p.milestones.forEach((m, j) => used(m.edition, ['projects', i, 'milestones', j, 'edition']));
    });
  });
export type PlansFile = z.infer<typeof PlansFileSchema>;

let cached: PlansFile | null = null;
/** market-plans.json 검증 후 반환 (실패 = 예외 → 빌드·테스트 실패) */
export function getPlans(): PlansFile {
  cached ??= PlansFileSchema.parse(plansJson);
  return cached;
}

// ───────────── 계산 (순수 함수) ─────────────

/** 이 항목의 비교 쌍 (to 차수 값이 있는 첫 compare) — 없으면 undefined */
export function compareOf(item: PlanItem, compare: PlansFile['compare']) {
  for (const c of compare) {
    const to = item.figures.find((g) => g.edition === c.to);
    if (!to) continue;
    const from = item.figures.find((g) => g.edition === c.from);
    // 단위가 같아야 증감을 낸다 (예: 10차 km vs 11차 C-km 는 비교 불가)
    const comparable = !!from && from.unit === to.unit;
    return { from, to, delta: comparable ? round1(to.value - from.value) : undefined, comparable };
  }
  return undefined;
}

/** 대표 값: 최신 차수 전망 → 없으면 차수 없는 전망(가장 늦은 해) */
export function headlineOf(item: PlanItem, compare: PlansFile['compare']): PlanFigure {
  const c = compareOf(item, compare);
  if (c) return c.to;
  const fc = item.figures.filter((g) => g.kind === 'forecast');
  const pool = fc.length > 0 ? fc : item.figures;
  return [...pool].sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0];
}

/** 가장 최근 실적 */
export function latestActual(item: PlanItem): PlanFigure | undefined {
  return item.figures.filter((g) => g.kind === 'actual').sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0];
}

/** 같은 항목 안 차수 없는 전망 (예: 한전 2028 전망) — 대표 값과 다른 것 */
export function otherForecasts(item: PlanItem, headline: PlanFigure): PlanFigure[] {
  return item.figures.filter((g) => g !== headline && g.kind === 'forecast' && !g.edition);
}

const monthIndex = (m: Pick<Milestone, 'value' | 'month'>) => m.value * 12 + ((m.month ?? 12) - 1);

/** 사업 일정 변동: from 차수 마지막 준공 → to 차수 마지막 준공 (개월, +면 지연). 한쪽이 없으면 undefined */
export function projectShift(p: PlanProject, from: PlanEditionId, to: PlanEditionId) {
  const last = (ed: PlanEditionId) => p.milestones.filter((m) => m.edition === ed).sort((a, b) => monthIndex(a) - monthIndex(b)).at(-1);
  const a = last(from);
  const b = last(to);
  if (!a || !b) return undefined;
  const months = monthIndex(b) - monthIndex(a);
  // 월이 없는 쪽이 있으면 연 단위 비교
  const yearOnly = a.month === undefined || b.month === undefined;
  return { from: a, to: b, months: yearOnly ? (b.value - a.value) * 12 : months, yearOnly };
}

/** 일정 축 범위 (연) — 모든 사업 표지 + 앞뒤 여유 */
export function timelineRange(projects: readonly PlanProject[], min = 2024, max = 2038): [number, number] {
  let lo = min;
  let hi = max;
  for (const p of projects) for (const m of p.milestones) {
    lo = Math.min(lo, m.value);
    hi = Math.max(hi, m.value);
  }
  return [lo, hi + 1];
}

/** 표지의 축 위 위치 (0~1) */
export function milestonePos(m: Pick<Milestone, 'value' | 'month'>, range: [number, number]): number {
  const t = m.value + ((m.month ?? 12) - 0.5) / 12;
  return Math.min(1, Math.max(0, (t - range[0]) / (range[1] - range[0])));
}

export interface CoverageRow {
  id: string;
  name: string;
  abbr?: string;
  coverage: Coverage;
}

/** 강조할 보유 상태 — 미보유·일부 보유 */
export const PLAN_WARN_COVERAGES: readonly Coverage[] = ['missing', 'partial'];

/** 연결 기기의 보유 상태 — 강조(미보유·일부) 먼저 */
export function coverageRows(ids: readonly string[], types: readonly EquipmentType[]): CoverageRow[] {
  const byId = new Map(types.map((t) => [t.id, t]));
  const rows: CoverageRow[] = [];
  for (const id of ids) {
    const t = byId.get(id);
    if (t) rows.push({ id, name: t.name, abbr: t.abbr, coverage: t.coverage });
  }
  const rank = (c: Coverage) => (c === 'missing' ? 0 : c === 'partial' ? 1 : 2);
  return rows.sort((a, b) => rank(a.coverage) - rank(b.coverage));
}

/** 밴드 안 항목·사업의 기기 합집합 (중복 제거, 순서 유지) */
export function layerEquipment(layer: PlanLayer, file: PlansFile): string[] {
  const out: string[] = [];
  const add = (ids: readonly string[]) => ids.forEach((id) => !out.includes(id) && out.push(id));
  file.items.filter((i) => i.layer === layer).forEach((i) => add(i.equipment));
  file.projects.filter((p) => p.layer === layer).forEach((p) => add(p.equipment));
  return out;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/** 숫자 표기 — 천 단위 쉼표 */
export function fmtNum(n: number): string {
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
}

export function fmtMilestone(m: Pick<Milestone, 'value' | 'month'>): string {
  return m.month ? `${m.value}.${String(m.month).padStart(2, '0')}` : `${m.value}`;
}
