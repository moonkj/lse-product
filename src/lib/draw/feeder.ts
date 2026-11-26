/**
 * 피더(반 → 아래 반·부하로 가는 선) — 보내는 회로 정하기, 간선 전압강하, 피더 일괄 제안.
 *  · 선에 '보내는 회로'를 직접 고르면 그 회로, 안 고르면 자동 추정: 저압 보내는 반의 보호 차단기(MCCB·ELCB·MCB·MMS·ACB) 중
 *    아래쪽이 필요로 하는 전류(아래 반 주차단기 정격, 부하 기기면 부하 전류) 이상인 가장 작은 회로 (수량만큼만, 삼상 아래쪽엔 3·4P만)
 *    같은 정격이면 부하를 적지 않은 회로 → 부하가 아래쪽과 가까운 회로 순 (현장 부하 회로를 피더로 잘못 잡지 않게)
 *  · 반 → 모선 선은 모선 연결(부스바)로 보고 피더로 치지 않는다 — 모선에서 나가는 선이 피더
 *  · 간선 전압강하: 아래쪽이 380V면 삼상(30.8·L·I/1000A, 380V 기준), 220V면 단상(35.6, 220V 기준), I = 아래쪽 합산 부하 전류
 */
import { feederSource, isTransformer, panelTypeById, voltageOf, type DEdge, type DNode, type Diagram, type PanelItem } from './model';
import { PF, downstreamKW, isThreePhase } from './load';
import { recommendCable } from './cable';
import { stdAtLeast } from './ratings';

/** 피더로 쓸 수 있는 저압 보호 차단기 */
export const FEEDER_EQ = new Set(['mccb', 'branch-mccb', 'elcb', 'mcb-rcbo', 'mms', 'acb']);

export interface FeederInfo {
  item: PanelItem;
  auto: boolean;
}

const cache = new WeakMap<Diagram, Map<string, FeederInfo>>();
const explicitCache = new WeakMap<Diagram, Map<string, FeederInfo>>();

/** 아래쪽 끝이 단상 220V 인지 */
function singlePhaseAt(n: DNode | undefined): boolean {
  return n?.v === '0.22';
}

/** 아래쪽 합산 부하 전류 (A) — 220V 쪽은 단상 */
export function downstreamAmps(d: Diagram, nodeId: string): number {
  const kw = downstreamKW(d, nodeId);
  if (!kw) return 0;
  const n = d.nodes.find((x) => x.id === nodeId);
  return singlePhaseAt(n) ? (kw * 1000) / (220 * PF) : (kw * 1000) / (Math.sqrt(3) * 380 * PF);
}

/** 아래쪽이 필요로 하는 전류 (A) */
function neededAmps(d: Diagram, e: DEdge): number {
  const b = d.nodes.find((n) => n.id === e.to);
  if (!b) return 0;
  if (b.kind === 'panel') {
    const pt = panelTypeById(b.eq);
    const main = b.items?.find((i) => pt?.main.includes(i.eq));
    if (main?.amps) return main.amps;
  }
  return downstreamAmps(d, b.id);
}

/** 이 순간 자동 추정 중인지 (부하 합산 메모를 쓰지 않게) */
let building = false;
export const isBuildingFeeders = () => building;

/** 선마다 보내는 회로 (직접 고른 것 + 자동 추정) */
export function feederMap(d: Diagram): Map<string, FeederInfo> {
  const hit = cache.get(d);
  if (hit) return hit;
  // 자동 추정 중 부하 합산이 다시 이 함수를 부르면 직접 고른 것만 (무한 반복 방지, 한 번 만들어 재사용)
  if (building) {
    const ex = explicitCache.get(d) ?? build(d, true);
    explicitCache.set(d, ex);
    return ex;
  }
  building = true;
  try {
    const out = build(d, false);
    cache.set(d, out);
    return out;
  } finally {
    building = false;
  }
}

function feederEdgesOf(d: Diagram): DEdge[] {
  return d.edges.filter((e) => {
    const to = d.nodes.find((n) => n.id === e.to);
    const src = to && to.kind !== 'bus' ? feederSource(d, e) : undefined;
    // 특고압반(수배전반)에서 나가는 선은 피더 추정 대상이 아님
    return !!src && (src.v === '0.38' || src.v === '0.22');
  });
}

