/** Text-only DOM construction: values reach the page as text nodes or attributes, never as markup. */

export const SVG_NS = 'http://www.w3.org/2000/svg';

export type Child = Node | string;

export interface ElOptions {
  className?: string;
  text?: string;
  attrs?: Record<string, string>;
  on?: Partial<{ [K in keyof HTMLElementEventMap]: (event: HTMLElementEventMap[K]) => void }>;
}

function appendChildren(parent: Element, children: readonly Child[] | undefined): void {
  if (children === undefined) return;
  for (const child of children) {
    parent.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElOptions = {},
  children?: readonly Child[],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className !== undefined) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.attrs !== undefined) {
    for (const [name, value] of Object.entries(options.attrs)) node.setAttribute(name, value);
  }
  if (options.on !== undefined) {
    for (const [name, listener] of Object.entries(options.on)) {
      node.addEventListener(name, listener as EventListener);
    }
  }
  appendChildren(node, children);
  return node;
}

export function svgEl(
  tag: string,
  attrs: Record<string, string> = {},
  children?: readonly Child[],
): SVGElement {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  appendChildren(node, children);
  return node as SVGElement;
}

export function clear(node: Node): void {
  while (node.firstChild !== null) node.removeChild(node.firstChild);
}

export function icon(name: string, className?: string): SVGElement {
  const use = svgEl('use', { href: `#icon-${name}` });
  const attrs: Record<string, string> = { 'aria-hidden': 'true', focusable: 'false', width: '16', height: '16' };
  if (className !== undefined) attrs['class'] = className;
  return svgEl('svg', attrs, [use]);
}
