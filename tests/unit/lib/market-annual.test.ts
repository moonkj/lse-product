import { describe, expect, it } from 'vitest';
import annualJson from '../../../src/data/market-annual.json';
import growthJson from '../../../src/data/market-growth.json';
import equipmentJson from '../../../src/data/equipment-types.json';
import { MarketAnnualSchema, MarketGrowthSchema, checkAnnual, checkGrowth } from '../../../src/lib/market/annual';

const eqList = (Array.isArray(equipmentJson) ? equipmentJson : (equipmentJson as { equipmentTypes?: { id: string }[]; items?: { id: string }[] }).equipmentTypes ?? (equipmentJson as { items?: { id: string }[] }).items ?? []) as { id: string }[];

describe('시장 연간 지표·성장 판정 데이터', () => {
  it('연간 지표: 스키마(출처·기준일·실적/전망·방법 필수)와 관계 규칙 통과', () => {
    const data = MarketAnnualSchema.parse(annualJson);
    expect(checkAnnual(data)).toEqual([]);
    for (const ind of data.indicators) expect(ind.actual.length).toBeGreaterThan(0);
  });
  it('성장 판정: 스키마·관계 규칙 통과, 존재하는 기기 id만, ls-electric.com 출처 없음', () => {
    const data = MarketGrowthSchema.parse(growthJson);
    expect(eqList.length).toBeGreaterThan(0);
    expect(checkGrowth(data, new Set(eqList.map((e) => e.id)))).toEqual([]);
    expect(JSON.stringify(data)).not.toMatch(/ls-electric\.com/);
  });
});
