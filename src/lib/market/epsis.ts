/**
 * 전력거래소 EPSIS 연도별 통계 → market-annual.json 실적 갱신 (scripts/fetch-annual.mjs 와 앱 테스트 공용).
 * Node type stripping 으로 직접 import 하므로 다른 모듈을 import 하지 않는 순수 함수만 둔다.
 *
 * 받는 곳 (2026-11-23 확인, 로그인·키 불필요):
 * - 전력지표(연도별)  POST /epsisnew/selectEkesKepGridAjax.ajax  beginDate·endDate → JSON defaultList
 *     c1 발전설비 총계(MW) · c6 총발전량(GWh) · c17 판매전력량(GWh)
 * - SMP 연평균        POST /epsisnew/selectEkmaSmpSmp.ajax  beginDate·endDate·selYear=year → 스크립트 조각 (c1 = 통합)
 * - 발전량 전원별      GET  /epsisnew/selectEkgeGepTotChart.do?menuId=060101 → 페이지 안 스크립트 (전 연도, MWh)
 *     c5 무연탄 · c6 유연탄 · c8 가스(기력) · c24 LNG(복합, 2018~) · c12 복합 계(2017 이전) · c14 원자력 · c16 신재생 · c22 사업자+상용자가(분모)
 * EPSIS 는 다 끝난 해만 연도별 값으로 준다(진행 중인 해 제외). 그래도 올해 이후 값은 버린다.
 */

export const EPSIS_BASE = 'https://epsis.kpx.or.kr/epsisnew';
export const EPSIS_KEP_AJAX = `${EPSIS_BASE}/selectEkesKepGridAjax.ajax`;
export const EPSIS_SMP_AJAX = `${EPSIS_BASE}/selectEkmaSmpSmp.ajax`;
export const EPSIS_MIX_PAGE = `${EPSIS_BASE}/selectEkgeGepTotChart.do?menuId=060101`;

export type YearValues = Map<number, number>;
export type YearCols = Map<number, Record<string, number>>;

const num = (v: unknown): number | null => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** 전력지표 JSON → 연도별 {c1, c6, c17 …} */
export function parseKep(json: unknown): YearCols {
  const out: YearCols = new Map();
  const list = (json as { defaultList?: Record<string, unknown>[] })?.defaultList;
  if (!Array.isArray(list)) return out;
  for (const row of list) {
    const y = num(row.dtYear);
    if (y == null) continue;
    const cols: Record<string, number> = {};
    for (const [k, v] of Object.entries(row)) {
      const n = /^c\d+$/.test(k) ? num(v) : null;
      if (n != null) cols[k] = n;
    }
    out.set(y, cols);
  }
  return out;
}

/**
 * EPSIS 의 "cN = textFormmat("값",count); … gridData.push({"year":"YYYY" …" 스크립트 조각 → 연도별 열 값.
 * 같은 연도가 두 번 나오면(페이지에 표가 둘) 처음 것만 쓴다. 빈 값은 0 으로 본다.
 */
