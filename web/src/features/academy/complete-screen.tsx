import { ArrowRight, ChevronLeft, X } from "lucide-react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { Luna, useLunaReducedMotion } from "../../components/luna";
import { LESSONS, PATCH_SHELF } from "./catalog";
import { isWritten } from "./lessons";
import type { WorkedExamples } from "./placeholders";
import { completeScreenData, type RunnerState } from "./runner";
import { useAcademyStore } from "./store";
import type { Lesson } from "./types";
import { filledText } from "./ui/filled";
import { STAR_PATH } from "./ui/marks";
import { Moondust } from "./ui/moondust";
import { panelExplanation, panelName } from "./ui/panels";
import { MissionPatch } from "./ui/patch";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Stars that fill one after another, 150 ms apart. Still and filled under reduce motion. */
function FillingStars({ count }: { count: number }) {
  const reduced = useLunaReducedMotion();
  return (
    <span className="ac-stars" role="img" aria-label={`${count} of 3 stars`}>
      {[0, 1, 2].map((index) => {
        const earned = index < count;
        return (
          <motion.svg
            key={index}
            width={40}
            height={40}
            viewBox="0 0 24 24"
            aria-hidden="true"
            initial={earned && !reduced ? { opacity: 0, scale: 0.6 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: EASE, delay: 0.5 + index * 0.15 }}
          >
            <path
              d={STAR_PATH}
              fill={earned ? "var(--ink)" : "none"}
              stroke={earned ? "var(--ink)" : "var(--line-strong)"}
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </motion.svg>
        );
      })}
    </span>
  );
}

/** "+42 XP", counting up from 0 over 600 ms; shown at once under reduce motion. */
function CountUp({ value }: { value: number }) {
  const reduced = useLunaReducedMotion();
  const count = useMotionValue(reduced ? value : 0);
  const shown = useTransform(count, (latest) => `+${Math.round(latest)}`);
  useEffect(() => {
    if (reduced) {
      count.set(value);
      return;
    }
    const controls = animate(count, value, { duration: 0.6, ease: EASE, delay: 0.4 });
    return () => controls.stop();
  }, [value, reduced, count]);
  return <motion.span aria-hidden="true">{shown}</motion.span>;
}

export function CompleteScreen({ lesson, runner, examples }: { lesson: Lesson; runner: RunnerState; examples: WorkedExamples }) {
  const reduced = useLunaReducedMotion();
  const totalXp = useAcademyStore((state) => state.xp);
  const patches = useAcademyStore((state) => state.patches);
  const nextRef = useRef<HTMLAnchorElement>(null);

  const index = LESSONS.findIndex((item) => item.id === lesson.id);
  const following = index >= 0 ? LESSONS[index + 1] : undefined;
  // The next lesson, if it is written. After lesson 4 the path goes on to lessons that are not.
  const next = following && isWritten(following.id) ? following : undefined;
  const shelfIds = new Set(PATCH_SHELF.map((patch) => patch.id));
  const earnedOfNine = patches.filter((id) => shelfIds.has(id)).length;
  const done = completeScreenData(lesson, runner);
  const unlocked = typeof lesson.unlocks === "string" ? [lesson.unlocks] : lesson.unlocks;
  const panel = unlocked.map((id) => panelName(id)).join(" and ");
  const explanation = unlocked
    .map((id) => panelExplanation(id))
    .filter((text) => text !== null)
    .join(" ");

  useEffect(() => {
    nextRef.current?.focus();
  }, []);

  const sub =
    index >= 0
      ? `Lesson ${index + 1} complete · ${earnedOfNine} of 9 patches`
      : `${lesson.title} complete · a sample patch, not one of the nine`;

  return (
    <main className="ac-screen ac-screen--fixed">
      <header className="ac-ct">
        <Link className="ac-icon-btn" to="/academy" aria-label="Close and go back to the path">
          <X aria-hidden="true" />
        </Link>
        <p className="ac-ct-title">{index >= 0 ? `${index + 1} · ${lesson.title}` : lesson.title}</p>
        <span className="ac-spacer" />
        <Link className="ac-quiet" to="/mission">
          Skip to Mission Control
          <ArrowRight aria-hidden="true" />
        </Link>
      </header>
      <div className="ac-col-scroll">
        <div className="ac-col">
          <div className="ac-hero">
            <Luna mood="proud" size={96} decorative />
            <motion.div
              initial={reduced ? false : { scale: 1.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              <MissionPatch id={lesson.id} earned size={160} />
            </motion.div>
            <Moondust size="big" seed={19} />
          </div>
          <h1>{done.heading}</h1>
          <p className="ac-col-sub">{sub}</p>

          <div className="ac-score">
            <div>
              <FillingStars count={done.stars} />
              <p className="ac-score-label">{done.firstTime}</p>
            </div>
            <span className="ac-score-rule" aria-hidden="true" />
            <div>
              <div className="ac-score-xp">
                <span className="ac-visually-hidden">{runner.xp} XP earned</span>
                <CountUp value={runner.xp} />
                <small aria-hidden="true">XP</small>
              </div>
              <p className="ac-score-label">{totalXp} XP in all</p>
            </div>
          </div>

          <div className="ac-recap ac-msg ac-msg--new">
            <Luna mood="happy" size={48} decorative className="ac-msg-luna" />
            <p className="ac-say">{filledText(lesson.recap, examples)}</p>
          </div>

          <section className="ac-built" aria-labelledby="ac-built-title">
            <div className="ac-built-art">The {panel} panel appears here once Mission Control builds it.</div>
            <div>
              <h2 id="ac-built-title">You built the {panel}</h2>
              {explanation ? <p>{explanation}</p> : null}
              <Link className="ac-btn ac-btn--secondary ac-btn--compact" to="/mission">
                Open in Mission Control
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </section>
        </div>
      </div>
      <footer className="ac-cf">
        <div className="ac-cf-in">
          {next ? (
            <>
              <Link className="ac-quiet" to="/academy">
                <ChevronLeft aria-hidden="true" />
                Back to the path
              </Link>
              <Link ref={nextRef} className="ac-btn ac-btn--primary" to={`/academy/${next.id}`}>
                Next: {next.title}
                <ArrowRight aria-hidden="true" />
              </Link>
            </>
          ) : (
            <>
              {following ? (
                <p className="ac-cf-note">
                  Lesson {index + 2}, {following.title}, is not written yet.
                </p>
              ) : null}
              <Link ref={nextRef} className="ac-btn ac-btn--primary" to="/academy">
                Back to the path
                <ArrowRight aria-hidden="true" />
              </Link>
            </>
          )}
        </div>
      </footer>
    </main>
  );
}
