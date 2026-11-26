/**
 * 경쟁 대응 (/counter) — 2026-11-26
 * 주소로 기사 제목 받기 · 경쟁사·제품군·자사 제품 · 프로젝트 묶음 → 단선도 예시 · 헤더 메뉴 5개 넘침 없음 · 접근성
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const tid = (page: Page, id: string) => page.getByTestId(id);
const SHOT = 'C:/Users/kjmoon/AppData/Local/Temp/claude/692784dc4ab60723/d18e3653-3fd9-4f20-94d1-21c5c8f01a5e/scratchpad/ux/';

test.describe('경쟁 대응', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('헤더 메뉴로 열기 → 예시 기사 → 경쟁사·대응 기기·자사 제품, 주소에 담김', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('./#/');
    await tid(page, 'counter-link').click();
    await expect(tid(page, 'counter-page')).toBeVisible();
    await tid(page, 'counter-input').fill('Schneider Electric launches Masterpact MTZ air circuit breaker');
    await expect(tid(page, 'counter-competitor')).toHaveText('Schneider Electric');
    const acb = tid(page, 'counter-hit-acb');
    await expect(acb).toContainText('자사 제품으로 대응');
    await expect(acb.getByTestId('counter-product').first()).toBeVisible();
    await expect.poll(() => page.url()).toContain('q=');
    const axe = await new AxeBuilder({ page }).include('[data-testid="counter-page"]').analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    await page.screenshot({ path: SHOT + 'counter.png', fullPage: true });
  });

  test('뉴스 사이트 링크처럼 주소로 열기: 전동기 기사 → 연관 대응, 데이터센터 기사 → 단선도 예시 열기', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('./#/counter?q=' + encodeURIComponent('ABB Unveils Intelligent Motor to Accelerate Industrial AI Adoption'));
    await expect(tid(page, 'counter-input')).toHaveValue(/Intelligent Motor/);
    await expect(tid(page, 'counter-hit-lv-drive')).toContainText('자사 사업 범위 밖이라');
    await page.goto('./#/counter?q=' + encodeURIComponent('Eaton wins hyperscale data center UPS and switchgear order'));
    await expect(tid(page, 'counter-project-datacenter')).toBeVisible();
    await expect(tid(page, 'counter-hit-ups')).toContainText('자사 미보유');
    await tid(page, 'counter-open-preset').click();
    await expect(tid(page, 'draw-editor')).toBeVisible();
    await expect(page.locator('[data-eq="sst"]')).toBeVisible();
    await expect(tid(page, 'draw-pick').locator('option:checked')).toHaveText('데이터센터 단선도');
  });

  test('헤더 메뉴 5개: 901~1440px 한 줄, 태블릿·휴대폰은 ☰ 메뉴, 넘침 없음', async ({ page }) => {
    // 600~900px(태블릿)은 ☰ 메뉴 — 헤더가 넘치지 않는지만
    for (const w of [640, 768, 860]) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto('./#/counter');
      await expect(tid(page, 'mobile-menu-toggle')).toBeVisible();
      const over = await page.evaluate(() => document.querySelector('header')!.scrollWidth - document.querySelector('header')!.clientWidth);
      expect(over, `w=${w}`).toBeLessThanOrEqual(0);
    }
    for (const w of [901, 1024, 1180, 1280, 1440]) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto('./#/counter');
      await expect(tid(page, 'counter-link')).toBeVisible();
      const r = await page.evaluate(() => {
        const h = document.querySelector('header')!;
        const l = document.querySelector('[data-testid="counter-link"]')!.getBoundingClientRect();
        return { over: h.scrollWidth - h.clientWidth, doc: document.documentElement.scrollWidth - window.innerWidth, right: l.right <= window.innerWidth, h: l.height };
      });
      expect(r.over, `w=${w}`).toBeLessThanOrEqual(0);
      expect(r.doc, `w=${w}`).toBeLessThanOrEqual(0);
      expect(r.right, `w=${w}`).toBe(true);
      expect(r.h, `w=${w} 한 줄`).toBeLessThan(48);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./#/');
    await tid(page, 'mobile-menu-toggle').click();
    await expect(tid(page, 'mmenu-counter')).toBeVisible();
  });

  test('기사 주소 → 본문까지 읽어 판단 (본문 근거 표시), 못 읽으면 주소 단어로 + 안내', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.route('**/api/article?**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'https://news.example.com/abb-motor',
          title: 'ABB launches intelligent low voltage motor',
          description: 'Built-in sensors',
          body: 'The motor pairs with ABB variable speed drives. A variable speed drive cuts energy use in pumps. Combined with the drive, users save energy.',
        }),
      }),
    );
    await page.goto('./#/counter');
    await tid(page, 'counter-input').fill('https://news.example.com/abb-motor');
    await expect(tid(page, 'counter-article-title')).toHaveText('ABB launches intelligent low voltage motor');
    await expect(tid(page, 'counter-hit-lv-drive')).toContainText("본문에서 찾은 말");
    const axe = await new AxeBuilder({ page }).include('[data-testid="counter-page"]').analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    await page.screenshot({ path: SHOT + 'counter-article.png', fullPage: true });

    await page.unroute('**/api/article?**');
    await page.route('**/api/article?**', (route) => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: '기사 사이트가 403 로 응답했습니다.' }) }));
    await tid(page, 'counter-input').fill('https://news.example.com/siemens-sinamics-drive-launch');
    await expect(tid(page, 'counter-article-error')).toContainText('주소의 단어로만');
    await expect(tid(page, 'counter-hit-lv-drive')).toBeVisible();
  });

  test('붙여 넣은 제목+본문: 첫 줄 제목, 나머지 본문으로 판단', async ({ page }) => {
    await page.goto('./#/counter');
    await tid(page, 'counter-input').fill('New order announced\nSchneider Electric will supply switchgear for a data center campus. The data center opens in 2027.');
    await expect(tid(page, 'counter-source')).toContainText('첫 줄을 제목');
    await expect(tid(page, 'counter-competitor')).toHaveText('Schneider Electric');
    await expect(tid(page, 'counter-project-datacenter')).toBeVisible();
  });
});
