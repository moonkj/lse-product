import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import SearchBox from './SearchBox';
import BrandLogo from '../common/BrandLogo';
import { useUiStore } from '../../store/useUiStore';
import ThemeToggle from './ThemeToggle';
import QrButton from './QrButton';
import MobileMenu from './MobileMenu';

/** 화면 메뉴 — 순서 = 업무 흐름 (계통 이해 → 제품 찾기 → 보유 현황 → 구성 설계 → 경쟁 대응) */
const NAV: { to: string; label: string; desc: string; testId?: string; icon: ReactNode }[] = [
  {
    to: '/',
    label: '계통도',
    desc: '계통도 — 발전부터 부하까지 전압 단계별 기기와 자사 보유 현황',
    // 단선도: 전원 → 모선 → 갈래
    icon: (
      <>
        <circle cx="12" cy="4.5" r="2" />
        <path d="M12 6.5V10M4 10h16M6 10v4M12 10v4M18 10v4" />
        <rect x="4" y="14" width="4" height="5.5" rx="1" />
        <rect x="10" y="14" width="4" height="5.5" rx="1" />
        <rect x="16" y="14" width="4" height="5.5" rx="1" />
      </>
    ),
  },
  {
    to: '/products',
    label: '제품 조회',
    desc: '제품 조회 — 자사 제품을 이름·형식명·분류로 찾기',
    testId: 'products-link',
    // 제품 = 상자
    icon: <path d="M12 2.8l8 4.4v9.6l-8 4.4-8-4.4V7.2zM12 12l8-4.6M12 12v9.2M12 12L4 7.4" />,
  },
  {
    to: '/gap',
    label: '라인업 현황',
    desc: '라인업 현황 — 기기별 보유·미보유 공백을 한 표로',
    testId: 'gap-table-link',
    // 현황 = 막대
    icon: <path d="M3.5 20.5h17M6.5 20.5V12M11.5 20.5V6M16.5 20.5v-5.5M20 4.5l-3.5 3.5-2-2" />,
  },
  {
    to: '/builder',
    label: '계통 구성',
    desc: '계통 구성 — 단선도를 직접 그리고 자사 제품으로 구성·점검',
    testId: 'builder-link',
    // 구성 = 상자 둘을 잇고 그리기
    icon: (
      <>
        <rect x="3" y="3.5" width="7.5" height="5.5" rx="1.2" />
        <rect x="13.5" y="15" width="7.5" height="5.5" rx="1.2" />
        <path d="M6.75 9v3.5a2 2 0 0 0 2 2h4.75M14.5 9.5l5-5 1.8 1.8-5 5H14.5z" />
      </>
    ),
  },
  {
    to: '/counter',
    label: '경쟁 대응',
    desc: '경쟁 대응 — 경쟁사 기사·제품에 대응하는 자사 제품 찾기',
    testId: 'counter-link',
    // 대응 = 과녁
    icon: (
      <>
        <circle cx="11" cy="13" r="8" />
        <circle cx="11" cy="13" r="4" />
        <path d="M11 13l8.5-8.5M16.5 4.5h3v3" />
      </>
    ),
  },
];

export default function Header() {
  const { pathname } = useLocation();
  const present = useUiStore((s) => s.present);
  const togglePresent = useUiStore((s) => s.togglePresent);
  const openGuide = useUiStore((s) => s.openGuide);
  const navigate = useNavigate();
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const lastLeft = useRef<number | null>(null);
  // 현재 화면 메뉴 위치로 알약을 옮긴다 (경로가 바뀔 때·폭이 바뀔 때)
  useLayoutEffect(() => {
    const nav = navRef.current;
    const pill = pillRef.current;
    if (!nav || !pill) return;
    const place = (animate: boolean) => {
      const cur = nav.querySelector<HTMLElement>('.app-nav__link[aria-current="page"]');
      if (!cur || !cur.offsetWidth) {
        pill.style.opacity = '0';
        lastLeft.current = null;
        return;
      }
      const left = cur.offsetLeft;
      const right = nav.clientWidth - (cur.offsetLeft + cur.offsetWidth);
      const moving = animate && lastLeft.current !== null && lastLeft.current !== left;
      pill.dataset.dir = moving ? (left > lastLeft.current! ? 'right' : 'left') : '';
      pill.dataset.anim = moving ? '1' : '';
      pill.style.top = `${cur.offsetTop}px`;
      pill.style.height = `${cur.offsetHeight}px`;
      pill.style.left = `${left}px`;
      pill.style.right = `${right}px`;
      pill.style.opacity = '1';
      if (moving && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
        pill.animate?.([{ transform: 'scaleY(1)' }, { transform: 'scaleY(0.82)', offset: 0.45 }, { transform: 'scaleY(1.04)', offset: 0.8 }, { transform: 'scaleY(1)' }], { duration: 520, easing: 'ease-out' });
      lastLeft.current = left;
    };
    place(true);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => place(false)) : undefined;
    ro?.observe(nav);
    return () => ro?.disconnect();
  }, [pathname]);

  return (
    <header className="app-header">
      <Link to="/" className="app-header__logo">
        <BrandLogo className="app-header__brand" size="md" />
        <span className="app-header__title">
          전력계통 제품맵
        </span>
      </Link>

      {/* 화면 메뉴: 계통도 · 제품 조회 · 라인업 현황(구 공백 표). 관리자는 화면 오른쪽 맨 아래(AdminCorner, 2026-11-23 사용자). 계통맵/단계별·제품/Gap 전환은 계통도 도구줄.
          현재 화면 = 흰 알약 채움 + 네이비 굵은 글자(도구줄 눌림 상태와 같은 '채움 = 선택' 문법) */}
      {/* 화면 메뉴 (2026-11-27 디자인 고도화: 하나의 캡슐 안 탭 묶음 · 의미에 맞는 아이콘 · 현재 화면 = 흰 알약 + CI 레드 아이콘 · 설명 툴팁).
          관리자는 화면 오른쪽 맨 아래(AdminCorner). 계통맵/단계별·제품/Gap 전환은 계통도 도구줄. */}
      <nav className="app-nav app-nav--pill" aria-label="화면" ref={navRef}>
        {/* 리퀴드 알약 (2026-11-27): 현재 화면 뒤 흰 알약이 메뉴를 옮길 때 앞쪽 끝이 먼저 늘어나고 뒤쪽 끝이 따라붙는 물방울 움직임 */}
        <span className="app-nav__pill" ref={pillRef} aria-hidden="true" />
        {NAV.map((m) => {
          const current = m.to === '/' ? pathname === '/' : pathname.startsWith(m.to);
          return (
            <Link key={m.to} to={m.to} className="app-nav__link" data-testid={m.testId} aria-current={current ? 'page' : undefined} title={m.desc}>
              <svg className="app-nav__icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                {m.icon}
              </svg>
              <span className="app-nav__label">{m.label}</span>
            </Link>
          );
        })}
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

      {/* 휴대폰·태블릿(≤900px) ☰ 메뉴 — 위 화면 메뉴가 숨겨지는 폭 */}
      <MobileMenu />

      {/* QR — 헤더 맨 오른쪽 (2026-11-19 사용자) */}
      <QrButton />
    </header>
  );
}
