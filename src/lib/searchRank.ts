/**
 * 헤더 검색 순위 매기기 — SearchBox 에서 분리한 순수 함수 (단위 테스트로 Enter 대상 = 1위를 고정하기 위함).
 *
 * 규칙 (UX 라운드 U 리뷰 M1):
 *  - 기기 약어·이름이 질의와 정확히 같으면 그 기기가 1위 ("VCB"·"ACB"·"MCCB"·"진공차단기").
 *  - 제품명 모델 토큰 정확 일치(점수 0)는 숫자가 든 질의에만 ("TS250"·"GIPAM 1000").
 *    영문자만 있는 질의("ACB")는 "Susol ACB" 같은 제품명 토큰과 겹쳐 기기를 밀어내므로 제외한다.
 *    숫자 없는 형식명("ABN")은 옵션 색인의 접두 일치로 계속 찾는다 (searchOptions).
 *  - 점수가 같으면 기기 → 제품 → 옵션.
 */
import Fuse from 'fuse.js';
import { getData } from '../data/load';
import { getDiagramModel, type NodeItem } from './diagram/model';
import { equipmentForProduct, productsForEquipment } from './pages/catalog';
import { normalizeModel, productNameExact, searchOptions, OPTION_SCORE, type OptionDoc } from './search';

export type SearchResult = { score: number } & (
  | { kind: 'equipment'; key: string; node: NodeItem }
  | { kind: 'product'; key: string; id: string; name: string; path: string }
  | { kind: 'option'; key: string; doc: OptionDoc }
);

const KIND_ORDER: Record<SearchResult['kind'], number> = { equipment: 0, product: 1, option: 2 };

export const MAX_EACH = 6;
export const MAX_TOTAL = 10;
/** 영숫자(모델명) 질의에서 기기 설명문 퍼지 매칭 잡음을 거르는 점수 상한 (0 = 완전 일치) */
const ASCII_EQ_MAX_SCORE = 0.2;
/** 정확 일치로 볼 점수 상한 — 이 무리는 맨 위에 두고, 기기 1줄은 그 바로 뒤에 보장 */
const EXACT_MAX_SCORE = 0.05;

interface EqDoc {
  node: NodeItem;
  abbr?: string;
  name: string;
  description: string;
  /** 연결 제품 이름 — 모델명(GIPAM·Susol·iS7)으로 기기를 찾기 위함 */
  productNames: string[];
}

export interface SearchIndexes {
  eq: Fuse<EqDoc>;
  products: Fuse<ReturnType<typeof getData>['products'][number]>;
  nodeByEq: Map<string, NodeItem>;
  /** 정규화한 기기 약어·이름 → 노드 (정확 일치 1위용) */
  eqExact: Map<string, NodeItem>;
}

export function buildSearchIndexes(): SearchIndexes {
  const model = getDiagramModel();
  const docs: EqDoc[] = model.nodes.map((node) => ({
    node,
    abbr: node.eq.abbr,
    name: node.eq.name,
    description: node.eq.description,
    productNames: productsForEquipment(node.eq.id).map((p) => p.name),
  }));
  const eq = new Fuse(docs, {
    keys: [
      { name: 'abbr', weight: 3 },
      { name: 'name', weight: 3 },
      { name: 'productNames', weight: 1 },
      { name: 'description', weight: 0.5 },
    ],
    threshold: 0.34,
    ignoreLocation: true,
    includeScore: true,
    minMatchCharLength: 2,
  });
  const products = new Fuse(getData().products, {
    keys: [
      { name: 'name', weight: 3 },
      { name: 'categoryPath', weight: 1 },
    ],
    threshold: 0.3,
    ignoreLocation: true,
    includeScore: true,
    minMatchCharLength: 2,
  });
  const nodeByEq = new Map(model.nodes.map((n) => [n.eq.id, n] as const));
  const eqExact = new Map<string, NodeItem>();
  for (const n of model.nodes) {
    for (const s of [n.eq.abbr, n.eq.name]) {
      const k = s ? normalizeModel(s) : '';
      if (k && !eqExact.has(k)) eqExact.set(k, n);
    }
  }
  return { eq, products, nodeByEq, eqExact };
}

