# overview-b 작성 근거 (L5·L6·L7·REN, 38종)

작성일: 2026-11-18 · 결과: `overview-b.json` · 상태: 미검수

## 근거 자료
- 기존 사양 추출 캐시(scratchpad/specs, txt)와 `src/data/specs.json`의 페이지 인용값을 우선 사용. 페이지는 PDF 페이지 번호.
- 새로 받은 PDF 6건(요청 6회, UA `LSE-ProductMap/0.1`, 간격 1.3초, 다운로드 카운트 API 미호출): Susol Busway, Susol LV SWGR, Smart MCC, iX7NH, XGB 시리즈, XGT Panel 카탈로그.
- catalog 25종 / general 13종.

## 기기별 근거 요약
| 기기 | basis | 근거 |
|---|---|---|
| cast-tr | catalog | 몰드변압기 p3(36kV·30MVA, 난연), p4(Susol 내진), p6(특수용도), p14(F종) |
| oil-tr | catalog | 유입변압기 p3(PDPS·친환경유 목차), p4(550kV·800MVA, 냉각), p7(배전용) |
| lv-swgr | catalog | Susol LV SWGR p4~5(690V·6300A·100kA/1s·Form 4b·IP54), Smart LV p4 |
| acb | catalog | Susol ACB p18~19, Metasol ACB p4~5, Susol Compact ACB p5, 1150Vac 카탈로그 p2 |
| mccb | catalog | Metasol MCCB p22, Susol MCCB p5~6, Smart LV p49 |
| busway | catalog | Susol Busway p4, p6 |
| spd | catalog | SPD 카탈로그 p4(BK AC), p9(BK DC 1500V), p33(USP), p42(USPE) |
| power-meter | catalog | GIMAC1000 p3·p5, GIMAC-V p2~3, GIMAC-IV p10 |
| mcc | catalog | Smart MCC p2~4 |
| branch-mccb | catalog | 분전반 산업용 카탈로그 p3, p14(ABE Fb) |
| elcb | catalog | Metasol ELCB A Type p2~3, 분전반 카탈로그 p18 |
| mcb-rcbo | catalog | 분전반 카탈로그 p4, p6(BK63H) |
| mms | catalog | Metasol MS p142~143(MMS 32AF·63AF, 0.1~65A, UL 조합표) |
| ms | catalog | Metasol MS p3·p6~7, Susol MC p14, Mini MS p10 |
| empr | catalog | GMP p4, DMPi p9, MMP p3·p17 |
| soft-starter | catalog | LV Soft Starter p2·p6~7, Soft Starter p8~9 |
| lv-drive | catalog | iS7 p13~14, S100 p12, H100 p5·p13 |
| servo | catalog | iX7NH p2~4 |
| plc | catalog | XGB p3·p5·p7 |
| hmi | catalog | XGT Panel p2·p3·p5·p6 |
| smart-device | catalog | Smart LV Solution p4~5(부속기기 구성) |
| pv, ess | catalog | 기술 설명은 일반 지식. 인용한 사실은 Susol ACB 1150Vac 카탈로그 p2(PV·ESS·풍력용) 하나뿐 |
| dc-devices | catalog | SPD p9, 분전반 카탈로그 p4(DC MCB 1000V 4극 10kA). 제품군 이름은 lse-product-tree.txt |
| railway | catalog | 몰드변압기 p3·p6(전철 급전용). AC/DC System은 lse-product-tree.txt |
| capacitor, lv-ats, emergency-gen, panelboard, lighting-outlet | general | 자사 제품 언급 없음(missing/na) |
| sag-protector, aps, ev-charger, dmc, pcs, microgrid, modular-substation, motor | general | products.json에 제품이 없거나(카테고리만 있음) 자료가 없음. 자사 문장은 카테고리 이름 수준만 씀 |

## 확신이 낮은 문장 (검수 필요)
1. **dmc**: "계기·보호계전기·보조 릴레이·트랜스듀서 기능을 한 장치로 통합"은 일반적인 DMC 개념이다. LS ELECTRIC DMC 카테고리의 실제 제품 사양은 확인하지 못했다.
2. **sag-protector**: "Sag는 대부분 수 사이클에서 1초 이내", "UPS보다 짧은 보상 시간" 같은 문장은 일반론이다. 자사 제품의 보상 방식(커패시터 등)은 확인하지 못했다.
3. **aps**: APS를 UPS형(배터리·인버터) 장치로 보고 썼다(기존 learnPoints 기준). 자사 APS가 정확히 어떤 구성인지는 확인하지 못했다(gapNote도 확인 필요로 남아 있음).
4. **ev-charger**: "완속 7kW급, 급속 수십~수백 kW급"은 국내 일반 수치다. 자사 모델 정격은 확인하지 못했다.
5. **railway**: "고속·일반철도 AC 25kV, 도시철도 DC 1500V·750V"는 국내 일반 사례다(일부 노선은 예외).
6. **plc**: XGK-CPU·XGI-CPU·XGR-CPU는 products.json 이름만 썼다. XGT 시리즈 카탈로그는 받지 않았다.
7. **soft-starter**: LVSS 17~1080A는 p6 선택 가이드의 최소~최대 모델(101~505)을 이은 값이다.
8. **acb**: Susol Compact ACB를 "800~1600AF급"으로 썼다. AR 타입은 800·1000AF이다.
9. **power-meter**: GIMAC-DC를 "직류용"으로 쓴 것은 제품명 기준이다. 카탈로그 본문은 확인하지 않았다.
