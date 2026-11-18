/**
 * 관리자 "사양 검수" — specs.json 초안 편집 연산(순수 함수) + 변경 내역·요약.
 * 원본 키 순서를 유지한다(기존 객체를 펼쳐 고치고, 새 키는 뒤에) → 내보낸 파일 diff 가 실제 변경만 보이게.
 */
import type { SpecItem, SpecVariant, SpecsFile } from '../schema';
import { SPEC_VARIANT_ID_RE, EMAIL_RE, PHONE_RE } from '../integrity';

export type ProductSpecsRaw = SpecsFile['products'][string];

/** 공통 사양이면 variantId 없음 */
export interface SpecScope {
  productId: string;
  variantId?: string;
}

export interface SpecOpResult {
  file: SpecsFile;
  error?: string;
}

/**
 * docs/research/specs-extraction.md "사람 검수 우선 (판단 필요)" 제품 — 목록 배지·사유 표시.
 */
export const SPEC_REVIEW_PRIORITY: Record<string, string> = {
  P02212: '통신: 정격표(p12) "RS-485 : Modbus" vs 통신기능(p11) 값 — 최종 판단 필요',
  P00206: '변형 카탈로그(1150Vac판) 값 — 표준 제품 사양으로 노출해도 되는지 판단 필요',
  P01021: '변형 카탈로그(1000Vac UTV판) 값 — 표준 제품 사양으로 노출해도 되는지 판단 필요',
  P01065: '모델별 정격전류 열 구분을 텍스트 순서로 읽음 — 원문 표와 열 대조 필요',
  P01027: '125AF 정격전류(줄바꿈된 셀) — 원문 표와 열 대조 필요',
  P01260: '각 프레임 Ue 매핑 — 원문 표와 열 대조 필요',
  P01084: 'p6 자동역률 제어장치(APFC) 정격표 값 — 본품 정격으로 써도 되는지 확인 필요',
};

export const cloneSpecs = (f: SpecsFile): SpecsFile => JSON.parse(JSON.stringify(f)) as SpecsFile;

/** 검수 기록 문구 (note 끝에 붙임) */
export const reviewStamp = (dept: string, date: string) => `검수: ${dept.trim()} ${date}`;
// 부서명에 '·' 가 들어갈 수 있으므로(reviewerError 허용) 부서 부분은 '·' 제외가 아닌 최소 일치로 (B3)
const STAMP_RE = /(?:^| · )검수: .+? \d{4}-\d{2}-\d{2}$/;

/** 검수자 = 부서명 (개인 실명·연락처 금지) — DI-27h 와 같은 기준. 문제 없으면 undefined */
export function reviewerError(dept: string): string | undefined {
  const d = dept.trim();
  if (!d) return '검수자 부서명을 입력하세요';
  if (EMAIL_RE.test(d) || PHONE_RE.test(d)) return '이메일·전화번호는 적지 마세요 — 부서명만 적습니다';
  if (!/(부|팀|소|실|센터|사업|그룹)/.test(d)) return '부서명(예: 품질보증팀, 기술영업부)으로 적으세요 — 개인 실명은 적지 않습니다';
  if (d.length > 40) return '부서명은 40자 이내로 적으세요';
  return undefined;
}

function withProduct(f: SpecsFile, id: string, fn: (p: ProductSpecsRaw) => ProductSpecsRaw | string): SpecOpResult {
  const p = f.products[id];
  if (!p) return { file: f, error: `제품 ${id} 의 사양이 없습니다` };
  const r = fn(JSON.parse(JSON.stringify(p)) as ProductSpecsRaw);
  if (typeof r === 'string') return { file: f, error: r };
  return { file: { ...f, products: { ...f.products, [id]: r } } };
}

const itemsOf = (p: ProductSpecsRaw, vid?: string): SpecItem[] | undefined =>
  vid === undefined ? p.items : p.variants?.find((v) => v.id === vid)?.items;

const scopeName = (s: SpecScope) => (s.variantId ? `옵션 ${s.variantId}` : '공통 사양');

/** 같은 범위 안 key 중복 + 공통↔옵션 겹침 (DI-93 예방) */
function keyConflict(p: ProductSpecsRaw, vid: string | undefined, key: string): string | undefined {
  if ((itemsOf(p, vid) ?? []).some((i) => i.key === key)) return `${vid ? `옵션 ${vid}` : '공통 사양'}에 이미 key "${key}" 가 있습니다`;
  if (vid === undefined) {
    const v = (p.variants ?? []).find((x) => x.items.some((i) => i.key === key));
    if (v) return `key "${key}" 는 옵션 ${v.id} 에 있습니다 — 공통 사양과 옵션에 같은 key 를 둘 수 없습니다`;
  } else if (p.items.some((i) => i.key === key)) return `key "${key}" 는 공통 사양에 있습니다 — 공통 사양과 옵션에 같은 key 를 둘 수 없습니다`;
  return undefined;
}

