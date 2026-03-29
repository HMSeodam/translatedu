/**
 * handwriting.js
 * ──────────────────────────────────────────────
 * 한자 필기 인식 모듈.
 *
 * Canvas에서 사용자 필기 입력을 받고,
 * Google Input Tools (Handwriting) API로 인식 후보를 반환한다.
 *
 * API: Google의 공개 필기 인식 엔드포인트 (무료, 키 불필요)
 * 지원: 마우스 + 터치 입력
 */

// ───────── 설정 ─────────

const HW_CONFIG = {
  API_URL: 'https://inputtools.google.com/request?itc=ja-t-i0-handwrit&app=translate',
  CANVAS_LINE_WIDTH: 4,
  CANVAS_LINE_COLOR: '#1a1a1a',
  CANVAS_BG_COLOR: '#ffffff',
  // 인식 요청 디바운스 (ms)
  RECOGNIZE_DELAY: 400,
  // 최대 후보 수
  MAX_CANDIDATES: 10,
};


// ───────── HandwritingRecognizer ─────────

class HandwritingRecognizer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.isDrawing = false;
    this.strokes = [];       // 전체 스트로크: [[{x,y,t},...], ...]
    this.currentStroke = [];  // 현재 진행 중인 스트로크
    this.selectedChars = [];  // 사용자가 선택한 글자 대기열
    this._recognizeTimer = null;
    this._initialized = false;
  }

  /**
   * 패널 초기화 — DOM 바인딩.
   */
  init() {
    if (this._initialized) return;

    this.canvas = document.getElementById('hw-canvas');
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this._setupCanvas();
    this._bindCanvasEvents();
    this._bindButtonEvents();
    this._initialized = true;
  }

  /**
   * 캔버스 초기 설정.
   */
  _setupCanvas() {
    const ctx = this.ctx;
    ctx.fillStyle = HW_CONFIG.CANVAS_BG_COLOR;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.strokeStyle = HW_CONFIG.CANVAS_LINE_COLOR;
    ctx.lineWidth = HW_CONFIG.CANVAS_LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 십자 가이드 (연하게)
    this._drawGuide();
  }

  /**
   * 캔버스 십자 가이드 그리기.
   */
  _drawGuide() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.save();
    ctx.strokeStyle = '#e5e1d8';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);

    // 가로 중앙선
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // 세로 중앙선
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();

    ctx.restore();

    // 복원
    ctx.strokeStyle = HW_CONFIG.CANVAS_LINE_COLOR;
    ctx.lineWidth = HW_CONFIG.CANVAS_LINE_WIDTH;
    ctx.setLineDash([]);
  }

  /**
   * 캔버스 이벤트 바인딩 (마우스 + 터치).
   */
  _bindCanvasEvents() {
    const canvas = this.canvas;

    // 마우스
    canvas.addEventListener('mousedown', (e) => this._startStroke(e));
    canvas.addEventListener('mousemove', (e) => this._continueStroke(e));
    canvas.addEventListener('mouseup', () => this._endStroke());
    canvas.addEventListener('mouseleave', () => this._endStroke());

    // 터치
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this._startStroke(e.touches[0]);
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      this._continueStroke(e.touches[0]);
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this._endStroke();
    }, { passive: false });
  }

  /**
   * 버튼 이벤트 바인딩.
   */
  _bindButtonEvents() {
    const clearCanvasBtn = document.getElementById('hw-clear-canvas');
    const undoStrokeBtn = document.getElementById('hw-undo-stroke');
    const insertBtn = document.getElementById('hw-insert-btn');
    const clearSelectedBtn = document.getElementById('hw-clear-selected');

    if (clearCanvasBtn) {
      clearCanvasBtn.addEventListener('click', () => this.clearCanvas());
    }

    if (undoStrokeBtn) {
      undoStrokeBtn.addEventListener('click', () => this.undoStroke());
    }

    if (insertBtn) {
      insertBtn.addEventListener('click', () => this.insertToTextarea());
    }

    if (clearSelectedBtn) {
      clearSelectedBtn.addEventListener('click', () => this.clearSelected());
    }
  }

  /**
   * 좌표 추출 (마우스/터치 공용).
   */
  _getPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      t: Date.now(),
    };
  }

  // ───────── 스트로크 처리 ─────────

  _startStroke(e) {
    this.isDrawing = true;
    const pos = this._getPos(e);
    this.currentStroke = [pos];

    this.ctx.beginPath();
    this.ctx.moveTo(pos.x, pos.y);
  }

  _continueStroke(e) {
    if (!this.isDrawing) return;
    const pos = this._getPos(e);
    this.currentStroke.push(pos);

    this.ctx.lineTo(pos.x, pos.y);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(pos.x, pos.y);
  }

  _endStroke() {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    if (this.currentStroke.length > 1) {
      this.strokes.push([...this.currentStroke]);
      this._scheduleRecognize();
    }
    this.currentStroke = [];
  }

  /**
   * 인식 요청 디바운스.
   */
  _scheduleRecognize() {
    clearTimeout(this._recognizeTimer);
    this._recognizeTimer = setTimeout(() => {
      this._recognize();
    }, HW_CONFIG.RECOGNIZE_DELAY);
  }

  // ───────── Google API 인식 ─────────

  async _recognize() {
    if (this.strokes.length === 0) return;

    const candidatesEl = document.getElementById('hw-candidates');
    if (candidatesEl) {
      candidatesEl.innerHTML = '<span class="hw-no-result">인식 중...</span>';
    }

    try {
      // Google Input Tools 형식으로 스트로크 변환
      const inkData = this._buildInkPayload();

      const response = await fetch(HW_CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inkData),
      });

      const result = await response.json();

      // 결과 파싱
      const candidates = this._parseCandidates(result);
      this._renderCandidates(candidates);

    } catch (err) {
      console.error('[필기 인식 오류]', err);
      if (candidatesEl) {
        candidatesEl.innerHTML = '<span class="hw-no-result">인식 실패 — 인터넷 연결을 확인하세요</span>';
      }
    }
  }

  /**
   * Google Input Tools API 페이로드 생성.
   */
  _buildInkPayload() {
    // 각 스트로크를 [x좌표배열, y좌표배열, 시간배열] 형태로 변환
    const traceArr = this.strokes.map(stroke => {
      const xs = stroke.map(p => Math.round(p.x));
      const ys = stroke.map(p => Math.round(p.y));
      const ts = stroke.map(p => p.t - stroke[0].t);
      return [xs, ys, ts];
    });

    return {
      options: 'enable_pre_space',
      requests: [{
        writing_guide: {
          writing_area_width: this.canvas.width,
          writing_area_height: this.canvas.height,
        },
        ink: traceArr,
        pre_context: '',
        max_num_results: HW_CONFIG.MAX_CANDIDATES,
        max_completions: 0,
      }],
    };
  }

  /**
   * API 응답에서 후보 문자 추출.
   */
  _parseCandidates(result) {
    // Google 응답 형식: [status, [["", [후보1, 후보2, ...], ...]]]
    try {
      if (result[0] === 'SUCCESS' && result[1] && result[1][0]) {
        return result[1][0][1] || [];
      }
    } catch (e) {
      // ignore parse errors
    }
    return [];
  }

  /**
   * 후보 문자 UI 렌더.
   */
  _renderCandidates(candidates) {
    const el = document.getElementById('hw-candidates');
    if (!el) return;

    if (!candidates.length) {
      el.innerHTML = '<span class="hw-no-result">인식 결과 없음 — 다시 써보세요</span>';
      return;
    }

    el.innerHTML = '';

    // 각 후보 문자열의 개별 문자를 모두 표시
    const seen = new Set();
    for (const candidate of candidates) {
      for (const ch of candidate) {
        if (!seen.has(ch) && ch.trim()) {
          seen.add(ch);
          const btn = document.createElement('button');
          btn.className = 'hw-candidate';
          btn.textContent = ch;
          btn.type = 'button';
          btn.addEventListener('click', () => {
            this._selectChar(ch);
          });
          el.appendChild(btn);
        }
      }
    }
  }

  /**
   * 후보 문자 선택 → 대기열에 추가 + 캔버스 초기화.
   */
  _selectChar(ch) {
    this.selectedChars.push(ch);
    this._renderSelected();
    this.clearCanvas();
  }

  /**
   * 대기열 UI 렌더.
   */
  _renderSelected() {
    const el = document.getElementById('hw-selected');
    if (!el) return;

    el.innerHTML = '';
    this.selectedChars.forEach((ch, i) => {
      const span = document.createElement('span');
      span.className = 'hw-selected-char';
      span.textContent = ch;
      span.title = '클릭하면 삭제';
      span.addEventListener('click', () => {
        this.selectedChars.splice(i, 1);
        this._renderSelected();
      });
      el.appendChild(span);
    });
  }

  // ───────── 공개 메서드 ─────────

  /**
   * 캔버스 지우기.
   */
  clearCanvas() {
    this.strokes = [];
    this.currentStroke = [];
    this.ctx.fillStyle = HW_CONFIG.CANVAS_BG_COLOR;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this._drawGuide();
    this.ctx.strokeStyle = HW_CONFIG.CANVAS_LINE_COLOR;
    this.ctx.lineWidth = HW_CONFIG.CANVAS_LINE_WIDTH;

    const candidatesEl = document.getElementById('hw-candidates');
    if (candidatesEl) candidatesEl.innerHTML = '';
  }

  /**
   * 마지막 획 취소.
   */
  undoStroke() {
    if (this.strokes.length === 0) return;
    this.strokes.pop();
    this._redrawAllStrokes();

    if (this.strokes.length > 0) {
      this._scheduleRecognize();
    } else {
      const candidatesEl = document.getElementById('hw-candidates');
      if (candidatesEl) candidatesEl.innerHTML = '';
    }
  }

  /**
   * 모든 스트로크 다시 그리기.
   */
  _redrawAllStrokes() {
    this.ctx.fillStyle = HW_CONFIG.CANVAS_BG_COLOR;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this._drawGuide();
    this.ctx.strokeStyle = HW_CONFIG.CANVAS_LINE_COLOR;
    this.ctx.lineWidth = HW_CONFIG.CANVAS_LINE_WIDTH;

    for (const stroke of this.strokes) {
      if (stroke.length < 2) continue;
      this.ctx.beginPath();
      this.ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        this.ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      this.ctx.stroke();
    }
  }

  /**
   * 대기열 텍스트를 textarea에 삽입.
   */
  insertToTextarea() {
    if (this.selectedChars.length === 0) return;

    const textarea = document.getElementById('input-text');
    if (!textarea) return;

    const text = this.selectedChars.join('');
    const existing = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // 커서 위치에 삽입
    textarea.value = existing.slice(0, start) + text + existing.slice(end);

    // 커서 이동
    const newPos = start + text.length;
    textarea.setSelectionRange(newPos, newPos);
    textarea.focus();

    // 자동 저장
    if (typeof saveLastInput === 'function') {
      saveLastInput(textarea.value);
    }

    // 대기열 비우기
    this.clearSelected();
  }

  /**
   * 대기열 비우기.
   */
  clearSelected() {
    this.selectedChars = [];
    this._renderSelected();
  }
}


// ───────── 전역 인스턴스 ─────────
const handwritingRecognizer = new HandwritingRecognizer();
