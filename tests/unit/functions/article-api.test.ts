/**
 * 기사 본문 읽기 — functions/api/article.ts + src/lib/counter/article.ts + matchArticle (fetch 는 가짜)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from '../../../functions/api/article';
import { articleUrlOf, checkArticleUrl, extractArticle, slugWords, splitPasted } from '../../../src/lib/counter/article';
import { matchArticle, matchText } from '../../../src/lib/counter/match';

const HTML = `<!doctype html><html><head><meta charset="utf-8">
<title>ABB launches IntelleQt | Chem Industry Digest</title>
<meta property="og:title" content="ABB launches IntelleQt, the world&#8217;s first intelligent low voltage motor">
<meta name="description" content="New motor with built-in sensors &amp; drive connectivity">
<script>var motor = "ignore me";</script><style>.x{}</style></head>
<body><nav><a>Home</a><p>Menu: transformer switchgear breaker news</p></nav>
<article><h1>ABB launches IntelleQt</h1>
<p>ABB has launched IntelleQt, an intelligent low voltage motor that integrates sensors and connectivity.</p>
<p>The motor can be paired with ABB variable speed drives such as the ACS880 to optimise energy use in pumps and fans.</p>
<p>Combined with a drive, users can cut energy consumption, and the variable speed drive reports condition data.</p>
</article><footer><p>Related: circuit breaker, UPS, transformer stories from our site</p></footer></body></html>`;

const req = (url: string) => new Request(`https://lse-grid-map.pages.dev/api/article?url=${encodeURIComponent(url)}`);

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('기사 주소 검사', () => {
  it('공개 http·https 만 허용, 사설·내부·다른 포트·계정 주소 거부', () => {
    expect(checkArticleUrl('https://chemindigest.com/a-b')).toBeInstanceOf(URL);
    for (const bad of ['ftp://x.com/a', 'http://localhost/a', 'http://127.0.0.1/', 'http://10.1.2.3/', 'http://192.168.0.1/', 'http://172.20.0.1/', 'http://169.254.169.254/latest', 'http://[::1]/', 'https://x.com:8443/', 'https://u:p@x.com/', 'http://intranet/', 'http://2130706433/', 'not a url'])
      expect(typeof checkArticleUrl(bad), bad).toBe('string');
  });
  it('입력이 주소 하나뿐일 때만 기사 주소로 봄', () => {
    expect(articleUrlOf('  https://a.com/x  ')).toBe('https://a.com/x');
    expect(articleUrlOf('ABB motor https://a.com/x')).toBeUndefined();
  });
  it('주소 단어·붙여 넣은 글 나누기', () => {
    expect(slugWords('https://chemindigest.com/abb-launches-intelleqt-motor/')).toBe('abb launches intelleqt motor');
    expect(splitPasted('제목\n\n본문 1\n본문 2')).toEqual({ title: '제목', body: '본문 1\n본문 2' });
    expect(splitPasted('한 줄').body).toBe('');
  });
});

describe('HTML → 글', () => {
  it('og 제목·요약, <article> 본문만 (메뉴·바닥글·스크립트 제외), 문자 참조 풀기', () => {
    const a = extractArticle(HTML, 'https://x.com/a');
    expect(a.title).toBe('ABB launches IntelleQt, the world’s first intelligent low voltage motor');
    expect(a.description).toBe('New motor with built-in sensors & drive connectivity');
    expect(a.body).toContain('variable speed drives');
    expect(a.body).not.toContain('ignore me');
    expect(a.body).not.toContain('Menu:');
    expect(a.body).not.toContain('Related:');
  });
});

describe('/api/article', () => {
  it('정상: 기사 → { title, description, body }, 1시간 캐시', async () => {
    fetchMock.mockResolvedValue(new Response(HTML, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
    const res = await onRequest({ request: req('https://chemindigest.com/abb') });
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=3600');
    const a = await res.json();
    expect(a.title).toContain('IntelleQt');
    expect(fetchMock.mock.calls[0][1].redirect).toBe('manual');
  });
  it('사설 주소는 부르지 않고 400', async () => {
    const res = await onRequest({ request: req('http://169.254.169.254/latest/meta-data') });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('리다이렉트가 내부 주소로 가면 막음', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/admin' } }));
    const res = await onRequest({ request: req('https://evil.example.com/r') });
    expect(res.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('기사 사이트 오류·HTML 아님 → 502', async () => {
    fetchMock.mockResolvedValueOnce(new Response('no', { status: 403 }));
    expect((await onRequest({ request: req('https://a.com/x') })).status).toBe(502);
    fetchMock.mockResolvedValueOnce(new Response('%PDF', { status: 200, headers: { 'Content-Type': 'application/pdf' } }));
    expect((await onRequest({ request: req('https://a.com/y') })).status).toBe(502);
  });
  it('EUC-KR 기사도 읽음', async () => {
    const bytes = new Uint8Array([0xb0, 0xa1]); // '가'
    const html = new Uint8Array([...new TextEncoder().encode('<html><head><title>'), ...bytes, ...new TextEncoder().encode('</title></head><body></body></html>')]);
    fetchMock.mockResolvedValue(new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=euc-kr' } }));
    const a = await (await onRequest({ request: req('https://news.co.kr/a') })).json();
    expect(a.title).toBe('가');
  });
});

describe('제목 + 본문 매칭', () => {
  it('본문에서 인버터(variable speed drive)가 반복되면 직접 대응으로 올라옴', () => {
    const a = extractArticle(HTML);
    const r = matchArticle(`${a.title} ${a.description}`, a.body);
    const drive = r.hits.find((h) => h.eq === 'lv-drive')!;
    expect(drive).toBeTruthy();
    expect(drive.adjacentTo).toBeUndefined(); // 연관(전동기 옆)이 아니라 본문 근거로 직접
    expect(drive.bodyTerms?.length).toBeGreaterThan(0);
  });
  it('본문에서만 한 번 스친 일반어는 버림, 제목만일 때와 결과 같음', () => {
    const t = 'Siemens SINAMICS G220';
    expect(matchArticle(t, '').hits.map((h) => h.eq)).toEqual(matchText(t).hits.map((h) => h.eq));
    const r = matchArticle(t, 'The company also has a long history. It sells a transformer too.');
    expect(r.hits.map((h) => h.eq)).not.toContain('oil-tr');
    expect(r.hits[0].eq).toBe('lv-drive');
  });
  it('제목에 없던 경쟁사도 본문에서 찾음, 프로젝트는 본문에 2번 이상일 때', () => {
    const r = matchArticle('New order announced', 'Schneider Electric will supply switchgear for a data center. The data center campus opens in 2027.');
    expect(r.competitors.map((c) => c.id)).toContain('schneider');
    expect(r.projects.map((p) => p.id)).toContain('datacenter');
    expect(matchArticle('New order', 'one data center mention').projects).toEqual([]);
  });
});
