import { describe, expect, it } from 'vitest';
import type { ChangedLineRange, ErrorGroup, GitCommit, LogEvent, StackFrame } from '../../src/core/model';
import {
  buildEvidenceIndex,
  classifyFrame,
  classifyLine,
  classifyPath,
  countAtOrAfter,
  matchPath,
  topApplicationFrame,
} from '../../src/core/evidence';
import { parseLog } from '../../src/core/log-parser';
import { groupErrorEvents } from '../../src/core/signatures';
import { scoreCommit } from '../../src/core/scoring';

function frame(filePath: string | null, line: number | null = 10, vendor = false): StackFrame {
  return { filePath, line, column: 1, functionName: null, vendor };
}

function event(id: string, timestampUtc: string, frames: StackFrame[], level: LogEvent['level'] = 'error'): LogEvent {
  return {
    eventId: id,
    timestampUtc,
    level,
    message: 'failure',
    rawMessage: 'failure',
    exception: 'Failure',
    stack: null,
    stackFrames: frames,
    source: { source: 'test', line: null, record: null },
    rawLine: '',
  };
}

function group(signature: string, events: LogEvent[]): ErrorGroup {
  const first = events[0];
  const last = events.at(-1);
  if (first === undefined || last === undefined) throw new Error('group needs events');
  return {
    signature,
    representativeMessage: 'failure',
    count: events.length,
    firstSeenUtc: first.timestampUtc,
    lastSeenUtc: last.timestampUtc,
    eventIds: events.map((entry) => entry.eventId),
    stackFrames: [],
  };
}

describe('frame ownership', () => {
  it('classifies unattributed, runtime, vendor, build-output and application frames', () => {
    expect(classifyFrame(frame(null))).toBe('unattributed');
    for (const path of ['node:internal/process/task_queues', 'internal/timers.js', '<anonymous>', 'native', 'webpack:///./src/a.ts']) {
      expect(classifyFrame(frame(path))).toBe('runtime');
    }
    expect(classifyFrame(frame('src/search/client.ts', 4, true))).toBe('vendor');
    for (const path of ['node_modules/x/index.js', 'src/vendor/x.ts', 'third_party/a/b.ts', 'py/site-packages/a.py', 'bower_components/a/b.js']) {
      expect(classifyFrame(frame(path))).toBe('vendor');
    }
    for (const path of ['dist/app.js', 'build/app.js', 'out/app.js', 'coverage/a.js', '.next/server/a.js', 'src/generated/api.ts', 'src/__generated__/api.ts', 'public/app.min.js', 'public/app.bundle.js', 'public/app.js.map', 'types/api.d.ts']) {
      expect(classifyFrame(frame(path))).toBe('build-output');
    }
    expect(classifyFrame(frame('src/checkout/payment.ts'))).toBe('application');
  });

  it('applies the same taxonomy to changed-file paths', () => {
    expect(classifyPath('dist/bundle.min.js')).toBe('build-output');
    expect(classifyPath('src/a.ts')).toBe('application');
    expect(classifyPath('package.json')).toBe('application');
    expect(classifyPath('src/builder/a.ts')).toBe('application');
  });

  it('skips a leading vendor frame and a leading runtime frame to find the top application frame', () => {
    const vendorFirst = event('e1', '2026-10-19T10:00:00.000Z', [
      frame('node_modules/search-client/index.js', 9, true),
      frame('src/search/service.ts', 63),
    ]);
    const runtimeFirst = event('e2', '2026-10-19T10:00:00.000Z', [
      frame('node:internal/process/task_queues', 95),
      frame('src/search/service.ts', 63),
    ]);
    expect(topApplicationFrame(vendorFirst)?.filePath).toBe('src/search/service.ts');
    expect(topApplicationFrame(vendorFirst)?.line).toBe(63);
    expect(topApplicationFrame(runtimeFirst)?.filePath).toBe('src/search/service.ts');
    expect(topApplicationFrame(event('e3', '2026-10-19T10:00:00.000Z', [frame(null), frame('dist/a.js')]))).toBeNull();
  });
});

