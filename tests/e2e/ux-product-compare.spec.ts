/**
 * E2E (UX 토론 2026-11-18) — 제품·비교·검색 갈래 재발 방지.
 *  - B1  제품 상세: 문서가 화면보다 커지지 않음(휠 시 헤더 사라짐) · 모바일 390 폭 그대로 · 비교 바가 화면 안 · 320 가로 스크롤 없음
 *  - B6  명판 형식명 검색(TS250 등) → 옵션 결과 → 제품 페이지 옵션 열 강조
 *  - C5  자료 바로가기 칩 → 해당 섹션
 *  - C6  비교 화면 링크 복사 + 차이만 보기 주소 저장
 * 셀렉터는 data-testid (레이아웃 측정은 예외로 클래스 사용).
 */
import { test, expect, type Page } from '@playwright/test';

const tid = (page: Page, id: string) => page.getByTestId(id);
const SMART_MCCB = 'P01900'; // 옵션 6개(TS100~TS800) — 표가 가장 넓은 제품 중 하나

async function docBox(page: Page) {
  return page.evaluate(() => ({
    iw: window.innerWidth,
    ih: window.innerHeight,
    sw: document.documentElement.scrollWidth,
    sh: document.documentElement.scrollHeight,
    mainSw: document.querySelector('.app-main')?.scrollWidth ?? 0,
    mainCw: document.querySelector('.app-main')?.clientWidth ?? 0,
  }));
}

test.describe('B1 제품 상세 문서 넘침', () => {
  for (const vp of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 640 },
  ]) {
    test(`${vp.width}×${vp.height}: 문서 = 화면 크기, 휠 후에도 헤더 그대로, 비교 바 화면 안`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto(`./#/product/${SMART_MCCB}`);
      await expect(tid(page, 'product-specs')).toHaveAttribute('data-state', 'ready');
      const b = await docBox(page);
      expect(b.iw, '레이아웃 뷰포트가 늘어나지 않음').toBe(vp.width);
      expect(b.sw, '문서 가로 스크롤 없음').toBeLessThanOrEqual(vp.width);
      expect(b.sh, '문서 세로 넘침 없음').toBeLessThanOrEqual(vp.height);
      expect(b.mainSw, '본문 가로 스크롤 없음').toBeLessThanOrEqual(b.mainCw);

      await page.mouse.move(vp.width / 2, vp.height / 2);
      await page.mouse.wheel(0, 4000);
      await page.waitForTimeout(200);
      const headerTop = await page.evaluate(() => document.querySelector('.app-header')!.getBoundingClientRect().top);
      expect(headerTop).toBe(0);

      // 옵션 2개 담기 → 비교 바가 화면 안에 보임
      await tid(page, `compare-toggle-${SMART_MCCB}:ts100`).click();
      await tid(page, `compare-toggle-${SMART_MCCB}:ts250`).click();
      const tray = tid(page, 'compare-tray');
      await expect(tray).toBeVisible();
      const r = (await tray.boundingBox())!;
      expect(r.y + r.height).toBeLessThanOrEqual(vp.height);
      expect(r.y).toBeGreaterThanOrEqual(0);
    });
  }
});

test.describe('B6 명판 형식명 검색', () => {
  for (const q of ['TS250', 'ts 250', '250AF', 'ABN', 'TD100']) {
    test(`"${q}" → 옵션 결과 있음 + 기기 1줄`, async ({ page }) => {
      await page.goto('./#/');
      await tid(page, 'search-input').fill(q);
      const results = tid(page, 'search-results');
      await expect(results.getByTestId(/^search-result-option-/).first()).toBeVisible();
      await expect(results.getByTestId(/^search-result-equipment-/)).toHaveCount(1);
    });
  }

  test('TS250 → 1위 Smart MCCB TS250 → 제품 페이지에서 그 옵션 열 강조·화면 안', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./#/');
    await tid(page, 'search-input').fill('TS250');
    const first = tid(page, 'search-results').getByRole('option').first();
    await expect(first).toHaveAttribute('data-testid', `search-result-option-${SMART_MCCB}-ts250`);
    await first.click();
    await expect(page).toHaveURL(new RegExp(`#/product/${SMART_MCCB}\\?opt=ts250`));
    const head = tid(page, 'product-spec-variant-ts250');
    await expect(head).toHaveAttribute('data-hit', 'true');
    await expect(head).toContainText('검색한 옵션');
    await expect(head).toBeInViewport();
  });
});

