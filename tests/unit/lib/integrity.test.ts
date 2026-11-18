// @vitest-environment node
/**
 * 단위 테스트 (UT-10, v0.7 R4) — 공용 무결성 검사 src/lib/integrity (checkDataset · checkEquipment · RULES)
 *
 * 작은 합성 데이터셋(오류 0)을 규칙마다 하나씩 망가뜨려 "그 규칙 ID 로 error(SOFT 는 warning)" 가 나오는지 본다.
 * 특히 T2 R3 리포트의 관리자 실패 시나리오(관리자 검사 통과 → DI 실패)를 규칙 ID 까지 고정한다:
 *   모선 끝 가로 출발 DI-46 · 모선 겹침 DI-39 · 모선 연결 1개 DI-40 · 참조 타일 라벨 없음 DI-43 · 택1 단독/라벨 없음 DI-43c ·
 *   sourced 공급 방식 unknown DI-27b · 없는 날짜 DI-27e · http 근거 DI-27f · 전력선 같은 선 겹침 DI-45a · 관통 DI-44a
 *
 * 합성 계통도 (1200 × 2100, 밴드 L1~L7 각 300px):
 *   n1..n7 (기기 e1..e7, x=300, y=150+300i) 세로 직선 사슬 e01..e06
 *   L6 모선 bus6 (700,1560) 길이 400 (x 500~900) → n8(600,1700)·n9(800,1700) 수직 연결 (points)
 */
import { describe, it, expect } from 'vitest';
import { RULES, checkDataset, checkEquipment, Collector, type CheckResult, type DatasetInput } from '../../../src/lib/integrity';
import type { Category, Diagram, DiagramEdge, DiagramNode, EquipmentImage, EquipmentType, Product } from '../../../src/lib/schema';

const TODAY = '2026-11-18';

interface Fixture {
  equipmentTypes: EquipmentType[];
  diagram: Diagram;
  categories: Category[];
  products: Product[];
  images: Record<string, EquipmentImage>;
}

const eq = (id: string, layer: EquipmentType['layer'], over: Partial<EquipmentType> = {}): EquipmentType => ({
  id,
  name: `기기 ${id}`,
  layer,
  voltage: '22.9kV',
  category: 'switching',
  description: '설명',
  learnPoints: ['포인트'],
  coverage: 'owned',
  lseCategoryCodes: ['AAA001'],
  ...over,
});

function base(): Fixture {
  const layers = (['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'] as const).map((id, i) => ({ id, label: `${id} 밴드`, voltage: '', y: i * 300, height: 300 }));
  const chain: DiagramNode[] = [1, 2, 3, 4, 5, 6, 7].map((i) => ({ id: `n${i}`, equipmentTypeId: `e${i}`, x: 300, y: 150 + 300 * (i - 1) }));
  const edges: DiagramEdge[] = [1, 2, 3, 4, 5, 6].map((i) => ({ id: `e0${i}`, from: `n${i}`, to: `n${i + 1}`, kind: 'power' }));
  edges.push(
    { id: 'e07', from: 'bus6', to: 'n8', points: [{ x: 600, y: 1560 }, { x: 600, y: 1642 }] },
    { id: 'e08', from: 'bus6', to: 'n9', points: [{ x: 800, y: 1560 }, { x: 800, y: 1642 }] },
  );
  return {
    categories: [{ code: 'AAA001', name: '차단기', path: ['차단기'], url: 'https://www.ls-electric.com/ko/product/category/AAA001', productIds: ['P00001'] }],
    products: [
      {
        id: 'P00001',
        name: '제품 1',
        categoryCode: 'AAA001',
        categoryPath: ['차단기'],
        url: 'https://www.ls-electric.com/ko/product/view/P00001',
        business: 'power',
        discontinued: false,
        docs: [{ type: 'catalog', title: '카탈로그', url: 'https://www.ls-electric.com/files/a.pdf' }],
      },
    ],
    equipmentTypes: [
      ...[1, 2, 3, 4, 5, 6, 7].map((i) => eq(`e${i}`, `L${i}` as EquipmentType['layer'])),
      eq('e8', 'L6', { voltage: '380V' }),
      eq('e9', 'L6', { voltage: '380V' }),
    ],
    diagram: {
      width: 1200,
      height: 2100,
      review: { status: 'pending', changedAt: TODAY },
      layers,
      nodes: [
        ...chain,
        { id: 'bus6', kind: 'bus', label: '380V 모선', layer: 'L6', x: 700, y: 1560, width: 400 },
        { id: 'n8', equipmentTypeId: 'e8', x: 600, y: 1700 },
        { id: 'n9', equipmentTypeId: 'e9', x: 800, y: 1700 },
      ],
      edges,
    },
    images: {
      e1: { file: 'images/equipment/e1.png', thumb: 'images/equipment/thumb/e1.png', productId: 'P00001', productName: '제품 1', sourceUrl: 'https://www.ls-electric.com/img/e1.png', bytes: 100 },
    },
  };
}

