/**
 * ocr.js
 * ──────────────────────────────────────────────
 * 브라우저 기반 HanjaOCR 엔진.
 *
 * NDL Koten OCR (RTMDet-S + PARSeq-Tiny) ONNX 모델을
 * onnxruntime-web을 통해 브라우저에서 직접 실행한다.
 *
 * 외부 의존성:
 *   - onnxruntime-web (CDN)
 *
 * 모델 파일 (GitHub 직접 호스팅 또는 별도 CDN):
 *   - rtmdet-s-1280x1280.onnx  (~39MB)
 *   - parseq-ndl-32x384-tiny-10.onnx  (~37MB)
 *   - NDLmoji.yaml  (~100KB)
 */

// ───────── 설정 ─────────

const OCR_CONFIG = {
  // 모델 URL — NDL 공개 저장소에서 직접 로딩 (별도 다운로드 불필요)
  // 출처: https://github.com/ndl-lab/ndlkotenocr-lite (CC BY 4.0)
  MODEL_BASE_URL: 'https://raw.githubusercontent.com/ndl-lab/ndlkotenocr-lite/master/src/',

  RTMDET_MODEL: 'model/rtmdet-s-1280x1280.onnx',
  PARSEQ_MODEL: 'model/parseq-ndl-32x384-tiny-10.onnx',
  CHARSET_FILE: 'config/NDLmoji.yaml',

  // RTMDet 전처리 상수
  RTMDET_INPUT_SIZE: 1024,
  RTMDET_MEAN: [103.53, 116.28, 123.675],
  RTMDET_STD: [57.375, 57.12, 58.395],
  RTMDET_SCORE_THRESHOLD: 0.3,

  // PARSeq 입력 크기
  PARSEQ_HEIGHT: 32,
  PARSEQ_WIDTH: 384,

  // 텍스트 라인 클래스 (RTMDet 출력 중 텍스트 행만 필터)
  TEXT_LINE_CLASSES: new Set([1, 2, 3, 4, 10, 14]),

  // 문자 신뢰도 임계값
  CONF_HIGH: 60,
  CONF_LOW: 20,
};

// CJK 문자 범위
const CJK_RANGES = [
  [0x4E00, 0x9FFF], [0x3400, 0x4DBF], [0x20000, 0x2A6DF],
  [0x2A700, 0x2B73F], [0x2B740, 0x2B81F], [0x2B820, 0x2CEAF],
  [0xF900, 0xFAFF], [0x3000, 0x303F], [0xFF00, 0xFFEF],
  [0x3040, 0x309F], [0x30A0, 0x30FF], [0xAC00, 0xD7AF],
];
const CJK_PUNCTUATION = '。、，；：！？「」『』（）【】〔〕《》〈〉・…—～';


// ───────── 유틸리티 ─────────

function isMeaningfulChar(c) {
  const code = c.codePointAt(0);
  return CJK_RANGES.some(([s, e]) => code >= s && code <= e) || CJK_PUNCTUATION.includes(c);
}

function classifyChar(char, confPct) {
  if (!isMeaningfulChar(char)) {
    if (confPct >= OCR_CONFIG.CONF_HIGH) {
      return { char, confidence: confPct, status: 'normal', originalChar: char };
    }
    return { char: '○', confidence: confPct, status: 'unreadable', originalChar: char };
  }
  if (confPct >= OCR_CONFIG.CONF_HIGH) {
    return { char, confidence: confPct, status: 'normal', originalChar: char };
  }
  if (confPct >= OCR_CONFIG.CONF_LOW) {
    return { char, confidence: confPct, status: 'uncertain', originalChar: char };
  }
  return { char: '○', confidence: confPct, status: 'unreadable', originalChar: char };
}

