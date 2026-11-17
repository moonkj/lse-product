# 자료실 데이터 API 조사 (T2)

조사일: 2026-11-18 · 도구: curl, python3 -I, Node 내장 fetch · UA `LSE-ProductMap/0.1` · 요청 간격 1초 이상, 총 요청 약 90건
프로토타입: `scripts/probe-downloads.mjs`

## 요약

| 자료실 | 대상 제품 | 목록 API | 파일 URL | 인증/캡차 |
|---|---|---|---|---|
| www.ls-electric.com/ko/download | 전력 기기(AAA…) | `GET /ko/api/download.ashx?t=list` (+ `t=file_list`) | `https://www.ls-electric.com` + `df_path` (예 `/ko/cat/…pdf`) | 필요 없음. **Referer 헤더는 필수** |
| ssq.ls-electric.com (Solution Square) | 자동화 기기(BBB…: PLC·인버터·서보·HMI) | `GET /api/guest/zdata/ssqdoc/dlCenter` | `/uploads/{fileKey}/{fileName}` 또는 대용량 파일은 CDN URL | 공개 문서(displayTarget=0)는 필요 없음. 10/15/20은 로그인 필요 |

- 두 사이트를 잇는 키는 **www 제품 페이지의 `#hd_entity.p_ssq_link`**. 자동화 제품은 여기에 `…/product/category/{ssq 카테고리 ID}` 가 들어 있다(iS7 → 200).
- www 자료실 다운로드 페이지는 국문에서 `BBB`(자동화)를 숨긴다. 실제로 iS7(BBB005018, P01188)을 www API로 조회하면 0건이다. 자동화 제품 자료는 ssq에서만 받을 수 있다.

## robots.txt

- `www.ls-electric.com/robots.txt`: `Allow: /`. 막힌 경로는 `/ko/upload/`, `/ko/dl/`, `/@mgt`, `/education/data/`, `/ko/@mgt`, `/ko/education/data/`. 자료 파일 경로 `/ko/cat/`, `/ko/certi/`와 `/ko/api/`는 막혀 있지 않다.
- `ssq.ls-electric.com/robots.txt`: `Allow: /`. 막힌 경로는 `/borisPage`(관리자 화면)뿐이다. `sol.ls-electric.com/robots.txt`도 내용이 같다.
- `/ko/upload/`(제품 썸네일 이미지 경로)는 Disallow라서 수집하지 않는다.

---

## 1. www.ls-electric.com 다운로드 자료실

### 구조
- `/ko/download/` 페이지는 `ng-controller="defaultCtrl"`이다. 컨트롤러는 **같은 폴더의 `default.js?v=0108`** 이다(`/ko/download/default.js`). 처음 지목된 `angular-app.js`에는 공통 설정(POST를 form-urlencoded로 보내는 설정, 팝업 등)만 있고 자료실 API는 없다.
- 문서 유형, 인증서 종류, 인증서 시리즈 목록은 HTML 안의 hidden input(`#hd_category`, `#hd_certi_category`, `#hd_certi_sr_category`)에 JSON으로 들어 있다.
- 카테고리 트리(`_product`)는 `/ko/common/js/site/menu?v=…` 에서 온다. T1의 `fetch-products.mjs`가 쓰는 소스와 같다. 키 형식은 `products_{c_code}_{p_code}` 이다.

### 엔드포인트 (모두 GET, 응답 `{"success":true,"data":[…]}`)

> **Referer 필수**: `Referer: https://www.ls-electric.com/ko/download/` 가 없으면 HTTP 200에 본문 0바이트가 온다(실측). 응답 헤더 `Access-Control-Allow-Origin: https://e-portal.ls-electric.com` 때문에 **우리 앱이 브라우저에서 직접 호출할 수 없다(CORS)**. 빌드할 때 서버에서 수집해야 한다.

