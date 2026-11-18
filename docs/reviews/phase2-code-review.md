# Phase 2~5 코드 리뷰 — 품질 관점 (가독성·유지보수성·확장성)

> 리뷰어: Teammate 3 · 2026-11-18 · 대상 커밋 `1ce6811` (src/ 전체, 약 4,900줄 TS/TSX + CSS)
> 관점: 버그 사냥이 아니라 **R2 개선 라운드 범위 결정용**. 기능 회귀는 `docs/test-plan.md` §11 (vitest 114 통과 · E2E 28/30) 참고.
> 우선순위: **반드시** = R2 에 꼭 포함 (사용자에게 보이는 불일치·계약 위반·작은 실제 버그) · **권장** = R2 에 넣으면 좋음 (중복·경계 정리) · **선택** = 여유 있을 때
> 요약: **반드시 6 · 권장 10 · 선택 9**

---

## 1. 좋은 점

| # | 항목 | 근거 (파일:라인) |
|---|---|---|
| G1 | **데이터 계층 경계가 깨끗함** — `src/data/*.json` 을 import 하는 곳은 `data/load.ts` 하나뿐 (교육 콘텐츠 `content/learnSchema.ts` 는 의도된 별도 계약). 렌더 중 Zod 검증 → `DataValidationError` → 한국어 오류 화면 | `data/load.ts:16-21, 64-87`, `components/common/RootErrorBoundary.tsx` |
| G2 | **디자인 토큰 준수가 거의 완벽** — 컴포넌트 CSS 전체에서 하드코딩 색은 그림자 1곳뿐, 나머지는 `var(--…)`. 다크 모드 토큰 별도 정의, axe 대비 라이트/다크 0건 | `styles/tokens.css`, 예외 `panel/DetailPanel.css:356` |
| G3 | **URL 이 상태의 원본** (`?node=`, `?mode=`, `/learn?step=`) — 훅으로 캡슐화, `replace` 히스토리로 뒤로가기 오염 없음. 공유·새로고침 복원이 자연스럽게 보장됨 | `lib/diagram/url.ts:10-61` |
| G4 | **줌/패닝 성능 구조** — `PanZoom` 엔진이 React 밖(리스너 cleanup 목록), 뷰 상태는 `useSyncExternalStore` 미니 스토어, 노드는 `memo` → 줌 중 74노드 재렌더 없음. IntersectionObserver 사진 지연 로딩 + 미지원 폴백 | `lib/diagram/panzoom.ts:55-86`, `lib/diagram/view.ts`, `diagram/DiagramCanvas.tsx:156-179` |
| G5 | **외부 링크 단일 정책** — `ExternalLink` 하나로 새 탭·`noopener noreferrer`·https 외 차단·"새 탭" 안내 | `common/ExternalLink.tsx` |
| G6 | **접근성 기본기가 탄탄함** — 노드 `role=button`·`aria-pressed`·`aria-label="{이름}, {상태}"`, Esc 닫기 후 노드로 포커스 복귀, 검색 combobox ARIA(`aria-activedescendant`), HashRouter 에서 건너뛰기 링크 처리, 색+아이콘+텍스트 3중 표시, `prefers-reduced-motion` 존중, 표 `scope`, `aria-live` | `diagram/DiagramNode.tsx:31-49`, `panel/DetailPanel.tsx:194-214`, `layout/SearchBox.tsx:115-135`, `layout/AppLayout.tsx:38-43`, `pages/GapPage.tsx:79` |
| G7 | **순수 함수로 분리된 계산** — `buildMatrix`·`countCoverage`·`ownedRate`·`buildGapCsv`·`neighborChain` 이 컴포넌트 밖에 있어 단위 테스트가 쉬움 (UT-01 로 CSV 검증) | `lib/pages/catalog.ts:164-222` |
| G8 | **방어적 저장소 처리** — localStorage 읽기/쓰기 try/catch + 값 검증, 실패해도 화면 동작 | `pages/LearnPage.tsx:25-46` |
| G9 | **"왜"를 설명하는 한국어 주석** — 결정 근거(R-xx, 디자인 승인안)가 코드 옆에 있어 인수인계가 쉬움 | 전반 |

