/**
 * 관리자 사양 초안 스토어 — 계통도 초안 스토어(store.ts)와 같은 패턴(되돌리기 50단계 + localStorage 자동 저장),
 * 저장 키만 별도. specs.json 은 크기가 커서 지연 로딩(loadSpecs, 스키마 검증 포함) — "사양 검수" 탭을 열 때 load().
 * 원본 키 순서를 지키려고 편집 원본은 raw JSON(같은 청크)을 복제해 쓴다.
 */
import { create } from 'zustand';
import { loadSpecs } from '../../data/load';
import type { SpecsFile } from '../schema';
import { toJsonText } from './draft';
import { cloneSpecs } from './specs';
import { HISTORY_LIMIT, type SaveStatus } from './store';

export const SPECS_STORAGE_KEY = 'lse-admin-specs-draft:v1';

export function specsSignature(f: SpecsFile): string {
  const s = toJsonText(f);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${s.length}-${(h >>> 0).toString(16)}`;
}

interface Saved {
  savedAt: string;
  baseSig: string;
  draft: SpecsFile;
}

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(SPECS_STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Saved;
    if (!v?.draft?.products || typeof v.draft.products !== 'object') return null;
    return v;
  } catch {
    return null;
  }
}

export interface SpecsAdminState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  base: SpecsFile | null;
  baseSig: string;
  draft: SpecsFile | null;
  past: SpecsFile[];
  future: SpecsFile[];
  staleBase: boolean;
  restoredAt: string | null;
  saveStatus: SaveStatus;
  load: () => Promise<void>;
  commit: (next: SpecsFile) => void;
  undo: () => void;
  redo: () => void;
  resetToBase: () => void;
}

export const useSpecsAdminStore = create<SpecsAdminState>()((set, get) => ({
  status: 'idle',
  error: null,
  base: null,
  baseSig: '',
  draft: null,
  past: [],
  future: [],
  staleBase: false,
  restoredAt: null,
  saveStatus: 'idle',
  load: async () => {
    if (get().status === 'loading' || get().status === 'ready') return;
    set({ status: 'loading', error: null });
    try {
      // loadSpecs = 스키마 검증(앱과 같은 경로). raw 모듈은 같은 청크 — 키 순서 유지용
      const [, raw] = await Promise.all([loadSpecs(), import('../../data/specs.json')]);
      const base = cloneSpecs(raw.default as SpecsFile);
      const baseSig = specsSignature(base);
      const saved = readSaved();
      set({
        status: 'ready',
        base,
        baseSig,
        draft: saved ? saved.draft : cloneSpecs(base),
        past: [],
        future: [],
        staleBase: saved ? saved.baseSig !== baseSig : false,
        restoredAt: saved ? saved.savedAt : null,
      });
    } catch (e) {
      set({ status: 'error', error: (e as Error).message });
    }
  },
  commit: (next) => {
    const { draft, past } = get();
    if (!draft || next === draft) return;
    set({ draft: next, past: [...past, draft].slice(-HISTORY_LIMIT), future: [] });
  },
  undo: () => {
    const { draft, past, future } = get();
    const prev = past[past.length - 1];
    if (!prev || !draft) return;
    set({ draft: prev, past: past.slice(0, -1), future: [draft, ...future].slice(0, HISTORY_LIMIT) });
  },
  redo: () => {
    const { draft, past, future } = get();
    const next = future[0];
    if (!next || !draft) return;
    set({ draft: next, past: [...past, draft].slice(-HISTORY_LIMIT), future: future.slice(1) });
  },
  resetToBase: () => {
    const b = get().base;
    if (!b) return;
    get().commit(cloneSpecs(b));
    set({ staleBase: false });
  },
}));

// 자동 저장 (변경 후 300ms) — 원본과 같으면 저장본 삭제
let timer: ReturnType<typeof setTimeout> | undefined;
useSpecsAdminStore.subscribe((s, prev) => {
  if (s.draft === prev.draft || !s.draft || prev.status !== 'ready') return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    const { draft, baseSig } = useSpecsAdminStore.getState();
    if (!draft) return;
    try {
      if (specsSignature(draft) === baseSig) localStorage.removeItem(SPECS_STORAGE_KEY);
      else localStorage.setItem(SPECS_STORAGE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), baseSig, draft } satisfies Saved));
      useSpecsAdminStore.setState({ saveStatus: 'saved' });
    } catch {
      useSpecsAdminStore.setState({ saveStatus: 'unavailable' });
    }
  }, 300);
});