| t= | 용도 | 파라미터 |
|---|---|---|
| `list` | 자료 목록 (페이지) | `page`, `rowsPerPage`, `k_word`, `dc_id`(문서유형, 콤마로 여러 개), `c_code`(카테고리, 접두어 매칭), `p_code`(제품), `cur_lang`(ar,cn,de,en,es,fr,ir,it,jp,ko,pl,ru,tr,vn), `certi_type`, `certi_sr` |
| `file_list` | 문서 1건의 첨부파일 | `d_id` |
| `list_by_product_page` | 제품 페이지 다운로드 탭에서 씀 | `page`, `rowsPerPage`, `d_c_code`, `d_p_code`, `d_dc_id`, `cur_lang`, `certi_type`, `certi_sr` |
| `categories` | 문서유형별 개수 | list_by_product_page와 같음 |
| `certi` | 인증서 시리즈/종류 필터 값 | list와 같음 |
| `hits` | 다운로드 횟수 기록 | **호출 금지** (통계를 오염시킴) |
| `/ko/api/keyword.ashx?t=list&type=download` | 추천 검색어 | |

호출 예:
```
GET https://www.ls-electric.com/ko/api/download.ashx?t=list&page=1&rowsPerPage=50&c_code=AAA015001&p_code=P01062
Referer: https://www.ls-electric.com/ko/download/
```
응답 `data[]` 항목 샘플 (`t=list`):
```json
{"rownum":6,"total":221,"d_id":419059,"d_c_code":"AAA015001","d_p_code":"P01062","d_dc_id":"1",
 "d_title":"[Susol VCB] for Generator","d_content":"","d_hits":505,
 "d_regdate":"2026/10/29 00:00:00","d_moddate":"2026/10/29 00:00:00","d_lang":"ko",
 "d_file_lang":"한국어","d_dc_name":"카탈로그","c_depth2_name":"고압기기(MV)","c_depth3_name":"진공차단기 (VCB)","p_status":""}
```
`total`은 각 행에 들어 있다. `p_status == "close"`이면 단종 제품이다.

`t=list_by_product_page`에만 있는 필드: `d_file_lang`(코드, 예 `ko`), `d_file_lang_name`, `d_version`, `d_thumb`(썸네일 경로 `/ko/cat/THUMBNAIL/…`), `filecnt`, `filesize`, `p_name`, `p_thumb`. 이 API는 제품 페이지 JS(`view.js`)에서 `d_p_code`를 빈 값으로 덮어써서 호출하므로 사실상 카테고리 단위 목록이다.

`t=file_list&d_id=415075` 응답:
```json
{"success":true,"data":[{"rownum":1,"df_name":"[Susol_VCB]_KO_C05001-26-202609.pdf","df_id":56308,
 "df_path":"/ko/cat/[Susol_VCB]_KO_C05001-26-202609.pdf","df_size":78116,"df_order":1,
 "df_download_count":52,"df_regdate":"2026/11/14 09:00:08"}]}
```
- `df_size` 단위는 KB이다(78116 → 실제 Content-Length 78,116,177 B).
- `df_name`은 URL 인코딩된 상태로 올 수 있으므로 `decodeURIComponent` 한다.

### 파일 다운로드 URL
- `https://www.ls-electric.com` + `df_path`. 파일명에 `[ ]`, 공백, 한글이 있으면 마지막 경로 부분만 `encodeURIComponent` 한다(사이트 JS와 같은 처리).
- 관찰된 경로: 카탈로그·매뉴얼·기술자료는 `/ko/cat/…`, `/ko/cat/HPDT/…`, 인증서는 `/ko/certi/…`.
- HEAD/GET이 바로 200 `application/pdf`(`Content-Disposition: Attachment`)를 돌려준다. **reCAPTCHA, 로그인, Referer 모두 필요 없다**(실측).

### 문서 유형 코드 (`dc_id`, `#hd_category`)
| dc_id | 이름 | 앱 type |
|---|---|---|
| 1 | 카탈로그 | catalog |
| 2 | 사용설명서 | manual |
| 3 | 기술자료 | other (통신 맵, 기술 문서 등) |
| 4 | 인증서 | certificate |
| 5 | 납품실적 | other |
| 6 | 소프트웨어 | software |
| 7 | CAD 자료 | cad |
| 9 | DataSheet | datasheet |
| 11 | 적용사례 | other |
| 12 | 교육자료 | other |

인증서 종류 코드(`certi_type`)는 `#hd_certi_category`에 있다. 예: 001 ABS, 004 CB, 005 CCC, 006 CE, 015 KC 안전, 016 KC EMC, 019 KR, 020 KS, 021 LR 등.

