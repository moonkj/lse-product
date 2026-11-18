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

/**
 * 접힌 하단 시트 = 요약만 (axe target-size 후속, 사용자 승인). 반쯤 잘리거나 가려진 채 누를 수 있는 요소가 없어야 하고,
 * 높이는 내용에 맞추되 40dvh 를 넘지 않으며, 비교 바는 시트 실측 높이를 따라 바로 위에 붙는다. 펼치면 제품 목록이 보인다.
 */
type EqFull = Eq & { description: string; productIds?: string[]; lseCategoryCodes: string[] };
const eqFull = new Map(load<EqFull[]>('equipment-types.json').map((e) => [e.id, e]));
const eqDesc = new Map([...eqFull].map(([id, e]) => [id, e.description]));
const productCodes = load<{ categoryCode: string }[]>('products.json').map((p) => p.categoryCode);
/** 제품이 있는 기기 (load.ts resolveProducts 의 직접 지정·카테고리 접두사 규칙) */
const hasProducts = (id: string) => {
  const e = eqFull.get(id)!;
  return (e.productIds?.length ?? 0) > 0 || e.lseCategoryCodes.some((c) => productCodes.some((pc) => pc.startsWith(c)));
};
const sheetCases = [
  withEq.find((x) => x.eq.coverage === 'owned' && hasProducts(x.eq.id)),
  withEq.find((x) => x.eq.coverage === 'missing'),
  [...withEq].sort((a, b) => (eqDesc.get(b.eq.id) ?? '').length - (eqDesc.get(a.eq.id) ?? '').length)[0],
].filter((x): x is (typeof withEq)[number] => !!x);

for (const [w, h] of [
  [390, 844],
  [360, 740],
] as const) {
  test.describe(`접힌 시트 요약 ${w}×${h}`, () => {
    test.use({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });

    test('보이는 버튼은 모두 화면·시트 안에 온전히, 높이 ≥44px · 상한 40dvh · 비교 바는 시트 위 · 펼치면 제품 목록', async ({ page }) => {
      test.skip(sheetCases.length === 0, '기기 없음');
      await page.addInitScript((id) => localStorage.setItem('lse-compare-v1', JSON.stringify({ equipment: [id], product: [], active: 'equipment' })), sheetCases[0].eq.id);
      for (const c of sheetCases) {
        await gotoHome(page, `?node=${c.node.id}`);
        const p = tid(page, 'detail-panel');
        await expect(p).toHaveAttribute('data-sheet', 'bottom');
        await expect(p).not.toHaveClass(/is-expanded/);
        await expect(tid(page, 'detail-title')).toBeVisible();
        // 요약 밖 섹션은 접힌 상태에서 렌더하지 않음
        await expect(p.locator('#dp-products-title')).toHaveCount(0);
        await expect(tid(page, 'detail-product-list')).toHaveCount(0);
        await expect(tid(page, 'compare-go')).toBeVisible();
        const m = await page.evaluate(() => {
          const panel = document.querySelector('[data-testid="detail-panel"]')!;
          const pr = panel.getBoundingClientRect();
          const bad: string[] = [];
          for (const el of panel.querySelectorAll<HTMLElement>('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])')) {
            if (!el.getClientRects().length) continue;
            const r = el.getBoundingClientRect();
            const inside = r.top >= pr.top - 0.5 && r.bottom <= pr.bottom + 0.5 && r.top >= 0 && r.bottom <= innerHeight + 0.5 && r.left >= 0 && r.right <= innerWidth + 0.5;
            if (!inside || r.height < 44) bad.push(`${(el.textContent || el.getAttribute('aria-label') || el.tagName).trim()} ${Math.round(r.top)}-${Math.round(r.bottom)} h${Math.round(r.height)}`);
          }
          const tray = document.querySelector('[data-testid="compare-tray"]')!.getBoundingClientRect();
          return { bad, panelTop: pr.top, panelH: pr.height, scrollable: panel.scrollHeight > panel.clientHeight + 1, trayBottom: tray.bottom };
        });
        expect(m.bad, c.node.id).toEqual([]);
        expect(m.scrollable, `${c.node.id} 접힌 시트는 스크롤되지 않음`).toBe(false);
        expect(m.panelH).toBeLessThanOrEqual(h * 0.4 + 1);
        expect(m.trayBottom).toBeLessThanOrEqual(m.panelTop);
        expect(m.panelTop - m.trayBottom).toBeLessThan(16); // 시트 실측 높이를 따라 바로 위 (고정 40dvh 아님)
      }
      // 펼치면 전체 정보 — 제품 목록 섹션
      const owned = sheetCases.find((x) => x.eq.coverage === 'owned' && hasProducts(x.eq.id));
      test.skip(!owned, '제품 있는 보유 기기 없음');
      await gotoHome(page, `?node=${owned!.node.id}`);
      await tid(page, 'detail-sheet-toggle').tap();
      await expect(tid(page, 'detail-panel')).toHaveClass(/is-expanded/);
      await expect(tid(page, 'detail-product-list')).toBeVisible();
      await expect(tid(page, 'detail-sheet-toggle')).toHaveText('시트 줄이기');
    });
  });
}
