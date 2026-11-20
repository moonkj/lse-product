/** 해당 없음(na, 자사 사업 범위 밖)은 보유 집계 분모에서 뺀다 (2026-11-20 사용자: 발전기·비상발전기·전동기 등) */
import { describe, expect, it } from 'vitest';
import { getData } from '../../../src/data/load';
import { countCoverage, emptyCounts, ownedRate } from '../../../src/lib/pages/catalog';
import { getDiagramModel } from '../../../src/lib/diagram/model';

describe('사업 범위 밖 = 해당 없음, 집계 제외', () => {
  const eq = getData().equipmentTypes;
  it('발전기·비상발전기·전동기·조명 부하는 해당 없음', () => {
    for (const id of ['generator', 'emergency-gen', 'motor', 'lighting-outlet']) {
      expect(eq.find((e) => e.id === id)!.coverage, id).toBe('na');
    }
  });
  it('보유율 분모 = 전체 − 해당 없음', () => {
    const c = countCoverage(eq);
    expect(ownedRate(c).total).toBe(eq.length - c.na);
    expect(ownedRate({ ...emptyCounts(), owned: 3, na: 5 })).toEqual({ owned: 3, total: 3, pct: 100 });
  });
  it('계통도 층 집계(사이드바)도 해당 없음 제외', () => {
    const m = getDiagramModel();
    const total = [...m.layerStats.values()].reduce((a, b) => a + b.total, 0);
    expect(total).toBe(m.nodes.length - m.nodes.filter((n) => n.coverage === 'na').length);
  });
});
