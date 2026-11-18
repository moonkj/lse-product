import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { DOC_TYPE_LABELS, type EquipmentType, type Product, type ProductSpecs, type SpecVariant } from '../lib/schema';
import { getData, useData, type SpecsMap } from '../data/load';
import { SPECS_ERROR_TEXT, useSpecs, type SpecsState } from '../components/compare/useSpecs';
import CoverageBadge from '../components/common/CoverageBadge';
import ExternalLink from '../components/common/ExternalLink';
import { OverviewPoints } from '../components/common/EquipmentOverview';
import EquipmentVisual from '../components/pages/EquipmentVisual';
import ProductVisual, { hasProductPhoto } from '../components/pages/ProductVisual';
import { CATEGORY_LABELS, COVERAGE_LABELS, confidenceLabel, gapConfidence, pageTitle } from '../lib/labels';
import { layerTitle } from '../lib/diagram/model';
import { overviewParts, overviewText } from '../lib/overview';
import { equipmentForProduct, productsForEquipment } from '../lib/pages/catalog';
import {
  MAIN_DOC_TYPES,
  countDocs,
  equipmentDocCounts,
  equipmentSpecMap,
  linkedEquipment,
  orderSpecKeys,
  pageHref,
  parseCompareParams,
  publicNote,
  withDiffParam,
  DIFF_PARAM,
  productDocs,
  representativeDoc,
  specLabel,
  specProductCount,
  specValueText,
  compareKey,
  columnSpecEntries,
  hasVariants,
  joinCompareId,
  resolveProductColumn,
  specEntriesKey,
  splitCompareId,
  variantDisplayName,
  type DocCounts,
  type LinkedItem,
  type SpecEntry,
} from '../lib/pages/compare';
import { COMPARE_MAX, compareHref, compareIdInData, useCompareStore, type CompareKind } from '../store/useCompareStore';
import { announce } from '../lib/announce';
import './pages.css';
import './ComparePage.css';

interface Cell {
  /** "차이만 보기" 비교용 문자열 */
  text: string;
  node: ReactNode;
}
interface Row {
  key: string;
  label: ReactNode;
  cells: Cell[];
  /** true 면 차이만 보기에서도 항상 표시 (출처 행) */
  keep?: boolean;
}
interface Section {
  key: string;
  title: ReactNode;
  rows: Row[];
}
interface Column {
  /** 열 id — 제품 비교는 "제품id" 또는 "제품id:옵션id" */
  id: string;
  name: string;
  sub?: string;
  eq?: EquipmentType;
  href: string;
  /** 제품 열: 옵션 선택용 (사양에 옵션이 있을 때만 select 표시) */
  product?: Product;
  specs?: ProductSpecs;
  variant?: SpecVariant;
}

/** 제품 비교 열 (옵션 해석 후) */
interface ProductCol {
  colId: string;
  product: Product;
  specs?: ProductSpecs;
  /** 선택된 옵션 — 없으면 시리즈 전체 */
  variant?: SpecVariant;
}

/** 긴 값 목록 접기 (기기 대표 사양·시리즈 전체 옵션 목록) — 처음 FOLD_LIMIT 개 + "더 보기" */
const FOLD_LIMIT = 6;
function FoldList({ items }: { items: { key: string; node: ReactNode }[] }) {
  const [open, setOpen] = useState(false);
  const shown = open || items.length <= FOLD_LIMIT ? items : items.slice(0, FOLD_LIMIT);
  return (
    <>
      <ul className="cmp-list cmp-specs">
        {shown.map((it) => (
          <li key={it.key}>{it.node}</li>
        ))}
      </ul>
      {items.length > FOLD_LIMIT && (
        <button type="button" className="cmp-more" aria-expanded={open} data-testid="compare-spec-more" onClick={() => setOpen((v) => !v)}>
          {open ? '접기' : `더 보기 (${items.length - FOLD_LIMIT}개)`}
        </button>
      )}
    </>
  );
}

/** 설명 — 요약(4줄 clamp)을 기본으로, "더 보기" 를 누르면 항목(points)을 펼친다. 항목이 없으면 넘칠 때만 토글 */
function OverviewClamp({ eq }: { eq: EquipmentType }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const listId = useId();
  const { summary, points } = overviewParts(eq);
  const [open, setOpen] = useState(false);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const check = () => setOverflow(el.scrollHeight > el.clientHeight + 1);
    check();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [summary, open]);
  return (
    <>
      <p ref={ref} className={`cmp-text${open ? '' : ' cmp-text--clamp'}`} data-testid="compare-desc-text">
        {summary}
      </p>
      {open && <OverviewPoints points={points} id={listId} />}
      {(points.length > 0 || overflow || open) && (
        <button
          type="button"
          className="cmp-more"
          aria-expanded={open}
          aria-controls={open && points.length > 0 ? listId : undefined}
          data-testid="compare-desc-more"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '접기' : '더 보기'}
        </button>
      )}
    </>
  );
}

