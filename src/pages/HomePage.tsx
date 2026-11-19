import DiagramCanvas from '../components/diagram/DiagramCanvas';
import StageView from '../components/stage/StageView';
import { useHomeView } from '../lib/diagram/url';

/** 홈 — 계통맵(기본) 또는 단계별 보기(?view=stage). 상세 패널·선택(?node)은 두 보기가 함께 쓴다 */
export default function HomePage() {
  return useHomeView() === 'stage' ? <StageView /> : <DiagramCanvas />;
}
