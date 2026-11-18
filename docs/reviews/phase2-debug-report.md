# Phase 2~5 디버그 리포트 (T2)

- 대상 커밋: `1ce6811` (Phase 2~5 구현) · 점검일 2026-11-18 · 코드 수정 없음 (리포트·수정 제안만)
- 범위: `src/components/{diagram,panel,layout,pages}/**`, `src/lib/{diagram,pages}/**`, `src/store/useAppStore.ts`, `src/pages/**`, `src/content/**`
- 재현 환경: `vite preview --port 4181` (dist) + Playwright chromium 스크립트. 스크린샷은 `/private/tmp/claude-501/-Users-kjmoon-LSE-News/37bcf7f5-4ef4-4874-8316-789fc9001612/scratchpad/t2-*.png`
- 보조 스크립트(같은 폴더): `edges.py`(엣지 77개 전수 관통 검사), `data.mjs`(learn.json·데이터 참조), `fuse.mjs`(검색 질의), `repro1~3.mjs`(브라우저 재현)

## 0. 실행 결과

| 명령 | 결과 |
|---|---|
| `npm run build` | 통과 (tsc 오류 0). `dist/assets/index-*.js` **710.6 kB** (gzip 166 kB) → 500 kB 경고. `dist/images/equipment` 59개 포함, `index.html` 은 `./assets/…` 상대 경로 |
| `npm run test` | **97/97 통과** (3개 파일) |
| `npm run test:e2e` | **27 통과 / 1 실패 / 1 skip**. 실패 = E2E-1 (`/learn` 투어 화면에 `layer-band-L1` 없음) → M6 |

## 요약

| 심각도 | 건수 |
|---|---|
| 높음 | 2 |
| 중간 | 8 |
| 낮음 | 14 |

| ID | 심각도 | 제목 | 위치 |
|---|---|---|---|
| H1 | 높음 | 엣지 13개가 다른 기기 타일 28곳을 관통해서, 실제로 없는 직렬 연결처럼 보임 | `src/lib/diagram/model.ts:96-113`, `src/data/diagram.json` |
| H2 | 높음 | 모델명 검색(placeholder 예시 "iS7") 후 Enter를 누르면 엉뚱한 기기(GIS)로 이동 | `src/components/layout/SearchBox.tsx:53-66, 93-96` |
| M1 | 중간 | 미니맵 클릭 좌표가 약 185~210 diagram px(타일 1.5개) 어긋남 | `src/components/diagram/Minimap.tsx:14-17` |
| M2 | 중간 | 드래그 중에 휠로 줌하면 화면이 크게 튐 | `src/lib/diagram/panzoom.ts:212-229` |
| M3 | 중간 | 한글 IME 조합 중 Enter를 누르면 미완성 검색어로 이동하고 글자가 남음 | `SearchBox.tsx:85-101` |
| M4 | 중간 | 화면을 옮겨도 본문 스크롤 위치가 초기화되지 않음 | `AppLayout.tsx` / `AppLayout.css:420-422` |
| M5 | 중간 | 계통도(/)로 돌아와도 탭 제목이 이전 제품명 그대로 남음 | `HomePage.tsx`/`DiagramCanvas.tsx` (title 설정 없음) |
| M6 | 중간 | E2E-1 실패: 교육 투어(/learn)와 계통도 밴드 사이 계약 불일치 | `DiagramToolbar.tsx:96`, `tests/e2e/core-flows.spec.ts:157` |
| M7 | 중간 | 연결 기기·같은 계층 공백 칩을 누르면 포커스가 body로 사라짐 | `DetailPanel.tsx:95-106, 158-168` |
| M8 | 중간 | 투어 마지막 단계(L7)는 "다음"이 비활성이라 퀴즈를 다 풀어야만 완료됨 | `LearnPage.tsx:92-95, 327` |
| L1~L14 | 낮음 | 아래 §3 | |

---

## 1. 높음

### H1. 직교 엣지가 다른 기기 타일을 관통함 (단선결선도 위상 오해)

