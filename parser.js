/**
 * parser.js
 * ──────────────────────────────────────────────
 * 텍스트 전처리, 사전 태깅, Gemini API 호출,
 * JSON 검증, 폴백 분석 등 핵심 분석 로직을 담당한다.
 *
 * 3단계 파이프라인:
 *   1) Segmentation — 절 분리 · 용어 태깅 · 토큰 분절
 *   2) Parsing      — 문장 구조 분석 · 번역 생성
 *   3) Verification — 자기검증 · 수정본 확정
 *
 * API 실패 시 로컬 사전 기반 폴백 분석 제공.
 */

// ───────── 설정 상수 ─────────
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const AVAILABLE_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (기본, 무료)' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite (무료, 빠름)' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (무료, 고품질)' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (6월 퇴역 예정)' }
];
const MAX_RETRY = 3;       // JSON 파싱 실패 시 재시도 횟수
const RETRY_DELAY_MS = 1000;
const QUOTA_RETRY_DELAYS = [5000, 10000, 20000]; // 429 에러 시 백오프 딜레이 (5초, 10초, 20초)

/** Promise 기반 딜레이 유틸리티 — utils.js의 delay()를 사용 */
// (delay 함수는 utils.js에 정의됨)

/**
 * 현재 선택된 모델 ID를 반환.
 * @returns {string}
 */
function getSelectedModel() {
  const select = document.getElementById('model-select');
  return select ? select.value : AVAILABLE_MODELS[0].id;
}

// ───────── 1. 입력 전처리 ─────────

/**
 * 입력 텍스트 전처리.
 * - 전각/반각 정규화
 * - 불필요한 공백 제거
 * - 문장부호 보존
 * - 한문 원문을 현대중국어로 바꾸지 않음
 * @param {string} text
 * @returns {string}
 */
// normalizeInput 은 utils.js 에 정의됨 — 여기서는 호출만 함


// ───────── 2. 절(句) 분리 ─────────

/**
 * 한문 텍스트를 절(句) 단위로 분리.
 * 。，；：、 및 마침표/쉼표/세미콜론을 기준으로 분리.
 * @param {string} text
 * @returns {string[]}
 */
function splitClauses(text) {
  if (!text) return [];
  // 한문 문장부호 + 서양 문장부호를 구분자로 사용
  const parts = text.split(/([。，；：、.;,])/).filter(s => s.trim());
  const clauses = [];
  let current = '';
  for (const part of parts) {
    if (/^[。，；：、.;,]$/.test(part)) {
      // 구분자는 앞 절에 붙임
      current += part;
      clauses.push(current.trim());
      current = '';
    } else {
      current += part;
    }
  }
  if (current.trim()) {
    clauses.push(current.trim());
  }
  return clauses;
}


// ───────── 3. 용어 사전 매칭 ─────────

/**
 * 입력 텍스트에서 불교 용어 사전과 매칭되는 항목을 찾는다.
 * 다자어 우선 매칭 (GLOSSARY는 길이 역순 정렬되어 있음).
 * @param {string} text
 * @param {Array} glossary - GLOSSARY 또는 BUDDHIST_TERMS_ONLY
 * @returns {Array} 매칭된 용어 배열 (중복 제거)
 */
function matchGlossary(text, glossary) {
  if (!text || !glossary) return [];
  const matches = [];
  const usedPositions = new Set(); // 이미 매칭된 위치를 추적하여 중복 방지

  for (const entry of glossary) {
    let searchFrom = 0;
    while (true) {
      const idx = text.indexOf(entry.surface, searchFrom);
      if (idx === -1) break;

      // 해당 위치가 이미 더 긴 용어에 의해 매칭되었는지 확인
      let overlaps = false;
      for (let i = idx; i < idx + entry.surface.length; i++) {
        if (usedPositions.has(i)) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        matches.push({
          ...entry,
          position: idx,
          length: entry.surface.length
        });
        // 매칭 위치 기록
        for (let i = idx; i < idx + entry.surface.length; i++) {
          usedPositions.add(i);
        }
      }
      searchFrom = idx + 1;
    }
  }

  // 위치순 정렬
  matches.sort((a, b) => a.position - b.position);
  return matches;
}


// ───────── 4. Glossary Hints 빌드 ─────────

/**
 * 사전 매칭 결과를 모델 프롬프트용 glossary_hints 문자열로 변환.
 * @param {Array} matches - matchGlossary() 반환값
 * @returns {string}
 */
