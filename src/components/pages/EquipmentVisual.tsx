import type { ReactElement } from 'react';
import type { EquipmentCategory, EquipmentType } from '../../lib/schema';
import { equipmentImageUrl } from '../../data/load';

/**
 * 기기 대표 사진, 없으면 단선결선도 풍 심볼 (상세 페이지용 — 계통도 노드 심볼과는 별개의 간이판).
 * 제품별 사진은 없으므로 제품 화면도 소속 기기의 대표 사진을 쓴다.
 */
interface Props {
  eq: EquipmentType;
  /** 사진 대체 텍스트. 생략 시 장식용(alt="") */
  alt?: string;
  className?: string;
}

export default function EquipmentVisual({ eq, alt, className }: Props) {
  const src = equipmentImageUrl(eq.id);
  if (src) {
    return <img src={src} alt={alt ?? ''} className={className} loading="lazy" decoding="async" />;
  }
  return <EquipmentSymbol category={eq.category} className={className} label={alt} />;
}

export function EquipmentSymbol({
  category,
  className,
  label,
}: {
  category: EquipmentCategory;
  className?: string;
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 72 72"
      className={`eq-symbol${className ? ` ${className}` : ''}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {SYMBOL_PATHS[category]}
    </svg>
  );
}

const SYMBOL_PATHS: Record<EquipmentCategory, ReactElement> = {
  // 개폐: 끊어진 선 + 기울어진 접점
  switching: (
    <>
      <path d="M36 4 V24" />
      <path d="M36 48 V68" />
      <path d="M36 48 L22 26" />
      <circle cx="36" cy="24" r="2.5" />
    </>
  ),
  // 보호: 선 + 접지로 향하는 화살 (피뢰기·계전기)
  protection: (
    <>
      <path d="M36 4 V20" />
      <rect x="26" y="20" width="20" height="26" rx="2" />
      <path d="M36 26 V38 M31 33 L36 38 L41 33" />
      <path d="M36 46 V56 M24 56 H48 M28 61 H44 M32 66 H40" />
    </>
  ),
  // 변성: 겹친 두 원 (변압기)
  transformation: (
    <>
      <path d="M36 2 V12 M36 60 V70" />
      <circle cx="36" cy="26" r="14" />
      <circle cx="36" cy="46" r="14" />
    </>
  ),
  // 계측: 선 위 원 (CT)
  measurement: (
    <>
      <path d="M4 36 H68" />
      <circle cx="36" cy="36" r="14" />
    </>
  ),
  // 제어: 사각 + 사인파
  control: (
    <>
      <rect x="12" y="16" width="48" height="40" rx="4" />
      <path d="M20 40 C26 26 32 26 36 36 S46 46 52 32" />
    </>
  ),
  // 감시: 모니터
  monitoring: (
    <>
      <rect x="10" y="12" width="52" height="36" rx="3" />
      <path d="M28 60 H44 M36 48 V60" />
      <path d="M18 38 L28 28 L36 34 L48 22" />
    </>
  ),
  // 발전: 원 + ~
  generation: (
    <>
      <circle cx="36" cy="36" r="24" />
      <path d="M24 36 C28 26 32 26 36 36 S44 46 48 36" />
    </>
  ),
  // 선로: 굵은 선 + 케이블 단면
  conductor: (
    <>
      <path d="M4 36 H68" strokeWidth={4} />
      <path d="M18 26 V46 M54 26 V46" />
    </>
  ),
  // 부하: 원 + M
  load: (
    <>
      <path d="M36 2 V12" />
      <circle cx="36" cy="38" r="24" />
      <path d="M26 48 V28 L36 40 L46 28 V48" />
    </>
  ),
  // 시스템: 점선 함체
  system: (
    <>
      <rect x="8" y="10" width="56" height="52" rx="4" strokeDasharray="6 5" />
      <path d="M22 24 H50 M22 36 H50 M22 48 H50" />
    </>
  ),
};
