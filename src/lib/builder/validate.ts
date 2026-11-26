/**
 * 계통 구성 시뮬레이션 — 구성(Build) 상태 · 확인 규칙 · 고치기 (순수 함수, 화면과 분리).
 * 화면 표현은 "검증·적합·통과"를 쓰지 않고 "확인할 점·제안"으로 쓴다 (설계 검토가 아님 — DISCLAIMER).
 *
 * 규칙 (BLD-xx):
 *  01 필수 칸 비어 있음 (warn)            02 칸에 맞지 않는 기기 (error)
 *  03 보유 상태 안내 — 미보유·개발 중·계열사·구성품·사업 범위 밖 (info, 자사 대안이 있으면 고치기)
 *  04 제품 미선택 (info)                  05 제품 정격전압 < 구간 전압 (error)
 *  06 저압 주차단기 정격전류 < 변압기 2차 정격전류 (warn) · 추천 프레임 안내 (info)
 *  07 차단용량 < 예상 단락전류 (warn, %Z 가정)   08 변압기 용량이 카탈로그 범위 밖 (warn)
 *  09 정격 정보 없음 — 판단 보류 (info)    10 템플릿 규칙 (requires·minCount·oneOf, warn)
 */
import { getData } from '../../data/load';
import type { SpecsMap } from '../../data/load';
import type { Coverage, EquipmentType, Product } from '../schema';
import { LAYER_LABELS } from '../schema';
import { productsForEquipment } from '../pages/catalog';
import { maxOf, productRatings, trSecondaryA, trShortCircuitKA } from './specParse';
import { slotsOf, type Row, type Slot, type Template } from './templates';

export const DISCLAIMER =
  '제품 구성을 미리 그려 보는 참고 도구입니다. 표시되는 확인할 점은 기본 규칙에 따른 안내이며 설계 검토나 적합성 판정이 아닙니다. 실제 정격·차단용량·보호협조는 KEC 등 설계 기준과 제품 카탈로그로 확인하세요.';

export interface Placement {
  eq?: string;
  product?: string;
  /** 수량 (없으면 1) — 같은 기기를 여러 대 쓰는 칸 (분기 차단기 4개 등) */
  qty?: number;
}
export interface Extra {
  id: string;
  row: string;
  eq: string;
  product?: string;
  qty?: number;
}

export const QTY_MAX = 99;
export const clampQty = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? Math.min(QTY_MAX, Math.max(1, Math.round(n))) : 1);
export interface Build {
  template: string;
  slots: Record<string, Placement>;
  extras: Extra[];
  params: { kVA: number; pctZ: number };
}

export type Target = { kind: 'slot'; id: string } | { kind: 'extra'; id: string };
export type Fix =
  | { type: 'setEq'; target: Target; eq: string }
  | { type: 'setProduct'; target: Target; product: string }
  | { type: 'clear'; target: Target }
  | { type: 'setQty'; target: Target; qty: number };

export interface Issue {
  key: string;
  rule: string;
  severity: 'error' | 'warn' | 'info';
  message: string;
  target?: Target;
  fix?: { label: string; fix: Fix };
}

export function emptyBuild(t: Template): Build {
  return { template: t.id, slots: {}, extras: [], params: { kVA: t.params.kVA, pctZ: t.params.pctZ } };
}

/** 기본 구성 — 모든 칸을 default 기기로, 제품은 추천 제품으로 */
export function defaultBuild(t: Template, specs?: SpecsMap): Build {
  const b = emptyBuild(t);
  for (const { row, slot } of slotsOf(t)) {
    const eq = slot.default;
    b.slots[slot.id] = { eq, product: recommendProduct(eq, { row, slot }, b, t, specs)?.id };
  }
  return b;
}

const eqById = (id: string) => getData().equipmentTypeById.get(id);
const eqName = (id: string) => {
  const e = eqById(id);
  return e ? (e.abbr ? `${e.name}(${e.abbr})` : e.name) : id;
};
const fmt = (n: number, d = 0) => n.toLocaleString('ko-KR', { maximumFractionDigits: d });

/** 칸에 넣을 수 있는 자사 제품 (단종 제외) */
export function candidateProducts(eq: string): Product[] {
  return productsForEquipment(eq).filter((p) => !p.discontinued);
}

