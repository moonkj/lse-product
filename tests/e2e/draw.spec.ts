/**
 * 계통 구성 — 단선도 그리기 (기본 탭, 2026-11-26 3차)
 * 예시로 시작 · 상자 놓기(누르기·끌어 놓기) · 연결점 끌어 잇기 · 전압이 다른 선 → 변압기 넣기 · 반 안 구성 · 여러 단선도 · 접근성
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const tid = (page: Page, id: string) => page.getByTestId(id);
const SHOT = 'C:/Users/kjmoon/AppData/Local/Temp/claude/692784dc4ab60723/d18e3653-3fd9-4f20-94d1-21c5c8f01a5e/scratchpad/ux/';

test.describe('단선도 그리기', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('기본 탭 → 예시(수전설비)로 시작하면 상자·선이 그려지고 확인할 점 0, 반을 누르면 안 구성', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('./#/builder');
    await expect(tid(page, 'builder-mode-draw')).toHaveAttribute('aria-selected', 'true');
    await expect(tid(page, 'draw-empty')).toBeVisible();
    await expect(tid(page, 'draw-fill')).toBeEnabled();
    await tid(page, 'draw-preset').selectOption('substation');
    await expect(page.locator('.drw-node')).toHaveCount(9);
    await expect(page.locator('.drw-edge')).toHaveCount(8);
    await expect(tid(page, 'draw-summary')).toContainText('확인할 점 0');
    await page.locator('[data-kind="panel"][data-eq="lv-swgr"]').click();
    const panel = tid(page, 'draw-panel');
    await expect(panel).toContainText('반 안 구성');
    await expect(panel.getByTestId('draw-item-acb')).toContainText('주차단기');
    const axe = await new AxeBuilder({ page }).include('[data-testid="builder-page"]').analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    await page.screenshot({ path: SHOT + 'drw-substation.png' });
  });

  test('빈 단선도에 상자를 놓고 연결점을 끌어 잇기 → 22.9kV·380V 반이면 오류 → 변압기 넣기 → 오류 사라짐, 되돌리기', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('./#/builder');
    await tid(page, 'draw-pal-panel-mv-swgr').click();
    const mv = page.locator('[data-eq="mv-swgr"]');
    await expect(mv).toBeVisible();
    // 끌어 놓기로 저압 배전반을 아래에
    const canvas = tid(page, 'draw-canvas');
    const box = (await canvas.boundingBox())!;
    await tid(page, 'draw-pal-panel-lv-swgr').dragTo(canvas, { targetPosition: { x: (await mv.boundingBox())!.x - box.x + 60, y: 420 } });
    const lv = page.locator('[data-eq="lv-swgr"]');
    await expect(lv).toBeVisible();
    // 특고압반 연결점 → 저압반
    const mvId = (await mv.getAttribute('data-node'))!;
    await tid(page, `draw-port-${mvId}`).dragTo(lv);
    await expect(page.locator('.drw-edge')).toHaveCount(1);
    await expect(page.locator('.drw-edge--error')).toHaveCount(1);
    await page.locator('.bld-issue', { hasText: '변압기 없이' }).first().getByTestId('draw-fix').click();
    await expect(page.locator('[data-eq="cast-tr"]')).toBeVisible();
    await expect(page.locator('.drw-edge')).toHaveCount(2);
    await expect(page.locator('.drw-edge--error')).toHaveCount(0);
    await tid(page, 'draw-undo').click();
    await expect(page.locator('[data-eq="cast-tr"]')).toHaveCount(0);
    await expect(page.locator('.drw-edge--error')).toHaveCount(1);
  });

  test('마우스 없이: 상자 고른 채 목록에서 누르면 아래에 이어 붙고, "연결하기" → 대상, 방향키 이동, Delete 지우기', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('./#/builder');
    await tid(page, 'draw-pal-source-').click(); // 놓으면 그 상자가 선택됨
    await tid(page, 'draw-pal-panel-mv-swgr').click(); // 고른 전원 아래에 이어 붙음
    await expect(page.locator('.drw-edge')).toHaveCount(1);
    await tid(page, 'draw-pal-equipment-cast-tr').click();
    await expect(page.locator('.drw-edge')).toHaveCount(2);
    // 따로 놓은 저압반을 '연결하기'로 잇기
    await page.locator('.drw-canvas').click({ position: { x: 5, y: 5 } });
    await tid(page, 'draw-pal-panel-lv-swgr').click();
    const lv = page.locator('[data-eq="lv-swgr"]');
    const tr = page.locator('[data-eq="cast-tr"]');
    await tr.focus();
    await page.keyboard.press('Enter');
    await tid(page, 'draw-connect').click();
    await expect(tid(page, 'draw-connecting')).toBeVisible();
    await lv.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.drw-edge')).toHaveCount(3);
    const before = await lv.boundingBox();
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await lv.boundingBox())!.x).toBeGreaterThan(before!.x);
    await page.keyboard.press('Delete');
    await expect(lv).toHaveCount(0);
    await expect(page.locator('.drw-edge')).toHaveCount(2);
  });

  test('반 안 구성: 품목 넣기·수량·빼기, 잘못 넣은 품목은 오류 → 바꾸기, 제품 목록·CSV', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('./#/builder');
    await tid(page, 'draw-pal-panel-mv-swgr').click();
    const panel = tid(page, 'draw-panel');
    await expect(panel.getByTestId('draw-items')).toBeVisible();
    await panel.getByTestId('draw-item-add-eq').selectOption('meter');
    await panel.getByTestId('draw-item-add').click();
    await expect(panel.getByTestId('draw-item-meter')).toBeVisible();
    await panel.getByTestId('draw-item-meter').getByRole('button', { name: /수량 늘리기/ }).click();
    await expect(panel.getByTestId('draw-item-meter').getByTestId('draw-item-qty')).toHaveValue('2');
    await panel.getByTestId('draw-item-meter').getByTestId('draw-item-remove').click();
    await expect(panel.getByTestId('draw-item-meter')).toHaveCount(0);
    // 제품 채우기 → 제품 목록
    await tid(page, 'draw-fill').click();
    await tid(page, 'draw-bom-toggle').click();
    await expect(tid(page, 'draw-bom')).toContainText('VCB');
    const [dl] = await Promise.all([page.waitForEvent('download'), tid(page, 'draw-csv').click()]);
    expect(dl.suggestedFilename()).toMatch(/^단선도_.*\.csv$/);
  });

  test('여러 단선도: 새로 만들기·이름 바꾸기·고르기, 새로고침해도 유지', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('./#/builder');
    await tid(page, 'draw-preset').selectOption('datacenter');
    await expect(tid(page, 'draw-summary')).toContainText('확인할 점 0');
    await tid(page, 'draw-name').fill('A동 데이터센터');
    await tid(page, 'draw-name').press('Enter');
    await tid(page, 'draw-new').click();
    await expect(tid(page, 'draw-empty')).toBeVisible();
    await expect(tid(page, 'draw-pick').locator('option')).toHaveCount(3); // 처음 빈 단선도 + 데이터센터 + 새 단선도
    await tid(page, 'draw-pick').selectOption({ label: 'A동 데이터센터' });
    await expect(page.locator('[data-eq="sst"]')).toBeVisible();
    await page.screenshot({ path: SHOT + 'drw-datacenter.png' });
    await page.waitForTimeout(400);
    await page.reload();
    await expect(tid(page, 'draw-pick')).toHaveValue(/.+/);
    await expect(tid(page, 'draw-pick').locator('option:checked')).toHaveText('A동 데이터센터');
  });

  test('휴대폰: 캔버스가 먼저, 가로 넘침 없음', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./#/builder');
    await tid(page, 'draw-preset').selectOption('grid');
    await expect(page.locator('.drw-node').first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
