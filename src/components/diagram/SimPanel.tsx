/**
 * 사고 시뮬레이션 — 도구줄 토글 + 결과 패널 (2026-11-27)
 * 켜면 기기를 누를 때 선택 대신: 차단·보호기기는 열기/닫기, 그 밖의 기기는 그 자리 사고(상위 보호기기 트립).
 * 결과: 정전 기기 · 비상 전원으로 버티는 기기 · 동작한 보호기기 · 절체(ALTS·ATS) — 자사 제품으로 무엇이 지켜졌는지까지.
 */
import { useData, resolveProducts } from '../../data/load';
import { getDiagramModel } from '../../lib/diagram/model';
import { useSimActions, useSimState } from '../../lib/diagram/sim';
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

export default function SimPanel() {
  const { on, opened, faults } = useSimState();
  const { stop, reset } = useSimActions();
  const r = useSimResult();
  const data = useData();
  const model = getDiagramModel(data);
  if (!on || !r) return null;
  const name = (id: string) => {
    const n = model.nodeById.get(id);
    return n ? (n.eq.abbr ? `${n.eq.abbr} ${n.eq.name}` : n.eq.name) : (model.busNodes.find((b) => b.id === id)?.label ?? model.endpoints.find((e) => e.id === id)?.label ?? id);
  };
  const product = (id: string) => {
    const n = model.nodeById.get(id);
    return n ? resolveProducts(n.eq)[0]?.name : undefined;
  };
  const tiles = (ids: string[]) => ids.filter((id) => model.nodeById.has(id));
  const dead = tiles(r.dead);
  const backup = tiles(r.backup);
  const idle = !opened.size && !faults.size;
  return (
    <section className="dsim" aria-labelledby="dsim-title" aria-live="polite" data-testid="sim-panel">
      <div className="dsim__head">
        <h2 id="dsim-title">
          <span aria-hidden="true">⚠</span> 사고 시뮬레이션
        </h2>
        <div className="dsim__btns">
          <button type="button" className="btn btn--secondary btn--sm" onClick={reset} disabled={idle} data-testid="sim-reset">
            처음으로
          </button>
          <button type="button" className="btn btn--secondary btn--sm" onClick={stop} data-testid="sim-stop">
            끝내기
          </button>
        </div>
      </div>
      {idle ? (
        <p className="dsim__hint">
          계통도에서 <b>기기를 누르면 그 자리에 사고</b>가 납니다 — 전원 쪽 가장 가까운 차단·보호기기가 동작합니다. <b>차단기·개폐기</b>를 누르면 열고 닫을 수 있습니다.
        </p>
      ) : (
        <>
          <dl className="dsim__sum">
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
          <ul className="dsim__list">
            {[...faults].map((id) => (
              <li key={`f-${id}`}>
                <span className="dsim__tag dsim__tag--fault">사고</span> {name(id)}
              </li>
            ))}
            {r.tripped.map((id) => (
              <li key={`t-${id}`} data-testid="sim-tripped">
                <span className="dsim__tag dsim__tag--trip">트립</span> {name(id)}
                {product(id) && <span className="dsim__prod"> · 자사 {product(id)}</span>}
              </li>
            ))}
            {[...opened].map((id) => (
              <li key={`o-${id}`}>
                <span className="dsim__tag dsim__tag--open">열림</span> {name(id)}
              </li>
            ))}
            {r.transferred.map((id) => (
              <li key={`x-${id}`}>
                <span className="dsim__tag dsim__tag--backup">절체</span> {name(id)} — 다른 전원으로 전환해 공급 유지
                {product(id) && <span className="dsim__prod"> · 자사 {product(id)}</span>}
              </li>
            ))}
            {backup.length > 0 && (
              <li>
                <span className="dsim__tag dsim__tag--backup">비상</span> {backup.map(name).join(', ')}
              </li>
            )}
          </ul>
          {dead.length > 0 && (
            <p className="dsim__dead">
              <b>정전 범위:</b> {dead.map(name).join(', ')}
            </p>
          )}
          <p className="dsim__note">단순화한 참고 모델입니다 (실제 보호협조·계통 해석 아님). 신재생 PCS 는 계통 정전 시 단독운전 방지로 함께 멈춘다고 봅니다.</p>
        </>
      )}
    </section>
  );
}
