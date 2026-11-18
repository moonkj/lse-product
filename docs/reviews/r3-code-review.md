# (개선 R3) 최종 코드 리뷰 — 품질 관점 (가독성·유지보수성·확장성)

> 리뷰어: Teammate 3 · 2026-11-18 · 대상 커밋 `c100c20` (개선 R3) — src/ 전체, 특히 `lib/diagram/{model,router}.ts`, `lib/admin/**`, `pages/admin/**`, `components/panel/**`, `lib/labels.ts`, `pages/learn/**`, `scripts/build-diagram-data.py`
> 확인한 것: `tsc --noEmit` 통과, `vitest run` 145/145 통과 (리뷰 시점 재실행). 라우터 동등성은 스크래치 스크립트로 `routeEdge(현재 diagram.json)` 와 저장된 `points` 를 대조해 **86/86 일치**를 직접 확인 (저장소에 테스트로는 없음).
> 우선순위: **반드시** = 다음 라운드에 꼭 포함 (계약 위반·실제 결함) · **권장** = 넣으면 좋음 (중복·경계·테스트 공백) · **선택** = 여유 있을 때
> 요약: **반드시 1 · 권장 9 · 선택 5** → 반드시 1건이 있어 **(개선 R4) 범위로 제안** (작업량은 반나절 이내)

---

## 1. 이전 리뷰(phase2-code-review.md) 처리 상태

| 항목 | 상태 | 근거 |
|---|---|---|
| M1 심볼 2벌 | ✅ 해소 | `components/common/EquipmentSymbol.tsx` 하나, `pages/EquipmentVisual` 은 사진/심볼 선택만 |
| M2 분류 라벨 2벌 | ✅ 해소 | `lib/labels.ts:10` `CATEGORY_LABELS` 단일, `catalog.ts:19` 는 재수출만 |
| M3 resolveProducts R-01 | ✅ 해소 | `data/load.ts` — 접두사로 하위 카테고리 포함 |
| M4 죽은 `EquipmentInfo` | ✅ 해소 | 파일 삭제 |
| M5 오류 경로 표기 | ✅ 해소 | `learnSchema.ts:47` `'src/content/learn.json'`, `ErrorDetails.tsx` 가 `src/` 경로를 그대로 표시 |
| M6 공백 표 기본 필터 | ✅ 해소 | `GapPage.tsx:53` `'all'`, `gap-filter-all` testid |
| R1 배지 6곳 | ✅ 해소 | `CoverageBadge` `variant` |
| R2 커버리지 라벨 변형 | ✅ 대부분 | `COVERAGE_SHORT_LABELS` 추가. 남은 산재는 아래 O1 |
| R3 "공백" 정의 3가지 | ✅ 해소 | `labels.ts:59-75` 의도 이름(`EMPHASIZED_`·`DIMMED_`·`GAP_LIST_COVERAGES`) — 단 `ASSESSED_COVERAGES` 와 같은 집합 2벌 (아래 R7) |
| R4 빈 상태 3중 | ✅ 해소 | `common/EmptyProducts.tsx` |
| **R5 파생 캐시 2곳** | ❌ **미처리 (오히려 확대)** | 아래 R5 — 이번엔 "모선 건너뛰기 이웃" 규칙까지 2벌 |
| R6 큰 파일 분리 | ✅ 해소 | `pages/learn/`, `components/panel/` 분리. (새로 큰 파일: 관리자 화면 — O3) |
| R7 오류 경계 | ✅ 해소 | `AppLayout.tsx:46` `PageErrorBoundary resetKey={pathname}` |
| R8 스토어 죽은 상태 | ✅ 해소 | `store/useAppStore.ts` = `searchQuery` 만 |
| **R9 DataValidationError 위치** | ❌ **미처리** | 아래 R6 |
| R10 번들·이미지 | ✅ 대부분 | 페이지별 `React.lazy`, 사진 10MB → 7.3MB. docs.json 동적 import 는 미처리(리더 보류 항목) |
| O1 `useData` 별칭 | 미처리 (선택, O5 로 유지) | `data/load.ts:89` |
| O2 `isMainLayer` | ✅ | `labels.ts:121` |
| O3 `focusNode` | ✅ | `lib/diagram/url.ts:96` |
| O5 CSV 수식 주입 | ✅ | `catalog.ts:177-181` |
| O8 퀴즈 라디오 | 해당 없음 | 퀴즈 제거 |
| O9 testid | ✅ | `learn-key-*`, `gap-filter-all` |
| O4·O6·O7 | 미처리 (선택 유지) | 내비 짧은 이름·초기 뷰 좌표, 링크 복사 실패 안내, 로빙 tabindex |

