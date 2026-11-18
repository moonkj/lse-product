# Tasklist — 공유 진행 보드

> 상태: `[ ]` 대기 · `[~]` 진행중 · `[x]` 완료 · `[!]` 블록(사유 기재)
> 규칙: 작업 시작/완료 시 본인 태그와 함께 즉시 갱신. 스키마·토큰·공용 컴포넌트 변경은 "교차 영향" 칸에 기록.

## Phase 0 — 준비
- [x] (리더) 설계 계획서 PLAN.md 작성
- [x] (사용자) 계통도 범위 확정: 초고압(765/345kV) → 분전반 하단 (L1~L7)
- [x] (사용자) 데이터 출처 확정: ls-electric.com 다운로드 자료실 + ssq.ls-electric.com 자료실
- [x] (사용자) 연계/공통(신재생·ESS·DC·감시 SW) 보유 확인
- [x] (리더) 제품 분류 트리 추출 (343항목) → docs/research/lse-product-tree.txt
- [x] (리더) 계층 매핑·공백 후보 초안 → docs/research/product-mapping.md
- [x] (사용자) 상태 5종 확정: 보유/일부/계열사 보유/미보유/해당없음 (계열사·미보유 별도 색상)
- [ ] (사용자) 공백 후보 11개 진위 확인 (개발과 병행 가능)
- [x] (사용자) 배포: GitHub Pages / 저장소: 당분간 로컬 git
- [x] (리더) node v26.13.1, gh 2.104.0 설치 (~/.local/bin)
- [!] (사용자) tmux: Homebrew 설치 필요 (관리자 비밀번호) → 설치 전까지 Claude Code 내장 병렬 에이전트로 진행
- [x] (리더) git init + .gitignore + 첫 커밋
- [x] (T1) Vite + React + TS 스캐폴딩, 디자인 토큰(tokens.css), 라우팅
- [x] (T2) 스캐폴딩 점검 (빌드/린트/타입 오류) — 빌드·tsc 통과, 이슈 높음2/중간7/낮음11 → docs/reviews/phase0-debug-report.md
- [x] (T3) 테스트 환경 구성 (Vitest, Playwright) + 스모크 테스트 — vitest/playwright 설정, npm scripts, CI test 단계, 스모크 1 통과
- [x] (T1) 디버거 리포트 반영: H1(ErrorBoundary·지연 로딩), H2(카테고리 링크 대체), M1(헤더 버튼=location), M2, M3, M4(패널 정리), M5, M6, M7, L2·L3·L4·L5·L6 — 보류: M1 구조, L1·L7·L8·L9·L10·L11
- [x] (T1) 개선 R2: 엣지 points 렌더·타일 썸네일, T2 H1·H2·M1~M8·L1·L3~L8·L10·L12~L14, T3 M1·M2·M4·M5·M6·R1·R3·R4·R6·R7·R8·R10·O3·O9 + CSV 수식 주입 방지, 투어 완료(tour-finish·tour-summary). vitest 126/126, E2E 33통과/1skip — 보류: L2(히스토리 정책 팀 결정), L9 일부, R2 일부, R5·R9(보고만), O8

## Phase 1 — 데이터
- [x] (리더) 표준 계통 기기 목록(EquipmentType) 74종 + 계통도 배치(노드 74/엣지 77) → scripts/build-diagram-data.py
- [x] (T1) 제품 수집 스크립트: menu 트리 → products.json (제품 페이지 URL 포함)
- [x] (T2) 자료실 2곳의 데이터 API 파악 → docs/research/download-api.md, scripts/probe-downloads.mjs (리더 재현 확인)
- [~] (T1) 전체 제품 자료 수집 스크립트 fetch-docs → src/data/docs.json (probe 기반, 공개 문서만, 개인정보 제외) — 스크립트 완료(--only/--limit/--resume), 5개 제품만 수집(25요청). **전체 199개 실행은 리더 판단 대기**
- [x] (T1) Zod 스키마 + equipment-types / diagram 데이터 (product-mapping.md 기준)
- [ ] (T2) 데이터 무결성 점검 (끊긴 참조, 누락 필드)
- [x] (T3) 스키마 검증 단위 테스트 — tests/unit/data-integrity.test.ts DI 48규칙(51 테스트) 전부 통과

