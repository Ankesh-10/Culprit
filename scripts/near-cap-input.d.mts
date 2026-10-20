export interface NearCapParameters {
  readonly startUtcMs: number;
  readonly bucketMs: number;
  readonly baselineBuckets: number;
  readonly spikeBuckets: number;
  readonly errorsPerSpikeBucket: number;
  readonly commitCount: number;
  readonly commitSpacingMs: number;
  readonly minLogBytes: number;
  readonly maxLogBytes: number;
  readonly maxHistoryBytes: number;
  readonly targetLogBytes: number;
}

export interface NearCapExpected {
  leadingSha: string;
  eventCount: number;
  bucketCount: number;
  commitCount: number;
  logBytes: number;
  historyBytes: number;
}

export const NEAR_CAP: NearCapParameters;

export function buildNearCapInput(): { logText: string; historyText: string; expected: NearCapExpected };
