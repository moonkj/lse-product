/**
 * 데이터 무결성 — 계획 파이프라인 레이어 (전력시장 10인 토론 P0-2, src/data/market-plans.json)
 * 모든 수치 = SourcedValue(출처 url·기준일·신뢰도·실적/전망·방법). 기기 id 는 equipment-types.json 에 있어야 하고,
 * 표현은 "계획 기반 설비 소요"(발주 예측 아님), 합산 점수 없음.
 */
import { describe, it, expect } from 'vitest';
import plansJson from '../../../src/data/market-plans.json';
import { getData } from '../../../src/data/load';
import { getDiagramModel } from '../../../src/lib/diagram/model';
import { TILE_H, TILE_W } from '../../../src/lib/diagram/geometry';
import { SourcedValueSchema } from '../../../src/lib/market/source';
import { planSlots, largestFreeBox, segmentsOf } from '../../../src/lib/market/planLayout';
import {
  PLAN_LAYERS,
  PlansFileSchema,
  compareOf,
  coverageRows,
  getPlans,
  headlineOf,
  milestonePos,
  projectShift,
  timelineRange,
} from '../../../src/lib/market/plans';

const plans = getPlans();
const data = getData();

describe('market-plans.json 스키마·출처', () => {
  it('zod 검증 통과', () => {
    expect(PlansFileSchema.safeParse(plansJson).success).toBe(true);
  });

  it('모든 수치·일정 표지가 SourcedValue 규칙을 따름 (https 출처·기준일·방법)', () => {
    const all = [...plans.items.flatMap((i) => i.figures), ...plans.projects.flatMap((p) => p.milestones)];
    expect(all.length).toBeGreaterThan(10);
    for (const v of all) {
      expect(SourcedValueSchema.safeParse(v).success).toBe(true);
      expect(v.source.url.startsWith('https://')).toBe(true);
      expect(v.source.url).not.toMatch(/ls-electric\.com/);
    }
  });

  it('공식 문서가 아닌 보도 인용은 2차 인용, 역산 값은 확인 필요로 표시', () => {
    for (const v of plans.items.flatMap((i) => i.figures)) {
      if (!/(motir\.go\.kr|kepco\.co\.kr)/.test(v.source.url)) expect(v.source.confidence).toBe('secondary');
      if (/역산/.test(v.method)) expect(v.needsCheck).toBe(true);
    }
  });

  it('없는 계획 차수를 참조하면 검증 실패', () => {
    const bad = structuredClone(plansJson) as typeof plansJson;
    (bad.items[0].figures[0] as { edition?: string }).edition = 'tx99';
    expect(PlansFileSchema.safeParse(bad).success).toBe(false);
  });

  it('중복 id 는 검증 실패', () => {
    const bad = structuredClone(plansJson) as typeof plansJson;
    bad.items[1].id = bad.items[0].id;
    expect(PlansFileSchema.safeParse(bad).success).toBe(false);
  });

  it('연결 기기 id 가 모두 equipment-types.json 에 있음', () => {
    const ids = new Set(data.equipmentTypes.map((e) => e.id));
    for (const x of [...plans.items, ...plans.projects]) for (const id of x.equipment) expect(ids.has(id), `${x.id} → ${id}`).toBe(true);
  });

  it('밴드마다 항목이 하나 이상, 사업은 비교 쌍 양쪽 차수의 표지를 가짐', () => {
    for (const l of PLAN_LAYERS) expect(plans.items.some((i) => i.layer === l), l).toBe(true);
    for (const p of plans.projects) {
      expect(p.milestones.some((m) => m.edition === 'tx10')).toBe(true);
      expect(p.milestones.some((m) => m.edition === 'tx11')).toBe(true);
    }
  });

  it('표현 규칙: "발주 예측"·점수 표현 없음, 제목은 "계획 기반 설비 소요"', () => {
    const text = JSON.stringify(plansJson);
    expect(plans.title).toBe('계획 기반 설비 소요');
    expect(text).not.toMatch(/발주\s*예측|점수|score/);
  });
});

