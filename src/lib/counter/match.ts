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

export interface Competitor {
  id: string;
  name: string;
  aliases: string[];
}

export const COMPETITORS: Competitor[] = [
  { id: 'abb', name: 'ABB', aliases: ['abb', '에이비비'] },
  { id: 'schneider', name: 'Schneider Electric', aliases: ['schneider', '슈나이더'] },
  { id: 'siemens', name: 'Siemens', aliases: ['siemens', '지멘스'] },
  { id: 'eaton', name: 'Eaton', aliases: ['eaton', '이튼'] },
  { id: 'mitsubishi', name: 'Mitsubishi Electric', aliases: ['mitsubishi', '미쓰비시', '미츠비시'] },
  { id: 'ge', name: 'GE Vernova', aliases: ['ge vernova', 'general electric', 'gev ', 'ge 버노바', '지이 버노바'] },
  { id: 'hitachi', name: 'Hitachi Energy', aliases: ['hitachi', '히타치'] },
  { id: 'hyosung', name: '효성중공업', aliases: ['효성', 'hyosung'] },
  { id: 'hd', name: 'HD현대일렉트릭', aliases: ['hd현대일렉트릭', 'hd현대', '현대일렉트릭', 'hd hyundai electric', 'hyundai electric'] },
  { id: 'iljin', name: '일진전기', aliases: ['일진전기', 'iljin'] },
  { id: 'rockwell', name: 'Rockwell Automation', aliases: ['rockwell', '로크웰', 'allen-bradley', 'allen bradley'] },
  { id: 'omron', name: 'Omron', aliases: ['omron', '오므론'] },
  { id: 'delta', name: 'Delta Electronics', aliases: ['delta electronics', '델타일렉트로닉스'] },
  { id: 'legrand', name: 'Legrand', aliases: ['legrand', '르그랑'] },
  { id: 'vertiv', name: 'Vertiv', aliases: ['vertiv', '버티브'] },
];

