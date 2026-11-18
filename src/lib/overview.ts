import type { EquipmentType, OverviewPoint } from './schema';

/** 화면용 상세 설명 — 요약 문단 + 항목(라벨·본문). overview 가 없으면 description 한 줄만, 항목 없음 */
export function overviewParts(eq: Pick<EquipmentType, 'description' | 'overview'>): { summary: string; points: OverviewPoint[] } {
  return eq.overview ? { summary: eq.overview.summary, points: eq.overview.points } : { summary: eq.description, points: [] };
}

/** 상세 설명 전체 문자열 (비교 차이 키·검사용) — 요약 + "라벨: 본문" 항목을 공백으로 이어 붙인다 */
export function overviewText(eq: Pick<EquipmentType, 'description' | 'overview'>): string {
  const { summary, points } = overviewParts(eq);
  return [summary, ...points.map((p) => `${p.label}: ${p.text}`)].join(' ');
}
