import { describe, expect, it } from 'vitest';
import type { AnalysisStream } from '../../src/core/model';
import { BUNDLED_CASES, toAnalysisInput } from '../../src/ui/cases';
import type { BundledCase } from '../../src/ui/cases';
import { buildPostmortemMarkdown } from '../../src/ui/copy';
import { CAUTION_LEAD, UTC_NOTE, buildTrustFooterView, buildVerdictView, deriveResultKind } from '../../src/ui/view-model';
import { handleAnalyzeRequest } from '../../src/worker/protocol';

const LIMITS_TEXT = 'Limits: 1 MiB of log text, 10,000 events, 100 stack lines per event';
const LIMITS_MARKDOWN = '- Limits: 1048576 bytes of log text, 10000 events, 100 stack lines per event; input truncated: no';
const OVERCLAIM = /\bcaused\b|root cause|culprit found|broke production|\d\s*%/i;

/** A fresh analysis per call: nothing is shared between cases or between tests. */
function analyzeFresh(bundledCase: BundledCase, requestId: number): AnalysisStream {
  const response = handleAnalyzeRequest({ type: 'analyze', requestId, input: toAnalysisInput(bundledCase) });
  if (response.type !== 'result') throw new Error(`expected a result for ${bundledCase.id}`);
  return response.stream;
}

function count(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

describe('three-case clean-start rehearsal: every caveat travels with the result', () => {
  it('bundles exactly the three demo cases', () => {
    expect(BUNDLED_CASES.map((entry) => entry.id)).toEqual(['checkout-outage', 'slow-burn', 'ambiguous']);
  });

  for (const [index, bundledCase] of BUNDLED_CASES.entries()) {
    describe(bundledCase.id, () => {
      const stream = analyzeFresh(bundledCase, index + 1);
      const footer = buildTrustFooterView(stream);
      const markdown = buildPostmortemMarkdown(stream);
      const kind = deriveResultKind(stream);
      const verdict = buildVerdictView(stream);

      it('shows all eight assumptions, the UTC note, limits, provenance and rationale in the console footer', () => {
        expect(stream.assumptions).toHaveLength(8);
        expect(footer.assumptions).toEqual(stream.assumptions);
        expect(footer.assumptions).toHaveLength(8);
        expect(footer.utcNote).toBe(UTC_NOTE);
        expect(footer.limits).toBe(LIMITS_TEXT);
        expect(footer.truncationBanner).toBeNull();
        expect(footer.provenance[0]).toContain(`fixtures/incidents/${bundledCase.id}/logs.jsonl`);
        expect(footer.provenance[1]).toContain(`fixtures/incidents/${bundledCase.id}/history.json`);
        expect(footer.rationale.length).toBeGreaterThan(0);
        expect(footer.rationale).toBe(stream.ranking.confidence.rationale);
      });

      it('lists every warning and diagnostic as a footer item', () => {
        expect(footer.items).toHaveLength(stream.warnings.length + stream.diagnostics.length);
        for (const warning of stream.warnings) {
          expect(footer.items.map((item) => item.message)).toContain(warning);
        }
      });

      it('carries assumptions, rationale, UTC disclosure, limits and provenance into the Markdown', () => {
        expect(count(markdown, '- Assumption: ')).toBe(8);
        expect(markdown).toContain('- Rationale: ');
        expect(markdown).toContain('## UTC disclosure');
        expect(markdown).toContain(LIMITS_MARKDOWN);
        expect(markdown).toContain(`- Logs: \`fixtures/incidents/${bundledCase.id}/logs.jsonl\``);
        expect(markdown).toContain(`- History: \`fixtures/incidents/${bundledCase.id}/history.json\``);
        for (const warning of stream.warnings) {
          expect(markdown).toContain(`- Warning: ${warning}`);
        }
      });

      it('never overclaims in the Markdown or the verdict text', () => {
        expect(markdown).not.toMatch(OVERCLAIM);
        if (verdict !== null) {
          const verdictText = [
            verdict.heading,
            verdict.confidence.text,
            verdict.caution?.lead ?? '',
            ...(verdict.caution?.chips ?? []),
            verdict.headline.subject,
            verdict.interpretation,
            verdict.scoreHelper,
            verdict.caveat,
            ...verdict.facts.map((fact) => fact.value),
          ].join('\n');
          expect(verdictText).not.toMatch(OVERCLAIM);
        }
      });

      if (bundledCase.id === 'checkout-outage') {
        it('is a completed result with no caution, no warning chip and no labels', () => {
          expect(kind).toBe('completed');
          expect(verdict?.caution).toBeNull();
          expect(footer.countChip).toBeNull();
          expect(markdown).toContain('- Labels: none');
          expect(markdown).toMatch(/## Warnings and diagnostics\n- None\.\n$/);
        });
      }

      if (bundledCase.id === 'slow-burn') {
        it('reports the ramp class in the Markdown onset section', () => {
          expect(markdown).toContain('- Class: **ramp**');
        });
      }

      if (bundledCase.id === 'ambiguous') {
        it('is low confidence with the caution lead and the four labels in order', () => {
          expect(kind).toBe('low-confidence');
          expect(verdict?.caution?.lead).toBe(CAUTION_LEAD);
          expect(verdict?.caution?.chips).toEqual(['Low confidence', 'Ambiguous', 'Weak evidence', 'No clear culprit']);
          expect(verdict?.headline.mode).toBe('no-clear-culprit');
        });

        it('shows exactly one warning in the footer and the Markdown', () => {
          expect(footer.countChip).toBe('1 warning');
          expect(footer.items).toHaveLength(1);
          expect(footer.items[0]?.message).toContain('No grouped application stack path overlaps');
          expect(markdown).toContain('- Warning: No grouped application stack path overlaps');
          expect(markdown).toContain('- Labels: low-confidence, ambiguous, weak-evidence, no-clear-culprit');
          expect(markdown).toContain('not proof of causality');
        });
      }
    });
  }

  it('gives the same Markdown when the three cases are analyzed in reverse order', () => {
    const forward = BUNDLED_CASES.map((entry, index) => buildPostmortemMarkdown(analyzeFresh(entry, index + 1)));
    const reversed = [...BUNDLED_CASES].reverse().map((entry, index) => buildPostmortemMarkdown(analyzeFresh(entry, index + 10))).reverse();
    expect(reversed).toEqual(forward);
  });
});
