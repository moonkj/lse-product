/**
 * 컴포넌트 테스트 (CT-01) — CoverageBadge (6상태, v0.6 R3): 색약 대응 = 색(클래스) + 아이콘 + 텍스트 라벨 3중 표시
 * docs/test-plan.md §3b
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import CoverageBadge, { COVERAGE_ICONS } from '../../../src/components/common/CoverageBadge';
import { COVERAGES, COVERAGE_LABELS } from '../../../src/lib/schema';

afterEach(cleanup);

describe('CT-01 CoverageBadge', () => {
  it('7개 상태(개선 R3 sourced, 2026-11-23 developing 추가) 아이콘·라벨이 서로 모두 다르다 (모양만으로 구분 가능)', () => {
    expect(COVERAGES).toHaveLength(7);
    expect(COVERAGES).toContain('developing');
    expect(COVERAGES).toContain('sourced');
    expect(COVERAGES.every((c) => !!COVERAGE_ICONS[c]?.trim()), '아이콘 없는 상태').toBe(true);
    expect(new Set(COVERAGES.map((c) => COVERAGE_ICONS[c])).size).toBe(7);
    expect(new Set(COVERAGES.map((c) => COVERAGE_LABELS[c])).size).toBe(7);
  });

  it('sourced 라벨은 "패널 구성품" 을 포함 (사용자 승인 용어)', () => {
    render(<CoverageBadge coverage="sourced" testId="badge" />);
    expect(screen.getByTestId('badge')).toHaveTextContent('패널 구성품');
  });

  it.each(COVERAGES)('%s: 색 클래스 + 아이콘 + 라벨 텍스트를 함께 렌더', (c) => {
    render(<CoverageBadge coverage={c} testId="badge" />);
    const badge = screen.getByTestId('badge');
    expect(badge).toHaveAttribute('data-coverage', c);
    expect(badge).toHaveClass(`cov-badge--${c}`); // 색은 상태별 클래스로 지정
    const icon = screen.getByTestId(`coverage-icon-${c}`);
    expect(icon).toHaveTextContent(COVERAGE_ICONS[c]);
    expect(icon).toHaveAttribute('aria-hidden', 'true'); // 아이콘은 장식, 의미는 라벨이 전달
    expect(badge).toHaveTextContent(COVERAGE_LABELS[c]);
  });

  it.each(COVERAGES)('%s: showLabel=false 여도 스크린리더용 라벨은 남는다', (c) => {
    render(<CoverageBadge coverage={c} showLabel={false} testId="badge" />);
    const hidden = screen.getByText(COVERAGE_LABELS[c]);
    expect(hidden).toHaveClass('visually-hidden');
    expect(screen.getByTestId(`coverage-icon-${c}`)).toBeInTheDocument();
  });
});