/**
 * 계전기·계측기는 PT·CT 2차(110V·5A 등)로 신호를 받는다. 카탈로그 '정격전압·정격전류'는 그 입력값이라
 * 계통 전압·변압기 2차 전류와 비교하면 안 된다 (예: GIMAC-II Plus 230V 입력을 380V 구간 부적합으로 오판).
 */
const INSTRUMENT_EQ = ['protection-relay', 'power-meter'];
let instrumentIds: Set<string> | undefined;
export function isInstrumentProduct(productId: string): boolean {
  instrumentIds ??= new Set(INSTRUMENT_EQ.flatMap((e) => productsForEquipment(e).map((p) => p.id)));
  return instrumentIds.has(productId);
}

type VariantRatings = ReturnType<typeof productRatings>['variants'][number];
/** 필요한 값(need) 이상을 내는 옵션 중 가장 작은 것 (예: 22.9kV → 24kV 옵션, 1,519A → 2000A 프레임) */
export function smallestVariant(variants: VariantRatings[], kind: 'kV' | 'A' | 'kA', need: number): VariantRatings | undefined {
  return variants
    .filter((x) => x[kind].length && Math.max(...x[kind]) >= need)
    .sort((x, y) => Math.max(...x[kind]) - Math.max(...y[kind]))[0];
}

export interface Ctx {
  row: Row;
  slot: Pick<Slot, 'id' | 'label' | 'accepts' | 'default' | 'hint' | 'rating' | 'transformer' | 'required'>;
}

/** 제품이 칸 조건(전압·전류·차단용량)에 맞는지 — 모르면 true (판단 보류) */
export function productFits(p: Product, ctx: Ctx, b: Build, t: Template, specs?: SpecsMap): boolean {
  if (isInstrumentProduct(p.id)) return true; // PT·CT 2차 입력 기기 — 계통 정격과 비교하지 않음
  const r = productRatings(specs?.get(p.id));
  const kV = maxOf(r.kV);
  if (ctx.row.acdc !== 'dc' && kV !== undefined && kV < ctx.row.kV * 0.95) return false;
  if (ctx.slot.rating === 'trSecondary') {
    const need = trSecondaryA(b.params.kVA, t.params.lvKV);
    const a = maxOf(r.A);
    if (a !== undefined && a < need) return false;
    const isc = trShortCircuitKA(b.params.kVA, t.params.lvKV, b.params.pctZ);
    const ka = maxOf(r.kA);
    if (ka !== undefined && ka < isc) return false;
  }
  return true;
}

/** 추천 제품 — 조건에 맞고 정격 정보가 있는 제품 먼저 */
export function recommendProduct(eq: string, ctx: Ctx, b: Build, t: Template, specs?: SpecsMap): Product | undefined {
  const list = candidateProducts(eq);
  const fits = list.filter((p) => productFits(p, ctx, b, t, specs));
  const withSpec = fits.filter((p) => specs?.has(p.id));
  // 조건에 맞는 제품이 없으면 추천하지 않는다 (맞지 않는 제품을 기본으로 넣지 않음)
  return withSpec[0] ?? fits[0];
}

const COVERAGE_NOTE: Partial<Record<Coverage, (e: EquipmentType) => string>> = {
  missing: () => '자사 제품이 없습니다(미보유).',
  partial: () => '자사 제품이 일부만 있습니다.',
  developing: () => '자사에서 개발 중이라 아직 고를 제품이 없습니다.',
  affiliate: (e) => `계열사${e.affiliateName ? `(${e.affiliateName})` : ''} 제품으로 공급합니다.`,
  sourced: () => '수배전반 구성품으로 타사 제품을 넣어 공급합니다.',
  na: () => '자사 사업 범위 밖 기기입니다(다른 회사 제품).',
};

