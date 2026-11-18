/**
 * 계통 연결 관계 규칙 — 상세 패널 이웃 칩(model.ts)과 제품·기기 페이지 미니 체인(catalog.ts)이 같이 쓴다 (리뷰 R5).
 * 규칙: 모선은 그 자체로 이웃이 아니라 "모선 너머" 노드로 한 단계 건너간다.
 */

export interface Hop<E> {
  /** 자기 노드에 붙은 연결선 */
  edge: E;
  /** 이웃 노드 id (모선이면 모선 너머 노드) */
  id: string;
  /** 모선을 거친 경우 모선 id 와 모선→이웃 연결선 */
  via?: { busId: string; edge: E };
}

type EdgeLike = { from: string; to: string };

/**
 * 노드의 이웃 목록. dir: 'in' = 들어오는 선(edge.to = 자기)만 따라감, 'out' = 나가는 선만, 'both' = 양쪽.
 * 모선을 만나면 같은 방향 규칙으로 모선의 연결선을 한 번 더 따라간다 (자기 자신은 제외, 1단계만 — 순환 없음).
 */
export function hopsAcrossBus<E extends EdgeLike>(
  selfId: string,
  edges: readonly E[],
  isBusId: (id: string) => boolean,
  dir: 'in' | 'out' | 'both' = 'both',
): Hop<E>[] {
  const step = (id: string) =>
    edges.flatMap((e) => {
      const out: { edge: E; id: string }[] = [];
      if (dir !== 'in' && e.from === id) out.push({ edge: e, id: e.to });
      if (dir !== 'out' && e.to === id) out.push({ edge: e, id: e.from });
      return out;
    });
  return step(selfId).flatMap((h) =>
    isBusId(h.id)
      ? step(h.id)
          .filter((h2) => h2.id !== selfId)
          .map((h2) => ({ edge: h.edge, id: h2.id, via: { busId: h.id, edge: h2.edge } }))
      : [h],
  );
}

/**
 * 모선을 거친 이웃의 위치 관계: 이웃이 모선에 전원을 넣는 쪽(상위)이면 'up', 자기가 모선에 전원을 넣고 이웃이 받는 쪽이면 'down',
 * 둘 다 같은 쪽(같은 모선의 형제 피더)이면 'sibling'.
 */
export function busRelation<E extends EdgeLike>(h: Hop<E>): 'up' | 'down' | 'sibling' | undefined {
  if (!h.via) return undefined;
  const bus = h.via.busId;
  const farFeeds = h.via.edge.to === bus;
  const selfFeeds = h.edge.to === bus;
  if (farFeeds && !selfFeeds) return 'up';
  if (!farFeeds && selfFeeds) return 'down';
  return 'sibling';
}
