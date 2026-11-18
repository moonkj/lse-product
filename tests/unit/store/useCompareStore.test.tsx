/**
 * 단위·컴포넌트 테스트 (UT-14) — 비교 담기 store (src/store/useCompareStore.ts) + 비교 바·담기 버튼.
 * store 는 import 시점에 localStorage 를 읽으므로, 저장 값 복구 케이스는 vi.resetModules() 후 동적 import 로 새로 만든다.
 * 실제 데이터 id 는 하드코딩하지 않고 getData() 에서 고른다.
 * v1.0: store 가 데이터에 없는 id 를 정리(B2)하므로 담는 id 는 실제 데이터 id(E·P), 사라진 id 는 'gone-*'.
 *       탭 간 동기화(M1: storage 이벤트·변경 직전 재읽기), 비교 화면 끝 슬래시에서 바 숨김 추가.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { getData } from '../../../src/data/load';

const KEY = 'lse-compare-v1';
const data = getData();
/** 실제 기기 id 6개·제품 id 2개 */
const [a, b, c, d, e] = data.equipmentTypes.map((x) => x.id);
const [P1, P2] = data.products.map((x) => x.id);
const json = (v: unknown) => JSON.stringify(v);
type StoreModule = typeof import('../../../src/store/useCompareStore');

async function freshStore(stored?: string): Promise<StoreModule> {
  vi.resetModules();
  localStorage.clear();
  if (stored !== undefined) localStorage.setItem(KEY, stored);
  return import('../../../src/store/useCompareStore');
}
const saved = () => JSON.parse(localStorage.getItem(KEY) ?? 'null') as { equipment: string[]; product: string[]; active: string } | null;

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
  localStorage.clear();
});

describe('UT-14 담기·빼기·최대 4개', () => {
  let m: StoreModule;
  beforeEach(async () => {
    m = await freshStore();
  });
  const st = () => m.useCompareStore.getState();

  it('처음 = 빈 목록, active equipment', () => {
    expect([st().equipment, st().product, st().active]).toEqual([[], [], 'equipment']);
  });

  it('toggle: 담기 → added, 다시 → removed (순서 유지)', () => {
    expect(st().toggle('equipment', a)).toBe('added');
    expect(st().toggle('equipment', b)).toBe('added');
    expect(st().toggle('equipment', c)).toBe('added');
    expect(st().toggle('equipment', b)).toBe('removed');
    expect(st().equipment).toEqual([a, c]);
  });

  it('5번째 → full, 목록 그대로 / 하나 빼면 다시 담김', () => {
    for (const id of [a, b, c, d]) expect(st().toggle('equipment', id)).toBe('added');
    expect(st().toggle('equipment', e)).toBe('full');
    expect(st().equipment).toEqual([a, b, c, d]);
    expect(st().toggle('equipment', a)).toBe('removed');
    expect(st().toggle('equipment', e)).toBe('added');
    expect(st().equipment).toEqual([b, c, d, e]);
  });

  it('기기·제품 목록은 분리 (각 4개), active = 마지막에 담은 종류 (빼기는 유지)', () => {
    for (const id of [a, b, c, d]) st().toggle('equipment', id);
    expect(st().toggle('product', P1)).toBe('added');
    expect([st().equipment.length, st().product, st().active]).toEqual([4, [P1], 'product']);
    st().toggle('equipment', a);
    expect(st().active).toBe('product');
    expect(st().toggle('product', P2)).toBe('added');
    expect(st().product).toEqual([P1, P2]);
  });

  it('remove·clear: clear 는 그 종류만 비우고, 다른 종류가 남아 있으면 active 를 그쪽으로', () => {
    st().toggle('equipment', a);
    st().toggle('equipment', b);
    st().toggle('product', P1);
    st().remove('equipment', a);
    expect(st().equipment).toEqual([b]);
    st().setActive('equipment');
    st().clear('equipment');
    expect([st().equipment, st().product, st().active]).toEqual([[], [P1], 'product']);
    st().clear('product');
    expect([st().equipment, st().product, st().active]).toEqual([[], [], 'product']);
  });

  it('변경마다 localStorage 에 저장 (키 lse-compare-v1)', () => {
    st().toggle('product', P1);
    expect(saved()).toEqual({ equipment: [], product: [P1], active: 'product' });
    st().clear('product');
    expect(saved()).toEqual({ equipment: [], product: [], active: 'product' });
  });

  it('compareHref: /compare?type=&ids= (id 는 인코딩)', () => {
    expect(m.compareHref('equipment', ['a', 'b'])).toBe('/compare?type=equipment&ids=a,b');
    expect(m.compareHref('product', ['P 1', 'P,2'])).toBe('/compare?type=product&ids=P%201,P%2C2');
  });
});

