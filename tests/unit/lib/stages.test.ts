/** 단계별 보기 = 계통맵 층 1:1 열을 두 줄로 (src/data/stages.json · src/lib/stages.ts, 2026-11-19 2행 + 기능별 묶음) */
import { describe, expect, it } from 'vitest';
import equipmentJson from '../../../src/data/equipment-types.json';
import diagramJson from '../../../src/data/diagram.json';
import { buildStageBoard, GROUP_BY_CATEGORY_MIN, STAGE_DEFS, stageOf } from '../../../src/lib/stages';
import type { EquipmentType } from '../../../src/lib/schema';
import { parseHomeView } from '../../../src/lib/diagram/url';

const equipment = equipmentJson as EquipmentType[];
const layers = new Map((diagramJson as { layers: { id: string; label: string; voltage: string }[] }).layers.map((l) => [l.id, l]));

describe('단계별 보기', () => {
  const board = buildStageBoard(equipment);

  it('두 줄: 계통(L1·L2·L3·신재생) / 수용가(L4·L5·L6·L7), 열 이름·전압 = 계통맵 층', () => {
    expect(board.rows.map((r) => r.id)).toEqual(['grid', 'customer']);
    expect(board.rows[0].columns.map((c) => c.id)).toEqual(['L1', 'L2', 'L3', 'REN']);
    expect(board.rows[1].columns.map((c) => c.id)).toEqual(['L4', 'L5', 'L6', 'L7']);
    expect(board.rows[1].code).toBe('L4~L7');
    for (const c of board.columns) {
      expect(c.label).toBe(layers.get(c.id)!.label);
      expect(c.voltage).toBe(layers.get(c.id)!.voltage);
    }
    expect(board.columns.find((c) => c.id === 'REN')!.code).toBe('');
  });

  it('기기는 자기 층 열에만 (예외 이동 없음), 모든 기기가 정확히 한 곳', () => {
    expect(board.unassigned.map((e) => e.id)).toEqual([]);
    const placed = board.columns.flatMap((c) => c.groupsList.flatMap((g) => g.items.map((e) => e.id))).concat(board.monitoring.map((e) => e.id));
    expect(placed.length).toBe(equipment.length);
    expect(new Set(placed).size).toBe(equipment.length);
    for (const c of board.columns) for (const g of c.groupsList) for (const e of g.items) expect(e.layer).toBe(c.id);
    const by = new Map(equipment.map((e) => [e.id, e]));
    expect(stageOf(by.get('generator')!)).toBe('L1');
    expect(stageOf(by.get('panelboard')!)).toBe('L7');
    expect(stageOf(by.get('modular-substation')!)).toBe('REN');
    expect(stageOf(by.get('scada')!)).toBe('MON');
  });

  it('열·줄 보유·보완 수 = 층 기기 수 합 (계통맵 사이드바와 같은 계산)', () => {
    for (const c of board.columns) {
      const items = equipment.filter((e) => e.layer === c.id);
      expect(c.total).toBe(items.length);
      expect(c.owned).toBe(items.filter((e) => e.coverage === 'owned').length);
      expect(c.gaps).toBe(items.filter((e) => e.coverage === 'missing' || e.coverage === 'partial').length);
    }
    for (const r of board.rows) expect(r.total).toBe(r.columns.reduce((n, c) => n + c.total, 0));
  });

  it('기기가 많은 열만 기능 분류 소제목으로 묶고, 적은 열은 묶지 않음', () => {
    for (const c of board.columns) {
      if (c.total >= GROUP_BY_CATEGORY_MIN) {
        expect(c.groupsList.every((g) => g.label !== '' && g.items.every((e) => e.category === g.key)), c.id).toBe(true);
      } else {
        expect(c.groupsList.map((g) => g.key), c.id).toEqual(['']);
      }
    }
    // 현재 데이터: L4·L6·L7 이 묶임
    expect(board.columns.filter((c) => c.groupsList[0].key !== '').map((c) => c.id)).toEqual(['L4', 'L6', 'L7']);
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
