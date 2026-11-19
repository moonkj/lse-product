import { Fragment, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DOC_TYPE_LABELS, LAYER_LABELS, type DocRef, type EquipmentType, type Product, type ProductDocs } from '../lib/schema';
import { docsByProductId, equipmentImageUrl, useData } from '../data/load';
import ExternalLink from '../components/common/ExternalLink';
import EquipmentOverview from '../components/common/EquipmentOverview';
import CompareToggle from '../components/compare/CompareToggle';
import Button, { ButtonExternal, ButtonLink, DIAGRAM_CTA_LABEL } from '../components/common/Button';
import { Count, Tag } from '../components/common/Badge';
import PageHeader, { type Crumb } from '../components/common/PageHeader';
import EquipmentVisual from '../components/pages/EquipmentVisual';
import ProductVisual, { FALLBACK_PHOTO_LABEL, hasProductPhoto } from '../components/pages/ProductVisual';
import ProductSpecs, { SPECS_VARIANTS_ANCHOR } from '../components/pages/ProductSpecs';
import { useSpecs } from '../components/compare/useSpecs';
import { hasVariants } from '../lib/pages/compare';
import {
  diagramHref,
  equipmentForProduct,
  fileBadge,
  langLabel,
  layerStyle,
  neighborChain,
  nodeForEquipment,
  productsForEquipment,
} from '../lib/pages/catalog';
import { gapConfidence, pageTitle } from '../lib/labels';
import { requestPanelFocus } from '../lib/diagram/url';
import NotFoundPage from './NotFoundPage';
import './pages.css';
import './ProductPage.css';

const SIBLING_MAX = 24;

export default function ProductPage() {
  const { id = '' } = useParams();
  const product = useData().productById.get(id);

  useEffect(() => {
    if (product) document.title = pageTitle(product.name);
  }, [product]);

  if (!product) return <NotFoundPage kind="제품" id={id} />;

  const equipments = equipmentForProduct(product.id);
  const eq = equipments[0];
  const node = eq ? nodeForEquipment(eq.id) : undefined;
  const entry = docsByProductId(product.id);
  const docs = entry?.docs ?? [];

  return (
    <div className="pg" data-testid="product-page">
      <PageHeader
        crumbs={[
          { label: '계통도', to: diagramHref(node?.id) },
          ...(eq
            ? ([
                { label: `${eq.layer} ${LAYER_LABELS[eq.layer]}`, layer: eq.layer },
                { label: eq.name, to: `/equipment/${eq.id}` },
              ] satisfies Crumb[])
            : []),
          { label: product.name },
        ]}
      />

      <section className="pg-hero" aria-labelledby="product-title">
        <div className="pg-hero__media">
          {hasProductPhoto(product.id) || eq ? (
            <ProductVisual product={product} eq={eq} alt={`${product.name} 제품 사진`} lazy={false} />
          ) : (
            <span className="pg-muted">사진 없음</span>
          )}
          {!hasProductPhoto(product.id) && eq && equipmentImageUrl(eq.id) && (
            <span className="pg-hero__caption" data-testid="product-photo-fallback">
              {FALLBACK_PHOTO_LABEL} · {eq.name}
            </span>
          )}
        </div>
        <div className="pg-hero__body">
          <span className="pg-hero__kicker">{product.categoryPath.join(' › ')}</span>
          <h1 id="product-title" className="pg-hero__title">
            {product.name}
          </h1>
          <div className="pg-badges">
            {/* 판매 상태는 중립 Tag + 점 — ✓ 원 아이콘은 커버리지 '보유' 전용 */}
            <Tag dot>{product.discontinued ? '단종' : '판매 중'}</Tag>
            <Tag>{product.business === 'power' ? '전력 사업' : '자동화 사업'}</Tag>
          </div>
          <JumpChips productId={product.id} docs={docs} />

          {eq && <RoleBox eq={eq} />}

          {equipments.length > 1 && (
            <p className="pg-muted">
              이 제품이 쓰이는 다른 기기:{' '}
              {equipments.slice(1).map((e, i) => (
                <Fragment key={e.id}>
                  {i > 0 && ' · '}
                  <Link to={`/equipment/${e.id}`}>
                    {e.name} ({e.layer})
                  </Link>
                </Fragment>
              ))}
            </p>
          )}

          <div className="pg-actions">
            {node && (
              <ButtonLink variant="primary" to={diagramHref(node.id)} onClick={requestPanelFocus}>
                {DIAGRAM_CTA_LABEL}
              </ButtonLink>
            )}
            <ButtonExternal variant="secondary" href={product.url} testId="product-official-link">
              공식 제품 페이지 ↗
            </ButtonExternal>
            {entry && (
              <ButtonExternal variant="secondary" href={entry.deepLink}>
                자료실에서 전체 자료 보기 ↗
              </ButtonExternal>
            )}
            <CompareToggle kind="product" id={product.id} name={product.name} />
          </div>
        </div>
      </section>

      <ProductSpecs product={product} />

      <div className="pg-split">
        <section className="pg-card pg-split__main" aria-labelledby="docs-h">
          <h2 id="docs-h">데이터시트·카탈로그·매뉴얼</h2>
          <DocGroups docs={docs} entry={entry} product={product} />
        </section>

        <aside className="pg-split__side" aria-label="계통 정보">
          {node && eq && <PositionCard nodeId={node.id} eq={eq} />}
          {eq && <SiblingsCard eq={eq} productId={product.id} />}
        </aside>
      </div>
    </div>
  );
}

