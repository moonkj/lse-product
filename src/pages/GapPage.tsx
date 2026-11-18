import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LAYER_LABELS, type Coverage, type EquipmentCategory, type Layer } from '../lib/schema';
import { useData } from '../data/load';
import { announce } from '../lib/announce';
import CoverageBadge from '../components/common/CoverageBadge';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  COVERAGE_ICONS,
  COVERAGE_LABELS,
  COVERAGE_ORDER,
  COVERAGE_SHORT_LABELS,
  confidenceLabel,
  GAP_LIST_COVERAGES,
  gapConfidence,
  isMainLayer,
  pageTitle,
  todayIso,
} from '../lib/labels';
import {
  buildGapCsv,
  buildMatrix,
  countCoverage,
  diagramHref,
  downloadText,
  gapMemo,
  nodeForEquipment,
  ownedRate,
} from '../lib/pages/catalog';
import './pages.css';
import './GapPage.css';

type StatusFilter = 'all' | Coverage;
interface CellSel {
  layer: Layer;
  category: EquipmentCategory;
}

/** 목록 정렬: 계층 순 → 미보유·일부·계열사·패널 구성품·보유·해당없음 */
const LIST_COVERAGE_RANK: Record<Coverage, number> = { missing: 0, partial: 1, affiliate: 2, sourced: 3, owned: 4, na: 5 };
/** 필터 버튼 라벨: 정식 라벨에서 "미보유(공백)" 만 짧게 */
const FILTER_LABELS: Record<Coverage, string> = { ...COVERAGE_LABELS, missing: COVERAGE_SHORT_LABELS.missing };

