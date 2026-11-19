import { Link } from 'react-router-dom';

/**
 * 도구줄 버튼 [📈 시장 지표] — 전력시장 지표 화면(/market)으로 이동. 흐름·계획 토글 옆 (2026-11-19 사용자 요청).
 * 토글이 아니라 화면 이동이라 링크. 좁은 도구줄에서는 흐름·계획처럼 아이콘만(글자는 화면낭독기용).
 */
export default function MarketButton() {
  return (
    <Link to="/market" className="dflow-toggle dmarket-btn" title="전력시장 지표 화면 열기 — 연간 수요·설비·전원믹스 추이" data-testid="market-link">
      <svg className="dmarket-btn__icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 19h16M6 15l4-4 3 3 5-6" />
      </svg>
      <span className="dflow-toggle__label"> 시장 지표</span>
    </Link>
  );
}
