import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useData } from '../../data/load';
import { getDiagramModel } from '../../lib/diagram/model';
import { useSelectedNodeId, useViewMode } from '../../lib/diagram/url';
import { useView } from '../../lib/diagram/view';
import { FLOW_DASH, FLOW_GAP, FLOW_PERIOD_SEC, IDLE_DASH, IDLE_GAP, IDLE_SPEED, computeFlowEdges, flowDirMap, pathMidpoint, useFlowOn } from '../../lib/diagram/flow';
import './flow.css';

/** 배율을 이 단위로 반올림해 줌 중 다시 그리기를 줄인다 */
const SCALE_STEP = 0.05;

/**
 * 전기 흐름 오버레이 — 연결선(Edges) 위에 별도 SVG 로 겹쳐 그린다. DiagramCanvas 의 `.diagram__inner` 안, `<Edges/>` 바로 뒤에 둔다.
 * 기본 켜짐(`?flow=0` 이면 끔) — 기기 미선택 = 전체 전력선, 선택 = 그 상·하류. Gap 보기에서는 그리지 않는다. 움직임은 CSS stroke-dashoffset (JS 루프 없음).
 * 움직임 줄이기·인쇄 = 정지 화살표 ▸, 패닝 중·탭 숨김 = 정지.
 */
export default function FlowLayer() {
  const on = useFlowOn();
  const mode = useViewMode();
  const selectedId = useSelectedNodeId();
  const data = useData();
  const model = getDiagramModel(data);
  const scale = useView((s) => Math.max(SCALE_STEP, Math.round(s.scale / SCALE_STEP) * SCALE_STEP));
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);

  useEffect(() => {
    const on = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  const dirs = useMemo(() => flowDirMap(data.diagram.edges), [data]);
  const busIds = useMemo(() => new Set(model.busNodes.map((b) => b.id)), [model]);
  const flows = useMemo(
    // 기본 켜짐: 기기를 고르지 않으면 전체 전력선, 고르면 그 기기 상·하류만. ?flow=0 이면 끔
    () => (on && mode !== 'gap' ? computeFlowEdges(model.edges, dirs, selectedId, (id) => busIds.has(id)) : []),
    [on, mode, model, dirs, selectedId, busIds],
  );

  // 흐름이 지나가는 모선(데이터 모선은 연결선이 아니라 별도 요소) — 같은 트랙·펄스로 그림 (2026-11-19 사용자: 380V 모선만 검은색)
  const busPaths = useMemo(() => {
    if (flows.length === 0) return [];
    const byId = new Map(model.edges.map((e) => [e.id, e]));
    const touched = new Set<string>();
    for (const f of flows) {
      const e = byId.get(f.id);
      if (!e) continue;
      if (busIds.has(e.from)) touched.add(e.from);
      if (busIds.has(e.to)) touched.add(e.to);
    }
    return model.busNodes
      .filter((b) => touched.has(b.id))
      .map((b) => ({ id: b.id, d: `M${b.x - b.width / 2} ${b.y}H${b.x + b.width / 2}` }));
  }, [flows, model, busIds]);

  if (!on || mode === 'gap') return null;

  // 대시·간격을 배율로 나눠 화면 크기를 고정 → 한 주기 시간도 배율과 무관
  // 평소(기기 미선택 · 전체 흐름)는 옅고 느린 펄스만 — 짧은 대시 6/30, 초당 24px (디자이너 2라운드 E1·E4)
  const idle = !selectedId;
  const dash = idle ? IDLE_DASH : FLOW_DASH;
  const gap = idle ? IDLE_GAP : FLOW_GAP;
  const period = idle ? (IDLE_DASH + IDLE_GAP) / IDLE_SPEED : FLOW_PERIOD_SEC;
  const style = {
    '--flow-dash': `${dash / scale}px`,
    '--flow-gap': `${gap / scale}px`,
    '--flow-period': `${(dash + gap) / scale}px`,
    '--flow-duration': `${period}s`,
  } as CSSProperties;

  return (
    <svg
      className="dflow"
      width={model.width}
      height={model.height}
      viewBox={`0 0 ${model.width} ${model.height}`}
      aria-hidden="true"
      focusable="false"
      style={style}
      data-testid="flow-layer"
      data-scope={selectedId ? 'node' : 'all'}
      data-paused={hidden ? 'true' : undefined}
    >
      {/* 3겹 (E1 P0-2·E4 P0): 흰 바탕선(casing) → 연한 트랙 → 진한 펄스. 바탕선이 밴드·선과 흐름을 떼어 놓아 한눈에 보이게 */}
      {busPaths.map((b) => (
        <path key={`bc-${b.id}`} className="dflow__casing dflow__casing--bus" d={b.d} />
      ))}
      {flows.map((f) => (
        <path key={`c-${f.id}`} className="dflow__casing" d={f.d} />
      ))}
      {busPaths.map((b) => (
        <path key={`bt-${b.id}`} className="dflow__track dflow__track--bus" d={b.d} />
      ))}
      {flows.map((f) => (
        <path key={`t-${f.id}`} className="dflow__track" d={f.d} />
      ))}
      {/* 빛 번짐은 그룹 하나에만 filter (경로마다 걸면 프레임마다 다시 래스터 — E4 P0 성능). 전체 흐름(기기 미선택)이면 끔 */}
      <g className="dflow__glow">
        {busPaths.map((b) => (
          <path key={`bp-${b.id}`} className="dflow__path dflow__path--bus" d={b.d} data-flow-bus={b.id} />
        ))}
        {flows.map((f) =>
          f.dir === 'bi' ? null : (
            <path key={f.id} className={`dflow__path${f.dir === 'reverse' ? ' dflow__path--rev' : ''}`} d={f.d} data-flow-edge={f.id} />
          ),
        )}
      </g>
      {flows.map((f) => {
        const m = pathMidpoint(f.d);
        if (!m) return null;
        if (f.dir === 'bi') {
          return (
            <g key={`m-${f.id}`} className="dflow__bi" transform={`translate(${m.x} ${m.y})`} data-flow-edge={f.id}>
              <rect x={-11} y={-9} width={22} height={18} rx={4} />
              <text textAnchor="middle" dominantBaseline="central">
                ⇄
              </text>
            </g>
          );
        }
        const angle = f.dir === 'reverse' ? m.angle + 180 : m.angle;
        return <path key={`a-${f.id}`} className="dflow__arrow" d="M-5 -5L5 0L-5 5Z" transform={`translate(${m.x} ${m.y}) rotate(${angle})`} />;
      })}
    </svg>
  );
}