/** 한 칸(또는 추가 칸) 확인 */
function checkPlacement(target: Target, p: Placement | undefined, ctx: Ctx, b: Build, t: Template, specs: SpecsMap | undefined, out: Issue[]) {
  const key = `${target.kind}:${target.id}`;
  const label = `'${ctx.slot.label}' 칸`;
  if (!p?.eq) {
    if (ctx.slot.required)
      out.push({
        key: `${key}:01`,
        rule: 'BLD-01',
        severity: 'warn',
        message: `${label}이 비어 있습니다. ${ctx.slot.hint}`,
        target,
        fix: { label: `${eqName(ctx.slot.default)} 넣기`, fix: { type: 'setEq', target, eq: ctx.slot.default } },
      });
    return;
  }
  const eq = eqById(p.eq);
  if (!eq) return;
  if (!ctx.slot.accepts.includes(p.eq)) {
    const where = `${LAYER_LABELS[eq.layer]} ${eq.voltage.split(' ')[0]}`;
    out.push({
      key: `${key}:02`,
      rule: 'BLD-02',
      severity: 'error',
      message: `${eqName(p.eq)}은(는) ${where} 기기라 ${label}(${ctx.row.voltage})에 맞지 않습니다. 이 칸에는 ${ctx.slot.accepts.map(eqName).join(', ')} 중 하나를 넣습니다.`,
      target,
      fix: { label: `${eqName(ctx.slot.default)}(으)로 바꾸기`, fix: { type: 'setEq', target, eq: ctx.slot.default } },
    });
    return; // 맞지 않는 기기는 제품·정격 확인을 하지 않음
  }
  const note = COVERAGE_NOTE[eq.coverage];
  if (note) {
    const alt = ctx.slot.accepts.find((a) => a !== p.eq && eqById(a)?.coverage === 'owned');
    out.push({
      key: `${key}:03`,
      rule: 'BLD-03',
      severity: 'info',
      message: `${eqName(p.eq)}: ${note(eq)}${alt ? ` 이 칸에는 자사 보유 기기 ${eqName(alt)}도 넣을 수 있습니다.` : ''}`,
      target,
      fix: alt ? { label: `${eqName(alt)}(으)로 바꾸기`, fix: { type: 'setEq', target, eq: alt } } : undefined,
    });
  }
  const products = candidateProducts(p.eq);
  if (products.length === 0) return;
  if (!p.product) {
    const rec = recommendProduct(p.eq, ctx, b, t, specs);
    out.push({
      key: `${key}:04`,
      rule: 'BLD-04',
      severity: 'info',
      message: `${label}에 넣을 자사 제품을 아직 고르지 않았습니다.`,
      target,
      fix: rec ? { label: `${rec.name} 고르기`, fix: { type: 'setProduct', target, product: rec.id } } : undefined,
    });
    return;
  }
  const product = getData().productById.get(p.product);
  if (!product) return;
  const spec = specs?.get(product.id);
  if (specs && !spec) {
    out.push({ key: `${key}:09`, rule: 'BLD-09', severity: 'info', message: `${product.name}은(는) 정격 정보가 없어 정격을 확인하지 않았습니다. 카탈로그로 확인하세요.`, target });
    return;
  }
  // 계전기·계측기: 정격은 PT·CT 2차 입력값이라 계통 정격 판단(05~08)을 하지 않음
  if (isInstrumentProduct(product.id)) return;
  const r = productRatings(spec);
  const rowKV = ctx.row.kV * 0.95;
  const needA = trSecondaryA(b.params.kVA, t.params.lvKV);
  const needKA = trShortCircuitKA(b.params.kVA, t.params.lvKV, b.params.pctZ);
  /**
   * 대체 제품 제안 — 같은 기기의 자사 제품 중 조건에 맞는 것, 그중 '모자란 정격'을 가장 알맞게(넘치지 않게) 채우는 제품.
   * 옵션(variant)이 있으면 어떤 옵션을 고르면 되는지까지 알려 준다 (예: Susol VCB 24kV).
   */
  const betterFix = (kind: 'kV' | 'A' | 'kA') => {
    const need = kind === 'kV' ? rowKV : kind === 'A' ? needA : needKA;
    const alts = candidateProducts(p.eq!)
      .filter((x) => x.id !== product.id && specs?.has(x.id) && productFits(x, ctx, b, t, specs))
      .map((x) => {
        const xr = productRatings(specs!.get(x.id));
        const v = smallestVariant(xr.variants, kind, need);
        const enough = (v ? v[kind] : xr[kind]).filter((n) => n >= need);
        return { x, v, score: enough.length ? Math.min(...enough) : Infinity };
      })
      .sort((m, n) => m.score - n.score);
    const best = alts[0];
    if (!best) return undefined;
    return { label: `${best.x.name}${best.v ? ` ${best.v.label}` : ''}(으)로 바꾸기`, fix: { type: 'setProduct' as const, target, product: best.x.id } };
  };
  // 05 정격전압
  const kV = maxOf(r.kV);
  if (ctx.row.acdc !== 'dc' && kV !== undefined && kV < rowKV)
    out.push({
      key: `${key}:05`,
      rule: 'BLD-05',
      severity: 'error',
      message: `${product.name} 정격전압은 최대 ${fmt(kV, 1)}kV라 ${ctx.row.voltage} 구간에 맞지 않습니다.`,
      target,
      fix: betterFix('kV'),
    });
  else if (ctx.row.acdc !== 'dc' && kV !== undefined && !ctx.slot.transformer) {
    // 제품은 맞지만 낮은 전압 옵션도 있는 경우 — 고를 옵션 안내
    const v = smallestVariant(r.variants, 'kV', rowKV);
    if (v && r.variants.some((x) => x.kV.length && Math.max(...x.kV) < rowKV))
      out.push({ key: `${key}:05i`, rule: 'BLD-05', severity: 'info', message: `참고: ${ctx.row.voltage} 구간에는 ${product.name} ${v.label} 이상 옵션을 고르세요.`, target });
  }
  // 06·07 변압기 2차 기준 정격전류·차단용량
  if (ctx.slot.rating === 'trSecondary') {
    const need = needA;
    const a = maxOf(r.A);
    if (a !== undefined && a < need)
      out.push({
        key: `${key}:06`,
        rule: 'BLD-06',
        severity: 'warn',
        message: `변압기 ${fmt(b.params.kVA)}kVA의 2차 정격전류는 약 ${fmt(need)}A입니다. ${product.name}은(는) 최대 ${fmt(a)}A라 부족합니다.`,
        target,
        fix: betterFix('A'),
      });
    else if (a !== undefined) {
      const v = smallestVariant(r.variants, 'A', need);
      out.push({
        key: `${key}:06i`,
        rule: 'BLD-06',
        severity: 'info',
        message: `참고: 변압기 ${fmt(b.params.kVA)}kVA 2차 정격전류는 약 ${fmt(need)}A입니다.${v ? ` ${product.name}에서는 ${v.label} 이상을 고르세요.` : ''}`,
        target,
      });
    }
    const isc = needKA;
    const ka = maxOf(r.kA);
    if (ka !== undefined && ka < isc)
      out.push({
        key: `${key}:07`,
        rule: 'BLD-07',
        severity: 'warn',
        message: `예상 단락전류 약 ${fmt(isc, 1)}kA(변압기 %Z ${b.params.pctZ}% 가정)보다 ${product.name} 차단용량(최대 ${fmt(ka)}kA)이 작습니다.`,
        target,
        fix: betterFix('kA'),
      });
  }
  // 08 변압기 용량
  if (ctx.slot.transformer) {
    const max = maxOf(r.kVA);
    if (max !== undefined && b.params.kVA > max)
      out.push({ key: `${key}:08`, rule: 'BLD-08', severity: 'warn', message: `${product.name} 카탈로그 용량은 최대 ${fmt(max)}kVA입니다. 입력한 ${fmt(b.params.kVA)}kVA보다 작습니다.`, target });
  }
}

