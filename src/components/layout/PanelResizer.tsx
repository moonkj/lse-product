import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 상세 패널 폭 조절 손잡이 (패널 왼쪽 가장자리). 넓은 화면에서 패널 열이 있을 때만 그린다.
 *  - 끌기: 왼쪽으로 늘리고 오른쪽으로 줄인다. 두 번 누르면 기본 폭(360px)으로.
 *  - 키보드: ←/→ 24px, Home 최소, End 최대 (role=separator).
 *  - 폭은 --panel-w(문서 루트)로 반영하고 localStorage `lse-panel-w` 에 저장.
 */
const KEY = 'lse-panel-w';
export const PANEL_DEFAULT = 360;
export const PANEL_MIN = 300;
const STEP = 24;

export function panelMax(viewportW: number): number {
  return Math.max(PANEL_MIN, Math.min(900, Math.round(viewportW * 0.6)));
}

export function clampPanel(w: number, viewportW: number): number {
  return Math.round(Math.min(panelMax(viewportW), Math.max(PANEL_MIN, w)));
}

function readSaved(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function apply(w: number) {
  document.documentElement.style.setProperty('--panel-w', `${w}px`);
}

export default function PanelResizer() {
  const [width, setWidth] = useState(() => clampPanel(readSaved() ?? PANEL_DEFAULT, window.innerWidth));
  const drag = useRef<{ x: number; w: number } | null>(null);
  const [active, setActive] = useState(false);

  const commit = useCallback((w: number, save = true) => {
    const c = clampPanel(w, window.innerWidth);
    setWidth(c);
    apply(c);
    if (save) {
      try {
        localStorage.setItem(KEY, String(c));
      } catch {
        /* 저장 불가 — 이번 화면에서만 */
      }
    }
  }, []);

  useEffect(() => {
    apply(width);
    const onResize = () => commit(width, false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [width, commit]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, w: width };
    setActive(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    commit(d.w + (d.x - e.clientX), false);
  };
  const end = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    setActive(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    commit(width);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const max = panelMax(window.innerWidth);
    let next: number | null = null;
    if (e.key === 'ArrowLeft') next = width + STEP;
    else if (e.key === 'ArrowRight') next = width - STEP;
    else if (e.key === 'Home') next = PANEL_MIN;
    else if (e.key === 'End') next = max;
    if (next === null) return;
    e.preventDefault();
    commit(next);
  };

  return (
    <div
      className={`panel-resizer${active ? ' is-active' : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-label="상세 정보 창 폭 조절 — 끌거나 ←/→ 키, 두 번 누르면 기본 폭"
      aria-valuemin={PANEL_MIN}
      aria-valuemax={panelMax(window.innerWidth)}
      aria-valuenow={width}
      tabIndex={0}
      title="끌어서 폭 조절 · 두 번 누르면 기본 폭"
      data-testid="panel-resizer"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={() => commit(PANEL_DEFAULT)}
      onKeyDown={onKeyDown}
    />
  );
}
