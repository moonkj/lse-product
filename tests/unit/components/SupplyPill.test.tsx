/**
 * 컴포넌트 테스트 — SupplyPill (실시간 전력수급 알약, DEBATE.md 신규 안건 2 · 시안 E1 A안)
 * fetch 는 가짜로 바꿔 끼운다 (실제 네트워크·API 호출 없음).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, act, fireEvent, waitFor } from '@testing-library/react';
import SupplyPill from '../../../src/components/diagram/SupplyPill';
import { subscribeAnnounce } from '../../../src/lib/announce';
import type { SupplyData } from '../../../src/lib/supply';

const row = (t: string, demand: number, supply: number) => ({
  t, demand, supply, reserve: +(supply - demand).toFixed(2), rate: +(((supply - demand) / demand) * 100).toFixed(1),
});
const make = (reserveGap: number, asof = '2026-11-19T14:20:00+09:00', extra: Partial<SupplyData> = {}): SupplyData => {
  const rows = [row('2026-11-19T14:10:00+09:00', 70, 80), row('2026-11-19T14:15:00+09:00', 71, 80), row(asof, 70, 70 + reserveGap)];
  return { asof, rows, latest: rows[2], source: '전력거래소 공개 데이터', generatedAt: '2026-11-19T05:21:00Z', ...extra };
};
const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-11-19T05:25:00Z') }); // 14:25 KST
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('SupplyPill', () => {
  it('JSON 이 없으면(404) 아무것도 그리지 않음', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 404 }));
    const { container } = render(<SupplyPill />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/data\/supply\.json$/);
  });

  it('정상: "예비율 14.3% · 정상 · 14:20 기준", 출처 title, 누르면 팝오버(수요·공급능력·예비력·출처·다음 갱신)', async () => {
    fetchMock.mockImplementation(() => ok(make(10)));
    render(<SupplyPill />);
    const pill = await screen.findByTestId('supply-pill');
    expect(pill).toHaveTextContent('예비율14.3%·정상14:20 기준');
    expect(pill).toHaveAttribute('data-tone', 'normal');
    expect(pill).toHaveAttribute('title', '출처: 전력거래소 공개 데이터 · 14:20 기준');
    expect(pill).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(pill);
    const pop = screen.getByTestId('supply-popover');
    expect(pill).toHaveAttribute('aria-expanded', 'true');
    expect(pop).toHaveTextContent('현재 수요70.0 GW');
    expect(pop).toHaveTextContent('공급능력80.0 GW');
    expect(pop).toHaveTextContent('공급예비력10.00 GW');
    expect(screen.getByTestId('supply-source')).toHaveTextContent('출처: 전력거래소 공개 데이터 · 14:20 기준 · 다음 갱신 약 14:41');
    expect(pop.querySelector('.supply__spark-demand')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('supply-popover')).toBeNull();
    expect(pill).toHaveFocus();
  });

  it('예비력 GW 단계: 3.0GW → 주의(주황 톤)', async () => {
    fetchMock.mockImplementation(() => ok(make(3)));
    render(<SupplyPill />);
    const pill = await screen.findByTestId('supply-pill');
    expect(pill).toHaveAttribute('data-tone', 'caution');
    expect(pill).toHaveTextContent('주의');
  });

  it('40분 넘게 갱신 없으면 회색 "지연 · 마지막 13:30"', async () => {
    fetchMock.mockImplementation(() => ok(make(10, '2026-11-19T13:30:00+09:00')));
    render(<SupplyPill />);
    const pill = await screen.findByTestId('supply-pill');
    expect(pill).toHaveAttribute('data-tone', 'stale');
    expect(pill).toHaveTextContent('지연 · 마지막 13:30');
  });

  it('수집 실패(failedAt)면 마지막 값 + "갱신 실패"', async () => {
    fetchMock.mockImplementation(() => ok(make(10, undefined, { failedAt: '2026-11-19T05:24:00Z' })));
    render(<SupplyPill />);
    const pill = await screen.findByTestId('supply-pill');
    expect(pill).toHaveTextContent('14.3%');
    expect(pill).toHaveTextContent('갱신 실패 · 마지막 14:20');
  });

  it('10분마다 다시 읽고, 단계가 바뀔 때만 한 번 알림 · 다시 읽기 실패면 "갱신 실패"', async () => {
    const said: string[] = [];
    const off = subscribeAnnounce((m) => said.push(m));
    fetchMock.mockImplementationOnce(() => ok(make(10)));
    render(<SupplyPill pollMs={1000} />);
    await screen.findByTestId('supply-pill');
    expect(said).toEqual([]);

    fetchMock.mockImplementationOnce(() => ok(make(10)));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(said).toEqual([]); // 정기 갱신은 읽지 않음

    fetchMock.mockImplementationOnce(() => ok(make(2)));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    await waitFor(() => expect(screen.getByTestId('supply-pill')).toHaveAttribute('data-tone', 'alert'));
    expect(said).toHaveLength(1);
    expect(said[0]).toMatch(/경계/);

    fetchMock.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    await waitFor(() => expect(screen.getByTestId('supply-pill')).toHaveTextContent('갱신 실패'));
    off();
  });

  it('탭이 숨겨지면 다시 읽기를 멈춤', async () => {
    fetchMock.mockImplementation(() => ok(make(10)));
    render(<SupplyPill pollMs={1000} />);
    await screen.findByTestId('supply-pill');
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    hidden.mockReturnValue(false);
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(fetchMock).toHaveBeenCalledTimes(2); // 기한이 지났으니 바로 읽음
    hidden.mockRestore();
  });
});
