/**
 * 명판 형식명·옵션명 검색 (UX 토론 B6) — "TS250", "250AF", "ABN", "TD100" 처럼 명판에 적힌 이름으로 찾기.
 *
 * - 검색 대상: specs.json 옵션(variant) 라벨, 프레임 값(250 + AF → 250AF), 제품명의 모델 토큰.
 * - specs.json 은 지연 로딩이라 이 모듈은 사양 Map 을 인자로 받기만 한다 (첫 화면 번들에 사양을 넣지 않음).
 *   검색창에 포커스가 가거나 입력하면 SearchBox 가 loadSpecs() 를 호출하고, 도착하면 색인을 만든다.
 * - 퍼지 매칭이 아니라 정규화(대문자·기호 제거)한 토큰 비교 — 모델명은 한 글자 차이도 다른 제품이라 정확도가 우선.
 *   점수(0 = 완전 일치)는 Fuse 점수와 같은 눈금으로 맞춰 SearchBox 에서 한 줄로 정렬한다.
 */
import type { ProductSpecs } from './schema';

/** 대문자 + 영숫자·한글만 남김 ("ts 250" → "TS250", "AH-06D" → "AH06D") */
export function normalizeModel(s: string): string {
  return s.toUpperCase().replace(/[^0-9A-Z가-힣]/g, '');
}

/** 이 글자 수보다 짧은 질의는 형식명 검색을 하지 않음 (예: "AF", "TS" 는 잡음) */
const MIN_QUERY = 3;

/** exactAlt = 펼치거나 이어 붙여 만든 토큰과 일치 (예: "TS100/160/250" 의 TS250) — 라벨에 그대로 적힌 것보다 한 칸 아래 */
export const OPTION_SCORE = { exact: 0, exactAlt: 0.02, prefix: 0.1, contains: 0.2 } as const;

/**
 * 라벨에서 형식명 토큰을 뽑는다.
 *  - 영숫자 덩어리: "TS250 (250AF)" → TS250, 250AF
 *  - 공백·하이픈으로 이어진 덩어리 결합: "LS-LVSS-101" → LSLVSS101, "XGIPAM F" → XGIPAMF
 *  - 슬래시 묶음 펼치기: "TS100/160/250" → TS100, TS160, TS250 / "TD100/160" → TD100, TD160
 */
export function modelTokens(label: string): string[] {
  return [...new Set([...primaryTokens(label), ...derivedTokens(label)])];
}

/** 라벨에 그대로 적힌 영숫자 덩어리 */
function primaryTokens(label: string): string[] {
  return (label.match(/[A-Za-z0-9]+/g) ?? []).map((r) => r.toUpperCase());
}

/** 이어 붙이거나 펼쳐 만든 토큰 */
function derivedTokens(label: string): string[] {
  const out = new Set<string>();

  // 공백·하이픈으로만 떨어진 연속 덩어리 (최대 3개) 결합
  for (const seg of label.match(/[A-Za-z0-9]+(?:[-\s][A-Za-z0-9]+)+/g) ?? []) {
    const parts = seg.split(/[-\s]/);
    for (let i = 0; i < parts.length; i++)
      for (let j = i + 2; j <= Math.min(parts.length, i + 3); j++) out.add(parts.slice(i, j).join('').toUpperCase());
  }

  // 슬래시 묶음: 접두 글자 + 숫자들
  for (const m of label.matchAll(/([A-Za-z]+)(\d+[A-Za-z]*)((?:\/\d+[A-Za-z]*)+)/g)) {
    const prefix = m[1].toUpperCase();
    out.add(prefix + m[2].toUpperCase());
    for (const n of m[3].split('/').filter(Boolean)) out.add(prefix + n.toUpperCase());
  }
  return [...out];
}

