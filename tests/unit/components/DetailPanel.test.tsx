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
  it.skipIf(!ownedNoProducts)('제품 0개인 보유 기기 → 제품 목록 대신 카테고리 공식 페이지 링크(새 탭)', () => {
    const n = ownedNoProducts!;
    renderAt(n.id);
    expect(screen.getByTestId('detail-title')).toHaveTextContent(n.eq.name);
    expect(screen.queryByTestId('detail-product-list')).toBeNull();
    const empty = screen.getByTestId('detail-empty-products');
    const links = within(empty).getAllByRole('link');
    const cats = resolveCategories(n.eq);
    expect(links).toHaveLength(cats.length);
    links.forEach((a, i) => {
      expect(a).toHaveAttribute('href', cats[i].url);
      expect(a).toHaveAttribute('target', '_blank');
      expect(a.getAttribute('rel')).toMatch(/noopener/);
      expect(a).toHaveTextContent(cats[i].name);
    });
    expect(empty).not.toHaveTextContent('미보유'); // 보유 기기를 공백으로 보이게 하지 않음
  });

  it.skipIf(!missingNode)('미보유 기기 → "자사 제품 미보유(공백)" + 공백 메모, 제품 목록·카테고리 링크 없음', () => {
    const n = missingNode!;
    renderAt(n.id);
    expect(screen.getByTestId('detail-coverage-badge')).toHaveAttribute('data-coverage', 'missing');
    expect(screen.queryByTestId('detail-product-list')).toBeNull();
    const empty = screen.getByTestId('detail-empty-products');
    expect(empty).toHaveTextContent('자사 제품 미보유(공백)');
    expect(within(empty).queryAllByRole('link')).toHaveLength(0);
    if (n.eq.gapNote) expect(screen.getByTestId('detail-gap-note')).toHaveTextContent(n.eq.gapNote);
  });

  it.skipIf(!withProducts)('제품이 있는 기기 → 제품 카드 목록, 빈 상태 없음', () => {
    const n = withProducts!;
    renderAt(n.id);
    expect(screen.getByTestId('detail-product-list')).toBeInTheDocument();
    expect(screen.queryByTestId('detail-empty-products')).toBeNull();
    expect(screen.getByTestId(`product-card-${resolveProducts(n.eq)[0].id}`)).toHaveAttribute('href', `/product/${resolveProducts(n.eq)[0].id}`);
  });

  it('없는 ?node= → 빈 안내 패널 (detail-panel testid 없음), 오류 없음', () => {
    renderAt('__no_such_node__');
    expect(screen.queryByTestId('detail-panel')).toBeNull();
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

  it.skipIf(!sourcedWithGa)('B7 패널 구성품 → 판정 섹션·확신도에 "공백" 단어 없음', () => {
    renderAt(sourcedWithGa!.id);
    const section = screen.getByTestId('detail-gap-assessment');
    expect(within(section).getByTestId('detail-gap-confidence').textContent).toMatch(/^판정 (확정|후보)$/);
    expect(section.querySelector('h3')!.textContent).not.toMatch(/공백/);
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

  it.skipIf(!missingOvNode)('자사 제품이 없는 기기(missing)에는 "LS ELECTRIC 제품" 항목이 없다', () => {
    renderAt(missingOvNode!.id);
    const dl = within(screen.getByTestId('detail-desc')).getByTestId('overview-points');
    expect([...dl.querySelectorAll('dt')].map((d) => d.textContent)).not.toContain('LS ELECTRIC 제품');
  });
});