function softmax(arr) {
  const max = Math.max(...arr);
  const exps = arr.map(x => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(x => x / sum);
}


// ───────── TextBox & 읽기 순서 (reading_order.py 포팅) ─────────

class TextBox {
  constructor(x1, y1, x2, y2, confidence = 0, cls = 0) {
    this.x1 = x1; this.y1 = y1;
    this.x2 = x2; this.y2 = y2;
    this.confidence = confidence;
    this.cls = cls;
    this.order = -1;
    this.text = '';
  }
  get cx() { return (this.x1 + this.x2) / 2; }
  get cy() { return (this.y1 + this.y2) / 2; }
  get width() { return this.x2 - this.x1; }
  get height() { return this.y2 - this.y1; }
  get area() { return this.width * this.height; }
  get isVertical() { return this.height > this.width; }
}

function computeIoU(a, b) {
  const ix1 = Math.max(a.x1, b.x1), iy1 = Math.max(a.y1, b.y1);
  const ix2 = Math.min(a.x2, b.x2), iy2 = Math.min(a.y2, b.y2);
  if (ix1 >= ix2 || iy1 >= iy2) return 0;
  const inter = (ix2 - ix1) * (iy2 - iy1);
  const union = a.area + b.area - inter;
  return union > 0 ? inter / union : 0;
}

function computeIoMin(a, b) {
  const ix1 = Math.max(a.x1, b.x1), iy1 = Math.max(a.y1, b.y1);
  const ix2 = Math.min(a.x2, b.x2), iy2 = Math.min(a.y2, b.y2);
  if (ix1 >= ix2 || iy1 >= iy2) return 0;
  const inter = (ix2 - ix1) * (iy2 - iy1);
  const minArea = Math.min(a.area, b.area);
  return minArea > 0 ? inter / minArea : 0;
}

function removeDuplicateBoxes(boxes, iomTh = 0.8, iouTh = 0.4) {
  if (boxes.length <= 1) return boxes;
  const sorted = [...boxes].sort((a, b) => b.area - a.area);
  const keep = [];
  for (const box of sorted) {
    let dup = false;
    for (const kept of keep) {
      if (computeIoMin(box, kept) > iomTh || computeIoU(box, kept) > iouTh) {
        dup = true; break;
      }
    }
    if (!dup) keep.push(box);
  }
  return keep;
}

function determineOrientation(boxes) {
  if (!boxes.length) return 'vertical';
  const nVert = boxes.filter(b => b.isVertical).length;
  if (boxes.length < nVert * 2 || nVert > boxes.length - nVert) return 'vertical';
  return 'horizontal';
}

function findLargestGap(boxes, axis, rangeMin, rangeMax, resolution = 100) {
  const totalRange = rangeMax - rangeMin;
  if (totalRange <= 0) return [0, rangeMin];
  const binSize = totalRange / resolution;
  const hist = new Int32Array(resolution);

  for (const box of boxes) {
    const start = axis === 'x' ? box.x1 : box.y1;
    const end = axis === 'x' ? box.x2 : box.y2;
    const binStart = Math.max(0, Math.floor((start - rangeMin) / binSize));
    const binEnd = Math.min(resolution, Math.floor((end - rangeMin) / binSize) + 1);
    for (let i = binStart; i < binEnd; i++) hist[i]++;
  }

  let maxGapStart = -1, maxGapLen = 0, curStart = -1, curLen = 0;
  for (let i = 0; i < resolution; i++) {
    if (hist[i] === 0) {
      if (curStart === -1) { curStart = i; curLen = 1; } else { curLen++; }
    } else {
      if (curLen > maxGapLen) { maxGapLen = curLen; maxGapStart = curStart; }
      curStart = -1; curLen = 0;
    }
  }
  if (curLen > maxGapLen) { maxGapLen = curLen; maxGapStart = curStart; }
  if (maxGapStart === -1) return [0, rangeMin];

  return [maxGapLen * binSize, rangeMin + (maxGapStart + maxGapLen / 2) * binSize];
}

function sortLeaf(boxes, orientation) {
  return [...boxes].sort((a, b) =>
    orientation === 'vertical'
      ? (-a.cx + b.cx) || (a.cy - b.cy)
      : (a.cy - b.cy) || (a.cx - b.cx)
  );
}

function xyCutRecursive(boxes, orientation, depth = 0, maxDepth = 50) {
  if (boxes.length <= 1 || depth >= maxDepth) return boxes;

  const allX1 = Math.min(...boxes.map(b => b.x1));
  const allY1 = Math.min(...boxes.map(b => b.y1));
  const allX2 = Math.max(...boxes.map(b => b.x2));
  const allY2 = Math.max(...boxes.map(b => b.y2));
  const totalW = allX2 - allX1, totalH = allY2 - allY1;
  if (totalW <= 0 || totalH <= 0) return boxes;

  const [hGap, hPos] = findLargestGap(boxes, 'y', allY1, allY2);
  const [vGap, vPos] = findLargestGap(boxes, 'x', allX1, allX2);
  const hNorm = totalH > 0 ? hGap / totalH : 0;
  const vNorm = totalW > 0 ? vGap / totalW : 0;
  const minGap = 0.01;

  if (hNorm < minGap && vNorm < minGap) return sortLeaf(boxes, orientation);

  if (vNorm >= hNorm) {
    const left = boxes.filter(b => b.cx < vPos);
    const right = boxes.filter(b => b.cx >= vPos);
    if (!left.length || !right.length) return sortLeaf(boxes, orientation);
    const lo = xyCutRecursive(left, orientation, depth + 1, maxDepth);
    const ro = xyCutRecursive(right, orientation, depth + 1, maxDepth);
    return orientation === 'vertical' ? [...ro, ...lo] : [...lo, ...ro];
  } else {
    const top = boxes.filter(b => b.cy < hPos);
    const bot = boxes.filter(b => b.cy >= hPos);
    if (!top.length || !bot.length) return sortLeaf(boxes, orientation);
    return [
      ...xyCutRecursive(top, orientation, depth + 1, maxDepth),
      ...xyCutRecursive(bot, orientation, depth + 1, maxDepth),
    ];
  }
}

function xyCutOrder(boxes, orientation) {
  if (!boxes.length) return boxes;
  const ordered = xyCutRecursive(boxes, orientation);
  ordered.forEach((b, i) => b.order = i);
  return ordered;
}

function smoothReadingOrder(boxes) {
  if (boxes.length <= 2) return boxes;
  const n = boxes.length;
  const allX1 = Math.min(...boxes.map(b => b.x1));
  const allY1 = Math.min(...boxes.map(b => b.y1));
  const allX2 = Math.max(...boxes.map(b => b.x2));
  const allY2 = Math.max(...boxes.map(b => b.y2));
  const diag = Math.sqrt((allX2 - allX1) ** 2 + (allY2 - allY1) ** 2);
  if (diag <= 0) return boxes;

  const orderRange = Math.max(1, Math.max(...boxes.map(b => b.order)) - Math.min(...boxes.map(b => b.order)));
  const used = new Array(n).fill(false);
  const result = [];

  let startIdx = 0;
  for (let i = 1; i < n; i++) {
    if (boxes[i].order < boxes[startIdx].order) startIdx = i;
  }
  used[startIdx] = true;
  result.push(boxes[startIdx]);

  for (let step = 0; step < n - 1; step++) {
    const last = result[result.length - 1];
    let bestIdx = -1, bestCost = Infinity;
    for (let j = 0; j < n; j++) {
      if (used[j]) continue;
      const dist = Math.sqrt((last.cx - boxes[j].cx) ** 2 + (last.cy - boxes[j].cy) ** 2);
      const distNorm = dist / diag;
      const orderDev = Math.abs(boxes[j].order - (last.order + 1)) / orderRange;
      const cost = distNorm + 0.3 * orderDev;
      if (cost < bestCost) { bestCost = cost; bestIdx = j; }
    }
    if (bestIdx >= 0) { used[bestIdx] = true; result.push(boxes[bestIdx]); }
  }
  result.forEach((b, i) => b.order = i);
  return result;
}


// ───────── Canvas 기반 이미지 전처리 ─────────

/**
 * HTMLImageElement → RGBA ImageData
 */
function imageToCanvas(img, maxDim = null) {
  const canvas = document.createElement('canvas');
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (maxDim && Math.max(w, h) > maxDim) {
    const scale = maxDim / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  return { canvas, ctx, width: w, height: h };
}

/**
 * RTMDet 전처리: 이미지 → Float32Array [1, 3, 1024, 1024]
 */
function preprocessForRTMDet(img) {
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;
  const S = OCR_CONFIG.RTMDET_INPUT_SIZE;

  // 정사각 패딩 후 리사이즈
  const maxDim = Math.max(origH, origW);
  const scale = S / maxDim;

  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#727272'; // 114,114,114 padding
  ctx.fillRect(0, 0, S, S);

  const scaledW = Math.round(origW * scale);
  const scaledH = Math.round(origH * scale);
  ctx.drawImage(img, 0, 0, scaledW, scaledH);

  const imageData = ctx.getImageData(0, 0, S, S);
  const pixels = imageData.data; // RGBA

  // NCHW Float32 텐서 (BGR, normalized)
  const tensor = new Float32Array(1 * 3 * S * S);
  const mean = OCR_CONFIG.RTMDET_MEAN;
  const std = OCR_CONFIG.RTMDET_STD;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) * 4;
      const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
      // BGR order
      tensor[0 * S * S + y * S + x] = (b - mean[0]) / std[0];
      tensor[1 * S * S + y * S + x] = (g - mean[1]) / std[1];
      tensor[2 * S * S + y * S + x] = (r - mean[2]) / std[2];
    }
  }

  return { tensor, scale, origW, origH };
}

