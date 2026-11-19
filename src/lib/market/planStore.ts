import { create } from 'zustand';

/**
 * 계획 파이프라인 레이어 켜짐 상태 (도구줄 [계획] 토글). 기본 꺼짐.
 * 공유 링크용으로 처음 한 번 주소 `?plan=1` 을 읽는다 (주소를 다시 쓰지는 않음 — 다른 쿼리 처리와 충돌 방지).
 */
export interface PlanState {
  on: boolean;
  setOn: (on: boolean) => void;
  /** 화면 오른쪽 위 상세 패널 — 켜면 기본 열림. dockLayer null = 화면 가운데 계층을 따라감 */
  dockOpen: boolean;
  dockLayer: 'L1' | 'L2' | 'L3' | 'REN' | null;
  setDock: (open: boolean, layer: PlanState['dockLayer']) => void;
}

function initialOn(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    // HashRouter: 쿼리는 보통 해시 안(#/?plan=1)에 있다
    const hashQuery = window.location.hash.split('?')[1] ?? '';
    return [window.location.search, hashQuery].some((q) => new URLSearchParams(q).get('plan') === '1');
  } catch {
    return false;
  }
}

export const usePlanStore = create<PlanState>((set) => ({
  on: initialOn(),
  setOn: (on) => set({ on, dockOpen: true, dockLayer: null }),
  dockOpen: true,
  dockLayer: null,
  setDock: (dockOpen, dockLayer) => set({ dockOpen, dockLayer }),
}));
