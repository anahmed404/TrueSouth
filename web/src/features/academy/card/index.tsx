import { ArrowUpRight } from "lucide-react";
import { createContext, Fragment, useContext, type ReactNode } from "react";
import { Explain } from "../../../components/Explain";
import { isExplainTerm } from "../../../lib/explain";
import { formatExample } from "../format-example";
import { hasExample, type WorkedExamples } from "../placeholders";
import type { CardFormula, FormulaSymbol, UnderTheHoodCard as CardData, WorkedRow } from "../types";
import { FillChip } from "../ui/filled";
import { fileName, fileUrl, sectionLabel, sectionUrl } from "./links";
import { ScrollBox, Tex, useKatex, type KatexState } from "./math";
import { keysIn, parseProse } from "./prose";

type UnderTheHoodCardProps = {
  /** The lesson's card, or undefined when it is not written yet. */
  card: CardData | undefined;
  examples: WorkedExamples;
  /** The card's heading: the lesson's title. */
  title?: string;
  /** `worked_examples.json` is still loading: a key it lacks is not missing yet. */
  pending?: boolean;
};

type CardContext = { examples: WorkedExamples; katex: KatexState; pending: boolean };

const Ctx = createContext<CardContext>({ examples: {}, katex: { status: "loading" }, pending: false });

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
        <CardContent card={card} examples={examples} katex={katex} pending={pending} />
      ) : (
        <p>This lesson's card is not written yet.</p>
      )}
    </section>
  );
}

/** The card's five parts, drawn with the given KaTeX state. Tests render it directly. */
export function CardContent({ card, ...context }: { card: CardData } & CardContext) {
  return (
    <Ctx.Provider value={context}>
      <CardBody card={card} />
    </Ctx.Provider>
  );
}

function CardBody({ card }: { card: CardData }) {
  const { examples, katex, pending } = useContext(Ctx);
  const symbols = uniqueSymbols(card.formulas);
  const exampleKeys = [
    card.workedExample.intro,
    card.workedExample.outro ?? "",
    ...card.workedExample.rows.flatMap((row) => [row.label, "value" in row ? row.value : row.tex]),
  ].flatMap(keysIn);
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
                  <Tex tex={symbol.tex} display={false} examples={examples} katex={katex} pending={pending} />
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

      <h3>A worked example: {card.workedExample.title}</h3>
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
        Numbers in a box are real data, made by running TrueSouth's science code.
        {anyMissing ? " A dashed box is a number that code has not built yet." : null}
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
  const { examples, katex, pending } = useContext(Ctx);
  const tex = <Tex tex={formula.tex} display={formula.display === "block"} examples={examples} katex={katex} pending={pending} />;
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
  const { examples, katex, pending } = useContext(Ctx);
  if ("tex" in row) {
    return (
      <tr className="ac-we-calc">
        <td colSpan={2}>
          <span className="ac-we-label">
            <Prose text={row.label} />
          </span>
          <ScrollBox label={labelText(row.label)}>
            <Tex tex={row.tex} display examples={examples} katex={katex} pending={pending} />
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

/** Card text, drawn: maths, `Fill` chips, glossary terms and code names. */
export function Prose({ text }: { text: string }): ReactNode {
  const { examples, katex, pending } = useContext(Ctx);
  return parseProse(text).map((token, index) => {
    switch (token.kind) {
      case "text":
        return <Fragment key={index}>{token.text}</Fragment>;
      case "code":
        return <code key={index}>{token.text}</code>;
      case "math":
        return <Tex key={index} tex={token.tex} display={false} examples={examples} katex={katex} pending={pending} />;
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
        const value = examples[token.key];
        if (!hasExample(examples, token.key) || value === undefined) {
          return <FillChip key={index} state={pending ? "pending" : "missing"} />;
        }
        return (
          <FillChip key={index}>
            {formatExample(token.key, value)}
            {token.unit}
          </FillChip>
        );
      }
    }
  });
}
