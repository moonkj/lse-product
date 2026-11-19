import { z } from 'zod';
import { SourceRefSchema, SourcedValueSchema, type SourceRef } from './source';
import signalsJson from '../../data/market-signals.json';

/**
 * 기기 단위 시장 신호 (전력시장 10인 토론 P1 — 조달 난이도 / KEC·기술기준 개정 / 한전 투자 / 신재생 연계 압력).
 * 원칙: 합산 점수 없음, 신호마다 출처·기준일·신뢰도 필수. 수치가 있으면 SourcedValue, 판정만 있으면 source.
 * 근거를 찾지 못한 기기는 신호를 만들지 않는다(빈 칸 = 표시 안 함).
 */

const Base = {
  id: z.string().min(1),
  /** 이 신호가 걸리는 기기 id (equipment-types.json) */
  equipmentIds: z.array(z.string().min(1)).min(1),
  /** 카드에 보일 한 줄 설명 */
  text: z.string().min(1),
  /** 판정 기준 한 줄 (툴팁) */
  basis: z.string().min(1).optional(),
  /** 수치 근거 — 있으면 출처는 value.source */
  value: SourcedValueSchema.optional(),
  /** 수치 없는 판정·일정의 출처 */
  source: SourceRefSchema.optional(),
  needsCheck: z.boolean().optional(),
};

/** 조달 난이도 3단계 — 숫자 대신 신호, 해외 수치는 2차 인용만 */
export const LEAD_LEVELS = ['smooth', 'caution', 'delay'] as const;
export const LEAD_LEVEL_LABELS: Record<(typeof LEAD_LEVELS)[number], string> = {
  smooth: '원활',
  caution: '주의',
  delay: '지연',
};

/** 한전 투자 신호 3단계 */
export const KEPCO_LEVELS = ['expand', 'hold', 'tighten'] as const;
export const KEPCO_LEVEL_LABELS: Record<(typeof KEPCO_LEVELS)[number], string> = {
  expand: '확대',
  hold: '유지',
  tighten: '긴축',
};

export const REN_METRICS = ['smp', 'rec', 'curtailment', 'deployment', 'ess-auction'] as const;
export const REN_METRIC_LABELS: Record<(typeof REN_METRICS)[number], string> = {
  smp: 'SMP',
  rec: 'REC',
  curtailment: '출력제어',
  deployment: '보급 진척',
  'ess-auction': 'ESS 중앙계약',
};
export const TRENDS = ['up', 'down', 'flat'] as const;
export const TREND_ARROWS: Record<(typeof TRENDS)[number], string> = { up: '▲', down: '▼', flat: '―' };
/** 신재생 연계 압력 — 기기 수요 쪽에서 본 방향 (positive=수요 신호 강함 / caution=주의 / negative=부정 / neutral=방향만 표시) */
export const PRESSURE_LEVELS = ['positive', 'caution', 'negative', 'neutral'] as const;

const LeadTimeSignalSchema = z.object({ ...Base, kind: z.literal('leadtime'), level: z.enum(LEAD_LEVELS) });

const CodeChangeSignalSchema = z.object({
  ...Base,
  kind: z.literal('code'),
  /** 조항 번호 — 예: "KEC 214.2.1" */
  clause: z.string().min(1),
  /** 공고 번호 — 예: "기후에너지환경부공고 제2025-198호" */
  noticeNo: z.string().min(1),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** 시행 상태: 시행 예정(upcoming) / 시행 중(in-force) */
  status: z.enum(['upcoming', 'in-force']),
  /** 시행일 문구 (원문 표현) */
  effective: z.string().min(1),
  /** 경과조치 요약 */
  transition: z.string().min(1),
});

const KepcoSignalSchema = z.object({ ...Base, kind: z.literal('kepco'), level: z.enum(KEPCO_LEVELS) });

const RenewableSignalSchema = z.object({
  ...Base,
  kind: z.literal('renewable'),
  metric: z.enum(REN_METRICS),
  trend: z.enum(TRENDS).optional(),
  level: z.enum(PRESSURE_LEVELS),
});

export const MarketSignalSchema = z
  .discriminatedUnion('kind', [LeadTimeSignalSchema, CodeChangeSignalSchema, KepcoSignalSchema, RenewableSignalSchema])
  .refine((s) => (s.value ? !s.source : !!s.source), {
    message: '신호마다 value(수치+출처) 또는 source(판정 출처) 중 정확히 하나가 필요',
  });
export type MarketSignal = z.infer<typeof MarketSignalSchema>;
export type SignalKind = MarketSignal['kind'];

export const MarketSignalsFileSchema = z.object({
  /** 데이터 마지막 점검일 */
  asof: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  signals: z.array(MarketSignalSchema),
});
export type MarketSignalsFile = z.infer<typeof MarketSignalsFileSchema>;

/** 신호 종류별 허용 계층 — 한전 투자는 L2·L3·MON, 신재생 연계는 REN 에만 */
export const KIND_LAYERS: Partial<Record<SignalKind, readonly string[]>> = {
  kepco: ['L2', 'L3', 'MON'],
  renewable: ['REN'],
};

export function signalSource(s: MarketSignal): { source: SourceRef; needsCheck: boolean } {
  const source = (s.value?.source ?? s.source) as SourceRef;
  return { source, needsCheck: Boolean(s.needsCheck || s.value?.needsCheck) };
}

let cached: MarketSignalsFile | null = null;
export function loadMarketSignals(): MarketSignalsFile {
  if (!cached) cached = MarketSignalsFileSchema.parse(signalsJson);
  return cached;
}

/** 기기 하나의 신호 — 계층 규칙에 맞지 않는 종류는 거른다 */
export function signalsFor(equipmentId: string, layer: string, file: MarketSignalsFile = loadMarketSignals()): MarketSignal[] {
  return file.signals.filter((s) => {
    if (!s.equipmentIds.includes(equipmentId)) return false;
    const allowed = KIND_LAYERS[s.kind];
    return !allowed || allowed.includes(layer);
  });
}
