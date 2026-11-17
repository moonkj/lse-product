# Phase 0 스캐폴딩 점검 리포트 (T2 · 코드 디버거)

- 점검일: 2026-11-18 · 대상: T1 스캐폴딩 (package.json, vite/tsconfig, index.html, deploy.yml, scripts/fetch-products.mjs, src/**, src/data/*.json)
- 원칙: 코드 직접 수정 없음 — 리포트와 수정 제안만

## 0. 실제 실행 결과

| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit` | 통과 (오류 0) |
| `npm run build` | 통과 — JS 384 KB (gzip 104 KB), CSS 7.5 KB. `dist/index.html` 자산 경로가 `./assets/...` 상대 경로로 정상 |
| `npm run dev` (5199) + curl | `/`, `/src/main.tsx`, `/src/data/load.ts` 모두 200. 확인 후 종료 |
| `vite preview` (5198) + curl | `/`, `/assets/*.js` 200. 확인 후 종료 |
| 데이터 Zod 검증 (4개 JSON) | 4개 모두 통과 |
| 참조 무결성 | 중복 id 0, node→equipmentType 끊김 0, edge→node 끊김 0, lseCategoryCodes→category 끊김 0, productIds 끊김 0, 좌표가 범위나 계층 밴드를 벗어난 노드 0 |
| fetch-products 재현성 | 메뉴 JS를 **1회만** 받아(curl, 76.9 KB) `extractMenuJson`+`buildCatalog`를 오프라인으로 실행 → 커밋된 products.json(199)·categories.json(137)과 **바이트 단위로 같음** |
| `npm ci` (lock 동기화) | 임시 폴더에서 성공. 배포 대상(prod) 의존성 취약점 0. 개발용 picomatch 경고 high 6건 |
| 배포 Node 버전 | vite 8 / plugin-react 6 요구 `^20.19 \|\| >=22.12` → 워크플로 node 22로 충족 |

빌드·타입 오류는 없습니다. 아래 이슈는 런타임, 설계, 데이터 정합성에 관한 것입니다.

## 1. 요약

| 심각도 | 건수 |
|---|---|
| 높음 | 2 |
| 중간 | 7 |
| 낮음 | 11 |

---

## 2. 높음

### H1. 데이터 검증이 빌드 때 실행되지 않음 → JSON 1글자 오류가 배포 후 흰 화면으로 이어짐
- 위치: `src/data/load.ts:18-33`, `package.json` `build` 스크립트, `.github/workflows/deploy.yml:27`
- 원인: `parseOrThrow`는 **브라우저에서 모듈을 불러올 때만** 실행됩니다. `tsc`는 JSON을 `unknown`으로 넘기므로 스키마를 검사하지 않습니다. `vite build`도 검증하지 않습니다. PLAN 1.4는 "빌드 시 스키마 검증으로 사전 차단"을 요구하는데 지금은 구현되어 있지 않습니다.
- 재현: `equipment-types.json`의 `coverage`를 `"owend"`로 바꿈 → `npm run build` 성공 → 배포 → 모든 라우트가 흰 화면이 되고 오류는 콘솔에만 남음. ErrorBoundary가 없어 화면에 아무 안내도 뜨지 않음.
- 제안:
  1) 빌드 전에 검증하도록 바꿉니다. T3의 `test:data`(vitest)를 그대로 쓰는 방법이 가장 간단합니다.
  ```jsonc
  // package.json
  "build": "npm run test:data && tsc --noEmit && vite build"
  ```
  또는 워크플로에 단계를 추가합니다: `- run: npm run test:data` (`npm run build` 앞).
  2) 최상위에 ErrorBoundary를 둡니다 (`main.tsx`).
  ```tsx
  class RootErrorBoundary extends React.Component<{children: React.ReactNode}, {error?: Error}> {
    state: {error?: Error} = {};
    static getDerivedStateFromError(error: Error) { return { error }; }
    render() {
      return this.state.error
        ? <div role="alert" className="page"><h1>데이터를 불러오지 못했습니다</h1><pre>{this.state.error.message}</pre></div>
        : this.props.children;
    }
  }
  ```
  주의: `load.ts`는 import하는 시점에 throw하므로 ErrorBoundary가 이 오류를 잡지 못합니다. 데이터 로딩을 `getData()` 같은 함수(lazy·memo)로 감싸서 렌더링 중에 호출되게 해야 경계가 작동합니다.

### H2. "owned"인데 연결된 제품이 0개인 기기가 31개 (74개 중 42%)
- 위치: `src/data/equipment-types.json` (생성 스크립트 `scripts/build-diagram-data.py`), `src/data/categories.json`
- 원인: 137개 카테고리 중 81개의 `productIds`가 비어 있습니다. 공식 사이트 메뉴 트리에는 일부 카테고리의 제품 페이지(`/product/view/P…`)가 들어 있지 않기 때문입니다. 예: `AAA009005`(승압변압기), `AAA009004`(154kV GIS), `AAA015004`(PF), `AAA013`(ESS), `AAA003`(SCADA).
- 해당 id: step-up-tr, ehv-gis, hvdc, facts, substation, gis-154, main-tr, sas, fcl, alts, pf, vc-vi, mv-drive, sag-protector, ev-charger, mms, dmc, smart-device, pv, pcs, ess, dc-devices, microgrid, modular-substation, railway, scada, ems, dms, xems, care, amrs
- 영향: ① PLAN 2.3의 "제품 수로 owned/missing 자동 계산"을 구현하는 순간 이 31개가 전부 "공백(missing)"으로 뒤집힙니다. 커버리지가 크게 왜곡됩니다. ② Phase 3 상세 패널의 "자사 제품 목록"이 빈 채로 "보유" 배지만 뜹니다. 화면끼리 내용이 맞지 않습니다.
- 제안:
  - 커버리지는 지금처럼 **수동 값을 원본으로** 두고, 자동 계산은 "검증 경고"로만 씁니다. PLAN 2.3의 설명도 이에 맞게 고칩니다.
  - 제품 0개인 owned 기기는 카테고리 페이지 링크(`category.url`)를 "공식 제품군 페이지"로 보여 주는 대체 UI를 둡니다.
  - 장기적으로는 카테고리 페이지(`/ko/product/category/{code}`)를 수집해 하위 제품을 채웁니다 (Tasklist의 자료실 API 조사와 묶어서 진행).
  - 데이터 무결성 테스트에 SOFT 규칙을 추가합니다: `coverage==='owned' && resolvedProducts.length===0` → warn.

---

## 3. 중간

### M1. viewMode가 라우트와 store 두 곳에 있어 어긋남 (원본이 둘)
- 위치: `src/components/layout/AppLayout.tsx:10-18`, `src/components/layout/Header.tsx:44-47`, `src/store/useAppStore.ts:8,30`
- 재현:
  1) Gap 버튼 → `/gap` (viewMode=gap) → 노드나 링크로 `/equipment/vcb` 이동 → 헤더에 **"Gap"이 눌린 상태로 남음**. `/product/:id`와 404에서도 같음.
  2) 브라우저 뒤로가기로 `/gap` → `/equipment/x`가 되면 effect가 아무 값도 설정하지 않아 직전 값이 남음.
  3) `setViewMode`를 store에서 직접 호출하는 코드(앞으로 생길 계통도 내부 토글 등)는 URL을 바꾸지 않으므로 새로고침하면 상태가 사라짐.
- 개념 충돌: PLAN 1.3에서 "Gap 모드"는 **계통도 위의 오버레이**(보유는 흐리게, 공백은 강조)이고 `/gap`은 **매트릭스 페이지**입니다. 지금 토글은 두 개념을 한 버튼에 묶어, Gap 오버레이를 켜면 계통도를 떠나 버립니다.
- 제안 (둘 중 하나):
  - A) 라우트에서 계산(derive)만 하고 store에서 viewMode를 제거합니다.
  ```ts
  const { pathname } = useLocation();
  const viewMode: ViewMode = pathname.startsWith('/gap') ? 'gap' : pathname.startsWith('/learn') ? 'learn' : 'product';
  ```
  - B) 계통도 오버레이는 쿼리로 분리합니다 (`/#/?mode=gap`, `useSearchParams`). 이렇게 하면 페이지 이동(`/gap`, `/learn`)과 오버레이가 독립되고, 새로고침해도 유지되며, 링크로 공유할 수 있습니다. **권장.**
  - 화면에 보이는 토글 동작이 바뀌므로 반영 전에 사용자 확인이 필요합니다.

### M2. LayerNav가 다른 라우트에서 점프할 때 rAF 2회로는 렌더 완료가 보장되지 않음
- 위치: `src/components/layout/LayerNav.tsx:14-17`
- 원인: React Router v7은 내비게이션 상태 업데이트를 `React.startTransition`으로 감쌉니다. 그래서 `navigate('/')` 직후 rAF 2회가 지나도 DiagramCanvas가 아직 마운트되지 않았을 수 있습니다. 그러면 `getElementById`가 null을 반환하고 **스크롤이 조용히 실패**합니다. Phase 2에서 SVG가 무거워지면 더 자주 일어납니다.
- 재현 조건: `/gap`에서 "L6" 클릭 → 계통도로는 이동하지만 L6로 스크롤되지 않을 수 있음 (저사양 기기, 무거운 SVG일수록 잘 재현).
- 제안: 이동할 목표를 상태로 넘기고, 도착한 쪽(DiagramCanvas)이 마운트된 뒤에 스크롤합니다.
  ```ts
  // LayerNav
  navigate('/', { state: { jumpTo: layer } });
  // DiagramCanvas
  const { state } = useLocation();
  useEffect(() => {
    const l = (state as { jumpTo?: Layer } | null)?.jumpTo;
    if (l) document.getElementById(layerBandId(l))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [state]);
  ```
  Phase 2에서 줌/패닝 라이브러리를 도입하면 `scrollIntoView` 대신 해당 라이브러리의 `zoomTo/panTo`로 바꿔야 합니다. 지금 인터페이스를 `jumpToLayer(layer)`로 추상화해 두면 교체하기 쉽습니다.

### M3. layerFilter가 store에만 있고 소비하는 곳이 없음 + LayerNav의 의미가 모호함
- 위치: `src/store/useAppStore.ts:10,14-15,31-37`, `src/components/layout/LayerNav.tsx`, `src/components/diagram/DiagramCanvas.tsx`
- 내용: `toggleLayer`, `setLayerFilter`를 호출하는 UI가 없고 DiagramCanvas도 필터를 읽지 않습니다. PLAN 와이어프레임의 좌측 "□ 신재생 □ 자동화 □ 감시/보호"는 **필터(체크박스)**이고 L1~L7은 **점프**인데, LayerNav는 점프만 구현했습니다.
- 잠재 버그: "빈 배열 = 전체 표시"라는 규칙 때문에, 사용자가 마지막 계층의 체크를 해제하면 갑자기 **전체가 다시 보입니다**. 직관과 반대입니다.
- 제안: 필터 상태를 `Set<Layer>`(모두 선택이 초기값)로 두고, 빈 집합이면 "표시할 계층 없음" 빈 상태를 보여 줍니다. 또는 `hiddenLayers: Layer[]`(빈 배열 = 숨긴 것 없음)로 의미를 뒤집으면 혼동이 사라집니다. 필터 UI의 체크박스는 `role="checkbox"`/`aria-checked`, 또는 `<input type="checkbox">`로 만듭니다.

### M4. selectedNodeId가 URL에 없음 → 새로고침·링크 공유 시 선택이 사라지고, 다른 페이지에도 패널이 남음
- 위치: `src/store/useAppStore.ts:7`, `src/components/panel/DetailPanel.tsx`, `src/components/layout/AppLayout.tsx:29`
- 내용: ① 영업 시나리오("이 기기 보세요" 링크 공유)를 지원하지 못합니다. ② DetailPanel이 `/gap`, `/learn`, `/equipment/:id`에서도 360px을 차지하고 직전 선택을 보여 줍니다. 모바일에서는 모든 페이지 하단에 빈 상태 문구가 붙습니다.
- 제안: `/#/?node=vcb-l4` 같은 쿼리로 선택을 표현하고, 패널은 홈(계통도) 라우트의 레이아웃에서만 렌더링합니다. 다른 페이지에서는 `grid-template-columns`에서 panel 열을 뺍니다.

### M5. Zod `z.url()`이 `javascript:` 등 모든 프로토콜을 허용함 + DocRef.url은 검증 없음
- 위치: `src/lib/schema.ts:67`(Product.url), `:55`(DocRef.url = `z.string()`), `:78`(Category.url = `z.string()`)
- 확인: zod 4.6.7에서 `z.url().safeParse('javascript:alert(1)').success === true`. `ProductPage.tsx:14`가 이 값을 `href`에 그대로 넣습니다. 비개발자가 JSON을 고치는 운영 모델(PLAN 1.1 관리자)에서는 실수나 오염된 값이 그대로 링크가 됩니다.
- 제안:
  ```ts
  const httpsUrl = z.url({ protocol: /^https$/ });   // 실측: javascript:/http:/ftp: 거부, https 허용
  // Product.url, Category.url, DocRef.url 모두 httpsUrl (사내 상대 경로 문서가 필요하면 z.union([httpsUrl, z.string().regex(/^docs\//)]))
  ```
  계약 파일이 "필드명 변경 금지"이므로 타입은 그대로이고 제약만 강화됩니다. 현재 데이터 199/137건은 모두 https라 깨지지 않습니다.

### M6. fetch-products.mjs: 타임아웃·스키마 검증·원자적 쓰기가 없고, docs를 덮어씀
- 위치: `scripts/fetch-products.mjs:158,165-167,112`
- 문제:
  1) `fetch`에 타임아웃이 없어 사내망·프록시에서 무기한 멈출 수 있습니다.
  2) 출력 전에 `ProductsSchema`/`CategoriesSchema` 검증을 하지 않습니다. 지금 출력은 스키마와 일치하지만(실측), 사이트 구조가 바뀌면 깨진 JSON이 그대로 저장되고 H1 때문에 배포까지 넘어갑니다.
  3) products.json을 쓴 뒤 categories.json에서 실패하면 두 파일이 **서로 다른 세대**로 남습니다.
  4) `docs: []`로 매번 초기화하므로, 앞으로 자료실 API로 채우거나 수동으로 넣은 `docs`가 **재실행할 때 모두 지워집니다**.
  5) `discontinued: name.includes('단종')` 휴리스틱은 현재 데이터에서 0건만 잡힙니다. 사실상 동작하지 않으므로 의도를 주석에 명시하거나 다른 신호로 바꿉니다.
  6) 응답 앞에 `<!-- OutputCache ... -->` HTML 주석이 붙어 오지만 `indexOf('var _menu')`로 건너뛰므로 문제없습니다 (확인 완료). 다만 서버가 `var _menu=` 대신 `window._menu =`처럼 바꾸면 깨지므로 정규식 `/(?:var|let|const|window\.)\s*_menu\s*=/` 정도로 넓히기를 권장합니다.
- 제안 조각:
  ```js
  const res = await fetch(MENU_URL, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) });
  // 기존 docs 보존
  const prev = new Map(JSON.parse(await readFile(resolve(OUT_DIR,'products.json'),'utf8').catch(()=>'[]')).map(p=>[p.id,p]));
  for (const p of products) p.docs = prev.get(p.id)?.docs ?? [];
  // 검증 (zod 는 이미 dependency)
  // tmp 파일에 쓴 뒤 rename 으로 두 파일을 교체
  await writeFile(out + '.tmp', json); await rename(out + '.tmp', out);
  ```
  스키마 검증은 `.mjs`에서 TS 스키마를 바로 import할 수 없습니다. Node 22.18+의 type stripping이나 `tsx`를 쓰거나, 실행 후 `npm run test:data`를 체인으로 붙이는 방법이 가장 간단합니다: `"fetch:products": "node scripts/fetch-products.mjs && npm run test:data"`.

### M7. 커버리지 아이콘 대비 부족 (라이트 모드)
- 위치: `src/styles/tokens.css:65,68,74`, `src/components/common/CoverageBadge.css:17-18`
- 실측 대비(흰 아이콘/배경): partial `#e0a800` **2.15:1**, na `#9aa3ae` **2.55:1**. 비텍스트 기준 3:1에 미달합니다. owned 3.47, affiliate 4.81, missing 4.55는 통과. 다크 모드(어두운 글자)는 모두 5:1 이상입니다.
- 제안: 라이트 모드에서 `--cov-partial: #b58600`, `--cov-na: #7a838f` 정도로 어둡게 하거나, partial/na에만 `--cov-on-color` 대신 어두운 글자색(`#1a1f29`)을 씁니다. 계통도 노드에도 같은 토큰이 쓰일 예정이므로 지금 바로잡는 편이 좋습니다. 보이는 색이 바뀌므로 사용자 확인이 필요합니다.

---

## 4. 낮음

| # | 위치 | 내용 | 제안 |
|---|---|---|---|
| L1 | `Header.tsx:37-51` | 모드 버튼이 실제로는 **페이지 이동**인데 `aria-pressed` 토글 시맨틱을 씀 | 이동이면 `<NavLink>` + `aria-current="page"`. M1-B를 택해 오버레이 토글로 바꾸면 `aria-pressed`가 맞음 |
| L2 | `AppLayout.tsx:26`, `index.html` | `id="main"`은 있으나 "본문 바로가기" 링크가 없음 | 헤더 앞에 `<a href="#main" className="skip-link">` 추가. **주의: HashRouter에서는 `#main`이 라우트로 해석됨** → `onClick`에서 `preventDefault` 후 `document.getElementById('main')?.focus()` (main에 `tabIndex={-1}`) |
| L3 | `HomePage.tsx`, `DiagramCanvas.tsx:14` | 홈에 `<h1>`이 없음 (스크린리더 제목 구조) | `<h1 className="visually-hidden">전력계통 단선결선도</h1>` |
| L4 | 각 페이지 | 라우트를 바꿔도 `document.title`이 고정. SPA에서 포커스도 이동하지 않음 | 페이지별 `useEffect(() => { document.title = ... }, [])`, 라우트가 바뀌면 h1에 포커스 |
| L5 | `LayerNav.tsx:26` vs `diagram.json` layers | 순서 불일치: LayerNav는 `…L7, REN, MON`, diagram은 `…L7, MON, REN` | 한쪽 기준으로 통일 (diagram.layers 순서를 그대로 쓰기 권장) |
| L6 | `EquipmentPage.tsx:9-11`, `ProductPage.tsx` | 없는 id에서도 동작은 함(크래시 없음, 확인 완료). 다만 h1이 "기기 상세"라 404인지 알아보기 어렵고, 기기 ID를 노출함 | `if (!eq) return <NotFoundPage kind="기기" id={id} />` 형태로 통일하고 검색 추천(PLAN 1.4) 연결 |
| L7 | `Header.tsx:24-34` | 검색어를 store에 저장만 하고 아무도 사용하지 않음. `/gap`에서 입력해도 아무 반응 없음 | Phase 2~3에서 Fuse 결과 드롭다운 구현. 그 전까지는 `disabled`나 "준비 중" 표시를 고려 (보이는 변화라 사용자 확인 필요) |
| L8 | `AppLayout.css:143-186` | 모바일에서 헤더 범례 5개가 줄바꿈되어 헤더가 3~4줄로 커짐. 상세 패널은 PLAN의 "하단 시트"가 아니라 문서 끝에 붙음 | 900px 이하에서 범례는 접기(`<details>`)로, 패널은 `position: fixed; bottom: 0` 시트로 (Phase 3) |
| L9 | `vite.config.ts` / 향후 `public/` | 지금은 문제없음. 단 앞으로 `/docs/x.pdf`처럼 **절대 경로**로 public 자산을 참조하면 Pages 하위 경로(`/<repo>/`)에서 404가 남 | 항상 `` `${import.meta.env.BASE_URL}docs/x.pdf` `` 사용 규칙을 PLAN/README에 명시 |
| L10 | `.github/workflows/deploy.yml:13-15` | `cancel-in-progress: true`는 진행 중인 **배포**까지 취소할 수 있음 (GitHub 공식 스타터는 `false`). Pages 소스를 "GitHub Actions"로 바꾸는 리포 설정도 필요 | `cancel-in-progress: false`. 첫 배포 전에 Settings → Pages → Source = GitHub Actions 설정 (또는 `configure-pages`에 `enablement: true`, 단 토큰 권한 필요). 권한(pages:write, id-token:write), artifact 경로(`dist`), environment 설정은 **정확함** |
| L11 | `tsconfig.json:21-22`, 린트 | ① `types: ["node"]`가 `src`에도 적용되어 브라우저 코드에서 `process`, `Buffer`를 써도 타입 오류가 나지 않음 ② 루트 `tsc`는 `tests/`, `vitest.config.ts`, `playwright.config.ts`를 검사하지 않음 ③ ESLint 미설정 (Tasklist의 "린트" 항목) | ① `tsconfig.app.json`(DOM만)과 `tsconfig.node.json`(vite/vitest config, scripts)으로 분리 ② `typecheck`에 `tsc -p tests` 추가 ③ `eslint` + `eslint-plugin-react-hooks` 최소 구성 (`exhaustive-deps`는 M2 같은 effect 버그를 잡아 줌) |

참고 (이슈 아님):
- Zod 4 API 사용 (`z.url()`, `z.prettifyError`, `z.enum().options`, `z.ZodType` 제네릭)은 올바릅니다.
- HashRouter + `base: './'`: 빌드 산출물이 상대 경로이므로 하위 경로와 새로고침 모두 안전합니다.
- 다크 모드 토큰: `src/**`에서 쓰는 `var(--*)`는 모두 `tokens.css`에 정의되어 있고(누락 0), 라이트와 다크 양쪽에 값이 있습니다. muted 텍스트 대비도 라이트 5.49, 다크 7.41로 충분합니다.
- 번들 384 KB 중 대부분은 JSON 데이터입니다. 제품이 늘어나면 `products.json`을 `fetch`로 지연 로딩하거나 라우트 단위로 코드 분할하는 것을 고려합니다.
- 제품명 중복(예: "디지털 입력" 4건)은 실제 사이트 구조 그대로입니다. 검색 결과에는 `categoryPath`를 함께 표시해야 구분할 수 있습니다.
- `Product.categoryPath`에는 자기 이름이 없지만 `Category.path`에는 자기 이름이 포함됩니다. 의도된 차이라면 schema 주석에 적어 둡니다.

## 5. 권장 처리 순서
1. H1 (빌드 때 데이터 검증) — 한 줄짜리 수정으로 배포 사고를 막음
2. H2 (owned·제품 0 정합성 방침 결정) — Phase 2~3 UI 설계 전에 리더가 결정
3. M1 (viewMode 원본 단일화, Gap 오버레이와 페이지 분리) — Phase 2 계통도 구현 전에 결정. 보이는 동작이 바뀌므로 사용자 확인 필요
4. M5, M6 (URL 프로토콜, fetch 견고성)
5. 나머지는 해당 Phase에서 처리
