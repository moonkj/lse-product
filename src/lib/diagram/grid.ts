/**
 * 계통 종류 (2026-11-23 사용자: 데이터센터 계통 탭) — 계통도 화면에서 [국내 표준 | 데이터센터(국내)] 전환.
 * 주소 `?grid=dc` 가 원본 (국내 표준은 생략). 데이터센터 노드 id 는 모두 'dc-' 로 시작한다.
 *
 * 계통도 모델(getDiagramModel)은 렌더 중 "지금 계통"을 읽는다 → AppLayout 이 자식보다 먼저 setActiveGrid 로 맞춘다.
 */
import { useSearchParams } from 'react-router-dom';
import type { Diagram } from '../schema';

export type GridId = 'std' | 'dc';
export const GRID_IDS: readonly GridId[] = ['std', 'dc'];
export const GRID_LABELS: Record<GridId, string> = { std: '국내 표준', dc: '데이터센터(국내)' };
export const GRID_TITLES: Record<GridId, string> = {
  std: '발전·송변전부터 수용가 부하까지 국내 표준 전력계통',
  dc: '22.9kV 수전 데이터센터 — 기존 AC(변압기·UPS) 경로와 차세대 DC(SST·800V DC) 경로',
};

export const parseGrid = (v: string | null | undefined): GridId => (v === 'dc' ? 'dc' : 'std');

/** 노드 id 로 어느 계통도 노드인지 (데이터센터 = 'dc-' 접두사) */
export const gridOfNode = (nodeId: string | undefined | null): GridId => (nodeId?.startsWith('dc-') ? 'dc' : 'std');

let active: GridId = 'std';
export const getActiveGrid = (): GridId => active;
export function setActiveGrid(g: GridId): void {
  active = g;
}

export function useGrid(): GridId {
  const [params] = useSearchParams();
  return parseGrid(params.get('grid'));
}

/** 계통 전환 — 선택 노드는 다른 계통도에 없으므로 지운다 */
export function useSetGrid() {
  const [params, setParams] = useSearchParams();
  return (g: GridId) => {
    const next = new URLSearchParams(params);
    if (g === 'std') next.delete('grid');
    else next.set('grid', g);
    next.delete('node');
    setParams(next);
  };
}

export function diagramOf(data: { diagram: Diagram; diagramDc: Diagram }, g: GridId): Diagram {
  // 테스트용 가짜 데이터처럼 데이터센터 계통도가 없으면 국내 표준
  return g === 'dc' && data.diagramDc ? data.diagramDc : data.diagram;
}
