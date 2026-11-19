import { useId, useMemo } from 'react';
import { useData } from '../../data/load';
import { feedSourceRef, getMarketData, marketForEquipment } from '../../lib/market/feed';
import { ddayLabel } from '../../lib/market/parse';
import SourceBadge from './SourceBadge';
import EquipmentSignals from './EquipmentSignals';
import './MarketCard.css';

/**
 * 기기 상세 '시장 동향' 카드 (전력시장 10인 토론 P0-1).
 * 마켓뉴스 대시보드가 모은 입찰 공고·뉴스 중 이 기기에 연결된 것(키워드 매핑표 기준)만 요약하고 원문으로 링크한다.
 * 구매 방식은 연결 공고 제목에 적힌 표기만 보여 준다(추정하지 않음).
 */

const MAX_BIDS = 5;
const MAX_NEWS = 3;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 'YYYY-MM-DDTHH:MM' (KST) → '11/22(토) 18:00' */
function deadlineLabel(deadline: string): string {
  const [d, t] = deadline.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
  return `${m}/${day}(${wd}) ${t}`;
}

/** 'YYYY-MM-DDTHH:MM' → '11/18' */
function dateLabel(at: string): string {
  const [, m, d] = at.slice(0, 10).split('-').map(Number);
  return `${m}/${d}`;
}

function fetchedLabel(iso: string): string {
  const k = new Date(Date.parse(iso) + 9 * 3600_000).toISOString();
  return `${Number(k.slice(5, 7))}/${Number(k.slice(8, 10))} ${k.slice(11, 16)}`;
}

export interface MarketCardProps {
  equipmentId: string;
  /** panel = 우측 패널(작은 제목), page = 기기 페이지 카드 */
  variant?: 'panel' | 'page';
  /** 테스트용 기준 시각 */
  now?: Date;
}

export default function MarketCard({ equipmentId, variant = 'panel', now }: MarketCardProps) {
  const headingId = useId();
  const layer = useData().equipmentTypeById.get(equipmentId)?.layer ?? '';
  const nowMs = now?.getTime();
  const data = getMarketData();
  const m = useMemo(
    () => marketForEquipment(equipmentId, nowMs === undefined ? new Date() : new Date(nowMs), data),
    [equipmentId, nowMs, data],
  );
  const { feed } = data;
  const hasFeed = feed.source.title !== '';
  const empty = m.openBids.length === 0 && m.news.length === 0;
  const Heading = variant === 'page' ? 'h2' : 'h3';
  const Sub = variant === 'page' ? 'h3' : 'h4';

  return (
    <section
      className={variant === 'page' ? 'pg-card mkt mkt--page' : 'dp-section mkt mkt--panel'}
      aria-labelledby={headingId}
      data-testid="market-card"
    >
      <div className="mkt__head">
        <Heading id={headingId} className={variant === 'page' ? undefined : 'dp-label'}>
          시장 동향
        </Heading>
        {hasFeed && (
          <span className="mkt__src">
            <SourceBadge source={feedSourceRef(feed)} />
            <span className="mkt__fetched">수집 {fetchedLabel(feed.fetchedAt)}</span>
          </span>
        )}
      </div>

      {m.openBids.length > 0 && (
        <div className="mkt__block">
          <Sub className="mkt__sub">
            열린 입찰 공고 <span className="mkt__count">· {m.openBids.length}건</span>
          </Sub>
          <ul className="mkt__list" data-testid="market-bids">
            {m.openBids.slice(0, MAX_BIDS).map((b) => (
              <li key={`${b.url}|${b.title}`} className="mkt__item">
                <span className={b.days <= 3 ? 'mkt__dday mkt__dday--soon' : 'mkt__dday'}>{ddayLabel(b.days)}</span>
                <span className="mkt__body">
                  <a href={b.url} target="_blank" rel="noopener noreferrer" className="mkt__title">
                    {b.title}
                    <span className="visually-hidden">(새 창)</span>
                  </a>
                  <span className="mkt__meta">
                    {b.kind}
                    {b.org && ` · ${b.org}`} · 마감 {deadlineLabel(b.deadline)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {m.openBids.length > MAX_BIDS && (
            <a href={feed.source.bidsUrl} target="_blank" rel="noopener noreferrer" className="mkt__more">
              외 {m.openBids.length - MAX_BIDS}건 — 마켓뉴스 입찰 전체 보기 ↗
            </a>
          )}
        </div>
      )}

      {m.purchase.length > 0 && (
        <p className="mkt__purchase" data-testid="market-purchase">
          <span className="mkt__k">구매 방식</span>
          {m.purchase.map((p, i) => (
            <span key={p.label}>
              {i > 0 && ' · '}
              <a href={p.example.url} target="_blank" rel="noopener noreferrer" title={p.example.title}>
                {p.label} {p.count}건<span aria-hidden="true"> ↗</span>
                <span className="visually-hidden">(새 창, 근거 공고)</span>
              </a>
            </span>
          ))}
          <span className="mkt__note">공고 제목 표기 기준</span>
        </p>
      )}

      {m.news.length > 0 && (
        <div className="mkt__block">
          <Sub className="mkt__sub">관련 뉴스</Sub>
          <ul className="mkt__list" data-testid="market-news">
            {m.news.slice(0, MAX_NEWS).map((n) => (
              <li key={n.id} className="mkt__item mkt__item--news">
                <span className="mkt__body">
                  <a href={n.url} target="_blank" rel="noopener noreferrer" className="mkt__title">
                    {n.title}
                    <span className="visually-hidden">(새 창)</span>
                  </a>
                  <span className="mkt__meta">
                    {n.media && `${n.media} · `}
                    {dateLabel(n.at)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {empty && (
        <p className="mkt__empty" data-testid="market-empty">
          최근 연결된 공고·뉴스 없음
        </p>
      )}

      <EquipmentSignals equipmentId={equipmentId} layer={layer} />
    </section>
  );
}
