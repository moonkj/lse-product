/**
 * 데이터 무결성 검사 — 단일 출처 (개선 R4).
 * 관리자 "검사 후 내보내기"(lib/admin/integrity.ts)와 DI 테스트(tests/unit/data-integrity.test.ts)가 같은 함수를 쓴다.
 * 순수 함수 · React/DOM 의존 없음 · 규칙 ID = docs/test-plan.md §3 DI-xx.
 *
 *   const { errors, warnings } = checkDataset({ equipmentTypes, diagram, categories, products, images });
 *   errors.filter((i) => i.rule === 'DI-44a')   // 규칙별로 꺼내 쓰기
 *
 * HARD(오류)/SOFT(경고) 구분은 RULES 표 참고 — DI 테스트의 expect / softWarn 과 같다.
 * 파일 시스템이 필요한 규칙(DI-00a 파일 존재, DI-82·82b·86 사진 파일), docs.json(DI-60~)·learn.json(DI-70~) 규칙은 범위 밖.
 */
import { z } from 'zod';
import {
  CategoriesSchema,
  DiagramSchema,
  EquipmentImagesSchema,
  EquipmentTypesSchema,
  ProductsSchema,
  type Category,
  type Diagram,
  type EquipmentImage,
  type EquipmentType,
  type Product,
} from '../schema';
import { todayIso } from '../labels';
import { catalogRules, imageRules } from './catalog';
import { diagramRules } from './diagram';
import { equipmentRules } from './equipment';
import { Collector, asArray, koIssue, pathText, type CheckResult } from './types';

export * from './types';
export { checkEquipment, linkCount, linkedProductIds, productsUnderCategory, type EquipmentContext } from './equipment';
export { edgeCrossings, edgePath, nodeLabel, nodeLayerOf, segHitsNode, segsCross, KNOWN_ISOLATED_SYSTEM_NODES } from './diagram';

export interface DatasetInput {
  /** equipment-types.json (배열 또는 { equipmentTypes: [] }) */
  equipmentTypes: unknown;
  diagram: unknown;
  categories: unknown;
  products: unknown;
  /** equipment-images.json (없으면 사진 규칙 생략) */
  images?: unknown;
  /** 오늘 YYYY-MM-DD (기본: KST 오늘). DI-27g 재확인 기한 */
  today?: string;
}

/** 규칙 표 — severity: error = HARD(내보내기·CI 실패), warning = SOFT(표시만), both = 같은 ID 에 HARD 와 SOFT 항목이 함께 */
export const RULES: { id: string; severity: 'error' | 'warning' | 'both'; title: string }[] = [
  { id: 'DI-00', severity: 'error', title: '스키마(Zod) 통과' },
  { id: 'DI-01', severity: 'error', title: 'product.id 중복 없음' },
  { id: 'DI-02', severity: 'error', title: 'category.code 중복 없음' },
  { id: 'DI-03', severity: 'error', title: 'equipmentType.id 중복 없음' },
  { id: 'DI-04', severity: 'error', title: '노드·연결선·밴드 id 중복 없음' },
  { id: 'DI-05', severity: 'error', title: 'product.id 형식' },
  { id: 'DI-06', severity: 'error', title: 'category.code 형식' },
  { id: 'DI-07', severity: 'error', title: '기기 id kebab-case' },
  { id: 'DI-08', severity: 'error', title: '필수 텍스트 비어 있지 않음' },
  { id: 'DI-10', severity: 'error', title: '기기 카테고리 코드 존재' },
  { id: 'DI-11', severity: 'error', title: '기기 제품 id 존재' },
  { id: 'DI-12', severity: 'error', title: '제품 카테고리 존재' },
  { id: 'DI-13', severity: 'error', title: '카테고리 제품 존재' },
  { id: 'DI-14', severity: 'error', title: '제품↔카테고리 양방향' },
  { id: 'DI-15', severity: 'error', title: '카테고리 부모 존재·순환 없음' },
  { id: 'DI-16', severity: 'error', title: '카테고리 path·제품 categoryPath' },
  { id: 'DI-17', severity: 'error', title: '공식 사이트 https 주소' },
  { id: 'DI-18', severity: 'error', title: '제품 주소에 id' },
  { id: 'DI-19', severity: 'error', title: '제품 자료 주소 중복 없음' },
  { id: 'DI-20', severity: 'error', title: 'owned → 연결 ≥ 1' },
  { id: 'DI-21', severity: 'error', title: 'missing → 연결 0' },
  { id: 'DI-22', severity: 'error', title: 'affiliate → 계열사명' },
  { id: 'DI-23', severity: 'error', title: '계열사명은 affiliate 만' },
  { id: 'DI-24', severity: 'error', title: 'missing → gapNote' },
  { id: 'DI-25', severity: 'warning', title: 'partial → gapNote 권장' },
  { id: 'DI-26', severity: 'error', title: 'partial → 연결 ≥ 1' },
  { id: 'DI-27', severity: 'warning', title: 'owned 인데 제품 전부 단종' },
  { id: 'DI-27a', severity: 'error', title: '공백류 → gapAssessment' },
  { id: 'DI-27b', severity: 'both', title: 'sourced → panel-sourced (SOFT: affiliate·missing 공급 방식)' },
  { id: 'DI-27c', severity: 'error', title: 'homepage-menu → candidate' },
  { id: 'DI-27d', severity: 'error', title: 'confirmed → verifiedBy·verifiedAt' },
  { id: 'DI-27e', severity: 'error', title: '날짜 실존' },
  { id: 'DI-27f', severity: 'error', title: 'url 근거 https' },
  { id: 'DI-27g', severity: 'warning', title: 'sourced gapNote 권장·재확인 기한 경과' },
  { id: 'DI-27h', severity: 'warning', title: 'verifiedBy 부서명' },
  { id: 'DI-28', severity: 'error', title: '커버리지 enum' },
  { id: 'DI-29', severity: 'warning', title: '공백 후보 11종 존재' },
  { id: 'DI-30', severity: 'error', title: '노드 종류별 필수 필드' },
  { id: 'DI-31', severity: 'error', title: '연결선 끝 노드 존재' },
  { id: 'DI-32', severity: 'error', title: 'self-loop·중복 연결 없음' },
  { id: 'DI-33', severity: 'error', title: '계층 밴드 정의' },
  { id: 'DI-34', severity: 'error', title: 'L1~L7 기기 노드 ≥ 1' },
  { id: 'DI-35', severity: 'error', title: '노드가 소속 밴드 안 (참조 제외, 모선 양 끝)' },
  { id: 'DI-36', severity: 'error', title: '노드가 캔버스 안' },
  { id: 'DI-37', severity: 'error', title: '밴드 크기·겹침' },
  { id: 'DI-38', severity: 'error', title: 'L1→L7 위에서 아래' },
  { id: 'DI-39', severity: 'both', title: '노드 겹침 없음·중심 거리 (SOFT: 간격 30px)' },
  { id: 'DI-40', severity: 'both', title: '고립 노드 없음·모선 ≥ 2 (SOFT: R-05 밖 system)' },
  { id: 'DI-41', severity: 'error', title: 'L1→L7 경로' },
  { id: 'DI-42', severity: 'error', title: '인접 계층만 연결' },
  { id: 'DI-43', severity: 'error', title: '기기마다 기기 노드 1개·참조 타일 라벨' },
  { id: 'DI-43b', severity: 'both', title: 'review 상태 (SOFT: review 없음)' },
  { id: 'DI-43c', severity: 'error', title: '택1 라벨·그룹 ≥ 2' },
  { id: 'DI-44a', severity: 'error', title: '연결선 노드 관통 없음' },
  { id: 'DI-44b', severity: 'error', title: 'points 직교·노드 가장자리' },
  { id: 'DI-45a', severity: 'error', title: '전력선 교차·같은 선 겹침 없음' },
  { id: 'DI-46', severity: 'error', title: '모선 연결: 모선 위 점에서 수직' },
  { id: 'DI-50', severity: 'error', title: '학습 포인트 ≥ 1' },
  { id: 'DI-51', severity: 'warning', title: '같은 계층 이름 중복' },
  { id: 'DI-52', severity: 'warning', title: '대외비 키워드' },
  { id: 'DI-81', severity: 'error', title: '사진 키 = 기기 id' },
  { id: 'DI-83', severity: 'error', title: '사진 productId 존재' },
  { id: 'DI-84', severity: 'error', title: '사진 출처 공식 사이트' },
  { id: 'DI-85', severity: 'warning', title: 'missing·na 기기 사진 없음' },
];

