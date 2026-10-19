import { describe, expect, it } from 'vitest';
import type { AnalysisInput, AnalysisStream } from '../../src/core/model';
import { findCase, toAnalysisInput } from '../../src/ui/cases';
import { analyze } from '../../src/core/pipeline';
import { buildConsideredRows, buildShortlistView, buildVerdictView } from '../../src/ui/view-model';
import { handleAnalyzeRequest } from '../../src/worker/protocol';

function bundledStream(id: string): AnalysisStream {
  const found = findCase(id);
  if (found === undefined) throw new Error(`missing case ${id}`);
  const response = handleAnalyzeRequest({ type: 'analyze', requestId: 1, input: toAnalysisInput(found) });
  if (response.type !== 'result') throw new Error('expected a result');
  return response.stream;
}

const CHECKOUT = bundledStream('checkout-outage');
const SLOW_BURN = bundledStream('slow-burn');
const AMBIGUOUS = bundledStream('ambiguous');

describe('buildVerdictView', () => {
  it('shows every evidence fact for the checkout case', () => {
    const view = buildVerdictView(CHECKOUT);
    if (view === null) throw new Error('expected a verdict');
    expect(view.caution).toBeNull();
    expect(view.headline).toEqual({
      mode: 'suspect',
      shortSha: '2222222',
      subject: 'refactor: add payment provider retry path',
    });
    expect(view.facts.map((fact) => [fact.key, fact.label])).toEqual([
      ['author', 'Author'],
      ['committed', 'Committed'],
      ['gap', 'Time gap'],
      ['onset', 'Onset'],
      ['files', 'Files and lines'],
      ['matches', 'Matching errors'],
    ]);
    const byKey = new Map(view.facts.map((fact) => [fact.key, fact]));
    expect(byKey.get('author')?.value).toBe('Jordan Lee');
    expect(byKey.get('committed')?.value).toBe('2026-10-19 04:18 UTC');
    expect(byKey.get('gap')?.value).toBe('12 min before onset window start');
    expect(byKey.get('onset')?.value).toBe(CHECKOUT.onset.explanation);
    expect(byKey.get('files')?.values).toEqual(['src/checkout/payment.ts:104–126', 'src/checkout/handler.ts:36–49']);
    expect(byKey.get('files')?.moreCount).toBe(0);
    expect(byKey.get('matches')?.value).toBe('Matches 5 of 5 errors');
    expect(view.traceChip).toBe('Exact line');
    expect(view.score.value).toBeCloseTo(0.912065, 6);
    expect(view.score.text).toBe('0.91');
    expect(view.score.fraction).toBeCloseTo(0.912065, 6);
    expect(view.scoreHelper).toBe('Suspicion score from 0 to 1. This is ranked suspicion, not probability.');
    const leading = CHECKOUT.ranking.suspects[0];
    expect(view.evidencePreview).toEqual((leading?.evidenceReferences ?? []).slice(0, 3).map((ref) => ref.detail));
    expect(view.evidencePreview.length).toBeGreaterThan(0);
    expect(view.confidence.hasLabels).toBe(false);
  });

  it('shows the caution banner, ordered chips and leading candidate for the ambiguous case', () => {
    const view = buildVerdictView(AMBIGUOUS);
    if (view === null) throw new Error('expected a verdict');
    expect(view.caution).toEqual({
      lead: 'Low confidence. Treat these as leads to check, not a diagnosis.',
      chips: ['Low confidence', 'Ambiguous', 'Weak evidence', 'No clear culprit'],
    });
    expect(view.headline.mode).toBe('no-clear-culprit');
    expect(view.headline.shortSha).toBe('9999999');
    expect(view.traceChip).toBe('No trace match');
    const byKey = new Map(view.facts.map((fact) => [fact.key, fact]));
    expect(byKey.get('matches')?.value).toBe('Matches 0 of 4 errors');
    expect(byKey.get('files')?.values).toEqual(['package.json:12–14']);
    expect(view.confidence.hasLabels).toBe(true);
  });

  it('carries the ramp caveat and medium confidence for slow-burn', () => {
    const view = buildVerdictView(SLOW_BURN);
    if (view === null) throw new Error('expected a verdict');
    const byKey = new Map(view.facts.map((fact) => [fact.key, fact]));
    expect(byKey.get('onset')?.value.startsWith('Gradual ramp interpretation:')).toBe(true);
    expect(byKey.get('gap')?.value).toBe('38 min before onset window start');
    expect(view.confidence.text).toBe('Ranking confidence: Medium');
  });
});

