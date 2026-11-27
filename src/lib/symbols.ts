/**
 * 단선결선도 심볼 경로 (72×72 viewBox) — 화면(EquipmentSymbol)과 단선도 그림 내보내기(exportSvg)가 같이 쓴다.
 */
import type { EquipmentCategory } from './schema';

export const BY_CATEGORY: Record<EquipmentCategory, string> = {
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
export const BY_ID: Record<string, string> = {
  // 콘덴서: 평행 두 판
  capacitor: 'M36 4V30M36 42V68M18 30H54M18 42H54',
  // 리클로저: 차단기 + R 표시 대신 원형 접점
  recloser: 'M36 6V24M36 48V66M36 48L22 27M30 18a6 6 0 1 1 12 0a6 6 0 1 1-12 0',
  // ATS: 두 전원 → 전환 칼날
  'lv-ats': 'M20 6V24M52 6V24M36 48V66M36 48L20 26M14 24h12M46 24h12',
  // UPS: 함체 + 대각선(정류·인버터) + 교류(~)·직류(=) + 아래 배터리
  ups: 'M36 2V10M14 10h44v40H14zM14 50L58 10M20 22q4-6 8 0t8 0M40 38h12M40 43h12M36 50V58M24 58h24M30 64h12',
  // 계측 3종 구분 (E3 P1 — MOF·CT/PT·WHM 이 measurement 하나를 같이 써서 똑같아 보였음)
  // CT/PT: 선로를 감싼 CT 원 + 아래로 PT(겹친 작은 두 원)
  'ct-pt': 'M4 22H68M36 10a12 12 0 1 1 0 24a12 12 0 1 1 0-24M36 34V42M36 42a7 7 0 1 1 0 14a7 7 0 1 1 0-14M36 52a7 7 0 1 1 0 14a7 7 0 1 1 0-14',
  'ct-pt-ehv': 'M4 22H68M36 10a12 12 0 1 1 0 24a12 12 0 1 1 0-24M36 34V42M36 42a7 7 0 1 1 0 14a7 7 0 1 1 0-14M36 52a7 7 0 1 1 0 14a7 7 0 1 1 0-14',
  // MOF: CT·PT 를 한 함체에 넣은 계기용 변성기함
  mof: 'M10 8h52v56H10zM2 26H70M36 18a8 8 0 1 1 0 16a8 8 0 1 1 0-16M36 34V40M36 40a5 5 0 1 1 0 10a5 5 0 1 1 0-10M36 48a5 5 0 1 1 0 10a5 5 0 1 1 0-10',
  // WHM(전력량계): 함체 + 표시창 + 회전 원판
  meter: 'M14 6h44v60H14zM22 14h28v14H22zM36 38a9 9 0 1 1 0 18a9 9 0 1 1 0-18M36 47l6-5M26 18v6M32 18v6M38 18v6M44 18v6',
};

/** 기기 심볼 경로 */
export function symbolPath(category: EquipmentCategory, equipmentId: string): string {
  return BY_ID[equipmentId] ?? BY_CATEGORY[category];
}
