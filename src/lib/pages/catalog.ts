/**
 * 상세 페이지(제품·기기·공백 표·교육) 공용 헬퍼 — T1-B 소유.
 * 데이터 파일·load.ts 는 수정하지 않고, getData() 결과 위에서 파생 값만 계산한다.
 */
import { getData, resolveProducts, type AppData } from '../../data/load';
import {
  LAYERS,
  type Coverage,
  type DiagramEdge,
  type DiagramNode,
  type EquipmentCategory,
  type EquipmentType,
  type Layer,
  type Product,
} from '../schema';

/** 기기 기능 분류 한국어 라벨 (schema 에 없어 페이지 쪽 상수로 둔다) */
export const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  switching: '개폐',
  protection: '보호',
  transformation: '변성',
  measurement: '계측',
  control: '제어',
  monitoring: '감시',
  generation: '발전',
  conductor: '선로',
  load: '부하',
  system: '시스템',
};

export const CATEGORY_ORDER: EquipmentCategory[] = [
  'switching',
  'protection',
  'transformation',
  'measurement',
  'control',
  'monitoring',
  'generation',
  'conductor',
  'load',
  'system',
];

/** 공백 표·칩 표시 순서 */
export const COVERAGE_ORDER: Coverage[] = ['owned', 'partial', 'affiliate', 'missing', 'na'];

/** 계통도 화면으로 가는 링크 (메인 화면은 ?node=, ?mode= 쿼리로 상태 복원) */
export function diagramHref(nodeId?: string, mode?: 'gap' | 'learn'): string {
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
    if (!nodeByEquipmentId.has(n.equipmentTypeId)) nodeByEquipmentId.set(n.equipmentTypeId, n);
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

const PRIMARY_COVERAGE_RANK: Record<Coverage, number> = { owned: 0, partial: 1, affiliate: 2, missing: 3, na: 4 };

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
  edgeToNext?: 'power' | 'signal';
}

/**
 * 노드의 앞(들어오는 선)·뒤(나가는 선) 인접 노드로 3칸 미니 체인을 만든다.
 * 같은 계층의 이웃을 우선, 없으면 다른 계층(감시·신재생 등).
 */
export function neighborChain(nodeId: string): ChainLink[] {
  const data = getData();
  const { nodeById } = getDerived(data);
  const self = nodeById.get(nodeId);
  if (!self) return [];
  const selfEq = data.equipmentTypeById.get(self.equipmentTypeId);
  const layerOf = (n: DiagramNode) => data.equipmentTypeById.get(n.equipmentTypeId)?.layer;
  const pick = (edges: DiagramEdge[], otherEnd: (e: DiagramEdge) => string) => {
    const cands = edges
      .map((e) => ({ e, n: nodeById.get(otherEnd(e)) }))
      .filter((c): c is { e: DiagramEdge; n: DiagramNode } => c.n !== undefined);
    return cands.find((c) => layerOf(c.n) === selfEq?.layer) ?? cands[0];
  };
  const prev = pick(
    data.diagram.edges.filter((e) => e.to === nodeId),
    (e) => e.from,
  );
  const next = pick(
    data.diagram.edges.filter((e) => e.from === nodeId),
    (e) => e.to,
  );
  const toLink = (n: DiagramNode, edgeToNext?: DiagramEdge): ChainLink | undefined => {
    const eq = data.equipmentTypeById.get(n.equipmentTypeId);
    return eq ? { node: n, eq, edgeToNext: edgeToNext ? (edgeToNext.kind ?? 'power') : undefined } : undefined;
  };
  return [
    prev && toLink(prev.n, prev.e),
    toLink(self, next?.e),
    next && toLink(next.n),
  ].filter((l): l is ChainLink => l !== undefined);
}

// ───────────── 공백 표 ─────────────

export type CoverageCounts = Record<Coverage, number>;

export const emptyCounts = (): CoverageCounts => ({ owned: 0, partial: 0, affiliate: 0, missing: 0, na: 0 });

export function countCoverage(list: EquipmentType[]): CoverageCounts {
  const c = emptyCounts();
  for (const eq of list) c[eq.coverage] += 1;
  return c;
}

/** 보유율 = owned / 전체 (디자인 승인안 기준. na 포함 전체 기기 종류 수가 분모) */
export function ownedRate(c: CoverageCounts): { owned: number; total: number; pct: number } {
  const total = COVERAGE_ORDER.reduce((s, k) => s + c[k], 0);
  return { owned: c.owned, total, pct: total === 0 ? 0 : Math.round((c.owned / total) * 100) };
}

export const GAP_COVERAGES: Coverage[] = ['missing', 'partial', 'affiliate'];

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

function csvCell(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** CSV 문자열 (UTF-8 BOM 포함 — Excel 한글 깨짐 방지) */
export function buildGapCsv(list: EquipmentType[], coverageLabel: (c: Coverage) => string, layerLabel: (l: Layer) => string): string {
  const header = ['상태', '계층', '계층명', '기기 ID', '기기명', '약어', '기능', '계열사', '메모'];
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
