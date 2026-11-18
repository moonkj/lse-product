# process.md — 구현 진행 기록 (팀리더 관리)

## 2026-11-18 · Phase 0 (계획)
- 요구사항 분석 및 PLAN.md(UX 설계 + 설계 요약 + 팀 운영안) 작성
- Tasklist.md 공유 보드 생성
- 환경 점검: git·python3 있음 / node·tmux·gh 없음 → 설치 필요
- 다음 단계: 사용자 결정 사항 회신 후 Phase 0 스캐폴딩 착수
- [결정] 계통도 범위 확정: 초고압(765/345kV) → 154kV 송변전 → 22.9kV 배전·수전 → 변압 → 저압 배전 → 분전반 하단(L1~L7) + 신재생 연계 + 감시
  - 영향: 데이터 모델 layer 필드 L1~L7로 변경, 계통도 크기 증가 → 미니맵·계층 점프 내비게이션 추가
- [결정] 데이터 출처: LS ELECTRIC 공식 사이트 (ls-electric.com/ko/download, ssq.ls-electric.com dlcenter). 연계/공통 제품 보유 확인
  - 조사: 사이트 메뉴 스크립트(/ko/common/js/site/menu)에 제품 트리 전체가 JSON으로 들어 있음 → 343항목 추출
  - 두 자료실은 JS(AngularJS 등)로 목록을 불러옴 → Phase 1에서 데이터 API 주소 파악 필요
  - 방침: PDF는 다시 올리지 않고 공식 자료실로 링크
  - 산출물: docs/research/lse-product-tree.txt, docs/research/product-mapping.md (공백 후보 11개)
- [결정] 상태 5종(보유/일부/계열사 보유/미보유/해당없음), 배포=GitHub Pages(HashRouter), 저장소=로컬 git 우선
- [환경] node v26.13.1 LTS + gh 2.104.0 → ~/.local/bin 설치 (SHA256 검증), ~/.zshrc PATH 추가. tmux는 Homebrew 부재로 보류
- [git] 저장소 초기화 및 계획 문서 첫 커밋

## 2026-11-18 · Phase 0 팀 가동 (병렬)
- T1 스캐폴딩 / T2 자료실 API 조사 / T3 테스트 계획을 동시에 시작 (tmux 대신 Claude Code 병렬 에이전트)
- 리더: 계통도 데이터 생성기 작성 → equipment-types 74종 (보유 56 · 미보유 12 · 일부 3 · 계열사 2 · 해당없음 1), 노드 74, 엣지 77. 카테고리 코드·제품 ID 전부 홈페이지 트리와 대조 검증
- 스타일 결정: Tailwind 대신 CSS 변수 토큰 + 일반 CSS (의존성 축소, SVG 위주 앱)
- 교차 영향: DiagramLayer에 x, width(optional) 추가 → T1·T3에 공지
- [T1 완료] 스캐폴딩 + 제품 수집(제품 199, 카테고리 137). 리더 재확인: npm run build 통과
- [T3 완료] 테스트 계획(DI 규칙 48, 기능 28, E2E 5). 리뷰 우려 R-01~R-10 → 리더 결정을 PLAN.md 7항에 반영
- [T2 완료] 자료실 공개 API 확보 (www download.ashx + Referer, ssq guest API). 리더 재현: XGIPAM 자료 35건, 카탈로그·매뉴얼 PDF 직링크 확인
  - 결정: 자료는 수동 실행 스크립트로 수집해 docs.json 커밋, 배포 시 재수집 안 함. 공개 문서만, 개인정보 필드 제외
- [T2 디버거 완료] 스캐폴딩 점검: 높음 2 / 중간 7 / 낮음 11 → docs/reviews/phase0-debug-report.md
  - 리더 판단: 보기 모드 구조 변경(중간3)은 화면 동작이 바뀌므로 사용자 확인 대기, 나머지는 T1 수정 라운드로
- [T3 완료] Vitest·Playwright 구성, DI 테스트 51/51 통과(리더 재확인), E2E 스모크 1 통과·21 skip(Phase 2 대기). deploy.yml에 test 단계 추가
  - npm audit high 6건 = 개발용 picomatch 한 건의 연쇄, 배포 의존성 취약점 0건 (리더 확인)