/** [키워드(소문자), 기기 id, 점수] — 제품군 일반어 */
const TERMS: [string, string, number][] = [
  // 차단기·개폐기
  ['air circuit breaker', 'acb', 3], ['acb', 'acb', 3], ['기중차단기', 'acb', 3],
  ['molded case', 'mccb', 3], ['mccb', 'mccb', 3], ['배선용차단기', 'mccb', 3],
  ['vacuum circuit breaker', 'vcb', 3], ['vcb', 'vcb', 3], ['진공차단기', 'vcb', 3],
  ['miniature circuit breaker', 'mcb-rcbo', 3], ['mcb', 'mcb-rcbo', 2], ['rcbo', 'mcb-rcbo', 3], ['rcd', 'elcb', 2], ['누전차단기', 'elcb', 3],
  ['circuit breaker', 'mccb', 1], ['breaker', 'mccb', 1], ['차단기', 'mccb', 1],
  ['load break switch', 'lbs', 3], ['부하개폐기', 'lbs', 3], ['transfer switch', 'lv-ats', 3], ['ats', 'lv-ats', 2], ['절환개폐기', 'lv-ats', 3],
  ['contactor', 'ms', 2], ['전자개폐기', 'ms', 3], ['전자접촉기', 'ms', 2],
  ['solid-state circuit breaker', 'sscb', 3], ['solid state circuit breaker', 'sscb', 3], ['sscb', 'sscb', 3], ['반도체 차단기', 'sscb', 3],
  // 배전반·개폐장치
  ['switchgear', 'mv-swgr', 2], ['ring main unit', 'auto-switch', 3], ['rmu', 'auto-switch', 3], ['수배전반', 'mv-swgr', 3], ['배전반', 'lv-swgr', 2],
  ['low voltage switchboard', 'lv-swgr', 3], ['switchboard', 'lv-swgr', 2], ['lv switchgear', 'lv-swgr', 3], ['mv switchgear', 'mv-swgr', 3], ['medium voltage', 'mv-swgr', 1],
  ['gas-insulated', 'gis-154', 3], ['gas insulated', 'gis-154', 3], ['gis', 'gis-154', 2], ['가스절연', 'gis-154', 3],
  ['motor control center', 'mcc', 3], ['mcc', 'mcc', 2], ['전동기 제어반', 'mcc', 3], ['panelboard', 'panelboard', 3], ['분전반', 'panelboard', 3],
  ['busway', 'busway', 3], ['busbar trunking', 'busway', 3], ['버스웨이', 'busway', 3], ['e-house', 'modular-substation', 3], ['ehouse', 'modular-substation', 3], ['modular substation', 'modular-substation', 3], ['skid', 'modular-substation', 1],
  // 변압기·전력전자
  ['solid-state transformer', 'sst', 4], ['solid state transformer', 'sst', 4], ['sst', 'sst', 3], ['반도체 변압기', 'sst', 4],
  ['dry-type transformer', 'cast-tr', 3], ['dry type transformer', 'cast-tr', 3], ['cast resin', 'cast-tr', 3], ['몰드변압기', 'cast-tr', 3],
  ['power transformer', 'main-tr', 3], ['large transformer', 'main-tr', 3], ['초고압 변압기', 'main-tr', 3], ['대형 변압기', 'main-tr', 3], ['주변압기', 'main-tr', 3],
  ['distribution transformer', 'oil-tr', 3], ['배전용 변압기', 'oil-tr', 3], ['transformer', 'oil-tr', 1], ['변압기', 'oil-tr', 1],
  ['power electronics', 'pcs', 1], ['전력전자', 'pcs', 1], ['dc distribution', 'dc-devices', 3], ['800v dc', 'dc-devices', 3], ['dc power', 'dc-devices', 2], ['직류 배전', 'dc-devices', 3],
  ['hvdc', 'hvdc', 4], ['초고압 직류', 'hvdc', 4], ['statcom', 'facts', 4], ['facts', 'facts', 3], ['svc', 'facts', 2], ['무효전력', 'facts', 2],
  // 보호·계측
  ['protection relay', 'protection-relay', 3], ['protective relay', 'protection-relay', 3], ['보호계전', 'protection-relay', 3], ['relay', 'protection-relay', 1],
  ['power meter', 'power-meter', 3], ['power quality', 'power-meter', 2], ['계측기', 'power-meter', 2], ['smart meter', 'meter', 3], ['전력량계', 'meter', 3],
  ['surge protect', 'spd', 3], ['spd', 'spd', 2], ['서지', 'spd', 2], ['arc flash', 'aps', 3], ['아크', 'aps', 2],
  // 자동화·구동
  ['variable frequency drive', 'lv-drive', 4], ['variable speed drive', 'lv-drive', 4], ['vfd', 'lv-drive', 3], ['ac drive', 'lv-drive', 3], ['inverter', 'lv-drive', 2], ['인버터', 'lv-drive', 3], ['drive', 'lv-drive', 1],
  ['medium voltage drive', 'mv-drive', 4], ['mv drive', 'mv-drive', 4], ['고압 인버터', 'mv-drive', 4],
  ['soft starter', 'soft-starter', 4], ['소프트 스타터', 'soft-starter', 4],
  ['motor', 'motor', 2], ['모터', 'motor', 2], ['전동기', 'motor', 2],
  ['plc', 'plc', 3], ['programmable logic', 'plc', 3], ['automation', 'plc', 1], ['자동화', 'plc', 1], ['controller', 'plc', 1],
  ['hmi', 'hmi', 3], ['servo', 'servo', 3], ['서보', 'servo', 3], ['motion control', 'servo', 2], ['robot', 'servo', 1], ['로봇', 'servo', 1],
  ['industrial ai', 'plc', 1], ['physical ai', 'plc', 1], ['autonomous production', 'plc', 1],
  // 신재생·저장
  ['energy storage', 'ess', 3], ['battery storage', 'ess', 3], ['bess', 'ess', 3], ['ess', 'ess', 2], ['에너지저장', 'ess', 3],
  ['pcs', 'pcs', 2], ['power conversion system', 'pcs', 3], ['solar', 'pv', 2], ['photovoltaic', 'pv', 3], ['태양광', 'pv', 3],
  ['microgrid', 'microgrid', 3], ['마이크로그리드', 'microgrid', 3], ['ev charg', 'ev-charger', 3], ['charger', 'ev-charger', 1], ['충전기', 'ev-charger', 3],
  ['ups', 'ups', 3], ['uninterruptible', 'ups', 3], ['무정전', 'ups', 3],
  // 시스템·SW
  ['scada', 'scada', 3], ['energy management', 'ems', 3], ['ems', 'ems', 2], ['bems', 'xems', 3], ['fems', 'xems', 3], ['dcim', 'xems', 2],
  ['distribution management', 'dms', 3], ['adms', 'dms', 3], ['substation automation', 'sas', 3], ['iec 61850', 'sas', 2], ['digital substation', 'sas', 3], ['디지털 변전소', 'sas', 3],
  ['asset management', 'care', 2], ['predictive maintenance', 'care', 2], ['condition monitoring', 'care', 2], ['예지보전', 'care', 3], ['설비 진단', 'care', 3],
  ['metering', 'amrs', 1], ['ami', 'amrs', 2], ['원격검침', 'amrs', 3],
  ['railway', 'railway', 3], ['철도', 'railway', 3], ['traction', 'railway', 2],
];

