# 제품 커버리지 감사 — 공식 사이트 전수 대조 (2026-11-18)

> 계기: 사용자 지적 "판매 제품 중 반영 안 된 제품이 있음(예: GIMAC류가 안 보임)".
> 범위: 조사·보고만 함. `products.json`·`equipment-types.json`·코드는 수정하지 않음.
> 스크립트·캐시 위치: `/private/tmp/claude-501/-Users-kjmoon-LSE-News/37bcf7f5-4ef4-4874-8316-789fc9001612/scratchpad/audit/`
> (`crawl.mjs`, `fetch.mjs`, `site_ko.json`, `leafcats.json`, `ssq_links.json`, `search-results*.json`, `requests.log`)

## 1. 요약

| 출처 | 제품(P) | 카테고리(C) | 데이터와 차이 |
|---|---:|---:|---|
| **우리 데이터** (`products.json` / `categories.json`) | 199 | 137 | — |
| 국문 메뉴 트리 (`/ko/common/js/site/menu`) | 199 | 137 | 0 |
| 국문 카테고리 페이지 137개 전부, 재귀 (`#hd_categories` 트리 + 본문 링크) | 199 | 137 | **0** |
| 국문 제품 목록 API (`/api/products/list/ko`, 자동완성용 전체 목록) | 208 | 141 | 메뉴에 없는 숨은 페이지 P 9개, C 4개 (→ a-1) |
| 영문 제품 목록 API (`/api/products/list/en`, 영문 사이트는 SPA라 메뉴 JS 없음) | 138 | 102 | 코드 체계가 달라 이름으로 대조함. 영문에만 있는 시리즈 약 18개 (→ a-3) |
| Solution Square (`sol.ls-electric.com`, 공개 카테고리 API) | — | 254 (모델 단위) | 국문 사이트에 없는 자동화·IIoT 라인 약 20개 (→ a-4) |

- **결론 1: 국문 '사업소개' 기준으로는 빠진 제품이 없습니다.** 메뉴 트리와 카테고리 페이지 재귀 결과가 199/137개로 데이터와 같습니다. GIMAC 7종(AAA016002)도 데이터에 있고 `power-meter`(디지털 계측기)에 연결돼 있으며, 앱에서 "GIMAC"을 검색하면 기기 1위와 제품 6개가 나옵니다(아래 4장).
- **결론 2: 사용자가 "안 보인다"고 느끼는 원인은 데이터 누락보다 다음 세 가지입니다.**
  1. **카테고리 페이지 자체가 제품인 라인 약 49개**: 하위 제품 id 없이 카테고리 본문에만 모델이 적혀 있습니다. 예: Metasol MMS, Susol DC ACB/MCCB, M1000, SSC/SSM 소프트스타터, GIMAC-B Branch·E TAG·GIMAC-TU·Thermal CAM, XG5000, XSC/XSR. 모두 카테고리 코드로 기기에 연결돼 있지만 `products.json`에 이름이 없어 검색되지 않습니다.
  2. **검색 순위와 표시 개수 한도**: 브랜드가 여러 기기에 걸쳐 있으면 결과가 잘립니다(Susol, Metasol, XGT 등). 기기 이름만으로는 브랜드를 짐작하기 어렵습니다.
  3. **영문 사이트와 SSQ에만 있는 시리즈**가 있습니다(Metasol VCB, GIPAM2000, Solution Power MCC, iX7M·L7S 서보, PMA SynRM 전동기 등).
- **결론 3: 매핑 오류 1건을 확인했습니다.** `aps` 기기는 이름이 "무정전 전원 장치"인데, 연결된 AAA010006 APS는 공식 설명상 **Arc Protection System(내아크 사고 감지·소호)**입니다. UPS가 아닙니다.
- 총 요청 수: **160회** (ls-electric.com 151, sol.ls-electric.com 9). 간격 1.3초, UA `LSE-ProductMap/0.1`, 로그인·캡차·다운로드 카운트 API는 사용하지 않았습니다. 404는 1건(`/sitemap.xml` 없음)입니다.

## 2. 수집 방법