---

## 2. 개선할 부분

### 2.1 반드시 (6)

| # | 항목 | 위치 | 이유 | 제안 |
|---|---|---|---|---|
| M1 | **단선결선도 심볼이 두 벌** — 같은 기기가 계통도·상세 패널(`EquipmentSymbol`, path 문자열, 기기별 override 3종, 선 2.5)과 기기·제품·교육 페이지(`EquipmentVisual` 안의 `EquipmentSymbol`, JSX, 다른 그림, 선 3)에서 **다른 모양**으로 보임. 이름까지 같아 import 실수 위험 | `diagram/EquipmentSymbol.tsx:5-36` vs `pages/EquipmentVisual.tsx:24-129` | 사용자에게 보이는 불일치 + 심볼 추가 시 두 곳 수정 | `diagram/EquipmentSymbol` 하나로 통일, `EquipmentVisual` 은 사진/심볼 선택만 담당. `DetailPanel` 의 `Hero`(29-51)도 `EquipmentVisual` 재사용 |
| M2 | **기능 분류 라벨이 두 벌이고 값이 다름** — 상세 패널은 `변압·변성 / 발전·저장 / 설비 시스템`, 기기 페이지·공백 표·CSV 는 `변성 / 발전 / 시스템` | `lib/diagram/model.ts:19-30` vs `lib/pages/catalog.ts:18-29` | 같은 기기의 분류명이 화면마다 다름. 공백 표 열 이름과 패널이 불일치 | `lib/schema.ts` 에 `CATEGORY_LABELS` 하나 (디자인 승인안 표기로 결정), 두 곳 삭제 |
| M3 | **`resolveProducts` 가 리더 결정 R-01 과 다르게 동작** — 주석은 "카테고리 제품(하위 포함)"인데 구현은 **직속 productIds 만**. DI 테스트(DI-20/26)는 하위 포함으로 판정 → 상위 코드(예: `AAA009`)를 쓰는 순간 DI 는 통과하고 화면은 "제품 0개"가 됨. 현재 데이터는 차이 0건이라 잠복 상태 | `data/load.ts:104-111` | 계약 위반(잠복). Gap 신뢰성(P0) 영역 | 하위 카테고리 재귀 포함으로 구현 (parentCode 인덱스 1회 계산, 순환 방어). 또는 결정을 "직속만"으로 바꾸고 DI 도 맞춤 — 어느 쪽이든 한 규칙으로 |
| M4 | **죽은 코드 `EquipmentInfo`** (컴포넌트 99줄 + CSS 43줄) — 어디서도 import 안 함. 빈 상태 문구·자료 표시 규칙("연결 제품 ≤5")이 실제 화면과 달라 E2E 헬퍼가 이 규칙을 잘못 따라가고 있었음(v0.4 에서 테스트 수정) | `components/common/EquipmentInfo.tsx`, `EquipmentInfo.css` | 읽는 사람이 "공용 컴포넌트"로 오해, 규칙 출처 혼선 | 삭제 (또는 M5 의 공용 빈 상태로 흡수 후 삭제) |
| M5 | **교육 콘텐츠 오류 시 파일 경로가 틀리게 표시** — `DataValidationError('../content/learn.json')` 를 오류 화면이 `src/data/{file}` 로 출력 → "src/data/../content/learn.json" | `content/learnSchema.ts:60`, `common/RootErrorBoundary.tsx:32` | 데이터 담당자가 고칠 파일을 잘못 안내 (작은 실제 버그) | `DataValidationError` 가 `src/` 기준 전체 경로를 받도록(`'src/content/learn.json'`) 하고 화면은 그대로 출력 |
| M6 | **공백 표 기본 필터 = "미보유"** — 승인 디자인·리더 결정은 "전체". E2E FT-26 이 현재 실패 중 | `pages/GapPage.tsx:50-51, 78, 86` | 디자인 불일치 (T1 이 변경 예정) | 세 곳 `'missing'` → `'all'`, 주석 갱신. "전체" 버튼에 `data-testid="gap-filter-all"` 추가 |

