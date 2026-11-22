#!/usr/bin/env node
/**
 * 전력시장 지표(연도별 실적) 자동 갱신 → src/data/market-annual.json
 * 실행: node scripts/fetch-annual.mjs   (GitHub Actions deploy.yml 의 빌드 앞 단계에서 6시간마다 — 그때는 커밋하지 않고 빌드에만 반영)
 *
 * - 전력거래소 EPSIS 공개 통계 세 곳만 읽는다 (로그인·키 불필요). 받는 곳·열 뜻은 src/lib/market/epsis.ts.
 * - 바뀌는 것: 전력 소비량·발전량·발전 설비용량·SMP 연평균·전원믹스의 실적(actual)과 조회일. 전망(forecast)·계획 기준값은 손대지 않는다.
 * - 요청: 순차, 간격 1.5초, User-Agent 'LSE-ProductMap/0.1', 시간 제한 20초.
 * - 실패(요청 오류·파싱 0건·직전 해 대비 급변)하면 해당 지표는 기존 값 그대로. 어떤 경우에도 종료 코드 0.
 * - 로컬 확인: node scripts/fetch-annual.mjs --out /tmp/annual.json   (기본은 src/data/market-annual.json 덮어쓰기)
 */
import { readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'src/data/market-annual.json');
const UA = 'LSE-ProductMap/0.1';
const GAP_MS = 1_500;
const TIMEOUT_MS = 20_000;

const args = process.argv.slice(2);
const outArg = args.indexOf('--out');
const OUT = outArg >= 0 ? resolve(args[outArg + 1]) : SRC;
const warn = (msg) => console.warn(`::warning title=전력시장 지표 갱신::${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function request(url, form) {
  const init = { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': UA } };
  if (form) {
    init.method = 'POST';
    init.headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
    init.body = new URLSearchParams(form);
  }
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

async function main() {
  const lib = await import('../src/lib/market/epsis.ts');
  const raw = await readFile(SRC, 'utf8');
  const data = JSON.parse(raw);
  // 한국 날짜 (Actions 는 UTC)
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const thisYear = Number(today.slice(0, 4));
  const firstYear = Math.min(...data.indicators.flatMap((i) => i.actual.map((p) => p.year)), ...data.mix.actual.map((p) => p.year));
  const range = { beginDate: String(firstYear), endDate: String(thisYear) };

  let kep = new Map();
  let smp = new Map();
  let mix = new Map();
  try {
    kep = lib.parseKep(JSON.parse(await request(lib.EPSIS_KEP_AJAX, range)));
  } catch (e) {
    warn(`전력지표 요청 실패 (${e?.message || e})`);
  }
  await sleep(GAP_MS);
  try {
    smp = lib.parseGridScript(await request(lib.EPSIS_SMP_AJAX, { ...range, selYear: 'year' }));
  } catch (e) {
    warn(`SMP 요청 실패 (${e?.message || e})`);
  }
  await sleep(GAP_MS);
  try {
    mix = lib.parseGridScript(await request(lib.EPSIS_MIX_PAGE));
  } catch (e) {
    warn(`전원별 발전량 요청 실패 (${e?.message || e})`);
  }
  if (kep.size === 0 && smp.size === 0 && mix.size === 0) {
    warn('받은 값이 하나도 없음 — 기존 값 유지');
    return;
  }

  const snap = lib.buildSnapshot(kep, smp, mix, thisYear);
  const { data: next, changes, skipped } = lib.mergeAnnual(data, snap, today);
  for (const s of skipped) warn(s);
  const crlf = raw.includes('\r\n');
  let text = `${JSON.stringify(next, null, 2)}\n`;
  if (crlf) text = text.replace(/\n/g, '\r\n');
  const tmp = `${OUT}.tmp`;
  await writeFile(tmp, text, 'utf8');
  await rename(tmp, OUT);
  console.log(`전력시장 지표: 조회일 ${today} · 변경 ${changes.length}건${changes.length ? ` (${changes.join(', ')})` : ''} · 건너뜀 ${skipped.length}건 → ${OUT}`);
}

main().catch((e) => warn(`예상 못 한 오류 — 기존 값 유지 (${e?.message || e})`));
