# (개선 R4) 최종 리뷰 — 품질 + 디버그 재점검

> 리뷰어: Teammate 3 (최종 리뷰어 겸 디버거) · 2026-11-18 · 대상 `99efc32` (공용 검사 모듈·router 단일화·자동 모선 제거·관리자 모선 연결 수정) + `4820f5a` (테스트 전환)
> 참고: `docs/reviews/r3-code-review.md` (반드시 M1, 권장 R1~R9), `docs/reviews/r3-debug-report.md` (높음 H1·H2, 중간 M1~M5), `process.md` R4 기록
> 우선순위: **반드시** = 완료 전에 꼭 고칠 것 (계약 위반·실제 결함) · **권장** = 다음 라운드에 넣으면 좋음 · **선택** = 여유 있을 때
> 요약: **반드시 0 · 권장 2 · 선택 6** → **최종 완료 가능**

---

## 0. 실행 결과

| 항목 | 결과 |
|---|---|
| `npm run build` (tsc + vite) | 통과 |
| `npm run typecheck:tests` | 통과 |
| `vitest run` | **260/260 통과** (10 파일) |
| `playwright test` | **46 통과 · 1 skip · 0 실패** (7.4s) — 일반 화면 회귀 없음, 관리자 E2E 4건 포함 |
| 독립 하네스 (스크래치, 저장소 밖) | 관리자 순수 함수(`draft.ts`)로 T2 R3 시나리오를 다시 돌리고 `validateDraft` 결과 기록 — 아래 1장. 테스트 코드는 쓰지 않고 직접 작성 |
| 라우터 골든 (독립 재계산) | `routeEdge(boxMapOf(nodes))` = 저장된 points **86/86** |
| 순환 import | `src/` 전체 상대 import 그래프(런타임 import만) 탐색 → **순환 없음** |

---

## 1. R3 지적 사항이 실제로 해소됐는지

### 1.1 R3 리뷰 반드시 M1 — **해소**

| 항목 | 확인 방법 | 결과 |
|---|---|---|
| ① 자동 모선 잔재 (관통 면제·허위 경고) | `grep autoBus\|withAutoBus\|buses\|BusItem src` → 0건. 현재 데이터 `validateDraft` | **오류 0 · 경고 0** (R3: 경고 2건이 화면에 없는 묶음 기준 허위 경고였음) |
| | s13 손편집 (MCC 열 x=682 아래 참조 타일, 재계산 없음) | DI-44a **4건 (e060·e064·e066·e069)** — R3 에선 e069 1건만 (나머지는 자동 모선 그룹이라 면제). DI 테스트와 같은 결과 |
| ② DI 규칙 차이 | 관리자 검사가 `checkDataset`(= DI 테스트가 쓰는 함수) 하나로 바뀜 — `src/lib/admin/integrity.ts:38-48` | 규칙 차이 자체가 구조적으로 없어짐. 아래 1.2 시나리오 전부 규칙 ID 까지 DI 와 같음 |
| ③ 재발 방지 테스트 | `tests/unit/lib/admin-draft.test.ts:64` (현재 데이터 오류 0·경고 0), `tests/unit/lib/integrity.test.ts` (T2 실패 시나리오 → 규칙 ID) | 있음 |

### 1.2 T2 R3 높음·중간 — 전부 **해소** (직접 재현)

