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
 * v0.4: Phase 2 게이트(diagram testid 없으면 전체 skip) 제거 — Phase 2~5 구현 완료. 회귀로 UI 가 사라지면
 *   skip 이 아니라 실패로 보여야 하므로. (E2E_STRICT 환경변수는 더 이상 쓰지 않음)
 * v0.4: 공백 표 기본 필터 = "전체"(리더 결정).
 * 2026-11-18 사용자 결정: 교육 탭(/learn 투어·교육 보기 모드) 제거 → E2E-1 은 "교육 탭 제거" 회귀 검증으로 대체.
 *
 * 리더 결정 반영: R-04(자료 없음 → 공식 페이지 링크), R-07(power 실선 / signal 점선),
 *   R-08(Gap 강조 규칙), R-09(?mode=gap URL 공유)
 * 사용자 확정(v0.3): Gap 버튼 = 같은 계통도 위 강조(/?mode=gap), 공백 표(/gap)는 좌측 내비 아래
 *   "공백 표 보기" 링크(data-testid="gap-table-link"), 노드 선택은 ?node=<nodeId> 로 복원.
 * 자료(docs)는 products.json 의 docs 가 아니라 src/data/docs.json 기준.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ─────────────────────────────────────────────────────────────
// 테스트 데이터 (JSON 직접 읽기 — 앱 코드 import 없이 독립적으로)
// ─────────────────────────────────────────────────────────────
type Coverage = 'owned' | 'partial' | 'affiliate' | 'sourced' | 'missing' | 'na';
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
  gapAssessment?: { supplyMode: string; basis: string; confidence: 'candidate' | 'confirmed'; reviewDue?: string };
}
/** v0.6 R3: kind 생략 = equipment (ref=true 는 참조 타일), bus·endpoint 는 equipmentTypeId 없음 */
interface DNode {
  id: string;
  kind?: 'equipment' | 'bus' | 'endpoint';
  equipmentTypeId?: string;
  ref?: boolean;
  label?: string;
  layer?: string;
}
interface Prod {
  id: string;
  name: string;
  url: string;
  categoryCode: string;
}
interface DocRef {
  type: string;
  title: string;
  url: string;
}
interface ProductDocs {
  source: 'www' | 'ssq';
  deepLink: string;
  docs: DocRef[];
}

const dataPath = (f: string) => fileURLToPath(new URL(`../../src/data/${f}`, import.meta.url));
const load = <T>(f: string): T => JSON.parse(readFileSync(dataPath(f), 'utf8')) as T;

const equipment = load<Eq[]>('equipment-types.json');
const diagramRaw = load<{ nodes: DNode[]; review?: { status: string } }>('diagram.json');
/** 74종 기기 노드 (참조 타일·모선·끝점 제외) — 기존 테스트는 이것만 대상으로 한다 */
const diagram = { nodes: diagramRaw.nodes.filter((n) => (n.kind ?? 'equipment') === 'equipment' && !n.ref) as (DNode & { equipmentTypeId: string })[] };
const refNodes = diagramRaw.nodes.filter((n) => (n.kind ?? 'equipment') === 'equipment' && n.ref);
const busNodes = diagramRaw.nodes.filter((n) => n.kind === 'bus');
const endpointNodes = diagramRaw.nodes.filter((n) => n.kind === 'endpoint');
const products = load<Prod[]>('products.json');
/**
 * v0.8 (개선 R5): 데이터 확정 상태에 따라 기대값을 계산 (고정 'candidate'·'pending' 가정 제거).
 * 화면 확신도 규칙(test-plan §7 / labels.gapConfidence 와 같은 계약, 앱 코드 import 없이 독립 구현):
 *   공백류(미보유·일부·계열사·패널 구성품)만 대상 · 근거 없음/후보/재확인 기한(KST) 지남 → candidate · 그 외 confirmed · 보유·해당 없음 → undefined
 */
const ASSESSED: Coverage[] = ['missing', 'partial', 'affiliate', 'sourced'];
const todayKst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const expectedConfidence = (e: Eq): 'candidate' | 'confirmed' | undefined => {
  if (!ASSESSED.includes(e.coverage)) return undefined;
  const g = e.gapAssessment;
  if (!g || g.confidence !== 'confirmed' || (g.reviewDue && g.reviewDue < todayKst())) return 'candidate';
  return 'confirmed';
};
const categories = load<{ code: string; productIds: string[] }[]>('categories.json');
const docsJson = load<{ products: Record<string, ProductDocs> }>('docs.json');
const eqById = new Map(equipment.map((e) => [e.id, e]));
const catByCode = new Map(categories.map((c) => [c.code, c]));

