import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDiagramController, useView } from '../../lib/diagram/view';
import { layerTitle } from '../../lib/diagram/model';
import type { ViewMode } from '../../lib/diagram/url';
import type { Diagram } from '../../lib/schema';

interface Props {
  mode: ViewMode;
  total: number;
  /** 계통 검수 상태 — pending 이면 "계통 검수 대기" 배지 */
  review?: Diagram['review'];
}

/** 계통 연결 정정 후 설계팀 검수 전까지 표시. 툴팁·스크린리더에 review.note */
function ReviewBadge({ review }: { review?: Diagram['review'] }) {
  if (!review || review.status === 'approved') return null;
  const detail = [review.note, review.changedAt ? `변경일 ${review.changedAt}` : ''].filter(Boolean).join(' · ');
  return (
    <span
      className="dtool__review"
      data-testid="diagram-review-badge"
      title={detail || undefined}
      tabIndex={0}
      role="note"
      aria-label={`계통 검수 대기${detail ? ` — ${detail}` : ''}`}
    >
      <span aria-hidden="true">⏳</span> 계통 검수 대기
    </span>
  );
}

function ZoomControls({ total }: { total: number }) {
  const scale = useView((s) => s.scale);
  const pct = Math.round(scale * 100);
  return (
    <>
      <div className="dtool__zoom" role="group" aria-label="확대·축소">
        <button
          type="button"
          className="dtool__zbtn"
          aria-label="축소"
          data-testid="zoom-out"
          onClick={() => getDiagramController()?.zoomBy(1 / 1.25)}
        >
          −
        </button>
        <span className="dtool__pct" aria-live="polite" aria-label={`현재 배율 ${pct}%`}>
          {pct}%
        </span>
        <button
          type="button"
          className="dtool__zbtn"
          aria-label="확대"
          data-testid="zoom-in"
          onClick={() => getDiagramController()?.zoomBy(1.25)}
        >
          +
        </button>
      </div>
      <button type="button" className="dtool__btn" data-testid="zoom-reset" onClick={() => getDiagramController()?.fitAll()}>
        전체 보기 ({total}종)
      </button>
    </>
  );
}

function CurrentHint() {
  const layer = useView((s) => s.layer);
  return (
    <span className="dtool__hint">
      {layer ? `${layerTitle(layer)} · ` : ''}드래그로 이동, 휠로 확대·축소
    </span>
  );
}

function CopyLink() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button type="button" className="dtool__btn" onClick={copy}>
      <span aria-live="polite">{copied ? '링크 복사됨 ✓' : '링크 복사 · ?mode=gap'}</span>
    </button>
  );
}

/** 계통도 위 툴바 — 줌 컨트롤 + 보기 모드별 안내 (Gap 배너 / 교육 투어 시작 카드) */
export default function DiagramToolbar({ mode, total, review }: Props) {
  const navigate = useNavigate();
  return (
    <div className={`dtool dtool--${mode}`}>
      {mode === 'gap' && (
        <div className="dtool__row dtool__banner" role="status">
          <span className="dtool__pill">Gap 모드 · 미보유와 일부 보유만 강조 중</span>
          <span className="dtool__note">공백 후보는 홈페이지 제품 목록 기준이며 실제 보유 여부 확인이 필요합니다</span>
          <CopyLink />
        </div>
      )}
      {mode === 'learn' && (
        <div className="dtool__row dtool__learn">
          <div className="dtool__learn-text">
            <strong>교육 모드</strong>
            <span>전기가 발전소에서 콘센트까지 오는 길 — L1 → L7 계통 따라가기 투어</span>
          </div>
          <button
            type="button"
            className="dtool__primary"
            data-testid="tour-start"
            onClick={() => navigate({ pathname: '/learn', search: '?step=L1' })}
          >
            투어 시작 →
          </button>
        </div>
      )}
      <div className="dtool__row">
        <ZoomControls total={total} />
        <ReviewBadge review={review} />
        <CurrentHint />
      </div>
    </div>
  );
}
