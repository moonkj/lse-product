/**
 * 기기(equipment-types.json) 규칙 — DI-03·07·08·10·11·20~29·50~52.
 * checkEquipment() 는 기기 하나 규칙(관리자 기기 폼이 즉시 검증에 재사용), equipmentRules() 는 전체 목록 규칙.
 */
import { ASSESSED_COVERAGES, COVERAGES, type Category, type EquipmentType, type Product } from '../schema';
import { Collector, EMAIL_RE, ROUTE_ID_RE, duplicates, isHttpsUrl, isRealDate, type CheckResult } from './types';

export interface EquipmentContext {
  /** 있으면 카테고리 하위 제품까지 연결 수에 포함 (DI-20·26), 단종 검사(DI-27) */
  categories?: readonly Category[];
  products?: readonly Product[];
  /** 오늘 (YYYY-MM-DD, KST). DI-27g 재확인 기한 */
  today?: string;
}

/** 카테고리 코드 → 자신 + 모든 하위 카테고리의 제품 id (R-01) */
export function productsUnderCategory(code: string, categories: readonly Category[], visited = new Set<string>()): Set<string> {
  const out = new Set<string>();
  if (visited.has(code)) return out;
  visited.add(code);
  const cat = categories.find((c) => c.code === code);
  if (!cat) return out;
  cat.productIds.forEach((id) => out.add(id));
  for (const child of categories) if (child.parentCode === code) productsUnderCategory(child.code, categories, visited).forEach((id) => out.add(id));
  return out;
}

/** 기기에 연결된 제품 id 전체 (직접 productIds ∪ 카테고리 하위 제품) */
export function linkedProductIds(eq: Pick<EquipmentType, 'productIds' | 'lseCategoryCodes'>, categories: readonly Category[] = []): Set<string> {
  const out = new Set<string>(eq.productIds ?? []);
  for (const code of eq.lseCategoryCodes) productsUnderCategory(code, categories).forEach((id) => out.add(id));
  return out;
}

/** 연결 건수 = 제품 + 카테고리 (DI-20·26) */
export const linkCount = (eq: Pick<EquipmentType, 'productIds' | 'lseCategoryCodes'>, categories: readonly Category[] = []) =>
  linkedProductIds(eq, categories).size + eq.lseCategoryCodes.length;

const isAssessed = (c: string) => (ASSESSED_COVERAGES as readonly string[]).includes(c);
const eqText = (e: Pick<EquipmentType, 'id' | 'name'>) => e.name?.trim() || e.id;

