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
