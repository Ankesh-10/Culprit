import type { AnalysisStream } from '../core/model';
import { clear, el, svgEl } from './dom';
import { buildReadout, investigationContext } from './investigation-model';
import type { InvestigationEvent, InvestigationState } from './investigation-model';
import {
  bucketCenters,
  bucketIndexFromX,
  buildPlotGeometry,
  computeDomain,
  createXScale,
  onsetBand,
  yForValue,
} from './timeline-geometry';
import type { TimelineDomain, XScale } from './timeline-geometry';

export interface TimelineHandlers {
  /** `openerId` names the control that caused an open so focus can return to it on close. */
  onEvent(event: InvestigationEvent, openerId: string | null): void;
}

export interface TimelineView {
  element: HTMLElement;
  /** Updates the selection, readout and slider in place so focus and disclosure state survive. */
  update(state: InvestigationState): void;
  focusById(id: string): boolean;
  dispose(): void;
}

const DEFAULT_WIDTH = 960;
const PAD_LEFT = 36;
const PAD_RIGHT = 12;
const PAD_TOP = 28;
const PAD_BOTTOM = 8;
export const SLIDER_FOCUS_ID = 'slider';
export const READOUT_FOCUS_ID = 'readout-log';

function plotHeightFor(width: number): number {
  return width < 640 ? 128 : 160;
}

function bucketMinutes(stream: AnalysisStream): number {
  const first = stream.timeline[0];
  if (first === undefined) return 0;
  return Math.round((Date.parse(first.bucketEndUtc) - Date.parse(first.bucketStartUtc)) / 60_000);
}

function eligibleShas(stream: AnalysisStream): Set<string> {
  return new Set(stream.ranking.considered.filter((row) => row.status !== 'excluded').map((row) => row.sha));
}

interface ChartLayout {
  scale: XScale;
  domain: TimelineDomain;
  centers: number[];
  xs: number[];
  ys: number[];
  plotHeight: number;
  crosshair: SVGElement;
  ring: SVGElement;
}

