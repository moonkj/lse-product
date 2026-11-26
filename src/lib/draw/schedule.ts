/**
 * 반 회로표(분전반 결선표) 내보내기 — CSV · 인쇄용 HTML.
 * 회로마다 회로명·기기·제품·프레임·정격·극수·부하·상·전류·차단용량·전선·길이·전압강하·수량.
 */
import { getData, type SpecsMap } from '../../data/load';
import { csvCell } from '../pages/catalog';
import { DISCLAIMER } from '../builder/validate';
import { eqName, nodeTitle, panelTypeById, voltageLabel, type DNode, type Diagram } from './model';
import { RATED_EQ, itemKA, variantLabel } from './ratings';
import { circuitAmps, isThreePhase, phaseSummary } from './load';
import { recommendCable, voltageDrop } from './cable';
import { shortCircuitKA } from './sc';

export const SCHEDULE_HEAD = ['No', '회로명', '기기', '제품', '프레임·형식', '정격전류(A)', '극수', '부하(kW)', '상', '부하전류(A)', '차단용량(kA)', '전선(SQ)', '길이(m)', '전압강하(%)', '수량'];

const f1 = (n: number | undefined) => (n === undefined || !Number.isFinite(n) ? '' : String(Math.round(n * 10) / 10));

export function scheduleRows(n: DNode, specs?: SpecsMap): string[][] {
  const pt = panelTypeById(n.eq);
  const items = n.items ?? [];
  const mainIdx = items.findIndex((i) => pt?.main.includes(i.eq));
  let no = 0;
  return items.map((it, idx) => {
    const isMain = idx === mainIdx;
    const p = it.product ? getData().productById.get(it.product) : undefined;
    const rated = RATED_EQ.has(it.eq);
    const cable = it.cable ?? (rated && !isMain ? recommendCable(it.amps) : undefined);
    return [
      isMain ? '주' : String(++no),
      it.name ?? (isMain ? '주차단기' : ''),
      eqName(it.eq),
      p?.name ?? '',
      variantLabel(it, specs) ?? '',
      it.amps ? String(it.amps) : '',
      it.poles ? `${it.poles}P` : '',
      it.loadKW ? String(it.loadKW) : '',
      isMain || !it.loadKW ? '' : isThreePhase(it) ? 'RST' : (it.phase ?? 'R'),
      it.loadKW ? f1(circuitAmps(it)) : '',
      rated ? f1(itemKA(it, specs)) : '',
      cable ? `${cable}SQ${it.cable ? '' : ' (권장)'}` : '',
      it.lengthM ? String(it.lengthM) : '',
      isMain ? '' : f1(voltageDrop(it)),
      String(it.qty ?? 1),
    ];
  });
}

function panelHeader(d: Diagram, n: DNode): string[] {
  const pt = panelTypeById(n.eq);
  const ps = phaseSummary(n.items ?? [], (n.items ?? []).find((i) => pt?.main.includes(i.eq))?.id);
  const isc = shortCircuitKA(d, n.id);
  const prod = n.product ? getData().productById.get(n.product)?.name : undefined;
  return [
    `${nodeTitle(n)} (${pt?.label ?? ''} · ${voltageLabel(n.v)}${prod ? ` · ${prod}` : ''})`,
    [
      ps.counted ? `총 부하 ${f1(ps.totalKW)}kW · R ${f1(ps.kW.R)} / S ${f1(ps.kW.S)} / T ${f1(ps.kW.T)}kW · 설비불평형률 ${Math.round(ps.unbalance)}%` : '',
      isc ? `예상 단락전류 약 ${f1(isc)}kA` : '',
    ]
      .filter(Boolean)
      .join(' · '),
  ];
}

/** 회로표 CSV — panels 를 주면 그 반만, 없으면 단선도의 모든 반 */
export function scheduleCsv(d: Diagram, specs: SpecsMap | undefined, today: string, panels?: DNode[]): string {
  const list = panels ?? d.nodes.filter((n) => n.kind === 'panel').sort((a, b) => a.y - b.y || a.x - b.x);
  const out: string[][] = [[`회로표 — ${d.name}`], [`기준일 ${today}`], [DISCLAIMER]];
  for (const n of list) {
    const [title, sum] = panelHeader(d, n);
    out.push([], [title], ...(sum ? [[sum]] : []), SCHEDULE_HEAD, ...scheduleRows(n, specs));
  }
  return '﻿' + out.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 회로표 인쇄용 HTML (반 하나) — innerSvg: 반 안 결선도 SVG 문자열 */
export function scheduleHtml(d: Diagram, n: DNode, specs: SpecsMap | undefined, today: string, innerSvg = ''): string {
  const [title, sum] = panelHeader(d, n);
  const rows = scheduleRows(n, specs);
  const table = `<table><thead><tr>${SCHEDULE_HEAD.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr${r[0] === '주' ? ' class="main"' : ''}>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
  const css = `@page{size:A4 landscape;margin:10mm}body{font-family:'Pretendard','Malgun Gothic',sans-serif;color:#101828;margin:0}
h1{font-size:16px;margin:0 0 2px}p{margin:0 0 6px;font-size:11px;color:#475467}
.sld{border:1px solid #d0d5dd;border-radius:6px;padding:6px;margin:6px 0;overflow:hidden}.sld svg{width:100%;height:auto;max-height:80mm}
.pnl-line{stroke:#101828;stroke-width:2}.pnl-bus{fill:#101828}.pnl-box{fill:#fff;stroke:#667085;stroke-width:1.5}
.pnl-box--warn{stroke:#dc8a00;stroke-width:2.5}.pnl-box--error{stroke:#d92d20;stroke-width:2.5}
.pnl-t1{font-size:12px;font-weight:700;fill:#101828}.pnl-t2{font-size:11px;fill:#475467}.pnl-t3{font-size:10px;fill:#1d4ed8}
table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #d0d5dd;padding:3px 4px;text-align:left}th{background:#f2f4f7}
tr.main td{background:#eef4ff;font-weight:700}.foot{margin-top:6px;font-size:9px;color:#667085}`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(`회로표 ${nodeTitle(n)}`)}</title><style>${css}</style></head><body>
<h1>${esc(title)}</h1><p>${esc(`${d.name} · ${today}${sum ? ` · ${sum}` : ''}`)}</p>
${innerSvg ? `<div class="sld">${innerSvg}</div>` : ''}${table}<p class="foot">${esc(DISCLAIMER)}</p></body></html>`;
}

/** 숨은 인쇄용 창에 HTML 을 넣어 인쇄 */
export function printHtml(html: string, testId = 'print-frame'): HTMLIFrameElement | undefined {
  document.querySelectorAll('iframe[data-print-frame]').forEach((x) => x.remove());
  const f = document.createElement('iframe');
  f.setAttribute('data-print-frame', '');
  f.setAttribute('data-testid', testId);
  f.setAttribute('aria-hidden', 'true');
  f.tabIndex = -1;
  f.title = '인쇄';
  Object.assign(f.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden' });
  document.body.appendChild(f);
  const doc = f.contentDocument;
  const win = f.contentWindow;
  if (!doc || !win) return undefined;
  doc.open();
  doc.write(html);
  doc.close();
  win.addEventListener('afterprint', () => setTimeout(() => f.remove(), 1000));
  setTimeout(() => {
    win.focus();
    win.print();
  }, 150);
  return f;
}
