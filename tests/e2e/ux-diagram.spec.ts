/**
 * UX 라운드 U — 계통도 갈래 회귀 (B2 위치 동기화 · B3 보이는 영역 자동 팬 · B4 포커스 · B5 뒤로가기 · B9 Gap 흐림 대비)
 * 셀렉터는 data-testid, 기기는 src/data/*.json 에서 조건으로 고른다 (id 하드코딩 금지).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page } from '@playwright/test';

type Coverage = 'owned' | 'partial' | 'affiliate' | 'sourced' | 'missing' | 'na';
interface Eq {
  id: string;
  name: string;
  abbr?: string;
  layer: string;
  coverage: Coverage;
}
interface DNode {
  id: string;
  kind?: string;
  ref?: boolean;
  equipmentTypeId?: string;
  x: number;
  y: number;
}
const load = <T,>(f: string): T => JSON.parse(readFileSync(fileURLToPath(new URL(`../../src/data/${f}`, import.meta.url)), 'utf8')) as T;
const equipment = load<Eq[]>('equipment-types.json');
const eqById = new Map(equipment.map((e) => [e.id, e]));
const nodes = load<{ nodes: DNode[] }>('diagram.json').nodes.filter((n) => (n.kind ?? 'equipment') === 'equipment' && !n.ref && n.equipmentTypeId);
const withEq = nodes.map((n) => ({ node: n, eq: eqById.get(n.equipmentTypeId!)! })).filter((x) => x.eq);

const tid = (page: Page, id: string) => page.locator(`[data-testid="${id}"]`);
const tile = (page: Page, nodeId: string) => tid(page, `diagram-node-${nodeId}`);

async function gotoHome(page: Page, search = '') {
  await page.goto(`./#/${search}`);
  await expect(tid(page, 'diagram')).toBeVisible();
}

/** 화면 % 배율 (툴바) */
async function zoomPct(page: Page) {
  return parseInt((await tid(page, 'zoom-pct').textContent()) ?? '0', 10);
}

/** 타일이 계통도 viewport 안에 있고 상세 패널·미니맵·비교 바와 겹치지 않는지 */
async function tileUnobscured(page: Page, nodeId: string) {
  return page.evaluate((id) => {
    const r = document.querySelector(`[data-node-id="${id}"]`)!.getBoundingClientRect();
    const vp = document.getElementById('diagram-viewport')!.getBoundingClientRect();
    const inVp = r.left >= vp.left && r.right <= vp.right && r.top >= vp.top && r.bottom <= vp.bottom;
    const covers = [...document.querySelectorAll('[data-testid="detail-panel"], .minimap, [data-testid="compare-tray"]')].filter((el) => {
      const b = el.getBoundingClientRect();
      return b.width > 0 && !(r.right <= b.left || r.left >= b.right || r.bottom <= b.top || r.top >= b.bottom);
    });
    return inVp && covers.length === 0;
  }, nodeId);
}

