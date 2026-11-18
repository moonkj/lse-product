# LS ELECTRIC 전력계통 제품맵

전력계통도(L1 초고압 765/345kV → L7 분전반 하단 + 신재생·감시) 위에 LS ELECTRIC 제품을 사진 타일로 매핑하고,
공백(Gap)과 데이터시트·매뉴얼을 한눈에 보며 신입 교육에 쓰는 웹 포털입니다. (Vite + React + TypeScript, GitHub Pages)

## 실행
```bash
npm install
npm run dev          # 개발 서버
npm run build        # 배포용 빌드 (dist/)
npm run test         # 데이터 무결성 + 컴포넌트 테스트 (Vitest)
npm run test:e2e     # 화면 시나리오 테스트 (Playwright)
```

## 화면
| 주소 | 내용 |
|---|---|
| `/#/` | 메인 계통도 (`?node=<노드id>` 선택 공유, `?mode=gap` 공백 강조) |
| `/#/equipment/:id`, `/#/product/:id` | 기기·제품 상세 (자료 링크) |
| `/#/gap` | 공백 표 (계층 × 기능 매트릭스, CSV) |
| `/#/learn` | 계통 따라가기 투어, 용어집 |
| `/#/admin` | 관리자 모드 (기기 추가·배치·연결 → JSON 내보내기). 일반 화면에 링크 없음, 보안 장치 아님 |

## 데이터 — 무엇이 원본인가
| 파일 | 원본 / 생성 방법 |
|---|---|
| `src/data/equipment-types.json`, `src/data/diagram.json` | **원본.** 관리자 모드에서 편집 후 내보낸 파일로 덮어씀 |
| `src/data/products.json`, `categories.json` | `npm run fetch:products` (공식 사이트 메뉴) |
| `src/data/docs.json` | `npm run fetch:docs` (공식 자료실 공개 API, 요청 간 1.1초) |
| `src/data/equipment-images.json` + `public/images/equipment/` | `node scripts/fetch-images.mjs` 후 320px·160px 축소 (스크립트 상단 주석) |
| `src/content/learn.json` | 교육 투어 콘텐츠 (초안, 교육 담당 검토 필요) |

> ⚠️ `scripts/build-diagram-data.py` 는 최초 데이터를 만든 **시드 생성기(동결)**입니다. `--force` 없이는 실행되지 않으며, 실행하면 관리자 모드로 편집해 커밋한 내용이 덮어써집니다.

### 관리자 모드로 계통도 바꾸기
1. `/#/admin` 에서 편집 (초안은 그 브라우저에 자동 저장)
2. **검사 후 내보내기** → 무결성 검사(스키마·참조·타일 겹침·연결선 관통 등) 통과 시 파일 다운로드
3. 받은 `equipment-types.json`, `diagram.json` (사진을 바꿨다면 `equipment-images.json`) 을 `src/data/` 에 덮어쓰기
4. `npm run test:data` 통과 확인 → 함께 받은 `변경요약.md` 를 커밋 메시지로 커밋

## 문서
- 기획·결정: `PLAN.md`, 진행 기록: `process.md`, 공유 보드: `Tasklist.md`
- 화면 디자인: `docs/design/`, 테스트 계획: `docs/test-plan.md`, 리뷰: `docs/reviews/`
- 페르소나 토론: `docs/personas/DEBATE.md`
