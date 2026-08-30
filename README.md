# 이야기의 문 — 마음을 읽는 치유 동화 웹앱

단어 선택으로 심리를 읽고(정서 원형 모델 + 자기결정이론), Claude가 독서치료 구조의 동화를 짓고, OpenAI gpt-image-2가 삽화(세로 1024×1536, medium)를 그리는 앱입니다.

## 폴더 구성
```
index.html      ← 앱 본체 (심리 엔진·사운드·뷰어·다운로드 전부 포함)
api/story.js    ← Claude API 호출 (동화 생성, IP당 하루 3편 제한)
api/image.js    ← OpenAI 이미지 API 호출 (IP당 하루 25장 제한)
vercel.json     ← 함수 타임아웃 60초 설정
```

## 1. OpenAI API 키 발급 (처음이라면)

1. https://platform.openai.com 접속 → 회원가입/로그인 (ChatGPT 계정과 같아도 됨. 단, ChatGPT Plus 구독과 API 요금은 **별개**입니다)
2. 좌측(또는 우상단 톱니) **Billing** → **Add payment method**로 카드 등록 후 크레딧 충전 (최소 $5부터 가능, 선불 방식이라 충전한 만큼만 쓰입니다)
3. **API keys** 메뉴 → **Create new secret key** → 생성된 `sk-...` 키를 복사해 보관 (다시 볼 수 없으니 메모)
4. **중요:** gpt-image-2 모델은 **조직 인증(Organization Verification)**이 필요할 수 있습니다.
   - Settings → Organization → General → **Verify Organization** 에서 신분증 인증 진행
   - 인증 없이 이미지 API 호출 시 "must be verified" 오류가 나면 이 절차를 하면 됩니다

## 2. Anthropic API 키

- https://console.anthropic.com → API Keys → 키 발급 (命鏡 때 쓰던 키가 있으면 그대로 사용 가능)

## 3. Vercel 배포 (saju2와 동일한 방식)

1. GitHub(aceleekr-lang)에 새 저장소 생성 → 이 폴더 파일 전부 업로드
2. Vercel → Add New Project → 해당 저장소 Import
3. **Settings → Environment Variables**에 두 개 등록:
   - `ANTHROPIC_API_KEY` = Anthropic 키
   - `OPENAI_API_KEY` = OpenAI 키 (sk-...)
4. Deploy — 이후 GitHub에 파일을 올리면 자동 재배포

## 3-1. 카카오톡 공유 썸네일 설정 (배포 직후 한 번)

1. 배포가 끝나 주소가 정해지면 `index.html`의 `og:image` 줄에서 `REPLACE-WITH-YOUR-DOMAIN.vercel.app`을 실제 주소로 교체 후 재배포
2. 카카오는 미리보기를 캐시하므로, 처음 빈 칸으로 보이면 https://developers.kakao.com/tool/debugger/sharing 에서 주소를 넣고 "초기화" (命·몸 때 빈 썸네일 문제의 해결 방법)

## 3-2. 이용 잠금 — 평생 2편 (운영자는 무제한)

- 방문자는 **평생 2편**까지만 동화를 만들 수 있습니다 (브라우저 쿠키·저장소 + IP 기록 기반)
- **운영자 열쇠 만들기:** Vercel → Settings → Environment Variables에 `OWNER_KEY` 라는 이름으로 나만 아는 비밀 문구(예: miryang-star-1111)를 추가하고 Redeploy
- **운영자로 쓰는 법:** 본인 기기에서 `https://배포주소/?master=비밀문구` 로 **한 번만** 접속하면 그 브라우저는 영구 무제한이 됩니다. 이후엔 그냥 주소로 접속해도 됩니다. 다른 기기(폰·아이패드)도 각각 한 번씩 접속해 두세요
- 한계: 데이터베이스 없는 간이 잠금이라 시크릿 모드나 쿠키 삭제로 우회할 수는 있습니다. 일반 사용자에겐 충분하지만, 행사 배포 등으로 엄격한 잠금이 필요해지면 Upstash Redis 연동으로 바꿔야 하니 그때 말씀 주세요
- 편수 조정: `api/story.js` 맨 위 `LIFETIME_LIMIT` 숫자만 수정

## 3-3. 결과물 서버 저장 + 관리자 페이지 (Upstash Redis)

사용자가 만든 동화(글+그림 4장)와 이름·연락처가 서버 저장소에 자동 보관되고, 관리자 페이지에서 검색·정렬·열람·다운로드·삭제할 수 있습니다. 잠금(평생 2편)도 이 저장소에 기록되어 배포·재시작과 무관하게 유지됩니다.

**저장소 만들기 (무료, 5분):**
1. https://upstash.com 가입 (구글 계정으로 가능)
2. Redis → **Create Database** → 이름 아무거나(storydoor), Region은 가까운 곳(예: ap-northeast-1 도쿄), Free 플랜 → Create
3. 생성된 DB 화면의 **REST API** 영역에서 두 값을 복사:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. Vercel → Settings → Environment Variables 에 위 두 개를 같은 이름 그대로 등록 → Redeploy

**관리자 페이지 사용법:**
- 주소: `https://배포주소/admin.html` (검색엔진에 노출되지 않게 처리됨)
- 처음 접속 시 운영자 열쇠(OWNER_KEY 값)를 입력하면 그 브라우저에 저장됩니다
- 기능: 이름·연락처·제목 검색 / 시간·이름·제목·모드 정렬(표 머리글 클릭도 가능) / 행별 보기 → 그림·전문 열람, 동화책 HTML·글 TXT 다운로드 / 삭제 / 전체 목록 CSV 다운로드
- 사용자 본인의 다운로드(글·그림·동화책)는 기존 그대로 유지됩니다

**용량 안내:** 그림은 해상도 그대로(1024×1536) 고화질 JPEG(품질 92)로 저장됩니다 — 인쇄 체감 화질은 원본과 동일, 1편당 약 2.5~4MB. 종량제 기준 첫 1GB 무료라 250편 이상 사실상 무료로 보관됩니다. 혹시 JPEG 옵션이 거부되면 자동으로 PNG 원본으로 우회하고, 큰 그림은 조각 전송으로 처리되어 별도 설정이 필요 없습니다.
## 4. 비용 (1편 기준)

- 삽화 4장(gpt-image-2 medium 1024×1536): 약 $0.25~0.28
- 동화 텍스트(Claude Sonnet 1회): 약 $0.05~0.10
- **1편당 약 400~550원.** 방문자는 평생 2편 잠금이라 1인당 최대 약 1,100원
- 참고: 서버리스 특성상 이 제한은 간이 방식입니다. 엄격한 제한이 필요해지면(홍보 후 트래픽 증가 등) Upstash Redis 연동으로 바꿔야 하니 그때 말씀 주세요

## 5. 사용 흐름

문 두드리기(소리 잠금 해제) → 아이의 문/어른의 문 선택 → 단어 카드 3라운드(감정→바람→장면, 각 3개) → 심리 판정 → 동화 4페이지(표지+3장면)+마음 처방 페이지 → 글(.txt)/그림(.png)/동화책(.html 한 파일) 저장

## 심리 판정 로직 (수정하고 싶을 때)

- 단어 목록과 좌표: `index.html`의 `BANK` (감정 v=쾌·불쾌, a=각성 / 바람 n=욕구 유형)
- 판정→그림 스타일 매핑: `analyze()` 함수
- 동화 생성 지침(독서치료 3단계 등): `api/story.js`의 `system` 프롬프트
