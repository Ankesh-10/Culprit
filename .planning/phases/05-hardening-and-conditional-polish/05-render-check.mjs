// Phase 5 real-browser check: near-cap profile and the accessibility sweep (plan 05-02).
//
// Run from the repository root after `npm run build`:
//   node .planning/phases/05-hardening-and-conditional-polish/05-render-check.mjs [--sections profile,a11y] [--out <dir>] [--chrome <path>] [--server preview]
//
// It serves dist/ with the production server from plan 05-01 (scripts/serve-dist.mjs, the same server and CSP
// the Docker image runs) on 127.0.0.1:4175, drives headless Chrome or Edge over the DevTools protocol on
// 127.0.0.1:9225 with a temporary profile, and prints one line per check:
//   PASS <name>   WARN <name>: <detail>   FAIL <name>: <detail>   METRIC <name> <value>
// then `RESULT PASS` or `RESULT FAIL (n)`. Node built-ins plus the global fetch and WebSocket only; nothing
// leaves localhost. The server and the browser are stopped on every exit path.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNearCapInput } from '../../../scripts/near-cap-input.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const HOST = '127.0.0.1';
const PORT = 4175;
const ORIGIN = `http://${HOST}:${PORT}`;
const DEBUG_PORT = 9225;
const FOCUS_RING = 'rgb(87, 193, 255)';

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

const sections = new Set((argValue('--sections') ?? 'profile,a11y').split(',').map((name) => name.trim()).filter(Boolean));
const serverMode = argValue('--server') ?? 'serve-dist';
const outDir = resolve(argValue('--out') ?? mkdtempSync(join(tmpdir(), 'culprit-05-render-')));

function findChrome() {
  const explicit = argValue('--chrome') ?? process.env.CHROME_PATH;
  if (explicit) return explicit;
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const candidate of candidates) if (existsSync(candidate)) return candidate;
  for (const name of ['google-chrome', 'chromium']) {
    const probe = spawnSync(name, ['--version'], { stdio: 'ignore' });
    if (probe.status === 0) return name;
  }
  return undefined;
}

const levels = [];
function line(level, name, detail) {
  levels.push(level);
  console.log(detail === undefined || detail === '' ? `${level} ${name}` : `${level} ${name}${level === 'PASS' ? ' - ' : ': '}${detail}`);
}
const pass = (name, detail) => line('PASS', name, detail);
const warn = (name, detail) => line('WARN', name, detail);
const fail = (name, detail) => line('FAIL', name, detail);
const check = (ok, name, detail) => (ok ? pass(name, detail) : fail(name, detail ?? 'condition not met'));

const metrics = {};
function metric(name, value) {
  metrics[name] = value;
  console.log(`METRIC ${name} ${value}`);
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function poll(label, fn, limitMs, stepMs = 100) {
  const deadline = Date.now() + limitMs;
  for (;;) {
    let value;
    try {
      value = await fn();
    } catch {
      value = undefined;
    }
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await sleep(stepMs);
  }
}

function killTree(child) {
  if (child === undefined || child.exitCode !== null || child.pid === undefined) return;
  try {
    child.kill();
  } catch {
    // already gone
  }
  if (process.platform === 'win32' && child.exitCode === null) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  }
}

