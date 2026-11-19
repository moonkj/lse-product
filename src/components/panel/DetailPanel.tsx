import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import type { Coverage, Product } from '../../lib/schema';
import { docsByProductId } from '../../data/load';
import { CATEGORY_LABELS, COVERAGE_LABELS, gapConfidence, isGapCoverage } from '../../lib/labels';
import { getDiagramModel, layerTitle } from '../../lib/diagram/model';
import { productsForEquipment } from '../../lib/pages/catalog';
import {
  MOBILE_QUERY,
  PANEL_TITLE_ID,
  focusNode,
  focusPanelTitle,
  requestPanelFocus,
  takePanelFocusRequest,
  useMediaQuery,
  useSelectNode,
  useSelectedNodeId,
  useViewMode,
  type PanelHistoryState,
} from '../../lib/diagram/url';
import { getDiagramController } from '../../lib/diagram/view';
import { announce } from '../../lib/announce';
import { useCompactState } from '../layout/shellLayout';
import { useUiStore } from '../../store/useUiStore';
import { overviewParts } from '../../lib/overview';
import CoverageBadge from '../common/CoverageBadge';
import CompareToggle from '../compare/CompareToggle';
import { ButtonLink } from '../common/Button';
import DocsList from '../common/DocsList';
import EmptyProducts from '../common/EmptyProducts';
import GapAssessmentSection from './GapAssessmentSection';
import GapSections from './GapSections';
import NeighborChips from './NeighborChips';
import PanelHero from './PanelHero';
import EquipmentOverview from '../common/EquipmentOverview';
import ProductVisual, { hasProductPhoto } from '../pages/ProductVisual';
import './DetailPanel.css';

const MAX_PRODUCTS = 8;

/** 패널 헤더 커버리지 문구 */
function pillText(coverage: Coverage, productCount: number, confirmed: boolean): string {
  if (coverage === 'missing') return confirmed ? '미보유 · 공백 확정' : '미보유 · 공백 후보';
  const base = COVERAGE_LABELS[coverage];
  return productCount > 0 && (coverage === 'owned' || coverage === 'partial') ? `${base} · 제품 ${productCount}개` : base;
}

/** gapNote 라벨: 상태에 맞게 (보유 기기 메모에 "공백"이 붙지 않게) */
const NOTE_LABELS: Partial<Record<Coverage, string>> = { partial: '일부 보유 메모', missing: '공백 메모' };

/** 기록 항목(location.key)별 패널 스크롤 위치 — 제품 페이지 등에서 뒤로가기로 돌아오면 복원 (B5). 최근 100개만 (리뷰 S7) */
const panelScroll = new Map<string, number>();
const MAX_PANEL_SCROLL = 100;
function savePanelScroll(key: string, top: number) {
  panelScroll.delete(key);
  panelScroll.set(key, top);
  if (panelScroll.size > MAX_PANEL_SCROLL) panelScroll.delete(panelScroll.keys().next().value!);
}

/**
 * 접힌 하단 시트의 실제 높이를 CSS 변수 --sheet-h 로 내보낸다 (문서 루트). 비교 바(Compare.css)가 시트 바로 위에 붙도록
 * — 접힌 시트 높이는 요약 내용에 맞춰 바뀐다(상한 --sheet-collapsed-h). ResizeObserver 가 없으면 CSS 기본값(상한).
 */
function useSheetHeightVar(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    if (!active || !el) return;
    const apply = () => root.style.setProperty('--sheet-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    apply();
    const RO = globalThis.ResizeObserver;
    const ro = RO ? new RO(apply) : undefined;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty('--sheet-h');
    };
  }, [ref, active]);
}

/** 자료를 보여줄 대표 제품: 자료가 있는 첫 제품, 없으면 첫 제품 */
function representative(products: Product[]): Product | undefined {
  return products.find((p) => (docsByProductId(p.id)?.docs.length ?? 0) > 0) ?? products[0];
}

/**
 * 모바일 하단 시트 3단 (P1): peek = 요약(머리글·설명 1~2줄), half = 화면 반, full = 전체(88dvh).
 * 기록 항목 state.sheet 에 남긴다 — 'half' | 'expanded'(= full, 기존 값 호환). 없으면 peek.
 */
