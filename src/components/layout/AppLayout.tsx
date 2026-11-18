import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import LayerNav from './LayerNav';
import DetailPanel from '../panel/DetailPanel';
import { useAppStore } from '../../store/useAppStore';
import { useData } from '../../data/load';
import { useSelectedNodeId, useViewMode } from '../../lib/diagram/url';
import './AppLayout.css';

/**
 * URL(원본) → store 동기화. 보기 모드는 계통도의 `?mode=`, /gap·/learn 직접 진입도 반영.
 * 선택 노드는 `?node=` (store 는 다른 컴포넌트 호환용 사본).
 */
function useSyncStoreWithUrl(pathname: string) {
  const setViewMode = useAppStore((s) => s.setViewMode);
  const setSelectedNodeId = useAppStore((s) => s.setSelectedNodeId);
  const mode = useViewMode();
  const selected = useSelectedNodeId();
  useEffect(() => {
    if (pathname === '/') setViewMode(mode);
    else if (pathname.startsWith('/gap')) setViewMode('gap');
    else if (pathname.startsWith('/learn')) setViewMode('learn');
  }, [pathname, mode, setViewMode]);
  useEffect(() => {
    setSelectedNodeId(selected);
  }, [selected, setSelectedNodeId]);
}

export default function AppLayout() {
  useData(); // 데이터 검증을 렌더 중에 실행 → 실패 시 RootErrorBoundary 가 표시
  const { pathname } = useLocation();
  useSyncStoreWithUrl(pathname);

  // 상세 패널은 계통도(/)에서만 — 선택은 ?node= 로 표현
  const showPanel = pathname === '/';

  const skipToMain = (e: React.MouseEvent) => {
    // HashRouter 에서 href="#main" 은 라우트로 해석되므로 기본 동작을 막고 포커스만 이동
    e.preventDefault();
    const target = document.getElementById('diagram-viewport') ?? document.getElementById('main');
    target?.focus();
  };

  return (
    <div className={`app-shell${showPanel ? '' : ' app-shell--no-panel'}${pathname === '/' ? ' app-shell--home' : ''}`}>
      <a href="#main" className="skip-link" data-testid="skip-to-diagram" onClick={skipToMain}>
        {pathname === '/' ? '계통도로 건너뛰기' : '본문으로 건너뛰기'}
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
