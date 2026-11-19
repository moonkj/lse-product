/**
 * 사이드바 계층 축 (5라운드 디자이너 합의)
 *  - 줄 높이 = 밴드 높이 비례, 최소 56·최대 120
 *  - 보이는 계층 판정
 *  - 줄 구성: testid·화면낭독기 문구·공백 알약·연계 묶음·전체 보유 요약
 *  - 공백만 보기에서도 활성 줄 강조는 계층색 클래스(빨강 규칙 없음)
 */
import { describe, it, expect, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LayerNav, { NAV_ROW_MAX, NAV_ROW_MIN, axisRowHeights, visibleLayersKey } from '../../../src/components/layout/LayerNav';
import { getDiagramModel } from '../../../src/lib/diagram/model';
import { viewStore } from '../../../src/lib/diagram/view';

afterEach(() => {
  cleanup();
  viewStore.set({ ready: false, layer: null, focus: null, x: 0, y: 0, w: 0, h: 0 });
});

describe('axisRowHeights', () => {
  it('밴드 높이에 비례하고 최소·최대로 자른다', () => {
    const bands = [540, 540, 540, 864, 540, 540, 834];
    const h = axisRowHeights(bands, 600);
    expect(h[3]).toBeGreaterThan(h[0]);
    expect(h.every((v) => v >= NAV_ROW_MIN && v <= NAV_ROW_MAX)).toBe(true);
    expect(axisRowHeights(bands, 100).every((v) => v === NAV_ROW_MIN)).toBe(true);
    // 최대에 걸려 남는 높이는 고르게 나눠 빈칸 없음
    const wide = axisRowHeights(bands, 700);
    expect(wide.reduce((a, b) => a + b, 0) + 2 * (bands.length - 1)).toBeGreaterThan(700 - bands.length);
    expect(axisRowHeights(bands, 5000).every((v) => v > NAV_ROW_MAX)).toBe(true);
  });
});

describe('visibleLayersKey', () => {
  it('보이는 영역과 겹치는 계층만', () => {
    const model = getDiagramModel();
    const l4 = model.layerRect.get('L4')!;
    const key = visibleLayersKey(model, { x: 0, y: l4.y + 10, w: 800, h: 300 });
    expect(key).toBe('L4');
    expect(visibleLayersKey(model, { x: 0, y: 0, w: 0, h: 0 })).toBe('');
  });
});

describe('LayerNav', () => {
  it('L1~L7 축 + 연계 묶음 + 전체 보유 요약, 화면낭독기 문구 유지', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <LayerNav />
      </MemoryRouter>,
    );
    const model = getDiagramModel();
    for (const l of model.layers) expect(screen.getByTestId(`layer-nav-${l.id}`)).toBeInTheDocument();
    const l1 = screen.getByTestId('layer-nav-L1');
    const s = model.layerStats.get('L1')!;
    expect(l1).toHaveAccessibleName(new RegExp(`보유 ${s.owned} / 전체 ${s.total}, 공백 ${s.gaps}`));
    expect(l1.textContent).toContain('765/345kV');
    if (s.gaps > 0) expect(l1.querySelector('.layer-nav__gap.has-gap')?.textContent).toBe(`공백 ${s.gaps}`);
    // 연계 묶음
    const side = screen.getByRole('heading', { name: '연계' }).parentElement!;
    expect(side.querySelector('[data-testid="layer-nav-MON"]')).not.toBeNull();
    expect(side.querySelector('[data-testid="layer-nav-L1"]')).toBeNull();
    // 요약
    const total = [...model.layerStats.values()].reduce((a, b) => a + b.total, 0);
    expect(screen.getByTestId('layer-nav-summary').textContent).toContain(`/${total}종`);
    const cc = model.coverageCounts;
    expect(screen.getByTestId('layer-nav-summary').textContent).toContain(`(미보유 ${cc.missing} · 일부 ${cc.partial})`);
    expect(screen.getByTestId('layer-nav-gap-table-link')).toHaveAttribute('href', '/gap');
    // 마우스 올림 → <html data-hover-layer>, 떠나면 제거
    fireEvent.mouseEnter(l1);
    expect(document.documentElement.getAttribute('data-hover-layer')).toBe('L1');
    fireEvent.mouseLeave(l1);
    expect(document.documentElement.hasAttribute('data-hover-layer')).toBe(false);
    expect(screen.getByTestId('gap-table-link-mobile')).toHaveAttribute('href', '/gap');
  });

  it('지금 계층 aria-current, 보이는 계층·선택 영역 클래스 (공백 모드에서도 같은 클래스)', () => {
    const model = getDiagramModel();
    const l4 = model.layerRect.get('L4')!;
    render(
      <MemoryRouter initialEntries={['/?mode=gap']}>
        <LayerNav />
      </MemoryRouter>,
    );
    act(() => viewStore.set({ ready: true, layer: 'L4', focus: 'L4', x: 0, y: l4.y - 100, w: 1200, h: 600 }));
    const btn = screen.getByTestId('layer-nav-L4');
    expect(btn).toHaveAttribute('aria-current', 'true');
    expect(btn).toHaveClass('is-current', 'is-visible', 'is-focus', 'layer-nav__btn--l4');
    expect(screen.getByTestId('layer-nav-L3')).toHaveClass('is-visible');
    expect(screen.getByTestId('layer-nav-L3')).not.toHaveAttribute('aria-current');
    expect(screen.getByTestId('layer-nav-L1')).not.toHaveClass('is-visible');
  });
});