function buildGlossaryHints(matches, lang) {
  lang = lang || 'ko';
  if (!matches || matches.length === 0) {
    const NONE = { ko: '(해당 없음)', en: '(none)', ja: '（該当なし）', 'zh-CN': '（无）', 'zh-TW': '（無）' };
    return NONE[lang] || NONE.ko;
  }
  const BUDDHIST_LABEL = {
    ko: '불교학적',
    en: 'Buddhist doctrinal meaning',
    ja: '仏教教学的意味',
    'zh-CN': '佛教教学含义',
    'zh-TW': '佛教教學含義',
  };
  const label = BUDDHIST_LABEL[lang] || BUDDHIST_LABEL.ko;
  return matches.map(m =>
    `- ${m.surface}(${getReading(m, lang)}): ${m.meaning}` +
    (m.buddhist_meaning ? ` / ${label}: ${m.buddhist_meaning}` : '') +
    ` [${m.pos}]`
  ).join('\n');
}


// ───────── 5. 사용자 프롬프트 빌드 ─────────

/**
 * USER_PROMPT_TEMPLATE에 실제 값을 채워 프롬프트 생성.
 * @param {string} inputText - 전처리된 원문
 * @param {string} glossaryHints - buildGlossaryHints() 반환값
 * @param {string} lang - 출력 언어 ('ko' | 'en' | 'ja')
 * @returns {string}
 */
function buildUserPrompt(inputText, glossaryHints, lang) {
  lang = lang || 'ko';
  const config = OUTPUT_LANG_CONFIG[lang] || OUTPUT_LANG_CONFIG.ko;

  // 언어별 전용 프롬프트 빌더 사용
  const builder = USER_PROMPT_TEMPLATES[lang] || USER_PROMPT_TEMPLATES.ko;
  let prompt = builder(inputText, glossaryHints, config.outputCondition, config.schemaTranslationFields);

  // 언어별 완전 번역 few-shot 첨부 (모든 언어 동일 품질)
  prompt += buildFewShotString(lang);

  return prompt;
}


// ───────── 6. Gemini API 호출 ─────────

/**
 * Gemini API에 요청을 보내고 텍스트 응답을 반환.
 * @param {string} apiKey
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @returns {Promise<string>} 모델 응답 텍스트
 * @throws {Error} API 호출 실패 시
 */
async function callGeminiApi(apiKey, systemPrompt, userPrompt, onStatus) {
  if (!apiKey) {
    throw new Error('API Key가 입력되지 않았습니다.');
  }

  const modelId = getSelectedModel();

  const geminiPayload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }]
      }
    ],
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    generationConfig: {
      temperature: 0.1,        // 분석 정확도 우선 → 낮은 temperature
      topP: 0.8,
      maxOutputTokens: 16384,
      responseMimeType: 'application/json'  // JSON 전용 응답 요청
    }
  };

  // 프록시 서버 경유 여부 자동 감지
  // localhost에서 실행 중이면 프록시 사용, 아니면 직접 호출
  const useProxy = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const url = `${GEMINI_API_BASE}/${modelId}:generateContent?key=${apiKey}`;

  debugLog('API 요청 전송:', modelId, useProxy ? '(프록시 경유)' : '(직접 호출)');

  // 429 에러 시 자동 재시도 (지수 백오프)
  for (let quotaRetry = 0; quotaRetry <= QUOTA_RETRY_DELAYS.length; quotaRetry++) {
    let response;

    if (useProxy) {
      // ── 프록시 서버 경유 (CORS 우회) ──
      response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey,
          modelId: modelId,
          payload: geminiPayload
        })
      });
    } else {
      // ── 직접 호출 ──
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload)
      });
    }

    if (response.ok) {
      // 성공 시 아래에서 텍스트 추출로 진행
      const data = await response.json();
      debugLog('API 응답 수신:', data);

      const candidate = data?.candidates?.[0];
      if (!candidate) {
        throw new Error('API 응답에 후보(candidate)가 없습니다.');
      }
      if (candidate.finishReason === 'SAFETY') {
        throw new Error('API 응답이 안전 필터에 의해 차단되었습니다.');
      }
      const text = candidate.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('API 응답에 텍스트가 없습니다.');
      }
      return text;
    }

    // 에러 처리
    const errorBody = await response.text().catch(() => '');

    if (response.status === 429 && quotaRetry < QUOTA_RETRY_DELAYS.length) {
      // 429: 할당량 초과 — 백오프 후 재시도
      const waitSec = QUOTA_RETRY_DELAYS[quotaRetry] / 1000;
      const msg = `API 할당량 초과 (429). ${waitSec}초 후 재시도합니다... (${quotaRetry + 1}/${QUOTA_RETRY_DELAYS.length})`;
      debugLog(msg);
      if (typeof onStatus === 'function') onStatus(msg, 'warning');
      await delay(QUOTA_RETRY_DELAYS[quotaRetry]);
      continue;
    }

    // 재시도 불가한 에러
    if (response.status === 400) {
      throw new Error(`API 요청 오류 (400): 잘못된 요청입니다. ${errorBody}`);
    } else if (response.status === 403) {
      throw new Error('API Key가 유효하지 않거나 권한이 없습니다 (403).');
    } else if (response.status === 429) {
      throw new Error('API 할당량(quota)이 초과되었습니다 (429). 잠시 후 다시 시도하세요.');
    } else if (response.status === 500 || response.status === 503) {
      throw new Error(`Gemini 서버 오류 (${response.status}). 잠시 후 다시 시도하세요.`);
    } else {
      throw new Error(`API 호출 실패 (${response.status}): ${errorBody}`);
    }
  }
}


