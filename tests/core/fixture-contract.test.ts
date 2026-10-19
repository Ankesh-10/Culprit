import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AnalysisResult } from '../../src/core/model';
import { serializeCanonicalJson, serializeMarkdown } from '../../src/core/serialization';

const fixtureRoot = fileURLToPath(new URL('../../fixtures/incidents/', import.meta.url));
const fixtureIds = ['ambiguous', 'checkout-outage', 'slow-burn'] as const;
const fixtureFiles = ['expected.json', 'history.json', 'logs.jsonl', 'manifest.json'] as const;

type FixtureId = (typeof fixtureIds)[number];
type JsonRecord = Record<string, any>;

function readFixture(id: FixtureId, name: string): string {
  return readFileSync(`${fixtureRoot}/${id}/${name}`, 'utf8');
}

function loadFixture(id: FixtureId): { manifest: JsonRecord; logs: JsonRecord[]; history: JsonRecord; expected: JsonRecord; allText: string } {
  const manifestText = readFixture(id, 'manifest.json');
  const logsText = readFixture(id, 'logs.jsonl');
  const historyText = readFixture(id, 'history.json');
  const expectedText = readFixture(id, 'expected.json');
  const manifest = JSON.parse(manifestText) as JsonRecord;
  const logs = logsText.trim().split('\n').map((line) => JSON.parse(line) as JsonRecord);
  const history = JSON.parse(historyText) as JsonRecord;
  const expected = JSON.parse(expectedText) as JsonRecord;

  return {
    manifest,
    logs,
    history,
    expected,
    allText: [manifestText, logsText, historyText, expectedText].join('\n'),
  };
}

function buildTracerResult(id: FixtureId, manifest: JsonRecord, logs: JsonRecord[], history: JsonRecord, expected: JsonRecord): AnalysisResult {
  const firstCommit = history.commits[0] as JsonRecord;
  const firstFile = firstCommit.files[0] as JsonRecord;
  const eventIds = logs.map((_, index) => `event-${String(index + 1).padStart(3, '0')}`);
  const timestamps = logs.map((event) => new Date(event.timestamp as string).toISOString());
  const firstTimestamp = timestamps[0];
  const lastTimestamp = timestamps[timestamps.length - 1];
  if (firstTimestamp === undefined || lastTimestamp === undefined) {
    throw new Error('Fixture must contain at least one log event');
  }
  const evidenceRequirements = expected.evidenceRequirements as string[];
  const firstRange = (firstFile.ranges as JsonRecord[])[0];
  const firstLog = logs[0];
  if (firstRange === undefined || firstLog === undefined) {
    throw new Error('Fixture must contain a file range and at least one log event');
  }
  const evidenceReferences = evidenceRequirements.map((requirement) => ({
    type: 'feature' as const,
    sourceId: `${manifest.id as string}:${requirement}`,
    path: firstFile.path as string,
    lineStart: firstRange.start as number,
    lineEnd: firstRange.end as number,
    detail: requirement,
  }));
  const commits = history.commits as JsonRecord[];
  const errorCount = logs.filter((event) => event.level === 'error').length;
  const expectedOnset = expected.onset as JsonRecord;

  return {
    schemaVersion: manifest.schemaVersion as 1,
    analysisVersion: 'analysis-v1',
    scoringVersion: 'scoring-v1',
    provenance: {
      logSource: `fixtures/incidents/${id}/logs.jsonl`,
      historySource: `fixtures/incidents/${id}/history.json`,
      logFormat: manifest.inputFormats.logs,
      historyFormat: manifest.inputFormats.history,
      eventCount: logs.length,
      commitCount: commits.length,
    },
    limits: { maxLogBytes: 1000000, maxEvents: 10000, maxStackLines: 100, truncated: false },
    warnings: [],
    assumptions: expected.caveats,
    diagnostics: [],
    incident: {
      status: expectedOnset.class,
      interpretation: expected.interpretation,
      onset: {
        class: expectedOnset.class,
        windowStartUtc: expectedOnset.windowStartUtc,
        windowEndUtc: expectedOnset.windowEndUtc,
        baselineRate: 0,
        peakRate: errorCount,
        explanation: manifest.purpose,
      },
    },
    errors: [{
      signature: `${manifest.id as string}:primary`,
      representativeMessage: (logs.find((event) => event.level === 'error') ?? firstLog).message,
      count: errorCount,
      firstSeenUtc: firstTimestamp,
      lastSeenUtc: lastTimestamp,
      eventIds,
      stackFrames: [{ filePath: firstFile.path, line: firstRange.start, column: null, functionName: null, vendor: false }],
    }],
    timeline: [{
      bucketStartUtc: expectedOnset.windowStartUtc,
      bucketEndUtc: expectedOnset.windowEndUtc,
      errorCount,
      errorGroupSignatures: [`${manifest.id as string}:primary`],
      commitShas: commits.map((commit) => commit.sha as string),
    }],
    suspects: commits.map((commit, index) => ({
      rank: index + 1,
      sha: commit.sha as string,
      shortSha: (commit.sha as string).slice(0, 7),
      subject: commit.subject as string,
      author: commit.author as string,
      committedAtUtc: commit.timestamp as string,
      score: 1 / (index + 1),
      signals: [],
      evidenceReferences: index === 0 ? evidenceReferences : [],
      tieBreakKey: `${1 / (index + 1)}|${commit.timestamp as string}|${commit.sha as string}`,
    })),
    confidence: { band: expected.confidence, rationale: (expected.caveats as string[]).join(' '), scoreSeparation: null, evidenceCompleteness: 1 },
    tieBreak: { rule: 'score descending, commit timestamp descending, SHA ascending', appliedOrder: ['score', 'committedAtUtc', 'sha'] },
  };
}

