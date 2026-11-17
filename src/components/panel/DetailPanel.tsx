import { useAppStore } from '../../store/useAppStore';
import { useData } from '../../data/load';
import EquipmentInfo from '../common/EquipmentInfo';

/** 우측 상세 패널 (Phase 3 에서 확장) */
export default function DetailPanel() {
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useAppStore((s) => s.setSelectedNodeId);
  const { diagram, equipmentTypeById } = useData();
  const node = selectedNodeId ? diagram.nodes.find((n) => n.id === selectedNodeId) : undefined;
  const eq = node ? equipmentTypeById.get(node.equipmentTypeId) : undefined;

  return (
    <aside className="detail-panel" aria-labelledby="detail-panel-title" data-testid="detail-panel">
      {eq ? (
        <>
          <div className="detail-panel__head">
            <h2 id="detail-panel-title" data-testid="detail-title">
              {node?.label ?? eq.name}
            </h2>
            <button
              type="button"
              className="detail-panel__close"
              aria-label="상세 정보 닫기"
              data-testid="detail-panel-close"
              onClick={() => setSelectedNodeId(null)}
            >
              ✕
            </button>
          </div>
          <EquipmentInfo eq={eq} idPrefix="detail" />
        </>
      ) : (
        <div className="detail-panel__empty">
          <h2 id="detail-panel-title">상세 정보</h2>
          <p>계통도에서 기기를 클릭하면 역할·자사 제품·자료가 여기에 표시됩니다.</p>
        </div>
      )}
    </aside>
  );
}
