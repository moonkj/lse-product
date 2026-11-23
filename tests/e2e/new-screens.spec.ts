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
    await expect(page.locator('.scard')).toHaveCount(76); // 국내 표준 계통도에 있는 기기만 (단계별도 계통 선택을 따름, 2026-11-23)

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

    await tid(page, 'pfil-ul').click(); // 주소로 상태를 그리는 체크박스 — check() 의 즉시 확인 대신 아래에서 기다림
    await expect(tid(page, 'pfil-ul')).toBeChecked();
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

test.describe('첫 화면 길잡이 (말풍선 3단계, 2026-11-23)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('처음 주소로 처음 오면 3단계 안내 → 다음·이전·시작하기, 닫으면 다시 안 뜸, 헤더 사용법으로 다시 열기, 접근성 위반 0', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./');
    const g = tid(page, 'first-guide');
    await expect(g).toBeVisible();
    await expect(g).toHaveAttribute('data-step', '1');
    await expect(g).toContainText('자사 제품을 확인하세요');
    await expect(tid(page, 'first-guide-next')).toBeFocused();
    // 첫 단계는 자사 보유 기기(초록 ✓)를 가리킴 — 테두리 강조가 보유 기기 상자 위
    const ring = (await page.locator('.fguide__ring').boundingBox())!;
    const owned = await page.evaluate(([x, y]) => document.elementsFromPoint(x, y).find((e) => e.classList.contains('dnode'))?.getAttribute('data-coverage'), [ring.x + ring.width / 2, ring.y + ring.height / 2]);
    expect(owned).toBe('owned');
    const axe = await new AxeBuilder({ page }).include('[data-testid="first-guide"]').analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    await page.screenshot({ path: 'C:/Users/kjmoon/AppData/Local/Temp/claude/692784dc4ab60723/d18e3653-3fd9-4f20-94d1-21c5c8f01a5e/scratchpad/guide1.png' });

    await tid(page, 'first-guide-next').click();
    await expect(g).toContainText('필요하면 수요처를');
    await expect(g).toContainText('꼭 고르지 않아도');
    await tid(page, 'first-guide-prev').click();
    await expect(g).toHaveAttribute('data-step', '1');
    await tid(page, 'first-guide-next').click();
    await tid(page, 'first-guide-next').click();
    await expect(g).toContainText('보는 방식을 바꿔 보세요');
    await page.screenshot({ path: 'C:/Users/kjmoon/AppData/Local/Temp/claude/692784dc4ab60723/d18e3653-3fd9-4f20-94d1-21c5c8f01a5e/scratchpad/guide3.png' });
    await expect(tid(page, 'first-guide-next')).toHaveText('시작하기');
    await tid(page, 'first-guide-next').click();
    await expect(g).toHaveCount(0);

    await page.reload();
    await expect(tid(page, 'diagram')).toBeVisible();
    await page.waitForTimeout(1200);
    await expect(g).toHaveCount(0);

    await tid(page, 'help-toggle').click();
    await expect(g).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(g).toHaveCount(0);
  });

  test('공유 링크(?node=)로 처음 오면 길잡이를 띄우지 않음', async ({ page }) => {
    await page.goto('./#/?node=n-vcb');
    await expect(tid(page, 'detail-panel')).toBeVisible();
    await page.waitForTimeout(1200);
    await expect(tid(page, 'first-guide')).toHaveCount(0);
  });
});

