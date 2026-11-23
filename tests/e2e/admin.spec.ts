/**
 * E2E 관리자 모드 (/#/admin) — docs/test-plan.md §4 E2E-ADM (v0.7 R4)
 *
 * 셀렉터: data-testid(admin-*) 우선, 폼 입력은 label 텍스트. 매 테스트는 빈 localStorage 로 시작 (자동 저장 초안 간섭 방지).
 * 캔버스는 팬/줌 변환 안이라 화면 밖 요소가 있을 수 있어 노드·모선 클릭은 dispatchEvent('click') 으로 보낸다
 * (관리자 캔버스의 노드 클릭 = React onClick, 모선 클릭 = 캔버스 onClick 버블링 — 둘 다 실제 클릭과 같은 처리 경로).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page } from '@playwright/test';

interface DNode {
  id: string;
  kind?: string;
  ref?: boolean;
  x: number;
  y: number;
  width?: number;
  equipmentTypeId?: string;
}
const diagram = JSON.parse(readFileSync(fileURLToPath(new URL('../../src/data/diagram.json', import.meta.url)), 'utf8')) as {
  nodes: DNode[];
  edges: { id: string; from: string; to: string }[];
};
const equipmentCount = (JSON.parse(readFileSync(fileURLToPath(new URL('../../src/data/equipment-types.json', import.meta.url)), 'utf8')) as unknown[]).length;

const tid = (page: Page, id: string) => page.getByTestId(id);
const canvas = (page: Page) => tid(page, 'admin-canvas');

async function gotoAdmin(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {
      /* 저장 불가 브라우저 */
    }
  });
  await page.goto('./#/admin');
  await expect(tid(page, 'admin-page')).toBeVisible();
}

/** 관리자 캔버스의 노드(기기 타일·참조 타일) 또는 모선·끝점 클릭 */
async function clickCanvasNode(page: Page, nodeId: string) {
  const n = diagram.nodes.find((x) => x.id === nodeId);
  const testId = n?.kind === 'bus' ? `diagram-bus-${nodeId}` : n?.kind === 'endpoint' ? `diagram-endpoint-${nodeId}` : `diagram-node-${nodeId}`;
  await canvas(page).getByTestId(testId).dispatchEvent('click');
}

