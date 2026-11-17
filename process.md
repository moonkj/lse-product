# process.md — 구현 진행 기록 (팀리더 관리)

## 2026-11-18 · Phase 0 (계획)
- 요구사항 분석 및 PLAN.md(UX 설계 + 설계 요약 + 팀 운영안) 작성
- Tasklist.md 공유 보드 생성
- 환경 점검: git·python3 있음 / node·tmux·gh 없음 → 설치 필요
- 다음 단계: 사용자 결정 사항 회신 후 Phase 0 스캐폴딩 착수
- [결정] 계통도 범위 확정: 초고압(765/345kV) → 154kV 송변전 → 22.9kV 배전·수전 → 변압 → 저압 배전 → 분전반 하단(L1~L7) + 신재생 연계 + 감시
  - 영향: 데이터 모델 layer 필드 L1~L7로 변경, 계통도 크기 증가 → 미니맵·계층 점프 내비게이션 추가
- [결정] 데이터 출처: LS ELECTRIC 공식 사이트 (ls-electric.com/ko/download, ssq.ls-electric.com dlcenter). 연계/공통 제품 보유 확인
  - 조사: 사이트 메뉴 스크립트(/ko/common/js/site/menu)에 제품 트리 전체가 JSON으로 들어 있음 → 343항목 추출
  - 두 자료실은 JS(AngularJS 등)로 목록을 불러옴 → Phase 1에서 데이터 API 주소 파악 필요
  - 방침: PDF는 다시 올리지 않고 공식 자료실로 링크
  - 산출물: docs/research/lse-product-tree.txt, docs/research/product-mapping.md (공백 후보 11개)
- [결정] 상태 5종(보유/일부/계열사 보유/미보유/해당없음), 배포=GitHub Pages(HashRouter), 저장소=로컬 git 우선
- [환경] node v26.13.1 LTS + gh 2.104.0 → ~/.local/bin 설치 (SHA256 검증), ~/.zshrc PATH 추가. tmux는 Homebrew 부재로 보류
- [git] 저장소 초기화 및 계획 문서 첫 커밋
