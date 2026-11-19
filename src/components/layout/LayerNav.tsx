import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Layer } from '../../lib/schema';
import { getDiagramModel, layerTitle } from '../../lib/diagram/model';
import { announce } from '../../lib/announce';
import { getDiagramController, useView } from '../../lib/diagram/view';
import { useViewMode } from '../../lib/diagram/url';
import type { JumpState } from '../diagram/DiagramCanvas';
import './LayerNav.css';

/** 내비 짧은 이름 (디자인: "L1 초고압 765/345kV", "신재생·저장") */
const SHORT: Partial<Record<Layer, string>> = {
  L1: '초고압 765/345kV',
  L2: '송변전 154kV',
  L7: '분전반·부하',
  REN: '신재생·저장',
};

/**
 * 좌측 내비 = 계층 목록 전용 (디자인 토론 P0-1). 숫자는 모드와 무관한 고정 열 "보유/전체 ●공백"(예: 10/13 ●3).
 * 범례는 계통도 왼쪽 아래 카드(DiagramLegend), 공백 표 진입은 헤더 메뉴가 맡는다.
 * 모바일(≤900px)·압축 화면에서는 계층 칩 가로 스크롤만 보인다.
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
    announce(`${layerTitle(layer)} 보기`);
    if (onHome && c) c.jumpToLayer(layer);
    // 계통도가 아직 마운트되지 않았으므로 도착한 쪽(DiagramCanvas)이 마운트 시 이동
    else navigate('/', { state: { jumpTo: layer } satisfies JumpState });
  };

  return (
    <nav className={`layer-nav${gap ? ' layer-nav--gap' : ''}`} aria-label="계층 바로가기" data-testid="layer-nav">
      <div className="nav-block">
        <h2 className="nav-section-title">
          계층 바로가기{' '}
          <span className="nav-section-title__sub" title="공백 = 미보유 + 일부 보유">
            · 보유/전체 <span className="layer-nav__gapmark" aria-hidden="true">●</span>
            <span className="visually-hidden">, </span>공백
          </span>
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
                  onClick={() => jump(l.id)}
                >
                  {/* 이름 = 화면 글자 + 보조 설명(스크린리더 전용) — aria-label 로 덮으면 화면 글자와 이름이 달라짐 (WCAG 2.5.3, 리뷰 R5) */}
                  <span className="layer-nav__name">
                    {main && (
                      <b className="layer-nav__code">
                        {l.id}
                        <span className="visually-hidden">&nbsp;</span>
                      </b>
                    )}
                    <span className="layer-nav__label">{name}</span>
                  </span>
                  <span className="visually-hidden">&nbsp;</span>
                  <span className="layer-nav__count">{`${s.owned}/${s.total}`}</span>
                  {/* 공백 열 — 0이면 빈칸으로 자리만 유지(고정 열). 읽기는 아래 보조 설명이 맡음 */}
                  <span className={`layer-nav__gap${s.gaps > 0 ? ' has-gap' : ''}`} aria-hidden="true">
                    {s.gaps > 0 ? `●${s.gaps}` : ''}
                  </span>
                  <span className="visually-hidden">
                    {` · ${l.label}, 보유 ${s.owned} / 전체 ${s.total}, 공백 ${s.gaps}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {/* 휴대폰 세로: 헤더의 "계통도 · 공백 표" 메뉴는 검색창 자리를 위해 숨김 → 칩 줄 끝에서 공백 표로 */}
        <Link to="/gap" className="layer-nav__gaplink" data-testid="gap-table-link-mobile">
          공백 표 <span aria-hidden="true">→</span>
        </Link>
      </div>
    </nav>
  );
}
