import { Link } from 'react-router-dom';
import type { EquipmentType } from '../../lib/schema';
import { resolveCategories, resolveProducts } from '../../data/load';
import CoverageBadge from './CoverageBadge';
import DocsList from './DocsList';
import ExternalLink from './ExternalLink';
import './EquipmentInfo.css';

interface Props {
  eq: EquipmentType;
  /** testid 접두어: 상세 패널 'detail', 기기 페이지 'equipment' */
  idPrefix: 'detail' | 'equipment';
  /** 제품 카드 아래에 자료 링크를 몇 건까지 보일지 (0 이면 자료 숨김) */
  docsPerProduct?: number;
}

/**
 * 기기 정보 본문 (상세 패널·기기 페이지 공용).
 * 연결 제품 0개 → 연결 카테고리 페이지 링크 → 그것도 없으면 "자료 준비 중".
 * coverage 는 데이터 값이 원본 (자동 계산하지 않음).
 */
export default function EquipmentInfo({ eq, idPrefix, docsPerProduct = 3 }: Props) {
  const products = resolveProducts(eq);
  const categories = products.length === 0 ? resolveCategories(eq) : [];
  const t = (s: string) => `${idPrefix}-${s}`;
  // 제품이 많으면 목록이 길어지므로 자료 링크는 제품 페이지에서만 본다
  const perProduct = products.length <= 5 ? docsPerProduct : 0;

  return (
    <div className="eq-info">
      <CoverageBadge coverage={eq.coverage} testId={t('coverage-badge')} />
      {eq.abbr && <p className="eq-info__meta">{eq.abbr} · {eq.voltage}</p>}
      {!eq.abbr && eq.voltage && <p className="eq-info__meta">{eq.voltage}</p>}
      <p>{eq.description}</p>

      {eq.affiliateName && (
        <p className="eq-info__affiliate">
          계열사: <strong data-testid={t('affiliate-name')}>{eq.affiliateName}</strong>
        </p>
      )}
      {eq.gapNote && (
        <p className="eq-info__gap-note" data-testid={t('gap-note')}>
          {eq.gapNote}
        </p>
      )}

      {eq.learnPoints.length > 0 && (
        <>
          <h3>학습 포인트</h3>
          <ul data-testid={t('learn-points')}>
            {eq.learnPoints.map((lp) => (
              <li key={lp}>{lp}</li>
            ))}
          </ul>
        </>
      )}

      <h3>자사 제품</h3>
      {products.length > 0 ? (
        <ul className="eq-info__products" data-testid={t('product-list')}>
          {products.map((p) => (
            <li key={p.id} className="eq-info__product">
              <Link to={`/product/${p.id}`} data-testid={`product-card-${p.id}`} className="eq-info__product-link">
                <strong>{p.name}</strong>
                <span className="eq-info__meta">{p.categoryPath.join(' › ')}</span>
              </Link>
              {perProduct > 0 && (
                <DocsList product={p} max={perProduct} testIdPrefix={`${idPrefix}-doc`} />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="eq-info__empty" data-testid={t('empty-products')}>
          {eq.coverage === 'missing' ? (
            <p>자사 제품 미보유(공백)</p>
          ) : eq.coverage === 'affiliate' ? (
            <p>계열사 제품으로 공급합니다.</p>
          ) : eq.coverage === 'na' ? (
            <p>해당 없음</p>
          ) : categories.length > 0 ? (
            <>
              <p>개별 제품 페이지 대신 공식 제품군 페이지에서 확인하세요.</p>
              <ul className="eq-info__categories" data-testid={t('category-links')}>
                {categories.map((c) => (
                  <li key={c.code}>
                    <ExternalLink href={c.url}>{c.path.join(' › ')} ↗</ExternalLink>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="eq-info__pending">자료 준비 중</p>
          )}
        </div>
      )}
    </div>
  );
}
