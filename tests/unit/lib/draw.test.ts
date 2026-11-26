/** 단선도 그리기 (src/lib/draw) — 모델·확인 규칙·고치기·예시·제품 목록 */
import { describe, expect, it } from 'vitest';
import specsJson from '../../../src/data/specs.json';
import { getData } from '../../../src/data/load';
import type { ProductSpecs } from '../../../src/lib/schema';
import { PANEL_TYPES, emptyDiagram, makeNode, sideVoltage, type Diagram } from '../../../src/lib/draw/model';
import { validateDiagram, summarizeDiagram, pickTransformer } from '../../../src/lib/draw/validate';
import { addItem, addItems, addNode, applyDFix, connect, diagramBom, fillProducts, insertBetween, removeNode, updateItem } from '../../../src/lib/draw/ops';
import { ampsOptions, variantFor } from '../../../src/lib/draw/ratings';
import { balancePhases, circuitAmps, phaseSummary } from '../../../src/lib/draw/load';
import { recommendCable, voltageDrop } from '../../../src/lib/draw/cable';
import { panelShortCircuitKA } from '../../../src/lib/draw/validate';
import { shortCircuitAt } from '../../../src/lib/draw/sc';
import { scheduleCsv, SCHEDULE_HEAD } from '../../../src/lib/draw/schedule';
import { updateEdge } from '../../../src/lib/draw/ops';
import { splitItem } from '../../../src/lib/draw/ops';
import { PRESETS } from '../../../src/lib/draw/presets';
import { decodeDiagram, encodeDiagram } from '../../../src/lib/draw/share';
import { diagramSvg } from '../../../src/lib/draw/exportSvg';

const specs = new Map(Object.entries((specsJson as { products: Record<string, ProductSpecs> }).products));
const pid = (name: string) => [...getData().productById.values()].find((p) => p.name === name)!.id;
const rules = (d: Diagram) => validateDiagram(d, specs);
const serious = (d: Diagram) => rules(d).filter((i) => i.severity !== 'info');

function chain(...nodes: ReturnType<typeof makeNode>[]): Diagram {
  let d = emptyDiagram('t');
  for (const n of nodes) d = addNode(d, n);
  for (let i = 1; i < nodes.length; i++) d = connect(d, nodes[i - 1].id, nodes[i].id);
  return d;
}

describe('모델', () => {
  it('반 종류 4가지 — 받는 기기는 모두 실제 기기, 기본 구성은 받는 기기 안에서, 주차단기 포함', () => {
    const eq = getData().equipmentTypeById;
    expect(PANEL_TYPES.map((p) => p.id)).toEqual(['mv-swgr', 'lv-swgr', 'panelboard', 'mcc']);
    for (const p of PANEL_TYPES) {
      expect(eq.has(p.id), p.id).toBe(true);
      for (const a of p.accepts) expect(eq.has(a), `${p.id}:${a}`).toBe(true);
      for (const d of p.defaults) expect(p.accepts, `${p.id}:${d.eq}`).toContain(d.eq);
      expect(p.defaults.some((d) => p.main.includes(d.eq)), p.id).toBe(true);
    }
  });
  it('변압기는 선이 붙은 쪽 전압 — 위(1차) 22.9kV, 아래(2차) 380V', () => {
    const tr = makeNode('equipment', 0, 0, 'cast-tr');
    expect(sideVoltage(tr, 'in')).toBe('22.9');
    expect(sideVoltage(tr, 'out')).toBe('0.38');
    expect(pickTransformer('22.9', '0.38')).toBe('cast-tr');
    expect(pickTransformer('154', '22.9')).toBe('main-tr');
    expect(pickTransformer('22.9', '345')).toBe('step-up-tr');
    expect(pickTransformer('22.9', 'dc0.8')).toBe('sst');
  });
});

