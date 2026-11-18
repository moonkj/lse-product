// @vitest-environment node
/**
 * 데이터 무결성 테스트 (DI-xx 규칙) — docs/test-plan.md §3 과 1:1 대응
 *
 * - 규칙 ID는 describe/it 이름 앞에 붙인다. 규칙을 추가/변경하면 test-plan.md 도 같이 고친다.
 * - 위반은 배열로 모아 `expect(violations).toEqual([])` 로 비교 → 실패 시 어떤 항목이 왜 틀렸는지 한 번에 보인다.
 * - "권장(SOFT)" 규칙은 실패시키지 않고 console.warn 으로만 알린다.
 * - 데이터가 아직 placeholder 일 수 있으므로 DI-30 류(계층별 노드 ≥1)는 지금 실패해도 된다.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
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
  EquipmentImagesSchema,
  GapAssessmentSchema,
  type DocsFile,
  type EquipmentImage,
} from '../../src/lib/schema';
import { LearnContentSchema, type LearnContent } from '../../src/content/learnSchema';

type EquipmentType = z.infer<typeof EquipmentTypeSchema>;
type Product = z.infer<typeof ProductSchema>;
type Category = z.infer<typeof CategorySchema>;
type Diagram = z.infer<typeof DiagramSchema>;
type DNode = Diagram['nodes'][number];

const DATA_DIR = fileURLToPath(new URL('../../src/data/', import.meta.url));
const FILES = {
  products: 'products.json',
  categories: 'categories.json',
  equipment: 'equipment-types.json',
  diagram: 'diagram.json',
} as const;

const MAIN_LAYERS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'] as const;
const ALL_LAYERS = [...MAIN_LAYERS, 'REN', 'MON'] as const;
const COVERAGES = ['owned', 'partial', 'affiliate', 'sourced', 'missing', 'na'] as const;
/** 공백 판정 근거(gapAssessment) 필수 커버리지 (개선 R3) */
const ASSESSED = ['missing', 'partial', 'affiliate', 'sourced'] as const;

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

