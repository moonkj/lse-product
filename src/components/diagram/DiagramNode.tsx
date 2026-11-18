import { memo, useState } from 'react';
import { COVERAGE_LABELS, isDimmedCoverage, isGapCoverage } from '../../lib/labels';
import { TILE_H, TILE_W, type NodeItem } from '../../lib/diagram/model';
import type { ViewMode } from '../../lib/diagram/url';
import CoverageBadge from '../common/CoverageBadge';
import EquipmentSymbol from '../common/EquipmentSymbol';

interface Props {
  item: NodeItem;
  mode: ViewMode;
  selected: boolean;
  onActivate: (id: string) => void;
}

/**
 * 사진 타일 노드 120×116 (160px 썸네일을 72px 로 + 약어 + 이름). 커버리지 = 테두리 색 + 우상단 배지.
 * 사진 없는 기기는 단선결선도 심볼, 미보유는 빨간 점선 테두리 + "자사 제품 없음".
 * memo: 줌/패닝은 부모의 transform 만 바뀌므로 노드는 다시 그리지 않는다.
 */
function DiagramNode({ item, mode, selected, onActivate }: Props) {
  const { id, eq, coverage } = item;
  const gapMode = mode === 'gap';
  const emphasized = gapMode && isGapCoverage(coverage);
  const dimmed = gapMode && isDimmedCoverage(coverage);
  const missing = coverage === 'missing';
  // 사진 로드 실패 시 심볼로 대체
  const [imgFailed, setImgFailed] = useState(false);
  const photo = item.imageUrl && !imgFailed ? item.imageUrl : undefined;

  let caption = item.subtitle;
  if (missing) caption = gapMode ? `${item.subtitle ? `${item.subtitle} · ` : ''}공백` : '자사 제품 없음';

  return (
    <div
      role="button"
      tabIndex={0}
      className={`dnode dnode--${coverage}${photo ? '' : ' dnode--symbol'}${caption ? '' : ' dnode--nocap'}${selected ? ' is-selected' : ''}`}
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
      {photo ? (
        // src 는 DiagramCanvas 의 IntersectionObserver 가 화면 근처에 왔을 때 채운다 (data-src)
        <img
          className="dnode__img"
          data-src={photo}
          alt=""
          width={72}
          height={72}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <EquipmentSymbol category={eq.category} equipmentId={eq.id} size={72} className="dnode__symbol" />
      )}
      <span className="dnode__title">{item.title}</span>
      {caption && <span className="dnode__caption">{caption}</span>}
      <CoverageBadge coverage={coverage} variant="icon" className="dnode__badge" />
    </div>
  );
}

export default memo(DiagramNode);
