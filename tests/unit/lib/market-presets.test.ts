/**
 * 단위 테스트 — 수요처 프리셋 데이터 무결성·체크리스트·CSV (src/lib/market/presets.ts, 전력시장 토론 P0-3·P1)
 */
import { describe, it, expect } from 'vitest';
import { getData } from '../../../src/data/load';
import presetsJson from '../../../src/data/market-presets.json';
import {
  PresetsFileSchema,
  SCENARIO_IDS,
  buildChecklist,
  buildPresetCsv,
  getPresets,
  presetById,
  scenarioById,
} from '../../../src/lib/market/presets';

const data = getData();
const file = getPresets();
const diagramEqIds = new Set(data.diagram.nodes.map((n) => n.equipmentTypeId).filter(Boolean));

describe('market-presets.json 무결성', () => {
  it('스키마 통과 (출처 키·중복 기기 검사 포함)', () => {
    expect(PresetsFileSchema.safeParse(presetsJson).success).toBe(true);
  });

  it('수요처 11개 유형(2026-11-19 영업 활용도 높은 6개 추가)과 4개 수전 방식이 있다', () => {
    expect(file.presets.map((p) => p.id).sort()).toEqual(
      ['apartment', 'battery', 'building', 'datacenter', 'fab', 'factory', 'hospital', 'logistics', 'offshore-wind', 'pv-ess', 'water'],
    );
    expect(file.scenarios.map((s) => s.id).sort()).toEqual([...SCENARIO_IDS].sort());
  });

  it('프리셋·시나리오의 기기 id 는 equipment-types.json 에 있고 계통도에 타일이 있다', () => {
    const ids = [...file.presets.flatMap((p) => p.items.map((i) => i.id)), ...file.scenarios.flatMap((s) => s.items.map((i) => i.id))];
    for (const id of ids) {
      expect(data.equipmentTypeById.has(id), `없는 기기 id: ${id}`).toBe(true);
      expect(diagramEqIds.has(id), `계통도 타일 없음: ${id}`).toBe(true);
    }
  });

  it('모든 프리셋에 필수 기기와 출처가 있다', () => {
    for (const p of file.presets) {
      expect(p.items.some((i) => i.tier === 'required'), p.id).toBe(true);
      expect(p.sourceKeys.length).toBeGreaterThan(0);
    }
  });

  it('수전 방식 시나리오는 대용량 수전 유형(데이터센터·팹·공장·2차전지)에서만', () => {
    expect(file.presets.filter((p) => p.scenarios).map((p) => p.id).sort()).toEqual(['battery', 'datacenter', 'fab', 'factory']);
  });

  it('없는 출처 키는 검증 실패', () => {
    const bad = structuredClone(presetsJson) as { presets: { sourceKeys: string[] }[] };
    bad.presets[0].sourceKeys = ['nope'];
    expect(PresetsFileSchema.safeParse(bad).success).toBe(false);
  });

  it('수요 수치는 확인 필요 표시가 있다', () => {
    for (const p of file.presets) if (p.demand) expect(p.demand.value.needsCheck).toBe(true);
  });
});

describe('buildChecklist', () => {
  it('경고는 필수(또는 수전 방식) 기기 중 coverage 가 미보유·일부 보유인 것만 — 값은 데이터 그대로', () => {
    const dc = presetById('datacenter')!;
    const rows = buildChecklist(dc, undefined, data.equipmentTypeById);
    for (const r of rows) {
      const expected = r.tier === 'required' && ['missing', 'partial'].includes(data.equipmentTypeById.get(r.eq.id)!.coverage);
      expect(r.warn, r.eq.id).toBe(expected);
    }
    // 현재 데이터 기준: ups·emergency-gen 은 missing
    const warned = rows.filter((r) => r.warn).map((r) => r.eq.id);
    for (const id of ['ups', 'emergency-gen']) {
      if (data.equipmentTypeById.get(id)!.coverage === 'missing') expect(warned).toContain(id);
    }
  });

  it('정렬: 필수 → 이중화 → 선택 → 수전 방식 추가', () => {
    const rows = buildChecklist(presetById('factory')!, scenarioById('self'), data.equipmentTypeById);
    const rank = (t: string | null) => (t === 'required' ? 0 : t === 'redundant' ? 1 : t === 'optional' ? 2 : 3);
    const ranks = rows.map((r) => rank(r.tier));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it('시나리오 기기: 이미 있는 기기는 표시만 더하고, 새 기기는 tier=null 로 추가', () => {
    const fab = presetById('fab')!;
    const self = scenarioById('self')!;
    const base = buildChecklist(fab, undefined, data.equipmentTypeById);
    const rows = buildChecklist(fab, self, data.equipmentTypeById);
    const added = self.items.filter((i) => !fab.items.some((p) => p.id === i.id)).length;
    expect(rows.length).toBe(base.length + added);
    expect(rows.find((r) => r.eq.id === 'protection-relay')).toMatchObject({ tier: 'required', scenario: true });
    expect(rows.find((r) => r.eq.id === 'generator')).toMatchObject({ tier: null, scenario: true });
  });

  it('시나리오를 쓰지 않는 프리셋은 시나리오를 무시', () => {
    const b = presetById('building')!;
    expect(buildChecklist(b, scenarioById('zone'), data.equipmentTypeById).some((r) => r.scenario)).toBe(false);
  });
});

describe('buildPresetCsv', () => {
  it('BOM·헤더·행 수', () => {
    const p = presetById('datacenter')!;
    const s = scenarioById('ppa');
    const rows = buildChecklist(p, s, data.equipmentTypeById);
    const csv = buildPresetCsv(p, s, rows);
    expect(csv.startsWith('﻿수요처,수전 방식,등급')).toBe(true);
    const lines = csv.trim().split('\r\n');
    expect(lines.length).toBe(rows.length + 1);
    expect(lines[1]).toContain('데이터센터,직접 PPA,필수');
  });
});
