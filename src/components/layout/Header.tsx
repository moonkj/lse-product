import { Link, useLocation } from 'react-router-dom';
import type { ViewMode } from '../../lib/diagram/url';
import { parseMode, useSetViewMode } from '../../lib/diagram/url';
import SearchBox from './SearchBox';
import BrandLogo from '../common/BrandLogo';
import { useUiStore } from '../../store/useUiStore';

const MODES: { value: ViewMode; label: string }[] = [
  { value: 'product', label: '제품' },
  { value: 'gap', label: 'Gap' },
];

/** 눌린 버튼: 계통도(/)는 ?mode= 쿼리, /gap(공백 표)은 Gap. 기기·제품·404 는 없음 (교육 탭 제거 — 2026-11-18 사용자 결정) */
function activeMode(pathname: string, search: string): ViewMode | null {
  if (pathname === '/') return parseMode(new URLSearchParams(search).get('mode'));
  if (pathname.startsWith('/gap')) return 'gap';
  return null;
}

export default function Header() {
  const { pathname, search } = useLocation();
  const setMode = useSetViewMode();
  const active = activeMode(pathname, search);
  const present = useUiStore((s) => s.present);
  const togglePresent = useUiStore((s) => s.togglePresent);

  return (
    <header className="app-header">
      <Link to="/" className="app-header__logo">
        <BrandLogo className="app-header__brand" />
        <span className="app-header__title">전력계통 제품맵</span>
      </Link>

      <SearchBox />

      <div className="mode-toggle" role="group" aria-label="보기 모드">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            aria-pressed={active === m.value}
            className="mode-toggle__btn"
            data-testid={`view-mode-${m.value}`}
            onClick={() => setMode(m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* 발표 보기 (C1): 압축 화면을 손으로 켜는 토글 — 배치만 바꾸고 내용은 그대로 */}
      <button
        type="button"
        className="present-toggle"
        aria-pressed={present}
        data-testid="present-toggle"
        title={present ? '발표 보기 끄기 — 사이드바·상세 패널 다시 펼치기' : '발표 보기 — 사이드바·빈 상세 패널을 접어 계통도를 넓게'}
        onClick={togglePresent}
      >
        <svg className="present-toggle__icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="4" width="18" height="12" rx="1.5" />
          <path d="M12 16v4M8 20h8" />
        </svg>
        <span className="present-toggle__label">발표 보기</span>
      </button>
    </header>
  );
}