## Phase 2 — 계통도
- [x] (T1) SVG 렌더러 + 기기 심볼 + 줌/패닝 (L1~L7 전 계층 + 신재생 연계) — **T1-A**: 사진 타일 120×116(HTML) + 직교 엣지·모선(SVG), 단선결선도 심볼 10종, 네이티브 스크롤 패닝 + transform 줌(휠·핀치·드래그 4px 임계), IO 지연 로딩(초기 사진 13/59), `?node=`·`?mode=` URL 동기화, 상세 패널·모바일 하단 시트, 헤더 검색(Fuse, combobox — Phase 3 검색 선반영)
- [x] (T1) 계층 점프 내비게이션 / 미니맵 / 전압 라벨 밴드 — **T1-A**: 좌측 내비(보유/전체·Gap 공백 수·aria-current), 미니맵(Gap 빨간 점), 밴드 라벨(축소 시 글자 보정), 공백 표 링크
- [x] (T1) 노드 상태 색상(보유/일부/공백/해당없음) + 범례 — **T1-A**: 테두리 색+우상단 배지, Gap 모드 흐림/강조, 범례 5종(개수)+선 범례. E2E 27통과/1실패(E2E-1 투어: /learn 에 layer-band 없음 — 리더 판단)/1skip
- [x] (T2) 렌더링/상호작용 버그 점검 — 높음2/중간8/낮음14 → docs/reviews/phase2-debug-report.md (엣지 13개 타일 관통, 미니맵 오프셋, 드래그+휠 튐 등)
- [x] (T3) 노드 클릭·필터 컴포넌트 테스트, 리뷰 — CT-01~04(CoverageBadge·ExternalLink·DiagramNode·DetailPanel) + UT-01(CSV) + DI-70~86(learn.json·equipment-images.json) → npm test 114 통과. 코드 리뷰 docs/reviews/phase2-code-review.md (반드시 6 · 권장 10 · 선택 9)

## Phase 3 — 상세 & 자료
- [~] (T1) 상세 패널, 기기 페이지, 제품 페이지, PDF 뷰어 — **T1-B: 제품 페이지(/product/:id, 디자인 Product)·기기 페이지(/equipment/:id) 완료** (자료 유형별 그룹·계통 속 위치·같은 기기 제품). PDF는 새 탭 열기로 대체(뷰어 미구현). 상세 패널은 T1-A
- [ ] (T1) 검색(Fuse.js)
- [x] (T2) 예외 상태(자료 없음/PDF 실패/결과 없음) 점검 — 검색 iS7 오선택·IME Enter·포커스 소실 등 → phase2-debug-report.md
- [x] (T3) E2E: 계통도 → 기기 → 제품 → 데이터시트 — E2E 30건 28통과·1실패·1skip. 실패 = FT-26 공백 표 기본 필터 "전체"(구현 변경 대기, 리더 결정). E2E-1 투어를 /learn 기준으로 수정, Phase 2 게이트 제거

## Phase 4 — Gap 분석
- [~] (T1) 커버리지 계산, Gap 보기 모드, 매트릭스 페이지 — **T1-B: 공백 표 /gap 완료** (요약 카드·계층×기능 매트릭스·칸 필터·공백 목록·CSV 내보내기). Gap 보기 모드(계통도 강조)는 T1-A
- [~] (T2/T3) 계산 로직 검증 + 테스트 — T2: 커버리지·보유율·CSV escape 검증 완료(공백 정의 불일치 L13, CSV 수식주입 L8), 테스트는 T3 / T3: UT-01 buildGapCsv(BOM·CRLF·escape·수식주입) + E2E FT-26(전체 17·미보유 12, gap-filter-all) 작성. countCoverage·ownedRate 단위 테스트는 미작성 / T3 R2(v0.5): DI-44 연결선 타일 관통·DI-82b thumb·UT-02 resolveProducts 하위 카테고리·UT-03 사진 URL·E2E iS7/IME/tour-finish/썸네일 → unit 126 통과, E2E 31통과·2실패(tour-finish 구현 대기)·1skip

## Phase 5 — 교육
- [~] (T1) 계통 따라가기 투어, 용어집, (퀴즈/진도) — **T1-B: /learn 완료** (7단계 투어·퀴즈 20문항·진도 localStorage·용어집 36개, src/content/learn.json draft — 교육 담당자 검토 필요). 계통도 위 교육 모드 투어(E2E-1)는 T1-A
- [~] (T2/T3) 점검 + 최종 리뷰 — T2: learn.json 참조 무결, localStorage 차단 OK, L7 완료 불가(M8)·step 정규화(L3) → phase2-debug-report.md / T3: DI-70~79(learn.json) + E2E-1 /learn 투어 L1→L7 통과, 품질 리뷰 phase2-code-review.md

