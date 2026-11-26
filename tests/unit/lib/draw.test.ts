/** 단선도 그리기 (src/lib/draw) — 모델·확인 규칙·고치기·예시·제품 목록 */
import { describe, expect, it } from 'vitest';
import specsJson from '../../../src/data/specs.json';
import { getData } from '../../../src/data/load';
import type { ProductSpecs } from '../../../src/lib/schema';
import { PANEL_TYPES, emptyDiagram, makeNode, sideVoltage, type Diagram } from '../../../src/lib/draw/model';
import { validateDiagram, summarizeDiagram, pickTransformer } from '../../../src/lib/draw/validate';
import { addItem, addNode, applyDFix, connect, diagramBom, fillProducts, insertBetween, removeNode } from '../../../src/lib/draw/ops';
import { PRESETS } from '../../../src/lib/draw/presets';

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
