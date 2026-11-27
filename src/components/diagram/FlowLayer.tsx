import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
/** 물방울 화면 속도(px/초) — 배율과 무관하게 화면에서 같은 빠르기 (2026-11-27 3차: 더 느리게) */
const DROP_SCREEN_SPEED_NODE = 38;
const DROP_SCREEN_SPEED_ALL = 26;
/** 짧은 선도 이보다 빨리 지나가지 않게 (초) */
const DROP_MIN_MOVE = 1.3;
/** 물방울 화면 크기(px) — 전압과 상관없이 모두 같음 (분기 기준) */
const DROP_W = 30;
const DROP_H = 9;
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
  // 선택한 제품 타일 (빛남 효과 자리)
  const selNode = selectedId ? model.nodeById.get(selectedId) : undefined;
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
    for (const a of animsRef.current) {
      if (hidden || tiny) a.pause();
      else a.play();
    }
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
    const vp = svgRef.current?.closest('.diagram__viewport');
    if (!vp) return;
    const mo = new MutationObserver(() => {
      const pause = vp.classList.contains('is-panning');
      for (const a of animsRef.current) {
        if (pause) a.pause();
        else if (!document.hidden) a.play();
      }
    });
    mo.observe(vp, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, [on, mode]);

  // 물방울: 화면 기준 속도(배율로 나눔) — 확대해도 화면에서 같은 빠르기. 짧은 선은 최소 이동 시간 + 쉬는 시간
  const dropScale = Math.max(0.35, scale);
  const fxRef = useRef<HTMLDivElement>(null);
  const drops = useMemo(() => {
    if (still || !on || mode === 'gap') return [];
    const node = !!selectedId;
    return flows
      .filter((f) => f.dir !== 'bi' && (node || idleDropIds.has(f.id)))
      .map((f) => {
        const len = pathLen(f.d);
        const speed = (node ? DROP_SCREEN_SPEED_NODE : DROP_SCREEN_SPEED_ALL) / dropScale;
        const move = Math.max(DROP_MIN_MOVE, len / speed);
        const h1 = hash01(f.id);
        const h2 = hash01(`${f.id}~`);
        const rest = (len * dropScale < 140 ? 1.2 : 0.4) + h1 * 1.6;
        return { id: f.id, d: f.d, rev: f.dir === 'reverse', node, len, move, rest, phase: h2 };
      })
      .filter((x) => x.len >= 8);
  }, [flows, selectedId, idleDropIds, dropScale, still, on, mode]);
  const runKey = selectedId ?? 'all';
  useLayoutEffect(() => {
    const box = fxRef.current;
    if (!box || !drops.length) return;
    const anims: Animation[] = [];
    const delay0 = (id: string) => Math.min(IGNITE_MAX, (order.get(id) ?? 0) * IGNITE_STEP) + 0.3;
    for (const p of drops) {
      const el = box.querySelector<HTMLElement>(`[data-flow-particle="${CSS.escape(p.id)}"]`);
      if (!el?.animate) continue;
      const T = p.move + p.rest;
      const tm = p.move / T;
      const fade = Math.min(0.08, tm / 4);
      const [a, b] = p.rev ? ['100%', '0%'] : ['0%', '100%'];
      const anim = el.animate(
        [
          { offset: 0, offsetDistance: a, opacity: 0 },
          { offset: fade, opacity: 1 },
          { offset: tm - fade, opacity: 1 },
          { offset: tm, offsetDistance: b, opacity: 0 },
          { offset: 1, offsetDistance: b, opacity: 0 },
        ] as Keyframe[],
        { duration: T * 1000, iterations: Infinity, delay: (delay0(p.id) + p.phase * T) * 1000, easing: 'linear', fill: 'backwards' },
      );
      anims.push(anim);
      // 리퀴드: 이동 구간 안에서 길이(scaleX)·두께(scaleY)가 바뀜 — 부피를 지키듯 늘면 가늘어지고 뭉치면 통통해짐
      const blob = el.firstElementChild as HTMLElement | null;
      if (blob?.animate) {
        const at = (x: number) => Math.min(0.999, x * tm);
        anims.push(
          blob.animate(
            [
              { offset: 0, transform: 'scale(0.45, 1.25)' },
              { offset: at(0.18), transform: 'scale(1.55, 0.78)' },
              { offset: at(0.5), transform: 'scale(1.15, 0.92)' },
              { offset: at(0.78), transform: 'scale(1.6, 0.76)' },
              { offset: at(1), transform: 'scale(0.5, 1.3)' },
              { offset: 1, transform: 'scale(0.5, 1.3)' },
            ],
            { duration: T * 1000, iterations: Infinity, delay: (delay0(p.id) + p.phase * T) * 1000, easing: 'ease-in-out' },
          ),
        );
      }
    }
    animsRef.current = anims;
    return () => {
      for (const x of anims) x.cancel();
      animsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drops, runKey]);
  const animsRef = useRef<Animation[]>([]);

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
    <>
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
    {/* 움직이는 효과는 SVG 밖 HTML 층 (2026-11-27 3차, 성능) — SVG 안에서 움직이면 계통도 그림 전체를 매 프레임 다시 그려 버벅임.
        물방울은 CSS offset-path + Web Animations(transform 계열이라 작은 조각만 다시 그림), 변압기 빛남은 opacity·transform 만. */}
    {!still && (
      <div className="dflow-fx" ref={fxRef} style={{ width: model.width, height: model.height }} aria-hidden="true" data-testid="flow-particles">
        {drops.map((p) => (
          <div
            key={`p-${run}-${p.id}`}
            className={`dflow-drop${p.node ? '' : ' dflow-drop--idle'}`}
            data-flow-particle={p.id}
            style={{ offsetPath: `path('${p.d}')`, offsetRotate: p.rev ? 'auto 180deg' : 'auto', width: DROP_W / dropScale, height: DROP_H / dropScale } as CSSProperties}
          >
            {/* 리퀴드 덩어리 — 출발할 때 뭉쳤다가 이동하며 길게 늘어나고, 도착하며 다시 뭉침 (2026-11-27 4차) */}
            <span className="dflow-drop__blob" />
          </div>
        ))}
        {/* 선택한 제품 빛남 (2026-11-27 사용자: 변압기 빛남 대신 선택된 제품이 빛나게) — 타일 둘레가 숨 쉬듯 은은하게 */}
        {selNode && (
          <div
            key={`sel-${run}`}
            className="dflow-selglow"
            data-testid="flow-selected-glow"
            style={{ left: selNode.x - TILE_W / 2 - 5, top: selNode.y - TILE_H / 2 - 5, width: TILE_W + 10, height: TILE_H + 10 }}
          />
        )}
      </div>
    )}
    </>
  );
}
