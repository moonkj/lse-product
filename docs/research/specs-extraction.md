# 카탈로그 정격 사양 추출 대조표 (specs.json)

추출일: 2026-11-18 · 담당: 데이터 · 상태: **미검수 (reviewed: false)**

- 출처: docs.json에 등록된 LS ELECTRIC 공개 카탈로그 PDF만 사용. 페이지 번호는 **PDF 페이지 번호**(인쇄 쪽번호와 다를 수 있음: GIPAM115, GIMAC-V).
- 규칙: 카탈로그에 적힌 값만 표기 그대로 옮김(범위는 `~`). 계산·추정 없음. 범위 값은 같은 표의 최소~최대를 이어 쓴 것.
- 다운로드: 전체 파일 요청 44건 + HTTP Range 요청 455건·HEAD 8건(아래 Range 메모)(UA `LSE-ProductMap/0.1`, 간격 1.3초, 40MB 초과 파일은 받지 않고 중단). PDF는 저장소 밖(scratchpad)에만 저장.
- 텍스트 추출: PyMuPDF(별도 venv). Susol MC는 이미지형 PDF라 페이지 이미지를 사람 눈으로 판독.
- 2026-11-18 T2 PDF 대조(docs/reviews/compare-debug-report.md M7·데이터 대조표) 결과 반영: 출처 문서 35/35·페이지 범위 229/229 정상, 표본 대조 일치 6건, 인용 페이지 불일치 9건 정정, Susol MC(P01261) 7항목은 텍스트로 확인 불가.
- 범위 값의 최소·최대가 두 페이지 표에 걸친 경우 item.page는 표가 시작되는 페이지, 해당 제품 note에 "항목: p.N~M 표에 걸침"으로 기록.
- **2026-11-18 옵션 구조 재구성**: 카탈로그 정격표가 프레임·전압 등급·모델·용량 단계 등 옵션별로 값을 나눈 제품은 `variants`(옵션별 사양)로 분리. 옵션과 관계없이 같은 값은 `items`(공통). 범위로 뭉쳐 두었던 값(예: 630~6300AF)은 옵션별 값으로 쪼갬. 옵션이 많으면 대표 옵션만 넣고 note에 "대표 옵션만" 기록. 31개 제품 · 옵션 122개 · 공통 항목 164 · 옵션 항목 375.

## 사람 검수 우선 (판단 필요)

1. **P02212 GIPAM1000 통신** — 정격표(p12) "RS-485 : Modbus" vs 통신기능(p11) "RS-485: DNP3.0 SERIAL, MODBUS-RTU / Ethernet: DNP3.0 TCP, MODBUS-TCP, IEC61850". 옵션 재구성 때 p11 값으로 교체 — 정격표와 다르므로 최종 판단 필요.
2. **P02206 Susol Compact ACB AN형 차단용량** — p5 그림은 42kA/690Vac, 본문은 "Cat.B(AH, AN형) 50kA/690Vac". 그림 값을 넣음. (Susol ACB·MCCB·VCB 변형 카탈로그 문제는 2026-11-18 표준 카탈로그로 교체해 해소)
3. **옵션 열 구분을 텍스트 순서로 읽은 값** — P02216 Susol UL VCB 전압별 Isc(차트), P01023 Metasol MCCB 100AF·125AF(한 표 열 공유), P01065 발전소용 VCB 모델별 정격전류, P01027 Metasol ELCB 125AF 정격전류(줄바꿈된 셀), P01260 Metasol MS 각 프레임 Ue 매핑. 원문 표와 열 대조 필요.
4. **P01084 GIMAC-V — APFC 표** — p6 자동역률 제어장치(APFC) 정격표 값. T2 대조: 값 일치. GIMAC-V 본품(집중표시장치) 정격으로 써도 되는지 확인 필요.

## 요약

| 제품ID | 제품명 | 기기 | 카탈로그 | 대표 페이지 | 항목 수 | 검수 상태 |
|---|---|---|---|---|---|---|
| P00206 | Susol ACB | 기중차단기 | [Susol ACB] | 18 | 7 | 프레임 · 3 | 표준 카탈로그로 교체(Range) · 미검수 |
| P01021 | Susol MCCB | 배선용차단기 | [Susol MCCB] | 6 | 3 | 시리즈·프레임 · 5 | 표준 카탈로그로 교체(Range) · 미검수 |
| P01900 | Smart MCCB | 배선용차단기 | [Smart LV Solution] | 56 | 5 | 프레임 · 6 | 자동 대조 통과(숫자·출처) · 미검수 |
| P01024 | 분전반용 차단기 | 배선용차단기, 분전반용 차단기 | [분전반] 산업용 배선_누전 차단기 | 14 | 4 | 프레임 · 3 | 자동 대조 통과(숫자·출처) · 미검수 |
| P01027 | Metasol ELCB | 누전차단기 | [Metasol ELCB] A Type | 2 | 5 | 프레임 · 7 | 자동 대조 통과 · 125AF 정격전류 검수 필요 |
| P01028 | 분전반용 ELCB | 누전차단기 | [분전반] 산업용 배선_누전 차단기 | 18 | 4 | 프레임 · 3 | 자동 대조 통과(숫자·출처) · 미검수 |
| P01062 | Susol VCB | 진공차단기 | [Susol VCB] | 5 | 1 | 정격전압 · 6 | 표준 카탈로그로 교체(Range) · 미검수 |
| P01065 | 발전소용 VCB | 진공차단기 | 발전소용 VCB | 4 | 4 | 모델 · 3 | 자동 대조 통과 · 모델별 열 구분 검수 필요 |
| P01064 | 원자력 발전소용 VCB | 진공차단기 | [Susol VCB] 원전용 | 14 | 4 | 정격전압 등급 · 2 | 자동 대조 통과(숫자·출처) · 미검수 |
| P03080 | 고압가스 부하개폐기 (RMU) | 배전용 가스절연 부하개폐기 | [RMU] | 10 | 5 | 정격전압 · 4 | 자동 대조 통과(숫자·출처) · 미검수 |
| P01110 | Cast Resin Transformer | 몰드변압기 | 몰드변압기 | 14 | 6 | 용량 (3P 22.9kV/6.6kV DD) · 5 | 페이지 정정(절연 → "F종" p14로 수정) |
| P01109 | Oil-immersed Transformer | 유입변압기 | 유입변압기(초고압+배전) | 4 | 6 | 배전용 용량 (3ph 60Hz 22.9kV/저압, 표준소비효율) · 4 | T2 대조 일치 |
| P01072 | XGIPAM | 송전용 보호계전 시스템, 디지털 보호계전기 | [XGIPAM] | 13 | 7 | 형식 · 6 | 자동 대조 통과(숫자·출처) · 미검수 |
| P01249 | GIPAM3000 | 송전용 보호계전 시스템, 디지털 보호계전기 | [GIPAM3000] | 14 | 6 | 형식 · 2 | 자동 대조 통과(숫자·출처) · 미검수 |
| P02212 | GIPAM1000 | 송전용 보호계전 시스템, 디지털 보호계전기 | [GIPAM1000] 국문 카타로그 | 12 | 6 | 형식 · 2 | 통신 값 p11로 교체 · 사람 판단 필요(통신) |
| P01075 | GIPAM115FI | 송전용 보호계전 시스템, 디지털 보호계전기 | [GIPAM115] | 5 | 7 | - | 자동 대조 통과(숫자·출처) · 미검수 |
| P01084 | GIMAC-V | 디지털 계측기 | [GIMAC-V] | 6 | 7 | - | T2 대조 일치 · APFC 표 판단 필요 |
| P01079 | GIMAC-IV | 디지털 계측기 | [GIMA-IV] | 10 | 7 | - | 자동 대조 통과(숫자·출처) · 미검수 |
| P01255 | GIMAC1000 | 디지털 계측기 | [GIMAC1000] | 5 | 7 | - | 자동 대조 통과(숫자·출처) · 미검수 |
| P02213 | Digital Electricity Meter | 전력량계 | [AMR] 전력량계&원격검침시스템 | 10 | 5 | 상 및 선식 · 2 | 자동 대조 통과(숫자·출처) · 미검수 |
| P03082 | USP Series(Din Type) | 서지보호기 | [UL SPD]UL SPD 카달로그_국문 | 33 | 5 | 모델 · 8 | 자동 대조 통과(숫자·출처) · 미검수 |
| P03083 | USPV Series(Din Type) | 서지보호기 | [UL SPD]UL SPD 카달로그_국문 | 39 | 5 | 모델 · 7 | 자동 대조 통과(숫자·출처) · 미검수 |
| P03084 | USPE Series(Panel Type) | 서지보호기 | [UL SPD]UL SPD 카달로그_국문 | 42 | 5 | Surge Capacity · 2 | 자동 대조 통과(숫자·출처) · 미검수 |
| P01260 | Metasol MS | 전자개폐기 (MC+열동계전기) | [Metasol MS] | 10 | 3 | 프레임 · 8 | 페이지 정정 반영(옵션별 페이지·규격 p10) · 옵션 Ue 매핑 검수 필요 |
| P01261 | Susol MS | 전자개폐기 (MC+열동계전기) | [Susol MC] | 14 | 3 | 프레임 · 3 | 텍스트 확인 불가(이미지 PDF, 7항목 사람 판독값) |
| P01043 | Mini MS | 전자개폐기 (MC+열동계전기) | [Mini MS] | 10 | 4 | 프레임 · 2 | 자동 대조 통과(숫자·출처) · 미검수 |
| P01053 | GMP | 전자식 모터보호 계전기 | [GMP] | 4 | 1 | 모델 · 6 | 자동 대조 통과(숫자·출처) · 미검수 |
| P01054 | DMPi | 전자식 모터보호 계전기 | [DMPi] | 9 | 4 | 정격전류 · 2 | 자동 대조 통과(숫자·출처) · 미검수 |
| P01056 | MMP | 전자식 모터보호 계전기 | [MMP] | 17 | 4 | 정격전류 · 2 | 자동 대조 통과(숫자·출처) · 미검수 |
| P02210 | LVSS Soft Starter | 소프트 스타터 | [LV Soft Stater] | 6 | 5 | 용량 (Trip Class 10 선정 모델) · 4 | 자동 대조 통과 · 통신 "(표준)/(옵션)" 주석 표기 |
| P01045 | Motorsol Soft Starter | 소프트 스타터 | [Soft Starter] | 8 | 4 | 용량 · 4 | 페이지 정정 반영(옵션별 p8·p9) · 냉각 요약 표기 |
| P01188 | iS7 | 저압 인버터 | iS7 카탈로그 | 13 | 5 | 전압·용량 등급 · 4 | T2 대조 일치(IP) · 페이지 정정 반영(옵션별 p13·p14) · 통신 요약 표기 |
| P01184 | S100 | 저압 인버터 | S100 카탈로그 | 16 | 4 | 입력 전압 · 3 | 자동 대조 통과(숫자·출처) · 미검수 |
| P01247 | G100/G100C | 저압 인버터 | G100(C) 카탈로그 | 11 | 5 | 입력 전압 · 2 | 자동 대조 통과(숫자·출처) · 미검수 |
| P01183 | H100 | 저압 인버터 | H100 카탈로그 | 12 | 3 | 전압·용량 등급 · 4 | 페이지 정정 반영(옵션별 p12·p13) |
| P01023 | Metasol MCCB | 배선용차단기 | [Metasol MCCB] | 22 | 4 | 프레임 · 8 | 신규(Range) · 100/125AF 열 공유 검수 필요 |
| P01030 | Metasol ACB | 기중차단기 | [Metasol ACB] | 4 | 2 | 형식·프레임 · 6 | 신규(Range) · 미검수 |
| P02206 | Susol Compact ACB | 기중차단기 | [Susol Compact ACB] | 5 | 1 | 형식 · 4 | 신규(Range) · AN형 차단용량 검수 필요 |
| P03078 | UL Load Interrupter Switch | 부하개폐기 / 자동고장구분개폐기 | [Susol LIS]Load Interrupter Switch | 4 | 5 | 정격전압 · 2 | 신규(Range) · 27/38kV급 미수록 |
| P02216 | Susol UL VCB | 진공차단기 | UL VCB | 10 | 2 | 정격전압 · 4 | 신규(Range) · 차트 판독 검수 필요 |

## 제품별 항목 (공통 + 옵션별)

### P00206 Susol ACB

