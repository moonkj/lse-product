import { usePlanStore } from '../../lib/market/planStore';
import { announce } from '../../lib/announce';
import '../diagram/flow.css';

/**
 * 도구줄 토글 [계획] — 계획 파이프라인 레이어(계획 기반 설비 소요) 켜기/끄기. 기본 꺼짐, `?plan=1` 로 켠 채 열기.
 * 모양은 [⚡ 흐름] 토글과 같은 클래스(dflow-toggle).
 */
export default function PlanToggle() {
  const on = usePlanStore((s) => s.on);
  const setOn = usePlanStore((s) => s.setOn);
  return (
    <button
      type="button"
      className="dflow-toggle"
      aria-pressed={on}
      title={on ? '계획 기반 설비 소요 끄기' : '계획 기반 설비 소요 켜기 — 송변전·전력수급 계획 물량과 사업 일정, 자사 보유 상태를 L1~L3·신재생에 겹쳐 보기'}
      data-testid="plan-toggle"
      onClick={() => {
        setOn(!on);
        announce(on ? '계획 기반 설비 소요 끔' : '계획 기반 설비 소요 켬');
      }}
    >
      <span aria-hidden="true">▤</span> 계획
    </button>
  );
}
