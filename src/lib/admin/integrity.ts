/**
 * 내보내기 전 전체 무결성 검사 — docs/test-plan.md DI 규칙 중 관리자 편집으로 깨질 수 있는 것을 같은 기준으로 확인한다.
 * 오류(error)가 하나라도 있으면 내보내기를 막는다. 경고(warn)는 표시만.
 */
import { z } from 'zod';
import {
  ASSESSED_COVERAGES,
  DiagramSchema,
  GapAssessmentSchema,
  EquipmentImagesSchema,
  EquipmentTypesSchema,
  LAYER_LABELS,
  type Layer,
} from '../schema';
import { boxMapOf, defaultRoute, nodesHitBy, pathHits, ROUTE_TILE_H, type BoxMap, type Pt } from '../diagram/router';
import { MIN_GAP, bandOf, boxesOverlap, nodeKind, nodeName, type Draft } from './draft';

export interface Issue {
  level: 'error' | 'warn';
  /** 분류 (스키마·참조·배치·연결선·커버리지) */
  area: string;
  message: string;
  /** 관련 노드/기기 id (클릭 시 이동용) */
  nodeId?: string;
  equipmentId?: string;
}

export interface RefData {
  categoryCodes: ReadonlySet<string>;
  productIds: ReadonlySet<string>;
}

const FIELD_LABELS: Record<string, string> = {
  id: 'id',
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
  equipmentTypeId: '기기',
  x: 'x 좌표',
  y: 'y 좌표',
  from: '시작 노드',
  to: '끝 노드',
  points: '경로',
  file: '사진 파일',
  gapAssessment: '공백 판정',
  supplyMode: '공급 방식',
  basis: '판정 근거',
  confidence: '확신도',
  verifiedBy: '확인 부서',
  verifiedAt: '확인일',
  reviewDue: '재확인 기한',
  evidence: '근거 자료',
  ref: '근거',
  label: '라벨',
  width: '모선 길이',
  kind: '종류',
  thumb: '썸네일',
};

/** Zod 이슈 → 한국어 문장 */
export function koIssue(issue: z.core.$ZodIssue): string {
  const field = [...issue.path].reverse().find((p) => typeof p === 'string') as string | undefined;
  const label = (field && FIELD_LABELS[field]) ?? field ?? '값';
  switch (issue.code) {
    case 'too_small':
      return issue.origin === 'array' ? `${label}: 최소 ${String(issue.minimum)}개가 필요합니다` : `${label}: 비워 둘 수 없습니다`;
    case 'invalid_type':
      return /received undefined/.test(issue.message) ? `${label}: 필수 항목입니다` : `${label}: 형식이 올바르지 않습니다 (${issue.expected})`;
    case 'invalid_value':
      return `${label}: 허용되지 않는 값입니다`;
    case 'invalid_format':
      // 스키마에 한국어 메시지가 있으면 그대로 (kebab id 등)
      return /[가-힣]/.test(issue.message) ? `${label}: ${issue.message}` : `${label}: 형식이 올바르지 않습니다`;
    default:
      return /[가-힣]/.test(issue.message) ? `${label}: ${issue.message}` : `${label}: 올바르지 않은 값입니다`;
  }
}

const pathText = (p: PropertyKey[]) => p.map(String).join('.');