describe('path matching refuses invented evidence', () => {
  it('prefers exact equality', () => {
    expect(matchPath('src/checkout/payment.ts', ['src/checkout/handler.ts', 'src/checkout/payment.ts']))
      .toEqual({ kind: 'exact', path: 'src/checkout/payment.ts' });
  });

  it('strips a repository prefix on a segment boundary in either direction', () => {
    expect(matchPath('services/checkout/src/checkout/payment.ts', ['src/checkout/payment.ts']))
      .toEqual({ kind: 'prefix-stripped', path: 'src/checkout/payment.ts' });
    expect(matchPath('src/checkout/payment.ts', ['checkout-service/src/checkout/payment.ts']))
      .toEqual({ kind: 'prefix-stripped', path: 'checkout-service/src/checkout/payment.ts' });
  });

  it('never matches a single-segment path by suffix', () => {
    expect(matchPath('index.ts', ['src/a/index.ts'])).toEqual({ kind: 'none' });
    expect(matchPath('src/a/index.ts', ['index.ts'])).toEqual({ kind: 'none' });
  });

  it('reports ambiguity with sorted candidates and requires a slash boundary', () => {
    expect(matchPath('src/checkout/payment.ts', ['y/src/checkout/payment.ts', 'x/src/checkout/payment.ts']))
      .toEqual({ kind: 'ambiguous', paths: ['x/src/checkout/payment.ts', 'y/src/checkout/payment.ts'] });
    expect(matchPath('xsrc/checkout/payment.ts', ['src/checkout/payment.ts'])).toEqual({ kind: 'none' });
    expect(matchPath('src/checkout/payment.ts', ['xsrc/checkout/payment.ts'])).toEqual({ kind: 'none' });
  });

  it('gives no credit to same-directory siblings or case variants', () => {
    expect(matchPath('src/checkout/payment.ts', ['src/checkout/handler.ts'])).toEqual({ kind: 'none' });
    expect(matchPath('src/checkout/Payment.ts', ['src/checkout/payment.ts'])).toEqual({ kind: 'none' });
    expect(matchPath('src/checkout/payment.ts', [])).toEqual({ kind: 'none' });
  });

  it('treats a prototype-looking path like any other string', () => {
    expect(matchPath('__proto__/a.ts', ['__proto__/a.ts'])).toEqual({ kind: 'exact', path: '__proto__/a.ts' });
    expect(matchPath('src/other.ts', ['__proto__/a.ts'])).toEqual({ kind: 'none' });
  });
});

describe('line classification uses inclusive ranges', () => {
  const ranges: ChangedLineRange[] = [{ start: 104, end: 126 }];

  it('marks start and end lines as exact', () => {
    expect(classifyLine(104, ranges, 5)).toEqual({ kind: 'exact-line', range: ranges[0] });
    expect(classifyLine(126, ranges, 5)).toEqual({ kind: 'exact-line', range: ranges[0] });
    expect(classifyLine(118, ranges, 5).kind).toBe('exact-line');
  });

  it('marks up to five lines outside a range as nearby and anything farther as file-only', () => {
    for (const line of [103, 127, 99, 131]) expect(classifyLine(line, ranges, 5).kind).toBe('nearby-line');
    for (const line of [98, 132]) expect(classifyLine(line, ranges, 5)).toEqual({ kind: 'file-only', range: null });
  });

  it('handles a missing line number and empty ranges', () => {
    expect(classifyLine(null, ranges, 5)).toEqual({ kind: 'file-only', range: null });
    expect(classifyLine(110, [], 5)).toEqual({ kind: 'file-only', range: null });
  });

  it('chooses the nearest range, breaking ties by lower start', () => {
    const near: ChangedLineRange[] = [{ start: 20, end: 25 }, { start: 10, end: 14 }];
    expect(classifyLine(18, near, 5)).toEqual({ kind: 'nearby-line', range: { start: 20, end: 25 } });
    expect(classifyLine(16, near, 5)).toEqual({ kind: 'nearby-line', range: { start: 10, end: 14 } });
    expect(classifyLine(17, near, 5).range).toEqual({ start: 10, end: 14 });
    expect(classifyLine(17, [...near].reverse(), 5).range).toEqual({ start: 10, end: 14 });
  });
});

describe('counting events at or after an epoch', () => {
  it('is an inclusive lower-bound search', () => {
    const epochs = [10, 20, 20, 30];
    expect(countAtOrAfter(epochs, 5)).toBe(4);
    expect(countAtOrAfter(epochs, 20)).toBe(3);
    expect(countAtOrAfter(epochs, 21)).toBe(1);
    expect(countAtOrAfter(epochs, 31)).toBe(0);
    expect(countAtOrAfter([], 1)).toBe(0);
  });
});

