/**
 * 단위 테스트 — 시장 동향 카드 (P0-1): src/lib/market/parse.ts · feed.ts, src/data/market-keywords.json · market-feed.json
 * 네트워크는 쓰지 않는다. 파서는 마켓뉴스 대시보드 마크업 모양의 짧은 HTML 로, 매핑은 실제 공고 제목 예로 확인.
 */
import { describe, it, expect } from 'vitest';
import keywordsJson from '../../../src/data/market-keywords.json';
import feedJson from '../../../src/data/market-feed.json';
import equipmentTypes from '../../../src/data/equipment-types.json';
import {
  daysLeft,
  ddayLabel,
  decodeEntities,
  hasKeyword,
  matchEquipment,
  parseBidsHtml,
  parseNewsHtml,
  purchaseMarkers,
} from '../../../src/lib/market/parse';
import { MarketFeedSchema, MarketKeywordsSchema, feedSourceRef, marketForEquipment, type MarketFeed } from '../../../src/lib/market/feed';
import { SourceRefSchema } from '../../../src/lib/market/source';

const rules = MarketKeywordsSchema.parse(keywordsJson).rules;
const bidIds = (title: string) => matchEquipment(title, rules, 'bids');
const newsIds = (title: string) => matchEquipment(title, rules, 'news');

const BIDS_HTML = `<table><tbody>
<tr data-bid data-kind="나라장터" data-group="bid" data-region="국내" data-deadline="2026-11-21T10:00" data-posted="2026-11-18" data-price="46490000"><td class="td bt-kind"><span class="tag">나라장터</span></td><td class="td td-wrap bt-title"><a href="https://www.g2b.go.kr/link/PNPE027_01/single/?bidPbancNo=R26BK01&amp;bidPbancOrd=000" target="_blank" rel="noopener noreferrer">우수조달물품(2026057, 폐쇄형배전반) 제3자단가계약<span class="sr-only">(새 창)</span></a></td><td class="td td-wrap bt-org">한국농어촌공사 &#39;경남&#39;</td><td class="td bt-posted">11/18</td></tr>
<tr data-bid data-kind="한전 입찰" data-deadline="2026-11-25T18:00" data-posted="2026-01-01"><td class="td td-wrap bt-title"><a href="https://srm.kepco.net/index.do#bid=E01" target="_blank">GIS(170KV,1250A,50KA) 1식 - 동부안S/S<span class="sr-only">(새 창)</span></a></td><td class="td td-wrap bt-org">본부</td></tr>
<tr data-bid data-kind="한전 입찰" data-deadline="2026-11-25T18:00" data-posted="2026-01-01"><td class="td td-wrap bt-title"><a href="https://srm.kepco.net/index.do#bid=E01" target="_blank">GIS(170KV,1250A,50KA) 1식 - 동부안S/S<span class="sr-only">(새 창)</span></a></td></tr>
<tr data-bid data-kind="나라장터" data-deadline="미정"><td><a href="https://www.g2b.go.kr/x">마감 없는 줄</a></td></tr>
<tr data-bid data-kind="나라장터" data-deadline="2026-11-25T18:00"><td><a href="javascript:alert(1)">https 아님</a></td></tr>
</tbody></table>`;

const NEWS_HTML = `
<article class="card" data-sec="technology" data-at="2026-11-17T11:38" hidden>
<a href="/go/92075308149b9733.html" class="ttl" target="_blank" title="x">LS ELECTRIC, 빅테크에 배전반 공급 &amp; 계약<span class="sr-only">(새 창)</span></a>
<div class="card-foot"><span class="meta card-src" title="에너지데일리 · 11/16 09:19">에너지데일리 · <span data-kst="2026-11-16T09:19">11/16 09:19</span></span></div>
</article>
<article class="card" data-sec="power_market" data-at="2026-11-17T11:38">
<a href="/go/92075308149b9733.html" class="ttl">LS ELECTRIC, 빅테크에 배전반 공급 &amp; 계약<span class="sr-only">(새 창)</span></a>
</article>
<article class="card" data-at="2026-11-18T07:00"><a href="/go/aa11.html" class="ttl">변압기 공급난</a></article>
<article class="card"><a href="https://example.com" class="ttl">대시보드 링크 아님</a></article>`;