const KIND_LABEL: Record<CompareKind, string> = { equipment: '기기', product: '제품' };

/** 사양을 아직 못 그리는 상태(불러오는 중·실패)의 구역 행 */
function specsPendingRow(state: SpecsState, label: string, n: number): Row | undefined {
  if (state.status === 'ready') return undefined;
  const loading = state.status === 'loading';
  return {
    key: loading ? 'spec-loading' : 'spec-error',
    label,
    keep: true,
    cells: Array.from({ length: n }, () => ({
      text: '',
      node: loading ? (
        <span className="cmp-muted">사양 불러오는 중…</span>
      ) : (
        <span className="cmp-muted">{SPECS_ERROR_TEXT}</span>
      ),
    })),
  };
}

/** 값 없음 칸 */
const NONE_TEXT = '—';
function None({ why = '카탈로그에 없음' }: { why?: string }) {
  return (
    <span className="cmp-none" title={why}>
      <span aria-hidden="true">{NONE_TEXT}</span>
      <span className="visually-hidden">{why}</span>
    </span>
  );
}

function docCountText(c: DocCounts): string {
  return MAIN_DOC_TYPES.map((t) => `${DOC_TYPE_LABELS[t]} ${c[t]}`).join(' · ');
}

function DocCountList({ c }: { c: DocCounts }) {
  return (
    <ul className="cmp-list cmp-list--inline">
      {MAIN_DOC_TYPES.map((t) => (
        <li key={t} className={c[t] === 0 ? 'cmp-muted' : undefined}>
          {DOC_TYPE_LABELS[t]} {c[t]}
        </li>
      ))}
    </ul>
  );
}

function LinkedList({ items }: { items: LinkedItem[] }) {
  if (items.length === 0) return <None why="연결된 기기 없음" />;
  return (
    <ul className="cmp-list cmp-list--inline">
      {items.map((l) => (
        <li key={l.eq?.id ?? `ep-${l.label}`}>
          {l.eq ? (
            <Link to={`/equipment/${l.eq.id}`} title={l.eq.name}>
              {l.label}
            </Link>
          ) : (
            <span className="cmp-muted">{l.label}</span>
          )}
          {l.kind !== 'power' && <span className="cmp-muted"> ({l.kind === 'signal' ? '신호' : '택1'})</span>}
        </li>
      ))}
    </ul>
  );
}

const linkedText = (items: LinkedItem[]) => items.map((l) => `${l.eq?.id ?? l.label}:${l.kind}`).join(',');

function UnreviewedBadge() {
  return (
    <span className="cmp-badge cmp-badge--draft" data-testid="compare-unreviewed">
      카탈로그 추출값 · 검수 전
    </span>
  );
}

// ───────────── 기기 비교 ─────────────

