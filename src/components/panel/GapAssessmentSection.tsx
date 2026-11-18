import type { EquipmentType } from '../../lib/schema';
import {
  GAP_BASIS_LABELS,
  SUPPLY_MODE_LABELS,
  assessmentTitle,
  confidenceLabel,
  gapConfidence,
  isReviewOverdue,
} from '../../lib/labels';
import ExternalLink from '../common/ExternalLink';

const EVIDENCE_LABELS = { url: '링크', doc: '문서', meeting: '회의' } as const;

/**
 * 상세 패널 "공백 판정" 섹션 (개선 R3) — gapAssessment 가 있는 기기.
 * 공백류: 확신도 배지(후보/확정)·판정 근거·공급 방식·근거 자료·확인 부서/일·재확인 기한·정격 범위.
 * 보유 기기(GIS·승압 TR)는 "정격 확인 필요" 로만 표시 (테두리는 그대로).
 */
export default function GapAssessmentSection({ eq }: { eq: EquipmentType }) {
  const g = eq.gapAssessment;
  if (!g) return null;
  const conf = gapConfidence(eq);
  const overdue = isReviewOverdue(g);
  const rating = g.ratingScope && (g.ratingScope.required || g.ratingScope.offered);
  return (
    <section className="dp-section dp-gapassess" aria-labelledby="dp-gapassess-title" data-testid="detail-gap-assessment">
      <h3 id="dp-gapassess-title" className="dp-label">
        {conf ? assessmentTitle(eq.coverage) : '정격 확인'}
      </h3>
      <div className="dp-gapassess__badges">
        {conf ? (
          <span className={`dp-conf dp-conf--${conf}`} data-testid="detail-gap-confidence" data-confidence={conf}>
            {confidenceLabel(eq.coverage, conf)}
          </span>
        ) : (
          <span className="dp-conf dp-conf--rating" data-testid="detail-rating-check">
            정격 확인 필요
          </span>
        )}
        {overdue && (
          <span className="dp-conf dp-conf--overdue" data-testid="detail-gap-overdue">
            재확인 필요
          </span>
        )}
      </div>
      {conf === 'candidate' && (
        <p className="dp-muted dp-gapassess__hint">
          {g.confidence === 'confirmed' && overdue
            ? `확정 판정이지만 재확인 기한(${g.reviewDue})이 지나 후보로 표시합니다 — 사업부·연구소 재확인이 필요합니다.`
            : `후보 — ${GAP_BASIS_LABELS[g.basis]} 기준 판정이며 사업부·연구소 확인 전입니다.`}
        </p>
      )}
      <dl className="dp-gapassess__list">
        <dt>판정 근거</dt>
        <dd>{GAP_BASIS_LABELS[g.basis]}</dd>
        <dt>공급 방식</dt>
        <dd>{SUPPLY_MODE_LABELS[g.supplyMode]}</dd>
        {rating && (
          <>
            <dt>정격 범위</dt>
            <dd data-testid="detail-rating-scope">
              필요 {g.ratingScope?.required ?? '—'} · 자사 {g.ratingScope?.offered ?? '—'}
            </dd>
          </>
        )}
        <dt>확인</dt>
        <dd>{g.verifiedBy ? `${g.verifiedBy}${g.verifiedAt ? ` · ${g.verifiedAt}` : ''}` : '확인 전'}</dd>
        {g.reviewDue && (
          <>
            <dt>재확인 기한</dt>
            <dd className={overdue ? 'dp-gapassess__overdue' : undefined}>
              {g.reviewDue}
              {overdue ? ' (지남)' : ''}
            </dd>
          </>
        )}
      </dl>
      {g.evidence && g.evidence.length > 0 && (
        <ul className="dp-gapassess__evidence">
          {g.evidence.map((ev, i) => (
            <li key={`${ev.ref}-${i}`}>
              <span className="dp-muted">{EVIDENCE_LABELS[ev.type]}</span>{' '}
              {ev.type === 'url' && /^https:\/\//.test(ev.ref) ? (
                <ExternalLink href={ev.ref}>{ev.note ?? ev.ref} ↗</ExternalLink>
              ) : (
                <span>
                  {ev.ref}
                  {ev.note ? ` — ${ev.note}` : ''}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
