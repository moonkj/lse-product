/**
 * 경쟁 대응 (/counter) — 경쟁사 뉴스 제목·요약이나 제품명을 넣으면 자사 대응 기기·제품을 보여 준다.
 * 주소 #/counter?q=… 로 열 수 있다 (시장 뉴스 사이트의 기사 링크용). 규칙 사전 기반 참고 결과.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getData } from '../data/load';
import PageHeader from '../components/common/PageHeader';
import CoverageBadge from '../components/common/CoverageBadge';
import { eqLabel, pageTitle } from '../lib/labels';
import { COVERAGE_LABELS, LAYER_LABELS } from '../lib/schema';
import { candidateProducts } from '../lib/builder/validate';
import { ADJACENT_ROLE, RESPONSE_LABEL, matchArticle, matchText, type EquipmentHit } from '../lib/counter/match';
import { articleUrlOf, slugWords, splitPasted, type Article } from '../lib/counter/article';
import './pages.css';
import './CounterPage.css';

const SAMPLES = [
  'ABB Unveils Intelligent Motor to Accelerate Industrial AI Adoption',
  'Siemens advances physical AI and autonomous production technologies',
  '슈나이더 일렉트릭, 차세대 전력 배전을 위한 전력전자 제품군 공개',
  'Eaton wins hyperscale data center UPS and switchgear order',
  'Schneider Masterpact MTZ air circuit breaker',
  '효성중공업, 765kV 초고압 변압기·GIS 수주',
];

export default function CounterPage() {
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get('q') ?? '');
  useEffect(() => {
    document.title = pageTitle('경쟁 대응');
  }, []);
  // 입력을 주소에 담아 공유·뒤로가기 가능하게 (입력 멈춘 뒤)
  useEffect(() => {
    const t = setTimeout(() => {
      const q = text.trim();
      if ((params.get('q') ?? '') !== q) setParams(q ? { q } : {}, { replace: true });
    }, 400);
    return () => clearTimeout(t);
  }, [text, params, setParams]);
  // 주소가 바뀌어 들어오면 (뉴스 사이트 링크) 입력에 반영
  useEffect(() => {
    const q = params.get('q') ?? '';
    setText((cur) => (cur.trim() === q ? cur : q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('q')]);

  // 기사 주소면 서버 함수(/api/article)로 본문까지 받아 판단. 못 받으면 주소의 단어로만
  const url = articleUrlOf(text);
  const [fetched, setFetched] = useState<{ url: string; article?: Article; error?: string } | undefined>();
  useEffect(() => {
    if (!url) return;
    if (fetched?.url === url) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setFetched({ url });
      try {
        const res = await fetch(new URL(`api/article?url=${encodeURIComponent(url)}`, document.baseURI).toString(), { signal: ctl.signal });
        const body = (await res.json().catch(() => ({}))) as Partial<Article> & { error?: string };
        if (!res.ok || (!body.title && !body.body)) setFetched({ url, error: body.error || `본문을 받지 못했습니다 (${res.status}).` });
        else setFetched({ url, article: { url, title: body.title ?? '', description: body.description ?? '', body: body.body ?? '' } });
      } catch (e) {
        if ((e as Error)?.name !== 'AbortError') setFetched({ url, error: '본문을 받지 못했습니다 (연결 실패).' });
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  const state = url ? (fetched?.url === url ? fetched : { url }) : undefined;
  const pasted = useMemo(() => splitPasted(text), [text]);
  const result = useMemo(() => {
    if (state?.article) return matchArticle(`${state.article.title} ${state.article.description}`, state.article.body);
    if (url) return matchText(slugWords(url));
    return pasted.body ? matchArticle(pasted.title, pasted.body) : matchText(text);
  }, [state?.article, url, pasted, text]);
  const loading = !!url && !state?.article && !state?.error;
  const data = getData();
  const empty = !text.trim();
  // 결과 묶음 (2026-11-27 사용자: 위 '대응 묶음'과 아래 묶음이 따로 놀아 헷갈림 → 번호 붙은 한 흐름으로)
  //  ① 직접 대응 — 기사 속 제품군과 같은 종류의 자사 제품
  //  ② 관련 제품 — 기사 속 제품이 자사 범위 밖일 때 함께 쓰는 자사 제품 (직접 대체품 아님)
  //  ③ 프로젝트 — 기사가 데이터센터·송배전 등 프로젝트일 때 그 계통에 들어가는 자사 제품 (위에 나온 것 제외)
  //  ④ 본문 언급 — 본문에 곁가지로 나온 제품군
  const view = useMemo(() => {
    const covRank = (c?: string) => (c === 'owned' ? 0 : c === 'partial' ? 1 : c === 'affiliate' || c === 'sourced' || c === 'developing' ? 2 : 3);
    const shown = result.hits.slice(0, 12);
    const cov = (h: EquipmentHit) => data.equipmentTypeById.get(h.eq)?.coverage;
    const name = (id: string) => data.equipmentTypeById.get(id)?.name ?? id;
    const bodyOnly = (h: EquipmentHit) => !h.adjacentTo && !!h.bodyTerms?.length && h.bodyTerms.length === h.terms.length;
    const direct = shown.filter((h) => !h.adjacentTo && !bodyOnly(h) && cov(h) !== 'na');
    const outOfScope = shown.filter((h) => !h.adjacentTo && cov(h) === 'na');
    const related = shown.filter((h) => h.adjacentTo);
    const mention = shown.filter((h) => bodyOnly(h) && cov(h) !== 'na');
    const srcNames = [...new Set([...outOfScope.map((h) => h.eq), ...related.map((h) => h.adjacentTo!)].map(name))].join('·');
    const used = new Set(shown.map((h) => h.eq));
    const onlyProject = direct.length === 0 && related.length === 0;
    type Group = { id: string; title: string; desc: string; items: EquipmentHit[]; compact?: boolean; preset?: string; testId: string };
    const groups: Group[] = [
      { id: 'direct', testId: 'counter-group-direct', title: '직접 대응 제품', desc: '기사에 나온 제품군과 같은 종류의 자사 제품입니다.', items: direct },
      {
        id: 'related',
        testId: 'counter-group-related',
        title: `${srcNames} 관련 제품 — 직접 대체품 아님`,
        desc: `기사 속 제품(${srcNames})은 자사 사업 범위 밖입니다. 아래는 그 제품과 함께 쓰는 자사 제품으로, 같은 현장에 함께 제안할 수 있습니다.`,
        items: related,
      },
      ...result.projects.map((pj) => ({
        id: `project-${pj.id}`,
        testId: `counter-project-${pj.id}`,
        title: `${pj.label} 프로젝트로 제안할 수 있는 제품`,
        desc: onlyProject
          ? `기사에 특정 제품군은 나오지 않았지만 ${pj.label} 프로젝트로 보여, 그 계통에 들어가는 자사 제품을 보여 줍니다.`
          : `기사가 ${pj.label} 프로젝트이기도 해서, 위에 나온 것 말고 그 계통에 함께 들어가는 기기입니다. 아이콘은 자사 보유 상태입니다.`,
        items: pj.equipment
          .filter((id) => data.equipmentTypeById.has(id) && !used.has(id))
          .map((id): EquipmentHit => ({ eq: id, score: 0, terms: [], project: pj.label }))
          .sort((a, b) => covRank(cov(a)) - covRank(cov(b))),
        compact: !onlyProject,
        preset: pj.preset,
      })),
      { id: 'mention', testId: 'counter-group-mention', title: '본문에 언급된 제품', desc: '기사 본문에 곁가지로 나온 제품군입니다. 기사 주제와 직접 관련이 없을 수 있습니다.', items: mention },
    ].filter((g) => g.items.length > 0);
    return { groups, direct, outOfScope, related, srcNames };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);
  const groups = view.groups;
  const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦'];

  return (
    <div className="pg cnt" data-testid="counter-page">
      <PageHeader
        crumbs={[{ label: '계통도', to: '/' }, { label: '경쟁 대응' }]}
        title="경쟁 대응"
        lead="경쟁사 뉴스 기사 주소(본문까지 읽음)나 제목·본문, 경쟁사 제품명을 넣으면, 그 제품군에 대응하는 자사 기기와 제품을 보유 상태와 함께 보여 줍니다. 프로젝트성 기사면 그 계통의 대응 제품 묶음도 보여 줍니다."
      />

      <section className="pg-card cnt-input" aria-labelledby="cnt-q-label">
        <label id="cnt-q-label" htmlFor="cnt-q" className="cnt-input__label">
          뉴스 기사 주소, 기사 제목·본문, 또는 경쟁사 제품명
        </label>
        <textarea
          id="cnt-q"
          className="cnt-input__box"
          rows={4}
          value={text}
          placeholder={'기사 주소(https://…)를 넣으면 본문까지 읽어 판단합니다.\n또는 첫 줄에 제목, 다음 줄부터 본문을 붙여 넣으세요.'}
          onChange={(e) => setText(e.target.value)}
          data-testid="counter-input"
        />
        <div className="cnt-samples" role="group" aria-label="예시 기사">
          <span className="cnt-samples__label">예시</span>
          {SAMPLES.map((s) => (
            <button key={s} type="button" className="cnt-chip" onClick={() => setText(s)} data-testid="counter-sample">
              {s.length > 40 ? `${s.slice(0, 40)}…` : s}
            </button>
          ))}
        </div>
        <p className="cnt-note" role="note">
          제목에서 찾은 말을 가장 크게, 본문에서만 찾은 말은 낮은 비중으로 봅니다 (본문에서만 한 번 스친 일반어는 뺌). 키워드·경쟁사 시리즈명 사전으로 자동 연결한 참고 결과입니다. 실제 대응 가능 여부와 사양 비교는 제품 카탈로그와 사업부 확인이 필요합니다.
        </p>
      </section>

      {!empty && (url || pasted.body) && (
        <section className="pg-card cnt-source" aria-live="polite" data-testid="counter-source">
          {url ? (
            loading ? (
              <p className="cnt-muted">기사 본문을 읽는 중…</p>
            ) : state?.article ? (
              <>
                <p>
                  <b>기사 본문까지 읽어 판단했습니다.</b> <span className="cnt-muted">본문 {state.article.body.length.toLocaleString()}자</span>
                </p>
                <p className="cnt-source__title" data-testid="counter-article-title">{state.article.title || '(제목 없음)'}</p>
                {state.article.description && <p className="cnt-muted cnt-source__desc">{state.article.description}</p>}
              </>
            ) : (
              <p data-testid="counter-article-error">
                <b>본문을 읽지 못해 주소의 단어로만 판단했습니다.</b> <span className="cnt-muted">{state?.error} 기사 제목과 본문을 직접 붙여 넣으면 더 정확합니다.</span>
              </p>
            )
          ) : (
            <p>
              <b>첫 줄을 제목, 나머지를 본문으로 보고 판단했습니다.</b> <span className="cnt-muted">본문 {pasted.body.length.toLocaleString()}자</span>
            </p>
          )}
        </section>
      )}

      {!empty && !loading && (
        <div className="cnt-results" aria-live="polite" data-testid="counter-results">
          <section className="pg-card cnt-summary" aria-label="이 기사에서 찾은 것" data-testid="counter-summary">
            <h2 className="cnt-summary__h">이 기사에서 찾은 것</h2>
            <dl className="cnt-summary__dl">
              <dt>경쟁사</dt>
              <dd>
                {result.competitors.length > 0
                  ? result.competitors.map((c) => (
                      <span key={c.id} className="cnt-tag" data-testid="counter-competitor">
                        {c.name}
                      </span>
                    ))
                  : <span className="cnt-muted">찾지 못함</span>}
              </dd>
              <dt>기사 속 제품군</dt>
              <dd>
                {view.direct.length + view.outOfScope.length > 0 ? (
                  <>
                    {view.direct.map((h) => eqLabel(data.equipmentTypeById.get(h.eq)!)).join(', ')}
                    {view.outOfScope.length > 0 && (
                      <span className="cnt-muted">
                        {view.direct.length ? ' · ' : ''}
                        {view.outOfScope.map((h) => data.equipmentTypeById.get(h.eq)!.name).join(', ')} (자사 사업 범위 밖)
                      </span>
                    )}
                  </>
                ) : (
                  <span className="cnt-muted">특정 제품군 없음</span>
                )}
              </dd>
              {result.projects.length > 0 && (
                <>
                  <dt>프로젝트</dt>
                  <dd>{result.projects.map((pj) => pj.label).join(', ')}</dd>
                </>
              )}
            </dl>
          </section>

          {groups.length === 0 ? (
            <p className="pg-card cnt-none" data-testid="counter-none">
              {view.outOfScope.length > 0 ? `기사 속 제품군(${view.outOfScope.map((h) => data.equipmentTypeById.get(h.eq)!.name).join(', ')})이 자사 사업 범위 밖이고, 함께 쓰는 자사 제품도 사전에 없습니다. ` : ''}대응할 제품군을 찾지 못했습니다. 제품 종류가 드러나는 말(예: 차단기, 변압기, 인버터, switchgear, UPS)이나 경쟁사 시리즈명(예: Masterpact, Emax, SINAMICS)을 넣어 보세요.
            </p>
          ) : (
            groups.map((g, gi) => (
            <section key={g.id} className={`cnt-group cnt-group--${g.id.startsWith('project') ? 'project' : g.id}`} aria-labelledby={`cnt-g-${g.id}`} data-testid={g.testId}>
              <div className="cnt-group__head">
                <h2 id={`cnt-g-${g.id}`} className="cnt-group__title">
                  <span className="cnt-group__no" aria-hidden="true">{CIRCLED[gi]}</span> {g.title} <span className="cnt-group__n">{g.items.length}</span>
                </h2>
                {g.preset && (
                  <Link className="btn btn--secondary btn--sm" to={`/builder?preset=${g.preset}`} data-testid="counter-open-preset">
                    단선도 예시로 열기 →
                  </Link>
                )}
              </div>
              <p className="cnt-group__desc">{g.desc}</p>
            {g.compact ? (
              <ul className="cnt-bundle">
                {g.items.map((h) => {
                  const e = data.equipmentTypeById.get(h.eq)!;
                  const n = candidateProducts(h.eq).length;
                  return (
                    <li key={h.eq}>
                      <Link to={`/equipment/${h.eq}`} className="cnt-bundle__item" data-testid={`counter-hit-${h.eq}`}>
                        <CoverageBadge coverage={e.coverage} variant="icon" />
                        <span>{eqLabel(e)}</span>
                        <span className="cnt-muted">{COVERAGE_LABELS[e.coverage]}{n ? ` · 제품 ${n}` : ''}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
            <ol className="cnt-hits">
              {g.items.map((h) => {
                const e = data.equipmentTypeById.get(h.eq)!;
                const products = candidateProducts(h.eq);
                const adj = h.adjacentTo ? data.equipmentTypeById.get(h.adjacentTo) : undefined;
                // 본문에서만 찾은 제품군 — 기사 주제가 아니라 곁가지 언급일 수 있어 '대응'이라 단정하지 않음
                const bodyOnly = !adj && !!h.bodyTerms?.length && h.bodyTerms.length === h.terms.length;
                return (
                  <li key={h.eq} className={`pg-card cnt-hit cnt-hit--${e.coverage}${adj ? ' cnt-hit--related' : ''}`} data-testid={`counter-hit-${h.eq}`}>
                    <div className="cnt-hit__head">
                      <h3 className="cnt-hit__title">
                        <Link to={`/equipment/${h.eq}`}>{eqLabel(e)}</Link>
                      </h3>
                      <CoverageBadge coverage={e.coverage} />
                    </div>
                    <p className="cnt-hit__resp">
                      <b>{adj ? `${adj.name} 관련 자사 제품` : bodyOnly && (e.coverage === 'owned' || e.coverage === 'partial') ? '본문에 언급된 관련 자사 제품' : RESPONSE_LABEL[e.coverage]}</b> · {LAYER_LABELS[e.layer]}
                    </p>
                    <p className="cnt-hit__why">
                      {h.project ? (
                        <>{h.project} 프로젝트에 들어가는 기기입니다.</>
                      ) : adj ? (
                        <>
                          경쟁사 제품({adj.name})은 자사 사업 범위 밖입니다. 이 기기는 {ADJACENT_ROLE[adj.id] ?? `${adj.name}과(와) 함께 쓰는`} 자사 제품이라 같은 현장에 제안할 수 있습니다 (직접 대체품 아님).
                        </>
                      ) : (
                        <>
                          {h.terms.some((t) => !h.bodyTerms?.includes(t)) && <>찾은 말: {h.terms.filter((t) => !h.bodyTerms?.includes(t)).map((t) => `'${t}'`).join(', ')}</>}
                          {h.bodyTerms?.length ? (
                            <span className={h.terms.length > h.bodyTerms.length ? 'cnt-muted' : undefined}>
                              {h.terms.length > h.bodyTerms.length ? ' · 본문: ' : '본문에서 찾은 말: '}
                              {h.bodyTerms.map((t) => `'${t}'`).join(', ')}
                            </span>
                          ) : null}
                        </>
                      )}
                    </p>
                    {products.length > 0 ? (
                      <ul className="cnt-products" aria-label={`${e.name} 자사 제품`}>
                        {products.slice(0, 8).map((p) => (
                          <li key={p.id}>
                            <Link to={`/product/${encodeURIComponent(p.id)}`} className="cnt-product" data-testid="counter-product">
                              {p.name}
                            </Link>
                          </li>
                        ))}
                        {products.length > 8 && <li className="cnt-muted">외 {products.length - 8}개</li>}
                      </ul>
                    ) : (
                      <p className="cnt-muted">{e.coverage === 'owned' || e.coverage === 'partial' ? '제품맵에 개별 제품으로 올라 있지 않습니다 (시스템·일괄 공급).' : '고를 수 있는 자사 제품이 없습니다.'}</p>
                    )}
                    {products.length >= 2 && (
                      <p className="cnt-hit__more">
                        <Link to={`/compare?type=product&ids=${products.slice(0, 3).map((p) => encodeURIComponent(p.id)).join(',')}`}>사양 비교하기 →</Link>
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
            )}
            </section>
            ))
          )}
        </div>
      )}
    </div>
  );
}
