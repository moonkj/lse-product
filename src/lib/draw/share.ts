/**
 * 단선도 공유 링크 — 단선도(상자·선·반 안 구성)를 주소 한 줄(#/builder?d=…)에 담는다. 서버 저장 없음.
 * 받는 쪽은 자기 단선도 목록에 '사본'으로 추가된다 (원래 단선도는 그대로).
 * 읽을 때 모르는 기기·전압·반 종류는 버리고 숫자는 범위 안으로 자른다.
 */
import { getData } from '../../data/load';
import { clampQty } from '../builder/validate';
import { CANVAS_H, CANVAS_W, VOLTAGES, emptyDiagram, newId, panelTypeById, type DNode, type Diagram, type PanelItem, type VoltageId } from './model';

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
type PackedItem = [string, string?, number?, string?, number?, number?, string?, number?, string?];
type PackedNode = [number, number, number, string?, string?, string?, string?, number?, string?, string?, number?, number?, number?, PackedItem[]?];

export function encodeDiagram(d: Diagram): string {
  const idx = new Map(d.nodes.map((n, i) => [n.id, i]));
  const nodes: PackedNode[] = d.nodes.map((n) => {
    const p: PackedNode = [KINDS.indexOf(n.kind), n.x, n.y, n.eq ?? '', n.product ?? '', n.v ?? '', n.label ?? '', n.qty ?? 0, n.hv ?? '', n.lv ?? '', n.kVA ?? 0, n.pctZ ?? 0, n.w ?? 0, (n.items ?? []).map((i) => [i.eq, i.product ?? '', i.qty ?? 0, i.variant ?? '', i.amps ?? 0, i.poles ?? 0, i.name ?? '', i.loadKW ?? 0, i.phase ?? ''] as PackedItem)];
    // 끝의 빈 값은 잘라 짧게
    while (p.length > 3) {
      const last = p[p.length - 1];
      if (last === '' || last === 0 || (Array.isArray(last) && !last.length)) p.pop();
      else break;
    }
    return p;
  });
  const edges = d.edges.map((e) => [idx.get(e.from), idx.get(e.to)]).filter((x): x is [number, number] => x[0] !== undefined && x[1] !== undefined);
  return toBase64Url(JSON.stringify({ v: 1, n: d.name, s: nodes, e: edges }));
}

const okVoltage = (v: unknown): v is VoltageId => typeof v === 'string' && VOLTAGES.some((x) => x.id === v);
const num = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined);

/** 공유 코드 → 새 단선도(사본). 읽을 수 없으면 null */
export function decodeDiagram(code: string): Diagram | null {
  let v: { v: number; n?: unknown; s?: unknown; e?: unknown };
  try {
    v = JSON.parse(fromBase64Url(code));
  } catch {
    return null;
  }
  if (!v || v.v !== 1 || !Array.isArray(v.s) || !Array.isArray(v.e)) return null;
  const data = getData();
  const okEq = (id: unknown): id is string => typeof id === 'string' && data.equipmentTypeById.has(id);
  const okProduct = (id: unknown): id is string => typeof id === 'string' && data.productById.has(id);
  const d = emptyDiagram(typeof v.n === 'string' && v.n.trim() ? `${v.n.trim().slice(0, 34)} (공유)` : '공유받은 단선도');
  const ids: (string | null)[] = [];
  for (const raw of (v.s as unknown[]).slice(0, MAX_NODES)) {
    if (!Array.isArray(raw)) {
      ids.push(null);
      continue;
    }
    const [k, x, y, eq, product, volt, label, qty, hv, lv, kVA, pctZ, w, items] = raw as PackedNode;
    const kind = KINDS[k as number];
    if (!kind || (kind === 'equipment' && !okEq(eq)) || (kind === 'panel' && !panelTypeById(eq))) {
      ids.push(null);
      continue;
    }
    const n: DNode = { id: newId(kind[0]), kind, x: num(x, 0, CANVAS_W - 100) ?? 0, y: num(y, 0, CANVAS_H - 60) ?? 0 };
    if (kind === 'equipment' || kind === 'panel') n.eq = eq;
    if (okProduct(product)) n.product = product;
    if (okVoltage(volt)) n.v = volt;
    if (typeof label === 'string' && label.trim()) n.label = label.trim().slice(0, 30);
    const q = clampQty(qty);
    if (kind === 'equipment' && q > 1) n.qty = q;
    if (okVoltage(hv)) n.hv = hv;
    if (okVoltage(lv)) n.lv = lv;
    const kva = num(kVA, 1, 2_000_000);
    if (kva && kVA) n.kVA = kva;
    const z = num(pctZ, 0.5, 20);
    if (z && pctZ) n.pctZ = z;
    if (kind === 'bus') n.w = num(w, 160, 2000) ?? 420;
    if (kind === 'panel')
      n.items = (Array.isArray(items) ? items : [])
        .slice(0, 60)
        .filter((i): i is PackedItem => Array.isArray(i) && okEq(i[0]))
        .map((i): PanelItem => {
          const amps = num(i[4], 0.1, 10000);
          const poles = [1, 2, 3, 4].includes(i[5] as number) ? (i[5] as 1 | 2 | 3 | 4) : undefined;
          return {
            id: newId('i'),
            eq: i[0],
            ...(okProduct(i[1]) ? { product: i[1] } : {}),
            ...(clampQty(i[2]) > 1 ? { qty: clampQty(i[2]) } : {}),
            ...(typeof i[3] === 'string' && i[3] && okProduct(i[1]) ? { variant: i[3].slice(0, 60) } : {}),
            ...(amps && i[4] ? { amps } : {}),
            ...(poles ? { poles } : {}),
            ...(typeof i[6] === 'string' && i[6].trim() ? { name: i[6].trim().slice(0, 30) } : {}),
            ...(num(i[7], 0.01, 100000) && i[7] ? { loadKW: num(i[7], 0.01, 100000) } : {}),
            ...(i[8] === 'R' || i[8] === 'S' || i[8] === 'T' ? { phase: i[8] } : {}),
          };
        });
    d.nodes.push(n);
    ids.push(n.id);
  }
  for (const e of v.e as unknown[]) {
    if (!Array.isArray(e)) continue;
    const a = ids[e[0] as number];
    const b = ids[e[1] as number];
    if (a && b && a !== b && !d.edges.some((x) => x.from === a && x.to === b)) d.edges.push({ id: newId('e'), from: a, to: b });
  }
  return d;
}

export function diagramShareUrl(d: Diagram): string {
  return `${location.origin}${location.pathname}#/builder?d=${encodeDiagram(d)}`;
}
