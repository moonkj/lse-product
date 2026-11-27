/**
 * 사고 시뮬레이션 (2026-11-27) — 계통도에서 차단기를 열거나 기기에 사고를 내면, 어디까지 정전되고
 * 어디가 비상 전원으로 버티는지, 어느 보호기기가 동작하는지 계산한다. 순수 함수 + `?sim` 주소 상태 훅.
 *
 * 규칙 (영업 데모용 단순 모델 — 실제 보호협조·계통 해석이 아님)
 *  - 전력 경로 = 전력선(power) + 택1(alt). 신호선·보호/계측 분기(flow none)는 경로 아님. 방향은 엣지 flow(reverse·bi) 반영.
 *  - 주 전원 = 발전기(generator). 비상 전원 = 비상발전기(emergency-gen)·UPS(배터리) — 주 전원이 끊긴 하류만 맡는다.
 *  - 신재생 PCS 연계(ep-pcs-in → 380V 모선)는 계통 정전 시 단독운전 방지로 함께 멈춘다고 보고 공급원으로 치지 않는다.
 *  - 차단기·보호기기(개폐 switching · 보호 protection, 한류기·순간전압보상장치 제외)를 누르면 열림/닫힘.
 *  - 그 밖의 기기를 누르면 그 자리 사고 → 사고 지점에서 전원 쪽으로 올라가며 처음 만나는 차단·보호기기가 동작(트립).
 */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { EquipmentType } from '../schema';
import type { FlowDir } from './flow';

export type SimNodeState = 'normal' | 'backup' | 'dead' | 'open' | 'tripped' | 'fault';
/** idle = 대기 중인 비상 전원 쪽 선 (끊긴 건 아니지만 흐르지 않음) */
export type SimEdgeState = 'normal' | 'backup' | 'dead' | 'idle';

export interface SimEdge {
  id: string;
  from: string;
  to: string;
  kind: string;
}

export interface SimGraph {
  edges: readonly SimEdge[];
  dirs: ReadonlyMap<string, FlowDir>;
  /** 노드 id → 기기 (모선·끝점은 없음) */
  eqOf: (id: string) => EquipmentType | undefined;
}

export interface SimResult {
  nodes: Map<string, SimNodeState>;
  edges: Map<string, SimEdgeState>;
  /** 사고로 동작한 보호기기 (사고 지점 → 트립된 기기들) */
  tripped: string[];
  /** 평소 전기가 오는 노드 (비교 기준) */
  baseline: Set<string>;
  /** 평소엔 전기가 오다가 지금 끊긴 노드 (열림·사고·트립 제외) */
  dead: string[];
  /** 비상 전원(비상발전기·UPS)으로 버티는 노드 */
  backup: string[];
  /** 한쪽 전원이 끊겼지만 다른 쪽으로 전환해 공급 중인 절체 기기 (ALTS·ATS) */
  transferred: string[];
}

const MAIN_SOURCE = new Set(['generator']);
const STANDBY_SOURCE = new Set(['emergency-gen', 'ups']);
const NOT_BREAKER = new Set(['fcl', 'sag-protector']);
const TRANSFER = new Set(['alts', 'lv-ats']);
/** 공급원으로 치지 않는 연계 끝점 (신재생 PCS → 380V 모선) */
const ISLAND_LINK = 'ep-pcs-in';

/** 누르면 열고 닫는 기기인지 (차단·개폐·보호) */
export function isBreaker(eq: EquipmentType | undefined): boolean {
  return !!eq && (eq.category === 'switching' || eq.category === 'protection') && !NOT_BREAKER.has(eq.id);
}

interface Arc {
  edge: SimEdge;
  next: string;
}

function arcs(g: SimGraph) {
  const out = new Map<string, Arc[]>();
  const inn = new Map<string, Arc[]>();
  const push = (m: Map<string, Arc[]>, k: string, a: Arc) => {
    const l = m.get(k);
    if (l) l.push(a);
    else m.set(k, [a]);
  };
  for (const e of g.edges) {
    if (e.kind === 'signal') continue;
    const dir = g.dirs.get(e.id) ?? 'forward';
    if (dir === 'none') continue;
    if (e.from === ISLAND_LINK) continue;
    const [s, t] = dir === 'reverse' ? [e.to, e.from] : [e.from, e.to];
    push(out, s, { edge: e, next: t });
    push(inn, t, { edge: e, next: s });
    if (dir === 'bi') {
      push(out, t, { edge: e, next: s });
      push(inn, s, { edge: e, next: t });
    }
  }
  return { out, inn };
}

/** 전원에서 전기가 닿는 노드 — blocked 노드까지는 닿지만 그 너머로는 가지 않음 */
function reach(starts: Iterable<string>, out: Map<string, Arc[]>, blocked: ReadonlySet<string>): Set<string> {
  const seen = new Set<string>();
  const q: string[] = [];
  for (const s of starts) {
    if (blocked.has(s) || seen.has(s)) continue;
    seen.add(s);
    q.push(s);
  }
  while (q.length) {
    const n = q.shift()!;
    if (blocked.has(n)) continue;
    for (const a of out.get(n) ?? []) {
      if (seen.has(a.next)) continue;
      seen.add(a.next);
      if (!blocked.has(a.next)) q.push(a.next);
    }
  }
  return seen;
}

