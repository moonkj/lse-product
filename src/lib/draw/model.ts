/**
 * 단선도 그리기 (계통 구성 2026-11-26 3차 고도화) — 데이터 모델.
 * 단선도(Diagram) = 상자(node) + 선(edge). 상자 종류:
 *  - source  : 전원(한전 수전·발전 인입) — 전압만 가짐
 *  - bus     : 모선 — 가로 막대, 여러 선이 붙음
 *  - equipment: 기기 하나 (VCB·변압기·발전기…). 변압기는 1차/2차 전압·용량(kVA)·%Z
 *  - panel   : 반(배전반·수배전반·분전반·MCC) — 안에 품목(items)을 담는다
 * 선은 위(from, 전원 쪽) → 아래(to, 부하 쪽) 방향. 변압기는 from 쪽에 붙으면 2차, to 쪽에 붙으면 1차.
 */
import { getData } from '../../data/load';
import type { Layer } from '../schema';

/** 전압 단계 id — 'dc0.8' 은 800V DC */
export type VoltageId = '345' | '154' | '22.9' | '6.6' | '3.3' | '0.38' | '0.22' | 'dc0.8';
export const VOLTAGES: { id: VoltageId; label: string; kV: number; dc?: boolean }[] = [
  { id: '345', label: '345kV', kV: 345 },
  { id: '154', label: '154kV', kV: 154 },
  { id: '22.9', label: '22.9kV', kV: 22.9 },
  { id: '6.6', label: '6.6kV', kV: 6.6 },
  { id: '3.3', label: '3.3kV', kV: 3.3 },
  { id: '0.38', label: '380V', kV: 0.38 },
  { id: '0.22', label: '220V', kV: 0.22 },
  { id: 'dc0.8', label: '800V DC', kV: 0.8, dc: true },
];
export const voltageOf = (id: VoltageId | undefined | null) => VOLTAGES.find((v) => v.id === id);
export const voltageLabel = (id: VoltageId | undefined | null) => voltageOf(id)?.label ?? '전압 없음';
/** 같은 계통으로 보는 전압 (380/220V 는 한 계통) */
export function sameSystem(a: VoltageId, b: VoltageId): boolean {
  if (a === b) return true;
  const low = new Set<VoltageId>(['0.38', '0.22']);
  return low.has(a) && low.has(b);
}

export interface PanelItem {
  id: string;
  eq: string;
  product?: string;
  qty?: number;
}

export interface DNode {
  id: string;
  kind: 'source' | 'bus' | 'equipment' | 'panel';
  x: number;
  y: number;
  /** 사용자가 붙인 이름 (없으면 기기 이름) */
  label?: string;
  /** 기기 id (equipment) 또는 반 종류 id (panel = mv-swgr·lv-swgr·panelboard·mcc) */
  eq?: string;
  product?: string;
  qty?: number;
  /** 이 상자의 전압 (변압기는 hv/lv 를 씀) */
  v?: VoltageId;
  hv?: VoltageId;
  lv?: VoltageId;
  kVA?: number;
  pctZ?: number;
  /** 모선 길이(px) */
  w?: number;
  items?: PanelItem[];
}

export interface DEdge {
  id: string;
  from: string;
  to: string;
}

export interface Diagram {
  id: string;
  name: string;
  nodes: DNode[];
  edges: DEdge[];
  updatedAt: string;
}

export const GRID = 20;
export const snap = (n: number) => Math.round(n / GRID) * GRID;
export const NODE_W = 150;
export const NODE_H = 92;
export const PANEL_W = 190;
export const PANEL_H = 112;
export const BUS_H = 14;
export const BUS_W = 420;
export const SOURCE_W = 150;
export const SOURCE_H = 56;
export const CANVAS_W = 2400;
export const CANVAS_H = 1800;

