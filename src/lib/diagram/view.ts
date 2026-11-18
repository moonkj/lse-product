import { useSyncExternalStore } from 'react';
import type { Layer } from '../schema';
import type { ViewInfo } from './panzoom';

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
  /** 노드가 보이는 영역(패널·시트·미니맵·비교 바 제외) 밖이면 그 가운데로 팬 */
  revealNode(id: string): void;
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

/**
 * 기록 항목(location.key)별 마지막 계통도 보기 — 뒤로가기(POP)로 돌아오면 그 위치·배율·현재 계층을 복원 (UX 토론 B5).
 * 메모리에만 둔다(새로고침하면 처음 보기).
 */
export interface SavedView {
  view: ViewInfo;
  /** 그때 고정돼 있던 현재 계층 (계층 점프·기기 선택) — undefined = 화면 가운데로 판정 */
  pinned?: { layer: Layer | null };
}
const MAX_SAVED = 100;
const savedViews = new Map<string, SavedView>();

/** 브라우저가 직접 만든 기록(주소창 해시 수정·첫 진입)은 key 가 모두 'default' 라 구분이 안 되므로 저장하지 않는다 */
const usableKey = (key: string) => !!key && key !== 'default';

export function saveView(key: string, v: SavedView) {
  if (!usableKey(key)) return;
  savedViews.delete(key);
  savedViews.set(key, v);
  if (savedViews.size > MAX_SAVED) savedViews.delete(savedViews.keys().next().value!);
}

export function getSavedView(key: string): SavedView | undefined {
  return usableKey(key) ? savedViews.get(key) : undefined;
}
