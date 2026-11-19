import { z } from 'zod';
import {
  CategoriesSchema,
  DiagramSchema,
  DocsFileSchema,
  SpecsFileSchema,
  EquipmentTypesSchema,
  EquipmentImagesSchema,
  ProductImagesSchema,
  ProductsSchema,
  type EquipmentImage,
  type ProductImage,
  type Category,
  type Diagram,
  type EquipmentType,
  type Product,
  type ProductDocs,
  type ProductSpecs,
  type EquipmentFamily,
  FamiliesFileSchema,
} from '../lib/schema';
import productsJson from './products.json';
import categoriesJson from './categories.json';
import equipmentTypesJson from './equipment-types.json';
import diagramJson from './diagram.json';
import docsJson from './docs.json';
import equipmentImagesJson from './equipment-images.json';
import productImagesJson from './product-images.json';
import familiesJson from './families.json';

import { DataValidationError } from '../lib/errors';
/** 호환용 재수출 — 새 코드는 '../lib/errors' 에서 import */
export { DataValidationError };

function parseOrThrow<S extends z.ZodType>(schema: S, data: unknown, file: string): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) throw new DataValidationError(file, result.error);
  return result.data;
}

export interface AppData {
  products: Product[];
  categories: Category[];
  equipmentTypes: EquipmentType[];
  diagram: Diagram;
  docsGeneratedAt: string;
  productById: Map<string, Product>;
  categoryByCode: Map<string, Category>;
  equipmentTypeById: Map<string, EquipmentType>;
  /** docs.json — 제품별 자료 (없는 제품은 키가 없음) */
  docsByProductId: Map<string, ProductDocs>;
  /** equipment-images.json — 기기별 대표 사진 (없는 기기는 키가 없음 → 단선결선도 심볼로 표시) */
  equipmentImageById: Map<string, EquipmentImage>;
  /** product-images.json — 제품별 사진. products 에 있는 제품만 (고아 항목 제외). 없으면 기기 대표 사진으로 대체 */
  productImageById: Map<string, ProductImage>;
  /** families.json — 시스템·솔루션 기기의 공식 제품군 정보(설명·관련 제품·카탈로그) */
  familyByEquipmentId: Map<string, EquipmentFamily>;
}

let cache: AppData | undefined;

/**
 * 데이터 로딩·검증. 모듈 import 시점이 아니라 **렌더 중에** 호출되어야
 * 검증 실패가 ErrorBoundary 로 잡힌다. 결과는 메모해 두고 재사용.
 */
export function getData(): AppData {
  if (cache) return cache;
  const products = parseOrThrow(ProductsSchema, productsJson, 'products.json');
  const categories = parseOrThrow(CategoriesSchema, categoriesJson, 'categories.json');
  const equipmentTypes = parseOrThrow(EquipmentTypesSchema, equipmentTypesJson, 'equipment-types.json');
  const diagram = parseOrThrow(DiagramSchema, diagramJson, 'diagram.json');
  const docs = parseOrThrow(DocsFileSchema, docsJson, 'docs.json');
  const images = parseOrThrow(EquipmentImagesSchema, equipmentImagesJson, 'equipment-images.json');
  const productImages = parseOrThrow(ProductImagesSchema, productImagesJson, 'product-images.json');
  const families = parseOrThrow(FamiliesFileSchema, familiesJson, 'families.json');
  const productIds = new Set(products.map((p) => p.id));
  cache = {
    products,
    categories,
    equipmentTypes,
    diagram,
    docsGeneratedAt: docs.generatedAt,
    productById: new Map(products.map((p) => [p.id, p])),
    categoryByCode: new Map(categories.map((c) => [c.code, c])),
    equipmentTypeById: new Map(equipmentTypes.map((e) => [e.id, e])),
    docsByProductId: new Map(Object.entries(docs.products)),
    equipmentImageById: new Map(Object.entries(images)),
    productImageById: new Map(Object.entries(productImages).filter(([id]) => productIds.has(id))),
    familyByEquipmentId: new Map(Object.entries(families.families)),
  };
  return cache;
}