- 기기: 기중차단기
- 카탈로그: [[Susol ACB]](https://www.ls-electric.com/ko/cat/%5BSusol_ACB%5D_KO_C06061-23-202511.pdf) · 대표 p.18
- 비고: 표준 [Susol ACB] 카탈로그 정격표(p18~19) 기준 (HTTP Range로 필요한 페이지만 받아 추출). 이전 값은 고전압판 [Susol ACB] up to 1150Vac 카탈로그(AV ~1150Vac·AW ~900Vac 프레임)였음 — 그 카탈로그는 별도 문서로 docs.json에 있음
- 검수 상태: 표준 카탈로그로 교체(Range) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 690 (Ue) | V | 18 |
| insulationVoltage | 정격절연전압 | 1000 | V | 18 |
| frequency | 정격주파수 | 50/60 | Hz | 18 |
| poles | 극수 | 3/4 | P | 18 |
| impulseVoltage | 정격임펄스내전압 | 12 | kV | 18 |
| mounting | 설치·인출 방식 | 고정형 / 인출형 |  | 18 |
| standards | 적용 규격 | IEC 60947-2, KS C 4620 |  | 18 |

옵션 기준: **프레임** (3개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| ah-d | AH-D (AH-06D~20D) (p.18) | frame | 프레임 | 630~2000 | AF | 18 |
|  |  | ratedCurrent | 정격전류 | 200~2000 (In max) | A | 18 |
|  |  | breakingCapacity | 정격차단전류 | 65 (690/600/550V) / 85 (500/480/460V) / 85 (415~220V) | kA | 18 |
|  |  | shortTimeCurrent | 정격 단시간 전류 | 65 (1초) / 60 (2초) / 50 (3초) | kA | 18 |
| ah-e | AH-E (AH-06E~40E) (p.19) | frame | 프레임 | 630~4000 | AF | 19 |
|  |  | ratedCurrent | 정격전류 | 200~4000 (In max) | A | 19 |
|  |  | breakingCapacity | 정격차단전류 | 85 (690/600/550V) / 100 (500/480/460V) / 100 (415~220V) | kA | 19 |
|  |  | shortTimeCurrent | 정격 단시간 전류 | 85 (1초) / 75 (2초) / 65 (3초) | kA | 19 |
| ah-g | AH-G (AH-40G~63G) (p.19) | frame | 프레임 | 4000~6300 | AF | 19 |
|  |  | ratedCurrent | 정격전류 | 2000~6300 (In max) | A | 19 |
|  |  | breakingCapacity | 정격차단전류 | 100 (690/600/550V) / 150 (500/480/460V) / 150 (415~220V) | kA | 19 |
|  |  | shortTimeCurrent | 정격 단시간 전류 | 100 (1초) / 85 (2초) / 75 (3초) | kA | 19 |

### P01021 Susol MCCB

- 기기: 배선용차단기
- 카탈로그: [[Susol MCCB]](https://www.ls-electric.com/ko/cat/%5BSusol_MCCB%5D_KO_C01091-24-202509.pdf) · 대표 p.6
- 비고: 표준 [Susol MCCB] 카탈로그 개요(p5~7) 기준 (HTTP Range로 필요한 페이지만 받아 추출). 차단용량은 Ics=100% Icu, 415Vac 기준(p6). 정격사용전압·극수는 정격표 페이지를 받지 않아 미기재. 이전 값은 [Susol MCCB] Up to 1000Vac 카탈로그(UTV250/400)였음
- 검수 상태: 표준 카탈로그로 교체(Range) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| frame | 프레임 | 160/250/630/800/1600AF (5 Frame) |  | 5 |
| protection | 보호 기능 | FTU / FMU / ATU (열동전자식), ETS / ETM (전자식), MTU (전동기보호용), DSU (개폐기) |  | 8 |
| communication | 통신 | RS485 (MODBUS) |  | 10 |

옵션 기준: **시리즈·프레임** (5개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| td100-160 | TD100/160 (p.6) | ratedCurrent | 정격전류 | 16~160 | A | 6 |
|  |  | breakingCapacity | 정격차단전류 | 50 / 85 / 150 (415Vac, N/H/L) | kA | 6 |
| ts100-250 | TS100/160/250 (p.6) | ratedCurrent | 정격전류 | 40~250 | A | 6 |
|  |  | breakingCapacity | 정격차단전류 | 50 / 85 / 150 (415Vac, N/H/L) | kA | 6 |
| ts400-630 | TS400/630 (p.7) | ratedCurrent | 정격전류 | 300~630 | A | 7 |
|  |  | breakingCapacity | 정격차단전류 | 65 / 85 / 150 (415Vac, N/H/L) | kA | 7 |
| ts800 | TS800 (p.7) | ratedCurrent | 정격전류 | 700, 800 | A | 7 |
|  |  | breakingCapacity | 정격차단전류 | 65 / 100 / 150 (415Vac, N/H/L) | kA | 7 |
| ts1600 | TS1600 (p.7) | ratedCurrent | 정격전류 | 1000, 1250, 1600 | A | 7 |
|  |  | breakingCapacity | 정격차단전류 | 50 / 70 / 150 (415Vac, N/H/L) | kA | 7 |

### P01900 Smart MCCB

- 기기: 배선용차단기
- 카탈로그: [[Smart LV Solution]](https://www.ls-electric.com/ko/cat/%5BSmart_LV_Solution%5D_KO_C800R1-06-202604.pdf) · 대표 p.56
- 비고: Susol Smart MCCB(TS100~TS800) 정격표 기준. 정격전압 690V(Ue)는 TS100/160 표(p56) 값
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| poles | 극수 | 3, 4 | P | 54 |
| ratedVoltage | 정격전압 | 690 (Ue) | V AC | 56 |
| protection | 보호 기능 | LSIG (장한시, 단한시, 순시, 지락) |  | 49 |
| communication | 통신 | RS485, 모바일통신(ETLi) |  | 49 |
| mounting | 설치·인출 방식 | 고정형 / plug-in |  | 56 |

옵션 기준: **프레임** (6개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| ts100 | TS100 (100AF) (p.54) | frame | 프레임 | 100 | AF | 54 |
|  |  | ratedCurrent | 정격전류 | 40, 100 | A | 54 |
|  |  | breakingCapacity | 정격차단전류 | 50 / 85 / 150 (380/415V, Ni/Hi/Li) | kA | 54 |
| ts160 | TS160 (160AF) (p.54) | frame | 프레임 | 160 | AF | 54 |
|  |  | ratedCurrent | 정격전류 | 40, 100, 160 | A | 54 |
|  |  | breakingCapacity | 정격차단전류 | 50 / 85 / 150 (380/415V, Ni/Hi/Li) | kA | 54 |
| ts250 | TS250 (250AF) (p.55) | frame | 프레임 | 250 | AF | 55 |
|  |  | ratedCurrent | 정격전류 | 40, 100, 160, 250 | A | 55 |
|  |  | breakingCapacity | 정격차단전류 | 50 / 85 / 150 (380/415V, Ni/Hi/Li) | kA | 55 |
| ts400 | TS400 (400AF) (p.55) | frame | 프레임 | 400 | AF | 55 |
|  |  | ratedCurrent | 정격전류 | 250, 400 | A | 55 |
|  |  | breakingCapacity | 정격차단전류 | 65 / 85 / 150 (380/415V, Ni/Hi/Li) | kA | 55 |
| ts630 | TS630 (630AF) (p.55) | frame | 프레임 | 630 | AF | 55 |
|  |  | ratedCurrent | 정격전류 | 250, 400, 630 | A | 55 |
|  |  | breakingCapacity | 정격차단전류 | 65 / 85 / 150 (380/415V, Ni/Hi/Li) | kA | 55 |
| ts800 | TS800 (800AF) (p.55) | frame | 프레임 | 800 | AF | 55 |
|  |  | ratedCurrent | 정격전류 | 630, 800 | A | 55 |
|  |  | breakingCapacity | 정격차단전류 | 65 / 100 / 150 (380/415V, Ni/Hi/Li) | kA | 55 |

### P01024 분전반용 차단기

- 기기: 배선용차단기, 분전반용 차단기
- 카탈로그: [[분전반] 산업용 배선_누전 차단기](https://www.ls-electric.com/ko/cat/%5B%EB%B6%84%EC%A0%84%EB%B0%98%5D_%EC%82%B0%EC%97%85%EC%9A%A9_%EB%B0%B0%EC%84%A0_%EB%88%84%EC%A0%84_%EC%B0%A8%EB%8B%A8%EA%B8%B0_KO_C830A1-19-202607.pdf) · 대표 p.14
- 비고: 분전반용 배선용차단기 ABE30Fb/50Fb/100Fb(경제형) 기준 — 라인업 중 대표 1개 시리즈
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| poles | 극수 | 2, 3 | P | 14 |
| ratedVoltage | 정격전압 | AC 220 / 460 | V | 14 |
| mounting | 설치·인출 방식 | 나사 및 DIN rail 부착 겸용 |  | 14 |
| standards | 적용 규격 | KS C 8321, IEC 60947-2 |  | 14 |

옵션 기준: **프레임** (3개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| abe30fb | ABE30Fb (30AF) (p.14) | frame | 프레임 | 30 | AF | 14 |
|  |  | ratedCurrent | 정격전류 | 3, 5, 10, 15, 20, 30 | A | 14 |
|  |  | breakingCapacity | 정격차단전류 | 1.5 (460V) / 2.5 (220V) | kA | 14 |
| abe50fb | ABE50Fb (50AF) (p.14) | frame | 프레임 | 50 | AF | 14 |
|  |  | ratedCurrent | 정격전류 | 5, 10, 15, 20, 30, 40, 50 | A | 14 |
|  |  | breakingCapacity | 정격차단전류 | 1.5 (460V) / 2.5 (220V) | kA | 14 |
| abe100fb | ABE100Fb (100AF) (p.14) | frame | 프레임 | 100 | AF | 14 |
|  |  | ratedCurrent | 정격전류 | 60, 75, 100 | A | 14 |
|  |  | breakingCapacity | 정격차단전류 | 2.5 (460V) / 5 (220V) | kA | 14 |

### P01027 Metasol ELCB

- 기기: 누전차단기
- 카탈로그: [[Metasol ELCB] A Type](https://www.ls-electric.com/ko/cat/%5BMetasol_ELCB%5D_A_Type_KO_C02021-02-202202.pdf) · 대표 p.2
- 비고: A Type(맥동 DC 누설전류 검출) 누전차단기 리플렛 기준. 정격차단전류는 30~60AF(p2)만 표 열이 명확해 넣음 — 100AF 이상은 미기재
- 검수 상태: 자동 대조 통과 · 125AF 정격전류 검수 필요

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| poles | 극수 | 3, 4 | P | 2 |
| sensitivity | 정격감도전류 | 0.03/0.1/0.3/0.5 (또는 0.1/0.2/0.5/1) | A | 2 |
| leakageType | 누전동작 타입 | A |  | 2 |
| protection | 보호 기능 | 누전·과부하·단락보호겸용 |  | 2 |
| standards | 적용 규격 | KS C 4613, IEC 60947-2 |  | 2 |

옵션 기준: **프레임** (7개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 30af | 30AF (EBS33c/34c) (p.2) | frame | 프레임 | 30 | AF | 2 |
|  |  | ratedCurrent | 정격전류 | (5, 10), 15, 16, 20, 25, 30 | A | 2 |
|  |  | breakingCapacity | 정격차단전류 | 14(10) (415/460V) / 30(25) (220/250V) | kA | 2 |
| 50af | 50AF (EBN53c·EBS53c·EBH53c) (p.2) | frame | 프레임 | 50 | AF | 2 |
|  |  | ratedCurrent | 정격전류 | 15, 16, 20, 25, 30, 32, 40, 50 | A | 2 |
|  |  | breakingCapacity | 정격차단전류 | 14 / 18 / 50 (415/460V, N/S/H) | kA | 2 |
| 60af | 60AF (EBN63c·EBS63c) (p.2) | frame | 프레임 | 60 | AF | 2 |
|  |  | ratedCurrent | 정격전류 | 60 | A | 2 |
|  |  | breakingCapacity | 정격차단전류 | 14 / 18 (415/460V, N/S) | kA | 2 |
| 100af | 100AF (p.3) | frame | 프레임 | 100 | AF | 3 |
|  |  | ratedCurrent | 정격전류 | 60, 63, 75, 80, 100 | A | 3 |
| 125af | 125AF (p.3) | frame | 프레임 | 125 | AF | 3 |
|  |  | ratedCurrent | 정격전류 | 15, 16, 20, 25, 30, 32, 40, 50, 60, 63, 75, 80, 100, 125 | A | 3 |
| 250af | 250AF (p.3) | frame | 프레임 | 250 | AF | 3 |
|  |  | ratedCurrent | 정격전류 | 100, 125, 150, 160, 175, 200, 225, 250 | A | 3 |
| 400af | 400AF (p.3) | frame | 프레임 | 400 | AF | 3 |
|  |  | ratedCurrent | 정격전류 | 250, 300, 350, 400 | A | 3 |

### P01028 분전반용 ELCB

- 기기: 누전차단기
- 카탈로그: [[분전반] 산업용 배선_누전 차단기](https://www.ls-electric.com/ko/cat/%5B%EB%B6%84%EC%A0%84%EB%B0%98%5D_%EC%82%B0%EC%97%85%EC%9A%A9_%EB%B0%B0%EC%84%A0_%EB%88%84%EC%A0%84_%EC%B0%A8%EB%8B%A8%EA%B8%B0_KO_C830A1-19-202607.pdf) · 대표 p.18
- 비고: 분전반용 누전차단기 EBE30Fb/50Fb/100Fb(경제형) 기준 — 라인업 중 대표 1개 시리즈
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| poles | 극수 | 2, 3 | P | 18 |
| ratedVoltage | 정격전압 | AC 110/220 (2극), 220/380 (3극) | V | 18 |
| protection | 보호 기능 | 누전, 과부하, 순시 및 단락전류 |  | 18 |
| standards | 적용 규격 | KS C 4613, IEC 60947-2 |  | 18 |

옵션 기준: **프레임** (3개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| ebe30fb | EBE30Fb (30AF) (p.18) | frame | 프레임 | 30 | AF | 18 |
|  |  | ratedCurrent | 정격전류 | 3, 5, 10, 15, 20, 30 | A | 18 |
|  |  | sensitivity | 정격감도전류 | 30, *50 (2극) / 15, 30 (3극) | mA | 18 |
|  |  | breakingCapacity | 정격차단전류 | 1.5 (380V, 3극) / 2.5 (220V) | kA | 18 |
| ebe50fb | EBE50Fb (50AF) (p.18) | frame | 프레임 | 50 | AF | 18 |
|  |  | ratedCurrent | 정격전류 | 5, 10, 15, 20, 30, 40, 50 | A | 18 |
|  |  | sensitivity | 정격감도전류 | 30, *50 (2극) / 15, 30 (3극) | mA | 18 |
|  |  | breakingCapacity | 정격차단전류 | 1.5 (380V, 3극) / 2.5 (220V) | kA | 18 |
| ebe100fb | EBE100Fb (100AF) (p.18) | frame | 프레임 | 100 | AF | 18 |
|  |  | ratedCurrent | 정격전류 | 60, 75, 100 | A | 18 |
|  |  | sensitivity | 정격감도전류 | 30, 100 (2, 3극) | mA | 18 |
|  |  | breakingCapacity | 정격차단전류 | 2.5 (380V, 3극) / 5 (220V) | kA | 18 |

### P01062 Susol VCB

- 기기: 진공차단기
- 카탈로그: [[Susol VCB]](https://www.ls-electric.com/ko/cat/%5BSusol_VCB%5D_KO_C05001-26-202609.pdf) · 대표 p.5
- 비고: 표준 [Susol VCB] 종합 카탈로그 라인업 표(p5) 기준 (HTTP Range로 필요한 페이지만 받아 추출). 전압별 차단전류·정격전류는 그 전압에서 제공되는 값 목록(조합별 정격은 카탈로그 정격 페이지 참조). 이전 값은 [Susol VCB]_VL type 기반 전동인입출형 카탈로그(7.2~25.8kV, 12.5~32kA)였음
- 검수 상태: 표준 카탈로그로 교체(Range) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| insulation | 절연·냉각 방식 | 진공 소호 (진공 인터럽터, VI) |  | 2 |

옵션 기준: **정격전압** (6개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 7-2kv | 7.2kV (p.5) | ratedVoltage | 정격전압 | 7.2 | kV | 5 |
|  |  | breakingCapacity | 정격차단전류 | 8/12.5/20/25/31.5/40/50 | kA | 5 |
|  |  | ratedCurrent | 정격전류 | 400/630/1250/2000/3150/4000 | A | 5 |
| 12kv | 12kV (p.5) | ratedVoltage | 정격전압 | 12 | kV | 5 |
|  |  | breakingCapacity | 정격차단전류 | 20/25/31.5/40/50 | kA | 5 |
|  |  | ratedCurrent | 정격전류 | 630/1000/1250/2000/2500/3150/4000/5000 | A | 5 |
| 17-5kv | 17.5kV (p.5) | ratedVoltage | 정격전압 | 17.5 | kV | 5 |
|  |  | breakingCapacity | 정격차단전류 | 20/25/31.5/40/50 | kA | 5 |
|  |  | ratedCurrent | 정격전류 | 630/1000/1250/2000/2500/3150/4000 | A | 5 |
| 24kv | 24kV (p.5) | ratedVoltage | 정격전압 | 24 | kV | 5 |
|  |  | breakingCapacity | 정격차단전류 | 12.5/25/31.5/40 | kA | 5 |
|  |  | ratedCurrent | 정격전류 | 630/1250/2000/2500/3150 | A | 5 |
| 25-8kv | 25.8kV (p.5) | ratedVoltage | 정격전압 | 25.8 | kV | 5 |
|  |  | breakingCapacity | 정격차단전류 | 12.5/16/25/31.5/40 | kA | 5 |
|  |  | ratedCurrent | 정격전류 | 630/1250/2000/3150 | A | 5 |
| 36kv | 36kV (p.5) | ratedVoltage | 정격전압 | 36 | kV | 5 |
|  |  | breakingCapacity | 정격차단전류 | 25/31.5/40 | kA | 5 |
|  |  | ratedCurrent | 정격전류 | 1250/2000/3150 | A | 5 |

### P01065 발전소용 VCB

- 기기: 진공차단기
- 카탈로그: [발전소용 VCB](https://www.ls-electric.com/ko/cat/%5B%EB%B0%9C%EC%A0%84%EC%86%8C%EC%9A%A9_VCB%5D_KO_C050I1-02-202311.pdf) · 대표 p.4
- 비고: LVB-06G 시리즈 정격표(p4) 기준. 모델별 정격전류 열 구분은 텍스트 순서로 읽음 — 검수 필요
- 검수 상태: 자동 대조 통과 · 모델별 열 구분 검수 필요

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 7.2 | kV | 4 |
| frequency | 정격주파수 | 60 | Hz | 4 |
| mounting | 설치·인출 방식 | 인출형 (G형) |  | 4 |
| standards | 적용 규격 | ES150, IEC 62271-100 |  | 4 |

옵션 기준: **모델** (3개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| lvb-06g-40h | LVB-06G-40H (p.4) | ratedCurrent | 정격전류 | 1200 / 2000 / 3000 | A | 4 |
|  |  | breakingCapacity | 정격차단전류 | 40 | kA | 4 |
| lvb-06g-40j | LVB-06G-40J (p.4) | ratedCurrent | 정격전류 | 1250 / 2000 / 2500 / 3150 | A | 4 |
|  |  | breakingCapacity | 정격차단전류 | 40 | kA | 4 |
| lvb-06g-50j | LVB-06G-50J (p.4) | ratedCurrent | 정격전류 | 1250 / 2000 / 3150 | A | 4 |
|  |  | breakingCapacity | 정격차단전류 | 50 | kA | 4 |

### P01064 원자력 발전소용 VCB

- 기기: 진공차단기
- 카탈로그: [[Susol VCB] 원전용](https://www.ls-electric.com/ko/cat/%5BSusol_VCB%5D_%EC%9B%90%EC%A0%84%EC%9A%A9_KO_C05041-01-202307.pdf) · 대표 p.14
- 비고: VH-05/15 (원전용) 정격표 기준
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedCurrent | 정격전류 | 1250 / 2000 / 3150 | A | 14 |
| frequency | 정격주파수 | 50/60 | Hz | 14 |
| mounting | 설치·인출 방식 | 인출형 (H type) |  | 14 |
| standards | 적용 규격 | ANSI/IEEE Std. C37.09 |  | 14 |

옵션 기준: **정격전압 등급** (2개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| vh-05 | VH-05 (4.76kV) (p.14) | ratedVoltage | 정격전압 | 4.76 | kV | 14 |
|  |  | breakingCapacity | 정격차단전류 | 50 | kA | 14 |
|  |  | powerFreqWithstand | 상용주파 내전압 | 19 | kV | 14 |
|  |  | impulseWithstand | 뇌임펄스 내전압 | 60 | kV | 14 |
| vh-15 | VH-15 (15kV) (p.14) | ratedVoltage | 정격전압 | 15 | kV | 14 |
|  |  | breakingCapacity | 정격차단전류 | 40, 50 | kA | 14 |
|  |  | powerFreqWithstand | 상용주파 내전압 | 36 | kV | 14 |
|  |  | impulseWithstand | 뇌임펄스 내전압 | 95 | kV | 14 |

### P03080 고압가스 부하개폐기 (RMU)

- 기기: 배전용 가스절연 부하개폐기
- 카탈로그: [[RMU]](https://www.ls-electric.com/ko/cat/%5BRMU%5D_KO_C09001-07-202310.pdf) · 대표 p.10
- 비고: Susol RMU 정격표 기준
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedCurrent | 정격전류 | 630 (Busbar) | A | 10 |
| frequency | 정격주파수 | 50 / 60 | Hz | 10 |
| insulation | 절연·냉각 방식 | SF6 가스절연 |  | 2 |
| ipRating | 보호등급(IP) | IP 3X (전면), IP 67 (SF6 Tank) |  | 10 |
| standards | 적용 규격 | IEC 62271-1, -100, -102, -103, -105, -200 |  | 10 |

옵션 기준: **정격전압** (4개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 12kv | 12kV (p.10) | ratedVoltage | 정격전압 | 12 | kV | 10 |
|  |  | powerFreqWithstand | 상용주파 내전압 | 28 | kV | 10 |
|  |  | impulseWithstand | 뇌임펄스 내전압 | 75 | kV | 10 |
|  |  | shortTimeCurrent | 정격 단시간 전류 | 21 (3s) | kA | 10 |
| 17-5kv | 17.5kV (p.10) | ratedVoltage | 정격전압 | 17.5 | kV | 10 |
|  |  | powerFreqWithstand | 상용주파 내전압 | 38 | kV | 10 |
|  |  | impulseWithstand | 뇌임펄스 내전압 | 95 | kV | 10 |
|  |  | shortTimeCurrent | 정격 단시간 전류 | 21 (3s) | kA | 10 |
| 24kv | 24kV (p.10) | ratedVoltage | 정격전압 | 24 | kV | 10 |
|  |  | powerFreqWithstand | 상용주파 내전압 | 50 | kV | 10 |
|  |  | impulseWithstand | 뇌임펄스 내전압 | 125 | kV | 10 |
|  |  | shortTimeCurrent | 정격 단시간 전류 | 21 (3s) | kA | 10 |
| 36kv | 36kV (p.10) | ratedVoltage | 정격전압 | 36 | kV | 10 |
|  |  | powerFreqWithstand | 상용주파 내전압 | 70 | kV | 10 |
|  |  | impulseWithstand | 뇌임펄스 내전압 | 170 | kV | 10 |
|  |  | shortTimeCurrent | 정격 단시간 전류 | 20 (3s) | kA | 10 |

### P01110 Cast Resin Transformer

- 기기: 몰드변압기
- 카탈로그: [몰드변압기](https://www.ls-electric.com/ko/cat/%5BCast_Resin_Transformer%5D_Premium_type_KO_C84001-9-202601.pdf) · 대표 p.14
- 비고: 공통 사양은 표준사양표(p14). 옵션은 3P 22.9kV/6.6kV DD 특성표(p17)의 대표 용량만 — 표준사양 용량 범위 100~10000kVA, 주문 제작 ~36kV·~30MVA
- 검수 상태: 페이지 정정(절연 → "F종" p14로 수정)

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 22.9 / 6.6 / 3.3 (1차, 표준사양) | kV | 14 |
| phases | 상 및 선식 | 3상 / 단상 |  | 14 |
| frequency | 정격주파수 | 60 | Hz | 14 |
| insulation | 절연·냉각 방식 | F종 |  | 14 |
| mounting | 설치·인출 방식 | 옥내 (옥외는 옥외용 외함 필요) |  | 14 |
| standards | 적용 규격 | KS C 4311 |  | 14 |

옵션 기준: **용량 (3P 22.9kV/6.6kV DD)** (5개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 500kva | 500kVA (p.17) | capacity | 정격용량 | 500 | kVA | 17 |
|  |  | impedance | 임피던스 | 6.0 | %IZ | 17 |
|  |  | efficiency50 | 효율 (50% 부하) | 99.25 | % | 17 |
|  |  | weight | 중량 | 2,650 | kg | 17 |
| 1000kva | 1000kVA (p.17) | capacity | 정격용량 | 1000 | kVA | 17 |
|  |  | impedance | 임피던스 | 7.0 | %IZ | 17 |
|  |  | efficiency50 | 효율 (50% 부하) | 99.40 | % | 17 |
|  |  | weight | 중량 | 3,900 | kg | 17 |
| 2000kva | 2000kVA (p.17) | capacity | 정격용량 | 2000 | kVA | 17 |
|  |  | impedance | 임피던스 | 8.0 | %IZ | 17 |
|  |  | efficiency50 | 효율 (50% 부하) | 99.50 | % | 17 |
|  |  | weight | 중량 | 6,600 | kg | 17 |
| 5000kva | 5000kVA (p.17) | capacity | 정격용량 | 5000 | kVA | 17 |
|  |  | impedance | 임피던스 | 8.0 | %IZ | 17 |
|  |  | efficiency50 | 효율 (50% 부하) | 99.50 | % | 17 |
|  |  | weight | 중량 | 11,400 | kg | 17 |
| 10000kva | 10000kVA (p.17) | capacity | 정격용량 | 10000 | kVA | 17 |
|  |  | impedance | 임피던스 | 10.0 | %IZ | 17 |
|  |  | efficiency50 | 효율 (50% 부하) | 99.50 | % | 17 |
|  |  | weight | 중량 | 19,850 | kg | 17 |

### P01109 Oil-immersed Transformer

- 기기: 유입변압기
- 카탈로그: [유입변압기(초고압+배전)](https://www.ls-electric.com/ko/cat/%5BOil-immersed_Transformer%5D_KO_C84021-06-202504.pdf) · 대표 p.4
- 비고: 공통 사양은 전력용 유입변압기 사양표(p4, 최대 550kV/800MVA). 옵션은 배전용 표준소비효율 특성표(p7) 22.9kV/저압 — 대표 용량만
- 검수 상태: T2 대조 일치

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | Up to 550 | kV | 4 |
| capacity | 정격용량 | Up to 800 (3상) / Up to 500 (단상) | MVA | 4 |
| frequency | 정격주파수 | 50/60 | Hz | 4 |
| insulation | 절연·냉각 방식 | Oil Type, ONAN / ONAN/ONAF / OFAF / ODAF |  | 4 |
| mounting | 설치·인출 방식 | Outdoor / Indoor |  | 4 |
| standards | 적용 규격 | IEC 60076 / ANSI(IEEE) C57 |  | 4 |

옵션 기준: **배전용 용량 (3ph 60Hz 22.9kV/저압, 표준소비효율)** (4개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 500kva | 500kVA (22.9kV/저압) (p.7) | distributionCapacity | 배전용 표준 용량 | 500 | kVA | 7 |
|  |  | impedance | 임피던스 | 4.5 | % | 7 |
|  |  | efficiency50 | 효율 (50% 부하) | 99.25 | % | 7 |
|  |  | weight | 중량 | 2,020 | kg | 7 |
| 1000kva | 1000kVA (22.9kV/저압) (p.7) | distributionCapacity | 배전용 표준 용량 | 1000 | kVA | 7 |
|  |  | impedance | 임피던스 | 6 | % | 7 |
|  |  | efficiency50 | 효율 (50% 부하) | 99.35 | % | 7 |
|  |  | weight | 중량 | 2,980 | kg | 7 |
| 2000kva | 2000kVA (22.9kV/저압) (p.7) | distributionCapacity | 배전용 표준 용량 | 2000 | kVA | 7 |
|  |  | impedance | 임피던스 | 6 | % | 7 |
|  |  | efficiency50 | 효율 (50% 부하) | 99.45 | % | 7 |
|  |  | weight | 중량 | 5,220 | kg | 7 |
| 3000kva | 3000kVA (22.9kV/저압) (p.7) | distributionCapacity | 배전용 표준 용량 | 3000 | kVA | 7 |
|  |  | impedance | 임피던스 | 7 | % | 7 |
|  |  | efficiency50 | 효율 (50% 부하) | 99.50 | % | 7 |
|  |  | weight | 중량 | 6,950 | kg | 7 |

### P01072 XGIPAM

- 기기: 송전용 보호계전 시스템, 디지털 보호계전기
- 카탈로그: [[XGIPAM]](https://www.ls-electric.com/ko/cat/%5BXGIPAM%5D_KO_C16091-03-202412.pdf) · 대표 p.13
- 비고: 정격표(p13) 기준. 옵션은 형식별 보호요소(p12)
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 100/√3, 110/√3, 120/√3, 190/√3, 100, 110, 120 (PT 입력) | V | 13 |
| ratedCurrent | 정격전류 | 5 (CT 입력) | A | 13 |
| frequency | 정격주파수 | 60, 50 | Hz | 13 |
| communication | 통신 | RS485: Modbus, DNP3.0 / Ethernet: Modbus, DNP3.0, IEC61850 |  | 13 |
| accuracy | 계측 정밀도 | 전압·전류 ±0.2% |  | 12 |
| auxPower | 제어전원 | AC 110V, DC 110~125V |  | 13 |
| standards | 적용 규격 | IEC 60255 시리즈, IEC 61850, KEMC 1120 |  | 13 |

옵션 기준: **형식** (6개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| f | XGIPAM F (Feeder/Incomming) (p.12) | protection | 보호 기능 | OCR(50/51), OCGR(50/51N), UVR(27), OVR(59), SGR(67G), DGR(67N), OVGR(64I/D), NSOVR(47N), POR(47), SYNC Check(25), Reclosing(79), Temperature(38) |  | 12 |
| b | XGIPAM B (Bay Controller) (p.12) | protection | 보호 기능 | OCR(50/51), OCGR(50/51N), UVR(27), OVR(59), SGR(67G), DGR(67N), OVGR(64I/D), NSOVR(47N), POR(47), SYNC Check(25), Reclosing(79), Temperature(38), DOCR(67I/D), NSOCR(46I/D), UFR(81U), OFR(81O), DPR(32P), DQR(32Q) |  | 12 |
| m | XGIPAM M (Motor) (p.12) | protection | 보호 기능 | OCR(50/51), OCGR(50/51N), UVR(27), OVR(59), SGR(67G), DGR(67N), OVGR(64I/D), NSOVR(47N), POR(47), Temperature(38), Stall/Locked Rotor(48/51LR), THR(49), DOCR(67I/D), UCR(37), NCH(66), NSOCR(46I/D) |  | 12 |
| t | XGIPAM T (Transformer) (p.12) | protection | 보호 기능 | OCR(50/51)×2, OCGR(50/51N), UVR(27), OVR(59), Temperature(38), DPR(32P), DFR(87T) |  | 12 |
| dg | XGIPAM DG (Distributed Generation) (p.12) | protection | 보호 기능 | OCR(50/51), OCGR(50/51N), UVR(27), OVR(59), DPR(32P), UPR(37P), DQR(32Q), UFR(81U), OFR(81O), DGR(67N), SYNC Check(25), DOCR(67I/D), NSOCR(46I/D), POR(47), NSOVR(47N), ROCOF(81R), SGR(67G), OVGR(64I/D) |  | 12 |
| 3wt | XGIPAM 3wT (Transformer 3권선) (p.12) | protection | 보호 기능 | OCR(50/51)×3, OCGR(50N/51N), UVR(27), OVR(59), OVGR(64I/D), DFR(3W87T) |  | 12 |

### P01249 GIPAM3000

- 기기: 송전용 보호계전 시스템, 디지털 보호계전기
- 카탈로그: [[GIPAM3000]](https://www.ls-electric.com/ko/cat/%5BGIPAM3000%5D_KO_C16071-10-202605.pdf) · 대표 p.14
- 비고: 정격표(p14) 기준. 옵션은 형식별 보호요소(p12, 34/13종)
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 110 (55~125) (PT 입력) | V | 14 |
| ratedCurrent | 정격전류 | 5 (CT 입력) | A | 14 |
| frequency | 정격주파수 | 60, 50 | Hz | 14 |
| communication | 통신 | RS485: Modbus, DNP3.0 / Ethernet: Modbus, DNP3.0, IEC61850 |  | 14 |
| auxPower | 제어전원 | AC/DC110V, DC125V |  | 14 |
| standards | 적용 규격 | KEMC 1120, IEC 60255-26, IEC 61850 |  | 14 |

옵션 기준: **형식** (2개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| fi | GIPAM3000 FI (Feeder·Motor·Distributed Generation) (p.12) | protection | 보호 기능 | OCR(50/51), OCGR(50/51N), SGR(67G), SEF(51S), DOCGR(67NI/67ND), UVR(27), UVRR(27R), OVR(59), OVRR(59R), OVGR(64), NSOVR(47N), POR(47P), DPR(32P), DQR(32Q), DOCR(67I/67D), UFR(81U), OFR(81O), ROCOF(81R), NSOCR(46), THR(49), STALL-LOCK(48/51LR), UPR(37P), UCR(37), SYNC(25), RECLOSING(79), NCH(66), CBF(50BF), PTF(60F), CLP, LOCK-OUT(86) 등 34종 |  | 12 |
| t | GIPAM3000 T (Transformer) (p.12) | protection | 보호 기능 | OCR(50/51w1·w2·w3), OCGR(50/51N-1·-2), DFRG(87N), DFR(87T), LOCK-OUT(86) 등 13종 |  | 12 |

### P02212 GIPAM1000

- 기기: 송전용 보호계전 시스템, 디지털 보호계전기
- 카탈로그: [[GIPAM1000] 국문 카타로그](https://www.ls-electric.com/ko/cat/%5BGIPAM1000%5D_KO_C160M1-08-202512.pdf) · 대표 p.12
- 비고: 정격표(p12) 통신방식 칸에는 "RS-485 : Modbus"만 있으나 통신기능 페이지(p11)에 프로토콜 목록이 있어 p11 값으로 교체. 옵션은 형식별 보호요소(p10)
- 검수 상태: 통신 값 p11로 교체 · 사람 판단 필요(통신)

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 110 (55~125) (PT 입력) | V | 12 |
| ratedCurrent | 정격전류 | 5 (CT 입력) | A | 12 |
| frequency | 정격주파수 | 60, 50 | Hz | 12 |
| auxPower | 제어전원 | AC/DC110V, DC125V |  | 12 |
| standards | 적용 규격 | KEMC 1120 |  | 12 |
| communication | 통신 | RS-485: DNP3.0 SERIAL, MODBUS-RTU / Ethernet: DNP3.0 TCP, MODBUS-TCP, IEC61850 Ed.1/Ed.2 |  | 11 |

옵션 기준: **형식** (2개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| fi | GIPAM1000 FI (Feeder, 13종) (p.10) | protection | 보호 기능 | OCR(50/51), OCGR(50N/51N), SGR(67G), SEF(51S), UVR(27), OVR(59), OVGR(64), POR(47P), CBF(50BF), PTF(60F), LOCK-OUT(86) 등 13종 |  | 10 |
| dg | GIPAM1000 DG (Distributed Generation, 25종) (p.10) | protection | 보호 기능 | OCR(50/51), OCGR(50N/51N), SGR(67G), SEF(51S), DOCGR(67NI/ND), DOCR(67I/67D), UVR(27), OVR(59), OVGR(64), POR(47P), UFR(81U), OFR(81O), DPR(32P), DQR(32Q), UPR(37P), UCR(37), ROCOF(81R), VVS(78V), SYNC(25), CBF(50BF), PTF(60F), LOCK-OUT(86) 등 25종 |  | 10 |

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
| ratedCurrent | 정격전류 | 40(10), 80(20), 120(30) | A | 10 |
| frequency | 정격주파수 | 60 | Hz | 10 |
| accuracy | 계측 정밀도 | 1.0 급 |  | 10 |
| mounting | 설치·인출 방식 | 회전형 (표시부 좌/우 90도 회전) |  | 10 |
| ipRating | 보호등급(IP) | IP51 |  | 8 |

옵션 기준: **상 및 선식** (2개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 1p2w | 단상 2선식 (단독계기) (p.10) | phases | 상 및 선식 | 단상 2선식 (단독계기) |  | 10 |
|  |  | ratedVoltage | 정격전압 | AC 220 | V | 10 |
|  |  | pulseOutput | 외부출력(펄스) | 1 / 10 / 100 Wh/pulse (P-type) |  | 10 |
| 3p4w | 3상 4선식 (단독계기) (p.10) | phases | 상 및 선식 | 3상 4선식 (단독계기) |  | 10 |
|  |  | ratedVoltage | 정격전압 | AC 220/380 (상전압 220V) | V | 10 |
|  |  | pulseOutput | 외부출력(펄스) | 2 / 4 / 8 Wh/pulse (P-type) |  | 10 |

### P03082 USP Series(Din Type)

- 기기: 서지보호기
- 카탈로그: [[UL SPD]UL SPD 카달로그_국문](https://www.ls-electric.com/ko/cat/%5BSPD%5D_KO_C01551-07-202510.pdf) · 대표 p.33
- 비고: USP Series (AC/Din Type) 제품정격 기준
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| poles | 극수 | 1P, 2P, 3P, 4P, 1P+N, 3P+N |  | 33 |
| nominalDischarge | 공칭방전전류(In) | 20 | kA | 33 |
| maxDischarge | 최대방전전류(Imax) | 50 / 40 | kA | 33 |
| sccr | 단락전류정격(SCCR) | 200 | kA | 33 |
| standards | 적용 규격 | ANSI/UL1449 5th Type 1ca, IEC/EN 61643-11 Class II |  | 33 |

옵션 기준: **모델** (8개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| usp150 | USP150 (p.33) | ratedVoltage | 정격전압 | 120 (Un) | V | 33 |
|  |  | mcov | 최대연속동작전압(Uc) | 150 | V | 33 |
|  |  | tov | 일시적 과전압(TOV) | 175V/5s |  | 33 |
| usp180 | USP180 (p.33) | ratedVoltage | 정격전압 | 120~127 (Un) | V | 33 |
|  |  | mcov | 최대연속동작전압(Uc) | 180 | V | 33 |
|  |  | tov | 일시적 과전압(TOV) | 228V/5s |  | 33 |
| usp275 | USP275 (p.33) | ratedVoltage | 정격전압 | 220~230 (Un) | V | 33 |
|  |  | mcov | 최대연속동작전압(Uc) | 275 | V | 33 |
|  |  | tov | 일시적 과전압(TOV) | 335V/5s |  | 33 |
| usp320 | USP320 (p.33) | ratedVoltage | 정격전압 | 240~277 (Un) | V | 33 |
|  |  | mcov | 최대연속동작전압(Uc) | 320 | V | 33 |
|  |  | tov | 일시적 과전압(TOV) | 335V/5s |  | 33 |
| usp385 | USP385 (p.33) | ratedVoltage | 정격전압 | 240~277 (Un) | V | 33 |
|  |  | mcov | 최대연속동작전압(Uc) | 385 | V | 33 |
|  |  | tov | 일시적 과전압(TOV) | 403V/5s |  | 33 |
| usp420 | USP420 (p.33) | ratedVoltage | 정격전압 | 277~347 (Un) | V | 33 |
|  |  | mcov | 최대연속동작전압(Uc) | 420 | V | 33 |
|  |  | tov | 일시적 과전압(TOV) | 504V/5s |  | 33 |
| usp550 | USP550 (p.33) | ratedVoltage | 정격전압 | ~480 (Un) | V | 33 |
|  |  | mcov | 최대연속동작전압(Uc) | 550 | V | 33 |
|  |  | tov | 일시적 과전압(TOV) | 697V/5s |  | 33 |
| usp690 | USP690 (p.33) | ratedVoltage | 정격전압 | ~600 (Un) | V | 33 |
|  |  | mcov | 최대연속동작전압(Uc) | 690 | V | 33 |
|  |  | tov | 일시적 과전압(TOV) | 872V/5s |  | 33 |

### P03083 USPV Series(Din Type)

- 기기: 서지보호기
- 카탈로그: [[UL SPD]UL SPD 카달로그_국문](https://www.ls-electric.com/ko/cat/%5BSPD%5D_KO_C01551-07-202510.pdf) · 대표 p.39
- 비고: USPV Series (DC/Din Type) 제품정격 기준
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| poles | 극수 | 1P, 2P, 3P, 5P |  | 39 |
| nominalDischarge | 공칭방전전류(In) | 20 | kA | 39 |
| maxDischarge | 최대방전전류(Imax) | 50 | kA | 39 |
| ipRating | 보호등급(IP) | IP20 |  | 39 |
| standards | 적용 규격 | ANSI/UL1449 5th Type 1ca, IEC/EN 61643-11 Class II/Type 2 |  | 39 |

옵션 기준: **모델** (7개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| uspv48 | USPV48 (p.39) | ratedVoltage | 정격전압 | 48 (DC, Un) | V | 39 |
|  |  | maxDcVoltage | 최대 허용 직류전압 | 85 (Vpvd) | V | 39 |
|  |  | sccr | 단락전류정격(SCCR) | 30 | kA | 39 |
| uspv500 | USPV500 (p.39) | ratedVoltage | 정격전압 | 500 (DC, Un) | V | 39 |
|  |  | maxDcVoltage | 최대 허용 직류전압 | 560 (Vpvd) | V | 39 |
|  |  | sccr | 단락전류정격(SCCR) | 100 | kA | 39 |
| uspv600 | USPV600 (p.39) | ratedVoltage | 정격전압 | 600 (DC, Un) | V | 39 |
|  |  | maxDcVoltage | 최대 허용 직류전압 | 700 (Vpvd) | V | 39 |
|  |  | sccr | 단락전류정격(SCCR) | 50 | kA | 39 |
| uspv800 | USPV800 (p.39) | ratedVoltage | 정격전압 | 800 (DC, Un) | V | 39 |
|  |  | maxDcVoltage | 최대 허용 직류전압 | 920 (Vpvd) | V | 39 |
|  |  | sccr | 단락전류정격(SCCR) | 50 | kA | 39 |
| uspv1000 | USPV1000 (p.39) | ratedVoltage | 정격전압 | 1000 (DC, Un) | V | 39 |
|  |  | maxDcVoltage | 최대 허용 직류전압 | 1120 (Vpvd) | V | 39 |
|  |  | sccr | 단락전류정격(SCCR) | 50 | kA | 39 |
| uspv1200 | USPV1200 (p.39) | ratedVoltage | 정격전압 | 1200 (DC, Un) | V | 39 |
|  |  | maxDcVoltage | 최대 허용 직류전압 | 1340 (Vpvd) | V | 39 |
|  |  | sccr | 단락전류정격(SCCR) | 50 | kA | 39 |
| uspv1500 | USPV1500 (p.39) | ratedVoltage | 정격전압 | 1500 (DC, Un) | V | 39 |
|  |  | maxDcVoltage | 최대 허용 직류전압 | 1500 (Vpvd) | V | 39 |
|  |  | sccr | 단락전류정격(SCCR) | 100 | kA | 39 |

### P03084 USPE Series(Panel Type)

- 기기: 서지보호기
- 카탈로그: [[UL SPD]UL SPD 카달로그_국문](https://www.ls-electric.com/ko/cat/%5BSPD%5D_KO_C01551-07-202510.pdf) · 대표 p.42
- 비고: USPE Series (Panel Type) 제품정격 기준
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| mcov | 최대연속동작전압(Uc) | 150, 320, 420, 550, 690 | V | 42 |
| nominalDischarge | 공칭방전전류(In) | 10 | kA | 42 |
| sccr | 단락전류정격(SCCR) | 200 | kA | 42 |
| frequency | 정격주파수 | 47~63 | Hz | 42 |
| standards | 적용 규격 | ANSI/UL1449 5th, CSA C22.2 (Type1 SPD) |  | 42 |

옵션 기준: **Surge Capacity** (2개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 25ka | USPE 25kA (p.42) | maxDischarge | 최대방전전류(Imax) | 25 (8/20μs) | kA | 42 |
| 50ka | USPE 50kA (p.42) | maxDischarge | 최대방전전류(Imax) | 50 (8/20μs) | kA | 42 |

### P01260 Metasol MS

- 기기: 전자개폐기 (MC+열동계전기)
- 카탈로그: [[Metasol MS]](https://www.ls-electric.com/ko/cat/%5BMetasol_MS%5D_KO_C04001-37-202609.pdf) · 대표 p.10
- 비고: 기종 개요(p6~7)·기종일람표(p10~13) 기준, 대표 옵션만(전체 18~2650AF 13종 중 8종). 3극형 MC + MT 열동형 과부하계전기. 적용 규격: IEC 60947은 p.10, UL 508은 p.3(목차)
- 검수 상태: 페이지 정정 반영(옵션별 페이지·규격 p10) · 옵션 Ue 매핑 검수 필요

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| frequency | 정격주파수 | 50/60 | Hz | 10 |
| poles | 극수 | 3 | P | 10 |
| standards | 적용 규격 | IEC 60947, UL 508 |  | 10 |

옵션 기준: **프레임** (8개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 18af | 18AF (MC-6a, 9a, 12a, 18a) (p.6) | frame | 프레임 | 18 | AF | 6 |
|  |  | ratedCurrent | 정격전류 | 6, 9, 12, 18 | A | 6 |
|  |  | ratedVoltage | 정격전압 | 690 (Ue) | V | 10 |
|  |  | insulationVoltage | 정격절연전압 | 690 | V | 6 |
|  |  | olrRange | 과부하계전기 전류설정범위 | 0.1~18 (MT-12) | A | 6 |
| 40af | 40AF (MC-32a, 40a) (p.6) | frame | 프레임 | 40 | AF | 6 |
|  |  | ratedCurrent | 정격전류 | 32, 40 | A | 6 |
|  |  | ratedVoltage | 정격전압 | 1000 (Ue) | V | 11 |
|  |  | insulationVoltage | 정격절연전압 | 1000 | V | 6 |
|  |  | olrRange | 과부하계전기 전류설정범위 | 0.1~40 (MT-32) | A | 6 |
| 65af | 65AF (MC-50a, 65a) (p.6) | frame | 프레임 | 65 | AF | 6 |
|  |  | ratedCurrent | 정격전류 | 50, 65 | A | 6 |
|  |  | ratedVoltage | 정격전압 | 1000 (Ue) | V | 11 |
|  |  | insulationVoltage | 정격절연전압 | 1000 | V | 6 |
|  |  | olrRange | 과부하계전기 전류설정범위 | 4~65 (MT-63) | A | 6 |
| 100af | 100AF (MC-75a, 85a, 100a) (p.6) | frame | 프레임 | 100 | AF | 6 |
|  |  | ratedCurrent | 정격전류 | 75, 85, 100 | A | 6 |
|  |  | ratedVoltage | 정격전압 | 1000 (Ue) | V | 11 |
|  |  | insulationVoltage | 정격절연전압 | 1000 | V | 6 |
|  |  | olrRange | 과부하계전기 전류설정범위 | 7~100 (MT-95) | A | 6 |
| 225af | 225AF (MC-185a, 225a) (p.7) | frame | 프레임 | 225 | AF | 7 |
|  |  | ratedCurrent | 정격전류 | 185, 225 | A | 7 |
|  |  | ratedVoltage | 정격전압 | 1000 (Ue) | V | 12 |
|  |  | insulationVoltage | 정격절연전압 | 1000 | V | 7 |
|  |  | olrRange | 과부하계전기 전류설정범위 | 65~240 (MT-225) | A | 7 |
| 400af | 400AF (MC-265a, 330a, 400a) (p.7) | frame | 프레임 | 400 | AF | 7 |
|  |  | ratedCurrent | 정격전류 | 265, 330, 400 | A | 7 |
|  |  | ratedVoltage | 정격전압 | 1000 (Ue) | V | 12 |
|  |  | insulationVoltage | 정격절연전압 | 1000 | V | 7 |
|  |  | olrRange | 과부하계전기 전류설정범위 | 85~400 (MT-400) | A | 7 |
| 800af | 800AF (MC-500a, 630a, 800a) (p.7) | frame | 프레임 | 800 | AF | 7 |
|  |  | ratedCurrent | 정격전류 | 500, 630, 800 | A | 7 |
|  |  | ratedVoltage | 정격전압 | 1000 (Ue) | V | 13 |
|  |  | insulationVoltage | 정격절연전압 | 1000 | V | 7 |
|  |  | olrRange | 과부하계전기 전류설정범위 | 200~800 (MT-800) | A | 7 |
| 2650af | 2650AF (MC-1400a, 1700a, 2100a, 2650a) (p.7) | frame | 프레임 | 2650 | AF | 7 |
|  |  | ratedCurrent | 정격전류 | 1400, 1700, 2100, 2650 | A | 7 |
|  |  | ratedVoltage | 정격전압 | 1000 (Ue) | V | 13 |
|  |  | insulationVoltage | 정격절연전압 | 1000 | V | 7 |

### P01261 Susol MS

- 기기: 전자개폐기 (MC+열동계전기)
- 카탈로그: [[Susol MC]](https://www.ls-electric.com/ko/cat/%5BSusol_MC%5D_KO_C04071-07-202005.pdf) · 대표 p.14
- 비고: 이미지형 PDF(텍스트 없음) — 기종일람표(p14~15) 페이지 이미지를 판독. 적용 전동기 용량·정격전류는 AC-3, 380/440V 행
- 검수 상태: 텍스트 확인 불가(이미지 PDF, 7항목 사람 판독값)

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 1000 (Ue) | V | 14 |
| frequency | 정격주파수 | 50/60 | Hz | 14 |
| poles | 극수 | 3 | P | 14 |

옵션 기준: **프레임** (3개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 32af | 32AF (MC-9, 12, 18, 25, 32) (p.14) | frame | 프레임 | 32 | AF | 14 |
|  |  | motorPower | 적용 전동기 용량 | 4, 5.5, 7.5, 11, 15 (AC-3, 380/440V) | kW | 14 |
|  |  | ratedCurrent | 정격전류 | 9, 12, 18, 25, 32 (AC-3, 380/440V) | A | 14 |
|  |  | olrRange | 과부하계전기 전류설정범위 | 0.1~32 (MT-32) | A | 14 |
| 63af | 63AF (MC-35, 40, 50, 63) (p.15) | frame | 프레임 | 63 | AF | 15 |
|  |  | motorPower | 적용 전동기 용량 | 18.5, 18.5, 22, 25 (AC-3, 380/440V) | kW | 15 |
|  |  | ratedCurrent | 정격전류 | 35, 40, 50, 63 (AC-3, 380/440V) | A | 15 |
|  |  | olrRange | 과부하계전기 전류설정범위 | 4~65 (MT-63) | A | 15 |
| 95af | 95AF (MC-65, 75, 85, 95) (p.15) | frame | 프레임 | 95 | AF | 15 |
|  |  | motorPower | 적용 전동기 용량 | 30, 37, 45, 45 (AC-3, 380/440V) | kW | 15 |
|  |  | ratedCurrent | 정격전류 | 65, 75, 85, 95 (AC-3, 380/440V) | A | 15 |
|  |  | olrRange | 과부하계전기 전류설정범위 | 7~95 (MT-95) | A | 15 |

### P01043 Mini MS

- 기기: 전자개폐기 (MC+열동계전기)
- 카탈로그: [[Mini MS]](https://www.ls-electric.com/ko/cat/%5BMini_MS%5D_KO_C04061-03-202609.pdf) · 대표 p.10
- 비고: 기종일람표(p10) 및 특징(p4~5) 기준. 특징(p4)에는 "7.5kW 이하의 소형 모터 부하"로 기재. 옵션 값은 AC3급 380~440V
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| insulationVoltage | 정격절연전압 | 690 | V | 10 |
| ratedCurrent | 정격전류 | 20 (AC1급 연속통전전류) | A | 10 |
| mounting | 설치·인출 방식 | 나사, DIN rail 취부 겸용 (35mm) |  | 10 |
| standards | 적용 규격 | IEC 60947-4-1, IEC 60947-5-1, IEC 60947-1, K 60947, UL 508 |  | 5 |

옵션 기준: **프레임** (2개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 6a | 6A (GMC-6M) (p.10) | frame | 프레임 | 6 | A | 10 |
|  |  | motorPower | 적용 전동기 용량 | 2.2 (AC3급, 380~440V) | kW | 10 |
| 9a | 9A (GMC-9M) (p.10) | frame | 프레임 | 9 | A | 10 |
|  |  | motorPower | 적용 전동기 용량 | 4 (AC3급, 380~440V) | kW | 10 |

### P01053 GMP

- 기기: 전자식 모터보호 계전기
- 카탈로그: [[GMP]](https://www.ls-electric.com/ko/cat/%5BGMP%5D_KO_C15041-07-202409.pdf) · 대표 p.4
- 비고: 표준기종일람표(p4) 기준. 보호요소는 같은 모델 계열 안에서도 형명(2P/3P/3PR 등)에 따라 다름
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| standards | 적용 규격 | 안전인증(S마크) |  | 5 |

옵션 기준: **모델** (6개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| gmp22 | GMP22 (p.4) | ratedCurrent | 정격전류 | 0.3~1.5 / 1~5 / 4.4~22 | A | 4 |
|  |  | protection | 보호 기능 | 과전류, 구속, 결상 (3P: +불평형, 3PR: +역상) |  | 4 |
|  |  | mounting | 설치·인출 방식 | 직결형(Pin) / 단자형(Screw) / 관통형(Tunnel) |  | 4 |
| gmp22i | GMP22i (p.4) | ratedCurrent | 정격전류 | 0.3~3.6 / 1~12 / 2~22 | A | 4 |
|  |  | protection | 보호 기능 | 과전류, 결상 (구속은 과전류로 동작) |  | 4 |
|  |  | mounting | 설치·인출 방식 | 직결형(Pin) / 단자형(Screw) / 관통형(Tunnel) |  | 4 |
| gmp40 | GMP40 (p.4) | ratedCurrent | 정격전류 | 4~20 / 8~40 | A | 4 |
|  |  | protection | 보호 기능 | 과전류, 구속, 결상 (3P: +불평형, 3PR: +역상) |  | 4 |
|  |  | mounting | 설치·인출 방식 | 직결형(Pin) / 단자형(Screw) / 관통형(Tunnel) |  | 4 |
| gmp40i | GMP40i (p.4) | ratedCurrent | 정격전류 | 4~40 | A | 4 |
|  |  | protection | 보호 기능 | 과전류, 결상 (구속은 과전류로 동작) |  | 4 |
|  |  | mounting | 설치·인출 방식 | 직결형(Pin) / 단자형(Screw) / 관통형(Tunnel) |  | 4 |
| gmp60 | GMP60 (p.4) | ratedCurrent | 정격전류 | 0.5~6 / 3~30 / 5~60 (GMP60T), 0.5~60 | A | 4 |
|  |  | protection | 보호 기능 | 과전류, 구속, 결상 (3T/3S: +불평형, R: +역상, Z/N: +지락, TDa: +저전류) |  | 4 |
|  |  | mounting | 설치·인출 방식 | 관통형(Tunnel) / 단자형(Screw) |  | 4 |
| gmp80 | GMP80 (p.4) | ratedCurrent | 정격전류 | 16~80 | A | 4 |
|  |  | protection | 보호 기능 | 과전류, 구속, 결상 (3S: +불평형, 3SR: +역상) |  | 4 |
|  |  | mounting | 설치·인출 방식 | 단자형(Screw) |  | 4 |

### P01054 DMPi

- 기기: 전자식 모터보호 계전기
- 카탈로그: [[DMPi]](https://www.ls-electric.com/ko/cat/%5BDMPi%5D_KO_C15021-06-202504.pdf) · 대표 p.9
- 비고: 정격 및 형명체계(p9) 기준
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| protection | 보호 기능 | 과전류, 구속, 결상, 불평형, 역상, 부족전류, 지락(선택), 순시단락(선택) |  | 9 |
| communication | 통신 | RS485 Modbus, 4~20mA (형명 선택) |  | 9 |
| auxPower | 제어전원 | AC/DC 85~260V, AC/DC 24V |  | 9 |
| mounting | 설치·인출 방식 | 관통형/단자형, 35mm DIN rail/나사, 표시창 분리 설치 가능 |  | 9 |

옵션 기준: **정격전류** (2개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 06i | 06i (0.5~6A) (p.9) — 65A 이상 부하는 외부 CT와 함께 06i 선정 | ratedCurrent | 정격전류 | 0.5~6 | A | 9 |
| 65i | 65i (5~65A) (p.9) | ratedCurrent | 정격전류 | 5~65 | A | 9 |

### P01056 MMP

- 기기: 전자식 모터보호 계전기
- 카탈로그: [[MMP]](https://www.ls-electric.com/ko/cat/%5BMMP%5D_KO_C15011-11-202409.pdf) · 대표 p.17
- 비고: 정격 및 형명체계(p17) 기준
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| protection | 보호 기능 | 과전류, 구속(Stall/Locked), 결상/불평형 등 |  | 7 |
| communication | 통신 | MODBUS TCP/IP, MODBUS RS485 |  | 17 |
| auxPower | 제어전원 | AC 110V, AC 220V 50/60Hz |  | 17 |
| accuracy | 계측 정밀도 | 전류·전압 ±1% 또는 최소정격의 ±2% |  | 17 |

옵션 기준: **정격전류** (2개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 10 | 10 (0.5~10A) (p.17) — 100A 이상 부하는 외부 CT와 함께 "10" 선정 | ratedCurrent | 정격전류 | 0.5~10 | A | 17 |
| 100 | 100 (5~100A) (p.17) | ratedCurrent | 정격전류 | 5~100 | A | 17 |

### P02210 LVSS Soft Starter

- 기기: 소프트 스타터
- 카탈로그: [[LV Soft Stater]](https://www.ls-electric.com/ko/cat/%5BLV_Soft_Stater%5D_KO_C040C1-01-202203.pdf) · 대표 p.6
- 비고: 선택 가이드(p6)·Specifications(p7) 기준. 옵션은 Trip Class 10 열 기준 대표 모델만(전체 17~1080A)
- 검수 상태: 자동 대조 통과 · 통신 "(표준)/(옵션)" 주석 표기

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 200~480 | V | 6 |
| frequency | 정격주파수 | 50/60 | Hz | 6 |
| bypass | 바이패스 | Internally Bypassed |  | 7 |
| communication | 통신 | Modbus RTU (표준) / Ethernet IP, Modbus TCP, Profibus DP (Anybus 옵션) |  | 7 |
| standards | 적용 규격 | IEC 60947-4-2: 2012, CE, CETL, KC |  | 7 |

옵션 기준: **용량 (Trip Class 10 선정 모델)** (4개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| lvss-101 | LS-LVSS-101 (p.6) | ratedCurrent | 정격전류 | 17 | A | 6 |
|  |  | motorPower | 적용 전동기 용량 | 4 (230V) / 7.5 (400V) / 7.5 (440V) | kW | 6 |
| lvss-205 | LS-LVSS-205 (p.6) | ratedCurrent | 정격전류 | 195 | A | 6 |
|  |  | motorPower | 적용 전동기 용량 | 55 (230V) / 110 (400V) / 132 (440V) | kW | 6 |
| lvss-309 | LS-LVSS-309-1/-2 (p.6) | ratedCurrent | 정격전류 | 500 | A | 6 |
|  |  | motorPower | 적용 전동기 용량 | 160 (230V) / 280 (400V) / 315 (440V) | kW | 6 |
| lvss-505 | LS-LVSS-505-1/-2 (p.6) | ratedCurrent | 정격전류 | 1080 | A | 6 |
|  |  | motorPower | 적용 전동기 용량 | 355 (230V) / 630 (400V) / 670 (440V) | kW | 6 |

### P01045 Motorsol Soft Starter

- 기기: 소프트 스타터
- 카탈로그: [[Soft Starter]](https://www.ls-electric.com/ko/cat/%5BSoft_Starter%5D_KO_C01581-07-201803.pdf) · 대표 p.8
- 비고: LSFS 단방향(S) 기종일람표(p8~9) 기준, 380V급 대표 모델만(전체 2.2~600kW)
- 검수 상태: 페이지 정정 반영(옵션별 p8·p9) · 냉각 요약 표기

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 220 / 380 / 440 | V | 8 |
| frequency | 정격주파수 | 50 / 60 | Hz | 8 |
| insulation | 절연·냉각 방식 | 방열판 자연냉각 및 방열판+Fan 강제냉각 |  | 8 |
| standards | 적용 규격 | EN 61131-2, EN 50178 |  | 8 |

옵션 기준: **용량** (4개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 3-7kw | 3.7kW (LSFS 3003 S) (p.8) | motorPower | 적용 전동기 용량 | 3.7 | kW | 8 |
|  |  | ratedCurrent | 정격전류 | 7.5 (380/440V) | A | 8 |
| 37kw | 37kW (LSFS 3037 S) (p.8) | motorPower | 적용 전동기 용량 | 37 | kW | 8 |
|  |  | ratedCurrent | 정격전류 | 75 (380/440V) | A | 8 |
| 150kw | 150kW (LSFS 3150 S) (p.9) | motorPower | 적용 전동기 용량 | 150 | kW | 9 |
|  |  | ratedCurrent | 정격전류 | 300 (380/440V) | A | 9 |
| 600kw | 600kW (LSFS 3600 S) (p.9) | motorPower | 적용 전동기 용량 | 600 | kW | 9 |
|  |  | ratedCurrent | 정격전류 | 1200 (380/440V) | A | 9 |

### P01188 iS7

- 기기: 저압 인버터
- 카탈로그: [iS7 카탈로그](https://ssqfd-abhdhraad3gkgbcg.a03.azurefd.net/prod/largefile/document/16957054248320/iS7_Catalog_KR_202309.pdf) · 대표 p.13
- 비고: 기본규격(p13~15) 기준. 적용 전동기·정격전류(출력)는 중부하(CT) 기준(경부하 VT 기준 400V급은 450kW까지)
- 검수 상태: T2 대조 일치(IP) · 페이지 정정 반영(옵션별 p13·p14) · 통신 요약 표기

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| frequency | 정격주파수 | 입력 50~60 (±5%) / 출력 0~400 | Hz | 13 |
| protection | 보호 기능 | 과전류, 과전압, 저전압, 지락 전류 검출, 과열, 입출력 결상, 과부하 등 |  | 15 |
| insulation | 절연·냉각 방식 | 강제 풍냉 |  | 15 |
| ipRating | 보호등급(IP) | IP 21 (75kW 이하), IP 00 (200V 30~75kW·90kW 이상), IP 54 (22kW 이하 별도제품) |  | 15 |
| communication | 통신 | 옵션: Profibus DP, DeviceNet, CANopen, Ethernet IP/Modbus-TCP, PROFInet 등 |  | 7 |

옵션 기준: **전압·용량 등급** (4개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 200v-0-75-22kw | 200V급 0.75~22kW (p.13) | ratedVoltage | 정격전압 | 3상 200~230 | VAC | 13 |
|  |  | motorPower | 적용 전동기 용량 | 0.75~22 (CT) | kW | 13 |
|  |  | ratedCurrent | 정격전류 | 5~88 (CT, 출력) | A | 13 |
| 200v-30-75kw | 200V급 30~75kW (p.13) | ratedVoltage | 정격전압 | 3상 200~230 | VAC | 13 |
|  |  | motorPower | 적용 전동기 용량 | 30~75 (CT) | kW | 13 |
|  |  | ratedCurrent | 정격전류 | 116~288 (CT, 출력) | A | 13 |
| 400v-0-75-22kw | 400V급 0.75~22kW (p.13) | ratedVoltage | 정격전압 | 3상 380~480 | VAC | 13 |
|  |  | motorPower | 적용 전동기 용량 | 0.75~22 (CT) | kW | 13 |
|  |  | ratedCurrent | 정격전류 | 2.5~45 (CT, 출력) | A | 13 |
| 400v-30-375kw | 400V급 30~375kW (p.14) | ratedVoltage | 정격전압 | 3상 380~480 | VAC | 14 |
|  |  | motorPower | 적용 전동기 용량 | 30~375 (CT) | kW | 14 |
|  |  | ratedCurrent | 정격전류 | 61~731 (CT, 출력) | A | 14 |

### P01184 S100

- 기기: 저압 인버터
- 카탈로그: [S100 카탈로그](https://ssqfd-abhdhraad3gkgbcg.a03.azurefd.net/prod/largefile/document/17070989202140/S100_Catalog_KR_202402.pdf) · 대표 p.16
- 비고: 기본규격(p16)·Line-up(p95) 기준. 적용 전동기는 중부하 기준
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| frequency | 정격주파수 | 입력 50~60 (±5%) | Hz | 14 |
| protection | 보호 기능 | 과전류, 과전압, 저전압, 입력·출력 결상, 지락, 인버터·모터 과부하 등 트립 |  | 16 |
| ipRating | 보호등급(IP) | IP20/UL Open (기본), UL Enclosed Type 1·IP66/NEMA 4X (옵션) |  | 16 |
| communication | 통신 | 내장 RS485 / Field Bus: Ethernet IP, Modbus TCP, CANopen, EtherCAT, PROFInet |  | 6 |

옵션 기준: **입력 전압** (3개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 1ph-200v | 1Ø 200V (p.95) | ratedVoltage | 정격전압 | 1상 200~240 | VAC | 12 |
|  |  | motorPower | 적용 전동기 용량 | 0.4~2.2 | kW | 95 |
|  |  | ip66Power | IP66/NEMA4X 적용 용량 | 0.4~2.2 | kW | 95 |
| 3ph-200v | 3Ø 200V (p.95) | ratedVoltage | 정격전압 | 3상 200~240 | VAC | 12 |
|  |  | motorPower | 적용 전동기 용량 | 0.4~15 | kW | 95 |
|  |  | ip66Power | IP66/NEMA4X 적용 용량 | 0.4~15 | kW | 95 |
| 3ph-400v | 3Ø 400V (p.95) | ratedVoltage | 정격전압 | 3상 380~480 | VAC | 12 |
|  |  | motorPower | 적용 전동기 용량 | 0.4~75 | kW | 95 |
|  |  | ip66Power | IP66/NEMA4X 적용 용량 | 0.4~22 | kW | 95 |

### P01247 G100/G100C

- 기기: 저압 인버터
- 카탈로그: [G100(C) 카탈로그](https://ssq.ls-electric.com/uploads/document/17531425436680/G100%20Series_Catalog_KR_202506.pdf) · 대표 p.11
- 비고: 기본 규격(p11~12) 기준. 적용 전동기·정격전류(출력)는 중부하 기준. G100C는 0.4~4kW
- 검수 상태: 자동 대조 통과(숫자·출처) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| frequency | 정격주파수 | 입력 50~60 (±5%) / 출력 0~400 | Hz | 11 |
| protection | 보호 기능 | 과전류, 암 단락, 과열, 입력 결상, 지락, 모터 과열 등 트립 |  | 12 |
| ipRating | 보호등급(IP) | IP 20, UL Open Type |  | 12 |
| communication | 통신 | RAPIEnet+ (RAPIEnet, EtherNet/IP, Modbus TCP) |  | 3 |
| standards | 적용 규격 | UL 61800-5-1, EN 61508 SIL2 |  | 3 |

옵션 기준: **입력 전압** (2개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 200v | 3-phase 200V급 (p.11) | ratedVoltage | 정격전압 | 3상 200~240 | VAC | 11 |
|  |  | motorPower | 적용 전동기 용량 | 0.4~22 (중부하) | kW | 11 |
|  |  | ratedCurrent | 정격전류 | 2.5~88 (중부하, 출력) | A | 11 |
| 400v | 3-phase 400V급 (p.11) | ratedVoltage | 정격전압 | 3상 380~480 | VAC | 11 |
|  |  | motorPower | 적용 전동기 용량 | 0.4~22 (중부하) | kW | 11 |
|  |  | ratedCurrent | 정격전류 | 1.3~45 (중부하, 출력) | A | 11 |

### P01183 H100

- 기기: 저압 인버터
- 카탈로그: [H100 카탈로그](https://ssq.ls-electric.com/uploads/document/17936100709070/H100_KO_C55041-31-202611.pdf) · 대표 p.12
- 비고: 입·출력 규격(p12~13) 기준. 팬·펌프(HVAC) 전용
- 검수 상태: 페이지 정정 반영(옵션별 p12·p13)

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| frequency | 정격주파수 | 입력 50~60 (±5%) / 출력 0~400 | Hz | 12 |
| communication | 통신 | 내장(RS-485): BACnet, Modbus-RTU, Metasys N2 / 옵션: LonWorks, BACnet/IP, EtherNet/IP, Modbus TCP 등 |  | 5 |
| ipRating | 보호등급(IP) | IP 20 (0.75~185kW), IP00 (220~500kW) |  | 14 |

옵션 기준: **전압·용량 등급** (4개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 200v-0-75-18-5kw | 3상 200V급 (0.75~18.5kW) (p.12) | ratedVoltage | 정격전압 | 3상 200~240 / 단상 240 | VAC | 12 |
|  |  | motorPower | 적용 전동기 용량 | 0.75~18.5 | kW | 12 |
|  |  | ratedCurrent | 정격전류 | 5~69 (출력) | A | 12 |
| 400v-0-75-22kw | 3상 400V급 (0.75~22kW) (p.12) | ratedVoltage | 정격전압 | 3상 380~480 / 단상 480 | VAC | 12 |
|  |  | motorPower | 적용 전동기 용량 | 0.75~22 | kW | 12 |
|  |  | ratedCurrent | 정격전류 | 2.5~45 (출력) | A | 12 |
| 400v-30-90kw | 3상 400V급 (30~90kW) (p.12) | ratedVoltage | 정격전압 | 3상 380~480 / 단상 480 | VAC | 12 |
|  |  | motorPower | 적용 전동기 용량 | 30~90 | kW | 12 |
|  |  | ratedCurrent | 정격전류 | 61~169 (출력) | A | 12 |
| 400v-110-750kw | 3상 400V급 (110~750kW) (p.13) | ratedVoltage | 정격전압 | 3상 380~500 | VAC | 13 |
|  |  | motorPower | 적용 전동기 용량 | 110~750 | kW | 13 |
|  |  | ratedCurrent | 정격전류 | 223~1200 (출력) | A | 13 |

### P01023 Metasol MCCB

- 기기: 배선용차단기
- 카탈로그: [[Metasol MCCB]](https://www.ls-electric.com/ko/cat/%5BMetasol_MCCB%5D_KO_C01031-35-202610.pdf) · 대표 p.22
- 비고: 기종일람표 MCCB(p22~25) 기준 (HTTP Range로 필요한 페이지만 받아 추출), 대표 옵션만(전체 30~1200AF 11종 중 8종). 정격차단전류는 AC 415/460V 행. 100AF·125AF는 한 표 열을 공유해 형명 순서대로 적음
- 검수 상태: 신규(Range) · 100/125AF 열 공유 검수 필요

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| poles | 극수 | 2, 3, 4 | P | 22 |
| impulseVoltage | 정격임펄스내전압 | 8 (30AF E-type·1000AF·1200AF는 6) | kV | 22 |
| frequency | 정격주파수 | 50/60 (공용) | Hz | 22 |
| standards | 적용 규격 | KS C 8321, IEC 60947-2 |  | 22 |

옵션 기준: **프레임** (8개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 30af | 30AF (p.22) | frame | 프레임 | 30 | AF | 22 |
|  |  | ratedVoltage | 정격전압 | 460 (E-type) / 690 (S-type) | V AC | 22 |
|  |  | ratedCurrent | 정격전류 | 3, 5, 10, 15, 20, 30 (E) / (3, 5, 10), 15, 16, 20, 25, 30 (S) | A | 22 |
|  |  | breakingCapacity | 정격차단전류 | 2.5 (E) / 14 (10) (S) | kA | 22 |
| 50af | 50AF (p.22) | frame | 프레임 | 50 | AF | 22 |
|  |  | ratedVoltage | 정격전압 | 690 | V AC | 22 |
|  |  | ratedCurrent | 정격전류 | 15, 16, 20, 25, 30, 32, 40, 50 | A | 22 |
|  |  | breakingCapacity | 정격차단전류 | 14 / 18 / 50 (N/S/H) | kA | 22 |
| 100-125af | 100AF·125AF (ABN·ABS·ABH·ABL 10□) (p.23) | frame | 프레임 | 100 / 125 | AF | 23 |
|  |  | ratedVoltage | 정격전압 | 690 | V AC | 23 |
|  |  | ratedCurrent | 정격전류 | 15, (16), 20, (25), 30, (32), 40, 50, 60, (63), 75, (80), 100 (100AF) / … 100, 125 (125AF) | A | 23 |
|  |  | breakingCapacity | 정격차단전류 | 18 / 26 (18) / 31 (18) / 37 / 50 / 60 (50) (ABN102c·d·e / ABS / ABH / ABL) | kA | 23 |
| 250af | 250AF (p.23) | frame | 프레임 | 250 | AF | 23 |
|  |  | ratedVoltage | 정격전압 | 690 | V AC | 23 |
|  |  | ratedCurrent | 정격전류 | 100, 125, 150, (160), 175, 200, 225, 250 | A | 23 |
|  |  | breakingCapacity | 정격차단전류 | 26 / 37 / 50 / 60 (50) (N/S/H/L) | kA | 23 |
| 400af | 400AF (p.24) | frame | 프레임 | 400 | AF | 24 |
|  |  | ratedVoltage | 정격전압 | 690 | V AC | 24 |
|  |  | ratedCurrent | 정격전류 | 250, 300, 350, 400 | A | 24 |
|  |  | breakingCapacity | 정격차단전류 | 37 / 50 / 65 / 85 (N/S/H/L) | kA | 24 |
| 630af | 630AF (p.24) | frame | 프레임 | 630 | AF | 24 |
|  |  | ratedVoltage | 정격전압 | 690 | V AC | 24 |
|  |  | ratedCurrent | 정격전류 | 500, 600, 630 | A | 24 |
|  |  | breakingCapacity | 정격차단전류 | 37 / 65 / 85 (N/S/L) | kA | 24 |
| 800af | 800AF (p.25) | frame | 프레임 | 800 | AF | 25 |
|  |  | ratedVoltage | 정격전압 | 690 | V AC | 25 |
|  |  | ratedCurrent | 정격전류 | 700, 800 | A | 25 |
|  |  | breakingCapacity | 정격차단전류 | 37 / 65 / 85 (N/S/L) | kA | 25 |
| 1200af | 1200AF (p.25) | frame | 프레임 | 1200 | AF | 25 |
|  |  | ratedVoltage | 정격전압 | 600 | V AC | 25 |
|  |  | ratedCurrent | 정격전류 | 1200 | A | 25 |
|  |  | breakingCapacity | 정격차단전류 | 65 / 85 (S/L) | kA | 25 |

### P01030 Metasol ACB

- 기기: 기중차단기
- 카탈로그: [[Metasol ACB]](https://www.ls-electric.com/ko/cat/%5BMetasol_ACB%5D_KO_C06091-28-202607.pdf) · 대표 p.4
- 비고: Overview(p3~5) 기종별 차단용량(Icu=Ics, 500Vac)과 AN형 정격표(p18) 기준 (HTTP Range로 필요한 페이지만 받아 추출). AS형 상세 정격표는 받지 않음
- 검수 상태: 신규(Range) · 미검수

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| impulseVoltage | 정격임펄스내전압 | 12 | kV | 3 |
| standards | 적용 규격 | IEC60947-2 (CE 인증) |  | 3 |

옵션 기준: **형식·프레임** (6개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| an-d | AN-06~16D (p.4) | frame | 프레임 | 630~1600 | AF | 4 |
|  |  | breakingCapacity | 정격차단전류 | 65 (500Vac, Icu=Ics) | kA | 4 |
|  |  | ratedVoltage | 정격전압 | 690 (Ue) | V | 18 |
|  |  | ratedCurrent | 정격전류 | 200~1600 (In max) | A | 18 |
| as-d | AS-06~20D (p.4) | frame | 프레임 | 630~2000 | AF | 4 |
|  |  | breakingCapacity | 정격차단전류 | 70 (500Vac, Icu=Ics) | kA | 4 |
| an-e | AN-20~32E (p.4) | frame | 프레임 | 2000~3200 | AF | 4 |
|  |  | breakingCapacity | 정격차단전류 | 70 (500Vac, Icu=Ics) | kA | 4 |
|  |  | ratedVoltage | 정격전압 | 690 (Ue) | V | 18 |
|  |  | ratedCurrent | 정격전류 | 200~3200 (In max) | A | 18 |
| as-e | AS-20~40E (p.4) | frame | 프레임 | 2000~4000 | AF | 4 |
|  |  | breakingCapacity | 정격차단전류 | 85 (500Vac, Icu=Ics) | kA | 4 |
| as-f | AS-50F (p.5) | frame | 프레임 | 4000~5000 | AF | 5 |
|  |  | breakingCapacity | 정격차단전류 | 100 (500Vac, Icu=Ics) | kA | 5 |
| as-g | AS-40~63G (p.5) | frame | 프레임 | 4000~6300 | AF | 5 |
|  |  | breakingCapacity | 정격차단전류 | 120 (500Vac, Icu=Ics) | kA | 5 |

### P02206 Susol Compact ACB

- 기기: 기중차단기
- 카탈로그: [[Susol Compact ACB]](https://www.ls-electric.com/ko/cat/%5BSusol_Compact_ACB%5D_KO_C06001-04-202201.pdf) · 대표 p.5
- 비고: 주요특징(p5) 기준 (HTTP Range로 필요한 페이지만 받아 추출). AN형 차단용량: 그림 표기는 42kA/690Vac, 본문은 "Cat.B 차단기(AH, AN형) 50kA/690Vac" — 그림 값을 넣음, 검수 필요
- 검수 상태: 신규(Range) · AN형 차단용량 검수 필요

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| standards | 적용 규격 | IEC 60947-2 (DEKRA CB인증), GB 14048.2 (CCC 인증) |  | 5 |

옵션 기준: **형식** (4개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| an | AN type (AN-08·AN-16, Cat.B) (p.5) | frame | 프레임 | 800 / 1600 | AF | 5 |
|  |  | breakingCapacity | 정격차단전류 | 42 (690Vac), Ics=100% | kA | 5 |
|  |  | ratedCurrent | 정격전류 | 400~1600 | A | 5 |
| ah | AH type (AH-08·AH-16, Cat.B) (p.5) | frame | 프레임 | 800 / 1600 | AF | 5 |
|  |  | breakingCapacity | 정격차단전류 | 50 (690Vac), Ics=100% | kA | 5 |
|  |  | ratedCurrent | 정격전류 | 400~1600 | A | 5 |
|  |  | shortTimeCurrent | 정격 단시간 전류 | 50 (1초) | kA | 5 |
| aw | AW type (AW-08·AW-16, Cat.B) (p.5) | frame | 프레임 | 800 / 1600 | AF | 5 |
|  |  | breakingCapacity | 정격차단전류 | 40 (800Vac), Ics=100% | kA | 5 |
|  |  | ratedCurrent | 정격전류 | 400~1600 | A | 5 |
|  |  | shortTimeCurrent | 정격 단시간 전류 | 40 (1초) | kA | 5 |
| ar | AR type (AR-08·AR-10, Cat.A) (p.5) | frame | 프레임 | 800 / 1000 | AF | 5 |
|  |  | breakingCapacity | 정격차단전류 | 150 (415Vac), Ics=100% | kA | 5 |
|  |  | ratedCurrent | 정격전류 | 400~1000 | A | 5 |

### P03078 UL Load Interrupter Switch

- 기기: 부하개폐기 / 자동고장구분개폐기
- 카탈로그: [[Susol LIS]Load Interrupter Switch](https://www.ls-electric.com/ko/cat/%5BSusol_LIS%5DLoad_Interrupter_Switch_EN_C050N2-14-202609.pdf) · 대표 p.4
- 비고: Ratings and configurations(p4) UME-05/15 표 기준 (HTTP Range로 필요한 페이지만 받아 추출). p2에는 제품군 범위 4.76~38kV로 기재 — 27/38kV급 정격 페이지는 받지 않음
- 검수 상태: 신규(Range) · 27/38kV급 미수록

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedCurrent | 정격전류 | 600 / 1200 (Rated normal current) | A | 4 |
| frequency | 정격주파수 | 60 | Hz | 4 |
| shortTimeCurrent | 정격 단시간 전류 | 25 / 38 (RMS Sym., 3 sec) | kA | 4 |
| mounting | 설치·인출 방식 | Enclosure NEMA 1 / NEMA 3R, Single / Duplex / Feeder |  | 4 |
| standards | 적용 규격 | IEEE C37.20.3, ANSI C37.57, CSA C22.2 No. 31 |  | 4 |

옵션 기준: **정격전압** (2개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| ume-05 | UME-05 (4.76kV) (p.4) | ratedVoltage | 정격전압 | 4.76 (Maximum rated voltage) | kV | 4 |
|  |  | powerFreqWithstand | 상용주파 내전압 | 19 (Dielectric strength) | kV | 4 |
|  |  | impulseWithstand | 뇌임펄스 내전압 | 60 | kV | 4 |
| ume-15 | UME-15 (15kV) (p.4) | ratedVoltage | 정격전압 | 15 (Maximum rated voltage) | kV | 4 |
|  |  | powerFreqWithstand | 상용주파 내전압 | 36 (Dielectric strength) | kV | 4 |
|  |  | impulseWithstand | 뇌임펄스 내전압 | 95 | kV | 4 |

### P02216 Susol UL VCB

- 기기: 진공차단기
- 카탈로그: [UL VCB](https://www.ls-electric.com/ko/cat/UL_VCB_EN_C050E2-13-202610.pdf) · 대표 p.10
- 비고: VCB Ratings 차트(p10) 기준 (HTTP Range로 필요한 페이지만 받아 추출). 전압별 Isc는 차트 행 순서로 읽음 — 정격전류와 전압·Isc 조합은 차트라 매핑하지 않음, 검수 필요
- 검수 상태: 신규(Range) · 차트 판독 검수 필요

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedCurrent | 정격전류 | 1200 / 2000 / 2500 / 2750 / 3000 / 4000 (차트 축 값) | A | 10 |
| standards | 적용 규격 | UL certified |  | 10 |

옵션 기준: **정격전압** (4개)

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 4-76kv | 4.76 kV (p.10) | ratedVoltage | 정격전압 | 4.76 | kV | 10 |
|  |  | breakingCapacity | 정격차단전류 | 25 / 31.5 / 40 / 50 (Isc) | kA | 10 |
|  |  | mounting | 설치·인출 방식 | UVL-05 / UVM-05 / UVH-05 (Fixed·Draw-out) |  | 10 |
| 15kv | 15 kV (p.10) | ratedVoltage | 정격전압 | 15 | kV | 10 |
|  |  | breakingCapacity | 정격차단전류 | 25 / 31.5 / 40 / 50 (Isc) | kA | 10 |
|  |  | mounting | 설치·인출 방식 | UVL-15 / UVM-15 / UVH-15 (Fixed·Draw-out) |  | 10 |
| 27kv | 27 kV (p.10) | ratedVoltage | 정격전압 | 27 | kV | 10 |
|  |  | breakingCapacity | 정격차단전류 | 25 / 31.5 / 40 (Isc) | kA | 10 |
|  |  | mounting | 설치·인출 방식 | UVM-27 / UVH-27 |  | 10 |
| 38kv | 38 kV (p.10) | ratedVoltage | 정격전압 | 38 | kV | 10 |
|  |  | breakingCapacity | 정격차단전류 | 31.5 / 40 (Isc) | kA | 10 |
|  |  | mounting | 설치·인출 방식 | UVH-38 |  | 10 |

## 추출 실패·건너뛴 제품

| 제품ID | 제품명 | 기기 | 사유 |
|---|---|---|---|
| P02207 | Susol UL ACB | 기중차단기 | 미시도(영문 카탈로그, 40MB 미만이나 우선순위 밖) |
| P01022 | Susol UL MCCB | 배선용차단기 | 미시도 |
| P03077 | Load Break Switch / Auto Section Switch | 부하개폐기 | docs.json에 문서 없음 |
| — | 고압 전자접촉기(VC)·전력퓨즈(PF)·ALTS 단독 제품·MMS·MCB/RCBO·고압 인버터·GIS·주변압기 | 각 기기 | products.json에 해당 카테고리 제품이 없거나 docs.json에 카탈로그/데이터시트 없음 (ALTS·LBS 카탈로그는 RMU(P03080) 문서로만 등록) |
| P01055 IMP, P01077 DPR1000, GIMAC-PQ/II Plus/DC/B 등 | — | 각 기기 | 기기당 2~3개 비교 목표를 채워 우선순위에서 제외 |
| P03085 USPB, P03086 USPC | 서지보호기 | 같은 카탈로그에 형명별 결선표만 있고 시리즈 정격표가 텍스트로 명확히 분리되지 않아 제외 |

## 2026-11-18 40MB 초과 카탈로그 — HTTP Range 추출

- 방식: HEAD로 8개 파일 모두 `Accept-Ranges: bytes` 확인 → pdf.js(pdfjs-dist 4.10.38, scratchpad 설치) `PDFDataRangeTransport` + `disableAutoFetch`·`disableStream`, 128KB 청크. 청크 요청은 직렬화하고 간격 1.25초, UA `LSE-ProductMap/0.1`, docs.json URL만. xref/trailer→목차→정격 페이지 순으로 필요한 페이지만 텍스트 추출. 받은 청크는 scratchpad에만 캐시(저장소에 PDF 없음). 파일당 요청 상한(MAXREQ)을 두어 이미지가 무거운 페이지에서 과다 요청 방지.
- 합계: Range 요청 455건(첫 시험 실행 9건 포함) + HEAD 8건, 받은 바이트 59,095,598 B(약 59MB, 8개 파일 전체 크기 약 562MB의 약 10.5%).

| 파일 | 제품 | Range 요청 | 받은 바이트 | 읽은 PDF 페이지 |
|---|---|---|---|---|
| [Susol ACB] | P00206 (교체) | 84 | 10,965,149 | 2~6, 18~19 |
| [Susol MCCB] | P01021 (교체) | 33 | 4,267,989 | 1~14 |
| [Susol VCB] | P01062 (교체) | 9 | 1,176,913 | 2~5 |
| [Metasol MCCB] | P01023 (신규) | 29 | 3,778,029 | 1~4, 22~26 |
| [Metasol ACB] | P01030 (신규) | 33 | 4,256,822 | 3~5, 18 |
| [Susol Compact ACB] | P02206 (신규) | 145 | 18,875,918 | 2~5 |
| [Susol LIS] | P03078 (신규) | 69 | 8,941,455 | 2~4 |
| UL VCB | P02216 (신규) | 53 | 6,833,323 | 2~4, 10~11 |

- 교체 내역: P00206·P01021·P01062는 변형 카탈로그(1150Vac판·1000Vac UTV판·VL 전동인출형판) 값에서 표준 카탈로그 값으로 교체. 제품당 출처 문서가 하나라 변형 값은 옵션으로 섞지 않고 note에 "이전 값은 ○○ 카탈로그"로 기록(변형 카탈로그는 docs.json에 별도 문서로 남아 있음).
- 한계: Susol MCCB는 정격표 페이지를 받지 않아 정격사용전압·극수 미기재. Metasol ACB는 AS형 상세 정격표 미수록. Susol LIS는 UME-05/15만(27/38kV 미수록). UL VCB는 개요 차트 기준.

## 신뢰도가 낮은 값 (위 '사람 검수 우선' 항목 포함)

1. **P02212 GIPAM1000 통신**: 정격표(p12)는 RS-485 Modbus만, 통신기능(p11)은 DNP3.0·MODBUS·IEC61850 — 옵션 재구성 때 p11 값으로 교체. (사람 검수 우선)
2. **P00206 Susol ACB**: 표준 카탈로그(p18~19)로 교체 완료 — AH-E/G 차단전류·단시간전류는 한 줄에 E·G 값이 번갈아 추출되어 짝지음.
3. **P01021 Susol MCCB**: 표준 카탈로그 개요(p5~7)로 교체 완료 — 정격사용전압·극수 미기재.
4. **P01062 Susol VCB**: 표준 카탈로그 라인업 표(p5)로 교체 — 전압별 제공 값 목록이며 조합별 정격 아님.
5. **P01261 Susol MC**: 이미지 판독값(텍스트 레이어 없음, T2 텍스트 대조 불가).
6. **P01260 Metasol MS**: 적용 전동기 용량은 대형 프레임 표 열 정렬이 불확실해 넣지 않음. 옵션(프레임)별 Ue는 기종일람표 p10~13 프레임 열에서 읽음.
7. **P01024 / P01028 분전반용**: ABE/EBE Fb 경제형 1개 시리즈만 대표값으로 사용.
8. **P01084 GIMAC-V**: APFC 정격표 값. (사람 검수 우선)
9. **P01109 유입변압기**: 전력용·배전용 값 혼재(항목 분리). T2 대조 일치.
10. **P01188 iS7**: IP 등급 요약 — T2 대조로 원문과 일치 확인. 전동기 용량은 중부하(CT) 기준(VT 기준 400V급 450kW)으로 값에 명시.
11. **P01065 발전소용 VCB**: 모델(40H/40J/50J)별 정격전류·차단전류 열 구분을 텍스트 순서와 형명으로 읽음. (사람 검수 우선)
12. **P01027 Metasol ELCB 125AF**: 정격전류 셀이 두 줄로 나뉘어 추출됨(같은 셀로 판단). 100AF 이상 정격차단전류는 열 정렬이 불명확해 넣지 않음.
13. **P02206 Susol Compact ACB AN형**: 그림 42kA vs 본문 50kA. (사람 검수 우선)
14. **P02216 Susol UL VCB**: 전압별 Isc를 차트 행 순서로 읽음. (사람 검수 우선)
15. **P01023 Metasol MCCB 100AF·125AF**: 두 프레임이 표 열을 공유해 한 옵션으로 묶고 형명 순서대로 적음.
16. **P01030 Metasol ACB**: AS형은 개요 페이지의 차단용량(500Vac)만, 정격전압·정격전류는 AN형만.

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

## 2026-11-18 옵션 구조 재구성 메모

- 옵션 분리 31개 제품, 옵션을 두지 않은 제품 4개: P01075 GIPAM115FI(단일 모델), P01084 GIMAC-V, P01079 GIMAC-IV, P01255 GIMAC1000(각각 단일 모델 정격표).
- 옵션 분리로 이전 페이지 정정 9건 중 범위 걸침 7건은 옵션별 페이지로 해소됨(P01021·P01260·P01045·P01188·P01183). P01260 규격 p10, P01110 "F종" p14 정정은 유지.
- 새 비표준 key: powerFreqWithstand(상용주파 내전압), impulseWithstand(뇌임펄스 내전압), impedance(임피던스), efficiency50(효율 (50% 부하)), weight(중량), tov(일시적 과전압(TOV)), maxDcVoltage(최대 허용 직류전압), pulseOutput(외부출력(펄스)), ip66Power(IP66/NEMA4X 적용 용량). 공통·옵션 항목 전체에서 key↔label 1:1 확인.
- 데이터 무결성 테스트(DI-93·94·95·96·97)는 공통 items만 검사하고 variants 항목은 검사하지 않음. DI-96(items 1~10)은 스키마(공통 items 빈 배열 허용)와 다름 — 현재 데이터는 모든 제품에 공통 항목을 1개 이상 두어 충돌하지 않음.

## 2026-11-19 추가분 — 빈 칸 보완 + 신규 제품 (미검수, reviewed: false)

- 계기: 제품 비교 화면 "정격 사양 — 카탈로그 표기 그대로" 칸이 비어 있는 곳이 많다는 사용자 지적(예: ACB 4종 비교 시 Susol UL ACB 전부 '—', Susol Compact ACB 정격전압·극수 '—', Metasol ACB 극수 '—').
- 결과: specs.json 40 → **81개 제품** (신규 41 · 기존 보완 3), 이번에 추가된 값 **450항목**(공통+옵션). 기존 값은 그대로 두고 추가·이동만 함(이동: Metasol ACB 정격전압 690V를 AN 옵션 → 공통, AS형도 같은 값이라).
- 방식은 위와 같음: docs.json 직링크만, UA `LSE-ProductMap/0.1`, 요청 간격 1.25~1.3초, 통계 API 호출 없음. 40MB 이하 파일은 전체 GET(43건 요청 · 34개 파일), 40MB 초과는 HEAD 13건 + HTTP Range 576건(약 74.8MB)으로 필요한 쪽만 받음. PDF·텍스트는 scratchpad에만 저장. 텍스트 추출: PyMuPDF(전체 파일), pdf.js(Range).
- 페이지 = PDF 페이지 번호. 값은 원문 표기 그대로(단위만 unit으로 분리). 원문에 없는 항목은 비워 둠.

### ACB 4종 결과

| 제품 | 정격전압 | 정격전류 | 정격차단전류 | 프레임 | 극수 |
|---|---|---|---|---|---|
| P00206 Susol ACB | 690 (기존) | 옵션별 (기존) | 옵션별 (기존) | 옵션별 (기존) | 3/4 (기존) |
| P02207 Susol UL ACB (신규) | 프레임별: C AC 800 / D 254·508·635 / E 254·508·635·847(UAW) / G 254·508·635 (p21·35·51·77) | 프레임별 | 프레임별 (UL489·UL1066) | 프레임별 | 3/4 (p21) |
| P02206 Susol Compact ACB | 형식별: AN·AH 690 / AR 500 (p9 주1) / AW ~800 (p13) — **신규** | 옵션별 (기존) | 옵션별 (기존) | 옵션별 (기존) | 3P/4P (p9) — **신규** |
| P01030 Metasol ACB | 690 (공통, p18~19) | AS형 4개 옵션 **신규** (p19) | 옵션별 (기존) | 옵션별 (기존) | 3/4 (p18) — **신규** |

- P02206 AN형 차단용량 검수 항목(p5 그림 42kA vs 본문 50kA): p9 정격표 AC 690V 행 AN-08C/16C = 42kA로 그림 값과 일치 확인 — 본문 50kA는 AH형 값. note 갱신.

### 요약

| 제품ID | 제품명 | 기기 | 카탈로그 | 대표 페이지 | 구분 | 추가 항목 수 |
|---|---|---|---|---|---|---|
| P01021 | Susol MCCB | 배선용차단기 (MCCB) | [Susol MCCB] | 6 | 보완 | 8 |
| P01030 | Metasol ACB | 기중차단기 (ACB) | [Metasol ACB] | 4 | 보완 | 8 |
| P02206 | Susol Compact ACB | 기중차단기 (ACB) | [Susol Compact ACB] | 5 | 보완 | 10 |
| P02207 | Susol UL ACB | 기중차단기 (ACB) | [Susol UL ACB] Catalog | 6 | 신규 | 24 |
| P01022 | Susol UL MCCB | 배선용차단기 (MCCB) | [Susol UL MCCB] | 7 | 신규 | 37 |
| EN-P00024 | BK/RK-Series MCB | MCB & CP | [MCB] MCB_RCD | 4 | 신규 | 18 |
| EN-P00025 | UL MCB | MCB & CP | [Device] Electric Product_UL type | 21 | 신규 | 11 |
| EN-P01260 | IEC Compact Susol DC Switch-Disconnector | DC Compact Switch-Disconnector | [DC Compact DSU] up to 1500Vdc | 9 | 신규 | 16 |
| EN-P01265 | UL Compact Susol DC Switch-Disconnector | DC Compact Switch-Disconnector | [DC Compact DSU] UL type | 6 | 신규 | 9 |
| EN-AAA016008 | DC UL Switch-Disconnector | DC UL Switch-Disconnector | [DC UL DSU] | 6 | 신규 | 7 |
| EN-P00037 | Metasol VCB | VCB | Metasol VCB | 22 | 신규 | 21 |
| EN-P00039 | Susol VCB for Special Purpose | VCB | [Susol VCB] for generator VCB | 3 | 신규 | 9 |
| EN-P00041 | Susol VCB for ANSI type | VCB | [Device] Electric Product_UL type | 56 | 신규 | 12 |
| P01055 | IMP | 전자식 모터보호 계전기 (EMPR) | [IMP] | 6 | 신규 | 6 |
| P01076 | GIPAM10 | 디지털 보호계전기 (Protection) | [GIPAM10] | 7 | 신규 | 8 |
| P01077 | DPR1000 | 디지털 보호계전기 (Protection) | [DPR1000] | 5 | 신규 | 8 |
| P01080 | GIMAC-PQ | 디지털 계측기 (Measurement) | [GIMAC-PQ] | 5 | 신규 | 7 |
| P01081 | GIMAC-II Plus | 디지털 계측기 (Measurement) | [GIMAC-II Plus] | 5 | 신규 | 8 |
| P01083 | GIMAC-DC | 디지털 계측기 (Measurement) | [GIMAC-DC] | 5 | 신규 | 6 |
| P21020 | IMD | 디지털 계측기 (Measurement) | [IMD] Catalog_국문 | 10 | 신규 | 6 |
| P02214 | DC Meter | 계량기 (Meter) | [DC Meter] Leaflet | 1 | 신규 | 6 |
| P01093 | SDC-500 | 계량기 (Meter) | [SDC-500] 사용설명서 | 4 | 신규 | 3 |
| P01215 | M100 | General | M100 카탈로그 | 2 | 신규 | 8 |
| P01262 | L100 | General | L100 카탈로그 | 12 | 신규 | 6 |
| P01187 | iG5A | General | iG5A 트러블슈팅(Troubleshooting) 사용설명서 | 9 | 신규 | 14 |
| P01190 | iV5 | General | iV5 뉴제어기 사용설명서 | 14 | 신규 | 10 |
| P01189 | iP5A | General | iP5A/iV5 RS485 Modbus RTU 통신 옵션 사용설명서 | 9 | 신규 | 11 |
| P01263 | S300 | General | S300 카탈로그 | 12 | 신규 | 9 |
| P01097 | MCSG | MV SWGR | [MCSG] | 7 | 신규 | 27 |
| P01098 | 특고압 일반배전반 | MV SWGR | [GSH-20V]_국문 | 4 | 신규 | 7 |
| P01100 | 고압 일반배전반 | MV SWGR | [GSM] 3.6/7.2kV 고압폐쇄배전반 | 4 | 신규 | 7 |
| P02203 | C-AIS | MV SWGR | [C-AIS] 국문 | 4 | 신규 | 7 |
| P02202 | DAIS | MV SWGR | [DAIS] 25.8kV | 6 | 신규 | 15 |
| P01101 | Susol LV SWGR | LV SWGR & MCC | [Susol LV SWGR] | 5 | 신규 | 9 |
| P01104 | GCC H/V/N | LV SWGR & MCC | [MCC] | 6 | 신규 | 8 |
| P01245 | Smart MCC | LV SWGR & MCC | [Smart MCC] | 13 | 신규 | 9 |
| P02204 | MDB | LV SWGR & MCC | Modular MDB | 6 | 신규 | 8 |
| P01102 | Power Center | LV SWGR & MCC | [Power Center] | 5 | 신규 | 7 |
| P01105 | Susol Busway | Busway System | [Susol Busway] | 6 | 신규 | 7 |
| P01106 | GH-P Type Busway | Busway System | [GH-P type Busway] | 6 | 신규 | 6 |
| P01910 | Susol Mini Busway | Busway System | [Susol Mini Busway] | 6 | 신규 | 7 |
| P01911 | NSPB | Busway System | [NSPB] | 6 | 신규 | 6 |
| D421413 | LV CTTS | LV CTTS (자료실 카탈로그) | LV CTTS 카탈로그 | 5 | 신규 | 8 |
| D420271 | MV CTTS | MV CTTS (자료실 카탈로그) | MV CTTS 카탈로그 | 5 | 신규 | 6 |
### 검수 우선 (이번 추가분)

1. **P02207 Susol UL ACB C-Frame 차단전류** — UL489 표 UAN/UAS 열을 텍스트 순서로 읽음(p21).
2. **P01101 Susol LV SWGR 정격전류·임펄스** — Main/Feeder/MCC 열 구분을 텍스트 순서로 읽음(p5).
3. **P01104 MCC(GCC H/V/N) 수평모선 정격전류** — 원문 행 이름이 "정격전압"으로 인쇄된 행의 600~2000A/600~3500A/600~4000A를 GCC-H/V/N 순서로 읽음(p6).
4. **P01911 NSPB 정격전류·단시간전류** — 전압 등급별 열을 묶어 적음(p6), 열 매핑 미확정.
5. **EN-P00024 BK/RK MCB BKJ63N·BKJ63Nd** — 표 한 열을 공유(p4).
6. **EN-P00037 Metasol VCB 12kV** — 표 두 번째 열 머리글이 MVL–17로 인쇄(p23).
7. **EN-AAA016008 DC UL DSU 단락 내전류 85/100kA** — D/E 프레임 순서로 읽음(p6).
8. **P01215 M100 정격전류(출력) 0.8~10.0A** — 모델별 표 값을 순서대로 읽음(p2).

### 새 비표준 key

- `monitorRange`(절연 감시 범위) — P21020 IMD
- `withstandCurrent`(단락 내전류) — EN-AAA016008 DC UL DSU ("Short circuit withstand current", Icw와 표기가 달라 따로 둠)

### 이번에 채우지 못한 제품·항목

| 제품ID | 제품명 | 사유 |
|---|---|---|
| P01022 Susol UL MCCB | (정격전압만) | 카탈로그에 정격(사용)전압 단독 표기 없음 — 차단전류 표의 240/480/600V 열만 있어 비워 둠 |
| P01027 Metasol ELCB | 정격전압, 100AF 이상 차단전류 | 리플렛에 정격전압 항목 없음 / 100·125AF 열 정렬 불명확(기존 판단 유지) |
| P01043 Mini MS | 정격전압, 극수 | 카탈로그 기종일람 텍스트에서 명확한 표기 못 찾음 |
| P01062 Susol VCB 등 VCB | 프레임, 극수 | VCB 카탈로그에 해당 항목 표기 없음(해당 없음) |
| P01214 GIMAC-B | 전체 | 카탈로그 PDF 154MB, 이미지가 무거워 Range로도 2쪽 읽는 데 40회 초과 요청 → 중단 |
| EN-P00051 GIPAM2000, EN-P00062 GIMAC-i | 전체 | 등록된 [Device] Digital Protection_Measurement_EN 카탈로그(280쪽) 목차(p3)에 해당 제품이 없음 |
| P01103 Solution 2000 MCC | 전체 | PDF 글꼴 인코딩이 깨져 텍스트 추출 불가 |
| P01087 TWS | 전체 | 카탈로그 내용이 Panel PC(XPC) 사양 — 전력기기 정격 아님 |
| P03085 USPB, P03086 USPC | 전체 | 기존 판단 유지(형명별 결선표만 있고 시리즈 정격표 분리 안 됨) |
| EN-P00003 SIS, EN-P00009 Solution Power MCC, EN-P01811 LS EK60, EN-AAA010002 Mobile Substation, EN-AAA012001/012002 ESS, P01202 Drive Panel | 전체 | 시스템·솔루션 카탈로그라 이번 범위에서 제외 |
| PLC·서보·HMI·감속기·SSQ 제품 | 전체 | 전력계통 기기가 아니라 제외 |

### 제품별 추가 항목 (보완 제품은 이번에 더한 값만)

#### P01021 Susol MCCB (보완)

- 카탈로그: [[Susol MCCB]](https://www.ls-electric.com/ko/cat/%5BSusol_MCCB%5D_KO_C01091-24-202509.pdf) · 대표 p.6
- 비고: 표준 [Susol MCCB] 카탈로그 개요(p5~7)와 전기적특성 표(p36~37 TD100~TS800, p132 TS1600) 기준 (HTTP Range로 필요한 페이지만 받아 추출). 차단용량은 Ics=100% Icu, 415Vac 기준(p6). 정격전압 AC 690V·정격절연전압 1000V·임펄스 8kV는 전 프레임 공통(p36~37, p132). 이전 값은 [Susol MCCB] Up to 1000Vac 카탈로그(UTV250/400)였음

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 690 (Ue, AC) | V | 36 |
| insulationVoltage | 정격절연전압 | 1000 | V | 36 |
| impulseVoltage | 정격임펄스내전압 | 8 | kV | 36 |

옵션 기준: **시리즈·프레임**

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| td100-160 | TD100/160 | poles | 극수 | 2, 3, 4 | P | 36 |
| ts100-250 | TS100/160/250 | poles | 극수 | 2, 3, 4 | P | 36 |
| ts400-630 | TS400/630 | poles | 극수 | 2, 3, 4 | P | 37 |
| ts800 | TS800 | poles | 극수 | 2, 3, 4 | P | 37 |
| ts1600 | TS1600 | poles | 극수 | 3, 4 | P | 132 |


#### P01030 Metasol ACB (보완)

- 카탈로그: [[Metasol ACB]](https://www.ls-electric.com/ko/cat/%5BMetasol_ACB%5D_KO_C06091-28-202607.pdf) · 대표 p.4
- 비고: Overview(p3~5) 기종별 차단용량(Icu=Ics, 500Vac)과 정격표(p18 AN형, p19 AS형) 기준 (HTTP Range로 필요한 페이지만 받아 추출). 정격사용전압 690V·정격절연전압 1000V·주파수 50/60Hz·극수 3/4P는 AN·AS 전 기종 공통(p18~19). AS-F 정격전류는 AS-40F·50F 열을 합침

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 690 (Ue) | V | 18 |
| insulationVoltage | 정격절연전압 | 1000 | V | 18 |
| frequency | 정격주파수 | 50/60 | Hz | 18 |
| poles | 극수 | 3/4 | P | 18 |

옵션 기준: **형식·프레임**

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| as-d | AS-06~20D | ratedCurrent | 정격전류 | 200~2000 (In max) | A | 19 |
| as-e | AS-20~40E | ratedCurrent | 정격전류 | 200~4000 (In max) | A | 19 |
| as-f | AS-50F | ratedCurrent | 정격전류 | 2000~5000 (In max) | A | 19 |
| as-g | AS-40~63G | ratedCurrent | 정격전류 | 2000~6300 (In max) | A | 19 |


#### P02206 Susol Compact ACB (보완)

- 카탈로그: [[Susol Compact ACB]](https://www.ls-electric.com/ko/cat/%5BSusol_Compact_ACB%5D_KO_C06001-04-202201.pdf) · 대표 p.5
- 비고: 주요특징(p5)·정격표(p9 AN/AH/AR, p13 AW) 기준 (HTTP Range로 필요한 페이지만 받아 추출). 정격사용전압은 p9 공통사항 "690V" 의 주1) "AN, AH 유형에서 690V, AR 유형에서 500V" 에 따라 형식별로 나눔. AW 정격표(p13)에는 주파수 표기 없음. AN형 차단용량: p9 정격표 AC 690V 행 AN 42kA로 p5 그림값(42kA)과 일치 — 본문 "Cat.B(AH, AN형) 50kA/690Vac" 는 AH형 값

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| poles | 극수 | 3P/4P | P | 9 |
| insulationVoltage | 정격절연전압 | 1000 | V | 9 |
| impulseVoltage | 정격임펄스내전압 | 12 | kV | 9 |

옵션 기준: **형식**

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| an | AN type (AN-08·AN-16, Cat.B) | ratedVoltage | 정격전압 | 690 (Ue) | V | 9 |
|  |  | frequency | 정격주파수 | 50/60 | Hz | 9 |
| ah | AH type (AH-08·AH-16, Cat.B) | ratedVoltage | 정격전압 | 690 (Ue) | V | 9 |
|  |  | frequency | 정격주파수 | 50/60 | Hz | 9 |
| aw | AW type (AW-08·AW-16, Cat.B) | ratedVoltage | 정격전압 | ~ 800 (Ue) | Vac | 13 |
| ar | AR type (AR-08·AR-10, Cat.A) | ratedVoltage | 정격전압 | 500 (Ue) | V | 9 |
|  |  | frequency | 정격주파수 | 50/60 | Hz | 9 |


#### P02207 Susol UL ACB (신규)

- 카탈로그: [[Susol UL ACB] Catalog](https://www.ls-electric.com/ko/cat/%5BSusol_UL_ACB%5D_EN_C06072-27-202608.pdf) · 대표 p.6
- 비고: 영문 카탈로그 Overview(p4)·Ratings overview(p6)와 프레임별 Rating 표(p21 C, p35 D, p51 E, p77 G) 기준 (HTTP Range로 필요한 페이지만 받아 추출). C-Frame은 UL 489(MCCB형) 정격으로 "Rated operational voltage", D/E/G-Frame은 UL 1066 정격으로 "Rated maximum voltage". C-Frame 차단전류는 표 열(UAN/UAS)을 텍스트 순서로 읽음 — 검수 필요. 정격전류는 Rating plug 최소~최대

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| frequency | 정격주파수 | 50/60 | Hz | 6 |
| poles | 극수 | 3/4 | P | 21 |
| mounting | 설치·인출 방식 | Draw-out type / Fixed type |  | 6 |
| standards | 적용 규격 | UL 489 (C-Frame), UL 1066 / ANSI C37.13 (D/E/G-Frame) |  | 4 |

옵션 기준: **프레임**

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| c-frame | C-Frame (UAN/UAS-08·12C) | frame | 프레임 | 800 / 1200 | AF | 21 |
|  |  | ratedVoltage | 정격전압 | AC 800 (Rated operational voltage) | V | 21 |
|  |  | ratedCurrent | 정격전류 | 400~1200 (In Max.) | A | 21 |
|  |  | breakingCapacity | 정격차단전류 | UAN 42 (600V) / 50 (480V) / 50 (240V), UAS 42 (800V) / 50 (600V) / 65 (480V) / 65 (240V) (UL489) | kA | 21 |
|  |  | shortTimeCurrent | 정격 단시간 전류 | 42 | kA | 21 |
| d-frame | D-Frame (UAS-08·16D) | frame | 프레임 | 800 / 1600 | AF | 35 |
|  |  | ratedVoltage | 정격전압 | 254/508/635 (Rated maximum voltage) | V | 35 |
|  |  | ratedCurrent | 정격전류 | 400~1600 | A | 35 |
|  |  | breakingCapacity | 정격차단전류 | 65 (635V) / 85 (508V) / 85 (254V) (Sym., with instantaneous) | kA | 35 |
|  |  | shortTimeCurrent | 정격 단시간 전류 | 65 | kA | 35 |
| e-frame | E-Frame (UAH/UAW-08~40E) | frame | 프레임 | 800/1600/2000/2500/3200/4000 | AF | 51 |
|  |  | ratedVoltage | 정격전압 | 254/508/635/847 (UAW) (Rated maximum voltage) | V | 51 |
|  |  | ratedCurrent | 정격전류 | 400~4000 | A | 51 |
|  |  | breakingCapacity | 정격차단전류 | 85 (847V) / 85 (635V) / 100 (508V) / 100 (254V) (Sym., with instantaneous) | kA | 51 |
|  |  | shortTimeCurrent | 정격 단시간 전류 | 85 | kA | 51 |
| g-frame | G-Frame (UAH-32~60G) | frame | 프레임 | 3200/4000/5000/6000 | AF | 77 |
|  |  | ratedVoltage | 정격전압 | 254/ 508/ 635 (Rated maximum voltage) | V | 77 |
|  |  | ratedCurrent | 정격전류 | 1600~6000 | A | 77 |
|  |  | breakingCapacity | 정격차단전류 | 100 (635V) / 130 (508V) / 130 (254V) (Sym., with instantaneous) | kA | 77 |
|  |  | shortTimeCurrent | 정격 단시간 전류 | 100 | kA | 77 |


#### P01022 Susol UL MCCB (신규)

- 카탈로그: [[Susol UL MCCB]](https://www.ls-electric.com/ko/cat/%5BSusol_UL_MCCB%5D_KO_C01081-17-202607.pdf) · 대표 p.7
- 비고: 국문 [Susol UL MCCB] 카탈로그 개요(p5~7)와 프레임별 MCCB 선정 표(p15·20·27·34·41·55·61, UL489 기준 정격) 기준 (HTTP Range로 필요한 페이지만 받아 추출). 정격전류는 p5 프레임별 범위. 차단전류는 UL489 AC 50/60Hz 표의 480V·600V 열. 카탈로그에 정격(사용)전압 단독 표기는 없어 비워 둠

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| standards | 적용 규격 | UL489, CSA, IEC60947-2 |  | 7 |
| protection | 보호 기능 | ATU, FMU, FTU (열동전자식), ETS, ETM (전자식), OCR (전자식 트립릴레이) |  | 7 |

옵션 기준: **프레임**

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| ute100 | UTE100 | frame | 프레임 | 100 | AF | 14 |
|  |  | ratedCurrent | 정격전류 | 15-100 | A | 5 |
|  |  | poles | 극수 | 2, 3 | P | 15 |
|  |  | breakingCapacity | 정격차단전류 | 25 / 35 / 65 (480V, E/N/H), 14 / 18 / 35 (600Y/347V) (UL489) | kA | 15 |
|  |  | insulationVoltage | 정격절연전압 | 750 (Ui) | Vac | 15 |
| uts150 | UTS150 | frame | 프레임 | 150 | AF | 19 |
|  |  | ratedCurrent | 정격전류 | 40-150 | A | 5 |
|  |  | poles | 극수 | 2, 3 | P | 20 |
|  |  | breakingCapacity | 정격차단전류 | 35 / 65 / 100 (480V, N/H/L), 18 / 35 / 50 (600V) (UL489) | kA | 20 |
|  |  | insulationVoltage | 정격절연전압 | 750 (Ui) | V | 20 |
| uts250 | UTS250 | frame | 프레임 | 250 | AF | 26 |
|  |  | ratedCurrent | 정격전류 | 150-250 | A | 5 |
|  |  | poles | 극수 | 2, 3 | P | 27 |
|  |  | breakingCapacity | 정격차단전류 | 35 / 65 / 100 (480V, N/H/L), 18 / 35 / 50 (600V) (UL489) | kA | 27 |
|  |  | insulationVoltage | 정격절연전압 | 750 (Ui) | V | 27 |
| uts400 | UTS400 | frame | 프레임 | 400 | AF | 33 |
|  |  | ratedCurrent | 정격전류 | 250-400 | A | 5 |
|  |  | poles | 극수 | 2, 3 | P | 34 |
|  |  | breakingCapacity | 정격차단전류 | 35 / 65 / 100 (480V, N/H/L), 18 / 35 / 50 (600V) (UL489) | kA | 34 |
|  |  | insulationVoltage | 정격절연전압 | 750 (Ui) | VAC | 34 |
| uts600 | UTS600 | frame | 프레임 | 600 | AF | 40 |
|  |  | ratedCurrent | 정격전류 | 500-600 | A | 5 |
|  |  | poles | 극수 | 2, 3 | P | 41 |
|  |  | breakingCapacity | 정격차단전류 | 35 / 65 / 100 (480V, N/H/L), 18 / 35 / 50 (600V) (UL489) | kA | 41 |
|  |  | insulationVoltage | 정격절연전압 | 750 (Ui) | V | 41 |
| uts800 | UTS800 | frame | 프레임 | 800 | AF | 54 |
|  |  | ratedCurrent | 정격전류 | 400-800 | A | 5 |
|  |  | poles | 극수 | 3 | P | 55 |
|  |  | breakingCapacity | 정격차단전류 | 35 / 65 / 100 (480V, N/H/L), 18 / 35 / 50 (600V) (UL489) | kA | 55 |
|  |  | insulationVoltage | 정격절연전압 | 1000 (Ui) | V | 55 |
| uts1200 | UTS1200 | frame | 프레임 | 1200 | AF | 60 |
|  |  | ratedCurrent | 정격전류 | 800-1200 | A | 5 |
|  |  | poles | 극수 | 3 | P | 61 |
|  |  | breakingCapacity | 정격차단전류 | 35 / 65 / 50 / 100 (480V, N/H/P/L), 18 / 25 / 50 / 35 (600V) (UL489) | kA | 61 |
|  |  | insulationVoltage | 정격절연전압 | 1000 (Ui) | V | 61 |


#### EN-P00024 BK/RK-Series MCB (신규)

- 카탈로그: [[MCB] MCB_RCD](https://www.ls-electric.com/ko/cat/%5BMCB%5D_MCB_RCD_EN_C01502-50-202609.pdf) · 대표 p.4
- 비고: [MCB] MCB_RCD 영문 카탈로그 MCB 개요 표(p4~5) 기준, 대표 MCB 형식만(RK 계열 RCBO·BF·BS 형식 제외). BKJ63N·BKJ63Nd는 표에서 한 열을 공유해 한 옵션으로 묶음 — 열 구분 검수 필요

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| protection | 보호 기능 | Overload and short circuit |  | 4 |
| mounting | 설치·인출 방식 | On 35mm DIN rail |  | 4 |

옵션 기준: **형식**

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| bkj63n | BKJ63N / BKJ63Nd | ratedCurrent | 정격전류 | 1, 2, 3, 4, 6, 10, 13, 16, 20, 25, 32, 40, 50, 63 | A | 4 |
|  |  | poles | 극수 | 1P, 1P+N, 2P, 3P, 3P+N, 4P |  | 4 |
|  |  | breakingCapacity | 정격차단전류 | 6 at 240/415VAC (1pole), 6 at 415VAC (2~4pole) | kA | 4 |
|  |  | standards | 적용 규격 | IEC 60898-1, IEC 60947-2 |  | 4 |
| bkn-b | BKN-b | ratedCurrent | 정격전류 | 1, 2, 3, 4, 6, 10, 16, 20, 25, 32, 40, 50, 63 | A | 4 |
|  |  | poles | 극수 | 1P, 1P+N, 2P, 3P, 3P+N, 4P |  | 4 |
|  |  | breakingCapacity | 정격차단전류 | 10 at 240/415VAC (1pole), 10 at 415VAC (2~4pole) | kA | 4 |
|  |  | standards | 적용 규격 | IEC 60898-1, IEC 60947-2 |  | 4 |
| bkh | BKH | ratedCurrent | 정격전류 | 63, 80, 100, 125 | A | 5 |
|  |  | poles | 극수 | 1P, 2P, 3P, 3P+N, 4P |  | 5 |
|  |  | breakingCapacity | 정격차단전류 | 10 at 230VAC (1pole), 10 at 400VAC (2~4pole) | kA | 5 |
|  |  | standards | 적용 규격 | IEC 60947-2 |  | 5 |
| bkp | BKP | ratedCurrent | 정격전류 | 3, 6, 10, 16, 20, 25, 32 | A | 5 |
|  |  | poles | 극수 | 1P+N |  | 5 |
|  |  | breakingCapacity | 정격차단전류 | 4.5 at 230VAC | kA | 5 |
|  |  | standards | 적용 규격 | IEC 60898-1 |  | 5 |


#### EN-P00025 UL MCB (신규)

- 카탈로그: [[Device] Electric Product_UL type](https://www.ls-electric.com/ko/cat/%5BDevice%5D_Electric_Product_Leaflet_UL_EN_C19922-16-202507.pdf) · 대표 p.21
- 비고: [Device] Electric Product_UL type 영문 리플렛 UL MCB Ratings(p21) 기준. 30~63A 정격의 AC 차단용량과 DC 차단용량은 생략(원문 p21 참조)

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedCurrent | 정격전류 | 1, 2, 3, 4, 5, 6, 8, 10, 15, 16, 20, 25, 30, 32, 40, 50, 63 | A | 21 |
| frequency | 정격주파수 | 50/60 | Hz | 21 |
| protection | 보호 기능 | Overload, Short circuit |  | 21 |
| mounting | 설치·인출 방식 | Mounting on 35 mm Din rail |  | 21 |
| ipRating | 보호등급(IP) | IP20 |  | 21 |

옵션 기준: **규격**

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| ul489 | UL489 MCB (BK63HU) | poles | 극수 | 1P, 2P, 3P |  | 21 |
|  |  | breakingCapacity | 정격차단전류 | AC 1P: 10 @ 120/240 VAC, 10 @ 277 VAC (1 - 25 A); 2 - 3P: 10 @ 240 VAC, 480 Y/277 VAC (1 - 25 A) | kA | 21 |
|  |  | standards | 적용 규격 | UL489, UL486E(Lug) |  | 21 |
| ul1077 | UL1077 MCB (BK63H-UL) | poles | 극수 | 1P, 2P, 3P, 4P |  | 21 |
|  |  | breakingCapacity | 정격차단전류 | AC 1P: 10 @ 120/240 VAC, 6 @ 277 VAC; 2 - 4P: 10 @ 120/240 VAC, 6 @ 480 Y/277 VAC | kA | 21 |
|  |  | standards | 적용 규격 | UL 1077 |  | 21 |


#### EN-P01260 IEC Compact Susol DC Switch-Disconnector (신규)

- 카탈로그: [[DC Compact DSU] up to 1500Vdc](https://www.ls-electric.com/ko/cat/%5BDC_Compact_DSU%5D_up_to_1500Vdc_EN_C06012-01-202405.pdf) · 대표 p.9
- 비고: 영문 [DC Compact DSU] up to 1500Vdc 카탈로그 Switch-disconnectors ratings(p9) 기준 (HTTP Range로 필요한 페이지만 받아 추출)

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| insulationVoltage | 정격절연전압 | 1500 (Ui) | V | 9 |
| impulseVoltage | 정격임펄스내전압 | 12 (Uimp) | kV | 9 |
| frame | 프레임 | 800/1000/1250/1600 | AF | 9 |
| shortTimeCurrent | 정격 단시간 전류 | 50 (Icw, DC) | kA/1s | 9 |

옵션 기준: **형식**

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| ddh | DDH (3·4P) | ratedVoltage | 정격전압 | 750V DC (3P), 1200V DC (4P) (Ue) |  | 9 |
|  |  | poles | 극수 | 3, 4 | P | 9 |
|  |  | mounting | 설치·인출 방식 | Fixed / Draw-out |  | 9 |
|  |  | standards | 적용 규격 | IEC 60947-3 (DEKRA CB certification), GB 14048.3 (CCC certification) |  | 9 |
| ddv-2p | DDV (2P) | ratedVoltage | 정격전압 | 750V DC (2P) (Ue) |  | 9 |
|  |  | poles | 극수 | 2 | P | 9 |
|  |  | mounting | 설치·인출 방식 | Fixed |  | 9 |
|  |  | standards | 적용 규격 | IEC 60947-3 |  | 9 |
| ddv | DDV (3·4P) | ratedVoltage | 정격전압 | 1000V DC (3P), 1500V DC (4P) (Ue) |  | 9 |
|  |  | poles | 극수 | 3, 4 | P | 9 |
|  |  | mounting | 설치·인출 방식 | Fixed / Draw-out |  | 9 |
|  |  | standards | 적용 규격 | IEC 60947-3 (DEKRA CB certification), GB 14048.3 (CCC certification) |  | 9 |


#### EN-P01265 UL Compact Susol DC Switch-Disconnector (신규)

- 카탈로그: [[DC Compact DSU] UL type](https://www.ls-electric.com/ko/cat/%5BDC_Compact_DSU%5D_UL_type_EN_C060A2-04-202512.pdf) · 대표 p.6
- 비고: 영문 [DC Compact DSU] UL type 카탈로그 Ratings(p6) 기준 (HTTP Range로 필요한 페이지만 받아 추출). UDA-16C는 UL 489B만 인증(원문 주)

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | DC 1000V (3P), DC 1500V (4P) (Ue) |  | 6 |
| insulationVoltage | 정격절연전압 | 1500 (Ui) | V | 6 |
| impulseVoltage | 정격임펄스내전압 | 12 (Uimp) | kV | 6 |
| poles | 극수 | 3, 4 | P | 6 |
| frame | 프레임 | 800/1000/1200/1600 | AF | 6 |
| breakingCapacity | 정격차단전류 | 8 / 10 / 12 / 12 (Interrupting rating, DC, L/R=8ms, 800/1000/1200/1600AF) | kA | 6 |
| shortTimeCurrent | 정격 단시간 전류 | 50 (Icw, DC) | kA/1s | 6 |
| mounting | 설치·인출 방식 | Fixed type / Draw-out type |  | 6 |
| standards | 적용 규격 | UL 489B (PV system), UL489F (ESS system) |  | 6 |


#### EN-AAA016008 DC UL Switch-Disconnector (신규)

- 카탈로그: [[DC UL DSU]](https://www.ls-electric.com/ko/cat/%5BDC_UL_DSU%5D_EN_C06032-05-202512.pdf) · 대표 p.6
- 비고: 영문 [DC UL DSU] 카탈로그 개요(p3)·Ratings(p6) 기준. 단락 내전류 85/100kA는 D/E 프레임 열 순서로 읽음

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | DC 1250 V (4P) / DC 800 V (3P) (Rated nominal voltage), DC 1500 V (4P) / DC 1000 V (3P) (Rated maximum voltage) |  | 6 |
| poles | 극수 | 4P / 3P |  | 6 |
| frame | 프레임 | 800~2500 (D) / 800~4000 (E) | AF | 6 |
| ratedCurrent | 정격전류 | 2500 / 4000 | A | 3 |
| withstandCurrent | 단락 내전류 | 85 / 100 (Short circuit withstand current, D/E) | kA | 6 |
| mounting | 설치·인출 방식 | Fixed / Draw-out |  | 6 |
| standards | 적용 규격 | UL 489B, UL 489F |  | 6 |


#### EN-P00037 Metasol VCB (신규)

- 카탈로그: [Metasol VCB](https://www.ls-electric.com/ko/cat/%5BMetasol_VCB%5D_EN_C050B2-01-202210.pdf) · 대표 p.22
- 비고: 영문 Metasol VCB 카탈로그 Ratings(p22~24) 기준 (HTTP Range로 필요한 페이지만 받아 추출). 12kV 표 두 번째 열 머리글이 "MVL–17□32"로 인쇄돼 있으나 Rated voltage 12kV 표로 읽음 — 검수 필요

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| frequency | 정격주파수 | 50 / 60 | Hz | 22 |
| insulation | 절연·냉각 방식 | VI (Vacuum Interrupter) |  | 2 |
| standards | 적용 규격 | IEC 62271-100 |  | 22 |

옵션 기준: **정격전압**

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 7-2kv | 7.2 kV (MVL-06) | ratedVoltage | 정격전압 | 7.2 (Ur) | kV | 22 |
|  |  | ratedCurrent | 정격전류 | 630, 1250 | A | 22 |
|  |  | breakingCapacity | 정격차단전류 | 20, 25, 31.5 (Ik) | kA | 22 |
|  |  | shortTimeCurrent | 정격 단시간 전류 | 20/4 sec, 25/4 sec, 31.5/4 sec | kA | 22 |
|  |  | powerFreqWithstand | 상용주파 내전압 | 20 (1 min) | kV | 22 |
|  |  | impulseWithstand | 뇌임펄스 내전압 | 60 | kV | 22 |
| 12kv | 12 kV (MVL-12) | ratedVoltage | 정격전압 | 12 (Ur) | kV | 23 |
|  |  | ratedCurrent | 정격전류 | 630, 1000, 1250 | A | 23 |
|  |  | breakingCapacity | 정격차단전류 | 16, 20, 25, 31.5 (Ik) | kA | 23 |
|  |  | shortTimeCurrent | 정격 단시간 전류 | 16/4 sec, 20/4 sec, 25/4 sec, 31.5/4 sec | kA | 23 |
|  |  | powerFreqWithstand | 상용주파 내전압 | 28 (1 min) | kV | 23 |
|  |  | impulseWithstand | 뇌임펄스 내전압 | 75 | kV | 23 |
| 17-5kv | 17.5 kV (MVL-17) | ratedVoltage | 정격전압 | 17.5 (Ur) | kV | 24 |
|  |  | ratedCurrent | 정격전류 | 630, 1000, 1250 | A | 24 |
|  |  | breakingCapacity | 정격차단전류 | 16, 20, 25, 31.5 (Ik) | kA | 24 |
|  |  | shortTimeCurrent | 정격 단시간 전류 | 16/4 sec, 20/4 sec, 25/4 sec, 31.5/4 sec | kA | 24 |
|  |  | powerFreqWithstand | 상용주파 내전압 | 38 (1 min) | kV | 24 |
|  |  | impulseWithstand | 뇌임펄스 내전압 | 95 | kV | 24 |


#### EN-P00039 Susol VCB for Special Purpose (신규)

- 카탈로그: [[Susol VCB] for generator VCB](https://www.ls-electric.com/ko/cat/%5BSusol_VCB%5D_for_Generator_EN_C050H2-03-202610.pdf) · 대표 p.3
- 비고: 특수목적 VCB 카탈로그 3종 중 [Susol VCB] for generator VCB(발전기용, VH-17) Ratings(p3) 기준. Side Mount·Retrofit 카탈로그 값은 넣지 않음

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 17.5 (Ur) | kV | 3 |
| ratedCurrent | 정격전류 | 5000 (P Type, Fixed) / 4000 (H Type, Withdrawable) | A | 3 |
| frequency | 정격주파수 | 50/60 | Hz | 3 |
| breakingCapacity | 정격차단전류 | 50 (Ik) | kA | 3 |
| shortTimeCurrent | 정격 단시간 전류 | 50 kA/4 s |  | 3 |
| powerFreqWithstand | 상용주파 내전압 | 50 | kV | 3 |
| impulseWithstand | 뇌임펄스 내전압 | 110 | kV | 3 |
| mounting | 설치·인출 방식 | P Type (Fixed) / H Type (Withdrawable) |  | 3 |
| standards | 적용 규격 | IEC/IEEE 62271-37-013:2015 |  | 3 |


#### EN-P00041 Susol VCB for ANSI type (신규)

- 카탈로그: [[Device] Electric Product_UL type](https://www.ls-electric.com/ko/cat/%5BDevice%5D_Electric_Product_Leaflet_UL_EN_C19922-16-202507.pdf) · 대표 p.56
- 비고: [Device] Electric Product_UL type 영문 리플렛 UVL Series 정격표(p56) 기준. 같은 쪽 차트에 UVM/UVH 포함 4.76·15·27·38kV, 25~50kA, 1200~4000A 라인업(UVH-38은 ANSI type test) — 차트 값은 넣지 않음

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| frequency | 정격주파수 | 50/60 | Hz | 56 |
| shortTimeCurrent | 정격 단시간 전류 | 25, 31.5 (3 sec) | kA | 56 |

옵션 기준: **형식**

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| uvl-05 | UVL-05 (4.76 kV) | ratedVoltage | 정격전압 | 4.76 (Ur) | kV | 56 |
|  |  | breakingCapacity | 정격차단전류 | 25, 31.5 (Isc) | kA | 56 |
|  |  | ratedCurrent | 정격전류 | 1200, 2000 | A | 56 |
|  |  | powerFreqWithstand | 상용주파 내전압 | 19 (1min) | kV | 56 |
|  |  | impulseWithstand | 뇌임펄스 내전압 | 60 | kV | 56 |
| uvl-15 | UVL-15 (15 kV) | ratedVoltage | 정격전압 | 15 (Ur) | kV | 56 |
|  |  | breakingCapacity | 정격차단전류 | 25, 31.5 (Isc) | kA | 56 |
|  |  | ratedCurrent | 정격전류 | 1200, 2000 | A | 56 |
|  |  | powerFreqWithstand | 상용주파 내전압 | 36 (1min) | kV | 56 |
|  |  | impulseWithstand | 뇌임펄스 내전압 | 95 | kV | 56 |


#### P01055 IMP (신규)

- 카탈로그: [[IMP]](https://www.ls-electric.com/ko/cat/%5BIMP%5D_KO_C15051-04-202409.pdf) · 대표 p.6
- 비고: 정격 및 형명체계(p6) 기준. 1000V 이하 저압 모터보호용(원문 주3)

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| protection | 보호 기능 | 과전류, 구속, 결상, 불평형, 역상, 부족전류, 지락, 순시단락 |  | 6 |
| communication | 통신 | 4~20mA출력, Modbus/RS-485 (형명 선택) |  | 6 |
| auxPower | 제어전원 | AC/DC 85~245V (50Hz/60Hz), AC/DC24~36V (형명 선택) |  | 6 |
| mounting | 설치·인출 방식 | 관통형, 표시창 분리 설치 가능, 35mm Din Rail/나사 설치 |  | 6 |

옵션 기준: **정격전류**

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 10 | 10 (0.5~10A) | ratedCurrent | 정격전류 | 0.5~10 | A | 6 |
| 100 | 100 (5~100A) | ratedCurrent | 정격전류 | 5~100 | A | 6 |


#### P01076 GIPAM10 (신규)

- 카탈로그: [[GIPAM10]](https://www.ls-electric.com/ko/cat/%5BGIPAM10%5D_KO_C16011-03-202304.pdf) · 대표 p.7
- 비고: 정격 및 특성(p7)·형명체계(p15) 기준

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 110 (PT), 190 (GPT) | V | 7 |
| ratedCurrent | 정격전류 | CT 5A, 1A / ZCT 1.5mA |  | 7 |
| frequency | 정격주파수 | 60, 50 | Hz | 7 |
| wiring | 결선방식 | 3P3W, 3P4W |  | 7 |
| auxPower | 제어전원 | AC/DC 110V, 220V |  | 7 |
| protection | 보호 기능 | CU: 50/51, 50N/51N, 46 · CR: 50/51, 50N/51N, 46, 79 · VO: 27, 59, 47P, 64 · NZ: 67N, 67G, 64 |  | 15 |
| communication | 통신 | RS485 : Modbus |  | 7 |
| standards | 적용 규격 | KEMC 1120, IEC60255 |  | 7 |


#### P01077 DPR1000 (신규)

- 카탈로그: [[DPR1000]](https://www.ls-electric.com/ko/cat/%5BDPR1000%5D_KO_C160F1-01-202304.pdf) · 대표 p.5
- 비고: 기능 및 정격(p5) 기준. 정격표 PT 입력은 "-"(없음)

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 190, 190/√3 (GPT) | V | 5 |
| ratedCurrent | 정격전류 | CT 5A / ZCT 1.5mA |  | 5 |
| frequency | 정격주파수 | 60, 50 | Hz | 5 |
| wiring | 결선방식 | 3P3W, 3P4W |  | 5 |
| auxPower | 제어전원 | AC/DC 110, DC 125V |  | 5 |
| protection | 보호 기능 | FN: 50/51, 50/51N, 46, 67N, 49, 48/51LR, 37, 66, 38 · FZ: 50/51, 46, 67G, 49, 48/51LR, 37, 66, 38 |  | 5 |
| communication | 통신 | RS485 : Modbus |  | 5 |
| standards | 적용 규격 | IEC 60255, IEC 61000-4, KEMC 1120 |  | 5 |


#### P01080 GIMAC-PQ (신규)

- 카탈로그: [[GIMAC-PQ]](https://www.ls-electric.com/ko/cat/%5BGIMAC-PQ%5D_KO_C160J1-01-202304.pdf) · 대표 p.5
- 비고: 기능 및 정격(카탈로그 인쇄 쪽번호 180, PDF 5쪽) 기준

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 10~230 (PT), 2.2~230 (GPT) | V | 5 |
| ratedCurrent | 정격전류 | 0.05~6 (CT 입력) | A | 5 |
| frequency | 정격주파수 | 60, 50 | Hz | 5 |
| wiring | 결선방식 | 1P2W, 1P3W, 3P3W Delta, 3P3W Y, 3P4W |  | 5 |
| auxPower | 제어전원 | AC/DC 110V, 220V |  | 5 |
| communication | 통신 | RS485 : Modbus |  | 5 |
| standards | 적용 규격 | IEC60255, IEC61000-4, KEMC 1110 |  | 5 |


#### P01081 GIMAC-II Plus (신규)

- 카탈로그: [[GIMAC-II Plus]](https://www.ls-electric.com/ko/cat/%5BGIMAC-II_Plus%5D_KO_C160K1-02-202406.pdf) · 대표 p.5
- 비고: 기능 및 정격(p5) 기준. GIMAC-II Plus와 GIMAC-115P는 동일 제품(p13 주)

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 20 ~ 230 (110V) (PT), 2.2 ~ 230 (GPT) | V | 5 |
| ratedCurrent | 정격전류 | 0.05 ~ 6 (5A) or 0.01 ~ 1.2 (1A) | A | 5 |
| frequency | 정격주파수 | 60, 50 | Hz | 5 |
| wiring | 결선방식 | 1P2W, 1P3W, 3P3W(Y), 3P3W(Delta), 3P4W |  | 5 |
| accuracy | 계측 정밀도 | 전류/전압 ±0.3%, 전력/전력량 ±0.5% |  | 3 |
| auxPower | 제어전원 | AC/DC 110V, 220V |  | 5 |
| communication | 통신 | Modbus/RS485, Ethernet / DNP3.0/Ethernet / IEC61850 MMS/Ethernet |  | 5 |
| standards | 적용 규격 | IEC60255, IEC61000-4 |  | 5 |


#### P01083 GIMAC-DC (신규)

- 카탈로그: [[GIMAC-DC]](https://www.ls-electric.com/ko/cat/%5BGIMAC-DC%5D_KO_C160L1-01-202304.pdf) · 대표 p.5
- 비고: 정격 및 기능(p5) 기준. DC 전류는 SHT 저항(DC 3 ~ 180mV) 입력

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | AC 20 ~ 452V, DC 20 ~ 264V |  | 5 |
| frequency | 정격주파수 | 60, 50 | Hz | 5 |
| accuracy | 계측 정밀도 | AC/DC 전압 ±0.3%, DC 전류 (출력/배터리) ±0.5% |  | 3 |
| auxPower | 제어전원 | AC/DC 88 ~ 264V, Free Voltage |  | 5 |
| communication | 통신 | MODBUS/RS485 |  | 5 |
| standards | 적용 규격 | IEC60255, IEC61000-4 |  | 5 |


#### P21020 IMD (신규)

- 카탈로그: [[IMD] Catalog_국문](https://www.ls-electric.com/ko/cat/%5BIMD%5D_KO_C160B1-04-202403.pdf) · 대표 p.10
- 비고: 성능 및 정격(p10) 기준. 비접지 계통(IT-System) 절연 감시 장치

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 본체 AC 0...790V, DC 0...1000V / 커플러 AC 0...1000V, DC 0...1500V (계통 전압 Vn) |  | 10 |
| frequency | 정격주파수 | 42~460 (공칭 주파수) | Hz | 10 |
| monitorRange | 절연 감시 범위 | 1kΩ ~ 10MΩ |  | 10 |
| auxPower | 제어전원 | AC/DC : 100~240V, 50/60Hz (공급전원) |  | 10 |
| communication | 통신 | RS-485 1 Port : ModBus RTU, (옵션) Ethernet Converter RSTP : ModBus TCP |  | 10 |
| standards | 적용 규격 | IEC61557-8, IEC60441 |  | 10 |


#### P02214 DC Meter (신규)

- 카탈로그: [[DC Meter] Leaflet](https://www.ls-electric.com/ko/cat/%5BDC_Meter%5D_Leaflet_KO_C12051-05-202609.pdf) · 대표 p.1
- 비고: [DC Meter] 리플렛 정격표(p1) 기준. 모델별 class 1.0 / 0.5(…/S) 구분, Shunt(75mV)는 별매

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | DC 10 ~ 1,000V (입력전압) |  | 1 |
| ratedCurrent | 정격전류 | DC 0 ~ 750A (Via Shunt) |  | 1 |
| accuracy | 계측 정밀도 | ±1.0% |  | 1 |
| auxPower | 제어전원 | DC 24V (±10%) / AC 85~265V (220V 권장) |  | 1 |
| communication | 통신 | RS-485, Modbus-RTU |  | 1 |
| mounting | 설치·인출 방식 | Din-Rail Type |  | 1 |


#### P01093 SDC-500 (신규)

- 카탈로그: [[SDC-500] 사용설명서](https://www.ls-electric.com/ko/cat/HPDT/%5BSDC-500%5D%20%EC%82%AC%EC%9A%A9%EC%84%A4%EB%AA%85%EC%84%9C_Manual_KO_202511.pdf) · 대표 p.4
- 비고: 정격 (본체)(p4) 기준. 최대수요전력제어기라 전압·전류 정격 항목 없음

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| auxPower | 제어전원 | AC 90~240V, 60Hz |  | 4 |
| mounting | 설치·인출 방식 | Panel 부착형 |  | 4 |
| communication | 통신 | COM1(RS-232C), COM2/3(RS-485), 이더넷(10 Base-T) — Modbus slave 기능 |  | 4 |


#### P01215 M100 (신규)

- 카탈로그: [M100 카탈로그](https://ssq.ls-electric.com/uploads/document/16389344544610/M100_Catalog_KR__04__201204.pdf) · 대표 p.2
- 비고: M100 카탈로그(2쪽 리플렛) 입/출력 규격(p2) 기준. 정격전류(출력)는 모델별 표 값을 순서대로 읽음

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 1상 200~240 (-15%~+10%) | Vac | 2 |
| motorPower | 적용 전동기 용량 | 0.1~2.2 | kW | 2 |
| ratedCurrent | 정격전류 | 0.8~10.0 (중부하, 출력) | A | 2 |
| frequency | 정격주파수 | 입력 50~60 (±5 %) / 출력 0 ~ 400 | Hz | 2 |
| ipRating | 보호등급(IP) | UL Open (IP20) |  | 2 |
| communication | 통신 | RS485 통신 기본 내장 |  | 1 |
| mounting | 설치·인출 방식 | Din rail 설치 기본 제공, Side By Side |  | 1 |
| standards | 적용 규격 | UL 61800-5-1 |  | 1 |


#### P01262 L100 (신규)

- 카탈로그: [L100 카탈로그](https://ssq.ls-electric.com/uploads/document/16389350358190/_AC%20Drive_%20L100_Catalog_KR__01__210318.pdf) · 대표 p.12
- 비고: 기본 규격(p12) 기준. 엘리베이터(Lift) 전용 드라이브

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 3상 380 ~ 480 (-10% ~ +10%) | V | 12 |
| motorPower | 적용 전동기 용량 | 5.5~22 | kW | 12 |
| ratedCurrent | 정격전류 | 12~45 (정격 출력) | A | 12 |
| capacity | 정격용량 | 9.1~34.3 (정격 출력) | kVA | 12 |
| frequency | 정격주파수 | 입력 50 ~ 60 (±5%) | Hz | 12 |
| communication | 통신 | CAN2.0B / RS232 통신 기본 내장 |  | 7 |


#### P01187 iG5A (신규)

- 카탈로그: [iG5A 트러블슈팅(Troubleshooting) 사용설명서](https://ssq.ls-electric.com/uploads/document/16399669168300/iG5A_Troubleshooting_Rev1.0_150415.pdf) · 대표 p.9
- 비고: 기본 정격(p9~10) 기준

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| frequency | 정격주파수 | 입력 50 ~ 60 (±5%) / 최대 출력 400 | Hz | 9 |
| ipRating | 보호등급(IP) | 개방형 (IP 20), UL Enclosure(ENC) Type1 |  | 10 |
| protection | 보호 기능 | 과전압, 저전압, 과전류, 지락 전류 검출, 드라이브 과열, 전동기 과열, 출력 결상, 과부하 보호 등 트립 |  | 10 |
| communication | 통신 | RS485, Modbus 통신 가능 |  | 5 |
| standards | 적용 규격 | UL, CE |  | 7 |

옵션 기준: **입력 전압**

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 1ph-200v | 단상 200V급 (p.9) | ratedVoltage | 정격전압 | 1상 200 ~ 230 VAC (+10%, -15%) |  | 9 |
|  |  | motorPower | 적용 전동기 용량 | 0.4~1.5 | kW | 9 |
|  |  | ratedCurrent | 정격전류 | 2.5~8 (출력) | A | 9 |
| 3ph-200v | 3상 200V급 (p.9) | ratedVoltage | 정격전압 | 3상 200 ~ 230 VAC (+10%,-15% ) |  | 9 |
|  |  | motorPower | 적용 전동기 용량 | 0.4~22 | kW | 9 |
|  |  | ratedCurrent | 정격전류 | 2.5~88 (출력) | A | 9 |
| 3ph-400v | 3상 400V급 (p.9) | ratedVoltage | 정격전압 | 3상 380 ~ 480 VAC (+10%,-15% ) |  | 9 |
|  |  | motorPower | 적용 전동기 용량 | 0.4~22 | kW | 9 |
|  |  | ratedCurrent | 정격전류 | 1.25~45 (출력) | A | 9 |


#### P01190 iV5 (신규)

- 카탈로그: [iV5 뉴제어기 사용설명서](https://ssqfd-abhdhraad3gkgbcg.a03.azurefd.net/prod/largefile/document/17344221865000/iV5_User_Manual_Kor_V1.1_220615.pdf) · 대표 p.14
- 비고: 표준 규격(p14~15) 기준. 정격전류는 출력 정격. MRL 전용(p15, 7.5~22kW)은 넣지 않음

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| frequency | 정격주파수 | 입력 50~60 (±5%) | Hz | 14 |

옵션 기준: **입력 전압**

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 200v | 200V급 AC 입력 (p.14) | ratedVoltage | 정격전압 | 3Ø 200~230V(-10%~+10%) |  | 14 |
|  |  | motorPower | 적용 전동기 용량 | 2.2~37 | kW | 14 |
|  |  | ratedCurrent | 정격전류 | 12~146 | A | 14 |
| 400v | 400V급 AC 입력 (p.14) | ratedVoltage | 정격전압 | 3Ø 380 ~ 480V(-10%~+10%) |  | 14 |
|  |  | motorPower | 적용 전동기 용량 | 2.2~800 | kW | 14 |
|  |  | ratedCurrent | 정격전류 | 6~1384 | A | 14 |
| 400v-dc | 400V급 DC 입력 (p.15) | ratedVoltage | 정격전압 | DC 540~680V(+10%) |  | 15 |
|  |  | motorPower | 적용 전동기 용량 | 5.5~500 | kW | 15 |
|  |  | ratedCurrent | 정격전류 | 12~960 | A | 15 |


#### P01189 iP5A (신규)

- 카탈로그: [iP5A/iV5 RS485 Modbus RTU 통신 옵션 사용설명서](https://ssq.ls-electric.com/uploads/document/16400729573330/iP5A_User%20Manual_RS485_Eng_Kor_V1.2_200701.pdf) · 대표 p.9
- 비고: 기본 사양(p9) 기준. 팬·펌프 전용, 적용 모터·정격전류는 팬·펌프 부하(Normal Duty) 기준

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| frequency | 정격주파수 | 입력 50/60 (±5%) / 출력 0.01 ~ 120 | Hz | 9 |
| protection | 보호 기능 | 과전압, 저전압, 과전류, 지락 보호, 드라이브 과열, 전동기 과열, 출력결상, 과부하 보호 등 트립 |  | 9 |
| communication | 통신 | 485통신 내장(LS-bus) / 옵션: DeviceNet, Profibus-DP, Modbus-RTU, Lonworks, BAC-Net, Metasys N2 |  | 7 |

옵션 기준: **입력 전압**

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 200v | 200~230V급 (p.9) | ratedVoltage | 정격전압 | 3Ø 200 ~ 230V (-15% ~ +10%) |  | 9 |
|  |  | motorPower | 적용 전동기 용량 | 5.5~30 (팬·펌프 부하) | kW | 9 |
|  |  | ratedCurrent | 정격전류 | 24~115 (110% 과부하 내량) | A | 9 |
|  |  | ipRating | 보호등급(IP) | IP20 / UL Type1, IP00 / UL Open |  | 9 |
| 400v | 380~480V급 (p.9) | ratedVoltage | 정격전압 | 3Ø 380 ~ 480V (-15% ~ +10%) |  | 9 |
|  |  | motorPower | 적용 전동기 용량 | 5.5~450 (팬·펌프 부하) | kW | 9 |
|  |  | ratedCurrent | 정격전류 | 12~877 (110% 과부하 내량) | A | 9 |
|  |  | ipRating | 보호등급(IP) | IP20 / UL Type1, IP00 / UL Open (110kW 이상 IP00) |  | 9 |


#### P01263 S300 (신규)

- 카탈로그: [S300 카탈로그](https://ssqfd-abhdhraad3gkgbcg.a03.azurefd.net/prod/largefile/document/17840729866150/S300_Catalog_KR_0707.pdf) · 대표 p.12
- 비고: 입·출력 규격(p12~14)·제품 사양(p15) 기준 (HTTP Range로 필요한 페이지만 받아 추출). 400V급 적용 전동기·정격전류: p.13~14 표에 걸침

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| frequency | 정격주파수 | 입력 50/60 ±5% / 출력 0.01~590 (V/F, V/F-SC) | Hz | 12 |
| ipRating | 보호등급(IP) | IP 20(기본), UL Open & Enclosed Type 1(옵션) |  | 15 |
| protection | 보호 기능 | 과전류, 과전압, 암(ARM) 단락 전류, 인버터 과열, 출력 결상, 입력 결상, 지락, 전동기 과열 등 트립 |  | 15 |

옵션 기준: **입력 전압**

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 200v | 200V급 (p.12) | ratedVoltage | 정격전압 | 3상 200~240, -15%~+10% | V | 12 |
|  |  | motorPower | 적용 전동기 용량 | 0.4~75 (중부하 HD) | kW | 12 |
|  |  | ratedCurrent | 정격전류 | 3.2~288 (HD, 출력) | A | 12 |
| 400v | 400V급 (p.13) | ratedVoltage | 정격전압 | 3상 380~480, -15%~+10% | V | 13 |
|  |  | motorPower | 적용 전동기 용량 | 0.4~400 (중부하 HD) | kW | 13 |
|  |  | ratedCurrent | 정격전류 | 1.8~781 (HD, 380~460V, 출력) | A | 13 |


#### P01097 MCSG (신규)

- 카탈로그: [[MCSG]](https://www.ls-electric.com/ko/cat/%5BMCSG%5D_KO_C80051-11-202605.pdf) · 대표 p.7
- 비고: 중치형 MCSG(Standard type) 제품 사양(p7~8) 기준 (HTTP Range로 필요한 페이지만 받아 추출). 정격전류는 표의 최소~최대. 36kV 정격전류는 추출 텍스트가 잘려 비워 둠. V Series=Pro-MEC VCB, S Series=Susol VCB 적용

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| frequency | 정격주파수 | 50/60 | Hz | 7 |
| ipRating | 보호등급(IP) | IP4X |  | 7 |
| standards | 적용 규격 | IEC 62271-200 |  | 7 |

옵션 기준: **정격전압**

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 7-2kv | 7.2 kV | ratedVoltage | 정격전압 | 7.2 | kV | 7 |
|  |  | powerFreqWithstand | 상용주파 내전압 | 20 (1min) | kV | 7 |
|  |  | impulseWithstand | 뇌임펄스 내전압 | 60 | kV | 7 |
|  |  | shortTimeCurrent | 정격 단시간 전류 | 25/3, 40/3, 50/3 | kA/s | 7 |
|  |  | ratedCurrent | 정격전류 | 630~5000 | A | 7 |
| 12kv | 12 kV | ratedVoltage | 정격전압 | 12 | kV | 7 |
|  |  | powerFreqWithstand | 상용주파 내전압 | 28 (1min) | kV | 7 |
|  |  | impulseWithstand | 뇌임펄스 내전압 | 75 | kV | 7 |
|  |  | shortTimeCurrent | 정격 단시간 전류 | 25/3, 40/3, 50/3 | kA/s | 7 |
|  |  | ratedCurrent | 정격전류 | 630~5000 | A | 7 |
| 17-5kv | 17.5 kV | ratedVoltage | 정격전압 | 17.5 | kV | 8 |
|  |  | powerFreqWithstand | 상용주파 내전압 | 38 (1min) | kV | 8 |
|  |  | impulseWithstand | 뇌임펄스 내전압 | 95 | kV | 8 |
|  |  | shortTimeCurrent | 정격 단시간 전류 | 25/3, 40/3, 50/3 | kA/s | 8 |
|  |  | ratedCurrent | 정격전류 | 630~4000 | A | 8 |
| 24kv | 24 kV | ratedVoltage | 정격전압 | 24 | kV | 8 |
|  |  | powerFreqWithstand | 상용주파 내전압 | 50 (1min) | kV | 8 |
|  |  | impulseWithstand | 뇌임펄스 내전압 | 125 | kV | 8 |
|  |  | shortTimeCurrent | 정격 단시간 전류 | 25/3, 40/3 | kA/s | 8 |
|  |  | ratedCurrent | 정격전류 | 630~3150 | A | 8 |
| 36kv | 36 kV | ratedVoltage | 정격전압 | 36 | kV | 8 |
|  |  | powerFreqWithstand | 상용주파 내전압 | 70 (1min) | kV | 8 |
|  |  | impulseWithstand | 뇌임펄스 내전압 | 170 | kV | 8 |
|  |  | shortTimeCurrent | 정격 단시간 전류 | 25, 31.5, 40/3 | kA/s | 8 |


#### P01098 특고압 일반배전반 (신규)

- 카탈로그: [[GSH-20V]_국문](https://www.ls-electric.com/ko/cat/%5BGSH-20V%5D_KO_C80081-01-202411.pdf) · 대표 p.4
- 비고: 정격 및 특징(p4) 기준 (모델 GSH-V20)

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 24/25.8 | kV | 4 |
| ratedCurrent | 정격전류 | 630, 1250, 2000 | A | 4 |
| frequency | 정격주파수 | 50/60 | Hz | 4 |
| shortTimeCurrent | 정격 단시간 전류 | 12.5, 25 (1s or 3s) | kA | 4 |
| powerFreqWithstand | 상용주파 내전압 | 50 (1min) | kV | 4 |
| impulseWithstand | 뇌임펄스 내전압 | 125 | kV | 4 |
| standards | 적용 규격 | IEC 62271-200 |  | 4 |


#### P01100 고압 일반배전반 (신규)

- 카탈로그: [[GSM] 3.6/7.2kV 고압폐쇄배전반](https://www.ls-electric.com/ko/cat/%5BGSM%5D_KO_C80061-06-202609.pdf) · 대표 p.4
- 비고: 정격 및 특징(p4) 기준 (모델 GSM-V07)

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 3.6 / 7.2 | kV | 4 |
| ratedCurrent | 정격전류 | up to 3,150 | A | 4 |
| frequency | 정격주파수 | 50 / 60 | Hz | 4 |
| shortTimeCurrent | 정격 단시간 전류 | up to 40 (1s or 3s) | kA | 4 |
| powerFreqWithstand | 상용주파 내전압 | 20 (1min) | kV | 4 |
| impulseWithstand | 뇌임펄스 내전압 | 60 | kV | 4 |
| standards | 적용 규격 | IEC 62271-200 |  | 4 |


#### P02203 C-AIS (신규)

- 카탈로그: [[C-AIS] 국문](https://www.ls-electric.com/ko/cat/%5BC-AIS%5D_KO_C800E1-01-202212.pdf) · 대표 p.4
- 비고: 전기적 특성(p4) 기준. 같은 표의 "정격차단전류 Ima 40/50/54.6kA"는 기호(Ima)가 투입전류라 넣지 않음 — 수납 SM VCB(SVL) 차단전류는 p13: 16·20·25kA

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 12 / 17.5 / 24 (Ur) | kV | 4 |
| ratedCurrent | 정격전류 | 630 (Ir) | A | 4 |
| frequency | 정격주파수 | 50 / 60 | Hz | 4 |
| shortTimeCurrent | 정격 단시간 전류 | 16kA/3s, 21kA/3s, 25kA/1s |  | 4 |
| powerFreqWithstand | 상용주파 내전압 | 28 / 38 / 50 (상, 대지간, 1min) | kV | 4 |
| impulseWithstand | 뇌임펄스 내전압 | 75 / 95 / 125 (상, 대지간) | kV | 4 |
| standards | 적용 규격 | IEC 62271-1, IEC 62271-100, IEC 62271-102, IEC 62271-103, IEC 62271-105, IEC 62271-200 |  | 4 |


#### P02202 DAIS (신규)

- 카탈로그: [[DAIS] 25.8kV](https://www.ls-electric.com/ko/cat/%5BDAIS%5D_25.8kV_KO_C81071-02-202212.pdf) · 대표 p.6
- 비고: Specification(p6~7) 기준 (HTTP Range로 필요한 페이지만 받아 추출)

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 25.8 | kV | 6 |
| frequency | 정격주파수 | 60 | Hz | 6 |
| insulation | 절연·냉각 방식 | Dry Air (압축건조공기) |  | 2 |

옵션 기준: **모선 방식**

| 옵션 id | 옵션 | key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|---|---|
| 12-5ka | 25.8kV 12.5kA 단모선 | ratedCurrent | 정격전류 | 630 | A | 6 |
|  |  | breakingCapacity | 정격차단전류 | 12.5 | kA | 6 |
|  |  | powerFreqWithstand | 상용주파 내전압 | 60 | kV | 6 |
|  |  | impulseWithstand | 뇌임펄스 내전압 | 125 | kV | 6 |
|  |  | shortTimeCurrent | 정격 단시간 전류 | 12.5 / 1 | kA/sec | 6 |
|  |  | standards | 적용 규격 | KRSA-3117-R0 및 관련 IEC 62271, 62869 등 |  | 6 |
| 25ka | 25.8kV 25kA 복모선 (GESG-0220/0222-TC) | ratedCurrent | 정격전류 | 630 / 2000 | A | 7 |
|  |  | breakingCapacity | 정격차단전류 | 25 | kA | 7 |
|  |  | powerFreqWithstand | 상용주파 내전압 | 60 | kV | 7 |
|  |  | impulseWithstand | 뇌임펄스 내전압 | 150 | kV | 7 |
|  |  | shortTimeCurrent | 정격 단시간 전류 | 25 / 1 | kA/sec | 7 |
|  |  | standards | 적용 규격 | GS 5925-0128 |  | 7 |


#### P01101 Susol LV SWGR (신규)

- 카탈로그: [[Susol LV SWGR]](https://www.ls-electric.com/ko/cat/%5BSusol_LV_SWGR%5D_KO_C80041-02-201904.pdf) · 대표 p.5
- 비고: [Susol LV SWGR] 정격사항(p5) 기준. 표 열(Main/Feeder/MCC) 구분은 텍스트 순서로 읽음 — 정격전류·임펄스 열 검수 필요

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | Up to 690 (Rated operating voltage) | V | 5 |
| ratedCurrent | 정격전류 | Main: Up to 6300 / Up to 5000, Distribution: Up to 2000 | A | 5 |
| phases | 상 및 선식 | 3P4W |  | 5 |
| frequency | 정격주파수 | 50/60 | Hz | 5 |
| shortTimeCurrent | 정격 단시간 전류 | Up to 100 kA/1sec. |  | 5 |
| insulationVoltage | 정격절연전압 | 1000 | V | 5 |
| impulseVoltage | 정격임펄스내전압 | 12 / 8 | kV | 5 |
| ipRating | 보호등급(IP) | Up to IP54 |  | 5 |
| standards | 적용 규격 | IEC 61439-2 Edition 3.0 (2020) |  | 5 |


#### P01104 GCC H/V/N (신규)

- 카탈로그: [[MCC]](https://www.ls-electric.com/ko/cat/%5BMCC%5D_KO_C80001-07-202005.pdf) · 대표 p.6
- 비고: [MCC] 정격(p6) 기준. 수평모선 정격전류 3개 값은 GCC-H/V/N 열 순서로 읽음(원문 행 이름은 "정격전압"으로 인쇄) — 검수 필요

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 최대 AC 480V |  | 6 |
| insulationVoltage | 정격절연전압 | AC 600V |  | 6 |
| frequency | 정격주파수 | 60 (표준), 50 (특수) | Hz | 6 |
| ratedCurrent | 정격전류 | 수평모선 600~2000A / 600~3500A / 600~4000A |  | 6 |
| shortTimeCurrent | 정격 단시간 전류 | 42kA/0.5sec, 65kA/1sec |  | 6 |
| auxPower | 제어전원 | 110, 220V (표준), 100, 120, 200V (특수) — 조작 및 제어전압 |  | 6 |
| ipRating | 보호등급(IP) | IEC IP20 NEMA Type1 (표준), IEC IP42 (특수) |  | 6 |
| standards | 적용 규격 | JEM1195, IEC 61439-1&2, NEMA, ICS2'232 |  | 6 |


#### P01245 Smart MCC (신규)

- 카탈로그: [[Smart MCC]](https://www.ls-electric.com/ko/cat/%5BSmart_MCC%5D_KO_C800I1-02-202504.pdf) · 대표 p.13
- 비고: [Smart MCC] 카탈로그의 MCC panel 정격 사양(Susol MCC, p13) 기준

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | Up to 500 | V | 13 |
| ratedCurrent | 정격전류 | Main Up to 5000, Distribution Up to 1500 | A | 13 |
| phases | 상 및 선식 | 3상 4선식 |  | 13 |
| frequency | 정격주파수 | 50/60 | Hz | 13 |
| shortTimeCurrent | 정격 단시간 전류 | Up to 100kA/1sec |  | 13 |
| insulationVoltage | 정격절연전압 | 750 | V | 13 |
| impulseVoltage | 정격임펄스내전압 | 8 | kV | 13 |
| ipRating | 보호등급(IP) | Up to IP54 |  | 13 |
| standards | 적용 규격 | IEC 61439-1&2 |  | 13 |


#### P02204 MDB (신규)

- 카탈로그: [Modular MDB](https://www.ls-electric.com/ko/cat/Modular_MDB_EN_C800%E2%93%952-01-202607.pdf) · 대표 p.6
- 비고: 영문 Modular MDB Technical Specifications(p6) 기준

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 690 (Ue) | V | 6 |
| insulationVoltage | 정격절연전압 | 1000 (Ui) | V | 6 |
| impulseVoltage | 정격임펄스내전압 | Up to 12 (Uimp) | kV | 6 |
| frequency | 정격주파수 | 50/60 | Hz | 6 |
| ratedCurrent | 정격전류 | Main Busbar Up to 7000 / Up to 7250 (Back to Back), Distribution Busbar Up to 5000 | A | 6 |
| shortTimeCurrent | 정격 단시간 전류 | Up to 150 kA rms - 1s (Main Busbar), Up to 100 kA rms - 1s (Distribution Busbar) |  | 6 |
| ipRating | 보호등급(IP) | Up to IP43 |  | 6 |
| standards | 적용 규격 | IEC 61439-1/2, IEC TR 61641, IEC 60529 |  | 6 |


#### P01102 Power Center (신규)

- 카탈로그: [[Power Center]](https://www.ls-electric.com/ko/cat/%5BPower_Center%5D_KO_C80071-09-202103.pdf) · 대표 p.5
- 비고: 제품 사양(p5) 기준. 극수 행은 원문 표기 "극수(Pole) 3상3선 / 3상4선"

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | AC 690V (정격사용전압) |  | 5 |
| insulationVoltage | 정격절연전압 | AC 1000V |  | 5 |
| frequency | 정격주파수 | 50/60 | Hz | 5 |
| poles | 극수 | 3상3선 / 3상4선 |  | 5 |
| ratedCurrent | 정격전류 | 630 ~ 6300 | A | 5 |
| auxPower | 제어전원 | DC 100 / 110V (제어회로전압) |  | 5 |
| standards | 적용 규격 | JEM 1265, IEC 60439 |  | 5 |


#### P01105 Susol Busway (신규)

- 카탈로그: [[Susol Busway]](https://www.ls-electric.com/ko/cat/%5BSusol_Busway%5D_KO_C800A1-16-202608.pdf) · 대표 p.6
- 비고: 제품 사양(p6) 기준

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | AC 1000V / DC 1500V 이하 |  | 6 |
| frequency | 정격주파수 | 50 / 60 | Hz | 6 |
| ratedCurrent | 정격전류 | Al 630 ~ 6300, Cu 630 ~ 7500 | A | 6 |
| shortTimeCurrent | 정격 단시간 전류 | Al 121 kA / 1 sec (2000A), 200 kA / 1 sec (4000A); Cu 135 kA / 1 sec (2000A), 220 kA / 1 sec (4000A) |  | 6 |
| wiring | 결선방식 | 3W, 4W, 5W |  | 6 |
| ipRating | 보호등급(IP) | 옥내용 IP54, 옥외용 IP65, 옵션 IPX8 (접속부 몰딩) |  | 6 |
| standards | 적용 규격 | KS C IEC 60439-1, 2, IEC 61439-1, 6 |  | 6 |


#### P01106 GH-P Type Busway (신규)

- 카탈로그: [[GH-P type Busway]](https://www.ls-electric.com/ko/cat/%5BGH-P_type_Busway%5D_KO_C800C1-20-202403.pdf) · 대표 p.6
- 비고: 제품 사양(p6) 기준

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | AC 1000V 이하 / DC 1500V 이하 |  | 6 |
| ratedCurrent | 정격전류 | 알루미늄 도체(AL) 600A ~ 5000A, 동 도체(CU) 600A ~ 6500A |  | 6 |
| frequency | 정격주파수 | 50 / 60 | Hz | 6 |
| wiring | 결선방식 | 3W, 4W, 5W |  | 6 |
| ipRating | 보호등급(IP) | 옥내용 IP41, 옥외용 IP65 |  | 6 |
| standards | 적용 규격 | IEC 60439-1,2 / KSC IEC 60439-1,2 / JIS C8364 / KS C8450(구) |  | 6 |


#### P01910 Susol Mini Busway (신규)

- 카탈로그: [[Susol Mini Busway]](https://www.ls-electric.com/ko/cat/%5BSusol_Mini_Busway%5D_KO_C800Y1-01-202109.pdf) · 대표 p.6
- 비고: 제품 사양(p6) 기준

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | AC 1000V 이하 / DC 1500V 이하 |  | 6 |
| frequency | 정격주파수 | 50 / 60 | Hz | 6 |
| ratedCurrent | 정격전류 | 160~800 | A | 6 |
| shortTimeCurrent | 정격 단시간 전류 | Up to 30 kA / 1 sec (Option : 40 kA / 1 sec) |  | 6 |
| wiring | 결선방식 | 3W, 4W, 5W |  | 6 |
| ipRating | 보호등급(IP) | IPX8 (Plug in hole : IP54) |  | 6 |
| standards | 적용 규격 | IEC 61439-1, 6 |  | 6 |


#### P01911 NSPB (신규)

- 카탈로그: [[NSPB]](https://www.ls-electric.com/ko/cat/%5BNSPB%5D_KO_C80091-07-202403.pdf) · 대표 p.6
- 비고: 제품 사양(p6) 기준. 정격전류·단시간전류는 전압 등급 열을 묶은 값으로 표에 적힌 순서 그대로 — 어느 전압 등급에 해당하는지는 원문 표 확인 필요

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 0.69(Ui), 3.6, 7.2, 12, 17.5, 24, 36 | kV | 6 |
| frequency | 정격주파수 | 50 / 60 | Hz | 6 |
| ratedCurrent | 정격전류 | 630 ~ 4000, 630 ~ 3200 (전압 등급별) | A | 6 |
| shortTimeCurrent | 정격 단시간 전류 | 12.5 ~ 80, 12.5 ~ 50, 12.5 ~ 40 (전압 등급별) | kA | 6 |
| ipRating | 보호등급(IP) | 옥내형 IP41, 옥외형 IP54 |  | 6 |
| standards | 적용 규격 | KS C IEC 60439-1&2, IEC 62271-1&200, ANSI C37.23 |  | 6 |


#### D421413 LV CTTS (신규)

- 카탈로그: [LV CTTS 카탈로그](https://www.ls-electric.com/ko/cat/LV_CTTS_KO_C800%E2%93%961-01-202610.pdf) · 대표 p.5
- 비고: LV CTTS 판넬 정격(p5)과 적용 Susol ACB Technical Table(p7) 기준. 주파수·차단전류·극수는 판넬에 들어가는 ACB 값

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 690 | V | 5 |
| impulseVoltage | 정격임펄스내전압 | 12 | kV | 5 |
| ratedCurrent | 정격전류 | 630 ~ 3200 | A | 5 |
| shortTimeCurrent | 정격 단시간 전류 | ~ 85 kA / 0.5 s |  | 5 |
| ipRating | 보호등급(IP) | IP4X |  | 5 |
| frequency | 정격주파수 | 60 (적용 Susol ACB) | Hz | 7 |
| breakingCapacity | 정격차단전류 | 85 (적용 Susol ACB) | kA | 7 |
| poles | 극수 | 4 P (적용 Susol ACB) |  | 7 |


#### D420271 MV CTTS (신규)

- 카탈로그: [MV CTTS 카탈로그](https://www.ls-electric.com/ko/cat/MV_CTTS_KO_C800%E2%93%931-01-202606.pdf) · 대표 p.5
- 비고: MV CTTS 판넬 정격(p5) 기준. 내아크 ~40kA/0.5s (A-FLR)

| key | 항목 | 값 | 단위 | 페이지 |
|---|---|---|---|---|
| ratedVoltage | 정격전압 | 7.2 | kV | 5 |
| powerFreqWithstand | 상용주파 내전압 | 20kV/1min |  | 5 |
| impulseWithstand | 뇌임펄스 내전압 | 60kV [1.2х50㎲] |  | 5 |
| ratedCurrent | 정격전류 | ~2000 | A | 5 |
| shortTimeCurrent | 정격 단시간 전류 | ~40kA/3s |  | 5 |
| ipRating | 보호등급(IP) | IP4X |  | 5 |