### 2.2 권장 (10)

| # | 항목 | 위치 | 이유 | 제안 |
|---|---|---|---|---|
| R1 | **커버리지 배지 마크업이 6곳에 직접 구현** — `CoverageBadge`, 패널 `CoveragePill`, 범례, 노드 배지, 공백 표 `cov-chip`, 교육 공백 칩. `coverage-icon-*` testid·아이콘·aria 처리가 곳곳에 복붙 | `common/CoverageBadge.tsx`, `panel/DetailPanel.tsx:15-27`, `layout/CoverageLegend.tsx:45-49`, `diagram/DiagramNode.tsx:68-72`, `pages/GapPage.tsx:189-194, 273-275`, `pages/LearnPage.tsx:292-310` | 회귀 안전망 §6.5("색+아이콘+텍스트")를 한 곳에서 보장 못 함 | `CoverageBadge` 에 `variant: 'badge' \| 'pill' \| 'chip' \| 'icon'` + `label` override. 아이콘만 쓰는 곳은 `<CoverageIcon>` |
| R2 | **커버리지 라벨 변형 4종** — `COVERAGE_LABELS`, 공백 표 `SHORT_LABELS`·`FILTER_LABELS`, 패널 `"미보유 · 공백 후보"`, 범례 `GAP_RULE` | `lib/schema.ts:182`, `pages/GapPage.tsx:31-39`, `panel/DetailPanel.tsx:16-18`, `layout/CoverageLegend.tsx:7-13` | 문구 변경 시 누락 | `schema.ts` 에 `COVERAGE_SHORT_LABELS` 추가, 화면별 문구는 그 위에서 조합 |
| R3 | **"공백" 정의가 이름만 비슷한 3가지** — 강조 대상 `isGapCoverage`(missing·partial), 공백 표 목록 `GAP_COVERAGES`(+affiliate), 기기 페이지 인라인 `isGap` | `lib/diagram/model.ts:92-93`, `lib/pages/catalog.ts:180`, `pages/EquipmentPage.tsx:31` | R-08 결정을 코드에서 찾기 어렵고, 누가 바꾸면 화면마다 갈림 | 한 모듈(`lib/coverage.ts`)에 `EMPHASIZED_COVERAGES`, `GAP_LIST_COVERAGES` 처럼 의도가 드러나는 이름으로. 계획서 §6.3 "커버리지 판정 단일 출처" 와 일치 |
| R4 | **"제품 0개" 빈 상태 분기가 3중** (+ 문구 불일치: na = "해당 없음 — 자사 공급 대상이 아닌 기기입니다" vs "자사 사업 범위 밖입니다 (해당 없음)") | `panel/DetailPanel.tsx:58-84`, `pages/EquipmentPage.tsx:122-146`, `common/EquipmentInfo.tsx:73-95` | 규칙 변경(예: 카테고리 링크 정책) 시 세 곳 수정 | `<EmptyProducts eq testIdPrefix>` 공용 컴포넌트 (CT-04 가 이미 계약을 고정) |
| R5 | **파생 데이터 캐시가 두 곳** — `model.ts`(nodeById·이웃·통계)와 `catalog.ts`(nodeByEquipmentId·productsByEquipmentId). 패널은 메모 안 된 `resolveProducts` 를 직접 호출. 통계도 범례는 **노드 수**, 공백 표는 **기기 종류 수**로 셈 (지금은 74=74 라 같음) | `lib/diagram/model.ts:122-231`, `lib/pages/catalog.ts:63-117`, `panel/DetailPanel.tsx:127, 233` | 한 기기를 노드 2개로 그리는 순간 통계가 갈림 | `data/derived.ts` 하나로 (getData 결과 키로 메모), 통계 기준을 "기기 종류"로 명시 |
| R6 | **큰 파일 분리** — `LearnPage.tsx` 501줄(페이지 + Lesson·QuizCard·ProgressCard·Overview·진도 저장), `DetailPanel.tsx` 352줄(+ CoveragePill·Hero·EmptyProducts·NeighborChips·GapSections) | 해당 파일 | 리뷰·충돌·테스트 단위가 큼 | `pages/learn/` 폴더(컴포넌트별 파일 + `useLearnProgress` 훅), `panel/` 하위 파일로 분리. 동작 변경 없음 |
| R7 | **오류 경계가 최상위 하나** — 페이지 하나의 렌더 오류(예: learn.json 오류)로 헤더·내비까지 전부 사라짐 | `main.tsx:14`, `layout/AppLayout.tsx:52-54` | 교육 콘텐츠 오류가 계통도 사용까지 막음 | `AppLayout` 의 `<Outlet/>` 을 경계로 감싸 헤더·내비는 유지, "홈으로" 버튼 제공 |
| R8 | **`useAppStore` 의 죽은 상태** — `viewMode`·`selectedNodeId`·`layerFilter` 는 URL 에서 복사만 되고 읽는 곳 없음. `ViewMode` 타입이 스토어에 있어 전 컴포넌트가 스토어 파일에 의존 | `store/useAppStore.ts`, `layout/AppLayout.tsx:15-28` | "원본이 둘"로 보이는 오해, 동기화 effect 비용 | 스토어는 `searchQuery` 만 남기거나 제거, `ViewMode` 는 `lib/diagram/url.ts`(또는 schema)로 이동, 동기화 effect 삭제 |
| R9 | **`learnSchema` → `data/load` 의존** — 오류 클래스 하나 때문에 교육 콘텐츠 모듈이 데이터 로더(=6개 JSON)에 묶임 | `content/learnSchema.ts:2` | 경계 역전, 향후 코드 분할 방해 | `DataValidationError` 를 `lib/errors.ts` 로 이동 (M5 와 같이 처리) |
| R10 | **번들·이미지 크기** — JS 단일 청크 710KB(빌드 경고, docs.json 6.4k줄 포함), 사진 59장 10MB(평균 170KB, 72px 타일용 / 최대 hmi.png 501KB — DI-86 경고) | `dist/assets/index-*.js`, `public/images/equipment/` | 모바일 첫 화면·데이터 사용량 | 페이지 단위 `React.lazy`(Product/Equipment/Gap/Learn), docs 는 제품 페이지에서 동적 import. 사진은 240px webp(수십 KB)로 재생성 — T4 성능 항목과 합치기 |

