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
  test('ADM-1 /#/admin 진입: 제목·"보안 장치가 아닙니다" 안내·기기 목록, 원본 데이터 검사 통과', async ({ page }) => {
    await gotoAdmin(page);
    await expect(page).toHaveTitle(/관리자 모드/);
    await expect(page.getByRole('heading', { name: '계통도 관리자 모드' })).toBeVisible();
    await expect(page.getByRole('note').filter({ hasText: '보안 장치가 아닙니다' })).toContainText('이 브라우저에만 저장');
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
