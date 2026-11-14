import { Wrench } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, type Ref } from "react";
import { Luna, useLunaReducedMotion } from "../../../components/luna";
import { TabPanel, Tabs } from "../../../components/Tabs";
import { UnderTheHoodCard } from "../card";
import type { WorkedExamples } from "../placeholders";
import type { RunnerState } from "../runner";
import {
  conversationFor,
  isAnswered,
  type ConversationEntry,
  type OptionView,
  type PrimaryAction,
  type ResultView,
} from "../step-view";
import type { Step, UnderTheHoodCard as CardData } from "../types";
import { AnswerOption, OptionGroup, optionTabStop } from "../ui/answer-option";
import { filledText } from "../ui/filled";
import { CorrectMark, ShownMark } from "../ui/marks";

const EASE = [0.16, 1, 0.3, 1] as const;

export type TalkTab = "luna" | "hood";

type ConversationProps = {
  step: Step;
  runner: RunnerState;
  views: readonly OptionView[];
  examples: WorkedExamples;
  examplesPending: boolean;
  card: CardData | undefined;
  lessonTitle: string;
  tab: TalkTab;
  onTab: (tab: TalkTab) => void;
  onPick: (index: number) => void;
  primary: PrimaryAction;
  onPrimary: () => void;
  result: ResultView | null;
  primaryRef: Ref<HTMLButtonElement>;
};

/** Luna's conversation and the learner's answers, with "Under the hood" as a second tab. */
export function Conversation(props: ConversationProps) {
  const { tab, onTab } = props;
  const reduced = useLunaReducedMotion();
  return (
    <aside className="ac-panel ac-talk" aria-label="Conversation with Luna">
      <Tabs<TalkTab>
        idPrefix="ac-talk"
        label="Conversation"
        className="ac-tabs"
        value={tab}
        onChange={onTab}
        items={[
          { id: "luna", label: "Luna" },
          {
            id: "hood",
            label: (
              <>
                <Wrench aria-hidden="true" />
                Under the hood
              </>
            ),
          },
        ]}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          className="ac-tabpanel"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.1, ease: EASE }}
        >
          <TabPanel idPrefix="ac-talk" id={tab} className="ac-tabpanel">
            {tab === "luna" ? <LunaTab {...props} /> : <HoodTab {...props} />}
          </TabPanel>
        </motion.div>
      </AnimatePresence>
    </aside>
  );
}

function LunaTab({ step, runner, views, examples, onPick, primary, onPrimary, result, primaryRef }: ConversationProps) {
  const entries = conversationFor(step, runner);
  const logRef = useRef<HTMLDivElement>(null);
  const answered = isAnswered(runner);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [entries.length]);

  const hasAnswers = step.kind === "choice" || step.kind === "predict";
  return (
    <>
      <div ref={logRef} className="ac-log" aria-live="polite" aria-relevant="additions">
        <AnimatePresence initial={false}>
          {entries.map((entry, index) => (
            <Entry key={entry.key} entry={entry} examples={examples} delayed={entry.who === "luna" && index > 0} />
          ))}
        </AnimatePresence>
      </div>
      {hasAnswers ? (
        <OptionGroup
          label="Answers"
          className="ac-answers ac-options"
          views={views}
          locked={answered}
          answered={answered}
          onPick={onPick}
        >
          {step.options.map((option, index) => (
            <AnswerOption
              key={index}
              index={index}
              view={views[index] ?? { state: "default", note: null, correct: false }}
              tabStop={index === optionTabStop(views)}
              locked={answered}
              onPick={onPick}
            >
              {filledText(option, examples)}
            </AnswerOption>
          ))}
        </OptionGroup>
      ) : null}
      <div className="ac-act">
        {result ? <ResultRow result={result} examples={examples} key={`${step.id}-${runner.attempts.length}`} /> : <KeyHint step={step} primary={primary} />}
        <button
          ref={primaryRef}
          type="button"
          className="ac-btn ac-btn--primary"
          disabled={primary.kind === "check" && !primary.enabled}
          onClick={onPrimary}
        >
          {primary.label}
        </button>
      </div>
    </>
  );
}

function Entry({ entry, examples, delayed }: { entry: ConversationEntry; examples: WorkedExamples; delayed: boolean }) {
  const reduced = useLunaReducedMotion();
  const motionProps = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.15 } }
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.3, ease: EASE, delay: delayed ? 0.3 : 0 },
      };
  if (entry.who === "me") {
    return (
      <motion.p {...motionProps} className={entry.miss ? "ac-me ac-me--miss" : "ac-me"}>
        <span className="ac-visually-hidden">You: </span>
        {filledText(entry.text, examples)}
      </motion.p>
    );
  }
  return (
    <motion.div {...motionProps} className={entry.old ? "ac-msg ac-msg--old" : "ac-msg ac-msg--new"}>
      <Luna mood={entry.mood} size={48} decorative className="ac-msg-luna" />
      <p className="ac-say">
        <span className="ac-visually-hidden">Luna: </span>
        {filledText(entry.text, examples)}
      </p>
    </motion.div>
  );
}

function ResultRow({ result, examples }: { result: ResultView; examples: WorkedExamples }) {
  const headline = filledText(result.headline, examples);
  const reduced = useLunaReducedMotion();
  return (
    <div className="ac-result" role="status">
      {result.tone === "correct" ? <CorrectMark silent /> : <ShownMark />}
      <span className="ac-result-text">{result.tone === "shown" ? <span className="ac-visually-hidden">The answer: </span> : null}
        {headline}
      </span>
      <motion.span
        className="ac-result-xp"
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduced ? 0.15 : 0.42, ease: EASE }}
      >
        +{result.xp} XP
      </motion.span>
    </div>
  );
}

function KeyHint({ step, primary }: { step: Step; primary: PrimaryAction }) {
  if (primary.kind === "back") {
    return (
      <span className="ac-keys ac-keys-desk">
        <span className="ac-kbd">Esc</span> go back
      </span>
    );
  }
  if (primary.kind === "skip") {
    return (
      <span className="ac-keys ac-keys-desk">
        <span className="ac-kbd">Enter</span> continue
      </span>
    );
  }
  const verb = primary.kind === "check" && primary.label !== "Check" ? primary.label.toLowerCase() : "check";
  if (step.kind === "choice" || step.kind === "predict") {
    return (
      <span className="ac-keys ac-keys-desk">
        {step.options.slice(0, 9).map((_, index) => (
          <span key={index} className="ac-kbd">
            {index + 1}
          </span>
        ))}{" "}
        pick · <span className="ac-kbd">Enter</span> {verb}
      </span>
    );
  }
  return (
    <span className="ac-keys ac-keys-desk">
      <span className="ac-kbd">Enter</span> {verb}
    </span>
  );
}

function HoodTab({ card, examples, examplesPending, onTab, lessonTitle }: ConversationProps) {
  return (
    <>
      <div className="ac-hood">
        <UnderTheHoodCard card={card} examples={examples} title={lessonTitle} pending={examplesPending} />
      </div>
      <div className="ac-act">
        <button type="button" className="ac-btn ac-btn--secondary ac-btn--wide" onClick={() => onTab("luna")}>
          Back to Luna
        </button>
      </div>
    </>
  );
}