### 2.3 선택 (9)

| # | 항목 | 위치 | 제안 |
|---|---|---|---|
| O1 | `useData = getData` — 훅처럼 이름 붙었지만 훅이 아님 (조건부 호출해도 무방하지만 규칙 혼동) | `data/load.ts:89` | `getData` 로 통일하거나 주석 명시 |
| O2 | 주 계층 판별 정규식 `^L[1-7]$` / `^L\d$` 가 7곳에 반복 | `DiagramCanvas.tsx:66`, `LayerNav.tsx:49`, `model.ts:251`, `LearnPage.tsx:31`, `GapPage.tsx:159-160`, `EquipmentPage.tsx:180` | `schema.ts` 에 `isMainLayer(l)` |
| O3 | 노드 포커스 이동 코드 중복 (`querySelector('[data-node-id=…]').focus`) | `DetailPanel.tsx:199`, `SearchBox.tsx:78` | `lib/diagram/focusNode(id)` 헬퍼 |
| O4 | 데이터성 값이 컴포넌트에 하드코딩 — 내비 짧은 이름·전압(`'초고압 765/345kV'`), 초기 뷰 좌표, 검색 추천어 | `LayerNav.tsx:10-15`, `DiagramCanvas.tsx:21-22`, `SearchBox.tsx:15` | `diagram.json` 에 `shortLabel`·`initialView` optional 필드 (계약 추가는 optional 로만) |
| O5 | CSV 수식 주입 방어 없음 — `=`,`+`,`-`,`@` 로 시작하는 메모가 Excel 에서 수식으로 실행될 수 있음 (데이터는 내부 작성이라 위험 낮음) | `lib/pages/catalog.ts:203-205` | 해당 문자로 시작하면 `'` 접두 (UT-01 에 케이스 추가 가능) |
| O6 | 링크 복사 실패 시 사용자 피드백 없음 | `diagram/DiagramToolbar.tsx:58-66` | "복사 실패 — 주소창에서 복사하세요" 표시 |
| O7 | 74개 노드가 전부 Tab 정지점 — 키보드 사용자가 계통도를 지나가려면 74번 Tab | `diagram/DiagramNode.tsx:33` | 로빙 tabindex(방향키 이동) 검토. 지금은 건너뛰기 링크·계층 내비로 보완됨 |
| O8 | 퀴즈 답한 뒤 라디오가 `disabled` → 포커스가 사라지고 스크린리더가 선택지를 다시 읽기 어려움 | `pages/LearnPage.tsx:372` | `aria-disabled` + onChange 무시로 대체 |
| O9 | `/learn` 핵심 기기 카드·공백 표 "전체" 필터에 testid 없음 (E2E 는 href 셀렉터로 대체 중) | `pages/LearnPage.tsx:269`, `pages/GapPage.tsx:222` | `learn-key-{equipmentId}`, `gap-filter-all` (test-plan §7.3 요청) |