- [진행] T1: 디버거 이슈 수정 + fetch-docs 스크립트(5개 제품 시범 수집)
- [T1 완료] 디버거 이슈 수정(H1·H2·M1~M7, 낮음 5건) + scripts/fetch-docs.mjs, 5개 제품 시범 수집(25요청)
  - 리더 재확인: typecheck(src·tests) 통과, 테스트 51/51, build 통과, docs.json 이메일 0건
  - 라이트 모드 '일부 보유'·'해당 없음' 색을 대비 기준(3:1)에 맞게 조정
- [사용자 결정] Gap 버튼 = 계통도 위 강조, 공백 표는 좌측 메뉴 링크 → Phase 2에서 구현
- [커밋] Phase 0·1 완료

## 2026-11-18 · 화면 디자인 단계 (사용자 요청: 구현 전 디자인 먼저)
- T1 Phase 2 구현 중단(파일 변경 전), Claude Design 캔버스로 화면 디자인 시작
- 계정의 'Design System'은 내용이 비어 있어 앱 토큰(tokens.css) 기준으로 디자인
- [사용자 결정] 계통도는 74종을 각각 한 번씩 표시 / 기기 자리는 대표 제품 사진 / 공식 사이트 사진·데이터시트·카탈로그 이미지 사용 허가
- [데이터] 자료 수집 완료: 제품 199개, 자료 755건(자료 없는 제품 15개), 요청 584회. DI·컴포넌트 테스트 80/80 통과
- [데이터] scripts/fetch-images.mjs → 기기 59종 대표 사진(public/images/equipment, 455px 투명 PNG) + src/data/equipment-images.json. 미보유·해당없음·선로 15종은 단선결선도 심볼로 표시
- [T3 완료] docs.json 규칙(DI-60~68), 컴포넌트 테스트 20건, E2E 29건(12 통과 / 17 Phase 2 대기)
- 디자인: 메인(사진 타일, L4~L5 확대 보기) 1차안 게시 → 사용자 검토 대기
- [디자인 v1 완료] 6개 화면 게시: 메인(사진 타일) · Gap 강조 · 제품 상세 · 공백 표 · 교육 투어 · 모바일 → docs/design/ 에 사본 저장

## 2026-11-18 · Phase 2~5 구현 착수 (디자인 v1 승인)
- 리더: 계통도 배치를 사진 타일(120×116)용으로 확대 (SX 1.45, SY 1.8 → 2320×3888, L4 행 간격 조정, 타일 겹침 자동 검사)
- 리더: equipment-images.json 스키마·로더(equipmentImageUrl) 추가 → 커밋 7c70b84
- 병렬: T1-A 메인 계통도(사진 타일·줌/패닝·선택·?node·Gap 강조·미니맵·모바일 시트) / T1-B 제품 상세·기기 상세·공백 표·교육 투어(learn.json 초안, 검토 필요 표시)
- 파일 소유 분리로 충돌 방지 (A: diagram/layout/panel/Home, B: pages/content, 리더: data/schema/scripts, T3: tests)
- [T1-B 완료] 제품 상세·기기 상세·공백 표·교육 투어(learn.json: 7단계, 퀴즈 20, 용어집 36, draft 검토 필요). typecheck·build·test 80/80, 관련 E2E 9/10(1 skip)
  - 리더 판단: 공백 표 기본 필터는 승인 디자인대로 "전체" → 수정 라운드에서 T1-B 변경 + T3 테스트 조정
  - 리더 확인: 스크린샷상 좌측 내비·헤더 스타일 깨짐은 T1-A 진행 중 영역 → T1-A 완료 후 재확인