| R3 항목 | 재현 (하네스) | R3 결과 | R4 결과 |
|---|---|---|---|
| **H1** 모선 끝 가로 출발 | s01 `moveNode(n-mccb → x=100)` | 검사 0 · DI-46 실패 | **편집 거부** "e041 … 모선 범위 밖 — 모선을 늘리거나 기기를 옮기세요" |
| | s02 `moveNode(bus-380, +300)` | 검사 0 · DI-46 실패 | **거부** (e041·e042 범위 밖) |
| | s12 `updateNode(bus-380, width 61)` | 검사 0 · DI-46 실패 | **거부** |
| | UI4: 새 L6 기기 자동 배치 → 380V 모선 연결 | 모선 위 397px 가로 경로 | 경로 `[(1050,3204)→(1050,3178)]` **수직**, 검사 오류 0 |
| **H2** 모선 겹침 없음 | 모선 L7 길이 300 자동 배치 | (870,3890) MC/MS·EMPR 위 | (850,3980) — 겹침 없음, 오류는 연결 전 DI-40 뿐 |
| | 모선 L5 자동 배치 | 몰드변압기 가로지름 | (1060,2950) — 겹침 없음 |
| | 모선을 MC/MS 위(870,3890)에 직접 배치 | 허용 | **거부** "MC/MS 와 너무 가깝습니다 (최소 간격 20px)" |
| **M1** 검사 ↔ DI 차이 9종 | s04a 모선 연결 1개 / s04b 라벨 없는 참조 타일 / s04c·d 택1 단독·무라벨 / s05 sourced+unknown·없는 날짜·http 근거 / s13b MON 참조 타일 연결 0 | 통과 또는 경고 | **DI-40 / DI-43 / DI-43c / DI-27b·27e·27f / DI-40** 오류 — 내보내기 차단 |
| | s14 전력선 같은 선 겹침 | 통과 | `segsCross` 가 같은 방향 겹침 판정 (`src/lib/integrity/diagram.ts:88-89`), 합성 테스트 `integrity.test.ts` DI-45a 통과 |
| **M2** 자동 모선 잔재 | 위 1.1 ① | 경고 2 · 관통 1건만 | 경고 0 · 관통 4건 |
| **M3** 자동 배치가 연결선 위 | L6 끝점 자동 배치 | (700,3430) e064 위 → 오류 10건 | (850,3430) — 오류는 연결 전 DI-40 뿐 (새 교차 0) |
| **M4** review 갱신 안 됨 | `moveNode` 후 `syncReview` / approved 원본에서 편집 / 되돌림 | 갱신 없음 | pending + changedAt 오늘 + 안내 문구 / approved → pending / 되돌리면 원본 review 복원. 사진만 바꾸면 그대로 |
| **M5** 참조 타일 패널 계층 | E2E `core-flows.spec.ts:775` (detail-meta = "참조 타일", 원래 위치 표시) | L5 표시 | 통과 |

### 1.3 R3 리뷰 권장 R1~R9

| # | 상태 | 근거 |
|---|---|---|
| R1 경로 계산 5벌 | ✅ | `model.ts:5`·`integrity/diagram.ts:19`·DI 테스트 모두 `router.ts` import. 골든 테스트 `tests/unit/lib/router.test.ts:24`. Python 은 `--force` 가드로 동결(1114bc5) |
| R2 관리자·라우터 테스트 0 | ✅ | UT-10 공용 검사 79 · UT-11 라우터 12 · UT-12 관리자 초안 16 · E2E-ADM 4 |
| R3 자동 모선 죽은 코드 | ✅ | 0건 |
| R4 크기 상수 산재 | ✅ | `lib/diagram/geometry.ts:9-27` 하나. `AdminCanvas` 하드코딩 없음 |
| R5 파생 계산 2벌·전역 캐시 | ✅ | `lib/diagram/topology.ts` 공용(`hopsAcrossBus`·`busRelation`), 관리자 `computeDiagramModel`(캐시 없음, `AdminPage.tsx:65`) |
| R6 DataValidationError | ✅ | `lib/errors.ts` (1114bc5) |
| R7 종류 판정 산재 | ✅ 대부분 | `geometry.ts:37-54` 단일. 남은 곳 `schema.ts:163` 하나 (선택 O4) |
| R8 CSV 확신도 | ✅ | `catalog.ts:189` "판정" 열 (판정 근거 열은 넣지 않음 — 화면과 같은 수준이라 충분) |
| R9 model.ts 비대 | ✅ | `buildNodes` 등으로 분리, 363줄 |

