/** 관리자 "사이트에 반영" POST /api/admin/publish (functions/api/admin/publish.ts) — GitHub API 는 가짜 fetch */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_FILE_BYTES, checkFiles, onRequest, safeEqual } from '../../../functions/api/admin/publish';

const env = { ADMIN_PASSWORD: 'pw-123', ADMIN_GH_TOKEN: 'ghp_secret' };
const req = (body: unknown, method = 'POST') =>
  new Request('https://lse-grid-map.pages.dev/api/admin/publish', { method, body: method === 'POST' ? JSON.stringify(body) : undefined, headers: { 'Content-Type': 'application/json' } });
const ok = (v: unknown) => new Response(JSON.stringify(v), { status: 200 });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.useFakeTimers({ toFake: ['setTimeout'] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('/api/admin/publish', () => {
  it('비밀번호 비교는 길이가 달라도 같은 결과', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', 'a')).toBe(false);
  });

  it('파일 검사: 정해진 4개만, JSON 이어야, 2MB 이하', () => {
    expect(checkFiles({ 'diagram.json': '{"a":1}' })).toEqual([{ path: 'src/data/diagram.json', content: '{"a":1}' }]);
    expect(checkFiles({ '../../.github/workflows/deploy.yml': 'x' })).toMatch(/올릴 수 없는 파일/);
    expect(checkFiles({ 'specs.json': 'not json' })).toMatch(/JSON 형식/);
    expect(checkFiles({ 'specs.json': '"str"' })).toMatch(/객체·배열/);
    expect(checkFiles({ 'specs.json': `"${'x'.repeat(MAX_FILE_BYTES)}"` })).toMatch(/2MB/);
    expect(checkFiles({})).toMatch(/없습니다/);
  });

  it('설정 안 됨 → 503, 비밀번호 틀림 → 401 (GitHub 호출 없음)', async () => {
    expect((await onRequest({ request: req({}), env: {} })).status).toBe(503);
    const p = onRequest({ request: req({ password: 'nope', files: { 'diagram.json': '{}' } }), env });
    await vi.runAllTimersAsync();
    const res = await p;
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('정상: 한 커밋으로 올리고 커밋 주소를 돌려줌, 토큰은 응답에 없음', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ object: { sha: 'head1' } }))
      .mockResolvedValueOnce(ok({ tree: { sha: 'tree0' } }))
      .mockResolvedValueOnce(ok({ sha: 'tree1' }))
      .mockResolvedValueOnce(ok({ sha: 'c2' }))
      .mockResolvedValueOnce(ok({}));
    const res = await onRequest({ request: req({ password: 'pw-123', message: 'VCB 사진 교체', files: { 'diagram.json': '{"n":1}', 'specs.json': '{"p":{}}' } }), env });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, sha: 'c2', url: 'https://github.com/moonkj/lse-product/commit/c2' });
    expect(JSON.stringify(body)).not.toContain('ghp_secret');
    const calls = fetchMock.mock.calls.map(([u, i]) => `${(i as RequestInit | undefined)?.method ?? 'GET'} ${String(u).replace('https://api.github.com/repos/moonkj/lse-product', '')}`);
    expect(calls).toEqual(['GET /git/ref/heads/main', 'GET /git/commits/head1', 'POST /git/trees', 'POST /git/commits', 'PATCH /git/refs/heads/main']);
    const tree = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(tree.base_tree).toBe('tree0');
    expect(tree.tree.map((t: { path: string }) => t.path)).toEqual(['src/data/diagram.json', 'src/data/specs.json']);
    const commit = JSON.parse(fetchMock.mock.calls[3][1].body);
    expect(commit.message).toContain('VCB 사진 교체');
    expect(commit.parents).toEqual(['head1']);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer ghp_secret');
  });

  it('GitHub 실패 → 502, 단계만 알림', async () => {
    fetchMock.mockResolvedValueOnce(new Response('bad credentials ghp_secret', { status: 401 }));
    const res = await onRequest({ request: req({ password: 'pw-123', files: { 'diagram.json': '{}' } }), env });
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body.error).toMatch(/GitHub 401/);
    expect(body.error).not.toContain('ghp_secret');
  });

  it('OPTIONS → CORS 허용, GET → 405', async () => {
    const o = await onRequest({ request: req(null, 'OPTIONS'), env });
    expect(o.status).toBe(204);
    expect(o.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect((await onRequest({ request: req(null, 'GET'), env })).status).toBe(405);
  });
});
