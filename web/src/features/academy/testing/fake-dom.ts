/**
 * Test helper: just enough of a DOM for React to mount into, in Node (as in
 * features/panorama/renders.test.ts), with attributes recorded so a test can read aria text.
 * Imported by tests only.
 */

export class FakeNode {
  childNodes: FakeNode[] = [];
  parentNode: FakeNode | null = null;
  ownerDocument: FakeNode | null = null;
  style: Record<string, string> = {};
  nodeValue = "";
  textContent = "";
  constructor(
    readonly nodeType: number,
    readonly nodeName: string,
  ) {}
  get tagName() {
    return this.nodeName;
  }
  get firstChild(): FakeNode | null {
    return this.childNodes[0] ?? null;
  }
  addEventListener() {}
  removeEventListener() {}
  attributes: Record<string, string> = {};
  setAttribute(name: string, value: string) {
    this.attributes[name] = String(value);
  }
  removeAttribute(name: string) {
    delete this.attributes[name];
  }
  getAttribute(name: string) {
    return this.attributes[name] ?? null;
  }
  querySelector() {
    return null;
  }
  appendChild(child: FakeNode) {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }
  removeChild(child: FakeNode) {
    this.childNodes = this.childNodes.filter((node) => node !== child);
    return child;
  }
  insertBefore(child: FakeNode, before: FakeNode | null) {
    if (!before) return this.appendChild(child);
    child.parentNode = this;
    this.childNodes.splice(Math.max(0, this.childNodes.indexOf(before)), 0, child);
    return child;
  }
  contains(other: FakeNode | null): boolean {
    for (let node = other; node; node = node.parentNode) if (node === this) return true;
    return false;
  }
  createElement(tag: string) {
    const node = new FakeNode(1, tag.toUpperCase());
    node.ownerDocument = this;
    return node;
  }
  createElementNS(_namespace: string, tag: string) {
    return this.createElement(tag);
  }
  createTextNode(text: string) {
    const node = new FakeNode(3, "#text");
    node.nodeValue = text;
    node.ownerDocument = this;
    return node;
  }
  createComment(text: string) {
    const node = new FakeNode(8, "#comment");
    node.nodeValue = text;
    return node;
  }
}

export function installDocument(): FakeNode {
  const document = new FakeNode(9, "#document");
  document.ownerDocument = document;
  const host = globalThis as unknown as Record<string, unknown>;
  host.document = Object.assign(document, {
    documentElement: document.createElement("html"),
    body: document.createElement("body"),
    head: document.createElement("head"),
    activeElement: null,
    defaultView: globalThis,
  });
  host.window = globalThis;
  host.HTMLElement = class {};
  host.HTMLIFrameElement = class {};
  host.Element = class {};
  host.Node = class {};
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  return document;
}


/** The text and the aria labels under a node, joined with spaces. */
export function readAll(node: FakeNode): string {
  const parts: string[] = [];
  const walk = (current: FakeNode) => {
    if (current.nodeType === 3) parts.push(current.nodeValue);
    for (const name of ["aria-label", "aria-valuetext"]) {
      const value = current.attributes[name];
      if (value) parts.push(value);
    }
    if (current.textContent && current.childNodes.length === 0 && current.nodeType === 1) parts.push(current.textContent);
    for (const child of current.childNodes) walk(child);
  };
  walk(node);
  return parts.join(" ").replace(/\s+/g, " ");
}
