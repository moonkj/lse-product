import { z } from 'zod';
import type { SourceRef } from './source';
import { daysLeft, matchEquipment, purchaseMarkers, type KeywordRule } from './parse';
import feedJson from '../../data/market-feed.json';
import keywordsJson from '../../data/market-keywords.json';

/**
 * 시장 동향 카드 (P0-1) 데이터 — src/data/market-feed.json (scripts/fetch-market.mjs 가 만드는 스냅샷)
 * + src/data/market-keywords.json (키워드→기기 매핑, 마켓뉴스와 공용).
 * 공고·뉴스는 마켓뉴스 대시보드가 모은 것을 그대로 쓰고, 제품맵은 기기별로 묶어 링크만 보여 준다.
 */

const KST_MINUTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const httpsUrl = z.string().url().startsWith('https://');

export const KeywordRuleSchema = z.object({
  keywords: z.array(z.string().min(1)).min(1),
  with: z.array(z.string().min(1)).min(1).optional(),
  exclude: z.array(z.string().min(1)).optional(),
  only: z.enum(['bids', 'news']).optional(),
  equipment: z.array(z.string().min(1)).min(1),
});

export const MarketKeywordsSchema = z.object({
  version: z.literal(1),
  about: z.string().optional(),
  match: z.string().optional(),
  rules: z.array(KeywordRuleSchema).min(1),
});
export type MarketKeywords = z.infer<typeof MarketKeywordsSchema>;

export const FeedBidSchema = z.object({
  kind: z.string().min(1),
  title: z.string().min(1),
  org: z.string(),
  url: httpsUrl,
  posted: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  deadline: z.string().regex(KST_MINUTE),
});
export type FeedBid = z.infer<typeof FeedBidSchema>;

export const FeedNewsSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  media: z.string(),
  at: z.string().regex(KST_MINUTE),
  url: httpsUrl,
});
export type FeedNews = z.infer<typeof FeedNewsSchema>;

export const MarketFeedSchema = z.object({
  schema: z.literal(1),
  /** 수집 스크립트가 파일을 쓴 시각 (ISO) */
  fetchedAt: z.string().datetime({ offset: true }),
  source: z.object({
    title: z.string().min(1),
    url: httpsUrl,
    bidsUrl: httpsUrl,
  }),
  bids: z.array(FeedBidSchema),
  news: z.array(FeedNewsSchema),
});
export type MarketFeed = z.infer<typeof MarketFeedSchema>;

const EMPTY_FEED: MarketFeed = {
  schema: 1,
  fetchedAt: '1970-01-01T00:00:00Z',
  source: { title: '', url: 'https://lse-market-news.pages.dev/', bidsUrl: 'https://lse-market-news.pages.dev/bids' },
  bids: [],
  news: [],
};

let cached: { feed: MarketFeed; rules: KeywordRule[] } | null = null;

/** 스냅샷·매핑표 검증 (빌드 실패는 단위 테스트가 맡고, 앱은 깨진 스냅샷이면 카드만 비운다) */
export function getMarketData(): { feed: MarketFeed; rules: KeywordRule[] } {
  if (cached) return cached;
  const feed = MarketFeedSchema.safeParse(feedJson);
  const kw = MarketKeywordsSchema.safeParse(keywordsJson);
  if (!feed.success || !kw.success) console.warn('[market] 시장 동향 스냅샷 또는 매핑표 검증 실패 — 카드를 비웁니다');
  cached = { feed: feed.success ? feed.data : EMPTY_FEED, rules: kw.success ? kw.data.rules : [] };
  return cached;
}

export interface OpenBid extends FeedBid {
  /** 마감까지 남은 날 (0 = 오늘) */
  days: number;
}

export interface PurchaseMarker {
  label: string;
  count: number;
  /** 표기가 처음 보인 공고 (근거 링크) */
  example: FeedBid;
}

export interface EquipmentMarket {
  /** 마감 전 공고 — 마감 빠른 순 */
  openBids: OpenBid[];
  /** 연결 뉴스 — 최신순 */
  news: FeedNews[];
  /** 연결 공고 제목에 적힌 구매 방식 (마감 지난 공고 포함, 스냅샷 범위 안) */
  purchase: PurchaseMarker[];
}

export function marketForEquipment(
  equipmentId: string,
  now: Date,
  data: { feed: MarketFeed; rules: KeywordRule[] } = getMarketData(),
): EquipmentMarket {
  const { feed, rules } = data;
  const linkedBids = feed.bids.filter((b) => matchEquipment(b.title, rules, 'bids').includes(equipmentId));
  const openBids: OpenBid[] = [];
  for (const b of linkedBids) {
    const days = daysLeft(b.deadline, now);
    if (days !== null) openBids.push({ ...b, days });
  }
  openBids.sort((a, b) => a.deadline.localeCompare(b.deadline));

  const purchase: PurchaseMarker[] = [];
  for (const b of linkedBids) {
    for (const label of purchaseMarkers(b.title)) {
      const hit = purchase.find((p) => p.label === label);
      if (hit) hit.count += 1;
      else purchase.push({ label, count: 1, example: b });
    }
  }

  const news = feed.news
    .filter((n) => matchEquipment(n.title, rules, 'news').includes(equipmentId))
    .sort((a, b) => b.at.localeCompare(a.at));

  return { openBids, news, purchase };
}

/** 카드 출처 배지 — 대시보드가 모은 공고·기사 묶음이므로 '2차 인용', 기준일 = 수집일(KST) */
export function feedSourceRef(feed: MarketFeed): SourceRef {
  const asof = new Date(Date.parse(feed.fetchedAt) + 9 * 3600_000).toISOString().slice(0, 10);
  return {
    title: `${feed.source.title} (나라장터·한전 전자입찰 공고, 언론 기사 모음)`,
    url: feed.source.url,
    asof,
    confidence: 'secondary',
  };
}
