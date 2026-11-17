#!/usr/bin/env node
/**
 * 제품별 공개 자료(카탈로그·데이터시트·매뉴얼) 링크 수집 → src/data/docs.json
 * 근거: docs/research/download-api.md (T2 조사), scripts/probe-downloads.mjs (프로토타입)
 *
 * 실행 예:
 *   node scripts/fetch-docs.mjs --only=P01062,P01072      특정 제품만
 *   node scripts/fetch-docs.mjs --limit=10                 products.json 앞에서 10개
 *   node scripts/fetch-docs.mjs --resume                   중단된 실행 이어서 (이미 받은 제품 건너뜀)
 *
 * 출력 docs.json = { generatedAt, products: { [productId]: { source: 'www'|'ssq', deepLink, docs: DocRef[] } } }
 *  - 기존 docs.json 의 다른 제품 항목은 유지하고, 이번에 받은 제품만 교체(병합)
 *  - 저장 전 src/lib/schema.ts DocsFileSchema 로 검증, 실패 시 쓰지 않음. 임시 파일 → rename (원자적)
 *  - 중간 결과: .cache/fetch-docs.partial.json (제품 1개 끝날 때마다 갱신, 성공 종료 시 삭제)
 *
 * 수집 규칙 (리더 결정 — 반드시 준수)
 *  - 요청 간 최소 1.1초, UA 'LSE-ProductMap/0.1' (연락처·이메일 넣지 않음), 요청 타임아웃 20초
 *  - 공개 문서만: ssq displayTarget === 0
 *  - 개인정보 저장 금지: 응답의 writerId·lastModifierId 등은 읽지도 저장하지도 않음 (type/title/url/lang/updatedAt 만 추림)
 *  - 통계 API 호출 금지: www t=hits, ssq addDownloadCount·addClickCount 를 절대 호출하지 않음
 *  - 파일 직링크는 catalog·datasheet·manual 만, 유형별 최신 최대 3건. CAD·인증서 등은 저장하지 않고 deepLink 로 대체
 *    → www file_list 호출은 제품당 최대 9회
 *  - www API 는 Referer: https://www.ls-electric.com/ko/download/ 필수 (없으면 빈 응답)
 */
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PRODUCTS_FILE = resolve(ROOT, 'src/data/products.json');
const OUT_FILE = resolve(ROOT, 'src/data/docs.json');
const PARTIAL_FILE = resolve(ROOT, '.cache/fetch-docs.partial.json');

const WWW = 'https://www.ls-electric.com';
const WWW_REFERER = `${WWW}/ko/download/`;
const SSQ = 'https://ssq.ls-electric.com';
const SSQ_CDN = 'https://ssqfd-abhdhraad3gkgbcg.a03.azurefd.net'; // ssq 앱이 대용량 blob URL 을 이 origin 으로 바꿔 씀
const USER_AGENT = 'LSE-ProductMap/0.1';
const DELAY_MS = 1100;
const TIMEOUT_MS = 20_000;
const PER_TYPE = 3;
const KEEP_TYPES = ['catalog', 'datasheet', 'manual'];

// ---------- 인자 ----------
const args = process.argv.slice(2);
const argValue = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const ONLY = argValue('only')?.split(',').map((s) => s.trim()).filter(Boolean);
const LIMIT = argValue('limit') ? Number(argValue('limit')) : undefined;
const RESUME = args.includes('--resume');
if (LIMIT !== undefined && !(LIMIT > 0)) throw new Error('--limit=N 은 1 이상의 정수');

// ---------- HTTP (전역 1.1초 간격) ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...m) => console.error('[fetch-docs]', ...m);
let lastRequestAt = 0;
let requestCount = 0;

async function get(url, { referer, json = true } = {}) {
  // 안전장치: 통계 API 는 어떤 경우에도 호출하지 않음
  if (/[?&]t=hits\b|addDownloadCount|addClickCount/i.test(url)) throw new Error(`금지된 통계 API: ${url}`);
  const wait = lastRequestAt + DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
  requestCount++;
  const headers = { 'User-Agent': USER_AGENT };
  if (referer) headers.Referer = referer;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const text = await res.text();
  if (!json) return text;
  if (!text) throw new Error(`빈 응답 (Referer 누락?) ${url}`);
  return JSON.parse(text);
}