/**
 * PARSeq 전처리: crop 이미지 → Float32Array [1, 3, 32, 384]
 */
function preprocessForPARSeq(canvas, x1, y1, x2, y2, isVertical) {
  let cw = x2 - x1, ch = y2 - y1;

  // 크롭
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = cw;
  cropCanvas.height = ch;
  const cropCtx = cropCanvas.getContext('2d');
  cropCtx.drawImage(canvas, x1, y1, cw, ch, 0, 0, cw, ch);

  // 세로 텍스트: 좌우 10% 여백 제거
  let srcCanvas = cropCanvas;
  if (isVertical && cw > 10) {
    const margin = Math.floor(cw / 10);
    const trimW = cw - 2 * margin;
    if (trimW > 5) {
      const trimCanvas = document.createElement('canvas');
      trimCanvas.width = trimW;
      trimCanvas.height = ch;
      const trimCtx = trimCanvas.getContext('2d');
      trimCtx.drawImage(cropCanvas, margin, 0, trimW, ch, 0, 0, trimW, ch);
      srcCanvas = trimCanvas;
      cw = trimW;
    }
  }

  // 세로 텍스트이면 90도 반시계방향 회전
  let finalCanvas = srcCanvas;
  if (ch > cw) {
    const rotCanvas = document.createElement('canvas');
    rotCanvas.width = ch;
    rotCanvas.height = cw;
    const rotCtx = rotCanvas.getContext('2d');
    rotCtx.translate(0, cw);
    rotCtx.rotate(-Math.PI / 2);
    rotCtx.drawImage(srcCanvas, 0, 0);
    finalCanvas = rotCanvas;
  }

  // 384x32로 리사이즈
  const PW = OCR_CONFIG.PARSEQ_WIDTH;
  const PH = OCR_CONFIG.PARSEQ_HEIGHT;
  const resizeCanvas = document.createElement('canvas');
  resizeCanvas.width = PW;
  resizeCanvas.height = PH;
  const resizeCtx = resizeCanvas.getContext('2d');
  resizeCtx.drawImage(finalCanvas, 0, 0, PW, PH);

  const imageData = resizeCtx.getImageData(0, 0, PW, PH);
  const pixels = imageData.data;

  // Float32 NCHW, normalize to [-1, 1]
  const tensor = new Float32Array(1 * 3 * PH * PW);
  for (let y = 0; y < PH; y++) {
    for (let x = 0; x < PW; x++) {
      const idx = (y * PW + x) * 4;
      const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
      tensor[0 * PH * PW + y * PW + x] = (r / 255.0 - 0.5) * 2.0;
      tensor[1 * PH * PW + y * PW + x] = (g / 255.0 - 0.5) * 2.0;
      tensor[2 * PH * PW + y * PW + x] = (b / 255.0 - 0.5) * 2.0;
    }
  }

  return tensor;
}