## 관리자 모드 (/#/admin) — 사용자 요청 "관리자 모드 만들어서 계통도에 기기 추가 가능하게"
- [x] (리더) 아키텍처 결정: 정적 사이트 → 브라우저 편집 + 초안 자동 저장(localStorage) + JSON 내보내기/가져오기. 앞으로 src/data/*.json 이 원본, Python 생성기는 시드용
- [x] (T1) 편집 화면 /#/admin (React.lazy 별도 청크, 앱 레이아웃 밖 전체 화면, 상단 "보안 장치 아님" 안내) — 기기 추가·수정·삭제 폼(EquipmentTypeSchema + DI-20~26 즉시 검증, 한국어 오류, id 자동 제안·중복 검사, 카테고리·제품 검색 선택, 대표 사진 선택), 배치(밴드 클릭·자동 빈 자리, 10px 스냅, 밴드 이탈·타일 겹침 빨간 미리보기), 노드 드래그/화살표 이동, 연결선 추가(전력/신호·전압 라벨)·수정·삭제, 변경 내역·되돌리기 50단계·초안 초기화, 무결성 검사 후 내보내기(equipment-types/diagram/(equipment-images)/변경요약.md), JSON 가져오기(스키마 검증), 사용자 화면 미리보기(제품/Gap)
- [x] (T1) 우회 경로 라우터 TS 포팅 src/lib/diagram/router.ts (default_route/path_hits_tiles/astar_route, 같은 상수·같은 힙 순서) — 현재 diagram.json 14개 points 100% 동일, 77/77 판정 일치
- [x] (T1) (개선 R3) 계통 정정 표시(모선·끝점·참조 타일·택1 배지, 자동 모선 제거)·검수 대기 배지·공백 후보/확정(점선/실선, 패널 공백 판정 섹션)·sourced 6번째 상태(--cov-sourced ⊡)·교육 퀴즈/진도/수료 제거·모바일 계층 칩/미니 체인 수정·관리자 모드(라우터 Python 86/86 일치, 노드 종류·택1·gapAssessment 폼, 무결성: 전력선 교차 검사). typecheck·build 통과, unit 145/145, E2E 40 통과/1 skip
- [x] (T2) (개선 R3) 점검 — 높음 2 / 중간 5 / 낮음 12 → docs/reviews/r3-debug-report.md (모선 A* 가로 출발 DI-46, 모선 겹침 미검사 DI-39, 관리자 검사↔DI 규칙 차이 9종, 자동 모선 잔재, review 미갱신). build·unit 145·E2E 40/1skip 통과, 관리자 시나리오 15종+UI 3회
- [ ] (T3) 관리자 모드 테스트 (router 단위 테스트·admin E2E) — testid: admin-page, admin-add-equipment, admin-equipment-form, admin-save, admin-place-mode, admin-connect-mode, admin-export, admin-import, admin-changes, admin-undo, admin-redo, admin-validation-errors (+ admin-select-mode, admin-auto-place, admin-check-run, admin-check-ok, admin-tab-*, admin-ghost[data-valid], admin-edge-hit-{edgeId}, admin-toast)
- [x] (T3) (개선 R3) 최종 품질 리뷰 → docs/reviews/r3-code-review.md — 반드시 1 · 권장 9 · 선택 5. 반드시 M1: 관리자 무결성 검사(integrity.ts)에 자동 모선 잔재(6개 선 관통 검사 면제·허위 경고) + DI-40/43c/45/46 규칙 차이 → (개선 R4) 범위 제안. 이전 리뷰 R5(파생 캐시)·R9(DataValidationError) 미처리
- [ ] (리더) 일반 화면에 관리자 링크 노출 여부 결정 (현재 미노출 — /#/admin 직접 입력), README 데이터 수정 가이드 갱신
- [ ] (2단계) GitHub API 직접 반영 — 원격 저장소 연결 후 (현재 버튼 자리만)

## (요청 시) T4 — 성능·문서
- [ ] 성능 점검 (SVG 렌더 수, 번들 크기, PDF 지연 로딩)
- [ ] README / 데이터 수정 가이드

## 교차 영향 로그
| 일시 | 변경자 | 변경 내용 | 영향 대상 |
|---|---|---|---|
| 11-18 | 리더 | DiagramLayer에 optional x, width 추가 (MON·REN 오른쪽 열 배치) | T1 schema.ts, T3 DI 규칙 — 공지 완료 |
| 11-18 | T1 | schema.ts: `httpsUrl`(https만) → Product/Category/DocRef.url 적용, `DocsFileSchema`·`ProductDocsSchema`·`DOC_TYPE_LABELS` 추가. 새 데이터 파일 src/data/docs.json. load.ts: 모듈 상수 → `getData()`/`useData()` 지연 로딩, `docsByProductId()`·`resolveProducts()`·`resolveCategories()` | T3 DI(docs.json 규칙·ssq CDN 도메인), E2E(자료는 docs.json 기준) |
| 11-18 | T1 | 관리자 모드: DiagramCanvas.tsx 의 `Bands`·`Edges` 를 export (동작 변화 없음). 새 파일 src/lib/admin/*, src/lib/diagram/router.ts, src/pages/admin/* | 일반 화면 영향 없음 |
| 11-18 | T1 | 라이트 모드 `--cov-partial` #a67c00, `--cov-na` #737c88 (아이콘 대비 3:1↑). layerFilter 초기값 = 전체 계층 | 화면 색 변화 |