## 2026-11-18 · 점검 라운드 → (개선 R2)
- [T1-A 완료] 메인 계통도 구현, E2E 27/29 → 커밋 1ce6811 (T1-B 페이지 포함)
- [T2 완료] phase2-debug-report: 높음 2(연결선 13개가 타일 관통 28곳, iS7 검색 오동작) / 중간 8 / 낮음 14
- [T3 완료] 테스트 114(DI 74 규칙), E2E 28/30, 코드 리뷰: 반드시 6 / 권장 10 / 선택 9
- [리더 결정·작업]
  - 연결선 관통: 생성기에 가시성 그래프 A* 우회 경로 → edge.points (14개), 렌더러는 그대로 그림 → 커밋 029daea
  - 사진 10MB → 원본 320px + 썸네일 160px(thumb) → 029daea
  - resolveProducts 하위 카테고리 포함(M3) → 88e45e2
  - 교육 투어 완료: L7에서 tour-next disabled 유지 + "투어 완료"(tour-finish) 버튼
  - 공백 표 기본 필터 "전체"(디자인 우선), E2E-1은 /learn 기준(디자인 우선)
- (개선 R2) 병렬: T1 = 버그·리뷰 반영 + 공용 컴포넌트 통합 + 코드 분할 / T3 = DI-80 수정, DI-44(관통 0건), R2 테스트 선반영
- [(개선 R2) 완료] T1: 버그(높음2·중간8·낮음 일부)·리뷰(반드시 6·권장 R1/R3/R4/R6/R7/R8/R10) 반영, 투어 완료, 코드 분할 / T3: DI-44 관통 0건, DI-80/82b, UT-02/03, E2E 갱신
  - 리더 재검증: typecheck(src·tests)·build 통과, unit 126/126, E2E 33 통과·1 skip·0 실패, 전체 보기 스크린샷에서 선 관통 없음
  - 번들: 단일 714kB → 첫 화면 208kB + 공유 461kB + 페이지별 청크
  - 남은 항목: L2 히스토리 정책(push/replace), R5 파생 캐시 통합, R9 DataValidationError 분리(리더), docs.json 동적 import(리더), 공백 후보 12건 사용자 확인, learn.json 교육 담당 검토, GitHub 원격·Pages 배포

