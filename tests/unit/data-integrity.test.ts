// @vitest-environment node
/**
 * 데이터 무결성 테스트 (DI-xx 규칙) — docs/test-plan.md §3 과 1:1 대응
 *
 * v0.7 (개선 R4): 규칙 판정은 공용 모듈 src/lib/integrity (checkDataset) 단일 출처.
 *  - 관리자 "검사 후 내보내기"와 같은 함수를 beforeAll 에서 한 번 실행 → 규칙마다 it 하나로 결과를 꺼내 본다.
 *  - 규칙 ID·HARD/SOFT 는 RULES 표를 따른다: error = expect([]) / warning = softWarn / both = 둘 다.
 *  - 규칙별 "위반 데이터 → 해당 ID 로 잡힘" 검증은 tests/unit/lib/integrity.test.ts.
 * 이 파일에 직접 남기는 것: 파일 존재(DI-00a), 스키마 자기검증(잘못된 값 거부), 판정 함수 자기검증(segHitsNode·segsCross·
 * 기본 경로·isRealDate), 파일 시스템 규칙(DI-82·82b·86), docs.json(DI-60~)·learn.json(DI-70~)·사진 스키마(DI-80).
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll } from 'vitest';
import { z } from 'zod';

import {
  EquipmentTypeSchema,
  ProductSchema,
  CategorySchema,
  DiagramSchema,
  DocsFileSchema,
  EquipmentImagesSchema,
  GapAssessmentSchema,
  SpecsFileSchema,
  SPEC_KEYS,
  type DocsFile,
  type EquipmentImage,
} from '../../src/lib/schema';
import { LearnContentSchema, type LearnContent } from '../../src/content/learnSchema';
import {
  RULES,
  LSE_URL_RE,
  checkDataset,
  duplicates,
  edgeCrossings,
  isRealDate,
  isHttpsUrl,
  segHitsNode,
  segsCross,
  type CheckResult,
  type Issue,
} from '../../src/lib/integrity';
import { boxOf, defaultRoute, type Pt } from '../../src/lib/diagram/router';

type EquipmentType = z.infer<typeof EquipmentTypeSchema>;
type Product = z.infer<typeof ProductSchema>;
type Diagram = z.infer<typeof DiagramSchema>;
type DNode = Diagram['nodes'][number];

const DATA_DIR = fileURLToPath(new URL('../../src/data/', import.meta.url));
const FILES = {
  products: 'products.json',
  categories: 'categories.json',
  equipment: 'equipment-types.json',
  diagram: 'diagram.json',
} as const;

const MAIN_LAYERS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'] as const;

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(DATA_DIR + file, 'utf8'));
}
function asArray(raw: unknown, key: string): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>)[key])) return (raw as Record<string, unknown[]>)[key];
  throw new Error(`${key}: 최상위가 배열 또는 { ${key}: [] } 형태가 아님`);
}

function softWarn(ruleId: string, items: string[]): void {
  if (items.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(`[${ruleId} 권장 위반 ${items.length}건]\n  - ${items.join('\n  - ')}`);
  }
}

let products: Product[] = [];
let equipment: EquipmentType[] = [];
let diagram: Diagram;
let productById = new Map<string, Product>();
let equipmentById = new Map<string, EquipmentType>();
/** 공용 검사 결과 (현재 데이터 전체, 사진 포함) */
let result: CheckResult;

const text = (i: Issue) => i.message;
const errorsOf = (rule: string) => result.errors.filter((i) => i.rule === rule).map(text);
const warningsOf = (rule: string) => result.warnings.filter((i) => i.rule === rule).map(text);

// 전체 공통 로딩. parse 실패 시 모든 테스트가 실패한다 = 의도된 동작.
beforeAll(() => {
  const raw = {
    equipmentTypes: readJson(FILES.equipment),
    diagram: readJson(FILES.diagram),
    categories: readJson(FILES.categories),
    products: readJson(FILES.products),
    images: readJson('equipment-images.json'),
  };
  products = z.array(ProductSchema).parse(asArray(raw.products, 'products'));
  z.array(CategorySchema).parse(asArray(raw.categories, 'categories'));
  equipment = z.array(EquipmentTypeSchema).parse(asArray(raw.equipmentTypes, 'equipmentTypes'));
  diagram = DiagramSchema.parse(raw.diagram);
  productById = new Map(products.map((p) => [p.id, p]));
  equipmentById = new Map(equipment.map((e) => [e.id, e]));
  result = checkDataset(raw);
});

