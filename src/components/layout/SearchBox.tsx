import { useId, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Fuse from 'fuse.js';
import { getData } from '../../data/load';
import { COVERAGE_LABELS } from '../../lib/labels';
import { getDiagramModel, layerTitle, type NodeItem } from '../../lib/diagram/model';
import { homeSearchWithNode, type FocusState } from '../../lib/diagram/url';
import { productsForEquipment } from '../../lib/pages/catalog';
import { useAppStore } from '../../store/useAppStore';

type Result = { score: number } & (
  | { kind: 'equipment'; key: string; node: NodeItem }
  | { kind: 'product'; key: string; id: string; name: string; path: string }
);

const MAX_EACH = 6;
const MAX_TOTAL = 10;
const SUGGESTIONS = ['VCB', 'ACB', 'MCCB', '보호계전기', '인버터', 'PLC'];
/** 영숫자(모델명) 질의에서 기기 설명문 퍼지 매칭 잡음을 거르는 점수 상한 (0 = 완전 일치) */
const ASCII_EQ_MAX_SCORE = 0.2;

interface EqDoc {
  node: NodeItem;
  abbr?: string;
  name: string;
  description: string;
  /** 연결 제품 이름 — 모델명(GIPAM·Susol·iS7)으로 기기를 찾기 위함 */
  productNames: string[];
}

function useIndexes() {
  return useMemo(() => {
    const model = getDiagramModel();
    const docs: EqDoc[] = model.nodes.map((node) => ({
      node,
      abbr: node.eq.abbr,
      name: node.eq.name,
      description: node.eq.description,
      productNames: productsForEquipment(node.eq.id).map((p) => p.name),
    }));
    const eq = new Fuse(docs, {
      keys: [
        { name: 'abbr', weight: 3 },
        { name: 'name', weight: 3 },
        { name: 'productNames', weight: 1 },
        { name: 'description', weight: 0.5 },
      ],
      threshold: 0.34,
      ignoreLocation: true,
      includeScore: true,
      minMatchCharLength: 2,
    });
    const products = new Fuse(getData().products, {
      keys: [
        { name: 'name', weight: 3 },
        { name: 'categoryPath', weight: 1 },
      ],
      threshold: 0.3,
      ignoreLocation: true,
      includeScore: true,
      minMatchCharLength: 2,
    });
    return { eq, products };
  }, []);
}

/** IME(한글) 조합 중인 키 입력인지 — 조합 중 Enter 는 글자 확정용이므로 무시 */
const isComposingKey = (e: React.KeyboardEvent) => e.nativeEvent.isComposing || e.keyCode === 229;

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
    const ascii = /^[\x20-\x7e]+$/.test(q);
    const eqs: Result[] = idx.eq
      .search(q, { limit: MAX_EACH })
      .filter((r) => !ascii || (r.score ?? 1) <= ASCII_EQ_MAX_SCORE)
      .map((r) => ({ kind: 'equipment', key: `e-${r.item.node.id}`, node: r.item.node, score: r.score ?? 1 }));
    const prods: Result[] = idx.products.search(q, { limit: MAX_EACH }).map((r) => ({
      kind: 'product',
      key: `p-${r.item.id}`,
      id: r.item.id,
      name: r.item.name,
      path: r.item.categoryPath.join(' › '),
      score: r.score ?? 1,
    }));
    // 기기·제품을 점수 하나로 합쳐 정렬 (같은 점수면 기기 먼저) → Enter = 가장 잘 맞는 결과
    return [...eqs, ...prods]
      .sort((a, b) => a.score - b.score || (a.kind === b.kind ? 0 : a.kind === 'equipment' ? -1 : 1))
      .slice(0, MAX_TOTAL);
  }, [q, idx]);

  const showPopup = open && q.length > 0;
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const choose = (r: Result) => {
    setOpen(false);
    setQuery('');
    if (r.kind === 'equipment') {
      const onHome = location.pathname === '/';
      // 포커스는 계통도가 화면 전환을 마친 뒤 DiagramCanvas 가 옮긴다 (다른 화면에서 온 경우 rAF 로는 아직 노드가 없음)
      const state: FocusState = { focusNode: r.node.id };
      navigate({ pathname: '/', search: homeSearchWithNode(location.search, r.node.id, onHome) }, { state });
    } else {
      navigate(`/product/${r.id}`);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isComposingKey(e)) return;
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
                return (
                  <li
                    key={r.key}
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === active}
                    className={`search__opt${i === active ? ' is-active' : ''}`}
                    data-testid={r.kind === 'equipment' ? `search-result-equipment-${r.node.eq.id}` : `search-result-product-${r.id}`}
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
