import { ArrowUpRight } from "lucide-react";
import { createContext, Fragment, useContext, useMemo, type ReactNode } from "react";
import { Explain } from "../../../components/Explain";
import { isExplainTerm } from "../../../lib/explain";
import { comparisonWord, precisionFor } from "../compare";
import { academyDataSource, boxedNumbersNote, type DataSource } from "../data-source";
import type { Decimals } from "../format-example";
import { exampleText, hasExample, type WorkedExamples } from "../placeholders";
import type { CardFormula, FormulaSymbol, UnderTheHoodCard as CardData, WorkedRow } from "../types";
import { FillChip } from "../ui/filled";
import { fileName, fileUrl, sectionLabel, sectionUrl } from "./links";
import { ScrollBox, Tex, useKatex, type KatexState } from "./math";
import { comparedSetsIn, keysIn, parseProse } from "./prose";

type UnderTheHoodCardProps = {
  /** The lesson's card, or undefined when it is not written yet. */
  card: CardData | undefined;
  examples: WorkedExamples;
  /** The card's heading: the lesson's title. */
  title?: string;
  /** `worked_examples.json` is still loading: a key it lacks is not missing yet. */
  pending?: boolean;
};

type CardContext = {
  examples: WorkedExamples;
  katex: KatexState;
  pending: boolean;
  /** Whether the numbers are real derived data or test fixtures. */
  source: DataSource;
};

type DrawContext = CardContext & {
  /** Decimals for every key in a compared set. */
  precision: ReadonlyMap<string, Decimals>;
};

const Ctx = createContext<DrawContext>({
  examples: {},
  katex: { status: "loading" },
  pending: false,
  source: "derived",
  precision: new Map(),
});

/** Every string in a card, for the checks that run over all of its text. */
export function cardText(card: CardData): string[] {
  const walk = (value: unknown): string[] =>
    typeof value === "string"
      ? [value]
      : Array.isArray(value)
        ? value.flatMap(walk)
        : value && typeof value === "object"
          ? Object.values(value).flatMap(walk)
          : [];
  return walk(card);
}

/** The card's compared sets: those it lists, and every pair a `{{compare:…}}` names. */
export function cardComparedSets(card: CardData): string[][] {
  return [...(card.compare ?? []).map((set) => [...set]), ...cardText(card).flatMap(comparedSetsIn)];
}

/**
 * The "Under the hood" card: the five fixed parts of docs/academy/overview.md, with KaTeX
 * for the maths and `Fill` chips for every number from `worked_examples.json`.
 * It mounts only when its tab opens, and that is when KaTeX starts to load.
 */
export function UnderTheHoodCard({ card, examples, title, pending = false }: UnderTheHoodCardProps) {
  const katex = useKatex();
  return (
    <section className="ac-card" aria-labelledby="ac-card-title" aria-busy={katex.status === "loading" || undefined}>
      <div className="ac-card-head">
        <h2 id="ac-card-title">{title ?? "Under the hood"}</h2>
        <span className="ac-card-free">Never costs XP</span>
      </div>
      {card ? (
        <CardContent card={card} examples={examples} katex={katex} pending={pending} source={academyDataSource()} />
      ) : (
        <p>This lesson's card is not written yet.</p>
      )}
    </section>
  );
}

/** The card's five parts, drawn with the given KaTeX state and data source. Tests render it directly. */
export function CardContent({ card, ...context }: { card: CardData } & CardContext) {
  const precision = useMemo(() => precisionFor(cardComparedSets(card), context.examples), [card, context.examples]);
  return (
    <Ctx.Provider value={{ ...context, precision }}>
      <CardBody card={card} />
    </Ctx.Provider>
  );
}

/** One formula or piece of maths, with the card's examples, KaTeX state and precision. */
function CardTex({ tex, display }: { tex: string; display: boolean }) {
  const { examples, katex, pending, precision } = useContext(Ctx);
  const fill = useMemo(() => ({ pending, precision }), [pending, precision]);
  return <Tex tex={tex} display={display} examples={examples} katex={katex} fill={fill} />;
}

