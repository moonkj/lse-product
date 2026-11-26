/**
 * 단선도 그리기 — 확인 규칙 (DRW-01~09). 결과는 안내이며 설계 검토가 아니다 (DISCLAIMER 공용).
 *  01 연결 안 된 상자          02 선 양 끝 전압이 다름 → 사이에 변압기 넣기
 *  03 제품 정격전압 < 상자 전압 → 맞는 제품·옵션       04 자사 보유가 아닌 기기 (안내)
 *  05 발전기가 ATS 없이 연결 → ATS 넣기                06 반 안에 넣을 수 없는 기기 → 바꾸기·빼기
 *  07 반에 주차단기 없음 → 넣기                        08 특고압반 VCB 에 보호계전기 없음 → 넣기
 *  09 변압기 아래 저압 주차단기 정격전류·차단용량 (변압기 용량 기준)
 *  10 반 안 분기 회로 정격전류 > 주차단기 정격전류   11 고른 정격전류가 제품·옵션 범위 밖 → 맞는 옵션
 *  12 변압기 아래 저압반 주차단기에 고른 정격전류 < 변압기 2차 정격전류
 *  13 회로 부하 전류 > 그 회로 차단기 정격     14 설비불평형률 30% 초과 → 상 자동 배분
 *  15 상 최대 부하 전류 > 주차단기 정격
 *  16 반 안 차단기 차단용량 < 예상 단락전류 (위 변압기 %Z 기준)  17 고른 전선이 차단기 정격보다 가늚
 *  18 전압강하 5% 초과 → 굵은 전선
 */
import { getData, type SpecsMap } from '../../data/load';
import type { Coverage } from '../schema';
import { maxOf, productRatings, trSecondaryA, trShortCircuitKA } from '../builder/specParse';
import { candidateProducts, isInstrumentProduct, smallestVariant } from '../builder/validate';
import { ampsInRange, ampsOptions, stdAtLeast, variantFor, RATED_EQ } from './ratings';
import { UNBALANCE_LIMIT, circuitAmps, phaseSummary } from './load';
import { VDROP_WARN, cableAmps, cableForDrop, recommendCable, voltageDrop } from './cable';
import { itemKA, variantForKA } from './ratings';
import {
  eqName,
  isOffLine,
  isTransformer,
  nodeTitle,
  panelTypeById,
  sameSystem,
  sideVoltage,
  voltageLabel,
  voltageOf,
  type DEdge,
  type DNode,
  type Diagram,
  type PanelItem,
  type VoltageId,
} from './model';

export type DFix =
  | { type: 'setProduct'; node: string; item?: string; product: string }
  | { type: 'setItemEq'; node: string; item: string; eq: string }
  | { type: 'setItem'; node: string; item: string; patch: Partial<PanelItem> }
  | { type: 'balancePhases'; node: string }
  | { type: 'addItem'; node: string; eq: string }
  | { type: 'removeItem'; node: string; item: string }
  | { type: 'insertBetween'; edge: string; eq: string; hv?: VoltageId; lv?: VoltageId };

export interface DIssue {
  key: string;
  rule: string;
  severity: 'error' | 'warn' | 'info';
  message: string;
  node?: string;
  item?: string;
  edge?: string;
  fix?: { label: string; fix: DFix };
}

const COVERAGE_NOTE: Partial<Record<Coverage, string>> = {
  missing: '자사 제품이 없습니다(미보유).',
  developing: '자사에서 개발 중이라 아직 고를 제품이 없습니다.',
  affiliate: '계열사 제품으로 공급합니다.',
  sourced: '수배전반 구성품으로 타사 제품을 넣어 공급합니다.',
  na: '자사 사업 범위 밖 기기입니다(다른 회사 제품).',
};

const fmt = (n: number, d = 0) => n.toLocaleString('ko-KR', { maximumFractionDigits: d });

/** 두 전압 사이에 넣을 변압기 (위 → 아래) */
export function pickTransformer(upper: VoltageId, lower: VoltageId): string {
  if (lower === 'dc0.8') return 'sst';
  const a = voltageOf(upper)!.kV;
  const b = voltageOf(lower)!.kV;
  if (b > a) return 'step-up-tr';
  if (a >= 154) return 'main-tr';
  return 'cast-tr';
}