function schemaIssues(c: Collector, file: string, schema: z.ZodType, value: unknown, skip?: (i: z.core.$ZodIssue) => boolean): boolean {
  const r = schema.safeParse(value);
  if (r.success) return true;
  for (const i of r.error.issues) if (!skip?.(i)) c.error('DI-00', `${file} [${pathText(i.path)}] ${koIssue(i)}`);
  return false;
}

/** 4개(+사진) 데이터 파일 전체 검사 */
export function checkDataset(input: DatasetInput): CheckResult {
  const c = new Collector();
  const today = input.today ?? todayIso();
  const arr = (raw: unknown, key: string): unknown[] | null => {
    try {
      return asArray(raw, key);
    } catch (e) {
      c.error('DI-00', (e as Error).message);
      return null;
    }
  };
  const eqRaw = arr(input.equipmentTypes, 'equipmentTypes');
  const productsRaw = arr(input.products, 'products');
  const categoriesRaw = arr(input.categories, 'categories');
  const diagramRaw = input.diagram && typeof input.diagram === 'object' ? input.diagram : null;
  if (!diagramRaw) c.error('DI-00', 'diagram.json: 객체가 아닙니다');

  // DI-00 스키마 — gapAssessment 의 교차 조건(확정 조건 등)은 DI-27c·d 가 같은 내용을 더 구체적으로 알린다
  const gapCustom = (i: z.core.$ZodIssue) => i.code === 'custom' && i.path.includes('gapAssessment');
  if (eqRaw) schemaIssues(c, 'equipment-types.json', EquipmentTypesSchema, eqRaw, gapCustom);
  if (productsRaw) schemaIssues(c, 'products.json', ProductsSchema, productsRaw);
  if (categoriesRaw) schemaIssues(c, 'categories.json', CategoriesSchema, categoriesRaw);
  if (diagramRaw) schemaIssues(c, 'diagram.json', DiagramSchema, diagramRaw);
  if (input.images !== undefined) schemaIssues(c, 'equipment-images.json', EquipmentImagesSchema, input.images);

  const equipment = (eqRaw ?? []) as EquipmentType[];
  const products = (productsRaw ?? []) as Product[];
  const categories = (categoriesRaw ?? []) as Category[];
  if (productsRaw && categoriesRaw) catalogRules(c, products, categories);
  if (eqRaw) equipmentRules(c, equipment, categories, products, today);
  if (diagramRaw && eqRaw) {
    const d = diagramRaw as Diagram;
    if (Array.isArray(d.nodes) && Array.isArray(d.edges) && Array.isArray(d.layers)) diagramRules(c, d, equipment);
  }
  if (input.images && typeof input.images === 'object' && eqRaw) imageRules(c, input.images as Record<string, EquipmentImage>, equipment, products);
  return c.result();
}
