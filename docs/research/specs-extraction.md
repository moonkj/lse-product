# 카탈로그 정격 사양 추출 대조표 (specs.json)

추출일: 2026-11-18 · 담당: 데이터 · 상태: **미검수 (reviewed: false)**

- 출처: docs.json에 등록된 LS ELECTRIC 공개 카탈로그 PDF만 사용. 페이지 번호는 **PDF 페이지 번호**(인쇄 쪽번호와 다를 수 있음: GIPAM115, GIMAC-V).
- 규칙: 카탈로그에 적힌 값만 표기 그대로 옮김(범위는 `~`). 계산·추정 없음. 범위 값은 같은 표의 최소~최대를 이어 쓴 것.
- 다운로드: 요청 44건(UA `LSE-ProductMap/0.1`, 간격 1.3초, 40MB 초과 파일은 받지 않고 중단). PDF는 저장소 밖(scratchpad)에만 저장.
- 텍스트 추출: PyMuPDF(별도 venv). Susol MC는 이미지형 PDF라 페이지 이미지를 사람 눈으로 판독.
- 2026-11-18 T2 PDF 대조(docs/reviews/compare-debug-report.md M7·데이터 대조표) 결과 반영: 출처 문서 35/35·페이지 범위 229/229 정상, 표본 대조 일치 6건, 인용 페이지 불일치 9건 정정, Susol MC(P01261) 7항목은 텍스트로 확인 불가.
- 범위 값의 최소·최대가 두 페이지 표에 걸친 경우 item.page는 표가 시작되는 페이지, 해당 제품 note에 "항목: p.N~M 표에 걸침"으로 기록.

## 사람 검수 우선 (판단 필요)

1. **P02212 GIPAM1000 통신** — 정격표(p12) "RS-485 : Modbus" vs 특징(p3) "MODBUS, DNP, IEC61850". T2 대조: 값은 p12와 일치. 어느 쪽을 사양으로 볼지 판단 필요.
2. **P00206 Susol ACB / P01021 Susol MCCB — 변형 카탈로그** — 표준 카탈로그가 40MB 초과라 각각 1150Vac판·1000Vac(UTV)판 값을 사용. T2 대조: 값 일치. 표준 제품 사양으로 노출해도 되는지 판단 필요.
3. **P01084 GIMAC-V — APFC 표** — p6 자동역률 제어장치(APFC) 정격표 값. T2 대조: 값 일치. GIMAC-V 본품(집중표시장치) 정격으로 써도 되는지 확인 필요.

## 요약

| 제품ID | 제품명 | 기기 | 카탈로그 | 대표 페이지 | 항목 수 | 검수 상태 |
|---|---|---|---|---|---|---|
| P00206 | Susol ACB | 기중차단기 | [Susol ACB] up to 1150Vac | 12 | 6 | T2 대조 일치 · 변형 카탈로그 판단 필요 |
| P01021 | Susol MCCB | 배선용차단기 | [Susol MCCB] Up to 1000Vac | 2 | 7 | 페이지 정정(정격전류 p.2~3) · 변형 카탈로그 판단 필요 |
| P01900 | Smart MCCB | 배선용차단기 | [Smart LV Solution] | 56 | 8 | 자동 대조 통과(숫자·출처) · 미검수 |
| P01024 | 분전반용 차단기 | 배선용차단기, 분전반용 차단기 | [분전반] 산업용 배선_누전 차단기 | 14 | 7 | 자동 대조 통과(숫자·출처) · 미검수 |
| P01027 | Metasol ELCB | 누전차단기 | [Metasol ELCB] A Type | 2 | 7 | 자동 대조 통과(숫자·출처) · 미검수 |
| P01028 | 분전반용 ELCB | 누전차단기 | [분전반] 산업용 배선_누전 차단기 | 18 | 8 | 자동 대조 통과(숫자·출처) · 미검수 |
| P01062 | Susol VCB | 진공차단기 | [Susol VCB]_VL type 기반 전동인입출형 | 3 | 6 | T2 대조 일치(VL type 카탈로그) |
| P01065 | 발전소용 VCB | 진공차단기 | 발전소용 VCB | 4 | 6 | 자동 대조 통과(숫자·출처) · 미검수 |
| P01064 | 원자력 발전소용 VCB | 진공차단기 | [Susol VCB] 원전용 | 14 | 6 | 자동 대조 통과(숫자·출처) · 미검수 |
| P03080 | 고압가스 부하개폐기 (RMU) | 배전용 가스절연 부하개폐기 | [RMU] | 10 | 7 | 자동 대조 통과(숫자·출처) · 미검수 |
| P01110 | Cast Resin Transformer | 몰드변압기 | 몰드변압기 | 14 | 7 | 페이지 정정(절연 → "F종" p14로 수정) |
| P01109 | Oil-immersed Transformer | 유입변압기 | 유입변압기(초고압+배전) | 4 | 7 | T2 대조 일치 |
| P01072 | XGIPAM | 송전용 보호계전 시스템, 디지털 보호계전기 | [XGIPAM] | 13 | 8 | 자동 대조 통과(숫자·출처) · 미검수 |
| P01249 | GIPAM3000 | 송전용 보호계전 시스템, 디지털 보호계전기 | [GIPAM3000] | 14 | 7 | 자동 대조 통과(숫자·출처) · 미검수 |
| P02212 | GIPAM1000 | 송전용 보호계전 시스템, 디지털 보호계전기 | [GIPAM1000] 국문 카타로그 | 12 | 7 | T2 대조 일치 · 사람 판단 필요(통신) |
| P01075 | GIPAM115FI | 송전용 보호계전 시스템, 디지털 보호계전기 | [GIPAM115] | 5 | 7 | 자동 대조 통과(숫자·출처) · 미검수 |
| P01084 | GIMAC-V | 디지털 계측기 | [GIMAC-V] | 6 | 7 | T2 대조 일치 · APFC 표 판단 필요 |
| P01079 | GIMAC-IV | 디지털 계측기 | [GIMA-IV] | 10 | 7 | 자동 대조 통과(숫자·출처) · 미검수 |
| P01255 | GIMAC1000 | 디지털 계측기 | [GIMAC1000] | 5 | 7 | 자동 대조 통과(숫자·출처) · 미검수 |
| P02213 | Digital Electricity Meter | 전력량계 | [AMR] 전력량계&원격검침시스템 | 10 | 7 | 자동 대조 통과(숫자·출처) · 미검수 |
| P03082 | USP Series(Din Type) | 서지보호기 | [UL SPD]UL SPD 카달로그_국문 | 33 | 7 | 자동 대조 통과(숫자·출처) · 미검수 |
| P03083 | USPV Series(Din Type) | 서지보호기 | [UL SPD]UL SPD 카달로그_국문 | 39 | 7 | 자동 대조 통과(숫자·출처) · 미검수 |
| P03084 | USPE Series(Panel Type) | 서지보호기 | [UL SPD]UL SPD 카달로그_국문 | 42 | 6 | 자동 대조 통과(숫자·출처) · 미검수 |
| P01260 | Metasol MS | 전자개폐기 (MC+열동계전기) | [Metasol MS] | 10 | 6 | 페이지 정정(프레임·과부하·규격) |
| P01261 | Susol MS | 전자개폐기 (MC+열동계전기) | [Susol MC] | 14 | 7 | 텍스트 확인 불가(이미지 PDF, 7항목 사람 판독값) |
| P01043 | Mini MS | 전자개폐기 (MC+열동계전기) | [Mini MS] | 10 | 6 | 자동 대조 통과(숫자·출처) · 미검수 |
| P01053 | GMP | 전자식 모터보호 계전기 | [GMP] | 4 | 3 | 자동 대조 통과(숫자·출처) · 미검수 |
| P01054 | DMPi | 전자식 모터보호 계전기 | [DMPi] | 9 | 5 | 자동 대조 통과(숫자·출처) · 미검수 |
| P01056 | MMP | 전자식 모터보호 계전기 | [MMP] | 17 | 5 | 자동 대조 통과(숫자·출처) · 미검수 |
| P02210 | LVSS Soft Starter | 소프트 스타터 | [LV Soft Stater] | 6 | 7 | 자동 대조 통과 · 통신 "(표준)/(옵션)" 주석 표기 |
| P01045 | Motorsol Soft Starter | 소프트 스타터 | [Soft Starter] | 8 | 6 | 페이지 정정(전동기·전류) · 냉각 요약 표기 |
| P01188 | iS7 | 저압 인버터 | iS7 카탈로그 | 13 | 7 | T2 대조 일치(IP) · 페이지 정정(전동기) · 통신 요약 표기 |
| P01184 | S100 | 저압 인버터 | S100 카탈로그 | 16 | 6 | 자동 대조 통과(숫자·출처) · 미검수 |
| P01247 | G100/G100C | 저압 인버터 | G100(C) 카탈로그 | 11 | 7 | 자동 대조 통과(숫자·출처) · 미검수 |
| P01183 | H100 | 저압 인버터 | H100 카탈로그 | 12 | 5 | 페이지 정정(전동기) |

