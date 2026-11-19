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

/** 계통에서 하는 일 — 상세 설명 (2026-11-18 사용자 요청: 카탈로그·데이터시트 근거로 보강). description 은 한 줄 요약(타일·모바일 요약) */
export const OverviewSourceSchema = z.object({
  title: z.string().min(1),
  url: httpsUrl,
  page: z.number().int().positive().optional(),
});
export const OverviewPointSchema = z.object({
  /** 항목 라벨 — 역할·동작 원리·선정 포인트·제품 설명·패널 구성 */
  label: z.string().min(1),
  text: z.string().min(1),
});
export type OverviewPoint = z.infer<typeof OverviewPointSchema>;
export const EquipmentOverviewSchema = z.object({
  /** 요약 한두 문장 */
  summary: z.string().min(1),
  /** 항목별 설명 (라벨 + 본문) */
  points: z.array(OverviewPointSchema).min(1),
  /** basis·sources 는 데이터 추적용 — 화면에는 쓰지 않는다 */
  /** catalog = 카탈로그·데이터시트·공식 제품 페이지 근거, general = 일반 기술 설명(자사 자료 없음) */
  basis: z.enum(['catalog', 'general']),
  sources: z.array(OverviewSourceSchema),
});
export type EquipmentOverview = z.infer<typeof EquipmentOverviewSchema>;

export const EquipmentTypeSchema = z.object({
  id: kebabId,
  name: z.string().min(1),
  abbr: z.string().optional(),
  layer: LayerSchema,
  voltage: z.string(),
  category: EquipmentCategorySchema,
  description: z.string(),
  overview: EquipmentOverviewSchema.optional(),
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
  /**
   * 검색 별칭 (2026-11-18 사용자 결정: 브랜드명은 검색 별칭만, 타일에는 표기하지 않음).
   * 대표 브랜드(GIMAC·XGT·Susol…)와 제품 id 없는 카테고리형 라인(Metasol MMS·M1000·E TAG…)의 모델명.
   * 화면에는 보이지 않고 헤더 검색(searchRank)만 쓴다.
   */
  searchAliases: z.array(z.string().min(1)).optional(),
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

/**
 * 제품 출처 (2026-11-18 사용자 결정: 국문·영문·Solution Square 전 제품).
 * ko = 국문 사이트(기본), en = 영문 사이트 전용 시리즈, ssq = Solution Square(sol.ls-electric.com) 전용 라인.
 * 생략 = ko. 출처별 id 형식은 integrity PRODUCT_ID_RE_BY_SOURCE (ko: P00000·D000000(자료실), en: EN-…, ssq: SSQ-…)
 */
export const ProductSourceSchema = z.enum(['ko', 'en', 'ssq']);
export type ProductSource = z.infer<typeof ProductSourceSchema>;
export const PRODUCT_SOURCE_LABELS: Record<ProductSource, string> = { ko: '국문 사이트', en: '영문 사이트', ssq: 'Solution Square' };

export const ProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  categoryCode: z.string(),
  categoryPath: z.array(z.string()),
  /** 공식 페이지 https 절대 URL (출처 사이트의 제품·카테고리 페이지, 자료실 제품은 카탈로그 PDF) */
  url: httpsUrl,
  /** 출처 — 생략 = ko */
  source: ProductSourceSchema.optional(),
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
  /**
   * 전기 흐름 방향 (계통도 흐름 애니메이션). 생략 = forward(from→to).
   * reverse = to→from 으로 흐름, bi = 양방향(충·방전 — 움직이지 않고 ⇄ 표지만)
   */
  /** 흐름 방향 — none = 전력이 흐르는 경로가 아님(피뢰기·계기용 변성기·서지보호기 분기, 전동기→감속기 기계 연결) */
  flow: z.enum(['forward', 'reverse', 'bi', 'none']).optional(),
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

/**
 * src/data/specs.json — 공개 카탈로그에서 추출한 제품 대표 정격 사양 (비교 기능용, 2026-11-18 사용자 요청).
 * 값마다 출처(카탈로그 제목·URL·페이지)를 남기고, reviewed=false 면 화면에 "카탈로그 추출값 · 검수 전" 표시.
 * key 는 SPEC_KEYS 의 표준 키를 우선 사용 (비교표 행 정렬 기준). 표에 없는 키는 label 로 표시.
 */
export const SPEC_KEYS = {
  ratedVoltage: '정격전압',
  ratedCurrent: '정격전류',
  breakingCapacity: '정격차단전류',
  frame: '프레임',
  poles: '극수',
  capacity: '정격용량',
  frequency: '정격주파수',
  insulation: '절연·냉각 방식',
  motorPower: '적용 전동기 용량',
  protection: '보호 기능',
  communication: '통신',
  mounting: '설치·인출 방식',
  standards: '적용 규격',
} as const;
export type StandardSpecKey = keyof typeof SPEC_KEYS;

export const SpecItemSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  /** 카탈로그 표기 그대로 (범위는 "630~6300" 처럼) */
  value: z.string().min(1),
  unit: z.string().optional(),
  /** 이 값이 실린 카탈로그 페이지 (source.page 와 다를 때) */
  page: z.number().int().positive().optional(),
});
export type SpecItem = z.infer<typeof SpecItemSchema>;

/**
 * 모델 옵션(프레임·전압 등급·통신 옵션·용량 등)별 사양 (2026-11-18 사용자: "사양이 모델 옵션별로 다름").
 * id 는 제품 안에서 고유한 kebab-case (URL 에 쓰임: /compare?type=product&ids=P00206:4000af)
 */
