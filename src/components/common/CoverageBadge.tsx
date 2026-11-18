import type { ReactNode } from 'react';
import type { Coverage } from '../../lib/schema';
import { COVERAGE_ICONS, COVERAGE_LABELS } from '../../lib/labels';
import './CoverageBadge.css';

/** 기존 import 경로 호환 (아이콘 원본은 lib/labels) */
export { COVERAGE_ICONS };

/**
 * 커버리지 표시 단일 컴포넌트 (리뷰 R1) — 색 + 모양이 다른 아이콘 + 텍스트를 한 곳에서 보장.
 * - badge: 원형 아이콘 + 라벨 (기본)
 * - pill : 배경색 알약 (상세 패널 헤더)
 * - chip : 배경색 사각 칩 + 문자 아이콘 (공백 표)
 * - icon : 아이콘만, 장식용 (계통도 노드 배지·범례 — 의미는 부모의 aria-label/옆 텍스트가 전달)
 */
interface Props {
  coverage: Coverage;
  variant?: 'badge' | 'pill' | 'chip' | 'icon';
  /** 표시 텍스트 (기본: COVERAGE_LABELS) */
  label?: ReactNode;
  /** false 면 아이콘만 보이고 라벨은 스크린리더용 (badge·pill·chip) */
  showLabel?: boolean;
  /** true 면 전체를 aria-hidden (옆에 같은 정보가 텍스트로 있을 때) */
  decorative?: boolean;
  testId?: string;
  className?: string;
}

export default function CoverageBadge({
  coverage,
  variant = 'badge',
  label,
  showLabel = true,
  decorative = false,
  testId,
  className,
}: Props) {
  const text = label ?? COVERAGE_LABELS[coverage];
  const extra = className ? ` ${className}` : '';

  if (variant === 'chip') {
    return (
      <span
        className={`cov-chip cov-chip--${coverage}${extra}`}
        data-testid={testId}
        data-coverage={coverage}
        aria-hidden={decorative || undefined}
      >
        <span aria-hidden="true">{COVERAGE_ICONS[coverage]}</span>
        {showLabel ? <span className="cov-chip__label">{text}</span> : !decorative && <span className="visually-hidden">{text}</span>}
      </span>
    );
  }

  const icon = (
    <span className="cov-badge__icon" aria-hidden="true" data-testid={`coverage-icon-${coverage}`}>
      {COVERAGE_ICONS[coverage]}
    </span>
  );

  if (variant === 'icon') {
    return (
      <span className={`cov-badge cov-badge--${coverage}${extra}`} aria-hidden="true" data-testid={testId}>
        {icon}
      </span>
    );
  }

  const pill = variant === 'pill';
  return (
    <span
      className={`cov-badge cov-badge--${coverage}${pill ? ' cov-pill' : ''}${extra}`}
      title={typeof text === 'string' ? text : COVERAGE_LABELS[coverage]}
      data-testid={testId}
      data-coverage={coverage}
      aria-hidden={decorative || undefined}
    >
      {icon}
      {showLabel ? (
        <span className={pill ? 'cov-pill__label' : 'cov-badge__label'}>{text}</span>
      ) : (
        !decorative && <span className="visually-hidden">{text}</span>
      )}
    </span>
  );
}
