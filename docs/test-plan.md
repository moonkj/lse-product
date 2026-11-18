# 테스트 계획서 (v1.0)

> 작성: Teammate 3 (테스트 작성자 + 최종 리뷰어) · 2026-11-18
> 대상: 전력계통도 기반 제품 포트폴리오 & 신입 교육 포털 (PLAN.md v0.1)
> 코드: `tests/unit/data-integrity.test.ts`, `tests/unit/components/*.test.tsx`, `tests/unit/lib/*.test.ts`(v0.7: `integrity`·`router`·`admin-draft` 추가), `tests/e2e/smoke.spec.ts`, `tests/e2e/core-flows.spec.ts`, `tests/e2e/admin.spec.ts`(v0.7), (v0.9) `tests/unit/lib/compare.test.ts`·`compare-fixture.ts`, `tests/unit/components/ComparePage.test.tsx`, `tests/unit/store/useCompareStore.test.tsx`, `tests/e2e/compare.spec.ts`, (v1.0) `tests/unit/lib/load-specs.test.ts`
> 설정: `vitest.config.ts`(jsdom, DI 테스트는 파일 상단 `@vitest-environment node`), `playwright.config.ts`(chromium, build+preview :4173), `tests/tsconfig.json`
> 스크립트: `npm test`(vitest run) · `npm run test:watch` · `npm run test:data`(DI만) · `npm run test:e2e` · `npm run typecheck:tests`
> v0.2 (11-18): 환경 구성·실행 완료, 리더 결정 R-01/04/05/07/08/09 반영 (§8)
> v0.3 (11-18): docs.json 규칙 DI-60~68 추가, 컴포넌트 테스트 CT-01/02 추가, E2E 를 사용자 확정 UX(Gap=같은 계통도 `?mode=gap`, 공백 표 링크, `?node=` 복원)와 docs.json 기준 자료 링크로 갱신
> v0.4 (11-18): Phase 2~5 구현(1ce6811) 기준. 리더 결정 반영 — E2E-1 투어 = `/learn` 페이지(승인 디자인 Learn, 계통도 밴드 하이라이트 없음), 공백 표 기본 필터 = "전체"(승인 디자인 GapTable). DI-70~79(learn.json)·DI-80~86(equipment-images.json) 추가, CT-03 DiagramNode·CT-04 DetailPanel·UT-01 CSV 추가, E2E Phase 2 게이트 제거. 코드 리뷰: `docs/reviews/phase2-code-review.md`
> v0.5 (11-18, 개선 R2): DI-44 연결선 타일 관통 0건(+ points 직교·타일 가장자리) 추가, DI-80 thumb 필드 반영·DI-82b 썸네일 존재, UT-01 CSV 수식 주입 방지, UT-02 resolveProducts 하위 카테고리(M3), UT-03 사진 URL(타일=thumb/패널=원본). E2E: L7 `tour-finish` → 완료 요약, `gap-filter-all` 기본 선택, "iS7"+Enter 1순위, 한글 조합 중 Enter 무시, 타일 썸네일·패널 원본 경로
> v0.6 (11-18, 개선 R3): 노드 종류(equipment·ref·bus·endpoint) 반영 — DI-30/33~36/39~43 갱신, DI-43b review·DI-43c 택1(alt) 추가, DI-44 종류별 크기·모선 얇은 장애물, **DI-45 전력선끼리 교차 0**, **DI-46 모선 연결 수직**. 공백 판정 근거 **DI-27a~h**(gapAssessment). 6번째 상태 sourced (DI-28·CT-01·범례). 퀴즈·진도·수료 제거 → DI-75·76(퀴즈) 삭제, DI-75 = 퀴즈 제거 확인, E2E `tour-finish`·완료 요약 테스트 삭제. CT-03 ref·candidate, E2E-6 (모선·끝점·참조 타일·alt·검수 배지·sourced 범례·공백 후보·공백 판정 섹션·범례 합 74)
> v0.7 (11-18, 개선 R4): **DI 판정 단일화** — 규칙 판정은 공용 모듈 `src/lib/integrity`(`checkDataset`·`RULES`, 관리자 "검사 후 내보내기"와 같은 함수). DI 테스트는 beforeAll 에서 checkDataset 1회 → RULES 규칙마다 it 하나(HARD = 오류 0, SOFT = softWarn). 스키마·판정 함수 자기검증, 파일 시스템(DI-00a·82·82b·86), docs.json·learn.json·사진 스키마(DI-80)는 DI 테스트에 직접 유지 (§3.10 매핑표). 새 단위 테스트 UT-10 공용 검사(규칙별 위반 → ID, T2 R3 관리자 실패 시나리오), UT-11 라우터 골든(diagram.json 86/86)·모선 거부, UT-12 관리자 초안 편집·검수 상태. UT-01 CSV 판정 열(10열). E2E-ADM 1~4(관리자), E2E-6 참조 타일 패널(`detail-meta`·`detail-ref-origin`)·모선 형제 피더 칩 화살표 없음
> v0.8 (11-18, 개선 R5): **데이터 확정 반영** — diagram.review = approved, 공백 17건 gapAssessment = confirmed(bu-confirmed, 재확인 2027-05-18), GIS·승압 TR 은 candidate(보유 → 테두리 규칙 대상 아님). 데이터 상태를 고정 가정하던 테스트를 **데이터 기반 기대값**으로: E2E-6 검수 배지(pending → 보임 / approved → 없음), 공백 확신도 타일(노드마다 데이터 판정 = confirmed/candidate, 재확인 기한 KST 지나면 candidate, 보유 → 속성 없음), CT/PT 공백 판정(확정 → '확정', 후보 → '후보'). **UT-10 권장 R2**: 분기별 위반 6건(DI-35 기기 타일 밴드 밖·DI-39 중심 거리 < 24·DI-40 끝점·참조 타일 연결 0·DI-43 기기 노드 2개·DI-44a 모선 관통·DI-44b 끝 점 가장자리 밖) + 메타 테스트를 손 목록 대신 **실제 위반 케이스가 보고한 규칙 ID(verify) 집합 ↔ RULES** 대조로 변경(시나리오 삭제 시 실패 확인). **UT-12 review 규칙(R5)**: 구조 편집 → pending + 기존 note 보존 + "(이전 검수: 검수자 검수일)", 같은 날 재편집 문구 중복 없음, 기기 설명만 변경 → approved 유지(같은 객체), 되돌리기 → approved 복원, 변경 요약 '계통 검수 상태' 줄
> v0.9 (11-18, 비교 기능 + specs.json, f4f9c69): **DI-90~99c specs.json 규칙 13건**(판정 함수 `checkSpecs` 1개 — 현재 데이터 위반 0, 합성 위반 → 규칙 ID 자기검증), **UT-13** `lib/pages/compare.ts`(합성 데이터셋, 22), **CT-07** ComparePage 행 생성·차이만 보기·안내(14, 기대 실패 1), **UT-14** 비교 담기 store·비교 바·담기 버튼(15, 기대 실패 1), **E2E-7** `compare.spec.ts`(5). 실제 버그 2건은 `it.fails` 로 재현해 둠(수정되면 빨개짐 → `it` 로 전환) — §11f
> v1.0 (11-18, 비교 기능 수정 라운드 — T1 수정 + specs.json 인용 페이지 9건 정정, 커밋 전): v0.9 버그 **B1·B2 수정 확인 → `it.fails` 2건을 `it` 회귀 테스트로 전환**. M6 specs 지연 로딩(`loadSpecs`·`peekSpecs`) → 픽스처 `FAKE_SPECS` 별도 Map, **UT-15** 신설(4). UT-13 22→29(`type` 대소문자·`badType`·`ids` 반복, `specValueText` 단위 위치·계기 표기, `compareKey` 정규화), CT-07 14→21(loading/error 행, 공유 링크 열 빼기, 차이만 보기 유지, M3 정규화 비교, M8 공통 기기, 잘못된 type 안내, 값 없음 구분), UT-14 15→26(실제 데이터 id, B2 불러오기·가득 판정 정리, M1 storage 이벤트·변경 직전 재읽기, 끝 슬래시, 전환 버튼 n/4), E2E-7 5→16(spec-error, 공유 링크, 끝 슬래시, M8, sticky, 폭 5종 세로 쪼개짐, --cmp-tray-h). DI-90~ 는 정정된 specs.json 으로 위반 0 — §11g

---

## 1. 테스트 전략

| 층 | 도구 | 대상 | 실행 시점 |
|---|---|---|---|
| **데이터 무결성** | Vitest (node 환경) | `src/data/*.json` 을 Zod 스키마로 parse한 뒤 참조·좌표·커버리지 규칙 검사 (§3 DI 규칙) | `npm test` — **CI(deploy.yml)에서 build 전 단계로 실행** (리더 결정: build 스크립트에는 넣지 않음) |
| 단위 | Vitest | `lib/coverage.ts`(커버리지 계산·통계), `lib/search.ts`(Fuse 설정), 스토어(`useAppStore`) 액션 | `npm test` |
| 컴포넌트 | Vitest + Testing Library + jsdom | 노드(Node) 렌더·클릭·키보드, 상세 패널 상태별 화면, 범례, 보기 모드 토글, 검색 결과/빈 상태 | `npm test` |
| E2E | Playwright (chromium + 모바일 에뮬레이션) + `@axe-core/playwright` | **정적 빌드(`vite build && vite preview`)** 위에서 핵심 흐름·해시 라우팅·반응형·대비 | PR/배포 전 |

### 1.1 우선순위 (버그 가능성 × 영향도)

| 우선 | 영역 | 이유 |
|---|---|---|
| **P0** | 데이터 무결성 (DI) | 이 포털의 가치 = "Gap이 정확한가". 데이터는 사람이 손으로/스크립트로 고치므로 끊긴 참조·좌표 이탈이 가장 자주, 조용히 생긴다. UI는 멀쩡해 보여도 잘못된 정보를 보여준다. |
| **P0** | 커버리지 계산 (`coverage.ts`) | owned/missing 판정·통계 %는 영업/기획 의사결정에 그대로 쓰임. 하위 카테고리 포함 여부 같은 경계 조건 버그 위험 큼. |
| **P0** | 해시 라우팅 + base `./` 정적 배포 | GitHub Pages에서 새로고침 404·자산 경로 깨짐은 "전체 불능" 장애. 개발 서버(dev)에서는 재현되지 않으므로 반드시 preview 빌드로 테스트. |
| P1 | 노드 클릭 → 상세 패널, 보기 모드(제품/Gap/교육) | 핵심 행동 1·2순위. |
| P1 | 접근성(키보드·색약·대비) | SVG 노드는 기본으로 포커스/역할이 없어 빠뜨리기 쉬움. |
| P1 | 검색(결과 없음 포함), 예외 상태(자료 없음, 없는 id) | 현재 `products.json`의 docs가 **전부 비어 있음(0건)** → "자료 준비 중" 상태가 실제 기본 화면이 됨. |
| P2 | 모바일 하단 시트, 줌/패닝 세부 동작, 교육 투어 진도 저장 | |

---

## 2. 테스트 데이터 원칙
- E2E는 **기기 id를 하드코딩하지 않고** `src/data/*.json`에서 커버리지별 첫 노드를 골라 쓴다 → 데이터가 바뀌어도 테스트가 유지됨. 해당 조건의 데이터가 없으면 `test.skip`(실패 아님).
- 컴포넌트 테스트는 작은 **fixture 데이터**(커버리지 5종 각 1개 + 자료 있음/없음 제품)를 별도로 둔다 (`tests/fixtures/`). 실제 데이터 변경에 컴포넌트 테스트가 흔들리지 않게.

