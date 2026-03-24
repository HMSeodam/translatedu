/**
 * utils.js
 * ──────────────────────────────────────────────
 * 공통 유틸리티 함수 모음.
 * - 텍스트 정규화
 * - 안전한 JSON 파싱
 * - 디버그 로깅
 * - 딜레이 헬퍼
 */

/**
 * 전각/반각 혼재 정규화 — 전각 알파벳·숫자·기본 기호를 반각으로 변환.
 * 한문 문장부호(。，、；：)는 보존한다.
 * @param {string} text
 * @returns {string}
 */
function normalizeFullWidth(text) {
  // 전각 알파벳·숫자·기호(U+FF01~FF5E) → 반각(U+0021~007E)
  return text.replace(/[\uFF01-\uFF5E]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
  );
}

/**
 * 불필요한 공백을 제거하되 문장부호는 보존.
 * @param {string} text
 * @returns {string}
 */
function trimWhitespace(text) {
  // 연속 공백 → 단일 공백, 앞뒤 공백 제거
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * 입력 전처리 파이프라인: 전각 정규화 → 공백 정리.
 * 한문 원문을 현대 중국어로 바꾸지 않음.
 * @param {string} text
 * @returns {string}
 */
function normalizeInput(text) {
  if (!text) return '';
  let result = text;
  result = normalizeFullWidth(result);
  result = trimWhitespace(result);
  return result;
}

/**
 * 모델 응답에서 JSON만 안전하게 추출.
 * - 코드 펜스(```json … ```) 안의 내용 추출
 * - 중괄호로 시작하는 JSON 블록 추출
 * - JSON 내부 제어문자 정리
 * - 잘린 JSON 복구 시도
 * - 실패 시 null 반환
 * @param {string} rawText
 * @returns {object|null}
 */
function safeParseJson(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  /**
   * JSON 문자열 내부의 문제를 정리하고 파싱 시도.
   * - 문자열 값 안의 실제 줄바꿈을 \\n으로 치환
   * - 제어문자 제거
   */
  function cleanAndParse(text) {
    // 1차: 그대로 시도
    try {
      return JSON.parse(text);
    } catch (e) {
      // 실패하면 정리 후 재시도
    }

    // 2차: JSON 문자열 내부의 줄바꿈/탭을 이스케이프
    let cleaned = text;
    // 문자열 값 안의 실제 개행을 \\n으로 치환
    cleaned = cleaned.replace(/"((?:[^"\\]|\\.)*)"/g, (match) => {
      return match
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
    });
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      // 계속 시도
    }

    // 3차: 제어문자 전부 제거 (문자열 외부)
    cleaned = text.replace(/[\x00-\x1F\x7F]/g, ' ');
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      // 실패
    }

    return null;
  }

  /**
   * 잘린 JSON을 닫는 괄호로 복구 시도.
   */
  function tryRepairTruncated(text) {
    let repaired = text.trim();
    // 열린 중괄호/대괄호 수 세기
    let braces = 0, brackets = 0;
    let inString = false, escaped = false;
    for (const ch of repaired) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') braces++;
      else if (ch === '}') braces--;
      else if (ch === '[') brackets++;
      else if (ch === ']') brackets--;
    }
    // 닫는 괄호 부족분 추가
    while (brackets > 0) { repaired += ']'; brackets--; }
    while (braces > 0) { repaired += '}'; braces--; }
    return cleanAndParse(repaired);
  }

  // 1) 코드 펜스 안의 JSON 추출
  const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    const result = cleanAndParse(fenceMatch[1].trim());
    if (result) return result;
    debugLog('코드 펜스 JSON 파싱 실패');
  }

  // 2) 첫 번째 { ~ 마지막 } 블록 추출
  const startIdx = rawText.indexOf('{');
  const endIdx = rawText.lastIndexOf('}');
  if (startIdx !== -1 && endIdx > startIdx) {
    const block = rawText.substring(startIdx, endIdx + 1);
    const result = cleanAndParse(block);
    if (result) return result;
    debugLog('중괄호 블록 JSON 파싱 실패');
  }

  // 3) 전체 문자열 시도
  const result = cleanAndParse(rawText.trim());
  if (result) return result;

  // 4) 잘린 JSON 복구 시도 (모델이 maxOutputTokens에 걸려 중간에 끊긴 경우)
  if (startIdx !== -1) {
    const truncated = rawText.substring(startIdx);
    const repaired = tryRepairTruncated(truncated);
    if (repaired) {
      debugLog('잘린 JSON 복구 성공');
      return repaired;
    }
  }

  debugLog('모든 JSON 파싱 시도 실패');
  return null;
}

/**
 * 개발용 디버그 로그. 콘솔에만 출력.
 * @param {...any} args
 */
function debugLog(...args) {
  console.log('[TranslateDu]', ...args);
}

/**
 * 프로미스 기반 딜레이.
 * @param {number} ms 밀리초
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 간단한 HTML 이스케이프.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * confidence 값에 따른 CSS 클래스 반환.
 * @param {string} confidence - 'high' | 'medium' | 'low'
 * @returns {string}
 */
function confidenceClass(confidence) {
  switch (confidence) {
    case 'high': return 'conf-high';
    case 'medium': return 'conf-medium';
    case 'low': return 'conf-low';
    default: return 'conf-unknown';
  }
}

/**
 * confidence 값에 따른 한국어 레이블 반환.
 * @param {string} confidence
 * @returns {string}
 */
function confidenceLabel(confidence) {
  switch (confidence) {
    case 'high': return '높음';
    case 'medium': return '보통';
    case 'low': return '낮음';
    default: return '미정';
  }
}