const clone = (f: Fixture): Fixture => JSON.parse(JSON.stringify(f)) as Fixture;
const input = (f: Fixture): DatasetInput => ({ ...f, today: TODAY });

/** 모든 시나리오 결과 (마지막에 HARD/SOFT 등급 일치 검사) */
const seen: CheckResult[] = [];
function check(mutate: (f: Fixture) => void = () => {}): CheckResult {
  const f = clone(base());
  mutate(f);
  const r = checkDataset(input(f));
  seen.push(r);
  return r;
}
const errRules = (r: CheckResult) => [...new Set(r.errors.map((i) => i.rule))].sort();
const warnRules = (r: CheckResult) => [...new Set(r.warnings.map((i) => i.rule))].sort();
const node = (f: Fixture, id: string) => f.diagram.nodes.find((n) => n.id === id)!;
const edge = (f: Fixture, id: string) => f.diagram.edges.find((e) => e.id === id)!;
const equip = (f: Fixture, id: string) => f.equipmentTypes.find((e) => e.id === id)!;
const gapCandidate = { supplyMode: 'not-offered', basis: 'homepage-menu', confidence: 'candidate' } as const;

describe('UT-10 공용 무결성 검사 — 기준 데이터', () => {
  it('합성 기준 데이터는 오류 0, 경고는 DI-29(공백 후보 11종 이름 없음)뿐', () => {
    const r = check();
    expect(r.errors).toEqual([]);
    expect(warnRules(r)).toEqual(['DI-29']);
  });

  it('최상위 형태가 틀려도 예외 없이 DI-00 오류 (객체 아님·배열 아님)', () => {
    const r = checkDataset({ equipmentTypes: 'x', diagram: null, categories: {}, products: 3 });
    expect(errRules(r)).toEqual(['DI-00']);
    expect(r.errors.length).toBeGreaterThanOrEqual(4);
    // { equipmentTypes: [] } 감싼 형태는 허용
    const f = base();
    expect(checkDataset({ ...input(f), equipmentTypes: { equipmentTypes: f.equipmentTypes } }).errors).toEqual([]);
  });

  it('Collector.run: 규칙 코드가 예외를 내면 그 규칙 ID 로 오류 하나 + 나머지 규칙 계속', () => {
    const c = new Collector();
    c.run('DI-99', () => {
      throw new Error('boom');
    });
    c.run('DI-98', () => c.warn('DI-98', 'w'));
    expect(c.result().errors.map((i) => i.rule)).toEqual(['DI-99']);
    expect(c.result().errors[0].message).toContain('boom');
    expect(c.result().warnings.map((i) => i.rule)).toEqual(['DI-98']);
  });
});