test.describe('UX 1차 묶음 (2026-11-23)', () => {
  test('휴대폰 ☰ 메뉴: 열면 화면 목록(현재 화면 표시), 제품 조회로 이동하면 닫힘, Esc 로 닫힘', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./#/');
    const t = tid(page, 'mobile-menu-toggle');
    await expect(t).toBeVisible();
    await t.click();
    const m = tid(page, 'mobile-menu');
    await expect(m).toBeVisible();
    await expect(tid(page, 'mmenu-home')).toHaveAttribute('aria-current', 'page');
    await page.screenshot({ path: 'C:/Users/kjmoon/AppData/Local/Temp/claude/692784dc4ab60723/d18e3653-3fd9-4f20-94d1-21c5c8f01a5e/scratchpad/ux/m-menu.png' });
    await tid(page, 'mmenu-products').click();
    await expect(tid(page, 'products-title')).toBeVisible();
    await expect(m).not.toBeVisible();
    await t.click();
    await expect(tid(page, 'mmenu-products')).toHaveAttribute('aria-current', 'page');
    await page.keyboard.press('Escape');
    await expect(m).not.toBeVisible();
  });

  test('데스크톱에서는 ☰ 메뉴가 없고 헤더 메뉴만', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./#/');
    await expect(tid(page, 'mobile-menu-toggle')).toBeHidden();
    await expect(tid(page, 'products-link')).toBeVisible();
  });

  test('보유율 기준 문구: 사이드바 = 계통 기준, 라인업 현황 = 전체 기기 기준', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('./#/');
    await expect(tid(page, 'layer-nav-summary-basis')).toContainText('국내 표준 계통 기준');
    await page.goto('./#/?grid=dc');
    await expect(tid(page, 'layer-nav-summary-basis')).toContainText('데이터센터(국내) 계통 기준');
    await expect(page.getByRole('heading', { name: '차세대 DC 경로' })).toBeVisible();
    await expect(tid(page, 'diagram-review-badge')).toContainText('초안');
    await page.goto('./#/gap');
    await expect(tid(page, 'gap-basis')).toContainText('전체 기기 기준');
    await expect(page.getByRole('heading', { name: '계층별 보유 현황' })).toBeVisible();
  });

  test('단계별도 계통 선택을 따름: 데이터센터 = 수전·변환 / 배전 / 부하, 카드 수 = 표시 숫자', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('./#/?view=stage&grid=dc');
    await expect(tid(page, 'stage-view')).toBeVisible();
    await expect(tid(page, 'stage-row-dc-supply')).toBeVisible();
    await expect(tid(page, 'stage-row-dc-dist')).toBeVisible();
    await expect(tid(page, 'stage-row-grid')).toHaveCount(0);
    await expect(tid(page, 'stage-card-sst')).toBeVisible();
    const n = await page.locator('.scard').count();
    await expect(tid(page, 'stage-total')).toHaveText(`카드 ${n}개`);
    await page.screenshot({ path: 'C:/Users/kjmoon/AppData/Local/Temp/claude/692784dc4ab60723/d18e3653-3fd9-4f20-94d1-21c5c8f01a5e/scratchpad/ux/d-stage-dc.png' });
  });

  test('전력시장 지표: 산출 근거는 접혀 있고 펼칠 수 있음, 증감은 ▲▼', async ({ page }) => {
    await page.goto('./#/market');
    const basis = tid(page, 'mai-basis-consumption');
    await expect(basis).not.toHaveAttribute('open', '');
    await expect(basis.getByText('실적 방법')).toBeHidden();
    await basis.locator('summary').click();
    await expect(basis.getByText('실적 방법')).toBeVisible();
    await expect(tid(page, 'mai-yoy-generation')).toHaveText(/[▲▼–] \d/);
  });
});

test.describe('UX 2차 묶음 (2026-11-23)', () => {
  test('제품 조회: 0개 필터는 누를 수 없음, 고른 조건 칩 → 하나씩 풀기·모두 지우기', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./#/products?stage=L4&ul=1');
    await expect(page.getByTestId('pfil-stage-L2')).toBeDisabled();
    const chips = page.getByTestId('products-chips');
    await expect(chips).toContainText('L4 수전설비');
    await expect(chips).toContainText('북미 UL');
    await chips.getByRole('button', { name: '북미 UL 조건 지우기' }).click();
    await expect(page).not.toHaveURL(/ul=1/);
    await expect(page.getByTestId('pfil-ul')).not.toBeChecked();
    await page.getByTestId('products-chips-clear').click();
    await expect(page).not.toHaveURL(/stage=/);
    await expect(chips).toHaveCount(0);
  });

  test('휴대폰 제품 조회: 검색창이 필터보다 위', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./#/products');
    const s = (await page.getByTestId('products-search').boundingBox())!;
    const f = (await page.locator('#pfil').boundingBox())!;
    expect(s.y).toBeLessThan(f.y);
  });

  test('계통도 보기 옵션: 계획 켜기·끄기, 시장 지표로 이동, Esc 로 닫힘 / 패널 열려도 범례 한 줄', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./#/?node=n-vcb');
    await expect(page.getByTestId('detail-panel')).toBeVisible();
    expect((await page.getByTestId('legend-card').boundingBox())!.height).toBeLessThanOrEqual(48);
    const opt = page.getByTestId('view-options');
    await opt.click();
    await expect(page.getByTestId('plan-toggle')).toBeFocused();
    await page.getByTestId('plan-toggle').click();
    await expect(page.getByTestId('plan-toggle')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('view-options-panel')).toHaveCount(0);
    await expect(opt).toBeFocused();
    await opt.click();
    await page.getByTestId('market-link').click();
    await expect(page).toHaveURL(/#\/market/);
  });
});

