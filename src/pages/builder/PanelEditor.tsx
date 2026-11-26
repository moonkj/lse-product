/**
 * 반 안 구성 편집기 (분전반·저압 배전반·MCC·특고압 수배전반) — 2026-11-26
 * 위: 반 안 결선도 (주차단기 → 모선 → 분기 회로). 아래: 회로표 — 회로명·기기·제품·프레임·정격전류·극수·수량.
 * 분기 회로가 주차단기보다 크거나, 고른 정격이 제품·프레임 범위 밖이면 이유와 고치기.
 */
import { useEffect, useRef, useState } from 'react';
import { getData, type SpecsMap } from '../../data/load';
import { announce } from '../../lib/announce';
import { candidateProducts } from '../../lib/builder/validate';
import { eqName, panelTypeById, voltageLabel, type DNode, type Diagram, type PanelItem } from '../../lib/draw/model';
import { addItems, fillProducts, moveItem, removeItem, setItemQty, updateItem, updateNode } from '../../lib/draw/ops';
import { POLED_EQ, RATED_EQ, ampsOptions, itemSpecText, variantFor, variantOptions } from '../../lib/draw/ratings';
import type { DFix, DIssue } from '../../lib/draw/validate';

interface Props {
  d: Diagram;
  n: DNode;
  specs?: SpecsMap;
  issues: DIssue[];
  onCommit: (d: Diagram, say?: string) => void;
  onApply: (f: DFix, say?: string) => void;
  onClose: () => void;
}

const abbr = (eq: string) => getData().equipmentTypeById.get(eq)?.abbr ?? eqName(eq);

