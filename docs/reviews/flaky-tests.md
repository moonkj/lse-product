# 간헐 실패 테스트 조사 (T2 디버깅, 기준 커밋 ac9a202)

2026-11-18. 대상은 unit 1건과 E2E 2건이다. 데이터 파일(src/data/*.json)은 건드리지 않았다.
임시 로그는 scratchpad/flaky/ 에 두었다.

## 1. unit — `admin-specs.test.ts > UT-16 specsStore > 저장본 손상 → 무시하고 원본으로`

- **재현율**: 수정 전 `npx vitest run` 20회 중 2회 실패(10%)했다. 두 번 모두 이 테스트였고 메시지는 같았다.
  `expected { generatedAt: 'g59', … } to deeply equal { … }`
- **원인**: 테스트 사이에 공유 상태가 새어 나갔다.
  - `specsStore.ts` 의 자동 저장 타이머(300ms, 모듈 전역 `setTimeout`)는 `vi.resetModules()` 로 모듈을 새로 불러와도 이전 인스턴스의 것이 그대로 살아 있다.
  - 앞 테스트 "commit·undo·redo … 기록 50단계"는 실제 타이머로 돌았다. 그래서 마지막 commit(`generatedAt: 'g59'`)이 300ms 뒤 localStorage 에 초안을 썼다.
  - 그 시점이 다음 테스트의 `freshStore(bad)` → `load()`(동적 import를 await 하는 동안)와 겹치면, `readSaved()` 가 손상본 대신 g59 초안을 읽는다.
  - "저장본 복원" 테스트의 `resetToBase()` 도 같은 경로로 실제 타이머를 남긴다.
  - 앞서 "기록하지 못한 1건"도 같은 테스트로 보인다. 20회 반복에서 다른 테스트는 실패하지 않았다.
- **수정** (테스트만 고침, `tests/unit/lib/admin-specs.test.ts`)
  - `UT-16 specsStore` describe 전체를 가짜 타이머로 돌린다(`beforeEach: vi.useFakeTimers()`).
  - `afterEach` 에서 `vi.clearAllTimers()` 로 남은 자동 저장 타이머를 실행하지 않고 버린 뒤 `vi.useRealTimers()` 로 되돌린다.
  - 자동 저장 테스트 안에 있던 개별 `vi.useFakeTimers()` 는 필요 없어져 지웠다.
- **수정 후**: `npx vitest run` 20회 모두 통과했다(508/508). 0회 실패.
- **참고(별건, 수정 안 함)**: `--sequence.shuffle` 로 돌리면 아래 메타 테스트가 매번 실패한다.
  - 대상: `integrity.test.ts > UT-10 RULES 표 ↔ 실제 보고 등급`(3건), `data-integrity.test.ts > DI-SPEC-RULES 메타`
  - 이 테스트들은 앞서 실행한 시나리오의 결과를 모아 검사하도록 일부러 순서에 의존한다(이름에 "DI-90b 이후 실행", "지금까지"라고 적혀 있다).
  - 기본 실행 순서에서는 실패하지 않는다. 간헐 실패와는 관계없으므로 그대로 두었다.
  - 셔플을 쓰려면 이 파일들의 집계 방식을 바꿔야 한다.

## 2. E2E — `core-flows.spec.ts` "키보드만으로 노드 선택(Enter) → 패널 열림 → Esc …"

- **재현율**: 수정 전 실행 조건별 결과는 다음과 같다.
  - `--repeat-each=10`: workers 1 → 0/10, workers 4 → 2/10, workers 8 → 3/10 실패
  - `--repeat-each=40 --workers=8`: 1/40 실패
  - CPU 6배 감속(CDP): 2/40 실패
  - 증상은 `Esc` 를 눌러도 `detail-panel` 이 계속 보인다는 것이다(`toBeHidden` 시간 초과).
- **원인**: 앱 쪽 경쟁 조건이다.
  - `DetailPanel` 은 Esc 리스너를 `useEffect` 에서 document 에 등록했다.
  - 선택은 URL(`?node=`) 갱신으로 그려진다. 그래서 패널이 DOM 에 붙는 커밋보다 passive effect 가 나중 작업으로 밀릴 수 있다.
  - Playwright 는 패널이 보이자마자 Esc 를 누르므로, 리스너가 등록되기 전에 키가 도착하면 무시된다.
  - 느린 기기에서 실제 사용자가 빠르게 Enter→Esc 를 눌러도 같은 일이 생길 수 있다.
- **수정** (앱 최소 수정, `src/components/panel/DetailPanel.tsx`)
  - Esc 리스너 등록을 `useEffect` 에서 `useLayoutEffect` 로 바꿨다. 이제 패널이 DOM 에 붙는 커밋과 같은 시점에 등록된다.
  - 화면 동작과 배치는 바뀌지 않는다.
- **수정 후** (재빌드 뒤 확인)
  - `--repeat-each=10` 을 workers 1/4/8 로 돌려 모두 통과했다.
  - `--repeat-each=40 --workers=8`: 40/40 통과
  - CPU 6배 감속: 40/40 통과

## 3. E2E — `ux-diagram.spec.ts:260` "접힌 시트 요약 390×844 › 보이는 버튼은 모두 화면·시트 안에 온전히…"

- **재현율**: 기본 실행에서는 재현하지 못했다.
  - 시도: repeat 10~30, workers 1~12, 세 파일 동시 실행(296건), CPU 20배 감속에서 모두 0회 실패.
  - 위험 조건은 탐침 스펙으로 직접 확인했다. 해시 이동 뒤 측정하는 시점에 `--sheet-h` 와 패널 실측 높이가 어긋난 경우가 있었다.
    - 10회 × 24회 이동 중 10회 중 8회의 실행에서 1~5번 어긋났다(이동의 약 6%).
  - 높이 차가 클 때만 `trayBottom ≤ panelTop` / `panelTop - trayBottom < 16` 이 깨지므로 실패는 드물다.
- **원인**: 테스트가 레이아웃이 안정되기 전에 측정했다. 측정 시점 문제가 두 가지였다.
  1. 두 번째 기기부터는 `page.goto('./#/?node=…')` 가 같은 문서 안의 해시 이동이다.
     - 그래서 직전 기기의 패널이 그대로 있는 동안에도 앞선 assert(`data-sheet`, 제목 보임 등)가 곧바로 통과한다.
     - 결국 어느 기기의 패널을 재는지 보장되지 않았다.
  2. 비교 바 위치는 `ResizeObserver` 가 넣는 `--sheet-h` 를 따른다.
     - 패널 높이가 바뀐 직후, 다음 렌더링 프레임 전에 `page.evaluate` 로 재면 비교 바는 이전 높이 기준에 머물러 있다.
     - 높이가 바뀌는 계기는 내용 교체와 사진 로드다.
     - 실제 화면에서는 RO 콜백이 그리기 전에 돌아 어긋남이 보이지 않는다. 따라서 앱 문제가 아니다.
- **수정** (테스트만 고침, `tests/e2e/ux-diagram.spec.ts`)
  - 기기마다 `detail-title` 이 그 기기 이름을 담을 때까지 기다린다(`toContainText(c.eq.name)`).
  - `--sheet-h` 가 `ceil(패널 실측 높이)px` 와 같아질 때까지 `expect.poll` 로 기다린 뒤 잰다.
  - 임의의 sleep 은 쓰지 않았다.
- **수정 후**
  - `--repeat-each=10` 을 workers 1/4/8 로 돌려 모두 통과했다. 390·360 두 크기 모두다.
  - CPU 20배 감속, repeat 15, workers 10: 30/30 통과
  - ux-diagram·core-flows 파일 전체(54건)도 통과했다.

## 바꾼 파일

- `tests/unit/lib/admin-specs.test.ts`: specsStore describe 를 가짜 타이머로 격리하고, 남은 타이머를 정리한다.
- `src/components/panel/DetailPanel.tsx`: Esc 리스너를 `useLayoutEffect` 로 등록한다.
- `tests/e2e/ux-diagram.spec.ts`: 접힌 시트 측정 전에 대상 기기 반영과 `--sheet-h` 동기화를 기다린다.

`dist` 는 DetailPanel 수정을 반영해 재빌드했다. 4173 미리보기 서버가 새 번들을 그대로 제공하는 것도 확인했다.
