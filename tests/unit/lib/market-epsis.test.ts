/** 전력시장 지표 자동 갱신 (src/lib/market/epsis.ts · scripts/fetch-annual.mjs) — 네트워크 없이 EPSIS 응답 모양으로 검사 */
import { describe, expect, it } from 'vitest';
import annualJson from '../../../src/data/market-annual.json';
import { MarketAnnualSchema, checkAnnual } from '../../../src/lib/market/annual';
import { buildSnapshot, mergeAnnual, mixShares, parseGridScript, parseKep, type YearCols } from '../../../src/lib/market/epsis';

const script = (rows: [number, Record<string, string>][]) =>
  rows
    .map(([y, cols]) => Object.entries(cols).map(([k, v]) => `${k} = textFormmat("${v}",count);`).join('\n') + `\ngridData.push({"year":"${y}", "c1":c1});`)
    .join('\n');

describe('EPSIS 응답 읽기', () => {
  it('전력지표 JSON: 연도별 열 값, 빈 값은 버림', () => {
    const m = parseKep({ defaultList: [{ dtYear: '2025', c1: '163224.3', c6: '634470.4', c17: '549417.2', c28: '' }] });
    expect(m.get(2025)).toEqual({ c1: 163224.3, c6: 634470.4, c17: 549417.2 });
    expect(parseKep({}).size).toBe(0);
  });

  it('스크립트 조각: 연도마다 앞의 cN 값, 같은 연도가 두 번이면 처음 것, 빈 값은 0', () => {
    const t = script([[2025, { c1: '112.72', c2: '' }], [2024, { c1: '128.39' }]]) + script([[2025, { c1: '999' }]]);
    const m = parseGridScript(t);
    expect(m.get(2025)).toEqual({ c1: 112.72, c2: 0 });
    expect(m.get(2024)).toEqual({ c1: 128.39 });
  });

  it('전원믹스: 분모 c22, 석탄=무연탄+유연탄, LNG=가스+복합 LNG(2017 이전은 복합 계), 기타=100−나머지', () => {
    const base = { c22: 1000, c14: 290, c5: 10, c6: 250, c8: 5, c16: 98 };
    expect(mixShares({ ...base, c24: 180, c12: 181 })).toEqual({ nuclear: 29, coal: 26, lng: 18.5, renewable: 9.8, other: 16.7 });
    expect(mixShares({ ...base, c24: 0, c12: 170 })!.lng).toBe(17.5); // 2017 이전: LNG 열 없음 → 복합 계
    expect(mixShares({ c22: 0 })).toBeNull();
  });
});

describe('market-annual.json 에 합치기', () => {
  const data = MarketAnnualSchema.parse(annualJson);
  const last = data.indicators[0].actual.at(-1)!.year;
  const cols = (y: number, f = 1): YearCols => new Map([[y, { c1: 165000 * f, c6: 640000 * f, c17: 552000 * f }]]);
  const mixCols: YearCols = new Map([[last + 1, { c22: 1000, c14: 300, c5: 10, c6: 240, c8: 0, c24: 190, c16: 110 }]]);

  it('새 해 실적이 나오면 끝에 붙이고 가장 오래된 해를 빼서 창 길이 유지, 결과도 스키마·관계 규칙 통과', () => {
    const snap = buildSnapshot(cols(last + 1), new Map([[last + 1, { c1: 105.5 }]]), mixCols, last + 2);
    const { data: next, changes, skipped } = mergeAnnual(data, snap, '2027-03-02');
    expect(skipped).toEqual([]);
    const cons = next.indicators.find((i) => i.id === 'consumption')!;
    expect(cons.actual.length).toBe(data.indicators[0].actual.length);
    expect(cons.actual.at(-1)).toMatchObject({ year: last + 1, value: 552, kind: 'actual' });
    expect(cons.actual.at(-1)!.method).toContain('(2027-03-02 조회)');
    expect(cons.actual[0].year).toBe(data.indicators[0].actual[0].year + 1);
    expect(next.indicators.find((i) => i.id === 'smp')!.actual.at(-1)!.value).toBe(105.5);
    expect(next.mix.actual.at(-1)!.year).toBe(last + 1);
    expect(next.asof).toBe('2027-03-02');
    expect(changes).toContain(`consumption ${last + 1} 추가`);
    expect(checkAnnual(MarketAnnualSchema.parse(next))).toEqual([]);
    // 원본은 그대로
    expect(data.indicators[0].actual.at(-1)!.year).toBe(last);
  });

  it('직전 해 대비 급변(잘못 읽음 의심)이면 그 지표만 그대로 두고 건너뜀', () => {
    const snap = buildSnapshot(cols(last + 1, 3), new Map(), new Map(), last + 2);
    const { data: next, skipped } = mergeAnnual(data, snap, '2027-03-02');
    expect(next.indicators.find((i) => i.id === 'consumption')!.actual).toEqual(data.indicators.find((i) => i.id === 'consumption')!.actual);
    expect(skipped.some((s) => s.startsWith('consumption'))).toBe(true);
    expect(skipped).toContain('smp: 받은 값 없음');
  });

  it('올해(진행 중인 해) 값은 쓰지 않음', () => {
    const snap = buildSnapshot(cols(last + 1), new Map(), new Map(), last + 1);
    expect(snap.values.consumption.has(last + 1)).toBe(false);
  });
});
