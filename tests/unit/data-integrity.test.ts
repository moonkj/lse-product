// @vitest-environment node
/**
 * 데이터 무결성 테스트 (DI-xx 규칙) — docs/test-plan.md §3 과 1:1 대응
 *
 * - 규칙 ID는 describe/it 이름 앞에 붙인다. 규칙을 추가/변경하면 test-plan.md 도 같이 고친다.
 * - 위반은 배열로 모아 `expect(violations).toEqual([])` 로 비교 → 실패 시 어떤 항목이 왜 틀렸는지 한 번에 보인다.
 * - "권장(SOFT)" 규칙은 실패시키지 않고 console.warn 으로만 알린다.
 * - 데이터가 아직 placeholder 일 수 있으므로 DI-30 류(계층별 노드 ≥1)는 지금 실패해도 된다.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll } from 'vitest';
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// [import 집중 구역] T1 구현 후 export 이름이 다르면 여기만 고친다.
// ─────────────────────────────────────────────────────────────
import {
  EquipmentTypeSchema,
  ProductSchema,
  CategorySchema,
  DiagramSchema,
  DocsFileSchema,
  type DocsFile,
} from '../../src/lib/schema';

type EquipmentType = z.infer<typeof EquipmentTypeSchema>;
type Product = z.infer<typeof ProductSchema>;
type Category = z.infer<typeof CategorySchema>;
type Diagram = z.infer<typeof DiagramSchema>;

const DATA_DIR = fileURLToPath(new URL('../../src/data/', import.meta.url));
const FILES = {
  products: 'products.json',
  categories: 'categories.json',
  equipment: 'equipment-types.json',
  diagram: 'diagram.json',
} as const;

const MAIN_LAYERS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'] as const;
const ALL_LAYERS = [...MAIN_LAYERS, 'REN', 'MON'] as const;
const COVERAGES = ['owned', 'partial', 'affiliate', 'missing', 'na'] as const;

/** 공식 사이트(서브도메인 포함: www, ssq, sol 등) https 링크만 허용 */
const LSE_URL_RE = /^https:\/\/([a-z0-9-]+\.)*ls-electric\.com(\/|$)/i;
const PRODUCT_ID_RE = /^P\d{5}$/;
const CATEGORY_CODE_RE = /^[A-Z]{3}\d{3,}$/; // AAA009004, BBB001 ...
/** 라우트(/equipment/:id)에 그대로 쓰이므로 URL-safe 소문자 kebab-case 강제 */
const ROUTE_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** 노드 간 최소 거리(px) — 겹쳐서 클릭 불가한 노드 방지 */
const MIN_NODE_DISTANCE = 24;

// ─────────────────────────────────────────────────────────────
// 로딩 헬퍼
// ─────────────────────────────────────────────────────────────
function readJson(file: string): unknown {
  return JSON.parse(readFileSync(DATA_DIR + file, 'utf8'));
}

/**
 * 파일 최상위가 배열이든 { key: [] } 이든 배열로 꺼낸다.
 * (최상위 형태는 아직 계약에 없음 → test-plan.md 우려사항 R-03)
 */
function asArray(raw: unknown, key: string): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>)[key])) {
    return (raw as Record<string, unknown[]>)[key];
  }
  throw new Error(`${key}: 최상위가 배열 또는 { ${key}: [] } 형태가 아님`);
}

function duplicates<T>(values: T[]): T[] {
  const seen = new Set<T>();
  const dup = new Set<T>();
  for (const v of values) (seen.has(v) ? dup : seen).add(v);
  return [...dup];
}

function softWarn(ruleId: string, items: string[]): void {
  if (items.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(`[${ruleId} 권장 위반 ${items.length}건]\n  - ${items.join('\n  - ')}`);
  }
}

let products: Product[] = [];
let categories: Category[] = [];
let equipment: EquipmentType[] = [];
let diagram: Diagram;

let productById = new Map<string, Product>();
let categoryByCode = new Map<string, Category>();
let equipmentById = new Map<string, EquipmentType>();
let nodeIds = new Set<string>();

