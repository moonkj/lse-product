import type { EquipmentOverview, EquipmentType } from './schema';

/** 상세 설명 본문 — overview 가 있으면 그 문단, 없으면 한 줄 요약(description) */
export function overviewText(eq: Pick<EquipmentType, 'description' | 'overview'>): string {
  return eq.overview?.text ?? eq.description;
}

export interface OverviewSourceGroup {
  title: string;
  url: string;
  /** 오름차순·중복 제거 쪽 번호 (없으면 문서 자체 링크) */
  pages: number[];
}

/** 근거 출처를 같은 URL 끼리 묶는다 — 처음 나온 순서 유지, 쪽은 정렬·중복 제거 */
export function groupOverviewSources(sources: EquipmentOverview['sources']): OverviewSourceGroup[] {
  const map = new Map<string, OverviewSourceGroup>();
  for (const s of sources) {
    const g = map.get(s.url) ?? { title: s.title, url: s.url, pages: [] };
    if (s.page && !g.pages.includes(s.page)) g.pages.push(s.page);
    map.set(s.url, g);
  }
  return [...map.values()].map((g) => ({ ...g, pages: [...g.pages].sort((a, b) => a - b) }));
}

/** 근거 줄에 보일 최대 출처(묶음) 수 — 나머지는 "외 N건" */
export const OVERVIEW_SOURCE_LIMIT = 3;
