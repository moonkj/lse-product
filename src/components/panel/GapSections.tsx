import { Link } from 'react-router-dom';
import { isGapCoverage } from '../../lib/labels';
import { getDiagramModel, layerTitle, type NodeItem } from '../../lib/diagram/model';
import { productsForEquipment } from '../../lib/pages/catalog';
import EquipmentVisual from '../pages/EquipmentVisual';

/** Gap 모드 전용: 인접 노드 중 보유 기기 + 같은 계층의 공백 */
export default function GapSections({ node, onSelect }: { node: NodeItem; onSelect: (id: string) => void }) {
  const model = getDiagramModel();
  const owned = (model.neighbors.get(node.id) ?? []).filter((n) => n.node.coverage === 'owned');
  const sameLayerGaps = model.nodes.filter((n) => n.layer === node.layer && isGapCoverage(n.coverage));
  const c = model.coverageCounts;
  return (
    <>
      <section className="dp-section" aria-labelledby="dp-gap-related">
        <h3 id="dp-gap-related" className="dp-label">
          이 기기와 연결된 자사 제품
        </h3>
        {owned.length > 0 ? (
          <ul className="dp-related">
            {owned.map((n) => {
              const first = productsForEquipment(n.node.eq.id)[0];
              return (
                <li key={n.node.id}>
                  <button type="button" className="dp-related__item" onClick={() => onSelect(n.node.id)}>
                    <EquipmentVisual eq={n.node.eq} thumb size={40} />
                    <span>
                      <strong>{n.node.eq.name}</strong>
                      <span className="dp-muted">
                        {n.kind === 'signal' ? '신호로 연결' : n.kind === 'alt' ? '택1 연결' : '같은 회로'}
                        {first ? ` · ${first.name}` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="dp-muted">계통에서 바로 연결된 보유 기기가 없습니다.</p>
        )}
      </section>
      <section className="dp-section dp-section--divided" aria-labelledby="dp-gap-layer">
        <h3 id="dp-gap-layer" className="dp-label">
          같은 계층({layerTitle(node.layer)})의 보완 필요 기기
        </h3>
        <div className="dp-chips">
          {sameLayerGaps.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`dp-gapchip${n.eq.id === node.eq.id ? ' is-current' : ''}`}
              aria-current={n.eq.id === node.eq.id ? 'true' : undefined}
              onClick={() => onSelect(n.id)}
            >
              {n.eq.abbr ?? n.eq.name}
            </button>
          ))}
        </div>
        <p className="dp-muted">
          전체 {model.nodes.length}종 · 미보유 <b>{c.missing}</b> · 일부 보유 <b>{c.partial}</b> · 계열사 보유 <b>{c.affiliate}</b> · 패널 구성품 <b>{c.sourced}</b>
        </p>
        <Link to="/gap" className="dp-strong-link">
          라인업 현황에서 전체 보기 →
        </Link>
      </section>
    </>
  );
}
