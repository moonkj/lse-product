/**
 * 기기 상세 설명(overview) — "계통에서 하는 일" 을 요약 문단 + 항목(라벨·본문)으로 표시 (2026-11-18 설명 전수 재정리, 출처 줄 삭제)
 * 펼친 패널·제품 상세·기기 상세에 요약 + 항목, 비교 화면은 요약 기본 + 더 보기로 항목, 접힌 모바일 시트는 description 한 줄 유지.
 * 기기는 src/data/*.json 에서 조건으로 고른다.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect, type Locator, type Page } from '@playwright/test';

interface Point {
  label: string;
  text: string;
}
interface Eq {
  id: string;
  name: string;
  description: string;
  coverage: string;
  overview?: { summary: string; points: Point[] };
  productIds?: string[];
  lseCategoryCodes: string[];
}
interface DNode {
  id: string;
  kind?: string;
  ref?: boolean;
  equipmentTypeId?: string;
}
const load = <T,>(f: string): T => JSON.parse(readFileSync(fileURLToPath(new URL(`../../src/data/${f}`, import.meta.url)), 'utf8')) as T;
const equipment = load<Eq[]>('equipment-types.json');
const nodes = load<{ nodes: DNode[] }>('diagram.json').nodes.filter((n) => (n.kind ?? 'equipment') === 'equipment' && !n.ref && n.equipmentTypeId);
const products = load<{ id: string; name: string; categoryCode: string }[]>('products.json');

const onDiagram = (e: Eq) => nodes.some((n) => n.equipmentTypeId === e.id);
/** 계통도 타일이 있는 기기 (VCB 우선) */
const pick = [...equipment].sort((a, b) => Number(b.id === 'vcb') - Number(a.id === 'vcb')).find((e) => e.overview && onDiagram(e));
const pickNode = pick && nodes.find((n) => n.equipmentTypeId === pick.id)!;
/** 자사 제품이 없는 기기 (coverage missing) */
const missing = equipment.find((e) => e.coverage === 'missing' && e.overview && onDiagram(e));
const missingNode = missing && nodes.find((n) => n.equipmentTypeId === missing.id)!;
/** 제품 상세 — overview 기기에 연결된 제품 (ACB 우선, 카테고리 접두사 규칙) */
const prodCase = (() => {
  for (const e of [...equipment].sort((a, b) => Number(b.id === 'acb') - Number(a.id === 'acb'))) {
    if (!e.overview) continue;
    const p = products.find((x) => e.productIds?.includes(x.id)) ?? products.find((x) => e.lseCategoryCodes.some((c) => x.categoryCode.startsWith(c)));
    if (p) return { eq: e, product: p };
  }
  return undefined;
})();

const tid = (page: Page, id: string) => page.locator(`[data-testid="${id}"]`);
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/** 요약 + 항목 라벨(dt)·본문(dd)이 보이고 근거 줄은 없다 */
async function expectOverview(scope: Locator, eq: Eq) {
  await expect(scope.getByTestId('overview-summary')).toHaveText(norm(eq.overview!.summary));
  const dl = scope.getByTestId('overview-points');
  await expect(dl).toBeVisible();
  await expect(dl.locator('dt')).toHaveText(eq.overview!.points.map((p) => p.label));
  await expect(dl.locator('dd')).toHaveText(eq.overview!.points.map((p) => norm(p.text)));
  await expect(scope.getByTestId('overview-sources')).toHaveCount(0);
  await expect(scope).not.toContainText('근거:');
  await expect(scope).not.toContainText('일반 기술 설명');
}