// ───────── 7. JSON 응답 추출 ─────────

/**
 * 모델 응답 텍스트에서 JSON 객체를 안전하게 추출.
 * @param {string} rawText
 * @returns {object|null}
 */
function extractJsonFromResponse(rawText) {
  return safeParseJson(rawText);
}


// ───────── 8. JSON 스키마 검증 ─────────

/**
 * 분석 결과 JSON이 필수 필드를 포함하는지 검증.
 * 엄밀한 스키마 검증이 아닌 필수 구조 존재 여부 확인.
 * @param {object} data
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateAnalysisJson(data) {
  const errors = [];
  if (!data) {
    return { valid: false, errors: ['데이터가 null입니다.'] };
  }

  // 최상위 필수 키 검사
  const requiredKeys = ['segmentation', 'parsing'];
  for (const key of requiredKeys) {
    if (!data[key]) {
      errors.push(`필수 키 "${key}"가 누락되었습니다.`);
    }
  }

  // segmentation 내부 검사
  if (data.segmentation) {
    if (!Array.isArray(data.segmentation.clauses)) {
      errors.push('segmentation.clauses가 배열이 아닙니다.');
    }
    if (!Array.isArray(data.segmentation.tokens)) {
      errors.push('segmentation.tokens가 배열이 아닙니다.');
    }
  }

  // parsing 내부 검사
  if (data.parsing) {
    if (!data.parsing.components) {
      errors.push('parsing.components가 누락되었습니다.');
    }
    if (!data.parsing.literal_translation && !data.parsing.idiomatic_translation) {
      errors.push('번역(literal 또는 idiomatic)이 모두 비어 있습니다.');
    }
  }

  return { valid: errors.length === 0, errors };
}


// ───────── 9. 1차 분석 (Segmentation + Parsing) ─────────

/**
 * 1차 API 호출: 분절 + 구문 분석 + 번역.
 * JSON 파싱 실패 시 재시도(최대 MAX_RETRY 회).
 * @param {string} inputText - 전처리된 원문
 * @param {string} glossaryHints - glossary_hints 문자열
 * @param {string} apiKey
 * @returns {Promise<object>} 분석 JSON
 * @throws {Error}
 */
