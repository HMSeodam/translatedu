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
  const ocrUploadBtn = document.getElementById('ocr-upload-btn');
  const ocrFileInput = document.getElementById('ocr-file-input');
  const ocrClearBtn = document.getElementById('ocr-clear-btn');

  if (ocrUploadBtn && ocrFileInput) {
    ocrUploadBtn.addEventListener('click', () => {
      ocrFileInput.click();
    });

    ocrFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        handleOcrUpload(file);
      }
    });
  }

  if (ocrClearBtn) {
    ocrClearBtn.addEventListener('click', () => {
      hideOcrPreview();
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
  hideOcrPreview();
  saveLastInput('');

  // 파일 입력도 초기화
  const ocrFileInput = document.getElementById('ocr-file-input');
  if (ocrFileInput) ocrFileInput.value = '';

  // 필기 패널 닫기 및 초기화
  const hwPanel = document.getElementById('handwriting-panel');
  if (hwPanel) hwPanel.style.display = 'none';
  if (handwritingRecognizer && handwritingRecognizer._initialized) {
    handwritingRecognizer.clearCanvas();
    handwritingRecognizer.clearSelected();
  }

  debugLog('초기화 완료');
}


// ───────── OCR 이미지 처리 (브라우저 ONNX) ─────────

/**
 * OCR 이미지 업로드 핸들러.
 * 브라우저에서 직접 ONNX 모델을 실행하여 한자를 인식한다.
 * @param {File} file - 사용자가 선택한 이미지 파일
 */
async function handleOcrUpload(file) {
  const ocrBtn      = document.getElementById('ocr-upload-btn');
  const previewArea = document.getElementById('ocr-preview-area');
  const previewImg  = document.getElementById('ocr-preview-img');
  const filenameSpan = document.getElementById('ocr-filename');
  const statusSpan  = document.getElementById('ocr-status');
  const inputTextarea = document.getElementById('input-text');
  const apiKeyInput = document.getElementById('api-key-input');

  // 파일 검증
  if (file.size > 20 * 1024 * 1024) { renderStatus(t('status_file_too_large'), 'error'); return; }
  if (!file.type.startsWith('image/')) { renderStatus(t('status_image_only'), 'error'); return; }

  // 미리보기
  if (previewArea) previewArea.style.display = 'block';
  if (filenameSpan) filenameSpan.textContent = file.name;
  if (statusSpan) { statusSpan.textContent = t('status_ocr_loading'); statusSpan.className = 'ocr-status processing'; }

  const objectUrl = URL.createObjectURL(file);
  if (previewImg) { previewImg.src = objectUrl; previewImg.style.display = 'block'; }

  // 프로그레스 바
  const previewContent = document.querySelector('.ocr-preview-content');
  let progressBar = document.getElementById('ocr-progress');
  if (!progressBar && previewContent) {
    progressBar = document.createElement('div');
    progressBar.id = 'ocr-progress';
    progressBar.className = 'ocr-progress-bar';
    previewContent.appendChild(progressBar);
  }
  if (progressBar) progressBar.style.display = 'block';

  if (ocrBtn) { ocrBtn.disabled = true; ocrBtn.textContent = t('btn_ocr_recognizing'); }

  // 상태 콜백
  const onProgress = (msg, pct) => {
    if (statusSpan) { statusSpan.textContent = msg; statusSpan.className = 'ocr-status processing'; }
    debugLog(`[OCR] ${msg} (${pct}%)`);
  };

  const FALLBACK_THRESHOLD = 3; // 인식 문자 수가 이 이하면 Gemini로 전환
  const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';

  try {
    // ── 1단계: ONNX OCR 시도 (고전 문헌 스캔용) ──
    const ONNX_TRYING = {
      ko: '📜 고전 문헌 OCR 시도 중...',
      en: '📜 Trying classical document OCR...',
      ja: '📜 古典文献OCR を試みています...',
      'zh-CN': '📜 正在尝试古典文献OCR...',
      'zh-TW': '📜 正在嘗試古典文獻OCR...',
    };
    const lang = (typeof getSelectedOutputLang === 'function') ? getSelectedOutputLang() : 'ko';
    if (statusSpan) { statusSpan.textContent = ONNX_TRYING[lang] || ONNX_TRYING.ko; statusSpan.className = 'ocr-status processing'; }

    let onnxResult = null;
    let onnxFailed = false;
    try {
      const img = await loadImageFromFile(file);
      onnxResult = await hanjaOCR.recognize(img, onProgress);
    } catch (onnxErr) {
      debugLog('[OCR] ONNX 실패:', onnxErr.message);
      onnxFailed = true;
    }

    if (progressBar) progressBar.style.display = 'none';

    // ONNX 성공 + 충분한 문자 수 → 결과 사용
    const onnxText = onnxResult && onnxResult.text ? onnxResult.text.trim() : '';
    const onnxChars = onnxResult ? (onnxResult.totalChars || 0) : 0;

    if (!onnxFailed && onnxChars > FALLBACK_THRESHOLD) {
      const existing = inputTextarea ? inputTextarea.value.trim() : '';
      inputTextarea.value = existing ? existing + '\n' + onnxText : onnxText;
      if (inputTextarea) saveLastInput(inputTextarea.value);
      if (statusSpan) {
        statusSpan.textContent = `✓ ${onnxChars}${t('status_ocr_complete')}`;
        statusSpan.className = 'ocr-status done';
      }
      debugLog('[OCR] ONNX 성공:', onnxChars, '자');
      return;
    }

    // ── 2단계: Gemini Vision OCR로 자동 전환 ──
    const GEMINI_FALLBACK = {
      ko: `🤖 Gemini Vision OCR로 전환 중...${!apiKey ? ' (API Key 없음)' : ''}`,
      en: `🤖 Switching to Gemini Vision OCR...${!apiKey ? ' (No API Key)' : ''}`,
      ja: `🤖 Gemini Vision OCR に切り替え中...${!apiKey ? '（API Keyなし）' : ''}`,
      'zh-CN': `🤖 切换到Gemini Vision OCR...${!apiKey ? '（无API Key）' : ''}`,
      'zh-TW': `🤖 切換到Gemini Vision OCR...${!apiKey ? '（無API Key）' : ''}`,
    };
    if (statusSpan) { statusSpan.textContent = GEMINI_FALLBACK[lang] || GEMINI_FALLBACK.ko; statusSpan.className = 'ocr-status processing'; }
    debugLog('[OCR] ONNX 결과 부족 → Gemini Vision 전환');

    if (!apiKey) {
      // API Key 없으면 ONNX 결과라도 있으면 사용, 없으면 안내
      if (onnxText) {
        const existing = inputTextarea ? inputTextarea.value.trim() : '';
        inputTextarea.value = existing ? existing + '\n' + onnxText : onnxText;
        if (inputTextarea) saveLastInput(inputTextarea.value);
        if (statusSpan) { statusSpan.textContent = `✓ ${onnxChars}${t('status_ocr_complete')}`; statusSpan.className = 'ocr-status done'; }
      } else {
        if (statusSpan) { statusSpan.textContent = `✕ ${t('status_ocr_no_text')}`; statusSpan.className = 'ocr-status error'; }
        renderStatus(t('status_ocr_no_apikey') || 'Gemini OCR을 사용하려면 API Key를 입력해주세요.', 'warning');
      }
      return;
    }

    const geminiResult = await geminiVisionOCR(file, apiKey, onProgress);

    if (geminiResult && geminiResult.text) {
      const existing = inputTextarea ? inputTextarea.value.trim() : '';
      inputTextarea.value = existing ? existing + '\n' + geminiResult.text : geminiResult.text;
      if (inputTextarea) saveLastInput(inputTextarea.value);
      if (statusSpan) {
        statusSpan.textContent = `✓ ${geminiResult.totalChars}${t('status_ocr_gemini_complete')}`;
        statusSpan.className = 'ocr-status done';
      }
      debugLog('[OCR] Gemini Vision 성공:', geminiResult.totalChars, '자');
    } else {
      if (statusSpan) { statusSpan.textContent = `✕ ${t('status_ocr_no_text')}`; statusSpan.className = 'ocr-status error'; }
      renderStatus(t('status_ocr_no_text'), 'warning');
    }

  } catch (e) {
    if (progressBar) progressBar.style.display = 'none';
    const errMsg = e.message || '알 수 없는 오류';
    if (statusSpan) { statusSpan.textContent = `✕ ${errMsg}`; statusSpan.className = 'ocr-status error'; }
    renderStatus(`${t('status_ocr_error')}: ${errMsg}`, 'error');
    debugLog('[OCR] 오류:', e);
  } finally {
    if (ocrBtn) { ocrBtn.disabled = false; ocrBtn.textContent = t('btn_ocr'); }
    if (previewImg && previewImg.src && previewImg.src.startsWith('blob:')) URL.revokeObjectURL(previewImg.src);
  }
}


// ───────── 초기화 ─────────

/**
 * 입력 및 결과 초기화 핸들러.
 */
function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지 로딩 실패'));
    };
    img.src = url;
  });
}


