import { useId, useMemo, useRef, useState } from 'react';
import {
  ASSESSED_COVERAGES,
  COVERAGE_LABELS,
  COVERAGES,
  EquipmentCategorySchema,
  EquipmentTypeSchema,
  LAYERS,
  LAYER_LABELS,
  type Category,
  type Coverage,
  type EquipmentCategory,
  type EquipmentImage,
  type EquipmentType,
  type GapAssessment,
  type Layer,
  type Product,
} from '../../lib/schema';
import { CATEGORY_LABELS, CONFIDENCE_LABELS, GAP_BASIS_LABELS, SUPPLY_MODE_LABELS, todayIso } from '../../lib/labels';
import { canonicalGap, suggestId, type Draft } from '../../lib/admin/draft';
import { coverageIssues, koIssue } from '../../lib/admin/integrity';

interface Props {
  draft: Draft;
  /** 수정할 기기 (없으면 새 기기) */
  editing?: EquipmentType;
  categories: Category[];
  products: Product[];
  onSave: (eq: EquipmentType, image: EquipmentImage | null | undefined) => void;
  onCancel: () => void;
}

interface FormState {
  id: string;
  name: string;
  abbr: string;
  layer: Layer;
  voltage: string;
  category: EquipmentCategory;
  coverage: Coverage;
  description: string;
  learnPoints: string;
  lseCategoryCodes: string[];
  productIds: string[];
  gapNote: string;
  affiliateName: string;
  /** 대표 사진 출처 기기 id ('' = 없음/심볼) */
  imageFrom: string;
  /** 공백 판정 근거 (없으면 null) */
  gap: GapForm | null;
}

interface GapForm {
  supplyMode: GapAssessment['supplyMode'];
  basis: GapAssessment['basis'];
  confidence: GapAssessment['confidence'];
  evidence: { type: 'url' | 'doc' | 'meeting'; ref: string; note: string }[];
  verifiedBy: string;
  verifiedAt: string;
  reviewDue: string;
  ratingRequired: string;
  ratingOffered: string;
}

/** 커버리지별 기본 공급 방식 (생성기 SUPPLY 와 같음) */
const DEFAULT_SUPPLY: Partial<Record<Coverage, GapAssessment['supplyMode']>> = {
  missing: 'unknown',
  partial: 'in-house',
  affiliate: 'affiliate',
  sourced: 'panel-sourced',
  owned: 'in-house',
};

const newGap = (coverage: Coverage): GapForm => ({
  supplyMode: DEFAULT_SUPPLY[coverage] ?? 'unknown',
  basis: 'homepage-menu',
  confidence: 'candidate',
  evidence: [],
  verifiedBy: '',
  verifiedAt: '',
  reviewDue: '',
  ratingRequired: '',
  ratingOffered: '',
});

function gapToForm(g: GapAssessment | undefined): GapForm | null {
  if (!g) return null;
  return {
    supplyMode: g.supplyMode,
    basis: g.basis,
    confidence: g.confidence,
    evidence: (g.evidence ?? []).map((e) => ({ type: e.type, ref: e.ref, note: e.note ?? '' })),
    verifiedBy: g.verifiedBy ?? '',
    verifiedAt: g.verifiedAt ?? '',
    reviewDue: g.reviewDue ?? '',
    ratingRequired: g.ratingScope?.required ?? '',
    ratingOffered: g.ratingScope?.offered ?? '',
  };
}

/** 폼 → 공백 판정 근거 (정리 규칙은 draft.canonicalGap 하나 — 리뷰 R7) */
function formToGap(g: GapForm): GapAssessment {
  return canonicalGap({
    supplyMode: g.supplyMode,
    basis: g.basis,
    confidence: g.confidence,
    evidence: g.evidence,
    verifiedBy: g.verifiedBy,
    verifiedAt: g.verifiedAt || undefined,
    reviewDue: g.reviewDue || undefined,
    ratingScope: { required: g.ratingRequired, offered: g.ratingOffered },
  });
}

