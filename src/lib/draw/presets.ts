/**
 * 단선도 그리기 — 예시로 시작하기 (수전설비 · 데이터센터(국내) · 전체 계통 L1~L7).
 * 좌표는 20px 격자. 선은 위(전원) → 아래(부하).
 */
import { emptyDiagram, makeNode, newId, type DNode, type Diagram } from './model';

type Spec = { k: string; kind: DNode['kind']; x: number; y: number; eq?: string; patch?: Partial<DNode> };

function build(name: string, specs: Spec[], links: [string, string][]): Diagram {
  const d = emptyDiagram(name);
  const ids = new Map<string, string>();
  // 2026-11-26 상자·글자를 키우며 예시 배치도 같은 비율로 넓힘 (가로 1.3배, 세로 1.35배)
  const SX = 1.3;
  const SY = 1.35;
  for (const s of specs) {
    const patch = s.patch?.w ? { ...s.patch, w: Math.round((s.patch.w * SX) / 20) * 20 } : s.patch;
    const n = { ...makeNode(s.kind, s.x * SX, s.y * SY, s.eq), ...patch };
    ids.set(s.k, n.id);
    d.nodes.push(n);
  }
  for (const [a, b] of links) d.edges.push({ id: newId('e'), from: ids.get(a)!, to: ids.get(b)! });
  return d;
}