function equipmentSections(list: EquipmentType[], specsState: SpecsState): { sections: Section[]; anyUnreviewed: boolean } {
  const specsByProductId: SpecsMap = specsState.status === 'ready' ? specsState.map : new Map();
  const base: Row[] = [
    {
      key: 'layer',
      label: '계층·전압',
      cells: list.map((eq) => {
        const t = `${layerTitle(eq.layer)}${eq.voltage ? ` · ${eq.voltage}` : ''}`;
        return { text: t, node: t };
      }),
    },
    {
      key: 'category',
      label: '기능 분류',
      cells: list.map((eq) => ({ text: eq.category, node: CATEGORY_LABELS[eq.category] })),
    },
    {
      key: 'coverage',
      label: '커버리지·공백 판정',
      cells: list.map((eq) => {
        const conf = gapConfidence(eq);
        return {
          text: `${eq.coverage}|${conf ?? ''}`,
          node: (
            <div className="cmp-stack">
              <CoverageBadge coverage={eq.coverage} variant="chip" label={COVERAGE_LABELS[eq.coverage]} />
              {conf && (
                <span className={`cmp-badge cmp-badge--${conf}`} data-confidence={conf}>
                  {confidenceLabel(eq.coverage, conf)}
                </span>
              )}
            </div>
          ),
        };
      }),
    },
    {
      key: 'products',
      label: '자사 제품 수',
      cells: list.map((eq) => {
        const n = productsForEquipment(eq.id).length;
        return {
          text: String(n),
          node: n > 0 ? <Link to={`/equipment/${eq.id}`}>{n}개 — 목록 보기</Link> : <span className="cmp-muted">0개</span>,
        };
      }),
    },
    {
      key: 'docs',
      label: '자료 수',
      cells: list.map((eq) => {
        const c = equipmentDocCounts(eq.id);
        return { text: docCountText(c), node: <DocCountList c={c} /> };
      }),
    },
    {
      key: 'description',
      label: '설명',
      // 상세 설명(overview) — 요약 기본 + 더 보기로 항목 펼침. 차이 비교 키는 요약 + 항목 전체
      cells: list.map((eq) => ({ text: overviewText(eq), node: <OverviewClamp eq={eq} /> })),
    },
    {
      key: 'upstream',
      label: '상류 연결 기기',
      cells: list.map((eq) => {
        const items = linkedEquipment(eq.id, 'in');
        return { text: linkedText(items), node: <LinkedList items={items} /> };
      }),
    },
    {
      key: 'downstream',
      label: '하류 연결 기기',
      cells: list.map((eq) => {
        const items = linkedEquipment(eq.id, 'out');
        return { text: linkedText(items), node: <LinkedList items={items} /> };
      }),
    },
  ];

  const maps = list.map((eq) => equipmentSpecMap(eq.id, specsByProductId));
  const keys = orderSpecKeys(maps.flatMap((m) => [...m.keys()]));
  let anyUnreviewed = false;
  const specRows: Row[] = [];
  const pending = specsPendingRow(specsState, '대표 사양', list.length);
  if (pending) {
    specRows.push(pending);
  } else if (keys.length === 0) {
    specRows.push({
      key: 'spec-none',
      label: '대표 사양',
      cells: list.map(() => ({ text: '', node: <span className="cmp-muted">카탈로그 사양 미수집</span> })),
    });
  } else {
    specRows.push({
      key: 'spec-coverage',
      label: '사양 수집 제품',
      cells: list.map((eq) => {
        const t = `${specProductCount(eq.id, specsByProductId)} / ${productsForEquipment(eq.id).length}개`;
        return { text: t, node: t };
      }),
    });
    for (const key of keys) {
      const firstLabel = maps.flatMap((m) => m.get(key) ?? [])[0]?.item.label;
      specRows.push({
        key: `spec-${key}`,
        label: specLabel(key, firstLabel),
        cells: maps.map((m) => {
          const entries = m.get(key) ?? [];
          if (entries.length === 0) return { text: '', node: <None /> };
          return {
            text: entries
              .map((e) => `${e.product.id}${e.variant ? `:${e.variant.id}` : ''}:${compareKey(specValueText(e.item))}`)
              .join('|'),
            // 옵션이 있는 제품은 "제품명 · 옵션 label: 값" — 길면 접기 (처음 6개 + 더 보기)
            node: (
              <FoldList
                items={entries.map(({ product, item, variant }, i) => {
                  const src = specsByProductId.get(product.id);
                  if (src && !src.reviewed) anyUnreviewed = true;
                  const page = item.page ?? variant?.page ?? src?.source.page;
                  return {
                    key: `${product.id}-${variant?.id ?? ''}-${i}`,
                    node: (
                      <>
                        <Link to={`/product/${product.id}`} className="cmp-specs__name">
                          {variantDisplayName(product.name, variant?.label)}
                        </Link>
                        : <span className="cmp-specs__value">{specValueText(item)}</span>
                        {src && (
                          <ExternalLink href={pageHref(src.source.url, page)} className="cmp-page" title={src.source.title}>
                            {page ? `p.${page}` : '출처'}
                          </ExternalLink>
                        )}
                      </>
                    ),
                  };
                })}
              />
            ),
          };
        }),
      });
    }
  }

  return {
    anyUnreviewed,
    sections: [
      { key: 'basic', title: '기본 정보', rows: base },
      {
        key: 'specs',
        title: '대표 사양 범위 — 소속 제품 카탈로그 표기 그대로',
        rows: specRows,
      },
    ],
  };
}

// ───────────── 제품 비교 ─────────────

/**
 * 제품들의 공통 소속 기기 id (디버그 M8). 한 제품이 여러 기기에 속할 수 있으므로 첫 기기만 비교하면
 * 같은 기기 제품인데도 "서로 다른 기기" 로 오판한다 → 모든 제품의 소속 기기 집합의 교집합.
 */
function commonEquipmentIds(eqs: EquipmentType[][]): Set<string> {
  if (eqs.length === 0) return new Set();
  let common = new Set(eqs[0].map((e) => e.id));
  for (const e of eqs.slice(1)) common = new Set(e.map((x) => x.id).filter((id) => common.has(id)));
  return common;
}

/** 제품의 대표 소속 기기: 비교 대상들과 공통인 기기가 있으면 그것, 없으면 첫 기기 */
function mainEquipment(e: EquipmentType[], common: Set<string>): EquipmentType | undefined {
  return e.find((x) => common.has(x.id)) ?? e[0];
}

