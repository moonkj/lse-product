/**
 * 단위 테스트 (UT-16, v1.2) — 관리자 "사양 검수" 편집 연산 src/lib/admin/specs.ts + 초안 스토어 specsStore.ts.
 * 합성 specs 파일로 검증하고 기대값은 손으로 적는다. 편집 결과는 공용 검사 checkSpecs 로도 확인(내보내기 차단 계약).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SpecsFile } from '../../../src/lib/schema';
import {
  addItem,
  addVariant,
  computeSpecChanges,
  deleteItem,
  deleteVariant,
  renameVariant,
  reviewStamp,
  reviewerError,
  setReviewed,
  setVariantAxis,
  specChangesMarkdown,
  updateItem,
  updateVariantPage,
} from '../../../src/lib/admin/specs';
import { checkSpecs } from '../../../src/lib/integrity';

const URL_A = 'https://www.ls-electric.com/ko/cat/A.pdf';
function base(): SpecsFile {
  return {
    generatedAt: '2026-11-18T00:00:00+09:00',
    products: {
      P90001: {
        items: [
          { key: 'ratedVoltage', label: '정격전압', value: '690', unit: 'V', page: 3 },
          { key: 'poles', label: '극수', value: '3 / 4', unit: 'P' },
        ],
        variantAxis: '프레임',
        variants: [
          { id: 'ts250', label: 'TS250', page: 5, items: [{ key: 'frame', label: '프레임', value: '250', unit: 'AF' }] },
          { id: 'ts400', label: 'TS400', items: [{ key: 'frame', label: '프레임', value: '400', unit: 'AF', page: 6 }] },
        ],
        source: { title: '[A]', url: URL_A, page: 2 },
        extractedAt: '2026-11-18',
        reviewed: false,
        note: '기존 메모',
      },
      P90002: {
        items: [{ key: 'ratedCurrent', label: '정격전류', value: '100', unit: 'A', page: 1 }],
        source: { title: '[B]', url: URL_A, page: 1 },
        extractedAt: '2026-11-18',
        reviewed: false,
      },
    },
  };
}
const C = { productId: 'P90001' };
const V = (variantId: string) => ({ productId: 'P90001', variantId });
const check = (f: SpecsFile) =>
  checkSpecs({ specs: f, productIds: new Set(['P90001', 'P90002']), docUrlsByProduct: new Map([['P90001', [URL_A]], ['P90002', [URL_A]]]), today: '2026-11-18' });
const DATE = '2026-11-18';

describe('UT-16 updateItem·addItem·deleteItem', () => {
  it('updateItem: 값 수정, 원본 불변, 다른 제품 객체는 그대로(같은 참조), 키 순서 유지', () => {
    const f = base();
    const r = updateItem(f, C, 'ratedVoltage', { value: ' 1000 ' });
    expect(r.error).toBeUndefined();
    expect(r.file.products.P90001.items[0]).toEqual({ key: 'ratedVoltage', label: '정격전압', value: '1000', unit: 'V', page: 3 });
    expect(Object.keys(r.file.products.P90001.items[0])).toEqual(['key', 'label', 'value', 'unit', 'page']);
    expect(Object.keys(r.file.products.P90001)).toEqual(Object.keys(f.products.P90001));
    expect(f.products.P90001.items[0].value).toBe('690');
    expect(r.file.products.P90002).toBe(f.products.P90002);
  });

  it('updateItem: 빈 단위·페이지 → 필드 삭제, 페이지 문자열 → 정수, 0·소수·음수 → 오류, 빈 label·value → 오류', () => {
    const f = base();
    const r = updateItem(f, C, 'ratedVoltage', { unit: '', page: '' });
    expect(r.file.products.P90001.items[0]).toEqual({ key: 'ratedVoltage', label: '정격전압', value: '690' });
    expect(updateItem(f, C, 'poles', { page: '7' }).file.products.P90001.items[1].page).toBe(7);
    for (const page of ['0', '1.5', '-2', 'x']) expect(updateItem(f, C, 'poles', { page }).error, page).toMatch(/1 이상의 정수/);
    expect(updateItem(f, C, 'poles', { label: ' ' }).error).toMatch(/label/);
    expect(updateItem(f, C, 'poles', { value: '' }).error).toMatch(/값/);
    // 오류면 파일 그대로 (같은 참조)
    expect(updateItem(f, C, 'poles', { value: '' }).file).toBe(f);
  });

  it('updateItem: 옵션 범위·없는 key·없는 제품·key 변경 충돌(같은 범위, 공통↔옵션)', () => {
    const f = base();
    expect(updateItem(f, V('ts250'), 'frame', { value: '225' }).file.products.P90001.variants![0].items[0].value).toBe('225');
    expect(updateItem(f, V('ts250'), 'nope', { value: '1' }).error).toMatch(/nope/);
    expect(updateItem(f, V('zz'), 'frame', { value: '1' }).error).toBeTruthy();
    expect(updateItem(f, { productId: 'P99999' }, 'frame', { value: '1' }).error).toMatch(/P99999/);
    expect(updateItem(f, C, 'poles', { key: 'ratedVoltage' }).error).toMatch(/이미/);
    expect(updateItem(f, C, 'poles', { key: 'frame' }).error).toMatch(/옵션 ts250/);
    expect(updateItem(f, V('ts250'), 'frame', { key: 'poles' }).error).toMatch(/공통 사양/);
    expect(updateItem(f, C, 'poles', { key: 'polesCount' }).file.products.P90001.items[1].key).toBe('polesCount');
  });

  it('addItem: 끝에 추가(단위·페이지 정리), key 형식(영문 camelCase), 충돌·없는 옵션 거부', () => {
    const f = base();
    const r = addItem(f, C, { key: 'frequency', label: '정격주파수', value: '50/60', unit: 'Hz', page: '4' });
    expect(r.file.products.P90001.items.at(-1)).toEqual({ key: 'frequency', label: '정격주파수', value: '50/60', unit: 'Hz', page: 4 });
    expect(addItem(f, V('ts400'), { key: 'ratedCurrent', label: '정격전류', value: '400', unit: '' }).file.products.P90001.variants![1].items.at(-1)).toEqual({
      key: 'ratedCurrent',
      label: '정격전류',
      value: '400',
    });
    for (const key of ['', 'rated-voltage', '9a', '정격', 'a b']) expect(addItem(f, C, { key, label: 'x', value: 'y' }).error, key).toBeTruthy();
    expect(addItem(f, C, { key: 'poles', label: '극수', value: '3' }).error).toMatch(/이미/);
    expect(addItem(f, C, { key: 'frame', label: '프레임', value: '1' }).error).toMatch(/옵션 ts250/);
    expect(addItem(f, V('ts250'), { key: 'poles', label: '극수', value: '3' }).error).toMatch(/공통 사양/);
    expect(addItem(f, V('zz'), { key: 'k', label: 'x', value: 'y' }).error).toMatch(/zz/);
    expect(addItem(f, C, { key: 'k', label: '', value: 'y' }).error).toBeTruthy();
  });

  it('deleteItem: 해당 범위에서만 삭제, 없으면 오류', () => {
    const f = base();
    expect(deleteItem(f, C, 'poles').file.products.P90001.items.map((i) => i.key)).toEqual(['ratedVoltage']);
    expect(deleteItem(f, V('ts250'), 'frame').file.products.P90001.variants![0].items).toEqual([]);
    expect(deleteItem(f, C, 'frame').error).toBeTruthy();
  });
});

describe('UT-16 옵션 편집', () => {
  it('addVariant: 형식·중복·이름·기준 이름 검사, 항목 0개로 추가 → checkSpecs DI-96 오류(내보내기 차단)', () => {
    const f = base();
    expect(addVariant(f, 'P90001', { id: 'TS630', label: 'x' }).error).toMatch(/kebab/);
    expect(addVariant(f, 'P90001', { id: 'ts:630', label: 'x' }).error).toMatch(/kebab/);
    expect(addVariant(f, 'P90001', { id: 'ts630', label: ' ' }).error).toBeTruthy();
    expect(addVariant(f, 'P90001', { id: 'ts250', label: '새' }).error).toMatch(/이미/);
    expect(addVariant(f, 'P90001', { id: 'ts630', label: 'TS250' }).error).toMatch(/이미/);
    expect(addVariant(f, 'P90001', { id: 'ts630', label: 'TS630', page: '0' }).error).toMatch(/정수/);
    const r = addVariant(f, 'P90001', { id: 'ts630', label: 'TS630', page: '8', axis: '무시됨' });
    expect(r.file.products.P90001.variants!.at(-1)).toEqual({ id: 'ts630', label: 'TS630', page: 8, items: [] });
    expect(r.file.products.P90001.variantAxis).toBe('프레임'); // 기존 기준 이름 유지
    expect(check(r.file).errors.map((i) => i.rule)).toEqual(['DI-96']);
    // 옵션 없던 제품: 기준 이름 필수, 주면 설정
    expect(addVariant(f, 'P90002', { id: 'a', label: 'A' }).error).toMatch(/variantAxis/);
    const r2 = addVariant(f, 'P90002', { id: 'a', label: 'A', axis: ' 용량 ' });
    expect([r2.file.products.P90002.variantAxis, r2.file.products.P90002.variants!.length]).toEqual(['용량', 1]);
  });

  it('renameVariant·updateVariantPage·setVariantAxis', () => {
    const f = base();
    expect(renameVariant(f, 'P90001', 'ts250', ' TS250 (250AF) ').file.products.P90001.variants![0].label).toBe('TS250 (250AF)');
    expect(renameVariant(f, 'P90001', 'ts250', 'TS400').error).toMatch(/이미/);
    expect(renameVariant(f, 'P90001', 'ts250', '').error).toBeTruthy();
    expect(renameVariant(f, 'P90001', 'zz', 'Z').error).toMatch(/zz/);
    expect(updateVariantPage(f, 'P90001', 'ts250', '').file.products.P90001.variants![0]).not.toHaveProperty('page');
    expect(updateVariantPage(f, 'P90001', 'ts400', '9').file.products.P90001.variants![1].page).toBe(9);
    expect(updateVariantPage(f, 'P90001', 'ts400', '0').error).toBeTruthy();
    expect(setVariantAxis(f, 'P90001', '').error).toMatch(/variantAxis/);
    expect(setVariantAxis(f, 'P90002', '').file.products.P90002).not.toHaveProperty('variantAxis');
    expect(setVariantAxis(f, 'P90001', '정격전류').file.products.P90001.variantAxis).toBe('정격전류');
  });

  it('deleteVariant: 하나 삭제, 마지막 옵션이면 variants·variantAxis 도 삭제, 공통이 없으면 마지막 옵션 삭제 거부', () => {
    const f = base();
    const one = deleteVariant(f, 'P90001', 'ts250').file;
    expect(one.products.P90001.variants!.map((v) => v.id)).toEqual(['ts400']);
    const none = deleteVariant(one, 'P90001', 'ts400').file;
    expect(none.products.P90001).not.toHaveProperty('variants');
    expect(none.products.P90001).not.toHaveProperty('variantAxis');
    expect(check(none).errors).toEqual([]);
    expect(deleteVariant(f, 'P90001', 'zz').error).toMatch(/zz/);
    const noCommon = deleteItem(deleteItem(one, C, 'ratedVoltage').file, C, 'poles').file;
    expect(deleteVariant(noCommon, 'P90001', 'ts400').error).toMatch(/공통 사양이 없어/);
  });
});

describe('UT-16 검수 표시 setReviewed·reviewerError', () => {
  it('reviewerError: 빈 값·이메일·전화·부서 접미사 없음·40자 초과 → 오류, 부서명 → 통과', () => {
    expect(reviewerError('')).toMatch(/입력/);
    expect(reviewerError('   ')).toMatch(/입력/);
    expect(reviewerError('qa@ls.com 품질팀')).toMatch(/이메일·전화번호/);
    expect(reviewerError('품질팀 010-1234-5678')).toMatch(/이메일·전화번호/);
    expect(reviewerError('홍길동')).toMatch(/부서명/);
    expect(reviewerError(`${'가'.repeat(40)}팀`)).toMatch(/40자/);
    for (const ok of ['품질보증팀', '기술영업부', '전력연구소', '설계실', '고객지원센터', '전력사업', '제품맵 운영그룹']) expect(reviewerError(ok), ok).toBeUndefined();
  });

  it('(한계 기록) 부서 접미사는 글자 포함 여부만 봄 — "박소연"·"이실장" 같은 이름도 통과 (DI-27h 와 같은 규칙)', () => {
    expect(reviewerError('박소연')).toBeUndefined();
    expect(reviewerError('이실장')).toBeUndefined();
  });

  it('검수 완료: reviewed=true + note 끝에 " · 검수: {부서} {날짜}", note 없으면 문구만, 다시 완료해도 1번', () => {
    const f = base();
    const r = setReviewed(f, 'P90001', true, ' 품질보증팀 ', DATE);
    expect(r.file.products.P90001.reviewed).toBe(true);
    expect(r.file.products.P90001.note).toBe(`기존 메모 · 검수: 품질보증팀 ${DATE}`);
    expect(reviewStamp(' 품질보증팀 ', DATE)).toBe(`검수: 품질보증팀 ${DATE}`);
    const again = setReviewed(r.file, 'P90001', true, '기술영업부', '2026-11-19').file;
    expect(again.products.P90001.note).toBe('기존 메모 · 검수: 기술영업부 2026-11-19');
    expect(setReviewed(f, 'P90002', true, '품질보증팀', DATE).file.products.P90002.note).toBe(`검수: 품질보증팀 ${DATE}`);
    expect(check(r.file).errors).toEqual([]);
  });

  it('검수 해제: reviewed=false + 검수 문구 제거(원래 note 복원, 문구만 있었으면 note 삭제)', () => {
    const f = base();
    const done = setReviewed(f, 'P90001', true, '품질보증팀', DATE).file;
    expect(setReviewed(done, 'P90001', false).file.products.P90001).toMatchObject({ reviewed: false, note: '기존 메모' });
    const done2 = setReviewed(f, 'P90002', true, '품질보증팀', DATE).file;
    const undone2 = setReviewed(done2, 'P90002', false).file.products.P90002;
    expect(undone2.reviewed).toBe(false);
    expect(undone2).not.toHaveProperty('note');
    // 해제 후 원본과 내용 동일 → 변경 없음
    expect(computeSpecChanges(f, setReviewed(done, 'P90001', false).file)).toEqual([]);
  });

  it('부서명 규칙 위반이면 검수 완료 거부 (파일 그대로)', () => {
    const f = base();
    const r = setReviewed(f, 'P90001', true, '홍길동', DATE);
    expect(r.error).toMatch(/부서명/);
    expect(r.file).toBe(f);
    expect(setReviewed(f, 'P90001', true, '', DATE).error).toMatch(/입력/);
  });

  // [BUG 재현 · 기대 실패] 부서명에 가운뎃점(·)이 있으면 검수 문구 정규식([^·]+)이 못 찾아
  // 해제해도 문구가 남고, 다시 완료하면 문구가 2번 붙는다. reviewerError 는 '·' 를 막지 않음.
  // 수정(부서명에서 '·' 거부 또는 정규식 수정)되면 it.fails → it.
  it('[B3 수정] 부서명에 "·" 가 있어도 검수 해제 시 문구가 지워짐', () => {
    const f = base();
    expect(reviewerError('품질·보증팀')).toBeUndefined();
    const done = setReviewed(f, 'P90001', true, '품질·보증팀', DATE).file;
    expect(setReviewed(done, 'P90001', false).file.products.P90001.note).toBe('기존 메모');
  });
});

describe('UT-16 computeSpecChanges·변경요약', () => {
  it('변경 없음 → [] (복제본이어도)', () => {
    expect(computeSpecChanges(base(), base())).toEqual([]);
  });

  it('항목 수정·추가·삭제, 옵션 이름·페이지·추가·삭제, 기준 이름, note, 제품 추가·삭제 — 한 줄씩', () => {
    const b = base();
    let d = updateItem(b, C, 'ratedVoltage', { value: '1000' }).file;
    d = addItem(d, C, { key: 'frequency', label: '정격주파수', value: '60', unit: 'Hz' }).file;
    d = deleteItem(d, C, 'poles').file;
    d = renameVariant(d, 'P90001', 'ts250', 'TS250N').file;
    d = updateVariantPage(d, 'P90001', 'ts250', '').file;
    d = deleteVariant(d, 'P90001', 'ts400').file;
    d = addVariant(d, 'P90001', { id: 'ts630', label: 'TS630' }).file;
    d = setVariantAxis(d, 'P90001', '프레임 크기').file;
    d = { ...d, products: { ...d.products, P90001: { ...d.products.P90001, note: '새 메모' } } };
    const { P90002, ...rest } = d.products;
    void P90002;
    d = { ...d, products: { ...rest, P90009: b.products.P90002 } };
    const lines = computeSpecChanges(b, d).map((c) => `${c.productId}|${c.kind}|${c.text}`);
    expect(lines).toEqual([
      'P90001|modified|옵션 기준: 프레임 → 프레임 크기',
      'P90001|modified|메모(note) 수정',
      'P90001|modified|공통 항목 ratedVoltage: 정격전압 690 V (p.3) → 정격전압 1000 V (p.3)',
      'P90001|added|공통 항목 frequency: 정격주파수 60 Hz',
      'P90001|deleted|공통 항목 poles: 극수 3 / 4 P',
      'P90001|modified|옵션 ts250 이름: "TS250" → "TS250N"',
      'P90001|modified|옵션 ts250 페이지: 5 → 없음',
      'P90001|added|옵션 ts630 "TS630" (항목 0개)',
      'P90001|deleted|옵션 ts400 "TS400" (항목 1개)',
      'P90009|added|제품 사양 추가',
      'P90002|deleted|제품 사양 삭제',
    ]);
  });

  it('검수 완료·해제는 reviewed/unreviewed 한 줄 (검수 문구는 note 수정으로 세지 않음)', () => {
    const b = base();
    const done = setReviewed(b, 'P90001', true, '품질보증팀', DATE).file;
    expect(computeSpecChanges(b, done)).toEqual([{ productId: 'P90001', kind: 'reviewed', text: `검수 완료 전환 (검수: 품질보증팀 ${DATE})` }]);
    const doneBase = done;
    expect(computeSpecChanges(doneBase, setReviewed(done, 'P90001', false).file)).toEqual([
      { productId: 'P90001', kind: 'unreviewed', text: '검수 해제 (검수 전으로)' },
    ]);
  });

  it('specChangesMarkdown: 커밋 제목 줄(검수 n개 제품, 수정 m건) + 결과 줄 + 제품별 목록', () => {
    const b = base();
    let d = setReviewed(b, 'P90001', true, '품질보증팀', DATE).file;
    d = updateItem(d, { productId: 'P90002' }, 'ratedCurrent', { value: '125' }).file;
    const md = specChangesMarkdown(computeSpecChanges(b, d), (id) => `제품${id}`, d);
    const lines = md.split('\n');
    expect(lines[0]).toBe('data: 정격 사양 검수 (검수 완료 1개 제품, 사양 수정 1건)');
    expect(md).toContain('결과: 사양 제품 2개 · 검수 완료 1개 · 검수 전 1개');
    expect(md).toContain('### 제품P90001 (P90001)');
    expect(md).toContain('- 수정: 공통 항목 ratedCurrent: 정격전류 100 A (p.1) → 정격전류 125 A (p.1)');
    expect(specChangesMarkdown([], (id) => id, b).split('\n')[0]).toBe('data: 정격 사양 검수 (변경 없음)');
  });
});

// ─────────────────────────────────────────────────────────────
// specsStore — 초안·되돌리기·자동 저장·원본 변경 경고 (실제 specs.json 사용, 모듈은 테스트마다 새로)
// ─────────────────────────────────────────────────────────────
type StoreMod = typeof import('../../../src/lib/admin/specsStore');
async function freshStore(saved?: unknown): Promise<StoreMod> {
  vi.resetModules();
  localStorage.clear();
  const m = await import('../../../src/lib/admin/specsStore');
  if (saved !== undefined) localStorage.setItem(m.SPECS_STORAGE_KEY, typeof saved === 'string' ? saved : JSON.stringify(saved));
  return m;
}

describe('UT-16 specsStore', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('load → ready, draft = base 복제(다른 객체), 저장본 없음 → staleBase false, 두 번 불러도 한 번', async () => {
    const m = await freshStore();
    const s = () => m.useSpecsAdminStore.getState();
    expect(s().status).toBe('idle');
    await s().load();
    expect(s().status).toBe('ready');
    expect(s().draft).toEqual(s().base);
    expect(s().draft).not.toBe(s().base);
    expect(s().baseSig).toBe(m.specsSignature(s().base!));
    expect([s().staleBase, s().restoredAt]).toEqual([false, null]);
    const b = s().base;
    await s().load();
    expect(s().base).toBe(b);
  });

  it('commit·undo·redo, 같은 객체 commit 은 무시, 새 commit 은 redo 목록 비움, 기록 50단계', async () => {
    const m = await freshStore();
    const s = () => m.useSpecsAdminStore.getState();
    await s().load();
    const d0 = s().draft!;
    const pid = Object.keys(d0.products)[0];
    const d1 = setReviewed(d0, pid, true, '품질보증팀', DATE).file;
    s().commit(d1);
    s().commit(d1);
    expect(s().past).toHaveLength(1);
    s().undo();
    expect(s().draft).toBe(d0);
    s().redo();
    expect(s().draft).toBe(d1);
    s().undo();
    s().commit(setReviewed(d0, pid, true, '기술영업부', DATE).file);
    expect(s().future).toEqual([]);
    for (let i = 0; i < 60; i++) s().commit({ ...s().draft!, generatedAt: `g${i}` });
    expect(s().past.length).toBe(50);
  });

  it('자동 저장(300ms): 변경 → localStorage 에 {savedAt, baseSig, draft}, 원본과 같아지면 저장본 삭제, resetToBase', async () => {
    const m = await freshStore();
    const s = () => m.useSpecsAdminStore.getState();
    await s().load();
    vi.useFakeTimers();
    const pid = Object.keys(s().draft!.products)[0];
    s().commit(setReviewed(s().draft!, pid, true, '품질보증팀', DATE).file);
    expect(localStorage.getItem(m.SPECS_STORAGE_KEY)).toBeNull();
    vi.advanceTimersByTime(300);
    const saved = JSON.parse(localStorage.getItem(m.SPECS_STORAGE_KEY)!);
    expect(saved.baseSig).toBe(s().baseSig);
    expect(saved.draft.products[pid].reviewed).toBe(true);
    expect(s().saveStatus).toBe('saved');
    s().resetToBase();
    expect(s().draft).toEqual(s().base);
    vi.advanceTimersByTime(300);
    expect(localStorage.getItem(m.SPECS_STORAGE_KEY)).toBeNull();
  });

  it('저장본 복원: 같은 원본이면 staleBase false, 원본이 바뀌었으면(baseSig 다름) staleBase true + restoredAt', async () => {
    let m = await freshStore();
    await m.useSpecsAdminStore.getState().load();
    const { base: b, baseSig } = m.useSpecsAdminStore.getState();
    const pid = Object.keys(b!.products)[0];
    const draft = setReviewed(b!, pid, true, '품질보증팀', DATE).file;

    m = await freshStore({ savedAt: '2026-11-18T01:00:00Z', baseSig, draft });
    await m.useSpecsAdminStore.getState().load();
    let s = m.useSpecsAdminStore.getState();
    expect(s.draft!.products[pid].reviewed).toBe(true);
    expect([s.staleBase, s.restoredAt]).toEqual([false, '2026-11-18T01:00:00Z']);

    m = await freshStore({ savedAt: '2026-11-17T01:00:00Z', baseSig: 'old-sig', draft });
    await m.useSpecsAdminStore.getState().load();
    s = m.useSpecsAdminStore.getState();
    expect([s.staleBase, s.restoredAt]).toEqual([true, '2026-11-17T01:00:00Z']);
    s.resetToBase();
    expect(m.useSpecsAdminStore.getState().staleBase).toBe(false);
  });

  it('저장본 손상(JSON 깨짐·products 없음) → 무시하고 원본으로', async () => {
    for (const bad of ['{"draft":', JSON.stringify({ savedAt: 'x', baseSig: 'y', draft: {} }), 'null']) {
      const m = await freshStore(bad);
      await m.useSpecsAdminStore.getState().load();
      const s = m.useSpecsAdminStore.getState();
      expect(s.status).toBe('ready');
      expect(s.draft).toEqual(s.base);
      expect(s.restoredAt).toBeNull();
    }
  });

  it('specsSignature: 내용이 같으면 같고 한 글자만 달라도 다름', async () => {
    const m = await freshStore();
    expect(m.specsSignature(base())).toBe(m.specsSignature(base()));
    const d = updateItem(base(), C, 'ratedVoltage', { value: '691' }).file;
    expect(m.specsSignature(d)).not.toBe(m.specsSignature(base()));
  });
});
