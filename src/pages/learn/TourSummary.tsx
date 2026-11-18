import type { RefObject } from 'react';
import { Link } from 'react-router-dom';
import { LAYER_LABELS } from '../../lib/schema';
import type { LearnStep, TourLayer } from '../../content/learnSchema';
import type { QuizStats } from './useLearnProgress';

interface Props {
  steps: LearnStep[];
  completed: TourLayer[];
  stats: QuizStats;
  headingRef: RefObject<HTMLHeadingElement>;
  onRestart: () => void;
}

/** "투어 완료" 후 요약: 계층별 완료 표시 + 퀴즈 점수 + 계통도로 돌아가기 (퀴즈를 다 풀지 않아도 완료 가능) */
export default function TourSummary({ steps, completed, stats, headingRef, onRestart }: Props) {
  const done = steps.filter((s) => completed.includes(s.layer)).length;
  return (
    <section className="pg-card lp-overview" aria-labelledby="summary-h" data-testid="tour-summary">
      <h1 id="summary-h" className="lp-lesson__title" tabIndex={-1} ref={headingRef}>
        투어 완료 — 수고하셨습니다
      </h1>
      <p className="lp-summary__score">
        계층 {done}/{steps.length} · 퀴즈 정답 {stats.correct}/{stats.total}
      </p>
      {stats.answered < stats.total && (
        <p className="pg-muted">
          아직 풀지 않은 퀴즈가 {stats.total - stats.answered}문항 있습니다. 단계를 다시 열어 언제든 풀 수 있습니다.
        </p>
      )}
      <ol className="lp-overview__list">
        {steps.map((s, i) => {
          const isDone = completed.includes(s.layer);
          return (
            <li key={s.layer} className={isDone ? 'is-done' : ''}>
              <span className="lp-overview__mark" aria-hidden="true">
                {isDone ? '✓' : i + 1}
              </span>
              <span>
                <b>{s.layer}</b> {LAYER_LABELS[s.layer]}
                <span className="pg-muted"> · {isDone ? '완료' : '미완료'}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="pg-actions">
        <Link className="pg-btn pg-btn--primary" to="/" data-testid="tour-summary-home">
          계통도로 돌아가기
        </Link>
        <button type="button" className="pg-btn" onClick={onRestart}>
          처음부터 다시 보기
        </button>
      </div>
    </section>
  );
}
