import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { COVERAGE_LABELS, type Coverage, type EquipmentType, type Product } from '../../lib/schema';
import { docsByProductId, equipmentImageUrl, getData, resolveCategories, resolveProducts } from '../../data/load';
import { CATEGORY_LABELS, getDiagramModel, isGapCoverage, layerTitle, type NodeItem } from '../../lib/diagram/model';
import { MOBILE_QUERY, useMediaQuery, useSelectNode, useSelectedNodeId, useViewMode } from '../../lib/diagram/url';
import { COVERAGE_ICONS } from '../common/CoverageBadge';
import DocsList from '../common/DocsList';
import ExternalLink from '../common/ExternalLink';
import EquipmentSymbol from '../diagram/EquipmentSymbol';
import './DetailPanel.css';

const MAX_PRODUCTS = 8;

function CoveragePill({ coverage, productCount }: { coverage: Coverage; productCount: number }) {
  let text = COVERAGE_LABELS[coverage];
  if (coverage === 'missing') text = '미보유 · 공백 후보';
  else if (productCount > 0 && (coverage === 'owned' || coverage === 'partial')) text += ` · 제품 ${productCount}종`;
  return (
    <span className={`cov-badge cov-badge--${coverage} cov-pill`} data-testid="detail-coverage-badge" data-coverage={coverage}>
      <span className="cov-badge__icon" aria-hidden="true" data-testid={`coverage-icon-${coverage}`}>
        {COVERAGE_ICONS[coverage]}
      </span>
      <span className="cov-pill__label">{text}</span>
    </span>
  );
}

function Hero({ eq, compact }: { eq: EquipmentType; compact: boolean }) {
  const img = equipmentImageUrl(eq.id);
  const meta = getData().equipmentImageById.get(eq.id);
  const size = compact ? 72 : 200;
  if (img) {
    return (
      <div className={`dp-hero${compact ? ' dp-hero--compact' : ''}`}>
        <img
          src={img}
          alt={meta?.productName ? `${meta.productName} 제품 사진` : ''}
          width={size}
          height={size}
          decoding="async"
        />
      </div>
    );
  }
  return (
    <div className={`dp-hero dp-hero--symbol dp-hero--${eq.coverage}${compact ? ' dp-hero--compact' : ''}`}>
      <EquipmentSymbol category={eq.category} equipmentId={eq.id} size={compact ? 56 : 110} />
    </div>
  );
}

/** 자료를 보여줄 대표 제품: 자료가 있는 첫 제품, 없으면 첫 제품 */
function representative(products: Product[]): Product | undefined {
  return products.find((p) => (docsByProductId(p.id)?.docs.length ?? 0) > 0) ?? products[0];
}

