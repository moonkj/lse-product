/**
 * E2E-7 비교 기능 (v0.9) — 비교 담기(상세 패널) → 비교 바 → /compare 표 → 차이만 보기 → 열 빼기,
 * 제품 비교 사양·출처·검수 전 배지, 없는 id 안내, 모바일 390px, Gap 모드 후보 안내(데이터 기반).
 * 셀렉터는 data-testid 만(레이아웃 측정은 예외로 클래스 사용). 대상 기기·제품·기대 행은 src/data/*.json 에서 계산 (앱 코드 import 없음).
 * v1.0: 사양 불러오기 실패(specs 청크 abort), 공유 링크 열 빼기, 끝 슬래시, 공통 기기(M8), 바 폭별 세로 쪼개짐(H1),
 *       --cmp-tray-h 로 모바일 마지막 링크 가림 0(M2), 열 머리글 sticky(M5).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page, type Locator } from '@playwright/test';

type Coverage = 'owned' | 'partial' | 'affiliate' | 'sourced' | 'missing' | 'na';
interface Eq {
  id: string;
  name: string;
  layer: string;
  voltage: string;
  category: string;
  coverage: Coverage;
  gapAssessment?: { confidence: 'candidate' | 'confirmed'; reviewDue?: string };
}
interface DNode {
  id: string;
  kind?: 'equipment' | 'bus' | 'endpoint';
  equipmentTypeId?: string;
  ref?: boolean;
}
interface SpecItemJ {
  key: string;
  value: string;
  unit?: string;
  page?: number;
}
interface SpecVariantJ {
  id: string;
  label: string;
  items: SpecItemJ[];
  page?: number;
}
interface ProductSpecsJ {
  items: SpecItemJ[];
  variants?: SpecVariantJ[];
  variantAxis?: string;
  source: { url: string; page?: number };
  reviewed: boolean;
}
interface Specs {
  products: Record<string, ProductSpecsJ>;
}

const load = <T>(f: string): T => JSON.parse(readFileSync(fileURLToPath(new URL(`../../src/data/${f}`, import.meta.url)), 'utf8')) as T;
const equipment = load<Eq[]>('equipment-types.json');
const eqById = new Map(equipment.map((e) => [e.id, e]));
const nodes = load<{ nodes: DNode[] }>('diagram.json').nodes.filter(
  (n): n is DNode & { equipmentTypeId: string } => (n.kind ?? 'equipment') === 'equipment' && !n.ref && !!n.equipmentTypeId,
);
const specs = load<Specs>('specs.json');
const productList = load<{ id: string; name: string }[]>('products.json');
const productIds = new Set(productList.map((p) => p.id));
/** 이름이 긴 순 — 비교 바 폭 측정용 */
const longEq = [...equipment].sort((x, y) => y.name.length - x.name.length).slice(0, 4).map((e) => e.id);
const longProd = [...productList].sort((x, y) => y.name.length - x.name.length).slice(0, 4).map((p) => p.id);

/** 같은 계층·전압·분류의 기기 2개 (차이만 보기에서 '계층·전압'·'기능 분류' 행이 반드시 숨겨짐) */
const pair = (() => {
  const groups = new Map<string, (typeof nodes)[number][]>();
  for (const n of nodes) {
    const e = eqById.get(n.equipmentTypeId);
    if (!e) continue;
    const k = `${e.layer}|${e.voltage}|${e.category}`;
    const g = groups.get(k) ?? [];
    if (!g.some((x) => x.equipmentTypeId === n.equipmentTypeId)) g.push(n);
    groups.set(k, g);
  }
  const g = [...groups.values()].find((x) => x.length >= 2);
  return g ? g.slice(0, 2).map((n) => ({ node: n, eq: eqById.get(n.equipmentTypeId)! })) : undefined;
})();

