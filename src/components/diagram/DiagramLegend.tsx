import { useId, useState } from 'react';
import { COVERAGES, type Coverage } from '../../lib/schema';
import { COVERAGE_LABELS, isDimmedCoverage } from '../../lib/labels';
import { getDiagramModel } from '../../lib/diagram/model';
import { MOBILE_QUERY, useMediaQuery, type ViewMode } from '../../lib/diagram/url';
import { useCompactState } from '../layout/shellLayout';
import { announce } from '../../lib/announce';
import CoverageBadge from '../common/CoverageBadge';

/** 데스크톱에서 사용자가 직접 접었을 때만 기억 (디자인 토론 P0-2 — 데스크톱 기본 펼침) */
const COLLAPSE_KEY = 'lse-legend-collapsed-v1';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(v: boolean) {
  try {
    if (v) localStorage.setItem(COLLAPSE_KEY, '1');
    else localStorage.removeItem(COLLAPSE_KEY);
  } catch {
    /* 저장 불가(사생활 보호 창 등) — 이번 화면에서만 유지 */
  }
}

/**
 * 계통도 범례 카드 — 캔버스 왼쪽 아래 도킹 (디자인 토론 P0-2).
 * 데스크톱: 커버리지 6종(아이콘·이름·개수) 한 줄을 늘 펼침(접기 없음), "선 종류 ▾"만 접힘(선 4종 + 참조 표시 + 공백 후보/확정 테두리).
 * 모바일·압축 화면: 기본 접힘 "범례" 버튼.
 * 커버리지 항목 = aria-pressed 버튼 → 누르면 그 상태 타일만 또렷하게(나머지는 Gap 보기 흐림과 같은 규칙, CSS :has).
 */
export default function DiagramLegend({ mode }: { mode: ViewMode }) {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const { compact } = useCompactState();
  const collapsedByDefault = isMobile || compact;
  const model = getDiagramModel();
  const counts = model.coverageCounts;
  const gap = mode === 'gap';
  const linesId = useId();

  // null = 사용자 조작 없음 → 화면 크기 기본값을 따름. 데스크톱 접힘만 저장값을 씀
  // 데스크톱은 접기 버튼이 없어 늘 펼침(예전에 접어 둔 저장값도 무시). 모바일·압축 화면은 기본 접힘
  const [userOpen, setUserOpen] = useState<boolean | null>(() => (readCollapsed() ? false : null));
  const collapsed = collapsedByDefault ? (userOpen === null ? true : !userOpen) : false;
  const [linesOpen, setLinesOpen] = useState(false);
  const [focus, setFocus] = useState<Coverage | null>(null);

  const setOpen = (open: boolean) => {
    setUserOpen(open);
    if (!collapsedByDefault) writeCollapsed(!open);
  };

  const toggleFocus = (c: Coverage) => {
    const next = focus === c ? null : c;
    setFocus(next);
    announce(next ? `${COVERAGE_LABELS[c]} 기기 강조` : '강조 해제');
  };

  if (collapsed) {
    return (
      <div className="dlegend dlegend--collapsed" data-testid="legend-card" data-diagram-obscures="">
        <button
          type="button"
          className="dlegend__open"
          data-testid="legend-toggle"
          aria-expanded="false"
          onClick={() => setOpen(true)}
        >
          범례 <span aria-hidden="true">▴</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="dlegend"
      data-testid="legend-card"
      data-focus={focus ?? undefined}
      data-diagram-obscures=""
      role="group"
      aria-label="범례"
    >
      <div className="dlegend__row">
        <ul className="dlegend__list" aria-label="커버리지 범례" data-testid="legend">
          {COVERAGES.map((c) => {
            const faded = gap && isDimmedCoverage(c);
            return (
              <li
                key={c}
                className={`dlegend__item${faded ? ' dlegend__item--faded' : ''}`}
                data-testid={`legend-item-${c}`}
              >
                <button
                  type="button"
                  className="dlegend__btn"
                  aria-pressed={focus === c}
                  title={focus === c ? '강조 해제' : `${COVERAGE_LABELS[c]} 기기만 강조`}
                  onClick={() => toggleFocus(c)}
                >
                  <CoverageBadge coverage={c} variant="icon" />
                  <span className="dlegend__label">{COVERAGE_LABELS[c]}</span>
                  <span className="visually-hidden">&nbsp;</span>
                  <span className="dlegend__count">{counts[c]}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <span className="dlegend__divider" aria-hidden="true" />
        <button
          type="button"
          className="dlegend__lines-btn"
          data-testid="legend-lines-toggle"
          aria-expanded={linesOpen}
          aria-controls={linesId}
          onClick={() => setLinesOpen((v) => !v)}
        >
          선 종류 <span aria-hidden="true">{linesOpen ? '▴' : '▾'}</span>
        </button>
        {/* 데스크톱은 늘 펼침 — 끝의 뜻 없는 '▾'(접기) 제거 (E5 P0). 기본 접힘 화면(모바일·압축)만 글자 '접기' 버튼 */}
        {collapsedByDefault && (
          <button
            type="button"
            className="dlegend__close"
            data-testid="legend-collapse"
            aria-expanded="true"
            aria-label="범례 접기"
            onClick={() => setOpen(false)}
          >
            접기
          </button>
        )}
      </div>
      {linesOpen && (
        <div className="dlegend__more" id={linesId}>
          <ul className="dlegend__lines" aria-label="선 범례">
            <li>
              <span className="dlegend__sw dlegend__sw--power" aria-hidden="true" />
              전력선
            </li>
            <li>
              <span className="dlegend__sw dlegend__sw--signal" aria-hidden="true" />
              신호선 (점선)
            </li>
            <li>
              <span className="dlegend__sw dlegend__sw--bus" aria-hidden="true" />
              모선
            </li>
            <li>
              <span className="dlegend__sw dlegend__sw--power" aria-hidden="true" />
              <span className="dlegend__chip" aria-hidden="true">
                택1
              </span>
              택1 연결 (어느 하나)
            </li>
            <li>
              <span className="dlegend__ref" aria-hidden="true">
                ↗
              </span>
              참조 타일 (같은 기기 재등장)
            </li>
          </ul>
          <p className="dlegend__conf" data-testid="legend-confidence">
            <span className="dlegend__conf-box dlegend__conf-box--candidate" aria-hidden="true" /> 공백 후보
            <span className="dlegend__conf-box dlegend__conf-box--confirmed" aria-hidden="true" /> 공백 확정
          </p>
        </div>
      )}
    </div>
  );
}