test.describe('E2E-ADM 관리자 모드', () => {
  test('ADM-1 /#/admin 진입: 제목·저장 안내·기기 목록, 원본 데이터 검사 통과', async ({ page }) => {
    await gotoAdmin(page);
    await expect(page).toHaveTitle(/관리자 모드/);
    await expect(page.getByRole('heading', { name: '계통도 관리자 모드' })).toBeVisible();
    await expect(page.getByRole('note').filter({ hasText: '사이트에 반영' })).toContainText('이 브라우저에만 저장');
    await expect(page.getByRole('heading', { name: `기기 종류 ${equipmentCount}` })).toBeVisible();
    await expect(tid(page, 'admin-undo')).toBeDisabled();
    await expect(tid(page, 'admin-export')).toBeEnabled();
    await tid(page, 'admin-tab-check').click();
    await tid(page, 'admin-check-run').click();
    await expect(tid(page, 'admin-check-ok')).toContainText('검사 통과');
    await expect(tid(page, 'admin-validation-errors')).toHaveCount(0);
  });

  test('ADM-2 기기 추가 → 자동 배치 → 380V 모선에 연결 → 검사 통과 → 내보내기 (파일 다운로드)', async ({ page }) => {
    await gotoAdmin(page);
    await tid(page, 'admin-add-equipment').click();
    const form = tid(page, 'admin-equipment-form');
    await expect(form).toBeVisible();
    await form.getByLabel(/^이름/).fill('테스트 차단기');
    await form.getByLabel(/^약어/).fill('TCB');
    await expect(form.getByLabel(/^id/)).toHaveValue('tcb'); // 약어에서 자동 제안
    await form.getByLabel(/^계층/).selectOption('L6');
    await form.getByLabel(/^전압/).fill('380V');
    await form.getByLabel(/^커버리지/).selectOption('na'); // 해당 없음: 연결 카테고리·판정 근거 불필요
    await form.getByLabel(/^설명/).fill('E2E 테스트용 기기');
    await form.getByLabel(/^학습 포인트/).fill('테스트 포인트');
    await tid(page, 'admin-save').click();
    await expect(form).toHaveCount(0);

    // 저장하면 바로 배치 모드 → 빈 자리에 자동 배치
    await expect(tid(page, 'admin-place-mode')).toHaveAttribute('aria-pressed', 'true');
    await tid(page, 'admin-auto-place').click();
    await expect(tid(page, 'admin-toast')).toContainText('배치했습니다');
    await expect(canvas(page).getByTestId('diagram-node-n-tcb')).toHaveCount(1);
    await expect(tid(page, 'admin-node-kind')).toHaveText('기기');

    // 연결 모드: 선택된 새 노드에서 시작 → 380V 모선
    await tid(page, 'admin-connect-mode').click();
    await clickCanvasNode(page, 'bus-380');
    await expect(tid(page, 'admin-toast')).toContainText(/연결선 e\d+ 추가/);

    // 검사 후 내보내기: 오류 0 → JSON 파일 내려받기
    const downloads: string[] = [];
    page.on('download', (d) => downloads.push(d.suggestedFilename()));
    await expect(tid(page, 'admin-export')).toBeEnabled();
    await tid(page, 'admin-export').click();
    await expect(tid(page, 'admin-check-ok')).toContainText('검사 통과');
    await expect(tid(page, 'admin-exported')).toBeVisible();
    await expect(tid(page, 'admin-exported')).toContainText('diagram.json');
    await expect.poll(() => downloads.sort()).toEqual(expect.arrayContaining(['diagram.json', 'equipment-types.json']));
    // 노드·연결선이 바뀌었으므로 변경 요약에 검수 대기
    await expect(tid(page, 'admin-tab-changes')).not.toHaveText('변경 내역 0');
  });

  test('ADM-5 헤더 관리자 탭 → 편집 → 사이트에 반영(비밀번호 틀림 → 안내, 맞으면 반영 요청 완료)', async ({ page }) => {
    // 반영 API 는 가짜 응답 (실제 저장소에 커밋하지 않음)
    await page.route('**/api/admin/publish', async (route) => {
      const body = route.request().postDataJSON() as { password: string; files: Record<string, string> };
      if (body.password !== 'right-pw') return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: '관리자 비밀번호가 맞지 않습니다' }) });
      expect(Object.keys(body.files)).toEqual(expect.arrayContaining(['equipment-types.json', 'diagram.json']));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, sha: 'abc', url: 'https://github.com/moonkj/lse-product/commit/abc' }) });
    });
    await page.goto('./#/');
    await tid(page, 'admin-link').click();
    await expect(page.getByRole('heading', { name: '계통도 관리자 모드' })).toBeVisible();

    // 바꾼 것이 없으면 반영 창을 열지 않음
    await tid(page, 'admin-publish').click();
    await expect(tid(page, 'admin-toast')).toContainText('달라진 내용이 없습니다');

    await tid(page, 'admin-add-equipment').click();
    const form = tid(page, 'admin-equipment-form');
    await form.getByLabel(/^이름/).fill('반영 테스트');
    await form.getByLabel(/^약어/).fill('PUB');
    await form.getByLabel(/^계층/).selectOption('L6');
    await form.getByLabel(/^전압/).fill('380V');
    await form.getByLabel(/^커버리지/).selectOption('na');
    await form.getByLabel(/^설명/).fill('E2E 테스트용 기기');
    await form.getByLabel(/^학습 포인트/).fill('테스트 포인트');
    await tid(page, 'admin-save').click();
    await tid(page, 'admin-auto-place').click();
    await tid(page, 'admin-connect-mode').click();
    await clickCanvasNode(page, 'bus-380');

    await tid(page, 'admin-publish').click();
    const dlg = tid(page, 'admin-publish-dialog');
    await expect(dlg).toBeVisible();
    await tid(page, 'admin-publish-password').fill('wrong');
    await tid(page, 'admin-publish-submit').click();
    await expect(tid(page, 'admin-publish-error')).toContainText('비밀번호가 맞지 않습니다');
    await tid(page, 'admin-publish-password').fill('right-pw');
    await tid(page, 'admin-publish-submit').click();
    await expect(tid(page, 'admin-publish-done')).toContainText('분 뒤');
    await expect(dlg.getByRole('link', { name: /변경 기록/ })).toHaveAttribute('href', /commit\/abc/);
  });

  test('ADM-6 편집 계통 → 데이터센터(국내): 노드 이동 → 변경 내역 → 사이트에 반영은 diagram-dc.json 만, 기기 수정은 국내 표준에서만', async ({ page }) => {
    let sent: string[] = [];
    await page.route('**/api/admin/publish', async (route) => {
      sent = Object.keys((route.request().postDataJSON() as { files: Record<string, string> }).files);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, sha: 'd1', url: 'https://github.com/moonkj/lse-product/commit/d1' }) });
    });
    await gotoAdmin(page);
    await tid(page, 'admin-grid').selectOption('dc');
    const node = canvas(page).getByTestId('diagram-node-dc-sst');
    await expect(node).toBeVisible();
    await expect(canvas(page).getByTestId('diagram-node-n-gen')).toHaveCount(0);
    // 데이터센터에서는 기기 수정 대신 안내
    await page.getByTestId('admin-eq-edit-vcb').click();
    await expect(tid(page, 'admin-toast')).toContainText('국내 표준');
    // SST 노드를 왼쪽으로 한 칸
    await node.dispatchEvent('click');
    await node.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(tid(page, 'admin-tab-changes')).not.toHaveText('변경 내역 0');
    await tid(page, 'admin-publish').click();
    await tid(page, 'admin-publish-password').fill('pw');
    await tid(page, 'admin-publish-submit').click();
    await expect(tid(page, 'admin-publish-done')).toBeVisible();
    expect(sent).toEqual(['diagram-dc.json']);
  });

  test('ADM-3 모선 범위 밖 기기를 모선에 연결 → 거부 메시지, 연결선 추가 안 됨', async ({ page }) => {
    const bus = diagram.nodes.find((n) => n.id === 'bus-380')!;
    const linked = new Set(diagram.edges.filter((e) => e.from === bus.id || e.to === bus.id).flatMap((e) => [e.from, e.to]));
    const far = diagram.nodes.find(
      (n) => !n.kind && !n.ref && n.y > bus.y && !linked.has(n.id) && Math.abs(n.x - bus.x) > (bus.width ?? 0) / 2 + 60,
    );
    test.skip(!far, '모선 범위 밖 기기 없음');
    await gotoAdmin(page);
    await tid(page, 'admin-connect-mode').click();
    await clickCanvasNode(page, bus.id);
    await expect(tid(page, 'admin-toast')).toContainText('에서 시작');
    await clickCanvasNode(page, far!.id);
    const toast = tid(page, 'admin-toast');
    await expect(toast).toHaveAttribute('role', 'alert');
    await expect(toast).toContainText('모선 범위 밖');
    await expect(toast).toContainText('수직');
    await expect(tid(page, 'admin-undo')).toBeDisabled(); // 초안 변경 없음
    await expect(tid(page, 'admin-tab-changes')).toHaveText('변경 내역 0');
  });

  test('ADM-4 기기 폼: 커버리지를 패널 구성품(sourced)으로 바꾸면 공급 방식이 panel-sourced 로 고정(비활성)', async ({ page }) => {
    await gotoAdmin(page);
    await tid(page, 'admin-add-equipment').click();
    const form = tid(page, 'admin-equipment-form');
    await form.getByLabel(/^커버리지/).selectOption('missing');
    const supply = tid(page, 'admin-gap-supply');
    await expect(supply).toBeEnabled();
    await supply.selectOption('in-house');
    await form.getByLabel(/^커버리지/).selectOption('sourced');
    await expect(supply).toHaveValue('panel-sourced');
    await expect(supply).toBeDisabled();
    await expect(tid(page, 'admin-gap-assessment')).toContainText('고정됩니다');
  });
});

