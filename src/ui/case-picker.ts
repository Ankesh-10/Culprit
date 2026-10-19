import type { BundledCase } from './cases';

export function patternChip(onsetClass: string): string {
  void onsetClass;
  throw new Error('not implemented');
}

export interface CasePickerOptions {
  cases: readonly BundledCase[];
  loadedId: string | null;
  hasResult: boolean;
  sparklines: ReadonlyMap<string, readonly number[]>;
  onLoad(id: string): void;
}

export function renderCasePicker(container: HTMLElement, options: CasePickerOptions): void {
  void container;
  void options;
  throw new Error('not implemented');
}
