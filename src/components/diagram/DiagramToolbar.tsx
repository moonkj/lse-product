import { useState } from 'react';
import { getDiagramController, useView } from '../../lib/diagram/view';
import { layerTitle } from '../../lib/diagram/model';
import { useSetViewMode, type ViewMode } from '../../lib/diagram/url';
import type { Diagram } from '../../lib/schema';
import { getData } from '../../data/load';
import { gapConfidence } from '../../lib/labels';
import { announce } from '../../lib/announce';
import { printDiagram } from '../../lib/diagram/print';
import FlowToggle from './FlowToggle';
import SupplyPill from './SupplyPill';

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

/**
 * 보기 세그먼트 "보기 [전체｜공백만]" — 디자이너 토론 P0-5: 헤더의 제품/Gap 토글을 도구줄 맨 왼쪽으로 옮김.
 * URL `?mode=` 가 원본(useSetViewMode). 화면낭독기 그룹 이름은 "보기 모드" 유지.
 */
function ViewSegment({ mode }: { mode: ViewMode }) {
  const setMode = useSetViewMode();
  const opts: { value: ViewMode; label: string; title: string }[] = [
    { value: 'product', label: '전체', title: '전체 기기 보기' },
    { value: 'gap', label: '공백만', title: '미보유·일부 보유 기기만 강조' },
  ];
  return (
    <div className="dtool__view">
      <span className="dtool__view-label" aria-hidden="true">
        보기
      </span>
      <div className="dtool__seg" role="group" aria-label="보기 모드">
        {opts.map((o) => (
          <button
            key={o.value}
            type="button"
            className="dtool__seg-btn"
            aria-pressed={mode === o.value}
            data-testid={`view-mode-${o.value}`}
            title={o.title}
            onClick={() => {
              if (mode !== o.value) setMode(o.value);
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
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
  const focus = useView((s) => s.focus);
  // 선택 영역이 있으면 해제 버튼을 늘 보이게 (2026-11-19 사용자: 해제 방법이 명확하지 않음)
  if (focus)
    return (
      <button
        type="button"
        className="dtool__clear"
        data-testid="selection-clear"
        title="선택 해제 (Esc · 같은 영역을 다시 눌러도 해제)"
        onClick={() => getDiagramController()?.clearSelection()}
      >
        <b>{layerTitle(focus)}</b> <span className="dtool__clear-label">선택됨</span> <span className="dtool__clear-x">해제 ✕</span>
      </button>
    );
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

/** 계통도 위 툴바 — 보기 세그먼트 + 줌 컨트롤 + Gap 모드 배너 (도구줄 44px 한 줄, 디자이너 토론 P0-5·6) */
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
      <div className="dtool__row dtool__main">
        <ViewSegment mode={mode} />
        <ZoomControls total={total} />
        <PrintButton />
        <ReviewBadge review={review} />
        <CurrentHint />
        {/* 오른쪽 끝 슬롯 — 리더 통합 시 <FlowToggle />(D 담당, ⚡ 흐름)·<SupplyPill />(E 담당, 수급 알약)을 이 안에 넣는다 */}
        <div className="dtool__end" data-testid="dtool-end">
          <FlowToggle />
          <SupplyPill />
        </div>
      </div>
    </div>
  );
}