/** 기기 하나의 커버리지 규칙 (DI-20~26). 폼과 전체 검사가 함께 쓴다 */
export function coverageIssues(e: {
  coverage: string;
  lseCategoryCodes: string[];
  productIds?: string[];
  gapNote?: string;
  affiliateName?: string;
  gapAssessment?: unknown;
}): { field: string; message: string; level: 'error' | 'warn' }[] {
  const out: { field: string; message: string; level: 'error' | 'warn' }[] = [];
  const links = e.lseCategoryCodes.length + (e.productIds?.length ?? 0);
  if (e.coverage === 'owned' && links === 0) {
    out.push({ field: 'lseCategoryCodes', level: 'error', message: '보유 기기는 연결 카테고리나 제품이 1개 이상 필요합니다' });
  }
  if (e.coverage === 'partial' && links === 0) {
    out.push({ field: 'lseCategoryCodes', level: 'error', message: '일부 보유 기기는 연결 카테고리나 제품이 1개 이상 필요합니다' });
  }
  if (e.coverage === 'missing' && links > 0) {
    out.push({ field: 'lseCategoryCodes', level: 'error', message: '미보유 기기에는 연결 카테고리·제품을 지정할 수 없습니다' });
  }
  if (e.coverage === 'missing' && !e.gapNote?.trim()) {
    out.push({ field: 'gapNote', level: 'error', message: '미보유 기기는 공백 메모가 필요합니다 (왜 공백인지)' });
  }
  if (e.coverage === 'partial' && !e.gapNote?.trim()) {
    out.push({ field: 'gapNote', level: 'warn', message: '일부 보유 기기는 공백 메모를 적는 것을 권장합니다' });
  }
  if (e.coverage === 'affiliate' && !e.affiliateName?.trim()) {
    out.push({ field: 'affiliateName', level: 'error', message: '계열사 보유 기기는 계열사명이 필요합니다' });
  }
  if (e.coverage !== 'affiliate' && e.affiliateName) {
    out.push({ field: 'affiliateName', level: 'error', message: '계열사명은 계열사 보유일 때만 적습니다' });
  }
  // 공백 판정 근거 (개선 R3): 미보유·일부·계열사·패널 구성품은 필수, 규칙은 GapAssessmentSchema
  if ((ASSESSED_COVERAGES as readonly string[]).includes(e.coverage) && !e.gapAssessment) {
    out.push({ field: 'gapAssessment', level: 'error', message: '미보유·일부 보유·계열사·패널 구성품 기기는 공백 판정 근거가 필요합니다' });
  }
  if (e.gapAssessment) {
    const r = GapAssessmentSchema.safeParse(e.gapAssessment);
    if (!r.success) for (const i of r.error.issues) out.push({ field: 'gapAssessment', level: 'error', message: `공백 판정 — ${koIssue(i)}` });
  }
  return out;
}

