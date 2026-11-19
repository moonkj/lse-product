/** 단계별 보기 열 = 계통맵 층 (src/data/stages.json · src/lib/stages.ts, 2026-11-19 계통맵과 구분 일치) */
import { describe, expect, it } from 'vitest';
import equipmentJson from '../../../src/data/equipment-types.json';
import diagramJson from '../../../src/data/diagram.json';
import { buildStageBoard, STAGE_DEFS, stageOf } from '../../../src/lib/stages';
import type { EquipmentType } from '../../../src/lib/schema';
import { parseHomeView } from '../../../src/lib/diagram/url';

const equipment = equipmentJson as EquipmentType[];
const layers = new Map((diagramJson as { layers: { id: string; label: string; voltage: string }[] }).layers.map((l) => [l.id, l]));

describe('단계별 보기', () => {
  const board = buildStageBoard(equipment);

  it('열 순서·이름·전압 = 계통맵 층: L1·L2·L3·수용가(L4~L7)·신재생', () => {
    expect(board.columns.map((c) => c.id)).toEqual(['L1', 'L2', 'L3', 'customer', 'REN']);
    for (const id of ['L1', 'L2', 'L3', 'REN']) {
      const c = board.columns.find((x) => x.id === id)!;
      expect(c.label).toBe(layers.get(id)!.label);
      expect(c.voltage).toBe(layers.get(id)!.voltage);
    }
    expect(board.columns.find((c) => c.id === 'customer')!.code).toBe('L4~L7');
    expect(board.columns.find((c) => c.id === 'REN')!.code).toBe('');
  });

  it('기기는 자기 층 열에만 (예외 이동 없음), 모든 기기가 정확히 한 곳', () => {
    expect(board.unassigned.map((e) => e.id)).toEqual([]);
    const placed = board.columns.flatMap((c) => c.groupsList.flatMap((g) => g.items.map((e) => e.id))).concat(board.monitoring.map((e) => e.id));
    expect(placed.length).toBe(equipment.length);
    expect(new Set(placed).size).toBe(equipment.length);
    for (const c of board.columns) for (const g of c.groupsList) for (const e of g.items) expect(c.layers).toContain(e.layer);
    const by = new Map(equipment.map((e) => [e.id, e]));
    expect(stageOf(by.get('generator')!)).toBe('L1');
    expect(stageOf(by.get('modular-substation')!)).toBe('REN');
    expect(stageOf(by.get('scada')!)).toBe('MON');
  });

  it('층별 보유·보완 수 = 계통맵 사이드바와 같은 계산(층 기기 수 합)', () => {
    for (const c of board.columns) {
      const items = equipment.filter((e) => c.layers.includes(e.layer));
      expect(c.total).toBe(items.length);
      expect(c.owned).toBe(items.filter((e) => e.coverage === 'owned').length);
      expect(c.gaps).toBe(items.filter((e) => e.coverage === 'missing' || e.coverage === 'partial').length);
    }
  });

  it('수용가 소구분 = 계통맵 층 이름 (L4 수전설비·L5 변압·L6 저압 배전·L7 분전반 및 부하)', () => {
    const c = board.columns.find((x) => x.id === 'customer')!;
    expect(c.groupsList.map((g) => g.layer)).toEqual(['L4', 'L5', 'L6', 'L7']);
    expect(c.groupsList.map((g) => g.label)).toEqual(['L4', 'L5', 'L6', 'L7'].map((l) => layers.get(l)!.label));
  });

  it('stages.json 의 층 id 는 모두 계통맵에 있고, 한 층은 한 열에만', () => {
    const all = STAGE_DEFS.flatMap((d) => d.layers);
    for (const l of all) expect(layers.has(l), l).toBe(true);
    expect(new Set(all).size).toBe(all.length);
  });

  it('?view= 해석: stage 만 단계별, 나머지는 계통맵', () => {
    expect(parseHomeView('stage')).toBe('stage');
    expect(parseHomeView(null)).toBe('map');
    expect(parseHomeView('x')).toBe('map');
  });
});
