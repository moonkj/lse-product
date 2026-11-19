import { useEffect, useMemo, useState } from 'react';
import { getData } from '../../data/load';
import { getDiagramModel } from '../../lib/diagram/model';
import { requestPanelFocus, useSelectedNodeId, useSelectNode, useViewMode, useMediaQuery, MOBILE_QUERY } from '../../lib/diagram/url';
import { buildStageBoard, type StageColumn } from '../../lib/stages';
import { COVERAGE_LABELS, type EquipmentType } from '../../lib/schema';
import { isGapCoverage } from '../../lib/labels';
import { usePresetStore } from '../../lib/market/presetStore';
import { buildChecklist, presetById, scenarioById, PRESET_TIER_LABELS, type ChecklistRow } from '../../lib/market/presets';
import { ViewSegment } from '../diagram/DiagramToolbar';
import PresetPicker from '../market/PresetPicker';
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
        <h2 id={`scol-${col.id}`} className="scol__title">
          {col.label}
        </h2>
        <span className="scol__count" title={`보유 ${col.owned}종 / 전체 ${col.total}종`}>
          보유 {col.owned}/{col.total}
        </span>
        <span className="scol__volt">{col.voltage}</span>
        {col.gaps > 0 && <span className="scol__gaps">공백 {col.gaps}</span>}
      </header>
      <div className="scol__body">
        {col.groups.map((g) => (
          <div key={g.label || 'all'} className="scol__group">
            {g.label && <h3 className="scol__group-title">{g.label}</h3>}
            <ul className="scol__list">{g.items.map(render)}</ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * 단계별 보기 (?view=stage) — 발전·송전·변전·배전·수용가 5단계 열 + 감시·제어 띠.
 * 같은 기기 데이터·같은 보유 색. 카드를 누르면 계통맵과 같은 상세 패널(?node=)이 열린다.
 * 공백만 보기(?mode=gap)면 공백 아닌 카드를 흐리게, 수요처 프리셋이 있으면 필수·이중화·선택 표시.
 * 휴대폰(≤900px)은 단계 탭으로 한 열씩.
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
  const selectedStage = selectedEqId ? board.columns.find((c) => c.groups.some((g) => g.items.some((e) => e.id === selectedEqId)))?.id : undefined;
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
  const columns = isMobile ? board.columns.filter((c) => c.id === tab) : board.columns;

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
        </div>
      </div>

      <div className="stage__scroll">
        <p className="stage__lead">
          발전소에서 수용가까지 전기가 흐르는 순서대로 기기를 나눴습니다. 카드를 누르면 계통맵과 같은 상세 정보가 열립니다.
        </p>

        {isMobile && (
          <div className="stage__tabs" role="tablist" aria-label="단계">
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
                {c.label} <span className="stage__tab-n">{c.owned}/{c.total}</span>
              </button>
            ))}
          </div>
        )}

        <div className="stage__grid">
          {columns.map((c) => (
            <Column key={c.id} col={c} render={render} />
          ))}
        </div>

        {board.monitoring.length > 0 && (
          <section className="stage__mon" aria-labelledby="stage-mon-title" data-testid="stage-monitoring">
            <h2 id="stage-mon-title" className="stage__mon-title">
              감시·제어{' '}
              <span className="stage__mon-sub">
                모든 단계에 걸침 · 보유 {board.monitoring.filter((e) => e.coverage === 'owned').length}/{board.monitoring.length}
              </span>
            </h2>
            <ul className="stage__mon-list">{board.monitoring.map(render)}</ul>
          </section>
        )}
      </div>
    </div>
  );
}
