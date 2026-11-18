import { create } from 'zustand';

/**
 * 비교 담기 목록 (2026-11-18 비교 기능). 기기와 제품은 별도 목록, 각 최대 4개.
 * 담기 목록은 URL 이 원본이 아니다 — store + localStorage(실패해도 메모리로 동작).
 * 비교 화면(/compare?type&ids)은 URL 이 원본 (공유 가능).
 */
export type CompareKind = 'equipment' | 'product';
export const COMPARE_MAX = 4;
const STORAGE_KEY = 'lse-compare-v1';

interface Persisted {
  equipment: string[];
  product: string[];
  active: CompareKind;
}

export interface CompareState extends Persisted {
  /** 담기/빼기 토글. 가득 찼으면 'full' (변화 없음) */
  toggle: (kind: CompareKind, id: string) => 'added' | 'removed' | 'full';
  remove: (kind: CompareKind, id: string) => void;
  clear: (kind: CompareKind) => void;
  setActive: (kind: CompareKind) => void;
}

const empty: Persisted = { equipment: [], product: [], active: 'equipment' };

const ids = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x.length > 0))].slice(0, COMPARE_MAX) : [];

function load(): Persisted {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const v = JSON.parse(raw) as Partial<Persisted>;
    return { equipment: ids(v.equipment), product: ids(v.product), active: v.active === 'product' ? 'product' : 'equipment' };
  } catch {
    return empty;
  }
}

function save(s: Persisted) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ equipment: s.equipment, product: s.product, active: s.active }));
  } catch {
    /* 저장 실패(사생활 보호 모드 등)해도 메모리 목록으로 계속 동작 */
  }
}

export const useCompareStore = create<CompareState>()((set, get) => {
  const commit = (patch: Partial<Persisted>) => {
    set(patch);
    const { equipment, product, active } = get();
    save({ equipment, product, active });
  };
  return {
    ...load(),
    toggle: (kind, id) => {
      const list = get()[kind];
      if (list.includes(id)) {
        commit({ [kind]: list.filter((x) => x !== id) });
        return 'removed';
      }
      if (list.length >= COMPARE_MAX) return 'full';
      commit({ [kind]: [...list, id], active: kind });
      return 'added';
    },
    remove: (kind, id) => commit({ [kind]: get()[kind].filter((x) => x !== id) }),
    clear: (kind) => {
      const other: CompareKind = kind === 'equipment' ? 'product' : 'equipment';
      commit({ [kind]: [], active: get()[other].length > 0 ? other : get().active });
    },
    setActive: (active) => commit({ active }),
  };
});

/** 비교 화면 주소 */
export function compareHref(kind: CompareKind, list: string[]): string {
  return `/compare?type=${kind}&ids=${list.map(encodeURIComponent).join(',')}`;
}