describe('UT-10 T2 R3 관리자 실패 시나리오 → 규칙 ID', () => {
  it('DI-46 모선 끝에서 가로로 출발하는 모선 연결선', () => {
    const r = check((f) => {
      edge(f, 'e08').points = [{ x: 900, y: 1560 }, { x: 960, y: 1560 }, { x: 960, y: 1700 }, { x: 860, y: 1700 }];
    });
    expect(errRules(r)).toEqual(['DI-46']);
    expect(r.errors[0].message).toContain('수직');
    expect(r.errors[0].refs).toMatchObject({ edgeId: 'e08', nodeId: 'bus6' });
  });
  it('DI-46 모선 범위 밖 점에서 출발 / points 없음', () => {
    const out = check((f) => {
      edge(f, 'e08').points = [{ x: 950, y: 1560 }, { x: 950, y: 1600 }, { x: 800, y: 1600 }, { x: 800, y: 1642 }];
    });
    expect(errRules(out)).toContain('DI-46');
    expect(out.errors.some((i) => i.rule === 'DI-46' && i.message.includes('모선 위가 아닙니다'))).toBe(true);
    const none = check((f) => {
      delete edge(f, 'e07').points;
    });
    expect(errRules(none)).toEqual(['DI-46']);
    expect(none.errors[0].message).toContain('points');
  });
  it('DI-39 모선이 기기 타일과 겹침', () => {
    const r = check((f) => {
      f.diagram.nodes.push({ id: 'bus-x', kind: 'bus', label: '겹침 모선', layer: 'L7', x: 300, y: 1950, width: 300 });
      f.diagram.edges.push(
        { id: 'e20', from: 'bus-x', to: 'n7', points: [{ x: 300, y: 1950 }, { x: 300, y: 1892 }] },
        { id: 'e21', from: 'bus-x', to: 'n6', points: [{ x: 300, y: 1950 }, { x: 300, y: 1708 }] },
      );
    });
    expect(r.errors.filter((i) => i.rule === 'DI-39').map((i) => i.message).join('\n')).toContain('노드 겹침');
  });
  it('DI-40 모선 연결선 1개', () => {
    const r = check((f) => {
      f.diagram.edges = f.diagram.edges.filter((e) => e.id !== 'e08');
      f.diagram.edges.push({ id: 'e09', from: 'n9', to: 'n7' }); // n9 는 다른 선으로 살려 둔다 → 모선만 DI-40
    });
    expect(errRules(r)).toEqual(['DI-40']);
    expect(r.errors.map((i) => i.refs.nodeId)).toEqual(['bus6']);
    expect(r.errors[0].message).toContain('2개 이상');
  });
  it('DI-43 참조 타일 라벨 없음 (라벨 있으면 통과)', () => {
    const addRef = (label?: string) => (f: Fixture) => {
      f.diagram.nodes.push({ id: 'n1-ref', equipmentTypeId: 'e1', ref: true, x: 900, y: 150, ...(label ? { label } : {}) });
      f.diagram.edges.push({ id: 'e10', from: 'n1-ref', to: 'n2' });
    };
    expect(check(addRef('2차측')).errors).toEqual([]);
    const r = check(addRef());
    expect(errRules(r)).toEqual(['DI-43']);
    expect(r.errors[0].refs.nodeId).toBe('n1-ref');
  });
  it('DI-43c 택1 연결선 단독 그룹 / 라벨 없음 (2개 그룹은 통과)', () => {
    expect(
      check((f) => {
        Object.assign(edge(f, 'e07'), { kind: 'alt', label: 'A 또는 B' });
        Object.assign(edge(f, 'e08'), { kind: 'alt', label: 'A 또는 B' });
      }).errors,
    ).toEqual([]);
    const single = check((f) => Object.assign(edge(f, 'e07'), { kind: 'alt', label: '혼자' }));
    expect(errRules(single)).toEqual(['DI-43c']);
    expect(single.errors[0].message).toContain('1개뿐');
    const nolabel = check((f) => Object.assign(edge(f, 'e07'), { kind: 'alt' }));
    expect(errRules(nolabel)).toEqual(['DI-43c']);
    expect(nolabel.errors[0].message).toContain('라벨');
  });
  it('DI-27b sourced 인데 공급 방식 unknown / DI-27e 없는 날짜 / DI-27f http 근거', () => {
    const r = check((f) => {
      Object.assign(equip(f, 'e8'), {
        coverage: 'sourced',
        gapNote: '수배전반 구성품',
        gapAssessment: {
          supplyMode: 'unknown',
          basis: 'homepage-menu',
          confidence: 'candidate',
          reviewDue: '2026-02-30',
          evidence: [{ type: 'url', ref: 'http://www.ls-electric.com/x' }],
        },
      });
    });
    expect(errRules(r)).toEqual(['DI-27b', 'DI-27e', 'DI-27f']);
    expect(r.errors.every((i) => i.refs.equipmentId === 'e8' && i.refs.field === 'gapAssessment')).toBe(true);
    const ok = check((f) =>
      Object.assign(equip(f, 'e8'), { coverage: 'sourced', gapNote: 'x', gapAssessment: { supplyMode: 'panel-sourced', basis: 'homepage-menu', confidence: 'candidate' } }),
    );
    expect(ok.errors).toEqual([]);
  });
  it('DI-45a 전력선 두 개가 같은 가로선 위에서 겹침 (공통 끝 노드 없음)', () => {
    const r = check((f) => {
      f.equipmentTypes.push(eq('e10', 'L7'));
      f.diagram.nodes.push({ id: 'n10', equipmentTypeId: 'e10', x: 500, y: 1950 });
      // n8→n7: (600,1758)→(600,1854)→(300,1854)→(300,1892) / n9→n10: (800,1758)→(800,1854)→(500,1854)→(500,1892) — y=1854 에서 x 500~600 겹침
      f.diagram.edges.push({ id: 'e11', from: 'n8', to: 'n7' }, { id: 'e12', from: 'n9', to: 'n10' });
    });
    expect(errRules(r)).toEqual(['DI-45a']);
    expect(r.errors[0].message).toMatch(/e11.*e12/);
  });
  it('DI-45a 신호선 교차는 오류 아님', () => {
    const r = check((f) => {
      f.equipmentTypes.push(eq('e10', 'L7'));
      f.diagram.nodes.push({ id: 'n10', equipmentTypeId: 'e10', x: 500, y: 1950 });
      f.diagram.edges.push({ id: 'e11', from: 'n8', to: 'n7', kind: 'signal' }, { id: 'e12', from: 'n9', to: 'n10' });
    });
    expect(r.errors).toEqual([]);
  });
  it('DI-44a 연결선이 다른 타일을 관통', () => {
    const r = check((f) => {
      f.equipmentTypes.push(eq('e11', 'L3', { category: 'system' })); // system → 연결선 없어도 DI-40 은 SOFT
      f.diagram.nodes.push({ id: 'n11', equipmentTypeId: 'e11', x: 300, y: 900 }); // n3→n4 세로선 위
    });
    expect(errRules(r)).toEqual(['DI-44a']);
    expect(r.errors[0].refs.edgeId).toBe('e03');
    expect(warnRules(r)).toContain('DI-40');
  });
});