---

## 2. 좋은 점

| # | 항목 | 근거 (파일:라인) |
|---|---|---|
| G1 | **라벨·규칙의 단일 출처가 R3 신규 개념까지 확장됨** — 6번째 상태(sourced)·확신도·판정 근거·공급 방식 라벨과 `gapConfidence()`(재확인 기한 경과 시 후보로 강등) 규칙이 `labels.ts` 한 곳. 계통도 테두리·패널·공백 표·교육이 같은 함수 사용 | `lib/labels.ts:37-118`, `panel/GapAssessmentSection.tsx:21`, `pages/GapPage.tsx:278` |
| G2 | **스키마가 노드 종류 계약을 강제** — `kind` 별 필수/금지 필드(모선 width, 모선·끝점의 equipmentTypeId·ref 금지)를 `superRefine` 으로 한국어 메시지와 함께 검증 → 관리자 가져오기·DI·런타임이 같은 계약 | `lib/schema.ts:146-170` |
| G3 | **router.ts 의 Python 충실 포팅** — 힙 비교를 Python 튜플 사전식 순서와 맞추고(`less`), 은행원 반올림(`pyRound`)까지 재현해 결과가 비트 단위로 같음 (리뷰어 재확인 86/86). 순수 함수·무의존이라 테스트하기 쉬운 형태 | `lib/diagram/router.ts:156-205, 60-66` |
| G4 | **관리자 편집이 순수 함수 + 결과 객체** — `addNode`/`moveNode`/`addEdge` 가 `OpResult{draft, error, notice}` 를 돌려주고, 변경된 노드에 붙은 선만 다시 계산(`rerouteEdges` — "바뀌지 않은 선은 움직이지 않는다")해 diff 가 작게 유지됨. 원본 키 순서 보존(`canonical*`)으로 커밋 diff 도 깨끗 | `lib/admin/draft.ts:170-206, 41-84` |
| G5 | **Zod 이슈 → 한국어 문장 변환을 한 곳에서** — 폼·전체 검사·가져오기가 `koIssue` 공유 | `lib/admin/integrity.ts:69-86` |
| G6 | **퀴즈 제거가 깔끔** — `QuizCard`·`ProgressCard`·`TourSummary`·`useLearnProgress` 파일과 learn.json 퀴즈 데이터가 함께 삭제, 스키마도 축소. 남은 흔적은 "왜 없는지" 주석과 회귀 방지 테스트(DI-75, E2E v0.6 R3) 뿐 | `pages/LearnPage.tsx:16`, `content/learnSchema.ts:7`, `tests/e2e/core-flows.spec.ts:209` |
| G7 | **데이터 원본 정책이 README 에 명시** — `src/data/*.json` 원본, Python 은 시드(재실행 시 덮어씀 경고) | `README.md:24-33` |

---

## 3. 개선할 부분

### 3.1 반드시 (1)