- **위치**: `src/lib/diagram/model.ts:96-113` (`route()`), 좌표 `src/data/diagram.json`
- **검증 방법**: `route()`와 모선 묶음(`busY`) 로직을 Python으로 그대로 옮기고, 엣지 77개의 모든 선분이 양 끝이 아닌 다른 타일(120×116, 안쪽 2px)과 겹치는지 계산함 (`edges.py`).
- **결과**: **13개 엣지, 28곳 관통**. 타일은 불투명 HTML이고 SVG 선 위에 그려지므로, 선이 타일 위쪽으로 들어가 아래쪽으로 나오는 모양이 됨. 그래서 **A→(관통된 기기)→B 직렬 연결처럼 보임**. 엣지를 선택해 파랗게 강조하면 더 분명함.

| 엣지 | 연결 | 관통하는 타일 |
|---|---|---|
| e033 power | n-oil-tr → n-busway | **n-spd** (변압기→SPD→버스웨이 직렬처럼 보임) — `t2-edge-through-spd.png` |
| e038 power | n-acb → n-cap | n-spd |
| e028 power | n-vcb → n-vc | n-pf |
| e026 signal | n-relay → n-vcb | n-ct-pt |
| e060 power | n-busway → n-servo | n-dmc |
| e051 signal | n-panel → n-smart | n-mcb, n-elcb |
| e068 power (far) | n-pcs → n-acb | n-cast-tr, n-oil-tr |
| e073 signal (far) | n-amrs → n-meter | n-la |
| e074 signal (far) | n-scada → n-relay | n-dms, n-care |
| e075 signal (far) | n-xems → n-pmeter | n-amrs, n-dc, n-pv, n-meter, n-ct-pt (5곳) — `t2-edge-e075-xems.png` |
| e076 signal (far) | n-care → n-cast-tr | n-pv, n-mof, n-vcb |
| e077 signal | n-ems → n-microgrid | n-xems, n-amrs |

- 오른쪽 열(MON/REN)로 가는 긴 선 8개(e068, e070~e076) 중 **6개가 관통**함. 이 선들은 `far`라서 opacity 0.4로 옅게 그려지지만 선택하면 진하게 강조되고, Gap 모드에서 흐려진 타일(`data-dimmed`, opacity) 아래로는 선이 비쳐 보임 (`t2-dark-gap.png`의 PF 타일).
- 같은 직선 구간을 여러 엣지가 공유하는 경우도 45곳(모선 제외) 있음. 대부분 같은 출발점의 공통 줄기라 괜찮지만, e023/e030 ↔ e076(899 열 세로선)과 e069 ↔ e077(2044 열)은 서로 다른 회로가 한 선으로 합쳐져 보임.
- **원인**: `route()`는 장애물을 고려하지 않음. 세로→가로→세로 경로의 꺾는 지점을 양 끝 중간(`(y1+y2)/2`)이나 출발 x 열로만 정하고, 리더의 "겹침 없음 보장"은 **타일끼리 겹치지 않는다는 것만** 보장함.
- **수정 제안**:
  1. 스키마에 우회 지점을 추가함 (`DiagramEdge.via?: [number, number][]`). 우회 지점이 있으면 `route()` 대신 그 점들을 직교로 이음.
  2. 데이터 무결성 테스트에 관통 0건 규칙을 추가해서 회귀를 막음:

```ts
// tests/unit/data-integrity.test.ts (DI-70 제안)
import { getDiagramModel, TILE_W, TILE_H } from '../../src/lib/diagram/model';
it('DI-70 엣지 선분이 양 끝이 아닌 타일을 관통하지 않는다', () => {
  const m = getDiagramModel();
  const hits: string[] = [];
  for (const e of m.edges) {
    const pts = [...e.d.matchAll(/([MVH])([-\d.]+)(?: ([-\d.]+))?/g)];
    let x = 0, y = 0; const seg: [number, number, number, number][] = [];
    for (const [, c, a, b] of pts) {
      if (c === 'M') { x = +a; y = +b; continue; }
      const nx = c === 'H' ? +a : x, ny = c === 'V' ? +a : y;
      seg.push([x, y, nx, ny]); x = nx; y = ny;
    }
    for (const n of m.nodes) {
      if (n.id === e.from || n.id === e.to) continue;
      const L = n.x - TILE_W / 2 + 2, R = n.x + TILE_W / 2 - 2, T = n.y - TILE_H / 2 + 2, B = n.y + TILE_H / 2 - 2;
      for (const [x1, y1, x2, y2] of seg)
        if (Math.min(x1, x2) < R && Math.max(x1, x2) > L && Math.min(y1, y2) < B && Math.max(y1, y2) > T) hits.push(`${e.id}→${n.id}`);
    }
  }
  expect(hits).toEqual([]);
});
```
  3. 단기 대안: 노드 좌표를 조정함 (예: n-spd를 1160 열에서 비키기, MON/REN 긴 선은 L 밴드 사이 빈 줄(y=540·1080·1620… 경계 ±20)을 가로 통로로 쓰도록 `busY` 대신 통로 y 지정).