/** 반 안 품목을 다른 전압 반에 맞게 바꿀 기기 */
const SWAP: Record<string, string> = { vcb: 'acb', acb: 'vcb', lbs: 'mccb', mccb: 'branch-mccb', 'branch-mccb': 'mccb', 'protection-relay': 'power-meter', 'power-meter': 'protection-relay', la: 'spd', spd: 'la', alts: 'lv-ats', 'lv-ats': 'alts' };

const ATS = new Set(['lv-ats', 'alts']);
const GENERATORS = new Set(['generator', 'emergency-gen']);

function ratingIssues(out: DIssue[], key: string, label: string, eq: string, productId: string | undefined, v: VoltageId | undefined, specs: SpecsMap | undefined, node: string, item?: string) {
  if (!productId || !v || !specs) return;
  const vo = voltageOf(v)!;
  if (vo.dc || isInstrumentProduct(productId)) return;
  const spec = specs.get(productId);
  if (!spec) return;
  const r = productRatings(spec);
  const kV = maxOf(r.kV);
  const need = vo.kV * 0.95;
  const p = getData().productById.get(productId);
  if (kV === undefined || !p) return;
  if (kV < need) {
    const alts = candidateProducts(eq)
      .filter((x) => x.id !== productId && specs.has(x.id) && (maxOf(productRatings(specs.get(x.id)).kV) ?? 0) >= need)
      .map((x) => {
        const xr = productRatings(specs.get(x.id));
        const vv = smallestVariant(xr.variants, 'kV', need);
        return { x, vv, score: Math.min(...(vv ? vv.kV : xr.kV).filter((n) => n >= need)) };
      })
      .sort((m, n) => m.score - n.score);
    const best = alts[0];
    out.push({
      key: `${key}:03`,
      rule: 'DRW-03',
      severity: 'error',
      message: `${label}: ${p.name} 정격전압은 최대 ${fmt(kV, 1)}kV라 ${vo.label}에 맞지 않습니다.`,
      node,
      item,
      fix: best ? { label: `${best.x.name}${best.vv ? ` ${best.vv.label}` : ''}(으)로 바꾸기`, fix: { type: 'setProduct', node, item, product: best.x.id } } : undefined,
    });
  }
}

function coverageIssue(out: DIssue[], key: string, label: string, eq: string, node: string, item?: string) {
  const e = getData().equipmentTypeById.get(eq);
  const note = e ? COVERAGE_NOTE[e.coverage] : undefined;
  if (note) out.push({ key: `${key}:04`, rule: 'DRW-04', severity: 'info', message: `${label}: ${note}`, node, item });
}

/** 변압기 아래쪽으로 이어진 상자 찾기 — node 에서 위(전원 쪽)로 올라가며 처음 만나는 변압기 */
/** 반의 예상 단락전류 (kA) — 변압기 바로 아래 반(사이에 다른 반 없음)만: 변압기 2차 단락전류 (무한 모선·전선 임피던스 무시, 보수적). 다른 반을 거친 반은 전선 임피던스를 몰라 계산하지 않음 */
export function panelShortCircuitKA(d: Diagram, nodeId: string): number | undefined {
  const tr = upstreamTransformer(d, nodeId);
  const lv = tr?.lv ? voltageOf(tr.lv) : undefined;
  if (!tr?.kVA || !lv || lv.dc) return undefined;
  return trShortCircuitKA(tr.kVA, lv.kV, tr.pctZ ?? 6);
}

export function upstreamTransformer(d: Diagram, nodeId: string): DNode | undefined {
  const byId = new Map(d.nodes.map((n) => [n.id, n]));
  const seen = new Set<string>([nodeId]);
  let frontier = [nodeId];
  for (let depth = 0; depth < 5 && frontier.length; depth++) {
    const next: string[] = [];
    for (const id of frontier)
      for (const e of d.edges.filter((x) => x.to === id)) {
        const up = byId.get(e.from);
        if (!up || seen.has(up.id)) continue;
        seen.add(up.id);
        if (up.kind === 'equipment' && isTransformer(up.eq)) return up;
        if (up.kind === 'bus' || up.kind === 'equipment') next.push(up.id);
      }
    frontier = next;
  }
  return undefined;
}

