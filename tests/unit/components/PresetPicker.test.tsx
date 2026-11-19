/**
 * 컴포넌트 테스트 — PresetPicker (수요처 프리셋, 전력시장 토론 P0-3)
 * 가짜 계통도 타일(.diagram__inner .dnode[data-node-id])에 등급·경고 표시가 붙고 떨어지는지.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import PresetPicker from '../../../src/components/market/PresetPicker';
import { usePresetStore } from '../../../src/lib/market/presetStore';
import { getData } from '../../../src/data/load';

const nodeOf = (eqId: string) => getData().diagram.nodes.find((n) => n.equipmentTypeId === eqId && !n.ref)!.id;

function Harness() {
  return (
    <>
      <PresetPicker />
      <div className="diagram__inner">
        {['ups', 'mv-swgr', 'hvdc', 'generator'].map((id) => (
          <div key={id} className="dnode" data-node-id={nodeOf(id)} data-testid={`t-${id}`} />
        ))}
      </div>
    </>
  );
}

afterEach(() => {
  cleanup();
  act(() => usePresetStore.getState().clear());
});

describe('PresetPicker', () => {
  it('데이터센터 선택 → 타일 등급·미보유 경고, 해제하면 원래대로', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('preset-trigger'));
    fireEvent.click(screen.getByTestId('preset-datacenter'));
    expect(document.documentElement.dataset.preset).toBe('datacenter');
    expect(screen.getByTestId('t-mv-swgr').dataset.presetTier).toBe('required');
    expect(screen.getByTestId('t-hvdc').dataset.presetTier).toBeUndefined();
    const ups = screen.getByTestId('t-ups');
    expect(ups.dataset.presetTier).toBe('required');
    if (getData().equipmentTypeById.get('ups')!.coverage === 'missing') {
      expect(ups.dataset.presetWarn).toBe('true');
      expect(screen.getByTestId('preset-warns')).toHaveTextContent('무정전 전원 장치');
    }
    fireEvent.click(screen.getByTestId('preset-clear'));
    expect(document.documentElement.dataset.preset).toBeUndefined();
    expect(ups.dataset.presetTier).toBeUndefined();
  });

  it('수전 방식 자가발전+ESS → 발전기 타일이 수전 방식 추가로 강조', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('preset-trigger'));
    fireEvent.click(screen.getByTestId('preset-fab'));
    expect(screen.getByTestId('t-generator').dataset.presetTier).toBeUndefined();
    fireEvent.click(screen.getByTestId('scenario-self'));
    expect(screen.getByTestId('t-generator').dataset.presetTier).toBe('scenario');
  });

  it('상업빌딩은 수전 방식 선택이 없다', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('preset-trigger'));
    fireEvent.click(screen.getByTestId('preset-building'));
    expect(screen.queryByTestId('scenario-self')).toBeNull();
  });
});
