/**
 * 사고 시뮬레이션 — 도구줄 토글 + 결과 패널 (2026-11-27)
 * 켜면 기기를 누를 때 선택 대신: 차단·보호기기는 열기/닫기, 그 밖의 기기는 그 자리 사고(상위 보호기기 트립).
 * 결과: 정전 기기 · 비상 전원으로 버티는 기기 · 동작한 보호기기 · 절체(ALTS·ATS) — 자사 제품으로 무엇이 지켜졌는지까지.
 */
import { useData, resolveProducts } from '../../data/load';
import { getDiagramModel } from '../../lib/diagram/model';
import { useRef } from 'react';
import { FAULT_TYPE_LABEL, SIM_SCENARIOS, altGroups, unusedAltNodes, useSimActions, useSimState, type FaultType } from '../../lib/diagram/sim';
import { useSimGraph } from './useSim';
import TccChart, { tccKindOf } from './TccChart';
import { todayIso } from '../../lib/labels';
import { announce } from '../../lib/announce';
import { useSimResult } from './useSim';
import './sim.css';

export function SimToggle() {
  const { on } = useSimState();
  const { start, stop } = useSimActions();
  return (
    <button
      type="button"
      className="dsim-toggle"
      aria-pressed={on}
      title={on ? '사고 시뮬레이션 끝내기' : '사고 시뮬레이션 — 차단기를 열거나 기기에 사고를 내 정전 범위·비상 공급·보호 동작 보기'}
      data-testid="sim-toggle"
      onClick={() => {
        if (on) stop();
        else start();
        announce(on ? '사고 시뮬레이션 끝' : '사고 시뮬레이션 시작 — 기기를 누르면 사고, 차단기는 열고 닫기');
      }}
    >
      <span aria-hidden="true">⚠</span>
      <span className="dsim-toggle__label"> 사고 시뮬레이션</span>
    </button>
  );
}

/** 시간 표시: 0.02 → '0.02초', 10 → '10초' */
const sec = (t: number) => (t === 0 ? '0초' : t < 1 ? `${+t.toFixed(3)}초` : `${+t.toFixed(1)}초`);

