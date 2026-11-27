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
  test('공유 링크: 복사한 링크를 새 브라우저에서 열면 사본으로 추가, 잘린 링크는 안내', async ({ page, browser, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('./#/builder');
    await tid(page, 'draw-preset').selectOption('substation');
    await tid(page, 'draw-share').click();
    await expect(tid(page, 'draw-share-note')).toContainText('복사했습니다');
    const url = await page.evaluate(() => navigator.clipboard.readText());
    expect(url).toContain('#/builder?d=');
    const other = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const p2 = await other.newPage();
    await p2.setViewportSize({ width: 1600, height: 1000 });
    await p2.goto(url);
    await expect(p2.getByTestId('draw-share-note')).toContainText('사본으로 추가');
    await expect(p2.getByTestId('builder-mode-draw')).toHaveAttribute('aria-selected', 'true');
    await expect(p2.locator('.drw-node')).toHaveCount(9);
    await expect(p2.getByTestId('draw-pick').locator('option:checked')).toHaveText('수전설비 단선도 (공유)');
    expect(p2.url()).not.toContain('d=');
    await p2.goto(url.slice(0, url.indexOf('d=') + 8));
    await expect(p2.getByTestId('draw-share-note')).toContainText('읽을 수 없습니다');
    await other.close();
  });

  test('그림 내려받기(PNG·SVG)와 단선도 인쇄', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('./#/builder');
    await expect(tid(page, 'draw-png')).toBeDisabled();
    await tid(page, 'draw-preset').selectOption('datacenter');
    const [svg] = await Promise.all([page.waitForEvent('download'), tid(page, 'draw-svg').click()]);
    expect(svg.suggestedFilename()).toMatch(/^단선도_.*\.svg$/);
    const [png] = await Promise.all([page.waitForEvent('download'), tid(page, 'draw-png').click()]);
    expect(png.suggestedFilename()).toMatch(/^단선도_.*\.png$/);
    const pngPath = SHOT + 'drw-export.png';
    await png.saveAs(pngPath);
    // 인쇄: 숨은 인쇄용 창에 단선도 그림만 넣고 그 창을 인쇄 (페이지 화면 스타일과 무관)
    await tid(page, 'draw-print').click();
    const frame = page.locator('iframe[data-print-frame]');
    await expect(frame).toHaveCount(1);
    const inner = page.frameLocator('iframe[data-print-frame]');
    await expect(inner.locator('svg')).toHaveCount(1);
    await expect(inner.locator('svg')).toContainText('데이터센터 단선도');
    await expect(inner.locator('svg rect').first()).toBeAttached();
    // 그림이 첫 쪽 맨 위에서 시작 (빈 쪽 아님)
    const top = await inner.locator('svg').evaluate((el) => el.getBoundingClientRect().top);
    expect(top).toBeLessThanOrEqual(1);
  });

  test('휴대폰: 상자를 누르면 아래 빠른 막대(연결하기·지우기·자세히), 연결하기로 잇기', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./#/builder');
    await tid(page, 'draw-pal-source-').click();
    await page.locator('.drw-canvas').click({ position: { x: 5, y: 5 } });
    await tid(page, 'draw-pal-panel-mv-swgr').click();
    const mv = page.locator('[data-eq="mv-swgr"]');
    const src = page.locator('[data-kind="source"]');
    await src.click();
    const bar = tid(page, 'draw-mobilebar');
    await expect(bar).toBeVisible();
    await bar.getByRole('button', { name: '연결하기' }).click();
    await mv.click();
    await expect(page.locator('.drw-edge')).toHaveCount(1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: SHOT + 'drw-mobile.png' });
  });

  test('분전반 안 구성: 회로표에서 회로명·제품·프레임·정격·극수, 회로 일괄 넣기, 분기>주차단기 경고 → 고치기, 결선도', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('./#/builder');
    await expect(tid(page, 'draw-fill')).toBeEnabled();
    await tid(page, 'draw-pal-panel-panelboard').click();
    await tid(page, 'draw-panel-open').click();
    const ed = tid(page, 'panel-editor');
    await expect(ed).toBeVisible();
    await expect(ed.getByTestId('panel-sld')).toBeVisible();
    await ed.getByTestId('panel-fill').click();
    // 주차단기 행: 분전반용 차단기, 정격 100A, 4P
    const main = ed.getByTestId('panel-row-0');
    await expect(main.getByTestId('panel-product')).toHaveValue(/.+/);
    await expect(main.getByTestId('panel-amps')).toHaveValue('100');
    await expect(main.getByTestId('panel-poles')).toHaveValue('4');
    // 회로 4개 넣기
    await ed.getByTestId('panel-add-eq').selectOption('mcb-rcbo');
    await ed.getByTestId('panel-add-count').fill('4');
    await ed.getByTestId('panel-add').click();
    await expect(ed.locator('tbody tr')).toHaveCount(7);
    // 회로명·정격 바꾸기
    const r1 = ed.getByTestId('panel-row-1');
    await r1.getByTestId('panel-name').fill('1층 콘센트');
    await r1.getByTestId('panel-amps').selectOption('20');
    await expect(r1.getByTestId('panel-amps')).toHaveValue('20');
    await expect(ed.getByTestId('panel-sld')).toContainText('1층 콘센트');
    // 분기를 주차단기보다 크게 → 경고 → 고치기
    await r1.getByTestId('panel-amps').selectOption('50');
    await main.getByTestId('panel-amps').selectOption('40');
    await expect(ed.getByTestId('panel-issues')).toContainText('주차단기 40A보다');
    await page.screenshot({ path: SHOT + 'drw-panel-editor.png' });
    await ed.getByTestId('panel-fix').first().click();
    await expect(ed.getByTestId('panel-issues')).toHaveCount(0);
    const axe = await new AxeBuilder({ page }).include('[data-testid="panel-editor"]').analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    await ed.getByTestId('panel-close').click();
    await expect(ed).toHaveCount(0);
    // 캔버스 반 상자에 정격이 보임
    await expect(page.locator('[data-eq="panelboard"]')).toContainText('ELCB');
    await tid(page, 'draw-bom-toggle').click();
    await expect(tid(page, 'draw-bom')).toContainText('1층 콘센트');
  });

  test('분전반 안 구성: 수량 4 차단기는 결선도에 4개, 나누기로 회로 4개, 부하·상 → 불평형 경고 → 상 자동 배분', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('./#/builder');
    await expect(tid(page, 'draw-fill')).toBeEnabled();
    await tid(page, 'draw-pal-panel-panelboard').click();
    await tid(page, 'draw-panel-open').click();
    const ed = tid(page, 'panel-editor');
    await ed.getByTestId('panel-fill').click();
    // 기본: ELCB×6, MCB×6 → 결선도 분기 12개
    await expect(ed.getByTestId('panel-sld-branch')).toHaveCount(12);
    const r1 = ed.getByTestId('panel-row-1');
    await r1.getByTestId('panel-qty').fill('4');
    await expect(ed.getByTestId('panel-sld-branch')).toHaveCount(10);
    await r1.getByTestId('panel-split').click();
    await expect(ed.locator('tbody tr')).toHaveCount(6);
    await expect(ed.getByTestId('panel-row-1').getByTestId('panel-name')).toHaveValue('회로 1-1');
    await expect(ed.getByTestId('panel-row-4').getByTestId('panel-name')).toHaveValue('회로 1-4');
    // 부하를 적으면 가장 가벼운 상에 자동으로 붙는다 → 일부러 모두 R상에 → 불평형
    for (const k of [1, 2, 3]) {
      await ed.getByTestId(`panel-row-${k}`).getByTestId('panel-kw').fill('3');
    }
    await expect(ed.getByTestId('panel-unbalance')).toHaveText('0%');
    for (const k of [1, 2, 3]) {
      await ed.getByTestId(`panel-row-${k}`).getByTestId('panel-phase-sel').selectOption('R');
    }
    await expect(ed.getByTestId('panel-issues')).toContainText('설비불평형률');
    await ed.getByTestId('panel-balance').click();
    await expect(ed.getByTestId('panel-unbalance')).toHaveText('0%');
    await expect(ed.getByTestId('panel-issues')).toHaveCount(0);
    await expect(ed.getByTestId('panel-sld')).toContainText('3kW');
    await page.screenshot({ path: SHOT + 'drw-panel-load.png' });
  });

  test('반 안 구성: 예상 단락전류·차단용량, 전선 권장 굵기, 길이 → 전압강하 경고 → 굵은 전선', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('./#/builder');
    await tid(page, 'draw-preset').selectOption('substation');
    await page.locator('[data-kind="panel"][data-eq="lv-swgr"]').dblclick();
    const ed = tid(page, 'panel-editor');
    await expect(ed.getByTestId('panel-isc')).toContainText('25.3kA');
    await ed.getByTestId('panel-close').click();
    await page.locator('[data-kind="panel"][data-eq="panelboard"]').dblclick();
    await expect(ed.getByTestId('panel-isc')).toHaveCount(0);
    const r1 = ed.getByTestId('panel-row-1');
    await expect(r1.getByTestId('panel-cable').locator('option').first()).toHaveText('권장 4SQ');
    await r1.getByTestId('panel-kw').fill('4');
    await r1.getByTestId('panel-length').fill('100');
    await expect(r1.getByTestId('panel-vdrop')).toContainText('%');
    await expect(ed.getByTestId('panel-issues')).toContainText('전압강하');
    await page.screenshot({ path: SHOT + 'drw-panel-cable.png' });
    await ed.locator('.bld-issue', { hasText: '전압강하' }).getByTestId('panel-fix').click();
    await expect(ed.locator('.bld-issue', { hasText: '전압강하' })).toHaveCount(0);
    await expect(r1.getByTestId('panel-cable')).toHaveValue('10');
  });

  test('피더: 선에 보내는 회로·전선·길이 → 아래 분전반 단락전류, 회로표 CSV·인쇄', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('./#/builder');
    await tid(page, 'draw-preset').selectOption('substation');
    const pbNode = page.locator('[data-kind="panel"][data-eq="panelboard"]');
    await pbNode.dblclick();
    const ed = tid(page, 'panel-editor');
    await expect(ed.getByTestId('panel-isc-missing')).toBeVisible();
    await ed.getByTestId('panel-close').click();
    // 모선 → 분전반 선 고르기
    await page.waitForTimeout(400);
    const edgeId = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('lse-draw:v1')!);
      const dg = s.diagrams[s.currentId];
      const pb = dg.nodes.find((n: { eq?: string }) => n.eq === 'panelboard');
      return dg.edges.find((e: { to: string }) => e.to === pb.id).id as string;
    });
    await page.locator(`[data-testid="draw-edge-${edgeId}"] .drw-edge__hit`).dispatchEvent('pointerdown');
    const feeder = tid(page, 'draw-feeder');
    await expect(feeder).toBeVisible();
    await feeder.getByTestId('draw-feeder-item').selectOption({ index: 2 });
    await feeder.getByTestId('draw-feeder-cable').selectOption('35');
    await feeder.getByTestId('draw-feeder-length').fill('50');
    await expect(feeder.getByTestId('draw-feeder-isc')).toContainText('kA (피더 전선 1구간 반영)');
    await pbNode.dblclick();
    await expect(ed.getByTestId('panel-isc')).toContainText('피더 전선 반영');
    const [csv] = await Promise.all([page.waitForEvent('download'), ed.getByTestId('panel-csv').click()]);
    expect(csv.suggestedFilename()).toMatch(/^회로표_.*\.csv$/);
    await ed.getByTestId('panel-print').click();
    const inner = page.frameLocator('iframe[data-print-frame]');
    await expect(inner.locator('table')).toHaveCount(1);
    await expect(inner.locator('svg')).toHaveCount(1);
    await expect(inner.locator('h1')).toContainText('분전반');
    await ed.getByTestId('panel-close').click();
    await tid(page, 'draw-bom-toggle').click();
    const [all] = await Promise.all([page.waitForEvent('download'), tid(page, 'draw-schedule-csv').click()]);
    expect(all.suggestedFilename()).toMatch(/^회로표_.*\.csv$/);
  });

  test('1회차: 부하 입력 → 변압기 부하율, 형식별 합계, 파일 저장·불러오기', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('./#/builder');
    await tid(page, 'draw-preset').selectOption('substation');
    await page.locator('[data-eq="motor"]').click();
    await tid(page, 'draw-load').fill('200');
    await expect(page.locator('[data-eq="cast-tr"]')).toContainText('부하율');
    await page.locator('[data-eq="cast-tr"]').click();
    await expect(tid(page, 'draw-downstream')).toContainText('변압기 부하율');
    await tid(page, 'draw-bom-toggle').click();
    await tid(page, 'draw-bom-format').click();
    await expect(tid(page, 'draw-bom-format-table')).toContainText('MCCB');
    const [file] = await Promise.all([page.waitForEvent('download'), tid(page, 'draw-save-file').click()]);
    expect(file.suggestedFilename()).toMatch(/\.json$/);
    const path = SHOT + 'drw-file.json';
    await file.saveAs(path);
    const before = await tid(page, 'draw-pick').locator('option').count();
    await tid(page, 'draw-load-file').setInputFiles(path);
    await expect(tid(page, 'draw-share-note')).toContainText('불러와');
    await expect(tid(page, 'draw-pick').locator('option')).toHaveCount(before + 1);
    await expect(page.locator('[data-eq="motor"]')).toContainText('200kW');
  });

  test('상자 크기 조정(손잡이·숫자), 넓은 화면은 전체 폭, 긴 이름은 두 줄', async ({ page }) => {
    await page.setViewportSize({ width: 2000, height: 1100 });
    await page.goto('./#/builder');
    await tid(page, 'draw-preset').selectOption('grid');
    // 넓은 화면: 캔버스 창이 1000px 넘게
    const wrapW = await tid(page, 'draw-canvas-wrap').evaluate((el) => el.getBoundingClientRect().width);
    expect(wrapW).toBeGreaterThan(1100);
    const rmu = page.locator('[data-eq="auto-switch"]');
    await rmu.click();
    const before = (await rmu.boundingBox())!;
    const id = (await rmu.getAttribute('data-node'))!;
    const handle = tid(page, `draw-resize-${id}`);
    const hb = (await handle.boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + 80, hb.y + 40, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => (await rmu.boundingBox())!.width).toBeGreaterThan(before.width + 30);
    await tid(page, 'draw-w').fill('300');
    await expect.poll(async () => Math.round((await rmu.boundingBox())!.width)).toBeGreaterThan(before.width + 60);
    await tid(page, 'draw-size-reset').click();
    await expect.poll(async () => Math.round((await rmu.boundingBox())!.width)).toBe(Math.round(before.width));
    // 긴 제품명이 상자 밖으로 넘치지 않음
    const overflow = await rmu.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return [...el.querySelectorAll('span')].some((s) => s.getBoundingClientRect().bottom > box.bottom + 1);
    });
    expect(overflow).toBe(false);
    await page.screenshot({ path: SHOT + 'drw-wide.png' });
  });


  test('예시를 두 번 열어도 손대지 않은 같은 예시는 하나만 · 그림(SVG)에 제품 사진·기호, 빈 네모 없음 (2026-11-27)', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('./#/builder');
    await tid(page, 'draw-preset').selectOption('datacenter');
    const count = async () => page.locator('[data-testid="draw-pick"] option').count();
    const n1 = await count();
    await tid(page, 'draw-preset').selectOption('datacenter');
    expect(await count()).toBe(n1);
    const [dl] = await Promise.all([page.waitForEvent('download'), tid(page, 'draw-svg').click()]);
    const svg = await (await import('node:fs/promises')).readFile((await dl.path())!, 'utf8');
    expect(svg).toContain('<image href="data:image/');
    expect(svg).not.toMatch(/width="24" height="24" rx="3" fill="none"/);
  });
});