| # | 항목 | 위치 | 이유 | 제안 |
|---|---|---|---|---|
| M1 | **관리자 무결성 검사(integrity.ts)가 R3 화면·DI 기준과 어긋남** — 파일 머리말의 계약("DI 규칙 중 관리자 편집으로 깨질 수 있는 것을 **같은 기준**으로 확인")을 지키지 못함.<br>① **자동 모선 잔재**: R3 에서 화면의 자동 모선(3갈래 묶음)은 제거됐는데(`model.ts:250-252`), 검사는 여전히 그 그룹을 계산해 **관통 검사에서 면제**하고(`:275-276`), 화면에 없는 묶음 기준의 **허위 경고**를 냄(`:294-299`, `edgeGeometry withAutoBus` `:321-359`). 현재 데이터에서 면제되는 선 = `n-panel`→e053·e054·e055, `n-mcc`→e060·e064·e066 (6개) — 관리자가 노드를 이 선들의 경로에 놓아도 검사가 통과.<br>② **DI 와 규칙 차이**: DI-43c 택1 label **필수**·그룹 ≥2 ↔ 검사는 label 없음 **경고만**, 그룹 수 미검사(`:280`) / DI-40 모선 연결 **≥2** ↔ 검사 ≥1(`:301-306`) / DI-45a 전력선 **같은 선 위 겹침**도 실패 ↔ `powerCrossings` 는 겹침 제외(`:363-364`) / DI-46 모선 쪽 끝점이 모선 위·첫 선분 수직 ↔ 검사는 points 존재만(`:273`) | `src/lib/admin/integrity.ts:273-306, 316-400` | "검사 통과 → 내보내기 → 커밋" 한 JSON 이 `npm run test:data` 에서 실패할 수 있음 (관리자 모드가 이제 데이터 원본 경로). 화면에 없는 묶음 경고는 편집자를 오도 | ① `edgeGeometry` 의 자동 모선 그룹·`autoBus` 플래그·`withAutoBus` 인자와 294-299 경고 블록 삭제 → 모든 선을 `points ?? defaultRoute` 로 관통 판정 (DI-44 와 동일).<br>② DI-43c(오류로 승격 + 그룹 ≥2), DI-40(모선 ≥2), DI-45 겹침, DI-46 모선 끝 규칙 추가.<br>③ 재발 방지: 단위 테스트 "현재 `src/data` 로 `validateDraft` = 오류 0" + "DI 실패 케이스(라벨 없는 alt, 모선 1연결, 묶음 경로 위 타일) → 오류 발생" (권장 R2 와 함께) |

### 3.2 권장 (9)

