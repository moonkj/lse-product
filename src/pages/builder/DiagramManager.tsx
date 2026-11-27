/**
 * 단선도 목록 정리 (2026-11-27) — 이 브라우저에 쌓인 단선도를 한 번에 골라 지운다.
 * 같은 이름이 여러 개면 첫 번째(지금 보는 것이 있으면 그것)만 남기고 나머지를 미리 골라 둔다. 지우기 전 한 번 더 확인.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDrawStore } from '../../lib/draw/store';

interface Props {
  onClose: (removed: number) => void;
}

export default function DiagramManager({ onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const { order, diagrams, currentId } = useDrawStore();
  // 같은 이름 중 남길 것: 지금 보는 것 > 먼저 만든 것
  const initial = useMemo(() => {
    const keepByName = new Map<string, string>();
    for (const id of order) {
      const n = diagrams[id].name;
      if (!keepByName.has(n) || id === currentId) keepByName.set(n, id);
    }
    return new Set(order.filter((id) => keepByName.get(diagrams[id].name) !== id));
    // 열 때 한 번만 계산
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [picked, setPicked] = useState<Set<string>>(initial);
  useEffect(() => {
    const dlg = ref.current;
    if (dlg && !dlg.open) dlg.showModal?.();
  }, []);
  const nameCount = new Map<string, number>();
  for (const id of order) nameCount.set(diagrams[id].name, (nameCount.get(diagrams[id].name) ?? 0) + 1);
  const seen = new Map<string, number>();
  const toggle = (id: string) => setPicked((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const all = picked.size === order.length;
  const remove = () => {
    if (!picked.size) return;
    if (!window.confirm(`단선도 ${picked.size}개를 지울까요? 이 브라우저에서 없어지며 되돌릴 수 없습니다.`)) return;
    const st = useDrawStore.getState();
    for (const id of picked) st.remove(id);
    ref.current?.close();
    onClose(picked.size);
  };
  return (
    <dialog ref={ref} className="pnl drw-mgr" aria-labelledby="drw-mgr-title" onClose={() => onClose(0)} data-testid="draw-manager">
      <div className="drw-mgr__head">
        <h2 id="drw-mgr-title">단선도 목록 정리</h2>
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => ref.current?.close()} aria-label="닫기">
          닫기
        </button>
      </div>
      <p className="drw-mgr__desc">이 브라우저에 저장된 단선도입니다. 같은 이름이 여러 개면 첫 번째(지금 보는 것)만 남기고 나머지를 미리 골라 두었습니다. 지울 것만 체크하세요.</p>
      <ul className="drw-mgr__list">
        {order.map((id) => {
          const d = diagrams[id];
          const k = (seen.get(d.name) ?? 0) + 1;
          seen.set(d.name, k);
          const dup = (nameCount.get(d.name) ?? 0) > 1;
          return (
            <li key={id}>
              <label className="drw-mgr__row">
                <input type="checkbox" checked={picked.has(id)} onChange={() => toggle(id)} data-testid="draw-manager-check" />
                <span className="drw-mgr__name">{d.name}</span>
                {dup && <span className="drw-mgr__tag">같은 이름 {k}번째</span>}
                {id === currentId && <span className="drw-mgr__tag drw-mgr__tag--cur">지금 보는 것</span>}
                <span className="drw-mgr__meta">상자 {d.nodes.length}개 · 선 {d.edges.length}개</span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="drw-mgr__foot">
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => setPicked(all ? new Set() : new Set(order))}>
          {all ? '모두 해제' : '모두 선택'}
        </button>
        <button type="button" className="btn btn--primary btn--sm" disabled={!picked.size} onClick={remove} data-testid="draw-manager-remove">
          선택한 {picked.size}개 지우기
        </button>
      </div>
    </dialog>
  );
}
