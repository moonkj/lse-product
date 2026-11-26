/** 계통 구성 시뮬레이션 — 제품 목록(BOM) 표·CSV */
import { getData, type SpecsMap } from '../../data/load';
import { COVERAGE_LABELS } from '../schema';
import { csvCell } from '../pages/catalog';
import { slotsOf, type Template } from './templates';
import { DISCLAIMER, type Build } from './validate';

export interface BomRow {
  key: string;
  section: string;
  slot: string;
  equipment: string;
  coverage: string;
  product: string;
  rating: string;
  qty: number;
}

const RATING_KEYS = ['ratedVoltage', 'ratedCurrent', 'capacity', 'breakingCapacity'];

function ratingText(productId: string | undefined, specs?: SpecsMap): string {
  if (!productId) return '';
  const s = specs?.get(productId);
  if (!s) return '';
  const items = [...s.items, ...(s.variants?.[0]?.items ?? [])].filter((i) => RATING_KEYS.includes(i.key));
  const seen = new Set<string>();
  return items
    .filter((i) => (seen.has(i.key) ? false : (seen.add(i.key), true)))
    .slice(0, 2)
    .map((i) => `${i.label} ${i.value.replace(/\s*\([^)]*\)/g, '')}${i.unit ? ` ${i.unit}` : ''}`)
    .join(' · ');
}

export function buildBom(b: Build, t: Template, specs?: SpecsMap): BomRow[] {
  const d = getData();
  const rows: BomRow[] = [];
  const add = (key: string, section: string, slot: string, eqId: string, productId?: string) => {
    const eq = d.equipmentTypeById.get(eqId);
    if (!eq) return;
    const product = productId ? d.productById.get(productId) : undefined;
    rows.push({
      key,
      section,
      slot,
      equipment: eq.abbr ? `${eq.name} (${eq.abbr})` : eq.name,
      coverage: COVERAGE_LABELS[eq.coverage],
      product: product?.name ?? (eq.coverage === 'owned' || eq.coverage === 'partial' ? '(제품 미선택)' : '자사 제품 없음'),
      rating: ratingText(productId, specs),
      qty: 1,
    });
  };
  for (const { row, slot } of slotsOf(t)) {
    const p = b.slots[slot.id];
    if (p?.eq) add(slot.id, `${row.label} ${row.voltage}`, slot.label, p.eq, p.product);
  }
  for (const x of b.extras) {
    const row = t.rows.find((r) => r.id === x.row);
    if (row) add(x.id, `${row.label} ${row.voltage}`, row.addable?.label.replace(/ 추가$/, '') ?? '추가', x.eq, x.product);
  }
  return rows;
}

export function bomCsv(rows: BomRow[], t: Template, b: Build, today: string): string {
  const head = [
    [`계통 구성 시뮬레이션 — ${t.label}`],
    [`기준일 ${today} · 변압기 ${b.params.kVA}kVA · %Z ${b.params.pctZ}%`],
    [DISCLAIMER],
    [],
    ['구간', '칸', '기기', '보유 상태', '선택 제품', '대표 정격', '수량'],
  ];
  const body = rows.map((r) => [r.section, r.slot, r.equipment, r.coverage, r.product, r.rating, String(r.qty)]);
  return '﻿' + [...head, ...body].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
