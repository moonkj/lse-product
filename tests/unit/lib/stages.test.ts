/** 단계별 보기 매핑 (src/data/stages.json · src/lib/stages.ts) */
import { describe, expect, it } from 'vitest';
import equipmentJson from '../../../src/data/equipment-types.json';
import { buildStageBoard, STAGE_DEFS, stageOf } from '../../../src/lib/stages';
import type { EquipmentType } from '../../../src/lib/schema';
import { parseHomeView } from '../../../src/lib/diagram/url';

const equipment = equipmentJson as EquipmentType[];

describe('단계별 보기', () => {
  const board = buildStageBoard(equipment);

  it('5단계 순서: 발전·송전·변전·배전·수용가', () => {
    expect(board.columns.map((c) => c.label)).toEqual(['발전', '송전', '변전', '배전', '수용가']);
  });

  it('모든 기기가 정확히 한 단계(또는 감시·제어 띠)에 들어감', () => {
    expect(board.unassigned.map((e) => e.id)).toEqual([]);
    const placed = board.columns.flatMap((c) => c.groups.flatMap((g) => g.items.map((e) => e.id))).concat(board.monitoring.map((e) => e.id));
    expect(placed.length).toBe(equipment.length);
    expect(new Set(placed).size).toBe(equipment.length);
  });

  it('include·exclude 에 적힌 id 는 실제 기기', () => {
    const ids = new Set(equipment.map((e) => e.id));
    for (const d of STAGE_DEFS) for (const id of [...d.include, ...d.exclude]) expect(ids.has(id), `${d.id}: ${id}`).toBe(true);
  });

  it('예외 배정: 발전기·승압 변압기 = 발전, 모듈형 변전설비 = 변전, MON = 감시·제어', () => {
    const by = new Map(equipment.map((e) => [e.id, e]));
    expect(stageOf(by.get('generator')!)).toBe('generation');
    expect(stageOf(by.get('step-up-tr')!)).toBe('generation');
    expect(stageOf(by.get('ehv-gis')!)).toBe('transmission');
    expect(stageOf(by.get('modular-substation')!)).toBe('substation');
    expect(stageOf(by.get('scada')!)).toBe('monitoring');
  });

  it('수용가는 수전설비·변압·저압 배전·분전반 및 부하 소구분, 보유·공백 수는 데이터에서 계산', () => {
    const c = board.columns.find((x) => x.id === 'customer')!;
    expect(c.groups.map((g) => g.label)).toEqual(['수전설비', '변압', '저압 배전', '분전반 및 부하']);
    const items = c.groups.flatMap((g) => g.items);
    expect(c.total).toBe(items.length);
    expect(c.owned).toBe(items.filter((e) => e.coverage === 'owned').length);
  });

  it('?view= 해석: stage 만 단계별, 나머지는 계통맵', () => {
    expect(parseHomeView('stage')).toBe('stage');
    expect(parseHomeView(null)).toBe('map');
    expect(parseHomeView('x')).toBe('map');
  });
});