1. 국문 메뉴 JS에서 카테고리 코드 137개를 시드로 삼았습니다. 각 `/ko/product/category/<code>` 페이지의 hidden input `#hd_categories`(하위 트리 JSON)와 본문의 `/product/(view|category)/` 링크를 재귀로 따라갔습니다. 새로 발견된 코드는 0개입니다.
2. 각 카테고리 페이지의 `#hd_entity`(c_full_name·c_ssq_link 등)와 `#hd_contents`(본문 h3~h5 제목)를 추출했습니다. 이것으로 제품 id 없는 카테고리 안의 모델명을 확인했습니다(`leafcats.json`).
3. `robots.txt`(sitemap 표기 없음)와 `/sitemap.xml`(404)을 확인했습니다. 영문 SPA 번들(`main.js`)에서 공개 API `/api/products/list/{lang}`을 찾아 ko·en 두 가지를 받았습니다.
4. 카테고리 56개가 `c_ssq_link`로 sol.ls-electric.com(Solution Square, 다운로드센터)을 가리켜서, SSQ 번들에서 게스트 API `/api/guest/ssqData/category/products/cards?lang=ko-KR`를 찾아 카테고리 254개를 받았습니다.
5. 숨은 제품 페이지 6개는 `/ko/product/view/<id>`를 직접 열어 `p_display`·`c_display`·수정일을 확인했습니다.

## 3. 대조 결과

### (a) 사이트에 있는데 데이터에 없는 것

#### a-1. 국문 목록 API에만 있는 숨은 페이지 (메뉴·카테고리 트리에는 없음) — 9건

| id | 이름 | 소속 코드(표시 여부) | 최종 수정 | 판단 | 제안 기기 |
|---|---|---|---|---|---|
| P01014 | 초고압직류송전시스템(HVDC) | AAA (카테고리 없음) | 2021-12 | 구버전 페이지. AAA009003 HVDC 카테고리와 중복 | 추가 불필요 (`hvdc`가 이미 카테고리 연결) |
| P01069 | 한류형 전력퓨즈(PF) | AAA (없음) | 2021-12 | AAA015004와 중복 | 불필요 (`pf`) |
| P01158 | Smart I/O 시리즈 | BBB001007 (c_display=False) | 2023-05 | BBB001005 Smart I/O와 중복 | 불필요 (`plc`) |
| P01228 | 고전압 DC Relay | BBB001010 (c_display=False) | 2023-05 | AAA017006 DC 릴레이와 중복 | 불필요 (`dc-devices`) |
| P01503 | SmartSIZER | BBB002006 (c_display=False) | 2023-05 | 서보 용량 선정 SW. 메뉴에서 빠짐 | 선택: `servo` (우선순위 낮음) |
| P88888 / P88890 / P88892 / P88894 | ESS 솔루션 / 적용 분야 / 제품 / 적용 사례 | CCC006001~004 (C 4개 포함) | 2021-10 | 구 ESS 솔루션 페이지. AAA013 ESS와 중복 | 불필요 (`ess`) |

→ 페이지는 열리지만 메뉴에서 빠진 구버전·중복 페이지입니다. 추가하지 않는 것을 권합니다.

#### a-2. 제품 id 없이 카테고리 본문에만 있는 모델·브랜드 (데이터에는 카테고리로만 있음)

카테고리 69개가 하위 제품 id 없이 끝납니다. 그중 산업 솔루션 소개 페이지 11개(BBB007·010~014)는 제품이 아닙니다. 나머지 약 58개는 카테고리 코드 접두사로 모두 기기에 연결돼 있지만, **모델명이 `products.json`에 없어서 검색되지 않습니다.** 대표 사례는 아래와 같습니다.

| 카테고리 코드 | 경로 | 본문에 적힌 모델·시리즈 | URL | 연결 기기 | 앱 검색 |
|---|---|---|---|---|---|
| AAA014006 | 저압기기 › MMS | Metasol MMS (영문: Metasol MMS, Meta-MEC MMS) | /ko/product/category/AAA014006 | `mms` | "Metasol MMS"를 검색하면 `ms`가 나옴 ✗ |
| AAA017001 / 002 | DC 전력기기 › Susol DC ACB·MCCB | Susol DC ACB, TSD·UTD·TD/TS Series | /ko/product/category/AAA017002 | `dc-devices` | "Susol DC" 검색 결과에 `dc-devices` 없음 ✗ |
| AAA017004 | DC MCB | BK63H DC | …/AAA017004 | `dc-devices` | — |
| AAA017003 / 005 / 006 | DC MC / DC SPD / DC Relay | — | — | `dc-devices` | — |
| BBB006001 | 고압드라이브 › M1000 | M1000 / M1000A | …/BBB006001 | `mv-drive` | "M1000" 검색 결과에 GIPAM1000만 나오고 `mv-drive` 없음 ✗ |
| BBB008001 / 002 | 소프트스타터 저압·고압 | SSC, SSM, SSH Series | …/BBB008001 | `soft-starter` | "SSM" 결과 0건 ✗ |
| AAA018001~007 | 스마트 기기 | IV-DAU, S-LINK, GIMAC-B, E COLLECTOR, M LINK, **GIMAC-B Branch, E TAG, GIMAC-TU**, Thermal CAM, TRIO, Panel HMI, TWS, i-Tester | …/AAA018003 | `smart-device` | "E TAG"·"Thermal" 0건, "GIMAC-TU"는 GIMAC 계측기만 나옴 ✗ |
| AAA014011 | DMC | Digital Metering and Controller | …/AAA014011 | `dmc` | — |
| AAA015002 / 003 | VC / VI | Susol VCS(영문명), Tri-MEC 호환 | …/AAA015002 | `vc-vi` | — |
| AAA015004 / 006 | PF / ALTS | DIN·KS 규격 PF | — | `pf` / `alts` | — |
| AAA007002 / 003 | EV 급속·완속 충전기 | 100kW·50kW / 14kW·7kW B·B-C Type | …/AAA007002 | `ev-charger` | — |
| BBB001012 | PLC › XG5000 SW | XG5000 | …/BBB001012 | `plc` | "XG5000" 0건 ✗ |
| BBB001022 | XSC/XSR Safety | XSC-D16P4S, XSR-FB3S·OS2S·ES2S·MF2S | …/BBB001022 | `plc` | — |
| BBB001019 / 020 | MASTER-K / GLOFA-GM (단종) | K120S~K300S / GM1~GM7 | — | `plc` | — |
| AAA019002 | 철도 DC System | DC 배전반, DC 정류기 | — | `railway` | — |

