/**
 * E2E 핵심 시나리오 (Playwright) — docs/test-plan.md §4, §5 와 대응
 *
 * 전제 (playwright.config.ts):
 *  - webServer: `npm run build && npm run preview` (GitHub Pages 와 같은 정적 빌드 + base './' 검증)
 *  - baseURL: http://localhost:4173/  (Pages 서브경로 검증 프로젝트는 /LSE_News/ 로 별도)
 *  - projects: desktop-chromium(1440x900), mobile(390x844, iPhone 13), dark(colorScheme: 'dark')
 *  - devDependency: @playwright/test, @axe-core/playwright
 *
 * 셀렉터 규칙: data-testid 만 사용 (문구/스타일 변경에 깨지지 않도록). 목록은 test-plan.md §7.
 * 테스트 데이터: 기기 id 를 하드코딩하지 않고 src/data/*.json 에서 커버리지별로 골라 쓴다.
 *
 * Phase 2 게이트: 계통도 UI(data-testid="diagram")가 아직 없으면 이 파일의 테스트는 전부 skip 된다.
 *   UI 가 생기면 자동으로 활성화. 게이트를 끄고 강제 실행하려면 E2E_STRICT=1 npm run test:e2e
 *   (주의: 회귀로 diagram testid 가 사라져도 skip 으로 보이므로 Phase 2 완료 후 CI 에서는 E2E_STRICT=1 권장)
 *
 * 리더 결정 반영: R-04(자료 없음 → 공식 페이지 링크), R-07(power 실선 / signal 점선),
 *   R-08(Gap 강조 규칙), R-09(?mode=gap|learn URL 공유)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ─────────────────────────────────────────────────────────────
// 테스트 데이터 (JSON 직접 읽기 — 앱 코드 import 없이 독립적으로)
// ─────────────────────────────────────────────────────────────
type Coverage = 'owned' | 'partial' | 'affiliate' | 'missing' | 'na';
interface Eq {
  id: string;
  name: string;
  abbr?: string;
  layer: string;
  coverage: Coverage;
  lseCategoryCodes: string[];
  productIds?: string[];
  gapNote?: string;
  affiliateName?: string;
}
interface DNode {
  id: string;
  equipmentTypeId: string;
}
interface Prod {
  id: string;
  name: string;
  url: string;
  docs: { type: string; url: string }[];
}

const dataPath = (f: string) => fileURLToPath(new URL(`../../src/data/${f}`, import.meta.url));
const load = <T>(f: string): T => JSON.parse(readFileSync(dataPath(f), 'utf8')) as T;

const equipment = load<Eq[]>('equipment-types.json');
const diagram = load<{ nodes: DNode[] }>('diagram.json');
const products = load<Prod[]>('products.json');
const eqById = new Map(equipment.map((e) => [e.id, e]));

/** 해당 커버리지 기기를 가진 첫 노드 (없으면 테스트 skip) */
function nodeWith(coverage: Coverage, extra: (e: Eq) => boolean = () => true): { node: DNode; eq: Eq } | undefined {
  for (const node of diagram.nodes) {
    const eq = eqById.get(node.equipmentTypeId);
    if (eq && eq.coverage === coverage && extra(eq)) return { node, eq };
  }
  return undefined;
}
const hasDirectProducts = (e: Eq) => (e.productIds?.length ?? 0) > 0;
const productWithDocs = products.find((p) => p.docs.length > 0);
const productWithoutDocs = products.find((p) => p.docs.length === 0);
const edges = load<{ edges: { id: string; kind?: 'power' | 'signal' }[] }>('diagram.json').edges;
const powerEdge = edges.find((e) => (e.kind ?? 'power') === 'power');
const signalEdge = edges.find((e) => e.kind === 'signal');

// Phase 2 게이트 (상단 주석 참고)
test.beforeEach(async ({ page }) => {
  if (process.env.E2E_STRICT) return;
  await page.goto('./#/');
  const ready = (await page.getByTestId('diagram').count()) > 0;
  test.skip(!ready, 'Phase 2 계통도 UI(data-testid="diagram") 미구현 — E2E_STRICT=1 로 강제 실행');
});