export interface OptionDoc {
  productId: string;
  productName: string;
  variantId: string;
  label: string;
  axis?: string;
  /** 라벨에 그대로 적힌 토큰 */
  tokens: string[];
  /** 펼치거나 이어 붙인 토큰 + 프레임 값(250AF) */
  altTokens: string[];
  /** 라벨 전체 정규화 (부분 일치용) */
  norm: string;
}

/** 프레임 값 "100/160/250" + 단위 "AF" → 100AF, 160AF, 250AF */
function frameTokens(value: string, unit?: string): string[] {
  if (!unit || !/^[A-Za-z]+$/.test(unit)) return [];
  const nums = value.match(/\d+/g) ?? [];
  return nums.map((n) => `${n}${unit.toUpperCase()}`);
}

/** 사양 Map → 옵션 색인. productName 은 제품 id → 이름 (없는 제품은 건너뜀) */
export function buildOptionIndex(specs: ReadonlyMap<string, ProductSpecs>, productName: (id: string) => string | undefined): OptionDoc[] {
  const docs: OptionDoc[] = [];
  for (const [productId, s] of specs) {
    const name = productName(productId);
    if (!name) continue;
    for (const v of s.variants ?? []) {
      const tokens = primaryTokens(v.label);
      const alt = new Set(derivedTokens(v.label));
      for (const it of v.items) if (it.key === 'frame') for (const t of frameTokens(it.value, it.unit)) alt.add(t);
      for (const t of tokens) alt.delete(t);
      docs.push({
        productId,
        productName: name,
        variantId: v.id,
        label: v.label,
        axis: s.variantAxis,
        tokens,
        altTokens: [...alt],
        norm: normalizeModel(v.label),
      });
    }
  }
  return docs;
}

/** 토큰 목록과 질의의 일치 점수 (없으면 undefined) */
export function tokenScore(doc: Pick<OptionDoc, 'tokens' | 'altTokens' | 'norm'>, qn: string): number | undefined {
  if (qn.length < MIN_QUERY) return undefined;
  const { tokens, altTokens, norm } = doc;
  if (tokens.includes(qn)) return OPTION_SCORE.exact;
  if (altTokens.includes(qn)) return OPTION_SCORE.exactAlt;
  if (tokens.some((t) => t.startsWith(qn)) || altTokens.some((t) => t.startsWith(qn))) return OPTION_SCORE.prefix;
  if (norm.includes(qn)) return OPTION_SCORE.contains;
  return undefined;
}

export interface OptionHit {
  doc: OptionDoc;
  score: number;
}

/** 옵션 검색 — 점수 오름차순(같으면 색인 순서), 최대 limit 개 */
export function searchOptions(index: readonly OptionDoc[], query: string, limit: number): OptionHit[] {
  const qn = normalizeModel(query);
  if (qn.length < MIN_QUERY) return [];
  const hits: OptionHit[] = [];
  for (const doc of index) {
    const score = tokenScore(doc, qn);
    if (score !== undefined) hits.push({ doc, score });
  }
  return hits.sort((a, b) => a.score - b.score).slice(0, limit);
}

/**
 * 제품명의 모델 토큰이 질의와 정확히 같으면 true (예: "GIPAM 1000" ↔ "GIPAM1000", "115FI" ↔ "GIPAM115FI" 는 아님).
 * 숫자가 든 질의만 대상 — "ACB"·"VCB" 같은 영문자 토큰은 기기 약어와 겹쳐 기기를 밀어내므로 제외 (리뷰 M1).
 */
export function productNameExact(name: string, query: string): boolean {
  const qn = normalizeModel(query);
  if (qn.length < MIN_QUERY || !/\d/.test(qn)) return false;
  return normalizeModel(name) === qn || modelTokens(name).includes(qn);
}

/** 옵션 결과를 누르면 갈 주소 — 제품 페이지가 ?opt= 로 그 옵션 열을 강조·스크롤 */
export function optionHref(productId: string, variantId: string): string {
  return `/product/${productId}?opt=${encodeURIComponent(variantId)}`;
}