// ───────── YAML 파서 (최소한) ─────────

function parseCharsetFromYaml(text) {
  // NDLmoji.yaml 에서 charset_train 또는 charset_test 문자열 추출
  const patterns = [/charset_train:\s*['"](.+?)['"]/s, /charset_test:\s*['"](.+?)['"]/s];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m && m[1].length > 100) return [...m[1]];
  }
  // fallback: 가장 긴 인용문자열 추출
  const allStrings = [...text.matchAll(/['"](.{100,}?)['"]/gs)];
  if (allStrings.length) {
    const longest = allStrings.reduce((a, b) => a[1].length > b[1].length ? a : b);
    return [...longest[1]];
  }
  return [];
}


// ───────── HanjaOCR 브라우저 엔진 ─────────

class BrowserHanjaOCR {
  constructor() {
    this.rtmdetSession = null;
    this.parseqSession = null;
    this.charset = null;
    this._loading = false;
    this._loaded = false;
  }

  /**
   * 모델 로딩 상태 확인
   */
  get isLoaded() { return this._loaded; }

  /**
   * ONNX 모델 + charset 로딩.
   * @param {Function} onProgress - 진행 콜백 (msg, pct)
   */
  async loadModels(onProgress = null) {
    if (this._loaded) return;
    if (this._loading) {
      // 이미 로딩 중이면 완료까지 대기
      while (this._loading) await new Promise(r => setTimeout(r, 100));
      return;
    }
    this._loading = true;

    try {
      if (onProgress) onProgress('ONNX Runtime 초기화 중...', 0);

      // onnxruntime-web 이 전역에 있는지 확인
      if (typeof ort === 'undefined') {
        throw new Error('onnxruntime-web이 로드되지 않았습니다.');
      }

      // WASM 실행 옵션
      const sessionOptions = {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      };

      const base = OCR_CONFIG.MODEL_BASE_URL;

      // 1) Charset 로딩
      if (onProgress) onProgress('문자 사전(NDLmoji) 로딩 중...', 5);
      const yamlResp = await fetch(base + OCR_CONFIG.CHARSET_FILE);
      if (!yamlResp.ok) throw new Error(`charset 파일 로딩 실패: ${yamlResp.status}`);
      const yamlText = await yamlResp.text();
      this.charset = parseCharsetFromYaml(yamlText);
      if (!this.charset.length) throw new Error('charset 파싱 실패');

      // 2) RTMDet 모델 로딩
      if (onProgress) onProgress('텍스트 검출 모델(RTMDet) 로딩 중...', 10);
      const rtmdetResp = await fetch(base + OCR_CONFIG.RTMDET_MODEL);
      if (!rtmdetResp.ok) throw new Error(`RTMDet 모델 로딩 실패: ${rtmdetResp.status}`);
      const rtmdetBuf = await rtmdetResp.arrayBuffer();
      if (onProgress) onProgress('RTMDet 모델 초기화 중...', 40);
      this.rtmdetSession = await ort.InferenceSession.create(rtmdetBuf, sessionOptions);

      // 3) PARSeq 모델 로딩
      if (onProgress) onProgress('문자 인식 모델(PARSeq) 로딩 중...', 50);
      const parseqResp = await fetch(base + OCR_CONFIG.PARSEQ_MODEL);
      if (!parseqResp.ok) throw new Error(`PARSeq 모델 로딩 실패: ${parseqResp.status}`);
      const parseqBuf = await parseqResp.arrayBuffer();
      if (onProgress) onProgress('PARSeq 모델 초기화 중...', 80);
      this.parseqSession = await ort.InferenceSession.create(parseqBuf, sessionOptions);

      if (onProgress) onProgress('모델 로딩 완료!', 100);
      this._loaded = true;

    } finally {
      this._loading = false;
    }
  }

  /**
   * 이미지에서 한자 OCR 실행.
   * @param {HTMLImageElement} img - 이미지 엘리먼트
   * @param {Function} onProgress - 진행 콜백 (msg, pct)
   * @returns {{ text: string, columns: Array }}
   */
  async recognize(img, onProgress = null) {
    if (!this._loaded) {
      await this.loadModels(onProgress);
    }

    // 1) 원본 이미지를 캔버스에 그리기 (크롭용)
    if (onProgress) onProgress('이미지 전처리 중...', 0);
    const { canvas: srcCanvas } = imageToCanvas(img);

    // 2) RTMDet 추론
    if (onProgress) onProgress('텍스트 영역 검출 중...', 10);
    const { tensor: rtmTensor, scale, origW, origH } = preprocessForRTMDet(img);
    const S = OCR_CONFIG.RTMDET_INPUT_SIZE;
    const rtmInput = new ort.Tensor('float32', rtmTensor, [1, 3, S, S]);

    const inputName = this.rtmdetSession.inputNames[0];
    const rtmResult = await this.rtmdetSession.run({ [inputName]: rtmInput });

    const outputNames = this.rtmdetSession.outputNames;
    const detsData = rtmResult[outputNames[0]].data;
    const labelsData = rtmResult[outputNames[1]].data;
    const detsDims = rtmResult[outputNames[0]].dims;

    // 검출 결과 파싱
    const numDets = detsDims.length === 3 ? detsDims[1] : detsDims[0];
    let boxes = [];

    for (let i = 0; i < numDets; i++) {
      const score = detsData[i * 5 + 4];
      if (score < OCR_CONFIG.RTMDET_SCORE_THRESHOLD) continue;

      const clsId = Number(labelsData[i]);
      if (!OCR_CONFIG.TEXT_LINE_CLASSES.has(clsId)) continue;

      let x1 = Math.max(0, detsData[i * 5 + 0] / scale);
      let y1 = Math.max(0, detsData[i * 5 + 1] / scale);
      let x2 = Math.min(origW, detsData[i * 5 + 2] / scale);
      let y2 = Math.min(origH, detsData[i * 5 + 3] / scale);

      if ((x2 - x1) < 5 || (y2 - y1) < 5) continue;

      boxes.push(new TextBox(
        Math.round(x1), Math.round(y1),
        Math.round(x2), Math.round(y2),
        score * 100, clsId
      ));
    }

    if (!boxes.length) {
      return { text: '', columns: [], totalChars: 0 };
    }

    // 3) 중복 제거 + 읽기 순서
    if (onProgress) onProgress(`${boxes.length}개 텍스트 영역 정렬 중...`, 30);
    boxes = removeDuplicateBoxes(boxes);
    const orientation = determineOrientation(boxes);
    boxes = xyCutOrder(boxes, orientation);
    boxes = smoothReadingOrder(boxes);

    // 4) PARSeq: 각 행 인식
    const columns = [];
    const parseqInputName = this.parseqSession.inputNames[0];
    const PW = OCR_CONFIG.PARSEQ_WIDTH;
    const PH = OCR_CONFIG.PARSEQ_HEIGHT;

    for (let i = 0; i < boxes.length; i++) {
      if (onProgress) {
        const pct = 30 + Math.round((i / boxes.length) * 65);
        onProgress(`문자 인식 중... (${i + 1}/${boxes.length})`, pct);
      }

      const box = boxes[i];
      const cx1 = Math.max(0, box.x1), cy1 = Math.max(0, box.y1);
      const cx2 = Math.min(origW, box.x2), cy2 = Math.min(origH, box.y2);
      if ((cx2 - cx1) < 3 || (cy2 - cy1) < 3) continue;

      const parseqTensor = preprocessForPARSeq(srcCanvas, cx1, cy1, cx2, cy2, box.isVertical);
      const parseqInput = new ort.Tensor('float32', parseqTensor, [1, 3, PH, PW]);

      const parseqResult = await this.parseqSession.run({ [parseqInputName]: parseqInput });
      const logits = parseqResult[this.parseqSession.outputNames[0]];
      const logitsData = logits.data;
      const [, seqLen, vocabSize] = logits.dims;

      // Greedy decode
      let text = '';
      let confidences = [];
      for (let t = 0; t < seqLen; t++) {
        const offset = t * vocabSize;
        const row = Array.from(logitsData.slice(offset, offset + vocabSize));
        const probs = softmax(row);
        let maxIdx = 0, maxProb = probs[0];
        for (let v = 1; v < vocabSize; v++) {
          if (probs[v] > maxProb) { maxProb = probs[v]; maxIdx = v; }
        }
        if (maxIdx === 0) break; // EOS
        const charIdx = maxIdx - 1;
        if (charIdx >= 0 && charIdx < this.charset.length) {
          text += this.charset[charIdx];
          confidences.push(maxProb);
        }
      }

      if (!text.trim()) continue;

      const avgConf = confidences.length
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length * 100
        : 0;

      const characters = [];
      for (const ch of text) {
        if (ch.trim()) characters.push(classifyChar(ch, avgConf));
      }

      if (characters.length) {
        columns.push({
          columnIndex: i,
          text: characters.map(c => c.char).join(''),
          characters,
        });
      }
    }

    const fullText = columns.map(c => c.text).join('\n');
    const totalChars = columns.reduce((sum, c) => sum + c.characters.length, 0);

    if (onProgress) onProgress('OCR 완료!', 100);

    return { text: fullText, columns, totalChars };
  }
}


// ───────── 전역 인스턴스 ─────────
const hanjaOCR = new BrowserHanjaOCR();


// ───────── Gemini Vision OCR ─────────

/**
 * Gemini Vision API를 사용한 이미지 OCR.
 * 현대 폰트·스크린샷·디지털 이미지에 최적화.
 * @param {File} file - 이미지 파일
 * @param {string} apiKey - Gemini API Key
 * @param {Function} onProgress - 진행 콜백 (msg, pct)
 * @returns {Promise<{text: string, totalChars: number}>}
 */
async function geminiVisionOCR(file, apiKey, onProgress) {
  if (!apiKey) throw new Error('Gemini API Key가 필요합니다.');

  if (onProgress) onProgress('이미지를 Base64로 변환 중...', 10);

  // File → Base64
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('이미지 읽기 실패'));
    reader.readAsDataURL(file);
  });

  const mimeType = file.type || 'image/jpeg';

  if (onProgress) onProgress('Gemini Vision API 요청 중...', 30);

  const modelId = (typeof getSelectedModel === 'function')
    ? getSelectedModel()
    : 'gemini-2.5-flash-preview-05-20';

  const payload = {
    contents: [{
      role: 'user',
      parts: [
        {
          inline_data: { mime_type: mimeType, data: base64 }
        },
        {
          text: `이 이미지에 있는 한자(漢字) 텍스트를 정확하게 추출하라.

규칙:
1. 이미지에 보이는 한자·한문을 있는 그대로 전사하라.
2. 줄바꿈은 원문의 행 구조를 따르라.
3. 읽기 어려운 글자는 □로 표시하라.
4. 한자 이외의 설명, 번역, 주석을 절대 추가하지 마라.
5. 오직 원문 텍스트만 출력하라.`
        }
      ]
    }],
    generationConfig: {
      temperature: 0.0,
      maxOutputTokens: 4096,
    }
  };

  const useProxy = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  let response;
  if (useProxy) {
    response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, modelId, payload })
    });
  } else {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );
  }

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini Vision API 오류 (${response.status}): ${err}`);
  }

  if (onProgress) onProgress('응답 처리 중...', 80);

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map(p => p.text || '').join('').trim() || '';

  if (!text) throw new Error('Gemini Vision이 텍스트를 인식하지 못했습니다.');

  if (onProgress) onProgress('인식 완료!', 100);

  return { text, totalChars: [...text].filter(c => c.trim()).length };
}
