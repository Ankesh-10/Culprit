import { describe, expect, it } from 'vitest';
import config from '../../vite.config';
import { SECURITY_HEADERS } from '../../scripts/serve-dist.mjs';

describe('npm run preview security headers', () => {
  it('sends the same headers as the production static server', () => {
    expect(config.preview?.headers).toEqual({ ...SECURITY_HEADERS });
  });

  it('forbids network access from the page', () => {
    const policy = String(config.preview?.headers?.['Content-Security-Policy']);
    expect(policy).toContain("connect-src 'none'");
    expect(policy).toContain("default-src 'none'");
  });
});