| # | 항목 | 위치 | 이유 | 제안 |
|---|---|---|---|---|
| R1 | **연결선 기하 로직이 5벌** — Python `default_route`/`astar_route`, `router.ts`, `model.ts` 의 `route()`+`pyRound()` 사본(:142-171), `integrity.ts edgeGeometry`, DI 테스트의 `defaultRoute`(`data-integrity.test.ts:679`, **`Math.round` 사용 — 은행원 반올림 아님**, 중간점 .5 에서 1px 달라질 수 있음). "86/86 일치" 검증 스크립트는 저장소에 없어 재현 불가. R3 데이터 정정은 다시 Python 에서 이뤄짐(process.md) → 원본이 실질적으로 둘 | `lib/diagram/model.ts:142-171`, `lib/diagram/router.ts`, `scripts/build-diagram-data.py:460-585`, `tests/unit/data-integrity.test.ts:679-698` | 규칙을 한 곳 바꾸면 나머지가 조용히 갈림 (M1 이 실제로 그렇게 생김) | **TS router.ts 를 정본으로 선언.** ① `model.ts` 는 `boxOf`·`defaultRoute` 를 router 에서 import (route/pyRound 사본 삭제 — router 는 import 가 없을 뿐 다른 모듈이 import 하는 데 제약 없음). ② DI 테스트도 router 함수 사용. ③ **골든 테스트** 추가: "각 edge 에 `routeEdge(boxMapOf(nodes))` 결과 = 저장된 points(없으면 기본 경로)" — 현재 86/86 이라 바로 통과. ④ Python 은 동결: 파일 머리말에 "시드 전용·재실행 시 관리자 편집분 덮어씀" 경고 + 기존 diagram.json 이 있으면 `--force` 없이는 쓰지 않게 가드 |
| R2 | **관리자·라우터 테스트 0건** — router·draft·integrity 단위 테스트 없음, admin E2E 없음 (Tasklist 60번 미완). 관리자 모드가 데이터 원본을 쓰는 유일한 경로 | `tests/unit/lib/`, `tests/e2e/` | 회귀가 커밋된 데이터에서야 (DI 로) 드러남 | 단위: `routeEdge`(기본/우회/막힘/모선 범위 밖), `rerouteEdges`(안 바뀐 선 유지), `checkPlacement`(밴드·간격·모선 제외), `addSpecialNode`(참조 타일 원래 노드 필요), `validateDraft`(현재 데이터 0 오류 + M1 케이스). E2E 스모크: `/#/admin` 로드 → 자동 배치 → 연결 → 검사 OK → 내보내기 버튼 활성 (testid 는 Tasklist 60 에 이미 정의) |
| R3 | **자동 모선 죽은 코드(화면 쪽)** — `buses` 는 항상 `[]` 인데 타입·필드·렌더가 남음 | `lib/diagram/model.ts:73-76, 114-115, 250-252, 345`, `components/diagram/DiagramCanvas.tsx:52-56` (+ `.dedges__buses` CSS) | 읽는 사람이 "자동 모선이 아직 있다"고 오해 (M1 의 원인과 같은 뿌리) | `BusItem`·`buses`·렌더 블록·CSS 삭제, 주석은 "모선 = 데이터 kind:'bus'" 한 줄로 |
| R4 | **노드 크기 상수가 흩어짐** — `model.ts TILE_W/H·ENDPOINT_W/H`, `router.ts ROUTE_*`, `draft.ts:28-31` 재수출, **`AdminCanvas.tsx:283` 하드코딩 `60/22/120/44`**, 모선 선택 상자 `6/12`(:281), Python `EP_W/EP_H` | 해당 파일 | 끝점 크기 하나 바꾸면 4~5곳 수정, 관리자 선택 테두리만 어긋나기 쉬움 | router.ts(또는 `lib/diagram/geometry.ts`) 상수 하나를 model·draft·AdminCanvas·DiagramExtras 가 import. Python 은 R1 ④ 로 동결 |
| R5 | **(이전 R5 미처리·확대) 파생 계산 2벌 + 암묵 전역 캐시** — "모선 건너뛰고 너머 기기를 이웃으로" 규칙이 `model.ts neighbors`(:286-322)와 `catalog.ts neighborChain expand`(:112-115)에 각각 구현. `getDiagramModel(data = getData())` 단일 슬롯 캐시를 관리자 `buildModel`(`AdminPage.tsx:54-68`)이 초안 데이터로 덮어써 일반 화면 모델이 매번 재계산되고, 기본 인자를 쓰는 컴포넌트는 초안이 아닌 원본을 봄 | `lib/diagram/model.ts:198-200, 286-322`, `lib/pages/catalog.ts:30-64, 112-115`, `pages/admin/AdminPage.tsx:54` | 모선·끝점 규칙 변경 시 패널 칩과 미니 체인이 갈림. 관리자 미리보기에 패널을 붙이는 순간 원본/초안 혼선 | `neighborChain` 은 `model.neighbors` 를 재사용 (방향만 edge 로 판별). 관리자는 `computeDiagramModel(data)`(캐시 없는 순수 함수)을 쓰고 `getDiagramModel()` 은 원본 전용 캐시로 분리 |
| R6 | **(이전 R9 미처리) `DataValidationError` 가 `data/load.ts` 에 있음** — `learnSchema.ts:2`·`ErrorDetails.tsx:1` 이 오류 클래스 하나 때문에 데이터 로더(=JSON 6개 모듈)에 의존 | `data/load.ts:24-30` | 경계 역전, 교육·오류 화면 청크 분리 방해 | `lib/errors.ts` 로 이동, load.ts 는 재수출 (작업 10분) |
| R7 | **노드·연결선 종류 판정이 곳곳에** — `kind ?? 'equipment'` 판정이 `schema.ts:163`, `model.ts:206`, `draft.ts:87 nodeKind`, `router.ts:47 boxOf`, `catalog.ts:110 isBus`, DI 테스트 `kindOf` 에 각각. `e.kind ?? 'power'` 10곳. `EdgeKind` 타입 3벌(`model.ts:71`, `draft.ts:405`, `catalog.ts:98` 인라인). "기기 노드 = kind equipment && !ref" 조건도 integrity·draft·catalog 에 반복. 같은 집합 2벌: `ASSESSED_COVERAGES`(`schema.ts:91`) = `GAP_LIST_COVERAGES`(`labels.ts:75`). 공백 판정 정규화 2벌: `formToGap`(`EquipmentForm.tsx:101`) ≈ `canonicalGap`(`draft.ts:63`) | 해당 위치 | 다음 노드 종류(예: 개폐 상태 표시용 노드) 추가 시 빠뜨릴 곳이 많음 | `schema.ts` 에 `nodeKind(n)`, `isPrimaryEquipmentNode(n)`, `edgeKind(e)`, `type EdgeKind = NonNullable<DiagramEdge['kind']>` 를 두고 전부 사용. `GAP_LIST_COVERAGES = ASSESSED_COVERAGES` 로 정의(의미가 같음을 주석). `formToGap` 은 `canonicalGap` 호출로 축소 |
| R8 | **공백 표 CSV 에 확신도(후보/확정)가 없음** — 화면 목록은 후보/확정 배지를 보이는데(`GapPage.tsx:278-283`) 내보내는 CSV 는 상태·메모만. 공개판 유지 결정(D1 기각)으로 "후보" 표시의 중요도가 커진 상태 | `lib/pages/catalog.ts:184-197` | 배포용 CSV 에서 후보가 확정처럼 읽힘 | `확신도`(`CONFIDENCE_LABELS[gapConfidence(eq)]`)·`판정 근거` 열 추가, UT-01 갱신 |
| R9 | **model.ts 비대화 (377줄)** — 타입 정의·라우팅 사본·택1 배지·이웃·통계가 한 함수(`getDiagramModel` 약 150줄) | `lib/diagram/model.ts:200-356` | 리뷰·변경 단위가 큼 | R1(라우팅 제거)·R3(자동 모선 제거) 후 `buildNodes`/`buildEdges`/`buildNeighbors`/`buildStats` 로 쪼개기 — 동작 변경 없음 |

