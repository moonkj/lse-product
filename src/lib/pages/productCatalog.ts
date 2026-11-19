/**
 * 제품 조회 (/products) — 제품 목록을 기기·단계·전압 등급과 묶고, 검색·필터·정렬한다. 순수 함수 (화면·테스트 공용).
 * 원본은 기존 데이터뿐: products.json · equipment-types.json(기기 → 제품 연결 resolveProducts) · stages.json · specs.json.
 */
import type { AppData, SpecsMap } from '../../data/load';
import { resolveProducts } from '../../data/load';
import type { EquipmentType, Layer, Product, ProductSource } from '../schema';
import { PRODUCT_SOURCE_LABELS } from '../schema';
import { normalizeModel } from '../search';
import { MONITORING_LABEL, MONITORING_LAYER, STAGE_DEFS, stageOf } from '../stages';
import { csvCell } from './catalog';

export type VoltageClass = 'ehv' | 'mv' | 'lv' | 'system';
export const VOLTAGE_LABELS: Record<VoltageClass, string> = {
  ehv: '초고압·송변전 (154kV 이상)',
  mv: '특고압·고압 (22.9·6.6kV)',
  lv: '저압 (1kV 이하)',
  system: '시스템·신재생·감시',
};
export const VOLTAGE_ORDER: VoltageClass[] = ['ehv', 'mv', 'lv', 'system'];

/** 기기 계층 → 전압 등급 (변압 L5 는 1차 특고압·2차 저압이라 둘 다) */
export function voltageOfLayer(layer: Layer): VoltageClass[] {
  switch (layer) {
    case 'L1':
    case 'L2':
      return ['ehv'];
    case 'L3':
    case 'L4':
      return ['mv'];
    case 'L5':
      return ['mv', 'lv'];
    case 'L6':
    case 'L7':
      return ['lv'];
    default:
      return ['system'];
  }
}

export const BUSINESS_LABELS: Record<Product['business'], string> = { power: '전력', automation: '자동화' };
export const SOURCE_ORDER: ProductSource[] = ['ko', 'en', 'ssq', 'us'];

export interface ProductRow {
  product: Product;
  source: ProductSource;
  /** 이 제품이 연결된 기기 (계통도 순서) */
  equipment: EquipmentType[];
  /** 기기 단계 id = 단계별 보기 열 (L1·L2·L3·customer·REN·MON) */
  stages: string[];
  voltages: VoltageClass[];
  /** 북미 UL 제품 (미국 법인 출처 또는 이름에 UL) */
  ul: boolean;
  /** 정격 사양 등록 여부 */
  hasSpecs: boolean;
  /** 검색용 정규화 문자열 */
  haystack: string;
  /** 계통 순서 정렬 키 (첫 기기의 계통도 순서, 기기 없으면 뒤) */
  order: number;
}

export function buildProductRows(data: AppData, specs?: SpecsMap): ProductRow[] {
  const eqByProduct = new Map<string, EquipmentType[]>();
  const eqOrder = new Map<string, number>();
  data.equipmentTypes.forEach((eq, i) => {
    eqOrder.set(eq.id, i);
    for (const p of resolveProducts(eq, data)) {
      const list = eqByProduct.get(p.id) ?? [];
      list.push(eq);
      eqByProduct.set(p.id, list);
    }
  });
  return data.products.map((p) => {
    const equipment = eqByProduct.get(p.id) ?? [];
    const stages = [...new Set(equipment.map((e) => stageOf(e)).filter((s): s is string => !!s))];
    const voltages = [...new Set(equipment.flatMap((e) => voltageOfLayer(e.layer)))];
    const source = p.source ?? 'ko';
    const sp = specs?.get(p.id);
    const optionLabels = sp?.variants?.map((v) => v.label) ?? [];
    return {
      product: p,
      source,
      equipment,
      stages,
      voltages,
      ul: source === 'us' || /\bUL\b/.test(p.name),
      hasSpecs: !!sp,
      haystack: normalizeModel(
        // 기기 검색 별칭(브랜드명)은 넣지 않음 — 넣으면 'Susol' 이 그 기기의 모든 제품(Metasol 포함)에 걸린다
        [p.name, p.id, ...p.categoryPath, ...equipment.flatMap((e) => [e.name, e.abbr ?? '']), ...optionLabels].join(' '),
      ),
      order: equipment.length ? Math.min(...equipment.map((e) => eqOrder.get(e.id) ?? 9999)) : 10000,
    };
  });
}

export type SortKey = 'system' | 'name' | 'specs';
export const SORT_LABELS: Record<SortKey, string> = { system: '계통 순서', name: '이름순', specs: '사양 있는 제품 먼저' };

export interface ProductFilters {
  q: string;
  business: Product['business'][];
  stage: string[];
  voltage: VoltageClass[];
  source: ProductSource[];
  ul: boolean;
  specsOnly: boolean;
  /** 단종 제품도 보기 (기본 숨김) */
  showDiscontinued: boolean;
  sort: SortKey;
}

export const EMPTY_FILTERS: ProductFilters = {
  q: '',
  business: [],
  stage: [],
  voltage: [],
  source: [],
  ul: false,
  specsOnly: false,
  showDiscontinued: false,
  sort: 'system',
};

