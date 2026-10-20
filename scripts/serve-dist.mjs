// Production static server for the built demo (dist/). Node built-ins only.
//
// - Serves files under dist/ with explicit content types and security headers.
// - Never logs request paths, headers or bodies; it only answers the requesting browser.
// - `--smoke` starts the server on a loopback port, probes it with raw requests and
//   prints SMOKE PASS (exit 0) or SMOKE FAIL (n) (exit 1).
import { createServer, request as httpRequest } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
});

const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "worker-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

export const SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
});

/** Content type for a file path, by lower-cased extension. */
export function contentTypeFor(relativePath) {
  const extension = path.extname(String(relativePath)).toLowerCase();
  return Object.hasOwn(MIME_TYPES, extension) ? MIME_TYPES[extension] : 'application/octet-stream';
}

/**
 * Pure request resolution (no filesystem). Returns either a file resolution relative to the
 * served root or a rejection status.
 */
export function resolveStaticRequest(rawUrl, method) {
  if (method !== 'GET' && method !== 'HEAD') return { kind: 'reject', status: 405 };

  const target = String(rawUrl ?? '');
  const cut = target.search(/[?#]/);
  const rawPath = cut === -1 ? target : target.slice(0, cut);

  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return { kind: 'reject', status: 400 };
  }

  if (!decoded.startsWith('/') || decoded.includes('\\') || decoded.includes('\0')) {
    return { kind: 'reject', status: 400 };
  }

  const segments = decoded.split('/').filter((segment) => segment !== '' && segment !== '.');
  if (segments.includes('..')) return { kind: 'reject', status: 400 };

  if (segments.length === 0) return { kind: 'file', relativePath: 'index.html', spaFallback: false };

  const last = segments[segments.length - 1] ?? '';
  return { kind: 'file', relativePath: segments.join('/'), spaFallback: !last.includes('.') };
}

function send(request, response, status, headers, body) {
  response.writeHead(status, { ...SECURITY_HEADERS, ...headers, 'Content-Length': Buffer.byteLength(body) });
  response.end(request.method === 'HEAD' ? undefined : body);
}

function sendText(request, response, status, text, extraHeaders = {}) {
  send(request, response, status, { 'Content-Type': 'text/plain; charset=utf-8', ...extraHeaders }, text);
}

function isInside(rootDir, filePath) {
  return filePath.startsWith(rootDir.endsWith(path.sep) ? rootDir : rootDir + path.sep);
}

async function serveFile(request, response, filePath, relativePath) {
  const data = await readFile(filePath);
  const headers = { 'Content-Type': contentTypeFor(relativePath) };
  if (relativePath === 'index.html') headers['Cache-Control'] = 'no-cache';
  send(request, response, 200, headers, data);
}

/** Create (but do not start) the static server rooted at rootDir. */
export function createStaticServer(rootDir) {
  const root = path.resolve(rootDir);

  return createServer((request, response) => {
    handle(request, response).catch(() => {
      if (!response.headersSent) {
        sendText(request, response, 500, 'Server error');
      } else {
        response.destroy();
      }
    });
  });

  async function handle(request, response) {
    const resolution = resolveStaticRequest(request.url, request.method);

    if (resolution.kind === 'reject') {
      const extra = resolution.status === 405 ? { Allow: 'GET, HEAD' } : {};
      sendText(request, response, resolution.status, resolution.status === 405 ? 'Method not allowed' : 'Bad request', extra);
      return;
    }

    const filePath = path.resolve(root, resolution.relativePath);
    if (!isInside(root, filePath)) {
      sendText(request, response, 400, 'Bad request');
      return;
    }

    try {
      await serveFile(request, response, filePath, resolution.relativePath);
    } catch (error) {
      const code = error && typeof error === 'object' ? error.code : undefined;
      if (code === 'ENOENT' || code === 'EISDIR' || code === 'ENOTDIR') {
        if (resolution.spaFallback) {
          await serveFile(request, response, path.join(root, 'index.html'), 'index.html');
        } else {
          sendText(request, response, 404, 'Not found');
        }
        return;
      }
      throw error;
    }
  }
}

function probe(port, method, rawPath) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, method, path: rawPath }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });
}