describe('확인 규칙·고치기', () => {
  it('예시 3종: 제품 채우기 후 오류·경고 0', () => {
    for (const p of PRESETS) {
      const d = fillProducts(p.make(), specs);
      expect(serious(d).map((i) => i.message), p.id).toEqual([]);
    }
  });

  it('22.9kV 반과 380V 반을 바로 이으면 오류 → "사이에 몰드변압기 넣기"로 고치면 사라짐', () => {
    const d = chain(makeNode('source', 0, 0), makeNode('panel', 0, 120, 'mv-swgr'), makeNode('panel', 0, 300, 'lv-swgr'));
    const e = rules(d).find((i) => i.rule === 'DRW-02')!;
    expect(e.severity).toBe('error');
    expect(e.message).toContain('변압기 없이');
    expect(e.fix?.label).toContain('몰드변압기');
    const fixed = applyDFix(d, e.fix!.fix);
    expect(fixed.nodes).toHaveLength(4);
    expect(rules(fixed).filter((i) => i.rule === 'DRW-02')).toEqual([]);
    // 새 변압기는 두 반 사이, 아래 반은 자리를 내준다
    const tr = fixed.nodes.find((n) => n.eq === 'cast-tr')!;
    const lv = fixed.nodes.find((n) => n.eq === 'lv-swgr')!;
    expect(tr.y).toBeLessThan(lv.y);
  });

  it('저압 배전반에 VCB → 오류 + ACB 로 바꾸기, 주차단기를 빼면 경고 + 넣기', () => {
    let d = chain(makeNode('panel', 0, 0, 'lv-swgr'));
    const panel = d.nodes[0];
    d = addItem(d, panel.id, 'vcb');
    const e = rules(d).find((i) => i.rule === 'DRW-06')!;
    expect(e.message).toContain('저압 배전반');
    expect(e.fix?.label).toBe(`${'ACB 기중차단기'}(으)로 바꾸기`);
    // 기본 ACB 를 빼면 주차단기 없음 경고
    const acb = d.nodes[0].items!.find((i) => i.eq === 'acb')!;
    const noMain = applyDFix(d, { type: 'removeItem', node: panel.id, item: acb.id });
    const w = rules(noMain).find((i) => i.rule === 'DRW-07')!;
    expect(w.severity).toBe('warn');
    expect(rules(applyDFix(noMain, w.fix!.fix)).find((i) => i.rule === 'DRW-07')).toBeUndefined();
  });

  it('특고압반 VCB 에 보호계전기가 없으면 경고 → 넣기', () => {
    let d = chain(makeNode('panel', 0, 0, 'mv-swgr'));
    const relay = d.nodes[0].items!.find((i) => i.eq === 'protection-relay')!;
    d = applyDFix(d, { type: 'removeItem', node: d.nodes[0].id, item: relay.id });
    const w = rules(d).find((i) => i.rule === 'DRW-08' && i.severity === 'warn')!;
    expect(rules(applyDFix(d, w.fix!.fix)).find((i) => i.rule === 'DRW-08' && i.severity === 'warn')).toBeUndefined();
  });

  it('비상발전기가 ATS 없이 저압반에 → 경고 → 사이에 저압 ATS 넣기', () => {
    const d = chain(makeNode('equipment', 0, 0, 'emergency-gen'), makeNode('panel', 0, 160, 'lv-swgr'));
    const w = rules(d).find((i) => i.rule === 'DRW-05')!;
    expect(w.fix?.label).toContain('저압 ATS');
    const fixed = applyDFix(d, w.fix!.fix);
    expect(fixed.nodes.some((n) => n.eq === 'lv-ats')).toBe(true);
    expect(rules(fixed).find((i) => i.rule === 'DRW-05')).toBeUndefined();
  });

  it('변압기 2,000kVA 아래 저압반 주차단기가 1,600A 제품이면 경고 → 맞는 제품·옵션으로', () => {
    const tr = { ...makeNode('equipment', 0, 0, 'cast-tr'), kVA: 2000 };
    let d = chain(tr, makeNode('panel', 0, 160, 'lv-swgr'));
    const panel = d.nodes[1];
    const acb = panel.items!.find((i) => i.eq === 'acb')!;
    d = applyDFix(d, { type: 'setProduct', node: panel.id, item: acb.id, product: pid('Susol Compact ACB') });
    const w = rules(d).find((i) => i.key.endsWith(':09a'))!;
    expect(w.message).toContain('3,039A');
    const fixed = applyDFix(d, w.fix!.fix);
    expect(rules(fixed).find((i) => i.key.endsWith(':09a'))).toBeUndefined();
  });

  it('22.9kV 상자에 17.5kV 제품 → 오류 + 24kV 옵션 제품으로', () => {
    const d = chain(makeNode('source', 0, 0), { ...makeNode('equipment', 0, 120, 'vcb'), product: pid('Metasol VCB') });
    const e = rules(d).find((i) => i.rule === 'DRW-03')!;
    expect(e.fix?.label).toBe('Susol VCB 24kV(으)로 바꾸기');
  });

  it('연결 안 된 상자는 경고, 상자를 지우면 붙은 선도 지워짐, 계전기 같은 신호 기기는 선 없어도 됨', () => {
    let d = chain(makeNode('source', 0, 0), makeNode('panel', 0, 120, 'mv-swgr'));
    d = addNode(d, makeNode('panel', 400, 0, 'lv-swgr'));
    d = addNode(d, makeNode('equipment', 400, 300, 'power-meter'));
    expect(rules(d).filter((i) => i.rule === 'DRW-01')).toHaveLength(1);
    const after = removeNode(d, d.nodes[1].id);
    expect(after.edges).toHaveLength(0);
  });

  it('선 가운데 넣기는 위·아래 상자 사이로 선을 둘로 나눈다', () => {
    const d = chain(makeNode('source', 0, 0), makeNode('panel', 0, 120, 'mv-swgr'));
    const next = insertBetween(d, d.edges[0].id, 'alts');
    expect(next.edges).toHaveLength(2);
    expect(next.nodes).toHaveLength(3);
  });
});

