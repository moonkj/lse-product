/**
 * UX 라운드 U — B3 "보이는 영역" 계산 (src/lib/diagram/viewport.ts)
 * 자동 팬은 viewport 에서 하단 시트·비교 바(큰 덮개)를 잘라 낸 영역의 가운데로, 미니맵(작은 덮개)은 겹침만 판정.
 */
import { describe, expect, it } from 'vitest';
import { centerOf, isFullyVisible, subtractObstacles } from '../../../src/lib/diagram/viewport';

const VP = { x: 0, y: 0, w: 880, h: 788 };

describe('B3 subtractObstacles', () => {
  it('덮개가 없으면 viewport 전체', () => {
    expect(subtractObstacles(VP, [])).toEqual({ free: VP, small: [] });
  });

  it('모바일 하단 시트(가로 전체) → 시트 위쪽만 남김', () => {
    const vp = { x: 0, y: 0, w: 390, h: 600 };
    const { free } = subtractObstacles(vp, [{ x: 0, y: 380, w: 390, h: 500 }]);
    expect(free).toEqual({ x: 0, y: 0, w: 390, h: 380 });
    expect(centerOf(free)).toEqual({ x: 195, y: 190 });
  });

  it('비교 바(가로 60% 이상) → 아래를 잘라 냄, 미니맵(작음) → small 로 남김', () => {
    const tray = { x: 16, y: 714, w: 700, h: 58 };
    const minimap = { x: 764, y: 600, w: 100, h: 172 };
    const va = subtractObstacles(VP, [minimap, tray]);
    expect(va.free).toEqual({ x: 0, y: 0, w: 880, h: 714 });
    expect(va.small).toEqual([{ x: 764, y: 600, w: 100, h: 114 }]);
  });

  it('오른쪽에 겹쳐 뜬 패널(세로 전체) → 왼쪽만 남김', () => {
    const { free } = subtractObstacles(VP, [{ x: 520, y: -50, w: 400, h: 900 }]);
    expect(free).toEqual({ x: 0, y: 0, w: 520, h: 788 });
  });

  it('viewport 밖 덮개는 무시, 거의 다 덮는 덮개는 잘라 내지 않음(남은 영역이 너무 작음)', () => {
    expect(subtractObstacles(VP, [{ x: 0, y: 900, w: 880, h: 100 }]).free).toEqual(VP);
    expect(subtractObstacles(VP, [{ x: 0, y: 40, w: 880, h: 760 }]).free).toEqual(VP);
  });
});

describe('B3 isFullyVisible', () => {
  const va = subtractObstacles(VP, [
    { x: 764, y: 600, w: 100, h: 172 },
    { x: 16, y: 714, w: 700, h: 58 },
  ]);
  it('보이는 영역 안 + 여백 → true', () => {
    expect(isFullyVisible({ x: 100, y: 100, w: 96, h: 93 }, va)).toBe(true);
  });
  it('비교 바 밑(잘린 아래쪽) → false', () => {
    expect(isFullyVisible({ x: 100, y: 680, w: 96, h: 93 }, va)).toBe(false);
  });
  it('미니맵과 겹침 → false', () => {
    expect(isFullyVisible({ x: 700, y: 580, w: 96, h: 93 }, va)).toBe(false);
  });
  it('가장자리 여백(8px) 안쪽으로 붙으면 false', () => {
    expect(isFullyVisible({ x: 2, y: 100, w: 96, h: 93 }, va)).toBe(false);
  });
});
