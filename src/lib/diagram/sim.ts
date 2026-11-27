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
 *
 * 2차 (2026-11-27, 페르소나 10명 토론)
 *  - 사고 종류: 단락(기본)·지락·과부하 — 종류마다 동작하는 기기가 다름 (지락 = 누전·지락 보호가 있는 기기, 과부하 = 열동·과전류 기기)
 *  - 1차 차단 실패(후비 보호): 1차 보호기기가 동작하지 않으면 그 위의 차단기가 시간차를 두고 동작 → 정전 범위가 넓어짐
 *  - 마이크로그리드: 태양광·ESS 가 PCS 를 통해 380V 모선을 자립 운전으로 공급 (단독운전 방지 해제)
 *  - 동작 순서(타임라인): 대표 동작 시간으로 사고 → 트립 → 무순단(UPS)·절체(ALTS)·발전기 기동(ATS) 순서
 *  - 정전 퍼짐: 막힌 지점에서 몇 단계 아래인지(step) — 화면이 사고 지점부터 차례로 꺼지는 연출에 씀
 */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { EquipmentType } from '../schema';
import type { FlowDir } from './flow';

export type SimNodeState = 'normal' | 'backup' | 'dead' | 'open' | 'tripped' | 'fault' | 'failed' | 'unused';
/** 사고 종류 */
export type FaultType = 'short' | 'ground' | 'overload';
export const FAULT_TYPE_LABEL: Record<FaultType, string> = { short: '단락', ground: '지락(누전)', overload: '과부하' };

export interface SimOptions {
  faultType?: FaultType;
  /** 1차 보호기기 차단 실패 → 후비 보호 */
  failPrimary?: boolean;
  /** 마이크로그리드 자립 운전 (태양광·ESS → 380V 모선) */
  microgrid?: boolean;
  /** 택1 구성에서 고른 기기 id (묶음마다 하나, 없으면 그 묶음의 첫 번째). 'all' = 택1 무시하고 모두 연결 */
  alt?: readonly string[] | 'all';
}

/** 택1 묶음 — 같은 이름(label)의 택1(alt) 선들. 묶음마다 바뀌는 쪽 끝 기기가 선택지 */
export interface AltGroup {
  label: string;
  options: { node: string; edgeIds: string[] }[];
}

/** 계통도의 택1 묶음 (데이터 순서 유지) */
export function altGroups(g: Pick<SimGraph, 'edges'>): AltGroup[] {
  const byLabel = new Map<string, SimEdge[]>();
  for (const e of g.edges) if (e.kind === 'alt') byLabel.set(e.label ?? e.id, [...(byLabel.get(e.label ?? e.id) ?? []), e]);
  const groups: AltGroup[] = [];
  for (const [label, es] of byLabel) {
    if (es.length < 2) continue;
    // 모든 선이 같이 쓰는 끝은 공통, 나머지 끝이 선택지
    const common = [es[0].from, es[0].to].find((n) => es.every((e) => e.from === n || e.to === n));
    const options = new Map<string, string[]>();
    for (const e of es) {
      const node = e.from === common ? e.to : e.from;
      options.set(node, [...(options.get(node) ?? []), e.id]);
    }
    groups.push({ label, options: [...options].map(([node, edgeIds]) => ({ node, edgeIds })) });
  }
  return groups;
}

/** 고른 구성에서 쓰지 않는(설치하지 않은) 택1 기기 */
export function unusedAltNodes(groups: readonly AltGroup[], alt: SimOptions['alt']): Set<string> {
  const out = new Set<string>();
  if (alt === 'all') return out;
  for (const gr of groups) {
    const chosen = gr.options.find((o) => alt?.includes(o.node))?.node ?? gr.options[0].node;
    for (const o of gr.options) if (o.node !== chosen) out.add(o.node);
  }
  return out;
}

