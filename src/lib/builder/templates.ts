/**
 * 계통 구성 시뮬레이션 템플릿 (src/data/builder-templates.json) — 스키마·조회.
 * 줄(row) = 계통 한 구간(수전·변압·저압…), 칸(slot) = 기기 하나. 연결은 줄 안에서 왼쪽 → 오른쪽, 줄은 위 → 아래 순서.
 */
import { z } from 'zod';
import templatesJson from '../../data/builder-templates.json';

const SlotSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  accepts: z.array(z.string().min(1)).min(1),
  required: z.boolean(),
  default: z.string().min(1),
  hint: z.string(),
  /** 변압기 칸 — 용량(kVA)·%Z 입력을 받는다 */
  transformer: z.boolean().optional(),
  /** 정격전류·차단용량을 변압기 2차 정격전류로 확인하는 칸 */
  rating: z.literal('trSecondary').optional(),
});
export type Slot = z.infer<typeof SlotSchema>;

const RowSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  voltage: z.string(),
  /** 이 구간의 공칭 전압(kV) — 제품 정격전압 확인에 씀 */
  kV: z.number().positive(),
  acdc: z.enum(['ac', 'dc']).optional(),
  slots: z.array(SlotSchema).min(1),
  addable: z.object({ label: z.string(), accepts: z.array(z.string()).min(1), max: z.number().int().positive() }).optional(),
});
export type Row = z.infer<typeof RowSchema>;

const RuleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('requires'), if: z.string(), then: z.string(), message: z.string() }),
  z.object({ type: z.literal('minCount'), eq: z.string(), count: z.number().int().positive(), fixSlot: z.string(), message: z.string() }),
  z.object({ type: z.literal('oneOf'), slots: z.array(z.string()).min(2), message: z.string() }),
]);
export type TemplateRule = z.infer<typeof RuleSchema>;

const TemplateSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  desc: z.string(),
  params: z.object({ kVA: z.number().positive(), pctZ: z.number().positive(), lvKV: z.number().positive() }),
  rows: z.array(RowSchema).min(1),
  rules: z.array(RuleSchema),
});
export type Template = z.infer<typeof TemplateSchema>;

export const TemplatesFileSchema = z.object({ note: z.string(), templates: z.array(TemplateSchema).min(1) });

export const TEMPLATES: Template[] = TemplatesFileSchema.parse(templatesJson).templates;
export const templateById = (id: string | null | undefined) => TEMPLATES.find((t) => t.id === id);

/** 템플릿의 모든 칸 (줄 정보와 함께) */
export function slotsOf(t: Template): { row: Row; slot: Slot }[] {
  return t.rows.flatMap((row) => row.slots.map((slot) => ({ row, slot })));
}

/** 템플릿에서 쓸 수 있는 기기 id 전체 (칸 accepts + 추가 칸) */
export function equipmentOf(t: Template): string[] {
  const ids = new Set<string>();
  for (const r of t.rows) {
    for (const s of r.slots) s.accepts.forEach((a) => ids.add(a));
    r.addable?.accepts.forEach((a) => ids.add(a));
  }
  return [...ids];
}
