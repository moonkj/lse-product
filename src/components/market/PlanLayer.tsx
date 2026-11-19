import { memo, useMemo } from 'react';
import { useData } from '../../data/load';
import type { DiagramModel } from '../../lib/diagram/model';
import type { EquipmentType } from '../../lib/schema';
import { COVERAGE_LABELS } from '../../lib/labels';
import { usePlanStore } from '../../lib/market/planStore';
import { planSlots, type Box } from '../../lib/market/planLayout';
import {
  PLAN_LAYERS,
  PLAN_WARN_COVERAGES,
  compareOf,
  coverageRows,
  fmtMilestone,
  fmtNum,
  getPlans,
  headlineOf,
  latestActual,
  milestonePos,
  otherForecasts,
  projectShift,
  timelineRange,
  type PlanFigure,
  type PlanItem,
  type PlanLayer as PlanLayerId,
  type PlanProject,
  type PlansFile,
} from '../../lib/market/plans';
import SourceBadge from './SourceBadge';
import './plan.css';

/** 카드 최대 폭 (계통도 좌표) — 넓은 빈자리에서도 한 줄이 너무 길어지지 않게 */
const CARD_MAX_W = 640;

const LAYER_NAMES: Record<PlanLayerId, string> = { L1: 'L1 송전', L2: 'L2 변전', L3: 'L3 배전', REN: '신재생·저장' };

/**
 * 계획 파이프라인 레이어 (토론 P0-2) — 도구줄 [계획] 토글이 켜지면 L1~L3·신재생 밴드의 빈자리(타일·연결선·이름표를 피한 곳)에
 * 공식 계획 물량·사업 일정·차수 비교와 연결 기기의 자사 보유 상태를 겹쳐 보인다. DiagramCanvas 의 `.diagram__inner` 안(계통도 좌표)에 마운트.
 * 축소 단계(data-zoom)별로 CSS 가 내용을 줄인다: 상세 = 전부, 중간 = 값·보유 요약, 개요 = 대표 값 큰 글자.
 */
export default function PlanLayer({ model }: { model: DiagramModel }) {
  const on = usePlanStore((s) => s.on);
  if (!on) return null;
  return <PlanCards model={model} />;
}

const PlanCards = memo(function PlanCards({ model }: { model: DiagramModel }) {
  const { equipmentTypes } = useData();
  const plans = getPlans();
  const slots = useMemo(() => planSlots(model, PLAN_LAYERS), [model]);
  return (
    <div className="mplan-layer" data-testid="plan-layer">
      {PLAN_LAYERS.map((l) => {
        const slot = slots.get(l);
        const items = plans.items.filter((i) => i.layer === l);
        const projects = plans.projects.filter((p) => p.layer === l);
        if (!slot || (items.length === 0 && projects.length === 0)) return null;
        return <PlanCard key={l} layer={l} slot={slot} items={items} projects={projects} plans={plans} types={equipmentTypes} />;
      })}
    </div>
  );
});

function PlanCard({
  layer,
  slot,
  items,
  projects,
  plans,
  types,
}: {
  layer: PlanLayerId;
  slot: Box;
  items: PlanItem[];
  projects: PlanProject[];
  plans: PlansFile;
  types: EquipmentType[];
}) {
  const editions = new Map(plans.editions.map((e) => [e.id, e]));
  // 이 카드에서 쓰는 비교 쌍 (첫 항목 기준) — 머리말 "10차 → 11차 송변전"
  const pair = plans.compare.find((c) => items.some((i) => i.figures.some((g) => g.edition === c.to)) || projects.some((p) => p.milestones.some((m) => m.edition === c.to)));
  const width = Math.min(slot.w, CARD_MAX_W);
  const titleId = `mplan-title-${layer}`;
  return (
    <section
      className="mplan"
      data-testid={`plan-card-${layer}`}
      data-layer={layer}
      aria-labelledby={titleId}
      style={{ left: slot.x + slot.w - width, top: slot.y, width, maxHeight: slot.h }}
    >
      <header className="mplan__head">
        <h2 id={titleId} className="mplan__title">
          계획 기반 설비 소요 <span className="mplan__layer">{LAYER_NAMES[layer]}</span>
        </h2>
        {pair && (
          <span className="mplan__editions">
            {editions.get(pair.from)?.short} → <b>{editions.get(pair.to)?.short}</b>
          </span>
        )}
      </header>
      <ul className="mplan__items">
        {items.map((it) => (
          <PlanItemRow key={it.id} item={it} plans={plans} types={types} />
        ))}
      </ul>
      {projects.length > 0 && pair && <ProjectTimeline projects={projects} from={pair.from} to={pair.to} plans={plans} />}
      <p className="mplan__foot">{plans.note}</p>
    </section>
  );
}

function Value({ g, strong }: { g: PlanFigure; strong?: boolean }) {
  return (
    <span className={`mplan__val${strong ? ' mplan__val--main' : ''}`}>
      {g.kind === 'actual' && g.needsCheck ? '약 ' : ''}
      {fmtNum(g.value)}
      <small>{g.unit}</small>
      {g.year !== undefined && <span className="mplan__year">({g.year}{g.kind === 'actual' ? ' 실적' : ''})</span>}
    </span>
  );
}