/** 타임라인 한 줄 */
export interface SimStep {
  /** 사고 발생 기준 시각(초, 대표값) */
  t: number;
  kind: 'fault' | 'trip' | 'failed' | 'backup-trip' | 'ups' | 'transfer' | 'genstart' | 'microgrid' | 'open';
  ids: string[];
  text: string;
}
/** idle = 대기 중인 비상 전원 쪽 선 (끊긴 건 아니지만 흐르지 않음) */
export type SimEdgeState = 'normal' | 'backup' | 'dead' | 'idle';

export interface SimEdge {
  id: string;
  from: string;
  to: string;
  kind: string;
  label?: string;
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
  /** 1차 차단 실패한 기기 (후비 보호 모드) */
  failed: string[];
  /** 막힌 지점(열림·사고·트립)에서 몇 단계 아래인지 — 정전·비상 노드만 */
  step: Map<string, number>;
  /** 동작 순서 (대표 동작 시간) */
  timeline: SimStep[];
  /** 평소 주 전원에서 몇 단계 아래인지 (복구 순서: 전원 쪽부터 재투입) */
  depth: Map<string, number>;
  /** 중요 부하 — 비상 전원(비상발전기·UPS) 계통에 물린 부하 (평소 구성 기준) */
  important: string[];
  /** 복구 순서 (사고 제거 후) */
  restore: string[];
}

const MAIN_SOURCE = new Set(['generator']);
const STANDBY_SOURCE = new Set(['emergency-gen', 'ups']);
const NOT_BREAKER = new Set(['fcl', 'sag-protector']);
const TRANSFER = new Set(['alts', 'lv-ats']);
/** 공급원으로 치지 않는 연계 끝점 (신재생 PCS → 380V 모선) */
const ISLAND_LINK = 'ep-pcs-in';
const PCS_OUT = 'ep-pcs-out';
/** 마이크로그리드 때 비상 전원이 되는 신재생·저장 */
const MICROGRID_SOURCE = new Set(['pv', 'ess']);
/** 사고 종류별로 '동작하지 않는' 기기 — 그 기기는 건너뛰고 더 위의 보호기기가 맡는다 */
const NOT_FOR: Record<FaultType, Set<string>> = {
  short: new Set(),
  // 지락: 누전·지락 보호가 없는 배선용·전동기용·개폐기·퓨즈는 동작하지 않음 (VCB·ACB 는 OCGR·지락 계전으로 동작한다고 봄)
  ground: new Set(['mccb', 'branch-mccb', 'mms', 'ms', 'pf', 'lbs', 'auto-switch', 'alts', 'lv-ats', 'dc-devices']),
  // 과부하: 퓨즈·개폐기·GIS 는 과부하로 끊지 않음 (열동·과전류 보호 기기만)
  // (ELCB 는 과전류 겸용이 일반적이라 과부하에도 동작 — 2026-11-27 전수 검증에서 수정)
  overload: new Set(['pf', 'lbs', 'auto-switch', 'alts', 'lv-ats', 'ehv-gis', 'gis-154', 'recloser']),
};
/** 대표 동작 시간(초) — 기기 종류별 차단 시간 */
function tripTime(eqId: string | undefined, ftype: FaultType): number {
  if (ftype === 'overload') return eqId === 'ms' || eqId === 'mms' ? 8 : 20;
  if (eqId === 'pf') return 0.005;
  if (['mcb-rcbo', 'elcb', 'mccb', 'branch-mccb', 'mms', 'ms'].includes(eqId ?? '')) return 0.02;
  if (eqId === 'acb') return 0.05;
  return 0.08; // VCB·GIS·리클로저 (계전기 + 차단기 3~5 사이클)
}

/** 전자식 보호(과전류·단락·지락)로 스스로 출력을 끊는 제어기기 — 인버터·소프트스타터 (2026-11-27 전수 검증: 전동기 사고에 380V 전체가 끊기던 문제) */
const SELF_PROTECTED = new Set(['lv-drive', 'mv-drive', 'soft-starter']);