/** 입력 정리: 빈 단위·페이지는 필드 삭제, 페이지는 양의 정수 */
function normalizeItem(base: SpecItem, patch: Partial<Record<keyof SpecItem, string | number | undefined>>): SpecItem | string {
  const next: Record<string, unknown> = { ...base };
  for (const [k, raw] of Object.entries(patch)) {
    const v = typeof raw === 'string' ? raw.trim() : raw;
    if (k === 'page') {
      if (v === '' || v === undefined) delete next.page;
      else {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1) return '페이지는 1 이상의 정수입니다';
        next.page = n;
      }
    } else if (k === 'unit') {
      if (!v) delete next.unit;
      else next.unit = v;
    } else {
      if (!v) return `${k === 'key' ? 'key' : k === 'label' ? '항목 이름(label)' : '값(value)'}은 비워 둘 수 없습니다`;
      next[k] = v;
    }
  }
  return next as SpecItem;
}

export function updateItem(f: SpecsFile, s: SpecScope, key: string, patch: Partial<Record<keyof SpecItem, string | number | undefined>>): SpecOpResult {
  return withProduct(f, s.productId, (p) => {
    const items = itemsOf(p, s.variantId);
    const idx = items?.findIndex((i) => i.key === key) ?? -1;
    if (!items || idx < 0) return `${scopeName(s)}에 key "${key}" 가 없습니다`;
    const next = normalizeItem(items[idx], patch);
    if (typeof next === 'string') return next;
    if (next.key !== key) {
      const c = keyConflict(p, s.variantId, next.key);
      if (c) return c;
    }
    items[idx] = next;
    return p;
  });
}

export function addItem(f: SpecsFile, s: SpecScope, input: { key: string; label: string; value: string; unit?: string; page?: string | number }): SpecOpResult {
  const key = input.key.trim();
  if (!key) return { file: f, error: 'key 를 입력하세요' };
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(key)) return { file: f, error: 'key 는 영문 camelCase 로 적으세요 (예: ratedVoltage)' };
  return withProduct(f, s.productId, (p) => {
    const items = itemsOf(p, s.variantId);
    if (!items) return `옵션 ${s.variantId} 가 없습니다`;
    const c = keyConflict(p, s.variantId, key);
    if (c) return c;
    const item = normalizeItem({ key, label: '', value: '' }, { label: input.label, value: input.value, unit: input.unit, page: input.page });
    if (typeof item === 'string') return item;
    items.push(item);
    return p;
  });
}

export function deleteItem(f: SpecsFile, s: SpecScope, key: string): SpecOpResult {
  return withProduct(f, s.productId, (p) => {
    const items = itemsOf(p, s.variantId);
    const idx = items?.findIndex((i) => i.key === key) ?? -1;
    if (!items || idx < 0) return `${scopeName(s)}에 key "${key}" 가 없습니다`;
    items.splice(idx, 1);
    return p;
  });
}

/** 옵션 추가 — 첫 항목은 다음에 추가 (항목 0개 옵션은 검사에서 DI-96 오류로 내보내기를 막는다) */
export function addVariant(f: SpecsFile, productId: string, input: { id: string; label: string; page?: string | number; axis?: string }): SpecOpResult {
  const id = input.id.trim();
  const label = input.label.trim();
  if (!SPEC_VARIANT_ID_RE.test(id)) return { file: f, error: '옵션 id 는 영문 소문자·숫자·하이픈(kebab-case)입니다 (예: 4000af, 24kv)' };
  if (!label) return { file: f, error: '옵션 이름을 입력하세요' };
  return withProduct(f, productId, (p) => {
    const variants = p.variants ?? [];
    if (variants.some((v) => v.id === id)) return `옵션 id "${id}" 가 이미 있습니다`;
    if (variants.some((v) => v.label.trim() === label)) return `옵션 이름 "${label}" 이 이미 있습니다`;
    const axis = input.axis?.trim();
    if (!p.variantAxis?.trim() && !axis) return '옵션 기준 이름(variantAxis, 예: 프레임)을 입력하세요';
    const v: Record<string, unknown> = { id, label };
    if (input.page !== undefined && input.page !== '') {
      const n = Number(input.page);
      if (!Number.isInteger(n) || n < 1) return '페이지는 1 이상의 정수입니다';
      v.page = n;
    }
    v.items = [];
    if (!p.variantAxis?.trim()) p.variantAxis = axis;
    p.variants = [...variants, v as SpecVariant];
    return p;
  });
}

