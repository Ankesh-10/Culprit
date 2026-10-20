// Headless render check for the motion and visual-life pass (quick task 261020-ftp).
//
// Run from the repository root after `npm run build`:
//   node .planning/quick/261020-ftp-add-motion-and-visual-life-to-the-culpri/261020-ftp-render-check.mjs [--out <dir>] [--chrome <path>]
//
// It serves dist/ with `vite preview` on 127.0.0.1:4173, drives a headless Chromium-based browser over the
// DevTools protocol on 127.0.0.1:9223, and runs the checkout case at 1280x720 and 360x740, once with
// prefers-reduced-motion emulated as `reduce` and once as `no-preference`. It prints one line per check.
// Node built-ins plus the global fetch and WebSocket only; nothing leaves localhost.

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

const outDir = resolve(argValue('--out') ?? join(tmpdir(), 'culprit-261020-ftp'));

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

// Page-side sampler. It records, for the whole page lifetime, whether a roll overlay ever appeared and the
// maximum number and the names of running animations on every frame, ignoring the two allowed loops
// (the loading spinner and the ambient drift). `reset()` clears the record between steps.
const SAMPLER_INSTALL = `(() => {
  const LOOPS = ['culprit-spin', 'motion-drift'];
  const state = { ghost: false, max: 0, names: new Set(), drift: false, any: 0 };
  window.__sampler = state;
  state.reset = () => { state.ghost = false; state.max = 0; state.names.clear(); state.any = 0; };
  new MutationObserver(() => {
    if (document.querySelector('.roll-ghost')) state.ghost = true;
  }).observe(document.documentElement, { subtree: true, childList: true });
  const nameOf = (animation) => animation.animationName || ('transition:' + animation.transitionProperty);
  const loop = () => {
    const live = document.getAnimations().filter((animation) => animation.playState !== 'finished' && animation.playState !== 'idle');
    let running = 0;
    for (const animation of live) {
      const name = nameOf(animation);
      if (name === 'motion-drift') state.drift = true;
      if (LOOPS.includes(name)) continue;
      running += 1;
      state.names.add(name);
    }
    state.any += live.length;
    if (running > state.max) state.max = running;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return true;
})()`;

const SAMPLER_READ = `JSON.stringify({ ghost: window.__sampler.ghost, max: window.__sampler.max, names: [...window.__sampler.names], drift: window.__sampler.drift })`;
const SAMPLER_RESET = `(() => { window.__sampler.reset(); return true; })()`;

// Count of currently running animations other than the two allowed loops.
const RUNNING_NOW = `document.getAnimations().filter((a) => a.playState !== 'finished' && a.playState !== 'idle' && !['culprit-spin', 'motion-drift'].includes(a.animationName)).length`;
const SETTLED_NOW = `(${RUNNING_NOW}) === 0 && !document.querySelector('.roll-ghost')`;

// Real text of the three verdict values: text nodes only, skipping aria-hidden subtrees.
const REAL_TEXT = `(() => {
  const real = (node) => {
    let out = '';
    for (const child of node.childNodes) {
      if (child.nodeType === 3) out += child.textContent;
      else if (child.nodeType === 1 && child.getAttribute('aria-hidden') !== 'true') out += real(child);
    }
    return out;
  };
  const pick = (selector, full) => {
    const node = document.querySelector(selector);
    if (!node) return null;
    return full ? node.textContent : real(node);
  };
  const read = (full) => ({
    hash: pick('.verdict .verdict-hash', full),
    score: pick('.verdict .score-value', full),
    matches: pick('.verdict [data-fact="matches"] dd', full),
  });
  return JSON.stringify({ real: read(false), full: read(true), rolling: document.querySelectorAll('.is-rolling').length });
})()`;

const FILL_PROBE = `(() => {
  const fill = document.querySelector('.verdict .score-fill');
  if (!fill) return JSON.stringify({ scale: null });
  const match = /matrix\\(([^,]+),/.exec(getComputedStyle(fill).transform);
  return JSON.stringify({ scale: match ? Number(match[1]) : (getComputedStyle(fill).transform === 'none' ? 1 : null) });
})()`;

