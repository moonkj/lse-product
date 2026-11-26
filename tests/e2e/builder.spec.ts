/**
 * 계통 구성 시뮬레이션 (/builder) — 2026-11-26 1단계.
 * 템플릿 선택 · 칸 채우기(끌어 놓기·눌러 고르기·키보드) · 잘못 넣으면 이유 + 제안대로 고치기 · 제품 목록·CSV · 새로고침 복원 · 접근성
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const tid = (page: Page, id: string) => page.getByTestId(id);

test.describe('계통 구성 시뮬레이션', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('헤더 메뉴로 열기 → 빈 템플릿은 필수 칸마다 확인할 점 → 기본 구성 채우기 → 확인할 점 0', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('./#/');
    await tid(page, 'builder-link').click();
    await expect(tid(page, 'builder-page')).toBeVisible();
    await expect(page.getByRole('note')).toContainText('설계 검토나 적합성 판정이 아닙니다');
    await expect(tid(page, 'builder-tpl-substation')).toHaveAttribute('aria-pressed', 'true');
    await expect(tid(page, 'builder-summary')).toContainText('채운 칸 0/9');
    await expect(tid(page, 'builder-panel')).toContainText('비어 있습니다');
    await tid(page, 'builder-fill').click();
    await expect(tid(page, 'builder-summary')).toContainText('채운 칸 9/9');
    await expect(tid(page, 'builder-summary')).toContainText('확인할 점 0');
    const axe = await new AxeBuilder({ page }).include('[data-testid="builder-page"]').analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    await page.screenshot({ path: 'C:/Users/kjmoon/AppData/Local/Temp/claude/692784dc4ab60723/d18e3653-3fd9-4f20-94d1-21c5c8f01a5e/scratchpad/ux/bld-filled.png' });
  });

  test('22.9kV 주차단기 칸에 ACB 를 끌어 놓으면 오류 + 이유, "VCB로 바꾸기"로 고치면 사라지고 되돌리기로 다시', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('./#/builder');
    await tid(page, 'builder-fill').click();
    await tid(page, 'builder-pal-acb').dragTo(tid(page, 'builder-slot-vcb'));
    await expect(tid(page, 'builder-slot-vcb')).toHaveAttribute('data-state', 'error');
    const panel = tid(page, 'builder-panel');
    await expect(panel).toContainText('22.9kV');
    await expect(panel).toContainText('맞지 않습니다');
    await panel.getByTestId('builder-fix').first().click();
    await expect(tid(page, 'builder-slot-vcb')).not.toHaveAttribute('data-state', 'error');
    await expect(tid(page, 'builder-slot-vcb')).toContainText('VCB');
    await tid(page, 'builder-undo').click();
    await expect(tid(page, 'builder-slot-vcb')).toHaveAttribute('data-state', 'error');
  });

  test('칸을 눌러 기기·제품 고르기(마우스 없이도), Delete 로 비우면 "변압기 없이" 경고 → 넣기 제안', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('./#/builder');
    await tid(page, 'builder-fill').click();
    const tr = tid(page, 'builder-slot-tr');
    await tr.focus();
    await page.keyboard.press('Delete');
    await expect(tr).toHaveAttribute('data-state', 'warn');
    await page.keyboard.press('Enter');
    const panel = tid(page, 'builder-panel');
    await expect(panel).toContainText('변압기');
    await panel.getByTestId('builder-eq-oil-tr').click();
    await expect(tr).toContainText('Oil-immersed'); // 유입변압기 + 추천 제품
    await expect(tid(page, 'builder-summary')).toContainText('확인할 점 0');
  });

  test('변압기 용량을 키우면 저압 주차단기 정격 안내가 바뀌고, 제품 목록·CSV 내보내기, 새로고침해도 구성 유지', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('./#/builder');
    await tid(page, 'builder-fill').click();
    await tid(page, 'builder-slot-tr').click();
    await tid(page, 'builder-kva').fill('2000');
    await tid(page, 'builder-slot-lv-main').click();
    await expect(tid(page, 'builder-panel')).toContainText('3,039A');
    await tid(page, 'builder-bom-toggle').click();
    await expect(tid(page, 'builder-bom').locator('tbody tr')).toHaveCount(9);
    const dl = page.waitForEvent('download');
    await tid(page, 'builder-csv').click();
    expect((await dl).suggestedFilename()).toMatch(/^계통구성_수전설비_.*\.csv$/);
    await page.waitForTimeout(500); // 자동 저장(300ms)
    await page.reload();
    await expect(tid(page, 'builder-summary')).toContainText('채운 칸 9/9');
  });

  test('데이터센터: 예비 SST 를 비우면 N+1 경고, UPS 는 미보유 안내', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('./#/builder');
    await tid(page, 'builder-tpl-datacenter').click();
    await tid(page, 'builder-fill').click();
    await tid(page, 'builder-slot-ups').click();
    await expect(tid(page, 'builder-panel')).toContainText('미보유');
    await tid(page, 'builder-slot-sst-spare').click();
    await tid(page, 'builder-clear').click();
    await expect(tid(page, 'builder-summary')).toContainText('확인할 점 1');
    await page.keyboard.press('Escape');
  });

  test('휴대폰: 기기 목록 없이 칸 → 아래 패널에서 고르기, 가로 넘침 없음', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./#/builder');
    await expect(tid(page, 'builder-page')).toBeVisible();
    await tid(page, 'builder-slot-vcb').click();
    await tid(page, 'builder-panel').getByTestId('builder-eq-vcb').click();
    await expect(tid(page, 'builder-slot-vcb')).toContainText('VCB');
    const sw = await page.evaluate(() => document.querySelector('.app-main')!.scrollWidth - document.querySelector('.app-main')!.clientWidth);
    expect(sw).toBeLessThanOrEqual(1);
  });
  test('2단계: 전체 계통(L1~L7) 템플릿 — 8줄(L1 발전·송전 ~ L7 말단), 기본 구성 채우면 확인할 점 0', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('./#/builder');
    await tid(page, 'builder-tpl-grid').click();
    await expect(page.locator('.bld-row')).toHaveCount(8);
    await expect(tid(page, 'builder-row-l1')).toContainText('345kV');
    await expect(tid(page, 'builder-row-l7')).toContainText('380/220V');
    await tid(page, 'builder-fill').click();
    await expect(tid(page, 'builder-summary')).toContainText('확인할 점 0');
    // 제품맵에 개별 제품이 없는 자사 기기(주변압기)는 그렇게 안내
    await tid(page, 'builder-slot-main-tr').click();
    await expect(tid(page, 'builder-panel')).toContainText('개별 제품으로 올라 있지 않습니다');
    const axe = await new AxeBuilder({ page }).include('[data-testid="builder-page"]').analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    await page.screenshot({ path: 'C:/Users/kjmoon/AppData/Local/Temp/claude/692784dc4ab60723/d18e3653-3fd9-4f20-94d1-21c5c8f01a5e/scratchpad/ux/bld-grid.png', fullPage: true });
  });

  test('2단계: 공유 링크 — 복사한 링크를 새 브라우저에서 열면 같은 구성, 되돌리기로 원래 구성', async ({ page, browser, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('./#/builder');
    await tid(page, 'builder-tpl-datacenter').click();
    await tid(page, 'builder-fill').click();
    await tid(page, 'builder-slot-sst-spare').click();
    await page.keyboard.press('Delete');
    await expect(tid(page, 'builder-summary')).toContainText('확인할 점 1');
    await tid(page, 'builder-share').click();
    await expect(tid(page, 'builder-share-note')).toContainText('복사했습니다');
    const url = await page.evaluate(() => navigator.clipboard.readText());
    expect(url).toContain('#/builder?b=');

    const other = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const p2 = await other.newPage();
    await p2.setViewportSize({ width: 1600, height: 1000 });
    await p2.goto(url);
    await expect(p2.getByTestId('builder-share-note')).toContainText('공유받은 구성을 불러왔습니다');
    await expect(p2.getByTestId('builder-tpl-datacenter')).toHaveAttribute('aria-pressed', 'true');
    await expect(p2.getByTestId('builder-summary')).toContainText('확인할 점 1');
    await expect(p2.getByTestId('builder-slot-sst-spare')).toHaveAttribute('data-state', 'warn'); // 비어 있고 N+1 경고
    expect(p2.url()).not.toContain('b=');
    await p2.getByTestId('builder-undo').click();
    await expect(p2.getByTestId('builder-summary')).toContainText('채운 칸 0/');
    // 잘린 링크
    await p2.goto(url.slice(0, url.indexOf('b=') + 6));
    await expect(p2.getByTestId('builder-share-note')).toContainText('읽을 수 없습니다');
    await other.close();
  });
});
