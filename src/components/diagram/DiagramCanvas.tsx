import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { useData } from '../../data/load';
import type { Layer } from '../../lib/schema';
import { getDiagramModel, layerAt, type DiagramModel } from '../../lib/diagram/model';
import { TILE_H, TILE_W } from '../../lib/diagram/geometry';
import { PanZoom, type Rect } from '../../lib/diagram/panzoom';
import { getDiagramController, getSavedView, registerDiagramController, saveView, useView, viewStore } from '../../lib/diagram/view';
import { applyPrintScale } from '../../lib/diagram/print';
import { announce } from '../../lib/announce';
import { COVERAGES } from '../../lib/schema';
import { COVERAGE_LABELS } from '../../lib/labels';
import { centerOf, createVisibleAreaCache, isFullyVisible, measureVisibleArea } from '../../lib/diagram/viewport';
import {
  MOBILE_QUERY,
  focusNode,
  focusPanelTitle,
  requestPanelFocus,
  useMediaQuery,
  useSelectNode,
  useSelectedNodeId,
  useViewMode,
  type FocusState,
  type ViewMode,
} from '../../lib/diagram/url';
import { isMainLayer, pageTitle } from '../../lib/labels';
import DiagramNode from './DiagramNode';
import { AltBadges, BusNodes, EndpointNodes } from './DiagramExtras';
import DiagramToolbar from './DiagramToolbar';
import DiagramLegend from './DiagramLegend';
import FlowLayer from './FlowLayer';
import './DiagramCanvas.css';
import './sheet.css';

/** 다른 페이지에서 계층 점프 시 navigate state 로 넘기는 값 */
export interface JumpState extends FocusState {
  jumpTo?: Layer;
}

/** 모바일 첫 화면: L4 수전설비 주회로(VCB 열) 확대 — 2026-11-19 좌표 변경(x ×1.3, L2·L3 여백 −150) 뒤에도 같은 영역 */
const INITIAL_MOBILE: Rect = { x: 930, y: 1490, w: 480, h: 420 };
/**
 * 데스크톱 첫 화면 (2026-11-19 사용자 승인): 맨 위(L1)부터.
 * 폭 맞춤 배율이 INITIAL_FIT_MIN 이상이면 폭 맞춤(가운데·맨 위), 아니면 INITIAL_SCALE 로 계통도 왼쪽 위를 화면 왼쪽 위(여백 INITIAL_MARGIN)에.
 */
const INITIAL_FIT_MIN = 0.46;
const INITIAL_SCALE = 0.5;
const INITIAL_MARGIN = 24;
/** 도면 시트 틀 (E5 P0): 안쪽 여백 16px, 시트 아래 여백 72px (범례 카드 40px 가 그림 아래를 가리지 않게) — 화면 px */
const SHEET_PAD = 16;
const SHEET_BOTTOM = 72;

export const Edges = memo(function Edges({
  model,
  selectedEdges,
}: {
  model: DiagramModel;
  selectedEdges: ReadonlySet<string>;
}) {
  const normal = model.edges.filter((e) => !selectedEdges.has(e.id));
  const hot = model.edges.filter((e) => selectedEdges.has(e.id));
  // 전압 등급별 선 굵기 (E4 P1): from 기기(모선·끝점 포함)의 계층으로 판단 — L1~L2 초고압 · L6~L7 저압 · 나머지 고압
  const tierOf = useMemo(() => {
    const layerById = new Map<string, Layer>();
    for (const n of model.nodeById.values()) layerById.set(n.id, n.layer);
    for (const b of model.busNodes) layerById.set(b.id, b.layer);
    for (const p of model.endpoints) layerById.set(p.id, p.layer);
    return (from: string): 'ehv' | 'hv' | 'lv' => {
      const l = layerById.get(from);
      if (l === 'L1' || l === 'L2') return 'ehv';
      if (l === 'L6' || l === 'L7') return 'lv';
      return 'hv';
    };
  }, [model]);
  return (
    <svg
      className="dedges"
      width={model.width}
      height={model.height}
      viewBox={`0 0 ${model.width} ${model.height}`}
      aria-hidden="true"
      focusable="false"
    >
      {[...normal, ...hot].map((e) => (
        <path
          key={e.id}
          className={`dedge dedge--${e.kind}${e.far ? ' dedge--far' : ''}${selectedEdges.has(e.id) ? ' is-selected' : ''}`}
          d={e.d}
          data-testid={`diagram-edge-${e.id}`}
          data-kind={e.kind}
          data-tier={e.kind === 'signal' ? undefined : tierOf(e.from)}
        />
      ))}
    </svg>
  );
});