describe('UT-14 localStorage 실패·손상 복구', () => {
  it('setItem 예외(사생활 보호 모드 등) → 메모리로 계속 동작', async () => {
    const m = await freshStore();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const { toggle } = m.useCompareStore.getState();
    expect(() => toggle('equipment', a)).not.toThrow();
    expect(toggle('equipment', b)).toBe('added');
    expect(m.useCompareStore.getState().equipment).toEqual([a, b]);
  });

  it('getItem 예외 → 빈 목록으로 시작, 담기 동작 (변경 직전 재읽기도 예외 없이)', async () => {
    vi.resetModules();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const m = await import('../../../src/store/useCompareStore');
    expect(m.useCompareStore.getState().equipment).toEqual([]);
    expect(m.useCompareStore.getState().toggle('equipment', a)).toBe('added');
    expect(m.useCompareStore.getState().toggle('equipment', b)).toBe('added');
    expect(m.useCompareStore.getState().equipment).toEqual([a, b]);
  });

  it('JSON 깨짐 → 빈 목록', async () => {
    const s = (await freshStore('{"equipment":["a"')).useCompareStore.getState();
    expect([s.equipment, s.product, s.active]).toEqual([[], [], 'equipment']);
  });

  it('형식 손상: 배열 아님·문자열 아닌 값·빈 문자열·중복·사라진 id·4개 초과·잘못된 active → 정리 + 정리 결과 저장', async () => {
    const m = await freshStore(json({ equipment: [a, 3, '', a, null, 'gone-1', b, c, d, e], product: 'P1', active: 'both' }));
    const s = m.useCompareStore.getState();
    expect([s.equipment, s.product, s.active]).toEqual([[a, b, c, d], [], 'equipment']);
    expect(saved()).toEqual({ equipment: [a, b, c, d], product: [], active: 'equipment' });
  });

  it('JSON null·숫자 → 빈 목록 (예외 없이)', async () => {
    expect((await freshStore('null')).useCompareStore.getState().equipment).toEqual([]);
    expect((await freshStore('42')).useCompareStore.getState().product).toEqual([]);
  });

  it('정상 저장 값은 다시 쓰지 않음 (불러오기만)', async () => {
    const raw = json({ equipment: [a], product: [P1], active: 'product' });
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    await freshStore(raw);
    expect(spy.mock.calls.filter(([k]) => k === KEY).length).toBe(1); // freshStore 의 시드 1회뿐
    expect(localStorage.getItem(KEY)).toBe(raw);
  });
});

