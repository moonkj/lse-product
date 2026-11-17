import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import LayerNav from './LayerNav';
import DetailPanel from '../panel/DetailPanel';
import { useAppStore } from '../../store/useAppStore';
import { useData } from '../../data/load';
import './AppLayout.css';

/** URL 직접 진입(/gap, /learn) 시에도 store 의 보기 모드가 일치하도록 동기화 (헤더 버튼 상태는 location 에서 직접 계산) */
function useSyncViewModeWithRoute(pathname: string) {
  const setViewMode = useAppStore((s) => s.setViewMode);
  useEffect(() => {
    if (pathname.startsWith('/gap')) setViewMode('gap');
    else if (pathname.startsWith('/learn')) setViewMode('learn');
    else if (pathname === '/') setViewMode('product');
  }, [pathname, setViewMode]);
}

/** 상세 패널은 계통도·기기·제품 화면에서만. 그 외(/gap, /learn, 404)로 가면 패널을 숨기고 선택을 해제 */
const panelVisibleOn = (pathname: string) =>
  pathname === '/' || pathname.startsWith('/equipment/') || pathname.startsWith('/product/');

export default function AppLayout() {
  useData(); // 데이터 검증을 렌더 중에 실행 → 실패 시 RootErrorBoundary 가 표시
  const { pathname } = useLocation();
  useSyncViewModeWithRoute(pathname);

  const showPanel = panelVisibleOn(pathname);
  const setSelectedNodeId = useAppStore((s) => s.setSelectedNodeId);
  useEffect(() => {
    if (!showPanel) setSelectedNodeId(null);
  }, [showPanel, setSelectedNodeId]);

  const skipToMain = (e: React.MouseEvent) => {
    // HashRouter 에서 href="#main" 은 라우트로 해석되므로 기본 동작을 막고 포커스만 이동
    e.preventDefault();
    document.getElementById('main')?.focus();
  };

  return (
    <div className={`app-shell${showPanel ? '' : ' app-shell--no-panel'}`}>
      <a href="#main" className="skip-link" data-testid="skip-to-diagram" onClick={skipToMain}>
        본문으로 건너뛰기
      </a>
      <Header />
      <LayerNav />
      <main className="app-main" id="main" tabIndex={-1}>
        <Outlet />
      </main>
      {showPanel && <DetailPanel />}
    </div>
  );
}
