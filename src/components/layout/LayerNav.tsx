import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Layer } from '../../lib/schema';
import { getDiagramModel } from '../../lib/diagram/model';
import { getDiagramController, useView } from '../../lib/diagram/view';
import { useViewMode } from '../../lib/diagram/url';
import type { JumpState } from '../diagram/DiagramCanvas';
import CoverageLegend from './CoverageLegend';

/** 내비 짧은 이름 (디자인: "L1 초고압 765/345kV", "신재생·저장") */
const SHORT: Partial<Record<Layer, string>> = {
  L1: '초고압 765/345kV',
  L2: '송변전 154kV',
  L7: '분전반·부하',
  REN: '신재생·저장',
};

/**
 * 좌측 내비: 계층 바로가기(보유/전체 · Gap 모드면 공백 수) → 커버리지 범례 → 선 범례 → 공백 표 링크.
 * 모바일(≤900px)에서는 계층 칩 가로 스크롤만 보인다.
 */
export default function LayerNav() {
  const model = getDiagramModel();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onHome = pathname === '/';
  const urlMode = useViewMode();
  const mode = onHome ? urlMode : 'product';
  const gap = mode === 'gap';
  const current = useView((s) => (s.ready ? s.layer : null));

  const jump = (layer: Layer) => {
    const c = getDiagramController();
    if (onHome && c) c.jumpToLayer(layer);
    // 계통도가 아직 마운트되지 않았으므로 도착한 쪽(DiagramCanvas)이 마운트 시 이동
    else navigate('/', { state: { jumpTo: layer } satisfies JumpState });
  };

  return (
    <nav className={`layer-nav${gap ? ' layer-nav--gap' : ''}`} aria-label="계층 바로가기" data-testid="layer-nav">
      <div className="nav-block">
        <h2 className="nav-section-title">
          계층 바로가기 <span className="nav-section-title__sub">· {gap ? '공백 수' : '보유/전체'}</span>
        </h2>
        <ul className="layer-nav__list">
          {model.layers.map((l) => {
            const s = model.layerStats.get(l.id)!;
            const isCurrent = onHome && current === l.id;
            const name = SHORT[l.id] ?? l.label;
            const main = /^L\d$/.test(l.id);
            return (
              <li key={l.id}>
                <button
                  type="button"
                  className={`layer-nav__btn${isCurrent ? ' is-current' : ''}`}
                  data-testid={`layer-nav-${l.id}`}
                  aria-current={isCurrent ? 'true' : undefined}
                  aria-label={`${main ? `${l.id} ` : ''}${l.label} — ${gap ? `공백 ${s.gaps}` : `보유 ${s.owned} / 전체 ${s.total}`}`}
                  onClick={() => jump(l.id)}
                >
                  <span className="layer-nav__name">
                    {main && <b className="layer-nav__code">{l.id}</b>}
                    <span className="layer-nav__label">{name}</span>
                  </span>
                  <span className={`layer-nav__count${gap && s.gaps > 0 ? ' has-gap' : ''}`}>
                    {gap ? s.gaps : `${s.owned}/${s.total}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {gap && <p className="layer-nav__note">공백 수 = 미보유 + 일부 보유</p>}
      </div>

      <div className="nav-block nav-block--desktop">
        <CoverageLegend mode={mode} />
        {!gap && (
          <ul className="line-legend" aria-label="선 범례">
            <li>
              <span className="line-legend__swatch line-legend__swatch--power" aria-hidden="true" />
              전력선
            </li>
            <li>
              <span className="line-legend__swatch line-legend__swatch--signal" aria-hidden="true" />
              신호선 (계측·보호·제어)
            </li>
            <li>
              <span className="line-legend__swatch line-legend__swatch--bus" aria-hidden="true" />
              모선
            </li>
            <li>
              <span className="line-legend__swatch line-legend__swatch--alt" aria-hidden="true" />
              택1 연결 (어느 하나)
            </li>
            <li>
              <span className="line-legend__swatch line-legend__swatch--ref" aria-hidden="true" />
              참조 타일 (같은 기기 재등장)
            </li>
          </ul>
        )}
      </div>

      <Link to="/gap" className={`gap-table-link${gap ? ' gap-table-link--gap' : ''}`} data-testid="gap-table-link">
        공백 표 보기 <span aria-hidden="true">→</span>
      </Link>
    </nav>
  );
}