---

## 3. 데이터 무결성 규칙 (DI) — 총 87개 (HARD 74 · SOFT 13, v0.6) + v0.9 specs.json 13개(§3.11)

> **v0.7 (개선 R4)**: 규칙 ID·내용은 그대로, 판정 코드만 `src/lib/integrity`(공용 모듈) 로 옮김. 공용 모듈 대상 64개 ID(`RULES` 표, DI-00 포함)는 DI 테스트·관리자 검사가 같은 함수로 판정하고, 규칙별 "위반 데이터 → 그 ID" 는 UT-10 이 검증한다. 전환 매핑은 §3.10.

> HARD = 위반 시 테스트 실패(빌드 차단 권장) · SOFT = `console.warn`만 출력
> 구현: `tests/unit/data-integrity.test.ts` (테스트 이름 앞에 ID 표기). 실제 데이터(제품 199 · 카테고리 137 · 기기 74 · 노드 74 · 엣지 77)로 **사전 점검(Python 포팅) 결과 전부 통과** — 단 DI-40은 예외 규칙 확정 후 기준 (§3.4 참고).

### 3.1 파일·스키마
| ID | 규칙 | 등급 |
|---|---|---|
| DI-00a | 4개 데이터 파일(products, categories, equipment-types, diagram) 존재 + JSON 파싱 (파일당 1건, 4건) | HARD |
| DI-00b | 4개 파일 모두 Zod 스키마 parse 성공 | HARD |
| DI-00c | 스키마가 잘못된 값(L9 계층, 없는 coverage, 없는 business, 필드 빠진 노드)을 **거부**함 — 스키마가 너무 느슨해지는 회귀 방지 | HARD |

### 3.2 식별자
| ID | 규칙 | 등급 |
|---|---|---|
| DI-01 | product.id 중복 없음 | HARD |
| DI-02 | category.code 중복 없음 | HARD |
| DI-03 | equipmentType.id 중복 없음 | HARD |
| DI-04 | diagram node.id / edge.id / layer.id 각각 중복 없음 | HARD |
| DI-05 | product.id 형식 `P` + 숫자 5자리 | HARD |
| DI-06 | category.code 형식 `[A-Z]{3}\d{3,}` (AAA009004 등) | HARD |
| DI-07 | equipmentType.id 는 URL-safe kebab-case (`/equipment/:id` 라우트용) | HARD |
| DI-08 | 필수 텍스트(name, description, category, voltage) 공백 문자열 아님 | HARD |

### 3.3 제품·카테고리 참조
| ID | 규칙 | 등급 |
|---|---|---|
| DI-10 | equipment.lseCategoryCodes ⊂ categories.json | HARD |
| DI-11 | equipment.productIds ⊂ products.json | HARD |
| DI-12 | product.categoryCode ∈ categories.json | HARD |
| DI-13 | category.productIds ⊂ products.json | HARD |
| DI-14 | 양방향: product.categoryCode의 카테고리가 그 제품을 productIds에 포함 | HARD |
| DI-15 | category.parentCode 존재 + 부모 체인 순환 없음 | HARD |
| DI-16 | category.path 마지막 = name, product.categoryPath 비어있지 않음 | HARD |
| DI-17 | product/category/doc url 은 `https://` + `*.ls-electric.com` (www·ssq·sol 서브도메인 허용) | HARD |
| DI-18 | `www.ls-electric.com` 제품 url 에 자기 product.id 포함 (`/ko/product/view/P01097`) | HARD |
| DI-19 | 한 제품 안에서 doc.url 중복 없음 | HARD |

### 3.4 커버리지 일관성 (Gap 신뢰성)
> "연결" = `productIds` ∪ `lseCategoryCodes`의 카테고리(+**하위 카테고리**)에 속한 제품 + 카테고리 코드 수. 카테고리만 있고 제품 페이지가 없는 수주형 품목(GIS·HVDC 등)도 owned로 인정하기 위함.

| ID | 규칙 | 등급 |
|---|---|---|
| DI-20 | owned → 연결 ≥ 1 | HARD |
| DI-21 | missing → productIds·lseCategoryCodes 모두 비어있음 | HARD |
| DI-22 | affiliate → affiliateName 필수 | HARD |
| DI-23 | affiliateName 은 affiliate 일 때만 존재 (다른 상태에 남은 찌꺼기 금지) | HARD |
| DI-24 | missing → gapNote 필수 ("왜 공백인지" 설명 없는 빨간 노드 금지) | HARD |
| DI-25 | partial → gapNote 권장 | SOFT |
| DI-26 | partial → 연결 ≥ 1 | HARD |
| DI-27 | owned 인데 연결 제품이 전부 단종(discontinued) → 경고 | SOFT |
| DI-27a | (v0.6) missing·partial·affiliate·sourced → `gapAssessment` 필수 (현재 17건 + 보유 기기 정격 확인용 2건 = 19) | HARD |
| DI-27b | (v0.6) sourced → `supplyMode=panel-sourced`. SOFT: affiliate→affiliate, missing→not-offered/unknown | HARD(+SOFT) |
| DI-27c | (v0.6) `basis=homepage-menu` → `confidence=candidate` + 스키마가 homepage-menu+confirmed 를 **거부** | HARD |
| DI-27d | (v0.6) `confidence=confirmed` → verifiedBy·verifiedAt 필수 + 스키마가 둘 중 하나 없으면 거부 | HARD |
| DI-27e | (v0.6) verifiedAt·reviewDue 는 실제 달력 날짜 YYYY-MM-DD (2026-02-30 금지) | HARD |
| DI-27f | (v0.6) evidence `type=url` → ref 는 https 절대 URL | HARD |
| DI-27g | (v0.6) sourced 인데 gapNote 없음 / confirmed 인데 reviewDue 지남 → 경고 | SOFT |
| DI-27h | (v0.6) verifiedBy 는 부서명(부·팀·소·실·센터·사업·그룹 포함, 이메일 금지) | SOFT |
| DI-28 | coverage 값이 6종 enum 안 (v0.6 sourced 추가, 스키마 이중 확인) + 분포 console.info | HARD |
| DI-29 | product-mapping.md 공백 후보 11종이 기기 목록에 "자리"로 존재 | SOFT |

### 3.5 계통도 구조
> v0.6 노드 종류: `kind` 생략·`equipment` = 기기 사진 타일(120×116, `equipmentTypeId` 필수), 그중 `ref:true` = **참조 타일**(같은 기기 재등장, 74종 집계·밴드 검사 제외) / `bus` = 모선(width×8, label·layer) / `endpoint` = 끝점 라벨(120×44, label·layer). 소속 계층: 기기 = 기기 layer, 모선·끝점 = node.layer. 현재 노드 83 = 기기 74 + ref 3 + bus 2 + endpoint 4, 연결선 86 (power 57 · signal 22 · alt 7).

| ID | 규칙 | 등급 |
|---|---|---|
| DI-30 | 기기 노드의 equipmentTypeId 존재 / 모선·끝점은 label·layer 필수, equipmentTypeId·ref 금지 / 모선 width>0 + 스키마 자기검증 | HARD |
| DI-31 | 모든 edge.from / edge.to 가 존재하는 node | HARD |
| DI-32 | self-loop 없음, 같은 노드쌍 중복 edge 없음(방향 무시) | HARD |
| DI-33 | L1~L7 + 노드가 사용하는 모든 layer(모선·끝점 포함)에 밴드 정의 + 계약 밖 layer 없음 | HARD |
| DI-34 | L1~L7 각 계층에 기기 노드(ref 제외) ≥ 1 | HARD |
| DI-35 | 노드 중심이 소속 계층 밴드 안 (**ref 제외**), 모선은 양 끝 x 도 밴드 안 | HARD |
| DI-36 | 노드 박스(종류별 크기)가 캔버스 안 | HARD |
| DI-37 | 밴드: 크기 > 0, 캔버스 안, **x·y 모두 겹칠 때만** 겹침으로 판정 → 겹침 없음 | HARD |
| DI-38 | L1→L7 밴드가 위에서 아래 순서 (투어 방향) | HARD |
| DI-39 | 노드 박스끼리 겹침 없음 (종류별 크기, 모선 포함) + 중심 거리 ≥ 24px. SOFT: 타일·끝점 간격 30px 미만 | HARD(+SOFT) |
| DI-40 | 고립 노드 없음: 기기 edge ≥ 1 (예외: MON, `category=system`) / **끝점·참조 타일은 예외 없음** / 모선은 edge ≥ 2 | HARD |
| DI-41 | L1 노드에서 L7 노드까지 경로 존재 (전원→부하 흐름 단절 없음) | HARD |
| DI-42 | edge 는 같은/인접 L 계층만 연결 (모선·끝점은 node.layer, REN·MON 예외) | HARD |
| DI-43 | 모든 equipmentType 이 **ref 제외 기기 노드로 정확히 1회** (기기 노드 수 = 74) + ref 는 label 필수 | HARD |
| DI-43b | (v0.6) review.status ∈ pending/approved, approved → reviewedBy·reviewedAt. review 없음은 SOFT | HARD |
| DI-43c | (v0.6) alt(택1) 연결선은 label 필수, 같은 label 그룹 ≥ 2개 | HARD |
| DI-44 | (v0.6) 연결선 노드 관통 0건: points 우선, 없으면 기본 직교 경로(Python `default_route` 와 같은 규칙, **종류별 반높이**). 장애물 = 양 끝 외 모든 노드 — 타일·ref·끝점(판정 여유 1px 안쪽), **모선은 높이 8 + 여유 2px**. points 는 직교, 첫/끝 점은 노드 가장자리(종류별 크기, 모선 쪽은 DI-46). 판정 함수 자기검증(타일·모선·끝점 경로) | HARD |
| DI-45 | (v0.6) **전력선(power·alt)끼리 교차 0건**: 공통 끝 노드가 없는 두 전력선의 선분이 직교 교차(서로의 내부에서 만남)하거나 같은 선 위에서 양의 길이로 겹치지 않음. 신호선 포함 교차는 개수만 console.info (현재 25건 — T3 판정은 같은 선 위 겹침 포함이라 생성기 집계 23과 다름). 판정 함수 자기검증(십자·T·겹침·이어짐·평행) | HARD |
| DI-46 | (v0.6) 모선 연결선은 points 필수, 모선 쪽 끝점이 모선 위(y=bus.y, x∈[x−w/2, x+w/2]), 첫 선분이 수직 | HARD |

> DI-40 메모: 현재 고립 노드 5개(n-substation, n-mv-swgr, n-lv-swgr, n-modular, n-railway)는 모두 category=system이라 예외로 처리. **리더 확인 필요** — "일괄 공급" 노드를 선으로 잇지 않는 것이 의도인지, 신입에게 "어디에 붙는지" 안 보이는 문제는 없는지.

### 3.6 교육·검색 품질
| ID | 규칙 | 등급 |
|---|---|---|
| DI-50 | 모든 기기 learnPoints ≥ 1 (교육 모드 빈 카드 방지) | HARD |
| DI-51 | 같은 layer 안 기기 이름 중복 없음 (검색 결과 구분 불가) | SOFT |
| DI-52 | 공개 사이트 — 대외비 키워드(대외비·내부용·confidential·사내한정) 없음 | SOFT |

