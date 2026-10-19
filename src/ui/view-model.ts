import type { AnalysisStream, ConfidenceBand } from '../core/model';
import { toAnalysisResult } from '../core/pipeline';
import type { PageState } from './state';

export type ResultKind = 'completed' | 'low-confidence' | 'no-incident' | 'insufficient-data' | 'no-eligible-commits';

export const STANDING_CAVEAT = 'Ranked suspicion from log timing and stack evidence. Verify the diff before acting.';

export function deriveResultKind(stream: AnalysisStream): ResultKind {
  const onsetClass = stream.onset.class;
  if (onsetClass === 'none') return 'no-incident';
  if (onsetClass === 'insufficient-data') return 'insufficient-data';
  const { status, confidence } = stream.ranking;
  if (status === 'no-onset') return 'no-incident';
  if (status === 'no-eligible-commits') return 'no-eligible-commits';
  if (confidence.band === 'low' || confidence.labels.length > 0) return 'low-confidence';
  return 'completed';
}

export interface VerdictView {
  heading: string;
  confidence: {
    band: ConfidenceBand;
    filled: number;
    text: string;
    ariaLabel: string;
  };
  headline: {
    mode: 'suspect' | 'no-clear-culprit';
    shortSha: string;
    subject: string;
  };
  interpretation: string;
  caveat: string;
}

const FILLED: Record<ConfidenceBand, number> = { high: 3, medium: 2, low: 1 };
const BAND_WORD: Record<ConfidenceBand, string> = { high: 'High', medium: 'Medium', low: 'Low' };

export function buildVerdictView(stream: AnalysisStream): VerdictView | null {
  const kind = deriveResultKind(stream);
  if (kind === 'no-incident' || kind === 'insufficient-data' || kind === 'no-eligible-commits') return null;
  const leading = stream.ranking.suspects[0];
  if (leading === undefined) return null;
  const { band, labels } = stream.ranking.confidence;
  const filled = FILLED[band];
  return {
    heading: 'Most likely suspect',
    confidence: {
      band,
      filled,
      text: `Ranking confidence: ${BAND_WORD[band]}`,
      ariaLabel: `Ranking confidence: ${band}, ${filled} of 3`,
    },
    headline: {
      mode: labels.includes('no-clear-culprit') ? 'no-clear-culprit' : 'suspect',
      shortSha: leading.shortSha,
      subject: leading.subject,
    },
    interpretation: toAnalysisResult(stream).incident.interpretation,
    caveat: STANDING_CAVEAT,
  };
}

export type StatusIcon = 'info' | 'loader' | 'x-circle' | 'alert-triangle' | 'check-circle';
export type StatusTone = 'neutral' | 'good' | 'warning' | 'critical';

export interface StatusView {
  icon: StatusIcon;
  tone: StatusTone;
  /** Visible banner text; null while a quick load has not yet crossed the banner delay. */
  label: string | null;
  /** Text for the polite live region. */
  announcement: string;
  warningChip: string | null;
}

export interface StatePanel {
  heading: string;
  body: string;
}

export const ERROR_HEADING = "We couldn't analyze these inputs";
export const ERROR_BODY =
  'Nothing was uploaded and nothing changed. Fix the item below and analyze again, or load a bundled incident to compare formats.';
export const LOADING_LABEL = 'Analyzing locally...';

export const EMPTY_STATE: StatePanel = {
  heading: 'Load an incident to see which commits to check first',
  body: 'Choose a bundled case to see Culprit work in seconds, or add your own log and git history. Everything stays in this browser.',
};

const STATE_PANELS: Record<'no-incident' | 'insufficient-data' | 'no-eligible-commits', StatePanel> = {
  'no-incident': {
    heading: 'No incident detected',
    body: "The log shows no sustained rise in errors, so there is no onset to trace back from. Culprit doesn't rank commits without one. Check that your log covers the failure window.",
  },
  'insufficient-data': {
    heading: 'Not enough data to find an onset.',
    body: 'The log has too few errors or too short a time span. Add more of the log from before and during the failure.',
  },
  'no-eligible-commits': {
    heading: 'No commits before the onset.',
    body: 'Every supplied commit landed after the onset window started, so none can be ranked as a suspect. Add earlier history to compare.',
  },
};

export function buildStatePanel(stream: AnalysisStream): StatePanel | null {
  const kind = deriveResultKind(stream);
  if (kind === 'no-incident' || kind === 'insufficient-data' || kind === 'no-eligible-commits') {
    return STATE_PANELS[kind];
  }
  return null;
}

function warningChip(stream: AnalysisStream): string | null {
  const count = stream.warnings.length;
  if (count > 0) return count === 1 ? '1 warning' : `${count} warnings`;
  return stream.limits.truncated ? 'Input truncated' : null;
}

function doneStatus(stream: AnalysisStream): StatusView {
  const kind = deriveResultKind(stream);
  const chip = warningChip(stream);
  const leading = stream.ranking.suspects[0];
  const sha = leading?.shortSha ?? '';
  const band = stream.ranking.confidence.band;
  switch (kind) {
    case 'completed':
      return {
        icon: 'check-circle',
        tone: 'good',
        label: 'Analysis complete',
        announcement: `Analysis complete. Top suspect ${sha}, ${band} ranking confidence.`,
        warningChip: chip,
      };
    case 'low-confidence':
      return {
        icon: 'alert-triangle',
        tone: 'warning',
        label: 'Low confidence — treat as leads, not a diagnosis',
        announcement: `Analysis complete with ${band} ranking confidence. Leading candidate ${sha}; treat it as a lead, not a diagnosis.`,
        warningChip: chip,
      };
    case 'no-incident':
      return { icon: 'info', tone: 'neutral', label: 'No incident detected', announcement: 'No incident detected.', warningChip: chip };
    case 'insufficient-data':
      return {
        icon: 'info',
        tone: 'neutral',
        label: 'Not enough data to find an onset',
        announcement: 'Not enough data to find an onset.',
        warningChip: chip,
      };
    case 'no-eligible-commits':
      return {
        icon: 'alert-triangle',
        tone: 'warning',
        label: 'No commits before the onset',
        announcement: 'No commits before the onset.',
        warningChip: chip,
      };
  }
}

export function buildStatusView(state: PageState): StatusView {
  switch (state.phase) {
    case 'idle':
      return { icon: 'info', tone: 'neutral', label: 'Ready — no incident loaded', announcement: '', warningChip: null };
    case 'loading':
      return {
        icon: state.showBanner ? 'loader' : 'info',
        tone: 'neutral',
        label: state.showBanner ? LOADING_LABEL : null,
        announcement: 'Analyzing incident.',
        warningChip: null,
      };
    case 'error':
      return { icon: 'x-circle', tone: 'critical', label: ERROR_HEADING, announcement: `${ERROR_HEADING}.`, warningChip: null };
    case 'done':
      return doneStatus(state.stream);
  }
}