type SheetSize = 'peek' | 'half' | 'full';
type SheetHistoryState = Omit<PanelHistoryState, 'sheet'> & { sheet?: 'expanded' | 'half' };
const SHEET_NEXT: Record<SheetSize, SheetSize> = { peek: 'half', half: 'full', full: 'peek' };
const SHEET_TOGGLE_TEXT: Record<SheetSize, string> = { peek: '더 보기', half: '전체 보기', full: '시트 줄이기' };
const SHEET_SIZE_NAME: Record<SheetSize, string> = { peek: '요약', half: '반', full: '전체' };

/**
 * 패널 고정 버튼 줄의 "비교에 담기 ↔ ✓ 담김 n/4" (P1). 누르면 빼기, 상태는 aria-pressed.
 * testid 는 공용 CompareToggle 과 같은 compare-toggle-{기기id} (E2E 호환).
 */
function PanelCompareButton({ id, name, className = '' }: { id: string; name: string; className?: string }) {
  // 공용 CompareToggle(C 담당, Button secondary)로 통일 — 모양·문구("✓ 담김 n/4")·testid 동일
  return <CompareToggle kind="equipment" id={id} name={name} className={`cmp-toggle--sm dp-compare${className ? ` ${className}` : ''}`} />;
}

/** 설명: 기본 1줄 요약, "펼치기"로 요약 전문 + 항목 (P1 패널 순서 — 맨 아래) */
function PanelDescription({ eq }: { eq: Parameters<typeof EquipmentOverview>[0]['eq'] }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const { summary, points } = overviewParts(eq);
  const canExpand = points.length > 0 || summary.length > 40;
  return (
    <section className="dp-section dp-descsec" aria-labelledby="dp-desc-title">
      <div className="dp-descsec__head">
        <h3 id="dp-desc-title" className="dp-label">
          설명
        </h3>
        {canExpand && (
          <button
            type="button"
            className="dp-desc-toggle"
            aria-expanded={open}
            aria-controls={bodyId}
            data-testid="detail-desc-toggle"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? '접기' : '펼치기'}
          </button>
        )}
      </div>
      <div className="dp-overview" id={bodyId} data-collapsed={canExpand && !open ? 'true' : 'false'}>
        <EquipmentOverview eq={eq} className="dp-desc" testId="detail-desc" />
      </div>
    </section>
  );
}

/**
 * 빈 상세 패널 (넓은 화면). 기본은 오른쪽 레일("‹ 상세") — 누르면 빈 안내 패널을 펼치고 제목으로 포커스,
 * 안내 패널의 "접기"는 레일로 되돌리고 포커스를 레일 버튼으로 (P0-8).
 */
function EmptyPanel() {
  const open = useUiStore((s) => s.emptyPanelOpen);
  const setOpen = useUiStore((s) => s.setEmptyPanelOpen);
  const pending = useRef<'title' | 'rail' | null>(null);
  useLayoutEffect(() => {
    const target = pending.current;
    pending.current = null;
    if (target === 'title') focusPanelTitle();
    else if (target === 'rail') document.querySelector<HTMLElement>('[data-testid="panel-rail-open"]')?.focus({ preventScroll: true });
  }, [open]);

  if (!open) {
    return (
      <div className="detail-panel-rail" data-testid="panel-rail">
        <button
          type="button"
          className="detail-panel-rail__btn"
          aria-expanded={false}
          aria-label="상세 정보 창 열기"
          title="상세 정보 창 열기"
          data-testid="panel-rail-open"
          onClick={() => {
            pending.current = 'title';
            setOpen(true);
          }}
        >
          <span aria-hidden="true">‹</span>
          <span className="detail-panel-rail__label" aria-hidden="true">
            상세
          </span>
        </button>
      </div>
    );
  }
  return (
    <aside className="detail-panel detail-panel--empty detail-panel--side" aria-labelledby={PANEL_TITLE_ID} data-testid="detail-panel-empty">
      <div className="dp-head">
        <h2 id={PANEL_TITLE_ID} className="dp-empty-title" tabIndex={-1}>
          상세 정보
        </h2>
        <button
          type="button"
          className="dp-close"
          aria-label="상세 정보 창 접기"
          title="접기"
          aria-expanded
          data-testid="panel-rail-close"
          onClick={() => {
            pending.current = 'rail';
            setOpen(false);
          }}
        >
          ›
        </button>
      </div>
      <p>계통도에서 기기를 누르면 역할·자사 제품·데이터시트가 여기에 표시됩니다.</p>
      <p className="dp-muted">키보드: Tab 으로 기기 이동, Enter 로 선택, Esc 로 닫기</p>
    </aside>
  );
}

