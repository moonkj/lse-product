/**
 * Cloudflare Pages Function — GET /api/article?url=… (2026-11-27)
 *
 * 경쟁 대응 화면이 기사 제목만이 아니라 본문까지 보고 판단하도록, 기사 페이지를 대신 받아 글만 뽑아 준다.
 * (브라우저에서 다른 사이트 기사를 직접 읽으면 CORS 로 막힘)
 * - http·https 공개 주소만 (사설·내부 주소, 다른 포트, 계정 든 주소 거부). 리다이렉트는 4번까지, 매번 다시 검사.
 * - HTML 만, 최대 2MB 까지 읽고 본문은 3만 자로 자름. 12초 시간 제한.
 * - 같은 주소는 1시간 캐시 (caches.default).
 * - 응답: { url, title, description, body } 또는 { error } (400 잘못된 주소 · 502 못 읽음)
 * 글 뽑기는 src/lib/counter/article.ts (앱 테스트와 같은 코드).
 */
import { checkArticleUrl, extractArticle } from '../../src/lib/counter/article';

export interface ArticleContext {
  request: Request;
  waitUntil?: (p: Promise<unknown>) => void;
}

export const CACHE_SECONDS = 3600;
const TIMEOUT_MS = 12_000;
const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 4;

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', ...extra },
  });
}

async function readLimited(res: Response): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array(await res.arrayBuffer()).slice(0, MAX_BYTES);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.length;
    if (size >= MAX_BYTES) {
      await reader.cancel().catch(() => {});
      break;
    }
  }
  const out = new Uint8Array(Math.min(size, MAX_BYTES));
  let o = 0;
  for (const c of chunks) {
    const n = Math.min(c.length, out.length - o);
    out.set(c.subarray(0, n), o);
    o += n;
    if (o >= out.length) break;
  }
  return out;
}

/** 글자 인코딩: Content-Type → <meta charset> → utf-8 (한국 언론사 EUC-KR 대응) */
function decode(bytes: Uint8Array, contentType: string): string {
  const head = new TextDecoder('utf-8').decode(bytes.subarray(0, 4096));
  const cs = (contentType.match(/charset=([\w-]+)/i)?.[1] ?? head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ?? 'utf-8').toLowerCase();
  try {
    return new TextDecoder(cs).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

export async function fetchArticle(raw: string): Promise<{ status: number; body: unknown }> {
  let target = checkArticleUrl(raw);
  if (typeof target === 'string') return { status: 400, body: { error: target } };
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res: Response;
    try {
      res = await fetch(target.toString(), {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Mozilla/5.0 (compatible; lse-grid-map article reader)' },
      });
    } catch (e) {
      return { status: 502, body: { error: `기사를 받지 못했습니다 (${(e as Error)?.name || 'Error'}).` } };
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('Location');
      if (!loc) return { status: 502, body: { error: '기사 사이트가 잘못된 이동 응답을 보냈습니다.' } };
      const next = checkArticleUrl(new URL(loc, target).toString());
      if (typeof next === 'string') return { status: 400, body: { error: `이동한 주소: ${next}` } };
      target = next;
      continue;
    }
    if (!res.ok) return { status: 502, body: { error: `기사 사이트가 ${res.status} 로 응답했습니다 (로그인·차단일 수 있음).` } };
    const ct = res.headers.get('Content-Type') ?? '';
    if (ct && !/html|xml/i.test(ct)) return { status: 502, body: { error: '기사(HTML) 페이지가 아닙니다.' } };
    const html = decode(await readLimited(res), ct);
    const a = extractArticle(html, target.toString());
    if (!a.title && !a.body) return { status: 502, body: { error: '기사 글을 찾지 못했습니다.' } };
    return { status: 200, body: a };
  }
  return { status: 502, body: { error: '이동(리다이렉트)이 너무 많습니다.' } };
}

export async function onRequest(ctx: ArticleContext): Promise<Response> {
  const { request } = ctx;
  if (request.method !== 'GET') return json({ error: 'GET 만 됩니다.' }, 405, { Allow: 'GET' });
  const raw = new URL(request.url).searchParams.get('url') ?? '';
  if (!raw) return json({ error: 'url 이 필요합니다.' }, 400);
  const cache = typeof caches !== 'undefined' ? (caches as unknown as { default?: Cache }).default : undefined;
  const key = new Request(`https://article-cache.invalid/?url=${encodeURIComponent(raw)}`);
  const hit = await cache?.match(key).catch(() => undefined);
  if (hit) return hit;
  const { status, body } = await fetchArticle(raw);
  const res = json(body, status, { 'Cache-Control': status === 200 ? `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}` : 'no-store' });
  if (status === 200 && cache) {
    const p = cache.put(key, res.clone()).catch(() => {});
    if (ctx.waitUntil) ctx.waitUntil(p);
    else await p;
  }
  return res;
}
