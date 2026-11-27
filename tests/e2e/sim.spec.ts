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
    await expect(tid(page, 'sim-tripped')).toHaveCount(2);

    // 끝내기 → 표시 사라지고 평소처럼 선택됨
    await tid(page, 'sim-stop').click();
    await expect(tid(page, 'sim-panel')).toHaveCount(0);
    await expect(tid(page, 'diagram-node-n-light')).not.toHaveAttribute('data-sim', /.+/);
    await tid(page, 'diagram-node-n-acb').click({ force: true });
    await expect(page).toHaveURL(/node=n-acb/);
  });
});
