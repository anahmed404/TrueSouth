import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";
import { useLunaReducedMotion } from "../../../components/luna";
import { Moondust } from "../ui/moondust";
import { PipGlyph } from "../ui/pip";

/**
 * Stage scenes for choice and predict steps. They are illustrations driven by lesson data:
 * every angle drawn comes from the step (or a worked example), never from a computation
 * of where the Sun is.
 */

const EASE = [0.16, 1, 0.3, 1] as const;
const VIEW_W = 820;
const VIEW_H = 500;
const PIP_X = 150;
const GROUND_Y = 420;
const RULER_R = 340;

const GROUND =
  "M-400 430 L0 432 L60 428 L120 424 L190 426 L260 420 L330 424 L420 418 L520 426 L600 421 L700 428 L820 424 L1400 426";

function point(angleDeg: number, radius: number): [number, number] {
  const radians = (angleDeg * Math.PI) / 180;
  return [PIP_X + radius * Math.cos(radians), GROUND_Y - radius * Math.sin(radians)];
}

/** Pip on the ground; hops and kicks up moondust each time `celebrate` changes. */
function PipOnGround({ celebrate, caption }: { celebrate: number; caption: string }) {
  const reduced = useLunaReducedMotion();
  return (
    <>
      <path d={`${GROUND} L1400 520 L-400 520Z`} fill="var(--terrain)" />
      <path d={GROUND} fill="none" stroke="var(--terrain-rim)" strokeWidth="1.3" />
      <motion.g
        key={`pip-${celebrate}`}
        initial={{ y: 0 }}
        animate={celebrate > 0 && !reduced ? { y: [0, -14, 0] } : { y: 0 }}
        transition={{ duration: 0.7, ease: EASE, times: [0, 0.4, 1] }}
      >
        <PipGlyph x={PIP_X} y={GROUND_Y - 12} scale={1.5} />
      </motion.g>
      {celebrate > 0 ? <Moondust key={`dust-${celebrate}`} seed={celebrate + 6} svgAt={{ x: PIP_X, y: GROUND_Y + 8 }} /> : null}
      <text x={PIP_X} y="482" textAnchor="middle" fontSize="17" fill="var(--ink-2)">
        {caption}
      </text>
    </>
  );
}

type Mark = { angle: number; label: string; kind: "selected" | "missed" | "answer" };

/** One line on the ruler, with its label. A moving line swings to its angle in 250 ms. */
function RulerLine({ mark }: { mark: Mark }) {
  const reduced = useLunaReducedMotion();
  const width = Math.max(96, mark.label.length * 9.5 + 36);
  const angle = useMotionValue(mark.angle);
  useEffect(() => {
    if (reduced) {
      angle.set(mark.angle);
      return;
    }
    const controls = animate(angle, mark.angle, { duration: 0.25, ease: EASE });
    return () => controls.stop();
  }, [mark.angle, reduced, angle]);

  const x2 = useTransform(angle, (value) => point(value, RULER_R)[0]);
  const y2 = useTransform(angle, (value) => point(value, RULER_R)[1]);
  const labelX = useTransform(angle, (value) => point(value, RULER_R - 70)[0]);
  const labelY = useTransform(angle, (value) => point(value, RULER_R - 70)[1]);
  const rectX = useTransform(labelX, (value) => value - width / 2);
  const rectY = useTransform(labelY, (value) => value - 17);
  const textY = useTransform(labelY, (value) => value + 6);

  const missed = mark.kind === "missed";
  const stroke = missed ? "var(--ink-3)" : "var(--accent)";
  return (
    <g>
      <motion.line
        x1={PIP_X}
        y1={GROUND_Y}
        x2={x2}
        y2={y2}
        stroke={stroke}
        strokeWidth={missed ? 1.5 : 2}
        strokeDasharray={missed ? "5 6" : undefined}
      />
      <motion.rect
        x={rectX}
        y={rectY}
        width={width}
        height={32}
        rx={16}
        fill="var(--plot)"
        stroke={stroke}
        strokeDasharray={missed ? "4 4" : undefined}
      />
      <motion.text x={labelX} y={textY} textAnchor="middle" fontSize="17" fill={missed ? "var(--ink-2)" : "var(--ink)"}>
        {mark.label}
      </motion.text>
    </g>
  );
}

type SkyRulerProps = {
  caption: string;
  marks: readonly Mark[];
  celebrate: number;
  /** What the drawing shows, for screen readers. */
  description: string;
};

