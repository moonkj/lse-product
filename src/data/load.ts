import { z } from 'zod';
import {
  CategoriesSchema,
  DiagramSchema,
  DocsFileSchema,
  SpecsFileSchema,
  EquipmentTypesSchema,
  EquipmentImagesSchema,
  ProductsSchema,
  type EquipmentImage,
  type Category,
  type Diagram,
  type EquipmentType,
  type Product,
  type ProductDocs,
  type ProductSpecs,
} from '../lib/schema';
import productsJson from './products.json';
import categoriesJson from './categories.json';
import equipmentTypesJson from './equipment-types.json';
import diagramJson from './diagram.json';
import docsJson from './docs.json';
import specsJson from './specs.json';
import equipmentImagesJson from './equipment-images.json';

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
  /** specs.json — 카탈로그 추출 정격 사양 (없는 제품은 키 없음) */
  specsByProductId: Map<string, ProductSpecs>;
  /** equipment-images.json — 기기별 대표 사진 (없는 기기는 키가 없음 → 단선결선도 심볼로 표시) */
  equipmentImageById: Map<string, EquipmentImage>;
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
  const specs = parseOrThrow(SpecsFileSchema, specsJson, 'specs.json');
  const images = parseOrThrow(EquipmentImagesSchema, equipmentImagesJson, 'equipment-images.json');
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
    specsByProductId: new Map(Object.entries(specs.products)),
    equipmentImageById: new Map(Object.entries(images)),
  };
  return cache;
}

/** 컴포넌트용 별칭 (렌더 중 호출) */
export const useData = getData;

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
