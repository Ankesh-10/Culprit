import { describe, expect, it } from 'vitest';
import { parseJsonLinesLog, parseLog, parsePlainTextLog } from '../../src/core/log-parser';

const checkoutLogs = `{"timestamp":"2026-10-19T09:50:30+05:30","level":"error","message":"checkout request failed for order 1001","exception":"PaymentTimeout","stack":"PaymentTimeout: provider did not respond for order 1001\\n    at processPayment (src/checkout/payment.ts:118:9)\\n    at vendorRetry (node_modules/vendor-lib/retry.js:10:3)"}\n`;

describe('log parsers', () => {
  it('parses JSONL records, normalizes UTC, and marks vendor frames', () => {
    const outcome = parseJsonLinesLog(checkoutLogs);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const event = outcome.value.events[0];
    expect(event?.timestampUtc).toBe('2026-10-19T04:20:30.000Z');
    expect(event?.source.line).toBe(1);
    expect(event?.stackFrames).toHaveLength(2);
    expect(event?.stackFrames[0]?.filePath).toBe('src/checkout/payment.ts');
    expect(event?.stackFrames[1]?.vendor).toBe(true);
  });

  it('returns line-aware recoverable diagnostics for malformed records', () => {
    const outcome = parseJsonLinesLog('{"timestamp":"2026-10-19T00:00:00Z","message":"ok"}\nnot json\n');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.diagnostics.some((entry) => entry.code === 'MALFORMED_RECORD' && entry.line === 2)).toBe(true);
  });

  it('parses plain text and attaches EOF stacks without a trailing newline', () => {
    const outcome = parsePlainTextLog('2026-10-19T09:50:00+05:30 error payment failed\n    at pay (src/pay.ts:4:2)\nCaused by: provider timeout');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.events[0]?.stack).toContain('Caused by: provider timeout');
    expect(outcome.value.events[0]?.stackFrames[0]?.line).toBe(4);
  });

  it('diagnoses orphan and ambiguous continuations', () => {
    const outcome = parsePlainTextLog('    at orphan (src/orphan.ts:1:1)\n2026-10-19T09:50:00Z error ok\nnot a stack');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.diagnostics.filter((entry) => entry.code === 'STACK_ATTACHMENT')).toHaveLength(2);
  });

  it('rejects empty, invalid, oversized, and unsupported input with typed errors', () => {
    const empty = parseJsonLinesLog('  \n');
    const invalid = parseJsonLinesLog('{"timestamp":"2026-10-19T09:50:00","message":"bad"}');
    const oversized = parseJsonLinesLog('x', { maxLogBytes: 0 });
    const unsupported = parseLog('x', 'other' as never);
    expect(!empty.ok && empty.error.code).toBe('EMPTY_INPUT');
    expect(!invalid.ok && invalid.diagnostics.some((entry) => entry.code === 'INVALID_TIMESTAMP' && entry.line === 1)).toBe(true);
    expect(!oversized.ok && oversized.error.code).toBe('INPUT_LIMIT');
    expect(!unsupported.ok && unsupported.error.code).toBe('UNSUPPORTED_FORMAT');
  });

  it('uses content-based IDs and timestamp/event sorting independent of input order', () => {
    const first = parseJsonLinesLog('{"timestamp":"2026-10-19T00:01:00Z","message":"later"}\n{"timestamp":"2026-10-19T00:00:00Z","message":"first"}');
    const second = parseJsonLinesLog('{"timestamp":"2026-10-19T00:00:00Z","message":"first"}\n{"timestamp":"2026-10-19T00:01:00Z","message":"later"}');
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.events.map((event) => event.eventId)).toEqual(second.value.events.map((event) => event.eventId));
      expect(first.value.events.map((event) => event.message)).toEqual(['first', 'later']);
    }
  });
});