### 3.7 자료 파일 docs.json (v0.3)
> 구조: `{ generatedAt, products: { [productId]: { source:'www'|'ssq', deepLink, docs: DocRef[] } } }` (`DocsFileSchema`). 생성: `scripts/fetch-docs.mjs`.
> 허용 자료 도메인 = `*.ls-electric.com` + `ssqfd-abhdhraad3gkgbcg.a03.azurefd.net`(ssq 공식 대용량 파일 CDN). DI-17/19 는 products.json 의 (현재 빈) docs 필드에 계속 적용.

| ID | 규칙 | 등급 |
|---|---|---|
| DI-60 | docs.json 존재 + `DocsFileSchema` 통과, generatedAt 날짜 형식, 잘못된 source·http deepLink 거부 | HARD |
| DI-61 | docs.json 의 productId 키가 모두 products.json 에 존재 | HARD |
| DI-62 | 모든 doc.url 은 https + 허용 도메인 (호스트 정확 비교, `URL` 파싱) | HARD |
| DI-63 | deepLink 존재 + https + `*.ls-electric.com` | HARD |
| DI-64 | 개인정보 의심 패턴 0건 — 이메일, 한국 전화번호(휴대폰·지역번호·15xx 대표번호). 제목·디코딩한 URL·deepLink 검사 | HARD |
| DI-65 | 같은 제품 안에서 doc.url 중복 없음 | HARD |
| DI-66 | doc.title 공백 문자열 아님 | HARD |
| DI-67 | docs 가 빈 제품 → 경고만 (화면은 "자료 준비 중" + deepLink) | SOFT |
| DI-68 | source=www 인데 ssq CDN 파일 포함 → 출처 표기 오류 의심 경고 | SOFT |

### 3.8 교육 콘텐츠 learn.json (v0.4)
> 계약: `src/content/learnSchema.ts` (`LearnContentSchema`). 콘텐츠 소유 T1-B, 사실관계는 equipment-types.json 의 description·learnPoints 범위 안 (교육 담당자 검토 전 draft).

| ID | 규칙 | 등급 |
|---|---|---|
| DI-70 | learn.json 존재 + `LearnContentSchema` 통과. 스키마가 단계 순서 뒤바뀜·6단계·reviewStatus 누락을 **거부**하는지 확인 (v0.6: answerIndex 검사 삭제) | HARD |
| DI-71 | 단계 layer 가 정확히 L1→L7 순서, 중복·누락 없음 | HARD |
| DI-72 | 핵심 기기(keyEquipmentIds) 가 equipment-types.json 에 존재 + 단계 안 중복 없음 | HARD |
| DI-73 | 핵심 기기는 그 단계 계층의 기기 (L3 단계에 L5 기기 금지) | HARD |
| DI-74 | 용어집 equipmentId 가 equipment-types.json 에 존재 + 용어(term) 중복 없음 | HARD |
| DI-75 | (v0.6) 퀴즈 제거 확인: learn.json 단계에 `quizzes` 키 없음 (구 DI-75 퀴즈 출처·DI-76 answerIndex 는 **삭제**, 사용자 결정 PLAN 9항) | HARD |
| DI-77 | reviewStatus 필드 존재·공백 아님 | HARD |
| DI-78 | reviewStatus 가 draft → 경고 (현재 1건: "draft — 교육 담당자 검토 필요") | SOFT |
| DI-79 | 공개 사이트 — 대외비 키워드·이메일·전화번호 패턴 (제목·intro·용어집) | SOFT |

### 3.9 기기 사진 equipment-images.json (v0.4)
> 계약: `EquipmentImagesSchema` (`src/lib/schema.ts`). 키 = equipmentType.id, `file` = `public/` 기준 상대 경로 (`images/equipment/<id>.(png|jpg|webp)`).

| ID | 규칙 | 등급 |
|---|---|---|
| DI-80 | 파일 존재 + 스키마 통과. 절대경로(`/images/…`, base './' 깨짐)·경로 탈출(`..`)·http 출처·bytes 0 을 **거부** | HARD |
| DI-81 | 키(기기 id)가 equipment-types.json 에 존재 | HARD |
| DI-82 | `public/<file>` 이 실제로 존재 (배포 후 깨진 이미지 방지) | HARD |
| DI-82b | (v0.5) `thumb`(160px, `images/equipment/thumb/<id>.png`) 파일이 실제로 존재 + 원본(320px)보다 크지 않음. DI-80 스키마 예시: thumb 누락·thumb/ 폴더 밖 거부 | HARD |
| DI-83 | productId 가 있으면 products.json 에 존재 | HARD |
| DI-84 | sourceUrl 은 `https://*.ls-electric.com` (공식 사이트 출처) | HARD |
| DI-85 | missing·na 기기에 사진 지정 → 경고 (디자인: 미보유는 심볼 + 빨간 점선) — 현재 0건 | SOFT |
| DI-86 | 실제 파일 크기 ≠ bytes, 또는 500KB 초과(원본·thumb 모두) → 경고 — v0.5: 원본 320px 축소 후 0건 | SOFT |


### 3.10 (v0.7) 공용 모듈 전환 매핑 — v0.6 DI 테스트 → v0.7

`tests/unit/data-integrity.test.ts` 의 v0.6 테스트 94건(it 90 + DI-00a 4)을 전환한 결과. **삭제된 규칙 0** — 테스트 `DI-RULES` 가 v0.6 ID 64개가 `RULES` 에 모두 있는지·SOFT 등급이 같은지 확인하고, UT-10 이 RULES 의 HARD·SOFT 규칙 전부를 위반 데이터로 한 번 이상 검증했는지 확인한다.

| 구분 | 규칙 ID | v0.7 판정 위치 | 위반 검증 (UT-10) |
|---|---|---|---|
| **전환** (공용 모듈, 63개 + DI-00) | DI-00(스키마), 01~08, 10~19, 20~29, 27a~27h, 30~43, 43b, 43c, 44a, 44b, 45a, 46, 50~52, 81, 83~85 | `checkDataset` 결과를 `RULES` 순서로 규칙마다 it 하나: error → `errors(rule) = []`, warning → `softWarn`, both → 둘 다. HARD 규칙이 경고로 보고되면 실패 | 규칙마다 합성 데이터 위반 1개 이상 (HARD 표 49 + 시나리오 10, SOFT 표 10 + DI-40·29) |
| 정보 (유지) | DI-27a·28·43c console.info, DI-45b 신호선 교차 수 | `(정보)` it 1개 + DI-45b (`edgeCrossings` 공용 함수) | — |
| **유지** (이 파일에서 직접) | DI-00a 파일 존재(4), DI-00b parse, DI-00c 스키마 거부(+ DI-43b 잘못된 status 거부) | 파일·스키마 | — |
| 유지 — 자기검증 | DI-27c·27d 스키마 거부, DI-27e·27f `isRealDate`·`isHttpsUrl`·`LSE_URL_RE`, DI-44 `segHitsNode`·`defaultRoute`(타일·모선·끝점·꺾인 경로·모선 범위 밖 null), DI-45 `segsCross`(십자·T·겹침·이어짐·평행·세로 겹침) | 공용 모듈의 판정 함수를 직접 호출 — 판정이 느슨해지는 회귀 방지 | — |
| 유지 — 파일 시스템 | DI-82, DI-82b, DI-86 | `public/` 파일 존재·크기 | — |
| 유지 — 범위 밖 파일 | DI-60~68 (docs.json), DI-70~75·77~79 (learn.json), DI-80 (사진 스키마 거부 예시) | 그대로 | — |
| 삭제 | 없음 (v0.6 DI 테스트 안의 로컬 판정 함수 `halfSize`·`defaultRoute`·`segHitsNode`·`segsCross`·`crossings`·`productsUnderCategory` 사본은 삭제 — 공용 모듈로 대체) | | |

결과: DI 테스트 94 → **101** (RULES 64 + 표 검사 2 + 정보 2 + 자기검증 5 + 파일·스키마 6 + docs 9 + learn 9 + 사진 스키마·파일 4). v0.6 의 DI-81·83·84·85 로컬 판정 it 은 RULES 루프와 중복이라 삭제(규칙은 RULES 로 유지).

### 3.11 (v0.9) 정격 사양 specs.json — DI-90 ~
> 계약: `SpecsFileSchema`·`SPEC_KEYS` (`src/lib/schema.ts`). 키 = Product.id, 값마다 카탈로그 페이지, `reviewed=false` → 화면 "카탈로그 추출값 · 검수 전".
> 판정: `tests/unit/data-integrity.test.ts` 의 `checkSpecs(file, productIds, docUrlsByProduct, today)` — **공용 모듈 편입 후보**(`src/lib/integrity`, 관리자 모드가 사양 편집을 지원하게 되면 같은 함수로). 이번 라운드는 src 수정 금지라 테스트 파일에 둠.

| ID | 규칙 | 등급 |
|---|---|---|
| DI-90 | 파일 존재 + 스키마 통과. 빈 items·http URL·page 0·소수 page·빈 value·날짜 형식·reviewed 문자열 **거부** | HARD |
| DI-90b | `checkSpecs` 자기검증: 정상 합성 = 위반 0, 규칙마다 위반 1건 → 정확히 그 ID (13 케이스) + 일관된 비표준 key·source.page 대체는 통과 | HARD |
| DI-91 | productId 가 products.json 에 존재 | HARD |
| DI-92 | `source.url` ∈ **그 제품의** docs.json doc.url (+ https·허용 도메인). 근거: 실제 데이터 35/35 일치(추출 담당이 docs.json 카탈로그만 사용, specs-extraction.md). "같은 도메인 https" 보다 엄격하게 둬서 오타·다른 제품 카탈로그 연결을 잡음. docs.json 재수집으로 URL 이 바뀌면 이 규칙이 알려 줌 | HARD |
| DI-93 | 제품 안 key 중복 없음 (화면은 여러 값을 지원하지만 기기 비교 화면 React key 버그 — §11f B1 — 와 비교 의미 혼란 방지) | HARD |
| DI-94 | 표준 key(SPEC_KEYS) 의 label = SPEC_KEYS 라벨 (화면은 SPEC_KEYS 라벨을 쓰므로 데이터 label 오타가 숨지 않게) | HARD |
| DI-95 | 비표준 key: 파일 전체에서 같은 key = 같은 label (화면 행 이름은 첫 제품 label — 행 정렬 일관성, T1 지적 위험) | HARD |
| DI-95b | 같은 label = 같은 key (표준 라벨 포함) — 이름이 같은 행 2개 방지 | HARD |
| DI-96 | items 1~10개, label·value 공백 문자열 아님 | HARD |
| DI-97 | 값마다 페이지 추적 가능: `item.page ?? source.page` (양의 정수는 스키마) | HARD |
| DI-98 | extractedAt 실제 날짜(2026-02-30 거부) + 미래 아님(KST), generatedAt 날짜로 파싱 | HARD |
| DI-99 | (정보) reviewed=false 제품 수 console.info — 현재 35/35, 항목 229 | 정보 |
| DI-99b | 개인정보 의심 패턴(이메일·전화) 0건 — title·url(디코드)·label·value·unit·note | HARD |
| DI-99c | 사양이 있는데 어느 기기에도 연결 안 된 제품 → 경고 (기기 비교 "대표 사양"에 안 나옴) — 현재 0건 | SOFT |


---

