/**
 * 컴포넌트 테스트 (UX 토론 B10) — 청크·CSS 를 못 받은 오류(오프라인)는 영문 메시지 대신 한글 안내 + [다시 시도].
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import PageErrorBoundary from '../../../src/components/common/PageErrorBoundary';
import { isNetworkError } from '../../../src/components/common/ErrorDetails';

function Boom({ error }: { error: Error }): never {
  throw error;
}

let consoleError: { mockRestore: () => void };
beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  consoleError.mockRestore();
  vi.unstubAllGlobals();
});

describe('B10 오프라인·청크 로드 실패 안내', () => {
  it('브라우저별 청크 실패 문구를 네트워크 오류로 판정', () => {
    expect(isNetworkError(new Error('Unable to preload CSS for /assets/ProductPage-abc.css'))).toBe(true);
    expect(isNetworkError(new TypeError('Failed to fetch dynamically imported module: http://x/assets/a.js'))).toBe(true);
    expect(isNetworkError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isNetworkError(new Error('Cannot read properties of undefined'))).toBe(false);
  });

  it('배포 직후 첫 청크 실패 → 오류 화면 대신 "새 버전을 불러오는 중"만 (곧 자동 새로고침, 2026-11-23 깜빡임 수정)', () => {
    sessionStorage.removeItem('lse-fresh-reload-at');
    render(
      <PageErrorBoundary resetKey="/equipment/vcb">
        <Boom error={new TypeError('Failed to fetch dynamically imported module: /assets/EquipmentPage-old.js')} />
      </PageErrorBoundary>,
    );
    expect(screen.getByTestId('page-fresh-reload')).toHaveTextContent('새 버전을 불러오는 중');
    expect(screen.queryByTestId('page-error')).toBeNull();
  });

  it('청크 실패(자동 새로고침을 이미 한 뒤) → 한글 제목·안내 + 다시 시도 버튼, 영문 메시지 없음', () => {
    sessionStorage.setItem('lse-fresh-reload-at', String(Date.now()));
    render(
      <PageErrorBoundary resetKey="/product/P1">
        <Boom error={new Error('Unable to preload CSS for /assets/ProductPage.css')} />
      </PageErrorBoundary>,
    );
    const box = screen.getByTestId('page-error');
    expect(box).toHaveAttribute('data-kind', 'network');
    expect(box).toHaveTextContent('이 화면을 불러오지 못했습니다');
    expect(box).toHaveTextContent('네트워크에 연결할 수 없습니다');
    expect(box).not.toHaveTextContent('Unable to preload');
    expect(screen.getByTestId('page-error-retry')).toHaveTextContent('다시 시도');
  });

  it('아직 오프라인이면 다시 시도해도 새로고침하지 않고 안내', () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: false });
    render(
      <PageErrorBoundary resetKey="/compare">
        <Boom error={new TypeError('Failed to fetch dynamically imported module: /assets/ComparePage.js')} />
      </PageErrorBoundary>,
    );
    fireEvent.click(screen.getByTestId('page-error-retry'));
    expect(screen.getByTestId('page-error')).toHaveTextContent('아직 오프라인입니다');
  });

  it('일반 렌더 오류는 기존처럼 메시지 + 새로고침', () => {
    render(
      <PageErrorBoundary resetKey="/x">
        <Boom error={new Error('boom')} />
      </PageErrorBoundary>,
    );
    expect(screen.getByTestId('page-error')).toHaveTextContent('이 화면을 표시하는 중 오류가 발생했습니다');
    expect(screen.getByTestId('page-error-retry')).toHaveTextContent('새로고침');
  });
});
