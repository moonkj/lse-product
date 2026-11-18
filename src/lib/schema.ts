import { z } from 'zod';

/**
 * 데이터 계약 (리더·T1·T3 공용). 필드명 변경 금지 — 추가는 optional 로만.
 */

/** L1~L7 계층 + REN(신재생·저장 연계) + MON(감시·제어) */
export const LayerSchema = z.enum(['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'REN', 'MON']);
export type Layer = z.infer<typeof LayerSchema>;
export const LAYERS = LayerSchema.options;

/**
 * 커버리지 6상태. sourced = 패널 구성품·타사 조달 (수배전반에 타사 제품을 넣어 공급하는 구성품, 개선 R3 · 사용자 승인)
 */
export const CoverageSchema = z.enum(['owned', 'partial', 'affiliate', 'sourced', 'missing', 'na']);
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
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다');

/**
 * 공백 판정 근거 (개선 R3, 연구소 제안 스키마). 미보유·일부 보유·계열사·패널 구성품 기기는 필수.
 * - confidence: candidate(공백 후보 — 화면에 점선) / confirmed(확정 — 실선)
 * - basis 가 homepage-menu 면 candidate 만 허용, confirmed 면 verifiedBy·verifiedAt 필수
 */
export const GapAssessmentSchema = z
  .object({
    supplyMode: z.enum(['in-house', 'affiliate', 'panel-sourced', 'not-offered', 'unknown']),
    basis: z.enum(['homepage-menu', 'catalog', 'bu-confirmed', 'rnd-confirmed']),
    confidence: z.enum(['candidate', 'confirmed']),
    evidence: z
      .array(z.object({ type: z.enum(['url', 'doc', 'meeting']), ref: z.string().min(1), note: z.string().optional() }))
      .optional(),
    /** 확인 부서명 (개인 실명 금지) */
    verifiedBy: z.string().optional(),
    verifiedAt: isoDate.optional(),
    /** 재확인 기한 — 지나면 화면에서 후보로 취급 */
    reviewDue: isoDate.optional(),
    ratingScope: z.object({ required: z.string().optional(), offered: z.string().optional() }).optional(),
  })
  .superRefine((g, ctx) => {
    if (g.basis === 'homepage-menu' && g.confidence === 'confirmed')
      ctx.addIssue({ code: 'custom', path: ['confidence'], message: '홈페이지 메뉴 근거만으로는 확정할 수 없습니다 (candidate)' });
    if (g.confidence === 'confirmed' && (!g.verifiedBy || !g.verifiedAt))
      ctx.addIssue({ code: 'custom', path: ['verifiedBy'], message: '확정하려면 확인 부서와 확인일이 필요합니다' });
  });
export type GapAssessment = z.infer<typeof GapAssessmentSchema>;

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
  /** 공백 판정 근거 — missing·partial·affiliate·sourced 는 필수 (DI 테스트·관리자 폼에서 검사) */
  gapAssessment: GapAssessmentSchema.optional(),
});
export type EquipmentType = z.infer<typeof EquipmentTypeSchema>;
/** 판정 근거가 필요한 커버리지 */
export const ASSESSED_COVERAGES: readonly Coverage[] = ['missing', 'partial', 'affiliate', 'sourced'];

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

/**
 * 계통도 노드 (개선 R3에서 종류 확장)
 * - equipment (기본): 기기 사진 타일. equipmentTypeId 필수. ref=true 면 참조 타일(같은 기기 재등장, 흐리게·집계·검색 제외)
 * - bus: 모선(굵은 가로선). x=중심, width=길이, label·layer 필수. 연결선은 모선 위 점에서 수직으로 내려감
 * - endpoint: 기기가 아닌 끝점 라벨(예: "비상 부하", 연계 표시). label·layer 필수, 120×44
 */
export const DiagramNodeKindSchema = z.enum(['equipment', 'bus', 'endpoint']);
export type DiagramNodeKind = z.infer<typeof DiagramNodeKindSchema>;
export const DiagramNodeSchema = z
  .object({
    id: z.string().min(1),
    kind: DiagramNodeKindSchema.optional(),
    equipmentTypeId: z.string().min(1).optional(),
    ref: z.boolean().optional(),
    x: z.number(),
    y: z.number(),
    label: z.string().optional(),
    /** bus·endpoint 의 소속 계층 */
    layer: LayerSchema.optional(),
    /** bus 길이(px) */
    width: z.number().positive().optional(),
  })
  .superRefine((n, ctx) => {
    const kind = n.kind ?? 'equipment';
    if (kind === 'equipment' && !n.equipmentTypeId)
      ctx.addIssue({ code: 'custom', path: ['equipmentTypeId'], message: '기기 노드에는 equipmentTypeId 가 필요합니다' });
    if (kind !== 'equipment' && (n.equipmentTypeId || n.ref))
      ctx.addIssue({ code: 'custom', path: ['kind'], message: '모선·끝점 노드에는 equipmentTypeId·ref 를 쓰지 않습니다' });
    if (kind !== 'equipment' && (!n.label || !n.layer))
      ctx.addIssue({ code: 'custom', path: ['label'], message: '모선·끝점 노드에는 label 과 layer 가 필요합니다' });
    if (kind === 'bus' && !n.width) ctx.addIssue({ code: 'custom', path: ['width'], message: '모선에는 width 가 필요합니다' });
  });
export type DiagramNode = z.infer<typeof DiagramNodeSchema>;

export const DiagramEdgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  voltage: z.string().optional(),
  /** alt = 택1(대체 관계) 연결 — 점선 + label 로 "어느 하나" 를 표시 */
  kind: z.enum(['power', 'signal', 'alt']).optional(),
  /** 연결선 설명 (택1 그룹 이름, 피더 설명 등) */
  label: z.string().optional(),
  /** 기본 직교 경로가 다른 타일을 지나갈 때 생성기가 계산한 우회 경로(타일 가장자리→…→타일 가장자리). 있으면 그대로 그린다 */
  points: z.array(z.object({ x: z.number(), y: z.number() })).min(2).optional(),
});
export type DiagramEdge = z.infer<typeof DiagramEdgeSchema>;

export const DiagramSchema = z.object({
  width: z.number(),
  height: z.number(),
  /** 계통 검수 상태 (설계팀 검수 대기 표시용) */
  review: z
    .object({
      status: z.enum(['pending', 'approved']),
      changedAt: isoDate.optional(),
      reviewedBy: z.string().optional(),
      reviewedAt: isoDate.optional(),
      note: z.string().optional(),
    })
    .optional(),
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

/** equipment-images.json — 기기별 대표 제품 사진 (scripts/fetch-images.mjs 생성, 리더 소유) */
export const EquipmentImageSchema = z.object({
  file: z.string().regex(/^images\/equipment\/[a-z0-9-]+\.(png|jpg|webp)$/),
  /** 160px 썸네일 (계통도 타일용). 원본 file 은 320px (패널·페이지용) */
  thumb: z.string().regex(/^images\/equipment\/thumb\/[a-z0-9-]+\.(png|jpg|webp)$/),
  productId: z.string().nullable(),
  productName: z.string().nullable(),
  sourceUrl: httpsUrl,
  bytes: z.number().int().positive(),
});
export const EquipmentImagesSchema = z.record(z.string(), EquipmentImageSchema);
export type EquipmentImage = z.infer<typeof EquipmentImageSchema>;

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
  sourced: '패널 구성품(타사 조달)',
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
