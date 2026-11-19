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
  // 빈 패널은 레일로 접혀 있으므로(P0-8) 기기를 골라 패널을 연다
  await page.goto('./#/?node=n-vcb');
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

test('계통도 안 영역을 누르거나 기기를 고르면 그 계층이 선택 영역(상자)으로 표시', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./#/?node=n-vcb');
  await expect(page.getByTestId('layer-focus')).toHaveAttribute('data-layer', 'L4');
  await expect(page.getByTestId('layer-band-L4')).toHaveAttribute('data-active', 'true');
  // 이름표 근처 빈 곳을 누름(끌기 아님)
  await page.getByTestId('layer-nav-L5').click();
  await page.getByTestId('zoom-reset').click();
  await expect(page.getByTestId('layer-focus')).toHaveCount(0);
  const band = page.getByTestId('layer-band-L5');
  const bb = (await band.boundingBox())!;
  await page.mouse.click(bb.x + 8, bb.y + bb.height - 6);
  await expect(page.getByTestId('layer-focus')).toHaveAttribute('data-layer', 'L5');
});

test('전기 흐름: 처음 화면부터 켜짐(전체 전력선, 빛 번짐 끔), 기기를 고르면 그 경로만 흐르고(대시 이동), 끄면 ?flow=0', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // 기기를 고르지 않은 처음 화면: 토글 켜짐 + 전체 전력선 흐름
  await page.goto('./#/');
  await expect(page.getByTestId('flow-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('flow-layer')).toHaveAttribute('data-scope', 'all');
  const allCount = await page.locator('.dflow__path').count();
  expect(allCount).toBeGreaterThan(0);
  expect(await page.locator('.dflow__glow').evaluate((el) => getComputedStyle(el).filter)).toBe('none');

  await page.goto('./#/?node=n-vcb');
  await expect(page.getByTestId('flow-layer')).toHaveAttribute('data-scope', 'node');
  expect(await page.locator('.dflow__path').count()).toBeLessThan(allCount);
  const path = page.locator('.dflow__path').first();
  await expect(path).toBeAttached();
  const moved = await path.evaluate(async (el) => {
    const a = getComputedStyle(el).strokeDashoffset;
    await new Promise((r) => setTimeout(r, 250));
    return a !== getComputedStyle(el).strokeDashoffset;
  });
  expect(moved).toBe(true);
  await expect(page.getByTestId('flow-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('flow-toggle').click();
  await expect(page.locator('.dflow__path')).toHaveCount(0);
  await expect(page).toHaveURL(/flow=0/);
});

test('선택 해제: 도구줄 해제 버튼 · 같은 영역 다시 누르기 · Esc — 기기 선택과 영역 표시가 함께 풀림', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./#/?node=n-vcb');
  const focus = page.getByTestId('layer-focus');
  await expect(focus).toHaveAttribute('data-layer', 'L4');
  await page.getByTestId('selection-clear').click();
  await expect(focus).toHaveCount(0);
  await expect(page).not.toHaveURL(/node=/);
  // 칩으로 고른 뒤 같은 영역 다시 누르기
  await page.getByTestId('layer-nav-L5').click();
  await expect(focus).toHaveAttribute('data-layer', 'L5');
  const bb = (await page.getByTestId('layer-band-L5').boundingBox())!;
  await page.mouse.click(bb.x + 8, bb.y + bb.height - 6);
  await expect(focus).toHaveCount(0);
  // Esc
  await page.getByTestId('layer-nav-L6').click();
  await expect(focus).toHaveAttribute('data-layer', 'L6');
  await page.keyboard.press('Escape');
  await expect(focus).toHaveCount(0);
});

test('영역 선택은 화면을 끌어 옮겨도 유지 — 같은 영역을 다시 눌러야 해제 (2026-11-19 사용자)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./#/');
  await page.getByTestId('layer-nav-L4').click();
  const focus = page.getByTestId('layer-focus');
  await expect(focus).toHaveAttribute('data-layer', 'L4');
  const vp = (await page.locator('#diagram-viewport').boundingBox())!;
  await page.mouse.move(vp.x + vp.width / 2, vp.y + vp.height - 80);
  await page.mouse.down();
  await page.mouse.move(vp.x + vp.width / 2, vp.y + 80, { steps: 12 });
  await page.mouse.up();
  await expect(focus).toHaveAttribute('data-layer', 'L4');
  await page.mouse.wheel(0, 300);
  await expect(focus).toHaveAttribute('data-layer', 'L4');
});