function noEligibleStream(): AnalysisStream {
  const errorLine = (timestamp: string): string => `${timestamp} error request failed`;
  const input: AnalysisInput = {
    logs: {
      format: 'plain-text',
      text: [
        errorLine('2026-10-19T07:00:00Z'),
        errorLine('2026-10-19T07:05:00Z'),
        ...Array.from({ length: 4 }, () => errorLine('2026-10-19T07:10:00Z')),
      ].join('\n'),
    },
    history: {
      format: 'culprit-json',
      text: JSON.stringify({
        schemaVersion: 1,
        format: 'culprit-json',
        repository: 'test-service',
        commits: [
          {
            sha: 'a'.repeat(40),
            author: 'Test Author',
            timestamp: '2026-10-19T07:12:00Z',
            message: 'test change',
            files: [{ path: 'src/test.ts', added: 3, deleted: 1, ranges: [{ start: 1, end: 5 }] }],
          },
        ],
      }),
    },
    options: null,
  };
  const outcome = analyze(input);
  if (!outcome.ok) throw new Error('synthetic input failed to analyze');
  return outcome.stream;
}

describe('buildShortlistView', () => {
  it('returns one row per suspect', () => {
    expect(buildShortlistView(CHECKOUT)?.rows).toHaveLength(2);
    expect(buildShortlistView(SLOW_BURN)?.rows).toHaveLength(3);
    expect(buildShortlistView(AMBIGUOUS)?.rows).toHaveLength(3);
  });

  it('returns null when there are no suspects', () => {
    expect(buildShortlistView(noEligibleStream())).toBeNull();
  });

  it('describes the checkout lineup', () => {
    const view = buildShortlistView(CHECKOUT);
    if (view === null) throw new Error('expected a lineup');
    expect(view.heading).toBe('Suspect lineup');
    expect(view.countText).toBe('2 suspects');
    const [first, second] = view.rows;
    expect(first).toMatchObject({
      rank: 1,
      rankLabel: '#1',
      leading: true,
      diamond: 'leading',
      shortSha: '2222222',
      subject: 'refactor: add payment provider retry path',
      byline: 'Jordan Lee · 2026-10-19 04:18 UTC',
      gap: '12 min before onset',
      scoreText: '0.91',
      traceChip: 'Exact line',
      matches: 'Matches 5 of 5 errors',
    });
    expect(second).toMatchObject({
      rank: 2,
      leading: false,
      diamond: 'ranked',
      shortSha: '1111111',
      gap: '25 min before onset',
      traceChip: 'No trace match',
      matches: 'Matches 0 of 5 errors',
    });
    expect(first?.scoreFraction).toBeCloseTo(0.912065, 6);
  });
});

describe('buildConsideredRows', () => {
  it('lists every supplied commit in considered order with exclusions explicit', () => {
    const view = buildConsideredRows(CHECKOUT);
    expect(view.summary).toBe('Commits considered (3)');
    expect(view.rows.map((row) => row.shortSha)).toEqual(CHECKOUT.ranking.considered.map((entry) => entry.shortSha));
    const bySha = new Map(view.rows.map((row) => [row.shortSha, row]));
    expect(bySha.get('1111111')).toMatchObject({ rank: '2', status: 'Top three', score: '0.54' });
    expect(bySha.get('2222222')).toMatchObject({ rank: '1', status: 'Top three', score: '0.91' });
    const excluded = bySha.get('3333333');
    expect(excluded).toMatchObject({ rank: '—', status: 'Excluded', score: '—' });
    expect(excluded?.reason).toContain('after the onset window start');
  });

  it('maps a scored disposition to Scored with its rank and score', () => {
    const stream = structuredClone(CHECKOUT);
    stream.ranking.considered = stream.ranking.considered.map((entry) =>
      entry.shortSha === '3333333' ? { ...entry, status: 'scored' as const, rank: 4, score: 0.123, reason: null } : entry,
    );
    const row = buildConsideredRows(stream).rows.find((entry) => entry.shortSha === '3333333');
    expect(row).toMatchObject({ rank: '4', status: 'Scored', score: '0.12', reason: '' });
  });
});

describe('wording guard', () => {
  const BANNED = /\bcaused\b|root cause|culprit found|broke production|\d\s*%/i;

  function strings(value: unknown, into: string[] = []): string[] {
    if (typeof value === 'string') into.push(value);
    else if (Array.isArray(value)) for (const item of value) strings(item, into);
    else if (value !== null && typeof value === 'object') for (const item of Object.values(value)) strings(item, into);
    return into;
  }

  it.each([
    ['checkout-outage', CHECKOUT],
    ['slow-burn', SLOW_BURN],
    ['ambiguous', AMBIGUOUS],
  ])('keeps proof and percentage claims out of %s', (_id, stream) => {
    const all = [...strings(buildVerdictView(stream)), ...strings(buildShortlistView(stream)), ...strings(buildConsideredRows(stream))];
    expect(all.length).toBeGreaterThan(10);
    expect(all.filter((text) => BANNED.test(text))).toEqual([]);
  });
});
