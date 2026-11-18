import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';

// 첫 화면(계통도)만 기본 번들에, 나머지 페이지는 라우트별 청크로 지연 로딩 (리뷰 R10)
const EquipmentPage = lazy(() => import('./pages/EquipmentPage'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const GapPage = lazy(() => import('./pages/GapPage'));
const LearnPage = lazy(() => import('./pages/LearnPage'));

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="equipment/:id" element={<EquipmentPage />} />
        <Route path="product/:id" element={<ProductPage />} />
        <Route path="gap" element={<GapPage />} />
        <Route path="learn" element={<LearnPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
