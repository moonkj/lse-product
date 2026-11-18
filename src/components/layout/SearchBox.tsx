import { useId, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Fuse from 'fuse.js';
import { getData } from '../../data/load';
import { COVERAGE_LABELS } from '../../lib/schema';
import { getDiagramModel, layerTitle, type NodeItem } from '../../lib/diagram/model';
import { homeSearchWithNode } from '../../lib/diagram/url';
import { useAppStore } from '../../store/useAppStore';

type Result =
  | { kind: 'equipment'; key: string; node: NodeItem }
  | { kind: 'product'; key: string; id: string; name: string; path: string };

const MAX_EACH = 6;
const SUGGESTIONS = ['VCB', 'ACB', 'MCCB', '보호계전기', '인버터', 'PLC'];

function useIndexes() {
  return useMemo(() => {
    const model = getDiagramModel();
    const eq = new Fuse(model.nodes, {
      keys: [
        { name: 'eq.abbr', weight: 3 },
        { name: 'eq.name', weight: 3 },
        { name: 'eq.description', weight: 0.5 },
      ],
      threshold: 0.34,
      ignoreLocation: true,
    });
    const products = new Fuse(getData().products, {
      keys: [
        { name: 'name', weight: 3 },
        { name: 'categoryPath', weight: 1 },
      ],
      threshold: 0.3,
      ignoreLocation: true,
    });
    return { eq, products };
  }, []);
}

/** 헤더 검색 (combobox): 기기(약어·이름) + 제품(이름·분류). 기기 선택 → 계통도에서 그 노드 선택 */
export default function SearchBox() {
  const query = useAppStore((s) => s.searchQuery);
  const setQuery = useAppStore((s) => s.setSearchQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const idx = useIndexes();
  const listId = useId();

  const q = query.trim();
  const results = useMemo<Result[]>(() => {
    if (!q) return [];
    const eqs: Result[] = idx.eq
      .search(q, { limit: MAX_EACH })
      .map((r) => ({ kind: 'equipment', key: `e-${r.item.id}`, node: r.item }));
    const prods: Result[] = idx.products.search(q, { limit: MAX_EACH }).map((r) => ({
      kind: 'product',
      key: `p-${r.item.id}`,
      id: r.item.id,
      name: r.item.name,
      path: r.item.categoryPath.join(' › '),
    }));
    return [...eqs, ...prods];
  }, [q, idx]);

  const showPopup = open && q.length > 0;
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const choose = (r: Result) => {
    setOpen(false);
    setQuery('');
    if (r.kind === 'equipment') {
      const onHome = location.pathname === '/';
      navigate({ pathname: '/', search: homeSearchWithNode(location.search, r.node.id, onHome) });
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(r.node.id)}"]`)?.focus({ preventScroll: true });
      });
    } else {
      navigate(`/product/${r.id}`);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && results.length) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === 'ArrowUp' && results.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = results[active] ?? results[0];
      if (r) choose(r);
    } else if (e.key === 'Escape' && (showPopup || query)) {
      e.preventDefault(); // 상세 패널 Esc 와 겹치지 않게
      if (showPopup) setOpen(false);
      else setQuery('');
    }
  };

  let lastKind: Result['kind'] | null = null;

  return (
    <form className="app-header__search search" role="search" onSubmit={(e) => e.preventDefault()}>
      <label htmlFor="global-search" className="visually-hidden">
        제품·기기 검색
      </label>
      <svg className="search__icon" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20 L16 16" />
      </svg>
      <input
        id="global-search"
        type="search"
        autoComplete="off"
        placeholder="기기·제품·모델명 검색 (예: VCB, GIPAM, iS7)"
        value={query}
        role="combobox"
        aria-expanded={showPopup && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showPopup && results[active] ? optionId(active) : undefined}
        data-testid="search-input"
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {showPopup && (
        <div className="search__popup">
          {results.length > 0 ? (
            <ul id={listId} role="listbox" aria-label="검색 결과" className="search__list" data-testid="search-results">
              {results.map((r, i) => {
                const header = r.kind !== lastKind ? (r.kind === 'equipment' ? '기기' : '제품') : null;
                lastKind = r.kind;
                return (
                  <li
                    key={r.key}
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === active}
                    className={`search__opt${i === active ? ' is-active' : ''}`}
                    data-testid={r.kind === 'equipment' ? `search-result-equipment-${r.node.eq.id}` : `search-result-product-${r.id}`}
                    data-group={header ?? undefined}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(r)}
                  >
                    {r.kind === 'equipment' ? (
                      <>
                        <span className="search__kind">기기</span>
                        <span className="search__main">
                          <strong>{r.node.eq.abbr ? `${r.node.eq.abbr} · ` : ''}{r.node.eq.name}</strong>
                          <span className="search__sub">
                            {layerTitle(r.node.layer)} · {COVERAGE_LABELS[r.node.coverage]}
                          </span>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="search__kind search__kind--product">제품</span>
                        <span className="search__main">
                          <strong>{r.name}</strong>
                          <span className="search__sub">{r.path}</span>
                        </span>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="search__empty">
              <p data-testid="search-empty">“{q}” 에 대한 결과가 없습니다.</p>
              <div className="search__suggest" data-testid="search-suggestions">
                <span>이렇게 찾아보세요:</span>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="search__chip"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setQuery(s);
                      setActive(0);
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
