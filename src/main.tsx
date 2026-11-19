import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './styles/tokens.css';
import './styles/global.css';
import App from './App';
import RootErrorBoundary from './components/common/RootErrorBoundary';
// 배포 직후 페이지 조각 로드 실패는 PageErrorBoundary 가 새 버전으로 자동 새로고침 (사양·색인처럼 앱이 스스로 안내하는 실패는 그대로)

const root = document.getElementById('root');
if (!root) throw new Error('#root 요소가 없습니다');

createRoot(root).render(
  <StrictMode>
    <RootErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </RootErrorBoundary>
  </StrictMode>,
);
