import type { EquipmentType } from '../../lib/schema';
import { resolveCategories } from '../../data/load';
import ExternalLink from './ExternalLink';

interface Props {
  eq: EquipmentType;
  /** testid 접두어: 상세 패널 'detail', 기기 페이지 'equipment' → `{prefix}-empty-products`, `{prefix}-category-links` */
  testIdPrefix: 'detail' | 'equipment';
  className?: string;
  listClassName?: string;
  linkClassName?: string;
}

/**
 * "자사 제품 0개" 빈 상태 — 상세 패널·기기 페이지 공용 (리뷰 R4, 계약 CT-04).
 * 미보유 → 공백 안내 / 계열사 → 계열사 공급 / 해당 없음 → 사업 범위 밖 /
 * 보유·일부인데 개별 제품이 없으면 → 공식 제품군(카테고리) 페이지 링크 / 그것도 없으면 "자료 준비 중".
 * 계열사명은 화면 상단(`*-affiliate-name`)에 이미 나오므로 여기서는 반복하지 않는다.
 */
export default function EmptyProducts({ eq, testIdPrefix, className, listClassName, linkClassName }: Props) {
  const categories = resolveCategories(eq);
  let body;
  if (eq.coverage === 'missing') body = <p>자사 제품 미보유(공백)</p>;
  else if (eq.coverage === 'affiliate') body = <p>계열사 제품으로 공급합니다.</p>;
  else if (eq.coverage === 'na') body = <p>해당 없음 — 자사 공급 대상이 아닌 기기입니다.</p>;
  else if (categories.length > 0)
    body = (
      <>
        <p>개별 제품 대신 공식 제품군 페이지에서 확인하세요.</p>
        <ul className={listClassName} data-testid={`${testIdPrefix}-category-links`}>
          {categories.map((c) => (
            <li key={c.code}>
              <ExternalLink className={linkClassName} href={c.url}>
                {c.path.join(' › ')} ↗
              </ExternalLink>
            </li>
          ))}
        </ul>
      </>
    );
  else body = <p>자료 준비 중</p>;

  return (
    <div className={className} data-testid={`${testIdPrefix}-empty-products`}>
      {body}
    </div>
  );
}
