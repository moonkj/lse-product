import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';

// 첫 화면(계통도)만 기본 번들에, 나머지 페이지는 라우트별 청크로 지연 로딩 (리뷰 R10)
const EquipmentPage = lazy(() => import('./pages/EquipmentPage'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const GapPage = lazy(() => import('./pages/GapPage'));
// 비교 화면 (?type=equipment|product&ids=a,b) — URL 이 원본
const ComparePage = lazy(() => import('./pages/ComparePage'));
// 제품 조회 (?q&biz&stage&volt&src…) — 2026-11-19 화면 추가
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
// 전력시장 지표 — 계통도 도구줄 '시장 지표' 버튼 (공백 표에서 분리, 2026-11-19)
const MarketPage = lazy(() => import('./pages/MarketPage'));
// 관리자 편집 화면 — 별도 청크 (일반 사용자 번들에 포함되지 않음), 앱 레이아웃 밖 전체 화면
const AdminPage = lazy(() => import('./pages/admin/AdminPage'));

export default function App() {
  return (
    <Routes>
      <Route
        path="admin"
        element={
          <Suspense fallback={<p role="status">관리자 화면을 불러오는 중…</p>}>
            <AdminPage />
          </Suspense>
        }
      />
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="equipment/:id" element={<EquipmentPage />} />
        <Route path="product/:id" element={<ProductPage />} />
        <Route path="gap" element={<GapPage />} />
        {/* 교육 탭 제거(2026-11-18 사용자 결정) — 옛 링크·북마크(/learn?step=… 포함)는 계통도로 */}
        <Route path="learn/*" element={<Navigate to="/" replace />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="market" element={<MarketPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
