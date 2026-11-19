/**
 * 실시간 전력수급 (DEBATE.md 신규 안건 2) — 수집 스크립트(scripts/fetch-supply.mjs)와 앱(SupplyPill)이 같이 쓰는 순수 함수.
 *
 * - 데이터: 공공데이터포털 한국전력거래소_오늘전력수급현황조회_GW [15158703]
 *   `B552115/Sukub5mToday/getSukub5mToday` (serviceKey, pageNo, numOfRows, dataType=JSON) — 오늘 5분 단위 행.
 * - 응답 필드 이름은 공공데이터포털 상세 화면에 없어 후보 이름을 차례로 찾는다
 *   (같은 회사 마켓뉴스 app/market/kpx_power.py 후보 목록 재사용). 첫 실제 실행 로그로 후보를 고칠 것.
 * - 단위: 서비스 이름은 "_GW" 지만 마켓뉴스는 MW로 저장 중 → 수요·공급능력이 1000 이상이면 응답 전체를 MW로 보고 GW로 바꾼다.
 *
 * Node 22.18+ type stripping 으로 .mjs 에서 직접 import 하므로 import 없이, 지울 수 있는 TS 문법만 쓴다.
 */

// ---------- 응답 필드 후보 (확인 전, 앞에 있을수록 우선) ----------
export const RATE_FIELDS = ['suppReserveRate', 'supplyReserveRate', 'suppReservRate', 'spplyRsrvRate', 'reserveRate'];
export const DEMAND_FIELDS = ['currPwrTot', 'currentDemand', 'curDemand', 'currPwr', 'demand', 'nowDemand'];
export const TIME_FIELDS = ['baseDatetime', 'baseDateTime', 'basDt', 'baseDt', 'datetime', 'tm'];
export const RESERVE_FIELDS = ['suppReservePwr', 'supplyReservePwr', 'suppReservPwr', 'spplyRsrvPwr', 'reservePwr'];
export const SUPPLY_FIELDS = ['suppAbility', 'supplyAbility', 'suppAblty', 'spplyAblty', 'supplyCapacity'];

/** 화면·JSON 출처 문구 (항상 표시) */
export const SUPPLY_SOURCE = '전력거래소 공개 데이터';
/** 갱신 주기(분) — 전력거래소 5분 공개 · /api/supply 캐시(functions/api/supply.ts CACHE_SECONDS) · 앱 다시 읽기 간격 */
export const COLLECT_EVERY_MIN = 5;
/** 이보다 오래 갱신이 없으면 "지연" (공개 지연 여유 포함 4주기). API 가 실패해 배포 때 파일로 대체되면 대개 지연으로 보인다 */
export const STALE_AFTER_MIN = 20;

/**
 * 경보 단계 — 공급예비력(GW)이 값 "미만"이면 그 단계. 위에서부터 검사.
 * TODO 전력거래소 공식 기준 확인 필요: 아래 값은 디자인 토론 페르소나 기억값(준비 5.5 / 관심 4.5 / 주의 3.5 / 경계 2.5 / 심각 1.5 GW).
 */
export const RESERVE_LEVELS = [
  { level: 'serious', label: '심각', belowGw: 1.5 },
  { level: 'alert', label: '경계', belowGw: 2.5 },
  { level: 'caution', label: '주의', belowGw: 3.5 },
  { level: 'concern', label: '관심', belowGw: 4.5 },
  { level: 'ready', label: '준비', belowGw: 5.5 },
] as const;

export type SupplyLevel = 'normal' | (typeof RESERVE_LEVELS)[number]['level'];

export interface SupplyRow {
  /** 기준 시각 ISO (KST, 예: 2026-11-19T14:20:00+09:00) */
  t: string;
  /** 현재 수요 GW */
  demand: number | null;
  /** 공급능력 GW */
  supply: number | null;
  /** 공급예비력 GW */
  reserve: number | null;
  /** 공급예비율 % */
  rate: number | null;
}

export interface SupplyData {
  /** 최신 행의 기준 시각 */
  asof: string;
  rows: SupplyRow[];
  latest: SupplyRow;
  source: string;
  /** 수집 스크립트가 파일을 쓴 시각 */
  generatedAt?: string;
  /** 이번 수집이 실패해 지난 값을 다시 쓴 경우 실패 시각 */
  failedAt?: string;
}

