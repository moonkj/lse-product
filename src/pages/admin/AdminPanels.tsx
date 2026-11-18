import { useMemo, useState } from 'react';
import { COVERAGE_LABELS, LAYER_LABELS, type EquipmentType } from '../../lib/schema';
import { COVERAGE_ICONS } from '../../lib/labels';
import { nodeName, type Draft } from '../../lib/admin/draft';
import { ENTITY_LABELS, KIND_LABELS, type Change, type ChangeEntity } from '../../lib/admin/diff';
import type { Issue } from '../../lib/admin/integrity';

// ───────────────────────── 기기 목록 ─────────────────────────
export function EquipmentList({
  draft,
  placeEquipmentId,
  onAdd,
  onEdit,
  onPlace,
  onDelete,
}: {
  draft: Draft;
  placeEquipmentId?: string;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onPlace: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const count = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of draft.diagram.nodes) m.set(n.equipmentTypeId, (m.get(n.equipmentTypeId) ?? 0) + 1);
    return m;
  }, [draft]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = [...draft.equipmentTypes];
    // 배치 안 된 기기를 위로
    all.sort((a, b) => Number((count.get(a.id) ?? 0) > 0) - Number((count.get(b.id) ?? 0) > 0));
    return s ? all.filter((e) => `${e.id} ${e.name} ${e.abbr ?? ''} ${e.layer}`.toLowerCase().includes(s)) : all;
  }, [draft, q, count]);

  return (
    <div className="alist">
      <div className="alist__head">
        <h2 className="alist__title">기기 종류 {draft.equipmentTypes.length}</h2>
        <button type="button" className="abtn abtn--primary" onClick={onAdd} data-testid="admin-add-equipment">
          + 기기 추가
        </button>
      </div>
      <label className="visually-hidden" htmlFor="admin-eq-search">
        기기 검색
      </label>
      <input
        id="admin-eq-search"
        className="alist__search"
        type="search"
        placeholder="기기 검색 (이름·약어·id·계층)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className="alist__items">
        {list.map((e) => {
          const n = count.get(e.id) ?? 0;
          return (
            <li
              key={e.id}
              className={`alist__item${e.id === placeEquipmentId ? ' is-active' : ''}`}
              data-testid={`admin-eq-${e.id}`}
            >
              <span className={`alist__cov alist__cov--${e.coverage}`} title={COVERAGE_LABELS[e.coverage]} aria-label={COVERAGE_LABELS[e.coverage]}>
                {COVERAGE_ICONS[e.coverage]}
              </span>
              <span className="alist__name">
                <strong>{e.abbr ?? e.name}</strong>
                {e.abbr && <span> {e.name}</span>}
                <small>
                  {e.layer} · {n > 0 ? `노드 ${n}` : <em className="alist__unplaced">미배치</em>}
                </small>
              </span>
              <span className="alist__actions">
                <button type="button" className="abtn abtn--sm" onClick={() => onPlace(e.id)} aria-label={`${e.name} 배치`}>
                  배치
                </button>
                <button type="button" className="abtn abtn--sm" onClick={() => onEdit(e.id)} aria-label={`${e.name} 수정`}>
                  수정
                </button>
                <button
                  type="button"
                  className="abtn abtn--sm abtn--danger"
                  onClick={() => onDelete(e.id)}
                  aria-label={`${e.name} 기기 종류 삭제`}
                  title={n > 0 ? '노드가 남아 있으면 삭제할 수 없습니다' : undefined}
                >
                  삭제
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ───────────────────────── 선택 정보 ─────────────────────────
export function SelectionPanel({
  draft,
  selection,
  onEditEquipment,
  onDeleteNode,
  onStartConnect,
  onMoveNode,
  onSelectEdge,
  onDeleteEdge,
  onUpdateEdge,
}: {
  draft: Draft;
  selection: { type: 'node' | 'edge'; id: string } | null;
  onEditEquipment: (id: string) => void;
  onDeleteNode: (id: string) => void;
  onStartConnect: (id: string) => void;
  onMoveNode: (id: string, x: number, y: number) => void;
  onSelectEdge: (id: string) => void;
  onDeleteEdge: (id: string) => void;
  onUpdateEdge: (id: string, patch: { kind?: 'power' | 'signal'; voltage?: string }) => void;
}) {
  if (!selection) {
    return (
      <div className="asel asel--empty">
        <p>계통도에서 노드나 연결선을 누르면 여기에서 고치거나 지울 수 있습니다.</p>
        <ul className="asel__help">
          <li>
            <strong>선택·이동</strong>: 노드를 끌어 옮김 (10px 그리드), 포커스 후 화살표 키
          </li>
          <li>
            <strong>배치</strong>: 기기를 고르고 계층 밴드 안을 클릭
          </li>
          <li>
            <strong>연결</strong>: 노드 A → 노드 B 순서로 클릭
          </li>
          <li>되돌리기 Ctrl/⌘+Z · 다시 실행 Ctrl/⌘+Shift+Z</li>
        </ul>
      </div>
    );
  }
  if (selection.type === 'node') {
    const n = draft.diagram.nodes.find((x) => x.id === selection.id);
    if (!n) return <p className="asel">선택한 노드가 없습니다.</p>;
    const eq = draft.equipmentTypes.find((e) => e.id === n.equipmentTypeId);
    const edges = draft.diagram.edges.filter((e) => e.from === n.id || e.to === n.id);
    return (
      <div className="asel" data-testid="admin-selection">
        <h3 className="asel__title">{nodeName(draft, n.id)}</h3>
        <dl className="asel__meta">
          <dt>노드 id</dt>
          <dd>{n.id}</dd>
          <dt>기기</dt>
          <dd>
            {eq ? `${eq.id} · ${eq.layer} ${LAYER_LABELS[eq.layer]} · ${COVERAGE_LABELS[eq.coverage]}` : `${n.equipmentTypeId} (없음)`}
          </dd>
        </dl>
        <NodePosition key={`${n.id}-${n.x}-${n.y}`} x={n.x} y={n.y} onApply={(x, y) => onMoveNode(n.id, x, y)} />
        <div className="asel__actions">
          {eq && (
            <button type="button" className="abtn" onClick={() => onEditEquipment(eq.id)}>
              기기 정보 수정
            </button>
          )}
          <button type="button" className="abtn" onClick={() => onStartConnect(n.id)}>
            여기서 연결 시작
          </button>
          <button type="button" className="abtn abtn--danger" onClick={() => onDeleteNode(n.id)} data-testid="admin-delete-node">
            노드 삭제
          </button>
        </div>
        <h4 className="asel__sub">연결선 {edges.length}</h4>
        <ul className="asel__edges">
          {edges.map((e) => (
            <li key={e.id}>
              <button type="button" className="asel__link" onClick={() => onSelectEdge(e.id)}>
                {e.id} {nodeName(draft, e.from)} → {nodeName(draft, e.to)}
              </button>
              <span className="asel__kind">{(e.kind ?? 'power') === 'power' ? '전력' : '신호'}</span>
              <button type="button" className="abtn abtn--sm abtn--danger" onClick={() => onDeleteEdge(e.id)} aria-label={`연결선 ${e.id} 삭제`}>
                삭제
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const e = draft.diagram.edges.find((x) => x.id === selection.id);
  if (!e) return <p className="asel">선택한 연결선이 없습니다.</p>;
  return (
    <div className="asel" data-testid="admin-selection">
      <h3 className="asel__title">
        연결선 {e.id}
      </h3>
      <p>
        {nodeName(draft, e.from)} → {nodeName(draft, e.to)}
      </p>
      <p className="asel__note">{e.points ? `우회 경로 (꺾임 ${e.points.length - 2}회, 자동 계산)` : '기본 직교 경로'}</p>
      <div className="aform__field">
        <label htmlFor="asel-kind">종류</label>
        <select
          id="asel-kind"
          value={e.kind ?? 'power'}
          onChange={(ev) => onUpdateEdge(e.id, { kind: ev.target.value as 'power' | 'signal' })}
        >
          <option value="power">전력선 (굵은 실선)</option>
          <option value="signal">신호선 (가는 점선)</option>
        </select>
      </div>
      <EdgeVoltage key={`${e.id}-${e.voltage ?? ''}`} value={e.voltage ?? ''} onApply={(v) => onUpdateEdge(e.id, { voltage: v })} />
      <div className="asel__actions">
        <button type="button" className="abtn abtn--danger" onClick={() => onDeleteEdge(e.id)} data-testid="admin-delete-edge">
          연결선 삭제
        </button>
      </div>
    </div>
  );
}

function NodePosition({ x, y, onApply }: { x: number; y: number; onApply: (x: number, y: number) => void }) {
  const [vx, setVx] = useState(String(x));
  const [vy, setVy] = useState(String(y));
  return (
    <form
      className="asel__pos"
      onSubmit={(e) => {
        e.preventDefault();
        const nx = Number(vx);
        const ny = Number(vy);
        if (Number.isFinite(nx) && Number.isFinite(ny)) onApply(Math.round(nx), Math.round(ny));
      }}
    >
      <label>
        x <input type="number" step={10} value={vx} onChange={(e) => setVx(e.target.value)} />
      </label>
      <label>
        y <input type="number" step={10} value={vy} onChange={(e) => setVy(e.target.value)} />
      </label>
      <button type="submit" className="abtn abtn--sm">
        위치 적용
      </button>
    </form>
  );
}

function EdgeVoltage({ value, onApply }: { value: string; onApply: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <div className="aform__field">
      <label htmlFor="asel-voltage">전압 라벨</label>
      <input
        id="asel-voltage"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== value && onApply(v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && v !== value) onApply(v);
        }}
        placeholder="예: 380V (없으면 비움)"
        list="admin-voltages"
      />
    </div>
  );
}

// ───────────────────────── 변경 내역 ─────────────────────────
export function ChangesPanel({
  changes,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onReset,
  onDownloadSummary,
}: {
  changes: Change[];
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onDownloadSummary: () => void;
}) {
  const groups: ChangeEntity[] = ['equipment', 'node', 'edge', 'image'];
  return (
    <div className="achg" data-testid="admin-changes">
      <div className="achg__head">
        <strong>원본 대비 변경 {changes.length}건</strong>
        <span className="achg__btns">
          <button type="button" className="abtn abtn--sm" onClick={onUndo} disabled={!canUndo}>
            되돌리기
          </button>
          <button type="button" className="abtn abtn--sm" onClick={onRedo} disabled={!canRedo}>
            다시 실행
          </button>
        </span>
      </div>
      {changes.length === 0 ? (
        <p className="achg__empty">원본(src/data)과 같습니다.</p>
      ) : (
        groups.map((g) => {
          const list = changes.filter((c) => c.entity === g);
          if (!list.length) return null;
          return (
            <section key={g} className="achg__group">
              <h4>
                {ENTITY_LABELS[g]} {list.length}
              </h4>
              <ul>
                {list.map((c) => (
                  <li key={`${c.entity}-${c.id}`} className={`achg__item achg__item--${c.kind}`} data-change-kind={c.kind}>
                    <span className="achg__kind">{KIND_LABELS[c.kind]}</span> {c.text}
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
      <div className="achg__foot">
        <button type="button" className="abtn" onClick={onDownloadSummary} disabled={changes.length === 0}>
          변경 요약 .md 내려받기
        </button>
        <button type="button" className="abtn abtn--danger" onClick={onReset} disabled={changes.length === 0} data-testid="admin-reset">
          초안 초기화
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── 검사·내보내기 ─────────────────────────
export function CheckPanel({
  issues,
  checkedAt,
  exported,
  counts,
  onCheck,
  onFocusIssue,
  onDownload,
}: {
  issues: Issue[] | null;
  checkedAt: number | null;
  exported: string[];
  counts: { equipment: number; nodes: number; edges: number };
  onCheck: () => void;
  onFocusIssue: (i: Issue) => void;
  onDownload: (file: string) => void;
}) {
  const errors = issues?.filter((i) => i.level === 'error') ?? [];
  const warns = issues?.filter((i) => i.level === 'warn') ?? [];
  const IssueRow = ({ i }: { i: Issue }) => (
    <li className={`achk__issue achk__issue--${i.level}`}>
      <span className="achk__area">{i.area}</span> {i.message}
      {(i.nodeId || i.equipmentId) && (
        <button type="button" className="abtn abtn--sm" onClick={() => onFocusIssue(i)}>
          보기
        </button>
      )}
    </li>
  );
  return (
    <div className="achk" data-testid="admin-check">
      <p className="achk__intro">
        내보내기 전에 스키마·참조(노드→기기, 연결선→노드, 카테고리·제품)·타일 겹침·밴드 이탈·연결선 타일 관통을 모두 검사합니다. 오류가 있으면 내보낼 수 없습니다.
      </p>
      <button type="button" className="abtn" onClick={onCheck} data-testid="admin-check-run">
        무결성 검사 실행
      </button>
      {issues && (
        <div className="achk__result" aria-live="polite">
          {errors.length === 0 ? (
            <p className="achk__ok" data-testid="admin-check-ok">
              ✓ 검사 통과 — 기기 {counts.equipment}종 · 노드 {counts.nodes} · 연결선 {counts.edges}
              {warns.length > 0 && ` (경고 ${warns.length})`}
            </p>
          ) : (
            <div className="achk__errors" role="alert" data-testid="admin-validation-errors">
              <strong>오류 {errors.length}건 — 고친 뒤 다시 내보내세요</strong>
              <ul>
                {errors.map((i, k) => (
                  <IssueRow key={k} i={i} />
                ))}
              </ul>
            </div>
          )}
          {warns.length > 0 && (
            <details className="achk__warns">
              <summary>경고 {warns.length}건 (내보내기는 가능)</summary>
              <ul>
                {warns.map((i, k) => (
                  <IssueRow key={k} i={i} />
                ))}
              </ul>
            </details>
          )}
          {checkedAt && <p className="achk__time">검사 시각 {new Date(checkedAt).toLocaleTimeString('ko-KR')}</p>}
        </div>
      )}
      {exported.length > 0 && (
        <div className="achk__exported" data-testid="admin-exported">
          <strong>내보낸 파일</strong>
          <ul>
            {exported.map((f) => (
              <li key={f}>
                <button type="button" className="asel__link" onClick={() => onDownload(f)}>
                  {f} 다시 받기
                </button>
              </li>
            ))}
          </ul>
          <ol className="achk__steps">
            <li>
              JSON 파일을 저장소 <code>src/data/</code> 에 덮어씁니다 (같은 이름).
            </li>
            <li>
              <code>npm run test:data</code> 로 데이터 검사를 돌립니다.
            </li>
            <li>변경 요약 .md 내용을 커밋 메시지로 커밋하면 배포 후 모두에게 반영됩니다.</li>
          </ol>
        </div>
      )}
      <div className="achk__gh">
        <button type="button" className="abtn" disabled aria-describedby="admin-gh-note">
          GitHub에 바로 반영 (준비 중)
        </button>
        <p id="admin-gh-note" className="aform__hint">
          원격 저장소를 연결한 뒤 2단계에서 제공합니다. 지금은 내보낸 파일을 직접 커밋하세요.
        </p>
      </div>
    </div>
  );
}

export function equipmentLabel(e: EquipmentType) {
  return e.abbr ? `${e.abbr} ${e.name}` : e.name;
}