describe('shared incident fixture contract', () => {
  it('enumerates exactly the three stable fixture IDs and four contract files', () => {
    expect(readdirSync(fixtureRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()).toEqual(fixtureIds);
    for (const id of fixtureIds) {
      expect(readdirSync(`${fixtureRoot}/${id}`).sort()).toEqual(fixtureFiles);
    }
  });

  it.each(fixtureIds)('validates %s metadata, data, evidence, and safe deterministic values', (id) => {
    const { manifest, logs, history, expected, allText } = loadFixture(id);
    const commits = history.commits as JsonRecord[];
    const expectedOnset = expected.onset as JsonRecord;

    expect(manifest).toMatchObject({ schemaVersion: 1, id, inputFormats: { logs: 'jsonl', history: 'culprit-json' } });
    expect(manifest.name).toBeTruthy();
    expect(manifest.purpose).toBeTruthy();
    expect(manifest.expected.interpretation).toBe(expected.interpretation);
    expect(manifest.expected.onsetClass).toBe(expectedOnset.class);
    expect(manifest.expected.confidence).toBe(expected.confidence);
    expect(manifest.requiredEvidence).toEqual(expected.evidenceRequirements);
    expect(manifest.caveats).toEqual(expected.caveats);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.every((event) => typeof event.timestamp === 'string' && Number.isFinite(Date.parse(event.timestamp)))).toBe(true);
    expect(logs.some((event) => typeof event.stack === 'string' && event.stack.includes('\n'))).toBe(true);
    expect(commits.length).toBeGreaterThanOrEqual(3);
    expect(commits.every((commit) => /^[0-9a-f]{40}$/.test(commit.sha as string))).toBe(true);
    expect(commits.flatMap((commit) => commit.files as JsonRecord[]).every((file) => /^[a-z0-9._/-]+$/.test(file.path as string))).toBe(true);
    expect(commits.flatMap((commit) => commit.files as JsonRecord[]).every((file) => (file.ranges as JsonRecord[]).every((range) => range.start <= range.end))).toBe(true);

    if (id === 'slow-burn') {
      expect(`${manifest.purpose} ${manifest.expected.interpretation}`).toMatch(/ramp|delayed/i);
      expect(expectedOnset.class).toBe('ramp');
    }
    if (id === 'ambiguous') {
      expect(`${manifest.purpose} ${manifest.expected.interpretation}`).toMatch(/competing|weak|no-clear-culprit|no clear culprit/i);
      expect(expected.confidence).toBe('low');
    }

    expect(allText).not.toMatch(/(?:[A-Za-z]:[\\/]|^|\s)\//m);
    expect((commits.flatMap((commit) => commit.files as JsonRecord[]).map((file) => file.path))).not.toContain(expect.stringContaining('\\'));
    expect(allText).not.toMatch(/(?:AKIA|BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY|password\s*[:=])/i);
    expect(allText).not.toMatch(/(?:Date\.now|Math\.random|randomUUID|current[-_ ]time|<timestamp>|\{\{[^}]+\}\})/i);
  });

  it.each(fixtureIds)('serializes %s identically on repeat', (id) => {
    const { manifest, logs, history, expected } = loadFixture(id);
    const result = buildTracerResult(id, manifest, logs, history, expected);
    const canonical = serializeCanonicalJson(result);
    const markdown = serializeMarkdown(result);

    expect(canonical).toBe(serializeCanonicalJson(result));
    expect(markdown).toBe(serializeMarkdown(result));
    expect(canonical).toContain('"provenance"');
    expect(canonical).toContain('"assumptions"');
    expect(markdown).toContain('UTC disclosure');
    expect(markdown).toContain((expected.caveats as string[])[0]);
    expect(markdown.endsWith('\n')).toBe(true);
  });
});