/** 열 하나의 사양 값 목록 (시리즈 전체면 옵션 값마다 "옵션 label: 값") */
function SpecEntryList({ entries, specs, series }: { entries: SpecEntry[]; specs: ProductSpecs; series: boolean }) {
  return (
    <FoldList
      items={entries.map((e, i) => ({
        key: `${e.variant?.id ?? ''}-${i}`,
        node: (
          <>
            {series && e.variant && <span className="cmp-specs__name">{e.variant.label}: </span>}
            <span className="cmp-specs__value">{specValueText(e.item)}</span>
            {e.page && (
              <ExternalLink href={pageHref(specs.source.url, e.page)} className="cmp-page" title={specs.source.title}>
                p.{e.page}
              </ExternalLink>
            )}
          </>
        ),
      }))}
    />
  );
}

function productSections(cols: ProductCol[], specsState: SpecsState): { sections: Section[]; anyUnreviewed: boolean; mixed: boolean } {
  const { docsByProductId } = getData();
  const list = cols.map((c) => c.product);
  const eqs = list.map((p) => equipmentForProduct(p.id));
  const common = commonEquipmentIds(eqs);
  // 연결 기기가 하나라도 있는 제품끼리 공통 기기가 없을 때만 안내
  const mixed = common.size === 0 && new Set(eqs.map((e) => e[0]?.id ?? '')).size > 1;

  const base: Row[] = [
    {
      key: 'equipment',
      label: '소속 기기',
      cells: eqs.map((e) => {
        const main = mainEquipment(e, common);
        if (!main) return { text: '', node: <None why="연결된 기기 없음" /> };
        return {
          text: main.id,
          node: (
            <span>
              <Link to={`/equipment/${main.id}`}>{main.abbr ? `${main.name} (${main.abbr})` : main.name}</Link>
              {e.length > 1 && <span className="cmp-muted"> 외 기기 {e.length - 1}종</span>}
            </span>
          ),
        };
      }),
    },
    {
      key: 'category-path',
      label: '카테고리 경로',
      cells: list.map((p) => {
        const t = p.categoryPath.join(' › ');
        return { text: t, node: t };
      }),
    },
    {
      key: 'business',
      label: '사업',
      cells: list.map((p) => ({ text: p.business, node: p.business === 'power' ? '전력' : '자동화' })),
    },
    {
      key: 'status',
      label: '판매 상태',
      cells: list.map((p) => ({
        text: String(p.discontinued),
        node: p.discontinued ? (
          <span className="cmp-badge cmp-badge--off">단종</span>
        ) : (
          <span className="cmp-badge cmp-badge--ok">판매 중</span>
        ),
      })),
    },
    {
      key: 'docs',
      label: '자료',
      cells: list.map((p) => {
        const docs = productDocs(p.id);
        const c = countDocs(docs);
        const rep = representativeDoc(docs);
        const entry = docsByProductId.get(p.id);
        return {
          text: docCountText(c),
          node: (
            <div className="cmp-stack">
              <DocCountList c={c} />
              {rep ? (
                <ExternalLink href={rep.url} className="cmp-doclink">
                  {DOC_TYPE_LABELS[rep.type]}: {rep.title} ↗
                </ExternalLink>
              ) : entry ? (
                <ExternalLink href={entry.deepLink} className="cmp-doclink">
                  자료실에서 보기 ↗
                </ExternalLink>
              ) : (
                <span className="cmp-muted">수집된 자료 없음</span>
              )}
            </div>
          ),
        };
      }),
    },
  ];

  const specs = cols.map((c) => c.specs);
  // 열마다 사양 = 공통 + 선택 옵션(같은 key 는 옵션 우선), 시리즈 전체면 옵션 값을 모두 나열 (columnSpecEntries)
  const entryMaps = cols.map((c) => (c.specs ? columnSpecEntries(c.specs, c.variant?.id) : undefined));
  const keys = orderSpecKeys(entryMaps.flatMap((m) => (m ? [...m.keys()] : [])));
  const specRows: Row[] = [];
  const pending = specsPendingRow(specsState, '정격 사양', list.length);
  if (pending) {
    return {
      anyUnreviewed: false,
      mixed,
      sections: [
        { key: 'basic', title: '기본 정보', rows: base },
        { key: 'specs', title: '정격 사양 — 카탈로그 표기 그대로', rows: [pending] },
      ],
    };
  }
  if (keys.length === 0) {
    specRows.push({
      key: 'spec-none',
      label: '정격 사양',
      cells: list.map(() => ({ text: '', node: <span className="cmp-muted">카탈로그 사양 미수집</span> })),
    });
  }
  for (const key of keys) {
    const firstLabel = entryMaps.flatMap((m) => m?.get(key) ?? [])[0]?.item.label;
    specRows.push({
      key: `spec-${key}`,
      label: specLabel(key, firstLabel),
      cells: cols.map((c, i) => {
        const s = c.specs;
        const entries = entryMaps[i]?.get(key) ?? [];
        // 사양 미수집(제품 자체에 사양 없음)과 카탈로그에 없음(키 없음)은 차이만 보기에서 다른 값 (L9)
        if (!s) return { text: '∅no-spec', node: <None why="사양 미수집" /> };
        if (entries.length === 0) return { text: '', node: <None /> };
        return { text: specEntriesKey(entries, !c.variant), node: <SpecEntryList entries={entries} specs={s} series={!c.variant} /> };
      }),
    });
  }
  const anyUnreviewed = specs.some((s) => s && !s.reviewed);
  specRows.push({
    key: 'spec-source',
    label: '사양 출처',
    keep: true,
    cells: cols.map((c, i) => {
      const s = specs[i];
      const v = c.variant;
      return {
        text: s ? `${s.source.url}#${s.source.page ?? ''}` : '',
        node: (
          <div className="cmp-stack" data-testid={`compare-spec-source-${c.colId}`}>
            {s ? (
              <>
                <ExternalLink href={pageHref(s.source.url, s.source.page)} className="cmp-doclink">
                  {s.source.title}
                  {s.source.page ? ` · p.${s.source.page}` : ''} ↗
                </ExternalLink>
                {v?.page && (
                  <ExternalLink href={pageHref(s.source.url, v.page)} className="cmp-doclink">
                    {v.label} 옵션 표 · p.{v.page} ↗
                  </ExternalLink>
                )}
                {publicNote(v?.note) && <span className="cmp-muted">{publicNote(v?.note)}</span>}
                {s.reviewed ? (
                  <span className="cmp-badge cmp-badge--ok">검수 완료</span>
                ) : (
                  <UnreviewedBadge />
                )}
                <span className="cmp-muted">추출일 {s.extractedAt}</span>
                {publicNote(s.note) && <span className="cmp-muted">{publicNote(s.note)}</span>}
              </>
            ) : (
              <span className="cmp-muted">사양 미수집</span>
            )}
          </div>
        ),
      };
    }),
  });

  return {
    anyUnreviewed,
    mixed,
    sections: [
      { key: 'basic', title: '기본 정보', rows: base },
      { key: 'specs', title: '정격 사양 — 카탈로그 표기 그대로', rows: specRows },
    ],
  };
}

