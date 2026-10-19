/** Normalize an explicitly offset ISO-8601 timestamp to UTC without local-time fallbacks. */
export function normalizeTimestampUtc(value: string): string {
  const match = typeof value === 'string'
    ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value)
    : null;
  if (match === null) {
    throw new RangeError('Timestamp must be ISO-8601 with Z or an explicit numeric offset.');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || hour > 23 || minute > 59 || second > 59) {
    throw new RangeError('Timestamp contains an invalid calendar value.');
  }
  const offset = match[8] ?? '';
  if (offset !== 'Z') {
    const hours = Number(offset.slice(1, 3));
    const minutes = Number(offset.slice(4, 6));
    if (hours > 23 || minutes > 59) {
      throw new RangeError('Timestamp contains an invalid numeric offset.');
    }
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new RangeError('Timestamp is not a valid calendar date.');
  }
  return parsed.toISOString();
}

/** Convert whitespace runs to one space for stable message/source identities. */
export function canonicalWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Normalize a repository-relative path to the cross-platform POSIX identity. */
export function normalizeRepositoryPath(value: string): string {
  if (typeof value !== 'string') throw new TypeError('Repository path must be a string.');
  const normalized = value.replaceAll('\\', '/').replace(/^\.\//, '');
  if (
    normalized.length === 0 ||
    normalized === '.' ||
    normalized.startsWith('/') ||
    normalized.startsWith('//') ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.split('/').some((segment) => segment === '..')
  ) {
    throw new RangeError(`Repository path must be relative and traversal-free: ${value}`);
  }
  return normalized;
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonicalValue(record[key])]));
  }
  return value;
}

/** Produce a deterministic non-cryptographic ID from supplied canonical content only. */
export function stableSourceId(...content: unknown[]): string {
  const serialized = JSON.stringify(canonicalValue(content));
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `source-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
