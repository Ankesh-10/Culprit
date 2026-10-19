/// <reference types="vite/client" />
import type { AnalysisInput, OnsetClass } from '../core/model';

import checkoutLogs from '../../fixtures/incidents/checkout-outage/logs.jsonl?raw';
import checkoutHistory from '../../fixtures/incidents/checkout-outage/history.json?raw';
import checkoutManifest from '../../fixtures/incidents/checkout-outage/manifest.json';
import slowBurnLogs from '../../fixtures/incidents/slow-burn/logs.jsonl?raw';
import slowBurnHistory from '../../fixtures/incidents/slow-burn/history.json?raw';
import slowBurnManifest from '../../fixtures/incidents/slow-burn/manifest.json';
import ambiguousLogs from '../../fixtures/incidents/ambiguous/logs.jsonl?raw';
import ambiguousHistory from '../../fixtures/incidents/ambiguous/history.json?raw';
import ambiguousManifest from '../../fixtures/incidents/ambiguous/manifest.json';

export type BundledCaseId = 'checkout-outage' | 'slow-burn' | 'ambiguous';

export interface BundledCase {
  id: BundledCaseId;
  name: string;
  purpose: string;
  onsetClass: OnsetClass;
  logsText: string;
  historyText: string;
  logsSource: string;
  historySource: string;
}

interface FixtureManifest {
  name: string;
  purpose: string;
  expected: { onsetClass: string };
}

function bundle(id: BundledCaseId, manifest: FixtureManifest, logsText: string, historyText: string): BundledCase {
  return {
    id,
    name: manifest.name,
    purpose: manifest.purpose,
    onsetClass: manifest.expected.onsetClass as OnsetClass,
    logsText,
    historyText,
    logsSource: `fixtures/incidents/${id}/logs.jsonl`,
    historySource: `fixtures/incidents/${id}/history.json`,
  };
}

export const BUNDLED_CASES: readonly BundledCase[] = [
  bundle('checkout-outage', checkoutManifest, checkoutLogs, checkoutHistory),
  bundle('slow-burn', slowBurnManifest, slowBurnLogs, slowBurnHistory),
  bundle('ambiguous', ambiguousManifest, ambiguousLogs, ambiguousHistory),
];

export function findCase(id: string): BundledCase | undefined {
  return BUNDLED_CASES.find((entry) => entry.id === id);
}

export function toAnalysisInput(bundledCase: BundledCase): AnalysisInput {
  return {
    logs: { text: bundledCase.logsText, format: 'jsonl', source: bundledCase.logsSource },
    history: { text: bundledCase.historyText, format: 'culprit-json', source: bundledCase.historySource },
    options: null,
  };
}
