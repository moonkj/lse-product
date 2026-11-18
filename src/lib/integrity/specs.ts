/**
 * 정격 사양 specs.json 규칙 (DI-90 ~ DI-99b) — tests/unit/data-integrity.test.ts checkSpecs() 의 TS 공용 포팅.
 * 관리자 "사양 검수" 내보내기 전 검사가 이 함수를 쓰고, DI 테스트도 이 함수로 전환할 수 있다(같은 규칙 ID·같은 판정).
 *
 * - DI-90  SpecsFileSchema 통과 (옵션 개수·id·variantAxis 처럼 아래 규칙이 더 구체적으로 알리는 스키마 이슈는 생략)
 * - DI-91  productId ∈ products.json
 * - DI-92  source.url ∈ 그 제품 docs.json 의 doc.url
 * - DI-93  key 중복 없음: 공통 안·옵션 안, 공통↔옵션 겹침 금지 (옵션끼리 같은 key 는 정상)
 * - DI-94  표준 key 의 label = SPEC_KEYS 라벨
 * - DI-95  비표준 key: 파일 전체에서 같은 key = 같은 label / DI-95b 같은 label = 같은 key (표준 라벨 포함)
 * - DI-96  개수: 공통 0~10, 옵션당 1~10, 공통+옵션 ≥ 1, label·value 공백 아님
 * - DI-96b 옵션 id kebab-case·제품 안 고유 / DI-96c 옵션 있으면 variantAxis
 * - DI-96d (SOFT) 옵션 ≤ 8 / DI-96e (SOFT) 옵션 label 고유
 * - DI-97  값마다 페이지 추적 가능 (item.page ?? variant.page ?? source.page)
 * - DI-98  extractedAt 실제 날짜 + 미래 아님(KST), generatedAt 날짜로 파싱됨
 * - DI-99b 개인정보 의심 패턴 0건 (title·url·label·value·unit·note·variantAxis)
 */
import type { z } from 'zod';
import { SPEC_KEYS, SpecsFileSchema, type SpecItem, type SpecsFile } from '../schema';
import { todayIso } from '../labels';
import { Collector, EMAIL_RE, PHONE_RE, ROUTE_ID_RE, duplicates, isRealDate, koIssue, pathText, type CheckResult } from './types';

/** 공통 items·옵션당 items 상한 */
export const SPEC_ITEMS_MAX = 10;
/** 옵션 수 권장 상한 (SOFT) */
export const SPEC_VARIANTS_MAX = 8;
/** 옵션 id 형식 (URL "제품:옵션") */
export const SPEC_VARIANT_ID_RE = ROUTE_ID_RE;

export const SPEC_RULES: { id: string; severity: 'error' | 'warning'; title: string }[] = [
  { id: 'DI-90', severity: 'error', title: 'specs.json 스키마(Zod) 통과' },
  { id: 'DI-91', severity: 'error', title: '사양 제품 id 존재' },
  { id: 'DI-92', severity: 'error', title: '출처 URL = 그 제품 docs.json 자료' },
  { id: 'DI-93', severity: 'error', title: 'key 중복 없음 (공통↔옵션 겹침 금지)' },
  { id: 'DI-94', severity: 'error', title: '표준 key label = SPEC_KEYS' },
  { id: 'DI-95', severity: 'error', title: '같은 key = 같은 label' },
  { id: 'DI-95b', severity: 'error', title: '같은 label = 같은 key' },
  { id: 'DI-96', severity: 'error', title: '항목 개수·label·value 공백 아님' },
  { id: 'DI-96b', severity: 'error', title: '옵션 id kebab-case·고유' },
  { id: 'DI-96c', severity: 'error', title: '옵션 있으면 variantAxis' },
  { id: 'DI-96d', severity: 'warning', title: `옵션 ≤ ${SPEC_VARIANTS_MAX}개 권장` },
  { id: 'DI-96e', severity: 'warning', title: '옵션 label 고유' },
  { id: 'DI-97', severity: 'error', title: '값마다 페이지 추적 가능' },
  { id: 'DI-98', severity: 'error', title: '추출일·생성일 날짜' },
  { id: 'DI-99b', severity: 'error', title: '개인정보 의심 패턴 없음' },
];
const SOFT = new Set(SPEC_RULES.filter((r) => r.severity === 'warning').map((r) => r.id));

