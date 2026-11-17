import { COVERAGE_LABELS, type Coverage } from '../../lib/schema';
import './CoverageBadge.css';

/** 색약 대응: 색과 함께 모양이 다른 아이콘을 병행 */
export const COVERAGE_ICONS: Record<Coverage, string> = {
  owned: '✓',
  partial: '◐',
  affiliate: '◆',
  missing: '✕',
  na: '–',
};

interface Props {
  coverage: Coverage;
  /** false 면 아이콘만 (라벨은 스크린리더용) */
  showLabel?: boolean;
  testId?: string;
}

export default function CoverageBadge({ coverage, showLabel = true, testId }: Props) {
  const label = COVERAGE_LABELS[coverage];
  return (
    <span className={`cov-badge cov-badge--${coverage}`} title={label} data-testid={testId} data-coverage={coverage}>
      <span className="cov-badge__icon" aria-hidden="true" data-testid={`coverage-icon-${coverage}`}>
        {COVERAGE_ICONS[coverage]}
      </span>
      {showLabel ? <span className="cov-badge__label">{label}</span> : <span className="visually-hidden">{label}</span>}
    </span>
  );
}
