/**
 * 계통 구성 공유 링크 — 구성(Build)을 주소 한 줄(#/builder?b=…)에 담는다. 서버 저장 없음.
 * 담는 것: 템플릿·칸별 기기·제품·추가 칸·변압기 용량/%Z. 읽을 때는 지금 템플릿·기기 목록에 없는 값은 버린다.
 */
import { getData } from '../../data/load';
import { templateById } from './templates';
import type { Build, Extra, Placement } from './validate';

interface Packed {
  v: 1;
  t: string;
  s: Record<string, [string, string?]>;
  x: [string, string, string, string?][];
  p: [number, number];
}

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

export function encodeBuild(b: Build): string {
  const s: Packed['s'] = {};
  for (const [id, p] of Object.entries(b.slots)) if (p.eq) s[id] = p.product ? [p.eq, p.product] : [p.eq];
  const packed: Packed = {
    v: 1,
    t: b.template,
    s,
    x: b.extras.map((e) => (e.product ? [e.id, e.row, e.eq, e.product] : [e.id, e.row, e.eq])),
    p: [b.params.kVA, b.params.pctZ],
  };
  return toBase64Url(JSON.stringify(packed));
}

/** 공유 코드 → 구성. 읽을 수 없거나 템플릿이 없으면 null */
export function decodeBuild(code: string): Build | null {
  let v: Packed;
  try {
    v = JSON.parse(fromBase64Url(code)) as Packed;
  } catch {
    return null;
  }
  if (!v || v.v !== 1 || typeof v.t !== 'string') return null;
  const t = templateById(v.t);
  if (!t) return null;
  const d = getData();
  const slotIds = new Set(t.rows.flatMap((r) => r.slots.map((s) => s.id)));
  const rowIds = new Set(t.rows.filter((r) => r.addable).map((r) => r.id));
  const okEq = (id: unknown): id is string => typeof id === 'string' && d.equipmentTypeById.has(id);
  const okProduct = (id: unknown): id is string => typeof id === 'string' && d.productById.has(id);
  const slots: Record<string, Placement> = {};
  for (const [id, pair] of Object.entries(v.s ?? {})) {
    if (!slotIds.has(id) || !Array.isArray(pair) || !okEq(pair[0])) continue;
    slots[id] = okProduct(pair[1]) ? { eq: pair[0], product: pair[1] } : { eq: pair[0] };
  }
  const extras: Extra[] = [];
  for (const e of Array.isArray(v.x) ? v.x.slice(0, 40) : []) {
    if (!Array.isArray(e) || typeof e[0] !== 'string' || !rowIds.has(e[1]) || !okEq(e[2])) continue;
    extras.push(okProduct(e[3]) ? { id: e[0], row: e[1], eq: e[2], product: e[3] } : { id: e[0], row: e[1], eq: e[2] });
  }
  const num = (n: unknown, def: number, min: number, max: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def);
  const [kVA, pctZ] = Array.isArray(v.p) ? v.p : [];
  return {
    template: t.id,
    slots,
    extras,
    params: { kVA: num(kVA, t.params.kVA, 1, 100000), pctZ: num(pctZ, t.params.pctZ, 0.5, 20) },
  };
}

/** 지금 주소 기준 공유 링크 (HashRouter) */
export function shareUrl(b: Build): string {
  return `${location.origin}${location.pathname}#/builder?b=${encodeBuild(b)}`;
}