test.describe('상세 설명 overview', () => {
  test.skip(!pick || !pickNode, 'overview 기기 없음');

  test('데스크톱 패널: 설명 자리에 요약 + 항목, 근거 줄 없음', async ({ page }) => {
    await page.goto(`./#/?node=${pickNode!.id}`);
    const p = tid(page, 'detail-panel');
    await expect(p).toBeVisible();
    await expectOverview(p.getByTestId('detail-desc'), pick!);
    await expect(p.getByTestId('overview-sources')).toHaveCount(0);
  });

  test('자사 제품이 없는 기기(missing)에는 "LS ELECTRIC 제품" 항목이 없다', async ({ page }) => {
    test.skip(!missingNode, 'missing 기기 없음');
    await page.goto(`./#/?node=${missingNode!.id}`);
    const dl = tid(page, 'detail-panel').getByTestId('overview-points');
    await expect(dl).toBeVisible();
    await expect(dl.locator('dt', { hasText: 'LS ELECTRIC 제품' })).toHaveCount(0);
  });

  test('기기 상세: 계통에서 하는 일 = 요약 + 항목', async ({ page }) => {
    await page.goto(`./#/equipment/${pick!.id}`);
    await expectOverview(tid(page, 'equipment-role-text'), pick!);
  });

  test('제품 상세: 계통에서 하는 일 · 기기 = 요약 + 항목', async ({ page }) => {
    test.skip(!prodCase, '제품 연결 기기 없음');
    await page.goto(`./#/product/${prodCase!.product.id}`);
    const role = tid(page, 'product-role-text').first();
    await expect(role).toBeVisible();
    const summary = await role.getByTestId('overview-summary').textContent();
    const eq = equipment.find((e) => e.overview && norm(e.overview.summary) === norm(summary ?? ''));
    expect(eq, '제품 상세 요약이 어떤 기기의 overview 와 일치').toBeDefined();
    await expectOverview(role, eq!);
    await expect(page.getByTestId('overview-sources')).toHaveCount(0);
  });

  test('비교: 설명 행은 요약 기본, 더 보기로 항목 펼침', async ({ page }) => {
    const two = equipment.filter((e) => e.overview && e.overview.points.length > 0).slice(0, 2);
    test.skip(two.length < 2, '기기 부족');
    await page.goto(`./#/compare?type=equipment&ids=${two.map((e) => e.id).join(',')}`);
    const row = tid(page, 'compare-row-description');
    await expect(row).toBeVisible();
    await expect(row.getByTestId('compare-desc-text').first()).toHaveText(norm(two[0].overview!.summary));
    await expect(row.getByTestId('overview-points')).toHaveCount(0);
    const more = row.getByTestId('compare-desc-more').first();
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await more.click();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    const dl = row.getByTestId('overview-points').first();
    await expect(dl).toBeVisible();
    await expect(dl.locator('dt')).toHaveText(two[0].overview!.points.map((p) => p.label));
    await expect(row).not.toContainText('근거:');
    await more.click();
    await expect(row.getByTestId('overview-points')).toHaveCount(0);
  });
});

test.describe('모바일 시트 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test.skip(!pick || !pickNode, '기기 없음');

  test('접힌 시트 요약은 description (overview 없음), 펼치면 요약 + 항목(라벨 위·본문 아래)', async ({ page }) => {
    await page.goto(`./#/?node=${pickNode!.id}`);
    const p = tid(page, 'detail-panel');
    await expect(p).toHaveAttribute('data-sheet', 'bottom');
    await expect(p).not.toHaveClass(/is-expanded/);
    await expect(p.getByTestId('detail-desc')).toHaveText(norm(pick!.description));
    await expect(p.getByTestId('overview-summary')).toHaveCount(0);
    await expect(p.getByTestId('overview-points')).toHaveCount(0);
    await p.locator('.dp-expand').click();
    await expect(p).toHaveClass(/is-expanded/);
    await expectOverview(p.getByTestId('detail-desc'), pick!);
    // 좁은 화면 — 라벨 아래로 본문을 쌓는다
    const first = p.getByTestId('overview-points').locator('.ov-point').first();
    const dt = (await first.locator('dt').boundingBox())!;
    const dd = (await first.locator('dd').boundingBox())!;
    expect(dd.y).toBeGreaterThanOrEqual(dt.y + dt.height - 1);
  });
});
