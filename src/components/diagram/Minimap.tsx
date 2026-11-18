import { useRef } from 'react';
import { getDiagramModel } from '../../lib/diagram/model';
import { getDiagramController, useViewState } from '../../lib/diagram/view';
import type { ViewMode } from '../../lib/diagram/url';

const MM_W = 88;

/** 우하단 미니맵: 레이어 밴드 축소 + 현재 뷰 사각형, 클릭 시 그 지점으로 이동. Gap 모드면 공백 있는 계층에 빨간 점 */
export default function Minimap({ mode }: { mode: ViewMode }) {
  const model = getDiagramModel();
  const v = useViewState();
  const k = MM_W / model.width;
  const h = model.height * k;

  const svgRef = useRef<SVGSVGElement>(null);

  // 좌표는 바깥 div(패딩·테두리 포함)가 아니라 SVG 기준으로 잰다
  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const x = Math.min(model.width, Math.max(0, (e.clientX - r.left) / k));
    const y = Math.min(model.height, Math.max(0, (e.clientY - r.top) / k));
    getDiagramController()?.centerOn(x, y);
  };

  // 뷰 사각형은 미니맵 안으로 자름
  const vx = Math.max(0, v.x);
  const vy = Math.max(0, v.y);
  const vw = Math.min(model.width, v.x + v.w) - vx;
  const vh = Math.min(model.height, v.y + v.h) - vy;

  return (
    <div
      className="minimap"
      style={{ width: MM_W + 12, height: h + 12 }}
      onClick={onClick}
      title="미니맵 — 누르면 그 위치로 이동"
      // 마우스 보조 수단 — 키보드는 좌측 계층 내비·건너뛰기 링크로 같은 이동을 제공
      aria-hidden="true"
    >
      <svg ref={svgRef} width={MM_W} height={h} viewBox={`0 0 ${model.width} ${model.height}`} aria-hidden="true" focusable="false">
        {model.layers.map((l) => {
          const r = model.layerRect.get(l.id)!;
          const gaps = model.layerStats.get(l.id)?.gaps ?? 0;
          return (
            <g key={l.id}>
              <rect className={`minimap__band minimap__band--${l.id.toLowerCase()}`} x={r.x} y={r.y} width={r.w} height={r.h} />
              {mode === 'gap' && gaps > 0 && (
                <circle className="minimap__dot" cx={r.x + r.w / 2} cy={r.y + r.h / 2} r={8 / k / 2} />
              )}
            </g>
          );
        })}
        {v.ready && vw > 0 && vh > 0 && (
          <rect className="minimap__view" x={vx} y={vy} width={vw} height={vh} strokeWidth={2 / k} />
        )}
      </svg>
    </div>
  );
}
