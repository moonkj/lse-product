/**
 * 기기 상세 설명(overview) — 표시용 헬퍼 + 데이터 형태 (2026-11-18 "계통에서 하는 일" 보강)
 */
import { describe, it, expect } from 'vitest';
import { getData } from '../../../src/data/load';
import { overviewParts, overviewText } from '../../../src/lib/overview';
import { buildSearchIndexes } from '../../../src/lib/searchRank';

describe('overview 헬퍼', () => {
  const ov = { summary: '요약', points: [{ label: '역할', text: '본문1' }, { label: '선정 포인트', text: '본문2' }], basis: 'general' as const, sources: [] };
  it('overviewText: 요약 + "라벨: 본문" 항목 전체, 없으면 description', () => {
    expect(overviewText({ description: 'd', overview: ov })).toBe('요약 역할: 본문1 선정 포인트: 본문2');
    expect(overviewText({ description: 'd' })).toBe('d');
  });
  it('overviewParts: 화면용 요약·항목, 없으면 description + 빈 항목', () => {
    expect(overviewParts({ description: 'd', overview: ov })).toEqual({ summary: '요약', points: ov.points });
    expect(overviewParts({ description: 'd' })).toEqual({ summary: 'd', points: [] });
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
    const sample = getData().equipmentTypes.find((e) => e.overview && e.overview.points.length > 0)!;
    expect(JSON.stringify(json.records)).not.toContain(sample.overview!.points[0].text.slice(0, 30));
  });
});
