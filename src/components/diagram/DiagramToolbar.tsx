import { useState } from 'react';
import { getDiagramController, useView } from '../../lib/diagram/view';
import { layerTitle } from '../../lib/diagram/model';
import type { ViewMode } from '../../lib/diagram/url';
import type { Diagram } from '../../lib/schema';
import { getData } from '../../data/load';
import { gapConfidence } from '../../lib/labels';
import { announce } from '../../lib/announce';
import { printDiagram } from '../../lib/diagram/print';

interface Props {
  mode: ViewMode;
  total: number;
  /** 계통 검수 상태 — pending 이면 "계통 검수 대기" 배지 */
  review?: Diagram['review'];
}

/**
 * 공백 후보(gapConfidence = candidate — 재확인 기한 경과 포함)인 공백류 기기가 1개 이상일 때만
 * Gap 배너의 "홈페이지 기준" 안내를 보인다 (2026-11-18 사용자 결정: 모두 확정이면 숨김)
 */
function hasGapCandidate(): boolean {
  return getData().equipmentTypes.some((eq) => gapConfidence(eq) === 'candidate');
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
        {/* 배율은 화면 표시만 — 팬·줌마다 읽히던 live 안내는 없앰 (B10: 안내는 앱 공용 announce 하나로) */}
        <span className="dtool__pct" data-testid="zoom-pct">
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
      announce('링크를 복사했습니다');
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
      announce('링크를 복사하지 못했습니다');
    }
  };
  return (
    <button type="button" className="dtool__btn" onClick={copy}>
      {copied ? '링크 복사됨 ✓' : '링크 복사'}
    </button>
  );
}

/** 전체 계통도 한 장 인쇄 — 사진을 모두 받은 뒤 인쇄 대화상자 */
function PrintButton() {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (busy) return;
    setBusy(true);
    announce('인쇄 준비 중입니다');
    try {
      await printDiagram();
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      className="dtool__btn"
      data-testid="diagram-print"
      title="전체 계통도를 A4 한 장으로 인쇄"
      onClick={run}
      disabled={busy}
    >
      {busy ? '인쇄 준비 중…' : '인쇄'}
    </button>
  );
}

/** 계통도 위 툴바 — 줌 컨트롤 + Gap 모드 배너 */
export default function DiagramToolbar({ mode, total, review }: Props) {
  return (
    <div className={`dtool dtool--${mode}`}>
      {mode === 'gap' && (
        <div className="dtool__row dtool__banner" role="status">
          <span className="dtool__pill">Gap 모드 · 미보유와 일부 보유만 강조 중</span>
          {hasGapCandidate() && (
            <span className="dtool__note" data-testid="gap-candidate-note">
              공백 후보는 홈페이지 제품 목록 기준이며 실제 보유 여부 확인이 필요합니다
            </span>
          )}
          <CopyLink />
        </div>
      )}
      <div className="dtool__row">
        <ZoomControls total={total} />
        <PrintButton />
        <ReviewBadge review={review} />
        <CurrentHint />
      </div>
    </div>
  );
}