/** 자료 파일 허용 도메인: *.ls-electric.com + ssq 공식 대용량 파일 CDN (DI-62 와 같은 규칙) */
const ALLOWED_DOC_URL_RE = /^https:\/\/(([a-z0-9-]+\.)*ls-electric\.com|ssqfd-abhdhraad3gkgbcg\.a03\.azurefd\.net)\//i;
const docsOf = (productId: string): DocRef[] => docsJson.products[productId]?.docs ?? [];
/** 앱의 resolveProducts 와 같은 규칙 (v0.5 M3): productIds ∪ 카테고리 productIds ∪ 하위 카테고리(코드 접두사) 제품 */
function linkedProducts(e: Eq): string[] {
  const ids = new Set(e.productIds ?? []);
  for (const code of e.lseCategoryCodes) {
    catByCode.get(code)?.productIds.forEach((id) => ids.add(id));
    products.filter((p) => p.categoryCode.startsWith(code)).forEach((p) => ids.add(p.id));
  }
  return [...ids].filter((id) => products.some((p) => p.id === id));
}

/** 해당 커버리지 기기를 가진 첫 노드 (없으면 테스트 skip) */
function nodeWith(coverage: Coverage, extra: (e: Eq) => boolean = () => true): { node: DNode & { equipmentTypeId: string }; eq: Eq } | undefined {
  for (const node of diagram.nodes) {
    const eq = eqById.get(node.equipmentTypeId);
    if (eq && eq.coverage === coverage && extra(eq)) return { node, eq };
  }
  return undefined;
}
const hasDirectProducts = (e: Eq) => (e.productIds?.length ?? 0) > 0;
const productWithDocs = products.find((p) => docsOf(p.id).length > 0);
/** docs.json 에 항목 자체가 없는 제품 → 공식 제품 페이지 링크로 대체 (R-04) */
const productWithoutEntry = products.find((p) => !docsJson.products[p.id]);
/** docs.json 에 항목은 있으나 docs 가 빈 제품 → 공식 자료실 deepLink 로 대체 */
const productWithEmptyEntry = products.find((p) => docsJson.products[p.id] && docsOf(p.id).length === 0);
/**
 * 상세 패널·기기 페이지에 자료 링크가 보이는 기기: 연결 제품 중 docs.json 자료가 있는 제품이 있음
 * (DetailPanel = 자료 있는 첫 제품의 자료 최대 5건, EquipmentPage = 자료 있는 제품 최대 5개 × 3건)
 */
