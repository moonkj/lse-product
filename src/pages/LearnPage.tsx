import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LAYER_LABELS, type EquipmentType } from '../lib/schema';
import { useData } from '../data/load';
import CoverageBadge, { COVERAGE_ICONS } from '../components/common/CoverageBadge';
import EquipmentVisual from '../components/pages/EquipmentVisual';
import { diagramHref, layerStyle, nodeForEquipment } from '../lib/pages/catalog';
import { getLearnContent, type LearnStep, type Quiz, type TourLayer } from '../content/learnSchema';
import './pages.css';
import './LearnPage.css';

// ───────────── 학습 진도 (localStorage — 실패해도 화면은 동작) ─────────────

const STORAGE_KEY = 'lse-learn-progress-v1';

interface Progress {
  completed: TourLayer[];
  /** quizId → 고른 보기 index */
  answers: Record<string, number>;
  lastStep: number;
}

const EMPTY_PROGRESS: Progress = { completed: [], answers: {}, lastStep: 0 };

function loadProgress(): Progress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PROGRESS;
    const p = JSON.parse(raw) as Partial<Progress>;
    return {
      completed: Array.isArray(p.completed) ? p.completed.filter((l): l is TourLayer => /^L[1-7]$/.test(String(l))) : [],
      answers: p.answers && typeof p.answers === 'object' ? p.answers : {},
      lastStep: typeof p.lastStep === 'number' && p.lastStep >= 0 && p.lastStep < 7 ? p.lastStep : 0,
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

function saveProgress(p: Progress) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* 저장 불가(사생활 보호 모드 등) — 이번 방문 동안만 유지 */
  }
}

const CIRCLED = ['①', '②', '③'];

export default function LearnPage() {
  const content = getLearnContent();
  const { steps } = content;
  const data = useData();
  const [params, setParams] = useSearchParams();
  const [progress, setProgress] = useState<Progress>(loadProgress);

  // 현재 단계는 로컬 상태가 원본(클릭 즉시 반영), URL ?step= 은 공유·새로고침용으로 뒤따라 갱신
  const paramStep = params.get('step');
  const paramIdx = steps.findIndex((s) => s.layer === paramStep);
  const [stepIdx, setStepIdx] = useState(() => (paramIdx >= 0 ? paramIdx : progress.lastStep));
  const [touring, setTouring] = useState(true);
  const step = steps[stepIdx];

  useEffect(() => {
    // 다른 화면의 링크(/learn?step=L4)로 들어온 경우 등 외부에서 바뀐 URL 반영
    if (paramIdx >= 0) setStepIdx(paramIdx);
  }, [paramIdx]);

  const glossaryRef = useRef<HTMLElement>(null);
  const lessonHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = '교육 · LS ELECTRIC 전력계통 제품맵';
  }, []);

  useEffect(() => saveProgress(progress), [progress]);

  const update = (fn: (p: Progress) => Progress) => setProgress((p) => fn(p));

  const markDone = (layer: TourLayer) =>
    update((p) => (p.completed.includes(layer) ? p : { ...p, completed: [...p.completed, layer] }));

  const goTo = (idx: number, focus = true) => {
    const clamped = Math.max(0, Math.min(steps.length - 1, idx));
    setStepIdx(clamped);
    setParams({ step: steps[clamped].layer }, { replace: true });
    update((p) => ({ ...p, lastStep: clamped }));
    setTouring(true);
    if (focus) requestAnimationFrame(() => lessonHeadingRef.current?.focus());
  };

  const next = () => {
    markDone(step.layer);
    goTo(stepIdx + 1);
  };

  const answer = (quiz: Quiz, choice: number) => {
    update((p) => {
      const answers = { ...p.answers, [quiz.id]: choice };
      const allAnswered = step.quizzes.every((q) => answers[q.id] !== undefined);
      const completed =
        allAnswered && !p.completed.includes(step.layer) ? [...p.completed, step.layer] : p.completed;
      return { ...p, answers, completed };
    });
  };

  const quizStats = useMemo(() => {
    const all = steps.flatMap((s) => s.quizzes);
    const answered = all.filter((q) => progress.answers[q.id] !== undefined);
    const correct = answered.filter((q) => progress.answers[q.id] === q.answerIndex);
    return { total: all.length, answered: answered.length, correct: correct.length };
  }, [steps, progress.answers]);

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
            <button type="button" className="pg-btn pg-btn--sm lp-bar__action" data-testid="tour-close" onClick={() => setTouring(false)}>
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
            />
            <aside className="pg-split__side" aria-label="퀴즈와 학습 진도">
              <QuizCard key={step.layer} step={step} answers={progress.answers} onAnswer={answer} />
              <ProgressCard
                done={doneCount}
                total={steps.length}
                stats={quizStats}
                onGlossary={showGlossary}
                glossaryPreview={content.glossary.slice(0, 5).map((g) => g.term)}
              />
            </aside>
          </div>
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

