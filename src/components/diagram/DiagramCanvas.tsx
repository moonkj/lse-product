import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../../data/load';
import { useAppStore } from '../../store/useAppStore';
import { jumpToLayer, layerBandId, type JumpState } from '../layout/LayerNav';
import './DiagramCanvas.css';

/** 계통도 영역 placeholder — 실제 SVG 렌더러는 Phase 2 */
export default function DiagramCanvas() {
  const { diagram } = useData();
  const layerFilter = useAppStore((s) => s.layerFilter);
  const showAllLayers = useAppStore((s) => s.showAllLayers);
  const location = useLocation();
  const navigate = useNavigate();

  // 다른 페이지에서 계층 점프로 들어온 경우: 마운트(렌더 완료) 후 스크롤, 뒤로가기 시 반복되지 않게 state 제거
  const jumpTo = (location.state as JumpState | null)?.jumpTo;
  useEffect(() => {
    if (!jumpTo) return;
    jumpToLayer(jumpTo);
    navigate(location.pathname + location.search, { replace: true, state: null });
  }, [jumpTo, navigate, location.pathname, location.search]);

  const visible = diagram.layers.filter((l) => layerFilter.includes(l.id));

  return (
    <section className="diagram-canvas" aria-labelledby="diagram-title" data-testid="diagram">
      <h1 id="diagram-title" className="visually-hidden">
        전력계통 단선결선도
      </h1>
      {visible.length === 0 ? (
        <div className="diagram-empty" role="status" data-testid="diagram-empty">
          <p>표시할 계층이 없습니다. 계층 필터에서 하나 이상 선택하세요.</p>
          <button type="button" onClick={showAllLayers}>
            모든 계층 보기
          </button>
        </div>
      ) : (
        visible.map((l) => (
          <div
            key={l.id}
            id={layerBandId(l.id)}
            data-testid={`layer-band-${l.id}`}
            className={`diagram-band diagram-band--${l.id.toLowerCase()}`}
          >
            <span className="diagram-band__code">{l.id}</span>
            <span className="diagram-band__label">{l.label}</span>
            {l.voltage && <span className="diagram-band__voltage">{l.voltage}</span>}
          </div>
        ))
      )}
      <p className="placeholder-note">계통도 SVG 는 Phase 2 에서 구현됩니다.</p>
    </section>
  );
}
