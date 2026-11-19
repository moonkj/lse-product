import { useFlowOn, useSetFlow } from '../../lib/diagram/flow';
import { useViewMode } from '../../lib/diagram/url';
import { announce } from '../../lib/announce';
import './flow.css';

/**
 * 도구줄 토글 [⚡ 흐름] — 전기 흐름 애니메이션 켜기/끄기 (기본 꺼짐, 주소 `?flow=1`로 공유).
 * 5초 넘게 움직이는 표현의 정지 수단을 겸한다(WCAG 2.2.2). Gap 보기에서는 흐름을 그리지 않으므로 비활성.
 */
export default function FlowToggle() {
  const on = useFlowOn();
  const setFlow = useSetFlow();
  const gap = useViewMode() === 'gap';
  const title = gap ? '공백만 보기에서는 전기 흐름을 표시하지 않습니다' : on ? '전기 흐름 끄기' : '전기 흐름 켜기 — 기기를 고르면 그 기기의 상류·하류만';
  return (
    <button
      type="button"
      className="dflow-toggle"
      aria-pressed={on && !gap}
      aria-disabled={gap || undefined}
      title={title}
      data-testid="flow-toggle"
      onClick={() => {
        if (gap) return;
        setFlow(!on);
        announce(on ? '전기 흐름 끔' : '전기 흐름 켬');
      }}
    >
      <span aria-hidden="true">⚡</span> 흐름
    </button>
  );
}