async function firstPassAnalysis(inputText, glossaryHints, apiKey, onStatus, lang) {
  const userPrompt = buildUserPrompt(inputText, glossaryHints, lang);

  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    try {
      let systemMsg = buildSystemPrompt(lang || 'ko');
      if (attempt > 0) {
      const RETRY_SUFFIX = {
        ko: '\n\n중요: 반드시 유효한 JSON만 출력하라. 설명문, 코드 펜스, 기타 텍스트를 절대 포함하지 마라. JSON 객체 하나만 출력하라. 응답이 잘리지 않도록 각 필드를 간결하게 작성하라.',
        en: '\n\nIMPORTANT: Output only valid JSON. Never include explanations, code fences, or other text. Output exactly one JSON object. Keep each field concise to avoid truncation.',
        ja: '\n\n重要: 必ず有効なJSONのみを出力すること。説明文、コードフェンス、その他のテキストを絶対に含めないこと。JSONオブジェクト一つのみを出力すること。切り捨てを避けるため各フィールドを簡潔に記述すること。',
        'zh-CN': '\n\n重要：必须只输出有效的JSON。绝对不要包含说明文字、代码围栏或其他文本。只输出一个JSON对象。为避免截断，请简洁填写各字段。',
        'zh-TW': '\n\n重要：必須只輸出有效的JSON。絕對不要包含說明文字、程式碼圍欄或其他文字。只輸出一個JSON物件。為避免截斷，請簡潔填寫各欄位。',
      };
      const RETRY_STATUS = {
        ko: `JSON 파싱 실패. 재시도 중... (${attempt}/${MAX_RETRY})`,
        en: `JSON parse failed. Retrying... (${attempt}/${MAX_RETRY})`,
        ja: `JSON解析失敗。再試行中... (${attempt}/${MAX_RETRY})`,
        'zh-CN': `JSON解析失败。重试中... (${attempt}/${MAX_RETRY})`,
        'zh-TW': `JSON解析失敗。重試中... (${attempt}/${MAX_RETRY})`,
      };
      systemMsg += (RETRY_SUFFIX[lang] || RETRY_SUFFIX.ko);
      if (typeof onStatus === 'function') {
        onStatus(RETRY_STATUS[lang] || RETRY_STATUS.ko, 'warning');
      }
        debugLog(`1차 분석 재시도 ${attempt}/${MAX_RETRY}`);
      }

      const rawText = await callGeminiApi(apiKey, systemMsg, userPrompt, onStatus);
      const parsed = extractJsonFromResponse(rawText);

      if (!parsed) {
        throw new Error('JSON 파싱 실패: 응답에서 유효한 JSON을 추출할 수 없습니다.');
      }

      const validation = validateAnalysisJson(parsed);
      if (!validation.valid) {
        throw new Error(`스키마 검증 실패: ${validation.errors.join(', ')}`);
      }

      debugLog('1차 분석 성공');
      return parsed;

    } catch (e) {
      debugLog(`1차 분석 시도 ${attempt + 1} 실패:`, e.message);
      // 429/403 등 API 레벨 에러는 재시도하지 않고 즉시 전파
      if (e.message.includes('(429)') || e.message.includes('(403)') || e.message.includes('(400)')) {
        throw e;
      }
      if (attempt < MAX_RETRY) {
        await delay(RETRY_DELAY_MS);
        continue;
      }
      throw e;
    }
  }
}


// ───────── 10. 검증 (Verification) ─────────

/**
 * 2차 API 호출: 1차 분석 결과 검증 및 수정.
 * @param {string} inputText
 * @param {object} firstPassJson - 1차 분석 결과
 * @param {string} apiKey
 * @returns {Promise<object>} 검증/수정된 JSON
 * @throws {Error}
 */
async function verifyAnalysis(inputText, firstPassJson, apiKey, onStatus, lang) {
  lang = lang || 'ko';

  // 언어별 검증기 시스템 메시지
  const VERIFY_SYSTEM_BASE = {
    ko: '너는 한문 불교 문장 분석 JSON을 정밀 검증하는 전문 검증기다. 원문 완전성·성분 정합성·불교 용어 정확성·번역 품질·surface 오염 여부를 모두 점검하고 수정하라. 반드시 JSON만 출력하라.',
    en: 'You are a precision verifier for classical Chinese Buddhist text analysis JSON. Check source completeness, component consistency, Buddhist term accuracy, translation quality, and surface field contamination. Output JSON only. All output text must be in English.',
    ja: 'あなたは漢文仏教文献の分析JSONを精密検証する専門検証器です。原文の完全性・成分整合性・仏教用語の正確性・書き下し文の訓読形式・surfaceフィールドの汚染を全て点検し修正してください。書き下し文が現代語訳になっていたら必ず訓読体に修正すること。JSONのみを出力してください。',
    'zh-CN': '你是汉文佛教文献分析JSON的精密验证器。检查原文完整性、成分一致性、佛教术语准确性、翻译质量及surface字段污染情况，全部检查并修正。只输出JSON。所有输出文字须使用简体中文。',
    'zh-TW': '你是漢文佛教文獻分析JSON的精密驗證器。檢查原文完整性、成分一致性、佛教術語準確性、翻譯品質及surface欄位污染情況，全部檢查並修正。只輸出JSON。所有輸出文字須使用繁體中文。',
  };
  const VERIFY_RETRY_SUFFIX = {
    ko: '\n\nJSON 이외의 텍스트를 절대 출력하지 마라.',
    en: '\n\nOutput absolutely no text other than JSON.',
    ja: '\n\nJSON以外のテキストは絶対に出力しないでください。',
    'zh-CN': '\n\n绝对不要输出JSON以外的任何文本。',
    'zh-TW': '\n\n絕對不要輸出JSON以外的任何文字。',
  };

  const verificationPrompt = buildVerificationPrompt(inputText, firstPassJson, lang);

  // 언어별 추가 지시 삽입 (검증 단계에서도 출력 언어 강제)
  const langConfig = OUTPUT_LANG_CONFIG[lang] || OUTPUT_LANG_CONFIG.ko;
  const langSuffix = langConfig.systemSuffix || '';

  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    try {
      let systemMsg = (VERIFY_SYSTEM_BASE[lang] || VERIFY_SYSTEM_BASE.ko) + langSuffix;
      if (attempt > 0) {
        systemMsg += (VERIFY_RETRY_SUFFIX[lang] || VERIFY_RETRY_SUFFIX.ko);
        debugLog(`검증 재시도 ${attempt}/${MAX_RETRY}`);
      }

      const rawText = await callGeminiApi(apiKey, systemMsg, verificationPrompt, onStatus);
      const parsed = extractJsonFromResponse(rawText);

      if (!parsed) {
        throw new Error('Verification JSON parse failed');
      }

      debugLog('검증 완료');
      return parsed;

    } catch (e) {
      debugLog(`검증 시도 ${attempt + 1} 실패:`, e.message);
      if (e.message.includes('(429)') || e.message.includes('(403)') || e.message.includes('(400)')) {
        debugLog('검증 실패 (API 오류) — 1차 분석 결과를 그대로 사용합니다.');
        return firstPassJson;
      }
      if (attempt < MAX_RETRY) {
        await delay(RETRY_DELAY_MS);
        continue;
      }
      debugLog('검증 실패 — 1차 분석 결과를 그대로 사용합니다.');
      return firstPassJson;
    }
  }
}


