import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { useData } from '../../data/load';
import type { Layer } from '../../lib/schema';
import { getDiagramModel, layerAt, type DiagramModel } from '../../lib/diagram/model';
import { TILE_H, TILE_W } from '../../lib/diagram/geometry';
import { PanZoom, type Rect } from '../../lib/diagram/panzoom';
import { getSavedView, registerDiagramController, saveView, viewStore } from '../../lib/diagram/view';
import { centerOf, isFullyVisible, measureVisibleArea } from '../../lib/diagram/viewport';
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
import Minimap from './Minimap';
import './DiagramCanvas.css';

/** 다른 페이지에서 계층 점프 시 navigate state 로 넘기는 값 */
export interface JumpState extends FocusState {
  jumpTo?: Layer;
}

/** 처음 열었을 때 보이는 영역: L4 수전설비 주회로(VCB 열) 확대 */
const INITIAL_DESKTOP: Rect = { x: 560, y: 1620, w: 900, h: 540 };
const INITIAL_MOBILE: Rect = { x: 660, y: 1640, w: 480, h: 420 };

export const Edges = memo(function Edges({
  model,
  selectedEdges,
}: {
  model: DiagramModel;
  selectedEdges: ReadonlySet<string>;
}) {
  const normal = model.edges.filter((e) => !selectedEdges.has(e.id));
  const hot = model.edges.filter((e) => selectedEdges.has(e.id));
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
        />
      ))}
    </svg>
  );
});

export const Bands = memo(function Bands({ model, mode }: { model: DiagramModel; mode: ViewMode }) {
  return (
    <>
      {model.layers.map((l) => {
        const r = model.layerRect.get(l.id)!;
        const gaps = model.layerStats.get(l.id)?.gaps ?? 0;
        const name = isMainLayer(l.id) ? `${l.id} ${l.label}` : l.label;
        const suffix = mode === 'gap' ? (gaps > 0 ? `공백 ${gaps}` : '공백 없음') : l.voltage;
        return (
          <div
            key={l.id}
            id={`layer-band-${l.id}`}
            data-testid={`layer-band-${l.id}`}
            className={`dband dband--${l.id.toLowerCase()}`}
            style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
          >
            <span className="dband__label">
              {name}
              {suffix && <span className="dband__suffix"> · {suffix}</span>}
            </span>
          </div>
        );
      })}
    </>
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
  const pinLayer = useCallback((layer: Layer | null) => {
    const pz = pzRef.current;
    if (!pz) return;
    const v = pz.view();
    pinRef.current = { layer, scale: v.scale, cx: v.x + v.w / 2, cy: v.y + v.h / 2 };
    viewStore.set({ layer });
  }, []);

  /**
   * 노드를 보이는 영역(상세 패널·하단 시트·미니맵·비교 바를 뺀 부분, 실제 DOM 크기) 안으로.
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
      if (opts.pin) pinLayer(model.nodeById.get(id)?.layer ?? null);
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
    if (!vp || !sizer || !inner) return;
    const pz = new PanZoom(vp, sizer, inner, {
      width: model.width,
      height: model.height,
      maxScale: 2,
      onView: (v) => {
        const pin = pinRef.current;
        if (pin) {
          const moved = Math.hypot(v.x + v.w / 2 - pin.cx, v.y + v.h / 2 - pin.cy) * v.scale;
          if (Math.abs(v.scale - pin.scale) > pin.scale * 0.01 || moved > PIN_RELEASE_PX) pinRef.current = null;
        }
        let layer: Layer | null;
        if (pinRef.current) layer = pinRef.current.layer;
        else {
          // 패널·시트·비교 바가 가린 부분을 뺀 "보이는 영역"의 가운데로 현재 계층을 판정
          const c = centerOf(measureVisibleArea(vp).free);
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
    } else pz.fitRect(init.isMobile ? INITIAL_MOBILE : INITIAL_DESKTOP, 1);

    const unregister = registerDiagramController({
      jumpToLayer: (l) => {
        const r = layerRect(l);
        if (!r) return;
        pz.fitRect(r, 1);
        pinLayer(l);
      },
      fitAll: () => {
        pz.fitAll();
        pinLayer(null); // 전체 보기 = 특정 계층 아님
      },
      zoomBy: (f) => pz.zoomBy(f),
      centerOn: (x, y) => pz.centerOn(x, y),
      revealNode: (id) => revealRef.current(id),
    });
    return () => {
      // 다른 화면으로 갔다가 뒤로가기로 돌아오면 이 위치를 복원
      saveView(keyRef.current, { view: pz.view(), pinned: pinRef.current ? { layer: pinRef.current.layer } : undefined });
      unregister();
      pz.destroy();
      pzRef.current = null;
      pinRef.current = null;
      viewStore.set({ ready: false, layer: null });
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

  // 키보드 포커스가 타일로 오면(Tab·Esc 복귀·검색) 보이는 영역 안으로 (패널·미니맵·비교 바 밑에 숨지 않게, B3).
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
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const onActivate = useCallback(
    (id: string) => {
      if (id === selectedRef.current) {
        focusPanelTitle();
        revealRef.current(id);
        return;
      }
      requestPanelFocus();
      selectNode(id);
    },
    [selectNode],
  );

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
        전력계통 단선결선도 {mode === 'gap' ? '(Gap 보기)' : mode === 'learn' ? '(교육 보기)' : ''}
      </h1>
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
            <div ref={innerRef} className="diagram__inner" style={{ width: model.width, height: model.height }}>
              <Bands model={model} mode={mode} />
              <Edges model={model} selectedEdges={selectedEdges} />
              <BusNodes buses={model.busNodes} />
              <EndpointNodes endpoints={model.endpoints} />
              {model.nodes.map((n) => (
                <DiagramNode key={n.id} item={n} mode={mode} selected={n.id === selectedId} onActivate={onActivate} />
              ))}
              {model.refs.map((n) => (
                <DiagramNode key={n.id} item={n} mode={mode} selected={n.id === selectedId} onActivate={onActivate} />
              ))}
              <AltBadges badges={model.altBadges} activeEdges={selectedEdges} />
            </div>
          </div>
        </div>
        {!isMobile && <Minimap mode={mode} />}
      </div>
    </section>
  );
}
