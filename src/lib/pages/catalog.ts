/**
 * 상세 페이지(제품·기기·공백 표) 공용 헬퍼 — T1-B 소유.
 * 데이터 파일·load.ts 는 수정하지 않고, getData() 결과 위에서 파생 값만 계산한다.
 */
import { getData, resolveProducts, type AppData } from '../../data/load';
import {
  LAYERS,
  type Coverage,
  type DiagramNode,
  type EquipmentCategory,
  type EquipmentType,
  type Layer,
  type Product,
} from '../schema';
import { CATEGORY_LABELS, CATEGORY_ORDER, COVERAGE_ORDER, confidenceLabel, gapConfidence } from '../labels';
import { edgeKind, isBus, type EdgeKind } from '../diagram/geometry';
import { hopsAcrossBus } from '../diagram/topology';

// 라벨·순서 상수는 lib/labels.ts 가 단일 출처 (기존 import 경로 호환용 재수출)
export { CATEGORY_LABELS, CATEGORY_ORDER, COVERAGE_ORDER } from '../labels';

/** 계통도 화면으로 가는 링크 (메인 화면은 ?node=, ?mode= 쿼리로 상태 복원) */
export function diagramHref(nodeId?: string, mode?: 'gap'): string {
  const q = new URLSearchParams();
  if (mode) q.set('mode', mode);
  if (nodeId) q.set('node', nodeId);
  const s = q.toString();
  return s ? `/?${s}` : '/';
}

interface Derived {
  equipmentByProductId: Map<string, EquipmentType[]>;
  productsByEquipmentId: Map<string, Product[]>;
  nodeByEquipmentId: Map<string, DiagramNode>;
  nodeById: Map<string, DiagramNode>;
}

let derivedFor: AppData | undefined;
let derived: Derived | undefined;

function getDerived(data: AppData = getData()): Derived {
  if (derived && derivedFor === data) return derived;
  const equipmentByProductId = new Map<string, EquipmentType[]>();
  const productsByEquipmentId = new Map<string, Product[]>();
  for (const eq of data.equipmentTypes) {
    const products = resolveProducts(eq, data);
    productsByEquipmentId.set(eq.id, products);
    for (const p of products) {
      const list = equipmentByProductId.get(p.id) ?? [];
      list.push(eq);
      equipmentByProductId.set(p.id, list);
    }
  }
  const nodeByEquipmentId = new Map<string, DiagramNode>();
  for (const n of data.diagram.nodes) {
    // 참조 타일(ref)은 같은 기기의 재등장 — 대표 노드는 원래 타일
    if (n.equipmentTypeId && !n.ref && !nodeByEquipmentId.has(n.equipmentTypeId)) nodeByEquipmentId.set(n.equipmentTypeId, n);
  }
  derived = {
    equipmentByProductId,
    productsByEquipmentId,
    nodeByEquipmentId,
    nodeById: new Map(data.diagram.nodes.map((n) => [n.id, n])),
  };
  derivedFor = data;
  return derived;
}

const PRIMARY_COVERAGE_RANK: Record<Coverage, number> = { owned: 0, partial: 1, affiliate: 2, sourced: 3, missing: 4, na: 5 };

/**
 * 제품이 매핑된 기기들. 첫 번째 = 대표 기기:
 * 보유(owned) 기기 우선 → 기기 대표 사진이 이 제품인 기기 → productIds 로 직접 지정된 기기 → equipment-types.json 순서.
 */
export function equipmentForProduct(productId: string): EquipmentType[] {
  const data = getData();
  const list = getDerived(data).equipmentByProductId.get(productId) ?? [];
  const score = (eq: EquipmentType) =>
    PRIMARY_COVERAGE_RANK[eq.coverage] * 4 +
    (data.equipmentImageById.get(eq.id)?.productId === productId ? 0 : 2) +
    (eq.productIds?.includes(productId) ? 0 : 1);
  return [...list].sort((a, b) => score(a) - score(b));
}

/** 기기의 자사 제품 (메모된 resolveProducts) */
export function productsForEquipment(equipmentId: string): Product[] {
  return getDerived().productsByEquipmentId.get(equipmentId) ?? [];
}

/** 기기의 계통도 노드 (첫 번째) */
export function nodeForEquipment(equipmentId: string): DiagramNode | undefined {
  return getDerived().nodeByEquipmentId.get(equipmentId);
}

export interface ChainLink {
  node: DiagramNode;
  eq: EquipmentType;
  /** 이 노드와 다음 노드를 잇는 선의 종류 (마지막 노드는 undefined) */
  edgeToNext?: EdgeKind;
}

/**
 * 노드의 앞(들어오는 선)·뒤(나가는 선) 인접 노드로 3칸 미니 체인을 만든다.
 * 모선은 건너뛰고 모선 너머 기기로(상세 패널 이웃과 같은 규칙 — topology.hopsAcrossBus), 끝점(기기 아님)은 제외.
 * 고르는 순서: 전력선(전력·택1) 우선 → 같은 계층 우선 → 데이터 순서.
 */
