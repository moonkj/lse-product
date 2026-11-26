/**
 * 경쟁 대응 — 기사 본문 읽기 (2026-11-27)
 * 기사 주소를 넣으면 서버 함수(functions/api/article.ts)가 그 페이지를 받아 제목·요약·본문 글만 뽑는다.
 * 여기 있는 것은 서버·앱이 같이 쓰는 순수 함수: 주소 검사, HTML → 글, 입력 나누기.
 */

export interface Article {
  url: string;
  title: string;
  description: string;
  body: string;
}

/** 본문 최대 글자 수 — 매칭에는 충분, 응답은 작게 */
export const BODY_MAX = 30_000;

const PRIVATE_HOST = /^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.lan|.*\.home|.*\.arpa)$/i;

/** 사설·내부 주소인지 (IPv4 사설 대역, IPv6 리터럴, localhost 류) — 서버 함수가 내부망을 부르지 않게 */
function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (!h || PRIVATE_HOST.test(h) || !h.includes('.')) return true;
  if (h.startsWith('[') || h.includes(':')) return true; // IPv6 리터럴은 모두 막음
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0 || a >= 224) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  if (/^\d+$/.test(h) || /^0x/i.test(h)) return true; // 숫자 하나로 쓴 IP
  return false;
}

/** 받아도 되는 기사 주소면 URL, 아니면 오류 문구 */
export function checkArticleUrl(raw: string): URL | string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return '주소 형식이 아닙니다.';
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return 'http·https 주소만 읽을 수 있습니다.';
  if (u.username || u.password) return '계정 정보가 든 주소는 읽지 않습니다.';
  if (u.port && u.port !== '80' && u.port !== '443') return '기본 포트(80·443) 주소만 읽을 수 있습니다.';
  if (isPrivateHost(u.hostname)) return '내부·사설 주소는 읽지 않습니다.';
  return u;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', hellip: '…', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    }
    return ENTITIES[e.toLowerCase()] ?? all;
  });
}

const clean = (s: string) => decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

function meta(html: string, names: string[]): string {
  for (const n of names) {
    const re = new RegExp(`<meta[^>]+(?:name|property)=["']${n}["'][^>]*>`, 'i');
    const tag = html.match(re)?.[0];
    const c = tag?.match(/content=["']([^"']*)["']/i)?.[1] ?? tag?.match(/content=([^\s>]+)/i)?.[1];
    if (c && c.trim()) return clean(c);
  }
  return '';
}

/** HTML → 제목·요약·본문 글 (스크립트·메뉴·바닥글 제외, <article> 우선, 없으면 문단 <p>) */
export function extractArticle(html: string, url = ''): Article {
  const title = meta(html, ['og:title', 'twitter:title']) || clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const description = meta(html, ['og:description', 'description', 'twitter:description']);
  let doc = html.replace(/<!--[\s\S]*?-->/g, ' ');
  for (const t of ['script', 'style', 'noscript', 'svg', 'template', 'iframe', 'nav', 'header', 'footer', 'aside', 'form', 'button', 'select'])
    doc = doc.replace(new RegExp(`<${t}\\b[\\s\\S]*?</${t}>`, 'gi'), ' ');
  const articles = [...doc.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)].map((m) => m[1]);
  const region = articles.sort((a, b) => b.length - a.length)[0] ?? doc.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? doc;
  const paras = [...region.matchAll(/<(p|h[1-4]|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => clean(m[2])).filter((t) => t.length >= 20);
  let body = paras.join('\n');
  if (body.length < 200) body = clean(region);
  if (body.length > BODY_MAX) body = body.slice(0, BODY_MAX);
  return { url, title, description, body };
}

/** 입력이 기사 주소 하나뿐이면 그 주소 */
export function articleUrlOf(input: string): string | undefined {
  const t = input.trim();
  return /^https?:\/\/\S+$/i.test(t) ? t : undefined;
}

/** 주소의 경로 단어 (본문을 못 읽을 때 대신) — 'abb-launches-intelligent-motor' → 'abb launches intelligent motor' */
export function slugWords(url: string): string {
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname).replace(/\.(html?|php|aspx?)$/i, '').replace(/[/_\-+.]+/g, ' ').replace(/\s+/g, ' ').trim();
  } catch {
    return url;
  }
}

/** 붙여 넣은 글 → 제목(첫 줄)·본문(나머지). 한 줄이면 본문 없음 */
export function splitPasted(input: string): { title: string; body: string } {
  const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return { title: lines[0] ?? '', body: lines.slice(1).join('\n') };
}
