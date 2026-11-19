import { Link } from 'react-router-dom';
import growthJson from '../../data/market-growth.json';
import { getData } from '../../data/load';
import { COVERAGES, type Coverage } from '../../lib/schema';
import { COVERAGE_LABELS } from '../../lib/labels';
import {
  GROWTH_LABELS,
  GROWTH_ROWS,
  GROWTH_SYMBOLS,
  MarketGrowthSchema,
  growthByEquipment,
  type GrowthRow,
  type MarketGrowth,
} from '../../lib/market/annual';
import SourceBadge from './SourceBadge';
import './annual.css';

/** 빌드 시점 검증 — 판정마다 출처·기준일 필수 */
const GROWTH: MarketGrowth = MarketGrowthSchema.parse(growthJson);

/**
 * 공백 매트릭스 (전력시장 토론 P1, B6) — 가로 = 자사 보유 상태, 세로 = 성장 방향(공식 계획 물량 기준).
 * 원화 시장 규모 축은 쓰지 않음. 판정 근거가 없는 기기는 '근거 없음' 행. 기기를 누르면 기기 상세.
 */
export default function GapMatrix({ data = GROWTH }: { data?: MarketGrowth }) {
  const equipment = getData().equipmentTypes;
  const byEq = growthByEquipment(data);
  const cols: Coverage[] = COVERAGES.filter((c) => equipment.some((e) => e.coverage === c));
  const cell = (row: GrowthRow, cov: Coverage) =>
    equipment.filter((e) => e.coverage === cov && (byEq.get(e.id)?.direction ?? 'none') === row);

  return (
    <section className="pg-card mgm" aria-labelledby="mgm-title" data-testid="market-gap-matrix">
      <h2 id="mgm-title" className="mgm__title">
        공백 매트릭스 <span className="mgm__sub">성장 방향 × 자사 보유</span>
      </h2>
      <p className="mgm__rule">{data.rule}</p>
      <div className="mgm__scroll">
        <table className="mgm__table">
          <thead>
            <tr>
              <th scope="col">성장 방향 \ 보유</th>
              {cols.map((c) => (
                <th key={c} scope="col" className={`mgm__col mgm__col--${c}`}>
                  {COVERAGE_LABELS[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROWTH_ROWS.map((row) => (
              <tr key={row} className={`mgm__row mgm__row--${row}`}>
                <th scope="row">
                  <span className="mgm__sym" aria-hidden="true">
                    {GROWTH_SYMBOLS[row]}
                  </span>{' '}
                  {GROWTH_LABELS[row]}
                </th>
                {cols.map((c) => {
                  const list = cell(row, c);
                  const hot = row !== 'none' && row !== 'flat' && (c === 'missing' || c === 'partial') && list.length > 0;
                  return (
                    <td key={c} className={hot ? 'is-hot' : undefined} data-testid={`mgm-${row}-${c}`}>
                      {list.length === 0 ? (
                        <span className="mgm__empty">·</span>
                      ) : (
                        <ul className="mgm__chips">
                          {list.map((e) => (
                            <li key={e.id}>
                              <Link to={`/equipment/${e.id}`} className="mgm__chip" title={byEq.get(e.id)?.reason}>
                                {e.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="mgm__basis">
        <summary>판정 근거 {data.items.length}건 · 기준 {data.asof}</summary>
        <ul>
          {data.items.map((it) => (
            <li key={it.id}>
              <b>
                {GROWTH_SYMBOLS[it.direction]} {it.label}
              </b>
              {it.indirect && <span className="mgm__tag">간접 연결</span>} — {it.reason}
              <div className="mgm__srcs">
                {it.basis.map((b, i) => (
                  <span key={i} className="mgm__src">
                    {b.label}: {b.value.toLocaleString('ko-KR')} {b.unit} <SourceBadge source={b.source} needsCheck={b.needsCheck} />
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