## 3b. 컴포넌트 테스트 (CT, Vitest + Testing Library + jsdom, v0.3)
| ID | 대상 | 검증 | 테스트 수 |
|---|---|---|---|
| CT-01 | `common/CoverageBadge` | (v0.6) **6상태**(sourced 추가) 아이콘·라벨이 서로 다름 + sourced 라벨 "패널 구성품" / 상태별 색 클래스(`cov-badge--{c}`) + `coverage-icon-{c}` 아이콘(aria-hidden) + 라벨 텍스트 동시 렌더 / `showLabel=false` 여도 visually-hidden 라벨 유지 | 14 |
| CT-02 | `common/ExternalLink` | https → `<a target=_blank rel="noopener noreferrer">` + "새 탭" 안내 / http·javascript:·data:·상대경로·`//`·ftp·빈 문자열 → `<a>` 미생성(텍스트만) | 9 |
| CT-03 | `diagram/DiagramNode` (v0.4) | 사진 있음 → `img.dnode__img`(data-src 지연 로딩, alt="") + 심볼 없음 / 사진 없음 → `svg.dnode__symbol`(aria-hidden) + `dnode--symbol`, 미보유 캡션 "자사 제품 없음" / 5상태: role=button·tabindex=0·`aria-label="{기기명}, {커버리지}"`·data-coverage·아이콘 / Gap 모드 R-08 강조·흐림 표 (제품 모드는 모두 false) / aria-pressed + 클릭·Enter·Space → onActivate(id) / (v0.6) Gap 모드 sourced = 보통, ref → `data-ref="true"`, `confidence` → `data-confidence="candidate|confirmed"` (NodeItem.ref·confidence 가정) | 12 |
| CT-04 | `panel/DetailPanel` (v0.4) | MemoryRouter `/?node=` 진입. 제품 0개 보유 기기 → `detail-product-list` 없음, `detail-empty-products` 안에 카테고리 공식 페이지 링크(새 탭·noopener·카테고리명), "미보유" 문구 없음 / 미보유 기기 → "자사 제품 미보유(공백)" + gapNote, 링크 없음 / 제품 있는 기기 → 제품 카드 / 없는 id → 빈 안내 패널. 대상 기기는 실제 데이터에서 조건으로 선택(없으면 skip) | 4 |
| CT-07 | (v0.9) `pages/ComparePage` (`ComparePage.test.tsx`, 합성 데이터 `compare-fixture.ts` 로 `getData` mock) | 기기: 열 2 + 기본 9행 고정 순서(layer·category·coverage·products·docs·description·learn·upstream·downstream) + 사양 구역(`spec-coverage` "2 / 2개"·"0 / 1개" + key 합집합 SPEC_KEYS 순 → 비표준), 비표준 행 이름 = 데이터 label, 값 없음 "—", 같은 key 두 제품 → 제품별 나열 + 페이지 링크 `#page=`(item.page, 없으면 source.page), 검수 전 배지 / 상류·하류 = 모선 너머·신호·택1·끝점 / 차이만 보기(같은 3행 숨김·건수 문구·복원), 사양 없는 기기끼리 → `spec-none` 1행·차이만 보기에서 구역 사라짐 / 열 빼기 → URL ids·store 갱신, 1개 → `compare-empty` / 제품: 기본 5행 + 사양 + `spec-source`, 한 제품 같은 key 2값, 출처 링크 `#page=source.page`·검수 전/완료·추출일, 차이만 보기(출처 행 유지, 둘 다 미수집이어도 유지), 서로 다른 기기 → 섞기 안내, 없는 id·4개 초과 안내, 빈 상태 "담아 둔 … 비교하기" 링크 / B1 회귀(React key 중복 경고 0) / **(v1.0)** 사양 loading → `spec-loading` 행, 실패 → `compare-row-spec-error`(차이만 보기에도 유지)+안내·검수 배지 없음 / 공유 링크 열 빼기 → URL 만(쉼표 그대로), 같은 비교면(순서 무관) 목록에서도 제거 / 열 빼기 후 차이만 보기 유지 / M3 "690 V" = "６９０ Vac" 숨김(표기는 원문) / M8 공통 기기 → 안내 없음·소속 기기 칸·열 부제 = 공통 기기 / 잘못된 type 안내 / "사양 미수집" vs "카탈로그에 없음" | 21 |

### 3c. 단위 테스트 (UT, v0.4)
| ID | 대상 | 검증 | 테스트 수 |
|---|---|---|---|
| UT-01 | `lib/pages/catalog.ts` `buildGapCsv` | UTF-8 BOM(U+FEFF) 시작·CRLF 줄 끝 / 헤더 **10열**(v0.7 마지막 열 "판정")·행 값 / (v0.7) 판정 = 공백류 "공백 후보"·"공백 확정"(재확인 기한 지나면 후보), 보유·해당 없음 빈칸 / 쉼표·큰따옴표·LF·CRLF 값 → `"…"` 감싸기 + `""` escape, RFC 4180 파서로 되읽어 열 수·값 보존 / 특수문자 없는 값은 그대로, 빈 목록 = 헤더만(`…,메모,판정`) / (v0.5) `= + - @` 로 시작하는 셀 앞에 `'` (수식 주입 방지), 중간 기호는 그대로 | 6 |
| UT-02 | (v0.5) `data/load.ts` `resolveProducts` | 상위 코드만 지정해도 하위·손자 카테고리 제품 포함(M3) / 하위 코드 지정 시 상위·형제 제외 / productIds 합치기·중복 제거·없는 id 무시 / 빈 경우 [] (합성 AppData) | 4 |
| UT-03 | (v0.5) 사진 URL | `equipmentImageUrl` = 원본 file, `equipmentThumbUrl` = thumb / 없는 기기 undefined / `getDiagramModel().nodes[].imageUrl` 은 모두 `images/equipment/thumb/` | 3 |
| UT-10 | (v0.7) `lib/integrity` 공용 검사 (`tests/unit/lib/integrity.test.ts`) | 합성 데이터셋(밴드 L1~L7 · 기기 9 · 사슬 n1~n7 · L6 모선 1 + 피더 2) = 오류 0·경고 DI-29 만 / 최상위 형태 오류 → 예외 없이 DI-00 / `Collector.run` 예외 → 그 규칙 오류 / **T2 R3 관리자 실패 시나리오 → 규칙 ID**: 모선 끝 가로 출발·범위 밖·points 없음 DI-46, 모선이 타일과 겹침 DI-39, 모선 연결 1개 DI-40, 참조 타일 라벨 없음 DI-43, 택1 단독·라벨 없음 DI-43c, sourced+unknown DI-27b·없는 날짜 DI-27e·http 근거 DI-27f, 전력선 같은 가로선 겹침 DI-45a(신호선이면 통과), 타일 관통 DI-44a / HARD 규칙 표 49건(규칙마다 위반 → 그 ID) / SOFT 10건(경고만·오류 0) + DI-40 SOFT / **(v0.8) 분기별 위반**: DI-35 기기 타일 밴드 밖, DI-39 중심 거리 < 24(겹침 아님), DI-40 끝점·참조 타일 연결 0, DI-43 같은 기기 노드 2개, DI-44a 모선 관통, DI-44b 끝 점 가장자리 밖(사선 아님) / **(v0.8) 메타**: 위반 케이스가 기대 ID 를 실제로 보고했을 때만 `verify` 로 기록 → RULES 의 HARD(error)·SOFT(warning) 규칙 전부가 기록됐는지 대조 (손 목록 없음) / `checkEquipment` field·하위 카테고리 연결·재확인 기한 / 모든 시나리오에서 error·warning 등급 = RULES 표 | 85 |
| UT-11 | (v0.7) `lib/diagram/router.ts` (`tests/unit/lib/router.test.ts`) | **골든**: diagram.json 모든 연결선 `routeEdge` = 저장된 points(없으면 points 없음) — 현재 86/86 / 모선 연결선 모두 points, points 없는 선의 기본 경로는 관통 0 / `pyRound`·`boxOf`(모선 정수 반폭) / 막힌 경로 → A* 직교 우회, 완전 포위 → no-path, 없는 노드 → missing-node / 모선: 수직 points(양방향), 범위 밖 bus-range, 수직 막힘 bus-blocked(막는 노드), 모선끼리 bus-to-bus / 관리자 draft 거부: addEdge 범위 밖·수직 막힘, moveNode 피더·모선 이동, updateNode 모선 61px | 12 |
| UT-12 | (v0.7) `lib/admin/draft.ts`·`integrity.ts` (`tests/unit/lib/admin-draft.test.ts`) | `validateDraft(현재 데이터)` = 오류 0·경고 0, Issue 에 nodeId / 기기 추가(DI-43) → 자동 배치(DI-40) → 380V 모선 연결(수직 points) → 오류 0 / 배치 거부(밴드 밖·30px·모선 20px·모선 60px 미만·라벨 없음) / 이동(같은 자리 무변경, 모선 y 이동 시 피더 points 갱신) / 모선 길이(늘리기 허용, 61 거부, 60 미만) / 노드 삭제(연결선 함께, DI-40), 기기 삭제는 노드 먼저 / 연결 추가·삭제(중복·자기·없는 노드 거부, 고립 DI-40, 다시 연결) / alt 단독 DI-43c / 참조 타일(원래 노드 필요, 라벨 없음 DI-43) / **review (v0.8 R5)**: 계통 구조 편집 → pending+오늘+`{오늘} 관리자 편집 — 설계팀 재검수 필요`, approved 원본 → 기존 note 보존 `{note} → {문구} (이전 검수: {검수자} {검수일})`(기대 문구는 구현 호출 없이 직접 작성), 현재 데이터 note·검수자 보존, 같은 날 두 번·저장 후 재편집해도 문구 1회(다른 날은 추가), 기기 설명만 변경 → topologyChanged=false·approved 유지(같은 객체), 이동 되돌리기 → approved 복원, 사진만 변경은 그대로, 변경 요약 줄(재검수 전환+note / 유지) / sourced+다른 공급 방식 DI-27b·`coverageIssues` field / `upsertEquipment` 키 순서·사진 삭제·원본 텍스트 동일 / `suggestId` | 20 |
| UT-13 | (v0.9) `lib/pages/compare.ts` (`compare.test.ts`, 합성 데이터) | `parseCompareParams`: type 없음 → null / (v1.0) 잘못된 type → null+`badType`(소문자·trim) / 대소문자·공백 → 정상 type / `ids=a&ids=b` 반복·쉼표 혼합 / 순서 유지·공백 무시 / 없는 id → missing / 제품 type 은 제품 id 로만 / 중복 합침 / 4개 초과 → overflow(없는 id 는 개수 제외) / `%2C` / `orderSpecKeys`(표준 순 → 비표준 첫 등장 순, 중복 제거) / `specLabel`·`pageHref` / (v1.0 M4) `specValueText` 단위 = 괄호 밖 숫자 뒤·괄호 주석 앞(문서 예 3개 + 끝 숫자·괄호 안 숫자만·괄호 시작), "40(10)" 계기 표기 덩어리 유지 / (v1.0 M3) `compareKey` 같음(NFKC 전각·물결표 변형·대소문자·VAC/V AC/Vac→V·공백·쉼표=슬래시·숫자 목록 정렬) / 다름(VDC 구분·mA↔A 환산 안 함·범위 정렬 안 함) / 정규화 결과 문자열 / `equipmentSpecMap(eq, specs)`(한 제품 같은 key 여러 값 모두)·`specProductCount(eq, specs)`, 빈 Map → 0 / `countDocs`·`productDocs`·`equipmentDocCounts`·`representativeDoc` 우선순위 / `equipmentForProduct` 하위 카테고리 / `linkedEquipment`: 모선 건너뛰기·형제 피더 제외·신호선 뒤·택1·끝점 라벨·같은 기기 1회·참조 타일 연결 제외·자기 제외·노드 없음 [] — 기대값은 손으로 작성 | 29 |
| UT-14 | (v0.9, v1.0 갱신) `store/useCompareStore.ts` + `CompareTray`·`CompareToggle` (`tests/unit/store/useCompareStore.test.tsx`) | (v1.0) 담는 id 는 실제 데이터 id(store 가 데이터 존재 검사) / 토글 added/removed/full / 기기·제품 분리, active / remove·clear / 저장 / `compareHref` / setItem·getItem 예외 → 메모리 / JSON 깨짐·null·숫자 → 빈 목록, 형식 손상(사라진 id 포함) 정리 **+ 정리 결과 저장**, 정상 값은 다시 쓰지 않음 / **B2**: 불러올 때 사라진 id 제거, 사라진 id 4개뿐 → 담기 버튼 동작(v0.9 기대 실패 → 회귀), 메모리에 사라진 id 남은 탭 → 가득 판정 유효 id 기준·담을 때 정리 / **M1**: 같은 키 storage 이벤트 반영·다른 키 무시·key=null 비움, 이벤트 없이도 변경 직전 재읽기로 다른 탭 변경 위에 얹음(toggle·full·remove), 다른 탭 값의 사라진 id 정리 / 바 표시 경로: `/`·`/gap` 보임, `/compare`·`/compare/`·`/compare//` 숨김 / 종류 전환 버튼 "n/4" / 담기 버튼 가득 → 비활성+title, 제품 별도 | 26 |
| UT-15 | (v1.0 M6) `data/load.ts` `loadSpecs`·`peekSpecs` (`tests/unit/lib/load-specs.test.ts`, node 환경) | AppData 에 specs 없음, 불러오기 전 peek undefined / loadSpecs → specs.json 전체 Map, 같은 Promise·같은 Map 메모, peek = 같은 Map / 검증 실패 → `DataValidationError` 거절·getData 정상·peek undefined·다음 호출은 새 Promise / import 실패 → 거절 후 다음 호출이 새로 시도해 성공 | 4 |