/** 누르면 열고 닫는 기기인지 (차단·개폐·보호, 자체 보호가 있는 인버터·소프트스타터 포함) */
export function isBreaker(eq: EquipmentType | undefined): boolean {
  return !!eq && (((eq.category === 'switching' || eq.category === 'protection') && !NOT_BREAKER.has(eq.id)) || SELF_PROTECTED.has(eq.id));
}

interface Arc {
  edge: SimEdge;
  next: string;
}

function arcs(g: SimGraph, microgrid = false) {
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
    if (e.from === ISLAND_LINK && !microgrid) continue;
    const [s, t] = dir === 'reverse' ? [e.to, e.from] : [e.from, e.to];
    push(out, s, { edge: e, next: t });
    push(inn, t, { edge: e, next: s });
    if (dir === 'bi') {
      push(out, t, { edge: e, next: s });
      push(inn, s, { edge: e, next: t });
    }
  }
  // 마이크로그리드: PCS 출력 끝점과 380V 모선 연계 끝점을 가상으로 잇는다
  if (microgrid) {
    const v: SimEdge = { id: '~pcs-link', from: PCS_OUT, to: ISLAND_LINK, kind: 'power' };
    push(out, PCS_OUT, { edge: v, next: ISLAND_LINK });
    push(inn, ISLAND_LINK, { edge: v, next: PCS_OUT });
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
export function protectiveDevices(g: SimGraph, fault: string, alive?: ReadonlySet<string>, ftype: FaultType = 'short', microgrid = false): string[] {
  const { inn } = arcs(g, microgrid);
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
      const eq = g.eqOf(up);
      if (isBreaker(eq) && !NOT_FOR[ftype].has(eq!.id)) found.add(up);
      else q.push(up);
    }
  }
  return [...found];
}