test.describe('UX 3차 묶음 (2026-11-23)', () => {
  test('관리자 버튼은 헤더가 아니라 화면 오른쪽 맨 아래', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./#/products');
    await expect(page.getByRole('navigation', { name: '화면' }).getByText('관리자')).toHaveCount(0);
    const b = (await tid(page, 'admin-link').boundingBox())!;
    expect(b.x + b.width).toBeGreaterThan(1440 - 40);
    expect(b.y + b.height).toBeGreaterThan(900 - 40);
    await page.screenshot({ path: 'C:/Users/kjmoon/AppData/Local/Temp/claude/692784dc4ab60723/d18e3653-3fd9-4f20-94d1-21c5c8f01a5e/scratchpad/ux/b3-products.png' });
  });

  test('휴대폰 계통도: 도구 줄은 접혀 있고 "도구"로 펼침', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./#/');
    await expect(tid(page, 'zoom-in')).toBeHidden();
    await tid(page, 'dtool-more').click();
    await expect(tid(page, 'zoom-in')).toBeVisible();
    await expect(tid(page, 'flow-toggle')).toBeVisible();
    await page.screenshot({ path: 'C:/Users/kjmoon/AppData/Local/Temp/claude/692784dc4ab60723/d18e3653-3fd9-4f20-94d1-21c5c8f01a5e/scratchpad/ux/b3-m-map.png' });
  });

  // '보유 현황표' 점·막대 검사는 라인업 현황 재설계(아래 describe)로 대체

  test('비교: 아래로 스크롤하면 머리글 사진을 접음', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 800 });
    await page.goto('./#/compare?type=equipment&ids=vcb,acb');
    const box = page.locator('.cmp-scroll');
    await expect(page.locator('.cmp-colhead__media').first()).toBeVisible();
    await page.evaluate(() => { document.querySelector('.app-main')?.scrollTo({ top: 600 }); window.scrollTo(0, 600); });
    await expect(box).toHaveAttribute('data-scrolled', 'true');
    await expect(page.locator('.cmp-colhead__media').first()).toBeHidden();
  });
});

test.describe('라인업 현황 재설계 (2026-11-23)', () => {
  test('요약 카드 4개 → 계층별 막대(누르면 목록이 그 계층만) → 우선순위 묶음, 상세표 없음, 메모 문구 삭제, 접근성 위반 0', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./#/gap');
    const kpis = page.locator('.gx-kpi');
    await expect(kpis).toHaveCount(4);
    await expect(kpis.nth(1)).toContainText('보완 필요');
    await expect(page.getByRole('heading', { name: '우선 검토' })).toBeVisible();
    await page.getByTestId('gap-layer-L1').click();
    await expect(page.getByTestId('gap-layer-L1')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('gap-layer-clear')).toBeVisible();
    for (const row of await page.getByTestId('gap-list').getByTestId(/^gap-item-/).all()) await expect(row.locator('.gx-item__layer')).toHaveText('L1');
    await page.getByTestId('gap-layer-clear').click();
    await expect(page.getByTestId('gap-layer-clear')).toHaveCount(0);
    await expect(page.locator('.gx-detail')).toHaveCount(0);
    await expect(page.getByTestId('gap-page')).not.toContainText('홈페이지 제품 목록에서 찾지 못함');
    await expect(page.getByTestId('gap-page')).not.toContainText('사업부 확인 필요'); // 계층 × 기능 표는 삭제 (2026-11-23 사용자)
    const axe = await new AxeBuilder({ page }).include('[data-testid="gap-page"]').analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
  });
});
