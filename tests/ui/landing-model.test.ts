import { describe, expect, it } from 'vitest';
import { DEFAULT_LOG_LIMITS } from '../../src/core/log-parser';
import { SCORING_V1 } from '../../src/core/scoring';
import {
  DEMO_STEPS,
  FEATURE_TABS,
  demoMode,
  limitsText,
  markdownExcerpt,
  prefixIdRefs,
  scrollProgress,
  stepAt,
  tabKeyTarget,
  weightsText,
} from '../../src/ui/landing-model';

describe('prefixIdRefs', () => {
  it('prefixes every token', () => {
    expect(prefixIdRefs('a b', 'p')).toBe('p-a p-b');
  });

  it('collapses surrounding and repeated whitespace', () => {
    expect(prefixIdRefs('  a   b\tc\n', 'p')).toBe('p-a p-b p-c');
  });

  it('gives an empty string for empty and whitespace-only input', () => {
    expect(prefixIdRefs('', 'p')).toBe('');
    expect(prefixIdRefs('   \n ', 'p')).toBe('');
  });
});

describe('FEATURE_TABS', () => {
  it('lists the six tabs in order', () => {
    expect(FEATURE_TABS.map((tab) => tab.id)).toEqual(['onset', 'suspects', 'timeline', 'drawer', 'postmortem', 'offline']);
    expect(FEATURE_TABS.map((tab) => tab.label)).toEqual([
      'Onset detection',
      'Ranked suspects',
      'Linked timeline',
      'Evidence drawer',
      'Markdown postmortem',
      'Private and offline',
    ]);
  });
});

describe('tabKeyTarget', () => {
  it('moves right with wrap-around', () => {
    expect(tabKeyTarget(2, 'ArrowRight', 6)).toBe(3);
    expect(tabKeyTarget(5, 'ArrowRight', 6)).toBe(0);
  });

  it('moves left with wrap-around', () => {
    expect(tabKeyTarget(3, 'ArrowLeft', 6)).toBe(2);
    expect(tabKeyTarget(0, 'ArrowLeft', 6)).toBe(5);
  });

  it('jumps with Home and End', () => {
    expect(tabKeyTarget(3, 'Home', 6)).toBe(0);
    expect(tabKeyTarget(3, 'End', 6)).toBe(5);
  });

  it('ignores every other key', () => {
    for (const key of ['Enter', ' ', 'ArrowUp', 'ArrowDown', 'Tab', 'a']) expect(tabKeyTarget(2, key, 6)).toBeNull();
  });

  it('gives null without tabs and clamps an out-of-range current index', () => {
    expect(tabKeyTarget(0, 'ArrowRight', 0)).toBeNull();
    expect(tabKeyTarget(9, 'ArrowRight', 6)).toBe(0);
    expect(tabKeyTarget(-4, 'ArrowLeft', 6)).toBe(5);
  });
});

describe('weightsText', () => {
  it('prints the frozen scoring weights in signal order with two decimals', () => {
    expect(weightsText(SCORING_V1.weights)).toBe('proximity 0.35, trace match 0.30, novelty 0.25, churn 0.10');
  });

  it('changes when a weight changes', () => {
    expect(weightsText({ ...SCORING_V1.weights, churn: 0.2 })).toBe('proximity 0.35, trace match 0.30, novelty 0.25, churn 0.20');
  });
});

describe('limitsText', () => {
  it('states the default log limits', () => {
    expect(limitsText(DEFAULT_LOG_LIMITS)).toBe('up to 1 MiB and 10,000 events');
  });

  it('shows one decimal when the size is not a whole MiB', () => {
    expect(limitsText({ maxLogBytes: 1_572_864, maxEvents: 500 })).toBe('up to 1.5 MiB and 500 events');
  });
});

describe('markdownExcerpt', () => {
  it('returns the first lines without the trailing newline', () => {
    const text = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`).join('\n') + '\n';
    const lines = markdownExcerpt(text, 14);
    expect(lines).toHaveLength(14);
    expect(lines[0]).toBe('line 1');
    expect(lines[13]).toBe('line 14');
  });

  it('returns every line of a short text', () => {
    expect(markdownExcerpt('a\nb\n', 14)).toEqual(['a', 'b']);
  });

  it('gives an empty list for empty text and handles CRLF', () => {
    expect(markdownExcerpt('', 14)).toEqual([]);
    expect(markdownExcerpt('a\r\nb\r\n', 14)).toEqual(['a', 'b']);
  });
});

describe('DEMO_STEPS', () => {
  it('lists the five steps in order', () => {
    expect(DEMO_STEPS.map((step) => step.id)).toEqual(['inputs', 'onset', 'suspects', 'evidence', 'postmortem']);
    for (const step of DEMO_STEPS) expect(step.title.length).toBeGreaterThan(0);
  });
});

describe('scrollProgress', () => {
  it('maps the section position to 0..1 over the pinned distance', () => {
    expect(scrollProgress(0, 4000, 800)).toBe(0);
    expect(scrollProgress(-1600, 4000, 800)).toBe(0.5);
    expect(scrollProgress(-3200, 4000, 800)).toBe(1);
  });

  it('clamps before and after the section', () => {
    expect(scrollProgress(500, 4000, 800)).toBe(0);
    expect(scrollProgress(-9000, 4000, 800)).toBe(1);
  });

  it('handles a section that is not taller than the viewport', () => {
    expect(scrollProgress(0, 600, 800)).toBe(1);
    expect(scrollProgress(-10, 800, 800)).toBe(1);
    expect(scrollProgress(10, 600, 800)).toBe(0);
  });

  it('gives 0 for any non-finite input', () => {
    expect(scrollProgress(Number.NaN, 4000, 800)).toBe(0);
    expect(scrollProgress(0, Number.POSITIVE_INFINITY, 800)).toBe(0);
    expect(scrollProgress(0, 4000, Number.NaN)).toBe(0);
  });
});

describe('stepAt', () => {
  it('maps progress to a step index and the local progress inside it', () => {
    expect(stepAt(0, 5)).toEqual({ index: 0, local: 0 });
    expect(stepAt(0.19, 5).index).toBe(0);
    expect(stepAt(0.2, 5)).toEqual({ index: 1, local: 0 });
    expect(stepAt(0.5, 5)).toEqual({ index: 2, local: 0.5 });
    expect(stepAt(0.999, 5).index).toBe(4);
    expect(stepAt(1, 5)).toEqual({ index: 4, local: 1 });
  });

  it('treats negative and NaN progress as the first step and an empty list as index 0', () => {
    expect(stepAt(-0.3, 5)).toEqual({ index: 0, local: 0 });
    expect(stepAt(Number.NaN, 5)).toEqual({ index: 0, local: 0 });
    expect(stepAt(0.5, 0)).toEqual({ index: 0, local: 0 });
  });

  it('keeps local progress within 0..1 everywhere', () => {
    for (let step = -2; step <= 120; step += 1) {
      const result = stepAt(step / 100, 5);
      expect(result.local).toBeGreaterThanOrEqual(0);
      expect(result.local).toBeLessThanOrEqual(1);
      expect(result.index).toBeGreaterThanOrEqual(0);
      expect(result.index).toBeLessThanOrEqual(4);
    }
  });
});

describe('demoMode', () => {
  it('pins the stage only when motion is allowed and the viewport is wide', () => {
    expect(demoMode({ motion: true, wide: true })).toBe('scrolly');
    expect(demoMode({ motion: true, wide: false })).toBe('reveal');
    expect(demoMode({ motion: false, wide: true })).toBe('static');
    expect(demoMode({ motion: false, wide: false })).toBe('static');
  });
});
