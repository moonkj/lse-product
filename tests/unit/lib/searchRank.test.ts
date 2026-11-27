// @vitest-environment node
/**
 * 검색 순위 회귀 (UX 라운드 U 리뷰 M1) — 0번 결과 = Enter 대상.
 * 기기 약어·이름 정확 일치는 기기가 1위, 숫자 든 모델명은 기존 기대(옵션·제품) 유지.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { buildOptionIndex, productNameExact } from '../../../src/lib/search';
import { buildSearchIndexes, rankSearch, type SearchResult } from '../../../src/lib/searchRank';
import { getData } from '../../../src/data/load';
import type { ProductSpecs } from '../../../src/lib/schema';

const specsFile = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../src/data/specs.json', import.meta.url)), 'utf8'),
) as { products: Record<string, ProductSpecs> };
const byId = getData().productById;
const optIndex = buildOptionIndex(new Map(Object.entries(specsFile.products)), (id) => byId.get(id)?.name);
const idx = buildSearchIndexes();
const rank = (q: string) => rankSearch(q, idx, optIndex);
const label = (r: SearchResult) =>
  r.kind === 'equipment' ? `eq:${r.node.eq.id}` : r.kind === 'product' ? `p:${r.id}` : `o:${r.doc.productId}:${r.doc.variantId}`;

describe('M1 기기 약어·이름 정확 일치 → 기기가 1위', () => {
  it.each([
    ['VCB', 'vcb'],
    ['ACB', 'acb'],
    ['MCCB', 'mccb'],
    ['acb', 'acb'],
    ['진공차단기', 'vcb'],
  ])('"%s" → 1위 기기 %s', (q, eq) => {
    expect(label(rank(q)[0])).toBe(`eq:${eq}`);
  });
  it('영문자만 있는 질의는 제품명 토큰 정확 일치로 올리지 않음', () => {
    expect(productNameExact('Susol ACB', 'ACB')).toBe(false);
    expect(productNameExact('GIPAM1000', 'GIPAM 1000')).toBe(true);
  });
});

describe('M1 숫자 든 모델명·형식명은 기존 기대 유지', () => {
  it('TS250 · ts 250 → 1위 Smart MCCB TS250 옵션', () => {
    expect(label(rank('TS250')[0])).toBe('o:P01900:ts250');
    expect(label(rank('ts 250')[0])).toBe('o:P01900:ts250');
  });
  it.each(['TS250', 'ts 250', '250AF', 'ABN', 'TD100'])('"%s" → 옵션 결과 + 기기 1줄', (q) => {
    const rs = rank(q);
    expect(rs.some((r) => r.kind === 'option')).toBe(true);
    expect(rs.filter((r) => r.kind === 'equipment')).toHaveLength(1);
  });
  it('ABN(숫자 없는 형식명)은 Metasol MCCB 옵션을 접두로 찾음', () => {
    expect(rank('ABN').some((r) => r.kind === 'option' && r.doc.productId === 'P01023')).toBe(true);
  });
  it('TD100 → Susol MCCB TD100/160 옵션', () => {
    expect(rank('TD100').map(label)).toContain('o:P01021:td100-160');
  });
  it('GIPAM 1000 → 1위는 제품', () => {
    expect(rank('GIPAM 1000')[0].kind).toBe('product');
  });
});

describe('검색 별칭 (2026-11-18 사용자 결정: 브랜드는 검색 별칭만) — 카테고리형 라인·대표 브랜드', () => {
  const eqIds = (q: string) => rank(q).filter((r) => r.kind === 'equipment').map((r) => (r.kind === 'equipment' ? r.node.eq.id : ''));
  it.each([
    ['XGT', 'plc'],
    ['Metasol MMS', 'mms'],
    ['Susol DC', 'dc-devices'],
    ['SSM', 'soft-starter'],
    ['E TAG', 'smart-device'],
    ['GIMAC-TU', 'smart-device'],
    ['XG5000', 'plc'],
    ['SmartSIZER', 'servo'],
    ['ATS', 'lv-ats'],
    ['CTTS', 'lv-ats'],
    ['감속기', 'gearbox'],
  ])('"%s" → 1위 기기 %s', (q, eq) => {
    expect(label(rank(q)[0])).toBe(`eq:${eq}`);
  });
  it.each([
    ['GIMAC', ['power-meter']],
    ['GIPAM', ['protection-relay']],
    ['Susol', ['acb', 'mccb']],
    ['Metasol', ['acb', 'mccb']],
    ['iS7', ['lv-drive']],
    ['XGT', ['plc']],
  ])('대표 브랜드 "%s" → 연결 기기 보장 %j', (q, ids) => {
    const got = eqIds(q);
    for (const id of ids) expect(got).toContain(id);
  });
  it('"M1000" → 카테고리형 제품 M1000(2026-11-27 추가)이 1위, 고압 인버터 기기도 상위', () => {
    const r = rank('M1000');
    expect(label(r[0])).toBe('p:BBB006001');
    expect(r.slice(0, 3).map(label)).toContain('eq:mv-drive');
  });
  it('기기 약어 정확 일치 질의(ACB)는 별칭 토큰으로 다른 기기를 끼워 넣지 않음', () => {
    expect(eqIds('ACB')).toEqual(['acb']);
  });
  it('별칭은 화면에 쓰이지 않는 선택 필드 — 별칭이 있는 기기 수와 총 별칭 수', () => {
    const eqs = getData().equipmentTypes.filter((e) => (e.searchAliases?.length ?? 0) > 0);
    expect(eqs.length).toBeGreaterThan(20);
    expect(eqs.flatMap((e) => e.searchAliases!).length).toBeGreaterThanOrEqual(58);
  });
});

describe('제품 출처 (국문·영문·SSQ)', () => {
  const ps = getData().products;
  it('출처별 id 접두와 공식 URL 도메인', () => {
    for (const p of ps) {
      const src = p.source ?? 'ko';
      if (src === 'en') expect(p.id.startsWith('EN-'), p.id).toBe(true);
      if (src === 'ssq') {
        expect(p.id.startsWith('SSQ-'), p.id).toBe(true);
        expect(p.url.startsWith('https://sol.ls-electric.com/'), p.id).toBe(true);
      }
    }
    expect(ps.some((p) => p.source === 'en')).toBe(true);
    expect(ps.some((p) => p.source === 'ssq')).toBe(true);
  });
  it('일람표(비제품)는 제품에서 제외, 사이트 단종 제품(iV5·iG5A·iP5A·XP 시리즈·GIMAC-i)은 삭제됨 (2026-11-23 재검수)', () => {
    expect(ps.some((p) => p.name.includes('일람표'))).toBe(false);
    for (const id of ['P01190', 'P01187', 'P01189', 'P01173', 'EN-P00062']) expect(getData().productById.has(id), id).toBe(false);
  });
});
