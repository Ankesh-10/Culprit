import { describe, expect, it } from 'vitest';
import { ROUTE_ANNOUNCEMENTS, ROUTE_HEADING_IDS, ROUTE_TITLES, ROUTE_VIEW_IDS, parseHash, routeHash } from '../../src/ui/router';
import type { Route } from '../../src/ui/router';

describe('parseHash', () => {
  it('treats an empty hash, a bare # and #/ as the landing route', () => {
    for (const hash of ['', '#', '#/']) expect(parseHash(hash)).toEqual({ kind: 'route', route: 'landing' });
  });

  it('maps #/app and #/app/ to the console route', () => {
    for (const hash of ['#/app', '#/app/']) expect(parseHash(hash)).toEqual({ kind: 'route', route: 'app' });
  });

  it('sends every other #/ address to the landing route', () => {
    for (const hash of ['#/APP', '#/settings', '#/app/extra', '#/appx']) {
      expect(parseHash(hash)).toEqual({ kind: 'route', route: 'landing' });
    }
  });

  it('reads other hashes as fragments and decodes them', () => {
    expect(parseHash('#result')).toEqual({ kind: 'fragment', id: 'result' });
    expect(parseHash('#timeline-title')).toEqual({ kind: 'fragment', id: 'timeline-title' });
    expect(parseHash('#a%20b')).toEqual({ kind: 'fragment', id: 'a b' });
  });

  it('never throws on malformed percent-encoding', () => {
    expect(parseHash('#%E0%A4%A')).toEqual({ kind: 'fragment', id: '%E0%A4%A' });
  });
});

describe('routeHash', () => {
  it('gives the canonical hashes and round-trips through parseHash', () => {
    expect(routeHash('landing')).toBe('#/');
    expect(routeHash('app')).toBe('#/app');
    for (const route of ['landing', 'app'] as const) {
      expect(parseHash(routeHash(route))).toEqual({ kind: 'route', route });
    }
  });
});

describe('route tables', () => {
  it('keeps the two document titles', () => {
    expect(ROUTE_TITLES.landing).toBe('Culprit: find the commit that broke it');
    expect(ROUTE_TITLES.app).toBe('Culprit \u2014 Incident analysis');
  });

  it('names the heading and view of each route', () => {
    expect(ROUTE_HEADING_IDS).toEqual({ landing: 'landing-title', app: 'input-title' });
    expect(ROUTE_VIEW_IDS).toEqual({ landing: 'view-landing', app: 'view-app' });
  });

  it('has a short, distinct announcement per route', () => {
    const routes: Route[] = ['landing', 'app'];
    const texts = routes.map((route) => ROUTE_ANNOUNCEMENTS[route]);
    for (const text of texts) expect(text.length).toBeGreaterThan(0);
    expect(new Set(texts).size).toBe(2);
  });
});
