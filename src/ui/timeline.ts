import type { AnalysisStream } from '../core/model';
import { clear, el, svgEl } from './dom';
import { formatCompactCount } from './format';
import { buildReadout, buildTableTwinRows, investigationContext } from './investigation-model';
import type { InvestigationEvent, InvestigationState } from './investigation-model';
import {
  bucketCenters,
  bucketIndexFromX,
  buildPlotGeometry,
  clampLabelX,
  commitMarkers,
  computeDomain,
  computeTicks,
  createXScale,
  domainNote,
  estimateLabelWidth,
  onsetBand,
  resolveLabels,
  yForValue,
} from './timeline-geometry';
import type { CommitMarker, LabelCandidate, TimelineDomain, XScale } from './timeline-geometry';

export interface TimelineHandlers {
  /** `openerId` names the control that caused an open so focus can return to it on close. */
  onEvent(event: InvestigationEvent, openerId: string | null): void;
}

export interface TimelineView {
  element: HTMLElement;
  /** Updates the selection, readout, slider and table twin in place so focus and disclosure state survive. */
  update(state: InvestigationState): void;
  focusById(id: string): boolean;
  dispose(): void;
}

const DEFAULT_WIDTH = 960;
const PAD_LEFT = 36;
const PAD_RIGHT = 12;
const PAD_TOP = 28;
const LANE_HEIGHT = 48;
const AXIS_HEIGHT = 44;
const LABEL_HEIGHT = 18;
const LABEL_FONT_PADDING = 4;
const NONE = '—';
const SEPARATOR = ' · ';

export const SLIDER_FOCUS_ID = 'slider';
export const READOUT_FOCUS_ID = 'readout-log';

function viewportWidth(fallback: number): number {
  return typeof window === 'undefined' ? fallback : window.innerWidth;
}

function plotHeightFor(viewport: number): number {
  return viewport < 640 ? 128 : 160;
}

function tickCountFor(viewport: number): number {
  if (viewport >= 1024) return 6;
  if (viewport >= 640) return 4;
  return 3;
}

function bucketMinutes(stream: AnalysisStream): number {
  const first = stream.timeline[0];
  if (first === undefined) return 0;
  return Math.round((Date.parse(first.bucketEndUtc) - Date.parse(first.bucketStartUtc)) / 60_000);
}

function eligibleShas(stream: AnalysisStream): Set<string> {
  return new Set(stream.ranking.considered.filter((row) => row.status !== 'excluded').map((row) => row.sha));
}

function diamondPoints(cx: number, cy: number, size: number): string {
  const half = size / 2;
  return `${cx},${cy - half} ${cx + half},${cy} ${cx},${cy + half} ${cx - half},${cy}`;
}

function legendKey(kind: 'line' | 'band' | 'leading' | 'other'): SVGElement {
  const attrs = { class: 'legend-key', width: '24', height: '16', viewBox: '0 0 24 16', 'aria-hidden': 'true', focusable: 'false' };
  switch (kind) {
    case 'line':
      return svgEl('svg', attrs, [svgEl('line', { class: 'series-line', x1: '1', x2: '23', y1: '8', y2: '8' })]);
    case 'band':
      return svgEl('svg', attrs, [
        svgEl('rect', { class: 'onset-band', x: '1', y: '1', width: '22', height: '14' }),
        svgEl('line', { class: 'onset-bracket', x1: '1', x2: '23', y1: '1', y2: '1' }),
      ]);
    case 'leading':
      return svgEl('svg', attrs, [svgEl('polygon', { class: 'marker-leading', points: diamondPoints(12, 8, 14) })]);
    case 'other':
      return svgEl('svg', attrs, [svgEl('polygon', { class: 'marker-other', points: diamondPoints(12, 8, 10) })]);
  }
}

function renderLegend(): HTMLElement {
  const entries: Array<['line' | 'band' | 'leading' | 'other', string]> = [
    ['line', 'Errors per interval'],
    ['band', 'Onset window'],
    ['leading', 'Leading suspect'],
    ['other', 'Other commits'],
  ];
  return el(
    'ul',
    { className: 'chart-legend' },
    entries.map(([kind, text]) => el('li', {}, [legendKey(kind), el('span', { text })])),
  );
}