→ 제안: 카테고리 수준 라인을 **"카테고리형 제품"**으로 `products.json`에 넣거나(id는 카테고리 코드), 검색 색인에 카테고리 이름·`c_full_name`·본문 모델명을 별칭으로 추가합니다(5장).

#### a-3. 영문 사이트(`/api/products/list/en`)에만 있고 국문에 해당 페이지가 없는 시리즈

이름 정규화 후 대조했습니다. 국문에 다른 이름으로 있는 항목(Cubicle GIS = C-GIS, Susol & Metasol ACB, XBC/XEC U-Type = U타입 등)은 제외했습니다.

| 영문 id | 이름 | 영문 카테고리 | 국문 상황 | 제안 기기 |
|---|---|---|---|---|
| P00009 | Solution Power MCC | LV SWGR | 없음 | `mcc` |
| P01811 | LS EK60 | LV SWGR | 없음 | `lv-swgr` |
| P00003 | SIS | MV SWGR | 없음 | `mv-swgr` |
| P00037 | Metasol VCB | VCB | 없음 (국문은 Susol VCB만 있음) | `vcb` |
| P00039 / P00041 | Susol VCB for Special Purpose / for ANSI type | VCB | 국문은 발전소용·원자력용 VCB로 나뉘어 있음 (같은 제품인지 미확인) | `vcb` |
| P00051 | GIPAM2000 | Protection | 없음 (국문은 GIPAM2200DG) | `protection-relay` |
| P00062 | GIMAC-i | Measurement | 없음 | `power-meter` |
| P00025 / P00024 | UL MCB / BK·RK-Series MCB | MCB & CP | 국문은 BK63H·BK63HU만 있음 (RK·UL MCB 없음) | `mcb-rcbo` |
| P01260 / P01265 | IEC·UL Compact Susol DC Switch-Disconnector | DC Compact S-D | 국문 AAA017002 본문에만 일부 있음 | `dc-devices` |
| (카테고리) | DC UL Switch-Disconnector | AAA016008 | 별도 카테고리 없음 | `dc-devices` |
| P00217 | Flange Type DD Motor | DD Motor | 국문은 Standard DD모터만 있음 | `motor` |
| P00149 / P00150 / P00155 | iE5 / iC5 / iV5L | LV Drive | 국문 사이트에 없음 (SSQ에서는 '단종 제품'으로 분류) | `lv-drive` (단종 표시) |
| (카테고리) | DCS | AAA005 | 국문에 없음 | 새 기기 후보 또는 `scada` |
| (카테고리) | LSPS | AAA019 | 국문에 없음 (내용 미확인) | 보류 |
| (카테고리) | Mobile Substation | AAA010002 | 국문은 MGS·CSS·E-House | `modular-substation` |
| (카테고리) | EnGather PCS / Modular Scalable Platform | AAA012001/002 | 국문 ESS 본문에 일부 있음 | `pcs` / `ess` |

※ 영문은 목록 API의 이름만 대조했고 상세 페이지는 열지 않았습니다. 해외 전용(UL·ANSI) 제품이 섞여 있어 국내 제품맵 범위에 넣을지는 결정이 필요합니다.

