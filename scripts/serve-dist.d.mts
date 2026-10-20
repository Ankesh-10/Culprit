import type { Server } from 'node:http';

export type StaticResolution =
  | { kind: 'file'; relativePath: string; spaFallback: boolean }
  | { kind: 'reject'; status: 400 | 405 };

export const SECURITY_HEADERS: Readonly<Record<string, string>>;

export function contentTypeFor(relativePath: string): string;

export function resolveStaticRequest(rawUrl: string, method: string): StaticResolution;

export function createStaticServer(rootDir: string): Server;

export function runSmoke(rootDir: string): Promise<{ failures: number; lines: string[] }>;
