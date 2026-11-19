import { z } from 'zod';

/**
 * 시장 연계 기능 공통 — 출처가 붙은 값 (전력시장 10인 토론 '숫자 표기 규칙').
 * 화면에 나오는 모든 수치는 출처(기관·자료명)·기준일·실적/전망·방법을 가진다. 빠지면 zod 검증에서 빌드 실패.
 * 신뢰도 3단계: official-stat(공식 통계) / official-plan(공식 계획·전망) / secondary(2차 인용·보도).
 */
export const CONFIDENCES = ['official-stat', 'official-plan', 'secondary'] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  'official-stat': '공식 통계',
  'official-plan': '공식 계획',
  secondary: '2차 인용',
};

export const SourceRefSchema = z.object({
  /** 기관·자료명 — 예: "산업통상자원부, 제11차 전력수급기본계획" */
  title: z.string().min(1),
  url: z.string().url().startsWith('https://'),
  /** 기준일(자료 발표일·통계 기준월) YYYY-MM 또는 YYYY-MM-DD */
  asof: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/),
  confidence: z.enum(CONFIDENCES),
});
export type SourceRef = z.infer<typeof SourceRefSchema>;

export const SourcedValueSchema = z.object({
  value: z.number(),
  unit: z.string().min(1),
  /** 실적(actual) / 전망·계획(forecast) */
  kind: z.enum(['actual', 'forecast']),
  /** 산출 방법 한 줄 — 원문 그대로면 "원문 수치" */
  method: z.string().min(1),
  source: SourceRefSchema,
  /** 원문 대조 전이면 true → 화면에 '확인 필요' */
  needsCheck: z.boolean().optional(),
});
export type SourcedValue = z.infer<typeof SourcedValueSchema>;
