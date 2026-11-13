import { useCallback, useEffect, useRef, useState } from "react";
import type { TimelineRange } from "./axis";

/** Play speeds in hours of mission time per second of real time. */
export const PLAY_SPEEDS = [1, 6, 24] as const;
export type PlaySpeed = (typeof PLAY_SPEEDS)[number];

export function speedLabel(speed: PlaySpeed): string {
  return speed === 24 ? "1 d per second" : `${speed} h per second`;
}

export function nextSpeed(speed: PlaySpeed): PlaySpeed {
  const index = PLAY_SPEEDS.indexOf(speed);
  return PLAY_SPEEDS[(index + 1) % PLAY_SPEEDS.length] ?? 1;
}

/**
 * Where play starts and where it stops. Inside the mission window it stops at the window's
 * last hour; from the last window hour or later it runs on to the end of the timeline. At
 * the very end it starts again from the landing hour.
 */
export function playPlan(range: Pick<TimelineRange, "landing" | "windowEnd" | "end">, current: number): { from: number; stop: number } {
  const lastWindowHour = Math.min(range.windowEnd - 1, range.end);
  if (current >= range.end) return { from: range.landing, stop: lastWindowHour };
  if (current < lastWindowHour) return { from: current, stop: lastWindowHour };
  return { from: current, stop: range.end };
}

type Step = (hour: number, write: "push" | "replace") => void;

/**
 * Plays time forward. Playing is something the user starts, so it runs even with "reduce
 * motion"; it adds no motion of its own beyond moving the scrubber hour by hour. The first
 * step adds one history entry, the rest replace it. Play pauses when the tab is hidden,
 * when the timeline changes, and at its stop hour.
 */
export function usePlayback(range: TimelineRange, current: number, onStep: Step) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaySpeed>(1);
  const frame = useRef<number | null>(null);
  const live = useRef({ range, current, onStep, speed });
  live.current = { range, current, onStep, speed };

  const stopLoop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  const pause = useCallback(() => {
    stopLoop();
    setPlaying(false);
  }, [stopLoop]);

  const run = useCallback(
    (from: number, stop: number, firstWrite: "push" | "replace") => {
      stopLoop();
      let shown = from;
      let write = firstWrite;
      let started: number | null = null;
      const tick = (now: number) => {
        if (started === null) started = now;
        const hour = Math.min(stop, from + Math.floor(((now - started) / 1000) * live.current.speed));
        if (hour !== shown) {
          shown = hour;
          live.current.onStep(hour, write);
          write = "replace";
        }
        if (hour >= stop) {
          frame.current = null;
          setPlaying(false);
          return;
        }
        frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    },
    [stopLoop],
  );

  const play = useCallback(() => {
    const { range: r, current: now } = live.current;
    const plan = playPlan(r, now);
    let write: "push" | "replace" = "push";
    if (plan.from !== now) {
      live.current.onStep(plan.from, "push");
      write = "replace";
    }
    setPlaying(true);
    run(plan.from, plan.stop, write);
  }, [run]);

  const toggle = useCallback(() => (playing ? pause() : play()), [playing, pause, play]);

  const changeSpeed = useCallback(() => {
    const next = nextSpeed(live.current.speed);
    setSpeed(next);
    live.current.speed = next;
    if (frame.current !== null) {
      // Keep going from the hour on screen at the new speed.
      const { range: r, current: now } = live.current;
      run(now, playPlan(r, now).stop, "replace");
    }
  }, [run]);

  // A new site, landing or duration changes what "the end" means: stop.
  useEffect(() => pause, [range.landing, range.windowEnd, range.start, range.end, pause]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pause]);

  useEffect(() => stopLoop, [stopLoop]);

  return { playing, speed, toggle, pause, changeSpeed };
}
