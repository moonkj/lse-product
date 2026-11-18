/**
 * LS ELECTRIC CI 시각 언어 (2026-11-18) — 테마 토글 · 헤더 · 옵션별 사양 표 잘림 검사.
 * 셀렉터는 data-testid 우선, 레이아웃 측정은 클래스 사용.
 */
import { test, expect, type Page } from '@playwright/test';

const tid = (page: Page, id: string) => page.getByTestId(id);

test.describe('테마 (기본 라이트 고정 + 헤더 토글)', () => {
  test('시스템이 다크여도 처음엔 라이트, 토글 → data-theme=dark·저장, 새로고침 유지, 다시 누르면 라이트', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('./#/');
    const html = page.locator('html');
    const toggle = tid(page, 'theme-toggle');
    await expect(toggle).toBeVisible();
    expect(await html.getAttribute('data-theme')).toBeNull();
    const bodyBg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(await bodyBg()).toBe('rgb(244, 246, 249)'); // --color-bg 라이트
    await expect(toggle).toHaveAccessibleName('다크 모드');

    await toggle.click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(toggle).toHaveAccessibleName('라이트 모드');
    expect(await page.evaluate(() => localStorage.getItem('lse-theme'))).toBe('dark');
    expect(await bodyBg()).toBe('rgb(15, 18, 23)');

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await tid(page, 'theme-toggle').click();
    expect(await html.getAttribute('data-theme')).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('lse-theme'))).toBeNull();
  });

  test('헤더: CI 네이비 띠 + 레드 강조선, 데스크톱 총높이 ≤ 64px (계통도 영역 유지)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./#/');
    const header = page.locator('.app-header');
    const style = await header.evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, line: s.borderBottomColor, lineW: s.borderBottomWidth, h: el.getBoundingClientRect().height };
    });
    expect(style.bg).toBe('rgb(0, 51, 127)');
    expect(style.line).toBe('rgb(230, 0, 51)');
    expect(style.lineW).toBe('3px');
    expect(style.h).toBeLessThanOrEqual(64);
  });
});

/** 옵션 6개(GMP) · 쪽이 섞인 옵션 8개(Metasol MCCB) */
const SPEC_PRODUCTS = ['P01053', 'P01023'];
const VIEWS = [
  { name: '1440 라이트', w: 1440, h: 900, dark: false },
  { name: '1440 다크', w: 1440, h: 900, dark: true },
  { name: '390', w: 390, h: 844, dark: false },
];

test.describe('옵션별 사양 표 — 잘린 글자 0', () => {
  for (const pid of SPEC_PRODUCTS) {
    for (const v of VIEWS) {
      test(`${pid} ${v.name}: 칸·열 머리 글자가 잘리지 않고 "비교" 버튼 글자가 다 보임`, async ({ page }) => {
        await page.setViewportSize({ width: v.w, height: v.h });
        if (v.dark) await page.addInitScript(() => localStorage.setItem('lse-theme', 'dark'));
        await page.goto(`./#/product/${pid}`);
        await expect(tid(page, 'product-specs')).toHaveAttribute('data-state', 'ready');
        const block = tid(page, 'product-specs-variants');
        expect(await block.count(), '옵션 사양 블록').toBe(1);
        await expect(block).toBeVisible();

        const clipped = await block.locator('th, td').evaluateAll((els) =>
          els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => (el.textContent ?? '').trim().slice(0, 40)),
        );
        expect(clipped).toEqual([]);

        const toggles = block.getByTestId(new RegExp(`^compare-toggle-${pid}:`));
        expect(await toggles.count()).toBeGreaterThan(0);
        // 버튼 글자(아이콘·"비교")가 버튼 상자 안에 다 들어오는지 — 터치 화면의 ::before 히트 영역(44px)은 넘침으로 치지 않음
        const bad = await toggles.evaluateAll((els) =>
          els
            .filter((el) => {
              const b = el.getBoundingClientRect();
              const spans = [...el.querySelectorAll('span')];
              const outside = spans.some((sp) => {
                const r = sp.getBoundingClientRect();
                return r.left < b.left - 0.5 || r.right > b.right + 0.5 || r.top < b.top - 0.5 || r.bottom > b.bottom + 0.5;
              });
              return outside || !(el.textContent ?? '').includes('비교');
            })
            .map((el) => el.getAttribute('data-testid')),
        );
        expect(bad).toEqual([]);
        // 마지막 열로 밀면 그 열의 버튼이 스크롤 영역 안에 완전히 들어온다
        const last = toggles.last();
        await last.scrollIntoViewIfNeeded();
        const region = block.locator('.ps-scroll');
        const [rb, bb] = [await region.boundingBox(), await last.boundingBox()];
        expect(bb!.x + bb!.width).toBeLessThanOrEqual(rb!.x + rb!.width + 1);
        expect(bb!.x).toBeGreaterThanOrEqual(rb!.x - 1);
      });
    }
  }

  test('390: 넘치면 안내 문구 + 오른쪽 가장자리 표시, 끝까지 밀면 꺼지고 왼쪽 표시가 켜짐', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./#/product/P01053');
    const block = tid(page, 'product-specs-variants');
    await expect(block).toBeVisible();
    await expect(tid(page, 'product-specs-scroll-hint')).toBeVisible();
    const wrap = block.locator('.ps-scrollwrap');
    await expect(wrap).toHaveAttribute('data-edge-right', 'true');
    await expect(wrap).not.toHaveAttribute('data-edge-left', 'true');
    await block.locator('.ps-scroll').evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
    await expect(wrap).toHaveAttribute('data-edge-left', 'true');
    await expect(wrap).not.toHaveAttribute('data-edge-right', 'true');
  });
});