// ───────── 11. 로컬 폴백 분석 ─────────

/**
 * API 실패 시 로컬 사전 기반 최소 분석 수행.
 * - 절 분리
 * - 용어 태깅
 * - 기초 품사 분류
 * - 단순 직역 보조 결과 제공
 * @param {string} inputText - 전처리된 원문
 * @param {Array} glossaryMatches - matchGlossary() 결과
 * @returns {object} 폴백 분석 결과 (API 분석과 동일한 스키마)
 */
function runLocalFallbackAnalysis(inputText, glossaryMatches) {
  debugLog('로컬 폴백 분석 실행');

  const lang = (typeof getSelectedOutputLang === 'function') ? getSelectedOutputLang() : 'ko';

  const FALLBACK_MSG = {
    ambiguity: {
      ko: '로컬 폴백 분석: 문장성분 자동 판정 불가',
      en: 'Local fallback: automatic component analysis unavailable',
      ja: 'ローカルフォールバック：文の成分の自動判定不可',
      'zh-CN': '本地回退分析：无法自动判断句子成分',
      'zh-TW': '本地回退分析：無法自動判斷句子成分',
    },
    litPrefix: {
      ko: '[로컬 축자역 보조]',
      en: '[Local word-by-word gloss]',
      ja: '[ローカル逐語訳補助]',
      'zh-CN': '[本地逐字译辅助]',
      'zh-TW': '[本地逐字譯輔助]',
    },
    idioNeeded: {
      ko: '(API 분석 필요)',
      en: '(API analysis required)',
      ja: '（API分析が必要）',
      'zh-CN': '（需要API分析）',
      'zh-TW': '（需要API分析）',
    },
    grammarFallback: {
      ko: '로컬 폴백: 문법 포인트 자동 추출 불가',
      en: 'Local fallback: grammar points cannot be extracted automatically',
      ja: 'ローカルフォールバック：文法ポイントの自動抽出不可',
      'zh-CN': '本地回退：无法自动提取语法要点',
      'zh-TW': '本地回退：無法自動提取語法要點',
    },
    issueNote: {
      ko: '로컬 폴백 분석 결과입니다. Gemini API를 사용하면 더 정확한 분석을 받을 수 있습니다.',
      en: 'This is a local fallback analysis. Use Gemini API for more accurate results.',
      ja: 'これはローカルフォールバック分析の結果です。Gemini APIを使用するとより正確な分析が得られます。',
      'zh-CN': '这是本地回退分析结果。使用Gemini API可获得更准确的分析。',
      'zh-TW': '這是本地回退分析結果。使用Gemini API可獲得更準確的分析。',
    },
  };
  const fb = (key) => FALLBACK_MSG[key][lang] || FALLBACK_MSG[key].ko;

  const clauses = splitClauses(inputText);

  // 토큰 생성: 매칭된 용어 + 매칭되지 않은 글자
  const tokens = [];
  const usedPositions = new Set();

  // 1단계: 매칭된 용어를 토큰으로 추가
  for (const match of glossaryMatches) {
    for (let i = match.position; i < match.position + match.length; i++) {
      usedPositions.add(i);
    }
    // 매칭된 용어 바로 뒤에 현토(한글)가 있는지 확인
    const afterPos = match.position + match.length;
    let hyeonto = '';
    let hyeontoEnd = afterPos;
    for (let i = afterPos; i < inputText.length; i++) {
      const ch = inputText[i];
      if (/[\uAC00-\uD7AF\u3131-\u318E]/.test(ch)) {
        hyeonto += ch;
        hyeontoEnd = i + 1;
        usedPositions.add(i);
      } else {
        break;
      }
    }
    tokens.push({
      surface: match.surface,
      hyeonto: hyeonto,
      char_gloss: [match.meaning],
      pos_candidates: [match.pos],
      function_candidates: [],
      is_buddhist_term: match.category !== '허사',
      term_id: null,
      confidence: match.category === '허사' ? 'medium' : 'high',
      ambiguity: [],
      _position: match.position, // 정렬용 임시 필드
      // 폴백 전용 추가 정보
      reading: getReading(match, lang),
      buddhist_meaning: match.buddhist_meaning || null
    });
  }

  // 2단계: 매칭되지 않은 글자를 개별 토큰으로 추가
  for (let i = 0; i < inputText.length; i++) {
    if (!usedPositions.has(i)) {
      const ch = inputText[i];
      // 문장부호는 건너뜀
      if (/[。，；：、.;,\s]/.test(ch)) continue;
      // 한글(현토)이 단독으로 있으면 건너뜀 (앞 한자에 이미 붙였거나 이어서 처리)
      if (/[\uAC00-\uD7AF\u3131-\u318E]/.test(ch)) continue;

      // 이 한자 뒤에 현토가 붙어있는지 확인
      let hyeonto = '';
      for (let j = i + 1; j < inputText.length; j++) {
        const nextCh = inputText[j];
        if (/[\uAC00-\uD7AF\u3131-\u318E]/.test(nextCh)) {
          if (!usedPositions.has(j)) {
            hyeonto += nextCh;
            usedPositions.add(j);
          }
        } else {
          break;
        }
      }

      tokens.push({
        surface: ch,
        hyeonto: hyeonto,
        char_gloss: ['(사전 미등재)'],
        pos_candidates: ['미분류'],
        function_candidates: [],
        is_buddhist_term: false,
        term_id: null,
        confidence: 'low',
        ambiguity: ['로컬 사전에 없는 글자'],
        _position: i
      });
    }
  }

  // 위치순 정렬 후 _position 필드 제거
  tokens.sort((a, b) => a._position - b._position);
  tokens.forEach(t => delete t._position);

  // 기초 직역 보조 생성
  const glossStr = tokens
    .map(t => `${t.surface}(${t.char_gloss[0]})`)
    .join(' ');

  // 폴백 결과 구성 — API 분석과 동일한 스키마
  return {
    _is_fallback: true, // 폴백 표시 플래그
    input_text: inputText,
    segmentation: {
      clauses: clauses,
      tokens: tokens
    },
    parsing: {
      sentence_type: '(로컬 분석 — 문장 유형 미판정)',
      components: {
        condition: '',
        subject: '',
        adverbial: [],
        predicate: '',
        object: [],
        complement: [],
        omitted_elements: [],
        ambiguity: [fb('ambiguity')]
      },
      literal_translation: `${fb('litPrefix')} ${glossStr}`,
      idiomatic_translation: fb('idioNeeded'),
      grammar_points: [fb('grammarFallback')],
      buddhist_notes: tokens
        .filter(t => t.is_buddhist_term)
        .map(t => `${t.surface}(${t.reading || ''}): ${t.buddhist_meaning || t.char_gloss[0]}`)
    },
    alignment: [],
    verification: {
      issues_found: [fb('issueNote')],
      revised_literal_translation: '',
      revised_idiomatic_translation: '',
      revised_components: {
        condition: '',
        subject: '',
        adverbial: [],
        predicate: '',
        object: [],
        complement: [],
        omitted_elements: [],
        ambiguity: []
      },
      final_notes: [fb('issueNote')]
    }
  };
}


