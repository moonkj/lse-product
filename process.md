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
- [옵션별 사양 완료] 데이터: 31개 제품 옵션 122개(공통 164·옵션 375항목, 값마다 페이지), 옵션 없는 4개 / T1: 제품 상세 "정격 사양"(공통+옵션 표, 옵션 담기), 비교 열 옵션 선택(URL P:옵션, 같은 제품 옵션끼리 비교, 시리즈 전체 나열·더 보기), 기기 비교 옵션 표기 / T3: DI-93~97 옵션 확장 + DI-96b~e, 단위 +18, E2E-8 6건
  - 리더 재검증: typecheck(src·tests)·build 통과, unit 382/382, E2E 68 통과·1 skip·0 실패
  - 사람 검수 우선 4건: GIPAM1000 통신(정격표 vs 통신기능 페이지), 발전소용 VCB 모델별 열, Metasol ELCB 125AF 셀·100AF 이상 차단전류, Metasol MS 프레임별 Ue

## 2026-11-18 · 추가 고도화 (로고 + 사양 검수 + 대용량 카탈로그)
- [사용자] "추가 고도화 진행, LS ELECTRIC 마크 넣기"
- [리더] 공식 사이트 로고(컬러 350×56·회색 177×28)·파비콘을 public/brand, public/favicon.ico 에 추가(출처·허가 README). 사내 허가 하 사용
- 병렬: T1 = 헤더 로고(라이트 컬러/다크 회색)·파비콘·타이틀 + 관리자 "사양 검수" 탭(값 정정·옵션 편집·검수 완료·specs.json 내보내기, 사양 규칙 공용 모듈 편입) / 데이터 담당 = 40MB 초과 카탈로그 HTTP Range로 정격표만 받아 사양 추가·표준 카탈로그 값 교체
- [추가 고도화 완료] T1: 헤더 공식 로고(라이트 컬러·다크 회색, 22px)·파비콘, 관리자 "사양 검수" 탭(우선 검수 정렬, 값·옵션 편집, 부서명 필수 검수 완료, specs.json·변경요약 내보내기), 사양 규칙 공용 모듈(src/lib/integrity/specs.ts, DI-90~99b) / 데이터: HTTP Range로 대용량 카탈로그 8개(562MB 중 59MB만) → 신규 5·표준 교체 3, specs 40개 제품 / T3: DI 사양 공용 모듈 전환, UT-16 24건, 브랜드·관리자 사양 E2E / 리더: B3(부서명 '·' 시 검수 문구 미삭제) 정규식 수정
  - 리더 재검증: typecheck(src·tests)·build 통과, unit 413/413, E2E 76 통과·1 skip·0 실패
- [데이터 정합] VCB 기기 전압을 계통 위치 기준으로 통일: "7.2~25.8kV" → "22.9kV (자사 제품 정격 4.76~38kV)" (Susol VCB 7.2~36kV + UL VCB 4.76~38kV, 기기 정보 변경이라 계통 검수 상태 유지). 사양 검수 우선 목록을 대조표 최신판과 일치(P00206·P01021 해소 → 제외, P02206·P02216·P01023 추가, 8건). unit 413·E2E 76 통과
- [커밋] 화면 캡처 13장 docs/screenshots (fc86d28)

## 2026-11-18 · UX/UI 고도화 토론 (페르소나 5명)
- [사용자] "추가로 UX/UI 고도화할 게 있는지 페르소나 5명 넣어서 토론"
- 페르소나: 시니어 UX/UI 디자이너 · 접근성 전문가 · 신입사원(첫 사용) · 현장 엔지니어(모바일) · 기술영업(태블릿 시연)
- 방식: 1라운드 실행 중인 앱(127.0.0.1:4173)을 Playwright로 직접 조작·평가 → 2라운드 교차 반박 → 토론 페이지 공개. 기존 사용자 결정(공개/사내 분리 안 함, 고지 없음, 퀴즈 없음)은 재논의 대상 아님

## 2026-11-18 · UX/UI 페르소나 5명 토론 완료
- 참가: 기술영업(태블릿) · 시니어 디자이너 · 접근성(WCAG 2.2 AA) · 신입사원 · 현장 엔지니어(모바일). 1라운드 직접 조작 측정 → 2라운드 교차 반박.
- 결과: docs/personas-ux/DEBATE.md, debate.html (round1/, round2/, ROUND2.md).
- 합의 버그 B1~B10(문서 넘침·위치 동기화·포커스·뒤로가기·형식명 검색·문구/표시 불일치·Gap 대비·오프라인 안내) → U1로 진행 가능.
- 화면 변경 C1~C6(압축 화면+발표 보기, 운영 정보 접기, Gap 회색 채움+안내 링크, 시작 카드, 자료 칩, 링크 복사) → 사용자 확인 대기.