### H2. 모델명 검색 후 Enter → 관련 없는 기기 선택

- **위치**: `src/components/layout/SearchBox.tsx:53-66` (기기 결과를 항상 제품보다 앞에 둠), `:93-96` (Enter는 `results[0]`)
- **재현**: `#/`에서 검색창에 `iS7`(placeholder에 예시로 나온 모델명)을 입력하고 Enter를 누름 → `#/?node=n-ehv-gis` (초고압 GIS)가 열림. 결과 목록은 `GIS / GIS(154kV) / CARE / 특고압 수배전반 / 제품 iS7` 순서 (`t2-search-is7.png`).
- **원인 (가설 2개 검증)**:
  - (가) 기기 Fuse(threshold 0.34, `ignoreLocation`, description 포함)가 "is"를 퍼지로 매칭함 → `fuse.mjs`로 확인. `iS7`·`is7` 모두 기기 4건이 나오고, `a` 한 글자에도 기기 6건이 나옴. **채택**.
  - (나) 제품 인덱스 누락 → 기각. 제품 `iS7`은 검색됨. 다만 그룹 순서가 고정이라 Enter가 항상 기기 1번을 고름.
- **수정 제안**: 두 인덱스에 `includeScore`를 켜고 점수로 합쳐 정렬함. 짧은 질의는 `minMatchCharLength: 2`로 걸러내고, 영숫자 질의는 기기 description 키를 빼거나 threshold를 0.2로 낮춤.

```ts
const eqs = idx.eq.search(q, { limit: MAX_EACH }).map((r) => ({ kind: 'equipment', key: `e-${r.item.id}`, node: r.item, score: r.score ?? 1 }));
const prods = idx.products.search(q, { limit: MAX_EACH }).map((r) => ({ kind: 'product', /*…*/ score: r.score ?? 1 }));
// 그룹 순서: 최고 점수가 더 좋은(작은) 쪽을 먼저
const eqBest = eqs[0]?.score ?? 1, prBest = prods[0]?.score ?? 1;
return prBest + 0.05 < eqBest ? [...prods, ...eqs] : [...eqs, ...prods];
// useIndexes: Fuse 옵션에 includeScore: true, minMatchCharLength: 2
```
- 관련 개선: 모델명으로 기기를 찾는 경로가 없음. `GIPAM`을 검색해도 보호계전기 기기가 나오지 않음 (L4 참조).

---

## 2. 중간

### M1. 미니맵 클릭 좌표 오프셋

- **위치**: `src/components/diagram/Minimap.tsx:14-17`, CSS `.minimap { padding: 6px; border: 1px }` (`DiagramCanvas.css:389-398`)
- **재현**: 데스크톱 1440×900, `#/`에서 미니맵 SVG 위 diagram 좌표 (1160, 1944) 지점을 클릭 → 화면 중심이 **(1371, 2148)** 로 이동함 (+211, +204). 스크린샷 `t2-minimap-offset.png`.
- **원인 (가설 검증)**:
  - (가) `getBoundingClientRect()`를 SVG가 아니라 바깥 div(패딩 6 + 테두리 1 = 7px) 기준으로 잼 → 7px ÷ k(88/2320) = **184.5 diagram px**. 측정값과 대체로 맞음. **채택**.
  - (나) 나머지 20~27px는 `centerOn` 뒤 스크롤 범위 제한이나 반올림 때문으로 보임. 크기가 작아서 (가)를 고치면 함께 해소되는지 재측정이 필요함.
- **수정 제안**:

```tsx
const svgRef = useRef<SVGSVGElement>(null);
const onClick = (e: React.MouseEvent) => {
  const r = svgRef.current!.getBoundingClientRect();
  const x = Math.min(model.width, Math.max(0, (e.clientX - r.left) / k));
  const y = Math.min(model.height, Math.max(0, (e.clientY - r.top) / k));
  getDiagramController()?.centerOn(x, y);
};
// <svg ref={svgRef} …>
```

### M2. 드래그 중 휠 줌 → 화면 튐

- **위치**: `src/lib/diagram/panzoom.ts:212-229`. `onPointerDown`에서 저장한 `sl/st`(시작 스크롤)를 `onPointerMove`가 계속 기준으로 씀.
- **재현** (`repro2.mjs`): 빈 영역에서 마우스를 누른 채 20px 드래그 → 휠 -600(확대) → 2px만 더 움직임. 중심 좌표: 드래그 중 (989,1890) → 휠 후 (765,2100) → **2px 이동 후 (465,891)**. 1200 diagram px 넘게 튐.
- **원인 (가설 검증)**:
  - (가) 줌으로 scale·ox가 바뀌었는데 이전 배율 기준의 `d.sl - mx`를 그대로 대입함 → 수치 재현과 일치. **채택**.
  - (나) `suppressClick` 등 다른 상태가 개입함 → 클릭이 없는 시나리오에서도 재현되므로 기각.
- **수정 제안** (증분 이동으로 바꾸면 줌·핀치가 섞여도 안전함):

```ts
private drag: { x: number; y: number; lx: number; ly: number; active: boolean; id: number } | null = null;
onPointerDown: this.drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, active: false, id: e.pointerId };
onPointerMove: // 임계 판정은 x,y 기준 그대로
  this.vp.scrollLeft -= e.clientX - d.lx;
  this.vp.scrollTop  -= e.clientY - d.ly;
  d.lx = e.clientX; d.ly = e.clientY;
```

### M3. 한글 IME 조합 중 Enter

- **위치**: `SearchBox.tsx:85-101` (`onKeyDown`에 `isComposing` 확인 없음)
- **재현** (`repro3.mjs`, CDP `Input.imeSetComposition`으로 조합 상태를 흉내냄): `#/gap`에서 "변압" + 조합 중 "기" 상태로 Enter → keydown `['Enter', isComposing=true]`가 처리되어 `#/?node=n-oil-tr`로 이동함. 조합이 확정되면 검색창에 **"기"가 남음**. macOS Chrome·Safari에서 한글을 입력하는 사용자 흐름 그대로임.
- **수정 제안**:

```ts
const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.nativeEvent.isComposing || e.keyCode === 229) return; // IME 조합 중엔 무시
  …
```

### M4. 화면을 옮겨도 스크롤이 초기화되지 않음

- **위치**: `.app-main { overflow: auto }` (`AppLayout.css:420-422`). 스크롤 컨테이너가 라우트 사이에서 그대로 유지되는데 `AppLayout.tsx`에 초기화 코드가 없음. HashRouter라 `ScrollRestoration`(데이터 라우터 전용)도 쓸 수 없음.
- **재현**: `#/product/P00206`에서 맨 아래까지 스크롤(303/1144) → "같은 기기의 다른 제품" 칩 클릭 → `#/product/P02206`이 **scrollTop 21(새 페이지의 최대값)** 으로 열림. 상단 히어로가 잘린 채 보임 (`t2-scroll-retained.png`). 기기 페이지 → 제품 페이지도 같음 (986 → 42).
- **수정 제안** (`AppLayout`):

```ts
useEffect(() => {
  document.getElementById('main')?.scrollTo({ top: 0, left: 0 });
}, [pathname]);
```

### M5. 계통도로 돌아와도 document.title이 그대로

- **위치**: title을 정하는 곳이 Gap·Learn·Equipment·Product·NotFound뿐이고 `HomePage.tsx`·`DiagramCanvas.tsx`에는 없음
- **재현**: `#/product/P00206`(title "Susol ACB · …") → "계통도에서 위치 보기" → `#/?node=n-acb`에서도 title이 **"Susol ACB · LS ELECTRIC 전력계통 제품맵"**. 탭·히스토리·스크린리더 안내가 실제 화면과 다름.
- **수정 제안**: `DiagramCanvas`에 `useEffect(() => { document.title = 'LS ELECTRIC 전력계통 제품맵'; }, []);`를 넣거나, `AppLayout`에서 pathname별로 기본 title을 정한 뒤 각 페이지가 덮어쓰게 함.

