import type { AnchorHTMLAttributes, ReactNode } from 'react';

interface Props extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel'> {
  href: string;
  children: ReactNode;
  testId?: string;
}

/**
 * 외부 링크 공용 컴포넌트 — 항상 새 탭 + rel="noopener noreferrer".
 * 스키마 검증을 통과했더라도 https 가 아니면 링크로 만들지 않는다 (이중 방어).
 */
export default function ExternalLink({ href, children, testId, className, ...rest }: Props) {
  if (!/^https:\/\//i.test(href)) {
    return <span className={className}>{children}</span>;
  }
  return (
    <a {...rest} className={className} href={href} target="_blank" rel="noopener noreferrer" data-testid={testId}>
      {children}
      <span className="visually-hidden"> (새 탭에서 열림)</span>
    </a>
  );
}
