import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AnalysisResult } from '../../src/core/model';
import { serializeCanonicalJson, serializeMarkdown } from '../../src/core/serialization';

const fixtureDirectory = fileURLToPath(new URL('../../fixtures/incidents/checkout-outage/', import.meta.url));
const fixtureRelativePath = 'fixtures/incidents/checkout-outage';

function readFixtureFile(name: string): string {
  return readFileSync(new URL(`../../fixtures/incidents/checkout-outage/${name}`, import.meta.url), 'utf8');
}

function buildTracerResult(manifest: any, logs: any[], history: any, expected: any): AnalysisResult {
  const firstCommit = history.commits[0];
  const firstFile = firstCommit.files[0];
  const eventIds = logs.map((_, index) => `event-${String(index + 1).padStart(3, '0')}`);
  const timestamps = logs.map((event) => new Date(event.timestamp).toISOString());
  const firstTimestamp = timestamps[0];
  const lastTimestamp = timestamps[timestamps.length - 1];
  if (firstTimestamp === undefined || lastTimestamp === undefined) {
    throw new Error('Fixture must contain at least one log event');
  }
  const evidenceReferences = expected.evidenceRequirements.map((requirement: string) => ({
    type: 'feature' as const,
    sourceId: `${manifest.id}:${requirement}`,
    path: firstFile.path,
    lineStart: firstFile.ranges[0].start,
    lineEnd: firstFile.ranges[0].end,
    detail: requirement,
  }));

  return {
    schemaVersion: manifest.schemaVersion,
    analysisVersion: 'analysis-v1',
    scoringVersion: 'scoring-v1',
    provenance: {
      logSource: `${fixtureRelativePath}/logs.jsonl`,
      historySource: `${fixtureRelativePath}/history.json`,
      logFormat: manifest.inputFormats.logs,
      historyFormat: manifest.inputFormats.history,
      eventCount: logs.length,
      commitCount: history.commits.length,
    },
    limits: { maxLogBytes: 1000000, maxEvents: 10000, maxStackLines: 100, truncated: false },
    warnings: [],
    assumptions: expected.caveats,
    diagnostics: [],
    incident: {
      status: expected.onset.class,
      interpretation: expected.interpretation,
      onset: {
        class: expected.onset.class,
        windowStartUtc: expected.onset.windowStartUtc,
        windowEndUtc: expected.onset.windowEndUtc,
        baselineRate: 0,
        peakRate: logs.length,
        explanation: manifest.purpose,
      },
    },
    errors: [{
      signature: `${manifest.id}:primary`,
      representativeMessage: logs.find((event) => event.level === 'error')?.message ?? logs[0].message,
      count: logs.filter((event) => event.level === 'error').length,
      firstSeenUtc: firstTimestamp,
      lastSeenUtc: lastTimestamp,
      eventIds,
      stackFrames: [{ filePath: firstFile.path, line: firstFile.ranges[0].start, column: null, functionName: null, vendor: false }],
    }],
    timeline: [{
      bucketStartUtc: expected.onset.windowStartUtc,
      bucketEndUtc: expected.onset.windowEndUtc,
      errorCount: logs.filter((event) => event.level === 'error').length,
      errorGroupSignatures: [`${manifest.id}:primary`],
      commitShas: history.commits.map((commit: any) => commit.sha),
    }],
    suspects: history.commits.map((commit: any, index: number) => ({
      rank: index + 1,
      sha: commit.sha,
      shortSha: commit.sha.slice(0, 7),
      subject: commit.subject,
      author: commit.author,
      committedAtUtc: commit.timestamp,
      score: 1 / (index + 1),
      signals: [],
      evidenceReferences: index === 0 ? evidenceReferences : [],
      tieBreakKey: `${1 / (index + 1)}|${commit.timestamp}|${commit.sha}`,
    })),
    confidence: { band: expected.confidence, rationale: expected.caveats.join(' '), scoreSeparation: null, evidenceCompleteness: 1 },
    tieBreak: { rule: 'score descending, commit timestamp descending, SHA ascending', appliedOrder: ['score', 'committedAtUtc', 'sha'] },
  };
}

describe('checkout fixture contract', () => {
  it('contains exactly the schema-versioned shared fixture files', () => {
    expect(readdirSync(fixtureDirectory).sort()).toEqual(['expected.json', 'history.json', 'logs.jsonl', 'manifest.json']);
  });

  it('validates metadata, mixed offsets, multiline traces, decoys, and safe paths', () => {
    const manifest = JSON.parse(readFixtureFile('manifest.json')) as any;
    const logsText = readFixtureFile('logs.jsonl');
    const logs = logsText.trim().split('\n').map((line) => JSON.parse(line) as any);
    const history = JSON.parse(readFixtureFile('history.json')) as any;
    const expected = JSON.parse(readFixtureFile('expected.json')) as any;
    const allText = [manifest, history, expected, logsText].map((value) => typeof value === 'string' ? value : JSON.stringify(value)).join('\n');

    expect(manifest).toMatchObject({ schemaVersion: 1, id: 'checkout-outage', inputFormats: { logs: 'jsonl', history: 'culprit-json' } });
    expect(manifest.purpose).toBeTruthy();
    expect(manifest.expected.interpretation).toBe(expected.interpretation);
    expect(manifest.requiredEvidence).toEqual(expected.evidenceRequirements);
    expect(manifest.caveats).toEqual(expected.caveats);
    expect(logs.some((event) => typeof event.stack === 'string' && event.stack.includes('\n'))).toBe(true);
    expect(logsText).toContain('+05:30');
    expect(logsText).toContain('node_modules/vendor-lib');
    expect(history.commits).toHaveLength(3);
    expect(history.commits.some((commit: any) => commit.subject.includes('dashboard'))).toBe(true);
    expect(history.commits.flatMap((commit: any) => commit.files).every((file: any) => /^[a-z0-9._/-]+$/.test(file.path))).toBe(true);
    expect(allText).not.toMatch(/(?:[A-Za-z]:[\\/]|^|\s)\//m);
    expect(history.commits.flatMap((commit: any) => commit.files).every((file: any) => !file.path.includes('\\'))).toBe(true);
    expect(allText).not.toMatch(/(?:AKIA|BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY|password\s*[:=])/i);
  });

  it('serializes one fixture-derived tracer result identically on repeat', () => {
    const manifest = JSON.parse(readFixtureFile('manifest.json')) as any;
    const logs = readFixtureFile('logs.jsonl').trim().split('\n').map((line) => JSON.parse(line) as any);
    const history = JSON.parse(readFixtureFile('history.json')) as any;
    const expected = JSON.parse(readFixtureFile('expected.json')) as any;
    const result = buildTracerResult(manifest, logs, history, expected);
    const canonical = serializeCanonicalJson(result);
    const markdown = serializeMarkdown(result);

    expect(canonical).toBe(serializeCanonicalJson(result));
    expect(markdown).toBe(serializeMarkdown(result));
    expect(canonical).toContain('"provenance"');
    expect(canonical).toContain('"assumptions"');
    expect(canonical).toContain('2026-10-19T04:20:00.000Z');
    expect(markdown).toContain('UTC disclosure');
    expect(markdown).toContain(expected.caveats[0]);
    expect(markdown.endsWith('\n')).toBe(true);
  });
});