### M6. E2E-1 실패: 교육 투어와 계통도 밴드 계약 불일치

- **위치**: `DiagramToolbar.tsx:96` ("투어 시작"을 누르면 `/learn?step=L1`로 이동), 테스트 `tests/e2e/core-flows.spec.ts:157` (현재 단계 `layer-band-*`가 화면 안에 있다고 가정)
- **현상**: `/learn`에는 계통도가 없어서 `layer-band-L1`을 찾지 못함 → 5초 타임아웃. Tasklist에 "리더 판단"으로 기록된 이슈임.
- **원인**: test-plan E2E-1은 "계통도 위 교육 모드 투어"를 전제로 하고, 구현은 별도 페이지 투어임.
- **수정 제안 (택1, 리더 결정)**: (a) 테스트를 `/learn`의 `tour-step[data-layer]` 검증으로 바꿈. (b) `?mode=learn&step=Lx`일 때 계통도에서 `jumpToLayer(step)`을 호출하는 경량 투어를 추가함 (`useEffect(() => step && getDiagramController()?.jumpToLayer(step), [step])`).

### M7. 칩을 눌러 선택을 바꾸면 포커스가 사라짐

- **위치**: `DetailPanel.tsx:95-106` (연결 기기 칩), `:158-168` (같은 계층 공백 칩), `:131` (관련 보유 기기 버튼)
- **재현**: `#/?node=n-vcb` → 첫 연결 칩에 포커스를 두고 Enter → URL `?node=n-mof`, `document.activeElement === BODY`. 누른 칩은 새 노드의 이웃 목록에서 사라지므로 포커스할 대상이 없어짐. 키보드·스크린리더 사용자는 위치를 잃음.
- **수정 제안**: 선택을 바꾼 뒤 패널 제목으로 포커스를 옮김.

```tsx
const selectFromPanel = (id: string) => {
  selectNode(id);
  requestAnimationFrame(() => document.getElementById('detail-panel-title')?.focus({ preventScroll: true }));
};
// <h2 id="detail-panel-title" tabIndex={-1} …>, NeighborChips/GapSections 의 onSelect 에 selectFromPanel 전달
```

### M8. 투어 마지막 단계(L7)를 "다음"으로 완료할 수 없음

- **위치**: `LearnPage.tsx:92-95` (`next()`만 `markDone`을 호출), `:327` (마지막 단계에서는 `disabled`)
- **현상**: L1~L6은 "다음"으로 완료 처리되지만 L7은 퀴즈를 모두 풀어야만 완료됨. 그래서 "7개 계층 중 6개 완료"에서 멈출 수 있음.
- **수정 제안**: 마지막 단계 버튼을 "투어 완료"로 활성화함.

```tsx
<button … disabled={false} onClick={nextStep ? onNext : onFinish}>
  {nextStep ? `다음: ${nextStep.shortLabel} →` : '투어 완료 ✓'}
</button>
// onFinish = () => { markDone(step.layer); setTouring(false); }
```
  (test-plan `tour-next` 마지막 단계 disabled 규칙과 충돌하므로 T3와 합의가 필요함)

---

## 3. 낮음