// ─────────────────────────────────────────────────────────────
// 셀렉터 헬퍼 (testid 이름은 여기서만 조립)
// ─────────────────────────────────────────────────────────────
const tid = (page: Page, id: string): Locator => page.getByTestId(id);
const diagramNode = (page: Page, nodeId: string) => tid(page, `diagram-node-${nodeId}`);
const panel = (page: Page) => tid(page, 'detail-panel');

async function gotoHome(page: Page) {
  await page.goto('./#/');
  await expect(tid(page, 'diagram')).toBeVisible();
}

/** 줌/패닝 상태와 무관하게 노드를 클릭 (계층 점프로 먼저 해당 계층으로 이동) */
async function clickNode(page: Page, nodeId: string, layer: string) {
  const nav = tid(page, `layer-nav-${layer}`);
  if (await nav.isVisible()) await nav.click();
  await diagramNode(page, nodeId).click();
}

// ═════════════════════════════════════════════════════════════
// E2E-1 신입 학습 흐름: 교육 모드 → 투어 L1→L7 → 기기 학습 포인트
// ═════════════════════════════════════════════════════════════
test.describe('E2E-1 신입 학습 흐름', () => {
  test('교육 모드 투어가 L1부터 L7까지 순서대로 진행되고, 기기 클릭 시 학습 포인트가 보인다', async ({ page }) => {
    await gotoHome(page);
    await tid(page, 'view-mode-learn').click();
    await expect(tid(page, 'view-mode-learn')).toHaveAttribute('aria-pressed', 'true');

    await tid(page, 'tour-start').click();
    const step = tid(page, 'tour-step');
    await expect(step).toBeVisible();

    const visited: string[] = [];
    for (let i = 0; i < 20; i++) {
      const layer = await step.getAttribute('data-layer');
      if (layer && visited.at(-1) !== layer) visited.push(layer);
      // 현재 단계 계층 밴드가 화면 안에 들어와 있어야 함
      if (layer) await expect(tid(page, `layer-band-${layer}`)).toBeInViewport({ ratio: 0.3 });
      const next = tid(page, 'tour-next');
      if (!(await next.isEnabled())) break;
      await next.click();
    }
    const main = visited.filter((l) => /^L[1-7]$/.test(l));
    expect(main[0]).toBe('L1');
    expect(main.at(-1)).toBe('L7');
    expect([...main].sort()).toEqual(main); // 역행 없음

    const target = nodeWith('owned');
    test.skip(!target, 'owned 노드 데이터 없음');
    await tid(page, 'tour-close').click();
    await clickNode(page, target!.node.id, target!.eq.layer);
    await expect(panel(page)).toBeVisible();
    await expect(tid(page, 'detail-learn-points').locator('li').first()).toBeVisible();
  });
});

