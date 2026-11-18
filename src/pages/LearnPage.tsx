import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useData } from '../data/load';
import { pageTitle } from '../lib/labels';
import { getLearnContent } from '../content/learnSchema';
import Lesson from './learn/Lesson';
import Overview from './learn/Overview';
import ProgressCard from './learn/ProgressCard';
import QuizCard from './learn/QuizCard';
import TourSummary from './learn/TourSummary';
import { useLearnProgress } from './learn/useLearnProgress';
import './pages.css';
import './LearnPage.css';

/** tour = 단계 진행 중 / overview = 투어 끝내기 후 개요 / summary = 투어 완료 요약 */
type View = 'tour' | 'overview' | 'summary';

/**
 * 교육 투어 (/learn?step=L1~L7). 단계 본문·퀴즈·진도·개요·완료 요약은 ./learn/ 하위 컴포넌트.
 */
export default function LearnPage() {
  const content = getLearnContent();
  const { steps } = content;
  const data = useData();
  const [params, setParams] = useSearchParams();
  const { progress, markDone, setLastStep, answer, finishTour, quizStats } = useLearnProgress(steps);

  // 현재 단계는 로컬 상태가 원본(클릭 즉시 반영), URL ?step= 은 공유·새로고침용으로 뒤따라 갱신
  const paramStep = params.get('step');
  const paramIdx = steps.findIndex((s) => s.layer === paramStep);
  const [stepIdx, setStepIdx] = useState(() => (paramIdx >= 0 ? paramIdx : progress.lastStep));
  const [view, setView] = useState<View>('tour');
  const touring = view === 'tour';
  const step = steps[stepIdx];

  useEffect(() => {
    // 다른 화면의 링크(/learn?step=L4)로 들어온 경우 등 외부에서 바뀐 URL 반영
    if (paramIdx >= 0) {
      setStepIdx(paramIdx);
      setLastStep(paramIdx);
    }
  }, [paramIdx]);

  useEffect(() => {
    // 없는 단계(?step=L9)·생략된 단계는 실제 보이는 단계로 URL 을 맞춘다 (투어 중에만)
    if (touring && paramIdx < 0) setParams({ step: steps[stepIdx].layer }, { replace: true });
  }, [touring, paramIdx, stepIdx, steps, setParams]);

  const glossaryRef = useRef<HTMLElement>(null);
  const lessonHeadingRef = useRef<HTMLHeadingElement>(null);
  const summaryHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = pageTitle('교육');
  }, []);

  const goTo = (idx: number, focus = true) => {
    const clamped = Math.max(0, Math.min(steps.length - 1, idx));
    setStepIdx(clamped);
    setParams({ step: steps[clamped].layer }, { replace: true });
    setLastStep(clamped);
    setView('tour');
    if (focus) requestAnimationFrame(() => lessonHeadingRef.current?.focus());
  };

  const next = () => {
    markDone(step.layer);
    goTo(stepIdx + 1);
  };

  const finish = () => {
    finishTour(step.layer);
    setView('summary');
    requestAnimationFrame(() => summaryHeadingRef.current?.focus());
  };

  const showGlossary = () => {
    glossaryRef.current?.scrollIntoView({ block: 'start' });
    glossaryRef.current?.focus();
  };

  const doneCount = progress.completed.length;

  return (
    <div className="lp" data-testid="learn-page">
      <div className="lp-bar">
        <div className="lp-bar__row">
          <span className="lp-bar__title">{content.tourTitle}</span>
          {touring && (
            <span className="pg-muted">
              {stepIdx + 1}단계 / {steps.length}단계 · 학습 완료 {doneCount}개 계층
            </span>
          )}
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
            const done = progress.completed.includes(s.layer);
            const current = touring && i === stepIdx;
            return (
              <li key={s.layer} aria-current={current ? 'step' : undefined} className={`lp-steps__item${done ? ' is-done' : ''}${current ? ' is-current' : ''}`}>
                <button type="button" className="lp-steps__btn" onClick={() => goTo(i)}>
                  <span className="lp-steps__track" aria-hidden="true" />
                  <span className="lp-steps__label">
                    {done && <span aria-hidden="true">✓ </span>}
                    {s.shortLabel}
                    {done && <span className="visually-hidden"> (완료)</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="pg pg--wide lp-body">
        {touring ? (
          <div className="pg-split">
            <Lesson
              step={step}
              stepIdx={stepIdx}
              steps={steps}
              equipment={data.equipmentTypes}
              headingRef={lessonHeadingRef}
              voltage={data.diagram.layers.find((l) => l.id === step.layer)?.voltage}
              onPrev={() => goTo(stepIdx - 1)}
              onNext={next}
              onFinish={finish}
            />
            <aside className="pg-split__side" aria-label="퀴즈와 학습 진도">
              <QuizCard key={step.layer} step={step} answers={progress.answers} onAnswer={(q, choice) => answer(step, q, choice)} />
              <ProgressCard
                done={doneCount}
                total={steps.length}
                stats={quizStats}
                onGlossary={showGlossary}
                glossaryPreview={content.glossary.slice(0, 5).map((g) => g.term)}
              />
            </aside>
          </div>
        ) : view === 'summary' ? (
          <TourSummary
            steps={steps}
            completed={progress.completed}
            stats={quizStats}
            headingRef={summaryHeadingRef}
            onRestart={() => goTo(0)}
          />
        ) : (
          <Overview
            steps={steps}
            completed={progress.completed}
            lastStep={progress.lastStep}
            onStart={() => goTo(0)}
            onResume={() => goTo(progress.lastStep)}
            stats={quizStats}
          />
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
