/**
 * 스모크 테스트 — Phase 1 셸 단계에서도 통과해야 하는 최소 검증.
 * 앱이 정적 빌드(preview)에서 뜨고, 헤더와 커버리지 범례 6종이 보인다 (v0.6 R3 sourced 추가).
 *
 * 셀렉터: 현재 셸에 data-testid 가 없으므로 ARIA 역할/이름을 사용한다.
 * Phase 2 에서 testid(`legend`, `legend-item-{coverage}`)가 생기면 core-flows.spec.ts 의
 * "범례 5종" 테스트가 같은 내용을 testid 로 검증한다.
 */
import { test, expect } from '@playwright/test';

/** src/lib/schema.ts COVERAGE_LABELS 와 동일 (앱 코드 import 없이 독립 유지) */
const COVERAGE_LABELS = ['보유', '일부 보유', '계열사 보유', '패널 구성품(타사 조달)', '개발 중', '미보유', '해당 없음'];

test('스모크: 앱이 뜨고 헤더와 범례 7종(v0.6 R3 + 개발 중)이 보인다 (런타임 오류 없음)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('./#/');

  const header = page.getByRole('banner');
  await expect(header).toBeVisible();
  // v1.2: 텍스트 'LS ELECTRIC' → 공식 로고 이미지 (alt 'LS ELECTRIC')
  await expect(header.getByRole('img', { name: 'LS ELECTRIC' })).toBeVisible();
  await expect(header).toContainText('전력계통 제품맵');

  const legend = page.getByRole('list', { name: '보유 상태 범례' });
  await expect(legend).toBeVisible();
  const items = legend.getByRole('listitem');
  await expect(items).toHaveCount(COVERAGE_LABELS.length);
  for (const label of COVERAGE_LABELS) {
    await expect(legend.getByText(label, { exact: true })).toBeVisible();
  }

  expect(errors).toEqual([]);
});

// ─────────────────────────────────────────────────────────────
// v1.2 브랜드 로고·파비콘 (public/brand, BrandLogo)
// ─────────────────────────────────────────────────────────────
const LOGO = '/brand/ls-electric-logo-md.png';

test.describe('브랜드 로고 (v1.2)', () => {
  test('로고 링크: 접근성 이름 "LS ELECTRIC 전력계통 제품맵", 다른 화면에서 누르면 계통도', async ({ page }) => {
    await page.goto('./#/gap');
    await expect(page.getByTestId('gap-page')).toBeVisible();
    const link = page.getByRole('banner').getByRole('link', { name: 'LS ELECTRIC 전력계통 제품맵' });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByTestId('diagram')).toBeVisible();
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme} 모드: 흰 로고 상자 위 컬러 로고가 실제로 로드됨 (naturalWidth > 0)`, async ({ page }) => {
      // 다크는 헤더 토글로 고른 경우만 (저장값 lse-theme=dark → <html data-theme="dark">)
      if (scheme === 'dark') await page.addInitScript(() => localStorage.setItem('lse-theme', 'dark'));
      const failed: string[] = [];
      page.on('response', (r) => {
        if (r.url().includes('/brand/') && r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
      });
      await page.goto('./#/');
      if (scheme === 'dark') await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      else expect(await page.locator('html').getAttribute('data-theme')).toBeNull();
      const img = page.getByRole('banner').getByRole('img', { name: 'LS ELECTRIC' });
      await expect(img).toBeVisible();
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
      const src = await img.evaluate((el: HTMLImageElement) => el.currentSrc);
      expect(src.endsWith(LOGO), src).toBe(true);
      // 로고 상자는 테마와 무관하게 흰색
      const boxBg = await img.evaluate((el) => getComputedStyle(el.parentElement!).backgroundColor);
      expect(boxBg).toBe('rgb(255, 255, 255)');
      const box = await img.boundingBox();
      expect(box!.height).toBeGreaterThan(0);
      expect(box!.height).toBeLessThanOrEqual(48); // 헤더 안에 맞는 크기 (원본 56px 그대로 늘어나지 않음)
      expect(failed).toEqual([]);
    });
  }

  test('파비콘 link 가 있고 파일이 응답함 (base 상대 경로)', async ({ page, request }) => {
    await page.goto('./#/');
    const href = await page.locator('link[rel="icon"]').getAttribute('href');
    expect(href).toBeTruthy();
    expect(href!.startsWith('/'), `절대 경로면 GitHub Pages 서브경로에서 깨짐: ${href}`).toBe(false);
    const res = await request.get(new URL(href!, page.url()).toString());
    expect(res.status()).toBe(200);
    expect((await res.body()).length).toBeGreaterThan(0);
  });

  test('390px: 로고 보이고 가로 넘침 0, 로고가 헤더 밖으로 나가지 않음', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./#/');
    const img = page.getByRole('banner').getByRole('img', { name: 'LS ELECTRIC' });
    await expect(img).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const [hb, ib] = [await page.getByRole('banner').boundingBox(), await img.boundingBox()];
    expect(ib!.x).toBeGreaterThanOrEqual(hb!.x);
    expect(ib!.x + ib!.width).toBeLessThanOrEqual(hb!.x + hb!.width);
  });
});
