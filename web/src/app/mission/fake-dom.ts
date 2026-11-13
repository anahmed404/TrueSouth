/**
 * Just enough of a DOM for React to mount into, in Node, for tests of the shell's parts.
 * The repo has no browser test suite (AGENTS.md); this lets a test count renders and call a
 * button's own handler through the props React keeps on each node.
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
  setAttribute() {}
  removeAttribute() {}
  getAttribute() {
    return null;
  }
  querySelector() {
    return null;
  }
  closest() {
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
  focus() {}
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

/** Installs the fake document and window globals. Returns the document. */
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
  host.requestAnimationFrame ??= (callback: () => void) => setTimeout(callback, 0);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  return document;
}

/** Every node under `root`, depth first. */
export function allNodes(root: FakeNode): FakeNode[] {
  return [root, ...root.childNodes.flatMap(allNodes)];
}

/** The props React last rendered onto a node. */
export function propsOf(node: FakeNode): Record<string, unknown> {
  const key = Object.keys(node).find((name) => name.startsWith("__reactProps$"));
  return key ? ((node as unknown as Record<string, Record<string, unknown>>)[key] ?? {}) : {};
}

/** The text a node shows. */
export function textOf(node: FakeNode): string {
  if (node.nodeType === 3) return node.nodeValue;
  if (node.childNodes.length === 0) return node.textContent;
  return node.childNodes.map(textOf).join("");
}

/** The buttons under `root` whose accessible name (aria-label, else text) is `name`. */
export function buttons(root: FakeNode, name: string): FakeNode[] {
  return allNodes(root).filter((node) => {
    if (node.nodeName !== "BUTTON") return false;
    const label = propsOf(node)["aria-label"];
    return (typeof label === "string" ? label : textOf(node).trim()) === name;
  });
}

/** Calls a button's click handler, as a click would. */
export function click(node: FakeNode): void {
  const onClick = propsOf(node).onClick;
  if (typeof onClick === "function") onClick({ preventDefault() {}, stopPropagation() {} });
}
