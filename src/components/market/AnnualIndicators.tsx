import annualJson from '../../data/market-annual.json';
import {
  MIX_KEYS,
  MIX_LABELS,
  MarketAnnualSchema,
  type Indicator,
  type MarketAnnual,
  type MixPoint,
  type YearPoint,
} from '../../lib/market/annual';
import { cagr, fmt, linear, niceTicks } from '../../lib/market/chart';
import SourceBadge from './SourceBadge';
import './annual.css';

/** 빌드 시점 검증 — 출처·기준일·실적/전망·방법이 빠지면 여기서 실패 */
const ANNUAL: MarketAnnual = MarketAnnualSchema.parse(annualJson);

const KIND_LABEL = { actual: '실적', forecast: '전망' } as const;
const digitsFor = (unit: string) => (unit === '원/kWh' ? 2 : 1);

/**
 * 연간 전력시장 지표 — 전력시장 지표 화면(/market)의 본문 (2026-11-19 사용자: 공백 표에서 빼서 계통도 도구줄 '시장 지표' 버튼 → 새 화면).
 * 실적 = 공식 통계 실선, 전망 = 공식 계획 점선. 지표마다 출처 배지. defaultOpen 이면 펼친 채로 연다.
 */
export default function AnnualIndicators({ data = ANNUAL, defaultOpen = false }: { data?: MarketAnnual; defaultOpen?: boolean }) {
  const years = data.indicators.flatMap((i) => i.actual.map((p) => p.year));
  const first = Math.min(...years);
  const last = Math.max(...years);
  return (
    <details className="pg-card mai" data-testid="market-annual" open={defaultOpen || undefined}>
      <summary className="mai__summary">
        <h2 className="mai__title">연간 전력시장 지표</h2>
        <span className="mai__sub">
          실적 {first}–{last} · 전망 공식 계획 · 기준 {data.asof}
        </span>
      </summary>
      <p className="mai__note">{data.note}</p>
      <p className="mai__legend" aria-hidden="true">
        <span className="mai__key mai__key--actual" /> 실적(공식 통계)
        <span className="mai__key mai__key--forecast" /> 전망(공식 계획)
        <span className="mai__key mai__key--base" /> 계획 문서의 기준연도 값
      </p>
      <div className="mai__grid">
        {data.indicators.map((ind) => (
          <IndicatorCard key={ind.id} ind={ind} />
        ))}
        <MixCard mix={data.mix} />
      </div>
    </details>
  );
}