### 3.3 선택 (5)

| # | 항목 | 위치 | 제안 |
|---|---|---|---|
| O1 | 라벨 산재 잔여 — 패널 헤더 `'미보유 · 공백 확정/후보'` 하드코딩(`CONFIDENCE_LABELS` 있음), 공백 요약의 상태명 나열 하드코딩, `EVIDENCE_LABELS` 가 패널 로컬, 선 종류 라벨 3벌(`NeighborChips` `KIND_SUFFIX` / `GapSections` "신호로 연결·택1 연결" / `LayerNav` "택1 연결 (어느 하나)") | `panel/DetailPanel.tsx:22`, `panel/GapSections.tsx:30, 61`, `panel/GapAssessmentSection.tsx:11`, `panel/NeighborChips.tsx:4`, `layout/LayerNav.tsx:93` | `labels.ts` 에 `EDGE_KIND_LABELS`·`EVIDENCE_TYPE_LABELS` 추가, 패널 문구는 그 위에서 조합 (관리자 폼 근거 종류 select 도 같은 상수) |
| O2 | 퀴즈 제거 잔재 — `--color-progress`·`--color-on-progress` 토큰 미사용. 기존 사용자 브라우저에 `lse-learn-progress-v1` localStorage 가 남음 | `styles/tokens.css:188-189, 204-205` | 토큰 삭제. localStorage 는 `/learn` 진입 시 1회 `removeItem`(try/catch) — 해도 안 해도 무방 |
| O3 | 관리자 화면 파일 크기 — `AdminPage.tsx` 814줄(useState 20개), `EquipmentForm.tsx` 741줄, `AdminPage.css` 970줄 | `pages/admin/` | 도구 상태(`useAdminTools`)·가져오기/내보내기(`useImportExport`)·상단 바를 훅/컴포넌트로 분리. 사용자 적어 우선순위 낮음 |
| O4 | 파일 다운로드 헬퍼 2벌 | `lib/pages/catalog.ts:201` `downloadText` vs `pages/admin/AdminPage.tsx:71` `download` | 하나로 (`lib/download.ts`) |
| O5 | (이전 O1 유지) `useData = getData` 이름이 훅처럼 보임 | `data/load.ts:89` | `getData` 로 통일하거나 주석 |

