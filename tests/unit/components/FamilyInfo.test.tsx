/**
 * 공식 제품군 관련 제품 (FamilyInfo, 2026-11-27)
 * - 공식 사이트에 따로 페이지가 없는 구성 모델(주소 = 제품군 페이지)은 링크로 만들지 않고 '개별 페이지 없음'
 * - 카테고리형 제품이 생긴 시스템 기기도 기기 페이지에 제품군 설명·관련 제품이 계속 나옴
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { FamilyInfo } from '../../../src/components/common/EmptyProducts';
import EquipmentPage from '../../../src/pages/EquipmentPage';
import { getData, resolveProducts } from '../../../src/data/load';

afterEach(cleanup);
const d = getData();
const sas = d.familyByEquipmentId.get('sas')!;

describe('FamilyInfo', () => {
  it('SAS: RTU·보호계전기반 등 구성 모델은 링크 아님 + 안내, 다른 주소(SCADA 제품군)는 링크', () => {
    render(
      <MemoryRouter>
        <FamilyInfo family={sas} prefix="t" />
      </MemoryRouter>,
    );
    const list = screen.getByTestId('t-family-products');
    const rtu = within(list).getByText('RTU').closest('li')!;
    expect(within(rtu).queryByRole('link')).toBeNull();
    expect(rtu).toHaveTextContent('개별 페이지 없음');
    const scada = within(list).getByText(/SCADA \(원방감시제어시스템\)/).closest('li')!;
    expect(within(scada).getByRole('link')).toBeTruthy();
    expect(screen.getByText(/공식 사이트에 따로 소개 페이지가 없고/)).toBeTruthy();
  });
  it('관련 제품 링크 중 같은 주소로 가는 링크가 여럿이면 안 됨 (모든 제품군)', () => {
    for (const fam of d.familyByEquipmentId.values()) {
      cleanup();
      render(
        <MemoryRouter>
          <FamilyInfo family={fam} prefix="t" />
        </MemoryRouter>,
      );
      const list = screen.queryByTestId('t-family-products');
      if (!list) continue;
      const hrefs = within(list)
        .queryAllByRole('link')
        .map((a) => a.getAttribute('href'));
      expect(new Set(hrefs).size, fam.familyUrl).toBe(hrefs.length);
    }
  });
  it('제품이 생긴 시스템 기기(SAS)도 기기 페이지에 제품군 설명이 계속 나옴', () => {
    expect(resolveProducts(d.equipmentTypeById.get('sas')!).length).toBeGreaterThan(0);
    render(
      <MemoryRouter initialEntries={['/equipment/sas']}>
        <Routes>
          <Route path="/equipment/:id" element={<EquipmentPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('equipment-family')).toHaveTextContent(sas.summary.slice(0, 20));
  });
});
