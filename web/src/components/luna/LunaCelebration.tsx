import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useLunaReducedMotion, Luna } from "./Luna";
import { celebrationPlan, confettiPieces, type CelebrationKind } from "./motion-plan";

/** Confetti colours, as theme-token classes. */
const CONFETTI_CLASSES = [
  "bg-status-go",
  "bg-status-caution",
  "bg-accent",
  "bg-text",
  "bg-status-nogo",
] as const;

export type LunaCelebrationProps = {
  /** "correct": a short burst on a correct answer. "lesson-complete": a bigger one. */
  kind: CelebrationKind;
  /**
   * The words that say what happened, for example "Correct" or "Lesson complete".
   * Always shown and announced, so the celebration never relies on the picture alone.
   */
  children?: ReactNode;
  /** Draw confetti. Optional decoration; nothing depends on it. */
  confetti?: boolean;
  reduceMotion?: boolean;
  className?: string;
};

/**
 * Luna cheering, with an optional confetti burst. Plays once on mount; give it a new
 * `key` to play again. With reduced motion Luna still cheers, with no hop and no confetti.
 */
export function LunaCelebration({
  kind,
  children,
  confetti = true,
  reduceMotion,
  className,
}: LunaCelebrationProps) {
  const reduced = useLunaReducedMotion(reduceMotion);
  const plan = celebrationPlan(kind, reduced, confetti);
  const pieces = confettiPieces(plan.confetti, plan.lunaSize * 0.9, CONFETTI_CLASSES.length);

  return (
    <div
      className={["relative inline-flex flex-col items-center gap-2", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="relative" style={{ width: plan.lunaSize, height: plan.lunaSize }}>
        {pieces.length > 0 ? (
          <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/3">
            {pieces.map((p, i) => (
              <motion.span
                key={i}
                className={`absolute block h-3 w-2 rounded-sm ${CONFETTI_CLASSES[p.colour]}`}
                initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                animate={{
                  x: [0, p.x * 0.6, p.x],
                  y: [0, -p.rise, -p.rise * 0.2],
                  rotate: p.spin,
                  opacity: [1, 1, 0],
                }}
                transition={{ duration: plan.duration, delay: p.delay, ease: "easeOut" }}
              />
            ))}
          </div>
        ) : null}
        <motion.div
          initial={{ y: 0 }}
          animate={plan.hop > 0 ? { y: [0, -plan.hop, 0, -plan.hop * 0.4, 0] } : { y: 0 }}
          transition={{ duration: plan.hop > 0 ? plan.duration * 0.6 : 0, ease: "easeOut" }}
        >
          <Luna mood="cheering" size={plan.lunaSize} reduceMotion={reduced} />
        </motion.div>
      </div>
      {children ? (
        <p role="status" className="m-0 text-lg font-semibold text-text">
          {children}
        </p>
      ) : null}
    </div>
  );
}
