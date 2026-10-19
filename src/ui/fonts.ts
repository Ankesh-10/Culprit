export interface FontFaceSpec {
  family: 'Geist' | 'Geist Mono';
  url: string;
}

export function fontFacesFromGlob(record: Record<string, string>): FontFaceSpec[] {
  void record;
  throw new Error('not implemented');
}

export function registerLocalFonts(): void {
  throw new Error('not implemented');
}