/** 제품 비교 대상 (리더 지정 3종 — 데이터에 없으면 skip) */
const PRODUCT_IDS = ['P01072', 'P01249', 'P02212'];
const productCompareReady = PRODUCT_IDS.every((id) => productIds.has(id) && specs.products[id]);
const STANDARD_ORDER = [
  'ratedVoltage', 'ratedCurrent', 'breakingCapacity', 'frame', 'poles', 'capacity', 'frequency',
  'insulation', 'motorPower', 'protection', 'communication', 'mounting', 'standards',
];
/** 기대 사양 행 = 세 제품 key 합집합 (표준 순서 → 비표준 처음 나온 순) */
/** v1.1: 공통 items + 모든 옵션 items 의 key ("시리즈 전체" 열은 옵션 key 도 행으로) */
const allKeysOf = (id: string) => {
  const sp = specs.products[id];
  return sp ? [...sp.items, ...(sp.variants ?? []).flatMap((v) => v.items)].map((i) => i.key) : [];
};
const orderKeys = (keys: string[]) => {
  const all = [...new Set(keys)];
  return [...STANDARD_ORDER.filter((k) => all.includes(k)), ...all.filter((k) => !STANDARD_ORDER.includes(k))];
};
const expectedSpecKeys = (() => {
  const all = [...new Set(PRODUCT_IDS.flatMap(allKeysOf))];
  const std = STANDARD_ORDER.filter((k) => all.includes(k));
  return [...std, ...all.filter((k) => !STANDARD_ORDER.includes(k))];
})();

/** 화면 확신도 규칙 (core-flows 와 같은 계약): 공백류 + (근거 없음·후보·재확인 기한 지남) → candidate */
const ASSESSED: Coverage[] = ['missing', 'partial', 'affiliate', 'sourced'];
const todayKst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const hasCandidate = equipment.some((e) => {
  if (!ASSESSED.includes(e.coverage)) return false;
  const g = e.gapAssessment;
  return !g || g.confidence !== 'confirmed' || (!!g.reviewDue && g.reviewDue < todayKst());
});

const tid = (page: Page, id: string): Locator => page.getByTestId(id);
const rows = (page: Page) => tid(page, 'compare-table').getByTestId(/^compare-row-/);
const noHorizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function gotoHome(page: Page, query = '') {
  await page.goto(`./#/${query}`);
  await expect(tid(page, 'diagram')).toBeVisible();
}
async function clickNode(page: Page, nodeId: string, layer: string) {
  const nav = tid(page, `layer-nav-${layer}`);
  if (await nav.isVisible()) await nav.click();
  await tid(page, `diagram-node-${nodeId}`).click();
}
/** 비교 담기 목록을 미리 넣고 시작 (store 는 첫 로딩 때 localStorage 를 읽음) */
async function seedCompare(page: Page, value: { equipment: string[]; product: string[]; active: 'equipment' | 'product' }) {
  await page.addInitScript((v) => localStorage.setItem('lse-compare-v1', JSON.stringify(v)), value);
}