export function renameVariant(f: SpecsFile, productId: string, vid: string, label: string): SpecOpResult {
  const l = label.trim();
  if (!l) return { file: f, error: '옵션 이름은 비워 둘 수 없습니다' };
  return withProduct(f, productId, (p) => {
    const v = p.variants?.find((x) => x.id === vid);
    if (!v) return `옵션 ${vid} 가 없습니다`;
    if (p.variants!.some((x) => x.id !== vid && x.label.trim() === l)) return `옵션 이름 "${l}" 이 이미 있습니다`;
    v.label = l;
    return p;
  });
}

export function updateVariantPage(f: SpecsFile, productId: string, vid: string, page: string): SpecOpResult {
  return withProduct(f, productId, (p) => {
    const v = p.variants?.find((x) => x.id === vid) as (SpecVariant & { page?: number }) | undefined;
    if (!v) return `옵션 ${vid} 가 없습니다`;
    if (!page.trim()) delete v.page;
    else {
      const n = Number(page);
      if (!Number.isInteger(n) || n < 1) return '페이지는 1 이상의 정수입니다';
      v.page = n;
    }
    return p;
  });
}

/** 옵션 삭제 — 마지막 옵션이면 variants·variantAxis 도 지운다 */
export function deleteVariant(f: SpecsFile, productId: string, vid: string): SpecOpResult {
  return withProduct(f, productId, (p) => {
    const variants = p.variants ?? [];
    if (!variants.some((v) => v.id === vid)) return `옵션 ${vid} 가 없습니다`;
    const rest = variants.filter((v) => v.id !== vid);
    if (rest.length === 0 && p.items.length === 0) return '공통 사양이 없어 마지막 옵션은 지울 수 없습니다 — 공통 사양을 먼저 추가하세요';
    if (rest.length > 0) p.variants = rest;
    else {
      delete p.variants;
      delete p.variantAxis;
    }
    return p;
  });
}

export function setVariantAxis(f: SpecsFile, productId: string, axis: string): SpecOpResult {
  return withProduct(f, productId, (p) => {
    const a = axis.trim();
    if (!a && (p.variants?.length ?? 0) > 0) return '옵션이 있으면 옵션 기준 이름(variantAxis)이 필요합니다';
    if (a) p.variantAxis = a;
    else delete p.variantAxis;
    return p;
  });
}

/**
 * 검수 완료/해제. 완료 → reviewed=true + note 끝에 "검수: {부서} {날짜}" (부서명 필수).
 * 해제 → reviewed=false + 마지막 검수 기록 문구 제거.
 */
export function setReviewed(f: SpecsFile, productId: string, reviewed: boolean, dept = '', date = ''): SpecOpResult {
  if (reviewed) {
    const err = reviewerError(dept);
    if (err) return { file: f, error: err };
  }
  return withProduct(f, productId, (p) => {
    const note = (p.note ?? '').replace(STAMP_RE, '');
    if (reviewed) {
      p.reviewed = true;
      p.note = note ? `${note} · ${reviewStamp(dept, date)}` : reviewStamp(dept, date);
    } else {
      p.reviewed = false;
      if (note) p.note = note;
      else delete p.note;
    }
    return p;
  });
}

// ───────────── 변경 내역 ─────────────

