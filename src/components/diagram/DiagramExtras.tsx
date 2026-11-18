import { memo } from 'react';
import { ENDPOINT_H, ENDPOINT_W, type AltBadge, type BusNodeItem, type EndpointItem } from '../../lib/diagram/model';

/**
 * 계통도의 기기가 아닌 요소 (개선 R3 계통 정정) — 일반 화면·관리자 화면 공용.
 * - 모선: 굵은 가로선 4px + 라벨 (클릭 불가)
 * - 끝점: 점선 라벨 상자 120×44 (클릭 불가, 정보만)
 * - 택1 배지: alt 연결선 묶음마다 1개, 툴팁 = 연결선 label. 연결된 기기가 선택되면 label 전체를 펼친다
 */
export const BusNodes = memo(function BusNodes({ buses }: { buses: readonly BusNodeItem[] }) {
  return (
    <>
      {buses.map((b) => (
        <div
          key={b.id}
          className="dbusnode"
          style={{ left: b.x - b.width / 2, top: b.y - 2, width: b.width }}
          data-testid={`diagram-bus-${b.id}`}
          data-node-id={b.id}
          role="img"
          aria-label={`모선: ${b.label}`}
        >
          <span className="dbusnode__label" aria-hidden="true">
            {b.label}
          </span>
        </div>
      ))}
    </>
  );
});

export const EndpointNodes = memo(function EndpointNodes({ endpoints }: { endpoints: readonly EndpointItem[] }) {
  return (
    <>
      {endpoints.map((p) => (
        <div
          key={p.id}
          className="dendpoint"
          style={{ left: p.x - ENDPOINT_W / 2, top: p.y - ENDPOINT_H / 2, width: ENDPOINT_W, height: ENDPOINT_H }}
          data-testid={`diagram-endpoint-${p.id}`}
          data-node-id={p.id}
          title={p.label}
          role="note"
          aria-label={`끝점: ${p.label}`}
        >
          {p.label}
        </div>
      ))}
    </>
  );
});

export const AltBadges = memo(function AltBadges({
  badges,
  activeEdges,
}: {
  badges: readonly AltBadge[];
  /** 선택된 노드에 붙은 연결선 — 포함되면 label 전체 표시 */
  activeEdges?: ReadonlySet<string>;
}) {
  return (
    <>
      {badges.map((b) => {
        const open = !!activeEdges && b.edgeIds.some((id) => activeEdges.has(id));
        return (
          <span
            key={b.id}
            className={`dalt${open ? ' is-open' : ''}`}
            style={{ left: b.x, top: b.y }}
            title={b.label}
            role="note"
            aria-label={`택1: ${b.label}`}
            data-testid={`diagram-alt-badge-${b.edgeIds[0]}`}
          >
            <span aria-hidden="true">{open ? b.label : '택1'}</span>
          </span>
        );
      })}
    </>
  );
});
