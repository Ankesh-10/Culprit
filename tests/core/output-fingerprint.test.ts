import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AnalysisInput } from '../../src/core/model';
import { analyze, toAnalysisResult } from '../../src/core/pipeline';
import { serializeCanonicalJson, serializeMarkdown } from '../../src/core/serialization';

type FixtureId = 'checkout-outage' | 'slow-burn' | 'ambiguous';

const FIXTURE_IDS: readonly FixtureId[] = ['checkout-outage', 'slow-burn', 'ambiguous'];

// These change only with a deliberate analysis or export change; Plan 05-04 polish must leave them untouched.
const OUTPUT_FINGERPRINTS: Record<FixtureId, { canonical: string; markdown: string }> = {
  'checkout-outage': {
    canonical: '342d447a4432d7daf814615d5a531d3c05c606eed345ec014c1ffee8aef82bb8',
    markdown: '876d100d941889a3eba7103ecafad51be6322ea49ec994db1c279bcc83d262c9',
  },
  'slow-burn': {
    canonical: '85783011fc454389cfc046a1d0e37cc3d259d76fa1a9bc8cecf1856587215d19',
    markdown: '03fdccaf4889573f89bf5eeca321737967f24102925ea2b0a5a2bcb0eb49bba1',
  },
  ambiguous: {
    canonical: 'a4e85249bcc6c2a049374ee878c5ac09aaea94331428149a6808218ef865febe',
    markdown: '718bd055066e403453369ba5e2d501bd5e59005184ab8e934e65c48edcabadd6',
  },
};

function fixtureText(id: FixtureId, fileName: string): string {
  return readFileSync(new URL(`../../fixtures/incidents/${id}/${fileName}`, import.meta.url), 'utf8');
}

function toCrlf(text: string): string {
  return text.replace(/\r?\n/g, '\r\n');
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function fingerprint(id: FixtureId, transform: (text: string) => string = (text) => text): { canonical: string; markdown: string } {
  const input: AnalysisInput = {
    logs: { text: transform(fixtureText(id, 'logs.jsonl')), format: 'jsonl', source: `fixtures/incidents/${id}/logs.jsonl` },
    history: { text: transform(fixtureText(id, 'history.json')), format: 'culprit-json', source: `fixtures/incidents/${id}/history.json` },
    options: null,
  };
  const outcome = analyze(input);
  if (!outcome.ok) throw outcome.error;
  const result = toAnalysisResult(outcome.stream);
  return { canonical: sha256(serializeCanonicalJson(result)), markdown: sha256(serializeMarkdown(result)) };
}

describe('pinned output fingerprints of the bundled cases', () => {
  it.each(FIXTURE_IDS)('keeps the canonical JSON and Markdown of %s byte-identical to the pinned hashes', (id) => {
    expect(fingerprint(id)).toEqual(OUTPUT_FINGERPRINTS[id]);
  });

  it('pins six distinct 64-character SHA-256 hex strings', () => {
    const hashes = FIXTURE_IDS.flatMap((id) => [OUTPUT_FINGERPRINTS[id].canonical, OUTPUT_FINGERPRINTS[id].markdown]);
    expect(hashes).toHaveLength(6);
    for (const hash of hashes) expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(new Set(hashes).size).toBe(6);
  });

  it('does not depend on the order in which the cases are analyzed', () => {
    const forward = FIXTURE_IDS.map((id) => fingerprint(id));
    const reversed = [...FIXTURE_IDS].reverse().map((id) => fingerprint(id)).reverse();
    expect(reversed).toEqual(forward);
  });

  it.each(FIXTURE_IDS)('does not depend on LF or CRLF line endings for %s', (id) => {
    expect(fingerprint(id, toCrlf)).toEqual(fingerprint(id));
  });
});
