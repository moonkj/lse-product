import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { docsByProductId, equipmentThumbUrl, productImageUrl, useData } from '../data/load';
import { pageTitle } from '../lib/labels';
import { announce } from '../lib/announce';
import { downloadText } from '../lib/pages/catalog';
import { specLabel, specValueText } from '../lib/pages/compare';
import {
  BUSINESS_LABELS,
  SORT_LABELS,
  STAGE_FILTER_IDS,
  STAGE_FILTER_LABELS,
  VOLTAGE_LABELS,
  VOLTAGE_ORDER,
  buildProductCsv,
  buildProductRows,
  facetCounts,
  filterProducts,
  parseProductFilters,
  productFiltersToParams,
  type Facet,
  type ProductFilters,
  type ProductRow,
  type SortKey,
} from '../lib/pages/productCatalog';
import { useSpecs } from '../components/compare/useSpecs';
import CompareToggle from '../components/compare/CompareToggle';
import PageHeader from '../components/common/PageHeader';
import type { SpecsMap } from '../data/load';
import './pages.css';
import './ProductsPage.css';

const PAGE_SIZE = 48;

interface FacetGroupProps {
  title: string;
  facet: Facet;
  options: { value: string; label: string }[];
  selected: string[];
  counts: Map<string, number>;
  onToggle: (value: string) => void;
}

