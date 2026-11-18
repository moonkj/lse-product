import { create } from 'zustand';

/**
 * 앱 전역 UI 상태 — URL 에 둘 필요 없는 일시 상태만 둔다.
 * 선택 노드(`?node=`)·보기 모드(`?mode=`)는 URL 이 원본 (lib/diagram/url.ts).
 */
export interface AppState {
  /** 헤더 검색어 (화면을 옮겨도 유지) */
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  reset: () => void;
}

const initialState = { searchQuery: '' };

export const useAppStore = create<AppState>()((set) => ({
  ...initialState,
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  reset: () => set({ ...initialState }),
}));
