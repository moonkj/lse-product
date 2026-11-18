/**
 * 비교 기능 테스트용 합성 데이터셋 (compare.test.ts · ComparePage.test.tsx 공용).
 * 실제 데이터(src/data/*.json)와 무관 — vi.mock('src/data/load') 로 getData() 를 이 객체로 바꿔 쓴다.
 *
 * 계통 (모선 b1 은 건너뛰고 모선 너머 기기로):
 *   n-up(eq-up) ─power→ b1 ─power→ n-a(eq-a)
 *                          └power→ n-b(eq-b)       (eq-a 와 eq-b 는 같은 모선의 형제 피더)
 *   n-mon(eq-mon) ─signal→ n-a
 *   n-a ─alt→ n-c(eq-c),  n-a ─power→ ep1(끝점 "비상 부하"),  n-a ─power→ n-c (같은 기기 중복 → 1번만)
 *   n-a-ref(eq-a 참조 타일) ─power→ n-d(eq-d)   (대표 노드가 아니므로 eq-a 연결에 안 나옴)
 *   n-a-ref ─power→ n-a                          (자기 자신 → 제외)
 *
 * 제품·사양:
 *   eq-a: productIds [P90001, P90002]  — P90001 사양(정격전류·정격전압·ipRating·극수 2개), P90002 사양(정격차단전류·ipRating·정격전압)
 *   eq-b: 카테고리 CAT900 → P90003(사양 없음)
 *   eq-c: productIds [P90004] — 사양(정격전압 동일값), 다른 기기
 *   eq-e: productIds [P90002, P90004] — (v1.0 M8) 공통 소속 기기 (노드 없음)
 */
import type { AppData, SpecsMap } from '../../../src/data/load';
import type { Category, Diagram, EquipmentType, Product, ProductDocs, ProductSpecs } from '../../../src/lib/schema';

const eq = (id: string, patch: Partial<EquipmentType> = {}): EquipmentType => ({
  id,
  name: `기기 ${id}`,
  layer: 'L4',
  voltage: '22.9kV',
  category: 'switching',
  description: `${id} 설명`,
  learnPoints: [],
  coverage: 'owned',
  lseCategoryCodes: [],
  ...patch,
});

export const EQUIPMENT: EquipmentType[] = [
  eq('eq-up', { name: '상위 기기', abbr: 'UP', layer: 'L3', voltage: '154kV' }),
  eq('eq-a', { name: '기기 A', abbr: 'A', productIds: ['P90001', 'P90002'], learnPoints: ['같은 점'] }),
  eq('eq-b', {
    name: '기기 B',
    coverage: 'missing',
    lseCategoryCodes: ['CAT900'],
    learnPoints: ['같은 점'],
    gapAssessment: { supplyMode: 'not-offered', basis: 'homepage-menu', confidence: 'candidate' },
  }),
  eq('eq-c', { name: '기기 C', productIds: ['P90004'] }),
  eq('eq-d', { name: '기기 D' }),
  eq('eq-mon', { name: '감시 기기', abbr: 'MON', layer: 'MON', category: 'monitoring' }),
  eq('eq-nonode', { name: '노드 없는 기기' }),
  // (v1.0 M8) 여러 기기에 속한 제품: P90002 = eq-a·eq-e, P90004 = eq-c·eq-e → 공통 기기 eq-e
  eq('eq-e', { name: '기기 E', productIds: ['P90002', 'P90004'] }),
];

const product = (id: string, patch: Partial<Product> = {}): Product => ({
  id,
  name: `제품 ${id}`,
  categoryCode: 'CAT100',
  categoryPath: ['전력', '차단기'],
  url: `https://www.ls-electric.com/ko/product/view/${id}`,
  business: 'power',
  discontinued: false,
  docs: [],
  ...patch,
});

export const PRODUCTS: Product[] = [
  product('P90001', { name: '제품 하나' }),
  product('P90002', { name: '제품 둘' }),
  product('P90003', { name: '제품 셋', categoryCode: 'CAT900001', categoryPath: ['전력', '기타'], discontinued: true }),
  product('P90004', { name: '제품 넷' }),
  product('P90005', { name: '제품 다섯' }),
  product('P90006', { name: '제품 여섯' }),
];

export const CATEGORIES: Category[] = [
  { code: 'CAT900', name: '분류 900', path: ['전력'], url: 'https://www.ls-electric.com/ko/cat/900', productIds: [] },
];

export const URL1 = 'https://www.ls-electric.com/ko/cat/one.pdf';
export const URL2 = 'https://www.ls-electric.com/ko/cat/two.pdf';
export const URL4 = 'https://www.ls-electric.com/ko/cat/four.pdf';

