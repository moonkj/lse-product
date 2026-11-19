#!/usr/bin/env node
/**
 * 실시간 전력수급 수집 → dist/data/supply.json (빌드 산출물에만 씀, 커밋하지 않음)
 * 실행: node scripts/fetch-supply.mjs  (GitHub Actions deploy.yml 의 빌드 뒤 단계, 20분 schedule)
 *
 * - API: 공공데이터포털 한국전력거래소_오늘전력수급현황조회_GW [15158703]
 *   https://apis.data.go.kr/B552115/Sukub5mToday/getSukub5mToday (serviceKey, pageNo, numOfRows=300, dataType=JSON)
 *   — 오늘 5분 단위 행(하루 288행). 사용법·재시도·한도 오류는 마켓뉴스 app/market/kpx_power.py 와 같게.
 * - 키: env DATA_GO_KR_KEY. 없으면 경고만 남기고 종료 코드 0 (배포를 실패시키지 않음 → 앱은 JSON 이 없으면 알약을 숨김).
 * - 재시도: 2초·5초 뒤 최대 3번. 키 미등록·권한(401/403)·하루 한도 초과(429 LIMITED_NUMBER_OF_SERVICE_REQUESTS)는 다시 하지 않음.
 * - 실패하면: env SUPPLY_PREV_URL(지금 배포된 supply.json)을 읽어 지난 값 + failedAt 으로 다시 씀 → 화면은 "갱신 실패".
 *   그것도 없으면 파일을 쓰지 않음. 어떤 경우에도 종료 코드 0.
 * - 응답 필드 이름은 확인 전 → 후보가 하나도 안 맞으면 실제 응답 키를 경고로 남김 (첫 실제 실행 로그로 src/lib/supply.ts 후보 수정).
 * - 로컬 확인(네트워크 없이): node scripts/fetch-supply.mjs --fixture tests/unit/fixtures/sukub5m-today.json --out /tmp/supply.json
 *
 * 파싱은 src/lib/supply.ts (앱과 공용, Node 22.18+ type stripping 으로 직접 import).
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENDPOINT = process.env.SUPPLY_ENDPOINT || 'https://apis.data.go.kr/B552115/Sukub5mToday/getSukub5mToday';
const TIMEOUT_MS = 15_000;
const RETRY_WAITS_MS = [2_000, 5_000];

const args = process.argv.slice(2);
const argOf = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const OUT = resolve(ROOT, argOf('--out') || 'dist/data/supply.json');
const FIXTURE = argOf('--fixture');

const warn = (msg) => console.warn(`::warning title=전력수급 수집::${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function writeAtomic(path, data) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data)}\n`, 'utf8');
  await rename(tmp, path);
}

/** 한 번 요청 → 응답 본문. 오류 메시지에 키(URL)를 넣지 않는다 */
async function requestOnce(key, lib) {
  const url = new URL(ENDPOINT);
  // 포털의 Encoding 키(% 포함)는 그대로, Decoding 키(+ / = 포함)는 한 번 인코딩 → 두 번 인코딩되지 않게
  const sk = key.includes('%') ? key : encodeURIComponent(key);
  url.search = `serviceKey=${sk}&pageNo=1&numOfRows=300&dataType=JSON`;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: 'application/json' } });
  } catch (e) {
    throw new Error(`요청 실패: ${e?.name || 'Error'}`);
  }
  const text = await res.text();
  if (!res.ok) {
    const err = lib.serviceError(text);
    throw new Error(`요청 실패: HTTP ${res.status}${err ? ` ${err}` : ''}`);
  }
  return text;
}

async function fetchItems(key, lib) {
  for (let i = 0; ; i++) {
    try {
      const items = lib.parseDataGoKrItems(await requestOnce(key, lib));
      if (i) console.log(`전력수급: ${i + 1}번째 시도에 성공`);
      return items;
    } catch (e) {
      const msg = String(e?.message || e);
      if (i >= RETRY_WAITS_MS.length || lib.isNoRetryError(msg)) throw new Error(msg);
      console.warn(`전력수급 실패, ${RETRY_WAITS_MS[i] / 1000}초 뒤 다시 시도: ${msg}`);
      await sleep(RETRY_WAITS_MS[i]);
    }
  }
}

/** 지금 배포된 supply.json (실패 때 지난 값 유지용). 없으면 null */
async function previous(lib) {
  const prevUrl = process.env.SUPPLY_PREV_URL;
  if (!prevUrl) return null;
  try {
    const res = await fetch(prevUrl, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return lib.isSupplyData(data) ? data : null;
  } catch {
    return null;
  }
}

async function main() {
  const lib = await import('../src/lib/supply.ts');
  let items;
  if (FIXTURE) {
    items = lib.parseDataGoKrItems(await readFile(resolve(ROOT, FIXTURE), 'utf8'));
  } else {
    const key = (process.env.DATA_GO_KR_KEY || '').trim();
    if (!key) {
      warn('DATA_GO_KR_KEY 가 없어 수집을 건너뜁니다 (저장소 Secret 등록 필요). 화면의 수급 알약은 숨겨집니다.');
      return;
    }
    try {
      items = await fetchItems(key, lib);
    } catch (e) {
      const msg = String(e?.message || e);
      warn(`수집 실패: ${msg}${msg.includes('429') || msg.includes('LIMITED_NUMBER') ? ' (하루 요청 한도 초과 — 자정에 풀림)' : ''}`);
      items = null;
    }
  }

  const data = items ? lib.buildSupplyData(items) : null;
  if (items && !data) {
    warn(items.length
      ? `시각·예비율 필드를 찾지 못함 — 실제 응답 키: ${lib.responseKeys(items)} (src/lib/supply.ts 후보 수정)`
      : '응답 행이 0건입니다');
  }
  if (data) {
    await writeAtomic(OUT, data);
    console.log(`전력수급: ${data.rows.length}행, 기준 ${data.asof}, 예비율 ${data.latest.rate}% · 예비력 ${data.latest.reserve}GW → ${OUT}`);
    return;
  }
  const prev = await previous(lib);
  if (prev) {
    await writeAtomic(OUT, { ...prev, failedAt: new Date().toISOString() });
    console.log(`전력수급: 지난 값(기준 ${prev.asof})을 '갱신 실패'로 다시 씀 → ${OUT}`);
  } else {
    console.log('전력수급: 쓸 값이 없어 supply.json 을 만들지 않음 (알약 숨김)');
  }
}

main().catch((e) => {
  // 어떤 오류도 배포를 막지 않는다
  warn(`예상하지 못한 오류: ${String(e?.message || e)}`);
}).finally(() => {
  process.exitCode = 0;
});
