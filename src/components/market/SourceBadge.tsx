import { CONFIDENCE_LABELS, type SourceRef } from '../../lib/market/source';
import './market.css';

/** 출처 배지 — 신뢰도 3단계 색 + 기관·기준일, 누르면 원문 (새 탭). 모든 시장 수치 옆에 붙인다. */
export default function SourceBadge({ source, needsCheck }: { source: SourceRef; needsCheck?: boolean }) {
  return (
    <a
      className={`msrc msrc--${source.confidence}`}
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${source.title} · 기준 ${source.asof} · ${CONFIDENCE_LABELS[source.confidence]}`}
    >
      <span className="msrc__level">{CONFIDENCE_LABELS[source.confidence]}</span>
      <span className="msrc__asof">{source.asof}</span>
      {needsCheck && <span className="msrc__check">확인 필요</span>}
      <span aria-hidden="true">↗</span>
    </a>
  );
}
