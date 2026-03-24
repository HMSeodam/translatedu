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
        toggleKeyBtn.textContent = '숨기기';
      } else {
        apiKeyInput.type = 'password';
        toggleKeyBtn.textContent = '표시';
      }
    });
  }

  // 초기화 버튼
  const clearBtn = document.getElementById('clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', handleClear);
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
    renderStatus('분석할 한문 원문을 입력해 주세요.', 'error');
    if (inputTextarea) inputTextarea.focus();
    return;
  }

  // Gemini 모드에서 API Key 경고
  if (mode === 'gemini' && !apiKey) {
    renderStatus('Gemini API Key가 입력되지 않았습니다. 로컬 분석으로 진행합니다.', 'warning');
  }

  // UI 상태 변경
  if (analyzeBtn) {
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = '분석 중...';
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
    renderStatus(`오류 발생: ${e.message}`, 'error');
    debugLog('분석 오류:', e);
  } finally {
    // UI 상태 복원
    if (analyzeBtn) {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = '분석 실행';
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

  debugLog('초기화 완료');
}