describe('제품 목록·요약', () => {
  it('반 안 품목까지 수량을 합쳐 한 줄씩, 요약은 보유 아닌 기기 수', () => {
    const d = fillProducts(PRESETS[0].make(), specs);
    const bom = diagramBom(d, specs);
    const lv = d.nodes.find((n) => n.eq === 'lv-swgr')!;
    expect(bom.find((r) => r.key === `${lv.id}:${lv.items!.find((i) => i.eq === 'mccb')!.id}`)?.qty).toBe(4);
    const s = summarizeDiagram(d, rules(d));
    expect(s.nodes).toBe(d.nodes.length);
    expect(s.attention).toBe(0);
    expect(s.notOwned).toBeGreaterThan(0); // 전동기·조명 부하 = 사업 범위 밖
  });
});

describe('공유 링크·그림', () => {
  const strip = (d: Diagram) => ({
    nodes: d.nodes.map(({ id: _i, items, ...n }) => ({ ...n, items: items?.map(({ id: _j, ...it }) => it) })),
    edges: d.edges.map((e) => [d.nodes.findIndex((n) => n.id === e.from), d.nodes.findIndex((n) => n.id === e.to)]),
  });
  it('예시 3종: 코드 → 단선도가 같은 배치·구성·선 (이름엔 "(공유)")', () => {
    for (const p of PRESETS) {
      const d = fillProducts(p.make(), specs);
      const back = decodeDiagram(encodeDiagram(d))!;
      expect(back.name).toBe(`${d.name} (공유)`);
      expect(strip(back), p.id).toEqual(strip(d));
      expect(encodeDiagram(d).length, p.id).toBeLessThan(6000);
    }
  });
  it('모르는 기기·반·전압·제품은 버리고 숫자는 범위 안으로, 깨진 코드는 null', () => {
    const d = chain(makeNode('source', 0, 0), makeNode('panel', 0, 120, 'mv-swgr'));
    d.nodes.push({ id: 'x', kind: 'equipment', x: 99999, y: -5, eq: 'nope' });
    d.nodes[1] = { ...d.nodes[1], product: 'P-NOPE', v: 'zz' as never, items: [...d.nodes[1].items!, { id: 'q', eq: 'nope' }] };
    const back = decodeDiagram(encodeDiagram(d))!;
    expect(back.nodes).toHaveLength(2);
    expect(back.nodes[1].product).toBeUndefined();
    expect(back.nodes[1].v).toBeUndefined();
    expect(back.nodes[1].items!.some((i) => i.eq === 'nope')).toBe(false);
    expect(back.edges).toHaveLength(1);
    expect(decodeDiagram('%%%')).toBeNull();
    expect(decodeDiagram(encodeDiagram(d).slice(0, 12))).toBeNull();
  });
  it('그림(SVG): 상자·선·반 안 구성·제목·안내 문구, 오류 선은 빨간 점선, 글자는 이스케이프', () => {
    const d = chain(makeNode('source', 0, 0), makeNode('panel', 0, 120, 'mv-swgr'), { ...makeNode('panel', 0, 300, 'lv-swgr'), label: 'A&B <반>' });
    const svg = diagramSvg(d, rules(d), '2026-11-26');
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect((svg.match(/<path /g) ?? []).length).toBe(2);
    expect(svg).toContain('stroke-dasharray="8 5"');
    expect(svg).toContain('ACB');
    expect(svg).toContain('A&amp;B &lt;반&gt;');
    expect(svg).toContain('2026-11-26');
    expect(svg).toContain('설계 검토');
  });
});

