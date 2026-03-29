# TranslateDu

**한문 불교 문헌 구조 분석 · 다국어 번역 학습 도구**

TranslateDu는 한문 불교 문헌을 입력하면, Gemini AI를 활용하여 문장 구조 분석, 다국어 번역, 불교 용어 해설을 자동으로 수행하는 학습 도구입니다.

> ⚠️ 분석 결과는 학술적 참고용이며, 최종 판단은 연구자의 몫입니다.

---

## 바로 사용하기

### 👉 [TranslateDu 실행하기](https://HMSeodam.github.io/translatedu/)

브라우저에서 위 링크를 클릭하면 바로 사용할 수 있습니다.
설치나 다운로드가 필요 없습니다.

**필요한 것:** Gemini API Key 하나면 됩니다 → [무료 발급 (Google AI Studio)](https://aistudio.google.com/apikey)

---

## v2.0 주요 변경사항

v1.0 대비 추가된 기능:

- 📷 **이미지 OCR** — 고전 문헌 사진에서 한자를 자동 인식 (NDL古典籍OCR-Lite 모델, 브라우저 내 ONNX 추론)
- ✍️ **한자 필기 입력** — 마우스/터치로 한자를 직접 써서 입력 (Google Input Tools API)
- 🌐 **다국어 UI + 출력** — 한국어·English·日本語·简体中文·繁體中文 5개 언어 지원, 메뉴부터 분석 결과까지 전체 전환
- 📝 **언어별 번역 규범** — 일본어는 書き下し文+現代語訳, 중국어는 간체/번체 구분 출력
- 🏗️ **모듈 구조 정비** — `i18n.js` 국제화 모듈 독립 분리, 파일 역할 명확화
- 🔧 **렌더러 개선** — 다국어 출력 지원 완성, 토큰 박스 렌더링 안정화
- 📚 **불교 용어 사전 확장** — `glossary.js` 다국어 독음(ko·ja·zh-CN·zh-TW·en) 전면 추가
- ⚙️ **프롬프트 엔진 고도화** — 언어별 번역 규범 정밀화, 검증 프롬프트 강화
- 🎨 **스타일시트 정비** — 다국어 폰트(Noto CJK 계열) 대응, 반응형 개선

---

## 주요 기능

### 3단계 AI 분석 파이프라인

| 단계 | 내용 | 설명 |
|:---:|---|---|
| 1 | **분절 + 구문 분석** | 절(句) 분리, 어절 분절, 품사·기능 판정 |
| 2 | **번역 생성** | 직역(구조 보존) + 의역(자연스러운 번역) |
| 3 | **자기 검증** | 누락·오역·문장성분 충돌 자동 점검 후 수정 |

### 📷 이미지 OCR (한자 자동 인식)

고전 문헌 이미지에서 한자를 자동으로 인식하여 입력란에 채워줍니다.

- **브라우저 내 ONNX 추론** — 서버 불필요, GitHub Pages에서 직접 실행
- **NDL古典籍OCR-Lite 모델** — RTMDet (텍스트 영역 검출) + PARSeq (문자 인식)
- 최초 사용 시 모델(~76MB) 1회 로딩, 이후 브라우저 캐시에서 빠르게 로딩
- API 키 불필요, 별도 파일 다운로드 불필요

> OCR 모델은 일본 국립국회도서관(NDL)의 [ndlkotenocr-lite](https://github.com/ndl-lab/ndlkotenocr-lite) 저장소에서 직접 로딩됩니다.
> 강점: 근세 이전 일본 고전적(和古書), 한적(漢籍) / 주의: 한국 목판본·필사본은 인식률이 낮을 수 있습니다.

### ✍️ 한자 필기 입력

마우스나 터치로 한자를 직접 써서 입력할 수 있습니다.

- **Google Input Tools API** 연동 — 높은 인식 정확도, 비용 없음, API 키 불필요
- 후보 문자 선택 → 대기열 → 입력란에 일괄 추가
- 획 취소, 캔버스 초기화 지원

### 🌐 다국어 출력 지원

우상단 언어 선택 시 **UI 전체**(메뉴, 버튼, 라벨, 결과 제목)와 **분석 결과**가 해당 언어로 전환됩니다.

| 언어 | 직역 (literal) | 의역 (idiomatic) |
|---|---|---|
| **한국어** (기본) | 구조 보존 직역 | 자연스러운 한국어 의역 |
| **English** | Word-for-word translation | Natural English translation |
| **日本語** | 書き下し文 (훈독체) | 現代語訳 (현대 일본어) |
| **中文简体** | 逐字直译 (구조 보존) | 现代汉语意译 |
| **中文繁體** | 逐字直譯 (구조 보존) | 現代漢語意譯 |

### 분석 결과 항목

- **원문 구조 분석** — 절 분리, 어절별 토큰 박스 (품사, 기능, 확신도 배지)
- **번역문 구조 분석** — 직역 / 의역 / 검증 후 수정 번역
- **문법 포인트** — 若…即… 구문, 연쇄동사 등 한문 문법 해설
- **불교학 참고** — 교학 용어의 문장 내 맥락적 의미
- **원문-번역 대응 관계** — source ↔ target 정렬 시각화
- **문장 구조 해설** — 주어/서술어/목적어/조건절 등 카드 형태 표시
- **핵심 어휘 카드** — 불교 용어 중심 어휘 정리

### 다양한 입력 형태 지원

```
순수 한문:  若依一乘此中即具十佛體德用。准以思攝。
방점 한문:  第二別釋文有三。初明法身。
현토 한문:  居卑而後에 知登高之爲危하고 處晦而後에 知向明之太露하며
이미지:    📷 버튼으로 고전 문헌 사진에서 OCR
필기:      ✍️ 버튼으로 직접 한자를 써서 입력
```

현토(懸吐, 한글 토씨)가 달린 문장도 자동 인식하여, 절 분리에서는 현토를 보존하고 어절 분석에서는 한자만 깔끔하게 표시합니다.

### 결과 내보내기

분석 완료 후 두 가지 형태로 다운로드할 수 있습니다:

- **HTML 파일** — 스타일 내장, 브라우저에서 바로 열람·인쇄 가능
- **JSON 파일** — 분석 데이터 원본, 후속 처리·아카이빙용

### 로컬 폴백 분석

API 없이도 내장 불교 용어 사전을 기반으로 기초 분석(절 분리, 용어 태깅, 품사 분류)을 제공합니다.

---

## 사용 방법

1. 위 링크로 접속
2. 우상단에서 언어 선택 (기본: 한국어)
3. 한문 원문 입력 (직접 입력 / 📷 이미지 OCR / ✍️ 필기 입력)
4. Gemini API Key 입력 (최초 1회, 이후 자동 저장)
5. 모델 선택 (기본: Gemini 2.5 Flash 권장)
6. **분석 실행** 클릭
7. 결과 확인 후 필요시 HTML/JSON 다운로드

### 권장 모델

| 모델 | 무료 제한 | 특징 |
|---|---|---|
| **Gemini 2.5 Flash** (기본) | 10 RPM | 균형 잡힌 성능, 일반 분석에 적합 |
| **Gemini 2.5 Flash Lite** | 15 RPM | 빠른 응답, 할당량 여유 |
| **Gemini 2.5 Pro** | 5 RPM | 최고 품질, 복잡한 문장에 적합 |

---

## 로컬 실행 (선택사항)

GitHub Pages 버전을 그대로 사용하면 되지만, 오프라인 환경 등에서 로컬로 실행하고 싶은 경우:

### 사전 준비

- [Node.js](https://nodejs.org/) v18 이상 설치

### 실행

```bash
# 1. 저장소 다운로드 (Code → Download ZIP → 압축 해제)
# 2. 해당 폴더에서:
node server.js
# 3. 브라우저에서:
# http://localhost:3000
```

Windows에서는 `start.bat` 더블클릭으로도 실행할 수 있습니다.

> `index.html`을 직접 열면 브라우저 CORS 정책으로 API 호출이 차단될 수 있습니다. 로컬 실행 시 반드시 `node server.js`를 통해 접속하세요.

---

## 프로젝트 구조

```
TranslateDu/
├── index.html        ← 메인 페이지 (data-i18n 국제화 적용)
├── app.js            ← 앱 컨트롤러 (이벤트 바인딩, OCR/필기/i18n 제어)
├── parser.js         ← 분석 엔진 (API 호출, JSON 검증, 로컬 폴백, 다국어 처리)
├── prompts.js        ← 시스템 프롬프트 · 다국어 설정 · Few-shot 예시 · 검증 프롬프트
├── i18n.js           ← 국제화 모듈 (5개 언어 UI 텍스트 사전)
├── glossary.js       ← 내장 불교 용어 사전 (다국어 독음 포함)
├── renderer.js       ← 결과 렌더링 + HTML 다운로드 생성
├── storage.js        ← localStorage 관리 (API Key, 언어 설정 등)
├── utils.js          ← 유틸리티 함수
├── ocr.js            ← 브라우저 ONNX OCR 엔진 (RTMDet + PARSeq)
├── handwriting.js    ← 한자 필기 인식 (Google Input Tools API)
├── ort.min.js        ← ONNX Runtime Web (로컬 번들)
├── ort-wasm-*.wasm   ← ONNX Runtime WASM 바이너리
├── styles.css        ← 스타일시트
├── server.js         ← 로컬 프록시 서버 (로컬 실행용)
├── start.bat         ← Windows 로컬 실행 스크립트
└── start.sh          ← Mac/Linux 로컬 실행 스크립트
```

---

## 기술 스택

- **프론트엔드**: Vanilla JS + CSS (프레임워크 없음)
- **AI 번역**: Google Gemini API (2.5 Flash / Flash Lite / Pro)
- **OCR**: ONNX Runtime Web + NDL古典籍OCR-Lite (RTMDet-S + PARSeq-Tiny)
- **필기 인식**: Google Input Tools Handwriting API
- **국제화**: 자체 i18n 모듈 (data-i18n 속성 기반)
- **호스팅**: GitHub Pages (무료)
- **로컬 서버**: Node.js 내장 모듈만 사용 (npm install 불필요)

---

## 문제 해결

| 증상 | 원인 | 해결 |
|---|---|---|
| API 404 오류 | 퇴역된 모델 선택 | 모델을 Gemini 2.5 Flash로 변경 |
| API 429 오류 | 무료 할당량 초과 | 1분 후 재시도 또는 Flash Lite로 변경 |
| API 403 오류 | 잘못된 API Key | [Google AI Studio](https://aistudio.google.com/apikey)에서 재발급 |
| 로컬 분석으로 전환됨 | API 실패 시 자동 폴백 | API Key 확인 후 재시도 |
| OCR 첫 로딩이 느림 | 모델 76MB 최초 다운로드 | 잠시 대기 (이후 캐시에서 빠르게 로딩) |
| OCR 인식률이 낮음 | 한국 목판본·필사본 이미지 | NDL 모델은 일본 고전적 최적화 — 인식 결과를 수동 교정 후 사용 |
| 필기 인식 실패 | 인터넷 연결 끊김 | 네트워크 연결 확인 |

---

## 라이선스

[![License: CC BY-NC-ND 4.0](https://img.shields.io/badge/License-CC%20BY--NC--ND%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-nd/4.0/)

Copyright (c) 2026 **서담 한민수 (Han Minsu), 동명대학교 (Tongmyong University)**

이 프로젝트는 [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/) 라이선스를 따릅니다.

- ✅ 저작자 표시 조건 하에 공유·복제 허용
- ❌ 상업적 이용 금지
- ❌ 변형·2차 저작물 배포 금지

상업적 이용 또는 변경 배포를 원하시는 경우 저작자에게 별도 문의하시기 바랍니다.

### OCR 모델 (NDL古典籍OCR-Lite)

이미지 OCR에 사용되는 모델(RTMDet, PARSeq, NDLmoji)은 **국립국회도서관(国立国会図書館, NDL)**이 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 라이선스로 공개한 [NDL古典籍OCR-Lite](https://github.com/ndl-lab/ndlkotenocr-lite)의 산출물입니다. 모델 파일은 TranslateDu 저장소에 포함되지 않으며, 사용 시 NDL 저장소에서 직접 로딩됩니다.

### ONNX Runtime Web

ONNX Runtime Web(`ort.min.js`, `ort-wasm-*.wasm`)은 **Microsoft**가 [MIT License](https://github.com/microsoft/onnxruntime/blob/main/LICENSE)로 공개한 소프트웨어입니다.

---

## 기여

이슈와 PR을 환영합니다. 특히 다음 영역에서 기여를 기다립니다:

- 불교 용어 사전(`glossary.js`) 확장
- 프롬프트 개선 (특정 경전·주석서 유형에 특화)
- 다국어 번역 품질 개선
- UI/UX 개선
