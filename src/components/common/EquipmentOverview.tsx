import { Fragment } from 'react';
import type { EquipmentType } from '../../lib/schema';
import { groupOverviewSources, OVERVIEW_SOURCE_LIMIT, overviewText } from '../../lib/overview';
import { pageHref } from '../../lib/pages/compare';
import ExternalLink from './ExternalLink';
import './EquipmentOverview.css';

/**
 * 근거 한 줄 — catalog: "근거: [Susol VCB] 카탈로그 p.2·5 ↗" (같은 URL 은 쪽을 묶고 각 쪽은 url#page=N 새 탭),
 * general: "일반 기술 설명". 출처 묶음은 최대 3개, 나머지는 "외 N건".
 */
export function OverviewSources({ eq, testId = 'overview-sources' }: { eq: EquipmentType; testId?: string }) {
  const ov = eq.overview;
  if (!ov) return null;
  if (ov.basis === 'general' || ov.sources.length === 0) {
    return (
      <p className="ov-src" data-testid={testId} data-basis="general">
        일반 기술 설명
      </p>
    );
  }
  const groups = groupOverviewSources(ov.sources);
  const shown = groups.slice(0, OVERVIEW_SOURCE_LIMIT);
  const rest = groups.length - shown.length;
  return (
    <p className="ov-src" data-testid={testId} data-basis="catalog">
      근거:{' '}
      {shown.map((g, gi) => (
        <Fragment key={g.url}>
          {gi > 0 && ', '}
          {g.pages.length === 0 ? (
            <ExternalLink href={g.url} className="ov-src__link">
              {g.title}
              <span aria-hidden="true"> ↗</span>
            </ExternalLink>
          ) : (
            <span className="ov-src__item">
              {g.title} p.
              {g.pages.map((p, pi) => (
                <Fragment key={p}>
                  {pi > 0 && '·'}
                  <ExternalLink href={pageHref(g.url, p)} className="ov-src__link" title={`${g.title} ${p}쪽`}>
                    <span className="visually-hidden">{g.title} </span>
                    {p}
                    <span className="visually-hidden">쪽</span>
                  </ExternalLink>
                </Fragment>
              ))}
              <span aria-hidden="true"> ↗</span>
            </span>
          )}
        </Fragment>
      ))}
      {rest > 0 && ` 외 ${rest}건`}
    </p>
  );
}

/** 계통에서 하는 일 — 상세 설명 문단 + 근거 줄 (overview 가 없으면 description 한 줄만) */
export default function EquipmentOverview({ eq, className = '', testId }: { eq: EquipmentType; className?: string; testId?: string }) {
  return (
    <>
      <p className={`ov-text ${className}`.trim()} data-testid={testId} data-overview={eq.overview ? 'true' : 'false'}>
        {overviewText(eq)}
      </p>
      <OverviewSources eq={eq} />
    </>
  );
}
