/**
 * 단선도 공유 링크 — 단선도(상자·선·반 안 구성)를 주소 한 줄(#/builder?d=…)에 담는다. 서버 저장 없음.
 * 받는 쪽은 자기 단선도 목록에 '사본'으로 추가된다 (원래 단선도는 그대로).
 * 읽을 때 모르는 기기·전압·반 종류는 버리고 숫자는 범위 안으로 자른다.
 */
import { getData } from '../../data/load';
import { clampQty } from '../builder/validate';
import { CABLE_SIZES } from './cable';
import { NO_LOAD_EQ } from './load';
import { CANVAS_H, CANVAS_W, VOLTAGES, emptyDiagram, feederSource, newId, panelTypeById, type DEdge, type DNode, type Diagram, type PanelItem, type VoltageId } from './model';

const KINDS: DNode['kind'][] = ['source', 'bus', 'equipment', 'panel'];
const MAX_NODES = 300;

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(code: string): string {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** 짧게: 상자 [kind번호, x, y, eq, product, v, label, qty, hv, lv, kVA, pctZ, w, items[[eq, product, qty]]] */
type PackedItem = [string, string?, number?, string?, number?, number?, string?, number?, string?, number?, number?];
type PackedNode = [number, number, number, string?, string?, string?, string?, number?, string?, string?, number?, number?, number?, PackedItem[]?, number?, number?, number?];

export function encodeDiagram(d: Diagram): string {
  const idx = new Map(d.nodes.map((n, i) => [n.id, i]));
  const nodes: PackedNode[] = d.nodes.map((n) => {
    const p: PackedNode = [KINDS.indexOf(n.kind), n.x, n.y, n.eq ?? '', n.product ?? '', n.v ?? '', n.label ?? '', n.qty ?? 0, n.hv ?? '', n.lv ?? '', n.kVA ?? 0, n.pctZ ?? 0, n.w ?? 0, (n.items ?? []).map((i) => [i.eq, i.product ?? '', i.qty ?? 0, i.variant ?? '', i.amps ?? 0, i.poles ?? 0, i.name ?? '', i.loadKW ?? 0, i.phase ?? '', i.cable ?? 0, i.lengthM ?? 0] as PackedItem), n.loadKW ?? 0, n.demand ?? 0, n.h ?? 0];
    // 끝의 빈 값은 잘라 짧게
    while (p.length > 3) {
      const last = p[p.length - 1];
      if (last === '' || last === 0 || (Array.isArray(last) && !last.length)) p.pop();
      else break;
    }
    return p;
  });
  const edges = d.edges
    .map((e) => {
      const from = feederSource(d, e);
      const fi = e.feeder ? (from?.items ?? []).findIndex((i) => i.id === e.feeder) : -1;
      const p: (number | undefined)[] = [idx.get(e.from), idx.get(e.to), e.cable ?? 0, e.lengthM ?? 0, fi];
      while (p.length > 2 && (p[p.length - 1] === 0 || p[p.length - 1] === -1)) p.pop();
      return p;
    })
    .filter((x): x is number[] => x[0] !== undefined && x[1] !== undefined);
  return toBase64Url(JSON.stringify({ v: 1, n: d.name, s: nodes, e: edges, ...(d.vdLimit ? { l: d.vdLimit } : {}) }));
}

const okVoltage = (v: unknown): v is VoltageId => typeof v === 'string' && VOLTAGES.some((x) => x.id === v);
const num = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined);