---

## 3. 질문별 답 (리더 체크리스트)

| 질문 | 결론 |
|---|---|
| 컴포넌트 크기·책임 분리 | 계통도 쪽(엔진/뷰 스토어/모델/노드)은 잘 나뉨. **LearnPage·DetailPanel 이 큼** → R6 |
| 타일·심볼·배지 중복 (메인 vs 페이지) | **있음.** 심볼 2벌(M1), 사진/심볼 Hero 중복(M1), 배지 6곳(R1), 분류 라벨 2벌(M2) |
| 디자인 토큰 일관성 | **우수** — 하드코딩 색 1곳(그림자). 개선 불필요 |
| 접근성 | 기본기 우수(G6). 남은 것은 선택 수준(O7·O8) |
| 데이터 계층 경계 | JSON 직접 import 는 load.ts 뿐 — **지켜짐**. 다만 파생 계산이 두 모듈로 나뉨(R5), learnSchema→load 역의존(R9), R-01 규칙 불일치(M3) |
| 에러 처리 | 데이터 검증 오류 화면은 좋음. 경로 표기 버그(M5), 경계가 최상위 하나(R7) |

## 4. R2 범위 제안
- **필수 묶음 (반나절~1일)**: M1~M6. M6 은 한 줄 수정, M4·M5 는 삭제/문자열, M2 는 상수 통합, M1·M3 이 실질 작업.
- **권장 묶음 1순위**: R1·R3·R4 (커버리지 표현·규칙의 단일 출처 — §6 회귀 안전망과 직결), R7·R8·R9 (작고 위험 낮음).
- **T4 와 합칠 것**: R10 (번들·이미지).
- 테스트 영향: M2·R1·R2 는 문구/마크업 변경 → CT-01·CT-03·CT-04 와 E2E 가 testid 기준이라 대부분 유지. M6 반영 시 FT-26 통과 예상.