test.describe('UX-U 계통도 (T1-A)', () => {
  const searchTarget = withEq.find((x) => x.eq.layer !== 'L4' && x.eq.coverage === 'owned');

  test('B2 전체 보기 상태에서 검색으로 기기 열기 → 그 기기로 이동 + 읽을 수 있는 배율 + 현재 계층 = 기기 계층', async ({ page }) => {
    test.skip(!searchTarget, '대상 기기 없음');
    const { node, eq } = searchTarget!;
    await gotoHome(page);
    await tid(page, 'zoom-reset').click();
    expect(await zoomPct(page)).toBeLessThan(40);
    await tid(page, 'search-input').fill(eq.name);
    await tid(page, `search-result-equipment-${eq.id}`).click();
    await expect(page).toHaveURL(new RegExp(`node=${node.id}`));
    await expect.poll(() => zoomPct(page)).toBeGreaterThanOrEqual(60);
    await expect.poll(() => tileUnobscured(page, node.id)).toBe(true);
    await expect(tid(page, `layer-nav-${eq.layer}`)).toHaveAttribute('aria-current', 'true');
  });

  test('B2 계층 내비 L1 클릭 → 현재 계층 표시도 L1 (L2 로 어긋나지 않음), 전체 보기 → 특정 계층 표시 없음', async ({ page }) => {
    await gotoHome(page);
    await tid(page, 'layer-nav-L1').click();
    await expect(tid(page, 'layer-nav-L1')).toHaveAttribute('aria-current', 'true');
    await expect(tid(page, 'layer-nav-L2')).not.toHaveAttribute('aria-current', 'true');
    await tid(page, 'layer-nav-L7').click();
    await expect(tid(page, 'layer-nav-L7')).toHaveAttribute('aria-current', 'true');
    await tid(page, 'zoom-reset').click();
    await expect(page.locator('[data-testid^="layer-nav-"][aria-current="true"]')).toHaveCount(0);
  });

  test('B3 비교 바·미니맵이 있어도 Tab 으로 지나는 모든 타일이 가리지 않은 영역에 보인다', async ({ page }) => {
    const first = withEq.find((x) => x.eq.coverage === 'owned');
    test.skip(!first, '보유 기기 없음');
    await gotoHome(page, `?node=${first!.node.id}`);
    await tid(page, `compare-toggle-${first!.eq.id}`).first().click();
    await expect(tid(page, 'compare-tray')).toBeVisible();
    await page.locator('.dnode[data-node-id]').first().focus();
    const hidden: string[] = [];
    for (let i = 0; i < 100; i++) {
      const id = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset?.nodeId);
      if (!id) break;
      await expect.poll(() => tileUnobscured(page, id), { timeout: 1000 }).toBe(true).catch(() => hidden.push(id));
      await page.keyboard.press('Tab');
    }
    expect(hidden).toEqual([]);
  });

  test('B4 Enter 로 선택 → 포커스가 패널 제목(h2), Esc → 원래 타일로 복귀 + 화면 안으로 팬', async ({ page }) => {
    const t = withEq.find((x) => x.eq.coverage === 'owned');
    test.skip(!t, '보유 기기 없음');
    await gotoHome(page);
    await tile(page, t!.node.id).focus();
    await page.keyboard.press('Enter');
    await expect(tid(page, 'detail-title')).toBeFocused();
    // 계통도를 멀리 옮긴 뒤 닫기
    await page.evaluate(() => {
      document.getElementById('diagram-viewport')!.scrollTop += 2000;
    });
    await page.keyboard.press('Escape');
    await expect(tile(page, t!.node.id)).toBeFocused();
    await expect.poll(() => tileUnobscured(page, t!.node.id)).toBe(true);
  });

  test('B4 Home/End → 첫/마지막 타일로 포커스, 포커스 타일이 화면 안', async ({ page }) => {
    const t = withEq[Math.floor(withEq.length / 2)];
    await gotoHome(page);
    await tile(page, t.node.id).focus();
    for (const key of ['End', 'Home'] as const) {
      await page.keyboard.press(key);
      const id = await page.evaluate(() => (document.activeElement as HTMLElement).dataset.nodeId!);
      expect(id).toBeTruthy();
      expect(id).not.toBe(t.node.id);
      await expect.poll(() => tileUnobscured(page, id)).toBe(true);
    }
  });

  test('B5 연결 기기를 따라간 뒤 뒤로가기 → 이전 기기, 앞으로가기 → 다시 연결 기기', async ({ page }) => {
    const t = withEq.find((x) => x.eq.coverage === 'owned');
    test.skip(!t, '보유 기기 없음');
    await gotoHome(page, `?node=${t!.node.id}`);
    const chip = page.locator('[data-testid^="neighbor-chip-"]').first();
    const nextId = (await chip.getAttribute('data-testid'))!.replace('neighbor-chip-', '');
    await chip.click();
    await expect(page).toHaveURL(new RegExp(`node=${nextId}`));
    await expect(tid(page, 'detail-title')).toBeFocused();
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`node=${t!.node.id}(&|$)`));
    await expect(tid(page, 'detail-title')).toContainText(t!.eq.name);
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`node=${nextId}`));
  });

  test('B9 Gap 모드 흐린 타일 글자 대비 4.5:1 이상 (타일 전체 opacity 없음)', async ({ page }) => {
    await gotoHome(page, '?mode=gap');
    const result = await page.evaluate(() => {
      const cvs = document.createElement('canvas');
      cvs.width = cvs.height = 1;
      const ctx = cvs.getContext('2d', { willReadFrequently: true })!;
      const rgba = (c: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = '#000';
        ctx.fillStyle = c;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2], d[3] / 255];
      };
      const over = (t: number[], b: number[]) => [0, 1, 2].map((i) => t[i] * t[3] + b[i] * (1 - t[3]));
      const lum = (c: number[]) => {
        const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
      };
      const ratio = (a: number[], b: number[]) => {
        const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
        return (l1 + 0.05) / (l2 + 0.05);
      };
      const bands = [...document.querySelectorAll<HTMLElement>('.dband')];
      let min = Infinity;
      let opacityMin = 1;
      for (const n of document.querySelectorAll<HTMLElement>('.dnode[data-dimmed="true"]')) {
        opacityMin = Math.min(opacityMin, parseFloat(getComputedStyle(n).opacity));
        const r = n.getBoundingClientRect();
        const band = bands.find((d) => {
          const b = d.getBoundingClientRect();
          return r.left + 5 >= b.left && r.right - 5 <= b.right && r.top + 5 >= b.top && r.bottom - 5 <= b.bottom;
        });
        if (!band) continue;
        const bandBg = rgba(getComputedStyle(band).backgroundColor);
        const bg = over(rgba(getComputedStyle(n).backgroundColor), bandBg);
        for (const t of n.querySelectorAll<HTMLElement>('.dnode__title, .dnode__caption')) {
          min = Math.min(min, ratio(over(rgba(getComputedStyle(t).color), bg), bg));
        }
      }
      return { min, opacityMin };
    });
    expect(result.opacityMin).toBe(1);
    expect(result.min).toBeGreaterThanOrEqual(4.5);
  });
});

