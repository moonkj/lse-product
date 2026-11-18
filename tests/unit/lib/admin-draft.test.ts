// @vitest-environment node
/**
 * 단위 테스트 (UT-12, v0.7 R4) — 관리자 초안 편집 src/lib/admin/draft.ts + 검사 src/lib/admin/integrity.ts
 *
 * - validateDraft(현재 데이터) = 오류 0 (DI 테스트와 같은 공용 검사)
 * - 노드 추가·이동·모선 길이 변경·삭제·연결 추가/삭제 뒤 검사 결과 (규칙 ID 까지)
 * - 계통 검수 상태 syncReview: 편집하면 pending 자동 전환, 되돌리면 원본 review 복원
 * - 패널 구성품(sourced): 공급 방식이 panel-sourced 가 아니면 DI-27b 오류 (폼의 강제 고정은 E2E-ADM-4)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  ADMIN_REVIEW_NOTE,
  addEdge,
  addNode,
  addSpecialNode,
  deleteEdge,
  deleteEquipment,
  deleteNode,
  findFreeSpot,
  moveNode,
  nextEdgeId,
  shapeOf,
  suggestId,
  syncReview,
  topologyChanged,
  updateNode,
  upsertEquipment,
  checkPlacement,
  canonicalEquipment,
  toJsonText,
  type Draft,
} from '../../../src/lib/admin/draft';
import { coverageIssues, validateDraft, type Issue } from '../../../src/lib/admin/integrity';
import type { EquipmentType } from '../../../src/lib/schema';

const DATA = fileURLToPath(new URL('../../../src/data/', import.meta.url));
const read = (f: string) => JSON.parse(readFileSync(DATA + f, 'utf8'));
const ref = { categories: read('categories.json'), products: read('products.json') };
const TODAY = '2026-11-18';
const base = (): Draft => ({ equipmentTypes: read('equipment-types.json'), diagram: read('diagram.json'), images: read('equipment-images.json') });

const errors = (d: Draft) => validateDraft(d, ref, TODAY).filter((i) => i.level === 'error');
const rulesOf = (list: Issue[]) => [...new Set(list.map((i) => i.area))].sort();
const node = (d: Draft, id: string) => d.diagram.nodes.find((n) => n.id === id)!;

const acbCode = () => base().equipmentTypes.find((e) => e.id === 'acb')!.lseCategoryCodes[0];
const newEq = (over: Partial<EquipmentType> = {}): EquipmentType => ({
  id: 'test-cb',
  name: '테스트 차단기',
  abbr: 'TCB',
  layer: 'L6',
  voltage: '380V',
  category: 'switching',
  description: '테스트',
  learnPoints: ['x'],
  coverage: 'owned',
  lseCategoryCodes: [acbCode()],
  ...over,
});

describe('UT-12 validateDraft — 현재 데이터', () => {
  it('원본 초안 = 오류 0 · 경고 0 (DI 테스트와 같은 기준)', () => {
    const all = validateDraft(base(), ref, TODAY);
    expect(all.map((i) => `${i.level} ${i.area} ${i.message}`)).toEqual([]);
  });
  it('Issue 변환: area = 규칙 ID, nodeId/edgeId/equipmentId 를 넘겨 클릭 이동에 쓴다', () => {
    const d = base();
    d.diagram.edges = d.diagram.edges.filter((e) => e.from !== 'n-mccb' && e.to !== 'n-mccb');
    const e = errors(d).find((i) => i.area === 'DI-40');
    expect(e).toMatchObject({ level: 'error', area: 'DI-40', nodeId: 'n-mccb' });
  });
});

describe('UT-12 편집 연산 → 검사 결과', () => {
  it('기기 추가 → 자동 배치(findFreeSpot) → 노드 추가: 연결 전 DI-40, 380V 모선 연결 뒤 오류 0', () => {
    let d = upsertEquipment(base(), newEq(), undefined);
    expect(rulesOf(errors(d))).toEqual(['DI-43']); // 아직 배치 안 됨
    const p = findFreeSpot(d, 'L6');
    expect(p).not.toBeNull();
    const r = addNode(d, 'test-cb', p!.x, p!.y);
    expect(r.error).toBeUndefined();
    expect(r.createdId).toBe('n-test-cb');
    d = r.draft;
    expect(rulesOf(errors(d))).toEqual(['DI-40']);
    const bus = node(d, 'bus-380');
    if (Math.abs(p!.x - bus.x) <= (bus.width ?? 0) / 2) {
      const e = addEdge(d, 'bus-380', 'n-test-cb', 'power');
      expect(e.error).toBeUndefined();
      const added = e.draft.diagram.edges.at(-1)!;
      expect(added.id).toBe(e.createdId);
      expect(added.points?.[0]).toEqual({ x: p!.x, y: bus.y }); // 모선 위 점에서 수직
      expect(added.points?.[1].x).toBe(p!.x);
      expect(errors(e.draft)).toEqual([]);
    } else {
      throw new Error(`자동 배치 자리 ${p!.x} 가 380V 모선 범위 밖 — 시나리오 갱신 필요`);
    }
  });

  it('배치 거부: 밴드 밖·다른 노드와 너무 가까움·모선 위 (사유 문자열)', () => {
    const d = upsertEquipment(base(), newEq(), undefined);
    const ms = node(d, 'n-ms');
    expect(addNode(d, 'test-cb', 100, 50).error).toMatch(/밴드 안에만/);
    const mccb = node(d, 'n-mccb'); // L6 기기
    expect(addNode(d, 'test-cb', mccb.x + 20, mccb.y).error).toMatch(/너무 가깝습니다 \(최소 간격 30px\)/);
    expect(addSpecialNode(d, { kind: 'bus', label: 'x', layer: 'L7', width: 300 }, ms.x, ms.y).error).toMatch(/너무 가깝습니다 \(최소 간격 20px\)/);
    expect(addSpecialNode(d, { kind: 'bus', label: 'x', layer: 'L7', width: 40 }, ms.x, ms.y).error).toMatch(/60px 이상/);
    expect(addSpecialNode(d, { kind: 'endpoint', label: ' ', layer: 'L7' }, ms.x, ms.y).error).toMatch(/라벨/);
    expect(checkPlacement(d, 'L6', node(d, 'bus-380').x, node(d, 'bus-380').y, undefined, shapeOf('bus', 200))).toMatch(/너무 가깝습니다/);
  });

  it('노드 이동: 같은 자리는 변경 없음, 범위 안 이동은 연결선 재계산·오류 0, 모선 수직 이동도 피더 points 갱신', () => {
    const d = base();
    const b = node(d, 'bus-380');
    expect(moveNode(d, 'bus-380', b.x, b.y).draft).toBe(d);
    const r = moveNode(d, 'bus-380', b.x, b.y + 10);
    expect(r.error).toBeUndefined();
    const busEdges = r.draft.diagram.edges.filter((e) => e.from === 'bus-380' || e.to === 'bus-380');
    expect(busEdges.length).toBeGreaterThanOrEqual(2);
    for (const e of busEdges) {
      const pts = e.from === 'bus-380' ? e.points! : [...e.points!].reverse();
      expect(pts[0].y).toBe(b.y + 10);
      expect(pts[1].x).toBe(pts[0].x);
    }
    expect(errors(r.draft)).toEqual([]);
  });

  it('모선 길이 변경: 피더가 범위 안에 남으면 허용(오류 0), 피더가 범위 밖이 되면 거부, 60 미만 거부', () => {
    const d = base();
    const b = node(d, 'bus-380');
    const longer = updateNode(d, 'bus-380', { width: (b.width ?? 0) + 20 });
    expect(longer.error).toBeUndefined();
    expect(node(longer.draft, 'bus-380').width).toBe((b.width ?? 0) + 20);
    expect(errors(longer.draft)).toEqual([]);
    expect(updateNode(d, 'bus-380', { width: 61 }).error).toMatch(/모선 길이를 바꿀 수 없습니다 — .*모선 범위 밖/);
    expect(updateNode(d, 'bus-380', { width: 59 }).error).toMatch(/60px 이상/);
    expect(updateNode(d, 'bus-380', { label: ' ' }).error).toMatch(/라벨을 비울 수 없습니다/);
  });

  it('노드 삭제: 붙은 연결선도 삭제 → 고립 노드는 DI-40, 기기만 남으면 deleteEquipment 거부', () => {
    const d = base();
    const r = deleteNode(d, 'bus-380');
    expect(r.error).toBeUndefined();
    expect(r.draft.diagram.nodes.some((n) => n.id === 'bus-380')).toBe(false);
    expect(r.draft.diagram.edges.some((e) => e.from === 'bus-380' || e.to === 'bus-380')).toBe(false);
    expect(rulesOf(errors(r.draft))).toEqual(['DI-40']);
    const acbNode = d.diagram.nodes.find((n) => n.equipmentTypeId === 'acb' && !n.ref)!;
    expect(deleteEquipment(d, 'acb').error).toMatch(/노드 .*개가 남아 있어 삭제할 수 없습니다/);
    // 노드를 먼저 지우면 기기 삭제 가능 (참조 타일까지 모두)
    let x = d;
    for (const n of d.diagram.nodes.filter((n) => n.equipmentTypeId === 'acb')) x = deleteNode(x, n.id).draft;
    const del = deleteEquipment(x, 'acb');
    expect(del.error).toBeUndefined();
    expect(del.draft.equipmentTypes.some((e) => e.id === 'acb')).toBe(false);
    expect(del.draft.images.acb).toBeUndefined();
    expect(acbNode).toBeDefined();
  });

  it('연결 추가·삭제: 중복·자기 연결 거부, 연결 삭제 시 고립되면 DI-40, 다시 추가하면 오류 0', () => {
    const d = base();
    const e = d.diagram.edges.find((x) => x.from === 'n-mccb' || x.to === 'n-mccb')!;
    expect(addEdge(d, e.from, e.to, 'power').error).toMatch(/이미 연결되어 있습니다/);
    expect(addEdge(d, e.to, e.from, 'power').error).toMatch(/이미 연결되어 있습니다/);
    expect(addEdge(d, 'n-mccb', 'n-mccb', 'power').error).toMatch(/같은 노드/);
    expect(addEdge(d, 'n-mccb', 'ghost', 'power').error).toMatch(/찾을 수 없습니다/);
    const onlyMccb = d.diagram.edges.filter((x) => x.from === 'n-mccb' || x.to === 'n-mccb');
    let x = d;
    for (const y of onlyMccb) x = deleteEdge(x, y.id);
    expect(rulesOf(errors(x))).toContain('DI-40');
    const back = addEdge(x, e.from, e.to, (e.kind ?? 'power') as 'power', e.voltage, e.label);
    expect(back.error).toBeUndefined();
    expect(back.createdId).toBe(nextEdgeId(x));
    if (onlyMccb.length === 1) expect(errors(back.draft)).toEqual([]);
  });

  it('택1 연결선: 라벨 없이 alt 하나만 추가 → DI-43c', () => {
    const d = upsertEquipment(base(), newEq(), undefined);
    const p = findFreeSpot(d, 'L6')!;
    const n = addNode(d, 'test-cb', p.x, p.y).draft;
    const r = addEdge(n, 'bus-380', 'n-test-cb', 'alt');
    expect(r.error).toBeUndefined();
    expect(rulesOf(errors(r.draft))).toEqual(['DI-43c']);
  });

  it('참조 타일: 원래 기기 노드 없이 추가 거부, 라벨 없이 추가 후 연결하면 DI-43 (라벨 필요)', () => {
    let d = upsertEquipment(base(), newEq({ id: 'lonely', name: '외톨이' }), undefined);
    const spot = findFreeSpot(d, 'L6', shapeOf('ref'))!;
    expect(addSpecialNode(d, { kind: 'ref', equipmentId: 'lonely', label: 'x' }, spot.x, spot.y).error).toMatch(/원래 기기 노드를 먼저/);
    d = base();
    const r = addSpecialNode(d, { kind: 'ref', equipmentId: 'acb', label: '' }, spot.x, spot.y);
    expect(r.error).toBeUndefined();
    const id = r.createdId!;
    expect(node(r.draft, id)).toMatchObject({ ref: true, equipmentTypeId: 'acb' });
    expect(node(r.draft, id).label).toBeUndefined();
    const linked = addEdge(r.draft, 'bus-380', id, 'power');
    expect(linked.error).toBeUndefined();
    expect(rulesOf(errors(linked.draft))).toEqual(['DI-43']);
  });
});

describe('UT-12 계통 검수 상태 syncReview (개선 R4 M4)', () => {
  it('편집하면 pending + changedAt 오늘 + 안내 문구, 키 순서 width·height·review·…', () => {
    const b = base();
    const moved = moveNode(b, 'bus-380', node(b, 'bus-380').x, node(b, 'bus-380').y + 10).draft;
    expect(topologyChanged(b, moved)).toBe(true);
    const s = syncReview(b, moved, TODAY);
    expect(s.diagram.review).toEqual({ status: 'pending', changedAt: TODAY, note: ADMIN_REVIEW_NOTE });
    expect(Object.keys(s.diagram).slice(0, 3)).toEqual(['width', 'height', 'review']);
    expect(errors(s)).toEqual([]);
  });

  it('approved 원본도 편집하면 pending (재검수 필요)', () => {
    const b = base();
    b.diagram.review = { status: 'approved', reviewedBy: '설계팀', reviewedAt: '2026-11-18' };
    const moved = moveNode(b, 'bus-380', node(b, 'bus-380').x, node(b, 'bus-380').y + 10).draft;
    expect(syncReview(b, moved, '2026-11-19').diagram.review).toEqual({ status: 'pending', changedAt: '2026-11-19', note: ADMIN_REVIEW_NOTE });
  });

  it('되돌려 원본과 같아지면 원본 review 복원 (approved 포함), 사진만 바뀐 경우는 그대로', () => {
    const b = base();
    b.diagram.review = { status: 'approved', reviewedBy: '설계팀', reviewedAt: '2026-11-18' };
    const edited = syncReview(b, moveNode(b, 'bus-380', node(b, 'bus-380').x, node(b, 'bus-380').y + 10).draft, TODAY);
    const undone = syncReview(b, { ...b, diagram: { ...b.diagram, review: edited.diagram.review } }, TODAY);
    expect(undone.diagram.review).toEqual(b.diagram.review);
    // 사진만 변경
    const photo = { ...b, images: { ...b.images } };
    delete photo.images[Object.keys(photo.images)[0]];
    expect(topologyChanged(b, photo)).toBe(false);
    expect(syncReview(b, photo, TODAY)).toBe(photo);
    // 변경 없는 초안은 같은 객체 (불필요한 히스토리·저장 방지)
    expect(syncReview(b, b, TODAY)).toBe(b);
  });
});

describe('UT-12 기기 저장·판정 근거', () => {
  it('sourced 인데 공급 방식이 panel-sourced 가 아니면 DI-27b 오류, panel-sourced 면 통과 (폼 고정은 E2E-ADM-4)', () => {
    const b = base();
    const target = b.equipmentTypes.find((e) => e.coverage === 'sourced')!;
    expect(target.gapAssessment?.supplyMode).toBe('panel-sourced');
    const bad = upsertEquipment(b, { ...target, gapAssessment: { ...target.gapAssessment!, supplyMode: 'unknown' } }, undefined);
    expect(rulesOf(errors(bad))).toEqual(['DI-27b']);
    expect(coverageIssues({ ...target, gapAssessment: { ...target.gapAssessment!, supplyMode: 'in-house' } }, ref)).toEqual([
      expect.objectContaining({ field: 'gapAssessment', level: 'error' }),
    ]);
    expect(coverageIssues(target, ref).filter((i) => i.level === 'error')).toEqual([]);
  });

  it('upsertEquipment: 원본 키 순서 유지·빈 선택 필드 생략, 사진 null = 삭제', () => {
    const b = base();
    const acb = b.equipmentTypes.find((e) => e.id === 'acb')!;
    const same = upsertEquipment(b, { ...acb, gapNote: '', productIds: [] }, undefined);
    const saved = same.equipmentTypes.find((e) => e.id === 'acb')!;
    expect(saved).toEqual(canonicalEquipment(acb));
    expect(Object.keys(canonicalEquipment(newEq({ gapNote: '' })))).toEqual(['id', 'name', 'layer', 'voltage', 'category', 'description', 'learnPoints', 'coverage', 'lseCategoryCodes', 'abbr']);
    const withImg = Object.keys(b.images)[0];
    expect(upsertEquipment(b, b.equipmentTypes.find((e) => e.id === withImg)!, null).images[withImg]).toBeUndefined();
    // 원본 그대로 저장하면 파일 텍스트도 같다 (불필요한 diff 없음)
    expect(toJsonText(upsertEquipment(b, acb, undefined).equipmentTypes)).toBe(toJsonText(b.equipmentTypes));
  });

  it('suggestId: 약어(영문) 우선 kebab, 겹치면 -2', () => {
    expect(suggestId('TCB', '테스트', new Set())).toBe('tcb');
    expect(suggestId(undefined, 'Smart Meter 2', new Set(['smart-meter-2']))).toBe('smart-meter-2-2');
    expect(suggestId('', '한글만', new Set())).toBe('new-equipment');
  });
});