const listOf = <T extends string>(v: string | null, allowed: readonly T[]): T[] =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is T => (allowed as readonly string[]).includes(s));

export const STAGE_FILTER_IDS = [...STAGE_DEFS.map((d) => d.id), MONITORING_LAYER];
/** '단계' 필터 이름 = 단계별 보기 열 = 계통맵 층 이름 (예 'L1 초고압 발전·송전', 'L4~L7 수용가') */
export const STAGE_FILTER_LABELS: Record<string, string> = Object.fromEntries([
  ...STAGE_DEFS.map((d) => [d.id, d.code ? `${d.code} ${d.label}` : d.label]),
  [MONITORING_LAYER, MONITORING_LABEL],
]);

/** 주소(?q&biz&stage&volt&src&ul=1&specs=1&disc=1&sort) → 필터. 모르는 값은 버린다 */
export function parseProductFilters(params: URLSearchParams): ProductFilters {
  const sort = params.get('sort');
  return {
    q: (params.get('q') ?? '').slice(0, 100),
    business: listOf(params.get('biz'), ['power', 'automation'] as const),
    stage: listOf(params.get('stage'), STAGE_FILTER_IDS),
    voltage: listOf(params.get('volt'), VOLTAGE_ORDER),
    source: listOf(params.get('src'), SOURCE_ORDER),
    ul: params.get('ul') === '1',
    specsOnly: params.get('specs') === '1',
    showDiscontinued: params.get('disc') === '1',
    sort: sort === 'name' || sort === 'specs' ? sort : 'system',
  };
}

export function productFiltersToParams(f: ProductFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.business.length) p.set('biz', f.business.join(','));
  if (f.stage.length) p.set('stage', f.stage.join(','));
  if (f.voltage.length) p.set('volt', f.voltage.join(','));
  if (f.source.length) p.set('src', f.source.join(','));
  if (f.ul) p.set('ul', '1');
  if (f.specsOnly) p.set('specs', '1');
  if (f.showDiscontinued) p.set('disc', '1');
  if (f.sort !== 'system') p.set('sort', f.sort);
  return p;
}

export type Facet = 'business' | 'stage' | 'voltage' | 'source';

/** 필터 적용. skip 으로 한 묶음을 빼고 계산 → 그 묶음 체크박스 옆 개수용 */
export function filterProducts(rows: readonly ProductRow[], f: ProductFilters, skip?: Facet): ProductRow[] {
  // 띄어 쓴 낱말마다 정규화(normalizeModel 은 공백까지 지움) → 모두 포함해야 결과
  const terms = f.q.split(/\s+/).map(normalizeModel).filter(Boolean);
  const out = rows.filter((r) => {
    if (!f.showDiscontinued && r.product.discontinued) return false;
    if (skip !== 'business' && f.business.length && !f.business.includes(r.product.business)) return false;
    if (skip !== 'stage' && f.stage.length && !r.stages.some((s) => f.stage.includes(s))) return false;
    if (skip !== 'voltage' && f.voltage.length && !r.voltages.some((v) => f.voltage.includes(v))) return false;
    if (skip !== 'source' && f.source.length && !f.source.includes(r.source)) return false;
    if (f.ul && !r.ul) return false;
    if (f.specsOnly && !r.hasSpecs) return false;
    return terms.every((t) => r.haystack.includes(t));
  });
  if (skip) return out;
  const byName = (a: ProductRow, b: ProductRow) => a.product.name.localeCompare(b.product.name, 'ko');
  if (f.sort === 'name') out.sort(byName);
  else if (f.sort === 'specs') out.sort((a, b) => Number(b.hasSpecs) - Number(a.hasSpecs) || a.order - b.order || byName(a, b));
  else out.sort((a, b) => a.order - b.order || byName(a, b));
  return out;
}

/** 묶음별 값 → 개수 (그 묶음 선택은 빼고 다른 조건은 적용) */
export function facetCounts(rows: readonly ProductRow[], f: ProductFilters, facet: Facet): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of filterProducts(rows, f, facet)) {
    const keys = facet === 'business' ? [r.product.business] : facet === 'stage' ? r.stages : facet === 'voltage' ? r.voltages : [r.source];
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/** 지금 결과 → CSV (UTF-8 BOM, 수식 주입 방지 — 공백 표 CSV 와 같은 규칙) */
export function buildProductCsv(rows: readonly ProductRow[]): string {
  const header = ['제품 ID', '제품명', '분류', '사업', '출처', '연결 기기', 'UL', '정격 사양', '단종', '공식 페이지'];
  const body = rows.map((r) => [
    r.product.id,
    r.product.name,
    r.product.categoryPath.join(' > '),
    BUSINESS_LABELS[r.product.business],
    PRODUCT_SOURCE_LABELS[r.source],
    r.equipment.map((e) => e.name).join(' / '),
    r.ul ? 'UL' : '',
    r.hasSpecs ? '있음' : '',
    r.product.discontinued ? '단종' : '',
    r.product.url,
  ]);
  return '﻿' + [header, ...body].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
