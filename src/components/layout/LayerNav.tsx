import { useLocation, useNavigate } from 'react-router-dom';
import { LAYER_LABELS, type Layer } from '../../lib/schema';
import { useData } from '../../data/load';

export const layerBandId = (layer: Layer) => `layer-band-${layer}`;

/** 다른 페이지에서 계층 점프 시 navigate state 로 넘기는 값 */
export interface JumpState {
  jumpTo?: Layer;
}

/** 계통도의 해당 밴드로 이동 (Phase 2 줌/패닝 도입 시 이 함수만 교체) */
export function jumpToLayer(layer: Layer) {
  document.getElementById(layerBandId(layer))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** 좌측 계층 점프 내비 — 순서는 diagram.json layers 기준 */
export default function LayerNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const layers = useData().diagram.layers.map((l) => l.id);

  const jump = (layer: Layer) => {
    if (pathname === '/') jumpToLayer(layer);
    // 계통도가 아직 마운트되지 않았으므로 도착한 쪽(DiagramCanvas)이 마운트 후 스크롤
    else navigate('/', { state: { jumpTo: layer } satisfies JumpState });
  };

  return (
    <nav className="layer-nav" aria-label="계층 점프" data-testid="layer-nav">
      <h2 className="layer-nav__title">계층 점프</h2>
      <ul>
        {layers.map((layer) => (
          <li key={layer}>
            <button
              type="button"
              className={`layer-nav__btn layer-nav__btn--${layer.toLowerCase()}`}
              data-testid={`layer-nav-${layer}`}
              onClick={() => jump(layer)}
            >
              <span className="layer-nav__code">{layer}</span>
              <span className="layer-nav__label">{LAYER_LABELS[layer]}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
