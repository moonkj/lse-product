import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Coverage, Product } from '../../lib/schema';
import { docsByProductId } from '../../data/load';
import { CATEGORY_LABELS, COVERAGE_LABELS, gapConfidence, isGapCoverage } from '../../lib/labels';
import { getDiagramModel, layerTitle } from '../../lib/diagram/model';
import { productsForEquipment } from '../../lib/pages/catalog';
import { MOBILE_QUERY, focusNode, useMediaQuery, useSelectNode, useSelectedNodeId, useViewMode } from '../../lib/diagram/url';
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
  return productCount > 0 && (coverage === 'owned' || coverage === 'partial') ? `${base} · 제품 ${productCount}종` : base;
}

/** gapNote 라벨: 상태에 맞게 (보유 기기 메모에 "공백"이 붙지 않게) */
const NOTE_LABELS: Partial<Record<Coverage, string>> = { partial: '일부 보유 메모', missing: '공백 메모' };

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
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const node = selectedId ? getDiagramModel().nodeById.get(selectedId) : undefined;

  const close = () => {
    const id = selectedId;
    selectNode(null);
    if (id) requestAnimationFrame(() => focusNode(id));
  };

  /** 패널 안 칩·버튼으로 선택을 바꿈 → 누른 칩은 새 목록에서 사라지므로 포커스를 새 노드로 옮긴다 */
  const selectFromPanel = (id: string) => {
    selectNode(id);
    focusNode(id);
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

  useEffect(() => {
    setExpanded(false);
    panelRef.current?.scrollTo?.({ top: 0 });
  }, [selectedId]);

  if (!node) {
    if (isMobile) return null;
    return (
      <aside className="detail-panel detail-panel--empty" aria-labelledby="detail-panel-title">
        <h2 id="detail-panel-title">상세 정보</h2>
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
      role={isMobile ? 'dialog' : 'complementary'}
      aria-modal={isMobile ? false : undefined}
      aria-labelledby="detail-panel-title"
    >
      {isMobile && <div className="dp-handle" aria-hidden="true" />}
      <div className={`dp-head${compact ? ' dp-head--compact' : ''}`}>
        {compact && <PanelHero eq={eq} compact />}
        <div className="dp-titlebox">
          <span className="dp-meta" data-testid="detail-meta">
            {layerTitle(node.layer)}
            {placeVoltage ? ` · ${placeVoltage}` : ''} · {node.ref ? '참조 타일' : CATEGORY_LABELS[eq.category]}
          </span>
          <h2 id="detail-panel-title" className="dp-title" data-testid="detail-title">
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

      {eq.learnPoints.length > 0 && (
        <section className="dp-learn" aria-labelledby="dp-learn-title">
          <h3 id="dp-learn-title" className="dp-label">
            신입 학습 포인트
          </h3>
          <ul data-testid="detail-learn-points">
            {eq.learnPoints.map((lp) => (
              <li key={lp}>{lp}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="dp-section" aria-labelledby="dp-products-title">
        <h3 id="dp-products-title" className="dp-label">
          자사 제품{products.length > 0 ? ` · ${products.length}종` : ''}
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
                외 {products.length - MAX_PRODUCTS}종 — 기기 상세 페이지에서 모두 보기 →
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

      {isMobile && (
        <button type="button" className="dp-expand" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          {expanded ? '시트 줄이기' : '위로 올려 전체 정보 보기'}
        </button>
      )}
    </aside>
  );
}
