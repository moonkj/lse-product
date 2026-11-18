import { create } from 'zustand';
import { getData } from '../data/load';

/**
 * 비교 담기 목록 (2026-11-18 비교 기능). 기기와 제품은 별도 목록, 각 최대 4개.
 * 담기 목록은 URL 이 원본이 아니다 — store + localStorage(실패해도 메모리로 동작).
 * 비교 화면(/compare?type&ids)은 URL 이 원본 (공유 가능).
 *
 * 수정 (2026-11-18 디버그):
 *  - B2 데이터에서 사라진 id 는 불러올 때·담을 때 목록에서 정리하고 정리 결과를 저장 (가득 판정은 유효 id 기준).
 *  - M1 여러 탭: storage 이벤트로 다른 탭의 변경을 받아 반영하고, 변경 직전에도 저장소를 다시 읽어
 *    다른 탭이 바꾼 목록 위에 내 변경을 얹는다 (덮어써서 유실되지 않게).
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

/** 데이터에 있는 id 인가. 데이터 검증이 실패하면(렌더 중 ErrorBoundary 가 따로 처리) 정리하지 않는다 */
function exists(kind: CompareKind, id: string): boolean {
  try {
    const data = getData();
    return kind === 'equipment' ? data.equipmentTypeById.has(id) : data.productById.has(id);
  } catch {
    return true;
  }
}

/** 형식 정리: 문자열·중복 제거·데이터에 있는 id 만·최대 4개 */
const ids = (kind: CompareKind, v: unknown): string[] =>
  Array.isArray(v)
    ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x.length > 0))].filter((id) => exists(kind, id)).slice(0, COMPARE_MAX)
    : [];

/** 마지막으로 읽거나 쓴 저장 문자열 — 저장소 값이 이것과 다르면 다른 탭이 바꾼 것 */
let lastRaw: string | null | undefined;

function readRaw(): string | null | undefined {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return undefined; // 읽기 불가 (사생활 보호 모드 등)
  }
}

function parse(raw: string | null | undefined): Persisted {
  if (!raw) return empty;
  try {
    const v = JSON.parse(raw) as Partial<Persisted> | null;
    if (!v || typeof v !== 'object') return empty;
    return { equipment: ids('equipment', v.equipment), product: ids('product', v.product), active: v.active === 'product' ? 'product' : 'equipment' };
  } catch {
    return empty;
  }
}

const serialize = (s: Persisted) => JSON.stringify({ equipment: s.equipment, product: s.product, active: s.active });

function save(s: Persisted) {
  const raw = serialize(s);
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, raw);
    lastRaw = raw;
  } catch {
    /* 저장 실패(사생활 보호 모드 등)해도 메모리 목록으로 계속 동작 */
  }
}

/** 시작 시 불러오기 — 사라진 id 를 정리했으면 정리 결과를 저장 */
function load(): Persisted {
  const raw = readRaw();
  lastRaw = raw;
  const s = parse(raw);
  if (raw && serialize(s) !== raw) save(s);
  return s;
}

export const useCompareStore = create<CompareState>()((set, get) => {
  const pick = (): Persisted => {
    const { equipment, product, active } = get();
    return { equipment, product, active };
  };
  /** 다른 탭이 저장소를 바꿨으면 그 값을 먼저 반영 (변경 직전·storage 이벤트) */
  const syncFromStorage = () => {
    const raw = readRaw();
    if (raw === undefined || raw === lastRaw) return;
    lastRaw = raw;
    set(parse(raw));
  };
  const commit = (patch: Partial<Persisted>) => {
    set(patch);
    save(pick());
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY || e.key === null) syncFromStorage();
    });
  }

  return {
    ...load(),
    toggle: (kind, id) => {
      syncFromStorage();
      let list = get()[kind];
      if (list.includes(id)) {
        commit({ [kind]: list.filter((x) => x !== id) });
        return 'removed';
      }
      if (list.length >= COMPARE_MAX) {
        // 가득 판정은 데이터에 있는 id 기준 — 사라진 id 가 자리를 차지하면 정리하고 저장 (계속 열려 있던 탭 대비)
        const valid = list.filter((x) => exists(kind, x));
        if (valid.length >= COMPARE_MAX) return 'full';
        list = valid;
      }
      commit({ [kind]: [...list, id], active: kind });
      return 'added';
    },
    remove: (kind, id) => {
      syncFromStorage();
      commit({ [kind]: get()[kind].filter((x) => x !== id) });
    },
    clear: (kind) => {
      syncFromStorage();
      const other: CompareKind = kind === 'equipment' ? 'product' : 'equipment';
      commit({ [kind]: [], active: get()[other].length > 0 ? other : get().active });
    },
    setActive: (active) => {
      syncFromStorage();
      commit({ active });
    },
  };
});

/** 비교 화면 주소 */
export function compareHref(kind: CompareKind, list: string[]): string {
  return `/compare?type=${kind}&ids=${list.map(encodeURIComponent).join(',')}`;
}
