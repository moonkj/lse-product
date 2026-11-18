/**
 * 화면 테마 (라이트/다크). 기본은 라이트 고정 — 시스템 다크 설정을 따르지 않는다 (2026-11-18 사용자 결정).
 * 헤더 토글로 다크를 고르면 <html data-theme="dark"> + localStorage 'lse-theme'='dark'.
 * 첫 그리기 전 복원은 index.html 인라인 스크립트가 같은 키로 한다 (키를 바꾸면 거기도 같이).
 */
export type Theme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'lse-theme';

export function currentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'dark') root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');
  try {
    if (theme === 'dark') localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    else localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // 저장 불가(사생활 보호 모드 등) — 이번 방문에만 적용
  }
}
