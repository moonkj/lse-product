/**
 * 컴포넌트 테스트 — 기기 상세 '시장 동향' 카드 (P0-1). 커밋된 스냅샷으로 렌더링만 확인 (네트워크 없음).
 * 대상 기기는 스냅샷에서 조건으로 고른다 (id 하드코딩 금지 — 없으면 skip).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import MarketCard from '../../../src/components/market/MarketCard';
import { getMarketData, marketForEquipment } from '../../../src/lib/market/feed';
import { getData } from '../../../src/data/load';

afterEach(cleanup);

const { feed } = getMarketData();
const at = new Date(feed.fetchedAt);
const ids = getData().equipmentTypes.map((e) => e.id);
const withBids = ids.find((id) => marketForEquipment(id, at).openBids.length > 0);
const withNews = ids.find((id) => marketForEquipment(id, at).news.length > 0);

describe('MarketCard', () => {
  it('먼 미래 기준이면 열린 공고가 없고, 뉴스도 없는 기기는 "최근 연결된 공고·뉴스 없음"', () => {
    const none = ids.find((id) => marketForEquipment(id, at).news.length === 0);
    if (!none) return;
    render(<MarketCard equipmentId={none} now={new Date('2100-01-01T00:00:00Z')} />);
    expect(screen.getByTestId('market-empty')).toHaveTextContent('최근 연결된 공고·뉴스 없음');
    expect(screen.getByRole('heading', { name: '시장 동향' })).toBeInTheDocument();
  });

  it.skipIf(!withBids)('열린 공고: D-n 과 새 창 링크, 출처 배지', () => {
    render(<MarketCard equipmentId={withBids!} now={at} />);
    const list = screen.getByTestId('market-bids');
    const first = within(list).getAllByRole('listitem')[0];
    expect(first.textContent).toMatch(/D-(day|\d+)/);
    const link = within(first).getByRole('link');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('href')).toMatch(/^https:\/\//);
    expect(screen.getByTestId('market-card').querySelector('.mkt__src .msrc--secondary')).not.toBeNull();
    expect(screen.queryByTestId('market-empty')).toBeNull();
  });

  it.skipIf(!withNews)('관련 뉴스: 최대 3건, 대시보드 원문 링크', () => {
    render(<MarketCard equipmentId={withNews!} now={at} variant="page" />);
    const items = within(screen.getByTestId('market-news')).getAllByRole('listitem');
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(3);
    expect(within(items[0]).getByRole('link').getAttribute('href')).toMatch(/^https:\/\/lse-market-news\.pages\.dev\/go\//);
    expect(screen.getByRole('heading', { level: 2, name: '시장 동향' })).toBeInTheDocument();
  });
});