export function neighborChain(nodeId: string): ChainLink[] {
  const data = getData();
  const { nodeById } = getDerived(data);
  const self = nodeById.get(nodeId);
  if (!self?.equipmentTypeId) return [];
  const eqOf = (n: DiagramNode) => (n.equipmentTypeId ? data.equipmentTypeById.get(n.equipmentTypeId) : undefined);
  const selfEq = eqOf(self);
  const isBusId = (id: string) => {
    const n = nodeById.get(id);
    return !!n && isBus(n);
  };
  const pick = (dir: 'in' | 'out') => {
    const cands = hopsAcrossBus(nodeId, data.diagram.edges, isBusId, dir)
      .map((h) => ({ e: h.edge, n: nodeById.get(h.id) }))
      .filter((c): c is { e: (typeof data.diagram.edges)[number]; n: DiagramNode } => c.n !== undefined && c.n.id !== nodeId && eqOf(c.n) !== undefined);
    const rank = (c: (typeof cands)[number]) => (edgeKind(c.e) === 'signal' ? 2 : 0) + (eqOf(c.n)?.layer === selfEq?.layer ? 0 : 1);
    return cands.map((c, i) => ({ c, i, r: rank(c) })).sort((a, b) => a.r - b.r || a.i - b.i)[0]?.c;
  };
  const prev = pick('in');
  const next = pick('out');
  const toLink = (n: DiagramNode, edgeToNext?: { kind?: EdgeKind }): ChainLink | undefined => {
    const eq = eqOf(n);
    return eq ? { node: n, eq, edgeToNext: edgeToNext ? edgeKind(edgeToNext) : undefined } : undefined;
  };
  return [
    prev && toLink(prev.n, prev.e),
    toLink(self, next?.e),
    next && toLink(next.n),
  ].filter((l): l is ChainLink => l !== undefined);
}

// ───────────── 공백 표 ─────────────

export type CoverageCounts = Record<Coverage, number>;

export const emptyCounts = (): CoverageCounts => ({ owned: 0, partial: 0, affiliate: 0, sourced: 0, missing: 0, na: 0 });

export function countCoverage(list: EquipmentType[]): CoverageCounts {
  const c = emptyCounts();
  for (const eq of list) c[eq.coverage] += 1;
  return c;
}

/** 보유율 = owned / 집계 대상. 해당 없음(na, 자사 사업 범위 밖)은 분모에서 뺀다 (2026-11-20 사용자) */
export function ownedRate(c: CoverageCounts): { owned: number; total: number; pct: number } {
  const total = COVERAGE_ORDER.filter((k) => k !== 'na').reduce((s, k) => s + c[k], 0);
  return { owned: c.owned, total, pct: total === 0 ? 0 : Math.round((c.owned / total) * 100) };
}


export interface MatrixRow {
  layer: Layer;
  cells: Record<EquipmentCategory, EquipmentType[]>;
  counts: CoverageCounts;
}

export function buildMatrix(equipment: EquipmentType[]): MatrixRow[] {
  return LAYERS.map((layer) => {
    const inLayer = equipment.filter((e) => e.layer === layer);
    const cells = Object.fromEntries(
      CATEGORY_ORDER.map((cat) => [cat, inLayer.filter((e) => e.category === cat)]),
    ) as Record<EquipmentCategory, EquipmentType[]>;
    return { layer, cells, counts: countCoverage(inLayer) };
  });
}

/** 공백 목록 메모 칸: gapNote, 없으면 계열사명 */
export function gapMemo(eq: EquipmentType): string {
  return eq.gapNote ?? eq.affiliateName ?? '';
}

export function csvCell(raw: string): string {
  // 수식 주입 방지: = + - @ 탭 CR 로 시작하는 셀은 앞에 ' 를 붙여 Excel 이 텍스트로 읽게 한다
  const v = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * CSV 문자열 (UTF-8 BOM 포함 — Excel 한글 깨짐 방지).
 * 마지막 열 "판정" = 공백 후보/확정 (화면 목록 배지와 같은 gapConfidence — 재확인 기한이 지나면 후보). 보유·해당 없음은 빈칸.
 */
export function buildGapCsv(list: EquipmentType[], coverageLabel: (c: Coverage) => string, layerLabel: (l: Layer) => string): string {
  const header = ['상태', '계층', '계층명', '기기 ID', '기기명', '약어', '기능', '계열사', '메모', '판정'];
  const rows = list.map((eq) => [
    coverageLabel(eq.coverage),
    eq.layer,
    layerLabel(eq.layer),
    eq.id,
    eq.name,
    eq.abbr ?? '',
    CATEGORY_LABELS[eq.category],
    eq.affiliateName ?? '',
    eq.gapNote ?? '',
    ((c) => (c ? confidenceLabel(eq.coverage, c) : ''))(gapConfidence(eq)),
  ]);
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** 브라우저에서 텍스트 파일 다운로드 */
export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ───────────── 자료 표시 ─────────────

const LANG_LABELS: Record<string, string> = { ko: '한국어', en: '영어', es: '스페인어', etc: '기타 언어' };
export const langLabel = (lang?: string) => (lang ? (LANG_LABELS[lang] ?? lang.toUpperCase()) : undefined);

/** URL 확장자 → 파일 배지 (PDF, ZIP …). 알 수 없으면 '문서' */
export function fileBadge(url: string): string {
  const m = /\.([a-z0-9]{2,4})(?:$|[?#])/i.exec(new URL(url).pathname);
  return m ? m[1].toUpperCase() : '문서';
}

/** 자료실 출처 라벨 */
export const DOC_SOURCE_LABELS = { www: 'ls-electric.com 자료실', ssq: 'SSQ 기술자료실' } as const;

/** 계층 밴드 배경색을 CSS 변수(--layer-bg)로 넘긴다 */
export function layerStyle(layer: Layer): import('react').CSSProperties {
  return { ['--layer-bg' as string]: `var(--band-${layer.toLowerCase()})` } as import('react').CSSProperties;
}
