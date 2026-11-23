/**
 * 관리자 초안 스토어 — 되돌리기/다시 실행(최대 50단계) + localStorage 자동 저장.
 * 정적 사이트라 서버 저장은 없다: 초안은 이 브라우저에만 저장되고, 내보낸 JSON 을 저장소에 커밋해야 반영된다.
 */
import { create } from 'zustand';
import equipmentTypesJson from '../../data/equipment-types.json';
import diagramJson from '../../data/diagram.json';
import diagramDcJson from '../../data/diagram-dc.json';
import equipmentImagesJson from '../../data/equipment-images.json';
import { cloneDraft, signature, syncReview, type Draft } from './draft';
import { todayIso } from '../labels';

export const HISTORY_LIMIT = 50;
export const STORAGE_KEY = 'lse-admin-draft:v1';
/** 데이터센터(국내) 계통도 초안 (2026-11-23 관리자에서 데이터센터 계통도 편집) */
export const STORAGE_KEY_DC = 'lse-admin-draft-dc:v1';

/** 원본 (raw JSON — 키 순서 유지). 형식 검증은 load.ts getData() 가 앱 시작 때 이미 함 */
export function baseDraft(diagram: unknown = diagramJson): Draft {
  return cloneDraft({
    equipmentTypes: equipmentTypesJson as Draft['equipmentTypes'],
    diagram: diagram as Draft['diagram'],
    images: equipmentImagesJson as Draft['images'],
  });
}

interface Saved {
  savedAt: string;
  baseSig: string;
  draft: Draft;
}

function readSaved(key: string): Saved | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as Saved;
    if (!v?.draft?.diagram || !Array.isArray(v.draft.equipmentTypes)) return null;
    return v;
  } catch {
    return null;
  }
}

export type SaveStatus = 'saved' | 'unavailable' | 'idle';

export interface AdminState {
  base: Draft;
  baseSig: string;
  draft: Draft;
  past: Draft[];
  future: Draft[];
  /** 저장된 초안이 지금 원본과 다른 원본에서 시작됨 (그 사이 데이터가 커밋됨) */
  staleBase: boolean;
  restoredAt: string | null;
  saveStatus: SaveStatus;
  /** 변경 적용 (히스토리 1단계). 노드·연결선·기기가 원본과 다르면 diagram.review 를 검수 대기로 자동 갱신 */
  commit: (next: Draft) => void;
  undo: () => void;
  redo: () => void;
  /** 초안 초기화 = 원본으로 (되돌리기 가능) */
  resetToBase: () => void;
  setSaveStatus: (s: SaveStatus) => void;
}

/** 계통도 하나의 초안 스토어 — 국내 표준(diagram.json)·데이터센터(diagram-dc.json) 각각 따로 (되돌리기·자동 저장도 따로) */
function makeAdminStore(diagram: unknown, storageKey: string) {
  const base = baseDraft(diagram);
  const baseSig = signature(base);
  const saved = readSaved(storageKey);
  const store = create<AdminState>()((set, get) => ({
    base,
    baseSig,
    draft: saved ? syncReview(base, saved.draft, todayIso()) : cloneDraft(base),
    past: [],
    future: [],
    staleBase: saved ? saved.baseSig !== baseSig : false,
    restoredAt: saved ? saved.savedAt : null,
    saveStatus: 'idle',
    commit: (raw) => {
      const { draft, past, base: b } = get();
      if (raw === draft) return;
      const next = syncReview(b, raw, todayIso());
      set({ draft: next, past: [...past, draft].slice(-HISTORY_LIMIT), future: [] });
    },
    undo: () => {
      const { draft, past, future } = get();
      const prev = past[past.length - 1];
      if (!prev) return;
      set({ draft: prev, past: past.slice(0, -1), future: [draft, ...future].slice(0, HISTORY_LIMIT) });
    },
    redo: () => {
      const { draft, past, future } = get();
      const next = future[0];
      if (!next) return;
      set({ draft: next, past: [...past, draft].slice(-HISTORY_LIMIT), future: future.slice(1) });
    },
    resetToBase: () => {
      get().commit(cloneDraft(get().base));
      set({ staleBase: false });
    },
    setSaveStatus: (saveStatus) => set({ saveStatus }),
  }));

  // 자동 저장 (변경 후 300ms). 원본과 같으면 저장본을 지운다. 저장 불가(사생활 모드·용량 초과)면 상태만 표시
  let timer: ReturnType<typeof setTimeout> | undefined;
  store.subscribe((s, prev) => {
    if (s.draft === prev.draft) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const { draft, base: b, baseSig: sig, setSaveStatus } = store.getState();
      try {
        if (signature(draft) === sig && signature(b) === sig) localStorage.removeItem(storageKey);
        else localStorage.setItem(storageKey, JSON.stringify({ savedAt: new Date().toISOString(), baseSig: sig, draft } satisfies Saved));
        setSaveStatus('saved');
      } catch {
        setSaveStatus('unavailable');
      }
    }, 300);
  });
  return store;
}

export const useAdminStore = makeAdminStore(diagramJson, STORAGE_KEY);
/** 데이터센터(국내) 계통도 — 기기 정보는 국내 표준 스토어 것을 쓴다(AdminPage 가 덮어씀), 이 스토어는 계통도만 */
export const useAdminStoreDc = makeAdminStore(diagramDcJson, STORAGE_KEY_DC);
