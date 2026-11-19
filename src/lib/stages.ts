/**
 * 단계별 보기 (?view=stage) — 기기를 발전·송전·변전·배전·수용가 5단계 열 + 감시·제어(MON) 띠로 묶는다.
 * 원본: src/data/stages.json (layer 기본 배정 + include/exclude 예외). 기기 순서는 equipment-types.json 순서(계통도와 같음).
 */
import stagesFile from '../data/stages.json';
import type { Coverage, EquipmentType, Layer } from './schema';

export interface StageDef {
  id: string;
  label: string;
  voltage: string;
  layers: string[];
  include: string[];
  exclude: string[];
  groups?: { layer: string; label: string }[];
}

export interface StageGroup {
  /** 소구분 이름 (없으면 '') */
  label: string;
  items: EquipmentType[];
}

export interface StageColumn {
  id: string;
  label: string;
  voltage: string;
  groups: StageGroup[];
  total: number;
  /** 보유(owned) 기기 수 */
  owned: number;
  /** 공백(미보유·일부 보유) 기기 수 */
  gaps: number;
}

export interface StageBoard {
  columns: StageColumn[];
  /** 감시·제어 (모든 단계에 걸침) */
  monitoring: EquipmentType[];
  /** 어느 단계에도 안 들어간 기기 (데이터 오류 — 테스트가 0 을 검사) */
  unassigned: EquipmentType[];
}

export const STAGE_DEFS: StageDef[] = (stagesFile as { stages: StageDef[] }).stages;
export const MONITORING_LAYER: Layer = 'MON';

const GAP: readonly Coverage[] = ['missing', 'partial'];

/** 기기 하나 → 단계 id (MON 은 'monitoring', 못 찾으면 null) */
export function stageOf(eq: Pick<EquipmentType, 'id' | 'layer'>, defs: StageDef[] = STAGE_DEFS): string | null {
  if (eq.layer === MONITORING_LAYER) return 'monitoring';
  const inc = defs.find((d) => d.include.includes(eq.id));
  if (inc) return inc.id;
  const byLayer = defs.find((d) => d.layers.includes(eq.layer) && !d.exclude.includes(eq.id));
  return byLayer ? byLayer.id : null;
}

export function buildStageBoard(equipment: readonly EquipmentType[], defs: StageDef[] = STAGE_DEFS): StageBoard {
  const byStage = new Map<string, EquipmentType[]>(defs.map((d) => [d.id, []]));
  const monitoring: EquipmentType[] = [];
  const unassigned: EquipmentType[] = [];
  for (const eq of equipment) {
    const s = stageOf(eq, defs);
    if (s === 'monitoring') monitoring.push(eq);
    else if (s && byStage.has(s)) byStage.get(s)!.push(eq);
    else unassigned.push(eq);
  }
  const columns = defs.map((d): StageColumn => {
    const items = byStage.get(d.id) ?? [];
    const groups: StageGroup[] = d.groups?.length
      ? d.groups
          .map((g) => ({ label: g.label, items: items.filter((e) => e.layer === g.layer) }))
          .concat([{ label: '기타', items: items.filter((e) => !d.groups!.some((g) => g.layer === e.layer)) }])
          .filter((g) => g.items.length > 0)
      : [{ label: '', items }];
    return {
      id: d.id,
      label: d.label,
      voltage: d.voltage,
      groups,
      total: items.length,
      owned: items.filter((e) => e.coverage === 'owned').length,
      gaps: items.filter((e) => GAP.includes(e.coverage)).length,
    };
  });
  return { columns, monitoring, unassigned };
}
