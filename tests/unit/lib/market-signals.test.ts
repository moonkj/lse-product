// @vitest-environment node
/** 기기 단위 시장 신호 (src/data/market-signals.json) — 스키마·무결성 */
import { describe, it, expect } from 'vitest';
import signalsJson from '../../../src/data/market-signals.json';
import equipmentTypes from '../../../src/data/equipment-types.json';
import {
  KIND_LAYERS,
  MarketSignalSchema,
  MarketSignalsFileSchema,
  loadMarketSignals,
  signalSource,
  signalsFor,
} from '../../../src/lib/market/signals';

const layerOf = new Map((equipmentTypes as { id: string; layer: string }[]).map((e) => [e.id, e.layer]));

describe('market-signals.json', () => {
  const file = loadMarketSignals();

  it('스키마 통과', () => {
    expect(MarketSignalsFileSchema.safeParse(signalsJson).success).toBe(true);
  });

  it('신호 id 중복 없음', () => {
    const ids = file.signals.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('존재하지 않는 기기 id 없음', () => {
    const unknown = file.signals.flatMap((s) => s.equipmentIds.filter((id) => !layerOf.has(id)).map((id) => `${s.id}:${id}`));
    expect(unknown).toEqual([]);
  });

  it('한전 투자는 L2·L3·MON, 신재생 연계는 REN 기기에만', () => {
    const bad = file.signals.flatMap((s) => {
      const allowed = KIND_LAYERS[s.kind];
      if (!allowed) return [];
      return s.equipmentIds.filter((id) => !allowed.includes(layerOf.get(id) ?? '')).map((id) => `${s.id}:${id}`);
    });
    expect(bad).toEqual([]);
  });

  it('모든 신호에 출처(https url·기준일·신뢰도)', () => {
    for (const s of file.signals) {
      const { source } = signalSource(s);
      expect(source.url.startsWith('https://'), s.id).toBe(true);
      expect(source.asof, s.id).toMatch(/^\d{4}-\d{2}/);
    }
  });

  it('2차 인용 수치는 확인 필요 표시 또는 원문 대조 방법 명시', () => {
    for (const s of file.signals) {
      if (!s.value || s.value.source.confidence !== 'secondary') continue;
      expect(Boolean(s.value.needsCheck) || s.value.method.includes('원문 수치'), s.id).toBe(true);
    }
  });

  it('ls-electric.com 출처 금지', () => {
    expect(file.signals.some((s) => signalSource(s).source.url.includes('ls-electric.com'))).toBe(false);
  });
});

describe('MarketSignalSchema 자기검증', () => {
  const base = { id: 'x', kind: 'leadtime', level: 'delay', equipmentIds: ['main-tr'], text: 't' };
  const src = { title: 'a', url: 'https://example.org', asof: '2026-01', confidence: 'secondary' };

  it('출처 없는 신호 거부', () => {
    expect(MarketSignalSchema.safeParse(base).success).toBe(false);
  });
  it('http 출처 거부', () => {
    expect(MarketSignalSchema.safeParse({ ...base, source: { ...src, url: 'http://example.org' } }).success).toBe(false);
  });
  it('value 와 source 동시 지정 거부', () => {
    const value = { value: 1, unit: '주', kind: 'actual', method: 'm', source: src };
    expect(MarketSignalSchema.safeParse({ ...base, value, source: src }).success).toBe(false);
  });
  it('source 만 있으면 통과', () => {
    expect(MarketSignalSchema.safeParse({ ...base, source: src }).success).toBe(true);
  });
});

describe('signalsFor — 계층 규칙', () => {
  it('한전 투자 신호는 L2 기기에 나오고, 계층이 맞지 않으면 걸러진다', () => {
    expect(signalsFor('main-tr', 'L2').some((s) => s.kind === 'kepco')).toBe(true);
    expect(signalsFor('main-tr', 'L4').some((s) => s.kind === 'kepco')).toBe(false);
  });
  it('신재생 신호는 REN 기기에만', () => {
    expect(signalsFor('ess', 'REN').some((s) => s.kind === 'renewable')).toBe(true);
    expect(signalsFor('ess', 'L6').some((s) => s.kind === 'renewable')).toBe(false);
  });
  it('근거 없는 기기는 빈 배열', () => {
    expect(signalsFor('gearbox', 'L7')).toEqual([]);
  });
});
