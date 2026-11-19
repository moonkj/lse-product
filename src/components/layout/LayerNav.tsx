import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { COVERAGES, type Coverage, type Layer } from '../../lib/schema';
import { COVERAGE_LABELS, isMainLayer } from '../../lib/labels';
import { getDiagramModel, layerTitle, type DiagramModel } from '../../lib/diagram/model';
import { announce } from '../../lib/announce';
import { getDiagramController, useView, viewStore, type ViewState } from '../../lib/diagram/view';
import { useMediaQuery, useViewMode } from '../../lib/diagram/url';
import type { JumpState } from '../diagram/DiagramCanvas';
import './LayerNav.css';

/** 내비 짧은 이름 — 전압은 둘째 줄(데이터 voltage)로 내려 한 줄 유지 (5라운드 합의) */
const SHORT: Partial<Record<Layer, string>> = {
  L1: '초고압',
  L7: '분전반·부하',
  REN: '신재생·저장',
};
/** 연계 묶음 칩 아이콘 (E3) */
const SIDE_ICON: Partial<Record<Layer, string>> = { MON: '▣', REN: '☀' };

/** 계층 축 줄 높이 (5라운드 합의: 밴드 높이 비례, 최소 56·최대 120 / 화면 높이 700 미만은 44 고정 목록) */
export const NAV_ROW_MIN = 56;
export const NAV_ROW_MAX = 140;
const ROW_GAP = 2;

type Rect = { x: number; y: number; w: number; h: number };

/**
 * 밴드 높이 비율로 가용 높이를 나눈 줄 높이 (최소·최대로 자름).
 * 최대에 걸려 남는 높이는 줄마다 고르게 나눠 빈칸을 없앤다 (넓은 화면 1920).
 */
export function axisRowHeights(bandHeights: readonly number[], avail: number): number[] {
  const n = bandHeights.length;
  const sum = bandHeights.reduce((a, b) => a + b, 0) || 1;
  const usable = Math.max(0, avail - ROW_GAP * (n - 1));
  const rows = bandHeights.map((h) => Math.round(Math.min(NAV_ROW_MAX, Math.max(NAV_ROW_MIN, (h / sum) * usable))));
  const left = usable - rows.reduce((a, b) => a + b, 0);
  if (left <= 0 || n === 0) return rows;
  const each = Math.floor(left / n);
  return rows.map((r) => r + each);
}

const overlaps = (r: Rect, v: Pick<ViewState, 'x' | 'y' | 'w' | 'h'>) => {
  const ox = Math.min(r.x + r.w, v.x + v.w) - Math.max(r.x, v.x);
  const oy = Math.min(r.y + r.h, v.y + v.h) - Math.max(r.y, v.y);
  return ox > 0 && oy > Math.min(40, r.h * 0.1);
};

/** 지금 화면에 보이는 계층 id 목록 (원시 문자열 — useView 선택자용) */
export function visibleLayersKey(model: DiagramModel, v: Pick<ViewState, 'x' | 'y' | 'w' | 'h'>): string {
  if (v.w <= 0 || v.h <= 0) return '';
  return model.layers
    .filter((l) => {
      const r = model.layerRect.get(l.id);
      return r ? overlaps(r, v) : false;
    })
    .map((l) => l.id)
    .join(' ');
}

/** 계층별 커버리지 6상태 개수 (보유율 막대 — 범례 순서 고정) */
function layerCoverage(model: DiagramModel): Map<Layer, Record<Coverage, number>> {
  const out = new Map<Layer, Record<Coverage, number>>();
  for (const l of model.layers) out.set(l.id, Object.fromEntries(COVERAGES.map((c) => [c, 0])) as Record<Coverage, number>);
  for (const n of model.nodes) {
    const rec = out.get(n.layer);
    if (rec) rec[n.coverage] += 1;
  }
  return out;
}

function CoverageBar({ counts, className }: { counts: Record<Coverage, number>; className: string }) {
  return (
    <span className={className} aria-hidden="true">
      {COVERAGES.filter((c) => counts[c] > 0).map((c) => (
        <i key={c} className={`layer-nav__seg layer-nav__seg--${c}`} style={{ flexGrow: counts[c] }} />
      ))}
    </span>
  );
}

/**
 * 좌측 내비 = 계통도 '계층 축' (5라운드 디자이너 합의).
 * - L1~L7 줄 높이는 계통도 밴드 높이 비율, 왼쪽 세로 축선으로 잇고 지금 보이는 세로 범위를 괄호로 표시.
 * - 감시·신재생은 '연계' 묶음, 맨 아래 전체 보유 요약 카드.
 * - 모바일(≤900px)·압축 화면(app-shell--navrow)에서는 계층 칩 가로 스크롤만 보인다.
 */