선택 O2(퀴즈 토큰·옛 localStorage 키 정리)도 처리됨 (`LearnPage.tsx:12`). O1(라벨 잔여)·O3(관리자 파일 크기)·O4(다운로드 헬퍼 2벌)·O5(`useData` 별칭)는 남음 → 아래 O6.

---

## 2. R4로 새로 생긴 위험 점검

### 2.1 성능 — 문제 없음 (측정)
관리자 검사(`validateDraft` → `checkDataset`)는 **편집마다 돌지 않고** "검사"·"내보내기" 버튼에서만 실행됨 (`AdminPage.tsx:310-314, 326`). 편집마다 도는 것은 경로 재계산·`syncReview`·모델 재구성. 모두 Node(vitest) 에서 30회 평균으로 측정:

| 연산 | 시점 | 평균 |
|---|---|---|
| `checkDataset` (현재 데이터: 노드 83 · 연결선 86 · 기기 74 · 제품/카테고리·사진 포함) | 버튼 | **2.6 ms** (계통도 규칙 몫 ≈ 1.7 ms) |
| `checkDataset` 계통도 2배 규모 (노드 166) | — | 5.7 ms (DI-39·45 의 O(n²) 를 감안해도 여유 큼) |
| `moveNode` (`rerouteEdges` 포함) | 편집마다 | 0.4 ms |
| `syncReview` (JSON 3회 비교) | 커밋마다 | 0.12 ms |
| `computeDiagramModel` | 편집마다 (`useMemo`) | 0.3 ms |
| `findFreeSpot` L6 | 자동 배치 클릭 | 10 ms |

→ 편집마다 `checkDataset` 를 돌려도 수 ms 라 실시간 검사로 바꿀 여지도 있음. 지금 구조(버튼 실행)도 문제 없음.

### 2.2 순환 import — 없음
의존 방향: `schema` ← `geometry`(타입만) ← `router` ← `model`·`integrity/diagram`·`admin/draft`, `integrity` ← `admin/*`. 화면 쪽(`components`·`pages` 중 admin 제외)은 `lib/integrity` 를 import 하지 않음.

### 2.3 integrity 모듈 ↔ 화면 모델 경계 — 좋음
- 두 쪽이 같은 `router.defaultRoute`·`geometry.halfSize` 를 써서 "화면에 그려지는 선 = 검사하는 선" 이 보장됨 (`integrity/diagram.ts:53-59` ↔ `model.ts:231`).
- 모선 연결에 points 가 없을 때 화면은 중심끼리 선으로 그리고(`model.ts:230-235`), 검사는 DI-46 으로 막음 — 역할이 분명.
- `integrity` 는 순수 함수·React 없음, `labels.todayIso` 하나만 화면 쪽 모듈에서 가져옴 (작은 결합, 문제 없음).

### 2.4 테스트 "자기 확인" 위험 — 대체로 독립적, 빈틈 일부 (권장 R2)
- **독립적인 점**: `tests/unit/lib/integrity.test.ts` 는 손으로 만든 작은 합성 데이터(오류 0)를 규칙마다 한 군데씩 망가뜨리고 **규칙 ID** 만 기대함 — 구현 로직을 따라 쓰지 않음. 기준 데이터 오류 0(`:107`)·시나리오는 `toEqual` 로 다른 규칙 오탐도 잡음. RULES 표 ↔ 실제 보고 등급 일치 검사(`:417-429`)도 좋음.
- **위험**: DI 테스트(`data-integrity.test.ts`)는 이제 `checkDataset` 결과를 꺼내 볼 뿐이라, 공용 모듈의 **한 분기**가 조용히 안 돌면 관리자 검사와 DI 가 **같이** 통과함. 이를 막는 건 위 합성 테스트뿐인데, 규칙당 1개 위반이라 여러 분기가 있는 규칙의 다른 분기가 비어 있음 (아래 R2).
- 라우터 골든 테스트는 지금은 Python 결과와의 대조지만, 관리자가 편집한 데이터가 커밋되면 "router 가 만든 points = router 재계산" 이 되어 **회귀 감지용**(라우터 변경 탐지)으로 성격이 바뀜. 정확성은 DI-44·45·46 이 맡는다는 점을 테스트 주석에 적어 두면 좋음 (선택 O5).