export default function SimPanel() {
  const { on, opened, faults, opts } = useSimState();
  const { stop, reset, setOption, scenario, chooseAlt } = useSimActions();
  const r = useSimResult();
  const graph = useSimGraph();
  const bodyRef = useRef<HTMLDivElement>(null);
  const data = useData();
  const model = getDiagramModel(data);
  if (!on || !r) return null;
  const groups = altGroups(graph);
  const unused = unusedAltNodes(groups, opts.alt);
  const chosenOf = (gi: number) => groups[gi].options.find((o) => !unused.has(o.node))?.node ?? groups[gi].options[0].node;
  // 중요 부하 유지율 (비상발전기·UPS 계통)
  const important = r.important.filter((id) => r.nodes.get(id) !== 'unused');
  const keptImportant = important.filter((id) => r.nodes.get(id) === 'normal' || r.nodes.get(id) === 'backup');
  // 보호협조 곡선: 1차(또는 차단 실패) + 후비
  const eqIdOf = (id: string) => model.nodeById.get(id)?.eq.id ?? '';
  const curves = [
    ...r.failed.map((id) => ({ id: `f-${id}`, label: model.nodeById.get(id)?.title ?? id, kind: tccKindOf(eqIdOf(id))!, role: 'failed' as const })),
    ...r.tripped.map((id) => ({ id: `t-${id}`, label: model.nodeById.get(id)?.title ?? id, kind: tccKindOf(eqIdOf(id))!, role: (r.failed.length ? 'backup' : 'primary') as 'backup' | 'primary' })),
  ].filter((c) => c.kind).slice(0, 4);
  const faultMultiple = opts.faultType === 'overload' ? 3 : opts.faultType === 'ground' ? 8 : 20;
  const printReport = () => {
    const body = bodyRef.current?.innerHTML ?? '';
    document.querySelectorAll('iframe[data-sim-report]').forEach((x) => x.remove());
    const f = document.createElement('iframe');
    f.setAttribute('data-sim-report', '');
    f.setAttribute('aria-hidden', 'true');
    f.tabIndex = -1;
    f.title = '사고 시뮬레이션 보고서';
    Object.assign(f.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden' });
    document.body.appendChild(f);
    const doc = f.contentDocument;
    const win = f.contentWindow;
    if (!doc || !win) return;
    const scen = [FAULT_TYPE_LABEL[opts.faultType ?? 'short'], opts.failPrimary ? '1차 차단 실패(후비 보호)' : '', opts.microgrid ? '마이크로그리드' : '', ...groups.map((gr, i) => `${gr.label.split(':')[0]}: ${short(chosenOf(i))}`)].filter(Boolean).join(' · ');
    doc.open();
    doc.write(
      `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>사고 시뮬레이션 보고서</title><style>` +
        `body{font-family:'Pretendard','Malgun Gothic',sans-serif;color:#101828;margin:24px;font-size:13px;line-height:1.55}h1{font-size:20px;margin:0 0 4px}` +
        `.meta{color:#667085;margin:0 0 14px}dl{display:flex;gap:10px}dl div{border:1px solid #d0d5dd;border-radius:8px;padding:6px 14px;text-align:center}dt{color:#667085;font-size:12px}dd{margin:0;font-size:20px;font-weight:700}` +
        `ol,ul{padding-left:18px}h3{font-size:14px;margin:14px 0 4px}.dsim__tl{list-style:none;padding:0}.dsim__tl-item{display:grid;grid-template-columns:64px 1fr}.dsim__tl-t{font-weight:700}` +
        `.dsim-tcc svg{max-width:520px}.dsim-tcc__leg{display:block;font-size:12px}.dsim-tcc__leg i{display:inline-block;width:14px;height:3px;margin-right:6px;vertical-align:middle}.dsim__note,.dsim-tcc__note{color:#667085;font-size:11px}` +
        `@page{size:A4;margin:14mm}</style></head><body><h1>사고 시뮬레이션 보고서</h1><p class="meta">LS ELECTRIC 전력계통 제품맵 · ${todayIso()} · ${scen}</p>${body}</body></html>`,
    );
    doc.close();
    setTimeout(() => {
      win.focus();
      win.print();
    }, 300);
  };
  const name = (id: string) => {
    const n = model.nodeById.get(id);
    return n ? (n.eq.abbr ? `${n.eq.abbr} ${n.eq.name}` : n.eq.name) : (model.busNodes.find((b) => b.id === id)?.label ?? model.endpoints.find((e) => e.id === id)?.label ?? id);
  };
  const short = (id: string) => model.nodeById.get(id)?.title ?? name(id);
  const product = (id: string) => {
    const n = model.nodeById.get(id);
    return n ? resolveProducts(n.eq)[0]?.name : undefined;
  };
  const tiles = (ids: string[]) => ids.filter((id) => model.nodeById.has(id));
  const dead = tiles(r.dead);
  const backup = tiles(r.backup);
  const idle = !opened.size && !faults.size;
  // 영업 요약: 자사 제품이 지킨 것 · 공백
  const actedOwn = [...r.tripped, ...r.transferred].filter((id) => product(id));
  const kept = backup.filter((id) => !['emergency-gen', 'ups', 'pv', 'ess', 'pcs', 'dc-devices'].includes(model.nodeById.get(id)!.eq.id));
  const gaps = [...new Set([...backup, ...r.transferred, ...r.tripped])].filter((id) => {
    const c = model.nodeById.get(id)?.eq.coverage;
    return c === 'missing' || c === 'na';
  });
  return (
    <section className="dsim" aria-labelledby="dsim-title" data-testid="sim-panel">
      <div className="dsim__head">
        <h2 id="dsim-title">
          <span aria-hidden="true">⚠</span> 사고 시뮬레이션
        </h2>
        <div className="dsim__btns">
          <button type="button" className="btn btn--secondary btn--sm" onClick={reset} disabled={idle && !opts.failPrimary && !opts.microgrid && opts.faultType === 'short'} data-testid="sim-reset">
            처음으로
          </button>
          <button type="button" className="btn btn--secondary btn--sm" onClick={stop} data-testid="sim-stop">
            끝내기
          </button>
        </div>
      </div>

      {/* 시나리오 한 번에 (영업 데모) */}
      <div className="dsim__scen" role="group" aria-label="시나리오">
        {SIM_SCENARIOS.map((sc) => (
          <button key={sc.id} type="button" className="dsim__chip" title={sc.desc} onClick={() => (scenario(sc), announce(`${sc.label} 시나리오`))} data-testid={`sim-scenario-${sc.id}`}>
            {sc.label}
          </button>
        ))}
      </div>

      {/* 옵션: 사고 종류 · 차단 실패 · 마이크로그리드 */}
      <div className="dsim__opts">
        <label className="dsim__opt">
          사고 종류
          <select value={opts.faultType} onChange={(e) => setOption('ftype', e.target.value === 'short' ? null : e.target.value)} data-testid="sim-ftype">
            {(Object.keys(FAULT_TYPE_LABEL) as FaultType[]).map((k) => (
              <option key={k} value={k}>
                {FAULT_TYPE_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="dsim__opt dsim__opt--check" title="1차 보호기기가 동작하지 않으면 그 위 차단기가 시간차로 대신 끊음">
          <input type="checkbox" checked={!!opts.failPrimary} onChange={(e) => setOption('fail', e.target.checked ? '1' : null)} data-testid="sim-fail" />
          1차 차단 실패(후비 보호)
        </label>
        <label className="dsim__opt dsim__opt--check" title="태양광·ESS 가 PCS 를 통해 380V 모선을 자립 운전으로 공급">
          <input type="checkbox" checked={!!opts.microgrid} onChange={(e) => setOption('mg', e.target.checked ? '1' : null)} data-testid="sim-mg" />
          마이크로그리드
        </label>
      </div>

      {/* 택1 구성 — 실제로 설치한 쪽을 골라야 정전·보호 동작이 맞음 */}
      {groups.length > 0 && (
        <div className="dsim__alts" role="group" aria-label="택1 구성">
          {groups.map((gr, i) => (
            <label key={gr.label} className="dsim__alt">
              <span>{gr.label.split(':')[0]}</span>
              <select value={chosenOf(i)} onChange={(e) => chooseAlt(gr, e.target.value)} data-testid={`sim-alt-${i}`}>
                {gr.options.map((o) => (
                  <option key={o.node} value={o.node}>
                    {short(o.node)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      {idle ? (
        <p className="dsim__hint">
          위 <b>시나리오</b>를 누르거나, 계통도에서 <b>기기를 누르면 그 자리에 사고</b>가 납니다 — 전원 쪽 가장 가까운 차단·보호기기가 동작합니다. <b>차단기·개폐기</b>를 누르면 열고 닫을 수 있습니다.
        </p>
      ) : (
        <div ref={bodyRef} className="dsim__body">
          <dl className="dsim__sum" aria-live="polite">
            <div className="dsim__stat dsim__stat--dead">
              <dt>정전</dt>
              <dd data-testid="sim-dead-count">{dead.length}</dd>
            </div>
            <div className="dsim__stat dsim__stat--backup">
              <dt>비상 공급</dt>
              <dd data-testid="sim-backup-count">{backup.length}</dd>
            </div>
            <div className="dsim__stat dsim__stat--trip">
              <dt>보호 동작</dt>
              <dd>{r.tripped.length}</dd>
            </div>
            {important.length > 0 && (
              <div className={`dsim__stat${keptImportant.length < important.length ? ' dsim__stat--dead' : ' dsim__stat--ok'}`} title={`중요 부하(비상발전기·UPS 계통): ${important.map(short).join(', ')}`}>
                <dt>중요 부하 유지</dt>
                <dd data-testid="sim-important">{Math.round((keptImportant.length / important.length) * 100)}%</dd>
              </div>
            )}
          </dl>

          {/* 동작 순서 (대표 동작 시간) */}
          <h3 className="dsim__h3">동작 순서</h3>
          <ol className="dsim__tl" data-testid="sim-timeline">
            {r.timeline.map((st, i) => (
              <li key={i} className={`dsim__tl-item dsim__tl-item--${st.kind}`}>
                <span className="dsim__tl-t">{sec(st.t)}</span>
                <span className="dsim__tl-txt">
                  {st.text}
                  <span className="dsim__tl-ids">
                    {' '}
                    — {st.ids.map(short).join(', ')}
                    {st.kind !== 'fault' && st.kind !== 'open' && st.ids.some((id) => product(id)) && (
                      <span className="dsim__prod"> · 자사 {[...new Set(st.ids.map(product).filter(Boolean))].join(', ')}</span>
                    )}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          {curves.length > 0 && (
            <>
              <h3 className="dsim__h3">보호협조 곡선</h3>
              <TccChart curves={curves} faultMultiple={faultMultiple} />
            </>
          )}

          {r.restore.length > 0 && (
            <>
              <h3 className="dsim__h3">복구 순서</h3>
              <ol className="dsim__restore" data-testid="sim-restore">
                {r.restore.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ol>
            </>
          )}

          {/* 자사 제품이 지킨 것 · 공백 (영업 요약) */}
          {(actedOwn.length > 0 || kept.length > 0 || gaps.length > 0) && (
            <div className="dsim__biz" data-testid="sim-biz">
              {actedOwn.length > 0 && (
                <p>
                  <b>자사 제품 동작:</b> {actedOwn.map((id) => `${short(id)}(${product(id)})`).join(', ')}
                </p>
              )}
              {kept.length > 0 && (
                <p>
                  <b>지켜진 부하:</b> {kept.map(short).join(', ')} — 비상 전원·절체로 공급 유지
                </p>
              )}
              {gaps.length > 0 && (
                <p className="dsim__gap">
                  <b>자사 공백:</b> {gaps.map(short).join(', ')} — 자사 미보유(협력사·타사 제품으로 구성)
                </p>
              )}
            </div>
          )}

          {dead.length > 0 && (
            <p className="dsim__dead">
              <b>정전 범위 {dead.length}:</b> {dead.map(short).join(', ')}
            </p>
          )}
          <p className="dsim__note">대표 동작 시간·단순화한 참고 모델입니다 (실제 보호협조·계통 해석 아님, 설정·제품마다 다름).</p>
        </div>
      )}
      {!idle && (
        <div className="dsim__foot">
          <button type="button" className="btn btn--secondary btn--sm" onClick={printReport} data-testid="sim-report">
            보고서 인쇄·PDF
          </button>
        </div>
      )}
    </section>
  );
}