export function simulate(g0: SimGraph, opened: ReadonlySet<string>, faults: ReadonlySet<string>, opts: SimOptions = {}): SimResult {
  // 택1: 고르지 않은 기기는 설치하지 않은 것으로 보고 그 기기에 붙은 선을 모두 뺀다
  const unused = unusedAltNodes(altGroups(g0), opts.alt);
  const g: SimGraph = unused.size ? { ...g0, edges: g0.edges.filter((e) => !unused.has(e.from) && !unused.has(e.to)) } : g0;
  const ftype = opts.faultType ?? 'short';
  const microgrid = !!opts.microgrid;
  const { out, inn } = arcs(g, microgrid);
  const allNodes = new Set<string>();
  for (const e of g.edges) {
    allNodes.add(e.from);
    allNodes.add(e.to);
  }
  const isStandby = (id: string) => STANDBY_SOURCE.has(g.eqOf(id)?.id ?? '') || (microgrid && MICROGRID_SOURCE.has(g.eqOf(id)?.id ?? ''));
  const standby = [...allNodes].filter(isStandby);
  let main = [...allNodes].filter((id) => MAIN_SOURCE.has(g.eqOf(id)?.id ?? ''));
  // 발전기가 없는 계통(예: 데이터센터 수전)은 전력 경로의 맨 위(들어오는 선이 없는 노드)를 주 전원으로
  if (!main.length) main = [...allNodes].filter((id) => out.has(id) && !inn.has(id) && !standby.includes(id) && id !== ISLAND_LINK);
  const baseline = reach(main, out, new Set());
  const baselineMain = new Set(baseline);
  for (const id of standby) baseline.add(id); // 비상 전원 자신은 늘 '살아 있음'
  // 신재생 쪽(태양광·ESS → PCS)은 평소에도 스스로 살아 있음 — 비교 기준에 넣어 '정전'으로 세지 않음
  for (const id of reach([...allNodes].filter((x) => MICROGRID_SOURCE.has(g.eqOf(x)?.id ?? '')), arcs(g, false).out, new Set())) baseline.add(id);

  // 사고 → 보호기기 트립 (평소 전기가 오는 쪽에서). 차단 실패면 1차는 '실패', 그 위 차단기가 후비 보호로 동작
  const primary = new Set<string>();
  for (const f of faults) for (const t of protectiveDevices(g, f, baseline, ftype, microgrid)) if (!opened.has(t) && !faults.has(t)) primary.add(t);
  const failed = new Set<string>();
  const backupTrip = new Set<string>();
  if (opts.failPrimary) {
    for (const p of primary) {
      failed.add(p);
      for (const t of protectiveDevices(g, p, baseline, ftype, microgrid)) if (!opened.has(t) && !faults.has(t)) backupTrip.add(t);
    }
  }
  const tripped = opts.failPrimary ? backupTrip : primary;
  // 차단 실패한 기기는 열리지 않음 → 사고가 그대로 이어진 것으로 보고 그 기기도 막힘(전기 못 넘김)
  const blocked = new Set<string>([...opened, ...faults, ...tripped, ...failed]);
  const mainAlive = reach(main, out, blocked);
  // 신재생(태양광·ESS)은 스스로 살아 있음 — 마이크로그리드가 아니면 380V 모선과 이어지지 않으므로 부하에는 영향 없음
  const renew = [...allNodes].filter((x) => MICROGRID_SOURCE.has(g.eqOf(x)?.id ?? ''));
  const allAlive = reach([...main, ...standby, ...renew], out, blocked);

  const nodes = new Map<string, SimNodeState>();
  for (const id of allNodes) {
    if (faults.has(id)) nodes.set(id, 'fault');
    else if (failed.has(id)) nodes.set(id, 'failed');
    else if (tripped.has(id)) nodes.set(id, 'tripped');
    else if (opened.has(id)) nodes.set(id, 'open');
    else if (mainAlive.has(id)) nodes.set(id, 'normal');
    else if (allAlive.has(id)) nodes.set(id, 'backup');
    else if (baseline.has(id)) nodes.set(id, 'dead');
  }
  // 대기 중인 비상 전원(하류가 주 전원으로 살아 있음)은 '평소'로 — 실제로 공급할 때만 '비상 공급'
  for (const id of allNodes) {
    if (nodes.get(id) !== 'backup') continue;
    if (mainAlive.has(id)) continue;
    // 비상 전원 자신, 또는 신재생 쪽(태양광→PCS) 노드 중 하류에 비상 공급을 받는 곳이 없으면 '평소'
    const feeding = [...reach([id], out, blocked)].some((x) => x !== id && !mainAlive.has(x) && allAlive.has(x) && !isStandby(x) && !reachesFromRenewOnly(x));
    if (!feeding && (isStandby(id) || reachesFromRenewOnly(id))) nodes.set(id, 'normal');
  }
  function reachesFromRenewOnly(x: string) {
    // 태양광·ESS → DC → PCS → PCS 출력 끝점까지 (신재생 자체 구간)
    const eqId = g.eqOf(x)?.id ?? '';
    return MICROGRID_SOURCE.has(eqId) || eqId === 'dc-devices' || eqId === 'pcs' || x === PCS_OUT;
  }
  const edges = new Map<string, SimEdgeState>();
  for (const e of g.edges) {
    if (e.kind === 'signal') continue;
    const dir = g.dirs.get(e.id) ?? 'forward';
    if (dir === 'none') continue;
    const [src, dst] = dir === 'reverse' ? [e.to, e.from] : [e.from, e.to];
    if (blocked.has(src)) edges.set(e.id, 'dead');
    else if (mainAlive.has(src)) edges.set(e.id, 'normal');
    else if (allAlive.has(src)) edges.set(e.id, nodes.get(dst) === 'backup' || nodes.get(dst) === 'normal' ? (nodes.get(dst) === 'backup' ? 'backup' : 'idle') : 'idle');
    else edges.set(e.id, 'dead');
  }
  const transferred = [...allNodes].filter((id) => {
    if (!TRANSFER.has(g.eqOf(id)?.id ?? '') || blocked.has(id) || !allAlive.has(id)) return false;
    // 평소 주 전원으로 받던 입력을 잃었고(끊김·막힘), 다른 입력으로 지금 살아 있을 때만 '절체'
    // (비상발전기 자체 고장처럼 대기 입력만 잃은 경우는 절체가 아님 — 2026-11-27 전수 검증)
    const ins = inn.get(id) ?? [];
    const lostMain = ins.some((a) => baselineMain.has(a.next) && (!allAlive.has(a.next) || blocked.has(a.next)));
    const stillFed = ins.some((a) => allAlive.has(a.next) && !blocked.has(a.next));
    return lostMain && stillFed;
  });

  // 정전 퍼짐 단계: 막힌 지점에서 out 방향으로 몇 단계
  const step = new Map<string, number>();
  const q: { id: string; d: number }[] = [...blocked].map((id) => ({ id, d: 0 }));
  const seen = new Set<string>(blocked);
  while (q.length) {
    const { id, d } = q.shift()!;
    for (const a of out.get(id) ?? []) {
      if (seen.has(a.next)) continue;
      seen.add(a.next);
      const st = nodes.get(a.next);
      if (st === 'dead' || st === 'backup') step.set(a.next, d + 1);
      q.push({ id: a.next, d: d + 1 });
    }
  }

  for (const id of unused) nodes.set(id, 'unused');
  const dead = [...allNodes].filter((id) => nodes.get(id) === 'dead');
  const backup = [...allNodes].filter((id) => nodes.get(id) === 'backup');
  const timeline = buildTimeline({ g, faults, opened, primary, failed, backupTrip, opts, ftype, backup, transferred, nodes });
  // 평소 깊이 (주 전원에서 몇 단계)
  const depth = new Map<string, number>();
  {
    const dq = main.map((id) => ({ id, d: 0 }));
    for (const x of dq) depth.set(x.id, 0);
    while (dq.length) {
      const { id, d } = dq.shift()!;
      for (const a of out.get(id) ?? []) if (!depth.has(a.next)) (depth.set(a.next, d + 1), dq.push({ id: a.next, d: d + 1 }));
    }
  }
  // 중요 부하: 비상발전기·UPS 가 물린 하류 (평소 구성, 비상 전원 자신 제외)
  const important = [...reach(standby.filter((id) => !MICROGRID_SOURCE.has(g.eqOf(id)?.id ?? '')), out, new Set())].filter((id) => !isStandby(id) && !TRANSFER.has(g.eqOf(id)?.id ?? ''));
  const name = (id: string) => g.eqOf(id)?.abbr ?? g.eqOf(id)?.name ?? id;
  const restore: string[] = [];
  if (faults.size) restore.push(`사고 기기 분리·점검·보수: ${[...faults].map(name).join(', ')}`);
  const reclose = [...tripped, ...failed].sort((a, b) => (depth.get(a) ?? 99) - (depth.get(b) ?? 99));
  if (reclose.length) restore.push(`차단기 재투입 — 전원 쪽부터: ${reclose.map(name).join(' → ')}`);
  if (opened.size) restore.push(`수동 개방한 차단기 재투입: ${[...opened].map(name).join(', ')}`);
  if (transferred.some((id) => g.eqOf(id)?.id === 'lv-ats')) restore.push('상용 전원 복귀 확인 → ATS 상용 쪽으로 재절체 → 비상발전기 냉각 운전 후 정지');
  if (transferred.some((id) => g.eqOf(id)?.id === 'alts')) restore.push('ALTS 원래 회선으로 복귀 (자동 복귀 설정 시 자동)');
  if (backup.some((id) => g.eqOf(id)?.id === 'ups')) restore.push('UPS 상용 전원 복귀 · 배터리 재충전 확인');
  if (opts.microgrid && backup.some((id) => ['pcs', 'ess'].includes(g.eqOf(id)?.id ?? ''))) restore.push('계통 복귀 시 PCS 동기 투입 → 자립 운전 종료');
  return { nodes, edges, tripped: [...tripped], baseline, dead, backup, transferred, failed: [...failed], step, timeline, depth, important, restore };
}