describe('계산', () => {
  it('차수 비교: 같은 단위면 증감, 단위가 다르면 비교 불가', () => {
    const inv = plans.items.find((i) => i.id === 'tx-invest')!;
    expect(compareOf(inv, plans.compare)).toMatchObject({ comparable: true, delta: 16.3 });
    const line = plans.items.find((i) => i.id === 'tx-line')!;
    const c = compareOf(line, plans.compare)!;
    expect(c.comparable).toBe(false);
    expect(c.delta).toBeUndefined();
    expect(headlineOf(line, plans.compare).value).toBe(61183);
  });

  it('차수 없는 항목은 가장 늦은 전망이 대표 값', () => {
    const der = plans.items.find((i) => i.id === 'dist-der')!;
    expect(headlineOf(der, plans.compare)).toMatchObject({ value: 36.6, year: 2028 });
  });

  it('사업 일정 변동 (개월, + = 지연)', () => {
    const p = plans.projects.find((x) => x.id === 'donghae-1')!;
    expect(projectShift(p, 'tx10', 'tx11')?.months).toBe(16);
    const d = plans.projects.find((x) => x.id === 'dangjin-345')!;
    expect(projectShift(d, 'tx10', 'tx11')?.months).toBe(36);
    const h = plans.projects.find((x) => x.id === 'honam-hvdc')!;
    expect(projectShift(h, 'tx10', 'tx11')).toMatchObject({ months: 24, yearOnly: true });
    expect(projectShift(h, 'bp10', 'bp11')).toBeUndefined();
  });

  it('일정 축 위치는 0~1', () => {
    const r = timelineRange(plans.projects);
    for (const p of plans.projects) for (const m of p.milestones) {
      const x = milestonePos(m, r);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
    }
  });

  it('보유 상태: 미보유·일부 보유가 앞에', () => {
    const rows = coverageRows(['transmission-line', 'la-ehv', 'relay-tx', 'ehv-gis'], data.equipmentTypes);
    expect(rows.map((r) => r.coverage).slice(0, 2)).toEqual(['missing', 'partial']);
  });
});

describe('카드 자리 (계통도 좌표)', () => {
  const model = getDiagramModel(data);
  const slots = planSlots(model, PLAN_LAYERS);

  it('L1·L2·L3·신재생 모두 자리가 있고 밴드 안에 들어감', () => {
    for (const l of PLAN_LAYERS) {
      const s = slots.get(l);
      const r = model.layerRect.get(l)!;
      expect(s, l).toBeDefined();
      expect(s!.x).toBeGreaterThanOrEqual(r.x);
      expect(s!.y).toBeGreaterThanOrEqual(r.y);
      expect(s!.x + s!.w).toBeLessThanOrEqual(r.x + r.w);
      expect(s!.y + s!.h).toBeLessThanOrEqual(r.y + r.h);
    }
  });

  it('타일(배지 포함)·연결선과 겹치지 않음', () => {
    const hit = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
      a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    for (const s of slots.values()) {
      for (const n of [...model.nodes, ...model.refs])
        expect(hit(s, { x: n.x - TILE_W / 2, y: n.y - TILE_H / 2, w: TILE_W, h: TILE_H }), n.id).toBe(false);
      for (const e of model.edges) for (const seg of segmentsOf(e.d)) expect(hit(s, seg), e.id).toBe(false);
    }
  });

  it('빈자리 찾기: 장애물을 피함, 자리가 없으면 undefined', () => {
    const band = { x: 0, y: 0, w: 1000, h: 400 };
    const box = largestFreeBox(band, [{ x: 0, y: 0, w: 500, h: 400 }])!;
    expect(box.x).toBeGreaterThanOrEqual(500);
    expect(largestFreeBox(band, [{ x: 100, y: 0, w: 800, h: 400 }])).toBeUndefined();
  });
});
