/** 계통 구성 시뮬레이션 엔진 (src/lib/builder) — 템플릿·정격 숫자 읽기·확인 규칙·고치기 */
import { describe, expect, it } from 'vitest';
import specsJson from '../../../src/data/specs.json';
import { getData } from '../../../src/data/load';
import { TEMPLATES, equipmentOf, slotsOf, templateById } from '../../../src/lib/builder/templates';
import { parseNumbers, productRatings, trSecondaryA, trShortCircuitKA } from '../../../src/lib/builder/specParse';
import { applyFix, defaultBuild, emptyBuild, summarize, validateBuild, type Build } from '../../../src/lib/builder/validate';
import type { ProductSpecs } from '../../../src/lib/schema';

const specs = new Map(Object.entries((specsJson as { products: Record<string, ProductSpecs> }).products));
const sub = templateById('substation')!;
const rules = (b: Build) => validateBuild(b, sub, specs);

describe('템플릿', () => {
  it('3개(수전설비·저압 배전반·데이터센터), 칸이 받는 기기는 모두 실제 기기, 칸 id 는 템플릿 안에서 고유', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(['substation', 'lv-panel', 'datacenter']);
    const eq = getData().equipmentTypeById;
    for (const t of TEMPLATES) {
      for (const id of equipmentOf(t)) expect(eq.has(id), `${t.id} ${id}`).toBe(true);
      const ids = slotsOf(t).map((s) => s.slot.id);
      expect(new Set(ids).size, t.id).toBe(ids.length);
      for (const { slot } of slotsOf(t)) expect(slot.accepts, `${t.id}.${slot.id}`).toContain(slot.default);
    }
  });
});

describe('정격 숫자 읽기', () => {
  it('괄호 주석을 빼고 숫자만', () => {
    expect(parseNumbers('200~2000 (In max)')).toEqual([200, 2000]);
    expect(parseNumbers('65 (690/600/550V) / 85 (500/480/460V)')).toEqual([65, 85]);
    expect(parseNumbers('22.9 / 6.6 / 3.3 (1차, 표준사양)')).toEqual([22.9, 6.6, 3.3]);
    expect(parseNumbers('진공 소호')).toEqual([]);
  });
  it('제품 정격: ACB(P00206) 전류 최대 6300A·전압 0.69kV, VCB(P01062) 전압 최대 ≥ 24kV', () => {
    const acb = productRatings(specs.get('P00206'));
    expect(Math.max(...acb.A)).toBe(6300);
    expect(Math.max(...acb.kV)).toBeCloseTo(0.69);
    expect(Math.max(...productRatings(specs.get('P01062')).kV)).toBeGreaterThanOrEqual(24);
  });
  it('변압기 2차 정격전류·단락전류 계산 (1000kVA, 380V → 약 1,519A · %Z 6% → 약 25kA)', () => {
    expect(Math.round(trSecondaryA(1000, 0.38))).toBe(1519);
    expect(trShortCircuitKA(1000, 0.38, 6)).toBeCloseTo(25.3, 1);
  });
});

