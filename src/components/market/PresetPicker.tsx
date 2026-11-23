import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getData } from '../../data/load';
import { COVERAGE_LABELS, LAYER_LABELS } from '../../lib/schema';
import { todayIso } from '../../lib/labels';
import { announce } from '../../lib/announce';
import { downloadText } from '../../lib/pages/catalog';
import {
  PRESET_TIERS,
  PRESET_TIER_LABELS,
  buildChecklist,
  buildPresetCsv,
  demandOf,
  getPresets,
  presetById,
  rowTierLabel,
  scenarioById,
  sourcesOf,
  type ChecklistRow,
  type Preset,
  type Scenario,
} from '../../lib/market/presets';
import { usePresetStore } from '../../lib/market/presetStore';
import { CONFIDENCE_LABELS } from '../../lib/market/source';
import SourceBadge from './SourceBadge';
import './preset.css';

/** 계통도 타일 표시용 등급 — 시나리오로만 더해진 기기는 'scenario' */
const markTier = (r: ChecklistRow) => r.tier ?? 'scenario';

let nodeEqCache: Map<string, string> | undefined;
/** 타일 node id → 기기 id (diagram.json — 참조 타일 포함) */
function nodeEqMap(): Map<string, string> {
  if (!nodeEqCache) {
    nodeEqCache = new Map();
    const d = getData();
    for (const n of [...d.diagram.nodes, ...(d.diagramDc?.nodes ?? [])]) if (n.equipmentTypeId) nodeEqCache.set(n.id, n.equipmentTypeId);
  }
  return nodeEqCache;
}

/** 계통도 타일([data-node-id])에 data-preset-* 를 단다 / 뗀다. 스타일은 preset.css */
export function markNodes(rows: ChecklistRow[] | null, root: ParentNode = document): void {
  const byEq = new Map((rows ?? []).map((r) => [r.eq.id, r]));
  const map = nodeEqMap();
  root.querySelectorAll<HTMLElement>('.dnode[data-node-id]').forEach((el) => {
    const eqId = map.get(el.dataset.nodeId ?? '');
    const r = eqId ? byEq.get(eqId) : undefined;
    if (r) {
      el.dataset.presetTier = markTier(r);
      if (r.warn) el.dataset.presetWarn = 'true';
      else delete el.dataset.presetWarn;
      if (r.scenario && r.tier) el.dataset.presetScenario = 'true';
      else delete el.dataset.presetScenario;
    } else {
      delete el.dataset.presetTier;
      delete el.dataset.presetWarn;
      delete el.dataset.presetScenario;
    }
  });
}

function Sources({ keys }: { keys: string[] }) {
  return (
    <span className="mpre__srcs">
      {sourcesOf(keys).map((s) => (
        <SourceBadge key={s.url} source={s} />
      ))}
    </span>
  );
}

function Counts({ rows }: { rows: ChecklistRow[] }) {
  const n = (t: string) => rows.filter((r) => markTier(r) === t).length;
  const scen = n('scenario');
  return (
    <p className="mpre__counts" data-testid="preset-counts">
      {PRESET_TIERS.map((t) => (
        <span key={t} className={`mpre__count mpre__count--${t}`}>
          <i aria-hidden="true" /> {PRESET_TIER_LABELS[t]} {n(t)}
        </span>
      ))}
      {scen > 0 && (
        <span className="mpre__count mpre__count--scenario">
          <i aria-hidden="true" /> 수전 방식 추가 {scen}
        </span>
      )}
    </p>
  );
}

