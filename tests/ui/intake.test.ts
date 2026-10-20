import { describe, expect, it } from 'vitest';
import { findCase } from '../../src/ui/cases';
import { readFileSync } from 'node:fs';
import {
  MAX_INPUT_FILE_BYTES,
  buildOwnAnalysisInput,
  canAnalyze,
  checkFileSize,
  detectLogFormat,
  detectedFormatLabel,
  emptyDraft,
  fileChipText,
  formatFileSize,
  resolveLogFormat,
  resultLabel,
  safeSourceName,
  sourcesFor,
} from '../../src/ui/intake';
import type { OwnInputDraft } from '../../src/ui/intake';
import { handleAnalyzeRequest } from '../../src/worker/protocol';

function checkout() {
  const found = findCase('checkout-outage');
  if (found === undefined) throw new Error('missing checkout case');
  return found;
}

function pastedDraft(): OwnInputDraft {
  const bundled = checkout();
  const draft = emptyDraft();
  return {
    ...draft,
    log: { ...draft.log, text: bundled.logsText },
    history: { ...draft.history, text: bundled.historyText },
  };
}

describe('detectLogFormat and resolveLogFormat', () => {
  it('treats a first non-empty line starting with { as JSON-lines', () => {
    expect(detectLogFormat('{"timestamp":"2026-10-19T07:00:00Z"}\n')).toBe('jsonl');
    expect(detectLogFormat('\n  \n   {"a":1}')).toBe('jsonl');
  });

  it('treats everything else, including empty text, as plain text', () => {
    expect(detectLogFormat('2026-10-19T07:00:00Z error x')).toBe('plain-text');
    expect(detectLogFormat('')).toBe('plain-text');
    expect(detectLogFormat('   \n\n')).toBe('plain-text');
  });

  it('lets an explicit choice win and auto follow detection', () => {
    expect(resolveLogFormat('jsonl', '2026-10-19T07:00:00Z error x')).toBe('jsonl');
    expect(resolveLogFormat('plain-text', '{"a":1}')).toBe('plain-text');
    expect(resolveLogFormat('auto', '{"a":1}')).toBe('jsonl');
    expect(resolveLogFormat('auto', 'plain')).toBe('plain-text');
  });
});

describe('canAnalyze', () => {
  it('needs a non-whitespace character in both fields', () => {
    const draft = emptyDraft();
    expect(canAnalyze(draft)).toBe(false);
    expect(canAnalyze({ ...draft, log: { ...draft.log, text: 'x' } })).toBe(false);
    expect(canAnalyze({ ...draft, history: { ...draft.history, text: 'x' } })).toBe(false);
    expect(canAnalyze({ log: { ...draft.log, text: '  \n ' }, history: { ...draft.history, text: 'x' }, formatChoice: 'auto' })).toBe(false);
    expect(canAnalyze({ log: { ...draft.log, text: 'x' }, history: { ...draft.history, text: 'y' }, formatChoice: 'auto' })).toBe(true);
  });
});

describe('safeSourceName', () => {
  it('keeps a safe relative name', () => {
    expect(safeSourceName('incident.jsonl', 'uploaded-log')).toBe('incident.jsonl');
  });

  it('falls back for empty, traversal, absolute and drive-letter names', () => {
    for (const unsafe of ['', '..', '/abs.log', 'C:/x.log', '../x.log']) {
      expect(safeSourceName(unsafe, 'uploaded-log')).toBe('uploaded-log');
    }
  });
});

