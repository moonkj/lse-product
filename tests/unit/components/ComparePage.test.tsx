/**
 * 컴포넌트 테스트 (CT-07) — ComparePage 비교 표 행 생성·차이만 보기·안내.
 * 행 생성 함수(equipmentSections·productSections)가 페이지 내부에 있어 화면 렌더로 검증한다.
 * 합성 데이터셋(tests/unit/lib/compare-fixture.ts)으로 getData() 대체 — 기대 행·값은 손으로 적음.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

/** specs.json 지연 로딩(M6) 흉내: ready = peekSpecs 즉시 / loading = 끝나지 않음 / error = loadSpecs 거절 */
const specsMode = vi.hoisted(() => ({ value: 'ready' as 'ready' | 'loading' | 'error' }));

vi.mock('../../../src/data/load', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/data/load')>();
  const { FAKE, FAKE_SPECS } = await import('../lib/compare-fixture');
  return {
    ...actual,
    getData: () => FAKE,
    useData: () => FAKE,
    resolveProducts: (eq: Parameters<typeof actual.resolveProducts>[0], data = FAKE) => actual.resolveProducts(eq, data),
    resolveCategories: (eq: Parameters<typeof actual.resolveCategories>[0], data = FAKE) => actual.resolveCategories(eq, data),
    docsByProductId: (id: string) => FAKE.docsByProductId.get(id),
    peekSpecs: () => (specsMode.value === 'ready' ? FAKE_SPECS : undefined),
    loadSpecs: () =>
      specsMode.value === 'ready'
        ? Promise.resolve(FAKE_SPECS)
        : specsMode.value === 'error'
          ? Promise.reject(new Error('chunk load failed'))
          : new Promise<never>(() => {}),
    equipmentImageUrl: () => undefined,
    equipmentThumbUrl: () => undefined,
  };
});

import ComparePage from '../../../src/pages/ComparePage';
import { useCompareStore } from '../../../src/store/useCompareStore';
import { URL1, URL2 } from '../lib/compare-fixture';

let consoleError: { mock: { calls: unknown[][] }; mockRestore: () => void };
beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  useCompareStore.setState({ equipment: [], product: [], active: 'equipment' });
  specsMode.value = 'ready';
});
afterEach(() => {
  cleanup();
  consoleError.mockRestore();
});

