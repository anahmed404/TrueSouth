import { ArrowRight, ChevronLeft, RotateCcw } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Luna, useLunaReducedMotion } from "../../components/luna";
import { LESSONS, PATCH_SHELF } from "./catalog";
import { isWritten, WRITTEN_LESSONS } from "./lessons";
import { useAcademyStore } from "./store";
import { ConfirmDialog } from "./ui/dialog";
import { Stars } from "./ui/marks";
import { MissionPatch } from "./ui/patch";
import { PipGlyph } from "./ui/pip";

/**
 * The lesson path, variant b: the eight lessons spiral in across a flat map of the south
 * pole, lesson 8 on the pole itself, where Pip waits. The map's terrain is decorative tone,
 * not data; the stops are lessons, not sites.
 */

const R = 388;
const EASE = [0.16, 1, 0.3, 1] as const;

function spiralAt(t: number): [number, number] {
  const radius = R * (0.84 - 0.74 * t);
  const angle = ((-140 + t * 430) * Math.PI) / 180;
  return [R + radius * Math.cos(angle), R + radius * Math.sin(angle)];
}

function spiralPath(toT: number): string {
  const steps = Math.max(1, Math.round(140 * toT));
  let d = "";
  for (let k = 0; k <= steps; k += 1) {
    const [x, y] = spiralAt((k / steps) * toT);
    d += `${k === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return d;
}

const STOPS = LESSONS.map((_, index) => {
  const t = index / 7;
  const [x, y] = spiralAt(t);
  const angle = ((-140 + t * 430) * Math.PI) / 180;
  return { x, y, right: Math.cos(angle) > -0.2 };
});

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state ^ (state >>> 15), 1 | state) + 0x6d2b79f5) | 0;
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

/** Flat tonal terrain, decoration only. */
const TERRAIN = (() => {
  const random = seeded(5);
  return Array.from({ length: 46 }, () => {
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * R;
    return {
      cx: R + distance * Math.cos(angle),
      cy: R + distance * Math.sin(angle),
      r: 6 + random() * 26,
      opacity: 0.3 + random() * 0.35,
    };
  });
})();

type Saved = Record<string, { stars: number; xp: number; patch: boolean }>;

/** "Lessons 1 to 4": the written lessons, which are the first ones on the path. */
const READY = `Lessons 1 to ${WRITTEN_LESSONS.length}`;

function lunaLine(selected: number, saved: Saved, nextIndex: number, fresh: boolean) {
  const lesson = LESSONS[selected];
  if (lesson && !isWritten(lesson.id)) {
    return { mood: "thinking" as const, text: `I'm still writing this one. ${READY} are ready for you.` };
  }
  if (nextIndex < 0 && selected === 0 && lesson && saved[lesson.id]?.patch) {
    return { mood: "proud" as const, text: `You've finished ${READY.toLowerCase()}. The rest are still being written; replays keep your best stars.` };
  }
  if (lesson && saved[lesson.id]?.patch) return { mood: "proud" as const, text: "Back for another go? Your best stars are kept." };
  if (fresh && selected === 0) return { mood: "happy" as const, text: "Fresh start. Let's find the Sun." };
  if (selected === nextIndex) return { mood: "happy" as const, text: "This is the next stop. I'll wait for you here." };
  return { mood: "happy" as const, text: `Jump in anywhere: ${READY.toLowerCase()} are open.` };
}

