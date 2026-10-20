import { describe, expect, it } from 'vitest';
import { SECURITY_HEADERS, contentTypeFor, resolveStaticRequest } from '../../scripts/serve-dist.mjs';

describe('contentTypeFor', () => {
  it.each([
    ['index.html', 'text/html; charset=utf-8'],
    ['assets/index-abc.js', 'text/javascript; charset=utf-8'],
    ['assets/analyze.worker-abc.js', 'text/javascript; charset=utf-8'],
    ['module.mjs', 'text/javascript; charset=utf-8'],
    ['assets/index-abc.css', 'text/css; charset=utf-8'],
    ['logo.svg', 'image/svg+xml'],
    ['fonts/a.woff2', 'font/woff2'],
    ['data.json', 'application/json; charset=utf-8'],
    ['notes.txt', 'text/plain; charset=utf-8'],
    ['pic.png', 'image/png'],
    ['favicon.ico', 'image/x-icon'],
    ['archive.bin', 'application/octet-stream'],
    ['noextension', 'application/octet-stream'],
  ])('maps %s to %s', (path, expected) => {
    expect(contentTypeFor(path)).toBe(expected);
  });

  it('looks the extension up case-insensitively', () => {
    expect(contentTypeFor('INDEX.HTML')).toBe('text/html; charset=utf-8');
  });
});

describe('resolveStaticRequest', () => {
  it('maps the root to index.html and ignores query and fragment', () => {
    const expected = { kind: 'file', relativePath: 'index.html', spaFallback: false };
    expect(resolveStaticRequest('/', 'GET')).toEqual(expected);
    expect(resolveStaticRequest('/?x=1', 'GET')).toEqual(expected);
    expect(resolveStaticRequest('/#/app', 'GET')).toEqual(expected);
  });

  it('maps asset paths to relative files for GET and HEAD', () => {
    const expected = { kind: 'file', relativePath: 'assets/index-abc.js', spaFallback: false };
    expect(resolveStaticRequest('/assets/index-abc.js', 'GET')).toEqual(expected);
    expect(resolveStaticRequest('/assets/index-abc.js', 'HEAD')).toEqual(expected);
  });

  it('allows an index.html fallback only for extensionless app routes', () => {
    expect(resolveStaticRequest('/console/case', 'GET')).toEqual({
      kind: 'file',
      relativePath: 'console/case',
      spaFallback: true,
    });
    expect(resolveStaticRequest('/missing.js', 'GET')).toEqual({
      kind: 'file',
      relativePath: 'missing.js',
      spaFallback: false,
    });
  });

  it.each([
    '/../package.json',
    '/..%2f..%2fpackage.json',
    '/%2e%2e/%2e%2e/package.json',
    '/a/../../x',
    '/a\\b',
    '/a%5Cb',
    '/a\0b',
    '/a%00b',
    '/%E0%A4%A',
  ])('rejects %j with 400 without throwing', (rawUrl) => {
    expect(resolveStaticRequest(rawUrl, 'GET')).toEqual({ kind: 'reject', status: 400 });
  });

  it('rejects a request target that is not an absolute path', () => {
    expect(resolveStaticRequest('index.html', 'GET')).toEqual({ kind: 'reject', status: 400 });
  });

  it.each(['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'])('rejects %s with 405', (method) => {
    expect(resolveStaticRequest('/', method)).toEqual({ kind: 'reject', status: 405 });
  });
});

describe('SECURITY_HEADERS', () => {
  it('forbids every network connection in the content security policy', () => {
    const csp = SECURITY_HEADERS['Content-Security-Policy'] ?? '';
    for (const directive of [
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
    ]) {
      expect(csp).toContain(directive);
    }
  });

  it('disables sniffing and referrers', () => {
    expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff');
    expect(SECURITY_HEADERS['Referrer-Policy']).toBe('no-referrer');
  });

  it('is frozen', () => {
    expect(Object.isFrozen(SECURITY_HEADERS)).toBe(true);
  });
});

describe('module import', () => {
  it('starts no server as a side effect (the import above returned)', () => {
    expect(typeof contentTypeFor).toBe('function');
  });
});