export const SPECS: Record<string, ProductSpecs> = {
  P90001: {
    items: [
      { key: 'ratedCurrent', label: '정격전류', value: '630', unit: 'A', page: 4 },
      { key: 'ratedVoltage', label: '정격전압', value: '690', unit: 'V', page: 3 },
      { key: 'ipRating', label: '보호등급(IP)', value: 'IP20', page: 9 },
      { key: 'poles', label: '극수', value: '3', unit: 'P', page: 5 },
      { key: 'poles', label: '극수', value: '4', unit: 'P' },
    ],
    source: { title: '[하나] 카탈로그', url: URL1, page: 2 },
    extractedAt: '2026-11-18',
    reviewed: false,
  },
  P90002: {
    items: [
      { key: 'breakingCapacity', label: '정격차단전류', value: '50', unit: 'kA', page: 7 },
      { key: 'ipRating', label: '보호등급(IP)', value: 'IP20', page: 8 },
      { key: 'ratedVoltage', label: '정격전압', value: '690', unit: 'V', page: 6 },
    ],
    source: { title: '[둘] 카탈로그', url: URL2, page: 6 },
    extractedAt: '2026-11-18',
    reviewed: true,
  },
  P90004: {
    items: [{ key: 'ratedVoltage', label: '정격전압', value: '６９０', unit: 'Vac', page: 1 }], // (v1.0 M3) 표기만 다른 같은 값
    source: { title: '[넷] 카탈로그', url: URL4, page: 1 },
    extractedAt: '2026-11-18',
    reviewed: true,
  },
};

const docRef = (type: ProductDocs['docs'][number]['type'], n: string) => ({
  type,
  title: `${type} ${n}`,
  url: `https://www.ls-electric.com/ko/file/${type}-${n}.pdf`,
});
export const DOCS: Record<string, ProductDocs> = {
  P90001: { source: 'www', deepLink: 'https://www.ls-electric.com/ko/support/1', docs: [docRef('manual', '1'), docRef('catalog', '1'), docRef('cad', '1')] },
  P90002: { source: 'www', deepLink: 'https://www.ls-electric.com/ko/support/2', docs: [docRef('datasheet', '2'), docRef('manual', '2')] },
  P90004: { source: 'www', deepLink: 'https://www.ls-electric.com/ko/support/4', docs: [] },
};

const node = (id: string, equipmentTypeId: string, extra: Partial<Diagram['nodes'][number]> = {}) => ({ id, equipmentTypeId, x: 0, y: 0, ...extra });

export const DIAGRAM: Diagram = {
  width: 1000,
  height: 1000,
  layers: [],
  nodes: [
    node('n-up', 'eq-up'),
    { id: 'b1', kind: 'bus', x: 0, y: 0, label: '22.9kV 모선', layer: 'L4', width: 400 },
    node('n-a', 'eq-a'),
    node('n-b', 'eq-b'),
    node('n-c', 'eq-c'),
    node('n-d', 'eq-d'),
    node('n-mon', 'eq-mon'),
    node('n-a-ref', 'eq-a', { ref: true, label: '참조' }),
    { id: 'ep1', kind: 'endpoint', x: 0, y: 0, label: '비상 부하', layer: 'L5' },
  ],
  edges: [
    { id: 'e1', from: 'n-up', to: 'b1' },
    { id: 'e2', from: 'b1', to: 'n-a' },
    { id: 'e3', from: 'b1', to: 'n-b' },
    { id: 'e4', from: 'n-mon', to: 'n-a', kind: 'signal' },
    { id: 'e5', from: 'n-a', to: 'n-c', kind: 'alt', label: '택1' },
    { id: 'e6', from: 'n-a', to: 'ep1' },
    { id: 'e7', from: 'n-a', to: 'n-c' },
    { id: 'e8', from: 'n-a-ref', to: 'n-d' },
    { id: 'e9', from: 'n-a-ref', to: 'n-a' },
  ],
};

export function buildData(): AppData {
  return {
    products: PRODUCTS,
    categories: CATEGORIES,
    equipmentTypes: EQUIPMENT,
    diagram: DIAGRAM,
    docsGeneratedAt: '2026-11-18',
    productById: new Map(PRODUCTS.map((p) => [p.id, p])),
    categoryByCode: new Map(CATEGORIES.map((c) => [c.code, c])),
    equipmentTypeById: new Map(EQUIPMENT.map((e) => [e.id, e])),
    docsByProductId: new Map(Object.entries(DOCS)),
    equipmentImageById: new Map(),
    productImageById: new Map(),
  };
}

export const FAKE: AppData = buildData();
/** specs.json 은 v1.0(M6)부터 AppData 밖 — loadSpecs()/peekSpecs() 로 따로 받는다 */
export const FAKE_SPECS: SpecsMap = new Map(Object.entries(SPECS));