export default function LayerNav() {
  const model = getDiagramModel();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onHome = pathname === '/';
  const urlMode = useViewMode();
  const mode = onHome ? urlMode : 'product';
  const gap = mode === 'gap';
  const current = useView((s) => (s.ready ? s.layer : null));
  const focus = useView((s) => (s.ready ? s.focus : null));
  const visibleKey = useView((s) => (onHome && s.ready ? visibleLayersKey(model, s) : ''));
  const visible = useMemo(() => new Set(visibleKey.split(' ').filter(Boolean)), [visibleKey]);
  const listMode = useMediaQuery('(max-height: 699px)');

  const coverage = useMemo(() => layerCoverage(model), [model]);
  const mainLayers = useMemo(() => model.layers.filter((l) => isMainLayer(l.id)), [model]);
  const sideLayers = useMemo(() => model.layers.filter((l) => !isMainLayer(l.id)), [model]);
  const totals = useMemo(() => {
    let owned = 0;
    let total = 0;
    let gaps = 0;
    for (const s of model.layerStats.values()) {
      owned += s.owned;
      total += s.total;
      gaps += s.gaps;
    }
    return { owned, total, gaps, pct: total ? Math.round((owned / total) * 100) : 0 };
  }, [model]);

  // ── 줄 높이: 사이드바 가용 높이를 밴드 높이 비율로 나눔 ──
  const navRef = useRef<HTMLElement>(null);
  const axisRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef<HTMLSpanElement>(null);
  const [rowHeights, setRowHeights] = useState<number[] | null>(null);
  const bandHeights = useMemo(() => mainLayers.map((l) => model.layerRect.get(l.id)?.h ?? 1), [model, mainLayers]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const axis = axisRef.current;
    if (!nav || !axis || listMode) {
      setRowHeights(null);
      return;
    }
    const measure = () => {
      // 칩 줄(모바일·압축)에서는 계산하지 않음
      if (nav.closest('.app-shell--navrow') || nav.clientHeight === 0) {
        setRowHeights(null);
        return;
      }
      const block = axis.parentElement!;
      const cs = getComputedStyle(nav);
      const inner = nav.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const bcs = getComputedStyle(block);
      const rowGap = parseFloat(bcs.rowGap) || 0;
      let others = 0;
      let count = 0;
      for (const el of Array.from(block.children) as HTMLElement[]) {
        if (el === axis || el.offsetParent === null) continue;
        others += el.offsetHeight;
        count += 1;
      }
      const avail = inner - others - rowGap * count;
      const next = axisRowHeights(bandHeights, avail);
      setRowHeights((prev) => (prev && prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next));
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(nav);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [bandHeights, listMode]);

  // ── 보이는 세로 범위 괄호: 계통도 y 범위를 축(줄 위치)에 구간별 선형으로 옮김. 펜·줌마다 스타일만 갱신 ──
  const updateRange = useCallback(() => {
    const axis = axisRef.current;
    const range = rangeRef.current;
    if (!axis || !range) return;
    const v = viewStore.get();
    const rows = Array.from(axis.querySelectorAll<HTMLElement>('[data-axis-row]'));
    const first = model.layerRect.get(mainLayers[0]?.id);
    const showable = onHome && v.ready && v.h > 0 && rows.length === mainLayers.length && first && v.x < first.x + first.w && v.x + v.w > first.x;
    if (!showable) {
      range.style.display = 'none';
      return;
    }
    const map = (y: number) => {
      for (let i = 0; i < mainLayers.length; i++) {
        const r = model.layerRect.get(mainLayers[i].id)!;
        const row = rows[i];
        if (y <= r.y + r.h || i === mainLayers.length - 1) {
          const t = Math.min(1, Math.max(0, (y - r.y) / r.h));
          return row.offsetTop + t * row.offsetHeight;
        }
      }
      return 0;
    };
    const top = map(v.y);
    const bottom = map(v.y + v.h);
    if (bottom - top < 1) {
      range.style.display = 'none';
      return;
    }
    range.style.display = '';
    range.style.transform = `translateY(${top.toFixed(1)}px)`;
    range.style.height = `${Math.max(8, bottom - top).toFixed(1)}px`;
  }, [model, mainLayers, onHome]);

  useEffect(() => {
    updateRange();
    return viewStore.subscribe(updateRange);
  }, [updateRange, rowHeights, listMode]);

  // ── 줄에 마우스를 올리면 계통도의 그 밴드에 계층색 테두리 (CSS: [data-hover-layer] .dband--*) ──
  const setHover = (layer: Layer | null) => {
    const root = document.documentElement;
    if (layer) root.setAttribute('data-hover-layer', layer);
    else root.removeAttribute('data-hover-layer');
  };
  useEffect(() => () => document.documentElement.removeAttribute('data-hover-layer'), []);

  // ── 범위 괄호 끌기 → 계통도 세로 이동 (centerOn, 가로 중심 유지) ──
  const axisToDiagramY = (axisY: number) => {
    const rows = Array.from(axisRef.current?.querySelectorAll<HTMLElement>('[data-axis-row]') ?? []);
    for (let i = 0; i < rows.length && i < mainLayers.length; i++) {
      const r = model.layerRect.get(mainLayers[i].id)!;
      const row = rows[i];
      if (axisY <= row.offsetTop + row.offsetHeight || i === rows.length - 1) {
        const t = Math.min(1, Math.max(0, (axisY - row.offsetTop) / (row.offsetHeight || 1)));
        return r.y + t * r.h;
      }
    }
    return 0;
  };
  const dragRef = useRef<{ id: number; grab: number } | null>(null);
  const axisPointerY = (e: React.PointerEvent) => e.clientY - (axisRef.current?.getBoundingClientRect().top ?? 0);
  const onRangeDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    const range = rangeRef.current;
    if (!range || e.button !== 0) return;
    e.preventDefault();
    const top = range.offsetTop + new DOMMatrixReadOnly(getComputedStyle(range).transform).m42;
    dragRef.current = { id: e.pointerId, grab: axisPointerY(e) - (top + range.offsetHeight / 2) };
    range.setPointerCapture(e.pointerId);
    range.classList.add('is-dragging');
  };
  const onRangeMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    const d = dragRef.current;
    const c = getDiagramController();
    if (!d || d.id !== e.pointerId || !c) return;
    const v = viewStore.get();
    c.centerOn(v.x + v.w / 2, axisToDiagramY(axisPointerY(e) - d.grab));
  };
  const onRangeUp = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (dragRef.current?.id !== e.pointerId) return;
    dragRef.current = null;
    rangeRef.current?.classList.remove('is-dragging');
    if (rangeRef.current?.hasPointerCapture(e.pointerId)) rangeRef.current.releasePointerCapture(e.pointerId);
  };

  const jump = (layer: Layer) => {
    const c = getDiagramController();
    announce(`${layerTitle(layer)} 보기`);
    if (onHome && c) c.jumpToLayer(layer);
    // 계통도가 아직 마운트되지 않았으므로 도착한 쪽(DiagramCanvas)이 마운트 시 이동
    else navigate('/', { state: { jumpTo: layer } satisfies JumpState });
  };

  const renderRow = (l: DiagramModel['layers'][number], idx: number) => {
    const s = model.layerStats.get(l.id)!;
    const isCurrent = onHome && current === l.id;
    const isFocus = onHome && focus === l.id;
    const isVisible = onHome && visible.has(l.id);
    const name = SHORT[l.id] ?? l.label;
    const main = isMainLayer(l.id);
    const h = main && rowHeights ? rowHeights[idx] : undefined;
    const cls = [
      'layer-nav__btn',
      `layer-nav__btn--${l.id.toLowerCase()}`,
      isCurrent ? 'is-current' : '',
      isFocus ? 'is-focus' : '',
      isVisible ? 'is-visible' : '',
      h !== undefined && h >= 72 ? 'is-tall' : '',
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <li key={l.id} data-axis-row={main ? '' : undefined} style={h !== undefined ? ({ '--row-h': `${h}px` } as React.CSSProperties) : undefined}>
        <button
          type="button"
          className={cls}
          data-testid={`layer-nav-${l.id}`}
          aria-current={isCurrent ? 'true' : undefined}
          onClick={() => jump(l.id)}
          onMouseEnter={() => setHover(l.id)}
          onMouseLeave={() => setHover(null)}
        >
          {/* 이름 = 화면 글자 + 보조 설명(스크린리더 전용) — aria-label 로 덮으면 화면 글자와 이름이 달라짐 (WCAG 2.5.3, 리뷰 R5) */}
          <span className="layer-nav__name">
            {main ? (
              <b className="layer-nav__code">
                {l.id}
                <span className="visually-hidden">&nbsp;</span>
              </b>
            ) : (
              <span className="layer-nav__icon" aria-hidden="true">
                {SIDE_ICON[l.id] ?? '•'}
              </span>
            )}
            <span className="layer-nav__label">{name}</span>
            {main && l.voltage && (
              <span className="layer-nav__volt">
                <span className="visually-hidden">&nbsp;</span>
                {l.voltage}
              </span>
            )}
          </span>
          <span className="visually-hidden">&nbsp;</span>
          <span className="layer-nav__count">{`${s.owned}/${s.total}`}</span>
          {/* 공백 알약 — 0이면 자리만. 읽기는 아래 보조 설명이 맡음 */}
          <span className={`layer-nav__gap${s.gaps > 0 ? ' has-gap' : ''}`} aria-hidden="true">
            {s.gaps > 0 ? `공백 ${s.gaps}` : ''}
          </span>
          <CoverageBar counts={coverage.get(l.id)!} className="layer-nav__bar" />
          <span className="visually-hidden">{` · ${l.label}, 보유 ${s.owned} / 전체 ${s.total}, 공백 ${s.gaps}`}</span>
        </button>
      </li>
    );
  };

  return (
    <nav
      ref={navRef}
      className={`layer-nav${gap ? ' layer-nav--gap' : ''}${listMode || !rowHeights ? ' layer-nav--list' : ' layer-nav--axis'}`}
      aria-label="계층 바로가기"
      data-testid="layer-nav"
    >
      <div className="nav-block">
        <h2 className="nav-section-title">
          계층 바로가기{' '}
          <span className="nav-section-title__sub" title="공백 = 미보유 + 일부 보유">
            · 보유/전체
          </span>
        </h2>
        <div
          className="layer-nav__axis"
          ref={axisRef}
          style={
            rowHeights && !listMode
              ? ({ '--rail-top': `${rowHeights[0] / 2}px`, '--rail-bottom': `${rowHeights[rowHeights.length - 1] / 2}px` } as React.CSSProperties)
              : undefined
          }
        >
          <span className="layer-nav__rail" aria-hidden="true" />
          <span
            className="layer-nav__range"
            ref={rangeRef}
            aria-hidden="true"
            title="끌어서 계통도 세로 이동"
            style={{ display: 'none' }}
            onPointerDown={onRangeDown}
            onPointerMove={onRangeMove}
            onPointerUp={onRangeUp}
            onPointerCancel={onRangeUp}
          />
          <ul className="layer-nav__list layer-nav__list--main">{mainLayers.map((l, i) => renderRow(l, i))}</ul>
        </div>
        {sideLayers.length > 0 && (
          <div className="layer-nav__side">
            <h3 className="layer-nav__group-title">연계</h3>
            <ul className="layer-nav__list layer-nav__list--side">{sideLayers.map((l, i) => renderRow(l, i))}</ul>
          </div>
        )}
        <section className="layer-nav__summary" aria-label="전체 보유 요약" data-testid="layer-nav-summary">
          <p className="layer-nav__summary-title">전체 보유</p>
          <p className="layer-nav__summary-num">
            <b>
              {totals.owned}/{totals.total}
            </b>
            종 · {totals.pct}%
          </p>
          <CoverageBar counts={model.coverageCounts} className="layer-nav__bar layer-nav__bar--summary" />
          <span className="visually-hidden">
            {COVERAGES.filter((c) => model.coverageCounts[c] > 0)
              .map((c) => `${COVERAGE_LABELS[c]} ${model.coverageCounts[c]}`)
              .join(', ')}
          </span>
          <p className="layer-nav__summary-foot">
            <span className="layer-nav__summary-gaps">
              공백 {totals.gaps}종{' '}
              <span className="layer-nav__summary-gaps-detail">
                (미보유 {model.coverageCounts.missing} · 일부 {model.coverageCounts.partial})
              </span>
            </span>
            <Link to="/gap" className="layer-nav__summary-link" data-testid="layer-nav-gap-table-link">
              공백 표 <span aria-hidden="true">→</span>
            </Link>
          </p>
        </section>
        {/* 휴대폰 세로: 헤더의 "계통도 · 공백 표" 메뉴는 검색창 자리를 위해 숨김 → 칩 줄 끝에서 공백 표로 */}
        <Link to="/gap" className="layer-nav__gaplink" data-testid="gap-table-link-mobile">
          공백 표 <span aria-hidden="true">→</span>
        </Link>
      </div>
    </nav>
  );
}
