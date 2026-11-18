import type { RefObject } from 'react';
import { Link } from 'react-router-dom';
import { LAYER_LABELS, type EquipmentType } from '../../lib/schema';
import { COVERAGE_LABELS } from '../../lib/labels';
import CoverageBadge from '../../components/common/CoverageBadge';
import EquipmentVisual from '../../components/pages/EquipmentVisual';
import { diagramHref, layerStyle, nodeForEquipment } from '../../lib/pages/catalog';
import type { LearnStep } from '../../content/learnSchema';

const CIRCLED = ['①', '②', '③'];

interface Props {
  step: LearnStep;
  stepIdx: number;
  steps: LearnStep[];
  equipment: EquipmentType[];
  headingRef: RefObject<HTMLHeadingElement>;
  voltage?: string;
  onPrev: () => void;
  onNext: () => void;
}

/** 투어 한 단계 본문: 계층 소개 → 핵심 기기 카드 → 이 계층의 공백(+패널 구성품) → 이전/다음 (L7 은 다음 비활성) */
export default function Lesson({ step, stepIdx, steps, equipment, headingRef, voltage, onPrev, onNext }: Props) {
  const byId = new Map(equipment.map((e) => [e.id, e]));
  const keyEqs = step.keyEquipmentIds.map((id) => byId.get(id)).filter((e): e is EquipmentType => e !== undefined);
  const inLayer = equipment.filter((e) => e.layer === step.layer);
  const missing = inLayer.filter((e) => e.coverage === 'missing');
  const partial = inLayer.filter((e) => e.coverage === 'partial');
  const affiliate = inLayer.filter((e) => e.coverage === 'affiliate');
  /** 패널 구성품(타사 조달) — 공백과 구분해 따로 표시 (개선 R3) */
  const sourced = inLayer.filter((e) => e.coverage === 'sourced');
  const prev = steps[stepIdx - 1];
  const nextStep = steps[stepIdx + 1];
  const nameList = (list: EquipmentType[]) => list.map((e) => (e.abbr ? `${e.name}(${e.abbr})` : e.name)).join(', ');

  return (
    <section className="pg-card lp-lesson" aria-labelledby="lesson-h" data-testid="tour-step" data-layer={step.layer}>
      <div className="lp-lesson__head">
        <span className="pg-badge pg-badge--layer" style={layerStyle(step.layer)}>
          {step.layer} · {LAYER_LABELS[step.layer]}
          {voltage ? ` · ${voltage}` : ''}
        </span>
        <h1 id="lesson-h" className="lp-lesson__title" tabIndex={-1} ref={headingRef}>
          {step.title}
        </h1>
        <p className="lp-lesson__intro">{step.intro}</p>
      </div>

      <div className="lp-keys">
        <h2 className="lp-label">이 계층의 핵심 기기</h2>
        <ul className="lp-keys__grid">
          {keyEqs.map((eq, i) => {
            const node = nodeForEquipment(eq.id);
            return (
              <li key={eq.id}>
                <Link to={node ? diagramHref(node.id) : `/equipment/${eq.id}`} className="lp-key" data-testid={`learn-key-${eq.id}`}>
                  <span className={`lp-key__media${eq.coverage === 'missing' ? ' lp-key__media--missing' : ''}`}>
                    <EquipmentVisual eq={eq} />
                  </span>
                  <b>
                    {CIRCLED[i]} {eq.abbr ? `${eq.abbr} ` : ''}
                    {eq.name}
                  </b>
                  <span className="lp-key__desc">{eq.description}</span>
                  <CoverageBadge coverage={eq.coverage} />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {missing.length + partial.length + affiliate.length > 0 ? (
        <div className="lp-gap">
          <h2 className="lp-gap__title">이 계층의 공백</h2>
          <ul className="lp-gap__list">
            {missing.length > 0 && (
              <li>
                <CoverageBadge coverage="missing" variant="chip" showLabel={false} decorative /> 자사 제품 없음: {nameList(missing)}
              </li>
            )}
            {partial.length > 0 && (
              <li>
                <CoverageBadge coverage="partial" variant="chip" showLabel={false} decorative /> 일부 보유: {nameList(partial)}
              </li>
            )}
            {affiliate.length > 0 && (
              <li>
                <CoverageBadge coverage="affiliate" variant="chip" showLabel={false} decorative /> 계열사 공급:{' '}
                {affiliate.map((e) => `${e.name}${e.affiliateName ? ` (${e.affiliateName})` : ''}`).join(', ')}
              </li>
            )}
          </ul>
          <Link to="/gap" className="lp-gap__link">
            공백 표에서 자세히 보기 →
          </Link>
        </div>
      ) : (
        <p className="lp-nogap">
          {sourced.length > 0
            ? '이 계층에서 자사 제품이 없는 기기는 아래 패널 구성품뿐입니다.'
            : '이 계층의 기기는 모두 자사 제품으로 공급합니다.'}
        </p>
      )}

      {sourced.length > 0 && (
        <p className="lp-sourced" data-testid="learn-sourced">
          <CoverageBadge coverage="sourced" variant="chip" showLabel={false} decorative /> {COVERAGE_LABELS.sourced}:{' '}
          {nameList(sourced)} — 수배전반에 타사 제품을 넣어 함께 공급하는 구성품
        </p>
      )}

      <div className="lp-nav">
        <button type="button" className="pg-btn" onClick={onPrev} disabled={!prev} data-testid="tour-prev">
          {prev ? `← ${prev.shortLabel}` : '← 이전'}
        </button>
        <button
          type="button"
          className={`pg-btn${nextStep ? ' pg-btn--primary' : ''}`}
          onClick={onNext}
          disabled={!nextStep}
          data-testid="tour-next"
        >
          {nextStep ? `다음: ${nextStep.shortLabel} →` : '마지막 단계입니다'}
        </button>
      </div>
    </section>
  );
}
