/**
 * 단위·컴포넌트 테스트 — UX 라운드 U T1-C (레이아웃·안내)
 *  - useUiStore: 발표 보기·시작 카드 저장(localStorage, 차단돼도 동작), 첫 주소 판정 isCleanEntry
 *  - shellGrid: 압축 화면 규칙의 grid 템플릿 (사이드바·칩 줄·패널 열·시작 카드 줄)
 *  - StartCard 표시 조건(1회·공유 링크 미표시·계통도에서만), Esc 닫기
 *  - LiveRegion: announce() 를 polite 영역에 표시
 *  - diagramHandlesFocus: 계통도 노드 선택·점프 이동은 라우트 포커스를 건드리지 않음
 *  - 교육 탭 제거(2026-11-18 사용자 결정): 헤더 모드 탭은 제품·Gap 뿐, 옛 ?mode=learn 은 제품 모드
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PRESENT_KEY, START_CARD_KEY, isCleanEntry, resetUiStore, useUiStore } from '../../../src/store/useUiStore';
import { shellGrid } from '../../../src/components/layout/shellLayout';
import StartCard, { useStartCardVisible } from '../../../src/components/layout/StartCard';
import LiveRegion from '../../../src/components/layout/LiveRegion';
import { diagramHandlesFocus } from '../../../src/components/layout/useRouteFocus';
import { announce } from '../../../src/lib/announce';
import Header from '../../../src/components/layout/Header';
import { parseMode } from '../../../src/lib/diagram/url';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
  resetUiStore();
});

describe('useUiStore — 발표 보기·시작 카드 저장', () => {
  it('발표 보기 토글은 localStorage 에 저장되고 새로 읽어도 유지', () => {
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

  it('발표 보기·압축(선택 없음): 칩 한 줄 + 본문 전체 폭, 사이드바·패널 열 없음', () => {
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

function Probe() {
  return <span data-testid="probe">{String(useStartCardVisible())}</span>;
}

describe('StartCard — 첫 방문 1회', () => {
  const renderAt = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Probe />
        <StartCard />
      </MemoryRouter>,
    );

  it('첫 주소가 깨끗하고 닫은 적 없을 때 계통도(/)에서만 보임', () => {
    useUiStore.setState({ entryClean: true, startCardDismissed: false });
    renderAt('/');
    expect(screen.getByTestId('probe').textContent).toBe('true');
    cleanup();
    renderAt('/gap');
    expect(screen.getByTestId('probe').textContent).toBe('false');
  });

  it('공유 링크로 들어온 경우(entryClean=false)·이미 닫은 경우에는 안 보임', () => {
    useUiStore.setState({ entryClean: false, startCardDismissed: false });
    renderAt('/');
    expect(screen.getByTestId('probe').textContent).toBe('false');
    cleanup();
    useUiStore.setState({ entryClean: true, startCardDismissed: true });
    renderAt('/');
    expect(screen.getByTestId('probe').textContent).toBe('false');
  });

  it('안내 링크 2개(기기·공백 표, 교육 투어 없음) + 검색 안내 문구 + 닫기 버튼, Esc 로 닫으면 저장', () => {
    useUiStore.setState({ entryClean: true, startCardDismissed: false });
    renderAt('/');
    const links = screen.getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/?node=n-vcb', '/gap']);
    expect(screen.queryByTestId('start-card-tour')).toBeNull();
    expect(screen.queryByText(/교육/)).toBeNull();
    expect(screen.getByTestId('start-card-hint').textContent).toMatch(/검색창에 모델명\(예: TS250\)/);
    expect(screen.getByRole('button', { name: '시작 안내 닫기' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull(); // 모달 아님
    fireEvent.keyDown(links[1], { key: 'Escape' });
    expect(useUiStore.getState().startCardDismissed).toBe(true);
    expect(localStorage.getItem(START_CARD_KEY)).toBe('1');
  });
});

describe('교육 탭 제거 (2026-11-18 사용자 결정)', () => {
  it('헤더 보기 모드 탭은 제품·Gap 2개뿐 — 교육 탭 없음', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Header />
      </MemoryRouter>,
    );
    const group = screen.getByRole('group', { name: '보기 모드' });
    const tabs = Array.from(group.querySelectorAll('button'));
    expect(tabs.map((b) => b.textContent)).toEqual(['제품', 'Gap']);
    expect(screen.queryByTestId('view-mode-learn')).toBeNull();
    expect(screen.queryByRole('button', { name: '교육' })).toBeNull();
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