function EmptyProducts({ eq }: { eq: EquipmentType }) {
  const categories = resolveCategories(eq);
  return (
    <div className="dp-empty" data-testid="detail-empty-products">
      {eq.coverage === 'missing' ? (
        <p>자사 제품 미보유(공백)</p>
      ) : eq.coverage === 'affiliate' ? (
        <p>계열사{eq.affiliateName ? `(${eq.affiliateName})` : ''} 제품으로 공급합니다.</p>
      ) : eq.coverage === 'na' ? (
        <p>해당 없음 — 자사 공급 대상이 아닌 기기입니다.</p>
      ) : categories.length > 0 ? (
        <>
          <p>개별 제품 대신 공식 제품군 페이지에서 확인하세요.</p>
          <ul className="dp-links">
            {categories.map((c) => (
              <li key={c.code}>
                <ExternalLink href={c.url}>{c.path.join(' › ')} ↗</ExternalLink>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>자료 준비 중</p>
      )}
    </div>
  );
}

function NeighborChips({ node, onSelect }: { node: NodeItem; onSelect: (id: string) => void }) {
  const list = getDiagramModel().neighbors.get(node.id) ?? [];
  if (list.length === 0) return null;
  return (
    <section className="dp-section dp-section--divided" aria-labelledby="dp-neighbors">
      <h3 id="dp-neighbors" className="dp-label">
        계통에서 연결된 기기
      </h3>
      <div className="dp-chips">
        {list.map((n) => (
          <button
            key={n.node.id}
            type="button"
            className={`dp-chip dp-chip--${n.node.coverage}`}
            onClick={() => onSelect(n.node.id)}
            aria-label={`${n.node.eq.name}, ${COVERAGE_LABELS[n.node.coverage]} — 선택`}
          >
            <span aria-hidden="true">{n.arrow}</span> {n.node.eq.abbr ?? n.node.eq.name}
            {n.kind === 'signal' && <span className="dp-chip__kind"> · 신호</span>}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Gap 모드 전용: 인접 노드 중 보유 기기 + 같은 계층의 공백 */
function GapSections({ node, onSelect }: { node: NodeItem; onSelect: (id: string) => void }) {
  const model = getDiagramModel();
  const owned = (model.neighbors.get(node.id) ?? []).filter((n) => n.node.coverage === 'owned');
  const sameLayerGaps = model.nodes.filter((n) => n.layer === node.layer && isGapCoverage(n.coverage));
  const c = model.coverageCounts;
  return (
    <>
      <section className="dp-section" aria-labelledby="dp-gap-related">
        <h3 id="dp-gap-related" className="dp-label">
          이 공백과 연결된 자사 제품
        </h3>
        {owned.length > 0 ? (
          <ul className="dp-related">
            {owned.map((n) => {
              const products = resolveProducts(n.node.eq);
              const img = n.node.imageUrl;
              return (
                <li key={n.node.id}>
                  <button type="button" className="dp-related__item" onClick={() => onSelect(n.node.id)}>
                    {img ? (
                      <img src={img} alt="" width={40} height={40} loading="lazy" decoding="async" />
                    ) : (
                      <EquipmentSymbol category={n.node.eq.category} equipmentId={n.node.eq.id} size={40} />
                    )}
                    <span>
                      <strong>{n.node.eq.name}</strong>
                      <span className="dp-muted">
                        {n.kind === 'signal' ? '신호로 연결' : '같은 회로'}
                        {products[0] ? ` · ${products[0].name}` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="dp-muted">계통에서 바로 연결된 보유 기기가 없습니다.</p>
        )}
      </section>
      <section className="dp-section dp-section--divided" aria-labelledby="dp-gap-layer">
        <h3 id="dp-gap-layer" className="dp-label">
          같은 계층({layerTitle(node.layer)})의 공백
        </h3>
        <div className="dp-chips">
          {sameLayerGaps.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`dp-gapchip${n.id === node.id ? ' is-current' : ''}`}
              aria-current={n.id === node.id ? 'true' : undefined}
              onClick={() => onSelect(n.id)}
            >
              {n.eq.abbr ?? n.eq.name}
            </button>
          ))}
        </div>
        <p className="dp-muted">
          전체 {model.nodes.length}종 · 미보유 <b>{c.missing}</b> · 일부 보유 <b>{c.partial}</b> · 계열사 보유 <b>{c.affiliate}</b>
        </p>
        <Link to="/gap" className="dp-strong-link">
          공백 표에서 전체 보기 →
        </Link>
      </section>
    </>
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
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const node = selectedId ? getDiagramModel().nodeById.get(selectedId) : undefined;

  const close = () => {
    const id = selectedId;
    selectNode(null);
    if (id) {
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
      });
    }
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
  const products = resolveProducts(eq);
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
        {compact && <Hero eq={eq} compact />}
        <div className="dp-titlebox">
          <span className="dp-meta">
            {layerTitle(eq.layer)}
            {eq.voltage ? ` · ${eq.voltage}` : ''} · {CATEGORY_LABELS[eq.category]}
          </span>
          <h2 id="detail-panel-title" className="dp-title" data-testid="detail-title">
            {eq.name}
            {eq.abbr && <span className="dp-abbr"> {eq.abbr}</span>}
          </h2>
          <CoveragePill coverage={eq.coverage} productCount={products.length} />
        </div>
        <button type="button" className="dp-close" aria-label="상세 정보 닫기" data-testid="detail-panel-close" onClick={close}>
          ×
        </button>
      </div>

      {!compact && <Hero eq={eq} compact={false} />}

      <p className="dp-desc">{eq.description}</p>

      {eq.affiliateName && (
        <p className="dp-affiliate">
          계열사: <strong data-testid="detail-affiliate-name">{eq.affiliateName}</strong>
        </p>
      )}

      {eq.gapNote && (
        <div className={`dp-gapnote${gapView ? ' dp-gapnote--strong' : ''}`}>
          <span className="dp-gapnote__label">{eq.coverage === 'partial' ? '일부 보유 메모' : '공백 메모'}</span>
          <span data-testid="detail-gap-note">{eq.gapNote}</span>
        </div>
      )}

      {gapView && <GapSections node={node} onSelect={selectNode} />}

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
                  <li key={p.id}>
                    <Link to={`/product/${p.id}`} className="dp-product" data-testid={`product-card-${p.id}`}>
                      <strong>{p.name}</strong>
                      <span className={n > 0 ? 'dp-product__docs' : 'dp-muted'}>{n > 0 ? `자료 ${n} →` : '→'}</span>
                    </Link>
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
          <EmptyProducts eq={eq} />
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

      <NeighborChips node={node} onSelect={selectNode} />

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