// ---------- 매핑 ----------
const WWW_TYPE = { 1: 'catalog', 2: 'manual', 9: 'datasheet' }; // dc_id (다운로드 페이지 #hd_category)
const WWW_DC_IDS = Object.keys(WWW_TYPE).join(',');
const WWW_LANG = { 한국어: 'ko', 영어: 'en', 중국어: 'zh', 일본어: 'ja', 독일어: 'de', 스페인어: 'es', 프랑스어: 'fr',
  러시아어: 'ru', 아랍어: 'ar', 이란어: 'fa', 이탈리아어: 'it', 폴란드어: 'pl', 터키어: 'tr', 베트남어: 'vi' };
const SSQ_TYPE = { CATALOG: 'catalog', DATASHEET: 'datasheet', MANUAL: 'manual' };
const SSQ_DOC_TYPES = Object.keys(SSQ_TYPE).join(',');

const toDate = (s) => (s ? String(s).slice(0, 10).replaceAll('/', '-') : undefined);
/** DocRef 에 허용된 필드만 추림 (undefined 필드 제거) */
const docRef = ({ type, title, url, lang, updatedAt }) =>
  Object.fromEntries(Object.entries({ type, title, url, lang, updatedAt }).filter(([, v]) => v !== undefined && v !== null && v !== ''));

/** 유형별 최대 PER_TYPE 건, url 중복 제거 */
function capPerType(docs) {
  const count = {};
  const seen = new Set();
  const out = [];
  for (const d of docs) {
    if (!KEEP_TYPES.includes(d.type) || seen.has(d.url)) continue;
    if ((count[d.type] ?? 0) >= PER_TYPE) continue;
    count[d.type] = (count[d.type] ?? 0) + 1;
    seen.add(d.url);
    out.push(d);
  }
  return out;
}

// ---------- 제품 페이지: c_code, ssq 링크 ----------
function decodeEntities(s) {
  return s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
async function getProductEntity(pid) {
  const html = await get(`${WWW}/ko/product/view/${pid}`, { json: false });
  const m = html.match(/id="hd_entity" value="([^"]*)"/);
  if (!m) throw new Error(`#hd_entity 없음`);
  const e = JSON.parse(decodeEntities(m[1]));
  // 필요한 필드만 사용 (같은 페이지의 #hd_qna 등 개인정보는 읽지 않음)
  return { c_code: e.c_code, p_name: e.p_name, p_ssq_yn: e.p_ssq_yn, p_ssq_link: e.p_ssq_link };
}
function ssqCategoryOf(entity) {
  const yn = entity.p_ssq_yn;
  const enabled = yn === true || yn === 1 || /^(y|yes|true|1)$/i.test(String(yn ?? ''));
  if (!enabled) return null;
  return /\/product\/category\/(\d+)/.exec(entity.p_ssq_link || '')?.[1] ?? null;
}

