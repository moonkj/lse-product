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
 *
 * v0.8 (개선 R5 권장 R2): 분기별 위반 6개(DI-35 타일·DI-39 중심 거리·DI-40 끝점/참조·DI-43 노드 2개·DI-44a 모선·DI-44b 끝 점) 추가.
 *   "모든 규칙 검증됨" 메타 테스트는 실제 실행된 위반 케이스가 보고한 규칙 ID(verify) 를 모아 RULES 와 대조한다.
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
    { id: 'e07', from: 'bus6', to: 'n8', points: [{ x: 600, y: 1560 }, { x: 600, y: 1640 }] },
    { id: 'e08', from: 'bus6', to: 'n9', points: [{ x: 800, y: 1560 }, { x: 800, y: 1640 }] },
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
/**
 * v0.8 (개선 R5 권장 R2): 위반 케이스가 "기대한 규칙 ID 를 실제로 보고했을 때만" 여기 기록 → 메타 테스트가 RULES 와 대조.
 * 손으로 쓴 ID 목록이 아니므로 시나리오를 지우거나 규칙이 조용히 안 돌면 메타 테스트가 실패한다.
 */
const verified = { error: new Set<string>(), warning: new Set<string>() };
function verify(r: CheckResult, level: 'error' | 'warning', ...rules: string[]) {
  const got = new Set((level === 'error' ? r.errors : r.warnings).map((i) => i.rule));
  for (const id of rules) if (got.has(id)) verified[level].add(id);
}
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
    verify(r, 'warning', 'DI-29');
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
      edge(f, 'e08').points = [{ x: 900, y: 1560 }, { x: 960, y: 1560 }, { x: 960, y: 1700 }, { x: 875, y: 1700 }];
    });
    expect(errRules(r)).toEqual(['DI-46']);
    expect(r.errors[0].message).toContain('수직');
    expect(r.errors[0].refs).toMatchObject({ edgeId: 'e08', nodeId: 'bus6' });
    verify(r, 'error', 'DI-46');
  });
  it('DI-46 모선 범위 밖 점에서 출발 / points 없음', () => {
    const out = check((f) => {
      edge(f, 'e08').points = [{ x: 950, y: 1560 }, { x: 950, y: 1600 }, { x: 800, y: 1600 }, { x: 800, y: 1640 }];
    });
    expect(errRules(out)).toContain('DI-46');
    expect(out.errors.some((i) => i.rule === 'DI-46' && i.message.includes('모선 위가 아닙니다'))).toBe(true);
    const none = check((f) => {
      delete edge(f, 'e07').points;
    });
    expect(errRules(none)).toEqual(['DI-46']);
    expect(none.errors[0].message).toContain('points');
    verify(out, 'error', 'DI-46');
    verify(none, 'error', 'DI-46');
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
    verify(r, 'error', 'DI-39');
  });
  it('DI-40 모선 연결선 1개', () => {
    const r = check((f) => {
      f.diagram.edges = f.diagram.edges.filter((e) => e.id !== 'e08');
      f.diagram.edges.push({ id: 'e09', from: 'n9', to: 'n7' }); // n9 는 다른 선으로 살려 둔다 → 모선만 DI-40
    });
    expect(errRules(r)).toEqual(['DI-40']);
    expect(r.errors.map((i) => i.refs.nodeId)).toEqual(['bus6']);
    expect(r.errors[0].message).toContain('2개 이상');
    verify(r, 'error', 'DI-40');
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
    verify(r, 'error', 'DI-43');
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
    verify(single, 'error', 'DI-43c');
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
    verify(r, 'error', 'DI-27b', 'DI-27e', 'DI-27f');
    const ok = check((f) =>
      Object.assign(equip(f, 'e8'), { coverage: 'sourced', gapNote: 'x', gapAssessment: { supplyMode: 'panel-sourced', basis: 'homepage-menu', confidence: 'candidate' } }),
    );
    expect(ok.errors).toEqual([]);
  });
  it('DI-45a 전력선 두 개가 같은 가로선 위에서 겹침 (공통 끝 노드 없음)', () => {
    const r = check((f) => {
      f.equipmentTypes.push(eq('e10', 'L7'));
      f.diagram.nodes.push({ id: 'n10', equipmentTypeId: 'e10', x: 500, y: 1950 });
      // n8→n7: (600,1760)→(600,1855)→(300,1855)→(300,1890) / n9→n10: (800,1760)→(800,1855)→(500,1855)→(500,1890) — y=1855 근처에서 x 500~600 겹침
      f.diagram.edges.push({ id: 'e11', from: 'n8', to: 'n7' }, { id: 'e12', from: 'n9', to: 'n10' });
    });
    expect(errRules(r)).toEqual(['DI-45a']);
    expect(r.errors[0].message).toMatch(/e11.*e12/);
    verify(r, 'error', 'DI-45a');
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
    verify(r, 'error', 'DI-44a');
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
    ['DI-44b', (f) => (edge(f, 'e01').points = [{ x: 300, y: 210 }, { x: 310, y: 390 }])],
    ['DI-81', (f) => (f.images.ghost = { ...f.images.e1 })],
    ['DI-83', (f) => (f.images.e1.productId = 'P99999')],
    ['DI-84', (f) => (f.images.e1.sourceUrl = 'https://example.com/e1.png')],
  ];

  it.each(cases)('%s 위반 데이터 → 그 규칙 ID 로 오류', (rule, mutate) => {
    const r = check(mutate);
    expect(errRules(r), JSON.stringify(r.errors.map((i) => `${i.rule} ${i.message}`))).toContain(rule);
    verify(r, 'error', rule);
  });
});

