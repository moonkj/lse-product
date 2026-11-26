/** 단선도 그리기 — 편집 동작(순수 함수), 제안대로 고치기, 제품 목록 */
import { getData, type SpecsMap } from '../../data/load';
import { COVERAGE_LABELS } from '../schema';
import { csvCell } from '../pages/catalog';
import { candidateProducts, clampQty, DISCLAIMER, isInstrumentProduct } from '../builder/validate';
import { maxOf, productRatings, trSecondaryA, trShortCircuitKA } from '../builder/specParse';
import { TRANSFORMERS, eqName, isTransformer, makeNode, newId, nodeSize, nodeTitle, panelTypeById, snap, voltageLabel, voltageOf, type DNode, type Diagram, type PanelItem } from './model';
import { upstreamTransformer } from './validate';
import type { DFix } from './validate';

const touch = (d: Diagram, patch: Partial<Diagram>): Diagram => ({ ...d, ...patch, updatedAt: new Date().toISOString() });

export function addNode(d: Diagram, n: DNode): Diagram {
  return touch(d, { nodes: [...d.nodes, n] });
}

export function updateNode(d: Diagram, id: string, patch: Partial<DNode>): Diagram {
  return touch(d, { nodes: d.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) });
}

export function moveNode(d: Diagram, id: string, x: number, y: number): Diagram {
  return updateNode(d, id, { x: Math.max(0, snap(x)), y: Math.max(0, snap(y)) });
}

export function removeNode(d: Diagram, id: string): Diagram {
  return touch(d, { nodes: d.nodes.filter((n) => n.id !== id), edges: d.edges.filter((e) => e.from !== id && e.to !== id) });
}

/** 선 잇기 — 같은 상자·같은 선은 무시. 위에 있는 상자가 from(전원 쪽) */
export function connect(d: Diagram, a: string, b: string): Diagram {
  if (a === b) return d;
  if (d.edges.some((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a))) return d;
  const na = d.nodes.find((n) => n.id === a);
  const nb = d.nodes.find((n) => n.id === b);
  if (!na || !nb) return d;
  return touch(d, { edges: [...d.edges, { id: newId('e'), from: a, to: b }] });
}

export function removeEdge(d: Diagram, id: string): Diagram {
  return touch(d, { edges: d.edges.filter((e) => e.id !== id) });
}

export function reverseEdge(d: Diagram, id: string): Diagram {
  return touch(d, { edges: d.edges.map((e) => (e.id === id ? { ...e, from: e.to, to: e.from } : e)) });
}

const mapItems = (d: Diagram, node: string, f: (items: PanelItem[]) => PanelItem[]): Diagram =>
  touch(d, { nodes: d.nodes.map((n) => (n.id === node && n.kind === 'panel' ? { ...n, items: f(n.items ?? []) } : n)) });

export const addItem = (d: Diagram, node: string, eq: string) => mapItems(d, node, (items) => [...items, { id: newId('i'), eq }]);
export const removeItem = (d: Diagram, node: string, item: string) => mapItems(d, node, (items) => items.filter((i) => i.id !== item));
export const updateItem = (d: Diagram, node: string, item: string, patch: Partial<PanelItem>) =>
  mapItems(d, node, (items) => items.map((i) => (i.id === item ? { ...i, ...patch } : i)));
