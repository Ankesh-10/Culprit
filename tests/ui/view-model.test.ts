import { describe, expect, it } from 'vitest';
import type { AnalysisStream } from '../../src/core/model';
import { findCase, toAnalysisInput } from '../../src/ui/cases';
import { buildVerdictView } from '../../src/ui/view-model';
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
