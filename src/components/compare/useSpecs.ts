import { useEffect, useState } from 'react';
import { loadSpecs, peekSpecs, type SpecsMap } from '../../data/load';

/**
 * specs.json 지연 로딩 상태 (디버그 M6 — 첫 화면 번들에서 빼고, 실패해도 그 화면에서만 안내).
 * 비교 화면·제품 상세(정격 사양 섹션) 공용.
 */
export type SpecsState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; map: SpecsMap };

export const SPECS_ERROR_TEXT = '사양 데이터를 불러오지 못했습니다';

export function useSpecs(logTag = 'compare'): SpecsState {
  const [state, setState] = useState<SpecsState>(() => {
    const map = peekSpecs();
    return map ? { status: 'ready', map } : { status: 'loading' };
  });
  useEffect(() => {
    if (state.status === 'ready') return;
    let alive = true;
    loadSpecs().then(
      (map) => alive && setState({ status: 'ready', map }),
      (e: unknown) => {
        console.error(`[${logTag}] specs.json`, e);
        if (alive) setState({ status: 'error' });
      },
    );
    return () => {
      alive = false;
    };
    // 한 번만 시도 (실패하면 화면에 다시 들어올 때 재시도)
  }, []);
  return state;
}
