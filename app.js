/**
 * app.js
 * ──────────────────────────────────────────────
 * 메인 애플리케이션 컨트롤러.
 * - DOM 이벤트 바인딩
 * - 전체 실행 흐름 제어
 * - 탭 전환
 * - 초기화 및 상태 복원
 */

// ───────── 앱 초기화 ─────────

document.addEventListener('DOMContentLoaded', () => {
  debugLog('앱 초기화 시작');
  initializeApp();
});

/**
 * 앱 초기화 — 저장된 값 복원, 이벤트 바인딩.
 */
function initializeApp() {
  // 저장된 API Key 복원
  const savedKey = loadApiKey();
  const apiKeyInput = document.getElementById('api-key-input');
  if (apiKeyInput && savedKey) {
    apiKeyInput.value = savedKey;
  }

  // 저장된 입력 텍스트 복원
  const savedInput = loadLastInput();
  const inputTextarea = document.getElementById('input-text');
  if (inputTextarea && savedInput) {
    inputTextarea.value = savedInput;
  }

  // 저장된 번역 모드 복원
  const savedMode = loadTranslationMode();
  setActiveTab(savedMode);

  // 저장된 출력 언어 복원 + 페이지 전체 번역 적용
  const savedLang = loadOutputLang();
  const langSelect = document.getElementById('output-lang-select');
  if (langSelect && savedLang) {
    langSelect.value = savedLang;
  }
  const initialLang = savedLang || 'ko';
  applyI18n(initialLang);
  document.body.setAttribute('data-lang', initialLang);
  // html 태그의 lang 속성도 동적 갱신
  const HTML_LANG_MAP = { ko: 'ko', en: 'en', ja: 'ja', 'zh-CN': 'zh-Hans', 'zh-TW': 'zh-Hant' };
  document.documentElement.lang = HTML_LANG_MAP[initialLang] || 'ko';

  // 이벤트 바인딩
  bindEvents();

  // OCR 모듈 초기화
  OCRModule.init();

  // 결과 영역 숨김
  clearResults();

  debugLog('앱 초기화 완료');
}

/**
 * 이벤트 바인딩.
 */
function bindEvents() {
  // 분석 실행 버튼
  const analyzeBtn = document.getElementById('analyze-btn');
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', handleAnalyze);
  }

  // 탭 버튼
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      setActiveTab(mode);
      saveTranslationMode(mode);
    });
  });

  // API Key 저장 (blur 시)
  const apiKeyInput = document.getElementById('api-key-input');
  if (apiKeyInput) {
    apiKeyInput.addEventListener('blur', () => {
      saveApiKey(apiKeyInput.value.trim());
    });
  }

  // 출력 언어 변경 시 저장 + UI 전체 번역
  const langSelect = document.getElementById('output-lang-select');
  if (langSelect) {
    langSelect.addEventListener('change', () => {
      saveOutputLang(langSelect.value);
      applyI18n(langSelect.value);
      document.body.setAttribute('data-lang', langSelect.value);
      const HTML_LANG_MAP = { ko: 'ko', en: 'en', ja: 'ja', 'zh-CN': 'zh-Hans', 'zh-TW': 'zh-Hant' };
      document.documentElement.lang = HTML_LANG_MAP[langSelect.value] || 'ko';
      // OCR 언어 옵션 텍스트도 갱신
      if (typeof OCRModule !== 'undefined') OCRModule.updateLangOptions(langSelect.value);
    });
  }

  // 입력 텍스트 자동 저장 (입력 시)
  const inputTextarea = document.getElementById('input-text');
  if (inputTextarea) {
    let saveTimer = null;
    inputTextarea.addEventListener('input', () => {
      // 300ms 디바운스
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveLastInput(inputTextarea.value);
      }, 300);
    });
  }

  // API Key 표시/숨기기 토글
  const toggleKeyBtn = document.getElementById('toggle-key-btn');
  if (toggleKeyBtn) {
    toggleKeyBtn.addEventListener('click', () => {
      if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleKeyBtn.textContent = t('btn_hide_key');
      } else {
        apiKeyInput.type = 'password';
        toggleKeyBtn.textContent = t('btn_show_key');
      }
    });
  }

  // 초기화 버튼
  const clearBtn = document.getElementById('clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', handleClear);
  }

  // ───────── OCR 관련 이벤트 ─────────
  const ocrBtn = document.getElementById('ocr-btn');
  if (ocrBtn) {
    ocrBtn.addEventListener('click', () => {
      OCRModule.toggle();
      // OCR 열릴 때 필기 패널 닫기
      const hwPanel = document.getElementById('handwriting-panel');
      if (hwPanel) hwPanel.style.display = 'none';
    });
  }

  // ───────── 필기 입력 관련 이벤트 ─────────
  const handwritingBtn = document.getElementById('handwriting-btn');
  const hwCloseBtn = document.getElementById('hw-close-btn');
  const hwPanel = document.getElementById('handwriting-panel');

  if (handwritingBtn && hwPanel) {
    handwritingBtn.addEventListener('click', () => {
      const isVisible = hwPanel.style.display !== 'none';
      if (isVisible) {
        hwPanel.style.display = 'none';
      } else {
        hwPanel.style.display = 'block';
        // 최초 표시 시 초기화
        handwritingRecognizer.init();

        // 반응형: 캔버스 크기 조정
        const canvas = document.getElementById('hw-canvas');
        if (canvas && window.innerWidth < 640) {
          const wrap = canvas.parentElement;
          if (wrap) {
            const availW = wrap.clientWidth - 4;  // border 고려
            if (availW > 0 && availW < 280) {
              canvas.width = availW;
              canvas.height = availW;
            }
          }
          handwritingRecognizer.clearCanvas();
        }
      }
    });
  }

  if (hwCloseBtn && hwPanel) {
    hwCloseBtn.addEventListener('click', () => {
      hwPanel.style.display = 'none';
    });
  }
}


