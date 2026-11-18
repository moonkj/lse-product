import { Suspense, useLayoutEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import LayerNav from './LayerNav';
import DetailPanel from '../panel/DetailPanel';
import PageErrorBoundary from '../common/PageErrorBoundary';
import CompareTray, { useCompareTrayVisible } from '../compare/CompareTray';
import { useData } from '../../data/load';
import { MOBILE_QUERY, useMediaQuery, useSelectedNodeId } from '../../lib/diagram/url';
import LiveRegion from './LiveRegion';
import StartCard, { useStartCardVisible } from './StartCard';
import { shellGrid, useCompactDensity } from './shellLayout';
import { useRouteFocus } from './useRouteFocus';
import './AppLayout.css';

/** 지연 로딩되는 페이지 청크를 받는 동안 */
function PageLoading() {
  return (
    <p className="app-main__loading" role="status">
      화면을 불러오는 중…
    </p>
  );
}

export default function AppLayout() {
  useData(); // 데이터 검증을 렌더 중에 실행 → 실패 시 RootErrorBoundary 가 표시
  const { pathname } = useLocation();
  const trayVisible = useCompareTrayVisible();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const { compact } = useCompactDensity();
  const selectedId = useSelectedNodeId();
  const startCard = useStartCardVisible();
  useRouteFocus();

  // 화면을 옮기면 본문 스크롤을 맨 위로 (스크롤 컨테이너 .app-main 이 라우트 사이에 유지되므로)
  useLayoutEffect(() => {
    document.getElementById('main')?.scrollTo?.({ top: 0, left: 0 });
  }, [pathname]);

  // 상세 패널은 계통도(/)에서만 — 선택은 ?node= 로 표현
  const onHome = pathname === '/';
  const showPanel = onHome;
  // 사이드바(계층 바로가기·범례)는 계통도(제품·Gap·교육 모드)에서만 (C1). 제품·기기·비교·공백 표·교육 화면은 본문을 넓게
  const showNav = onHome;
  const navRow = showNav && (isMobile || compact);
  // 압축 화면: 빈 상세 패널은 접고, 기기를 고르면 그때 열을 연다. 모바일은 패널이 고정 위치(시트/사이드)라 열 없음
  const panelCol = showPanel && !isMobile && (!compact || !!selectedId);
  const navSide = showNav && !navRow;
  const grid = shellGrid({ navSide, navRow, panelCol, notice: startCard });

  // 헤더 실제 높이 → --app-header-h (모바일 가로 사이드 패널의 top 기준)
  useLayoutEffect(() => {
    const el = document.querySelector<HTMLElement>('.app-header');
    if (!el) return;
    const apply = () => document.documentElement.style.setProperty('--app-header-h', `${Math.round(el.getBoundingClientRect().height)}px`);
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const skipToMain = (e: React.MouseEvent) => {
    // HashRouter 에서 href="#main" 은 라우트로 해석되므로 기본 동작을 막고 포커스만 이동
    e.preventDefault();
    const target = document.getElementById('diagram-viewport') ?? document.getElementById('main');
    target?.focus();
  };

  return (
    <div
      className={`app-shell${showPanel ? '' : ' app-shell--no-panel'}${onHome ? ' app-shell--home' : ''}${trayVisible ? ' app-shell--tray' : ''}${compact ? ' app-shell--compact' : ''}${navRow ? ' app-shell--navrow' : ''}${showNav ? '' : ' app-shell--no-nav'}${navSide ? '' : ' app-shell--no-navside'}${panelCol ? '' : ' app-shell--no-panelcol'}`}
      style={{ '--shell-cols': grid.cols, '--shell-rows': grid.rows, '--shell-areas': grid.areas } as React.CSSProperties}
      data-testid="app-shell"
      data-density={compact ? 'compact' : 'default'}
    >
      <a href="#main" className="skip-link" data-testid="skip-to-diagram" onClick={skipToMain}>
        {pathname === '/' ? '계통도로 건너뛰기' : '본문으로 건너뛰기'}
      </a>
      <Header />
      {showNav && <LayerNav />}
      {startCard && <StartCard />}
      <main className="app-main" id="main" tabIndex={-1}>
        <PageErrorBoundary resetKey={pathname}>
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </PageErrorBoundary>
      </main>
      {showPanel && <DetailPanel />}
      <CompareTray />
      <LiveRegion />
    </div>
  );
}