test.describe('E2E-7 비교 기능', () => {
  test('상세 패널에서 기기 2개 담기 → 비교 바 → /compare → 차이만 보기 → 열 빼기 → 빈 상태', async ({ page }) => {
    test.skip(!pair, '같은 계층·전압·분류의 기기 2개 없음');
    const [a, b] = pair!;
    await gotoHome(page);
    await expect(tid(page, 'compare-tray')).toHaveCount(0);

    await clickNode(page, a.node.id, a.eq.layer);
    await tid(page, 'detail-panel').getByTestId(`compare-toggle-${a.eq.id}`).click();
    await expect(tid(page, 'detail-panel').getByTestId(`compare-toggle-${a.eq.id}`)).toHaveAttribute('aria-pressed', 'true');
    await expect(tid(page, 'compare-tray')).toBeVisible();
    await expect(tid(page, 'compare-go')).toHaveAttribute('aria-disabled', 'true'); // 1개면 비교 불가

    await clickNode(page, b.node.id, b.eq.layer);
    await tid(page, 'detail-panel').getByTestId(`compare-toggle-${b.eq.id}`).click();
    await expect(tid(page, 'compare-tray').getByTestId(/^compare-tray-item-/)).toHaveCount(2);
    await expect(tid(page, `compare-tray-item-${a.eq.id}`)).toBeVisible();
    await expect(tid(page, `compare-tray-item-${b.eq.id}`)).toBeVisible();

    await tid(page, 'compare-go').click();
    await expect(page).toHaveURL(new RegExp(`#/compare\\?type=equipment&ids=${a.eq.id},${b.eq.id}$`));
    await expect(tid(page, 'compare-page')).toBeVisible();
    await expect(tid(page, 'compare-tray')).toHaveCount(0); // 비교 화면에서는 바 숨김
    await expect(tid(page, 'compare-table').getByTestId(/^compare-col-/)).toHaveCount(2);
    for (const k of ['layer', 'category', 'coverage', 'products', 'docs', 'description', 'upstream', 'downstream']) {
      await expect(tid(page, `compare-row-${k}`)).toBeVisible();
    }
    await expect(tid(page, 'compare-section-specs')).toBeVisible();

    const before = await rows(page).count();
    await tid(page, 'compare-diff-only').click();
    await expect(tid(page, 'compare-diff-only')).toHaveAttribute('aria-pressed', 'true');
    await expect(tid(page, 'compare-row-layer')).toHaveCount(0);
    await expect(tid(page, 'compare-row-category')).toHaveCount(0);
    expect(await rows(page).count()).toBeLessThan(before);

    await tid(page, `compare-remove-${b.eq.id}`).click();
    // 차이만 보기는 주소(diff=1)에 저장되고 같은 비교의 열 빼기에서 유지 (UX 토론 C6)
    await expect(page).toHaveURL(new RegExp(`ids=${a.eq.id}&diff=1$`));
    await expect(tid(page, 'compare-empty')).toBeVisible();
    await expect(tid(page, 'compare-table')).toHaveCount(0);
  });

  test('제품 비교 URL: 사양 행(key 합집합·표준 순서), 출처 링크 #page=, 검수 전 배지', async ({ page }) => {
    test.skip(!productCompareReady, '지정 제품 또는 사양 데이터 없음');
    await page.goto(`./#/compare?type=product&ids=${PRODUCT_IDS.join(',')}`);
    await expect(tid(page, 'compare-page')).toBeVisible();
    await expect(tid(page, 'compare-table').getByTestId(/^compare-col-/)).toHaveCount(3);
    const specRowIds = await tid(page, 'compare-section-specs')
      .getByTestId(/^compare-row-/)
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.replace('compare-row-', '')));
    expect(specRowIds).toEqual([...expectedSpecKeys.map((k) => `spec-${k}`), 'spec-source']);
    await expect(tid(page, 'compare-row-spec-ratedVoltage')).toBeVisible();

    for (const id of PRODUCT_IDS) {
      const s = specs.products[id];
      const link = tid(page, `compare-spec-source-${id}`).getByRole('link').first();
      await expect(link).toHaveAttribute('href', s.source.page ? `${s.source.url}#page=${s.source.page}` : s.source.url);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(tid(page, `compare-spec-source-${id}`).getByTestId('compare-unreviewed')).toHaveCount(s.reviewed ? 0 : 1);
    }
    const anyDraft = PRODUCT_IDS.some((id) => !specs.products[id].reviewed);
    await expect(tid(page, 'compare-page').getByTestId('compare-unreviewed').first()).toBeVisible({ visible: anyDraft });

    // 차이만 보기: 출처 행은 항상 남음
    await tid(page, 'compare-diff-only').click();
    await expect(tid(page, 'compare-row-spec-source')).toBeVisible();
  });

  test('없는 id·중복 → 안내 후 나머지만 비교', async ({ page }) => {
    test.skip(!productCompareReady, '지정 제품 없음');
    await page.goto(`./#/compare?type=product&ids=${PRODUCT_IDS[0]},NOPE999,${PRODUCT_IDS[1]},${PRODUCT_IDS[0]}`);
    await expect(tid(page, 'compare-notice')).toContainText('NOPE999');
    await expect(tid(page, 'compare-table').getByTestId(/^compare-col-/)).toHaveCount(2);
    // 1개만 남으면 빈 상태 + 안내
    await page.goto(`./#/compare?type=equipment&ids=${equipment[0].id},no-such-eq`);
    await expect(tid(page, 'compare-notice')).toContainText('no-such-eq');
    await expect(tid(page, 'compare-empty')).toBeVisible();
  });

  test('모바일 390px: 비교 표 가로 넘침 0, 상세 시트 열면 비교 바 접힘 · 펼치면 숨김', async ({ page }) => {
    test.skip(!pair || !productCompareReady, '데이터 없음');
    const [a, b] = pair!;
    await page.setViewportSize({ width: 390, height: 844 });
    await seedCompare(page, { equipment: [a.eq.id, b.eq.id], product: [], active: 'equipment' });

    await page.goto(`./#/compare?type=product&ids=${PRODUCT_IDS.join(',')}`);
    await expect(tid(page, 'compare-table')).toBeVisible();
    expect(await noHorizontalOverflow(page)).toBe(true);

    await gotoHome(page);
    await expect(tid(page, 'compare-tray')).toBeVisible();
    await expect(tid(page, `compare-tray-item-${a.eq.id}`)).toBeVisible();
    expect(await noHorizontalOverflow(page)).toBe(true);

    await tid(page, `diagram-node-${a.node.id}`).click();
    await expect(tid(page, 'detail-panel')).toHaveAttribute('data-variant', 'sheet');
    await expect(tid(page, `compare-tray-item-${a.eq.id}`)).toBeHidden(); // 접힘: 칩·비우기 숨김, 비교하기만
    await expect(tid(page, 'compare-clear')).toBeHidden();
    await expect(tid(page, 'compare-go')).toBeVisible();
    expect(await noHorizontalOverflow(page)).toBe(true);

    await tid(page, 'detail-panel').getByRole('button', { name: /전체 정보 보기/ }).click();
    await expect(tid(page, 'compare-tray')).toBeHidden();
  });

  test('(v1.0 M6) 사양 청크를 못 받으면 spec-error 행 + 안내, 기본 정보는 그대로', async ({ page }) => {
    test.skip(!productCompareReady, '지정 제품 없음');
    await page.route(/\/assets\/specs-[^/]*\.js(\?.*)?$/, (r) => r.abort());
    await page.goto(`./#/compare?type=product&ids=${PRODUCT_IDS.join(',')}`);
    await expect(tid(page, 'compare-row-spec-error')).toBeVisible();
    await expect(tid(page, 'compare-notice')).toContainText('사양 데이터를 불러오지 못했습니다');
    await expect(tid(page, 'compare-row-equipment')).toBeVisible();
    await expect(tid(page, 'compare-row-spec-ratedVoltage')).toHaveCount(0);
    await expect(tid(page, 'compare-row-spec-source')).toHaveCount(0);
  });

  test('(v1.0 L3) 공유 링크에서 열 빼기 → 주소만 갱신, 내 담기 목록은 그대로', async ({ page }) => {
    const ids = nodes.map((n) => n.equipmentTypeId).filter((v, i, arr) => arr.indexOf(v) === i);
    test.skip(ids.length < 5, '기기 부족');
    const mine = { equipment: [ids[0], ids[1]], product: [], active: 'equipment' as const };
    await seedCompare(page, mine);
    await page.goto(`./#/compare?type=equipment&ids=${ids[2]},${ids[3]},${ids[4]}`);
    await tid(page, `compare-remove-${ids[3]}`).click();
    await expect(page).toHaveURL(new RegExp(`ids=${ids[2]},${ids[4]}$`));
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lse-compare-v1') ?? 'null'));
    expect(stored.equipment).toEqual(mine.equipment);
  });

  test('(v1.0) /compare/ 끝 슬래시도 비교 화면 — 비교 바 숨김', async ({ page }) => {
    test.skip(!pair, '데이터 없음');
    const [a, b] = pair!;
    await seedCompare(page, { equipment: [a.eq.id, b.eq.id], product: [], active: 'equipment' });
    await page.goto(`./#/compare/?type=equipment&ids=${a.eq.id},${b.eq.id}`);
    await expect(tid(page, 'compare-table')).toBeVisible();
    await expect(tid(page, 'compare-tray')).toHaveCount(0);
  });

  test('(v1.0 M8) 공통 소속 기기가 있는 제품(P01024 + P01021) → "서로 다른 기기" 안내 없음', async ({ page }) => {
    test.skip(!productIds.has('P01024') || !productIds.has('P01021'), '제품 없음');
    await page.goto('./#/compare?type=product&ids=P01024,P01021');
    await expect(tid(page, 'compare-table')).toBeVisible();
    await expect(page.getByText('서로 다른 기기의 제품')).toHaveCount(0);
  });

  test('(v1.0 M5 · 2026-11-19) 넓은 화면: 표 안쪽 스크롤 없음(본문 스크롤 하나), 세로로 내려도 열 머리글이 본문 위에 붙어 있음', async ({ page }) => {
    test.skip(!productCompareReady, '지정 제품 없음');
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto(`./#/compare?type=product&ids=${PRODUCT_IDS.join(',')}`);
    const col = tid(page, `compare-col-${PRODUCT_IDS[0]}`);
    await expect(col).toBeVisible();
    expect(await col.evaluate((el) => getComputedStyle(el).position)).toBe('sticky');
    // 표 상자는 스크롤 상자가 아니다 (창 안의 창 없음)
    expect(await page.locator('.cmp-scroll').evaluate((el) => getComputedStyle(el).overflowY)).toBe('visible');
    const scrolled = await page.locator('#main').evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      return el.scrollTop;
    });
    expect(scrolled, '본문이 세로로 스크롤되지 않음 (측정 불가)').toBeGreaterThan(0);
    const gap = await page.evaluate((id) => {
      const box = document.getElementById('main')!.getBoundingClientRect();
      const th = document.querySelector(`[data-testid="compare-col-${id}"]`)!.getBoundingClientRect();
      return Math.abs(th.top - box.top);
    }, PRODUCT_IDS[0]);
    expect(gap).toBeLessThanOrEqual(2);
  });

  for (const width of [901, 920, 1024, 1100, 1280]) {
    test(`(v1.0 H1) 비교 바 폭 ${width}px: 글자 세로 쪼개짐 없음 (바 안 요소 높이 ≤ 40px, 패널 닫힘·열림)`, async ({ page }) => {
      test.skip(longEq.length < 4 || longProd.length < 4 || !pair, '데이터 부족');
      await page.setViewportSize({ width, height: 900 });
      await seedCompare(page, { equipment: longEq, product: longProd, active: 'equipment' });
      for (const query of ['', `?node=${pair![0].node.id}`]) {
        await gotoHome(page, query);
        await expect(tid(page, 'compare-tray')).toBeVisible();
        const tall = await tid(page, 'compare-tray').evaluate((tray) =>
          [...tray.querySelectorAll<HTMLElement>('button, a, li, strong, span')]
            .filter((el) => el.offsetParent !== null)
            .map((el) => ({ t: (el.textContent ?? '').trim().slice(0, 20), h: Math.round(el.getBoundingClientRect().height) }))
            .filter((x) => x.h > 40),
        );
        expect(tall, `${width}px ${query || '패널 닫힘'}`).toEqual([]);
        const tray = await tid(page, 'compare-tray').boundingBox();
        expect(tray!.width, '바 폭이 너무 좁음').toBeGreaterThanOrEqual(280);
      }
    });
  }

  test('(v1.0 M2) 모바일: --cmp-tray-h = 바 실측 높이, 본문 끝까지 스크롤하면 마지막 링크가 바에 가리지 않음', async ({ page }) => {
    test.skip(longEq.length < 4, '데이터 부족');
    await page.setViewportSize({ width: 390, height: 844 });
    await seedCompare(page, { equipment: longEq, product: longProd, active: 'equipment' });
    await page.goto('./#/gap');
    await expect(tid(page, 'gap-page')).toBeVisible();
    await expect(tid(page, 'compare-tray')).toBeVisible();
    const m = await page.evaluate(() => {
      const tray = document.querySelector('[data-testid="compare-tray"]')!.getBoundingClientRect();
      const v = getComputedStyle(document.documentElement).getPropertyValue('--cmp-tray-h').trim();
      const main = document.querySelector<HTMLElement>('.app-main')!;
      main.scrollTop = main.scrollHeight;
      const links = [...main.querySelectorAll<HTMLElement>('a, button')].filter((el) => el.offsetParent !== null);
      const last = links[links.length - 1].getBoundingClientRect();
      const trayAfter = document.querySelector('[data-testid="compare-tray"]')!.getBoundingClientRect();
      return { v, trayH: tray.height, lastBottom: last.bottom, trayTop: trayAfter.top };
    });
    expect(Math.abs(parseFloat(m.v) - m.trayH)).toBeLessThanOrEqual(1);
    expect(m.lastBottom).toBeLessThanOrEqual(m.trayTop);
    expect(await noHorizontalOverflow(page)).toBe(true);
  });

  test('Gap 모드 후보 안내(gap-candidate-note) = 공백 후보가 있을 때만 (데이터 기반)', async ({ page }) => {
    await gotoHome(page, '?mode=gap');
    await expect(tid(page, 'diagram')).toHaveAttribute('data-view-mode', 'gap');
    await expect(tid(page, 'gap-candidate-note')).toHaveCount(hasCandidate ? 1 : 0);
  });
});