const nodeWithDocs = (() => {
  for (const node of diagram.nodes) {
    const eq = eqById.get(node.equipmentTypeId);
    if (!eq) continue;
    if (linkedProducts(eq).some((id) => docsOf(id).length > 0)) return { node, eq };
  }
  return undefined;
})();
/** equipment-images.json (v0.5 R2: thumb 160px = 계통도 타일, file 320px = 패널 큰 사진) */
const equipmentImages = load<Record<string, { file: string; thumb: string }>>('equipment-images.json');
const nodeWithImage = (() => {
  for (const node of diagram.nodes) {
    const eq = eqById.get(node.equipmentTypeId);
    if (eq && equipmentImages[eq.id]) return { node, eq };
  }
  return undefined;
})();
const edges = load<{ edges: { id: string; kind?: 'power' | 'signal' | 'alt'; label?: string }[] }>('diagram.json').edges;
const altEdges = edges.filter((e) => e.kind === 'alt');
const powerEdge = edges.find((e) => (e.kind ?? 'power') === 'power');
const signalEdge = edges.find((e) => e.kind === 'signal');


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
// E2E-1 교육 탭 제거 (2026-11-18 사용자 결정 — 교육용 포털이 아니라 제품맵)
//   헤더 모드 탭 = 제품·Gap, 옛 /learn 링크 → 계통도(/)로 replace 리디렉트, 옛 ?mode=learn → 제품 모드
// ═════════════════════════════════════════════════════════════
test.describe('E2E-1 교육 탭 제거', () => {
  test('헤더에 교육 탭 없음 — 보기 모드 탭은 제품·Gap 2개', async ({ page }) => {
    await gotoHome(page);
    await expect(tid(page, 'view-mode-product')).toBeVisible();
    await expect(tid(page, 'view-mode-gap')).toBeVisible();
    await expect(tid(page, 'view-mode-learn')).toHaveCount(0);
    await expect(page.getByRole('group', { name: '보기 모드' }).getByRole('button')).toHaveCount(2);
  });

  test('/learn?step=L4 (옛 링크) → 계통도(/)로 리디렉트 (쿼리 버림)', async ({ page }) => {
    await page.goto('./#/learn?step=L4');
    await expect(tid(page, 'diagram')).toBeVisible();
    await expect(page).toHaveURL(/#\/$/);
    await expect(tid(page, 'diagram')).toHaveAttribute('data-view-mode', 'product');
    await expect(page.getByTestId(/^(learn-page|tour-step|tour-start)$/)).toHaveCount(0);
  });

  test('?mode=learn (옛 링크) → 제품 모드로 열림, 교육 보기 안내 없음', async ({ page }) => {
    await page.goto('./#/?mode=learn');
    await expect(tid(page, 'diagram')).toHaveAttribute('data-view-mode', 'product');
    await expect(tid(page, 'view-mode-product')).toHaveAttribute('aria-pressed', 'true');
    await expect(tid(page, 'tour-start')).toHaveCount(0);
  });

  test('기기 상세 패널에 학습 포인트가 표시되지 않음', async ({ page }) => {
    const target = nodeWith('owned');
    test.skip(!target, 'owned 노드 데이터 없음');
    await gotoHome(page);
    await clickNode(page, target!.node.id, target!.eq.layer);
    await expect(tid(page, 'detail-title')).toContainText(target!.eq.name);
    await expect(tid(page, 'detail-learn-points')).toHaveCount(0);
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

    if (docsOf(firstProductId).length > 0) {
      const doc = tid(page, 'doc-link').first();
      await expect(doc).toHaveAttribute('target', '_blank');
      await expect(doc).toHaveAttribute('rel', /noopener/);
      await expect(doc).toHaveAttribute('href', ALLOWED_DOC_URL_RE);
      // 실제 새 탭 이벤트 (외부 사이트 로딩은 기다리지 않음 — 요청 자체를 차단)
      await page.context().route(/^https:\/\/(?!localhost)/, (r) => r.fulfill({ status: 200, contentType: 'text/plain', body: 'stub' }));
      const [popup] = await Promise.all([page.waitForEvent('popup'), doc.click()]);
      expect(popup.url()).toMatch(ALLOWED_DOC_URL_RE);
      await popup.close();
    } else {
      await expect(tid(page, 'docs-empty')).toBeVisible(); // "자료 준비 중"
    }
  });

  test('v0.5 R2: "iS7" + Enter → iS7 제품(P01188) 또는 저압 인버터 기기가 1순위 (초고압 GIS 아님)', async ({ page }) => {
    const is7 = products.find((p) => p.id === 'P01188');
    test.skip(!is7, 'P01188(iS7) 제품 데이터 없음');
    await gotoHome(page);
    await tid(page, 'search-input').fill('iS7');
    await expect(tid(page, 'search-results')).toBeVisible();
    await tid(page, 'search-input').press('Enter');
    await expect(page).toHaveURL(/#\/(product\/P\d+|\?(.*&)?node=)/);
    const url = page.url();
    const prodMatch = url.match(/#\/product\/(P\d+)/);
    if (prodMatch) {
      expect(products.find((p) => p.id === prodMatch[1])?.name ?? '').toMatch(/iS7/i);
    } else {
      const nodeId = decodeURIComponent(url.match(/[?&]node=([^&]+)/)![1]);
      const eq = eqById.get(diagram.nodes.find((n) => n.id === nodeId)!.equipmentTypeId)!;
      expect(`${eq.id} ${eq.name}`, '1순위 기기').not.toMatch(/gis|가스절연/i);
      expect(linkedProducts(eq).includes('P01188') || /인버터|드라이브|inverter|drive/i.test(`${eq.id} ${eq.name}`), `${eq.id} ${eq.name}`).toBe(true);
    }
  });

  test('v0.5 R2: 한글 조합(IME) 중 Enter 는 무시 — 결과 선택·이동 없음', async ({ page }) => {
    await gotoHome(page);
    const input = tid(page, 'search-input');
    await input.fill('인버');
    await expect(tid(page, 'search-results')).toBeVisible();
    const before = page.url();
    // 조합 중 Enter: 브라우저는 keydown 에 isComposing=true, keyCode=229 를 실어 보낸다 (CDP IME 이벤트는 isComposing 을 설정하지 않아 직접 dispatch)
    await input.evaluate((el) => {
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
      const ev = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true, isComposing: true });
      Object.defineProperty(ev, 'keyCode', { get: () => 229 });
      el.dispatchEvent(ev);
    });
    await page.waitForTimeout(200);
    expect(page.url()).toBe(before);
    await expect(input).toHaveValue('인버');
    await input.evaluate((el) => el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '인버' })));
    // 조합이 끝난 뒤 Enter 는 정상 동작 (결과 선택 → 이동)
    await input.press('Enter');
    await expect(page).not.toHaveURL(before);
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
    // 사용자 확정: Gap = 같은 계통도 위 강조 (별도 페이지로 이동하지 않음)
    await expect(page).toHaveURL(/#\/\?(.*&)?mode=gap/);
    await expect(tid(page, 'diagram')).toBeVisible();
    await expect(tid(page, 'gap-page')).toHaveCount(0);
    await expect(tid(page, 'diagram')).toHaveAttribute('data-view-mode', 'gap');

    await expect(diagramNode(page, missing!.node.id)).toHaveAttribute('data-emphasized', 'true');
    await expect(diagramNode(page, owned!.node.id)).toHaveAttribute('data-dimmed', 'true');
    // R-08 나머지 상태 (데이터에 있을 때만)
    const partial = nodeWith('partial');
    if (partial) await expect(diagramNode(page, partial.node.id)).toHaveAttribute('data-emphasized', 'true');
    const na = nodeWith('na');
    if (na) await expect(diagramNode(page, na.node.id)).toHaveAttribute('data-dimmed', 'true');
    // affiliate·sourced(패널 구성품, v0.6 R3) = 보통
    for (const c of ['affiliate', 'sourced'] as const) {
      const t = nodeWith(c);
      if (!t) continue;
      await expect(diagramNode(page, t.node.id)).toHaveAttribute('data-emphasized', 'false');
      await expect(diagramNode(page, t.node.id)).toHaveAttribute('data-dimmed', 'false');
    }

    // 색약 대응: 색 외에 아이콘이 함께 렌더링
    await expect(diagramNode(page, missing!.node.id).getByTestId('coverage-icon-missing')).toBeVisible();

    await clickNode(page, missing!.node.id, missing!.eq.layer);
    await expect(tid(page, 'detail-coverage-badge')).toHaveAttribute('data-coverage', 'missing');
    await expect(tid(page, 'detail-gap-note')).toBeVisible();
    await expect(tid(page, 'detail-product-list')).toHaveCount(0);
    await expect(tid(page, 'detail-empty-products')).toBeVisible(); // "자사 제품 미보유(공백)" — 오류 아님
  });

  test('좌측 내비 아래 "공백 표 보기" 링크 → /gap 공백 표', async ({ page }) => {
    await gotoHome(page);
    const link = tid(page, 'gap-table-link');
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/#\/gap(\?|$)/);
    await expect(tid(page, 'gap-page')).toBeVisible();
  });

  test('/gap 공백 목록: 기본 필터 "전체" = 미보유+일부+계열사+패널 구성품 건수, "미보유" 필터 = missing 건수 (FT-26)', async ({ page }) => {
    // 리더 결정(v0.4): 승인 디자인(GapTable.dc.html) 대로 첫 화면 필터는 "전체"
    // v0.6 R3: 공백류 = missing·partial·affiliate·sourced (gapAssessment 필수 범위와 같음)
    const count = (c: Coverage) => equipment.filter((e) => e.coverage === c).length;
    const gapTotal = count('missing') + count('partial') + count('affiliate') + count('sourced');
    await page.goto('./#/gap');
    await expect(tid(page, 'gap-page')).toBeVisible();
    await expect(tid(page, 'gap-matrix')).toBeVisible();
    await expect(tid(page, 'gap-filter-all')).toHaveAttribute('aria-pressed', 'true'); // v0.5 R2
    const items = tid(page, 'gap-list').getByTestId(/^gap-item-/);
    await expect(items).toHaveCount(gapTotal);

    await tid(page, 'gap-filter-missing').click();
    await expect(tid(page, 'gap-filter-missing')).toHaveAttribute('aria-pressed', 'true');
    await expect(items).toHaveCount(count('missing'));
    for (const row of await items.all()) await expect(row).toHaveAttribute('data-coverage', 'missing');
  });

  test('R-09 보기 모드 URL 공유: ?mode=gap 으로 열면 Gap 모드, 토글 시 URL 갱신', async ({ page }) => {
    await page.goto('./#/?mode=gap');
    await expect(tid(page, 'diagram')).toHaveAttribute('data-view-mode', 'gap');
    await expect(tid(page, 'view-mode-gap')).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(tid(page, 'diagram')).toHaveAttribute('data-view-mode', 'gap');

    await tid(page, 'view-mode-product').click();
    await expect(page).not.toHaveURL(/[?&]mode=/);
    await expect(tid(page, 'diagram')).toHaveAttribute('data-view-mode', 'product');
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
    const any = diagram.nodes[0] && eqById.get(diagram.nodes[0].equipmentTypeId!);
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

  test('?node=<nodeId> 로 열면 노드 선택 + 상세 패널 복원, 선택/닫기 시 URL 갱신', async ({ page }) => {
    const t = nodeWith('owned') ?? nodeWith('missing');
    const other = diagram.nodes.find((n) => n.id !== t?.node.id && eqById.has(n.equipmentTypeId));
    test.skip(!t || !other, '노드 데이터 부족');

    await page.goto(`./#/?node=${t!.node.id}`);
    await expect(panel(page)).toBeVisible();
    await expect(tid(page, 'detail-title')).toContainText(t!.eq.name);
    await expect(diagramNode(page, t!.node.id)).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(tid(page, 'detail-title')).toContainText(t!.eq.name);

    // 다른 노드 클릭 → URL 의 node 갱신
    const otherEq = eqById.get(other!.equipmentTypeId)!;
    await clickNode(page, other!.id, otherEq.layer);
    await expect(page).toHaveURL(new RegExp(`[?&]node=${other!.id}(&|$)`));

    // 닫기 → node 파라미터 제거
    await tid(page, 'detail-panel-close').click();
    await expect(panel(page)).toBeHidden();
    await expect(page).not.toHaveURL(/[?&]node=/);
  });

  test('?mode=gap&node= 조합도 함께 복원된다', async ({ page }) => {
    const t = nodeWith('missing');
    test.skip(!t, 'missing 노드 데이터 없음');
    await page.goto(`./#/?mode=gap&node=${t!.node.id}`);
    await expect(tid(page, 'diagram')).toHaveAttribute('data-view-mode', 'gap');
    await expect(tid(page, 'detail-coverage-badge')).toHaveAttribute('data-coverage', 'missing');
  });

  test('없는 ?node= 값 → 패널 닫힘, 오류 없음', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('./#/?node=__no_such_node__');
    await expect(tid(page, 'diagram')).toBeVisible();
    await expect(panel(page)).toHaveCount(0);
    expect(errors).toEqual([]);
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

  test('v0.5 R2: 계통도 타일 사진 = 썸네일(/images/equipment/thumb/), 상세 패널 큰 사진 = 원본', async ({ page }) => {
    test.skip(!nodeWithImage, '사진이 있는 계통도 노드 없음');
    const { node, eq } = nodeWithImage!;
    await gotoHome(page);
    const tileImg = diagramNode(page, node.id).locator('img').first();
    await expect(tileImg).toBeAttached();
    const tileSrc = (await tileImg.getAttribute('data-src')) ?? (await tileImg.getAttribute('src')) ?? '';
    expect(tileSrc).toContain('images/equipment/thumb/');
    expect(tileSrc).toMatch(new RegExp(`${equipmentImages[eq.id].thumb.split('/').pop()!.replace('.', '\\.')}$`));

    await page.goto(`./#/?node=${node.id}`);
    await expect(panel(page)).toBeVisible();
    const hero = panel(page).locator('.dp-hero img').first();
    await expect(hero).toBeVisible();
    const heroSrc = (await hero.getAttribute('src')) ?? '';
    expect(heroSrc).toContain(equipmentImages[eq.id].file);
    expect(heroSrc).not.toContain('/thumb/');
  });

  test('범례에 6개 커버리지 상태(v0.6 R3 sourced 포함)가 색 + 아이콘으로 모두 표시', async ({ page }) => {
    await gotoHome(page);
    for (const c of ['owned', 'partial', 'affiliate', 'sourced', 'missing', 'na'] as const) {
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
// 자료(docs.json) — 링크·새 탭·대체 상태
// ═════════════════════════════════════════════════════════════
test.describe('자료 링크 (docs.json)', () => {
  test('R-04 docs.json 에 없는 제품 → "자료 준비 중" + 공식 제품 페이지 링크, 깨진 링크 없음', async ({ page }) => {
    test.skip(!productWithoutEntry, '모든 제품이 docs.json 에 있음');
    await page.goto(`./#/product/${productWithoutEntry!.id}`);
    await expect(tid(page, 'docs-empty')).toBeVisible();
    await expect(tid(page, 'doc-link')).toHaveCount(0);
    const official = tid(page, 'product-official-link');
    await expect(official).toBeVisible();
    await expect(official).toHaveAttribute('href', productWithoutEntry!.url);
    await expect(official).toHaveAttribute('target', '_blank');
    await expect(official).toHaveAttribute('rel', /noopener/);
  });

  test('docs 가 빈 docs.json 항목 → "자료 준비 중" + 공식 자료실(deepLink) 새 탭 링크', async ({ page }) => {
    test.skip(!productWithEmptyEntry, 'docs 가 빈 항목 없음');
    const entry = docsJson.products[productWithEmptyEntry!.id];
    await page.goto(`./#/product/${productWithEmptyEntry!.id}`);
    await expect(tid(page, 'docs-empty')).toBeVisible();
    const deep = page.locator(`a[href="${entry.deepLink}"]`).first();
    await expect(deep).toHaveAttribute('target', '_blank');
    await expect(deep).toHaveAttribute('rel', /noopener/);
  });

  test('제품 페이지: 자료 건수 = docs.json, 유형 배지(data-doc-type), 모든 링크 새 탭·noopener·허용 도메인', async ({
    page,
  }) => {
    test.skip(!productWithDocs, 'docs.json 에 자료가 있는 제품 없음');
    const docs = docsOf(productWithDocs!.id);
    await page.goto(`./#/product/${productWithDocs!.id}`);
    const links = tid(page, 'doc-link');
    await expect(links).toHaveCount(docs.length);
    await expect(links.first()).toHaveAttribute('data-doc-type', docs[0].type);
    for (const a of await links.all()) {
      await expect(a).toHaveAttribute('target', '_blank');
      await expect(a).toHaveAttribute('rel', /noopener/);
      await expect(a).toHaveAttribute('href', ALLOWED_DOC_URL_RE);
    }
    // 공식 자료실 전체 보기 링크
    const deepLink = docsJson.products[productWithDocs!.id].deepLink;
    await expect(page.locator(`a[href="${deepLink}"]`).first()).toHaveAttribute('target', '_blank');
  });

  test('상세 패널(detail-doc-link) → 클릭 시 새 탭(popup)으로 열리고 원래 탭은 그대로', async ({ page }) => {
    test.skip(!nodeWithDocs, '상세 패널에 자료가 보일 기기 없음 (docs.json 자료가 있는 연결 제품)');
    await page.context().route(/^https:\/\/(?!localhost)/, (r) => r.fulfill({ status: 200, contentType: 'text/plain', body: 'stub' })); // 외부 사이트 실제 요청 차단
    await gotoHome(page);
    await clickNode(page, nodeWithDocs!.node.id, nodeWithDocs!.eq.layer);
    const link = tid(page, 'detail-doc-link').first();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    await expect(link).toHaveAttribute('href', ALLOWED_DOC_URL_RE);
    const before = page.url();
    const [popup] = await Promise.all([page.waitForEvent('popup'), link.click()]);
    expect(popup.url()).toMatch(ALLOWED_DOC_URL_RE);
    expect(await popup.evaluate(() => window.opener)).toBeNull(); // noopener 실제 효과
    await popup.close();
    expect(page.url()).toBe(before);
  });

  test('기기 페이지(equipment-doc-link) 자료 링크도 새 탭·noopener', async ({ page }) => {
    test.skip(!nodeWithDocs, '자료가 보일 기기 없음');
    await page.goto(`./#/equipment/${nodeWithDocs!.eq.id}`);
    const link = tid(page, 'equipment-doc-link').first();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    await expect(link).toHaveAttribute('href', ALLOWED_DOC_URL_RE);
  });
});

// ═════════════════════════════════════════════════════════════
// E2E-6 계통도 개선 R3 (v0.6): 모선·끝점·참조 타일·택1 연결·검수 배지·공백 후보·패널 구성품
//   testid·속성 이름은 test-plan.md §7 (v0.6). T1 구현명과 다르면 여기만 고친다.
// ═════════════════════════════════════════════════════════════
const legendCount = async (page: Page, c: Coverage) => {
  const text = (await tid(page, `legend-item-${c}`).textContent()) ?? '';
  const m = text.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : Number.NaN;
};

test.describe('E2E-6 계통도 개선 R3', () => {
  test('모선 2개(diagram-bus-{id}) · 끝점 4개(diagram-endpoint-{id}) 가 보인다', async ({ page }) => {
    await gotoHome(page);
    for (const b of busNodes) await expect(tid(page, `diagram-bus-${b.id}`)).toBeVisible();
    for (const p of endpointNodes) {
      const el = tid(page, `diagram-endpoint-${p.id}`);
      await expect(el).toBeVisible();
      await expect(el).toContainText(p.label!.replace(/[→←]/g, '').trim().split(' ')[0]);
    }
    await expect(page.getByTestId(/^diagram-bus-/)).toHaveCount(busNodes.length);
    await expect(page.getByTestId(/^diagram-endpoint-/)).toHaveCount(endpointNodes.length);
    expect([busNodes.length, endpointNodes.length]).toEqual([2, 4]); // 현재 데이터 (개선 R3)
  });

  test('참조 타일: data-ref="true" 3개, 클릭하면 같은 기기 상세가 열린다', async ({ page }) => {
    test.skip(refNodes.length === 0, '참조 타일 없음');
    await gotoHome(page);
    await expect(tid(page, 'diagram').locator('[data-testid^="diagram-node-"][data-ref="true"]')).toHaveCount(refNodes.length);
    const ref = refNodes[0];
    const eq = eqById.get(ref.equipmentTypeId!)!;
    const el = diagramNode(page, ref.id);
    await expect(el).toHaveAttribute('data-ref', 'true');
    await clickNode(page, ref.id, eq.layer);
    await expect(panel(page)).toBeVisible();
    await expect(tid(page, 'detail-title')).toContainText(eq.name);
  });

  test('택1 연결선: data-kind="alt" 가 데이터 개수만큼, 점선으로 그려진다', async ({ page }) => {
    test.skip(altEdges.length === 0, 'alt 연결선 없음');
    await gotoHome(page);
    await expect(tid(page, 'diagram').locator('[data-testid^="diagram-edge-"][data-kind="alt"]')).toHaveCount(altEdges.length);
    const el = tid(page, `diagram-edge-${altEdges[0].id}`);
    await expect(el).toHaveAttribute('data-kind', 'alt');
    const dash = await el.evaluate((n) => getComputedStyle(n as Element).strokeDasharray);
    expect(dash).not.toMatch(/^(none)?$/);
  });

  test('v0.8 계통 검수 배지: review.status=pending 이면 보이고, approved 면 없다 (데이터 기준)', async ({ page }) => {
    const status = diagramRaw.review?.status;
    test.skip(!status, 'diagram.review 없음 (DI-43b 경고)');
    await gotoHome(page);
    await expect(tid(page, 'diagram')).toBeVisible();
    if (status === 'pending') await expect(tid(page, 'diagram-review-badge')).toBeVisible();
    else await expect(tid(page, 'diagram-review-badge')).toHaveCount(0);
  });

  test('범례: sourced(패널 구성품) 항목 + 개수 합 = 74종(참조 타일 제외), 미보유·패널 구성품 개수 = 데이터', async ({ page }) => {
    await gotoHome(page);
    await expect(tid(page, 'legend-item-sourced')).toBeVisible();
    await expect(tid(page, 'legend-item-sourced')).toContainText('패널 구성품');
    const cs: Coverage[] = ['owned', 'partial', 'affiliate', 'sourced', 'missing', 'na'];
    const counts = await Promise.all(cs.map((c) => legendCount(page, c)));
    expect(counts.reduce((a, b) => a + b, 0)).toBe(equipment.length); // 74 (참조 타일을 세면 77)
    const count = (c: Coverage) => equipment.filter((e) => e.coverage === c).length;
    expect(await legendCount(page, 'missing')).toBe(count('missing')); // 현재 9
    expect(await legendCount(page, 'sourced')).toBe(count('sourced')); // 현재 3
  });

  test('v0.8 공백 확신도 타일: 공백류 기기 노드 data-confidence = 데이터 판정(확정 → confirmed, 후보·기한 지남 → candidate), 보유 → 속성 없음', async ({ page }) => {
    const assessed = diagram.nodes
      .map((n) => ({ node: n, eq: eqById.get(n.equipmentTypeId) }))
      .filter((x): x is { node: typeof x.node; eq: Eq } => !!x.eq && expectedConfidence(x.eq) !== undefined);
    test.skip(assessed.length === 0, '공백류 기기 노드 없음');
    await page.goto('./#/?mode=gap');
    await expect(tid(page, 'diagram')).toHaveAttribute('data-view-mode', 'gap');
    for (const { node, eq } of assessed) await expect(diagramNode(page, node.id), eq.id).toHaveAttribute('data-confidence', expectedConfidence(eq)!);
    // 보유 기기는 판정이 candidate 로 남아 있어도(예: GIS·승압 TR 정격 확인) 테두리 규칙 대상 아님
    const ownedWithGa = nodeWith('owned', (e) => !!e.gapAssessment);
    if (ownedWithGa) await expect(diagramNode(page, ownedWithGa.node.id)).not.toHaveAttribute('data-confidence', /.+/);
    const ownedPlain = nodeWith('owned', (e) => !e.gapAssessment);
    if (ownedPlain) await expect(diagramNode(page, ownedPlain.node.id)).not.toHaveAttribute('data-confidence', /.+/);
  });

  // UX 라운드 U B7: 패널 구성품은 공백이 아니므로 섹션 제목 "구성품 판정", 확신도 "판정 확정/후보" (공백 단어 없음)
  test('CT/PT(패널 구성품) 선택 → 패널에 "구성품 판정" 섹션 (근거·확신도, "공백" 표기 없음)', async ({ page }) => {
    const t = nodeWith('sourced', (e) => e.id === 'ct-pt') ?? nodeWith('sourced');
    test.skip(!t, 'sourced 기기 노드 없음');
    await page.goto(`./#/?node=${t!.node.id}`);
    await expect(panel(page)).toBeVisible();
    await expect(tid(page, 'detail-coverage-badge')).toHaveAttribute('data-coverage', 'sourced');
    const section = tid(page, 'detail-gap-assessment');
    await expect(section).toBeVisible();
    await expect(section).toContainText('구성품 판정');
    // v0.8: 데이터 판정 기준 — 확정이면 '확정', 후보·재확인 기한 지남이면 '후보'
    const conf = expectedConfidence(eqById.get(t!.node.equipmentTypeId)!)!;
    await expect(tid(page, 'detail-gap-confidence')).toHaveAttribute('data-confidence', conf);
    await expect(section).toContainText(conf === 'confirmed' ? '확정' : '후보');
    await expect(section).not.toContainText(conf === 'confirmed' ? '후보' : '확정');
    await expect(section).not.toContainText('공백');
  });
  // ── v0.7 (개선 R4) ──
  test('v0.7 R4 참조 타일 패널: detail-meta = "참조 타일", detail-ref-origin = 원래 위치(계층·분류), "원래 위치로 이동" → 원래 기기 노드', async ({ page }) => {
    const ref = refNodes.find((n) => n.label) ?? refNodes[0];
    test.skip(!ref, '참조 타일 없음');
    const eq = eqById.get(ref.equipmentTypeId!)!;
    const main = diagram.nodes.find((n) => n.equipmentTypeId === eq.id)!;
    await page.goto(`./#/?node=${ref.id}`);
    await expect(panel(page)).toBeVisible();
    await expect(tid(page, 'detail-meta')).toContainText('참조 타일');
    const note = tid(page, 'detail-ref-note');
    await expect(note).toBeVisible();
    if (ref.label) await expect(note).toContainText(ref.label);
    const origin = tid(page, 'detail-ref-origin');
    await expect(origin).toContainText('원래 위치');
    await expect(origin).toContainText(eq.layer); // "L5 변압" 처럼 기기의 원래 계층
    await tid(page, 'detail-ref-go').click();
    await expect(page).toHaveURL(new RegExp(`node=${main.id}(&|$)`));
    await expect(tid(page, 'detail-meta')).not.toContainText('참조 타일');
    await expect(tid(page, 'detail-ref-note')).toHaveCount(0);
  });

  test('v0.7 R4 모선 형제 피더 칩: 같은 모선에서 갈라진 회로는 화살표 없음, 모선에 전원을 넣는 쪽은 ↑', async ({ page }) => {
    const allEdges = load<{ edges: { id: string; from: string; to: string }[] }>('diagram.json').edges;
    const bus = busNodes.find((b) => allEdges.filter((e) => e.from === b.id).length >= 2);
    test.skip(!bus, '피더 2개 이상인 모선 없음');
    const isEq = (id: string) => diagram.nodes.some((n) => n.id === id);
    const feeders = allEdges.filter((e) => e.from === bus!.id && isEq(e.to)).map((e) => e.to);
    const feeding = allEdges.filter((e) => e.to === bus!.id && isEq(e.from)).map((e) => e.from);
    const [self, sibling] = feeders;
    await page.goto(`./#/?node=${self}`);
    await expect(panel(page)).toBeVisible();
    const chip = tid(page, `neighbor-chip-${sibling}`);
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute('title', /같은 모선에서 갈라진 회로/);
    expect((await chip.innerText()).trim()).not.toMatch(/^[↑↓←→]/);
    if (feeding[0]) {
      const up = tid(page, `neighbor-chip-${feeding[0]}`);
      await expect(up).toBeVisible();
      expect((await up.innerText()).trim()).toMatch(/^↑/);
      await expect(up).not.toHaveAttribute('title', /갈라진/);
    }
  });
});
