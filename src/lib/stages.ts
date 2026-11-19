/**
 * 단계별 보기 (?view=stage) — 기기를 계통맵 층과 같은 묶음의 열 + 감시·제어(MON) 띠로 보여 준다.
 * 열 = L1 초고압 발전·송전 · L2 송변전 · L3 특고압 배전 · 수용가(L4~L7) · 신재생·저장 연계 (src/data/stages.json).
 * 열·소구분 이름과 전압은 diagram.json 층 정의를 그대로 쓴다 → 계통맵 밴드·사이드바와 이름·숫자가 같다.
 * 기기 순서는 equipment-types.json 순서(계통도와 같음).
 */
import stagesFile from '../data/stages.json';
import diagramFile from '../data/diagram.json';
import type { Coverage, EquipmentType, Layer } from './schema';

interface StageFileEntry {
  id: string;
  layers: string[];
  label?: string;
  voltage?: string;
  /** 여러 층을 묶은 열은 층별 소구분을 보인다 */
  groups?: boolean;
}

export interface LayerInfo {
  id: string;
  label: string;
  voltage: string;
}

export interface StageDef {
  id: string;
  /** 열 머리 층 번호 표시 (예 'L1', 'L4~L7', '' = 번호 없는 층) */
  code: string;
  label: string;
  voltage: string;
  layers: string[];
  groups: boolean;
}

export interface StageGroup {
  /** 소구분 층 id (없으면 '') */
  layer: string;
  /** 소구분 이름 — 계통맵 층 이름 (없으면 '') */
  label: string;
  items: EquipmentType[];
}

export interface StageColumn extends StageDef {
  groupsList: StageGroup[];
  total: number;
  /** 보유(owned) 기기 수 */
  owned: number;
  /** 공백(미보유·일부 보유) 기기 수 */
  gaps: number;
}

export interface StageBoard {
  columns: StageColumn[];
  /** 감시·제어 (모든 층에 걸침) */
  monitoring: EquipmentType[];
  monitoringLabel: string;
  /** 어느 열에도 안 들어간 기기 (데이터 오류 — 테스트가 0 을 검사) */
  unassigned: EquipmentType[];
}

export const MONITORING_LAYER: Layer = 'MON';
export const LAYER_INFO: Map<string, LayerInfo> = new Map(
  (diagramFile as { layers: LayerInfo[] }).layers.map((l) => [l.id, { id: l.id, label: l.label, voltage: l.voltage }]),
);
const isMain = (l: string) => /^L[1-7]$/.test(l);

function toDef(e: StageFileEntry): StageDef {
  const first = LAYER_INFO.get(e.layers[0]);
  const last = LAYER_INFO.get(e.layers[e.layers.length - 1]);
  const code = !isMain(e.layers[0]) ? '' : e.layers.length > 1 ? `${first?.id}~${last?.id}` : (first?.id ?? '');
  return {
    id: e.id,
    code,
    label: e.label ?? first?.label ?? e.id,
    voltage: e.voltage ?? first?.voltage ?? '',
    layers: e.layers,
    groups: !!e.groups,
  };
}

export const STAGE_DEFS: StageDef[] = (stagesFile as { stages: StageFileEntry[] }).stages.map(toDef);
export const MONITORING_LABEL = LAYER_INFO.get(MONITORING_LAYER)?.label ?? '감시·제어';

const GAP: readonly Coverage[] = ['missing', 'partial'];

/** 기기 하나 → 열 id (MON 은 'MON', 못 찾으면 null). 기기 layer 로만 정한다 (예외 이동 없음) */
export function stageOf(eq: Pick<EquipmentType, 'layer'>, defs: StageDef[] = STAGE_DEFS): string | null {
  if (eq.layer === MONITORING_LAYER) return MONITORING_LAYER;
  return defs.find((d) => d.layers.includes(eq.layer))?.id ?? null;
}

export function buildStageBoard(equipment: readonly EquipmentType[], defs: StageDef[] = STAGE_DEFS): StageBoard {
  const byStage = new Map<string, EquipmentType[]>(defs.map((d) => [d.id, []]));
  const monitoring: EquipmentType[] = [];
  const unassigned: EquipmentType[] = [];
  for (const eq of equipment) {
    const s = stageOf(eq, defs);
    if (s === MONITORING_LAYER) monitoring.push(eq);
    else if (s && byStage.has(s)) byStage.get(s)!.push(eq);
    else unassigned.push(eq);
  }
  const columns = defs.map((d): StageColumn => {
    const items = byStage.get(d.id) ?? [];
    const groupsList: StageGroup[] = d.groups
      ? d.layers
          .map((l) => ({ layer: l, label: LAYER_INFO.get(l)?.label ?? l, items: items.filter((e) => e.layer === l) }))
          .filter((g) => g.items.length > 0)
      : [{ layer: '', label: '', items }];
    return {
      ...d,
      groupsList,
      total: items.length,
      owned: items.filter((e) => e.coverage === 'owned').length,
      gaps: items.filter((e) => GAP.includes(e.coverage)).length,
    };
  });
  return { columns, monitoring, monitoringLabel: MONITORING_LABEL, unassigned };
}
