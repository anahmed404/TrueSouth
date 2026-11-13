import type { ReactNode } from "react";
import { Luna } from "../../components/luna";

/*
  The start screen's two portholes. They are illustrations, not results: the skyline is a
  made-up curve, so nothing here is read as data. Colours are tokens (see shell.css).
*/

/** A made-up polar skyline, elevation in degrees for an azimuth in degrees. */
const SKYLINE_KNOTS: readonly [number, number][] = [
  [0, -0.4], [12, -0.12], [25, 0.35], [34, 0.12], [48, 0.62], [58, 0.92], [66, 0.5], [80, -0.25],
  [95, -0.95], [108, -1.25], [120, -0.62], [128, 0.18], [133, 0.38], [137, 0.55], [140, 0.95],
  [142.5, 1.32], [146, 1.02], [152, 0.48], [165, 0.06], [180, -0.32], [195, 0.18], [210, 0.62],
  [222, 0.92], [228, 1.18], [231.2, 1.47], [234, 1.08], [240, 0.7], [248, 0.62], [256, 0.86],
  [263.6, 0.9], [265.9, 1.3], [267.2, 0.92], [274, 0.7], [282, 0.25], [292, -0.5], [305, -1.05],
  [318, -0.7], [332, -0.18], [345, 0.1], [360, -0.4],
];

export function illustrativeSkyline(azDeg: number): number {
  const a = ((azDeg % 360) + 360) % 360;
  let base = SKYLINE_KNOTS[0]?.[1] ?? 0;
  for (let i = 0; i < SKYLINE_KNOTS.length - 1; i++) {
    const [a0, e0] = SKYLINE_KNOTS[i] ?? [0, 0];
    const [a1, e1] = SKYLINE_KNOTS[i + 1] ?? [0, 0];
    if (a >= a0 && a <= a1) {
      const t = (a - a0) / (a1 - a0);
      base = e0 + ((e1 - e0) * (1 - Math.cos(Math.PI * t))) / 2;
      break;
    }
  }
  const r = (a * Math.PI) / 180;
  return base + 0.045 * Math.sin(r * 37) + 0.03 * Math.sin(r * 91 + 1.3) + 0.02 * Math.sin(r * 173 + 0.4);
}

function polyline(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
}

const C = 172;

function Bezel({ id, labels, children }: { id: string; labels: [number, string][]; children: ReactNode }) {
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const a = (i / 72) * 2 * Math.PI - Math.PI / 2;
    const big = i % 9 === 0;
    const r2 = big ? 157 : 162;
    return (
      <line
        key={i}
        className="port-tick"
        x1={C + 166 * Math.cos(a)}
        y1={C + 166 * Math.sin(a)}
        x2={C + r2 * Math.cos(a)}
        y2={C + r2 * Math.sin(a)}
        strokeOpacity={big ? 1 : 0.45}
        strokeWidth={big ? 1.5 : 1}
      />
    );
  });
  return (
    <>
      <defs>
        <clipPath id={`${id}-window`}>
          <circle cx={C} cy={C} r={136} />
        </clipPath>
      </defs>
      <circle className="port-bezel" cx={C} cy={C} r={170} />
      {ticks}
      {labels.map(([deg, text]) => {
        const a = (deg * Math.PI) / 180 - Math.PI / 2;
        return (
          <text key={text} className="port-label" x={C + 149 * Math.cos(a)} y={C + 149 * Math.sin(a) + 4.5} textAnchor="middle">
            {text}
          </text>
        );
      })}
      <g clipPath={`url(#${id}-window)`}>
        <rect className="port-sky" x={0} y={0} width={344} height={344} />
        {children}
      </g>
      <circle className="port-rim" cx={C} cy={C} r={136} />
    </>
  );
}

const LAMPS: { tone: string; glyph: string }[] = [
  { tone: "var(--status-go)", glyph: "M-3.4 .4l2.2 2.2 4.6-4.8" },
  { tone: "var(--status-caution)", glyph: "M0 -4v4.4M0 3.6v.3" },
  { tone: "var(--status-nogo)", glyph: "M-3 -3l6 6M3 -3l-6 6" },
];