const DECOR_PROBE = `(() => {
  const stripes = document.querySelector('.header-stripes');
  const ambient = document.querySelector('.ambient');
  const spans = stripes ? [...stripes.children] : [];
  return JSON.stringify({
    stripesHidden: !!stripes && stripes.getAttribute('aria-hidden') === 'true',
    spanCount: spans.length,
    images: spans.map((span) => getComputedStyle(span).backgroundImage),
    opacities: spans.map((span) => Number(getComputedStyle(span).opacity)),
    ambientHidden: !!ambient && ambient.getAttribute('aria-hidden') === 'true',
    ambientOpacity: ambient ? Number(getComputedStyle(ambient).opacity) : null,
    ambientEvents: ambient ? getComputedStyle(ambient).pointerEvents : null,
  });
})()`;

const CARD_PROBE = `(() => {
  const card = document.querySelector('button[data-case-id="checkout-outage"]');
  card.scrollIntoView({ block: 'center' });
  const rect = card.getBoundingClientRect();
  return JSON.stringify({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
})()`;

const SPARK_PROBE = `(() => {
  const line = document.querySelector('.case-card .sparkline-line');
  const card = document.querySelector('button[data-case-id="checkout-outage"]');
  return JSON.stringify({
    dasharray: line ? getComputedStyle(line).strokeDasharray : null,
    transform: line ? getComputedStyle(line).transform : null,
    border: card ? getComputedStyle(card).borderTopColor : null,
  });
})()`;

const TIMELINE_PROBE = `(() => {
  const section = document.querySelector('section.timeline');
  const line = document.querySelector('.timeline-svg .series-draw');
  return JSON.stringify({
    entered: !!section && section.classList.contains('motion-enter'),
    drawing: !!section && section.classList.contains('motion-draw'),
    pathLength: line ? line.getAttribute('pathLength') : null,
  });
})()`;