// ───────────── 화면 ─────────────

/**
 * 제품 열 머리의 옵션 선택. "시리즈 전체(모든 옵션)" 기본 + 각 옵션.
 * 다른 열이 이미 같은 "제품:옵션" 을 보고 있으면 그 항목은 고를 수 없게(중복 열 방지).
 */
function VariantSelect({
  col,
  specs,
  usedIds,
  onChange,
}: {
  col: Column;
  specs: ProductSpecs & { variants: SpecVariant[] };
  usedIds: string[];
  onChange: (colId: string, variantId: string) => void;
}) {
  const pid = col.product!.id;
  const selectId = `cmp-variant-${col.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const taken = (vid?: string) => {
    const id = joinCompareId(pid, vid);
    return id !== col.id && usedIds.includes(id);
  };
  return (
    <div className="cmp-variant">
      <label htmlFor={selectId} className="cmp-variant__label">
        {specs.variantAxis}
      </label>
      <select
        id={selectId}
        className="cmp-variant__select"
        data-testid={`compare-variant-select-${col.id}`}
        value={col.variant?.id ?? ''}
        onChange={(e) => onChange(col.id, e.target.value)}
      >
        <option value="" disabled={taken(undefined)}>
          시리즈 전체(모든 옵션){taken(undefined) ? ' — 다른 열에서 비교 중' : ''}
        </option>
        {specs.variants.map((v) => (
          <option key={v.id} value={v.id} disabled={taken(v.id)}>
            {v.label}
            {taken(v.id) ? ' — 다른 열에서 비교 중' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

function EmptyState({ type }: { type: CompareKind | null }) {
  const stored = useCompareStore((s) => s);
  const data = useData();
  const ready = (['equipment', 'product'] as const).filter((k) =>
    stored[k].filter((id) => compareIdInData(k, id, data)).length >= 2,
  );
  return (
    <section className="pg-card cmp-empty" data-testid="compare-empty">
      <h2>비교하려면 2개 이상 담으세요</h2>
      <p className="pg-muted">
        계통도 상세 패널이나 기기·제품 페이지의 <b>비교에 담기</b> 버튼으로 {type ? KIND_LABEL[type] : '기기 또는 제품'}을 최대 4개까지
        담을 수 있습니다. 기기는 기기끼리, 제품은 제품끼리 비교합니다.
      </p>
      <div className="pg-actions">
        <Link className="pg-btn pg-btn--primary" to="/">
          계통도로 가기
        </Link>
        {ready.map((k) => (
          <Link key={k} className="pg-btn" to={compareHref(k, stored[k])}>
            담아 둔 {KIND_LABEL[k]} 비교하기
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function ComparePage() {
  const data = useData();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const specsState = useSpecs();
  const removeStored = useCompareStore((s) => s.remove);
  const storedEquipment = useCompareStore((s) => s.equipment);
  const storedProduct = useCompareStore((s) => s.product);
  const parsed = parseCompareParams(params);
  const { type, ids, missing, overflow } = parsed;
  // "차이만 보기"는 주소(diff=1)에 저장 (UX 토론 C6) — 공유 링크로 들어오면 그 값을 따르고,
  // 다른 비교로 옮기면(비교 바·다른 링크 = diff 없는 주소) 꺼진다. 같은 비교 안의 열 빼기·옵션 바꾸기는 유지 (L7)
  const diffOnly = params.get(DIFF_PARAM) === '1';
  const setDiffOnly = (on: boolean) => navigate({ search: withDiffParam(location.search, on) }, { replace: true });

  useEffect(() => {
    document.title = pageTitle(type ? `${KIND_LABEL[type]} 비교` : '비교');
  }, [type]);

  // ───── 제품 열 옵션 해석 (사양을 불러온 뒤 URL 의 옵션 id 검증 — 틀리면 시리즈 전체로 되돌리고 안내) ─────
  const specsMap = specsState.status === 'ready' ? specsState.map : undefined;
  const productCols: (ProductCol & { rawId: string })[] = [];
  const invalidVariants: string[] = [];
  let dupAfterFallback = 0;
  if (type === 'product') {
    const seen = new Set<string>();
    for (const rawId of ids) {
      const r = resolveProductColumn(rawId, specsMap?.get(splitCompareId(rawId).baseId), !!specsMap);
      const product = data.productById.get(r.productId)!;
      if (r.invalidVariantId) invalidVariants.push(`${product.name}의 "${r.invalidVariantId}"`);
      // 되돌린 결과가 다른 열과 같아지면(예: P1:없는옵션 + P1) 한 번만
      if (seen.has(r.colId)) {
        dupAfterFallback += 1;
        continue;
      }
      seen.add(r.colId);
      productCols.push({ rawId, colId: r.colId, product, specs: specsMap?.get(r.productId), variant: r.variant });
    }
  }
  /** 화면에 실제로 보이는 열 id (옵션 되돌림 반영) — 열 빼기·옵션 바꾸기는 이 목록 기준으로 주소를 다시 만든다 */
  const effectiveIds = type === 'product' ? productCols.map((c) => c.colId) : ids;

  const go = (nextIds: string[]) => {
    if (!type) return;
    // 같은 비교를 이어 가는 것 — 차이만 보기 상태 유지. 주소는 compareHref 형식(쉼표·옵션 구분자 그대로)으로 (L4)
    navigate(compareHref(type, nextIds) + (diffOnly ? `&${DIFF_PARAM}=1` : ''), { replace: true });
  };

  /** 열 옵션 바꾸기 — variantId '' = 시리즈 전체 */
  const changeVariant = (colId: string, variantId: string) => {
    const { baseId } = splitCompareId(colId);
    go(effectiveIds.map((x) => (x === colId ? joinCompareId(baseId, variantId || undefined) : x)));
  };

  const removeColumn = (id: string) => {
    if (!type) return;
    const rawId = productCols.find((c) => c.colId === id)?.rawId ?? id;
    const nextIds = effectiveIds.filter((x) => x !== id);
    go(nextIds);
    const name = columns.find((c) => c.id === id)?.name ?? id;
    announce(`비교에서 ${name} 뺌 (${nextIds.length}/${COMPARE_MAX})`);
    // 내 담기 목록과 같은 비교일 때만 목록에서도 뺀다 — 공유받은 링크에서 열을 빼도 내 목록은 그대로 (L3)
    const stored = type === 'equipment' ? storedEquipment : storedProduct;
    const same = stored.length === ids.length && ids.every((x) => stored.includes(x));
    if (same) removeStored(type, rawId);
  };

  const notices: string[] = [];
  if (parsed.badType) notices.push(`비교 종류(type=${parsed.badType})를 알 수 없습니다 — equipment 또는 product 만 됩니다.`);
  if (missing.length > 0) notices.push(`등록되지 않은 항목 ${missing.length}개(${missing.join(', ')})는 제외했습니다.`);
  if (overflow.length > 0) notices.push(`한 번에 최대 4개까지 비교합니다 — ${overflow.length}개는 제외했습니다.`);
  if (invalidVariants.length > 0)
    notices.push(`사양에 없는 옵션 ${invalidVariants.join(', ')}은(는) "시리즈 전체(모든 옵션)"로 표시합니다.`);
  if (dupAfterFallback > 0) notices.push(`옵션을 되돌려 같아진 열 ${dupAfterFallback}개는 한 번만 표시합니다.`);

  let columns: Column[] = [];
  let sections: Section[] = [];
  let anyUnreviewed = false;
  if (type === 'equipment' && ids.length >= 2) {
    const list = ids.map((id) => data.equipmentTypeById.get(id)!);
    columns = list.map((eq) => ({ id: eq.id, name: eq.name, sub: eq.abbr, eq, href: `/equipment/${eq.id}` }));
    ({ sections, anyUnreviewed } = equipmentSections(list, specsState));
  } else if (type === 'product' && productCols.length >= 2) {
    const common = commonEquipmentIds(productCols.map((c) => equipmentForProduct(c.product.id)));
    columns = productCols.map((c) => {
      const p = c.product;
      const eq = mainEquipment(equipmentForProduct(p.id), common);
      // 사양을 불러오기 전에는 옵션 label 을 모르므로 옵션 id 로 표시
      const label = c.variant?.label ?? splitCompareId(c.colId).variantId;
      return {
        id: c.colId,
        name: variantDisplayName(p.name, label),
        sub: eq ? (eq.abbr ?? eq.name) : undefined,
        eq,
        href: `/product/${p.id}`,
        product: p,
        specs: c.specs,
        variant: c.variant,
      };
    });
    const r = productSections(productCols, specsState);
    sections = r.sections;
    anyUnreviewed = r.anyUnreviewed;
    if (r.mixed) notices.push('서로 다른 기기의 제품을 함께 비교하고 있습니다 — "소속 기기" 행으로 구분하세요.');
  }
  if (specsState.status === 'error' && columns.length >= 2) notices.push(`${SPECS_ERROR_TEXT} — 사양 외 정보만 비교합니다. 새로고침하면 다시 시도합니다.`);

  const sameAll = (r: Row) => r.cells.every((c) => c.text === r.cells[0].text);
  const shownSections = sections
    .map((s) => ({ ...s, rows: diffOnly ? s.rows.filter((r) => r.keep || !sameAll(r)) : s.rows }))
    .filter((s) => s.rows.length > 0);
  // 차이만 보기를 켜면 숨겨질 행 수 (켜기 전에도 계산 — 누르는 순간 안내하려고)
  const sameCount = sections.reduce((n, s) => n + s.rows.filter((r) => !r.keep && sameAll(r)).length, 0);
  const hiddenCount = diffOnly ? sameCount : 0;
  const diffText = (n: number) => (n > 0 ? `값이 모두 같은 ${n}개 행을 숨겼습니다.` : '모든 행의 값이 서로 다릅니다.');
  const toggleDiff = () => {
    setDiffOnly(!diffOnly);
    announce(diffOnly ? '모든 행을 표시합니다' : `차이만 보기 — ${diffText(sameCount)}`);
  };
  const noticeText = notices.join(' ');
  const title = type ? `${KIND_LABEL[type]} 비교` : '비교';

  return (
    <>
    <NoticeAnnouncer text={noticeText} />
    <div className="pg pg--wide cmp" data-testid="compare-page">
      <nav aria-label="경로">
        <ol className="pg-crumbs">
          <li>
            <Link to="/">계통도</Link>
          </li>
          <li aria-current="page">{title}</li>
        </ol>
      </nav>

      <header className="cmp-head">
        <div>
          <h1 className="cmp-title">{title}</h1>
          {columns.length >= 2 && type && (
            <p className="pg-muted">
              {KIND_LABEL[type]} {columns.length}
              {type === 'equipment' ? '종' : '개'} · 링크를 복사해 보내면 같은 비교 화면이 열립니다.
            </p>
          )}
        </div>
        {columns.length >= 2 && (
          <div className="cmp-tools">
            {anyUnreviewed && <UnreviewedBadge />}
            <CopyLinkButton url={shareUrl(location.pathname, location.search)} />
            <button
              type="button"
              className="cmp-diff"
              aria-pressed={diffOnly}
              data-testid="compare-diff-only"
              onClick={toggleDiff}
            >
              <span aria-hidden="true" className="cmp-diff__box">
                {diffOnly ? '✓' : ''}
              </span>
              차이만 보기
            </button>
          </div>
        )}
      </header>

      {notices.length > 0 && (
        // 스크린리더 안내는 앱 공용 live region(announce)으로 — 화면 목록은 그대로 (B10)
        <div data-testid="compare-notice">
          <ul className="cmp-notices">
            {notices.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {columns.length < 2 ? (
        <EmptyState type={type} />
      ) : (
        <>
          {diffOnly && (
            <p className="pg-muted" data-testid="compare-diff-summary">
              {diffText(hiddenCount)}
            </p>
          )}
          <div className="cmp-scroll" role="region" aria-labelledby="cmp-caption" tabIndex={0}>
            <table className="cmp-table" data-testid="compare-table" style={{ ['--cmp-cols' as string]: columns.length }}>
              <caption id="cmp-caption" className="visually-hidden">
                {title} 표 — 열은 비교 항목, 행은 속성
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="cmp-corner">
                    속성
                  </th>
                  {columns.map((c) => (
                    <th key={c.id} scope="col" className="cmp-colhead" data-testid={`compare-col-${c.id}`}>
                      <div className="cmp-colhead__inner">
                        <div className="cmp-colhead__media">
                          {c.product && (c.eq || hasProductPhoto(c.product.id)) ? (
                            <ProductVisual product={c.product} eq={c.eq} thumb />
                          ) : c.eq ? (
                            <EquipmentVisual eq={c.eq} thumb />
                          ) : (
                            <span className="cmp-muted">사진 없음</span>
                          )}
                        </div>
                        <span className="cmp-colhead__name">{c.name}</span>
                        {c.sub && <span className="cmp-colhead__sub">{c.sub}</span>}
                        {c.product && hasVariants(c.specs) && (
                          <VariantSelect col={c} specs={c.specs} usedIds={effectiveIds} onChange={changeVariant} />
                        )}
                        <div className="cmp-colhead__actions">
                          <Link to={c.href} className="cmp-colhead__link">
                            상세 보기<span className="visually-hidden"> — {c.name}</span> →
                          </Link>
                          <button
                            type="button"
                            className="cmp-colhead__remove"
                            aria-label={`${c.name} 비교에서 빼기`}
                            data-testid={`compare-remove-${c.id}`}
                            onClick={() => removeColumn(c.id)}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              {shownSections.map((s) => (
                <tbody key={s.key} data-testid={`compare-section-${s.key}`}>
                  <tr className="cmp-section">
                    <th scope="colgroup" colSpan={columns.length + 1}>
                      <span className="cmp-section__title">{s.title}</span>
                    </th>
                  </tr>
                  {s.rows.map((r) => (
                    <tr key={r.key} data-testid={`compare-row-${r.key}`} className={!sameAll(r) ? 'is-diff' : undefined}>
                      <th scope="row">{r.label}</th>
                      {r.cells.map((cell, i) => (
                        <td key={columns[i].id}>
                          <Fragment>{cell.node}</Fragment>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
          <p className="pg-muted">
            사양은 공개 카탈로그에 실린 값을 표기 그대로 옮긴 것입니다. 설계·견적에는 최신 카탈로그 원문을 확인하세요.
            {type === 'equipment' && ' 대표 사양 범위는 그 기기에 속한 제품들의 값을 제품별로 나열한 것으로, 합치거나 계산하지 않았습니다.'}
          </p>
        </>
      )}
    </div>
    </>
  );
}

/** 공유 주소 — 해시 라우터 주소(현재 문서 주소 + #경로?검색) */
function shareUrl(pathname: string, search: string): string {
  const { origin, pathname: docPath } = window.location;
  return `${origin}${docPath}#${pathname}${search}`;
}

