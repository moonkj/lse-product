import DiagramCanvas from '../components/diagram/DiagramCanvas';
import StageView from '../components/stage/StageView';
import { useHomeView } from '../lib/diagram/url';
import { useGrid } from '../lib/diagram/grid';

/** 홈 — 계통맵(기본) 또는 단계별 보기(?view=stage). 상세 패널·선택(?node)은 두 보기가 함께 쓴다 */
export default function HomePage() {
  const grid = useGrid();
  // 계통 종류가 바뀌면 계통도를 새로 그린다 (확대·이동 상태 초기화)
  return useHomeView() === 'stage' ? <StageView /> : <DiagramCanvas key={grid} />;
}
