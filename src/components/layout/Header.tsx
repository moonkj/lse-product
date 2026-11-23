import { Link, useLocation, useNavigate } from 'react-router-dom';
import SearchBox from './SearchBox';
import BrandLogo from '../common/BrandLogo';
import { useUiStore } from '../../store/useUiStore';
import ThemeToggle from './ThemeToggle';
import QrButton from './QrButton';
import MobileMenu from './MobileMenu';

export default function Header() {
  const { pathname } = useLocation();
  const present = useUiStore((s) => s.present);
  const togglePresent = useUiStore((s) => s.togglePresent);
  const openGuide = useUiStore((s) => s.openGuide);
  const navigate = useNavigate();

  return (
    <header className="app-header">
      <Link to="/" className="app-header__logo">
        <BrandLogo className="app-header__brand" size="md" />
        <span className="app-header__title">
          전력계통 제품맵
          <span className="app-header__sub">LS ELECTRIC 제품 지도</span>
        </span>
      </Link>

      {/* 화면 메뉴: 계통도 · 제품 조회 · 라인업 현황(구 공백 표). 관리자는 화면 오른쪽 맨 아래(AdminCorner, 2026-11-23 사용자). 계통맵/단계별·제품/Gap 전환은 계통도 도구줄.
          현재 화면 = 흰 알약 채움 + 네이비 굵은 글자(도구줄 눌림 상태와 같은 '채움 = 선택' 문법) */}
      <nav className="app-nav" aria-label="화면">
        <Link to="/" className="app-nav__link" aria-current={pathname === '/' ? 'page' : undefined}>
          {/* 계통도 = 단선도(모선에서 갈라지는 선) */}
          <svg className="app-nav__icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 3v5M5 8h14M5 8v5M12 8v5M19 8v5" />
            <rect x="3" y="13" width="4" height="4" rx="1" />
            <rect x="10" y="13" width="4" height="4" rx="1" />
            <rect x="17" y="13" width="4" height="4" rx="1" />
            <path d="M12 17v4" />
          </svg>
          계통도
        </Link>
        <Link
          to="/products"
          className="app-nav__link"
          data-testid="products-link"
          aria-current={pathname.startsWith('/products') ? 'page' : undefined}
        >
          {/* 제품 조회 = 제품 카드 목록 */}
          <svg className="app-nav__icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
          제품 조회
        </Link>
        <Link
          to="/gap"
          className="app-nav__link"
          data-testid="gap-table-link"
          aria-current={pathname.startsWith('/gap') ? 'page' : undefined}
        >
          {/* 라인업 현황 = 표(행·열) */}
          <svg className="app-nav__icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 9.5h18M3 15h18M9 4v16" />
          </svg>
          라인업 현황
        </Link>
      </nav>

      <SearchBox />

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

      {/* 사용법 = 첫 화면 길잡이 다시 보기 (2026-11-23). 계통맵이 아니면 계통맵으로 간 뒤 연다 */}
      <button
        type="button"
        className="theme-toggle help-toggle"
        data-testid="help-toggle"
        title="사용법 보기"
        onClick={() => {
          if (pathname !== '/' || window.location.hash.includes('view=stage')) navigate('/');
          window.setTimeout(openGuide, pathname === '/' ? 0 : 400);
        }}
      >
        <svg className="theme-toggle__icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4" />
          <path d="M12 17h.01" />
        </svg>
        <span className="theme-toggle__label">사용법</span>
      </button>

      {/* 휴대폰(≤600px) 전용 ☰ 메뉴 — 위 화면 메뉴가 숨겨지는 폭 */}
      <MobileMenu />

      {/* QR — 헤더 맨 오른쪽 (2026-11-19 사용자) */}
      <QrButton />
    </header>
  );
}
