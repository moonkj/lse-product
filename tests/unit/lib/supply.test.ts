/**
 * 단위 테스트 — src/lib/supply.ts (실시간 전력수급, DEBATE.md 신규 안건 2)
 * 실제 API 는 부르지 않는다: tests/unit/fixtures/sukub5m-today.json(오늘 5분 단위 응답 모양) 으로 파싱만 확인.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  RESERVE_LEVELS,
  SUPPLY_SOURCE,
  buildSupplyData,
  hmKst,
  isNoRetryError,
  isStale,
  isSupplyData,
  kstIso,
  nextUpdateHm,
  normalizeRows,
  parseDataGoKrItems,
  reserveLevel,
  serviceError,
  sparkPaths,
} from '../../../src/lib/supply';

const fixture = readFileSync(resolve(__dirname, '../fixtures/sukub5m-today.json'), 'utf8');
const env = (header: object, body: object = {}) => JSON.stringify({ response: { header, body } });

describe('parseDataGoKrItems — 공공데이터포털 응답 봉투', () => {
  it('픽스처: items.item 배열을 꺼낸다', () => {
    const items = parseDataGoKrItems(fixture);
    expect(items.length).toBe(173);
    expect(items[0]).toHaveProperty('baseDatetime', '20261119000000');
  });

  it('1건이면 item 이 객체로 와도 배열로', () => {
    const one = env({ resultCode: '00' }, { items: { item: { baseDatetime: '20261119100000', suppReserveRate: '12.3' } } });
    expect(parseDataGoKrItems(one)).toHaveLength(1);
  });

  it('조회 결과 없음(03)은 0건, 오류 코드는 예외', () => {
    expect(parseDataGoKrItems(env({ resultCode: '03', resultMsg: 'NODATA_ERROR' }))).toEqual([]);
    expect(() => parseDataGoKrItems(env({ resultCode: '30', resultMsg: 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR' }))).toThrow(/30 SERVICE_KEY/);
    expect(() => parseDataGoKrItems('<html>')).toThrow(/JSON이 아님/);
  });

  it('게이트웨이 XML 오류(한도 초과 등)는 errMsg 로 예외', () => {
    const xml = '<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR</errMsg></cmmMsgHeader></OpenAPI_ServiceResponse>';
    expect(serviceError(xml)).toBe('LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR');
    expect(() => parseDataGoKrItems(xml)).toThrow(/LIMITED_NUMBER/);
    expect(serviceError('{"ok":1}')).toBe('');
  });

  it('다시 해도 안 되는 오류(키·권한·한도)는 재시도하지 않음, 5xx·시간 초과는 재시도', () => {
    expect(isNoRetryError('요청 실패: HTTP 429')).toBe(true);
    expect(isNoRetryError('응답 오류: LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR')).toBe(true);
    expect(isNoRetryError('요청 실패: HTTP 403')).toBe(true);
    expect(isNoRetryError('요청 실패: HTTP 502')).toBe(false);
    expect(isNoRetryError('요청 실패: TimeoutError')).toBe(false);
  });
});

describe('normalizeRows / buildSupplyData', () => {
  it('픽스처(MW) → GW, 시각순, 최신 = 14:20', () => {
    const d = buildSupplyData(parseDataGoKrItems(fixture), new Date('2026-11-19T05:21:00Z'))!;
    expect(d.source).toBe(SUPPLY_SOURCE);
    expect(d.rows).toHaveLength(173);
    expect(d.asof).toBe('2026-11-19T14:20:00+09:00');
    expect(d.latest).toEqual({ t: d.asof, demand: 68.43, supply: 86, reserve: 17.57, rate: 25.7 });
    expect(d.rows[0].t < d.rows[1].t).toBe(true);
    expect(isSupplyData(d)).toBe(true);
  });

  it('필드 이름 후보·대소문자 무시, 예비력·예비율이 없으면 계산', () => {
    const rows = normalizeRows([
      { BASEDATETIME: '202611191005', currentDemand: '70,000', supplyAbility: '80000' },
      { tm: '2026-11-19 10:00', curDemand: 69.5, suppAbility: 79.5, reserveRate: '14.4' },
    ]);
    expect(rows.map((r) => r.t)).toEqual(['2026-11-19T10:00:00+09:00', '2026-11-19T10:05:00+09:00']);
    expect(rows[1]).toMatchObject({ demand: 70, supply: 80, reserve: 10, rate: 14.3 });
    // 같은 응답 안에서 수요가 MW 이므로 두 번째 행(이미 GW 처럼 보이는 값)도 MW 로 봄 → 단위는 응답 전체로 한 번만 판정
    expect(rows[0].demand).toBe(0.07);
  });

  it('예비력이 1000MW 미만으로 떨어져도 GW 로 잘못 읽지 않음', () => {
    const [r] = normalizeRows([{ baseDatetime: '20261119180000', currPwrTot: '90000', suppAbility: '90900', suppReservePwr: '900' }]);
    expect(r.reserve).toBe(0.9);
    expect(reserveLevel(r.reserve)?.label).toBe('심각');
  });

  it('시각이 없거나 예비율·예비력을 못 구하는 행은 뺌, 다 빠지면 null', () => {
    expect(normalizeRows([{ foo: 1 }, { baseDatetime: '20261119100000', currPwrTot: '70000' }])).toEqual([]);
    expect(buildSupplyData([{ foo: 1 }])).toBeNull();
    expect(kstIso('2026111910')).toBeNull();
    expect(kstIso('20261319100000')).toBeNull();
  });
});

describe('표시 규칙', () => {
  it('경보 단계 = 공급예비력(GW) "미만" 기준', () => {
    expect(RESERVE_LEVELS.map((l) => l.belowGw)).toEqual([1.5, 2.5, 3.5, 4.5, 5.5]);
    expect(reserveLevel(5.5)?.label).toBe('정상');
    expect(reserveLevel(5.49)?.label).toBe('준비');
    expect(reserveLevel(4.4)?.label).toBe('관심');
    expect(reserveLevel(3.0)?.label).toBe('주의');
    expect(reserveLevel(2.0)?.label).toBe('경계');
    expect(reserveLevel(1.49)?.level).toBe('serious');
    expect(reserveLevel(null)).toBeNull();
  });

  it('40분 넘게 갱신이 없으면 지연', () => {
    const asof = '2026-11-19T14:20:00+09:00';
    expect(isStale(asof, new Date('2026-11-19T05:59:00Z'))).toBe(false); // 14:59 KST (39분)
    expect(isStale(asof, new Date('2026-11-19T06:01:00Z'))).toBe(true); // 15:01 KST (41분)
    expect(isStale('garbage')).toBe(true);
  });

  it('기준 시각은 기기 시간대와 무관하게 KST HH:MM, 다음 갱신 = 생성 + 20분', () => {
    expect(hmKst('2026-11-19T14:20:00+09:00')).toBe('14:20');
    expect(hmKst('2026-11-19T15:05:00Z')).toBe('00:05');
    expect(hmKst(undefined)).toBe('--:--');
    const d = buildSupplyData(parseDataGoKrItems(fixture), new Date('2026-11-19T05:21:00Z'))!;
    expect(nextUpdateHm(d)).toBe('14:41');
  });

  it('isSupplyData 는 모양이 틀린 JSON 을 거름', () => {
    expect(isSupplyData(null)).toBe(false);
    expect(isSupplyData({ asof: 'x', rows: [], latest: { t: 'x' } })).toBe(false);
    expect(isSupplyData({ asof: '2026-11-19T14:20:00+09:00', rows: [] })).toBe(false);
  });

  it('스파크라인: 2점 이상이면 경로, 빈 값은 끊음', () => {
    const rows = [
      { t: 'a', demand: 60, supply: 80, reserve: 20, rate: 33 },
      { t: 'b', demand: null, supply: 80, reserve: null, rate: null },
      { t: 'c', demand: 70, supply: 80, reserve: 10, rate: 14 },
    ];
    const p = sparkPaths(rows);
    expect(p.demand.match(/M/g)).toHaveLength(2);
    expect(p.supply.startsWith('M')).toBe(true);
    expect(sparkPaths(rows.slice(0, 1)).demand).toBe('');
  });
});
