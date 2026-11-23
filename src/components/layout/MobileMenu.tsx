import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useUiStore } from '../../store/useUiStore';
import { applyTheme, currentTheme, type Theme } from '../../lib/theme';

/**
 * 휴대폰 헤더 ☰ 메뉴 (2026-11-23 UX 토론 P0) — 600px 이하에서는 헤더 화면 메뉴가 숨겨져 제품 조회·라인업 현황·관리자로 갈 길이 없었다.
 * 모달 대화상자(<dialog>)라 열려 있는 동안 포커스가 메뉴 안에 머물고 Esc 로 닫힌다. 화면을 옮기면 자동으로 닫힌다.
 */
const LINKS: { to: string; label: string; match: (p: string) => boolean; testId: string }[] = [
  { to: '/', label: '계통도', match: (p) => p === '/', testId: 'mmenu-home' },
  { to: '/products', label: '제품 조회', match: (p) => p.startsWith('/product'), testId: 'mmenu-products' },
  { to: '/gap', label: '라인업 현황', match: (p) => p.startsWith('/gap'), testId: 'mmenu-gap' },
  { to: '/admin', label: '관리자', match: (p) => p.startsWith('/admin'), testId: 'mmenu-admin' },
];

export default function MobileMenu() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const openGuide = useUiStore((s) => s.openGuide);
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close();
  }, [open]);

  // 화면을 옮기면 닫기
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <button
        type="button"
        className="theme-toggle mmenu-toggle"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="mobile-menu-toggle"
        onClick={() => setOpen(true)}
      >
        <svg className="theme-toggle__icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        <span className="theme-toggle__label">메뉴</span>
      </button>
      <dialog
        ref={ref}
        className="mmenu"
        aria-label="화면 메뉴"
        data-testid="mobile-menu"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false); // 바깥(배경) 누르면 닫기
        }}
      >
        <nav className="mmenu__panel" aria-label="화면">
          <div className="mmenu__head">
            <strong>메뉴</strong>
            <button type="button" className="mmenu__close" onClick={() => setOpen(false)} aria-label="메뉴 닫기" data-testid="mobile-menu-close">
              ×
            </button>
          </div>
          <ul className="mmenu__list">
            {LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="mmenu__link" aria-current={l.match(pathname) ? 'page' : undefined} data-testid={l.testId} onClick={() => setOpen(false)}>
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <button
                type="button"
                className="mmenu__link mmenu__link--btn"
                data-testid="mmenu-guide"
                onClick={() => {
                  setOpen(false);
                  if (pathname !== '/') navigate('/');
                  window.setTimeout(openGuide, pathname === '/' ? 0 : 400);
                }}
              >
                사용법 보기
              </button>
            </li>
            <li>
              {/* 휴대폰 헤더에서 뺀 다크 모드 전환 */}
              <button
                type="button"
                className="mmenu__link mmenu__link--btn"
                data-testid="mmenu-theme"
                onClick={() => {
                  applyTheme(nextTheme);
                  setTheme(nextTheme);
                }}
              >
                {nextTheme === 'dark' ? '다크 모드로 보기' : '라이트 모드로 보기'}
              </button>
            </li>
          </ul>
        </nav>
      </dialog>
    </>
  );
}