function mainBreakerCheck(out: DIssue[], d: Diagram, n: DNode, label: string, eq: string, productId: string | undefined, specs: SpecsMap | undefined, item?: string) {
  if (!productId || !specs) return;
  const tr = upstreamTransformer(d, n.id);
  if (!tr || !tr.kVA || !tr.lv) return;
  const lv = voltageOf(tr.lv)!;
  if (lv.dc) return;
  const spec = specs.get(productId);
  const p = getData().productById.get(productId);
  if (!spec || !p) return;
  const r = productRatings(spec);
  const need = trSecondaryA(tr.kVA, lv.kV);
  const isc = trShortCircuitKA(tr.kVA, lv.kV, tr.pctZ ?? 6);
  const a = maxOf(r.A);
  const ka = maxOf(r.kA);
  const key = `${n.id}${item ? `:${item}` : ''}`;
  const better = () => {
    const alt = candidateProducts(eq)
      .filter((x) => x.id !== productId && specs.has(x.id))
      .map((x) => ({ x, r: productRatings(specs.get(x.id)) }))
      .filter(({ r: xr }) => (maxOf(xr.A) ?? 0) >= need && (maxOf(xr.kA) ?? Infinity) >= isc)
      .map(({ x, r: xr }) => ({ x, v: smallestVariant(xr.variants, 'A', need), m: Math.min(...xr.A.filter((n2) => n2 >= need)) }))
      .sort((m, n2) => m.m - n2.m)[0];
    return alt ? { label: `${alt.x.name}${alt.v ? ` ${alt.v.label}` : ''}(으)로 바꾸기`, fix: { type: 'setProduct' as const, node: n.id, item, product: alt.x.id } } : undefined;
  };
  const trName = nodeTitle(tr);
  if (a !== undefined && a < need)
    out.push({ key: `${key}:09a`, rule: 'DRW-09', severity: 'warn', message: `${trName} ${fmt(tr.kVA)}kVA의 2차 정격전류는 약 ${fmt(need)}A입니다. ${label} ${p.name}은(는) 최대 ${fmt(a)}A라 부족합니다.`, node: n.id, item, fix: better() });
  else if (a !== undefined) {
    const v = smallestVariant(r.variants, 'A', need);
    out.push({ key: `${key}:09i`, rule: 'DRW-09', severity: 'info', message: `참고: ${trName} ${fmt(tr.kVA)}kVA 2차 정격전류 약 ${fmt(need)}A.${v ? ` ${p.name}에서는 ${v.label} 이상을 고르세요.` : ''}`, node: n.id, item });
  }
  if (ka !== undefined && ka < isc)
    out.push({ key: `${key}:09k`, rule: 'DRW-09', severity: 'warn', message: `예상 단락전류 약 ${fmt(isc, 1)}kA(%Z ${tr.pctZ ?? 6}% 가정)보다 ${p.name} 차단용량(최대 ${fmt(ka)}kA)이 작습니다.`, node: n.id, item, fix: better() });
}

