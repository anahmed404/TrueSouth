import { motion } from "motion/react";
import { useMemo, type CSSProperties } from "react";
import { useLunaReducedMotion } from "../../../components/luna";

/**
 * Moondust: a correct answer kicks up regolith that rises and settles slowly, the way dust
 * moves in the Moon's low gravity. Moonlight and grey specks, no confetti colours.
 * Plays once on mount; give it a new `key` to play again. Nothing under reduce motion.
 */

type Particle = { vx: number; vy: number; size: number; colour: string };

/** A small seeded random generator, so a burst looks the same each time. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state ^ (state >>> 15), 1 | state) + 0x6d2b79f5) | 0;
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

const COLOURS = ["var(--accent)", "var(--accent)", "var(--ink-2)", "var(--sun-core)"] as const;

function particles(count: number, seed: number, spread: number): Particle[] {
  const random = seeded(seed);
  return Array.from({ length: count }, () => {
    const angle = ((-90 + (random() - 0.5) * 150) * Math.PI) / 180;
    const speed = (90 + random() * 150) * spread;
    const pick = random();
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 2 + random() * 4.5,
      colour: COLOURS[pick < 0.6 ? 0 : pick < 0.85 ? 2 : 3] ?? "var(--accent)",
    };
  });
}

/** Ten samples of a ballistic arc under weak gravity, as keyframes. */
function track(particle: Particle, duration: number, gravity: number) {
  const xs: number[] = [];
  const ys: number[] = [];
  const opacity: number[] = [];
  for (let k = 0; k <= 10; k += 1) {
    const t = (k / 10) * duration;
    xs.push(particle.vx * t);
    ys.push(particle.vy * t + 0.5 * gravity * t * t);
    opacity.push(k < 7 ? 1 : 1 - (k - 7) / 3);
  }
  return { x: xs, y: ys, opacity };
}

type MoondustProps = {
  /** "small" on a correct answer (26 specks, 1.1 s); "big" at lesson end (44, 1.4 s). */
  size?: "small" | "big";
  seed?: number;
  /** Draw as SVG circles inside a scene, at (x, y) in its units. */
  svgAt?: { x: number; y: number; scale?: number };
  /** Or as an absolutely placed HTML layer, at left/top percentages of its parent. */
  style?: CSSProperties;
};

export function Moondust({ size = "small", seed = 7, svgAt, style }: MoondustProps) {
  const reduced = useLunaReducedMotion();
  const big = size === "big";
  const duration = big ? 1.4 : 1.1;
  const list = useMemo(() => particles(big ? 44 : 26, seed, big ? 1.25 : 1), [big, seed]);
  if (reduced) return null;

  if (svgAt) {
    const scale = svgAt.scale ?? 1;
    return (
      <g transform={`translate(${svgAt.x} ${svgAt.y}) scale(${scale})`} aria-hidden="true" pointerEvents="none">
        {list.map((particle, index) => (
          <motion.circle
            key={index}
            r={particle.size / 2}
            fill={particle.colour}
            initial={{ x: 0, y: 0, opacity: 1 }}
            animate={track(particle, duration, 150)}
            transition={{ duration, ease: "linear" }}
          />
        ))}
      </g>
    );
  }

  return (
    <div className="ac-dust" aria-hidden="true" style={style}>
      {list.map((particle, index) => (
        <motion.i
          key={index}
          style={{ width: particle.size, height: particle.size, background: particle.colour }}
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={track(particle, duration, 150)}
          transition={{ duration, ease: "linear" }}
        />
      ))}
    </div>
  );
}
