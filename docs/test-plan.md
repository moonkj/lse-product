# 테스트 계획서 (v0.3)

> 작성: Teammate 3 (테스트 작성자 + 최종 리뷰어) · 2026-11-18
> 대상: 전력계통도 기반 제품 포트폴리오 & 신입 교육 포털 (PLAN.md v0.1)
> 코드: `tests/unit/data-integrity.test.ts`, `tests/unit/components/*.test.tsx`, `tests/e2e/smoke.spec.ts`, `tests/e2e/core-flows.spec.ts`
> 설정: `vitest.config.ts`(jsdom, DI 테스트는 파일 상단 `@vitest-environment node`), `playwright.config.ts`(chromium, build+preview :4173), `tests/tsconfig.json`
> 스크립트: `npm test`(vitest run) · `npm run test:watch` · `npm run test:data`(DI만) · `npm run test:e2e` · `npm run typecheck:tests`
> v0.2 (11-18): 환경 구성·실행 완료, 리더 결정 R-01/04/05/07/08/09 반영 (§8)
> v0.3 (11-18): docs.json 규칙 DI-60~68 추가, 컴포넌트 테스트 CT-01/02 추가, E2E 를 사용자 확정 UX(Gap=같은 계통도 `?mode=gap`, 공백 표 링크, `?node=` 복원)와 docs.json 기준 자료 링크로 갱신

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

## 3. 데이터 무결성 규칙 (DI) — 총 57개 (HARD 50 · SOFT 7)

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
| DI-28 | coverage 값이 5종 enum 안 (스키마 이중 확인) | HARD |
| DI-29 | product-mapping.md 공백 후보 11종이 기기 목록에 "자리"로 존재 | SOFT |

### 3.5 계통도 구조
| ID | 규칙 | 등급 |
|---|---|---|
| DI-30 | 모든 node.equipmentTypeId 존재 | HARD |
| DI-31 | 모든 edge.from / edge.to 가 존재하는 node | HARD |
| DI-32 | self-loop 없음, 같은 노드쌍 중복 edge 없음(방향 무시) | HARD |
| DI-33 | L1~L7 + 노드가 사용하는 모든 layer(REN·MON 포함)에 밴드 정의 | HARD |
| DI-34 | L1~L7 각 계층에 노드 ≥ 1 | HARD |
| DI-35 | node 좌표가 **자기 기기 layer 밴드 사각형** `[x, x+width]×[y, y+height]` 안 (x/width 생략 시 0/diagram.width — REN·MON 오른쪽 열 대응) | HARD |
| DI-36 | node 좌표가 캔버스 `[0,width]×[0,height]` 안 | HARD |
| DI-37 | 밴드: 크기 > 0, 캔버스 안, **x·y 모두 겹칠 때만** 겹침으로 판정 → 겹침 없음 | HARD |
| DI-38 | L1→L7 밴드가 위에서 아래 순서 (투어 방향) | HARD |
| DI-39 | 노드 간 최소 거리 24px (겹쳐서 클릭 불가 방지) | HARD |
| DI-40 | 고립 노드 없음 (edge ≥ 1). 예외: MON 감시 노드, `category=system` 일괄/패키지 노드 | HARD |
| DI-41 | L1 노드에서 L7 노드까지 경로 존재 (전원→부하 흐름 단절 없음) | HARD |
| DI-42 | edge 는 같은/인접 L 계층만 연결 (L2→L6 건너뛰기 금지, REN·MON 예외) | HARD |
| DI-43 | 모든 equipmentType 이 계통도에 노드로 1회 이상 등장 (리더 공지 반영) | HARD |

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

---

## 3b. 컴포넌트 테스트 (CT, Vitest + Testing Library + jsdom, v0.3)
| ID | 대상 | 검증 | 테스트 수 |
|---|---|---|---|
| CT-01 | `common/CoverageBadge` | 5상태 아이콘·라벨이 서로 다름 / 상태별 색 클래스(`cov-badge--{c}`) + `coverage-icon-{c}` 아이콘(aria-hidden) + 라벨 텍스트 동시 렌더 / `showLabel=false` 여도 visually-hidden 라벨 유지 | 11 |
| CT-02 | `common/ExternalLink` | https → `<a target=_blank rel="noopener noreferrer">` + "새 탭" 안내 / http·javascript:·data:·상대경로·`//`·ftp·빈 문자열 → `<a>` 미생성(텍스트만) | 9 |

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
| FT-25 | 교육 투어 | 교육 모드 → 투어 시작 → 다음 반복 | L1→L7 순서, 역행 없음, 각 단계 밴드 하이라이트·화면 이동, 마지막 단계에서 다음 비활성 | E2E |
| FT-26 | /gap 매트릭스 | `#/gap` | 공백 건수 = 데이터 missing 수, 행(전압)×열(기능) 셀 클릭 → 해당 기기 | E2E |
| FT-27 | 커버리지 통계 | 사이드바 % | (owned + partial×가중치?) / (전체 − na) — 공식 확정 후 단위 테스트 고정 | 단위 |
| FT-29 | 선택 노드 URL 복원 | `#/?node=<nodeId>` 진입·새로고침 / 다른 노드 클릭 / 닫기 / 없는 id | 패널·`aria-pressed` 복원, 클릭 시 `node=` 갱신, 닫으면 파라미터 제거, 없는 id 는 패널 없이 정상 | E2E |
| FT-30 | 공백 표 링크 | 좌측 내비 아래 "공백 표 보기" | `#/gap` 공백 표로 이동 | E2E |
| FT-28 | 데이터 오류 | 스키마 위반 JSON | 빌드/테스트 단계에서 실패 (런타임 흰 화면 아님) | DI |

