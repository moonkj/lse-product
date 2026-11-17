import { z } from 'zod';

/**
 * 데이터 계약 (리더·T1·T3 공용). 필드명 변경 금지 — 추가는 optional 로만.
 */

/** L1~L7 계층 + REN(신재생·저장 연계) + MON(감시·제어) */
export const LayerSchema = z.enum(['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'REN', 'MON']);
export type Layer = z.infer<typeof LayerSchema>;
export const LAYERS = LayerSchema.options;

/** 커버리지 5상태 */
export const CoverageSchema = z.enum(['owned', 'partial', 'affiliate', 'missing', 'na']);
export type Coverage = z.infer<typeof CoverageSchema>;
export const COVERAGES = CoverageSchema.options;

export const EquipmentCategorySchema = z.enum([
  'switching',
  'protection',
  'transformation',
  'measurement',
  'control',
  'monitoring',
  'generation',
  'conductor',
  'load',
  'system',
]);
export type EquipmentCategory = z.infer<typeof EquipmentCategorySchema>;

/**
 * https 절대 URL 만 허용. z.url() 은 javascript:, http:, ftp: 등도 통과시키므로 프로토콜을 제한한다.
 * (Product.url, Category.url, DocRef.url 공통. 사내 상대경로 문서는 쓰지 않기로 결정)
 */
export const httpsUrl = z.url({ protocol: /^https$/, error: 'https:// 로 시작하는 절대 URL 이어야 합니다' });

const kebabId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'kebab-case id 여야 합니다 (예: vcb)');

export const EquipmentTypeSchema = z.object({
  id: kebabId,
  name: z.string().min(1),
  abbr: z.string().optional(),
  layer: LayerSchema,
  voltage: z.string(),
  category: EquipmentCategorySchema,
  description: z.string(),
  learnPoints: z.array(z.string()),
  coverage: CoverageSchema,
  affiliateName: z.string().optional(),
  gapNote: z.string().optional(),
  /** LS ELECTRIC 카테고리 코드, 예 ['AAA015001'] */
  lseCategoryCodes: z.array(z.string()),
  /** 특정 제품만 지정할 때, 예 ['P01062'] */
  productIds: z.array(z.string()).optional(),
});
export type EquipmentType = z.infer<typeof EquipmentTypeSchema>;

export const DocRefSchema = z.object({
  type: z.enum(['catalog', 'datasheet', 'manual', 'certificate', 'software', 'cad', 'other']),
  title: z.string(),
  /** https 절대 URL */
  url: httpsUrl,
  lang: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type DocRef = z.infer<typeof DocRefSchema>;

export const ProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  categoryCode: z.string(),
  categoryPath: z.array(z.string()),
  /** https 절대 URL */
  url: httpsUrl,
  business: z.enum(['power', 'automation']),
  discontinued: z.boolean(),
  docs: z.array(DocRefSchema),
});
export type Product = z.infer<typeof ProductSchema>;

export const CategorySchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  path: z.array(z.string()),
  /** https 절대 URL */
  url: httpsUrl,
  parentCode: z.string().optional(),
  productIds: z.array(z.string()),
});
export type Category = z.infer<typeof CategorySchema>;

export const DiagramLayerSchema = z.object({
  id: LayerSchema,
  label: z.string(),
  voltage: z.string(),
  y: z.number(),
  height: z.number(),
  /** 생략 시 0 (MON·REN 은 오른쪽 세로 열) */
  x: z.number().optional(),
  /** 생략 시 diagram.width */
  width: z.number().optional(),
});
export type DiagramLayer = z.infer<typeof DiagramLayerSchema>;

export const DiagramNodeSchema = z.object({
  id: z.string().min(1),
  equipmentTypeId: z.string().min(1),
  x: z.number(),
  y: z.number(),
  label: z.string().optional(),
});
export type DiagramNode = z.infer<typeof DiagramNodeSchema>;

export const DiagramEdgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  voltage: z.string().optional(),
  kind: z.enum(['power', 'signal']).optional(),
});
export type DiagramEdge = z.infer<typeof DiagramEdgeSchema>;

export const DiagramSchema = z.object({
  width: z.number(),
  height: z.number(),
  layers: z.array(DiagramLayerSchema),
  nodes: z.array(DiagramNodeSchema),
  edges: z.array(DiagramEdgeSchema),
});
export type Diagram = z.infer<typeof DiagramSchema>;

/**
 * src/data/docs.json — scripts/fetch-docs.mjs 가 생성하는 제품별 자료 목록.
 * products.json 의 docs 필드와 별개 파일 (fetch-products 재실행 시 지워지지 않도록 분리).
 */
export const DocSourceSchema = z.enum(['www', 'ssq']);
export type DocSource = z.infer<typeof DocSourceSchema>;

export const ProductDocsSchema = z.object({
  source: DocSourceSchema,
  /** 공식 자료실에서 이 제품의 전체 자료를 보는 주소 */
  deepLink: httpsUrl,
  docs: z.array(DocRefSchema),
});
export type ProductDocs = z.infer<typeof ProductDocsSchema>;

export const DocsFileSchema = z.object({
  generatedAt: z.string(),
  /** key = Product.id */
  products: z.record(z.string(), ProductDocsSchema),
});
export type DocsFile = z.infer<typeof DocsFileSchema>;

export const EquipmentTypesSchema = z.array(EquipmentTypeSchema);
export const ProductsSchema = z.array(ProductSchema);
export const CategoriesSchema = z.array(CategorySchema);

/** UI 라벨 (한국어) */
export const LAYER_LABELS: Record<Layer, string> = {
  L1: '초고압 발전·송전',
  L2: '송변전',
  L3: '특고압 배전',
  L4: '수전설비',
  L5: '변압',
  L6: '저압 배전',
  L7: '분전반 및 하단',
  REN: '신재생·저장 연계',
  MON: '감시·제어',
};

export const COVERAGE_LABELS: Record<Coverage, string> = {
  owned: '보유',
  partial: '일부 보유',
  affiliate: '계열사 보유',
  missing: '미보유(공백)',
  na: '해당 없음',
};

export const DOC_TYPE_LABELS: Record<DocRef['type'], string> = {
  catalog: '카탈로그',
  datasheet: '데이터시트',
  manual: '매뉴얼',
  certificate: '인증서',
  software: '소프트웨어',
  cad: 'CAD',
  other: '기타',
};
