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
  /** 그중 본문에서만 찾은 말 */
  bodyTerms?: string[];
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

/** 본문에서만 찾은 말의 비중 (제목 1) — 본문은 길어 곁가지 언급이 많다 */
export const BODY_WEIGHT = 0.4;
/** 본문에서만 찾은 제품군은 본문 원점수가 이만큼은 돼야 남김 (일반어 한 번 스친 것은 버림) */
export const BODY_MIN_RAW = 3;

export function matchText(input: string): MatchResult {
  return matchParts(input, '');
}

/**
 * 기사 제목 + 본문으로 판단. 제목에서 찾은 말은 그대로, 본문에서만 찾은 말은 BODY_WEIGHT 비중.
 * 본문에서만 나온 제품군은 본문 점수가 BODY_MIN_RAW 이상일 때만 (시리즈명 1개 또는 구체 키워드 여러 개).
 * 본문에 여러 번 나오는 제품군은 횟수만큼 조금 더 (최대 +1).
 */
export function matchArticle(title: string, body: string): MatchResult {
  return matchParts(title, body);
}

/** 본문에 term 이 몇 번 나오는지 (최대 5) */
function countIn(text: string, term: string): number {
  if (!contains(text, term)) return 0;
  const short = /^[a-z0-9-]{1,4}$/.test(term);
  const re = new RegExp(short ? `(^|[^a-z0-9])${term.replace(/[-]/g, '\\-')}(?=[^a-z0-9]|$)` : term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  return Math.min(5, text.match(re)?.length ?? 1);
}

function matchParts(titleIn: string, bodyIn: string): MatchResult {
  const text = norm(titleIn);
  const body = bodyIn.trim() ? norm(bodyIn) : '';
  const competitors = COMPETITORS.filter((c) => c.aliases.some((a) => contains(text, a.trim()) || (body && contains(body, a.trim()))));
  const score = new Map<string, EquipmentHit>();
  const titleScore = new Map<string, number>();
  const bodyRaw = new Map<string, number>();
  const add = (eq: string, s: number, term: string, inBody: boolean) => {
    const h = score.get(eq) ?? { eq, score: 0, terms: [] };
    h.score += s;
    if (!h.terms.includes(term)) h.terms.push(term);
    if (inBody) {
      h.bodyTerms ??= [];
      if (!h.bodyTerms.includes(term)) h.bodyTerms.push(term);
    } else titleScore.set(eq, (titleScore.get(eq) ?? 0) + s);
    score.set(eq, h);
  };
  const scan = (src: string, inBody: boolean) => {
    const w = inBody ? BODY_WEIGHT : 1;
    const seen = (term: string, eq: string) => inBody && contains(text, term) && score.get(eq)?.terms.includes(term);
    for (const [term, eq] of SERIES)
      if (contains(src, term) && !seen(term, eq)) {
        add(eq, 5 * w, term, inBody);
        if (inBody) bodyRaw.set(eq, (bodyRaw.get(eq) ?? 0) + 5);
      }
    for (const [term, eq, s] of TERMS)
      if (contains(src, term) && !seen(term, eq)) {
        const n = inBody ? countIn(src, term) : 1;
        add(eq, s * w + (inBody ? Math.min(1, (n - 1) * 0.25) : 0), term, inBody);
        if (inBody) bodyRaw.set(eq, (bodyRaw.get(eq) ?? 0) + s * Math.min(n, 2));
      }
  };
  scan(text, false);
  if (body) {
    scan(body, true);
    // 본문에서만 나왔고 약하면 버림
    for (const [eq] of score) if (!titleScore.has(eq) && (bodyRaw.get(eq) ?? 0) < BODY_MIN_RAW) score.delete(eq);
  }
  // 일반어('breaker', '변압기')는 더 구체적인 같은 계열이 걸렸으면 낮춤
  const generic: Record<string, string[]> = { mccb: ['acb', 'vcb', 'mcb-rcbo', 'elcb', 'sscb'], 'oil-tr': ['cast-tr', 'main-tr', 'sst'], 'lv-drive': ['mv-drive'], 'mv-swgr': ['lv-swgr', 'gis-154', 'auto-switch'] };
  for (const [g, specific] of Object.entries(generic)) {
    const h = score.get(g);
    if (h && h.score <= 2 && specific.some((s) => score.has(s))) score.delete(g);
  }
  // 프로젝트: 제목에 있거나, 본문에 그 프로젝트 말이 2번 이상(서로 다른 말 또는 같은 말 반복)
  const projects = PROJECT_KINDS.filter(
    (p) => p.terms.some((t) => contains(text, t)) || (body && p.terms.reduce((n, t) => n + countIn(body, t), 0) >= 2),
  );
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
