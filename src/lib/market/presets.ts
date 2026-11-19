import { z } from 'zod';
import { COVERAGE_LABELS, LAYERS, LAYER_LABELS, type Coverage, type EquipmentType, type Layer } from '../schema';
import { SourceRefSchema, type SourceRef, type SourcedValue } from './source';
import presetsJson from '../../data/market-presets.json';

/**
 * 수요처·프로젝트 유형 프리셋 (전력시장 10인 토론 P0-3) + 수전 방식 시나리오 (P1).
 * 유형을 고르면 계통도에서 필요한 기기를 필수·이중화·선택 3단으로 강조하고,
 * 필수(또는 시나리오 추가) 기기 중 자사 미보유·일부 보유를 경고한다. 보유 상태는 equipment-types.json 의 coverage.
 * 출처는 market-presets.json 의 sources 사전에 한 번 적고 키로 참조한다 (없는 키 = 검증 실패).
 */

export const PRESET_TIERS = ['required', 'redundant', 'optional'] as const;
export type PresetTier = (typeof PRESET_TIERS)[number];
export const PRESET_TIER_LABELS: Record<PresetTier, string> = {
  required: '필수',
  redundant: '이중화',
  optional: '선택',
};

export const SCENARIO_IDS = ['kepco', 'ppa', 'zone', 'self'] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

/** 경고 대상 커버리지 — 미보유·일부 보유 */
export const WARN_COVERAGES: readonly Coverage[] = ['missing', 'partial'];

const PresetItemSchema = z.object({
  id: z.string().min(1),
  tier: z.enum(PRESET_TIERS),
  note: z.string().min(1).optional(),
});

const ScenarioItemSchema = z.object({ id: z.string().min(1), note: z.string().min(1).optional() });

/** 수요 수치 — SourcedValue 와 같되 source 는 sources 사전 키 */
const DemandSchema = z.object({
  label: z.string().min(1),
  value: z.object({
    value: z.number(),
    unit: z.string().min(1),
    kind: z.enum(['actual', 'forecast']),
    method: z.string().min(1),
    source: z.string().min(1),
    needsCheck: z.boolean().optional(),
  }),
});

const PresetSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(1),
  basis: z.string().min(1),
  sourceKeys: z.array(z.string()).min(1),
  /** 수전 방식 시나리오 사용 여부 (데이터센터·팹·공장) */
  scenarios: z.boolean(),
  demand: DemandSchema.optional(),
  items: z.array(PresetItemSchema).min(1),
});

const ScenarioSchema = z.object({
  id: z.enum(SCENARIO_IDS),
  label: z.string().min(1),
  /** 중립 설명 — 우열 판단 없이 구성 차이만 */
  summary: z.string().min(1),
  sourceKeys: z.array(z.string()).min(1),
  items: z.array(ScenarioItemSchema).min(1),
});

export const PresetsFileSchema = z
  .object({
    asof: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: z.string().min(1),
    sources: z.record(z.string(), SourceRefSchema),
    presets: z.array(PresetSchema).min(1),
    scenarios: z.array(ScenarioSchema),
  })
  .superRefine((f, ctx) => {
    const keys = new Set(Object.keys(f.sources));
    const check = (k: string, path: (string | number)[]) => {
      if (!keys.has(k)) ctx.addIssue({ code: 'custom', message: `없는 출처 키: ${k}`, path });
    };
    f.presets.forEach((p, i) => {
      p.sourceKeys.forEach((k) => check(k, ['presets', i, 'sourceKeys']));
      if (p.demand) check(p.demand.value.source, ['presets', i, 'demand']);
      const seen = new Set<string>();
      p.items.forEach((it, j) => {
        if (seen.has(it.id)) ctx.addIssue({ code: 'custom', message: `중복 기기: ${p.id}/${it.id}`, path: ['presets', i, 'items', j] });
        seen.add(it.id);
      });
    });
    f.scenarios.forEach((s, i) => s.sourceKeys.forEach((k) => check(k, ['scenarios', i, 'sourceKeys'])));
  });

export type PresetsFile = z.infer<typeof PresetsFileSchema>;
export type Preset = PresetsFile['presets'][number];
export type Scenario = PresetsFile['scenarios'][number];