// ───────────── 단계 본문 ─────────────

function Lesson({
  step,
  stepIdx,
  steps,
  equipment,
  headingRef,
  voltage,
  onPrev,
  onNext,
}: {
  step: LearnStep;
  stepIdx: number;
  steps: LearnStep[];
  equipment: EquipmentType[];
  headingRef: RefObject<HTMLHeadingElement>;
  voltage?: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  const byId = new Map(equipment.map((e) => [e.id, e]));
  const keyEqs = step.keyEquipmentIds.map((id) => byId.get(id)).filter((e): e is EquipmentType => e !== undefined);
  const inLayer = equipment.filter((e) => e.layer === step.layer);
  const missing = inLayer.filter((e) => e.coverage === 'missing');
  const partial = inLayer.filter((e) => e.coverage === 'partial');
  const affiliate = inLayer.filter((e) => e.coverage === 'affiliate');
  const prev = steps[stepIdx - 1];
  const nextStep = steps[stepIdx + 1];
  const nameList = (list: EquipmentType[]) => list.map((e) => (e.abbr ? `${e.name}(${e.abbr})` : e.name)).join(', ');

  return (
    <section className="pg-card pg-split__main lp-lesson" aria-labelledby="lesson-h" data-testid="tour-step" data-layer={step.layer}>
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
                <Link to={node ? diagramHref(node.id) : `/equipment/${eq.id}`} className="lp-key">
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
                <span className="cov-chip cov-chip--missing" aria-hidden="true">
                  {COVERAGE_ICONS.missing}
                </span>{' '}
                자사 제품 없음: {nameList(missing)}
              </li>
            )}
            {partial.length > 0 && (
              <li>
                <span className="cov-chip cov-chip--partial" aria-hidden="true">
                  {COVERAGE_ICONS.partial}
                </span>{' '}
                일부 보유: {nameList(partial)}
              </li>
            )}
            {affiliate.length > 0 && (
              <li>
                <span className="cov-chip cov-chip--affiliate" aria-hidden="true">
                  {COVERAGE_ICONS.affiliate}
                </span>{' '}
                계열사 공급: {affiliate.map((e) => `${e.name}${e.affiliateName ? ` (${e.affiliateName})` : ''}`).join(', ')}
              </li>
            )}
          </ul>
          <Link to="/gap" className="lp-gap__link">
            공백 표에서 자세히 보기 →
          </Link>
        </div>
      ) : (
        <p className="lp-nogap">이 계층의 기기는 모두 자사 제품으로 공급합니다.</p>
      )}

      <div className="lp-nav">
        <button type="button" className="pg-btn" onClick={onPrev} disabled={!prev} data-testid="tour-prev">
          {prev ? `← ${prev.shortLabel}` : '← 이전'}
        </button>
        <button type="button" className="pg-btn pg-btn--primary" onClick={onNext} disabled={!nextStep} data-testid="tour-next">
          {nextStep ? `다음: ${nextStep.shortLabel} →` : '마지막 단계입니다'}
        </button>
      </div>
    </section>
  );
}

// ───────────── 퀴즈 ─────────────

