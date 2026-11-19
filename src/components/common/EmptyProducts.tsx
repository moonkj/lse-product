import { Link } from 'react-router-dom';
import type { EquipmentFamily, EquipmentType } from '../../lib/schema';
import { resolveCategories, useData } from '../../data/load';
import ExternalLink from './ExternalLink';
import './EmptyProducts.css';

const BASE = import.meta.env.BASE_URL;
const KIND_LABEL = { product: '제품', model: '모델', category: '제품군' } as const;

/**
 * 시스템·솔루션 기기(변전소·GIS·HVDC·EMS 등)의 공식 제품군 정보 — 기본 설명 · 관련 제품 · 카탈로그
 * (2026-11-19 사용자: "공식 제품군 페이지에서 확인"만 나오는데 사이트의 기본 설명·관련 제품 정도는 보여줘야)
 */
function FamilyInfo({ family, prefix }: { family: EquipmentFamily; prefix: string }) {
  return (
    <div className="fam" data-testid={`${prefix}-family`}>
      <p className="fam__summary">{family.summary}</p>
      {family.products.length > 0 && (
        <>
          <h3 className="fam__title">관련 제품 · {family.products.length}</h3>
          <ul className="fam__list" data-testid={`${prefix}-family-products`}>
            {family.products.map((p, i) => {
              const body = (
                <>
                  <span className="fam__img">
                    {p.image ? <img src={BASE + p.image} alt="" loading="lazy" width={64} height={64} /> : <span aria-hidden="true">⌁</span>}
                  </span>
                  <span className="fam__text">
                    <span className="fam__name">
                      {p.name}
                      <span className="fam__kind">{KIND_LABEL[p.kind]}</span>
                    </span>
                    {p.desc && <span className="fam__desc">{p.desc}</span>}
                  </span>
                </>
              );
              return (
                <li key={`${p.name}-${i}`}>
                  {p.productId ? (
                    <Link className="fam__card" to={`/product/${p.productId}`}>
                      {body}
                    </Link>
                  ) : p.url ? (
                    <ExternalLink className="fam__card" href={p.url}>
                      {body}
                      <span className="fam__ext" aria-hidden="true">↗</span>
                    </ExternalLink>
                  ) : (
                    <div className="fam__card">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {family.catalogs.length > 0 && (
        <>
          <h3 className="fam__title">카탈로그 · {family.catalogs.length}</h3>
          <ul className="fam__docs">
            {family.catalogs.map((c) => (
              <li key={c.url}>
                <ExternalLink href={c.url}>{c.title} ↗</ExternalLink>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

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
  const family = useData().familyByEquipmentId.get(eq.id);
  let body;
  if (eq.coverage === 'missing') body = <p>자사 제품 미보유(공백)</p>;
  else if (eq.coverage === 'affiliate') body = <p>계열사 제품으로 공급합니다.</p>;
  else if (eq.coverage === 'sourced')
    body = <p>패널 구성품 — 수배전반에 타사 제품을 넣어 함께 공급합니다.</p>;
  else if (eq.coverage === 'na') body = <p>해당 없음 — 자사 공급 대상이 아닌 기기입니다.</p>;
  else if (family)
    body = (
      <>
        <FamilyInfo family={family} prefix={testIdPrefix} />
        <ul className={listClassName} data-testid={`${testIdPrefix}-category-links`}>
          <li>
            <ExternalLink className={linkClassName} href={family.familyUrl}>
              공식 제품군 페이지 ↗
            </ExternalLink>
          </li>
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