| ID | 내용 | 위치 | 재현/근거 | 수정 제안 |
|---|---|---|---|---|
| L1 | 다른 화면에서 검색으로 기기를 고르면 포커스가 노드로 가지 않고 input에 남음 | `SearchBox.tsx:77-79` | `#/gap`에서 VCB Enter → activeElement=INPUT. `#/`에서는 정상(n-vcb). **가설** (가) rAF가 RR v7 startTransition 커밋보다 먼저 실행되어 DiagramCanvas가 아직 없음 → `/` 대비 실험으로 **채택**. (나) input onBlur가 포커스를 되돌림 → `/`에서는 정상이므로 기각 | `navigate(…, { state: { focusNode: id } })`로 넘기고 DiagramCanvas의 layout effect에서 포커스한 뒤 state 제거 |
| L2 | 히스토리 정책 불일치: 노드 클릭은 `replace`, 검색 선택은 `push` | `url.ts:34-48` vs `SearchBox.tsx:76` | history.length 11 → 노드 클릭 11 → 검색 12. 뒤로가기 동작이 경로마다 다름 | `/`에 있을 때는 검색도 `{ replace: true }`, 또는 둘 다 push로 통일 (팀 결정) |
| L3 | `/learn?step=L9`처럼 없는 값이 URL에 그대로 남음. URL로 들어온 단계는 `lastStep`에 저장되지 않음 | `LearnPage.tsx:58-67` | 화면은 L1(lastStep)을 보여 주는데 URL은 L9 | `useEffect(() => { if (paramStep !== steps[stepIdx].layer) setParams({ step: steps[stepIdx].layer }, { replace: true }); }, [stepIdx])` |
| L4 | 검색: 한 글자 질의에 잡음 결과(`a` → 기기 6건). 모델명(GIPAM·Susol·XGT)으로 기기가 나오지 않음. "변압기"·"인버터"·"태양광" 검색 시 제품 0건 | `SearchBox.tsx:17-39` | `fuse.mjs` | `minMatchCharLength: 2`. 기기 인덱스에 `productNames`(resolveProducts 결과 이름) 키 추가(weight 1) |
| L5 | 이미지 로드 실패 시 대체 표시 없음 (깨진 이미지 아이콘) | `DiagramNode.tsx:53-62`, `DetailPanel.tsx:36`, `EquipmentVisual.tsx:19` | 현재 59개 파일 모두 dist에 있고 대소문자 일치(Pages 대소문자 구분 대비 확인)라 잠재 이슈 | `onError={() => setFailed(true)}` → `EquipmentSymbol` 렌더 |
| L6 | 보유(owned) 기기 `pcs`의 gapNote에 "공백 메모" 라벨이 붙음. affiliate 기기(transmission-line·dist-line)는 계열사 문구가 두 번 나옴 | `DetailPanel.tsx:272-283, 64-65` | `data.mjs`: gapNote가 있는 비공백 기기 = pcs:owned | 라벨: `coverage==='partial' ? '일부 보유 메모' : coverage==='missing' ? '공백 메모' : '메모'`. affiliate이고 제품 0개면 상단 `dp-affiliate` 생략 |
| L7 | 기능 분류 라벨이 화면마다 다름: 패널 "변압·변성/발전·저장/설비 시스템" vs 기기·공백 표 "변성/발전/시스템" | `model.ts:19-30` vs `catalog.ts:18-29` | 같은 기기가 화면에 따라 다른 분류명으로 보임 | 한 곳(`schema.ts` 등)에 `CATEGORY_LABELS` 하나만 두고 import |
| L8 | CSV 수식 주입 방지 없음 (`=`, `+`, `-`, `@`로 시작하는 셀) | `catalog.ts:203-205` | 쉼표·따옴표·줄바꿈 escape는 정상(검토 확인). 데이터가 내부 파일이라 위험은 낮음 | `const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;` 후 기존 escape 적용 |
| L9 | store의 `selectedNodeId`·`viewMode` 사본을 읽는 곳이 없음 (주석 "Phase 2 에서 옮길 예정"도 낡음). 또 `useSetViewMode`가 렌더 시점 `search`로 URL을 만들기 때문에, 노드 선택 전환(startTransition)이 끝나기 전에 모드를 바꾸면 node가 빠질 수 있음 (코드상 가설, 사람 손으로 재현하기 어려운 타이밍) | `useAppStore.ts:7-9`, `AppLayout.tsx:15-28`, `url.ts:51-64` | grep 결과 store의 해당 필드 소비처 0 | 사본과 동기화 effect 제거. `useSetViewMode`는 `setSearchParams(prev => …)` 함수형으로 바꿔 최신 URL 기준으로 계산 |
| L10 | 핀치 중 두 손가락 중점이 이동해도 패닝되지 않음. 네이티브 스크롤바를 마우스로 끌면 커스텀 드래그와 겹침 | `panzoom.ts:256-271, 212-215` | 코드 검토 | 핀치 시작 중점을 저장해 `scrollLeft -= Δmid`. `onPointerDown`에서 `e.offsetX > vp.clientWidth`(스크롤바 영역)이면 무시 |
| L11 | 번들 단일 710 kB. 사진 59장 합계 10 MB(평균 170 kB, 72px 타일에 원본 PNG 사용) | build 출력, `public/images` | build 경고 | 데이터 JSON을 동적 import로 분리하고 페이지 단위 `lazy()`. 사진은 144px WebP 썸네일 생성 (T4) |
| L12 | 미니맵이 마우스 클릭 전용 (키보드·스크린리더 접근 불가, `div onClick`) | `Minimap.tsx:26` | | 장식(`aria-hidden`)으로 명시하거나 버튼과 키보드 이동 제공 |
| L13 | "공백" 정의 불일치: 좌측 내비·계통도 = 미보유+일부(15). 공백 표 "공백 목록" 범위 = 미보유+일부+계열사(17) | `model.ts:92`, `catalog.ts:180` | 화면마다 공백 개수가 다르게 읽힘 | 공백 표 범위 이름을 "검토 대상"으로 바꾸거나 정의를 한쪽으로 통일 (PLAN 용어 확인) |
| L14 | localStorage의 `answers` 값 타입을 검증하지 않음 (문자열 값도 "응답함"으로 집계) | `LearnPage.tsx:32` | 수동 편집·버전 변경 시 | `Object.fromEntries(Object.entries(p.answers).filter(([, v]) => Number.isInteger(v)))` |

