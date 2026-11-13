import { MoveHorizontal } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { hasExample, splitPlaceholders, type WorkedExamples } from "../placeholders";
import { FillChip } from "../ui/filled";
import { formatExample } from "../format-example";
import type { TexResult } from "./katex-render";
import { fillTex } from "./tex";

/** The part of the KaTeX module the card uses. */
export type TexRenderer = (tex: string, display: boolean) => TexResult;

/** Where KaTeX is: still on its way, ready, or failed to load. */
export type KatexState =
  | { status: "loading" }
  | { status: "ready"; render: TexRenderer }
  | { status: "failed" };

let ready: TexRenderer | null = null;
let pending: Promise<TexRenderer> | null = null;

/**
 * Loads KaTeX once. This dynamic `import()` is the only way into `katex-render.ts`, so
 * KaTeX arrives with the first card that opens, not with the first page. A failed load is
 * forgotten, so the next card that opens tries again.
 */
export function loadKatex(): Promise<TexRenderer> {
  if (ready) return Promise.resolve(ready);
  pending ??= import("./katex-render").then(
    (module) => {
      ready = module.renderTex;
      return ready;
    },
    (error: unknown) => {
      pending = null;
      throw error;
    },
  );
  return pending;
}

/** KaTeX's state for a card. It starts loading when the card first mounts. */
export function useKatex(): KatexState {
  const [state, setState] = useState<KatexState>(() => (ready ? { status: "ready", render: ready } : { status: "loading" }));
  useEffect(() => {
    if (state.status === "ready") return;
    let live = true;
    loadKatex().then(
      (render) => live && setState({ status: "ready", render }),
      () => live && setState({ status: "failed" }),
    );
    return () => {
      live = false;
    };
    // Runs once per card: a failed load is retried when the card opens again.
  }, []);
  return state;
}

type TexProps = {
  tex: string;
  display: boolean;
  examples: WorkedExamples;
  katex: KatexState;
  /** The worked examples are still loading, so a missing key is not missing yet. */
  pending?: boolean;
};

/**
 * One formula. With KaTeX ready it is drawn with MathML beside it for screen readers, and
 * its placeholders become `Fill` chips. While KaTeX loads, if it fails to load, or if the
 * formula fails to parse, the TeX source is shown as text with its placeholders filled.
 * A bad formula never breaks the lesson.
 */
export function Tex({ tex, display, examples, katex, pending = false }: TexProps) {
  const result = useMemo(() => {
    if (katex.status !== "ready") return null;
    return katex.render(fillTex(tex, examples, pending).tex, display);
  }, [tex, display, examples, katex, pending]);

  if (result?.ok) {
    const Tag = display ? "div" : "span";
    return <Tag className={display ? "ac-tex ac-tex--block" : "ac-tex"} dangerouslySetInnerHTML={{ __html: result.html }} />;
  }
  const state = katex.status === "loading" ? "loading" : "source";
  return (
    <code className={display ? "ac-tex-src ac-tex-src--block" : "ac-tex-src"} data-state={state}>
      {splitPlaceholders(tex).map((part, index) => {
        if (part.kind === "text") return part.text;
        const value = examples[part.key];
        if (!hasExample(examples, part.key) || value === undefined) {
          return <FillChip key={index} state={pending ? "pending" : "missing"} />;
        }
        return <FillChip key={index}>{formatExample(part.key, value)}</FillChip>;
      })}
    </code>
  );
}

/**
 * A box for a formula that may be wider than the card. It scrolls sideways inside itself,
 * never the page. When it overflows it says so, and takes keyboard focus so the arrow keys
 * scroll it.
 */
export function ScrollBox({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const measure = () => setOverflows(box.scrollWidth > box.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    const inner = box.firstElementChild;
    if (inner) observer.observe(inner);
    return () => observer.disconnect();
  }, [children]);

  return (
    <div className="ac-math">
      <div
        ref={ref}
        className="ac-math-scroll"
        data-overflow={overflows || undefined}
        tabIndex={overflows ? 0 : undefined}
        role={overflows ? "region" : undefined}
        aria-label={overflows ? `${label}, scrolls sideways` : undefined}
      >
        {children}
      </div>
      {overflows ? (
        <p className="ac-math-more" aria-hidden="true">
          <MoveHorizontal aria-hidden="true" />
          Scroll sideways to see all of it
        </p>
      ) : null}
    </div>
  );
}
