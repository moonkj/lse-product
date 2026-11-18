import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DOC_TYPE_LABELS, type EquipmentType, type Product } from '../lib/schema';
import { getData, useData } from '../data/load';
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

function equipmentSections(list: EquipmentType[]): { sections: Section[]; anyUnreviewed: boolean } {
  const { specsByProductId } = getData();
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

  const maps = list.map((eq) => equipmentSpecMap(eq.id));
  const keys = orderSpecKeys(maps.flatMap((m) => [...m.keys()]));
  let anyUnreviewed = false;
  const specRows: Row[] = [];
  if (keys.length === 0) {
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
        const t = `${specProductCount(eq.id)} / ${productsForEquipment(eq.id).length}개`;
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
            text: entries.map((e) => `${e.product.id}:${specValueText(e.item)}`).join('|'),
            node: (
              <ul className="cmp-list cmp-specs">
                {entries.map(({ product, item }) => {
                  const src = specsByProductId.get(product.id);
                  if (src && !src.reviewed) anyUnreviewed = true;
                  const page = item.page ?? src?.source.page;
                  return (
                    <li key={product.id}>
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

function productSections(list: Product[]): { sections: Section[]; anyUnreviewed: boolean; mixed: boolean } {
  const { specsByProductId, docsByProductId } = getData();
  const eqs = list.map((p) => equipmentForProduct(p.id));
  const mixed = new Set(eqs.map((e) => e[0]?.id ?? '')).size > 1;

  const base: Row[] = [
    {
      key: 'equipment',
      label: '소속 기기',
      cells: eqs.map((e) => {
        const main = e[0];
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
        if (!s) return { text: '', node: <None why="사양 미수집" /> };
        if (items.length === 0) return { text: '', node: <None /> };
        return {
          text: items.map(specValueText).join('|'),
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
  const [params, setParams] = useSearchParams();
  const removeStored = useCompareStore((s) => s.remove);
  const [diffOnly, setDiffOnly] = useState(false);
  const parsed = parseCompareParams(params);
  const { type, ids, missing, overflow } = parsed;

  useEffect(() => {
    document.title = pageTitle(type ? `${KIND_LABEL[type]} 비교` : '비교');
  }, [type]);

  const removeColumn = (id: string) => {
    if (!type) return;
    const next = new URLSearchParams(params);
    next.set('ids', ids.filter((x) => x !== id).join(','));
    setParams(next, { replace: true });
    removeStored(type, id);
  };

  const notices: string[] = [];
  if (missing.length > 0) notices.push(`등록되지 않은 항목 ${missing.length}개(${missing.join(', ')})는 제외했습니다.`);
  if (overflow.length > 0) notices.push(`한 번에 최대 4개까지 비교합니다 — ${overflow.length}개는 제외했습니다.`);

  let columns: Column[] = [];
  let sections: Section[] = [];
  let anyUnreviewed = false;
  if (type === 'equipment' && ids.length >= 2) {
    const list = ids.map((id) => data.equipmentTypeById.get(id)!);
    columns = list.map((eq) => ({ id: eq.id, name: eq.name, sub: eq.abbr, eq, href: `/equipment/${eq.id}` }));
    ({ sections, anyUnreviewed } = equipmentSections(list));
  } else if (type === 'product' && ids.length >= 2) {
    const list = ids.map((id) => data.productById.get(id)!);
    columns = list.map((p) => {
      const eq = equipmentForProduct(p.id)[0];
      return { id: p.id, name: p.name, sub: eq ? (eq.abbr ?? eq.name) : undefined, eq, href: `/product/${p.id}` };
    });
    const r = productSections(list);
    sections = r.sections;
    anyUnreviewed = r.anyUnreviewed;
    if (r.mixed) notices.push('서로 다른 기기의 제품을 함께 비교하고 있습니다 — "소속 기기" 행으로 구분하세요.');
  }

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
        <ul className="cmp-notices" role="status" data-testid="compare-notice">
          {notices.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
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
