import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EquipmentSignals from '../../../src/components/market/EquipmentSignals';

describe('EquipmentSignals', () => {
  it('근거 없는 기기는 아무것도 그리지 않음', () => {
    const { container } = render(<EquipmentSignals equipmentId="gearbox" layer="L7" />);
    expect(container.firstChild).toBeNull();
  });

  it('주변압기: 조달·한전 투자 줄과 출처 배지, 기본 펼침', () => {
    const { container } = render(<EquipmentSignals equipmentId="main-tr" layer="L2" />);
    const details = container.querySelector('details');
    expect(details?.open).toBe(true);
    expect(screen.getByText('조달 난이도')).toBeTruthy();
    expect(screen.getByText('한전 투자')).toBeTruthy();
    expect(container.querySelectorAll('a.msrc').length).toBeGreaterThanOrEqual(2);
  });

  it('누전차단기: KEC 개정 조항·시행·경과조치 표시', () => {
    render(<EquipmentSignals equipmentId="elcb" layer="L7" />);
    expect(screen.getByText(/KEC 214\.2\.1/)).toBeTruthy();
    expect(screen.getByText(/경과조치/)).toBeTruthy();
  });
});
