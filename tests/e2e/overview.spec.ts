/**
 * 기기 상세 설명(overview) — "계통에서 하는 일" 을 카탈로그·데이터시트 근거 문단으로 표시 (2026-11-18 사용자 요청)
 * 펼친 패널·제품 상세·기기 상세·비교 화면에 overview 본문 + 근거 줄(쪽 링크 url#page=N), 접힌 모바일 시트는 description 요약 유지.
 * 기기는 src/data/*.json 에서 조건으로 고른다.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page } from '@playwright/test';

interface Src {
  title: string;
  url: string;
  page?: number;
}
interface Eq {
  id: string;
  name: string;
  description: string;
  overview?: { text: string; basis: 'catalog' | 'general'; sources: Src[] };
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

const paged = (e: Eq) => e.overview?.basis === 'catalog' && e.overview.sources.some((s) => s.page);
/** 쪽 근거가 있고 계통도 타일이 있는 기기 (VCB 우선) */
const pick = [...equipment].sort((a, b) => Number(b.id === 'vcb') - Number(a.id === 'vcb')).find((e) => paged(e) && nodes.some((n) => n.equipmentTypeId === e.id));
const pickNode = pick && nodes.find((n) => n.equipmentTypeId === pick.id)!;
const firstPage = pick?.overview!.sources.find((s) => s.page);
/** 제품 상세 — 쪽 근거 기기에 연결된 제품 (카테고리 접두사 규칙) */
const prodCase = (() => {
  for (const e of [...equipment].sort((a, b) => Number(b.id === 'acb') - Number(a.id === 'acb'))) {
    if (!paged(e)) continue;
    const p = products.find((x) => e.productIds?.includes(x.id)) ?? products.find((x) => e.lseCategoryCodes.some((c) => x.categoryCode.startsWith(c)));
    if (p) return { eq: e, product: p };
  }
  return undefined;
})();

const tid = (page: Page, id: string) => page.locator(`[data-testid="${id}"]`);
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

async function expectPageLink(_page: Page, scope: ReturnType<typeof tid>, s: Src) {
  const a = scope.locator(`a[href="${s.url}#page=${s.page}"]`).first();
  await expect(a).toBeVisible();
  await expect(a).toHaveAttribute('target', '_blank');
  await expect(a).toHaveAttribute('rel', /noopener/);
}

test.describe('상세 설명 overview', () => {
  test.skip(!pick || !pickNode || !firstPage, '쪽 근거가 있는 기기 없음');

  test('데스크톱 패널: 설명 자리에 overview 문단 + 근거 쪽 링크(#page=N)', async ({ page }) => {
    await page.goto(`./#/?node=${pickNode!.id}`);
    const p = tid(page, 'detail-panel');
    await expect(p).toBeVisible();
    const desc = p.getByTestId('detail-desc');
    await expect(desc).toHaveText(norm(pick!.overview!.text));
    const src = p.getByTestId('overview-sources');
    await expect(src).toContainText('근거:');
    await expectPageLink(page, src, firstPage!);
  });

  test('기기 상세: 계통에서 하는 일 = overview + 근거', async ({ page }) => {
    await page.goto(`./#/equipment/${pick!.id}`);
    await expect(tid(page, 'equipment-role-text')).toHaveText(norm(pick!.overview!.text));
    await expectPageLink(page, tid(page, 'overview-sources'), firstPage!);
  });

  test('제품 상세: 계통에서 하는 일 · 기기 = overview + 근거', async ({ page }) => {
    test.skip(!prodCase, '제품 연결 기기 없음');
    await page.goto(`./#/product/${prodCase!.product.id}`);
    const role = page.locator('.pg-role').filter({ has: tid(page, 'product-role-text') }).first();
    await expect(role).toBeVisible();
    const text = await role.getByTestId('product-role-text').textContent();
    const eq = equipment.find((e) => e.overview && norm(e.overview.text) === norm(text ?? ''));
    expect(eq, '제품 상세 설명이 어떤 기기의 overview 와 일치').toBeDefined();
    const s = eq!.overview!.sources.find((x) => x.page);
    if (s) await expectPageLink(page, role.getByTestId('overview-sources'), s);
  });

  test('비교: 설명 행은 overview, 4줄 clamp + 더 보기 토글', async ({ page }) => {
    const two = equipment.filter((e) => e.overview && e.overview.text.length > 150).slice(0, 2);
    test.skip(two.length < 2, '긴 설명 기기 부족');
    await page.goto(`./#/compare?type=equipment&ids=${two.map((e) => e.id).join(',')}`);
    const row = tid(page, 'compare-row-description');
    await expect(row).toBeVisible();
    const t = row.getByTestId('compare-desc-text').first();
    await expect(t).toHaveText(norm(two[0].overview!.text));
    const clampedH = (await t.boundingBox())!.height;
    const lh = await t.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    expect(clampedH).toBeLessThanOrEqual(lh * 4 + 2);
    const more = row.getByTestId('compare-desc-more').first();
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await more.click();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    expect((await t.boundingBox())!.height).toBeGreaterThan(clampedH);
  });
});

test.describe('모바일 시트 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test.skip(!pick || !pickNode, '기기 없음');

  test('접힌 시트 요약은 description (overview·근거 없음), 펼치면 overview + 근거', async ({ page }) => {
    await page.goto(`./#/?node=${pickNode!.id}`);
    const p = tid(page, 'detail-panel');
    await expect(p).toHaveAttribute('data-sheet', 'bottom');
    await expect(p).not.toHaveClass(/is-expanded/);
    await expect(p.getByTestId('detail-desc')).toHaveText(norm(pick!.description));
    await expect(p.getByTestId('overview-sources')).toHaveCount(0);
    await p.locator('.dp-expand').click();
    await expect(p).toHaveClass(/is-expanded/);
    await expect(p.getByTestId('detail-desc')).toHaveText(norm(pick!.overview!.text));
    await expect(p.getByTestId('overview-sources')).toBeVisible();
  });
});
