#!/usr/bin/env node
/**
 * 시장 동향 카드 스냅샷 → src/data/market-feed.json (커밋하는 스냅샷, 수집 시각 포함)
 * 실행: node scripts/fetch-market.mjs   (GitHub Actions deploy.yml 의 빌드 앞 단계에서도 실행 — 그때는 커밋하지 않고 빌드에만 반영)
 *
 * - 새 수집 소스를 만들지 않는다: 같은 회사 마켓뉴스 대시보드(https://lse-market-news.pages.dev/)가
 *   이미 모아 서버에서 렌더링한 공개 페이지 두 장(/bids 입찰 표, / 뉴스 카드)만 읽는다.
 * - 요청: 순차, 간격 1.2초 이상, User-Agent 'LSE-ProductMap/0.1', 시간 제한 20초.
 * - 키워드→기기 매핑표(src/data/market-keywords.json)에 하나라도 걸리는 공고·기사만 남긴다 (번들 크기).
 * - 실패(요청 오류·파싱 0건·검증 실패)하면 기존 스냅샷을 그대로 둔다. 어떤 경우에도 종료 코드 0.
 * - 로컬 확인(네트워크 없이): node scripts/fetch-market.mjs --bids-file a.html --news-file b.html --out /tmp/feed.json
 *
 * 파싱·매칭은 src/lib/market/parse.ts (앱과 공용, Node type stripping 으로 직접 import).
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://lse-market-news.pages.dev';
const PAGES = { bids: `${BASE}/bids`, news: `${BASE}/` };
const UA = 'LSE-ProductMap/0.1';
const GAP_MS = 1_500;
const TIMEOUT_MS = 20_000;
const MAX_NEWS = 300;

const args = process.argv.slice(2);
const argOf = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const OUT = resolve(ROOT, argOf('--out') || 'src/data/market-feed.json');
const warn = (msg) => console.warn(`::warning title=시장 동향 수집::${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': UA, Accept: 'text/html' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

async function load(kind, file) {
  if (file) return readFile(resolve(file), 'utf8');
  return fetchText(PAGES[kind]);
}

async function main() {
  const lib = await import('../src/lib/market/parse.ts');
  const keywords = JSON.parse(await readFile(resolve(ROOT, 'src/data/market-keywords.json'), 'utf8'));
  const rules = keywords.rules;

  let bidsHtml;
  let newsHtml;
  try {
    bidsHtml = await load('bids', argOf('--bids-file'));
    if (!argOf('--bids-file')) await sleep(GAP_MS);
    newsHtml = await load('news', argOf('--news-file'));
  } catch (e) {
    warn(`요청 실패 — 기존 스냅샷 유지 (${e?.message || e})`);
    return;
  }

  const allBids = lib.parseBidsHtml(bidsHtml);
  const allNews = lib.parseNewsHtml(newsHtml);
  if (allBids.length === 0 || allNews.length === 0) {
    warn(`파싱 결과 공고 ${allBids.length}건·뉴스 ${allNews.length}건 — 페이지 구조가 바뀐 듯. 기존 스냅샷 유지`);
    return;
  }
  const bids = allBids.filter((b) => lib.matchEquipment(b.title, rules, 'bids').length > 0);
  const news = allNews
    .filter((n) => lib.matchEquipment(n.title, rules, 'news').length > 0)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, MAX_NEWS);

  const feed = {
    schema: 1,
    fetchedAt: new Date().toISOString(),
    source: { title: 'LSE 마켓뉴스 대시보드', url: `${BASE}/`, bidsUrl: PAGES.bids },
    bids,
    news,
  };
  await mkdir(dirname(OUT), { recursive: true });
  const tmp = `${OUT}.tmp`;
  await writeFile(tmp, `${JSON.stringify(feed, null, 1)}\n`, 'utf8');
  await rename(tmp, OUT);
  console.log(`시장 동향 스냅샷: 공고 ${bids.length}/${allBids.length}건 · 뉴스 ${news.length}/${allNews.length}건 → ${OUT}`);
}

main().catch((e) => warn(`예상 못 한 오류 — 기존 스냅샷 유지 (${e?.message || e})`));
