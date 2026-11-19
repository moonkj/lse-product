import { Link, useLocation } from 'react-router-dom';
import SearchBox from './SearchBox';
import BrandLogo from '../common/BrandLogo';
import { useUiStore } from '../../store/useUiStore';
import ThemeToggle from './ThemeToggle';
import QrButton from './QrButton';

export default function Header() {
  const { pathname } = useLocation();
  const present = useUiStore((s) => s.present);
  const togglePresent = useUiStore((s) => s.togglePresent);

  return (
    <header className="app-header">
      <Link to="/" className="app-header__logo">
        <BrandLogo className="app-header__brand" size="md" />
        <span className="app-header__title">
          전력계통 제품맵
          <span className="app-header__sub">LS ELECTRIC 제품 지도</span>
        </span>
      </Link>

      {/* 화면 메뉴 (디자이너 토론 P1): 계통도 · 공백 표. 제품/Gap 전환은 계통도 도구줄로 옮김 */}
      <nav className="app-nav" aria-label="화면">
        <Link to="/" className="app-nav__link" aria-current={pathname === '/' ? 'page' : undefined}>
          계통도
        </Link>
        <Link
          to="/gap"
          className="app-nav__link"
          data-testid="gap-table-link"
          aria-current={pathname.startsWith('/gap') ? 'page' : undefined}
        >
          공백 표
        </Link>
      </nav>

      <SearchBox />

      {/* QR — 오른쪽 버튼 묶음 맨 왼쪽 (2026-11-19 사용자) */}
      <QrButton />

      {/* 넓게 보기 (C1): 압축 화면을 손으로 켜는 토글. 디자이너 토론 P0-5: 아이콘 버튼(글자는 화면낭독기용) */}
      <button
        type="button"
        className="present-toggle"
        aria-pressed={present}
        data-testid="present-toggle"
        title={present ? '넓게 보기 끄기 — 사이드바·상세 패널 다시 펼치기' : '넓게 보기 — 사이드바·빈 상세 패널을 접어 계통도를 넓게'}
        onClick={togglePresent}
      >
        <svg className="present-toggle__icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="4" width="18" height="12" rx="1.5" />
          <path d="M12 16v4M8 20h8" />
        </svg>
        <span className="present-toggle__label">넓게 보기</span>
      </button>

      <ThemeToggle />
    </header>
  );
}