export function PathMap() {
  const navigate = useNavigate();
  const reduced = useLunaReducedMotion();
  const xp = useAcademyStore((state) => state.xp);
  const patches = useAcademyStore((state) => state.patches);
  const saved = useAcademyStore((state) => state.lessons);
  const reset = useAcademyStore((state) => state.reset);

  // The next stop is the first written lesson without its patch. Lessons 5 to 8 are not written yet.
  const nextIndex = LESSONS.findIndex((lesson) => isWritten(lesson.id) && !saved[lesson.id]?.patch);
  const lastWritten = LESSONS.reduce((last, lesson, index) => (isWritten(lesson.id) ? index : last), 0);
  const [selected, setSelected] = useState(() => Math.max(0, nextIndex));
  const [resetOpen, setResetOpen] = useState(false);
  const [fresh, setFresh] = useState(false);
  const mapRef = useRef<SVGGElement>(null);

  const shelfIds = useMemo(() => new Set(PATCH_SHELF.map((patch) => patch.id)), []);
  const earned = patches.filter((id) => shelfIds.has(id));
  const savedStars = Object.values(saved).reduce((sum, item) => sum + item.stars, 0);
  const starTotal = LESSONS.reduce((sum, lesson) => sum + (saved[lesson.id]?.stars ?? 0), 0);
  const lesson = LESSONS[selected] ?? LESSONS[0];
  const stop = STOPS[selected] ?? STOPS[0];
  if (!lesson || !stop) return null;
  const lessonSaved = saved[lesson.id];
  const walkedT = (nextIndex < 0 ? lastWritten : nextIndex) / 7;
  const lessonWritten = isWritten(lesson.id);
  const line = lunaLine(selected, saved, nextIndex, fresh);

  const choose = (index: number, focus: boolean) => {
    setSelected(index);
    if (focus) requestAnimationFrame(() => mapRef.current?.querySelector<SVGGElement>(`[data-stop="${index}"]`)?.focus());
  };

  const onMapKey = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      choose(Math.min(LESSONS.length - 1, selected + 1), true);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      choose(Math.max(0, selected - 1), true);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      choose(event.key === "Home" ? 0 : LESSONS.length - 1, true);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigate(`/academy/${lesson.id}`);
    }
  };

  const nextStop = nextIndex >= 0 ? STOPS[nextIndex] : undefined;

  return (
    <main className="ac-screen ac-screen--fixed ac-screen--path">
      <header className="ac-at">
        <Link className="ac-icon-btn" to="/" aria-label="Back to the start screen">
          <ChevronLeft aria-hidden="true" />
        </Link>
        <h1>Academy</h1>
        <span className="ac-spacer" />
        <Link className="ac-quiet" to="/mission">
          Skip to Mission Control
          <ArrowRight aria-hidden="true" />
        </Link>
      </header>

      <div className="ac-path">
        <section className="ac-panel ac-map" aria-label="Lesson map">
          <p className="ac-map-cap">
            <b>Land Pip at the south pole</b>
            Eight short lessons spiral in to the pole. {READY} are ready; start anywhere.
          </p>
          <svg className="ac-map-svg" viewBox={`0 0 ${R * 2} ${R * 2}`} role="presentation">
            <defs>
              <clipPath id="ac-map-clip">
                <circle cx={R} cy={R} r={R} />
              </clipPath>
            </defs>
            <circle cx={R} cy={R} r={R} fill="var(--plot)" />
            <g clipPath="url(#ac-map-clip)" aria-hidden="true">
              {TERRAIN.map((blob, index) => (
                <circle key={index} cx={blob.cx} cy={blob.cy} r={blob.r} fill="var(--terrain)" fillOpacity={blob.opacity} />
              ))}
              {[1, 2, 3, 4, 5, 6].map((ring) => (
                <circle key={ring} cx={R} cy={R} r={(ring * R) / 6} fill="none" stroke="var(--grid)" />
              ))}
              {Array.from({ length: 12 }, (_, index) => {
                const angle = (index * 30 * Math.PI) / 180;
                return <line key={index} x1={R} y1={R} x2={R + R * Math.sin(angle)} y2={R - R * Math.cos(angle)} stroke="var(--grid)" />;
              })}
            </g>
            <circle cx={R} cy={R} r={R - 0.6} fill="none" stroke="var(--line-strong)" strokeWidth="1.2" />
            <g aria-hidden="true">
              <text x={R} y="22" textAnchor="middle" className="ac-map-label-2">0°</text>
              <text x={R * 2 - 12} y={R + 4} textAnchor="end" className="ac-map-label-2">90°E</text>
              <text x={R} y={R * 2 - 10} textAnchor="middle" className="ac-map-label-2">180°</text>
              <text x="12" y={R + 4} className="ac-map-label-2">270°E</text>
              <path d={spiralPath(1)} fill="none" stroke="var(--line-strong)" strokeWidth="3" strokeDasharray="1 9" strokeLinecap="round" />
              {walkedT > 0 ? (
                <motion.path
                  d={spiralPath(walkedT)}
                  fill="none"
                  stroke="var(--ink-3)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  initial={reduced ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.6, ease: EASE }}
                />
              ) : null}
              <path d={`M${R - 6},${R} h12 M${R},${R - 6} v12`} stroke="var(--ink-3)" strokeWidth="1.5" />
              <PipGlyph x={R} y={R - 4} scale={0.7} />
              <text x={R} y={R + 38} textAnchor="middle" className="ac-map-label-2">South pole</text>
            </g>

            <motion.circle
              r={33}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              initial={false}
              animate={{ cx: stop.x, cy: stop.y }}
              transition={{ duration: reduced ? 0 : 0.25, ease: EASE }}
              aria-hidden="true"
            />

            <g ref={mapRef} role="group" aria-label="The eight lessons, spiralling in to the pole" onKeyDown={onMapKey}>
              {LESSONS.map((item, index) => {
                const point = STOPS[index];
                if (!point) return null;
                const done = saved[item.id];
                const ready = isWritten(item.id);
                const isNext = index === nextIndex;
                const isSelected = index === selected;
                const offset = isSelected ? 42 : 34;
                const labelX = point.x + (point.right ? offset : -offset);
                const anchor = point.right ? "start" : "end";
                return (
                  <g
                    key={item.id}
                    className="ac-stop"
                    data-stop={index}
                    role="button"
                    tabIndex={isSelected ? 0 : -1}
                    aria-pressed={isSelected}
                    aria-label={`Lesson ${index + 1}, ${item.title}${
                      !ready ? ", not written yet" : done?.patch ? `, done, ${done.stars} of 3 stars` : isNext ? ", next up" : ""
                    }`}
                    onClick={() => choose(index, true)}
                  >
                    <circle className="ac-stop-focus" cx={point.x} cy={point.y} r={46} fill="transparent" stroke="none" />
                    {done?.patch ? (
                      <g transform={`translate(${point.x - 26} ${point.y - 26})`}>
                        <MissionPatch id={item.id} earned size={52} />
                      </g>
                    ) : (
                      <>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={26}
                          fill={isNext ? "var(--raised)" : "var(--surface)"}
                          stroke={isNext ? "var(--accent)" : ready ? "var(--line-strong)" : "var(--line)"}
                          strokeDasharray={ready ? undefined : "4 4"}
                          strokeWidth={isNext ? 2 : 1}
                        />
                        <text
                          x={point.x}
                          y={point.y + 8}
                          textAnchor="middle"
                          fontSize="22"
                          fontWeight="600"
                          fill={isNext ? "var(--ink)" : ready ? "var(--ink-2)" : "var(--ink-3)"}
                        >
                          {index + 1}
                        </text>
                      </>
                    )}
                    <text x={labelX} y={point.y - 2} textAnchor={anchor} className={ready ? "ac-map-label" : "ac-map-label ac-map-label--soon"}>
                      {item.title}
                    </text>
                    {!ready ? (
                      <text x={labelX} y={point.y + 17} textAnchor={anchor} className="ac-map-label-2">
                        Not written yet
                      </text>
                    ) : done?.patch ? (
                      <text x={labelX} y={point.y + 17} textAnchor={anchor} className="ac-map-label-2">
                        {done.stars} of 3 stars · {done.xp} XP
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>

            {nextStop ? (
              <g
                transform={
                  nextStop.y < R * 0.7
                    ? `translate(${nextStop.x + 22} ${nextStop.y + 22})`
                    : `translate(${nextStop.x + 10} ${nextStop.y - 96})`
                }
                aria-hidden="true"
              >
                <Luna mood="happy" size={64} decorative />
              </g>
            ) : null}
          </svg>

          <div className="ac-pick" role="group" aria-label="Choose a lesson">
            {LESSONS.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Lesson ${index + 1}, ${item.title}${isWritten(item.id) ? "" : ", not written yet"}`}
                aria-pressed={index === selected}
                data-soon={isWritten(item.id) ? undefined : ""}
                onClick={() => choose(index, false)}
              >
                <span>{index + 1}</span>
              </button>
            ))}
          </div>

          <p className="ac-keys ac-map-keys">
            Tab to the map, then <span className="ac-kbd">←</span>
            <span className="ac-kbd">→</span> to move along it, <span className="ac-kbd">Enter</span> to open.
          </p>
        </section>

        <aside className="ac-panel ac-side" aria-label={`Lesson ${selected + 1}`}>
          <div className="ac-who ac-msg ac-msg--new">
            <Luna mood={line.mood} size={88} decorative className="ac-msg-luna" />
            <p className="ac-say" aria-live="polite">
              {line.text}
            </p>
          </div>

          <section className="ac-lesson" aria-labelledby="ac-lesson-title">
            <h2 id="ac-lesson-title">
              {selected + 1} · {lesson.title}
            </h2>
            <p className="ac-lesson-tag">{lesson.tagline}</p>
            <div className="ac-lesson-meta">
              <MissionPatch id={lesson.id} earned={Boolean(lessonSaved?.patch)} size={40} />
              {lessonSaved?.patch ? (
                <span>
                  <Stars count={lessonSaved.stars} size={16} /> {lessonSaved.xp} XP · {lesson.patchName} patch
                </span>
              ) : lessonWritten ? (
                <span>Five short steps. Earns the {lesson.patchName} patch.</span>
              ) : (
                <span>Not written yet. It will earn the {lesson.patchName} patch.</span>
              )}
            </div>
            {lessonWritten ? (
              <Link className="ac-btn ac-btn--primary" to={`/academy/${lesson.id}`}>
                {lessonSaved?.patch ? "Replay lesson" : "Start lesson"} {selected + 1}
                <ArrowRight aria-hidden="true" />
              </Link>
            ) : null}
          </section>

          <section className="ac-sum" aria-labelledby="ac-sum-title">
            <h2 id="ac-sum-title">Your mission so far</h2>
            <p className="ac-nums">
              <span>
                <b>{xp}</b>XP
              </span>
              <span>
                <b>{starTotal}</b>of 24 stars
              </span>
              <span>
                <b>{earned.length}</b>of 9 patches
              </span>
            </p>
            <ul className="ac-shelf" aria-label="Mission patches">
              {PATCH_SHELF.map((patch) => (
                <li key={patch.id}>
                  <MissionPatch id={patch.id} earned={earned.includes(patch.id)} size={44} label={patch.name} />
                </li>
              ))}
            </ul>
            <div className="ac-foot">
              <span>Saved in this browser</span>
              <button type="button" className="ac-quiet" onClick={() => setResetOpen(true)}>
                <RotateCcw aria-hidden="true" />
                Reset progress
              </button>
            </div>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={resetOpen}
        title="Start over?"
        keepLabel="Keep my progress"
        confirmLabel="Reset progress"
        onKeep={() => setResetOpen(false)}
        onConfirm={() => {
          reset();
          setResetOpen(false);
          setSelected(0);
          setFresh(true);
        }}
      >
        <p>
          This clears your {xp} XP, {savedStars} {savedStars === 1 ? "star" : "stars"} and {patches.length}{" "}
          {patches.length === 1 ? "patch" : "patches"} saved in this browser. It can't be undone.
        </p>
      </ConfirmDialog>
    </main>
  );
}