// ───────── 12. 메인 분석 함수 ─────────

/**
 * 전체 분석 파이프라인 실행.
 *
 * mode === 'gemini':
 *   1단계(segmentation) → 2단계(parsing) → 3단계(verification)
 *   실패 시 → 로컬 폴백
 *
 * mode === 'manual':
 *   로컬 폴백만 실행 (사전 태깅 + 절 분리)
 *
 * @param {string} inputText - 원문 (전처리 전)
 * @param {string} apiKey
 * @param {string} mode - 'gemini' | 'manual'
 * @param {function} onStatus - 상태 메시지 콜백 (message, type)
 * @returns {Promise<object>} 최종 분석 결과 JSON
 */
async function analyzeText(inputText, apiKey, mode, onStatus) {
  // 상태 알림 헬퍼
  const status = (msg, type) => {
    if (typeof onStatus === 'function') onStatus(msg, type);
  };

  // 출력 언어
  const lang = getSelectedOutputLang();

  // 전처리
  const statusMessages = {
    preprocessing: {
      ko: '입력 텍스트 전처리 중...',
      en: 'Preprocessing input text...',
      ja: '入力テキストを前処理中...',
      'zh-CN': '正在预处理输入文本...',
      'zh-TW': '正在前處理輸入文字...',
    },
    tagging: {
      ko: '불교 용어 사전 태깅 중...',
      en: 'Tagging Buddhist terminology...',
      ja: '仏教用語辞典タグ付け中...',
      'zh-CN': '正在标注佛教术语...',
      'zh-TW': '正在標註佛教術語...',
    },
    localAnalyzing: {
      ko: '로컬 사전 기반 분석 중...',
      en: 'Analyzing with local dictionary...',
      ja: 'ローカル辞書で分析中...',
      'zh-CN': '正在使用本地词典分析...',
      'zh-TW': '正在使用本地詞典分析...',
    },
    localDone: {
      ko: '로컬 분석 완료',
      en: 'Local analysis complete',
      ja: 'ローカル分析完了',
      'zh-CN': '本地分析完成',
      'zh-TW': '本地分析完成',
    },
    noApiKey: {
      ko: 'API Key가 없어 로컬 분석으로 전환합니다.',
      en: 'No API Key. Switching to local analysis.',
      ja: 'API Keyがないため、ローカル分析に切り替えます。',
      'zh-CN': '无API Key，切换为本地分析。',
      'zh-TW': '無API Key，切換為本地分析。',
    },
    step1: {
      ko: '1단계: 분절(segmentation) 및 구문 분석(parsing) 중...',
      en: 'Step 1: Segmentation and parsing...',
      ja: '第1段階：分節（segmentation）と構文解析（parsing）中...',
      'zh-CN': '第1阶段：分节（segmentation）和句法分析（parsing）中...',
      'zh-TW': '第1階段：分節（segmentation）和句法分析（parsing）中...',
    },
    step3: {
      ko: '3단계: 검증(verification) 중...',
      en: 'Step 3: Verification...',
      ja: '第3段階：検証（verification）中...',
      'zh-CN': '第3阶段：验证（verification）中...',
      'zh-TW': '第3階段：驗證（verification）中...',
    },
    done: {
      ko: '분석 완료!',
      en: 'Analysis complete!',
      ja: '分析完了！',
      'zh-CN': '分析完成！',
      'zh-TW': '分析完成！',
    },
    apiFailed: {
      ko: (msg) => `API 분석 실패: ${msg}. 로컬 분석으로 전환합니다.`,
      en: (msg) => `API analysis failed: ${msg}. Switching to local analysis.`,
      ja: (msg) => `API分析失敗: ${msg}。ローカル分析に切り替えます。`,
      'zh-CN': (msg) => `API分析失败: ${msg}。切换为本地分析。`,
      'zh-TW': (msg) => `API分析失敗: ${msg}。切換為本地分析。`,
    },
    noText: {
      ko: '분석할 텍스트가 없습니다.',
      en: 'No text to analyze.',
      ja: '分析するテキストがありません。',
      'zh-CN': '没有可分析的文本。',
      'zh-TW': '沒有可分析的文字。',
    },
  };
  const sm = (key, arg) => {
    const entry = statusMessages[key]?.[lang] || statusMessages[key]?.['ko'] || key;
    return typeof entry === 'function' ? entry(arg) : entry;
  };

  status(sm('preprocessing'), 'info');
  const normalized = normalizeInput(inputText);
  if (!normalized) {
    throw new Error(sm('noText'));
  }

  // 불교 용어 사전 태깅
  status(sm('tagging'), 'info');
  const glossaryMatches = matchGlossary(normalized, GLOSSARY);
  const buddhistMatches = matchGlossary(normalized, BUDDHIST_TERMS_ONLY);
  const glossaryHints = buildGlossaryHints(buddhistMatches, lang);
  debugLog('사전 태깅 결과:', glossaryMatches.length, '건');

  // 직접 입력 모드 → 로컬 폴백
  if (mode === 'manual') {
    status(sm('localAnalyzing'), 'info');
    const fallback = runLocalFallbackAnalysis(normalized, glossaryMatches);
    status(sm('localDone'), 'success');
    return sanitizeResult(fallback);
  }

  // Gemini 모드
  if (!apiKey) {
    status(sm('noApiKey'), 'warning');
    const fallback = runLocalFallbackAnalysis(normalized, glossaryMatches);
    return fallback;
  }

  try {
    // ── 1단계 + 2단계: Segmentation + Parsing ──
    status(sm('step1'), 'info');
    const firstPass = await firstPassAnalysis(normalized, glossaryHints, apiKey, onStatus, lang);

    // ── 3단계: Verification ──
    status(sm('step3'), 'info');
    const verified = await verifyAnalysis(normalized, firstPass, apiKey, onStatus, lang);

    // 검증 결과를 1차 결과에 병합
    const finalResult = mergeVerification(firstPass, verified);
    finalResult.input_text = normalized;

    status(sm('done'), 'success');
    return sanitizeResult(finalResult);

  } catch (e) {
    debugLog('API 분석 실패, 로컬 폴백으로 전환:', e.message);
    status(sm('apiFailed', e.message), 'warning');
    const fallback = runLocalFallbackAnalysis(normalized, glossaryMatches);
    return fallback;
  }
}


