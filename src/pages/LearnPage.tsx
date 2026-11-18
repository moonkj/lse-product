import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useData } from '../data/load';
import { pageTitle } from '../lib/labels';
import { getLearnContent } from '../content/learnSchema';
import Lesson from './learn/Lesson';
import Overview from './learn/Overview';
import './pages.css';
import './LearnPage.css';

/** 퀴즈·진도 시절 localStorage 키 (개선 R3 에서 기능 제거) */
const LEGACY_PROGRESS_KEY = 'lse-learn-progress-v1';

/** tour = 단계 진행 중 / overview = 투어 끝내기 후 개요 */
type View = 'tour' | 'overview';

/**
 * 교육 투어 (/learn?step=L1~L7) + 용어집.
 * 퀴즈·학습 진도·투어 완료 요약은 (개선 R3) 사용자 결정으로 제거 — 저장하는 상태 없음.
 */
export default function LearnPage() {
  const content = getLearnContent();
  const { steps } = content;
  const data = useData();
  const [params, setParams] = useSearchParams();

  // 현재 단계는 로컬 상태가 원본(클릭 즉시 반영), URL ?step= 은 공유·새로고침용으로 뒤따라 갱신
  const paramStep = params.get('step');
  const paramIdx = steps.findIndex((s) => s.layer === paramStep);
  const [stepIdx, setStepIdx] = useState(() => (paramIdx >= 0 ? paramIdx : 0));
  const [view, setView] = useState<View>('tour');
  const touring = view === 'tour';
  const step = steps[stepIdx];

  useEffect(() => {
    // 다른 화면의 링크(/learn?step=L4)로 들어온 경우 등 외부에서 바뀐 URL 반영
    if (paramIdx >= 0) setStepIdx(paramIdx);
  }, [paramIdx]);

  useEffect(() => {
    // 없는 단계(?step=L9)·생략된 단계는 실제 보이는 단계로 URL 을 맞춘다 (투어 중에만)
    if (touring && paramIdx < 0) setParams({ step: steps[stepIdx].layer }, { replace: true });
  }, [touring, paramIdx, stepIdx, steps, setParams]);

  const glossaryRef = useRef<HTMLElement>(null);
  const lessonHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = pageTitle('교육');
    // 퀴즈 제거(개선 R3) 전 사용자 브라우저에 남은 학습 진도 저장값 정리 (1회, 실패해도 무시)
    try {
      localStorage.removeItem(LEGACY_PROGRESS_KEY);
    } catch {
      /* 저장소 접근 불가 — 무시 */
    }
  }, []);

  const goTo = (idx: number, focus = true) => {
    const clamped = Math.max(0, Math.min(steps.length - 1, idx));
    setStepIdx(clamped);
    setParams({ step: steps[clamped].layer }, { replace: true });
    setView('tour');
    if (focus) requestAnimationFrame(() => lessonHeadingRef.current?.focus());
  };

  const showGlossary = () => {
    glossaryRef.current?.scrollIntoView({ block: 'start' });
    glossaryRef.current?.focus();
  };

  return (
    <div className="lp" data-testid="learn-page">
      <div className="lp-bar">
        <div className="lp-bar__row">
          <span className="lp-bar__title">{content.tourTitle}</span>
          {touring && (
            <span className="pg-muted">
              {stepIdx + 1}단계 / {steps.length}단계
            </span>
          )}
          <button type="button" className="lp-linkbtn" onClick={showGlossary}>
            용어집 보기 →
          </button>
          {touring ? (
            <button type="button" className="pg-btn pg-btn--sm lp-bar__action" data-testid="tour-close" onClick={() => setView('overview')}>
              투어 끝내기
            </button>
          ) : (
            <button type="button" className="pg-btn pg-btn--sm pg-btn--primary lp-bar__action" data-testid="tour-start" onClick={() => goTo(0)}>
              투어 시작
            </button>
          )}
        </div>
        <ol className="lp-steps" aria-label="투어 단계">
          {steps.map((s, i) => {
            const current = touring && i === stepIdx;
            return (
              <li key={s.layer} aria-current={current ? 'step' : undefined} className={`lp-steps__item${current ? ' is-current' : ''}`}>
                <button type="button" className="lp-steps__btn" onClick={() => goTo(i)}>
                  <span className="lp-steps__track" aria-hidden="true" />
                  <span className="lp-steps__label">{s.shortLabel}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="pg pg--wide lp-body">
        {touring ? (
          <Lesson
            step={step}
            stepIdx={stepIdx}
            steps={steps}
            equipment={data.equipmentTypes}
            headingRef={lessonHeadingRef}
            voltage={data.diagram.layers.find((l) => l.id === step.layer)?.voltage}
            onPrev={() => goTo(stepIdx - 1)}
            onNext={() => goTo(stepIdx + 1)}
          />
        ) : (
          <Overview steps={steps} onStart={() => goTo(0)} />
        )}

        <section className="pg-card lp-glossary" aria-labelledby="glossary-h" ref={glossaryRef} tabIndex={-1} id="glossary">
          <h2 id="glossary-h">
            용어집 <span className="pg-count">· {content.glossary.length}</span>
          </h2>
          <dl className="lp-glossary__list">
            {content.glossary.map((g) => {
              const eq = g.equipmentId ? data.equipmentTypeById.get(g.equipmentId) : undefined;
              return (
                <div key={g.term} className="lp-glossary__item">
                  <dt>{eq ? <Link to={`/equipment/${eq.id}`}>{g.term}</Link> : g.term}</dt>
                  <dd>{g.meaning}</dd>
                </div>
              );
            })}
          </dl>
        </section>
        <p className="pg-muted lp-review">콘텐츠 상태: {content.reviewStatus}</p>
      </div>
    </div>
  );
}
