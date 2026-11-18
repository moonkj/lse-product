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