/** 동작 순서 — 대표 동작 시간(제조사·설정마다 다름, 참고용) */
function buildTimeline(x: {
  g: SimGraph;
  faults: ReadonlySet<string>;
  opened: ReadonlySet<string>;
  primary: Set<string>;
  failed: Set<string>;
  backupTrip: Set<string>;
  opts: SimOptions;
  ftype: FaultType;
  backup: string[];
  transferred: string[];
  nodes: Map<string, SimNodeState>;
}): SimStep[] {
  const { g, ftype } = x;
  const steps: SimStep[] = [];
  const eqId = (id: string) => g.eqOf(id)?.id;
  if (x.faults.size) steps.push({ t: 0, kind: 'fault', ids: [...x.faults], text: `${FAULT_TYPE_LABEL[ftype]} 사고 발생` });
  if (x.opened.size) steps.push({ t: 0, kind: 'open', ids: [...x.opened], text: '차단기 수동 개방' });
  if (x.opts.failPrimary) {
    if (x.failed.size) steps.push({ t: Math.max(...[...x.failed].map((id) => tripTime(eqId(id), ftype))), kind: 'failed', ids: [...x.failed], text: '1차 보호기기 차단 실패' });
    if (x.backupTrip.size) {
      // 후비 보호: 시간차 협조 — 1차보다 0.2~0.3초 늦게 (과부하는 더 늦게)
      const t = Math.max(...[...x.backupTrip].map((id) => tripTime(eqId(id), ftype))) + (ftype === 'overload' ? 10 : 0.3);
      steps.push({ t, kind: 'backup-trip', ids: [...x.backupTrip], text: '후비 보호 동작 (상위 차단기 시간차 차단)' });
    }
  } else {
    // 같은 시간대끼리 묶음
    const byT = new Map<number, string[]>();
    for (const id of x.primary) {
      const t = tripTime(eqId(id), ftype);
      byT.set(t, [...(byT.get(t) ?? []), id]);
    }
    for (const [t, ids] of byT) steps.push({ t, kind: 'trip', ids, text: '보호기기 차단(트립)' });
  }
  // 사고는 났는데 동작한 보호기기가 없음 (발전기·승압변압기처럼 상위에 차단기를 그리지 않은 곳)
  if (x.faults.size && !x.primary.size) steps.push({ t: 0.1, kind: 'trip', ids: [...x.faults], text: '상위 보호기기가 계통도에 없음 — 그 자리에서 전원 정지로 처리' });
  const base = steps.length ? Math.max(...steps.map((s) => s.t)) : 0;
  const ups = x.backup.filter((id) => eqId(id) === 'ups');
  if (ups.length) steps.push({ t: base, kind: 'ups', ids: ups, text: 'UPS 무순단 배터리 공급 (끊김 없음)' });
  const alts = x.transferred.filter((id) => eqId(id) === 'alts');
  if (alts.length) steps.push({ t: base + 0.5, kind: 'transfer', ids: alts, text: 'ALTS 다른 회선으로 자동 절체' });
  const ats = x.transferred.filter((id) => eqId(id) === 'lv-ats');
  const egens = x.backup.filter((id) => eqId(id) === 'emergency-gen');
  if (ats.length || egens.length) steps.push({ t: base + 10, kind: 'genstart', ids: [...egens, ...ats], text: '비상발전기 기동 → ATS 절체, 비상 부하 재공급 (약 10초 정전)' });
  const mg = x.backup.filter((id) => ['pcs', 'ess', 'pv'].includes(eqId(id) ?? ''));
  if (x.opts.microgrid && mg.length) steps.push({ t: base + 0.2, kind: 'microgrid', ids: mg, text: 'ESS·태양광 자립 운전으로 380V 모선 공급' });
  return steps.sort((a, b) => a.t - b.t);
}