describe('반 안 구성 (회로표)', () => {
  it('분전반: 기본 품목에 정격·극수·회로명, 회로 여러 개 넣기', () => {
    let d = chain(makeNode('panel', 0, 0, 'panelboard'));
    const n = d.nodes[0];
    const main = n.items!.find((i) => i.eq === 'branch-mccb')!;
    expect(main).toMatchObject({ amps: 100, poles: 4 });
    expect(main.name).toBeUndefined();
    expect(n.items!.find((i) => i.eq === 'elcb')).toMatchObject({ amps: 30, poles: 2, name: '회로 1' });
    d = addItems(d, n.id, 'mcb-rcbo', 3);
    const added = d.nodes[0].items!.slice(-3);
    expect(added.map((i) => i.name)).toEqual(['회로 3', '회로 4', '회로 5']);
    expect(added.every((i) => i.amps === 20 && i.poles === 2)).toBe(true);
  });
  it('정격 후보: 분전반용 차단기 50AF 프레임 → 5~50A, 60A 를 고르면 100AF 프레임', () => {
    const p = pid('분전반용 차단기');
    const f50 = variantFor(p, 40, specs)!;
    expect(f50.label).toContain('50AF');
    expect(ampsOptions(p, f50.id, specs)).toEqual([5, 10, 15, 20, 30, 40, 50]);
    expect(variantFor(p, 60, specs)!.label).toContain('100AF');
  });
  it('분기 회로가 주차단기보다 크면 경고 → 주차단기를 올리기', () => {
    let d = fillProducts(chain(makeNode('panel', 0, 0, 'panelboard')), specs);
    const n = d.nodes[0];
    const br = n.items!.find((i) => i.eq === 'elcb')!;
    d = updateItem(d, n.id, br.id, { amps: 125, variant: undefined });
    const w = rules(d).find((i) => i.rule === 'DRW-10')!;
    expect(w.message).toContain('125A가 주차단기 100A보다');
    const fixed = applyDFix(d, w.fix!.fix);
    expect(rules(fixed).find((i) => i.rule === 'DRW-10')).toBeUndefined();
  });
  it('고른 정격이 프레임 범위 밖이면 경고 → 맞는 프레임으로', () => {
    let d = fillProducts(chain(makeNode('panel', 0, 0, 'panelboard')), specs);
    const n = d.nodes[0];
    const main = n.items!.find((i) => i.eq === 'branch-mccb')!;
    const f30 = variantFor(main.product, 20, specs)!; // 30AF
    d = updateItem(d, n.id, main.id, { variant: f30.id, amps: 100 });
    const w = rules(d).find((i) => i.rule === 'DRW-11')!;
    expect(w.fix?.label).toContain('100AF');
    expect(rules(applyDFix(d, w.fix!.fix)).find((i) => i.rule === 'DRW-11')).toBeUndefined();
  });
  it('변압기 1,000kVA 아래 저압반: 제품 채우기는 주차단기 1,600A, 낮추면 경고 → 올리기', () => {
    let d = fillProducts(chain(makeNode('equipment', 0, 0, 'cast-tr'), makeNode('panel', 0, 160, 'lv-swgr')), specs);
    const n = d.nodes[1];
    const main = n.items!.find((i) => i.eq === 'acb')!;
    expect(main.amps).toBe(1600);
    expect(main.variant).toBeTruthy();
    d = updateItem(d, n.id, main.id, { amps: 800 });
    const w = rules(d).find((i) => i.rule === 'DRW-12')!;
    expect(w.fix?.label).toBe('1600A로 올리기');
    expect(rules(applyDFix(d, w.fix!.fix)).find((i) => i.rule === 'DRW-12')).toBeUndefined();
  });
  it('회로명·프레임·정격·극수는 제품 목록과 공유 코드에 그대로', () => {
    let d = fillProducts(chain(makeNode('panel', 0, 0, 'panelboard')), specs);
    const n = d.nodes[0];
    const br = n.items!.find((i) => i.eq === 'elcb')!;
    d = updateItem(d, n.id, br.id, { name: '1층 콘센트' });
    const row = diagramBom(d, specs).find((r) => r.key === `${n.id}:${br.id}`)!;
    expect(row.where).toContain('1층 콘센트');
    expect(row.rating).toMatch(/2P · 30A/);
    const back = decodeDiagram(encodeDiagram(d))!;
    const it = back.nodes[0].items!.find((i) => i.name === '1층 콘센트')!;
    expect(it).toMatchObject({ amps: 30, poles: 2, eq: 'elcb', variant: br.variant });
  });
});

