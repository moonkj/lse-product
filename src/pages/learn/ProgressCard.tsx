import type { QuizStats } from './useLearnProgress';

/** 우측 "내 학습 진도" 카드 */
export default function ProgressCard({
  done,
  total,
  stats,
  onGlossary,
  glossaryPreview,
}: {
  done: number;
  total: number;
  stats: QuizStats;
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

