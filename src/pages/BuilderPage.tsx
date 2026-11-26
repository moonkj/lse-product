import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getData, productImageUrl, type SpecsMap } from '../data/load';
import PageHeader from '../components/common/PageHeader';
import CoverageBadge from '../components/common/CoverageBadge';
import { useSpecs } from '../components/compare/useSpecs';
import { announce } from '../lib/announce';
import { COVERAGE_LABELS, COVERAGE_ORDER, pageTitle, todayIso } from '../lib/labels';
import { downloadText } from '../lib/pages/catalog';
import { TEMPLATES, equipmentOf, slotsOf, templateById, type Row, type Template } from '../lib/builder/templates';
import { isInstrumentProduct,
  DISCLAIMER,
  applyFix,
  candidateProducts,
  defaultBuild,
  emptyBuild,
  productFits,
  summarize,
  validateBuild,
  type Build,
  type Ctx,
  type Fix,
  type Issue,
  type Target,
} from '../lib/builder/validate';
import { buildBom, bomCsv } from '../lib/builder/bom';
import { useBuilderStore, useCurrentBuild } from '../lib/builder/store';
import { decodeBuild, shareUrl } from '../lib/builder/share';
import './pages.css';
import './BuilderPage.css';

/**
 * 계통 구성 시뮬레이션 (/builder) — 2026-11-26 1단계.
 * 템플릿(수전설비·저압 배전반·데이터센터)의 칸을 자사 기기·제품으로 채우면, 규칙에 따라 "확인할 점"과 "제안대로 고치기"를 보여 준다.
 * 넣는 방법 세 가지가 같은 결과: ① 왼쪽 목록에서 칸으로 끌어 놓기 ② 칸을 누르고 오른쪽에서 고르기 ③ 키보드(Tab·Enter·Delete, Ctrl+Z).
 * 설계 검토 도구가 아니다 — "검증·적합·통과" 대신 "확인할 점·제안", 화면 위·내보낸 파일에 DISCLAIMER.
 */

const DRAG_TYPE = 'text/x-lse-equipment';
const eqById = (id: string) => getData().equipmentTypeById.get(id);
const eqLabel = (id: string) => {
  const e = eqById(id);
  return e ? (e.abbr ? `${e.abbr} ${e.name}` : e.name) : id;
};
const sameTarget = (a: Target | null, b: Target | undefined) => !!a && !!b && a.kind === b.kind && a.id === b.id;