function FacetGroup({ title, facet, options, selected, counts, onToggle }: FacetGroupProps) {
  return (
    <fieldset className="pfil__group" data-testid={`pfil-${facet}`}>
      <legend className="pfil__legend">{title}</legend>
      {options.map((o) => {
        const n = counts.get(o.value) ?? 0;
        const on = selected.includes(o.value);
        return (
          <label key={o.value} className="pfil__opt" data-empty={!on && n === 0 ? true : undefined}>
            <input type="checkbox" checked={on} onChange={() => onToggle(o.value)} data-testid={`pfil-${facet}-${o.value}`} />
            <span className="pfil__opt-label">{o.label}</span>
            <span className="pfil__opt-n">{n}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

function ProductCard({ row, specs }: { row: ProductRow; specs?: SpecsMap }) {
  const p = row.product;
  const img = productImageUrl(p.id, true) ?? (row.equipment[0] ? equipmentThumbUrl(row.equipment[0].id) : undefined);
  const sp = specs?.get(p.id);
  const items = (sp?.items ?? []).slice(0, 3);
  const catalog = docsByProductId(p.id)?.docs.find((d) => d.type === 'catalog');
  return (
    <li className="pcard" data-testid={`pcard-${p.id}`}>
      {/* 사진도 상세로 가는 링크 (2026-11-19 사용자). 제목 링크와 같은 곳이라 키보드·화면낭독기에서는 건너뜀(중복 링크 방지) */}
      <Link to={`/product/${encodeURIComponent(p.id)}`} className="pcard__pic" tabIndex={-1} aria-hidden="true" data-testid={`pcard-pic-${p.id}`}>
        {img ? <img src={img} alt="" loading="lazy" /> : <span className="pcard__nopic">사진 없음</span>}
      </Link>
      <div className="pcard__tags">
        <span className="pcard__tag">{BUSINESS_LABELS[p.business]}</span>
        {row.ul && <span className="pcard__tag pcard__tag--ul">UL</span>}
        {p.discontinued && <span className="pcard__tag pcard__tag--disc">단종</span>}
      </div>
      <h2 className="pcard__name">
        <Link to={`/product/${encodeURIComponent(p.id)}`}>{p.name}</Link>
      </h2>
      <p className="pcard__cat">
        {p.categoryPath[p.categoryPath.length - 1]}
        {row.equipment.length > 0 && (
          <>
            {' · 기기: '}
            {row.equipment.slice(0, 2).map((e, i) => (
              <span key={e.id}>
                {i > 0 && ', '}
                <Link to={`/equipment/${e.id}`}>{e.abbr ?? e.name}</Link>
              </span>
            ))}
            {row.equipment.length > 2 && ` 외 ${row.equipment.length - 2}`}
          </>
        )}
      </p>
      {items.length > 0 ? (
        <dl className="pcard__specs">
          {items.map((it) => (
            <div key={it.key} className="pcard__spec">
              <dt>{specLabel(it.key, it.label)}</dt>
              <dd>{specValueText(it)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="pcard__nospec">{specs ? '정격 사양 미등록' : ''}</p>
      )}
      <div className="pcard__foot">
        <CompareToggle kind="product" id={p.id} name={p.name} />
        <a className="pcard__ext" href={catalog?.url ?? p.url} target="_blank" rel="noopener noreferrer">
          {catalog ? '카탈로그' : '공식 페이지'} ↗
        </a>
      </div>
    </li>
  );
}

/**
 * 제품 조회 (/products) — 이름·형식명·옵션명 검색 + 필터(사업·단계·전압·출처·UL·사양·단종) + 정렬, 주소가 원본.
 * 카드: 사진·출처·대표 사양 3개·연결 기기·비교 담기(최대 4, 기존 비교 화면)·카탈로그. 지금 결과 CSV 내보내기.
 */
export default function ProductsPage() {
  const data = useData();
  const specsState = useSpecs('products');
  const specs = specsState.status === 'ready' ? specsState.map : undefined;
  const rows = useMemo(() => buildProductRows(data, specs), [data, specs]);
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseProductFilters(params), [params]);
  const [qDraft, setQDraft] = useState(filters.q);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    document.title = pageTitle('제품 조회');
  }, []);
  useEffect(() => setQDraft(filters.q), [filters.q]);
  useEffect(() => setLimit(PAGE_SIZE), [params]);

  const update = (patch: Partial<ProductFilters>) => setParams(productFiltersToParams({ ...filters, ...patch }), { replace: true });
  // 검색어는 타이핑을 잠시 멈추면 주소에 반영
  useEffect(() => {
    if (qDraft === filters.q) return;
    const t = setTimeout(() => update({ q: qDraft }), 250);
    return () => clearTimeout(t);
  }, [qDraft]); // eslint-disable-line react-hooks/exhaustive-deps

  const result = useMemo(() => filterProducts(rows, filters), [rows, filters]);
  useEffect(() => {
    announce(`제품 ${result.length}개`);
  }, [result.length]);
  const counts = (facet: Facet) => facetCounts(rows, filters, facet);
  const toggleIn = <T extends string>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const active =
    filters.business.length + filters.stage.length + filters.voltage.length + filters.source.length + Number(filters.ul) + Number(filters.specsOnly) + Number(filters.showDiscontinued) + Number(!!filters.q);

  return (
    <div className="pg pg--products">
      <PageHeader
        crumbs={[{ label: '계통도', to: '/' }, { label: '제품 조회' }]}
        title="제품 조회"
        titleTestId="products-title"
        lead="이름·형식명·옵션명으로 찾고, 필터로 좁힌 뒤 최대 4개까지 나란히 비교합니다."
      />

      <div className="plist">
        <aside id="pfil" className="pfil" aria-label="필터" data-open={filterOpen || undefined}>
          <div className="pfil__head">
            <h2 className="pfil__title">필터</h2>
            {/* 휴대폰: 필터는 접어 두고 버튼으로 펼침 (결과가 화면 아래로 밀리지 않게) */}
            <button
              type="button"
              className="pfil__toggle"
              aria-expanded={filterOpen}
              aria-controls="pfil"
              data-testid="pfil-toggle"
              onClick={() => setFilterOpen((o) => !o)}
            >
              {filterOpen ? '접기' : `펼치기${active > 0 ? ` (${active}개 적용)` : ''}`}
            </button>
            {active > 0 && (
              <button type="button" className="pfil__clear" data-testid="pfil-clear" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                모두 지우기
              </button>
            )}
          </div>
          <FacetGroup
            title="사업"
            facet="business"
            options={(['power', 'automation'] as const).map((v) => ({ value: v, label: BUSINESS_LABELS[v] }))}
            selected={filters.business}
            counts={counts('business')}
            onToggle={(v) => update({ business: toggleIn(filters.business, v as 'power' | 'automation') })}
          />
          <FacetGroup
            title="단계"
            facet="stage"
            options={STAGE_FILTER_IDS.map((v) => ({ value: v, label: STAGE_FILTER_LABELS[v] }))}
            selected={filters.stage}
            counts={counts('stage')}
            onToggle={(v) => update({ stage: toggleIn(filters.stage, v) })}
          />
          <FacetGroup
            title="전압 등급"
            facet="voltage"
            options={VOLTAGE_ORDER.map((v) => ({ value: v, label: VOLTAGE_LABELS[v] }))}
            selected={filters.voltage}
            counts={counts('voltage')}
            onToggle={(v) => update({ voltage: toggleIn(filters.voltage, v as (typeof VOLTAGE_ORDER)[number]) })}
          />
          <fieldset className="pfil__group">
            <legend className="pfil__legend">조건</legend>
            <label className="pfil__opt">
              <input type="checkbox" checked={filters.ul} onChange={() => update({ ul: !filters.ul })} data-testid="pfil-ul" />
              <span className="pfil__opt-label">북미 UL 제품만</span>
            </label>
          </fieldset>
        </aside>

        <section className="pres" aria-labelledby="products-title">
          <div className="pres__bar">
            <label className="pres__search">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="pres__search-icon">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <span className="visually-hidden">제품 검색</span>
              <input
                type="search"
                value={qDraft}
                placeholder="제품명·형식명·옵션명 (예: Susol, AH-06D, MCCB)"
                onChange={(e) => setQDraft(e.target.value)}
                data-testid="products-search"
              />
            </label>
            <label className="pres__sort">
              정렬
              <select value={filters.sort} onChange={(e) => update({ sort: e.target.value as SortKey })} data-testid="products-sort">
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <option key={k} value={k}>
                    {SORT_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="pres__csv"
              data-testid="products-csv"
              disabled={result.length === 0}
              onClick={() => downloadText(`제품조회_${result.length}개.csv`, buildProductCsv(result))}
            >
              CSV 내보내기
            </button>
          </div>
          <p className="pres__count" data-testid="products-count">
            <b>{result.length}개</b> 제품 · 전체 {rows.length}개 중
            {specsState.status === 'loading' && <span className="pres__note"> · 사양 불러오는 중…</span>}
            {specsState.status === 'error' && <span className="pres__note"> · 사양 데이터를 불러오지 못했습니다</span>}
          </p>

          {result.length === 0 ? (
            <div className="pres__empty" role="status">
              <p>조건에 맞는 제품이 없습니다.</p>
              <button type="button" className="pfil__clear" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                필터 모두 지우기
              </button>
            </div>
          ) : (
            <ul className="pgrid" data-testid="products-grid">
              {result.slice(0, limit).map((r) => (
                <ProductCard key={r.product.id} row={r} specs={specs} />
              ))}
            </ul>
          )}
          {result.length > limit && (
            <button type="button" className="pres__more" data-testid="products-more" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
              더 보기 ({result.length - limit}개 남음)
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
