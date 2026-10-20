import { el } from './dom';
import { DEMO_STEPS, demoMode, scrollProgress, stepAt } from './landing-model';
import type { DemoMode, DemoStepId } from './landing-model';
import { playEntrance, prefersMotion, watchScroll } from './motion';
import type { MotionScope } from './motion';

/**
 * The "See it work" demo. The static markup is already the stacked sequence of five steps, each with its
 * preview slot, so it reads correctly without script and under reduced motion. This controller builds the
 * five preview frames once and then runs one of three modes:
 *
 * - scrolly (motion allowed, 640px and wider): the frames move into a sticky stage and the scroll position
 *   over the tall step track picks the active step; the stage animates when a step becomes active.
 * - reveal (motion allowed, narrower): frames stay in their steps and each animates once on entering view.
 * - static (reduced motion): frames stay in their steps; nothing is observed and no class is added.
 *
 * It never prevents a default, never snaps or moves the scroll position and never moves focus.
 */

export interface DemoController {
  start(): void;
  stop(): void;
}

const WIDE_QUERY = '(min-width: 640px)';
const MOTION_QUERY = '(prefers-reduced-motion: no-preference)';

export function mountDemo(section: HTMLElement, build: (id: DemoStepId) => HTMLElement | null): DemoController {
  const trackNode = section.querySelector<HTMLElement>('.demo-track');
  const stageNode = section.querySelector<HTMLElement>('.demo-stage');
  if (trackNode === null || stageNode === null) return { start: () => undefined, stop: () => undefined };
  const track: HTMLElement = trackNode;
  const stage: HTMLElement = stageNode;

  const steps = new Map<DemoStepId, HTMLElement>();
  const slots = new Map<DemoStepId, HTMLElement>();
  for (const { id } of DEMO_STEPS) {
    const step = section.querySelector<HTMLElement>(`[data-demo-step="${id}"]`);
    const slot = section.querySelector<HTMLElement>(`[data-preview="demo-${id}"]`);
    if (step !== null) steps.set(id, step);
    if (slot !== null) slots.set(id, slot);
  }
  const frames = new Map<DemoStepId, HTMLElement>();

  let built = false;
  let started = false;
  let scope: MotionScope | null = null;
  let activeIndex = -1;
  const motionQuery = window.matchMedia(MOTION_QUERY);
  const wideQuery = window.matchMedia(WIDE_QUERY);

  function buildFrames(): void {
    if (built) return;
    built = true;
    for (const { id } of DEMO_STEPS) {
      const slot = slots.get(id);
      if (slot === undefined) continue;
      const frame = build(id);
      if (frame === null) {
        slot.append(el('p', { className: 'preview-unavailable', text: 'Preview unavailable.' }));
        continue;
      }
      frames.set(id, frame);
      slot.append(frame);
    }
  }

  /** Marks one step and its frame active; the onset frame replays its draw-in each time it becomes active. */
  function activate(index: number): void {
    activeIndex = index;
    DEMO_STEPS.forEach((step, position) => {
      const active = position === index;
      steps.get(step.id)?.classList.toggle('is-active', active);
      const frame = frames.get(step.id);
      if (frame === undefined) return;
      frame.classList.toggle('is-active', active);
      if (active) frame.removeAttribute('aria-hidden');
      else frame.setAttribute('aria-hidden', 'true');
      if (step.id === 'onset') frame.classList.toggle('motion-draw', active);
    });
  }

  function onFrame(rect: DOMRect, viewportHeight: number): void {
    const progress = scrollProgress(rect.top, rect.height, viewportHeight);
    section.style.setProperty('--demo-progress', progress.toFixed(3));
    const { index } = stepAt(progress, DEMO_STEPS.length);
    if (index !== activeIndex) activate(index);
  }

  /** Back to the plain stacked layout: no classes, no hidden frames, every frame in its own step. */
  function leave(): void {
    scope?.dispose();
    scope = null;
    section.classList.remove('is-scrolly');
    section.style.removeProperty('--demo-progress');
    stage.hidden = true;
    for (const { id } of DEMO_STEPS) {
      steps.get(id)?.classList.remove('is-active');
      const frame = frames.get(id);
      if (frame === undefined) continue;
      frame.classList.remove('is-active', 'motion-draw', 'motion-enter');
      frame.removeAttribute('aria-hidden');
      frame.removeAttribute('data-demo-frame');
      frame.style.removeProperty('--index');
      slots.get(id)?.append(frame);
    }
    activeIndex = -1;
  }

  function enter(mode: DemoMode): void {
    leave();
    if (mode === 'scrolly') {
      section.classList.add('is-scrolly');
      stage.hidden = false;
      for (const { id } of DEMO_STEPS) {
        const frame = frames.get(id);
        if (frame === undefined) continue;
        frame.setAttribute('data-demo-frame', id);
        stage.append(frame);
      }
      activate(0);
      scope = watchScroll(track, onFrame);
    } else if (mode === 'reveal') {
      scope = playEntrance(Array.from(frames.values()));
    }
  }

  function currentMode(): DemoMode {
    return demoMode({ motion: prefersMotion(), wide: wideQuery.matches });
  }

  const onChange = (): void => {
    if (started) enter(currentMode());
  };

  return {
    start(): void {
      if (started) return;
      started = true;
      buildFrames();
      motionQuery.addEventListener('change', onChange);
      wideQuery.addEventListener('change', onChange);
      enter(currentMode());
    },
    stop(): void {
      if (!started) return;
      started = false;
      motionQuery.removeEventListener('change', onChange);
      wideQuery.removeEventListener('change', onChange);
      leave();
    },
  };
}
