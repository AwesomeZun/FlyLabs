# FlyLabs 외부 API 조사 및 신청 기록

> 조사·신청 기록 문서입니다. 아래 API는 아직 FlyLabs 코드에 연동되지 않았습니다.
> 기계 판독용 목록: [`api-catalog.json`](./api-catalog.json)

작성: 2026-10-08 (미 동부시간), 대상 서비스: FlyLabs (https://flylabs-research.vercel.app)

## 0. 조사 방법

- Korea Connect 데이터·API 마켓(https://portal.koreaconnect.kr/market/mk/getMkDigitStore) 오픈API 약 80개 키워드 검색 + MCP 53개 전수 확인 (2026-10-08)
- 기준: FlyLabs 기능(자료 라이브러리, 조건 비교, 연구 준비표, 랩노트, 실험·재고·장비 관리, MaleCNS 연결 지도)에 직접 쓰일 수 있는지
- MCP 53개는 날씨·주차·유가·행정서류 위주로 해당 없음
- 0건이었던 키워드: KISTI, ScienceON, 초파리, 유전체(오픈API 기준), 화합물, 연구윤리, 표준물질

## 1. Korea Connect(디지털융합플랫폼) 사용신청 기록

- 신청 계정: 강성준 (Korea Connect 통합로그인)
- 신청 전 계정 이메일 인증·등록 필요 (미등록 시 "이메일 양식이 올바르지 않습니다"로 신청 차단)
- 소속 입력값: FlyLabs (개인 연구 프로젝트)
- 신청목적: 정책, 연구 / 상세: FlyLabs 연구실 워크스페이스(https://flylabs-research.vercel.app) 자료·시약 안전정보 연동 개발
- 약관: 서비스 약관 동의, 라이선스 허용 범위 동의 (모두 '제한없음, 제3자 권리 미포함')
- 결과: 20건 모두 "사용신청 되었습니다. 지금 바로 사용 가능합니다." 즉시 승인. 나의 신청 이력에서 20건 모두 처리상태 '사용', 사용기간 '기간 제한 없음' 확인
- 신청일(포털 표시, KST): 2026-10-08 ~ 10-09
- 인증키: 계정 공통 1개 (20개 API 동일). **키는 저장소에 넣지 않음.** 로컬 `.env`에 `KOREACONNECT_API_USER_KEY_ID=` 로 보관 (`.gitignore`가 `.env*` 제외)
- 신청 이력 목록: https://portal.koreaconnect.kr/user/us/getUsApplList

### 호출 방법

- 헤더 `api_user_key_id: <인증키>` + 아래 호출 URL + 각 API 요청변수(쿼리)
- **주의:** 2026-10-09 00:04 KST 기준, 미국 IP에서 호출하면 "Web firewall security policies" 차단 페이지가 반환됨 (키 유무와 무관하게 동일). 해외 IP 차단으로 추정되므로, FlyLabs 서버 함수는 Vercel 서울 리전(icn1)에서 호출하는 쪽으로 검증 필요

### 신청한 API 20개

#### 국내 논문

**한국연구재단_KCI 논문정보서비스_Full-Text 논문 조회**
- 제공: 한국연구재단 (공공데이터포털(API)) / 상태: 사용 / 신청일: 2026-10-08
- 용도: 자료 라이브러리: 논문 본문(Full-Text) 가져오기
- 호출: GET https://api.koreaconnect.kr/01/1/2603101713597416530PDP/EDUSCI/B552540/KCIOpenApi/artiInfo/openApiD218List (응답 XML)
- 상세: https://portal.koreaconnect.kr/market/mk/getMkApiDetail?drsTcd=02&drsno=a9287050908d4070b21cad49967d167c

**한국연구재단_KCI 논문정보서비스_KCI논문 정보 조회**
- 제공: 한국연구재단 (공공데이터포털(API)) / 상태: 사용 / 신청일: 2026-10-08
- 용도: 자료 라이브러리: 국내 논문 검색·메타데이터 가져오기
- 호출: GET https://api.koreaconnect.kr/01/1/2603101713597416530PDP/EDUSCI/B552540/KCIOpenApi/artiInfo/openApiM310List (응답 XML)
- 상세: https://portal.koreaconnect.kr/market/mk/getMkApiDetail?drsTcd=02&drsno=9687b49a42924613b78ff341a40c0ea1

**한국연구재단_KCI 논문정보서비스_WOS 피인용 논문 정보 조회**
- 제공: 한국연구재단 (공공데이터포털(API)) / 상태: 사용 / 신청일: 2026-10-08
- 용도: 피인용 정보(WoS)로 근거 강도 표시
- 호출: GET https://api.koreaconnect.kr/01/1/2603101713597416530PDP/EDUSCI/B552540/KCIOpenApi/artiInfo/openApiM321List (응답 XML)
- 상세: https://portal.koreaconnect.kr/market/mk/getMkApiDetail?drsTcd=02&drsno=58977a23c8df4c57a7a84ffe7d636702

**한국연구재단_KCI 논문정보서비스_KCI논문저자 조회**
- 제공: 한국연구재단 (공공데이터포털(API)) / 상태: 사용 / 신청일: 2026-10-08
- 용도: 저자 정보 연결
- 호출: GET https://api.koreaconnect.kr/01/1/2603101713597416530PDP/EDUSCI/B552540/KCIOpenApi/artiInfo/openApiD311List (응답 XML)
- 상세: https://portal.koreaconnect.kr/market/mk/getMkApiDetail?drsTcd=02&drsno=c1e7ae7bfed94949bd8fc89f00482c39

#### 시약 안전정보

**한국산업안전보건공단_물질안전보건자료 조회 서비스_화학물질목록**
- 제공: 한국산업안전보건공단 (공공데이터포털(API)) / 상태: 사용 / 신청일: 2026-10-08
- 용도: 재고/시약 카드: MSDS 화학물질 목록 (세부 16개 항목 API는 별도 신청 필요)
- 호출: GET https://api.koreaconnect.kr/01/1/2603101713597416530PDP/SAFETY/B552468/msdschem/getChemList (응답 XML)
- 상세: https://portal.koreaconnect.kr/market/mk/getMkApiDetail?drsTcd=02&drsno=8375281fbbf146438b42ad5eabf861f6

**한국환경공단_유독물GHS 정보 조회 서비스_유독물GHS 정보 목록 조회**
- 제공: 한국환경공단 (공공데이터포털(API)) / 상태: 사용 / 신청일: 2026-10-08
- 용도: 유독물 GHS 위험 표시
- 호출: GET https://api.koreaconnect.kr/01/1/2603101713597416530PDP/ENVIRO/B552584/kecoapi/ncisghs/ghsList (응답 JSON)
- 상세: https://portal.koreaconnect.kr/market/mk/getMkApiDetail?drsTcd=02&drsno=f55ea20a6fcd4689abd8519be1c15eca

**한국환경공단_화학물질 정보 조회 서비스_화학물질 정보 목록 조회**
- 제공: 한국환경공단 (공공데이터포털(API)) / 상태: 사용 / 신청일: 2026-10-08
- 용도: CAS 번호 기반 화학물질 정보
- 호출: GET https://api.koreaconnect.kr/01/1/2603101713597416530PDP/ENVIRO/B552584/kecoapi/ncissbstn/chemSbstnList (응답 JSON)
- 상세: https://portal.koreaconnect.kr/market/mk/getMkApiDetail?drsTcd=02&drsno=a6bd8eb5c7e8420db4c9a429d09e9a43

#### 독성·시험

**식품의약품안전처 식품의약품안전평가원_원료물질의 독성정보_독성정보 요약정보**
- 제공: 식품의약품안전처 식품의약품안전평가원 (공공데이터포털(API)) / 상태: 사용 / 신청일: 2026-10-08
- 용도: 조건 비교/연구 준비표: 원료물질 독성 요약
- 호출: GET https://api.koreaconnect.kr/01/1/2603101713597416530PDP/AGFOOD/1471057/ToxctyInfoService02/getSummaryInfo (응답 JSON)
- 상세: https://portal.koreaconnect.kr/market/mk/getMkApiDetail?drsTcd=02&drsno=592b88fe0e234de2a7ab9bd9bb4c8869

**식품의약품안전처 식품의약품안전평가원_OECD시험가이드라인_OECD시험가이드라인**
- 제공: 식품의약품안전처 식품의약품안전평가원 (공공데이터포털(API)) / 상태: 사용 / 신청일: 2026-10-08
- 용도: 실험 설계 시 OECD 시험가이드라인 참조
- 호출: GET https://api.koreaconnect.kr/01/1/2603101713597416530PDP/AGFOOD/1471057/OecdTestGdeLineService/getOecdTestGdeLineService (응답 JSON)
- 상세: https://portal.koreaconnect.kr/market/mk/getMkApiDetail?drsTcd=02&drsno=62f3cbb68a1242839ed30dba32f2264b

#### 의약품·약물

**식품의약품안전처_의약품 제품 허가정보_의약품 제품 허가 목록**
- 제공: 식품의약품안전처 (공공데이터포털(API)) / 상태: 사용 / 신청일: 2026-10-08
- 용도: 의약품 허가 정보 (FDDD 후보물질 맥락)
- 호출: GET https://api.koreaconnect.kr/01/1/2603101713597416530PDP/HEALTH/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnInq07 (응답 JSON)
- 상세: https://portal.koreaconnect.kr/market/mk/getMkApiDetail?drsTcd=02&drsno=56656a4d046745bdbcad54694d6d8e69

**식품의약품안전처_약물 유전 정보_약물 유전 정보 조회**
- 제공: 식품의약품안전처 (공공데이터포털(API)) / 상태: 사용 / 신청일: 2026-10-08
- 용도: 약물유전 정보
- 호출: GET https://api.koreaconnect.kr/01/1/2603101713597416530PDP/HEALTH/1471000/ParmgenService/getParmgen (응답 JSON)
- 상세: https://portal.koreaconnect.kr/market/mk/getMkApiDetail?drsTcd=02&drsno=b58c477de17443fc940c6c316dcc974c

**식품의약품안전처_의약품안전사용서비스(DUR)성분정보_병용금기 정보조회**
- 제공: 식품의약품안전처 (공공데이터포털(API)) / 상태: 사용 / 신청일: 2026-10-08
- 용도: DUR 병용금기 성분
- 호출: GET https://api.koreaconnect.kr/01/1/2603101713597416530PDP/HEALTH/1471000/DURIrdntInfoService03/getUsjntTabooInfoList02 (응답 JSON)
- 상세: https://portal.koreaconnect.kr/market/mk/getMkApiDetail?drsTcd=02&drsno=e036ce9ba6974ce7a4a4ee495c0874a7

**식품의약품안전처_의약품개요정보(e약은요)_의약품개요정보 조회**
- 제공: 식품의약품안전처 (공공데이터포털(API)) / 상태: 사용 / 신청일: 2026-10-08
- 용도: 일반의약품 개요 (e약은요)
- 호출: GET https://api.koreaconnect.kr/01/1/2603101713597416530PDP/HEALTH/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList (응답 JSON)
- 상세: https://portal.koreaconnect.kr/market/mk/getMkApiDetail?drsTcd=02&drsno=24875da763424f08ada24e3464240d4e

**식품의약품안전처_의약품 임상시험 정보_의약품 임상시험 정보조회**
- 제공: 식품의약품안전처 (공공데이터포털(API)) / 상태: 사용 / 신청일: 2026-10-08
- 용도: 국내 임상시험 정보
- 호출: GET https://api.koreaconnect.kr/01/1/2603101713597416530PDP/HEALTH/1471000/MdcinClincTestInfoService02/getMdcinClincTestInfoList02 (응답 JSON)
- 상세: https://portal.koreaconnect.kr/market/mk/getMkApiDetail?drsTcd=02&drsno=6d4e5706dd744301b0d2bc5fe8d0c38c

#### 생물자원

**한국농업기술진흥원_생명자원정보 조회 서비스_생명자원 종 마스터 정보 조회 서비스**
- 제공: 한국농업기술진흥원 (공공데이터포털(API)) / 상태: 사용 / 신청일: 2026-10-08
- 용도: 생명자원 종 마스터
- 호출: GET https://api.koreaconnect.kr/01/1/2603101713597416530PDP/AGFOOD/B554729/openApiService/getMasterList (응답 JSON)
- 상세: https://portal.koreaconnect.kr/market/mk/getMkApiDetail?drsTcd=02&drsno=909ad3f8c25445109c1fe3ce702619e2

**산림청 국립수목원_국가표준곤충목록 조회 서비스_곤충 학명 목록 조회**
- 제공: 산림청 국립수목원 (공공데이터포털(API)) / 상태: 사용 / 신청일: 2026-10-08
- 용도: 곤충 학명 표준화 (초파리 등)
- 호출: GET https://api.koreaconnect.kr/01/1/2603101713597416530PDP/ENVIRO/1400119/KiniService/scnmSearch (응답 XML)
- 상세: https://portal.koreaconnect.kr/market/mk/getMkApiDetail?drsTcd=02&drsno=5abcf61c3e16406396325e0e420587a6

**농촌진흥청 국립농업과학원_농업유전자원(KACC) 미생물 정보 제공_농업유전자원(KACC) 미생물 정보 조회**
- 제공: 농촌진흥청 국립농업과학원 (공공데이터포털(API)) / 상태: 사용 / 신청일: 2026-10-08
- 용도: KACC 미생물 균주 정보
- 호출: GET https://api.koreaconnect.kr/01/1/2603101713597416530PDP/AGFOOD/1390802/AgriGene/GeneOrganism/getGeneMicroOrganismList (응답 XML)
- 상세: https://portal.koreaconnect.kr/market/mk/getMkApiDetail?drsTcd=02&drsno=c774932e9a0740bc9599a87be5f0b649

**식품의약품안전처 식품의약품안전평가원_실험동물자원은행 분양자원 정보 서비스_실험동물자원은행 분양자원 정보 조회**
- 제공: 식품의약품안전처 식품의약품안전평가원 (공공데이터포털(API)) / 상태: 사용 / 신청일: 2026-10-08
- 용도: 실험동물자원은행 분양자원 조회
- 호출: GET https://api.koreaconnect.kr/01/1/2603101713597416530PDP/AGFOOD/1471057/DistributionInfoService/getDistributionInfo (응답 JSON)
- 상세: https://portal.koreaconnect.kr/market/mk/getMkApiDetail?drsTcd=02&drsno=ed8572d69f434ddbb0b87857574f7535

#### 기타

**행정안전부_정책연구 과제정보_행안부(PRISM), 과기부(NTIS), 국조실(NKIS) 3개 사이트의 공통 메타정보**
- 제공: 행정안전부 (공공데이터포털(API)) / 상태: 사용 / 신청일: 2026-10-09
- 용도: 정책연구 과제 메타 (PRISM/NTIS/NKIS)
- 호출: GET https://api.koreaconnect.kr/01/1/2603101713597416530PDP/PUBAD/1741000/prism_v3/pnnMetaData_v3 (응답 JSON)
- 상세: https://portal.koreaconnect.kr/market/mk/getMkApiDetail?drsTcd=02&drsno=7235e3bc8f714ec8a0f201c7063a8a0f

**특허등록원부 조회**
- 제공: 하이픈 (하이픈) / 상태: 사용 / 신청일: 2026-10-08
- 용도: 특허 등록원부 조회 (하이픈 제공, POST)
- 호출: POST https://api.koreaconnect.kr/01/1/2603101434213625838HYP/PUBAD/in0005000227 (응답 JSON)
- 상세: https://portal.koreaconnect.kr/market/mk/getMkApiDetail?drsTcd=02&drsno=6f4dfa18697b440fb3925d3a77abaeb2

### 추가로 신청할 만한 것 (이번엔 미신청)

- KOSHA 물질안전보건자료 세부 항목 API 16종 (2.유해성·위험성, 7.취급·저장, 8.노출방지·보호구, 11.독성, 13.폐기 등). 화학물질목록만으로는 MSDS 본문이 안 나옴
- 원료물질 독성정보 묶음의 나머지 (독성수치, 동물독성시험, 독성동태학, 참고문헌)
- 의약품 제품 허가정보 묶음의 '주성분 상세정보', DUR 묶음의 다른 오퍼레이션
- Korea Connect에 없던 것: KISTI ScienceON, NTIS 본체, KIPRIS Plus (각 기관 포털에서 직접 신청)

## 2. 해외 API 리스트 (신청/키 발급 미진행)

**OpenAlex**
- 해외 논문 검색 기본. 키 없이 하루 $0.10, 무료 키 발급 시 하루 $1 무료, 초과분 과금
- 접근: 계정 생성 후 무료 키
- 문서: https://developers.openalex.org

**Unpaywall**
- DOI로 오픈액세스 PDF 위치 조회. 검색 엔드포인트는 2026-09-18 종료(410), DOI 조회만 유지
- 접근: 키 불필요, ?email= 파라미터
- 문서: https://unpaywall.org/products/api

**Semantic Scholar**
- 유사 논문 추천, SPECTER2 임베딩. 키 초기 한도 1 RPS
- 접근: 키 신청(이메일 수령)
- 문서: https://www.semanticscholar.org/product/api

**PubMed E-utilities / Europe PMC / Crossref**
- 생의학 논문 메타데이터 (이번에 상태 재확인 안 함)
- 접근: 대부분 키 불필요
- 문서: https://www.ncbi.nlm.nih.gov/books/NBK25501/

**Cellosaurus**
- 세포주 표준 ID, STR 프로필, 오염/오인 세포주. JSON/TSV/XML. CC BY 4.0
- 접근: 키 불필요
- 문서: https://api.cellosaurus.org

**PubChem PUG-REST**
- 화합물 정보, Cellosaurus ID로 세포주 요약
- 접근: 키 불필요
- 문서: https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest

**Quartzy**
- 재고 품목(lot, CAS, 유효기간, 위치), 주문 요청, 웹훅
- 접근: Quartzy 사용자 AccessToken
- 문서: https://docs.quartzy.com/api/

**protocols.io**
- 프로토콜을 랩노트로 가져오기
- 접근: OAuth 클라이언트 등록
- 문서: https://www.protocols.io/developers

**ORCID / Zenodo / FlyBase / neuPrint / ChEMBL**
- 연구자 ID, 데이터 DOI, 초파리 유전자, MaleCNS 연결체, 생리활성 (이번에 상태 재확인 안 함)
- 접근: 서비스별 상이
- 문서: -

## 3. 다음 단계

1. Vercel 서울 리전에서 Korea Connect 호출이 통과하는지 확인 (KCI 논문 정보 조회로 테스트)
2. 해외 키가 필요한 것: OpenAlex, Semantic Scholar 키 발급
3. MSDS 세부 항목 API 추가 신청 여부 결정
