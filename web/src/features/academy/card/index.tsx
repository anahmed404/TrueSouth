import type { WorkedExamples } from "../placeholders";
import type { UnderTheHoodCard as CardData } from "../types";
import { Filled } from "../ui/filled";

type UnderTheHoodCardProps = {
  /** The lesson's card, or undefined when it is not written yet. */
  card: CardData | undefined;
  examples: WorkedExamples;
  /** The card's heading: the lesson's title. */
  title?: string;
};

/**
 * The "Under the hood" card's five fixed parts. For now each part is plain text with its
 * placeholders filled. Work package A4 replaces the inside of this component with the
 * Markdown and KaTeX renderer; its props stay the same.
 */
export function UnderTheHoodCard({ card, examples, title }: UnderTheHoodCardProps) {
  return (
    <section className="ac-card" aria-labelledby="ac-card-title">
      <div className="ac-card-head">
        <h2 id="ac-card-title">{title ?? "Under the hood"}</h2>
        <span className="ac-card-free">Never costs XP</span>
      </div>
      {card ? (
        <>
          <h3>The idea</h3>
          <p>
            <Filled value={card.idea} examples={examples} />
          </p>
          <h3>The formula</h3>
          <div className="ac-card-formula">
            <Filled value={card.formula} examples={examples} />
            <span className="ac-card-cite">{card.formulaSection}</span>
          </div>
          <h3>A worked example</h3>
          <p>
            <Filled value={card.workedExample} examples={examples} />
          </p>
          <h3>In the code</h3>
          <p>
            <code>{card.inTheCode.fn}</code> in <code>{card.inTheCode.file}</code>
          </p>
          <h3>What can go wrong</h3>
          <p>
            <Filled value={card.whatCanGoWrong} examples={examples} />
          </p>
        </>
      ) : (
        <p>This lesson's card is not written yet.</p>
      )}
    </section>
  );
}
