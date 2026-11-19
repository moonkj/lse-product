/**
 * F1 폭·레이아웃 (2026-11-19) — PanZoom 폭 맞춤(fitWidth)·도면 시트 틀(frame)·좁을 때 가운데 정렬
 */
import { afterEach, describe, expect, it } from 'vitest';
import { PanZoom } from '../../../src/lib/diagram/panzoom';
import diagram from '../../../src/data/diagram.json';

function setup(vw: number, vh: number, frame = true) {
  const vp = document.createElement('div');
  Object.defineProperty(vp, 'clientWidth', { configurable: true, get: () => vw });
  Object.defineProperty(vp, 'clientHeight', { configurable: true, get: () => vh });
  const sizer = document.createElement('div');
  const inner = document.createElement('div');
  const sheet = document.createElement('div');
  vp.append(sizer);
  sizer.append(sheet, inner);
  document.body.append(vp);
  const pz = new PanZoom(vp, sizer, inner, {
    width: diagram.width,
    height: diagram.height,
    maxScale: 2,
    frame: frame ? { el: sheet, pad: 16, bottom: 72 } : undefined,
    onView: () => {},
  });
  return { vp, sizer, inner, sheet, pz };
}

const px = (v: string) => parseFloat(v);
let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
  document.body.innerHTML = '';
});

describe('계통도 폭 (diagram.json)', () => {
  it('주 계층 ×1.3 + 감시·신재생 열 700 → 폭 3010, 가로:세로 0.68 이상', () => {
    expect(diagram.width).toBe(3010);
    const side = diagram.layers.filter((l) => l.id === 'MON' || l.id === 'REN');
    expect(side.every((l) => l.width === 700 && l.x === 2310)).toBe(true);
    expect(diagram.width / diagram.height).toBeGreaterThan(0.68);
  });
});

describe('PanZoom.fitWidth (폭 맞춤)', () => {
  it('배율 = (화면 폭 − 64) / 계통도 폭: 1440 화면(캔버스 ≈1188) 37%, 1920(≈1668) 53%', () => {
    const a = setup(1188, 764);
    cleanup = () => a.pz.destroy();
    a.pz.fitWidth();
    expect(Math.round(a.pz.scale * 100)).toBe(37);
    expect(a.vp.scrollTop).toBe(0);
    a.pz.destroy();
    const b = setup(1668, 900);
    cleanup = () => b.pz.destroy();
    b.pz.fitWidth();
    expect(Math.round(b.pz.scale * 100)).toBe(53);
  });

  it('아주 넓은 화면에서도 100% 를 넘지 않음', () => {
    const a = setup(5000, 900);
    cleanup = () => a.pz.destroy();
    expect(a.pz.fitWidthScale()).toBe(1);
  });
});

describe('도면 시트 틀 (frame)', () => {
  it('시트 = 그림 둘레 16px, 시트 아래 여백 72px 이상, 그림이 좁으면 가운데', () => {
    const { pz, sheet, sizer, inner } = setup(1600, 900);
    cleanup = () => pz.destroy();
    pz.fitAll(); // 높이가 배율을 정함 → 그림 폭 < 화면 폭
    const s = pz.scale;
    const cw = diagram.width * s;
    const ch = diagram.height * s;
    expect(px(sheet.style.width)).toBeCloseTo(cw + 32, 2);
    expect(px(sheet.style.height)).toBeCloseTo(ch + 32, 2);
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(inner.style.transform)!;
    const ox = Number(m[1]);
    const oy = Number(m[2]);
    expect(px(sheet.style.left)).toBeCloseTo(ox - 16, 2);
    expect(px(sheet.style.top)).toBeCloseTo(oy - 16, 2);
    // 가운데: 왼쪽 여백 = 오른쪽 여백
    const sw = px(sizer.style.width);
    expect(ox).toBeCloseTo(sw - ox - cw, 2);
    // 시트 아래 72px 이상 남음
    const sheetBottom = px(sheet.style.top) + px(sheet.style.height);
    expect(px(sizer.style.height) - sheetBottom).toBeGreaterThanOrEqual(72 - 1e-6);
  });

  it('frame 없이(관리자 캔버스) 쓰면 예전처럼 위·아래 여백이 같다', () => {
    const { pz, sizer, inner } = setup(400, 300, false);
    cleanup = () => pz.destroy();
    pz.zoomAt(1, 0, 0);
    const oy = Number(/translate\([-\d.]+px, ([-\d.]+)px\)/.exec(inner.style.transform)![1]);
    expect(oy).toBeCloseTo((px(sizer.style.height) - diagram.height * pz.scale) / 2, 2);
  });
});