/** 구성 전체 확인 — 결과는 칸 순서대로, 템플릿 규칙은 끝에 */
export function validateBuild(b: Build, t: Template, specs?: SpecsMap): Issue[] {
  const out: Issue[] = [];
  for (const { row, slot } of slotsOf(t)) checkPlacement({ kind: 'slot', id: slot.id }, b.slots[slot.id], { row, slot }, b, t, specs, out);
  for (const x of b.extras) {
    const row = t.rows.find((r) => r.id === x.row);
    if (!row?.addable) continue;
    const ctx: Ctx = {
      row,
      slot: { id: x.id, label: row.addable.label.replace(/ 추가$/, ''), accepts: row.addable.accepts, default: row.addable.accepts[0], hint: '', required: false },
    };
    checkPlacement({ kind: 'extra', id: x.id }, x, ctx, b, t, specs, out);
  }
  const filled = (id: string) => !!b.slots[id]?.eq;
  const slotDef = (id: string) => slotsOf(t).find((s) => s.slot.id === id)?.slot;
  for (const [i, rule] of t.rules.entries()) {
    if (rule.type === 'requires' && filled(rule.if) && !filled(rule.then)) {
      const s = slotDef(rule.then);
      out.push({
        key: `rule:${i}`,
        rule: 'BLD-10',
        severity: 'warn',
        message: rule.message,
        target: { kind: 'slot', id: rule.then },
        fix: s ? { label: `${eqName(s.default)} 넣기`, fix: { type: 'setEq', target: { kind: 'slot', id: rule.then }, eq: s.default } } : undefined,
      });
    }
    if (rule.type === 'minCount') {
      const n = Object.values(b.slots).filter((p) => p.eq === rule.eq).length + b.extras.filter((x) => x.eq === rule.eq).length;
      if (n > 0 && n < rule.count)
        out.push({
          key: `rule:${i}`,
          rule: 'BLD-10',
          severity: 'warn',
          message: rule.message,
          target: { kind: 'slot', id: rule.fixSlot },
          fix: !filled(rule.fixSlot) ? { label: `${eqName(rule.eq)} 넣기`, fix: { type: 'setEq', target: { kind: 'slot', id: rule.fixSlot }, eq: rule.eq } } : undefined,
        });
    }
    if (rule.type === 'oneOf' && rule.slots.filter(filled).length > 1)
      out.push({ key: `rule:${i}`, rule: 'BLD-10', severity: 'warn', message: rule.message, target: { kind: 'slot', id: rule.slots[1] } });
  }
  return out;
}

