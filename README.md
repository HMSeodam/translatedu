# TranslateDu — 한문 불교 문헌 학습 도구

한문 불교 문헌의 구조 분석, 번역, 용어 해설을 위한 로컬 실행 도구입니다.

## 빠른 시작 (3단계)

### 1단계: Node.js 설치 확인
```
node --version
```
`v18.x.x` 이상이면 준비 완료. 없으면 https://nodejs.org 에서 LTS 설치.

### 2단계: 서버 실행
- Windows: `start.bat` 더블클릭
- Mac/Linux: `./start.sh` 또는 `node server.js`

### 3단계: 브라우저 접속
```
http://localhost:3000
```

## 사용 방법

1. 한문 원문 입력 (순수 한문, 현토 달린 한문 모두 지원)
2. [Google AI Studio](https://aistudio.google.com/apikey)에서 Gemini API Key 발급 후 입력
3. 모델 선택 후 **분석 실행**

## 지원하는 입력 형태

- 순수 한문: `若依一乘此中即具十佛體德用。准以思攝。`
- 현토 한문: `居卑而後에 知登高之爲危하고`

## 왜 서버가 필요한가?

`index.html`을 직접 열면 브라우저 CORS 정책으로 Gemini API 호출이 차단됩니다.
`server.js`가 API 요청을 대신 전달합니다.

## 결과 내보내기

분석 완료 후 하단 버튼으로 HTML 또는 JSON 파일로 다운로드할 수 있습니다.

## 파일 구조

```
├── server.js       ← 프록시 서버
├── start.bat       ← Windows 실행 스크립트
├── start.sh        ← Mac/Linux 실행 스크립트
├── index.html      ← 메인 페이지
├── app.js          ← 앱 컨트롤러
├── parser.js       ← 분석 엔진 + API 호출
├── prompts.js      ← 시스템/유저 프롬프트
├── glossary.js     ← 불교 용어 사전
├── renderer.js     ← 결과 렌더링 + HTML 다운로드
├── storage.js      ← localStorage 관리
├── utils.js        ← 유틸리티 함수
└── styles.css      ← 스타일시트
```

## 문제 해결

- **"node: command not found"**: Node.js 미설치. https://nodejs.org 에서 설치.
- **"EADDRINUSE"**: 3000번 포트 사용 중. 다른 터미널에서 서버가 이미 실행 중인지 확인.
- **API 429 오류**: 무료 할당량 초과. 잠시 대기 후 재시도.
- **API 403 오류**: API Key 오류. Google AI Studio에서 재발급.
