/**
 * 비교 화면(/compare) 파생 값 — 데이터 파일은 수정하지 않고 getData()·loadSpecs() 결과 위에서 계산만 한다.
 * 사양 값은 계산·합치기 없이 카탈로그 표기 그대로 나열한다.
 */
import { getData, type SpecsMap } from '../../data/load';
import { SPEC_KEYS, type DocRef, type EquipmentType, type Product, type ProductSpecs, type SpecItem, type SpecVariant } from '../schema';
import { edgeKind, isBus, isEndpoint, type EdgeKind } from '../diagram/geometry';
import { hopsAcrossBus } from '../diagram/topology';
import { nodeForEquipment, productsForEquipment } from './catalog';
import { COMPARE_MAX, compareIdInData, joinCompareId, splitCompareId, type CompareKind } from '../../store/useCompareStore';

/** 비교 항목 id 도우미 재수출 (제품 열 id = "제품id" 또는 "제품id:옵션id") */
export { joinCompareId, splitCompareId };

export interface CompareParams {
  type: CompareKind | null;
  /**
   * 데이터에 있는 id (중복 제거, 최대 4). 제품 비교에서는 열 id = "P00206" 또는 "P00206:4000af"(옵션) —
   * 중복 제거 기준도 이 조합이라 같은 제품의 다른 옵션 2개를 나란히 비교할 수 있다.
   * 옵션 id 가 사양에 실제로 있는지는 여기서 보지 않는다(사양 지연 로딩) → resolveProductColumn.
   */
  ids: string[];
  /** 데이터에 없어 제외한 id */
  missing: string[];
  /** 4개를 넘어 제외한 id */
  overflow: string[];
  /** type 값이 있는데 알 수 없는 종류 (안내용) */
  badType?: string;
}

export function parseCompareParams(params: URLSearchParams): CompareParams {
  const t = params.get('type')?.trim().toLowerCase() ?? '';
  const type: CompareKind | null = t === 'equipment' || t === 'product' ? t : null;
  // ids=a,b 와 ids=a&ids=b 를 모두 받는다
  const raw = [...new Set(params.getAll('ids').flatMap((v) => v.split(',')).map((s) => s.trim()).filter(Boolean))];
  if (!type) return { type, ids: [], missing: [], overflow: [], badType: t || undefined };
  const data = getData();
  const exists = (id: string) => compareIdInData(type, id, data);
  const valid = raw.filter(exists);
  return {
    type,
    ids: valid.slice(0, COMPARE_MAX),
    missing: raw.filter((id) => !exists(id)),
    overflow: valid.slice(COMPARE_MAX),
  };
}

// ───────────── 사양 ─────────────

const STANDARD_ORDER = Object.keys(SPEC_KEYS);

/** 사양 키 정렬: 표준 키(SPEC_KEYS 순서) 먼저, 그 외는 처음 나온 순서 */
export function orderSpecKeys(keys: Iterable<string>): string[] {
  const list = [...new Set(keys)];
  const rank = (k: string) => {
    const i = STANDARD_ORDER.indexOf(k);
    return i === -1 ? STANDARD_ORDER.length : i;
  };
  return list.map((k, i) => ({ k, i })).sort((a, b) => rank(a.k) - rank(b.k) || a.i - b.i).map((x) => x.k);
}

/** 행 이름: 표준 키는 SPEC_KEYS 라벨, 그 외는 데이터 label */
export function specLabel(key: string, fallback?: string): string {
  return (SPEC_KEYS as Record<string, string>)[key] ?? fallback ?? key;
}

/**
 * 화면 표기: 값 + 단위 (데이터는 바꾸지 않고 렌더링에서만 위치를 조정 — 2026-11-18 디버그 M4).
 * 데이터는 단위를 값 맨 끝에 붙이는 구조라 "110 (55~125) (PT 입력)" + "V" 가 "… (PT 입력) V" 로 읽힌다.
 * 규칙: 괄호 밖(깊이 0)에서 숫자 바로 뒤에 오는 괄호 주석 앞마다 단위를 넣고, 괄호 주석은 그 뒤로 둔다.
 *   "110 (55~125) (PT 입력)" V          → "110 V (55~125) (PT 입력)"
 *   "0.05~6 (5A), 0.01~1.2 (1A)" A      → "0.05~6 A (5A), 0.01~1.2 A (1A)"
 *   "690 (18·22AF) / 1000 (40AF 이상) (Ue)" V → "690 V (18·22AF) / 1000 V (40AF 이상) (Ue)"
 * 값이 괄호 밖 숫자로 끝나면 끝에도 단위. 괄호가 없거나 숫자 뒤 괄호가 하나도 없으면 원래대로 "값 단위".
 */