function IndicatorCard({ ind }: { ind: Indicator }) {
  const digits = digitsFor(ind.unit);
  const lastPt = ind.actual[ind.actual.length - 1];
  const prevPt = ind.actual[ind.actual.length - 2];
  const firstPt = ind.actual[0];
  const yoy = prevPt && prevPt.value > 0 ? ((lastPt.value - prevPt.value) / prevPt.value) * 100 : undefined;
  const growth = cagr(firstPt, lastPt);
  const fc = ind.forecast[0];
  return (
    <section className="mai-card" aria-labelledby={`mai-${ind.id}`} data-testid={`market-annual-${ind.id}`}>
      <header className="mai-card__head">
        <h3 id={`mai-${ind.id}`}>
          {ind.label} <span className="mai-card__unit">({ind.unit})</span>
        </h3>
        <p className="mai-card__desc">{ind.desc}</p>
      </header>
      <p className="mai-card__now">
        <b>
          {fmt(lastPt.value, digits)} {ind.unit}
        </b>{' '}
        <span className="mai-card__meta">
          {lastPt.year}년 실적
          {yoy !== undefined && ` · 전년 대비 ${yoy >= 0 ? '+' : ''}${fmt(yoy, 1)}%`}
          {growth !== undefined && ` · ${firstPt.year}–${lastPt.year} 연평균 ${growth >= 0 ? '+' : ''}${fmt(growth, 1)}%`}
        </span>
      </p>
      <div className="mai-card__badges">
        <span className="mai-card__badge">
          실적 <SourceBadge source={lastPt.source} needsCheck={lastPt.needsCheck} />
        </span>
        {fc && (
          <span className="mai-card__badge">
            전망 <SourceBadge source={fc.source} needsCheck={fc.needsCheck} />
          </span>
        )}
      </div>
      <div className="mai-chart" role="region" aria-label={`${ind.label} 차트 (가로 스크롤)`} tabIndex={0}>
        <LineChart ind={ind} />
      </div>
      <dl className="mai-card__method">
        <dt>실적 방법</dt>
        <dd>
          {lastPt.method} — {lastPt.source.title}
        </dd>
        {fc && (
          <>
            <dt>전망 방법</dt>
            <dd>
              {fc.method} — {fc.source.title}
            </dd>
          </>
        )}
        {ind.planBase && (
          <>
            <dt>전망 출발점</dt>
            <dd>
              {ind.planBase.year}년 {fmt(ind.planBase.value, digits)} {ind.unit} — {ind.planBase.method}
            </dd>
          </>
        )}
      </dl>
      {ind.refs.length > 0 && (
        <ul className="mai-card__refs">
          {ind.refs.map((r) => (
            <li key={`${r.label}-${r.year}`}>
              참고: {r.label} <b>{fmt(r.value, 1)} {r.unit}</b> ({r.year}년 {KIND_LABEL[r.kind]}) <SourceBadge source={r.source} needsCheck={r.needsCheck} />
              <span className="mai-card__refmethod"> {r.method}</span>
            </li>
          ))}
        </ul>
      )}
      {ind.gapNote && <p className="mai-card__gap">{ind.gapNote}</p>}
      <DataTable caption={`${ind.label} (${ind.unit})`} rows={tableRows(ind)} digits={digits} />
    </section>
  );
}

function tableRows(ind: Indicator): { label: string; value: number; kind: string }[] {
  return [
    ...ind.actual.map((p) => ({ label: `${p.year}`, value: p.value, kind: KIND_LABEL[p.kind] })),
    ...(ind.planBase ? [{ label: `${ind.planBase.year} (계획 기준연도)`, value: ind.planBase.value, kind: '계획 문서' }] : []),
    ...ind.forecast.map((p) => ({ label: `${p.year}`, value: p.value, kind: KIND_LABEL[p.kind] })),
  ];
}

