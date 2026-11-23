import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import growthJson from '../data/market-growth.json';
import { LAYERS, LAYER_LABELS, type Coverage, type EquipmentType, type Layer } from '../lib/schema';
import { useData } from '../data/load';
import { announce } from '../lib/announce';
import CoverageBadge from '../components/common/CoverageBadge';
import { ButtonLink } from '../components/common/Button';
import { FilterChip } from '../components/common/Badge';
import PageHeader from '../components/common/PageHeader';
import { CATEGORY_LABELS, CATEGORY_ORDER, COVERAGE_LABELS, COVERAGE_ORDER, COVERAGE_SHORT_LABELS, isMainLayer, pageTitle, todayIso } from '../lib/labels';
import { buildGapCsv, buildMatrix, countCoverage, diagramHref, downloadText, gapMemo, nodeForEquipment, ownedRate } from '../lib/pages/catalog';
import { GROWTH_LABELS, GROWTH_SYMBOLS, MarketGrowthSchema, growthByEquipment } from '../lib/market/annual';
import './pages.css';
import './GapPage.css';

/**
 * 라인업 현황 (/gap) — 2026-11-23 전면 재설계 (사용자: "어떤 구조인지 알아볼 수 없음, 너무 어렵게 표현됨").
 * 화면이 세 질문에 위에서부터 답한다:
 *  ① 얼마나 갖췄나 — 요약 카드 4개 (보유율 · 보완 필요 · 다른 방식으로 공급 · 개발 중)
 *  ② 어느 단계가 비었나 — 계층별 가로 막대 (누르면 아래 목록이 그 계층만)
 *  ③ 무엇을 먼저 볼까 — 보완 대상 기기를 '우선 검토(시장 증가 + 자사 없음) / 검토 / 다른 방식으로 공급 / 개발 중'으로 묶은 목록
 * 예전 "보유 현황표(계층×기능)"는 맨 아래 접힌 상세표로, "보완 매트릭스(성장×보유)"는 ③의 묶음·'시장 증가' 표시로 녹였다.
 */

const GROWTH = MarketGrowthSchema.parse(growthJson);

type Filter = 'all' | 'missing' | 'partial' | 'affiliate' | 'sourced' | 'developing';
const LIST_COVERAGES: readonly Coverage[] = ['missing', 'partial', 'affiliate', 'sourced', 'developing'];
const FILTERS: Filter[] = ['all', 'missing', 'partial', 'affiliate', 'sourced', 'developing'];
const FILTER_LABELS: Record<Filter, string> = {
  all: '전체',
  missing: COVERAGE_SHORT_LABELS.missing,
  partial: COVERAGE_LABELS.partial,
  affiliate: COVERAGE_LABELS.affiliate,
  sourced: COVERAGE_SHORT_LABELS.sourced,
  developing: COVERAGE_LABELS.developing,
};

/** 막대 조각 순서·색 — 보유(초록) → 개발 중 → 다른 방식으로 공급 → 일부 → 미보유(빨강) */
const SEGMENTS: { key: string; label: string; covs: Coverage[] }[] = [
  { key: 'owned', label: '보유', covs: ['owned'] },
  { key: 'developing', label: '개발 중', covs: ['developing'] },
  { key: 'other', label: '계열사·패널 구성품', covs: ['affiliate', 'sourced'] },
  { key: 'partial', label: '일부 보유', covs: ['partial'] },
  { key: 'missing', label: '미보유', covs: ['missing'] },
];

interface Group {
  id: 'priority' | 'review' | 'other' | 'developing';
  title: string;
  desc: string;
  items: EquipmentType[];
}