/** Start the server on a loopback port and probe it. Returns { failures, lines }. */
export async function runSmoke(rootDir) {
  const root = path.resolve(rootDir);
  const lines = [];
  let failures = 0;

  const check = (name, ok, detail) => {
    if (ok) {
      lines.push(`PASS ${name}`);
    } else {
      failures += 1;
      lines.push(`FAIL ${name}: ${detail}`);
    }
  };
  const describe = (res) => `status ${res.status}, content-type ${res.headers['content-type'] ?? '(none)'}`;
  const isType = (res, status, type) => res.status === status && String(res.headers['content-type'] ?? '').startsWith(type);

  const server = createStaticServer(root);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  try {
    const get = (rawPath) => probe(port, 'GET', rawPath);

    const home = await get('/');
    const csp = String(home.headers['content-security-policy'] ?? '');
    check('root is html', isType(home, 200, 'text/html; charset=utf-8'), describe(home));
    check('root has CSP with connect-src none', csp.includes("default-src 'none'") && csp.includes("connect-src 'none'"), csp || '(missing)');
    check('root has nosniff', home.headers['x-content-type-options'] === 'nosniff', String(home.headers['x-content-type-options']));
    check('root has no-referrer', home.headers['referrer-policy'] === 'no-referrer', String(home.headers['referrer-policy']));
    check('root references a module script', home.body.includes('type="module"'), 'no type="module" in body');

    const scripts = [...home.body.matchAll(/<script[^>]*\ssrc="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
    const styles = [...home.body.matchAll(/<link[^>]*\shref="(\/assets\/[^"]+\.css)"/g)].map((match) => match[1]);
    check('index references at least one script and one stylesheet', scripts.length > 0 && styles.length > 0, `${scripts.length} scripts, ${styles.length} styles`);
    for (const script of scripts) {
      const res = await get(script);
      check(`script ${script} is javascript`, isType(res, 200, 'text/javascript; charset=utf-8'), describe(res));
    }
    for (const style of styles) {
      const res = await get(style);
      check(`stylesheet ${style} is css`, isType(res, 200, 'text/css; charset=utf-8'), describe(res));
    }

    let assetNames = [];
    try {
      assetNames = await readdir(path.join(root, 'assets'));
    } catch {
      assetNames = [];
    }
    const workers = assetNames.filter((name) => /^analyze\.worker-.*\.js$/.test(name));
    check('exactly one analyze.worker chunk exists', workers.length === 1, `${workers.length} found`);
    if (workers.length === 1) {
      const res = await get(`/assets/${workers[0]}`);
      check('worker chunk is javascript', isType(res, 200, 'text/javascript; charset=utf-8'), describe(res));
    }

    const route = await get('/console/case');
    check('app route falls back to html', isType(route, 200, 'text/html; charset=utf-8'), describe(route));

    const missing = await get('/missing.js');
    check('missing asset is 404', missing.status === 404, describe(missing));

    for (const rawPath of ['/../package.json', '/..%2f..%2fpackage.json']) {
      const res = await get(rawPath);
      check(`traversal ${rawPath} is 400`, res.status === 400, describe(res));
      check(`traversal ${rawPath} leaks nothing`, !res.body.includes('"name": "culprit"'), 'body contained package.json');
    }

    const malformed = await get('/%E0%A4%A');
    check('malformed escape is 400', malformed.status === 400, describe(malformed));
    const after = await get('/');
    check('server survives malformed escape', isType(after, 200, 'text/html; charset=utf-8'), describe(after));

    const post = await probe(port, 'POST', '/');
    check('POST is 405 with Allow', post.status === 405 && post.headers.allow === 'GET, HEAD', `${post.status} allow ${String(post.headers.allow)}`);

    const head = await probe(port, 'HEAD', '/');
    check('HEAD is 200 with empty body', head.status === 200 && head.body === '', `${head.status}, body length ${head.body.length}`);
  } catch (error) {
    failures += 1;
    lines.push(`FAIL smoke run aborted: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await new Promise((resolve) => {
      server.close(() => resolve(undefined));
      server.closeAllConnections?.();
    });
  }

  return { failures, lines };
}

function readFlag(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  return value === undefined || value.startsWith('--') ? fallback : value;
}

async function main() {
  const args = process.argv.slice(2);
  const rootDir = fileURLToPath(new URL('../dist/', import.meta.url));

  if (args.includes('--smoke')) {
    const { failures, lines } = await runSmoke(rootDir);
    for (const line of lines) console.log(line);
    console.log(failures === 0 ? 'SMOKE PASS' : `SMOKE FAIL (${failures})`);
    process.exitCode = failures === 0 ? 0 : 1;
    return;
  }

  const host = readFlag(args, '--host', '0.0.0.0');
  const port = Number.parseInt(readFlag(args, '--port', '4173'), 10);
  const server = createStaticServer(rootDir);
  server.listen(port, host, () => {
    console.log(`Serving the built demo on port ${port}`);
  });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await main();
}