#### a-4. Solution Square(sol.ls-electric.com)에만 있는 라인 (국문 사업소개에 없음)

| SSQ 카테고리 | 모델 | 제안 기기 | 비고 |
|---|---|---|---|
| 모션&Servo › 서보 드라이브 | **iX7M, iX700M, L7S, PEGA2** | `servo` | 국문에는 iX7NH·L7NH·L7NHF·PEGA·PHOX·L7P·L7C만 있음 |
| 저압 전동기 | **LS PMA SynRM** (LSLV…LPS) | `motor` (현재 partial) | 전동기 공백을 일부 메울 수 있음 |
| 감속기 › 유성 감속기 | SSR, SAR (국문 14종 외 추가) | 감속기 신규 기기 (c 참조) | |
| HMI | mPC, 3DView, wLXP, InfoU-RC/RT, WebPlant | `hmi` | |
| 진동 센서 | SS (LSLVSS-VT…) | `smart-device` 또는 `care` | |
| 리니어 물류 시스템 | LSMMT 제어기·모듈, L7MMT 드라이브 | `servo` | |
| 스마트시스템 | 스마트워크벤치, EdgeHub, DEXA, 머신비전 LSV | 범위 밖(공장 IT) 또는 `plc` | |
| 네트워크 솔루션 / 네트워크 스위치 | NTS, NPS / i-FOS-X | 범위 밖 또는 `scada` | |
| 스마트 데이터 서버 / RTU / 열화상 / IIoT | ETOS-X·XP, EtherFOS / ETOS-RCS, EtherFOS-EZ / DPS-TC 시리즈 / RCS-XG-4G | `smart-device`·`care`·`scada` | 계통 감시 쪽과 관련됨. 계열 제품인지 확인 필요 |

### (b) 데이터에 있는데 사이트에서 사라진 제품 — **0건**

199개 모두 메뉴·카테고리 트리·목록 API에 있습니다. 다만 상태와 품질 문제가 있습니다.

| 구분 | id | 이름 | 내용 |
|---|---|---|---|
| 사이트 `p_status=close` (단종)인데 데이터는 `discontinued:false` | P01190 / P01187 / P01189 / P01173 | iV5 / iG5A / iP5A / XP 시리즈 | 단종 표시가 반영되지 않음 (fetch 스크립트 주석에도 알려진 한계로 적혀 있음) |
| 사이트 `p_status=new` | P03087·P03088·P03082~86·P02212·P01263·P03079·P45745 | L-Series MCB/RCBO, USP 계열 SPD, GIPAM1000, S300, XGC-CPUX7, iXP3 | 신제품 배지 후보 |
| 제품이 아닌 항목 | P02220 / P02221 / P02222 | XGT·XGB·Smart I/O 일람표 | 카탈로그 목록 페이지. `plc`에 연결돼 제품 수를 부풀림 |
| 이름이 일반명사라 구분이 안 됨 | P02036·P02026·P02052 "디지털 입력", P01122·P02029·P02055 "아날로그 입력" 등 | PLC 모듈 | 검색 결과에 같은 이름이 여러 개 나옴 → "XGT 디지털 입력"처럼 앞에 계열명 붙이기 권장 |

### (c) 데이터에는 있지만 어떤 기기에도 연결되지 않은 제품 — **15건**

| id | 이름 | 카테고리 경로 | URL | 제안 |
|---|---|---|---|---|
| P01800 | MSS | 유성감속기 › 범용 유성감속기 (BBB004001) | https://www.ls-electric.com/ko/product/view/P01800 | 신규 `gearbox` 또는 `servo` |
| P01804 | MSR | 〃 | …/P01804 | 〃 |
| P01807 | MSO | 〃 | …/P01807 | 〃 |
| P01802 | MAS | 〃 | …/P01802 | 〃 |
| P01805 | MAR | 〃 | …/P01805 | 〃 |
| P01809 | MAO | 〃 | …/P01809 | 〃 |
| P01231 | HSS | 유성감속기 › 고정밀용 유성감속기 (BBB004005) | …/P01231 | 〃 |
| P01233 | HSR | 〃 | …/P01233 | 〃 |
| P01235 | HSW | 〃 | …/P01235 | 〃 |
| P01237 | HSD | 〃 | …/P01237 | 〃 |
| P01232 | HAS | 〃 | …/P01232 | 〃 |
| P01234 | HAR | 〃 | …/P01234 | 〃 |
| P01236 | HAW | 〃 | …/P01236 | 〃 |
| P01238 | HAD | 〃 | …/P01238 | 〃 |
| P01504 | DEXA | SOFTWARE › Backup 프로그램 (BBB009001) | …/P01504 | `plc` (PLC·HMI 프로그램·파라미터 백업 SW) |

