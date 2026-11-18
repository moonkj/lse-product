import { Suspense, useLayoutEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import LayerNav from './LayerNav';
import DetailPanel from '../panel/DetailPanel';
import PageErrorBoundary from '../common/PageErrorBoundary';
import CompareTray, { useCompareTrayVisible } from '../compare/CompareTray';
import { useData } from '../../data/load';
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

  // 화면을 옮기면 본문 스크롤을 맨 위로 (스크롤 컨테이너 .app-main 이 라우트 사이에 유지되므로)
  useLayoutEffect(() => {
    document.getElementById('main')?.scrollTo?.({ top: 0, left: 0 });
  }, [pathname]);

  // 상세 패널은 계통도(/)에서만 — 선택은 ?node= 로 표현
  const showPanel = pathname === '/';

  const skipToMain = (e: React.MouseEvent) => {
    // HashRouter 에서 href="#main" 은 라우트로 해석되므로 기본 동작을 막고 포커스만 이동
    e.preventDefault();
    const target = document.getElementById('diagram-viewport') ?? document.getElementById('main');
    target?.focus();
  };

  return (
    <div className={`app-shell${showPanel ? '' : ' app-shell--no-panel'}${pathname === '/' ? ' app-shell--home' : ''}${trayVisible ? ' app-shell--tray' : ''}`}>
      <a href="#main" className="skip-link" data-testid="skip-to-diagram" onClick={skipToMain}>
        {pathname === '/' ? '계통도로 건너뛰기' : '본문으로 건너뛰기'}
      </a>
      <Header />
      <LayerNav />
      <main className="app-main" id="main" tabIndex={-1}>
        <PageErrorBoundary resetKey={pathname}>
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </PageErrorBoundary>
      </main>
      {showPanel && <DetailPanel />}
      <CompareTray />
    </div>
  );
}