let cache: PresetsFile | undefined;
export function getPresets(): PresetsFile {
  return (cache ??= PresetsFileSchema.parse(presetsJson));
}

export const presetById = (id: string | null | undefined) => (id ? getPresets().presets.find((p) => p.id === id) : undefined);
export const scenarioById = (id: string | null | undefined) => (id ? getPresets().scenarios.find((s) => s.id === id) : undefined);

export function sourcesOf(keys: string[], file: PresetsFile = getPresets()): SourceRef[] {
  return keys.map((k) => file.sources[k]).filter((s): s is SourceRef => !!s);
}

export function demandOf(p: Preset, file: PresetsFile = getPresets()): { label: string; value: SourcedValue } | undefined {
  if (!p.demand) return undefined;
  const source = file.sources[p.demand.value.source];
  if (!source) return undefined;
  return { label: p.demand.label, value: { ...p.demand.value, source } };
}

export interface ChecklistRow {
  eq: EquipmentType;
  /** 프리셋 등급 — 시나리오로만 더해진 기기는 null */
  tier: PresetTier | null;
  /** 선택한 수전 방식 시나리오가 더하는 기기 */
  scenario: boolean;
  coverage: Coverage;
  /** 필수 또는 시나리오 기기 중 미보유·일부 보유 */
  warn: boolean;
  note: string;
}

const tierRank = (t: PresetTier | null) => (t ? PRESET_TIERS.indexOf(t) : PRESET_TIERS.length);
const layerRank = (l: Layer) => LAYERS.indexOf(l);

/** 프리셋 + (선택) 시나리오 → 체크리스트. 데이터에 없는 기기 id 는 건너뛴다 (무결성 테스트가 막음) */
export function buildChecklist(preset: Preset, scenario: Scenario | undefined, eqById: Map<string, EquipmentType>): ChecklistRow[] {
  const rows = new Map<string, ChecklistRow>();
  for (const it of preset.items) {
    const eq = eqById.get(it.id);
    if (!eq) continue;
    rows.set(it.id, { eq, tier: it.tier, scenario: false, coverage: eq.coverage, warn: false, note: it.note ?? '' });
  }
  if (scenario && preset.scenarios) {
    for (const it of scenario.items) {
      const eq = eqById.get(it.id);
      if (!eq) continue;
      const row = rows.get(it.id);
      if (row) {
        row.scenario = true;
        if (it.note && !row.note) row.note = it.note;
      } else rows.set(it.id, { eq, tier: null, scenario: true, coverage: eq.coverage, warn: false, note: it.note ?? '' });
    }
  }
  const out = [...rows.values()];
  for (const r of out) r.warn = (r.tier === 'required' || r.scenario) && WARN_COVERAGES.includes(r.coverage);
  return out.sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || layerRank(a.eq.layer) - layerRank(b.eq.layer));
}

export const rowTierLabel = (r: Pick<ChecklistRow, 'tier' | 'scenario'>) =>
  r.tier ? PRESET_TIER_LABELS[r.tier] : r.scenario ? '수전 방식 추가' : '';

function csvCell(raw: string): string {
  // 수식 주입 방지 (catalog.ts buildGapCsv 와 같은 규칙)
  const v = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** 체크리스트 CSV (UTF-8 BOM — Excel 한글) */
export function buildPresetCsv(preset: Preset, scenario: Scenario | undefined, rows: ChecklistRow[]): string {
  const header = ['수요처', '수전 방식', '등급', '계층', '계층명', '기기 ID', '기기명', '보유 상태', '경고', '수전 방식 추가', '메모'];
  const scen = preset.scenarios && scenario ? scenario.label : '';
  const body = rows.map((r) => [
    preset.label,
    scen,
    rowTierLabel(r),
    r.eq.layer,
    LAYER_LABELS[r.eq.layer],
    r.eq.id,
    r.eq.name,
    COVERAGE_LABELS[r.coverage],
    r.warn ? '경고' : '',
    r.scenario ? '예' : '',
    r.note,
  ]);
  return '﻿' + [header, ...body].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
