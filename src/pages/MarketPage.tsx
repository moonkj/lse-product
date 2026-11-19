import { useEffect } from 'react';
import AnnualIndicators from '../components/market/AnnualIndicators';
import PageHeader from '../components/common/PageHeader';
import { pageTitle } from '../lib/labels';
import './pages.css';

/**
 * 전력시장 지표 (/market) — 계통도 도구줄 흐름·계획 옆 '시장 지표' 버튼으로 연다 (2026-11-19 사용자 요청: 공백 표에서 분리).
 * 본문은 연간 전력시장 지표(실적 = 공식 통계, 전망 = 공식 계획, 지표마다 출처 배지)를 펼친 채로.
 */
export default function MarketPage() {
  useEffect(() => {
    document.title = pageTitle('전력시장 지표');
  }, []);
  return (
    <div className="pg pg--market">
      <PageHeader
        crumbs={[{ label: '계통도', to: '/' }, { label: '전력시장 지표' }]}
        title="전력시장 지표"
        titleTestId="market-title"
        lead="전력 수요·설비·전원믹스 등 연간 추이를 공식 통계(실적)와 공식 계획(전망)으로 봅니다. 값마다 출처가 붙어 있습니다."
      />
      <AnnualIndicators defaultOpen />
    </div>
  );
}
