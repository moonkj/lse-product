import { useEffect, useMemo, useState } from 'react';
import { getData } from '../../data/load';
import { getDiagramModel } from '../../lib/diagram/model';
import { requestPanelFocus, useSelectedNodeId, useSelectNode, useViewMode, useMediaQuery, MOBILE_QUERY } from '../../lib/diagram/url';
import { buildStageBoard, type StageColumn, type StageRow } from '../../lib/stages';
import { COVERAGE_LABELS, type EquipmentType } from '../../lib/schema';
import { isGapCoverage } from '../../lib/labels';
import { usePresetStore } from '../../lib/market/presetStore';
import { buildChecklist, presetById, scenarioById, PRESET_TIER_LABELS, type ChecklistRow } from '../../lib/market/presets';
import { ViewSegment } from '../diagram/DiagramToolbar';
import PresetPicker from '../market/PresetPicker';
import MarketButton from '../market/MarketButton';
import ViewSwitch from './ViewSwitch';
import './stage.css';

/** 기기 id → 계통도 기기 타일(참조 타일 제외) — 카드를 누르면 같은 ?node= 로 상세 패널이 열린다 */
function useNodeByEquipment() {
  return useMemo(() => {
    const m = new Map<string, { id: string; imageUrl?: string }>();
    for (const n of getDiagramModel().nodes) if (!m.has(n.eq.id)) m.set(n.eq.id, { id: n.id, imageUrl: n.imageUrl });
    return m;
  }, []);
}

function usePresetRows(): Map<string, ChecklistRow> | null {
  const presetId = usePresetStore((s) => s.presetId);
  const scenarioId = usePresetStore((s) => s.scenarioId);
  return useMemo(() => {
    const p = presetById(presetId);
    if (!p) return null;
    const rows = buildChecklist(p, p.scenarios ? scenarioById(scenarioId) : undefined, getData().equipmentTypeById);
    return new Map(rows.map((r) => [r.eq.id, r]));
  }, [presetId, scenarioId]);
}

interface CardProps {
  eq: EquipmentType;
  nodeId?: string;
  imageUrl?: string;
  selected: boolean;
  dimmed: boolean;
  preset?: ChecklistRow;
  onPick: (nodeId: string) => void;
}

function StageCard({ eq, nodeId, imageUrl, selected, dimmed, preset, onPick }: CardProps) {
  const tier = preset ? (preset.tier ?? 'scenario') : undefined;
  const tierLabel = preset?.tier ? PRESET_TIER_LABELS[preset.tier] : preset ? '시나리오' : '';
  return (
    <li>
      <button
        type="button"
        className="scard"
        data-cov={eq.coverage}
        data-gap={isGapCoverage(eq.coverage) || undefined}
        data-dim={dimmed || undefined}
        data-preset-tier={tier}
        aria-pressed={selected}
        data-testid={`stage-card-${eq.id}`}
        disabled={!nodeId}
        onClick={() => nodeId && onPick(nodeId)}
      >
        <span className="scard__pic" aria-hidden="true">
          {imageUrl ? <img src={imageUrl} alt="" loading="lazy" /> : <span className="scard__abbr">{eq.abbr ?? eq.name.slice(0, 3)}</span>}
        </span>
        <span className="scard__body">
          <span className="scard__name">
            {eq.abbr && <b className="scard__abbr-inline">{eq.abbr}</b>} {eq.name}
          </span>
          <span className="scard__meta">
            <span className="scard__cov">{COVERAGE_LABELS[eq.coverage]}</span>
            {tierLabel && <span className="scard__tier">{tierLabel}</span>}
          </span>
        </span>
      </button>
    </li>
  );
}

