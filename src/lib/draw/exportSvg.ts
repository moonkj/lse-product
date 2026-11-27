/**
 * 단선도 그림 내보내기 — 캔버스와 같은 배치를 독립 SVG 한 장으로 (흰 바탕).
 * 기기 상자: 제품을 골랐고 사진이 있으면 제품 사진(데이터 URL 로 넣어 PNG·인쇄에도 나옴), 없으면 단선결선도 기호 (2026-11-27).
 * SVG 내려받기·PNG 변환·인쇄에 같이 쓴다. 아래에 제목·기준일·안내 문구 칸.
 */
import { eqLabel } from '../labels';
import { getData, productImageUrl } from '../../data/load';
import { symbolPath } from '../symbols';
import { DISCLAIMER } from '../builder/validate';
import { edgePath } from './geometry';
import { eqName, isOffLine, isTransformer, nodeSize, nodeTitle, voltageLabel, type DNode, type Diagram } from './model';
import type { DIssue } from './validate';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const FONT = "'Pretendard','Malgun Gothic','Apple SD Gothic Neo',sans-serif";

/** 한 줄에 들어갈 만큼 자르기 (대략 글자 폭) */
function clip(s: string, px: number, size: number): string {
  const max = Math.max(4, Math.floor(px / (size * 0.62)));
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
/** 여러 줄로 나누기 */
function wrap(s: string, px: number, size: number, lines: number): string[] {
  const max = Math.max(4, Math.floor(px / (size * 0.62)));
  const out: string[] = [];
  let rest = s;
  while (rest && out.length < lines) {
    if (rest.length <= max) {
      out.push(rest);
      break;
    }
    let cut = rest.lastIndexOf(' ', max);
    if (cut < max / 2) cut = max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest && out.length === lines && out.join(' ').length < s.length) out[lines - 1] = clip(out[lines - 1] + '…', px, size);
  return out;
}

/** 제품 id → 사진 데이터 URL */
export type ImageMap = ReadonlyMap<string, string>;

function nodeSvg(n: DNode, state?: 'error' | 'warn', imgs?: ImageMap): string {
  const { w, h } = nodeSize(n);
  const stroke = state === 'error' ? '#d92d20' : state === 'warn' ? '#dc8a00' : '#475467';
  const x = n.x;
  const y = n.y;
  const cx = x + w / 2;
  const title = nodeTitle(n);
  const p = n.product ? getData().productById.get(n.product) : undefined;
  const t = (tx: number, ty: number, s: string, size: number, opt = '') => `<text x="${tx}" y="${ty}" font-size="${size}" ${opt}>${esc(s)}</text>`;
  if (n.kind === 'bus') {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#101828"/>${t(x, y - 7, title, 15, 'font-weight="700"')}`;
  }
  if (n.kind === 'source') {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#eef2ff" stroke="${stroke}" stroke-width="1.5"/>${t(cx, y + h / 2 + 6, clip(`⚡ ${title}`, w - 16, 15), 15, 'text-anchor="middle" font-weight="700"')}`;
  }
  if (n.kind === 'panel') {
    const items = (n.items ?? []).map((i) => `${getData().equipmentTypeById.get(i.eq)?.abbr ?? eqName(i.eq)}${i.amps ? ` ${i.amps}A` : ''}${i.qty && i.qty > 1 ? `×${i.qty}` : ''}`).join(' · ');
    const lines = wrap(items || '안이 비어 있음', w - 20, 13, Math.max(1, Math.floor((h - 64) / 19)));
    return [
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#fff" stroke="${stroke}" stroke-width="2"/>`,
      `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="32" rx="5" fill="#f2f4f7"/>`,
      t(x + 10, y + 22, clip(title, w - 80, 15), 15, 'font-weight="700"'),
      t(x + w - 10, y + 22, voltageLabel(n.v), 13, 'text-anchor="end" fill="#667085"'),
      ...lines.map((l, i) => t(x + 10, y + 54 + i * 19, l, 13)),
      p ? t(x + 10, y + h - 11, clip(p.name, w - 20, 13), 13, 'fill="#1d4ed8"') : '',
    ].join('');
  }
  const e = n.eq ? getData().equipmentTypeById.get(n.eq) : undefined;
  const sub = isTransformer(n.eq) ? `${voltageLabel(n.hv)}/${voltageLabel(n.lv)} ${n.kVA ?? '-'}kVA` : isOffLine(n.eq) ? '신호·감시' : voltageLabel(n.v);
  const head = `${e ? eqLabel({ name: n.label ?? e.name, abbr: e.abbr }) : (n.label ?? title)}${n.qty && n.qty > 1 ? ` ×${n.qty}` : ''}`;
  // 상자 높이에 맞춰 기호·글자를 배치 (기본 210×140, 사용자가 키우면 같이 내려감)
  const k = Math.max(0.7, Math.min(1.6, h / 140));
  const sy = y + 30 * k;
  const photo = p ? imgs?.get(p.id) : undefined;
  const box = 40 * k;
  const symbol = photo
    ? `<image href="${photo}" x="${cx - box / 2}" y="${sy - box / 2}" width="${box}" height="${box}" preserveAspectRatio="xMidYMid meet"/>`
    : e
      ? `<g transform="translate(${cx - box / 2} ${sy - box / 2}) scale(${box / 72})"><path d="${symbolPath(e.category, e.id)}" fill="none" stroke="#101828" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>`
      : '';
  return [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#fff" stroke="${stroke}" stroke-width="1.5"/>`,
    symbol,
    t(cx, y + 76 * k, clip(head, w - 14, 15), 15, 'text-anchor="middle" font-weight="700"'),
    t(cx, y + 96 * k, clip(sub, w - 14, 13), 13, 'text-anchor="middle" fill="#667085"'),
    p ? t(cx, y + 116 * k, clip(p.name, w - 14, 13), 13, 'text-anchor="middle" fill="#1d4ed8"') : '',
  ].join('');
}

export function diagramSvg(d: Diagram, issues: DIssue[] = [], today = '', imgs?: ImageMap): string {
  const pad = 40;
  const footer = 70;
  const nodes = d.nodes;
  const minX = nodes.length ? Math.min(...nodes.map((n) => n.x)) - pad : 0;
  const minY = nodes.length ? Math.min(...nodes.map((n) => n.y)) - pad - 20 : 0;
  const maxX = nodes.length ? Math.max(...nodes.map((n) => n.x + nodeSize(n).w)) + pad + 40 : 600;
  const maxY = nodes.length ? Math.max(...nodes.map((n) => n.y + nodeSize(n).h)) + pad : 300;
  const width = Math.max(600, maxX - minX);
  const height = maxY - minY + footer;
  const sev = new Map<string, 'error' | 'warn'>();
  for (const i of issues) {
    if (i.severity === 'info') continue;
    for (const id of [i.node, i.edge]) if (id && sev.get(id) !== 'error') sev.set(id, i.severity === 'error' ? 'error' : 'warn');
  }
  const edges = d.edges
    .map((e) => {
      const a = nodes.find((n) => n.id === e.from);
      const b = nodes.find((n) => n.id === e.to);
      if (!a || !b) return '';
      const s = sev.get(e.id);
      return `<path d="${edgePath(a, b)}" fill="none" stroke="${s === 'error' ? '#d92d20' : '#101828'}" stroke-width="${s ? 3 : 2}"${s === 'error' ? ' stroke-dasharray="8 5"' : ''}/>`;
    })
    .join('');
  const body = nodes.map((n) => nodeSvg(n, sev.get(n.id), imgs)).join('');
  const fy = maxY + 10;
  const footerSvg = [
    `<line x1="${minX + 10}" y1="${fy}" x2="${minX + width - 10}" y2="${fy}" stroke="#d0d5dd"/>`,
    `<text x="${minX + 10}" y="${fy + 22}" font-size="15" font-weight="700">${esc(d.name)}</text>`,
    `<text x="${minX + width - 10}" y="${fy + 22}" font-size="12" text-anchor="end" fill="#667085">${esc(`LS ELECTRIC 전력계통 제품맵 · 상자 ${nodes.length} · 선 ${d.edges.length}${today ? ` · ${today}` : ''}`)}</text>`,
    `<text x="${minX + 10}" y="${fy + 44}" font-size="11" fill="#667085">${esc(clip(DISCLAIMER, width - 20, 11))}</text>`,
  ].join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX} ${minY} ${width} ${height}" font-family="${esc(FONT)}" fill="#101828"><rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#fff"/>${edges}${body}${footerSvg}</svg>`;
}

/** 그림에 넣을 제품 사진을 데이터 URL 로 받아 둔다 (PNG 변환·인쇄 창에서는 바깥 주소 그림이 안 그려지므로). 실패한 사진은 기호로 */
export async function loadDiagramImages(d: Diagram): Promise<ImageMap> {
  const ids = [...new Set(d.nodes.filter((n) => n.kind === 'equipment' && n.product).map((n) => n.product!))];
  const out = new Map<string, string>();
  await Promise.all(
    ids.map(async (id) => {
      const url = productImageUrl(id, true);
      if (!url) return;
      try {
        const blob = await (await fetch(url)).blob();
        if (!blob.type.startsWith('image/')) return;
        const data = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result));
          r.onerror = () => rej(r.error);
          r.readAsDataURL(blob);
        });
        out.set(id, data);
      } catch {
        /* 사진 없이 기호로 */
      }
    }),
  );
  return out;
}

/** 사진까지 넣은 단선도 그림 */
export async function diagramSvgWithImages(d: Diagram, issues: DIssue[] = [], today = ''): Promise<string> {
  return diagramSvg(d, issues, today, await loadDiagramImages(d));
}