// ─────────────────────────────────────────────────────────────
// DI-00 파일 존재 + 스키마 (공용 검사의 DI-00 은 아래 RULES 루프에서)
// ─────────────────────────────────────────────────────────────
describe('DI-00 데이터 파일 존재 및 Zod 스키마 통과', () => {
  it.each(Object.values(FILES))('DI-00a %s 파일이 존재하고 JSON으로 파싱된다', (file) => {
    expect(existsSync(DATA_DIR + file), `${file} 없음`).toBe(true);
    expect(() => readJson(file)).not.toThrow();
  });

  it('DI-00b 4개 파일 모두 스키마 parse 성공 (beforeAll 에서 수행)', () => {
    expect(diagram).toBeDefined();
    expect(result).toBeDefined();
  });

  it('DI-00c 스키마가 잘못된 데이터를 실제로 거부한다 (스키마가 너무 느슨하지 않은지)', () => {
    expect(EquipmentTypeSchema.safeParse({ id: 'x', layer: 'L9', coverage: 'owned' }).success).toBe(false);
    expect(EquipmentTypeSchema.safeParse({ ...(equipment[0] ?? {}), coverage: 'unknown' }).success).toBe(false);
    expect(ProductSchema.safeParse({ ...(products[0] ?? {}), business: 'other' }).success).toBe(false);
    expect(DiagramSchema.safeParse({ width: 100, height: 100, layers: [], nodes: [{}], edges: [] }).success).toBe(false);
    expect(DiagramSchema.safeParse({ ...diagram, review: { status: 'done' } }).success, 'DI-43b 잘못된 review.status 통과').toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// 공용 검사 checkDataset — RULES 표의 규칙마다 하나씩 (HARD = 오류 0건, SOFT = 경고만)
// ─────────────────────────────────────────────────────────────
describe('공용 무결성 검사 checkDataset (RULES 표, src/lib/integrity)', () => {
  /**
   * 규칙 표 회귀 방지: v0.6 까지 DI 테스트에 있던 규칙 ID 가 RULES 에서 빠지면 실패 (test-plan §3.9 매핑표).
   * 파일 시스템·docs·learn·정보성 규칙(DI-00a·45b·60~·70~·80·82·82b·86)은 이 파일에 직접 남아 있다.
   */
  it('DI-RULES 규칙 표가 v0.6 DI 규칙 ID 를 모두 포함 (전환 중 누락 없음)', () => {
    const expected = [
      'DI-00', 'DI-01', 'DI-02', 'DI-03', 'DI-04', 'DI-05', 'DI-06', 'DI-07', 'DI-08',
      'DI-10', 'DI-11', 'DI-12', 'DI-13', 'DI-14', 'DI-15', 'DI-16', 'DI-17', 'DI-18', 'DI-19',
      'DI-20', 'DI-21', 'DI-22', 'DI-23', 'DI-24', 'DI-25', 'DI-26', 'DI-27',
      'DI-27a', 'DI-27b', 'DI-27c', 'DI-27d', 'DI-27e', 'DI-27f', 'DI-27g', 'DI-27h', 'DI-28', 'DI-29',
      'DI-30', 'DI-31', 'DI-32', 'DI-33', 'DI-34', 'DI-35', 'DI-36', 'DI-37', 'DI-38', 'DI-39', 'DI-40',
      'DI-41', 'DI-42', 'DI-43', 'DI-43b', 'DI-43c', 'DI-44a', 'DI-44b', 'DI-45a', 'DI-46',
      'DI-50', 'DI-51', 'DI-52', 'DI-81', 'DI-83', 'DI-84', 'DI-85',
    ];
    const ids = RULES.map((r) => r.id);
    expect(expected.filter((id) => !ids.includes(id)), 'RULES 에서 빠진 규칙').toEqual([]);
    expect(duplicates(ids), 'RULES id 중복').toEqual([]);
    // SOFT 규칙은 v0.6 과 같은 등급 (expect 로 실패시키지 않음)
    const soft = RULES.filter((r) => r.severity !== 'error').map((r) => r.id).sort();
    expect(soft).toEqual(['DI-25', 'DI-27', 'DI-27b', 'DI-27g', 'DI-27h', 'DI-29', 'DI-39', 'DI-40', 'DI-43b', 'DI-51', 'DI-52', 'DI-85'].sort());
  });

  it('검사 결과의 규칙 ID 는 모두 RULES 표 안 (표에 없는 ID 로 보고하지 않음)', () => {
    const ids = new Set(RULES.map((r) => r.id));
    expect([...result.errors, ...result.warnings].filter((i) => !ids.has(i.rule)).map((i) => `${i.rule}: ${i.message}`)).toEqual([]);
  });

  for (const rule of RULES) {
    const tag = rule.severity === 'warning' ? ' (SOFT)' : rule.severity === 'both' ? ' (+SOFT)' : '';
    it(`${rule.id}${tag} ${rule.title}`, () => {
      if (rule.severity !== 'warning') expect(errorsOf(rule.id)).toEqual([]);
      if (rule.severity !== 'error') softWarn(rule.id, warningsOf(rule.id));
      else expect(warningsOf(rule.id), 'HARD 규칙이 경고로 보고됨').toEqual([]);
    });
  }

  it('(정보) 커버리지 분포·판정 대상·택1 그룹', () => {
    const counts: Record<string, number> = {};
    equipment.forEach((e) => (counts[e.coverage] = (counts[e.coverage] ?? 0) + 1));
    const alts = diagram.edges.filter((e) => e.kind === 'alt');
    // eslint-disable-next-line no-console
    console.info(
      `[DI-28] coverage 분포 ${JSON.stringify(counts)} / [DI-27a] gapAssessment 보유 ${equipment.filter((e) => e.gapAssessment).length}건 / [DI-43c] alt ${alts.length}개, 그룹 ${new Set(alts.map((e) => e.label)).size}개`,
    );
    expect(equipment.length).toBeGreaterThan(0);
  });

  it('DI-45b (정보) 신호선 포함 교차 개수 — 실패시키지 않음', () => {
    const all = edgeCrossings(diagram, ['power', 'alt', 'signal']).length;
    const power = edgeCrossings(diagram, ['power', 'alt']).length;
    // eslint-disable-next-line no-console
    console.info(`[DI-45b] 교차: 전체 ${all}건, 전력선끼리 ${power}건, 신호선 관련 ${all - power}건`);
    expect(all).toBeGreaterThanOrEqual(power);
  });
});

// ─────────────────────────────────────────────────────────────
// 스키마·판정 함수 자기검증 — 일부러 틀린 입력을 잡는지 (판정이 너무 느슨해지는 회귀 방지)
// ─────────────────────────────────────────────────────────────
describe('스키마·판정 함수 자기검증', () => {
  it('DI-27c 스키마: basis=homepage-menu + confirmed 거부, candidate 허용', () => {
    const base = { supplyMode: 'unknown', basis: 'homepage-menu', confidence: 'confirmed', verifiedBy: '배전기기사업부', verifiedAt: '2026-11-18' };
    expect(GapAssessmentSchema.safeParse(base).success, 'homepage-menu + confirmed 가 통과함').toBe(false);
    expect(GapAssessmentSchema.safeParse({ ...base, confidence: 'candidate' }).success).toBe(true);
  });
  it('DI-27d 스키마: confirmed 는 verifiedBy·verifiedAt 없으면 거부', () => {
    const ok = { supplyMode: 'not-offered', basis: 'bu-confirmed', confidence: 'confirmed', verifiedBy: '배전기기사업부', verifiedAt: '2026-11-18' };
    expect(GapAssessmentSchema.safeParse(ok).success).toBe(true);
    const { verifiedAt: _a, ...noAt } = ok;
    const { verifiedBy: _b, ...noBy } = ok;
    expect(GapAssessmentSchema.safeParse(noAt).success, 'verifiedAt 없이 확정 통과').toBe(false);
    expect(GapAssessmentSchema.safeParse(noBy).success, 'verifiedBy 없이 확정 통과').toBe(false);
  });
  it('DI-27e·27f 판정 함수: isRealDate·isHttpsUrl', () => {
    expect(isRealDate('2026-02-30')).toBe(false);
    expect(isRealDate('2026-13-01')).toBe(false);
    expect(isRealDate('2026-1-01')).toBe(false);
    expect(isRealDate('2026-11-18')).toBe(true);
    expect(isRealDate('2028-02-29')).toBe(true);
    expect(isHttpsUrl('https://www.ls-electric.com/a')).toBe(true);
    expect(isHttpsUrl('http://www.ls-electric.com/a')).toBe(false);
    expect(isHttpsUrl('www.example.com')).toBe(false);
    expect(LSE_URL_RE.test('https://ssq.ls-electric.com/x')).toBe(true);
    expect(LSE_URL_RE.test('https://ls-electric.com.evil.io/x')).toBe(false);
  });

  it('DI-44 판정 함수: 중간 타일·모선을 지나는 경로는 잡아내고, 비켜 가면 통과 (기본 경로 = router.defaultRoute)', () => {
    const tile = (id: string, x: number, y: number): DNode => ({ id, equipmentTypeId: 'vcb', x, y });
    const bus: DNode = { id: 'b', kind: 'bus', x: 300, y: 300, width: 200, label: 'b', layer: 'L4' };
    const pts = defaultRoute(boxOf(tile('a', 100, 100)), boxOf(tile('c', 500, 100)))!;
    expect(pts).toEqual([{ x: 160, y: 100 }, { x: 440, y: 100 }]);
    expect(segHitsNode(pts[0], pts[1], tile('m', 300, 100))).toBe(true);
    expect(segHitsNode(pts[0], pts[1], tile('m', 300, 159 + 1))).toBe(false);
    expect(segHitsNode({ x: 300, y: 200 }, { x: 300, y: 400 }, bus)).toBe(true); // 모선을 세로로 관통
    expect(segHitsNode({ x: 100, y: 295 }, { x: 500, y: 295 }, bus), '모선(±4) + 여유 2px 안').toBe(true);
    expect(segHitsNode({ x: 100, y: 294 }, { x: 500, y: 294 }, bus)).toBe(false);
    // 끝점(120×44)은 반높이 22 로 기본 경로를 만든다
    const ep: DNode = { id: 'p', kind: 'endpoint', x: 100, y: 300, label: 'p', layer: 'L6' };
    expect(defaultRoute(boxOf(tile('a', 100, 100)), boxOf(ep))).toEqual([{ x: 100, y: 158 }, { x: 100, y: 278 }]);
    // 꺾인 기본 경로 (세로 간격 충분: 아래로 → 가로 → 아래로), 중간 y 는 Python round
    expect(defaultRoute(boxOf(tile('a', 100, 100)), boxOf(tile('c', 400, 401)))).toEqual([
      { x: 100, y: 158 },
      { x: 100, y: 250 },
      { x: 400, y: 250 },
      { x: 400, y: 343 },
    ]);
    // 모선 연결 기본 경로: 모선 위 (기기 x) 점에서 수직, 모선 범위 밖이면 null
    expect(defaultRoute(boxOf(bus), boxOf(tile('d', 350, 420)))).toEqual([{ x: 350, y: 300 }, { x: 350, y: 362 }]);
    expect(defaultRoute(boxOf(bus), boxOf(tile('d', 450, 420)))).toBeNull();
  });

  it('DI-45 판정 함수 segsCross', () => {
    const S = (ax: number, ay: number, bx: number, by: number) => ({ p: { x: ax, y: ay } as Pt, q: { x: bx, y: by } as Pt });
    expect(segsCross(S(0, 50, 100, 50), S(50, 0, 50, 100))).toBe(true); // 십자
    expect(segsCross(S(0, 50, 100, 50), S(100, 0, 100, 100))).toBe(false); // 끝에서 닿음(T) → 교차 아님
    expect(segsCross(S(0, 50, 100, 50), S(60, 50, 200, 50))).toBe(true); // 같은 선 위 겹침
    expect(segsCross(S(0, 50, 100, 50), S(100, 50, 200, 50))).toBe(false); // 이어짐
    expect(segsCross(S(0, 50, 100, 50), S(0, 60, 100, 60))).toBe(false); // 평행
    expect(segsCross(S(50, 0, 50, 100), S(50, 80, 50, 300))).toBe(true); // 세로 같은 선 겹침
  });
});

// ─────────────────────────────────────────────────────────────
// DI-60 ~ : docs.json (제품별 자료 — scripts/fetch-docs.mjs 산출물)
//   구조: { generatedAt, products: { [productId]: { source:'www'|'ssq', deepLink, docs: DocRef[] } } }
// ─────────────────────────────────────────────────────────────
/** 자료 파일 허용 도메인: 공식 사이트(*.ls-electric.com) + ssq 공식 대용량 파일 CDN */
const SSQ_CDN_HOST = 'ssqfd-abhdhraad3gkgbcg.a03.azurefd.net';
function isAllowedDocUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  return host === 'ls-electric.com' || host.endsWith('.ls-electric.com') || host === SSQ_CDN_HOST;
}
/** 개인정보 의심 패턴: 이메일, 한국 전화번호(휴대폰·지역번호·대표번호) */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?<!\d)(?:(?:01[016789]|0[2-6]\d?)[-.\s)]\d{3,4}[-.\s]\d{4}|1[5-9]\d{2}-\d{4})(?!\d)/;

describe('docs.json 자료 (DI-60 ~)', () => {
  const DOCS_FILE = 'docs.json';
  let docsFile: DocsFile;
  let entries: [string, DocsFile['products'][string]][] = [];

  beforeAll(() => {
    docsFile = DocsFileSchema.parse(readJson(DOCS_FILE));
    entries = Object.entries(docsFile.products);
  });

  it('DI-60 docs.json 이 존재하고 DocsFileSchema 통과 (+ 잘못된 값은 거부)', () => {
    expect(existsSync(DATA_DIR + DOCS_FILE)).toBe(true);
    expect(docsFile.generatedAt).toBeTruthy();
    expect(Number.isNaN(Date.parse(docsFile.generatedAt)), 'generatedAt 이 날짜 형식이 아님').toBe(false);
    // 스키마가 너무 느슨하지 않은지
    expect(
      DocsFileSchema.safeParse({
        generatedAt: 'x',
        products: { P00001: { source: 'ftp', deepLink: 'https://www.ls-electric.com/', docs: [] } },
      }).success,
    ).toBe(false);
    expect(
      DocsFileSchema.safeParse({
        generatedAt: 'x',
        products: { P00001: { source: 'www', deepLink: 'http://www.ls-electric.com/', docs: [] } },
      }).success,
    ).toBe(false);
  });

  it('DI-61 docs.json 의 productId 키가 모두 products.json 에 존재', () => {
    expect(entries.map(([id]) => id).filter((id) => !productById.has(id))).toEqual([]);
  });

  it('DI-62 모든 doc.url 은 https + 허용 도메인 (*.ls-electric.com, ssq CDN)', () => {
    const bad = entries.flatMap(([id, e]) =>
      e.docs.filter((d) => !isAllowedDocUrl(d.url)).map((d) => `${id}/${d.title}: ${d.url}`),
    );
    expect(bad).toEqual([]);
  });

  it('DI-63 deepLink 존재 + https + *.ls-electric.com (공식 자료실)', () => {
    const bad = entries
      .filter(([, e]) => !e.deepLink?.trim() || !LSE_URL_RE.test(e.deepLink))
      .map(([id, e]) => `${id}: ${e.deepLink}`);
    expect(bad).toEqual([]);
  });

  it('DI-64 개인정보 의심 패턴(이메일, 전화번호) 0건 — 제목·URL·deepLink 전체', () => {
    const bad: string[] = [];
    for (const [id, e] of entries) {
      const fields = [e.deepLink, ...e.docs.flatMap((d) => [d.title, decodeURIComponentSafe(d.url)])];
      for (const f of fields) {
        if (EMAIL_RE.test(f)) bad.push(`${id}: 이메일 의심 "${f}"`);
        if (PHONE_RE.test(f)) bad.push(`${id}: 전화번호 의심 "${f}"`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('DI-65 같은 제품 안에서 doc.url 중복 없음', () => {
    const bad = entries.flatMap(([id, e]) => duplicates(e.docs.map((d) => d.url)).map((u) => `${id}: ${u}`));
    expect(bad).toEqual([]);
  });

  it('DI-66 doc.title 이 공백 문자열이 아님', () => {
    const bad = entries.flatMap(([id, e]) => e.docs.filter((d) => !d.title.trim()).map((d) => `${id}: ${d.url}`));
    expect(bad).toEqual([]);
  });

  it('DI-67 (SOFT) docs 가 빈 제품 → 경고만 (화면은 "자료 준비 중" + deepLink)', () => {
    softWarn('DI-67', entries.filter(([, e]) => e.docs.length === 0).map(([id]) => id));
  });

  it('DI-68 (SOFT) source=ssq 인데 www 파일, 또는 그 반대 (출처 표기 오류 의심)', () => {
    softWarn(
      'DI-68',
      entries
        .filter(([, e]) => e.source === 'www' && e.docs.some((d) => new URL(d.url).hostname === SSQ_CDN_HOST))
        .map(([id]) => `${id}: source=www 인데 ssq CDN 파일 포함`),
    );
  });
});

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

// ─────────────────────────────────────────────────────────────
// 교육 콘텐츠 learn.json (DI-70 ~) — v0.4, v0.6 R3: 퀴즈·진도·수료 제거 (사용자 요청) → 퀴즈 규칙 DI-75·76 삭제
// 계약: src/content/learnSchema.ts (LearnContentSchema). 콘텐츠 소유 T1-B, 사실관계는 equipment-types.json 범위 안.
// ─────────────────────────────────────────────────────────────

const LEARN_PATH = fileURLToPath(new URL('../../src/content/learn.json', import.meta.url));

describe('교육 콘텐츠 learn.json (DI-70 ~)', () => {
  let raw: unknown;
  let learn: LearnContent;

  beforeAll(() => {
    raw = JSON.parse(readFileSync(LEARN_PATH, 'utf8'));
    learn = LearnContentSchema.parse(raw);
  });

  it('DI-70 learn.json 이 존재하고 LearnContentSchema 통과 (+ 잘못된 값은 거부)', () => {
    expect(existsSync(LEARN_PATH)).toBe(true);
    expect(LearnContentSchema.safeParse(raw).success).toBe(true);
    const base = raw as LearnContent;
    // 스키마가 너무 느슨해지는 회귀 방지
    const swapped = { ...base, steps: [base.steps[1], base.steps[0], ...base.steps.slice(2)] };
    expect(LearnContentSchema.safeParse(swapped).success, 'L1·L2 순서가 바뀌어도 통과함').toBe(false);
    expect(LearnContentSchema.safeParse({ ...base, steps: base.steps.slice(0, 6) }).success, '6단계도 통과함').toBe(false);
    const { reviewStatus: _omit, ...noStatus } = base;
    expect(LearnContentSchema.safeParse(noStatus).success, 'reviewStatus 없이도 통과함').toBe(false);
  });

  it('DI-71 단계가 L1→L7 순서, 중복·누락 없음', () => {
    expect(learn.steps.map((s) => s.layer)).toEqual([...MAIN_LAYERS]);
    expect(duplicates(learn.steps.map((s) => s.layer))).toEqual([]);
  });

  it('DI-72 핵심 기기(keyEquipmentIds) 가 equipment-types.json 에 존재 + 단계 안 중복 없음', () => {
    const bad = learn.steps.flatMap((s) => [
      ...s.keyEquipmentIds.filter((id) => !equipmentById.has(id)).map((id) => `${s.layer}: 없는 기기 ${id}`),
      ...duplicates(s.keyEquipmentIds).map((id) => `${s.layer}: 중복 ${id}`),
    ]);
    expect(bad).toEqual([]);
  });

  it('DI-73 핵심 기기는 그 단계 계층(layer)의 기기', () => {
    const bad = learn.steps.flatMap((s) =>
      s.keyEquipmentIds
        .filter((id) => equipmentById.has(id) && equipmentById.get(id)!.layer !== s.layer)
        .map((id) => `${s.layer}: ${id} 는 ${equipmentById.get(id)!.layer} 기기`),
    );
    expect(bad).toEqual([]);
  });

  it('DI-74 용어집 equipmentId 가 equipment-types.json 에 존재 + 용어 중복 없음', () => {
    const bad = learn.glossary
      .filter((g) => g.equipmentId !== undefined && !equipmentById.has(g.equipmentId))
      .map((g) => `${g.term}: 없는 기기 ${g.equipmentId}`);
    expect(bad).toEqual([]);
    expect(duplicates(learn.glossary.map((g) => g.term.trim()))).toEqual([]);
  });

  it('DI-75 (v0.6 R3) 퀴즈 제거: learn.json 단계에 quizzes 키가 남아 있지 않음', () => {
    const steps = (raw as { steps: Record<string, unknown>[] }).steps;
    expect(steps.filter((s) => 'quizzes' in s).map((s) => String(s.layer))).toEqual([]);
  });

  it('DI-77 reviewStatus 필드 존재 (공백 아님)', () => {
    expect(typeof (raw as Record<string, unknown>).reviewStatus).toBe('string');
    expect(learn.reviewStatus.trim()).not.toBe('');
  });

  it('DI-78 (SOFT) reviewStatus 가 draft 이면 경고 (교육 담당자 검토 전)', () => {
    softWarn('DI-78', /draft/i.test(learn.reviewStatus) ? [`reviewStatus="${learn.reviewStatus}"`] : []);
  });

  it('DI-79 (SOFT) 공개 사이트 — 대외비 키워드·개인정보 패턴 없음 (단계 제목·intro·용어집)', () => {
    const texts = [...learn.steps.flatMap((s) => [s.title, s.intro]), ...learn.glossary.flatMap((g) => [g.term, g.meaning])];
    softWarn(
      'DI-79',
      texts.filter((t) => /대외비|내부용|사내한정|confidential/i.test(t) || EMAIL_RE.test(t) || PHONE_RE.test(t)),
    );
  });
});

// ─────────────────────────────────────────────────────────────
// 기기 대표 사진 equipment-images.json (DI-80 ~) — v0.4. v0.7: DI-81·83·84·85 는 공용 검사(RULES) 로 전환, 여기는 스키마 거부·파일 시스템만
// 계약: EquipmentImagesSchema (src/lib/schema.ts). 키 = equipmentType.id, file = public/ 기준 상대 경로.
// ─────────────────────────────────────────────────────────────
const PUBLIC_DIR = fileURLToPath(new URL('../../public/', import.meta.url));

describe('기기 사진 equipment-images.json (DI-80 ~)', () => {
  const IMAGES_FILE = 'equipment-images.json';
  let raw: unknown;
  let images: [string, EquipmentImage][] = [];

  beforeAll(() => {
    raw = readJson(IMAGES_FILE);
    images = Object.entries(EquipmentImagesSchema.parse(raw));
  });

  it('DI-80 파일 존재 + EquipmentImagesSchema 통과 (+ 잘못된 값은 거부)', () => {
    expect(existsSync(DATA_DIR + IMAGES_FILE)).toBe(true);
    expect(EquipmentImagesSchema.safeParse(raw).success).toBe(true);
    const ok = { file: 'images/equipment/vcb.png', thumb: 'images/equipment/thumb/vcb.png', productId: null, productName: null, sourceUrl: 'https://www.ls-electric.com/a.png', bytes: 1 };
    expect(EquipmentImagesSchema.safeParse({ vcb: ok }).success).toBe(true);
    expect(EquipmentImagesSchema.safeParse({ vcb: { ...ok, file: '/images/equipment/vcb.png' } }).success, '절대경로(base ./ 깨짐)').toBe(false);
    expect(EquipmentImagesSchema.safeParse({ vcb: { ...ok, file: 'images/equipment/../x.png' } }).success, '경로 탈출').toBe(false);
    expect(EquipmentImagesSchema.safeParse({ vcb: { ...ok, sourceUrl: 'http://x.com/a.png' } }).success, 'http 출처').toBe(false);
    expect(EquipmentImagesSchema.safeParse({ vcb: { ...ok, bytes: 0 } }).success, 'bytes 0').toBe(false);
    const { thumb: _t, ...noThumb } = ok;
    expect(EquipmentImagesSchema.safeParse({ vcb: noThumb }).success, 'thumb 누락 (v0.5 R2 필수)').toBe(false);
    expect(EquipmentImagesSchema.safeParse({ vcb: { ...ok, thumb: 'images/equipment/vcb.png' } }).success, 'thumb 이 thumb/ 폴더 밖').toBe(false);
  });

  it('DI-82 사진 파일이 public/ 아래 실제로 존재 (배포 후 깨진 이미지 방지)', () => {
    expect(images.filter(([, v]) => !existsSync(PUBLIC_DIR + v.file)).map(([id, v]) => `${id}: public/${v.file}`)).toEqual([]);
  });

  it('DI-82b 썸네일(thumb, 160px) 파일이 public/ 아래 실제로 존재 + 원본보다 크지 않음 (v0.5 R2)', () => {
    expect(images.filter(([, v]) => !existsSync(PUBLIC_DIR + v.thumb)).map(([id, v]) => `${id}: public/${v.thumb}`)).toEqual([]);
    expect(
      images
        .filter(([, v]) => existsSync(PUBLIC_DIR + v.thumb) && existsSync(PUBLIC_DIR + v.file))
        .filter(([, v]) => statSync(PUBLIC_DIR + v.thumb).size > statSync(PUBLIC_DIR + v.file).size)
        .map(([id]) => `${id}: thumb 이 원본보다 큼`),
    ).toEqual([]);
  });

  it('DI-86 (SOFT) 파일 크기가 bytes 와 다르거나 500KB 초과 (사진 교체 누락·모바일 로딩 지연)', () => {
    const warn: string[] = [];
    for (const [id, v] of images) {
      if (!existsSync(PUBLIC_DIR + v.file)) continue;
      const size = statSync(PUBLIC_DIR + v.file).size;
      if (size !== v.bytes) warn.push(`${id}: 실제 ${size}B ≠ bytes ${v.bytes}`);
      if (size > 500 * 1024) warn.push(`${id}: ${Math.round(size / 1024)}KB`);
      if (existsSync(PUBLIC_DIR + v.thumb) && statSync(PUBLIC_DIR + v.thumb).size > 500 * 1024) warn.push(`${id}: thumb ${Math.round(statSync(PUBLIC_DIR + v.thumb).size / 1024)}KB`);
    }
    softWarn('DI-86', warn);
  });
});

// ─────────────────────────────────────────────────────────────
// 정격 사양 specs.json (DI-90 ~) — v0.9 비교 기능. 공개 카탈로그 추출값, 값마다 페이지.
//   판정은 아래 checkSpecs() 한 함수 — 현재 데이터 = 위반 0, 합성 위반 데이터 = 해당 규칙 ID (자기검증).
//   src 수정 금지 라운드라 테스트 파일에 둔다 → test-plan §3.11 "공용 모듈(src/lib/integrity) 편입 후보".
// ─────────────────────────────────────────────────────────────
type SpecsFileT = z.infer<typeof SpecsFileSchema>;
interface SpecIssue {
  rule: string;
  msg: string;
}
const SPEC_ITEMS_MAX = 10;
/** 옵션 수 권장 상한 (v1.1 SOFT) */
const VARIANTS_MAX = 8;
const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STANDARD_SPEC_LABELS = SPEC_KEYS as Record<string, string>;
/** KST 오늘 (YYYY-MM-DD) */
const todayKstIso = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

/**
 * specs.json 규칙 (스키마 통과 후의 의미 규칙).
 * - DI-91 productId ∈ products.json
 * - DI-92 source.url ∈ 그 제품 docs.json 의 doc.url (근거: 현재 35/35 일치 — 추출 담당이 docs.json 카탈로그만 사용. 같은 도메인 허용보다 엄격하게 둬서 오타·다른 제품 카탈로그 연결을 잡는다)
 * - DI-93 key 중복 없음: 공통 안·옵션 안, 공통↔옵션 겹침 금지 (v1.1 — 옵션끼리 같은 key 는 정상)
 * - DI-94 표준 key 의 label = SPEC_KEYS 라벨 (공통+옵션 전체)
 * - DI-95 비표준 key: 파일 전체(공통+옵션)에서 같은 key = 같은 label / DI-95b 같은 label = 같은 key (표준 라벨 포함 — 행 이름 중복 방지)
 * - DI-96 개수: 공통 0~10, 옵션당 1~10, 공통+옵션 ≥ 1 (v1.1 스키마와 같은 계약 + 상한), label·value 공백 문자열 아님
 * - DI-96b 옵션 id kebab-case·제품 안 고유 / DI-96c 옵션 있으면 variantAxis / DI-96d (SOFT) 옵션 ≤ 8 / DI-96e (SOFT) 옵션 label 고유
 * - DI-97 값마다 페이지 추적 가능 (item.page ?? variant.page ?? source.page)
 * - DI-98 extractedAt 실제 날짜 + 미래 아님(KST), generatedAt 날짜로 파싱됨
 * - DI-99b 개인정보 의심 패턴 0건 (title·url·label·value·unit·note)
 */
function checkSpecs(
  file: SpecsFileT,
  productIds: ReadonlySet<string>,
  docUrlsByProduct: ReadonlyMap<string, readonly string[]>,
  today = todayKstIso(),
): SpecIssue[] {
  const out: SpecIssue[] = [];
  const add = (rule: string, msg: string) => out.push({ rule, msg });
  if (Number.isNaN(Date.parse(file.generatedAt))) add('DI-98', `generatedAt 날짜 아님: ${file.generatedAt}`);
  const labelOfKey = new Map<string, { label: string; where: string }>();
  const keyOfLabel = new Map<string, { key: string; where: string }>();
  for (const [k, l] of Object.entries(STANDARD_SPEC_LABELS)) keyOfLabel.set(l, { key: k, where: 'SPEC_KEYS' });
  for (const [id, s] of Object.entries(file.products)) {
    const variants = s.variants ?? [];
    if (!productIds.has(id)) add('DI-91', `${id}: products.json 에 없는 제품`);
    if (!(docUrlsByProduct.get(id) ?? []).includes(s.source.url)) add('DI-92', `${id}: source.url 이 그 제품 docs.json 자료가 아님 (${s.source.url})`);
    // v1.1 개수: 공통 0~10, 옵션당 1~10, 공통+옵션 합 ≥ 1 (스키마 superRefine 과 같은 계약 + 상한)
    if (s.items.length > SPEC_ITEMS_MAX) add('DI-96', `${id}: 공통 items ${s.items.length}개 (0~${SPEC_ITEMS_MAX})`);
    if (s.items.length === 0 && variants.length === 0) add('DI-96', `${id}: 공통·옵션 사양이 모두 없음`);
    for (const v of variants)
      if (v.items.length < 1 || v.items.length > SPEC_ITEMS_MAX) add('DI-96', `${id}:${v.id}: 옵션 items ${v.items.length}개 (1~${SPEC_ITEMS_MAX})`);
    // v1.1 옵션 id 고유·kebab (URL "제품:옵션"), variantAxis 필수, 옵션 수·label
    if (variants.length > 0 && !s.variantAxis?.trim()) add('DI-96c', `${id}: 옵션이 있는데 variantAxis 없음`);
    for (const v of variants) if (!KEBAB_RE.test(v.id)) add('DI-96b', `${id}: 옵션 id "${v.id}" 가 kebab-case 아님`);
    for (const d of duplicates(variants.map((v) => v.id))) add('DI-96b', `${id}: 옵션 id 중복 ${d}`);
    if (variants.length > VARIANTS_MAX) add('DI-96d', `${id}: 옵션 ${variants.length}개 (권장 ≤ ${VARIANTS_MAX} — 비교 select·상세 표가 길어짐)`);
    for (const d of duplicates(variants.map((v) => v.label.trim()))) add('DI-96e', `${id}: 옵션 label 중복 "${d}" (select 에서 구분 불가)`);
    if (!isRealDate(s.extractedAt)) add('DI-98', `${id}: extractedAt 없는 날짜 ${s.extractedAt}`);
    else if (s.extractedAt > today) add('DI-98', `${id}: extractedAt 미래 ${s.extractedAt}`);
    // DI-93 key 중복: 공통 안, 옵션 안, 공통↔옵션 겹침 (옵션끼리는 같은 key 가 정상)
    const commonKeys = new Set(s.items.map((i) => i.key));
    for (const k of duplicates(s.items.map((i) => i.key))) add('DI-93', `${id}: 공통 key 중복 ${k}`);
    for (const v of variants) {
      for (const k of duplicates(v.items.map((i) => i.key))) add('DI-93', `${id}:${v.id}: 옵션 안 key 중복 ${k}`);
      for (const i of v.items) if (commonKeys.has(i.key)) add('DI-93', `${id}:${v.id}: key ${i.key} 가 공통 사양과 겹침`);
    }
    const texts = [s.source.title, decodeURIComponentSafe(s.source.url), s.note ?? '', s.variantAxis ?? ''];
    const all: { it: SpecsFileT['products'][string]['items'][number]; where: string; vPage?: number }[] = [
      ...s.items.map((it) => ({ it, where: id })),
      ...variants.flatMap((v) => {
        texts.push(v.label, v.note ?? '');
        return v.items.map((it) => ({ it, where: `${id}:${v.id}`, vPage: v.page }));
      }),
    ];
    for (const { it, where, vPage } of all) {
      texts.push(it.label, it.value, it.unit ?? '');
      if (!it.label.trim() || !it.value.trim()) add('DI-96', `${where}/${it.key}: label·value 공백`);
      if (!(it.page ?? vPage ?? s.source.page)) add('DI-97', `${where}/${it.key}: 페이지 없음 (item·옵션·source 모두 없음)`);
      const std = STANDARD_SPEC_LABELS[it.key];
      if (std !== undefined) {
        if (it.label !== std) add('DI-94', `${where}/${it.key}: label "${it.label}" ≠ SPEC_KEYS "${std}"`);
      } else {
        const prev = labelOfKey.get(it.key);
        if (prev && prev.label !== it.label) add('DI-95', `key ${it.key}: label "${prev.label}"(${prev.where}) ≠ "${it.label}"(${where})`);
        if (!prev) labelOfKey.set(it.key, { label: it.label, where });
      }
      const pk = keyOfLabel.get(it.label);
      if (pk && pk.key !== it.key) add('DI-95b', `label "${it.label}": key ${pk.key}(${pk.where}) ≠ ${it.key}(${where})`);
      if (!pk) keyOfLabel.set(it.label, { key: it.key, where });
    }
    for (const f of texts) {
      if (EMAIL_RE.test(f)) add('DI-99b', `${id}: 이메일 의심 "${f}"`);
      if (PHONE_RE.test(f)) add('DI-99b', `${id}: 전화번호 의심 "${f}"`);
    }
  }
  return out;
}

describe('정격 사양 specs.json (DI-90 ~)', () => {
  const SPECS_FILE = 'specs.json';
  let specs: SpecsFileT;
  let docUrls = new Map<string, string[]>();
  let issues: SpecIssue[] = [];
  const issuesOf = (rule: string) => issues.filter((i) => i.rule === rule).map((i) => i.msg);

  // 합성 데이터 — 규칙 자기검증용
  const URL_A = 'https://www.ls-electric.com/ko/cat/A.pdf';
  const goodItem = { key: 'ratedVoltage', label: '정격전압', value: '690', unit: 'V', page: 3 };
  const goodEntry = () => ({
    items: [{ ...goodItem }],
    source: { title: '[A] 카탈로그', url: URL_A, page: 3 },
    extractedAt: '2026-11-18',
    reviewed: false,
  });
  const fileOf = (products: Record<string, ReturnType<typeof goodEntry> | Record<string, unknown>>): SpecsFileT =>
    ({ generatedAt: '2026-11-18T00:00:00+09:00', products }) as SpecsFileT;
  const synthIds = new Set(['P90001', 'P90002']);
  const synthDocs = new Map([
    ['P90001', [URL_A]],
    ['P90002', [URL_A]],
    ['P99999', [URL_A]], // DI-91 단독 검증용 (docs 는 있으나 products 에 없음)
  ]);
  const rulesFor = (f: SpecsFileT) => [...new Set(checkSpecs(f, synthIds, synthDocs, '2026-11-18').map((i) => i.rule))].sort();

  beforeAll(() => {
    specs = SpecsFileSchema.parse(readJson(SPECS_FILE));
    const docs = DocsFileSchema.parse(readJson('docs.json'));
    docUrls = new Map(Object.entries(docs.products).map(([id, e]) => [id, e.docs.map((d) => d.url)]));
    issues = checkSpecs(specs, new Set(productById.keys()), docUrls);
  });

  it('DI-90 specs.json 이 존재하고 SpecsFileSchema 통과 (+ 잘못된 값은 거부)', () => {
    expect(existsSync(DATA_DIR + SPECS_FILE)).toBe(true);
    expect(Object.keys(specs.products).length).toBeGreaterThan(0);
    const bad = (patch: Record<string, unknown>) => SpecsFileSchema.safeParse(fileOf({ P90001: { ...goodEntry(), ...patch } })).success;
    expect(SpecsFileSchema.safeParse(fileOf({ P90001: goodEntry() })).success).toBe(true);
    expect(bad({ items: [] }), '빈 items 통과').toBe(false);
    expect(bad({ source: { title: 'x', url: 'http://www.ls-electric.com/a.pdf' } }), 'http URL 통과').toBe(false);
    expect(bad({ source: { title: 'x', url: URL_A, page: 0 } }), 'source.page 0 통과').toBe(false);
    expect(bad({ items: [{ ...goodItem, page: 1.5 }] }), '소수 페이지 통과').toBe(false);
    expect(bad({ items: [{ ...goodItem, value: '' }] }), '빈 value 통과').toBe(false);
    expect(bad({ extractedAt: '2026/11/18' }), '날짜 형식 통과').toBe(false);
    expect(bad({ reviewed: 'no' }), 'reviewed 문자열 통과').toBe(false);
    // v1.1 옵션 (superRefine)
    const v = (id: string, items = [{ key: 'frame', label: '프레임', value: '250', page: 2 }]) => ({ id, label: id.toUpperCase(), items });
    expect(bad({ items: [], variants: [v('ts250')], variantAxis: '프레임' }), '공통 0 + 옵션 1 은 허용').toBe(true);
    expect(bad({ items: [], variants: [] }), '공통·옵션 모두 없음 통과').toBe(false);
    expect(bad({ variants: [v('ts250')] }), 'variantAxis 없음 통과').toBe(false);
    expect(bad({ variants: [v('ts250'), v('ts250')], variantAxis: '프레임' }), '옵션 id 중복 통과').toBe(false);
    expect(bad({ variants: [v('TS250')], variantAxis: '프레임' }), '대문자 옵션 id 통과').toBe(false);
    expect(bad({ variants: [v('ts 250')], variantAxis: '프레임' }), '공백 옵션 id 통과').toBe(false);
    expect(bad({ variants: [v('ts:250')], variantAxis: '프레임' }), "':' 옵션 id 통과 (URL 구분자)").toBe(false);
    expect(bad({ variants: [v('ts250', [])], variantAxis: '프레임' }), '빈 옵션 items 통과').toBe(false);
    expect(bad({ variants: [{ ...v('ts250'), page: 0 }], variantAxis: '프레임' }), '옵션 page 0 통과').toBe(false);
    expect(bad({ variants: [{ ...v('ts250'), label: '' }], variantAxis: '프레임' }), '빈 옵션 label 통과').toBe(false);
  });

  it('DI-90b checkSpecs 자기검증: 정상 합성 = 위반 0, 규칙마다 위반 1건 → 그 ID', () => {
    expect(rulesFor(fileOf({ P90001: goodEntry() }))).toEqual([]);
    const e = goodEntry;
    const fr = { key: 'frame', label: '프레임', value: '250', unit: 'AF', page: 2 };
    /** 옵션: id → label 은 대문자 (서로 다른 id 는 다른 label) */
    const vr = (id: string, items: Record<string, unknown>[] = [fr]) => ({ id, label: id.toUpperCase(), items });
    const cases: [string, SpecsFileT][] = [
      ['DI-91', fileOf({ P99999: e() })],
      ['DI-92', fileOf({ P90001: { ...e(), source: { title: 'x', url: 'https://www.ls-electric.com/ko/cat/B.pdf', page: 1 } } })],
      ['DI-93', fileOf({ P90001: { ...e(), items: [goodItem, { ...goodItem, value: '1000' }] } })],
      ['DI-94', fileOf({ P90001: { ...e(), items: [{ ...goodItem, label: '정격 전압' }] } })],
      [
        'DI-95',
        fileOf({
          P90001: { ...e(), items: [{ key: 'ipRating', label: '보호등급(IP)', value: 'IP20', page: 1 }] },
          P90002: { ...e(), items: [{ key: 'ipRating', label: 'IP 등급', value: 'IP54', page: 1 }] },
        }),
      ],
      ['DI-95b', fileOf({ P90001: { ...e(), items: [{ key: 'voltage', label: '정격전압', value: '690', page: 1 }] } })],
      ['DI-96', fileOf({ P90001: { ...e(), items: Array.from({ length: 11 }, (_, i) => ({ key: `k${i}`, label: `항목${i}`, value: 'v', page: 1 })) } })],
      ['DI-96', fileOf({ P90001: { ...e(), items: [{ ...goodItem, value: '  ' }] } })],
      ['DI-97', fileOf({ P90001: { ...e(), items: [{ key: 'poles', label: '극수', value: '3' }], source: { title: 'x', url: URL_A } } })],
      ['DI-98', fileOf({ P90001: { ...e(), extractedAt: '2026-02-30' } })],
      ['DI-98', fileOf({ P90001: { ...e(), extractedAt: '2026-11-19' } })],
      ['DI-99b', fileOf({ P90001: { ...e(), note: '문의 sales@example.com' } })],
      ['DI-99b', fileOf({ P90001: { ...e(), note: '담당 010-1234-5678' } })],
      // v1.1 옵션
      ['DI-93', fileOf({ P90001: { ...e(), variantAxis: '프레임', variants: [vr('a', [fr, { ...fr, value: '400' }])] } })],
      ['DI-93', fileOf({ P90001: { ...e(), variantAxis: '프레임', variants: [vr('a', [{ ...goodItem, value: '1000' }])] } })],
      ['DI-94', fileOf({ P90001: { ...e(), variantAxis: '프레임', variants: [vr('a', [{ ...fr, label: '프레임 크기' }])] } })],
      [
        'DI-95',
        fileOf({
          P90001: { ...e(), items: [{ key: 'ipRating', label: '보호등급(IP)', value: 'IP20', page: 1 }] },
          P90002: { ...e(), variantAxis: '프레임', variants: [vr('a', [{ key: 'ipRating', label: 'IP 등급', value: 'IP54', page: 1 }])] },
        }),
      ],
      ['DI-96', fileOf({ P90001: { ...e(), items: [], variants: [] } })],
      ['DI-96', fileOf({ P90001: { ...e(), variantAxis: '프레임', variants: [vr('a', [])] } })],
      ['DI-96', fileOf({ P90001: { ...e(), variantAxis: '프레임', variants: [vr('a', Array.from({ length: 11 }, (_, i) => ({ key: `k${i}`, label: `항목${i}`, value: 'v', page: 1 })))] } })],
      ['DI-96b', fileOf({ P90001: { ...e(), variantAxis: '프레임', variants: [vr('a'), { ...vr('a'), label: 'A2' }] } })],
      ['DI-96b', fileOf({ P90001: { ...e(), variantAxis: '프레임', variants: [vr('TS:1')] } })],
      ['DI-96c', fileOf({ P90001: { ...e(), variants: [vr('a')] } })],
      ['DI-96d', fileOf({ P90001: { ...e(), variantAxis: '프레임', variants: Array.from({ length: 9 }, (_, i) => vr(`v${i}`)) } })],
      ['DI-96e', fileOf({ P90001: { ...e(), variantAxis: '프레임', variants: [vr('a'), { ...vr('b'), label: 'A' }] } })],
      ['DI-97', fileOf({ P90001: { ...e(), source: { title: 'x', url: URL_A }, items: [{ ...goodItem }], variantAxis: '프레임', variants: [vr('a', [{ key: 'frame', label: '프레임', value: '250' }])] } })],
      ['DI-99b', fileOf({ P90001: { ...e(), variantAxis: '프레임', variants: [{ ...vr('a'), note: '문의 a@b.co' }] } })],
    ];
    for (const [rule, f] of cases) expect(rulesFor(f), rule).toEqual([rule]);
    // 비표준 key 가 같은 label 로 일관되면 통과, item.page 없어도 source.page 가 있으면 통과
    expect(
      rulesFor(
        fileOf({
          P90001: { ...e(), items: [{ key: 'ipRating', label: '보호등급(IP)', value: 'IP20' }] },
          P90002: { ...e(), items: [{ key: 'ipRating', label: '보호등급(IP)', value: 'IP54', page: 2 }] },
        }),
      ),
    ).toEqual([]);
    // v1.1: 공통 0 + 옵션, 옵션끼리 같은 key, 옵션 page 로 페이지 대체(item·source page 없음), 옵션 8개 → 통과
    expect(
      rulesFor(
        fileOf({
          P90001: {
            ...e(),
            items: [],
            source: { title: 'x', url: URL_A },
            variantAxis: '프레임',
            variants: Array.from({ length: 8 }, (_, i) => ({ id: `ts${i}`, label: `TS${i}`, page: 4, items: [{ key: 'frame', label: '프레임', value: `${i}` }] })),
          },
        }),
      ),
    ).toEqual([]);
  });

  it('DI-91 productId 키가 모두 products.json 에 존재', () => {
    expect(issuesOf('DI-91')).toEqual([]);
  });

  it('DI-92 source.url 이 그 제품의 docs.json 자료 URL 중 하나 (+ https·공식 도메인)', () => {
    expect(issuesOf('DI-92')).toEqual([]);
    const notAllowed = Object.entries(specs.products).filter(([, s]) => !isAllowedDocUrl(s.source.url)).map(([id, s]) => `${id}: ${s.source.url}`);
    expect(notAllowed).toEqual([]);
  });

  it('DI-93 key 중복 없음 — 공통 안·옵션 안, 공통↔옵션 겹침 0', () => {
    expect(issuesOf('DI-93')).toEqual([]);
  });

  it('DI-94 표준 key(SPEC_KEYS) 의 label 이 SPEC_KEYS 라벨과 같음', () => {
    expect(issuesOf('DI-94')).toEqual([]);
  });

  it('DI-95 비표준 key 는 전체에서 같은 key = 같은 label, DI-95b 같은 label = 같은 key (비교표 행 정렬·이름 일관성)', () => {
    expect(issuesOf('DI-95')).toEqual([]);
    expect(issuesOf('DI-95b')).toEqual([]);
  });

  it('DI-96 개수: 공통 0~10 · 옵션당 1~10 · 합 ≥ 1, label·value 공백 아님', () => {
    expect(issuesOf('DI-96')).toEqual([]);
  });

  it('DI-96b 옵션 id kebab-case·제품 안 고유, DI-96c 옵션 있으면 variantAxis', () => {
    expect(issuesOf('DI-96b')).toEqual([]);
    expect(issuesOf('DI-96c')).toEqual([]);
  });

  it('DI-96d (SOFT) 옵션 수 ≤ 8, DI-96e (SOFT) 옵션 label 제품 안 고유', () => {
    softWarn('DI-96d', issuesOf('DI-96d'));
    softWarn('DI-96e', issuesOf('DI-96e'));
    const entries = Object.values(specs.products);
    const withV = entries.filter((s) => (s.variants?.length ?? 0) > 0);
    // eslint-disable-next-line no-console
    console.info(
      `[DI-96d] 옵션 있는 제품 ${withV.length}/${entries.length}, 옵션 ${withV.reduce((n, s) => n + s.variants!.length, 0)}개, ` +
        `공통 항목 ${entries.reduce((n, s) => n + s.items.length, 0)} · 옵션 항목 ${withV.reduce((n, s) => n + s.variants!.reduce((m, v) => m + v.items.length, 0), 0)}`,
    );
  });

  it('DI-97 값마다 카탈로그 페이지 추적 가능 (item.page → variant.page → source.page, 양의 정수)', () => {
    expect(issuesOf('DI-97')).toEqual([]);
  });

  it('DI-98 extractedAt 실제 날짜 + 미래 아님(KST), generatedAt 날짜 형식', () => {
    expect(issuesOf('DI-98')).toEqual([]);
  });

  it('DI-99 (정보) reviewed=false 제품 수 → 화면 "카탈로그 추출값 · 검수 전" 배지 대상', () => {
    const entries = Object.entries(specs.products);
    const draft = entries.filter(([, s]) => !s.reviewed).map(([id]) => id);
    // eslint-disable-next-line no-console
    console.info(`[DI-99] 검수 전 ${draft.length}/${entries.length}개 제품, 항목 ${entries.reduce((n, [, s]) => n + s.items.length, 0)}개`);
    expect(draft.length).toBeLessThanOrEqual(entries.length);
  });

  it('DI-99b 개인정보 의심 패턴(이메일, 전화번호) 0건 — 제목·URL·라벨·값·단위·비고', () => {
    expect(issuesOf('DI-99b')).toEqual([]);
  });

  it('DI-99c (SOFT) 사양이 있는데 어느 기기에도 연결되지 않은 제품 (기기 비교 화면에 나오지 않음)', () => {
    const categories = z.array(CategorySchema).parse(asArray(readJson(FILES.categories), 'categories'));
    const linked = new Set<string>();
    for (const eq of equipment) {
      (eq.productIds ?? []).forEach((id) => linked.add(id));
      for (const code of eq.lseCategoryCodes) {
        categories.find((c) => c.code === code)?.productIds.forEach((id) => linked.add(id));
        products.filter((p) => p.categoryCode.startsWith(code)).forEach((p) => linked.add(p.id));
      }
    }
    softWarn('DI-99c', Object.keys(specs.products).filter((id) => !linked.has(id)));
  });
});
