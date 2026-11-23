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
    await expect(page.locator('.scard')).toHaveCount(80); // 데이터센터 기기(SST·SSCB·DC-DC·IT 랙) 포함 전체 기기

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

test.describe('페이지 조각 미리 받기 (자동 배포 뒤 이동 실패 방지, 2026-11-23)', () => {
  test('첫 화면을 연 뒤 기기 상세·제품·비교 조각을 미리 받고, 관리자 조각은 받지 않음 → 그 뒤 조각 요청이 막혀도 기기 상세로 이동됨', async ({ page }) => {
    const seen: string[] = [];
    page.on('request', (r) => seen.push(r.url()));
    await page.goto('./#/');
    await expect(page.getByTestId('diagram')).toBeVisible();
    await expect.poll(() => seen.some((u) => /EquipmentPage-[\w-]+\.js/.test(u)), { timeout: 15_000 }).toBe(true);
    await expect.poll(() => seen.some((u) => /ProductPage-[\w-]+\.js/.test(u))).toBe(true);
    expect(seen.some((u) => /AdminPage-[\w-]+\.js/.test(u))).toBe(false);
    // 새 배포로 예전 조각이 지워진 상황 흉내: 이후 assets 요청을 모두 404
    await page.route('**/assets/**', (route) => route.fulfill({ status: 404, body: '' }));
    await page.goto('./#/equipment/vcb');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('진공차단기');
    await expect(page.getByTestId('page-error')).toHaveCount(0);
  });
});

test.describe('계통 종류: 데이터센터(국내) (2026-11-23)', () => {
  test('계통 선택 → AC·DC 두 경로 계통도, 개발 중 표시, SST 상세, 국내 표준으로 돌아가기, 접근성 위반 0', async ({ page }) => {
    await page.goto('./#/');
    await expect(page.getByTestId('diagram')).toBeVisible();
    const sel = page.getByTestId('grid-select');
    await expect(sel).toHaveValue('std');
    await expect(sel.locator('option')).toHaveText(['국내 표준', '데이터센터(국내)']);
    await sel.selectOption('dc');
    await expect(page).toHaveURL(/grid=dc/);
    await expect(page.getByTestId('diagram-node-dc-sst')).toBeVisible();
    await expect(page.getByTestId('diagram-node-dc-ups')).toHaveCount(1);
    await expect(page.getByTestId('diagram-node-n-gen')).toHaveCount(0); // 국내 표준 노드는 없음
    await expect(page.getByTestId('legend-card')).toContainText('개발 중');

    await page.getByTestId('diagram-node-dc-sst').click();
    await expect(page.getByTestId('detail-panel')).toContainText('반도체 변압기');
    await expect(page.getByTestId('detail-panel')).toContainText('개발 중');

    const axe = await new AxeBuilder({ page }).include('[data-testid="diagram"]').analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);

    await sel.selectOption('std');
    await expect(page).not.toHaveURL(/grid=/);
    await expect(page).not.toHaveURL(/node=dc-/); // 다른 계통 노드 선택은 지움
    await expect(page.getByTestId('diagram-node-n-gen')).toBeVisible();
  });

  test('데이터센터에만 있는 기기(SST) 상세 페이지 → "계통도에서 보기"는 데이터센터 계통도로', async ({ page }) => {
    await page.goto('./#/equipment/sst');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('반도체 변압기');
    await page.getByRole('link', { name: /계통도에서 보기/ }).first().click();
    await expect(page).toHaveURL(/grid=dc/);
    await expect(page).toHaveURL(/node=dc-sst/);
    await expect(page.getByTestId('grid-select')).toHaveValue('dc');
  });
});