### 2.5 남은 죽은 코드 — 거의 없음
자동 모선 관련 0건. 쓰이지 않는 export 만 조금 (선택 O3).

---

## 3. 일반 사용자 화면 회귀 · 번들

| 청크 | R3 (`45fbc56`, 같은 환경에서 재빌드) | R4 | 차이 |
|---|---|---|---|
| `index` (첫 화면) | 219.95 kB (gzip 73.10) | 224.73 kB (gzip 74.97) | **+4.8 kB (gzip +1.9)** |
| 공유(`jsx-runtime`: React·zod·데이터 JSON) | 467.63 kB | 468.52 kB | +0.9 |
| `AdminPage` | 86.15 kB | 97.12 kB | +11 (공용 검사 모듈) |
| Gap/Learn/Product/Equipment | 거의 같음 | | |

- **integrity 모듈은 메인 번들에 없음** — `Collector`·`DI-44a`·"택1 그룹" 문자열은 `AdminPage` 청크에만 있음. 관리자 코드가 메인에 섞이지 않음. 필요성 판단: 일반 화면은 검사를 쓰지 않으므로 지금처럼 관리자 청크에만 두는 게 맞음.
- **대신 router 의 A\*(`astarRoute`·`routeEdge`)가 메인으로 들어옴** (`index` 에 `bus-blocked` 문자열 확인, R3 빌드엔 없음). 화면 모델은 `boxOf`·`defaultRoute` 만 쓰지만 Rollup 은 모듈 단위로 청크를 나누므로, `router.ts` 를 화면(model)과 관리자(draft)가 같이 import 하면서 모듈 전체가 공유 청크로 감. 영향은 gzip 1.9 kB 로 작음 → 선택 O1.
- E2E 46 통과로 일반 화면(계통도·패널·공백 표·교육·검색) 회귀 없음.

---

## 4. 품질 판정

### 4.1 좋은 점

| # | 항목 | 근거 |
|---|---|---|
| G1 | **검사 규칙 단일 출처가 실제로 완성됨** — 관리자 검사·기기 폼·DI 테스트가 같은 `checkDataset`/`checkEquipment`. R3 의 "검사 통과 → CI 실패" 9종이 구조적으로 사라짐 (규칙 ID 까지 같음) | `src/lib/integrity/index.ts:123-159`, `src/lib/admin/integrity.ts:38-58`, `EquipmentForm.tsx:203` |
| G2 | **RULES 표가 계약 역할** — 규칙 ID·HARD/SOFT 를 한 표로, DI 테스트는 표를 돌며 it 생성, v0.6 규칙 ID 누락 방지 테스트, 보고 등급 ↔ 표 일치 테스트 | `integrity/index.ts:48-109`, `data-integrity.test.ts:136-160`, `integrity.test.ts:417` |
| G3 | **`Collector.run` 으로 규칙 격리** — 깨진 데이터(가져오기)에서 규칙 하나가 예외를 내도 나머지 규칙은 계속 돌고, 예외는 그 규칙 ID 오류로 보고 | `integrity/types.ts:44-50` |
| G4 | **모선 연결 규칙을 "거부"로 단순화** — 범위 밖·수직 막힘이면 A* 로 억지 경로를 만들지 않고 편집 자체를 거부하며 이유(막는 노드 이름 포함)를 알려 줌. R3 의 H1 5가지 재현이 모두 거부로 바뀜 | `draft.ts:225-250`, `router.ts:329-349` |
| G5 | **경로·크기·종류 판정이 각각 한 파일** — `router.ts`(경로), `geometry.ts`(크기·종류, 런타임 의존 0), `topology.ts`(모선 건너뛰기) | `lib/diagram/` |
| G6 | **자동 배치가 기존 선을 피함** — 후보 자리의 상자+라우터 여유가 기존 경로 선분과 닿으면 제외 → 배치 때문에 주변 선이 다시 계산되며 교차가 생기는 일(M3) 없음 | `draft.ts:477-506` |
| G7 | **검수 상태 자동 갱신이 되돌리기와 맞물림** — 원본과 같아지면 원본 review(approved 포함) 복원, 사진만 바꾸면 그대로, 키 순서 유지 | `draft.ts:515-527`, `store.ts:70-80` |
| G8 | **테스트가 시나리오 이름 그대로** — T2 리포트의 실패 시나리오가 테스트 이름·주석에 그대로 있어 추적 쉬움 | `integrity.test.ts:5-8, 134-246` |