/** A small DevTools-protocol client over one page target. */
function connectCdp(url) {
  const socket = new WebSocket(url);
  let nextId = 0;
  const pending = new Map();
  const listeners = new Map();
  socket.addEventListener('message', (message) => {
    const data = JSON.parse(String(message.data));
    if (data.id !== undefined && pending.has(data.id)) {
      const { resolve: done, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(new Error(`${data.error.message} (${JSON.stringify(data.error.data ?? '')})`));
      else done(data.result ?? {});
    } else if (data.method !== undefined) {
      for (const listener of listeners.get(data.method) ?? []) listener(data.params ?? {});
    }
  });
  const opened = new Promise((done, reject) => {
    socket.addEventListener('open', () => done());
    socket.addEventListener('error', () => reject(new Error('DevTools socket error')));
  });
  return {
    opened,
    send(method, params = {}) {
      return new Promise((done, reject) => {
        const id = ++nextId;
        pending.set(id, { resolve: done, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    on(method, listener) {
      const list = listeners.get(method) ?? [];
      list.push(listener);
      listeners.set(method, list);
    },
    once(method, limitMs = 15000) {
      return new Promise((done, reject) => {
        const timer = setTimeout(() => reject(new Error(`timed out waiting for ${method}`)), limitMs);
        const list = listeners.get(method) ?? [];
        const handler = (params) => {
          clearTimeout(timer);
          listeners.set(method, (listeners.get(method) ?? []).filter((entry) => entry !== handler));
          done(params);
        };
        list.push(handler);
        listeners.set(method, list);
      });
    },
    close() {
      try {
        socket.close();
      } catch {
        // ignore
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------------------
// Server and browser

/** The production static server from plan 05-01 (default) or `vite preview` (`--server preview`). */
function startServer() {
  const args =
    serverMode === 'preview'
      ? ['node_modules/vite/bin/vite.js', 'preview', '--host', HOST, '--port', String(PORT), '--strictPort']
      : ['scripts/serve-dist.mjs', '--host', HOST, '--port', String(PORT)];
  return spawn(process.execPath, args, { cwd: ROOT, stdio: 'ignore' });
}

let server;
let browser;
let cdp;
let profileDir;

function cleanup() {
  killTree(browser);
  killTree(server);
}
process.on('exit', cleanup);

// ---------------------------------------------------------------------------------------------------------
// Page-side probes (strings so Runtime.evaluate runs them inside the page)

const FOCUS_PROBE = `(() => {
  const a = document.activeElement;
  if (!a || a === document.body || a === document.documentElement) return JSON.stringify({ none: true });
  const cs = getComputedStyle(a);
  const cls = typeof a.className === 'string' && a.className.trim() !== '' ? '.' + a.className.trim().split(/\\s+/).join('.') : '';
  return JSON.stringify({
    none: false,
    desc: a.tagName.toLowerCase() + (a.id ? '#' + a.id : '') + cls,
    label: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 40),
    style: cs.outlineStyle,
    width: parseFloat(cs.outlineWidth),
    color: cs.outlineColor,
    fileInput: a.matches('input[type="file"]'),
    inDrawer: !!a.closest('#suspect-drawer'),
  });
})()`;

const REAL_TEXT = `(() => {
  const real = (node) => {
    let out = '';
    for (const child of node.childNodes) {
      if (child.nodeType === 3) out += child.textContent;
      else if (child.nodeType === 1 && child.getAttribute('aria-hidden') !== 'true') out += real(child);
    }
    return out;
  };
  const pick = (selector) => { const node = document.querySelector(selector); return node ? real(node) : null; };
  return JSON.stringify({
    hash: pick('#app .verdict .verdict-hash'),
    score: pick('#app .verdict .score-value'),
    matches: pick('#app .verdict [data-fact="matches"] dd'),
  });
})()`;

const RESULT_READY = `(() => {
  const title = document.querySelector('#result-title');
  return !!title && title.getClientRects().length > 0 && title.textContent.startsWith('Result:') && !!document.querySelector('#app .verdict .verdict-hash');
})()`;

const LONGTASK_INSTALL = `(() => {
  if (!window.__long) {
    window.__long = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__long.push({ start: entry.startTime, duration: entry.duration });
    }).observe({ type: 'longtask', buffered: true });
  }
  return true;
})()`;

const longestSince = (startMs) => `(() => {
  const tasks = (window.__long || []).filter((task) => task.start >= ${startMs});
  return tasks.reduce((max, task) => Math.max(max, task.duration), 0);
})()`;

const BUTTON_BY_TEXT = (text) => `[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === ${JSON.stringify(text)})`;

const EXPECTED = { hash: '2222222', score: '0.91', matches: 'Matches 5 of 5 errors' };

// ---------------------------------------------------------------------------------------------------------

async function main() {
  mkdirSync(outDir, { recursive: true });
  if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
    fail('dist/index.html', 'missing: run npm run build first');
    return;
  }
  const chrome = findChrome();
  if (chrome === undefined) {
    fail('browser', 'no Chrome or Edge found: pass --chrome <path> or set CHROME_PATH');
    return;
  }

  server = startServer();
  await poll('the server', async () => (await fetch(`${ORIGIN}/`)).status === 200, 15000);

  profileDir = mkdtempSync(join(tmpdir(), 'culprit-05-chrome-'));
  browser = spawn(
    chrome,
    [
      '--headless=new',
      `--remote-debugging-port=${DEBUG_PORT}`,
      '--remote-debugging-address=127.0.0.1',
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const target = await poll(
    'a page target',
    async () => {
      const list = await (await fetch(`http://${HOST}:${DEBUG_PORT}/json/list`)).json();
      return list.find((entry) => entry.type === 'page' && entry.webSocketDebuggerUrl);
    },
    15000,
  );
  cdp = connectCdp(target.webSocketDebuggerUrl);
  await cdp.opened;

  const consoleErrors = [];
  const offOrigin = [];
  let rootResponse = null;
  cdp.on('Runtime.consoleAPICalled', (params) => {
    if (params.type === 'error' || params.type === 'assert') {
      consoleErrors.push(`console.${params.type}: ${(params.args ?? []).map((arg) => arg.value ?? arg.description ?? '').join(' ')}`);
    }
  });
  cdp.on('Runtime.exceptionThrown', (params) => {
    consoleErrors.push(`exception: ${params.exceptionDetails?.exception?.description ?? params.exceptionDetails?.text}`);
  });
  cdp.on('Log.entryAdded', (params) => {
    const entry = params.entry ?? {};
    if (entry.level !== 'error') return;
    if ((entry.url ?? '').endsWith('/favicon.ico')) console.log(`INFO favicon request failed (ignored): ${entry.text}`);
    else consoleErrors.push(`log.error: ${entry.text} ${entry.url ?? ''}`);
  });
  cdp.on('Network.requestWillBeSent', (params) => {
    const url = params.request?.url ?? '';
    if (/^(data|blob|about):/.test(url)) return;
    let origin;
    try {
      origin = new URL(url).origin;
    } catch {
      origin = url;
    }
    if (origin !== ORIGIN) offOrigin.push(url);
  });
  cdp.on('Network.responseReceived', (params) => {
    if (rootResponse === null && params.type === 'Document' && params.response?.url === `${ORIGIN}/`) rootResponse = params.response;
  });
  for (const domain of ['Page', 'Runtime', 'Log', 'Network', 'DOM']) await cdp.send(`${domain}.enable`);
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => undefined);

  const evaluate = async (expression) => {
    const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };

  /** `setEmulatedMedia` replaces the whole feature list, so every call restates the colour scheme. */
  const setMedia = (reduce, extra = []) =>
    cdp.send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'prefers-color-scheme', value: 'dark' },
        { name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' },
        ...extra,
      ],
    });

  const setViewport = (width, height) =>
    cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });

  // Every page load goes through about:blank so a hash-only change can never be a same-document navigation.
  const openFresh = async (url) => {
    const blank = cdp.once('Page.loadEventFired');
    await cdp.send('Page.navigate', { url: 'about:blank' });
    await blank;
    const loaded = cdp.once('Page.loadEventFired');
    await cdp.send('Page.navigate', { url });
    await loaded;
    await sleep(300);
  };

  const dispatchKey = async (key, code, keyCode, text) => {
    const base = { key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, ...(text === undefined ? {} : { text }) });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  };
  const KEYS = {
    Tab: ['Tab', 'Tab', 9],
    Enter: ['Enter', 'Enter', 13, '\r'],
    Space: [' ', 'Space', 32, ' '],
    Escape: ['Escape', 'Escape', 27],
    ArrowRight: ['ArrowRight', 'ArrowRight', 39],
    ArrowLeft: ['ArrowLeft', 'ArrowLeft', 37],
  };
  const press = (name) => dispatchKey(...KEYS[name]);

  const focusSelector = (selector) =>
    evaluate(`(() => { const node = document.querySelector(${JSON.stringify(selector)}); if (!node) return false; node.focus(); return document.activeElement === node; })()`);

  // ---------------------------------------------------------------------------------------------------------
  // Section: profile

  async function runProfile() {
    console.log('SECTION profile');
    await setMedia(true);
    await setViewport(1280, 720);
    const input = buildNearCapInput();
    const dir = join(outDir, 'near-cap');
    mkdirSync(dir, { recursive: true });
    const logPath = join(dir, 'near-cap.jsonl');
    const historyPath = join(dir, 'near-cap-history.json');
    writeFileSync(logPath, input.logText, 'utf8');
    writeFileSync(historyPath, input.historyText, 'utf8');
    metric('near-cap-log-bytes', input.expected.logBytes);
    metric('near-cap-history-bytes', input.expected.historyBytes);

    await openFresh(`${ORIGIN}/#/app`);
    await evaluate(`document.querySelector('button[data-case-id="own-files"]').click()`);
    await poll('the own-files form', () => evaluate(`!!document.querySelector('#own-log-file') && !!document.querySelector('#own-history-file')`), 5000, 50);

    for (const [selector, path] of [['#own-log-file', logPath], ['#own-history-file', historyPath]]) {
      const node = await cdp.send('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(selector)})` });
      await cdp.send('DOM.setFileInputFiles', { files: [path], objectId: node.result.objectId });
    }
    await poll('the Analyze incident button to enable', () => evaluate(`(() => { const b = ${BUTTON_BY_TEXT('Analyze incident')}; return !!b && !b.disabled; })()`), 20000, 50);

    await evaluate(LONGTASK_INSTALL);
    const shortHash = input.expected.leadingSha.slice(0, 7);
    await evaluate(`(() => {
      window.__done = null;
      const tick = () => {
        const title = document.querySelector('#result-title');
        const hash = document.querySelector('#app .verdict .verdict-hash');
        if (title && document.activeElement === title && hash && hash.textContent === ${JSON.stringify(shortHash)}) window.__done = performance.now();
        else requestAnimationFrame(tick);
      };
      window.__t0 = performance.now();
      ${BUTTON_BY_TEXT('Analyze incident')}.click();
      requestAnimationFrame(tick);
      return true;
    })()`);

    // The worker runs the analysis, so the main thread must answer a trivial evaluation straight away.
    const askedAt = Date.now();
    const answer = await Promise.race([evaluate('1 + 1'), sleep(1000).then(() => 'timeout')]);
    const responsiveMs = Date.now() - askedAt;
    metric('main-thread-responsive-ms', responsiveMs);
    check(answer === 2 && responsiveMs <= 1000, 'main thread answers while analyzing', `1 + 1 returned in ${responsiveMs} ms`);

    const startedAt = await poll('the near-cap result', async () => (await evaluate('window.__done !== null')) && (await evaluate('window.__t0')), 40000, 25);
    const doneAt = await evaluate('window.__done');
    const analyzeMs = Math.round(doneAt - startedAt);
    metric('analyze-to-result-ms', analyzeMs);
    check(analyzeMs <= 10000, 'analyze-to-result within 10 s', `${analyzeMs} ms`);
    await sleep(500);
    const resultLong = Math.round(await evaluate(longestSince(startedAt)));
    metric('result-max-longtask-ms', resultLong);
    if (resultLong > 1500) fail('result max long task <= 1500 ms', `${resultLong} ms`);
    else if (resultLong > 500) warn('result max long task <= 500 ms', `${resultLong} ms`);
    else pass('result max long task', `${resultLong} ms`);

    // Bounded lists.
    const bounds = JSON.parse(
      await evaluate(`(() => {
        const overlay = document.querySelector('.timeline-svg .pointer-overlay');
        document.querySelector('.table-twin').open = true;
        return JSON.stringify({
          seriesPaths: document.querySelectorAll('.timeline-svg path.series-line').length,
          overlays: document.querySelectorAll('.timeline-svg .pointer-overlay').length,
          plotWidth: overlay ? Number(overlay.getAttribute('width')) : null,
          otherMarkers: document.querySelectorAll('.timeline-svg .marker-other').length,
          leading: document.querySelectorAll('.timeline-svg .marker-leading').length,
          ranked: document.querySelectorAll('.timeline-svg .marker-ranked').length,
          consideredSummary: (document.querySelector('details.considered summary') || {}).textContent || null,
          consideredRows: document.querySelectorAll('details.considered tbody tr').length,
          consideredMore: !!document.querySelector('[data-focus-id="considered-more"]'),
          twinRows: document.querySelectorAll('.table-twin tbody tr').length,
          twinCount: (document.querySelector('.table-twin .log-count') || {}).textContent || null,
        });
      })()`),
    );
    check(bounds.seriesPaths === 1, 'error series is a single path', `${bounds.seriesPaths} path(s)`);
    check(bounds.overlays === 1, 'one pointer overlay', `${bounds.overlays}`);
    check(bounds.leading === 1 && bounds.ranked === 2, 'top three markers drawn', `leading ${bounds.leading}, ranked ${bounds.ranked}`);
    check(bounds.otherMarkers > 0 && bounds.otherMarkers <= bounds.plotWidth + 3, 'non-suspect markers bounded to the plot width', `${bounds.otherMarkers} markers on a ${bounds.plotWidth} px plot`);
    metric('other-marker-count', bounds.otherMarkers);
    check(bounds.consideredSummary === 'Commits considered (3000)', 'Commits considered states the full total', bounds.consideredSummary ?? 'missing');
    check(bounds.consideredRows <= 100 && bounds.consideredRows > 0 && bounds.consideredMore, 'Commits considered is paged at 100', `${bounds.consideredRows} rows, Show next 100 ${bounds.consideredMore ? 'present' : 'missing'}`);
    check(bounds.twinRows <= 100 && bounds.twinRows > 0, 'data table is paged at 100', `${bounds.twinRows} rows (${bounds.twinCount})`);

    // Show next 100 appends in place.
    await evaluate(`document.querySelector('details.considered').open = true; document.querySelector('[data-focus-id="considered-more"]').focus()`);
    await press('Enter');
    await sleep(150);
    const afterMore = JSON.parse(
      await evaluate(`JSON.stringify({ rows: document.querySelectorAll('details.considered tbody tr').length, count: (document.querySelector('details.considered .log-count') || {}).textContent || null, focusId: document.activeElement.getAttribute('data-focus-id') })`),
    );
    check(afterMore.rows === 200 && afterMore.focusId === 'considered-more', 'Show next 100 appends a second page and keeps focus', `${afterMore.rows} rows, ${afterMore.count}`);

    // Slider: log lines after Enter, then ten steps.
    await focusSelector('.timeline-slider');
    await press('Enter');
    await poll('the log lines panel', () => evaluate(`!!document.querySelector('.log-lines .log-table')`), 5000, 50);
    const logRows = await evaluate(`document.querySelectorAll('.log-lines .log-table tbody tr').length`);
    check(logRows > 0 && logRows <= 100, 'log lines are paged at 100', `${logRows} rows`);
    await evaluate(`${BUTTON_BY_TEXT('Close log lines')}.click()`);
    await sleep(200);

    await focusSelector('.timeline-slider');
    const readoutBefore = await evaluate(`document.querySelector('.readout-text').textContent`);
    const stepsFrom = await evaluate('performance.now()');
    let worstDispatch = 0;
    for (let step = 0; step < 10; step += 1) {
      const at = Date.now();
      await press('ArrowRight');
      worstDispatch = Math.max(worstDispatch, Date.now() - at);
      await sleep(80);
    }
    await sleep(300);
    const readoutAfter = await evaluate(`document.querySelector('.readout-text').textContent`);
    const sliderLong = Math.round(await evaluate(longestSince(stepsFrom)));
    metric('slider-step-max-longtask-ms', sliderLong);
    metric('slider-step-max-dispatch-ms', worstDispatch);
    check(readoutAfter !== readoutBefore, 'slider steps change the readout', `${JSON.stringify(readoutBefore.slice(0, 40))} to ${JSON.stringify(readoutAfter.slice(0, 40))}`);
    if (sliderLong > 250) fail('slider step max long task <= 250 ms', `${sliderLong} ms`);
    else if (sliderLong > 100) warn('slider step max long task <= 100 ms', `${sliderLong} ms`);
    else pass('slider step max long task', `${sliderLong} ms`);

    // Signature filter opens a 290-line scope: still one page of 100.
    await evaluate(`document.querySelector('.signature-toggle').click()`);
    await poll('the signature log lines', () => evaluate(`document.querySelectorAll('.log-lines .log-table tbody tr').length > 0`), 5000, 50);
    const signatureRows = JSON.parse(
      await evaluate(`JSON.stringify({ rows: document.querySelectorAll('.log-lines .log-table tbody tr').length, count: (document.querySelector('.log-lines .log-count') || {}).textContent || null })`),
    );
    check(signatureRows.rows === 100 && signatureRows.count === 'Showing 100 of 290', 'signature scope shows 100 of 290 log lines', `${signatureRows.rows} rows (${signatureRows.count})`);

    // Resize 1280 to 360 to 1280.
    const resizeFrom = await evaluate('performance.now()');
    await setViewport(360, 740);
    await sleep(700);
    const narrow = JSON.parse(await evaluate(`JSON.stringify({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })`));
    await setViewport(1280, 720);
    await sleep(700);
    const resizeLong = Math.round(await evaluate(longestSince(resizeFrom)));
    metric('resize-max-longtask-ms', resizeLong);
    check(resizeLong <= 500, 'resize redraw <= 500 ms', `${resizeLong} ms`);
    check(narrow.scrollWidth <= narrow.innerWidth, 'no horizontal scroll at 360 px with the near-cap result', `scrollWidth ${narrow.scrollWidth} vs innerWidth ${narrow.innerWidth}`);

    writeFileSync(join(outDir, 'profile.json'), `${JSON.stringify(metrics, null, 2)}\n`, 'utf8');
    console.log(`INFO profile.json written to ${join(outDir, 'profile.json')}`);
  }

  // ---------------------------------------------------------------------------------------------------------
  // Section: a11y

  /** Open #/app and load the checkout case with the keyboard only. */
  async function loadCheckoutByKeyboard() {
    await openFresh(`${ORIGIN}/#/app`);
    await poll('the checkout card', () => focusSelector('button[data-case-id="checkout-outage"]'), 5000, 50);
    await press('Enter');
    await poll('the checkout result', () => evaluate(RESULT_READY), 10000, 30);
  }

  async function runA11y() {
    console.log('SECTION a11y');
    await setViewport(1280, 800);

    // Reduced motion: nothing animates and the verdict is exact at first detection.
    await setMedia(true);
    await loadCheckoutByKeyboard();
    const first = JSON.parse(await evaluate(REAL_TEXT));
    check(first.hash === EXPECTED.hash && first.score === EXPECTED.score && first.matches === EXPECTED.matches, 'reduced motion: verdict exact at first detection', JSON.stringify(first));
    const animations = await evaluate('document.getAnimations().length');
    const ghost = await evaluate(`document.querySelectorAll('.roll-ghost').length`);
    check(animations === 0 && ghost === 0, 'reduced motion: no animation and no roll ghost', `animations ${animations}, ghosts ${ghost}`);
    await sleep(700);
    const later = await evaluate('document.getAnimations().length');
    check(later === 0, 'reduced motion: still no animation after 700 ms', `animations ${later}`);

    // Widths with the result shown, then with the drawer open at 320 and 1280.
    for (const width of [320, 360, 768, 1280]) {
      await setViewport(width, 800);
      await sleep(450);
      const sizes = JSON.parse(await evaluate(`JSON.stringify({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })`));
      check(sizes.scrollWidth <= sizes.innerWidth, `width ${width}: no horizontal page scroll`, `scrollWidth ${sizes.scrollWidth} vs innerWidth ${sizes.innerWidth}`);
      if (width === 320 || width === 1280) {
        await evaluate(`(() => { const b = document.querySelector('#app button[data-suspect-rank]'); b.scrollIntoView({ block: 'center' }); b.focus(); return true; })()`);
        await press('Enter');
        const opened = await poll('the drawer', () => evaluate(`document.querySelector('#suspect-drawer').hasAttribute('open')`), 3000, 30).catch(() => false);
        await sleep(450);
        const drawerSizes = JSON.parse(await evaluate(`JSON.stringify({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })`));
        check(Boolean(opened) && drawerSizes.scrollWidth <= drawerSizes.innerWidth, `width ${width}: no horizontal page scroll with the drawer open`, `scrollWidth ${drawerSizes.scrollWidth} vs innerWidth ${drawerSizes.innerWidth}`);
        await press('Escape');
        await sleep(200);
      }
    }
    await setViewport(1280, 800);
    await sleep(450);

    // Focus ring: Tab through the page from the top.
    await evaluate(`(() => {
      window.scrollTo(0, 0);
      if (document.activeElement) document.activeElement.blur();
      const anchor = document.createElement('span');
      anchor.tabIndex = -1;
      document.body.prepend(anchor);
      anchor.focus();
      anchor.remove();
      return true;
    })()`);
    const stops = [];
    for (let index = 0; index < 40; index += 1) {
      await press('Tab');
      stops.push(JSON.parse(await evaluate(FOCUS_PROBE)));
    }
    const focused = stops.filter((stop) => !stop.none && !stop.fileInput);
    const badRing = focused.filter((stop) => stop.style !== 'solid' || stop.width < 2 || stop.color !== FOCUS_RING);
    check(focused.length >= 20, 'Tab reaches at least 20 controls in 40 presses', `${focused.length} focus stops`);
    check(badRing.length === 0, 'every focused control draws a 2 px solid focus ring in #57c1ff', badRing.length === 0 ? `${focused.length} stops checked` : badRing.map((stop) => `${stop.desc} (${stop.style} ${stop.width}px ${stop.color})`).join('; '));

    // Keyboard-only timeline.
    await focusSelector('.timeline-slider');
    const readout0 = await evaluate(`document.querySelector('.readout-text').textContent`);
    // The checkout onset sits on the last interval, so try the other direction when the first key is clamped.
    let forward = 'ArrowRight';
    let backward = 'ArrowLeft';
    await press(forward);
    await sleep(100);
    let readout1 = await evaluate(`document.querySelector('.readout-text').textContent`);
    if (readout1 === readout0) {
      [forward, backward] = [backward, forward];
      await press(forward);
      await sleep(100);
      readout1 = await evaluate(`document.querySelector('.readout-text').textContent`);
    }
    check(readout1 !== readout0, `keyboard: ${forward} moves the timeline selection`, `${JSON.stringify(readout0.slice(0, 40))} to ${JSON.stringify(readout1.slice(0, 40))}`);
    await press(backward);
    await sleep(100);
    await press('Enter');
    const slideLogs = await poll('the log lines panel', () => evaluate(`document.querySelectorAll('.log-lines .log-table tbody tr').length`), 3000, 30).catch(() => 0);
    check(slideLogs >= 1, 'keyboard: Enter on the slider opens log lines', `${slideLogs} row(s)`);
    await focusSelector('.log-lines .log-lines-header button');
    await press('Enter');
    await sleep(200);
    const afterClose = JSON.parse(await evaluate(`JSON.stringify({ open: !!document.querySelector('.log-lines'), slider: document.activeElement.classList.contains('timeline-slider') })`));
    check(!afterClose.open && afterClose.slider, 'keyboard: Close log lines by Enter returns focus to the slider', JSON.stringify(afterClose));

    await focusSelector('.table-twin summary');
    await press('Enter');
    await sleep(150);
    const tableOpen = await evaluate(`document.querySelector('.table-twin').open`);
    check(tableOpen === true, 'keyboard: Enter on the data table summary opens it');
    await focusSelector('.twin-table tbody tr button');
    await press('Enter');
    const rowLogs = await poll('the row log lines', () => evaluate(`document.querySelectorAll('.log-lines .log-table tbody tr').length`), 3000, 30).catch(() => 0);
    const rowOpened = await evaluate(`!!document.querySelector('.log-lines')`);
    check(rowOpened === true, "keyboard: a data table row's Show log lines opens the panel", `${rowLogs} row(s)`);
    await focusSelector('.log-lines .log-lines-header button');
    await press('Enter');
    await sleep(200);

    await focusSelector('.signature-toggle');
    await press('Space');
    await sleep(250);
    const filtered = JSON.parse(
      await evaluate(`JSON.stringify({ pressed: document.querySelector('.signature-toggle').getAttribute('aria-pressed'), legend: (document.querySelector('.chart-legend') || {}).textContent || '' })`),
    );
    check(filtered.pressed === 'true' && filtered.legend.includes('Filtered:'), 'keyboard: Space on a Filter timeline toggle filters the series', `aria-pressed ${filtered.pressed}, legend "${filtered.legend.slice(0, 50)}"`);
    await evaluate(`${BUTTON_BY_TEXT('Close log lines')}?.click()`);

    // Drawer focus management.
    await evaluate(`(() => { const b = document.querySelector('#app button[data-suspect-rank]'); b.scrollIntoView({ block: 'center' }); b.focus(); return true; })()`);
    await evaluate(`window.__opener = document.activeElement; true`);
    await press('Enter');
    await poll('the drawer', () => evaluate(`document.querySelector('#suspect-drawer').hasAttribute('open')`), 3000, 30);
    await sleep(250);
    const titleFocus = await evaluate(`document.activeElement.id`);
    check(titleFocus === 'drawer-title', 'drawer: focus moves to the drawer title on open', `focus on #${titleFocus}`);
    let escaped = 0;
    for (let index = 0; index < 15; index += 1) {
      await press('Tab');
      const stop = JSON.parse(await evaluate(FOCUS_PROBE));
      if (!stop.none && !stop.inDrawer) escaped += 1;
    }
    check(escaped === 0, 'drawer: 15 Tab presses never leave the dialog', `${escaped} stop(s) outside`);
    await press('Escape');
    await sleep(250);
    const closed = JSON.parse(await evaluate(`JSON.stringify({ open: document.querySelector('#suspect-drawer').hasAttribute('open'), back: document.activeElement === window.__opener })`));
    check(!closed.open && closed.back, 'drawer: Escape closes it and returns focus to Inspect evidence', JSON.stringify(closed));

    // Forced colours.
    await setMedia(true, [{ name: 'forced-colors', value: 'active' }]);
    await loadCheckoutByKeyboard();
    const forced = JSON.parse(await evaluate(REAL_TEXT));
    check(forced.hash === EXPECTED.hash, 'forced colours: the verdict renders', JSON.stringify(forced));
    await evaluate(`(() => { window.scrollTo(0, 0); document.activeElement.blur(); const a = document.createElement('span'); a.tabIndex = -1; document.body.prepend(a); a.focus(); a.remove(); return true; })()`);
    await press('Tab');
    const forcedStop = JSON.parse(await evaluate(FOCUS_PROBE));
    check(!forcedStop.none && forcedStop.style !== 'none' && forcedStop.width > 0, 'forced colours: Tab still draws an outline', `${forcedStop.desc} ${forcedStop.style} ${forcedStop.width}px ${forcedStop.color}`);
    const ambient = await evaluate(`(() => { const a = document.querySelector('.ambient'); return a ? getComputedStyle(a).display : 'absent'; })()`);
    check(ambient === 'none' || ambient === 'absent', 'forced colours: the ambient layer is not displayed', `display ${ambient}`);
    await setMedia(true);
  }

  try {
    if (sections.has('profile')) await runProfile();
    if (sections.has('a11y')) await runA11y();
  } catch (error) {
    fail('check aborted', error.message);
  }

  check(consoleErrors.length === 0, 'console errors', consoleErrors.length === 0 ? 'none' : consoleErrors.join(' || '));
  check(offOrigin.length === 0, 'off-origin requests', offOrigin.length === 0 ? 'none' : offOrigin.join(' || '));
  if (serverMode === 'preview') {
    console.log('INFO CSP header check skipped with --server preview');
  } else if (rootResponse === null) {
    fail('root response headers', 'the / document response was not observed');
  } else {
    const headers = Object.fromEntries(Object.entries(rootResponse.headers ?? {}).map(([name, value]) => [name.toLowerCase(), String(value)]));
    check(headers['content-type'] === 'text/html; charset=utf-8', '/ content type', headers['content-type'] ?? 'missing');
    check((headers['content-security-policy'] ?? '').includes("connect-src 'none'"), "/ content security policy has connect-src 'none'", headers['content-security-policy'] ?? 'missing');
  }
}

try {
  await main();
} catch (error) {
  fail('render check aborted', error.message);
} finally {
  if (cdp !== undefined) {
    await Promise.race([cdp.send('Browser.close').catch(() => undefined), sleep(2000)]);
    cdp.close();
    await sleep(500);
  }
  killTree(browser);
  killTree(server);
  await sleep(300);
  if (profileDir !== undefined) {
    try {
      rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      console.log(`INFO could not delete the temporary profile ${profileDir}`);
    }
  }
}

const failures = levels.filter((level) => level === 'FAIL').length;
console.log(failures === 0 && levels.length > 0 ? 'RESULT PASS' : `RESULT FAIL (${failures})`);
process.exit(failures === 0 && levels.length > 0 ? 0 : 1);
