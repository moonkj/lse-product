import { create } from 'zustand';
import type { ScenarioId } from './presets';

/**
 * 수요처 프리셋 선택 상태 (계통도 강조). URL 이 아니라 메모리 — 다른 화면에 다녀와도 유지, 새로고침이면 풀림.
 * 영역 선택(view store focus)·공백만 보기(?mode=gap)와 독립 — 함께 켤 수 있다.
 */
export interface PresetState {
  presetId: string | null;
  scenarioId: ScenarioId | null;
  setPreset: (id: string | null) => void;
  setScenario: (id: ScenarioId | null) => void;
  clear: () => void;
}

export const usePresetStore = create<PresetState>((set) => ({
  presetId: null,
  scenarioId: null,
  setPreset: (presetId) => set({ presetId }),
  setScenario: (scenarioId) => set({ scenarioId }),
  clear: () => set({ presetId: null, scenarioId: null }),
}));