// ───────── 13. 결과 데이터 정제 ─────────

/**
 * API 응답 전체를 순회하여 모든 텍스트 필드에서
 * 깨진 문자·오염 문자를 제거하고, source_span에서 비한자를 제거.
 * 렌더러 레벨 방어에 더해 데이터 레벨에서도 이중 방어.
 * @param {object} data
 * @returns {object}
 */
function sanitizeResult(data) {
  if (!data || typeof data !== 'object') return data;

  // 재귀적으로 모든 문자열 필드 정제
  function clean(val, fieldName) {
    if (val === null || val === undefined) return val;
    if (Array.isArray(val)) return val.map(v => clean(v, fieldName));
    if (typeof val === 'object') {
      const out = {};
      for (const k of Object.keys(val)) out[k] = clean(val[k], k);
      return out;
    }
    if (typeof val !== 'string') return val;
    // source_span: 한자만 허용
    if (fieldName === 'source_span') return sanitizeSurface(fixBrokenUnicode(val));
    // surface: 한자만 허용
    if (fieldName === 'surface') return sanitizeSurface(fixBrokenUnicode(val));
    // 나머지 문자열: fixBrokenUnicode만 적용
    return fixBrokenUnicode(val);
  }

  return clean(data, '');
}


// ───────── 13. 검증 결과 병합 ─────────

