/**
 * Test helper: just enough of a DOM for React to mount into, in Node (as in
 * features/panorama/renders.test.ts), with attributes recorded so a test can read aria text.
 * Imported by tests only.
 */

type FakeHandler = (event: FakeEvent) => void;
type FakeListener = { type: string; fn: FakeHandler; capture: boolean };

/** An event as React and the lesson screen read it. */
export type FakeEvent = Record<string, unknown> & {
  type: string;
  target: FakeNode;
  defaultPrevented: boolean;
  preventDefault(): void;
  stopPropagation(): void;
};

/** Listeners on `window`, which is `globalThis` here. */
const windowListeners: FakeListener[] = [];

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
  /** Listeners, so `dispatch` can run them: React listens on the root, the screen on window. */
  listeners: FakeListener[] = [];
  addEventListener(type: string, fn: FakeHandler, options?: boolean | { capture?: boolean }) {
    const capture = typeof options === "boolean" ? options : Boolean(options?.capture);
    this.listeners.push({ type, fn, capture });
  }
  removeEventListener(type: string, fn: FakeHandler, options?: boolean | { capture?: boolean }) {
    const capture = typeof options === "boolean" ? options : Boolean(options?.capture);
    this.listeners = this.listeners.filter((l) => !(l.type === type && l.fn === fn && l.capture === capture));
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, right: 0, bottom: 0, x: 0, y: 0, width: 0, height: 0 };
  }
  focus() {
    const doc = this.ownerDocument as (FakeNode & { activeElement?: FakeNode | null }) | null;
    if (doc) doc.activeElement = this;
  }
  blur() {}
  /** A `<dialog>`: open as a modal, and closed. */
  open = false;
  showModal() {
    this.open = true;
  }
  close() {
    this.open = false;
  }
  setPointerCapture() {}
  releasePointerCapture() {}
  hasPointerCapture() {
    return false;
  }
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
  windowListeners.length = 0;
  host.addEventListener = (type: string, fn: FakeHandler, options?: boolean | { capture?: boolean }) => {
    windowListeners.push({ type, fn, capture: typeof options === "boolean" ? options : Boolean(options?.capture) });
  };
  host.removeEventListener = (type: string, fn: FakeHandler) => {
    const at = windowListeners.findIndex((l) => l.type === type && l.fn === fn);
    if (at >= 0) windowListeners.splice(at, 1);
  };
  host.requestAnimationFrame = (callback: (time: number) => void) => setTimeout(() => callback(Date.now()), 0);
  host.cancelAnimationFrame = (handle: ReturnType<typeof setTimeout>) => clearTimeout(handle);
  host.HTMLElement = class {};
  host.HTMLIFrameElement = class {};
  host.Element = class {};
  host.Node = class {};
  host.SVGElement = class {};
  host.HTMLInputElement = class {};
  host.HTMLTextAreaElement = class {};
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

/**
 * Fires an event at a node: a capture phase from the top down, then a bubble phase up to the
 * document and on to `window`, as a browser does. `init` adds the event's own fields (key,
 * shiftKey, pointerId, clientX…). Returns the event, to read `defaultPrevented`.
 */
export function dispatch(target: FakeNode, type: string, init: Record<string, unknown> = {}): FakeEvent {
  const path: FakeNode[] = [];
  for (let node: FakeNode | null = target; node; node = node.parentNode) path.push(node);
  let stopped = false;
  const event: FakeEvent = {
    bubbles: true,
    cancelable: true,
    isTrusted: true,
    timeStamp: Date.now(),
    eventPhase: 0,
    currentTarget: null,
    button: 0,
    buttons: 1,
    pointerId: 1,
    pointerType: "mouse",
    clientX: 0,
    clientY: 0,
    key: "",
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    getModifierState: () => false,
    composedPath: () => path,
    ...init,
    type,
    target,
    defaultPrevented: false,
    preventDefault() {
      event.defaultPrevented = true;
    },
    stopPropagation() {
      stopped = true;
    },
    stopImmediatePropagation() {
      stopped = true;
    },
  };
  const run = (listeners: readonly FakeListener[], capture: boolean, node: unknown) => {
    for (const listener of [...listeners]) {
      if (listener.type === type && listener.capture === capture) listener.fn.call(node, event);
    }
  };
  for (const node of [...path].reverse()) {
    if (stopped) return event;
    event.currentTarget = node;
    run(node.listeners, true, node);
  }
  for (const node of path) {
    if (stopped) return event;
    event.currentTarget = node;
    run(node.listeners, false, node);
  }
  if (!stopped) run(windowListeners, false, globalThis);
  return event;
}

/** Every node under `root` (itself included) that `test` accepts, in document order. */
export function findAll(root: FakeNode, test: (node: FakeNode) => boolean): FakeNode[] {
  const out: FakeNode[] = [];
  const walk = (node: FakeNode) => {
    if (test(node)) out.push(node);
    for (const child of node.childNodes) walk(child);
  };
  walk(root);
  return out;
}

/** The first element whose aria-label or text is exactly, or starts with, `name`. */
export function byName(root: FakeNode, tag: string, name: string): FakeNode | null {
  return (
    findAll(root, (node) => node.nodeName === tag.toUpperCase()).find((node) => {
      const label = node.attributes["aria-label"] ?? readAll(node).trim();
      return label === name || label.startsWith(name);
    }) ?? null
  );
}
