/*  *************************************************************************************
 *   copyright: Copyright (c) 2026 Lowell D. Thomas
 *     license: MIT (https://opensource.org/license/mit)
 *   ********************************************************************************* */
// Development server for the APG web UI.
// Serves index.html and exposes two REST endpoints:
//   POST /api/generate  – run the grammar generator pipeline
//   POST /api/parse     – parse an input string with the last generated grammar
//
// Start with:  node server.js   (or  npm run serve)
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ApiCtor from './src/apg-api/api.js';
import Parser from './src/apg-lib/parser.js';
import Stats from './src/apg-lib/stats.js';
import Trace from './src/apg-lib/trace.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
const MAX_BODY = 1_048_576; // 1 MB – protect against runaway payloads

/* Module-level grammar object: persists between /api/generate and /api/parse calls. */
let grammarObject = null;

/* ──────────────────────────── helpers ──────────────────────────── */

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let len = 0;
    req.on('data', (chunk) => {
      len += chunk.length;
      if (len > MAX_BODY) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/* ──────────────────────────── /api/generate ──────────────────────── */

async function handleGenerate(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    sendJSON(res, { success: false, errors: e.message }, 400);
    return;
  }

  const grammar = typeof body.grammar === 'string' ? body.grammar : '';
  const displayRules = Boolean(body.displayRules);
  const displayRuleDependencies = Boolean(body.displayRuleDependencies);
  const displayAttributes = Boolean(body.displayAttributes);
  const strict = Boolean(body.strict);

  const result = {
    success: false,
    errors: null,
    rules: null,
    ruleDependencies: null,
    attributes: null,
  };

  try {
    const api = new ApiCtor(grammar);

    api.scan(strict);
    if (api.errors.length) {
      result.errors = `GRAMMAR CHARACTER ERRORS\n${api.errorsToAscii()}`;
      sendJSON(res, result);
      return;
    }

    api.parse(strict);
    if (api.errors.length) {
      result.errors = `GRAMMAR SYNTAX ERRORS\n${api.errorsToAscii()}`;
      sendJSON(res, result);
      return;
    }

    api.translate();
    if (api.errors.length) {
      result.errors = `GRAMMAR SEMANTIC ERRORS\n${api.errorsToAscii()}`;
      sendJSON(res, result);
      return;
    }

    /* Rules can be displayed before attributes are computed. */
    if (displayRules) {
      result.rules = api.displayRules('alpha');
    }

    const errorCount = api.attributes();
    if (errorCount > 0) {
      let errText = `GRAMMAR ATTRIBUTE ERRORS\n${api.displayAttributeErrors()}`;
      if (displayAttributes) {
        errText += `\n${api.displayAttributes('type')}`;
      }
      result.errors = errText;
      sendJSON(res, result);
      return;
    }

    if (displayRuleDependencies) {
      result.ruleDependencies = api.displayRuleDependencies('type');
    }
    if (displayAttributes) {
      result.attributes = api.displayAttributes('type');
    }

    grammarObject = api.toObject();
    result.success = true;
    sendJSON(res, result);
  } catch (e) {
    result.errors = `EXCEPTION: ${e.message}`;
    sendJSON(res, result, 500);
  }
}

/* ──────────────────────────── /api/parse ──────────────────────────── */

async function handleParse(req, res) {
  if (!grammarObject) {
    sendJSON(res, { success: false, error: 'No grammar generated yet. Please generate first.' }, 400);
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    sendJSON(res, { success: false, error: e.message }, 400);
    return;
  }

  const input = typeof body.input === 'string' ? body.input : '';
  const traceEnabled = Boolean(body.trace);
  const statsEnabled = Boolean(body.stats);

  const result = {
    success: false,
    parseResult: null,
    trace: null,
    stats: null,
    error: null,
  };

  try {
    const traceObj = traceEnabled ? new Trace() : null;
    const statsObj = statsEnabled ? new Stats() : null;
    const parser = new Parser(grammarObject);
    if (traceObj) parser.setTrace(traceObj);
    if (statsObj) parser.setStats(statsObj);

    const pr = parser.parse(0, input);

    /* Serialise parse result to a plain object (avoids any non-JSON values). */
    result.success = true;
    result.parseResult = {
      success: pr.success,
      state: pr.state,
      length: pr.length,
      matched: pr.matched,
      maxMatched: pr.maxMatched,
      maxTreeDepth: pr.maxTreeDepth,
      nodeHits: pr.nodeHits,
    };

    if (traceObj) {
      result.trace = traceObj.display();
    }
    if (statsObj) {
      result.stats = statsObj.displayStats() + '\n' + statsObj.displayHits('alpha');
    }

    sendJSON(res, result);
  } catch (e) {
    result.error = `EXCEPTION: ${e.message}`;
    sendJSON(res, result, 500);
  }
}

/* ──────────────────────────── HTTP server ──────────────────────────── */

const server = http.createServer(async (req, res) => {
  /* Minimal security headers */
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    try {
      const html = fs.readFileSync(path.join(__dirname, 'docs', 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch {
      res.writeHead(500);
      res.end('Failed to load docs/index.html');
    }
    return;
  }

  /* Serve static files from /src/ and /index.js, and HTML pages from /docs/ */
  if (req.method === 'GET') {
    const urlPath = req.url.split('?')[0]; // strip query string

    // Serve HTML files from the docs directory (e.g. /parsetree-visualizer.html)
    if (urlPath.endsWith('.html')) {
      const absPath = path.resolve(__dirname, 'docs', urlPath.replace(/^\//, ''));
      const docsDir = path.resolve(__dirname, 'docs');
      if (!absPath.startsWith(docsDir + path.sep) && absPath !== docsDir) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      try {
        const content = fs.readFileSync(absPath);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end('Not Found');
      }
      return;
    }

    const isAllowed = urlPath === '/index.js' || urlPath.startsWith('/src/');

    if (isAllowed) {
      // Resolve the absolute path and verify it stays inside __dirname
      const absPath = path.resolve(__dirname, urlPath.replace(/^\//, ''));
      if (!absPath.startsWith(__dirname + path.sep) && absPath !== __dirname) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      const ext = path.extname(absPath).toLowerCase();
      const mimeTypes = {
        '.js': 'application/javascript; charset=utf-8',
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.txt': 'text/plain; charset=utf-8',
      };
      const contentType = mimeTypes[ext] ?? 'application/octet-stream';
      try {
        const content = fs.readFileSync(absPath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end('Not Found');
      }
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/generate') {
    await handleGenerate(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/parse') {
    await handleParse(req, res);
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`APG server running at http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop.');
});