/**
 * 우측 상세 패널 (모바일 ≤900px 에서는 하단 시트). 선택은 URL `?node=` 가 원본.
 * Esc·닫기 → 선택 해제 + 포커스를 그 노드로 복귀.
 */
export default function DetailPanel() {
  const selectedId = useSelectedNodeId();
  const selectNode = useSelectNode();
  const mode = useViewMode();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const location = useLocation();
  const navigate = useNavigate();
  const navType = useNavigationType();
  // 모바일 시트 펼침 = 기록 항목의 state → 뒤로가기로 돌아오면 그때 펼침 상태 그대로, 새 기기를 열면 접힘
  // 압축 화면(창 높이 ≤600·넓게 보기)의 모바일 폭 = 하단 시트 대신 오른쪽 사이드 패널(AppLayout.css) →
  // 항상 펼친 상태, 시트 핸들·펼치기 버튼·접힌 머리글 없음. 휴대폰 세로는 넓게 보기여도 하단 시트(리뷰 M2)
  const { compact: compactDensity } = useCompactState();
  const sideSheet = isMobile && compactDensity;
  const savedSheet = (location.state as SheetHistoryState | null)?.sheet;
  const sheetSize: SheetSize = sideSheet ? 'full' : savedSheet === 'expanded' ? 'full' : savedSheet === 'half' ? 'half' : 'peek';
  const expanded = sideSheet || (isMobile && sheetSize !== 'peek');
  const setSheetSize = (v: SheetSize) => {
    const prev = (location.state ?? {}) as Record<string, unknown>;
    const sheet: SheetHistoryState['sheet'] = v === 'full' ? 'expanded' : v === 'half' ? 'half' : undefined;
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: { ...prev, sheet } satisfies SheetHistoryState });
    announce(`시트 크기: ${SHEET_SIZE_NAME[v]}`);
  };
  const setEmptyPanelOpen = useUiStore((s) => s.setEmptyPanelOpen);
  const panelRef = useRef<HTMLElement>(null);
  const keyRef = useRef(location.key);
  keyRef.current = location.key;
  /** 이번 선택에서 패널 제목으로 포커스를 옮겼는가 (안내 중복 방지) */
  const titleFocusedRef = useRef(false);
  const node = selectedId ? getDiagramModel().nodeById.get(selectedId) : undefined;

  /** 닫기(Esc·×) → 포커스를 원래 타일로 돌려주고, 그 타일이 화면(보이는 영역) 안에 들어오도록 팬 (B4) */
  const close = () => {
    const id = selectedId;
    setEmptyPanelOpen(false); // 닫으면 레일로 (빈 안내를 펼쳐 둔 채 기기를 골랐어도)
    selectNode(null);
    if (id)
      requestAnimationFrame(() => {
        focusNode(id);
        getDiagramController()?.revealNode(id);
      });
  };

  /** 패널 안 칩·버튼으로 선택을 바꿈 → 누른 칩은 새 목록에서 사라지므로 포커스를 새 기기의 패널 제목으로 */
  const selectFromPanel = (id: string) => {
    if (id === selectedId) {
      focusPanelTitle();
      return;
    }
    requestPanelFocus();
    selectNode(id);
  };
  const closeRef = useRef(close);
  closeRef.current = close;

  // Esc 수신은 패널이 DOM 에 붙는 커밋과 같은 시점에 등록 (useLayoutEffect) — useEffect 는 화면에 그린 뒤로 밀릴 수 있어
  // 패널이 보이자마자 누른 Esc 를 놓치는 경쟁이 있었다 (E2E 간헐 실패, docs/reviews/flaky-tests.md)
  useLayoutEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedId]);

  // 새 기기 → 맨 위로, 뒤로가기로 돌아온 항목 → 그때 스크롤 위치. 선택(클릭·Enter)으로 열렸으면 제목으로 포커스
  useLayoutEffect(() => {
    const el = panelRef.current;
    const saved = navType === 'POP' && location.key !== 'default' ? panelScroll.get(location.key) : undefined;
    if (el) {
      if (el.scrollTo) el.scrollTo({ top: saved ?? 0 });
      else el.scrollTop = saved ?? 0;
    }
    titleFocusedRef.current = !!selectedId && takePanelFocusRequest() && focusPanelTitle();
    // location.key 는 선택과 함께 바뀌므로 선택 기준으로만 실행 (시트 펼침 replace 때 스크롤을 지우지 않게)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // 레일에서 패널이 열리면 계통도 폭이 줄어든다 → 고른 타일이 가려지지 않게 다시 맞춘다 (P0-8, 이미 보이면 그대로). 열기 애니메이션은 CSS — 움직임 줄이기면 없음
  const hadNodeRef = useRef(false);
  const hasNode = !!node;
  useEffect(() => {
    const was = hadNodeRef.current;
    hadNodeRef.current = hasNode;
    if (!hasNode || was || isMobile || !selectedId) return;
    const id = selectedId;
    const raf = requestAnimationFrame(() => getDiagramController()?.revealNode(id));
    return () => cancelAnimationFrame(raf);
  }, [hasNode, selectedId, isMobile]);

  // 스크린리더 안내 (앱 공용 live region)
  const openedName = node ? (node.eq.abbr ?? node.eq.name) : null;
  // 제목으로 포커스를 옮겼으면 제목 낭독과 겹치므로 생략 (리뷰 S3)
  useEffect(() => {
    if (!openedName) return;
    if (titleFocusedRef.current) {
      titleFocusedRef.current = false;
      return;
    }
    announce(`${openedName} 상세 열림`);
  }, [selectedId, openedName]);

  // 접힌 하단 시트(요약)일 때만 실측 — 펼치면 비교 바는 숨고, 사이드 패널은 바와 겹치지 않음
  useSheetHeightVar(panelRef, !!node && isMobile && !sideSheet && !expanded);

  const onScroll = (e: React.UIEvent<HTMLElement>) => {
    savePanelScroll(keyRef.current, e.currentTarget.scrollTop);
  };

  if (!node) {
    if (isMobile) return null;
    return <EmptyPanel />;
  }

  const { eq } = node;
  const model = getDiagramModel();
  const mainNodeId = node.ref ? model.nodes.find((n) => n.eq.id === eq.id)?.id : undefined;
  // 참조 타일: 머리글 계층·전압 = 타일이 놓인 자리(밴드)·참조 라벨, 원래 기기 계층은 참조 안내에 "원래 위치"로 (T2 M5)
  const placeVoltage = node.ref ? (node.refLabel ?? model.layers.find((l) => l.id === node.layer)?.voltage) : eq.voltage;
  const products = productsForEquipment(eq.id);
  const anyPhoto = products.slice(0, MAX_PRODUCTS).some((p) => hasProductPhoto(p.id));
  const rep = representative(products);
  const gapView = mode === 'gap' && isGapCoverage(eq.coverage);
  const variant = isMobile ? 'sheet' : 'side';
  const compact = isMobile && !expanded;

  const bottomSheet = isMobile && !sideSheet;

  return (
    <aside
      ref={panelRef}
      className={`detail-panel detail-panel--${variant}${expanded ? ' is-expanded' : ''}${bottomSheet ? ` is-${sheetSize}` : ''}`}
      data-testid="detail-panel"
      data-variant={variant}
      data-sheet={isMobile ? (sideSheet ? 'side' : 'bottom') : undefined}
      data-sheet-size={bottomSheet ? sheetSize : undefined}
      role={isMobile ? 'dialog' : 'complementary'}
      aria-modal={isMobile ? false : undefined}
      aria-labelledby={PANEL_TITLE_ID}
      onScroll={onScroll}
    >
      {bottomSheet && (
        // 손잡이 = 시트 크기 단계 버튼 (요약 → 반 → 전체 → 요약). 보이는 막대는 4px, 누르는 영역은 44px
        <button
          type="button"
          className="dp-handle"
          aria-label={`시트 크기 바꾸기 (지금: ${SHEET_SIZE_NAME[sheetSize]})`}
          title="시트 크기 바꾸기"
          data-testid="detail-sheet-handle"
          onClick={() => setSheetSize(SHEET_NEXT[sheetSize])}
        />
      )}
      {/* ① 머리: 썸네일 · 계층/전압 · 이름 · 상태 */}
      <div className={`dp-head${compact ? ' dp-head--compact' : ''}`}>
        <div className={`dp-head__thumb${compact ? '' : ' dp-head__thumb--side'}`}>
          <PanelHero eq={eq} compact={compact} />
        </div>
        <div className="dp-titlebox">
          <span className="dp-meta" data-testid="detail-meta">
            {layerTitle(node.layer)}
            {placeVoltage ? ` · ${placeVoltage}` : ''} · {node.ref ? '참조 타일' : CATEGORY_LABELS[eq.category]}
          </span>
          <h2 id={PANEL_TITLE_ID} className="dp-title" data-testid="detail-title" tabIndex={-1}>
            {eq.name}
            {eq.abbr && <span className="dp-abbr"> {eq.abbr}</span>}
          </h2>
          <CoverageBadge
            coverage={eq.coverage}
            variant="pill"
            label={pillText(eq.coverage, products.length, gapConfidence(eq) === 'confirmed')}
            testId="detail-coverage-badge"
          />
        </div>
        <button type="button" className="dp-close" aria-label="상세 정보 닫기" title="닫기 (Esc)" data-testid="detail-panel-close" onClick={close}>
          ×
        </button>
      </div>

      {compact ? (
        // 접힌 시트 = 요약만: 머리글 + 설명 1~2줄 + 펼치기. 나머지 섹션은 렌더하지 않아 반쯤 잘린 채 누를 수 있는 요소가 없다
        <p className="dp-desc dp-desc--clamp" data-testid="detail-desc">
          {eq.description}
        </p>
      ) : (
        <>
          {/* ② 고정 버튼 줄 — 스크롤해도 패널 위에 붙어 있음 */}
          <div className="dp-actions" data-testid="detail-actions">
            <PanelCompareButton id={eq.id} name={eq.name} />
            {/* 2026-11-19 사용자: 너무 작음 → 주 버튼(CI 네이비 채움, 40px·터치 44px) */}
            <ButtonLink to={`/equipment/${eq.id}`} variant="primary" size="md" className="dp-eq-link" testId="detail-eq-link">
              기기 상세 페이지 →
            </ButtonLink>
          </div>

          {node.ref && (
            <div className="dp-refnote" data-testid="detail-ref-note" role="note">
              <span>
                <b>참조 타일</b>
                {node.refLabel ? ` · ${node.refLabel}` : ''} — 같은 기기가 계통에 다시 나오는 자리입니다.
                <br />
                <span data-testid="detail-ref-origin">
                  원래 위치: {layerTitle(eq.layer)}
                  {eq.voltage ? ` · ${eq.voltage}` : ''} · {CATEGORY_LABELS[eq.category]}
                </span>
              </span>
              {mainNodeId && (
                <button type="button" className="dp-refnote__go" data-testid="detail-ref-go" onClick={() => selectFromPanel(mainNodeId)}>
                  원래 위치로 이동 →
                </button>
              )}
            </div>
          )}

          {/* ③ 자사 제품 목록 */}
          <section className="dp-section" aria-labelledby="dp-products-title">
            <h3 id="dp-products-title" className="dp-label">
              자사 제품{products.length > 0 ? ` · ${products.length}개` : ''}
            </h3>
            {products.length > 0 ? (
              <>
                <ul className="dp-products" data-testid="detail-product-list">
                  {products.slice(0, MAX_PRODUCTS).map((p) => {
                    const n = docsByProductId(p.id)?.docs.length ?? 0;
                    return (
                      <li key={p.id} className="dp-product-row">
                        <Link to={`/product/${p.id}`} className="dp-product" data-testid={`product-card-${p.id}`}>
                          {anyPhoto && (
                            <span className="dp-product__img" aria-hidden="true">
                              {hasProductPhoto(p.id) && <ProductVisual product={p} thumb size={36} />}
                            </span>
                          )}
                          <strong className="dp-product__name">{p.name}</strong>
                          <span className={n > 0 ? 'dp-product__docs' : 'dp-muted'}>{n > 0 ? `자료 ${n} →` : '→'}</span>
                        </Link>
                        <CompareToggle kind="product" id={p.id} name={p.name} variant="icon" />
                      </li>
                    );
                  })}
                </ul>
                {products.length > MAX_PRODUCTS && (
                  <Link to={`/equipment/${eq.id}`} className="dp-more">
                    외 {products.length - MAX_PRODUCTS}개 — 기기 상세 페이지에서 모두 보기 →
                  </Link>
                )}
              </>
            ) : (
              <EmptyProducts eq={eq} testIdPrefix="detail" className="dp-empty" listClassName="dp-links" />
            )}
          </section>

          {/* ④ 설명 — 1줄 요약, 펼치기 (기기가 바뀌면 다시 접힘) */}
          <PanelDescription key={eq.id} eq={eq} />

          {eq.affiliateName && (
            <p className="dp-affiliate">
              계열사: <strong data-testid="detail-affiliate-name">{eq.affiliateName}</strong>
            </p>
          )}

          {eq.gapNote && (
            <div className={`dp-gapnote${gapView ? ' dp-gapnote--strong' : ''}`}>
              <span className="dp-gapnote__label">{NOTE_LABELS[eq.coverage] ?? '메모'}</span>
              <span data-testid="detail-gap-note">{eq.gapNote}</span>
            </div>
          )}

          <GapAssessmentSection eq={eq} />

          {gapView && <GapSections node={node} onSelect={selectFromPanel} />}

          {rep && (
            <section className="dp-section" aria-labelledby="dp-docs-title">
              <h3 id="dp-docs-title" className="dp-label">
                데이터시트·매뉴얼 <span className="dp-label__sub">· {rep.name}</span>
              </h3>
              <DocsList product={rep} max={5} testIdPrefix="detail-doc" />
            </section>
          )}

          <NeighborChips node={node} onSelect={selectFromPanel} />
        </>
      )}

      {bottomSheet && (
        // 시트 아래 버튼 줄 (고정). 요약: 비교 담기 + 더 보기(→반) / 반: 줄이기 + 전체 보기 / 전체: 시트 줄이기(→요약)
        <div className="dp-sheet-actions">
          {compact && <PanelCompareButton id={eq.id} name={eq.name} />}
          {compact && (
            // 접힌 시트에서도 기기 상세로 바로 (2026-11-19 사용자: 기기 상세 페이지가 안 들어가짐 — 펼쳐야만 보였음)
            <ButtonLink to={`/equipment/${eq.id}`} variant="primary" size="md" className="dp-sheet-eqlink" testId="detail-eq-link-sheet">
              기기 상세 →
            </ButtonLink>
          )}
          {sheetSize === 'half' && (
            <button type="button" className="dp-shrink" data-testid="detail-sheet-shrink" onClick={() => setSheetSize('peek')}>
              줄이기
            </button>
          )}
          <button
            type="button"
            className="dp-expand"
            aria-expanded={expanded}
            data-testid="detail-sheet-toggle"
            onClick={() => setSheetSize(SHEET_NEXT[sheetSize])}
          >
            {SHEET_TOGGLE_TEXT[sheetSize]}
          </button>
        </div>
      )}
    </aside>
  );
}
