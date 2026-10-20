/// <reference types="vite/client" />

export interface FontFaceSpec {
  family: 'Inter' | 'Geist' | 'Geist Mono';
  url: string;
}

const EXPECTED_FILES: ReadonlyArray<{ file: string; family: FontFaceSpec['family'] }> = [
  { file: 'Inter-Variable.woff2', family: 'Inter' },
  { file: 'Geist-Variable.woff2', family: 'Geist' },
  { file: 'GeistMono-Variable.woff2', family: 'Geist Mono' },
];

function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** Maps the bundled font files to their families, Inter first. Any other file is ignored. */
export function fontFacesFromGlob(record: Record<string, string>): FontFaceSpec[] {
  const faces: FontFaceSpec[] = [];
  for (const { file, family } of EXPECTED_FILES) {
    const key = Object.keys(record)
      .sort()
      .find((candidate) => baseName(candidate) === file);
    const url = key === undefined ? undefined : record[key];
    if (url !== undefined) faces.push({ family, url });
  }
  return faces;
}

/**
 * Registers the locally bundled Inter and Geist files, if present. The URLs come from the build's own asset
 * graph, so nothing is requested from another origin. With no files the system stacks stay in effect.
 */
export function registerLocalFonts(): void {
  const bundled = import.meta.glob<string>('../assets/fonts/*.woff2', { eager: true, query: '?url', import: 'default' });
  if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !('fonts' in document)) return;
  for (const { family, url } of fontFacesFromGlob(bundled)) {
    const face = new FontFace(family, `url("${url}")`, { weight: '100 900', style: 'normal', display: 'swap' });
    document.fonts.add(face);
    face.load().catch(() => undefined);
  }
}
