/**
 * 제품·카테고리·기기 사진 규칙 — DI-01·02·05·06·12~19, DI-81·83~85.
 * (DI-82·82b·86 사진 파일 실재·크기는 파일 시스템이 필요해 DI 테스트에 남긴다)
 */
import type { Category, EquipmentImage, EquipmentType, Product } from '../schema';
import { CATEGORY_CODE_RE, Collector, LSE_URL_RE, PRODUCT_ID_RE, PRODUCT_ID_RE_BY_SOURCE, duplicates } from './types';

const sourceOf = (p: Product) => p.source ?? 'ko';
/** 국문 사이트 카테고리 트리에 속한 제품 (categories.json 은 국문 사이트 사본 — 영문·SSQ 제품은 카테고리 목록에 넣지 않는다) */
const inKoTree = (p: Product) => sourceOf(p) === 'ko';

export function catalogRules(c: Collector, products: readonly Product[], categories: readonly Category[]) {
  const productById = new Map(products.map((p) => [p.id, p]));
  const categoryByCode = new Map(categories.map((x) => [x.code, x]));
  c.run('DI-01', () => {
    for (const id of duplicates(products.map((p) => p.id))) c.error('DI-01', `제품 id 중복: ${id}`, { productId: id });
  });
  c.run('DI-02', () => {
    for (const code of duplicates(categories.map((x) => x.code))) c.error('DI-02', `카테고리 코드 중복: ${code}`, { categoryCode: code });
  });
  c.run('DI-05', () => {
    for (const p of products)
      if (!PRODUCT_ID_RE_BY_SOURCE[sourceOf(p)].test(p.id))
        c.error('DI-05', `제품 id 형식 아님 (${sourceOf(p)}: 국문 P+숫자5자리·D+자료실 번호, 영문 EN-…, SSQ SSQ-…): ${p.id}`, { productId: p.id });
  });
  c.run('DI-06', () => {
    for (const x of categories) if (!CATEGORY_CODE_RE.test(x.code)) c.error('DI-06', `카테고리 코드 형식 아님: ${x.code}`, { categoryCode: x.code });
  });
  c.run('DI-08', () => {
    for (const p of products) if (!p.name.trim()) c.error('DI-08', `제품 ${p.id}: 이름이 비어 있습니다`, { productId: p.id });
  });
  c.run('DI-12', () => {
    for (const p of products) {
      // 영문·SSQ 제품은 맞는 국문 카테고리가 없으면 categoryCode 를 비우고 기기 productIds 로 연결한다 (DI-12b)
      if (!inKoTree(p) && p.categoryCode === '') continue;
      if (!categoryByCode.has(p.categoryCode)) c.error('DI-12', `제품 ${p.id}: 없는 카테고리 ${p.categoryCode}`, { productId: p.id });
    }
  });
  c.run('DI-13', () => {
    for (const x of categories) for (const id of x.productIds) if (!productById.has(id)) c.error('DI-13', `카테고리 ${x.code}: 없는 제품 ${id}`, { categoryCode: x.code });
    for (const x of categories)
      for (const id of x.productIds) {
        const p = productById.get(id);
        if (p && !inKoTree(p)) c.error('DI-13', `카테고리 ${x.code}: 영문·SSQ 제품 ${id} 는 국문 카테고리 목록에 넣지 않습니다`, { categoryCode: x.code });
      }
  });
  c.run('DI-14', () => {
    for (const p of products)
      if (inKoTree(p) && !categoryByCode.get(p.categoryCode)?.productIds.includes(p.id))
        c.error('DI-14', `제품 ${p.id}: 카테고리 ${p.categoryCode} 의 제품 목록에 없습니다 (양방향 불일치)`, { productId: p.id });
  });
  c.run('DI-15', () => {
    for (const x of categories) {
      if (x.parentCode && !categoryByCode.has(x.parentCode)) c.error('DI-15', `카테고리 ${x.code}: 상위 ${x.parentCode} 없음`, { categoryCode: x.code });
      const seen = new Set<string>([x.code]);
      let cur = x.parentCode;
      while (cur) {
        if (seen.has(cur)) {
          c.error('DI-15', `카테고리 ${x.code}: 순환 (${[...seen].join('→')}→${cur})`, { categoryCode: x.code });
          break;
        }
        seen.add(cur);
        cur = categoryByCode.get(cur)?.parentCode;
      }
    }
  });
  c.run('DI-16', () => {
    for (const x of categories) if (x.path.at(-1) !== x.name) c.error('DI-16', `카테고리 ${x.code}: path 마지막 요소가 이름과 다릅니다`, { categoryCode: x.code });
    for (const p of products) if (p.categoryPath.length === 0) c.error('DI-16', `제품 ${p.id}: categoryPath 비어 있음`, { productId: p.id });
  });
  c.run('DI-17', () => {
    for (const p of products) if (!LSE_URL_RE.test(p.url)) c.error('DI-17', `제품 ${p.id}: 공식 사이트 https 주소가 아님 (${p.url})`, { productId: p.id });
    for (const x of categories) if (!LSE_URL_RE.test(x.url)) c.error('DI-17', `카테고리 ${x.code}: 공식 사이트 https 주소가 아님 (${x.url})`, { categoryCode: x.code });
    for (const p of products)
      for (const d of p.docs) if (!LSE_URL_RE.test(d.url)) c.error('DI-17', `자료 ${p.id}/${d.title}: 공식 사이트 https 주소가 아님 (${d.url})`, { productId: p.id });
  });
  c.run('DI-18', () => {
    for (const p of products)
      if (PRODUCT_ID_RE.test(p.id) && p.url.startsWith('https://www.ls-electric.com') && !p.url.includes(p.id)) c.error('DI-18', `제품 ${p.id}: 주소에 제품 id 가 없습니다 (${p.url})`, { productId: p.id });
  });
  c.run('DI-19', () => {
    for (const p of products) for (const u of duplicates(p.docs.map((d) => d.url))) c.error('DI-19', `제품 ${p.id}: 자료 주소 중복 ${u}`, { productId: p.id });
  });
}

export function imageRules(
  c: Collector,
  images: Readonly<Record<string, EquipmentImage>>,
  equipment: readonly EquipmentType[],
  products: readonly Product[],
) {
  const eqById = new Map(equipment.map((e) => [e.id, e]));
  const pids = new Set(products.map((p) => p.id));
  const entries = Object.entries(images);
  c.run('DI-81', () => {
    for (const [id] of entries) if (!eqById.has(id)) c.error('DI-81', `equipment-images.json: 없는 기기 ${id}의 사진`, { equipmentId: id });
  });
  c.run('DI-83', () => {
    for (const [id, v] of entries)
      if (v.productId !== null && !pids.has(v.productId)) c.error('DI-83', `사진 ${id}: 없는 제품 ${v.productId}`, { equipmentId: id });
  });
  c.run('DI-84', () => {
    for (const [id, v] of entries) if (!LSE_URL_RE.test(v.sourceUrl)) c.error('DI-84', `사진 ${id}: 출처가 공식 사이트가 아님 (${v.sourceUrl})`, { equipmentId: id });
  });
  c.run('DI-85', () => {
    for (const [id] of entries) {
      const cov = eqById.get(id)?.coverage;
      if (cov === 'missing' || cov === 'na') c.warn('DI-85', `사진 ${id} (${cov}): 미보유·해당 없음 기기에는 사진 대신 심볼을 씁니다`, { equipmentId: id });
    }
  });
}