describe('buildOwnAnalysisInput', () => {
  it('builds the pasted checkout input with pasted source names', () => {
    const input = buildOwnAnalysisInput(pastedDraft());
    expect(input.logs.format).toBe('jsonl');
    expect(input.history.format).toBe('culprit-json');
    expect(input.logs.source).toBe('pasted-log');
    expect(input.history.source).toBe('pasted-history');
    expect(input.options).toBeNull();
  });

  it('reaches the same verdict as the bundled case', () => {
    const response = handleAnalyzeRequest({ type: 'analyze', requestId: 1, input: buildOwnAnalysisInput(pastedDraft()) });
    if (response.type !== 'result') throw new Error(`expected a result, got ${response.type}`);
    expect(response.stream.ranking.suspects[0]?.shortSha).toBe('2222222');
  });

  it('uses chosen file names as sources and the explicit format choice', () => {
    const draft = pastedDraft();
    const input = buildOwnAnalysisInput({
      ...draft,
      log: { ...draft.log, fileName: 'incident.log', fileSize: 10 },
      history: { ...draft.history, fileName: 'commits.json', fileSize: 10 },
      formatChoice: 'plain-text',
    });
    expect(input.logs.source).toBe('incident.log');
    expect(input.history.source).toBe('commits.json');
    expect(input.logs.format).toBe('plain-text');
  });

  it('uses uploaded-* fallbacks for unsafe file names', () => {
    const draft = pastedDraft();
    const sources = sourcesFor({
      ...draft,
      log: { ...draft.log, fileName: '..', fileSize: 1 },
      history: { ...draft.history, fileName: '/abs.json', fileSize: 1 },
    });
    expect(sources).toEqual({ logs: 'uploaded-log', history: 'uploaded-history' });
  });

  it('keeps log and history sources distinct when the file names match', () => {
    const draft = pastedDraft();
    const sources = sourcesFor({
      ...draft,
      log: { ...draft.log, fileName: 'incident.json', fileSize: 1 },
      history: { ...draft.history, fileName: 'incident.json', fileSize: 1 },
    });
    expect(sources).toEqual({ logs: 'incident.json', history: 'history/incident.json' });
  });
});

describe('resultLabel', () => {
  it('names the chosen log file, else the pasted log', () => {
    const draft = pastedDraft();
    expect(resultLabel(draft)).toBe('pasted log');
    expect(resultLabel({ ...draft, log: { ...draft.log, fileName: 'incident.jsonl', fileSize: 5 } })).toBe('incident.jsonl');
  });
});

describe('checkFileSize', () => {
  it('refuses a file over 1 MiB with the pre-read message', () => {
    expect(checkFileSize({ name: 'big.jsonl', size: 1572864 })).toBe(
      'big.jsonl is 1.5 MiB. The limit is 1 MiB. Trim the file to the incident window and choose it again.',
    );
  });

  it('accepts exactly 1 MiB and refuses one byte more', () => {
    expect(MAX_INPUT_FILE_BYTES).toBe(1048576);
    expect(checkFileSize({ name: 'edge.log', size: 1048576 })).toBeNull();
    expect(checkFileSize({ name: 'edge.log', size: 1048577 })).not.toBeNull();
  });

  it('accepts small and empty files', () => {
    expect(checkFileSize({ name: 'small.log', size: 0 })).toBeNull();
    expect(checkFileSize({ name: 'small.log', size: 2048 })).toBeNull();
  });
});

describe('file display text', () => {
  it('formats sizes in B, KiB and MiB', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KiB');
    expect(formatFileSize(1572864)).toBe('1.5 MiB');
    expect(formatFileSize(1048576)).toBe('1.0 MiB');
  });

  it('states the detected log format', () => {
    expect(detectedFormatLabel('jsonl')).toBe('Detected: JSON-lines');
    expect(detectedFormatLabel('plain-text')).toBe('Detected: Plain text');
  });

  it('shows the file chip as name and size without truncation', () => {
    expect(fileChipText({ fileName: 'incident.jsonl', fileSize: 2048 })).toBe('incident.jsonl · 2.0 KiB');
    const long = `${'a'.repeat(200)}.log`;
    expect(fileChipText({ fileName: long, fileSize: 10 })).toBe(`${long} · 10 B`);
  });
});

describe('README console notes', () => {
  const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');

  it('documents using the console and the font note', () => {
    expect(readme).toContain('Using the console');
    expect(readme).toContain('FONTS.md');
  });
});
