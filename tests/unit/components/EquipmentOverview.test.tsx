/**
 * EquipmentOverview 근거 줄 — 같은 URL 쪽 묶음, 최대 3묶음 + "외 N건", overview 없으면 description
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import EquipmentOverview from '../../../src/components/common/EquipmentOverview';
import type { EquipmentType } from '../../../src/lib/schema';
import { getData } from '../../../src/data/load';

afterEach(cleanup);

const base = getData().equipmentTypes[0];
const mk = (overview?: EquipmentType['overview']): EquipmentType => ({ ...base, description: '한 줄 요약', overview });
const U = (n: number) => `https://www.ls-electric.com/doc${n}.pdf`;

describe('EquipmentOverview', () => {
  it('같은 URL 쪽은 "p.2·5" 로 묶고 각 쪽은 #page=N 링크', () => {
    render(<EquipmentOverview eq={mk({ text: '본문', basis: 'catalog', sources: [{ title: '[Susol VCB] 카탈로그', url: U(1), page: 5 }, { title: '[Susol VCB] 카탈로그', url: U(1), page: 2 }] })} />);
    const src = screen.getByTestId('overview-sources');
    expect(src.textContent).toMatch(/근거: \[Susol VCB\] 카탈로그 p\.\[Susol VCB\] 카탈로그 2쪽 \(새 탭에서 열림\)·/);
    const hrefs = within(src).getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([`${U(1)}#page=2`, `${U(1)}#page=5`]);
  });

  it('출처 묶음 4개 이상 → 3개만 + "외 N건"', () => {
    const sources = [1, 2, 3, 4, 5].map((n) => ({ title: `문서${n}`, url: U(n) }));
    render(<EquipmentOverview eq={mk({ text: '본문', basis: 'catalog', sources })} />);
    const src = screen.getByTestId('overview-sources');
    expect(within(src).getAllByRole('link')).toHaveLength(3);
    expect(src).toHaveTextContent(/외 2건$/);
  });

  it('overview 없으면 description 만, 근거 줄 없음', () => {
    render(<EquipmentOverview eq={mk(undefined)} testId="t" />);
    expect(screen.getByTestId('t')).toHaveTextContent('한 줄 요약');
    expect(screen.queryByTestId('overview-sources')).toBeNull();
  });
});
