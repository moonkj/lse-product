#!/usr/bin/env node
/**
 * 자료실 API 프로토타입: 제품 ID(P…) → 데이터시트·매뉴얼·카탈로그 링크 목록
 * 의존성 없음 (Node 18+ 내장 fetch).  자세한 API 설명은 docs/research/download-api.md
 *
 * 실행:  node scripts/probe-downloads.mjs [P01062 P01072 P01188 ...] [--max-files=15]
 * 출력:  stdout 에 JSON 배열  [{ productId, source, docs: [{ type, title, url, lang, updatedAt }] }]
 *        진행 로그는 stderr
 *
 * 흐름
 *  1) www 제품 페이지(/ko/product/view/P…)의 hidden input #hd_entity 에서 c_code, p_ssq_yn, p_ssq_link 를 읽는다.
 *  2) p_ssq_link 에 /product/category/{id} 가 있으면(자동화 제품) → Solution Square API
 *       GET https://ssq.ls-electric.com/api/guest/zdata/ssqdoc/dlCenter?langs=ko-KR&ctgryIds={id}&docTypes=…&pageNo&pageSize
 *     없으면(전력 제품) → www 자료실 API
 *       GET https://www.ls-electric.com/ko/api/download.ashx?t=list&c_code&p_code&page&rowsPerPage   (Referer 헤더 필수)
 *       GET https://www.ls-electric.com/ko/api/download.ashx?t=file_list&d_id=…                     (문서별 첨부파일)
 *  3) 요청 사이 1.1초 대기. 로그인 필요 문서(ssq displayTarget>0)는 제외.
 */

const WWW = 'https://www.ls-electric.com';
const SSQ = 'https://ssq.ls-electric.com';
const SSQ_CDN = 'https://ssqfd-abhdhraad3gkgbcg.a03.azurefd.net'; // 앱이 대용량 파일 blob URL 을 이 origin 으로 바꿔 씀
const USER_AGENT = 'LSE-ProductMap/0.1';
const DELAY_MS = 1100;

const args = process.argv.slice(2);
const maxFilesArg = args.find((a) => a.startsWith('--max-files='));
const MAX_FILE_LOOKUPS = maxFilesArg ? Number(maxFilesArg.split('=')[1]) : 15; // 제품당 www file_list 호출 상한
const productIds = args.filter((a) => !a.startsWith('--'));
if (productIds.length === 0) productIds.push('P01062', 'P01072', 'P01188'); // Susol VCB, XGIPAM, iS7

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...m) => console.error('[probe]', ...m);

let lastRequestAt = 0;
async function get(url, { referer, json = true } = {}) {
  const wait = lastRequestAt + DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
  const headers = { 'User-Agent': USER_AGENT };
  if (referer) headers.Referer = referer;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const text = await res.text();
  if (!json) return text;
  if (!text) throw new Error(`빈 응답 (Referer 누락?) ${url}`);
  return JSON.parse(text);
}

// ---------- 공통 매핑 ----------
// www 문서유형 dc_id (다운로드 페이지 #hd_category)
const WWW_TYPE = { 1: 'catalog', 2: 'manual', 3: 'other' /* 기술자료 */, 4: 'certificate', 5: 'other' /* 납품실적 */,
  6: 'software', 7: 'cad', 9: 'datasheet', 11: 'other' /* 적용사례 */, 12: 'other' /* 교육자료 */ };
// www 우선순위: file_list 호출 예산을 교육용으로 중요한 유형부터 사용
const WWW_PRIORITY = { catalog: 0, datasheet: 1, manual: 2, other: 3, software: 4, cad: 5, certificate: 6 };
const WWW_LANG = { 한국어: 'ko', 영어: 'en', 중국어: 'zh', 일본어: 'ja', 독일어: 'de', 스페인어: 'es', 프랑스어: 'fr',
  러시아어: 'ru', 아랍어: 'ar', 이란어: 'fa', 이탈리아어: 'it', 폴란드어: 'pl', 터키어: 'tr', 베트남어: 'vi' };
// ssq docType
const SSQ_TYPE = { CATALOG: 'catalog', DATASHEET: 'datasheet', MANUAL: 'manual', CERTIFICATION: 'certificate',
  SOFTWARE: 'software', OS: 'software', CAD_DATA: 'cad', MARKETING_MATERIAL: 'other' };
const SSQ_DOC_TYPES = Object.keys(SSQ_TYPE).join(',');

const toDate = (s) => (s ? String(s).slice(0, 10).replaceAll('/', '-') : null);

// ---------- 1) 제품 페이지 ----------
function decodeEntities(s) {
  return s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
async function getProductEntity(pid) {
  const html = await get(`${WWW}/ko/product/view/${pid}`, { json: false });
  const m = html.match(/id="hd_entity" value="([^"]*)"/);
  if (!m) throw new Error(`${pid}: #hd_entity 없음`);
  return JSON.parse(decodeEntities(m[1]));
}