/**
 * 카테고리 코드 → 자신 + 모든 하위 카테고리의 제품 id
 * R-01 리더 결정: coverage 는 데이터에 직접 적은 값이 원본(자동 계산 안 함). DI-2x 는 일관성만 검증하며,
 * 카테고리 코드는 하위 카테고리 제품까지 포함한 것으로 해석한다.
 */
function productsUnderCategory(code: string, visited = new Set<string>()): Set<string> {
  const out = new Set<string>();
  if (visited.has(code)) return out; // 순환 방어 (DI-15가 별도로 잡음)
  visited.add(code);
  const cat = categoryByCode.get(code);
  if (!cat) return out;
  cat.productIds.forEach((id) => out.add(id));
  for (const child of categories) {
    if (child.parentCode === code) productsUnderCategory(child.code, visited).forEach((id) => out.add(id));
  }
  return out;
}

/** 기기에 연결된 제품 id 전체 (직접 productIds ∪ 카테고리 하위 제품) */
function linkedProductIds(eq: EquipmentType): Set<string> {
  const out = new Set<string>(eq.productIds ?? []);
  for (const code of eq.lseCategoryCodes) productsUnderCategory(code).forEach((id) => out.add(id));
  return out;
}

/** 연결 건수 = 제품 + 카테고리 (카테고리만 있고 제품 페이지가 없는 수주형 품목 고려: GIS, HVDC 등) */
function linkCount(eq: EquipmentType): number {
  return linkedProductIds(eq).size + eq.lseCategoryCodes.length;
}

// 전체 describe 공통 로딩 (top-level beforeAll). parse 실패 시 모든 테스트가 실패한다 = 의도된 동작.
beforeAll(() => {
  products = z.array(ProductSchema).parse(asArray(readJson(FILES.products), 'products'));
  categories = z.array(CategorySchema).parse(asArray(readJson(FILES.categories), 'categories'));
  equipment = z.array(EquipmentTypeSchema).parse(asArray(readJson(FILES.equipment), 'equipmentTypes'));
  diagram = DiagramSchema.parse(readJson(FILES.diagram));

  productById = new Map(products.map((p) => [p.id, p]));
  categoryByCode = new Map(categories.map((c) => [c.code, c]));
  equipmentById = new Map(equipment.map((e) => [e.id, e]));
  nodeIds = new Set(diagram.nodes.map((n) => n.id));
});


// ─────────────────────────────────────────────────────────────
// DI-00 파일 존재 + 스키마 parse (이게 깨지면 아래 전부 의미 없음)
// ─────────────────────────────────────────────────────────────
describe('DI-00 데이터 파일 존재 및 Zod 스키마 통과', () => {
  it.each(Object.values(FILES))('DI-00a %s 파일이 존재하고 JSON으로 파싱된다', (file) => {
    expect(existsSync(DATA_DIR + file), `${file} 없음`).toBe(true);
    expect(() => readJson(file)).not.toThrow();
  });

  it('DI-00b 4개 파일 모두 스키마 parse 성공 (beforeAll 에서 수행)', () => {
    expect(diagram).toBeDefined();
  });

  it('DI-00c 스키마가 잘못된 데이터를 실제로 거부한다 (스키마가 너무 느슨하지 않은지)', () => {
    expect(EquipmentTypeSchema.safeParse({ id: 'x', layer: 'L9', coverage: 'owned' }).success).toBe(false);
    expect(
      EquipmentTypeSchema.safeParse({ ...(equipment[0] ?? {}), coverage: 'unknown' }).success,
    ).toBe(false);
    expect(ProductSchema.safeParse({ ...(products[0] ?? {}), business: 'other' }).success).toBe(false);
    expect(DiagramSchema.safeParse({ width: 100, height: 100, layers: [], nodes: [{}], edges: [] }).success).toBe(
      false,
    );
  });
});

