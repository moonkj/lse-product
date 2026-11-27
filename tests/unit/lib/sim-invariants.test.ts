/**
 * 사고 시뮬레이션 전수 검증 (2026-11-27) — 국내 표준 계통도의 모든 기기에 사고·차단기 열기를 하나씩 넣고 불변 조건 확인.
 * 1) 평소 정전 없음  2) 정전 기기는 막힌 지점(열림·사고·트립·실패)을 지나야만 전원에 닿는 곳  3) 정전 아닌 기기는 실제로 전원에 닿음
 * 4) 트립 기기는 사고 지점의 상위이며, 사이에 다른(그 사고 종류로 동작하는) 보호기기가 없음(선택성)
 * 5) 차단 실패 시 정전 범위 ⊇ 정상 동작 시 정전 범위  6) 지락·과부하에 동작하지 않는 기기는 트립되지 않음
 * 7) 비상 공급 기기는 비상 전원(비상발전기·UPS) 하류  8) 절체 기기는 실제로 한쪽 입력을 잃고 다른 쪽으로 살아 있음
 */
import { describe, expect, it } from 'vitest';
import { getData } from '../../../src/data/load';
import { getDiagramModel } from '../../../src/lib/diagram/model';
import { flowDirMap } from '../../../src/lib/diagram/flow';
import { isBreaker, simulate, type FaultType, type SimGraph } from '../../../src/lib/diagram/sim';

const data = getData();
const model = getDiagramModel(data);
const dirs = flowDirMap(data.diagram.edges);
const g: SimGraph = { edges: model.edges, dirs, eqOf: (id) => model.nodeById.get(id)?.eq };

// 독립 구현(검증용): 전력 경로 인접 목록
const out = new Map<string, string[]>();
const inn = new Map<string, string[]>();
for (const e of model.edges) {
  if (e.kind === 'signal') continue;
  const d = dirs.get(e.id) ?? 'forward';
  if (d === 'none' || e.from === 'ep-pcs-in') continue;
  const pairs = d === 'reverse' ? [[e.to, e.from]] : d === 'bi' ? [[e.from, e.to], [e.to, e.from]] : [[e.from, e.to]];
  for (const [a, b] of pairs) {
    out.set(a, [...(out.get(a) ?? []), b]);
    inn.set(b, [...(inn.get(b) ?? []), a]);
  }
}
const eqId = (id: string) => model.nodeById.get(id)?.eq.id ?? '';
const sources = (ids: string[]) => [...new Set([...out.keys(), ...inn.keys()])].filter((id) => ids.includes(eqId(id)));
const MAIN = sources(['generator']);
const STANDBY = sources(['emergency-gen', 'ups']);
function reach(starts: string[], blocked: Set<string>) {
  const seen = new Set<string>();
  const q = starts.filter((s) => !blocked.has(s));
  q.forEach((s) => seen.add(s));
  while (q.length) {
    const n = q.shift()!;
    if (blocked.has(n)) continue;
    for (const m of out.get(n) ?? []) if (!seen.has(m)) (seen.add(m), blocked.has(m) || q.push(m));
  }
  return seen;
}
const BASE_MAIN = reach(MAIN, new Set());
const ALL = [...model.nodeById.values()].filter((n) => !n.ref && (out.has(n.id) || inn.has(n.id))).map((n) => n.id);
const NOT_GROUND = new Set(['mccb', 'branch-mccb', 'mms', 'ms', 'pf', 'lbs', 'auto-switch', 'alts', 'lv-ats', 'dc-devices']);
const NOT_OVERLOAD = new Set(['pf', 'lbs', 'auto-switch', 'alts', 'lv-ats', 'ehv-gis', 'gis-154', 'recloser']);
// 검증 대상 아님(계통도에 상위 차단기가 없어 '보호기기 없음'이 정상인 곳): 발전기·승압변압기
const skip = (t: FaultType) => (t === 'ground' ? NOT_GROUND : t === 'overload' ? NOT_OVERLOAD : new Set<string>());

/** 사고 지점에서 위로, 동작 가능한 보호기기를 지나지 않고 트립 기기에 닿는 경로가 있는지 (경로별 선택성) */
function nearestOnSomePath(fault: string, trip: string, t: FaultType): boolean {
  const seen = new Set([fault]);
  const q = [fault];
  while (q.length) {
    const n = q.shift()!;
    for (const up of inn.get(n) ?? []) {
      if (up === trip) return true;
      if (seen.has(up)) continue;
      seen.add(up);
      const eq = model.nodeById.get(up)?.eq;
      if (isBreaker(eq) && !skip(t).has(eq!.id)) continue; // 더 가까운 보호기기 — 이 경로는 여기서 끝
      q.push(up);
    }
  }
  return false;
}
function reachUp(from: string, target: string) {
  const seen = new Set([from]);
  const q = [from];
  while (q.length) {
    const n = q.shift()!;
    for (const up of inn.get(n) ?? []) {
      if (up === target) return true;
      if (!seen.has(up)) (seen.add(up), q.push(up));
    }
  }
  return false;
}