describe('UT-10 규칙별 위반 → 해당 ID (HARD)', () => {
  const cases: [string, (f: Fixture) => void][] = [
    ['DI-00', (f) => (equip(f, 'e1').layer = 'L9' as EquipmentType['layer'])],
    ['DI-01', (f) => f.products.push({ ...f.products[0] })],
    ['DI-02', (f) => f.categories.push({ ...f.categories[0] })],
    ['DI-03', (f) => f.equipmentTypes.push({ ...equip(f, 'e1') })],
    ['DI-04', (f) => f.diagram.edges.push({ ...edge(f, 'e01') })],
    ['DI-05', (f) => {
      f.products[0].id = 'X1';
      f.products[0].url = 'https://www.ls-electric.com/ko/product/view/X1';
      f.categories[0].productIds = ['X1'];
    }],
    ['DI-06', (f) => {
      f.categories[0].code = 'aaa1';
      f.products[0].categoryCode = 'aaa1';
      f.equipmentTypes.forEach((e) => (e.lseCategoryCodes = ['aaa1']));
    }],
    ['DI-07', (f) => {
      equip(f, 'e9').id = 'E9_bad';
      node(f, 'n9').equipmentTypeId = 'E9_bad';
    }],
    ['DI-08', (f) => (equip(f, 'e1').description = '   ')],
    ['DI-10', (f) => (equip(f, 'e1').lseCategoryCodes = ['ZZZ999'])],
    ['DI-11', (f) => (equip(f, 'e1').productIds = ['P99999'])],
    ['DI-12', (f) => (f.products[0].categoryCode = 'BBB001')],
    ['DI-13', (f) => f.categories[0].productIds.push('P00002')],
    ['DI-14', (f) => {
      f.categories.push({ code: 'BBB001', name: '기타', path: ['기타'], url: 'https://www.ls-electric.com/c', productIds: [] });
      f.products[0].categoryCode = 'BBB001';
    }],
    ['DI-15', (f) => (f.categories[0].parentCode = 'AAA001')],
    ['DI-16', (f) => (f.categories[0].path = ['다른 이름'])],
    ['DI-17', (f) => (f.products[0].docs[0].url = 'https://example.com/a.pdf')],
    ['DI-18', (f) => (f.products[0].url = 'https://www.ls-electric.com/ko/product/view/P12345')],
    ['DI-19', (f) => f.products[0].docs.push({ ...f.products[0].docs[0], title: '중복' })],
    ['DI-20', (f) => (equip(f, 'e1').lseCategoryCodes = [])],
    ['DI-21', (f) => Object.assign(equip(f, 'e1'), { coverage: 'missing', gapNote: 'x', gapAssessment: gapCandidate })],
    ['DI-22', (f) => Object.assign(equip(f, 'e1'), { coverage: 'affiliate', gapAssessment: { ...gapCandidate, supplyMode: 'affiliate' } })],
    ['DI-23', (f) => (equip(f, 'e1').affiliateName = 'LS전선')],
    ['DI-24', (f) => Object.assign(equip(f, 'e1'), { coverage: 'missing', lseCategoryCodes: [], gapAssessment: gapCandidate })],
    ['DI-26', (f) => Object.assign(equip(f, 'e1'), { coverage: 'partial', gapNote: 'x', lseCategoryCodes: [], gapAssessment: gapCandidate })],
    ['DI-27a', (f) => Object.assign(equip(f, 'e1'), { coverage: 'missing', lseCategoryCodes: [], gapNote: 'x' })],
    ['DI-27c', (f) =>
      Object.assign(equip(f, 'e1'), {
        coverage: 'missing',
        lseCategoryCodes: [],
        gapNote: 'x',
        gapAssessment: { ...gapCandidate, confidence: 'confirmed', verifiedBy: '배전기기사업부', verifiedAt: TODAY },
      })],
    ['DI-27d', (f) =>
      Object.assign(equip(f, 'e1'), { coverage: 'missing', lseCategoryCodes: [], gapNote: 'x', gapAssessment: { supplyMode: 'not-offered', basis: 'bu-confirmed', confidence: 'confirmed', verifiedBy: '배전기기사업부' } })],
    ['DI-28', (f) => (equip(f, 'e1').coverage = 'unknown' as EquipmentType['coverage'])],
    ['DI-30', (f) => (node(f, 'n1').equipmentTypeId = 'no-such')],
    ['DI-31', (f) => (edge(f, 'e01').to = 'ghost')],
    ['DI-32', (f) => f.diagram.edges.push({ id: 'e30', from: 'n2', to: 'n1' })],
    ['DI-33', (f) => (f.diagram.layers = f.diagram.layers.filter((l) => l.id !== 'L7'))],
    ['DI-34', (f) => {
      // L1 기기 노드를 참조 타일로 바꿈 → L1 에 1차 기기 노드 없음
      node(f, 'n1').ref = true;
      node(f, 'n1').label = '참조';
    }],
    ['DI-35', (f) => (node(f, 'bus6').width = 1300)],
    ['DI-36', (f) => (node(f, 'n9').x = 1170)],
    ['DI-37', (f) => (f.diagram.layers[1].y = 250)],
    ['DI-38', (f) => {
      const [a, b] = [f.diagram.layers[0], f.diagram.layers[1]];
      [a.y, b.y] = [b.y, a.y];
    }],
    ['DI-39', (f) => (node(f, 'n9').x = 610)],
    ['DI-40', (f) => {
      f.equipmentTypes.push(eq('e12', 'L7'));
      f.diagram.nodes.push({ id: 'n12', equipmentTypeId: 'e12', x: 900, y: 1950 });
    }],
    ['DI-41', (f) => (f.diagram.edges = f.diagram.edges.filter((e) => e.id !== 'e04'))],
    ['DI-42', (f) => f.diagram.edges.push({ id: 'e31', from: 'n1', to: 'n3', points: [{ x: 360, y: 150 }, { x: 420, y: 150 }, { x: 420, y: 750 }, { x: 360, y: 750 }] })],
    ['DI-43', (f) => f.equipmentTypes.push(eq('e13', 'L7'))],
    ['DI-43b', (f) => (f.diagram.review = { status: 'approved' })],
    ['DI-44b', (f) => (edge(f, 'e01').points = [{ x: 300, y: 208 }, { x: 310, y: 392 }])],
    ['DI-50', (f) => (equip(f, 'e1').learnPoints = [' '])],
    ['DI-81', (f) => (f.images.ghost = { ...f.images.e1 })],
    ['DI-83', (f) => (f.images.e1.productId = 'P99999')],
    ['DI-84', (f) => (f.images.e1.sourceUrl = 'https://example.com/e1.png')],
  ];

  it.each(cases)('%s 위반 데이터 → 그 규칙 ID 로 오류', (rule, mutate) => {
    const r = check(mutate);
    expect(errRules(r), JSON.stringify(r.errors.map((i) => `${i.rule} ${i.message}`))).toContain(rule);
  });

  it('HARD 규칙(DI-00 제외 error·both)이 모두 위 표 또는 시나리오로 한 번 이상 검증됨', () => {
    const covered = new Set([...cases.map(([id]) => id), 'DI-27b', 'DI-27e', 'DI-27f', 'DI-43c', 'DI-44a', 'DI-45a', 'DI-46']);
    expect(RULES.filter((r) => r.severity !== 'warning' && !covered.has(r.id)).map((r) => r.id)).toEqual([]);
  });
});