describe('evidence index', () => {
  it('counts vendor-only error events but adds no frame, and ignores info and warn events', () => {
    const vendorOnly = event('v1', '2026-10-19T10:00:00.000Z', [
      frame('node_modules/x/index.js', 1, true),
      frame('node:internal/timers', 2),
    ]);
    const app = event('a1', '2026-10-19T10:01:00.000Z', [frame('src/a.ts', 7)]);
    const info = event('i1', '2026-10-19T10:02:00.000Z', [frame('src/a.ts', 7)], 'info');
    const warn = event('w1', '2026-10-19T10:03:00.000Z', [frame('src/a.ts', 7)], 'warn');
    const index = buildEvidenceIndex([vendorOnly, app, info, warn], [group('vendor-sig', [vendorOnly]), group('app-sig', [app])]);
    expect(index.totalErrorEvents).toBe(2);
    expect(index.applicationFrameEvents).toBe(1);
    expect(index.frames.map((entry) => [entry.path, entry.line, entry.epochs.length])).toEqual([['src/a.ts', 7, 1]]);
  });

  it('keys frames safely for a prototype-looking path and emits them sorted', () => {
    const proto = event('p1', '2026-10-19T10:00:00.000Z', [frame('__proto__/a.ts', 3)]);
    const other = event('o1', '2026-10-19T10:00:00.000Z', [frame('src/b.ts', 2)]);
    const otherLater = event('o2', '2026-10-19T10:05:00.000Z', [frame('src/b.ts', 1)]);
    const index = buildEvidenceIndex([otherLater, proto, other], [group('g', [proto, other, otherLater])]);
    expect(index.frames.map((entry) => `${entry.path}:${entry.line}`)).toEqual(['__proto__/a.ts:3', 'src/b.ts:1', 'src/b.ts:2']);
  });

  it('refuses suffix matches that are ambiguous when scoring and says so in evidence', () => {
    const crash = event('c1', '2026-10-19T10:00:00.000Z', [frame('src/checkout/payment.ts', 118)]);
    const index = buildEvidenceIndex([crash], [group('g', [crash])]);
    const commit: GitCommit = {
      sha: 'a'.repeat(40),
      author: 'Dev',
      message: 'm',
      subject: 'm',
      timestampUtc: '2026-10-19T09:00:00.000Z',
      files: [
        { path: 'x/src/checkout/payment.ts', added: 1, deleted: 0, ranges: [{ start: 118, end: 118 }] },
        { path: 'y/src/checkout/payment.ts', added: 1, deleted: 0, ranges: [{ start: 118, end: 118 }] },
      ],
      source: { source: 'test', line: null, record: null },
    };
    const scored = scoreCommit(commit, index, '2026-10-19T10:00:00.000Z');
    expect(scored.traceValue).toBe(0);
    expect(scored.traceSummary.matchKind).toBe('none');
    const refusal = scored.evidenceReferences.find((reference) => reference.type === 'feature' && reference.detail.includes('no trace credit'));
    expect(refusal?.detail).toContain('src/checkout/payment.ts:118');
    expect(refusal?.detail).toContain('2 changed files');
  });
});

describe('frames from the real log parser', () => {
  function indexFor(text: string): { index: ReturnType<typeof buildEvidenceIndex>; events: LogEvent[] } {
    const outcome = parseLog(text, 'plain-text');
    if (!outcome.ok) throw outcome.error;
    const events = outcome.value.events;
    return { index: buildEvidenceIndex(events, groupErrorEvents(events)), events };
  }

  it('turns a Windows-relative stack path into an application frame matching the changed path exactly', () => {
    const { index, events } = indexFor('2026-10-19T09:50:00Z error payment failed\n    at run (.\\src\\checkout\\payment.ts:118:9)\n');
    const top = events[0] === undefined ? null : topApplicationFrame(events[0]);
    expect(top?.filePath).toBe('src/checkout/payment.ts');
    expect(classifyFrame(top ?? frame(null))).toBe('application');
    expect(index.applicationFrameEvents).toBe(1);
    expect(matchPath(top?.filePath ?? '', ['src/checkout/payment.ts'])).toEqual({ kind: 'exact', path: 'src/checkout/payment.ts' });
  });

  it('keeps absolute Windows and POSIX stack paths unattributed with no match', () => {
    for (const path of ['C:\\app\\src\\checkout\\payment.ts', '/app/src/checkout/payment.ts']) {
      const { index, events } = indexFor(`2026-10-19T09:50:00Z error payment failed\n    at run (${path}:118:9)\n`);
      const frames = events[0]?.stackFrames ?? [];
      expect(frames).toHaveLength(1);
      expect(classifyFrame(frames[0] ?? frame('x'))).toBe('unattributed');
      expect(index.totalErrorEvents).toBe(1);
      expect(index.applicationFrameEvents).toBe(0);
      expect(index.frames).toEqual([]);
    }
  });
});
