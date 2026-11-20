/**
 * UX 라운드 U — T1-C 레이아웃·안내 회귀 테스트
 *  - C1 압축 화면 규칙: 창 높이 ≤600(200% 확대·모바일 가로) 자동 + 헤더 "넓게 보기" 토글(localStorage `lse-present-v1`)
 *       압축이면 헤더 한 줄, 사이드바(범례) 접고 계층 칩 한 줄, 빈 상세 패널 숨김, 모바일 가로는 오른쪽 사이드 패널
 *       데스크톱 기본(1280↑·높이 700↑)은 그대로. 사이드바는 계통도(/)에서만.
 *  - C4 첫 방문 시작 카드: 디자이너 토론 P0-6 으로 제거 — 첫 방문에도 띠 없음(회귀 검증만)
 *  - B10 live region(data-testid=live-region) 하나 + 라우트 이동 시 h1 포커스
 * 셀렉터: app-shell[data-density], present-toggle, view-mode-*, live-region
 */
import { test, expect, type Page } from '@playwright/test';

const tid = (page: Page, id: string) => page.getByTestId(id);
const EMPTY_STATE = { cookies: [], origins: [] };

async function gotoHome(page: Page, query = '') {
  await page.goto(`./#/${query}`);
  await expect(tid(page, 'diagram')).toBeVisible();
}

/** 계통도에서 실제로 보이는 높이·폭 (고정 위치 시트/사이드 패널에 가린 부분 제외) */
function visibleDiagram(page: Page) {
  return page.evaluate(() => {
    const vp = document.getElementById('diagram-viewport')!.getBoundingClientRect();
    const panel = document.querySelector('.detail-panel');
    let h = vp.height;
    let w = vp.width;
    if (panel && getComputedStyle(panel).position === 'fixed') {
      const r = panel.getBoundingClientRect();
      if (r.width >= window.innerWidth - 2) h = Math.max(0, Math.min(vp.bottom, r.top) - vp.top);
      else w = Math.max(0, Math.min(vp.right, r.left) - vp.left);
    }
    return { h: Math.round(h), w: Math.round(w) };
  });
}

test.describe('C1 압축 화면 · 넓게 보기', () => {
  test('데스크톱 기본(1440×900): 범례 카드 표시, 빈 상세 패널은 오른쪽 레일로 접힘(P0-8), 넓게 보기 꺼짐', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHome(page);
    await expect(tid(page, 'app-shell')).toHaveAttribute('data-density', 'default');
    await expect(tid(page, 'legend')).toBeVisible();
    await expect(tid(page, 'panel-rail-open')).toBeVisible();
    await expect(tid(page, 'present-toggle')).toHaveAttribute('aria-pressed', 'false');
    expect((await visibleDiagram(page)).w).toBeGreaterThan(800);
  });

  test('1024×768 넓게 보기: 사이드바·빈 패널을 접어 계통도 폭 ≥1000px, 새로고침 후에도 유지, 끄면 복귀', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await gotoHome(page);
    const before = (await visibleDiagram(page)).w;
    expect(before).toBeLessThan(820); // 사이드바 + 48 상세 탭 (빈 패널은 레일로 접힘)

    await tid(page, 'present-toggle').click();
    await expect(tid(page, 'present-toggle')).toHaveAttribute('aria-pressed', 'true');
    await expect(tid(page, 'app-shell')).toHaveAttribute('data-density', 'compact');
    await expect(page.locator('.detail-panel--empty')).toBeHidden();
    await expect(tid(page, 'legend')).toBeHidden();
    await expect(tid(page, 'layer-nav-L4')).toBeVisible(); // 계층 칩 한 줄은 남음
    expect((await visibleDiagram(page)).w).toBeGreaterThanOrEqual(970); // 48px 상세 탭만 남음

    await page.reload();
    await expect(tid(page, 'present-toggle')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => localStorage.getItem('lse-present-v1'))).toBe('1');

    // 기기를 고르면 상세 패널 열이 생기고 내용은 평소와 같다
    await tid(page, 'diagram-node-n-vcb').click();
    await expect(tid(page, 'detail-panel')).toBeVisible();
    await expect(tid(page, 'detail-title')).toContainText('진공차단기');

    await tid(page, 'present-toggle').click();
    await expect(tid(page, 'app-shell')).toHaveAttribute('data-density', 'default');
    await expect(tid(page, 'legend')).toBeVisible();
  });

  test('720×450(200% 확대): 자동 압축 — 헤더 한 줄, 기기 선택 시에도 계통도 높이 ≥250px', async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 450 });
    await gotoHome(page, '?node=n-vcb');
    await expect(tid(page, 'app-shell')).toHaveAttribute('data-density', 'compact');
    await expect(tid(page, 'detail-panel')).toBeVisible();
    const header = await page.getByRole('banner').boundingBox();
    expect(header!.height).toBeLessThan(70);
    expect((await visibleDiagram(page)).h).toBeGreaterThanOrEqual(250);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(720);
  });

  test('390×844 세로: 압축 아님, 헤더 1줄(≤64px)·버튼 44px, 넓게 보기 버튼 숨김(M2)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoHome(page);
    await expect(tid(page, 'app-shell')).toHaveAttribute('data-density', 'default');
    const header = await page.getByRole('banner').boundingBox();
    expect(header!.height).toBeLessThanOrEqual(64);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    for (const id of ['view-switch-stage', 'layer-nav-L4', 'theme-toggle', 'gap-table-link-mobile']) {
      // 휴대폰 세로: 헤더 메뉴는 숨기고 공백 표는 칩 줄 끝 링크
      if (id === 'gap-table-link-mobile') await tid(page, id).scrollIntoViewIfNeeded();
      expect((await tid(page, id).boundingBox())!.height, id).toBeGreaterThanOrEqual(44);
    }
    await expect(tid(page, 'present-toggle')).toBeHidden();
  });
});