const MAIN_ORDER: Layer[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'];

export function validateDraft(draft: Draft, ref: RefData): Issue[] {
  const issues: Issue[] = [];
  const err = (area: string, message: string, extra: Partial<Issue> = {}) =>
    issues.push({ level: 'error', area, message, ...extra });
  const warn = (area: string, message: string, extra: Partial<Issue> = {}) =>
    issues.push({ level: 'warn', area, message, ...extra });

  // ── 스키마 ──
  const s1 = EquipmentTypesSchema.safeParse(draft.equipmentTypes);
  if (!s1.success) for (const i of s1.error.issues) err('스키마', `equipment-types.json [${pathText(i.path)}] ${koIssue(i)}`);
  const s2 = DiagramSchema.safeParse(draft.diagram);
  if (!s2.success) for (const i of s2.error.issues) err('스키마', `diagram.json [${pathText(i.path)}] ${koIssue(i)}`);
  const s3 = EquipmentImagesSchema.safeParse(draft.images);
  if (!s3.success) for (const i of s3.error.issues) err('스키마', `equipment-images.json [${pathText(i.path)}] ${koIssue(i)}`);

  // ── 중복 id ──
  const dup = (ids: string[], what: string) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) err('참조', `${what} id 중복: ${id}`);
      seen.add(id);
    }
  };
  dup(draft.equipmentTypes.map((e) => e.id), '기기');
  dup(draft.diagram.nodes.map((n) => n.id), '노드');
  dup(draft.diagram.edges.map((e) => e.id), '연결선');

  const eqById = new Map(draft.equipmentTypes.map((e) => [e.id, e]));
  const nodeById = new Map(draft.diagram.nodes.map((n) => [n.id, n]));

  // ── 기기: 참조·커버리지·교육 ──
  for (const e of draft.equipmentTypes) {
    const ex = { equipmentId: e.id };
    for (const c of e.lseCategoryCodes) if (!ref.categoryCodes.has(c)) err('참조', `${e.name}: 없는 카테고리 코드 ${c}`, ex);
    for (const p of e.productIds ?? []) if (!ref.productIds.has(p)) err('참조', `${e.name}: 없는 제품 ${p}`, ex);
    for (const c of coverageIssues(e)) (c.level === 'error' ? err : warn)('커버리지', `${e.name}: ${c.message}`, ex);
    if (e.learnPoints.filter((l) => l.trim()).length === 0) err('교육', `${e.name}: 학습 포인트가 1개 이상 필요합니다`, ex);
    for (const f of ['name', 'description', 'voltage'] as const) {
      if (!e[f].trim()) err('스키마', `${e.name || e.id}: ${FIELD_LABELS[f]}이(가) 비어 있습니다`, ex);
    }
    const main = draft.diagram.nodes.filter((n) => n.equipmentTypeId === e.id && !n.ref && nodeKind(n) === 'equipment');
    if (main.length === 0) {
      err('배치', `${e.name}: 계통도에 배치되지 않았습니다 (모든 기기는 기기 노드가 1개 필요, 참조 타일 제외)`, ex);
    } else if (main.length > 1) {
      err('배치', `${e.name}: 기기 노드가 ${main.length}개입니다 — 같은 기기를 다시 그릴 때는 참조 타일을 쓰세요 (${main.map((n) => n.id).join(', ')})`, ex);
    }
  }
  for (const id of Object.keys(draft.images)) {
    if (!eqById.has(id)) err('참조', `equipment-images.json: 없는 기기 ${id}의 사진`);
  }

  // ── 노드: 참조·밴드·겹침 ──
  const layerOf = new Map<string, Layer>();
  const nodes = draft.diagram.nodes;
  const boxes = boxMapOf(nodes);
  for (const n of nodes) {
    const kind = nodeKind(n);
    let layer: Layer | undefined;
    if (kind === 'equipment') {
      const eq = n.equipmentTypeId ? eqById.get(n.equipmentTypeId) : undefined;
      if (!eq) {
        err('참조', `노드 ${n.id}: 없는 기기 ${n.equipmentTypeId ?? '(지정 안 됨)'}`, { nodeId: n.id });
        continue;
      }
      layerOf.set(n.id, eq.layer);
      // 참조 타일: 원래 기기 노드가 있어야 하고, 계층 밴드 검사 제외 (다른 계층에 다시 나오는 자리)
      if (n.ref) {
        if (!nodes.some((m) => m.equipmentTypeId === n.equipmentTypeId && !m.ref && nodeKind(m) === 'equipment')) {
          err('참조', `참조 타일 ${n.id}: 원래 ${eq.name} 기기 노드가 없습니다`, { nodeId: n.id });
        }
        if (!n.label?.trim()) warn('배치', `참조 타일 ${n.id}: 라벨(예 "345/154kV")을 적는 것을 권장합니다`, { nodeId: n.id });
        continue;
      }
      layer = eq.layer;
    } else {
      if (!n.label?.trim()) err('스키마', `${kind === 'bus' ? '모선' : '끝점'} ${n.id}: 라벨이 필요합니다`, { nodeId: n.id });
      if (kind === 'bus' && !n.width) err('스키마', `모선 ${n.id}: 길이(width)가 필요합니다`, { nodeId: n.id });
      if (!n.layer) {
        err('스키마', `${kind === 'bus' ? '모선' : '끝점'} ${n.id}: 계층(layer)이 필요합니다`, { nodeId: n.id });
        continue;
      }
      layer = n.layer;
      layerOf.set(n.id, layer);
    }
    const band = bandOf(draft.diagram, layer);
    if (!band) {
      err('배치', `${nodeName(draft, n.id)}: ${layer} 밴드가 없습니다`, { nodeId: n.id });
      continue;
    }
    const b = boxes.get(n.id)!;
    if (b.x - b.hw < band.x || b.x + b.hw > band.x + band.w || b.y - b.hh < band.y || b.y + b.hh > band.y + band.h) {
      err('배치', `${nodeName(draft, n.id)}: ${layer} ${LAYER_LABELS[layer]} 밴드를 벗어났습니다`, { nodeId: n.id });
    }
  }
  // 겹침: 모선은 제외 (생성기 tiles 목록과 같음)
  const tiles = nodes.filter((n) => nodeKind(n) !== 'bus');
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      const a = tiles[i];
      const b = tiles[j];
      if (boxesOverlap(boxes.get(a.id)!, boxes.get(b.id)!)) {
        err('배치', `타일 겹침: ${nodeName(draft, a.id)} ↔ ${nodeName(draft, b.id)} (최소 간격 ${MIN_GAP}px)`, { nodeId: a.id });
      }
    }
  }
  for (const l of MAIN_ORDER) {
    if (!nodes.some((n) => !n.ref && nodeKind(n) === 'equipment' && layerOf.get(n.id) === l)) err('배치', `${l} ${LAYER_LABELS[l]}에 노드가 하나도 없습니다`);
  }

  // ── 연결선: 참조·중복·관통 ──
  const pairs = new Set<string>();
  const connected = new Set<string>();
  const geometry = edgeGeometry(draft, boxes, false);
  for (const e of draft.diagram.edges) {
    const a = nodeById.get(e.from);
    const b = nodeById.get(e.to);
    if (!a || !b) {
      err('참조', `연결선 ${e.id}: 없는 노드 (${!a ? e.from : e.to})`);
      continue;
    }
    connected.add(e.from).add(e.to);
    if (e.from === e.to) err('연결선', `연결선 ${e.id}: 자기 자신과 연결`);
    const pk = [e.from, e.to].sort().join('|');
    if (pairs.has(pk)) err('연결선', `연결선 ${e.id}: ${nodeName(draft, e.from)}–${nodeName(draft, e.to)} 중복 연결`);
    pairs.add(pk);
    const ends = [e.from, e.to];
    const label = `연결선 ${e.id} (${nodeName(draft, e.from)} → ${nodeName(draft, e.to)})`;
    const g = geometry.get(e.id);
    if (e.points) {
      const p = e.points;
      for (let i = 0; i + 1 < p.length; i++) {
        if (p[i].x !== p[i + 1].x && p[i].y !== p[i + 1].y) {
          err('연결선', `${label}: 경로가 직교가 아닙니다`);
          break;
        }
      }
      const hit = nodesHitBy(p, boxes, ends);
      if (hit.length > 0) err('연결선', `${label}: ${hit.map((h) => nodeName(draft, h)).join(', ')}을(를) 지나갑니다`, { nodeId: e.from });
    } else if (nodeKind(a) === 'bus' || nodeKind(b) === 'bus') {
      err('연결선', `${label}: 모선 연결선에는 경로(points)가 필요합니다 — 노드를 옮기거나 다시 연결해 주세요`, { nodeId: e.from });
    } else if (g && !g.autoBus && pathHits(g.pts, boxes, ends)) {
      // 자동 모선 그룹(한 기기에서 아래로 points 없는 전력선 3개 이상)은 모선 높이로 그려지므로 관통 판정 제외 (DI-44 와 동일)
      const hit = nodesHitBy(g.pts, boxes, ends);
      err('연결선', `${label}: ${hit.map((h) => nodeName(draft, h)).join(', ')}을(를) 지나갑니다 (우회 경로 없음)`, { nodeId: e.from });
    }
    if (e.kind === 'alt' && !e.label?.trim()) warn('연결선', `${label}: 택1 연결선에는 라벨(어떤 기기 중 하나인지)을 적는 것을 권장합니다`);
    // DI-42 같은/인접 L 계층만 (REN·MON 예외)
    const la = layerOf.get(e.from);
    const lb = layerOf.get(e.to);
    const ia = la ? MAIN_ORDER.indexOf(la) : -1;
    const ib = lb ? MAIN_ORDER.indexOf(lb) : -1;
    if (ia >= 0 && ib >= 0 && Math.abs(ia - ib) > 1) err('연결선', `${label}: ${la}–${lb} 계층을 건너뛰어 연결할 수 없습니다 (인접 계층만)`);
  }
  // 전력선(전력·택1)끼리 교차 금지 — 신호선 교차는 허용. 기준 = 생성기와 같은 경로(points 또는 기본 직교 경로)
  const crossKey = (c: { a: string; b: string }) => [c.a, c.b].sort().join('|');
  const crossings = powerCrossings(draft, geometry);
  for (const c of crossings) {
    err('연결선', `전력선 교차: ${c.a} ↔ ${c.b} (${c.x}, ${c.y}) — 노드를 옮겨 교차를 없애 주세요`, { nodeId: draft.diagram.edges.find((e) => e.id === c.a)?.from });
  }
  // 화면의 자동 모선 묶음(한 기기에서 3갈래 이상)은 꺾는 높이가 달라 추가 교차가 생길 수 있음 — 경고만
  const base = new Set(crossings.map(crossKey));
  for (const c of powerCrossings(draft, edgeGeometry(draft, boxes, true))) {
    if (base.has(crossKey(c))) continue;
    warn('연결선', `화면의 자동 모선 묶음 때문에 전력선이 교차해 보입니다: ${c.a} ↔ ${c.b} (${c.x}, ${c.y})`, { nodeId: draft.diagram.edges.find((e) => e.id === c.a)?.from });
  }
  // DI-40 고립 노드 (MON·system 예외)
  for (const n of nodes) {
    if (connected.has(n.id)) continue;
    const kind = nodeKind(n);
    if (kind !== 'equipment') {
      err('연결선', `${nodeName(draft, n.id)}: 연결선이 하나도 없습니다`, { nodeId: n.id });
      continue;
    }
    const eq = n.equipmentTypeId ? eqById.get(n.equipmentTypeId) : undefined;
    if (!eq) continue;
    if (eq.layer === 'MON' || eq.category === 'system') continue;
    err('연결선', `${nodeName(draft, n.id)}: 연결선이 하나도 없습니다 (감시·시스템 기기만 예외)`, { nodeId: n.id });
  }
  return issues;
}

