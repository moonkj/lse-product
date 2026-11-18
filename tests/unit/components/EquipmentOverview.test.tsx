/**
 * EquipmentOverview — 요약 문단 + 항목(dt 라벨 · dd 본문), 근거 줄 없음, overview 없으면 description 한 줄
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import EquipmentOverview from '../../../src/components/common/EquipmentOverview';
import type { EquipmentType } from '../../../src/lib/schema';
import { getData } from '../../../src/data/load';

afterEach(cleanup);

const base = getData().equipmentTypes[0];
const mk = (overview?: EquipmentType['overview']): EquipmentType => ({ ...base, description: '한 줄 요약', overview });

describe('EquipmentOverview', () => {
  it('요약 문단을 먼저, 그 아래 항목 라벨(dt)·본문(dd)', () => {
    render(
      <EquipmentOverview
        testId="t"
        eq={mk({
          summary: '요약 문장',
          points: [
            { label: '역할', text: '역할 본문' },
            { label: '선정 포인트', text: '선정 본문' },
          ],
          basis: 'catalog',
          sources: [{ title: '카탈로그', url: 'https://www.ls-electric.com/a.pdf', page: 2 }],
        })}
      />,
    );
    const root = screen.getByTestId('t');
    expect(root).toHaveAttribute('data-overview', 'true');
    expect(root.firstElementChild).toBe(screen.getByTestId('overview-summary'));
    expect(screen.getByTestId('overview-summary')).toHaveTextContent('요약 문장');
    const dl = screen.getByTestId('overview-points');
    expect(dl.tagName).toBe('DL');
    expect([...dl.querySelectorAll('dt')].map((d) => d.textContent)).toEqual(['역할', '선정 포인트']);
    expect([...dl.querySelectorAll('dd')].map((d) => d.textContent)).toEqual(['역할 본문', '선정 본문']);
  });

  it('근거 줄·출처 링크는 보이지 않는다', () => {
    render(
      <EquipmentOverview
        testId="t"
        eq={mk({ summary: '요약', points: [{ label: '역할', text: '본문' }], basis: 'catalog', sources: [{ title: '카탈로그', url: 'https://www.ls-electric.com/a.pdf' }] })}
      />,
    );
    const root = screen.getByTestId('t');
    expect(root).not.toHaveTextContent('근거');
    expect(root).not.toHaveTextContent('일반 기술 설명');
    expect(within(root).queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryByTestId('overview-sources')).toBeNull();
  });

  it('overview 없으면 description 만, 항목 없음', () => {
    render(<EquipmentOverview eq={mk(undefined)} testId="t" />);
    expect(screen.getByTestId('t')).toHaveTextContent('한 줄 요약');
    expect(screen.getByTestId('t')).toHaveAttribute('data-overview', 'false');
    expect(screen.queryByTestId('overview-points')).toBeNull();
  });
});