function PlanItemRow({ item, plans, types }: { item: PlanItem; plans: PlansFile; types: EquipmentType[] }) {
  const editions = new Map(plans.editions.map((e) => [e.id, e]));
  const head = headlineOf(item, plans.compare);
  const cmp = compareOf(item, plans.compare);
  const actual = latestActual(item);
  const extra = otherForecasts(item, head);
  const cov = coverageRows(item.equipment, types);
  const warn = cov.filter((c) => PLAN_WARN_COVERAGES.includes(c.coverage));
  const rest = cov.length - warn.length;
  const tip = `${head.method} · ${head.source.title}`;
  return (
    <li className="mplan__item" data-testid={`plan-item-${item.id}`} data-warn={warn.length > 0 ? 'true' : undefined}>
      <div className="mplan__line">
        <span className="mplan__label">
          {item.label}
          {warn.length > 0 && <span className="mplan__warncount"> · 미보유·일부 {warn.length}</span>}
        </span>
        <span className="mplan__main" title={tip}>
          {head.edition && <span className="mplan__ed">{editions.get(head.edition)?.short}</span>}
          <Value g={head} strong />
          <SourceBadge source={head.source} needsCheck={head.needsCheck} />
        </span>
      </div>
      <div className="mplan__sub">
        {cmp?.from && (
          <span className="mplan__cmp" title={`${cmp.from.method} · ${cmp.from.source.title}`}>
            {editions.get(cmp.from.edition!)?.short} <Value g={cmp.from} />
            {cmp.comparable && cmp.delta !== undefined ? (
              <b className={`mplan__delta mplan__delta--${cmp.delta > 0 ? 'up' : cmp.delta < 0 ? 'down' : 'same'}`}>
                {cmp.delta > 0 ? '▲' : cmp.delta < 0 ? '▼' : '='} {fmtNum(Math.abs(cmp.delta))}
              </b>
            ) : (
              <i className="mplan__nocmp">단위 달라 비교 불가</i>
            )}
            <SourceBadge source={cmp.from.source} needsCheck={cmp.from.needsCheck} />
          </span>
        )}
        {actual && (
          <span className="mplan__cmp" title={`${actual.method} · ${actual.source.title}`}>
            <Value g={actual} />
            <SourceBadge source={actual.source} needsCheck={actual.needsCheck} />
          </span>
        )}
        {extra.map((g, i) => (
          <span key={i} className="mplan__cmp" title={`${g.method} · ${g.source.title}`}>
            전망 <Value g={g} />
            <SourceBadge source={g.source} needsCheck={g.needsCheck} />
          </span>
        ))}
      </div>
      {item.note && <div className="mplan__note">{item.note}</div>}
      {cov.length > 0 && (
        <div className="mplan__cov" aria-label="연결 기기 자사 보유 상태">
          {warn.map((c) => (
            <span key={c.id} className={`mplan__chip mplan__chip--${c.coverage}`} data-coverage={c.coverage}>
              {COVERAGE_LABELS[c.coverage]} · {c.name}
            </span>
          ))}
          {rest > 0 && <span className="mplan__chip mplan__chip--rest">그 밖 {rest}종 보유·계열사</span>}
        </div>
      )}
    </li>
  );
}

function ProjectTimeline({ projects, from, to, plans }: { projects: PlanProject[]; from: PlansFile['compare'][number]['from']; to: PlansFile['compare'][number]['to']; plans: PlansFile }) {
  const editions = new Map(plans.editions.map((e) => [e.id, e]));
  const range = timelineRange(projects);
  const ticks = [range[0], Math.round((range[0] + range[1]) / 2), range[1] - 1];
  return (
    <div className="mplan__tl" data-testid="plan-timeline">
      <div className="mplan__tl-head">
        <span>사업 준공 일정</span>
        <span className="mplan__tl-legend">
          <i className="mplan__mk mplan__mk--prev" /> {editions.get(from)?.short} <i className="mplan__mk mplan__mk--next" /> {editions.get(to)?.short}
        </span>
      </div>
      <ul>
        {projects.map((p) => {
          const shift = projectShift(p, from, to);
          const marks = p.milestones.filter((m) => m.edition === from || m.edition === to);
          const pos = marks.map((m) => milestonePos(m, range));
          const lo = Math.min(...pos);
          const hi = Math.max(...pos);
          const check = p.milestones.some((m) => m.needsCheck);
          const src = p.milestones.find((m) => m.edition === to)?.source ?? p.milestones[0].source;
          const label = marks.map((m) => `${editions.get(m.edition)?.short} ${fmtMilestone(m)}${m.label ? ` ${m.label}` : ''}`).join(', ');
          return (
            <li key={p.id} className="mplan__tl-row" data-testid={`plan-project-${p.id}`}>
              <span className="mplan__tl-name">{p.name}</span>
              <span className="mplan__tl-track" role="img" aria-label={`${p.name}: ${label}`}>
                <span className="mplan__tl-bar" style={{ left: `${lo * 100}%`, width: `${(hi - lo) * 100}%` }} />
                {marks.map((m, i) => (
                  <i
                    key={i}
                    className={`mplan__mk mplan__mk--${m.edition === from ? 'prev' : 'next'}`}
                    style={{ left: `${pos[i] * 100}%` }}
                    title={`${editions.get(m.edition)?.short} ${fmtMilestone(m)}${m.label ? ` ${m.label}` : ''} — ${m.method}`}
                  />
                ))}
              </span>
              <span className="mplan__tl-shift">
                {shift && shift.months !== 0 ? (
                  <b className={shift.months > 0 ? 'mplan__delta--down' : 'mplan__delta--up'}>
                    {shift.months > 0 ? '+' : '−'}
                    {shift.yearOnly ? `${Math.abs(shift.months / 12)}년` : `${Math.abs(shift.months)}개월`}
                  </b>
                ) : shift ? (
                  '변동 없음'
                ) : null}
                {marks.length > 2 && <span className="mplan__tl-phase">단계 준공</span>}
              </span>
              <SourceBadge source={src} needsCheck={check} />
            </li>
          );
        })}
      </ul>
      <div className="mplan__tl-axis" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} style={{ left: `${((t + 0.5 - range[0]) / (range[1] - range[0])) * 100}%` }}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