describe('UT-10 규칙별 위반 → 해당 ID (SOFT 경고, 오류 아님)', () => {
  const cases: [string, (f: Fixture) => void][] = [
    ['DI-25', (f) => Object.assign(equip(f, 'e1'), { coverage: 'partial', gapAssessment: gapCandidate })],
    ['DI-27', (f) => (f.products[0].discontinued = true)],
    ['DI-27b', (f) => Object.assign(equip(f, 'e1'), { coverage: 'affiliate', affiliateName: 'LS전선', gapAssessment: { ...gapCandidate, supplyMode: 'in-house' } })],
    ['DI-27g', (f) =>
      Object.assign(equip(f, 'e1'), {
        coverage: 'missing',
        lseCategoryCodes: [],
        gapNote: 'x',
        gapAssessment: { supplyMode: 'not-offered', basis: 'bu-confirmed', confidence: 'confirmed', verifiedBy: '배전기기사업부', verifiedAt: '2025-01-01', reviewDue: '2026-01-01' },
      })],
    ['DI-27h', (f) =>
      Object.assign(equip(f, 'e1'), { coverage: 'missing', lseCategoryCodes: [], gapNote: 'x', gapAssessment: { ...gapCandidate, verifiedBy: 'hong@example.com' } })],
    ['DI-39', (f) => (node(f, 'n9').x = 740)], // n8 과 간격 20px (< 30)
    ['DI-43b', (f) => delete f.diagram.review],
    ['DI-51', (f) => (equip(f, 'e9').name = equip(f, 'e8').name)],
    ['DI-52', (f) => (equip(f, 'e1').description = '대외비 자료')],
    ['DI-85', (f) => Object.assign(equip(f, 'e1'), { coverage: 'na', lseCategoryCodes: [] })],
  ];

  it.each(cases)('%s 위반 데이터 → 경고만 (오류 0)', (rule, mutate) => {
    const r = check(mutate);
    expect(r.errors.map((i) => `${i.rule} ${i.message}`)).toEqual([]);
    expect(warnRules(r)).toContain(rule);
  });

  it('DI-40 (SOFT) R-05 목록 밖 연결선 없는 system 기기', () => {
    const r = check((f) => {
      f.equipmentTypes.push(eq('e14', 'L7', { category: 'system' }));
      f.diagram.nodes.push({ id: 'n14', equipmentTypeId: 'e14', x: 900, y: 1950 });
    });
    expect(r.errors).toEqual([]);
    expect(warnRules(r)).toContain('DI-40');
  });

  it('SOFT 규칙이 모두 위 표로 한 번 이상 검증됨 (DI-29 는 기준 데이터)', () => {
    const covered = new Set([...cases.map(([id]) => id), 'DI-29', 'DI-40']);
    expect(RULES.filter((r) => r.severity !== 'error' && !covered.has(r.id)).map((r) => r.id)).toEqual([]);
  });
});