function CardBody({ card }: { card: CardData }) {
  const { examples, katex, pending, source } = useContext(Ctx);
  const symbols = uniqueSymbols(card.formulas);
  const exampleKeys = [
    card.workedExample.title,
    card.workedExample.intro,
    card.workedExample.outro ?? "",
    ...card.workedExample.rows.flatMap((row) => [row.label, "value" in row ? row.value : row.tex]),
  ].flatMap(keysIn);
  const anyFilled = exampleKeys.some((key) => hasExample(examples, key));
  const anyMissing = !pending && exampleKeys.some((key) => !hasExample(examples, key));

  return (
    <>
      {katex.status === "loading" ? (
        <p className="ac-card-status" role="status">
          Loading the maths…
        </p>
      ) : katex.status === "failed" ? (
        <p className="ac-card-status" role="status">
          The maths could not load, so each formula is shown as typed TeX.
        </p>
      ) : null}

      <h3>The idea</h3>
      <p>
        <Prose text={card.idea} />
      </p>

      <h3>{card.formulas.length > 1 ? "The formulas" : "The formula"}</h3>
      {card.formulas.map((formula) => (
        <Formula key={formula.id} formula={formula} />
      ))}
      {symbols.length > 0 ? (
        <>
          <h4 className="ac-card-sub">What the letters mean</h4>
          <dl className="ac-symbols">
            {symbols.map((symbol) => (
              <div key={symbol.tex} className="ac-symbol">
                <dt>
                  <CardTex tex={symbol.tex} display={false} />
                </dt>
                <dd>
                  <Prose text={symbol.meaning} />
                </dd>
                <dd className="ac-symbol-unit">
                  {symbol.unit === null ? "no unit" : symbol.unit}
                </dd>
              </div>
            ))}
          </dl>
        </>
      ) : null}

      <h3>
        A worked example: <Prose text={card.workedExample.title} />
      </h3>
      <p>
        <Prose text={card.workedExample.intro} />
      </p>
      <table className="ac-we">
        <tbody>
          {card.workedExample.rows.map((row, index) => (
            <Row key={index} row={row} />
          ))}
        </tbody>
      </table>
      {card.workedExample.outro ? (
        <p>
          <Prose text={card.workedExample.outro} />
        </p>
      ) : null}
      <p className="ac-card-note">
        {anyFilled ? boxedNumbersNote(source) : null}
        {anyFilled && anyMissing ? " " : null}
        {anyMissing ? "A dashed box is a number TrueSouth's pipeline has not built yet." : null}
      </p>

      <h3>In the code</h3>
      <ul className="ac-code-list">
        {card.inTheCode.map((ref) => (
          <li key={`${ref.file}:${ref.fn}`}>
            <a className="ac-codelink" href={fileUrl(ref.file)} target="_blank" rel="noreferrer">
              <ArrowUpRight aria-hidden="true" />
              <code>{fileName(ref.file)}</code>
              <span aria-hidden="true">·</span>
              <code>{ref.fn}</code>
              <span className="ac-visually-hidden"> (opens the file on GitHub in a new tab)</span>
            </a>
            {ref.does ? (
              <p>
                <Prose text={ref.does} />
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      <h3>What can go wrong</h3>
      <ul className="ac-wrong">
        {card.whatCanGoWrong.map((item, index) => (
          <li key={index}>
            <Prose text={item} />
          </li>
        ))}
      </ul>
    </>
  );
}

function Formula({ formula }: { formula: CardFormula }) {
  const tex = <CardTex tex={formula.tex} display={formula.display === "block"} />;
  return (
    <figure className="ac-formula-item" data-display={formula.display}>
      {formula.display === "block" ? (
        <>
          <p>
            <Prose text={formula.lead} />
          </p>
          <ScrollBox label="Formula">{tex}</ScrollBox>
        </>
      ) : (
        <p>
          <Prose text={formula.lead} /> {tex}
        </p>
      )}
      <figcaption>
        <span className="ac-reading">
          <span className="ac-reading-label">In words: </span>
          <Prose text={formula.reading} />
        </span>
        <a className="ac-cite" href={sectionUrl(formula.section)} target="_blank" rel="noreferrer">
          {sectionLabel(formula.section)}
          <ArrowUpRight aria-hidden="true" />
          <span className="ac-visually-hidden">, {formula.section.title} (opens in a new tab)</span>
        </a>
      </figcaption>
    </figure>
  );
}

function Row({ row }: { row: WorkedRow }) {
  if ("tex" in row) {
    return (
      <tr className="ac-we-calc">
        <td colSpan={2}>
          <span className="ac-we-label">
            <Prose text={row.label} />
          </span>
          <ScrollBox label={labelText(row.label)}>
            <CardTex tex={row.tex} display />
          </ScrollBox>
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <th scope="row">
        <Prose text={row.label} />
      </th>
      <td>
        <Prose text={row.value} />
      </td>
    </tr>
  );
}

/** A label's words, for an accessible name: maths and markup dropped. */
function labelText(text: string): string {
  return parseProse(text)
    .map((token) => (token.kind === "text" || token.kind === "code" ? token.text : token.kind === "term" ? token.label : ""))
    .join("")
    .replace(/[,\s]+$/, "")
    .trim();
}

/** Every letter the formulas use, each once, in the order they first appear. */
export function uniqueSymbols(formulas: readonly CardFormula[]): FormulaSymbol[] {
  const seen = new Map<string, FormulaSymbol>();
  for (const formula of formulas) {
    for (const symbol of formula.symbols) {
      if (!seen.has(symbol.tex)) seen.set(symbol.tex, symbol);
    }
  }
  return [...seen.values()];
}

const warnedTerms = new Set<string>();

/** The larger of two decimals settings, or undefined when neither is given. */
function widest(a: Decimals | undefined, b: Decimals | undefined): Decimals | undefined {
  if (!a) return b;
  if (!b) return a;
  return a.max >= b.max ? a : b;
}

const warnedCompares = new Set<string>();

/** Card text, drawn: maths, `Fill` chips, comparison words, glossary terms and code names. */
export function Prose({ text }: { text: string }): ReactNode {
  const { examples, pending, precision } = useContext(Ctx);
  return parseProse(text).map((token, index) => {
    switch (token.kind) {
      case "text":
        return <Fragment key={index}>{token.text}</Fragment>;
      case "code":
        return <code key={index}>{token.text}</code>;
      case "math":
        return <CardTex key={index} tex={token.tex} display={false} />;
      case "term":
        if (!isExplainTerm(token.term)) {
          if (import.meta.env.DEV && !warnedTerms.has(token.term)) {
            warnedTerms.add(token.term);
            console.warn(`[Under the hood] "${token.term}" has no entry in web/src/lib/explain.ts.`);
          }
          return <Fragment key={index}>{token.label}</Fragment>;
        }
        return (
          <Explain key={index} term={token.term}>
            {token.label}
          </Explain>
        );
      case "fill": {
        const written = exampleText(examples, token.key, precision.get(token.key));
        if (written === null) return <FillChip key={index} state={pending ? "pending" : "missing"} />;
        return (
          <FillChip key={index}>
            {written}
            {token.unit}
          </FillChip>
        );
      }
      case "compare": {
        const [first, second] = token.keys;
        const [less, more, same] = token.words;
        if (token.keys.length !== 2 || token.words.length !== 3 || !first || !second || !less || !more || !same) {
          if (import.meta.env.DEV && !warnedCompares.has(text)) {
            warnedCompares.add(text);
            console.warn(`[Under the hood] A {{compare:…}} needs two keys and three words: ${text}`);
          }
          return <FillChip key={index} state="missing" />;
        }
        const decimals = widest(precision.get(first), precision.get(second));
        const word = comparisonWord(examples, first, second, { less, more, same }, decimals);
        if (word === null) return <FillChip key={index} state={pending ? "pending" : "missing"} />;
        return <Fragment key={index}>{word}</Fragment>;
      }
    }
  });
}
