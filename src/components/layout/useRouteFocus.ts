import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

interface NavState {
  focusNode?: string;
  jumpTo?: string;
}

/** 이동 직후 새 화면이 스스로 포커스를 잡아야 하는가 — 계통도 노드 선택·계층 점프는 계통도(T1-A)가 처리 */
export function diagramHandlesFocus(pathname: string, search: string, state: unknown): boolean {
  if (pathname !== '/') return false;
  if (new URLSearchParams(search).has('node')) return true;
  const s = (state ?? {}) as NavState;
  return !!(s.focusNode || s.jumpTo);
}

/** 본문 안에 이미 의미 있는 포커스가 있는가 (새 화면이 직접 옮긴 경우) */
function focusAlreadyInMain(main: HTMLElement): boolean {
  const a = document.activeElement;
  return !!a && a !== main && a !== document.body && main.contains(a);
}

/**
 * 라우트(경로)가 바뀌면 새 화면의 h1(없으면 main)으로 포커스를 옮긴다 (B10 · WCAG 2.4.3).
 * - 첫 진입은 건드리지 않는다.
 * - 같은 경로에서 쿼리만 바뀌는 경우(?node=, ?mode=)는 옮기지 않는다 — 계통도 패널 포커스는 T1-A 담당.
 * - 지연 로딩 화면은 h1 이 나타날 때까지 잠깐(최대 약 2초) 기다린다.
 */
export function useRouteFocus() {
  const { pathname, search, state } = useLocation();
  const prev = useRef<string | null>(null);

  useEffect(() => {
    const before = prev.current;
    prev.current = pathname;
    if (before === null || before === pathname) return;
    if (diagramHandlesFocus(pathname, search, state)) return;

    let cancelled = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = () => {
      if (cancelled) return;
      const main = document.getElementById('main');
      if (!main) return;
      const h1 = main.querySelector<HTMLElement>('h1');
      if (!h1 && tries++ < 40) {
        timer = setTimeout(attempt, 50);
        return;
      }
      if (focusAlreadyInMain(main)) return;
      const target = h1 ?? main;
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    };
    timer = setTimeout(attempt, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // search·state 는 경로가 바뀐 순간의 값만 본다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
}
