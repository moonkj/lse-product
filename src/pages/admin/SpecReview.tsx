import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useData } from '../../data/load';
import type { SpecItem, SpecsFile } from '../../lib/schema';
import { checkSpecs, specKeyLabels, type Issue as RuleIssue } from '../../lib/integrity';
import { todayIso } from '../../lib/labels';
import { pageHref } from '../../lib/pages/compare';
import { toJsonText } from '../../lib/admin/draft';
import { download } from '../../lib/admin/download';
import {
  SPEC_KIND_LABELS,
  SPEC_REVIEW_PRIORITY,
  addItem,
  addVariant,
  computeSpecChanges,
  deleteItem,
  deleteVariant,
  renameVariant,
  reviewerError,
  setReviewed,
  setVariantAxis,
  specChangesMarkdown,
  updateItem,
  updateVariantPage,
  type ProductSpecsRaw,
  type SpecOpResult,
  type SpecScope,
} from '../../lib/admin/specs';
import { useSpecsAdminStore } from '../../lib/admin/specsStore';
import ExternalLink from '../../components/common/ExternalLink';

const REVIEWER_KEY = 'lse-admin-spec-reviewer';
type Filter = 'all' | 'todo' | 'done' | 'priority';
const FILTER_LABELS: Record<Filter, string> = { all: '전체', todo: '검수 전', done: '검수 완료', priority: '우선 검수' };

function readReviewer(): string {
  try {
    return localStorage.getItem(REVIEWER_KEY) ?? '';
  } catch {
    return '';
  }
}

/** 입력 칸 — 포커스가 빠지거나 Enter 에서 반영(히스토리 1단계), Esc 는 취소. 반영 실패면 원래 값으로 */
function Cell({
  value,
  onCommit,
  label,
  type = 'text',
  size,
  testId,
  list,
}: {
  value: string;
  onCommit: (v: string) => boolean;
  label: string;
  type?: 'text' | 'number';
  size?: number;
  testId?: string;
  list?: string;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => {
    if (v === value) return;
    if (!onCommit(v)) setV(value);
  };
  const onKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
    else if (e.key === 'Escape') {
      setV(value);
      e.currentTarget.blur();
    }
  };
  return (
    <input
      className="aspec__cell"
      value={v}
      type={type}
      min={type === 'number' ? 1 : undefined}
      size={size}
      aria-label={label}
      list={list}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={onKey}
      data-testid={testId}
    />
  );
}

interface TableProps {
  scope: SpecScope;
  items: SpecItem[];
  spec: ProductSpecsRaw;
  fallbackPage?: number;
  keyLabels: Map<string, string>;
  apply: (r: SpecOpResult, ok?: string) => boolean;
  file: SpecsFile;
}

