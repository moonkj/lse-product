/**
 * 계층 칩 강조 + 전체 계통도 한 장 인쇄
 *  - 칩(L1 등)을 누르면 그 계층에 상자(layer-focus)가 생기고, 전체 보기를 누르면 사라진다
 *  - 인쇄: 툴바 "인쇄" 버튼, beforeprint 에서 --print-scale(A4 세로 한 장 배율) 반영, PDF 1쪽
 */
import { expect, test } from '@playwright/test';

test('계층 칩을 누르면 그 계층에 상자 표시, 전체 보기면 해제', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByTestId('layer-focus')).toHaveCount(0);
  await page.getByRole('button', { name: /^L1/ }).first().click();
  const focus = page.getByTestId('layer-focus');
  await expect(focus).toHaveAttribute('data-layer', 'L1');
  await expect(page.getByTestId('layer-band-L1')).toHaveAttribute('data-active', 'true');
  await page.getByRole('button', { name: /^L4/ }).first().click();
  await expect(focus).toHaveAttribute('data-layer', 'L4');
  await page.getByTestId('zoom-reset').click();
  await expect(page.getByTestId('layer-focus')).toHaveCount(0);
});

test('인쇄: 버튼이 있고, 인쇄 배율이 계통도를 A4 한 장에 맞추며 PDF 가 1쪽', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'PDF 는 Chromium 만');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByTestId('diagram-print')).toBeVisible();
  const scale = await page.evaluate(() => {
    window.dispatchEvent(new Event('beforeprint'));
    return Number(getComputedStyle(document.documentElement).getPropertyValue('--print-scale'));
  });
  expect(scale).toBeGreaterThan(0.1);
  expect(scale).toBeLessThan(0.5);
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  expect(pages).toBe(1);
});

test('상세 정보 창 폭: 손잡이를 끌면 늘고 줄며, 새로고침해도 유지, 두 번 누르면 기본 폭', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const panel = page.locator('.detail-panel');
  const handle = page.getByTestId('panel-resizer');
  await expect(handle).toBeVisible();
  const w0 = (await panel.boundingBox())!.width;
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + 200);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 - 150, hb.y + 200, { steps: 5 });
  await page.mouse.up();
  const w1 = (await panel.boundingBox())!.width;
  expect(w1 - w0).toBeGreaterThan(130);
  await page.reload();
  await expect.poll(async () => (await panel.boundingBox())!.width).toBeGreaterThan(w0 + 130);
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => Number(await handle.getAttribute('aria-valuenow'))).toBeLessThan(w1);
  await handle.dblclick();
  await expect.poll(async () => Math.round((await panel.boundingBox())!.width)).toBe(Math.round(w0));
});