### 카테고리 코드·제품·자료의 연결
- 각 자료에는 `d_c_code`(카테고리, 3자리씩 깊어짐: `AAA` → `AAA015` → `AAA015001`)와 `d_p_code`(제품, 빈 값일 수 있음)가 붙어 있다.
- `t=list`에 `c_code`와 `p_code`를 함께 넘기면 그 제품의 자료와 **상위 카테고리 공통 자료(d_p_code="")** 가 함께 나온다. 예: Susol VCB 221건 중 214건이 P01062에 직접 연결되고, 나머지는 `AAA` 공통 리플렛, 소프트웨어(LSPS), "for Marine" 카탈로그 등이다.
  → 제품 카드에는 `d_p_code === productId` 인 자료만 쓰고, 공통 자료는 카테고리 레벨로 따로 다룬다.
- `p_code`만 넘기고 `c_code`를 비우면 필터가 듣지 않는다(전체 892건이 나옴). **`c_code`는 반드시 함께 넘긴다.**
- 제품의 `c_code`는 menu 트리(products.json의 categoryCode)나 제품 페이지 `#hd_entity.c_code`에서 얻는다.

### 사용자용 딥링크
`https://www.ls-electric.com/ko/download?c_code={c_code}&p_code={p_code}`
제품 페이지 "다운로드 자료실 바로가기" 버튼이 쓰는 형식이다. `default.js`가 쿼리스트링을 읽어 트리를 펼치고 바로 검색한다.

### reCAPTCHA
- `recaptcha/api.js?render=6Ldd…` 가 로드되고 `grecaptcha.execute(…, {action:'homepage'})` 가 호출된다. 하지만 토큰을 받아서 아무 데도 쓰지 않는다(빈 then). 목록, 파일 목록, 파일 다운로드 어디에도 토큰 파라미터가 없다. 캡차는 다운로드 조건이 아니다.

---

## 2. 제품 페이지 (/ko/product/view/P…)

- 서버가 렌더링한 hidden input `#hd_entity`에 제품 메타데이터(JSON)가 들어 있다. `p_code`, `p_name`, `c_code`, `c_depth*_name`, `p_summary`, `p_thumb`, `p_status`, **`p_ssq_yn`, `p_ssq_link`** 등이다.
- `#hd_downloads`는 비어 있다. 다운로드 탭은 `view.js`가 `t=list_by_product_page`로 불러온다(위 표 참고).
- `#hd_tab`에 `ssq_download` 키가 있으면 다운로드 탭이 www 자료 대신 `p_ssq_link`(새 창)를 연다. 예: iS7 → `https://sol.ls-electric.com/product/category/200?utm_…`. 이때 `200`은 ssq 카테고리 ID와 같다.
- `#hd_qna`에 고객 Q&A가 실명과 회원 ID까지 포함된 채 렌더링되어 있다. **개인정보이므로 수집하지 않는다.**

---

## 3. ssq.ls-electric.com (Solution Square)

### 구조
- Vite와 React로 만든 SPA다(`/assets/index-*.js`, 코드 분할 청크, axios 사용). 해시가 붙은 파일명은 배포할 때마다 바뀌므로 청크 이름에 의존하지 않는다.
- 다운로드 센터 화면(`DlCenterPage-*.js`)은 두 가지 모드로 동작한다.
  - 검색어 없음(기본): `GET /api/guest/zdata/ssqdoc/dlCenter` (`useApiBookmark-*.js`)
  - 검색어 있음: `GET /api/guest/srch/v3/restSearchBff` 다음에 `GET /api/guest/zdata/ssqdoc/dlCenter/by-ids?ids=…` 로 파일 정보를 보충한다.
- 언어 코드는 `ko-KR`, `en`, `en-US` 이다(`ko`를 넘기면 빈 결과).
- 게스트 API는 `/api/guest/…`, 회원 API는 `/api/member/…`, 관리자 API는 `/api/boris/…` 아래에 있다. **우리는 `/api/guest/` 아래의 읽기 전용 GET만 쓴다.**

