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
const MAX_RETRY = 2;       // JSON 파싱 실패 시 재시도 횟수
const RETRY_DELAY_MS = 1000;
const QUOTA_RETRY_DELAYS = [5000, 10000, 20000]; // 429 에러 시 백오프 딜레이 (5초, 10초, 20초)

/** Promise 기반 딜레이 유틸리티 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
function buildGlossaryHints(matches) {
  if (!matches || matches.length === 0) return '(해당 없음)';
  return matches.map(m =>
    `- ${m.surface}(${m.reading}): ${m.meaning}` +
    (m.buddhist_meaning ? ` / 불교학적: ${m.buddhist_meaning}` : '') +
    ` [${m.pos}]`
  ).join('\n');
}


// ───────── 5. 사용자 프롬프트 빌드 ─────────

/**
 * USER_PROMPT_TEMPLATE에 실제 값을 채워 프롬프트 생성.
 * @param {string} inputText - 전처리된 원문
 * @param {string} glossaryHints - buildGlossaryHints() 반환값
 * @returns {string}
 */
function buildUserPrompt(inputText, glossaryHints) {
  let prompt = USER_PROMPT_TEMPLATE
    .replace('{{INPUT_TEXT}}', inputText)
    .replace('{{GLOSSARY_HINTS}}', glossaryHints);

  // few-shot 예시 첨부
  prompt += buildFewShotString();
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
      maxOutputTokens: 8192,
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
async function firstPassAnalysis(inputText, glossaryHints, apiKey, onStatus) {
  const userPrompt = buildUserPrompt(inputText, glossaryHints);

  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    try {
      let systemMsg = SYSTEM_PROMPT;
      if (attempt > 0) {
        // 재시도 시 더 강한 JSON 지시
        systemMsg += '\n\n중요: 반드시 유효한 JSON만 출력하라. 설명문, 코드 펜스, 기타 텍스트를 절대 포함하지 마라. JSON 객체 하나만 출력하라.';
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
async function verifyAnalysis(inputText, firstPassJson, apiKey, onStatus) {
  const verificationPrompt = VERIFICATION_PROMPT_TEMPLATE
    .replace('{{INPUT_TEXT}}', inputText)
    .replace('{{FIRST_PASS_JSON}}', JSON.stringify(firstPassJson, null, 2));

  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    try {
      let systemMsg = '너는 한문 불교 문헌 분석 결과를 검증하는 전문 검증기다. 반드시 JSON만 출력하라.';
      if (attempt > 0) {
        systemMsg += '\n\n절대로 JSON 이외의 텍스트를 출력하지 마라.';
        debugLog(`검증 재시도 ${attempt}/${MAX_RETRY}`);
      }

      const rawText = await callGeminiApi(apiKey, systemMsg, verificationPrompt, onStatus);
      const parsed = extractJsonFromResponse(rawText);

      if (!parsed) {
        throw new Error('검증 JSON 파싱 실패');
      }

      debugLog('검증 완료');
      return parsed;

    } catch (e) {
      debugLog(`검증 시도 ${attempt + 1} 실패:`, e.message);
      // 429/403 등 API 레벨 에러는 재시도하지 않고 즉시 전파
      if (e.message.includes('(429)') || e.message.includes('(403)') || e.message.includes('(400)')) {
        debugLog('검증 실패 (API 오류) — 1차 분석 결과를 그대로 사용합니다.');
        return firstPassJson;
      }
      if (attempt < MAX_RETRY) {
        await delay(RETRY_DELAY_MS);
        continue;
      }
      // 검증 실패 시 1차 결과를 그대로 반환 (검증은 선택적 개선 단계)
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
      reading: match.reading,
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
        ambiguity: ['로컬 폴백 분석: 문장성분 자동 판정 불가']
      },
      literal_translation: `[로컬 축자역 보조] ${glossStr}`,
      idiomatic_translation: '(API 분석 필요)',
      grammar_points: ['로컬 폴백: 문법 포인트 자동 추출 불가'],
      buddhist_notes: tokens
        .filter(t => t.is_buddhist_term)
        .map(t => `${t.surface}(${t.reading || ''}): ${t.buddhist_meaning || t.char_gloss[0]}`)
    },
    alignment: [],
    verification: {
      issues_found: ['로컬 폴백 분석 결과입니다. Gemini API를 사용하면 더 정확한 분석을 받을 수 있습니다.'],
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
      final_notes: ['API 연결 실패로 로컬 사전 기반 분석만 제공됩니다.']
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

  // 전처리
  status('입력 텍스트 전처리 중...', 'info');
  const normalized = normalizeInput(inputText);
  if (!normalized) {
    throw new Error('분석할 텍스트가 없습니다.');
  }

  // 불교 용어 사전 태깅
  status('불교 용어 사전 태깅 중...', 'info');
  const glossaryMatches = matchGlossary(normalized, GLOSSARY);
  const buddhistMatches = matchGlossary(normalized, BUDDHIST_TERMS_ONLY);
  const glossaryHints = buildGlossaryHints(buddhistMatches);
  debugLog('사전 태깅 결과:', glossaryMatches.length, '건');

  // 직접 입력 모드 → 로컬 폴백
  if (mode === 'manual') {
    status('로컬 사전 기반 분석 중...', 'info');
    const fallback = runLocalFallbackAnalysis(normalized, glossaryMatches);
    status('로컬 분석 완료', 'success');
    return fallback;
  }

  // Gemini 모드
  if (!apiKey) {
    status('API Key가 없어 로컬 분석으로 전환합니다.', 'warning');
    const fallback = runLocalFallbackAnalysis(normalized, glossaryMatches);
    return fallback;
  }

  try {
    // ── 1단계 + 2단계: Segmentation + Parsing ──
    status('1단계: 분절(segmentation) 및 구문 분석(parsing) 중...', 'info');
    const firstPass = await firstPassAnalysis(normalized, glossaryHints, apiKey, onStatus);

    // ── 3단계: Verification ──
    status('3단계: 검증(verification) 중...', 'info');
    const verified = await verifyAnalysis(normalized, firstPass, apiKey, onStatus);

    // 검증 결과를 1차 결과에 병합
    const finalResult = mergeVerification(firstPass, verified);
    finalResult.input_text = normalized;

    status('분석 완료!', 'success');
    return finalResult;

  } catch (e) {
    debugLog('API 분석 실패, 로컬 폴백으로 전환:', e.message);
    status(`API 분석 실패: ${e.message}. 로컬 분석으로 전환합니다.`, 'warning');
    const fallback = runLocalFallbackAnalysis(normalized, glossaryMatches);
    return fallback;
  }
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
