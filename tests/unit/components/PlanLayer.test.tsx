/**
 * 컴포넌트 테스트 — 계획 파이프라인 레이어(PlanLayer) + 도구줄 [계획] 토글(PlanToggle)
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import PlanLayer from '../../../src/components/market/PlanLayer';
import PlanToggle from '../../../src/components/market/PlanToggle';
import { usePlanStore } from '../../../src/lib/market/planStore';
import { getData } from '../../../src/data/load';
import { getDiagramModel } from '../../../src/lib/diagram/model';

const model = getDiagramModel(getData());

afterEach(() => {
  cleanup();
  usePlanStore.setState({ on: false });
});

describe('PlanLayer', () => {
  it('기본 꺼짐 — 아무것도 그리지 않음', () => {
    const { container } = render(<PlanLayer model={model} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('토글을 켜면 L1~L3·신재생 카드, 수치마다 출처 배지, 미보유·일부 보유 칩', () => {
    render(
      <>
        <PlanToggle />
        <PlanLayer model={model} />
      </>,
    );
    const btn = screen.getByTestId('plan-toggle');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    for (const l of ['L1', 'L2', 'L3', 'REN']) expect(screen.getByTestId(`plan-card-${l}`)).toBeInTheDocument();

    const l1 = screen.getByTestId('plan-card-L1');
    expect(within(l1).getByRole('heading', { name: /계획 기반 설비 소요/ })).toBeInTheDocument();
    const line = within(l1).getByTestId('plan-item-tx-line');
    expect(line).toHaveTextContent('61,183');
    expect(line).toHaveTextContent('단위 달라 비교 불가');
    expect(line.querySelector('[data-coverage="missing"]')).not.toBeNull();
    expect(line.querySelector('[data-coverage="partial"]')).not.toBeNull();
    // 표시된 값마다 출처 링크(새 탭)
    expect(within(line).getAllByRole('link').length).toBe(4); // 11차 2038 · 10차 · 2023 실적 · 2030 전망
    // 일정 변동
    expect(within(l1).getByTestId('plan-project-dangjin-345')).toHaveTextContent('+36개월');
    expect(document.body.textContent).not.toMatch(/발주\s*예측/);

    fireEvent.click(btn);
    expect(screen.queryByTestId('plan-layer')).toBeNull();
  });
});