// ─────────────────────────────────────────────────────────────
// E2E-ADM-SPEC (v1.2) 관리자 "사양 검수" 탭 — 값 수정 → 검수 완료 → 검사 → 내보내기(specs.json·변경요약.md)
// 대상 제품: P02212(우선 검수 목록) 이 사양에 있으면 그것, 없으면 사양 첫 제품. 값·note 기대는 원본 specs.json 에서 계산.
// ─────────────────────────────────────────────────────────────
type SpecsRaw = { generatedAt: string; products: Record<string, { items: { key: string; value: string }[]; reviewed: boolean; note?: string }> };
const specsRawText = readFileSync(fileURLToPath(new URL('../../src/data/specs.json', import.meta.url)), 'utf8');
const specsRaw = JSON.parse(specsRawText) as SpecsRaw;
const SPEC_PID = specsRaw.products.P02212 ? 'P02212' : Object.keys(specsRaw.products)[0];
const todayKst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

async function openSpecTab(page: Page) {
  await gotoAdmin(page);
  await tid(page, 'admin-tab-specs').click();
  await expect(tid(page, 'admin-specs')).toBeVisible();
  await tid(page, `admin-spec-product-${SPEC_PID}`).click();
  await expect(tid(page, 'admin-spec-reviewed')).toBeVisible();
}