### 엔드포인트
| 메서드/경로 | 용도 | 파라미터 |
|---|---|---|
| `GET /api/guest/ssqData/category/products/map?lang=ko-KR` | 제품 카테고리 전체 맵(224개) | `{"categoryMap":{"200":{"id":200,"parent":2,"level":2,"sequence":8,"name":"iS7"},…}}` |
| `GET /api/guest/zdata/ssqdoc/dlCenter` | 자료 목록 | `langs=ko-KR`, `ctgryIds`(콤마), `docTypes`(콤마), `fileLangs`, `tags`, `targets`, `period`(WEEK/ONEMONTH/SIXMONTH/YEAR), `order`(UPDATE/OLDEST/TITLE/MOST_VIEWED), `keyword`, `pageNo`(1부터), `pageSize` |
| `GET /api/guest/zdata/ssqdoc/dlCenter/count` | 위 조건의 개수 | 같음 |
| `GET /api/guest/zdata/ssqdoc/dlCenter/doctypes` | 유형별 개수 | 같음 |
| `GET /api/guest/zdata/ssqdoc/dlCenter/by-ids?ids=` | 문서 ID로 파일 정보 조회 | |
| `GET /api/guest/srch/v3/restSearchBff` | 통합 검색 | `query`, `index`, `page`, `totalsize`, `indexsize`, `sort`, `daterange`, `exposeSiteLanguage`, `docType`, `categoryId`… |
| `GET /api/guest/category/autocomplete?searchKeyword=&autocomType=model&lang=` | 모델명 자동완성 | (호출하지 않음) |
| `PATCH …/addDownloadCount`, `…/addClickCount` | 통계 기록 | **호출 금지** |

`dlCenter`는 표의 파라미터로 동작을 확인했다. `docTypes`를 넘기지 않은 조합은 확인하지 않았으므로 항상 명시한다. 목록이 `pageSize`보다 적게 오면 마지막 페이지다.

호출 예:
```
GET https://ssq.ls-electric.com/api/guest/zdata/ssqdoc/dlCenter?langs=ko-KR&ctgryIds=200&docTypes=CAD_DATA,CATALOG,CERTIFICATION,DATASHEET,MANUAL,SOFTWARE,OS&order=UPDATE&pageNo=1&pageSize=50
```
응답 샘플 (`writerId`, `lastModifierId`에는 직원 이메일이 들어 있어 아래에서 지웠다. **저장하지 않는다**):
```json
{"pageNo":1,"pageSize":50,"keywords":[],"list":[
 {"id":1711,"docGrpId":null,"exposeSiteLanguage":"ko-KR","clickCount":17994,"goodCount":64,"badCount":1,"docType":"MANUAL",
  "docTitle":"iS7 사용설명서","updateTime":"2026-03-06T04:45:11.055Z","discontinue":null,"tags":["저압 드라이브"],
  "displayTarget":0,
  "files":[{"versionId":72822,"version":"2.0","fileId":81856,"fileName":"iS7_User Manual_Kor_V2.0_260224.pdf",
            "fileLang":"KO","fileKey":"document/17727722384570",
            "blobUrlForLargeFile":"https://sftpssqblobcdn.blob.core.windows.net/prod/largefile/document/17727722384570/iS7_User%20Manual_Kor_V2.0_260224.pdf",
            "fileSize":15546}]}]}
```

### docType 코드
`CAD_DATA`→cad, `CATALOG`→catalog, `CERTIFICATION`→certificate, `DATASHEET`→datasheet, `MANUAL`→manual, `SOFTWARE`→software, `OS`(펌웨어)→software, `MARKETING_MATERIAL`→other, `EDUCATION_INTERNAL`·`EDUCATION_NOTE`·`EDUCATION_VIDEO`(교육, 수집 대상 아님).

### displayTarget (공개 범위)
`0` GUEST(공개), `10` LOGIN, `15` PARTNER, `20` EMPLOYEE. 목록 응답에는 10/15/20 문서의 파일 키도 들어 있다. 하지만 사이트 UI는 로그인하지 않은 사용자에게 이 문서들을 열어 주지 않는다. **우리 앱은 `displayTarget === 0`만 쓴다**(우회로 보일 수 있는 링크는 노출하지 않는다). iS7 기준 200건 중 공개 문서는 162건이다.