### 4.2 개선할 부분

#### 반드시 (0)
없음.

#### 권장 (2)

| # | 항목 | 위치 | 이유 | 제안 |
|---|---|---|---|---|
| R1 | **관리자 편집 시 기존 review 안내 문구를 덮어씀** — 원본이 이미 `pending` 이고 note 에 "무엇을 검수해야 하는지"(현재: "계통 연결 정정(변압기 2곳 추가, 22.9kV·380V 모선, 택1 연결, 참조 타일, 비상 부하) — … 설계팀 검수 대기")가 있어도, 첫 편집에서 `"관리자 편집 — 설계팀 재검수 필요"` 로 바뀜 (하네스로 확인). 또 `topologyChanged` 가 기기 정보(설명 한 글자)까지 포함해, 계통과 무관한 기기 문구 수정도 계통 검수를 대기로 돌림 (함수 이름과 범위가 다름) | `src/lib/admin/draft.ts:515-516, 522-527` | 설계팀이 보는 검수 대기 사유가 사라짐 (git 이력에만 남음). 기기 설명 수정 때마다 계통 재검수 요청이 나가면 검수 신호가 흐려짐 | 원본이 pending 이면 note 를 `${원본 note} / 관리자 편집 ${today}` 처럼 이어 붙이기. 비교 범위는 `nodes`·`edges`(+ 기기의 `layer` 처럼 배치에 영향 주는 필드)로 좁히고 함수 이름을 그 범위에 맞추기 — 기기 정보만 바뀐 경우를 의도적으로 포함하려면 주석·이름에 명시. UT-12 `syncReview` 테스트 1~2개 갱신 |
| R2 | **공용 검사의 분기 일부가 합성 위반 테스트로 검증되지 않음** — DI 테스트가 공용 모듈 결과를 그대로 쓰므로, 이 분기들이 조용히 안 돌면 관리자 검사와 CI 가 같이 통과함. 빈 분기: DI-35 기기 타일이 밴드 밖(모선 width 경우만 있음, `integrity/diagram.ts:176-178`), DI-39 중심 거리 < 24 (`:214`), DI-40 끝점·참조 타일 연결 0 (`:225-226` — 하네스로 동작은 확인), DI-43 기기 노드 2개 (`:272`), DI-44a 모선을 지나가는 선 (`segHitsNode` 모선 여유 분기 `:65-67`), DI-44b 끝 점이 가장자리 밖 (`:321-322`). 또 "모든 HARD 규칙 검증됨" 메타 테스트의 시나리오 ID 목록이 손으로 적은 값이라 시나리오를 지워도 통과함 | `tests/unit/lib/integrity.test.ts:338, 380` | R4 이후로는 이 합성 테스트가 공용 검사를 지키는 **유일한 독립 장치**. R3 M1 이 "같은 기준이라고 적어 놓고 실제론 달랐던" 문제였던 만큼, 분기 단위로 고정해 두는 비용(한 줄짜리 케이스 6개)이 작음 | 위 6개 분기를 `cases` 표에 한 줄씩 추가 (예: `['DI-40 ep', f => 끝점 추가]`). 메타 테스트는 손 목록 대신 `seen` 에 모인 결과에서 실제로 보고된 규칙 ID 집합을 계산해 RULES 와 비교 |

