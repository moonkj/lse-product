# 계통도 색상·디자인 고도화 — 디자이너 5인 (2026-11-19)

## 사용자 요청
"UX/UI 디자이너 페르소나 5명 추가해서 계통도에 대한 색상 및 디자인 고도화 진행"

## 최근 사용자 피드백 (계통도)
- 흐름 애니메이션이 아주 자세히 봐야 보임 → D2 재검토로 연한 트랙 + 진한 펄스로 바꿈(docs/personas-design/round3/d2-color-review.md)
- 영역(계층 밴드) 색이 없어짐 → 2톤을 9색으로 되돌리고 채도를 한 단계 올림
- 선택 영역 강조가 모두 파란색 → 영역 고유색(--band-accent-*)으로 바꿈
- 선택 영역 테두리가 타일의 ✓ 배지와 겹침 → 테두리 대신 영역 배경·왼쪽 띠로 바꿈
- 계층 이름표가 너무 작음 → 2.2배(28px)로 키우고, 첫 타일 앞까지로 폭 제한
- 흐름이 검은 모선 아래로 지나감 → 흐름을 모선 위로 올림
- **"전체 디자인이 계통도 폭 자체가 좀 좁게 되어 있음"** (가장 최근, 아직 처리 안 함 — 계통도가 세로로 길고 좁아 넓은 화면에서 양옆이 빔: shots/01, 10)

## 현재 화면 (docs/personas-diagram/shots/)
01 전체 보기(1440) · 02 L1 · 03 L4 · 04 L6 ACB 선택 + 흐름 · 05 L7 · 06 신재생 · 07 공백만 보기 · 08 다크 모드 · 09 휴대폰 · 10 1920 와이드 전체 보기

## 코드 (읽기만)
- 계통도 좌표·크기: src/data/diagram.json(width 2320 × height 4398, 노드 x·y), src/lib/diagram/model.ts·geometry.ts(타일 120×116)·router.ts(연결선 경로)
- 그리기: src/components/diagram/DiagramCanvas.tsx·.css, DiagramNode.tsx, DiagramExtras.tsx, FlowLayer.tsx·flow.css, DiagramLegend.tsx, Minimap.tsx
- 토큰: src/styles/tokens.css (밴드 --band-l1~mon, 강조 --band-accent-*, 흐름 --flow-*, 커버리지 --cov-*)
- 이전 토론: docs/personas-design/DEBATE.md(화면 구성 합의안 — 이미 구현됨)

## 규칙
- 코드·데이터 수정 금지. 자기 의견 파일 하나만.
- 제안은 바로 적용할 수 있게 구체적으로: 토큰 이름과 hex 값(라이트·다크 둘 다), px, 배치 수치, 어느 파일의 무엇을.
- 교육용 요소 금지. CI: 네이비 #00337F · 블루 #0068B7 · 레드 #E60033(헤더 하단선 전용).
- 우선순위 P0/P1/P2.
