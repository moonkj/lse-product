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
export function FamilyInfo({ family, prefix }: { family: EquipmentFamily; prefix: string }) {
  const productById = useData().productById;
  // 공식 사이트에 따로 페이지가 없는 구성 모델(주소가 제품군 페이지와 같음)은 링크로 만들지 않는다 —
  // 눌러도 모두 같은 제품군 페이지로 가서 헷갈림 (2026-11-27 사용자: RTU·보호계전기반을 눌러도 SAS 로만 감)
  const urlCount = new Map<string, number>();
  for (const p of family.products) if (p.url) urlCount.set(p.url, (urlCount.get(p.url) ?? 0) + 1);
  // 제품군 페이지와 같은 주소이거나, 여러 모델이 한 페이지를 같이 쓰면(예: 진공 인터럽터 LV2~LV5) 그 모델은 개별 페이지가 없는 것
  const noOwnPage = (url?: string, kind?: string) => !!url && (url === family.familyUrl || (kind === 'model' && (urlCount.get(url) ?? 0) > 1));
  /** 공식 분류 페이지 주소가 카테고리형 제품과 같으면 앱 안 제품 페이지로 */
  const inAppId = (url?: string) => {
    const code = url?.match(/\/ko\/product\/category\/([A-Z]{3}\d{3,})\/?$/)?.[1];
    return code && productById.has(code) ? code : undefined;
  };
  const hasPagelessModel = family.products.some((p) => !p.productId && noOwnPage(p.url, p.kind));
  return (
    <div className="fam" data-testid={`${prefix}-family`}>
      <p className="fam__summary">{family.summary}</p>
      {family.products.length > 0 && (
        <>
          <h3 className="fam__title">관련 제품 · {family.products.length}</h3>
          {hasPagelessModel && <p className="fam__note">‘개별 페이지 없음’ 표시 모델은 공식 사이트에 따로 소개 페이지가 없고, 제품군 페이지 안에서 함께 설명됩니다.</p>}
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
                    {!p.productId && noOwnPage(p.url, p.kind) && <span className="fam__nopage">개별 페이지 없음</span>}
                  </span>
                </>
              );
              return (
                <li key={`${p.name}-${i}`}>
                  {p.productId || (!noOwnPage(p.url, p.kind) && inAppId(p.url)) ? (
                    <Link className="fam__card" to={`/product/${encodeURIComponent(p.productId ?? inAppId(p.url)!)}`}>
                      {body}
                    </Link>
                  ) : p.url && !noOwnPage(p.url, p.kind) ? (
                    <ExternalLink className="fam__card" href={p.url}>
                      {body}
                      <span className="fam__ext" aria-hidden="true">↗</span>
                    </ExternalLink>
                  ) : (
                    <div className="fam__card fam__card--static">{body}</div>
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
  if (eq.coverage === 'missing') body = <p>자사 제품 미보유</p>;
  else if (eq.coverage === 'affiliate') body = <p>계열사 제품으로 공급합니다.</p>;
  else if (eq.coverage === 'sourced')
    body = <p>패널 구성품 — 수배전반에 타사 제품을 넣어 함께 공급합니다.</p>;
  else if (eq.coverage === 'developing') body = <p>개발 중 — 출시되면 제품이 연결됩니다.</p>;
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
