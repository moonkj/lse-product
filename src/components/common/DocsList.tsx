import { DOC_TYPE_LABELS, type Product } from '../../lib/schema';
import { docsByProductId } from '../../data/load';
import ExternalLink from './ExternalLink';
import './DocsList.css';

interface Props {
  product: Product;
  /** 표시할 최대 건수 (생략 시 전체) */
  max?: number;
  /** testid 접두어: 제품 페이지 'doc' → doc-link, 상세 패널 'detail-doc' → detail-doc-link */
  testIdPrefix?: string;
  /** 자료가 없을 때 공식 제품 페이지 링크를 함께 보일지 (제품 페이지는 이미 별도 링크가 있어 false) */
  fallbackLink?: boolean;
}

/**
 * 제품 자료 목록 (docs.json). 유형 배지 + 제목, 맨 아래 "공식 자료실에서 전체 자료 보기".
 * 자료가 없으면 "자료 준비 중" + 공식 제품 페이지 링크.
 */
export default function DocsList({ product, max, testIdPrefix = 'doc', fallbackLink = true }: Props) {
  const entry = docsByProductId(product.id);
  const docs = entry?.docs ?? [];
  const shown = max === undefined ? docs : docs.slice(0, max);

  if (docs.length === 0) {
    return (
      <div className="docs-list docs-list--empty">
        <span className="docs-list__empty-badge" data-testid={`${testIdPrefix}s-empty`}>
          자료 준비 중
        </span>{' '}
        {entry ? (
          <ExternalLink href={entry.deepLink}>공식 자료실에서 찾아보기 ↗</ExternalLink>
        ) : fallbackLink ? (
          <ExternalLink href={product.url}>공식 제품 페이지에서 보기 ↗</ExternalLink>
        ) : null}
      </div>
    );
  }

  return (
    <div className="docs-list">
      <ul className="docs-list__items">
        {shown.map((d) => (
          <li key={d.url}>
            <ExternalLink href={d.url} testId={`${testIdPrefix}-link`} data-doc-type={d.type} className="docs-list__link">
              <span className={`doc-type-badge doc-type-badge--${d.type}`}>{DOC_TYPE_LABELS[d.type]}</span>
              <span className="docs-list__title">{d.title}</span>
              {d.lang && d.lang !== 'ko' && <span className="docs-list__meta">{d.lang.toUpperCase()}</span>}
              {d.updatedAt && <span className="docs-list__meta">{d.updatedAt}</span>}
            </ExternalLink>
          </li>
        ))}
      </ul>
      {shown.length < docs.length && <p className="docs-list__more">외 {docs.length - shown.length}건</p>}
      {entry && (
        <p className="docs-list__deeplink">
          <ExternalLink href={entry.deepLink}>공식 자료실에서 전체 자료 보기 ↗</ExternalLink>
        </p>
      )}
    </div>
  );
}
