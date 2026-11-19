// @vitest-environment node
/**
 * 단위 테스트 — 계통도 전기 흐름 대상 연결선 계산 src/lib/diagram/flow.ts (DEBATE.md 신규 안건 1)
 * - 기기 없이 켜면 전체 전력선 (신호선·택1 제외)
 * - 기기 선택: 상류(전원 끝까지)·하류(1단계, 모선은 단계로 세지 않음), 신호선 제외, 택1은 선택 기기에 붙은 선만
 * - 방향: from→to, flow 필드 reverse/bi
 * - 실제 diagram.json: ESS↔PCS = bi, PCS 선택 시 PV·DC·ESS 상류 + 380V 연계 하류
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { DiagramSchema } from '../../../src/lib/schema';
import { edgeKind } from '../../../src/lib/diagram/geometry';
import { computeFlowEdges, flowDirMap, parseFlow, pathMidpoint, type FlowEdgeInput } from '../../../src/lib/diagram/flow';

const E = (id: string, from: string, to: string, kind: FlowEdgeInput['kind'] = 'power'): FlowEdgeInput => ({ id, from, to, kind, d: 'M0 0L10 0' });

/**
 *  src ─e1→ tr ─e2→ BUS ─e3→ a ─e5→ a2
 *                       └─e4→ b
 *  relay ─s1(signal)→ a,  x ─alt1→ a
 */
const edges = [E('e1', 'src', 'tr'), E('e2', 'tr', 'bus'), E('e3', 'bus', 'a'), E('e4', 'bus', 'b'), E('e5', 'a', 'a2'), E('s1', 'relay', 'a', 'signal'), E('alt1', 'x', 'a', 'alt')];
const isBus = (id: string) => id === 'bus';
const ids = (r: { id: string }[]) => r.map((x) => x.id).sort();

describe('computeFlowEdges', () => {
  it('선택 없음 = 전체 전력선, 신호선·택1 제외', () => {
    const r = computeFlowEdges(edges, new Map(), null, isBus);
    expect(ids(r)).toEqual(['e1', 'e2', 'e3', 'e4', 'e5']);
    expect(r.every((x) => x.role === 'all' && x.dir === 'forward')).toBe(true);
  });

  it('선택 기기의 상류는 전원 끝까지, 하류는 1단계 — 형제 피더(e4)는 상류가 아님', () => {
    const r = computeFlowEdges(edges, new Map(), 'a', isBus);
    expect(ids(r)).toEqual(['alt1', 'e1', 'e2', 'e3', 'e5']);
    expect(r.find((x) => x.id === 'e3')!.role).toBe('up');
    expect(r.find((x) => x.id === 'e5')!.role).toBe('down');
    expect(r.some((x) => x.id === 's1')).toBe(false);
  });

  it('하류는 모선을 단계로 세지 않음 — 변압기 선택 시 모선 너머 피더까지, 그 다음은 아님', () => {
    const r = computeFlowEdges(edges, new Map(), 'tr', isBus);
    expect(ids(r)).toEqual(['e1', 'e2', 'e3', 'e4']);
  });

  it('택1은 선택 기기에 바로 붙지 않으면 흐르지 않음', () => {
    const r = computeFlowEdges(edges, new Map(), 'src', isBus);
    expect(ids(r)).toEqual(['e1']);
    expect(computeFlowEdges(edges, new Map(), 'x', isBus).map((f) => f.id)).toContain('alt1');
  });

  it('신호선에만 붙은 기기는 흐름 없음', () => {
    expect(computeFlowEdges(edges, new Map(), 'relay', isBus)).toEqual([]);
  });

  it('reverse 는 to→from 으로 상·하류가 뒤집힘', () => {
    const r = computeFlowEdges([E('r1', 'p', 'q')], new Map([['r1', 'reverse' as const]]), 'p');
    expect(r).toEqual([{ id: 'r1', d: 'M0 0L10 0', dir: 'reverse', role: 'up' }]);
  });

  it('bi 는 양쪽 다 따라감 (ESS 선택 → PCS 하류 + 충전 쪽 상류 PV)', () => {
    const es = [E('b1', 'ess', 'pcs'), E('o1', 'pcs', 'out'), E('pv', 'dc', 'pcs')];
    const dirs = new Map([['b1', 'bi' as const]]);
    const fromEss = computeFlowEdges(es, dirs, 'ess', () => false, 2);
    expect(ids(fromEss)).toEqual(['b1', 'o1', 'pv']);
    expect(fromEss.find((x) => x.id === 'pv')!.role).toBe('up');
    expect(fromEss.find((x) => x.id === 'b1')!.dir).toBe('bi');
    // PCS 선택: ESS 는 상류이자 하류(양방향) — 한 번만
    expect(ids(computeFlowEdges(es, dirs, 'pcs'))).toEqual(['b1', 'o1', 'pv']);
  });
});

