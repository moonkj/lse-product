/**
 * 화면 공통 라벨·커버리지 규칙 — 단일 출처 (리뷰 M2·R2·R3).
 * 계통도·상세 패널·기기/제품/공백 표/교육 화면은 모두 여기서 import 한다.
 */
import { COVERAGE_LABELS, type Coverage, type EquipmentCategory, type Layer } from './schema';

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
export const COVERAGE_ORDER: Coverage[] = ['owned', 'partial', 'affiliate', 'missing', 'na'];

/** 색약 대응: 색과 함께 모양이 다른 아이콘을 병행 */
export const COVERAGE_ICONS: Record<Coverage, string> = {
  owned: '✓',
  partial: '◐',
  affiliate: '◆',
  missing: '✕',
  na: '–',
};

/** 좁은 칸(공백 표 목록·필터)용 짧은 라벨 */
export const COVERAGE_SHORT_LABELS: Record<Coverage, string> = {
  owned: '보유',
  partial: '일부',
  affiliate: '계열사',
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

/** Gap 모드에서 흐리게 표시하는 상태 (보유·해당 없음). 계열사 보유는 보통 */
export const DIMMED_COVERAGES: readonly Coverage[] = ['owned', 'na'];
export const isDimmedCoverage = (c: Coverage) => DIMMED_COVERAGES.includes(c);

/**
 * 공백 표 "공백 목록" 범위 = 강조 대상 + 계열사 보유 (자사 제품이 없는 기기 전체 — 검토 대상).
 */
export const GAP_LIST_COVERAGES: Coverage[] = ['missing', 'partial', 'affiliate'];

/** 주 계층(L1~L7) 여부 — 감시·신재생(MON/REN) 제외 */
export const isMainLayer = (l: Layer | string): l is Exclude<Layer, 'MON' | 'REN'> => /^L[1-7]$/.test(l);

/** 공통 문서 제목 */
export const APP_TITLE = 'LS ELECTRIC 전력계통 제품맵';
export const pageTitle = (name?: string) => (name ? `${name} · ${APP_TITLE}` : APP_TITLE);
