import { create } from 'zustand';

/**
 * 화면 배치 상태 (UX 라운드 U — C1 압축 화면 · C4 시작 카드).
 *
 * - present: 헤더 "넓게 보기" 토글. 켜면 압축 화면(compact)과 같은 상태가 된다 — 보이는 **내용**은 바꾸지 않고
 *   배치만 바꾼다(사이드바·빈 상세 패널 접기, 헤더 한 줄). localStorage `lse-present-v1` 에 저장.
 * - startCardDismissed: 첫 방문 시작 카드를 닫았는지. localStorage `lse-start-card-dismissed` 에 저장.
 * - entryClean: 앱을 연 주소에 쿼리·해시 경로가 없었는지(`/`, `/#`, `/#/`). 공유 링크로 들어오면 시작 카드를 띄우지 않는다.
 *
 * 저장소 접근은 모두 try/catch — 사생활 보호 모드·차단 환경에서는 메모리로만 동작.
 */
export const PRESENT_KEY = 'lse-present-v1';
export const START_CARD_KEY = 'lse-start-card-dismissed';

function read(key: string): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function write(key: string, on: boolean) {
  try {
    if (on) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch {
    /* 저장소 접근 불가 — 메모리 상태만 유지 */
  }
}

/** 주소에 파라미터·해시 경로가 없는 "맨 처음 주소"인가 (`/`, `/index.html`, `/#`, `/#/`) */
export function isCleanEntry(loc: Pick<Location, 'search' | 'hash'>): boolean {
  if (loc.search && loc.search !== '?') return false;
  const h = loc.hash;
  return h === '' || h === '#' || h === '#/';
}

export interface UiState {
  present: boolean;
  startCardDismissed: boolean;
  entryClean: boolean;
  /**
   * 기기를 고르지 않은 상태에서 상세 패널(빈 안내)을 펼쳐 두었는가 (P0-8). 기본 false = 오른쪽 레일("‹ 상세")만.
   * 저장하지 않는다 — 새로 열면 늘 레일부터 (계통도 폭 우선).
   */
  emptyPanelOpen: boolean;
  setEmptyPanelOpen: (open: boolean) => void;
  togglePresent: () => void;
  setPresent: (on: boolean) => void;
  dismissStartCard: () => void;
}

function initial() {
  return {
    present: read(PRESENT_KEY),
    startCardDismissed: read(START_CARD_KEY),
    entryClean: typeof window === 'undefined' ? false : isCleanEntry(window.location),
    emptyPanelOpen: false,
  };
}

export const useUiStore = create<UiState>()((set, get) => ({
  ...initial(),
  togglePresent: () => get().setPresent(!get().present),
  setPresent: (on) => {
    write(PRESENT_KEY, on);
    set({ present: on });
  },
  setEmptyPanelOpen: (open) => set({ emptyPanelOpen: open }),
  dismissStartCard: () => {
    write(START_CARD_KEY, true);
    set({ startCardDismissed: true });
  },
}));

/** 테스트용: 현재 window.location·localStorage 기준으로 다시 초기화 */
export function resetUiStore() {
  useUiStore.setState(initial());
}
