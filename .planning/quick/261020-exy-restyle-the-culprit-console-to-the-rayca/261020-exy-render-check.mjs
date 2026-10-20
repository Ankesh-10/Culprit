// Headless render check for the Raycast restyle (quick task 261020-exy).
//
// Run from the repository root after `npm run build`:
//   node .planning/quick/261020-exy-restyle-the-culprit-console-to-the-rayca/261020-exy-render-check.mjs [--out <dir>] [--chrome <path>]
//
// It serves dist/ with `vite preview` on 127.0.0.1:4173, drives a headless Chromium-based browser over the
// DevTools protocol on 127.0.0.1:9223, loads the checkout case at 1280x720 and 360x740, and prints one line
// per check. Node built-ins plus the global fetch and WebSocket only; nothing leaves localhost.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ORIGIN = 'http://127.0.0.1:4173';
const DEBUG_PORT = 9223;

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

const outDir = resolve(argValue('--out') ?? join(tmpdir(), 'culprit-261020-exy'));

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

const results = [];
function report(level, message) {
  results.push(level);
  console.log(`${level.padEnd(5)} ${message}`);
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

// Page-side checks. Returned as a string so Runtime.evaluate runs it inside the page.
const PAGE_METRICS = `(() => {
  const out = {};
  out.bodyBackground = getComputedStyle(document.body).backgroundColor;
  out.scrollWidth = document.documentElement.scrollWidth;
  out.innerWidth = window.innerWidth;
  const weights = new Set();
  for (const element of document.body.querySelectorAll('*')) {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(element.tagName)) continue;
    let direct = false;
    for (const node of element.childNodes) {
      if (node.nodeType === 3 && node.textContent.trim() !== '') { direct = true; break; }
    }
    if (direct) weights.add(getComputedStyle(element).fontWeight);
  }
  out.weights = [...weights].sort();
  const verdict = document.querySelector('.verdict h2') || document.querySelector('.verdict');
  out.verdictTop = verdict ? Math.round(verdict.getBoundingClientRect().top + window.scrollY) : null;
  return JSON.stringify(out);
})()`;

const HIT_PROBE = `(() => {
  const all = [...document.querySelectorAll('button')];
  const label = (button) => (button.getAttribute('aria-label') || button.textContent || '').trim();
  const targets = all.filter((button) => {
    if (button.getClientRects().length === 0) return false;
    if (typeof button.checkVisibility === 'function' && !button.checkVisibility()) return false;
    const text = label(button);
    return button.classList.contains('case-toggle')
      || text.includes('Inspect evidence')
      || text.includes('Copy Markdown postmortem')
      || (button.textContent || '').trim().startsWith('Show log lines');
  });
  const misses = [];
  let smallest = Infinity;
  for (const button of targets) {
    button.scrollIntoView({ block: 'center' });
    const rect = button.getBoundingClientRect();
    smallest = Math.min(smallest, rect.height);
    const x = rect.left + rect.width / 2;
    const above = document.elementFromPoint(x, rect.top - 3);
    const below = document.elementFromPoint(x, rect.bottom + 3);
    const okAbove = above !== null && above.closest('button') === button;
    const okBelow = below !== null && below.closest('button') === button;
    if (!okAbove || !okBelow || rect.height < 35.5) {
      const describe = (hit) => (hit === null ? 'null' : hit.tagName.toLowerCase() + (hit.className && typeof hit.className === 'string' ? '.' + hit.className.split(' ')[0] : ''));
      misses.push(label(button).slice(0, 40) + ' h=' + rect.height.toFixed(1) + ' above=' + okAbove + ' (' + describe(above) + ') below=' + okBelow + ' (' + describe(below) + (below && below.closest('button') ? ' gap=' + (below.closest('button').getBoundingClientRect().top - rect.bottom).toFixed(2) : '') + ')');
    }
  }
  window.scrollTo(0, 0);
  return JSON.stringify({ count: targets.length, smallest, misses });
})()`;

const FOCUS_PROBE = `(() => {
  const element = document.activeElement;
  const style = getComputedStyle(element);
  return JSON.stringify({
    tag: element.tagName,
    text: (element.textContent || '').trim().slice(0, 30),
    style: style.outlineStyle,
    width: style.outlineWidth,
    color: style.outlineColor,
    offset: style.outlineOffset,
  });
})()`;

let preview;
let browser;
let cdp;

async function main() {
  mkdirSync(outDir, { recursive: true });

  if (!existsSync(join('dist', 'index.html'))) {
    console.error('dist/index.html is missing: run npm run build first');
    process.exitCode = 1;
    return;
  }
  const chrome = findChrome();
  if (chrome === undefined) {
    console.error('no Chrome or Edge found: pass --chrome <path> or set CHROME_PATH');
    process.exitCode = 1;
    return;
  }

  preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
    stdio: 'ignore',
  });
  await poll('the preview server', async () => (await fetch(`${ORIGIN}/`)).status === 200, 15000);

  browser = spawn(
    chrome,
    [
      '--headless=new',
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${join(outDir, 'profile')}`,
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
      const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
      return list.find((entry) => entry.type === 'page' && entry.webSocketDebuggerUrl);
    },
    15000,
  );
  cdp = connectCdp(target.webSocketDebuggerUrl);
  await cdp.opened;

  const consoleErrors = [];
  const offOrigin = [];
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
    if ((entry.url ?? '').endsWith('/favicon.ico')) report('INFO', `favicon request failed (ignored): ${entry.text}`);
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

  for (const domain of ['Page', 'Runtime', 'Log', 'Network', 'DOM', 'CSS']) await cdp.send(`${domain}.enable`);
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => undefined);

  const evaluate = async (expression) => {
    const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };

  const press = async (key, code, keyCode) => {
    const base = { key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  };

  const screenshot = async (name, fullPage) => {
    const params = { format: 'png' };
    if (fullPage) {
      const height = await evaluate('Math.ceil(document.documentElement.scrollHeight)');
      const width = await evaluate('window.innerWidth');
      params.captureBeyondViewport = true;
      params.clip = { x: 0, y: 0, width, height, scale: 1 };
    }
    const shot = await cdp.send('Page.captureScreenshot', params);
    const file = join(outDir, name);
    writeFileSync(file, Buffer.from(shot.data, 'base64'));
    console.log(`SHOT  ${file}`);
  };

  const viewports = [
    { width: 1280, height: 720, mobile: false },
    { width: 360, height: 740, mobile: true },
  ];

  for (const { width, height, mobile } of viewports) {
    const tag = `${width}x${height}`;
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    const loaded = cdp.once('Page.loadEventFired');
    await cdp.send('Page.navigate', { url: `${ORIGIN}/` });
    await loaded;
    await sleep(300);

    if (width === 1280) {
      await press('Tab', 'Tab', 9);
      await sleep(100);
      const focus = JSON.parse(await evaluate(FOCUS_PROBE));
      const ok = focus.style === 'solid' && focus.width === '2px' && focus.color === 'rgb(87, 193, 255)';
      report(ok ? 'PASS' : 'FAIL', `[${tag}] first Tab focus ring on ${focus.tag} "${focus.text}": ${focus.style} ${focus.width} ${focus.color} offset ${focus.offset}`);
    }

    await evaluate(`document.querySelector('button[data-case-id="checkout-outage"]').click()`);
    await poll(
      'the checkout result',
      () =>
        evaluate(`(() => {
          const title = document.querySelector('#result-title');
          return !!title && title.getClientRects().length > 0 && title.textContent.startsWith('Result:') && !!document.querySelector('.verdict');
        })()`),
      10000,
      150,
    );
    await sleep(500);

    const metrics = JSON.parse(await evaluate(PAGE_METRICS));
    report(metrics.bodyBackground === 'rgb(7, 8, 10)' ? 'PASS' : 'FAIL', `[${tag}] body background ${metrics.bodyBackground}`);

    const overflow = metrics.scrollWidth > metrics.innerWidth;
    report(overflow && width === 360 ? 'FAIL' : overflow ? 'WARN' : 'PASS', `[${tag}] scrollWidth ${metrics.scrollWidth} vs innerWidth ${metrics.innerWidth}`);

    const stray = metrics.weights.filter((weight) => weight !== '400' && weight !== '500');
    report(stray.length === 0 ? 'PASS' : 'FAIL', `[${tag}] font weights in use: ${metrics.weights.join(', ')}`);

    if (width === 1280) {
      if (metrics.verdictTop === null) report('WARN', `[${tag}] verdict heading not found`);
      else report(metrics.verdictTop <= 720 ? 'PASS' : 'WARN', `[${tag}] verdict heading top ${metrics.verdictTop}px (limit 720)`);
    }

    const probe = JSON.parse(await evaluate(HIT_PROBE));
    report(
      probe.misses.length === 0 && probe.count > 0 ? 'PASS' : 'FAIL',
      `[${tag}] hit areas on ${probe.count} core-path buttons, smallest drawn height ${probe.smallest.toFixed(1)}px${probe.misses.length ? `; misses: ${probe.misses.join(' | ')}` : ''}`,
    );

    await cdp.send('DOM.getDocument', { depth: 0 });
    const root = await cdp.send('DOM.getDocument', { depth: 0 });
    for (const selector of ['#result-title', '.verdict-hash', '.chip-warning']) {
      try {
        const node = await cdp.send('DOM.querySelector', { nodeId: root.root.nodeId, selector });
        if (!node.nodeId) {
          report('INFO', `[${tag}] fonts for ${selector}: element not present`);
          continue;
        }
        const platform = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: node.nodeId });
        report('INFO', `[${tag}] rendered fonts for ${selector}: ${(platform.fonts ?? []).map((font) => `${font.familyName}${font.isCustomFont ? ' (custom)' : ''}`).join(', ') || 'none'}`);
      } catch (error) {
        report('INFO', `[${tag}] fonts for ${selector}: ${error.message}`);
      }
    }

    await evaluate('window.scrollTo(0, 0)');
    await screenshot(`culprit-${tag}.png`, false);
    await screenshot(`culprit-${tag}-full.png`, true);

    const opened = await evaluate(`(() => {
      const button = [...document.querySelectorAll('.verdict button')].find((entry) => (entry.getAttribute('aria-label') || entry.textContent || '').includes('Inspect evidence'));
      if (!button) return false;
      button.scrollIntoView({ block: 'center' });
      button.click();
      return true;
    })()`);
    if (!opened) {
      report('FAIL', `[${tag}] verdict Inspect evidence button not found`);
    } else {
      try {
        await poll('the drawer', () => evaluate(`document.querySelector('#suspect-drawer').hasAttribute('open')`), 5000);
        await sleep(300);
        const drawerMetrics = JSON.parse(await evaluate(PAGE_METRICS));
        const drawerOverflow = drawerMetrics.scrollWidth > drawerMetrics.innerWidth;
        report(drawerOverflow && width === 360 ? 'FAIL' : drawerOverflow ? 'WARN' : 'PASS', `[${tag}] drawer open: scrollWidth ${drawerMetrics.scrollWidth} vs innerWidth ${drawerMetrics.innerWidth}`);
        const drawerStray = drawerMetrics.weights.filter((weight) => weight !== '400' && weight !== '500');
        report(drawerStray.length === 0 ? 'PASS' : 'FAIL', `[${tag}] drawer font weights: ${drawerMetrics.weights.join(', ')}`);
        await screenshot(`culprit-${tag}-drawer.png`, false);
        await press('Escape', 'Escape', 27);
        await sleep(300);
        const closed = await evaluate(`!document.querySelector('#suspect-drawer').hasAttribute('open')`);
        report(closed ? 'PASS' : 'FAIL', `[${tag}] Escape closes the drawer`);
      } catch (error) {
        report('FAIL', `[${tag}] drawer: ${error.message}`);
      }
    }
  }

  report(consoleErrors.length === 0 ? 'PASS' : 'FAIL', `console errors: ${consoleErrors.length === 0 ? 'none' : consoleErrors.join(' || ')}`);
  report(offOrigin.length === 0 ? 'PASS' : 'FAIL', `off-origin requests: ${offOrigin.length === 0 ? 'none' : offOrigin.join(' || ')}`);
}

try {
  await main();
} catch (error) {
  report('FAIL', `render check aborted: ${error.message}`);
} finally {
  if (cdp !== undefined) {
    await Promise.race([cdp.send('Browser.close').catch(() => undefined), sleep(2000)]);
    cdp.close();
    await sleep(500);
  }
  killTree(browser);
  killTree(preview);
}

const failures = results.filter((level) => level === 'FAIL').length;
console.log(failures === 0 && results.length > 0 ? 'RESULT PASS' : `RESULT FAIL (${failures})`);
process.exit(failures === 0 && results.length > 0 ? 0 : 1);