// ── 계통도 노드 종류 헬퍼 (개선 R3: equipment / bus / endpoint, equipment 중 ref=참조 타일) ──
const kindOf = (n: DNode) => n.kind ?? 'equipment';
const isEquipNode = (n: DNode) => kindOf(n) === 'equipment';
/** 74종 집계 대상 = 참조 타일이 아닌 기기 노드 */
const isMainEquipNode = (n: DNode) => isEquipNode(n) && !n.ref;
/** 노드 소속 계층: 기기 노드 = 기기 layer, 모선·끝점 = node.layer */
function nodeLayerOf(n: DNode): string | undefined {
  if (isEquipNode(n)) return n.equipmentTypeId ? equipmentById.get(n.equipmentTypeId)?.layer : undefined;
  return n.layer;
}
/** 종류별 크기 (반폭·반높이): 사진 타일 120×116, 끝점 120×44, 모선 width×8 (scripts/build-diagram-data.py Box) */
const TILE_HW = 60;
const TILE_HH = 58;
const EP_HW = 60;
const EP_HH = 22;
const BUS_HH = 4;
function halfSize(n: DNode): { hw: number; hh: number } {
  const k = kindOf(n);
  if (k === 'bus') return { hw: (n.width ?? 0) / 2, hh: BUS_HH };
  if (k === 'endpoint') return { hw: EP_HW, hh: EP_HH };
  return { hw: TILE_HW, hh: TILE_HH };
}

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
  // ── DI-27a~h 공백 판정 근거 gapAssessment (개선 R3, 연구소 제안 스키마) ──
  const assessed = () => equipment.filter((e) => (ASSESSED as readonly string[]).includes(e.coverage));
  const withGa = () => equipment.filter((e) => e.gapAssessment);
  const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

  it('DI-27a missing·partial·affiliate·sourced → gapAssessment 필수', () => {
    expect(assessed().filter((e) => !e.gapAssessment).map((e) => `${e.id} (${e.coverage})`)).toEqual([]);
    // eslint-disable-next-line no-console
    console.info(`[DI-27a] 판정 대상 ${assessed().length}건, gapAssessment 보유 ${withGa().length}건 (보유 기기 정격 확인용 포함)`);
  });
  it('DI-27b sourced → supplyMode=panel-sourced (+ SOFT: affiliate→affiliate, missing→not-offered|unknown)', () => {
    expect(
      equipment
        .filter((e) => e.coverage === 'sourced' && e.gapAssessment?.supplyMode !== 'panel-sourced')
        .map((e) => `${e.id}: ${e.gapAssessment?.supplyMode}`),
    ).toEqual([]);
    softWarn('DI-27b', [
      ...equipment.filter((e) => e.coverage === 'affiliate' && e.gapAssessment && e.gapAssessment.supplyMode !== 'affiliate').map((e) => `${e.id}: affiliate 인데 ${e.gapAssessment!.supplyMode}`),
      ...equipment.filter((e) => e.coverage === 'missing' && e.gapAssessment && !['not-offered', 'unknown'].includes(e.gapAssessment.supplyMode)).map((e) => `${e.id}: missing 인데 ${e.gapAssessment!.supplyMode}`),
    ]);
  });
  it('DI-27c basis=homepage-menu → confidence=candidate (홈페이지 메뉴만으로 확정 금지) + 스키마가 거부', () => {
    expect(
      withGa().filter((e) => e.gapAssessment!.basis === 'homepage-menu' && e.gapAssessment!.confidence !== 'candidate').map((e) => e.id),
    ).toEqual([]);
    const base = { supplyMode: 'unknown', basis: 'homepage-menu', confidence: 'confirmed', verifiedBy: '배전기기사업부', verifiedAt: '2026-11-18' };
    expect(GapAssessmentSchema.safeParse(base).success, 'homepage-menu + confirmed 가 통과함').toBe(false);
    expect(GapAssessmentSchema.safeParse({ ...base, confidence: 'candidate' }).success).toBe(true);
  });
  it('DI-27d confidence=confirmed → verifiedBy·verifiedAt 필수 + 스키마가 거부', () => {
    expect(
      withGa()
        .filter((e) => e.gapAssessment!.confidence === 'confirmed' && (!e.gapAssessment!.verifiedBy?.trim() || !e.gapAssessment!.verifiedAt))
        .map((e) => e.id),
    ).toEqual([]);
    const ok = { supplyMode: 'not-offered', basis: 'bu-confirmed', confidence: 'confirmed', verifiedBy: '배전기기사업부', verifiedAt: '2026-11-18' };
    expect(GapAssessmentSchema.safeParse(ok).success).toBe(true);
    const { verifiedAt: _a, ...noAt } = ok;
    const { verifiedBy: _b, ...noBy } = ok;
    expect(GapAssessmentSchema.safeParse(noAt).success, 'verifiedAt 없이 확정 통과').toBe(false);
    expect(GapAssessmentSchema.safeParse(noBy).success, 'verifiedBy 없이 확정 통과').toBe(false);
  });
  it('DI-27e verifiedAt·reviewDue 는 실제 날짜 YYYY-MM-DD (2026-02-30 같은 값 금지)', () => {
    const bad = withGa().flatMap((e) =>
      (['verifiedAt', 'reviewDue'] as const)
        .filter((k) => e.gapAssessment![k] !== undefined && !validDate(e.gapAssessment![k]!))
        .map((k) => `${e.id}.${k}=${e.gapAssessment![k]}`),
    );
    expect(bad).toEqual([]);
    expect(validDate('2026-02-30')).toBe(false);
    expect(validDate('2026-11-18')).toBe(true);
  });
  it('DI-27f evidence type=url 이면 ref 는 https 절대 URL', () => {
    const isHttps = (s: string) => {
      try {
        return new URL(s).protocol === 'https:';
      } catch {
        return false;
      }
    };
    const bad = withGa().flatMap((e) =>
      (e.gapAssessment!.evidence ?? []).filter((v) => v.type === 'url' && !isHttps(v.ref)).map((v) => `${e.id}: ${v.ref}`),
    );
    expect(bad).toEqual([]);
  });
  it('DI-27g (SOFT) sourced → gapNote 권장, reviewDue 지난 confirmed 는 경고 (화면은 후보로 취급)', () => {
    const today = new Date().toISOString().slice(0, 10);
    softWarn('DI-27g', [
      ...equipment.filter((e) => e.coverage === 'sourced' && !e.gapNote?.trim()).map((e) => `${e.id}: gapNote 없음`),
      ...withGa()
        .filter((e) => e.gapAssessment!.confidence === 'confirmed' && e.gapAssessment!.reviewDue && e.gapAssessment!.reviewDue < today)
        .map((e) => `${e.id}: reviewDue ${e.gapAssessment!.reviewDue} 지남`),
    ]);
  });
  it('DI-27h (SOFT) verifiedBy 는 부서명 (개인 실명·이메일 금지)', () => {
    softWarn(
      'DI-27h',
      withGa()
        .filter((e) => e.gapAssessment!.verifiedBy && (EMAIL_RE.test(e.gapAssessment!.verifiedBy) || !/(부|팀|소|실|센터|사업|그룹)/.test(e.gapAssessment!.verifiedBy)))
        .map((e) => `${e.id}: verifiedBy="${e.gapAssessment!.verifiedBy}"`),
    );
  });
  it('DI-28 coverage 6종 값이 모두 계약 enum 안 (스키마 이중 확인, 개선 R3 sourced 추가)', () => {
    expect(equipment.filter((e) => !(COVERAGES as readonly string[]).includes(e.coverage)).map((e) => e.id)).toEqual([]);
    const counts = Object.fromEntries(COVERAGES.map((c) => [c, equipment.filter((e) => e.coverage === c).length]));
    // eslint-disable-next-line no-console
    console.info(`[DI-28] coverage 분포 ${JSON.stringify(counts)}`);
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
  const nodeById = () => new Map(diagram.nodes.map((n) => [n.id, n]));
  const degreeMap = () => {
    const degree = new Map<string, number>();
    diagram.edges.forEach((e) => {
      degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
      degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
    });
    return degree;
  };

  it('DI-30 기기 노드(kind 생략·equipment)의 equipmentTypeId 가 equipment-types.json 에 존재, 모선·끝점은 label·layer 보유', () => {
    const bad = [
      ...diagram.nodes
        .filter((n) => isEquipNode(n) && !equipmentById.has(n.equipmentTypeId ?? ''))
        .map((n) => `${n.id} → ${n.equipmentTypeId}`),
      ...diagram.nodes
        .filter((n) => !isEquipNode(n) && (!n.label?.trim() || !n.layer || n.equipmentTypeId || n.ref))
        .map((n) => `${n.id} (${kindOf(n)}): label·layer 필수, equipmentTypeId·ref 금지`),
      ...diagram.nodes.filter((n) => kindOf(n) === 'bus' && !(n.width! > 0)).map((n) => `${n.id}: 모선 width 없음`),
    ];
    expect(bad).toEqual([]);
    // 스키마 자기검증
    expect(DiagramSchema.shape.nodes.element.safeParse({ id: 'x', x: 0, y: 0 }).success, '기기 노드에 equipmentTypeId 없이 통과').toBe(false);
    expect(DiagramSchema.shape.nodes.element.safeParse({ id: 'b', kind: 'bus', x: 0, y: 0, label: 'b', layer: 'L4' }).success, '모선 width 없이 통과').toBe(false);
    expect(DiagramSchema.shape.nodes.element.safeParse({ id: 'p', kind: 'endpoint', x: 0, y: 0, label: 'p', layer: 'L6', equipmentTypeId: 'vcb' }).success, '끝점에 equipmentTypeId 통과').toBe(false);
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
  it('DI-33 L1~L7 + 노드가 쓰는 모든 layer 에 diagram.layers 밴드가 정의됨 (모선·끝점은 node.layer)', () => {
    const defined = new Set<string>(diagram.layers.map((l) => l.id));
    const used = new Set(diagram.nodes.map(nodeLayerOf).filter(Boolean) as string[]);
    const required = new Set<string>([...MAIN_LAYERS, ...used]);
    expect([...required].filter((id) => !defined.has(id))).toEqual([]);
    expect([...used].filter((id) => !(ALL_LAYERS as readonly string[]).includes(id)), '계약 밖 layer').toEqual([]);
  });
  it('DI-34 L1~L7 각 계층에 기기 노드(참조 타일 제외) ≥ 1', () => {
    const counts = new Map<string, number>();
    diagram.nodes.filter(isMainEquipNode).forEach((n) => {
      const l = nodeLayerOf(n);
      if (l) counts.set(l, (counts.get(l) ?? 0) + 1);
    });
    expect(MAIN_LAYERS.filter((l) => !counts.get(l))).toEqual([]);
  });
  it('DI-35 노드 중심이 소속 계층 밴드 안 (기기=기기 layer, 모선·끝점=node.layer, 참조 타일 제외) + 모선 양 끝도 밴드 안', () => {
    const band = new Map(diagram.layers.map((l) => [l.id as string, l]));
    const bad: string[] = [];
    for (const n of diagram.nodes) {
      if (isEquipNode(n) && n.ref) continue; // 참조 타일: 같은 기기가 다른 계층 자리에 재등장 (예: 22.9/6.6kV TR 이 L4 밴드)
      const l = band.get(nodeLayerOf(n) ?? '');
      if (!l) continue;
      const r = bandRect(l);
      const xs = kindOf(n) === 'bus' ? [n.x - n.width! / 2, n.x + n.width! / 2] : [n.x];
      if (n.y < r.y || n.y > r.y + r.h || xs.some((x) => x < r.x || x > r.x + r.w))
        bad.push(`${n.id} (${kindOf(n)}): (${n.x},${n.y}) ∉ ${l.id}[x ${r.x}~${r.x + r.w}, y ${r.y}~${r.y + r.h}]`);
    }
    expect(bad).toEqual([]);
  });
  it('DI-36 node 박스(종류별 크기)가 캔버스 [0,width]×[0,height] 안', () => {
    const bad = diagram.nodes
      .filter((n) => {
        const { hw, hh } = halfSize(n);
        return n.x - hw < 0 || n.y - hh < 0 || n.x + hw > diagram.width || n.y + hh > diagram.height;
      })
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
  it('DI-39 노드 박스끼리 겹치지 않음 — 종류별 크기(타일 120×116, 끝점 120×44, 모선 width×8). SOFT: 타일·끝점 간격 30px 미만', () => {
    const bad: string[] = [];
    const tight: string[] = [];
    const ns = diagram.nodes;
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const a = halfSize(ns[i]);
        const b = halfSize(ns[j]);
        const gx = Math.abs(ns[i].x - ns[j].x) - a.hw - b.hw;
        const gy = Math.abs(ns[i].y - ns[j].y) - a.hh - b.hh;
        if (gx < 0 && gy < 0) bad.push(`${ns[i].id} ↔ ${ns[j].id} 겹침`);
        else if (kindOf(ns[i]) !== 'bus' && kindOf(ns[j]) !== 'bus' && gx < 30 && gy < 30) tight.push(`${ns[i].id} ↔ ${ns[j].id}`);
        if (Math.hypot(ns[i].x - ns[j].x, ns[i].y - ns[j].y) < MIN_NODE_DISTANCE) bad.push(`${ns[i].id} ↔ ${ns[j].id} 중심 거리 < ${MIN_NODE_DISTANCE}`);
      }
    }
    expect(bad).toEqual([]);
    softWarn('DI-39 간격', tight);
  });
  /** R-05 리더 결정: 패널·일괄설비 그룹 표시용으로 연결선 없이 두는 system 노드 (의도됨) */
  const KNOWN_ISOLATED_SYSTEM_NODES = ['n-substation', 'n-mv-swgr', 'n-lv-swgr', 'n-modular', 'n-railway'];

  it('DI-40 고립 노드 없음: edge ≥ 1 (예외: MON 감시 기기, category=system 기기 — R-05). 끝점·참조 타일은 예외 없음, 모선은 ≥ 2', () => {
    const degree = degreeMap();
    const bad = diagram.nodes
      .filter((n) => {
        const d = degree.get(n.id) ?? 0;
        if (kindOf(n) === 'bus') return d < 2;
        if (kindOf(n) === 'endpoint' || n.ref) return d < 1;
        const eq = equipmentById.get(n.equipmentTypeId ?? '');
        return eq?.layer !== 'MON' && eq?.category !== 'system' && d === 0;
      })
      .map((n) => `${n.id} (${kindOf(n)}${n.ref ? ' ref' : ''}, 연결 ${degree.get(n.id) ?? 0})`);
    expect(bad).toEqual([]);
    softWarn(
      'DI-40 R-05',
      diagram.nodes
        .filter((n) => isMainEquipNode(n) && equipmentById.get(n.equipmentTypeId!)?.category === 'system' && !degree.get(n.id))
        .map((n) => n.id)
        .filter((id) => !KNOWN_ISOLATED_SYSTEM_NODES.includes(id)),
    );
  });
  it('DI-41 L1 노드에서 L7 노드까지 경로 존재 (전원→부하 흐름이 끊기지 않음)', () => {
    const adj = new Map<string, string[]>();
    diagram.edges.forEach((e) => {
      adj.set(e.from, [...(adj.get(e.from) ?? []), e.to]);
      adj.set(e.to, [...(adj.get(e.to) ?? []), e.from]);
    });
    const starts = diagram.nodes.filter((n) => nodeLayerOf(n) === 'L1').map((n) => n.id);
    const targets = new Set(diagram.nodes.filter((n) => nodeLayerOf(n) === 'L7').map((n) => n.id));
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
    const byId = nodeById();
    const lay = (id: string) => (byId.get(id) ? nodeLayerOf(byId.get(id)!) : undefined);
    const bad = diagram.edges
      .filter((e) => {
        const a = idx(lay(e.from));
        const b = idx(lay(e.to));
        return a >= 0 && b >= 0 && Math.abs(a - b) > 1;
      })
      .map((e) => `${e.id}: ${lay(e.from)}→${lay(e.to)}`);
    expect(bad).toEqual([]);
  });
  it('DI-43 모든 equipmentType 이 참조 타일 제외 기기 노드로 정확히 1회 등장 (74종 = 기기 노드 수) + 참조 타일은 label 보유', () => {
    const main = diagram.nodes.filter(isMainEquipNode).map((n) => n.equipmentTypeId!);
    const used = new Set(main);
    expect(equipment.filter((e) => !used.has(e.id)).map((e) => e.id), '노드 없는 기기').toEqual([]);
    expect(duplicates(main), '두 번 이상 나온 기기 (재등장은 ref:true 로)').toEqual([]);
    expect(main.length).toBe(equipment.length);
    expect(
      diagram.nodes.filter((n) => isEquipNode(n) && n.ref && !n.label?.trim()).map((n) => n.id),
      '참조 타일 label 없음 (어느 자리인지 구분 불가)',
    ).toEqual([]);
  });
  it('DI-43b review: status 는 pending|approved, approved 면 reviewedBy·reviewedAt 필수 (SOFT: review 없음)', () => {
    softWarn('DI-43b', diagram.review ? [] : ['diagram.review 없음 — 검수 상태 표시 불가']);
    if (!diagram.review) return;
    expect(['pending', 'approved']).toContain(diagram.review.status);
    if (diagram.review.status === 'approved') {
      expect(diagram.review.reviewedBy?.trim(), 'approved 인데 reviewedBy 없음').toBeTruthy();
      expect(diagram.review.reviewedAt, 'approved 인데 reviewedAt 없음').toBeTruthy();
    }
    expect(DiagramSchema.safeParse({ ...diagram, review: { status: 'done' } }).success, '잘못된 status 통과').toBe(false);
  });
  it('DI-43c alt(택1) 연결선은 label 필수, 같은 label 그룹은 2개 이상 (+ alt·label 은 같은 그룹 이름 철자 일치)', () => {
    const alts = diagram.edges.filter((e) => e.kind === 'alt');
    expect(alts.filter((e) => !e.label?.trim()).map((e) => e.id), 'label 없는 alt').toEqual([]);
    const groups = new Map<string, string[]>();
    alts.forEach((e) => e.label && groups.set(e.label, [...(groups.get(e.label) ?? []), e.id]));
    expect([...groups].filter(([, ids]) => ids.length < 2).map(([l, ids]) => `"${l}": ${ids.join(',')} (1개뿐)`)).toEqual([]);
    // eslint-disable-next-line no-console
    console.info(`[DI-43c] alt 연결선 ${alts.length}개, 택1 그룹 ${groups.size}개`);
  });

  // ─────────────────────────────────────────────────────────────
  // DI-44 ~ 46 연결선 기하 (v0.6 R3) — scripts/build-diagram-data.py default_route / path_hits 와 같은 규칙
  //   노드 크기: 타일 120×116 (ref 포함), 끝점 120×44, 모선 width×8 (얇은 장애물, 여유 2px)
  //   타일·끝점 판정 여유 1px (생성기 CLEAR=10 은 생성 여유). points 가 없으면 기본 직교 경로.
  //   모선 연결은 항상 points (DI-46).
  // ─────────────────────────────────────────────────────────────
  type Pt = { x: number; y: number };
  type Seg = { p: Pt; q: Pt; edge: string };
  const CLEAR_TILE = 1;
  const CLEAR_BUS = 2;

  /** Python default_route 의 비모선 부분 (종류별 반높이 사용) */
  const defaultRoute = (a: DNode, b: DNode): Pt[] => {
    const A = halfSize(a);
    const B = halfSize(b);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dy) >= A.hh + B.hh + 20) {
      const s = Math.sign(dy);
      const y1 = a.y + s * A.hh;
      const y2 = b.y - s * B.hh;
      if (Math.abs(dx) < 4) return [{ x: a.x, y: y1 }, { x: a.x, y: y2 }];
      const my = Math.round((y1 + y2) / 2);
      return [{ x: a.x, y: y1 }, { x: a.x, y: my }, { x: b.x, y: my }, { x: b.x, y: y2 }];
    }
    const s = Math.sign(dx) || 1;
    const x1 = a.x + s * A.hw;
    const x2 = b.x - s * B.hw;
    if (Math.abs(dy) < 4) return [{ x: x1, y: a.y }, { x: x2, y: a.y }];
    const mx = Math.round((x1 + x2) / 2);
    return [{ x: x1, y: a.y }, { x: mx, y: a.y }, { x: mx, y: b.y }, { x: x2, y: b.y }];
  };
  /** 화면에 그려지는 경로: points 우선, 없으면 기본 경로 (모선 연결에 points 가 없으면 null → DI-46 에서 실패) */
  const pathOf = (e: Diagram['edges'][number], byId: Map<string, DNode>): Pt[] | null => {
    if (e.points) return e.points;
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b || kindOf(a) === 'bus' || kindOf(b) === 'bus') return null;
    return defaultRoute(a, b);
  };
  const segHitsNode = (p: Pt, q: Pt, n: DNode) => {
    const { hw, hh } = halfSize(n);
    const [lx, hx, ly, hy] = [Math.min(p.x, q.x), Math.max(p.x, q.x), Math.min(p.y, q.y), Math.max(p.y, q.y)];
    if (kindOf(n) === 'bus') {
      const c = CLEAR_BUS;
      return lx < n.x + hw + c && hx > n.x - hw - c && ly < n.y + hh + c && hy > n.y - hh - c;
    }
    const c = CLEAR_TILE;
    return lx < n.x + hw - c && hx > n.x - hw + c && ly < n.y + hh - c && hy > n.y - hh + c;
  };
  /** 직교 선분 교차: 가로·세로가 서로의 내부에서 만남 / 같은 방향이면 양의 길이로 겹침 */
  const segsCross = (s: Seg, t: Seg): boolean => {
    const horiz = (g: Seg) => g.p.y === g.q.y;
    const lo = (a: number, b: number) => Math.min(a, b);
    const hi = (a: number, b: number) => Math.max(a, b);
    if (horiz(s) !== horiz(t)) {
      const [h, v] = horiz(s) ? [s, t] : [t, s];
      const x = v.p.x;
      const y = h.p.y;
      return lo(h.p.x, h.q.x) < x && x < hi(h.p.x, h.q.x) && lo(v.p.y, v.q.y) < y && y < hi(v.p.y, v.q.y);
    }
    if (horiz(s)) {
      return s.p.y === t.p.y && lo(s.p.x, s.q.x) < hi(t.p.x, t.q.x) && lo(t.p.x, t.q.x) < hi(s.p.x, s.q.x);
    }
    return s.p.x === t.p.x && lo(s.p.y, s.q.y) < hi(t.p.y, t.q.y) && lo(t.p.y, t.q.y) < hi(s.p.y, s.q.y);
  };
  const segmentsOf = (e: Diagram['edges'][number], byId: Map<string, DNode>): Seg[] => {
    const pts = pathOf(e, byId) ?? [];
    return pts.slice(1).map((q, i) => ({ p: pts[i], q, edge: e.id }));
  };
  const crossings = (kinds: string[]) => {
    const byId = nodeById();
    const es = diagram.edges.filter((e) => kinds.includes(e.kind ?? 'power'));
    const out: string[] = [];
    for (let i = 0; i < es.length; i++) {
      for (let j = i + 1; j < es.length; j++) {
        const a = es[i];
        const b = es[j];
        if ([a.from, a.to].some((id) => id === b.from || id === b.to)) continue; // 공통 끝 노드 제외
        const sa = segmentsOf(a, byId);
        const sb = segmentsOf(b, byId);
        if (sa.some((s) => sb.some((t) => segsCross(s, t)))) out.push(`${a.id}(${a.from}→${a.to}) ✕ ${b.id}(${b.from}→${b.to})`);
      }
    }
    return out;
  };

  describe('DI-44 연결선 노드 관통 0건 (+ points 는 직교·노드 가장자리에서 시작/끝)', () => {
    it('DI-44a 각 선분이 양 끝 외 노드(타일·참조·끝점, 여유 1px / 모선 높이 8 + 여유 2px)를 지나가지 않음', () => {
      const byId = nodeById();
      const bad: string[] = [];
      for (const e of diagram.edges) {
        const pts = pathOf(e, byId);
        if (!pts) continue; // DI-46 에서 실패
        for (let i = 0; i + 1 < pts.length; i++) {
          for (const n of diagram.nodes) {
            if (n.id === e.from || n.id === e.to) continue;
            if (segHitsNode(pts[i], pts[i + 1], n)) bad.push(`${e.id} (${e.from}→${e.to}${e.points ? ', points' : ''}) 선분 ${i}이 ${n.id}(${kindOf(n)}) 관통`);
          }
        }
      }
      expect(bad).toEqual([]);
    });

    it('DI-44b points: 연속한 두 점은 직교, 첫/끝 점은 from/to 노드 가장자리 위 (모선 쪽 끝은 DI-46)', () => {
      const byId = nodeById();
      const onEdge = (p: Pt, n: DNode) => {
        const { hw, hh } = halfSize(n);
        const ex = Math.abs(Math.abs(p.x - n.x) - hw) <= 1 && Math.abs(p.y - n.y) <= hh + 1;
        const ey = Math.abs(Math.abs(p.y - n.y) - hh) <= 1 && Math.abs(p.x - n.x) <= hw + 1;
        return ex || ey;
      };
      const bad: string[] = [];
      for (const e of diagram.edges) {
        if (!e.points) continue;
        const pts = e.points;
        pts.slice(1).forEach((q, i) => {
          const p = pts[i];
          if (p.x !== q.x && p.y !== q.y) bad.push(`${e.id}: 점 ${i}→${i + 1} 사선 (${p.x},${p.y})→(${q.x},${q.y})`);
        });
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        if (a && kindOf(a) !== 'bus' && !onEdge(pts[0], a)) bad.push(`${e.id}: 첫 점 (${pts[0].x},${pts[0].y}) 이 ${a.id}(${a.x},${a.y}) 가장자리 밖`);
        const last = pts[pts.length - 1];
        if (b && kindOf(b) !== 'bus' && !onEdge(last, b)) bad.push(`${e.id}: 끝 점 (${last.x},${last.y}) 이 ${b.id}(${b.x},${b.y}) 가장자리 밖`);
      }
      expect(bad).toEqual([]);
    });

    it('DI-44 판정 함수 자기검증: 중간 타일·모선을 지나는 경로는 잡아내고, 비켜 가면 통과', () => {
      const tile = (id: string, x: number, y: number): DNode => ({ id, equipmentTypeId: 'vcb', x, y });
      const bus: DNode = { id: 'b', kind: 'bus', x: 300, y: 300, width: 200, label: 'b', layer: 'L4' };
      const pts = defaultRoute(tile('a', 100, 100), tile('c', 500, 100));
      expect(pts).toEqual([{ x: 160, y: 100 }, { x: 440, y: 100 }]);
      expect(segHitsNode(pts[0], pts[1], tile('m', 300, 100))).toBe(true);
      expect(segHitsNode(pts[0], pts[1], tile('m', 300, 159 + 1))).toBe(false);
      expect(segHitsNode({ x: 300, y: 200 }, { x: 300, y: 400 }, bus)).toBe(true); // 모선을 세로로 관통
      expect(segHitsNode({ x: 100, y: 295 }, { x: 500, y: 295 }, bus), '모선(±4) + 여유 2px 안').toBe(true);
      expect(segHitsNode({ x: 100, y: 294 }, { x: 500, y: 294 }, bus)).toBe(false);
      // 끝점(120×44)은 반높이 22 로 기본 경로를 만든다
      const ep: DNode = { id: 'p', kind: 'endpoint', x: 100, y: 300, label: 'p', layer: 'L6' };
      expect(defaultRoute(tile('a', 100, 100), ep)).toEqual([{ x: 100, y: 158 }, { x: 100, y: 278 }]);
    });
  });

  describe('DI-45 전력선(power·alt)끼리 교차 0건 (신호선 교차는 정보성)', () => {
    it('DI-45a 공통 끝 노드가 없는 전력선 두 개의 선분이 직교 교차하거나 같은 선 위에서 겹치지 않음', () => {
      expect(crossings(['power', 'alt'])).toEqual([]);
    });
    it('DI-45b (정보) 신호선 포함 교차 개수 — 실패시키지 않음', () => {
      const all = crossings(['power', 'alt', 'signal']).length;
      const power = crossings(['power', 'alt']).length;
      // eslint-disable-next-line no-console
      console.info(`[DI-45b] 교차: 전체 ${all}건, 전력선끼리 ${power}건, 신호선 관련 ${all - power}건`);
      expect(all).toBeGreaterThanOrEqual(power);
    });
    it('DI-45 판정 함수 자기검증', () => {
      const S = (ax: number, ay: number, bx: number, by: number): Seg => ({ p: { x: ax, y: ay }, q: { x: bx, y: by }, edge: '' });
      expect(segsCross(S(0, 50, 100, 50), S(50, 0, 50, 100))).toBe(true); // 십자
      expect(segsCross(S(0, 50, 100, 50), S(100, 0, 100, 100))).toBe(false); // 끝에서 닿음(T) → 교차 아님
      expect(segsCross(S(0, 50, 100, 50), S(60, 50, 200, 50))).toBe(true); // 같은 선 위 겹침
      expect(segsCross(S(0, 50, 100, 50), S(100, 50, 200, 50))).toBe(false); // 이어짐
      expect(segsCross(S(0, 50, 100, 50), S(0, 60, 100, 60))).toBe(false); // 평행
    });
  });

  it('DI-46 모선 연결선은 points 를 가지며, 모선 쪽 끝점이 모선 위(y=bus.y, x∈[x1,x2])이고 첫 선분이 수직', () => {
    const byId = nodeById();
    const bad: string[] = [];
    for (const e of diagram.edges) {
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      if (!a || !b) continue;
      for (const [bus, atStart] of [
        [a, true],
        [b, false],
      ] as const) {
        if (kindOf(bus) !== 'bus') continue;
        if (!e.points) {
          bad.push(`${e.id}: 모선(${bus.id}) 연결인데 points 없음`);
          continue;
        }
        const pts = atStart ? e.points : [...e.points].reverse();
        const [p, q] = pts;
        const x1 = bus.x - bus.width! / 2;
        const x2 = bus.x + bus.width! / 2;
        if (p.y !== bus.y || p.x < x1 || p.x > x2) bad.push(`${e.id}: 모선 끝 (${p.x},${p.y}) 이 ${bus.id}[y=${bus.y}, x ${x1}~${x2}] 위가 아님`);
        if (q && q.x !== p.x) bad.push(`${e.id}: 모선에서 수직으로 시작하지 않음 (${p.x},${p.y})→(${q.x},${q.y})`);
      }
    }
    expect(bad).toEqual([]);
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

// ─────────────────────────────────────────────────────────────
// 교육 콘텐츠 learn.json (DI-70 ~) — v0.4, v0.6 R3: 퀴즈·진도·수료 제거 (사용자 요청) → 퀴즈 규칙 DI-75·76 삭제
// 계약: src/content/learnSchema.ts (LearnContentSchema). 콘텐츠 소유 T1-B, 사실관계는 equipment-types.json 범위 안.
// ─────────────────────────────────────────────────────────────

const LEARN_PATH = fileURLToPath(new URL('../../src/content/learn.json', import.meta.url));

describe('교육 콘텐츠 learn.json (DI-70 ~)', () => {
  let raw: unknown;
  let learn: LearnContent;

  beforeAll(() => {
    raw = JSON.parse(readFileSync(LEARN_PATH, 'utf8'));
    learn = LearnContentSchema.parse(raw);
  });

  it('DI-70 learn.json 이 존재하고 LearnContentSchema 통과 (+ 잘못된 값은 거부)', () => {
    expect(existsSync(LEARN_PATH)).toBe(true);
    expect(LearnContentSchema.safeParse(raw).success).toBe(true);
    const base = raw as LearnContent;
    // 스키마가 너무 느슨해지는 회귀 방지
    const swapped = { ...base, steps: [base.steps[1], base.steps[0], ...base.steps.slice(2)] };
    expect(LearnContentSchema.safeParse(swapped).success, 'L1·L2 순서가 바뀌어도 통과함').toBe(false);
    expect(LearnContentSchema.safeParse({ ...base, steps: base.steps.slice(0, 6) }).success, '6단계도 통과함').toBe(false);
    const { reviewStatus: _omit, ...noStatus } = base;
    expect(LearnContentSchema.safeParse(noStatus).success, 'reviewStatus 없이도 통과함').toBe(false);
  });

  it('DI-71 단계가 L1→L7 순서, 중복·누락 없음', () => {
    expect(learn.steps.map((s) => s.layer)).toEqual([...MAIN_LAYERS]);
    expect(duplicates(learn.steps.map((s) => s.layer))).toEqual([]);
  });

  it('DI-72 핵심 기기(keyEquipmentIds) 가 equipment-types.json 에 존재 + 단계 안 중복 없음', () => {
    const bad = learn.steps.flatMap((s) => [
      ...s.keyEquipmentIds.filter((id) => !equipmentById.has(id)).map((id) => `${s.layer}: 없는 기기 ${id}`),
      ...duplicates(s.keyEquipmentIds).map((id) => `${s.layer}: 중복 ${id}`),
    ]);
    expect(bad).toEqual([]);
  });

  it('DI-73 핵심 기기는 그 단계 계층(layer)의 기기', () => {
    const bad = learn.steps.flatMap((s) =>
      s.keyEquipmentIds
        .filter((id) => equipmentById.has(id) && equipmentById.get(id)!.layer !== s.layer)
        .map((id) => `${s.layer}: ${id} 는 ${equipmentById.get(id)!.layer} 기기`),
    );
    expect(bad).toEqual([]);
  });

  it('DI-74 용어집 equipmentId 가 equipment-types.json 에 존재 + 용어 중복 없음', () => {
    const bad = learn.glossary
      .filter((g) => g.equipmentId !== undefined && !equipmentById.has(g.equipmentId))
      .map((g) => `${g.term}: 없는 기기 ${g.equipmentId}`);
    expect(bad).toEqual([]);
    expect(duplicates(learn.glossary.map((g) => g.term.trim()))).toEqual([]);
  });

  it('DI-75 (v0.6 R3) 퀴즈 제거: learn.json 단계에 quizzes 키가 남아 있지 않음', () => {
    const steps = (raw as { steps: Record<string, unknown>[] }).steps;
    expect(steps.filter((s) => 'quizzes' in s).map((s) => String(s.layer))).toEqual([]);
  });

  it('DI-77 reviewStatus 필드 존재 (공백 아님)', () => {
    expect(typeof (raw as Record<string, unknown>).reviewStatus).toBe('string');
    expect(learn.reviewStatus.trim()).not.toBe('');
  });

  it('DI-78 (SOFT) reviewStatus 가 draft 이면 경고 (교육 담당자 검토 전)', () => {
    softWarn('DI-78', /draft/i.test(learn.reviewStatus) ? [`reviewStatus="${learn.reviewStatus}"`] : []);
  });

  it('DI-79 (SOFT) 공개 사이트 — 대외비 키워드·개인정보 패턴 없음 (단계 제목·intro·용어집)', () => {
    const texts = [...learn.steps.flatMap((s) => [s.title, s.intro]), ...learn.glossary.flatMap((g) => [g.term, g.meaning])];
    softWarn(
      'DI-79',
      texts.filter((t) => /대외비|내부용|사내한정|confidential/i.test(t) || EMAIL_RE.test(t) || PHONE_RE.test(t)),
    );
  });
});

// ─────────────────────────────────────────────────────────────
// 기기 대표 사진 equipment-images.json (DI-80 ~) — v0.4
// 계약: EquipmentImagesSchema (src/lib/schema.ts). 키 = equipmentType.id, file = public/ 기준 상대 경로.
// ─────────────────────────────────────────────────────────────
const PUBLIC_DIR = fileURLToPath(new URL('../../public/', import.meta.url));

describe('기기 사진 equipment-images.json (DI-80 ~)', () => {
  const IMAGES_FILE = 'equipment-images.json';
  let raw: unknown;
  let images: [string, EquipmentImage][] = [];

  beforeAll(() => {
    raw = readJson(IMAGES_FILE);
    images = Object.entries(EquipmentImagesSchema.parse(raw));
  });

  it('DI-80 파일 존재 + EquipmentImagesSchema 통과 (+ 잘못된 값은 거부)', () => {
    expect(existsSync(DATA_DIR + IMAGES_FILE)).toBe(true);
    expect(EquipmentImagesSchema.safeParse(raw).success).toBe(true);
    const ok = { file: 'images/equipment/vcb.png', thumb: 'images/equipment/thumb/vcb.png', productId: null, productName: null, sourceUrl: 'https://www.ls-electric.com/a.png', bytes: 1 };
    expect(EquipmentImagesSchema.safeParse({ vcb: ok }).success).toBe(true);
    expect(EquipmentImagesSchema.safeParse({ vcb: { ...ok, file: '/images/equipment/vcb.png' } }).success, '절대경로(base ./ 깨짐)').toBe(false);
    expect(EquipmentImagesSchema.safeParse({ vcb: { ...ok, file: 'images/equipment/../x.png' } }).success, '경로 탈출').toBe(false);
    expect(EquipmentImagesSchema.safeParse({ vcb: { ...ok, sourceUrl: 'http://x.com/a.png' } }).success, 'http 출처').toBe(false);
    expect(EquipmentImagesSchema.safeParse({ vcb: { ...ok, bytes: 0 } }).success, 'bytes 0').toBe(false);
    const { thumb: _t, ...noThumb } = ok;
    expect(EquipmentImagesSchema.safeParse({ vcb: noThumb }).success, 'thumb 누락 (v0.5 R2 필수)').toBe(false);
    expect(EquipmentImagesSchema.safeParse({ vcb: { ...ok, thumb: 'images/equipment/vcb.png' } }).success, 'thumb 이 thumb/ 폴더 밖').toBe(false);
  });

  it('DI-81 키(기기 id)가 equipment-types.json 에 존재', () => {
    expect(images.map(([id]) => id).filter((id) => !equipmentById.has(id))).toEqual([]);
  });

  it('DI-82 사진 파일이 public/ 아래 실제로 존재 (배포 후 깨진 이미지 방지)', () => {
    expect(images.filter(([, v]) => !existsSync(PUBLIC_DIR + v.file)).map(([id, v]) => `${id}: public/${v.file}`)).toEqual([]);
  });

  it('DI-82b 썸네일(thumb, 160px) 파일이 public/ 아래 실제로 존재 + 원본보다 크지 않음 (v0.5 R2)', () => {
    expect(images.filter(([, v]) => !existsSync(PUBLIC_DIR + v.thumb)).map(([id, v]) => `${id}: public/${v.thumb}`)).toEqual([]);
    expect(
      images
        .filter(([, v]) => existsSync(PUBLIC_DIR + v.thumb) && existsSync(PUBLIC_DIR + v.file))
        .filter(([, v]) => statSync(PUBLIC_DIR + v.thumb).size > statSync(PUBLIC_DIR + v.file).size)
        .map(([id]) => `${id}: thumb 이 원본보다 큼`),
    ).toEqual([]);
  });

  it('DI-83 productId 가 있으면 products.json 에 존재', () => {
    expect(
      images.filter(([, v]) => v.productId !== null && !productById.has(v.productId)).map(([id, v]) => `${id}: ${v.productId}`),
    ).toEqual([]);
  });

  it('DI-84 출처(sourceUrl)는 공식 사이트 *.ls-electric.com', () => {
    expect(images.filter(([, v]) => !LSE_URL_RE.test(v.sourceUrl)).map(([id, v]) => `${id}: ${v.sourceUrl}`)).toEqual([]);
  });

  it('DI-85 (SOFT) missing·na 기기에는 사진이 없어야 함 (화면은 단선결선도 심볼 + 점선 — 디자인 규칙)', () => {
    softWarn(
      'DI-85',
      images
        .filter(([id]) => ['missing', 'na'].includes(equipmentById.get(id)?.coverage ?? ''))
        .map(([id]) => `${id} (${equipmentById.get(id)!.coverage}) 에 사진이 지정됨`),
    );
  });

  it('DI-86 (SOFT) 파일 크기가 bytes 와 다르거나 500KB 초과 (사진 교체 누락·모바일 로딩 지연)', () => {
    const warn: string[] = [];
    for (const [id, v] of images) {
      if (!existsSync(PUBLIC_DIR + v.file)) continue;
      const size = statSync(PUBLIC_DIR + v.file).size;
      if (size !== v.bytes) warn.push(`${id}: 실제 ${size}B ≠ bytes ${v.bytes}`);
      if (size > 500 * 1024) warn.push(`${id}: ${Math.round(size / 1024)}KB`);
      if (existsSync(PUBLIC_DIR + v.thumb) && statSync(PUBLIC_DIR + v.thumb).size > 500 * 1024) warn.push(`${id}: thumb ${Math.round(statSync(PUBLIC_DIR + v.thumb).size / 1024)}KB`);
    }
    softWarn('DI-86', warn);
  });
});