/** 공유 코드 → 새 단선도(사본). 읽을 수 없으면 null */
export function decodeDiagram(code: string, opts: { suffix?: string; loose?: boolean } = {}): Diagram | null {
  const L = opts.loose ? { nodes: MAX_NODES, items: 300, label: 60, name: 60 } : { nodes: MAX_NODES, items: 60, label: 30, name: 34 };
  /** 상자별 원래 품목 순번 → 새 품목 id (피더 순번 맞추기) */
  const itemIdx = new Map<string, Map<number, string>>();
  let v: { v: number; n?: unknown; s?: unknown; e?: unknown; l?: unknown };
  try {
    v = JSON.parse(fromBase64Url(code));
  } catch {
    return null;
  }
  if (!v || v.v !== 1 || !Array.isArray(v.s) || !Array.isArray(v.e)) return null;
  const data = getData();
  const okEq = (id: unknown): id is string => typeof id === 'string' && data.equipmentTypeById.has(id);
  const okProduct = (id: unknown): id is string => typeof id === 'string' && data.productById.has(id);
  const suffix = opts.suffix ?? ' (공유)';
  const d = emptyDiagram(typeof v.n === 'string' && v.n.trim() ? `${v.n.trim().slice(0, L.name)}${suffix}` : '공유받은 단선도');
  const ids: (string | null)[] = [];
  for (const raw of (v.s as unknown[]).slice(0, L.nodes)) {
    if (!Array.isArray(raw)) {
      ids.push(null);
      continue;
    }
    const [k, x, y, eq, product, volt, label, qty, hv, lv, kVA, pctZ, w, items, loadKW, demand, h] = raw as PackedNode;
    const kind = KINDS[k as number];
    if (!kind || (kind === 'equipment' && !okEq(eq)) || (kind === 'panel' && !panelTypeById(eq))) {
      ids.push(null);
      continue;
    }
    const n: DNode = { id: newId(kind[0]), kind, x: num(x, 0, CANVAS_W - 100) ?? 0, y: num(y, 0, CANVAS_H - 60) ?? 0 };
    if (kind === 'equipment' || kind === 'panel') n.eq = eq;
    if (okProduct(product)) n.product = product;
    if (okVoltage(volt)) n.v = volt;
    if (typeof label === 'string' && label.trim()) n.label = label.trim().slice(0, L.label);
    const q = clampQty(qty);
    if (kind === 'equipment' && q > 1) n.qty = q;
    if (okVoltage(hv)) n.hv = hv;
    if (okVoltage(lv)) n.lv = lv;
    const kva = num(kVA, 1, 2_000_000);
    if (kva && kVA) n.kVA = kva;
    const z = num(pctZ, 0.5, 20);
    if (z && pctZ) n.pctZ = z;
    if (kind === 'bus') n.w = num(w, 160, 2000) ?? 420;
    else {
      const ww = num(w, 100, 640);
      if (ww && w) n.w = ww;
      const hh = num(h, 48, 480);
      if (hh && h) n.h = hh;
    }
    const lk = num(loadKW, 0.01, 1_000_000);
    if (kind === 'equipment' && lk && loadKW) n.loadKW = lk;
    const dm = num(demand, 0.1, 1);
    if (kind === 'panel' && dm && demand && dm < 1) n.demand = dm;
    if (kind === 'panel') {
      const map = new Map<number, string>();
      n.items = (Array.isArray(items) ? items : [])
        .slice(0, L.items)
        .map((i, origIdx) => ({ i, origIdx }))
        .filter((x): x is { i: PackedItem; origIdx: number } => Array.isArray(x.i) && okEq(x.i[0]))
        .map(({ i, origIdx }): PanelItem => {
          const amps = num(i[4], 0.1, 10000);
          const poles = [1, 2, 3, 4].includes(i[5] as number) ? (i[5] as 1 | 2 | 3 | 4) : undefined;
          const id = newId('i');
          map.set(origIdx, id);
          return {
            id,
            eq: i[0],
            ...(okProduct(i[1]) ? { product: i[1] } : {}),
            ...(clampQty(i[2]) > 1 ? { qty: clampQty(i[2]) } : {}),
            ...(typeof i[3] === 'string' && i[3] && okProduct(i[1]) ? { variant: i[3].slice(0, 60) } : {}),
            ...(amps && i[4] ? { amps } : {}),
            ...(poles ? { poles } : {}),
            ...(typeof i[6] === 'string' && i[6].trim() ? { name: i[6].trim().slice(0, 30) } : {}),
            ...(num(i[7], 0.01, 100000) && i[7] && !NO_LOAD_EQ.has(i[0]) ? { loadKW: num(i[7], 0.01, 100000) } : {}),
            ...(i[8] === 'R' || i[8] === 'S' || i[8] === 'T' ? { phase: i[8] } : {}),
            ...(typeof i[9] === 'number' && CABLE_SIZES.some((c) => c.mm2 === i[9]) ? { cable: i[9] } : {}),
            ...(num(i[10], 0.1, 5000) && i[10] ? { lengthM: num(i[10], 0.1, 5000) } : {}),
          };
        });
      itemIdx.set(n.id, map);
    }
    d.nodes.push(n);
    ids.push(n.id);
  }
  const pendingFeeder: { edge: DEdge; idx: number }[] = [];
  for (const e of (v.e as unknown[]).slice(0, MAX_NODES * 4)) {
    if (!Array.isArray(e)) continue;
    const a = ids[e[0] as number];
    const b = ids[e[1] as number];
    if (!a || !b || a === b || d.edges.some((x) => x.from === a && x.to === b)) continue;
    const edge: DEdge = { id: newId('e'), from: a, to: b };
    if (typeof e[2] === 'number' && CABLE_SIZES.some((c) => c.mm2 === e[2])) edge.cable = e[2];
    const len = num(e[3], 0.1, 5000);
    if (len && e[3]) edge.lengthM = len;
    d.edges.push(edge);
    if (typeof e[4] === 'number') pendingFeeder.push({ edge, idx: e[4] });
  }
  // 피더는 모든 선을 넣은 뒤에 (모선 → 반 선이 반 → 모선 선보다 먼저 와도 보내는 반을 찾게)
  for (const { edge, idx } of pendingFeeder) {
    const fromNode = feederSource(d, edge);
    const fid = fromNode ? itemIdx.get(fromNode.id)?.get(idx) : undefined;
    if (fid) edge.feeder = fid;
  }
  if (typeof v.l === 'number' && [3, 5, 6, 8].includes(v.l)) d.vdLimit = v.l;
  return d;
}

export function diagramShareUrl(d: Diagram): string {
  return `${location.origin}${location.pathname}#/builder?d=${encodeDiagram(d)}`;
}

/** 단선도 파일 (.json) — 사람이 읽을 수 있는 원본 + 검증된 공유 코드. 불러올 때는 코드로 되살려 같은 검증을 거친다 */
export const FILE_FORMAT = 'lse-draw';
export const FILE_VERSION = 1;

export function diagramFile(d: Diagram): string {
  return JSON.stringify({ format: FILE_FORMAT, version: FILE_VERSION, savedAt: new Date().toISOString(), name: d.name, vdLimit: d.vdLimit, code: encodeDiagram(d), diagram: d }, null, 2);
}

/** 파일 내용 → 단선도. 형식이 다르거나 더 새 버전이면 null */
export function readDiagramFile(text: string): Diagram | null {
  try {
    const v = JSON.parse(text) as { format?: string; version?: number; code?: string };
    if (v?.format !== FILE_FORMAT || typeof v.version !== 'number' || v.version > FILE_VERSION || typeof v.code !== 'string') return null;
    const fromCode = decodeDiagram(v.code, { suffix: '', loose: true });
    if (!fromCode) return null;
    const lim = (v as { vdLimit?: unknown }).vdLimit;
    if (typeof lim === 'number' && [3, 5, 6, 8].includes(lim)) fromCode.vdLimit = lim;
    return fromCode;
  } catch {
    return null;
  }
}