const EXPECTED_TEXT = { hash: '2222222', score: '0.91', matches: 'Matches 5 of 5 errors' };

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

  /** Types one character the way a keyboard does (keydown with text, then keyup). */
  const pressText = async (text, code, keyCode, modifiers = 0) => {
    const base = { key: text, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, modifiers };
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  };

  const PALETTE_STATE = `(() => {
    const dialog = document.querySelector('#command-palette');
    const active = document.activeElement;
    return JSON.stringify({
      open: dialog.open,
      focusId: active ? active.id : null,
      focusClass: active ? String(active.className) : null,
      focusTag: active ? active.tagName : null,
      options: [...document.querySelectorAll('#palette-list [role="option"]')].map((option) => option.textContent),
      count: (document.querySelector('.palette-count') || {}).textContent || null,
      activeDescendant: (document.querySelector('#palette-input') || { getAttribute: () => null }).getAttribute('aria-activedescendant'),
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    });
  })()`;

  /** The command palette: shortcuts, filtering, keyboard model, focus return and the editable-field exemption. */
  const runPaletteChecks = async (tag, fileTag, width, reduce) => {
    try {
      const loaded = cdp.once('Page.loadEventFired');
      await cdp.send('Page.navigate', { url: `${ORIGIN}/` });
      await loaded;
      await sleep(300);
      await evaluate(SAMPLER_INSTALL);
      await evaluate(`window.__closeFocus = []; document.querySelector('#command-palette').addEventListener('close', () => window.__closeFocus.push(document.activeElement ? document.activeElement.id : null)); true`);
      const state = async () => JSON.parse(await evaluate(PALETTE_STATE));

      // "/" with focus on the page body opens the palette with the search field focused.
      await evaluate('document.activeElement && document.activeElement.blur()');
      await evaluate(SAMPLER_RESET);
      await pressText('/', 'Slash', 191);
      await poll('the palette to open', async () => (await state()).open, 2000, 30);
      await sleep(250);
      let now = await state();
      report(now.open && now.focusId === 'palette-input' ? 'PASS' : 'FAIL', `[${tag}] "/" opens the palette with focus on the search field (focus ${now.focusId})`);
      report(now.options.length === 4 && now.count === '4 results' ? 'PASS' : 'FAIL', `[${tag}] palette lists ${now.options.length} options, count "${now.count}"`);
      if (width === 360) report(now.scrollWidth <= now.innerWidth ? 'PASS' : 'FAIL', `[${tag}] palette open: scrollWidth ${now.scrollWidth} vs innerWidth ${now.innerWidth}`);
      const opened = JSON.parse(await evaluate(SAMPLER_READ));
      if (reduce) report(opened.max === 0 ? 'PASS' : 'FAIL', `[${tag}] palette opens with no animation (max ${opened.max})`);
      else report(opened.names.includes('motion-palette-in') ? 'PASS' : 'FAIL', `[${tag}] palette opening animates (animations: ${opened.names.join(', ')})`);
      await screenshot(`palette-${fileTag}.png`, false);

      // Typing filters the list and updates the polite count.
      await cdp.send('Input.insertText', { text: 'slow' });
      await sleep(100);
      now = await state();
      report(now.options.length === 1 && now.options[0].includes('Slow-burn inventory failure') && now.count === '1 result' ? 'PASS' : 'FAIL', `[${tag}] typing "slow" leaves ${JSON.stringify(now.options.map((text) => text.slice(0, 30)))}, count "${now.count}"`);

      // Escape closes and focus returns to the opener (the visible trigger, since the body had focus).
      await press('Escape', 'Escape', 27);
      await sleep(150);
      now = await state();
      report(!now.open && now.focusId === 'palette-trigger' ? 'PASS' : 'FAIL', `[${tag}] Escape closes the palette and focus lands on the trigger (open ${now.open}, focus ${now.focusId})`);

      // The visible trigger opens it; ArrowDown moves; Enter loads the case and focus returns to the opener.
      await evaluate(`document.querySelector('#palette-trigger').focus()`);
      await evaluate(`document.querySelector('#palette-trigger').click()`);
      await poll('the palette to open from the trigger', async () => (await state()).open, 2000, 30);
      await press('ArrowDown', 'ArrowDown', 40);
      await sleep(60);
      now = await state();
      report(now.activeDescendant === 'palette-option-slow-burn' ? 'PASS' : 'FAIL', `[${tag}] ArrowDown moves the active option (aria-activedescendant ${now.activeDescendant})`);
      await evaluate('window.__closeFocus.length = 0; true');
      await press('Enter', 'Enter', 13);
      await poll('the palette to close', async () => !(await state()).open, 2000, 30);
      await sleep(100);
      const closeFocus = JSON.parse(await evaluate('JSON.stringify(window.__closeFocus)'));
      report(closeFocus.length === 1 && closeFocus[0] === 'palette-trigger' ? 'PASS' : 'FAIL', `[${tag}] Enter closes the palette with focus returned to the trigger (focus at close: ${JSON.stringify(closeFocus)})`);
      try {
        await poll('the Slow-burn result', () => evaluate(`document.querySelector('#result-title').textContent === 'Result: Slow-burn inventory failure'`), 10000, 50);
        report('PASS', `[${tag}] Enter loaded the Slow-burn case`);
      } catch (error) {
        report('FAIL', `[${tag}] ${error.message}`);
      }
      await poll('the timeline', () => evaluate(`!!document.querySelector('.timeline-slider')`), 5000, 50);

      // Ctrl+K opens it even from the timeline slider; Escape returns focus to the slider.
      await evaluate(`document.querySelector('.timeline-slider').focus()`);
      await pressText('k', 'KeyK', 75, 2);
      await poll('the palette to open on Ctrl+K', async () => (await state()).open, 2000, 30);
      now = await state();
      report(now.focusId === 'palette-input' ? 'PASS' : 'FAIL', `[${tag}] Ctrl+K opens the palette from the slider (focus ${now.focusId})`);
      await press('Escape', 'Escape', 27);
      await sleep(150);
      now = await state();
      report(!now.open && now.focusClass.includes('timeline-slider') ? 'PASS' : 'FAIL', `[${tag}] Escape returns focus to the slider (focus class ${now.focusClass})`);

      // A slash typed into a text field is text, not a shortcut.
      await evaluate(`document.querySelector('button[data-case-id="own-files"]').click()`);
      await poll('the own-files form', () => evaluate(`!!document.querySelector('#own-files-host textarea') && !document.querySelector('#own-files-host').hidden`), 3000, 50);
      // The paste field sits in a collapsed disclosure, so open it before focusing the textarea.
      await evaluate(`(() => { const textarea = document.querySelector('#own-files-host textarea'); textarea.closest('details').open = true; textarea.focus(); return true; })()`);
      await pressText('/', 'Slash', 191);
      await sleep(150);
      now = await state();
      report(!now.open && now.focusTag === 'TEXTAREA' ? 'PASS' : 'FAIL', `[${tag}] "/" inside a text field does not open the palette (open ${now.open}, focus ${now.focusTag})`);

      // Choosing "Use your own files" lands in the form instead of restoring focus to the opener.
      await evaluate('document.activeElement && document.activeElement.blur()');
      await pressText('/', 'Slash', 191);
      await poll('the palette to open again', async () => (await state()).open, 2000, 30);
      await cdp.send('Input.insertText', { text: 'own' });
      await sleep(80);
      await press('Enter', 'Enter', 13);
      await sleep(300);
      now = await state();
      report(!now.open && now.focusTag === 'TEXTAREA' ? 'PASS' : 'FAIL', `[${tag}] choosing "Use your own files" focuses the form (open ${now.open}, focus ${now.focusTag})`);
    } catch (error) {
      report('FAIL', `[${tag}] palette: ${error.message}`);
    }
  };

  const viewports = [
    { width: 1280, height: 720, mobile: false },
    { width: 360, height: 740, mobile: true },
  ];

  for (const mode of ['reduce', 'no-preference']) {
    const reduce = mode === 'reduce';
    for (const { width, height, mobile } of viewports) {
      const tag = `${width}x${height} ${reduce ? 'reduce' : 'motion'}`;
      const fileTag = `${width}-${reduce ? 'reduce' : 'motion'}`;
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: mode }] });
      const loaded = cdp.once('Page.loadEventFired');
      await cdp.send('Page.navigate', { url: `${ORIGIN}/` });
      await loaded;
      await sleep(300);
      await evaluate(SAMPLER_INSTALL);

      const mediaOk = await evaluate(`matchMedia('(prefers-reduced-motion: ${reduce ? 'reduce' : 'no-preference'})').matches`);
      report(mediaOk ? 'PASS' : 'FAIL', `[${tag}] emulated prefers-reduced-motion is ${mode}`);

      if (width === 1280) {
        await press('Tab', 'Tab', 9);
        await sleep(100);
        const focus = JSON.parse(await evaluate(FOCUS_PROBE));
        const ok = focus.style === 'solid' && focus.width === '2px' && focus.color === 'rgb(87, 193, 255)';
        report(ok ? 'PASS' : 'FAIL', `[${tag}] first Tab focus ring on ${focus.tag} "${focus.text}": ${focus.style} ${focus.width} ${focus.color} offset ${focus.offset}`);
        await evaluate('document.activeElement.blur()');
      }

      const decor = JSON.parse(await evaluate(DECOR_PROBE));
      const stripesOk =
        decor.stripesHidden && decor.spanCount === 3 && decor.images.every((image) => image === 'none') && decor.opacities.every((value) => value <= 0.5);
      report(stripesOk ? 'PASS' : 'FAIL', `[${tag}] header stripes: aria-hidden ${decor.stripesHidden}, ${decor.spanCount} spans, background-image [${decor.images.join(', ')}], opacity [${decor.opacities.join(', ')}]`);
      const ambientOk = decor.ambientHidden && decor.ambientOpacity !== null && decor.ambientOpacity <= 0.04 && decor.ambientEvents === 'none';
      report(ambientOk ? 'PASS' : 'FAIL', `[${tag}] ambient layer: aria-hidden ${decor.ambientHidden}, opacity ${decor.ambientOpacity}, pointer-events ${decor.ambientEvents}`);

      // Card hover: the border brightens and the sparkline draws in (motion only) and ends fully drawn.
      try {
        await poll('a case sparkline', () => evaluate(`!!document.querySelector('.case-card .sparkline-line')`), 5000, 100);
        await sleep(300);
        const point = JSON.parse(await evaluate(CARD_PROBE));
        await evaluate(SAMPLER_RESET);
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
        await sleep(reduce ? 400 : 150);
        const hoverSample = JSON.parse(await evaluate(SAMPLER_READ));
        if (reduce) {
          report(hoverSample.max === 0 ? 'PASS' : 'FAIL', `[${tag}] card hover runs no animation (max ${hoverSample.max})`);
        } else {
          report(hoverSample.names.includes('motion-wipe') ? 'PASS' : 'FAIL', `[${tag}] card hover sweeps the sparkline in (animations: ${hoverSample.names.join(', ')})`);
          await poll('the hover draw to settle', () => evaluate(SETTLED_NOW), 3000, 50);
        }
        await sleep(200);
        const spark = JSON.parse(await evaluate(SPARK_PROBE));
        report(spark.dasharray === 'none' && spark.transform === 'none' ? 'PASS' : 'FAIL', `[${tag}] hovered sparkline settles fully drawn (dasharray ${spark.dasharray}, transform ${spark.transform})`);
        report(spark.border === 'rgb(205, 205, 205)' ? 'PASS' : 'FAIL', `[${tag}] hovered card border ${spark.border} (ink-2)`);
        await screenshot(`hover-${fileTag}.png`, false);
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 });
        await evaluate('window.scrollTo(0, 0)');
        await sleep(200);
      } catch (error) {
        report('FAIL', `[${tag}] card hover: ${error.message}`);
      }

      await evaluate(SAMPLER_RESET);
      await evaluate(`document.querySelector('button[data-case-id="checkout-outage"]').click()`);
      await poll(
        'the checkout result',
        () =>
          evaluate(`(() => {
            const title = document.querySelector('#result-title');
            return !!title && title.getClientRects().length > 0 && title.textContent.startsWith('Result:') && !!document.querySelector('.verdict');
          })()`),
        10000,
        30,
      );

      // First-detection checks: the real text is already exact, and reduced motion has nothing running.
      const first = JSON.parse(await evaluate(REAL_TEXT));
      const firstExact = first.real.hash === EXPECTED_TEXT.hash && first.real.score === EXPECTED_TEXT.score && first.real.matches === EXPECTED_TEXT.matches;
      report(firstExact ? 'PASS' : 'FAIL', `[${tag}] real text at first detection: ${JSON.stringify(first.real)}`);
      if (reduce) {
        const runningNow = await evaluate(RUNNING_NOW);
        report(runningNow === 0 ? 'PASS' : 'FAIL', `[${tag}] running animations at first detection: ${runningNow}`);
        await sleep(700);
        const sampled = JSON.parse(await evaluate(SAMPLER_READ));
        report(sampled.max === 0 && !sampled.ghost && sampled.names.length === 0 ? 'PASS' : 'FAIL', `[${tag}] sampler after 700ms: max ${sampled.max}, ghost ${sampled.ghost}, names [${sampled.names.join(', ')}]`);
        report(!sampled.drift ? 'PASS' : 'FAIL', `[${tag}] ambient drift not running`);
      } else {
        try {
          await poll('the entrance to settle', () => evaluate(SETTLED_NOW), 5000, 50);
          report('PASS', `[${tag}] entrance settled (no running animation, no overlay)`);
        } catch (error) {
          report('FAIL', `[${tag}] ${error.message}`);
        }
        const sampled = JSON.parse(await evaluate(SAMPLER_READ));
        report(sampled.max > 0 ? 'PASS' : 'FAIL', `[${tag}] sampler saw up to ${sampled.max} running animations`);
        const wanted = ['motion-rise', 'motion-fill'];
        const missing = wanted.filter((name) => !sampled.names.includes(name));
        report(missing.length === 0 ? 'PASS' : 'FAIL', `[${tag}] animations seen: ${sampled.names.join(', ')}${missing.length ? `; missing ${missing.join(', ')}` : ''}`);
        report(sampled.ghost ? 'PASS' : 'FAIL', `[${tag}] roll overlay appeared`);
        report(sampled.drift ? 'PASS' : 'FAIL', `[${tag}] ambient drift is running`);
      }

      await sleep(300);
      const settled = JSON.parse(await evaluate(REAL_TEXT));
      const settledExact =
        settled.full.hash === EXPECTED_TEXT.hash &&
        settled.full.score === EXPECTED_TEXT.score &&
        settled.full.matches === EXPECTED_TEXT.matches &&
        settled.rolling === 0;
      report(settledExact ? 'PASS' : 'FAIL', `[${tag}] settled full text: ${JSON.stringify(settled.full)}, .is-rolling count ${settled.rolling}`);

      const fill = JSON.parse(await evaluate(FILL_PROBE));
      const fillOk = fill.scale !== null && Math.abs(fill.scale - 0.912065) < 0.002;
      report(fillOk ? 'PASS' : 'FAIL', `[${tag}] score fill scaleX ${fill.scale} (expected 0.912065)`);

      // Timeline: scroll it into view, then the draw-in plays once; stepping never replays it.
      try {
        await evaluate(SAMPLER_RESET);
        await evaluate(`document.querySelector('#timeline-title').scrollIntoView({ block: 'center' })`);
        if (reduce) {
          await sleep(600);
          const sampled = JSON.parse(await evaluate(SAMPLER_READ));
          report(sampled.max === 0 ? 'PASS' : 'FAIL', `[${tag}] timeline scrolled into view runs no animation (max ${sampled.max})`);
        } else {
          await poll('the timeline entrance to start', async () => JSON.parse(await evaluate(TIMELINE_PROBE)).entered, 4000, 30);
          await poll('the timeline entrance to settle', () => evaluate(SETTLED_NOW), 8000, 50);
          const sampled = JSON.parse(await evaluate(SAMPLER_READ));
          const wanted = ['motion-draw-line', 'motion-wipe', 'motion-pop', 'motion-pulse'];
          const missing = wanted.filter((name) => !sampled.names.includes(name));
          report(missing.length === 0 ? 'PASS' : 'FAIL', `[${tag}] timeline animations: ${sampled.names.join(', ')}${missing.length ? `; missing ${missing.join(', ')}` : ''}`);
        }
        await sleep(200);
        const timeline = JSON.parse(await evaluate(TIMELINE_PROBE));
        report(!timeline.drawing ? 'PASS' : 'FAIL', `[${tag}] .timeline has released motion-draw after settling: ${!timeline.drawing}`);
        report(timeline.pathLength === '1' ? 'PASS' : 'FAIL', `[${tag}] .series-draw pathLength ${timeline.pathLength}`);
        await screenshot(`timeline-${fileTag}.png`, false);

        await evaluate(`document.querySelector('.timeline-slider').focus()`);
        await evaluate(SAMPLER_RESET);
        const readoutBefore = await evaluate(`document.querySelector('.readout-text').textContent`);
        await press('ArrowRight', 'ArrowRight', 39);
        await sleep(60);
        let readoutAfter = await evaluate(`document.querySelector('.readout-text').textContent`);
        if (readoutAfter === readoutBefore) {
          // The selection may already sit on the last interval: step the other way instead.
          await evaluate(SAMPLER_RESET);
          await press('ArrowLeft', 'ArrowLeft', 37);
          await sleep(60);
          readoutAfter = await evaluate(`document.querySelector('.readout-text').textContent`);
        }
        report(readoutAfter !== readoutBefore ? 'PASS' : 'FAIL', `[${tag}] a slider step changes the readout ("${readoutBefore.slice(0, 28)}" to "${readoutAfter.slice(0, 28)}")`);
        await sleep(240);
        const stepped = JSON.parse(await evaluate(SAMPLER_READ));
        const replayed = stepped.names.filter((name) => ['motion-draw-line', 'motion-wipe', 'motion-pop', 'motion-pulse'].includes(name));
        report(replayed.length === 0 ? 'PASS' : 'FAIL', `[${tag}] stepping the slider replays no draw-in (animations: [${stepped.names.join(', ')}])`);
        if (reduce) report(stepped.max === 0 ? 'PASS' : 'FAIL', `[${tag}] stepping runs no animation under reduced motion`);
        else report(stepped.names.some((name) => name.startsWith('motion-swap')) ? 'PASS' : 'FAIL', `[${tag}] the readout text fades on a step`);
      } catch (error) {
        report('FAIL', `[${tag}] timeline: ${error.message}`);
      }

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

      // Scroll-triggered entrances move boxes in motion runs, so the hit-area probe runs in reduce runs only.
      if (reduce) {
        const probe = JSON.parse(await evaluate(HIT_PROBE));
        report(
          probe.misses.length === 0 && probe.count > 0 ? 'PASS' : 'FAIL',
          `[${tag}] hit areas on ${probe.count} core-path buttons, smallest drawn height ${probe.smallest.toFixed(1)}px${probe.misses.length ? `; misses: ${probe.misses.join(' | ')}` : ''}`,
        );
      }

      await evaluate('window.scrollTo(0, 0)');
      await screenshot(`culprit-${fileTag}.png`, false);
      await screenshot(`culprit-${fileTag}-full.png`, true);

      const opened = await evaluate(`(() => {
        const button = [...document.querySelectorAll('.verdict button')].find((entry) => (entry.getAttribute('aria-label') || entry.textContent || '').includes('Inspect evidence'));
        if (!button) return false;
        button.scrollIntoView({ block: 'center' });
        window.__sampler.reset();
        button.click();
        return true;
      })()`);
      if (!opened) {
        report('FAIL', `[${tag}] verdict Inspect evidence button not found`);
      } else {
        try {
          await poll('the drawer', () => evaluate(`document.querySelector('#suspect-drawer').hasAttribute('open')`), 5000);
          await sleep(400);
          const drawerSample = JSON.parse(await evaluate(SAMPLER_READ));
          if (reduce) {
            report(drawerSample.max === 0 ? 'PASS' : 'FAIL', `[${tag}] drawer opens with no animation (max ${drawerSample.max})`);
          } else {
            const slid = drawerSample.names.some((name) => name === 'motion-drawer-in' || name === 'motion-drawer-up');
            report(slid ? 'PASS' : 'FAIL', `[${tag}] drawer animates in (animations: ${drawerSample.names.join(', ')})`);
          }
          const drawerMetrics = JSON.parse(await evaluate(PAGE_METRICS));
          const drawerOverflow = drawerMetrics.scrollWidth > drawerMetrics.innerWidth;
          report(drawerOverflow && width === 360 ? 'FAIL' : drawerOverflow ? 'WARN' : 'PASS', `[${tag}] drawer open: scrollWidth ${drawerMetrics.scrollWidth} vs innerWidth ${drawerMetrics.innerWidth}`);
          const drawerStray = drawerMetrics.weights.filter((weight) => weight !== '400' && weight !== '500');
          report(drawerStray.length === 0 ? 'PASS' : 'FAIL', `[${tag}] drawer font weights: ${drawerMetrics.weights.join(', ')}`);
          await screenshot(`culprit-${fileTag}-drawer.png`, false);
          await press('Escape', 'Escape', 27);
          await sleep(60);
          const closed = await evaluate(`!document.querySelector('#suspect-drawer').hasAttribute('open')`);
          report(closed ? 'PASS' : 'FAIL', `[${tag}] Escape closes the drawer immediately`);
          const returned = await evaluate(`(document.activeElement.textContent || '').includes('Inspect evidence')`);
          report(returned ? 'PASS' : 'FAIL', `[${tag}] focus returns to the Inspect evidence button`);
        } catch (error) {
          report('FAIL', `[${tag}] drawer: ${error.message}`);
        }
      }

      await runPaletteChecks(tag, fileTag, width, reduce);
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
