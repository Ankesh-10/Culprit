import type { AnalysisStream, ConfidenceBand } from '../core/model';
import { toAnalysisResult } from '../core/pipeline';

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