export type SpecChangeKind = 'added' | 'modified' | 'deleted' | 'reviewed' | 'unreviewed';
export interface SpecChange {
  productId: string;
  kind: SpecChangeKind;
  /** 사람이 읽는 한 줄 (제품 이름 제외) */
  text: string;
}
export const SPEC_KIND_LABELS: Record<SpecChangeKind, string> = {
  added: '추가',
  modified: '수정',
  deleted: '삭제',
  reviewed: '검수 완료',
  unreviewed: '검수 해제',
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const itemText = (i: SpecItem) => `${i.label} ${i.value}${i.unit ? ` ${i.unit}` : ''}${i.page ? ` (p.${i.page})` : ''}`;
const sameItem = (a: SpecItem, b: SpecItem) => a.label === b.label && a.value === b.value && a.unit === b.unit && a.page === b.page;

function itemChanges(out: SpecChange[], productId: string, where: string, b: SpecItem[], d: SpecItem[]) {
  const bm = new Map(b.map((i) => [i.key, i]));
  const dm = new Map(d.map((i) => [i.key, i]));
  for (const [k, i] of dm) {
    const o = bm.get(k);
    if (!o) out.push({ productId, kind: 'added', text: `${where} 항목 ${k}: ${itemText(i)}` });
    else if (!sameItem(o, i)) out.push({ productId, kind: 'modified', text: `${where} 항목 ${k}: ${itemText(o)} → ${itemText(i)}` });
  }
  for (const [k, o] of bm) if (!dm.has(k)) out.push({ productId, kind: 'deleted', text: `${where} 항목 ${k}: ${itemText(o)}` });
}

export function computeSpecChanges(base: SpecsFile, draft: SpecsFile): SpecChange[] {
  const out: SpecChange[] = [];
  for (const [id, d] of Object.entries(draft.products)) {
    const b = base.products[id];
    if (!b) {
      out.push({ productId: id, kind: 'added', text: '제품 사양 추가' });
      continue;
    }
    if (same(b, d)) continue;
    if (b.reviewed !== d.reviewed) {
      const stamp = d.note?.match(/검수: .+? \d{4}-\d{2}-\d{2}$/)?.[0];
      out.push({
        productId: id,
        kind: d.reviewed ? 'reviewed' : 'unreviewed',
        text: d.reviewed ? `검수 완료 전환${stamp ? ` (${stamp})` : ''}` : '검수 해제 (검수 전으로)',
      });
    }
    if ((b.variantAxis ?? '') !== (d.variantAxis ?? '')) out.push({ productId: id, kind: 'modified', text: `옵션 기준: ${b.variantAxis ?? '없음'} → ${d.variantAxis ?? '없음'}` });
    const strip = (n?: string) => (n ?? '').replace(STAMP_RE, '');
    if (strip(b.note) !== strip(d.note)) out.push({ productId: id, kind: 'modified', text: '메모(note) 수정' });
    itemChanges(out, id, '공통', b.items, d.items);
    const bv = new Map((b.variants ?? []).map((v) => [v.id, v]));
    const dv = new Map((d.variants ?? []).map((v) => [v.id, v]));
    for (const [vid, v] of dv) {
      const o = bv.get(vid);
      if (!o) {
        out.push({ productId: id, kind: 'added', text: `옵션 ${vid} "${v.label}" (항목 ${v.items.length}개)` });
        continue;
      }
      if (o.label !== v.label) out.push({ productId: id, kind: 'modified', text: `옵션 ${vid} 이름: "${o.label}" → "${v.label}"` });
      if (o.page !== v.page) out.push({ productId: id, kind: 'modified', text: `옵션 ${vid} 페이지: ${o.page ?? '없음'} → ${v.page ?? '없음'}` });
      itemChanges(out, id, `옵션 ${vid}`, o.items, v.items);
    }
    for (const [vid, o] of bv) if (!dv.has(vid)) out.push({ productId: id, kind: 'deleted', text: `옵션 ${vid} "${o.label}" (항목 ${o.items.length}개)` });
  }
  for (const id of Object.keys(base.products)) if (!draft.products[id]) out.push({ productId: id, kind: 'deleted', text: '제품 사양 삭제' });
  return out;
}

/** 변경요약.md 의 사양 절 (제목 줄 없이 본문만). 변경 없으면 빈 배열 */
export function specChangesSection(changes: SpecChange[], nameOf: (id: string) => string, draft: SpecsFile): string[] {
  if (changes.length === 0) return [];
  const total = Object.keys(draft.products).length;
  const reviewed = Object.values(draft.products).filter((p) => p.reviewed).length;
  const lines = [`## 정격 사양 (specs.json)`, `결과: 사양 제품 ${total}개 · 검수 완료 ${reviewed}개 · 검수 전 ${total - reviewed}개`, ''];
  const ids = [...new Set(changes.map((c) => c.productId))];
  for (const id of ids) {
    lines.push(`### ${nameOf(id)} (${id})`);
    for (const c of changes.filter((x) => x.productId === id)) lines.push(`- ${SPEC_KIND_LABELS[c.kind]}: ${c.text}`);
    lines.push('');
  }
  return lines;
}

/** 사양만 내보낼 때의 변경요약.md */
export function specChangesMarkdown(changes: SpecChange[], nameOf: (id: string) => string, draft: SpecsFile): string {
  const nReviewed = new Set(changes.filter((c) => c.kind === 'reviewed').map((c) => c.productId)).size;
  const nEdit = changes.filter((c) => c.kind !== 'reviewed' && c.kind !== 'unreviewed').length;
  const parts = [nReviewed ? `검수 완료 ${nReviewed}개 제품` : '', nEdit ? `사양 수정 ${nEdit}건` : ''].filter(Boolean);
  return [
    `data: 정격 사양 검수 (${parts.join(', ') || '변경 없음'})`,
    '',
    '관리자 화면(/#/admin) "사양 검수" 탭에서 공개 카탈로그와 대조해 편집',
    '',
    ...specChangesSection(changes, nameOf, draft),
  ].join('\n');
}