### 파일 다운로드 URL (`useApiDownloadFile-*.js`와 같은 규칙)
1. `blobUrlForLargeFile`이 있으면 그 URL을 쓴다. 앱은 호스트 `sftpssqblobcdn.blob.core.windows.net`을 `https://ssqfd-abhdhraad3gkgbcg.a03.azurefd.net`(Azure Front Door)으로 바꿔서 쓴다. 두 주소 모두 206/200을 실측했다.
2. 그렇지 않으면 `https://ssq.ls-electric.com/uploads/{fileKey}/{encodeURIComponent(fileName에서 특수문자 {}[]/?,;:|)*`!^+<>@#$%&\=('" 를 _ 로 바꾼 값)}` 를 쓴다. 200 `application/pdf`을 실측했다. 이 경로는 Range 요청을 무시하고 파일 전체를 보낸다. 대용량 파일을 `/uploads/` 경로로 요청하면 404가 난다.
- 로그인과 캡차는 필요 없다(공개 문서 기준).
- 사용자용 문서 상세 페이지: `https://ssq.ls-electric.com/kr/ko/product/document/{id}`. 카테고리 페이지: `/kr/ko/product/category/{categoryId}`.

### www 제품(P…)과 ssq 카테고리 연결
- 1순위: www 제품 페이지 `#hd_entity.p_ssq_link`의 `/product/category/(\d+)`. 예: iS7 P01188 → 200.
- 보조: ssq `category/products/map`의 `name`과 www 제품명을 대조한다(G100, H100, S100, M100, L100, S300, iS7, iV5 등 이름이 그대로 일치하는 경우가 많다).
- ssq 카테고리는 4단계 트리다(예: PLC 1 > XGT 7 > 기본 14 > XGK CPU 18). 상위 ID를 넘길 때 웹 UI는 자식 ID까지 펼쳐서 보낸다(검색 모드). 제품 단위로는 말단 또는 제품명 노드 ID를 넘긴다.
- `sol.ls-electric.com`은 robots 내용이 같고 `/product/category/200`이 200으로 응답하는 것만 확인했다. ssq와 같은 플랫폼으로 보이지만 확인하지는 않았다.

---

## 4. 가설 검증 결과

| 가설 | 결론 | 근거 |
|---|---|---|
| H1: 다운로드 페이지가 AngularJS `$http`로 JSON API를 호출한다 | **채택** | `/ko/download/default.js`에 `$http.get("/"+lang+"/api/download.ashx?t=list", {params})`, `t=file_list`, `t=certi`, `t=hits`가 있다. curl 실호출로 JSON을 받았다. POST가 아니라 GET이고 Referer가 필요하다. |
| H2: 제품 페이지에 그 제품의 자료 목록이 있다 | **부분 채택** | 자료 목록은 서버가 렌더링하지 않는다(`#hd_downloads` 비어 있음). `view.js`가 `t=list_by_product_page`로 불러오며 카테고리 단위다. 대신 `#hd_entity`가 c_code와 ssq 링크를 주므로 두 자료실을 잇는 열쇠로 유용하다. |
| H3: ssq는 별도 SPA이고 자체 REST API가 있다 | **채택** | React SPA 번들에서 `/api/guest/zdata/ssqdoc/dlCenter`, `/api/guest/ssqData/category/products/map`, `/uploads/{fileKey}/…` 규칙을 찾았다. 게스트 상태로 실호출에 성공했다. |

## 5. 제약 사항
- www API: Referer 필수. CORS가 e-portal 도메인으로 제한되어 있어 브라우저에서 직접 호출할 수 없다. 문서마다 파일을 얻으려면 `file_list`를 한 번씩 더 호출해야 한다(N+1).
- 문서 수가 많다. Susol VCB는 직접 연결된 문서가 214건이고 그중 CAD 166건, 인증서 51건이다. 교육용 화면에는 catalog, manual, datasheet 정도만 쓰고 나머지는 딥링크로 넘기는 편이 낫다.
- `d_file_lang`이 실제 언어와 다른 경우가 있다(예: "기술자료_영문"인데 `한국어`로 표기됨).
- ssq: 공개 범위(displayTarget)를 반드시 걸러야 한다. 응답에 직원 이메일이 포함되어 있으므로 저장하기 전에 해당 필드를 버린다. 청크 파일명이 배포마다 바뀌지만 API 경로는 번들 밖에서 고정적으로 쓰이므로 영향이 적다.
- 다운로드·조회 통계 API(`t=hits`, `addDownloadCount`, `addClickCount`)는 호출하지 않는다.
- 로그인과 캡차 우회는 시도하지 않았다. 공개 자료에는 둘 다 필요하지 않았다.