describe('회로 부하·상 배분', () => {
  const it2 = (o: object) => ({ id: Math.random().toString(36), eq: 'elcb', poles: 2 as const, ...o });
  it('전류: 단상 2.2kW ≈ 11.1A, 삼상 10kW ≈ 16.9A (역률 0.9)', () => {
    expect(circuitAmps(it2({ loadKW: 2.2 }))).toBeCloseTo(11.11, 1);
    expect(circuitAmps({ id: 'x', eq: 'mccb', poles: 3, loadKW: 10 })).toBeCloseTo(16.88, 1);
  });
  it('상별 합계·불평형률, 자동 배분으로 30% 이하', () => {
    const items = [it2({ loadKW: 3, phase: 'R' }), it2({ loadKW: 3, phase: 'R' }), it2({ loadKW: 3, phase: 'R' }), { id: 'm', eq: 'mccb', poles: 3 as const, loadKW: 6 }];
    const s1 = phaseSummary(items);
    expect(s1.kW).toEqual({ R: 11, S: 2, T: 2 });
    expect(s1.unbalance).toBeCloseTo((9 / (15 / 3)) * 100, 5);
    const s2 = phaseSummary(balancePhases(items));
    expect(s2.unbalance).toBe(0);
  });
  it('분전반 규칙: 회로 과부하 → 차단기 올리기, 불평형 → 상 자동 배분, 상 전류 > 주차단기 → 주차단기 올리기', () => {
    let d = fillProducts(chain(makeNode('panel', 0, 0, 'panelboard')), specs);
    const n = d.nodes[0];
    const [, elcb, mcb] = n.items!;
    d = updateItem(d, n.id, elcb.id, { loadKW: 8, qty: undefined, phase: 'R' }); // 8kW 단상 ≈ 40A > 30A
    const w13 = rules(d).find((i) => i.rule === 'DRW-13')!;
    expect(w13.fix?.label).toBe('차단기를 50A로');
    d = applyDFix(d, w13.fix!.fix);
    d = updateItem(d, n.id, elcb.id, { loadKW: 4 });
    d = updateItem(d, n.id, mcb.id, { loadKW: 4, qty: undefined, phase: 'R' });
    d = addItems(d, n.id, 'mcb-rcbo', 1, { loadKW: 4, phase: 'R' });
    const w14 = rules(d).find((i) => i.rule === 'DRW-14')!;
    expect(w14.fix?.label).toBe('상 자동 배분');
    d = applyDFix(d, w14.fix!.fix);
    expect(rules(d).find((i) => i.rule === 'DRW-14')).toBeUndefined();
    d = updateItem(d, n.id, elcb.id, { loadKW: 30, amps: 160, variant: undefined, phase: 'R' }); // 상 전류 ≈ 152A > 100A
    const w15 = rules(d).find((i) => i.rule === 'DRW-15')!;
    expect(w15.fix?.label).toMatch(/주차단기를 \d+A로/);
    expect(rules(applyDFix(d, w15.fix!.fix)).find((i) => i.rule === 'DRW-15')).toBeUndefined();
  });
  it('수량 4 회로를 나누면 회로 4개 (이름 -1~-4, 같은 제품·정격)', () => {
    let d = chain(makeNode('panel', 0, 0, 'panelboard'));
    const n = d.nodes[0];
    const elcb = n.items!.find((i) => i.eq === 'elcb')!;
    d = updateItem(d, n.id, elcb.id, { qty: 4, name: '콘센트' });
    d = splitItem(d, n.id, elcb.id);
    const parts = d.nodes[0].items!.filter((i) => i.eq === 'elcb');
    expect(parts.map((i) => i.name)).toEqual(['콘센트-1', '콘센트-2', '콘센트-3', '콘센트-4']);
    expect(parts.every((i) => !i.qty && i.amps === 30)).toBe(true);
    expect(new Set(parts.map((i) => i.id)).size).toBe(4);
  });
});

