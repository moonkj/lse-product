import { useId, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Fuse from 'fuse.js';
import { getData, loadSpecs, peekSpecs, type SpecsMap } from '../../data/load';
import { COVERAGE_LABELS } from '../../lib/labels';
import { getDiagramModel, layerTitle, type NodeItem } from '../../lib/diagram/model';
import { homeSearchWithNode, type FocusState } from '../../lib/diagram/url';
import { equipmentForProduct, productsForEquipment } from '../../lib/pages/catalog';
import { buildOptionIndex, optionHref, productNameExact, searchOptions, OPTION_SCORE, type OptionDoc } from '../../lib/search';
import { useAppStore } from '../../store/useAppStore';
import './SearchBox.css';

type Result = { score: number } & (
  | { kind: 'equipment'; key: string; node: NodeItem }
  | { kind: 'product'; key: string; id: string; name: string; path: string }
  | { kind: 'option'; key: string; doc: OptionDoc }
);

const KIND_ORDER: Record<Result['kind'], number> = { equipment: 0, product: 1, option: 2 };

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
    const nodeByEq = new Map(model.nodes.map((n) => [n.eq.id, n] as const));
    return { eq, products, nodeByEq };
  }, []);
}

/**
 * 옵션 색인 (B6) — specs.json 은 지연 로딩: 검색창 포커스·입력 때 불러오고, 도착하면 색인을 만든다.
 * 실패해도 기존 기기·제품 검색은 그대로 (조용히 콘솔에만 기록).
 */
function useOptionIndex() {
  const [specs, setSpecs] = useState<SpecsMap | undefined>(peekSpecs);
  const ensure = () => {
    if (specs) return;
    loadSpecs().then(setSpecs, (e: unknown) => console.error('[search] specs.json', e));
  };
  const index = useMemo(() => {
    if (!specs) return [];
    const byId = getData().productById;
    return buildOptionIndex(specs, (id) => byId.get(id)?.name);
  }, [specs]);
  return { index, ensure };
}

/** 정확 일치로 볼 점수 상한 — 이 무리는 맨 위에 두고, 기기 1줄은 그 바로 뒤에 보장 */
const EXACT_MAX_SCORE = 0.05;

/**
 * 기기 결과 1줄 보장 (UX 토론 B6 절충) — 정확 일치 무리 바로 뒤에 기기 1줄이 오게 한다.
 * 기기 검색 결과가 없으면 맨 위 제품·옵션이 속한 기기를 대신 보여 준다 (예: TS250 → MCCB).
 */
function withEquipmentRow(merged: Result[], eqs: Result[], nodeByEq: Map<string, NodeItem>): Result[] {
  const firstEq = merged.findIndex((r) => r.kind === 'equipment');
  let eqRow: Result | undefined = firstEq >= 0 ? merged[firstEq] : undefined;
  if (!eqRow && eqs.length === 0) {
    const top = merged.find((r) => r.kind !== 'equipment');
    const productId = top?.kind === 'option' ? top.doc.productId : top?.kind === 'product' ? top.id : undefined;
    const eq = productId ? equipmentForProduct(productId)[0] : undefined;
    const node = eq ? nodeByEq.get(eq.id) : undefined;
    if (node) eqRow = { kind: 'equipment', key: `e-${node.id}`, node, score: 1 };
  }
  if (!eqRow) return merged;
  const exactCount = merged.findIndex((r) => r.score > EXACT_MAX_SCORE);
  // 맨 위(Enter 대상)는 점수 1위 그대로 두고, 정확 일치 무리(없으면 1위) 바로 뒤
  const slot = Math.min(Math.max(1, exactCount < 0 ? merged.length : exactCount), MAX_TOTAL - 1);
  if (firstEq >= 0 && firstEq <= slot) return merged;
  const rest = merged.filter((r) => r !== eqRow);
  return [...rest.slice(0, slot), eqRow, ...rest.slice(slot)];
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
  const opt = useOptionIndex();
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
      // 제품명의 모델 토큰이 정확히 같으면 정확 일치로 올림 (예: "GIPAM 1000" → GIPAM1000)
      score: productNameExact(r.item.name, q) ? OPTION_SCORE.exact : (r.score ?? 1),
    }));
    const opts: Result[] = searchOptions(opt.index, q, MAX_EACH).map((h) => ({
      kind: 'option',
      key: `o-${h.doc.productId}-${h.doc.variantId}`,
      doc: h.doc,
      score: h.score,
    }));
    // 기기·제품·옵션을 점수 하나로 합쳐 정렬 (같은 점수면 기기 → 제품 → 옵션) → Enter = 가장 잘 맞는 결과
    const merged = [...eqs, ...prods, ...opts].sort((a, b) => a.score - b.score || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
    return withEquipmentRow(merged, eqs, idx.nodeByEq).slice(0, MAX_TOTAL);
  }, [q, idx, opt.index]);

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
        </div>
      )}
    </form>
  );
}