export default function PanelEditor({ d, n, specs, issues, onCommit, onApply, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const pt = panelTypeById(n.eq)!;
  const items = n.items ?? [];
  const mainIdx = items.findIndex((i) => pt.main.includes(i.eq));
  const branchEqs = pt.accepts.filter((a) => !pt.main.includes(a) || pt.id === 'panelboard' || pt.id === 'mcc');
  const [addEq, setAddEq] = useState(branchEqs.find((e) => RATED_EQ.has(e) && !pt.main.includes(e)) ?? branchEqs[0]);
  const [addCount, setAddCount] = useState(1);
  const list = issues.filter((i) => i.node === n.id && i.severity !== 'info');

  useEffect(() => {
    const dlg = ref.current;
    if (dlg && !dlg.open) dlg.showModal?.();
  }, []);

  const set = (it: PanelItem, patch: Partial<PanelItem>) => onCommit(updateItem(d, n.id, it.id, patch));
  const fillThis = () => {
    const filled = fillProducts(d, specs);
    const mine = filled.nodes.find((x) => x.id === n.id);
    if (mine) onCommit(updateNode(d, n.id, { product: mine.product, items: mine.items }), '이 반의 비어 있는 제품·정격을 채웠습니다');
  };

  return (
    <dialog ref={ref} className="pnl" aria-labelledby="pnl-title" onClose={onClose} data-testid="panel-editor">
      <div className="pnl__head">
        <div>
          <h2 id="pnl-title" className="pnl__title">
            {n.label ?? pt.label} <small>반 안 구성</small>
          </h2>
          <p className="pnl__meta">
            {pt.label} · {voltageLabel(n.v)} · {items.length}종 {items.reduce((s, i) => s + (i.qty ?? 1), 0)}개
          </p>
        </div>
        <div className="pnl__head-actions">
          <button type="button" className="btn btn--secondary btn--sm" onClick={fillThis} disabled={!specs} data-testid="panel-fill">
            이 반 제품·정격 채우기
          </button>
          <button type="button" className="pnl__close" onClick={() => ref.current?.close()} aria-label="반 안 구성 닫기" data-testid="panel-close">
            ×
          </button>
        </div>
      </div>

      <div className="pnl__body">
        <section className="pnl__sld" aria-label="반 안 결선도">
          <InnerDiagram items={items} mainIdx={mainIdx} specs={specs} voltage={voltageLabel(n.v)} issues={issues.filter((i) => i.node === n.id && i.severity !== 'info')} />
        </section>

        {list.length > 0 && (
          <ul className="bld-issues pnl__issues" data-testid="panel-issues">
            {list.map((i) => (
              <li key={i.key} className={`bld-issue bld-issue--${i.severity}`} data-rule={i.rule}>
                <span className="bld-issue__icon" aria-hidden="true">
                  {i.severity === 'error' ? '⛔' : '⚠'}
                </span>
                <span className="visually-hidden">{i.severity === 'error' ? '규칙에 맞지 않음: ' : '확인 필요: '}</span>
                <span className="bld-issue__msg">{i.message}</span>
                {i.fix && (
                  <span className="bld-issue__actions">
                    <button type="button" className="bld-fix" onClick={() => onApply(i.fix!.fix, `제안대로 고쳤습니다: ${i.fix!.label}`)} data-testid="panel-fix">
                      {i.fix.label}
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="pnl__tablewrap">
          <table className="pnl__table" data-testid="panel-table">
            <caption className="visually-hidden">회로표</caption>
            <thead>
              <tr>
                <th scope="col">No</th>
                <th scope="col">회로명</th>
                <th scope="col">기기</th>
                <th scope="col">제품</th>
                <th scope="col">프레임·형식</th>
                <th scope="col">정격전류</th>
                <th scope="col">극수</th>
                <th scope="col">수량</th>
                <th scope="col">
                  <span className="visually-hidden">순서·빼기</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const isMain = idx === mainIdx;
                const products = candidateProducts(it.eq);
                const variants = variantOptions(it.product, specs);
                const rated = RATED_EQ.has(it.eq);
                // 정격은 제품 전체 범위에서 고르고, 고른 정격을 못 내는 프레임이면 맞는 프레임으로 바뀐다
                const amps = rated ? ampsOptions(it.product, undefined, specs) : [];
                const own = issues.filter((i) => i.node === n.id && i.item === it.id && i.severity !== 'info');
                const bad = own.some((i) => i.severity === 'error') ? 'error' : own.length ? 'warn' : undefined;
                const branchNo = items.slice(0, idx + 1).filter((_x, k) => k !== mainIdx).length;
                return (
                  <tr key={it.id} className={`${isMain ? 'is-main' : ''}${bad ? ` is-${bad}` : ''}`} data-testid={`panel-row-${idx}`}>
                    <td className="pnl__no">{isMain ? <span className="drw-item__tag">주</span> : branchNo}</td>
                    <td>
                      <input
                        aria-label={`${idx + 1}행 회로명`}
                        value={it.name ?? ''}
                        placeholder={isMain ? '주차단기' : '회로명'}
                        maxLength={30}
                        onChange={(e) => set(it, { name: e.target.value || undefined })}
                        data-testid="panel-name"
                      />
                    </td>
                    <td>
                      <select aria-label={`${idx + 1}행 기기`} value={it.eq} onChange={(e) => set(it, { eq: e.target.value, product: undefined, variant: undefined })} data-testid="panel-eq">
                        {[...new Set([it.eq, ...pt.accepts])].map((id) => (
                          <option key={id} value={id}>
                            {eqName(id)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {products.length ? (
                        <select
                          aria-label={`${idx + 1}행 제품`}
                          value={it.product ?? ''}
                          onChange={(e) => {
                            const product = e.target.value || undefined;
                            set(it, { product, variant: product ? variantFor(product, it.amps, specs)?.id : undefined });
                          }}
                          data-testid="panel-product"
                        >
                          <option value="">(제품 고르기)</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="pnl__none">자사 제품 없음</span>
                      )}
                    </td>
                    <td>
                      {variants.length ? (
                        <select aria-label={`${idx + 1}행 프레임`} value={it.variant ?? ''} onChange={(e) => set(it, { variant: e.target.value || undefined })} data-testid="panel-variant">
                          <option value="">(프레임 고르기)</option>
                          {variants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="pnl__none">{it.product ? '정보 없음' : '—'}</span>
                      )}
                    </td>
                    <td>
                      {rated ? (
                        <select
                          aria-label={`${idx + 1}행 정격전류`}
                          value={it.amps ?? ''}
                          onChange={(e) => {
                            const a = Number(e.target.value) || undefined;
                            // 프레임이 그 정격을 못 내면 맞는 프레임으로 같이 바꾼다
                            const v = a && it.product && it.variant && !ampsOptions(it.product, it.variant, specs).includes(a) ? variantFor(it.product, a, specs)?.id : it.variant;
                            set(it, { amps: a, variant: v ?? it.variant });
                          }}
                          data-testid="panel-amps"
                        >
                          <option value="">(A)</option>
                          {[...new Set([...(it.amps && !amps.includes(it.amps) ? [it.amps] : []), ...amps])].sort((a, b) => a - b).map((a) => (
                            <option key={a} value={a}>
                              {a}A
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="pnl__none">—</span>
                      )}
                    </td>
                    <td>
                      {POLED_EQ.has(it.eq) ? (
                        <select aria-label={`${idx + 1}행 극수`} value={it.poles ?? ''} onChange={(e) => set(it, { poles: (Number(e.target.value) || undefined) as PanelItem['poles'] })} data-testid="panel-poles">
                          <option value="">-</option>
                          {[1, 2, 3, 4].map((p) => (
                            <option key={p} value={p}>
                              {p}P
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="pnl__none">—</span>
                      )}
                    </td>
                    <td>
                      <input
                        type="number"
                        className="pnl__qty"
                        min={1}
                        max={99}
                        aria-label={`${idx + 1}행 수량`}
                        value={it.qty ?? 1}
                        onChange={(e) => onCommit(setItemQty(d, n.id, it.id, Number(e.target.value) || 1))}
                        data-testid="panel-qty"
                      />
                    </td>
                    <td className="pnl__tools">
                      <button type="button" aria-label={`${idx + 1}행 위로`} disabled={idx === 0} onClick={() => onCommit(moveItem(d, n.id, it.id, -1))}>
                        ↑
                      </button>
                      <button type="button" aria-label={`${idx + 1}행 아래로`} disabled={idx === items.length - 1} onClick={() => onCommit(moveItem(d, n.id, it.id, 1))}>
                        ↓
                      </button>
                      <button type="button" aria-label={`${idx + 1}행 빼기`} onClick={() => onCommit(removeItem(d, n.id, it.id), `${it.name || eqName(it.eq)}을(를) 뺐습니다`)} data-testid="panel-remove">
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="pnl__add">
          <label>
            넣을 기기
            <select value={addEq} onChange={(e) => setAddEq(e.target.value)} data-testid="panel-add-eq">
              {pt.accepts.map((id) => (
                <option key={id} value={id}>
                  {eqName(id)}
                </option>
              ))}
            </select>
          </label>
          <label>
            회로 수
            <input type="number" min={1} max={48} value={addCount} onChange={(e) => setAddCount(Math.max(1, Math.min(48, Number(e.target.value) || 1)))} data-testid="panel-add-count" />
          </label>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => {
              // 같은 기기를 이미 넣었으면 그 제품·프레임을 이어 쓴다
              const prev = [...items].reverse().find((i) => i.eq === addEq && i.product);
              const base = prev ? { product: prev.product, variant: prev.variant } : undefined;
              onCommit(addItems(d, n.id, addEq, addCount, base), `${eqName(addEq)} ${addCount}회로를 넣었습니다`);
              announce(`${addCount}회로 추가`);
            }}
            data-testid="panel-add"
          >
            ＋ 회로 넣기
          </button>
          <span className="pnl__hint">회로마다 회로명·제품·프레임·정격·극수를 고르세요. 정격을 고르면 그 정격을 내는 프레임으로 맞춰집니다.</span>
        </div>
      </div>
    </dialog>
  );
}

/** 반 안 결선도 — 주차단기 → 모선 → 분기 회로 (회로마다 기기·정격·회로명) */
function InnerDiagram({ items, mainIdx, specs, voltage, issues }: { items: PanelItem[]; mainIdx: number; specs?: SpecsMap; voltage: string; issues: DIssue[] }) {
  const main = mainIdx >= 0 ? items[mainIdx] : undefined;
  const branches = items.filter((_, k) => k !== mainIdx);
  const colW = 112;
  const width = Math.max(360, branches.length * colW + 40);
  const cx = width / 2;
  const sev = (it?: PanelItem) => (it ? (issues.some((i) => i.item === it.id && i.severity === 'error') ? 'error' : issues.some((i) => i.item === it.id) ? 'warn' : '') : '');
  const box = (it: PanelItem, x: number, y: number, w: number) => {
    const s = sev(it);
    const spec = [it.amps ? `${it.amps}A` : '', it.poles ? `${it.poles}P` : ''].filter(Boolean).join(' ');
    const p = it.product ? getData().productById.get(it.product)?.name : undefined;
    return (
      <g>
        <rect x={x} y={y} width={w} height={54} rx={6} className={`pnl-box${s ? ` pnl-box--${s}` : ''}`} />
        <text x={x + w / 2} y={y + 18} textAnchor="middle" className="pnl-t1">
          {abbr(it.eq)}
          {it.qty && it.qty > 1 ? ` ×${it.qty}` : ''}
        </text>
        <text x={x + w / 2} y={y + 33} textAnchor="middle" className="pnl-t2">
          {spec || '정격 미선택'}
        </text>
        <text x={x + w / 2} y={y + 47} textAnchor="middle" className="pnl-t3">
          {(p ?? '').slice(0, 14)}
        </text>
      </g>
    );
  };
  const busY = main ? 118 : 30;
  return (
    <div className="pnl__sldscroll">
      <svg width={width} height={busY + 160} role="img" aria-label={`반 안 결선도: 주차단기 ${main ? abbr(main.eq) : '없음'}, 분기 ${branches.length}회로`} data-testid="panel-sld">
        <text x={8} y={16} className="pnl-t2">
          {voltage} 인입
        </text>
        {main && (
          <>
            <line x1={cx} y1={4} x2={cx} y2={24} className="pnl-line" />
            {box(main, cx - 70, 24, 140)}
            <line x1={cx} y1={78} x2={cx} y2={busY} className="pnl-line" />
            <text x={cx + 76} y={44} className="pnl-t2">
              주차단기
            </text>
            {main.variant && (
              <text x={cx + 76} y={60} className="pnl-t3">
                {itemSpecText(main, specs).split(' · ')[0]}
              </text>
            )}
          </>
        )}
        <rect x={16} y={busY} width={width - 32} height={6} rx={2} className="pnl-bus" />
        {branches.map((it, k) => {
          const x = 20 + k * colW + (colW - 100) / 2;
          const mx = x + 50;
          return (
            <g key={it.id}>
              <line x1={mx} y1={busY + 6} x2={mx} y2={busY + 30} className="pnl-line" />
              {box(it, x, busY + 30, 100)}
              <line x1={mx} y1={busY + 84} x2={mx} y2={busY + 104} className="pnl-line" />
              <text x={mx} y={busY + 120} textAnchor="middle" className="pnl-t2">
                {(it.name ?? '').slice(0, 9) || '—'}
              </text>
            </g>
          );
        })}
        {!branches.length && (
          <text x={cx} y={busY + 50} textAnchor="middle" className="pnl-t2">
            분기 회로가 없습니다. 아래에서 회로를 넣으세요.
          </text>
        )}
      </svg>
    </div>
  );
}
