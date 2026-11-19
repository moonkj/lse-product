# 계통도 색·디자인 고도화 — 구현 분담 (2026-11-19)

근거: docs/personas-diagram/round1/e1-color.md · e2-layout.md · e3-tile.md · e4-line-motion.md · e5-brand.md (각 문서의 수치를 그대로 쓴다). 사용자: "계통도 색상 및 디자인 고도화 진행", "계통도 폭 자체가 좁음".

## 공통 규칙
- 저장소 /Users/kjmoon/LSE_News. 자기 담당 파일만 수정. 커밋 금지(리더가 함).
- 검증: `export PATH=$HOME/.local/bin:$PATH && npm run typecheck && npx vitest run` 까지. 빌드·E2E는 돌리지 않음(리더가 통합 후). 관련 E2E 파일 수정은 가능.
- 교육용 요소 금지. 색은 tokens.css 토큰(라이트·다크 둘 다).

## F1 — 폭·레이아웃 (데이터·보기)  [E2 P0·P1, E5 P0 시트 틀]
- 파일: src/data/diagram.json, src/lib/diagram/*(model.ts·panzoom.ts·view.ts 필요한 만큼), src/components/diagram/DiagramToolbar.tsx(폭 맞춤 버튼만), DiagramCanvas.tsx(초기 보기·시트 틀 래퍼·controller만 — Bands/Edges/FocusOverlay 함수 본문은 F2 몫이라 건드리지 않음), tests
1. **주 계층(L1~L7) x 좌표 ×1.3** — 기준점은 주 계층 영역 왼쪽 끝. 노드 x, 직접 지정한 연결선 points x, 계층 사각형(layers 폭)·diagram.width 를 함께 조정. 감시·신재생 열은 오른쪽으로 평행이동하고 폭을 551→700으로(3열 가능하게, 타일 x도 비례). 변환 스크립트를 scratchpad에 남기고, 무결성 테스트(data-integrity, router 겹침 검사 등) 통과 확인. 연결선 경로(router)가 다시 계산되는지 확인.
2. **밴드 여백 줄이기**는 위험(중)이라 이번에는 하지 않음.
3. **"폭 맞춤" 버튼**: 도구줄 '전체 보기' 옆. 계통도 폭이 화면 폭에 맞도록 배율(세로는 위쪽부터). controller 에 fitWidth 추가. 데스크톱 처음 화면은 지금처럼 L4 확대 유지.
4. **도면 시트 틀(E5 P0)**: 캔버스 바탕 --color-bg, 계통도 전체(diagram__inner 영역)를 surface 바탕 + 1px --color-border + 모서리 12 + --shadow-sm 으로 감싸고 안쪽 여백 16px. 그림이 화면보다 좁으면 가운데 정렬(E2 P1). 범례가 그림 아래를 가리지 않게 시트 아래 여백 72px.

## F2 — 색·타일·선·범례 (시각)  [E1 P0·P1, E3 P0·P1, E4 P0·P1 일부, E5 P0·P1]
- 파일: src/styles/tokens.css, src/components/diagram/DiagramCanvas.css(.dtool·.dprint 제외), DiagramNode.tsx, DiagramExtras.tsx, DiagramLegend.tsx, flow.css, FlowLayer.tsx, src/components/common/EquipmentSymbol.tsx, src/components/common/CoverageBadge.css, DiagramCanvas.tsx의 Bands·Edges·FocusOverlay 함수 본문만
1. **밴드 명도 램프(E1 P0)**: e1-color.md 표의 새 9색(라이트·다크). 강조색 --band-accent-* 도 새 밴드와 어울리게 확인.
2. **흐름(E1 P0·E4 P0)**: 흰 바탕선 `--flow-casing`(흐름 경로 아래, 트랙보다 2px 넓게) + 트랙 #8fbbe3(라이트), 다크 트랙 #2f5f8f. 빛 번짐은 그룹 하나에 filter(성능), `?flow=1`(전체)일 때는 번짐 끔. 상류·하류 색 구분은 하지 않음(선택색과 충돌).
3. **선택색(E1 P0)**: 선택 타일 링·선택 연결선 = 라이트 #00337f(CI 네이비), 다크 #f2f4f7 — 새 토큰 --color-node-selected-ring 등으로 흐름 블루와 분리(사이드바·칩 등 다른 곳의 --color-selected 는 그대로).
4. **모선(E4 P1)**: 네이비 #00337f(다크 #b0ccfa) 5px. 모선 라벨 13px.
5. **타일(E3 P0·P1·E5 P1)**: 커버리지 배지를 타일 **안쪽** 위·오른쪽 4px로(밴드 경계를 넘지 않게 — 사용자가 여러 번 지적한 겹침), ✓ 16px · ✕◐ 18px. 사진 판 108×60 가로형(라이트 판 #F3F5F8, 다크 #E9EDF2 + 테두리). 제목 14px/700, 부제 12px 두 줄. 타일 모서리 8px(--radius-tile). 미보유는 판 바탕 옅은 빨강 + 테두리 1.5~2px, 일부 보유는 판 하단 4px 황색 띠(+ 기존 황색 테두리 유지). 참조 타일은 이중선 + ↗ 원형 칩. 선택 타일 2px 들림. MOF·CT/PT·WHM 심볼 구분(MOF와 CT/PT가 지금 같음), 심볼 선 3px. 택1 칩 13px. 끝점(endpoint)은 실선 + "→".
6. **색각(E1 P1)**: 패널 구성품 색 → 자홍 #8e3a9e, 미보유 #c62d1f·일부 보유 #b58300 명도 간격, 해당 없음 속 빈 배지.
7. **범례 카드(E5 P0)**: 불투명 바탕, 모서리 12, --shadow-md, 높이 40px, 아이콘 16px, 끝의 뜻 없는 '▾' 제거(선 종류 토글만 남김).
8. **선 굵기(E4 P1·E5)**: 전력선 2px 유지하되 초고압(L1~L2) 2.5px, 저압(L6~L7) 1.5px — 엣지에 계층 정보가 없으면 from 노드 계층으로 판단(model 에서 계산해 data 속성 부여, Edges 함수 안에서).
