/** 계통 종류: 데이터센터(국내) — src/lib/diagram/grid.ts · src/data/diagram-dc.json · 보조 계통도 검사 (2026-11-23) */
import { describe, expect, it } from 'vitest';
import { getData } from '../../../src/data/load';
import { GRID_LABELS, diagramOf, gridOfNode, parseGrid } from '../../../src/lib/diagram/grid';
import { getDiagramModel } from '../../../src/lib/diagram/model';
import { diagramHref } from '../../../src/lib/pages/catalog';
import { Collector } from '../../../src/lib/integrity';
import { diagramRules } from '../../../src/lib/integrity/diagram';

const data = getData();

describe('계통 종류', () => {
  it('주소 ?grid= 해석, 이름, 노드 id 로 계통 판별', () => {
    expect(parseGrid('dc')).toBe('dc');
    expect(parseGrid(null)).toBe('std');
    expect(parseGrid('x')).toBe('std');
    expect(GRID_LABELS.dc).toBe('데이터센터(국내)');
    expect(gridOfNode('dc-sst')).toBe('dc');
    expect(gridOfNode('n-vcb')).toBe('std');
  });

  it('데이터센터 계통도: 노드 id 는 모두 dc-, AC(변압기·UPS)와 DC(SST N+1·SSCB·DC-DC) 경로, 국내 22.9kV 수전', () => {
    const d = data.diagramDc;
    expect(d.nodes.every((n) => n.id.startsWith('dc-'))).toBe(true);
    const eqs = new Set(d.nodes.map((n) => n.equipmentTypeId).filter(Boolean));
    for (const id of ['cast-tr', 'ups', 'lv-ats', 'sst', 'sscb', 'dc-dc', 'ess', 'it-rack']) expect(eqs.has(id), id).toBe(true);
    expect(d.nodes.filter((n) => n.equipmentTypeId === 'sst' && n.ref).map((n) => n.label)).toContain('예비 SST (N+1)');
    expect(d.layers.find((l) => l.id === 'L4')!.voltage).toContain('22.9kV');
  });

  it('모델은 계통별로 따로, 데이터센터 사이드바 계층 = 그 계통도 계층', () => {
    const std = getDiagramModel(data, 'std');
    const dc = getDiagramModel(data, 'dc');
    expect(std.nodeById.has('n-vcb')).toBe(true);
    expect(dc.nodeById.has('n-vcb')).toBe(false);
    expect(dc.nodeById.has('dc-sst')).toBe(true);
    expect(dc.layers.map((l) => l.id)).toEqual(diagramOf(data, 'dc').layers.map((l) => l.id));
  });

  it('데이터센터 노드 링크는 ?grid=dc 를 붙임', () => {
    expect(diagramHref('dc-sst')).toBe('/?grid=dc&node=dc-sst');
    expect(diagramHref('n-vcb')).toBe('/?node=n-vcb');
  });

  it('보조 계통도 검사: 데이터센터 계통도 오류 0, 기본 계통도는 데이터센터에만 있는 기기를 "배치 안 됨"으로 보지 않음', () => {
    const c = new Collector();
    diagramRules(c, data.diagramDc, data.equipmentTypes, { auxiliary: true });
    expect(c.result().errors).toEqual([]);
    const strict = new Collector();
    diagramRules(strict, data.diagram, data.equipmentTypes);
    expect(strict.result().errors.filter((i) => i.rule === 'DI-43').map((i) => i.refs.equipmentId).sort()).toEqual(['dc-dc', 'it-rack', 'sscb', 'sst']);
    const ok = new Collector();
    diagramRules(ok, data.diagram, data.equipmentTypes, { placedElsewhere: new Set(['dc-dc', 'it-rack', 'sscb', 'sst']) });
    expect(ok.result().errors).toEqual([]);
  });
});
