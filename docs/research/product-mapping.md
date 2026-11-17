# LS ELECTRIC 제품 → 전력계통 계층 매핑 (초안 v0.1)

> 출처: ls-electric.com/ko 사이트 메뉴 데이터 (`/ko/common/js/site/menu`) 추출, 2026-11-18
> 원본 트리: [lse-product-tree.txt](lse-product-tree.txt)
> 상태 표기: 🟢 보유 · 🟡 일부 보유 · 🔴 **공백 후보 (홈페이지에서 못 찾음, 사용자 확인 필요)** · ⚪ 범위 밖

## L1 초고압 발전·송전 (765/345kV)
| 기기 | 자사 제품 (카테고리 코드) | 상태 |
|---|---|---|
| GIS (초고압) | Power Transmission > GIS (AAA009004) | 🟢 (최고 전압 등급 확인 필요) |
| 전력용 변압기 | Power Transformer (AAA009005) | 🟢 (최고 전압 등급 확인 필요) |
| 변전소 일괄 | Substation (AAA009001) | 🟢 |
| HVDC / FACTS | HVDC (AAA009003), FACTS (AAA009002) | 🟢 |
| 발전기 | — | 🔴 |
| 송전선로/케이블 | — (LS전선은 계열사) | 🔴 / 계열사 |
| 피뢰기 (LA) | — | 🔴 |
| 계기용 변성기 (CT/PT, 단독품) | — (GIS 내장품만) | 🔴 |

## L2 송변전 (154kV)
| 기기 | 자사 제품 | 상태 |
|---|---|---|
| 154kV GIS | GIS (AAA009004) | 🟢 |
| 주변압기 154/22.9kV | Power Transformer | 🟢 |
| 변전소 자동화 | SCADA > SAS (AAA003003) | 🟢 |
| 보호계전 | 디지털 보호계전기 (GIPAM 등) | 🟡 (송전급 계전기 확인 필요) |

## L3 특고압 배전 (22.9kV)
| 기기 | 자사 제품 | 상태 |
|---|---|---|
| 배전용 개폐기 | 부하개폐기 LBS/ASS (P03077), RMU (P03080) | 🟢 |
| 배전 운영 | DMS (AAA004) | 🟢 |
| 한류기 | FCL (AAA010005) | 🟢 |
| 리클로저 | — | 🔴 |
| 주상변압기 | — (유입변압기가 해당되는지 확인) | 🔴 |

## L4 수전설비 (22.9kV 수용가)
| 기기 | 자사 제품 | 상태 |
|---|---|---|
| 특고압 수배전반 | MCSG, 특고압 일반배전반, C-GIS, C-AIS, DAIS | 🟢 |
| LBS / ASS | Load Break Switch / Auto Section Switch | 🟢 |
| 전력퓨즈 (PF) | 한류형 전력퓨즈 (AAA015004) | 🟢 |
| 진공차단기 (VCB) | Susol VCB, 발전소용 VCB 외 | 🟢 |
| 고압 전자접촉기 / VI | VC (AAA015002), VI (AAA015003) | 🟢 |
| 자동부하전환개폐기 | ALTS (AAA015006) | 🟢 |
| 디지털 보호계전기 | XGIPAM, GIPAM3000/2200DG/1000/115FI/10, DPR1000 | 🟢 |
| 계량기 | Digital Electricity Meter, SDC-500 | 🟢 |
| 피뢰기 (LA) | — | 🔴 |
| 계기용 변성기 (MOF, CT/PT) | — | 🔴 |

## L5 변압 (22.9kV → 380/220V)
| 기기 | 자사 제품 | 상태 |
|---|---|---|
| 몰드변압기 | Cast Resin Transformer (P01110) | 🟢 |
| 유입변압기 | Oil-immersed Transformer (P01109) | 🟢 |
| 변압기 진단 | CARE > Smart Diagnosis | 🟢 |

## L6 저압 배전 (380/220V)
| 기기 | 자사 제품 | 상태 |
|---|---|---|
| 저압 배전반 / MCC | Susol LV SWGR, Solution 2000, GCC, Smart MCC, MDB, Power Center | 🟢 |
| 버스웨이 | Susol Busway, GH-P, Mini Busway, NSPB | 🟢 |
| ACB | Susol / Compact / UL / Metasol ACB | 🟢 |
| MCCB | Smart / Susol / UL / Metasol MCCB | 🟢 |
| SPD | BK, SP, USP, USPV, USPE, USPB, USPC | 🟢 |
| 계측 | GIMAC-V/IV/PQ/II Plus/1000/DC/B, IMD | 🟢 |
| 순간전압보상 | Sag Protector (AAA014009) | 🟢 |
| 무정전 전원 | APS (AAA010006) | 🟡 (UPS 대체 여부 확인) |
| 진상콘덴서 / 역률제어 (APFC) | — | 🔴 |
| 저압 ATS | — | 🔴 |
| 비상발전기 | — | 🔴 |

## L7 분전반 및 하단
| 기기 | 자사 제품 | 상태 |
|---|---|---|
| 분전반용 차단기 / ELCB | 분전반용 차단기 (P01024), 분전반용 ELCB (P01028), Metasol ELCB | 🟢 |
| MCB / RCBO / 회로보호기 | L-Series MCB, L-Series RCBO, BK63H/HU, CP | 🟢 |
| 전자개폐기 (MC+OLR) | Metasol MS, Susol MS, Mini MS | 🟢 |
| 모터보호 | MMS (AAA014006), EMPR: GMP, DMPi, IMP, MMP, IMC-III | 🟢 |
| 소프트스타터 | LVSS, Motorsol | 🟢 |
| 인버터 (저압·고압) | S300, G100, S100, H100, M100, iS7 외 / M1000 | 🟢 |
| PLC / HMI / 서보 | XGT, XGB, XGR, XGS / XGT Panel, InfoU / L7, iX7 외 | 🟢 |
| 분기 계측 / DAU / 센서 | 스마트 기기 (AAA018) | 🟢 |
| EV 충전기 | 급속·완속 충전기 (AAA007) | 🟢 |
| 분전반 함체 | — (차단기만 있음) | 🔴 확인 |
| 범용 유도전동기 | — (서보·리니어·DD 모터만 있음) | 🟡 |
| 조명 / 콘센트 | — | ⚪ |

## 연계 · 공통 (사용자 확인: 보유)
| 구분 | 자사 제품 |
|---|---|
| 신재생·저장 | PV System (AAA012), ESS (AAA013), Micro Grid (AAA006) |
| DC 배전 | DC ACB·MCCB·MC·MCB·SPD·Relay (AAA017) |
| 모듈형 변전 | E-House, MGS, CSS (AAA011) |
| 철도 전력 | Railway AC/DC System (AAA019) |
| 감시·운영 | EMS, SCADA(ECMS/PQMS/SAS), DMS, xEMS(BEMS/FEMS), CARE(Smart MV/LV, AMS), AMRS |

## 공백 후보 요약 (사용자 확인 필요)
발전기 · 송전선로 · 피뢰기(LA) · CT/PT/MOF · 리클로저 · 주상변압기 · 진상콘덴서/APFC · 저압 ATS · 비상발전기 · 분전반 함체 · 범용 유도전동기
> 홈페이지에 없다고 실제로 미보유라는 뜻은 아님 (계열사 제품, 비공개, 수주형 제품일 수 있음). 그래서 상태에 "계열사 보유"를 따로 둘지 결정이 필요함.
