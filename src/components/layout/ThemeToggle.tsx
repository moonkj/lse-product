import { useState } from 'react';
import { applyTheme, currentTheme, type Theme } from '../../lib/theme';

/**
 * 헤더 다크 모드 토글. 버튼 글자 = 누르면 바뀔 모드 ("다크 모드"/"라이트 모드") — 이름이 화면 글자와 같다 (WCAG 2.5.3).
 * 모바일에서는 아이콘만 보이고 글자는 스크린리더용으로 남는다 (AppLayout.css).
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const label = next === 'dark' ? '다크 모드' : '라이트 모드';
  return (
    <button
      type="button"
      className="theme-toggle"
      data-testid="theme-toggle"
      data-theme-current={theme}
      title={`${label}로 보기`}
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
    >
      {next === 'dark' ? (
        <svg className="theme-toggle__icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        </svg>
      ) : (
        <svg className="theme-toggle__icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      )}
      <span className="theme-toggle__label">{label}</span>
    </button>
  );
}