/** 자료 묶음 앵커 id (자료 바로가기 칩 → 해당 그룹) */
const docGroupAnchor = (type: DocRef['type']) => `docs-${type}`;

/** 해시 라우터라 href="#..." 를 쓰면 경로가 바뀜 → 버튼으로 그 섹션까지 스크롤 + 포커스 */
function jumpTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView?.({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  el.focus({ preventScroll: true });
}

/**
 * 자료 바로가기 칩 (UX 토론 C5) — 기존 "자료 N건" 칩 자리. [옵션별 사양][카탈로그 n][매뉴얼 n],
 * 해당 자료가 없으면 그 칩은 뺀다. 섹션 순서는 그대로 두고 앵커 이동만 (I7 합의).
 */
function JumpChips({ productId, docs }: { productId: string; docs: DocRef[] }) {
  const specs = useSpecs('product');
  const showVariants = specs.status === 'ready' && hasVariants(specs.map.get(productId));
  const catalog = docs.filter((d) => d.type === 'catalog').length;
  const manual = docs.filter((d) => d.type === 'manual').length;
  if (!showVariants && catalog === 0 && manual === 0) return null;
  return (
    <ul className="pg-jumps" aria-label="자료 바로가기" data-testid="product-jump-chips">
      {showVariants && (
        <li>
          <Button size="sm" className="pg-jump" testId="jump-specs" onClick={() => jumpTo(SPECS_VARIANTS_ANCHOR)}>
            옵션별 사양
          </Button>
        </li>
      )}
      {catalog > 0 && (
        <li>
          <Button size="sm" className="pg-jump" testId="jump-catalog" onClick={() => jumpTo(docGroupAnchor('catalog'))}>
            카탈로그 <Count>{catalog}</Count>
          </Button>
        </li>
      )}
      {manual > 0 && (
        <li>
          <Button size="sm" className="pg-jump" testId="jump-manual" onClick={() => jumpTo(docGroupAnchor('manual'))}>
            매뉴얼 <Count>{manual}</Count>
          </Button>
        </li>
      )}
    </ul>
  );
}

function RoleBox({ eq }: { eq: EquipmentType }) {
  return (
    <div className="pg-role">
      <span className="pg-role__label">계통에서 하는 일 · {eq.name}</span>
      <EquipmentOverview eq={eq} testId="product-role-text" />
    </div>
  );
}

/** 자료 유형별 그룹 — 그룹 순서는 docs.json 에 처음 등장한 순서 */
function groupDocs(docs: DocRef[]) {
  const groups = new Map<DocRef['type'], DocRef[]>();
  for (const d of docs) {
    const g = groups.get(d.type) ?? [];
    g.push(d);
    groups.set(d.type, g);
  }
  return [...groups.entries()];
}

function DocGroups({ docs, entry, product }: { docs: DocRef[]; entry?: ProductDocs; product: Product }) {
  const remainHref = entry?.deepLink ?? product.url;
  return (
    <>
      {docs.length === 0 ? (
        <div className="pd-empty">
          <span className="pd-empty__badge" data-testid="docs-empty">
            자료 준비 중
          </span>
          <span className="pg-muted">
            {entry
              ? '이 제품의 자료는 공식 자료실에서 확인할 수 있습니다.'
              : '수집된 자료가 아직 없습니다. 위의 "공식 제품 페이지"에서 최신 자료를 확인하세요.'}
          </span>
        </div>
      ) : (
        groupDocs(docs).map(([type, list]) => (
          <div key={type} className="pd-group" id={docGroupAnchor(type)} tabIndex={-1}>
            <h3 className="pd-group__label">
              {DOC_TYPE_LABELS[type]} {list.length}
            </h3>
            <ul className="pd-group__list">
              {list.map((d, i) => (
                <li key={`${i}-${d.url}`}>
                  <ExternalLink href={d.url} testId="doc-link" data-doc-type={d.type} className="pd-doc">
                    <span className={`pd-doc__file pd-doc__file--${d.type}`} aria-hidden="true">
                      {fileBadge(d.url)}
                    </span>
                    <span className="pd-doc__body">
                      <b className="pd-doc__title">{d.title}</b>
                      <span className="pd-doc__meta">
                        {DOC_TYPE_LABELS[d.type]}
                        {d.lang && ` · ${langLabel(d.lang)}`}
                        {d.updatedAt && ` · ${d.updatedAt}`}
                      </span>
                    </span>
                    <span className="pd-doc__arrow" aria-hidden="true">
                      ↗
                    </span>
                  </ExternalLink>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      <div className="pd-remain">
        <span className="pd-remain__text">
          CAD·인증서·소프트웨어 등 나머지 자료는 공식 자료실에서 최신본으로 제공됩니다. 주요 사양은 카탈로그 PDF를
          참고하세요.
        </span>
        <ExternalLink href={remainHref} className="pd-remain__link">
          {entry ? '자료실 열기 ↗' : '공식 제품 페이지 ↗'}
        </ExternalLink>
      </div>
    </>
  );
}

const EDGE_KIND_NAME = { power: '전력선', signal: '신호선', alt: '택1 연결' } as const;

function PositionCard({ nodeId, eq }: { nodeId: string; eq: EquipmentType }) {
  const chain = neighborChain(nodeId);
  if (chain.length === 0) return null;
  const selfIdx = chain.findIndex((l) => l.node.id === nodeId);
  const prev = selfIdx > 0 ? chain[selfIdx - 1] : undefined;
  const next = chain[selfIdx + 1];
  const short = (e: EquipmentType) => e.abbr ?? e.name;
  return (
    <section className="pg-card pg-card--tight" aria-labelledby="pos-h">
      <h2 id="pos-h">계통 속 위치</h2>
      <ol className="pg-chain" style={layerStyle(eq.layer)} aria-label="인접 기기 연결">
        {chain.map((l, i) => {
          const self = l.node.id === nodeId;
          return (
            <Fragment key={l.node.id}>
              <li>
                <Link
                  to={self ? diagramHref(l.node.id) : `/equipment/${l.eq.id}`}
                  className={`pg-chain__node pg-chain__node--${l.eq.coverage}${self ? ' pg-chain__node--self' : ''}`}
                  aria-current={self ? 'true' : undefined}
                  data-confidence={gapConfidence(l.eq)}
                  title={l.eq.name}
                >
                  <EquipmentVisual eq={l.eq} thumb />
                  <b>{short(l.eq)}</b>
                </Link>
              </li>
              {i < chain.length - 1 && (
                <li className="pg-chain__arrow" aria-label={EDGE_KIND_NAME[l.edgeToNext ?? 'power']}>
                  <span aria-hidden="true">{l.edgeToNext === 'power' || !l.edgeToNext ? '━▶' : '┄▶'}</span>
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
      <p className="pg-muted">
        {prev || next ? (
          <>
            {prev && `앞: ${prev.eq.name} (${EDGE_KIND_NAME[prev.edgeToNext ?? 'power']})`}
            {prev && next && ' · '}
            {next && `뒤: ${next.eq.name} (${EDGE_KIND_NAME[chain[selfIdx].edgeToNext ?? 'power']})`}
          </>
        ) : (
          '계통도에서 연결선 없이 묶음으로 표시되는 설비입니다.'
        )}
      </p>
    </section>
  );
}

function SiblingsCard({ eq, productId }: { eq: EquipmentType; productId: string }) {
  const siblings = productsForEquipment(eq.id).filter((p) => p.id !== productId);
  if (siblings.length === 0) return null;
  const shown = siblings.slice(0, SIBLING_MAX);
  return (
    <section className="pg-card pg-card--tight" aria-labelledby="sib-h">
      <h2 id="sib-h">
        같은 기기의 다른 제품 <Count>· {siblings.length}</Count>
      </h2>
      <ul className="pg-chips">
        {shown.map((p) => (
          <li key={p.id}>
            <Link className="pg-chip" to={`/product/${p.id}`}>
              {p.name}
            </Link>
          </li>
        ))}
      </ul>
      {siblings.length > shown.length && (
        <Link to={`/equipment/${eq.id}`} className="pg-muted">
          외 {siblings.length - shown.length}개 — {eq.name} 페이지에서 모두 보기 →
        </Link>
      )}
    </section>
  );
}