export function validateDiagram(d: Diagram, specs?: SpecsMap): DIssue[] {
  const out: DIssue[] = [];
  const byId = new Map(d.nodes.map((n) => [n.id, n]));
  const degree = new Map<string, number>();
  for (const e of d.edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }

  for (const n of d.nodes) {
    const title = nodeTitle(n);
    // 01 연결
    if (d.nodes.length > 1 && !degree.get(n.id) && !(n.kind === 'equipment' && isOffLine(n.eq)))
      out.push({ key: `${n.id}:01`, rule: 'DRW-01', severity: 'warn', message: `'${title}'이(가) 어느 선에도 연결되지 않았습니다. 아래 연결점을 끌어 다른 상자에 놓거나 '연결하기'를 누르세요.`, node: n.id });

    if (n.kind === 'equipment' && n.eq) {
      coverageIssue(out, n.id, title, n.eq, n.id);
      ratingIssues(out, n.id, title, n.eq, n.product, isTransformer(n.eq) ? n.hv : n.v, specs, n.id);
      if (n.eq === 'acb') mainBreakerCheck(out, d, n, title, n.eq, n.product, specs);
      if (n.eq === 'vcb')
        out.push({ key: `${n.id}:08s`, rule: 'DRW-08', severity: 'info', message: `'${title}': VCB는 보통 보호계전기와 함께 특고압 수배전반 안에 넣습니다. 반 상자로 그리면 안의 구성까지 확인할 수 있습니다.`, node: n.id });
      // 05 발전기 → ATS
      if (GENERATORS.has(n.eq))
        for (const e of d.edges.filter((x) => x.from === n.id || x.to === n.id)) {
          const other = byId.get(e.from === n.id ? e.to : e.from);
          if (!other) continue;
          const hasAts = (other.kind === 'equipment' && ATS.has(other.eq ?? '')) || (other.kind === 'panel' && other.items?.some((i) => ATS.has(i.eq)));
          if (!hasAts && other.kind !== 'equipment')
            out.push({
              key: `${e.id}:05`,
              rule: 'DRW-05',
              severity: 'warn',
              message: `'${title}'이(가) 자동절환개폐기(ATS) 없이 '${nodeTitle(other)}'에 바로 연결됐습니다. 상용 전원과 겹쳐 들어갈 수 있습니다.`,
              node: n.id,
              edge: e.id,
              fix: { label: `사이에 ${n.v === '0.38' || n.v === '0.22' ? '저압 ATS' : 'ALTS'} 넣기`, fix: { type: 'insertBetween', edge: e.id, eq: n.v === '0.38' || n.v === '0.22' ? 'lv-ats' : 'alts' } },
            });
        }
    }

    if (n.kind === 'panel') {
      const pt = panelTypeById(n.eq);
      if (!pt) continue;
      if (n.eq) {
        coverageIssue(out, n.id, title, n.eq, n.id);
        ratingIssues(out, n.id, title, n.eq, n.product, n.v, specs, n.id);
      }
      const items = n.items ?? [];
      const mainItem = items.find((i) => pt.main.includes(i.eq));
      if (!mainItem)
        out.push({ key: `${n.id}:07`, rule: 'DRW-07', severity: 'warn', message: `'${title}'에 주차단기가 없습니다. ${pt.main.map(eqName).join(' 또는 ')}를 넣으세요.`, node: n.id, fix: { label: `${eqName(pt.main[0])} 넣기`, fix: { type: 'addItem', node: n.id, eq: pt.main[0] } } });
      if (pt.id === 'mv-swgr' && items.some((i) => i.eq === 'vcb') && !items.some((i) => i.eq === 'protection-relay'))
        out.push({ key: `${n.id}:08`, rule: 'DRW-08', severity: 'warn', message: `'${title}'의 VCB에 보호계전기가 없습니다. 고장이 나도 차단 신호를 받을 수 없습니다.`, node: n.id, fix: { label: '보호계전기 넣기', fix: { type: 'addItem', node: n.id, eq: 'protection-relay' } } });
      for (const it of items) {
        const label = `${title} › ${eqName(it.eq)}`;
        if (!pt.accepts.includes(it.eq)) {
          const swap = SWAP[it.eq];
          const ok = swap && pt.accepts.includes(swap);
          out.push({
            key: `${n.id}:${it.id}:06`,
            rule: 'DRW-06',
            severity: 'error',
            message: `${eqName(it.eq)}은(는) ${pt.label}(${voltageLabel(n.v)})에 넣는 기기가 아닙니다. 이 반에는 ${pt.accepts.slice(0, 6).map(eqName).join(', ')} 등을 넣습니다.`,
            node: n.id,
            item: it.id,
            fix: ok ? { label: `${eqName(swap)}(으)로 바꾸기`, fix: { type: 'setItemEq', node: n.id, item: it.id, eq: swap } } : { label: '빼기', fix: { type: 'removeItem', node: n.id, item: it.id } },
          });
          continue;
        }
        coverageIssue(out, `${n.id}:${it.id}`, label, it.eq, n.id, it.id);
        ratingIssues(out, `${n.id}:${it.id}`, label, it.eq, it.product, n.v, specs, n.id, it.id);
        if (it === mainItem && pt.id === 'lv-swgr') mainBreakerCheck(out, d, n, label, it.eq, it.product, specs, it.id);
        // 11 정격전류가 제품·옵션 범위 밖
        if (it.amps && it.product && !ampsInRange(it, specs)) {
          const v = variantFor(it.product, it.amps, specs);
          const opts = ampsOptions(it.product, it.variant, specs);
          out.push({
            key: `${n.id}:${it.id}:11`,
            rule: 'DRW-11',
            severity: 'warn',
            message: `${label}: ${it.amps}A는 고른 제품·프레임 범위(${Math.min(...opts)}~${Math.max(...opts)}A) 밖입니다.`,
            node: n.id,
            item: it.id,
            fix: v ? { label: `${v.label}(으)로 바꾸기`, fix: { type: 'setItem', node: n.id, item: it.id, patch: { variant: v.id } } } : undefined,
          });
        }
      }
      // 10 분기 > 주차단기
      if (mainItem?.amps)
        for (const it of items) {
          if (it === mainItem || !it.amps || !RATED_EQ.has(it.eq) || it.amps <= mainItem.amps) continue;
          const up = stdAtLeast(it.amps);
          out.push({
            key: `${n.id}:${it.id}:10`,
            rule: 'DRW-10',
            severity: 'warn',
            message: `${title} › ${it.name || eqName(it.eq)} ${it.amps}A가 주차단기 ${mainItem.amps}A보다 큽니다. 분기 회로는 주차단기보다 작아야 보호협조가 됩니다.`,
            node: n.id,
            item: it.id,
            fix: { label: `주차단기를 ${up}A로`, fix: { type: 'setItem', node: n.id, item: mainItem.id, patch: { amps: up, variant: variantFor(mainItem.product, up, specs)?.id ?? mainItem.variant } } },
          });
        }
      // 13~15 부하·상 (저압반)
      if (n.v === '0.38' || n.v === '0.22') {
        for (const it of items) {
          if (it === mainItem || !it.loadKW || !it.amps || !RATED_EQ.has(it.eq)) continue;
          const ia = circuitAmps(it);
          if (ia > it.amps) {
            const up = stdAtLeast(ia);
            out.push({
              key: `${n.id}:${it.id}:13`,
              rule: 'DRW-13',
              severity: 'warn',
              message: `${title} › ${it.name || eqName(it.eq)}: 부하 ${it.loadKW}kW의 전류 약 ${fmt(ia, 1)}A가 차단기 ${it.amps}A보다 큽니다 (역률 0.9 가정).`,
              node: n.id,
              item: it.id,
              fix: { label: `차단기를 ${up}A로`, fix: { type: 'setItem', node: n.id, item: it.id, patch: { amps: up, variant: variantFor(it.product, up, specs)?.id ?? it.variant } } },
            });
          }
        }
        const ps = phaseSummary(items, mainItem?.id);
        if (ps.unbalance > UNBALANCE_LIMIT)
          out.push({
            key: `${n.id}:14`,
            rule: 'DRW-14',
            severity: 'warn',
            message: `${title} 설비불평형률이 ${fmt(ps.unbalance, 0)}%입니다 (R ${fmt(ps.single.R, 1)} · S ${fmt(ps.single.S, 1)} · T ${fmt(ps.single.T, 1)}kW). 30%를 넘지 않게 단상 회로를 상에 고르게 나누세요.`,
            node: n.id,
            fix: { label: '상 자동 배분', fix: { type: 'balancePhases', node: n.id } },
          });
        if (mainItem?.amps && ps.maxPhaseA > mainItem.amps) {
          const up = stdAtLeast(ps.maxPhaseA);
          out.push({
            key: `${n.id}:15`,
            rule: 'DRW-15',
            severity: 'warn',
            message: `${title} 부하가 가장 큰 상 전류 약 ${fmt(ps.maxPhaseA, 0)}A가 주차단기 ${mainItem.amps}A보다 큽니다.`,
            node: n.id,
            item: mainItem.id,
            fix: { label: `주차단기를 ${up}A로`, fix: { type: 'setItem', node: n.id, item: mainItem.id, patch: { amps: up, variant: variantFor(mainItem.product, up, specs)?.id ?? mainItem.variant } } },
          });
        }
      }
      // 16 차단용량 / 17 전선 / 18 전압강하 (저압반)
      if (n.v === '0.38' || n.v === '0.22') {
        const isc = panelShortCircuitKA(d, n.id);
        for (const it of items) {
          const lbl = `${title} › ${it === mainItem ? '주차단기' : it.name || eqName(it.eq)}`;
          if (isc && RATED_EQ.has(it.eq) && it.product && it.eq !== 'busway') {
            const ka = itemKA(it, specs);
            if (ka !== undefined && ka < isc) {
              const v = variantForKA(it.product, isc, it.amps, specs);
              out.push({
                key: `${n.id}:${it.id}:16`,
                rule: 'DRW-16',
                severity: 'warn',
                message: `${lbl}: 차단용량 ${fmt(ka, 1)}kA가 이 반의 예상 단락전류 약 ${fmt(isc, 1)}kA보다 작습니다 (위 변압기 %Z 기준, 전선 임피던스 무시).`,
                node: n.id,
                item: it.id,
                fix: v ? { label: `${v.label}(으)로 바꾸기`, fix: { type: 'setItem', node: n.id, item: it.id, patch: { variant: v.id } } } : undefined,
              });
            }
          }
          if (it === mainItem || !it.amps) continue;
          const rec = recommendCable(it.amps);
          if (it.cable && rec && it.cable < rec)
            out.push({
              key: `${n.id}:${it.id}:17`,
              rule: 'DRW-17',
              severity: 'warn',
              message: `${lbl}: 전선 ${it.cable}mm²(허용 약 ${cableAmps(it.cable)}A)가 차단기 ${it.amps}A보다 가늘어 과전류 때 전선을 보호하지 못합니다.`,
              node: n.id,
              item: it.id,
              fix: { label: `${rec}mm²로`, fix: { type: 'setItem', node: n.id, item: it.id, patch: { cable: rec } } },
            });
          const vd = voltageDrop(it);
          if (vd !== undefined && vd > VDROP_WARN) {
            const thick = cableForDrop(it);
            out.push({
              key: `${n.id}:${it.id}:18`,
              rule: 'DRW-18',
              severity: 'warn',
              message: `${lbl}: 전선 ${it.lengthM}m 전압강하가 약 ${fmt(vd, 1)}%입니다. 5% 이하가 되게 전선을 굵게 하거나 길이를 줄이세요.`,
              node: n.id,
              item: it.id,
              fix: thick ? { label: `${thick}mm²로`, fix: { type: 'setItem', node: n.id, item: it.id, patch: { cable: thick } } } : undefined,
            });
          }
        }
      }
      // 12 변압기 2차 전류보다 작은 주차단기 정격
      if (pt.id === 'lv-swgr' && mainItem?.amps) {
        const tr = upstreamTransformer(d, n.id);
        const lv = tr?.lv ? voltageOf(tr.lv) : undefined;
        if (tr?.kVA && lv && !lv.dc) {
          const need = trSecondaryA(tr.kVA, lv.kV);
          if (mainItem.amps < need) {
            const up = stdAtLeast(need);
            out.push({
              key: `${n.id}:${mainItem.id}:12`,
              rule: 'DRW-12',
              severity: 'warn',
              message: `${title} 주차단기 ${mainItem.amps}A가 ${nodeTitle(tr)} ${fmt(tr.kVA)}kVA 2차 정격전류 약 ${fmt(need)}A보다 작습니다.`,
              node: n.id,
              item: mainItem.id,
              fix: { label: `${up}A로 올리기`, fix: { type: 'setItem', node: n.id, item: mainItem.id, patch: { amps: up, variant: variantFor(mainItem.product, up, specs)?.id ?? mainItem.variant } } },
            });
          }
        }
      }
    }
  }

  // 02 선 양 끝 전압
  for (const e of d.edges) {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) continue;
    const va = sideVoltage(a, 'out');
    const vb = sideVoltage(b, 'in');
    if (!va || !vb || sameSystem(va, vb)) continue;
    const tr = pickTransformer(va, vb);
    out.push({
      key: `${e.id}:02`,
      rule: 'DRW-02',
      severity: 'error',
      message: `'${nodeTitle(a)}'(${voltageLabel(va)})와 '${nodeTitle(b)}'(${voltageLabel(vb)})가 변압기 없이 연결됐습니다. 전압이 다른 구간 사이에는 변압기가 필요합니다.`,
      edge: e.id,
      node: b.id,
      fix: { label: `사이에 ${eqName(tr)} 넣기`, fix: { type: 'insertBetween', edge: e.id, eq: tr, hv: va, lv: vb } },
    });
  }
  return out;
}

export interface DSummary {
  nodes: number;
  edges: number;
  attention: number;
  errors: number;
  notOwned: number;
}

export function summarizeDiagram(d: Diagram, issues: DIssue[]): DSummary {
  const eqs = d.nodes.flatMap((n) => [n.eq, ...(n.items ?? []).map((i) => i.eq)]).filter((x): x is string => !!x);
  const notOwned = eqs.filter((id) => {
    const c = getData().equipmentTypeById.get(id)?.coverage;
    return c && c !== 'owned' && c !== 'partial';
  }).length;
  return {
    nodes: d.nodes.length,
    edges: d.edges.length,
    attention: issues.filter((i) => i.severity !== 'info').length,
    errors: issues.filter((i) => i.severity === 'error').length,
    notOwned,
  };
}

export type { DEdge, PanelItem };
