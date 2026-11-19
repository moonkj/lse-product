/**
 * 컴포넌트 테스트 (CT-04) — DetailPanel: 제품 0개 기기 → 공식 카테고리(제품군) 링크로 대체, 공백 기기 → 공백 안내
 * docs/test-plan.md §3b. 패널은 URL ?node= 가 원본이므로 MemoryRouter 로 진입.
 * 대상 기기는 실제 데이터에서 조건으로 고른다 (id 하드코딩 금지 — 없으면 skip).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate, type NavigateFunction } from 'react-router-dom';
import DetailPanel from '../../../src/components/panel/DetailPanel';
import { getData, resolveCategories, resolveProducts } from '../../../src/data/load';
import { getDiagramModel } from '../../../src/lib/diagram/model';
import { resetUiStore, useUiStore } from '../../../src/store/useUiStore';
import { useCompareStore } from '../../../src/store/useCompareStore';

afterEach(cleanup);

const model = getDiagramModel(getData());
const ownedNoProducts = model.nodes.find(
  (n) => (n.coverage === 'owned' || n.coverage === 'partial') && resolveProducts(n.eq).length === 0 && resolveCategories(n.eq).length > 0,
);
const missingNode = model.nodes.find((n) => n.coverage === 'missing');
const withProducts = model.nodes.find((n) => resolveProducts(n.eq).length > 0);

function renderAt(nodeId: string) {
  return render(
    <MemoryRouter initialEntries={[`/?node=${nodeId}`]}>
      <DetailPanel />
    </MemoryRouter>,
  );
}

describe('CT-04 DetailPanel', () => {
  it.skipIf(!ownedNoProducts)('제품 0개인 보유 기기 → 공식 제품군 정보(설명·관련 제품) + 공식 페이지 링크(새 탭)', () => {
    const n = ownedNoProducts!;
    renderAt(n.id);
    expect(screen.getByTestId('detail-title')).toHaveTextContent(n.eq.name);
    expect(screen.queryByTestId('detail-product-list')).toBeNull();
    const empty = screen.getByTestId('detail-empty-products');
    // 2026-11-19: 시스템·솔루션 기기는 공식 제품군 설명·관련 제품을 보여 준다 (families.json)
    const family = getData().familyByEquipmentId.get(n.eq.id);
    if (family) {
      expect(within(empty).getByTestId('detail-family')).toHaveTextContent(family.summary.slice(0, 20));
      if (family.products.length) expect(within(within(empty).getByTestId('detail-family-products')).getAllByRole('listitem')).toHaveLength(family.products.length);
    }
    const linkList = within(empty).getByTestId('detail-category-links');
    const links = within(linkList).getAllByRole('link');
    const cats = resolveCategories(n.eq);
    const expected = [...(family ? [family.familyUrl] : []), ...cats.map((c) => c.url)];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(expected);
    links.forEach((a) => {
      expect(a).toHaveAttribute('target', '_blank');
      expect(a.getAttribute('rel')).toMatch(/noopener/);
    });
    expect(empty).not.toHaveTextContent('미보유'); // 보유 기기를 공백으로 보이게 하지 않음
  });

  it.skipIf(!missingNode)('미보유 기기 → "자사 제품 미보유", 제품 목록·카테고리 링크 없음, 메모·판정 기록은 표시하지 않음(2026-11-19)', () => {
    const n = missingNode!;
    renderAt(n.id);
    expect(screen.getByTestId('detail-coverage-badge')).toHaveAttribute('data-coverage', 'missing');
    expect(screen.queryByTestId('detail-product-list')).toBeNull();
    const empty = screen.getByTestId('detail-empty-products');
    expect(empty).toHaveTextContent('자사 제품 미보유');
    expect(within(empty).queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryByTestId('detail-gap-note')).toBeNull();
    expect(screen.queryByTestId('detail-gap-assessment')).toBeNull();
  });

  it.skipIf(!withProducts)('제품이 있는 기기 → 제품 카드 목록, 빈 상태 없음', () => {
    const n = withProducts!;
    renderAt(n.id);
    expect(screen.getByTestId('detail-product-list')).toBeInTheDocument();
    expect(screen.queryByTestId('detail-empty-products')).toBeNull();
    expect(screen.getByTestId(`product-card-${resolveProducts(n.eq)[0].id}`)).toHaveAttribute('href', `/product/${resolveProducts(n.eq)[0].id}`);
  });

  it('없는 ?node= → 오른쪽 레일(detail-panel testid 없음), 레일 버튼 → 빈 안내 패널, 오류 없음', () => {
    resetUiStore();
    renderAt('__no_such_node__');
    expect(screen.queryByTestId('detail-panel')).toBeNull();
    expect(screen.queryByRole('complementary')).toBeNull();
    fireEvent.click(screen.getByTestId('panel-rail-open'));
    expect(screen.getByRole('complementary')).toHaveTextContent('상세 정보');
  });
});

// ── UX 라운드 U (B4·B5·B7·B8) ──
const probe: { nav?: NavigateFunction; search?: string } = {};
function Probe() {
  probe.nav = useNavigate();
  probe.search = useLocation().search;
  return null;
}
function renderWithProbe(nodeId: string) {
  return render(
    <MemoryRouter initialEntries={[`/?node=${nodeId}`]}>
      <DetailPanel />
      <Probe />
    </MemoryRouter>,
  );
}
const withNeighbor = model.nodes.find((n) => (model.neighbors.get(n.id) ?? []).length > 0);
const sourcedWithGa = model.nodes.find((n) => n.coverage === 'sourced' && n.eq.gapAssessment);

describe('UX 라운드 U — DetailPanel', () => {
  it.skipIf(!withProducts)('B4 패널 제목 h2 는 tabIndex=-1 (선택 시 포커스 대상)', () => {
    renderAt(withProducts!.id);
    const h2 = screen.getByTestId('detail-title');
    expect(h2.tagName).toBe('H2');
    expect(h2).toHaveAttribute('tabindex', '-1');
  });

  it.skipIf(!withNeighbor)('B5 연결 기기 칩 → 기록에 push, 뒤로가기 → 이전 기기 / B4 포커스는 새 기기 패널 제목', () => {
    const n = withNeighbor!;
    const next = model.neighbors.get(n.id)![0].node;
    renderWithProbe(n.id);
    fireEvent.click(screen.getByTestId(`neighbor-chip-${next.id}`));
    expect(probe.search).toContain(`node=${next.id}`);
    expect(screen.getByTestId('detail-title')).toHaveTextContent(next.eq.name);
    expect(document.activeElement).toBe(screen.getByTestId('detail-title'));
    act(() => probe.nav!(-1));
    expect(probe.search).toContain(`node=${n.id}`);
    expect(screen.getByTestId('detail-title')).toHaveTextContent(n.eq.name);
  });

  it.skipIf(!sourcedWithGa)('판정 기록(판정 확정/후보·근거·재확인 기한) 섹션은 표시하지 않음 (2026-11-19 사용자: 전수 삭제)', () => {
    renderAt(sourcedWithGa!.id);
    expect(screen.queryByTestId('detail-gap-assessment')).toBeNull();
    expect(screen.queryByText(/재확인 기한|판정 근거/)).toBeNull();
  });

  it.skipIf(!withProducts)('B8 제품 수 단위 = "N개"', () => {
    renderAt(withProducts!.id);
    expect(screen.getByText(/^자사 제품 · \d+개$/)).toBeInTheDocument();
  });
});

// ── 상세 설명(overview) — 펼친 패널은 요약 + 항목, 근거 줄 없음 ──
const withOverview = model.nodes.find((n) => n.eq.overview && n.eq.overview.sources.length > 0) ?? model.nodes.find((n) => n.eq.overview);
const missingOvNode = model.nodes.find((n) => n.eq.coverage === 'missing' && n.eq.overview);

describe('상세 설명 overview — DetailPanel', () => {
  it.skipIf(!withOverview)('펼친 패널 설명 자리 = 요약 + 항목 라벨·본문, 근거 줄 없음', () => {
    const n = withOverview!;
    renderAt(n.id);
    const desc = screen.getByTestId('detail-desc');
    expect(desc).toHaveAttribute('data-overview', 'true');
    expect(within(desc).getByTestId('overview-summary')).toHaveTextContent(n.eq.overview!.summary);
    const dl = within(desc).getByTestId('overview-points');
    expect([...dl.querySelectorAll('dt')].map((d) => d.textContent)).toEqual(n.eq.overview!.points.map((p) => p.label));
    expect([...dl.querySelectorAll('dd')].map((d) => d.textContent)).toEqual(n.eq.overview!.points.map((p) => p.text));
    expect(screen.queryByTestId('overview-sources')).toBeNull();
    expect(desc).not.toHaveTextContent(/근거:|일반 기술 설명/);
  });

  it.skipIf(!missingOvNode)('자사 제품이 없는 기기(missing)에는 "제품 설명" 항목이 없다', () => {
    renderAt(missingOvNode!.id);
    const dl = within(screen.getByTestId('detail-desc')).getByTestId('overview-points');
    expect([...dl.querySelectorAll('dt')].map((d) => d.textContent)).not.toContain('제품 설명');
  });
});

// ── 디자이너 토론 P0-8 레일 · P1 패널 순서 · 비교 담기 n/4 ──
describe('A3 상세 패널 — 레일·순서·비교 담기', () => {
  it('P0-8 레일 → 펼치면 제목 포커스, 접기 → 레일 버튼으로 포커스 복귀', () => {
    resetUiStore();
    render(
      <MemoryRouter initialEntries={['/']}>
        <DetailPanel />
      </MemoryRouter>,
    );
    const rail = screen.getByTestId('panel-rail-open');
    expect(rail).toHaveAttribute('aria-expanded', 'false');
    expect(rail).toHaveAccessibleName('상세 정보 창 열기');
    fireEvent.click(rail);
    expect(useUiStore.getState().emptyPanelOpen).toBe(true);
    expect(document.activeElement).toHaveTextContent('상세 정보');
    fireEvent.click(screen.getByTestId('panel-rail-close'));
    expect(useUiStore.getState().emptyPanelOpen).toBe(false);
    expect(document.activeElement).toBe(screen.getByTestId('panel-rail-open'));
  });

  it.skipIf(!withProducts)('P1 순서: 머리 → 고정 버튼 줄 → 자사 제품 → 설명', () => {
    renderAt(withProducts!.id);
    const panel = screen.getByTestId('detail-panel');
    const order = ['detail-title', 'detail-actions', 'detail-product-list', 'detail-desc'].map((id) => screen.getByTestId(id));
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(panel.querySelector('.dp-head .dp-hero')).not.toBeNull(); // 썸네일은 머리 안
  });

  it.skipIf(!withOverview)('설명: 기본 펼침(2026-11-19 사용자), 접기 → aria-expanded', () => {
    renderAt(withOverview!.id);
    const t = screen.getByTestId('detail-desc-toggle');
    expect(t).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('detail-desc').parentElement).toHaveAttribute('data-collapsed', 'false');
    fireEvent.click(t);
    expect(t).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('detail-desc').parentElement).toHaveAttribute('data-collapsed', 'true');
  });

  it.skipIf(!withProducts)('P1 "비교에 담기" ↔ "✓ 담김 n/4" (aria-pressed, 다시 누르면 빼기)', () => {
    useCompareStore.getState().clear('equipment');
    const n = withProducts!;
    renderAt(n.id);
    const btn = within(screen.getByTestId('detail-actions')).getByTestId(`compare-toggle-${n.eq.id}`);
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(btn).toHaveTextContent('비교에 담기');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(btn).toHaveTextContent('담김 1/4');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(useCompareStore.getState().equipment).not.toContain(n.eq.id);
  });
});
