import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useData } from '../data/load';
import DocsList from '../components/common/DocsList';
import ExternalLink from '../components/common/ExternalLink';
import NotFoundPage from './NotFoundPage';

export default function ProductPage() {
  const { id = '' } = useParams();
  const product = useData().productById.get(id);

  useEffect(() => {
    if (product) document.title = `${product.name} · LS ELECTRIC 전력계통 제품맵`;
  }, [product]);

  if (!product) return <NotFoundPage kind="제품" id={id} />;

  return (
    <div className="page" data-testid="product-page">
      <h1>{product.name}</h1>
      <p className="page__lead">{product.categoryPath.join(' › ')}</p>
      <p>
        <ExternalLink href={product.url} testId="product-official-link">
          LS ELECTRIC 공식 제품 페이지 열기 ↗
        </ExternalLink>
      </p>

      <h2>자료</h2>
      <DocsList product={product} fallbackLink={false} />

      <p>
        <Link to="/">← 계통도로</Link>
      </p>
    </div>
  );
}