---

## 4. 기능 테스트 케이스

| ID | 시나리오 | 입력/조작 | 기대 결과 | 층 |
|---|---|---|---|---|
| FT-01 | 노드 클릭 → 상세 | owned 노드 클릭 | 우측 패널 열림, 제목=기기명, 커버리지 배지, 자사 제품 카드 목록, 학습 포인트. 노드 `aria-pressed=true` | 컴포넌트·E2E |
| FT-02 | 다른 노드로 전환 | 패널 열린 상태에서 다른 노드 클릭 | 패널 내용 교체(닫혔다 열리지 않음), 이전 노드 선택 해제 | 컴포넌트 |
| FT-03 | 빈 곳 클릭/닫기 | 캔버스 빈 곳 클릭 또는 닫기 버튼 | 패널 닫힘, 선택 해제. **패닝 드래그 후 놓기는 클릭으로 처리 안 됨** | 컴포넌트·E2E |
| FT-04 | Gap 모드 | 보기 모드 → Gap | **같은 계통도 위**에서 강조 (URL `#/?mode=gap`, 페이지 이동 없음). missing·partial `data-emphasized`, owned·na `data-dimmed`, affiliate 보통. 범례 유지 | E2E |
| FT-05 | 공백 기기 상세 | missing 노드 클릭 | "자사 제품 미보유(공백)" 빈 상태 + gapNote. 오류 화면 아님, 제품 목록 없음 | 컴포넌트·E2E |
| FT-06 | 계열사 기기 상세 | affiliate 노드 클릭 | affiliateName 표시, 계열사 색/아이콘 | 컴포넌트 |
| FT-07 | 계층 점프 | 좌측 내비 L5 클릭 | L5 밴드가 뷰포트 안으로 이동(애니메이션 후), 내비 `aria-current` | E2E |
| FT-08 | 계층 점프 + 줌 상태 | 확대한 상태에서 L1 클릭 | 줌 배율을 유지하거나 정해진 배율로 리셋 (규칙 확정 필요), 밴드가 화면 안 | E2E |
| FT-09 | 검색 — 약어 | "VCB" 입력 | 진공차단기 결과 1순위, 선택 시 해당 노드 선택+패널 열림 (필요 시 계층 이동) | 단위(search)·E2E |
| FT-10 | 검색 — 한글/부분/오타 | "차단" / "진공차단" / "진콩차단기" | 관련 기기·제품 결과 (Fuse threshold 확인) | 단위 |
| FT-11 | 검색 — 제품 모델명 | "GIPAM" / 제품 id "P01097" | 제품 결과 → 제품 페이지 이동 | 단위·E2E |
| FT-12 | 검색 — 결과 없음 | "zzqx존재하지않는기기" | `search-empty` + 추천(유사 기기/용어), 콘솔 에러 없음 | E2E |
| FT-13 | 검색 — 키보드 | ↓/↑/Enter/Esc | 결과 항목 이동·선택·닫기 (combobox 패턴, `aria-activedescendant`) | 컴포넌트 |
| FT-14 | 자료 없음 | docs.json 에 없는 제품 / docs 빈 항목 | "자료 준비 중" 배지 + (항목 없음) 공식 제품 페이지 링크 · (빈 항목) 공식 자료실 deepLink, 깨진 링크 0 | 컴포넌트·E2E |
| FT-15 | 외부 링크 새 탭 | 자료 링크(`doc-link`/`detail-doc-link`/`equipment-doc-link`)·공식 페이지 링크 | `target=_blank` + `rel` 에 `noopener`, popup 의 `window.opener === null`, href 가 허용 도메인, 스크린리더 "새 탭" 안내. https 아닌 URL 은 링크 미생성(CT-02) | 컴포넌트·E2E |
| FT-16 | 모바일 폭 패널 | 390×844 에서 노드 탭 | 상세 패널이 **하단 시트**(`data-variant=sheet`), 화면 폭 가득, 가로 스크롤 없음, 시트 닫기 가능 | E2E |
| FT-17 | 모바일 터치 | 핀치 줌 / 한 손가락 패닝 | 페이지 전체 스크롤과 충돌 없음 (`touch-action`) | 수동 |
| FT-18 | 해시 라우트 새로고침 | `#/equipment/:id`, `#/product/:id`, `#/gap`, `#/learn` 에서 F5 | 같은 화면 복원 | E2E |
| FT-19 | 없는 id | `#/equipment/__no__`, `#/product/P99999` | not-found 안내 + 홈 링크, 흰 화면/크래시 없음 | E2E |
| FT-20 | 뒤로가기 | 홈 → 제품 → Back | 이전 화면(가능하면 선택 노드·줌 상태까지) 복귀 | E2E |
| FT-21 | 다크모드 대비 | `prefers-color-scheme: dark` | 텍스트·노드 라벨·범례 WCAG AA (axe color-contrast 0건), 커버리지 5색이 다크 배경에서도 서로 구분 | E2E(axe)+수동 |
| FT-22 | 키보드 — 노드 | Tab 으로 노드 포커스 → Enter/Space | 패널 열림, 포커스 링 보임, Esc 로 닫으면 **포커스가 원래 노드로 복귀** | 컴포넌트·E2E |
| FT-23 | 키보드 — 건너뛰기 | 첫 Tab | "계통도로 건너뛰기" 링크 → Enter → 다음 Tab이 첫 노드 | E2E |
| FT-24 | 색약 대응 | 범례·노드 | 5상태 각각 **색 + 아이콘(모양)** 병행, `aria-label`에 상태 텍스트 포함 ("진공차단기, 보유"). 흑백(grayscale) 스크린샷에서도 구분 | 컴포넌트·E2E·수동 |
| FT-25 | 교육 투어 (v0.4) | 교육 모드 → 계통도 위 "투어 시작" 카드 → 다음 반복 → 핵심 기기 카드 | `/learn?step=L1` 로 이동, `tour-step[data-layer]` L1→L7 순서·역행 없음, `?step=` 동기화, L7 에서 `tour-next` disabled, 핵심 기기 카드 → `/?node=` 노드 선택 + 패널. (승인 디자인: 투어 본체는 /learn, 계통도 밴드 하이라이트 없음) | E2E |
| FT-26 | /gap 공백 표 (v0.4) | `#/gap` → "미보유" 필터 | **기본 필터 "전체"**(리더 결정·승인 디자인): 첫 화면 `gap-filter-all` aria-pressed=true(v0.5), `gap-item` 수 = missing+partial+affiliate (현재 17). `gap-filter-missing` 클릭 → missing 수(현재 12), 모든 행 data-coverage=missing. 셀 클릭 → 그 칸 기기 | E2E |
| FT-27 | 커버리지 통계 | 사이드바 % | (owned + partial×가중치?) / (전체 − na) — 공식 확정 후 단위 테스트 고정 | 단위 |
| FT-29 | 선택 노드 URL 복원 | `#/?node=<nodeId>` 진입·새로고침 / 다른 노드 클릭 / 닫기 / 없는 id | 패널·`aria-pressed` 복원, 클릭 시 `node=` 갱신, 닫으면 파라미터 제거, 없는 id 는 패널 없이 정상 | E2E |
| FT-30 | 공백 표 링크 | 좌측 내비 아래 "공백 표 보기" | `#/gap` 공백 표로 이동 | E2E |
| FT-28 | 데이터 오류 | 스키마 위반 JSON | 빌드/테스트 단계에서 실패 (런타임 흰 화면 아님) | DI |

---

## 5. E2E 핵심 시나리오 (`tests/e2e/core-flows.spec.ts`)

