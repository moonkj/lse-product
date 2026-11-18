import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { DOC_TYPE_LABELS, type EquipmentType, type Product } from '../lib/schema';
import { getData, loadSpecs, peekSpecs, useData, type SpecsMap } from '../data/load';
import CoverageBadge from '../components/common/CoverageBadge';
import ExternalLink from '../components/common/ExternalLink';
import EquipmentVisual from '../components/pages/EquipmentVisual';
import { CATEGORY_LABELS, CONFIDENCE_LABELS, COVERAGE_LABELS, gapConfidence, pageTitle } from '../lib/labels';
import { layerTitle } from '../lib/diagram/model';
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
  productDocs,
  representativeDoc,
  specLabel,
  specProductCount,
  specValueText,
  compareKey,
  type DocCounts,
  type LinkedItem,
} from '../lib/pages/compare';
import { compareHref, useCompareStore, type CompareKind } from '../store/useCompareStore';
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
  id: string;
  name: string;
  sub?: string;
  eq?: EquipmentType;
  href: string;
}

const KIND_LABEL: Record<CompareKind, string> = { equipment: '기기', product: '제품' };

/** specs.json 지연 로딩 상태 (디버그 M6 — 첫 화면 번들에서 빼고, 실패해도 이 화면에서만 안내) */
type SpecsState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; map: SpecsMap };

const SPECS_ERROR_TEXT = '사양 데이터를 불러오지 못했습니다';

