import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AnalysisInput } from '../../src/core/model';
import { analyze, toAnalysisResult } from '../../src/core/pipeline';
import { serializeCanonicalJson, serializeMarkdown } from '../../src/core/serialization';

const checkoutLogs = readFileSync(new URL('../../fixtures/incidents/checkout-outage/logs.jsonl', import.meta.url), 'utf8');
const checkoutHistory = readFileSync(new URL('../../fixtures/incidents/checkout-outage/history.json', import.meta.url), 'utf8');

function input(logs: string, history: string): AnalysisInput {
  return {
    logs: { text: logs, format: 'jsonl', source: 'fixtures/incidents/checkout-outage/logs.jsonl' },
    history: { text: history, format: 'culprit-json', source: 'fixtures/incidents/checkout-outage/history.json' },
    options: null,
  };
}

function serialized(candidate: AnalysisInput): { json: string; markdown: string; eventIds: string[]; signatures: string[]; bucketStarts: string[] } {
  const outcome = analyze(candidate);
  if (!outcome.ok) throw outcome.error;
  const result = toAnalysisResult(outcome.stream);
  return {
    json: serializeCanonicalJson(result),
    markdown: serializeMarkdown(result),
    eventIds: outcome.stream.normalizedEvents.map((event) => event.eventId),
    signatures: outcome.stream.errors.map((group) => group.signature),
    bucketStarts: outcome.stream.buckets.map((bucket) => bucket.bucketStartUtc),
  };
}

function reorderLogs(text: string): string {
  return text.trim().split(/\r?\n/).reverse().join('\n');
}

function reorderHistory(text: string): string {
  const value = JSON.parse(text) as { commits: unknown[]; [key: string]: unknown };
  return JSON.stringify({ ...value, commits: [...value.commits].reverse() });
}

describe('analysis determinism boundary', () => {
  it('is byte-identical across repeated calls and permitted record reordering', () => {
    const baseline = serialized(input(checkoutLogs, checkoutHistory));
    const repeated = serialized(input(checkoutLogs, checkoutHistory));
    const reordered = serialized(input(reorderLogs(checkoutLogs), reorderHistory(checkoutHistory)));
    expect(repeated).toEqual(baseline);
    expect(reordered).toEqual(baseline);
  });

  it('restores TZ, locale-related environment, Date.now, and Math.random after variants', () => {
    const originalTz = process.env.TZ;
    const originalLocale = process.env.LC_ALL;
    const originalDateNow = Date.now;
    const originalRandom = Math.random;
    const baseline = serialized(input(checkoutLogs, checkoutHistory));
    try {
      process.env.TZ = 'America/Los_Angeles';
      process.env.LC_ALL = 'fr-FR';
      Date.now = () => 1;
      Math.random = () => 0.987654321;
      const variant = serialized(input(checkoutLogs, checkoutHistory));
      expect(variant).toEqual(baseline);
    } finally {
      if (originalTz === undefined) delete process.env.TZ;
      else process.env.TZ = originalTz;
      if (originalLocale === undefined) delete process.env.LC_ALL;
      else process.env.LC_ALL = originalLocale;
      Date.now = originalDateNow;
      Math.random = originalRandom;
    }
    expect(process.env.TZ).toBe(originalTz);
    expect(process.env.LC_ALL).toBe(originalLocale);
    expect(Date.now).toBe(originalDateNow);
    expect(Math.random).toBe(originalRandom);
  });
});