describe('차단용량·전선·전압강하', () => {
  const trLv = () => fillProducts(chain({ ...makeNode('equipment', 0, 0, 'cast-tr'), kVA: 1000 }, makeNode('panel', 0, 160, 'lv-swgr'), makeNode('panel', 0, 360, 'panelboard')), specs);
  it('예상 단락전류는 변압기 바로 아래 반만 (1,000kVA·%Z 6% → 약 25.3kA), 그 아래 분전반은 계산 안 함', () => {
    const d = trLv();
    expect(panelShortCircuitKA(d, d.nodes[1].id)).toBeCloseTo(25.3, 1);
    expect(panelShortCircuitKA(d, d.nodes[2].id)).toBeUndefined();
  });
  it('변압기 아래 저압반 분기 MCCB 차단용량이 단락전류보다 작으면 경고 → 맞는 프레임', () => {
    let d = trLv();
    const lv = d.nodes[1];
    const mccb = lv.items!.find((i) => i.eq === 'mccb')!;
    d = updateItem(d, lv.id, mccb.id, { product: pid('Metasol MCCB'), variant: undefined, amps: 30 });
    const mm = productRatingsVariant('Metasol MCCB', '30AF');
    d = updateItem(d, lv.id, mccb.id, { variant: mm });
    const w = rules(d).find((i) => i.rule === 'DRW-16')!;
    expect(w.message).toContain('25.3kA');
    expect(w.fix).toBeDefined();
    expect(rules(applyDFix(d, w.fix!.fix)).find((i) => i.rule === 'DRW-16' && i.item === mccb.id)).toBeUndefined();
  });
  it('권장 전선: 20A → 2.5mm², 100A → 25mm², 1600A → 없음(병렬)', () => {
    expect(recommendCable(20)).toBe(2.5);
    expect(recommendCable(100)).toBe(25);
    expect(recommendCable(1600)).toBeUndefined();
  });
  it('가는 전선 → 경고 → 권장 굵기, 긴 전선 전압강하 5% 초과 → 굵은 전선', () => {
    let d = trLv();
    const pb = d.nodes[2];
    const elcb = pb.items!.find((i) => i.eq === 'elcb')!;
    d = updateItem(d, pb.id, elcb.id, { cable: 2.5 }); // 30A 차단기에 2.5mm²(24A)
    const w17 = rules(d).find((i) => i.rule === 'DRW-17')!;
    expect(w17.fix?.label).toBe('4mm²로');
    d = applyDFix(d, w17.fix!.fix);
    d = updateItem(d, pb.id, elcb.id, { lengthM: 100, loadKW: 4 }); // 4kW 단상 ≈ 20.2A, 100m, 4mm² → ≈ 8.2%
    const it = d.nodes[2].items!.find((i) => i.id === elcb.id)!;
    expect(voltageDrop(it)).toBeCloseTo((35.6 * 100 * circuitAmps(it)) / (1000 * 4) / 220 * 100, 5);
    const w18 = rules(d).find((i) => i.rule === 'DRW-18')!;
    d = applyDFix(d, w18.fix!.fix);
    expect(rules(d).find((i) => i.rule === 'DRW-18')).toBeUndefined();
    const back = decodeDiagram(encodeDiagram(d))!;
    expect(back.nodes[2].items!.find((i) => i.lengthM === 100)).toMatchObject({ cable: d.nodes[2].items!.find((i) => i.id === elcb.id)!.cable });
  });
});

function productRatingsVariant(name: string, label: string): string {
  const s = specs.get(pid(name))!;
  return s.variants!.find((v) => v.label.startsWith(label))!.id;
}

