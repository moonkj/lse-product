/**
 * 계통 구성 시뮬레이션 상태 — 템플릿별 구성(Build) + 되돌리기·다시 실행(50단계) + 브라우저 자동 저장.
 * 저장은 이 브라우저에만 (localStorage `lse-builder:v1`). 접근이 막히면 메모리로만 동작.
 */
import { create } from 'zustand';
import { TEMPLATES, templateById } from './templates';
import { emptyBuild, type Build } from './validate';

export const BUILDER_STORAGE_KEY = 'lse-builder:v1';
const HISTORY_LIMIT = 50;

interface Saved {
  templateId: string;
  builds: Record<string, Build>;
}

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(BUILDER_STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Saved;
    if (!v || typeof v.templateId !== 'string' || typeof v.builds !== 'object') return null;
    // 모양이 깨진 구성은 버림
    for (const [k, b] of Object.entries(v.builds)) if (!b || typeof b.slots !== 'object' || !Array.isArray(b.extras) || !b.params) delete v.builds[k];
    return v;
  } catch {
    return null;
  }
}

export interface BuilderState {
  templateId: string;
  builds: Record<string, Build>;
  past: Build[];
  future: Build[];
  setTemplate: (id: string) => void;
  commit: (next: Build) => void;
  undo: () => void;
  redo: () => void;
}

const saved = readSaved();
const startId = templateById(saved?.templateId)?.id ?? TEMPLATES[0].id;

export const useBuilderStore = create<BuilderState>()((set, get) => ({
  templateId: startId,
  builds: saved?.builds ?? {},
  past: [],
  future: [],
  setTemplate: (id) => {
    if (!templateById(id) || id === get().templateId) return;
    set({ templateId: id, past: [], future: [] });
  },
  commit: (next) => {
    const { templateId, builds, past } = get();
    const cur = builds[templateId] ?? emptyBuild(templateById(templateId)!);
    if (next === cur) return;
    set({ builds: { ...builds, [templateId]: next }, past: [...past, cur].slice(-HISTORY_LIMIT), future: [] });
  },
  undo: () => {
    const { templateId, builds, past, future } = get();
    const prev = past[past.length - 1];
    if (!prev) return;
    const cur = builds[templateId] ?? emptyBuild(templateById(templateId)!);
    set({ builds: { ...builds, [templateId]: prev }, past: past.slice(0, -1), future: [cur, ...future].slice(0, HISTORY_LIMIT) });
  },
  redo: () => {
    const { templateId, builds, past, future } = get();
    const next = future[0];
    if (!next) return;
    const cur = builds[templateId] ?? emptyBuild(templateById(templateId)!);
    set({ builds: { ...builds, [templateId]: next }, past: [...past, cur].slice(-HISTORY_LIMIT), future: future.slice(1) });
  },
}));

/** 지금 템플릿의 구성 (없으면 빈 구성) */
export function useCurrentBuild(): Build {
  const templateId = useBuilderStore((s) => s.templateId);
  const build = useBuilderStore((s) => s.builds[s.templateId]);
  return build ?? emptyBuild(templateById(templateId)!);
}

let timer: ReturnType<typeof setTimeout> | undefined;
useBuilderStore.subscribe((s, prev) => {
  if (s.builds === prev.builds && s.templateId === prev.templateId) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      const { templateId, builds } = useBuilderStore.getState();
      localStorage.setItem(BUILDER_STORAGE_KEY, JSON.stringify({ templateId, builds } satisfies Saved));
    } catch {
      /* 저장 불가 — 메모리로만 */
    }
  }, 300);
});