// ─────────────────────────────────────────────────────────────
// v1.1 사양 옵션 (variants)
// ─────────────────────────────────────────────────────────────
/** 옵션 선택 열의 key → 표기 문자열 (공통 + 옵션, 같은 key 는 옵션 우선) */
function variantColumn(pid: string, vid: string): Map<string, string> {
  const sp = specs.products[pid];
  const v = sp.variants!.find((x) => x.id === vid)!;
  const m = new Map<string, string>();
  for (const i of sp.items) if (!v.items.some((x) => x.key === i.key)) m.set(i.key, `${i.value}|${i.unit ?? ''}`);
  for (const i of v.items) m.set(i.key, `${i.value}|${i.unit ?? ''}`);
  return m;
}
const OPT_PID = 'P01900';
const OPT_A = 'ts250';
const OPT_B = 'ts800';
const optReady = !!specs.products[OPT_PID]?.variants?.some((v) => v.id === OPT_A) && !!specs.products[OPT_PID]?.variants?.some((v) => v.id === OPT_B);
const DETAIL_PID = 'P00206';
const detailSpecs = specs.products[DETAIL_PID];
/** 시리즈 전체 열에서 값이 6개(FOLD_LIMIT) 넘는 key 가 있는 제품·key (더 보기 접기) */
const FOLD_LIMIT = 6;
const foldTarget = (() => {
  for (const [pid, sp] of Object.entries(specs.products)) {
    if (!productIds.has(pid) || !sp.variants?.length) continue;
    for (const key of orderKeys(allKeysOf(pid))) {
      const n = allKeysOf(pid).filter((k) => k === key).length;
      if (n > FOLD_LIMIT) return { pid, key, n };
    }
  }
  return undefined;
})();
const otherProduct = [...productIds].find((id) => id !== foldTarget?.pid && specs.products[id]);

