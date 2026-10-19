import { describe, expect, it } from 'vitest';
import type { LogEvent } from '../../src/core/model';
import { groupErrorEvents, normalizeErrorMessage, signatureForEvent } from '../../src/core/signatures';

function event(overrides: Partial<LogEvent> = {}): LogEvent {
  return {
    eventId: 'event-001',
    timestampUtc: '2026-10-19T04:30:00.000Z',
    level: 'error',
    message: 'checkout request failed for order 1001',
    rawMessage: 'checkout request failed for order 1001',
    exception: 'PaymentTimeout',
    stack: null,
    stackFrames: [
      { filePath: 'src/checkout/payment.ts', line: 118, column: 9, functionName: 'processPayment', vendor: false },
      { filePath: 'node_modules/vendor-lib/retry.js', line: 10, column: 3, functionName: 'vendorRetry', vendor: true },
    ],
    source: { source: 'test', line: 1, record: 1 },
    rawLine: '',
    ...overrides,
  };
}

describe('deterministic error signatures', () => {
  it('scrubs variable values while preserving operation words', () => {
    expect(normalizeErrorMessage('checkout order 1001 requestId=req-123456 UUID 550e8400-e29b-41d4-a716-446655440000 for "alice@example.test"'))
      .toBe('checkout order <number> requestId=<id> UUID <uuid> for <value>');
  });

  it('keeps exception and application-frame identity in the signature', () => {
    const current = event();
    expect(signatureForEvent(current)).toContain('PaymentTimeout');
    expect(signatureForEvent(current)).toContain('src/checkout/payment.ts#processPayment');
    expect(signatureForEvent(event({ exception: 'AuthorizationDenied' }))).not.toBe(signatureForEvent(current));
  });

  it('groups checkout events by normalized signature with stable evidence', () => {
    const input = [
      event({ eventId: 'event-005', timestampUtc: '2026-10-19T04:32:00.000Z', message: 'checkout request failed for order 1005', rawMessage: 'checkout request failed for order 1005' }),
      event({ eventId: 'event-001', timestampUtc: '2026-10-19T04:30:00.000Z' }),
      event({ eventId: 'event-003', timestampUtc: '2026-10-19T04:31:00.000Z', message: 'checkout request failed for order 1003', rawMessage: 'checkout request failed for order 1003' }),
      event({ eventId: 'event-002', timestampUtc: '2026-10-19T04:30:30.000Z', message: 'checkout request failed for order 1002', rawMessage: 'checkout request failed for order 1002' }),
      event({ eventId: 'event-004', timestampUtc: '2026-10-19T04:31:30.000Z', message: 'checkout request failed for order 1004', rawMessage: 'checkout request failed for order 1004' }),
    ];
    const groups = groupErrorEvents(input);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.count).toBe(5);
    expect(groups[0]?.firstSeenUtc).toBe('2026-10-19T04:30:00.000Z');
    expect(groups[0]?.lastSeenUtc).toBe('2026-10-19T04:32:00.000Z');
    expect(groups[0]?.eventIds).toEqual(['event-001', 'event-002', 'event-003', 'event-004', 'event-005']);
    expect(groups[0]?.stackFrames.map((frame) => frame.filePath)).toEqual(['src/checkout/payment.ts', 'node_modules/vendor-lib/retry.js']);
    expect(groups).toEqual(groupErrorEvents([...input].reverse()));
  });

  it('keeps vendor-only groups visible with an explicit warning', () => {
    const groups = groupErrorEvents([event({
      stackFrames: [{ filePath: 'node_modules/vendor-lib/retry.js', line: 10, column: 3, functionName: 'vendorRetry', vendor: true }],
    })]);
    expect(groups[0]?.stackFrames[0]?.vendor).toBe(true);
    expect(groups[0]?.warnings).toEqual(['No meaningful application-owned stack frame was parsed for this error group.']);
  });
});