/** 기기 하나의 규칙 (DI-08·20~27h·50). 폼과 전체 검사가 함께 쓴다 */
export function checkEquipment(e: EquipmentType, ctx: EquipmentContext = {}): CheckResult {
  const c = new Collector();
  const ref = (field: string) => ({ equipmentId: e.id, field });
  const name = eqText(e);
  const links = linkCount(e, ctx.categories);
  const g = e.gapAssessment;

  // DI-08 필수 텍스트
  for (const f of ['name', 'description', 'voltage', 'category'] as const) {
    if (!String(e[f] ?? '').trim()) c.error('DI-08', `${name}: ${{ name: '이름', description: '설명', voltage: '전압', category: '기능 분류' }[f]}이(가) 비어 있습니다`, ref(f));
  }
  // DI-20 ~ 26 커버리지
  if (e.coverage === 'owned' && links === 0) c.error('DI-20', `${name}: 보유 기기는 연결 카테고리나 제품이 1개 이상 필요합니다`, ref('lseCategoryCodes'));
  if (e.coverage === 'missing' && ((e.productIds?.length ?? 0) > 0 || e.lseCategoryCodes.length > 0))
    c.error('DI-21', `${name}: 미보유 기기에는 연결 카테고리·제품을 지정할 수 없습니다`, ref('lseCategoryCodes'));
  if (e.coverage === 'affiliate' && !e.affiliateName?.trim()) c.error('DI-22', `${name}: 계열사 보유 기기는 계열사명이 필요합니다`, ref('affiliateName'));
  if (e.coverage !== 'affiliate' && e.affiliateName) c.error('DI-23', `${name}: 계열사명은 계열사 보유일 때만 적습니다`, ref('affiliateName'));
  if (e.coverage === 'missing' && !e.gapNote?.trim()) c.error('DI-24', `${name}: 미보유 기기는 공백 메모가 필요합니다 (왜 공백인지)`, ref('gapNote'));
  if (e.coverage === 'partial' && !e.gapNote?.trim()) c.warn('DI-25', `${name}: 일부 보유 기기는 공백 메모를 적는 것을 권장합니다`, ref('gapNote'));
  if (e.coverage === 'partial' && links === 0) c.error('DI-26', `${name}: 일부 보유 기기는 연결 카테고리나 제품이 1개 이상 필요합니다`, ref('lseCategoryCodes'));
  // DI-27 (SOFT) 보유인데 연결 제품이 전부 단종
  if (e.coverage === 'owned' && ctx.products) {
    const ids = [...linkedProductIds(e, ctx.categories)];
    if (ids.length > 0 && ids.every((id) => ctx.products!.find((p) => p.id === id)?.discontinued))
      c.warn('DI-27', `${name}: 보유 기기인데 연결된 제품이 모두 단종입니다`, ref('productIds'));
  }

  // DI-27a ~ h 공백 판정 근거
  if (isAssessed(e.coverage) && !g)
    c.error('DI-27a', `${name}: 미보유·일부 보유·계열사·패널 구성품 기기는 공백 판정 근거가 필요합니다`, ref('gapAssessment'));
  if (g) {
    if (e.coverage === 'sourced' && g.supplyMode !== 'panel-sourced')
      c.error('DI-27b', `${name}: 패널 구성품(sourced)은 공급 방식이 "수배전반 구성품(panel-sourced)"이어야 합니다`, ref('gapAssessment'));
    if (e.coverage === 'affiliate' && g.supplyMode !== 'affiliate')
      c.warn('DI-27b', `${name}: 계열사 보유인데 공급 방식이 ${g.supplyMode} 입니다 (affiliate 권장)`, ref('gapAssessment'));
    if (e.coverage === 'missing' && !['not-offered', 'unknown'].includes(g.supplyMode))
      c.warn('DI-27b', `${name}: 미보유인데 공급 방식이 ${g.supplyMode} 입니다 (not-offered·unknown 권장)`, ref('gapAssessment'));
    if (g.basis === 'homepage-menu' && g.confidence !== 'candidate')
      c.error('DI-27c', `${name}: 홈페이지 메뉴 근거만으로는 확정할 수 없습니다 (공백 후보로)`, ref('gapAssessment'));
    if (g.confidence === 'confirmed' && (!g.verifiedBy?.trim() || !g.verifiedAt))
      c.error('DI-27d', `${name}: 확정하려면 확인 부서와 확인일이 필요합니다`, ref('gapAssessment'));
    for (const k of ['verifiedAt', 'reviewDue'] as const) {
      const v = g[k];
      if (v !== undefined && !isRealDate(v))
        c.error('DI-27e', `${name}: ${k === 'verifiedAt' ? '확인일' : '재확인 기한'} "${v}" 은(는) 실제 날짜(YYYY-MM-DD)가 아닙니다`, ref('gapAssessment'));
    }
    for (const ev of g.evidence ?? []) {
      if (ev.type === 'url' && !isHttpsUrl(ev.ref)) c.error('DI-27f', `${name}: 링크 근거 "${ev.ref}" 는 https:// 로 시작하는 절대 주소여야 합니다`, ref('gapAssessment'));
    }
    if (g.confidence === 'confirmed' && g.reviewDue && ctx.today && g.reviewDue < ctx.today)
      c.warn('DI-27g', `${name}: 재확인 기한 ${g.reviewDue} 이 지났습니다 (화면은 공백 후보로 표시)`, ref('gapAssessment'));
    if (g.verifiedBy && (EMAIL_RE.test(g.verifiedBy) || !/(부|팀|소|실|센터|사업|그룹)/.test(g.verifiedBy)))
      c.warn('DI-27h', `${name}: 확인 부서 "${g.verifiedBy}" — 개인 실명·이메일 대신 부서명을 적으세요`, ref('gapAssessment'));
  }
  if (e.coverage === 'sourced' && !e.gapNote?.trim()) c.warn('DI-27g', `${name}: 패널 구성품 기기는 메모(gapNote)를 적는 것을 권장합니다`, ref('gapNote'));

  // DI-50 학습 포인트
  if ((e.learnPoints ?? []).filter((s) => s.trim()).length === 0) c.error('DI-50', `${name}: 학습 포인트가 1개 이상 필요합니다`, ref('learnPoints'));
  return c.result();
}