## 제품별 항목

### P00206 Susol ACB

- 기기: 기중차단기
- 카탈로그: [[Susol ACB] up to 1150Vac](https://www.ls-electric.com/ko/cat/%5BSusol_ACB%5D_up_to_1150Vac_KO_C060C1-03-202501.pdf) · 대표 p.12
- 비고: 고전압(최대 1150Vac) 사양 카탈로그 기준. 표준 Susol ACB 카탈로그는 40MB 초과로 미확인
- 검수 상태: T2 대조 일치 · 변형 카탈로그 판단 필요

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | ~1150 | Vac | 12 |
| frame | 프레임 | 630~6300 | AF | 4 |
| poles | 극수 | 3 / 4 | P | 12 |
| breakingCapacity | 정격차단전류 | 최대 85 (900Vac) / 65 (1150Vac) | kA | 5 |
| mounting | 설치·인출 방식 | 고정형 / 인출형 |  | 12 |
| standards | 적용 규격 | IEC 60947-2 |  | 12 |

### P01021 Susol MCCB

- 기기: 배선용차단기
- 카탈로그: [[Susol MCCB] Up to 1000Vac](https://www.ls-electric.com/ko/cat/%5BSusol_MCCB%5D_Up_to_1000Vac_KO_C010O1-05-202610.pdf) · 대표 p.2
- 비고: 1000Vac급 UTV 시리즈(UTV250·UTV400) 카탈로그 기준. 표준 Susol MCCB 카탈로그는 40MB 초과로 미확인. 정격전류: p.2~3 표에 걸침
- 검수 상태: 페이지 정정(정격전류 p.2~3) · 변형 카탈로그 판단 필요

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 690 / 800 / 1000 | V AC | 2 |
| frame | 프레임 | 250 / 400 | AF | 4 |
| ratedCurrent | 정격전류 | 60~400 | A | 2 |
| poles | 극수 | 3 / 4 | P | 2 |
| breakingCapacity | 정격차단전류 | 15~30 (1000 V AC, IEC Icu) | kA | 2 |
| protection | 보호 기능 | FTU / FMU / ATU 트립장치 |  | 2 |
| standards | 적용 규격 | UL 489, IEC 60947-2 |  | 2 |

### P01900 Smart MCCB

- 기기: 배선용차단기
- 카탈로그: [[Smart LV Solution]](https://www.ls-electric.com/ko/cat/%5BSmart_LV_Solution%5D_KO_C800R1-06-202604.pdf) · 대표 p.56
- 비고: Susol Smart MCCB(TS100~TS800) 정격표 기준. 정격전압은 TS100/160 표 값
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| frame | 프레임 | 100~800 | AF | 54 |
| ratedCurrent | 정격전류 | 40~800 | A | 55 |
| poles | 극수 | 3, 4 | P | 54 |
| ratedVoltage | 정격전압 | 690 (Ue) | V AC | 56 |
| breakingCapacity | 정격차단전류 | 50~150 (380/415V, Ni/Hi/Li) | kA | 54 |
| protection | 보호 기능 | LSIG (장한시, 단한시, 순시, 지락) |  | 49 |
| communication | 통신 | RS485, 모바일통신(ETLi) |  | 49 |
| mounting | 설치·인출 방식 | 고정형 / plug-in |  | 56 |

### P01024 분전반용 차단기

- 기기: 배선용차단기, 분전반용 차단기
- 카탈로그: [[분전반] 산업용 배선_누전 차단기](https://www.ls-electric.com/ko/cat/%5B%EB%B6%84%EC%A0%84%EB%B0%98%5D_%EC%82%B0%EC%97%85%EC%9A%A9_%EB%B0%B0%EC%84%A0_%EB%88%84%EC%A0%84_%EC%B0%A8%EB%8B%A8%EA%B8%B0_KO_C830A1-19-202607.pdf) · 대표 p.14
- 비고: 분전반용 배선용차단기 ABE30Fb/50Fb/100Fb(경제형) 기준 — 라인업 중 대표 1개 시리즈
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| frame | 프레임 | 30 / 50 / 100 | AF | 14 |
| poles | 극수 | 2, 3 | P | 14 |
| ratedCurrent | 정격전류 | 3~100 | A | 14 |
| ratedVoltage | 정격전압 | AC 220 / 460 | V | 14 |
| breakingCapacity | 정격차단전류 | 1.5~2.5 (460V) / 2.5~5 (220V) | kA | 14 |
| mounting | 설치·인출 방식 | 나사 및 DIN rail 부착 겸용 |  | 14 |
| standards | 적용 규격 | KS C 8321, IEC 60947-2 |  | 14 |

### P01027 Metasol ELCB

- 기기: 누전차단기
- 카탈로그: [[Metasol ELCB] A Type](https://www.ls-electric.com/ko/cat/%5BMetasol_ELCB%5D_A_Type_KO_C02021-02-202202.pdf) · 대표 p.2
- 비고: A Type(맥동 DC 누설전류 검출) 누전차단기 리플렛 기준
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| frame | 프레임 | 30~400 | AF | 3 |
| ratedCurrent | 정격전류 | 5~400 | A | 3 |
| poles | 극수 | 3, 4 | P | 2 |
| sensitivity | 정격감도전류 | 0.03/0.1/0.3/0.5 (또는 0.1/0.2/0.5/1) | A | 2 |
| leakageType | 누전동작 타입 | A |  | 2 |
| protection | 보호 기능 | 누전·과부하·단락보호겸용 |  | 2 |
| standards | 적용 규격 | KS C 4613, IEC 60947-2 |  | 2 |

### P01028 분전반용 ELCB

- 기기: 누전차단기
- 카탈로그: [[분전반] 산업용 배선_누전 차단기](https://www.ls-electric.com/ko/cat/%5B%EB%B6%84%EC%A0%84%EB%B0%98%5D_%EC%82%B0%EC%97%85%EC%9A%A9_%EB%B0%B0%EC%84%A0_%EB%88%84%EC%A0%84_%EC%B0%A8%EB%8B%A8%EA%B8%B0_KO_C830A1-19-202607.pdf) · 대표 p.18
- 비고: 분전반용 누전차단기 EBE30Fb/50Fb/100Fb(경제형) 기준 — 라인업 중 대표 1개 시리즈
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| frame | 프레임 | 30 / 50 / 100 | AF | 18 |
| poles | 극수 | 2, 3 | P | 18 |
| ratedCurrent | 정격전류 | 3~100 | A | 18 |
| sensitivity | 정격감도전류 | 15, 30, 50, 100 (프레임·극수별) | mA | 18 |
| ratedVoltage | 정격전압 | AC 110/220 (2극), 220/380 (3극) | V | 18 |
| breakingCapacity | 정격차단전류 | 2.5~5 (220V) | kA | 18 |
| protection | 보호 기능 | 누전, 과부하, 순시 및 단락전류 |  | 18 |
| standards | 적용 규격 | KS C 4613, IEC 60947-2 |  | 18 |

### P01062 Susol VCB

- 기기: 진공차단기
- 카탈로그: [[Susol VCB]_VL type 기반 전동인입출형](https://www.ls-electric.com/ko/cat/%5BSusol_VCB%5D_%EC%A0%84%EB%8F%99%EC%9D%B8%EC%9E%85%EC%B6%9C%ED%98%95_KO_C050M1-06-202507.pdf) · 대표 p.3
- 비고: VL type 전동인출형 카탈로그 기준. Susol VCB 종합 카탈로그는 40MB 초과로 미확인
- 검수 상태: T2 대조 일치(VL type 카탈로그)

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 7.2 / 12 / 17.5 / 24 / 25.8 | kV | 3 |
| ratedCurrent | 정격전류 | 630 / 1250 / 2000 / 2500 | A | 3 |
| breakingCapacity | 정격차단전류 | 12.5~31.5 | kA | 3 |
| frequency | 정격주파수 | 50 / 60 | Hz | 3 |
| mounting | 설치·인출 방식 | H형 (전동인출형) |  | 3 |
| standards | 적용 규격 | IEC 62271-100:2012 |  | 3 |

### P01065 발전소용 VCB

- 기기: 진공차단기
- 카탈로그: [발전소용 VCB](https://www.ls-electric.com/ko/cat/%5B%EB%B0%9C%EC%A0%84%EC%86%8C%EC%9A%A9_VCB%5D_KO_C050I1-02-202311.pdf) · 대표 p.4
- 비고: LVB-06G 시리즈 정격표 기준
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 7.2 | kV | 4 |
| ratedCurrent | 정격전류 | 1200~3150 | A | 4 |
| breakingCapacity | 정격차단전류 | 40 / 50 | kA | 4 |
| frequency | 정격주파수 | 60 | Hz | 4 |
| mounting | 설치·인출 방식 | 인출형 (G형) |  | 4 |
| standards | 적용 규격 | ES150, IEC 62271-100 |  | 4 |

### P01064 원자력 발전소용 VCB

- 기기: 진공차단기
- 카탈로그: [[Susol VCB] 원전용](https://www.ls-electric.com/ko/cat/%5BSusol_VCB%5D_%EC%9B%90%EC%A0%84%EC%9A%A9_KO_C05041-01-202307.pdf) · 대표 p.14
- 비고: VH-05/15 (원전용) 정격표 기준
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 4.76 / 15 | kV | 14 |
| ratedCurrent | 정격전류 | 1250 / 2000 / 3150 | A | 14 |
| breakingCapacity | 정격차단전류 | 40, 50 | kA | 14 |
| frequency | 정격주파수 | 50/60 | Hz | 14 |
| mounting | 설치·인출 방식 | 인출형 (H type) |  | 14 |
| standards | 적용 규격 | ANSI/IEEE Std. C37.09 |  | 14 |

### P03080 고압가스 부하개폐기 (RMU)

- 기기: 배전용 가스절연 부하개폐기
- 카탈로그: [[RMU]](https://www.ls-electric.com/ko/cat/%5BRMU%5D_KO_C09001-07-202310.pdf) · 대표 p.10
- 비고: Susol RMU 정격표 기준
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 12 / 17.5 / 24 / 36 | kV | 10 |
| ratedCurrent | 정격전류 | 630 (Busbar) | A | 10 |
| shortTimeCurrent | 정격 단시간 전류 | 21 (12~24kV) / 20 (36kV), 3s | kA | 10 |
| frequency | 정격주파수 | 50 / 60 | Hz | 10 |
| insulation | 절연·냉각 방식 | SF6 가스절연 |  | 2 |
| ipRating | 보호등급(IP) | IP 3X (전면), IP 67 (SF6 Tank) |  | 10 |
| standards | 적용 규격 | IEC 62271-1, -100, -102, -103, -105, -200 |  | 10 |

### P01110 Cast Resin Transformer

- 기기: 몰드변압기
- 카탈로그: [몰드변압기](https://www.ls-electric.com/ko/cat/%5BCast_Resin_Transformer%5D_Premium_type_KO_C84001-9-202601.pdf) · 대표 p.14
- 비고: 표준사양표 기준. 주문 제작 시 ~36kV, ~30MVA
- 검수 상태: 페이지 정정(절연 → "F종" p14로 수정)

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 22.9 / 6.6 / 3.3 (1차, 표준사양) | kV | 14 |
| capacity | 정격용량 | 100~10000 (표준사양) | kVA | 14 |
| phases | 상 및 선식 | 3상 / 단상 |  | 14 |
| frequency | 정격주파수 | 60 | Hz | 14 |
| insulation | 절연·냉각 방식 | F종 |  | 14 |
| mounting | 설치·인출 방식 | 옥내 (옥외는 옥외용 외함 필요) |  | 14 |
| standards | 적용 규격 | KS C 4311 |  | 14 |

### P01109 Oil-immersed Transformer

- 기기: 유입변압기
- 카탈로그: [유입변압기(초고압+배전)](https://www.ls-electric.com/ko/cat/%5BOil-immersed_Transformer%5D_KO_C84021-06-202504.pdf) · 대표 p.4
- 비고: 전력용 유입변압기 사양표 기준(p4). 배전용 표준 용량은 p7
- 검수 상태: T2 대조 일치

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | Up to 550 | kV | 4 |
| capacity | 정격용량 | Up to 800 (3상) / Up to 500 (단상) | MVA | 4 |
| distributionCapacity | 배전용 표준 용량 | 500~3000 | kVA | 7 |
| frequency | 정격주파수 | 50/60 | Hz | 4 |
| insulation | 절연·냉각 방식 | Oil Type, ONAN / ONAN/ONAF / OFAF / ODAF |  | 4 |
| mounting | 설치·인출 방식 | Outdoor / Indoor |  | 4 |
| standards | 적용 규격 | IEC 60076 / ANSI(IEEE) C57 |  | 4 |

### P01072 XGIPAM

- 기기: 송전용 보호계전 시스템, 디지털 보호계전기
- 카탈로그: [[XGIPAM]](https://www.ls-electric.com/ko/cat/%5BXGIPAM%5D_KO_C16091-03-202412.pdf) · 대표 p.13
- 비고: 정격표(p13) 기준. 보호요소는 XGIPAM F(Feeder) 형식 기준
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 100/√3, 110/√3, 120/√3, 190/√3, 100, 110, 120 (PT 입력) | V | 13 |
| ratedCurrent | 정격전류 | 5 (CT 입력) | A | 13 |
| frequency | 정격주파수 | 60, 50 | Hz | 13 |
| protection | 보호 기능 | OCR, OCGR, UVR, OVR, SGR, DGR, OVGR, NSOVR, POR, SYNC, Reclosing 등 |  | 12 |
| communication | 통신 | RS485: Modbus, DNP3.0 / Ethernet: Modbus, DNP3.0, IEC61850 |  | 13 |
| accuracy | 계측 정밀도 | 전압·전류 ±0.2% |  | 12 |
| auxPower | 제어전원 | AC 110V, DC 110~125V |  | 13 |
| standards | 적용 규격 | IEC 60255 시리즈, IEC 61850, KEMC 1120 |  | 13 |

### P01249 GIPAM3000

- 기기: 송전용 보호계전 시스템, 디지털 보호계전기
- 카탈로그: [[GIPAM3000]](https://www.ls-electric.com/ko/cat/%5BGIPAM3000%5D_KO_C16071-10-202605.pdf) · 대표 p.14
- 비고: 정격표(p14) 기준
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 110 (55~125) (PT 입력) | V | 14 |
| ratedCurrent | 정격전류 | 5 (CT 입력) | A | 14 |
| frequency | 정격주파수 | 60, 50 | Hz | 14 |
| protection | 보호 기능 | 2개 모델에 34/13종 보호요소 (OCR, OCGR, UVR, OVR, DPR, DFR 등) |  | 3 |
| communication | 통신 | RS485: Modbus, DNP3.0 / Ethernet: Modbus, DNP3.0, IEC61850 |  | 14 |
| auxPower | 제어전원 | AC/DC110V, DC125V |  | 14 |
| standards | 적용 규격 | KEMC 1120, IEC 60255-26, IEC 61850 |  | 14 |

### P02212 GIPAM1000

- 기기: 송전용 보호계전 시스템, 디지털 보호계전기
- 카탈로그: [[GIPAM1000] 국문 카타로그](https://www.ls-electric.com/ko/cat/%5BGIPAM1000%5D_KO_C160M1-08-202512.pdf) · 대표 p.12
- 비고: 정격표(p12) 통신방식은 RS-485 Modbus만 기재, 특징(p3)에는 MODBUS·DNP·IEC61850 원방 통신 지원으로 기재 — 검수 필요
- 검수 상태: T2 대조 일치 · 사람 판단 필요(통신)

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 110 (55~125) (PT 입력) | V | 12 |
| ratedCurrent | 정격전류 | 5 (CT 입력) | A | 12 |
| frequency | 정격주파수 | 60, 50 | Hz | 12 |
| protection | 보호 기능 | 2개 모델에 12/24종 보호요소 |  | 3 |
| communication | 통신 | RS-485: Modbus |  | 12 |
| auxPower | 제어전원 | AC/DC110V, DC125V |  | 12 |
| standards | 적용 규격 | KEMC 1120 |  | 12 |

### P01075 GIPAM115FI

- 기기: 송전용 보호계전 시스템, 디지털 보호계전기
- 카탈로그: [[GIPAM115]](https://www.ls-electric.com/ko/cat/%5BGIPAM115%5D_KO_C160E1-01-202304.pdf) · 대표 p.5
- 비고: GIPAM115FI 정격표 기준 (카탈로그 인쇄 쪽번호 119, PDF 5쪽)
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 110 or 100 (PT 입력, 선택) | V | 5 |
| ratedCurrent | 정격전류 | 5 (CT 입력) | A | 5 |
| frequency | 정격주파수 | 60, 50 | Hz | 5 |
| wiring | 결선방식 | 1P2W, 1P3W, 3P3W, 3P4W |  | 5 |
| protection | 보호 기능 | 7종 보호요소 |  | 3 |
| communication | 통신 | RS485: Modbus |  | 5 |
| standards | 적용 규격 | IEC60255, KEMC 1120, IEC61000 |  | 5 |

### P01084 GIMAC-V

- 기기: 디지털 계측기
- 카탈로그: [[GIMAC-V]](https://www.ls-electric.com/ko/cat/%5BGIMAC-V%5D_KO_C160H1-01-202304.pdf) · 대표 p.6
- 비고: 자동역률 제어장치(APFC) 제품정격표 기준 (카탈로그 인쇄 쪽번호 147, PDF 6쪽)
- 검수 상태: T2 대조 일치 · APFC 표 판단 필요

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 10 ~ 452 (상전압) | V | 6 |
| ratedCurrent | 정격전류 | 0.05 ~ 6 | A | 6 |
| frequency | 정격주파수 | 60, 50 | Hz | 6 |
| wiring | 결선방식 | 1P2W, 1P3W, 3P3W(Y), 3P3W(OPEN-DELTA), 3P4W |  | 6 |
| communication | 통신 | MODBUS-RTU(RS485) 2Ports, MODBUS-TCP 1Port |  | 6 |
| auxPower | 제어전원 | AC/DC 110V ±20% |  | 6 |
| standards | 적용 규격 | IEC60255, IEC61326, IEC61000-4, KEMC 1110 |  | 6 |

### P01079 GIMAC-IV

- 기기: 디지털 계측기
- 카탈로그: [[GIMA-IV]](https://www.ls-electric.com/ko/cat/%5BGIMAC-IV%5D_KO_C160I1-02-202406.pdf) · 대표 p.10
- 비고: 정격표(p10) 기준
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 10~230 (PT 입력) | V | 10 |
| ratedCurrent | 정격전류 | 0.05~6 (CT 입력) | A | 10 |
| frequency | 정격주파수 | 60, 50 | Hz | 10 |
| wiring | 결선방식 | 1P2W, 1P3W, 3P3W, 3P4W |  | 10 |
| communication | 통신 | RS485: Modbus, DNP3.0 |  | 10 |
| auxPower | 제어전원 | AC/DC 110V, 220V |  | 10 |
| standards | 적용 규격 | IEC60255, IEC61000-4, KEMC 1110 |  | 10 |

### P01255 GIMAC1000

- 기기: 디지털 계측기
- 카탈로그: [[GIMAC1000]](https://www.ls-electric.com/ko/cat/%5BGIMAC1000%5D_KO_C16081-06-202412.pdf) · 대표 p.5
- 비고: 정격표(p5) 기준
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | AC20~452 (PT 입력) | V | 5 |
| ratedCurrent | 정격전류 | 0.05~6 (5A), 0.01~1.2 (1A) | A | 5 |
| frequency | 정격주파수 | 60, 50 | Hz | 5 |
| accuracy | 계측 정밀도 | 전압·전류 ±0.3%, 전력·전력량 Class0.5 |  | 3 |
| communication | 통신 | RS485: Modbus / Ethernet: Modbus |  | 5 |
| auxPower | 제어전원 | AC/DC 100~240V ±10% (Free Voltage) |  | 5 |
| standards | 적용 규격 | IEC60255, IEC61000-4 |  | 5 |

### P02213 Digital Electricity Meter

- 기기: 전력량계
- 카탈로그: [[AMR] 전력량계&원격검침시스템](https://www.ls-electric.com/ko/cat/Electric_Meter_Reading_System_KO_C11551-04-202611.pdf) · 대표 p.10
- 비고: LD 단독계기(회전형) 정격표 기준
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | AC 220 (단상 2선) / AC 220/380 (3상 4선) | V | 10 |
| ratedCurrent | 정격전류 | 40(10), 80(20), 120(30) | A | 10 |
| frequency | 정격주파수 | 60 | Hz | 10 |
| accuracy | 계측 정밀도 | 1.0 급 |  | 10 |
| phases | 상 및 선식 | 단상 2선식 / 3상 4선식 (단독계기) |  | 10 |
| mounting | 설치·인출 방식 | 회전형 (표시부 좌/우 90도 회전) |  | 10 |
| ipRating | 보호등급(IP) | IP51 |  | 8 |

### P03082 USP Series(Din Type)

- 기기: 서지보호기
- 카탈로그: [[UL SPD]UL SPD 카달로그_국문](https://www.ls-electric.com/ko/cat/%5BSPD%5D_KO_C01551-07-202510.pdf) · 대표 p.33
- 비고: USP Series (AC/Din Type) 제품정격 기준
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 120~600 (Un) | V | 33 |
| mcov | 최대연속동작전압(Uc) | 150~690 | Vac | 33 |
| poles | 극수 | 1P, 2P, 3P, 4P, 1P+N, 3P+N |  | 33 |
| nominalDischarge | 공칭방전전류(In) | 20 | kA | 33 |
| maxDischarge | 최대방전전류(Imax) | 50 / 40 | kA | 33 |
| sccr | 단락전류정격(SCCR) | 200 | kA | 33 |
| standards | 적용 규격 | ANSI/UL1449 5th Type 1ca, IEC/EN 61643-11 Class II |  | 33 |

### P03083 USPV Series(Din Type)

- 기기: 서지보호기
- 카탈로그: [[UL SPD]UL SPD 카달로그_국문](https://www.ls-electric.com/ko/cat/%5BSPD%5D_KO_C01551-07-202510.pdf) · 대표 p.39
- 비고: USPV Series (DC/Din Type) 제품정격 기준
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 48~1500 (DC, Un) | V | 39 |
| poles | 극수 | 1P, 2P, 3P, 5P |  | 39 |
| nominalDischarge | 공칭방전전류(In) | 20 | kA | 39 |
| maxDischarge | 최대방전전류(Imax) | 50 | kA | 39 |
| sccr | 단락전류정격(SCCR) | 최대 100 | kA | 39 |
| ipRating | 보호등급(IP) | IP20 |  | 39 |
| standards | 적용 규격 | ANSI/UL1449 5th Type 1ca, IEC/EN 61643-11 Class II/Type 2 |  | 39 |

### P03084 USPE Series(Panel Type)

- 기기: 서지보호기
- 카탈로그: [[UL SPD]UL SPD 카달로그_국문](https://www.ls-electric.com/ko/cat/%5BSPD%5D_KO_C01551-07-202510.pdf) · 대표 p.42
- 비고: USPE Series (Panel Type) 제품정격 기준
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| mcov | 최대연속동작전압(Uc) | 150, 320, 420, 550, 690 | V | 42 |
| nominalDischarge | 공칭방전전류(In) | 10 | kA | 42 |
| maxDischarge | 최대방전전류(Imax) | 25 / 50 (8/20μs) | kA | 42 |
| sccr | 단락전류정격(SCCR) | 200 | kA | 42 |
| frequency | 정격주파수 | 47~63 | Hz | 42 |
| standards | 적용 규격 | ANSI/UL1449 5th, CSA C22.2 (Type1 SPD) |  | 42 |

### P01260 Metasol MS

- 기기: 전자개폐기 (MC+열동계전기)
- 카탈로그: [[Metasol MS]](https://www.ls-electric.com/ko/cat/%5BMetasol_MS%5D_KO_C04001-37-202609.pdf) · 대표 p.10
- 비고: 기종일람표(p10~13) 기준. 3극형 MC + MT 열동형 과부하계전기. 프레임: p.10~13 표에 걸침. 과부하계전기 전류설정범위: p.10~13 표에 걸침. 적용 규격: IEC 60947은 p.10, UL 508은 p.3(목차)
- 검수 상태: 페이지 정정(프레임·과부하·규격)

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| frame | 프레임 | 18~2650 | AF | 10 |
| ratedVoltage | 정격전압 | 690 (18·22AF) / 1000 (40AF 이상) (Ue) | V | 10 |
| frequency | 정격주파수 | 50/60 | Hz | 10 |
| poles | 극수 | 3 | P | 10 |
| olrRange | 과부하계전기 전류설정범위 | 0.1~800 | A | 10 |
| standards | 적용 규격 | IEC 60947, UL 508 |  | 10 |

### P01261 Susol MS

- 기기: 전자개폐기 (MC+열동계전기)
- 카탈로그: [[Susol MC]](https://www.ls-electric.com/ko/cat/%5BSusol_MC%5D_KO_C04071-07-202005.pdf) · 대표 p.14
- 비고: 이미지형 PDF(텍스트 없음) — 기종일람표(p14~15) 페이지 이미지를 판독
- 검수 상태: 텍스트 확인 불가(이미지 PDF, 7항목 사람 판독값)

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| frame | 프레임 | 32 / 63 / 95 | AF | 14 |
| ratedVoltage | 정격전압 | 1000 (Ue) | V | 14 |
| frequency | 정격주파수 | 50/60 | Hz | 14 |
| poles | 극수 | 3 | P | 14 |
| motorPower | 적용 전동기 용량 | 4~45 (AC-3, 380/440V) | kW | 15 |
| ratedCurrent | 정격전류 | 9~95 (AC-3, 380/440V) | A | 15 |
| olrRange | 과부하계전기 전류설정범위 | 0.1~95 | A | 15 |

### P01043 Mini MS

- 기기: 전자개폐기 (MC+열동계전기)
- 카탈로그: [[Mini MS]](https://www.ls-electric.com/ko/cat/%5BMini_MS%5D_KO_C04061-03-202609.pdf) · 대표 p.10
- 비고: 기종일람표(p10) 및 특징(p4~5) 기준
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| frame | 프레임 | 6 / 9 | A | 10 |
| motorPower | 적용 전동기 용량 | 7.5 이하 | kW | 4 |
| insulationVoltage | 정격절연전압 | 690 | V | 10 |
| ratedCurrent | 정격전류 | 20 (AC1급 연속통전전류) | A | 10 |
| mounting | 설치·인출 방식 | 나사, DIN rail 취부 겸용 (35mm) |  | 10 |
| standards | 적용 규격 | IEC 60947-4-1, IEC 60947-5-1, IEC 60947-1, K 60947, UL 508 |  | 5 |

### P01053 GMP

- 기기: 전자식 모터보호 계전기
- 카탈로그: [[GMP]](https://www.ls-electric.com/ko/cat/%5BGMP%5D_KO_C15041-07-202409.pdf) · 대표 p.4
- 비고: 표준기종일람표(p4) 기준
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedCurrent | 정격전류 | 0.3~80 (전류 설정범위, 모델별) | A | 4 |
| protection | 보호 기능 | 과전류, 구속, 결상, 불평형, 역상, 저전류, 지락 (모델별) |  | 4 |
| mounting | 설치·인출 방식 | 직결형(Pin) / 단자형(Screw) / 관통형(Tunnel) |  | 4 |

### P01054 DMPi

- 기기: 전자식 모터보호 계전기
- 카탈로그: [[DMPi]](https://www.ls-electric.com/ko/cat/%5BDMPi%5D_KO_C15021-06-202504.pdf) · 대표 p.9
- 비고: 정격 및 형명체계(p9) 기준
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedCurrent | 정격전류 | 0.5~6 / 5~65 (주문 시 선택) | A | 9 |
| protection | 보호 기능 | 과전류, 구속, 결상, 불평형, 역상, 부족전류, 지락(선택), 순시단락(선택) |  | 9 |
| communication | 통신 | RS485 Modbus, 4~20mA (형명 선택) |  | 9 |
| auxPower | 제어전원 | AC/DC 85~260V, AC/DC 24V |  | 9 |
| mounting | 설치·인출 방식 | 관통형/단자형, 35mm DIN rail/나사, 표시창 분리 설치 가능 |  | 9 |

### P01056 MMP

- 기기: 전자식 모터보호 계전기
- 카탈로그: [[MMP]](https://www.ls-electric.com/ko/cat/%5BMMP%5D_KO_C15011-11-202409.pdf) · 대표 p.17
- 비고: 정격 및 형명체계(p17) 기준
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedCurrent | 정격전류 | 0.5~10 / 5~100 (주문 시 선택) | A | 17 |
| protection | 보호 기능 | 과전류, 구속(Stall/Locked), 결상/불평형 등 |  | 7 |
| communication | 통신 | MODBUS TCP/IP, MODBUS RS485 |  | 17 |
| auxPower | 제어전원 | AC 110V, AC 220V 50/60Hz |  | 17 |
| accuracy | 계측 정밀도 | 전류·전압 ±1% 또는 최소정격의 ±2% |  | 17 |

### P02210 LVSS Soft Starter

- 기기: 소프트 스타터
- 카탈로그: [[LV Soft Stater]](https://www.ls-electric.com/ko/cat/%5BLV_Soft_Stater%5D_KO_C040C1-01-202203.pdf) · 대표 p.6
- 비고: 선택 가이드(p6)·Specifications(p7) 기준
- 검수 상태: 자동 대조 통과 · 통신 "(표준)/(옵션)" 주석 표기

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 200~480 | V | 6 |
| frequency | 정격주파수 | 50/60 | Hz | 6 |
| ratedCurrent | 정격전류 | 17~1080 | A | 6 |
| motorPower | 적용 전동기 용량 | 7.5~630 (400V, Trip Class 10) | kW | 6 |
| bypass | 바이패스 | Internally Bypassed |  | 7 |
| communication | 통신 | Modbus RTU (표준) / Ethernet IP, Modbus TCP, Profibus DP (Anybus 옵션) |  | 7 |
| standards | 적용 규격 | IEC 60947-4-2: 2012, CE, CETL, KC |  | 7 |

### P01045 Motorsol Soft Starter

- 기기: 소프트 스타터
- 카탈로그: [[Soft Starter]](https://www.ls-electric.com/ko/cat/%5BSoft_Starter%5D_KO_C01581-07-201803.pdf) · 대표 p.8
- 비고: LSFS 단방향(S) 기종일람표(p8~9) 기준. 적용 전동기 용량: p.8~9 표에 걸침. 정격전류: p.8~9 표에 걸침
- 검수 상태: 페이지 정정(전동기·전류) · 냉각 요약 표기

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 220 / 380 / 440 | V | 8 |
| motorPower | 적용 전동기 용량 | 2.2~600 | kW | 8 |
| ratedCurrent | 정격전류 | 7.5~1200 | A | 8 |
| frequency | 정격주파수 | 50 / 60 | Hz | 8 |
| insulation | 절연·냉각 방식 | 방열판 자연냉각 및 방열판+Fan 강제냉각 |  | 8 |
| standards | 적용 규격 | EN 61131-2, EN 50178 |  | 8 |

### P01188 iS7

- 기기: 저압 인버터
- 카탈로그: [iS7 카탈로그](https://ssqfd-abhdhraad3gkgbcg.a03.azurefd.net/prod/largefile/document/16957054248320/iS7_Catalog_KR_202309.pdf) · 대표 p.13
- 비고: 기본규격(p13~15) 기준. 적용 전동기는 중부하(CT) 기준(경부하 VT 기준 400V급은 450kW까지). 적용 전동기 용량: p.13~14 표에 걸침
- 검수 상태: T2 대조 일치(IP) · 페이지 정정(전동기) · 통신 요약 표기

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 3상 200~230 / 3상 380~480 | VAC | 13 |
| motorPower | 적용 전동기 용량 | 0.75~75 (200V급) / 0.75~375 (400V급), 중부하(CT) | kW | 13 |
| frequency | 정격주파수 | 입력 50~60 (±5%) / 출력 0~400 | Hz | 13 |
| protection | 보호 기능 | 과전류, 과전압, 저전압, 지락 전류 검출, 과열, 입출력 결상, 과부하 등 |  | 15 |
| insulation | 절연·냉각 방식 | 강제 풍냉 |  | 15 |
| ipRating | 보호등급(IP) | IP 21 (75kW 이하), IP 00 (200V 30~75kW·90kW 이상), IP 54 (22kW 이하 별도제품) |  | 15 |
| communication | 통신 | 옵션: Profibus DP, DeviceNet, CANopen, Ethernet IP/Modbus-TCP, PROFInet 등 |  | 7 |

### P01184 S100

- 기기: 저압 인버터
- 카탈로그: [S100 카탈로그](https://ssqfd-abhdhraad3gkgbcg.a03.azurefd.net/prod/largefile/document/17070989202140/S100_Catalog_KR_202402.pdf) · 대표 p.16
- 비고: 기본규격(p16)·Line-up(p95) 기준. 적용 전동기는 중부하 기준
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 1상 200~240 / 3상 200~240 / 3상 380~480 | V | 12 |
| motorPower | 적용 전동기 용량 | 1Ø 200V: 0.4~2.2 / 3Ø 200V: 0.4~15 / 3Ø 400V: 0.4~75 | kW | 95 |
| frequency | 정격주파수 | 입력 50~60 (±5%) | Hz | 14 |
| protection | 보호 기능 | 과전류, 과전압, 저전압, 입력·출력 결상, 지락, 인버터·모터 과부하 등 트립 |  | 16 |
| ipRating | 보호등급(IP) | IP20/UL Open (기본), UL Enclosed Type 1·IP66/NEMA 4X (옵션) |  | 16 |
| communication | 통신 | 내장 RS485 / Field Bus: Ethernet IP, Modbus TCP, CANopen, EtherCAT, PROFInet |  | 6 |

### P01247 G100/G100C

- 기기: 저압 인버터
- 카탈로그: [G100(C) 카탈로그](https://ssq.ls-electric.com/uploads/document/17531425436680/G100%20Series_Catalog_KR_202506.pdf) · 대표 p.11
- 비고: 기본 규격(p11~12) 기준. G100C는 0.4~4kW
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 3상 200~240 / 3상 380~480 | VAC | 11 |
| motorPower | 적용 전동기 용량 | 0.4~22 (중부하) | kW | 11 |
| frequency | 정격주파수 | 입력 50~60 (±5%) / 출력 0~400 | Hz | 11 |
| protection | 보호 기능 | 과전류, 암 단락, 과열, 입력 결상, 지락, 모터 과열 등 트립 |  | 12 |
| ipRating | 보호등급(IP) | IP 20, UL Open Type |  | 12 |
| communication | 통신 | RAPIEnet+ (RAPIEnet, EtherNet/IP, Modbus TCP) |  | 3 |
| standards | 적용 규격 | UL 61800-5-1, EN 61508 SIL2 |  | 3 |

### P01183 H100

- 기기: 저압 인버터
- 카탈로그: [H100 카탈로그](https://ssq.ls-electric.com/uploads/document/17936100709070/H100_KO_C55041-31-202611.pdf) · 대표 p.12
- 비고: 입·출력 규격(p12~13) 기준. 팬·펌프(HVAC) 전용. 적용 전동기 용량: p.12~13 표에 걸침
- 검수 상태: 페이지 정정(전동기)

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 3상 200~240 / 3상 380~480 / 3상 380~500 (110kW 이상) | VAC | 12 |
| motorPower | 적용 전동기 용량 | 0.75~18.5 (200V급) / 0.75~750 (400V급) | kW | 12 |
| frequency | 정격주파수 | 입력 50~60 (±5%) / 출력 0~400 | Hz | 12 |
| communication | 통신 | 내장(RS-485): BACnet, Modbus-RTU, Metasys N2 / 옵션: LonWorks, BACnet/IP, EtherNet/IP, Modbus TCP 등 |  | 5 |
| ipRating | 보호등급(IP) | IP 20 (0.75~185kW), IP00 (220~500kW) |  | 14 |

## 추출 실패·건너뛴 제품

| 제품ID | 제품명 | 기기 | 사유 |
|---|---|---|---|
| P02206 | Susol Compact ACB | 기중차단기 | 전용 카탈로그 40MB 초과. 1150Vac 카탈로그 p15에 "Compact ACB up to 800Vac" 정격이 있으나 고전압 변형이라 표준 제품 사양으로 쓰지 않음 |
| P01030 | Metasol ACB | 기중차단기 | 카탈로그 40MB 초과 |
| P02207 | Susol UL ACB | 기중차단기 | 시간 관계상 미시도(영문 카탈로그) |
| P01023 | Metasol MCCB | 배선용차단기 | 카탈로그 40MB 초과 |
| P01022 | Susol UL MCCB | 배선용차단기 | 미시도 |
| P02216 | Susol UL VCB | 진공차단기 | 카탈로그(UL VCB, 영문) 40MB 초과 |
| P03078 | UL Load Interrupter Switch | 부하개폐기 | 카탈로그(Susol LIS, 영문) 40MB 초과 |
| P03077 | Load Break Switch / Auto Section Switch | 부하개폐기 | docs.json에 문서 없음 |
| — | 고압 전자접촉기(VC)·전력퓨즈(PF)·ALTS 단독 제품·MMS·MCB/RCBO·고압 인버터·GIS·주변압기 | 각 기기 | products.json에 해당 카테고리 제품이 없거나 docs.json에 카탈로그/데이터시트 없음 (ALTS·LBS 카탈로그는 RMU(P03080) 문서로만 등록) |
| P01055 IMP, P01077 DPR1000, GIMAC-PQ/II Plus/DC/B 등 | — | 각 기기 | 기기당 2~3개 비교 목표를 채워 우선순위에서 제외 |
| P03085 USPB, P03086 USPC | 서지보호기 | 같은 카탈로그에 형명별 결선표만 있고 시리즈 정격표가 텍스트로 명확히 분리되지 않아 제외 |

## 신뢰도가 낮은 값 (10건, 위 '사람 검수 우선' 3건 포함)

1. **P02212 GIPAM1000 통신**: 정격표(p12)와 특징(p3) 불일치 — 정격표 값 사용. (사람 검수 우선)
2. **P00206 Susol ACB**: 1150Vac 고전압판 값(차단전류 85/65kA는 G-Frame 최대). (사람 검수 우선)
3. **P01021 Susol MCCB**: 1000Vac UTV 시리즈 값. (사람 검수 우선)
4. **P01062 Susol VCB**: VL type 전동인출형 카탈로그 값. T2 대조로 p3 숫자 모두 확인됨.
5. **P01261 Susol MC**: 이미지 판독값(텍스트 레이어 없음, T2 텍스트 대조 불가).
6. **P01260 Metasol MS**: 적용 전동기 용량은 대형 프레임 표 열 정렬이 불확실해 넣지 않음. 페이지 정정 완료.
7. **P01024 / P01028 분전반용**: ABE/EBE Fb 경제형 1개 시리즈만 대표값으로 사용.
8. **P01084 GIMAC-V**: APFC 정격표 값. (사람 검수 우선)
9. **P01109 유입변압기**: 전력용·배전용 값 혼재(항목 분리). T2 대조 일치.
10. **P01188 iS7**: IP 등급 요약 — T2 대조로 원문과 일치 확인. 전동기 용량은 중부하(CT) 기준(VT 기준 400V급 450kW)으로 값에 명시.

## 2026-11-18 정정 내역 (T2 대조 M7 반영)

| 제품 | 항목 | 변경 |
|---|---|---|
| P01021 | 정격전류 60~400 | page 2 유지, note에 "정격전류: p.2~3 표에 걸침" |
| P01260 | 프레임 18~2650 | page 13 → 10, note "p.10~13 표에 걸침" |
| P01260 | 과부하계전기 전류설정범위 0.1~800 | page 13 → 10, note "p.10~13 표에 걸침" |
| P01260 | 적용 규격 IEC 60947, UL 508 | page 3 → 10, note "IEC 60947은 p.10, UL 508은 p.3(목차)" |
| P01045 | 적용 전동기 용량 2.2~600 | page 9 → 8, note "p.8~9 표에 걸침" |
| P01045 | 정격전류 7.5~1200 | page 9 → 8, note "p.8~9 표에 걸침" |
| P01188 | 적용 전동기 용량 | page 14 → 13, 값에 "중부하(CT)" 추가, note "p.13~14 표에 걸침" |
| P01183 | 적용 전동기 용량 | page 13 → 12, note "p.12~13 표에 걸침" |
| P01110 | 절연·냉각 방식 | "F종 (Epoxy Resin 몰드)" → "F종" (p14 정격표 표기 그대로) |
