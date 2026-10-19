import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseHistoryExport } from '../../src/core/history-parser';

const checkoutHistory = readFileSync(new URL('../../fixtures/incidents/checkout-outage/history.json', import.meta.url), 'utf8');
const slowHistory = readFileSync(new URL('../../fixtures/incidents/slow-burn/history.json', import.meta.url), 'utf8');
const ambiguousHistory = readFileSync(new URL('../../fixtures/incidents/ambiguous/history.json', import.meta.url), 'utf8');

describe('culprit-json history parser', () => {
  it.each([checkoutHistory, slowHistory, ambiguousHistory])('parses the checked-in history schema', (text) => {
    const outcome = parseHistoryExport(text);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.format).toBe('culprit-json');
    expect(outcome.value.commits.length).toBe(3);
    expect(outcome.value.commits.every((commit) => /^[0-9a-f]{40}$/.test(commit.sha))).toBe(true);
    expect(outcome.value.commits.every((commit) => commit.message === commit.subject && commit.timestampUtc.endsWith('Z'))).toBe(true);
    expect(outcome.value.commits.every((commit) => commit.files.every((file) => !file.path.includes('\\')))).toBe(true);
  });

  it('accepts subject as the message compatibility alias and canonicalizes ordering', () => {
    const text = JSON.stringify({ schemaVersion: 1, format: 'culprit-json', repository: 'repo', commits: [
      { sha: 'b'.repeat(40), author: 'B', timestamp: '2026-10-19T02:00:00Z', subject: ' later ', files: [{ path: './z.ts', added: 1, deleted: 0, ranges: [{ start: 4, end: 5 }, { start: 1, end: 2 }] }] },
      { sha: 'a'.repeat(40), author: 'A', timestamp: '2026-10-19T01:00:00+00:00', message: 'first', files: [{ path: 'a.ts', added: 0, deleted: 1, ranges: [{ start: 1, end: 1 }] }] },
    ] });
    const outcome = parseHistoryExport(text);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.commits.map((commit) => commit.sha[0])).toEqual(['a', 'b']);
    expect(outcome.value.commits[1]?.message).toBe('later');
    expect(outcome.value.commits[1]?.files[0]?.ranges).toEqual([{ start: 1, end: 2 }, { start: 4, end: 5 }]);
  });

  it('reports record/field-aware validation failures', () => {
    const invalid = JSON.stringify({ schemaVersion: 1, format: 'culprit-json', repository: 'repo', commits: [{ sha: 'ABC', author: '', timestamp: '2026-10-19T00:00:00', message: 'x', files: [] }] });
    const outcome = parseHistoryExport(invalid, { source: 'history.json' });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('HISTORY_VALIDATION');
      expect(outcome.error.record).toBe(1);
      expect(outcome.error.field).toBe('sha');
      expect(outcome.diagnostics[0]?.source).toBe('history.json');
    }
  });

  it.each([
    ['format', { schemaVersion: 1, format: 'git-log', repository: 'repo', commits: [] }],
    ['path', { schemaVersion: 1, format: 'culprit-json', repository: 'repo', commits: [{ sha: 'a'.repeat(40), author: 'A', timestamp: '2026-10-19T00:00:00Z', message: 'x', files: [{ path: '../bad.ts', added: 1, deleted: 0, ranges: [{ start: 1, end: 2 }] }] }] }],
    ['range', { schemaVersion: 1, format: 'culprit-json', repository: 'repo', commits: [{ sha: 'a'.repeat(40), author: 'A', timestamp: '2026-10-19T00:00:00Z', message: 'x', files: [{ path: 'a.ts', added: 1, deleted: 0, ranges: [{ start: 3, end: 2 }] }] }] }],
  ])('rejects invalid %s history', (_label, value) => {
    const outcome = parseHistoryExport(JSON.stringify(value));
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('HISTORY_VALIDATION');
  });
});
