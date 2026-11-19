import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
 *  - 출처 쪽은 한 번만: 섹션 출처(p.N)와 같은 쪽이면 따로 안 붙이고, 다른 쪽일 때만 블록 제목 → 열 머리 → 칸 순으로
 *    "그 위 단계와 다를 때만" 작은 p.N 링크(url#page=N) — 사양의 page 정보는 화면에서 모두 추적 가능 (2026-11-18 표 정리)
 *  - 옵션 열 머리마다 작은 "＋ 비교" 버튼(제품id:옵션id)
 *  - 가로로 넘치면 넘친 쪽 가장자리에 그림자 + "옆으로 밀어 N개 옵션 보기" 안내
 *  - 값은 카탈로그 표기 그대로 (합치기·계산 없음)
 *  - ?opt=<옵션id> (검색에서 옵션 결과 선택, UX 토론 B6) → 그 옵션 열 강조 + 화면 안으로 스크롤
 */
export default function ProductSpecs({ product }: { product: Product }) {
  const state = useSpecs('product');
  if (state.status === 'ready' && !state.map.has(product.id)) return null;
  return (
    <section className="pg-card ps" aria-labelledby="specs-h" data-testid="product-specs" data-state={state.status}>
      <h2 id="specs-h">정격 사양</h2>
      {state.status === 'loading' && <p className="pg-muted">사양 불러오는 중…</p>}
      {state.status === 'error' && <p className="pg-muted">{SPECS_ERROR_TEXT} — 새로고침하면 다시 시도합니다.</p>}
      {state.status === 'ready' && <SpecsBody product={product} specs={state.map.get(product.id)!} />}
    </section>
  );
}

/** 쪽 링크 — base(위 단계에서 이미 보인 쪽)와 같으면 그리지 않는다 */
/** 값 옆 카탈로그 쪽 링크(p.N) — 제품 상세에서는 숨김 (2026-11-19 사용자 요청) */
const SHOW_SOURCE_LINKS = false;

function PageLink({ specs, page, base, label }: { specs: Specs; page?: number; base?: number; label?: string }) {
  if (!SHOW_SOURCE_LINKS) return null;
  if (!page || page === base) return null;
  return (
    <ExternalLink href={pageHref(specs.source.url, page)} className="ps-page" title={`${label ?? specs.source.title} ${page}쪽`}>
      p.{page}
    </ExternalLink>
  );
}

/** 가장 많이 나오는 쪽 (동률이면 먼저 나온 쪽) — 블록 대표 출처 */
function dominantPage(pages: (number | undefined)[]): number | undefined {
  const count = new Map<number, number>();
  let best: number | undefined;
  for (const p of pages) {
    if (!p) continue;
    const n = (count.get(p) ?? 0) + 1;
    count.set(p, n);
    if (best === undefined || n > count.get(best)!) best = p;
  }
  return best;
}

/** 가로 스크롤 영역의 넘침 상태 (왼쪽·오른쪽에 더 볼 내용이 있는지) */
function useScrollEdges() {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false, overflow: false });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const left = el.scrollLeft > 1;
      const right = el.scrollLeft < max - 1;
      const overflow = max > 1;
      setEdges((p) => (p.left === left && p.right === right && p.overflow === overflow ? p : { left, right, overflow }));
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : undefined;
    ro?.observe(el);
    if (el.firstElementChild) ro?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
    };
  }, []);
  return { ref, edges };
}

function Values({ entries, specs, base }: { entries: SpecEntry[]; specs: Specs; base?: number }) {
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
          <PageLink specs={specs} page={e.page} base={base} />
        </li>
      ))}
    </ul>
  );
}

/** 옵션별 사양 표 위치 (자료 바로가기 칩 "옵션별 사양"의 앵커, C5) */
export const SPECS_VARIANTS_ANCHOR = 'specs-variants';

