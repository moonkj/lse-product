/** 경쟁 대응 (src/lib/counter/match) — 경쟁사·제품군·프로젝트 찾기 */
import { describe, expect, it } from 'vitest';
import { getData } from '../../../src/data/load';
import { COMPETITORS, PROJECT_KINDS, matchText } from '../../../src/lib/counter/match';

const eqs = (q: string) => matchText(q).hits.map((h) => h.eq);

describe('경쟁 대응 매칭', () => {
  it('사전의 기기 id 는 모두 실제 기기', () => {
    const d = getData();
    for (const p of PROJECT_KINDS) for (const id of p.equipment) expect(d.equipmentTypeById.has(id), `${p.id}:${id}`).toBe(true);
    expect(new Set(COMPETITORS.map((c) => c.id)).size).toBe(COMPETITORS.length);
  });
  it('시리즈명: Masterpact → ACB, Altivar → 인버터, SINAMICS → 인버터, Emax → ACB (경쟁사도 찾음)', () => {
    const r = matchText('Schneider Electric launches Masterpact MTZ and Altivar ATV900');
    expect(r.competitors.map((c) => c.id)).toEqual(['schneider']);
    expect(eqs('Schneider Electric launches Masterpact MTZ and Altivar ATV900').slice(0, 2).sort()).toEqual(['acb', 'lv-drive']);
    expect(eqs('Siemens SINAMICS G220')[0]).toBe('lv-drive');
    expect(eqs('ABB Emax 2')[0]).toBe('acb');
  });
  it('자사 범위 밖(전동기) → 인버터·소프트스타터·MMS 로 연관 대응', () => {
    const r = matchText('ABB Unveils Intelligent Motor to Accelerate Industrial AI Adoption');
    expect(r.competitors[0].name).toBe('ABB');
    const adj = r.hits.filter((h) => h.adjacentTo === 'motor').map((h) => h.eq);
    expect(adj).toEqual(expect.arrayContaining(['lv-drive', 'soft-starter', 'mms']));
  });
  it('한국어 기사: 효성 765kV 초고압 변압기·GIS → 주변압기·GIS', () => {
    const r = matchText('효성중공업, 765kV 초고압 변압기·GIS 수주');
    expect(r.competitors[0].id).toBe('hyosung');
    expect(eqs('효성중공업, 765kV 초고압 변압기·GIS 수주')).toEqual(expect.arrayContaining(['main-tr', 'gis-154']));
    // 구체적인 '초고압 변압기'가 있으면 일반어 '변압기'(유입변압기)는 뺀다
    expect(eqs('효성중공업, 765kV 초고압 변압기·GIS 수주')).not.toContain('oil-tr');
  });
  it('프로젝트성: 데이터센터 수주 → 데이터센터 묶음(단선도 예시), UPS 는 미보유로 표시됨', () => {
    const r = matchText('Eaton wins hyperscale data center UPS and switchgear order');
    expect(r.projects.map((p) => p.id)).toContain('datacenter');
    expect(r.projects[0].preset).toBe('datacenter');
    expect(eqs('Eaton wins hyperscale data center UPS and switchgear order')).toEqual(expect.arrayContaining(['ups', 'mv-swgr']));
    expect(getData().equipmentTypeById.get('ups')!.coverage).toBe('missing');
  });
  it('짧은 약어는 단어로만: groups·startups 의 "ups" 는 UPS 가 아님', () => {
    expect(eqs('Industry groups back startups')).not.toContain('ups');
    expect(eqs('new UPS line')).toContain('ups');
  });
  it('아무 것도 없으면 빈 결과', () => {
    const r = matchText('오늘 날씨 맑음');
    expect(r.hits).toEqual([]);
    expect(r.competitors).toEqual([]);
  });
});