// ---------- www 자료실 ----------
async function fromWww(pid, cCode) {
  const rows = [];
  for (let page = 1; page <= 10; page++) {
    const q = new URLSearchParams({ t: 'list', page, rowsPerPage: 50, k_word: '', dc_id: WWW_DC_IDS, c_code: cCode, p_code: pid,
      cur_lang: '', certi_type: '', certi_sr: '' });
    const r = await get(`${WWW}/ko/api/download.ashx?${q}`, { referer: WWW_REFERER });
    const data = r.data ?? [];
    rows.push(...data);
    const total = data[0]?.total ?? 0;
    if (data.length === 0 || rows.length >= total) break;
  }
  // 상위 카테고리 공통 문서(d_p_code="")는 제외, 이 제품에 직접 연결된 문서만
  const own = rows
    .filter((d) => d.d_p_code === pid && WWW_TYPE[d.d_dc_id])
    .sort((a, b) => String(b.d_moddate || b.d_regdate).localeCompare(String(a.d_moddate || a.d_regdate)));

  // 유형별 최신 PER_TYPE 문서만 file_list 조회 (최대 9회)
  const picked = [];
  const perType = {};
  for (const d of own) {
    const type = WWW_TYPE[d.d_dc_id];
    if ((perType[type] ?? 0) >= PER_TYPE) continue;
    perType[type] = (perType[type] ?? 0) + 1;
    picked.push(d);
  }
  const docs = [];
  for (const d of picked) {
    const f = await get(`${WWW}/ko/api/download.ashx?t=file_list&d_id=${encodeURIComponent(d.d_id)}`, { referer: WWW_REFERER });
    const files = Object.values(f.data ?? {});
    const title = String(d.d_title ?? '').trim();
    for (const file of files) {
      if (!file.df_path) continue;
      const name = safeDecode(file.df_name);
      const path = String(file.df_path).replace(/[^/]+$/, (fn) => encodeURIComponent(safeDecode(fn)));
      docs.push(docRef({
        type: WWW_TYPE[d.d_dc_id],
        title: files.length > 1 ? `${title} (${name})` : title,
        url: WWW + path,
        lang: WWW_LANG[d.d_file_lang] ?? undefined,
        updatedAt: toDate(d.d_moddate || d.d_regdate),
      }));
    }
  }
  log(`  www: 목록 ${rows.length}건 → 제품 직접 연결(카탈로그·데이터시트·매뉴얼) ${own.length}건 → file_list ${picked.length}회`);
  return { source: 'www', deepLink: `${WWW}/ko/download?c_code=${encodeURIComponent(cCode)}&p_code=${encodeURIComponent(pid)}`, docs: capPerType(docs) };
}
function safeDecode(s) {
  try {
    return decodeURIComponent(String(s));
  } catch {
    return String(s);
  }
}

