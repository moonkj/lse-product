/** 원본 대비 초안 변경 내역 + 커밋 메시지용 요약 markdown */
import { edgeKind } from '../diagram/geometry';
import { nodeName, topologyChanged, type Draft } from './draft';

export type ChangeKind = 'added' | 'modified' | 'deleted';
export type ChangeEntity = 'equipment' | 'node' | 'edge' | 'image';

export interface Change {
  kind: ChangeKind;
  entity: ChangeEntity;
  id: string;
  /** 사람이 읽는 한 줄 */
  text: string;
}

export const ENTITY_LABELS: Record<ChangeEntity, string> = {
  equipment: '기기',
  node: '노드',
  edge: '연결선',
  image: '사진',
};
export const KIND_LABELS: Record<ChangeKind, string> = { added: '추가', modified: '수정', deleted: '삭제' };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const EQ_FIELD_LABELS: Record<string, string> = {
  name: '이름',
  abbr: '약어',
  layer: '계층',
  voltage: '전압',
  category: '기능 분류',
  description: '설명',
  learnPoints: '학습 포인트',
  coverage: '커버리지',
  affiliateName: '계열사명',
  gapNote: '공백 메모',
  lseCategoryCodes: '연결 카테고리',
  productIds: '제품 지정',
};

export function computeChanges(base: Draft, draft: Draft): Change[] {
  const out: Change[] = [];
  const eqName = (d: Draft, id: string) => {
    const e = d.equipmentTypes.find((x) => x.id === id);
    return e ? (e.abbr ? `${e.name}(${e.abbr})` : e.name) : id;
  };

  // 기기
  const bEq = new Map(base.equipmentTypes.map((e) => [e.id, e]));
  const dEq = new Map(draft.equipmentTypes.map((e) => [e.id, e]));
  for (const [id, e] of dEq) {
    const b = bEq.get(id);
    if (!b) out.push({ kind: 'added', entity: 'equipment', id, text: `${eqName(draft, id)} [${e.layer}]` });
    else if (!same(b, e)) {
      const keys = new Set([...Object.keys(b), ...Object.keys(e)]);
      const fields = [...keys]
        .filter((k) => !same((b as Record<string, unknown>)[k], (e as Record<string, unknown>)[k]))
        .map((k) => EQ_FIELD_LABELS[k] ?? k);
      // 키 순서만 다른 경우는 변경 아님
      if (fields.length > 0) out.push({ kind: 'modified', entity: 'equipment', id, text: `${eqName(draft, id)} — ${fields.join(', ')}` });
    }
  }
  for (const id of bEq.keys()) if (!dEq.has(id)) out.push({ kind: 'deleted', entity: 'equipment', id, text: eqName(base, id) });

  // 사진
  for (const id of new Set([...Object.keys(base.images), ...Object.keys(draft.images)])) {
    const b = base.images[id];
    const d = draft.images[id];
    if (!b && d) out.push({ kind: 'added', entity: 'image', id, text: `${eqName(draft, id)} ← ${d.file}` });
    else if (b && !d) out.push({ kind: 'deleted', entity: 'image', id, text: `${eqName(base, id)} (심볼로 표시)` });
    else if (b && d && !same(b, d)) out.push({ kind: 'modified', entity: 'image', id, text: `${eqName(draft, id)} ← ${d.file}` });
  }

  // 노드
  const bN = new Map(base.diagram.nodes.map((n) => [n.id, n]));
  const dN = new Map(draft.diagram.nodes.map((n) => [n.id, n]));
  for (const [id, n] of dN) {
    const b = bN.get(id);
    if (!b) out.push({ kind: 'added', entity: 'node', id, text: `${nodeName(draft, id)} (${n.x}, ${n.y})` });
    else if (!same(b, n)) {
      const moved = b.x !== n.x || b.y !== n.y;
      out.push({
        kind: 'modified',
        entity: 'node',
        id,
        text: moved ? `${nodeName(draft, id)} 이동 (${b.x}, ${b.y}) → (${n.x}, ${n.y})` : `${nodeName(draft, id)} 수정`,
      });
    }
  }
  for (const id of bN.keys()) if (!dN.has(id)) out.push({ kind: 'deleted', entity: 'node', id, text: nodeName(base, id) });

  // 연결선
  const bE = new Map(base.diagram.edges.map((e) => [e.id, e]));
  const dE = new Map(draft.diagram.edges.map((e) => [e.id, e]));
  const edgeText = (d: Draft, id: string) => {
    const e = (d === base ? bE : dE).get(id)!;
    const kind = { power: '전력', signal: '신호', alt: '택1' }[edgeKind(e)];
    return `${id} ${nodeName(d, e.from)} → ${nodeName(d, e.to)} (${kind}${e.voltage ? ` · ${e.voltage}` : ''})`;
  };
  for (const [id, e] of dE) {
    const b = bE.get(id);
    if (!b) out.push({ kind: 'added', entity: 'edge', id, text: edgeText(draft, id) });
    else if (!same(b, e)) {
      const onlyRoute = same({ ...b, points: undefined }, { ...e, points: undefined });
      out.push({ kind: 'modified', entity: 'edge', id, text: `${edgeText(draft, id)}${onlyRoute ? ' — 경로 재계산' : ''}` });
    }
  }
  for (const id of bE.keys()) if (!dE.has(id)) out.push({ kind: 'deleted', entity: 'edge', id, text: edgeText(base, id) });

  return out;
}

