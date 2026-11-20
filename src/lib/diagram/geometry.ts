/**
 * 계통도 노드 크기·여유 상수와 노드/연결선 종류 판정 — 단일 출처 (리뷰 R4·R7, 개선 R4).
 * 화면(model·DiagramNode·DiagramExtras·DiagramCanvas)·라우터(router.ts)·관리자(draft·AdminCanvas)·
 * 무결성 검사(lib/integrity)가 모두 이 파일을 import 한다. 런타임 의존성 없음 (타입만 import).
 */
import type { DiagramEdge, DiagramNodeKind } from '../schema';

/** 기기 사진 타일 (참조 타일 포함) — diagram.json 좌표 = 타일 중심. 2026-11-20 120×116 → 150×120 (사진 잘림 개선, 세로 간격 최소 153px 이라 높이는 조금만) */
export const TILE_W = 150;
export const TILE_H = 120;
/** 끝점 라벨 상자 */
export const ENDPOINT_W = 120;
export const ENDPOINT_H = 44;
/** 모선 반높이 (모선 두께 8 = 장애물·겹침 판정 기준. 화면 선은 4px) */
export const BUS_HH = 4;

/** 라우터: 선과 타일·끝점 사이 여유(px) — 생성기 CLEAR */
export const ROUTE_CLEAR = 10;
/** 라우터: 선과 모선 사이 여유(px) */
export const ROUTE_BUS_CLEAR = 2;

/** 관리자 배치: 타일·끝점 사이 최소 간격 — 생성기 MIN_GAP (DI-39 SOFT 간격 기준과 같음) */
export const MIN_GAP = 30;
/** 관리자 배치: 모선과 다른 노드 사이 최소 간격 (현재 데이터 최소 28px → 20) */
export const BUS_GAP = 20;
/** 노드 중심 사이 최소 거리 (DI-39) */
export const MIN_NODE_DISTANCE = 24;

/** 화면상 노드 종류 — 데이터 kind(equipment·bus·endpoint) + 참조 타일(ref) 구분 */
export type NodeKind = 'equipment' | 'ref' | 'bus' | 'endpoint';
/** 연결선 종류 (생략 = power) */
export type EdgeKind = NonNullable<DiagramEdge['kind']>;

type NodeLike = { kind?: string; ref?: boolean };

/** 데이터 kind (생략 = 기기) */
export const dataKindOf = (n: { kind?: DiagramNodeKind | string }): DiagramNodeKind =>
  n.kind === 'bus' ? 'bus' : n.kind === 'endpoint' ? 'endpoint' : 'equipment';
/** 화면상 종류 (참조 타일 구분) */
export const nodeKindOf = (n: NodeLike): NodeKind =>
  n.kind === 'bus' ? 'bus' : n.kind === 'endpoint' ? 'endpoint' : n.ref ? 'ref' : 'equipment';
export const isBus = (n: NodeLike) => n.kind === 'bus';
export const isEndpoint = (n: NodeLike) => n.kind === 'endpoint';
/** 기기 노드 (참조 타일 포함) */
export const isEquipmentNode = (n: NodeLike) => dataKindOf(n) === 'equipment';
/** 참조 타일 (같은 기기가 다른 자리에 다시 나옴 — 집계·검색 제외) */
export const isRef = (n: NodeLike) => isEquipmentNode(n) && !!n.ref;
/** 74종 집계 대상 기기 노드 = 참조 타일이 아닌 기기 노드 */
export const isPrimaryEquipmentNode = (n: NodeLike) => isEquipmentNode(n) && !n.ref;

/** 연결선 종류 */
export const edgeKind = (e: { kind?: EdgeKind }): EdgeKind => e.kind ?? 'power';
/** 전력선 (power·alt) — 교차 금지 대상 */
export const isPowerLike = (e: { kind?: EdgeKind }) => edgeKind(e) !== 'signal';

/** 종류별 반폭·반높이 (모선은 width/2 × 4) */
export function halfSize(n: NodeLike & { width?: number }): { hw: number; hh: number } {
  const k = nodeKindOf(n);
  if (k === 'bus') return { hw: (n.width ?? 0) / 2, hh: BUS_HH };
  if (k === 'endpoint') return { hw: ENDPOINT_W / 2, hh: ENDPOINT_H / 2 };
  return { hw: TILE_W / 2, hh: TILE_H / 2 };
}