export default function GapPage() {
  const data = useData();
  const equipment = data.equipmentTypes;
  const layerOrder = useMemo(() => new Map(data.diagram.layers.map((l, i) => [l.id, i])), [data]);
  const layerVoltage = useMemo(() => new Map(data.diagram.layers.map((l) => [l.id, l.voltage])), [data]);
  const matrix = useMemo(() => buildMatrix(equipment), [equipment]);
  const totals = useMemo(() => countCoverage(equipment), [equipment]);
  const rate = ownedRate(totals);

  // 기본 필터 = 전체 (디자인 승인안·리더 결정, FT-26): 첫 화면 목록 = 미보유·일부·계열사·패널 구성품 전체
  const [status, setStatus] = useState<StatusFilter>('all');
  const [cell, setCell] = useState<CellSel | null>(null);
  const listRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.title = pageTitle('공백 표');
  }, []);

  /** 칸 선택 시: 그 칸의 모든 기기 / 아니면: 미보유·일부·계열사·패널 구성품 (GAP_LIST_COVERAGES) */
  const scope = useMemo(() => {
    const base = cell
      ? equipment.filter((e) => e.layer === cell.layer && e.category === cell.category)
      : equipment.filter((e) => GAP_LIST_COVERAGES.includes(e.coverage));
    return [...base].sort(
      (a, b) =>
        (layerOrder.get(a.layer) ?? 0) - (layerOrder.get(b.layer) ?? 0) ||
        LIST_COVERAGE_RANK[a.coverage] - LIST_COVERAGE_RANK[b.coverage],
    );
  }, [equipment, cell, layerOrder]);
  const scopeCounts = countCoverage(scope);
  const chipCoverages = cell ? COVERAGE_ORDER.filter((c) => scopeCounts[c] > 0) : GAP_LIST_COVERAGES;
  const visible = status === 'all' ? scope : scope.filter((e) => e.coverage === status);
  const listTitle = cell ? `${cell.layer} · ${CATEGORY_LABELS[cell.category]} 기기` : '공백 목록';

  // 필터·칸 선택 결과를 스크린리더에 알림 (B10 — 앱 공용 live region). 첫 화면은 알리지 않음
  const filterKey = `${status}|${cell?.layer ?? ''}|${cell?.category ?? ''}`;
  const lastKey = useRef(filterKey);
  useEffect(() => {
    if (lastKey.current === filterKey) return;
    lastKey.current = filterKey;
    const filter = status === 'all' ? '' : ` · ${FILTER_LABELS[status]}`;
    announce(`${listTitle}${filter} — ${visible.length}종`);
  }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectCell = (sel: CellSel) => {
    const same = cell && cell.layer === sel.layer && cell.category === sel.category;
    setCell(same ? null : sel);
    setStatus('all');
    if (!same) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }));
    }
  };

  const clearCell = () => {
    setCell(null);
    setStatus('all');
  };

  const exportCsv = () => {
    const csv = buildGapCsv(visible, (c) => COVERAGE_LABELS[c], (l) => LAYER_LABELS[l]);
    const stamp = todayIso().replace(/-/g, '');
    downloadText(`lse-gap-list-${stamp}.csv`, csv);
  };

  return (
    <div className="pg pg--wide" data-testid="gap-page">
      <div className="gp-head">
        <div className="gp-head__text">
          <Link to={diagramHref(undefined, 'gap')} className="gp-back">
            ← 계통도로 돌아가기
          </Link>
          <h1 className="gp-title">공백 표</h1>
          <p className="pg-muted gp-lead">
            전압 계층 × 기기 기능별로 자사 제품 커버리지를 봅니다. 칸을 누르면 해당 기기 목록이 열립니다.
          </p>
        </div>
        <dl className="gp-stats">
          <div className="gp-stat gp-stat--owned">
            <dt>
              보유율 {rate.owned}/{rate.total}
            </dt>
            <dd>{rate.pct}%</dd>
          </div>
          <div className="gp-stat gp-stat--missing">
            <dt>미보유</dt>
            <dd>{totals.missing}</dd>
          </div>
          <div className="gp-stat gp-stat--partial">
            <dt>일부 보유</dt>
            <dd>{totals.partial}</dd>
          </div>
          <div className="gp-stat gp-stat--affiliate">
            <dt>계열사 보유</dt>
            <dd>{totals.affiliate}</dd>
          </div>
          <div className="gp-stat gp-stat--sourced" data-testid="gap-stat-sourced">
            <dt>패널 구성품</dt>
            <dd>{totals.sourced}</dd>
          </div>
        </dl>
      </div>

      <section className="pg-card gp-card" aria-labelledby="mx-h">
        <div className="gp-card__head">
          <h2 id="mx-h">커버리지 매트릭스</h2>
          <span className="gp-legend">
            {COVERAGE_ORDER.map((c) => `${COVERAGE_ICONS[c]} ${COVERAGE_SHORT_LABELS[c]}`).join(' · ')} · 숫자 = 기기 종류 수
          </span>
        </div>
        <div className="gp-scroll" tabIndex={0} role="region" aria-label="커버리지 매트릭스 (가로 스크롤)">
          <table className="gp-matrix" data-testid="gap-matrix">
            <thead>
              <tr>
                <th scope="col" className="gp-matrix__rowhead">
                  계층
                </th>
                {CATEGORY_ORDER.map((c) => (
                  <th key={c} scope="col">
                    {CATEGORY_LABELS[c]}
                  </th>
                ))}
                <th scope="col">보유율</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => {
                const r = ownedRate(row.counts);
                const full = r.total > 0 && r.owned === r.total;
                return (
                  <tr key={row.layer} data-layer={row.layer}>
                    <th scope="row" className="gp-matrix__rowhead">
                      {isMainLayer(row.layer) && <b>{row.layer}</b>} {LAYER_LABELS[row.layer]}
                      {layerVoltage.get(row.layer) && isMainLayer(row.layer) && (
                        <span className="gp-matrix__volt"> {layerVoltage.get(row.layer)}</span>
                      )}
                    </th>
                    {CATEGORY_ORDER.map((cat) => {
                      const items = row.cells[cat];
                      if (items.length === 0)
                        return (
                          <td key={cat} className="gp-matrix__empty">
                            <span aria-hidden="true">·</span>
                            <span className="visually-hidden">없음</span>
                          </td>
                        );
                      const counts = countCoverage(items);
                      const selected = cell?.layer === row.layer && cell.category === cat;
                      const label = `${row.layer} ${CATEGORY_LABELS[cat]}: ${COVERAGE_ORDER.filter((c) => counts[c] > 0)
                        .map((c) => `${COVERAGE_LABELS[c]} ${counts[c]}`)
                        .join(', ')}`;
                      return (
                        <td key={cat}>
                          <button
                            type="button"
                            className="gp-cell"
                            aria-pressed={selected}
                            aria-label={label}
                            title={items.map((e) => e.name).join(', ')}
                            data-testid={`gap-cell-${row.layer}-${cat}`}
                            onClick={() => selectCell({ layer: row.layer, category: cat })}
                          >
                            {COVERAGE_ORDER.filter((c) => counts[c] > 0).map((c) => (
                              <CoverageBadge key={c} coverage={c} variant="chip" label={counts[c]} decorative />
                            ))}
                          </button>
                        </td>
                      );
                    })}
                    <td className={`gp-matrix__rate${full ? ' gp-matrix__rate--full' : ''}`}>
                      {r.owned}/{r.total}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="pg-card gp-card" aria-labelledby="list-h" ref={listRef}>
        <div className="gp-card__head">
          <h2 id="list-h">
            {listTitle} <span className="pg-count">· {visible.length}종</span>
          </h2>
          {cell && (
            <button type="button" className="gp-filter gp-filter--clear" onClick={clearCell}>
              칸 선택 해제 ✕
            </button>
          )}
          <div className="gp-filters" role="group" aria-label="상태 필터">
            <button
              type="button"
              className="gp-filter"
              aria-pressed={status === 'all'}
              data-testid="gap-filter-all"
              onClick={() => setStatus('all')}
            >
              전체 {scope.length}
            </button>
            {chipCoverages.map((c) => (
              <button
                key={c}
                type="button"
                className="gp-filter"
                aria-pressed={status === c}
                data-testid={`gap-filter-${c}`}
                onClick={() => setStatus(c)}
              >
                {FILTER_LABELS[c]} {scopeCounts[c]}
              </button>
            ))}
          </div>
          <button type="button" className="pg-btn pg-btn--sm gp-csv" onClick={exportCsv} disabled={visible.length === 0}>
            CSV 내보내기
          </button>
        </div>
        <div className="gp-scroll" tabIndex={0} role="region" aria-label="공백 목록 (가로 스크롤)">
          <table className="gp-list" data-testid="gap-list">
            <thead>
              <tr>
                <th scope="col">상태</th>
                <th scope="col">계층</th>
                <th scope="col">기기</th>
                <th scope="col">메모</th>
                <th scope="col">
                  <span className="visually-hidden">이동</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="pg-muted">
                    이 조건에 해당하는 기기가 없습니다.
                  </td>
                </tr>
              ) : (
                visible.map((eq) => {
                  const node = nodeForEquipment(eq.id);
                  return (
                    <tr key={eq.id} data-testid={`gap-item-${eq.id}`} data-coverage={eq.coverage}>
                      <td>
                        <CoverageBadge coverage={eq.coverage} variant="chip" label={COVERAGE_SHORT_LABELS[eq.coverage]} />
                        {gapConfidence(eq) && (
                          <span
                            className={`gp-conf gp-conf--${gapConfidence(eq)}`}
                            data-testid={`gap-confidence-${eq.id}`}
                          >
                            {confidenceLabel(eq.coverage, gapConfidence(eq)!).replace('공백 ', '')}
                          </span>
                        )}
                      </td>
                      <td>{eq.layer}</td>
                      <td>
                        <Link to={`/equipment/${eq.id}`} className="gp-list__eq">
                          <b>{eq.name}</b>
                        </Link>
                        {eq.abbr && <span className="gp-list__abbr"> {eq.abbr}</span>}
                      </td>
                      <td className="gp-list__memo">{gapMemo(eq)}</td>
                      <td className="gp-list__go">
                        {node && <Link to={diagramHref(node.id, 'gap')}>계통도에서 보기</Link>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
