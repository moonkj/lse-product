import { Link, useLocation } from 'react-router-dom';
import { getDiagramModel } from '../../lib/diagram/model';
import { useUiStore } from '../../store/useUiStore';

/** 예시로 보여 줄 기기 (진공차단기 VCB — 보유 제품이 많은 대표 기기). 없으면 첫 기기 */
const EXAMPLE_NODE = 'n-vcb';

function exampleNode(): { id: string; label: string } | null {
  const model = getDiagramModel();
  const node = model.nodeById.get(EXAMPLE_NODE) ?? model.nodes[0];
  if (!node) return null;
  return { id: node.id, label: node.eq.abbr ?? node.eq.name };
}

/** 시작 카드를 보여 줄지: 쿼리·경로 없는 주소로 처음 열었고, 아직 닫지 않았고, 계통도(/)에 있을 때 */
export function useStartCardVisible(): boolean {
  const { pathname } = useLocation();
  const entryClean = useUiStore((s) => s.entryClean);
  const dismissed = useUiStore((s) => s.startCardDismissed);
  return entryClean && !dismissed && pathname === '/';
}

/**
 * 첫 방문 시작 카드 (C4). 계통도 위 줄에 놓이는 비모달 안내 — 계통도를 덮지 않고, 포커스를 빼앗거나 가두지 않는다.
 * 안내 링크 2개(기기·공백 표) + 검색 안내 문구. 교육 투어 링크는 교육 탭 제거(2026-11-18 사용자 결정)로 삭제.
 * 닫기·Esc·안내 링크 사용 → localStorage 에 기록해 다시 뜨지 않음. 모바일은 1줄 배너(CSS).
 */
export default function StartCard() {
  const dismiss = useUiStore((s) => s.dismissStartCard);
  const ex = exampleNode();

  const close = () => {
    dismiss();
    // 카드가 사라지며 포커스를 잃지 않도록 계통도로 옮긴다
    requestAnimationFrame(() => (document.getElementById('diagram-viewport') ?? document.getElementById('main'))?.focus());
  };

  return (
    <section
      className="start-card"
      aria-labelledby="start-card-title"
      data-testid="start-card"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          close();
        }
      }}
    >
      <h2 id="start-card-title" className="start-card__title">
        처음이세요?
      </h2>
      <ul className="start-card__list">
        {ex && (
          <li>
            <Link to={`/?node=${ex.id}`} className="start-card__link" data-testid="start-card-device" onClick={dismiss}>
              <b>기기를 눌러 보세요</b>
              <span className="start-card__sub">· 예: {ex.label}</span>
            </Link>
          </li>
        )}
        <li>
          <Link to="/gap" className="start-card__link" data-testid="start-card-gap" onClick={dismiss}>
            <b>공백 표</b>
            <span className="start-card__sub">· 계층×기능 커버리지</span>
          </Link>
        </li>
        <li className="start-card__hint" data-testid="start-card-hint">
          검색창에 모델명(예: TS250)을 입력해 보세요
        </li>
      </ul>
      <button type="button" className="start-card__close" aria-label="시작 안내 닫기" data-testid="start-card-close" onClick={close}>
        <span aria-hidden="true">✕</span>
      </button>
    </section>
  );
}