/**
 * OCR 미리보기 영역 숨기기.
 */
function hideOcrPreview() {
  const previewArea = document.getElementById('ocr-preview-area');
  const previewImg = document.getElementById('ocr-preview-img');
  const ocrFileInput = document.getElementById('ocr-file-input');

  if (previewArea) previewArea.style.display = 'none';
  if (previewImg) {
    previewImg.src = '';
    previewImg.style.display = 'none';
  }
  if (ocrFileInput) ocrFileInput.value = '';
}


// ───────── Gemini Vision OCR 핸들러 ─────────

/**
 * Gemini Vision OCR 업로드 핸들러.
 * 현대 폰트·스크린샷·디지털 이미지 인식용.
 * @param {File} file
 */
async function handleGeminiOcrUpload(file) {
  const ocrGeminiBtn = document.getElementById('ocr-gemini-btn');
  const previewArea  = document.getElementById('ocr-preview-area');
  const previewImg   = document.getElementById('ocr-preview-img');
  const filenameSpan = document.getElementById('ocr-filename');
  const statusSpan   = document.getElementById('ocr-status');
  const inputTextarea = document.getElementById('input-text');
  const apiKeyInput  = document.getElementById('api-key-input');

  // 파일 크기 제한
  if (file.size > 20 * 1024 * 1024) {
    renderStatus(t('status_file_too_large'), 'error');
    return;
  }
  if (!file.type.startsWith('image/')) {
    renderStatus(t('status_image_only'), 'error');
    return;
  }

  // API Key 확인
  const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
  if (!apiKey) {
    renderStatus(t('status_ocr_no_apikey'), 'error');
    return;
  }

  // 미리보기 표시
  if (previewArea) previewArea.style.display = 'block';
  if (filenameSpan) filenameSpan.textContent = file.name;
  if (statusSpan) {
    statusSpan.textContent = t('status_ocr_gemini_processing');
    statusSpan.className = 'ocr-status processing';
  }

  const objectUrl = URL.createObjectURL(file);
  if (previewImg) {
    previewImg.src = objectUrl;
    previewImg.style.display = 'block';
  }

  // 버튼 비활성화
  if (ocrGeminiBtn) {
    ocrGeminiBtn.disabled = true;
    ocrGeminiBtn.textContent = t('btn_ocr_recognizing');
  }

  try {
    const onProgress = (msg, pct) => {
      if (statusSpan) {
        statusSpan.textContent = msg;
        statusSpan.className = 'ocr-status processing';
      }
      debugLog(`[Gemini OCR] ${msg} (${pct}%)`);
    };

    const result = await geminiVisionOCR(file, apiKey, onProgress);

    if (result.text) {
      const existing = inputTextarea ? inputTextarea.value.trim() : '';
      inputTextarea.value = existing ? existing + '\n' + result.text : result.text;
      if (inputTextarea) saveLastInput(inputTextarea.value);

      if (statusSpan) {
        statusSpan.textContent = `✓ ${result.totalChars}${t('status_ocr_gemini_complete')}`;
        statusSpan.className = 'ocr-status done';
      }
      debugLog('Gemini OCR 완료:', result.totalChars, '자');
    } else {
      if (statusSpan) {
        statusSpan.textContent = `✕ ${t('status_ocr_no_text')}`;
        statusSpan.className = 'ocr-status error';
      }
      renderStatus(t('status_ocr_no_text'), 'warning');
    }

  } catch (e) {
    const errMsg = e.message || '알 수 없는 오류';
    if (statusSpan) {
      statusSpan.textContent = `✕ ${errMsg}`;
      statusSpan.className = 'ocr-status error';
    }
    renderStatus(`${t('status_ocr_error')}: ${errMsg}`, 'error');
    debugLog('Gemini OCR 오류:', e);
  } finally {
    if (ocrGeminiBtn) {
      ocrGeminiBtn.disabled = false;
      ocrGeminiBtn.textContent = t('btn_ocr_gemini');
    }
    if (previewImg && previewImg.src.startsWith('blob:')) {
      URL.revokeObjectURL(previewImg.src);
    }
  }
}