## 2026-11-18 · UX 라운드 U 구현 (T1-A/B/C 병렬)
- 사용자 승인: C1 압축 화면+발표 보기, C4 시작 카드, C5 자료 바로가기 칩, C6 비교 링크 복사 + 버그 B1~B10. 보류: C2 운영 정보 접기, C3 Gap 회색 채움.
- T1-A 계통도: B2 선택 시 이동·확대·현재 계층 고정, B3 viewport.ts(덮개 실측·insets), B4 패널 h2 포커스/Esc 복귀/Home·End, B5 선택 history push+상태 복원, B7 패널 구성품 "구성품 판정·판정 확정/후보", B9 흐림은 사진·배경만(글자 대비 ≥5.3:1), 터치 44px, 사이드 패널 모드.
- T1-B 제품·비교·검색: B1 visually-hidden 기준 position:relative(1,168px 넘침 해소), B6 search.ts 형식명·옵션 색인(specs 지연 로딩 유지), C5 바로가기 칩, C6 링크 복사·diff=1, B10 한글 네트워크 오류·다시 시도, publicNote.
- T1-C 레이아웃: C1 data-density compact(높이 ≤600 자동·발표 보기 lse-present-v1), 사이드바 계통도 화면 한정, C4 StartCard, LiveRegion+announce, 라우트 h1 포커스, 용어집 +4(40), L7 '분전반 및 부하'.
- 리더 통합: .app-main position:relative, catalog/Gap/Compare 판정 표기 confidenceLabel.
- 검증: typecheck(src·tests)·build 통과, unit 465/465, E2E(dist) 112 통과·1 skip. 첫 화면 index gzip 80.40kB.
- 리더: 모바일 시트 접힘 높이 46→40dvh(--sheet-collapsed-h, 비교 바 위치 공유, 사용자 승인). 390 세로 지도 288→338px, 360 204→248px(시트 상단−캔버스 상단). E2E 112·1 skip.

## 2026-11-18 · 교육 기능 제거 (사용자 결정: 교육용 포털 아님 — 신입도 활용할 뿐)
- 학습 포인트 화면 표시 제거(패널·기기·비교·제품·관리자 미리보기), DI-50 폐지 — 데이터·관리자 입력(선택)은 보존.
- 교육 탭·/learn(→ / 리디렉트)·계통도 learn 모드·용어집·learn.json/learnSchema 삭제, DI-70~79 폐지, 시작 카드 링크 2개 + 모델명 검색 안내. index.html 설명 수정.
- 검증: typecheck·build, unit 456, E2E 112·1 skip. LearnPage 청크 소멸, 첫 화면 gzip 80.07kB.
- T3 리뷰(docs/reviews/ux-round-u-review.md): 반드시 2(M1 기기 약어 검색 회귀, M2 폰 세로 발표 보기 깨짐) · 권장 5 → 수정 라운드 R-U2.
- R-U2 (T3 리뷰 수정): M1 기기 약어 검색 1위 복구(searchRank.ts, 숫자 든 질의만 제품명 정확 일치), M2 세로 폰은 발표 보기·자동 압축 무시(버튼 숨김), R1 계통도 진입 포커스, R2 specs 실패 30초 재요청 금지+안내, R3 보이는 영역 캐시(ResizeObserver·rAF), R5 axe 2.5.3 0건(타일·계층 내비·공백 표 이름 = 화면 글자로 시작), S3·S7. 검증: unit 474, E2E 122·1 skip, axe 122→4(남은 4 = 390 접힌 시트 target-size, 시트 배치 변경 필요 → 사용자 확인).
- 모바일 시트 배치 변경(사용자 승인): 접힘 = 요약(계층·이름·배지·사진·설명 2줄)+[비교에 담기][전체 정보 보기], 나머지 섹션 미렌더, 높이 내용 맞춤(상한 40dvh), 비교 바 --sheet-h 추적. 390 지도 338→431px, 360 248→294~317px. unit 474, E2E 124·1 skip, axe 0.

## 2026-11-18 · 디자인 컨셉 적용 (참고: lse-market-news.pages.dev, LS ELECTRIC CI)
- 토큰: 네이비 #00337F · 블루 #0068B7 · CI 레드 #E60033(헤더 하단선 전용), 배경 #F4F6F9·흰 카드 r12·시스템 글꼴 13/15/18/24. 헤더 네이비 띠+흰 로고 박스+레드 3px. 기본 라이트 고정, 다크는 헤더 토글(lse-theme).
- 사양 표 정리(사용자 지적: 잘림·난잡): 출처 쪽 1회 표시(다를 때만 p.N), 열 머리 "＋ 비교" 소형, 값 굵기 400, 세로선 제거, 넘침 그림자+안내.
- 사진: 455px 원본 재수집, 56장 윤곽 자르기·흰 테두리 정리·여백 통일, 썸네일 재생성, 모든 사진 흰 판(테마 무관)·최대 300px.
- 보유 초록 #1b8f44(대비). 검증: unit 474, E2E 133·1 skip, axe 0(라이트·다크).
- 진행 중: 사이트 전체 제품 재대조(GIMAC 등), 기기 overview 보강(A·B).