/**
 * 기기 결과 1줄 보장 (UX 토론 B6 절충) — 정확 일치 무리 바로 뒤에 기기 1줄이 오게 한다.
 * 기기 검색 결과가 없으면 맨 위 제품·옵션이 속한 기기를 대신 보여 준다 (예: TS250 → MCCB).
 */
function withEquipmentRow(merged: SearchResult[], eqs: SearchResult[], nodeByEq: Map<string, NodeItem>): SearchResult[] {
  const firstEq = merged.findIndex((r) => r.kind === 'equipment');
  let eqRow: SearchResult | undefined = firstEq >= 0 ? merged[firstEq] : undefined;
  if (!eqRow && eqs.length === 0) {
    const top = merged.find((r) => r.kind !== 'equipment');
    const productId = top?.kind === 'option' ? top.doc.productId : top?.kind === 'product' ? top.id : undefined;
    const eq = productId ? equipmentForProduct(productId)[0] : undefined;
    const node = eq ? nodeByEq.get(eq.id) : undefined;
    if (node) eqRow = { kind: 'equipment', key: `e-${node.id}`, node, score: 1 };
  }
  if (!eqRow) return merged;
  const exactCount = merged.findIndex((r) => r.score > EXACT_MAX_SCORE);
  // 맨 위(Enter 대상)는 점수 1위 그대로 두고, 정확 일치 무리(없으면 1위) 바로 뒤
  const slot = Math.min(Math.max(1, exactCount < 0 ? merged.length : exactCount), MAX_TOTAL - 1);
  if (firstEq >= 0 && firstEq <= slot) return merged;
  const rest = merged.filter((r) => r !== eqRow);
  return [...rest.slice(0, slot), eqRow, ...rest.slice(slot)];
}

/** 질의 → 검색 결과 (0번 = Enter 대상). optionIndex 는 specs 지연 로딩 전이면 빈 배열 */
export function rankSearch(query: string, idx: SearchIndexes, optionIndex: readonly OptionDoc[]): SearchResult[] {
  const q = query.trim();
  if (!q) return [];
  const ascii = /^[\x20-\x7e]+$/.test(q);
  const exactNode = idx.eqExact.get(normalizeModel(q));
  const eqs: SearchResult[] = idx.eq
    .search(q, { limit: MAX_EACH })
    .filter((r) => !ascii || (r.score ?? 1) <= ASCII_EQ_MAX_SCORE || r.item.node === exactNode)
    .map((r) => ({
      kind: 'equipment',
      key: `e-${r.item.node.id}`,
      node: r.item.node,
      // 기기 약어·이름 정확 일치 = 점수 0 (같은 점수면 기기가 먼저 → 1위)
      score: r.item.node === exactNode ? 0 : (r.score ?? 1),
    }));
  if (exactNode && !eqs.some((r) => r.kind === 'equipment' && r.node === exactNode)) {
    eqs.unshift({ kind: 'equipment', key: `e-${exactNode.id}`, node: exactNode, score: 0 });
  }
  const prods: SearchResult[] = idx.products.search(q, { limit: MAX_EACH }).map((r) => ({
    kind: 'product',
    key: `p-${r.item.id}`,
    id: r.item.id,
    name: r.item.name,
    path: r.item.categoryPath.join(' › '),
    // 숫자가 든 모델 질의만: 제품명 모델 토큰이 정확히 같으면 정확 일치로 올림 (예: "GIPAM 1000" → GIPAM1000)
    score: productNameExact(r.item.name, q) ? OPTION_SCORE.exact : (r.score ?? 1),
  }));
  const opts: SearchResult[] = searchOptions(optionIndex, q, MAX_EACH).map((h) => ({
    kind: 'option',
    key: `o-${h.doc.productId}-${h.doc.variantId}`,
    doc: h.doc,
    score: h.score,
  }));
  // 기기·제품·옵션을 점수 하나로 합쳐 정렬 (같은 점수면 기기 → 제품 → 옵션) → Enter = 가장 잘 맞는 결과
  const merged = [...eqs, ...prods, ...opts].sort((a, b) => a.score - b.score || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  return withEquipmentRow(merged, eqs, idx.nodeByEq).slice(0, MAX_TOTAL);
}
