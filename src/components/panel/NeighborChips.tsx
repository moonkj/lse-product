import { COVERAGE_LABELS, gapConfidence } from '../../lib/labels';
import { getDiagramModel, type NodeItem } from '../../lib/diagram/model';

const KIND_SUFFIX = { power: '', signal: ' · 신호', alt: ' · 택1' } as const;

/**
 * "계통에서 연결된 기기" 칩 — 누르면 그 기기로 선택 이동.
 * 모선은 건너뛰고 모선 너머 기기를 칩으로, 끝점(기기 아님)은 라벨 텍스트로 표시.
 */
export default function NeighborChips({ node, onSelect }: { node: NodeItem; onSelect: (id: string) => void }) {
  const model = getDiagramModel();
  const list = model.neighbors.get(node.id) ?? [];
  const endpoints = model.endpointNeighbors.get(node.id) ?? [];
  if (list.length === 0 && endpoints.length === 0) return null;
  return (
    <section className="dp-section dp-section--divided" aria-labelledby="dp-neighbors">
      <h3 id="dp-neighbors" className="dp-label">
        계통에서 연결된 기기
      </h3>
      {list.length > 0 && (
        <div className="dp-chips">
          {list.map((n) => {
            const name = n.node.eq.abbr ?? n.node.eq.name;
            const refText = n.node.ref ? ` (참조${n.node.refLabel ? ` · ${n.node.refLabel}` : ''})` : '';
            return (
              <button
                key={n.node.id}
                type="button"
                className={`dp-chip dp-chip--${n.node.coverage}`}
                data-confidence={gapConfidence(n.node.eq)}
                data-testid={`neighbor-chip-${n.node.id}`}
                onClick={() => onSelect(n.node.id)}
                title={n.via ? `${n.via} 경유${n.sibling ? ' · 같은 모선에서 갈라진 회로' : ''}` : undefined}
                aria-label={`${n.node.eq.name}${refText}, ${COVERAGE_LABELS[n.node.coverage]}${n.via ? `, ${n.via} 경유` : ''} — 선택`}
              >
                {n.arrow && <span aria-hidden="true">{n.arrow} </span>}
                {name}
                {refText && <span className="dp-chip__kind">{refText}</span>}
                {KIND_SUFFIX[n.kind] && <span className="dp-chip__kind">{KIND_SUFFIX[n.kind]}</span>}
              </button>
            );
          })}
        </div>
      )}
      {endpoints.length > 0 && (
        <p className="dp-endpoints" data-testid="neighbor-endpoints">
          {endpoints.map((p) => `${p.arrow} ${p.label}`).join(' · ')}
        </p>
      )}
    </section>
  );
}