/** 리뷰 M2: 휴대폰 세로에서 저장된 넓게 보기(lse-present-v1=1)가 켜져 있어도 압축 헤더·사이드 패널을 쓰지 않음 */
test.describe('M2 휴대폰 세로 + 저장된 넓게 보기', () => {
  for (const [w, h] of [
    [390, 844],
    [360, 740],
  ] as const) {
    test.describe(`${w}×${h}`, () => {
      test.use({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
      test('가로 넘침 없음 · 검색창 ≥120px · 하단 시트 · 넓게 보기 버튼 숨김', async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('lse-present-v1', '1'));
        await gotoHome(page, '?node=n-vcb');
        await expect(tid(page, 'app-shell')).toHaveAttribute('data-density', 'default');
        await expect(tid(page, 'present-toggle')).toBeHidden();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);
        expect((await tid(page, 'search-input').boundingBox())!.width).toBeGreaterThanOrEqual(120);
        const panel = tid(page, 'detail-panel');
        await expect(panel).toBeVisible();
        await expect(panel).toHaveAttribute('data-sheet', 'bottom');
        const r = (await panel.boundingBox())!;
        expect(r.width).toBeGreaterThanOrEqual(w - 2); // 사이드 패널이 아니라 전체 폭 시트
        // 제품 화면도 넘침·검색창 깨짐 없음
        await page.goto('./#/product/P00206');
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);
        expect((await tid(page, 'search-input').boundingBox())!.width).toBeGreaterThanOrEqual(120);
      });
    });
  }

  test.describe('844×390 가로 (저장된 넓게 보기)', () => {
    test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
    test('압축 + 오른쪽 사이드 패널 유지, 넘침 없음', async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('lse-present-v1', '1'));
      await gotoHome(page, '?node=n-vcb');
      await expect(tid(page, 'app-shell')).toHaveAttribute('data-density', 'compact');
      await expect(tid(page, 'present-toggle')).toBeVisible();
      await expect(tid(page, 'detail-panel')).toHaveAttribute('data-sheet', 'side');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(844);
    });
  });
});

test.describe('C1 모바일 가로', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  test('844×390: 상세는 오른쪽 사이드 패널, 계통도가 보임(높이 ≥150px)', async ({ page }) => {
    await gotoHome(page, '?node=n-vcb');
    await expect(tid(page, 'app-shell')).toHaveAttribute('data-density', 'compact');
    const panel = await tid(page, 'detail-panel').boundingBox();
    expect(panel!.x).toBeGreaterThan(300); // 화면 오른쪽
    const vis = await visibleDiagram(page);
    expect(vis.h).toBeGreaterThanOrEqual(150);
    expect(vis.w).toBeGreaterThanOrEqual(400);
  });
});

test.describe('C1 사이드바는 계통도 화면에서만', () => {
  for (const path of ['gap', 'product/P00206', 'compare?type=equipment&ids=vcb,acb']) {
    test(`/${path}: 사이드바(계층 내비) 없음`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`./#/${path}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(tid(page, 'layer-nav')).toHaveCount(0);
    });
  }
});

test.describe('C4 시작 카드 띠 제거 (디자이너 토론 P0-6)', () => {
  test.use({ storageState: EMPTY_STATE });

  test('주소 파라미터 없는 첫 방문에도 시작 카드 없음 — 도구줄 바로 아래 계통도', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./');
    await expect(tid(page, 'diagram')).toBeVisible();
    await expect(tid(page, 'start-card')).toHaveCount(0);
    // 보기 방식 전환(계통맵|단계별)은 도구줄 맨 왼쪽, 보기 모드 버튼은 없음 (2026-11-20)
    await expect(page.getByTestId(/^view-mode-/)).toHaveCount(0);
    const seg = (await tid(page, 'view-switch').boundingBox())!;
    const zoom = (await tid(page, 'zoom-out').boundingBox())!;
    expect(seg.x).toBeLessThan(zoom.x);
  });
});

test.describe('B10 live region · 라우트 포커스', () => {
  test('live region 은 앱에 하나, 라인업 현황 필터 결과를 알림', async ({ page }) => {
    await page.goto('./#/gap');
    await expect(tid(page, 'gap-page')).toBeVisible();
    await expect(page.locator('[aria-live]').and(tid(page, 'live-region'))).toHaveCount(1);
    await tid(page, 'gap-filter-missing').click();
    await expect(tid(page, 'live-region')).toHaveText(/보완 필요 목록 · 미보유 — \d+종/);
  });

  test('라우트 이동 → 새 화면 h1 포커스', async ({ page }) => {
    // 보기 모드 버튼을 없애(2026-11-20) "같은 화면 쿼리 변경은 포커스 유지" 확인 대상이 사라짐
    await gotoHome(page);
    await tid(page, 'gap-table-link').click();
    await expect(page.getByRole('heading', { level: 1, name: '라인업 현황' })).toBeFocused();
  });

  test('R1 제품 화면 "계통도에서 보기" Enter → 계통도 상세 패널 제목에 포커스', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./#/product/P00206');
    const link = page.getByRole('link', { name: '계통도에서 보기', exact: true });
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(tid(page, 'detail-panel')).toBeVisible();
    await expect(page.locator('#detail-panel-title')).toBeFocused();
  });
});