export default function BuilderPage() {
  const templateId = useBuilderStore((s) => s.templateId);
  const setTemplate = useBuilderStore((s) => s.setTemplate);
  const commit = useBuilderStore((s) => s.commit);
  const undo = useBuilderStore((s) => s.undo);
  const redo = useBuilderStore((s) => s.redo);
  const canUndo = useBuilderStore((s) => s.past.length > 0);
  const t = templateById(templateId)!;
  const build = useCurrentBuild();
  const specsState = useSpecs('builder');
  const specs = specsState.status === 'ready' ? specsState.map : undefined;
  const issues = useMemo(() => validateBuild(build, t, specs), [build, t, specs]);
  const summary = summarize(build, t, issues);
  const [selected, setSelected] = useState<Target | null>(null);
  const [showBom, setShowBom] = useState(false);
  const [params, setParams] = useSearchParams();
  const [shareNote, setShareNote] = useState<{ kind: 'loaded' | 'bad' | 'copied' | 'manual'; url?: string } | null>(null);

  // 공유 링크(#/builder?b=…)로 들어오면 그 구성을 불러온다 — 되돌리기로 원래 구성에 돌아갈 수 있다
  const code = params.get('b');
  useEffect(() => {
    if (!code) return;
    const shared = decodeBuild(code);
    if (shared) {
      const st = useBuilderStore.getState();
      st.setTemplate(shared.template);
      useBuilderStore.getState().commit(shared);
      setShareNote({ kind: 'loaded' });
      announce('공유받은 구성을 불러왔습니다');
    } else setShareNote({ kind: 'bad' });
    setParams({}, { replace: true });
  }, [code, setParams]);

  const copyShare = async () => {
    const url = shareUrl(build);
    try {
      await navigator.clipboard.writeText(url);
      setShareNote({ kind: 'copied' });
      announce('공유 링크를 복사했습니다');
    } catch {
      setShareNote({ kind: 'manual', url });
    }
  };

  useEffect(() => {
    document.title = pageTitle('계통 구성');
  }, []);
  useEffect(() => setSelected(null), [templateId]);

  // 되돌리기·다시 실행 (입력란 밖에서만)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const apply = (fix: Fix, say?: string) => {
    commit(applyFix(build, fix));
    if (say) announce(say);
  };
  const ctxOf = (target: Target): Ctx | null => {
    if (target.kind === 'slot') {
      const hit = slotsOf(t).find((s) => s.slot.id === target.id);
      return hit ? { row: hit.row, slot: hit.slot } : null;
    }
    const x = build.extras.find((e) => e.id === target.id);
    const row = x && t.rows.find((r) => r.id === x.row);
    if (!row?.addable) return null;
    return { row, slot: { id: target.id, label: row.addable.label.replace(/ 추가$/, ''), accepts: row.addable.accepts, default: row.addable.accepts[0], hint: '', required: false } };
  };
  const placementOf = (target: Target) => (target.kind === 'slot' ? build.slots[target.id] : build.extras.find((e) => e.id === target.id));

  /** 기기 놓기 — 칸이 받지 않는 기기도 놓되(오류로 안내), 받는 기기면 맞는 제품을 함께 고른다 */
  const place = (target: Target, eq: string) => {
    let next = applyFix(build, { type: 'setEq', target, eq });
    const ctx = ctxOf(target);
    if (ctx && ctx.slot.accepts.includes(eq)) {
      const rec = candidateProducts(eq).find((p) => productFits(p, ctx, next, t, specs) && specs?.has(p.id)) ?? candidateProducts(eq).find((p) => productFits(p, ctx, next, t, specs));
      if (rec) next = applyFix(next, { type: 'setProduct', target, product: rec.id });
    }
    commit(next);
    setSelected(target);
    const n = validateBuild(next, t, specs).filter((i) => i.severity !== 'info' && sameTarget(target, i.target)).length;
    announce(`${eqLabel(eq)}을(를) ${ctx?.slot.label ?? ''} 칸에 넣었습니다${n ? ` · 확인할 점 ${n}개` : ''}`);
  };

  /** 왼쪽 목록에서 고른 기기: 선택한 칸 → 없으면 그 기기를 받는 첫 빈 칸 */
  const placeFromPalette = (eq: string) => {
    if (selected) return place(selected, eq);
    const hit = slotsOf(t).find(({ slot }) => slot.accepts.includes(eq) && !build.slots[slot.id]?.eq) ?? slotsOf(t).find(({ slot }) => slot.accepts.includes(eq));
    if (hit) place({ kind: 'slot', id: hit.slot.id }, eq);
  };

  const addExtra = (row: Row) => {
    if (!row.addable) return;
    const id = `x${Date.now().toString(36)}`;
    const eq = row.addable.accepts[0];
    commit({ ...build, extras: [...build.extras, { id, row: row.id, eq }] });
    setSelected({ kind: 'extra', id });
    announce(`${row.addable.label} — ${eqLabel(eq)}`);
  };

  const issuesFor = (target: Target) => issues.filter((i) => sameTarget(target, i.target));

  const exportCsv = () => {
    downloadText(`계통구성_${t.label}_${todayIso()}.csv`, bomCsv(buildBom(build, t, specs), t, build, todayIso()));
  };

  return (
    <div className="pg pg--wide bld" data-testid="builder-page">
      <PageHeader
        crumbs={[{ label: '계통도', to: '/' }, { label: '계통 구성' }]}
        title="계통 구성"
        lead="템플릿을 고르고 칸마다 자사 기기·제품을 넣어 계통을 구성해 봅니다. 잘못 넣은 곳은 이유와 함께 고치는 방법을 알려 줍니다."
      />
      <p className="bld-disclaimer" role="note">
        {DISCLAIMER}
      </p>

      <div className="bld-top">
        <div className="bld-templates" role="group" aria-label="템플릿">
          {TEMPLATES.map((x) => (
            <button key={x.id} type="button" className="bld-tpl" aria-pressed={x.id === t.id} onClick={() => setTemplate(x.id)} data-testid={`builder-tpl-${x.id}`}>
              <b>{x.label}</b>
              <small>{x.desc}</small>
            </button>
          ))}
        </div>
        <div className="bld-actions">
          {/* 정격 데이터(specs.json)를 다 불러온 뒤에 채운다 — 그래야 정격이 맞는 제품을 고른다 */}
          <button
            type="button"
            className="btn btn--secondary btn--md"
            onClick={() => (commit(defaultBuild(t, specs)), announce('기본 구성으로 채웠습니다'))}
            disabled={specsState.status === 'loading'}
            data-testid="builder-fill"
          >
            {specsState.status === 'loading' ? '정격 불러오는 중…' : '기본 구성 채우기'}
          </button>
          <button type="button" className="btn btn--secondary btn--md" onClick={undo} disabled={!canUndo} title="Ctrl+Z" data-testid="builder-undo">
            ↶ 되돌리기
          </button>
          <button type="button" className="btn btn--secondary btn--md" onClick={() => (commit(emptyBuild(t)), setSelected(null), announce('모든 칸을 비웠습니다'))} data-testid="builder-reset">
            초기화
          </button>
          <button type="button" className="btn btn--secondary btn--md" onClick={copyShare} data-testid="builder-share">
            공유 링크 복사
          </button>
        </div>
      </div>
      {shareNote && (
        <div className={`bld-share-note${shareNote.kind === 'bad' ? ' is-bad' : ''}`} role="status" data-testid="builder-share-note">
          {shareNote.kind === 'loaded' && <span>공유받은 구성을 불러왔습니다. 원래 구성은 ↶ 되돌리기로 돌아갈 수 있습니다.</span>}
          {shareNote.kind === 'bad' && <span>공유 링크를 읽을 수 없습니다. 링크가 잘렸는지 확인하세요.</span>}
          {shareNote.kind === 'copied' && <span>공유 링크를 복사했습니다. 받는 사람이 열면 이 구성이 그대로 보입니다.</span>}
          {shareNote.kind === 'manual' && (
            <label>
              복사가 막혀 있습니다. 아래 링크를 직접 복사하세요.
              <input readOnly value={shareNote.url} onFocus={(e) => e.currentTarget.select()} data-testid="builder-share-url" />
            </label>
          )}
          <button type="button" className="bld-share-note__x" onClick={() => setShareNote(null)} aria-label="알림 닫기">
            ×
          </button>
        </div>
      )}

      <div className="bld-grid">
        <Palette t={t} onPick={placeFromPalette} />

        <section className="bld-rows" aria-label={`${t.label} 계통`}>
          {t.rows.map((row) => (
            <section key={row.id} className="bld-row" aria-labelledby={`bld-row-${row.id}`} data-testid={`builder-row-${row.id}`}>
              <h2 id={`bld-row-${row.id}`} className="bld-row__title">
                {row.label} <small>{row.voltage}</small>
              </h2>
              <ol className="bld-chain">
                {row.slots.map((slot) => {
                  const target: Target = { kind: 'slot', id: slot.id };
                  return (
                    <li key={slot.id}>
                      <SlotCard
                        target={target}
                        label={slot.label}
                        hint={slot.hint}
                        required={slot.required}
                        eq={build.slots[slot.id]?.eq}
                        product={build.slots[slot.id]?.product}
                        issues={issuesFor(target)}
                        selected={sameTarget(selected, target)}
                        onSelect={() => setSelected(target)}
                        onDropEq={(eq) => place(target, eq)}
                        onClear={() => apply({ type: 'clear', target }, `${slot.label} 칸을 비웠습니다`)}
                      />
                    </li>
                  );
                })}
                {build.extras
                  .filter((x) => x.row === row.id)
                  .map((x) => {
                    const target: Target = { kind: 'extra', id: x.id };
                    return (
                      <li key={x.id}>
                        <SlotCard
                          target={target}
                          label={row.addable?.label.replace(/ 추가$/, '') ?? '추가'}
                          hint=""
                          required={false}
                          eq={x.eq}
                          product={x.product}
                          issues={issuesFor(target)}
                          selected={sameTarget(selected, target)}
                          onSelect={() => setSelected(target)}
                          onDropEq={(eq) => place(target, eq)}
                          onClear={() => (apply({ type: 'clear', target }, '추가한 칸을 지웠습니다'), setSelected(null))}
                        />
                      </li>
                    );
                  })}
                {row.addable && build.extras.filter((x) => x.row === row.id).length < row.addable.max && (
                  <li>
                    <button type="button" className="bld-add" onClick={() => addExtra(row)} data-testid={`builder-add-${row.id}`}>
                      ＋ {row.addable.label}
                    </button>
                  </li>
                )}
              </ol>
            </section>
          ))}
        </section>

        <Panel
          t={t}
          build={build}
          selected={selected}
          ctx={selected ? ctxOf(selected) : null}
          placement={selected ? placementOf(selected) : undefined}
          issues={selected ? issuesFor(selected) : issues}
          allIssues={issues}
          specsLoading={specsState.status === 'loading'}
          onPlace={place}
          onApply={apply}
          onParams={(p) => commit({ ...build, params: { ...build.params, ...p } })}
          onSelectTarget={setSelected}
          specs={specs}
        />
      </div>

      <div className="bld-summary" role="status" data-testid="builder-summary">
        <span>
          채운 칸 <b>{summary.filled}</b>/{summary.total}
        </span>
        <span className={summary.attention ? 'is-warn' : undefined}>
          확인할 점 <b>{summary.attention}</b>
        </span>
        <span>
          자사 보유 아님 <b>{summary.notOwned}</b>
        </span>
        <button type="button" className="bld-summary__btn" aria-expanded={showBom} onClick={() => setShowBom((v) => !v)} data-testid="builder-bom-toggle">
          제품 목록 {showBom ? '접기 ▴' : '보기 ▾'}
        </button>
      </div>

      {showBom && <Bom t={t} build={build} specs={specs} onCsv={exportCsv} />}
    </div>
  );
}