/** 커밋 메시지·PR 설명용 변경 요약 */
export function changesMarkdown(base: Draft, draft: Draft, changes: Change[] = computeChanges(base, draft)): string {
  const count = (entity: ChangeEntity, kind: ChangeKind) => changes.filter((c) => c.entity === entity && c.kind === kind).length;
  const parts: string[] = [];
  for (const entity of ['equipment', 'node', 'edge', 'image'] as ChangeEntity[]) {
    const p = (['added', 'modified', 'deleted'] as ChangeKind[])
      .map((k) => (count(entity, k) ? `${KIND_LABELS[k]} ${count(entity, k)}` : ''))
      .filter(Boolean);
    if (p.length) parts.push(`${ENTITY_LABELS[entity]} ${p.join('·')}`);
  }
  const addedEq = changes.filter((c) => c.entity === 'equipment' && c.kind === 'added').map((c) => c.text);
  const title = addedEq.length
    ? `data: 계통도에 ${addedEq.slice(0, 3).join(', ')}${addedEq.length > 3 ? ` 외 ${addedEq.length - 3}종` : ''} 추가`
    : `data: 계통도 데이터 수정 (${parts.join(', ') || '변경 없음'})`;
  const lines = [
    title,
    '',
    `관리자 화면(/#/admin)에서 편집 — ${parts.join(', ') || '변경 없음'}`,
    `결과: 기기 ${draft.equipmentTypes.length}종 · 노드 ${draft.diagram.nodes.length} · 연결선 ${draft.diagram.edges.length}`,
    ...reviewLines(base, draft),
    '',
  ];
  for (const entity of ['equipment', 'node', 'edge', 'image'] as ChangeEntity[]) {
    const list = changes.filter((c) => c.entity === entity);
    if (!list.length) continue;
    lines.push(`## ${ENTITY_LABELS[entity]}`);
    for (const c of list) lines.push(`- ${KIND_LABELS[c.kind]}: ${c.text}`);
    lines.push('');
  }
  return lines.join('\n');
}

type Review = Draft['diagram']['review'];
const reviewText = (r: Review) =>
  r ? `${r.status === 'approved' ? '승인' : '검수 대기(pending)'}${r.changedAt ? ` · 변경일 ${r.changedAt}` : ''}${r.reviewedBy ? ` · 검수 ${r.reviewedBy}` : ''}` : '없음';

/**
 * 계통 검수 상태 줄 (개선 R4 M4 → R5: 재검수 전환 범위를 계통 구조로 한정)
 * - 노드·연결선 변경 → "재검수 전환" + 사유
 * - 기기 정보·사진만 변경 → "유지" + 사유
 */
function reviewLines(base: Draft, draft: Draft): string[] {
  const b = base.diagram.review;
  const d = draft.diagram.review;
  const structural = topologyChanged(base, draft);
  if (!same(b, d) || structural) {
    const why = structural ? '재검수 전환 — 계통 구조(노드·연결선) 변경' : '검수 상태 변경';
    return [`계통 검수 상태: ${reviewText(b)} → ${reviewText(d)} (${why})${d?.note ? ` — ${d.note}` : ''}`];
  }
  if (same(base, draft)) return [];
  return [`계통 검수 상태: 유지 (${reviewText(d)}) — 기기 정보·사진만 변경, 계통 구조(노드·연결선) 변경 없음`];
}
