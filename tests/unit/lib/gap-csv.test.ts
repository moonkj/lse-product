/**
 * 단위 테스트 (UT-01) — 공백 표 CSV 내보내기 buildGapCsv (src/lib/pages/catalog.ts)
 * Excel 에서 열었을 때 한글·쉼표·따옴표·줄바꿈이 깨지지 않아야 한다 (RFC 4180 + UTF-8 BOM).
 */
import { describe, it, expect } from 'vitest';
import { buildGapCsv, CATEGORY_LABELS } from '../../../src/lib/pages/catalog';
import { CONFIDENCE_LABELS, SOURCED_CONFIDENCE_LABELS } from '../../../src/lib/labels';
import { COVERAGE_LABELS, LAYER_LABELS, type EquipmentType } from '../../../src/lib/schema';

const eq = (over: Partial<EquipmentType>): EquipmentType => ({
  id: 'x',
  name: '기기',
  layer: 'L4',
  voltage: '',
  category: 'switching',
  description: '',
  learnPoints: [],
  coverage: 'missing',
  lseCategoryCodes: [],
  ...over,
});

const csvOf = (list: EquipmentType[]) => buildGapCsv(list, (c) => COVERAGE_LABELS[c], (l) => LAYER_LABELS[l]);

/** 최소 RFC 4180 파서 (검증용) */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') row.push(cell), (cell = '');
    else if (ch === '\r' && text[i + 1] === '\n') {
      row.push(cell), rows.push(row), (row = []), (cell = ''), i++;
    } else cell += ch;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  return rows;
}

describe('UT-01 buildGapCsv', () => {
  it('UTF-8 BOM(U+FEFF) 으로 시작하고 줄 끝은 CRLF, 마지막 줄도 CRLF', () => {
    const csv = csvOf([eq({})]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toHaveLength(3); // 헤더 + 1행 + 빈 꼬리
  });

  it('헤더 10열 + 행 값 (상태·계층·계층명·ID·이름·약어·기능·계열사·메모·판정) — v0.7 R4 판정 열', () => {
    const rows = parseCsv(csvOf([eq({ id: 'vcb', name: '진공차단기', abbr: 'VCB', coverage: 'partial', gapNote: '메모' })]).slice(1));
    expect(rows[0]).toEqual(['상태', '계층', '계층명', '기기 ID', '기기명', '약어', '기능', '계열사', '메모', '판정']);
    expect(rows[1]).toEqual([COVERAGE_LABELS.partial, 'L4', LAYER_LABELS.L4, 'vcb', '진공차단기', 'VCB', CATEGORY_LABELS.switching, '', '메모', '공백 후보']);
  });

  it('판정 열: 공백류는 후보/확정(재확인 기한 지나면 후보), 보유·해당 없음은 빈칸', () => {
    const confirmed = { supplyMode: 'not-offered', basis: 'bu-confirmed', confidence: 'confirmed', verifiedBy: '배전기기사업부', verifiedAt: '2026-11-18' } as const;
    const rows = parseCsv(
      csvOf([
        eq({ id: 'a', coverage: 'missing', gapNote: 'x', gapAssessment: confirmed }),
        eq({ id: 'b', coverage: 'missing', gapNote: 'x', gapAssessment: { ...confirmed, reviewDue: '2000-01-01' } }),
        eq({ id: 'c', coverage: 'sourced', gapAssessment: { supplyMode: 'panel-sourced', basis: 'homepage-menu', confidence: 'candidate' } }),
        eq({ id: 'd', coverage: 'owned' }),
        eq({ id: 'e', coverage: 'na' }),
      ]).slice(1),
    );
    expect(rows.slice(1).map((r) => [r[3], r[9]])).toEqual([
      ['a', CONFIDENCE_LABELS.confirmed],
      ['b', CONFIDENCE_LABELS.candidate],
      // 패널 구성품은 공백이 아니므로 '판정 후보' (UX B7 — 배지·패널과 일치)
      ['c', SOURCED_CONFIDENCE_LABELS.candidate],
      ['d', ''],
      ['e', ''],
    ]);
    expect(rows.every((r) => r.length === 10)).toBe(true);
  });

  it('쉼표·큰따옴표·줄바꿈(LF·CRLF) 이 든 값은 큰따옴표로 감싸고 따옴표는 "" 로 escape → 열 수 유지', () => {
    const nasty = eq({
      name: '차단기, "특수"형',
      gapNote: '1줄\n2줄\r\n3줄',
      affiliateName: 'LS "Cable"',
      coverage: 'affiliate',
    });
    const csv = csvOf([nasty]);
    expect(csv).toContain('"차단기, ""특수""형"');
    expect(csv).toContain('"LS ""Cable"""');
    const rows = parseCsv(csv.slice(1));
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveLength(10);
    expect(rows[1][4]).toBe('차단기, "특수"형');
    expect(rows[1][7]).toBe('LS "Cable"');
    expect(rows[1][8]).toBe('1줄\n2줄\r\n3줄');
  });

  it('CSV 수식 주입 방지 (v0.5 R2, T2 L8): = + - @ 로 시작하는 셀은 앞에 \' 를 붙여 텍스트로', () => {
    const evil = eq({
      name: '=HYPERLINK("http://x","클릭")',
      abbr: '+SUM(1,2)',
      affiliateName: '-2+3',
      gapNote: '@cmd',
    });
    const rows = parseCsv(csvOf([evil]).slice(1));
    expect(rows[1]).toHaveLength(10);
    expect(rows[1][4]).toBe('\'=HYPERLINK("http://x","클릭")');
    expect(rows[1][5]).toBe("'+SUM(1,2)");
    expect(rows[1][7]).toBe("'-2+3");
    expect(rows[1][8]).toBe("'@cmd");
    // 중간에 있는 기호·일반 값은 그대로
    const plain = parseCsv(csvOf([eq({ name: 'A=B', abbr: 'VCB', gapNote: '정상 메모 - 비고' })]).slice(1));
    expect(plain[1][4]).toBe('A=B');
    expect(plain[1][5]).toBe('VCB');
    expect(plain[1][8]).toBe('정상 메모 - 비고');
  });

  it('특수문자 없는 값은 따옴표로 감싸지 않음, 빈 목록이면 헤더만', () => {
    const csv = csvOf([]);
    expect(csv).toBe('﻿상태,계층,계층명,기기 ID,기기명,약어,기능,계열사,메모,판정\r\n');
  });
});
