import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';

// 첫 화면(계통도)만 기본 번들에, 나머지 페이지는 라우트별 청크로 지연 로딩 (리뷰 R10)
const loaders = {
  equipment: () => import('./pages/EquipmentPage'),
  product: () => import('./pages/ProductPage'),
  gap: () => import('./pages/GapPage'),
  // 비교 화면 (?type=equipment|product&ids=a,b) — URL 이 원본
  compare: () => import('./pages/ComparePage'),
  // 제품 조회 (?q&biz&stage&volt…) — 2026-11-19 화면 추가
  products: () => import('./pages/ProductsPage'),
  // 전력시장 지표 — 계통도 도구줄 '시장 지표' 버튼 (공백 표에서 분리, 2026-11-19)
  market: () => import('./pages/MarketPage'),
  // 계통 구성 시뮬레이션 (2026-11-26 1단계)
  builder: () => import('./pages/BuilderPage'),
  // 경쟁 대응 — 경쟁사 뉴스·제품명 → 자사 대응 제품 (2026-11-26)
  counter: () => import('./pages/CounterPage'),
};
const EquipmentPage = lazy(loaders.equipment);
const ProductPage = lazy(loaders.product);
const GapPage = lazy(loaders.gap);
const ComparePage = lazy(loaders.compare);
const ProductsPage = lazy(loaders.products);
const MarketPage = lazy(loaders.market);
const BuilderPage = lazy(loaders.builder);
const CounterPage = lazy(loaders.counter);

/**
 * 첫 화면을 그린 뒤 한가할 때 페이지 조각을 미리 받아 둔다 (2026-11-23 사용자: 기기 상세로 넘어갈 때 가끔 "불러오지 못했습니다"가 깜빡임).
 * 6시간마다 자동 배포되면 예전 조각이 지워져, 열어 둔 화면에서 나중에 받으려 하면 실패했다 → 처음에 받아 두면 이후 이동은 네트워크가 필요 없다.
 * 관리자 화면은 일반 사용자에게 필요 없어 미리 받지 않는다. 실패는 무시(실제 이동 때 다시 시도).
 */
export function prefetchPages(): void {
  for (const load of Object.values(loaders)) load().catch(() => undefined);
}
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
        <Route path="builder" element={<BuilderPage />} />
        <Route path="counter" element={<CounterPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