/** semantic zoom 경계 (P1): 이 배율 미만이면 개요 단계 — 타일 사진·보조 글자를 숨기고 점 + 약칭만 */
/** 이름표 왼쪽 여백·이름표가 차지하는 밴드 위쪽 높이(두 줄 포함) — 계통도 좌표 */
const LABEL_LEFT = 14;
const LABEL_ZONE_H = 84;
/** 계층 바로가기 최소 배율 */
const LAYER_MIN_SCALE = 0.64;
/** 이 배율 미만이면 부제를 숨기고 제목을 키운다(중간 단계) */
const MID_SCALE = 0.6;
export const OVERVIEW_SCALE = 0.45; // 디자이너 4·5라운드: 35→45% (1440 폭 맞춤 37%에서 글자 5px 문제) // 2026-11-19 사용자: 35% 아래에서만 점+약칭

export const Bands = memo(function Bands({
  model,
  mode,
  highlight = false,
}: {
  model: DiagramModel;
  mode: ViewMode;
  /** true 면 현재 계층(헤더 칩에서 고른 계층)을 상자 테두리로 표시 */
  highlight?: boolean;
}) {
  const focus = useView((s) => s.focus);
  const active = highlight ? focus : null;
  // 계통도 안 빈 영역을 누르면(끌기 아님) 그 계층을 선택 영역으로 — 왼쪽 계층을 고른 것과 같은 표시
  const downRef = useRef<{ x: number; y: number } | null>(null);
  const bandEvents = (layer: Layer) =>
    highlight
      ? {
          onPointerDown: (e: React.PointerEvent) => {
            downRef.current = { x: e.clientX, y: e.clientY };
          },
          onClick: (e: React.MouseEvent) => {
            const d = downRef.current;
            downRef.current = null;
            if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
            const c = getDiagramController();
            // 이미 선택된 영역을 다시 누르면 해제 (2026-11-19 사용자: 해제 방법이 명확하지 않음)
            if (viewStore.get().focus === layer) c?.clearSelection();
            else c?.focusLayer(layer);
          },
        }
      : {};
  // semantic zoom: 배율이 경계를 넘을 때만 다시 그림(불리언 구독) → 캔버스 안쪽 상자에 data-zoom 을 달아 CSS 로 전환.
  // 타일 74개를 React 로 다시 그리지 않는다. 관리자 캔버스(view store 미사용, ready=false)는 늘 상세 단계.
  const overview = useView((s) => s.ready && s.scale < OVERVIEW_SCALE);
  const mid = useView((s) => s.ready && s.scale < MID_SCALE);
  const probeRef = useRef<HTMLSpanElement>(null);
  // 이름표가 쓸 수 있는 최대 폭: 이름표 줄(밴드 위쪽 ~84px)에 걸린 가장 왼쪽 타일 앞까지 (2026-11-19 사용자: 이름표·타일 겹침)
  const labelMax = useMemo(() => {
    const m = new Map<string, number>();
    const tiles = [...model.nodes, ...model.refs];
    for (const l of model.layers) {
      const r = model.layerRect.get(l.id)!;
      const left = r.x + LABEL_LEFT;
      let max = r.w - LABEL_LEFT * 2;
      for (const t of tiles) {
        const tl = t.x - TILE_W / 2 - 8; // 여백 (배지는 2026-11-19부터 타일 안쪽)
        const tt = t.y - TILE_H / 2 - 6;
        const tb = t.y + TILE_H / 2;
        if (tl < r.x || tl > r.x + r.w || tb < r.y || tt > r.y + LABEL_ZONE_H) continue;
        if (tl > left) max = Math.min(max, tl - left);
      }
      m.set(l.id, Math.max(120, max));
    }
    return m;
  }, [model]);
  useLayoutEffect(() => {
    const host = probeRef.current?.parentElement;
    if (!host) return;
    host.dataset.zoom = overview ? 'overview' : mid ? 'mid' : 'detail';
  }, [overview, mid]);
  return (
    <>
      <span ref={probeRef} hidden aria-hidden="true" />
      {model.layers.map((l) => {
        const r = model.layerRect.get(l.id)!;
        const s = model.layerStats.get(l.id);
        const gaps = s?.gaps ?? 0;
        const main = isMainLayer(l.id);
        const name = main ? `${l.id} ${l.label}` : l.label;
        // 이름표 "L4 수전설비 · 22.9kV · 10/13" (보유/전체). Gap 보기는 공백 수를 덧붙인다
        const meta = [l.voltage, s && s.total > 0 ? `${s.owned}/${s.total}` : undefined, mode === 'gap' ? (gaps > 0 ? `공백 ${gaps}` : '공백 없음') : undefined]
          .filter(Boolean)
          .join(' · ');
        // 2톤 교차: 주 계층 L1~L7 은 홀수 a · 짝수 b, 감시·신재생(사이드)은 옅은 블루 1톤
        const tone = main ? (Number(l.id.slice(1)) % 2 === 1 ? 'a' : 'b') : 'side';
        return (
          <div
            key={l.id}
            id={`layer-band-${l.id}`}
            data-testid={`layer-band-${l.id}`}
            className={`dband dband--${l.id.toLowerCase()} dband--tone-${tone}${active === l.id ? ' is-active' : ''}`}
            data-active={active === l.id ? 'true' : undefined}
            style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
            {...bandEvents(l.id)}
          >
            <span className="dband__label" style={{ maxWidth: labelMax.get(l.id) }}>
              <span className="dband__name">{name}</span>
              {meta && <span className="dband__suffix">· {meta}</span>}
            </span>
          </div>
        );
      })}
    </>
  );
});