export const setItemQty = (d: Diagram, node: string, item: string, qty: number) => {
  const q = clampQty(qty);
  return mapItems(d, node, (items) => items.map((i) => (i.id === item ? { ...i, qty: q > 1 ? q : undefined } : i)));
};
export function moveItem(d: Diagram, node: string, item: string, dir: -1 | 1): Diagram {
  return mapItems(d, node, (items) => {
    const i = items.findIndex((x) => x.id === item);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= items.length) return items;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
}

/** 선 가운데에 기기 넣기 (변압기·ATS) — 위·아래 상자 사이로, 아래쪽 상자들은 자리를 내준다 */
export function insertBetween(d: Diagram, edgeId: string, eq: string, hv?: DNode['hv'], lv?: DNode['lv']): Diagram {
  const e = d.edges.find((x) => x.id === edgeId);
  if (!e) return d;
  const a = d.nodes.find((n) => n.id === e.from)!;
  const b = d.nodes.find((n) => n.id === e.to)!;
  const sa = nodeSize(a);
  const n = makeNode('equipment', 0, 0, eq);
  if (isTransformer(eq)) Object.assign(n, { hv: hv ?? n.hv, lv: lv ?? n.lv });
  else n.v = lv ?? a.v ?? b.v ?? n.v;
  const sn = nodeSize(n);
  const ax = a.kind === 'bus' ? b.x + nodeSize(b).w / 2 : a.x + sa.w / 2;
  n.x = snap(ax - sn.w / 2);
  n.y = snap(a.y + sa.h + 40);
  // 새 상자 자리만큼 아래 상자들을 내린다 (새 상자 아래 끝 + 40 보다 위에 있는 b 와 그 아래)
  const shift = Math.max(0, n.y + sn.h + 40 - b.y);
  const nodes = d.nodes.map((x) => (shift && x.y >= b.y ? { ...x, y: x.y + shift } : x));
  return touch(d, {
    nodes: [...nodes, n],
    edges: [...d.edges.filter((x) => x.id !== edgeId), { id: newId('e'), from: a.id, to: n.id }, { id: newId('e'), from: n.id, to: b.id }],
  });
}

export function applyDFix(d: Diagram, f: DFix): Diagram {
  switch (f.type) {
    case 'setProduct':
      return f.item ? updateItem(d, f.node, f.item, { product: f.product }) : updateNode(d, f.node, { product: f.product });
    case 'setItemEq':
      return updateItem(d, f.node, f.item, { eq: f.eq, product: undefined });
    case 'addItem':
      return addItem(d, f.node, f.eq);
    case 'removeItem':
      return removeItem(d, f.node, f.item);
    case 'insertBetween':
      return insertBetween(d, f.edge, f.eq, f.hv, f.lv);
  }
}

/* ── 제품 목록 ─────────────────────────────────────────── */

export interface DBomRow {
  key: string;
  where: string;
  equipment: string;
  coverage: string;
  product: string;
  rating: string;
  qty: number;
}

const RATING_KEYS = ['ratedVoltage', 'ratedCurrent', 'capacity', 'breakingCapacity'];
function ratingText(productId: string | undefined, specs?: SpecsMap): string {
  const s = productId ? specs?.get(productId) : undefined;
  if (!s) return '';
  const seen = new Set<string>();
  return [...s.items, ...(s.variants?.[0]?.items ?? [])]
    .filter((i) => RATING_KEYS.includes(i.key))
    .filter((i) => (seen.has(i.key) ? false : (seen.add(i.key), true)))
    .slice(0, 2)
    .map((i) => `${i.label} ${i.value.replace(/\s*\([^)]*\)/g, '')}${i.unit ? ` ${i.unit}` : ''}`)
    .join(' · ');
}

export function diagramBom(d: Diagram, specs?: SpecsMap): DBomRow[] {
  const data = getData();
  const rows: DBomRow[] = [];
  const add = (key: string, where: string, eq: string, product: string | undefined, qty: number, extra = '') => {
    const e = data.equipmentTypeById.get(eq);
    if (!e) return;
    const p = product ? data.productById.get(product) : undefined;
    rows.push({
      key,
      where,
      equipment: eqName(eq) + extra,
      coverage: COVERAGE_LABELS[e.coverage],
      product: p?.name ?? (e.coverage === 'owned' || e.coverage === 'partial' ? '(제품 미선택)' : '자사 제품 없음'),
      rating: ratingText(product, specs),
      qty,
    });
  };
  const sorted = [...d.nodes].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const n of sorted) {
    if (!n.eq) continue;
    const where = nodeTitle(n);
    const extra = n.kind === 'equipment' && isTransformer(n.eq) ? ` ${voltageLabel(n.hv)}/${voltageLabel(n.lv)} ${n.kVA ?? ''}kVA` : n.kind === 'panel' ? ' (함체)' : '';
    add(n.id, where, n.eq, n.product, n.qty ?? 1, extra);
    for (const it of n.items ?? []) add(`${n.id}:${it.id}`, where, it.eq, it.product, it.qty ?? 1);
  }
  return rows;
}

export function diagramBomCsv(d: Diagram, rows: DBomRow[], today: string): string {
  const head = [[`단선도 — ${d.name}`], [`기준일 ${today} · 상자 ${d.nodes.length} · 선 ${d.edges.length}`], [DISCLAIMER], [], ['위치', '기기', '보유 상태', '선택 제품', '대표 정격', '수량']];
  const body = rows.map((r) => [r.where, r.equipment, r.coverage, r.product, r.rating, String(r.qty)]);
  return '﻿' + [...head, ...body].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/**
 * 비어 있는 제품을 정격이 맞는 자사 제품으로 채우기 — 상자 전압(변압기는 1차) 이상, 정격 정보가 있는 제품 먼저.
 * 변압기 아래 저압반 주차단기(ACB)는 변압기 2차 정격전류·단락전류까지 맞는 제품·옵션.
 */
export function fillProducts(d: Diagram, specs?: SpecsMap): Diagram {
  if (!specs) return d;
  const pick = (eq: string, v: DNode['v'], needA?: number, needKA?: number): string | undefined => {
    const vo = voltageOf(v);
    const list = candidateProducts(eq);
    const ok = list.filter((p) => {
      const s = specs.get(p.id);
      if (!s) return false;
      if (isInstrumentProduct(p.id)) return true;
      const r = productRatings(s);
      const kv = maxOf(r.kV);
      if (vo && !vo.dc && kv !== undefined && kv < vo.kV * 0.95) return false;
      if (needA !== undefined && (maxOf(r.A) ?? Infinity) < needA) return false;
      if (needKA !== undefined && (maxOf(r.kA) ?? Infinity) < needKA) return false;
      return true;
    });
    return ok[0]?.id ?? list.find((p) => !specs.has(p.id))?.id;
  };
  let changed = false;
  const nodes = d.nodes.map((n) => {
    if (!n.eq || (n.kind !== 'equipment' && n.kind !== 'panel')) return n;
    let next = n;
    if (!n.product) {
      const pid = pick(n.eq, isTransformer(n.eq) ? n.hv : n.v);
      if (pid) next = { ...next, product: pid };
    }
    if (n.kind === 'panel' && n.items?.some((i) => !i.product)) {
      const pt = panelTypeById(n.eq);
      const tr = upstreamTransformer(d, n.id);
      const lv = tr?.lv ? voltageOf(tr.lv) : undefined;
      const need = tr?.kVA && lv && !lv.dc ? { a: trSecondaryA(tr.kVA, lv.kV), ka: trShortCircuitKA(tr.kVA, lv.kV, tr.pctZ ?? 6) } : undefined;
      const mainId = n.items.find((i) => pt?.main.includes(i.eq))?.id;
      next = { ...next, items: n.items.map((i) => (i.product ? i : { ...i, product: pick(i.eq, n.v, i.id === mainId && pt?.id === 'lv-swgr' ? need?.a : undefined, i.id === mainId && pt?.id === 'lv-swgr' ? need?.ka : undefined) })) };
    }
    if (next !== n) changed = true;
    return next;
  });
  return changed ? touch(d, { nodes }) : d;
}

export { TRANSFORMERS };
