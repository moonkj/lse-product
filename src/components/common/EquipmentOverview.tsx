import type { EquipmentType, OverviewPoint } from '../../lib/schema';
import { overviewParts } from '../../lib/overview';
import './EquipmentOverview.css';

/** 항목 목록 — 라벨(dt) + 본문(dd). 비교 화면 "더 보기" 도 이 목록을 쓴다 */
export function OverviewPoints({ points, id }: { points: OverviewPoint[]; id?: string }) {
  if (points.length === 0) return null;
  return (
    <dl className="ov-points" id={id} data-testid="overview-points">
      {points.map((p, i) => (
        <div className="ov-point" key={i}>
          <dt className="ov-point__label">{p.label}</dt>
          <dd className="ov-point__text">{p.text}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 계통에서 하는 일 — 요약 문단 + 항목 목록 (overview 가 없으면 description 한 줄만) */
export default function EquipmentOverview({ eq, className = '', testId }: { eq: EquipmentType; className?: string; testId?: string }) {
  const { summary, points } = overviewParts(eq);
  return (
    <div className={`ov ${className}`.trim()} data-testid={testId} data-overview={eq.overview ? 'true' : 'false'}>
      <p className="ov-summary" data-testid="overview-summary">
        {summary}
      </p>
      <OverviewPoints points={points} />
    </div>
  );
}
