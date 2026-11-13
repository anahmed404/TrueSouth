import { explanations } from "../lib/explain";

type ExplainProps = {
  term: string;
};

export function Explain({ term }: ExplainProps) {
  const text = explanations[term]?.text ?? term;
  return <span title={text}>{term}</span>;
}