| ID | 페르소나 | 흐름 | 검증 포인트 |
|---|---|---|---|
| E2E-1 | 신입 | 홈 → 교육 모드 → "투어 시작" 카드 → `/learn?step=L1` → 다음×6 → L7 핵심 기기 카드 클릭 / `/learn?step=L4` 딥링크·새로고침 / (v0.6) L1·L4·L7 에 퀴즈·완료·진도 없음 | `tour-step[data-layer]` = L1…L7 정확히 순서대로, `?step=` 동기화, L7 에서 `tour-next` disabled, 카드 → `#/?node=<nodeId>` + `aria-pressed` + 패널 제목·학습 포인트. v0.6: `tour-finish`·`tour-summary`·`tour-complete`·`tour-progress`·`learn-progress`·`quiz*` testid 0개 (v0.5 완료 요약 테스트 **삭제**) |
| E2E-2 | 영업 | 검색에 약어 입력 → 기기 결과 선택 → 패널 → 제품 카드 → 제품 페이지 → 데이터시트/공식 페이지 / (v0.5) "iS7"+Enter / 한글 조합 중 Enter | 노드 선택 상태, 배지 owned, URL `#/product/:id`, 링크 새 탭+noopener+ls-electric.com, popup 이벤트. 자료가 없으면 "자료 준비 중". iS7 → 제품 P01188(이름 iS7) 또는 iS7 연결/인버터 기기가 1순위, GIS 아님. 조합 중(keydown isComposing=true, keyCode 229) Enter → URL·입력값 그대로, compositionend 후 Enter 는 정상 이동 |
| E2E-3 | 기획 | Gap 버튼(같은 계통도, `?mode=gap`) → missing 강조/owned 흐림 → 공백 기기 클릭 → "공백 표 보기" 링크 → `/gap` | URL `mode=gap`·`gap-page` 미표시, 아이콘 병행, gapNote, 제품 목록 없음, 공백 건수 = 데이터. v0.6: affiliate·**sourced = 보통**, 공백 표 "전체" = missing+partial+affiliate+**sourced** (현재 17) |
| E2E-6 | 공통 (v0.6) | 계통도 개선 R3 | `diagram-bus-{id}` 2개·`diagram-endpoint-{id}` 4개 보임 / ref 노드 `data-ref="true"` 3개, 클릭 → 같은 기기 상세 / alt 엣지 `data-kind="alt"` 7개 + 점선 / **(v0.8 데이터 기반)** `diagram-review-badge`: review pending → 보임, approved → 없음 / `legend-item-sourced` "패널 구성품" / 범례 개수 합 = 74(ref 제외), 미보유 = 9, 패널 구성품 = 3 (데이터 기준) / **(v0.8)** Gap 모드 공백류 노드 `data-confidence` = 데이터 판정(confirmed·기한 안 → confirmed, 후보·근거 없음·기한 지남 → candidate), 보유(판정 있음·없음 모두) → 속성 없음 / CT/PT 선택 → `detail-gap-assessment` "공백 판정" + `detail-gap-confidence` = 데이터 판정, 문구 '확정'/'후보' / **(v0.7)** 참조 타일 `?node=` → `detail-meta` "참조 타일", `detail-ref-note`(라벨), `detail-ref-origin` "원래 위치"+기기 계층, `detail-ref-go` → 원래 노드(`node=` 갱신, 메타에 참조 타일 없음) / 모선 형제 피더 칩: 같은 모선 피더 칩은 화살표 없음 + title "같은 모선에서 갈라진 회로", 모선 전원 쪽 칩은 ↑ |
| E2E-ADM | 관리자 (v0.7, `admin.spec.ts`) | `/#/admin` (빈 localStorage). 캔버스 노드·모선 클릭은 `dispatchEvent('click')`(팬/줌 화면 밖 대비) | ADM-1 제목 "관리자 모드"·"보안 장치가 아닙니다 … 이 브라우저에만 저장" 안내·"기기 종류 74"·되돌리기 비활성·원본 검사 `admin-check-ok` / ADM-2 `admin-add-equipment` → 폼(이름·약어→id 자동 `tcb`·L6·380V·해당 없음·설명·학습 포인트) → `admin-save` → 배치 모드 → `admin-auto-place` → `admin-connect-mode` → 380V 모선 클릭 → "연결선 eNNN 추가" → `admin-export` 활성·클릭 → `admin-check-ok`·`admin-exported`·diagram.json·equipment-types.json 다운로드 / ADM-3 연결 모드 모선 → 범위 밖 기기 → `admin-toast` role=alert "모선 범위 밖 … 수직", 되돌리기 비활성·변경 내역 0 / ADM-4 폼 커버리지 sourced → `admin-gap-supply` = panel-sourced + disabled + "고정됩니다" |
| E2E-4 | 공통 | 딥링크·새로고침·뒤로가기·없는 id·자산 404, `?node=` 복원·갱신·제거, `?mode=gap&node=` 조합 | GitHub Pages 시나리오 (preview 빌드 기준) |
| DOCS | 공통 | docs.json 기준: 항목 없음(R-04)·빈 항목(deepLink)·제품 페이지 전체 링크·상세 패널 popup·기기 페이지 | 건수 = docs.json, `data-doc-type`, 새 탭·noopener·허용 도메인. 외부 요청은 `context.route` 로 stub (네트워크 의존 없음) |
| (게이트) | — | v0.4: Phase 2 게이트(`diagram` testid 없으면 전체 skip, `E2E_STRICT`) **제거** — 회귀가 skip 으로 숨지 않게 | |
| SMOKE | 공통 | 홈 진입 | 헤더·범례 6종(v0.6) 표시, 런타임 오류 없음 (`smoke.spec.ts`, Phase 1부터 항상 통과해야 함) |
| E2E-5 | 접근성 | 키보드 Enter/Esc·포커스 복귀, 건너뛰기 링크, 계층 점프, 범례 6종(v0.6), 모바일 하단 시트, 라이트/다크 axe 대비 / (v0.5) 사진 경로 | 타일 img(data-src/src) = `images/equipment/thumb/<id>`, 패널 `.dp-hero img` = 원본 file (thumb 아님) |
| E2E-7 | 공통 (v0.9, `compare.spec.ts`) | 비교 기능. 데이터에서 같은 계층·전압·분류 기기 2개 선택 | 상세 패널 `compare-toggle-{id}` 2회 → `compare-tray-item-*` 2 → `compare-go` → `#/compare?type=equipment&ids=a,b`, 바 숨김, `compare-col-*` 2, 기본 9행 + `compare-section-specs` → `compare-diff-only` → layer·category 행 사라지고 행 수 감소 → `compare-remove-{b}` → `compare-empty` / 제품 `P01072,P01249,P02212`: 사양 행 = specs.json key 합집합(표준 순) + spec-source, 출처 링크 href = `url#page=N`·새 탭, `compare-unreviewed` = reviewed 데이터대로, 차이만 보기에도 출처 행 / 없는 id·중복 → `compare-notice`, 1개 → 빈 상태 / 390px: /compare 가로 넘침 0, 홈 비교 바 → 시트 열면 칩·비우기 숨김(비교하기만), "전체 정보 보기" → 바 숨김 / Gap 모드 `gap-candidate-note` 개수 = 공백류 후보 존재 여부(현재 0) / **(v1.0)** specs 청크 route abort → `compare-row-spec-error`+안내, 기본 행 유지·사양·출처 행 없음 / 공유 링크 열 빼기 → localStorage 목록 그대로 / `#/compare/?…` → 표 + 바 숨김 / P01024+P01021 → "서로 다른 기기" 없음 / 열 머리글 `position: sticky`, `.cmp-scroll` 끝까지 스크롤해도 머리글 top = 박스 top(±2) / 폭 901·920·1024·1100·1280 × 패널 닫힘·열림: 이름 긴 기기·제품 4+4 담고 바 안 보이는 요소 높이 ≤ 40px, 바 폭 ≥ 280 / 390px `/gap`: `--cmp-tray-h` = 바 높이(±1), `.app-main` 끝까지 스크롤 시 마지막 링크 bottom ≤ 바 top, 가로 넘침 0 |

---

## 6. 회귀 안전망 (리팩터링 시 지켜야 할 불변식)

1. **데이터가 진실의 원천**: 컴포넌트에 기기 id·좌표·커버리지 하드코딩 금지. 기기 추가는 JSON 수정만으로 화면·검색·Gap·투어에 반영되어야 한다. (DI 전체 + E2E가 데이터에서 id를 골라 쓰는 구조로 보장)
2. **DI 테스트 통과 = 배포 가능**: `.github/workflows/deploy.yml` 에서 `npm run test` 가 `npm run build` 앞에 실행 → 실패 시 배포 중단.
3. **커버리지 판정 단일 출처**: (R-01) 판정 값은 `equipment-types.json` 의 `coverage` 필드가 원본, 화면 표현·통계 계산은 한 곳(`lib/coverage.ts` 등)에서만. 노드 색·범례·Gap 매트릭스·통계가 모두 같은 함수를 사용 (컴포넌트 테스트에서 동일 fixture로 4곳 결과 일치 확인).
4. **URL 계약 고정**: `#/`, `#/equipment/:id`, `#/product/:id`, `#/gap`, `#/learn` — 신입 교육 자료·메신저에 링크가 공유되므로 경로·id 변경 금지(변경 시 리다이렉트). equipmentType.id 이름 변경은 "파괴적 변경"으로 교차 영향 로그에 기록.
5. **5상태 = 색 + 아이콘 + 텍스트**: 어느 하나만 남기는 리팩터링 금지. `coverage-icon-{state}` testid 유지.
6. **외부 링크 정책**: 모든 외부 링크는 `ExternalLink` 공용 컴포넌트 경유 (target/rel 일괄 보장). 테스트는 그 컴포넌트 1곳 + E2E 샘플.
7. **data-testid 는 공개 API**: §7 목록의 testid 이름 변경 시 테스트와 같이 수정 (리네임 금지가 기본).
8. **정적 배포 호환**: HashRouter 유지, `vite.config` `base: './'` 유지, 런타임 fetch로 절대경로(`/data/...`) 사용 금지.
9. **스키마 엄격도 하향 금지**: DI-00c가 "잘못된 값 거부"를 검사. `z.any()`/`passthrough` 로 느슨하게 바꾸면 실패.

---

## 7. T1 구현 요청 testid

> 규칙: 동적 id는 `{prefix}-{데이터 id}` 형식. 상태는 testid에 넣지 말고 **data-속성/ARIA**로 노출.

### 7.1 전역·헤더
| testid | 요소 | 추가 요구 속성 |
|---|---|---|
| `skip-to-diagram` | 첫 포커스 "계통도로 건너뛰기" 링크 | |
| `search-input` | 검색 입력 | `role=combobox` |
| `search-results` | 결과 목록 컨테이너 | `role=listbox` |
| `search-result-equipment-{equipmentId}` | 기기 결과 항목 | `role=option` |
| `search-result-product-{productId}` | 제품 결과 항목 | `role=option` |
| `search-empty` | 결과 없음 상태 | |
| `search-suggestions` | 결과 없음 시 추천 목록 | |
| `view-mode-product` / `view-mode-gap` / `view-mode-learn` | 보기 모드 버튼 | `aria-pressed` |
| `legend` | 범례 | |
| `legend-item-{coverage}` | 범례 항목 5종 | 내부에 `coverage-icon-{coverage}` |
| `theme-toggle` | (있다면) 테마 전환 | |
| `not-found` | 없는 id/경로 안내 | |

### 7.2 계통도
| testid | 요소 | 추가 요구 속성 |
|---|---|---|
| `diagram` | SVG 루트(또는 래퍼) | `data-view-mode="product|gap|learn"` — R-09: `#/?mode=gap|learn` 쿼리와 동기화. 선택 노드는 `?node=<nodeId>` |
| `diagram-edge-{edgeId}` | 연결선 | `data-kind="power|signal|alt"` — R-07: power 굵은 실선, signal 가는 점선(stroke-dasharray). v0.6: alt(택1) = 점선 + label |
| `diagram-bus-{nodeId}` | (v0.6) 모선 (예: `diagram-bus-bus-229`) | |
| `diagram-endpoint-{nodeId}` | (v0.6) 끝점 라벨 (예: `diagram-endpoint-ep-mv-motor`) | 라벨 텍스트 표시 |
| `diagram-review-badge` | (v0.6) 계통 검수 대기 배지 | review.status=pending 일 때 |
| `diagram-node-{nodeId}` | 노드 `<g>` | `role=button`, `tabindex=0`, `aria-label="{기기명}, {커버리지 한글}"`, `aria-pressed`(선택), `data-coverage`, `data-dimmed`, `data-emphasized` (각 "true"/"false"). v0.6: 참조 타일 `data-ref="true"`, 공백 판정 `data-confidence="candidate|confirmed"` (candidate = 점선) |
| `coverage-icon-{coverage}` | 노드·범례·배지 안 상태 아이콘 | |
| `layer-band-{layerId}` | 계층 밴드 (L1~L7, REN, MON) | |
| `layer-nav` | 좌측 계층 점프 내비 | |
| `layer-nav-{layerId}` | 내비 항목 | `aria-current="true"` (현재 계층) |
| `zoom-in` / `zoom-out` / `zoom-reset` | 줌 컨트롤 | |

