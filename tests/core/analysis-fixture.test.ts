import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AnalysisInput, AnalysisStream } from '../../src/core/model';
import { analyze, toAnalysisResult } from '../../src/core/pipeline';
import { serializeCanonicalJson, serializeMarkdown } from '../../src/core/serialization';

const fixtureIds = ['checkout-outage', 'slow-burn', 'ambiguous'] as const;
type FixtureId = (typeof fixtureIds)[number];

function read(fixtureId: FixtureId, fileName: string): string {
  return readFileSync(new URL(`../../fixtures/incidents/${fixtureId}/${fileName}`, import.meta.url), 'utf8');
}

function fixtureInput(fixtureId: FixtureId): AnalysisInput {
  return {
    logs: { text: read(fixtureId, 'logs.jsonl'), format: 'jsonl', source: `fixtures/incidents/${fixtureId}/logs.jsonl` },
    history: { text: read(fixtureId, 'history.json'), format: 'culprit-json', source: `fixtures/incidents/${fixtureId}/history.json` },
    options: null,
  };
}

function streamFor(fixtureId: FixtureId): AnalysisStream {
  const outcome = analyze(fixtureInput(fixtureId));
  if (!outcome.ok) throw outcome.error;
  return outcome.stream;
}

describe('shared fixture analysis contract', () => {
  it.each(fixtureIds)('consumes the manifest contract through analyze for %s', (fixtureId) => {
    const manifest = JSON.parse(read(fixtureId, 'manifest.json')) as {
      id: string;
      expected: { onsetClass: string; confidence: string };
      requiredEvidence: string[];
      caveats: string[];
    };
    const stream = streamFor(fixtureId);
    const outputText = JSON.stringify(stream);

    expect(manifest.id).toBe(fixtureId);
    expect(stream.onset.classification).toBe(manifest.expected.onsetClass);
    expect(stream.ranking.status).toBe('ranked');
    const prose = [...stream.assumptions, ...stream.warnings, stream.ranking.interpretation, stream.ranking.confidence.rationale].join(' ');
    expect(prose).not.toMatch(/Phase 3|deferred/i);
    expect(stream.normalizedEvents.length).toBeGreaterThan(0);
    expect(stream.commits.length).toBeGreaterThanOrEqual(3);
    expect(stream.warnings.concat(stream.assumptions, stream.diagnostics.map((diagnostic) => diagnostic.message)).join(' ')).toMatch(/UTC|timestamp/i);

    for (const evidence of manifest.requiredEvidence) {
      if (evidence === 'onset-window') expect(stream.onset.onsetWindow).not.toBeNull();
      if (evidence === 'application-stack-frame') expect(stream.errors.some((group) => group.stackFrames.some((frame) => frame.filePath !== null))).toBe(true);
      if (evidence === 'changed-line-range') expect(stream.commits.some((commit) => commit.files.some((file) => file.ranges.length > 0))).toBe(true);
      if (evidence === 'pre-onset-commit') expect(stream.commits.length).toBeGreaterThan(0);
      if (evidence === 'gradual-error-rate-ramp') expect(stream.onset.classification).toBe('ramp');
      if (evidence === 'competing-pre-onset-commits') expect(stream.commits.length).toBeGreaterThanOrEqual(2);
      if (evidence === 'weak-trace-evidence') expect(outputText).toMatch(/weak|competing|unmatched/i);
      if (evidence === 'low-confidence-rationale') expect(outputText).toMatch(/weak|competing/i);
    }

    const caveatText = stream.warnings.concat(stream.assumptions, stream.diagnostics.map((diagnostic) => diagnostic.message)).join(' ');
    expect(caveatText).toMatch(/timestamp|UTC/i);
    expect(caveatText).toMatch(/causal/i);
    if (fixtureId === 'ambiguous') expect(caveatText).toMatch(/shared|weak|competing/i);
  });

  it.each(fixtureIds)('keeps repeated canonical JSON and Markdown byte-identical for %s', (fixtureId) => {
    const first = toAnalysisResult(streamFor(fixtureId));
    const second = toAnalysisResult(streamFor(fixtureId));
    expect(serializeCanonicalJson(first)).toBe(serializeCanonicalJson(second));
    expect(serializeMarkdown(first)).toBe(serializeMarkdown(second));
    expect(serializeCanonicalJson(first)).not.toMatch(/[A-Za-z]:[\\/]|\\\\/);
    expect(serializeMarkdown(first)).toContain('UTC disclosure');
    expect(serializeMarkdown(first)).not.toMatch(/generated|generation time:.*\d{4}/i);
  });
});