- **감속기용 새 기기 종류를 권합니다(예: `gearbox` "유성 감속기", L7, 전동기 아래).** 공식 설명은 "모터 샤프트에 연결되어 감속·토크 증대"이고, 서보 모터와 함께 판매되는 기계 요소입니다. 전기 계통 노드는 아니지만 L7 부하측 "전동기 → 감속기 → 부하" 체인으로 설명할 수 있습니다. 새 기기를 만들지 않는다면 `servo`에 BBB004를 붙이는 대안이 있습니다. 다만 서보 패널의 제품 목록이 13개에서 27개로 늘어나 패널 8개 한도에 묻힙니다.
- DEXA는 기기 하나로 두기 어렵습니다. `plc`의 lseCategoryCodes에 BBB009를 추가하는 방안을 권합니다.

### (d) 연결은 됐지만 기기 이름만으로는 찾기 어려운 대표 브랜드

| 브랜드 | 대표 제품 id | 연결 기기 (이름) | 앱 검색 결과 (Playwright) | 문제 |
|---|---|---|---|---|
| **GIMAC** | P01084, P01079, P01080, P01081, P01255, P01083, P01214 | `power-meter` (디지털 계측기, 노드 n-pmeter) | ✓ 기기 1위 + 제품 6개. GIMAC-II Plus(P01081)는 제품 6개 한도(MAX_EACH)로 빠짐 | 타일 이름에 "GIMAC"이 없음 |
| **GIPAM** | P01072, P01249, P01074, P02212, P01075, P01076, P01077 | `protection-relay` (디지털 보호계전기), `relay-tx` | ✓ 기기 2개 + 제품 6개 + 옵션 | 양호 |
| **Susol** | P01105, P00206, P01021, P01261, P01062, P01101, P02206, P01022, P02207, P02216, P01910 + AAA017 | acb·mccb·ms·vcb·busway·lv-swgr·dc-devices 등 8개 이상 | △ 제품 6개 + 기기 1개(`acb`)만. "Susol DC" 검색 결과에 `dc-devices` 없음 | 브랜드가 여러 기기에 걸쳐 결과가 잘림 |
| **Metasol** | P01030, P01023, P01027, P01260 + AAA014006(MMS) | acb·mccb·elcb·ms·mms | △ 제품 4개 + `acb`. MMS는 나오지 않음 | MMS가 카테고리형이라 이름이 색인에 없음 |
| **iS7** | P01188 | `lv-drive` (저압 인버터) | ✓ | 양호 |
| **XGT** | P01113, P01114, P01505, P03079, P01218, P02220 | `plc`, `hmi` | △ 기기로 `hmi`만 나오고 **`plc`는 나오지 않음** (XGT InfoU·XGT Panel 이름 때문) | 대표 PLC 브랜드인데 PLC 기기가 안 나옴 |
| **XGB** | P01117~P01120, P02025 | `plc` | ✓ (단, 제품명이 "U타입"처럼 일반명사) | 제품명에 계열명이 없음 |
| **XG5000** | (BBB001012 카테고리) | `plc` | ✗ 0건 | 카테고리형 |
| **M1000** | (BBB006001 카테고리) | `mv-drive` (고압 인버터) | ✗ GIPAM1000·M100 등만 나옴 | 카테고리형 |
| **SSC/SSM/SSH** | (BBB008 카테고리) | `soft-starter` | ✗ "SSM" 0건 | 카테고리형 |
| **GIMAC-B Branch / E TAG / GIMAC-TU** | (AAA018003·004) | `smart-device` (분기 계측·데이터수집 기기) | ✗ 0건 또는 GIMAC 계측기로 오인 | 카테고리형 |
| **감속기 (MSS·HSS…)** | (c) 표 참조 | 없음 | △ "감속기"로 14개 중 6개만 나오고 기기 결과 없음 | 미연결 |
| **APS** | (AAA010006) | `aps` "무정전 전원 장치" | — | **매핑 오류**: 사이트상 APS는 Arc Protection System(내아크 보호). UPS 아님 |

## 4. 앱 검색 확인 (dist, `vite preview` 4177, Playwright Chromium)

