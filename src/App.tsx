import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';

// 첫 화면(계통도)만 기본 번들에, 나머지 페이지는 라우트별 청크로 지연 로딩 (리뷰 R10)
const EquipmentPage = lazy(() => import('./pages/EquipmentPage'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const GapPage = lazy(() => import('./pages/GapPage'));
const LearnPage = lazy(() => import('./pages/LearnPage'));
// 비교 화면 (?type=equipment|product&ids=a,b) — URL 이 원본
const ComparePage = lazy(() => import('./pages/ComparePage'));
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
        <Route path="learn" element={<LearnPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