---

## 4. 점검했지만 문제없음 (회귀 기준)

- **URL**: `?node=없는값`이면 패널이 닫히고 오류 없음. `?mode=GAP` 같은 잘못된 값은 product 모드. `?mode=gap&node=` 조합 복원, 새로고침, 뒤로가기 정상 (E2E 통과). `/` 밖에서는 `useSelectedNodeId`가 null.
- **줌 경계**: 축소 하한 15%(전체 맞춤 배율의 80%), 확대 상한 200%. "전체 보기"는 19.4%이고 74개 노드가 모두 뷰포트 안 (`t2-fitall.png`).
- **리사이즈**: 1440→1100→1440으로 바꿔도 화면 중심(465, 891) 유지.
- **모바일 시트**: 탭·칩·딥링크 모두 노드가 시트 위쪽(node bottom 390 < sheet top 456)에 보임. "시트 애니메이션 중에 위치를 재서 틀어진다"는 가설은 50ms·650ms 측정값이 같아서 기각 (`t2-mobile-*.png`).
- **다크모드**: Gap 모드에서 색 구분 정상 (`t2-dark-gap.png`), axe 대비 E2E 통과.
- **정리(cleanup)**: PanZoom `destroy()`가 리스너·ResizeObserver·rAF를 모두 해제함. IO는 `disconnect()`. Esc 리스너와 `useMediaQuery` cleanup 있음. StrictMode에서 두 번 마운트돼도 컨트롤러가 다시 등록됨. 노드·엣지·밴드는 memo라 줌·패닝 중 리렌더 없음 (Minimap·툴바만 viewStore 구독).
- **learn.json 참조**: keyEquipmentIds·sourceEquipmentIds·glossary equipmentId 모두 존재하고, 핵심 기기 계층이 단계와 일치함. 퀴즈 id·보기·용어 중복 없음.
- **localStorage 차단**(getter가 throw): /learn이 렌더되고 퀴즈 응답도 됨, pageerror 0.
- **대표 기기 선택**: 여러 기기에 매핑된 제품 12개(예: P01072 → relay-tx/protection-relay)는 coverage → 대표사진 → productIds 순으로 정렬. 구간 점수 최대 3 < 4라 순위가 섞이지 않음.
- **docs.json**: 199개 제품, URL 파싱 오류 0, 같은 제품 안 URL 중복 0 (DocsList `key={d.url}` 안전).
- **GitHub Pages**: `base './'` + HashRouter. 이미지는 `${BASE_URL}images/…` = `./images/…`라 문서 기준 상대 경로. dist에 59개 포함, 파일명 대소문자 일치. 404.html은 해시 라우팅이라 필요 없음.