export function specValueText(it: Pick<SpecItem, 'value' | 'unit'>): string {
  const { value, unit } = it;
  if (!unit) return value;
  if (!value.includes('(')) return `${value} ${unit}`;
  let out = '';
  let depth = 0;
  let inserted = 0;
  /** 마지막 깊이 0 글자가 숫자이고 아직 그 숫자 뒤에 단위를 넣지 않았는가 */
  let afterNumber = false;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === '(') {
      // "40(10)" 처럼 숫자에 붙은 숫자 괄호는 계기 정격 표기라 한 덩어리로 둔다
      const meterStyle = /[0-9]$/.test(out) && /^\(\d+(?:\.\d+)?\)/.test(value.slice(i));
      if (depth === 0 && afterNumber && !meterStyle) {
        const trimmed = out.replace(/\s+$/, '');
        out = `${trimmed} ${unit}${out.slice(trimmed.length) || ' '}`;
        inserted += 1;
        afterNumber = false;
      }
      depth += 1;
    } else if (ch === ')') {
      depth = Math.max(0, depth - 1);
    } else if (depth === 0 && !/\s/.test(ch)) {
      afterNumber = /[0-9]/.test(ch);
    }
    out += ch;
  }
  if (afterNumber) {
    out = `${out.replace(/\s+$/, '')} ${unit}`;
    inserted += 1;
  }
  return inserted > 0 ? out : `${value} ${unit}`;
}

/**
 * "차이만 보기" 비교용 정규화 (화면 표기는 원문 그대로 — 2026-11-18 디버그 M3·L11).
 * 같은 의미를 다르게 적은 카탈로그 표기를 같은 값으로 본다:
 *  1. NFKC — 전각 숫자·기호·괄호를 반각으로 (～ → ~), 물결표 변형(〜·∼)도 ~ 로
 *  2. 대소문자 무시 — 단위 KA/kA, V/v 등
 *  3. 교류 전압 단위 통일 — "V AC"·"VAC"·"Vac" → "V" (정격전압의 V 는 교류가 기본. "V DC"·"VDC" 는 그대로 구분)
 *  4. 공백 전부 제거 — "50 / 60 Hz" = "50/60 Hz"
 *  5. 쉼표 목록 = 슬래시 목록 — "3, 4 P" = "3 / 4 P"
 *  6. 숫자만으로 된 목록은 크기 순 정렬 — "60, 50 Hz" = "50/60 Hz"
 * 숫자 크기·단위 환산(mA↔A 등)은 하지 않는다 (값이 다른 것으로 둔다).
 */
export function compareKey(text: string): string {
  let s = text.normalize('NFKC').replace(/[〜∼]/g, '~').toLowerCase();
  s = s.replace(/v\s*ac\b/g, 'v');
  s = s.replace(/\s+/g, '');
  s = s.replace(/,/g, '/');
  // 단위 앞 숫자 목록 정렬: "60/50hz" → "50/60hz"
  s = s.replace(/^(\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)+)(?=[^\d./~]|$)/, (list: string) =>
    list
      .split('/')
      .sort((a, b) => Number(a) - Number(b))
      .join('/'),
  );
  return s;
}

/** 카탈로그 페이지 링크 (PDF #page=N) */
export function pageHref(url: string, page?: number): string {
  return page ? `${url}#page=${page}` : url;
}

export interface EquipmentSpecEntry {
  product: Product;
  item: SpecItem;
  /** 옵션별 사양에서 온 값이면 그 옵션 ("제품명 · 옵션 label: 값" 으로 표시) */
  variant?: SpecVariant;
}

/**
 * 기기의 제품들 specs 를 표준 키별로 모은다 (값은 표기 그대로). 공통 사양 다음에 옵션별 사양을
 * 옵션 순서대로 하나씩 넣는다 — 옵션 값을 합치거나 범위로 계산하지 않는다.
 */
export function equipmentSpecMap(eqId: string, specs: SpecsMap): Map<string, EquipmentSpecEntry[]> {
  const map = new Map<string, EquipmentSpecEntry[]>();
  const push = (e: EquipmentSpecEntry) => {
    const list = map.get(e.item.key) ?? [];
    list.push(e);
    map.set(e.item.key, list);
  };
  for (const product of productsForEquipment(eqId)) {
    const s = specs.get(product.id);
    if (!s) continue;
    for (const item of s.items) push({ product, item });
    for (const variant of s.variants ?? []) for (const item of variant.items) push({ product, item, variant });
  }
  return map;
}

