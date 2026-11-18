/**
 * 컴포넌트 테스트 (CT-04) — DetailPanel: 제품 0개 기기 → 공식 카테고리(제품군) 링크로 대체, 공백 기기 → 공백 안내
 * docs/test-plan.md §3b. 패널은 URL ?node= 가 원본이므로 MemoryRouter 로 진입.
 * 대상 기기는 실제 데이터에서 조건으로 고른다 (id 하드코딩 금지 — 없으면 skip).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
