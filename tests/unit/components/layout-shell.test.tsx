/**
 * 단위·컴포넌트 테스트 — UX 라운드 U T1-C (레이아웃·안내)
 *  - useUiStore: 넓게 보기·시작 카드 저장(localStorage, 차단돼도 동작), 첫 주소 판정 isCleanEntry
 *  - shellGrid: 압축 화면 규칙의 grid 템플릿 (사이드바·칩 줄·패널 열·시작 카드 줄)
 *  - LiveRegion: announce() 를 polite 영역에 표시
 *  - diagramHandlesFocus: 계통도 노드 선택·점프 이동은 라우트 포커스를 건드리지 않음
 *  - 교육 탭 제거(2026-11-18 사용자 결정): 보기 세그먼트는 전체·공백만 뿐, 옛 ?mode=learn 은 제품 모드
 *  - 디자이너 토론 P0-5·6: 헤더 = 로고·메뉴·검색·아이콘 버튼 2개, 보기 세그먼트는 계통도 도구줄 맨 왼쪽, 시작 카드 없음
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { PRESENT_KEY, isCleanEntry, resetUiStore, useUiStore } from '../../../src/store/useUiStore';
import { shellGrid } from '../../../src/components/layout/shellLayout';
import LiveRegion from '../../../src/components/layout/LiveRegion';
import { diagramHandlesFocus } from '../../../src/components/layout/useRouteFocus';
import { announce } from '../../../src/lib/announce';
import Header from '../../../src/components/layout/Header';
import DiagramToolbar from '../../../src/components/diagram/DiagramToolbar';
import { parseMode } from '../../../src/lib/diagram/url';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
  resetUiStore();
});

describe('useUiStore — 넓게 보기·시작 카드 저장', () => {
  it('넓게 보기 토글은 localStorage 에 저장되고 새로 읽어도 유지', () => {
    resetUiStore();
    expect(useUiStore.getState().present).toBe(false);
    useUiStore.getState().togglePresent();
    expect(localStorage.getItem(PRESENT_KEY)).toBe('1');
    resetUiStore();
    expect(useUiStore.getState().present).toBe(true);
    useUiStore.getState().togglePresent();
    expect(localStorage.getItem(PRESENT_KEY)).toBeNull();
  });

  it('저장소가 막혀도(예외) 메모리 상태로 동작', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    resetUiStore();
    expect(() => useUiStore.getState().setPresent(true)).not.toThrow();
    expect(useUiStore.getState().present).toBe(true);
    expect(() => useUiStore.getState().dismissStartCard()).not.toThrow();
    expect(useUiStore.getState().startCardDismissed).toBe(true);
  });

  it('isCleanEntry: 쿼리·해시 경로 없는 주소만 첫 방문으로 본다', () => {
    expect(isCleanEntry({ search: '', hash: '' })).toBe(true);
    expect(isCleanEntry({ search: '', hash: '#' })).toBe(true);
    expect(isCleanEntry({ search: '', hash: '#/' })).toBe(true);
    expect(isCleanEntry({ search: '', hash: '#/?node=n-vcb' })).toBe(false);
    expect(isCleanEntry({ search: '', hash: '#/gap' })).toBe(false);
    expect(isCleanEntry({ search: '', hash: '#/?mode=gap' })).toBe(false);
    expect(isCleanEntry({ search: '?utm=1', hash: '#/' })).toBe(false);
  });
});

describe('shellGrid — 압축 화면 규칙', () => {
  it('데스크톱 기본: 사이드바 | 본문 | 패널 (지금과 같음)', () => {
    const g = shellGrid({ navSide: true, navRow: false, panelCol: true, notice: false });
    expect(g.cols).toBe('var(--nav-w) minmax(0, 1fr) var(--panel-w)');
    expect(g.areas).toBe("'header header header' 'nav main panel'");
  });

  it('넓게 보기·압축(선택 없음): 칩 한 줄 + 본문 전체 폭, 사이드바·패널 열 없음', () => {
    const g = shellGrid({ navSide: false, navRow: true, panelCol: false, notice: false });
    expect(g.cols).toBe('minmax(0, 1fr)');
    expect(g.areas).toBe("'header' 'nav' 'main'");
    expect(g.rows).toBe('auto auto minmax(0, 1fr)');
  });

  it('압축 + 기기 선택: 패널 열은 칩 줄부터 본문까지 차지', () => {
    const g = shellGrid({ navSide: false, navRow: true, panelCol: true, notice: false });
    expect(g.areas).toBe("'header header' 'nav panel' 'main panel'");
  });

  it('시작 카드 줄은 본문 바로 위(가운데 열)에만', () => {
    const g = shellGrid({ navSide: true, navRow: false, panelCol: true, notice: true });
    expect(g.areas).toBe("'header header header' 'nav notice panel' 'nav main panel'");
  });

  it('계통도 밖 화면(사이드바 없음): 헤더 + 본문만', () => {
    const g = shellGrid({ navSide: false, navRow: false, panelCol: false, notice: false });
    expect(g.areas).toBe("'header' 'main'");
  });
});

describe('교육 탭 제거 (2026-11-18 사용자 결정)', () => {
  it('헤더에는 보기 모드 토글이 없고 화면 메뉴(계통도·제품 조회·라인업 현황)와 아이콘 버튼 2개', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Header />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('group', { name: '보기 모드' })).toBeNull();
    expect(screen.queryByTestId('view-mode-product')).toBeNull();
    const nav = screen.getByRole('navigation', { name: '화면' });
    const links = Array.from(nav.querySelectorAll('a'));
    expect(links.map((a) => a.textContent)).toEqual(['계통도', '제품 조회', '라인업 현황']);
    expect(screen.getByTestId('products-link')).toHaveAttribute('href', '/products');
    expect(links[0]).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('gap-table-link')).toHaveAttribute('href', '/gap');
    // 아이콘 버튼: 화면낭독기 이름 + title
    expect(screen.getByTestId('present-toggle')).toHaveAccessibleName('넓게 보기');
    expect(screen.getByTestId('present-toggle')).toHaveAttribute('title');
    expect(screen.getByTestId('theme-toggle')).toHaveAttribute('title');
    expect(screen.queryByText(/교육/)).toBeNull();
  });

  it('계통도 도구줄: 맨 왼쪽 [계통맵 | 단계별] 스위치, 보기 모드(전체·보완 필요) 버튼 없음 (2026-11-20 — 범례 "미보유"로 확인)', () => {
    render(
      <MemoryRouter initialEntries={['/?node=n-vcb']}>
        <DiagramToolbar mode="product" total={10} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('group', { name: '보기 모드' })).toBeNull();
    expect(screen.queryByTestId('view-mode-gap')).toBeNull();
    const row = screen.getByTestId('view-switch').closest('.dtool__main')!;
    expect(row.firstElementChild).toHaveAttribute('data-testid', 'view-switch');
    expect(screen.getByTestId('dtool-end')).toBeInTheDocument();
  });

  it('옛 링크 ?mode=learn 은 제품 모드로 해석 (gap 만 Gap 모드)', () => {
    expect(parseMode('learn')).toBe('product');
    expect(parseMode('gap')).toBe('gap');
    expect(parseMode(null)).toBe('product');
  });
});

describe('LiveRegion — 앱 공용 안내', () => {
  it('announce() 문장을 aria-live=polite 영역에 표시 (같은 문장도 다시 채움)', () => {
    vi.useFakeTimers();
    render(<LiveRegion />);
    const region = screen.getByTestId('live-region');
    expect(region).toHaveAttribute('aria-live', 'polite');
    act(() => {
      announce('공백 목록 — 17종');
      vi.advanceTimersByTime(100);
    });
    expect(region.textContent).toBe('공백 목록 — 17종');
    act(() => {
      announce('공백 목록 — 17종');
    });
    expect(region.textContent).toBe('');
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(region.textContent).toBe('공백 목록 — 17종');
  });
});

describe('diagramHandlesFocus — 라우트 포커스 예외', () => {
  it('계통도로 노드 선택·점프 이동이면 계통도가 포커스를 처리', () => {
    expect(diagramHandlesFocus('/', '?node=n-vcb', null)).toBe(true);
    expect(diagramHandlesFocus('/', '', { jumpTo: 'L5' })).toBe(true);
    expect(diagramHandlesFocus('/', '', { focusNode: 'n-vcb' })).toBe(true);
    expect(diagramHandlesFocus('/', '?mode=gap', null)).toBe(false);
    expect(diagramHandlesFocus('/gap', '?node=x', null)).toBe(false);
  });
});
