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

## Phase 1 — 데이터
- [x] (리더) 표준 계통 기기 목록(EquipmentType) 74종 + 계통도 배치(노드 74/엣지 77) → scripts/build-diagram-data.py
- [x] (T1) 제품 수집 스크립트: menu 트리 → products.json (제품 페이지 URL 포함)
- [x] (T2) 자료실 2곳의 데이터 API 파악 → docs/research/download-api.md, scripts/probe-downloads.mjs (리더 재현 확인)
- [~] (T1) 전체 제품 자료 수집 스크립트 fetch-docs → src/data/docs.json (probe 기반, 공개 문서만, 개인정보 제외) — 스크립트 완료(--only/--limit/--resume), 5개 제품만 수집(25요청). **전체 199개 실행은 리더 판단 대기**
- [x] (T1) Zod 스키마 + equipment-types / diagram 데이터 (product-mapping.md 기준)
- [ ] (T2) 데이터 무결성 점검 (끊긴 참조, 누락 필드)
- [x] (T3) 스키마 검증 단위 테스트 — tests/unit/data-integrity.test.ts DI 48규칙(51 테스트) 전부 통과

## Phase 2 — 계통도
- [ ] (T1) SVG 렌더러 + 기기 심볼 + 줌/패닝 (L1~L7 전 계층 + 신재생 연계)
- [ ] (T1) 계층 점프 내비게이션 / 미니맵 / 전압 라벨 밴드
- [ ] (T1) 노드 상태 색상(보유/일부/공백/해당없음) + 범례
- [ ] (T2) 렌더링/상호작용 버그 점검
- [ ] (T3) 노드 클릭·필터 컴포넌트 테스트, 리뷰

## Phase 3 — 상세 & 자료
- [ ] (T1) 상세 패널, 기기 페이지, 제품 페이지, PDF 뷰어
- [ ] (T1) 검색(Fuse.js)
- [ ] (T2) 예외 상태(자료 없음/PDF 실패/결과 없음) 점검
- [~] (T3) E2E: 계통도 → 기기 → 제품 → 데이터시트 — core-flows.spec.ts 21건(R-04/07/08/09 반영), Phase 2 testid 구현 전까지 자동 skip

## Phase 4 — Gap 분석
- [ ] (T1) 커버리지 계산, Gap 보기 모드, 매트릭스 페이지
- [ ] (T2/T3) 계산 로직 검증 + 테스트

## Phase 5 — 교육
- [ ] (T1) 계통 따라가기 투어, 용어집, (퀴즈/진도)
- [ ] (T2/T3) 점검 + 최종 리뷰

## (요청 시) T4 — 성능·문서
- [ ] 성능 점검 (SVG 렌더 수, 번들 크기, PDF 지연 로딩)
- [ ] README / 데이터 수정 가이드

## 교차 영향 로그
| 일시 | 변경자 | 변경 내용 | 영향 대상 |
|---|---|---|---|
| 11-18 | 리더 | DiagramLayer에 optional x, width 추가 (MON·REN 오른쪽 열 배치) | T1 schema.ts, T3 DI 규칙 — 공지 완료 |
| 11-18 | T1 | schema.ts: `httpsUrl`(https만) → Product/Category/DocRef.url 적용, `DocsFileSchema`·`ProductDocsSchema`·`DOC_TYPE_LABELS` 추가. 새 데이터 파일 src/data/docs.json. load.ts: 모듈 상수 → `getData()`/`useData()` 지연 로딩, `docsByProductId()`·`resolveProducts()`·`resolveCategories()` | T3 DI(docs.json 규칙·ssq CDN 도메인), E2E(자료는 docs.json 기준) |
| 11-18 | T1 | 라이트 모드 `--cov-partial` #a67c00, `--cov-na` #737c88 (아이콘 대비 3:1↑). layerFilter 초기값 = 전체 계층 | 화면 색 변화 |
