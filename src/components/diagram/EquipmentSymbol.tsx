import { memo } from 'react';
import type { EquipmentCategory } from '../../lib/schema';

/** 단선결선도 심볼 (72×72 viewBox) — 사진이 없는 기기(미보유·선로·해당 없음)에 사용 */
const BY_CATEGORY: Record<EquipmentCategory, string> = {
  // 차단기: 위·아래 선 + 열린 칼날 + 접점 사각
  switching: 'M36 6V24M36 48V66M36 48L22 27M31 21h10v6H31z',
  // 피뢰기
  protection: 'M36 6V22M26 22h20v26H26zM36 28l-4 8h8l-4 8M36 48V58M24 58h24M28 63h16M32 68h8',
  // 변압기: 겹친 두 원
  transformation: 'M36 2V12M36 60V70M36 12a12 12 0 1 1 0 24a12 12 0 1 1 0-24M36 36a12 12 0 1 1 0 24a12 12 0 1 1 0-24',
  // 변류기(계측): 선 + 원 + 접지
  measurement: 'M4 36H68M36 22a14 14 0 1 1 0 28a14 14 0 1 1 0-28M36 50V64M28 64h16',
  // 인버터: 사각 + 대각선 + ~
  control: 'M14 14h44v44H14zM14 58L58 14M20 26q4-6 8 0t8 0M38 48h14',
  // 감시: 모니터
  monitoring: 'M10 14h52v34H10zM28 60h16M36 48V60M18 38l10-10 8 6 10-12 8 8',
  // 발전기: 원 + 사인파
  generation: 'M36 2V14M36 14a22 22 0 1 1 0 44a22 22 0 1 1 0-44M24 36q6-10 12 0t12 0',
  // 선로: 철탑 + 전선
  conductor: 'M4 22H68M4 32H68M36 22L26 66M36 22L46 66M30 44h12M28 54h16',
  // 부하: 원 + X (조명)
  load: 'M36 4V16M36 16a20 20 0 1 1 0 40a20 20 0 1 1 0-40M22 22L50 50M50 22L22 50',
  // 설비(반): 함체 + 칸
  system: 'M14 8h44v56H14zM14 26h44M14 44h44M22 17h12M22 35h12M22 53h12',
};

/** 기기별로 더 정확한 심볼이 있는 경우 */
const BY_ID: Record<string, string> = {
  // 콘덴서: 평행 두 판
  capacitor: 'M36 4V30M36 42V68M18 30H54M18 42H54',
  // 리클로저: 차단기 + R 표시 대신 원형 접점
  recloser: 'M36 6V24M36 48V66M36 48L22 27M30 18a6 6 0 1 1 12 0a6 6 0 1 1-12 0',
  // ATS: 두 전원 → 전환 칼날
  'lv-ats': 'M20 6V24M52 6V24M36 48V66M36 48L20 26M14 24h12M46 24h12',
};

interface Props {
  category: EquipmentCategory;
  equipmentId: string;
  size?: number;
  className?: string;
}

function EquipmentSymbol({ category, equipmentId, size = 72, className }: Props) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 72 72"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={BY_ID[equipmentId] ?? BY_CATEGORY[category]} />
    </svg>
  );
}

export default memo(EquipmentSymbol);
