/**
 * LS ELECTRIC 공식 로고 (public/brand — 출처·사용 허가는 public/brand/README.md).
 * 라이트 = 컬러 로고, 다크(prefers-color-scheme) = 회색 로고. 색·비율 변형 금지 → 높이만 정하고 너비는 auto.
 * GitHub Pages(base './') 대응: BASE_URL 기준 경로.
 */
const BASE = import.meta.env.BASE_URL;
export const BRAND_LOGO = `${BASE}brand/ls-electric-logo.png`;
export const BRAND_LOGO_DARK = `${BASE}brand/ls-electric-logo-gray.png`;

export default function BrandLogo({ className }: { className?: string }) {
  return (
    <picture className={className}>
      <source media="(prefers-color-scheme: dark)" srcSet={BRAND_LOGO_DARK} width={177} height={28} />
      <img src={BRAND_LOGO} alt="LS ELECTRIC" width={350} height={56} decoding="async" />
    </picture>
  );
}
