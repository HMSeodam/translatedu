/**
 * storage.js
 * ──────────────────────────────────────────────
 * localStorage를 이용한 데이터 저장/불러오기.
 * - API Key 저장 (암호화 없이 로컬 전용)
 * - 마지막 입력 텍스트 저장
 * - 번역 모드 저장
 * - 예외 발생 시 콘솔 경고만 출력하고 앱이 멈추지 않도록 처리
 */

const STORAGE_KEYS = {
  API_KEY: 'translatedu_api_key',
  LAST_INPUT: 'translatedu_last_input',
  TRANSLATION_MODE: 'translatedu_translation_mode',
  OUTPUT_LANG: 'translatedu_output_lang'
};

// ───────── API Key ─────────

/**
 * Gemini API Key를 localStorage에 저장.
 * @param {string} key
 */
function saveApiKey(key) {
  try {
    localStorage.setItem(STORAGE_KEYS.API_KEY, key || '');
  } catch (e) {
    console.warn('[storage] API Key 저장 실패:', e.message);
  }
}

/**
 * 저장된 Gemini API Key를 반환.
 * @returns {string}
 */
function loadApiKey() {
  try {
    return localStorage.getItem(STORAGE_KEYS.API_KEY) || '';
  } catch (e) {
    console.warn('[storage] API Key 불러오기 실패:', e.message);
    return '';
  }
}

// ───────── 마지막 입력 텍스트 ─────────

/**
 * 마지막 입력 원문을 localStorage에 저장.
 * @param {string} text
 */
function saveLastInput(text) {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_INPUT, text || '');
  } catch (e) {
    console.warn('[storage] 입력 텍스트 저장 실패:', e.message);
  }
}

/**
 * 저장된 마지막 입력 원문을 반환.
 * @returns {string}
 */
function loadLastInput() {
  try {
    return localStorage.getItem(STORAGE_KEYS.LAST_INPUT) || '';
  } catch (e) {
    console.warn('[storage] 입력 텍스트 불러오기 실패:', e.message);
    return '';
  }
}

// ───────── 번역 모드 ─────────

/**
 * 번역 모드를 localStorage에 저장.
 * @param {string} mode - 'gemini' | 'manual'
 */
function saveTranslationMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEYS.TRANSLATION_MODE, mode || 'gemini');
  } catch (e) {
    console.warn('[storage] 번역 모드 저장 실패:', e.message);
  }
}

/**
 * 저장된 번역 모드를 반환.
 * @returns {string}
 */
function loadTranslationMode() {
  try {
    return localStorage.getItem(STORAGE_KEYS.TRANSLATION_MODE) || 'gemini';
  } catch (e) {
    console.warn('[storage] 번역 모드 불러오기 실패:', e.message);
    return 'gemini';
  }
}

// ───────── 출력 언어 ─────────

/**
 * 출력 언어를 localStorage에 저장.
 * @param {string} lang - 'ko' | 'en' | 'ja'
 */
function saveOutputLang(lang) {
  try {
    localStorage.setItem(STORAGE_KEYS.OUTPUT_LANG, lang || 'ko');
  } catch (e) {
    console.warn('[storage] 출력 언어 저장 실패:', e.message);
  }
}

/**
 * 저장된 출력 언어를 반환.
 * @returns {string}
 */
function loadOutputLang() {
  try {
    return localStorage.getItem(STORAGE_KEYS.OUTPUT_LANG) || 'ko';
  } catch (e) {
    console.warn('[storage] 출력 언어 불러오기 실패:', e.message);
    return 'ko';
  }
}