/** 컴포넌트용 별칭 (렌더 중 호출) */
export const useData = getData;

// ───────────── 정격 사양 (specs.json) — 지연 로딩 ─────────────
// 비교 화면에서만 쓰므로 첫 화면 번들에서 빼고 dynamic import 로 따로 받는다 (2026-11-18 디버그 M6).
// 검증 실패는 getData() 와 달리 앱 전체 오류로 올리지 않고, 비교 화면이 거절된 Promise 를 받아 그 화면에서만 안내한다.

export type SpecsMap = Map<string, ProductSpecs>;

let specsCache: SpecsMap | undefined;
let specsPromise: Promise<SpecsMap> | undefined;

/** specs.json 을 불러와 SpecsFileSchema 로 검증한 뒤 제품 id → 사양 Map. 결과는 메모 (실패하면 다음 호출에서 재시도) */
export function loadSpecs(): Promise<SpecsMap> {
  specsPromise ??= import('./specs.json')
    .then((m) => {
      const file = parseOrThrow(SpecsFileSchema, m.default, 'specs.json');
      specsCache = new Map(Object.entries(file.products));
      return specsCache;
    })
    .catch((e: unknown) => {
      specsPromise = undefined;
      throw e;
    });
  return specsPromise;
}

/** 이미 불러온 사양 (아직이면 undefined) — 재방문 시 '불러오는 중' 깜빡임 없이 바로 그리기용 */
export function peekSpecs(): SpecsMap | undefined {
  return specsCache;
}

/** 제품별 자료 조회 */
export function docsByProductId(productId: string): ProductDocs | undefined {
  return getData().docsByProductId.get(productId);
}

/**
 * 기기 대표 사진 URL (GitHub Pages base './' 대응: BASE_URL 기준 상대 경로). 없으면 undefined → 심볼 표시
 */
export function equipmentImageUrl(equipmentId: string): string | undefined {
  const img = getData().equipmentImageById.get(equipmentId);
  return img ? `${import.meta.env.BASE_URL}${img.file}` : undefined;
}

/** 계통도 타일용 160px 썸네일 URL. 없으면 undefined → 심볼 표시 */
export function equipmentThumbUrl(equipmentId: string): string | undefined {
  const img = getData().equipmentImageById.get(equipmentId);
  return img ? `${import.meta.env.BASE_URL}${img.thumb}` : undefined;
}

/** 제품 사진 (없으면 undefined → 기기 대표 사진으로 대체). thumb=true 면 160px 썸네일 */
export function productImageUrl(productId: string, thumb = false): string | undefined {
  const img = getData().productImageById.get(productId);
  return img ? `${import.meta.env.BASE_URL}${thumb ? img.thumb : img.file}` : undefined;
}

/** 기기에 연결된 자사 제품: lseCategoryCodes 의 카테고리 제품(하위 포함) + productIds, 중복 제거 */
export function resolveProducts(eq: EquipmentType, data: AppData = getData()): Product[] {
  const ids = new Set<string>(eq.productIds ?? []);
  for (const code of eq.lseCategoryCodes) {
    for (const pid of data.categoryByCode.get(code)?.productIds ?? []) ids.add(pid);
    // 리더 결정 R-01: 하위 카테고리 포함 — 카테고리 코드는 접두사 계층(AAA015 ⊃ AAA015001)이므로 접두사로도 수집
    for (const p of data.products) if (p.categoryCode.startsWith(code)) ids.add(p.id);
  }
  return [...ids].map((id) => data.productById.get(id)).filter((p): p is Product => p !== undefined);
}

/** 기기에 연결된 카테고리 (제품 0개일 때 대체 링크용) */
export function resolveCategories(eq: EquipmentType, data: AppData = getData()): Category[] {
  return eq.lseCategoryCodes.map((c) => data.categoryByCode.get(c)).filter((c): c is Category => c !== undefined);
}
