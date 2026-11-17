/**
 * 컴포넌트 테스트 (CT-02) — ExternalLink: https 만 링크, 항상 새 탭 + noopener noreferrer
 * docs/test-plan.md §3b
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ExternalLink from '../../../src/components/common/ExternalLink';

afterEach(cleanup);

describe('CT-02 ExternalLink', () => {
  it('https URL → 새 탭(target=_blank) + rel="noopener noreferrer" 링크, 새 탭 안내 문구 포함', () => {
    render(
      <ExternalLink href="https://www.ls-electric.com/ko/product/view/P01062" testId="ext">
        공식 페이지
      </ExternalLink>,
    );
    const a = screen.getByTestId('ext');
    expect(a.tagName).toBe('A');
    expect(a).toHaveAttribute('href', 'https://www.ls-electric.com/ko/product/view/P01062');
    expect(a).toHaveAttribute('target', '_blank');
    expect(a).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(a).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
    expect(a).toHaveTextContent('새 탭');
  });

  it.each([
    'http://www.ls-electric.com/',
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '/ko/product/view/P01062',
    '//evil.example.com/x',
    'ftp://ls-electric.com/a.pdf',
    '',
  ])('https 가 아닌 %j → <a> 를 만들지 않고 텍스트만 표시', (href) => {
    const { container } = render(
      <ExternalLink href={href} testId="ext">
        자료
      </ExternalLink>,
    );
    expect(container.querySelector('a')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('자료')).toBeInTheDocument();
  });
});
