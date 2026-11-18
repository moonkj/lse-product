/**
 * 비교 화면(/compare) 파생 값 — 데이터 파일·load.ts 는 수정하지 않고 getData() 위에서 계산만 한다.
 * 사양 값은 계산·합치기 없이 카탈로그 표기 그대로 나열한다.
 */
import { getData } from '../../data/load';
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
}

export function parseCompareParams(params: URLSearchParams): CompareParams {
  const t = params.get('type');
  const type: CompareKind | null = t === 'equipment' || t === 'product' ? t : null;
  const raw = [...new Set((params.get('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean))];
  if (!type) return { type, ids: [], missing: [], overflow: [] };
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

export const specValueText = (it: Pick<SpecItem, 'value' | 'unit'>) => (it.unit ? `${it.value} ${it.unit}` : it.value);

/** 카탈로그 페이지 링크 (PDF #page=N) */
export function pageHref(url: string, page?: number): string {
  return page ? `${url}#page=${page}` : url;
}

export interface EquipmentSpecEntry {
  product: Product;
  item: SpecItem;
}

/** 기기의 제품들 specs 를 표준 키별로 모은다 (값은 표기 그대로) */
export function equipmentSpecMap(eqId: string): Map<string, EquipmentSpecEntry[]> {
  const specs = getData().specsByProductId;
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
export function specProductCount(eqId: string): number {
  const specs = getData().specsByProductId;
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