/** 공백 후보 11종 (DI-29, product-mapping.md 요약) */
const GAP_CANDIDATE_KEYWORDS = ['발전기', '송전', '피뢰기', '변성기', '리클로저', '주상변압기', '콘덴서', 'ATS', '비상발전기', '분전반', '전동기'];
const BANNED_WORDS = ['대외비', '내부용', 'confidential', '사내한정'];

/** 기기 목록 전체 규칙 */
export function equipmentRules(c: Collector, equipment: readonly EquipmentType[], categories: readonly Category[], products: readonly Product[], today?: string) {
  const codes = new Set(categories.map((x) => x.code));
  const pids = new Set(products.map((p) => p.id));
  c.run('DI-03', () => {
    for (const id of duplicates(equipment.map((e) => e.id))) c.error('DI-03', `기기 id 중복: ${id}`, { equipmentId: id });
  });
  c.run('DI-07', () => {
    for (const e of equipment) if (!ROUTE_ID_RE.test(e.id)) c.error('DI-07', `기기 id "${e.id}" 는 영문 소문자·숫자·하이픈(kebab-case)이어야 합니다`, { equipmentId: e.id, field: 'id' });
  });
  c.run('DI-10', () => {
    for (const e of equipment)
      for (const code of e.lseCategoryCodes) if (!codes.has(code)) c.error('DI-10', `${eqText(e)}: 없는 카테고리 코드 ${code}`, { equipmentId: e.id, field: 'lseCategoryCodes' });
  });
  c.run('DI-11', () => {
    for (const e of equipment) for (const p of e.productIds ?? []) if (!pids.has(p)) c.error('DI-11', `${eqText(e)}: 없는 제품 ${p}`, { equipmentId: e.id, field: 'productIds' });
  });
  c.run('DI-20', () => {
    for (const e of equipment) {
      const r = checkEquipment(e, { categories, products, today });
      c.errors.push(...r.errors);
      c.warnings.push(...r.warnings);
    }
  });
  c.run('DI-28', () => {
    for (const e of equipment)
      if (!(COVERAGES as readonly string[]).includes(e.coverage)) c.error('DI-28', `${eqText(e)}: 커버리지 "${e.coverage}" 는 허용되지 않는 값입니다`, { equipmentId: e.id, field: 'coverage' });
  });
  c.run('DI-29', () => {
    for (const k of GAP_CANDIDATE_KEYWORDS)
      if (!equipment.some((e) => e.name.includes(k) || e.abbr?.includes(k))) c.warn('DI-29', `공백 후보 "${k}" 기기가 데이터에 없습니다`);
  });
  c.run('DI-51', () => {
    for (const k of duplicates(equipment.map((e) => `${e.layer}:${e.name}`))) c.warn('DI-51', `같은 계층에 같은 이름의 기기: ${k}`);
  });
  c.run('DI-52', () => {
    for (const e of equipment) {
      const t = JSON.stringify(e).toLowerCase();
      if (BANNED_WORDS.some((b) => t.includes(b.toLowerCase()))) c.warn('DI-52', `${eqText(e)}: 대외비 키워드가 들어 있습니다`, { equipmentId: e.id });
    }
  });
}