describe('parse — 대시보드 HTML', () => {
  it('엔티티를 푼다', () => {
    expect(decodeEntities('a &amp; b &#39;c&#39; &#x41; &lt;')).toBe("a & b 'c' A <");
  });

  it('입찰 줄: 제목·발주처·마감·주소, 중복·마감 없음·https 아님은 버림', () => {
    const bids = parseBidsHtml(BIDS_HTML);
    expect(bids).toHaveLength(2);
    expect(bids[0]).toEqual({
      kind: '나라장터',
      title: '우수조달물품(2026057, 폐쇄형배전반) 제3자단가계약',
      org: "한국농어촌공사 '경남'",
      url: 'https://www.g2b.go.kr/link/PNPE027_01/single/?bidPbancNo=R26BK01&bidPbancOrd=000',
      posted: '2026-11-18',
      deadline: '2026-11-21T10:00',
    });
    expect(bids[1].kind).toBe('한전 입찰');
  });

  it('뉴스 카드: 같은 기사는 한 번, 매체·기사 시각(KST), 대시보드 /go 주소만', () => {
    const news = parseNewsHtml(NEWS_HTML);
    expect(news).toHaveLength(2);
    expect(news[0]).toEqual({
      id: '92075308149b9733',
      title: 'LS ELECTRIC, 빅테크에 배전반 공급 & 계약',
      media: '에너지데일리',
      at: '2026-11-16T09:19',
      url: 'https://lse-market-news.pages.dev/go/92075308149b9733.html',
    });
    expect(news[1]).toMatchObject({ id: 'aa11', media: '', at: '2026-11-18T07:00' });
  });
});

describe('키워드 → 기기 매핑표', () => {
  it('스키마 통과 + 모든 기기 id 가 equipment-types.json 에 있다', () => {
    const ids = new Set((equipmentTypes as Array<{ id: string }>).map((e) => e.id));
    for (const r of rules) for (const id of r.equipment) expect(ids, `알 수 없는 기기 id: ${id}`).toContain(id);
  });

  it('한글은 띄어쓰기 무시, 영문은 단어 경계·복수형', () => {
    expect(hasKeyword('가스절연 부하개폐기 구매', '가스절연부하개폐기')).toBe(true);
    expect(hasKeyword('BESS 입찰', 'ESS')).toBe(false);
    expect(hasKeyword('New transformers ordered', 'transformer')).toBe(true);
    expect(hasKeyword('GIS실 크레인', 'GIS')).toBe(true);
  });

  it.each([
    ['GIS(170KV,1250A,50KA) 1식 - 동부안S/S (종단BAY)', ['gis-154']],
    ['GIS(362KV,6300A/4000A) 23식 - 서화성S/S (신설)', ['ehv-gis']],
    ['호이스트크레인,25.8KV GIS실,380V,3TON', []],
    ['154kV가스절연변압기(20MVAx3,송가스풍냉,127595)1조-동대전S/S', ['main-tr']],
    ['고효율 주상변압기(50KVA(광유),단상3선식)외5종 - 광주전남본부 등', ['pole-tr']],
    ['을지로3가 변전소 고압배전용 몰드변압기 제작구매 설치', ['cast-tr']],
    ['국립공주대 대학본부 변압기 및 수배전반 교체공사 관급자재(수배전반) 구입', ['main-tr', 'oil-tr', 'cast-tr', 'mv-swgr', 'lv-swgr']],
    ['345KV 모선 보호배전반 1set (서대구SS) - 지역제한', ['relay-tx']],
    ['(재공고)25.8KV 내염형 ECO-부하개폐기(일반,자동) 14대 - 제주 외', ['auto-switch']],
    ['LED 등기구 12종 총194개 구매(논공S/S 56MW ESS 건설) [중기간경쟁품목]', []],
    ['도시가스 계량기 교체 및 원격검침시스템 결선공사 사업자 선정', []],
    ['강현어울림복합센터 건립공사(전기) 관급자재(수배전반, 전동기제어반, 분전반) 구입', ['mv-swgr', 'lv-swgr', 'mcc', 'panelboard', 'branch-mccb']],
  ])('공고 %s', (title, expected) => {
    expect(bidIds(title)).toEqual(expected);
  });

  it('뉴스: 고체(반도체) 변압기는 변압기 기기에 붙이지 않고, GIS 약어는 뉴스에 쓰지 않는다', () => {
    expect(newsIds('테슬라, 7.4MW급 고체변압기 파워코어 공개')).toEqual([]);
    expect(newsIds('Esri GIS platform update')).toEqual([]);
    expect(newsIds('미국 변압기 공급난 경고')).toEqual(['main-tr', 'oil-tr', 'cast-tr']);
  });
});

