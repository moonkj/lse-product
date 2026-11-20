/**
 * 2026-11-19 화면 추가 — [계통맵 | 단계별] 보기 전환 · 단계별 보기 · 제품 조회(/products)
 * 셀렉터: view-switch-map·stage, stage-view, stage-col-*, stage-card-{기기id}, stage-tab-*, products-*, pfil-*, pcard-{제품id}
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const tid = (page: Page, id: string) => page.getByTestId(id);

test.describe('보기 전환 · 단계별 보기', () => {
  test('계통맵 → 단계별: 계통맵 층 열(L1·L2·L3·수용가·신재생) + 감시·제어, 카드 누르면 상세 패널, 계통맵으로 돌아가도 선택 유지', async ({ page }) => {
    await page.goto('./#/');
    await expect(tid(page, 'diagram')).toBeVisible();
    await tid(page, 'view-switch-stage').click();
    await expect(page).toHaveURL(/view=stage/);
    await expect(tid(page, 'stage-view')).toBeVisible();
    for (const id of ['L1', 'L2', 'L3', 'REN', 'L4', 'L5', 'L6', 'L7']) await expect(tid(page, `stage-col-${id}`)).toBeVisible();
    await expect(tid(page, 'stage-monitoring')).toBeVisible();
    await expect(page.locator('.scard')).toHaveCount(76);

    await tid(page, 'stage-card-panelboard').click();
    await expect(page).toHaveURL(/node=n-panel/);
    await expect(page.locator('#detail-panel-title')).toHaveText('분전반 (함체)');
    await expect(page.locator('#detail-panel-title')).toBeFocused();
    await expect(tid(page, 'stage-card-panelboard')).toHaveAttribute('aria-pressed', 'true');

    await tid(page, 'view-switch-map').click();
    await expect(page).not.toHaveURL(/view=stage/);
    await expect(page).toHaveURL(/node=n-panel/);
    await expect(tid(page, 'diagram')).toBeVisible();
  });

  test('보완 필요 보기: 보완 대상 아닌 카드는 흐리게, 접근성 위반 0', async ({ page }) => {
    await page.goto('./#/?view=stage&mode=gap');
    await expect(tid(page, 'stage-view')).toBeVisible();
    await expect(page.locator('.scard[data-gap]').first()).not.toHaveAttribute('data-dim', /.*/);
    expect(await page.locator('.scard[data-dim]').count()).toBeGreaterThan(0);
    const axe = await new AxeBuilder({ page }).include('[data-testid="stage-view"]').analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
  });

  test('휴대폰 390px: 단계 탭으로 한 열씩, 가로 넘침 0', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./#/?view=stage');
    await expect(tid(page, 'stage-tab-L1')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.scol')).toHaveCount(1);
    await tid(page, 'stage-tab-L7').click();
    await expect(tid(page, 'stage-col-L7')).toBeVisible();
    const box = await tid(page, 'stage-tab-L7').boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});

test.describe('제품 조회 /products', () => {
  test('헤더 메뉴로 열기, 단종 제외 기본, 검색·필터는 주소에 남고 새로 열어도 그대로', async ({ page }) => {
    await page.goto('./#/');
    await tid(page, 'products-link').click();
    await expect(tid(page, 'products-title')).toHaveText('제품 조회');
    await expect(tid(page, 'products-count')).toContainText('전체 236개');

    await tid(page, 'products-search').fill('susol mccb');
    await expect(page).toHaveURL(/q=susol/);
    await expect(tid(page, 'pcard-P01021')).toBeVisible();

    await tid(page, 'pfil-ul').check();
    await expect(page).toHaveURL(/ul=1/);
    await expect(tid(page, 'pcard-P01021')).toHaveCount(0);

    await page.goto('./#/products?ul=1');
    await expect(tid(page, 'pfil-ul')).toBeChecked();
    await expect(tid(page, 'pcard-US-1671')).toBeVisible();
    // 출처(국문·영문 사이트 등) 표시는 없앰 (2026-11-20 사용자)
    await expect(tid(page, 'pcard-US-1671')).not.toContainText(/국문 사이트|영문 사이트|LS ELECTRIC America/);
  });

  test('비교 담기 → 비교 바, 결과 없음 안내, 접근성 위반 0', async ({ page }) => {
    await page.goto('./#/products?q=Susol%20ACB');
    const card = tid(page, 'pcard-P00206');
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: /비교/ }).click();
    await expect(page.getByTestId('compare-tray')).toBeVisible();

    const axe = await new AxeBuilder({ page }).include('.pg--products').analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);

    await page.goto('./#/products?q=zzzz-none');
    await expect(page.getByText('조건에 맞는 제품이 없습니다.')).toBeVisible();
  });

  test('휴대폰 390px: 필터는 접힘 → 펼치기, 가로 넘침 0', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./#/products');
    await expect(tid(page, 'pfil-business')).toBeHidden();
    await tid(page, 'pfil-toggle').click();
    await expect(tid(page, 'pfil-business')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
