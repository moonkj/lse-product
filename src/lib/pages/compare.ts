/**
 * 비교 화면(/compare) 파생 값 — 데이터 파일은 수정하지 않고 getData()·loadSpecs() 결과 위에서 계산만 한다.
 * 사양 값은 계산·합치기 없이 카탈로그 표기 그대로 나열한다.
 */
import { getData, type SpecsMap } from '../../data/load';
import { SPEC_KEYS, type DocRef, type EquipmentType, type Product, type SpecItem } from '../schema';
import { edgeKind, isBus, isEndpoint, type EdgeKind } from '../diagram/geometry';
import { hopsAcrossBus } from '../diagram/topology';
import { nodeForEquipment, productsForEquipment } from './catalog';
import { COMPARE_MAX, type CompareKind } from '../../store/useCompareStore';

export interface CompareParams {
  type: CompareKind | null;
  /** 데이터에 있는 id (중복 제거, 최대 4) */
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
  const exists = (id: string) => (type === 'equipment' ? data.equipmentTypeById.has(id) : data.productById.has(id));
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
}

/** 기기의 제품들 specs 를 표준 키별로 모은다 (값은 표기 그대로) */
export function equipmentSpecMap(eqId: string, specs: SpecsMap): Map<string, EquipmentSpecEntry[]> {
  const map = new Map<string, EquipmentSpecEntry[]>();
  for (const product of productsForEquipment(eqId)) {
    const s = specs.get(product.id);
    if (!s) continue;
    for (const item of s.items) {
      const list = map.get(item.key) ?? [];
      list.push({ product, item });
      map.set(item.key, list);
    }
  }
  return map;
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
