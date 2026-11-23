import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useUiStore } from '../../store/useUiStore';
import './guide.css';

/**
 * 첫 화면 길잡이 — 말풍선 3단계 (2026-11-23 페르소나 토론 1단계 과제, 사용자 요청).
 * 예전 '처음이세요?' 띠는 계통도 세로 공간을 먹어 없앴으므로(디자이너 토론 P0-6), 이번에는 배치를 밀지 않는
 * 떠 있는 말풍선으로 해당 버튼을 가리킨다. 계통도를 가리지 않도록 어둡게 덮지 않고 대상만 테두리로 강조.
 * 처음 주소로 처음 온 사람에게만 자동으로 열리고, 닫으면 다시 안 뜬다. 헤더 '사용법' 버튼으로 다시 연다.
 */
interface Step {
  /** 가리킬 요소 (여럿이면 처음 보이는 것). 못 찾으면 화면 아래 가운데 */
  target: string;
  title: string;
  body: string;
}

export const GUIDE_STEPS: Step[] = [
  {
    target: '[data-testid="preset-trigger"]',
    title: '수요처부터 고르세요',
    body: '데이터센터·반도체·병원 같은 수요처를 고르면 그 현장에 필요한 기기가 계통도에 표시되고, 필수·이중화·선택이 구분됩니다.',
  },
  {
    target: '.dnode[data-coverage]',
    title: '기기를 눌러 보세요',
    body: '기기 상자를 누르면 오른쪽에 역할·선정 포인트와 자사 제품이 나옵니다. 아래 범례에서 보유·미보유를 누르면 해당 기기만 또렷하게 보입니다.',
  },
  {
    target: '[data-testid="view-switch"]',
    title: '보는 방식을 바꿔 보세요',
    body: '계통맵·단계별로 바꿔 보거나, 옆의 계통 선택에서 국내 표준·데이터센터(국내)를 고를 수 있습니다. 모델명은 위 검색창에서 바로 찾습니다.',
  },
];

const GAP = 12;
const POP_W = 320;

function visible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
}

function findTarget(sel: string): Element | null {
  return [...document.querySelectorAll(sel)].find(visible) ?? null;
}

type Place = { top: number; left: number; ring: DOMRect | null; above: boolean };

function placeFor(el: Element | null, popH: number): Place {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(POP_W, vw - 32);
  if (!el) return { top: vh - popH - 24, left: (vw - w) / 2, ring: null, above: false };
  const r = el.getBoundingClientRect();
  const below = r.bottom + GAP + popH <= vh - 8;
  const top = below ? r.bottom + GAP : Math.max(8, r.top - GAP - popH);
  const left = Math.min(Math.max(16, r.left + r.width / 2 - w / 2), vw - w - 16);
  return { top, left, ring: r, above: !below };
}

export default function FirstGuide() {
  const open = useUiStore((s) => s.guideOpen);
  const close = useUiStore((s) => s.closeGuide);
  const [step, setStep] = useState(0);
  const [place, setPlace] = useState<Place | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const measure = useCallback(() => {
    const s = GUIDE_STEPS[step];
    setPlace(placeFor(findTarget(s.target), popRef.current?.offsetHeight ?? 180));
  }, [step]);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    // 계통도가 막 그려지는 중이면 대상 위치가 늦게 정해진다 → 잠시 뒤 한 번 더
    const t = window.setTimeout(measure, 300);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    // 계통도가 그려지며 포커스를 옮기는 경우가 있어 한 박자 뒤에 '다음' 버튼으로
    const t = window.setTimeout(() => nextRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;
  const s = GUIDE_STEPS[step];
  const last = step === GUIDE_STEPS.length - 1;
  return (
    <>
      {place?.ring && (
        <div
          className="fguide__ring"
          aria-hidden="true"
          style={{ top: place.ring.top - 4, left: place.ring.left - 4, width: place.ring.width + 8, height: place.ring.height + 8 }}
        />
      )}
      <div
        ref={popRef}
        className={`fguide${place?.above ? ' fguide--above' : ''}`}
        role="dialog"
        aria-modal="false"
        aria-labelledby="fguide-title"
        aria-describedby="fguide-body"
        data-testid="first-guide"
        data-step={step + 1}
        style={place ? { top: place.top, left: place.left } : { visibility: 'hidden' }}
      >
        <p className="fguide__count">
          사용법 {step + 1}/{GUIDE_STEPS.length}
        </p>
        <h2 id="fguide-title" className="fguide__title">
          {s.title}
        </h2>
        <p id="fguide-body" className="fguide__body">
          {s.body}
        </p>
        <div className="fguide__actions">
          <button type="button" className="fguide__skip" onClick={close} data-testid="first-guide-close">
            {last ? '닫기' : '건너뛰기'}
          </button>
          <span className="fguide__spacer" />
          {step > 0 && (
            <button type="button" className="fguide__btn" onClick={() => setStep((v) => v - 1)} data-testid="first-guide-prev">
              이전
            </button>
          )}
          <button
            ref={nextRef}
            type="button"
            className="fguide__btn fguide__btn--primary"
            onClick={() => (last ? close() : setStep((v) => v + 1))}
            data-testid="first-guide-next"
          >
            {last ? '시작하기' : '다음'}
          </button>
        </div>
      </div>
    </>
  );
}
