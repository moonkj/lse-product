import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useData } from '../../data/load';
import { getDiagramModel } from '../../lib/diagram/model';
import { useSelectedNodeId, useViewMode } from '../../lib/diagram/url';
import { useView } from '../../lib/diagram/view';
import { FLOW_DASH, FLOW_DOWN_DASH, FLOW_DOWN_GAP, FLOW_DOWN_PERIOD_SEC, FLOW_GAP, FLOW_PERIOD_SEC, IDLE_DASH, IDLE_GAP, IDLE_SPEED, VOLTAGE_WEIGHT, computeFlowEdges, flowDirMap, igniteOrder, pathMidpoint, pathPoints, useFlowOn } from '../../lib/diagram/flow';
import { TILE_H, TILE_W } from '../../lib/diagram/geometry';
import './flow.css';
import { diagramOf, getActiveGrid } from '../../lib/diagram/grid';

/** 차례 점등: 한 단계 사이 시간(초)·최대 지연 */
const IGNITE_STEP = 0.11;
const IGNITE_MAX = 1.6;
/** 빛 입자 속도 (계통도 좌표/초) — 선택 경로는 빠르고 또렷하게, 전체 흐름은 느리고 옅게 */
const PARTICLE_SPEED_NODE = 95;
const PARTICLE_SPEED_ALL = 48;
/** 처음 화면 물방울 수 */
const IDLE_DROPS = 14;
/** id → 0~1 (선마다 다른 타이밍을 늘 같게) */
const hash01 = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
};