/**
 * 연결선 모양: points 가 있으면 그대로, 없으면 기본 직교 경로(생성기 default_route).
 * withAutoBus=true 면 화면(model.ts)처럼 자동 모선 그룹(한 기기에서 아래로 points 없는 전력선 3개 이상)을 모선 높이에서 꺾는다.
 * autoBus 플래그는 어느 쪽이든 그룹 소속 여부 (관통 판정 제외용, DI-44 와 동일).
 */
export function edgeGeometry(
  draft: Draft,
  boxes: BoxMap = boxMapOf(draft.diagram.nodes),
  withAutoBus = true,
): Map<string, { pts: Pt[]; autoBus: boolean }> {
  const out = new Map<string, { pts: Pt[]; autoBus: boolean }>();
  const kindOf = (k?: string) => k ?? 'power';
  const groups = new Map<string, string[]>();
  for (const e of draft.diagram.edges) {
    const a = boxes.get(e.from);
    const b = boxes.get(e.to);
    if (!a || !b || e.points || kindOf(e.kind) !== 'power') continue;
    if ((a.kind !== 'equipment' && a.kind !== 'ref') || (b.kind !== 'equipment' && b.kind !== 'ref')) continue;
    if (b.y - a.y >= ROUTE_TILE_H + 20) groups.set(e.from, [...(groups.get(e.from) ?? []), e.id]);
  }
  const busY = new Map<string, number>();
  for (const [fromId, ids] of groups) {
    if (ids.length < 3) continue;
    const a = boxes.get(fromId)!;
    const tops = ids.map((id) => boxes.get(draft.diagram.edges.find((e) => e.id === id)!.to)!.y - a.hh);
    const y1 = a.y + a.hh;
    const y = Math.round(y1 + Math.min(30, (Math.min(...tops) - y1) / 2));
    for (const id of ids) busY.set(id, y);
  }
  for (const e of draft.diagram.edges) {
    const a = boxes.get(e.from);
    const b = boxes.get(e.to);
    if (!a || !b) continue;
    if (e.points) {
      out.set(e.id, { pts: e.points, autoBus: false });
      continue;
    }
    let pts = defaultRoute(a, b);
    if (!pts) continue;
    const by = busY.get(e.id);
    if (withAutoBus && by !== undefined && pts.length === 4) pts = [pts[0], { x: pts[1].x, y: by }, { x: pts[2].x, y: by }, pts[3]];
    out.set(e.id, { pts, autoBus: by !== undefined });
  }
  return out;
}

