import { useSyncExternalStore } from 'react';
import type { Layer } from '../schema';

/**
 * 계통도 뷰 상태 (줌 배율·보이는 영역) — 줌/패닝 중에 React 트리를 다시 그리지 않도록
 * 모듈 단위 작은 스토어로 둔다. 툴바(줌 %)·미니맵·좌측 내비(현재 계층)만 구독.
 */
export interface ViewState {
  scale: number;
  /** 보이는 영역 (diagram 좌표) */
  x: number;
  y: number;
  w: number;
  h: number;
  /** 화면 중심이 속한 계층 */
  layer: Layer | null;
  /** 계통도가 마운트되어 있는지 */
  ready: boolean;
}

let state: ViewState = { scale: 1, x: 0, y: 0, w: 0, h: 0, layer: null, ready: false };
const listeners = new Set<() => void>();

export const viewStore = {
  get: () => state,
  set(patch: Partial<ViewState>) {
    let changed = false;
    for (const k of Object.keys(patch) as (keyof ViewState)[]) {
      if (state[k] !== patch[k]) changed = true;
    }
    if (!changed) return;
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

/** 원시값 선택자만 넘길 것 (객체를 새로 만들면 무한 렌더) */
export function useView<T extends string | number | boolean | null>(select: (s: ViewState) => T): T {
  return useSyncExternalStore(viewStore.subscribe, () => select(viewStore.get()));
}

/** 뷰 상태 전체 (미니맵용 — set 할 때마다 새 객체) */
export function useViewState(): ViewState {
  return useSyncExternalStore(viewStore.subscribe, viewStore.get);
}

/** 계통도 밖(좌측 내비·검색·미니맵)에서 뷰를 움직이는 명령 — DiagramCanvas 가 등록 */
export interface DiagramController {
  jumpToLayer(layer: Layer): void;
  fitAll(): void;
  zoomBy(factor: number): void;
  /** diagram 좌표 지점을 화면 가운데로 */
  centerOn(x: number, y: number): void;
}

let controller: DiagramController | null = null;

export function registerDiagramController(c: DiagramController) {
  controller = c;
  return () => {
    if (controller === c) controller = null;
  };
}

export function getDiagramController(): DiagramController | null {
  return controller;
}