function useSpecs(): SpecsState {
  const [state, setState] = useState<SpecsState>(() => {
    const map = peekSpecs();
    return map ? { status: 'ready', map } : { status: 'loading' };
  });
  useEffect(() => {
    if (state.status === 'ready') return;
    let alive = true;
    loadSpecs().then(
      (map) => alive && setState({ status: 'ready', map }),
      (e: unknown) => {
        console.error('[compare] specs.json', e);
        if (alive) setState({ status: 'error' });
      },
    );
    return () => {
      alive = false;
    };
    // 한 번만 시도 (실패하면 화면에 다시 들어올 때 재시도)
  }, []);
  return state;
}

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
        <span className="cmp-muted" role="status">
          사양 불러오는 중…
        </span>
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
                  {CONFIDENCE_LABELS[conf]}
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
      cells: list.map((eq) => ({ text: eq.description, node: <p className="cmp-text">{eq.description}</p> })),
    },
    {
      key: 'learn',
      label: '학습 포인트',
      cells: list.map((eq) => ({
        text: eq.learnPoints.join('|'),
        node:
          eq.learnPoints.length > 0 ? (
            <ul className="cmp-list">
              {eq.learnPoints.map((lp) => (
                <li key={lp}>{lp}</li>
              ))}
            </ul>
          ) : (
            <None why="학습 포인트 없음" />
          ),
      })),
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
            text: entries.map((e) => `${e.product.id}:${compareKey(specValueText(e.item))}`).join('|'),
            node: (
              <ul className="cmp-list cmp-specs">
                {entries.map(({ product, item }, i) => {
                  const src = specsByProductId.get(product.id);
                  if (src && !src.reviewed) anyUnreviewed = true;
                  const page = item.page ?? src?.source.page;
                  return (
                    <li key={`${product.id}-${i}`}>
                      <Link to={`/product/${product.id}`} className="cmp-specs__name">
                        {product.name}
                      </Link>
                      : <span className="cmp-specs__value">{specValueText(item)}</span>
                      {src && (
                        <ExternalLink href={pageHref(src.source.url, page)} className="cmp-page" title={src.source.title}>
                          {page ? `p.${page}` : '출처'}
                        </ExternalLink>
                      )}
                    </li>
                  );
                })}
              </ul>
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

function productSections(list: Product[], specsState: SpecsState): { sections: Section[]; anyUnreviewed: boolean; mixed: boolean } {
  const { docsByProductId } = getData();
  const specsByProductId: SpecsMap = specsState.status === 'ready' ? specsState.map : new Map();
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
              {e.length > 1 && <span className="cmp-muted"> 외 {e.length - 1}개 기기</span>}
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

  const specs = list.map((p) => specsByProductId.get(p.id));
  const keys = orderSpecKeys(specs.flatMap((s) => s?.items.map((i) => i.key) ?? []));
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
    const firstLabel = specs.flatMap((s) => s?.items.filter((i) => i.key === key) ?? [])[0]?.label;
    specRows.push({
      key: `spec-${key}`,
      label: specLabel(key, firstLabel),
      cells: specs.map((s) => {
        const items = s?.items.filter((i) => i.key === key) ?? [];
        // 사양 미수집(제품 자체에 사양 없음)과 카탈로그에 없음(키 없음)은 차이만 보기에서 다른 값 (L9)
        if (!s) return { text: '∅no-spec', node: <None why="사양 미수집" /> };
        if (items.length === 0) return { text: '', node: <None /> };
        return {
          text: items.map((it) => compareKey(specValueText(it))).join('|'),
          node: (
            <ul className="cmp-list cmp-specs">
              {items.map((it, i) => (
                <li key={i}>
                  <span className="cmp-specs__value">{specValueText(it)}</span>
                  {it.page && (
                    <ExternalLink href={pageHref(s.source.url, it.page)} className="cmp-page" title={s.source.title}>
                      p.{it.page}
                    </ExternalLink>
                  )}
                </li>
              ))}
            </ul>
          ),
        };
      }),
    });
  }
  const anyUnreviewed = specs.some((s) => s && !s.reviewed);
  specRows.push({
    key: 'spec-source',
    label: '사양 출처',
    keep: true,
    cells: list.map((p, i) => {
      const s = specs[i];
      return {
        text: s ? `${s.source.url}#${s.source.page ?? ''}` : '',
        node: (
          <div className="cmp-stack" data-testid={`compare-spec-source-${p.id}`}>
            {s ? (
              <>
                <ExternalLink href={pageHref(s.source.url, s.source.page)} className="cmp-doclink">
                  {s.source.title}
                  {s.source.page ? ` · p.${s.source.page}` : ''} ↗
                </ExternalLink>
                {s.reviewed ? (
                  <span className="cmp-badge cmp-badge--ok">검수 완료</span>
                ) : (
                  <UnreviewedBadge />
                )}
                <span className="cmp-muted">추출일 {s.extractedAt}</span>
                {s.note && <span className="cmp-muted">{s.note}</span>}
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

function EmptyState({ type }: { type: CompareKind | null }) {
  const stored = useCompareStore((s) => s);
  const data = useData();
  const ready = (['equipment', 'product'] as const).filter((k) =>
    stored[k].filter((id) => (k === 'equipment' ? data.equipmentTypeById.has(id) : data.productById.has(id))).length >= 2,
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
  const navigate = useNavigate();
  const specsState = useSpecs();
  const removeStored = useCompareStore((s) => s.remove);
  const storedEquipment = useCompareStore((s) => s.equipment);
  const storedProduct = useCompareStore((s) => s.product);
  const parsed = parseCompareParams(params);
  const { type, ids, missing, overflow } = parsed;
  // "차이만 보기"는 지금 비교(type+ids)에만 적용 — 다른 비교로 옮기면 꺼진 상태로 (같은 라우트라 컴포넌트가 유지됨, L7)
  const viewKey = `${type}:${ids.join(',')}`;
  const [diffState, setDiffState] = useState({ key: viewKey, on: false });
  const diffOnly = diffState.key === viewKey && diffState.on;
  const setDiffOnly = (f: (v: boolean) => boolean) => setDiffState({ key: viewKey, on: f(diffOnly) });

  useEffect(() => {
    document.title = pageTitle(type ? `${KIND_LABEL[type]} 비교` : '비교');
  }, [type]);

  const removeColumn = (id: string) => {
    if (!type) return;
    const nextIds = ids.filter((x) => x !== id);
    // 열 빼기는 같은 비교를 이어 가는 것 — 차이만 보기 상태 유지
    setDiffState({ key: `${type}:${nextIds.join(',')}`, on: diffOnly });
    // 주소는 compareHref 형식(쉼표 그대로)으로 (L4)
    navigate(compareHref(type, nextIds), { replace: true });
    // 내 담기 목록과 같은 비교일 때만 목록에서도 뺀다 — 공유받은 링크에서 열을 빼도 내 목록은 그대로 (L3)
    const stored = type === 'equipment' ? storedEquipment : storedProduct;
    const same = stored.length === ids.length && ids.every((x) => stored.includes(x));
    if (same) removeStored(type, id);
  };

  const notices: string[] = [];
  if (parsed.badType) notices.push(`비교 종류(type=${parsed.badType})를 알 수 없습니다 — equipment 또는 product 만 됩니다.`);
  if (missing.length > 0) notices.push(`등록되지 않은 항목 ${missing.length}개(${missing.join(', ')})는 제외했습니다.`);
  if (overflow.length > 0) notices.push(`한 번에 최대 4개까지 비교합니다 — ${overflow.length}개는 제외했습니다.`);

  let columns: Column[] = [];
  let sections: Section[] = [];
  let anyUnreviewed = false;
  if (type === 'equipment' && ids.length >= 2) {
    const list = ids.map((id) => data.equipmentTypeById.get(id)!);
    columns = list.map((eq) => ({ id: eq.id, name: eq.name, sub: eq.abbr, eq, href: `/equipment/${eq.id}` }));
    ({ sections, anyUnreviewed } = equipmentSections(list, specsState));
  } else if (type === 'product' && ids.length >= 2) {
    const list = ids.map((id) => data.productById.get(id)!);
    const common = commonEquipmentIds(list.map((p) => equipmentForProduct(p.id)));
    columns = list.map((p) => {
      const eq = mainEquipment(equipmentForProduct(p.id), common);
      return { id: p.id, name: p.name, sub: eq ? (eq.abbr ?? eq.name) : undefined, eq, href: `/product/${p.id}` };
    });
    const r = productSections(list, specsState);
    sections = r.sections;
    anyUnreviewed = r.anyUnreviewed;
    if (r.mixed) notices.push('서로 다른 기기의 제품을 함께 비교하고 있습니다 — "소속 기기" 행으로 구분하세요.');
  }
  if (specsState.status === 'error' && columns.length >= 2) notices.push(`${SPECS_ERROR_TEXT} — 사양 외 정보만 비교합니다. 새로고침하면 다시 시도합니다.`);

  const sameAll = (r: Row) => r.cells.every((c) => c.text === r.cells[0].text);
  const shownSections = sections
    .map((s) => ({ ...s, rows: diffOnly ? s.rows.filter((r) => r.keep || !sameAll(r)) : s.rows }))
    .filter((s) => s.rows.length > 0);
  const hiddenCount = sections.reduce((n, s) => n + s.rows.length, 0) - shownSections.reduce((n, s) => n + s.rows.length, 0);
  const title = type ? `${KIND_LABEL[type]} 비교` : '비교';

  return (
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
          {columns.length >= 2 && (
            <p className="pg-muted">
              {columns.length}개 {type ? KIND_LABEL[type] : ''} · 이 화면 주소를 복사하면 같은 비교를 공유할 수 있습니다.
            </p>
          )}
        </div>
        {columns.length >= 2 && (
          <div className="cmp-tools">
            {anyUnreviewed && <UnreviewedBadge />}
            <button
              type="button"
              className="cmp-diff"
              aria-pressed={diffOnly}
              data-testid="compare-diff-only"
              onClick={() => setDiffOnly((v) => !v)}
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
        // role=status 는 감싸는 div 에 — ul 에 두면 li 의 부모가 list 가 아니게 됨 (axe listitem, L6)
        <div role="status" data-testid="compare-notice">
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
            <p className="pg-muted" role="status">
              {hiddenCount > 0 ? `값이 모두 같은 ${hiddenCount}개 행을 숨겼습니다.` : '모든 행의 값이 서로 다릅니다.'}
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
                          {c.eq ? <EquipmentVisual eq={c.eq} thumb /> : <span className="cmp-muted">사진 없음</span>}
                        </div>
                        <span className="cmp-colhead__name">{c.name}</span>
                        {c.sub && <span className="cmp-colhead__sub">{c.sub}</span>}
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
  );
}