function DataTable({ caption, rows, digits }: { caption: string; rows: { label: string; value: number; kind: string }[]; digits: number }) {
  return (
    <table className="visually-hidden">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">연도</th>
          <th scope="col">값</th>
          <th scope="col">구분</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <th scope="row">{r.label}</th>
            <td>{fmt(r.value, digits)}</td>
            <td>{r.kind}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ───────────── 차트 ─────────────

const W = 340;
const H = 188;
const M = { l: 46, r: 14, t: 14, b: 26 };

function LineChart({ ind }: { ind: Indicator }) {
  const digits = digitsFor(ind.unit);
  const pts: YearPoint[] = [...ind.actual, ...ind.forecast, ...(ind.planBase ? [ind.planBase] : [])];
  const xs = pts.map((p) => p.year);
  const ys = pts.map((p) => p.value);
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys), 4);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const x = linear(x0, x1, M.l, W - M.r);
  const y = linear(ticks[0], ticks[ticks.length - 1], H - M.b, M.t);
  const path = (list: { year: number; value: number }[]) =>
    list.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.year).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const lastActual = ind.actual[ind.actual.length - 1];
  const forecastLine = ind.planBase ? [ind.planBase, ...ind.forecast] : [];
  const yearTicks = Array.from(new Set([ind.actual[0].year, lastActual.year, ...ind.forecast.map((p) => p.year)]));
  const lastFc = ind.forecast[ind.forecast.length - 1];
  const summary = `${ind.label} ${ind.actual[0].year}년 ${fmt(ind.actual[0].value, digits)}에서 ${lastActual.year}년 ${fmt(lastActual.value, digits)} ${ind.unit}${
    lastFc ? `, 계획 전망 ${lastFc.year}년 ${fmt(lastFc.value, digits)} ${ind.unit}` : ''
  }`;
  return (
    <svg className="mai-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} data-testid={`market-annual-chart-${ind.id}`}>
      <text className="mai-svg__unit" x={M.l - 6} y={M.t - 4} textAnchor="end">
        {ind.unit}
      </text>
      {ticks.map((t) => (
        <g key={t}>
          <line className="mai-svg__grid" x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} />
          <text className="mai-svg__tick" x={M.l - 6} y={y(t) + 3.5} textAnchor="end">
            {fmt(t, t % 1 === 0 ? 0 : 1)}
          </text>
        </g>
      ))}
      {yearTicks.map((yr) => (
        <text key={yr} className="mai-svg__tick" x={x(yr)} y={H - M.b + 15} textAnchor="middle">
          {yr}
        </text>
      ))}
      <line className="mai-svg__axis" x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} />
      {forecastLine.length > 1 && <path className="mai-svg__forecast" d={path(forecastLine)} />}
      <path className="mai-svg__actual" d={path(ind.actual)} />
      {ind.actual.map((p) => (
        <circle key={p.year} className="mai-svg__dot" cx={x(p.year)} cy={y(p.value)} r={2.4} />
      ))}
      {ind.planBase && <circle className="mai-svg__base" cx={x(ind.planBase.year)} cy={y(ind.planBase.value)} r={3.4} />}
      {ind.forecast.map((p) => (
        <circle key={p.year} className="mai-svg__fdot" cx={x(p.year)} cy={y(p.value)} r={3} />
      ))}
      <text className="mai-svg__label" x={x(lastActual.year)} y={y(lastActual.value) - 7} textAnchor="middle">
        {fmt(lastActual.value, digits)}
      </text>
      {lastFc && (
        <text className="mai-svg__label mai-svg__label--fc" x={x(lastFc.year) - 2} y={y(lastFc.value) - 7} textAnchor="end">
          {fmt(lastFc.value, digits)}
        </text>
      )}
    </svg>
  );
}

const MIX_W = 340;
const MIX_H = 200;
const MM = { l: 34, r: 8, t: 12, b: 26 };

