/**
 * 보호협조 곡선(TCC) — 트립된(또는 차단 실패한) 기기와 후비 기기의 대표 시간-전류 곡선을 한 그림에 (2026-11-27)
 * 가로 = 정격 배수(1~100×, 로그), 세로 = 동작 시간(0.005~1000초, 로그). 기기 종류별 대표 곡선이며 실제 설정·제품 곡선이 아님.
 */
export type TccKind = 'mcb' | 'mccb' | 'acb' | 'ocr' | 'fuse' | 'thermal' | 'drive';

/** 기기 id → 곡선 종류 */
export function tccKindOf(eqId: string): TccKind | null {
  if (['mcb-rcbo', 'elcb'].includes(eqId)) return 'mcb';
  if (['mccb', 'branch-mccb', 'mms', 'dc-devices'].includes(eqId)) return 'mccb';
  if (eqId === 'acb') return 'acb';
  if (['vcb', 'ehv-gis', 'gis-154', 'recloser', 'vc-vi', 'auto-switch'].includes(eqId)) return 'ocr';
  if (eqId === 'pf') return 'fuse';
  if (eqId === 'ms') return 'thermal';
  if (['lv-drive', 'mv-drive', 'soft-starter'].includes(eqId)) return 'drive';
  return null;
}

/** 대표 동작 시간(초) at I(정격 배수) */
export function tccTime(kind: TccKind, I: number): number | null {
  if (I <= 1.05) return null;
  switch (kind) {
    case 'mcb':
      return I >= 7 ? 0.01 : 120 / (I * I - 1);
    case 'mccb':
      return I >= 10 ? 0.015 : 300 / (I * I - 1);
    case 'acb':
      if (I >= 15) return 0.05;
      if (I >= 6) return 0.3;
      return 600 / (I * I - 1);
    case 'ocr':
      // IEC 표준 반한시 (TMS 0.2) + 순시 20×
      return I >= 20 ? 0.08 : (0.14 * 0.2) / (Math.pow(I, 0.02) - 1);
    case 'fuse':
      return Math.max(0.004, 60 / Math.pow(I, 2.6));
    case 'thermal':
      return 900 / (I * I - 1);
    case 'drive':
      if (I >= 2.5) return 0.005;
      return I >= 1.5 ? 5 : 60;
  }
}

const KIND_LABEL: Record<TccKind, string> = { mcb: '소형·누전 차단기', mccb: '배선용 차단기', acb: '기중차단기(장한시·단한시·순시)', ocr: '과전류 계전기 + 차단기', fuse: '한류 퓨즈', thermal: '열동 계전기', drive: '전자식 보호' };

interface Curve {
  id: string;
  label: string;
  kind: TccKind;
  role: 'primary' | 'backup' | 'failed';
}

const W = 360;
const H = 220;
const PAD = { l: 40, r: 10, t: 10, b: 28 };
const X0 = Math.log10(1);
const X1 = Math.log10(100);
const Y0 = Math.log10(0.005);
const Y1 = Math.log10(1000);
const sx = (I: number) => PAD.l + ((Math.log10(I) - X0) / (X1 - X0)) * (W - PAD.l - PAD.r);
const sy = (t: number) => PAD.t + (1 - (Math.log10(t) - Y0) / (Y1 - Y0)) * (H - PAD.t - PAD.b);

export function tccPath(kind: TccKind): string {
  const pts: string[] = [];
  for (let k = 0; k <= 160; k++) {
    const I = Math.pow(10, X0 + ((X1 - X0) * k) / 160);
    const t = tccTime(kind, I);
    if (t === null) continue;
    const tt = Math.min(1000, Math.max(0.005, t));
    pts.push(`${pts.length ? 'L' : 'M'}${sx(I).toFixed(1)} ${sy(tt).toFixed(1)}`);
  }
  return pts.join('');
}

const COLOR: Record<Curve['role'], string> = { primary: '#c2410c', backup: '#1d4ed8', failed: '#7a271a' };

export default function TccChart({ curves, faultMultiple }: { curves: Curve[]; faultMultiple: number }) {
  if (!curves.length) return null;
  const xt = [1, 2, 5, 10, 20, 50, 100];
  const yt = [0.01, 0.1, 1, 10, 100, 1000];
  return (
    <figure className="dsim-tcc" data-testid="sim-tcc">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="보호협조 대표 곡선: 가로 정격 배수, 세로 동작 시간">
        <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} fill="none" stroke="#d0d5dd" />
        {xt.map((x) => (
          <g key={`x${x}`}>
            <line x1={sx(x)} x2={sx(x)} y1={PAD.t} y2={H - PAD.b} stroke="#eaecf0" />
            <text x={sx(x)} y={H - PAD.b + 12} fontSize="9" textAnchor="middle" fill="#667085">
              {x}×
            </text>
          </g>
        ))}
        {yt.map((y) => (
          <g key={`y${y}`}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(y)} y2={sy(y)} stroke="#eaecf0" />
            <text x={PAD.l - 4} y={sy(y) + 3} fontSize="9" textAnchor="end" fill="#667085">
              {y >= 1 ? `${y}s` : `${y * 1000}ms`}
            </text>
          </g>
        ))}
        <line x1={sx(faultMultiple)} x2={sx(faultMultiple)} y1={PAD.t} y2={H - PAD.b} stroke="#d92d20" strokeDasharray="4 3" />
        <text x={sx(faultMultiple) + 3} y={PAD.t + 10} fontSize="9" fill="#d92d20">
          사고 전류 {faultMultiple}×
        </text>
        {curves.map((c) => (
          <path key={c.id} d={tccPath(c.kind)} fill="none" stroke={COLOR[c.role]} strokeWidth={2} strokeDasharray={c.role === 'failed' ? '5 3' : undefined} />
        ))}
        <text x={(W + PAD.l) / 2} y={H - 2} fontSize="9" textAnchor="middle" fill="#667085">
          정격 배수 (로그)
        </text>
      </svg>
      <figcaption>
        {curves.map((c) => (
          <span key={c.id} className="dsim-tcc__leg">
            <i style={{ background: COLOR[c.role] }} />
            {c.role === 'primary' ? '1차' : c.role === 'failed' ? '1차(차단 실패)' : '후비'} {c.label} — {KIND_LABEL[c.kind]}
          </span>
        ))}
        <span className="dsim-tcc__note">기기 종류별 대표 곡선(참고) · 실제 정격·설정 곡선은 제품 카탈로그로 확인</span>
      </figcaption>
    </figure>
  );
}
