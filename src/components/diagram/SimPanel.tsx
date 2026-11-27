/**
 * 사고 시뮬레이션 — 도구줄 토글 + 결과 패널 (2026-11-27)
 * 켜면 기기를 누를 때 선택 대신: 차단·보호기기는 열기/닫기, 그 밖의 기기는 그 자리 사고(상위 보호기기 트립).
 * 결과: 정전 기기 · 비상 전원으로 버티는 기기 · 동작한 보호기기 · 절체(ALTS·ATS) — 자사 제품으로 무엇이 지켜졌는지까지.
 */
import { useData, resolveProducts } from '../../data/load';
import { getDiagramModel } from '../../lib/diagram/model';
import { FAULT_TYPE_LABEL, SIM_SCENARIOS, useSimActions, useSimState, type FaultType } from '../../lib/diagram/sim';
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
  const { stop, reset, setOption, scenario } = useSimActions();
  const r = useSimResult();
  const data = useData();
  const model = getDiagramModel(data);
  if (!on || !r) return null;
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

      {idle ? (
        <p className="dsim__hint">
          위 <b>시나리오</b>를 누르거나, 계통도에서 <b>기기를 누르면 그 자리에 사고</b>가 납니다 — 전원 쪽 가장 가까운 차단·보호기기가 동작합니다. <b>차단기·개폐기</b>를 누르면 열고 닫을 수 있습니다.
        </p>
      ) : (
        <>
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
        </>
      )}
    </section>
  );
}