/**
 * 계층 칩으로 고른 계층 강조 (마켓뉴스 카드 선택 방식): 그 계층 둘레에 굵은 파란 상자,
 * 나머지 영역은 반투명 덮개로 흐리게. 덮개는 클릭을 막지 않는다(pointer-events: none).
 */
const FocusOverlay = memo(function FocusOverlay({ model }: { model: DiagramModel }) {
  const focus = useView((s) => s.focus);
  const r = focus ? model.layerRect.get(focus) : undefined;
  if (!r) return null;
  const W = model.width;
  const H = model.height;
  const veils = [
    { left: 0, top: 0, width: W, height: r.y },
    { left: 0, top: r.y + r.h, width: W, height: Math.max(0, H - r.y - r.h) },
    { left: 0, top: r.y, width: r.x, height: r.h },
    { left: r.x + r.w, top: r.y, width: Math.max(0, W - r.x - r.w), height: r.h },
  ];
  return (
    <div className="dfocus" data-testid="layer-focus" data-layer={focus} aria-hidden="true">
      {veils.map((v, i) => (v.width > 0 && v.height > 0 ? <div key={i} className="dfocus__veil" style={v} /> : null))}
    </div>
  );
});


/** 기기를 열 때 이보다 작은 배율(전체 보기 ≈ 18%)이면 타일 글자를 읽을 수 있는 배율로 확대 (UX 토론 B2) */
const READABLE_MIN_SCALE = 0.6;
const READABLE_SCALE = 0.8;
/** 계층 고정을 풀 이동량: 배율 1% 넘게 바뀌거나 가운데가 화면에서 24px 넘게 움직이면 사용자가 옮긴 것 */
const PIN_RELEASE_PX = 24;

interface Pin {
  layer: Layer | null;
  scale: number;
  cx: number;
  cy: number;
}

