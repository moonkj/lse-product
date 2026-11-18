/**
 * 단위 테스트 (UT-13) — src/lib/pages/compare.ts 비교 화면 파생 값.
 * 합성 데이터셋(compare-fixture.ts)으로 getData() 를 바꿔 실제 데이터 변화와 무관하게 검증.
 * 기대값은 구현 호출 없이 손으로 적는다 (SPEC_KEYS 순서 = 정격전압·정격전류·정격차단전류·프레임·극수 …).
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/data/load', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/data/load')>();
  const { FAKE, FAKE_SPECS } = await import('./compare-fixture');
  return {
    ...actual,
    getData: () => FAKE,
    useData: () => FAKE,
    resolveProducts: (eq: Parameters<typeof actual.resolveProducts>[0], data = FAKE) => actual.resolveProducts(eq, data),
    resolveCategories: (eq: Parameters<typeof actual.resolveCategories>[0], data = FAKE) => actual.resolveCategories(eq, data),
    docsByProductId: (id: string) => FAKE.docsByProductId.get(id),
    loadSpecs: async () => FAKE_SPECS,
    peekSpecs: () => FAKE_SPECS,
    equipmentImageUrl: () => undefined,
    equipmentThumbUrl: () => undefined,
  };
});

import {
  countDocs,
  equipmentDocCounts,
  equipmentSpecMap,
  linkedEquipment,
  orderSpecKeys,
  pageHref,
  parseCompareParams,
  productDocs,
  representativeDoc,
  specLabel,
  specProductCount,
  specValueText,
  compareKey,
} from '../../../src/lib/pages/compare';
import { equipmentForProduct } from '../../../src/lib/pages/catalog';
import { COMPARE_MAX } from '../../../src/store/useCompareStore';
import { DOCS, FAKE_SPECS, URL1 } from './compare-fixture';

const parse = (q: string) => parseCompareParams(new URLSearchParams(q));

describe('UT-13 parseCompareParams (URL 이 비교 화면의 원본)', () => {
  it('COMPARE_MAX = 4', () => {
    expect(COMPARE_MAX).toBe(4);
  });

  it('type 없음 → type null, 목록 비움, badType 없음', () => {
    expect(parse('')).toEqual({ type: null, ids: [], missing: [], overflow: [], badType: undefined });
    expect(parse('type=&ids=eq-a')).toEqual({ type: null, ids: [], missing: [], overflow: [], badType: undefined });
  });

  it('(v1.0) 잘못된 type → type null + badType(소문자·trim) 안내용', () => {
    expect(parse('type=foo&ids=eq-a,eq-b')).toEqual({ type: null, ids: [], missing: [], overflow: [], badType: 'foo' });
    expect(parse('type=%20Cars%20')).toMatchObject({ type: null, badType: 'cars' });
  });

  it('(v1.0) type 대소문자·앞뒤 공백 무시 (의도된 동작)', () => {
    expect(parse('type=Equipment&ids=eq-a')).toEqual({ type: 'equipment', ids: ['eq-a'], missing: [], overflow: [] });
    expect(parse('type=%20PRODUCT%20&ids=P90001').type).toBe('product');
  });

  it('(v1.0) ids=a&ids=b 반복 파라미터도 허용, 쉼표와 섞어도 순서·중복 처리 동일', () => {
    expect(parse('type=equipment&ids=eq-a&ids=eq-b').ids).toEqual(['eq-a', 'eq-b']);
    expect(parse('type=equipment&ids=eq-a,eq-b&ids=eq-a&ids=eq-c,nope')).toEqual({
      type: 'equipment',
      ids: ['eq-a', 'eq-b', 'eq-c'],
      missing: ['nope'],
      overflow: [],
    });
  });

  it('기기: 순서 유지, 공백·빈 칸 무시', () => {
    expect(parse('type=equipment&ids=eq-b, eq-a,,')).toEqual({ type: 'equipment', ids: ['eq-b', 'eq-a'], missing: [], overflow: [] });
  });

  it('없는 id → missing 으로 빼고 나머지만', () => {
    expect(parse('type=equipment&ids=eq-a,nope,eq-b')).toEqual({ type: 'equipment', ids: ['eq-a', 'eq-b'], missing: ['nope'], overflow: [] });
  });

  it('제품 type 은 제품 id 로만 판정 (기기 id 는 없는 항목)', () => {
    expect(parse('type=product&ids=P90001,eq-a,P90002')).toEqual({ type: 'product', ids: ['P90001', 'P90002'], missing: ['eq-a'], overflow: [] });
    expect(parse('type=equipment&ids=P90001')).toEqual({ type: 'equipment', ids: [], missing: ['P90001'], overflow: [] });
  });

  it('중복 id 는 하나로 합침 (첫 위치)', () => {
    expect(parse('type=equipment&ids=eq-a,eq-b,eq-a').ids).toEqual(['eq-a', 'eq-b']);
  });

  it('4개 초과 → 앞 4개, 나머지는 overflow (없는 id 는 개수에 안 셈)', () => {
    expect(parse('type=product&ids=P90001,P90002,X1,P90003,P90004,P90005,P90006')).toEqual({
      type: 'product',
      ids: ['P90001', 'P90002', 'P90003', 'P90004'],
      missing: ['X1'],
      overflow: ['P90005', 'P90006'],
    });
  });

  it('URL 인코딩된 쉼표 구분도 같은 결과', () => {
    expect(parse('type=equipment&ids=eq-a%2Ceq-b').ids).toEqual(['eq-a', 'eq-b']);
  });
});

describe('UT-13 사양 행 정렬·라벨·표기', () => {
  it('orderSpecKeys: 표준 키는 SPEC_KEYS 순서, 비표준은 처음 나온 순서로 뒤에, 중복 제거', () => {
    expect(orderSpecKeys(['ipRating', 'poles', 'ratedVoltage', 'zeta', 'frame', 'ipRating', 'ratedCurrent'])).toEqual([
      'ratedVoltage',
      'ratedCurrent',
      'frame',
      'poles',
      'ipRating',
      'zeta',
    ]);
    expect(orderSpecKeys([])).toEqual([]);
    expect(orderSpecKeys(['standards', 'communication', 'mounting'])).toEqual(['communication', 'mounting', 'standards']);
  });

  it('specLabel: 표준 키 = SPEC_KEYS 라벨(데이터 label 무시), 비표준 = 데이터 label, 둘 다 없으면 key', () => {
    expect(specLabel('ratedVoltage', '정격 전압(오타)')).toBe('정격전압');
    expect(specLabel('ipRating', '보호등급(IP)')).toBe('보호등급(IP)');
    expect(specLabel('unknownKey')).toBe('unknownKey');
  });

  it('specValueText: 단위 있으면 "값 단위", 없으면 값 그대로', () => {
    expect(specValueText({ value: '630~6300', unit: 'AF' })).toBe('630~6300 AF');
    expect(specValueText({ value: '고정형 / 인출형' })).toBe('고정형 / 인출형');
    expect(specValueText({ value: '3 / 4', unit: 'P' })).toBe('3 / 4 P');
  });

  it('(v1.0 M4) specValueText: 단위는 괄호 밖 숫자 바로 뒤·괄호 주석 앞으로', () => {
    expect(specValueText({ value: '110 (55~125) (PT 입력)', unit: 'V' })).toBe('110 V (55~125) (PT 입력)');
    expect(specValueText({ value: '0.05~6 (5A), 0.01~1.2 (1A)', unit: 'A' })).toBe('0.05~6 A (5A), 0.01~1.2 A (1A)');
    expect(specValueText({ value: '690 (18·22AF) / 1000 (40AF 이상) (Ue)', unit: 'V' })).toBe('690 V (18·22AF) / 1000 V (40AF 이상) (Ue)');
    // 괄호 뒤에 숫자가 이어지면 끝에도 단위
    expect(specValueText({ value: '220 (DC) / 110', unit: 'V' })).toBe('220 V (DC) / 110 V');
    // 숫자 뒤 괄호가 없고 괄호 안에만 숫자 → 원래대로 "값 단위"
    expect(specValueText({ value: '최대 85 (900Vac)', unit: 'kA' })).toBe('최대 85 kA (900Vac)');
    expect(specValueText({ value: '(옵션) 고정형', unit: 'mm' })).toBe('(옵션) 고정형 mm');
  });

  it('(v1.0 M4) specValueText: "40(10)" 같은 계기 정격 표기는 한 덩어리로 두고 끝에 단위', () => {
    expect(specValueText({ value: '40(10)', unit: 'A' })).toBe('40(10) A');
    expect(specValueText({ value: '5(6), 40(10)', unit: 'A' })).toBe('5(6), 40(10) A');
    // 숫자에 붙었어도 괄호 안이 숫자만이 아니면 주석 → 앞에 단위
    expect(specValueText({ value: '60(Hz 기준)', unit: 'A' })).toBe('60 A (Hz 기준)');
  });

  it('(v1.0 M3) compareKey: 같은 의미의 다른 표기를 같은 값으로', () => {
    const same = (a: string, b: string) => expect(compareKey(a), `${a} ≟ ${b}`).toBe(compareKey(b));
    const diff = (a: string, b: string) => expect(compareKey(a), `${a} ≠ ${b}`).not.toBe(compareKey(b));
    same('１１０ Ｖ', '110 V'); // NFKC 전각
    same('630～6300 AF', '630~6300 AF');
    same('630〜6300 AF', '630∼6300 AF');
    same('50 KA', '50 ka'); // 대소문자
    same('690 VAC', '690 V');
    same('690 V AC', '690 Vac');
    same('50 / 60 Hz', '50/60Hz'); // 공백
    same('3, 4 P', '3 / 4 P'); // 쉼표 = 슬래시
    same('60, 50 Hz', '50/60 Hz'); // 숫자 목록 정렬
    same('4/3 P', '3/4 P');
    diff('110 VDC', '110 V'); // DC 는 구분
    diff('110 V DC', '110 VAC');
    diff('30 mA', '0.03 A'); // 단위 환산 안 함
    diff('630~6300 AF', '6300~630 AF'); // 범위는 정렬 대상 아님
    diff('3 P', '4 P');
  });

  it('(v1.0) compareKey 값 자체 (정규화 결과 문자열)', () => {
    expect(compareKey('60, 50 Hz')).toBe('50/60hz');
    expect(compareKey(' 690 V AC ')).toBe('690v');
    expect(compareKey('1.5/0.5/10 kA')).toBe('0.5/1.5/10ka');
  });

  it('pageHref: 페이지 있으면 #page=N, 없으면 URL 그대로', () => {
    expect(pageHref(URL1, 12)).toBe(`${URL1}#page=12`);
    expect(pageHref(URL1)).toBe(URL1);
  });
});

describe('UT-13 기기 단위 사양·자료 집계', () => {
  it('equipmentSpecMap(eq-a): 소속 제품 P90001·P90002 의 값을 key 별로, 한 제품의 같은 key 여러 개도 모두', () => {
    const m = equipmentSpecMap('eq-a', FAKE_SPECS);
    const summary = Object.fromEntries([...m].map(([k, list]) => [k, list.map((e) => `${e.product.id}:${e.item.value}`)]));
    expect(summary).toEqual({
      ratedCurrent: ['P90001:630'],
      ratedVoltage: ['P90001:690', 'P90002:690'],
      ipRating: ['P90001:IP20', 'P90002:IP20'],
      poles: ['P90001:3', 'P90001:4'],
      breakingCapacity: ['P90002:50'],
    });
  });

  it('사양 없는 기기·제품 없는 기기 → 빈 맵, 수집 제품 수 0', () => {
    expect(equipmentSpecMap('eq-b', FAKE_SPECS).size).toBe(0);
    expect(equipmentSpecMap('eq-d', FAKE_SPECS).size).toBe(0);
    expect(specProductCount('eq-b', FAKE_SPECS)).toBe(0);
    expect(specProductCount('eq-a', FAKE_SPECS)).toBe(2);
    expect(specProductCount('eq-c', FAKE_SPECS)).toBe(1);
    // 사양 Map 이 비면(불러오기 전·실패) 모두 0
    expect(specProductCount('eq-a', new Map())).toBe(0);
    expect(equipmentSpecMap('eq-a', new Map()).size).toBe(0);
  });

  it('countDocs·productDocs·equipmentDocCounts: 유형별 개수 (자료 없는 제품 = 0)', () => {
    expect(productDocs('P90001')).toBe(DOCS.P90001.docs);
    expect(productDocs('P90003')).toEqual([]);
    expect(countDocs(DOCS.P90001.docs)).toEqual({ catalog: 1, datasheet: 0, manual: 1, certificate: 0, software: 0, cad: 1, other: 0 });
    expect(equipmentDocCounts('eq-a')).toEqual({ catalog: 1, datasheet: 1, manual: 2, certificate: 0, software: 0, cad: 1, other: 0 });
    expect(equipmentDocCounts('eq-b')).toEqual({ catalog: 0, datasheet: 0, manual: 0, certificate: 0, software: 0, cad: 0, other: 0 });
  });

  it('representativeDoc: 카탈로그 → 데이터시트 → 매뉴얼 → 첫 자료, 없으면 undefined', () => {
    expect(representativeDoc(DOCS.P90001.docs)?.title).toBe('catalog 1');
    expect(representativeDoc(DOCS.P90002.docs)?.title).toBe('datasheet 2');
    const other = [
      { type: 'cad' as const, title: 'c', url: 'https://www.ls-electric.com/c' },
      { type: 'manual' as const, title: 'm', url: 'https://www.ls-electric.com/m' },
    ];
    expect(representativeDoc(other)?.title).toBe('m');
    expect(representativeDoc([other[0]])?.title).toBe('c');
    expect(representativeDoc([])).toBeUndefined();
  });

  it('equipmentForProduct: 카테고리 하위 코드 제품도 기기에 연결 (CAT900 ⊃ CAT900001)', () => {
    expect(equipmentForProduct('P90003').map((e) => e.id)).toEqual(['eq-b']);
    expect(equipmentForProduct('P90005')).toEqual([]);
  });
});

describe('UT-13 linkedEquipment — 상류·하류 연결 기기 (모선 건너뛰기)', () => {
  const view = (id: string, dir: 'in' | 'out') => linkedEquipment(id, dir).map((l) => `${l.eq?.id ?? `ep:${l.label}`}/${l.kind}`);

  it('상류: 모선 b1 너머 전원 쪽 기기(eq-up) + 신호선 감시 기기는 뒤에, 형제 피더(eq-b)·자기 참조 타일은 제외', () => {
    expect(view('eq-a', 'in')).toEqual(['eq-up/power', 'eq-mon/signal']);
  });

  it('하류: 택1·끝점 라벨, 같은 기기(eq-c) 두 번 연결돼도 1번 (첫 연결선 종류), 참조 타일의 연결(eq-d)은 대표 노드 것이 아님', () => {
    expect(view('eq-a', 'out')).toEqual(['eq-c/alt', 'ep:비상 부하/power']);
  });

  it('형제 피더 eq-b 의 상류 = eq-up (eq-a 아님), 하류 없음', () => {
    expect(view('eq-b', 'in')).toEqual(['eq-up/power']);
    expect(view('eq-b', 'out')).toEqual([]);
  });

  it('모선으로 전원을 넣는 기기의 하류 = 모선 아래 피더 전부', () => {
    expect(view('eq-up', 'out')).toEqual(['eq-a/power', 'eq-b/power']);
  });

  it('노드 없는 기기 → 빈 목록, 라벨은 약어 우선', () => {
    expect(linkedEquipment('eq-nonode', 'in')).toEqual([]);
    expect(linkedEquipment('eq-a', 'in')[0].label).toBe('UP');
    expect(linkedEquipment('eq-up', 'out')[1].label).toBe('기기 B');
  });
});
