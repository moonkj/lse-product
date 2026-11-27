/**
 * 사고 시뮬레이션 (2026-11-27) — 도구줄 토글 → 차단기 열기·기기 사고 → 정전·비상 공급·보호 동작 표시, 주소에 남음, 접근성
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const tid = (page: Page, id: string) => page.getByTestId(id);
const SHOT = 'C:/Users/kjmoon/AppData/Local/Temp/claude/692784dc4ab60723/d18e3653-3fd9-4f20-94d1-21c5c8f01a5e/scratchpad/ux/';

test.describe('사고 시뮬레이션', () => {
  test('ACB 열기 → 380V 쪽 정전, 비상 부하는 ATS 로 비상 공급 · 조명 사고 → ELCB·MCB 트립 · 끝내기', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('./#/');
    await tid(page, 'sim-toggle').click();
    await expect(tid(page, 'sim-toggle')).toHaveAttribute('aria-pressed', 'true');
    await expect(tid(page, 'sim-panel')).toContainText('기기를 누르면 그 자리에 사고');
    await expect(page).toHaveURL(/sim=1/);

    // 차단기(ACB) 누르기 = 열기 (선택되지 않음)
    await tid(page, 'diagram-node-n-acb').click({ force: true });
    await expect(page).toHaveURL(/open=n-acb/);
    await expect(page).not.toHaveURL(/node=/);
    await expect(tid(page, 'diagram-node-n-acb')).toHaveAttribute('data-sim', 'open');
    await expect(tid(page, 'diagram-node-n-mccb')).toHaveAttribute('data-sim', 'dead');
    await expect(tid(page, 'diagram-node-n-ats')).toHaveAttribute('data-sim', 'backup');
    await expect(tid(page, 'sim-panel')).toContainText('절체');
    expect(Number(await tid(page, 'sim-dead-count').textContent())).toBeGreaterThan(3);
    const axe = await new AxeBuilder({ page }).include('[data-testid="sim-panel"]').analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    await page.screenshot({ path: SHOT + 'sim-acb.png' });

    // 처음으로 → 조명 사고
    await tid(page, 'sim-reset').click();
    await tid(page, 'diagram-node-n-light').click({ force: true });
    await expect(tid(page, 'diagram-node-n-light')).toHaveAttribute('data-sim', 'fault');
    await expect(tid(page, 'diagram-node-n-elcb')).toHaveAttribute('data-sim', 'tripped');
    await expect(tid(page, 'diagram-node-n-mcb')).toHaveAttribute('data-sim', 'tripped');
    await expect(tid(page, 'diagram-node-n-panel')).not.toHaveAttribute('data-sim', /.+/);
    await expect(tid(page, 'sim-timeline')).toContainText('보호기기 차단');

    // 끝내기 → 표시 사라지고 평소처럼 선택됨
    await tid(page, 'sim-stop').click();
    await expect(tid(page, 'sim-panel')).toHaveCount(0);
    await expect(tid(page, 'diagram-node-n-light')).not.toHaveAttribute('data-sim', /.+/);
    await tid(page, 'diagram-node-n-acb').click({ force: true });
    await expect(page).toHaveURL(/node=n-acb/);
  });

  test('시나리오·옵션: 분기 누전(지락) → ELCB·RCBO 만 · 차단 실패 → 후비 보호 · 마이크로그리드 · 동작 순서', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('./#/?sim=1');
    await tid(page, 'sim-scenario-leak').click();
    await expect(page).toHaveURL(/ftype=ground/);
    await expect(tid(page, 'sim-ftype')).toHaveValue('ground');
    await expect(tid(page, 'diagram-node-n-elcb')).toHaveAttribute('data-sim', 'tripped');
    await tid(page, 'sim-scenario-fail').click();
    await expect(tid(page, 'diagram-node-n-mccb')).toHaveAttribute('data-sim', 'failed');
    await expect(tid(page, 'diagram-node-n-acb')).toHaveAttribute('data-sim', 'tripped');
    await expect(tid(page, 'sim-timeline')).toContainText('후비 보호');
    await tid(page, 'sim-scenario-grid-loss').click();
    await expect(tid(page, 'sim-timeline')).toContainText('UPS 무순단');
    await expect(tid(page, 'sim-timeline')).toContainText('비상발전기 기동');
    await expect(tid(page, 'sim-biz')).toContainText('자사 제품 동작');
    await page.screenshot({ path: SHOT + 'sim-grid.png' });
    await tid(page, 'sim-scenario-microgrid').click();
    await expect(tid(page, 'sim-mg')).toBeChecked();
    await expect(tid(page, 'diagram-node-n-mccb')).toHaveAttribute('data-sim', 'backup');
    const axe = await new AxeBuilder({ page }).include('[data-testid="sim-panel"]').analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  });

  test('택1 구성 · 중요 부하 유지율 · 보호협조 곡선 · 복구 순서 · 보고서', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('./#/?sim=1');
    // 2회선 ALTS 시나리오: 택1 선택이 ALTS 로, LBS 는 미설치
    await tid(page, 'sim-scenario-alts').click();
    await expect(tid(page, 'sim-alt-0')).toHaveValue('n-alts');
    await expect(tid(page, 'diagram-node-n-lbs')).toHaveAttribute('data-sim', 'unused');
    await expect(tid(page, 'diagram-node-n-alts')).not.toHaveAttribute('data-sim', 'dead');
    // 수전 정전: 중요 부하 유지율 · 복구 순서
    await tid(page, 'sim-scenario-grid-loss').click();
    await expect(tid(page, 'sim-important')).toContainText('%');
    await expect(tid(page, 'sim-restore')).toContainText('재투입');
    await expect(tid(page, 'sim-restore')).toContainText('ATS 상용 쪽으로 재절체');
    // 차단 실패: 보호협조 곡선(1차 실패 + 후비)
    await tid(page, 'sim-scenario-fail').click();
    await expect(tid(page, 'sim-tcc')).toBeVisible();
    await expect(tid(page, 'sim-tcc')).toContainText('후비');
    // 보고서: 인쇄용 숨은 창이 만들어지고 내용이 들어감
    await page.evaluate(() => { (window as unknown as { print: () => void }).print = () => {}; });
    await tid(page, 'sim-report').click();
    const frame = page.locator('iframe[data-sim-report]');
    await expect(frame).toHaveCount(1);
    await expect.poll(() => frame.evaluate((f) => (f as HTMLIFrameElement).contentDocument?.body.innerText ?? '')).toContain('사고 시뮬레이션 보고서');
    const axe = await new AxeBuilder({ page }).include('[data-testid="sim-panel"]').analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    await page.screenshot({ path: SHOT + 'sim-tcc.png' });
  });

  test('내 단선도(계통 구성)에서 사고 시뮬레이션: 예시 단선도 → 반 열기 → 하류 정전 · 처음으로', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('./#/builder');
    await tid(page, 'draw-preset').selectOption('substation');
    await tid(page, 'draw-sim').click();
    await expect(tid(page, 'draw-sim-bar')).toContainText('상자를 누르면');
    // 첫 번째 '반'(특고압 수배전반)을 누르면 주 차단기 열기 → 하류 정전
    const panel = page.locator('[data-testid^="draw-node-"][data-kind="panel"]').first();
    await panel.click();
    await expect(tid(page, 'draw-sim-bar')).toContainText('정전');
    expect(await page.locator('.drw-node[data-sim="dead"]').count()).toBeGreaterThan(0);
    await page.screenshot({ path: SHOT + 'draw-sim.png' });
    await tid(page, 'draw-sim-reset').click();
    await expect(page.locator('.drw-node[data-sim="dead"]')).toHaveCount(0);
    await tid(page, 'draw-sim').click();
    await expect(tid(page, 'draw-sim-bar')).toHaveCount(0);
  });
});