function initial(editing: EquipmentType | undefined, draft: Draft): FormState {
  if (!editing) {
    return {
      id: '',
      name: '',
      abbr: '',
      layer: 'L6',
      voltage: '',
      category: 'switching',
      coverage: 'owned',
      description: '',
      learnPoints: '',
      lseCategoryCodes: [],
      productIds: [],
      gapNote: '',
      affiliateName: '',
      imageFrom: '',
      gap: null,
    };
  }
  return {
    id: editing.id,
    name: editing.name,
    abbr: editing.abbr ?? '',
    layer: editing.layer,
    voltage: editing.voltage,
    category: editing.category,
    coverage: editing.coverage,
    description: editing.description,
    learnPoints: editing.learnPoints.join('\n'),
    lseCategoryCodes: [...editing.lseCategoryCodes],
    productIds: [...(editing.productIds ?? [])],
    gapNote: editing.gapNote ?? '',
    affiliateName: editing.affiliateName ?? '',
    imageFrom: draft.images[editing.id] ? editing.id : '',
    gap: gapToForm(editing.gapAssessment),
  };
}

/** 폼 → 기기 객체 (빈 선택 필드는 생략) */
function toEquipment(f: FormState): EquipmentType {
  const eq: EquipmentType = {
    id: f.id.trim(),
    name: f.name.trim(),
    layer: f.layer,
    voltage: f.voltage.trim(),
    category: f.category,
    description: f.description.trim(),
    learnPoints: f.learnPoints
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
    coverage: f.coverage,
    lseCategoryCodes: f.lseCategoryCodes,
  };
  if (f.abbr.trim()) eq.abbr = f.abbr.trim();
  if (f.productIds.length) eq.productIds = f.productIds;
  if (f.gapNote.trim()) eq.gapNote = f.gapNote.trim();
  if (f.coverage === 'affiliate' && f.affiliateName.trim()) eq.affiliateName = f.affiliateName.trim();
  if (f.gap) eq.gapAssessment = formToGap(f.gap);
  return eq;
}

type Errors = Partial<Record<keyof FormState, string>>;

function validate(
  f: FormState,
  isNew: boolean,
  takenIds: ReadonlySet<string>,
  ref: { categories: Category[]; products: Product[] },
): { errors: Errors; warnings: Errors } {
  const errors: Errors = {};
  const warnings: Errors = {};
  const eq = toEquipment(f);
  const r = EquipmentTypeSchema.safeParse(eq);
  if (!r.success) {
    for (const i of r.error.issues) {
      const p0 = String(i.path[0] ?? 'id');
      const k = (p0 === 'gapAssessment' ? 'gap' : p0) as keyof FormState;
      errors[k] ??= p0 === 'gapAssessment' ? `공백 판정 — ${koIssue(i)}` : koIssue(i);
    }
  }
  if (!eq.id) errors.id = 'id: 비워 둘 수 없습니다';
  else if (isNew && takenIds.has(eq.id)) errors.id = `id: 이미 있는 기기 id 입니다 (${eq.id})`;
  if (!eq.voltage) errors.voltage ??= '전압: 비워 둘 수 없습니다';
  if (!eq.description) errors.description ??= '설명: 비워 둘 수 없습니다';
  // 기기 규칙(DI-08·20~27h·50) — 무결성 검사·DI 테스트와 같은 함수 (sourced→panel-sourced, 날짜 실존, 근거 URL https 포함)
  for (const c of coverageIssues(eq, ref)) {
    const k = (c.field === 'gapAssessment' ? 'gap' : c.field) as keyof FormState;
    if (c.level === 'error') errors[k] ??= c.message;
    else warnings[k] ??= c.message;
  }
  return { errors, warnings };
}

const FIELD_ORDER: (keyof FormState)[] = [
  'id',
  'name',
  'abbr',
  'layer',
  'voltage',
  'category',
  'coverage',
  'affiliateName',
  'gapNote',
  'gap',
  'description',
  'learnPoints',
  'lseCategoryCodes',
  'productIds',
];

