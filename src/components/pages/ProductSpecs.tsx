import type { Product, ProductSpecs as Specs } from '../../lib/schema';
import { hasVariants, pageHref, specLabel, specValueText, variantDisplayName, variantSpecRows, type SpecEntry } from '../../lib/pages/compare';
import { joinCompareId } from '../../store/useCompareStore';
import { SPECS_ERROR_TEXT, useSpecs } from '../compare/useSpecs';
import CompareToggle from '../compare/CompareToggle';
import ExternalLink from '../common/ExternalLink';
import './ProductSpecs.css';

/**
 * 제품 상세 "정격 사양" 섹션 (2026-11-18 사양 옵션별 분리).
 *  - specs.json 지연 로딩(useSpecs) — 불러오는 중·실패 안내, 다 불러왔는데 이 제품 사양이 없으면 섹션 자체를 숨김
 *  - 시리즈 공통 사양 목록 + 옵션별 사양 표(행 = 사양 키 SPEC_KEYS 순서 → 비표준, 열 = 옵션, 값 없음 "—")
 *  - 값·옵션마다 카탈로그 페이지 링크(url#page=N), 옵션 열마다 "이 옵션 비교에 담기"(제품id:옵션id)
 *  - 값은 카탈로그 표기 그대로 (합치기·계산 없음)
 */
export default function ProductSpecs({ product }: { product: Product }) {
  const state = useSpecs('product');
  if (state.status === 'ready' && !state.map.has(product.id)) return null;
  return (
    <section className="pg-card ps" aria-labelledby="specs-h" data-testid="product-specs" data-state={state.status}>
      <h2 id="specs-h">정격 사양</h2>
      {state.status === 'loading' && (
        <p className="pg-muted" role="status">
          사양 불러오는 중…
        </p>
      )}
      {state.status === 'error' && <p className="pg-muted">{SPECS_ERROR_TEXT} — 새로고침하면 다시 시도합니다.</p>}
      {state.status === 'ready' && <SpecsBody product={product} specs={state.map.get(product.id)!} />}
    </section>
  );
}

function PageLink({ specs, page }: { specs: Specs; page?: number }) {
  if (!page) return null;
  return (
    <ExternalLink href={pageHref(specs.source.url, page)} className="ps-page" title={`${specs.source.title} ${page}쪽`}>
      p.{page}
    </ExternalLink>
  );
}

function Values({ entries, specs }: { entries: SpecEntry[]; specs: Specs }) {
  if (entries.length === 0)
    return (
      <span className="ps-none" title="카탈로그에 없음">
        <span aria-hidden="true">—</span>
        <span className="visually-hidden">카탈로그에 없음</span>
      </span>
    );
  return (
    <ul className="ps-values">
      {entries.map((e, i) => (
        <li key={i}>
          <span className="ps-value">{specValueText(e.item)}</span>
          <PageLink specs={specs} page={e.page} />
        </li>
      ))}
    </ul>
  );
}

function SpecsBody({ product, specs }: { product: Product; specs: Specs }) {
  const variants = hasVariants(specs) ? specs.variants : [];
  const rows = variants.length > 0 ? variantSpecRows(specs) : [];
  return (
    <>
      <div className="ps-meta">
        <ExternalLink href={pageHref(specs.source.url, specs.source.page)} className="ps-source">
          출처: {specs.source.title}
          {specs.source.page ? ` · p.${specs.source.page}` : ''} ↗
        </ExternalLink>
        {specs.reviewed ? (
          <span className="ps-badge ps-badge--ok">검수 완료</span>
        ) : (
          <span className="ps-badge ps-badge--draft" data-testid="product-specs-unreviewed">
            카탈로그 추출값 · 검수 전
          </span>
        )}
        <span className="pg-muted">추출일 {specs.extractedAt}</span>
      </div>
      {specs.note && <p className="pg-muted ps-note">{specs.note}</p>}

      {specs.items.length > 0 && (
        <div className="ps-block" data-testid="product-specs-common">
          <h3 className="ps-h3">{variants.length > 0 ? '시리즈 공통 사양' : '사양'}</h3>
          <dl className="ps-common">
            {specs.items.map((it, i) => (
              <div key={`${it.key}-${i}`} className="ps-common__row">
                <dt>{specLabel(it.key, it.label)}</dt>
                <dd>
                  <span className="ps-value">{specValueText(it)}</span>
                  <PageLink specs={specs} page={it.page} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {variants.length > 0 && (
        <div className="ps-block" data-testid="product-specs-variants">
          <h3 className="ps-h3" id="specs-variants-h">
            옵션별 사양{' '}
            <span className="ps-axis">
              · 옵션 기준: <b>{specs.variantAxis}</b> · {variants.length}개
            </span>
          </h3>
          <div className="ps-scroll" role="region" aria-labelledby="specs-variants-h" tabIndex={0}>
            <table className="ps-table">
              <caption className="visually-hidden">
                {product.name} 옵션별 사양 — 열은 {specs.variantAxis} 옵션, 행은 사양
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="ps-corner">
                    사양
                  </th>
                  {variants.map((v) => (
                    <th key={v.id} scope="col" className="ps-vhead" data-testid={`product-spec-variant-${v.id}`}>
                      <span className="ps-vhead__label">{v.label}</span>
                      {v.page && (
                        <ExternalLink href={pageHref(specs.source.url, v.page)} className="ps-page" title={`${v.label} 옵션 표 ${v.page}쪽`}>
                          옵션 표 p.{v.page}
                        </ExternalLink>
                      )}
                      {v.note && <span className="ps-vhead__note">{v.note}</span>}
                      <CompareToggle
                        kind="product"
                        id={joinCompareId(product.id, v.id)}
                        name={variantDisplayName(product.name, v.label)}
                        label="이 옵션 비교에 담기"
                        className="ps-vhead__toggle"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <th scope="row">{r.label}</th>
                    {r.cells.map((entries, i) => (
                      <td key={variants[i].id}>
                        <Values entries={entries} specs={specs} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="pg-muted ps-foot">
        공개 카탈로그에 실린 값을 표기 그대로 옮긴 것입니다. 설계·견적에는 최신 카탈로그 원문을 확인하세요.
      </p>
    </>
  );
}
