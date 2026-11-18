/**
 * LS ELECTRIC 공식 로고 (public/brand — 출처·사용 허가는 public/brand/README.md).
 * 헤더는 네이비 띠 위 흰 로고 상자 → 라이트·다크 모두 컬러 로고 (다크 모드 회색 로고 대비 문제 해소, 2026-11-18).
 * 색·비율 변형 금지 → 높이만 정하고 너비는 auto. GitHub Pages(base './') 대응: BASE_URL 기준 경로.
 */
const BASE = import.meta.env.BASE_URL;
export const BRAND_LOGO = `${BASE}brand/ls-electric-logo.png`;

export default function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={className}>
      <img src={BRAND_LOGO} alt="LS ELECTRIC" width={350} height={56} decoding="async" />
    </span>
  );
}
