/**
 * Cloudflare Pages Function — GET /api/supply (https://lse-grid-map.pages.dev/api/supply)
 *
 * 전력거래소 오늘 전력수급(공공데이터포털 B552115/Sukub5mToday, 5분 단위)을 직접 받아 supply.json 과 같은 모양(SupplyData)으로 준다.
 * - 5분 캐시: 같은 데이터센터(colo) 안에서는 5분 동안 전력거래소를 다시 부르지 않는다 (caches.default).
 * - 키: Pages 프로젝트 환경 변수(Secret) DATA_GO_KR_KEY — deploy.yml 이 GitHub Secret 을 `wrangler pages secret put` 으로 등록.
 * - 실패(키 없음·차단·형식 오류)면 502 + { error } → 앱은 배포 때 만든 data/supply.json 으로 대체한다.
 * - 공개 데이터라 CORS 는 * (GitHub Pages 주소에서도 읽음). 오류 메시지에 키를 넣지 않는다.
 *
 * 파싱은 앱·수집 스크립트와 같은 src/lib/supply.ts (wrangler 가 함께 묶음).
 */
import { COLLECT_EVERY_MIN, buildSupplyData, isNoRetryError, parseDataGoKrItems, serviceError, type SupplyData } from '../../src/lib/supply';

interface Env {
  DATA_GO_KR_KEY?: string;
  /** 테스트·대체 주소용 (없으면 공공데이터포털) */
  SUPPLY_ENDPOINT?: string;
}

/** Pages Functions 의 onRequest 인자 중 쓰는 것만 (workers-types 의존 없이) */
export interface SupplyContext {
  request: Request;
  env: Env;
  waitUntil?: (p: Promise<unknown>) => void;
}

export const ENDPOINT = 'https://apis.data.go.kr/B552115/Sukub5mToday/getSukub5mToday';
/** 캐시 유지 시간(초) — 전력거래소 공개 주기(5분)와 같게. src/lib/supply.ts COLLECT_EVERY_MIN 과 맞출 것 */
export const CACHE_SECONDS = COLLECT_EVERY_MIN * 60;
/** 실패하면 이 시간 동안 전력거래소를 다시 부르지 않음 (하루 호출 한도 보호) */
export const FAIL_HOLD_SECONDS = 600;
/** 마지막 성공값 보관 (실패 동안 대신 제공) */
const LAST_GOOD_SECONDS = 86_400;
const TIMEOUT_MS = 12_000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...extra },
  });
}

/** 전력거래소 → SupplyData. 실패하면 Error (메시지에 키 없음). 한 번만 다시 시도(다시 해도 안 되는 오류 제외) */
export async function fetchSupply(key: string, endpoint: string = ENDPOINT, now: Date = new Date()): Promise<SupplyData> {
  const url = new URL(endpoint);
  // 포털 Encoding 키(% 포함)는 그대로, Decoding 키는 한 번 인코딩 — scripts/fetch-supply.mjs 와 같은 규칙
  const sk = key.includes('%') ? key : encodeURIComponent(key);
  url.search = `serviceKey=${sk}&pageNo=1&numOfRows=300&dataType=JSON`;
  let lastErr = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      let res: Response;
      try {
        res = await fetch(url.toString(), { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: 'application/json' } });
      } catch (e) {
        throw new Error(`요청 실패: ${(e as Error)?.name || 'Error'}`);
      }
      const text = await res.text();
      if (!res.ok) {
        const err = serviceError(text);
        throw new Error(`요청 실패: HTTP ${res.status}${err ? ` ${err}` : ''}`);
      }
      const items = parseDataGoKrItems(text);
      const data = buildSupplyData(items, now);
      if (!data) throw new Error(items.length ? '시각·예비율 필드를 찾지 못함' : '응답 행이 0건');
      return data;
    } catch (e) {
      lastErr = String((e as Error)?.message || e);
      if (isNoRetryError(lastErr)) break;
    }
  }
  throw new Error(lastErr || '알 수 없는 오류');
}

export async function onRequest(ctx: SupplyContext): Promise<Response> {
  const { request, env } = ctx;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'GET 만 지원' }, 405, { Allow: 'GET, OPTIONS' });

  const key = (env.DATA_GO_KR_KEY || '').trim();
  if (!key) return json({ error: '수급 키(DATA_GO_KR_KEY)가 등록되지 않음' }, 502, { 'Cache-Control': 'no-store' });

  // 캐시 키는 쿼리 없는 주소 하나 — ?t= 같은 값으로 캐시를 우회해 전력거래소를 반복 호출하지 못하게
  const cacheKey = new Request(new URL('/api/supply', request.url).toString(), { method: 'GET' });
  const cache = typeof caches !== 'undefined' ? ((caches as unknown as { default?: Cache }).default ?? null) : null;
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  const lastGoodKey = new Request(new URL('/api/supply?last-good', request.url).toString(), { method: 'GET' });
  const save = (k: Request, r: Response) => {
    if (!cache) return;
    const put = cache.put(k, r).catch(() => {});
    if (ctx.waitUntil) ctx.waitUntil(put);
  };
  try {
    const data = await fetchSupply(key, env.SUPPLY_ENDPOINT || ENDPOINT);
    const res = json(data, 200, { 'Cache-Control': `public, max-age=60, s-maxage=${CACHE_SECONDS}` });
    if (cache) {
      const put = cache.put(cacheKey, res.clone());
      if (ctx.waitUntil) ctx.waitUntil(put);
      else await put;
      save(lastGoodKey, json(data, 200, { 'Cache-Control': `public, s-maxage=${LAST_GOOD_SECONDS}` }));
    }
    return res;
  } catch (e) {
    const msg = String((e as Error)?.message || e).slice(0, 120);
    // 실패(호출 한도 초과 등): 마지막 성공값에 실패 시각을 달아 제공하고, 그 응답을 잠시(10분) 캐시해 전력거래소를 반복 호출하지 않음
    const last = cache ? await cache.match(lastGoodKey).catch(() => undefined) : undefined;
    if (last) {
      const data = (await last.json()) as SupplyData;
      const res = json({ ...data, failedAt: new Date().toISOString() }, 200, { 'Cache-Control': `public, max-age=60, s-maxage=${FAIL_HOLD_SECONDS}`, 'X-Supply-Error': encodeURIComponent(msg) });
      save(cacheKey, res.clone());
      return res;
    }
    const res = json({ error: msg }, 502, { 'Cache-Control': `public, s-maxage=${FAIL_HOLD_SECONDS}` });
    save(cacheKey, res.clone());
    return res;
  }
}
