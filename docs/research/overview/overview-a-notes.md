# overview-a 작성 기록 (L1·L2·L3·L4·MON, 36종)

작성일: 2026-11-18 · 결과: `overview-a.json` · catalog 27 / general 9

## 근거 자료
- 기존 캐시 텍스트(사양 추출 때 받은 PDF의 텍스트): 유입변압기, Susol VCB(p2·p5, Range 추출분), RMU, AMR, XGIPAM, GIPAM3000, GIPAM1000, GIPAM115. 수치는 specs.json(T2 대조 반영값)과 맞춰 씀.
- 새로 받은 자료: ls-electric.com 제품 카테고리·제품 페이지 HTML 28건(본문 `c_summary`/`cc_content`/`pc_content`에서 추출). UA `LSE-ProductMap/0.1`, 간격 1.3초.
- PDF 신규 다운로드 시도 2건(MCSG, C-AIS): 40MB 제한(`--max-filesize`)에 걸려 중단, 받은 파일 0. 대신 제품 페이지 정격표 사용.
- 카테고리 페이지 출처는 `page` 없이 URL만 기록.

## 기기별 근거 요약
| 기기 | basis | 근거 |
|---|---|---|
| step-up-tr, main-tr | catalog | 유입변압기 카탈로그 p4·p10 (550kV·800MVA, OLTC/DETC, 냉각방식), AAA009005 |
| ehv-gis, gis-154 | catalog | AAA009004 정격표 (25.8~420kV, 170kV 1250~4000A·50kA, 362kV 4000~6300A·50/63kA) |
| hvdc | catalog | AAA009003 (300km/40km 경제성), 유입변압기 p4 (HVDC 변환용) |
| facts | catalog | AAA009002 (SVC/STATCOM, 150/50Mvar, Panel 90kVar~2Mvar·24Mvar) |
| relay-tx | catalog | 일반 설명 + XGIPAM p13, GIPAM3000 p14 |
| substation | catalog | AAA009001 (22.9/154/345kV 시공, 지중 200~2000SQ, 계통해석) |
| sas | catalog | AAA003003 (SAS Station/CSD/RTU/보호계전반) |
| fcl | catalog | AAA010005 (22.9kV·2000A·25kA/0.4s, 초전도+FS+CLR) |
| auto-switch | catalog | RMU 카탈로그 p4·p10 (12~36kV, 630A, 21kA 3s) |
| mv-swgr | catalog | 제품 페이지 P01097·P02201·P02203·P02202 |
| lbs | catalog | 제품 페이지 P03077, Susol LIS 카탈로그 p4 |
| alts | catalog | AAA015006 (25.8kV·630A·16kA/1s·200ms 이하) |
| meter, amrs | catalog | AMR 카탈로그 p2·p4·p6·p10, AAA008 |
| pf | catalog | AAA015004 (DIN/KS 정격표) |
| vcb | catalog | Susol VCB 카탈로그 p2·p5 |
| protection-relay | catalog | XGIPAM p3·p13, GIPAM3000 p3, GIPAM1000 p3, GIPAM115 p2 |
| vc-vi | catalog | AAA015002, AAA015003 |
| mv-drive | catalog | BBB006001 정격표 |
| scada, ems, dms, xems, care | catalog | 각 카테고리 페이지 (AAA003·003001·003002, AAA002, AAA004, AAA005001·005002, AAA001001~004) |
| generator, la-ehv, ct-pt-ehv, transmission-line, dist-line, recloser, pole-tr, la, mof, ct-pt | general | 일반 기술 상식. 자사 보유 여부 언급 없음 |

## 확신이 낮은 문장 (검수 권장)
- **la**: "22.9kV-Y 계통에서는 정격전압 18kV급", 공칭방전전류 2.5/5/10kA 예시 — 국내 관행 기준, 출처 미첨부.
- **la-ehv**: 초고압 공칭방전전류 "10kA·20kA급" — IEC 60099-4 등급 기준 일반값.
- **pole-tr**: "상전압(약 13.2kV)을 받는 단상기", "수십 kVA급" — 일반값.
- **ct-pt / ct-pt-ehv**: 정확도 계급 예시(0.2·0.5·1.0급, 5P·10P) — 규격 일반값.
- **generator**: "단자 전압 수 kV~25kV 안팎" — equipment-types.json voltage 필드와 맞춤.
- **mv-drive**: "M1000"은 products.json 제품명이 아니라 카테고리명(BBB006001). 페이지는 LSMV-M1000A 표기도 씀.
- **mv-swgr**: MCSG 정격전압은 페이지 표에 "72"로 적혀 있으나 모델명(V7/S7)으로 보아 7.2kV 오기로 판단해 "7.2~36kV"로 씀.
- **alts**: 카테고리 요약은 "Air 절연방식", 정격표에는 SF6 최소동작압력이 있어 절연 방식은 일부러 쓰지 않음.
- **vc-vi**: VI 정격전류 최대값은 표 열 정렬이 모호해 쓰지 않고 전압·차단전류 범위만 씀.
- **relay-tx**: coverage partial. LS 제품은 "변전·배전급" 보호계전기로만 기술, 송전선로 거리/차동 계전기 보유는 언급하지 않음.
- **scada**: "실증 20만 포인트"는 제조사 페이지 표기(스펙 100만/실증 20만) 중 실증값만 인용.
