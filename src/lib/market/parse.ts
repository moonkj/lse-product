/**
 * 시장 동향 카드 (P0-1) — 수집 스크립트(scripts/fetch-market.mjs)와 앱이 같이 쓰는 순수 함수.
 *
 * - 원본: 같은 회사 마켓뉴스 대시보드 https://lse-market-news.pages.dev/ 의 서버 렌더링 HTML
 *   (/bids = 입찰 공고 표, / = 뉴스 카드). 제품맵은 새로 수집하지 않고 그 페이지를 읽어 기기별로 묶기만 한다.
 * - 키워드→기기 매핑: src/data/market-keywords.json (마켓뉴스와 같이 쓰는 단순 규칙표).
 *
 * Node type stripping 으로 .mjs 에서 직접 import 하므로 import 없이, 지울 수 있는 TS 문법만 쓴다.
 */

export const MARKET_BASE = 'https://lse-market-news.pages.dev';

// ---------- 공통 ----------

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[body.toLowerCase()] ?? m;
  });
}

/** 태그 제거 + 엔티티 풀기 + 공백 정리 */
export function textOf(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function attr(attrs: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(attrs);
  return m ? decodeEntities(m[1]) : undefined;
}

/** https 절대 주소만 (상대 주소는 base 기준으로) — 그 밖은 버림 */
export function absUrl(href: string, base: string = MARKET_BASE): string | undefined {
  try {
    const u = new URL(decodeEntities(href), base);
    return u.protocol === 'https:' ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

// ---------- 입찰 (/bids) ----------

export interface ParsedBid {
  /** 한전 입찰 / 나라장터 / K-apt 입찰 / 세계은행 … (대시보드 표기 그대로) */
  kind: string;
  title: string;
  org: string;
  url: string;
  /** 게시일 YYYY-MM-DD (없으면 빈 문자열) */
  posted: string;
  /** 마감 YYYY-MM-DDTHH:MM (KST) */
  deadline: string;
}

/** 대시보드 입찰 표의 <tr data-bid …> 줄을 읽는다. 제목·주소·마감이 없는 줄은 버린다. */
export function parseBidsHtml(html: string): ParsedBid[] {
  const out: ParsedBid[] = [];
  const seen = new Set<string>();
  const rowRe = /<tr data-bid\b([^>]*)>([\s\S]*?)<\/tr>/g;
  for (let m = rowRe.exec(html); m; m = rowRe.exec(html)) {
    const attrs = m[1];
    const body = m[2];
    const a = /<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(body);
    if (!a) continue;
    const url = absUrl(a[1]);
    const title = textOf(a[2].replace(/<span class="sr-only">[\s\S]*?<\/span>/g, ''));
    const deadline = attr(attrs, 'data-deadline') ?? '';
    if (!url || !title || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(deadline)) continue;
    const orgCell = /<td class="[^"]*\bbt-org\b[^"]*">([\s\S]*?)<\/td>/.exec(body);
    const posted = attr(attrs, 'data-posted') ?? '';
    const key = `${url}|${title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      kind: attr(attrs, 'data-kind') || '입찰',
      title,
      org: orgCell ? textOf(orgCell[1]) : '',
      url,
      posted: /^\d{4}-\d{2}-\d{2}$/.test(posted) ? posted : '',
      deadline,
    });
  }
  return out;
}

// ---------- 뉴스 (/) ----------

export interface ParsedNews {
  /** 대시보드 기사 id (/go/{id}.html) */
  id: string;
  title: string;
  /** 매체 이름 */
  media: string;
  /** 기사 시각 YYYY-MM-DDTHH:MM (KST) */
  at: string;
  /** 대시보드의 원문 이동 주소 */
  url: string;
}

/** 대시보드 뉴스 카드 <article class="card" …> 를 읽는다. 같은 기사가 여러 칸에 나오면 한 번만. */
export function parseNewsHtml(html: string): ParsedNews[] {
  const out: ParsedNews[] = [];
  const seen = new Set<string>();
  const cardRe = /<article class="card"([^>]*)>([\s\S]*?)<\/article>/g;
  for (let m = cardRe.exec(html); m; m = cardRe.exec(html)) {
    const attrs = m[1];
    const body = m[2];
    const a = /<a href="(\/go\/([0-9a-z]+)\.html)" class="ttl"[^>]*>([\s\S]*?)<\/a>/.exec(body);
    if (!a) continue;
    const id = a[2];
    if (seen.has(id)) continue;
    const url = absUrl(a[1]);
    const title = textOf(a[3].replace(/<span class="sr-only">[\s\S]*?<\/span>/g, ''));
    if (!url || !title) continue;
    const src = /<span class="meta card-src" title="([^"]*)"/.exec(body);
    const media = src ? decodeEntities(src[1]).split(' · ')[0].trim() : '';
    const kst = /data-kst="(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})"/.exec(body)?.[1];
    const at = kst ?? attr(attrs, 'data-at') ?? '';
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at)) continue;
    seen.add(id);
    out.push({ id, title, media, at, url });
  }
  return out;
}

// ---------- 키워드 → 기기 ----------

export interface KeywordRule {
  /** 이 중 하나라도 제목에 있으면 */
  keywords: string[];
  /** 그리고 (있으면) 이 중 하나도 있어야 함 — 예: GIS + 170kV */
  with?: string[];
  /** 이 중 하나라도 있으면 이 규칙은 건너뜀 */
  exclude?: string[];
  /** 'bids' 면 입찰 제목에만 적용 (영문 약어처럼 뉴스에서 오인되기 쉬운 말) */
  only?: 'bids' | 'news';
  equipment: string[];
}

const HANGUL = /[가-힣]/;

/** 한글이 든 말은 띄어쓰기 무시 포함 검사, 영문·숫자만인 말은 단어 경계로 검사 (대소문자 무시) */
export function hasKeyword(title: string, keyword: string): boolean {
  const t = title.toLowerCase();
  const k = keyword.toLowerCase().trim();
  if (!k) return false;
  if (HANGUL.test(k)) return t.replace(/\s+/g, '').includes(k.replace(/\s+/g, ''));
  const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
  return new RegExp(`(^|[^a-z0-9])${esc}(s|es)?(?=$|[^a-z0-9])`).test(t);
}

/** 제목 → 연결 기기 id (규칙 순서대로, 중복 없이) */
export function matchEquipment(title: string, rules: KeywordRule[], target: 'bids' | 'news'): string[] {
  const out: string[] = [];
  for (const r of rules) {
    if (r.only && r.only !== target) continue;
    if (!r.keywords.some((k) => hasKeyword(title, k))) continue;
    if (r.with && !r.with.some((k) => hasKeyword(title, k))) continue;
    if (r.exclude && r.exclude.some((k) => hasKeyword(title, k))) continue;
    for (const id of r.equipment) if (!out.includes(id)) out.push(id);
  }
  return out;
}

// ---------- 구매 방식 (공고 제목 표기 기준) ----------

/** 공고 제목에 적힌 구매 방식 표기만 읽는다 (추정하지 않음). 화면 문구 → 검사식 */
export const PURCHASE_MARKERS: ReadonlyArray<{ label: string; re: RegExp }> = [
  { label: '단가계약', re: /단가\s*계약/ },
  { label: '중소기업자간 경쟁제품', re: /중기간\s*경쟁|중소기업자\s*간\s*경쟁/ },
  { label: '지역제한 경쟁입찰', re: /지역\s*제한/ },
];

export function purchaseMarkers(title: string): string[] {
  return PURCHASE_MARKERS.filter((p) => p.re.test(title)).map((p) => p.label);
}

// ---------- 마감 D-n ----------

const KST_MS = 9 * 3600_000;

/** KST 날짜 문자열 → 그날 0시 기준 일 번호 */
function kstDayNumber(ms: number): number {
  return Math.floor((ms + KST_MS) / 86_400_000);
}

/** 마감(KST, YYYY-MM-DDTHH:MM) 까지 남은 날 수 — 지났으면 null. 같은 날이면 0 */
export function daysLeft(deadline: string, now: Date): number | null {
  const end = Date.parse(`${deadline}:00+09:00`);
  if (!Number.isFinite(end) || end < now.getTime()) return null;
  return kstDayNumber(end) - kstDayNumber(now.getTime());
}

export function ddayLabel(days: number): string {
  return days === 0 ? 'D-day' : `D-${days}`;
}