## 2026-11-18 · 기기 상세 설명(overview) 74종 + 사이트 전수 대조
- overview: 3~5문장(역할·원리·정격/선정·자사 제품군), catalog 52 / general 22, 근거 링크(url#page=N). 스키마 EquipmentOverviewSchema, 관리자 저장 시 보존. 표시: 패널·펼친 시트·제품·기기·비교(4줄 clamp). 접힌 시트는 description 유지.
- 사이트 전수 대조(docs/research/product-coverage-audit.md): 국문 사업소개 199/137 차이 0. 숨은 페이지 9, 영문 전용 ~18, SSQ 전용 ~20라인, 카테고리=제품 라인 ~58(검색 안 됨), 미연결 15(감속기 14·DEXA), 단종 미반영 4, 일람표 3, aps 매핑 오류(APS=Arc Protection System).
- 사용자 결정: 국문+영문+SSQ 모두 포함, 감속기 새 기기 추가, 타일 브랜드 표기 없이 검색 별칭만.
- 검증: unit 483, E2E 138·1 skip, axe 8화면 0.

## 2026-11-18 · 제품 범위 확장(국문+영문+SSQ)·감속기·ATS·APS 정정
- 제품 199→243 (ko 198 · en 18 · ssq 27), ProductSchema source, id 접두(EN-·SSQ-·D자료실). 일람표 3 제거, 단종 4 반영, DEXA→plc.
- searchAliases 37기기·176개(Metasol MMS·XGT·M1000·E TAG 등), 브랜드 검색 시 연결 기기 최대 2 보장.
- 새 기기 gearbox(L7, 유성감속기 14+SSQ 2), 노드 n-gearbox·e088, L7 높이 648→834.
- lv-ats: 자료실 근거(LV CTTS 카탈로그·ATS with ACB CAD)로 missing(확정)→owned, 사유 audit 6장. MV CTTS→alts.
- aps: AAA010006 = Arc Protection System → '아크 보호 시스템'(L4, protection) 정정, 노드 이동. UPS 기기는 미생성(사용자 결정 필요).
- 펼친 시트 카드 가림 수정(CSS). 검증: unit 505, E2E 139, axe target-size 0.
- 설명 v2: 75종 "요약 + 역할·동작 원리·선정 포인트·LS ELECTRIC 제품" 구조(overview {summary, points, basis, sources}), 화면 근거 줄 전면 제거(사용자 요청), 비교 '설명' 요약+더 보기, 라벨 열 108px. 연결 기기 칩 aria-label 수정(axe 12→0). DI-OV1~3 추가.
- 검증: unit 508, E2E 140. ⚠ 간헐 실패 관찰: unit 1건(전체 실행 중 1회, 재실행 통과 — 이전 admin-specs 저장본 손상 케이스와 동일 추정), E2E ux-diagram 접힌 시트 390 1건·core-flows 키보드 Esc 1건(재실행 통과) → T2 플래키 조사 필요.
- T2 플래키 3건 해결(docs/reviews/flaky-tests.md): UT-16 모듈 전역 자동저장 타이머 격리(가짜 타이머), Esc 리스너 useLayoutEffect(경쟁 조건), 접힌 시트 측정은 --sheet-h 동기화까지 expect.poll. 반복: vitest 20/20, 대상 spec repeat 10×workers 1/4/8 통과. 별건: shuffle 시 순서 의존 메타 테스트 실패(기본 순서는 정상).

## 2026-11-18 · UPS 기기·SSQ 협력사 라인 제거·영문 18 재확인
- 새 기기 ups '무정전 전원 장치'(L6, system, missing · not-offered/homepage-menu/candidate). 자료실·제품 검색·SSQ(dlCenter·통합검색·카드)에서 자사 UPS 없음(E-House 구성 설비로만 언급). 노드 n-ups(1334,3312), e089 버스웨이→UPS, e090 UPS→HMI("무정전 제어 전원"). UPS 심볼 추가.
- SSQ AC&T System 라인 8개(ETOS·ETOS-X·ETOS-XP·EtherFOS×2·DPS·RCS-XG-4G·i-FOS-X) 제거: 카드 cardDescription "AC&T"·homepage acnt.co.kr. 제품 243→235.
- 영문 18: views API p_status close 0(new 1), p_display 전부 true → 단종 없음. URL 3개 p_url 기준 교정(EN-P00024·P00039·P00217). 근거 audit 7장.
- ⚠ 수집 규칙 위반 기록: UPS·영문 확인 작업 중 영문 페이지 21회를 브라우저로 열어 부수 요청 604회가 1.2초 간격을 지키지 못함(hits·이미지 차단, 로그인 미접촉). 이후 실사이트 브라우저 열람 금지·순차 fetch만 허용으로 팀 공지.
- 제품별 사진 1차(임시): 공식 제품 페이지 사진 124개(origin product-page), 나머지 107개 기기 대표 사진+'기기 공통' 표시. 제품 상세 히어로·패널 40px 썸네일·기기 카드·비교 열 적용. product-images.json(origin·catalogUrl·page). 요청 249회 순차(최소 1.346s). 카탈로그 전수 추출로 교체 예정(1단계 수집 진행 중). unit 513, E2E 140, axe 0.
