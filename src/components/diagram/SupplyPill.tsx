import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  COLLECT_EVERY_MIN,
  SUPPLY_SOURCE,
  fmt,
  hmKst,
  isStale,
  isSupplyData,
  nextUpdateHm,
  reserveLevel,
  sparkPaths,
  type SupplyData,
} from '../../lib/supply';
import { announce } from '../../lib/announce';
import './supply.css';

/** 다시 읽는 간격 — API 캐시와 같게 (30분, 2026-11-27) */
export const SUPPLY_POLL_MS = COLLECT_EVERY_MIN * 60_000;
/**
 * 1순위: Cloudflare Pages Function (전력거래소 값을 5분 캐시로 직접 제공). GitHub Pages 주소에서도 같은 API 를 읽는다.
 * 2순위: 배포 때 만든 data/supply.json (API 가 실패하면 대체 — 오래된 값이면 알약이 '지연'으로 표시)
 */
export const SUPPLY_API_URL = 'https://lse-grid-map.pages.dev/api/supply';
export const SUPPLY_FILE_URL = `${import.meta.env.BASE_URL}data/supply.json`;
export const SUPPLY_URLS: readonly string[] = [SUPPLY_API_URL, SUPPLY_FILE_URL];
/** @deprecated 호환용 — 대체 파일 주소 */
export const SUPPLY_URL = SUPPLY_FILE_URL;

interface SupplyState {
  data: SupplyData | null;
  /** 앱이 마지막으로 다시 읽기에 실패했는지 (값은 직전 것 유지) */
  readFailed: boolean;
  /** 마지막으로 읽은 시각 (지연 판정 다시 계산용) */
  checkedAt: number;
}

async function readSupply(url: string): Promise<SupplyData> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json: unknown = await res.json();
  if (!isSupplyData(json)) throw new Error('형식 오류');
  return json;
}

/**
 * 수급 값을 읽고 5분마다 다시 읽는다. 주소 목록을 앞에서부터 시도해 처음 성공한 값을 쓴다(API → 대체 파일).
 * 탭이 숨겨지면 멈추고, 다시 보이면 기한이 지났을 때 바로 읽는다.
 * 처음부터 모두 없거나(404)·형식이 틀리면 data=null → 알약 숨김. 한 번 받은 뒤 모두 실패하면 마지막 값 + readFailed.
 */
export function useSupply(urls: string | readonly string[] = SUPPLY_URLS, pollMs: number = SUPPLY_POLL_MS) {
  const [state, setState] = useState<SupplyState>({ data: null, readFailed: false, checkedAt: 0 });
  const lastRead = useRef(0);
  const key = typeof urls === 'string' ? urls : urls.join(' ');

  const load = useCallback(async () => {
    lastRead.current = Date.now();
    for (const url of key.split(' ')) {
      try {
        const data = await readSupply(url);
        setState({ data, readFailed: false, checkedAt: Date.now() });
        return;
      } catch {
        // 다음 주소로
      }
    }
    setState((s) => ({ data: s.data, readFailed: s.data !== null, checkedAt: Date.now() }));
  }, [key]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      if (timer === undefined) timer = setInterval(() => void load(), pollMs);
    };
    const stop = () => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    };
    const onVis = () => {
      if (document.hidden) return stop();
      if (Date.now() - lastRead.current >= pollMs) void load();
      start();
    };
    void load();
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load, pollMs]);

  return { ...state, reload: load };
}

type Display = {
  /** CSS 단계 (색): normal·ready·concern·caution·alert·serious·stale */
  tone: string;
  /** 알약 가운데 글자 */
  status: string;
  icon: string;
};

const ICONS: Record<string, string> = {
  normal: '●',
  ready: '▲',
  concern: '▲',
  caution: '▲',
  alert: '▲',
  serious: '◆',
  stale: '○',
};

function display(d: SupplyData, readFailed: boolean, now: Date): Display {
  const lv = reserveLevel(d.latest.reserve);
  const lastHm = hmKst(d.asof);
  if (d.failedAt || readFailed) return { tone: 'stale', status: `갱신 실패 · 마지막 ${lastHm}`, icon: '↻' };
  if (isStale(d.asof, now)) return { tone: 'stale', status: `지연 · 마지막 ${lastHm}`, icon: ICONS.stale };
  if (!lv) return { tone: 'stale', status: '단계 확인 불가', icon: ICONS.stale };
  return { tone: lv.level, status: lv.label, icon: ICONS[lv.level] };
}

