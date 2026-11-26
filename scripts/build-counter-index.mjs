#!/usr/bin/env node
/**
 * 경쟁 대응 사전 공개 파일 — dist/counter-index.json (2026-11-26)
 * 시장 뉴스 대시보드(lse-news)가 빌드할 때 받아 경쟁사 기사마다 연관 자사 기기를 붙인다.
 * 원본: src/data/counter-dict.json (제품맵 경쟁 대응 화면과 같은 사전) + equipment-types.json + products.json
 *
 * 형식 (schema 1 — 필드를 빼거나 뜻을 바꾸면 schema 를 올린다, 더하기만 하면 그대로)
 * {
 *   schema: 1, generatedAt, site,
 *   competitors: [{ id, name, aliases[] }],
 *   terms: [[keyword, equipmentId, score]],   // 소문자, 4자 이하 영문 약어는 단어 경계로 비교
 *   series: [[keyword, equipmentId]],          // 경쟁사 시리즈명, 점수 5
 *   projects: [{ id, label, terms[], equipment[], preset? }],
 *   adjacent: { equipmentId: [equipmentId] },  // 자사 범위 밖 기기 → 함께 쓰이는 자사 기기
 *   examples: [{ q, competitors[], top?[], includes?[], excludes?[], projects?[] }],  // 매칭 기준 예시
 *   equipment: { id: { name, abbr?, layer, coverage, url, products: [{ id, name, url }] } }
 * }
 * 매칭 규칙은 src/lib/counter/match.ts matchText 와 같게 구현해야 한다.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://lse-grid-map.pages.dev';
const read = async (p) => JSON.parse(await readFile(resolve(ROOT, p), 'utf8'));

const dict = await read('src/data/counter-dict.json');
const eqFile = await read('src/data/equipment-types.json');
const prodFile = await read('src/data/products.json');
const equipmentTypes = eqFile.equipmentTypes ?? eqFile;
const products = (prodFile.products ?? prodFile).filter((p) => !p.discontinued);

// 기기 ↔ 제품: 제품맵 src/data/load.ts resolveProducts 와 같은 규칙
//   eq.productIds + lseCategoryCodes 카테고리의 productIds + 카테고리 코드 접두사로 시작하는 제품 (중복 제거), 단종 제외
const catFile = await read('src/data/categories.json');
const categories = catFile.categories ?? catFile;
const catByCode = new Map(categories.map((c) => [c.code, c]));
const productById = new Map(products.map((p) => [p.id, p]));
const byEq = {};
for (const e of equipmentTypes) {
  const ids = new Set(e.productIds ?? []);
  for (const code of e.lseCategoryCodes ?? []) {
    for (const pid of catByCode.get(code)?.productIds ?? []) ids.add(pid);
    for (const p of products) if (p.categoryCode?.startsWith(code)) ids.add(p.id);
  }
  byEq[e.id] = [...ids]
    .map((id) => productById.get(id))
    .filter(Boolean)
    .slice(0, 12)
    .map((p) => ({ id: p.id, name: p.name, url: `${SITE}/#/product/${encodeURIComponent(p.id)}` }));
}

const used = new Set([...dict.terms.map((t) => t[1]), ...dict.series.map((t) => t[1]), ...dict.projects.flatMap((p) => p.equipment), ...Object.keys(dict.adjacent), ...Object.values(dict.adjacent).flat()]);
const equipment = {};
for (const e of equipmentTypes) {
  if (!used.has(e.id)) continue;
  equipment[e.id] = { name: e.name, ...(e.abbr ? { abbr: e.abbr } : {}), layer: e.layer, coverage: e.coverage, url: `${SITE}/#/equipment/${e.id}`, products: byEq[e.id] ?? [] };
}

const out = {
  schema: 1,
  generatedAt: new Date().toISOString(),
  site: SITE,
  counterUrl: `${SITE}/#/counter?q=`,
  competitors: dict.competitors,
  terms: dict.terms,
  series: dict.series,
  projects: dict.projects,
  adjacent: dict.adjacent,
  // 기준 예시 — 받는 쪽 매칭 구현이 제품맵과 같은 결과를 내는지 테스트용
  examples: dict.examples ?? [],
  equipment,
};
const dest = resolve(ROOT, process.argv[2] ?? 'dist/counter-index.json');
await mkdir(dirname(dest), { recursive: true });
await writeFile(dest, JSON.stringify(out) + '\n');
console.log(`counter-index.json: 기기 ${Object.keys(equipment).length} · 키워드 ${dict.terms.length} · 시리즈 ${dict.series.length} → ${dest}`);
