import SourceBadge from './SourceBadge';
import {
  KEPCO_LEVEL_LABELS,
  LEAD_LEVEL_LABELS,
  REN_METRIC_LABELS,
  TREND_ARROWS,
  signalSource,
  signalsFor,
  type MarketSignal,
  type SignalKind,
} from '../../lib/market/signals';
import './signals.css';

/**
 * 기기 단위 시장 신호 (P1) — 조달 난이도 · KEC/기술기준 개정 · 한전 투자 · 신재생 연계 압력.
 * 합산 점수 없이 신호마다 점(신호등) + 한 줄 + 출처 배지. 근거가 없는 기기는 아무것도 그리지 않는다.
 */

type Tone = 'good' | 'warn' | 'bad' | 'info' | 'neutral';

const GROUPS: { kind: SignalKind; title: string }[] = [
  { kind: 'leadtime', title: '조달 난이도' },
  { kind: 'code', title: '규정 개정' },
  { kind: 'kepco', title: '한전 투자' },
  { kind: 'renewable', title: '신재생 연계' },
];

function tag(s: MarketSignal): { tone: Tone; label: string } {
  switch (s.kind) {
    case 'leadtime':
      return { tone: s.level === 'delay' ? 'bad' : s.level === 'caution' ? 'warn' : 'good', label: LEAD_LEVEL_LABELS[s.level] };
    case 'code':
      return { tone: s.status === 'upcoming' ? 'warn' : 'info', label: s.status === 'upcoming' ? '시행 예정' : '시행 중' };
    case 'kepco':
      return { tone: s.level === 'expand' ? 'good' : s.level === 'hold' ? 'neutral' : 'bad', label: KEPCO_LEVEL_LABELS[s.level] };
    case 'renewable': {
      const tone: Tone =
        s.level === 'positive' ? 'good' : s.level === 'caution' ? 'warn' : s.level === 'negative' ? 'bad' : 'neutral';
      const arrow = s.trend ? ` ${TREND_ARROWS[s.trend]}` : '';
      return { tone, label: `${REN_METRIC_LABELS[s.metric]}${arrow}` };
    }
  }
}

function SignalRow({ s }: { s: MarketSignal }) {
  const { tone, label } = tag(s);
  const { source, needsCheck } = signalSource(s);
  return (
    <li className={`esig__row esig__row--${tone}`} data-signal={s.id}>
      <span className="esig__dot" aria-hidden="true" />
      <span className="esig__tag" title={s.basis}>
        {label}
      </span>
      <span className="esig__text">
        {s.kind === 'code' && <span className="esig__clause">{s.clause} </span>}
        {s.text}
        {s.kind === 'code' && (
          <span className="esig__meta">
            {s.noticeNo} ({s.publishedAt}) · 시행: {s.effective} · 경과조치: {s.transition}
          </span>
        )}
      </span>
      <SourceBadge source={source} needsCheck={needsCheck} />
    </li>
  );
}

export default function EquipmentSignals({ equipmentId, layer }: { equipmentId: string; layer: string }) {
  const signals = signalsFor(equipmentId, layer);
  if (signals.length === 0) return null;
  return (
    <details className="esig" open>
      <summary className="esig__summary">기기 신호 {signals.length}건</summary>
      {GROUPS.map(({ kind, title }) => {
        const rows = signals.filter((s) => s.kind === kind);
        if (rows.length === 0) return null;
        return (
          <section key={kind} className="esig__group" aria-label={title}>
            <h4 className="esig__title">{title}</h4>
            <ul className="esig__list">
              {rows.map((s) => (
                <SignalRow key={s.id} s={s} />
              ))}
            </ul>
          </section>
        );
      })}
    </details>
  );
}