export interface SpecsInput {
  /** specs.json (raw) */
  specs: unknown;
  productIds: ReadonlySet<string>;
  /** 제품 id → docs.json 자료 URL 목록 */
  docUrlsByProduct: ReadonlyMap<string, readonly string[]>;
  /** 오늘 YYYY-MM-DD (기본: KST 오늘) — DI-98 */
  today?: string;
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** 아래 의미 규칙이 같은 내용을 더 구체적으로 알리는 스키마 이슈 (중복 표시 방지) */
function coveredBySemantic(i: z.core.$ZodIssue): boolean {
  if (i.code === 'custom') return true; // superRefine: 개수·variantAxis·옵션 id 중복 → DI-96·96c·96b
  const last = i.path[i.path.length - 1];
  if (i.path.includes('variants') && last === 'id' && i.code === 'invalid_format') return true; // DI-96b
  if (i.code === 'too_small' && (last === 'items' || last === 'value' || last === 'label')) return true; // DI-96
  return false;
}

/** specs.json 전체 검사 (HARD = errors, SOFT = warnings) */
export function checkSpecs(input: SpecsInput): CheckResult {
  const c = new Collector();
  const today = input.today ?? todayIso();
  const raw = input.specs;
  const add = (rule: string, message: string, refs: { productId?: string; variantId?: string; specKey?: string } = {}) =>
    SOFT.has(rule) ? c.warn(rule, message, refs) : c.error(rule, message, refs);

  const parsed = SpecsFileSchema.safeParse(raw);
  if (!parsed.success)
    for (const i of parsed.error.issues) {
      if (coveredBySemantic(i)) continue;
      const pid = i.path[0] === 'products' && typeof i.path[1] === 'string' ? i.path[1] : undefined;
      c.error('DI-90', `specs.json [${pathText(i.path)}] ${koIssue(i)}`, { productId: pid });
    }
  if (!raw || typeof raw !== 'object' || !(raw as SpecsFile).products || typeof (raw as SpecsFile).products !== 'object') {
    if (parsed.success) c.error('DI-90', 'specs.json: products 객체가 없습니다');
    return c.result();
  }
  const file = raw as SpecsFile;

  c.run('DI-98', () => {
    if (Number.isNaN(Date.parse(file.generatedAt))) add('DI-98', `generatedAt 날짜 아님: ${file.generatedAt}`);
  });
  const labelOfKey = new Map<string, { label: string; where: string }>();
  const keyOfLabel = new Map<string, { key: string; where: string }>();
  for (const [k, l] of Object.entries(SPEC_KEYS as Record<string, string>)) keyOfLabel.set(l, { key: k, where: 'SPEC_KEYS' });
  const std = SPEC_KEYS as Record<string, string>;

  for (const [id, s] of Object.entries(file.products)) {
    c.run('DI-90', () => {
      const P = { productId: id };
      const items = Array.isArray(s.items) ? s.items : [];
      const variants = Array.isArray(s.variants) ? s.variants : [];
      if (!input.productIds.has(id)) add('DI-91', `${id}: products.json 에 없는 제품`, P);
      if (!(input.docUrlsByProduct.get(id) ?? []).includes(s.source?.url)) add('DI-92', `${id}: source.url 이 그 제품 docs.json 자료가 아님 (${s.source?.url})`, P);
      if (items.length > SPEC_ITEMS_MAX) add('DI-96', `${id}: 공통 items ${items.length}개 (0~${SPEC_ITEMS_MAX})`, P);
      if (items.length === 0 && variants.length === 0) add('DI-96', `${id}: 공통·옵션 사양이 모두 없음`, P);
      for (const v of variants)
        if (v.items.length < 1 || v.items.length > SPEC_ITEMS_MAX)
          add('DI-96', `${id}:${v.id}: 옵션 items ${v.items.length}개 (1~${SPEC_ITEMS_MAX})`, { ...P, variantId: v.id });
      if (variants.length > 0 && !s.variantAxis?.trim()) add('DI-96c', `${id}: 옵션이 있는데 variantAxis 없음`, P);
      for (const v of variants) if (!SPEC_VARIANT_ID_RE.test(v.id)) add('DI-96b', `${id}: 옵션 id "${v.id}" 가 kebab-case 아님`, { ...P, variantId: v.id });
      for (const d of duplicates(variants.map((v) => v.id))) add('DI-96b', `${id}: 옵션 id 중복 ${d}`, { ...P, variantId: d });
      if (variants.length > SPEC_VARIANTS_MAX)
        add('DI-96d', `${id}: 옵션 ${variants.length}개 (권장 ≤ ${SPEC_VARIANTS_MAX} — 비교 select·상세 표가 길어짐)`, P);
      for (const d of duplicates(variants.map((v) => v.label.trim()))) add('DI-96e', `${id}: 옵션 label 중복 "${d}" (select 에서 구분 불가)`, P);
      if (!isRealDate(s.extractedAt)) add('DI-98', `${id}: extractedAt 없는 날짜 ${s.extractedAt}`, P);
      else if (s.extractedAt > today) add('DI-98', `${id}: extractedAt 미래 ${s.extractedAt}`, P);

      const commonKeys = new Set(items.map((i) => i.key));
      for (const k of duplicates(items.map((i) => i.key))) add('DI-93', `${id}: 공통 key 중복 ${k}`, { ...P, specKey: k });
      for (const v of variants) {
        for (const k of duplicates(v.items.map((i) => i.key))) add('DI-93', `${id}:${v.id}: 옵션 안 key 중복 ${k}`, { ...P, variantId: v.id, specKey: k });
        for (const i of v.items)
          if (commonKeys.has(i.key)) add('DI-93', `${id}:${v.id}: key ${i.key} 가 공통 사양과 겹침`, { ...P, variantId: v.id, specKey: i.key });
      }

      const texts = [s.source?.title ?? '', decodeSafe(s.source?.url ?? ''), s.note ?? '', s.variantAxis ?? ''];
      const all: { it: SpecItem; where: string; vid?: string; vPage?: number }[] = [
        ...items.map((it) => ({ it, where: id })),
        ...variants.flatMap((v) => {
          texts.push(v.label, v.note ?? '');
          return v.items.map((it) => ({ it, where: `${id}:${v.id}`, vid: v.id, vPage: v.page }));
        }),
      ];
      for (const { it, where, vid, vPage } of all) {
        const R = { ...P, variantId: vid, specKey: it.key };
        texts.push(it.label, it.value, it.unit ?? '');
        if (!it.label.trim() || !it.value.trim()) add('DI-96', `${where}/${it.key}: label·value 공백`, R);
        if (!(it.page ?? vPage ?? s.source?.page)) add('DI-97', `${where}/${it.key}: 페이지 없음 (item·옵션·source 모두 없음)`, R);
        const stdLabel = std[it.key];
        if (stdLabel !== undefined) {
          if (it.label !== stdLabel) add('DI-94', `${where}/${it.key}: label "${it.label}" ≠ SPEC_KEYS "${stdLabel}"`, R);
        } else {
          const prev = labelOfKey.get(it.key);
          if (prev && prev.label !== it.label) add('DI-95', `key ${it.key}: label "${prev.label}"(${prev.where}) ≠ "${it.label}"(${where})`, R);
          if (!prev) labelOfKey.set(it.key, { label: it.label, where });
        }
        const pk = keyOfLabel.get(it.label);
        if (pk && pk.key !== it.key) add('DI-95b', `label "${it.label}": key ${pk.key}(${pk.where}) ≠ ${it.key}(${where})`, R);
        if (!pk) keyOfLabel.set(it.label, { key: it.key, where });
      }
      for (const f of texts) {
        if (EMAIL_RE.test(f)) add('DI-99b', `${id}: 이메일 의심 "${f}"`, P);
        if (PHONE_RE.test(f)) add('DI-99b', `${id}: 전화번호 의심 "${f}"`, P);
      }
    });
  }
  return c.result();
}

/**
 * 파일 전체에서 key → label 사전 (항목 추가 폼: 기존 key 를 고르면 label 자동, DI-94·95·95b 예방).
 * 표준 키(SPEC_KEYS)가 먼저, 그다음 파일에 나온 순서.
 */
export function specKeyLabels(file: SpecsFile): Map<string, string> {
  const m = new Map<string, string>(Object.entries(SPEC_KEYS as Record<string, string>));
  for (const s of Object.values(file.products))
    for (const it of [...s.items, ...(s.variants ?? []).flatMap((v) => v.items)]) if (!m.has(it.key)) m.set(it.key, it.label);
  return m;
}