// ---------- 공공데이터포털 응답 ----------
const OK_CODES = ['00', '0', '000', '0000', 'INFO-000', ''];
const NODATA_CODES = ['03', 'INFO-200'];
/** 다시 해도 안 되는 오류 (키 미등록·권한·하루 한도 초과 = HTTP 429 LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS, 자정에 풀림) */
export const NO_RETRY_MARKS = [
  'HTTP 401', 'HTTP 403', 'HTTP 429', 'LIMITED_NUMBER_OF_SERVICE_REQUESTS', 'SERVICE_KEY',
  'UNREGISTERED', 'DEADLINE_HAS_EXPIRED', 'NO_OPENAPI_SERVICE',
];

export function isNoRetryError(message: string): boolean {
  return NO_RETRY_MARKS.some((m) => message.includes(m));
}

/** 게이트웨이 오류(OpenAPI_ServiceResponse, JSON 을 요청해도 XML 로 올 때가 있음)의 errMsg. 없으면 "" */
export function serviceError(text: string): string {
  if (!text || !text.includes('OpenAPI_ServiceResponse')) return '';
  const m = /<errMsg>\s*([^<]+?)\s*<\/errMsg>/.exec(text) ?? /"errMsg"\s*:\s*"([^"]+)"/.exec(text);
  return m ? m[1].slice(0, 80) : 'OpenAPI_ServiceResponse';
}

type Item = Record<string, unknown>;

/** data.go.kr JSON 응답 → 행 목록. 결과코드가 오류면 Error (키는 메시지에 넣지 않음) */
export function parseDataGoKrItems(text: string): Item[] {
  const err = serviceError(text);
  if (err) throw new Error(`응답 오류: ${err}`);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('응답이 JSON이 아님');
  }
  const root = (data && typeof data === 'object' ? data : {}) as Item;
  const resp = ((root.response as Item | undefined) ?? root) as Item;
  const header = (resp.header ?? {}) as Item;
  const code = String(header.resultCode ?? '').trim();
  if (NODATA_CODES.includes(code)) return [];
  if (!OK_CODES.includes(code)) throw new Error(`응답 오류: ${code} ${String(header.resultMsg ?? '').slice(0, 80)}`.trimEnd());
  const body = (resp.body ?? {}) as Item;
  let items: unknown = body && typeof body === 'object' ? body.items : undefined;
  if (items && typeof items === 'object' && !Array.isArray(items)) items = (items as Item).item;
  if (items && typeof items === 'object' && !Array.isArray(items)) items = [items];
  if (!Array.isArray(items)) return [];
  return items.filter((i): i is Item => !!i && typeof i === 'object');
}

