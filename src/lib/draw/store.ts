/**
 * 단선도 그리기 상태 — 여러 장의 단선도 + 지금 단선도의 되돌리기/다시 실행(50단계) + 브라우저 자동 저장.
 * 저장: localStorage `lse-draw:v1` (이 브라우저에만). 접근이 막히면 메모리로만 동작.
 */
import { create } from 'zustand';
import { emptyDiagram, type Diagram } from './model';

export const DRAW_STORAGE_KEY = 'lse-draw:v1';
const HISTORY_LIMIT = 50;

interface Saved {
  currentId: string;
  order: string[];
  diagrams: Record<string, Diagram>;
}

function valid(d: unknown): d is Diagram {
  const x = d as Diagram;
  return !!x && typeof x.id === 'string' && typeof x.name === 'string' && Array.isArray(x.nodes) && Array.isArray(x.edges);
}

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(DRAW_STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Saved;
    if (!v || typeof v.diagrams !== 'object' || !Array.isArray(v.order)) return null;
    v.order = v.order.filter((id) => valid(v.diagrams[id]));
    if (!v.order.length) return null;
    if (!v.order.includes(v.currentId)) v.currentId = v.order[0];
    return v;
  } catch {
    return null;
  }
}

export interface DrawState extends Saved {
  past: Diagram[];
  future: Diagram[];
  /** 지금 단선도 바꾸기 (되돌리기 기록에 남김) */
  commit: (next: Diagram) => void;
  /** 끌어 옮기는 중처럼 기록 없이 바꾸기 — 끝나면 commitFrom(시작 상태) 로 한 단계로 남긴다 */
  replace: (next: Diagram) => void;
  commitFrom: (before: Diagram) => void;
  undo: () => void;
  redo: () => void;
  open: (id: string) => void;
  create: (d?: Diagram) => void;
  rename: (name: string) => void;
  duplicate: () => void;
  remove: (id: string) => void;
}

const saved = readSaved();
const first = emptyDiagram('단선도 1');
const init: Saved = saved ?? { currentId: first.id, order: [first.id], diagrams: { [first.id]: first } };

export const useDrawStore = create<DrawState>()((set, get) => ({
  ...init,
  past: [],
  future: [],
  commit: (next) => {
    const { currentId, diagrams, past } = get();
    const cur = diagrams[currentId];
    if (next === cur) return;
    set({ diagrams: { ...diagrams, [currentId]: next }, past: [...past, cur].slice(-HISTORY_LIMIT), future: [] });
  },
  replace: (next) => {
    const { currentId, diagrams } = get();
    set({ diagrams: { ...diagrams, [currentId]: next } });
  },
  commitFrom: (before) => {
    const { currentId, diagrams, past } = get();
    if (diagrams[currentId] === before) return;
    set({ past: [...past, before].slice(-HISTORY_LIMIT), future: [] });
  },
  undo: () => {
    const { currentId, diagrams, past, future } = get();
    const prev = past[past.length - 1];
    if (!prev) return;
    set({ diagrams: { ...diagrams, [currentId]: prev }, past: past.slice(0, -1), future: [diagrams[currentId], ...future].slice(0, HISTORY_LIMIT) });
  },
  redo: () => {
    const { currentId, diagrams, past, future } = get();
    const next = future[0];
    if (!next) return;
    set({ diagrams: { ...diagrams, [currentId]: next }, past: [...past, diagrams[currentId]].slice(-HISTORY_LIMIT), future: future.slice(1) });
  },
  open: (id) => {
    if (!get().diagrams[id] || id === get().currentId) return;
    set({ currentId: id, past: [], future: [] });
  },
  create: (d) => {
    const { order, diagrams } = get();
    const next = d ?? emptyDiagram(`단선도 ${order.length + 1}`);
    set({ diagrams: { ...diagrams, [next.id]: next }, order: [...order, next.id], currentId: next.id, past: [], future: [] });
  },
  rename: (name) => {
    const { currentId, diagrams } = get();
    const n = name.trim().slice(0, 40);
    if (!n) return;
    set({ diagrams: { ...diagrams, [currentId]: { ...diagrams[currentId], name: n } } });
  },
  duplicate: () => {
    const { currentId, diagrams } = get();
    const src = diagrams[currentId];
    const copy = emptyDiagram(`${src.name} 사본`);
    get().create({ ...copy, nodes: structuredClone(src.nodes), edges: structuredClone(src.edges) });
  },
  remove: (id) => {
    const { order, diagrams, currentId } = get();
    if (!diagrams[id]) return;
    const rest = order.filter((x) => x !== id);
    const nextDiagrams = { ...diagrams };
    delete nextDiagrams[id];
    if (!rest.length) {
      const fresh = emptyDiagram('단선도 1');
      set({ diagrams: { [fresh.id]: fresh }, order: [fresh.id], currentId: fresh.id, past: [], future: [] });
      return;
    }
    set({ diagrams: nextDiagrams, order: rest, currentId: id === currentId ? rest[0] : currentId, ...(id === currentId ? { past: [], future: [] } : {}) });
  },
}));

export const useCurrentDiagram = (): Diagram => useDrawStore((s) => s.diagrams[s.currentId]);

let timer: ReturnType<typeof setTimeout> | undefined;
useDrawStore.subscribe((s, prev) => {
  if (s.diagrams === prev.diagrams && s.currentId === prev.currentId && s.order === prev.order) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      const { currentId, order, diagrams } = useDrawStore.getState();
      localStorage.setItem(DRAW_STORAGE_KEY, JSON.stringify({ currentId, order, diagrams } satisfies Saved));
    } catch {
      /* 저장 불가 — 메모리로만 */
    }
  }, 300);
});
