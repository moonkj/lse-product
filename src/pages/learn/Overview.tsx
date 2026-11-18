import { Link } from 'react-router-dom';
import { diagramHref } from '../../lib/pages/catalog';
import type { LearnStep, TourLayer } from '../../content/learnSchema';
import type { QuizStats } from './useLearnProgress';

/** 투어를 끝냈을 때(투어 끝내기) 보이는 개요 */
export default function Overview({
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
  stats: QuizStats;
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
