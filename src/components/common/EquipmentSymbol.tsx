import { memo } from 'react';
import type { EquipmentCategory } from '../../lib/schema';
import { symbolPath } from '../../lib/symbols';

/**
 * 단선결선도 심볼 (72×72 viewBox) — 사진이 없는 기기(미보유·선로·해당 없음)에 사용.
 * 계통도 타일·상세 패널·기기/제품 페이지가 모두 이 한 벌을 쓴다 (리뷰 M1).
 */
interface Props {
  category: EquipmentCategory;
  equipmentId: string;
  /** px. 생략하면 CSS 로 크기 지정 (페이지용 .eq-symbol) */
  size?: number;
  className?: string;
  /** 접근성 이름. 생략 시 장식용(aria-hidden) */
  label?: string;
}

function EquipmentSymbol({ category, equipmentId, size, className, label }: Props) {
  return (
    <svg
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 72 72"
      className={className ? `eq-symbol ${className}` : 'eq-symbol'}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={symbolPath(category, equipmentId)} />
    </svg>
  );
}

export default memo(EquipmentSymbol);