// ───────────── 사양 옵션 (variants) ─────────────

/** 사양의 옵션 찾기 (없거나 id 가 틀리면 undefined) */
export function findVariant(specs: ProductSpecs | undefined, variantId: string | undefined): SpecVariant | undefined {
  if (!specs || !variantId) return undefined;
  return specs.variants?.find((v) => v.id === variantId);
}

/** 옵션이 있는 사양인가 */
export function hasVariants(specs: ProductSpecs | undefined): specs is ProductSpecs & { variants: SpecVariant[] } {
  return !!specs?.variants && specs.variants.length > 0;
}

/** 열 머리·담기 목록 표시 이름: "제품명 · 옵션 label" (옵션 없으면 제품명) */
export function variantDisplayName(productName: string, variantLabel?: string): string {
  return variantLabel ? `${productName} · ${variantLabel}` : productName;
}

/** 사양 한 값 + 그 값이 어느 옵션에서 왔는지 + 링크할 카탈로그 페이지 */
export interface SpecEntry {
  item: SpecItem;
  /** 옵션별 사양에서 온 값이면 그 옵션 (공통 사양이면 undefined) */
  variant?: SpecVariant;
  /** 값의 페이지 → 없으면 옵션 표 페이지 (출처 페이지는 출처 행에서 따로 보여 줌) */
  page?: number;
}

const entryOf = (item: SpecItem, variant?: SpecVariant): SpecEntry => ({ item, variant, page: item.page ?? variant?.page });

/**
 * 비교 열 하나의 사양 (키 → 값 목록, 키는 처음 나온 순서 — 행 정렬은 orderSpecKeys 로).
 *  - 옵션 선택(variantId 가 있고 사양에 있음): 공통 items + 선택 옵션 items. 같은 key 는 **옵션 값 우선**
 *    (그 key 의 공통 값은 버림).
 *  - 시리즈 전체(variantId 없음·틀림): 공통 값 + 옵션마다 그 옵션의 값을 하나씩 (variant 표시) — 합치기·계산 없음.
 */
export function columnSpecEntries(specs: ProductSpecs, variantId?: string): Map<string, SpecEntry[]> {
  const map = new Map<string, SpecEntry[]>();
  const push = (e: SpecEntry) => {
    const list = map.get(e.item.key) ?? [];
    list.push(e);
    map.set(e.item.key, list);
  };
  const selected = findVariant(specs, variantId);
  if (selected) {
    const overridden = new Set(selected.items.map((i) => i.key));
    for (const item of specs.items) if (!overridden.has(item.key)) push(entryOf(item));
    for (const item of selected.items) push(entryOf(item, selected));
    return map;
  }
  for (const item of specs.items) push(entryOf(item));
  for (const v of specs.variants ?? []) for (const item of v.items) push(entryOf(item, v));
  return map;
}

/**
 * "차이만 보기" 비교 문자열.
 * series=true(시리즈 전체 열)면 옵션 값마다 옵션 label 을 붙인다 — "옵션 label: 값" 목록끼리, 또는 목록과 단일 옵션 값을 구분.
 * series=false(옵션 선택 열)면 값만 — 같은 제품의 다른 옵션끼리 같은 값(예: 정격전압 ~1150)은 같은 행으로 숨겨진다.
 */
export function specEntriesKey(entries: SpecEntry[], series = false): string {
  return entries.map((e) => `${series && e.variant ? `${compareKey(e.variant.label)}=` : ''}${compareKey(specValueText(e.item))}`).join('|');
}

export interface VariantSpecRow {
  key: string;
  label: string;
  /** 옵션 순서대로 — 그 옵션에 이 key 값이 없으면 빈 배열 ("—") */
  cells: SpecEntry[][];
}

/** 제품 상세 옵션별 사양 표: 행 = 옵션들에 나온 사양 키(SPEC_KEYS 순서 → 비표준), 열 = 옵션 */
export function variantSpecRows(specs: ProductSpecs): VariantSpecRow[] {
  const variants = specs.variants ?? [];
  const all = variants.flatMap((v) => v.items);
  return orderSpecKeys(all.map((i) => i.key)).map((key) => ({
    key,
    label: specLabel(key, all.find((i) => i.key === key)?.label),
    cells: variants.map((v) => v.items.filter((i) => i.key === key).map((i) => entryOf(i, v))),
  }));
}

