import { useId, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getData, loadSpecs, peekSpecs, type SpecsMap } from '../../data/load';
import { COVERAGE_LABELS } from '../../lib/labels';
import { layerTitle } from '../../lib/diagram/model';
import { homeSearchWithNode, type FocusState } from '../../lib/diagram/url';
import { buildOptionIndex, optionHref } from '../../lib/search';
import { buildSearchIndexes, rankSearch, type SearchResult as Result } from '../../lib/searchRank';
import { useAppStore } from '../../store/useAppStore';
import './SearchBox.css';

const SUGGESTIONS = ['VCB', 'ACB', 'MCCB', '보호계전기', '인버터', 'PLC'];

/** specs 로딩 실패 뒤 다시 요청하지 않는 시간 (리뷰 R2 — 입력마다 재요청·콘솔 오류 누적 방지) */
export const SPECS_RETRY_MS = 30_000;
/** 마지막 실패 시각 (모듈 전역 — 검색창이 다시 마운트돼도 유지) */
let specsFailedAt: number | undefined;

/**
 * 옵션 색인 (B6) — specs.json 은 지연 로딩: 검색창 포커스·입력 때 불러오고, 도착하면 색인을 만든다.
 * 실패해도 기존 기기·제품 검색은 그대로. 실패하면 30초 동안 다시 요청하지 않고, 검색 결과에 한 줄 안내.
 */
function useOptionIndex() {
  const [specs, setSpecs] = useState<SpecsMap | undefined>(peekSpecs);
  const [failed, setFailed] = useState(() => specsFailedAt !== undefined);
  const ensure = () => {
    if (specs) return;
    if (specsFailedAt !== undefined && Date.now() - specsFailedAt < SPECS_RETRY_MS) return;
    loadSpecs().then(
      (m) => {
        specsFailedAt = undefined;
        setFailed(false);
        setSpecs(m);
      },
      (e: unknown) => {
        if (specsFailedAt === undefined || Date.now() - specsFailedAt >= SPECS_RETRY_MS) console.error('[search] specs.json', e);
        specsFailedAt = Date.now();
        setFailed(true);
      },
    );
  };
  const index = useMemo(() => {
    if (!specs) return [];
    const byId = getData().productById;
    return buildOptionIndex(specs, (id) => byId.get(id)?.name);
  }, [specs]);
  return { index, ensure, failed };
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
  const idx = useMemo(buildSearchIndexes, []);
  const opt = useOptionIndex();
  const listId = useId();

  const q = query.trim();
  const results = useMemo<Result[]>(() => rankSearch(q, idx, opt.index), [q, idx, opt.index]);

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
    } else if (r.kind === 'option') {
      navigate(optionHref(r.doc.productId, r.doc.variantId));
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
          opt.ensure();
        }}
        onFocus={() => {
          setOpen(true);
          opt.ensure();
        }}
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
                    data-testid={
                      r.kind === 'equipment'
                        ? `search-result-equipment-${r.node.eq.id}`
                        : r.kind === 'option'
                          ? `search-result-option-${r.doc.productId}-${r.doc.variantId}`
                          : `search-result-product-${r.id}`
                    }
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
                    ) : r.kind === 'option' ? (
                      <>
                        <span className="search__kind search__kind--option">옵션</span>
                        <span className="search__main">
                          <strong>
                            {r.doc.productName} · {r.doc.label}
                          </strong>
                          <span className="search__sub">
                            {r.doc.axis ? `${r.doc.axis} 옵션 · ` : ''}정격 열 강조
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
          {opt.failed && (
            <p className="search__warn" role="status" data-testid="search-specs-failed">
              모델명 색인을 불러오지 못했습니다. 연결 후 다시 검색해 주세요.
            </p>
          )}
        </div>
      )}
    </form>
  );
}