// ── 주소 상태: ?sim=1&open=a,b&fault=c ──
const list = (v: string | null) => new Set((v ?? '').split(',').filter(Boolean));

export interface SimUrlState {
  on: boolean;
  opened: Set<string>;
  faults: Set<string>;
  opts: SimOptions;
}

export function useSimState(): SimUrlState {
  const [params] = useSearchParams();
  const ft = params.get('ftype');
  return {
    on: params.get('sim') === '1',
    opened: list(params.get('open')),
    faults: list(params.get('fault')),
    opts: { faultType: ft === 'ground' || ft === 'overload' ? ft : 'short', failPrimary: params.get('fail') === '1', microgrid: params.get('mg') === '1', alt: [...list(params.get('alt'))] },
  };
}

/** 한 번에 여는 시나리오 (영업 데모) */
export interface SimScenario {
  id: string;
  label: string;
  desc: string;
  open?: string[];
  fault?: string[];
  ftype?: FaultType;
  fail?: boolean;
  mg?: boolean;
  alt?: string[];
}
export const SIM_SCENARIOS: SimScenario[] = [
  { id: 'grid-loss', label: '수전 정전', desc: '배전선로 사고로 수전이 끊김 — 비상발전기·UPS 가 무엇을 지키는지', fault: ['n-dline'] },
  { id: 'tr-fault', label: '변압기 고장', desc: '몰드변압기 단락 — 상위 VCB 가 끊고 다른 변압기는?', fault: ['n-cast-tr'] },
  { id: 'leak', label: '분기 누전', desc: '조명 회로 지락 — 누전차단기만 끊겨 나머지는 그대로', fault: ['n-light'], ftype: 'ground' },
  { id: 'fail', label: '차단 실패(후비 보호)', desc: '분기 사고에서 MCCB 가 안 끊기면 ACB 가 대신 — 정전 범위 비교', fault: ['n-panel'], fail: true },
  { id: 'alts', label: '2회선 수전(ALTS)', desc: '2회선 ALTS 로 수전 — 리클로저 쪽 회선이 끊겨도 다른 회선으로 자동 절체', open: ['n-recloser'], alt: ['n-alts'] },
  { id: 'microgrid', label: '마이크로그리드', desc: '수전 차단 시 ESS·태양광이 380V 모선을 자립 운전으로 공급', open: ['n-vcb'], mg: true },
];

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
    stop: useCallback(() => write((p) => { for (const k of ['sim', 'open', 'fault', 'fail', 'mg', 'ftype', 'alt']) p.delete(k); }), [write]),
    reset: useCallback(() => write((p) => { for (const k of ['open', 'fault', 'fail', 'mg', 'ftype', 'alt']) p.delete(k); }), [write]),
    setOption: useCallback((key: 'ftype' | 'fail' | 'mg', value: string | null) => write((p) => (value ? p.set(key, value) : p.delete(key))), [write]),
    /** 택1 묶음에서 기기 고르기 — 같은 묶음의 다른 선택은 지움 */
    chooseAlt: useCallback(
      (group: AltGroup, node: string) =>
        write((p) => {
          const s = list(p.get('alt'));
          for (const o of group.options) s.delete(o.node);
          if (node !== group.options[0].node) s.add(node);
          if (s.size) p.set('alt', [...s].join(','));
          else p.delete('alt');
        }),
      [write],
    ),
    scenario: useCallback(
      (sc: SimScenario) =>
        write((p) => {
          for (const k of ['open', 'fault', 'fail', 'mg', 'ftype', 'alt']) p.delete(k);
          if (sc.alt) p.set('alt', sc.alt.join(','));
          if (sc.open) p.set('open', sc.open.join(','));
          if (sc.fault) p.set('fault', sc.fault.join(','));
          if (sc.ftype && sc.ftype !== 'short') p.set('ftype', sc.ftype);
          if (sc.fail) p.set('fail', '1');
          if (sc.mg) p.set('mg', '1');
        }),
      [write],
    ),
    toggleOpen: useCallback((id: string) => write((p) => toggleIn(p, 'open', id)), [write]),
    toggleFault: useCallback((id: string) => write((p) => toggleIn(p, 'fault', id)), [write]),
  };
}