export function renderTimeline(stream: AnalysisStream, initial: InvestigationState, handlers: TimelineHandlers): TimelineView {
  const minutes = bucketMinutes(stream);
  const heading = el('h2', { text: 'Timeline', attrs: { id: 'timeline-title', tabindex: '-1' } });
  const section = el('section', { className: 'panel timeline', attrs: { 'aria-labelledby': 'timeline-title' } }, [
    el('div', { className: 'timeline-header' }, [heading]),
  ]);

  if (stream.timeline.length === 0) {
    section.append(el('p', { className: 'timeline-empty', text: 'No error intervals to plot.' }));
    return { element: section, update: () => undefined, focusById: () => false, dispose: () => undefined };
  }

  const context = investigationContext(stream);
  const values = stream.timeline.map((point) => point.errorCount);
  const yMax = values.reduce((max, value) => Math.max(max, value), 1);
  const domain = computeDomain(stream.timeline, stream.commits, eligibleShas(stream));
  if (domain === null) {
    section.append(el('p', { className: 'timeline-empty', text: 'No error intervals to plot.' }));
    return { element: section, update: () => undefined, focusById: () => false, dispose: () => undefined };
  }

  let state = initial;
  let width = DEFAULT_WIDTH;
  let layout: ChartLayout | null = null;

  const title = el('p', { className: 'chart-title', text: `Errors per ${minutes}-minute interval (UTC)` });
  const chartHost = el('div', { className: 'chart-host' });
  const slider = el('div', {
    className: 'timeline-slider',
    attrs: {
      role: 'slider',
      tabindex: '0',
      'aria-orientation': 'horizontal',
      'aria-label': `Error timeline, use left and right arrow keys to move between ${minutes}-minute intervals`,
      'aria-valuemin': '0',
      'aria-valuemax': String(context.bucketCount - 1),
      'aria-valuenow': '0',
      'data-focus-id': SLIDER_FOCUS_ID,
    },
  });
  chartHost.append(slider);

  const readoutText = el('span', { className: 'readout-text' });
  const logButton = el('button', {
    className: 'button-secondary',
    attrs: { type: 'button', 'data-focus-id': READOUT_FOCUS_ID },
    on: { click: () => handlers.onEvent({ type: 'open-log-lines' }, READOUT_FOCUS_ID) },
  });
  const readoutBar = el('div', { className: 'readout-bar', attrs: { 'aria-live': 'polite', 'aria-atomic': 'true' } }, [
    readoutText,
    logButton,
  ]);

  function draw(): void {
    if (domain === null) return;
    const plotWidth = Math.max(80, width - PAD_LEFT - PAD_RIGHT);
    const plotHeight = plotHeightFor(width);
    const scale = createXScale(domain, plotWidth);
    const centers = bucketCenters(stream.timeline);
    const xs = centers.map((center) => scale.toX(center));
    const ys = values.map((value) => yForValue(value, yMax, plotHeight));
    const geometry = buildPlotGeometry(stream.timeline, values, domain, plotWidth, plotHeight, yMax);

    const plot = svgEl('g', { transform: `translate(${PAD_LEFT} ${PAD_TOP})` });

    const band = onsetBand(scale, stream.onset.windowStartUtc, stream.onset.windowEndUtc, plotWidth);
    if (band !== null) {
      plot.append(
        svgEl('rect', { class: 'onset-band', x: String(band.x), y: '0', width: String(band.width), height: String(plotHeight) }),
        svgEl('line', { class: 'onset-bracket', x1: String(band.x), x2: String(band.x + band.width), y1: '1', y2: '1' }),
      );
      const labelX = Math.max(0, Math.min(band.x, plotWidth - 100));
      plot.append(svgEl('text', { class: 'chart-label', x: String(labelX), y: '-8' }, ['Onset window']));
    }

    plot.append(
      svgEl('path', { class: 'series-area', d: geometry.areaPath }),
      svgEl('path', { class: 'series-line', d: geometry.linePath }),
    );

    const crosshair = svgEl('line', { class: 'crosshair', y1: '0', y2: String(plotHeight) });
    const ring = svgEl('circle', { class: 'selected-ring', r: '5' });
    plot.append(crosshair, ring);

    for (const rect of geometry.overlays) {
      const overlay = svgEl('rect', {
        class: 'pointer-overlay',
        x: String(rect.x),
        y: String(rect.y),
        width: String(rect.width),
        height: String(rect.height),
      });
      overlay.addEventListener('click', (event) => {
        const box = overlay.getBoundingClientRect();
        const index = bucketIndexFromX(scale, stream.timeline, (event as MouseEvent).clientX - box.left, centers);
        handlers.onEvent({ type: 'select', index }, null);
      });
      plot.append(overlay);
    }

    const svg = svgEl(
      'svg',
      {
        class: 'timeline-svg',
        width: String(width),
        height: String(PAD_TOP + plotHeight + PAD_BOTTOM),
        'aria-hidden': 'true',
        focusable: 'false',
      },
      [plot],
    );
    clear(slider);
    slider.append(svg);
    layout = { scale, domain, centers, xs, ys, plotHeight, crosshair, ring };
    moveSelection();
  }

  function moveSelection(): void {
    if (layout === null) return;
    const x = layout.xs[state.selectedIndex];
    const y = layout.ys[state.selectedIndex];
    if (x === undefined || y === undefined) return;
    layout.crosshair.setAttribute('x1', String(x));
    layout.crosshair.setAttribute('x2', String(x));
    layout.ring.setAttribute('cx', String(x));
    layout.ring.setAttribute('cy', String(y));
  }

  function syncReadout(): void {
    const readout = buildReadout(stream, state);
    slider.setAttribute('aria-valuenow', String(state.selectedIndex));
    slider.setAttribute('aria-valuetext', readout.valueText);
    readoutText.textContent = readout.text;
    logButton.textContent = readout.logButtonLabel;
  }

  slider.addEventListener('keydown', (event) => {
    const keyEvent = event as KeyboardEvent;
    switch (keyEvent.key) {
      case 'ArrowLeft':
        handlers.onEvent({ type: 'step', delta: -1 }, null);
        break;
      case 'ArrowRight':
        handlers.onEvent({ type: 'step', delta: 1 }, null);
        break;
      case 'PageUp':
        handlers.onEvent({ type: 'step', delta: -12 }, null);
        break;
      case 'PageDown':
        handlers.onEvent({ type: 'step', delta: 12 }, null);
        break;
      case 'Home':
        handlers.onEvent({ type: 'jump', target: 'first' }, null);
        break;
      case 'End':
        handlers.onEvent({ type: 'jump', target: 'last' }, null);
        break;
      case 'Enter':
      case ' ':
        handlers.onEvent({ type: 'open-log-lines' }, SLIDER_FOCUS_ID);
        break;
      default:
        return;
    }
    keyEvent.preventDefault();
  });

  section.append(title, chartHost, readoutBar);

  syncReadout();
  draw();

  let observer: ResizeObserver | null = null;
  if (typeof ResizeObserver === 'function') {
    observer = new ResizeObserver((entries) => {
      const next = Math.floor(entries[0]?.contentRect.width ?? 0);
      if (next > 0 && next !== width) {
        width = next;
        draw();
      }
    });
    observer.observe(chartHost);
  }

  return {
    element: section,
    update(next) {
      state = next;
      syncReadout();
      moveSelection();
    },
    focusById(id) {
      const target = section.querySelector<HTMLElement>(`[data-focus-id="${id}"]`);
      if (target === null) return false;
      target.focus();
      return true;
    },
    dispose() {
      observer?.disconnect();
    },
  };
}
