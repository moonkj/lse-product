import { Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import HomePage from './pages/HomePage';
import EquipmentPage from './pages/EquipmentPage';
import ProductPage from './pages/ProductPage';
import GapPage from './pages/GapPage';
import LearnPage from './pages/LearnPage';
import NotFoundPage from './pages/NotFoundPage';

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
