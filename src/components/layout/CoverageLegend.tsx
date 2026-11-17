import { COVERAGES } from '../../lib/schema';
import CoverageBadge from '../common/CoverageBadge';

export default function CoverageLegend() {
  return (
    <ul className="legend" aria-label="커버리지 범례" data-testid="legend">
      {COVERAGES.map((c) => (
        <li key={c} data-testid={`legend-item-${c}`}>
          <CoverageBadge coverage={c} />
        </li>
      ))}
    </ul>
  );
}
