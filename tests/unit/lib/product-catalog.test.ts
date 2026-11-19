/** 제품 조회 (/products) 필터·검색·CSV — src/lib/pages/productCatalog.ts */
import { describe, expect, it } from 'vitest';
import { getData } from '../../../src/data/load';
import {
  EMPTY_FILTERS,
  buildProductCsv,
  buildProductRows,
  facetCounts,
  filterProducts,
  parseProductFilters,
  productFiltersToParams,
  voltageOfLayer,
} from '../../../src/lib/pages/productCatalog';

const data = getData();
const rows = buildProductRows(data);
const f = (patch = {}) => ({ ...EMPTY_FILTERS, ...patch });

describe('제품 조회', () => {
  it('모든 제품이 한 줄씩, 단종은 기본 숨김', () => {
    expect(rows.length).toBe(data.products.length);
    const disc = data.products.filter((p) => p.discontinued).length;
    expect(filterProducts(rows, f()).length).toBe(data.products.length - disc);
    expect(filterProducts(rows, f({ showDiscontinued: true })).length).toBe(data.products.length);
  });

  it('UL67 패널보드는 분전반 기기·수용가 단계·저압·미국 법인·UL', () => {
    const r = rows.find((x) => x.product.id === 'US-1671')!;
    expect(r.equipment.map((e) => e.id)).toContain('panelboard');
    expect(r.stages).toContain('customer');
    expect(r.voltages).toContain('lv');
    expect(r.source).toBe('us');
    expect(r.ul).toBe(true);
  });

  it('검색: 띄어 쓴 낱말은 모두 포함, 대소문자·기호 무시, 기기 별칭(브랜드)은 다른 제품에 번지지 않음', () => {
    const susol = filterProducts(rows, f({ q: 'susol' }));
    expect(susol.length).toBeGreaterThan(0);
    expect(susol.every((r) => /susol/i.test(r.product.name))).toBe(true);
    const both = filterProducts(rows, f({ q: 'susol mccb' }));
    expect(both.every((r) => /susol/i.test(r.product.name))).toBe(true);
    expect(both.some((r) => r.product.name === 'Susol MCCB')).toBe(true);
  });

  it('필터 조합: 같은 묶음 안은 또는, 묶음 사이는 그리고', () => {
    const lv = filterProducts(rows, f({ voltage: ['lv'] }));
    const lvPower = filterProducts(rows, f({ voltage: ['lv'], business: ['power'] }));
    expect(lvPower.length).toBeLessThanOrEqual(lv.length);
    expect(lvPower.every((r) => r.product.business === 'power' && r.voltages.includes('lv'))).toBe(true);
    const either = filterProducts(rows, f({ source: ['en', 'us'] }));
    expect(either.length).toBe(filterProducts(rows, f({ source: ['en'] })).length + filterProducts(rows, f({ source: ['us'] })).length);
  });

  it('묶음 개수는 그 묶음 선택을 빼고 계산', () => {
    const counts = facetCounts(rows, f({ business: ['power'] }), 'business');
    expect(counts.get('automation')).toBeGreaterThan(0);
  });

  it('주소 ↔ 필터 왕복, 모르는 값은 버림', () => {
    const fl = f({ q: 'ACB', business: ['power'], stage: ['customer'], voltage: ['lv'], source: ['ko'], ul: true, specsOnly: true, sort: 'name' as const });
    expect(parseProductFilters(productFiltersToParams(fl))).toEqual(fl);
    expect(parseProductFilters(new URLSearchParams('biz=x,power&volt=zz&sort=bad')).business).toEqual(['power']);
    expect(parseProductFilters(new URLSearchParams('sort=bad')).sort).toBe('system');
  });

  it('변압(L5)은 특고압·저압 둘 다', () => {
    expect(voltageOfLayer('L5')).toEqual(['mv', 'lv']);
    expect(voltageOfLayer('MON')).toEqual(['system']);
  });

  it('CSV: BOM·CRLF·수식 주입 방지', () => {
    const csv = buildProductCsv(rows.slice(0, 2));
    expect(csv.startsWith('﻿제품 ID,')).toBe(true);
    expect(csv).toContain('\r\n');
    const evil = { ...rows[0], product: { ...rows[0].product, name: '=HYPERLINK("x")' } };
    expect(buildProductCsv([evil])).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