| 질의 | 결과 수 | 1위 | 비고 |
|---|---:|---|---|
| GIMAC | 7 | 기기 `power-meter` | 제품 GIMAC 6개 |
| GIPAM | 10 | 기기 `relay-tx` | `protection-relay`, 제품 6개, 옵션 2개 |
| Susol | 7 | 제품 Susol Busway | 기기는 `acb`만 |
| Metasol | 5 | 제품 Metasol ACB | MMS 없음 |
| iS7 | 2 | 제품 iS7 | `lv-drive` |
| XGT | 7 | 제품 XGT InfoU S/W | `hmi`만 나오고 `plc` 없음 |
| XGB | 7 | 제품 XGB 일람표 | 일람표(비제품)가 1위 |
| 감속기 | 6 | 제품 MSS | 기기 없음, 14개 중 6개 |
| DEXA | 1 | 제품 DEXA | 기기 없음 |
| EMPR / MMS / VCB | 6 / 1 / 5 | 기기 | MMS는 제품 0개 |
| 디지털 계측기 / 계측기 | 8 / 10 | 기기 `power-meter` | |
| L7NH / iXP / PEGA / DriveView | 4 / 4 / 2 / 2 | 제품 | 양호 |
| Susol DC | 7 | 제품 Susol ACB | `dc-devices` 없음 ✗ |
| M1000 | 8 | 제품 GIPAM1000 | `mv-drive` 없음 ✗ |
| Metasol MMS | 5 | 제품 Metasol MS | `mms` 없음 ✗ |
| SSM / E TAG / Thermal / XG5000 / SmartSIZER | 0 | — | ✗ |
| GIMAC-TU | 7 | 제품 GIMAC-V | `smart-device` 없음 ✗ |

**디지털 계측기 타일(n-pmeter) 상세 패널**: 열림 ✓. "자사 제품 · 10개" 아래에 GIMAC-V, GIMAC-IV, GIMAC-PQ, GIMAC-II Plus, GIMAC1000, GIMAC-DC, GIMAC-B, IMD 8개가 표시되고 "외 2개 — 기기 상세 페이지에서 모두 보기"(Micro RTU-Ⅲ, TWS)가 붙습니다. **GIMAC 7종이 모두 패널에 보입니다.** `/equipment/power-meter` 페이지에도 GIMAC 7종과 자료가 표시됩니다. 콘솔 오류는 0건입니다.

→ GIMAC은 데이터·연결·검색·패널 모두 정상입니다. 사용자는 계통도 타일 이름 "디지털 계측기 DPM"에서 GIMAC을 떠올리지 못했을 가능성이 큽니다.

## 5. 제안 조치 (리더 결정용, 우선순위 순)

1. **[오류 수정] `aps` 기기 재정의**: 이름·설명을 "아크 보호 시스템(APS, Arc Protection System)"으로 바꾸고 배전반 보호 계열로 옮깁니다. "무정전 전원 장치"는 별도 기기(coverage missing)로 둡니다.
2. **[찾기 쉽게] 타일·패널에 대표 브랜드 표기**: 예를 들어 `power-meter` 부제에 "GIMAC", `protection-relay`에 "GIPAM", `plc`에 "XGT·XGB", `lv-drive`에 "iS7·S100", `mv-drive`에 "M1000"을 붙입니다. 화면 요소를 바꾸는 일이라 사용자 확인이 필요합니다. 대신 equipment에 `brands: string[]` 필드를 두고 검색 색인(EqDoc)에만 넣는 방법은 화면 변화가 없습니다.
3. **[검색] 카테고리형 제품을 검색 대상으로**: leaf 카테고리의 `name`·`c_full_name`·본문 모델명(a-2 표)을 별칭으로 넣습니다. 그러면 Metasol MMS, Susol DC, M1000, SSM, E TAG, XG5000 같은 질의가 해당 기기로 갑니다. 이 정보는 `#hd_entity`·`#hd_contents`에 이미 있어 fetch 스크립트에서 추출할 수 있습니다(추가 요청 0회, 이번 캐시 재사용 가능).
4. **[미연결 15건]** 감속기 14종은 새 기기 `gearbox`(L7, 전동기 하위)를 만들거나 `servo`에 BBB004를 붙입니다. DEXA는 `plc`에 BBB009를 붙입니다.
5. **[데이터 품질]** 단종 4건(`p_status=close`)을 `discontinued:true`로 바꿉니다(fetch 단계에서 `hd_categories`의 p_status를 읽으면 됨). 일람표 3건은 제품에서 빼거나 `kind:"catalog"`로 표시합니다. XGT·XGB 모듈의 일반명사 이름에는 계열명을 앞에 붙입니다.
6. **[범위 결정]** 영문 전용(a-3)과 SSQ 전용(a-4)은 국내 제품맵 범위인지 결정이 필요합니다. 넣는다면 `motor`(PMA SynRM), `servo`(iX7M·L7S·PEGA2), `vcb`(Metasol VCB), `power-meter`(GIMAC-i), `protection-relay`(GIPAM2000)부터 시작하기를 권합니다. 출처를 '공식 국문 자료실'로 한정한다면 '참고(영문/SSQ)' 표기를 붙입니다.
7. **[검색 순위]** 브랜드 질의에서 연결 기기가 여러 개면 기기 결과를 최소 1~2개 보장합니다(XGT에서 `plc`가 빠지는 문제). 검색 결과에서 일람표는 아래로 내립니다.