function SpecTable({ scope, items, spec, fallbackPage, keyLabels, apply, file }: TableProps) {
  const [nk, setNk] = useState('');
  const [nl, setNl] = useState('');
  const [nv, setNv] = useState('');
  const [nu, setNu] = useState('');
  const [np, setNp] = useState('');
  const where = scope.variantId ? `옵션 ${scope.variantId}` : '공통';
  const prefix = scope.variantId ?? 'common';
  const add = () => {
    if (apply(addItem(file, scope, { key: nk, label: nl, value: nv, unit: nu, page: np }), `${where}에 ${nk} 항목을 추가했습니다`)) {
      setNk('');
      setNl('');
      setNv('');
      setNu('');
      setNp('');
    }
  };
  return (
    <div className="aspec__tablewrap">
      <table className="aspec__table">
        <thead>
          <tr>
            <th scope="col">key</th>
            <th scope="col">항목</th>
            <th scope="col">값</th>
            <th scope="col">단위</th>
            <th scope="col">쪽</th>
            <th scope="col">카탈로그</th>
            <th scope="col">
              <span className="visually-hidden">삭제</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={7} className="aspec__empty">
                항목이 없습니다{scope.variantId ? ' — 옵션에는 항목이 1개 이상 필요합니다' : ''}
              </td>
            </tr>
          )}
          {items.map((it) => {
            const page = it.page ?? fallbackPage ?? spec.source.page;
            const upd = (patch: Parameters<typeof updateItem>[3]) => apply(updateItem(file, scope, it.key, patch));
            return (
              <tr key={it.key} data-testid={`admin-spec-item-${it.key}`}>
                <td>
                  <code>{it.key}</code>
                </td>
                <td>
                  <Cell value={it.label} label={`${where} ${it.key} 항목 이름`} size={10} onCommit={(v) => upd({ label: v })} />
                </td>
                <td className="aspec__valuecol">
                  <Cell value={it.value} label={`${where} ${it.key} 값`} onCommit={(v) => upd({ value: v })} testId={`admin-spec-value-${prefix}-${it.key}`} />
                </td>
                <td>
                  <Cell value={it.unit ?? ''} label={`${where} ${it.key} 단위`} size={4} onCommit={(v) => upd({ unit: v })} />
                </td>
                <td>
                  <Cell value={it.page ? String(it.page) : ''} type="number" label={`${where} ${it.key} 페이지`} size={3} onCommit={(v) => upd({ page: v })} />
                </td>
                <td>
                  {page ? (
                    <ExternalLink href={pageHref(spec.source.url, page)} className="aspec__pagelink">
                      p.{page}
                      {!it.page && <small> (상위)</small>} ↗
                    </ExternalLink>
                  ) : (
                    <span className="aspec__muted">쪽 없음</span>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="abtn abtn--sm abtn--danger"
                    aria-label={`${where} ${it.label} 항목 삭제`}
                    onClick={() => apply(deleteItem(file, scope, it.key), `${where} ${it.label} 항목을 삭제했습니다 (되돌리기 가능)`)}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="aspec__addrow">
            <td>
              <input
                className="aspec__cell"
                value={nk}
                size={9}
                placeholder="key"
                aria-label={`${where} 새 항목 key`}
                list="aspec-keys"
                onChange={(e) => {
                  const k = e.target.value;
                  setNk(k);
                  const known = keyLabels.get(k.trim());
                  if (known && (!nl || [...keyLabels.values()].includes(nl))) setNl(known);
                }}
                data-testid={`admin-spec-new-key-${prefix}`}
              />
            </td>
            <td>
              <input className="aspec__cell" value={nl} size={10} placeholder="항목 이름" aria-label={`${where} 새 항목 이름`} onChange={(e) => setNl(e.target.value)} data-testid={`admin-spec-new-label-${prefix}`} />
            </td>
            <td className="aspec__valuecol">
              <input className="aspec__cell" value={nv} placeholder="카탈로그 표기 그대로" aria-label={`${where} 새 항목 값`} onChange={(e) => setNv(e.target.value)} data-testid={`admin-spec-new-value-${prefix}`} />
            </td>
            <td>
              <input className="aspec__cell" value={nu} size={4} placeholder="단위" aria-label={`${where} 새 항목 단위`} onChange={(e) => setNu(e.target.value)} />
            </td>
            <td>
              <input className="aspec__cell" value={np} type="number" min={1} size={3} placeholder="쪽" aria-label={`${where} 새 항목 페이지`} onChange={(e) => setNp(e.target.value)} />
            </td>
            <td colSpan={2}>
              <button type="button" className="abtn abtn--sm" onClick={add} disabled={!nk.trim() || !nl.trim() || !nv.trim()} data-testid={`admin-spec-add-item-${prefix}`}>
                + 항목 추가
              </button>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function IssueList({ issues, onFocus }: { issues: RuleIssue[]; onFocus: (id: string) => void }) {
  return (
    <ul>
      {issues.map((i, n) => (
        <li key={n} className="achk__issue">
          <span className="achk__area">{i.rule}</span> {i.message}
          {i.refs.productId && (
            <button type="button" className="abtn abtn--sm" onClick={() => onFocus(i.refs.productId!)}>
              보기
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** /#/admin "사양 검수" — specs.json 사람 검수 (값 정정·항목/옵션 편집·검수 완료 표시 → 검사 후 내보내기) */
export default function SpecReview() {
  const data = useData();
  const { status, error, base, draft, past, future, staleBase, restoredAt, saveStatus, load, commit, undo, redo, resetToBase } = useSpecsAdminStore();
  const [selected, setSelected] = useState<string>();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [msg, setMsg] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [reviewer, setReviewer] = useState(readReviewer);
  const [reviewMsg, setReviewMsg] = useState<string>();
  const [check, setCheck] = useState<{ errors: RuleIssue[]; warnings: RuleIssue[]; at: number } | null>(null);
  const [exported, setExported] = useState<string[]>([]);
  const [nvId, setNvId] = useState('');
  const [nvLabel, setNvLabel] = useState('');
  const [nvPage, setNvPage] = useState('');
  const [nvAxis, setNvAxis] = useState('');

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setCheck(null);
    setExported([]);
  }, [draft]);

  useEffect(() => {
    if (msg?.kind !== 'info') return;
    const t = setTimeout(() => setMsg((cur) => (cur === msg ? null : cur)), 6000);
    return () => clearTimeout(t);
  }, [msg]);

  useEffect(() => setReviewMsg(undefined), [selected]);

  const nameOf = (id: string) => data.productById.get(id)?.name ?? id;
  const changes = useMemo(() => (base && draft ? computeSpecChanges(base, draft) : []), [base, draft]);
  const keyLabels = useMemo(() => (draft ? specKeyLabels(draft) : new Map<string, string>()), [draft]);
  const productIds = useMemo(() => new Set(data.productById.keys()), [data]);
  const docUrls = useMemo(() => new Map([...data.docsByProductId].map(([id, e]) => [id, e.docs.map((d) => d.url)])), [data]);

  if (status === 'error')
    return (
      <div className="aspec aspec--state" role="alert">
        사양 데이터(specs.json)를 불러오지 못했습니다 — {error}
      </div>
    );
  if (status !== 'ready' || !draft || !base)
    return (
      <div className="aspec aspec--state" role="status">
        사양 데이터를 불러오는 중…
      </div>
    );

  const apply = (r: SpecOpResult, ok?: string): boolean => {
    if (r.error) {
      setMsg({ kind: 'error', text: r.error });
      return false;
    }
    commit(r.file);
    if (ok) setMsg({ kind: 'info', text: ok });
    return true;
  };

  const entries = Object.entries(draft.products);
  const q = query.trim().toLowerCase();
  const list = entries
    .filter(([id, s]) => {
      if (filter === 'todo' && s.reviewed) return false;
      if (filter === 'done' && !s.reviewed) return false;
      if (filter === 'priority' && !SPEC_REVIEW_PRIORITY[id]) return false;
      return !q || id.toLowerCase().includes(q) || nameOf(id).toLowerCase().includes(q);
    })
    .sort(([a], [b]) => Number(!!SPEC_REVIEW_PRIORITY[b]) - Number(!!SPEC_REVIEW_PRIORITY[a]));
  const reviewedCount = entries.filter(([, s]) => s.reviewed).length;
  const changedIds = new Set(changes.map((c) => c.productId));

  const runCheck = () => {
    const r = checkSpecs({ specs: draft, productIds, docUrlsByProduct: docUrls, today: todayIso() });
    setCheck({ ...r, at: Date.now() });
    return r;
  };
  const files = {
    'specs.json': () => toJsonText(draft),
    '변경요약.md': () => specChangesMarkdown(changes, nameOf, draft),
  };
  const doExport = () => {
    const r = runCheck();
    if (r.errors.length > 0) {
      setMsg({ kind: 'error', text: `사양 검사 오류 ${r.errors.length}건 — 내보내기를 막았습니다` });
      setExported([]);
      return;
    }
    for (const [name, text] of Object.entries(files)) download(name, text(), name.endsWith('.md') ? 'text/markdown' : 'application/json');
    setExported(Object.keys(files));
    setMsg({ kind: 'info', text: '내보내기 완료 — specs.json, 변경요약.md' });
  };

  const sel = selected ? draft.products[selected] : undefined;
  const selBase = selected ? base.products[selected] : undefined;

  const onReviewToggle = (checked: boolean) => {
    if (!selected) return;
    if (checked) {
      const err = reviewerError(reviewer);
      if (err) {
        setReviewMsg(err);
        return;
      }
      try {
        localStorage.setItem(REVIEWER_KEY, reviewer.trim());
      } catch {
        /* 저장 불가 — 다음에 다시 입력 */
      }
    }
    setReviewMsg(undefined);
    apply(
      setReviewed(draft, selected, checked, reviewer, todayIso()),
      checked ? `${nameOf(selected)} 검수 완료로 표시했습니다` : `${nameOf(selected)} 검수 표시를 해제했습니다`,
    );
  };

  const onAddVariant = () => {
    if (!selected) return;
    if (apply(addVariant(draft, selected, { id: nvId, label: nvLabel, page: nvPage, axis: nvAxis }), `옵션 ${nvId} 를 추가했습니다 — 항목을 1개 이상 넣으세요`)) {
      setNvId('');
      setNvLabel('');
      setNvPage('');
      setNvAxis('');
    }
  };

  return (
    <div className="aspec" data-testid="admin-specs">
      <div className="aspec__toolbar" role="toolbar" aria-label="사양 검수 도구">
        <button type="button" className="abtn" onClick={undo} disabled={past.length === 0} data-testid="admin-spec-undo" title="Ctrl/⌘+Z">
          ↶ 되돌리기 {past.length > 0 && <small>({past.length})</small>}
        </button>
        <button type="button" className="abtn" onClick={redo} disabled={future.length === 0} data-testid="admin-spec-redo" title="Ctrl/⌘+Shift+Z">
          ↷ 다시 실행
        </button>
        <button
          type="button"
          className="abtn"
          disabled={changes.length === 0}
          onClick={() => {
            if (window.confirm('사양 초안을 원본(src/data/specs.json)으로 되돌릴까요? (되돌리기로 취소할 수 있습니다)')) {
              resetToBase();
              setMsg({ kind: 'info', text: '사양 초안을 원본으로 초기화했습니다' });
            }
          }}
          data-testid="admin-spec-reset"
        >
          초안 초기화
        </button>
        <span className="aspec__progress">
          검수 완료 <strong>{reviewedCount}</strong> / {entries.length}개 제품 · 변경 {changes.length}건
        </span>
        <span className="admin__save" aria-live="polite">
          {saveStatus === 'unavailable'
            ? '⚠ 이 브라우저에 초안을 저장할 수 없습니다 — 창을 닫기 전에 내보내세요'
            : saveStatus === 'saved'
              ? '사양 초안 자동 저장됨'
              : restoredAt
                ? `저장된 사양 초안을 불러왔습니다 (${new Date(restoredAt).toLocaleString('ko-KR')})`
                : ''}
        </span>
        <button type="button" className="abtn" onClick={runCheck} data-testid="admin-spec-check">
          검사
        </button>
        <button type="button" className="abtn abtn--primary" onClick={doExport} data-testid="admin-spec-export">
          검사 후 내보내기
        </button>
      </div>
      {staleBase && (
        <p className="admin__stale" role="alert">
          저장된 사양 초안이 만들어진 뒤 원본(src/data/specs.json)이 바뀌었습니다. 변경 내역을 확인하고, 필요하면 "초안 초기화" 후 다시 검수하세요.
        </p>
      )}
      {msg && (
        <div className={`admin__toast admin__toast--${msg.kind} aspec__msg`} role={msg.kind === 'error' ? 'alert' : 'status'} data-testid="admin-spec-msg">
          <span>{msg.text}</span>
          <button type="button" onClick={() => setMsg(null)} aria-label="알림 닫기">
            ×
          </button>
        </div>
      )}
      <datalist id="aspec-keys">
        {[...keyLabels].map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </datalist>

      <div className="aspec__body">
        <aside className="aspec__list" aria-label="사양 제품 목록">
          <div className="aspec__filters">
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="제품 이름·ID 검색" aria-label="사양 제품 검색" />
            <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="검수 상태 필터" data-testid="admin-spec-filter">
              {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
                <option key={f} value={f}>
                  {FILTER_LABELS[f]}
                </option>
              ))}
            </select>
          </div>
          <p className="aspec__muted aspec__count">{list.length}개 제품 (우선 검수 먼저)</p>
          <ul className="aspec__items">
            {list.map(([id, s]) => (
              <li key={id}>
                <button
                  type="button"
                  className={`aspec__item${selected === id ? ' is-active' : ''}`}
                  aria-current={selected === id ? 'true' : undefined}
                  onClick={() => setSelected(id)}
                  data-testid={`admin-spec-product-${id}`}
                >
                  <span className="aspec__iname">
                    {nameOf(id)}
                    {changedIds.has(id) && (
                      <span className="aspec__dirty" title="초안에서 바뀜">
                        ●<span className="visually-hidden"> 변경됨</span>
                      </span>
                    )}
                  </span>
                  <span className="aspec__imeta">
                    <code>{id}</code> · 공통 {s.items.length} · 옵션 {s.variants?.length ?? 0}
                  </span>
                  <span className="aspec__ibadges">
                    {s.reviewed ? <span className="aspec__badge aspec__badge--ok">검수 완료</span> : <span className="aspec__badge">검수 전</span>}
                    {SPEC_REVIEW_PRIORITY[id] && <span className="aspec__badge aspec__badge--pri">우선 검수</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="aspec__detail" aria-label="사양 상세">
          {!sel || !selected ? (
            <p className="aspec__muted aspec__placeholder">왼쪽 목록에서 제품을 고르세요. 카탈로그 페이지 링크를 열어 값과 대조한 뒤 오탈자를 고치고 "검수 완료"를 표시합니다.</p>
          ) : (
            <>
              <header className="aspec__head">
                <h2>
                  {nameOf(selected)} <small>{selected}</small>
                </h2>
                {SPEC_REVIEW_PRIORITY[selected] && (
                  <p className="aspec__priority" role="note">
                    <strong>우선 검수</strong> {SPEC_REVIEW_PRIORITY[selected]}
                  </p>
                )}
                <p className="aspec__meta">
                  <ExternalLink href={pageHref(sel.source.url, sel.source.page)}>
                    출처: {sel.source.title}
                    {sel.source.page ? ` · p.${sel.source.page}` : ''} ↗
                  </ExternalLink>
                  <span className="aspec__muted">추출일 {sel.extractedAt}</span>
                  {sel.reviewed ? <span className="aspec__badge aspec__badge--ok">검수 완료</span> : <span className="aspec__badge">카탈로그 추출값 · 검수 전</span>}
                </p>
                {sel.note && <p className="aspec__note">메모: {sel.note}</p>}
              </header>

              <div className="aspec__review">
                <label className="aspec__field">
                  검수자 부서명 <span className="aform__req">필수</span>
                  <input
                    value={reviewer}
                    onChange={(e) => {
                      setReviewer(e.target.value);
                      setReviewMsg(undefined);
                    }}
                    placeholder="예: 기술영업팀"
                    aria-describedby="aspec-reviewer-hint"
                    aria-invalid={reviewMsg ? true : undefined}
                    data-testid="admin-spec-reviewer"
                  />
                </label>
                <label className="aspec__check">
                  <input type="checkbox" checked={sel.reviewed} onChange={(e) => onReviewToggle(e.target.checked)} data-testid="admin-spec-reviewed" />
                  카탈로그와 대조해 <strong>검수 완료</strong>
                </label>
                <p id="aspec-reviewer-hint" className="aspec__muted aspec__hint">
                  개인 실명·연락처는 적지 마세요 — 부서명만 기록됩니다. 검수 완료 시 메모(note)에 "검수: 부서명 {todayIso()}"가 붙고, 제품 상세·비교 화면 배지가 "검수 완료"로 바뀝니다.
                </p>
                {reviewMsg && (
                  <p className="aform__error" role="alert" data-testid="admin-spec-reviewer-error">
                    {reviewMsg}
                  </p>
                )}
              </div>

              <section className="aspec__section" aria-labelledby="aspec-common">
                <h3 id="aspec-common">
                  공통 사양 <small>{sel.items.length}개 · 옵션과 관계없이 같은 값</small>
                </h3>
                <SpecTable scope={{ productId: selected }} items={sel.items} spec={sel} keyLabels={keyLabels} apply={apply} file={draft} />
              </section>

              <section className="aspec__section" aria-labelledby="aspec-variants">
                <h3 id="aspec-variants">
                  옵션별 사양 <small>{sel.variants?.length ?? 0}개</small>
                </h3>
                {(sel.variants?.length ?? 0) > 0 && (
                  <label className="admin__inline aspec__axis">
                    옵션 기준(variantAxis)
                    <Cell value={sel.variantAxis ?? ''} label="옵션 기준 이름" size={14} onCommit={(v) => apply(setVariantAxis(draft, selected, v))} />
                  </label>
                )}
                {(sel.variants ?? []).map((v) => (
                  <div key={v.id} className="aspec__variant" data-testid={`admin-spec-variant-${v.id}`}>
                    <div className="aspec__vhead">
                      <code className="aspec__vid">{v.id}</code>
                      <label className="admin__inline">
                        이름
                        <Cell value={v.label} label={`옵션 ${v.id} 이름`} size={24} onCommit={(x) => apply(renameVariant(draft, selected, v.id, x), `옵션 ${v.id} 이름을 바꿨습니다`)} testId={`admin-spec-variant-label-${v.id}`} />
                      </label>
                      <label className="admin__inline">
                        표 쪽
                        <Cell value={v.page ? String(v.page) : ''} type="number" label={`옵션 ${v.id} 표 페이지`} size={3} onCommit={(x) => apply(updateVariantPage(draft, selected, v.id, x))} />
                      </label>
                      {v.page && (
                        <ExternalLink href={pageHref(sel.source.url, v.page)} className="aspec__pagelink">
                          옵션 표 p.{v.page} ↗
                        </ExternalLink>
                      )}
                      {!selBase?.variants?.some((b) => b.id === v.id) && <span className="aspec__badge aspec__badge--new">새 옵션</span>}
                      <button
                        type="button"
                        className="abtn abtn--sm abtn--danger aspec__vdel"
                        onClick={() => {
                          if (window.confirm(`옵션 "${v.label}"(항목 ${v.items.length}개)을 삭제할까요? (되돌리기 가능)`))
                            apply(deleteVariant(draft, selected, v.id), `옵션 ${v.id} 를 삭제했습니다`);
                        }}
                        data-testid={`admin-spec-variant-delete-${v.id}`}
                      >
                        옵션 삭제
                      </button>
                    </div>
                    {v.note && <p className="aspec__note">메모: {v.note}</p>}
                    <SpecTable scope={{ productId: selected, variantId: v.id }} items={v.items} spec={sel} fallbackPage={v.page} keyLabels={keyLabels} apply={apply} file={draft} />
                  </div>
                ))}
                <fieldset className="aspec__addvariant">
                  <legend>옵션 추가</legend>
                  <label className="admin__inline">
                    id
                    <input value={nvId} onChange={(e) => setNvId(e.target.value)} placeholder="예: 4000af" size={10} data-testid="admin-spec-new-variant-id" />
                  </label>
                  <label className="admin__inline">
                    이름
                    <input value={nvLabel} onChange={(e) => setNvLabel(e.target.value)} placeholder="카탈로그 표기 (예: 4000AF)" size={18} data-testid="admin-spec-new-variant-label" />
                  </label>
                  <label className="admin__inline">
                    표 쪽
                    <input value={nvPage} onChange={(e) => setNvPage(e.target.value)} type="number" min={1} size={3} />
                  </label>
                  {!sel.variantAxis && (
                    <label className="admin__inline">
                      옵션 기준
                      <input value={nvAxis} onChange={(e) => setNvAxis(e.target.value)} placeholder="예: 프레임" size={10} data-testid="admin-spec-new-variant-axis" />
                    </label>
                  )}
                  <button type="button" className="abtn abtn--sm" onClick={onAddVariant} disabled={!nvId.trim() || !nvLabel.trim()} data-testid="admin-spec-add-variant">
                    + 옵션 추가
                  </button>
                  <span className="aspec__muted">id 는 영문 소문자·숫자·하이픈 (URL 에 쓰임)</span>
                </fieldset>
              </section>
            </>
          )}
        </section>

        <aside className="aspec__side" aria-label="사양 변경 내역·검사">
          <section>
            <h3>사양 변경 내역 {changes.length}</h3>
            {changes.length === 0 ? (
              <p className="achg__empty">원본(src/data/specs.json)과 같습니다.</p>
            ) : (
              <ul className="aspec__changes" data-testid="admin-spec-changes">
                {changes.map((c, n) => (
                  <li key={n} className={`achg__item achg__item--${c.kind === 'reviewed' ? 'added' : c.kind === 'unreviewed' ? 'deleted' : c.kind}`}>
                    <span className="achg__kind">{SPEC_KIND_LABELS[c.kind]}</span>{' '}
                    <button type="button" className="aspec__link" onClick={() => setSelected(c.productId)}>
                      {nameOf(c.productId)}
                    </button>{' '}
                    {c.text}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="aspec__checkbox">
            <h3>검사·내보내기</h3>
            <p className="achk__intro">
              테스트(DI-90~99b)와 같은 규칙으로 검사합니다: 스키마, key 중복·공통↔옵션 겹침, label 일관성, 페이지, 옵션 id·variantAxis. 오류가 있으면 내보내기를 막습니다.
            </p>
            {check && (
              <div className="achk__result" aria-live="polite" data-testid="admin-spec-check-result">
                {check.errors.length === 0 ? (
                  <p className="achk__ok" data-testid="admin-spec-check-ok">
                    ✓ 오류 없음 — 내보낼 수 있습니다{check.warnings.length ? ` (경고 ${check.warnings.length}건)` : ''}
                  </p>
                ) : (
                  <div className="achk__errors" role="alert" data-testid="admin-spec-check-errors">
                    <strong>오류 {check.errors.length}건</strong>
                    <IssueList issues={check.errors} onFocus={setSelected} />
                  </div>
                )}
                {check.warnings.length > 0 && (
                  <details className="achk__warns">
                    <summary>경고 {check.warnings.length}건 (내보내기는 가능)</summary>
                    <IssueList issues={check.warnings} onFocus={setSelected} />
                  </details>
                )}
                <p className="achk__time">검사 시각 {new Date(check.at).toLocaleTimeString('ko-KR')}</p>
              </div>
            )}
            {exported.length > 0 && (
              <div className="achk__exported" data-testid="admin-spec-exported">
                <strong>내려받은 파일</strong>
                <ul>
                  {exported.map((f) => (
                    <li key={f}>
                      <button type="button" className="aspec__link" onClick={() => download(f, files[f as keyof typeof files](), f.endsWith('.md') ? 'text/markdown' : 'application/json')}>
                        {f}
                      </button>
                    </li>
                  ))}
                </ul>
                <ol className="achk__steps">
                  <li>specs.json 을 src/data/specs.json 에 덮어쓰기</li>
                  <li>npm test 로 DI-90~ 규칙 확인</li>
                  <li>변경요약.md 내용을 커밋 메시지로 커밋</li>
                </ol>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