export interface ResolvedProductColumn {
  /** 실제로 쓰는 열 id ("제품id" 또는 "제품id:옵션id") — 틀린 옵션은 제품 id 로 되돌림 */
  colId: string;
  productId: string;
  /** 선택된(그리고 사양에 있는) 옵션 */
  variant?: SpecVariant;
  /** URL 의 옵션 id 가 사양에 없어 "시리즈 전체"로 되돌렸으면 그 id */
  invalidVariantId?: string;
}

/**
 * URL 의 제품 열 id 를 사양과 맞춰 본다. specs 를 아직 못 불러왔으면(undefined 전달 + loaded=false) 검증하지 않고 그대로.
 * 옵션 id 가 사양에 없으면(사양 자체가 없거나 옵션이 없는 제품 포함) "시리즈 전체"로 되돌리고 invalidVariantId 로 알린다.
 */
export function resolveProductColumn(colId: string, specs: ProductSpecs | undefined, loaded: boolean): ResolvedProductColumn {
  const { baseId, variantId } = splitCompareId(colId);
  if (!variantId) return { colId: baseId, productId: baseId };
  if (!loaded) return { colId, productId: baseId };
  const variant = findVariant(specs, variantId);
  return variant ? { colId, productId: baseId, variant } : { colId: baseId, productId: baseId, invalidVariantId: variantId };
}

/** 사양이 수집된 제품 수 */
export function specProductCount(eqId: string, specs: SpecsMap): number {
  return productsForEquipment(eqId).filter((p) => specs.has(p.id)).length;
}

// ───────────── 자료 ─────────────

export const MAIN_DOC_TYPES: DocRef['type'][] = ['catalog', 'manual', 'datasheet'];

export type DocCounts = Record<DocRef['type'], number>;

export function countDocs(docs: DocRef[]): DocCounts {
  const c: DocCounts = { catalog: 0, datasheet: 0, manual: 0, certificate: 0, software: 0, cad: 0, other: 0 };
  for (const d of docs) c[d.type] += 1;
  return c;
}

export function productDocs(productId: string): DocRef[] {
  return getData().docsByProductId.get(productId)?.docs ?? [];
}

/** 기기의 제품 전체 자료 수 (유형별) */
export function equipmentDocCounts(eqId: string): DocCounts {
  return countDocs(productsForEquipment(eqId).flatMap((p) => productDocs(p.id)));
}

/** 대표 자료: 카탈로그 → 데이터시트 → 매뉴얼 → 첫 자료 */
export function representativeDoc(docs: DocRef[]): DocRef | undefined {
  for (const t of ['catalog', 'datasheet', 'manual'] as const) {
    const d = docs.find((x) => x.type === t);
    if (d) return d;
  }
  return docs[0];
}

// ───────────── 계통 연결 (topology 이웃 규칙 재사용) ─────────────

export interface LinkedItem {
  /** 기기면 id, 끝점이면 undefined */
  eq?: EquipmentType;
  label: string;
  kind: EdgeKind;
}

/**
 * 기기의 대표 노드에서 상류(in)·하류(out) 연결 기기. 모선은 건너뛰고 모선 너머 기기로(상세 패널·미니 체인과 같은 규칙).
 * 같은 기기는 한 번만, 끝점은 라벨로.
 */
export function linkedEquipment(eqId: string, dir: 'in' | 'out'): LinkedItem[] {
  const node = nodeForEquipment(eqId);
  if (!node) return [];
  const data = getData();
  const nodeById = new Map(data.diagram.nodes.map((n) => [n.id, n]));
  const isBusId = (id: string) => {
    const n = nodeById.get(id);
    return !!n && isBus(n);
  };
  const out: LinkedItem[] = [];
  const seen = new Set<string>();
  for (const h of hopsAcrossBus(node.id, data.diagram.edges, isBusId, dir)) {
    const n = nodeById.get(h.id);
    if (!n) continue;
    const kind = edgeKind(h.via?.edge ?? h.edge);
    if (isEndpoint(n)) {
      const key = `ep:${n.label}`;
      if (!seen.has(key) && n.label) out.push({ label: n.label, kind });
      seen.add(key);
      continue;
    }
    const eq = n.equipmentTypeId ? data.equipmentTypeById.get(n.equipmentTypeId) : undefined;
    if (!eq || eq.id === eqId || seen.has(eq.id)) continue;
    seen.add(eq.id);
    out.push({ eq, label: eq.abbr ?? eq.name, kind });
  }
  // 전력선 먼저, 신호선 뒤
  return out.map((x, i) => ({ x, i })).sort((a, b) => (a.x.kind === 'signal' ? 1 : 0) - (b.x.kind === 'signal' ? 1 : 0) || a.i - b.i).map((v) => v.x);
}