test.describe('UX-U 계통도 모바일 (T1-A)', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('B5 시트 펼침 → 연결 기기 → 뒤로가기: 이전 기기 + 시트 펼침 복원, B3 선택 타일은 시트 위에 보임', async ({ page }) => {
    const t = withEq.find((x) => x.eq.coverage === 'owned');
    test.skip(!t, '보유 기기 없음');
    await gotoHome(page);
    await tile(page, t!.node.id).tap();
    await expect(tid(page, 'detail-panel')).toBeVisible();
    await expect.poll(() => tileUnobscured(page, t!.node.id)).toBe(true);
    await page.locator('.dp-expand').tap();
    await expect(tid(page, 'detail-panel')).toHaveClass(/is-expanded/);
    const chip = page.locator('[data-testid^="neighbor-chip-"]').first();
    const nextId = (await chip.getAttribute('data-testid'))!.replace('neighbor-chip-', '');
    await chip.tap();
    await expect(page).toHaveURL(new RegExp(`node=${nextId}`));
    await expect(tid(page, 'detail-panel')).not.toHaveClass(/is-expanded/);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`node=${t!.node.id}(&|$)`));
    await expect(tid(page, 'detail-panel')).toHaveClass(/is-expanded/);
  });
});

test.describe('UX-U 계통도 모바일 가로 = 사이드 패널 (T1-A, 교차 요청)', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  test('압축 화면 사이드 패널: 펼친 상태 기본, 시트 핸들·펼치기 버튼 없음, 선택 타일은 패널 밖에 보임', async ({ page }) => {
    const t = withEq.find((x) => x.eq.coverage === 'owned' && x.node.x > 1200);
    test.skip(!t, '오른쪽 보유 기기 없음');
    await gotoHome(page, `?node=${t!.node.id}`);
    const p = tid(page, 'detail-panel');
    await expect(p).toHaveAttribute('data-sheet', 'side');
    await expect(p).toHaveClass(/is-expanded/);
    await expect(p.locator('.dp-expand')).toHaveCount(0);
    await expect(p.locator('.dp-handle')).toHaveCount(0);
    await expect.poll(() => tileUnobscured(page, t!.node.id)).toBe(true);
  });
});