function build(d: Diagram, explicitOnly: boolean): Map<string, FeederInfo> {
  const out = new Map<string, FeederInfo>();
  const used = new Map<string, number>();
  const feederEdges = feederEdgesOf(d);
  // 1) 직접 고른 것
  for (const e of feederEdges) {
    const src = feederSource(d, e)!;
    const it = e.feeder ? src.items?.find((i) => i.id === e.feeder) : undefined;
    if (it) {
      out.set(e.id, { item: it, auto: false });
      used.set(it.id, (used.get(it.id) ?? 0) + 1);
    }
  }
  if (explicitOnly) return out;
  // 2) 자동 추정 — 필요한 전류가 큰 선부터
  const rest = feederEdges
    .filter((e) => !out.has(e.id))
    .map((e) => ({ e, need: neededAmps(d, e), kw: downstreamKW(d, e.to) }))
    .filter((x) => x.need > 0)
    .sort((a, b) => b.need - a.need);
  for (const { e, need, kw } of rest) {
    const src = feederSource(d, e)!;
    const pt = panelTypeById(src.eq);
    const mainId = src.items?.find((i) => pt?.main.includes(i.eq))?.id;
    const three = !singlePhaseAt(d.nodes.find((n) => n.id === e.to));
    const cand = (src.items ?? [])
      .filter(
        (i) =>
          i.id !== mainId &&
          FEEDER_EQ.has(i.eq) &&
          i.amps &&
          i.amps >= need &&
          (!three || isThreePhase(i)) &&
          (used.get(i.id) ?? 0) < (i.qty ?? 1),
      )
      .sort(
        (a, b) =>
          a.amps! - b.amps! ||
          Number(!!a.loadKW) - Number(!!b.loadKW) ||
          Math.abs((a.loadKW ?? 0) - kw) - Math.abs((b.loadKW ?? 0) - kw),
      )[0];
    if (cand) {
      out.set(e.id, { item: cand, auto: true });
      used.set(cand.id, (used.get(cand.id) ?? 0) + 1);
    }
  }
  return out;
}

/** 반 안 품목이 피더로 쓰인 횟수 */
export function feederUses(d: Diagram, itemId: string): number {
  let n = 0;
  for (const f of feederMap(d).values()) if (f.item.id === itemId) n++;
  return n;
}

/** 간선(피더) 전압강하 (%) — 전선·길이가 있을 때. 아래쪽이 220V면 단상식 */
export function feederVoltageDrop(d: Diagram, e: DEdge, cable = e.cable): number | undefined {
  if (!cable || !e.lengthM) return undefined;
  const i = downstreamAmps(d, e.to);
  if (!i) return undefined;
  const single = singlePhaseAt(d.nodes.find((n) => n.id === e.to));
  return (((single ? 35.6 : 30.8) * e.lengthM * i) / (1000 * cable) / (single ? 220 : 380)) * 100;
}

/** 상자까지 위쪽 간선 전압강하 누적 (%) — 들어오는 선이 여럿이면 가장 나쁜 경로 */
const vdMemo = new WeakMap<Diagram, Map<string, number>>();
export function cumulativeFeederDrop(d: Diagram, nodeId: string, seen = new Set<string>(), depth = 0): number {
  if (depth > 12 || seen.has(nodeId)) return 0;
  // 맨 위 호출만 단선도별 메모 (같은 반을 회로마다 다시 계산하지 않게)
  if (depth === 0) {
    const memo = vdMemo.get(d) ?? vdMemo.set(d, new Map()).get(d)!;
    const hit = memo.get(nodeId);
    if (hit !== undefined) return hit;
    const v = cumulativeFeederDropRaw(d, nodeId, seen, depth);
    memo.set(nodeId, v);
    return v;
  }
  return cumulativeFeederDropRaw(d, nodeId, seen, depth);
}
function cumulativeFeederDropRaw(d: Diagram, nodeId: string, seen: Set<string>, depth: number): number {
  const next = new Set(seen).add(nodeId);
  let worst = 0;
  for (const e of d.edges.filter((x) => x.to === nodeId)) {
    const up = d.nodes.find((n) => n.id === e.from);
    if (!up) continue;
    const here = feederVoltageDrop(d, e) ?? 0;
    const above = up.kind === 'equipment' && isTransformer(up.eq) ? 0 : cumulativeFeederDrop(d, up.id, next, depth + 1);
    worst = Math.max(worst, here + above);
  }
  return worst;
}

/** 이 상자로 들어오는 선 중 간선 강하가 가장 큰 선 (고치기 대상) */
export function worstIncomingFeeder(d: Diagram, nodeId: string): DEdge | undefined {
  return d.edges
    .filter((e) => e.to === nodeId && e.cable && e.lengthM)
    .sort((a, b) => (feederVoltageDrop(d, b) ?? 0) - (feederVoltageDrop(d, a) ?? 0))[0];
}

/** 간선 강하가 target % 이하가 되는 가장 가는 전선 */
export function feederCableFor(d: Diagram, e: DEdge, target: number, minAmps = 0): number | undefined {
  const min = recommendCable(minAmps) ?? 0;
  return CABLES.find((mm2) => mm2 >= min && (feederVoltageDrop(d, e, mm2) ?? 0) <= target);
}
const CABLES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300];

