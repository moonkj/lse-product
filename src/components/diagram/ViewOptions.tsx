import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlanStore } from '../../lib/market/planStore';
import { announce } from '../../lib/announce';

/**
 * 도구줄 [보기 옵션 ▾] — 계획 겹쳐 보기·전력시장 지표를 한 버튼으로 (2026-11-23 UX 토론: 도구줄이 넘쳐 선택 영역 칩·안내가 잘림).
 * 흐름(⚡)은 영업 미팅에서 자주 눌러 밖에 둔다. 계획이 켜져 있으면 버튼에 점 표시.
 * 열면 첫 항목으로 포커스, Esc·바깥 누르기로 닫힘 (포커스는 버튼으로 돌아옴).
 */
export default function ViewOptions() {
  const planOn = usePlanStore((s) => s.on);
  const setPlanOn = usePlanStore((s) => s.setOn);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    firstRef.current?.focus();
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // 상세 패널 등 다른 Esc 처리(선택 해제)가 함께 돌지 않게 여기서 멈춤
        e.stopPropagation();
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <div className="dopts" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className="dflow-toggle dopts__btn"
        aria-expanded={open}
        aria-controls={panelId}
        data-testid="view-options"
        title="보기 옵션 — 계획 겹쳐 보기, 전력시장 지표"
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">☰</span>
        <span className="dflow-toggle__label"> 보기 옵션</span>
        {planOn && (
          <>
            <span className="dopts__dot" aria-hidden="true" />
            <span className="visually-hidden"> (계획 켜짐)</span>
          </>
        )}
        <span className="dopts__caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div id={panelId} className="dopts__panel" data-testid="view-options-panel">
          <button
            ref={firstRef}
            type="button"
            className="dopts__item"
            role="switch"
            aria-checked={planOn}
            data-testid="plan-toggle"
            onClick={() => {
              setPlanOn(!planOn);
              announce(planOn ? '계획 기반 설비 소요 끔' : '계획 기반 설비 소요 켬');
            }}
          >
            <span className="dopts__icon" aria-hidden="true">▤</span>
            <span className="dopts__text">
              계획 기반 설비 소요
              <small>송변전·전력수급 계획 물량을 계통도에 겹쳐 보기</small>
            </span>
            <span className={`dopts__state${planOn ? ' is-on' : ''}`} aria-hidden="true">
              {planOn ? '켬' : '끔'}
            </span>
          </button>
          <Link to="/market" className="dopts__item" data-testid="market-link" onClick={() => setOpen(false)}>
            <span className="dopts__icon" aria-hidden="true">📈</span>
            <span className="dopts__text">
              전력시장 지표
              <small>연간 수요·설비·전원믹스 추이 화면</small>
            </span>
            <span className="dopts__state" aria-hidden="true">→</span>
          </Link>
        </div>
      )}
    </div>
  );
}
