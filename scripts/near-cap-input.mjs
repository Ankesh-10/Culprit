// Deterministic near-cap incident generator for Phase 5 hardening checks.
//
// Every timestamp comes from integer arithmetic on a fixed start value and is
// rendered with the built-in ISO formatter. This file reads no wall clock, uses
// no random source, and makes no network request, so two calls always return
// identical strings.
//
// CLI: node scripts/near-cap-input.mjs --write <dir>
//   writes near-cap.jsonl and near-cap-history.json into <dir>.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const NEAR_CAP = Object.freeze({
  startUtcMs: Date.UTC(2026, 8, 15, 0, 0, 0),
  bucketMs: 300000,
  baselineBuckets: 9700,
  spikeBuckets: 29,
  errorsPerSpikeBucket: 10,
  commitCount: 3000,
  commitSpacingMs: 30 * 60000,
  minLogBytes: 1000000,
  maxLogBytes: 1048576,
  maxHistoryBytes: 1048576,
  // Target total log size, between minLogBytes and maxLogBytes.
  targetLogBytes: 1010000,
});

const AUTHORS = Object.freeze([
  'Mina Patel', 'Jordan Lee', 'Ravi Shah', 'Aiko Tanaka', 'Sam Okafor', 'Lena Fischer',
  'Diego Alvarez', 'Priya Nair', 'Chen Wei', 'Olu Adeyemi', 'Hana Kim', 'Tomas Novak',
  'Fatima Zahra', 'Noah Becker', 'Isla Murray', 'Kofi Mensah', 'Zoe Laurent',
]);

const ISO_PREFIX_BYTES_FILLER = '.';

function iso(ms) {
  return new Date(ms).toISOString();
}

function errorLine(spikeIndex, orderIndex) {
  const ms = NEAR_CAP.startUtcMs + (NEAR_CAP.baselineBuckets + spikeIndex) * NEAR_CAP.bucketMs + orderIndex * 20000;
  const order = 100000 + spikeIndex * NEAR_CAP.errorsPerSpikeBucket + orderIndex;
  const stack = [
    `PaymentTimeout: provider did not respond for order ${order}`,
    '    at processPayment (src/checkout/payment.ts:118:9)',
    '    at vendorRetry (node_modules/vendor-lib/retry.js:10:3)',
  ].join('\n');
  return JSON.stringify({
    timestamp: iso(ms),
    level: 'error',
    message: `checkout request failed for order ${order}`,
    exception: 'PaymentTimeout',
    stack,
  });
}

function infoLine(bucketIndex, filler) {
  const ms = NEAR_CAP.startUtcMs + bucketIndex * NEAR_CAP.bucketMs;
  return JSON.stringify({
    timestamp: iso(ms),
    level: 'info',
    message: `heartbeat ${filler}`,
  });
}

function byteLength(text) {
  return Buffer.byteLength(text, 'utf8');
}

function buildLog() {
  const errorLines = [];
  for (let spike = 0; spike < NEAR_CAP.spikeBuckets; spike += 1) {
    for (let order = 0; order < NEAR_CAP.errorsPerSpikeBucket; order += 1) {
      errorLines.push(errorLine(spike, order));
    }
  }
  const errorBytes = errorLines.reduce((sum, line) => sum + byteLength(line) + 1, 0);
  // All info lines share one fixed width: measure the empty-filler line, then
  // size the filler so the whole log lands on the target byte count.
  const baseInfoBytes = byteLength(infoLine(0, '')) + 1;
  const infoBudget = NEAR_CAP.targetLogBytes - errorBytes;
  const fillerWidth = Math.max(0, Math.floor(infoBudget / NEAR_CAP.baselineBuckets) - baseInfoBytes);
  const filler = ISO_PREFIX_BYTES_FILLER.repeat(fillerWidth);
  const lines = [];
  for (let bucket = 0; bucket < NEAR_CAP.baselineBuckets; bucket += 1) {
    lines.push(infoLine(bucket, filler));
  }
  for (const line of errorLines) lines.push(line);
  return `${lines.join('\n')}\n`;
}

function commitSha(index) {
  return (index + 1).toString(16).padStart(40, '0');
}

function buildHistory() {
  const firstSpikeMs = NEAR_CAP.startUtcMs + NEAR_CAP.baselineBuckets * NEAR_CAP.bucketMs;
  const lastCommitMs = firstSpikeMs - 10 * 60000;
  const last = NEAR_CAP.commitCount - 1;
  const commits = [];
  for (let index = 0; index < NEAR_CAP.commitCount; index += 1) {
    const timestamp = iso(lastCommitMs - (last - index) * NEAR_CAP.commitSpacingMs);
    let subject = `chore: update module ${index}`;
    let files = [
      {
        path: `src/feature-${index % 50}/module-${index}.ts`,
        added: 3 + (index % 11),
        deleted: index % 5,
        ranges: [{ start: 10 + (index % 7), end: 13 + (index % 7) + (index % 13) }],
      },
    ];
    if (index === last) {
      subject = 'refactor: add payment provider retry path';
      files = [{ path: 'src/checkout/payment.ts', added: 46, deleted: 9, ranges: [{ start: 104, end: 126 }] }];
    } else if (index === last - 2) {
      subject = 'fix: adjust checkout handler fallback';
      files = [{ path: 'src/checkout/handler.ts', added: 8, deleted: 2, ranges: [{ start: 36, end: 49 }] }];
    }
    commits.push({
      sha: commitSha(index),
      author: AUTHORS[index % AUTHORS.length],
      timestamp,
      subject,
      files,
    });
  }
  return `${JSON.stringify({ schemaVersion: 1, format: 'culprit-json', repository: 'checkout-service', commits })}\n`;
}

export function buildNearCapInput() {
  const logText = buildLog();
  const historyText = buildHistory();
  return {
    logText,
    historyText,
    expected: {
      leadingSha: commitSha(NEAR_CAP.commitCount - 1),
      eventCount: NEAR_CAP.baselineBuckets + NEAR_CAP.spikeBuckets * NEAR_CAP.errorsPerSpikeBucket,
      bucketCount: NEAR_CAP.baselineBuckets + NEAR_CAP.spikeBuckets,
      commitCount: NEAR_CAP.commitCount,
      logBytes: byteLength(logText),
      historyBytes: byteLength(historyText),
    },
  };
}

function main(argv) {
  const flag = argv.indexOf('--write');
  const dir = flag === -1 ? undefined : argv[flag + 1];
  if (dir === undefined || dir.startsWith('--')) {
    console.error('usage: node scripts/near-cap-input.mjs --write <dir>');
    return 2;
  }
  const target = resolve(dir);
  mkdirSync(target, { recursive: true });
  const { logText, historyText, expected } = buildNearCapInput();
  writeFileSync(join(target, 'near-cap.jsonl'), logText, 'utf8');
  writeFileSync(join(target, 'near-cap-history.json'), historyText, 'utf8');
  console.log(`near-cap.jsonl ${expected.logBytes} bytes`);
  console.log(`near-cap-history.json ${expected.historyBytes} bytes`);
  return 0;
}

if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = main(process.argv.slice(2));
}