// ---------- Solution Square ----------
function ssqFileUrl(file) {
  if (file.blobUrlForLargeFile) {
    const u = new URL(file.blobUrlForLargeFile);
    return u.hostname === 'sftpssqblobcdn.blob.core.windows.net' ? SSQ_CDN + u.pathname : file.blobUrlForLargeFile;
  }
  const safe = String(file.fileName).replace(/[{}[\]/?,;:|)*`!^+<>@#$%&\\=('"]/g, '_');
  return `${SSQ}/uploads/${file.fileKey}/${encodeURIComponent(safe)}`;
}
/** 제품명 정규화 (공백·대소문자 무시 비교용) */
const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, '');

async function fromSsq(categoryId, productName) {
  const pageSize = 50;
  const all = [];
  for (let pageNo = 1; pageNo <= 10; pageNo++) {
    const q = new URLSearchParams({ langs: 'ko-KR', ctgryIds: categoryId, docTypes: SSQ_DOC_TYPES, order: 'UPDATE', pageNo, pageSize });
    const r = await get(`${SSQ}/api/guest/zdata/ssqdoc/dlCenter?${q}`);
    const list = r.list ?? [];
    all.push(...list);
    if (list.length < pageSize) break;
  }
  // 공개 문서만 (10=로그인, 15=파트너, 20=임직원 → 제외). 필요한 필드만 추리고 작성자 등 나머지는 버림
  const pub = all
    .filter((d) => d.displayTarget === 0 && SSQ_TYPE[d.docType])
    .map((d) => ({ type: SSQ_TYPE[d.docType], title: String(d.docTitle ?? '').trim(), updateTime: d.updateTime, files: d.files ?? [] }));
  // 카테고리에는 공통 문서(툴·필터 등)도 섞여 있으므로 제목에 제품명이 들어간 문서를 먼저, 그다음 최신순
  const key = norm(productName);
  const hit = (d) => (key && norm(d.title).includes(key) ? 1 : 0);
  pub.sort((a, b) => hit(b) - hit(a) || String(b.updateTime).localeCompare(String(a.updateTime)));

  const docs = [];
  for (const d of pub) {
    // 여러 언어 파일이 있으면 한국어 파일만 (없으면 전부)
    const ko = d.files.filter((f) => String(f.fileLang).toUpperCase() === 'KO');
    const files = ko.length > 0 ? ko : d.files;
    for (const f of files) {
      docs.push(docRef({
        type: d.type,
        title: files.length > 1 ? `${d.title} (${f.fileName})` : d.title,
        url: ssqFileUrl(f),
        lang: f.fileLang ? String(f.fileLang).toLowerCase() : undefined,
        updatedAt: toDate(d.updateTime),
      }));
    }
  }
  log(`  ssq: 카테고리 ${categoryId} 목록 ${all.length}건 중 공개 ${pub.length}건 (제품명 일치 ${pub.filter(hit).length}건)`);
  return { source: 'ssq', deepLink: `${SSQ}/kr/ko/product/category/${categoryId}`, docs: capPerType(docs) };
}

// ---------- 파일 I/O ----------
async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}
async function writeJsonAtomic(file, data) {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2) + '\n');
  await rename(tmp, file);
}

// ---------- main ----------
async function main() {
  const { DocsFileSchema, ProductDocsSchema } = await import('../src/lib/schema.ts');
  const { z } = await import('zod');

  const allProducts = await readJson(PRODUCTS_FILE, null);
  if (!Array.isArray(allProducts)) throw new Error('src/data/products.json 을 읽을 수 없습니다');
  let targets = allProducts;
  if (ONLY) {
    const unknown = ONLY.filter((id) => !allProducts.some((p) => p.id === id));
    if (unknown.length) log(`products.json 에 없는 id 무시: ${unknown.join(', ')}`);
    targets = ONLY.map((id) => allProducts.find((p) => p.id === id)).filter(Boolean);
  }
  if (LIMIT) targets = targets.slice(0, LIMIT);

  const partial = RESUME ? await readJson(PARTIAL_FILE, { products: {} }) : { products: {} };
  if (!RESUME) await rm(PARTIAL_FILE, { force: true });
  const failed = {};
  const stats = [];
  const started = Date.now();

  for (const [i, p] of targets.entries()) {
    if (partial.products[p.id]) {
      log(`(${i + 1}/${targets.length}) ${p.id} 이미 받음 — 건너뜀 (--resume)`);
      continue;
    }
    const before = requestCount;
    try {
      const entity = await getProductEntity(p.id);
      const cCode = entity.c_code || p.categoryCode;
      const ssqCat = ssqCategoryOf(entity);
      log(`(${i + 1}/${targets.length}) ${p.id} ${String(entity.p_name ?? p.name).trim()} c_code=${cCode} ssq=${ssqCat ?? '-'}`);
      const result = ssqCat ? await fromSsq(ssqCat, String(entity.p_name ?? p.name).trim()) : await fromWww(p.id, cCode);
      const check = ProductDocsSchema.safeParse(result);
      if (!check.success) throw new Error(`스키마 불일치:\n${z.prettifyError(check.error)}`);
      partial.products[p.id] = check.data;
      await writeJsonAtomic(PARTIAL_FILE, partial);
      const byType = {};
      for (const d of check.data.docs) byType[d.type] = (byType[d.type] ?? 0) + 1;
      stats.push({ id: p.id, source: result.source, docs: check.data.docs.length, byType, requests: requestCount - before });
    } catch (e) {
      failed[p.id] = e.message;
      log(`  실패 — ${e.message}`);
      stats.push({ id: p.id, error: e.message, requests: requestCount - before });
    }
  }

  // 기존 docs.json 과 병합 → 검증 → 원자적 저장
  const existing = await readJson(OUT_FILE, { generatedAt: '', products: {} });
  const merged = {
    generatedAt: new Date().toISOString(),
    products: Object.fromEntries(
      Object.entries({ ...(existing.products ?? {}), ...partial.products }).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
  const r = DocsFileSchema.safeParse(merged);
  if (!r.success) throw new Error(`docs.json 스키마 검증 실패 — 파일을 쓰지 않았습니다:\n${z.prettifyError(r.error)}`);
  await writeJsonAtomic(OUT_FILE, r.data);
  if (Object.keys(failed).length === 0) await rm(PARTIAL_FILE, { force: true });

  log('──── 결과 ────');
  for (const s of stats) {
    log(s.error ? `${s.id}: 실패 (${s.requests}요청) ${s.error}` : `${s.id} [${s.source}] ${s.docs}건 ${JSON.stringify(s.byType)} — ${s.requests}요청`);
  }
  log(`총 요청 ${requestCount}회, ${Math.round((Date.now() - started) / 1000)}초. docs.json 제품 ${Object.keys(r.data.products).length}개` +
    (Object.keys(failed).length ? ` · 실패 ${Object.keys(failed).length}개 (재실행: --resume)` : ''));
  if (Object.keys(failed).length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
