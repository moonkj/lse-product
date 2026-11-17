import { create } from 'zustand';
import { LAYERS, type Layer } from '../lib/schema';

export type ViewMode = 'product' | 'gap' | 'learn';

export interface AppState {
  /** Phase 2 에서 URL 쿼리로 옮길 예정 */
  selectedNodeId: string | null;
  viewMode: ViewMode;
  /**
   * 표시할 계층 목록. 초기값 = 모든 계층.
   * 빈 배열 = 아무 계층도 표시하지 않음 (계통도는 빈 화면 + 안내). "빈 배열 = 전체" 규칙은 쓰지 않는다.
   */
  layerFilter: Layer[];
  searchQuery: string;
  setSelectedNodeId: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setLayerFilter: (layers: Layer[]) => void;
  toggleLayer: (layer: Layer) => void;
  /** 모든 계층 다시 표시 */
  showAllLayers: () => void;
  setSearchQuery: (q: string) => void;
  reset: () => void;
}

const initialState = {
  selectedNodeId: null,
  viewMode: 'product' as ViewMode,
  layerFilter: [...LAYERS] as Layer[],
  searchQuery: '',
};

export const useAppStore = create<AppState>()((set) => ({
  ...initialState,
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  setViewMode: (viewMode) => set({ viewMode }),
  setLayerFilter: (layerFilter) => set({ layerFilter: [...new Set(layerFilter)] }),
  toggleLayer: (layer) =>
    set((s) => ({
      layerFilter: s.layerFilter.includes(layer)
        ? s.layerFilter.filter((l) => l !== layer)
        : [...s.layerFilter, layer],
    })),
  showAllLayers: () => set({ layerFilter: [...LAYERS] }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  reset: () => set({ ...initialState, layerFilter: [...LAYERS] }),
}));