/**
 * 계통도 도구줄 오른쪽 28px 알약 "예비율 12.3% · 정상 · 14:20 기준" (DEBATE.md 신규 안건 2, 시안 E1 A안).
 * 누르면 팝오버(모바일은 하단 시트): 현재 수요·공급능력·공급예비력(GW)·예비율, 오늘 수요 스파크라인 + 공급능력 점선, 출처·기준 시각·다음 갱신.
 * supply.json 이 없으면 아무것도 그리지 않는다. 단계가 바뀔 때만 announce (정기 갱신은 읽지 않음).
 */
export default function SupplyPill({ url, pollMs }: { url?: string | readonly string[]; pollMs?: number } = {}) {
  const { data, readFailed, checkedAt, reload } = useSupply(url, pollMs);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popId = useId();
  const prevTone = useRef<string | null>(null);

  const disp = data ? display(data, readFailed, new Date(checkedAt || Date.now())) : null;

  // 단계(색)가 바뀔 때만 한 번 알림 — 첫 표시는 읽지 않음
  useEffect(() => {
    if (!disp) return;
    if (prevTone.current !== null && prevTone.current !== disp.tone) {
      announce(`전력수급 ${disp.status} — 예비율 ${fmt(data?.latest.rate)}%`);
    }
    prevTone.current = disp.tone;
  }, [disp?.tone]); // 단계가 바뀔 때만

  // 팝오버: Esc·바깥 누르면 닫고 버튼으로 포커스
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  if (!data || !disp) return null;

  const l = data.latest;
  const asofHm = hmKst(data.asof);
  const sourceLine = `출처: ${SUPPLY_SOURCE} · ${asofHm} 기준`;
  const spark = sparkPaths(data.rows);
  const failed = disp.tone === 'stale' && (readFailed || !!data.failedAt);

  return (
    <div className="supply" ref={wrapRef} data-testid="supply-pill-wrap">
      <button
        ref={btnRef}
        type="button"
        className="supply__pill"
        data-tone={disp.tone}
        data-testid="supply-pill"
        aria-expanded={open}
        aria-controls={popId}
        aria-haspopup="dialog"
        aria-label={`전력수급 예비율 ${fmt(l.rate)}%, ${disp.status}. ${sourceLine}`}
        title={sourceLine}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="supply__icon" aria-hidden="true">{disp.icon}</span>
        <span className="supply__label">예비율</span>
        <b className="supply__rate">{fmt(l.rate)}%</b>
        <span className="supply__sep" aria-hidden="true">·</span>
        <span className="supply__status">{disp.status}</span>
        {disp.tone !== 'stale' && <span className="supply__time">{asofHm} 기준</span>}
      </button>
      {open && (
        <div className="supply__pop" id={popId} role="dialog" aria-label="전력수급 현황" data-testid="supply-popover">
          <div className="supply__head">
            <span className="supply__big">
              예비율 <b>{fmt(l.rate)}%</b>
            </span>
            <span className="supply__badge" data-tone={disp.tone}>
              <span aria-hidden="true">{disp.icon}</span> {disp.status}
            </span>
          </div>
          <dl className="supply__kpis">
            <div>
              <dt>현재 수요</dt>
              <dd>{fmt(l.demand)}<small> GW</small></dd>
            </div>
            <div>
              <dt>공급능력</dt>
              <dd>{fmt(l.supply)}<small> GW</small></dd>
            </div>
            <div>
              <dt>공급예비력</dt>
              <dd>{fmt(l.reserve, 2)}<small> GW</small></dd>
            </div>
          </dl>
          {spark.demand && (
            <figure className="supply__spark">
              <svg width="100%" height="40" viewBox="0 0 120 28" preserveAspectRatio="none" role="img"
                aria-label="오늘 수요 추이 (실선)와 공급능력 (점선)">
                {spark.supply && <path className="supply__spark-supply" d={spark.supply} />}
                <path className="supply__spark-demand" d={spark.demand} />
              </svg>
              <figcaption>
                <span><i className="supply__key supply__key--demand" aria-hidden="true" /> 오늘 수요</span>
                <span><i className="supply__key supply__key--supply" aria-hidden="true" /> 공급능력</span>
              </figcaption>
            </figure>
          )}
          <p className="supply__src" data-testid="supply-source">
            {sourceLine} · 다음 갱신 약 {nextUpdateHm(data, checkedAt || undefined)} (약 {COLLECT_EVERY_MIN}분마다)
          </p>
          {failed && (
            <button type="button" className="supply__retry" onClick={() => void reload()}>
              ↻ 다시 읽기
            </button>
          )}
        </div>
      )}
    </div>
  );
}