/**
 * 1차 분석 결과와 검증 결과를 병합.
 * 검증에서 수정된 번역이 있으면 최종 결과에 우선 반영.
 * @param {object} firstPass
 * @param {object} verified
 * @returns {object}
 */
function mergeVerification(firstPass, verified) {
  // 검증 결과가 완전한 스키마이면 그것을 사용
  if (verified && verified.segmentation && verified.parsing) {
    return verified;
  }

  // 검증 결과가 verification 섹션만 포함하면 1차에 병합
  const result = JSON.parse(JSON.stringify(firstPass));

  if (verified && verified.verification) {
    result.verification = verified.verification;

    // 수정된 번역이 있으면 반영
    if (verified.verification.revised_literal_translation) {
      result.parsing.literal_translation = verified.verification.revised_literal_translation;
    }
    if (verified.verification.revised_idiomatic_translation) {
      result.parsing.idiomatic_translation = verified.verification.revised_idiomatic_translation;
    }
    // 수정된 components가 있으면 반영
    if (verified.verification.revised_components) {
      const rc = verified.verification.revised_components;
      if (rc.subject || rc.predicate) {
        result.parsing.components = { ...result.parsing.components, ...rc };
      }
    }
  }

  // alignment도 검증 결과에 있으면 우선
  if (verified && verified.alignment && Array.isArray(verified.alignment) && verified.alignment.length > 0) {
    result.alignment = verified.alignment;
  }

  return result;
}
