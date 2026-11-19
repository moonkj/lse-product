import { useEffect } from 'react';
import { useMediaQuery } from '../../lib/diagram/url';
import { useUiStore } from '../../store/useUiStore';

/**
 * 압축 화면(C1) — 하나의 규칙: `<html data-density="compact">` + `.app-shell--compact`.
 * 자동: 창 높이 600px 이하(200% 확대·모바일 가로 포함). 수동: 헤더 "넓게 보기".
 * 압축 상태에서는 헤더 한 줄, 사이드바(범례) 접고 계층 칩 한 줄, 빈 상세 패널 숨김, 모바일 가로는 오른쪽 사이드 패널.
 * 내용은 바꾸지 않는다(토론 합의 — 보기 모드별로 다른 내용 금지).
 */
export const COMPACT_QUERY = '(max-height: 600px)';
/**
 * 휴대폰 세로 — 폭이 좁아 압축 헤더(한 줄)·사이드 패널을 쓰면 검색창이 사라지고 가로로 넘친다 (리뷰 M2).
 * 이 조건에서는 넓게 보기 설정(저장값 포함)이 켜져 있어도 압축하지 않고, 넓게 보기 버튼도 숨긴다(CSS).
 */
export const PORTRAIT_PHONE_QUERY = '(max-width: 600px) and (orientation: portrait)';

/** 압축 상태 계산만 (부수 효과 없음) — present 는 실제로 적용되는 넓게 보기 (세로 폰이면 false) */
export function useCompactState(): { compact: boolean; auto: boolean; present: boolean } {
  const auto = useMediaQuery(COMPACT_QUERY);
  const portraitPhone = useMediaQuery(PORTRAIT_PHONE_QUERY);
  const presentSetting = useUiStore((s) => s.present);
  const present = presentSetting && !portraitPhone;
  const compact = !portraitPhone && (auto || present);
  return { compact, auto, present };
}

export function useCompactDensity(): { compact: boolean; auto: boolean; present: boolean } {
  const state = useCompactState();
  const { compact, present } = state;
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.density = compact ? 'compact' : 'default';
    if (present) root.dataset.present = 'true';
    else delete root.dataset.present;
  }, [compact, present]);
  return state;
}

export interface ShellOptions {
  /** 왼쪽 사이드바(범례 포함) — 넓은 화면·기본 밀도의 계통도에서만 */
  navSide: boolean;
  /** 계층 칩 한 줄(모바일·압축) */
  navRow: boolean;
  /** 오른쪽 상세 패널 열 */
  panelCol: boolean;
  /** 첫 방문 시작 카드 줄 */
  notice: boolean;
}

/**
 * 앱 셸 grid 템플릿. 사이드바·패널은 헤더 아래 모든 줄을 차지하고, 칩 줄·시작 카드 줄·본문은 가운데 열에 쌓인다.
 * 반환값은 CSS 변수(--shell-cols/--shell-rows/--shell-areas)로 넘긴다.
 */
export function shellGrid({ navSide, navRow, panelCol, notice }: ShellOptions) {
  const mid: string[] = [];
  if (navRow) mid.push('nav');
  if (notice) mid.push('notice');
  mid.push('main');
  const row = (center: string) => [navSide ? 'nav' : null, center, panelCol ? 'panel' : null].filter(Boolean).join(' ');
  const width = 1 + (navSide ? 1 : 0) + (panelCol ? 1 : 0);
  const areas = [`'${Array(width).fill('header').join(' ')}'`, ...mid.map((c) => `'${row(c)}'`)].join(' ');
  const cols = [navSide ? 'var(--nav-w)' : null, 'minmax(0, 1fr)', panelCol ? 'var(--panel-w)' : null].filter(Boolean).join(' ');
  const rows = ['auto', ...mid.map((c) => (c === 'main' ? 'minmax(0, 1fr)' : 'auto'))].join(' ');
  return { cols, rows, areas };
}
