import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LOG_LIMITS } from '../../src/core/log-parser';
import { SCORING_V1 } from '../../src/core/scoring';
import { DEMO_STEPS, FEATURE_TABS, limitsText, weightsText } from '../../src/ui/landing-model';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const landing = /<div id="view-landing"[\s\S]*?<div id="view-app"/.exec(html)?.[0] ?? '';

describe('landing copy in index.html', () => {
  it('finds the landing view', () => {
    expect(landing.length).toBeGreaterThan(1000);
  });

  it('states the scoring weights and the input limits exactly as the code defines them', () => {
    expect(landing).toContain(weightsText(SCORING_V1.weights));
    expect(landing).toContain(limitsText(DEFAULT_LOG_LIMITS));
  });

  it('has a tab and a panel for every feature', () => {
    for (const tab of FEATURE_TABS) {
      expect(landing).toContain(`id="feature-tab-${tab.id}"`);
      expect(landing).toContain(`id="feature-panel-${tab.id}"`);
      expect(landing).toContain(`id="feature-heading-${tab.id}"`);
      expect(landing).toContain(`data-preview="${tab.id}"`);
      expect(landing).toContain(`>${tab.label}</button>`);
    }
  });

  it('has a titled step and a preview slot for every demo step', () => {
    expect(landing).toContain('>See it work</h2>');
    for (const step of DEMO_STEPS) {
      expect(landing).toContain(`data-demo-step="${step.id}"`);
      expect(landing).toContain(`id="demo-heading-${step.id}"`);
      expect(landing).toContain(`data-preview="demo-${step.id}"`);
      expect(landing).toContain(`>${step.title}</h3>`);
    }
    DEMO_STEPS.forEach((_, index) => expect(landing).toContain(`Step ${index + 1} of ${DEMO_STEPS.length}`));
  });

  it('uses none of the banned marketing words or social-proof, signup and pricing language', () => {
    const banned = [
      'elevate',
      'seamless',
      'unleash',
      'next-gen',
      'game-changer',
      'delve',
      'ai-powered',
      'revolutionary',
      'trusted by',
      'testimonial',
      'newsletter',
      'pricing',
      'sign up',
      'subscribe',
    ];
    const text = landing.toLowerCase();
    expect(banned.filter((word) => text.includes(word))).toEqual([]);
  });

  it('contains no emoji or other pictographic character', () => {
    expect(/\p{Extended_Pictographic}/u.test(landing)).toBe(false);
  });

  it('keeps the honest stance in words', () => {
    expect(landing.toLowerCase()).toContain('ranked suspicion, not proof');
  });
});
