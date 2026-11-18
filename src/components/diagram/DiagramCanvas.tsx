import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../../data/load';
import type { Layer } from '../../lib/schema';
import { TILE_H, TILE_W, getDiagramModel, layerAt, type DiagramModel } from '../../lib/diagram/model';
import { PanZoom, type Rect } from '../../lib/diagram/panzoom';
import { registerDiagramController, viewStore } from '../../lib/diagram/view';
import {
  MOBILE_QUERY,
  focusNode,
  useMediaQuery,
  useSelectNode,
  useSelectedNodeId,
  useViewMode,
  type FocusState,
  type ViewMode,
} from '../../lib/diagram/url';
import { isMainLayer, pageTitle } from '../../lib/labels';
import DiagramNode from './DiagramNode';
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

const Edges = memo(function Edges({
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
      <g className="dedges__buses">
        {model.buses.map((b) => (
          <path key={b.id} className="dbus" d={b.d} />
        ))}
      </g>
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

const Bands = memo(function Bands({ model, mode }: { model: DiagramModel; mode: ViewMode }) {
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

/** 메인 계통도: 레이어 밴드 + 엣지(SVG) + 사진 타일 노드(HTML), 줌/패닝, 선택, 보기 모드 */
export default function DiagramCanvas() {
  const data = useData();
  const model = getDiagramModel(data);
  const mode = useViewMode();
  const selectedId = useSelectedNodeId();
  const selectNode = useSelectNode();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const location = useLocation();
  const navigate = useNavigate();

  const vpRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const pzRef = useRef<PanZoom | null>(null);

  const nodeRect = useCallback(
    (id: string): Rect | undefined => {
      const n = model.nodeById.get(id);
      return n && { x: n.x - TILE_W / 2, y: n.y - TILE_H / 2, w: TILE_W, h: TILE_H };
    },
    [model],
  );

  // 엔진 생성 + 초기 뷰 (레이아웃 직후 → 첫 페인트 전에 위치가 잡힘)
  const navState = location.state as JumpState | null;
  const jumpTo = navState?.jumpTo;
  const focusTarget = navState?.focusNode;
  const initialRef = useRef({ jumpTo, selectedId, isMobile });
  useLayoutEffect(() => {
    const vp = vpRef.current;
    const sizer = sizerRef.current;
    const inner = innerRef.current;
    if (!vp || !sizer || !inner) return;
    const pz = new PanZoom(vp, sizer, inner, {
      width: model.width,
      height: model.height,
      maxScale: 2,
      onView: (v) =>
        viewStore.set({ ...v, layer: layerAt(model, v.x + v.w / 2, v.y + v.h / 2), ready: true }),
    });
    pzRef.current = pz;

    const init = initialRef.current;
    const layerRect = (l: Layer) => model.layerRect.get(l);
    if (init.jumpTo && layerRect(init.jumpTo)) pz.fitRect(layerRect(init.jumpTo)!, 1);
    else {
      pz.fitRect(init.isMobile ? INITIAL_MOBILE : INITIAL_DESKTOP, 1);
      const r = init.selectedId ? nodeRect(init.selectedId) : undefined;
      if (r && !pz.isVisible(r)) pz.centerOn(r.x + r.w / 2, r.y + r.h / 2);
    }

    const unregister = registerDiagramController({
      jumpToLayer: (l) => {
        const r = layerRect(l);
        if (r) pz.fitRect(r, 1);
      },
      fitAll: () => pz.fitAll(),
      zoomBy: (f) => pz.zoomBy(f),
      centerOn: (x, y) => pz.centerOn(x, y),
    });
    return () => {
      unregister();
      pz.destroy();
      pzRef.current = null;
      viewStore.set({ ready: false, layer: null });
    };
  }, [model, nodeRect]);

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

  // 선택이 바뀌면(검색·연결 기기 칩·URL) 화면 밖 노드를 가운데로.
  // 모바일은 하단 시트가 아래쪽을 덮으므로 시트 위 남은 영역의 가운데로 옮긴다.
  useEffect(() => {
    const pz = pzRef.current;
    const r = selectedId ? nodeRect(selectedId) : undefined;
    if (!pz || !r) return;
    const vp = vpRef.current;
    const sheet = isMobile ? document.querySelector<HTMLElement>('[data-variant="sheet"]') : null;
    if (vp && sheet) {
      const vr = vp.getBoundingClientRect();
      const visibleBottom = Math.min(vr.bottom, sheet.getBoundingClientRect().top);
      if (visibleBottom - vr.top > 60) {
        pz.placeAt(r.x + r.w / 2, r.y + r.h / 2, vr.width / 2, (visibleBottom - vr.top) / 2);
        return;
      }
    }
    if (!pz.isVisible(r)) pz.centerOn(r.x + r.w / 2, r.y + r.h / 2);
  }, [selectedId, nodeRect, isMobile]);

  const onActivate = useCallback((id: string) => selectNode(id), [selectNode]);

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
      <DiagramToolbar mode={mode} total={model.nodes.length} />
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
              {model.nodes.map((n) => (
                <DiagramNode key={n.id} item={n} mode={mode} selected={n.id === selectedId} onActivate={onActivate} />
              ))}
            </div>
          </div>
        </div>
        {!isMobile && <Minimap mode={mode} />}
      </div>
    </section>
  );
}