/**
 * 피더 일괄 제안 — 아래 반 주차단기(또는 부하 전류) 기준으로
 * 보내는 회로 정격 = 1.6배 이상 표준값, 피더 전선 = 그 정격에 맞는 굵기(길이가 있으면 간선 강하 기준의 절반 이하가 되게)
 */
export interface FeederPlan {
  amps: number;
  cable?: number;
  /** 이미 있는 회로를 올려 쓰는지, 새 회로를 넣는지 */
  item?: PanelItem;
  src: DNode;
  /** 지금 보내는 회로가 이미 제안 정격 이상 */
  enough: boolean;
}
export function feederPlan(d: Diagram, e: DEdge, ratio = 1.6): FeederPlan | undefined {
  const src = feederSource(d, e);
  if (!src || !(src.v === '0.38' || src.v === '0.22')) return undefined;
  const need = neededAmps(d, e);
  if (!need) return undefined;
  const to = d.nodes.find((n) => n.id === e.to);
  const amps = stdAtLeast(to?.kind === 'panel' ? need * ratio : need * 1.25);
  const current = feederMap(d).get(e.id)?.item;
  const limit = (d.vdLimit ?? 5) / 2;
  const byAmps = recommendCable(amps);
  const cable = e.lengthM ? (feederCableFor(d, e, limit, amps) ?? byAmps) : byAmps;
  return { amps, cable, item: current, src, enough: !!current?.amps && current.amps >= amps && (!cable || (e.cable ?? 0) >= cable) };
}

/**
 * 이 선의 보내는 회로를 amps 로 맞추고 고정하는 고치기 묶음.
 *  · 기존 회로가 수량 2 이상이면 1개를 떼어 새 회로로 (같은 회로를 쓰는 다른 선은 그대로)
 *  · 기존 회로가 이미 amps 이상이면 정격은 그대로 두고 고정만
 *  · 새 회로: 아래쪽이 220V 면 2P, 800A 넘고 그 반에 ACB 를 넣을 수 있으면 ACB
 */
export function pinFeederFixes(
  d: Diagram,
  e: DEdge,
  src: DNode,
  item: PanelItem | undefined,
  amps: number,
  opts: { cable?: number; name?: string; variantOf?: (product: string | undefined, amps: number) => string | undefined } = {},
): DFixLike[] {
  const to = d.nodes.find((n) => n.id === e.to);
  const poles: 2 | 3 = singlePhaseAt(to) ? 2 : 3;
  const pt = panelTypeById(src.eq);
  const cablePatch = opts.cable ? { cable: opts.cable } : {};
  if (!item) {
    const eq = amps > 800 && pt?.accepts.includes('acb') ? 'acb' : 'mccb';
    return [{ type: 'addFeeder', node: src.id, edge: e.id, eq, amps, poles, cable: opts.cable, name: opts.name }];
  }
  if ((item.amps ?? 0) >= amps) return [{ type: 'setEdge', edge: e.id, patch: { feeder: item.id, ...cablePatch } }];
  if ((item.qty ?? 1) > 1)
    return [
      { type: 'setItem', node: src.id, item: item.id, patch: { qty: (item.qty ?? 1) - 1 > 1 ? (item.qty ?? 1) - 1 : undefined } },
      { type: 'addFeeder', node: src.id, edge: e.id, eq: item.eq, amps, poles: item.poles ?? poles, cable: opts.cable, name: opts.name, product: item.product, variant: opts.variantOf?.(item.product, amps) },
    ];
  return [
    { type: 'setItem', node: src.id, item: item.id, patch: { amps, variant: opts.variantOf?.(item.product, amps) ?? item.variant } },
    { type: 'setEdge', edge: e.id, patch: { feeder: item.id, ...cablePatch } },
  ];
}
/** validate.ts DFix 와 같은 모양 (순환 import 를 피하려고 여기서 구조만 정의) */
export type DFixLike =
  | { type: 'setItem'; node: string; item: string; patch: Partial<PanelItem> }
  | { type: 'setEdge'; edge: string; patch: Partial<DEdge> }
  | { type: 'addFeeder'; node: string; edge: string; eq: string; amps: number; poles?: 1 | 2 | 3 | 4; cable?: number; name?: string; product?: string; variant?: string };

/** 전압강하 기준 (%) — 단선도 전체 설정 (KEC 수용가 설비 참고: 저압 수전 조명 3·기타 5, 고압 수전 조명 6·기타 8) */
export const VDROP_LIMITS: { pct: number; label: string }[] = [
  { pct: 3, label: '3% (저압 수전 · 조명)' },
  { pct: 5, label: '5% (저압 수전 · 기타)' },
  { pct: 6, label: '6% (고압 수전 · 조명)' },
  { pct: 8, label: '8% (고압 수전 · 기타)' },
];

export const isLowVoltage = (v?: string) => !!v && (voltageOf(v as never)?.kV ?? 99) < 1 && !voltageOf(v as never)?.dc;