## 6. 후속 반영 (2026-11-18, 사용자 결정 반영)

사용자 결정: 제품 범위 = 국문 + 영문 + Solution Square 전 제품, 감속기는 새 기기, 브랜드명은 검색 별칭만.

| 항목 | 반영 내용 |
|---|---|
| 제품 | 199 → 243개. ko 198(기존 199 − 일람표 3 + 자료실 CTTS 2), en 18(EN-…), ssq 27(SSQ-…). `source` 필드 추가(생략 = ko) |
| 숨은 국문 페이지 9건 | 넣지 않음. SmartSIZER(P01503)는 서보 용량 선정 SW이고 카테고리가 비표시(c_display=False)라 제품이 아닌 `servo` 검색 별칭으로만 둠 |
| 카테고리형 라인 | 기기 `searchAliases`(화면 표시 없음, 검색 전용)로 모델명·브랜드 연결 |
| 감속기 | 새 기기 `gearbox`(L7, 전동기 아래, 기계 연계), BBB004 연결(유성감속기 14종 + SSQ SSR·SAR) |
| DEXA | `plc` 에 BBB009 연결 |
| `aps` | 아크 보호 시스템(Arc Protection System, 7.2~24kV)으로 정정, L4로 이동, 보유(owned). UPS 기기는 새 타일이 필요해 만들지 않음(화면 배치 변경 금지) |
| 단종·일람표 | iV5·iG5A·iP5A·XP 시리즈 discontinued, XGT·XGB·Smart I/O 일람표 3건 제품에서 제외 |
| **`lv-ats` 공백 판정 취소** | missing(confirmed) → **owned**. 사유: 공개 자료실에 LV CTTS 카탈로그(d_id 421413, AAA010002, 2026-10)와 ACB 기반 ATS CAD("[Susol_Metasol ACB] ATS with ACB", d_id 417569·417570)가 있음 → 공백 확정 판정 취소. MV CTTS(d_id 420271)는 `alts` 에 연결 |

## 7. 후속 반영 2 (2026-11-18, UPS·SSQ 협력사·영문 재확인)

스크립트·캐시: `/private/tmp/claude-501/-Users-kjmoon-LSE-News/37bcf7f5-4ef4-4874-8316-789fc9001612/scratchpad/ups/` (`scripts/`, `cache/`, `requests.log`, `en_pw.json`)

### 7-1. 무정전 전원 장치(UPS) — 새 기기 `ups`, 미보유(공백 후보)

| 확인 경로 | 결과 |
|---|---|
| 국문 자료실 API `ko/api/download.ashx?t=list` (Referer `/ko/download/`) | "UPS" 0건, "무정전" 1건 = MV CTTS(무정전 자동절체 스위치, d_id 420271) → UPS 아님 |
| 국문 제품 검색 API `ko/api/search.ashx?t=product` | "UPS"·"무정전" 0건 |
| SSQ 자료 `dlCenter` (docTypes 지정, 양성 대조 "iS7" 5건 확인) | "UPS"·"무정전" 0건 |
| SSQ 통합검색 `restSearchBff` | "UPS" 10건 = PLC·인버터 Q&A·기술 가이드뿐(외부 UPS 연동 질문), "무정전" 0건 |
| SSQ 카테고리 자동완성 / 카드 254개 | 0건 |
| 국·영문 제품 목록 API, 국문 카테고리 137개 본문 | UPS 라인 없음. E-House(AAA011001) 소개에 "UPS·배터리"를 통합 설비로, DC MC 적용처로 "UPS"를 언급하는 정도 |

- 판정: `coverage: missing`, `gapAssessment {supplyMode: not-offered, basis: homepage-menu, confidence: candidate}` — **확정하지 않음**(사업부 확인 필요). 근거 URL 4건을 evidence에 기록.
- 계통도: L6 저압 배전, 노드 `n-ups` (1334, 3312) — 버스웨이 왼쪽(오른쪽의 순간전압보상장치와 대칭). 연결 `e089` 버스웨이 → UPS(전력), `e090` UPS → HMI(전력, "무정전 제어 전원"). 관리자 draft 로직(addNode·addEdge, router A*)으로 경로 계산, DI 오류 0.
  - 예전 aps 자리(1668, 3474)도 검토했지만, 그 자리에서 중요 부하(HMI·PLC)로 가는 선이 버스웨이 → 서보 선(e068)과 교차(DI-45a)해서 쓰지 않음.
  - 순간전압보상장치와는 직렬로 잇지 않음(예전 e049 sag → aps는 실제 구성과 맞지 않음). 설명에 "Sag만 보상 vs 정전 자체를 배터리 시간만큼 견딤"으로 차이를 적음.
