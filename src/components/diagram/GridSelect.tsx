import { GRID_IDS, GRID_LABELS, GRID_TITLES, parseGrid, useGrid, useSetGrid } from '../../lib/diagram/grid';
import { announce } from '../../lib/announce';

/**
 * 계통 종류 선택 [국내 표준 | 데이터센터(국내)] — 계통맵 도구줄, 보기 방식 스위치 바로 옆 (2026-11-23 사용자 요청).
 * 도구줄 폭이 빠듯해 버튼 묶음 대신 선택 상자. 주소 `?grid=dc` 가 원본.
 */
export default function GridSelect() {
  const grid = useGrid();
  const setGrid = useSetGrid();
  return (
    <label className="dgrid" title={GRID_TITLES[grid]}>
      <span className="dgrid__label">계통</span>
      <select
        className="dgrid__select"
        value={grid}
        data-testid="grid-select"
        onChange={(e) => {
          const g = parseGrid(e.target.value);
          setGrid(g);
          announce(`${GRID_LABELS[g]} 계통도`);
        }}
      >
        {GRID_IDS.map((g) => (
          <option key={g} value={g}>
            {GRID_LABELS[g]}
          </option>
        ))}
      </select>
    </label>
  );
}
