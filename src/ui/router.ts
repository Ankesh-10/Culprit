/**
 * Hash router for the two views of the single page: the landing view at `#/` (also the empty hash) and the
 * console at `#/app`. The pure parts (parseHash, routeHash and the tables) have no DOM access. mountRouter
 * toggles the two view containers, keeps the document title and the current-page marks in step, and on a
 * navigation moves focus to the new view's heading. The hash text is only ever read: it is never written to
 * the DOM or the title, and a fragment is resolved with getElementById, never a selector string.
 */

export type Route = 'landing' | 'app';

export type HashTarget = { kind: 'route'; route: Route } | { kind: 'fragment'; id: string };

export const ROUTE_TITLES: Readonly<Record<Route, string>> = {
  landing: 'Culprit: find the commit that broke it',
  app: 'Culprit — Incident analysis',
};

export const ROUTE_ANNOUNCEMENTS: Readonly<Record<Route, string>> = {
  landing: 'Home page',
  app: 'Console',
};

export const ROUTE_HEADING_IDS: Readonly<Record<Route, string>> = {
  landing: 'landing-title',
  app: 'input-title',
};

export const ROUTE_VIEW_IDS: Readonly<Record<Route, string>> = {
  landing: 'view-landing',
  app: 'view-app',
};

const ROUTES: readonly Route[] = ['landing', 'app'];

export function routeHash(route: Route): string {
  return route === 'app' ? '#/app' : '#/';
}

function decodeFragment(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** An allow-list: `#/app` (with or without a trailing slash) is the console, every other `#/...` is the landing. */
export function parseHash(hash: string): HashTarget {
  if (hash === '' || hash === '#') return { kind: 'route', route: 'landing' };
  if (hash.startsWith('#/')) {
    return { kind: 'route', route: hash === '#/app' || hash === '#/app/' ? 'app' : 'landing' };
  }
  if (hash.startsWith('#')) return { kind: 'fragment', id: decodeFragment(hash.slice(1)) };
  return { kind: 'route', route: 'landing' };
}

export interface Router {
  current(): Route;
  navigate(route: Route): void;
}

export interface RouterOptions {
  /** Called whenever a view becomes the visible one (also once at start-up with cause 'initial'). */
  onEnter(route: Route, cause: 'initial' | 'navigate'): void;
}

export function mountRouter(doc: Document, options: RouterOptions): Router {
  const win = doc.defaultView;
  if (win === null) throw new Error('Router needs a window');
  const status = doc.getElementById('route-status');
  let current: Route | null = null;

  function viewOf(route: Route): HTMLElement | null {
    return doc.getElementById(ROUTE_VIEW_IDS[route]);
  }

  /** A fragment belongs to the view that contains its target; an unknown fragment keeps the current view. */
  function resolve(hash: string): Route {
    const target = parseHash(hash);
    if (target.kind === 'route') return target.route;
    const node = doc.getElementById(target.id);
    if (node !== null) {
      for (const route of ROUTES) {
        if (viewOf(route)?.contains(node) === true) return route;
      }
    }
    return current ?? 'landing';
  }

  function apply(route: Route, cause: 'initial' | 'navigate'): void {
    if (route === current && cause === 'navigate') return;
    current = route;
    for (const candidate of ROUTES) {
      const view = viewOf(candidate);
      if (view !== null) view.hidden = candidate !== route;
    }
    doc.title = ROUTE_TITLES[route];
    for (const link of Array.from(doc.querySelectorAll<HTMLElement>('a[data-route]'))) {
      if (link.dataset['route'] === route) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    options.onEnter(route, cause);
    if (cause === 'navigate') {
      win?.scrollTo(0, 0);
      doc.getElementById(ROUTE_HEADING_IDS[route])?.focus({ preventScroll: true });
      if (status !== null) status.textContent = ROUTE_ANNOUNCEMENTS[route];
    }
  }

  win.addEventListener('hashchange', () => apply(resolve(win.location.hash), 'navigate'));
  apply(resolve(win.location.hash), 'initial');

  return {
    current: () => current ?? 'landing',
    navigate(route: Route): void {
      apply(route, 'navigate');
      const hash = routeHash(route);
      if (win.location.hash !== hash) win.location.hash = hash;
    },
  };
}
