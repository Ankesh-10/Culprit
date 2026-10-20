import { tabKeyTarget } from './landing-model';

/**
 * Turns the static feature sections into a WAI-ARIA tabs widget: roving tabindex, automatic activation and
 * ArrowLeft/ArrowRight/Home/End. Without this module every panel is a plain section and stays readable.
 * Selecting a tab only toggles attributes and `hidden`; the panel fade is CSS, there is no timer, and
 * nothing here moves focus except in response to the user's own click or key press.
 */

export function mountFeatureTabs(root: HTMLElement): void {
  const tablist = root.querySelector<HTMLElement>('[data-tablist]');
  if (tablist === null) return;
  const tabs = Array.from(tablist.querySelectorAll<HTMLElement>('[data-tab]'));
  const panels = new Map<string, HTMLElement>();
  for (const panel of Array.from(root.querySelectorAll<HTMLElement>('[data-panel]'))) {
    const id = panel.dataset['panel'];
    if (id !== undefined) panels.set(id, panel);
  }
  if (tabs.length === 0 || panels.size === 0) return;

  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', 'Features');
  tablist.hidden = false;

  function select(index: number, moveFocus: boolean): void {
    tabs.forEach((tab, position) => {
      const selected = position === index;
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
      const panel = panels.get(tab.dataset['tab'] ?? '');
      if (panel !== undefined) panel.hidden = !selected;
    });
    if (moveFocus) tabs[index]?.focus();
  }

  tabs.forEach((tab, index) => {
    const id = tab.dataset['tab'] ?? '';
    const panel = panels.get(id);
    tab.setAttribute('role', 'tab');
    if (panel !== undefined) {
      tab.setAttribute('aria-controls', panel.id);
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tab.id);
      panel.tabIndex = 0;
    }
    tab.addEventListener('click', () => select(index, true));
    tab.addEventListener('keydown', (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = tabKeyTarget(index, event.key, tabs.length);
      if (target === null) return;
      event.preventDefault();
      select(target, true);
    });
  });

  select(0, false);
}
