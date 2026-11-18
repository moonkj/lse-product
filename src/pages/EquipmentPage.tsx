import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LAYER_LABELS } from '../lib/schema';
import { docsByProductId, resolveCategories, useData } from '../data/load';
import CoverageBadge from '../components/common/CoverageBadge';
import DocsList from '../components/common/DocsList';
import ExternalLink from '../components/common/ExternalLink';
import EquipmentVisual from '../components/pages/EquipmentVisual';
import { CATEGORY_LABELS, diagramHref, layerStyle, nodeForEquipment, productsForEquipment } from '../lib/pages/catalog';
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
    if (eq) document.title = `${eq.name} · LS ELECTRIC 전력계통 제품맵`;
  }, [eq]);

  if (!eq) return <NotFoundPage kind="기기" id={id} />;

  const node = nodeForEquipment(eq.id);
  const products = productsForEquipment(eq.id);
  const categories = products.length === 0 ? resolveCategories(eq) : [];
  const isGap = eq.coverage === 'missing' || eq.coverage === 'partial';
  const docProducts = products.filter((p) => (docsByProductId(p.id)?.docs.length ?? 0) > 0).slice(0, DOC_PRODUCTS_MAX);

  return (
    <div className="pg" data-testid="equipment-page">
      <nav aria-label="경로">
        <ol className="pg-crumbs">
          <li>
            <Link to={diagramHref(node?.id)}>계통도</Link>
          </li>
          <li>
            {eq.layer} {LAYER_LABELS[eq.layer]}
          </li>
          <li aria-current="page">{eq.name}</li>
        </ol>
      </nav>

      <section className="pg-hero" aria-labelledby="equipment-title">
        <div className={`pg-hero__media${eq.coverage === 'missing' ? ' pg-hero__media--missing' : ''}`}>
          <EquipmentVisual eq={eq} alt={`${eq.name} 대표 사진`} />
        </div>
        <div className="pg-hero__body">
          <div className="pg-badges">
            <span className="pg-badge pg-badge--layer" style={layerStyle(eq.layer)}>
              {eq.layer} · {eq.voltage}
            </span>
            <span className="pg-badge">{CATEGORY_LABELS[eq.category]}</span>
            {eq.abbr && <span className="pg-badge">{eq.abbr}</span>}
          </div>
          <h1 id="equipment-title" className="pg-hero__title" data-testid="equipment-title">
            {eq.name}
          </h1>
          <div className="pg-badges">
            <span className={`cov-chip cov-chip--${eq.coverage}`}>
              <CoverageBadge coverage={eq.coverage} testId="equipment-coverage-badge" />
            </span>
            <span className="pg-badge">자사 제품 {products.length}개</span>
          </div>

          <div className="pg-role">
            <span className="pg-role__label">계통에서 하는 일</span>
            <span>{eq.description}</span>
          </div>

          {eq.affiliateName && (
            <p className="pg-note pg-note--affiliate">
              계열사 공급: <strong data-testid="equipment-affiliate-name">{eq.affiliateName}</strong>
            </p>
          )}
          {eq.gapNote && (
            <p className="pg-note" data-testid="equipment-gap-note">
              {eq.gapNote}
            </p>
          )}

          <div className="pg-actions">
            {node && (
              <Link className="pg-btn pg-btn--primary" to={diagramHref(node.id, isGap ? 'gap' : undefined)}>
                계통도에서 보기
              </Link>
            )}
            {isGap && (
              <Link className="pg-btn" to="/gap">
                공백 표에서 보기
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="pg-split">
        <div className="pg-split__main eqp-main">
          <section className="pg-card" aria-labelledby="eq-products-h">
            <h2 id="eq-products-h">
              자사 제품 <span className="pg-count">· {products.length}</span>
            </h2>
            {products.length > 0 ? (
              <ul className="eqp-products" data-testid="equipment-product-list">
                {products.map((p) => (
                  <li key={p.id}>
                    <Link to={`/product/${p.id}`} className="eqp-product" data-testid={`product-card-${p.id}`}>
                      <EquipmentVisual eq={eq} className="eqp-product__img" />
                      <span className="eqp-product__body">
                        <b className="eqp-product__name">{p.name}</b>
                        <span className="eqp-product__meta">{p.categoryPath.join(' › ')}</span>
                        {p.discontinued && <span className="pg-badge pg-badge--off eqp-product__off">단종</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="eqp-empty" data-testid="equipment-empty-products">
                {eq.coverage === 'missing' ? (
                  <p>자사 제품 미보유(공백)</p>
                ) : eq.coverage === 'affiliate' ? (
                  <p>계열사 제품으로 공급합니다.</p>
                ) : eq.coverage === 'na' ? (
                  <p>자사 사업 범위 밖입니다 (해당 없음).</p>
                ) : categories.length > 0 ? (
                  <>
                    <p>개별 제품 대신 공식 제품군 페이지에서 확인하세요.</p>
                    <ul className="pg-chips" data-testid="equipment-category-links">
                      {categories.map((c) => (
                        <li key={c.code}>
                          <ExternalLink className="pg-chip" href={c.url}>
                            {c.path.join(' › ')} ↗
                          </ExternalLink>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p>자료 준비 중</p>
                )}
              </div>
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
        </div>

        <aside className="pg-split__side">
          <section className="pg-card pg-card--tight" aria-labelledby="eq-learn-h">
            <h2 id="eq-learn-h">학습 포인트</h2>
            {eq.learnPoints.length > 0 ? (
              <ul className="eqp-points" data-testid="equipment-learn-points">
                {eq.learnPoints.map((lp) => (
                  <li key={lp}>{lp}</li>
                ))}
              </ul>
            ) : (
              <p className="pg-muted">등록된 학습 포인트가 없습니다.</p>
            )}
            <Link to={`/learn?step=${/^L[1-7]$/.test(eq.layer) ? eq.layer : 'L1'}`} className="pg-muted">
              교육 투어에서 이 계층 배우기 →
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
