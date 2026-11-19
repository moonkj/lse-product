import { useHomeView, useSetHomeView, type HomeView } from '../../lib/diagram/url';
import { announce } from '../../lib/announce';
import './stage.css';

/**
 * 홈 보기 방식 스위치 [계통맵 | 단계별] — 계통도·단계별 보기 도구줄 맨 왼쪽 같은 자리 (2026-11-19 사용자 요청).
 * 주소 `?view=stage` 가 원본. 선택 기기(?node)·공백만 보기(?mode)·수요처 프리셋은 그대로 유지된다.
 */
export default function ViewSwitch() {
  const view = useHomeView();
  const setView = useSetHomeView();
  const opts: { value: HomeView; label: string; title: string; icon: JSX.Element }[] = [
    {
      value: 'map',
      label: '계통맵',
      title: '단선결선도 형태의 계통맵으로 보기',
      icon: <path d="M12 3v6M6 9h12M6 9v5M18 9v5M4 14h4v6H4zM16 14h4v6h-4z" />,
    },
    {
      value: 'stage',
      label: '단계별',
      title: '발전·송전·변전·배전·수용가 단계별 카드로 보기',
      icon: (
        <>
          <rect x="3" y="4" width="4" height="16" rx="1" />
          <rect x="10" y="4" width="4" height="16" rx="1" />
          <rect x="17" y="4" width="4" height="16" rx="1" />
        </>
      ),
    },
  ];
  return (
    <div className="vswitch" role="group" aria-label="보기 방식" data-testid="view-switch">
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          className="vswitch__btn"
          aria-pressed={view === o.value}
          title={o.title}
          data-testid={`view-switch-${o.value}`}
          onClick={() => {
            if (view === o.value) return;
            setView(o.value);
            announce(`${o.label} 보기`);
          }}
        >
          <svg className="vswitch__icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            {o.icon}
          </svg>
          <span className="vswitch__label">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