let lastSearch = '';
function LocationProbe() {
  lastSearch = useLocation().search;
  return null;
}
function renderAt(query: string) {
  return render(
    <MemoryRouter initialEntries={[`/compare?${query}`]}>
      <Routes>
        <Route
          path="/compare"
          element={
            <>
              <ComparePage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}
const rowKeys = (section: 'basic' | 'specs') =>
  within(screen.getByTestId(`compare-section-${section}`))
    .getAllByTestId(/^compare-row-/)
    .map((r) => r.getAttribute('data-testid')!.replace('compare-row-', ''));
const cells = (rowKey: string) => within(screen.getByTestId(`compare-row-${rowKey}`)).getAllByRole('cell');
const reactKeyWarnings = (): unknown[][] => consoleError.mock.calls.filter((c) => String(c[0]).includes('same key'));

const EQ_BASE_ROWS = ['layer', 'category', 'coverage', 'products', 'docs', 'description', 'learn', 'upstream', 'downstream'];

describe('CT-07 기기 비교 (/compare?type=equipment)', () => {
  it('열 2개 + 기본 정보 9행(고정 순서) + 대표 사양: 수집 제품 행 + 키 합집합(SPEC_KEYS 순서 → 비표준)', () => {
    renderAt('type=equipment&ids=eq-a,eq-b');
    expect(screen.getByTestId('compare-col-eq-a')).toHaveTextContent('기기 A');
    expect(screen.getByTestId('compare-col-eq-b')).toHaveTextContent('기기 B');
    expect(rowKeys('basic')).toEqual(EQ_BASE_ROWS);
    expect(rowKeys('specs')).toEqual(['spec-coverage', 'spec-ratedVoltage', 'spec-ratedCurrent', 'spec-breakingCapacity', 'spec-poles', 'spec-ipRating']);
    expect(cells('spec-coverage').map((c) => c.textContent)).toEqual(['2 / 2개', '0 / 1개']);
    // 비표준 키 행 이름 = 데이터 label, 표준 키 = SPEC_KEYS 라벨
    expect(within(screen.getByTestId('compare-row-spec-ipRating')).getByRole('rowheader')).toHaveTextContent('보호등급(IP)');
    expect(within(screen.getByTestId('compare-row-spec-ratedVoltage')).getByRole('rowheader')).toHaveTextContent('정격전압');
    // 값 없음 = "—"
    expect(cells('spec-ratedVoltage')[1]).toHaveTextContent('—');
    // 같은 key 를 두 제품이 가지면 제품별로 나열, 페이지 링크는 item.page (없으면 source.page)
    const v = cells('spec-ratedVoltage')[0];
    expect(v).toHaveTextContent('제품 하나: 690 V');
    expect(v).toHaveTextContent('제품 둘: 690 V');
    const hrefs = within(v).getAllByRole('link').map((a) => a.getAttribute('href')).filter((h) => h?.startsWith('https'));
    expect(hrefs).toEqual([`${URL1}#page=3`, `${URL2}#page=6`]);
    // 검수 전 제품(P90001) 포함 → 머리글 배지
    expect(screen.getAllByTestId('compare-unreviewed').length).toBeGreaterThan(0);
  });

  it('상류·하류 연결 행 = 모선 너머 기기 (형제 피더 제외), 끝점·택1 표기', () => {
    renderAt('type=equipment&ids=eq-a,eq-b');
    expect(cells('upstream')[0]).toHaveTextContent('UP');
    expect(cells('upstream')[0]).toHaveTextContent('MON (신호)');
    expect(cells('upstream')[0]).not.toHaveTextContent('기기 B');
    expect(cells('downstream')[0]).toHaveTextContent('기기 C (택1)');
    expect(cells('downstream')[0]).toHaveTextContent('비상 부하');
    expect(cells('downstream')[1]).toHaveTextContent('—');
  });

  it('한 제품의 같은 key 여러 값(P90001 극수 3·4)이 모두 보이고, 두 번째 값(item.page 없음)은 source.page 링크', () => {
    renderAt('type=equipment&ids=eq-a,eq-b');
    const c = cells('spec-poles')[0];
    expect(within(c).getAllByRole('listitem').map((li) => li.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      expect.stringContaining('3 P'),
      expect.stringContaining('4 P'),
    ]);
    expect(within(c).getAllByRole('link').map((a) => a.getAttribute('href')).filter((h) => h?.startsWith('https'))).toEqual([
      `${URL1}#page=5`,
      `${URL1}#page=2`,
    ]);
  });

  // v0.9 B1 회귀 방지 (v1.0 수정: li key = `${product.id}-${i}`)
  it('B1 한 제품의 같은 key 여러 값 → React key 중복 경고 없음', () => {
    renderAt('type=equipment&ids=eq-a,eq-b');
    expect(reactKeyWarnings().map((c: unknown[]) => String(c[1] ?? c[0]).slice(0, 80))).toEqual([]);
  });

  it('차이만 보기: 모든 열 값이 같은 행(계층·분류·학습)을 숨기고 건수 안내, 다시 누르면 복원 (상류는 eq-a 에만 신호선 → 다름)', () => {
    renderAt('type=equipment&ids=eq-a,eq-b');
    const btn = screen.getByTestId('compare-diff-only');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(rowKeys('basic')).toEqual(['coverage', 'products', 'docs', 'description', 'upstream', 'downstream']);
    expect(screen.getByText('값이 모두 같은 3개 행을 숨겼습니다.')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(rowKeys('basic')).toEqual(EQ_BASE_ROWS);
  });

  it('사양 없는 기기끼리 → "카탈로그 사양 미수집" 1행, 차이만 보기에서 사양 구역 자체가 사라짐', () => {
    renderAt('type=equipment&ids=eq-b,eq-d');
    expect(rowKeys('specs')).toEqual(['spec-none']);
    fireEvent.click(screen.getByTestId('compare-diff-only'));
    expect(screen.queryByTestId('compare-section-specs')).toBeNull();
  });

  it('열 빼기: URL ids 갱신 + 담기 목록에서도 제거, 1개 남으면 빈 상태', () => {
    useCompareStore.setState({ equipment: ['eq-a', 'eq-b', 'eq-c'], product: [], active: 'equipment' });
    renderAt('type=equipment&ids=eq-a,eq-b,eq-c');
    fireEvent.click(screen.getByTestId('compare-remove-eq-b'));
    expect(screen.queryByTestId('compare-col-eq-b')).toBeNull();
    expect(new URLSearchParams(lastSearch).get('ids')).toBe('eq-a,eq-c');
    expect(useCompareStore.getState().equipment).toEqual(['eq-a', 'eq-c']);
    fireEvent.click(screen.getByTestId('compare-remove-eq-c'));
    expect(screen.getByTestId('compare-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('compare-table')).toBeNull();
  });

  it('(v1.0 L3) 공유 링크에서 열 빼기 → URL 만 갱신, 내 담기 목록(다른 비교)은 그대로', () => {
    useCompareStore.setState({ equipment: ['eq-b', 'eq-d'], product: [], active: 'equipment' });
    renderAt('type=equipment&ids=eq-a,eq-b,eq-c');
    fireEvent.click(screen.getByTestId('compare-remove-eq-b'));
    expect(new URLSearchParams(lastSearch).get('ids')).toBe('eq-a,eq-c');
    expect(lastSearch).toContain('ids=eq-a,eq-c'); // L4 쉼표 그대로 (%2C 아님)
    expect(useCompareStore.getState().equipment).toEqual(['eq-b', 'eq-d']);
  });

  it('(v1.0 L3) 내 목록과 같은 비교면 순서가 달라도 목록에서도 제거', () => {
    useCompareStore.setState({ equipment: ['eq-c', 'eq-a', 'eq-b'], product: [], active: 'equipment' });
    renderAt('type=equipment&ids=eq-a,eq-b,eq-c');
    fireEvent.click(screen.getByTestId('compare-remove-eq-a'));
    expect(useCompareStore.getState().equipment).toEqual(['eq-c', 'eq-b']);
  });

  it('(v1.0 L7) 차이만 보기는 열 빼기에서 유지, 다른 비교로 옮기면 꺼짐', () => {
    renderAt('type=equipment&ids=eq-a,eq-b,eq-c');
    fireEvent.click(screen.getByTestId('compare-diff-only'));
    fireEvent.click(screen.getByTestId('compare-remove-eq-c'));
    expect(screen.getByTestId('compare-diff-only')).toHaveAttribute('aria-pressed', 'true');
  });

  it('(v1.0 M6) 사양 불러오는 중 → spec-loading 행, 실패 → spec-error 행 + 안내, 기본 정보는 그대로', async () => {
    specsMode.value = 'loading';
    renderAt('type=equipment&ids=eq-a,eq-b');
    expect(rowKeys('specs')).toEqual(['spec-loading']);
    expect(rowKeys('basic')).toEqual(EQ_BASE_ROWS);
    cleanup();
    specsMode.value = 'error';
    renderAt('type=product&ids=P90001,P90002');
    expect(await screen.findByTestId('compare-row-spec-error')).toHaveTextContent('사양 데이터를 불러오지 못했습니다');
    expect(rowKeys('specs')).toEqual(['spec-error']);
    expect(screen.getByTestId('compare-notice')).toHaveTextContent('사양 데이터를 불러오지 못했습니다');
    expect(screen.queryByTestId('compare-unreviewed')).toBeNull();
    // 실패 행은 차이만 보기에서도 남음 (keep)
    fireEvent.click(screen.getByTestId('compare-diff-only'));
    expect(screen.getByTestId('compare-row-spec-error')).toBeInTheDocument();
  });

  it('(v1.0) 잘못된 type → 안내 + 빈 상태', () => {
    renderAt('type=cars&ids=eq-a,eq-b');
    expect(screen.getByTestId('compare-notice')).toHaveTextContent('type=cars');
    expect(screen.getByTestId('compare-empty')).toBeInTheDocument();
  });
});

describe('CT-07 제품 비교 (/compare?type=product)', () => {
  it('기본 5행 + 사양 행(키 합집합, SPEC_KEYS 순 → 비표준) + 출처 행, 값 없음 "—"', () => {
    renderAt('type=product&ids=P90001,P90002');
    expect(rowKeys('basic')).toEqual(['equipment', 'category-path', 'business', 'status', 'docs']);
    expect(rowKeys('specs')).toEqual(['spec-ratedVoltage', 'spec-ratedCurrent', 'spec-breakingCapacity', 'spec-poles', 'spec-ipRating', 'spec-source']);
    expect(cells('spec-ratedCurrent').map((c) => c.textContent?.trim())).toEqual([expect.stringContaining('630 A'), expect.stringContaining('—')]);
    expect(cells('spec-breakingCapacity')[0]).toHaveTextContent('—');
    // 한 제품 같은 key 2개 → 한 칸에 둘 다
    expect(within(cells('spec-poles')[0]).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByTestId('compare-notice')).toBeNull(); // 같은 기기 제품 → 섞기 안내 없음
  });

  it('출처 행: 카탈로그 링크 #page=source.page, 검수 전/완료 배지, 추출일', () => {
    renderAt('type=product&ids=P90001,P90002');
    const s1 = screen.getByTestId('compare-spec-source-P90001');
    expect(within(s1).getByRole('link')).toHaveAttribute('href', `${URL1}#page=2`);
    expect(within(s1).getByTestId('compare-unreviewed')).toBeInTheDocument();
    expect(s1).toHaveTextContent('추출일 2026-11-18');
    const s2 = screen.getByTestId('compare-spec-source-P90002');
    expect(within(s2).getByRole('link')).toHaveAttribute('href', `${URL2}#page=6`);
    expect(within(s2).queryByTestId('compare-unreviewed')).toBeNull();
    expect(s2).toHaveTextContent('검수 완료');
  });

  it('차이만 보기: 같은 값 행(소속 기기·경로·사업·상태·정격전압 690 V·IP20) 숨김, 출처 행은 유지', () => {
    renderAt('type=product&ids=P90001,P90002');
    fireEvent.click(screen.getByTestId('compare-diff-only'));
    expect(rowKeys('basic')).toEqual(['docs']);
    expect(rowKeys('specs')).toEqual(['spec-ratedCurrent', 'spec-breakingCapacity', 'spec-poles', 'spec-source']);
  });

  it('값 없음 칸 구분: 사양 자체 없음 = "사양 미수집", 사양은 있으나 key 없음 = "카탈로그에 없음"', () => {
    renderAt('type=product&ids=P90002,P90003,P90004');
    const [p2, p3, p4] = cells('spec-breakingCapacity');
    expect(p2).toHaveTextContent('50 kA');
    expect(p3).toHaveTextContent('사양 미수집');
    expect(p4).toHaveTextContent('카탈로그에 없음');
  });

  it('사양 없는 제품끼리: 출처 행은 값이 같아도(둘 다 미수집) 차이만 보기에서 유지', () => {
    renderAt('type=product&ids=P90003,P90006');
    expect(rowKeys('specs')).toEqual(['spec-none', 'spec-source']);
    fireEvent.click(screen.getByTestId('compare-diff-only'));
    expect(rowKeys('specs')).toEqual(['spec-source']);
  });

  it('(v1.0 M3) 차이만 보기는 정규화 비교: "690 V" = "６９０ Vac" → 같은 값으로 숨김 (화면 표기는 원문)', () => {
    renderAt('type=product&ids=P90001,P90004');
    expect(cells('spec-ratedVoltage')[1]).toHaveTextContent('６９０ Vac');
    fireEvent.click(screen.getByTestId('compare-diff-only'));
    expect(screen.queryByTestId('compare-row-spec-ratedVoltage')).toBeNull();
  });

  it('서로 다른 기기의 제품(공통 기기 없음) → 섞기 안내', () => {
    renderAt('type=product&ids=P90001,P90004');
    expect(screen.getByTestId('compare-notice')).toHaveTextContent('서로 다른 기기의 제품');
  });

  it('(v1.0 M8) 첫 기기는 달라도 공통 소속 기기가 있으면 안내 없음 + 소속 기기 칸·열 부제 = 공통 기기', () => {
    renderAt('type=product&ids=P90002,P90004');
    expect(screen.queryByTestId('compare-notice')).toBeNull();
    expect(cells('equipment').map((c) => c.textContent)).toEqual([expect.stringContaining('기기 E'), expect.stringContaining('기기 E')]);
    expect(screen.getByTestId('compare-col-P90002')).toHaveTextContent('기기 E');
  });

  it('없는 id·4개 초과 → 안내 목록, 남은 항목이 1개면 빈 상태', () => {
    renderAt('type=product&ids=P90001,NOPE');
    expect(screen.getByTestId('compare-notice')).toHaveTextContent('등록되지 않은 항목 1개(NOPE)');
    expect(screen.getByTestId('compare-empty')).toBeInTheDocument();
    cleanup();
    renderAt('type=product&ids=P90001,P90002,P90003,P90004,P90005');
    expect(screen.getByTestId('compare-notice')).toHaveTextContent('1개는 제외');
    expect(screen.getAllByTestId(/^compare-col-/)).toHaveLength(4);
  });

  it('빈 상태: 담아 둔 목록이 2개 이상이면 그 종류 비교 링크', () => {
    useCompareStore.setState({ equipment: ['eq-a'], product: ['P90001', 'P90002'], active: 'product' });
    renderAt('');
    const empty = screen.getByTestId('compare-empty');
    const links = within(empty).getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(links).toContain('/compare?type=product&ids=P90001,P90002');
    expect(links.some((h) => h?.includes('type=equipment'))).toBe(false);
  });
});
