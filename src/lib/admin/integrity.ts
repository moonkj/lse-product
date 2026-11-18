/**
 * 내보내기 전 전체 무결성 검사 — docs/test-plan.md DI 규칙 중 관리자 편집으로 깨질 수 있는 것을 같은 기준으로 확인한다.
 * 오류(error)가 하나라도 있으면 내보내기를 막는다. 경고(warn)는 표시만.
 */
import { z } from 'zod';
import {
  DiagramSchema,
  EquipmentImagesSchema,
  EquipmentTypesSchema,
  LAYER_LABELS,
  type Layer,
} from '../schema';
import { defaultRoute, pathHitsTiles, tilesHitBy, ROUTE_TILE_H } from '../diagram/router';
import { MIN_GAP, TILE_H, TILE_W, bandOf, nodeName, posMapOf, type Draft } from './draft';

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
    if (!draft.diagram.nodes.some((n) => n.equipmentTypeId === e.id)) {
      err('배치', `${e.name}: 계통도에 배치되지 않았습니다 (모든 기기는 노드가 1개 이상 필요)`, ex);
    }
  }
  for (const id of Object.keys(draft.images)) {
    if (!eqById.has(id)) err('참조', `equipment-images.json: 없는 기기 ${id}의 사진`);
  }

  // ── 노드: 참조·밴드·겹침 ──
  const layerOf = new Map<string, Layer>();
  for (const n of draft.diagram.nodes) {
    const eq = eqById.get(n.equipmentTypeId);
    if (!eq) {
      err('참조', `노드 ${n.id}: 없는 기기 ${n.equipmentTypeId}`, { nodeId: n.id });
      continue;
    }
    layerOf.set(n.id, eq.layer);
    const band = bandOf(draft.diagram, eq.layer);
    if (!band) {
      err('배치', `${nodeName(draft, n.id)}: ${eq.layer} 밴드가 없습니다`, { nodeId: n.id });
      continue;
    }
    if (
      n.x - TILE_W / 2 < band.x ||
      n.x + TILE_W / 2 > band.x + band.w ||
      n.y - TILE_H / 2 < band.y ||
      n.y + TILE_H / 2 > band.y + band.h
    ) {
      err('배치', `${nodeName(draft, n.id)}: ${eq.layer} ${LAYER_LABELS[eq.layer]} 밴드를 벗어났습니다`, { nodeId: n.id });
    }
  }
  const nodes = draft.diagram.nodes;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (Math.abs(a.x - b.x) < TILE_W + MIN_GAP && Math.abs(a.y - b.y) < TILE_H + MIN_GAP) {
        err('배치', `타일 겹침: ${nodeName(draft, a.id)} ↔ ${nodeName(draft, b.id)} (최소 간격 ${MIN_GAP}px)`, { nodeId: a.id });
      }
    }
  }
  for (const l of MAIN_ORDER) {
    if (!nodes.some((n) => layerOf.get(n.id) === l)) err('배치', `${l} ${LAYER_LABELS[l]}에 노드가 하나도 없습니다`);
  }

  // ── 연결선: 참조·중복·관통 ──
  const pos = posMapOf(draft.diagram);
  const pairs = new Set<string>();
  const connected = new Set<string>();
  // 모선 그룹(한 기기에서 아래로 points 없는 전력선 3개 이상)은 모선 높이로 그려지므로 관통 판정 제외 (DI-44 와 동일)
  const downCount = new Map<string, number>();
  for (const e of draft.diagram.edges) {
    const a = nodeById.get(e.from);
    const b = nodeById.get(e.to);
    if (!a || !b || e.points || (e.kind ?? 'power') !== 'power') continue;
    if (b.y - a.y >= ROUTE_TILE_H + 20) downCount.set(e.from, (downCount.get(e.from) ?? 0) + 1);
  }
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
    if (e.points) {
      const p = e.points;
      for (let i = 0; i + 1 < p.length; i++) {
        if (p[i].x !== p[i + 1].x && p[i].y !== p[i + 1].y) {
          err('연결선', `${label}: 경로가 직교가 아닙니다`);
          break;
        }
      }
      const hit = tilesHitBy(p, pos, ends);
      if (hit.length > 0) err('연결선', `${label}: ${hit.map((h) => nodeName(draft, h)).join(', ')} 타일을 지나갑니다`, { nodeId: e.from });
    } else {
      const bus = (e.kind ?? 'power') === 'power' && b.y - a.y >= ROUTE_TILE_H + 20 && (downCount.get(e.from) ?? 0) >= 3;
      const route = defaultRoute(a, b);
      if (!bus && pathHitsTiles(route, pos, ends)) {
        const hit = tilesHitBy(route, pos, ends);
        err('연결선', `${label}: ${hit.map((h) => nodeName(draft, h)).join(', ')} 타일을 지나갑니다 (우회 경로 없음)`, { nodeId: e.from });
      }
    }
    // DI-42 같은/인접 L 계층만 (REN·MON 예외)
    const la = layerOf.get(e.from);
    const lb = layerOf.get(e.to);
    const ia = la ? MAIN_ORDER.indexOf(la) : -1;
    const ib = lb ? MAIN_ORDER.indexOf(lb) : -1;
    if (ia >= 0 && ib >= 0 && Math.abs(ia - ib) > 1) err('연결선', `${label}: ${la}–${lb} 계층을 건너뛰어 연결할 수 없습니다 (인접 계층만)`);
  }
  // DI-40 고립 노드 (MON·system 예외)
  for (const n of nodes) {
    const eq = eqById.get(n.equipmentTypeId);
    if (!eq || connected.has(n.id)) continue;
    if (eq.layer === 'MON' || eq.category === 'system') continue;
    err('연결선', `${nodeName(draft, n.id)}: 연결선이 하나도 없습니다 (감시·시스템 기기만 예외)`, { nodeId: n.id });
  }
  return issues;
}