/**
 * 전력선(전력·택1)의 수평·수직 선분이 서로의 안쪽에서 엄밀히 교차하는 곳.
 * 끝점 접촉·같은 방향 겹침, 같은 노드에서 갈라지는 선끼리(분기 — 같은 회로)는 제외.
 */
export function powerCrossings(
  draft: Draft,
  geometry: Map<string, { pts: Pt[] }> = edgeGeometry(draft, undefined, false),
): { a: string; b: string; x: number; y: number }[] {
  type Seg = { id: string; h: boolean; c: number; lo: number; hi: number };
  const segs: Seg[] = [];
  const endsOf = new Map(draft.diagram.edges.map((e) => [e.id, [e.from, e.to]]));
  const shareNode = (a: string, b: string) => endsOf.get(a)!.some((n) => endsOf.get(b)!.includes(n));
  for (const e of draft.diagram.edges) {
    if ((e.kind ?? 'power') === 'signal') continue;
    const g = geometry.get(e.id);
    if (!g) continue;
    for (let i = 0; i + 1 < g.pts.length; i++) {
      const p = g.pts[i];
      const q = g.pts[i + 1];
      if (p.y === q.y && p.x !== q.x) segs.push({ id: e.id, h: true, c: p.y, lo: Math.min(p.x, q.x), hi: Math.max(p.x, q.x) });
      else if (p.x === q.x && p.y !== q.y) segs.push({ id: e.id, h: false, c: p.x, lo: Math.min(p.y, q.y), hi: Math.max(p.y, q.y) });
    }
  }
  const out: { a: string; b: string; x: number; y: number }[] = [];
  const seen = new Set<string>();
  for (const h of segs) {
    if (!h.h) continue;
    for (const v of segs) {
      if (v.h || v.id === h.id || shareNode(h.id, v.id)) continue;
      if (h.lo < v.c && v.c < h.hi && v.lo < h.c && h.c < v.hi) {
        const k = [h.id, v.id].sort().join('|');
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ a: h.id, b: v.id, x: v.c, y: h.c });
      }
    }
  }
  return out;
}
