// @vitest-environment node
/**
 * 데이터 무결성 테스트 (DI-xx 규칙) — docs/test-plan.md §3 과 1:1 대응
 *
 * v0.7 (개선 R4): 규칙 판정은 공용 모듈 src/lib/integrity (checkDataset) 단일 출처.
 *  - 관리자 "검사 후 내보내기"와 같은 함수를 beforeAll 에서 한 번 실행 → 규칙마다 it 하나로 결과를 꺼내 본다.
 *  - 규칙 ID·HARD/SOFT 는 RULES 표를 따른다: error = expect([]) / warning = softWarn / both = 둘 다.
 *  - 규칙별 "위반 데이터 → 해당 ID 로 잡힘" 검증은 tests/unit/lib/integrity.test.ts.
 * 이 파일에 직접 남기는 것: 파일 존재(DI-00a), 스키마 자기검증(잘못된 값 거부), 판정 함수 자기검증(segHitsNode·segsCross·
 * 기본 경로·isRealDate), 파일 시스템 규칙(DI-82·82b·86), docs.json(DI-60~)·사진 스키마(DI-80).
 * (learn.json·DI-70~79 는 교육 탭 제거로 삭제 — 2026-11-18 사용자 결정)
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
  ProductImagesSchema,
  GapAssessmentSchema,
  SpecsFileSchema,
  type DocsFile,
  type EquipmentImage,
  type ProductImage,
} from '../../src/lib/schema';
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
  checkSpecs,
  SPEC_RULES,
  SPEC_ITEMS_MAX,
  SPEC_VARIANTS_MAX,
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

// 기기 상세 설명 overview (DI-OV1~3) — 2026-11-18 설명 전수 재정리: 요약 + 항목(라벨·본문). basis·sources 는 추적용(화면 미표시)
describe('기기 상세 설명 overview (DI-OV)', () => {
  it('DI-OV1 모든 기기에 overview 가 있다', () => {
    expect(equipment.filter((e) => !e.overview).map((e) => e.id)).toEqual([]);
  });
  it('DI-OV2 summary 30~120자, points 1~5개 (라벨·본문 공백 아님)', () => {
    const bad: string[] = [];
    for (const e of equipment) {
      const o = e.overview;
      if (!o) continue;
      const n = o.summary.trim().length;
      if (n < 30 || n > 120) bad.push(`${e.id}: summary ${n}자`);
      if (o.points.length < 1 || o.points.length > 5) bad.push(`${e.id}: points ${o.points.length}개`);
      for (const p of o.points) if (!p.label.trim() || !p.text.trim()) bad.push(`${e.id}: 빈 항목`);
    }
    expect(bad).toEqual([]);
  });
  it('DI-OV3 자사 제품이 없는 기기(coverage missing)에는 "제품 설명" 항목이 없다', () => {
    const bad = equipment.filter((e) => e.coverage === 'missing' && e.overview?.points.some((p) => p.label === '제품 설명')).map((e) => e.id);
    expect(bad).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// 공용 검사 checkDataset — RULES 표의 규칙마다 하나씩 (HARD = 오류 0건, SOFT = 경고만)
// ─────────────────────────────────────────────────────────────
describe('공용 무결성 검사 checkDataset (RULES 표, src/lib/integrity)', () => {
  /**
   * 규칙 표 회귀 방지: v0.6 까지 DI 테스트에 있던 규칙 ID 가 RULES 에서 빠지면 실패 (test-plan §3.9 매핑표).
   * 파일 시스템·docs·정보성 규칙(DI-00a·45b·60~·80·82·82b·86)은 이 파일에 직접 남아 있다.
   */
  it('DI-RULES 규칙 표가 v0.6 DI 규칙 ID 를 모두 포함 (전환 중 누락 없음)', () => {
    const expected = [
      'DI-00', 'DI-01', 'DI-02', 'DI-03', 'DI-04', 'DI-05', 'DI-06', 'DI-07', 'DI-08',
      'DI-10', 'DI-11', 'DI-12', 'DI-13', 'DI-14', 'DI-15', 'DI-16', 'DI-17', 'DI-18', 'DI-19',
      'DI-20', 'DI-21', 'DI-22', 'DI-23', 'DI-24', 'DI-25', 'DI-26', 'DI-27',
      'DI-27a', 'DI-27b', 'DI-27c', 'DI-27d', 'DI-27e', 'DI-27f', 'DI-27g', 'DI-27h', 'DI-28', 'DI-29',
      'DI-30', 'DI-31', 'DI-32', 'DI-33', 'DI-34', 'DI-35', 'DI-36', 'DI-37', 'DI-38', 'DI-39', 'DI-40',
      'DI-41', 'DI-42', 'DI-43', 'DI-43b', 'DI-43c', 'DI-44a', 'DI-44b', 'DI-45a', 'DI-46',
      'DI-51', 'DI-52', 'DI-81', 'DI-83', 'DI-84', 'DI-85',
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
    expect(pts).toEqual([{ x: 175, y: 100 }, { x: 425, y: 100 }]);
    expect(segHitsNode(pts[0], pts[1], tile('m', 300, 100))).toBe(true);
    expect(segHitsNode(pts[0], pts[1], tile('m', 300, 161 + 1))).toBe(false);
    expect(segHitsNode({ x: 300, y: 200 }, { x: 300, y: 400 }, bus)).toBe(true); // 모선을 세로로 관통
    expect(segHitsNode({ x: 100, y: 295 }, { x: 500, y: 295 }, bus), '모선(±4) + 여유 2px 안').toBe(true);
    expect(segHitsNode({ x: 100, y: 294 }, { x: 500, y: 294 }, bus)).toBe(false);
    // 끝점(120×44)은 반높이 22 로 기본 경로를 만든다
    const ep: DNode = { id: 'p', kind: 'endpoint', x: 100, y: 300, label: 'p', layer: 'L6' };
    expect(defaultRoute(boxOf(tile('a', 100, 100)), boxOf(ep))).toEqual([{ x: 100, y: 160 }, { x: 100, y: 278 }]);
    // 꺾인 기본 경로 (세로 간격 충분: 아래로 → 가로 → 아래로), 중간 y 는 Python round
    expect(defaultRoute(boxOf(tile('a', 100, 100)), boxOf(tile('c', 400, 401)))).toEqual([
      { x: 100, y: 160 },
      { x: 100, y: 250 },
      { x: 400, y: 250 },
      { x: 400, y: 341 },
    ]);
    // 모선 연결 기본 경로: 모선 위 (기기 x) 점에서 수직, 모선 범위 밖이면 null
    expect(defaultRoute(boxOf(bus), boxOf(tile('d', 350, 420)))).toEqual([{ x: 350, y: 300 }, { x: 350, y: 360 }]);
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

describe('제품 사진 product-images.json (DI-87 ~)', () => {
  const FILE = 'product-images.json';
  let raw: unknown;
  let images: [string, ProductImage][] = [];

  beforeAll(() => {
    raw = readJson(FILE);
    images = Object.entries(ProductImagesSchema.parse(raw));
  });

  it('DI-87 ProductImagesSchema 통과 + 원본·썸네일 파일이 public/ 아래 존재', () => {
    expect(ProductImagesSchema.safeParse(raw).success).toBe(true);
    const ok = { file: 'images/products/P01065.png', thumb: 'images/products/thumb/P01065.png', sourceUrl: 'https://www.ls-electric.com/a.png', bytes: 1, origin: 'product-page' };
    expect(ProductImagesSchema.safeParse({ P01065: ok }).success).toBe(true);
    expect(ProductImagesSchema.safeParse({ P01065: { ...ok, file: 'images/products/../x.png' } }).success, '경로 탈출').toBe(false);
    expect(ProductImagesSchema.safeParse({ P01065: { ...ok, thumb: 'images/products/P01065.png' } }).success, 'thumb 폴더 밖').toBe(false);
    expect(ProductImagesSchema.safeParse({ P01065: { ...ok, origin: 'other' } }).success, 'origin 값').toBe(false);
    const { origin: _o, ...noOrigin } = ok;
    expect(ProductImagesSchema.safeParse({ P01065: noOrigin }).success, 'origin 누락').toBe(false);
    expect(ProductImagesSchema.safeParse({ P01065: { ...ok, origin: 'catalog', catalogUrl: 'https://www.ls-electric.com/ko/cat/x.pdf', catalogTitle: 'X 카탈로그', page: 3 } }).success).toBe(true);
    expect(ProductImagesSchema.safeParse({ P01065: { ...ok, origin: 'catalog', catalogUrl: 'http://x.com/a.pdf' } }).success, 'http 카탈로그').toBe(false);
    const missing = images.flatMap(([id, v]) => [v.file, v.thumb].filter((f) => !existsSync(PUBLIC_DIR + f)).map((f) => `${id}: public/${f}`));
    expect(missing).toEqual([]);
  });

  it('DI-88 (SOFT) 색인 키가 products.json 에 있음 — 빠진 제품의 항목(고아)은 화면에서 쓰지 않으므로 경고만', () => {
    const ids = new Set((asArray(readJson(FILES.products), 'products') as Product[]).map((p) => p.id));
    softWarn('DI-88', images.filter(([id]) => !ids.has(id)).map(([id]) => `${id}: products.json 에 없음`));
  });

  it('DI-89 (SOFT) 파일 크기가 bytes 와 다르거나 500KB 초과', () => {
    const warn: string[] = [];
    for (const [id, v] of images) {
      if (!existsSync(PUBLIC_DIR + v.file)) continue;
      const size = statSync(PUBLIC_DIR + v.file).size;
      if (size !== v.bytes) warn.push(`${id}: 실제 ${size}B ≠ bytes ${v.bytes}`);
      if (size > 500 * 1024) warn.push(`${id}: ${Math.round(size / 1024)}KB`);
    }
    softWarn('DI-89', warn);
  });
});

// ─────────────────────────────────────────────────────────────
// 정격 사양 specs.json (DI-90 ~) — v0.9 비교 기능, v1.1 옵션(variants).
//   v1.2: 판정은 공용 모듈 src/lib/integrity 의 checkSpecs({ specs, productIds, docUrlsByProduct, today }) → { errors, warnings }
//   (관리자 "사양 검수" 내보내기 전 검사와 같은 함수). 테스트 쪽 사본 삭제. SPEC_RULES 규칙마다 it 하나(HARD = 오류 0, SOFT = softWarn),
//   합성 위반 자기검증은 공용 함수에 대해 유지 + SPEC_RULES 누락 방지 메타 테스트.
// ─────────────────────────────────────────────────────────────
type SpecsFileT = z.infer<typeof SpecsFileSchema>;
/** KST 오늘 (YYYY-MM-DD) */
const todayKstIso = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

describe('정격 사양 specs.json (DI-90 ~)', () => {
  const SPECS_FILE = 'specs.json';
  let specs: SpecsFileT;
  let docUrls = new Map<string, string[]>();
  let result: CheckResult;
  const specErrors = (rule: string) => result.errors.filter((i) => i.rule === rule).map(text);
  const specWarnings = (rule: string) => result.warnings.filter((i) => i.rule === rule).map(text);
  /** 메타: 합성 위반 케이스가 실제로 보고한 규칙 ID (기대 ID 와 같을 때만 기록) */
  const verified = new Set<string>();

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
  const runSynth = (f: unknown) => checkSpecs({ specs: f, productIds: synthIds, docUrlsByProduct: synthDocs, today: '2026-11-18' });
  const rulesFor = (f: unknown) => {
    const r = runSynth(f);
    return [...new Set([...r.errors, ...r.warnings].map((i) => i.rule))].sort();
  };
  /** 위반 케이스 1건: 정확히 그 규칙 하나 + 등급이 SPEC_RULES 와 같을 때 verified 에 기록 */
  const expectOnly = (rule: string, f: unknown) => {
    const r = runSynth(f);
    const sev = SPEC_RULES.find((x) => x.id === rule)?.severity;
    const got = [...new Set([...r.errors, ...r.warnings].map((i) => i.rule))].sort();
    expect(got, rule).toEqual([rule]);
    expect(sev === 'warning' ? r.warnings.length : r.errors.length, `${rule} 등급`).toBeGreaterThan(0);
    expect(sev === 'warning' ? r.errors.length : r.warnings.length, `${rule} 다른 등급으로도 보고`).toBe(0);
    verified.add(rule);
  };

  beforeAll(() => {
    specs = SpecsFileSchema.parse(readJson(SPECS_FILE));
    const docs = DocsFileSchema.parse(readJson('docs.json'));
    docUrls = new Map(Object.entries(docs.products).map(([id, e]) => [id, e.docs.map((d) => d.url)]));
    result = checkSpecs({ specs: readJson(SPECS_FILE), productIds: new Set(productById.keys()), docUrlsByProduct: docUrls, today: todayKstIso() });
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

  it('DI-90b checkSpecs(공용) 자기검증: 정상 합성 = 위반 0, 규칙마다 위반 1건 → 정확히 그 ID·등급', () => {
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
    for (const [rule, f] of cases) expectOnly(rule, f);
    // v1.2 DI-90: 공용 함수는 스키마 위반도 보고 (의미 규칙이 더 구체적으로 알리는 개수·id·variantAxis 이슈는 생략)
    expectOnly('DI-90', fileOf({ P90001: { ...e(), reviewed: 'no' } }));
    expectOnly('DI-90', fileOf({ P90001: { ...e(), variantAxis: '프레임', variants: [{ ...vr('a'), page: 0 }] } }));
    expect(rulesFor(fileOf({ P90001: { ...e(), extractedAt: '2026/11/18' } }))).toEqual(['DI-90', 'DI-98']);
    expect(rulesFor({ generatedAt: 'x' })).toEqual(['DI-90']);
    expect(rulesFor(null)).toEqual(['DI-90']);
    expect(() => runSynth({ generatedAt: 'x', products: { P90001: { items: 'x' } } })).not.toThrow();
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

  // 규칙마다 it 하나 — SPEC_RULES 표 순서 (HARD = 오류 0건, SOFT = 경고만)
  for (const r of SPEC_RULES) {
    it(`${r.id}${r.severity === 'warning' ? ' (SOFT)' : ''} ${r.title}`, () => {
      if (r.severity === 'error') expect(specErrors(r.id)).toEqual([]);
      else softWarn(r.id, specWarnings(r.id));
      expect(result.errors.filter((x) => x.rule === r.id && r.severity === 'warning'), 'SOFT 규칙이 오류로 보고됨').toEqual([]);
    });
  }

  it('DI-SPEC-RULES 메타: 공용 결과의 규칙 ID 는 모두 SPEC_RULES 에 있고, 합성 위반으로 SPEC_RULES 전부를 한 번 이상 검증 (DI-90b 이후 실행)', () => {
    const ids = SPEC_RULES.map((r) => r.id);
    expect(new Set(ids).size, 'SPEC_RULES id 중복').toBe(ids.length);
    expect([...result.errors, ...result.warnings].map((i) => i.rule).filter((id) => !ids.includes(id))).toEqual([]);
    expect(ids.filter((id) => !verified.has(id)), '위반 케이스가 없는 SPEC_RULES 규칙').toEqual([]);
    expect(SPEC_ITEMS_MAX).toBe(10);
    expect(SPEC_VARIANTS_MAX).toBe(8);
  });

  it('DI-92b 출처 URL 은 https·공식 도메인 (docs.json 규칙 DI-62 와 같은 허용 목록)', () => {
    const notAllowed = Object.entries(specs.products).filter(([, s]) => !isAllowedDocUrl(s.source.url)).map(([id, s]) => `${id}: ${s.source.url}`);
    expect(notAllowed).toEqual([]);
  });

  it('DI-96d (정보) 옵션 통계', () => {
    const entries = Object.values(specs.products);
    const withV = entries.filter((s) => (s.variants?.length ?? 0) > 0);
    // eslint-disable-next-line no-console
    console.info(
      `[DI-96d] 사양 제품 ${entries.length}, 옵션 있는 제품 ${withV.length}, 옵션 ${withV.reduce((n, s) => n + s.variants!.length, 0)}개, ` +
        `공통 항목 ${entries.reduce((n, s) => n + s.items.length, 0)} · 옵션 항목 ${withV.reduce((n, s) => n + s.variants!.reduce((m, v) => m + v.items.length, 0), 0)}`,
    );
    expect(entries.length).toBeGreaterThan(0);
  });

  it('DI-99 (정보) reviewed=false 제품 수 → 화면 "카탈로그 추출값 · 검수 전" 배지 대상', () => {
    const entries = Object.entries(specs.products);
    const draft = entries.filter(([, s]) => !s.reviewed).map(([id]) => id);
    // eslint-disable-next-line no-console
    console.info(`[DI-99] 검수 전 ${draft.length}/${entries.length}개 제품, 항목 ${entries.reduce((n, [, s]) => n + s.items.length, 0)}개`);
    expect(draft.length).toBeLessThanOrEqual(entries.length);
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