// ─────────────────────────────────────────────────────────────
// DI-01 ~ 09 : 식별자
// ─────────────────────────────────────────────────────────────
describe('식별자 (DI-01 ~ DI-09)', () => {
  it('DI-01 product.id 중복 없음', () => {
    expect(duplicates(products.map((p) => p.id))).toEqual([]);
  });
  it('DI-02 category.code 중복 없음', () => {
    expect(duplicates(categories.map((c) => c.code))).toEqual([]);
  });
  it('DI-03 equipmentType.id 중복 없음', () => {
    expect(duplicates(equipment.map((e) => e.id))).toEqual([]);
  });
  it('DI-04 diagram node.id / edge.id / layer.id 각각 중복 없음', () => {
    expect(duplicates(diagram.nodes.map((n) => n.id))).toEqual([]);
    expect(duplicates(diagram.edges.map((e) => e.id))).toEqual([]);
    expect(duplicates(diagram.layers.map((l) => l.id))).toEqual([]);
  });
  it('DI-05 product.id 형식 P + 숫자5자리', () => {
    expect(products.filter((p) => !PRODUCT_ID_RE.test(p.id)).map((p) => p.id)).toEqual([]);
  });
  it('DI-06 category.code 형식 (AAA009004 등)', () => {
    expect(categories.filter((c) => !CATEGORY_CODE_RE.test(c.code)).map((c) => c.code)).toEqual([]);
  });
  it('DI-07 equipmentType.id 는 URL-safe kebab-case (라우트 /equipment/:id 에 사용)', () => {
    expect(equipment.filter((e) => !ROUTE_ID_RE.test(e.id)).map((e) => e.id)).toEqual([]);
  });
  it('DI-08 필수 텍스트 필드가 공백 문자열이 아님 (name, description, category, voltage)', () => {
    const bad = equipment
      .filter((e) => [e.name, e.description, e.category, e.voltage].some((s) => !s || !s.trim()))
      .map((e) => e.id);
    const badP = products.filter((p) => !p.name.trim()).map((p) => p.id);
    expect([...bad, ...badP]).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// DI-10 ~ 19 : 제품·카테고리 참조
// ─────────────────────────────────────────────────────────────
describe('제품·카테고리 참조 (DI-10 ~ DI-19)', () => {
  it('DI-10 equipment.lseCategoryCodes 가 모두 categories.json 에 존재', () => {
    const bad = equipment.flatMap((e) =>
      e.lseCategoryCodes.filter((c) => !categoryByCode.has(c)).map((c) => `${e.id} → ${c}`),
    );
    expect(bad).toEqual([]);
  });
  it('DI-11 equipment.productIds 가 모두 products.json 에 존재', () => {
    const bad = equipment.flatMap((e) =>
      (e.productIds ?? []).filter((id) => !productById.has(id)).map((id) => `${e.id} → ${id}`),
    );
    expect(bad).toEqual([]);
  });
  it('DI-12 product.categoryCode 가 categories.json 에 존재', () => {
    expect(products.filter((p) => !categoryByCode.has(p.categoryCode)).map((p) => `${p.id} → ${p.categoryCode}`)).toEqual(
      [],
    );
  });
  it('DI-13 category.productIds 가 모두 products.json 에 존재', () => {
    const bad = categories.flatMap((c) =>
      c.productIds.filter((id) => !productById.has(id)).map((id) => `${c.code} → ${id}`),
    );
    expect(bad).toEqual([]);
  });
  it('DI-14 양방향 일치: product.categoryCode 의 카테고리가 그 제품을 productIds 에 포함', () => {
    const bad = products
      .filter((p) => !categoryByCode.get(p.categoryCode)?.productIds.includes(p.id))
      .map((p) => `${p.id} (categoryCode=${p.categoryCode})`);
    expect(bad).toEqual([]);
  });
  it('DI-15 category.parentCode 가 존재하고 순환이 없음', () => {
    const bad: string[] = [];
    for (const c of categories) {
      if (c.parentCode && !categoryByCode.has(c.parentCode)) bad.push(`${c.code}: parent ${c.parentCode} 없음`);
      const seen = new Set<string>([c.code]);
      let cur = c.parentCode;
      while (cur) {
        if (seen.has(cur)) {
          bad.push(`${c.code}: 순환 (${[...seen].join('→')}→${cur})`);
          break;
        }
        seen.add(cur);
        cur = categoryByCode.get(cur)?.parentCode;
      }
    }
    expect(bad).toEqual([]);
  });
  it('DI-16 category.path 마지막 요소 = name, product.categoryPath 가 비어있지 않음', () => {
    const bad = [
      ...categories.filter((c) => c.path.at(-1) !== c.name).map((c) => `cat ${c.code}: path 끝≠name`),
      ...products.filter((p) => p.categoryPath.length === 0).map((p) => `product ${p.id}: categoryPath 비어있음`),
    ];
    expect(bad).toEqual([]);
  });
  it('DI-17 product.url / category.url / doc.url 은 https + ls-electric.com 도메인', () => {
    const bad = [
      ...products.filter((p) => !LSE_URL_RE.test(p.url)).map((p) => `product ${p.id}: ${p.url}`),
      ...categories.filter((c) => !LSE_URL_RE.test(c.url)).map((c) => `cat ${c.code}: ${c.url}`),
      ...products.flatMap((p) =>
        p.docs.filter((d) => !LSE_URL_RE.test(d.url)).map((d) => `doc ${p.id}/${d.title}: ${d.url}`),
      ),
    ];
    expect(bad).toEqual([]);
  });
  it('DI-18 product.url 은 www.ls-electric.com/ko/product/view/{id} 와 id 일치', () => {
    const bad = products
      .filter((p) => p.url.startsWith('https://www.ls-electric.com') && !p.url.includes(p.id))
      .map((p) => `${p.id}: ${p.url}`);
    expect(bad).toEqual([]);
  });
  it('DI-19 한 제품 안에서 doc.url 중복 없음', () => {
    const bad = products.flatMap((p) => duplicates(p.docs.map((d) => d.url)).map((u) => `${p.id}: ${u}`));
    expect(bad).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// DI-20 ~ 29 : 커버리지 일관성 (Gap 화면의 신뢰성 = 이 포털의 핵심 가치)
// ─────────────────────────────────────────────────────────────
describe('커버리지 일관성 (DI-20 ~ DI-29)', () => {
  it('DI-20 owned → 연결(제품+카테고리) ≥ 1', () => {
    const bad = equipment.filter((e) => e.coverage === 'owned' && linkCount(e) === 0).map((e) => e.id);
    expect(bad).toEqual([]);
  });
  it('DI-21 missing → 연결 0 (productIds·lseCategoryCodes 모두 비어있음)', () => {
    const bad = equipment
      .filter((e) => e.coverage === 'missing' && ((e.productIds?.length ?? 0) > 0 || e.lseCategoryCodes.length > 0))
      .map((e) => e.id);
    expect(bad).toEqual([]);
  });
  it('DI-22 affiliate → affiliateName 필수 (비어있지 않은 문자열)', () => {
    const bad = equipment.filter((e) => e.coverage === 'affiliate' && !e.affiliateName?.trim()).map((e) => e.id);
    expect(bad).toEqual([]);
  });
  it('DI-23 affiliateName 은 coverage=affiliate 일 때만 존재', () => {
    const bad = equipment.filter((e) => e.coverage !== 'affiliate' && e.affiliateName).map((e) => e.id);
    expect(bad).toEqual([]);
  });
  it('DI-24 missing → gapNote 필수 (Gap 모드에서 "왜 공백인지" 설명)', () => {
    const bad = equipment.filter((e) => e.coverage === 'missing' && !e.gapNote?.trim()).map((e) => e.id);
    expect(bad).toEqual([]);
  });
  it('DI-25 (SOFT) partial → gapNote 권장', () => {
    softWarn(
      'DI-25',
      equipment.filter((e) => e.coverage === 'partial' && !e.gapNote?.trim()).map((e) => e.id),
    );
  });
  it('DI-26 partial → 연결 ≥ 1 (일부라도 보유해야 partial)', () => {
    const bad = equipment.filter((e) => e.coverage === 'partial' && linkCount(e) === 0).map((e) => e.id);
    expect(bad).toEqual([]);
  });
  it('DI-27 (SOFT) owned 인데 연결 제품이 전부 단종 → 경고', () => {
    softWarn(
      'DI-27',
      equipment
        .filter((e) => e.coverage === 'owned')
        .filter((e) => {
          const ids = [...linkedProductIds(e)];
          return ids.length > 0 && ids.every((id) => productById.get(id)?.discontinued);
        })
        .map((e) => e.id),
    );
  });
  it('DI-28 coverage 5종 값이 모두 계약 enum 안 (스키마 이중 확인)', () => {
    expect(equipment.filter((e) => !(COVERAGES as readonly string[]).includes(e.coverage)).map((e) => e.id)).toEqual([]);
  });
  it('DI-29 (SOFT) 공백 후보 11종이 데이터에 존재 (product-mapping.md 요약과 대조)', () => {
    // 이름 일부 매칭. 사용자 확인 결과에 따라 coverage 는 바뀔 수 있으나 "자리"는 계통도에 있어야 함.
    const candidates = ['발전기', '송전', '피뢰기', '변성기', '리클로저', '주상변압기', '콘덴서', 'ATS', '비상발전기', '분전반', '전동기'];
    softWarn(
      'DI-29',
      candidates.filter((k) => !equipment.some((e) => e.name.includes(k) || e.abbr?.includes(k))),
    );
  });
});

// ─────────────────────────────────────────────────────────────
// DI-30 ~ 49 : 계통도 구조
// ─────────────────────────────────────────────────────────────
describe('계통도 구조 (DI-30 ~ DI-49)', () => {
  /** 밴드 사각형. x/width 는 optional (L1~L7 은 생략 가능, REN·MON 은 오른쪽 열) */
  const bandRect = (l: Diagram['layers'][number]) => ({
    x: l.x ?? 0,
    y: l.y,
    w: l.width ?? diagram.width,
    h: l.height,
  });
  const layerOf = (nodeEqId: string) => equipmentById.get(nodeEqId)?.layer;

  it('DI-30 모든 diagram node.equipmentTypeId 가 equipment-types.json 에 존재', () => {
    const bad = diagram.nodes.filter((n) => !equipmentById.has(n.equipmentTypeId)).map((n) => `${n.id} → ${n.equipmentTypeId}`);
    expect(bad).toEqual([]);
  });
  it('DI-31 모든 edge.from / edge.to 가 존재하는 node', () => {
    const bad = diagram.edges.flatMap((e) =>
      [e.from, e.to].filter((id) => !nodeIds.has(id)).map((id) => `${e.id}: ${id} 없음`),
    );
    expect(bad).toEqual([]);
  });
  it('DI-32 self-loop 없음, 같은 노드쌍 중복 edge 없음(방향 무시)', () => {
    const selfLoops = diagram.edges.filter((e) => e.from === e.to).map((e) => `${e.id}: self-loop`);
    const pairKeys = diagram.edges.map((e) => [e.from, e.to].sort().join('↔'));
    expect([...selfLoops, ...duplicates(pairKeys).map((k) => `중복 ${k}`)]).toEqual([]);
  });
  it('DI-33 L1~L7 + 노드가 쓰는 모든 layer 에 diagram.layers 밴드가 정의됨', () => {
    const defined = new Set(diagram.layers.map((l) => l.id));
    const used = new Set(diagram.nodes.map((n) => layerOf(n.equipmentTypeId)).filter(Boolean) as string[]);
    const required = new Set<string>([...MAIN_LAYERS, ...used]);
    expect([...required].filter((id) => !defined.has(id as (typeof ALL_LAYERS)[number]))).toEqual([]);
  });
  it('DI-34 L1~L7 각 계층에 노드 ≥ 1 (placeholder 단계에서는 실패 가능)', () => {
    const counts = new Map<string, number>();
    diagram.nodes.forEach((n) => {
      const l = layerOf(n.equipmentTypeId);
      if (l) counts.set(l, (counts.get(l) ?? 0) + 1);
    });
    expect(MAIN_LAYERS.filter((l) => !counts.get(l))).toEqual([]);
  });
  it('DI-35 node 좌표가 해당 기기 layer 밴드 사각형 [x, x+width]×[y, y+height] 안 (x/width 생략 시 0/diagram.width)', () => {
    const band = new Map(diagram.layers.map((l) => [l.id, l]));
    const bad = diagram.nodes
      .map((n) => ({ n, l: band.get(layerOf(n.equipmentTypeId) as (typeof ALL_LAYERS)[number]) }))
      .filter(({ l }) => l)
      .map(({ n, l }) => ({ n, l: l!, r: bandRect(l!) }))
      .filter(({ n, r }) => n.y < r.y || n.y > r.y + r.h || n.x < r.x || n.x > r.x + r.w)
      .map(({ n, l, r }) => `${n.id}: (${n.x},${n.y}) ∉ ${l.id}[x ${r.x}~${r.x + r.w}, y ${r.y}~${r.y + r.h}]`);
    expect(bad).toEqual([]);
  });
  it('DI-36 node 좌표가 캔버스 [0,width]×[0,height] 안', () => {
    const bad = diagram.nodes
      .filter((n) => n.x < 0 || n.y < 0 || n.x > diagram.width || n.y > diagram.height)
      .map((n) => `${n.id}: (${n.x},${n.y})`);
    expect(bad).toEqual([]);
  });
  it('DI-37 layer 밴드: 캔버스 안, width·height>0, 서로 겹치지 않음 (x·y 모두 겹칠 때만 겹침)', () => {
    const bad: string[] = [];
    const rects = diagram.layers.map((l) => ({ id: l.id, ...bandRect(l) }));
    rects.forEach((r, i) => {
      if (r.h <= 0 || r.w <= 0) bad.push(`${r.id}: 크기 ≤ 0`);
      if (r.x < 0 || r.y < 0 || r.x + r.w > diagram.width || r.y + r.h > diagram.height) bad.push(`${r.id}: 캔버스 밖`);
      for (const o of rects.slice(i + 1)) {
        const overlapX = r.x < o.x + o.w && o.x < r.x + r.w;
        const overlapY = r.y < o.y + o.h && o.y < r.y + r.h;
        if (overlapX && overlapY) bad.push(`${r.id} ↔ ${o.id} 겹침`);
      }
    });
    expect(bad).toEqual([]);
  });
  it('DI-38 L1 → L7 밴드가 위에서 아래 순서 (교육 투어 "발전소→콘센트" 방향)', () => {
    const ys = MAIN_LAYERS.map((id) => diagram.layers.find((l) => l.id === id)?.y ?? Number.NaN);
    const ordered = ys.every((y, i) => i === 0 || y > ys[i - 1]);
    expect(ordered, `L1..L7 y = ${ys.join(', ')}`).toBe(true);
  });
  it('DI-39 노드끼리 최소 거리 이상 떨어짐 (겹침 = 클릭 불가)', () => {
    const bad: string[] = [];
    const ns = diagram.nodes;
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        if (Math.hypot(ns[i].x - ns[j].x, ns[i].y - ns[j].y) < MIN_NODE_DISTANCE) bad.push(`${ns[i].id} ↔ ${ns[j].id}`);
      }
    }
    expect(bad).toEqual([]);
  });
  /** R-05 리더 결정: 패널·일괄설비 그룹 표시용으로 연결선 없이 두는 system 노드 (의도됨) */
  const KNOWN_ISOLATED_SYSTEM_NODES = ['n-substation', 'n-mv-swgr', 'n-lv-swgr', 'n-modular', 'n-railway'];

  it('DI-40 고립 노드 없음: edge ≥ 1 (예외: MON 감시 노드, category=system 일괄/패키지 노드 — R-05)', () => {
    const degree = new Map<string, number>();
    diagram.edges.forEach((e) => {
      degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
      degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
    });
    const bad = diagram.nodes
      .filter((n) => {
        const eq = equipmentById.get(n.equipmentTypeId);
        return eq?.layer !== 'MON' && eq?.category !== 'system' && !degree.get(n.id);
      })
      .map((n) => n.id);
    expect(bad).toEqual([]);
    // R-05: 확정된 5개 외에 새로 고립된 system 노드가 생기면 의도 확인 요청 (SOFT)
    softWarn(
      'DI-40 R-05',
      diagram.nodes
        .filter((n) => equipmentById.get(n.equipmentTypeId)?.category === 'system' && !degree.get(n.id))
        .map((n) => n.id)
        .filter((id) => !KNOWN_ISOLATED_SYSTEM_NODES.includes(id)),
    );
  });
  it('DI-41 L1 노드에서 L7 노드까지 경로 존재 (전원→부하 흐름이 끊기지 않음)', () => {
    const adj = new Map<string, string[]>();
    diagram.edges.forEach((e) => {
      adj.set(e.from, [...(adj.get(e.from) ?? []), e.to]);
      adj.set(e.to, [...(adj.get(e.to) ?? []), e.from]); // 무방향으로 연결성만 본다
    });
    const starts = diagram.nodes.filter((n) => layerOf(n.equipmentTypeId) === 'L1').map((n) => n.id);
    const targets = new Set(diagram.nodes.filter((n) => layerOf(n.equipmentTypeId) === 'L7').map((n) => n.id));
    const seen = new Set<string>(starts);
    const queue = [...starts];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const nx of adj.get(cur) ?? []) {
        if (!seen.has(nx)) {
          seen.add(nx);
          queue.push(nx);
        }
      }
    }
    expect([...targets].some((t) => seen.has(t))).toBe(true);
  });
  it('DI-42 edge 는 같은 계층 또는 인접 계층만 잇는다 (L2→L6 같은 건너뛰기 금지, REN/MON 예외)', () => {
    const idx = (l?: string) => MAIN_LAYERS.indexOf(l as (typeof MAIN_LAYERS)[number]);
    const nodeLayer = new Map(diagram.nodes.map((n) => [n.id, layerOf(n.equipmentTypeId)]));
    const bad = diagram.edges
      .filter((e) => {
        const a = idx(nodeLayer.get(e.from));
        const b = idx(nodeLayer.get(e.to));
        return a >= 0 && b >= 0 && Math.abs(a - b) > 1;
      })
      .map((e) => `${e.id}: ${nodeLayer.get(e.from)}→${nodeLayer.get(e.to)}`);
    expect(bad).toEqual([]);
  });
  it('DI-43 모든 equipmentType 이 계통도에 노드로 1회 이상 등장 (리더 공지 11-18: 하드 규칙)', () => {
    const used = new Set(diagram.nodes.map((n) => n.equipmentTypeId));
    expect(equipment.filter((e) => !used.has(e.id)).map((e) => e.id)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// DI-50 ~ : 교육·검색 품질
// ─────────────────────────────────────────────────────────────
describe('교육·검색 품질 (DI-50 ~)', () => {
  it('DI-50 모든 equipmentType 은 learnPoints ≥ 1 (교육 모드 빈 카드 방지)', () => {
    const bad = equipment.filter((e) => e.learnPoints.filter((s) => s.trim()).length === 0).map((e) => e.id);
    expect(bad).toEqual([]);
  });
  it('DI-51 (SOFT) 같은 layer 안에서 equipment.name 중복 없음 (검색 결과 구분 불가)', () => {
    const keys = equipment.map((e) => `${e.layer}:${e.name}`);
    softWarn('DI-51', duplicates(keys));
  });
  it('DI-52 (SOFT) 공개 사이트 — 대외비 키워드가 텍스트에 없음', () => {
    const banned = ['대외비', '내부용', 'confidential', '사내한정'];
    const texts = equipment.map((e) => ({ id: e.id, t: JSON.stringify(e).toLowerCase() }));
    softWarn(
      'DI-52',
      texts.filter(({ t }) => banned.some((b) => t.includes(b.toLowerCase()))).map(({ id }) => id),
    );
  });
});

// ─────────────────────────────────────────────────────────────
// DI-60 ~ : docs.json (제품별 자료 — scripts/fetch-docs.mjs 산출물)
//   구조: { generatedAt, products: { [productId]: { source:'www'|'ssq', deepLink, docs: DocRef[] } } }
// ─────────────────────────────────────────────────────────────
/** 자료 파일 허용 도메인: 공식 사이트(*.ls-electric.com) + ssq 공식 대용량 파일 CDN */
const SSQ_CDN_HOST = 'ssqfd-abhdhraad3gkgbcg.a03.azurefd.net';
function isAllowedDocUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  return host === 'ls-electric.com' || host.endsWith('.ls-electric.com') || host === SSQ_CDN_HOST;
}
/** 개인정보 의심 패턴: 이메일, 한국 전화번호(휴대폰·지역번호·대표번호) */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?<!\d)(?:(?:01[016789]|0[2-6]\d?)[-.\s)]\d{3,4}[-.\s]\d{4}|1[5-9]\d{2}-\d{4})(?!\d)/;

describe('docs.json 자료 (DI-60 ~)', () => {
  const DOCS_FILE = 'docs.json';
  let docsFile: DocsFile;
  let entries: [string, DocsFile['products'][string]][] = [];

  beforeAll(() => {
    docsFile = DocsFileSchema.parse(readJson(DOCS_FILE));
    entries = Object.entries(docsFile.products);
  });

  it('DI-60 docs.json 이 존재하고 DocsFileSchema 통과 (+ 잘못된 값은 거부)', () => {
    expect(existsSync(DATA_DIR + DOCS_FILE)).toBe(true);
    expect(docsFile.generatedAt).toBeTruthy();
    expect(Number.isNaN(Date.parse(docsFile.generatedAt)), 'generatedAt 이 날짜 형식이 아님').toBe(false);
    // 스키마가 너무 느슨하지 않은지
    expect(
      DocsFileSchema.safeParse({
        generatedAt: 'x',
        products: { P00001: { source: 'ftp', deepLink: 'https://www.ls-electric.com/', docs: [] } },
      }).success,
    ).toBe(false);
    expect(
      DocsFileSchema.safeParse({
        generatedAt: 'x',
        products: { P00001: { source: 'www', deepLink: 'http://www.ls-electric.com/', docs: [] } },
      }).success,
    ).toBe(false);
  });

  it('DI-61 docs.json 의 productId 키가 모두 products.json 에 존재', () => {
    expect(entries.map(([id]) => id).filter((id) => !productById.has(id))).toEqual([]);
  });

  it('DI-62 모든 doc.url 은 https + 허용 도메인 (*.ls-electric.com, ssq CDN)', () => {
    const bad = entries.flatMap(([id, e]) =>
      e.docs.filter((d) => !isAllowedDocUrl(d.url)).map((d) => `${id}/${d.title}: ${d.url}`),
    );
    expect(bad).toEqual([]);
  });

  it('DI-63 deepLink 존재 + https + *.ls-electric.com (공식 자료실)', () => {
    const bad = entries
      .filter(([, e]) => !e.deepLink?.trim() || !LSE_URL_RE.test(e.deepLink))
      .map(([id, e]) => `${id}: ${e.deepLink}`);
    expect(bad).toEqual([]);
  });

  it('DI-64 개인정보 의심 패턴(이메일, 전화번호) 0건 — 제목·URL·deepLink 전체', () => {
    const bad: string[] = [];
    for (const [id, e] of entries) {
      const fields = [e.deepLink, ...e.docs.flatMap((d) => [d.title, decodeURIComponentSafe(d.url)])];
      for (const f of fields) {
        if (EMAIL_RE.test(f)) bad.push(`${id}: 이메일 의심 "${f}"`);
        if (PHONE_RE.test(f)) bad.push(`${id}: 전화번호 의심 "${f}"`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('DI-65 같은 제품 안에서 doc.url 중복 없음', () => {
    const bad = entries.flatMap(([id, e]) => duplicates(e.docs.map((d) => d.url)).map((u) => `${id}: ${u}`));
    expect(bad).toEqual([]);
  });

  it('DI-66 doc.title 이 공백 문자열이 아님', () => {
    const bad = entries.flatMap(([id, e]) => e.docs.filter((d) => !d.title.trim()).map((d) => `${id}: ${d.url}`));
    expect(bad).toEqual([]);
  });

  it('DI-67 (SOFT) docs 가 빈 제품 → 경고만 (화면은 "자료 준비 중" + deepLink)', () => {
    softWarn('DI-67', entries.filter(([, e]) => e.docs.length === 0).map(([id]) => id));
  });

  it('DI-68 (SOFT) source=ssq 인데 www 파일, 또는 그 반대 (출처 표기 오류 의심)', () => {
    softWarn(
      'DI-68',
      entries
        .filter(([, e]) => e.source === 'www' && e.docs.some((d) => new URL(d.url).hostname === SSQ_CDN_HOST))
        .map(([id]) => `${id}: source=www 인데 ssq CDN 파일 포함`),
    );
  });
});

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