interface ChartLayout {
  scale: XScale;
  centers: number[];
  xs: number[];
  ys: number[];
  plotWidth: number;
  plotHeight: number;
  crosshair: SVGElement;
  ring: SVGElement;
  hoverLine: SVGElement;
}

function emptyView(section: HTMLElement): TimelineView {
  section.append(el('p', { className: 'timeline-empty', text: 'No error intervals to plot.' }));
  return { element: section, update: () => undefined, focusById: () => false, dispose: () => undefined };
}

export function renderTimeline(stream: AnalysisStream, initial: InvestigationState, handlers: TimelineHandlers): TimelineView {
  const minutes = bucketMinutes(stream);
  const heading = el('h2', { text: 'Timeline', attrs: { id: 'timeline-title', tabindex: '-1' } });
  const section = el('section', { className: 'panel timeline', attrs: { 'aria-labelledby': 'timeline-title' } });

  const domain: TimelineDomain | null = computeDomain(stream.timeline, stream.commits, eligibleShas(stream));
  if (domain === null) {
    section.append(el('div', { className: 'timeline-header' }, [heading]));
    return emptyView(section);
  }

  const context = investigationContext(stream);
  const values = stream.timeline.map((point) => point.errorCount);
  const yMax = values.reduce((max, value) => Math.max(max, value), 1);
  const peakValue = values[context.peakIndex] ?? 0;

  let state = initial;
  let width = DEFAULT_WIDTH;
  let layout: ChartLayout | null = null;
  let renderedTableVisible = -1;

  const jumpOnset = el('button', {
    className: 'button-secondary',
    text: 'Jump to onset',
    attrs: { type: 'button', 'data-focus-id': 'jump-onset' },
    on: { click: () => handlers.onEvent({ type: 'jump', target: 'onset' }, null) },
  });
  if (context.onsetIndex === null) jumpOnset.disabled = true;
  const jumpPeak = el('button', {
    className: 'button-secondary',
    text: 'Jump to peak',
    attrs: { type: 'button', 'data-focus-id': 'jump-peak' },
    on: { click: () => handlers.onEvent({ type: 'jump', target: 'peak' }, null) },
  });
  const header = el('div', { className: 'timeline-header' }, [
    heading,
    el('div', { className: 'timeline-toolbar' }, [jumpOnset, jumpPeak]),
  ]);

  const title = el('p', { className: 'chart-title', text: `Errors per ${minutes}-minute interval (UTC)` });
  const legend = renderLegend();
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
  const tooltip = el('div', { className: 'chart-tooltip', attrs: { 'aria-hidden': 'true' } });
  tooltip.hidden = true;
  chartHost.append(slider, tooltip);

  const note = domainNote(domain);
  const noteLine = note === null ? null : el('p', { className: 'domain-note', text: note });

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

  // Table twin: the non-pointer equivalent of every value on the chart.
  const twinBody = el('tbody');
  const twinCount = el('p', { className: 'log-count' });
  const twinMore = el('button', {
    className: 'button-secondary',
    text: 'Show next 100',
    attrs: { type: 'button', 'data-focus-id': 'table-more' },
    on: { click: () => handlers.onEvent({ type: 'show-more-table-rows' }, null) },
  });
  const twinScroll = el('div', { className: 'table-scroll', attrs: { role: 'region', 'aria-label': 'Timeline data table', tabindex: '0', 'data-focus-id': 'table-scroll' } }, [
    el('table', { className: 'twin-table' }, [
      el('thead', {}, [
        el(
          'tr',
          {},
          ['Interval (UTC)', 'Errors', 'Signatures', 'Onset window', 'Commits', 'Log lines'].map((name) =>
            el('th', { text: name, attrs: { scope: 'col' } }),
          ),
        ),
      ]),
      twinBody,
    ]),
  ]);
  const twin = el('details', { className: 'table-twin' }, [
    el('summary', { text: 'Timeline data table', attrs: { 'data-focus-id': 'table-summary' } }),
    twinScroll,
    twinCount,
    twinMore,
  ]);

  function renderTwinRows(): void {
    const view = buildTableTwinRows(stream, state);
    clear(twinBody);
    for (const row of view.rows) {
      const open = el('button', {
        className: 'button-secondary',
        text: 'Show log lines',
        attrs: { type: 'button', 'aria-label': `Show log lines for ${row.interval}`, 'data-focus-id': `row-${row.index}` },
        on: {
          click: () => {
            handlers.onEvent({ type: 'select', index: row.index }, null);
            handlers.onEvent({ type: 'open-log-lines' }, `row-${row.index}`);
          },
        },
      });
      twinBody.append(
        el('tr', { attrs: { 'data-index': String(row.index) } }, [
          el('td', { className: 'col-mono', text: row.interval }),
          el('td', { className: 'col-number', text: String(row.errors) }),
          el('td', { className: 'col-number', text: String(row.signatures) }),
          el('td', { text: row.onset }),
          el('td', { className: 'col-mono', text: row.commits }),
          el('td', {}, [open]),
        ]),
      );
    }
    twinCount.textContent = `Showing ${view.rows.length} of ${view.total}`;
    const hadFocus = document.activeElement === twinMore;
    twinMore.hidden = !view.hasMore;
    if (hadFocus && !view.hasMore) twinScroll.focus();
    renderedTableVisible = state.tableVisible;
    markSelectedRow();
  }

  function markSelectedRow(): void {
    for (const row of Array.from(twinBody.children)) {
      const selected = row.getAttribute('data-index') === String(state.selectedIndex);
      row.classList.toggle('is-selected', selected);
      if (selected) row.setAttribute('aria-current', 'true');
      else row.removeAttribute('aria-current');
    }
  }

  function draw(): void {
    if (domain === null) return;
    const viewport = viewportWidth(width);
    const plotWidth = Math.max(80, width - PAD_LEFT - PAD_RIGHT);
    const plotHeight = plotHeightFor(viewport);
    const laneCenter = plotHeight + LANE_HEIGHT / 2;
    const scale = createXScale(domain, plotWidth);
    const centers = bucketCenters(stream.timeline);
    const xs = centers.map((center) => scale.toX(center));
    const ys = values.map((value) => yForValue(value, yMax, plotHeight));
    const geometry = buildPlotGeometry(stream.timeline, values, domain, plotWidth, plotHeight, yMax);

    const plot = svgEl('g', { transform: `translate(${PAD_LEFT} ${PAD_TOP})` });

    // Gridlines at 0, mid and max with compact y labels, then the baseline.
    const gridRows: Array<{ y: number; value: number }> = [
      { y: 0, value: yMax },
      { y: plotHeight / 2, value: yMax / 2 },
      { y: plotHeight, value: 0 },
    ];
    for (const row of gridRows) {
      if (row.y !== plotHeight) {
        plot.append(svgEl('line', { class: 'grid-line', x1: '0', x2: String(plotWidth), y1: String(row.y), y2: String(row.y) }));
      }
      plot.append(svgEl('text', { class: 'tick-label', x: '-8', y: String(row.y + 5), 'text-anchor': 'end' }, [formatCompactCount(row.value)]));
    }
    plot.append(svgEl('line', { class: 'axis-line', x1: '0', x2: String(plotWidth), y1: String(plotHeight), y2: String(plotHeight) }));

    // Onset band.
    const labelCandidates: LabelCandidate[] = [];
    const labelText = new Map<string, { text: string; className: string }>();
    const band = onsetBand(scale, stream.onset.windowStartUtc, stream.onset.windowEndUtc, plotWidth);
    if (band !== null) {
      plot.append(
        svgEl('rect', { class: 'onset-band', x: String(band.x), y: '0', width: String(band.width), height: String(plotHeight) }),
        svgEl('line', { class: 'onset-bracket', x1: String(band.x), x2: String(band.x + band.width), y1: '1', y2: '1' }),
      );
      labelCandidates.push({
        id: 'onset',
        priority: 0,
        x: band.x,
        y: -(LABEL_HEIGHT + 4),
        width: estimateLabelWidth('Onset window'),
        height: LABEL_HEIGHT,
      });
      labelText.set('onset', { text: 'Onset window', className: 'chart-label' });
    }

    // Series.
    plot.append(
      svgEl('path', { class: 'series-area', d: geometry.areaPath }),
      svgEl('path', { class: 'series-line', d: geometry.linePath }),
    );

    // Peak dot and label.
    if (peakValue > 0) {
      const px = xs[context.peakIndex];
      const py = ys[context.peakIndex];
      if (px !== undefined && py !== undefined) {
        plot.append(svgEl('circle', { class: 'peak-dot', cx: String(px), cy: String(py), r: '4' }));
        const text = `Peak ${peakValue}`;
        const labelWidth = estimateLabelWidth(text);
        labelCandidates.push({ id: 'peak', priority: 3, x: px - labelWidth / 2, y: py - 8 - LABEL_HEIGHT, width: labelWidth, height: LABEL_HEIGHT });
        labelText.set('peak', { text, className: 'chart-label' });
      }
    }

    // Selection marks and hover crosshair.
    const crosshair = svgEl('line', { class: 'crosshair', y1: '0', y2: String(plotHeight + LANE_HEIGHT) });
    const hoverLine = svgEl('line', { class: 'crosshair hover-crosshair', y1: '0', y2: String(plotHeight + LANE_HEIGHT), visibility: 'hidden' });
    const ring = svgEl('circle', { class: 'selected-ring', r: '5' });

    // Commit lane: leader, surface ring and mark per commit; the leading suspect is drawn last.
    const markers = commitMarkers(scale, domain, stream.commits, stream.ranking.suspects);
    const drawOrder = (marker: CommitMarker): number => (marker.kind === 'leading' ? 2 : marker.kind === 'ranked' ? 1 : 0);
    const laneMarks: SVGElement[] = [];
    for (const marker of [...markers].sort((a, b) => drawOrder(a) - drawOrder(b))) {
      if (marker.kind === 'leading') {
        laneMarks.push(
          svgEl('line', {
            class: 'leader',
            x1: String(marker.x),
            x2: String(marker.x),
            y1: String(plotHeight),
            y2: String(laneCenter - marker.size / 2),
          }),
        );
      }
      laneMarks.push(
        svgEl('polygon', { class: 'marker-ring', points: diamondPoints(marker.x, laneCenter, marker.size + 4) }),
        svgEl('polygon', {
          class: marker.kind === 'leading' ? 'marker-leading' : marker.kind === 'ranked' ? 'marker-ranked' : 'marker-other',
          points: diamondPoints(marker.x, laneCenter, marker.size),
          'data-sha': marker.shortSha,
        }),
      );
      if (marker.label !== null && marker.rank !== null) {
        const labelWidth = estimateLabelWidth(marker.label);
        const right = marker.x + marker.size / 2 + LABEL_FONT_PADDING;
        const x = right + labelWidth <= plotWidth ? right : marker.x - marker.size / 2 - LABEL_FONT_PADDING - labelWidth;
        const id = `rank-${marker.rank}`;
        labelCandidates.push({ id, priority: marker.rank === 1 ? 1 : 2, x, y: laneCenter - LABEL_HEIGHT / 2, width: labelWidth, height: LABEL_HEIGHT });
        labelText.set(id, { text: marker.label, className: marker.rank === 1 ? 'chart-label is-strong' : 'chart-label is-ink' });
      }
    }

    plot.append(...laneMarks, crosshair, hoverLine, ring);

    // Direct labels: only those that survive the priority and collision rules; markers always stay.
    const kept = resolveLabels(labelCandidates, plotWidth, { dropRankLabels: viewport < 640 });
    for (const candidate of labelCandidates) {
      const info = labelText.get(candidate.id);
      if (info === undefined || !kept.has(candidate.id)) continue;
      const x = clampLabelX(candidate.x, candidate.width, plotWidth) + LABEL_FONT_PADDING;
      plot.append(svgEl('text', { class: info.className, x: String(x), y: String(candidate.y + 14) }, [info.text]));
    }

    // X axis: UTC ticks under the commit lane and the axis title carrying the date once.
    const axisTop = plotHeight + LANE_HEIGHT;
    const { ticks, date } = computeTicks(domain, tickCountFor(viewport));
    ticks.forEach((tick, index) => {
      const anchor = index === 0 ? 'start' : index === ticks.length - 1 ? 'end' : 'middle';
      plot.append(svgEl('text', { class: 'tick-label', x: String(scale.toX(tick.ms)), y: String(axisTop + 16), 'text-anchor': anchor }, [tick.label]));
    });
    plot.append(svgEl('text', { class: 'tick-label axis-title', x: '0', y: String(axisTop + 36) }, [`${date}${SEPARATOR}Time, UTC`]));

    // The single pointer hit target.
    for (const rect of geometry.overlays) {
      const overlay = svgEl('rect', {
        class: 'pointer-overlay',
        x: String(rect.x),
        y: String(rect.y),
        width: String(rect.width),
        height: String(rect.height + LANE_HEIGHT),
      });
      overlay.addEventListener('click', (event) => {
        const box = overlay.getBoundingClientRect();
        const index = bucketIndexFromX(scale, stream.timeline, (event as MouseEvent).clientX - box.left, centers);
        handlers.onEvent({ type: 'select', index }, null);
      });
      overlay.addEventListener('pointermove', (event) => {
        const pointerEvent = event as PointerEvent;
        if (pointerEvent.pointerType === 'touch' || !isFinePointer()) return;
        const box = overlay.getBoundingClientRect();
        const index = bucketIndexFromX(scale, stream.timeline, pointerEvent.clientX - box.left, centers);
        showTooltip(index, xs[index] ?? 0, plotWidth);
      });
      overlay.addEventListener('pointerleave', hideTooltip);
      plot.append(overlay);
    }

    const defs = svgEl('defs', {}, [
      svgEl('pattern', { id: 'timeline-hatch', patternUnits: 'userSpaceOnUse', width: '6', height: '6', patternTransform: 'rotate(45)' }, [
        svgEl('line', { class: 'hatch-line', x1: '0', y1: '0', x2: '0', y2: '6' }),
      ]),
    ]);
    const svg = svgEl(
      'svg',
      {
        class: 'timeline-svg',
        width: String(width),
        height: String(PAD_TOP + plotHeight + LANE_HEIGHT + AXIS_HEIGHT),
        'aria-hidden': 'true',
        focusable: 'false',
      },
      [defs, plot],
    );
    clear(slider);
    slider.append(svg);
    layout = { scale, centers, xs, ys, plotWidth, plotHeight, crosshair, ring, hoverLine };
    moveSelection();
  }

  function isFinePointer(): boolean {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches;
  }

  function showTooltip(index: number, x: number, plotWidth: number): void {
    if (layout === null) return;
    const readout = buildReadout(stream, { ...state, selectedIndex: index });
    clear(tooltip);
    readout.text.split(SEPARATOR).forEach((part, line) => {
      tooltip.append(el('span', { className: line === 0 ? 'tooltip-line is-strong' : 'tooltip-line', text: part }));
    });
    tooltip.hidden = false;
    tooltip.classList.toggle('is-left', x > plotWidth / 2);
    tooltip.style.left = `${PAD_LEFT + x + (x > plotWidth / 2 ? -12 : 12)}px`;
    tooltip.style.top = `${PAD_TOP + 8}px`;
    layout.hoverLine.setAttribute('x1', String(x));
    layout.hoverLine.setAttribute('x2', String(x));
    layout.hoverLine.setAttribute('visibility', 'visible');
  }

  function hideTooltip(): void {
    tooltip.hidden = true;
    layout?.hoverLine.setAttribute('visibility', 'hidden');
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
  slider.addEventListener('blur', hideTooltip);

  section.append(header, title, legend, chartHost);
  if (noteLine !== null) section.append(noteLine);
  section.append(readoutBar, twin);

  syncReadout();
  renderTwinRows();
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
      if (state.tableVisible !== renderedTableVisible) renderTwinRows();
      else markSelectedRow();
    },
    focusById(id) {
      const target = section.querySelector<HTMLElement>(`[data-focus-id="${id}"]`);
      if (target === null) return false;
      if (id.startsWith('row-')) twin.open = true;
      target.focus();
      return true;
    },
    dispose() {
      observer?.disconnect();
    },
  };
}
