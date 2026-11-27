#!/usr/bin/env node
/**
 * LS ELECTRIC 공식 사이트 메뉴 트리 → src/data/products.json, src/data/categories.json
 * 의존성 없음 (Node 18+ 내장 fetch).  실행: npm run fetch:products
 *
 * - 입력: https://www.ls-electric.com/ko/common/js/site/menu  (`var _menu = {...};` JS)
 * - '사업소개' 하위만 순회. url 이 /ko/product/view/P… → Product, /ko/product/category/… → Category
 * - 'Beyond X™ Power Solution' 하위 = power, 'Beyond X™ Automation Solution' 하위 = automation
 * - 외부 도메인(beyondx-sf 등) 은 제외
 * - Category.productIds 는 하위(자손) 카테고리의 제품까지 모두 포함
 * - Product.categoryCode 는 가장 가까운 상위 카테고리. 같은 제품이 여러 카테고리에 있으면 첫 위치 기준
 * - 저장 전 src/lib/schema.ts 의 Zod 스키마로 검증 (Node 22.18+ type stripping 으로 .ts 직접 import).
 *   검증 실패 시 파일을 쓰지 않는다. 두 파일 모두 임시 파일에 쓴 뒤 rename 으로 교체(원자적).
 * - 기존 products.json 의 docs 는 보존 (자료는 별도 파일 docs.json — scripts/fetch-docs.mjs)
 */
import { writeFile, mkdir, readFile, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://www.ls-electric.com';
const MENU_URL = `${ORIGIN}/ko/common/js/site/menu`;
const USER_AGENT = 'LSE-ProductMap/0.1';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'src/data');
const FETCH_TIMEOUT_MS = 20_000;

const PRODUCT_RE = /^\/ko\/product\/view\/(P[0-9A-Za-z]+)\/?$/;
const CATEGORY_RE = /^\/ko\/product\/category\/([0-9A-Za-z]+)\/?$/;

/** `var _menu = ` 뒤의 JSON 객체만 괄호 매칭으로 잘라 파싱 (문자열 내부 괄호/이스케이프 고려) */
export function extractMenuJson(source) {
  // `var _menu =` 외에 let/const/window._menu 로 바뀌어도 동작하도록
  const m = /(?:var|let|const|window\.)\s*_menu\s*=/.exec(source);
  if (!m) throw new Error('`_menu =` 선언을 찾을 수 없습니다');
  const marker = m.index;
  const start = source.indexOf('{', marker);
  if (start < 0) throw new Error('_menu JSON 시작 `{` 를 찾을 수 없습니다');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) return JSON.parse(source.slice(start, i + 1));
    }
  }
  throw new Error('_menu JSON 이 닫히지 않았습니다');
}