test.describe('리뷰 M1 기기 약어 검색 + Enter → 기기', () => {
  for (const [q, node] of [
    ['VCB', 'n-vcb'],
    ['ACB', 'n-acb'],
    ['MCCB', 'n-mccb'],
    ['진공차단기', 'n-vcb'],
  ] as const) {
    test(`"${q}" Enter → ${node} 선택·상세 패널`, async ({ page }) => {
      await page.goto('./#/');
      const input = tid(page, 'search-input');
      await input.fill(q);
      await expect(tid(page, 'search-results').getByRole('option').first()).toHaveAttribute('data-testid', /^search-result-equipment-/);
      await input.press('Enter');
      await expect(page).toHaveURL(new RegExp(`node=${node}(&|$)`));
      await expect(tid(page, 'detail-panel')).toBeVisible();
    });
  }
});

test.describe('리뷰 R2 형식명 색인 로딩 실패', () => {
  test('specs 청크 실패 → 안내 한 줄, 30초 안에는 입력해도 다시 요청하지 않음, 기기·제품 검색은 그대로', async ({ page }) => {
    let requests = 0;
    await page.route(/\/assets\/specs-[^/]+\.js$/, (route) => {
      requests++;
      return route.abort();
    });
    await page.goto('./#/');
    const input = tid(page, 'search-input');
    await input.fill('TS2');
    await expect(tid(page, 'search-specs-failed')).toContainText('모델명 색인을 불러오지 못했습니다');
    for (const ch of ['5', '0']) await input.press(ch);
    await input.fill('');
    await input.fill('VCB');
    await expect(tid(page, 'search-results').getByTestId('search-result-equipment-vcb')).toBeVisible();
    await expect(tid(page, 'search-specs-failed')).toBeVisible();
    expect(requests).toBe(1);
  });
});

test.describe('C5 자료 바로가기 칩', () => {
  test('옵션별 사양·카탈로그 칩 → 해당 섹션이 화면 안으로, 모바일 44px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`./#/product/${SMART_MCCB}`);
    const chips = tid(page, 'product-jump-chips');
    await expect(chips).toBeVisible();
    const jumpSpecs = tid(page, 'jump-specs');
    await expect(jumpSpecs).toBeVisible();
    expect((await jumpSpecs.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await jumpSpecs.click();
    await expect(tid(page, 'product-specs-variants')).toBeInViewport();
    const cat = tid(page, 'jump-catalog');
    if (await cat.count()) {
      await cat.click();
      await expect(page.locator('#docs-catalog')).toBeInViewport();
    }
    await expect(page).toHaveURL(new RegExp(`#/product/${SMART_MCCB}$`)); // 해시 라우터 경로 그대로
  });
});

test.describe('C6 비교 링크 복사·차이만 보기 주소', () => {
  test('차이만 보기 → diff=1 → 새로 열어도 켜짐, 링크 복사 → 클립보드 = 현재 주소', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(`./#/compare?type=product&ids=${SMART_MCCB}:ts100,${SMART_MCCB}:ts250`);
    await tid(page, 'compare-diff-only').click();
    await expect(page).toHaveURL(/diff=1$/);
    await page.reload();
    await expect(tid(page, 'compare-diff-only')).toHaveAttribute('aria-pressed', 'true');
    await tid(page, 'compare-copy-link').click();
    await expect(tid(page, 'compare-copy-link')).toHaveText('링크 복사됨 ✓');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(page.url());
  });
});