/** 사고 지점에서 전원 쪽으로 올라가며 처음 만나는 차단·보호기기 (경로마다) */
export function protectiveDevices(g: SimGraph, fault: string, alive?: ReadonlySet<string>): string[] {
  const { inn } = arcs(g);
  const found = new Set<string>();
  const seen = new Set<string>([fault]);
  const q = [fault];
  while (q.length) {
    const n = q.shift()!;
    for (const a of inn.get(n) ?? []) {
      const up = a.next;
      if (seen.has(up)) continue;
      seen.add(up);
      if (alive && !alive.has(up)) continue; // 이미 전기가 안 오는 쪽은 트립할 필요 없음
      if (isBreaker(g.eqOf(up))) found.add(up);
      else q.push(up);
    }
  }
  return [...found];
}

export function simulate(g: SimGraph, opened: ReadonlySet<string>, faults: ReadonlySet<string>): SimResult {
  const { out, inn } = arcs(g);
  const allNodes = new Set<string>();
  for (const e of g.edges) {
    allNodes.add(e.from);
    allNodes.add(e.to);
  }
  const standby = [...allNodes].filter((id) => STANDBY_SOURCE.has(g.eqOf(id)?.id ?? ''));
  let main = [...allNodes].filter((id) => MAIN_SOURCE.has(g.eqOf(id)?.id ?? ''));
  // 발전기가 없는 계통(예: 데이터센터 수전)은 전력 경로의 맨 위(들어오는 선이 없는 노드)를 주 전원으로
  if (!main.length) main = [...allNodes].filter((id) => out.has(id) && !inn.has(id) && !standby.includes(id) && id !== ISLAND_LINK);
  const baseline = reach(main, out, new Set());
  for (const id of standby) baseline.add(id); // 비상 전원 자신은 늘 '살아 있음'

  // 사고 → 보호기기 트립 (평소 전기가 오는 쪽에서)
  const tripped = new Set<string>();
  for (const f of faults) for (const t of protectiveDevices(g, f, baseline)) if (!opened.has(t) && !faults.has(t)) tripped.add(t);
  const blocked = new Set<string>([...opened, ...faults, ...tripped]);
  const mainAlive = reach(main, out, blocked);
  const allAlive = reach([...main, ...standby], out, blocked);

  const nodes = new Map<string, SimNodeState>();
  for (const id of allNodes) {
    if (faults.has(id)) nodes.set(id, 'fault');
    else if (tripped.has(id)) nodes.set(id, 'tripped');
    else if (opened.has(id)) nodes.set(id, 'open');
    else if (mainAlive.has(id)) nodes.set(id, 'normal');
    else if (allAlive.has(id)) nodes.set(id, 'backup');
    else if (baseline.has(id)) nodes.set(id, 'dead');
  }
  // 대기 중인 비상 전원(하류가 주 전원으로 살아 있음)은 '평소'로 — 실제로 공급할 때만 '비상 공급'
  for (const id of standby) {
    if (nodes.get(id) !== 'backup') continue;
    const feeding = (out.get(id) ?? []).some((a) => !mainAlive.has(a.next) && allAlive.has(a.next));
    if (!feeding) nodes.set(id, 'normal');
  }
  const edges = new Map<string, SimEdgeState>();
  for (const e of g.edges) {
    if (e.kind === 'signal') continue;
    const dir = g.dirs.get(e.id) ?? 'forward';
    if (dir === 'none') continue;
    const [src, dst] = dir === 'reverse' ? [e.to, e.from] : [e.from, e.to];
    if (blocked.has(src)) edges.set(e.id, 'dead');
    else if (mainAlive.has(src)) edges.set(e.id, 'normal');
    else if (allAlive.has(src)) edges.set(e.id, nodes.get(dst) === 'backup' ? 'backup' : 'idle');
    else edges.set(e.id, 'dead');
  }
  const transferred = [...allNodes].filter((id) => {
    if (!TRANSFER.has(g.eqOf(id)?.id ?? '') || blocked.has(id) || !allAlive.has(id)) return false;
    // 들어오는 쪽 중 하나라도 평소엔 살아 있었는데 지금 끊김
    return (inn.get(id) ?? []).some((a) => (baseline.has(a.next) && !allAlive.has(a.next)) || blocked.has(a.next));
  });
  return {
    nodes,
    edges,
    tripped: [...tripped],
    baseline,
    dead: [...allNodes].filter((id) => nodes.get(id) === 'dead'),
    backup: [...allNodes].filter((id) => nodes.get(id) === 'backup'),
    transferred,
  };
}

// ── 주소 상태: ?sim=1&open=a,b&fault=c ──
const list = (v: string | null) => new Set((v ?? '').split(',').filter(Boolean));

export function useSimState(): { on: boolean; opened: Set<string>; faults: Set<string> } {
  const [params] = useSearchParams();
  return { on: params.get('sim') === '1', opened: list(params.get('open')), faults: list(params.get('fault')) };
}

export function useSimActions() {
  const [, setParams] = useSearchParams();
  const write = useCallback(
    (fn: (p: URLSearchParams) => void) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          fn(next);
          for (const k of ['open', 'fault']) if (!next.get(k)) next.delete(k);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  const toggleIn = (p: URLSearchParams, key: string, id: string) => {
    const s = list(p.get(key));
    if (s.has(id)) s.delete(id);
    else s.add(id);
    p.set(key, [...s].join(','));
  };
  return {
    start: useCallback(() => write((p) => (p.set('sim', '1'), p.delete('node'))), [write]),
    stop: useCallback(() => write((p) => (p.delete('sim'), p.delete('open'), p.delete('fault'))), [write]),
    reset: useCallback(() => write((p) => (p.delete('open'), p.delete('fault'))), [write]),
    toggleOpen: useCallback((id: string) => write((p) => toggleIn(p, 'open', id)), [write]),
    toggleFault: useCallback((id: string) => write((p) => toggleIn(p, 'fault', id)), [write]),
  };
}