export default function GapPage() {
  const data = useData();
  const equipment = data.equipmentTypes;
  const growth = useMemo(() => growthByEquipment(GROWTH), []);
  const layerVoltage = useMemo(() => new Map(data.diagram.layers.map((l) => [l.id, l.voltage])), [data]);
  const totals = useMemo(() => countCoverage(equipment), [equipment]);
  const rate = ownedRate(totals);
  const [filter, setFilter] = useState<Filter>('all');
  const [layer, setLayer] = useState<Layer | null>(null);
  const listRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.title = pageTitle('라인업 현황');
  }, []);

  const isUp = (e: EquipmentType) => {
    const d = growth.get(e.id)?.direction;
    return d === 'up' || d === 'up2';
  };

  // ② 계층별 현황 (해당 없음은 분모에서 뺌)
  const layers = useMemo(
    () =>
      LAYERS.map((l) => {
        const items = equipment.filter((e) => e.layer === l);
        const c = countCoverage(items);
        const total = items.length - c.na;
        return { id: l, total, owned: c.owned, gaps: c.missing + c.partial, counts: c };
      }).filter((r) => r.total > 0),
    [equipment],
  );

  // ③ 목록 — 계층·상태 필터
  const scoped = equipment.filter((e) => LIST_COVERAGES.includes(e.coverage) && (!layer || e.layer === layer));
  const visible = filter === 'all' ? scoped : scoped.filter((e) => e.coverage === filter);
  const order = (a: EquipmentType, b: EquipmentType) => LAYERS.indexOf(a.layer) - LAYERS.indexOf(b.layer);
  const groups: Group[] = [
    {
      id: 'priority',
      title: '우선 검토',
      desc: '정부 계획상 시장이 커지는데 자사 제품이 없거나 일부만 있는 기기',
      items: visible.filter((e) => (e.coverage === 'missing' || e.coverage === 'partial') && isUp(e)).sort(order),
    },
    {
      id: 'review',
      title: '검토',
      desc: '자사 제품이 없거나 일부만 있는 기기 (시장 성장 근거는 아직 없음)',
      items: visible.filter((e) => (e.coverage === 'missing' || e.coverage === 'partial') && !isUp(e)).sort(order),
    },
    {
      id: 'other',
      title: '다른 방식으로 공급',
      desc: '계열사 제품이나 수배전반 구성품(타사 조달)으로 공급하는 기기',
      items: visible.filter((e) => e.coverage === 'affiliate' || e.coverage === 'sourced').sort(order),
    },
    {
      id: 'developing',
      title: '개발 중',
      desc: '자사에서 개발하고 있는 기기',
      items: visible.filter((e) => e.coverage === 'developing').sort(order),
    },
  ];

  // 필터 결과를 화면낭독기에 알림 (첫 화면 제외)
  const key = `${filter}|${layer ?? ''}`;
  const lastKey = useRef(key);
  useEffect(() => {
    if (lastKey.current === key) return;
    lastKey.current = key;
    const f = filter === 'all' ? '' : ` · ${FILTER_LABELS[filter]}`;
    const l = layer ? ` · ${layer}` : '';
    announce(`보완 필요 목록${f}${l} — ${visible.length}종`);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickLayer = (l: Layer) => {
    setLayer((cur) => (cur === l ? null : l));
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }));
  };
  const pickFilter = (f: Filter) => {
    setFilter(f);
    if (f !== 'all') requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const exportCsv = () => {
    const csv = buildGapCsv(visible, (c) => COVERAGE_LABELS[c], (l) => LAYER_LABELS[l]);
    downloadText(`lse-lineup-${todayIso().replace(/-/g, '')}.csv`, csv);
  };

  const gapCount = totals.missing + totals.partial;
  const otherCount = totals.affiliate + totals.sourced;

  return (
    <div className="pg pg--wide" data-testid="gap-page">
      <PageHeader
        crumbs={[{ label: '계통도', to: '/' }, { label: '라인업 현황' }]}
        title="라인업 현황"
        lead="LS ELECTRIC 제품으로 전력계통 기기를 얼마나 갖췄는지, 무엇을 보완해야 하는지 봅니다."
      />

      {/* ① 한눈에 */}
      <section className="gx-kpis" aria-label="한눈에 보기">
        <div className="gx-kpi gx-kpi--owned">
          <p className="gx-kpi__label">보유율</p>
          <p className="gx-kpi__num">
            {rate.pct}
            <small>%</small>
          </p>
          <p className="gx-kpi__sub">
            {rate.total}종 중 {rate.owned}종 보유
          </p>
          <p className="gx-kpi__basis" data-testid="gap-basis">
            전체 기기 기준 (데이터센터 포함){totals.na > 0 && <span data-testid="gap-na-excluded"> · 해당 없음 {totals.na}종 제외</span>}
          </p>
        </div>
        <button type="button" className="gx-kpi gx-kpi--gap" onClick={() => pickFilter('all')} data-testid="gap-kpi-gaps">
          <span className="gx-kpi__label">보완 필요</span>
          <span className="gx-kpi__num">
            {gapCount}
            <small>종</small>
          </span>
          <span className="gx-kpi__sub">
            미보유 {totals.missing} · 일부 보유 {totals.partial}
          </span>
        </button>
        <div className="gx-kpi gx-kpi--other">
          <p className="gx-kpi__label">다른 방식으로 공급</p>
          <p className="gx-kpi__num">
            {otherCount}
            <small>종</small>
          </p>
          <p className="gx-kpi__sub">
            계열사 {totals.affiliate} · 패널 구성품 {totals.sourced}
          </p>
        </div>
        <div className="gx-kpi gx-kpi--dev">
          <p className="gx-kpi__label">개발 중</p>
          <p className="gx-kpi__num">
            {totals.developing}
            <small>종</small>
          </p>
          <p className="gx-kpi__sub">자사 개발 진행</p>
        </div>
      </section>

      {/* ② 계층별 */}
      <section className="pg-card gx-card" aria-labelledby="gx-layers-h" data-testid="gap-matrix">
        <div className="gx-card__head">
          <h2 id="gx-layers-h">계층별 보유 현황</h2>
          <p className="gx-card__hint">막대를 누르면 아래 목록이 그 계층만 보입니다.</p>
        </div>
        <ul className="gx-legend" aria-label="막대 색 설명">
          {SEGMENTS.map((s) => (
            <li key={s.key}>
              <span className={`gx-sw gx-seg--${s.key}`} aria-hidden="true" /> {s.label}
            </li>
          ))}
        </ul>
        <ul className="gx-layers">
          {layers.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="gx-layer"
                aria-pressed={layer === r.id}
                onClick={() => pickLayer(r.id)}
                data-testid={`gap-layer-${r.id}`}
              >
                <span className="gx-layer__name">
                  {isMainLayer(r.id) && <b>{r.id}</b>} {LAYER_LABELS[r.id]}
                  {isMainLayer(r.id) && layerVoltage.get(r.id) && <small> {layerVoltage.get(r.id)}</small>}
                </span>
                <span className="gx-bar" aria-hidden="true">
                  {SEGMENTS.map((s) => {
                    const n = s.covs.reduce((a, c) => a + r.counts[c], 0);
                    return n > 0 ? <span key={s.key} className={`gx-seg gx-seg--${s.key}`} style={{ flexGrow: n }} title={`${s.label} ${n}`} /> : null;
                  })}
                </span>
                <span className="gx-layer__num">
                  보유 <b>{r.owned}</b>/{r.total}
                </span>
                <span className={`gx-layer__gap${r.gaps > 0 ? ' has-gap' : ''}`}>{r.gaps > 0 ? `보완 ${r.gaps}` : '보완 없음'}</span>
                <span className="visually-hidden">
                  {' '}
                  — {SEGMENTS.map((s) => `${s.label} ${s.covs.reduce((a, c) => a + r.counts[c], 0)}`).join(', ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* ③ 무엇을 볼까 */}
      <section className="pg-card gx-card" aria-labelledby="gx-list-h" ref={listRef}>
        <div className="gx-card__head">
          <h2 id="gx-list-h">
            보완 대상 기기 <span className="gx-count">{visible.length}종</span>
          </h2>
          <button type="button" className="gx-csv" onClick={exportCsv}>
            CSV 내보내기
          </button>
        </div>
        <div className="gx-filters" role="group" aria-label="상태로 거르기">
          {FILTERS.map((f) => {
            const n = f === 'all' ? scoped.length : scoped.filter((e) => e.coverage === f).length;
            if (f !== 'all' && n === 0) return null;
            return (
              <FilterChip key={f} pressed={filter === f} testId={`gap-filter-${f}`} onClick={() => pickFilter(f)}>
                {FILTER_LABELS[f]} {n}
              </FilterChip>
            );
          })}
          {layer && (
            <button type="button" className="gx-layer-chip" onClick={() => setLayer(null)} data-testid="gap-layer-clear">
              {layer} {LAYER_LABELS[layer]}만 <span aria-hidden="true">✕</span>
              <span className="visually-hidden"> 계층 거르기 해제</span>
            </button>
          )}
        </div>

        <div className="gx-groups" data-testid="gap-list">
          {groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <section key={g.id} className={`gx-group gx-group--${g.id}`} aria-labelledby={`gx-g-${g.id}`}>
                <h3 id={`gx-g-${g.id}`} className="gx-group__title">
                  {g.title} <span className="gx-count">{g.items.length}</span>
                </h3>
                <p className="gx-group__desc">{g.desc}</p>
                <ul className="gx-items">
                  {g.items.map((e) => {
                    const node = nodeForEquipment(e.id);
                    const gr = growth.get(e.id);
                    const memo = gapMemo(e);
                    return (
                      <li key={e.id} className="gx-item" data-testid={`gap-item-${e.id}`} data-coverage={e.coverage}>
                        <CoverageBadge coverage={e.coverage} variant="chip" label={COVERAGE_SHORT_LABELS[e.coverage]} />
                        <div className="gx-item__body">
                          <p className="gx-item__name">
                            <Link to={`/equipment/${e.id}`}>{e.name}</Link>
                            {e.abbr && <span className="gx-item__abbr"> {e.abbr}</span>}
                            <span className="gx-item__layer">{isMainLayer(e.layer) ? e.layer : LAYER_LABELS[e.layer]}</span>
                            {gr && (gr.direction === 'up' || gr.direction === 'up2') && (
                              <span className="gx-item__growth" title={gr.reason}>
                                시장 {GROWTH_SYMBOLS[gr.direction]} {GROWTH_LABELS[gr.direction]}
                              </span>
                            )}
                          </p>
                          {memo && <p className="gx-item__memo">{memo}</p>}
                        </div>
                        {node && (
                          <ButtonLink variant="ghost" size="sm" to={diagramHref(node.id)}>
                            계통도에서 보기
                          </ButtonLink>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          {visible.length === 0 && <p className="gx-empty">조건에 맞는 기기가 없습니다.</p>}
        </div>
      </section>

      {/* 자세히: 계층 × 기능 표 (예전 보유 현황표) */}
      <details className="pg-card gx-card gx-detail">
        <summary>
          <h2 className="gx-detail__title">자세히 보기: 계층 × 기능 표</h2>
          <span className="gx-card__hint">기기 기능(개폐·보호·변성…)별로 나눠 본 표입니다.</span>
        </summary>
        <DetailTable equipment={equipment} />
      </details>
    </div>
  );
}

/** 계층 × 기능 표 — 칸마다 상태별 개수 칩 (마우스를 올리면 기기 이름) */
function DetailTable({ equipment }: { equipment: EquipmentType[] }) {
  const matrix = useMemo(() => buildMatrix(equipment), [equipment]);
  const cats = CATEGORY_ORDER.filter((c) => matrix.some((r) => r.cells[c].length > 0));
  return (
    <div className="gx-scroll" tabIndex={0} role="region" aria-label="계층 × 기능 표 (가로 스크롤)">
      <table className="gx-table">
        <thead>
          <tr>
            <th scope="col">계층</th>
            {cats.map((c) => (
              <th key={c} scope="col">
                {CATEGORY_LABELS[c]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix
            .filter((r) => cats.some((c) => r.cells[c].length > 0))
            .map((r) => (
              <tr key={r.layer}>
                <th scope="row">
                  {isMainLayer(r.layer) && <b>{r.layer}</b>} {LAYER_LABELS[r.layer]}
                </th>
                {cats.map((c) => {
                  const items = r.cells[c];
                  if (items.length === 0) return <td key={c} />;
                  const counts = countCoverage(items);
                  return (
                    <td key={c} title={items.map((e) => e.name).join(', ')}>
                      <span className="gx-cell">
                        {COVERAGE_ORDER.filter((k) => counts[k] > 0).map((k) => (
                          <CoverageBadge key={k} coverage={k} variant="chip" label={counts[k]} />
                        ))}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