export function parseGridScript(text: string): YearCols {
  const out: YearCols = new Map();
  let cur: Record<string, number> = {};
  const re = /(c\d+)\s*=\s*textFormmat\("([-\d.]*)"|"year"\s*:\s*"(\d{4})"/g;
  for (const m of text.matchAll(re)) {
    if (m[1]) cur[m[1]] = num(m[2]) ?? 0;
    else {
      const y = Number(m[3]);
      if (!out.has(y) && Object.keys(cur).length > 0) out.set(y, cur);
      cur = {};
    }
  }
  return out;
}

export type MixShares = { nuclear: number; coal: number; lng: number; renewable: number; other: number };
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** 전원별 발전량 열 → 비중(%). 기타 = 100 − 나머지 반올림 합 (기존 수작업 방식과 같음) */
export function mixShares(c: Record<string, number>): MixShares | null {
  const total = c.c22;
  if (!total || total <= 0) return null;
  const pct = (v: number) => r1((v / total) * 100);
  const nuclear = pct(c.c14 ?? 0);
  const coal = pct((c.c5 ?? 0) + (c.c6 ?? 0));
  // 복합: 2018년부터는 연료별(c24 LNG·c25 유류)로 나뉘고, 그 전은 일반·열공급(c10·c11)으로만 나뉜다 → LNG 열이 비면 복합 계(c12)
  const combinedLng = c.c24 ? c.c24 : (c.c12 ?? (c.c10 ?? 0) + (c.c11 ?? 0));
  const lng = pct((c.c8 ?? 0) + combinedLng);
  const renewable = pct(c.c16 ?? 0);
  const other = r1(100 - nuclear - coal - lng - renewable);
  if (other < 0) return null;
  return { nuclear, coal, lng, renewable, other };
}

export interface EpsisSnapshot {
  /** 지표 id → 연도별 값 (화면 단위) */
  values: Record<'consumption' | 'generation' | 'capacity' | 'smp', YearValues>;
  mix: Map<number, MixShares>;
}

/** 원자료 세 개 → 화면 단위 값 (TWh·GW 는 ÷1000 소수 첫째 자리, SMP 는 원문 소수 둘째 자리) */
export function buildSnapshot(kep: YearCols, smp: YearCols, mix: YearCols, thisYear: number): EpsisSnapshot {
  const pick = (src: YearCols, col: string, conv: (v: number) => number): YearValues => {
    const m: YearValues = new Map();
    for (const [y, c] of src) if (y < thisYear && c[col] != null && c[col] > 0) m.set(y, conv(c[col]));
    return m;
  };
  const k1000 = (v: number) => r1(v / 1000);
  const mixOut = new Map<number, MixShares>();
  for (const [y, c] of mix) {
    if (y >= thisYear) continue;
    const s = mixShares(c);
    if (s) mixOut.set(y, s);
  }
  return {
    values: {
      consumption: pick(kep, 'c17', k1000),
      generation: pick(kep, 'c6', k1000),
      capacity: pick(kep, 'c1', k1000),
      smp: pick(smp, 'c1', r2),
    },
    mix: mixOut,
  };
}

type Point = { year: number; value?: number; shares?: MixShares; method: string; source: { asof: string } } & Record<string, unknown>;
type Annual = { asof: string; indicators: ({ id: string; actual: Point[] } & Record<string, unknown>)[]; mix: { actual: Point[] } & Record<string, unknown> };

/** 직전 해 대비 이 범위를 벗어나면 잘못 읽은 것으로 보고 그 지표는 갱신하지 않는다 */
const MAX_JUMP = { consumption: 0.25, generation: 0.25, capacity: 0.25, smp: 1.5 } as const;

const stamp = (method: string, today: string) => method.replace(/\(\d{4}-\d{2}-\d{2} 조회\)/, `(${today} 조회)`);

/**
 * 기존 market-annual.json 에 새 실적을 합친다. 실적 창 길이(현재 10년)는 그대로 — 새 해가 생기면 가장 오래된 해를 뺀다.
 * 새 점은 마지막 점의 단위·방법·출처를 이어받는다. 값이 바뀐 점과 조회일만 고친다.
 * 반환: 갱신된 데이터(사본)와 변경 내용 요약. 의심스러운 지표는 건너뛰고 skipped 에 이유를 남긴다.
 */
export function mergeAnnual<T extends Annual>(data: T, snap: EpsisSnapshot, today: string): { data: T; changes: string[]; skipped: string[] } {
  const next = structuredClone(data) as T;
  const changes: string[] = [];
  const skipped: string[] = [];

  const mergeSeries = (label: string, list: Point[], fresh: Map<number, number | MixShares>, check: (prev: Point, v: number | MixShares) => boolean, apply: (p: Point, v: number | MixShares) => boolean) => {
    if (fresh.size === 0) {
      skipped.push(`${label}: 받은 값 없음`);
      return list;
    }
    const keep = list.length;
    const byYear = new Map(list.map((p) => [p.year, p]));
    const years = [...new Set([...list.map((p) => p.year), ...fresh.keys()])].sort((a, b) => a - b);
    const out: Point[] = [];
    let prev: Point | undefined;
    for (const y of years) {
      let p = byYear.get(y);
      const v = fresh.get(y);
      if (!p) {
        if (v == null || !prev) continue; // 기존 창보다 앞선 해는 넣지 않음
        p = structuredClone(prev);
        p.year = y;
        delete p.value;
        delete p.shares;
        changes.push(`${label} ${y} 추가`);
      }
      if (v != null) {
        if (prev && !check(prev, v)) {
          skipped.push(`${label} ${y}: 직전 해 대비 변화가 너무 큼 — 이 지표는 갱신 안 함`);
          return list;
        }
        if (apply(p, v)) changes.push(`${label} ${y} 값 변경`);
        p.method = stamp(p.method, today);
        p.source = { ...p.source, asof: today };
      }
      out.push(p);
      prev = p;
    }
    return out.slice(-keep);
  };

  for (const ind of next.indicators) {
    const id = ind.id as keyof EpsisSnapshot['values'];
    const fresh = snap.values[id];
    if (!fresh) continue;
    const jump = MAX_JUMP[id];
    ind.actual = mergeSeries(
      id,
      ind.actual,
      fresh,
      (prev, v) => typeof prev.value !== 'number' || Math.abs((v as number) - prev.value) / prev.value <= jump,
      (p, v) => {
        const changed = p.value !== v;
        p.value = v as number;
        return changed;
      },
    );
  }
  next.mix.actual = mergeSeries(
    'mix',
    next.mix.actual,
    snap.mix,
    () => true,
    (p, v) => {
      const changed = JSON.stringify(p.shares) !== JSON.stringify(v);
      p.shares = v as MixShares;
      return changed;
    },
  );
  next.asof = today;
  return { data: next, changes, skipped };
}
