import { COVERAGE_LABELS } from '../../lib/labels';
import { getDiagramModel, type NodeItem } from '../../lib/diagram/model';

/** "계통에서 연결된 기기" 칩 — 누르면 그 기기로 선택 이동 */
export default function NeighborChips({ node, onSelect }: { node: NodeItem; onSelect: (id: string) => void }) {
  const list = getDiagramModel().neighbors.get(node.id) ?? [];
  if (list.length === 0) return null;
  return (
    <section className="dp-section dp-section--divided" aria-labelledby="dp-neighbors">
      <h3 id="dp-neighbors" className="dp-label">
        계통에서 연결된 기기
      </h3>
      <div className="dp-chips">
        {list.map((n) => (
          <button
            key={n.node.id}
            type="button"
            className={`dp-chip dp-chip--${n.node.coverage}`}
            onClick={() => onSelect(n.node.id)}
            aria-label={`${n.node.eq.name}, ${COVERAGE_LABELS[n.node.coverage]} — 선택`}
          >
            <span aria-hidden="true">{n.arrow}</span> {n.node.eq.abbr ?? n.node.eq.name}
            {n.kind === 'signal' && <span className="dp-chip__kind"> · 신호</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
