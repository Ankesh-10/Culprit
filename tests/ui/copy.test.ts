import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AnalysisStream } from '../../src/core/model';
import { toAnalysisResult } from '../../src/core/pipeline';
import { serializeMarkdown } from '../../src/core/serialization';
import { COPY_FALLBACK_MESSAGE, buildPostmortemMarkdown, copyText, markdownLineCount } from '../../src/ui/copy';
import { findCase, toAnalysisInput } from '../../src/ui/cases';
import { reduceCopyFeedback } from '../../src/ui/state';
import type { CopyFeedback } from '../../src/ui/state';
import { handleAnalyzeRequest } from '../../src/worker/protocol';

function analyzeBundled(id: string): AnalysisStream {
  const found = findCase(id);
  if (found === undefined) throw new Error(`missing case ${id}`);
  const response = handleAnalyzeRequest({ type: 'analyze', requestId: 1, input: toAnalysisInput(found) });
  if (response.type !== 'result') throw new Error('expected a result');
  return response.stream;
}

const CASES: Array<{ id: string; lines: number }> = [
  { id: 'checkout-outage', lines: 71 },
  { id: 'slow-burn', lines: 80 },
  { id: 'ambiguous', lines: 80 },
];

describe('buildPostmortemMarkdown (UI-SPEC Verification Hook 6)', () => {
  for (const { id, lines } of CASES) {
    describe(id, () => {
      const stream = analyzeBundled(id);

      it('equals serializeMarkdown(toAnalysisResult(stream)) computed independently', () => {
        expect(buildPostmortemMarkdown(stream)).toBe(serializeMarkdown(toAnalysisResult(stream)));
      });

      it('is byte-identical for a worker-cloned stream', () => {
        const cloned = structuredClone(analyzeBundled(id));
        expect(buildPostmortemMarkdown(cloned)).toBe(buildPostmortemMarkdown(stream));
      });

      it('is byte-identical across repeated copies and separate analyses', () => {
        const first = buildPostmortemMarkdown(stream);
        expect(buildPostmortemMarkdown(stream)).toBe(first);
        expect(buildPostmortemMarkdown(analyzeBundled(id))).toBe(first);
      });

      it(`counts ${lines} newline-terminated lines`, () => {
        expect(markdownLineCount(buildPostmortemMarkdown(stream))).toBe(lines);
      });
    });
  }

  it('carries the verdict, confidence, caveats and UTC disclosure', () => {
    const markdown = buildPostmortemMarkdown(analyzeBundled('checkout-outage'));
    expect(markdown).toContain('## Verdict');
    expect(markdown).toContain('- Confidence:');
    expect(markdown).toContain('## Confidence and caveats');
    expect(markdown).toContain('## UTC disclosure');
    expect(markdown.endsWith('\n')).toBe(true);
  });
});

describe('markdownLineCount', () => {
  it('counts newline-terminated lines', () => {
    expect(markdownLineCount('')).toBe(0);
    expect(markdownLineCount('a\n')).toBe(1);
    expect(markdownLineCount('a\n\nb\n')).toBe(3);
  });
});

describe('copyText', () => {
  it('resolves copied and hands the clipboard exactly the text', async () => {
    const received: string[] = [];
    const clipboard = {
      writeText: (text: string): Promise<void> => {
        received.push(text);
        return Promise.resolve();
      },
    };
    await expect(copyText('# Culprit analysis\n', { clipboard, protocol: 'http:' })).resolves.toBe('copied');
    expect(received).toEqual(['# Culprit analysis\n']);
  });

  it('resolves fallback when the clipboard rejects', async () => {
    const clipboard = { writeText: (): Promise<void> => Promise.reject(new Error('denied')) };
    await expect(copyText('text', { clipboard, protocol: 'https:' })).resolves.toBe('fallback');
  });

  it('resolves fallback when the clipboard throws synchronously', async () => {
    const clipboard = {
      writeText: (): Promise<void> => {
        throw new Error('boom');
      },
    };
    await expect(copyText('text', { clipboard, protocol: 'https:' })).resolves.toBe('fallback');
  });

  it('resolves fallback when the clipboard is unavailable', async () => {
    await expect(copyText('text', { clipboard: undefined, protocol: 'http:' })).resolves.toBe('fallback');
  });

  it('resolves fallback for file: without calling writeText', async () => {
    let calls = 0;
    const clipboard = {
      writeText: (): Promise<void> => {
        calls += 1;
        return Promise.resolve();
      },
    };
    await expect(copyText('text', { clipboard, protocol: 'file:' })).resolves.toBe('fallback');
    expect(calls).toBe(0);
  });
});

describe('reduceCopyFeedback', () => {
  const idle: CopyFeedback = { kind: 'idle' };

  it('succeeds with the line count message', () => {
    expect(reduceCopyFeedback(idle, { type: 'succeeded', lines: 70 })).toEqual({
      kind: 'copied',
      message: 'Markdown postmortem copied (70 lines).',
    });
  });

  it('falls back with the documented message and the markdown', () => {
    expect(reduceCopyFeedback(idle, { type: 'fell-back', markdown: '# x\n' })).toEqual({
      kind: 'fallback',
      markdown: '# x\n',
      message: "Couldn't copy automatically. The Markdown is selected below. Press Ctrl+C (Cmd+C on Mac).",
    });
    expect(COPY_FALLBACK_MESSAGE).toBe("Couldn't copy automatically. The Markdown is selected below. Press Ctrl+C (Cmd+C on Mac).");
  });

  it('moves from copied to fallback and back to copied on a later copy', () => {
    const copied = reduceCopyFeedback(idle, { type: 'succeeded', lines: 70 });
    const fallback = reduceCopyFeedback(copied, { type: 'fell-back', markdown: 'm' });
    expect(fallback.kind).toBe('fallback');
    expect(reduceCopyFeedback(fallback, { type: 'succeeded', lines: 79 })).toEqual({
      kind: 'copied',
      message: 'Markdown postmortem copied (79 lines).',
    });
  });

  it('resets to idle from any state and hides the fallback', () => {
    const copied = reduceCopyFeedback(idle, { type: 'succeeded', lines: 70 });
    const fallback = reduceCopyFeedback(idle, { type: 'fell-back', markdown: 'm' });
    for (const state of [idle, copied, fallback]) expect(reduceCopyFeedback(state, { type: 'reset' })).toEqual(idle);
    expect(reduceCopyFeedback(fallback, { type: 'hide' })).toEqual(idle);
  });

  it('returns the same object when an event changes nothing', () => {
    expect(reduceCopyFeedback(idle, { type: 'reset' })).toBe(idle);
    expect(reduceCopyFeedback(idle, { type: 'hide' })).toBe(idle);
    const copied = reduceCopyFeedback(idle, { type: 'succeeded', lines: 70 });
    expect(reduceCopyFeedback(copied, { type: 'hide' })).toBe(copied);
  });
});

describe('copy.ts source guarantees', () => {
  const source = readFileSync(new URL('../../src/ui/copy.ts', import.meta.url), 'utf8');

  it('builds the Markdown on demand from the stream', () => {
    expect(source).toContain('serializeMarkdown(toAnalysisResult(');
  });

  it('never uses the legacy copy command or a timer', () => {
    expect(source).not.toMatch(/execCommand/);
    expect(source).not.toMatch(/setTimeout|setInterval/);
  });
});
