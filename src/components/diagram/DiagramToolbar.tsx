import { useState } from 'react';
import { getDiagramController, useView } from '../../lib/diagram/view';
import { layerTitle } from '../../lib/diagram/model';
import type { ViewMode } from '../../lib/diagram/url';
import type { Diagram } from '../../lib/schema';
import { getData } from '../../data/load';
import { gapConfidence } from '../../lib/labels';
import { announce } from '../../lib/announce';
import { printDiagram } from '../../lib/diagram/print';
import FlowToggle from './FlowToggle';
import SupplyPill from './SupplyPill';
import PresetPicker from '../market/PresetPicker';
import ViewOptions from './ViewOptions';
import ViewSwitch from '../stage/ViewSwitch';
import GridSelect from './GridSelect';

interface Props {
  mode: ViewMode;
  total: number;
  /** 계통 검수 상태 — pending 이면 "초안" 배지 */
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
      aria-label={`계통 초안 — 설계 검토 전${detail ? ` · ${detail}` : ''}`}
    >
      {/* '검수 대기'는 고객에게 미완성처럼 읽혀 '초안'으로 (2026-11-23 UX 토론) — 자세한 사정은 title 툴팁 */}
      <span aria-hidden="true">✎</span> 초안
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
        전체<span className="dtool__btn-sub"> 보기</span><span className="dtool__count"> ({total}종)</span>
      </button>
      <button
        type="button"
        className="dtool__btn"
        data-testid="zoom-fit-width"
        title="계통도 폭을 화면 폭에 맞춤 (위쪽부터)"
        onClick={() => getDiagramController()?.fitWidth()}
      >
        폭 맞춤
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
  // 휴대폰(≤900px): 확대·축소·인쇄·흐름·보기 옵션 줄을 '도구'로 접어 계통도 높이 확보 (2026-11-23 UX 토론). 손가락으로 확대·이동은 그대로
  const [toolsOpen, setToolsOpen] = useState(false);
  return (
    <div className={`dtool dtool--${mode}`} data-tools-open={toolsOpen || undefined}>
      {mode === 'gap' && (
        <div className="dtool__row dtool__banner" role="status">
          <span className="dtool__pill">보완 필요 · 미보유와 일부 보유만 강조 중</span>
          {hasGapCandidate() && (
            <span className="dtool__note" data-testid="gap-candidate-note">
              보완 후보는 홈페이지 제품 목록 기준이며 실제 보유 여부 확인이 필요합니다
            </span>
          )}
          <CopyLink />
        </div>
      )}
      <div className="dtool__row dtool__main">
        <ViewSwitch />
        <GridSelect />
        <PresetPicker />
        <button
          type="button"
          className="dtool__btn dtool__more"
          aria-expanded={toolsOpen}
          data-testid="dtool-more"
          onClick={() => setToolsOpen((o) => !o)}
        >
          도구 <span aria-hidden="true">{toolsOpen ? '▴' : '▾'}</span>
        </button>
        <ZoomControls total={total} />
        <PrintButton />
        <ReviewBadge review={review} />
        <CurrentHint />
        {/* 오른쪽 끝 슬롯 — 리더 통합 시 <FlowToggle />(D 담당, ⚡ 흐름)·<SupplyPill />(E 담당, 수급 알약)을 이 안에 넣는다 */}
        <div className="dtool__end" data-testid="dtool-end">
          <FlowToggle />
          {/* 계획·시장 지표는 '보기 옵션'으로 묶음 (2026-11-23 UX 토론) */}
          <ViewOptions />
          <SupplyPill />
        </div>
      </div>
    </div>
  );
}