export const PRESETS: { id: string; label: string; desc: string; make: () => Diagram }[] = [
  {
    id: 'substation',
    label: '수전설비',
    desc: '한전 22.9kV → 특고압 수배전반 → 변압기 → 저압 배전반 → 모선 → MCC·분전반',
    make: () =>
      build(
        '수전설비 단선도',
        [
          { k: 'src', kind: 'source', x: 420, y: 40, patch: { label: '한전 22.9kV 수전' } },
          { k: 'mv', kind: 'panel', x: 400, y: 160, eq: 'mv-swgr' },
          { k: 'tr', kind: 'equipment', x: 420, y: 340, eq: 'cast-tr' },
          { k: 'lv', kind: 'panel', x: 400, y: 500, eq: 'lv-swgr' },
          { k: 'bus', kind: 'bus', x: 200, y: 680, patch: { w: 600 } },
          { k: 'mcc', kind: 'panel', x: 200, y: 760, eq: 'mcc' },
          { k: 'pb', kind: 'panel', x: 600, y: 760, eq: 'panelboard' },
          { k: 'motor', kind: 'equipment', x: 220, y: 940, eq: 'motor' },
          { k: 'light', kind: 'equipment', x: 620, y: 940, eq: 'lighting-outlet' },
        ],
        [
          ['src', 'mv'],
          ['mv', 'tr'],
          ['tr', 'lv'],
          ['lv', 'bus'],
          ['bus', 'mcc'],
          ['bus', 'pb'],
          ['mcc', 'motor'],
          ['pb', 'light'],
        ],
      ),
  },
  {
    id: 'datacenter',
    label: '데이터센터 (국내)',
    desc: '22.9kV 2회선 → 수배전반 → AC 경로(변압기·UPS·발전기 ATS) + DC 경로(SST·800V DC) → IT 랙',
    make: () =>
      build(
        '데이터센터 단선도',
        [
          { k: 's1', kind: 'source', x: 300, y: 40, patch: { label: '한전 22.9kV 1회선' } },
          { k: 's2', kind: 'source', x: 620, y: 40, patch: { label: '한전 22.9kV 2회선' } },
          { k: 'alts', kind: 'equipment', x: 460, y: 140, eq: 'alts' },
          { k: 'mv', kind: 'panel', x: 440, y: 280, eq: 'mv-swgr' },
          { k: 'hvbus', kind: 'bus', x: 160, y: 440, patch: { v: '22.9', w: 840 } },
          { k: 'tr', kind: 'equipment', x: 200, y: 500, eq: 'cast-tr', patch: { kVA: 2000 } },
          { k: 'lv', kind: 'panel', x: 180, y: 820, eq: 'lv-swgr' },
          { k: 'gen', kind: 'equipment', x: 440, y: 500, eq: 'emergency-gen' },
          { k: 'ats', kind: 'equipment', x: 440, y: 660, eq: 'lv-ats' },
          { k: 'ups', kind: 'equipment', x: 200, y: 1000, eq: 'ups' },
          { k: 'rack1', kind: 'equipment', x: 200, y: 1160, eq: 'it-rack' },
          { k: 'sst', kind: 'equipment', x: 760, y: 500, eq: 'sst' },
          { k: 'dcbus', kind: 'bus', x: 640, y: 660, patch: { v: 'dc0.8', w: 420 } },
          { k: 'sscb', kind: 'equipment', x: 660, y: 720, eq: 'dc-devices' },
          { k: 'ess', kind: 'equipment', x: 880, y: 720, eq: 'ess' },
          { k: 'rack2', kind: 'equipment', x: 660, y: 880, eq: 'it-rack', patch: { v: 'dc0.8', label: 'IT 서버 랙 (800V DC)' } },
        ],
        [
          ['s1', 'alts'],
          ['s2', 'alts'],
          ['alts', 'mv'],
          ['mv', 'hvbus'],
          ['hvbus', 'tr'],
          ['hvbus', 'sst'],
          ['tr', 'lv'],
          ['gen', 'ats'],
          ['ats', 'lv'],
          ['lv', 'ups'],
          ['ups', 'rack1'],
          ['sst', 'dcbus'],
          ['dcbus', 'sscb'],
          ['dcbus', 'ess'],
          ['sscb', 'rack2'],
        ],
      ),
  },
  {
    id: 'grid',
    label: '전체 계통 (L1~L7)',
    desc: '발전 → 승압 → 345kV 송전 → 154kV 변전 → 22.9kV 배전 → 수용가 수전·변압 → 저압 → 말단 부하',
    make: () =>
      build(
        '전체 계통 단선도',
        [
          { k: 'gen', kind: 'equipment', x: 120, y: 40, eq: 'generator' },
          { k: 'gsu', kind: 'equipment', x: 120, y: 180, eq: 'step-up-tr' },
          { k: 'gis', kind: 'equipment', x: 120, y: 320, eq: 'ehv-gis' },
          { k: 'line', kind: 'equipment', x: 120, y: 460, eq: 'transmission-line' },
          { k: 'mtr1', kind: 'equipment', x: 120, y: 600, eq: 'main-tr', patch: { hv: '345', lv: '154', label: '주변압기 345/154kV' } },
          { k: 'gis154', kind: 'equipment', x: 420, y: 600, eq: 'gis-154' },
          { k: 'mtr2', kind: 'equipment', x: 420, y: 740, eq: 'main-tr', patch: { label: '주변압기 154/22.9kV' } },
          { k: 'dbus', kind: 'bus', x: 380, y: 880, patch: { v: '22.9', w: 560, label: '22.9kV 배전 모선' } },
          { k: 'dline', kind: 'equipment', x: 420, y: 940, eq: 'dist-line' },
          { k: 'sw', kind: 'equipment', x: 420, y: 1080, eq: 'auto-switch' },
          { k: 'mv', kind: 'panel', x: 720, y: 1080, eq: 'mv-swgr' },
          { k: 'tr', kind: 'equipment', x: 740, y: 1260, eq: 'cast-tr' },
          { k: 'lv', kind: 'panel', x: 720, y: 1420, eq: 'lv-swgr' },
          { k: 'pb', kind: 'panel', x: 1000, y: 1420, eq: 'panelboard' },
          { k: 'load', kind: 'equipment', x: 1020, y: 1600, eq: 'lighting-outlet' },
        ],
        [
          ['gen', 'gsu'],
          ['gsu', 'gis'],
          ['gis', 'line'],
          ['line', 'mtr1'],
          ['mtr1', 'gis154'],
          ['gis154', 'mtr2'],
          ['mtr2', 'dbus'],
          ['dbus', 'dline'],
          ['dline', 'sw'],
          ['sw', 'mv'],
          ['mv', 'tr'],
          ['tr', 'lv'],
          ['lv', 'pb'],
          ['pb', 'load'],
        ],
      ),
  },
];