describe('UT-10 checkEquipment (관리자 기기 폼 즉시 검증)', () => {
  it('오류에 기기 id·폼 칸(field)이 붙는다', () => {
    const r = checkEquipment(eq('x', 'L4', { coverage: 'affiliate', lseCategoryCodes: [] }));
    expect(r.errors.map((i) => [i.rule, i.refs.field])).toEqual(
      expect.arrayContaining([
        ['DI-22', 'affiliateName'],
        ['DI-27a', 'gapAssessment'],
      ]),
    );
    expect(r.errors.every((i) => i.refs.equipmentId === 'x')).toBe(true);
  });
  it('categories 를 주면 하위 카테고리 제품까지 연결 수에 포함 (DI-20)', () => {
    const cats: Category[] = [
      { code: 'AAA001', name: 'A', path: ['A'], url: 'https://www.ls-electric.com/a', productIds: [] },
      { code: 'AAA001001', name: 'B', path: ['A', 'B'], url: 'https://www.ls-electric.com/b', parentCode: 'AAA001', productIds: ['P00001'] },
    ];
    expect(checkEquipment(eq('x', 'L4'), { categories: cats }).errors).toEqual([]);
    expect(checkEquipment(eq('x', 'L4', { lseCategoryCodes: [] }), { categories: cats }).errors.map((i) => i.rule)).toEqual(['DI-20']);
  });
  it('DI-27g 재확인 기한: today 를 주면 지난 기한 경고, 안 주면 생략', () => {
    const e = eq('x', 'L4', {
      coverage: 'missing',
      lseCategoryCodes: [],
      gapNote: 'x',
      gapAssessment: { supplyMode: 'not-offered', basis: 'bu-confirmed', confidence: 'confirmed', verifiedBy: '배전기기사업부', verifiedAt: '2025-01-01', reviewDue: '2026-11-17' },
    });
    expect(checkEquipment(e, { today: TODAY }).warnings.map((i) => i.rule)).toEqual(['DI-27g']);
    expect(checkEquipment(e, { today: '2026-11-17' }).warnings).toEqual([]);
    expect(checkEquipment(e).warnings).toEqual([]);
  });
});

describe('UT-10 RULES 표 ↔ 실제 보고 등급', () => {
  it('지금까지 모든 시나리오에서 error 는 HARD(error·both) 규칙, warning 은 SOFT(warning·both) 규칙으로만 보고', () => {
    const sev = new Map(RULES.map((r) => [r.id, r.severity]));
    const bad: string[] = [];
    for (const r of seen) {
      for (const i of r.errors) if (sev.get(i.rule) === 'warning' || !sev.has(i.rule)) bad.push(`error ${i.rule}: ${i.message}`);
      for (const i of r.warnings) if (sev.get(i.rule) === 'error' || !sev.has(i.rule)) bad.push(`warning ${i.rule}: ${i.message}`);
    }
    expect(seen.length).toBeGreaterThan(50);
    expect(bad).toEqual([]);
  });
});
