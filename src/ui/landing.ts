import { el } from './dom';
import { FEATURE_TABS } from './landing-model';
import { bundledStream, renderFeaturePreview, renderHeroCard } from './landing-preview';
import { mountFeatureTabs } from './landing-tabs';
import { playEntrance } from './motion';
import type { MotionScope } from './motion';

/**
 * The landing view. The static markup in index.html already holds every word of copy; this module wires
 * the calls to action and builds the live previews from the bundled fixtures once the view is first shown.
 */

export interface LandingView {
  show(): void;
  hide(): void;
}

export interface LandingOptions {
  /** A "Try ..." link was activated with a plain click; the shell opens the console and loads the case. */
  onTryCase(id: string): void;
}

function required<T extends HTMLElement>(doc: Document, selector: string): T {
  const node = doc.querySelector<T>(selector);
  if (node === null) throw new Error(`Missing required element ${selector}`);
  return node;
}

export function mountLanding(doc: Document, options: LandingOptions): LandingView {
  const view = required<HTMLElement>(doc, '#view-landing');

  for (const link of Array.from(view.querySelectorAll<HTMLAnchorElement>('a[data-try-case]'))) {
    link.addEventListener('click', (event) => {
      // Modified clicks keep the native link behaviour (new tab or window with the #/app address).
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const id = link.dataset['tryCase'];
      if (id === undefined || id === '') return;
      event.preventDefault();
      options.onTryCase(id);
    });
  }

  function runWhenIdle(task: () => void): void {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => task());
    else setTimeout(task, 0);
  }

  /** Each feature preview is built on idle time, so the hero and the tabs are never blocked by a heavier one. */
  function buildFeatures(): void {
    const features = required<HTMLElement>(doc, '#features');
    mountFeatureTabs(features);
    for (const tab of FEATURE_TABS) {
      runWhenIdle(() => {
        const slot = features.querySelector<HTMLElement>(`[data-preview="${tab.id}"]`);
        if (slot === null) return;
        const frame = renderFeaturePreview(tab.id, 'feature');
        slot.append(frame ?? el('p', { className: 'preview-unavailable', text: 'Preview unavailable.' }));
      });
    }
  }

  let built = false;
  let heroScope: MotionScope | null = null;

  function buildHero(): void {
    const slot = required<HTMLElement>(doc, '[data-preview="hero"]');
    const stream = bundledStream('checkout-outage');
    const card = stream === null ? null : renderHeroCard(stream);
    if (card === null) {
      slot.append(el('p', { className: 'preview-unavailable', text: 'Preview unavailable.' }));
      return;
    }
    slot.append(card);
    heroScope = playEntrance([card]);
  }

  return {
    show(): void {
      if (built) return;
      built = true;
      buildHero();
      buildFeatures();
    },
    hide(): void {
      heroScope?.dispose();
      heroScope = null;
    },
  };
}
