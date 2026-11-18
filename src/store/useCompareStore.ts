import { create } from 'zustand';
import { getData, type AppData } from '../data/load';

/**
 * 비교 담기 목록 (2026-11-18 비교 기능). 기기와 제품은 별도 목록, 각 최대 4개.
 * 담기 목록은 URL 이 원본이 아니다 — store + localStorage(실패해도 메모리로 동작).
 * 비교 화면(/compare?type&ids)은 URL 이 원본 (공유 가능).
 *
 * 수정 (2026-11-18 디버그):
 *  - B2 데이터에서 사라진 id 는 불러올 때·담을 때 목록에서 정리하고 정리 결과를 저장 (가득 판정은 유효 id 기준).
 *  - M1 여러 탭: storage 이벤트로 다른 탭의 변경을 받아 반영하고, 변경 직전에도 저장소를 다시 읽어
 *    다른 탭이 바꾼 목록 위에 내 변경을 얹는다 (덮어써서 유실되지 않게).
 *
 * 사양 옵션 (2026-11-18 "사양이 모델 옵션별로 다름"):
 *  - 제품 목록의 항목은 "P00206"(시리즈 전체) 또는 "P00206:4000af"(옵션) — 같은 제품의 다른 옵션은 다른 항목.
 *    기존 저장값(옵션 없는 id)은 그대로 유효.
 *  - B2 정리 규칙은 **제품 존재** 기준만 본다. 옵션 id 가 사양에 실제로 있는지는 여기서 검증하지 않는다
 *    (specs.json 은 지연 로딩이라 담기 store 가 기다릴 수 없음) → 비교 화면이 "시리즈 전체"로 되돌리고 안내.
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

/** 비교 항목 id 의 옵션 구분자 (URL 에도 그대로: ids=P00206:4000af) */
export const VARIANT_SEP = ':';
const VARIANT_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * 비교 항목 id 나누기: "P00206:4000af" → { baseId: 'P00206', variantId: '4000af' }, "P00206" → { baseId: 'P00206' }.
 * 구분자 뒤가 비어 있으면 variantId = '' (형식 오류 — compareIdInData 가 거른다).
 */
export function splitCompareId(id: string): { baseId: string; variantId?: string } {
  const i = id.indexOf(VARIANT_SEP);
  return i === -1 ? { baseId: id } : { baseId: id.slice(0, i), variantId: id.slice(i + 1) };
}

/** 비교 항목 id 만들기 (옵션 없으면 제품 id 그대로) */
export function joinCompareId(baseId: string, variantId?: string): string {
  return variantId ? `${baseId}${VARIANT_SEP}${variantId}` : baseId;
}

/**
 * 데이터에 있는 비교 항목인가 — 기기: id 그대로, 제품: 제품 id 가 있고 옵션 부분은 kebab-case 형식이면 통과
 * (옵션이 사양에 실제로 있는지는 보지 않음 — 비교 화면에서 처리)
 */
export function compareIdInData(kind: CompareKind, id: string, data: AppData): boolean {
  if (kind === 'equipment') return data.equipmentTypeById.has(id);
  const { baseId, variantId } = splitCompareId(id);
  if (variantId !== undefined && !VARIANT_ID_RE.test(variantId)) return false;
  return data.productById.has(baseId);
}

const empty: Persisted = { equipment: [], product: [], active: 'equipment' };

/** 데이터에 있는 id 인가. 데이터 검증이 실패하면(렌더 중 ErrorBoundary 가 따로 처리) 정리하지 않는다 */
function exists(kind: CompareKind, id: string): boolean {
  try {
    return compareIdInData(kind, id, getData());
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

/** 비교 화면 주소 — 옵션 구분자 ':' 는 인코딩하지 않고 그대로 둔다 (ids=P00206:4000af,P01021) */
export function compareHref(kind: CompareKind, list: string[]): string {
  return `/compare?type=${kind}&ids=${list.map((id) => encodeURIComponent(id).replace(/%3A/gi, VARIANT_SEP)).join(',')}`;
}