function QuizCard({
  step,
  answers,
  onAnswer,
}: {
  step: LearnStep;
  answers: Record<string, number>;
  onAnswer: (q: Quiz, choice: number) => void;
}) {
  const firstUnanswered = step.quizzes.findIndex((q) => answers[q.id] === undefined);
  const [idx, setIdx] = useState(firstUnanswered >= 0 ? firstUnanswered : 0);
  const quiz = step.quizzes[idx];
  const chosen = answers[quiz.id];
  const answered = chosen !== undefined;
  const isLast = idx === step.quizzes.length - 1;

  return (
    <section className="pg-card pg-card--tight lp-quiz" aria-labelledby="quiz-h" data-testid="quiz">
      <div className="lp-quiz__head">
        <h2 id="quiz-h">확인 퀴즈</h2>
        <span className="pg-muted">
          {idx + 1} / {step.quizzes.length}
        </span>
      </div>
      <fieldset className="lp-quiz__set" key={quiz.id}>
        <legend className="lp-quiz__q">{quiz.question}</legend>
        {quiz.options.map((opt, i) => {
          const correct = i === quiz.answerIndex;
          const state = !answered ? '' : correct ? ' is-correct' : i === chosen ? ' is-wrong' : '';
          return (
            <label key={opt} className={`lp-opt${state}`}>
              <input
                type="radio"
                name={`quiz-${quiz.id}`}
                checked={chosen === i}
                disabled={answered}
                onChange={() => onAnswer(quiz, i)}
                data-testid={`quiz-option-${i}`}
              />
              <span className="lp-opt__text">{opt}</span>
              {answered && correct && <span className="lp-opt__mark lp-opt__mark--ok">✓ 정답</span>}
              {answered && !correct && i === chosen && <span className="lp-opt__mark lp-opt__mark--ng">✕ 오답</span>}
            </label>
          );
        })}
      </fieldset>
      <div aria-live="polite">
        {answered && (
          <p className="lp-quiz__explain" data-testid="quiz-explanation">
            {chosen === quiz.answerIndex ? '정답입니다. ' : '아쉬워요. '}
            {quiz.explanation}
          </p>
        )}
      </div>
      <div className="lp-quiz__nav">
        {idx > 0 && (
          <button type="button" className="pg-btn pg-btn--sm" onClick={() => setIdx(idx - 1)}>
            이전 문제
          </button>
        )}
        {!isLast && (
          <button type="button" className="pg-btn pg-btn--sm lp-quiz__next" onClick={() => setIdx(idx + 1)} disabled={!answered}>
            다음 문제
          </button>
        )}
        {isLast && answered && <span className="pg-muted">이 단계 퀴즈를 모두 풀었습니다.</span>}
      </div>
    </section>
  );
}

function ProgressCard({
  done,
  total,
  stats,
  onGlossary,
  glossaryPreview,
}: {
  done: number;
  total: number;
  stats: { total: number; answered: number; correct: number };
  onGlossary: () => void;
  glossaryPreview: string[];
}) {
  const pct = Math.round((done / total) * 100);
  return (
    <section className="pg-card pg-card--tight" aria-labelledby="prog-h">
      <h2 id="prog-h">내 학습 진도</h2>
      <div
        className="lp-meter"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label="완료한 계층 수"
      >
        <div className="lp-meter__fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="pg-muted">
        {total}개 계층 중 {done}개 완료 · 퀴즈 정답 {stats.correct}/{stats.answered}
        {stats.answered < stats.total ? ` (전체 ${stats.total}문항)` : ''} · 이 브라우저에 저장됨
      </p>
      <button type="button" className="lp-linkbtn" onClick={onGlossary}>
        용어집 보기 ({glossaryPreview.join(', ')} …) →
      </button>
    </section>
  );
}

function Overview({
  steps,
  completed,
  lastStep,
  onStart,
  onResume,
  stats,
}: {
  steps: LearnStep[];
  completed: TourLayer[];
  lastStep: number;
  onStart: () => void;
  onResume: () => void;
  stats: { total: number; answered: number; correct: number };
}) {
  return (
    <section className="pg-card lp-overview" aria-labelledby="overview-h">
      <h1 id="overview-h" className="lp-lesson__title">
        L1 → L7 계통 따라가기
      </h1>
      <p className="lp-lesson__intro">
        발전소에서 만든 전기가 송전·변전·배전·수전·변압을 거쳐 콘센트와 전동기까지 오는 길을 7단계로 따라갑니다. 단계마다
        핵심 기기와 자사 제품, 공백을 살펴보고 확인 퀴즈를 풉니다.
      </p>
      <ol className="lp-overview__list">
        {steps.map((s, i) => (
          <li key={s.layer} className={completed.includes(s.layer) ? 'is-done' : ''}>
            <span className="lp-overview__mark" aria-hidden="true">
              {completed.includes(s.layer) ? '✓' : i + 1}
            </span>
            <span>
              <b>{s.shortLabel}</b> — {s.title.split(' — ')[1] ?? s.title}
              {completed.includes(s.layer) && <span className="visually-hidden"> (완료)</span>}
            </span>
          </li>
        ))}
      </ol>
      <p className="pg-muted">
        완료 {completed.length}/{steps.length} 계층 · 퀴즈 정답 {stats.correct}/{stats.answered}
      </p>
      <div className="pg-actions">
        <button type="button" className="pg-btn pg-btn--primary" onClick={onStart}>
          L1부터 시작
        </button>
        {lastStep > 0 && (
          <button type="button" className="pg-btn" onClick={onResume}>
            이어서 학습 ({steps[lastStep].shortLabel})
          </button>
        )}
        <Link className="pg-btn" to={diagramHref(undefined, 'learn')}>
          계통도에서 교육 모드로 보기
        </Link>
      </div>
    </section>
  );
}
