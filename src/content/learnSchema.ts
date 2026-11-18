import { z } from 'zod';
import { DataValidationError } from '../data/load';
import learnJson from './learn.json';

/**
 * src/content/learn.json — 교육(/learn) 콘텐츠 계약. T1-B 소유.
 * 퀴즈·학습 진도는 (개선 R3) 사용자 결정으로 제거 — 계층 투어 내용과 용어집만 둔다.
 * 사실관계는 equipment-types.json 의 description·learnPoints 범위 안에서만 쓴다 (교육 담당자 검토 전 draft).
 */
export const TourLayerSchema = z.enum(['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7']);
export type TourLayer = z.infer<typeof TourLayerSchema>;

export const LearnStepSchema = z.object({
  layer: TourLayerSchema,
  /** 단계 막대에 쓰는 짧은 이름 */
  shortLabel: z.string().min(1),
  title: z.string().min(1),
  intro: z.string().min(1),
  /** 핵심 기기 2~3개 (equipment-types.json id) */
  keyEquipmentIds: z.array(z.string()).min(1).max(3),
});
export type LearnStep = z.infer<typeof LearnStepSchema>;

export const GlossaryEntrySchema = z.object({
  term: z.string().min(1),
  meaning: z.string().min(1),
  equipmentId: z.string().optional(),
});
export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>;

export const LearnContentSchema = z
  .object({
    reviewStatus: z.string(),
    tourTitle: z.string().min(1),
    steps: z.array(LearnStepSchema).length(7),
    glossary: z.array(GlossaryEntrySchema),
  })
  .refine((c) => c.steps.every((s, i) => s.layer === `L${i + 1}`), { message: 'steps 는 L1~L7 순서여야 합니다' });
export type LearnContent = z.infer<typeof LearnContentSchema>;

let cache: LearnContent | undefined;

/** 렌더 중 호출 — 검증 실패 시 RootErrorBoundary 가 표시 */
export function getLearnContent(): LearnContent {
  if (cache) return cache;
  const r = LearnContentSchema.safeParse(learnJson);
  if (!r.success) throw new DataValidationError('src/content/learn.json', r.error);
  cache = r.data;
  return cache;
}
