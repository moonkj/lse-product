import type { EquipmentType } from '../../lib/schema';
import { equipmentImageUrl, getData } from '../../data/load';
import EquipmentVisual from '../pages/EquipmentVisual';

/** 상세 패널 대표 사진(없으면 단선결선도 심볼). compact = 모바일 시트 접힘 상태 72px */
export default function PanelHero({ eq, compact }: { eq: EquipmentType; compact: boolean }) {
  const hasPhoto = equipmentImageUrl(eq.id) !== undefined;
  const meta = getData().equipmentImageById.get(eq.id);
  const cls = `dp-hero${hasPhoto ? '' : ` dp-hero--symbol dp-hero--${eq.coverage}`}${compact ? ' dp-hero--compact' : ''}`;
  return (
    <div className={cls}>
      <EquipmentVisual
        eq={eq}
        alt={hasPhoto && meta?.productName ? `${meta.productName} 제품 사진` : undefined}
        thumb={compact}
        size={compact ? 72 : 200}
        symbolSize={compact ? 56 : 110}
        lazy={false}
      />
    </div>
  );
}