function MixCard({ mix }: { mix: MarketAnnual['mix'] }) {
  const last = mix.actual[mix.actual.length - 1];
  const fc = mix.forecast[0];
  return (
    <section className="mai-card mai-card--mix" aria-labelledby="mai-mix" data-testid="market-annual-mix">
      <header className="mai-card__head">
        <h3 id="mai-mix">
          {mix.label} <span className="mai-card__unit">(%)</span>
        </h3>
        <p className="mai-card__desc">{mix.desc}</p>
      </header>
      <p className="mai-card__now">
        <span className="mai-card__meta">{last.year}년 실적 </span>
        {MIX_KEYS.map((k) => `${MIX_LABELS[k]} ${fmt(last.shares[k], 1)}%`).join(' · ')}
      </p>
      <div className="mai-card__badges">
        <span className="mai-card__badge">
          실적 <SourceBadge source={last.source} needsCheck={last.needsCheck} />
        </span>
        {fc && (
          <span className="mai-card__badge">
            전망 <SourceBadge source={fc.source} needsCheck={fc.needsCheck} />
          </span>
        )}
      </div>
      <ul className="mai-mix__legend" aria-hidden="true">
        {MIX_KEYS.map((k) => (
          <li key={k}>
            <span className={`mai-mix__sw mai-mix--${k}`} /> {MIX_LABELS[k]}
          </li>
        ))}
      </ul>
      <div className="mai-chart" role="region" aria-label="전원믹스 차트 (가로 스크롤)" tabIndex={0}>
        <MixChart actual={mix.actual} forecast={mix.forecast} />
      </div>
      <dl className="mai-card__method">
        <dt>실적 방법</dt>
        <dd>
          {last.method} — {last.source.title}
        </dd>
        {fc && (
          <>
            <dt>전망 방법</dt>
            <dd>{mix.forecast.map((p) => `${p.year}년: ${p.method}`).join(' / ')} — {fc.source.title}</dd>
          </>
        )}
        {mix.planBase && (
          <>
            <dt>계획 기준연도</dt>
            <dd>
              {mix.planBase.year}년 {MIX_KEYS.map((k) => `${MIX_LABELS[k]} ${fmt(mix.planBase!.shares[k], 1)}%`).join(' · ')} — {mix.planBase.method}
            </dd>
          </>
        )}
      </dl>
      <table className="visually-hidden">
        <caption>전원믹스 발전량 비중(%)</caption>
        <thead>
          <tr>
            <th scope="col">연도</th>
            {MIX_KEYS.map((k) => (
              <th key={k} scope="col">
                {MIX_LABELS[k]}
              </th>
            ))}
            <th scope="col">구분</th>
          </tr>
        </thead>
        <tbody>
          {[...mix.actual, ...mix.forecast].map((p) => (
            <tr key={p.year}>
              <th scope="row">{p.year}</th>
              {MIX_KEYS.map((k) => (
                <td key={k}>{fmt(p.shares[k], 1)}</td>
              ))}
              <td>{KIND_LABEL[p.kind]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function MixChart({ actual, forecast }: { actual: MixPoint[]; forecast: MixPoint[] }) {
  const cols: (MixPoint | null)[] = forecast.length ? [...actual, null, ...forecast] : actual;
  const plotW = MIX_W - MM.l - MM.r;
  const slot = plotW / cols.length;
  const barW = Math.max(6, slot * 0.72);
  const y = linear(0, 100, MIX_H - MM.b, MM.t);
  const summary = `전원믹스 ${actual[0].year}–${actual[actual.length - 1].year} 실적${forecast.length ? `, 계획 전망 ${forecast.map((p) => p.year).join('·')}` : ''}`;
  return (
    <svg className="mai-svg" viewBox={`0 0 ${MIX_W} ${MIX_H}`} role="img" aria-label={summary} data-testid="market-annual-chart-mix">
      {[0, 25, 50, 75, 100].map((t) => (
        <g key={t}>
          <line className="mai-svg__grid" x1={MM.l} x2={MIX_W - MM.r} y1={y(t)} y2={y(t)} />
          <text className="mai-svg__tick" x={MM.l - 5} y={y(t) + 3.5} textAnchor="end">
            {t}%
          </text>
        </g>
      ))}
      {cols.map((p, i) => {
        if (!p) return null;
        const cx = MM.l + slot * i + slot / 2;
        let acc = 0;
        const isFc = p.kind === 'forecast';
        const showYear = isFc || i === 0 || i === actual.length - 1 || p.year % 5 === 0;
        return (
          <g key={p.year} className={isFc ? 'mai-mix__bar mai-mix__bar--fc' : 'mai-mix__bar'}>
            {MIX_KEYS.map((k) => {
              const v = p.shares[k];
              const top = y(acc + v);
              const h = y(acc) - top;
              acc += v;
              return <rect key={k} className={`mai-mix--${k}`} x={cx - barW / 2} y={top} width={barW} height={Math.max(0, h)} />;
            })}
            {isFc && <rect className="mai-mix__outline" x={cx - barW / 2} y={y(Math.min(100, acc))} width={barW} height={y(0) - y(Math.min(100, acc))} />}
            {showYear && (
              <text className="mai-svg__tick" x={cx} y={MIX_H - MM.b + 14} textAnchor="middle">
                {p.year}
              </text>
            )}
          </g>
        );
      })}
      {forecast.length > 0 && (
        <text className="mai-svg__tick" x={MM.l + slot * (actual.length + 0.5)} y={MM.t + 10} textAnchor="middle">
          ⋯
        </text>
      )}
    </svg>
  );
}
