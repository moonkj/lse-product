import { COVERAGE_LABELS, COVERAGES, type Coverage } from '../../lib/schema';
import { getDiagramModel } from '../../lib/diagram/model';
import type { ViewMode } from '../../store/useAppStore';
import { COVERAGE_ICONS } from '../common/CoverageBadge';

const GAP_ORDER: Coverage[] = ['missing', 'partial', 'affiliate', 'owned', 'na'];
const GAP_RULE: Record<Coverage, string> = {
  missing: '미보유 — 강조',
  partial: '일부 보유 — 강조',
  affiliate: '계열사 보유 — 보통',
  owned: '보유 — 흐리게',
  na: '해당 없음 — 흐리게',
};

/** 커버리지 막대 + 범례 5종(개수). Gap 모드에서는 "Gap 모드 표시 규칙" 으로 바뀐다 */
export default function CoverageLegend({ mode = 'product' }: { mode?: ViewMode }) {
  const model = getDiagramModel();
  const counts = model.coverageCounts;
  const gap = mode === 'gap';
  const order = gap ? GAP_ORDER : COVERAGES;

  return (
    <div className="nav-legend">
      <h2 className="nav-section-title">
        {gap ? (
          'Gap 모드 표시 규칙'
        ) : (
          <>
            커버리지 <span className="nav-section-title__sub">· 기기 {model.nodes.length}종</span>
          </>
        )}
      </h2>
      {!gap && (
        <div className="cov-bar" aria-hidden="true">
          {COVERAGES.map((c) =>
            counts[c] > 0 ? <span key={c} className={`cov-bar__seg cov-badge--${c}`} style={{ flexGrow: counts[c] }} /> : null,
          )}
        </div>
      )}
      <ul className="legend" aria-label="커버리지 범례" data-testid="legend">
        {order.map((c) => {
          const faded = gap && (c === 'owned' || c === 'na');
          return (
            <li key={c} className={`legend__item${faded ? ' legend__item--faded' : ''}`} data-testid={`legend-item-${c}`}>
              <span className={`cov-badge cov-badge--${c}`}>
                <span className="cov-badge__icon" aria-hidden="true" data-testid={`coverage-icon-${c}`}>
                  {COVERAGE_ICONS[c]}
                </span>
              </span>
              <span className="legend__label">{gap ? GAP_RULE[c] : COVERAGE_LABELS[c]}</span>
              <span className="legend__count">{counts[c]}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