// ---------- 2a) www 자료실 ----------
async function fromWww(pid, entity) {
  const cCode = entity.c_code;
  const referer = `${WWW}/ko/download/`;
  const rows = [];
  for (let page = 1; page <= 20; page++) {
    const q = new URLSearchParams({ t: 'list', page, rowsPerPage: 50, k_word: '', dc_id: '', c_code: cCode, p_code: pid, cur_lang: '', certi_type: '', certi_sr: '' });
    const r = await get(`${WWW}/ko/api/download.ashx?${q}`, { referer });
    rows.push(...r.data);
    const total = r.data[0]?.total ?? 0;
    if (rows.length >= total || r.data.length === 0) break;
  }
  // 목록에는 상위 카테고리 공통 문서(d_p_code="")도 섞여 나오므로 이 제품 코드에 직접 연결된 문서만 사용
  const own = rows.filter((d) => d.d_p_code === pid);
  log(`${pid}: www list ${rows.length}건 중 제품 직접 연결 ${own.length}건`);
  own.sort((a, b) => WWW_PRIORITY[WWW_TYPE[a.d_dc_id] ?? 'other'] - WWW_PRIORITY[WWW_TYPE[b.d_dc_id] ?? 'other']);

  const deepLink = `${WWW}/ko/download?c_code=${cCode}&p_code=${pid}`;
  const docs = [];
  let lookups = 0;
  for (const d of own) {
    const base = {
      type: WWW_TYPE[d.d_dc_id] ?? 'other',
      lang: WWW_LANG[d.d_file_lang] ?? d.d_file_lang ?? null,
      updatedAt: toDate(d.d_moddate || d.d_regdate),
    };
    const title = d.d_title.trim();
    if (lookups < MAX_FILE_LOOKUPS) {
      lookups++;
      const f = await get(`${WWW}/ko/api/download.ashx?t=file_list&d_id=${d.d_id}`, { referer });
      const files = Object.values(f.data ?? {});
      if (files.length === 0) docs.push({ ...base, title, url: deepLink });
      for (const file of files) {
        const name = decodeURIComponent(file.df_name);
        const path = file.df_path.replace(/[^/]+$/, (fn) => encodeURIComponent(decodeURIComponent(fn)));
        docs.push({ ...base, title: files.length > 1 ? `${title} (${name})` : title, url: WWW + path });
      }
    } else {
      docs.push({ ...base, title, url: deepLink }); // 예산 초과분은 자료실 검색 결과로 딥링크
    }
  }
  return { productId: pid, source: 'www', docs };
}

// ---------- 2b) Solution Square ----------
function ssqFileUrl(file) {
  if (file.blobUrlForLargeFile) {
    // 앱 동작과 동일: sftpssqblobcdn.blob.core.windows.net/prod/... → azurefd CDN origin
    const u = new URL(file.blobUrlForLargeFile);
    return u.hostname === 'sftpssqblobcdn.blob.core.windows.net' ? SSQ_CDN + u.pathname : file.blobUrlForLargeFile;
  }
  const safe = file.fileName.replace(/[{}[\]/?,;:|)*`!^+<>@#$%&\\=('"]/g, '_');
  return `${SSQ}/uploads/${file.fileKey}/${encodeURIComponent(safe)}`;
}
async function fromSsq(pid, categoryId) {
  const list = [];
  const pageSize = 50;
  for (let pageNo = 1; pageNo <= 20; pageNo++) {
    const q = new URLSearchParams({ langs: 'ko-KR', ctgryIds: categoryId, docTypes: SSQ_DOC_TYPES, order: 'UPDATE', pageNo, pageSize });
    const r = await get(`${SSQ}/api/guest/zdata/ssqdoc/dlCenter?${q}`);
    list.push(...r.list);
    if (r.list.length < pageSize) break;
  }
  const pub = list.filter((d) => (d.displayTarget ?? 0) === 0); // 10=로그인, 15=파트너, 20=임직원 전용 → 제외
  log(`${pid}: ssq category ${categoryId} 문서 ${list.length}건 중 공개 ${pub.length}건`);
  const docs = [];
  for (const d of pub) {
    const base = { type: SSQ_TYPE[d.docType] ?? 'other', updatedAt: toDate(d.updateTime) };
    const files = d.files ?? [];
    if (files.length === 0) {
      docs.push({ ...base, title: d.docTitle.trim(), url: `${SSQ}/kr/ko/product/document/${d.id}`, lang: null });
    }
    for (const f of files) {
      docs.push({ ...base, title: files.length > 1 ? `${d.docTitle.trim()} (${f.fileName})` : d.docTitle.trim(),
        url: ssqFileUrl(f), lang: f.fileLang ? f.fileLang.toLowerCase() : null });
    }
  }
  return { productId: pid, source: 'ssq', ssqCategoryId: Number(categoryId), docs };
}

// ---------- main ----------
const out = [];
for (const pid of productIds) {
  try {
    const entity = await getProductEntity(pid);
    const ssqCat = entity.p_ssq_yn && /\/product\/category\/(\d+)/.exec(entity.p_ssq_link || '')?.[1];
    log(`${pid} ${entity.p_name?.trim()} c_code=${entity.c_code} ssq=${ssqCat || '-'}`);
    out.push(ssqCat ? await fromSsq(pid, ssqCat) : await fromWww(pid, entity));
  } catch (e) {
    log(`${pid}: 실패 - ${e.message}`);
    out.push({ productId: pid, error: e.message, docs: [] });
  }
}
console.log(JSON.stringify(out, null, 2));
for (const p of out) {
  const byType = {};
  for (const d of p.docs) byType[d.type] = (byType[d.type] ?? 0) + 1;
  log(`요약 ${p.productId} (${p.source ?? 'error'}): ${p.docs.length}건`, JSON.stringify(byType));
}
