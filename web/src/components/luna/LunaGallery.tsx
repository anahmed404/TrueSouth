import { useState, type ReactNode } from "react";
import { Luna } from "./Luna";
import { LunaCelebration } from "./LunaCelebration";
import { LunaSays } from "./LunaSays";
import { MOOD_USE, MOODS, type Mood } from "./moods";
import type { CelebrationKind } from "./motion-plan";

/*
  A demo page for design review: every mood at 160, 64, 40 and 28 px, mood switching,
  LunaSays in a 360 px box, and the celebrations. Not wired into any route; mount it
  temporarily to look at it. Placeholder styling, theme tokens only.
*/

type MotionChoice = "system" | "reduce" | "full";

/** The small sizes Luna is checked at, beside the 160 px drawing. */
const SMALL_SIZES = [64, 40, 28] as const;

const BUTTON =
  "rounded border border-border bg-surface-2 px-3 py-2 text-sm text-text hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-pressed:bg-surface-3 aria-pressed:border-text-muted";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-6">
      <h2 className="m-0 text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function LunaGallery() {
  const [motionChoice, setMotionChoice] = useState<MotionChoice>("system");
  const [liveMood, setLiveMood] = useState<Mood>("idle");
  const [celebration, setCelebration] = useState<{ kind: CelebrationKind; run: number } | null>(
    null,
  );
  const [confetti, setConfetti] = useState(true);

  const reduceMotion =
    motionChoice === "system" ? undefined : motionChoice === "reduce";

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 bg-background p-6 text-text">
      <header className="flex flex-col gap-3">
        <h1 className="m-0 text-2xl font-semibold">Luna gallery (placeholder art)</h1>
        <fieldset className="m-0 flex flex-wrap items-center gap-2 border-0 p-0">
          <legend className="mb-2 text-sm text-text-muted">Motion</legend>
          {(
            [
              ["system", "Follow system setting"],
              ["reduce", "Reduce motion"],
              ["full", "Full motion"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={BUTTON}
              aria-pressed={motionChoice === value}
              onClick={() => setMotionChoice(value)}
            >
              {label}
            </button>
          ))}
        </fieldset>
      </header>

      <Section title="All eight moods at 160, 64, 40 and 28 px">
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-4 p-0">
          {MOODS.map((mood) => (
            <li
              key={mood}
              className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface-1 p-4"
            >
              <Luna mood={mood} size={160} reduceMotion={reduceMotion} />
              <div className="flex items-end gap-3">
                {SMALL_SIZES.map((size) => (
                  <Luna key={size} mood={mood} size={size} reduceMotion={reduceMotion} />
                ))}
              </div>
              <div className="text-center">
                <p className="m-0 font-mono text-base">{mood}</p>
                <p className="m-0 text-xs text-text-muted">{MOOD_USE[mood]}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Switching moods">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Pick a mood">
          {MOODS.map((mood) => (
            <button
              key={mood}
              type="button"
              className={BUTTON}
              aria-pressed={liveMood === mood}
              onClick={() => setLiveMood(mood)}
            >
              {mood}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-6">
          <Luna mood={liveMood} size={160} reduceMotion={reduceMotion} />
          <Luna mood={liveMood} size={48} reduceMotion={reduceMotion} />
        </div>
      </Section>

      <Section title="LunaSays in a 360 px box">
        <div className="flex flex-wrap gap-6">
          <div className="flex w-[360px] max-w-full flex-col gap-4 rounded-lg border border-dashed border-border p-3">
            <LunaSays mood={liveMood} reduceMotion={reduceMotion} announce>
              The Sun is only 1.2° up. Will Pip see it?
            </LunaSays>
            <LunaSays mood="worried" reduceMotion={reduceMotion}>
              Not quite. Think about how far away that ridge is. Want to try again?
            </LunaSays>
            <LunaSays mood="happy" size={48} reduceMotion={reduceMotion}>
              At my equator the Sun climbs right overhead. At my south pole it never gets
              above 2°. Let&apos;s see why.
            </LunaSays>
            <LunaSays mood="surprised" reduceMotion={reduceMotion}>
              Too long on purpose: this bubble carries far more than one idea, so it shows
              how wrapping behaves when a writer ignores the two-sentence guide, including
              a very long unbroken token like
              https://example.org/a-very-long-path-without-any-spaces-at-all-to-break-on
              and a second paragraph of filler text that keeps going well past what Luna
              should ever say in one breath.
            </LunaSays>
          </div>
        </div>
      </Section>

      <Section title="Celebrations">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={BUTTON}
            onClick={() => setCelebration((c) => ({ kind: "correct", run: (c?.run ?? 0) + 1 }))}
          >
            Play correct answer
          </button>
          <button
            type="button"
            className={BUTTON}
            onClick={() =>
              setCelebration((c) => ({ kind: "lesson-complete", run: (c?.run ?? 0) + 1 }))
            }
          >
            Play lesson complete
          </button>
          <button
            type="button"
            className={BUTTON}
            aria-pressed={confetti}
            onClick={() => setConfetti((v) => !v)}
          >
            Confetti
          </button>
        </div>
        <div className="flex min-h-56 items-center justify-center rounded-lg border border-border bg-surface-1 p-6">
          {celebration ? (
            <LunaCelebration
              key={celebration.run}
              kind={celebration.kind}
              confetti={confetti}
              reduceMotion={reduceMotion}
            >
              {celebration.kind === "correct" ? "Correct" : "Lesson complete"}
            </LunaCelebration>
          ) : (
            <p className="m-0 text-text-muted">Press a button to play a celebration.</p>
          )}
        </div>
      </Section>
    </main>
  );
}

export default LunaGallery;