export function nodeSize(n: DNode): { w: number; h: number } {
  if (n.kind === 'bus') return { w: n.w ?? BUS_W, h: BUS_H };
  if (n.kind === 'panel') return { w: PANEL_W, h: PANEL_H };
  if (n.kind === 'source') return { w: SOURCE_W, h: SOURCE_H };
  return { w: NODE_W, h: NODE_H };
}

/** 변압기 기기 — 기본 1차/2차 전압 */
export const TRANSFORMERS: Record<string, { hv: VoltageId; lv: VoltageId; kVA: number }> = {
  'cast-tr': { hv: '22.9', lv: '0.38', kVA: 1000 },
  'oil-tr': { hv: '22.9', lv: '0.38', kVA: 1000 },
  'pole-tr': { hv: '22.9', lv: '0.22', kVA: 100 },
  'main-tr': { hv: '154', lv: '22.9', kVA: 60000 },
  'step-up-tr': { hv: '22.9', lv: '345', kVA: 500000 },
  sst: { hv: '22.9', lv: 'dc0.8', kVA: 1000 },
};
export const isTransformer = (eq?: string) => !!eq && eq in TRANSFORMERS;

/** 선에 붙지 않는 기기 (계전기·계측기·감시 시스템) — 전압·연결 확인을 하지 않음 */
const OFF_LINE = new Set(['protection-relay', 'relay-tx', 'power-meter', 'meter', 'dmc', 'smart-device', 'sas', 'hmi', 'plc', 'servo', 'gearbox', 'care']);
export const isOffLine = (eq?: string) => !!eq && (OFF_LINE.has(eq) || getData().equipmentTypeById.get(eq)?.layer === 'MON');

/** 기기 기본 전압 — 계층 기준, 몇몇 기기는 따로 */
const EQ_VOLTAGE: Record<string, VoltageId | null> = {
  generator: '22.9',
  'emergency-gen': '0.38',
  'transmission-line': '345',
  'ehv-gis': '345',
  'la-ehv': '345',
  'ct-pt-ehv': '345',
  hvdc: '345',
  facts: '345',
  'dc-devices': 'dc0.8',
  sscb: 'dc0.8',
  'dc-dc': 'dc0.8',
  ess: 'dc0.8',
  pcs: 'dc0.8',
  pv: 'dc0.8',
  'it-rack': '0.38',
  'lighting-outlet': '0.22',
  panelboard: '0.38',
  microgrid: null,
  'modular-substation': null,
  railway: null,
};
const LAYER_VOLTAGE: Partial<Record<Layer, VoltageId>> = { L1: '345', L2: '154', L3: '22.9', L4: '22.9', L6: '0.38', L7: '0.38' };

export function defaultVoltage(eq: string): VoltageId | undefined {
  if (eq in EQ_VOLTAGE) return EQ_VOLTAGE[eq] ?? undefined;
  if (isOffLine(eq)) return undefined;
  const layer = getData().equipmentTypeById.get(eq)?.layer;
  return layer ? LAYER_VOLTAGE[layer] : undefined;
}

