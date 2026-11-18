import { useState } from 'react';
import type { EquipmentType } from '../../lib/schema';
import { equipmentImageUrl, equipmentThumbUrl } from '../../data/load';
import EquipmentSymbol from '../common/EquipmentSymbol';

/**
 * 기기 대표 사진, 없으면(또는 로드 실패 시) 단선결선도 심볼 — 사진/심볼 선택만 담당.
 * 심볼은 계통도와 같은 `common/EquipmentSymbol` 한 벌을 쓴다.
 * 제품별 사진은 없으므로 제품 화면도 소속 기기의 대표 사진을 쓴다.
 */
interface Props {
  eq: EquipmentType;
  /** 사진 대체 텍스트. 생략 시 장식용(alt="") */
  alt?: string;
  className?: string;
  /** 작은 자리(목록 아이콘·미니 체인 등)는 160px 썸네일 사용 */
  thumb?: boolean;
  /** 고정 px 크기 (img width/height, 심볼 크기). 생략 시 CSS 로 지정 */
  size?: number;
  /** 심볼만 다른 크기로 (생략 시 size) */
  symbolSize?: number;
  /** 지연 로딩 여부 (기본 true) */
  lazy?: boolean;
}

export default function EquipmentVisual({ eq, alt, className, thumb = false, size, symbolSize, lazy = true }: Props) {
  const src = thumb ? equipmentThumbUrl(eq.id) : equipmentImageUrl(eq.id);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (src && failedSrc !== src) {
    return (
      <img
        src={src}
        alt={alt ?? ''}
        className={className}
        width={size}
        height={size}
        loading={lazy ? 'lazy' : undefined}
        decoding="async"
        onError={() => setFailedSrc(src)}
      />
    );
  }
  return <EquipmentSymbol category={eq.category} equipmentId={eq.id} className={className} label={alt} size={symbolSize ?? size} />;
}