### 7.3 상세 패널·페이지
| testid | 요소 | 추가 요구 속성 |
|---|---|---|
| `detail-panel` | 상세 패널 | `data-variant="side|sheet"`, `role=dialog`/`complementary` + `aria-labelledby` |
| `detail-panel-close` | 닫기 버튼 | Esc 도 동일 동작 |
| `detail-title` | 기기명 | |
| `detail-coverage-badge` | 커버리지 배지 | `data-coverage` |
| `detail-learn-points` | 학습 포인트 목록 `<ul>` | |
| `detail-product-list` | 자사 제품 목록 (제품 있을 때만 렌더) | |
| `product-card-{productId}` | 제품 카드(링크) | |
| `detail-empty-products` | "자사 제품 미보유(공백)" 빈 상태 | |
| `detail-gap-note` | 공백/일부 메모 | |
| `detail-affiliate-name` | 계열사명 | |
| `detail-gap-assessment` | (v0.6) 패널 "공백 판정" 섹션 (근거·확신도·확인 부서) | gapAssessment 있는 기기만. 후보면 "후보" 문구 |
| `equipment-page` / `equipment-title` | `/equipment/:id` 페이지·제목 | |
| `product-page` | `/product/:id` 페이지 | |
| `product-official-link` | 공식 제품 페이지 링크 | `target=_blank`, `rel="noopener noreferrer"` |
| `doc-link` | 자료 링크 (여러 개) | `data-doc-type`, `target=_blank`, `rel` |
| `docs-empty` | "자료 준비 중" 배지 | R-04: 이때 `product-official-link` 를 대체 자료로 반드시 표시 |
| `detail-doc-link` / `equipment-doc-link` | 상세 패널·기기 페이지 자료 링크 | `doc-link` 와 동일 속성 (v0.3) |
| `gap-table-link` | 좌측 내비 아래 "공백 표 보기" 링크 (→ `#/gap`) | **v0.3 신규 요청** |
| `gap-page` / `gap-matrix` / `gap-list` / `gap-item-{equipmentId}` | `/gap` 페이지 | |
| `learn-page` | `/learn` 페이지 | |
| `tour-start` / `tour-step` / `tour-next` / `tour-close` | 교육 투어 | `tour-step` 에 `data-layer`, 마지막 단계 `tour-next` disabled. v0.6: `tour-finish`·`tour-summary`·퀴즈·진도 **제거**(사용자 결정). v0.4: `tour-start` 는 계통도 교육 모드 카드(→ `/learn?step=L1`)와 `/learn` 개요 화면 두 곳 |
| `gap-filter-{coverage}` | 공백 표 상태 필터 | `aria-pressed`. v0.4 요청: "전체" 버튼에도 `gap-filter-all` |
| `learn-key-{equipmentId}` | **v0.4 요청**: /learn 핵심 기기 카드 링크 | 현재 E2E 는 `a[href$="node=<nodeId>"]` 로 대체 |

### 7.4 testid 외 구현 요청
1. 노드 클릭 판정: 패닝 드래그(이동량 > 4px)는 클릭으로 처리하지 않기.
2. 계층 점프·검색 선택 시 대상이 뷰포트 안으로 이동 (E2E `toBeInViewport`로 검증).
3. 패널 닫힘 시 포커스를 열었던 노드로 복귀.
4. ~~테스트 스크립트~~ — **완료(T3)**: `test`/`test:watch`/`test:data`/`test:e2e`/`typecheck:tests`, CI 단계 추가.
5. ~~tests 타입체크~~ — **완료(T3)**: `tests/tsconfig.json` (`npm run typecheck:tests`).

---

## 8. 리뷰어 관점 설계 우려 (R-xx)

| ID | 우려 | 제안 |
|---|---|---|
| R-01 | **커버리지 이중 출처**: PLAN 2.3은 "제품 수로 owned/missing 자동 계산"인데, 데이터 계약은 `coverage`를 저장 필드로 둠 → 둘이 어긋날 수 있음. 또 카테고리 코드가 **하위 카테고리 제품까지 포함**하는지 미정 (AAA009처럼 상위 코드를 쓰면 결과가 달라짐) | `coverage.ts`에 "하위 포함" 규칙 명문화, DI-20/21이 같은 해석 사용. 장기적으로 owned/missing은 계산값, partial/affiliate/na만 수동 지정 → **결정(리더)**: coverage 는 데이터에 직접 적는 값이 원본. 자동 계산 안 함, DI-20~26 으로 일관성만 검증. 카테고리 코드는 하위 카테고리 제품 포함으로 해석 |
| R-02 | **스키마가 계약보다 느슨**: `voltage`/`description` 빈 문자열 허용, `learnPoints` 빈 배열 허용, `DocRef.url`·`Category.url`이 `z.string()`(URL 검증 없음), coverage 조건부 필수(affiliate→affiliateName 등)가 스키마에 없음 | `.min(1)`, `z.url()` 적용, coverage 규칙은 `superRefine`로 스키마에 넣으면 런타임 로더(`load.ts`)에서도 차단됨. 현재는 DI 테스트가 보완 |
| R-03 | JSON 최상위 형태가 계약에 명시 안 됨 (배열 vs 객체) | 현재 구현(배열) 고정을 계약에 기록. 테스트는 양쪽 허용 헬퍼로 대응 중 |
| R-04 | **docs 0건**: 수집 스크립트가 menu 트리만 반영해 모든 제품 docs가 빈 배열 → MVP 핵심 행동 3순위(데이터시트 열기)가 전부 "자료 준비 중"이 됨 | 자료실 API 조사(Phase 1) 결과 전까지 "공식 제품 페이지" 링크를 1차 자료로 노출 → **결정(리더)**: docs 가 비면 공식 제품 페이지 링크를 대체 표시 → E2E `예외 상태 R-04` 가 `product-official-link` 검증 |
| R-05 | 고립 노드 5개(category=system): 신입에게 계통 위치가 안 보임 | 리더 판단 필요 — 의도라면 DI-40 예외 유지, 아니면 대표 연결선 또는 "포함 기기" 표시 → **결정(리더)**: 의도됨(패널·일괄설비 그룹 표시). n-substation, n-mv-swgr, n-lv-swgr, n-modular, n-railway — DI-40 예외 유지, 이 5개 외 신규 고립 system 노드는 SOFT 경고 |
| R-06 | 자동 생성 파일(products/categories.json)을 재수집하면 **id가 사라질 수 있음**(단종·개편) → equipment.productIds 끊김 | 재수집 시 DI-11 실패로 감지됨. 수집 스크립트에 "이전 대비 삭제 id" 리포트 추가 권장 |
| R-07 | `edge.kind`(power/signal) 시각 구분 미정 → signal 선(감시 통신)이 전력 흐름으로 오해될 수 있음 | 점선 등 스타일 구분 + 범례 항목 추가 → **결정(리더)**: power = 굵은 실선, signal = 가는 점선 → E2E `R-07` (computed stroke-width·dasharray 비교) |
| R-08 | Gap 모드에서 `na`(해당 없음)·`affiliate`의 강조 규칙 미정 | 강조/흐림 표를 UX에 명시 (테스트는 missing·owned만 고정) → **결정(리더)**: missing(빨강)·partial(노랑) 강조, affiliate(파랑) 보통, owned·na 흐림 → E2E-3 에 반영 |
| R-09 | 보기 모드·선택 노드가 URL에 없음 → "이 Gap 화면 봐주세요" 링크 공유 불가 | `#/?mode=gap&node=vcb` 쿼리 지원 검토 (P1) → **결정(리더)**: `?mode=gap|learn` URL 쿼리로 공유 (Phase 2) → E2E `R-09` 테스트 추가 |
| R-10 | 공개 사이트(GitHub Pages): gapNote에 내부 판단/경쟁사 메모가 들어갈 위험 | DI-52 키워드 경고 + gapNote 작성 가이드("공개 정보만") |
| R-11 | 74노드 SVG + 줌/패닝 + 모바일: 노드마다 이벤트 핸들러·필터 효과 사용 시 저사양 모바일 성능 저하 | 이벤트 위임, 필터/그림자 최소화 (T4 성능 점검 항목) |
| R-12 | tests 폴더가 `tsconfig` include 밖 → 타입 오류가 빌드에서 안 잡힘 | §7.4-5 |

---

## 9. 실행 결과 (2026-11-18, v0.2)

| 대상 | 결과 | 비고 |
|---|---|---|
| DI (`npm test`) | **51 통과 / 0 실패** | SOFT 경고 0건. 수정 1건: jsdom 환경에서 `import.meta.url` 이 file: 스킴이 아니어서 DI 파일에 `@vitest-environment node` 지정(테스트 코드 버그) |
| 타입체크 (`typecheck`, `typecheck:tests`) | 통과 | |
| E2E 스모크 (`smoke.spec.ts`) | **1 통과** | ARIA 셀렉터(banner, list "커버리지 범례") 사용 — 현재 셸에 testid 없음 |
| E2E 핵심 (`core-flows.spec.ts`) | 기본 21 skip (Phase 2 게이트) / `E2E_STRICT=1` 시 20 실패 · 1 skip | 실패 원인 전부 testid 미구현(Phase 2 UI). skip 1 = 자료 있는 제품 없음(docs 0건) |


## 10. 실행 결과 (2026-11-18, v0.3 — T1 Phase 2 진행 중 스냅샷)

| 대상 | 결과 | 비고 |
|---|---|---|
| `npm run test` | **80 통과 / 0 실패** (파일 3) | DI 60 (기존 51 + DI-60~68 9) · CT 20. docs.json(제품 5 · 자료 22) 기준 위반 0, SOFT 경고 0 |
| `npm run typecheck:tests` | 통과 | |
| E2E (`npm run test:e2e`, 29건) | **12 통과 · 17 실패** | `diagram` testid 가 생겨 게이트가 열림. 실패 원인: 계통도 노드(`diagram-node-*`) 미렌더, 검색·투어·`/gap` testid, `?mode=gap`/`?node=`/`gap-table-link` 미구현 (Phase 2 진행 중). 통과: 스모크, 라우팅 4, 범례, axe 라이트/다크, docs.json 자료 링크 4(R-04·빈 항목·제품 페이지·기기 페이지) |


## 11. 실행 결과 (2026-11-18, v0.4 — 커밋 1ce6811 Phase 2~5 기준)

| 대상 | 결과 | 비고 |
|---|---|---|
| `npm run test` | **114 통과 / 0 실패** (파일 6) | DI 77 (기존 60 + DI-70~86 17) · CT 33 (CT-01 11 · CT-02 9 · CT-03 9 · CT-04 4) · UT 4. SOFT 경고: DI-67 15건(docs 빈 제품), DI-78 1건(learn draft), DI-86 1건(hmi.png 501KB) |
| `npm run typecheck:tests` | 통과 | |
| `npm run test:e2e` (30건) | **28 통과 · 1 실패 · 1 skip** | 실패 1 = FT-26 공백 표 기본 필터 "전체"(기대 17, 실제 12) → **구현 변경 대기(T1, 리더 결정)** — 테스트는 승인 디자인 기준으로 먼저 고정. skip 1 = R-04(모든 제품 199개가 docs.json 에 항목이 있어 "항목 없음" 데이터 없음 — 정상). E2E-1 은 `--repeat-each=3` ×2 회 안정 |