/** Mission Control's door: a small Lander's eye with the planner's answer in miniature. */
export function MissionPorthole() {
  const X = (a: number) => 172 + (a - 200) * 1.75;
  const Y = (e: number) => 220 - e * 30;
  const sky: [number, number][] = [];
  for (let a = 100; a <= 300; a += 0.5) sky.push([X(a), Y(illustrativeSkyline(a))]);
  const skyPath = polyline(sky);
  const sunPath: [number, number][] = [];
  for (let h = 0; h <= 240; h += 2) {
    const a = 298 - 0.5083 * h;
    if (a <= 300) sunPath.push([X(a), Y(0.8 + 0.0046 * h - 0.0000025 * h * h)]);
  }
  const mask: [number, number][] = [];
  for (let a = 124; a <= 152; a += 0.5) mask.push([X(a), Y(illustrativeSkyline(a) + 1)]);
  const earthPath: [number, number][] = [];
  for (let h = 0; h <= 240; h += 4) earthPath.push([X(133 + (8 * h) / 240), Y(3.399 - 0.0068 * h)]);
  const sx = X(265.98);
  const sy = Y(1.08);

  return (
    <svg viewBox="0 0 344 344" className="door-port" aria-hidden="true" focusable="false">
      <Bezel id="port-mc" labels={[[0, "N"], [90, "E"], [180, "S"], [270, "W"]]}>
        <clipPath id="port-mc-above">
          <path d={`${skyPath}L400,0L0,0Z`} />
        </clipPath>
        {[-1, 0, 1, 2, 3, 4].map((e) => (
          <line key={e} className="port-grid" x1={0} x2={344} y1={Y(e)} y2={Y(e)} />
        ))}
        <path className="port-sun-path" d={polyline(sunPath)} />
        <path className="port-mask" d={polyline(mask)} />
        <path className="port-earth-path" d={polyline(earthPath)} />
        <ellipse className="port-sun" cx={sx} cy={sy} rx={3} ry={8} fillOpacity={0.3} />
        <ellipse className="port-sun" cx={sx} cy={sy} rx={3} ry={8} clipPath="url(#port-mc-above)" />
        <ellipse className="port-earth" cx={X(135.66)} cy={Y(2.97)} rx={4} ry={28} />
        <path className="port-terrain" d={`${skyPath}L400,400L0,400Z`} />
        <path className="port-skyline" d={skyPath} />
        {LAMPS.map((lamp, i) => {
          const x = 126 + i * 46;
          return (
            <g key={lamp.glyph} transform={`translate(${x} 282)`}>
              <circle r={11} style={{ fill: lamp.tone }} />
              <path className="port-lamp-glyph" d={lamp.glyph} />
            </g>
          );
        })}
      </Bezel>
    </svg>
  );
}

/** The Academy's door: Luna watching Pip on a ridge at sunrise, eight lessons round the rim. */
export function AcademyPorthole() {
  const ridge = "M0 262 L40 250 L78 236 L104 244 L138 222 L170 232 L204 226 L236 238 L262 230 L300 246 L344 240";
  return (
    <div className="door-port-wrap">
      <svg viewBox="0 0 344 344" className="door-port" aria-hidden="true" focusable="false">
        <Bezel id="port-ac" labels={[[0, "1"], [45, "2"], [90, "3"], [135, "4"], [180, "5"], [225, "6"], [270, "7"], [315, "8"]]}>
          <circle className="port-sun" cx={262} cy={224} r={12} />
          <path className="port-path" d="M70 250 C 110 190, 150 170, 190 160" />
          <path className="port-terrain" d={`${ridge} L344 344 L0 344Z`} />
          <path className="port-skyline" d={ridge} />
          <g transform="translate(184 199)">
            <path className="port-pip-legs" d="M-14 22 L-8 8 M14 22 L8 8 M0 22 L0 10" />
            <rect className="port-pip-body" x={-11} y={-4} width={22} height={14} rx={3} />
            <rect className="port-pip-lit" x={1} y={-4} width={10} height={14} rx={2} />
            <rect className="port-pip-panel" x={-26} y={-1} width={13} height={7} rx={1.5} />
            <rect className="port-pip-panel" x={13} y={-1} width={13} height={7} rx={1.5} />
            <path className="port-pip-mast" d="M0 -4 L0 -12" />
            <circle className="port-pip-dish" cx={0} cy={-13} r={2.4} />
            <text className="port-pip-name" x={0} y={44} textAnchor="middle">
              Pip
            </text>
          </g>
          <g transform="translate(176 140)">
            <path
              className="port-bubble"
              d="M14 -18 H100 A14 14 0 0 1 114 -4 V8 A14 14 0 0 1 100 22 H14 A14 14 0 0 1 0 8 V-6 L-14 -16 L2 -12 A14 14 0 0 1 14 -18Z"
            />
            <text className="port-bubble-text" x={12} y={-1}>
              My south pole is a
            </text>
            <text className="port-bubble-text" x={12} y={13}>
              strange place.
            </text>
          </g>
        </Bezel>
      </svg>
      <span className="door-luna">
        <Luna mood="happy" size={100} decorative />
      </span>
    </div>
  );
}