function Checklist({ rows }: { rows: ChecklistRow[] }) {
  return (
    <table className="mpre__table">
      <thead>
        <tr>
          <th scope="col">등급</th>
          <th scope="col">기기</th>
          <th scope="col">계층</th>
          <th scope="col">보유 상태</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.eq.id} data-warn={r.warn ? 'true' : undefined}>
            <td>
              <span className={`mpre__tier mpre__tier--${markTier(r)}`}>{rowTierLabel(r)}</span>
              {r.tier && r.scenario && <span className="mpre__plus"> +수전</span>}
            </td>
            <td>
              {r.eq.name}
              {r.note && <span className="mpre__note"> · {r.note}</span>}
            </td>
            <td>{r.eq.layer}</td>
            <td className={`mpre__cov mpre__cov--${r.coverage}`}>
              {r.warn && <span aria-hidden="true">⚠ </span>}
              {COVERAGE_LABELS[r.coverage]}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A4 인쇄용 체크리스트 — 인쇄할 때만 body 에 붙는다 (preset.css @media print) */
function PrintSheet({ preset, scenario, rows }: { preset: Preset; scenario?: Scenario; rows: ChecklistRow[] }) {
  const file = getPresets();
  const keys = [...new Set([...preset.sourceKeys, ...(scenario?.sourceKeys ?? [])])];
  const demand = demandOf(preset);
  return createPortal(
    <div className="mpre-print" data-testid="preset-print">
      <h1>
        수요처 체크리스트 — {preset.label}
        {scenario ? ` · 수전 방식: ${scenario.label}` : ''}
      </h1>
      <p>
        출력 {todayIso()} · 기준 {preset.basis} · 보유 상태 = 제품맵 커버리지
      </p>
      {demand && (
        <p>
          {demand.label}: {demand.value.value}
          {demand.value.unit} ({demand.value.kind === 'forecast' ? '전망' : '실적'}, {demand.value.method}
          {demand.value.needsCheck ? ', 확인 필요' : ''})
        </p>
      )}
      {scenario && <p>{scenario.summary}</p>}
      <table>
        <thead>
          <tr>
            <th>등급</th>
            <th>계층</th>
            <th>기기</th>
            <th>보유 상태</th>
            <th>경고</th>
            <th>메모</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.eq.id}>
              <td>
                {rowTierLabel(r)}
                {r.tier && r.scenario ? ' +수전' : ''}
              </td>
              <td>
                {r.eq.layer} {LAYER_LABELS[r.eq.layer]}
              </td>
              <td>{r.eq.name}</td>
              <td>{COVERAGE_LABELS[r.coverage]}</td>
              <td>{r.warn ? '⚠ 경고' : ''}</td>
              <td>{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ol className="mpre-print__src">
        {sourcesOf(keys).map((s) => (
          <li key={s.url}>
            {s.title} · 기준 {s.asof} · {CONFIDENCE_LABELS[s.confidence]} · {s.url}
          </li>
        ))}
      </ol>
      <p className="mpre-print__note">{file.note}</p>
    </div>,
    document.body,
  );
}

/**
 * 계통도 도구줄 '수요처' 버튼 + 패널 (전력시장 토론 P0-3·P1).
 * 유형을 고르면 html[data-preset] + 타일 data-preset-tier 로 필수·이중화·선택을 강조(나머지 흐림),
 * 필수·수전 방식 기기 중 미보유·일부 보유는 ⚠. 체크리스트 CSV·A4 인쇄. 수전 방식 시나리오는 데이터센터·팹·공장만.
 */
export default function PresetPicker() {
  const presetId = usePresetStore((s) => s.presetId);
  const scenarioId = usePresetStore((s) => s.scenarioId);
  const setPreset = usePresetStore((s) => s.setPreset);
  const setScenario = usePresetStore((s) => s.setScenario);
  const clear = usePresetStore((s) => s.clear);
  const [open, setOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const file = getPresets();
  const preset = presetById(presetId);
  const scenario = preset?.scenarios ? scenarioById(scenarioId) : undefined;
  const rows = useMemo(
    () => (preset ? buildChecklist(preset, scenario, getData().equipmentTypeById) : null),
    [preset, scenario],
  );
  const warns = rows?.filter((r) => r.warn) ?? [];

  // 문서 루트 표시 + 타일 표시. 타일이 다시 그려지면(계통도 재마운트) MutationObserver 로 다시 단다
  useEffect(() => {
    const html = document.documentElement;
    if (preset) html.dataset.preset = preset.id;
    else delete html.dataset.preset;
    markNodes(rows);
    const inner = document.querySelector('.diagram__inner');
    const mo = inner && rows ? new MutationObserver(() => markNodes(rows)) : null;
    if (mo && inner) mo.observe(inner, { childList: true, subtree: true });
    return () => {
      mo?.disconnect();
      delete html.dataset.preset;
      markNodes(null);
    };
  }, [preset, rows]);

  // 바깥 클릭·Esc 로 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      btnRef.current?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  // 인쇄: 체크리스트 시트를 붙인 뒤 인쇄 대화상자 → 끝나면 뗀다
  useEffect(() => {
    if (!printing) return;
    const html = document.documentElement;
    html.dataset.printPreset = 'true';
    const done = () => {
      delete html.dataset.printPreset;
      setPrinting(false);
    };
    window.addEventListener('afterprint', done, { once: true });
    const t = setTimeout(() => {
      window.print();
    }, 50);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', done);
      delete html.dataset.printPreset;
    };
  }, [printing]);

  const choose = (p: Preset | null) => {
    if (!p) {
      clear();
      announce('수요처 강조를 해제했습니다');
      return;
    }
    setPreset(p.id);
    const list = buildChecklist(p, p.scenarios ? scenarioById(scenarioId) : undefined, getData().equipmentTypeById);
    const w = list.filter((r) => r.warn).length;
    announce(`${p.label} — 기기 ${list.length}종 강조${w ? `, 미보유·일부 보유 경고 ${w}종` : ''}`);
  };

  const exportCsv = () => {
    if (!preset || !rows) return;
    downloadText(`lse-preset-${preset.id}${scenario ? `-${scenario.id}` : ''}-${todayIso().replace(/-/g, '')}.csv`, buildPresetCsv(preset, scenario, rows));
  };

  const demand = preset ? demandOf(preset) : undefined;

  return (
    <div className="mpre" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className="dtool__btn mpre__trigger"
        data-testid="preset-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        aria-pressed={!!preset}
        title="수요처·프로젝트 유형별 필요 기기 강조"
        onClick={() => setOpen((o) => !o)}
      >
        수요처{preset ? <b className="mpre__cur"> · {preset.label}</b> : ''}
        {warns.length > 0 && (
          <span className="mpre__warnbadge" aria-label={`경고 ${warns.length}종`}>
            ⚠{warns.length}
          </span>
        )}
      </button>
      {open && (
        <div className="mpre__panel" id={panelId} role="dialog" aria-label="수요처·프로젝트 유형" data-testid="preset-panel">
          <div className="mpre__head">
            <strong>수요처·프로젝트 유형</strong>
            <button type="button" className="mpre__close" aria-label="닫기" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          <div className="mpre__seg" role="group" aria-label="수요처 유형">
            {file.presets.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={p.id === presetId}
                data-testid={`preset-${p.id}`}
                onClick={() => choose(p.id === presetId ? null : p)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset && rows && (
            <>
              <p className="mpre__basis">
                근거: {preset.basis} <Sources keys={preset.sourceKeys} />
              </p>
              {demand && (
                <p className="mpre__demand">
                  {demand.label} <b>{demand.value.value}{demand.value.unit}</b> ({demand.value.kind === 'forecast' ? '전망' : '실적'}){' '}
                  <SourceBadge source={demand.value.source} needsCheck={demand.value.needsCheck} />
                </p>
              )}

              {preset.scenarios && (
                <div className="mpre__scen">
                  <div className="mpre__seg mpre__seg--sm" role="group" aria-label="수전 방식">
                    <span className="mpre__seglabel">수전 방식</span>
                    {file.scenarios.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={s.id === scenario?.id}
                        data-testid={`scenario-${s.id}`}
                        onClick={() => setScenario(s.id === scenario?.id ? null : s.id)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  {scenario && (
                    <p className="mpre__scen-sum">
                      {scenario.summary} <Sources keys={scenario.sourceKeys} />
                    </p>
                  )}
                </div>
              )}

              <Counts rows={rows} />

              {warns.length > 0 ? (
                <div className="mpre__warns" role="note" data-testid="preset-warns">
                  <b>⚠ 필요 기기 중 자사 미보유·일부 보유 {warns.length}종</b>
                  <ul>
                    {warns.map((r) => (
                      <li key={r.eq.id}>
                        {r.eq.name} <span className={`mpre__cov mpre__cov--${r.coverage}`}>{COVERAGE_LABELS[r.coverage]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mpre__ok">필요 기기 중 미보유·일부 보유 없음</p>
              )}

              <details className="mpre__list">
                <summary>체크리스트 {rows.length}종</summary>
                <Checklist rows={rows} />
              </details>

              <div className="mpre__actions">
                <button type="button" className="dtool__btn" data-testid="preset-csv" onClick={exportCsv}>
                  CSV 저장
                </button>
                <button type="button" className="dtool__btn" data-testid="preset-print-btn" onClick={() => setPrinting(true)} disabled={printing}>
                  A4 인쇄
                </button>
                <button type="button" className="dtool__btn" data-testid="preset-clear" onClick={() => choose(null)}>
                  강조 해제
                </button>
              </div>
              <p className="mpre__foot">
                {file.note} (정리 {file.asof})
              </p>
            </>
          )}
        </div>
      )}
      {printing && preset && rows && <PrintSheet preset={preset} scenario={scenario} rows={rows} />}
    </div>
  );
}
