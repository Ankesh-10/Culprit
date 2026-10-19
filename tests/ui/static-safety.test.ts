import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = new URL('../../', import.meta.url);
const rootPath = projectRoot.pathname.replace(/^\/([A-Za-z]:)/, '$1');

function walk(directory: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(directory).sort()) {
    const full = join(directory, name);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (full.endsWith('.ts')) files.push(full);
  }
  return files;
}

function sourceFiles(subdirectory: string): Array<{ path: string; text: string }> {
  return walk(join(rootPath, subdirectory)).map((full) => ({
    path: relative(rootPath, full).split('\\').join('/'),
    text: readFileSync(full, 'utf8'),
  }));
}

const srcFiles = sourceFiles('src');
const indexHtml = { path: 'index.html', text: readFileSync(join(rootPath, 'index.html'), 'utf8') };
const scanned = [...srcFiles, indexHtml];

function offenders(files: Array<{ path: string; text: string }>, pattern: RegExp): string[] {
  return files.filter((file) => pattern.test(file.text)).map((file) => file.path);
}

describe('static safety over src/ and index.html', () => {
  it('scans a real file set', () => {
    expect(srcFiles.length).toBeGreaterThan(10);
  });

  it('has no HTML-string sink', () => {
    expect(offenders(scanned, /\binnerHTML\b|\bouterHTML\b|insertAdjacentHTML|document\.write/)).toEqual([]);
  });

  it('has no network API', () => {
    expect(offenders(scanned, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|\bWebSocket\b|\bEventSource\b|importScripts/)).toEqual([]);
  });

  it('has no browser storage API', () => {
    expect(offenders(scanned, /localStorage|sessionStorage|indexedDB|document\.cookie/)).toEqual([]);
  });

  it('contains no absolute URL other than the single SVG namespace in src/ui/dom.ts', () => {
    const urls: Array<{ path: string; url: string }> = [];
    for (const file of srcFiles) {
      for (const match of file.text.matchAll(/https?:\/\/\S+/g)) urls.push({ path: file.path, url: match[0] });
    }
    expect(urls).toEqual([{ path: 'src/ui/dom.ts', url: "http://www.w3.org/2000/svg';" }]);
    expect(indexHtml.text.match(/https?:\/\/\S+/g)).toBeNull();
  });

  it('keeps clock, randomness and locale APIs out of src/ui and src/worker', () => {
    const files = srcFiles.filter((file) => file.path.startsWith('src/ui/') || file.path.startsWith('src/worker/'));
    expect(files.length).toBeGreaterThan(0);
    expect(offenders(files, /Date\.now|Math\.random|\bIntl\b|toLocale/)).toEqual([]);
  });

  it('adds no runtime dependency and keeps exactly the four dev dependencies', () => {
    const packageJson = JSON.parse(readFileSync(join(rootPath, 'package.json'), 'utf8')) as {
      dependencies?: unknown;
      devDependencies?: Record<string, string>;
    };
    expect(packageJson.dependencies).toBeUndefined();
    expect(Object.keys(packageJson.devDependencies ?? {}).sort()).toEqual(['@types/node', 'typescript', 'vite', 'vitest']);
  });
});