describe('구매 방식 · 마감', () => {
  it('공고 제목 표기만 읽는다', () => {
    expect(purchaseMarkers('우수조달물품(폐쇄형배전반) 제3자단가계약')).toEqual(['단가계약']);
    expect(purchaseMarkers('LED 등기구 [중기간경쟁품목]')).toEqual(['중소기업자간 경쟁제품']);
    expect(purchaseMarkers('보호배전반 1면 - 지역제한')).toEqual(['지역제한 경쟁입찰']);
    expect(purchaseMarkers('GIS 1식')).toEqual([]);
  });

  it('D-n 은 KST 날짜 기준, 지나면 null', () => {
    const now = new Date('2026-11-19T14:59:00Z'); // KST 11/19 23:59
    expect(daysLeft('2026-11-20T00:30', now)).toBe(1);
    expect(daysLeft('2026-11-19T23:59', now)).toBe(0);
    expect(daysLeft('2026-11-19T23:00', now)).toBeNull();
    expect(ddayLabel(0)).toBe('D-day');
    expect(ddayLabel(3)).toBe('D-3');
  });
});

describe('marketForEquipment', () => {
  const feed: MarketFeed = {
    schema: 1,
    fetchedAt: '2026-11-19T02:00:00Z',
    source: { title: 'LSE 마켓뉴스 대시보드', url: 'https://lse-market-news.pages.dev/', bidsUrl: 'https://lse-market-news.pages.dev/bids' },
    bids: [
      ...parseBidsHtml(BIDS_HTML),
      { kind: '나라장터', title: '칠산3지구 수배전반 제조·구매', org: 'a', url: 'https://www.g2b.go.kr/a', posted: '', deadline: '2026-11-20T12:00' },
      { kind: '나라장터', title: '지난 수배전반 단가계약', org: 'a', url: 'https://www.g2b.go.kr/b', posted: '', deadline: '2026-11-01T12:00' },
    ],
    news: parseNewsHtml(NEWS_HTML),
  };
  const now = new Date('2026-11-19T03:00:00Z');

  it('열린 공고만 마감 빠른 순, 구매 방식은 지난 공고까지 센다, 뉴스는 최신순', () => {
    const m = marketForEquipment('mv-swgr', now, { feed, rules });
    expect(m.openBids.map((b) => [b.title, b.days])).toEqual([
      ['칠산3지구 수배전반 제조·구매', 1],
      ['우수조달물품(2026057, 폐쇄형배전반) 제3자단가계약', 2],
    ]);
    expect(m.purchase).toEqual([expect.objectContaining({ label: '단가계약', count: 2 })]);
    expect(m.news.map((n) => n.id)).toEqual(['92075308149b9733']);
  });

  it('연결 없음 → 모두 빈 배열', () => {
    const m = marketForEquipment('hmi', now, { feed, rules });
    expect(m).toEqual({ openBids: [], news: [], purchase: [] });
  });

  it('출처 배지 값은 SourceRef 스키마를 통과', () => {
    expect(SourceRefSchema.safeParse(feedSourceRef(feed)).success).toBe(true);
    expect(feedSourceRef(feed).asof).toBe('2026-11-19');
  });
});

describe('커밋된 스냅샷 src/data/market-feed.json', () => {
  const parsed = MarketFeedSchema.safeParse(feedJson);

  it('스키마 통과 (수집 시각·출처 포함)', () => {
    expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues.slice(0, 3))).toBe(true);
  });

  it('남긴 공고·기사는 모두 매핑표에 걸린다', () => {
    if (!parsed.success) return;
    for (const b of parsed.data.bids) expect(bidIds(b.title).length, b.title).toBeGreaterThan(0);
    for (const n of parsed.data.news) expect(newsIds(n.title).length, n.title).toBeGreaterThan(0);
  });
});
