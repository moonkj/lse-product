/** 사고 시뮬레이션 (src/lib/diagram/sim.ts) — 실제 국내 표준 계통도 데이터로 */
import { describe, expect, it } from 'vitest';
import { getData } from '../../../src/data/load';
import { getDiagramModel } from '../../../src/lib/diagram/model';
import { flowDirMap } from '../../../src/lib/diagram/flow';
import { isBreaker, protectiveDevices, simulate, type SimGraph } from '../../../src/lib/diagram/sim';

const data = getData();
const model = getDiagramModel(data);
const g: SimGraph = { edges: model.edges, dirs: flowDirMap(data.diagram.edges), eqOf: (id) => model.nodeById.get(id)?.eq };
const S = (...a: string[]) => new Set(a);

describe('사고 시뮬레이션', () => {
  it('평소: 정전 없음, 차단기 판정', () => {
    const r = simulate(g, S(), S());
    expect(r.dead).toEqual([]);
    expect(r.backup).toEqual([]);
    expect(r.nodes.get('n-acb')).toBe('normal');
    expect(isBreaker(model.nodeById.get('n-vcb')!.eq)).toBe(true);
    expect(isBreaker(model.nodeById.get('n-fcl')!.eq)).toBe(false);
    expect(isBreaker(model.nodeById.get('n-cast-tr')!.eq)).toBe(false);
  });
  it('ACB 열기 → 380V 쪽 정전, 비상 부하는 비상발전기+ATS 로 버팀(전환)', () => {
    const r = simulate(g, S('n-acb'), S());
    expect(r.nodes.get('n-acb')).toBe('open');
    expect(r.nodes.get('n-mccb')).toBe('dead');
    expect(r.nodes.get('n-light')).toBe('dead');
    expect(r.nodes.get('n-ats')).toBe('backup');
    expect(r.transferred).toContain('n-ats');
    // 다른 변압기(TR2) 쪽은 그대로
    expect(r.nodes.get('n-busway')).toBe('normal');
  });
  it('VCB 열기 → 수전 하류 전체 정전, UPS 아래(HMI)는 배터리로 버팀', () => {
    const r = simulate(g, S('n-vcb'), S());
    expect(r.nodes.get('n-busway')).toBe('dead');
    expect(r.nodes.get('n-ups')).toBe('backup');
    expect(r.nodes.get('n-hmi')).toBe('backup');
    expect(r.nodes.get('n-mof')).toBe('normal');
  });
  it('조명 사고 → 바로 위 ELCB·MCB 가 트립, 조명만 정전 (분전반은 살아 있음)', () => {
    expect(protectiveDevices(g, 'n-light').sort()).toEqual(['n-elcb', 'n-mcb']);
    const r = simulate(g, S(), S('n-light'));
    expect(r.nodes.get('n-light')).toBe('fault');
    expect(r.tripped.sort()).toEqual(['n-elcb', 'n-mcb']);
    expect(r.nodes.get('n-panel')).toBe('normal');
    expect(r.nodes.get('n-evc')).toBe('normal');
  });
  it('몰드변압기 사고 → 상위 VCB 트립', () => {
    const r = simulate(g, S(), S('n-cast-tr'));
    expect(r.tripped).toEqual(['n-vcb']);
    expect(r.nodes.get('n-acb')).toBe('dead');
  });
  it('2회선 수전: LBS 를 열어도 ALTS 쪽으로 계속 공급', () => {
    const r = simulate(g, S('n-lbs'), S());
    expect(r.nodes.get('n-mof')).toBe('normal');
    expect(r.dead).toEqual([]);
  });
});
