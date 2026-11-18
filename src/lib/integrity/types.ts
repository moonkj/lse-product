import { z } from 'zod';

/**
 * 무결성 검사 공용 타입·작은 판정 함수 (React·DOM 의존 없음).
 * 규칙 ID 는 docs/test-plan.md §3 / tests/unit/data-integrity.test.ts 의 DI-xx 와 같다.
 */

export interface IssueRefs {
  nodeId?: string;
  edgeId?: string;
  equipmentId?: string;
  productId?: string;
  categoryCode?: string;
  /** 기기 폼에서 오류를 붙일 칸 (equipment-types 필드명) */
  field?: string;
  /** specs.json 옵션 id (DI-9x) */
  variantId?: string;
  /** specs.json 사양 항목 key (DI-9x) */
  specKey?: string;
}

export interface Issue {
  /** 규칙 ID (예 'DI-44a') */
  rule: string;
  /** 한국어 설명 */
  message: string;
  refs: IssueRefs;
}

export interface CheckResult {
  /** HARD 규칙 위반 — 하나라도 있으면 내보내기·CI 실패 */
  errors: Issue[];
  /** SOFT 규칙 위반 — 표시만 */
  warnings: Issue[];
}

/** 규칙 결과 수집기 */
export class Collector {
  readonly errors: Issue[] = [];
  readonly warnings: Issue[] = [];
  error(rule: string, message: string, refs: IssueRefs = {}) {
    this.errors.push({ rule, message, refs });
  }
  warn(rule: string, message: string, refs: IssueRefs = {}) {
    this.warnings.push({ rule, message, refs });
  }
  /** 규칙 하나를 실행 — 데이터가 스키마를 통과하지 못해 규칙 코드가 예외를 내도 나머지 규칙은 계속 */
  run(rule: string, fn: () => void) {
    try {
      fn();
    } catch (e) {
      this.error(rule, `규칙 검사 중 오류 — 데이터 형식을 먼저 고치세요 (${(e as Error).message})`);
    }
  }
  result(): CheckResult {
    return { errors: this.errors, warnings: this.warnings };
  }
}

// ───────────── 작은 판정 함수 (폼·검사 공용) ─────────────

/** YYYY-MM-DD 형식이면서 실제로 있는 날짜 (2026-02-30 거부) — DI-27e */
export function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** https 절대 URL — DI-27f */
export function isHttpsUrl(s: string): boolean {
  try {
    return new URL(s).protocol === 'https:';
  } catch {
    return false;
  }
}

/** 공식 사이트(서브도메인 포함) https 링크 — DI-17·63·84 */
export const LSE_URL_RE = /^https:\/\/([a-z0-9-]+\.)*ls-electric\.com(\/|$)/i;
export const PRODUCT_ID_RE = /^P\d{5}$/;
export const CATEGORY_CODE_RE = /^[A-Z]{3}\d{3,}$/;
/** 라우트(/equipment/:id)에 쓰이는 URL-safe kebab-case */
export const ROUTE_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
/** 국내 전화번호 의심 (DI 테스트 PHONE_RE 와 같음) — DI-99b */
export const PHONE_RE = /(?<!\d)(?:(?:01[016789]|0[2-6]\d?)[-.\s)]\d{3,4}[-.\s]\d{4}|1[5-9]\d{2}-\d{4})(?!\d)/;

/** 중복 값 */
export function duplicates<T>(values: readonly T[]): T[] {
  const seen = new Set<T>();
  const dup = new Set<T>();
  for (const v of values) (seen.has(v) ? dup : seen).add(v);
  return [...dup];
}

/** 최상위가 배열이든 { key: [] } 이든 배열로 (DI 테스트 asArray 와 같음) */
export function asArray(raw: unknown, key: string): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>)[key])) return (raw as Record<string, unknown[]>)[key];
  throw new Error(`${key}: 최상위가 배열 또는 { ${key}: [] } 형태가 아님`);
}

// ───────────── Zod 이슈 → 한국어 ─────────────

const FIELD_LABELS: Record<string, string> = {
  id: 'id',
  name: '이름',
  abbr: '약어',
  layer: '계층',
  voltage: '전압',
  category: '기능 분류',
  description: '설명',
  learnPoints: '학습 포인트',
  coverage: '커버리지',
  affiliateName: '계열사명',
  gapNote: '공백 메모',
  lseCategoryCodes: '연결 카테고리',
  productIds: '제품 지정',
  equipmentTypeId: '기기',
  x: 'x 좌표',
  y: 'y 좌표',
  from: '시작 노드',
  to: '끝 노드',
  points: '경로',
  file: '사진 파일',
  gapAssessment: '공백 판정',
  supplyMode: '공급 방식',
  basis: '판정 근거',
  confidence: '확신도',
  verifiedBy: '확인 부서',
  verifiedAt: '확인일',
  reviewDue: '재확인 기한',
  evidence: '근거 자료',
  ref: '근거',
  label: '라벨',
  width: '모선 길이',
  kind: '종류',
  thumb: '썸네일',
  status: '검수 상태',
  url: '주소',
};

export const fieldLabel = (f: string) => FIELD_LABELS[f] ?? f;

/** Zod 이슈 → 한국어 문장 (폼·전체 검사·가져오기 공용) */
export function koIssue(issue: z.core.$ZodIssue): string {
  const field = [...issue.path].reverse().find((p) => typeof p === 'string') as string | undefined;
  const label = (field && FIELD_LABELS[field]) ?? field ?? '값';
  switch (issue.code) {
    case 'too_small':
      return issue.origin === 'array' ? `${label}: 최소 ${String(issue.minimum)}개가 필요합니다` : `${label}: 비워 둘 수 없습니다`;
    case 'invalid_type':
      return /received undefined/.test(issue.message) ? `${label}: 필수 항목입니다` : `${label}: 형식이 올바르지 않습니다 (${issue.expected})`;
    case 'invalid_value':
      return `${label}: 허용되지 않는 값입니다`;
    case 'invalid_format':
      return /[가-힣]/.test(issue.message) ? `${label}: ${issue.message}` : `${label}: 형식이 올바르지 않습니다`;
    default:
      return /[가-힣]/.test(issue.message) ? `${label}: ${issue.message}` : `${label}: 올바르지 않은 값입니다`;
  }
}

export const pathText = (p: readonly PropertyKey[]) => p.map(String).join('.');