export const SpecVariantSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'kebab-case id 여야 합니다 (예: 4000af)'),
  /** 화면 표시 이름 (카탈로그 표기 그대로, 예: "4000AF (G-Frame)") */
  label: z.string().min(1),
  items: z.array(SpecItemSchema).min(1),
  /** 이 옵션 표가 실린 페이지 */
  page: z.number().int().positive().optional(),
  note: z.string().optional(),
});
export type SpecVariant = z.infer<typeof SpecVariantSchema>;

export const ProductSpecsSchema = z
  .object({
    /** 시리즈 공통 사양 (옵션과 관계없이 같은 값, 또는 옵션이 없는 제품의 사양) */
    items: z.array(SpecItemSchema),
    /** 옵션별 사양 — 옵션마다 값이 다른 항목은 여기에 */
    variants: z.array(SpecVariantSchema).optional(),
    /** 옵션을 나누는 기준 이름 (예: "프레임", "정격전압 등급", "통신 옵션") */
    variantAxis: z.string().optional(),
    source: z.object({ title: z.string().min(1), url: httpsUrl, page: z.number().int().positive().optional() }),
    extractedAt: isoDate,
    /** 사람이 카탈로그와 대조해 검수했는지 */
    reviewed: z.boolean(),
    note: z.string().optional(),
  })
  .superRefine((p, ctx) => {
    if (p.items.length === 0 && !(p.variants && p.variants.length > 0))
      ctx.addIssue({ code: 'custom', path: ['items'], message: '공통 사양이나 옵션별 사양 중 하나는 있어야 합니다' });
    if (p.variants && p.variants.length > 0 && !p.variantAxis)
      ctx.addIssue({ code: 'custom', path: ['variantAxis'], message: '옵션별 사양이 있으면 variantAxis(옵션 기준 이름)가 필요합니다' });
    const ids = new Set<string>();
    for (const [i, v] of (p.variants ?? []).entries()) {
      if (ids.has(v.id)) ctx.addIssue({ code: 'custom', path: ['variants', i, 'id'], message: `옵션 id 중복: ${v.id}` });
      ids.add(v.id);
    }
  });
export type ProductSpecs = z.infer<typeof ProductSpecsSchema>;

export const SpecsFileSchema = z.object({
  generatedAt: z.string(),
  /** key = Product.id */
  products: z.record(z.string(), ProductSpecsSchema),
});
export type SpecsFile = z.infer<typeof SpecsFileSchema>;

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

/**
 * product-images.json — 제품별 대표 사진 (key = Product.id).
 * 같은 원본(sourceUrl)을 쓰는 제품끼리는 파일 하나를 공유할 수 있다.
 * products.json 에서 빠진 제품의 항목(고아)은 화면에서 쓰지 않는다 (load.ts 의 productImageById 가 걸러 냄).
 */
export const ProductImageSchema = z.object({
  file: z.string().regex(/^images\/products\/[A-Za-z0-9-]+\.(png|jpg|webp)$/),
  /** 160px 썸네일 (목록·비교 열 머리용) */
  thumb: z.string().regex(/^images\/products\/thumb\/[A-Za-z0-9-]+\.(png|jpg|webp)$/),
  sourceUrl: httpsUrl,
  bytes: z.number().int().positive(),
  /** 원본 가로 px (최대 455). 화면에서 이보다 크게 늘리지 않는다 */
  width: z.number().int().positive().optional(),
  /** 출처 종류 — catalog: 카탈로그 PDF 에서 추출(정확한 제품 사진), product-page: 공식 제품 페이지 대표 이미지(임시) */
  origin: z.enum(['catalog', 'product-page']),
  /** origin=catalog 일 때 카탈로그 PDF 주소·제목·쪽 */
  catalogUrl: httpsUrl.optional(),
  catalogTitle: z.string().min(1).optional(),
  page: z.number().int().positive().optional(),
});
export const ProductImagesSchema = z.record(z.string(), ProductImageSchema);
export type ProductImage = z.infer<typeof ProductImageSchema>;

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
  L7: '분전반 및 부하',
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

/**
 * src/data/families.json — 개별 제품 목록이 없는 시스템·솔루션 기기(변전소·GIS·HVDC·EMS 등)의 공식 제품군 정보.
 * 공식 사이트 국문 제품 카테고리 페이지의 기본 설명·관련 제품·자료실 카탈로그 (2026-11-19 사용자 요청).
 */
export const FamilyProductSchema = z.object({
  name: z.string(),
  /** product = 개별 제품, model = 표 속 모델, category = 하위 제품군 */
  kind: z.enum(['product', 'model', 'category']),
  desc: z.string().optional(),
  url: httpsUrl.optional(),
  /** 저장소 안 사진 경로 (public/ 기준) */
  image: z.string().optional(),
  /** products.json 에 같은 제품이 있으면 그 id — 제품 페이지로 연결 */
  productId: z.string().optional(),
});
export const EquipmentFamilySchema = z.object({
  familyUrl: httpsUrl,
  summary: z.string(),
  products: z.array(FamilyProductSchema),
  catalogs: z.array(z.object({ title: z.string(), url: httpsUrl })),
});
export type EquipmentFamily = z.infer<typeof EquipmentFamilySchema>;
export const FamiliesFileSchema = z.object({
  generatedAt: z.string(),
  source: z.string(),
  families: z.record(z.string(), EquipmentFamilySchema),
});
