/**
 * 기기 상세 설명(overview) — 표시용 헬퍼 + 데이터 형태 (2026-11-18 "계통에서 하는 일" 보강)
 */
import { describe, it, expect } from 'vitest';
import { getData } from '../../../src/data/load';
import { groupOverviewSources, overviewText } from '../../../src/lib/overview';
import { buildSearchIndexes } from '../../../src/lib/searchRank';

describe('overview 헬퍼', () => {
  it('overviewText: overview 가 있으면 본문, 없으면 description', () => {
    expect(overviewText({ description: '요약', overview: { text: '본문', basis: 'general', sources: [] } })).toBe('본문');
    expect(overviewText({ description: '요약' })).toBe('요약');
  });

  it('groupOverviewSources: 같은 URL 은 쪽을 묶고(정렬·중복 제거), 처음 나온 순서 유지', () => {
    const a = 'https://example.com/a.pdf';
    const b = 'https://example.com/b';
    const g = groupOverviewSources([
      { title: 'A', url: a, page: 5 },
      { title: 'B', url: b },
      { title: 'A', url: a, page: 2 },
      { title: 'A', url: a, page: 5 },
    ]);
    expect(g).toEqual([
      { title: 'A', url: a, pages: [2, 5] },
      { title: 'B', url: b, pages: [] },
    ]);
  });
});

describe('overview 데이터', () => {
  const eqs = getData().equipmentTypes;
  it('모든 기기에 overview 가 있고 catalog 근거는 출처 1개 이상', () => {
    for (const e of eqs) {
      expect(e.overview, e.id).toBeDefined();
      if (e.overview!.basis === 'catalog') expect(e.overview!.sources.length, e.id).toBeGreaterThan(0);
    }
  });
});

describe('검색 색인', () => {
  it('overview 본문은 색인하지 않는다 (노이즈) — 키는 abbr·name·productNames·description 만', () => {
    const idx = buildSearchIndexes();
    const json = idx.eq.getIndex().toJSON() as { keys: unknown[]; records: unknown[] };
    const keys = JSON.stringify(json.keys);
    expect(keys).not.toContain('overview');
    const sample = getData().equipmentTypes.find((e) => e.overview && e.overview.text !== e.description)!;
    expect(JSON.stringify(json.records)).not.toContain(sample.overview!.text.slice(0, 40));
  });
});
