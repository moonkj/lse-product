import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import ExternalLink from './ExternalLink';
import './Button.css';

/**
 * 공용 버튼 (디자인 토론 P1 컴포넌트 통일) — 변형 3 × 크기 2.
 * - primary  : 네이비 채움 — 화면당 대표 행동 하나 (예: "계통도에서 보기")
 * - secondary: 외곽선 — 보조 행동 (비교에 담기·공식 페이지 등)
 * - ghost    : 글자만 — 표 안 이동 링크·섹션 이동 등 가벼운 행동
 * 크기 sm 32px · md 40px, 터치 화면은 둘 다 44px (Button.css).
 * 링크도 같은 모양이 필요하면 ButtonLink(내부 라우트) / ButtonExternal(새 탭) 을 쓴다.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md';

interface StyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/** 버튼 모양 클래스 — 다른 요소(예: 토글 컴포넌트)에 같은 모양을 입힐 때 */
export function buttonClass({ variant = 'secondary', size = 'md', className }: StyleProps = {}): string {
  return `btn btn--${variant} btn--${size}${className ? ` ${className}` : ''}`;
}

type ButtonProps = StyleProps & ButtonHTMLAttributes<HTMLButtonElement> & { testId?: string };

export default function Button({ variant, size, className, testId, type = 'button', ...rest }: ButtonProps) {
  return <button {...rest} type={type} data-testid={testId} className={buttonClass({ variant, size, className })} />;
}

type ButtonLinkProps = StyleProps & LinkProps & { testId?: string };

export function ButtonLink({ variant, size, className, testId, ...rest }: ButtonLinkProps) {
  return <Link {...rest} data-testid={testId} className={buttonClass({ variant, size, className })} />;
}

interface ButtonExternalProps extends StyleProps {
  href: string;
  children: ReactNode;
  testId?: string;
}

export function ButtonExternal({ variant, size, className, ...rest }: ButtonExternalProps) {
  return <ExternalLink {...rest} className={buttonClass({ variant, size, className })} />;
}

/**
 * "계통도에서 보기" — 같은 행동은 어디서든 같은 문구·모양 (기기·제품·공백 표).
 * 페이지 머리 = primary md, 표 안 = ghost sm.
 */
export const DIAGRAM_CTA_LABEL = '계통도에서 보기';