describe('확인 규칙', () => {
  it('빈 구성: 필수 칸마다 "비어 있음" + 기본 기기 넣기 제안, 템플릿 규칙은 아직 없음', () => {
    const issues = rules(emptyBuild(sub));
    const required = slotsOf(sub).filter((s) => s.slot.required).map((s) => s.slot.id);
    expect(issues.filter((i) => i.rule === 'BLD-01').map((i) => i.target?.id)).toEqual(required);
    expect(issues.every((i) => i.rule === 'BLD-01' && i.fix?.fix.type === 'setEq')).toBe(true);
  });

  it('기본 구성: 오류(error)·경고(warn) 0 — 안내(info)만', () => {
    for (const t of TEMPLATES) {
      const b = defaultBuild(t, specs);
      const bad = validateBuild(b, t, specs).filter((i) => i.severity !== 'info');
      // 데이터센터의 UPS(미보유)·SST(개발 중) 등은 info 만이어야 함
      expect(bad.map((i) => `${i.rule} ${i.message}`), t.id).toEqual([]);
    }
  });

  it('22.9kV 주차단기 칸에 ACB → "맞지 않습니다" 오류 + VCB 로 바꾸기, 고치면 사라짐', () => {
    let b = defaultBuild(sub, specs);
    b = applyFix(b, { type: 'setEq', target: { kind: 'slot', id: 'vcb' }, eq: 'acb' });
    const e = rules(b).find((i) => i.rule === 'BLD-02');
    expect(e?.severity).toBe('error');
    expect(e?.message).toContain('기중차단기');
    expect(e?.message).toContain('22.9kV');
    b = applyFix(b, e!.fix!.fix);
    expect(b.slots.vcb.eq).toBe('vcb');
    expect(rules(b).some((i) => i.rule === 'BLD-02')).toBe(false);
  });

  it('변압기를 빼면 "변압기 없이 22.9kV에서 380V로" 경고 + 변압기 넣기', () => {
    const b = applyFix(defaultBuild(sub, specs), { type: 'clear', target: { kind: 'slot', id: 'tr' } });
    const w = rules(b).find((i) => i.rule === 'BLD-10');
    expect(w?.message).toContain('변압기 없이');
    expect(w?.fix?.fix).toMatchObject({ type: 'setEq', eq: 'cast-tr' });
  });

  it('변압기 용량을 키우면 저압 주차단기 정격전류 부족 → 맞는 제품으로 바꾸기 제안', () => {
    let b = defaultBuild(sub, specs);
    b = { ...b, params: { ...b.params, kVA: 3000 } }; // 2차 약 4,558A
    // 정격전류가 작은 ACB 제품을 일부러 고름 (최대 전류가 4558A 미만인 제품)
    const small = ['P02206', 'P01030', 'P00206', 'P02207'].find((id) => {
      const a = productRatings(specs.get(id)).A;
      return a.length > 0 && Math.max(...a) < 4558;
    });
    expect(small, '4558A 미만 ACB 제품').toBeDefined();
    b = applyFix(b, { type: 'setProduct', target: { kind: 'slot', id: 'lv-main' }, product: small! });
    const w = rules(b).find((i) => i.rule === 'BLD-06' && i.severity === 'warn');
    expect(w?.message).toContain('4,558A');
    if (w?.fix) {
      b = applyFix(b, w.fix.fix);
      expect(rules(b).some((i) => i.rule === 'BLD-06' && i.severity === 'warn')).toBe(false);
    }
  });

  it('미보유 기기(UPS)·사업 범위 밖(비상발전기)은 안내만, 데이터센터 SST 예비가 없으면 N+1 경고', () => {
    const dc = templateById('datacenter')!;
    let b = defaultBuild(dc, specs);
    const info = validateBuild(b, dc, specs).filter((i) => i.rule === 'BLD-03').map((i) => i.message).join('\n');
    expect(info).toContain('미보유');
    expect(info).toContain('개발 중');
    b = applyFix(b, { type: 'clear', target: { kind: 'slot', id: 'sst-spare' } });
    const w = validateBuild(b, dc, specs).find((i) => i.rule === 'BLD-10');
    expect(w?.message).toContain('N+1');
    expect(w?.fix?.fix).toMatchObject({ type: 'setEq', eq: 'sst' });
  });

  it('모든 고치기 제안은 적용하면 그 확인할 점이 사라지고 새 오류를 만들지 않음 (기본 구성에서 칸을 하나씩 비운 경우)', () => {
    for (const t of TEMPLATES) {
      for (const { slot } of slotsOf(t)) {
        const b = applyFix(defaultBuild(t, specs), { type: 'clear', target: { kind: 'slot', id: slot.id } });
        for (const i of validateBuild(b, t, specs).filter((x) => x.fix && x.severity !== 'info')) {
          const after = validateBuild(applyFix(b, i.fix!.fix), t, specs);
          expect(after.some((x) => x.key === i.key), `${t.id} ${i.key}`).toBe(false);
          expect(after.filter((x) => x.severity === 'error').length, `${t.id} ${i.key}`).toBe(0);
        }
      }
    }
  });

  it('요약: 채운 칸·확인할 점·보유 아닌 기기 수', () => {
    const s = summarize(defaultBuild(sub, specs), sub, rules(defaultBuild(sub, specs)));
    expect(s.filled).toBe(s.total);
    expect(s.attention).toBe(0);
    expect(s.notOwned).toBeGreaterThan(0); // MOF·피뢰기·CT/PT 는 패널 구성품
  });
});