/** 반 종류 — 안에 넣을 수 있는 기기·주차단기·기본 구성 */
export interface PanelType {
  id: string;
  label: string;
  v: VoltageId;
  main: string[];
  accepts: string[];
  defaults: { eq: string; qty?: number }[];
  hint: string;
}
export const PANEL_TYPES: PanelType[] = [
  {
    id: 'mv-swgr',
    label: '특고압 수배전반',
    v: '22.9',
    main: ['vcb'],
    accepts: ['lbs', 'alts', 'la', 'mof', 'vcb', 'protection-relay', 'ct-pt', 'pf', 'vc-vi', 'meter', 'aps'],
    defaults: [{ eq: 'lbs' }, { eq: 'la' }, { eq: 'mof' }, { eq: 'vcb' }, { eq: 'protection-relay' }, { eq: 'ct-pt' }],
    hint: '22.9kV 수전 — 인입 개폐기·피뢰기·MOF·VCB·보호계전기',
  },
  {
    id: 'lv-swgr',
    label: '저압 배전반',
    v: '0.38',
    main: ['acb'],
    accepts: ['acb', 'mccb', 'busway', 'power-meter', 'spd', 'lv-ats', 'sag-protector', 'capacitor'],
    defaults: [{ eq: 'acb' }, { eq: 'mccb', qty: 4 }, { eq: 'power-meter' }, { eq: 'spd' }],
    hint: '변압기 2차 380V — 주차단기(ACB)·분기 MCCB·계측기·SPD',
  },
  {
    id: 'panelboard',
    label: '분전반',
    v: '0.38',
    main: ['branch-mccb', 'mccb'],
    accepts: ['branch-mccb', 'mccb', 'elcb', 'mcb-rcbo', 'spd', 'smart-device'],
    defaults: [{ eq: 'branch-mccb' }, { eq: 'elcb', qty: 6 }, { eq: 'mcb-rcbo', qty: 6 }],
    hint: '층·구역 380/220V — 분전반 주차단기·누전차단기·MCB',
  },
  {
    id: 'mcc',
    label: '전동기 제어반 (MCC)',
    v: '0.38',
    main: ['mccb', 'acb'],
    accepts: ['mccb', 'acb', 'mms', 'ms', 'empr', 'lv-drive', 'soft-starter', 'power-meter'],
    defaults: [{ eq: 'mccb' }, { eq: 'mms', qty: 4 }, { eq: 'ms', qty: 4 }, { eq: 'empr', qty: 4 }],
    hint: '전동기 피더 — 주 MCCB·MMS·전자개폐기·EMPR·인버터',
  },
];
export const panelTypeById = (id?: string) => PANEL_TYPES.find((p) => p.id === id);

let seq = 0;
export const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;

/** 새 상자 만들기 */
export function makeNode(kind: DNode['kind'], x: number, y: number, eq?: string): DNode {
  const base = { id: newId(kind[0]), kind, x: snap(x), y: snap(y) };
  if (kind === 'source') return { ...base, v: '22.9', label: '한전 수전' };
  if (kind === 'bus') return { ...base, v: '0.38', w: BUS_W };
  if (kind === 'panel') {
    const pt = panelTypeById(eq) ?? PANEL_TYPES[1];
    return { ...base, eq: pt.id, v: pt.v, items: pt.defaults.map((d) => ({ id: newId('i'), eq: d.eq, ...(d.qty && d.qty > 1 ? { qty: d.qty } : {}) })) };
  }
  const tr = eq ? TRANSFORMERS[eq] : undefined;
  if (tr) return { ...base, eq, hv: tr.hv, lv: tr.lv, kVA: tr.kVA, pctZ: 6 };
  return { ...base, eq, v: eq ? defaultVoltage(eq) : undefined };
}

export function emptyDiagram(name = '새 단선도'): Diagram {
  return { id: newId('d'), name, nodes: [], edges: [], updatedAt: new Date().toISOString() };
}

export function eqName(id?: string): string {
  if (!id) return '';
  const pt = panelTypeById(id);
  if (pt) return pt.label;
  const e = getData().equipmentTypeById.get(id);
  return e ? (e.abbr ? `${e.abbr} ${e.name}` : e.name) : id;
}

export function nodeTitle(n: DNode): string {
  if (n.label) return n.label;
  if (n.kind === 'bus') return `${voltageLabel(n.v)} 모선`;
  if (n.kind === 'source') return '전원';
  if (n.kind === 'panel') return panelTypeById(n.eq)?.label ?? '반';
  const e = n.eq ? getData().equipmentTypeById.get(n.eq) : undefined;
  return e?.name ?? '기기';
}

/** 선 양 끝에서 본 상자 전압 — 변압기는 선이 붙은 쪽(1차/2차) */
export function sideVoltage(n: DNode, side: 'out' | 'in'): VoltageId | undefined {
  if (n.kind === 'equipment' && isTransformer(n.eq)) return side === 'out' ? n.lv : n.hv;
  if (n.kind === 'equipment' && isOffLine(n.eq)) return undefined;
  return n.v;
}
