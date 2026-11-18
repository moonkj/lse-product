# 화면 디자인 v1 (Claude Design 캔버스 원본)

- 캔버스: https://claude.ai/artifact/XgmHTuJ1sShBrWEr1Ccfb4 (비공개, Share 메뉴로 공유)
- 이 폴더는 구현 참고용 사본. 이미지 경로 `/_blob/...`는 캔버스 업로드본이며, 앱에서는 `public/images/equipment/<기기id>.png` 를 사용
- 화면: Main(제품 보기·L4~L5 확대) · Gap(강조 모드) · Product(XGIPAM) · GapTable(공백 표) · Learn(투어) · Mobile(하단 시트)

## 구현 규칙 요약
- 기기 노드 = 사진 타일 120×116 (사진 72px + 약어 + 이름), 테두리 색 + 우상단 배지(✓◐◆✕–)로 커버리지 표시
- 미보유: 사진 대신 단선결선도 심볼 + 빨간 점선 테두리 + "자사 제품 없음"
- 전력선 2px 실선 / 신호선 1.5px 점선 / 모선 4px / 선택 경로 파란 3px
- Gap 모드: 보유·해당없음 opacity 0.3, 미보유·일부 보유 배경색 + 외곽 글로우, 선 전체 opacity 0.3
- 수배전반 등 system 기기는 점선 그룹 박스 + 사진 라벨
