import { useEffect, useLayoutEffect, useRef } from 'react';
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
import { useUiStore } from '../../store/useUiStore';
import { COMPACT_QUERY } from '../layout/shellLayout';
import CoverageBadge from '../common/CoverageBadge';
import CompareToggle from '../compare/CompareToggle';
import DocsList from '../common/DocsList';
import EmptyProducts from '../common/EmptyProducts';
import GapAssessmentSection from './GapAssessmentSection';
import GapSections from './GapSections';
import NeighborChips from './NeighborChips';
import PanelHero from './PanelHero';
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

/** 기록 항목(location.key)별 패널 스크롤 위치 — 제품 페이지 등에서 뒤로가기로 돌아오면 복원 (B5) */
const panelScroll = new Map<string, number>();

/** 자료를 보여줄 대표 제품: 자료가 있는 첫 제품, 없으면 첫 제품 */
function representative(products: Product[]): Product | undefined {
  return products.find((p) => (docsByProductId(p.id)?.docs.length ?? 0) > 0) ?? products[0];
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
  // 압축 화면(창 높이 ≤600·발표 보기)의 모바일 폭 = 하단 시트 대신 오른쪽 사이드 패널(AppLayout.css) →
  // 항상 펼친 상태, 시트 핸들·펼치기 버튼·접힌 머리글 없음
  const compactDensity = useMediaQuery(COMPACT_QUERY);
  const present = useUiStore((st) => st.present);
  const sideSheet = isMobile && (compactDensity || present);
  const expanded = sideSheet || (isMobile && (location.state as PanelHistoryState | null)?.sheet === 'expanded');
  const setExpanded = (v: boolean) => {
    const prev = (location.state ?? {}) as Record<string, unknown>;
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: { ...prev, sheet: v ? 'expanded' : undefined } satisfies PanelHistoryState },
    );
  };
  const panelRef = useRef<HTMLElement>(null);
  const keyRef = useRef(location.key);
  keyRef.current = location.key;
  const node = selectedId ? getDiagramModel().nodeById.get(selectedId) : undefined;

  /** 닫기(Esc·×) → 포커스를 원래 타일로 돌려주고, 그 타일이 화면(보이는 영역) 안에 들어오도록 팬 (B4) */
  const close = () => {
    const id = selectedId;
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

  useEffect(() => {
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
    if (selectedId && takePanelFocusRequest()) focusPanelTitle();
    // location.key 는 선택과 함께 바뀌므로 선택 기준으로만 실행 (시트 펼침 replace 때 스크롤을 지우지 않게)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // 스크린리더 안내 (앱 공용 live region)
  const openedName = node ? (node.eq.abbr ?? node.eq.name) : null;
  useEffect(() => {
    if (openedName) announce(`${openedName} 상세 열림`);
  }, [selectedId, openedName]);

  const onScroll = (e: React.UIEvent<HTMLElement>) => {
    panelScroll.set(keyRef.current, e.currentTarget.scrollTop);
  };

  if (!node) {
    if (isMobile) return null;
    return (
      <aside className="detail-panel detail-panel--empty" aria-labelledby="detail-panel-title">
        <h2 id={PANEL_TITLE_ID}>상세 정보</h2>
        <p>계통도에서 기기를 누르면 역할·자사 제품·데이터시트가 여기에 표시됩니다.</p>
        <p className="dp-muted">키보드: Tab 으로 기기 이동, Enter 로 선택, Esc 로 닫기</p>
      </aside>
    );
  }

  const { eq } = node;
  const model = getDiagramModel();
  const mainNodeId = node.ref ? model.nodes.find((n) => n.eq.id === eq.id)?.id : undefined;
  // 참조 타일: 머리글 계층·전압 = 타일이 놓인 자리(밴드)·참조 라벨, 원래 기기 계층은 참조 안내에 "원래 위치"로 (T2 M5)
  const placeVoltage = node.ref ? (node.refLabel ?? model.layers.find((l) => l.id === node.layer)?.voltage) : eq.voltage;
  const products = productsForEquipment(eq.id);
  const rep = representative(products);
  const gapView = mode === 'gap' && isGapCoverage(eq.coverage);
  const variant = isMobile ? 'sheet' : 'side';
  const compact = isMobile && !expanded;

  return (
    <aside
      ref={panelRef}
      className={`detail-panel detail-panel--${variant}${expanded ? ' is-expanded' : ''}`}
      data-testid="detail-panel"
      data-variant={variant}
      data-sheet={isMobile ? (sideSheet ? "side" : "bottom") : undefined}
      role={isMobile ? 'dialog' : 'complementary'}
      aria-modal={isMobile ? false : undefined}
      aria-labelledby={PANEL_TITLE_ID}
      onScroll={onScroll}
    >
      {isMobile && !sideSheet && <div className="dp-handle" aria-hidden="true" />}
      <div className={`dp-head${compact ? ' dp-head--compact' : ''}`}>
        {compact && <PanelHero eq={eq} compact />}
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
          <CompareToggle kind="equipment" id={eq.id} name={eq.name} className="cmp-toggle--sm dp-compare" />
        </div>
        <button type="button" className="dp-close" aria-label="상세 정보 닫기" data-testid="detail-panel-close" onClick={close}>
          ×
        </button>
      </div>

      {!compact && <PanelHero eq={eq} compact={false} />}

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

      <p className="dp-desc">{eq.description}</p>

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
                      <strong>{p.name}</strong>
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

      {rep && (
        <section className="dp-section" aria-labelledby="dp-docs-title">
          <h3 id="dp-docs-title" className="dp-label">
            데이터시트·매뉴얼 <span className="dp-label__sub">· {rep.name}</span>
          </h3>
          <DocsList product={rep} max={5} testIdPrefix="detail-doc" />
        </section>
      )}

      <NeighborChips node={node} onSelect={selectFromPanel} />

      <Link to={`/equipment/${eq.id}`} className="dp-eq-link">
        기기 상세 페이지로 이동 →
      </Link>

      {isMobile && !sideSheet && (
        <button type="button" className="dp-expand" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? '시트 줄이기' : '위로 올려 전체 정보 보기'}
        </button>
      )}
    </aside>
  );
}
