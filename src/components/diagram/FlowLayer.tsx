import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useData } from '../../data/load';
import { getDiagramModel } from '../../lib/diagram/model';
import { useSelectedNodeId, useViewMode } from '../../lib/diagram/url';
import { useView } from '../../lib/diagram/view';
import { FLOW_DASH, FLOW_GAP, FLOW_PERIOD_SEC, computeFlowEdges, flowDirMap, pathMidpoint, useFlowOn } from '../../lib/diagram/flow';
import './flow.css';

/** 배율을 이 단위로 반올림해 줌 중 다시 그리기를 줄인다 */
const SCALE_STEP = 0.05;

/**
 * 전기 흐름 오버레이 — 연결선(Edges) 위에 별도 SVG 로 겹쳐 그린다. DiagramCanvas 의 `.diagram__inner` 안, `<Edges/>` 바로 뒤에 둔다.
 * `?flow=1` 일 때만, Gap 보기에서는 그리지 않는다. 움직임은 CSS stroke-dashoffset (JS 루프 없음).
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
    () => (on && mode !== 'gap' ? computeFlowEdges(model.edges, dirs, selectedId, (id) => busIds.has(id)) : []),
    [on, mode, model, dirs, selectedId, busIds],
  );

  if (!on || mode === 'gap') return null;

  // 대시·간격을 배율로 나눠 화면 크기를 고정 → 한 주기 시간도 배율과 무관
  const style = {
    '--flow-dash': `${FLOW_DASH / scale}px`,
    '--flow-gap': `${FLOW_GAP / scale}px`,
    '--flow-period': `${(FLOW_DASH + FLOW_GAP) / scale}px`,
    '--flow-duration': `${FLOW_PERIOD_SEC}s`,
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
      {flows.map((f) => (
        <path key={`t-${f.id}`} className="dflow__track" d={f.d} />
      ))}
      {flows.map((f) =>
        f.dir === 'bi' ? null : (
          <path key={f.id} className={`dflow__path${f.dir === 'reverse' ? ' dflow__path--rev' : ''}`} d={f.d} data-flow-edge={f.id} />
        ),
      )}
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