function Column({ col, render }: { col: StageColumn; render: (eq: EquipmentType) => JSX.Element }) {
  return (
    <section className="scol" data-stage={col.id} aria-labelledby={`scol-${col.id}`} data-testid={`stage-col-${col.id}`}>
      <header className="scol__head">
        <h3 id={`scol-${col.id}`} className="scol__title">
          {col.code && <span className="scol__code">{col.code}</span>}
          {col.label}
        </h3>
        <span className="scol__count" title={`보유 ${col.owned}종 / 전체 ${col.total}종`}>
          보유 {col.owned}/{col.total}
        </span>
        <span className="scol__volt">{col.voltage}</span>
        {col.gaps > 0 && <span className="scol__gaps">보완 {col.gaps}</span>}
      </header>
      <div className="scol__body">
        {col.groupsList.map((g) => (
          <div key={g.key || 'all'} className="scol__group" data-category={g.key || undefined}>
            {g.label && (
              <h4 className="scol__group-title">
                {g.label}
                <span className="scol__group-n" title={`보유 ${g.items.filter((e) => e.coverage === 'owned').length}종 / 전체 ${g.items.length}종`}>
                  {g.items.filter((e) => e.coverage === 'owned').length}/{g.items.length}
                </span>
              </h4>
            )}
            <ul className="scol__list">{g.items.map(render)}</ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/** 줄 제목 — 계통(L1~L3·신재생) / 수용가(L4~L7) */
function RowHead({ row }: { row: StageRow }) {
  return (
    <header className="stage__row-head">
      <h2 id={`srow-${row.id}`} className="stage__row-title">
        {row.code && <span className="stage__row-code">{row.code}</span>}
        {row.label}
        <span className="stage__row-sub">{row.sub}</span>
      </h2>
      <span className="stage__row-n">
        보유 {row.owned}/{row.total}
        {row.gaps > 0 && <span className="stage__row-gaps"> · 보완 {row.gaps}</span>}
      </span>
    </header>
  );
}

/**
 * 단계별 보기 (?view=stage) — 계통맵 층과 1:1 열을 두 줄로: 계통(L1·L2·L3·신재생) / 수용가(L4·L5·L6·L7) + 감시·제어 띠.
 * 기기가 많은 열은 기능 분류(시스템·개폐·보호·계측·제어·부하…) 소제목으로 묶는다.
 * 같은 기기 데이터·같은 보유 색. 카드를 누르면 계통맵과 같은 상세 패널(?node=)이 열린다.
 * 공백만 보기(?mode=gap)면 공백 아닌 카드를 흐리게, 수요처 프리셋이 있으면 필수·이중화·선택 표시.
 * 휴대폰(≤900px)은 층 탭으로 한 열씩.
 */
export default function StageView() {
  const board = useMemo(() => buildStageBoard(getData().equipmentTypes), []);
  const nodeByEq = useNodeByEquipment();
  const selectedNode = useSelectedNodeId();
  const selectNode = useSelectNode();
  const gapMode = useViewMode() === 'gap';
  const presetRows = usePresetRows();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const selectedEqId = selectedNode ? getDiagramModel().nodeById.get(selectedNode)?.eq.id : undefined;
  const selectedStage = selectedEqId ? board.columns.find((c) => c.groupsList.some((g) => g.items.some((e) => e.id === selectedEqId)))?.id : undefined;
  const [tab, setTab] = useState(selectedStage ?? board.columns[0].id);
  // 검색·뒤로가기로 다른 단계 기기가 선택되면 휴대폰 탭도 그 단계로
  useEffect(() => {
    if (selectedStage) setTab(selectedStage);
  }, [selectedStage]);

  const pick = (nodeId: string) => {
    requestPanelFocus();
    selectNode(nodeId);
  };
  const render = (eq: EquipmentType) => {
    const n = nodeByEq.get(eq.id);
    return (
      <StageCard
        key={eq.id}
        eq={eq}
        nodeId={n?.id}
        imageUrl={n?.imageUrl}
        selected={!!selectedEqId && selectedEqId === eq.id}
        dimmed={gapMode && !isGapCoverage(eq.coverage)}
        preset={presetRows?.get(eq.id)}
        onPick={pick}
      />
    );
  };
  const total = board.columns.reduce((s, c) => s + c.total, 0) + board.monitoring.length;
  // 휴대폰: 고른 탭의 열 하나만 (그 열이 속한 줄 제목과 함께)
  const rows: StageRow[] = isMobile
    ? board.rows.map((r) => ({ ...r, columns: r.columns.filter((c) => c.id === tab) })).filter((r) => r.columns.length > 0)
    : board.rows;

  return (
    <div className="stage" data-testid="stage-view">
      <div className="dtool dtool--stage">
        <div className="dtool__row dtool__main">
          <ViewSwitch />
          <ViewSegment mode={gapMode ? 'gap' : 'product'} />
          <PresetPicker />
          <span className="stage__total" aria-live="polite">
            기기 {total}종
          </span>
          <div className="dtool__end">
            <MarketButton />
          </div>
        </div>
      </div>

      <div className="stage__scroll">
        <p className="stage__lead">
          계통맵과 같은 층(L1~L7·신재생)으로 기기를 나눠 카드로 보여 줍니다. 카드를 누르면 계통맵과 같은 상세 정보가 열립니다.
        </p>

        {isMobile && (
          <div className="stage__tabs" role="tablist" aria-label="층">
            {board.columns.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                className="stage__tab"
                aria-selected={tab === c.id}
                data-testid={`stage-tab-${c.id}`}
                onClick={() => setTab(c.id)}
              >
                {c.code ? `${c.code} ` : ''}
                {c.label} <span className="stage__tab-n">{c.owned}/{c.total}</span>
              </button>
            ))}
          </div>
        )}

        {rows.map((r) => (
          <section key={r.id} className={`stage__row stage__row--${r.id}`} aria-labelledby={`srow-${r.id}`} data-testid={`stage-row-${r.id}`}>
            <RowHead row={r} />
            <div className="stage__grid">
              {r.columns.map((c) => (
                <Column key={c.id} col={c} render={render} />
              ))}
            </div>
          </section>
        ))}

        {board.monitoring.length > 0 && (
          <section className="stage__mon" aria-labelledby="stage-mon-title" data-testid="stage-monitoring">
            <h2 id="stage-mon-title" className="stage__mon-title">
              {board.monitoringLabel}{' '}
              <span className="stage__mon-sub">
                모든 층에 걸침 · 보유 {board.monitoring.filter((e) => e.coverage === 'owned').length}/{board.monitoring.length}
              </span>
            </h2>
            <ul className="stage__mon-list">{board.monitoring.map(render)}</ul>
          </section>
        )}
      </div>
    </div>
  );
}
