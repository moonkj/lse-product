import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LAYER_LABELS } from '../lib/schema';
import { docsByProductId, useData } from '../data/load';
import CoverageBadge from '../components/common/CoverageBadge';
import DocsList from '../components/common/DocsList';
import EmptyProducts from '../components/common/EmptyProducts';
import EquipmentOverview from '../components/common/EquipmentOverview';
import CompareToggle from '../components/compare/CompareToggle';
import { ButtonLink, DIAGRAM_CTA_LABEL } from '../components/common/Button';
import { Count, Tag } from '../components/common/Badge';
import PageHeader from '../components/common/PageHeader';
import EquipmentVisual from '../components/pages/EquipmentVisual';
import MarketCard from '../components/market/MarketCard';
import ProductVisual from '../components/pages/ProductVisual';
import { CATEGORY_LABELS, isGapCoverage, pageTitle } from '../lib/labels';
import { diagramHref, layerStyle, nodeForEquipment, productsForEquipment } from '../lib/pages/catalog';
import NotFoundPage from './NotFoundPage';
import './pages.css';
import './EquipmentPage.css';

/** 자료 목록을 보일 제품 수 / 제품당 자료 수 */
const DOC_PRODUCTS_MAX = 5;
const DOCS_PER_PRODUCT = 3;

export default function EquipmentPage() {
  const { id = '' } = useParams();
  const eq = useData().equipmentTypeById.get(id);

  useEffect(() => {
    if (eq) document.title = pageTitle(eq.name);
  }, [eq]);

  if (!eq) return <NotFoundPage kind="기기" id={id} />;

  const node = nodeForEquipment(eq.id);
  const products = productsForEquipment(eq.id);
  const relatedCount = useData().familyByEquipmentId.get(eq.id)?.products.length ?? 0;
  const showRelated = products.length === 0 && relatedCount > 0;
  const isGap = isGapCoverage(eq.coverage);
  const docProducts = products.filter((p) => (docsByProductId(p.id)?.docs.length ?? 0) > 0).slice(0, DOC_PRODUCTS_MAX);

  return (
    <div className="pg" data-testid="equipment-page">
      <PageHeader
        crumbs={[
          { label: '계통도', to: diagramHref(node?.id) },
          { label: `${eq.layer} ${LAYER_LABELS[eq.layer]}`, layer: eq.layer },
          { label: eq.name },
        ]}
      />

      <section className="pg-hero" aria-labelledby="equipment-title">
        <div className={`pg-hero__media${eq.coverage === 'missing' ? ' pg-hero__media--missing' : ''}`}>
          <EquipmentVisual eq={eq} alt={`${eq.name} 대표 사진`} />
        </div>
        <div className="pg-hero__body">
          <div className="pg-badges">
            <Tag tone="layer" style={layerStyle(eq.layer)}>
              {eq.layer} · {eq.voltage}
            </Tag>
            <Tag>{CATEGORY_LABELS[eq.category]}</Tag>
            {eq.abbr && <Tag>{eq.abbr}</Tag>}
          </div>
          <h1 id="equipment-title" className="pg-hero__title" data-testid="equipment-title">
            {eq.name}
          </h1>
          <div className="pg-badges">
            <CoverageBadge coverage={eq.coverage} variant="pill" testId="equipment-coverage-badge" />
            <Tag>{showRelated ? `관련 제품 ${relatedCount}개` : `자사 제품 ${products.length}개`}</Tag>
          </div>

          <div className="pg-role">
            <span className="pg-role__label">계통에서 하는 일</span>
            <EquipmentOverview eq={eq} testId="equipment-role-text" />
          </div>

          {eq.affiliateName && (
            <p className="pg-note pg-note--affiliate">
              계열사 공급: <strong data-testid="equipment-affiliate-name">{eq.affiliateName}</strong>
            </p>
          )}

          <div className="pg-actions">
            {node && (
              <ButtonLink variant="primary" to={diagramHref(node.id, isGap ? 'gap' : undefined)}>
                {DIAGRAM_CTA_LABEL}
              </ButtonLink>
            )}
            {isGap && (
              <ButtonLink variant="secondary" to="/gap">
                공백 표에서 보기
              </ButtonLink>
            )}
            <CompareToggle kind="equipment" id={eq.id} name={eq.name} />
          </div>
        </div>
      </section>

      <div className="pg-split">
        <div className="pg-split__main eqp-main">
          <section className="pg-card" aria-labelledby="eq-products-h">
            <h2 id="eq-products-h">
              {showRelated ? '관련 제품' : '자사 제품'} <Count>· {showRelated ? relatedCount : products.length}</Count>
            </h2>
            {products.length > 0 ? (
              <ul className="eqp-products" data-testid="equipment-product-list">
                {products.map((p) => (
                  <li key={p.id} className="eqp-product-item">
                    <CompareToggle kind="product" id={p.id} name={p.name} variant="icon" className="eqp-product__compare" />
                    <Link to={`/product/${p.id}`} className="eqp-product" data-testid={`product-card-${p.id}`}>
                      <ProductVisual product={p} eq={eq} className="eqp-product__img" thumb />
                      <span className="eqp-product__body">
                        <b className="eqp-product__name">{p.name}</b>
                        <span className="eqp-product__meta">{p.categoryPath.join(' › ')}</span>
                        {p.discontinued && (
                          <Tag dot className="eqp-product__off">
                            단종
                          </Tag>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyProducts
                eq={eq}
                testIdPrefix="equipment"
                className="eqp-empty"
                listClassName="pg-chips"
                linkClassName="pg-chip"
              />
            )}
          </section>

          {docProducts.length > 0 && (
            <section className="pg-card" aria-labelledby="eq-docs-h">
              <h2 id="eq-docs-h">자료</h2>
              {docProducts.map((p) => (
                <div key={p.id} className="eqp-docs">
                  <h3 className="eqp-docs__title">
                    <Link to={`/product/${p.id}`}>{p.name}</Link>
                  </h3>
                  <DocsList product={p} max={DOCS_PER_PRODUCT} testIdPrefix="equipment-doc" />
                </div>
              ))}
              {products.length > docProducts.length && (
                <p className="pg-muted">다른 제품의 자료는 각 제품 페이지에서 볼 수 있습니다.</p>
              )}
            </section>
          )}

          <MarketCard equipmentId={eq.id} variant="page" />
        </div>

      </div>
    </div>
  );
}