const pathLen = (d: string) => {
  const p = pathPoints(d);
  let t = 0;
  for (let i = 0; i + 1 < p.length; i++) t += Math.hypot(p[i + 1].x - p[i].x, p[i + 1].y - p[i].y);
  return t;
};
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

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
  // 정지 판정은 반올림 전 실제 배율로 — 반올림 값은 0.15 아래로 내려가지 않아 최소 축소에서도 흐름이 계속 돌며 화면이 떨려 보였다
  // (2026-11-19 사용자: 최소로 축소하면 화면이 계속 떨림). 기기 미선택 전체 흐름은 20% 미만, 선택 경로는 12% 미만에서 멈춤
  const tinyAll = useView((s) => s.scale < 0.2);
  const tinyNode = useView((s) => s.scale < 0.12);
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);

  useEffect(() => {
    const on = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  const grid = getActiveGrid();
  const dirs = useMemo(() => flowDirMap(diagramOf(data, grid).edges), [data, grid]);
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

  // 전압 굵기: 흐름이 들어오는 쪽(전원 쪽) 끝 노드의 계층
  const layerOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of model.nodeById.values()) m.set(n.id, n.layer);
    for (const b of model.busNodes) m.set(b.id, b.layer);
    for (const e of model.endpoints) m.set(e.id, e.layer);
    return m;
  }, [model]);
  const edgeById = useMemo(() => new Map(model.edges.map((e) => [e.id, e])), [model]);
  const weightOf = (id: string, dir: string) => {
    const e = edgeById.get(id);
    if (!e) return 1;
    const src = dir === 'reverse' ? e.to : e.from;
    return VOLTAGE_WEIGHT[layerOf.get(src) ?? ''] ?? 1;
  };
  // 차례 점등 순서 — 선택이 바뀌면 다시 (key 에 선택 id 를 넣어 애니메이션 재생)
  const order = useMemo(() => {
    const yOf = (f: { d: string }) => pathPoints(f.d)[0]?.y ?? 0;
    return igniteOrder(flows, yOf, model.height, 10);
  }, [flows, model.height]);
  // 흐름이 지나가는 변압기 — 전기가 닿을 때 잠깐 빛남
  const transformers = useMemo(() => {
    if (!flows.length) return [];
    const ids = new Set<string>();
    for (const f of flows) {
      const e = edgeById.get(f.id);
      if (!e) continue;
      for (const id of [e.from, e.to]) if (model.nodeById.get(id)?.eq.category === 'transformation') ids.add(id);
    }
    return [...ids].map((id) => model.nodeById.get(id)!).filter(Boolean);
  }, [flows, edgeById, model]);
  // 처음 화면(전체 흐름)에서 물방울을 띄울 긴 간선 — 길이 상위 IDLE_DROPS 개
  const idleDropIds = useMemo(() => {
    if (selectedId) return new Set<string>();
    return new Set(
      flows
        .filter((f) => f.dir !== 'bi')
        .map((f) => ({ id: f.id, len: pathLen(f.d) }))
        .sort((a, b) => b.len - a.len)
        .slice(0, IDLE_DROPS)
        .map((x) => x.id),
    );
  }, [flows, selectedId]);
  const svgRef = useRef<SVGSVGElement>(null);
  const still = reducedMotion();
  // 탭 숨김·아주 작게 축소면 입자(SMIL)도 멈춤
  const tiny = selectedId ? tinyNode : tinyAll;
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg?.pauseAnimations) return;
    if (hidden || tiny) svg.pauseAnimations();
    else svg.unpauseAnimations();
  }, [hidden, tiny, flows]);
  // 기기 선택 경로가 있으면 부모(.diagram__inner)에 표시 → 경로 밖 연결선 흐리게 (CSS :has 대신, 성능)
  const nodeFlow = !!selectedId && flows.length > 0 && on && mode !== 'gap';
  useEffect(() => {
    const parent = svgRef.current?.parentElement;
    parent?.classList.toggle('has-node-flow', nodeFlow);
    return () => parent?.classList.remove('has-node-flow');
  }, [nodeFlow]);
  // 패닝(끌기) 중에는 입자(SMIL)도 멈춤 — CSS 애니메이션은 .is-panning 규칙이 멈춤
  useEffect(() => {
    const svg = svgRef.current;
    const vp = svg?.closest('.diagram__viewport');
    if (!svg?.pauseAnimations || !vp) return;
    const mo = new MutationObserver(() => {
      if (vp.classList.contains('is-panning')) svg.pauseAnimations();
      else if (!document.hidden) svg.unpauseAnimations();
    });
    mo.observe(vp, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, [on, mode]);

  if (!on || mode === 'gap') return null;
  const run = selectedId ?? 'all';
  const delayOf = (id: string) => Math.min(IGNITE_MAX, (order.get(id) ?? 0) * IGNITE_STEP);

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
    // 하류(role=down) 경로용 — 6/14, 같은 속도라 주기는 대시 길이에 맞춰 짧아짐
    '--flow-dash-down': `${FLOW_DOWN_DASH / scale}px`,
    '--flow-gap-down': `${FLOW_DOWN_GAP / scale}px`,
    '--flow-period-down': `${(FLOW_DOWN_DASH + FLOW_DOWN_GAP) / scale}px`,
    '--flow-duration-down': `${FLOW_DOWN_PERIOD_SEC}s`,
  } as CSSProperties;

  return (
    <svg
      ref={svgRef}
      className="dflow"
      width={model.width}
      height={model.height}
      viewBox={`0 0 ${model.width} ${model.height}`}
      aria-hidden="true"
      focusable="false"
      style={style}
      data-testid="flow-layer"
      data-scope={selectedId ? 'node' : 'all'}
      data-tiny={(selectedId ? tinyNode : tinyAll) ? 'true' : undefined}
      data-paused={hidden ? 'true' : undefined}
    >
      <defs>
        {/* 물방울 본체: 꼬리(왼쪽) 투명 → 머리(오른쪽) 밝은 하늘색 */}
        <linearGradient id="dflow-drop-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--flow-drop-tail, #1f8fe0)" stopOpacity="0" />
          <stop offset="0.55" stopColor="var(--flow-drop-mid, #3aa8f0)" stopOpacity="0.75" />
          <stop offset="1" stopColor="var(--flow-drop-head, #9be0ff)" stopOpacity="1" />
        </linearGradient>
      </defs>
      {/* 3겹 (E1 P0-2·E4 P0): 흰 바탕선(casing) → 연한 트랙 → 진한 펄스. 바탕선이 밴드·선과 흐름을 떼어 놓아 한눈에 보이게 */}
      {busPaths.map((b) => (
        <path key={`bc-${b.id}`} className="dflow__casing dflow__casing--bus" d={b.d} />
      ))}
      {flows.map((f) => (
        <path key={`c-${run}-${f.id}`} className="dflow__casing dflow__ignite" d={f.d} pathLength={1} style={{ '--vw': weightOf(f.id, f.dir), '--ig': `${delayOf(f.id)}s` } as CSSProperties} />
      ))}
      {busPaths.map((b) => (
        <path key={`bt-${b.id}`} className="dflow__track dflow__track--bus" d={b.d} />
      ))}
      {flows.map((f) => (
        <path key={`t-${run}-${f.id}`} className="dflow__track dflow__ignite" d={f.d} pathLength={1} style={{ '--vw': weightOf(f.id, f.dir), '--ig': `${delayOf(f.id)}s` } as CSSProperties} />
      ))}
      {/* 빛 번짐은 그룹 하나에만 filter (경로마다 걸면 프레임마다 다시 래스터 — E4 P0 성능). 전체 흐름(기기 미선택)이면 끔 */}
      <g className="dflow__glow">
        {busPaths.map((b) => (
          <path key={`bp-${b.id}`} className="dflow__path dflow__path--bus" d={b.d} data-flow-bus={b.id} />
        ))}
        {flows.map((f) =>
          f.dir === 'bi' ? null : (
            <path
              key={`${run}-${f.id}`}
              style={{ '--vw': weightOf(f.id, f.dir), '--ig': `${delayOf(f.id)}s` } as CSSProperties}
              className={`dflow__path${f.role === 'up' ? ' dflow__path--up' : f.role === 'down' ? ' dflow__path--down' : ''}${f.dir === 'reverse' ? ' dflow__path--rev' : ''}`}
              d={f.d}
              data-flow-edge={f.id}
              data-flow-role={f.role}
            />
          ),
        )}
      </g>
      {/* 빛 물방울 (2026-11-27 2차) — 동그라미 대신 진행 방향으로 꼬리가 가늘어지는 물방울. 점등이 끝난 뒤 출발.
          · 선 길이와 상관없이 같은 속도(짧은 선이 휙휙 지나가지 않게) + 다 지나가면 잠깐 쉼
          · 선마다 출발 시각·쉬는 시간을 다르게(id 해시) — 짧은 선들이 똑같이 움직이지 않게
          · 빛 번짐은 필터 대신 반투명 모양(확대해도 버벅이지 않게). 움직임 줄이기면 그리지 않음 */}
      {!still && (
        <g className="dflow__particles" data-testid="flow-particles">
          {flows.map((f) => {
            if (f.dir === 'bi') return null;
            const len = pathLen(f.d);
            if (len < 8) return null;
            const node = !!selectedId;
            // 전체 흐름(처음 화면)은 긴 간선 몇 개에만 물방울 (성능 — 짧은 선까지 모두 움직이면 프레임이 끊김)
            if (!node && !idleDropIds.has(f.id)) return null;
            const speed = node ? PARTICLE_SPEED_NODE : PARTICLE_SPEED_ALL;
            const move = len / speed;
            const h1 = hash01(f.id);
            const h2 = hash01(`${f.id}~`);
            // 쉬는 시간: 짧은 선일수록 길게(0.9~2.3초), 긴 선은 짧게 + 선마다 다르게
            const rest = (len < 160 ? 0.9 : 0.25) + h1 * (len < 160 ? 1.4 : 0.6);
            const T = move + rest;
            const tm = move / T;
            const fade = Math.min(0.06, tm / 4);
            const start = delayOf(f.id) + 0.3 + h2 * T;
            const rev = f.dir === 'reverse';
            // 크기: 화면에서 일정(배율로 나눔), 전압이 높을수록 조금 크게(제곱근으로 완만하게)
            const k = (Math.sqrt(weightOf(f.id, f.dir)) * (node ? 1.3 : 0.9)) / Math.max(0.5, scale);
            return (
              <g key={`p-${run}-${f.id}`} className={`dflow__comet${node ? '' : ' dflow__comet--idle'}`} data-flow-particle={f.id} opacity={0}>
                <animate attributeName="opacity" values="0;1;1;0;0" keyTimes={`0;${fade};${tm - fade};${tm};1`} dur={`${T}s`} begin={`${start}s`} repeatCount="indefinite" />
                <animateMotion path={f.d} dur={`${T}s`} begin={`${start}s`} repeatCount="indefinite" calcMode="linear" keyPoints={rev ? '1;1;0;0' : '0;0;1;1'} keyTimes={`0;0.0001;${tm};1`} rotate={rev ? 'auto-reverse' : 'auto'} />
                <g transform={`scale(${k})`}>
                  {/* 빛 번짐(반투명 큰 물방울) → 본체(그라데이션) → 앞쪽 흰 반짝임 */}
                  <path className="dflow__drop-halo" d="M5 0C5 3.6 2.8 5.6 0 5.6C-4 5.6 -10 2.4 -19 0C-10 -2.4 -4 -5.6 0 -5.6C2.8 -5.6 5 -3.6 5 0Z" />
                  <path className="dflow__drop" d="M3.4 0C3.4 2.3 1.9 3.6 0 3.6C-2.6 3.6 -6.5 1.6 -13 0C-6.5 -1.6 -2.6 -3.6 0 -3.6C1.9 -3.6 3.4 -2.3 3.4 0Z" fill="url(#dflow-drop-grad)" />
                  <ellipse className="dflow__drop-shine" cx="1.1" cy="-1.1" rx="1.3" ry="0.9" />
                </g>
              </g>
            );
          })}
        </g>
      )}
      {/* 변압기 통과 — 전기가 닿을 때 잠깐 빛남 (선택 경로만) */}
      {selectedId &&
        !still &&
        transformers.map((n) => {
          const touching = flows.filter((f) => {
            const e = edgeById.get(f.id);
            return !!e && (e.from === n.id || e.to === n.id);
          });
          const last = Math.max(0, ...touching.map((f) => delayOf(f.id)));
          return (
            <rect
              key={`tg-${run}-${n.id}`}
              className="dflow__tr-glow"
              x={n.x - TILE_W / 2 - 4}
              y={n.y - TILE_H / 2 - 4}
              width={TILE_W + 8}
              height={TILE_H + 8}
              rx={12}
              style={{ '--ig': `${last + 0.25}s` } as CSSProperties}
            />
          );
        })}
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