#### 선택 (6)

| # | 항목 | 위치 | 제안 |
|---|---|---|---|
| O1 | router 의 A\*·`routeEdge` 가 메인 번들로 들어옴 (+4.8 kB, gzip +1.9 kB). 화면은 `boxOf`·`defaultRoute` 만 씀 | `src/lib/diagram/router.ts:195-349`, `model.ts:5` | `router.ts` 를 기본 경로(`boxOf`·`defaultRoute`·`pyRound`·`pathHits`)와 `astar.ts`(`astarRoute`·`routeEdge`)로 나누면 A\* 는 관리자 청크로 감. 크기가 작아 급하지 않음 |
| O2 | 자동 배치가 L6 새 기기를 380V 모선 **위쪽**(1050,3120)에 놓음 → 모선에서 위로 올라가는 연결선이 생겨 전원 쪽(2차 주차단기 참조 타일 자리)처럼 보임. 연결 방향 판정(`busRelation`)은 edge 방향 기준이라 패널 표시는 맞음 — 그림만 어색 | `src/lib/admin/draft.ts:477-506` | 같은 밴드에 모선이 있으면 모선 아래쪽 후보를 먼저 보거나, 후보 정렬을 "밴드 가운데" 대신 "모선 아래 가운데" 기준으로 |
| O3 | 쓰이지 않는 export — `fieldLabel`(어디서도 안 씀), `index.ts` 재수출 `linkCount`·`linkedProductIds`·`productsUnderCategory`·`KNOWN_ISOLATED_SYSTEM_NODES`·`nodeLayerOf`·`edgePath` (모듈 밖 사용 0) | `src/lib/integrity/types.ts:137`, `src/lib/integrity/index.ts:32-33` | 삭제하거나 공개 API 로 둘 거면 그대로 (해 없음) |
| O4 | 종류 판정 마지막 1곳 `n.kind ?? 'equipment'` | `src/lib/schema.ts:163` | `dataKindOf` 사용 (geometry 는 schema 를 타입만 import 해서 순환 없음) |
| O5 | 라우터 골든 테스트의 성격이 관리자 편집 커밋 후 "회귀 감지"로 바뀜 | `tests/unit/lib/router.test.ts:21-35` | 주석에 "정확성 = DI-44·45·46, 골든 = 라우터 변경 감지" 한 줄 |
| O6 | R3 선택 잔여 — 다운로드 헬퍼 2벌, `useData` 별칭, 선 종류·공백 패널 문구 하드코딩, `AdminPage.tsx` 814줄 | `lib/pages/catalog.ts:206` · `pages/admin/AdminPage.tsx:74` / `data/load.ts` / `panel/NeighborChips.tsx:4`·`panel/DetailPanel.tsx:22` / `pages/admin/AdminPage.tsx` | 다음 기능 추가 때 같이 |

---

## 5. 결론
- R3 반드시 M1과 T2 R3 높음 2·중간 5가 **모두 해소됨**. 코드 확인과 독립 하네스 재현으로 검증했고, 규칙 ID 까지 DI 와 같음.
- R4 로 새로 생긴 위험 — 성능(검사 2.6 ms, 버튼에서만 실행), 순환 import(없음), 경계(화면은 integrity 를 import 하지 않음, 경로·크기는 같은 함수 사용) — 은 문제 없음. 번들은 integrity 가 관리자 청크에만 있고, 메인 증가는 router A\* 1.9 kB(gzip) 뿐.
- **반드시 0건 → 최종 완료 가능.** 권장 2건(review 문구 보존·비교 범위, 합성 테스트 분기 보강)은 작고 화면 동작에 영향이 없어 다음 라운드나 유지보수 때 넣어도 됨.
