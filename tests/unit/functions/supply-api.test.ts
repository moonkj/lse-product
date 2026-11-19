/**
 * Cloudflare Pages Function GET /api/supply (functions/api/supply.ts) — fetch 는 가짜 (실제 전력거래소 호출 없음)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CACHE_SECONDS, onRequest } from '../../../functions/api/supply';
import { COLLECT_EVERY_MIN, isSupplyData } from '../../../src/lib/supply';

const fixture = readFileSync(resolve(__dirname, '../fixtures/sukub5m-today.json'), 'utf8');
const req = (method = 'GET') => new Request('https://lse-grid-map.pages.dev/api/supply?t=1', { method });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('/api/supply', () => {
  it('캐시 시간 = 앱 갱신 주기(5분)', () => {
    expect(CACHE_SECONDS).toBe(COLLECT_EVERY_MIN * 60);
  });

  it('정상: 전력거래소 응답 → SupplyData, CORS *, 5분 캐시 헤더, 키는 URL 에만', async () => {
    fetchMock.mockResolvedValue(new Response(fixture, { status: 200 }));
    const res = await onRequest({ request: req(), env: { DATA_GO_KR_KEY: 'a+b/c=' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Cache-Control')).toContain(`s-maxage=${CACHE_SECONDS}`);
    const body = await res.json();
    expect(isSupplyData(body)).toBe(true);
    const called = String(fetchMock.mock.calls[0][0]);
    expect(called).toContain('B552115/Sukub5mToday/getSukub5mToday');
    expect(called).toContain('serviceKey=a%2Bb%2Fc%3D'); // Decoding 키는 한 번만 인코딩
    expect(JSON.stringify(body)).not.toContain('a+b/c=');
  });

  it('키가 없으면 502 (앱은 대체 파일로)', async () => {
    const res = await onRequest({ request: req(), env: {} });
    expect(res.status).toBe(502);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('전력거래소 오류면 한 번 다시 시도 후 502, 오류 메시지에 키 없음', async () => {
    fetchMock.mockResolvedValue(new Response('busy', { status: 500 }));
    const res = await onRequest({ request: req(), env: { DATA_GO_KR_KEY: 'SECRETKEY' } });
    expect(res.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await res.text()).not.toContain('SECRETKEY');
  });

  it('키 미등록·한도 초과(다시 해도 안 되는 오류)는 다시 시도하지 않음', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 429 }));
    const res = await onRequest({ request: req(), env: { DATA_GO_KR_KEY: 'k' } });
    expect(res.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('OPTIONS 는 204 + CORS, POST 는 405', async () => {
    const opt = await onRequest({ request: req('OPTIONS'), env: {} });
    expect(opt.status).toBe(204);
    expect(opt.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    const post = await onRequest({ request: req('POST'), env: {} });
    expect(post.status).toBe(405);
  });
});