/** 메인 계통도: 레이어 밴드 + 엣지(SVG) + 모선·끝점 + 사진 타일 노드(HTML, 참조 타일 포함) + 택1 배지, 줌/패닝, 선택, 보기 모드 */
export default function DiagramCanvas() {
  const data = useData();
  const model = getDiagramModel(data);
  const mode = useViewMode();
  const selectedId = useSelectedNodeId();
  const selectNode = useSelectNode();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const location = useLocation();
  const navType = useNavigationType();
  const navigate = useNavigate();

  const vpRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const pzRef = useRef<PanZoom | null>(null);
  /**
   * 현재 계층 고정 — 계층 점프·전체 보기·기기 선택 직후에는 화면 가운데 대신 그 계층을 현재 계층으로 보인다.
   * (L1 처럼 위쪽 끝 계층은 스크롤 한계 때문에 화면 가운데가 L2 에 걸려 "L2"로 잘못 표시되던 문제, B2)
   * 사용자가 화면을 옮기면 풀린다.
   */
  const pinRef = useRef<Pin | null>(null);
  /** 지금 보이는 기록 항목 — 보기 저장 키 */
  const keyRef = useRef(location.key);
  /** 마지막으로 화면을 맞춘 선택 — undefined = 엔진을 새로 만들어 아직 맞추지 않음 */
  const lastSelRef = useRef<string | null | undefined>(undefined);

  const nodeRect = useCallback(
    (id: string): Rect | undefined => {
      const n = model.nodeById.get(id);
      return n && { x: n.x - TILE_W / 2, y: n.y - TILE_H / 2, w: TILE_W, h: TILE_H };
    },
    [model],
  );

  /** 현재 보기를 기준으로 계층 고정 */
  const pinLayer = useCallback((layer: Layer | null, focus = false) => {
    const pz = pzRef.current;
    if (!pz) return;
    const v = pz.view();
    pinRef.current = { layer, scale: v.scale, cx: v.x + v.w / 2, cy: v.y + v.h / 2 };
    viewStore.set({ layer, focus: focus ? layer : null });
  }, []);

  /**
   * 노드를 보이는 영역(상세 패널·하단 시트·비교 바를 뺀 부분, 실제 DOM 크기) 안으로.
   * 이미 다 보이면 움직이지 않는다. zoom = 너무 축소돼 있으면 읽을 수 있는 배율까지 확대.
   */
  const revealNode = useCallback(
    (id: string, opts: { zoom?: boolean; pin?: boolean } = {}) => {
      const pz = pzRef.current;
      const vp = vpRef.current;
      const r = nodeRect(id);
      if (!pz || !vp || !r) return;
      const va = measureVisibleArea(vp);
      // 오른쪽·아래 덮개만큼 스크롤 여백 → 계통도 끝자락 타일도 덮개 밖으로 올릴 수 있다
      pz.setInsets(vp.clientWidth - (va.free.x + va.free.w), vp.clientHeight - (va.free.y + va.free.h));
      const zoom = !!opts.zoom && pz.scale < READABLE_MIN_SCALE;
      if (zoom || !isFullyVisible(pz.toScreen(r), va)) {
        const c = centerOf(va.free);
        pz.placeAt(r.x + r.w / 2, r.y + r.h / 2, c.x, c.y, zoom ? READABLE_SCALE : undefined);
      }
      if (opts.pin) pinLayer(model.nodeById.get(id)?.layer ?? null, true); // 기기 선택 = 그 계층도 선택 영역으로 표시
    },
    [model, nodeRect, pinLayer],
  );
  const revealRef = useRef(revealNode);
  revealRef.current = revealNode;

  // 엔진 생성 + 초기 뷰 (레이아웃 직후 → 첫 페인트 전에 위치가 잡힘)
  const navState = location.state as JumpState | null;
  const jumpTo = navState?.jumpTo;
  const focusTarget = navState?.focusNode;
  const initialRef = useRef({ jumpTo, isMobile });
  useLayoutEffect(() => {
    const vp = vpRef.current;
    const sizer = sizerRef.current;
    const inner = innerRef.current;
    const sheet = sheetRef.current;
    if (!vp || !sizer || !inner || !sheet) return;
    // 보이는 영역은 덮개 크기가 바뀔 때만 다시 잰다 (onView 는 팬·핀치 프레임마다 불림 — 리뷰 R3)
    const visible = createVisibleAreaCache(vp);
    const pz = new PanZoom(vp, sizer, inner, {
      width: model.width,
      height: model.height,
      maxScale: 2,
      frame: { el: sheet, pad: SHEET_PAD, bottom: SHEET_BOTTOM },
      onView: (v) => {
        const pin = pinRef.current;
        if (pin) {
          const moved = Math.hypot(v.x + v.w / 2 - pin.cx, v.y + v.h / 2 - pin.cy) * v.scale;
          if (Math.abs(v.scale - pin.scale) > pin.scale * 0.01 || moved > PIN_RELEASE_PX) {
            pinRef.current = null;
            viewStore.set({ focus: null });
          }
        }
        let layer: Layer | null;
        if (pinRef.current) layer = pinRef.current.layer;
        else {
          // 패널·시트·비교 바가 가린 부분을 뺀 "보이는 영역"의 가운데로 현재 계층을 판정
          const c = centerOf(visible.get().free);
          layer = layerAt(model, v.x + c.x / v.scale, v.y + c.y / v.scale);
        }
        viewStore.set({ ...v, layer, ready: true });
      },
    });
    pzRef.current = pz;
    lastSelRef.current = undefined; // 엔진을 다시 만들면(StrictMode 재실행·재마운트) 선택 기기로 다시 맞춘다

    const init = initialRef.current;
    const layerRect = (l: Layer) => model.layerRect.get(l);
    if (init.jumpTo && layerRect(init.jumpTo)) {
      pz.fitRect(layerRect(init.jumpTo)!, 1);
      pinLayer(init.jumpTo);
    } else if (init.isMobile) pz.fitRect(INITIAL_MOBILE, 1);
    else if (pz.fitWidthScale() >= INITIAL_FIT_MIN) pz.fitWidth();
    else pz.placeAt(0, 0, INITIAL_MARGIN, INITIAL_MARGIN, INITIAL_SCALE);

    const unregister = registerDiagramController({
      jumpToLayer: (l) => {
        const r = layerRect(l);
        if (!r) return;
        pz.fitRect(r, 1);
        // 폭을 1.3배로 펼친 뒤 계층 전체를 맞추면 51%로 떨어져 글자가 안 읽힘 → 최소 64%, 계층 왼쪽 위부터 (디자이너 3라운드 E5)
        if (pz.scale < LAYER_MIN_SCALE) pz.placeAt(r.x, r.y, 24, 24, LAYER_MIN_SCALE);
        pinLayer(l, true); // 계층 칩 = 그 계층을 상자로 표시
      },
      fitAll: () => {
        pz.fitAll();
        pinLayer(null); // 전체 보기 = 특정 계층 아님
      },
      fitWidth: () => {
        pz.fitWidth();
        pinLayer(null); // 폭 맞춤 = 특정 계층 아님
      },
      zoomBy: (f) => pz.zoomBy(f),
      centerOn: (x, y) => pz.centerOn(x, y),
      revealNode: (id) => revealRef.current(id),
      focusLayer: (l) => pinLayer(l, true),
      clearSelection: () => {
        pinRef.current = null;
        viewStore.set({ focus: null });
        selectRef.current(null);
        announce('선택 해제');
      },
    });
    return () => {
      // 다른 화면으로 갔다가 뒤로가기로 돌아오면 이 위치를 복원
      saveView(keyRef.current, { view: pz.view(), pinned: pinRef.current ? { layer: pinRef.current.layer } : undefined });
      unregister();
      pz.destroy();
      visible.destroy();
      pzRef.current = null;
      pinRef.current = null;
      viewStore.set({ ready: false, layer: null, focus: null });
    };
  }, [model, pinLayer]);

  // 사진 지연 로딩: 계통도 viewport 기준으로 화면 근처(여백 300px)에 들어온 타일만 src 지정.
  // (네이티브 loading="lazy" 는 문서 기준 거리 임계값이 커서 스크롤 컨테이너 안 74개를 한 번에 받아 버림)
  useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    const imgs = [...vp.querySelectorAll<HTMLImageElement>('img[data-src]')];
    const load = (img: HTMLImageElement) => {
      if (img.dataset.src && !img.getAttribute('src')) img.src = img.dataset.src;
    };
    if (typeof IntersectionObserver === 'undefined') {
      imgs.forEach(load);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          load(e.target as HTMLImageElement);
          io.unobserve(e.target);
        }
      },
      { root: vp, rootMargin: '300px' },
    );
    imgs.forEach((img) => io.observe(img));
    return () => io.disconnect();
  }, [model]);

  useEffect(() => {
    document.title = pageTitle();
  }, []);

  // 다른 페이지에서 계층 점프·검색 선택으로 들어온 경우: 화면 전환이 끝난(커밋 후) 지금 노드로 포커스,
  // 뒤로가기 시 반복되지 않게 state 제거
  useEffect(() => {
    if (!jumpTo && !focusTarget) return;
    if (focusTarget) focusNode(focusTarget);
    navigate(location.pathname + location.search, { replace: true, state: null });
  }, [jumpTo, focusTarget, navigate, location.pathname, location.search]);

  // 기록 항목이 바뀔 때(선택·뒤로가기): 뒤로가기(POP)로 온 항목이면 그때 보기를 복원,
  // 아니면 선택이 바뀐 경우 그 노드로 이동(+너무 축소돼 있으면 확대) 후 현재 계층 = 그 노드 계층.
  // 레이아웃 직후에 실행 → 하단 시트가 이미 그려져 있어 실제 크기로 보이는 영역을 잰다.
  useLayoutEffect(() => {
    const pz = pzRef.current;
    if (!pz) return;
    keyRef.current = location.key;
    const saved = navType === 'POP' ? getSavedView(location.key) : undefined;
    if (saved) {
      lastSelRef.current = selectedId;
      pz.restore(saved.view);
      if (saved.pinned) pinLayer(saved.pinned.layer);
      return;
    }
    if (lastSelRef.current === selectedId) return;
    lastSelRef.current = selectedId;
    if (selectedId) revealNode(selectedId, { zoom: true, pin: true });
  }, [location.key, navType, selectedId, revealNode, pinLayer]);

  // 화면 이동이 생길 때마다 이 기록 항목의 보기를 저장 (같은 화면 안에서 뒤로가기 → 위치 복원)
  useEffect(
    () =>
      viewStore.subscribe(() => {
        const pz = pzRef.current;
        if (!pz || !viewStore.get().ready) return;
        saveView(keyRef.current, { view: pz.view(), pinned: pinRef.current ? { layer: pinRef.current.layer } : undefined });
      }),
    [],
  );

  // 키보드 포커스가 타일로 오면(Tab·Esc 복귀·검색) 보이는 영역 안으로 (패널·비교 바 밑에 숨지 않게, B3).
  // 마우스로 누른 포커스는 제외 (:focus-visible) — 드래그 시작 시 화면이 튀지 않게.
  // Home/End: 브라우저 기본 동작은 계통도를 맨 위/아래로 스크롤해 포커스 타일이 화면 밖에 남음(B4)
  //  → 첫/마지막 타일로 포커스를 옮기고 보이게 한다.
  useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    let raf = 0;
    const tileOf = (t: EventTarget | null) => (t instanceof HTMLElement ? t.closest<HTMLElement>('.dnode[data-node-id]') : null);
    const onFocusIn = (e: FocusEvent) => {
      const tile = tileOf(e.target);
      if (!tile) return;
      let keyboard = true;
      try {
        keyboard = tile.matches(':focus-visible');
      } catch {
        /* :focus-visible 미지원 */
      }
      if (!keyboard) return;
      cancelAnimationFrame(raf);
      // 브라우저 기본 스크롤(scrollIntoView)이 끝난 뒤 판정
      raf = requestAnimationFrame(() => revealRef.current(tile.dataset.nodeId!));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key !== 'Home' && e.key !== 'End') || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (!tileOf(e.target)) return;
      const tiles = vp.querySelectorAll<HTMLElement>('.dnode[data-node-id]');
      const next = e.key === 'Home' ? tiles[0] : tiles[tiles.length - 1];
      if (!next) return;
      e.preventDefault();
      next.focus({ preventScroll: true });
      revealRef.current(next.dataset.nodeId!);
    };
    vp.addEventListener('focusin', onFocusIn);
    vp.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      vp.removeEventListener('focusin', onFocusIn);
      vp.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // 타일 선택(클릭·Enter) → 상세 패널 제목으로 포커스 (B4: Tab 51회 → 0회). 이미 선택된 타일이면 바로 이동
  const selectRef = useRef(selectNode);
  selectRef.current = selectNode;
  // Esc: 선택 영역·기기 선택 해제 (패널 Esc 처리 뒤에도 영역 표시가 남아 있으면 마저 해제)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !viewStore.get().focus) return;
      getDiagramController()?.clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const onActivate = useCallback(
    (id: string, via: 'pointer' | 'keyboard' = 'pointer') => {
      if (id === selectedRef.current) {
        // 2026-11-19 사용자: 활성화된 기기를 다시 클릭하면 해제 — 패널은 레일로 접히고 선택 영역 표시도 해제.
        // 키보드(Enter·Space)는 기존대로 상세 패널 제목으로 이동 (B4)
        if (via === 'pointer') {
          selectNode(null);
          viewStore.set({ focus: null });
          announce('선택 해제');
          return;
        }
        focusPanelTitle();
        revealRef.current(id);
        return;
      }
      requestPanelFocus();
      selectNode(id);
    },
    [selectNode],
  );

  // 인쇄: 계통도 전체가 한 장에 들어가는 배율을 인쇄 직전에 반영 (툴바 "인쇄" 버튼·Ctrl/Cmd+P 모두)
  useEffect(() => {
    const before = () => applyPrintScale(model.width, model.height);
    window.addEventListener('beforeprint', before);
    return () => window.removeEventListener('beforeprint', before);
  }, [model.width, model.height]);

  const selectedEdges = useMemo<ReadonlySet<string>>(
    () => new Set(selectedId ? (model.edgesByNode.get(selectedId) ?? []) : []),
    [model, selectedId],
  );

  return (
    <section
      className={`diagram diagram--${mode}`}
      aria-labelledby="diagram-title"
      data-testid="diagram"
      data-view-mode={mode}
    >
      <h1 id="diagram-title" className="visually-hidden">
        전력계통 단선결선도 {mode === 'gap' ? '(Gap 보기)' : ''}
      </h1>
      <div className="dprint-head" aria-hidden="true">
        <strong>LS ELECTRIC 전력계통 제품맵{mode === 'gap' ? ' · Gap 보기' : ''}</strong>
        <span>기기 {model.nodes.length}종 · {new Date().toLocaleDateString('ko-KR')} 인쇄</span>
        <span className="dprint-head__legend">
          {COVERAGES.map((c) => (
            <span key={c} className="dprint-head__item">
              <i className={`dprint-head__sw cov-badge--${c}`} />
              {COVERAGE_LABELS[c]} {model.coverageCounts[c]}
            </span>
          ))}
        </span>
      </div>
      <DiagramToolbar mode={mode} total={model.nodes.length} review={data.diagram.review} />
      <div className="diagram__stage">
        <div
          ref={vpRef}
          id="diagram-viewport"
          className="diagram__viewport"
          tabIndex={-1}
          role="group"
          aria-label="계통도 — 드래그로 이동, 휠로 확대·축소. Tab 으로 기기 이동, Enter 로 선택"
        >
          <div ref={sizerRef} className="diagram__sizer">
            {/* 도면 시트 틀 — 위치·크기는 PanZoom 이 배율에 맞춰 넣는다 (테두리·그림자는 배율과 무관하게 1px) */}
            <div ref={sheetRef} className="diagram__sheet" data-testid="diagram-sheet" aria-hidden="true" />
            <div ref={innerRef} className="diagram__inner" style={{ width: model.width, height: model.height }}>
              <Bands model={model} mode={mode} highlight />
              <Edges model={model} selectedEdges={selectedEdges} />
              <BusNodes buses={model.busNodes} />
              {/* 흐름은 모선 위·타일 아래 (2026-11-19 사용자: 흐름이 검은 모선 아래로 지나감) */}
              <FlowLayer />
              <EndpointNodes endpoints={model.endpoints} />
              {model.nodes.map((n) => (
                <DiagramNode key={n.id} item={n} mode={mode} selected={n.id === selectedId} onActivate={onActivate} />
              ))}
              {model.refs.map((n) => (
                <DiagramNode key={n.id} item={n} mode={mode} selected={n.id === selectedId} onActivate={onActivate} />
              ))}
              <AltBadges badges={model.altBadges} activeEdges={selectedEdges} />
              <FocusOverlay model={model} />
            </div>
          </div>
        </div>
        <DiagramLegend mode={mode} />
      </div>
    </section>
  );
}
