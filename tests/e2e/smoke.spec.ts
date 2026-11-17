/**
 * 스모크 테스트 — Phase 1 셸 단계에서도 통과해야 하는 최소 검증.
 * 앱이 정적 빌드(preview)에서 뜨고, 헤더와 커버리지 범례 5종이 보인다.
 *
 * 셀렉터: 현재 셸에 data-testid 가 없으므로 ARIA 역할/이름을 사용한다.
 * Phase 2 에서 testid(`legend`, `legend-item-{coverage}`)가 생기면 core-flows.spec.ts 의
 * "범례 5종" 테스트가 같은 내용을 testid 로 검증한다.
 */
import { test, expect } from '@playwright/test';

/** src/lib/schema.ts COVERAGE_LABELS 와 동일 (앱 코드 import 없이 독립 유지) */
const COVERAGE_LABELS = ['보유', '일부 보유', '계열사 보유', '미보유(공백)', '해당 없음'];

test('스모크: 앱이 뜨고 헤더와 범례 5종이 보인다 (런타임 오류 없음)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('./#/');

  const header = page.getByRole('banner');
  await expect(header).toBeVisible();
  await expect(header).toContainText('LS ELECTRIC');

  const legend = page.getByRole('list', { name: '커버리지 범례' });
  await expect(legend).toBeVisible();
  const items = legend.getByRole('listitem');
  await expect(items).toHaveCount(COVERAGE_LABELS.length);
  for (const label of COVERAGE_LABELS) {
    await expect(legend.getByText(label, { exact: true })).toBeVisible();
  }

  expect(errors).toEqual([]);
});
