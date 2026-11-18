import { memo } from 'react';
import { COVERAGE_LABELS } from '../../lib/schema';
import { TILE_H, TILE_W, isGapCoverage, type NodeItem } from '../../lib/diagram/model';
import type { ViewMode } from '../../store/useAppStore';
import { COVERAGE_ICONS } from '../common/CoverageBadge';
import EquipmentSymbol from './EquipmentSymbol';

interface Props {
  item: NodeItem;
  mode: ViewMode;
  selected: boolean;
  onActivate: (id: string) => void;
}

/**
 * 사진 타일 노드 120×116 (사진 72px + 약어 + 이름). 커버리지 = 테두리 색 + 우상단 배지.
 * 사진 없는 기기는 단선결선도 심볼, 미보유는 빨간 점선 테두리 + "자사 제품 없음".
 * memo: 줌/패닝은 부모의 transform 만 바뀌므로 노드는 다시 그리지 않는다.
 */
function DiagramNode({ item, mode, selected, onActivate }: Props) {
  const { id, eq, coverage } = item;
  const gapMode = mode === 'gap';
  const emphasized = gapMode && isGapCoverage(coverage);
  const dimmed = gapMode && (coverage === 'owned' || coverage === 'na');
  const missing = coverage === 'missing';

  let caption = item.subtitle;
  if (missing) caption = gapMode ? `${item.subtitle ? `${item.subtitle} · ` : ''}공백` : '자사 제품 없음';

  return (
    <div
      role="button"
      tabIndex={0}
      className={`dnode dnode--${coverage}${item.imageUrl ? '' : ' dnode--symbol'}${caption ? '' : ' dnode--nocap'}${selected ? ' is-selected' : ''}`}
      style={{ left: item.x - TILE_W / 2, top: item.y - TILE_H / 2 }}
      data-testid={`diagram-node-${id}`}
      data-node-id={id}
      aria-label={`${eq.name}, ${COVERAGE_LABELS[coverage]}`}
      aria-pressed={selected}
      data-coverage={coverage}
      data-dimmed={dimmed ? 'true' : 'false'}
      data-emphasized={emphasized ? 'true' : 'false'}
      onClick={() => onActivate(id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate(id);
        }
      }}
    >
      {item.imageUrl ? (
        // src 는 DiagramCanvas 의 IntersectionObserver 가 화면 근처에 왔을 때 채운다 (data-src)
        <img
          className="dnode__img"
          data-src={item.imageUrl}
          alt=""
          width={72}
          height={72}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      ) : (
        <EquipmentSymbol category={eq.category} equipmentId={eq.id} className="dnode__symbol" />
      )}
      <span className="dnode__title">{item.title}</span>
      {caption && <span className="dnode__caption">{caption}</span>}
      <span className={`dnode__badge cov-badge--${coverage}`} aria-hidden="true">
        <span className="cov-badge__icon" data-testid={`coverage-icon-${coverage}`}>
          {COVERAGE_ICONS[coverage]}
        </span>
      </span>
    </div>
  );
}

export default memo(DiagramNode);