/** [경쟁사 시리즈명(소문자), 기기 id] — 시리즈명이 나오면 점수 5 */
const SERIES: [string, string][] = [
  // ABB
  ['emax', 'acb'], ['tmax', 'mccb'], ['sace', 'mccb'], ['unigear', 'mv-swgr'], ['safering', 'auto-switch'], ['acs880', 'lv-drive'], ['acs580', 'lv-drive'], ['acs6000', 'mv-drive'], ['ability', 'scada'], ['zenon', 'scada'],
  // Schneider
  ['masterpact', 'acb'], ['compact nsx', 'mccb'], ['compacts nsx', 'mccb'], ['acti9', 'mcb-rcbo'], ['prisma', 'lv-swgr'], ['okken', 'lv-swgr'], ['blokset', 'mcc'], ['sm airset', 'mv-swgr'], ['airset', 'mv-swgr'], ['premset', 'mv-swgr'], ['ringmaster', 'auto-switch'],
  ['altivar', 'lv-drive'], ['altistart', 'soft-starter'], ['modicon', 'plc'], ['ecostruxure', 'ems'], ['galaxy', 'ups'], ['easy ups', 'ups'], ['canalis', 'busway'], ['powerlogic', 'power-meter'], ['tesys', 'ms'], ['easergy', 'protection-relay'], ['sepam', 'protection-relay'],
  // Siemens
  ['sentron', 'mccb'], ['3wa', 'acb'], ['3wl', 'acb'], ['3va', 'mccb'], ['sivacon', 'lv-swgr'], ['nxair', 'mv-swgr'], ['8djh', 'auto-switch'], ['blue gis', 'gis-154'], ['sinamics', 'lv-drive'], ['simatic', 'plc'], ['siprotec', 'protection-relay'], ['sicam', 'sas'], ['gridscale', 'dms'], ['sirius', 'ms'], ['electrification x', 'ems'],
  // Eaton
  ['magnum', 'acb'], ['power defense', 'mccb'], ['xiria', 'auto-switch'], ['power xpert', 'lv-swgr'], ['powerxpert', 'lv-swgr'], ['93pm', 'ups'], ['9395', 'ups'], ['brightlayer', 'ems'],
  // Mitsubishi
  ['melsec', 'plc'], ['iq-r', 'plc'], ['iq-f', 'plc'], ['freqrol', 'lv-drive'], ['fr-a800', 'lv-drive'], ['ae-sw', 'acb'], ['ws-v', 'mccb'], ['melservo', 'servo'], ['got2000', 'hmi'],
  // GE·Hitachi
  ['multilin', 'protection-relay'], ['g3', 'gis-154'], ['econiq', 'gis-154'], ['hvdc light', 'hvdc'], ['relion', 'protection-relay'],
  // Rockwell·Omron·Delta
  ['controllogix', 'plc'], ['compactlogix', 'plc'], ['powerflex', 'lv-drive'], ['panelview', 'hmi'], ['kinetix', 'servo'], ['sysmac', 'plc'],
];

/** 프로젝트성 키워드 → 계통 묶음 (단선도 예시 id) */
export interface ProjectKind {
  id: 'datacenter' | 'substation' | 'grid' | 'renewable' | 'factory' | 'railway';
  label: string;
  terms: string[];
  equipment: string[];
  preset?: 'datacenter' | 'substation' | 'grid';
}
export const PROJECT_KINDS: ProjectKind[] = [
  { id: 'datacenter', label: '데이터센터', terms: ['data center', 'datacenter', 'data centre', '데이터센터', 'aidc', 'hyperscale', '하이퍼스케일', 'ai 전력'], equipment: ['mv-swgr', 'cast-tr', 'lv-swgr', 'acb', 'busway', 'lv-ats', 'ups', 'sst', 'dc-devices', 'ess', 'scada', 'xems'], preset: 'datacenter' },
  { id: 'substation', label: '수변전·변전소', terms: ['substation', '변전소', '수변전', 'grid connection', '계통연계'], equipment: ['gis-154', 'main-tr', 'sas', 'protection-relay', 'mv-swgr', 'vcb', 'cast-tr'], preset: 'substation' },
  { id: 'grid', label: '송배전 전력망', terms: ['transmission', '송전', 'grid modernization', '전력망', 'utility', '한전', 'kepco', 'interconnector'], equipment: ['ehv-gis', 'main-tr', 'hvdc', 'facts', 'dms', 'auto-switch', 'recloser'], preset: 'grid' },
  { id: 'renewable', label: '신재생·ESS', terms: ['solar farm', 'wind farm', 'renewable', '재생에너지', '신재생', 'bess', 'energy storage', '풍력'], equipment: ['pv', 'pcs', 'ess', 'microgrid', 'mv-swgr', 'oil-tr', 'ems'] },
  { id: 'factory', label: '공장·산업 설비', terms: ['factory', 'plant', 'manufacturing', '공장', '산업단지', '산단', 'semiconductor fab', '반도체 공장', 'battery plant', '배터리 공장'], equipment: ['mv-swgr', 'cast-tr', 'lv-swgr', 'mcc', 'lv-drive', 'mv-drive', 'plc', 'xems'] },
  { id: 'railway', label: '철도', terms: ['railway', 'metro', 'rail ', '철도', '지하철', '전철'], equipment: ['railway', 'gis-154', 'main-tr', 'scada'] },
];

/** 자사 범위 밖 기기를 경쟁사가 낼 때 대신 보여 줄 주변 자사 기기 */
const ADJACENT: Record<string, string[]> = {
  motor: ['lv-drive', 'soft-starter', 'mms', 'empr', 'mv-drive'],
  generator: ['ats', 'lv-ats', 'mv-swgr'],
  'it-rack': ['panelboard', 'busway', 'ups'],
  'emergency-gen': ['lv-ats', 'alts'],
};

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
