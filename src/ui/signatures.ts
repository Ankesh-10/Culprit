import { clear, el, icon } from './dom';
import type { InvestigationEvent, SignatureRow, SignatureTableView } from './investigation-model';

export interface SignaturesHandlers {
  /** `openerId` names the control that caused a log panel open so focus can return to it on close. */
  onEvent(event: InvestigationEvent, openerId: string | null): void;
}

export interface SignaturesPanel {
  element: HTMLElement;
  /** Re-applies the pressed state in place so a focused toggle keeps focus. */
  update(view: SignatureTableView): void;
  focusById(id: string): boolean;
}

const COLUMNS = ['Signature', 'Events', 'First seen', 'Action'] as const;

export function signatureFocusId(index: number): string {
  return `sig-${index}`;
}

interface RowParts {
  row: HTMLElement;
  button: HTMLButtonElement;
  label: HTMLElement;
  iconSlot: HTMLElement;
}

/** Signature text reaches the page only as text nodes and attribute values. */
export function renderSignatures(view: SignatureTableView, handlers: SignaturesHandlers): SignaturesPanel {
  const heading = el('h2', { text: 'Error signatures', attrs: { id: 'signatures-title' } });
  const section = el('section', { className: 'panel signatures', attrs: { 'aria-labelledby': 'signatures-title' } }, [heading]);
  const body = el('tbody');
  const table = el('table', { className: 'signatures-table' }, [
    el('thead', {}, [
      el(
        'tr',
        {},
        COLUMNS.map((name) => el('th', { text: name, attrs: { scope: 'col' } })),
      ),
    ]),
    body,
  ]);
  section.append(
    el('div', { className: 'table-scroll', attrs: { role: 'region', 'aria-label': 'Error signatures', tabindex: '0' } }, [table]),
  );

  let current: readonly SignatureRow[] = view.rows;
  const parts: RowParts[] = [];

  function apply(index: number, data: SignatureRow): void {
    const part = parts[index];
    if (part === undefined) return;
    part.row.classList.toggle('is-pressed', data.pressed);
    part.button.setAttribute('aria-pressed', data.pressed ? 'true' : 'false');
    part.button.setAttribute('aria-label', `${data.actionLabel}: ${data.signature}`);
    part.label.textContent = data.actionLabel;
    clear(part.iconSlot);
    if (data.pressed) part.iconSlot.append(icon('check', 'icon toggle-check'));
  }

  function activate(index: number): void {
    const data = current[index];
    if (data === undefined) return;
    const opener = signatureFocusId(index);
    if (data.pressed) {
      handlers.onEvent({ type: 'set-filter', signature: null }, opener);
      return;
    }
    handlers.onEvent({ type: 'set-filter', signature: data.signature }, null);
    handlers.onEvent({ type: 'open-log-lines', scope: 'signature' }, opener);
  }

  if (view.emptyText !== null) {
    body.append(
      el('tr', {}, [el('td', { className: 'signatures-empty', text: view.emptyText, attrs: { colspan: String(COLUMNS.length) } })]),
    );
  } else {
    view.rows.forEach((data, index) => {
      const label = el('span', { text: data.actionLabel });
      const iconSlot = el('span', { className: 'toggle-icon' });
      const button = el(
        'button',
        {
          className: 'button-secondary signature-toggle',
          attrs: { type: 'button', 'aria-pressed': 'false', 'data-focus-id': signatureFocusId(index) },
          on: { click: () => activate(index) },
        },
        [iconSlot, label],
      );
      const row = el('tr', {}, [
        el('th', { className: 'signature-cell', attrs: { scope: 'row', 'aria-label': data.accessibleName } }, [
          el('span', { className: 'signature-name', text: data.signature }),
          el('span', { className: 'signature-message', text: data.representativeMessage }),
        ]),
        el('td', { className: 'col-number', text: String(data.count) }),
        el('td', { className: 'col-mono', text: data.firstSeen, attrs: { title: data.firstSeenTitle } }),
        el('td', {}, [button]),
      ]);
      parts.push({ row, button, label, iconSlot });
      body.append(row);
      apply(index, data);
    });
  }

  return {
    element: section,
    update(next) {
      current = next.rows;
      next.rows.forEach((data, index) => apply(index, data));
    },
    focusById(id) {
      const target = section.querySelector<HTMLElement>(`[data-focus-id="${id}"]`);
      if (target === null) return false;
      target.focus();
      return true;
    },
  };
}
