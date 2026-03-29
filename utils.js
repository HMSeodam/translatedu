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
 * confidence 값에 따른 현재 언어의 레이블 반환.
 * @param {string} confidence
 * @returns {string}
 */
function confidenceLabel(confidence) {
  const CONF_LABELS = {
    high:    { ko: '높음', en: 'High',   ja: '高',   'zh-CN': '高',   'zh-TW': '高'   },
    medium:  { ko: '보통', en: 'Medium', ja: '中',   'zh-CN': '中',   'zh-TW': '中'   },
    low:     { ko: '낮음', en: 'Low',    ja: '低',   'zh-CN': '低',   'zh-TW': '低'   },
    unknown: { ko: '미정', en: 'N/A',    ja: '不明', 'zh-CN': '未知', 'zh-TW': '未知' },
  };
  const lang = (typeof getSelectedOutputLang === 'function') ? getSelectedOutputLang() : 'ko';
  const entry = CONF_LABELS[confidence] || CONF_LABELS.unknown;
  return entry[lang] || entry.ko;
}


/**
 * token.surface에서 한자·한문 구두점 외의 문자(한글 등)를 제거.
 * API가 surface에 한국어를 실수로 넣는 경우 방어.
 * @param {string} surface
 * @returns {string}
 */
/**
 * ──────────────────────────────────────────────
 * 깨진 문자 / 오염 문자 처리 유틸리티
 *
 * Gemini API 응답에서 발생할 수 있는 깨짐 패턴:
 *
 * [A] 대체 문자
 *   U+FFFD  : UTF-8 디코딩 실패 시 삽입되는 replacement character
 *
 * [B] 기하학적 도형 (Geometric Shapes, U+25A0–U+25FF)
 *   ■□▲△▼▽◆◇●○◎◉◈◊◌◍◾◿ 등
 *   → 폰트 미지원 한자 위치에 Gemini가 대체 출력하는 기호
 *
 * [C] 블록 원소 (Block Elements, U+2580–U+259F)
 *   ▀▁▂▃▄▅▆▇█▉▊▋▌▍▎▏▐░▒▓
 *   → 브라우저가 폰트 미지원 문자를 렌더링 실패할 때 나타남
 *
 * [D] CJK 구미표
 *   U+3013 〓 : 일본어에서 인식 불가 한자 대신 사용
 *
 * [E] 연속 물음표 / 별표
 *   ???, ***, ___ : Gemini가 인식 불가 문자를 ASCII로 대체
 *
 * [F] Zero-Width / Invisible 문자
 *   U+200B(ZWSP), U+200C(ZWNJ), U+200D(ZWJ),
 *   U+FEFF(BOM), U+00AD(Soft Hyphen)
 *   → 보이지 않지만 텍스트 처리를 방해
 *
 * [G] C0/C1 제어 문자 (U+0000–U+001F, U+007F–U+009F)
 *   → JSON 오염 또는 API 응답 이상 시 삽입
 *   단, \t(U+0009), \n(U+000A), \r(U+000D)은 정상 공백이므로 유지
 * ──────────────────────────────────────────────
 */

// 깨짐 기호 문자 클래스 (정규식 내 재사용)
const _BROKEN_SYMBOLS = '[\\u25A0-\\u25FF\\u2580-\\u259F\\u3013●◆■□▲▽◇◈◉◊]';
const _BROKEN_RE = new RegExp(_BROKEN_SYMBOLS, 'g');
const _BROKEN_MULTI_RE = new RegExp(_BROKEN_SYMBOLS + '{2,}', 'g');
// 한자·한글·일본어 문자 클래스
const _CJK_CHAR = '[\\u4E00-\\u9FFF\\u3400-\\u4DBF\\uAC00-\\uD7AF\\u3040-\\u30FF]';
const _BROKEN_BETWEEN_CJK_RE = new RegExp(
  `(${_CJK_CHAR})${_BROKEN_SYMBOLS}+(${_CJK_CHAR})`, 'g'
);

/**
 * API 응답 텍스트에서 모든 깨짐/오염 문자를 제거.
 * 5개 언어 모두에 동일하게 적용.
 * @param {string} text
 * @returns {string}
 */
function fixBrokenUnicode(text) {
  if (!text) return '';
  return text
    // [A] U+FFFD replacement character
    .replace(/\uFFFD+/g, '')
    // [F] Zero-width / invisible 문자
    .replace(/[\u200B\u200C\u200D\uFEFF\u00AD]+/g, '')
    // [G] 제어 문자 (탭·줄바꿈·CR 제외)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]+/g, '')
    // [D] CJK 구미표 〓
    .replace(/\u3013+/g, '')
    // [B][C] 기하학적 도형·블록 원소 연속 2개 이상 → 제거
    .replace(_BROKEN_MULTI_RE, '')
    // [B][C] 한자·한글·일본어 사이에 낀 단독 깨짐 기호 → 제거
    .replace(_BROKEN_BETWEEN_CJK_RE, '$1$2')
    // [E] 연속 물음표(3개 이상) → 제거
    .replace(/\?{3,}/g, '')
    // [E] 연속 별표(3개 이상) → 제거
    .replace(/\*{3,}/g, '')
    // 텍스트 앞뒤 남은 단독 깨짐 기호 정리
    .replace(new RegExp(`^${_BROKEN_SYMBOLS}+|${_BROKEN_SYMBOLS}+$`, 'g'), '')
    .trim();
}

/**
 * token.surface 필드 정제.
 * surface에는 원문 한자(漢字)와 구두점만 허용.
 * 한글·라틴·가나·깨짐 기호 등 오염 문자 제거.
 * @param {string} surface
 * @returns {string}
 */
function sanitizeSurface(surface) {
  if (!surface) return '';

  // 먼저 fixBrokenUnicode로 공통 깨짐 처리
  let s = fixBrokenUnicode(surface);

  // 한글 음절·자모 제거 (U+AC00–D7AF, U+1100–11FF, U+3130–318F)
  s = s.replace(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]+/g, '');

  // 라틴 문자 제거 (A-Z, a-z) — 단, 한자 독음 괄호 안 내용은 이미 char_gloss에 있으므로 불필요
  s = s.replace(/[A-Za-z]+/g, '');

  // 히라가나·가타카나 제거 (U+3040–30FF)
  s = s.replace(/[\u3040-\u30FF]+/g, '');

  // 남은 앞뒤 공백 정리
  s = s.trim();

  // 정제 후 한자·구두점이 전혀 없으면 원본 반환 (의도치 않은 완전 삭제 방지)
  const hasCJK = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\u3000-\u303F\uFF00-\uFFEF]/.test(s);
  const hasPunct = /[。，、；：！？「」『』（）【】〔〕《》〈〉・…—～·]/.test(s);
  if (!hasCJK && !hasPunct) return surface.trim();

  return s;
}
