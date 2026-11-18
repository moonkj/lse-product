import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { peekSpecs, useData } from '../../data/load';
import { COMPARE_MAX, compareHref, compareIdInData, splitCompareId, useCompareStore, type CompareKind } from '../../store/useCompareStore';
import { announce } from '../../lib/announce';
import './Compare.css';

const KIND_LABEL: Record<CompareKind, string> = { equipment: '기기', product: '제품' };

/**
 * 담긴 id 중 데이터에 있는 것만 (데이터가 바뀌어 사라진 id 는 조용히 제외).
 * "제품:옵션" 항목 이름은 "제품명 · 옵션 label" — 사양을 아직 안 불러왔으면 옵션 id 로 (옵션 검증은 비교 화면에서)
 */
export function useCompareItems(kind: CompareKind): { id: string; name: string }[] {
  const data = useData();
  const list = useCompareStore((s) => s[kind]);
  return list.flatMap((id) => {
    if (kind === 'equipment') {
      const eq = data.equipmentTypeById.get(id);
      return eq ? [{ id, name: eq.abbr ? `${eq.name} (${eq.abbr})` : eq.name }] : [];
    }
    if (!compareIdInData('product', id, data)) return [];
    const { baseId, variantId } = splitCompareId(id);
    const p = data.productById.get(baseId)!;
    if (!variantId) return [{ id, name: p.name }];
    const label = peekSpecs()?.get(baseId)?.variants?.find((v) => v.id === variantId)?.label ?? variantId;
    return [{ id, name: `${p.name} · ${label}` }];
  });
}

/** 비교 바를 보일지 — 담긴 항목이 있고 비교 화면이 아닐 때 */
export function useCompareTrayVisible(): boolean {
  const { pathname } = useLocation();
  const eq = useCompareItems('equipment').length;
  const pr = useCompareItems('product').length;
  // '/compare/' (끝 슬래시)도 비교 화면
  return pathname.replace(/\/+$/, '') !== '/compare' && eq + pr > 0;
}

/**
 * 바의 실제 높이를 CSS 변수 --cmp-tray-h 로 내보낸다 (문서 루트). 본문 아래 여백·계통도 미니맵 위치가 이 값을 쓴다
 * — 고정 여백(140px)이 칩 줄 수에 따라 모자라 마지막 링크를 가리던 문제(디버그 M2). ResizeObserver 가 없으면 CSS 기본값.
 */
function useTrayHeightVar(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    if (!active || !el) return;
    const apply = () => root.style.setProperty('--cmp-tray-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    apply();
    const RO = globalThis.ResizeObserver;
    const ro = RO ? new RO(apply) : undefined;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty('--cmp-tray-h');
    };
  }, [ref, active]);
}

/**
 * 화면 하단 고정 비교 바. 기기·제품 목록이 둘 다 있으면 위쪽 전환 버튼으로 한 목록씩 보인다.
 * 모바일 하단 시트가 열리면 시트 위로 올라가고, 시트를 펼치면 숨는다 (Compare.css).
 */
export default function CompareTray() {
  const visible = useCompareTrayVisible();
  const eqItems = useCompareItems('equipment');
  const prItems = useCompareItems('product');
  const storedActive = useCompareStore((s) => s.active);
  const setActive = useCompareStore((s) => s.setActive);
  const remove = useCompareStore((s) => s.remove);
  const clear = useCompareStore((s) => s.clear);
  const ref = useRef<HTMLElement>(null);
  useTrayHeightVar(ref, visible);
  if (!visible) return null;

  const counts: Record<CompareKind, number> = { equipment: eqItems.length, product: prItems.length };
  const active: CompareKind = counts[storedActive] > 0 ? storedActive : storedActive === 'equipment' ? 'product' : 'equipment';
  const items = active === 'equipment' ? eqItems : prItems;
  const both = counts.equipment > 0 && counts.product > 0;
  const ready = items.length >= 2;

  return (
    <section ref={ref} className="cmp-tray" data-testid="compare-tray" data-type={active} aria-label="비교 목록">
      <div className="cmp-tray__head">
        {both ? (
          <div className="cmp-tray__kinds" role="group" aria-label="비교 목록 종류">
            {(['equipment', 'product'] as const).map((k) => (
              <button
                key={k}
                type="button"
                className="cmp-tray__kind"
                aria-pressed={active === k}
                data-testid={`compare-tray-kind-${k}`}
                onClick={() => setActive(k)}
              >
                {KIND_LABEL[k]} {counts[k]}
                <span className="cmp-tray__count">/{COMPARE_MAX}</span>
              </button>
            ))}
          </div>
        ) : (
          <strong className="cmp-tray__title">
            {KIND_LABEL[active]} 비교 <span className="cmp-tray__count">{items.length}/{COMPARE_MAX}</span>
          </strong>
        )}
      </div>
      <ul className="cmp-tray__items" aria-label={`담긴 ${KIND_LABEL[active]}`}>
        {items.map((it) => (
          <li key={it.id} className="cmp-tray__item" data-testid={`compare-tray-item-${it.id}`}>
            <span className="cmp-tray__name" title={it.name}>
              {it.name}
            </span>
            <button
              type="button"
              className="cmp-tray__remove"
              aria-label={`${it.name} 비교에서 빼기`}
              onClick={() => {
                remove(active, it.id);
                announce(`비교에서 ${it.name} 뺌 (${useCompareStore.getState()[active].length}/${COMPARE_MAX})`);
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="cmp-tray__actions">
        <button type="button" className="cmp-tray__clear" data-testid="compare-clear" onClick={() => {
            clear(active);
            announce(`${KIND_LABEL[active]} 비교 목록을 비웠습니다`);
          }}>
          모두 비우기
        </button>
        {ready ? (
          <Link className="cmp-tray__go" data-testid="compare-go" to={compareHref(active, items.map((i) => i.id))}>
            비교하기 ({items.length})
          </Link>
        ) : (
          <span className="cmp-tray__go is-disabled" data-testid="compare-go" aria-disabled="true">
            1개 더 담으면 비교
          </span>
        )}
      </div>
    </section>
  );
}
