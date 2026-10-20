import { el } from './dom';
import { MOTION_TIMING, countFrame, decodeFrame, planEntrance } from './motion-model';

/**
 * DOM driver for the result entrance. CSS owns the fade-rise, the meter fills and the timeline draw-in
 * (all behind prefers-reduced-motion: no-preference); this module adds the classes that start them and runs
 * the hash decode and number count-up on an aria-hidden overlay. The real text node is never modified, so
 * assistive technology and tests see the exact value from the first paint, and a finished, cancelled or
 * skipped roll always leaves the exact final text on screen. It is the only module that uses animation-frame
 * APIs; nothing here uses a timer, moves focus or blocks input.
 */

export interface MotionScope {
  /** Cancels every pending frame, observer and listener. Safe to call more than once. */
  dispose(): void;
}

const NOOP_SCOPE: MotionScope = { dispose: () => undefined };

export function prefersMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
}

/** The status banner (when shown) and each section of the result, with `.investigation` expanded. */
export function resultSections(statusRegion: HTMLElement, body: HTMLElement): HTMLElement[] {
  const sections: HTMLElement[] = [];
  const banner = statusRegion.querySelector<HTMLElement>('.status-banner');
  if (banner !== null && !banner.hidden) sections.push(banner);
  const stack = body.querySelector<HTMLElement>('.result-stack');
  if (stack === null) return sections;
  for (const child of Array.from(stack.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child.classList.contains('investigation')) {
      for (const inner of Array.from(child.children)) {
        if (inner instanceof HTMLElement && inner.childElementCount > 0) sections.push(inner);
      }
    } else if (child.childElementCount > 0) {
      sections.push(child);
    }
  }
  return sections;
}

type Frame = (finalText: string, progress: number) => string;

/** Starts one roll on `target`; returns a cancel function that leaves the exact final text. */
function startRoll(target: HTMLElement, delayMs: number): () => void {
  const mode = target.dataset['roll'];
  const frame: Frame = mode === 'count' ? countFrame : decodeFrame;
  const durationMs = mode === 'count' ? MOTION_TIMING.countMs : MOTION_TIMING.decodeMs;
  const finalText = target.textContent ?? '';
  const first = frame(finalText, 0);
  if (first === finalText) return () => undefined;

  const ghost = el('span', { className: 'roll-ghost', attrs: { 'aria-hidden': 'true' }, text: first });
  target.append(ghost);
  target.classList.add('is-rolling');

  let handle = 0;
  let finished = false;
  let startedAt: number | null = null;

  const finish = (): void => {
    if (finished) return;
    finished = true;
    if (handle !== 0) cancelAnimationFrame(handle);
    ghost.remove();
    target.classList.remove('is-rolling');
  };

  const tick = (timestamp: number): void => {
    handle = 0;
    if (finished) return;
    if (startedAt === null) startedAt = timestamp + delayMs;
    const progress = (timestamp - startedAt) / durationMs;
    if (progress >= 1) {
      finish();
      return;
    }
    const text = frame(finalText, progress);
    if (ghost.textContent !== text) ghost.textContent = text;
    handle = requestAnimationFrame(tick);
  };
  handle = requestAnimationFrame(tick);
  return finish;
}

/**
 * The timeline draw-in is a class on its section for exactly as long as its animations run. The chart is
 * redrawn from a resize observer straight after it mounts (replaced nodes restart under the still-present
 * class), and once every animation under the section has ended the class is removed, so a later resize or
 * filter redraw never replays the draw-in.
 */
function holdDrawIn(section: HTMLElement, cancels: Array<() => void>): void {
  if (typeof section.getAnimations !== 'function') return;
  section.classList.add('motion-draw');
  const release = (): void => {
    if (section.getAnimations({ subtree: true }).length > 0) return;
    section.classList.remove('motion-draw');
    stop();
  };
  const stop = (): void => {
    section.removeEventListener('animationend', release);
    section.removeEventListener('animationcancel', release);
  };
  section.addEventListener('animationend', release);
  section.addEventListener('animationcancel', release);
  cancels.push(stop);
}

/** Plays the staggered entrance for `sections`; a no-op scope when the user prefers reduced motion. */
export function playEntrance(sections: readonly HTMLElement[]): MotionScope {
  if (!prefersMotion() || sections.length === 0) return NOOP_SCOPE;

  const cancels: Array<() => void> = [];
  let observer: IntersectionObserver | null = null;
  let disposed = false;

  const play = (section: HTMLElement, index: number): void => {
    if (disposed) return;
    section.style.setProperty('--index', String(index));
    section.classList.add('motion-enter');
    if (section.querySelector('.series-draw') !== null) holdDrawIn(section, cancels);
    const delay = index * MOTION_TIMING.staggerMs + MOTION_TIMING.rollDelayMs;
    for (const target of Array.from(section.querySelectorAll<HTMLElement>('[data-roll]'))) {
      cancels.push(startRoll(target, delay));
    }
  };

  const tops = sections.map((section) => section.getBoundingClientRect().top);
  const plan = planEntrance(tops, window.innerHeight);
  for (const { position, index } of plan.immediate) {
    const section = sections[position];
    if (section !== undefined) play(section, index);
  }

  if (plan.deferred.length > 0) {
    if (typeof IntersectionObserver === 'function') {
      const watching = new Map<Element, HTMLElement>();
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const section = watching.get(entry.target);
          if (section === undefined) continue;
          watching.delete(entry.target);
          observer?.unobserve(entry.target);
          play(section, 0);
        }
      });
      for (const position of plan.deferred) {
        const section = sections[position];
        if (section === undefined) continue;
        watching.set(section, section);
        observer.observe(section);
      }
    } else {
      for (const position of plan.deferred) {
        const section = sections[position];
        if (section !== undefined) play(section, MOTION_TIMING.maxStaggerIndex);
      }
    }
  }

  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      observer?.disconnect();
      observer = null;
      for (const cancel of cancels) cancel();
      cancels.length = 0;
    },
  };
}
