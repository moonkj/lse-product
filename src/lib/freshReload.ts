/**
 * 새 버전 배포 직후 "이 화면을 불러오지 못했습니다" 방지 (2026-11-19 사용자: 자꾸 이 화면이 나옴).
 *
 * 원인: GitHub Pages 가 index.html 을 최대 10분 캐시 → 예전 index 가 가리키는 페이지 조각(assets/*-해시.js)은
 * 새 배포로 이미 지워져 지연 로딩이 실패한다. 단순 새로고침은 같은 캐시를 다시 받을 수 있으므로
 * 주소에 ?v=시각 을 붙여 새 index 를 받는다. 무한 반복을 막기 위해 60초 안에 한 번만 자동으로.
 */
const KEY = 'lse-fresh-reload-at';
const WINDOW_MS = 60_000;

export function reloadFresh(): void {
  try {
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* 저장 불가 — 그래도 새로고침 */
  }
  const { pathname, hash } = window.location;
  window.location.replace(`${pathname}?v=${Date.now()}${hash}`);
}

/** 온라인이고 최근 60초 안에 자동 새로고침한 적이 없으면 새 버전으로 새로고침하고 true */
export function tryAutoFreshReload(): boolean {
  if (typeof window === 'undefined' || (typeof navigator !== 'undefined' && navigator.onLine === false)) return false;
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(KEY) ?? 0);
  } catch {
    /* 무시 */
  }
  if (Date.now() - last < WINDOW_MS) return false;
  reloadFresh();
  return true;
}