/** 후보 이름 중 처음으로 값이 있는 것 (대소문자 무시) */
export function pick(row: Item, names: readonly string[]): unknown {
  const lower = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
  for (const n of names) {
    const v = row[n] ?? lower.get(n.toLowerCase());
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
}

function num(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

/** "20261119142000" · "2026-11-19 14:20" → "2026-11-19T14:20:00+09:00" (KST). 이상하면 null */
export function kstIso(v: unknown): string | null {
  const s = String(v ?? '').replace(/\D/g, '');
  if (s.length < 12) return null;
  const [y, mo, d, h, mi] = [s.slice(0, 4), s.slice(4, 6), s.slice(6, 8), s.slice(8, 10), s.slice(10, 12)];
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31 || +h > 24 || +mi > 59) return null;
  return `${y}-${mo}-${d}T${h}:${mi}:00+09:00`;
}

/**
 * 응답 단위 판정: 수요·공급능력이 1000 이상이면 MW (전국 수요는 늘 수십 GW = 수만 MW).
 * 응답 전체에 한 번만 정한다 — 예비력이 1000MW 미만으로 떨어진 행을 GW로 잘못 읽지 않게.
 */
function mwScale(items: Item[]): number {
  const big = items.some((it) => {
    const v = num(pick(it, DEMAND_FIELDS)) ?? num(pick(it, SUPPLY_FIELDS));
    return v !== null && Math.abs(v) >= 1000;
  });
  return big ? 1000 : 1;
}

function toGw(v: number | null, scale: number): number | null {
  return v === null ? null : Math.round((v / scale) * 100) / 100;
}

/** 실제 응답 키 목록 (후보가 하나도 안 맞을 때 로그용, 값은 남기지 않음) */
export function responseKeys(items: Item[]): string {
  return [...new Set(items.slice(0, 5).flatMap((r) => Object.keys(r)))].sort().join(', ') || '(없음)';
}

/**
 * 응답 행 → 시각순 SupplyRow[]. 시각이 없거나 예비율·예비력을 하나도 못 구하는 행은 뺀다.
 * 공급예비력이 없으면 공급능력 − 현재수요, 예비율이 없으면 공급예비력 ÷ 현재수요 × 100 (KPX 정의).
 */
export function normalizeRows(items: Item[]): SupplyRow[] {
  const byT = new Map<string, SupplyRow>();
  const scale = mwScale(items);
  const gw = (v: number | null) => toGw(v, scale);
  for (const it of items) {
    const t = kstIso(pick(it, TIME_FIELDS));
    if (!t) continue;
    const demand = gw(num(pick(it, DEMAND_FIELDS)));
    const supply = gw(num(pick(it, SUPPLY_FIELDS)));
    let reserve = gw(num(pick(it, RESERVE_FIELDS)));
    if (reserve === null && supply !== null && demand !== null) reserve = Math.round((supply - demand) * 100) / 100;
    let rate = num(pick(it, RATE_FIELDS));
    if (rate === null && reserve !== null && demand) rate = (reserve / demand) * 100;
    if (rate !== null) rate = Math.round(rate * 10) / 10;
    if (rate === null && reserve === null) continue;
    byT.set(t, { t, demand, supply, reserve, rate });
  }
  return [...byT.values()].sort((a, b) => a.t.localeCompare(b.t));
}

/** 응답 행 → supply.json 내용. 쓸 행이 없으면 null */
export function buildSupplyData(items: Item[], now: Date = new Date()): SupplyData | null {
  const rows = normalizeRows(items);
  const latest = rows[rows.length - 1];
  if (!latest) return null;
  return { asof: latest.t, rows, latest, source: SUPPLY_SOURCE, generatedAt: now.toISOString() };
}

// ---------- 앱 표시용 ----------

export function isSupplyData(v: unknown): v is SupplyData {
  if (!v || typeof v !== 'object') return false;
  const d = v as Partial<SupplyData>;
  return typeof d.asof === 'string' && Array.isArray(d.rows) && !!d.latest && typeof d.latest === 'object'
    && typeof d.latest.t === 'string' && !Number.isNaN(Date.parse(d.asof));
}

/** 공급예비력(GW) → 경보 단계. 모르면 정상으로 단정하지 않고 null */
export function reserveLevel(reserveGw: number | null | undefined): { level: SupplyLevel; label: string } | null {
  if (reserveGw === null || reserveGw === undefined || !Number.isFinite(reserveGw)) return null;
  for (const l of RESERVE_LEVELS) if (reserveGw < l.belowGw) return { level: l.level, label: l.label };
  return { level: 'normal', label: '정상' };
}

/** 기준 시각에서 STALE_AFTER_MIN 넘게 지났는지 */
export function isStale(asof: string, now: Date = new Date()): boolean {
  const t = Date.parse(asof);
  return Number.isNaN(t) || now.getTime() - t > STALE_AFTER_MIN * 60_000;
}

/** ISO → KST "HH:MM" (사용자 기기 시간대와 무관하게 전력거래소 기준 시각) */
export function hmKst(iso: string | undefined): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return '--:--';
  const k = new Date(t + 9 * 3600_000);
  return `${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`;
}

/** 다음 갱신 예상 시각 (파일 생성 시각 + 수집 주기) */
export function nextUpdateHm(d: SupplyData): string {
  const base = Date.parse(d.generatedAt ?? d.asof);
  return Number.isNaN(base) ? '--:--' : hmKst(new Date(base + COLLECT_EVERY_MIN * 60_000).toISOString());
}

export function fmt(v: number | null | undefined, digits = 1): string {
  return v === null || v === undefined || !Number.isFinite(v) ? '–' : v.toFixed(digits);
}

/** 스파크라인 점 (오늘 수요 실선 + 공급능력 점선). 같은 세로 눈금 */
export function sparkPaths(rows: SupplyRow[], w = 120, h = 28, pad = 2): { demand: string; supply: string } {
  const vals = rows.flatMap((r) => [r.demand, r.supply]).filter((v): v is number => v !== null);
  if (rows.length < 2 || !vals.length) return { demand: '', supply: '' };
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const x = (i: number) => pad + (i / (rows.length - 1)) * (w - pad * 2);
  const y = (v: number) => pad + (1 - (v - lo) / span) * (h - pad * 2);
  const path = (key: 'demand' | 'supply') => {
    let d = '';
    let pen = false;
    rows.forEach((r, i) => {
      const v = r[key];
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  return { demand: path('demand'), supply: path('supply') };
}
