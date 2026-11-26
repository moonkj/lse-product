/**
 * 경쟁 대응 (/counter) — 경쟁사 뉴스 제목·요약이나 제품명을 넣으면 자사 대응 기기·제품을 보여 준다.
 * 주소 #/counter?q=… 로 열 수 있다 (시장 뉴스 사이트의 기사 링크용). 규칙 사전 기반 참고 결과.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getData } from '../data/load';
import PageHeader from '../components/common/PageHeader';
import CoverageBadge from '../components/common/CoverageBadge';
import { pageTitle } from '../lib/labels';
import { LAYER_LABELS } from '../lib/schema';
import { candidateProducts } from '../lib/builder/validate';
import { RESPONSE_LABEL, matchArticle, matchText } from '../lib/counter/match';
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
          <div className="cnt-found">
            {result.competitors.length > 0 ? (
              <p>
                경쟁사:{' '}
                {result.competitors.map((c) => (
                  <span key={c.id} className="cnt-tag" data-testid="counter-competitor">
                    {c.name}
                  </span>
                ))}
              </p>
            ) : (
              <p className="cnt-muted">경쟁사 이름은 찾지 못했습니다.</p>
            )}
            <p className="cnt-muted">
              제품군 {result.hits.length}개{result.projects.length ? ` · 프로젝트 ${result.projects.map((p) => p.label).join(', ')}` : ''}
            </p>
          </div>

          {result.projects.map((p) => (
            <section key={p.id} className="pg-card cnt-project" aria-labelledby={`cnt-pj-${p.id}`} data-testid={`counter-project-${p.id}`}>
              <div className="cnt-project__head">
                <h2 id={`cnt-pj-${p.id}`}>{p.label} 프로젝트 대응 묶음</h2>
                {p.preset && (
                  <Link className="btn btn--secondary btn--sm" to={`/builder?preset=${p.preset}`} data-testid="counter-open-preset">
                    단선도 예시로 열기 →
                  </Link>
                )}
              </div>
              <ul className="cnt-bundle">
                {p.equipment
                  .filter((id) => data.equipmentTypeById.has(id))
                  .map((id) => {
                    const e = data.equipmentTypeById.get(id)!;
                    return (
                      <li key={id}>
                        <Link to={`/equipment/${id}`} className="cnt-bundle__item">
                          <CoverageBadge coverage={e.coverage} variant="icon" />
                          <span>{e.abbr ? `${e.abbr} ` : ''}{e.name}</span>
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}

          {result.hits.length === 0 ? (
            <p className="pg-card cnt-none" data-testid="counter-none">
              대응할 제품군을 찾지 못했습니다. 제품 종류가 드러나는 말(예: 차단기, 변압기, 인버터, switchgear, UPS)이나 경쟁사 시리즈명(예: Masterpact, Emax, SINAMICS)을 넣어 보세요.
            </p>
          ) : (
            <ol className="cnt-hits">
              {result.hits.slice(0, 10).map((h) => {
                const e = data.equipmentTypeById.get(h.eq)!;
                const products = candidateProducts(h.eq);
                const adj = h.adjacentTo ? data.equipmentTypeById.get(h.adjacentTo) : undefined;
                return (
                  <li key={h.eq} className={`pg-card cnt-hit cnt-hit--${e.coverage}`} data-testid={`counter-hit-${h.eq}`}>
                    <div className="cnt-hit__head">
                      <h2 className="cnt-hit__title">
                        <Link to={`/equipment/${h.eq}`}>
                          {e.abbr ? `${e.abbr} ` : ''}
                          {e.name}
                        </Link>
                      </h2>
                      <CoverageBadge coverage={e.coverage} />
                    </div>
                    <p className="cnt-hit__resp">
                      <b>{RESPONSE_LABEL[e.coverage]}</b> · {LAYER_LABELS[e.layer]}
                    </p>
                    <p className="cnt-hit__why">
                      {adj ? (
                        <>
                          경쟁사 '{adj.name}'은(는) 자사 사업 범위 밖이라, 함께 쓰이는 자사 기기로 연관 대응합니다.
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
        </div>
      )}
    </div>
  );
}