---

## 4. 질문별 답 (리더 체크리스트)

| 질문 | 결론 |
|---|---|
| router.ts(TS) ↔ Python 중복 관리 | 지금은 결과 동일(86/86, 리뷰어 재확인)하지만 **검증이 저장소에 없고 사본이 5벌** → TS 를 정본으로, 골든 테스트로 고정, Python 동결 (R1) |
| model.ts 비대화 | 377줄. 라우팅 사본·자동 모선 잔재를 걷어내면 줄고, 함수 분리로 충분 (R1·R3·R9) |
| 관리자 모듈 경계 | `lib/admin`(순수 함수) ↔ `pages/admin`(UI) 경계는 좋음(G4). 문제는 **검사 기준이 DI·화면과 어긋난 것**(M1)과 전역 모델 캐시 공유(R5) |
| 노드 종류 분기 위치 | 스키마 계약은 한 곳(G2)이나 **판정 헬퍼가 6곳에 각자** (R7) |
| 라벨·색·아이콘 상수 일원화 | 커버리지·확신도·근거 라벨은 유지됨(G1). 선 종류·근거 종류·일부 패널 문구만 남음 (O1). 크기 상수는 흩어짐 (R4) |
| 죽은 코드 (퀴즈 잔재) | 퀴즈 쪽은 토큰 2개뿐(O2). **더 큰 잔재는 자동 모선** (M1 ①, R3) |
| 테스트 공백 | router·draft·integrity 단위 0, admin E2E 0 (R2). DI 쪽은 R3 규칙(DI-40/43c/44/45/46)이 잘 갖춰짐 |

## 5. 결론 · (개선 R4) 범위 제안
- **반드시 1건(M1)이 있어 지금 상태로 "최종 완료"는 권하지 않음.** 다만 범위가 좁음 — integrity.ts 자동 모선 블록 삭제 + DI 규칙 4개 이식 + 테스트 2~3개 (반나절 이내).
- **R4 필수 묶음**: M1 + R3(같은 뿌리의 화면 쪽 잔재 삭제) + R2 중 `validateDraft` 테스트.
- **R4 권장 1순위 (작고 위험 낮음)**: R1 ③ 골든 테스트(바로 통과) + R1 ① model.ts 가 router import, R6(10분), R8(CSV 확신도 열 — 공개 화면과 일치).
- 나머지(R4·R5·R7·R9, 선택 전부)는 다음 기능 추가 때 같이 정리해도 됨.
- 테스트 영향: M1·R3 은 화면 동작 변화 없음(검사 결과만 엄격해짐 — 현재 데이터는 DI 를 통과하므로 새 오류 0 예상). R8 은 CSV 열 추가 → UT-01 갱신 필요.