const problems: string[] = [];
function check(label: string, opened: string[], faults: string[], t: FaultType = 'short', fail = false) {
  // 검증용 독립 계산은 택1 을 모두 연결한 그래프 → 시뮬레이션도 alt: 'all' 로 같은 조건
  const r = simulate(g, new Set(opened), new Set(faults), { faultType: t, failPrimary: fail, alt: 'all' });
  const blocked = new Set([...opened, ...faults, ...r.tripped, ...r.failed]);
  const mainAlive = reach(MAIN, blocked);
  const allAlive = reach([...MAIN, ...STANDBY], blocked);
  for (const id of ALL) {
    const st = r.nodes.get(id);
    if (st === 'dead' && allAlive.has(id)) problems.push(`${label}: ${id} 정전인데 전원에 닿음`);
    if ((st === 'normal' || st === 'backup') && !allAlive.has(id) && !['pv', 'ess', 'pcs', 'dc-devices'].includes(eqId(id)))
      problems.push(`${label}: ${id} ${st} 인데 전원에 안 닿음`);
    if (st === 'backup' && mainAlive.has(id)) problems.push(`${label}: ${id} 비상인데 주 전원에 닿음`);
  }
  for (const tr of r.tripped) {
    for (const f of faults) {
      if (!fail && !reachUp(f, tr)) problems.push(`${label}: 트립 ${tr} 가 사고 ${f} 의 상위가 아님`);
      if (!fail && !nearestOnSomePath(f, tr, t)) problems.push(`${label}: 트립 ${tr} 가 가장 가까운 보호기기가 아님 (선택성)`);
    }
    if (skip(t).has(eqId(tr))) problems.push(`${label}: ${tr} 는 ${t} 에 동작하지 않아야 함`);
  }
  for (const x of r.transferred) {
    const lost = (inn.get(x) ?? []).some((u) => BASE_MAIN.has(u) && (!allAlive.has(u) || blocked.has(u)));
    const alive = (inn.get(x) ?? []).some((u) => allAlive.has(u) && !blocked.has(u));
    if (!lost || !alive) problems.push(`${label}: 절체 ${x} 조건 아님 (잃은 입력 ${lost}, 살아 있는 입력 ${alive})`);
  }
  return r;
}

describe('사고 시뮬레이션 전수 검증', () => {
  it('평소 정전 없음', () => {
    const r = simulate(g, new Set(), new Set());
    expect(r.dead).toEqual([]);
  });
  it('모든 기기 × 사고 종류 3 × 차단 실패 여부 / 모든 차단기 열기 — 불변 조건', () => {
    let runs = 0;
    for (const id of ALL) {
      const eq = model.nodeById.get(id)!.eq;
      if (isBreaker(eq)) {
        check(`열기 ${id}`, [id], []);
        runs++;
        continue;
      }
      for (const t of ['short', 'ground', 'overload'] as FaultType[]) {
        const a = check(`사고(${t}) ${id}`, [], [id], t);
        const b = check(`사고(${t})+실패 ${id}`, [], [id], t, true);
        runs += 2;
        const missing = a.dead.filter((x) => !b.dead.includes(x) && b.nodes.get(x) !== 'tripped' && b.nodes.get(x) !== 'failed');
        if (missing.length) problems.push(`사고(${t}) ${id}: 차단 실패인데 정전이 줄어듦 ${missing.join(',')}`);
      }
    }
    expect(runs).toBeGreaterThan(100);
    expect(problems).toEqual([]);
  });
  it('구체 사례: 과부하 조명 → ELCB·MCB 만 / 전동기 단락 → 인버터·소프트스타터·MC 가 끊고 ACB 는 그대로 / 비상발전기 고장은 절체 아님', () => {
    const light = simulate(g, new Set(), new Set(['n-light']), { faultType: 'overload' });
    expect(light.tripped.sort()).toEqual(['n-elcb', 'n-mcb']);
    const motor = simulate(g, new Set(), new Set(['n-motor']));
    expect(motor.tripped).not.toContain('n-acb');
    expect(motor.nodes.get('n-acb')).toBe('normal');
    const eg = simulate(g, new Set(), new Set(['n-egen']));
    expect(eg.transferred).toEqual([]);
    expect(eg.timeline.some((s) => s.text.includes('상위 보호기기가 계통도에 없음'))).toBe(true);
  });
});