describe('UT-10 v0.8 분기별 위반 (권장 R2 — 규칙 안의 다른 분기)', () => {
  const msgs = (r: CheckResult, rule: string) => r.errors.filter((i) => i.rule === rule).map((i) => i.message);

  it('DI-35 기기 타일이 자기 계층 밴드 밖 (모선 width 분기와 별개)', () => {
    // e8 을 L7 기기로 바꿈 → n8(600,1700)은 L6 밴드(1500~1800) 안 = L7 밴드 밖. bus6(L6)→n8(L7)은 인접 계층이라 DI-42 아님
    const r = check((f) => (equip(f, 'e8').layer = 'L7'));
    expect(errRules(r)).toEqual(['DI-35']);
    expect(r.errors[0].refs.nodeId).toBe('n8');
    expect(r.errors[0].message).toContain('L7');
    verify(r, 'error', 'DI-35');
  });

  it('DI-39 노드 중심 거리 24px 미만 (겹침 없이 — 모선 두 개가 위아래 20px)', () => {
    // 모선 반높이 4 → 세로 간격 20 - 8 = 12 > 0 이라 "겹침" 분기는 안 탐. 중심 거리 20 < 24 만 걸림
    const r = check((f) => {
      f.diagram.nodes.push({ id: 'bus6b', kind: 'bus', label: '보조 모선', layer: 'L6', x: 700, y: 1540, width: 400 });
      f.diagram.edges.push(
        { id: 'e40', from: 'bus6b', to: 'n6', points: [{ x: 600, y: 1540 }, { x: 600, y: 1520 }, { x: 300, y: 1520 }, { x: 300, y: 1508 }] },
        { id: 'e41', from: 'bus6b', to: 'n5', points: [{ x: 520, y: 1540 }, { x: 520, y: 1350 }, { x: 360, y: 1350 }] },
      );
    });
    const m = msgs(r, 'DI-39');
    expect(m.some((x) => x.includes('중심 거리 24px 미만'))).toBe(true);
    expect(m.some((x) => x.includes('노드 겹침'))).toBe(false);
    verify(r, 'error', 'DI-39');
  });

  it('DI-40 끝점·참조 타일에 연결선 0 (기기 노드 분기와 별개)', () => {
    const r = check((f) => {
      f.diagram.nodes.push(
        { id: 'ep1', kind: 'endpoint', label: '외부 계통', layer: 'L1', x: 900, y: 150 },
        { id: 'n1-ref', equipmentTypeId: 'e1', ref: true, label: '참조', x: 900, y: 450 },
      );
    });
    expect(errRules(r)).toEqual(['DI-40']);
    expect(r.errors.map((i) => i.refs.nodeId).sort()).toEqual(['ep1', 'n1-ref']);
    expect(r.errors.every((i) => i.message.includes('연결선이 하나도 없습니다'))).toBe(true);
    verify(r, 'error', 'DI-40');
  });

  it('DI-43 같은 기기의 (참조 아닌) 기기 노드 2개 (배치 안 됨 분기와 별개)', () => {
    const r = check((f) => {
      f.diagram.nodes.push({ id: 'n1b', equipmentTypeId: 'e1', x: 900, y: 150 });
      f.diagram.edges.push({ id: 'e42', from: 'n1b', to: 'n2', points: [{ x: 900, y: 208 }, { x: 900, y: 450 }, { x: 360, y: 450 }] });
    });
    const m = msgs(r, 'DI-43');
    expect(m).toHaveLength(1);
    expect(m[0]).toContain('기기 노드가 2개');
    expect(r.errors.find((i) => i.rule === 'DI-43')!.refs).toMatchObject({ equipmentId: 'e1', nodeId: 'n1b' });
    verify(r, 'error', 'DI-43');
  });

  it('DI-44a 연결선이 모선을 지나감 (모선 여유 분기)', () => {
    // L5 새 기기 n10(700,1350) → n8(600,1700): x=700 세로선이 bus6(y=1560, x 500~900)을 관통
    const r = check((f) => {
      f.equipmentTypes.push(eq('e10', 'L5'));
      f.diagram.nodes.push({ id: 'n10', equipmentTypeId: 'e10', x: 700, y: 1350 });
      f.diagram.edges.push({ id: 'e43', from: 'n10', to: 'n8', points: [{ x: 700, y: 1408 }, { x: 700, y: 1600 }, { x: 600, y: 1600 }, { x: 600, y: 1640 }] });
    });
    const hit = r.errors.filter((i) => i.rule === 'DI-44a');
    expect(hit.map((i) => i.refs.edgeId)).toEqual(['e43']);
    expect(hit[0].message).toContain('380V 모선');
    verify(r, 'error', 'DI-44a');
  });

  it('DI-44b 끝 점이 도착 노드 가장자리 밖 (직교 경로 — 사선 분기와 별개)', () => {
    // n2 위 가장자리 y = 450 - 60 = 390. 끝 점 380 → 10px 모자람
    const r = check((f) => (edge(f, 'e01').points = [{ x: 300, y: 210 }, { x: 300, y: 380 }]));
    const m = msgs(r, 'DI-44b');
    expect(m).toHaveLength(1);
    expect(m[0]).toContain('끝 점이');
    expect(m.some((x) => x.includes('사선'))).toBe(false);
    expect(r.errors.find((i) => i.rule === 'DI-44b')!.refs).toMatchObject({ edgeId: 'e01', nodeId: 'n2' });
    verify(r, 'error', 'DI-44b');
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
    ['DI-39', (f) => (node(f, 'n9').x = 770)], // n8 과 간격 20px (< 30), 타일 폭 150
    ['DI-43b', (f) => delete f.diagram.review],
    ['DI-51', (f) => (equip(f, 'e9').name = equip(f, 'e8').name)],
    ['DI-52', (f) => (equip(f, 'e1').description = '대외비 자료')],
    ['DI-85', (f) => Object.assign(equip(f, 'e1'), { coverage: 'na', lseCategoryCodes: [] })],
  ];

  it.each(cases)('%s 위반 데이터 → 경고만 (오류 0)', (rule, mutate) => {
    const r = check(mutate);
    expect(r.errors.map((i) => `${i.rule} ${i.message}`)).toEqual([]);
    expect(warnRules(r)).toContain(rule);
    verify(r, 'warning', rule);
  });

  it('DI-40 (SOFT) R-05 목록 밖 연결선 없는 system 기기', () => {
    const r = check((f) => {
      f.equipmentTypes.push(eq('e14', 'L7', { category: 'system' }));
      f.diagram.nodes.push({ id: 'n14', equipmentTypeId: 'e14', x: 900, y: 1950 });
    });
    expect(r.errors).toEqual([]);
    expect(warnRules(r)).toContain('DI-40');
    verify(r, 'warning', 'DI-40');
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

  it('v0.8 메타: HARD 규칙(error·both)이 모두 실제 위반 케이스에서 그 ID 의 error 로 보고됨 (손 목록 아님)', () => {
    const missing = RULES.filter((r) => r.severity !== 'warning' && !verified.error.has(r.id)).map((r) => r.id);
    expect(missing).toEqual([]);
  });

  it('v0.8 메타: SOFT 규칙(warning·both)이 모두 실제 위반 케이스에서 그 ID 의 warning 으로 보고됨', () => {
    const missing = RULES.filter((r) => r.severity !== 'error' && !verified.warning.has(r.id)).map((r) => r.id);
    expect(missing).toEqual([]);
  });
});
