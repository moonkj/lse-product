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
