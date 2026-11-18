// @vitest-environment node
/**
 * 단위 테스트 (UX 토론 B6·B8·C6) — 명판 형식명·옵션명 검색 색인, 화면용 사양 메모, 차이만 보기 주소 저장.
 * 검색은 실제 specs.json·products.json 으로 확인한다 (현장 재현 질의: TS250·250AF·ABN·TD100 = 이전 0건).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { buildOptionIndex, modelTokens, normalizeModel, optionHref, productNameExact, searchOptions } from '../../../src/lib/search';
import { publicNote, withDiffParam } from '../../../src/lib/pages/compare';
import type { ProductSpecs } from '../../../src/lib/schema';

const readJson = <T,>(rel: string) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')) as T;
const specsFile = readJson<{ products: Record<string, ProductSpecs> }>('../../../src/data/specs.json');
const productsFile = readJson<{ products: { id: string; name: string }[] } | { id: string; name: string }[]>('../../../src/data/products.json');
const productList = Array.isArray(productsFile) ? productsFile : productsFile.products;
const names = new Map(productList.map((p) => [p.id, p.name]));
const index = buildOptionIndex(new Map(Object.entries(specsFile.products)), (id) => names.get(id));
const hitKeys = (q: string) => searchOptions(index, q, 20).map((h) => `${h.doc.productId}:${h.doc.variantId}`);

describe('B6 형식명 토큰', () => {
  it('정규화: 대소문자·공백·하이픈 무시', () => {
    expect(normalizeModel('ts 250')).toBe('TS250');
    expect(normalizeModel('AH-06D')).toBe('AH06D');
  });
  it('슬래시 묶음 펼치기·괄호 속 프레임·하이픈 결합', () => {
    expect(modelTokens('TS100/160/250')).toEqual(expect.arrayContaining(['TS100', 'TS160', 'TS250']));
    expect(modelTokens('TD100/160')).toEqual(expect.arrayContaining(['TD100', 'TD160']));
    expect(modelTokens('TS250 (250AF)')).toEqual(expect.arrayContaining(['TS250', '250AF']));
    expect(modelTokens('LS-LVSS-101')).toEqual(expect.arrayContaining(['LSLVSS101', 'LVSS101']));
  });
});

describe('B6 옵션 검색 (실제 specs.json)', () => {
  it('색인이 비어 있지 않음 — 옵션 100개 이상', () => {
    expect(index.length).toBeGreaterThan(100);
  });
  it('TS250 → Smart MCCB TS250 이 1위(정확 일치), Susol MCCB TS100/160/250 도 나옴', () => {
    const hits = searchOptions(index, 'TS250', 20);
    expect(`${hits[0].doc.productId}:${hits[0].doc.variantId}`).toBe('P01900:ts250');
    expect(hits[0].score).toBe(0);
    expect(hitKeys('TS250')).toContain(`P01021:${index.find((d) => d.productId === 'P01021' && d.label.startsWith('TS100'))!.variantId}`);
  });
  it('ts250 · "TS 250" 도 같은 1위', () => {
    expect(hitKeys('ts250')[0]).toBe('P01900:ts250');
    expect(hitKeys('TS 250')[0]).toBe('P01900:ts250');
  });
  it('250AF → Smart MCCB TS250 과 Metasol MCCB 250AF 모두', () => {
    const keys = hitKeys('250AF');
    expect(keys).toContain('P01900:ts250');
    expect(keys.some((k) => k.startsWith('P01023:'))).toBe(true);
  });
  it('ABN → Metasol MCCB 100AF·125AF (ABN…)', () => {
    expect(hitKeys('ABN').some((k) => k.startsWith('P01023:'))).toBe(true);
  });
  it('TD100 → Susol MCCB TD100/160', () => {
    expect(hitKeys('TD100')).toContain('P01021:td100-160');
  });
  it('2글자 질의(AF·TS)는 잡음이라 옵션 검색 안 함', () => {
    expect(searchOptions(index, 'AF', 20)).toEqual([]);
    expect(searchOptions(index, 'ts', 20)).toEqual([]);
  });
  it('제품명 모델 토큰 정확 일치·옵션 주소', () => {
    expect(productNameExact('GIPAM1000', 'gipam 1000')).toBe(true);
    expect(productNameExact('Smart MCCB', 'MCC')).toBe(false);
    expect(optionHref('P01900', 'ts250')).toBe('/product/P01900?opt=ts250');
  });
});

describe('B8 화면용 사양 메모 (작업 메모 숨김, 데이터는 그대로)', () => {
  it('HTTP Range 괄호·"이전 값은" 문장·docs.json 을 뺀다', () => {
    const n = specsFile.products.P00206.note!;
    const out = publicNote(n)!;
    expect(out).toContain('카탈로그 정격표(p18~19) 기준');
    expect(out).not.toMatch(/HTTP|Range|docs\.json|이전 값/);
  });
  it('모든 제품 메모에서 작업 메모 표지가 남지 않음', () => {
    for (const s of Object.values(specsFile.products)) {
      expect(publicNote(s.note) ?? '').not.toMatch(/HTTP|Range|docs\.json|이전 값은|검수 필요/);
      for (const v of s.variants ?? []) expect(publicNote(v.note) ?? '').not.toMatch(/HTTP|docs\.json/);
    }
  });
  it('작업 메모뿐이면 undefined, 보통 메모는 그대로', () => {
    expect(publicNote('(HTTP Range로 추출)')).toBeUndefined();
    expect(publicNote('정격표(p10) 기준')).toBe('정격표(p10) 기준');
    expect(publicNote(undefined)).toBeUndefined();
  });
});

describe('C6 차이만 보기 주소 저장', () => {
  it('diff=1 붙이기·떼기, 나머지 파라미터 표기 유지', () => {
    expect(withDiffParam('?type=product&ids=P1:a,P2', true)).toBe('?type=product&ids=P1:a,P2&diff=1');
    expect(withDiffParam('?type=product&ids=P1:a,P2&diff=1', false)).toBe('?type=product&ids=P1:a,P2');
    expect(withDiffParam('?diff=1&type=equipment&ids=a,b', true)).toBe('?type=equipment&ids=a,b&diff=1');
    expect(withDiffParam('', false)).toBe('');
  });
});