export function cleanName(name) {
  return String(name ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function businessOf(node) {
  const url = node.url ?? '';
  const name = cleanName(node.name);
  if (url.includes('/product/main/power') || /Power Solution/i.test(name)) return 'power';
  if (url.includes('/product/main/automation') || /Automation/i.test(name)) return 'automation';
  return null;
}

function findNode(node, pred) {
  if (pred(node)) return node;
  for (const child of node.sub ?? []) {
    const found = findNode(child, pred);
    if (found) return found;
  }
  return null;
}

export function buildCatalog(menu) {
  const business = findNode(menu, (n) => cleanName(n.name) === '사업소개');
  if (!business) throw new Error("'사업소개' 노드를 찾을 수 없습니다");

  /** @type {Map<string, any>} */
  const products = new Map();
  /** @type {Map<string, any>} */
  const categories = new Map();
  let skippedExternal = 0;

  const walk = (node, biz, path, ancestorCats) => {
    for (const child of node.sub ?? []) {
      const url = child.url ?? '';
      const name = cleanName(child.name);
      if (/^https?:\/\//i.test(url) && !url.startsWith(ORIGIN)) {
        skippedExternal++;
        continue; // 외부 도메인 제외 (하위도 제외)
      }
      const rel = url.startsWith(ORIGIN) ? url.slice(ORIGIN.length) : url;
      const productMatch = rel.match(PRODUCT_RE);
      const categoryMatch = rel.match(CATEGORY_RE);

      if (productMatch) {
        const id = productMatch[1];
        if (!products.has(id)) {
          const parent = ancestorCats[ancestorCats.length - 1];
          products.set(id, {
            id,
            name,
            categoryCode: parent?.code ?? '',
            categoryPath: [...path],
            url: ORIGIN + rel,
            business: biz,
            // 메뉴 트리에는 단종 표시가 거의 없어(현재 0건) 사실상 동작하지 않는 휴리스틱.
            // 정확한 단종 여부는 제품 페이지 #hd_entity.p_status === 'close' (fetch-docs 단계에서 확인 가능)
            discontinued: name.includes('단종'),
            docs: [],
          });
        }
        for (const cat of ancestorCats) {
          if (!cat.productIds.includes(id)) cat.productIds.push(id);
        }
        walk(child, biz, [...path, name], ancestorCats);
      } else if (categoryMatch) {
        const code = categoryMatch[1];
        let cat = categories.get(code);
        if (!cat) {
          const parent = ancestorCats[ancestorCats.length - 1];
          cat = {
            code,
            name,
            path: [...path, name],
            url: ORIGIN + rel,
            ...(parent ? { parentCode: parent.code } : {}),
            productIds: [],
          };
          categories.set(code, cat);
        }
        walk(child, biz, [...path, name], [...ancestorCats, cat]);
      } else {
        walk(child, biz, [...path, name], ancestorCats);
      }
    }
  };

  for (const top of business.sub ?? []) {
    const biz = businessOf(top);
    if (!biz) {
      skippedExternal++;
      continue;
    }
    walk(top, biz, [], []);
  }

  // 카테고리형 제품 (2026-11-27): 하위 분류·제품 없이 분류 페이지 자체가 제품 소개인 곳(MMS·VC·DC 기기·GIS 등)은
  // 분류 코드를 id 로 하는 제품으로 넣는다. 산업별 솔루션·에너지절감 분야·소프트웨어·일람표·단종 시리즈는 제외.
  const hasChild = new Set([...categories.values()].map((c) => c.parentCode).filter(Boolean));
  const NOT_PRODUCT = /^(BBB007|BBB010|BBB011|BBB012|BBB013|BBB014)/;
  const NOT_PRODUCT_CODES = new Set(['BBB001012', 'BBB001018']);
  const GENERIC_NAME = { 저압: '소프트스타터 (저압)', 고압: '소프트스타터 (고압)' };
  for (const cat of categories.values()) {
    if (hasChild.has(cat.code) || cat.productIds.length || NOT_PRODUCT.test(cat.code) || NOT_PRODUCT_CODES.has(cat.code) || cat.name.includes('단종')) continue;
    const id = cat.code;
    products.set(id, {
      id,
      name: (cat.code.startsWith('BBB008') && GENERIC_NAME[cat.name]) || cat.name,
      categoryCode: id,
      categoryPath: cat.path.slice(0, -1),
      url: cat.url,
      source: 'ko',
      business: id.startsWith('BBB') ? 'automation' : 'power',
      discontinued: false,
      docs: [],
    });
    for (let c = cat; c; c = c.parentCode ? categories.get(c.parentCode) : undefined) if (!c.productIds.includes(id)) c.productIds.push(id);
  }

  return {
    products: [...products.values()],
    categories: [...categories.values()],
    skippedExternal,
  };
}

/** Zod 검증 — 실패하면 어떤 항목이 틀렸는지 보여 주고 throw */
async function validate(products, categories) {
  const { ProductsSchema, CategoriesSchema } = await import('../src/lib/schema.ts');
  const { z } = await import('zod');
  for (const [file, schema, data] of [
    ['products.json', ProductsSchema, products],
    ['categories.json', CategoriesSchema, categories],
  ]) {
    const r = schema.safeParse(data);
    if (!r.success) throw new Error(`${file} 스키마 검증 실패 — 파일을 쓰지 않았습니다:\n${z.prettifyError(r.error)}`);
  }
}

/** 기존 products.json 의 docs 를 id 기준으로 보존 */
async function preserveDocs(products) {
  let prev = [];
  try {
    prev = JSON.parse(await readFile(resolve(OUT_DIR, 'products.json'), 'utf8'));
  } catch {
    return;
  }
  const prevById = new Map(prev.map((p) => [p.id, p]));
  for (const p of products) p.docs = prevById.get(p.id)?.docs ?? [];
  const removed = prev.filter((p) => !products.some((n) => n.id === p.id)).map((p) => p.id);
  if (removed.length > 0) console.warn(`[주의] 이전 대비 사라진 제품 id ${removed.length}개: ${removed.join(', ')}`);
}

/** 임시 파일에 모두 쓴 뒤 rename — 중간 실패 시 기존 파일은 그대로 */
async function writeAtomically(entries) {
  const tmps = [];
  try {
    for (const [file, data] of entries) {
      const tmp = resolve(OUT_DIR, `.${file}.tmp`);
      await writeFile(tmp, JSON.stringify(data, null, 2) + '\n');
      tmps.push([tmp, resolve(OUT_DIR, file)]);
    }
    for (const [tmp, out] of tmps) await rename(tmp, out);
  } catch (e) {
    await Promise.all(tmps.map(([tmp]) => rm(tmp, { force: true })));
    throw e;
  }
}

async function main() {
  const res = await fetch(MENU_URL, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`메뉴 요청 실패: HTTP ${res.status}`);
  const text = await res.text();
  const menu = extractMenuJson(text);
  const { products, categories, skippedExternal } = buildCatalog(menu);
  if (products.length === 0) throw new Error('제품이 0개입니다 — 메뉴 구조가 바뀌었는지 확인하세요');

  await mkdir(OUT_DIR, { recursive: true });
  await preserveDocs(products);
  await validate(products, categories);
  await writeAtomically([
    ['products.json', products],
    ['categories.json', categories],
  ]);

  const byBiz = products.reduce((acc, p) => ((acc[p.business] = (acc[p.business] ?? 0) + 1), acc), {});
  console.log(
    `products: ${products.length} (${Object.entries(byBiz).map(([k, v]) => `${k} ${v}`).join(', ')}), ` +
      `discontinued: ${products.filter((p) => p.discontinued).length}, ` +
      `categories: ${categories.length}, skipped external: ${skippedExternal}`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
