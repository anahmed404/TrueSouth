import { AnimatePresence, motion, useAnimate } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { lunaArt } from "./art";
import { PART_NAMES, type PartName } from "./art-contract";
import {
  BLINK_CLOSED_MS,
  lunaMotionPlan,
  nextBlinkDelayMs,
  resolveReducedMotion,
} from "./motion-plan";
import type { Mood } from "./moods";
import { resolveMoodArt, showsDetail, showsExtras } from "./resolve-art";

export type LunaProps = {
  mood?: Mood;
  /** Width and height in px. Readable from 28 to 160; extras drop below 40. */
  size?: number;
  /** Force reduced motion on or off. Leave unset to follow the system setting. */
  reduceMotion?: boolean;
  /**
   * Hide Luna from screen readers. Use only when text beside her already says the
   * same thing; otherwise she is announced with her mood.
   */
  decorative?: boolean;
  className?: string;
};

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const query = window.matchMedia(REDUCE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function systemReducedMotion(): boolean | null {
  if (typeof window === "undefined" || !window.matchMedia) return null;
  return window.matchMedia(REDUCE_QUERY).matches;
}

/**
 * The current reduced-motion choice: the prop if given, else the system setting.
 * Follows the setting live if the learner changes it while the page is open.
 */
export function useLunaReducedMotion(override?: boolean): boolean {
  const system = useSyncExternalStore(subscribeReducedMotion, systemReducedMotion, () => null);
  return resolveReducedMotion(override, system);
}

function useBlink(enabled: boolean): boolean {
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setClosed(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setClosed(true);
        timer = setTimeout(() => {
          setClosed(false);
          schedule();
        }, BLINK_CLOSED_MS);
      }, nextBlinkDelayMs(Math.random()));
    };
    schedule();
    return () => clearTimeout(timer);
  }, [enabled]);
  return closed;
}

/** A small settle of the whole body whenever the mood changes: an ease-out, no bounce. */
function useMoodPop(mood: Mood, enabled: boolean) {
  const [scope, animate] = useAnimate<SVGGElement>();
  const previous = useRef(mood);
  useEffect(() => {
    if (previous.current === mood) return;
    previous.current = mood;
    if (!enabled || !scope.current) return;
    animate(scope.current, { scale: [0.95, 1] }, { duration: 0.25, ease: [0.16, 1, 0.3, 1] });
  }, [mood, enabled, animate, scope]);
  return scope;
}

/** One shared part (eyes, mouth...). The old mood's part fades out as the new one fades in. */
function PartLayer({ mood, node, fade }: { mood: Mood; node: ReactNode; fade: number }) {
  if (fade === 0) {
    return node ? <g>{node}</g> : null;
  }
  return (
    <AnimatePresence initial={false}>
      {node ? (
        <motion.g
          key={mood}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: fade, ease: "easeOut" }}
        >
          {node}
        </motion.g>
      ) : null}
    </AnimatePresence>
  );
}

export function Luna({
  mood = "idle",
  size = 96,
  reduceMotion,
  decorative = false,
  className,
}: LunaProps) {
  const reduced = useLunaReducedMotion(reduceMotion);
  const plan = lunaMotionPlan(reduced);
  const art = resolveMoodArt(mood);
  const blinkClosed = useBlink(plan.blink && art.blinks !== false);
  const popScope = useMoodPop(mood, plan.moodPop);

  const parts: Record<PartName, ReactNode> = {
    brows: art.brows,
    eyes: art.eyes,
    mouth: art.mouth,
    extras: showsExtras(size) ? art.extras : undefined,
  };

  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": art.label };

  return (
    <svg
      width={size}
      height={size}
      viewBox={lunaArt.viewBox}
      className={["block overflow-visible", className].filter(Boolean).join(" ")}
      data-mood={mood}
      focusable="false"
      {...a11y}
    >
      <motion.g
        animate={plan.idleBob ? { y: [0, -2.5, 0] } : { y: 0 }}
        transition={
          plan.idleBob
            ? { duration: 3.2, ease: "easeInOut", repeat: Infinity }
            : { duration: 0 }
        }
      >
        <g ref={popScope} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
          {lunaArt.body}
          {showsDetail(size) ? lunaArt.detail : null}
          {PART_NAMES.map((part) =>
            part === "eyes" ? (
              <motion.g
                key={part}
                animate={{ scaleY: blinkClosed ? 0.1 : 1 }}
                transition={{ duration: reduced ? 0 : 0.07 }}
              >
                <PartLayer mood={mood} node={parts.eyes} fade={plan.moodFade} />
              </motion.g>
            ) : (
              <PartLayer key={part} mood={mood} node={parts[part]} fade={plan.moodFade} />
            ),
          )}
        </g>
      </motion.g>
    </svg>
  );
}
