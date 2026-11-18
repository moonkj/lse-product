import { useState } from 'react';
import type { LearnStep, Quiz } from '../../content/learnSchema';

/** 단계별 확인 퀴즈 (답하면 정답·해설 표시, 진도에 저장) */
export default function QuizCard({
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