// ───────── 탭 전환 ─────────

/**
 * 활성 탭 설정.
 * @param {string} mode - 'gemini' | 'manual'
 */
function setActiveTab(mode) {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  });

  // Gemini 설정 영역 표시/숨김
  const geminiSettings = document.getElementById('gemini-settings');
  if (geminiSettings) {
    geminiSettings.style.display = mode === 'gemini' ? 'block' : 'none';
  }

  // 직접 입력 안내 영역 표시/숨김
  const manualInfo = document.getElementById('manual-info');
  if (manualInfo) {
    manualInfo.style.display = mode === 'manual' ? 'block' : 'none';
  }
}

/**
 * 현재 선택된 모드를 반환.
 * @returns {string}
 */
function getCurrentMode() {
  const activeTab = document.querySelector('.tab-btn.active');
  return activeTab ? activeTab.dataset.mode : 'gemini';
}


// ───────── 분석 실행 ─────────

/**
 * 분석 실행 핸들러.
 */
async function handleAnalyze() {
  const inputTextarea = document.getElementById('input-text');
  const apiKeyInput = document.getElementById('api-key-input');
  const analyzeBtn = document.getElementById('analyze-btn');

  const inputText = inputTextarea ? inputTextarea.value.trim() : '';
  const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
  const mode = getCurrentMode();

  // 입력 검증
  if (!inputText) {
    renderStatus(t('status_no_input'), 'error');
    if (inputTextarea) inputTextarea.focus();
    return;
  }

  // Gemini 모드에서 API Key 경고
  if (mode === 'gemini' && !apiKey) {
    renderStatus(t('status_no_api_key'), 'warning');
  }

  // UI 상태 변경
  if (analyzeBtn) {
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = t('status_analyzing');
  }

  // 상태 영역 초기화
  clearStatus();
  clearResults();

  try {
    // 입력 텍스트 저장
    saveLastInput(inputText);

    // 분석 실행
    const result = await analyzeText(inputText, apiKey, mode, renderStatus);

    // 결과 렌더링
    renderAll(result);

    // 결과를 콘솔에도 출력 (디버그용)
    debugLog('최종 분석 결과:', result);

  } catch (e) {
    const ERR_PREFIX = { ko: '오류 발생', en: 'Error', ja: 'エラー', 'zh-CN': '错误', 'zh-TW': '錯誤' };
    const errLang = (typeof getSelectedOutputLang === 'function') ? getSelectedOutputLang() : 'ko';
    renderStatus(`${ERR_PREFIX[errLang] || 'Error'}: ${e.message}`, 'error');
    debugLog('분석 오류:', e);
  } finally {
    // UI 상태 복원
    if (analyzeBtn) {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = t('btn_analyze');
    }
  }
}


// ───────── 초기화 ─────────

/**
 * 입력 및 결과 초기화 핸들러.
 */
function handleClear() {
  const inputTextarea = document.getElementById('input-text');
  if (inputTextarea) inputTextarea.value = '';

  clearStatus();
  clearResults();
  saveLastInput('');

  // 파일 입력도 초기화

  // 필기 패널 닫기 및 초기화
  const hwPanel = document.getElementById('handwriting-panel');
  if (hwPanel) hwPanel.style.display = 'none';
  if (handwritingRecognizer && handwritingRecognizer._initialized) {
    handwritingRecognizer.clearCanvas();
    handwritingRecognizer.clearSelected();
  }

  // OCR 패널 닫기
  OCRModule.close();

  debugLog('초기화 완료');
}


// ───────── 초기화 ─────────

