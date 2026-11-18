/**
 * 화면 공통 라벨·커버리지 규칙 — 단일 출처 (리뷰 M2·R2·R3).
 * 계통도·상세 패널·기기/제품/공백 표/교육 화면은 모두 여기서 import 한다.
 */
import { ASSESSED_COVERAGES, COVERAGE_LABELS, type Coverage, type EquipmentCategory, type EquipmentType, type GapAssessment, type Layer } from './schema';

export { COVERAGE_LABELS };

/** 기기 기능 분류 라벨 — 디자인 승인안(공백 표 열 이름) 표기 */
export const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  switching: '개폐',
  protection: '보호',
  transformation: '변성',
  measurement: '계측',
  control: '제어',
  monitoring: '감시',
  generation: '발전',
  conductor: '선로',
  load: '부하',
  system: '시스템',
};

export const CATEGORY_ORDER: EquipmentCategory[] = [
  'switching',
  'protection',
  'transformation',
  'measurement',
  'control',
  'monitoring',
  'generation',
  'conductor',
  'load',
  'system',
];

/** 공백 표·칩 표시 순서 */
export const COVERAGE_ORDER: Coverage[] = ['owned', 'partial', 'affiliate', 'sourced', 'missing', 'na'];

/** 색약 대응: 색과 함께 모양이 다른 아이콘을 병행 */
export const COVERAGE_ICONS: Record<Coverage, string> = {
  owned: '✓',
  partial: '◐',
  affiliate: '◆',
  sourced: '⊡',
  missing: '✕',
  na: '–',
};

/** 좁은 칸(공백 표 목록·필터)용 짧은 라벨 */
export const COVERAGE_SHORT_LABELS: Record<Coverage, string> = {
  owned: '보유',
  partial: '일부',
  affiliate: '계열사',
  sourced: '패널 구성품',
  missing: '미보유',
  na: '해당 없음',
};

// ───────────── "공백" 정의 (리더 결정 R-08) ─────────────

/**
 * 강조 대상 공백 = 미보유 + 일부 보유.
 * 계통도 Gap 모드 강조, 좌측 내비·밴드 "공백 N", 상세 패널 Gap 섹션, 기기 페이지 "공백 표에서 보기" 가 이 기준.
 */
export const EMPHASIZED_COVERAGES: readonly Coverage[] = ['missing', 'partial'];
export const isGapCoverage = (c: Coverage) => EMPHASIZED_COVERAGES.includes(c);

/** Gap 모드에서 흐리게 표시하는 상태 (보유·해당 없음). 계열사 보유·패널 구성품은 보통 */
export const DIMMED_COVERAGES: readonly Coverage[] = ['owned', 'na'];
export const isDimmedCoverage = (c: Coverage) => DIMMED_COVERAGES.includes(c);

/**
 * 공백 표 "공백 목록" 범위 = 강조 대상 + 계열사 보유 + 패널 구성품 (자사 제품이 없는 기기 전체 — 검토 대상).
 * 판정 근거(gapAssessment)가 필요한 커버리지(schema ASSESSED_COVERAGES)와 같은 집합 — 의미가 같으므로 재사용 (리뷰 R7)
 */
export const GAP_LIST_COVERAGES: readonly Coverage[] = ASSESSED_COVERAGES;

// ───────────── 공백 판정 근거 (개선 R3) ─────────────

export const GAP_BASIS_LABELS: Record<GapAssessment['basis'], string> = {
  'homepage-menu': '홈페이지 제품 메뉴',
  catalog: '카탈로그',
  'bu-confirmed': '사업부 확인',
  'rnd-confirmed': '연구소 확인',
};

export const SUPPLY_MODE_LABELS: Record<GapAssessment['supplyMode'], string> = {
  'in-house': '자사 공급',
  affiliate: '계열사 공급',
  'panel-sourced': '수배전반 구성품(타사 조달)',
  'not-offered': '공급하지 않음',
  unknown: '확인 필요',
};

export const CONFIDENCE_LABELS: Record<GapAssessment['confidence'], string> = {
  candidate: '공백 후보',
  confirmed: '공백 확정',
};

/** 오늘 날짜 YYYY-MM-DD — 한국 표준시(KST, UTC+9) 기준. 화면·관리자·무결성 검사가 같은 날짜를 쓴다 (T2 L8) */
export function todayIso(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** 재확인 기한이 지났는지 */
export const isReviewOverdue = (g: GapAssessment | undefined, today = todayIso()) => !!g?.reviewDue && g.reviewDue < today;

/**
 * 화면에 쓰는 확신도: 판정 근거가 필요한 상태(미보유·일부·계열사·패널 구성품)만 대상.
 * confirmed 라도 재확인 기한이 지나면 후보로 취급. 근거가 없으면 후보.
 * 그 밖의 상태(보유·해당 없음)는 undefined — 테두리 규칙 적용 안 함.
 */
export function gapConfidence(eq: Pick<EquipmentType, 'coverage' | 'gapAssessment'>, today = todayIso()) {
  if (!ASSESSED_COVERAGES.includes(eq.coverage)) return undefined;
  const g = eq.gapAssessment;
  if (!g || g.confidence !== 'confirmed' || isReviewOverdue(g, today)) return 'candidate' as const;
  return 'confirmed' as const;
}

/**
 * 판정 확신도 표기 (UX 토론 B7). 패널 구성품(sourced)은 공백이 아니므로 "공백" 없이 "판정 확정/후보" —
 * 배지 "패널 구성품"·Gap 모드 "보통"과 맞춘다. 그 밖의 공백류는 CONFIDENCE_LABELS("공백 확정/후보").
 */
export const SOURCED_CONFIDENCE_LABELS: Record<GapAssessment['confidence'], string> = {
  candidate: '판정 후보',
  confirmed: '판정 확정',
};

export function confidenceLabel(coverage: Coverage, conf: GapAssessment['confidence']): string {
  return coverage === 'sourced' ? SOURCED_CONFIDENCE_LABELS[conf] : CONFIDENCE_LABELS[conf];
}

/** 상세 패널 판정 섹션 제목 — 패널 구성품은 "구성품 판정"(공백 아님), 그 밖의 공백류는 "공백 판정" */
export const assessmentTitle = (coverage: Coverage) => (coverage === 'sourced' ? '구성품 판정' : '공백 판정');

/** 주 계층(L1~L7) 여부 — 감시·신재생(MON/REN) 제외 */
export const isMainLayer = (l: Layer | string): l is Exclude<Layer, 'MON' | 'REN'> => /^L[1-7]$/.test(l);

/** 공통 문서 제목 */
export const APP_TITLE = 'LS ELECTRIC 전력계통 제품맵';
export const pageTitle = (name?: string) => (name ? `${name} · ${APP_TITLE}` : APP_TITLE);