### 11.1 실패 분류
| 테스트 | 분류 | 원인·조치 |
|---|---|---|
| FT-26 `/gap 공백 목록: 기본 필터 "전체"…` | **구현 변경 대기** (버그 아님) | `GapPage.tsx:51` `useState('missing')` · `:78`·`:86` 칸 해제 시 `'missing'` 복귀 → `'all'` 로 바꾸면 통과. 주석 `:50`(FT-26 근거)도 같이 수정 필요 |
| (v0.3 → v0.4 정리) E2E-1 `layer-band` 기대 | 테스트 버그 → 수정 | 승인 디자인은 /learn 페이지 투어 — 테스트를 디자인에 맞춤 |
| (v0.4) E2E `nodeWithDocs` 헬퍼 | 테스트 버그 → 수정 | 사용되지 않는 `EquipmentInfo` 의 "연결 제품 ≤5" 규칙을 따르고 있었음 → DetailPanel/EquipmentPage 실제 규칙(자료 있는 연결 제품 존재)으로 변경 |

## 11b. 실행 결과 (2026-11-18, v0.5 — 개선 R2, 88e45e2 + T1 R2 작업 중)

| 명령 | 결과 | 비고 |
|---|---|---|
| `npm run test` | **126 통과 / 0 실패** (파일 7) | DI 81 (DI-44 a/b/자기검증 3 · DI-82b 1 추가) · CT 33 · UT 12 (UT-01 5 · UT-02 4 · UT-03 3) |
| `npm run typecheck:tests` | 통과 | |
| `npm run test:e2e` (34건) | **31 통과 · 2 실패 · 1 skip** | 실패 2 = E2E-1 `tour-finish` 미구현 → **구현 대기(T1 R2)**. 통과: FT-26 `gap-filter-all`, iS7+Enter, IME Enter 무시, 타일 thumb·패널 원본. skip 1 = R-04(정상) |

## 11c. 실행 결과 (2026-11-18, v0.6 — 개선 R3, T1 구현 진행 중 스냅샷)

| 명령 | 결과 | 비고 |
|---|---|---|
| `npm run test` | **144 통과 / 1 실패** (파일 7) | DI 94 · CT 39 · UT 12. 실패 1 = DI-46 |
| `npm run typecheck:tests` | tests/ 오류 0 | src/ 오류는 T1 진행 중 (구현 대기) |
| `npm run test:e2e` (40건) | **39 통과 · 1 실패 · 1 skip** | T1 중간 빌드(`vite build` 로 별도 폴더에 빌드 → preview)로 실행. 실패 1 = `detail-gap-assessment` 미구현 → **구현 대기(T1)**. 모선·끝점·ref·alt·검수 배지·sourced 범례·범례 합 74·공백 후보 data-confidence 는 통과. 이후 T1 편집 중 빌드 실패로 재실행 불가 |

### 11c.1 실패 분류
| 테스트 | 분류 | 내용 |
|---|---|---|
| DI-46 | **실제 버그 (데이터·생성기, 리더)** | e033 `bus-229 → n-tr-66`: 모선 width 551(홀수) → 오른쪽 끝 x=1449.5, 참조 타일 n-tr-66 x=1450 이 모선 범위 밖 0.5px. 생성기 A* 가 모선 끝(1449)에서 1px 가로 꺾임 `(1449,2097)→(1450,2097)→(1450,2156)` 을 만듦. 수정안: 모선 길이를 n-tr-66 까지 덮도록(예: 기준 길이 382 → 짝수 width) 또는 Box hw 를 올림 처리 |
| E2E-6 공백 판정 섹션 | 구현 대기 (T1) | 패널 `detail-gap-assessment` 섹션 없음 |


## 11d. 실행 결과 (2026-11-18, v0.7 — 개선 R4, T1 R4 반영 커밋 기준)

| 명령 | 결과 | 비고 |
|---|---|---|
| `npm run test` | **260 통과 / 0 실패** (파일 10) | DI 101 · UT-10 79 · UT-11 12 · UT-12 16 · UT-01 6 · load 7 · CT 39. (R4 T1 직후 141/145 — UT-01 CSV 열 4건 → 해소) |
| `npm run typecheck:tests` | 통과 | |
| `npm run test:e2e` (47건) | **46 통과 · 0 실패 · 1 skip** | 새 6건(ADM-1~4, E2E-6 참조 타일 패널·형제 피더 칩) 통과. skip 1 = R-04(정상) |

- 공용 검사 현재 데이터: 오류 0 · 경고 0. 라우터 골든 86/86.
- 실제 버그: 이번 라운드 발견 없음 (T2 R3 관리자 실패 시나리오 10종 모두 공용 검사가 해당 규칙 ID 로 차단, 관리자 draft 가 모선 범위 밖·수직 막힘을 편집 단계에서 거부).

## 11e. 실행 결과 (2026-11-18, v0.8 — 개선 R5, 데이터 확정 + T1 R5 review 규칙 반영 후)

| 명령 | 결과 | 비고 |
|---|---|---|
| `npm run test` | **270 통과 / 0 실패** (파일 10) | UT-10 85(+6 분기, 메타 2건 교체) · UT-12 20(review 3건 → 7건) · 나머지 동일 |
| `npm run typecheck:tests` | 통과 | |
| `npm run test:e2e` (47건) | **46 통과 · 0 실패 · 1 skip** | 이전 실패 1건(CT/PT '후보' 고정) → 데이터 기반으로 해소. skip 1 = R-04(정상) |

- 실패 분류: 데이터 확정으로 깨진 테스트 1건(E2E CT/PT)·T1 R5 review 문구 변경으로 깨진 UT-12 2건 → 모두 **테스트 기대값 갱신**(제품 버그 아님). 구현 대기 0.
- 메타 테스트 검증: 표에서 DI-50(HARD)·DI-52(SOFT) 케이스를 지운 사본으로 실행 → 두 메타 테스트가 해당 ID 를 보고하며 실패함을 확인.

## 11f. 실행 결과 (2026-11-18, v0.9 — 비교 기능 f4f9c69)

| 명령 | 결과 | 비고 |
|---|---|---|
| `npm run test` | **332 통과 · 2 기대 실패(it.fails) · 0 실패** (파일 13) | +64: DI 13 · UT-13 22 · CT-07 14 · UT-14 15 |
| `npm run typecheck:tests` | 통과 | |
| `npm run test:e2e` (52건) | **51 통과 · 0 실패 · 1 skip** | +5 E2E-7. skip 1 = R-04(정상) |

- specs.json 데이터 위반 0 (35제품·229항목, source.url 35/35 이 그 제품 docs.json 자료, 비표준 key 20종 label 일관, 페이지 누락 0, 검수 전 35/35).
- **발견 버그 (구현, `it.fails` 로 재현)**
  - **B1 (낮음, 잠복)** `ComparePage` 기기 비교 대표 사양 칸 `<li key={product.id}>` — 한 제품이 같은 key 를 2개 이상 가지면 React "same key" 경고(재렌더 시 항목 누락·중복 위험). 제품 비교는 index key 라 정상. 현재 데이터는 DI-93 으로 막힘. 재현: CT-07 `[BUG]`. 수정: `key={`${product.id}-${i}`}`.
  - **B2 (중간)** 비교 담기 저장 목록이 데이터에서 사라진 id 로 차 있으면 자리를 계속 차지: 4개 모두 사라진 id → 비교 바 0개라 숨고(모두 비우기 없음) 모든 "비교에 담기" 버튼이 "가득 찼습니다"로 비활성 → 사용자가 복구 불가(localStorage 직접 삭제 외). 1~3개면 보이는 칩 수보다 일찍 full. 재현: localStorage `lse-compare-v1 = {"equipment":["gone-1","gone-2","gone-3","gone-4"],"product":[],"active":"equipment"}` → 아무 기기 상세 패널. UT-14 `[BUG]`. 수정안: store 초기화(또는 toggle·CompareToggle 의 full 판정)에서 데이터에 있는 id 만 세기 / 비교 바 마운트 시 사라진 id 정리.
- 참고(버그 아님·확인 필요): ① 제품 비교 사양 칸은 `item.page` 없으면 페이지 링크를 생략(기기 비교는 source.page 로 대체) — 현재 데이터는 모든 item 에 page 가 있어 차이 없음. ② 소속 기기가 없는 제품을 섞으면 "서로 다른 기기" 안내가 뜸(빈 기기도 하나의 기기로 셈). ③ 비표준 key 행 이름은 첫 제품 label — DI-95 로 일관성 보장.


## 11g. 실행 결과 (2026-11-18, v1.0 — 비교 기능 수정 라운드, 커밋 전 작업 트리)

| 명령 | 결과 | 비고 |
|---|---|---|
| `npm run test` | **364 통과 · 0 실패** (파일 14, 기대 실패 0) | v0.9 334 → +30: UT-13 +7 · CT-07 +7 · UT-14 +11 · UT-15 +4 (it.fails 2 → it) |
| `npm run typecheck:tests` | 통과 | |
| `npm run test:e2e` (63건) | **62 통과 · 0 실패 · 1 skip** | E2E-7 5 → 16. skip 1 = R-04(정상) |

- v0.9 버그 **B1(li key)·B2(사라진 id 자리 차지) 수정 확인** — 재현 테스트가 통과로 바뀌어 `it` 회귀 테스트로 전환.
- specs.json 인용 페이지 9건 정정 후 DI-90~99c 위반 0 (35제품·229항목).
- 테스트 갱신 사유(제품 버그 아님): M6 로 AppData.specsByProductId 제거 → 픽스처·mock, `equipmentSpecMap`·`specProductCount` 인자 2개, `type=Equipment` 허용(의도), store 가 데이터에 없는 id 를 정리 → store 테스트를 실제 id 로, `specValueText` 가 주석 앞에 공백 포함 단위 삽입("60 A (Hz 기준)").
- 새 버그: 없음. 참고(확인 필요, 낮음): `loadSpecs` "실패 시 재시도"는 메모를 해제해 새 `import()` 를 부르지만, 브라우저는 실패한 모듈 URL 을 모듈 맵에 캐시할 수 있어(브라우저별) 같은 페이지에서 재시도가 다시 실패할 수 있음 — 화면 안내 문구("새로고침하면 다시 시도")는 이와 맞음. 단위 테스트(UT-15)는 vitest 모듈 레지스트리 기준이라 이 차이를 검증하지 못함. 검증 실패(평가된 모듈 캐시)는 재시도해도 같은 결과 — 정상.

## 12. CI 의견 — deploy.yml 에 E2E 단계 (넣지 않음, 의견만)

**권장: 넣되 배포 job 과 분리된 별도 job(또는 PR 워크플로)으로.**
- 근거: 이 포털의 P0 장애(해시 라우팅·base './'·자산 경로)는 dev 서버에서 재현되지 않고 **preview 빌드에서만** 잡힌다 — E2E 가 이미 그 구성(`build && preview`)으로 돈다. 30건이 로컬 8초대, CI 에서도 브라우저 설치 포함 2~3분 수준.
- 방식: `e2e` job — `npm ci` → `npx playwright install --with-deps chromium` → `npm run test:e2e` (CI=1 이면 retries 1, reporter github, `reuseExistingServer:false` 이미 설정됨). 실패 시 `playwright-report`/trace 를 artifact 업로드.
- 배포 차단 여부: 처음 1~2주는 `deploy` 의 `needs` 에 넣지 않고 **신호만**(flaky 관찰) → 안정되면 `needs: [build, e2e]` 로 차단. DI(`npm run test`)는 지금처럼 build 전 차단 유지.
- 주의: ① 현재 FT-26 이 구현 변경 대기라 그대로 넣으면 즉시 빨간불 → T1 반영 후 활성화. ② 외부 사이트 요청은 테스트에서 `context.route` 로 stub 되어 있어 네트워크 의존 없음. ③ `push: main` 만 트리거라 PR 단계 검증이 없음 → `pull_request` 트리거 워크플로를 따로 두는 편이 효과가 큼.
