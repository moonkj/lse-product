// @vitest-environment node
/**
 * 단위 테스트 (UT-11, v0.7 R4) — 연결선 경로 계산 src/lib/diagram/router.ts (경로 기하의 단일 출처)
 *
 * 1) 골든: 현재 diagram.json 의 모든 연결선을 routeEdge 로 다시 계산하면 저장된 points 와 같다
 *    (points 가 없으면 라우터도 "기본 경로로 충분 = points 없음"). 생성기·관리자·화면이 같은 경로를 쓰는지의 회귀 기준.
 * 2) 모선 규칙: 모선 범위 밖·수직 경로 막힘·모선끼리 → 실패 사유. 관리자 draft 의 addEdge/moveNode/updateNode 도 거부.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { boxMapOf, boxOf, defaultRoute, pathHits, pyRound, routeEdge, astarRoute, type Pt } from '../../../src/lib/diagram/router';
import { addEdge, moveNode, updateNode, type Draft } from '../../../src/lib/admin/draft';
import { DiagramSchema, type Diagram, type DiagramNode } from '../../../src/lib/schema';

const DATA = fileURLToPath(new URL('../../../src/data/', import.meta.url));
const read = (f: string) => JSON.parse(readFileSync(DATA + f, 'utf8'));
const diagram: Diagram = DiagramSchema.parse(read('diagram.json'));
const draft = (): Draft => ({ equipmentTypes: read('equipment-types.json'), diagram: read('diagram.json'), images: read('equipment-images.json') });

describe('UT-11 라우터 골든 — 현재 diagram.json 재계산', () => {
  const boxes = boxMapOf(diagram.nodes);

  it(`모든 연결선(${diagram.edges.length}개)의 routeEdge 결과 = 저장된 points (없으면 points 없음)`, () => {
    const diff: string[] = [];
    for (const e of diagram.edges) {
      const r = routeEdge(boxes, e.from, e.to);
      const got = r.ok ? JSON.stringify(r.points ?? null) : `실패 ${r.reason}`;
      const want = JSON.stringify(e.points ?? null);
      if (got !== want) diff.push(`${e.id} (${e.from}→${e.to}): 저장 ${want} / 계산 ${got}`);
    }
    expect(diff).toEqual([]);
    expect(diagram.edges.length).toBeGreaterThanOrEqual(86);
  });

  it('모선 연결선은 모두 points 가 있고, points 없는 연결선의 기본 경로는 어떤 노드도 지나가지 않는다', () => {
    const isBus = new Set(diagram.nodes.filter((n) => n.kind === 'bus').map((n) => n.id));
    const busEdges = diagram.edges.filter((e) => isBus.has(e.from) || isBus.has(e.to));
    expect(busEdges.length).toBeGreaterThan(0);
    expect(busEdges.filter((e) => !e.points).map((e) => e.id)).toEqual([]);
    const hit = diagram.edges
      .filter((e) => !e.points)
      .filter((e) => {
        const def = defaultRoute(boxes.get(e.from)!, boxes.get(e.to)!);
        return !def || pathHits(def, boxes, [e.from, e.to]);
      })
      .map((e) => e.id);
    expect(hit).toEqual([]);
  });

  it('(정보) 우회 경로(points) 연결선 수', () => {
    const n = diagram.edges.filter((e) => e.points).length;
    // eslint-disable-next-line no-console
    console.info(`[UT-11] 연결선 ${diagram.edges.length}개 중 points ${n}개`);
    expect(n).toBeGreaterThan(0);
  });
});

describe('UT-11 라우터 기본 동작 (합성)', () => {
  const tile = (id: string, x: number, y: number): DiagramNode => ({ id, equipmentTypeId: 'x', x, y });
  const bus = (id: string, x: number, y: number, width: number): DiagramNode => ({ id, kind: 'bus', label: id, layer: 'L6', x, y, width });

  it('pyRound 는 Python round 와 같다 (0.5 는 짝수 쪽)', () => {
    expect([0.5, 1.5, 2.5, 3.5, -1.5, 2.4, 2.6].map(pyRound)).toEqual([0, 2, 2, 4, -2, 2, 3]);
  });

  it('boxOf: 모선 반폭은 정수 나눗셈 (width 301 → 150)', () => {
    expect(boxOf(bus('b', 500, 300, 301))).toMatchObject({ kind: 'bus', hw: 150, hh: 4 });
    expect(boxOf({ id: 'r', ref: true, x: 0, y: 0 })).toMatchObject({ kind: 'ref', hw: 60, hh: 58 });
    expect(boxOf({ id: 'p', kind: 'endpoint', x: 0, y: 0 })).toMatchObject({ kind: 'endpoint', hw: 60, hh: 22 });
  });

  it('막힌 기본 경로 → A* 우회 points (직교, 막는 노드 비켜 감), 막힘 없으면 points 없음', () => {
    const nodes = [tile('a', 100, 100), tile('c', 700, 100)];
    expect(routeEdge(boxMapOf(nodes), 'a', 'c')).toEqual({ ok: true });
    const blocked = [...nodes, tile('m', 400, 100)];
    const boxes = boxMapOf(blocked);
    const r = routeEdge(boxes, 'a', 'c');
    expect(r.ok).toBe(true);
    const pts = (r as { points: Pt[] }).points;
    expect(pts.length).toBeGreaterThan(2);
    expect(pts.slice(1).every((q, i) => q.x === pts[i].x || q.y === pts[i].y)).toBe(true);
    expect(pathHits(pts, boxes, ['a', 'c'])).toBe(false);
    expect(astarRoute(boxes, 'a', 'c')).toEqual(pts);
  });

  it('완전히 둘러싸이면 no-path, 없는 노드는 missing-node', () => {
    const ring = [tile('a', 500, 500), tile('c', 900, 500)];
    for (const [dx, dy] of [[-200, 0], [200, 0], [0, -200], [0, 200], [-200, -200], [200, -200], [-200, 200], [200, 200]]) ring.push(tile(`w${dx}_${dy}`, 500 + dx, 500 + dy));
    // 둘레를 촘촘히 막는다 (타일 간격 < 여유)
    for (let k = -2; k <= 2; k++) ring.push(tile(`t${k}`, 500 + k * 100, 360), tile(`u${k}`, 500 + k * 100, 640), tile(`l${k}`, 360, 500 + k * 100), tile(`r${k}`, 640, 500 + k * 100));
    expect(routeEdge(boxMapOf(ring), 'a', 'c')).toMatchObject({ ok: false, reason: 'no-path' });
    expect(routeEdge(boxMapOf(ring), 'a', 'ghost')).toEqual({ ok: false, reason: 'missing-node' });
  });

  it('모선 연결: 모선 위 (기기 x) 점에서 수직 points, 모선 쪽이 from 이든 to 든', () => {
    const nodes = [bus('b', 500, 300, 400), tile('d', 600, 450), tile('u', 400, 150)];
    const boxes = boxMapOf(nodes);
    expect(routeEdge(boxes, 'b', 'd')).toEqual({ ok: true, points: [{ x: 600, y: 300 }, { x: 600, y: 392 }] });
    expect(routeEdge(boxes, 'd', 'b')).toEqual({ ok: true, points: [{ x: 600, y: 392 }, { x: 600, y: 300 }] });
    expect(routeEdge(boxes, 'u', 'b')).toEqual({ ok: true, points: [{ x: 400, y: 208 }, { x: 400, y: 300 }] });
    // 모선 양 끝(x = 300, 700)은 범위 안
    expect(routeEdge(boxMapOf([bus('b', 500, 300, 400), tile('e', 700, 450)]), 'b', 'e').ok).toBe(true);
  });

  it('모선 범위 밖 → bus-range, 수직 경로 막힘 → bus-blocked(막는 노드), 모선끼리 → bus-to-bus', () => {
    const nodes = [bus('b', 500, 300, 400), tile('far', 760, 450), tile('d', 400, 600), tile('blk', 400, 440), bus('b2', 500, 800, 200)];
    const boxes = boxMapOf(nodes);
    expect(routeEdge(boxes, 'b', 'far')).toEqual({ ok: false, reason: 'bus-range' });
    expect(routeEdge(boxes, 'b', 'd')).toEqual({ ok: false, reason: 'bus-blocked', blockedBy: ['blk'] });
    expect(routeEdge(boxes, 'b', 'b2')).toEqual({ ok: false, reason: 'bus-to-bus' });
    expect(defaultRoute(boxes.get('b')!, boxes.get('far')!)).toBeNull();
  });
});

describe('UT-11 관리자 draft 가 모선 규칙 위반 편집을 거부 (현재 데이터)', () => {
  it('addEdge: 모선 범위 밖 기기 → 거부 메시지 "모선 범위 밖", 초안 그대로', () => {
    const d = draft();
    const b = d.diagram.nodes.find((n) => n.id === 'bus-380')!;
    const far = d.diagram.nodes.find((n) => n.kind !== 'bus' && !n.ref && Math.abs(n.x - b.x) > (b.width ?? 0) / 2 + 60 && n.y > b.y)!;
    expect(far).toBeDefined();
    const already = d.diagram.edges.some((e) => [e.from, e.to].includes(far.id) && [e.from, e.to].includes(b.id));
    expect(already).toBe(false);
    const r = addEdge(d, b.id, far.id, 'power');
    expect(r.error).toContain('모선 범위 밖');
    expect(r.draft).toBe(d);
  });

  it('addEdge: 수직 경로가 다른 타일에 막힘 → "수직 연결 경로가 막힘"', () => {
    const d = draft();
    const r = addEdge(d, 'bus-380', 'n-mms', 'power');
    expect(r.error).toContain('수직 연결 경로가 막힘');
    expect(r.draft).toBe(d);
  });

  it('moveNode: 피더를 모선 범위 밖으로 / 모선을 옆으로 → 거부, updateNode: 모선을 짧게 → 거부', () => {
    const d = draft();
    const mccb = d.diagram.nodes.find((n) => n.id === 'n-mccb')!;
    const b = d.diagram.nodes.find((n) => n.id === 'bus-380')!;
    expect(moveNode(d, 'n-mccb', 100, mccb.y).error).toMatch(/옮길 수 없습니다.*모선 범위 밖/);
    expect(moveNode(d, 'bus-380', b.x + 300, b.y).error).toMatch(/옮길 수 없습니다.*모선 범위 밖/);
    expect(updateNode(d, 'bus-380', { width: 61 }).error).toMatch(/모선 길이를 바꿀 수 없습니다/);
  });
});