// ═════════════════════════════════════════════════════════════
// E2E-2 영업: 검색 → 기기 → 제품 → 데이터시트 (새 탭, 공식 사이트)
// ═════════════════════════════════════════════════════════════
test.describe('E2E-2 영업 데이터시트 찾기', () => {
  test('약어 검색 → 결과 선택 → 상세 패널 → 제품 페이지 → 자료 링크가 새 탭으로 열린다', async ({ page }) => {
    const target = nodeWith('owned', (e) => !!e.abbr && hasDirectProducts(e));
    test.skip(!target, 'abbr + productIds 를 가진 owned 기기 데이터 없음');
    const { node, eq } = target!;

    await gotoHome(page);
    await tid(page, 'search-input').fill(eq.abbr!);
    const results = tid(page, 'search-results');
    await expect(results).toBeVisible();
    await results.getByTestId(`search-result-equipment-${eq.id}`).click();

    // 검색 결과 선택 → 해당 노드 선택 상태 + 패널 열림
    await expect(diagramNode(page, node.id)).toHaveAttribute('aria-pressed', 'true');
    await expect(panel(page)).toBeVisible();
    await expect(tid(page, 'detail-title')).toContainText(eq.name);
    await expect(tid(page, 'detail-coverage-badge')).toHaveAttribute('data-coverage', 'owned');

    const firstProductId = eq.productIds![0];
    await tid(page, `product-card-${firstProductId}`).click();
    await expect(page).toHaveURL(new RegExp(`#/product/${firstProductId}$`));
    await expect(tid(page, 'product-page')).toBeVisible();

    // 공식 제품 페이지 링크: 새 탭 + noopener
    const official = tid(page, 'product-official-link');
    await expect(official).toHaveAttribute('href', /^https:\/\/www\.ls-electric\.com\//);
    await expect(official).toHaveAttribute('target', '_blank');
    await expect(official).toHaveAttribute('rel', /noopener/);

    const prod = products.find((p) => p.id === firstProductId)!;
    if (prod.docs.length > 0) {
      const doc = tid(page, 'doc-link').first();
      await expect(doc).toHaveAttribute('target', '_blank');
      await expect(doc).toHaveAttribute('rel', /noopener/);
      await expect(doc).toHaveAttribute('href', /ls-electric\.com/);
      // 실제 새 탭 이벤트 (외부 사이트 로딩은 기다리지 않음)
      const [popup] = await Promise.all([page.waitForEvent('popup'), doc.click()]);
      expect(popup.url()).toMatch(/ls-electric\.com/);
      await popup.close();
    } else {
      await expect(tid(page, 'docs-empty')).toBeVisible(); // "자료 준비 중"
    }
  });

  test('검색 결과 없음 → 빈 상태 + 추천 표시, 오류 없음', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await gotoHome(page);
    await tid(page, 'search-input').fill('zzqx존재하지않는기기');
    await expect(tid(page, 'search-empty')).toBeVisible();
    await expect(tid(page, 'search-suggestions')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════
// E2E-3 기획: Gap 모드 → 공백 강조 → 공백 기기 상세 → /gap 매트릭스
// ═════════════════════════════════════════════════════════════
test.describe('E2E-3 기획 Gap 확인', () => {
  test('Gap 모드(R-08): missing·partial 강조, owned·na 흐림, affiliate 보통 + 공백 기기 패널은 공백 사유', async ({ page }) => {
    const missing = nodeWith('missing');
    const owned = nodeWith('owned');
    test.skip(!missing || !owned, 'missing/owned 노드 데이터 없음');

    await gotoHome(page);
    await tid(page, 'view-mode-gap').click();
    await expect(tid(page, 'diagram')).toHaveAttribute('data-view-mode', 'gap');

    await expect(diagramNode(page, missing!.node.id)).toHaveAttribute('data-emphasized', 'true');
    await expect(diagramNode(page, owned!.node.id)).toHaveAttribute('data-dimmed', 'true');
    // R-08 나머지 상태 (데이터에 있을 때만)
    const partial = nodeWith('partial');
    if (partial) await expect(diagramNode(page, partial.node.id)).toHaveAttribute('data-emphasized', 'true');
    const na = nodeWith('na');
    if (na) await expect(diagramNode(page, na.node.id)).toHaveAttribute('data-dimmed', 'true');
    const aff = nodeWith('affiliate');
    if (aff) {
      await expect(diagramNode(page, aff.node.id)).toHaveAttribute('data-emphasized', 'false');
      await expect(diagramNode(page, aff.node.id)).toHaveAttribute('data-dimmed', 'false');
    }

    // 색약 대응: 색 외에 아이콘이 함께 렌더링
    await expect(diagramNode(page, missing!.node.id).getByTestId('coverage-icon-missing')).toBeVisible();

    await clickNode(page, missing!.node.id, missing!.eq.layer);
    await expect(tid(page, 'detail-coverage-badge')).toHaveAttribute('data-coverage', 'missing');
    await expect(tid(page, 'detail-gap-note')).toBeVisible();
    await expect(tid(page, 'detail-product-list')).toHaveCount(0);
    await expect(tid(page, 'detail-empty-products')).toBeVisible(); // "자사 제품 미보유(공백)" — 오류 아님
  });

  test('/gap 페이지의 공백 건수가 데이터의 missing 기기 수와 일치한다', async ({ page }) => {
    await page.goto('./#/gap');
    await expect(tid(page, 'gap-page')).toBeVisible();
    await expect(tid(page, 'gap-matrix')).toBeVisible();
    const expected = equipment.filter((e) => e.coverage === 'missing').length;
    await expect(tid(page, 'gap-list').getByTestId(/^gap-item-/)).toHaveCount(expected);
  });

  test('R-09 보기 모드 URL 공유: ?mode=gap / ?mode=learn 으로 열면 해당 모드, 토글 시 URL 갱신', async ({ page }) => {
    await page.goto('./#/?mode=gap');
    await expect(tid(page, 'diagram')).toHaveAttribute('data-view-mode', 'gap');
    await expect(tid(page, 'view-mode-gap')).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(tid(page, 'diagram')).toHaveAttribute('data-view-mode', 'gap');

    await tid(page, 'view-mode-learn').click();
    await expect(page).toHaveURL(/[?&]mode=learn/);
    await page.goto('./#/?mode=learn');
    await expect(tid(page, 'diagram')).toHaveAttribute('data-view-mode', 'learn');
  });

  test('affiliate 기기 패널에 계열사명이 표시된다', async ({ page }) => {
    const aff = nodeWith('affiliate');
    test.skip(!aff, 'affiliate 노드 데이터 없음');
    await gotoHome(page);
    await clickNode(page, aff!.node.id, aff!.eq.layer);
    await expect(tid(page, 'detail-affiliate-name')).toContainText(aff!.eq.affiliateName ?? '');
  });
});

// ═════════════════════════════════════════════════════════════
// E2E-4 라우팅: 해시 딥링크·새로고침·뒤로가기·없는 id
// ═════════════════════════════════════════════════════════════
test.describe('E2E-4 해시 라우팅', () => {
  test('기기 딥링크를 새로고침해도 같은 화면 (GitHub Pages 404 회피)', async ({ page }) => {
    const any = diagram.nodes[0] && eqById.get(diagram.nodes[0].equipmentTypeId);
    test.skip(!any, '기기 데이터 없음');
    await page.goto(`./#/equipment/${any!.id}`);
    await expect(tid(page, 'equipment-page')).toBeVisible();
    await page.reload();
    await expect(tid(page, 'equipment-page')).toBeVisible();
    await expect(tid(page, 'equipment-title')).toContainText(any!.name);
  });

  test('제품 딥링크 새로고침 + 브라우저 뒤로가기로 이전 화면 복귀', async ({ page }) => {
    const p = products[0];
    await gotoHome(page);
    await page.goto(`./#/product/${p.id}`);
    await page.reload();
    await expect(tid(page, 'product-page')).toBeVisible();
    await page.goBack();
    await expect(tid(page, 'diagram')).toBeVisible();
  });

  test('존재하지 않는 id → not-found 안내 (흰 화면/크래시 아님)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('./#/equipment/__no_such_id__');
    await expect(tid(page, 'not-found')).toBeVisible();
    await page.goto('./#/product/P99999');
    await expect(tid(page, 'not-found')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('정적 자산이 상대경로로 로드된다 (base "./" — 같은 출처 4xx/5xx 없음)', async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? 'http://localhost:4173/').origin;
    const failed: string[] = [];
    page.on('response', (r) => {
      if (r.status() >= 400 && r.url().startsWith(origin)) failed.push(`${r.status()} ${r.url()}`);
    });
    await gotoHome(page);
    expect(failed).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════
// E2E-5 접근성·반응형: 키보드, 계층 점프, 모바일 하단 시트, 다크모드 대비
// ═════════════════════════════════════════════════════════════
test.describe('E2E-5 접근성·반응형', () => {
  test('키보드만으로 노드 선택(Enter) → 패널 열림 → Esc 로 닫고 포커스가 노드로 복귀', async ({ page }) => {
    const t = nodeWith('owned') ?? nodeWith('missing');
    test.skip(!t, '노드 데이터 없음');
    await gotoHome(page);
    const node = diagramNode(page, t!.node.id);
    await expect(node).toHaveAttribute('tabindex', '0');
    await expect(node).toHaveAttribute('role', 'button');
    await expect(node).toHaveAttribute('aria-label', new RegExp(t!.eq.name)); // 이름 + 커버리지 상태 읽힘
    await node.focus();
    await page.keyboard.press('Enter');
    await expect(panel(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel(page)).toBeHidden();
    await expect(node).toBeFocused();
  });

  test('Tab 순서: 건너뛰기 링크 → 검색 → 보기 모드 → 계층 내비 → 계통도 노드', async ({ page }) => {
    await gotoHome(page);
    await page.keyboard.press('Tab');
    await expect(tid(page, 'skip-to-diagram')).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveAttribute('data-testid', /^diagram-node-/);
  });

  test('계층 점프: L5 클릭 → L5 밴드가 화면 안으로 이동, 내비에 현재 계층 표시', async ({ page }) => {
    await gotoHome(page);
    await tid(page, 'layer-nav-L5').click();
    await expect(tid(page, 'layer-band-L5')).toBeInViewport({ ratio: 0.5 });
    await expect(tid(page, 'layer-nav-L5')).toHaveAttribute('aria-current', 'true');
  });

  test('R-07 연결선: power = 굵은 실선, signal = 가는 점선', async ({ page }) => {
    test.skip(!powerEdge || !signalEdge, 'power/signal 엣지가 모두 있어야 비교 가능');
    await gotoHome(page);
    const style = async (id: string) => {
      const el = tid(page, `diagram-edge-${id}`);
      await expect(el).toHaveAttribute('data-kind', id === signalEdge!.id ? 'signal' : 'power');
      return el.evaluate((n) => {
        const cs = getComputedStyle(n as Element);
        return { width: parseFloat(cs.strokeWidth), dash: cs.strokeDasharray };
      });
    };
    const p = await style(powerEdge!.id);
    const s = await style(signalEdge!.id);
    expect(p.dash === 'none' || p.dash === '').toBe(true);
    expect(s.dash).not.toMatch(/^(none)?$/);
    expect(p.width).toBeGreaterThan(s.width);
  });

  test('범례에 5개 커버리지 상태가 색 + 아이콘으로 모두 표시', async ({ page }) => {
    await gotoHome(page);
    for (const c of ['owned', 'partial', 'affiliate', 'missing', 'na'] as const) {
      const item = tid(page, `legend-item-${c}`);
      await expect(item).toBeVisible();
      await expect(item.getByTestId(`coverage-icon-${c}`)).toBeVisible();
    }
  });

  test('모바일 폭(390px): 상세 패널이 하단 시트로 열리고 가로 스크롤 없음', async ({ page }) => {
    const t = nodeWith('owned') ?? nodeWith('missing');
    test.skip(!t, '노드 데이터 없음');
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoHome(page);
    await diagramNode(page, t!.node.id).click();
    const box = await panel(page).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(380); // 화면 폭 가득
    expect(box!.y).toBeGreaterThan(844 / 3); // 하단에서 올라옴
    await expect(panel(page)).toHaveAttribute('data-variant', 'sheet');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme} 모드 색 대비 (axe color-contrast, WCAG AA)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await gotoHome(page);
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const contrast = result.violations.filter((v) => v.id === 'color-contrast');
      expect(contrast.flatMap((v) => v.nodes.map((n) => n.target.join(' ')))).toEqual([]);
    });
  }
});

// ═════════════════════════════════════════════════════════════
// 자료 없음 상태 (현재 products.json docs 가 비어 있을 가능성 높음)
// ═════════════════════════════════════════════════════════════
test.describe('예외 상태', () => {
  test('R-04 자료 없는 제품 → "자료 준비 중" + 공식 제품 페이지 링크로 대체, 깨진 링크 없음', async ({ page }) => {
    test.skip(!productWithoutDocs, '모든 제품에 자료가 있음');
    await page.goto(`./#/product/${productWithoutDocs!.id}`);
    await expect(tid(page, 'docs-empty')).toBeVisible();
    await expect(tid(page, 'doc-link')).toHaveCount(0);
    const official = tid(page, 'product-official-link');
    await expect(official).toBeVisible();
    await expect(official).toHaveAttribute('href', productWithoutDocs!.url);
    await expect(official).toHaveAttribute('target', '_blank');
    await expect(official).toHaveAttribute('rel', /noopener/);
  });

  test('자료 있는 제품 → 자료 종류 배지(data-doc-type) 표시', async ({ page }) => {
    test.skip(!productWithDocs, '자료가 있는 제품 없음');
    await page.goto(`./#/product/${productWithDocs!.id}`);
    await expect(tid(page, 'doc-link')).toHaveCount(productWithDocs!.docs.length);
    await expect(tid(page, 'doc-link').first()).toHaveAttribute('data-doc-type', productWithDocs!.docs[0].type);
  });
});
