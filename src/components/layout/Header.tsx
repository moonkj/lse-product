import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore, type ViewMode } from '../../store/useAppStore';
import CoverageLegend from './CoverageLegend';

const MODES: { value: ViewMode; label: string; path: string }[] = [
  { value: 'product', label: '제품', path: '/' },
  { value: 'gap', label: 'Gap', path: '/gap' },
  { value: 'learn', label: '교육', path: '/learn' },
];

/** 현재 라우트 → 눌린 버튼. 기기·제품·404 페이지에서는 아무 버튼도 눌리지 않음 */
function modeFromPath(pathname: string): ViewMode | null {
  if (pathname === '/') return 'product';
  if (pathname.startsWith('/gap')) return 'gap';
  if (pathname.startsWith('/learn')) return 'learn';
  return null;
}

export default function Header() {
  const setViewMode = useAppStore((s) => s.setViewMode);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const navigate = useNavigate();
  const activeMode = modeFromPath(useLocation().pathname);

  return (
    <header className="app-header">
      <Link to="/" className="app-header__logo">
        <strong>LS ELECTRIC</strong> 전력계통 제품맵
      </Link>

      <form className="app-header__search" role="search" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="global-search" className="visually-hidden">
          제품·기기 검색
        </label>
        <input
          id="global-search"
          type="search"
          placeholder="제품명·모델명·기기 검색"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </form>

      <div className="mode-toggle" role="group" aria-label="보기 모드">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            aria-pressed={activeMode === m.value}
            className="mode-toggle__btn"
            data-testid={`view-mode-${m.value}`}
            onClick={() => {
              setViewMode(m.value);
              navigate(m.path);
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <CoverageLegend />
    </header>
  );
}
