import { Link, useLocation } from 'react-router-dom';
import type { ViewMode } from '../../store/useAppStore';
import { parseMode, useSetViewMode } from '../../lib/diagram/url';
import SearchBox from './SearchBox';

const MODES: { value: ViewMode; label: string }[] = [
  { value: 'product', label: '제품' },
  { value: 'gap', label: 'Gap' },
  { value: 'learn', label: '교육' },
];

/** 눌린 버튼: 계통도(/)는 ?mode= 쿼리, /gap(공백 표)·/learn(투어)은 해당 모드. 기기·제품·404 는 없음 */
function activeMode(pathname: string, search: string): ViewMode | null {
  if (pathname === '/') return parseMode(new URLSearchParams(search).get('mode'));
  if (pathname.startsWith('/gap')) return 'gap';
  if (pathname.startsWith('/learn')) return 'learn';
  return null;
}

export default function Header() {
  const { pathname, search } = useLocation();
  const setMode = useSetViewMode();
  const active = activeMode(pathname, search);

  return (
    <header className="app-header">
      <Link to="/" className="app-header__logo">
        <strong>LS ELECTRIC</strong> 전력계통 제품맵
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
    </header>
  );
}
