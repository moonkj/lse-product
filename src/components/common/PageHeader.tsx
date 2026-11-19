import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Layer } from '../../lib/schema';
import type { JumpState } from '../diagram/DiagramCanvas';
import './PageHeader.css';

/**
 * 브레드크럼 한 칸. to 가 있으면 링크, layer 가 있으면 계통도의 그 계층으로 이동하는 링크(jumpTo),
 * 둘 다 없으면 현재 위치(마지막 칸, aria-current).
 */
export interface Crumb {
  label: ReactNode;
  to?: string;
  layer?: Layer;
}

/** 계통도의 계층으로 이동하는 링크 state — 계통도(DiagramCanvas)가 그 계층 밴드에 맞춰 연다 */
export function jumpState(layer: Layer): JumpState {
  return { jumpTo: layer };
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="경로">
      <ol className="pg-crumbs">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} aria-current={last && !c.to && !c.layer ? 'page' : undefined}>
              {c.layer ? (
                <Link to="/" state={jumpState(c.layer)}>
                  {c.label}
                </Link>
              ) : c.to ? (
                <Link to={c.to}>{c.label}</Link>
              ) : (
                c.label
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface Props {
  crumbs: Crumb[];
  /** 제목 (없으면 브레드크럼만 — 기기·제품 페이지는 사진 히어로 안에 제목이 있음) */
  title?: ReactNode;
  titleId?: string;
  titleTestId?: string;
  /** 제목 아래 보조문 */
  lead?: ReactNode;
  /** 오른쪽 액션 슬롯 (버튼·KPI 등) */
  actions?: ReactNode;
  className?: string;
}

/**
 * 페이지 머리말 1종 (디자인 토론 P1) — 브레드크럼 → 제목(--fs-xl) → 보조문, 오른쪽 액션 슬롯.
 * 기기·제품·비교·공백 표 페이지 공용.
 */
export default function PageHeader({ crumbs, title, titleId, titleTestId, lead, actions, className }: Props) {
  return (
    <div className={`pghead${className ? ` ${className}` : ''}`}>
      <Breadcrumbs items={crumbs} />
      {(title || actions) && (
        <div className="pghead__row">
          <div className="pghead__text">
            {title && (
              <h1 id={titleId} className="pghead__title" data-testid={titleTestId}>
                {title}
              </h1>
            )}
            {lead && <div className="pghead__lead">{lead}</div>}
          </div>
          {actions && <div className="pghead__actions">{actions}</div>}
        </div>
      )}
    </div>
  );
}
