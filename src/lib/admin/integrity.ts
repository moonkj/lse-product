/**
 * 관리자 "검사 후 내보내기" — 공용 무결성 모듈(lib/integrity, DI 테스트와 같은 규칙)을 초안에 적용하고
 * 관리자 화면 표시용 Issue 로 바꾼다. 오류(error)가 하나라도 있으면 내보내기를 막는다. 경고(warn)는 표시만.
 */
import type { Category, EquipmentType, Product } from '../schema';
import { checkDataset, checkEquipment, type Issue as RuleIssue } from '../integrity';
import { todayIso } from '../labels';
import type { Draft } from './draft';

export { koIssue } from '../integrity';

export interface Issue {
  level: 'error' | 'warn';
  /** 규칙 ID (DI-xx) */
  area: string;
  message: string;
  /** 관련 노드/기기/연결선 id (클릭 시 이동용) */
  nodeId?: string;
  equipmentId?: string;
  edgeId?: string;
}

export interface RefData {
  categories: readonly Category[];
  products: readonly Product[];
}

const toAdmin = (level: Issue['level']) => (i: RuleIssue): Issue => ({
  level,
  area: i.rule,
  message: i.message,
  nodeId: i.refs.nodeId,
  equipmentId: i.refs.equipmentId,
  edgeId: i.refs.edgeId,
});

/** 초안 전체 검사 (DI 규칙과 같은 기준) */
export function validateDraft(draft: Draft, ref: RefData, today = todayIso()): Issue[] {
  const r = checkDataset({
    equipmentTypes: draft.equipmentTypes,
    diagram: draft.diagram,
    images: draft.images,
    categories: ref.categories,
    products: ref.products,
    today,
  });
  return [...r.errors.map(toAdmin('error')), ...r.warnings.map(toAdmin('warn'))];
}

/** 기기 하나의 규칙 (DI-08·20~27h·50) — 기기 폼 즉시 검증용. field = 오류를 붙일 칸 */
export function coverageIssues(e: EquipmentType, ref?: Partial<RefData>): { field: string; message: string; level: 'error' | 'warn' }[] {
  const r = checkEquipment(e, { categories: ref?.categories, products: ref?.products, today: todayIso() });
  const strip = (m: string) => m.replace(/^[^:]*: /, '');
  return [
    ...r.errors.map((i) => ({ field: i.refs.field ?? 'id', level: 'error' as const, message: strip(i.message) })),
    ...r.warnings.map((i) => ({ field: i.refs.field ?? 'id', level: 'warn' as const, message: strip(i.message) })),
  ];
}
