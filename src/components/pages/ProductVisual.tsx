import { useState } from 'react';
import type { EquipmentType, Product } from '../../lib/schema';
import { getData, productImageUrl } from '../../data/load';
import EquipmentVisual from './EquipmentVisual';

/** 제품 사진이 없어 기기 대표 사진으로 대체할 때 쓰는 문구 (alt·캡션 공용) */
export const FALLBACK_PHOTO_LABEL = '대표 사진(기기 공통)';

/** 제품 사진이 있는지 (products 에 있는 제품만 — 고아 항목 무시) */
export function hasProductPhoto(productId: string): boolean {
  return getData().productImageById.has(productId);
}

interface Props {
  product: Product;
  /** 제품 사진이 없을 때 대체할 기기 (없으면 아무것도 그리지 않음) */
  eq?: EquipmentType;
  /** 사진 대체 텍스트. 생략 시 장식용(alt="") — 대체 사진이면 FALLBACK_PHOTO_LABEL 을 덧붙인다 */
  alt?: string;
  className?: string;
  /** 작은 자리(목록·비교 열 머리)는 160px 썸네일 */
  thumb?: boolean;
  size?: number;
  lazy?: boolean;
}

/**
 * 제품 사진 → 없으면(또는 로드 실패 시) 기기 대표 사진 → 없으면 단선결선도 심볼.
 * 원본 가로(width)보다 크게 늘리지 않는다 (최대 300px 은 global.css 의 img.eq-photo).
 */
export default function ProductVisual({ product, eq, alt, className, thumb = false, size, lazy = true }: Props) {
  const src = productImageUrl(product.id, thumb);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (src && failedSrc !== src) {
    const natural = getData().productImageById.get(product.id)?.width;
    return (
      <img
        src={src}
        alt={alt ?? ''}
        className={`eq-photo${className ? ` ${className}` : ''}`}
        width={size}
        height={size}
        style={!thumb && natural ? { maxWidth: `min(100%, ${Math.min(natural, 300)}px)` } : undefined}
        loading={lazy ? 'lazy' : undefined}
        decoding="async"
        onError={() => setFailedSrc(src)}
        data-photo="product"
      />
    );
  }
  if (!eq) return null;
  return (
    <EquipmentVisual
      eq={eq}
      alt={alt ? `${alt} — ${FALLBACK_PHOTO_LABEL}` : undefined}
      className={className}
      thumb={thumb}
      size={size}
      lazy={lazy}
    />
  );
}