/** 안내 목록이 바뀌면 공용 live region 으로 한 번 읽어 줌 */
function NoticeAnnouncer({ text }: { text: string }) {
  useEffect(() => {
    if (text) announce(text);
  }, [text]);
  return null;
}

/**
 * "링크 복사" (UX 토론 C6) — navigator.clipboard 가 없거나 거절되면 주소를 선택된 입력창으로 보여 준다(직접 복사).
 * 복사되면 announce('링크를 복사했습니다') + 버튼 글자 잠시 "복사됨 ✓".
 */
function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (fallback) inputRef.current?.select();
  }, [fallback, url]);
  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(url);
      setFallback(false);
      setCopied(true);
      announce('링크를 복사했습니다');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setFallback(true);
      announce('자동 복사가 안 됩니다 — 입력창의 주소를 직접 복사하세요');
    }
  };
  return (
    <span className="cmp-copy">
      <button type="button" className="cmp-diff cmp-copy__btn" data-testid="compare-copy-link" onClick={copy}>
        {copied ? '링크 복사됨 ✓' : '링크 복사'}
      </button>
      {fallback && (
        <input
          ref={inputRef}
          className="cmp-copy__input"
          data-testid="compare-copy-fallback"
          type="text"
          readOnly
          value={url}
          aria-label="공유 링크 — 선택된 주소를 직접 복사하세요"
          onFocus={(e) => e.currentTarget.select()}
        />
      )}
    </span>
  );
}

