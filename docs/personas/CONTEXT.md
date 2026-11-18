# 페르소나 토론 공통 브리핑 (1차 구현 기준, 커밋 51d8dd9)

## 앱 한 줄 정의
LS ELECTRIC 제품을 전력계통도(L1 초고압 765/345kV → L7 분전반 하단 + 신재생·감시)에 사진 타일로 매핑해,
제품 위치·공백(Gap)·데이터시트를 한눈에 보고 신입 교육에도 쓰는 사내 웹 포털 (GitHub Pages 정적 사이트, 외부 공개).

## 현재 구현된 것
- 메인 계통도: 기기 74종(각 1회) 사진 타일, 노드 74 · 연결선 77, 줌/패닝, 미니맵, 계층 바로가기, 검색(기기·제품·모델명)
- 기기 선택 → 상세 패널: 사진, 계층·전압·기능, 설명, 신입 학습 포인트, 자사 제품 목록, 카탈로그·매뉴얼·데이터시트 링크(공식 자료실), 연결 기기
- 커버리지 5상태: 보유 56 · 일부 보유 3 · 계열사 보유 2(LS전선) · 미보유 12(공백 후보, 홈페이지 기준 — 실제 확인 필요) · 해당 없음 1
- Gap 모드(?mode=gap): 같은 계통도에서 공백만 강조, 공백 메모, 연결된 자사 제품
- 제품 상세: 자료(제품 199개, 자료 755건 수집), 계통 속 위치, 같은 기기의 다른 제품 — 사양 표는 없음(미수집)
- 공백 표(/gap): 계층 × 기능 매트릭스, 공백 목록 17건, CSV 내보내기
- 교육(/learn): 7단계 투어(L1→L7), 계층 소개, 핵심 기기, 퀴즈 20문항(초안·검토 필요), 용어집 36, 진도(브라우저 저장)
- 모바일: 계층 칩, 하단 시트
- (진행 중) 관리자 모드: 브라우저에서 기기 추가·배치·연결 → JSON 내보내기 → 저장소 커밋

## 데이터 출처·한계
- 제품·카테고리: ls-electric.com 메뉴(199 제품, 137 카테고리), 자료: 공식 자료실 2곳 공개 API, 사진: 공식 사이트(사내 허가)
- 기기 74종 매핑·설명·학습 포인트는 팀이 작성한 초안. 가격·재고·사양·고객사례·경쟁사 정보는 없음
- 외부 공개 사이트이므로 대외비·고객정보는 넣을 수 없음

## 참고 자료 (읽기)
- 기획: /Users/kjmoon/LSE_News/PLAN.md
- 승인 디자인: /Users/kjmoon/LSE_News/docs/design/ (Main, Gap, Product, GapTable, Learn, Mobile .dc.html)
- 실제 화면 스크린샷: /private/tmp/claude-501/-Users-kjmoon-LSE-News/37bcf7f5-4ef4-4874-8316-789fc9001612/scratchpad/
  - r2-full.png(전체 계통도), r2-main.png(메인·VCB 선택), r2-search-is7.png(검색), r2-learn-finish.png(투어 완료)
  - p2-product.png(제품 상세), p2-gaptable.png(공백 표), p2-learn.png(교육), p2-equipment.png(기기 상세), p2-mobile.png, p2-gap.png
- 데이터: /Users/kjmoon/LSE_News/src/data/equipment-types.json (기기 74종), docs/research/product-mapping.md (공백 후보)
- 교육 콘텐츠: /Users/kjmoon/LSE_News/src/content/learn.json

## 1라운드 산출물 형식 (docs/personas/round1/<영문id>.md, A4 1~2쪽)
1. 나는 누구인가 (역할·하루 업무·이 앱을 열 상황)
2. 이 앱으로 꼭 하고 싶은 일 Top 3 (시나리오, 현재 가능한가: 가능/부분/불가)
3. 좋은 점 (구체적으로, 화면 근거)
4. 문제점 (심각도 높음/중간/낮음, 화면·데이터 근거)
5. 제안 (각각: 내용 / 기대 효과 / 노력 S·M·L / 우선순위 P0·P1·P2 / 필요한 데이터·리스크)
6. 다른 부서와 충돌할 것 같은 지점 (예: "영업은 X를 원하겠지만 나는 Y")
7. 성공 지표 1~2개
- 근거 없는 주장 금지, 데이터에 없는 사실을 지어내지 말 것. 외부 공개 사이트 제약을 고려할 것.

## ⚠️ 리더 정정 (2라운드 필독)
- p2-*.png 스크린샷 일부(p2-product, p2-equipment, p2-gaptable, p2-learn)는 **메인 화면 작업 도중에 찍혀 좌측 메뉴 스타일이 깨져 보였던 것**입니다. 현재 커밋(51d8dd9)에서는 정상입니다.
- 최신 스크린샷(51d8dd9 빌드, 2라운드 근거로 사용): /private/tmp/claude-501/-Users-kjmoon-LSE-News/37bcf7f5-4ef4-4874-8316-789fc9001612/scratchpad/cur/
  - main.png(VCB 선택), gapmode.png(Gap 모드·CT/PT 선택), product.png, equipment.png, gaptable.png, learn.png(L4 단계), mobile.png
- 리더가 새로 발견: 제품 상세 "계통 속 위치" 미니 체인의 오른쪽 타일(VCB)이 상자 밖으로 넘침
