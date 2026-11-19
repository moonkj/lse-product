import { memo, useState } from 'react';
import { COVERAGE_LABELS, gapConfidence, isDimmedCoverage, isGapCoverage } from '../../lib/labels';
import type { NodeItem } from '../../lib/diagram/model';
import { TILE_H, TILE_W } from '../../lib/diagram/geometry';
import type { ViewMode } from '../../lib/diagram/url';
import CoverageBadge from '../common/CoverageBadge';
import EquipmentSymbol from '../common/EquipmentSymbol';

interface Props {
  item: NodeItem;
  mode: ViewMode;
  selected: boolean;
  /** via = 'pointer'(클릭) | 'keyboard'(Enter·Space) — 선택된 타일을 다시 클릭하면 해제, 키보드는 패널로 이동 */
  onActivate: (id: string, via: 'pointer' | 'keyboard') => void;
}

/**
 * 사진 타일 노드 120×116 (160px 썸네일을 108×60 판에 + 약어 + 이름). 커버리지 = 타일 안쪽 우상단 배지(모양+색) —
 * 타일 밖으로 나가지 않아 계층 경계선과 겹치지 않는다(2026-11-19).
 * 테두리(P0-3): 기본 회색 1px, 미보유 1.5px 빨강 + 옅은 빨강 판, 일부 보유 1.5px 황색 + 판 하단 띠, 선택 = 바깥 네이비 링.
 * 사진 없는 기기는 단선결선도 심볼. 공백류(미보유·일부·계열사·패널 구성품)는 판정 확신도로 테두리 모양:
 * 공백 후보 = 점선, 확정 = 실선 (data-confidence). 참조 타일(ref)은 ↗ 표시 + 라벨, 누르면 그 기기 상세.
 * 60% 미만 축소(개요)에서는 CSS(data-zoom)로 사진·보조 글자를 숨기고 점 + 약칭만 보인다.
 * memo: 줌/패닝은 부모의 transform 만 바뀌므로 노드는 다시 그리지 않는다.
 */
function DiagramNode({ item, mode, selected, onActivate }: Props) {
  const { id, eq, coverage } = item;
  const gapMode = mode === 'gap';
  const emphasized = gapMode && isGapCoverage(coverage);
  const dimmed = gapMode && isDimmedCoverage(coverage);
  const missing = coverage === 'missing';
  const confidence = gapConfidence(eq);
  const ref = !!item.ref;
  // 사진 로드 실패 시 심볼로 대체
  const [imgFailed, setImgFailed] = useState(false);
  const photo = item.imageUrl && !imgFailed ? item.imageUrl : undefined;

  let caption = item.subtitle;
  if (ref) caption = item.refLabel ? `참조 · ${item.refLabel}` : '참조';
  else if (missing) caption = gapMode ? `${item.subtitle ? `${item.subtitle} · ` : ''}공백` : '자사 제품 없음';

  return (
    <div
      role="button"
      tabIndex={0}
      className={`dnode dnode--${coverage}${ref ? ' dnode--ref' : ''}${photo ? '' : ' dnode--symbol'}${caption ? '' : ' dnode--nocap'}${selected ? ' is-selected' : ''}`}
      style={{ left: item.x - TILE_W / 2, top: item.y - TILE_H / 2 }}
      data-testid={`diagram-node-${id}`}
      data-node-id={id}
      aria-label={nodeLabel(item.title, caption, eq.name, ref ? undefined : COVERAGE_LABELS[coverage])}
      aria-pressed={selected}
      data-coverage={coverage}
      data-confidence={confidence}
      data-ref={ref ? 'true' : undefined}
      data-dimmed={dimmed ? 'true' : 'false'}
      data-emphasized={emphasized ? 'true' : 'false'}
      onClick={(e) => onActivate(id, e.detail === 0 ? 'keyboard' : 'pointer')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate(id, 'keyboard');
        }
      }}
    >
      {/* 사진 판 108×60 가로형 (E3 P0) — 사진·심볼 공통. 미보유 = 옅은 빨강 판, 일부 보유 = 판 하단 황색 띠 (CSS) */}
      <span className="dnode__plate" aria-hidden="true">
        {photo ? (
          // src 는 DiagramCanvas 의 IntersectionObserver 가 화면 근처에 왔을 때 채운다 (data-src)
          <img
            className="dnode__img"
            data-src={photo}
            alt=""
            width={108}
            height={60}
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <EquipmentSymbol category={eq.category} equipmentId={eq.id} size={48} className="dnode__symbol" />
        )}
      </span>
      <span className="dnode__title">{item.title}</span>
      {/* 공백 텍스트: 세로 flex 라 화면엔 안 그려지지만 글자 추출(axe 2.5.3·복사)에서 제목과 캡션이 붙지 않게 */}{' '}
      {caption && (
        <span className="dnode__caption" title={caption}>
          {caption}
        </span>
      )}{' '}
      <CoverageBadge coverage={coverage} variant="icon" className="dnode__badge" />
      {ref && (
        // 참조 표시(점선 테두리 대신) — 의미는 캡션 "참조 · …"과 aria-label 이 전달
        <span className="dnode__ref" aria-hidden="true">
          ↗
        </span>
      )}
    </div>
  );
}

/**
 * 타일 이름 — 화면에 보이는 글자(제목·캡션)로 시작하고 기기명·커버리지를 덧붙인다 (WCAG 2.5.3, 리뷰 R5).
 * 예: "VCB 진공차단기, 보유" (캡션이 기기명이면 한 번만), "VCB 참조 · L4, 진공차단기"
 */
export function nodeLabel(title: string, caption: string | undefined, name: string, coverage?: string): string {
  const visible = [title, caption].filter(Boolean).join(' ');
  const extra = [visible.includes(name) ? undefined : name, coverage && !visible.includes(coverage) ? coverage : undefined].filter(Boolean);
  return extra.length ? `${visible}, ${extra.join(', ')}` : visible;
}

export default memo(DiagramNode);
