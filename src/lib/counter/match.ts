/**
 * 경쟁 대응 — 뉴스 제목·요약이나 경쟁사 제품명에서 경쟁사와 제품군을 찾아 자사 대응 기기·제품으로 잇는다.
 * 규칙 사전 기반(키워드·경쟁사 제품 시리즈명), 서버·AI 없음. 결과는 '참고'이며 실제 대응 가능 여부는 사업부 판단.
 *  · 제품군 키워드(국·영문) → 자사 기기 id (점수)
 *  · 경쟁사 시리즈명(예: Masterpact → ACB, Altivar → 인버터) → 자사 기기 id (점수 높게)
 *  · 프로젝트성 키워드(데이터센터·변전소·태양광·ESS·철도·공장) → 계통 묶음 + 단선도 예시
 *  · 경쟁사 제품이 자사 사업 범위 밖(전동기 등)이면 그 주변 자사 기기(인버터·소프트스타터·MMS)로 '연관 대응'
 */
import { getData } from '../../data/load';
import type { Coverage } from '../schema';
// 사전 원본 — 공개 파일 counter-index.json(scripts/build-counter-index.mjs)도 이 파일로 만든다
import dict from '../../data/counter-dict.json';

export interface Competitor {
  id: string;
  name: string;
  aliases: string[];
}

export const COMPETITORS: Competitor[] = dict.competitors;

/** [키워드(소문자), 기기 id, 점수] — 제품군 일반어 */
export const TERMS = dict.terms as [string, string, number][];

/** [경쟁사 시리즈명(소문자), 기기 id] — 시리즈명이 나오면 점수 5 */
export const SERIES = dict.series as [string, string][];

/** 프로젝트성 키워드 → 계통 묶음 (단선도 예시 id) */
export interface ProjectKind {
  id: 'datacenter' | 'substation' | 'grid' | 'renewable' | 'factory' | 'railway';
  label: string;
  terms: string[];
  equipment: string[];
  preset?: 'datacenter' | 'substation' | 'grid';
}
export const PROJECT_KINDS = dict.projects as ProjectKind[];

/** 자사 범위 밖 기기를 경쟁사가 낼 때 대신 보여 줄 주변 자사 기기 */
export const ADJACENT: Record<string, string[]> = dict.adjacent;

export interface EquipmentHit {
  eq: string;
  score: number;
  terms: string[];
  /** 경쟁사 제품이 자사 범위 밖이라 연관 기기로 보여 주는 것 */
  adjacentTo?: string;
}

export interface MatchResult {
  competitors: Competitor[];
  hits: EquipmentHit[];
  projects: ProjectKind[];
}

const norm = (s: string) => ` ${s.toLowerCase().replace(/[‐-―]/g, '-').replace(/\s+/g, ' ')} `;

/** 영문 짧은 약어(3자 이하)는 단어 경계로만 (예: 'ups' 가 'groups' 에 걸리지 않게) */
function contains(text: string, term: string): boolean {
  if (/^[a-z0-9-]{1,4}$/.test(term)) return new RegExp(`(^|[^a-z0-9])${term.replace(/[-]/g, '\\-')}([^a-z0-9]|$)`).test(text);
  return text.includes(term);
}

export function matchText(input: string): MatchResult {
  const text = norm(input);
  const competitors = COMPETITORS.filter((c) => c.aliases.some((a) => contains(text, a.trim())));
  const score = new Map<string, EquipmentHit>();
  const add = (eq: string, s: number, term: string) => {
    const h = score.get(eq) ?? { eq, score: 0, terms: [] };
    h.score += s;
    if (!h.terms.includes(term)) h.terms.push(term);
    score.set(eq, h);
  };
  for (const [term, eq] of SERIES) if (contains(text, term)) add(eq, 5, term);
  for (const [term, eq, s] of TERMS) if (contains(text, term)) add(eq, s, term);
  // 일반어('breaker', '변압기')는 더 구체적인 같은 계열이 걸렸으면 낮춤
  const generic: Record<string, string[]> = { mccb: ['acb', 'vcb', 'mcb-rcbo', 'elcb', 'sscb'], 'oil-tr': ['cast-tr', 'main-tr', 'sst'], 'lv-drive': ['mv-drive'], 'mv-swgr': ['lv-swgr', 'gis-154', 'auto-switch'] };
  for (const [g, specific] of Object.entries(generic)) {
    const h = score.get(g);
    if (h && h.score <= 2 && specific.some((s) => score.has(s))) score.delete(g);
  }
  const projects = PROJECT_KINDS.filter((p) => p.terms.some((t) => contains(text, t)));
  let hits = [...score.values()];
  // 범위 밖 기기 → 주변 자사 기기 (연관 대응)
  const data = getData();
  for (const h of [...hits]) {
    const cov = data.equipmentTypeById.get(h.eq)?.coverage;
    if (cov === 'na' && ADJACENT[h.eq])
      for (const [k, a] of ADJACENT[h.eq].entries())
        if (!score.has(a) && data.equipmentTypeById.has(a)) {
          const adj = { eq: a, score: h.score - 0.5 - k * 0.1, terms: h.terms, adjacentTo: h.eq };
          score.set(a, adj);
          hits.push(adj);
        }
  }
  hits = hits.filter((h) => data.equipmentTypeById.has(h.eq)).sort((a, b) => b.score - a.score);
  return { competitors, hits, projects };
}

/** 보유 상태별 대응 문구 */
export const RESPONSE_LABEL: Record<Coverage, string> = {
  owned: '자사 제품으로 대응',
  partial: '일부 대응 (라인업 일부)',
  affiliate: '계열사 제품으로 대응',
  sourced: '수배전반에 넣어 공급',
  developing: '자사 개발 중',
  missing: '자사 미보유 — 대응 어려움',
  na: '자사 사업 범위 밖',
};