function SpecsBody({ product, specs }: { product: Product; specs: Specs }) {
  const variants = hasVariants(specs) ? specs.variants : [];
  const rows = variants.length > 0 ? variantSpecRows(specs) : [];
  const [params] = useSearchParams();
  const optParam = params.get('opt');
  const hit = variants.find((v) => v.id === optParam)?.id;
  const hitRef = useRef<HTMLTableCellElement>(null);
  useEffect(() => {
    // 세로(본문)·가로(표) 모두 그 열이 보이게. 첫 그리기 뒤에 한 번
    const th = hitRef.current;
    if (!th) return;
    const id = requestAnimationFrame(() => th.scrollIntoView?.({ block: 'center', inline: 'center' }));
    return () => cancelAnimationFrame(id);
  }, [hit]);
  const hitCls = (vid: string) => (vid === hit ? ' ps-col--hit' : '');
  const { ref: scrollRef, edges } = useScrollEdges();
  // 출처 쪽 단계: 섹션 출처 → 블록 대표 쪽 → 열(옵션 표) 쪽 → 칸. 위 단계와 같으면 표시하지 않음
  const sourcePage = specs.source.page;
  const commonBase = dominantPage(specs.items.map((it) => it.page));
  const commonShown = commonBase ?? sourcePage;
  const tableBase = dominantPage(rows.flatMap((r) => r.cells.flatMap((c) => c.map((e) => e.page))));
  const tableShown = tableBase ?? sourcePage;
  const colPage = (vPage?: number) => vPage ?? tableShown;
  return (
    <>
      {/* 출처 줄·검수 배지·추출일·메모·쪽 링크는 제품 상세에서 표시하지 않음 (2026-11-19 사용자). 비교 화면·관리자 검수에는 그대로 */}

      {specs.items.length > 0 && (
        <div className="ps-block" data-testid="product-specs-common">
          <h3 className="ps-h3">
            {variants.length > 0 ? '시리즈 공통 사양' : '사양'}
            {commonBase && commonBase !== sourcePage && (
              <PageLink specs={specs} page={commonBase} base={sourcePage} label="공통 사양 출처" />
            )}
          </h3>
          <dl className="ps-common">
            {specs.items.map((it, i) => (
              <div key={`${it.key}-${i}`} className="ps-common__row">
                <dt>{specLabel(it.key, it.label)}</dt>
                <dd>
                  <span className="ps-value">{specValueText(it)}</span>
                  <PageLink specs={specs} page={it.page} base={commonShown} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {variants.length > 0 && (
        <div className="ps-block" data-testid="product-specs-variants" id={SPECS_VARIANTS_ANCHOR} tabIndex={-1}>
          <h3 className="ps-h3" id="specs-variants-h">
            옵션별 사양{' '}
            <span className="ps-axis">
              · 옵션 기준: <b>{specs.variantAxis}</b> · {variants.length}개
            </span>
            {tableBase && tableBase !== sourcePage && (
              <PageLink specs={specs} page={tableBase} base={sourcePage} label="옵션 표 출처" />
            )}
          </h3>
          {edges.overflow && (
            <p className="ps-hint" data-testid="product-specs-scroll-hint">
              옆으로 밀어 {variants.length}개 옵션 모두 보기 <span aria-hidden="true">→</span>
            </p>
          )}
          <div
            className="ps-scrollwrap"
            data-edge-left={edges.left ? 'true' : undefined}
            data-edge-right={edges.right ? 'true' : undefined}
          >
            <div ref={scrollRef} className="ps-scroll" role="region" aria-labelledby="specs-variants-h" tabIndex={0}>
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
                      <th
                        key={v.id}
                        ref={v.id === hit ? hitRef : undefined}
                        scope="col"
                        className={`ps-vhead${hitCls(v.id)}`}
                        data-testid={`product-spec-variant-${v.id}`}
                        data-hit={v.id === hit ? 'true' : undefined}
                      >
                        <span className="ps-vhead__label">{v.label}</span>
                        {v.id === hit && <span className="ps-vhead__hit">검색한 옵션</span>}
                        <PageLink specs={specs} page={v.page} base={tableShown} label={`${v.label} 옵션 표`} />
                        <CompareToggle
                          kind="product"
                          id={joinCompareId(product.id, v.id)}
                          name={variantDisplayName(product.name, v.label)}
                          label="비교"
                          ariaLabel={`비교: ${v.label} 옵션 담기`}
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
                        <td key={variants[i].id} className={hitCls(variants[i].id).trim() || undefined}>
                          <Values entries={entries} specs={specs} base={colPage(variants[i].page)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      <p className="pg-muted ps-foot">
        공개 카탈로그에 실린 값을 표기 그대로 옮긴 것입니다. 설계·견적에는 최신 카탈로그 원문을 확인하세요.
      </p>
    </>
  );
}