## 6. 권장 수집 방식

**권장: 빌드할 때 스크립트로 수집해 `products.json`의 `docs[]`를 채우고, 딥링크를 함께 둔다.**

1. `scripts/fetch-docs.mjs`(probe-downloads.mjs를 확장)를 수동으로 실행하거나 정기적으로 돌려 `src/data/docs.json`(또는 products.json의 `docs[]`)을 만든다. 브라우저 CORS 문제가 없고, 사이트에 거는 부하를 1회 수집으로 끝낼 수 있다.
2. 제품마다 다음을 수행한다.
   - `p_ssq_link`가 있으면 ssq `dlCenter`(공개 문서만)를 쓴다.
   - 없으면 www `t=list`(`c_code`+`p_code`, `d_p_code === productId`만)를 쓴다.
   - 유형마다 최신 1~3건(catalog, datasheet, manual 우선)만 `file_list`로 실제 파일 URL을 구한다. 그 밖의 문서는 저장하지 않거나 개수만 기록한다.
3. 화면에는 "전체 자료 보기" 딥링크를 둔다.
   - 전력 제품: `https://www.ls-electric.com/ko/download?c_code={c}&p_code={p}`
   - 자동화 제품: `https://ssq.ls-electric.com/kr/ko/product/category/{ssqId}` (또는 `p_ssq_link`)
4. 파일 URL은 버전이 오르면 바뀐다(파일명에 날짜와 리비전이 들어감). 수집 날짜를 `updatedAt`과 함께 기록하고, 깨진 링크를 대비해 딥링크를 항상 함께 제공한다.
5. 페이지 총 수 기준 예상 요청 수: 제품 수 × (목록 1~5 + file_list 최대 5~10). 1.1초 간격이면 제품 100개에 약 15~25분 걸린다. 결과는 커밋해서 캐시한다.

## 7. 프로토타입 실행 결과 (`node scripts/probe-downloads.mjs`)
```
[probe] P01062 Susol VCB c_code=AAA015001 ssq=-
[probe] P01062: www list 221건 중 제품 직접 연결 214건
[probe] P01072 XGIPAM c_code=AAA016001 ssq=-
[probe] P01072: www list 40건 중 제품 직접 연결 35건
[probe] P01188 iS7 c_code=BBB005018 ssq=200
[probe] P01188: ssq category 200 문서 200건 중 공개 162건
[probe] 요약 P01062 (www): 225건 {"catalog":6,"manual":2,"cad":166,"certificate":51}
[probe] 요약 P01072 (www): 38건 {"catalog":2,"manual":2,"other":2,"software":1,"cad":4,"certificate":27}
[probe] 요약 P01188 (ssq): 187건 {"manual":44,"certificate":15,"software":17,"catalog":7,"cad":18,"datasheet":86}
```
출력 예:
```json
{"type":"catalog","lang":"ko","updatedAt":"2026-09-21","title":"[Susol VCB]","url":"https://www.ls-electric.com/ko/cat/%5BSusol_VCB%5D_KO_C05001-26-202609.pdf"}
{"type":"manual","lang":"ko","updatedAt":"2023-03-26","title":"[XGIPAM] 사용설명서","url":"https://www.ls-electric.com/ko/cat/HPDT/%5BXGIPAM%5D_Manual_KO_79562713001_200924.pdf"}
{"type":"manual","lang":"ko","updatedAt":"2026-06-11","title":"iS7 간편본 사용설명서","url":"https://ssqfd-abhdhraad3gkgbcg.a03.azurefd.net/prod/largefile/document/17812214879270/IS7_User%20Manual_Kor_Simple_V2.0_260610.pdf"}
```
- www 제품은 `--max-files=15`(기본값)를 넘는 문서(주로 CAD와 인증서)에 실제 파일 대신 자료실 딥링크를 `url`로 넣는다.
- 생성된 URL을 표본 점검했다. www `/ko/cat/HPDT/…(2014.02.26).xls`와 ssq `/uploads/…` 모두 200을 받았다.