/** 검색해서 여러 개 고르는 칩 선택기 (카테고리·제품) */
function MultiPicker<T>({
  label,
  hint,
  items,
  selected,
  keyOf,
  textOf,
  searchText,
  onChange,
  error,
  testid,
}: {
  label: string;
  hint?: string;
  items: T[];
  selected: string[];
  keyOf: (t: T) => string;
  textOf: (t: T) => string;
  searchText: (t: T) => string;
  onChange: (keys: string[]) => void;
  error?: string;
  testid: string;
}) {
  const id = useId();
  const [q, setQ] = useState('');
  const byKey = useMemo(() => new Map(items.map((t) => [keyOf(t), t])), [items, keyOf]);
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return items.filter((t) => !selected.includes(keyOf(t)) && searchText(t).toLowerCase().includes(s)).slice(0, 8);
  }, [q, items, selected, keyOf, searchText]);
  return (
    <div className="aform__field" data-testid={testid}>
      <label htmlFor={id}>{label}</label>
      {hint && <p className="aform__hint">{hint}</p>}
      {selected.length > 0 && (
        <ul className="aform__chips" aria-label={`선택한 ${label}`}>
          {selected.map((k) => {
            const t = byKey.get(k);
            return (
              <li key={k} className="aform__chip">
                <span>{t ? textOf(t) : `${k} (없는 항목)`}</span>
                <button type="button" aria-label={`${t ? textOf(t) : k} 빼기`} onClick={() => onChange(selected.filter((x) => x !== k))}>
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <input
        id={id}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="이름·코드로 검색"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        autoComplete="off"
      />
      {matches.length > 0 && (
        <ul className="aform__options" aria-label={`${label} 검색 결과`}>
          {matches.map((t) => (
            <li key={keyOf(t)}>
              <button
                type="button"
                onClick={() => {
                  onChange([...selected, keyOf(t)]);
                  setQ('');
                }}
              >
                {textOf(t)}
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim() && matches.length === 0 && <p className="aform__hint">검색 결과 없음</p>}
      {error && (
        <p id={`${id}-err`} className="aform__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** 기기 추가·수정 폼 — EquipmentTypeSchema + 커버리지 규칙(DI-20~26)으로 즉시 검증 */
export default function EquipmentForm({ draft, editing, categories, products, onSave, onCancel }: Props) {
  const isNew = !editing;
  const [f, setF] = useState<FormState>(() => initial(editing, draft));
  const [idTouched, setIdTouched] = useState(!isNew);
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const uid = useId();

  const takenIds = useMemo(() => new Set(draft.equipmentTypes.map((e) => e.id)), [draft]);
  const { errors, warnings } = useMemo(() => validate(f, isNew, takenIds, { categories, products }), [f, isNew, takenIds, categories, products]);
  const show = (k: keyof FormState) => (submitted || touched[k] ? errors[k] : undefined);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setF((prev) => {
      const next = { ...prev, [k]: v };
      // 새 기기: id 를 직접 고치기 전까지 약어·이름에서 자동 제안
      if (isNew && !idTouched && (k === 'abbr' || k === 'name')) next.id = suggestId(next.abbr, next.name, takenIds);
      // 공백류(미보유·일부·계열사·패널 구성품)로 바꾸면 판정 근거 칸을 기본값으로 연다
      if (k === 'coverage') {
        const c = v as Coverage;
        if (ASSESSED_COVERAGES.includes(c) && !next.gap) next.gap = newGap(c);
        else if (next.gap && DEFAULT_SUPPLY[prev.coverage] === next.gap.supplyMode) next.gap = { ...next.gap, supplyMode: DEFAULT_SUPPLY[c] ?? next.gap.supplyMode };
        // 패널 구성품(sourced)은 공급 방식이 panel-sourced 로 고정 (DI-27b)
        if (c === 'sourced' && next.gap) next.gap = { ...next.gap, supplyMode: 'panel-sourced' };
      }
      return next;
    });
    setTouched((t) => ({ ...t, [k]: true }));
  };

  const imageOptions = useMemo(
    () =>
      Object.entries(draft.images)
        .map(([eqId, img]) => {
          const e = draft.equipmentTypes.find((x) => x.id === eqId);
          return { eqId, img, text: `${e ? (e.abbr ?? e.name) : eqId} — ${img.productName ?? img.file}` };
        })
        .sort((a, b) => a.text.localeCompare(b.text, 'ko')),
    [draft],
  );
  const chosenImage = f.imageFrom ? draft.images[f.imageFrom] : undefined;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0) {
      // 첫 오류 칸으로 포커스
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const eq = toEquipment(f);
    let image: EquipmentImage | null | undefined;
    if (!f.imageFrom) image = draft.images[eq.id] ? null : undefined;
    else if (f.imageFrom !== eq.id) image = { ...draft.images[f.imageFrom] };
    onSave(eq, image);
  };

  const errorList = FIELD_ORDER.filter((k) => errors[k]);
  const gapRequired = ASSESSED_COVERAGES.includes(f.coverage);
  const setGap = (patch: Partial<GapForm>) => set('gap', f.gap ? { ...f.gap, ...patch } : null);
  const overdue = !!f.gap?.reviewDue && f.gap.reviewDue < todayIso();

  const fieldProps = (k: keyof FormState) => ({
    id: `${uid}-${k}`,
    'aria-invalid': show(k) ? true : undefined,
    'aria-describedby': show(k) ? `${uid}-${k}-err` : warnings[k] ? `${uid}-${k}-warn` : undefined,
    onBlur: () => setTouched((t) => ({ ...t, [k]: true })),
  });
  const fieldMsg = (k: keyof FormState) => (
    <>
      {show(k) && (
        <p id={`${uid}-${k}-err`} className="aform__error">
          {show(k)}
        </p>
      )}
      {!show(k) && warnings[k] && (
        <p id={`${uid}-${k}-warn`} className="aform__warn">
          {warnings[k]}
        </p>
      )}
    </>
  );

  return (
    <form ref={formRef} className="aform" onSubmit={submit} noValidate data-testid="admin-equipment-form" aria-labelledby={`${uid}-title`}>
      <h2 id={`${uid}-title`} className="aform__title">
        {isNew ? '새 기기 추가' : `기기 수정 — ${editing.name}`}
      </h2>

      {submitted && errorList.length > 0 && (
        <div className="aform__summary" role="alert" data-testid="admin-form-errors">
          <strong>저장할 수 없습니다 — {errorList.length}개 항목을 확인하세요</strong>
          <ul>
            {errorList.map((k) => (
              <li key={k}>{errors[k]}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="aform__row">
        <div className="aform__field">
          <label htmlFor={`${uid}-name`}>
            이름 <span className="aform__req">필수</span>
          </label>
          <input {...fieldProps('name')} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="예: 기중차단기" />
          {fieldMsg('name')}
        </div>
        <div className="aform__field aform__field--narrow">
          <label htmlFor={`${uid}-abbr`}>약어</label>
          <input {...fieldProps('abbr')} value={f.abbr} onChange={(e) => set('abbr', e.target.value)} placeholder="예: ACB" />
          {fieldMsg('abbr')}
        </div>
      </div>

      <div className="aform__field">
        <label htmlFor={`${uid}-id`}>
          id <span className="aform__req">필수</span>
        </label>
        <input
          {...fieldProps('id')}
          value={f.id}
          readOnly={!isNew}
          onChange={(e) => {
            setIdTouched(true);
            set('id', e.target.value);
          }}
          placeholder="영문 소문자·숫자·하이픈 (예: test-cb)"
          spellCheck={false}
        />
        <p className="aform__hint">{isNew ? '약어·이름에서 자동 제안 — /equipment/<id> 주소에 쓰입니다' : '이미 만든 기기의 id 는 바꿀 수 없습니다'}</p>
        {fieldMsg('id')}
      </div>

      <div className="aform__row">
        <div className="aform__field">
          <label htmlFor={`${uid}-layer`}>계층</label>
          <select {...fieldProps('layer')} value={f.layer} onChange={(e) => set('layer', e.target.value as Layer)}>
            {LAYERS.map((l) => (
              <option key={l} value={l}>
                {l} {LAYER_LABELS[l]}
              </option>
            ))}
          </select>
          {!isNew && draft.diagram.nodes.some((n) => n.equipmentTypeId === f.id) && f.layer !== editing.layer && (
            <p className="aform__warn">계층을 바꾸면 기존 노드가 밴드 밖이 될 수 있습니다 — 저장 후 노드를 옮기세요</p>
          )}
        </div>
        <div className="aform__field">
          <label htmlFor={`${uid}-voltage`}>
            전압 <span className="aform__req">필수</span>
          </label>
          <input {...fieldProps('voltage')} value={f.voltage} onChange={(e) => set('voltage', e.target.value)} placeholder="예: 380/220V" />
          {fieldMsg('voltage')}
        </div>
      </div>

      <div className="aform__row">
        <div className="aform__field">
          <label htmlFor={`${uid}-category`}>기능 분류</label>
          <select {...fieldProps('category')} value={f.category} onChange={(e) => set('category', e.target.value as EquipmentCategory)}>
            {EquipmentCategorySchema.options.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="aform__field">
          <label htmlFor={`${uid}-coverage`}>커버리지</label>
          <select {...fieldProps('coverage')} value={f.coverage} onChange={(e) => set('coverage', e.target.value as Coverage)}>
            {COVERAGES.map((c) => (
              <option key={c} value={c}>
                {COVERAGE_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {f.coverage === 'affiliate' && (
        <div className="aform__field">
          <label htmlFor={`${uid}-affiliateName`}>
            계열사명 <span className="aform__req">필수</span>
          </label>
          <input {...fieldProps('affiliateName')} value={f.affiliateName} onChange={(e) => set('affiliateName', e.target.value)} placeholder="예: LS전선" />
          {fieldMsg('affiliateName')}
        </div>
      )}

      <div className="aform__field">
        <label htmlFor={`${uid}-gapNote`}>
          공백 메모 {f.coverage === 'missing' && <span className="aform__req">필수</span>}
          {f.coverage === 'partial' && <span className="aform__opt">권장</span>}
        </label>
        <input
          {...fieldProps('gapNote')}
          value={f.gapNote}
          onChange={(e) => set('gapNote', e.target.value)}
          placeholder="공개 사이트 — 공개 가능한 문구만"
        />
        {fieldMsg('gapNote')}
      </div>

      <fieldset className="aform__gap" data-testid="admin-gap-assessment" aria-describedby={show('gap') ? `${uid}-gap-err` : undefined}>
        <legend>
          공백 판정 근거 {gapRequired ? <span className="aform__req">필수</span> : <span className="aform__opt">선택 (정격 확인 등)</span>}
        </legend>
        {!f.gap ? (
          <>
            {gapRequired && <p className="aform__error">미보유·일부 보유·계열사·패널 구성품 기기는 판정 근거가 필요합니다</p>}
            <button type="button" className="abtn abtn--sm" onClick={() => set('gap', newGap(f.coverage))} data-testid="admin-gap-add">
              + 판정 근거 추가
            </button>
          </>
        ) : (
          <>
            <div className="aform__row">
              <div className="aform__field">
                <label htmlFor={`${uid}-gap-basis`}>판정 근거</label>
                <select
                  id={`${uid}-gap-basis`}
                  value={f.gap.basis}
                  onChange={(e) => {
                    const basis = e.target.value as GapForm['basis'];
                    // 홈페이지 메뉴만으로는 확정 불가 → 후보로
                    setGap(basis === 'homepage-menu' ? { basis, confidence: 'candidate' } : { basis });
                  }}
                  data-testid="admin-gap-basis"
                >
                  {(Object.keys(GAP_BASIS_LABELS) as GapForm['basis'][]).map((b) => (
                    <option key={b} value={b}>
                      {GAP_BASIS_LABELS[b]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="aform__field">
                <label htmlFor={`${uid}-gap-confidence`}>확신도</label>
                <select
                  id={`${uid}-gap-confidence`}
                  value={f.gap.confidence}
                  onChange={(e) => setGap({ confidence: e.target.value as GapForm['confidence'] })}
                  data-testid="admin-gap-confidence"
                >
                  <option value="candidate">{CONFIDENCE_LABELS.candidate} (점선)</option>
                  <option value="confirmed" disabled={f.gap.basis === 'homepage-menu'}>
                    {CONFIDENCE_LABELS.confirmed} (실선){f.gap.basis === 'homepage-menu' ? ' — 홈페이지 근거로는 불가' : ''}
                  </option>
                </select>
              </div>
            </div>
            <div className="aform__field">
              <label htmlFor={`${uid}-gap-supply`}>공급 방식</label>
              <select
                id={`${uid}-gap-supply`}
                value={f.gap.supplyMode}
                onChange={(e) => setGap({ supplyMode: e.target.value as GapForm['supplyMode'] })}
                disabled={f.coverage === 'sourced'}
                aria-describedby={f.coverage === 'sourced' ? `${uid}-gap-supply-hint` : undefined}
                data-testid="admin-gap-supply"
              >
                {(Object.keys(SUPPLY_MODE_LABELS) as GapForm['supplyMode'][]).map((m) => (
                  <option key={m} value={m}>
                    {SUPPLY_MODE_LABELS[m]}
                  </option>
                ))}
              </select>
              {f.coverage === 'sourced' && (
                <p id={`${uid}-gap-supply-hint`} className="aform__hint">
                  패널 구성품은 공급 방식이 "{SUPPLY_MODE_LABELS['panel-sourced']}"으로 고정됩니다
                </p>
              )}
            </div>
            <div className="aform__row">
              <div className="aform__field">
                <label htmlFor={`${uid}-gap-by`}>
                  확인 부서 {f.gap.confidence === 'confirmed' && <span className="aform__req">필수</span>}
                </label>
                <input
                  id={`${uid}-gap-by`}
                  value={f.gap.verifiedBy}
                  onChange={(e) => setGap({ verifiedBy: e.target.value })}
                  placeholder="부서명 (개인 실명 금지)"
                  data-testid="admin-gap-verified-by"
                />
              </div>
              <div className="aform__field">
                <label htmlFor={`${uid}-gap-at`}>
                  확인일 {f.gap.confidence === 'confirmed' && <span className="aform__req">필수</span>}
                </label>
                <input id={`${uid}-gap-at`} type="date" value={f.gap.verifiedAt} onChange={(e) => setGap({ verifiedAt: e.target.value })} data-testid="admin-gap-verified-at" />
              </div>
            </div>
            <div className="aform__field">
              <label htmlFor={`${uid}-gap-due`}>재확인 기한</label>
              <input id={`${uid}-gap-due`} type="date" value={f.gap.reviewDue} onChange={(e) => setGap({ reviewDue: e.target.value })} data-testid="admin-gap-review-due" />
              {overdue && <p className="aform__warn">기한이 지났습니다 — 화면에서는 "재확인 필요" · 공백 후보로 표시됩니다</p>}
            </div>
            <div className="aform__row">
              <div className="aform__field">
                <label htmlFor={`${uid}-gap-req`}>정격 범위 — 필요</label>
                <input id={`${uid}-gap-req`} value={f.gap.ratingRequired} onChange={(e) => setGap({ ratingRequired: e.target.value })} placeholder="예: 345/765kV" />
              </div>
              <div className="aform__field">
                <label htmlFor={`${uid}-gap-off`}>정격 범위 — 자사</label>
                <input id={`${uid}-gap-off`} value={f.gap.ratingOffered} onChange={(e) => setGap({ ratingOffered: e.target.value })} placeholder="예: 170kV까지 / 확인 필요" />
              </div>
            </div>
            <div className="aform__field">
              <span className="aform__label">근거 자료</span>
              <ul className="aform__evidence">
                {f.gap.evidence.map((ev, i) => (
                  <li key={i} className="aform__row">
                    <select
                      aria-label={`근거 ${i + 1} 종류`}
                      value={ev.type}
                      onChange={(e) => setGap({ evidence: f.gap!.evidence.map((x, j) => (j === i ? { ...x, type: e.target.value as typeof ev.type } : x)) })}
                    >
                      <option value="url">링크</option>
                      <option value="doc">문서</option>
                      <option value="meeting">회의</option>
                    </select>
                    <input
                      aria-label={`근거 ${i + 1} 내용`}
                      value={ev.ref}
                      onChange={(e) => setGap({ evidence: f.gap!.evidence.map((x, j) => (j === i ? { ...x, ref: e.target.value } : x)) })}
                      placeholder={ev.type === 'url' ? 'https://…' : ev.type === 'doc' ? '문서명·번호' : '회의명·일자'}
                    />
                    <input
                      aria-label={`근거 ${i + 1} 메모`}
                      value={ev.note}
                      onChange={(e) => setGap({ evidence: f.gap!.evidence.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)) })}
                      placeholder="메모"
                    />
                    <button type="button" className="abtn abtn--sm" aria-label={`근거 ${i + 1} 빼기`} onClick={() => setGap({ evidence: f.gap!.evidence.filter((_, j) => j !== i) })}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="abtn abtn--sm"
                onClick={() => setGap({ evidence: [...f.gap!.evidence, { type: 'url', ref: '', note: '' }] })}
                data-testid="admin-gap-add-evidence"
              >
                + 근거 추가
              </button>
            </div>
            {!gapRequired && (
              <button type="button" className="abtn abtn--sm abtn--danger" onClick={() => set('gap', null)} data-testid="admin-gap-remove">
                판정 근거 삭제
              </button>
            )}
          </>
        )}
        {show('gap') && f.gap && (
          <p id={`${uid}-gap-err`} className="aform__error">
            {show('gap')}
          </p>
        )}
      </fieldset>

      <div className="aform__field">
        <label htmlFor={`${uid}-description`}>
          설명 <span className="aform__req">필수</span>
        </label>
        <textarea {...fieldProps('description')} rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} />
        {fieldMsg('description')}
      </div>

      <div className="aform__field">
        <label htmlFor={`${uid}-learnPoints`}>
          학습 포인트 <span className="aform__hint">(선택 · 화면에 표시하지 않음)</span>
        </label>
        <textarea
          {...fieldProps('learnPoints')}
          rows={3}
          value={f.learnPoints}
          onChange={(e) => set('learnPoints', e.target.value)}
          placeholder="한 줄에 하나씩"
        />
        {fieldMsg('learnPoints')}
      </div>

      <MultiPicker
        label="연결 카테고리 (LS ELECTRIC 제품 분류)"
        hint="하위 카테고리 제품도 함께 연결됩니다"
        items={categories}
        selected={f.lseCategoryCodes}
        keyOf={(c) => c.code}
        textOf={(c) => `${c.path.join(' › ')} (${c.code})`}
        searchText={(c) => `${c.code} ${c.path.join(' ')}`}
        onChange={(v) => set('lseCategoryCodes', v)}
        error={show('lseCategoryCodes')}
        testid="admin-pick-categories"
      />
      {!show('lseCategoryCodes') && warnings.lseCategoryCodes && <p className="aform__warn">{warnings.lseCategoryCodes}</p>}

      <MultiPicker
        label="제품 지정 (특정 제품만)"
        items={products}
        selected={f.productIds}
        keyOf={(p) => p.id}
        textOf={(p) => `${p.name} (${p.id})${p.discontinued ? ' · 단종' : ''}`}
        searchText={(p) => `${p.id} ${p.name} ${p.categoryPath.join(' ')}`}
        onChange={(v) => set('productIds', v)}
        testid="admin-pick-products"
      />

      <div className="aform__field">
        <label htmlFor={`${uid}-image`}>대표 사진</label>
        <div className="aform__image">
          <select id={`${uid}-image`} value={f.imageFrom} onChange={(e) => set('imageFrom', e.target.value)}>
            <option value="">없음 — 단선결선도 심볼로 표시</option>
            {imageOptions.map((o) => (
              <option key={o.eqId} value={o.eqId}>
                {o.text}
              </option>
            ))}
          </select>
          {chosenImage && <img src={`${import.meta.env.BASE_URL}${chosenImage.thumb}`} alt="" width={48} height={48} />}
        </div>
        <p className="aform__hint">이미 받은 기기 사진 중에서 고릅니다 (새 사진 추가는 scripts/fetch-images.mjs)</p>
      </div>

      <div className="aform__actions">
        <button type="submit" className="abtn abtn--primary" data-testid="admin-save">
          {isNew ? '기기 추가' : '수정 저장'}
        </button>
        <button type="button" className="abtn" onClick={onCancel}>
          취소
        </button>
      </div>
    </form>
  );
}