/** 고치기 적용 — 새 Build (원본 불변). 기기를 바꾸면 제품 선택은 지운다 */
export function applyFix(b: Build, fix: Fix): Build {
  const next: Build = { ...b, slots: { ...b.slots }, extras: b.extras.map((x) => ({ ...x })) };
  const get = (t: Target): Placement | undefined => (t.kind === 'slot' ? next.slots[t.id] : next.extras.find((x) => x.id === t.id));
  if (fix.type === 'clear') {
    if (fix.target.kind === 'slot') delete next.slots[fix.target.id];
    else next.extras = next.extras.filter((x) => x.id !== fix.target.id);
    return next;
  }
  if (fix.type === 'setEq') {
    if (fix.target.kind === 'slot') next.slots[fix.target.id] = { eq: fix.eq, ...(next.slots[fix.target.id]?.qty ? { qty: next.slots[fix.target.id]!.qty } : {}) };
    else {
      const x = next.extras.find((e) => e.id === fix.target.id);
      if (x) {
        x.eq = fix.eq;
        delete x.product;
      }
    }
    return next;
  }
  const p = get(fix.target);
  if (fix.type === 'setQty') {
    if (!p?.eq) return b;
    const qty = clampQty(fix.qty);
    if (fix.target.kind === 'slot') next.slots[fix.target.id] = { ...p, qty: qty > 1 ? qty : undefined };
    else (p as Extra).qty = qty > 1 ? qty : undefined;
    return next;
  }
  if (p) {
    if (fix.target.kind === 'slot') next.slots[fix.target.id] = { ...p, product: fix.product };
    else (p as Extra).product = fix.product;
  }
  return next;
}

export interface Summary {
  filled: number;
  total: number;
  /** 확인할 점 (error + warn) */
  attention: number;
  /** 자사 보유가 아닌 기기 수 */
  notOwned: number;
}

export function summarize(b: Build, t: Template, issues: Issue[]): Summary {
  const placed = [...slotsOf(t).map(({ slot }) => b.slots[slot.id]?.eq), ...b.extras.map((x) => x.eq)].filter((x): x is string => !!x);
  return {
    filled: slotsOf(t).filter(({ slot }) => b.slots[slot.id]?.eq).length,
    total: slotsOf(t).length,
    attention: issues.filter((i) => i.severity !== 'info').length,
    notOwned: placed.filter((id) => eqById(id)?.coverage !== 'owned').length,
  };
}
