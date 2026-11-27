/**
 * 단선도 그리기 상태 — 여러 장의 단선도 + 지금 단선도의 되돌리기/다시 실행(50단계) + 브라우저 자동 저장.
 * 저장: localStorage `lse-draw:v1` (이 브라우저에만). 접근이 막히면 메모리로만 동작.
 */
import { create } from 'zustand';
import { emptyDiagram, type Diagram } from './model';
import { encodeDiagram } from './share';

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
  /** 브라우저 저장 실패 (용량 초과 등) */
  saveError: boolean;
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

/**
 * 이름·내용이 완전히 같은 단선도는 하나만 남긴다 (2026-11-27: '예시로 시작'·'단선도 예시로 열기'를 누를 때마다 같은 예시가 쌓였던 것 정리).
 * 같은 묶음 중 지금 보던 것이 있으면 그것을, 없으면 먼저 만든 것을 남긴다. 조금이라도 고친 단선도는 건드리지 않는다.
 */
export function dedupeSaved(v: Saved): { saved: Saved; removed: number } {
  const keep = new Map<string, string>();
  const drop = new Set<string>();
  const keyOf = (id: string) => {
    const d = v.diagrams[id];
    try {
      return `${d.name}|${d.vdLimit ?? ''}|${encodeDiagram(d)}`;
    } catch {
      return `id:${id}`;
    }
  };
  for (const id of v.order) {
    const k = keyOf(id);
    const first = keep.get(k);
    if (!first) keep.set(k, id);
    else if (id === v.currentId) {
      drop.add(first);
      keep.set(k, id);
    } else drop.add(id);
  }
  if (!drop.size) return { saved: v, removed: 0 };
  const order = v.order.filter((id) => !drop.has(id));
  const diagrams = Object.fromEntries(order.map((id) => [id, v.diagrams[id]]));
  return { saved: { currentId: order.includes(v.currentId) ? v.currentId : order[0], order, diagrams }, removed: drop.size };
}

const raw = readSaved();
const deduped = raw ? dedupeSaved(raw) : undefined;
/** 처음 열 때 정리한 같은 단선도 수 (화면 안내용) */
export const DEDUPED_ON_LOAD = deduped?.removed ?? 0;
const saved = deduped?.saved ?? null;
const first = emptyDiagram('단선도 1');
const init: Saved = saved ?? { currentId: first.id, order: [first.id], diagrams: { [first.id]: first } };

export const useDrawStore = create<DrawState>()((set, get) => ({
  ...init,
  saveError: false,
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
let dirty = false;
function saveNow() {
  clearTimeout(timer);
  if (!dirty) return;
  dirty = false;
  const { currentId, order, diagrams, saveError } = useDrawStore.getState();
  try {
    localStorage.setItem(DRAW_STORAGE_KEY, JSON.stringify({ currentId, order, diagrams } satisfies Saved));
    if (saveError) useDrawStore.setState({ saveError: false });
  } catch {
    // 저장 불가(용량 초과·차단) — 화면에 알리고 메모리로만
    if (!saveError) useDrawStore.setState({ saveError: true });
  }
}
useDrawStore.subscribe((s, prev) => {
  if (s.diagrams === prev.diagrams && s.currentId === prev.currentId && s.order === prev.order) return;
  dirty = true;
  clearTimeout(timer);
  timer = setTimeout(saveNow, 300);
});
// 처음 열 때 같은 단선도를 정리했으면 바로 저장 (다음에 열 때 다시 정리하지 않게)
if (DEDUPED_ON_LOAD) {
  dirty = true;
  saveNow();
}
// 탭을 닫거나 다른 화면으로 가기 직전에는 기다리지 않고 저장
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && saveNow());
  window.addEventListener('beforeunload', saveNow);
}