test.describe('E2E-ADM-SPEC 사양 검수 (v1.2)', () => {
  test('값 수정 → 부서명 → 검수 완료 → 검사 오류 없음 → 내보내기 2개, specs.json 은 스키마 통과·변경 항목만 다름', async ({ page }) => {
    const orig = specsRaw.products[SPEC_PID];
    test.skip(!orig || orig.items.length === 0, '공통 사양 있는 대상 제품 없음');
    const item = orig.items[0];
    const newValue = `${item.value} (검수 수정)`;
    await openSpecTab(page);

    const cell = tid(page, `admin-spec-value-common-${item.key}`);
    await cell.fill(newValue);
    await cell.press('Enter');
    await expect(tid(page, 'admin-spec-changes')).toContainText(item.key);
    await tid(page, 'admin-spec-reviewer').fill('품질보증팀');
    await tid(page, 'admin-spec-reviewed').check();
    await expect(tid(page, 'admin-spec-reviewed')).toBeChecked();
    await expect(tid(page, 'admin-spec-reviewer-error')).toHaveCount(0);

    await tid(page, 'admin-spec-check').click();
    await expect(tid(page, 'admin-spec-check-ok')).toContainText('오류 없음');

    const files = new Map<string, string>();
    page.on('download', async (d) => {
      const path = await d.path();
      files.set(d.suggestedFilename(), readFileSync(path!, 'utf8'));
    });
    await tid(page, 'admin-spec-export').click();
    await expect.poll(() => [...files.keys()].sort()).toEqual(['specs.json', '변경요약.md'].sort());
    await expect(tid(page, 'admin-spec-exported')).toBeVisible();

    const { SpecsFileSchema } = await import('../../src/lib/schema');
    const out = JSON.parse(files.get('specs.json')!) as SpecsRaw;
    expect(SpecsFileSchema.safeParse(out).success).toBe(true);
    // 기대 = 원본에 세 가지 변경만 (키 순서 유지)
    const expected = JSON.parse(specsRawText) as SpecsRaw;
    const p = expected.products[SPEC_PID];
    p.items[0].value = newValue;
    p.reviewed = true;
    const stamp = `검수: 품질보증팀 ${todayKst()}`;
    p.note = p.note ? `${p.note} · ${stamp}` : stamp;
    expect(JSON.stringify(out)).toBe(JSON.stringify(expected));
    expect(files.get('specs.json')).toBe(`${JSON.stringify(expected, null, 2)}\n`);
    const md = files.get('변경요약.md')!;
    expect(md.split('\n')[0]).toBe('data: 정격 사양 검수 (검수 완료 1개 제품, 사양 수정 1건)');
    expect(md).toContain(`(${SPEC_PID})`);
    expect(md).toContain(newValue);
  });

  test('부서명 없이 검수 체크 → admin-spec-reviewer-error, 체크 안 됨 / 실명 → 부서명 안내', async ({ page }) => {
    test.skip(!specsRaw.products[SPEC_PID] || specsRaw.products[SPEC_PID].reviewed, '대상 제품이 이미 검수 완료');
    await openSpecTab(page);
    await tid(page, 'admin-spec-reviewed').click();
    await expect(tid(page, 'admin-spec-reviewer-error')).toContainText('부서명');
    await expect(tid(page, 'admin-spec-reviewed')).not.toBeChecked();
    await tid(page, 'admin-spec-reviewer').fill('홍길동');
    await expect(tid(page, 'admin-spec-reviewer-error')).toHaveCount(0); // 입력하면 오류 문구 지움
    await tid(page, 'admin-spec-reviewed').click();
    await expect(tid(page, 'admin-spec-reviewer-error')).toContainText('부서명');
    await expect(tid(page, 'admin-spec-reviewed')).not.toBeChecked();
    await expect(tid(page, 'admin-spec-changes')).toHaveCount(0);
  });

  test('항목 0개 옵션 추가 → 검사 오류(DI-96)로 내보내기 차단, 되돌리기로 복구', async ({ page }) => {
    await openSpecTab(page);
    const hasAxis = await tid(page, 'admin-spec-new-variant-axis').count();
    await tid(page, 'admin-spec-new-variant-id').fill('e2e-opt');
    await tid(page, 'admin-spec-new-variant-label').fill('E2E 옵션');
    if (hasAxis) await tid(page, 'admin-spec-new-variant-axis').fill('형식');
    await tid(page, 'admin-spec-add-variant').click();
    await expect(tid(page, 'admin-spec-variant-e2e-opt')).toBeVisible();
    const downloads: string[] = [];
    page.on('download', (d) => downloads.push(d.suggestedFilename()));
    await tid(page, 'admin-spec-export').click();
    await expect(tid(page, 'admin-spec-check-errors')).toContainText('DI-96');
    await expect(tid(page, 'admin-spec-msg')).toContainText('내보내기를 막았습니다');
    expect(downloads).toEqual([]);
    await tid(page, 'admin-spec-undo').click();
    await expect(tid(page, 'admin-spec-variant-e2e-opt')).toHaveCount(0);
  });
});