- 사진 없음 → UPS 전용 심볼(EquipmentSymbol BY_ID `ups`).

### 7-2. SSQ 협력사 라인 8개 — **SSQ 파트너 제품, 자사 제품맵 범위 밖** → 제거

| SSQ id | 이름 | SSQ 상위 카테고리 |
|---|---|---|
| 333 / 380 / 332 | ETOS-XP / ETOS-X / EtherFOS | 스마트 데이터 서버 |
| 345 / 344 | ETOS / EtherFOS | RTU |
| 346 | DPS | 열화상 |
| 347 | RCS-XG-4G | IIOT 모듈 |
| 348 | i-FOS-X | 네트워크 스위치 |

- 근거: SSQ 게스트 카드 API에서 이 카테고리 5개(327~331)와 하위 카드 52개 모두 `cardDescription = "AC&T"`(다른 카드는 제품 설명 문구)이고, `homepageUrl`이 `acnt.co.kr`로 연결됨. acnt.co.kr은 별도 회사 "AC&T System(에이씨앤티시스템)" 홈페이지이며 EtherFOS·RTU·RCS-XG·열화상·i-FOS를 자사 시리즈로 소개함(별도로 "LS ELECTRIC 융합 제품 시리즈" 메뉴가 있음).
- 조치: `products.json`에서 SSQ-333·380·332·345·344·346·347·348 제거(243 → 235). 기기 `productIds`에 연결된 것은 없었음(카테고리 코드 AAA003·AAA018004·AAA018006로만 묶여 있었음).
- 같은 "네트워크 솔루션"의 NPS·NTS(SSQ 863·864)는 제조사 표기가 없고 외부 홈페이지 링크도 없어 **남겨 둠**(판단 보류 아님 — 자사 표기와 같은 형식).

### 7-3. 영문 전용 18개 — 단종 0, URL 3개 교정

- 영문 상세 API는 화면과 같은 파라미터 전체(`/api/products/views?page=1&rows=10&keyword=&p_lang=en&c_depth1=…&c_depth2=…&c_depth3=…&p_code=&c_code=&p_name=…`)를 넘기면 응답함(지난번 빈 응답은 `p_code`만 넘겨서 서버가 연결을 끊은 것).
- `p_status`: 13개 제품 모두 `close` 아님(빈 값 12, `new` 1 = Flange Type DD Motor). 영문 검색 목록 API(`/api/products/search?p_lang=en`, 240건)에서 18개 모두 `p_display = true`, 영문 A-Z 목록(`/api/products/az?p_lang=en`)에도 모두 있음. → **단종 없음, `discontinued: false` 유지.**
- 참고(자료 갱신이 오래된 것, 단종 근거는 아님): GIPAM2000·GIMAC-i(자료 2019~2020), SIS·Solution Power MCC·LS EK60(제품 지정 자료 없음), DCS(자료 0), Mobile Substation(2019 카탈로그).
- URL: 18개 모두 브라우저(Playwright)로 열어 제품 화면(`Beyond X™ <제품명>`)과 `p_code` 일치를 확인. 사이트가 링크를 만들 때 `p_url`을 쓰는 3개는 그 값으로 교정:
  - EN-P00024 `…/MCB_%26_CP/BK!RK-Series_MCB` → `…/MCB_%26_CP/MCB` (기존 주소는 `!`가 `/`로 풀려 경로가 어긋남)
  - EN-P00039 `…/Susol_VCB_for_Special_Purpose` → `…/Susol_VCB_for_special_purpose`
  - EN-P00217 `…/Flange_Type_DD_Motor` → `…/DD_Motor_Flange_Type`

### 7-4. 요청 수

- ls-electric.com·ssq·acnt 직접 요청(curl, 1.3초 이상 간격) 59회(200 51·500 2·404 1·빈 응답 5), 브라우저 확인 21페이지에서 실제 전송 604회, 합계 663회(이미지·폰트·hits 요청은 차단해 보내지 않음). 자세한 목록은 `requests.log`.
- ⚠ 브라우저 확인은 페이지 하나를 열 때 JS·API 요청이 동시에 나가 1.2초 간격 규칙을 지키지 못함(페이지 사이 간격만 약 4초).
