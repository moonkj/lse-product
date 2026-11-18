import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getDiagramModel } from './model';

/** 계통도 보기 모드 (URL `?mode=` 가 원본) */
export type ViewMode = 'product' | 'gap';

/**
 * 계통도 화면 상태는 URL 이 원본: `#/?mode=gap&node=<nodeId>` (제품 모드는 mode 생략)
 * 옛 링크의 `?mode=learn`(교육 모드, 2026-11-18 제거)은 알 수 없는 값처럼 제품 모드로 연다.
 * → 새로고침·링크 공유로 그대로 복원된다.
 */
export function parseMode(v: string | null): ViewMode {
  return v === 'gap' ? 'gap' : 'product';
}

/** 계통도(/) 의 보기 모드 */
export function useViewMode(): ViewMode {
  const [params] = useSearchParams();
  return parseMode(params.get('mode'));
}

/** 선택 노드 (없는 id 는 조용히 무시 → null) */
export function useSelectedNodeId(): string | null {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const id = params.get('node');
  if (pathname !== '/' || !id) return null;
  return getDiagramModel().nodeById.has(id) ? id : null;
}

/**
 * 노드 선택/해제 — URL 의 node 만 바꾸고 mode 는 유지.
 * 브라우저 기록에 남긴다(push, UX 토론 B5) → 연결 기기를 따라간 뒤 뒤로가기 = 이전 기기.
 * 이미 같은 값이면 기록을 늘리지 않는다.
 */
export function useSelectNode() {
  const [params, setParams] = useSearchParams();
  const ref = useRef({ setParams, current: params.get('node') });
  ref.current = { setParams, current: params.get('node') };
  return useCallback((id: string | null, opts?: { replace?: boolean }) => {
    if ((ref.current.current ?? null) === id) return;
    ref.current.setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('node', id);
        else next.delete('node');
        return next;
      },
      { replace: !!opts?.replace },
    );
  }, []);
}

/** 기록 항목(history state)에 남기는 상세 패널 상태 — 뒤로가기 시 모바일 시트 펼침 복원 */
export interface PanelHistoryState {
  sheet?: 'expanded';
}

// ── 선택 → 상세 패널 제목으로 포커스 (UX 토론 B4) ──
let panelFocusPending = false;

/** 다음에 상세 패널이 새 기기로 그려지면 제목(h2)으로 포커스를 옮기도록 예약 */
export function requestPanelFocus() {
  panelFocusPending = true;
}

/** 예약된 포커스 요청을 꺼낸다 (한 번만 true) */
export function takePanelFocusRequest(): boolean {
  const v = panelFocusPending;
  panelFocusPending = false;
  return v;
}

export const PANEL_TITLE_ID = 'detail-panel-title';

/** 상세 패널 제목(h2, tabIndex=-1)으로 포커스 */
export function focusPanelTitle(): boolean {
  panelFocusPending = false;
  const el = document.getElementById(PANEL_TITLE_ID);
  if (!el || !el.hasAttribute('tabindex')) return false;
  el.focus({ preventScroll: true });
  return document.activeElement === el;
}

/** 보기 모드 전환 — 항상 계통도(/)로, 선택 노드는 유지 */
export function useSetViewMode() {
  const navigate = useNavigate();
  const location = useLocation();
  // 렌더 시점 값이 아니라 호출 시점의 최신 위치로 계산 (노드 선택 전환 중 모드 변경 시 node 유실 방지)
  const locRef = useRef(location);
  locRef.current = location;
  return useCallback(
    (mode: ViewMode) => {
      const { pathname, search } = locRef.current;
      const next = new URLSearchParams(pathname === '/' ? search : '');
      if (mode === 'product') next.delete('mode');
      else next.set('mode', mode);
      const q = next.toString();
      navigate({ pathname: '/', search: q ? `?${q}` : '' });
    },
    [navigate],
  );
}

/** 계통도 화면에서 쓸 검색 문자열 (node 지정, mode 유지) */
export function homeSearchWithNode(currentSearch: string, nodeId: string, onHome: boolean): string {
  const next = new URLSearchParams(onHome ? currentSearch : '');
  next.set('node', nodeId);
  return `?${next.toString()}`;
}

export function useMediaQuery(query: string): boolean {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const mql = window.matchMedia?.(query);
    if (!mql) return;
    const on = () => setMatches(mql.matches);
    on();
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, [query]);
  return matches;
}

/** 다른 화면에서 계통도로 이동하며 노드 포커스를 요청할 때 navigate state 로 넘기는 값 */
export interface FocusState {
  focusNode?: string;
}

/** 계통도 노드로 키보드 포커스 이동 (화면 스크롤은 PanZoom 이 담당하므로 preventScroll) */
export function focusNode(id: string) {
  document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
}

export const MOBILE_QUERY = '(max-width: 900px)';