test.describe('E2E-8 사양 옵션 (v1.1)', () => {
  test('제품 상세: 정격 사양 ready, 옵션 열 = 데이터 옵션 수, 셀 페이지 링크 #page=, 옵션 담기 → 비교 바 "제품명 · 옵션"', async ({ page }) => {
    test.skip(!detailSpecs?.variants?.length || !productIds.has(DETAIL_PID), '옵션 데이터 없음');
    const vs = detailSpecs.variants!;
    await page.goto(`./#/product/${DETAIL_PID}`);
    await expect(tid(page, 'product-specs')).toHaveAttribute('data-state', 'ready');
    await expect(tid(page, 'product-specs').getByTestId(/^product-spec-variant-/)).toHaveCount(vs.length);
    for (const v of vs) await expect(tid(page, `product-spec-variant-${v.id}`)).toContainText(v.label);
    // 출처 쪽은 한 번만 표시(2026-11-18 표 정리) — 그래도 값마다의 쪽(item.page ?? variant.page)은 모두
    // 섹션 안 어딘가의 링크(source.url#page=N)로 추적 가능해야 한다 (출처 줄·블록 제목·열 머리·칸 중 하나)
    const pages = new Set(vs.flatMap((v) => v.items.map((i) => i.page ?? v.page)).filter((x): x is number => !!x));
    const links = tid(page, 'product-specs').locator('a[href*="#page="]');
    const hrefs = await links.evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
    expect(hrefs.every((h) => h.startsWith(`${detailSpecs.source.url}#page=`))).toBe(true);
    for (const pg of pages) expect(hrefs, `p.${pg} 링크`).toContain(`${detailSpecs.source.url}#page=${pg}`);
    if (!detailSpecs.reviewed) await expect(tid(page, 'product-specs-unreviewed')).toBeVisible();

    const v0 = vs[0];
    const toggle = tid(page, `compare-toggle-${DETAIL_PID}:${v0.id}`);
    await expect(toggle).toContainText('비교');
    await expect(toggle).toHaveAccessibleName(`비교: ${v0.label} 옵션 담기`);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const productName = await page.getByRole('heading', { level: 1 }).first().innerText();
    await expect(tid(page, `compare-tray-item-${DETAIL_PID}:${v0.id}`)).toContainText(`${productName.trim()} · ${v0.label}`);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lse-compare-v1') ?? 'null'));
    expect(stored.product).toEqual([`${DETAIL_PID}:${v0.id}`]);
  });

  test('제품 상세: 사양 청크 실패 → 정격 사양 섹션에 안내 (data-state=error)', async ({ page }) => {
    test.skip(!productIds.has(DETAIL_PID), '제품 없음');
    await page.route(/\/assets\/specs-[^/]*\.js(\?.*)?$/, (r) => r.abort());
    await page.goto(`./#/product/${DETAIL_PID}`);
    await expect(tid(page, 'product-page')).toBeVisible();
    await expect(tid(page, 'product-specs')).toHaveAttribute('data-state', 'error');
    await expect(tid(page, 'product-specs')).toContainText('사양 데이터를 불러오지 못했습니다');
  });

  test('같은 제품 옵션 2개 비교: 열 2, 차이만 보기 → 값이 다른 사양 행 + 출처 행만 (데이터 계산)', async ({ page }) => {
    test.skip(!optReady, '옵션 데이터 없음');
    await page.goto(`./#/compare?type=product&ids=${OPT_PID}:${OPT_A},${OPT_PID}:${OPT_B}`);
    await expect(tid(page, 'compare-table').getByTestId(/^compare-col-/)).toHaveCount(2);
    await expect(tid(page, `compare-col-${OPT_PID}:${OPT_A}`)).toBeVisible();
    const a = variantColumn(OPT_PID, OPT_A);
    const b = variantColumn(OPT_PID, OPT_B);
    const keys = orderKeys([...a.keys(), ...b.keys()]);
    const differing = keys.filter((k) => a.get(k) !== b.get(k));
    expect(differing.length, '두 옵션이 다른 사양 행이 없음').toBeGreaterThan(0); // v1.1 당시 = 정격전류·정격차단전류·프레임 (데이터로 계산)
    await tid(page, 'compare-diff-only').click();
    await expect(tid(page, 'compare-section-basic')).toHaveCount(0); // 같은 제품 → 기본 정보 모두 같음
    const shown = await tid(page, 'compare-section-specs')
      .getByTestId(/^compare-row-/)
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.replace('compare-row-', '')));
    expect(shown).toEqual([...differing.map((k) => `spec-${k}`), 'spec-source']);
  });

  test('옵션 select: 바꾸면 URL 갱신, 다른 열이 쓰는 조합은 비활성', async ({ page }) => {
    test.skip(!optReady, '옵션 데이터 없음');
    const other = specs.products[OPT_PID].variants!.find((v) => v.id !== OPT_A && v.id !== OPT_B)!;
    await page.goto(`./#/compare?type=product&ids=${OPT_PID}:${OPT_A},${OPT_PID}:${OPT_B}`);
    const sel = tid(page, `compare-variant-select-${OPT_PID}:${OPT_A}`);
    await expect(sel).toHaveValue(OPT_A);
    await expect(sel.locator(`option[value="${OPT_B}"]`)).toBeDisabled();
    await expect(sel.locator(`option[value="${other.id}"]`)).toBeEnabled();
    await expect(sel.locator('option[value=""]')).toBeEnabled();
    await sel.selectOption(other.id);
    await expect(page).toHaveURL(new RegExp(`ids=${OPT_PID}:${other.id},${OPT_PID}:${OPT_B}$`));
    await expect(tid(page, `compare-col-${OPT_PID}:${other.id}`)).toBeVisible();
    // 시리즈 전체로
    await tid(page, `compare-variant-select-${OPT_PID}:${OPT_B}`).selectOption('');
    await expect(page).toHaveURL(new RegExp(`ids=${OPT_PID}:${other.id},${OPT_PID}$`));
  });

  test('사양에 없는 옵션 id → 시리즈 전체 열 + 안내', async ({ page }) => {
    test.skip(!optReady || !productCompareReady, '데이터 없음');
    await page.goto(`./#/compare?type=product&ids=${OPT_PID}:no-such-opt,${PRODUCT_IDS[0]}`);
    await expect(tid(page, 'compare-notice')).toContainText('no-such-opt');
    await expect(tid(page, `compare-col-${OPT_PID}`)).toBeVisible();
    await expect(tid(page, `compare-variant-select-${OPT_PID}`)).toHaveValue('');
  });

  test('시리즈 전체 열: 옵션 값이 6개 넘는 칸은 "더 보기"로 접고 펼침', async ({ page }) => {
    test.skip(!foldTarget || !otherProduct, '접을 데이터 없음');
    const { pid, key, n } = foldTarget!;
    await page.goto(`./#/compare?type=product&ids=${pid},${otherProduct}`);
    const cell = tid(page, `compare-row-spec-${key}`).getByRole('cell').first();
    const more = cell.getByTestId('compare-spec-more');
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await expect(cell.getByRole('listitem')).toHaveCount(FOLD_LIMIT);
    await expect(more).toContainText(`${n - FOLD_LIMIT}`);
    await more.click();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(cell.getByRole('listitem')).toHaveCount(n);
    await more.click();
    await expect(cell.getByRole('listitem')).toHaveCount(FOLD_LIMIT);
  });
});
