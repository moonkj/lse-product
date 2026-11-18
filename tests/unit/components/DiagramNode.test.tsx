/**
 * 컴포넌트 테스트 (CT-03) — DiagramNode (v0.6 R3: ref·candidate 추가): 사진 타일 / 사진 없음 → 단선결선도 심볼, 접근성 이름, 상태 data-속성
 * docs/test-plan.md §3b. 실제 데이터와 무관한 fixture 로 검증 (데이터 변경에 흔들리지 않게).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import DiagramNode from '../../../src/components/diagram/DiagramNode';
import type { NodeItem } from '../../../src/lib/diagram/model';
import { COVERAGES, COVERAGE_LABELS, type Coverage, type EquipmentType } from '../../../src/lib/schema';
import { COVERAGE_ICONS } from '../../../src/components/common/CoverageBadge';

afterEach(cleanup);

function makeItem(coverage: Coverage, opts: { imageUrl?: string; abbr?: string } = {}): NodeItem {
  const eq: EquipmentType = {
    id: 'test-eq',
    name: '테스트 차단기',
    abbr: opts.abbr,
    layer: 'L4',
    voltage: '22.9kV',
    category: 'switching',
    description: '설명',
    learnPoints: ['포인트'],
    coverage,
    lseCategoryCodes: [],
  };
  return {
    id: 'n-test',
    x: 200,
    y: 300,
    eq,
    coverage,
    layer: 'L4',
    title: opts.abbr ?? eq.name,
    subtitle: opts.abbr ? eq.name : undefined,
    imageUrl: opts.imageUrl,
  };
}

const node = () => screen.getByTestId('diagram-node-n-test');

describe('CT-03 DiagramNode', () => {
  it('사진이 있으면 <img>(지연 로딩용 data-src, 장식 alt="") 를 그리고 심볼은 없다', () => {
    const { container } = render(
      <DiagramNode item={makeItem('owned', { imageUrl: './images/equipment/vcb.png', abbr: 'VCB' })} mode="product" selected={false} onActivate={() => {}} />,
    );
    const img = container.querySelector('img.dnode__img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('data-src', './images/equipment/vcb.png');
    expect(img).toHaveAttribute('alt', ''); // 이름은 aria-label 로 전달 → 사진은 장식
    expect(container.querySelector('svg.dnode__symbol')).toBeNull();
    expect(node()).not.toHaveClass('dnode--symbol');
  });

  it('사진이 없으면 단선결선도 심볼(svg, aria-hidden) 로 대체', () => {
    const { container } = render(<DiagramNode item={makeItem('missing')} mode="product" selected={false} onActivate={() => {}} />);
    expect(container.querySelector('img')).toBeNull();
    const svg = container.querySelector('svg.dnode__symbol');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(node()).toHaveClass('dnode--symbol');
    expect(node()).toHaveTextContent('자사 제품 없음'); // 미보유 캡션 (디자인 규칙)
  });

  it.each(COVERAGES)('%s: role=button·tabindex=0, aria-label = 화면 글자로 시작 + 기기명·커버리지 (WCAG 2.5.3), data-coverage, 아이콘 병행', (c) => {
    render(<DiagramNode item={makeItem(c)} mode="product" selected={false} onActivate={() => {}} />);
    const el = node();
    expect(el).toHaveAttribute('role', 'button');
    expect(el).toHaveAttribute('tabindex', '0');
    const label = el.getAttribute('aria-label')!;
    const visible = [...el.querySelectorAll('.dnode__title, .dnode__caption')].map((n) => n.textContent).join(' ');
    expect(label.startsWith(visible)).toBe(true);
    expect(label).toContain('테스트 차단기');
    expect(label).toContain(COVERAGE_LABELS[c]);
    expect(el).toHaveAttribute('data-coverage', c);
    expect(el).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId(`coverage-icon-${c}`)).toHaveTextContent(COVERAGE_ICONS[c]);
  });

  it('R5 약어 타일: "VCB 진공차단기, 보유" — 약어로 시작, 기기명은 한 번만', () => {
    const item = makeItem('owned', { abbr: 'VCB' });
    render(<DiagramNode item={{ ...item, eq: { ...item.eq, name: '진공차단기' }, subtitle: '진공차단기' }} mode="product" selected={false} onActivate={() => {}} />);
    expect(node()).toHaveAttribute('aria-label', `VCB 진공차단기, ${COVERAGE_LABELS.owned}`);
  });

  it('Gap 모드(R-08): missing·partial 강조, owned·na 흐림, affiliate 보통 / 제품 모드는 모두 보통', () => {
    const expected: Record<Coverage, [emphasized: string, dimmed: string]> = {
      missing: ['true', 'false'],
      partial: ['true', 'false'],
      affiliate: ['false', 'false'],
      sourced: ['false', 'false'], // 개선 R3: 패널 구성품은 계열사와 같이 "보통" (R-08 강조 기준 = 미보유·일부 보유 유지)
      owned: ['false', 'true'],
      na: ['false', 'true'],
    };
    for (const c of COVERAGES) {
      const { unmount } = render(<DiagramNode item={makeItem(c)} mode="gap" selected={false} onActivate={() => {}} />);
      expect([node().getAttribute('data-emphasized'), node().getAttribute('data-dimmed')], c).toEqual(expected[c]);
      unmount();
      render(<DiagramNode item={makeItem(c)} mode="product" selected={false} onActivate={() => {}} />);
      expect([node().getAttribute('data-emphasized'), node().getAttribute('data-dimmed')], `${c} product`).toEqual(['false', 'false']);
      cleanup();
    }
  });

  // ── 개선 R3: 참조 타일·공백 후보 표시 ──
  // T1 구현: NodeItem.ref / refLabel, 확신도는 eq.gapAssessment 에서 계산 (lib/labels gapConfidence)
  it('R3 참조 타일(ref): data-ref="true" + 자리 라벨(refLabel) 표시, 클릭 가능, 일반 타일은 data-ref 없음', () => {
    const onActivate = vi.fn();
    const refItem: NodeItem = { ...makeItem('owned', { abbr: 'TR' }), ref: true, refLabel: '22.9/6.6kV' };
    render(<DiagramNode item={refItem} mode="product" selected={false} onActivate={onActivate} />);
    expect(node()).toHaveAttribute('data-ref', 'true');
    expect(node()).toHaveTextContent('22.9/6.6kV');
    expect(node().getAttribute('aria-label')).toContain('테스트 차단기'); // 같은 기기임을 읽어 줌
    fireEvent.click(node());
    expect(onActivate).toHaveBeenCalledWith('n-test'); // → 그 기기 상세
    cleanup();
    render(<DiagramNode item={makeItem('owned')} mode="product" selected={false} onActivate={() => {}} />);
    expect(node()).not.toHaveAttribute('data-ref', 'true');
  });

  it('R3 공백 확신도: 공백류 + 후보/근거 없음 → candidate, 확정 → confirmed, 재확인 기한 지난 확정 → candidate, 보유 → 속성 없음', () => {
    const withGa = (coverage: Coverage, ga?: EquipmentType['gapAssessment']): NodeItem => {
      const it = makeItem(coverage);
      return { ...it, eq: { ...it.eq, gapAssessment: ga } };
    };
    const confirmed = { supplyMode: 'not-offered', basis: 'bu-confirmed', confidence: 'confirmed', verifiedBy: '배전기기사업부', verifiedAt: '2026-11-01' } as const;
    const cases: [NodeItem, string | null][] = [
      [withGa('missing', { supplyMode: 'unknown', basis: 'homepage-menu', confidence: 'candidate' }), 'candidate'],
      [withGa('sourced'), 'candidate'], // 근거 없음 = 후보로 취급
      [withGa('missing', confirmed), 'confirmed'],
      [withGa('missing', { ...confirmed, reviewDue: '2000-01-01' }), 'candidate'],
      [withGa('owned'), null],
    ];
    for (const [item, want] of cases) {
      render(<DiagramNode item={item} mode="gap" selected={false} onActivate={() => {}} />);
      expect(node().getAttribute('data-confidence'), `${item.coverage} ${JSON.stringify(item.eq.gapAssessment)}`).toBe(want);
      cleanup();
    }
  });

  it('선택 상태 aria-pressed=true, 클릭·Enter·Space 로 onActivate(id) 호출', () => {
    const onActivate = vi.fn();
    render(<DiagramNode item={makeItem('owned')} mode="product" selected onActivate={onActivate} />);
    expect(node()).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(node());
    fireEvent.keyDown(node(), { key: 'Enter' });
    fireEvent.keyDown(node(), { key: ' ' });
    fireEvent.keyDown(node(), { key: 'a' });
    expect(onActivate).toHaveBeenCalledTimes(3);
    expect(onActivate).toHaveBeenCalledWith('n-test');
  });
});