describe('UT-14 B2 데이터에 없는 id (데이터 변경으로 사라진 항목)', () => {
  const target = data.equipmentTypes[5];

  it('불러올 때 사라진 id 제거 + 정리 결과 저장, 비교 바도 유효 항목만', async () => {
    const m = await freshStore(json({ equipment: ['gone-1', a, b], product: ['gone-p'], active: 'equipment' }));
    expect(m.useCompareStore.getState().equipment).toEqual([a, b]);
    expect(m.useCompareStore.getState().product).toEqual([]);
    expect(saved()).toEqual({ equipment: [a, b], product: [], active: 'equipment' });
    const { default: CompareTray } = await import('../../../src/components/compare/CompareTray');
    render(
      <MemoryRouter initialEntries={['/']}>
        <CompareTray />
      </MemoryRouter>,
    );
    expect(screen.getByTestId(`compare-tray-item-${a}`)).toBeInTheDocument();
    expect(screen.queryByTestId('compare-tray-item-gone-1')).toBeNull();
    expect(screen.getByTestId('compare-go').getAttribute('href')).toBe(`/compare?type=equipment&ids=${a},${b}`);
  });

  it('(v0.9 B2 회귀) 저장 목록이 사라진 id 4개뿐이어도 담기 버튼이 동작', async () => {
    await freshStore(json({ equipment: ['gone-1', 'gone-2', 'gone-3', 'gone-4'], product: [], active: 'equipment' }));
    const { default: CompareToggle } = await import('../../../src/components/compare/CompareToggle');
    render(
      <MemoryRouter initialEntries={['/']}>
        <CompareToggle kind="equipment" id={target.id} name={target.name} />
      </MemoryRouter>,
    );
    const btn = screen.getByTestId(`compare-toggle-${target.id}`);
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('열려 있던 탭(메모리에 사라진 id 가 남은 상태): 가득 판정은 유효 id 기준 — 담을 때 정리하고 저장, 버튼도 비활성 아님', async () => {
    const m = await freshStore();
    m.useCompareStore.setState({ equipment: ['gone-1', a, b, c] });
    const { default: CompareToggle } = await import('../../../src/components/compare/CompareToggle');
    render(<CompareToggle kind="equipment" id={d} name="D" />);
    expect(screen.getByTestId(`compare-toggle-${d}`)).not.toBeDisabled();
    expect(m.useCompareStore.getState().toggle('equipment', d)).toBe('added');
    expect(m.useCompareStore.getState().equipment).toEqual([a, b, c, d]);
    expect(saved()?.equipment).toEqual([a, b, c, d]);
    // 유효 4개면 그대로 full
    expect(m.useCompareStore.getState().toggle('equipment', e)).toBe('full');
  });
});

describe('UT-14 M1 여러 탭 동기화', () => {
  it('다른 탭의 storage 이벤트(같은 키) → 목록 반영, 다른 키는 무시, key=null(전체 삭제) → 비움', async () => {
    const m = await freshStore();
    const st = () => m.useCompareStore.getState();
    localStorage.setItem(KEY, json({ equipment: [a, b], product: [], active: 'equipment' }));
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    expect(st().equipment).toEqual([a, b]);
    localStorage.setItem(KEY, json({ equipment: [c], product: [], active: 'equipment' }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'other-key' }));
    expect(st().equipment).toEqual([a, b]);
    localStorage.clear();
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    expect(st().equipment).toEqual([]);
  });

  it('이벤트를 못 받았어도 변경 직전에 저장소를 다시 읽어 다른 탭 변경 위에 얹음 (유실 없음)', async () => {
    const m = await freshStore();
    const st = () => m.useCompareStore.getState();
    st().toggle('equipment', a);
    localStorage.setItem(KEY, json({ equipment: [a, b], product: [P1], active: 'product' })); // 다른 탭이 씀
    expect(st().toggle('equipment', c)).toBe('added');
    expect(st().equipment).toEqual([a, b, c]);
    expect(st().product).toEqual([P1]);
    expect(saved()).toEqual({ equipment: [a, b, c], product: [P1], active: 'equipment' });
    // 다른 탭이 4개를 채웠으면 내 담기는 full
    localStorage.setItem(KEY, json({ equipment: [a, b, c, d], product: [], active: 'equipment' }));
    expect(st().toggle('equipment', e)).toBe('full');
    // remove·clear 도 재읽기 후
    localStorage.setItem(KEY, json({ equipment: [b, c], product: [P2], active: 'equipment' }));
    st().remove('equipment', b);
    expect([st().equipment, st().product]).toEqual([[c], [P2]]);
  });

  it('다른 탭이 쓴 값의 사라진 id 도 정리', async () => {
    const m = await freshStore();
    localStorage.setItem(KEY, json({ equipment: ['gone-1', a], product: [], active: 'equipment' }));
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    expect(m.useCompareStore.getState().equipment).toEqual([a]);
  });
});

describe('UT-14 비교 바 표시 경로', () => {
  it.each([
    ['/', true],
    ['/gap', true],
    ['/compare', false],
    ['/compare/', false], // v1.0 끝 슬래시
    ['/compare//', false],
  ])('%s → 바 %s', async (path, visible) => {
    await freshStore(json({ equipment: [a], product: [], active: 'equipment' }));
    const { default: CompareTray } = await import('../../../src/components/compare/CompareTray');
    render(
      <MemoryRouter initialEntries={[path]}>
        <CompareTray />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('compare-tray') !== null).toBe(visible);
  });

  it('제품·기기 둘 다 있으면 종류 전환 버튼에 개수/4', async () => {
    await freshStore(json({ equipment: [a], product: [P1, P2], active: 'product' }));
    const { default: CompareTray } = await import('../../../src/components/compare/CompareTray');
    render(
      <MemoryRouter initialEntries={['/']}>
        <CompareTray />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('compare-tray-kind-equipment')).toHaveTextContent('기기 1/4');
    expect(screen.getByTestId('compare-tray-kind-product')).toHaveTextContent('제품 2/4');
    expect(screen.getByTestId('compare-tray-kind-product')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('UT-14 CompareToggle', () => {
  it('누르면 aria-pressed 토글, 4개 차면 다른 항목 버튼 비활성 + 안내 title', async () => {
    const m = await freshStore();
    const { default: CompareToggle } = await import('../../../src/components/compare/CompareToggle');
    for (const id of [a, b, c]) m.useCompareStore.getState().toggle('equipment', id);
    render(
      <>
        <CompareToggle kind="equipment" id={d} name="D" />
        <CompareToggle kind="equipment" id={e} name="E" />
        <CompareToggle kind="product" id={P1} name="P1 제품" />
      </>,
    );
    const dBtn = screen.getByTestId(`compare-toggle-${d}`);
    fireEvent.click(dBtn);
    expect(dBtn).toHaveAttribute('aria-pressed', 'true');
    const eEq = screen.getByTestId(`compare-toggle-${e}`);
    const eProd = screen.getByTestId(`compare-toggle-${P1}`);
    expect(eEq).toBeDisabled();
    expect(eEq.getAttribute('title')).toContain('가득');
    expect(eProd).not.toBeDisabled(); // 제품 목록은 별도
    fireEvent.click(dBtn);
    expect(dBtn).toHaveAttribute('aria-pressed', 'false');
    expect(eEq).not.toBeDisabled();
  });
});