describe('실제 diagram.json', () => {
  const raw = JSON.parse(readFileSync(fileURLToPath(new URL('../../../src/data/diagram.json', import.meta.url)), 'utf8'));
  const diagram = DiagramSchema.parse(raw);
  const busIds = new Set(diagram.nodes.filter((n) => n.kind === 'bus').map((n) => n.id));
  const inputs: FlowEdgeInput[] = diagram.edges.map((e) => ({ id: e.id, from: e.from, to: e.to, kind: edgeKind(e), d: '' }));
  const dirs = flowDirMap(diagram.edges);

  it('flow 필드가 스키마를 통과하고 ESS↔PCS 는 양방향', () => {
    const ess = diagram.edges.find((e) => e.from === 'n-ess' && e.to === 'n-pcs')!;
    expect(ess.flow).toBe('bi');
    expect(dirs.get(ess.id)).toBe('bi');
  });

  it('PV→DC→PCS 는 데이터 from→to 가 이미 발전 방향 (reverse 표시 없음)', () => {
    for (const [a, b] of [['n-pv', 'n-dc'], ['n-dc', 'n-pcs']]) {
      const e = diagram.edges.find((x) => x.from === a && x.to === b)!;
      expect(dirs.get(e.id)).toBeUndefined();
    }
  });

  it('선택 없음 = 전력선 수와 같고 신호선은 하나도 없음', () => {
    const r = computeFlowEdges(inputs, dirs, null, (id) => busIds.has(id));
    expect(r.length).toBe(inputs.filter((e) => e.kind === 'power' && dirs.get(e.id) !== 'none').length);
    const signal = new Set(inputs.filter((e) => e.kind === 'signal').map((e) => e.id));
    expect(r.some((x) => signal.has(x.id))).toBe(false);
  });

  it('PCS 선택 = 상류 PV·DC·ESS, 하류 380V 연계, 신호선(마이크로그리드) 제외', () => {
    const r = computeFlowEdges(inputs, dirs, 'n-pcs', (id) => busIds.has(id));
    const byPair = (a: string, b: string) => r.find((x) => x.id === diagram.edges.find((e) => e.from === a && e.to === b)!.id);
    expect(byPair('n-pv', 'n-dc')?.role).toBe('up');
    expect(byPair('n-dc', 'n-pcs')?.role).toBe('up');
    expect(byPair('n-ess', 'n-pcs')?.dir).toBe('bi');
    expect(byPair('n-pcs', 'ep-pcs-out')?.role).toBe('down');
    expect(byPair('n-microgrid', 'n-pcs')).toBeUndefined();
  });
});

describe('pathMidpoint · parseFlow', () => {
  it('경로 길이의 가운데와 진행 각도', () => {
    expect(pathMidpoint('M0 0L0 10L30 10')).toEqual({ x: 10, y: 10, angle: 0 });
    expect(pathMidpoint('M0 0L0 20')).toEqual({ x: 0, y: 10, angle: 90 });
    expect(pathMidpoint('M5 5')).toBeNull();
  });
  it('기본 켜짐 — ?flow=0 만 꺼짐 (2026-11-19 사용자 요청)', () => {
    expect(parseFlow('1')).toBe(true);
    expect(parseFlow(null)).toBe(true);
    expect(parseFlow('0')).toBe(false);
  });
  it('기기를 고르지 않은 처음 화면 = 전체 전력선이 흐름 대상 (2026-11-19 사용자: 흐름 초기 활성화)', () => {
    const edges: FlowEdgeInput[] = [
      { id: 'p1', from: 'A', to: 'B', kind: 'power', d: 'M0 0H1' },
      { id: 'p2', from: 'B', to: 'C', kind: 'power', d: 'M0 0H1' },
      { id: 's1', from: 'C', to: 'D', kind: 'signal', d: 'M0 0H1' },
    ];
    const all = computeFlowEdges(edges, new Map(), null);
    expect(all.map((e) => e.id)).toEqual(['p1', 'p2']);
    expect(all.every((e) => e.role === 'all')).toBe(true);
  });
});

describe('흐름 없음(none) — 보호·계측 분기·기계 연결 (2026-11-19 전수 확인)', () => {
  it('none 연결선은 기기를 골라도, 전체 모드여도 흐르지 않는다', () => {
    const edges: FlowEdgeInput[] = [
      { id: 'a', from: 'S', to: 'B', kind: 'power', d: 'M0 0H1' },
      { id: 'la', from: 'B', to: 'LA', kind: 'power', d: 'M0 0H1' },
    ];
    const dirs = new Map([['la', 'none' as const]]);
    expect(computeFlowEdges(edges, dirs, null).map((e) => e.id)).toEqual(['a']);
    expect(computeFlowEdges(edges, dirs, 'B').map((e) => e.id)).toEqual(['a']);
    expect(computeFlowEdges(edges, dirs, 'LA')).toEqual([]);
  });
});
