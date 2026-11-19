import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import CoverageBadge from './CoverageBadge';
import './Badge.css';

/**
 * 배지 4종 (디자인 토론 P1 — 칩·배지 11종 정리). 생김새만 보고 누를 수 있는지 알 수 있게 역할을 나눈다.
 * - StatusBadge: 커버리지 6상태 전용 (= CoverageBadge, ✓ 원 아이콘은 '보유'에만)
 * - Tag        : 메타 정보, 누를 수 없음 — 회색 사각(radius 4)
 * - FilterChip : 토글 필터, pill + aria-pressed
 * - Count      : 숫자 (제목 옆 "· 6", "2/4" 등)
 * 링크·이동은 배지가 아니라 Button(ghost) 으로.
 */
export const StatusBadge = CoverageBadge;

/** Tag 톤 — neutral 기본, layer(계층 밴드 색), gap 후보/확정(공백 표 신뢰도), warn(미검수) */
export type TagTone = 'neutral' | 'layer' | 'candidate' | 'confirmed' | 'warn';

interface TagProps {
  children: ReactNode;
  tone?: TagTone;
  /** 앞에 붙는 작은 점 (예: 판매 중 · 단종 — 상태 의미는 글자로) */
  dot?: boolean;
  className?: string;
  style?: CSSProperties;
  testId?: string;
  title?: string;
  [data: `data-${string}`]: string | undefined;
}

export function Tag({ children, tone = 'neutral', dot, className, testId, ...rest }: TagProps) {
  return (
    <span {...rest} className={`tag tag--${tone}${className ? ` ${className}` : ''}`} data-testid={testId}>
      {dot && <span className="tag__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

type FilterChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> & {
  pressed: boolean;
  testId?: string;
};

export function FilterChip({ pressed, className, testId, type = 'button', ...rest }: FilterChipProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-pressed={pressed}
      data-testid={testId}
      className={`fchip${className ? ` ${className}` : ''}`}
    />
  );
}

export function Count({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={`count${className ? ` ${className}` : ''}`}>{children}</span>;
}
