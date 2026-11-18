#!/usr/bin/env node
// 기기 종류별 대표 제품 사진 수집 (사내 허가 하에 LS ELECTRIC 공식 사이트 이미지 사용)
// 출력: public/images/equipment/<equipmentId>.<ext>, src/data/equipment-images.json
// 실행: node scripts/fetch-images.mjs [--only=vcb,acb] [--force]
// 규칙: 요청 간 1.2초, 일반 UA, 제품 페이지의 #hd_entity(p_image → p_thumb → c_thumb) 사용
// 후처리(macOS): 원본은 320px, 썸네일 160px 로 줄이고 index 의 bytes·thumb 갱신
//   cd public/images/equipment && for f in *.png; do sips -Z 320 "$f" --out "$f"; sips -Z 160 "$f" --out "thumb/$f"; done
import { readFile, writeFile, mkdir, rename, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://www.ls-electric.com';
const UA = 'LSE-ProductMap/0.1';
const DELAY = 1200;
const OUT_DIR = path.join(ROOT, 'public/images/equipment');
const INDEX = path.join(ROOT, 'src/data/equipment-images.json');

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const only = args.only ? new Set(String(args.only).split(',')) : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let requests = 0;
async function get(url, asBuffer = false) {
  requests++;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
  await sleep(DELAY);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return asBuffer ? { buf: Buffer.from(await res.arrayBuffer()), type: res.headers.get('content-type') || '' } : res.text();
}

function decodeEntities(s) {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
function parseEntity(html) {
  const m = html.match(/id="hd_entity"[^>]*value="([^"]*)"/) || html.match(/value="([^"]*)"[^>]*id="hd_entity"/);
  if (!m) return null;
  try { return JSON.parse(decodeEntities(m[1])); } catch { return null; }
}

const equipment = JSON.parse(await readFile(path.join(ROOT, 'src/data/equipment-types.json'), 'utf8'));
const products = JSON.parse(await readFile(path.join(ROOT, 'src/data/products.json'), 'utf8'));
let index = {};
try { index = JSON.parse(await readFile(INDEX, 'utf8')); } catch { /* 처음 실행 */ }
await mkdir(OUT_DIR, { recursive: true });

function candidates(eq) {
  const ids = [...(eq.productIds ?? [])];
  for (const code of eq.lseCategoryCodes) {
    for (const p of products) if (p.categoryCode.startsWith(code) && !p.discontinued) ids.push(p.id);
  }
  return [...new Set(ids)];
}

for (const eq of equipment) {
  if (only && !only.has(eq.id)) continue;
  if (index[eq.id] && !args.force) continue;
  if (eq.coverage === 'missing' || eq.coverage === 'na') continue; // 자사 제품 없음 → 심볼로 표시
  const pages = candidates(eq).slice(0, 3).map((id) => ({ url: `${BASE}/ko/product/view/${id}`, productId: id }));
  if (!pages.length) for (const code of eq.lseCategoryCodes.slice(0, 2)) pages.push({ url: `${BASE}/ko/product/category/${code}`, productId: null });
  let done = false;
  for (const pg of pages) {
    try {
      const ent = parseEntity(await get(pg.url));
      const src = ent && (ent.p_image || ent.p_thumb || ent.c_image || ent.c_thumb);
      if (!src) continue;
      const imgUrl = new URL(src, BASE).href;
      const { buf, type } = await get(imgUrl, true);
      if (!type.startsWith('image/') || buf.length < 500) continue;
      const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
      const file = `${eq.id}.${ext}`;
      const tmp = path.join(OUT_DIR, `.${file}.tmp`);
      await writeFile(tmp, buf);
      await rename(tmp, path.join(OUT_DIR, file));
      index[eq.id] = { file: `images/equipment/${file}`, productId: pg.productId, productName: ent.p_name ?? null, sourceUrl: imgUrl, bytes: buf.length };
      console.log(`[img] ${eq.id} ← ${ent.p_name ?? ent.c_name ?? pg.url} (${Math.round(buf.length / 1024)}KB)`);
      done = true;
      break;
    } catch (e) {
      console.warn(`[img] ${eq.id} 실패: ${e.message}`);
    }
  }
  if (!done) console.warn(`[img] ${eq.id} 사진 없음`);
}

const sorted = Object.fromEntries(Object.keys(index).sort().map((k) => [k, index[k]]));
await writeFile(INDEX + '.tmp', JSON.stringify(sorted, null, 2) + '\n');
await rename(INDEX + '.tmp', INDEX);
console.log(`[img] 완료: ${Object.keys(sorted).length}종, 요청 ${requests}회`);
