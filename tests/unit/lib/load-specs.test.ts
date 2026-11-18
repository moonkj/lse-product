// @vitest-environment node
/**
 * 단위 테스트 (UT-15, v1.0 M6) — src/data/load.ts 의 specs.json 지연 로딩.
 *  - loadSpecs(): dynamic import + SpecsFileSchema 검증 → Map, 결과 메모(같은 Promise), 실패하면 다음 호출에서 재시도
 *  - peekSpecs(): 불러오기 전 undefined, 성공 후 같은 Map
 *  - getData() 결과(AppData)에는 specs 가 없음 (첫 화면 번들 분리)
 * 실패 케이스는 vi.doMock 으로 specs.json 을 잘못된 값 → 정상 값 순으로 바꿔 재시도를 확인한다.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, afterEach } from 'vitest';

type LoadModule = typeof import('../../../src/data/load');
const realSpecs = JSON.parse(readFileSync(fileURLToPath(new URL('../../../src/data/specs.json', import.meta.url)), 'utf8')) as {
  products: Record<string, unknown>;
};

async function freshLoad(): Promise<LoadModule> {
  vi.resetModules();
  return import('../../../src/data/load');
}

afterEach(() => {
  vi.doUnmock('../../../src/data/specs.json');
  vi.resetModules();
});

describe('UT-15 loadSpecs·peekSpecs (specs.json 지연 로딩)', () => {
  it('AppData 에 specs 없음, peekSpecs 는 불러오기 전 undefined', async () => {
    const m = await freshLoad();
    expect('specsByProductId' in m.getData()).toBe(false);
    expect(m.peekSpecs()).toBeUndefined();
  });

  it('loadSpecs → 제품 id → 사양 Map (specs.json 전체), 메모: 두 번째 호출은 같은 Promise·같은 Map, peekSpecs 도 같은 Map', async () => {
    const m = await freshLoad();
    const p1 = m.loadSpecs();
    const p2 = m.loadSpecs();
    expect(p2).toBe(p1);
    const map = await p1;
    expect([...map.keys()].sort()).toEqual(Object.keys(realSpecs.products).sort());
    expect(m.peekSpecs()).toBe(map);
    expect(await m.loadSpecs()).toBe(map);
  });

  it('검증 실패 → DataValidationError 로 거절(앱 전체 오류 아님), peekSpecs 그대로 undefined, 메모 해제(다음 호출 = 새 시도)', async () => {
    let calls = 0;
    vi.doMock('../../../src/data/specs.json', () => {
      calls += 1;
      return { default: calls === 1 ? { generatedAt: 'x', products: { P1: { items: [] } } } : realSpecs };
    });
    const m = await freshLoad();
    const { DataValidationError } = await import('../../../src/lib/errors');
    const first = m.loadSpecs();
    await expect(first).rejects.toBeInstanceOf(DataValidationError);
    expect(m.peekSpecs()).toBeUndefined();
    expect(() => m.getData()).not.toThrow(); // 나머지 데이터는 정상
    // 메모 해제 → 다음 호출은 새 Promise (모듈 레지스트리가 평가된 모듈을 캐시하므로 같은 잘못된 값이면 다시 거절)
    const retry = m.loadSpecs();
    expect(retry).not.toBe(first);
    await expect(retry).rejects.toBeInstanceOf(DataValidationError);
    expect(calls).toBe(1);
  });

  it('dynamic import 자체 실패(청크 다운로드 실패) → 거절, 메모 해제 → 다음 호출은 새 시도로 성공', async () => {
    let calls = 0;
    vi.doMock('../../../src/data/specs.json', () => {
      calls += 1;
      if (calls === 1) throw new Error('Failed to fetch dynamically imported module');
      return { default: realSpecs };
    });
    const m = await freshLoad();
    const first = m.loadSpecs();
    await expect(first).rejects.toThrow();
    const second = m.loadSpecs();
    expect(second).not.toBe(first);
    const ok = await second.then(
      (map) => map.size,
      () => -1,
    );
    expect(ok).toBe(Object.keys(realSpecs.products).length);
    expect(calls).toBe(2);
    expect(m.peekSpecs()?.size).toBe(ok);
  });
});
