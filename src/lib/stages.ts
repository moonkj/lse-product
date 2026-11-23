/**
 * 단계별 보기 (?view=stage) — 계통맵 층과 1:1 열을 두 줄로: 1행 계통(L1·L2·L3·신재생), 2행 수용가(L4·L5·L6·L7) + 감시·제어 띠.
 * 열 이름·전압은 diagram.json 층 정의 그대로 → 계통맵 밴드·사이드바와 이름·숫자가 같다.
 * 기기가 많은 열(groupByCategoryMin 이상)은 기능 분류 소제목(시스템·개폐·보호·계측·제어…)으로 묶는다.
 * 기기 순서는 equipment-types.json 순서(계통도와 같음).
 */
import stagesFile from '../data/stages.json';
import diagramFile from '../data/diagram.json';
import type { Coverage, EquipmentCategory, EquipmentType, Layer } from './schema';
import { CATEGORY_LABELS } from './labels';

interface RowFileEntry {
  id: string;
  label: string;
  sub: string;
  stages: string[];
}

export interface LayerInfo {
  id: string;
  label: string;
  voltage: string;
}

export interface StageDef {
  /** 열 id = 층 id (L1…L7·REN) */
  id: string;
  /** 열 머리 층 번호 (L1…L7, 번호 없는 층은 '') */
  code: string;
  label: string;
  voltage: string;
  layers: string[];
  /** 속한 줄 id (grid·customer) */
  row: string;
}

export interface StageGroup {
  /** 기능 분류 id (묶지 않은 열은 '') */
  key: string;
  /** 소제목 (묶지 않은 열은 '') */
  label: string;
  items: EquipmentType[];
}

export interface StageColumn extends StageDef {
  groupsList: StageGroup[];
  total: number;
  /** 보유(owned) 기기 수 */
  owned: number;
  /** 보완 필요(미보유·일부 보유) 기기 수 */
  gaps: number;
}

export interface StageRow {
  id: string;
  label: string;
  sub: string;
  /** 줄에 속한 층 번호 범위 (예 'L4~L7', 계통 줄은 'L1~L3') */
  code: string;
  columns: StageColumn[];
  total: number;
  owned: number;
  gaps: number;
}

export interface StageBoard {
  rows: StageRow[];
  /** 모든 열 (줄 순서대로) */
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

const FILE = stagesFile as { groupByCategoryMin: number; rows: RowFileEntry[] };
export const GROUP_BY_CATEGORY_MIN = FILE.groupByCategoryMin;
export const STAGE_ROWS: RowFileEntry[] = FILE.rows;

export const STAGE_DEFS: StageDef[] = FILE.rows.flatMap((r) =>
  r.stages.map((id): StageDef => {
    const info = LAYER_INFO.get(id);
    return { id, code: isMain(id) ? id : '', label: info?.label ?? id, voltage: info?.voltage ?? '', layers: [id], row: r.id };
  }),
);
export const MONITORING_LABEL = LAYER_INFO.get(MONITORING_LAYER)?.label ?? '감시·제어';

/** 기능 소제목 순서 — 큰 묶음(배전반 등 시스템)을 먼저, 부하는 끝 */
export const GROUP_CATEGORY_ORDER: EquipmentCategory[] = [
  'system',
  'switching',
  'protection',
  'transformation',
  'measurement',
  'control',
  'generation',
  'conductor',
  'monitoring',
  'load',
];

const GAP: readonly Coverage[] = ['missing', 'partial'];

/** 기기 하나 → 열 id (= 층 id, MON 은 'MON', 못 찾으면 null). 기기 layer 로만 정한다 (예외 이동 없음) */
export function stageOf(eq: Pick<EquipmentType, 'layer'>, defs: StageDef[] = STAGE_DEFS): string | null {
  if (eq.layer === MONITORING_LAYER) return MONITORING_LAYER;
  return defs.find((d) => d.layers.includes(eq.layer))?.id ?? null;
}

function groupItems(items: EquipmentType[], min: number): StageGroup[] {
  if (items.length < min) return [{ key: '', label: '', items }];
  return GROUP_CATEGORY_ORDER.map((c) => ({ key: c, label: CATEGORY_LABELS[c], items: items.filter((e) => e.category === c) })).filter(
    (g) => g.items.length > 0,
  );
}

/** 해당 없음(na, 자사 사업 범위 밖)은 집계 분모에서 뺀다 (2026-11-20 사용자) */
const counts = (items: EquipmentType[]) => ({
  total: items.filter((e) => e.coverage !== 'na').length,
  owned: items.filter((e) => e.coverage === 'owned').length,
  gaps: items.filter((e) => GAP.includes(e.coverage)).length,
});

export function buildStageBoard(
  equipment: readonly EquipmentType[],
  defs: StageDef[] = STAGE_DEFS,
  rowDefs: RowFileEntry[] = STAGE_ROWS,
  groupMin: number = GROUP_BY_CATEGORY_MIN,
): StageBoard {
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
    return { ...d, groupsList: groupItems(items, groupMin), ...counts(items) };
  });
  const rows = rowDefs.map((r): StageRow => {
    const cols = columns.filter((c) => c.row === r.id);
    const main = cols.map((c) => c.code).filter(Boolean);
    const code = main.length > 1 ? `${main[0]}~${main[main.length - 1]}` : (main[0] ?? '');
    return { id: r.id, label: r.label, sub: r.sub, code, columns: cols, ...counts(cols.flatMap((c) => c.groupsList.flatMap((g) => g.items))) };
  });
  return { rows, columns, monitoring, monitoringLabel: MONITORING_LABEL, unassigned };
}

/**
 * 데이터센터(국내) 계통의 단계별 줄 (2026-11-23 UX 토론 — 단계별에도 계통 선택 반영).
 * 계통도 층 이름·전압은 diagram-dc.json 을 따르고, 줄은 수전·변환 / 배전(AC·DC) / 부하.
 */
export const DC_STAGE_ROWS: RowFileEntry[] = [
  { id: 'dc-supply', label: '수전·변환', sub: '22.9kV 2회선 → 380V AC / 800V DC', stages: ['L4', 'L5'] },
  { id: 'dc-dist', label: '배전', sub: 'AC 380V (기존) · DC 800V (차세대)', stages: ['L6', 'REN'] },
  { id: 'dc-load', label: '부하', sub: 'IT 서버 랙', stages: ['L7'] },
];

/** 계통 종류별 열·줄 정의 — 층 이름·전압은 그 계통도(diagram.layers)에서 */
export function stageSetupFor(grid: 'std' | 'dc', layers: readonly { id: string; label: string; voltage: string }[]): { defs: StageDef[]; rows: RowFileEntry[] } {
  if (grid === 'std') return { defs: STAGE_DEFS, rows: STAGE_ROWS };
  const info = new Map(layers.map((l) => [l.id, l]));
  const defs = DC_STAGE_ROWS.flatMap((r) =>
    r.stages.map((id): StageDef => ({ id, code: isMain(id) ? id : '', label: info.get(id)?.label ?? id, voltage: info.get(id)?.voltage ?? '', layers: [id], row: r.id })),
  );
  return { defs, rows: DC_STAGE_ROWS };
}