## 2026-11-18 · 관리자 모드 + 페르소나 토론 (고도화)
- [사용자 요청] 관리자 모드(계통도 기기 추가) + 임원·UX/UI·실무자·연구소·설계·영업·마케팅 등 페르소나 토론으로 고도화, 토론 내용 공개
- [리더 결정] 관리자 모드 = 브라우저 편집 + 초안 자동 저장 + JSON 내보내기/가져오기 → 저장소 커밋으로 반영 (GitHub API 반영은 원격 연결 후). 앞으로 src/data/*.json 이 원본, Python 생성기는 시드용. /admin 은 보안 장치 아님을 명시
- 병렬: T1 관리자 모드 구현 / 페르소나 8명 1라운드(exec, uxui, field, rnd, design, sales, marketing, newbie+HRD) → 2라운드 교차 반박 → 리더 종합 → 사용자에게 토론 페이지 공개
- 원칙: 토론 결론 중 기존 화면을 바꾸는 항목은 사용자 확인 후 진행
- [토론 완료] 1라운드 8 + 2라운드 8 문서 → docs/personas/DEBATE.md 정리, 토론 페이지 게시(docs/personas/debate.html 사본)
  - 합의 P0(8/8): 공개판/사내판 분리 · 계통 연결 오류 정정+설계 검수 · 공백 판정 근거+15건 검증("패널 구성품" 7/8)
  - 결정 대기 D1~D19, 리더 권고안 제시 — 화면 변경 항목은 사용자 확인 후 진행
- [사용자 결정 11-18] 공개판/사내판 **분리하지 않음** (D1 기각). Gap 모드·공백 표 공개 유지 → 공백 판정 근거·후보/확정 표시(D6·D8)의 중요도 상승
- [사용자 결정 11-18 추가]
  - 진행: 계통도 오류 수정(D3·D4) · 공백 후보/확정 구분(근거 필드, 점선/실선, D8) · '패널 구성품' 6번째 상태(D6)
  - 공식 고지 문구 넣지 않음(D14), 교육 완료 기준 변경 안 함(D11)
  - 교육: 퀴즈·학습 진도·수료(투어 완료 요약) 전부 제거, 계층 투어 학습 내용과 용어집만 유지 (D12·D13 불필요)
  - 착수 순서: T1 관리자 모드 완료 후 → 리더 데이터·스키마(새 상태·근거 필드·계통 정정) → T1 구현(개선 R3) → T2·T3 점검
- [관리자 모드 완료] /#/admin: 기기 추가·수정·삭제, 배치·이동(겹침·밴드 검사), 연결선(TS 라우터 우회 경로, Python과 77/77 일치), 되돌리기 50단계, 초안 자동 저장, 내보내기 전 무결성 검사, JSON 내보내기·가져오기, 미리보기. 별도 청크 65kB
  - 리더 재검증: build·unit 126·E2E 33 통과 / 결정: 일반 화면에 관리자 링크 없음(직접 주소), 사진 변경 시 equipment-images.json 함께 내보내기 허용 / README 작성

## 2026-11-18 · (개선 R3) 리더 데이터·스키마
- 생성기 개편(시드 생성기, 아직 관리자 편집분 없음): 노드 83 = 기기 74 + 참조 타일 3(345/154kV TR, 22.9/6.6kV TR, TR2 2차 ACB) + 모선 2(22.9kV, 380V) + 끝점 4(고압 전동기, 비상 부하, PCS 연계 표시 2) / 연결선 86
  - 계통 정정 7건: 345/154kV 변압기, 22.9/6.6kV 변압기, PF형 피더 분리(VCB 직렬 제거), 유입TR 2차 별도 ACB(병렬 운전 방지), 인입 택1(LBS/ASS vs ALTS, 예비 회선 별도), ATS 비상 부하, 기동 방식 택1. 약어 MTR 중복 → 승압 TR "GSU"
  - 검증: 타일 겹침 0, 연결선 타일 관통 0, 전력선끼리 교차 0 (신호선 교차 23은 흐린 감시선)
  - L4 밴드 480 확대, 전체 높이 2340(기준) → 4212px
- 데이터: coverage 'sourced' 신설(LA·MOF·CT/PT), gapAssessment(근거·확신도) 17건 모두 candidate(홈페이지 기준), GIS·승압TR 정격 확인 필요 표시, diagram.review = 검수 대기
- 스키마: Coverage+sourced, GapAssessmentSchema(+규칙), DiagramNode kind(equipment/bus/endpoint)·ref·layer·width, DiagramEdge kind alt·label, Diagram.review
- [(개선 R3) 구현 완료] T1: 모선·끝점·참조 타일·택1 연결선 표시, 검수 대기 배지, 공백 후보(점선)/확정(실선)+공백 판정 패널, 패널 구성품 6번째 상태, 교육 퀴즈·진도·수료 제거, 모바일 칩·미니 체인 버그, 관리자 모드 새 노드 종류·판정 편집·전력선 교차 검사, router.ts Python과 86/86 일치. 자동 모선(3갈래 묶음) 제거 — 데이터 모선으로 대체
  - T3: DI 94(전력선 교차 0, 모선 수직, 공백 판정 규칙 등), 컴포넌트 6상태·참조·확신도, E2E-6 / 리더: 모선 width 짝수 버그 수정(T3 발견)
  - 리더 재검증: typecheck(src·tests)·build 통과, unit 145/145, E2E 40 통과·1 skip·0 실패
- [R3 점검] T2: 높음 2(모선 연결이 모선 끝에서 가로 출발, 모선 겹침 검사 없음)·중간 5·낮음 12, 관리자 검사 통과→DI 실패 9종 재현 / T3 리뷰: 반드시 1(관리자 검사 ≠ DI 규칙)·권장 9·선택 5 → 최종 완료 보류
- [리더] DataValidationError → src/lib/errors.ts(R6), 시드 생성기 동결(--force 필요) → 1114bc5
- (개선 R4) 착수: 검사 규칙 단일화(src/lib/integrity/ 공용 모듈 = 관리자 검사 + DI 테스트), 경로 계산 router.ts 단일화, 자동 모선 잔재 삭제, 모선 수직 연결·겹침, 검수 상태 자동 갱신. 순서: T1 → T3(테스트를 공용 모듈로 전환·골든 라우터 테스트·관리자 테스트) → T2/T3 재점검
- [(개선 R4) T1 완료] src/lib/integrity/ 공용 검사(checkDataset/checkEquipment/RULES, HARD·SOFT = DI 테스트와 동일), 관리자 검사 전환, router 단일화(model 사본 삭제), 자동 모선 잔재 삭제, geometry.ts·topology.ts, 모선 수직 연결·겹침·자동 배치 선 회피, review 자동 갱신, 참조 타일 패널 정정, CSV 판정 열, 낮음 5건
  - 현재 데이터 errors 0·warnings 0, T2 시나리오 17종 결과가 DI와 규칙 ID까지 일치, 라우터 86/86
  - 리더 재검증: typecheck·build 통과, unit 141/145(UT-01 CSV 열 변경 4건 — T3 갱신 대기), E2E 40·1 skip
- [(개선 R4) T3 완료] DI 테스트를 공용 모듈로 전환(RULES 64개 전부, 삭제 0, DI-RULES 누락 방지), 새 테스트: 공용 검사 79·라우터 골든 12(86/86)·관리자 초안 16·관리자 E2E 4, UT-01 10열
  - 리더 재검증: typecheck(src·tests) 통과, unit 260/260, E2E 46 통과·1 skip·0 실패
- [(개선 R4) 최종 리뷰] 반드시 0 · 권장 2 · 선택 6 → **최종 완료** (docs/reviews/r4-final-review.md)
  - R3 반드시 M1, T2 H1·H2·M1~M5, R3 권장 R1~R9 모두 해소 확인. checkDataset 2.6ms(버튼 클릭 시에만), 순환 import 없음, 검사 모듈은 관리자 청크에만
  - 남은 권장(다음 라운드 후보): ① 관리자 첫 편집 시 기존 검수 안내 문구 보존·기기 설명만 바꿀 땐 재검수 전환 안 함 ② 공용 검사 6개 분기(DI-35·39 중심거리·40 끝점/참조·43 중복·44a 모선 관통·44b) 합성 위반 테스트 보강
  - 남은 조직 결정: 계통 검수자(D5), 공백 15건 검증 담당(D7), GitHub 원격·Pages 배포

## 2026-11-18 · 데이터 확정 + (개선 R5)
- [사용자 지시 "일단 확정"] diagram.review = approved(제품맵 운영팀, 2026-11-18, 기존 정정 메모 보존), 공백 17건 gapAssessment = confirmed(basis bu-confirmed, 재확인 기한 2027-05-18, 근거에 "사용자 확정 지시 — 사업부 정식 검증 전" 메모). GIS·승압TR 정격 확인 2건은 제공 정격 값이 없어 candidate 유지
  - 확인 부서 표기는 DI-27h(부서명 형식) 기준에 맞춰 "제품맵 운영팀"
- (개선 R5) 병렬: T1 = 관리자 편집 시 기존 검수 문구 보존·기기 정보만 바뀌면 재검수 전환 안 함 / T3 = 데이터 고정 가정 테스트를 데이터 기반으로, 공용 검사 6개 분기 위반 케이스·메타 테스트 자동화, review 규칙 테스트
- [(개선 R5) 완료] T1: 관리자 편집 시 기존 검수 문구 보존(pendingReviewNote, 같은 날 중복 방지, 이전 검수자 표기), 기기 정보만 바뀌면 검수 유지, 변경요약 문구 / T3: 데이터 고정 가정 테스트를 데이터 기반으로, 공용 검사 6개 분기 위반 케이스 + 메타 테스트 자동화, review 규칙 테스트 4건
  - 리더 재검증: typecheck(src·tests)·build 통과, unit 270/270, E2E 46 통과·1 skip·0 실패
  - 확정 화면 확인: 검수 대기 배지 사라짐, CT/PT 등 확정 실선·패널 "공백 확정 · 사업부 확인 · 제품맵 운영팀"
  - 사용자 확인 대기: Gap 모드 배너 "공백 후보는 홈페이지 기준…" 문구(확정 후 부정확) → 후보가 남아 있을 때만 표시 제안
- [사용자 요청] 타일 하단 제품명 잘림 수정: 사진·심볼 72→60px, 이름 두 줄(한국어 단어 단위 줄바꿈) + title 툴팁. 타일 크기 120×116 유지(배치 영향 없음). 측정: 전체 타일 캡션·약어 넘침 0건. unit 270·E2E 46 통과

## 2026-11-18 · 비교 기능 + 사양 데이터
- [사용자 요청] 기기별 비교 기능 → 결정: 기기 종류끼리 + 같은 기기의 제품끼리 모두, 정격 사양은 공개 카탈로그에서 추출, Gap 배너는 후보가 있을 때만 표시
- [리더] 스키마: SPEC_KEYS(표준 사양 키 13종), SpecItem/ProductSpecs(출처 카탈로그·URL·페이지, extractedAt, reviewed)/SpecsFile, src/data/specs.json(빈 파일), load.ts specsByProductId
- 병렬: 데이터 담당 = 카탈로그 PDF에서 주요 제품 정격 추출(값마다 페이지, reviewed=false) / T1 = 비교 화면(/compare, 비교 담기, 차이만 보기) + Gap 배너
- [T1 완료] 비교 기능: 비교에 담기(기기·제품 각 4개, localStorage), 하단 비교 바(모바일 시트 대응), /compare(URL 공유, 차이만 보기, 기기 10행·제품 기본+사양 행, 출처·검수 전 배지), Gap 배너 후보 문구 조건부(gap-candidate-note, 현재 숨김)
  - 리더 재검증: typecheck·build 통과, unit 270, E2E 46·1 skip
- [사양 추출 완료] specs.json: 35개 제품·229항목(공개 카탈로그 PDF 값만, 값마다 페이지, reviewed=false), 다운로드 44건(1.3초 간격). 대조표 docs/research/specs-extraction.md(신뢰도 낮은 값 11건 표시)
  - 미수집: 40MB 초과 카탈로그(Metasol ACB/MCCB, Compact ACB, Susol UL VCB, LIS), 카탈로그 없음(VC, PF, MMS, MCB/RCBO, 고압 인버터, GIS, 주변압기)
  - 리더 확인: unit 270 통과, 보호계전기·VCB 제품 비교 화면에 사양·출처·검수 전 배지 표시
- [비교 점검] T3: specs DI-90~99c(13), compare 단위 22·ComparePage 14·store 15·E2E-7 5 → unit 332+2 기대실패, E2E 51 / 실제 버그 B2(사라진 id가 담기 목록 자리 차지 — 복구 불가)·B1(li key 중복, 잠복)
  - T2: 높음 1(비교 바 901~1100px 찌그러짐)·중간 8(탭 간 유실, 모바일 가림, 차이만 보기 표기 오탐, 단위 위치, 머리글 고정, specs 즉시 로딩, 다른 기기 안내 오탐, 인용 페이지 불일치 9건)·낮음 14. PDF 대조: url 35/35·page 범위 229/229 정상, 신뢰도 낮음은 10건(정정)
- [수정 라운드] T1 = 화면·로딩 수정(M6에 한해 load.ts 수정 승인) / 데이터 담당 = specs.json 인용 페이지 9건 정정·대조표 갱신
- [비교 수정 라운드 완료] T1: 비교 바 폭 대응(901~1299 본문 폭, ≤1099 칩 접기, 미니맵 위로), 탭 간 동기화, 모바일 여백(--cmp-tray-h), 차이만 보기 정규화(compareKey), 단위 위치(specValueText), 머리글 sticky, specs 지연 로딩(loadSpecs, 첫 화면 −5.5kB), 공통 기기 안내, B1·B2, axe 0 / 데이터: specs 인용 페이지 9건 정정·대조표 검수 상태 / T3: B1·B2 회귀 전환, 테스트 +30
  - 리더 재검증: typecheck(src·tests)·build 통과, unit 364/364, E2E 62 통과·1 skip·0 실패

## 2026-11-18 · 사양 옵션별 분리
- [사용자] "사양이 모델 옵션별로 다름" → 사양을 시리즈 공통(items) + 옵션별(variants: id·label·items·page, variantAxis)로 저장·비교
- [리더] 스키마: SpecVariantSchema, ProductSpecs.variants·variantAxis(+ 규칙: 공통 또는 옵션 필수, 옵션 있으면 기준 이름 필수, 옵션 id 고유). URL 형식 /compare?type=product&ids=P00206:4000af
- 병렬: 데이터 담당 = 카탈로그 옵션별 표 재추출 / T1 = 제품 상세 옵션별 사양표 + 비교 열 옵션 선택(URL 반영)
