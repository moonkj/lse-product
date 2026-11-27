/**
 * 리퀴드 알약 (2026-11-27) — 묶음 안에서 선택된 항목 뒤(또는 위)에 깔린 표시 하나를, 선택이 바뀔 때
 * 물방울처럼 늘렸다 줄이며 옮긴다. 상단 화면 메뉴·계통맵/단계별 스위치·왼쪽 계층 목록이 같이 쓴다.
 * - 위치: top·left·right·bottom 네 변을 따로 지정 → CSS 가 data-dir(right·left·down·up)별로 가는 쪽 변을 먼저, 반대쪽 변을 탄성 있게 옮긴다.
 * - 세로(또는 가로)로 살짝 눌렸다 튀어 오름(Web Animations). 움직임 줄이기 설정이면 바로.
 * - memoryKey: 화면이 바뀌며 묶음이 새로 그려져도(예: 계통맵 ↔ 단계별 도구줄) 직전 자리에서 출발.
 */
import { useLayoutEffect, useRef, type RefObject } from 'react';

const DEFAULT_ACTIVE = '[aria-current="page"], [aria-pressed="true"]';
type Box = { l: number; t: number; r: number; b: number };
const memory = new Map<string, Box>();

export interface LiquidOptions {
  selector?: string;
  memoryKey?: string;
  /** 자리 잡을 때 추가로 할 일 (예: 선택 항목 색을 알약에 옮기기) */
  onPlace?: (active: HTMLElement, pill: HTMLElement) => void;
}

export function useLiquidPill(containerRef: RefObject<HTMLElement | null>, pillRef: RefObject<HTMLElement | null>, key: unknown, opts: LiquidOptions = {}) {
  const last = useRef<Box | null>(null);
  const { selector = DEFAULT_ACTIVE, memoryKey, onPlace } = opts;
  useLayoutEffect(() => {
    const box = containerRef.current;
    const pill = pillRef.current;
    if (!box || !pill) return;
    const set = (p: Box) => {
      pill.style.left = `${p.l}px`;
      pill.style.top = `${p.t}px`;
      pill.style.right = `${p.r}px`;
      pill.style.bottom = `${p.b}px`;
    };
    const place = (animate: boolean) => {
      const cur = box.querySelector<HTMLElement>(selector);
      if (!cur || !cur.offsetWidth) {
        pill.style.opacity = '0';
        last.current = null;
        return;
      }
      const br = box.getBoundingClientRect();
      const cr = cur.getBoundingClientRect();
      const ox = br.left + box.clientLeft - box.scrollLeft;
      const oy = br.top + box.clientTop - box.scrollTop;
      const next: Box = {
        l: cr.left - ox,
        t: cr.top - oy,
        r: box.scrollWidth - (cr.right - ox),
        b: box.scrollHeight - (cr.bottom - oy),
      };
      let prev = last.current;
      // 새로 그려진 묶음: 직전 자리(memory)에서 출발 — 전환 없이 먼저 놓고 다음 프레임에 옮김
      if (!prev && animate && memoryKey && memory.has(memoryKey)) {
        prev = memory.get(memoryKey)!;
        pill.dataset.dir = '';
        set(prev);
        pill.style.opacity = '1';
        void pill.offsetWidth;
      }
      const moved = !!prev && (Math.abs(prev.l - next.l) > 1 || Math.abs(prev.t - next.t) > 1);
      const moving = animate && moved;
      if (moving) {
        const dx = (next.l - prev!.l) + (prev!.r - next.r);
        const dy = (next.t - prev!.t) + (prev!.b - next.b);
        pill.dataset.dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      } else pill.dataset.dir = '';
      set(next);
      pill.style.opacity = '1';
      onPlace?.(cur, pill);
      if (moving && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        const vertical = pill.dataset.dir === 'down' || pill.dataset.dir === 'up';
        const s = vertical ? 'scaleX' : 'scaleY';
        pill.animate?.([{ transform: `${s}(1)` }, { transform: `${s}(0.84)`, offset: 0.45 }, { transform: `${s}(1.04)`, offset: 0.8 }, { transform: `${s}(1)` }], { duration: 520, easing: 'ease-out' });
      }
      last.current = next;
      if (memoryKey) memory.set(memoryKey, next);
    };
    place(true);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => place(false)) : undefined;
    ro?.observe(box);
    return () => ro?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, pillRef, key]);
}