describe('피더·보호협조·회로표', () => {
  // 변압기 → 저압반 → 모선 → 분전반 (모선 → 분전반 선이 피더)
  const build = () => {
    const tr = { ...makeNode('equipment', 0, 0, 'cast-tr'), kVA: 1000 };
    const lv = makeNode('panel', 0, 160, 'lv-swgr');
    const bus = makeNode('bus', 0, 340);
    const pb = makeNode('panel', 0, 420, 'panelboard');
    return fillProducts(chain(tr, lv, bus, pb), specs);
  };
  it('분전반 단락전류: 피더 정보가 없으면 계산 안 함, 35mm² 50m 넣으면 변압기 바로 아래보다 작게', () => {
    let d = build();
    const pb = d.nodes[3];
    expect(shortCircuitAt(d, pb.id).kind).toBe('missing');
    d = updateEdge(d, d.edges[2].id, { cable: 35, lengthM: 50 });
    const sc = shortCircuitAt(d, pb.id);
    expect(sc.kind).toBe('ok');
    const ka = sc.kind === 'ok' ? sc.ka : 0;
    // Zt=0.00866Ω, Rc=0.0225·50/35=0.0321Ω, Xc=0.004Ω → |Z|≈0.0345Ω → ≈6.4kA
    expect(ka).toBeGreaterThan(5.5);
    expect(ka).toBeLessThan(7.5);
    expect(panelShortCircuitKA(d, d.nodes[1].id)).toBeCloseTo(25.3, 1);
  });
  it('보호협조: 하위 주차단기가 보내는 회로보다 크면 경고 → 하위를 1.6배 이하로, 비가 작으면 참고', () => {
    let d = build();
    const lv = d.nodes[1];
    const pb = d.nodes[3];
    const feederItem = lv.items!.find((i) => i.eq === 'mccb')!; // 250A
    d = updateEdge(d, d.edges[2].id, { feeder: feederItem.id });
    d = updateItem(d, lv.id, feederItem.id, { amps: 100 });
    const pbMain = pb.items!.find((i) => i.eq === 'branch-mccb')!;
    d = updateItem(d, pb.id, pbMain.id, { amps: 125 });
    const w = rules(d).find((i) => i.key.endsWith(':19a'))!;
    expect(w.message).toContain('125A가 위쪽');
    expect(w.fix?.label).toContain('60A로');
    d = applyDFix(d, w.fix!.fix);
    expect(rules(d).find((i) => i.key.endsWith(':19a'))).toBeUndefined();
    d = updateItem(d, pb.id, pbMain.id, { amps: 75 });
    expect(rules(d).find((i) => i.key.endsWith(':19b'))?.severity).toBe('info');
  });
  it('피더 전선이 보내는 차단기보다 가늘면 경고 → 권장 굵기', () => {
    let d = build();
    const lv = d.nodes[1];
    const feederItem = lv.items!.find((i) => i.eq === 'mccb')!;
    d = updateEdge(d, d.edges[2].id, { feeder: feederItem.id, cable: 16, lengthM: 30 });
    const w = rules(d).find((i) => i.rule === 'DRW-20')!;
    expect(w.fix?.label).toBe('피더 전선 120mm²로'); // 250A → 120mm²(269A)
    expect(rules(applyDFix(d, w.fix!.fix)).find((i) => i.rule === 'DRW-20')).toBeUndefined();
  });
  it('공유 코드에 피더 전선·길이·보내는 회로', () => {
    let d = build();
    const feederItem = d.nodes[1].items!.find((i) => i.eq === 'mccb')!;
    d = updateEdge(d, d.edges[2].id, { feeder: feederItem.id, cable: 120, lengthM: 30 });
    const back = decodeDiagram(encodeDiagram(d))!;
    const e = back.edges[2];
    expect(e).toMatchObject({ cable: 120, lengthM: 30 });
    expect(back.nodes[1].items!.find((i) => i.id === e.feeder)?.eq).toBe('mccb');
  });
  it('회로표 CSV: 반마다 제목·요약·머리글·회로 행', () => {
    const d = build();
    const csv = scheduleCsv(d, specs, '2026-11-26');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('저압 배전반 (저압 배전반 · 380V');
    expect(csv).toContain('예상 단락전류 약 25.3kA');
    expect(csv.split(SCHEDULE_HEAD.join(',')).length - 1).toBe(2);
    expect(csv).toContain('주,주차단기,ACB 기중차단기');
  });
});
