import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AnalysisResult } from '../../src/core/model';
import { serializeCanonicalJson, serializeMarkdown } from '../../src/core/serialization';

const fixtureRoot = fileURLToPath(new URL('../../fixtures/incidents/', import.meta.url));
const fixtureIds = ['ambiguous', 'checkout-outage', 'slow-burn'] as const;
const fixtureFiles = ['expected.json', 'history.json', 'logs.jsonl', 'manifest.json'] as const;

type FixtureId = (typeof fixtureIds)[number];
type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown, label: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return value as JsonRecord;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string`);
  }
  return value;
}

function asNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}

function asRecordArray(value: unknown, label: string): JsonRecord[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value.map((entry, index) => asRecord(entry, `${label}[${index}]`));
}

function asStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value.map((entry, index) => asString(entry, `${label}[${index}]`));
}

function field(record: JsonRecord, key: string, label = key): unknown {
  const value = record[key];
  if (value === undefined) {
    throw new Error(`${label} is missing`);
  }
  return value;
}

function stringField(record: JsonRecord, key: string, label = key): string {
  return asString(field(record, key, label), label);
}

function numberField(record: JsonRecord, key: string, label = key): number {
  return asNumber(field(record, key, label), label);
}

function recordField(record: JsonRecord, key: string, label = key): JsonRecord {
  return asRecord(field(record, key, label), label);
}

function recordArrayField(record: JsonRecord, key: string, label = key): JsonRecord[] {
  return asRecordArray(field(record, key, label), label);
}

function stringArrayField(record: JsonRecord, key: string, label = key): string[] {
  return asStringArray(field(record, key, label), label);
}

function readText(fixtureId: FixtureId, fileName: string): string {
  return readFileSync(join(fixtureRoot, fixtureId, fileName), 'utf8');
}

function readJsonRecord(fixtureId: FixtureId, fileName: string): JsonRecord {
  return asRecord(JSON.parse(readText(fixtureId, fileName)) as unknown, `${fixtureId}/${fileName}`);
}

function readFixture(fixtureId: FixtureId) {
  const manifestText = readText(fixtureId, 'manifest.json');
  const logsText = readText(fixtureId, 'logs.jsonl');
  const historyText = readText(fixtureId, 'history.json');
  const expectedText = readText(fixtureId, 'expected.json');
  const logs = logsText
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => asRecord(JSON.parse(line) as unknown, `${fixtureId}/logs.jsonl:${index + 1}`));

  return {
    manifest: asRecord(JSON.parse(manifestText) as unknown, `${fixtureId}/manifest.json`),
    logs,
    history: asRecord(JSON.parse(historyText) as unknown, `${fixtureId}/history.json`),
    expected: asRecord(JSON.parse(expectedText) as unknown, `${fixtureId}/expected.json`),
    allText: [manifestText, logsText, historyText, expectedText].join('\n'),
  };
}

function buildTracerResult(
  fixtureId: FixtureId,
  manifest: JsonRecord,
  logs: JsonRecord[],
  history: JsonRecord,
  expected: JsonRecord,
): AnalysisResult {
  const commits = recordArrayField(history, 'commits', `${fixtureId}.history.commits`);
  const firstCommit = commits[0];
  const firstLog = logs[0];
  if (firstCommit === undefined || firstLog === undefined) {
    throw new Error(`${fixtureId} must contain a commit and a log event`);
  }

  const firstFile = recordArrayField(firstCommit, 'files', `${fixtureId}.history.commits[0].files`)[0];
  if (firstFile === undefined) {
    throw new Error(`${fixtureId} must contain a file entry`);
  }

  const firstRange = recordArrayField(firstFile, 'ranges', `${fixtureId}.history.commits[0].files[0].ranges`)[0];
  if (firstRange === undefined) {
    throw new Error(`${fixtureId} must contain a changed line range`);
  }

  const manifestId = stringField(manifest, 'id', `${fixtureId}.manifest.id`);
  const inputFormats = recordField(manifest, 'inputFormats', `${fixtureId}.manifest.inputFormats`);
  const expectedOnset = recordField(expected, 'onset', `${fixtureId}.expected.onset`);
  const caveats = stringArrayField(expected, 'caveats', `${fixtureId}.expected.caveats`);
  const evidenceRequirements = stringArrayField(expected, 'evidenceRequirements', `${fixtureId}.expected.evidenceRequirements`);
  const timestamps = logs.map((event, index) => new Date(stringField(event, 'timestamp', `${fixtureId}.logs[${index}].timestamp`)).toISOString());
  const firstTimestamp = timestamps[0];
  const lastTimestamp = timestamps.at(-1);
  if (firstTimestamp === undefined || lastTimestamp === undefined) {
    throw new Error(`${fixtureId} must contain timestamps`);
  }

  const onsetClass = stringField(expectedOnset, 'class', `${fixtureId}.expected.onset.class`) as AnalysisResult['incident']['status'];
  const errorCount = logs.filter((event) => stringField(event, 'level') === 'error').length;
  const primarySignature = `${manifestId}:primary`;
  const firstPath = stringField(firstFile, 'path', `${fixtureId}.history.files[0].path`);
  const firstLine = numberField(firstRange, 'start', `${fixtureId}.history.ranges[0].start`);
  const lastLine = numberField(firstRange, 'end', `${fixtureId}.history.ranges[0].end`);
  const firstSha = stringField(firstCommit, 'sha', `${fixtureId}.history.commits[0].sha`);
  const representativeEvent = logs.find((event) => stringField(event, 'level') === 'error') ?? firstLog;

  const evidenceReferences = evidenceRequirements.map((requirement) => ({
    type: 'feature' as const,
    sourceId: `${manifestId}:${requirement}`,
    path: firstPath,
    lineStart: firstLine,
    lineEnd: lastLine,
    detail: requirement,
  }));

  return {
    schemaVersion: numberField(manifest, 'schemaVersion', `${fixtureId}.manifest.schemaVersion`) as 1,
    analysisVersion: 'analysis-v1',
    scoringVersion: 'scoring-v1',
    provenance: {
      logSource: `fixtures/incidents/${fixtureId}/logs.jsonl`,
      historySource: `fixtures/incidents/${fixtureId}/history.json`,
      logFormat: stringField(inputFormats, 'logs') as 'jsonl',
      historyFormat: stringField(inputFormats, 'history') as 'culprit-json',
      eventCount: logs.length,
      commitCount: commits.length,
    },
    limits: {
      maxLogBytes: 1_000_000,
      maxEvents: 10_000,
      maxStackLines: 100,
      truncated: false,
    },
    warnings: [],
    assumptions: caveats,
    diagnostics: [],
    incident: {
      status: onsetClass,
      interpretation: stringField(expected, 'interpretation', `${fixtureId}.expected.interpretation`),
      onset: {
        class: onsetClass,
        windowStartUtc: stringField(expectedOnset, 'windowStartUtc'),
        windowEndUtc: stringField(expectedOnset, 'windowEndUtc'),
        baselineRate: 0,
        peakRate: errorCount,
        explanation: stringField(manifest, 'purpose', `${fixtureId}.manifest.purpose`),
      },
    },
    errors: [{
      signature: primarySignature,
      representativeMessage: stringField(representativeEvent, 'message'),
      count: errorCount,
      firstSeenUtc: firstTimestamp,
      lastSeenUtc: lastTimestamp,
      eventIds: logs.map((_, index) => `event-${String(index + 1).padStart(3, '0')}`),
      stackFrames: [{
        filePath: firstPath,
        line: firstLine,
        column: null,
        functionName: null,
        vendor: false,
      }],
    }],
    timeline: [{
      bucketStartUtc: stringField(expectedOnset, 'windowStartUtc'),
      bucketEndUtc: stringField(expectedOnset, 'windowEndUtc'),
      errorCount,
      errorGroupSignatures: [primarySignature],
      commitShas: commits.map((commit) => stringField(commit, 'sha')),
    }],
    suspects: commits.map((commit, index) => {
      const score = 1 / (index + 1);
      const sha = stringField(commit, 'sha');
      const timestamp = stringField(commit, 'timestamp');
      return {
        rank: index + 1,
        sha,
        shortSha: sha.slice(0, 7),
        subject: stringField(commit, 'subject'),
        author: stringField(commit, 'author'),
        committedAtUtc: timestamp,
        score,
        timeGapMinutes: 0,
        traceSummary: { matchKind: 'none' as const, matchedErrorCount: 0, lineLevelErrorCount: 0, totalErrorCount: errorCount },
        signals: [],
        evidenceReferences: index === 0 ? evidenceReferences : [],
        tieBreakKey: `${score}|${timestamp}|${sha}`,
      };
    }),
    ranking: {
      status: 'ranked',
      referenceUtc: stringField(expectedOnset, 'windowStartUtc'),
      eligibleCount: commits.length,
      considered: commits.map((commit, index) => {
        const sha = stringField(commit, 'sha');
        return {
          sha,
          shortSha: sha.slice(0, 7),
          subject: stringField(commit, 'subject'),
          author: stringField(commit, 'author'),
          committedAtUtc: stringField(commit, 'timestamp'),
          status: 'top-three' as const,
          rank: index + 1,
          score: 1 / (index + 1),
          reason: null,
        };
      }),
    },
    confidence: {
      band: stringField(expected, 'confidence') as AnalysisResult['confidence']['band'],
      labels: stringField(expected, 'confidence') === 'low' ? ['low-confidence' as const] : [],
      rationale: caveats.join(' '),
      scoreSeparation: null,
      evidenceCompleteness: 1,
    },
    tieBreak: {
      rule: 'score descending, commit timestamp descending, SHA ascending',
      appliedOrder: ['score', 'committedAtUtc', 'sha'],
    },
  };
}

describe('shared incident fixture contract', () => {
  it('contains exactly three stable fixture directories', () => {
    const directories = readdirSync(fixtureRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(directories).toEqual([...fixtureIds]);
  });

  it.each(fixtureIds)('contains the complete file contract for %s', (fixtureId) => {
    const files = readdirSync(join(fixtureRoot, fixtureId)).sort();
    expect(files).toEqual([...fixtureFiles]);
  });

  it.each(fixtureIds)('validates metadata and input shape for %s', (fixtureId) => {
    const { manifest, logs, history, expected, allText } = readFixture(fixtureId);
    const commits = recordArrayField(history, 'commits');
    const expectedOnset = recordField(expected, 'onset');
    const manifestExpected = recordField(manifest, 'expected');
    const allFiles = commits.flatMap((commit) => recordArrayField(commit, 'files'));

    expect(stringField(manifest, 'id')).toBe(fixtureId);
    expect(numberField(manifest, 'schemaVersion')).toBe(1);
    expect(stringField(manifest, 'name')).not.toBe('');
    expect(stringField(manifest, 'purpose')).not.toBe('');
    expect(stringField(manifestExpected, 'interpretation')).toBe(stringField(expected, 'interpretation'));
    expect(stringField(manifestExpected, 'onsetClass')).toBe(stringField(expectedOnset, 'class'));
    expect(stringField(manifestExpected, 'confidence')).toBe(stringField(expected, 'confidence'));
    expect(stringArrayField(manifest, 'requiredEvidence')).toEqual(stringArrayField(expected, 'evidenceRequirements'));
    expect(stringArrayField(manifest, 'caveats')).toEqual(stringArrayField(expected, 'caveats'));

    expect(logs.length).toBeGreaterThan(0);
    expect(logs.every((event) => Number.isFinite(Date.parse(stringField(event, 'timestamp'))))).toBe(true);
    expect(logs.some((event) => typeof event.stack === 'string' && event.stack.includes('\n'))).toBe(true);
    expect(commits.length).toBeGreaterThanOrEqual(3);
    expect(commits.every((commit) => /^[0-9a-f]{40}$/.test(stringField(commit, 'sha')))).toBe(true);
    expect(allFiles.every((file) => /^[a-z0-9._/-]+$/.test(stringField(file, 'path')))).toBe(true);
    expect(allFiles.every((file) => !stringField(file, 'path').includes('\\'))).toBe(true);
    expect(allFiles.every((file) => recordArrayField(file, 'ranges').every((range) => numberField(range, 'start') <= numberField(range, 'end')))).toBe(true);

    if (fixtureId === 'slow-burn') {
      expect(`${stringField(manifest, 'purpose')} ${stringField(manifestExpected, 'interpretation')}`).toMatch(/ramp|delayed/i);
      expect(stringField(expectedOnset, 'class')).toBe('ramp');
    }

    if (fixtureId === 'ambiguous') {
      expect(`${stringField(manifest, 'purpose')} ${stringField(manifestExpected, 'interpretation')}`).toMatch(/competing|weak|no[- ]clear[- ]culprit/i);
      expect(stringField(expected, 'confidence')).toBe('low');
    }

    expect(allText).not.toMatch(/(?:[A-Za-z]:[\\/]|^|\s)\//m);
    expect(allText).not.toMatch(/(?:AKIA|BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY|password\s*[:=])/i);
    expect(allText).not.toMatch(/(?:Date\.now|Math\.random|randomUUID|current[-_ ]time|<timestamp>|\{\{[^}]+\}\})/i);
  });

  it.each(fixtureIds)('produces repeatable JSON and Markdown for %s', (fixtureId) => {
    const { manifest, logs, history, expected } = readFixture(fixtureId);
    const result = buildTracerResult(fixtureId, manifest, logs, history, expected);
    const json = serializeCanonicalJson(result);
    const markdown = serializeMarkdown(result);

    expect(json).toBe(serializeCanonicalJson(result));
    expect(markdown).toBe(serializeMarkdown(result));
    expect(json).toContain('"provenance"');
    expect(json).toContain('"assumptions"');
    expect(markdown).toContain('UTC disclosure');
    expect(markdown).toContain(stringArrayField(expected, 'caveats')[0]);
    expect(markdown.endsWith('\n')).toBe(true);
  });
});