/** Pip on the ground under a quarter circle from the horizon (0°) to straight up (90°). */
export function SkyRuler({ caption, marks, celebrate, description }: SkyRulerProps) {
  let arc = "";
  for (let angle = 0; angle <= 90; angle += 1) {
    const [x, y] = point(angle, RULER_R);
    arc += `${angle === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return (
    <svg className="ac-scene" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMinYMax meet" role="img" aria-label={description}>
      <path d={arc} fill="none" stroke="var(--line-strong)" strokeWidth="2" />
      {[0, 15, 30, 45, 60, 75, 90].map((angle) => {
        const [x1, y1] = point(angle, RULER_R - 10);
        const [x2, y2] = point(angle, RULER_R + 10);
        const [tx, ty] = point(angle, RULER_R + 32);
        return (
          <g key={angle}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink-3)" strokeWidth="1.5" />
            <text x={tx} y={ty + 5} textAnchor="middle" fontSize="17" fill="var(--ink-3)">
              {angle}°
            </text>
          </g>
        );
      })}
      {marks
        .filter((mark) => mark.kind === "missed")
        .map((mark) => (
          <RulerLine key={`missed-${mark.label}`} mark={mark} />
        ))}
      {marks
        .filter((mark) => mark.kind !== "missed")
        .map((mark) => (
          <RulerLine key="live" mark={mark} />
        ))}
      <PipOnGround celebrate={celebrate} caption={caption} />
    </svg>
  );
}

/** Pip standing on the ground, with a caption: the default scene. */
export function PipScene({ caption, celebrate }: { caption: string; celebrate: number }) {
  return (
    <svg className="ac-scene" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMinYMax meet" role="img" aria-label={caption}>
      <PipOnGround celebrate={celebrate} caption={caption} />
    </svg>
  );
}

/** Height of the ground on the drawing's circle at x: a sphere seen side-on, much exaggerated. */
function groundY(x: number): number {
  const cx = 170;
  const cy = 1900;
  const r = 1500;
  return cy - Math.sqrt(r * r - (x - cx) * (x - cx));
}

function arcPath(from: number, to: number): string {
  let d = "";
  for (let x = from; x <= to; x += 10) d += `${x === from ? "M" : "L"}${x},${groundY(x).toFixed(1)}`;
  return d;
}

/**
 * Lesson 3's reveal: the round Moon side-on, with a level line from Pip and a far
 * mountain whose base has dropped below it, so only its tip shows. A schematic drawing,
 * not to scale; the real drop is in the caption, from the worked examples.
 */
export function CurvedMoonSide({ label }: { label: string }) {
  const tipX = 700;
  const ground = arcPath(-200, 1020);
  const mountain = `M630,${groundY(630).toFixed(1)} L${tipX},382 L770,${groundY(770).toFixed(1)}Z`;
  const dropX = 600;
  return (
    <svg className="ac-scene" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMax meet" role="img" aria-label={label}>
      <defs>
        <clipPath id="ac-above-level">
          <rect x="0" y="0" width={VIEW_W} height="400" />
        </clipPath>
      </defs>
      <path d={`${ground} L1020,520 L-200,520Z`} fill="var(--terrain)" />
      <path d={ground} fill="none" stroke="var(--terrain-rim)" strokeWidth="1.3" />
      <path d={mountain} fill="var(--terrain)" stroke="var(--terrain-rim)" strokeWidth="1.3" />
      <path d={mountain} fill="var(--ink-2)" clipPath="url(#ac-above-level)" />
      <line x1="170" y1="400" x2="800" y2="400" stroke="var(--accent)" strokeWidth="2" strokeDasharray="8 7" />
      <text x="300" y="388" fontSize="21" fill="var(--ink-2)">
        level line from Pip
      </text>
      <line x1={dropX} y1="404" x2={dropX} y2={groundY(dropX) - 4} stroke="var(--ink-3)" strokeWidth="1.5" />
      <text x={dropX - 10} y="440" textAnchor="end" fontSize="21" fill="var(--ink-2)">
        the ground drops
      </text>
      <text x={tipX} y="364" textAnchor="middle" fontSize="21" fill="var(--ink)">
        only the tip shows
      </text>
      <PipGlyph x={170} y={388} scale={1.3} />
      <text x="170" y="482" textAnchor="middle" fontSize="21" fill="var(--ink-2)">
        Pip
      </text>
      <text x="800" y="490" textAnchor="end" fontSize="18" fill="var(--ink-3)">
        not to scale
      </text>
    </svg>
  );
}

export type { Mark as RulerMark };