/** 왼쪽 기기 목록 — 템플릿에서 쓰는 기기만, 보유 → 일부 보유 → 계열사 … 순. 끌어 놓거나 눌러서 넣기 */
function Palette({ t, onPick }: { t: Template; onPick: (eq: string) => void }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const rank = (id: string) => COVERAGE_ORDER.indexOf(eqById(id)?.coverage ?? 'na');
    return equipmentOf(t)
      .filter((id) => !q || eqLabel(id).toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => rank(a) - rank(b));
  }, [t, q]);
  return (
    <aside className="bld-palette" aria-label="기기 목록">
      <h2 className="bld-palette__title">기기 목록</h2>
      <p className="bld-palette__hint">칸으로 끌어 놓거나 눌러서 넣습니다.</p>
      <label className="visually-hidden" htmlFor="bld-pal-q">
        기기 검색
      </label>
      <input id="bld-pal-q" className="bld-palette__search" type="search" placeholder="기기 검색" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="bld-palette__list">
        {list.map((id) => {
          const e = eqById(id)!;
          return (
            <li key={id}>
              <button
                type="button"
                className="bld-pal-item"
                draggable
                onDragStart={(ev) => {
                  ev.dataTransfer.setData(DRAG_TYPE, id);
                  ev.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => onPick(id)}
                data-testid={`builder-pal-${id}`}
              >
                <CoverageBadge coverage={e.coverage} variant="icon" />
                <span className="bld-pal-item__name">{eqLabel(id)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

interface SlotCardProps {
  target: Target;
  label: string;
  hint: string;
  required: boolean;
  eq?: string;
  product?: string;
  issues: Issue[];
  selected: boolean;
  onSelect: () => void;
  onDropEq: (eq: string) => void;
  onClear: () => void;
}

/** 칸 하나 — 누르면 선택, 끌어 놓기 대상, Delete 로 비우기 */
function SlotCard({ target, label, hint, required, eq, product, issues, selected, onSelect, onDropEq, onClear }: SlotCardProps) {
  const [over, setOver] = useState(false);
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warns = issues.filter((i) => i.severity === 'warn').length;
  const e = eq ? eqById(eq) : undefined;
  const p = product ? getData().productById.get(product) : undefined;
  const img = p ? productImageUrl(p.id, true) : undefined;
  const onDrop = (ev: DragEvent) => {
    ev.preventDefault();
    setOver(false);
    const id = ev.dataTransfer.getData(DRAG_TYPE);
    if (id) onDropEq(id);
  };
  const state = errors ? 'error' : warns ? 'warn' : e ? 'ok' : 'empty';
  return (
    <button
      type="button"
      className={`bld-slot bld-slot--${state}${selected ? ' is-selected' : ''}${over ? ' is-over' : ''}`}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(ev) => {
        if ((ev.key === 'Delete' || ev.key === 'Backspace') && eq) {
          ev.preventDefault();
          onClear();
        }
      }}
      onDragOver={(ev) => {
        if (ev.dataTransfer.types.includes(DRAG_TYPE)) {
          ev.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      data-testid={`builder-slot-${target.id}`}
      data-state={state}
    >
      <span className="bld-slot__label">
        {label}
        {required && <span className="bld-slot__req" aria-label="필수"> *</span>}
      </span>
      {e ? (
        <>
          <span className="bld-slot__pic" aria-hidden="true">
            {img ? <img src={img} alt="" loading="lazy" /> : <CoverageBadge coverage={e.coverage} variant="icon" />}
          </span>
          <span className="bld-slot__eq">{e.abbr ?? e.name}</span>
          <span className="bld-slot__product">{p ? p.name : e.coverage === 'owned' || e.coverage === 'partial' ? (candidateProducts(e.id).length ? '제품 미선택' : '일괄 공급') : COVERAGE_LABELS[e.coverage]}</span>
        </>
      ) : (
        <span className="bld-slot__empty">{hint ? `여기엔 보통 ${hint.split(/[—(]/)[0].trim()}` : '비어 있음'}</span>
      )}
      {(errors > 0 || warns > 0) && (
        <span className={`bld-slot__badge bld-slot__badge--${errors ? 'error' : 'warn'}`} aria-label={`확인할 점 ${errors + warns}개`}>
          {errors ? '⛔' : '⚠'} {errors + warns}
        </span>
      )}
    </button>
  );
}

interface PanelProps {
  t: Template;
  build: Build;
  selected: Target | null;
  ctx: Ctx | null;
  placement?: { eq?: string; product?: string };
  issues: Issue[];
  allIssues: Issue[];
  specsLoading: boolean;
  specs?: SpecsMap;
  onPlace: (target: Target, eq: string) => void;
  onApply: (fix: Fix, say?: string) => void;
  onParams: (p: Partial<Build['params']>) => void;
  onSelectTarget: (t: Target) => void;
}

/** 오른쪽 패널 — 선택한 칸: 기기·제품 고르기, 변압기 용량, 확인할 점 / 선택 없음: 전체 확인할 점 */
function Panel({ t, build, selected, ctx, placement, issues, allIssues, specsLoading, specs, onPlace, onApply, onParams, onSelectTarget }: PanelProps) {
  if (!selected || !ctx) {
    const list = allIssues.filter((i) => i.severity !== 'info');
    return (
      <aside className="bld-panel" aria-label="확인할 점" data-testid="builder-panel">
        <h2 className="bld-panel__title">확인할 점 {list.length}</h2>
        {list.length === 0 ? (
          <p className="bld-panel__ok">지금 구성에서 규칙에 걸리는 곳이 없습니다. 칸을 누르면 제품을 고를 수 있습니다.</p>
        ) : (
          <IssueList issues={list} onApply={onApply} onGo={onSelectTarget} />
        )}
      </aside>
    );
  }
  const eq = placement?.eq;
  const eqInfo = eq ? eqById(eq) : undefined;
  const products = eq && ctx.slot.accepts.includes(eq) ? candidateProducts(eq) : [];
  return (
    <aside className="bld-panel" aria-label={`${ctx.slot.label} 칸`} data-testid="builder-panel">
      <h2 className="bld-panel__title">{ctx.slot.label}</h2>
      <p className="bld-panel__meta">
        {ctx.row.label} · {ctx.row.voltage}
        {ctx.slot.hint && <> · {ctx.slot.hint}</>}
      </p>

      <h3 className="bld-panel__h">기기</h3>
      <div className="bld-panel__eqs" role="group" aria-label="이 칸에 넣을 기기">
        {ctx.slot.accepts.map((id) => {
          const e = eqById(id)!;
          return (
            <button key={id} type="button" className="bld-eq" aria-pressed={eq === id} onClick={() => onPlace(selected, id)} data-testid={`builder-eq-${id}`}>
              <CoverageBadge coverage={e.coverage} variant="icon" /> {eqLabel(id)}
            </button>
          );
        })}
      </div>

      {ctx.slot.transformer && (
        <div className="bld-panel__params">
          <label>
            용량 (kVA)
            <input type="number" min={50} step={50} value={build.params.kVA} onChange={(e) => onParams({ kVA: Math.max(1, Number(e.target.value) || 0) })} data-testid="builder-kva" />
          </label>
          <label>
            임피던스 %Z
            <input type="number" min={1} max={20} step={0.5} value={build.params.pctZ} onChange={(e) => onParams({ pctZ: Math.max(0.5, Number(e.target.value) || 0) })} />
          </label>
        </div>
      )}

      {eq && (
        <>
          <h3 className="bld-panel__h">자사 제품 {products.length > 0 && <small>{products.length}개</small>}</h3>
          {products.length === 0 ? (
            <p className="bld-panel__none">{eqInfo && (eqInfo.coverage === 'owned' || eqInfo.coverage === 'partial') ? '자사 보유 기기지만 제품맵에 개별 제품으로 올라 있지 않습니다 (시스템·일괄 공급).' : '고를 수 있는 자사 제품이 없습니다.'}</p>
          ) : (
            <ul className="bld-products" role="radiogroup" aria-label="제품">
              {products.map((p) => {
                const fits = productFits(p, ctx, build, t, specs);
                const img = productImageUrl(p.id, true);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={placement?.product === p.id}
                      className={`bld-product${fits ? '' : ' is-unfit'}`}
                      onClick={() => onApply({ type: 'setProduct', target: selected, product: p.id }, `${p.name} 선택`)}
                      data-testid={`builder-product-${p.id}`}
                    >
                      <span className="bld-product__pic" aria-hidden="true">
                        {img ? <img src={img} alt="" loading="lazy" /> : null}
                      </span>
                      <span className="bld-product__name">{p.name}</span>
                      <span className="bld-product__note">{!specs && specsLoading ? '정격 불러오는 중' : !specs?.has(p.id) ? '정격 정보 없음' : isInstrumentProduct(p.id) ? 'PT·CT로 연결 (계통 정격 무관)' : fits ? '조건에 맞음' : '정격이 맞지 않음'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {placement?.product && (
            <p className="bld-panel__link">
              <Link to={`/product/${encodeURIComponent(placement.product)}`}>제품 상세 보기 →</Link>
            </p>
          )}
        </>
      )}

      <h3 className="bld-panel__h">확인할 점</h3>
      {issues.length === 0 ? <p className="bld-panel__ok">이 칸에는 확인할 점이 없습니다.</p> : <IssueList issues={issues} onApply={onApply} />}

      {eq && (
        <button type="button" className="bld-panel__clear" onClick={() => onApply({ type: 'clear', target: selected }, `${ctx.slot.label} 칸을 비웠습니다`)} data-testid="builder-clear">
          이 칸 비우기
        </button>
      )}
    </aside>
  );
}

function IssueList({ issues, onApply, onGo }: { issues: Issue[]; onApply: (fix: Fix, say?: string) => void; onGo?: (t: Target) => void }) {
  return (
    <ul className="bld-issues" data-testid="builder-issues">
      {issues.map((i) => (
        <li key={i.key} className={`bld-issue bld-issue--${i.severity}`} data-rule={i.rule}>
          <span className="bld-issue__icon" aria-hidden="true">
            {i.severity === 'error' ? '⛔' : i.severity === 'warn' ? '⚠' : 'ℹ'}
          </span>
          <span className="visually-hidden">{i.severity === 'error' ? '규칙에 맞지 않음: ' : i.severity === 'warn' ? '확인 필요: ' : '안내: '}</span>
          <span className="bld-issue__msg">{i.message}</span>
          <span className="bld-issue__actions">
            {i.fix && (
              <button type="button" className="bld-fix" onClick={() => onApply(i.fix!.fix, `제안대로 고쳤습니다: ${i.fix!.label}`)} data-testid="builder-fix">
                {i.fix.label}
              </button>
            )}
            {onGo && i.target && (
              <button type="button" className="bld-go" onClick={() => onGo(i.target!)}>
                칸으로
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Bom({ t, build, specs, onCsv }: { t: Template; build: Build; specs?: SpecsMap; onCsv: () => void }) {
  const rows = buildBom(build, t, specs);
  return (
    <section className="pg-card bld-bom" aria-labelledby="bld-bom-h" data-testid="builder-bom">
      <div className="bld-bom__head">
        <h2 id="bld-bom-h">제품 목록 {rows.length}</h2>
        <span className="bld-bom__actions">
          <button type="button" className="btn btn--secondary btn--md" onClick={onCsv} disabled={rows.length === 0} data-testid="builder-csv">
            CSV 내보내기
          </button>
          <button type="button" className="btn btn--secondary btn--md" onClick={() => window.print()}>
            인쇄
          </button>
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="bld-panel__none">칸을 채우면 제품 목록이 만들어집니다.</p>
      ) : (
        <div className="bld-bom__scroll">
          <table className="bld-table">
            <thead>
              <tr>
                <th scope="col">구간</th>
                <th scope="col">칸</th>
                <th scope="col">기기</th>
                <th scope="col">보유 상태</th>
                <th scope="col">선택 제품</th>
                <th scope="col">대표 정격</th>
                <th scope="col">수량</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>{r.section}</td>
                  <td>{r.slot}</td>
                  <td>{r.equipment}</td>
                  <td>{r.coverage}</td>
                  <td>{r.product}</td>
                  <td>{r.rating}</td>
                  <td>{r.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="bld-bom__note">{DISCLAIMER}</p>
    </section>
  );
}