---

## 5. E2E 핵심 시나리오 (`tests/e2e/core-flows.spec.ts`)

| ID | 페르소나 | 흐름 | 검증 포인트 |
|---|---|---|---|
| E2E-1 | 신입 | 홈 → 교육 모드 → 투어 시작 → 다음×N → 투어 닫기 → owned 기기 클릭 | 투어가 L1에서 시작해 L7에서 끝남, 역행 없음, 각 단계 밴드가 뷰포트 안, 패널에 학습 포인트 |
| E2E-2 | 영업 | 검색에 약어 입력 → 기기 결과 선택 → 패널 → 제품 카드 → 제품 페이지 → 데이터시트/공식 페이지 | 노드 선택 상태, 배지 owned, URL `#/product/:id`, 링크 새 탭+noopener+ls-electric.com, popup 이벤트. 자료가 없으면 "자료 준비 중" |
| E2E-3 | 기획 | Gap 버튼(같은 계통도, `?mode=gap`) → missing 강조/owned 흐림 → 공백 기기 클릭 → "공백 표 보기" 링크 → `/gap` | URL `mode=gap`·`gap-page` 미표시, 아이콘 병행, gapNote, 제품 목록 없음, 공백 건수 = 데이터 |
| E2E-4 | 공통 | 딥링크·새로고침·뒤로가기·없는 id·자산 404, `?node=` 복원·갱신·제거, `?mode=gap&node=` 조합 | GitHub Pages 시나리오 (preview 빌드 기준) |
| DOCS | 공통 | docs.json 기준: 항목 없음(R-04)·빈 항목(deepLink)·제품 페이지 전체 링크·상세 패널 popup·기기 페이지 | 건수 = docs.json, `data-doc-type`, 새 탭·noopener·허용 도메인. 외부 요청은 `context.route` 로 stub (네트워크 의존 없음) |
| SMOKE | 공통 | 홈 진입 | 헤더·범례 5종 표시, 런타임 오류 없음 (`smoke.spec.ts`, Phase 1부터 항상 통과해야 함) |
| E2E-5 | 접근성 | 키보드 Enter/Esc·포커스 복귀, 건너뛰기 링크, 계층 점프, 범례 5종, 모바일 하단 시트, 라이트/다크 axe 대비 | |

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
| `diagram-edge-{edgeId}` | 연결선 | `data-kind="power|signal"` — R-07: power 굵은 실선, signal 가는 점선(stroke-dasharray) |
| `diagram-node-{nodeId}` | 노드 `<g>` | `role=button`, `tabindex=0`, `aria-label="{기기명}, {커버리지 한글}"`, `aria-pressed`(선택), `data-coverage`, `data-dimmed`, `data-emphasized` (각 "true"/"false") |
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
| `equipment-page` / `equipment-title` | `/equipment/:id` 페이지·제목 | |
| `product-page` | `/product/:id` 페이지 | |
| `product-official-link` | 공식 제품 페이지 링크 | `target=_blank`, `rel="noopener noreferrer"` |
| `doc-link` | 자료 링크 (여러 개) | `data-doc-type`, `target=_blank`, `rel` |
| `docs-empty` | "자료 준비 중" 배지 | R-04: 이때 `product-official-link` 를 대체 자료로 반드시 표시 |
| `detail-doc-link` / `equipment-doc-link` | 상세 패널·기기 페이지 자료 링크 | `doc-link` 와 동일 속성 (v0.3) |
| `gap-table-link` | 좌측 내비 아래 "공백 표 보기" 링크 (→ `#/gap`) | **v0.3 신규 요청** |
| `gap-page` / `gap-matrix` / `gap-list` / `gap-item-{equipmentId}` | `/gap` 페이지 | |
| `learn-page` | `/learn` 페이지 | |
| `tour-start` / `tour-step` / `tour-next` / `tour-close` | 교육 투어 | `tour-step` 에 `data-layer`, 마지막 단계 `tour-next` disabled |

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
