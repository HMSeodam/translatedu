/**
 * ocr.js
 * ──────────────────────────────────────────────
 * TranslateDu v2.1 — 이미지 OCR 모듈
 * Tesseract.js 기반 CPU 무료 OCR
 * 지원 언어: 한문 번체·간체, 일본어(히라가나·가타카나 포함), 한국어
 */

const OCRModule = (() => {

  // ───────── 상태 ─────────
  let isOpen = false;
  let currentFile = null;
  let isProcessing = false;

  // ───────── 언어 옵션 (4개, 다국어 레이블) ─────────
  const LANG_OPTIONS = [
    {
      value: 'chi_tra',
      labels: {
        ko: '漢文 繁體 (고전 한문)',
        en: '漢文 繁體 (Classical Chinese)',
        ja: '漢文 繁體 (古典漢文)',
        'zh-CN': '漢文 繁體 (古典汉文)',
        'zh-TW': '漢文 繁體 (古典漢文)',
      }
    },
    {
      value: 'chi_tra+kor',
      labels: {
        ko: '漢文+한국어 (현토 포함)',
        en: '漢文+Korean (with Korean particles)',
        ja: '漢文+韓国語 (懸吐含む)',
        'zh-CN': '漢文+韩语 (含懸吐)',
        'zh-TW': '漢文+韓語 (含懸吐)',
      }
    },
    {
      value: 'chi_tra+jpn',
      labels: {
        ko: '漢文+日語 (일본 고전)',
        en: '漢文+Japanese (Classical Japanese)',
        ja: '漢文+日本語 (日本古典)',
        'zh-CN': '漢文+日语 (日本古典)',
        'zh-TW': '漢文+日語 (日本古典)',
      }
    },
    {
      value: 'chi_sim',
      labels: {
        ko: '漢文 简体 (현대 중국어)',
        en: '漢文 简体 (Modern Chinese)',
        ja: '漢文 簡体 (現代中国語)',
        'zh-CN': '漢文 简体 (现代中文)',
        'zh-TW': '漢文 簡體 (現代中文)',
      }
    },
  ];

  // ───────── 패널 HTML 생성 ─────────
  function createPanel() {
    const panel = document.createElement('div');
    panel.id = 'ocr-panel';
    panel.className = 'ocr-panel';
    panel.style.display = 'none';
    panel.innerHTML = `
      <div class="ocr-header">
        <span class="ocr-title" data-i18n="ocr_title">📷 이미지 OCR</span>
        <span class="ocr-hint" data-i18n="ocr_hint">이미지에서 한문 원문을 추출합니다</span>
        <button id="ocr-close-btn" class="btn-close" type="button" title="닫기">✕</button>
      </div>
      <div class="ocr-body">

        <!-- 언어 선택 -->
        <div class="ocr-lang-row">
          <label class="ocr-lang-label" data-i18n="ocr_lang_label">인식 언어</label>
          <select id="ocr-lang-select" class="ocr-lang-select">
            ${LANG_OPTIONS.map(o => `<option value="${o.value}">${o.labels.ko}</option>`).join('')}
          </select>
        </div>

        <!-- 업로드 영역 -->
        <div class="ocr-upload-area" id="ocr-upload-area">
          <input type="file" id="ocr-file-input" accept="image/*" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;">
          <div class="ocr-upload-icon">📄</div>
          <div class="ocr-upload-text" data-i18n="ocr_upload_text">이미지를 끌어다 놓거나 클릭하여 선택</div>
          <div class="ocr-upload-hint">JPG · PNG · WEBP · BMP · TIFF</div>
        </div>

        <!-- 고사본 정확도 경고 -->
        <div class="ocr-warn" id="ocr-warn" data-i18n="ocr_warn">
          ⚠️ 목판본·필사본 등 고사본 이미지는 인식 정확도가 낮을 수 있습니다. 결과를 반드시 확인하고 수정하세요.
        </div>

        <!-- 미리보기 -->
        <div class="ocr-preview-wrap" id="ocr-preview-wrap" style="display:none;">
          <img id="ocr-preview-img" class="ocr-preview-img" alt="미리보기">
          <button id="ocr-reset-btn" class="ocr-reset-btn" type="button" data-i18n="ocr_reset">✕ 다시 선택</button>
        </div>

        <!-- 진행 상태 -->
        <div class="ocr-status-area" id="ocr-status-area" style="display:none;">
          <div class="ocr-status-text" id="ocr-status-text">준비 중...</div>
          <div class="ocr-progress-outer">
            <div class="ocr-progress-inner" id="ocr-progress-bar"></div>
          </div>
        </div>

        <!-- 실행 버튼 -->
        <button id="ocr-run-btn" class="ocr-run-btn" type="button" disabled data-i18n="ocr_run">OCR 실행 — 원문 추출</button>

        <!-- 결과 -->
        <div class="ocr-result-wrap" id="ocr-result-wrap" style="display:none;">
          <div class="ocr-result-header">
            <span class="ocr-result-label" data-i18n="ocr_result_label">인식 결과</span>
            <span class="ocr-result-meta" id="ocr-result-meta"></span>
          </div>
          <textarea id="ocr-result-text" class="ocr-result-text" rows="6" spellcheck="false"></textarea>
          <div class="ocr-result-actions">
            <button id="ocr-insert-btn" class="ocr-btn-primary" type="button" data-i18n="ocr_insert">원문 입력란에 붙여넣기</button>
            <button id="ocr-copy-btn" class="ocr-btn-secondary" type="button" data-i18n="ocr_copy">복사</button>
          </div>
        </div>

      </div>
    `;
    return panel;
  }

  // ───────── 초기화 ─────────
  function init() {
    // 패널 삽입 (필기 패널 아래)
    const hwPanel = document.getElementById('handwriting-panel');
    if (!hwPanel) return;
    const panel = createPanel();
    hwPanel.insertAdjacentElement('afterend', panel);

    bindEvents();
  }

  // ───────── 이벤트 바인딩 ─────────
  function bindEvents() {
    // 닫기
    document.getElementById('ocr-close-btn').addEventListener('click', close);

    // 파일 선택
    const fileInput = document.getElementById('ocr-file-input');
    fileInput.addEventListener('change', e => {
      if (e.target.files[0]) handleFile(e.target.files[0]);
    });

    // 드래그앤드롭
    const uploadArea = document.getElementById('ocr-upload-area');
    uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('dragover'); });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
    uploadArea.addEventListener('drop', e => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });

    // 다시 선택
    document.getElementById('ocr-reset-btn').addEventListener('click', resetUpload);

    // OCR 실행
    document.getElementById('ocr-run-btn').addEventListener('click', runOCR);

    // 붙여넣기
    document.getElementById('ocr-insert-btn').addEventListener('click', insertToMain);

    // 복사
    document.getElementById('ocr-copy-btn').addEventListener('click', copyResult);
  }

  // ───────── 언어 옵션 텍스트 업데이트 ─────────
  function updateLangOptions(uiLang) {
    const select = document.getElementById('ocr-lang-select');
    if (!select) return;
    const currentVal = select.value;
    const langKey = ['ko','en','ja','zh-CN','zh-TW'].includes(uiLang) ? uiLang : 'ko';
    select.innerHTML = LANG_OPTIONS.map(o =>
      `<option value="${o.value}"${o.value === currentVal ? ' selected' : ''}>${o.labels[langKey]}</option>`
    ).join('');
  }

  // ───────── 열기/닫기 ─────────
  function open() {
    const panel = document.getElementById('ocr-panel');
    if (!panel) return;
    isOpen = true;
    panel.style.display = 'block';
    const lang = document.getElementById('output-lang-select')?.value || 'ko';
    updateLangOptions(lang);
    if (typeof applyI18n === 'function') applyI18n(lang);
  }

  function close() {
    const panel = document.getElementById('ocr-panel');
    if (panel) panel.style.display = 'none';
    isOpen = false;
  }

  function toggle() {
    isOpen ? close() : open();
  }

  // ───────── 파일 처리 ─────────
  function handleFile(file) {
    if (!file.type.startsWith('image/')) return;
    currentFile = file;
    const url = URL.createObjectURL(file);
    showPreview(url);
  }

  function showPreview(url) {
    document.getElementById('ocr-upload-area').style.display = 'none';
    document.getElementById('ocr-preview-wrap').style.display = 'block';
    document.getElementById('ocr-preview-img').src = url;
    document.getElementById('ocr-run-btn').disabled = false;
    document.getElementById('ocr-result-wrap').style.display = 'none';
    document.getElementById('ocr-status-area').style.display = 'none';
  }

  function resetUpload() {
    currentFile = null;
    document.getElementById('ocr-file-input').value = '';
    document.getElementById('ocr-upload-area').style.display = 'flex';
    document.getElementById('ocr-preview-wrap').style.display = 'none';
    document.getElementById('ocr-run-btn').disabled = true;
    document.getElementById('ocr-result-wrap').style.display = 'none';
    document.getElementById('ocr-status-area').style.display = 'none';
  }

  // ───────── i18n 헬퍼 ─────────
  function ot(key) {
    // i18n.js의 t() 함수 사용, 없으면 fallback
    if (typeof t === 'function') return t(key) || key;
    return key;
  }

  // ───────── OCR 실행 ─────────
  async function runOCR() {
    if (!currentFile || isProcessing) return;
    if (typeof Tesseract === 'undefined') {
      alert(ot('ocr_loading_init'));
      return;
    }

    isProcessing = true;
    const lang = document.getElementById('ocr-lang-select').value;
    const runBtn = document.getElementById('ocr-run-btn');
    const statusArea = document.getElementById('ocr-status-area');
    const statusText = document.getElementById('ocr-status-text');
    const progressBar = document.getElementById('ocr-progress-bar');

    runBtn.disabled = true;
    runBtn.textContent = ot('ocr_running');
    statusArea.style.display = 'block';
    progressBar.style.width = '0%';
    statusText.textContent = ot('ocr_loading_init');
    const startTime = Date.now();

    try {
      const worker = await Tesseract.createWorker(lang, 1, {
        logger: m => {
          const pct = m.progress ? Math.round(m.progress * 100) : 0;
          if (m.status === 'recognizing text') {
            progressBar.style.width = pct + '%';
            statusText.textContent = `${ot('ocr_loading_recog')} ${pct}%`;
          } else if (m.status === 'loading tesseract core' || m.status === 'initializing tesseract') {
            statusText.textContent = ot('ocr_loading_init');
            if (m.progress) progressBar.style.width = pct + '%';
          } else if (m.status === 'loading language traineddata' || m.status === 'initializing api') {
            statusText.textContent = ot('ocr_loading_lang');
            if (m.progress) progressBar.style.width = pct + '%';
          } else if (m.status) {
            statusText.textContent = ot('ocr_loading_init');
          }
        }
      });

      const result = await worker.recognize(currentFile);
      await worker.terminate();

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const text = result.data.text.trim();
      const conf = Math.round(result.data.confidence);

      statusText.textContent = ot('ocr_loading_done');
      progressBar.style.width = '100%';
      showResult(text, conf, elapsed);

    } catch (err) {
      statusText.textContent = '오류: ' + err.message;
    } finally {
      isProcessing = false;
      runBtn.disabled = false;
      runBtn.textContent = ot('ocr_run');
    }
  }

  // ───────── 결과 표시 ─────────
  function showResult(text, conf, elapsed) {
    document.getElementById('ocr-status-area').style.display = 'none';
    const wrap = document.getElementById('ocr-result-wrap');
    const textarea = document.getElementById('ocr-result-text');
    const meta = document.getElementById('ocr-result-meta');

    textarea.value = text || '';
    const charCount = [...text].filter(c => c.trim()).length;
    const confLabel = conf >= 70 ? ot('ocr_conf_good') : conf >= 40 ? ot('ocr_conf_mid') : ot('ocr_conf_low');
    meta.textContent = `${charCount}${ot('ocr_chars')} · ${ot('ocr_confidence')} ${conf}% (${confLabel}) · ${elapsed}${ot('ocr_seconds')}`;
    wrap.style.display = 'block';
  }

  // ───────── 결과 활용 ─────────
  function insertToMain() {
    const text = document.getElementById('ocr-result-text').value.trim();
    if (!text) return;
    const mainTextarea = document.getElementById('input-text');
    if (mainTextarea) {
      mainTextarea.value = text;
      mainTextarea.dispatchEvent(new Event('input')); // 자동저장 트리거
    }
    close();
    // 입력란으로 스크롤
    mainTextarea?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function copyResult() {
    const text = document.getElementById('ocr-result-text').value;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('ocr-copy-btn');
      const orig = btn.textContent;
      btn.textContent = '✓';
      setTimeout(() => btn.textContent = ot('ocr_copy'), 1500);
    });
  }

  // ───────── 공개 API ─────────
  return { init, open, close, toggle, updateLangOptions };

})();
