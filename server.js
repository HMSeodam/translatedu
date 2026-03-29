/**
 * server.js
 * ──────────────────────────────────────────────
 * TranslateDu 로컬 프록시 서버.
 *
 * 역할:
 *   1) 정적 파일 서빙 (index.html, *.js, *.css)
 *   2) Gemini API 프록시 (/api/gemini) — CORS 문제 우회
 *
 * 사용법:
 *   node server.js
 *   → 브라우저에서 http://localhost:3000 접속
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;

// ───────── MIME 타입 매핑 ─────────
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.wasm': 'application/wasm',
  '.yaml': 'text/yaml; charset=utf-8',
  '.onnx': 'application/octet-stream',
};

// ───────── 정적 파일 서빙 ─────────
function serveStaticFile(req, res) {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  // 쿼리스트링 제거
  filePath = filePath.split('?')[0];
  const fullPath = path.join(__dirname, filePath);

  // 디렉토리 탈출 방지
  if (!fullPath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`파일을 찾을 수 없습니다: ${filePath}`);
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    });
    res.end(data);
  });
}

// ───────── Gemini API 프록시 ─────────
function proxyGeminiApi(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body);
      const { apiKey, modelId, payload } = parsed;

      if (!apiKey || !modelId || !payload) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'apiKey, modelId, payload가 모두 필요합니다.' }));
        return;
      }

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
      const parsedUrl = url.parse(geminiUrl);
      const payloadStr = JSON.stringify(payload);

      const options = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payloadStr),
        },
      };

      const proxyReq = https.request(options, proxyRes => {
        let responseData = '';
        proxyRes.on('data', chunk => { responseData += chunk; });
        proxyRes.on('end', () => {
          // CORS 헤더 추가 후 응답 전달
          res.writeHead(proxyRes.statusCode, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(responseData);
        });
      });

      proxyReq.on('error', err => {
        console.error('[프록시 오류]', err.message);
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: `프록시 요청 실패: ${err.message}` }));
      });

      proxyReq.write(payloadStr);
      proxyReq.end();

    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: `요청 파싱 오류: ${e.message}` }));
    }
  });
}

// ───────── HTTP 서버 ─────────
const server = http.createServer((req, res) => {
  // CORS preflight 처리
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // API 프록시 라우트
  if (req.method === 'POST' && req.url === '/api/gemini') {
    proxyGeminiApi(req, res);
    return;
  }

  // 정적 파일
  serveStaticFile(req, res);
});

server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║      TranslateDu 서버가 시작되었습니다       ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  주소: http://localhost:${PORT}                  ║`);
  console.log('║  종료: Ctrl + C                              ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
});
