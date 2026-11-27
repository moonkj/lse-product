/** 사고 시뮬레이션 결과 훅 — 계통도(DiagramCanvas)·흐름(FlowLayer)·결과 패널이 같은 결과를 쓴다 (주소 상태 기준 1회 계산 캐시) */
import { useMemo } from 'react';
import { useData } from '../../data/load';
import { getDiagramModel } from '../../lib/diagram/model';
import { flowDirMap } from '../../lib/diagram/flow';
import { diagramOf, getActiveGrid } from '../../lib/diagram/grid';
import { simulate, useSimState, type SimGraph, type SimResult } from '../../lib/diagram/sim';

let cache: { key: string; result: SimResult } | null = null;

export function useSimGraph(): SimGraph {
  const data = useData();
  const model = getDiagramModel(data);
  const grid = getActiveGrid();
  return useMemo(() => ({ edges: model.edges, dirs: flowDirMap(diagramOf(data, grid).edges), eqOf: (id: string) => model.nodeById.get(id)?.eq }), [data, model, grid]);
}

/** 시뮬레이션 켜짐이면 결과, 아니면 null */
export function useSimResult(): SimResult | null {
  const { on, opened, faults, opts } = useSimState();
  const graph = useSimGraph();
  const grid = getActiveGrid();
  const key = `${grid}|${[...opened].sort().join(',')}|${[...faults].sort().join(',')}|${opts.faultType}|${opts.failPrimary ? 1 : 0}|${opts.microgrid ? 1 : 0}`;
  return useMemo(() => {
    if (!on) return null;
    if (cache?.key === key) return cache.result;
    const result = simulate(graph, opened, faults, opts);
    cache = { key, result };
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, key, graph]);
}
