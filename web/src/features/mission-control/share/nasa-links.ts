/**
 * Links that open a site in NASA's own map tools (docs/features/share-export.md, "Links to
 * NASA tools"). Both formats were confirmed in MC9 by opening the link and reading the
 * tool's own coordinate readout at the map centre, for Apollo 11 (0.674° N, 23.473° E) and
 * Connecting Ridge (−89.456°, 222.619° E). Neither tool documents its link format; the
 * parameters come from each tool's own share links and map configuration.
 *
 * - **LROC QuickMap** (now hosted at quickmap.lroc.im-ldi.com; the old ASU address
 *   redirects there): `/layers?extent=<minLon>,<minLat>,<maxLon>,<maxLat>&proj=<id>&features=<lon>,<lat>`.
 *   The extent is always longitude and latitude in degrees, −180 to 180, whatever the
 *   projection; `features` drops a marker on the site. `proj=16` is equidistant
 *   cylindrical, `proj=27` south-pole stereographic.
 * - **Moon Trek**: `#v=0.1&x=<x>&y=<y>&z=<zoom>&p=<projection URN>`. In the cylindrical
 *   projection (`EPSG::104903`) x and y are longitude (−180 to 180) and latitude in degrees.
 *   In the south-pole projection (`IAU2000::30120`) they are polar-stereographic metres on
 *   the 1,737.4 km sphere.
 *
 * The coordinates are shown beside the links too, for the user to type into either tool.
 * Geometry here only places a map view; it is not terrain or ephemeris science.
 */

import { formatNumber } from "../../../components/format";

export const QUICKMAP_HOME = "https://quickmap.lroc.im-ldi.com/";
export const MOONTREK_HOME = "https://trek.nasa.gov/moon/";

/** South of this latitude both tools open in their south-pole projection. */
export const POLAR_LATITUDE_DEG = -80;

/** The Moon's reference radius, in metres, as both tools use it. */
const MOON_RADIUS_M = 1_737_400;

/** Half the width of the Quickmap view, in metres on the ground: a view about 3 km across. */
const QUICKMAP_HALF_VIEW_M = 1_500;

export type NasaLink = {
  tool: "Quickmap" | "Moon Trek";
  href: string;
  /** True when the link opens the map centred on the site. */
  centred: boolean;
};

/** East longitude 0–360 to −180–180. */
export function signedLongitude(lonEastDeg: number): number {
  const wrapped = ((((lonEastDeg + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}

function fixed(value: number, decimals: number): string {
  return Number(value.toFixed(decimals)).toString();
}

export function quickmapLink(latDeg: number, lonEastDeg: number): NasaLink {
  const lon = signedLongitude(lonEastDeg);
  const halfLat = (QUICKMAP_HALF_VIEW_M / MOON_RADIUS_M) * (180 / Math.PI);
  // The same ground distance east and west: wider in longitude near the pole.
  const cosLat = Math.max(Math.cos((latDeg * Math.PI) / 180), 1e-3);
  const halfLon = Math.min(halfLat / cosLat, 20);
  const extent = [lon - halfLon, Math.max(latDeg - halfLat, -90), lon + halfLon, Math.min(latDeg + halfLat, 90)]
    .map((v) => fixed(v, 4))
    .join(",");
  const proj = latDeg <= POLAR_LATITUDE_DEG ? 27 : 16;
  const href = `${QUICKMAP_HOME}layers?extent=${extent}&proj=${proj}&features=${fixed(lon, 4)},${fixed(latDeg, 4)}`;
  return { tool: "Quickmap", href, centred: true };
}

const CYLINDRICAL = "urn:ogc:def:crs:EPSG::104903";
const SOUTH_POLE = "urn:ogc:def:crs:IAU2000::30120";

/** Polar-stereographic metres for the south pole, as Moon Trek's `IAU2000::30120` uses them. */
export function southPolarMetres(latDeg: number, lonEastDeg: number): { x: number; y: number } {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonEastDeg * Math.PI) / 180;
  const rho = 2 * MOON_RADIUS_M * Math.tan(Math.PI / 4 + lat / 2);
  return { x: rho * Math.sin(lon), y: rho * Math.cos(lon) };
}

export function moonTrekLink(latDeg: number, lonEastDeg: number): NasaLink {
  let x: string;
  let y: string;
  let projection: string;
  if (latDeg <= POLAR_LATITUDE_DEG) {
    const metres = southPolarMetres(latDeg, lonEastDeg);
    x = fixed(metres.x, 0);
    y = fixed(metres.y, 0);
    projection = SOUTH_POLE;
  } else {
    x = fixed(signedLongitude(lonEastDeg), 4);
    y = fixed(latDeg, 4);
    projection = CYLINDRICAL;
  }
  const href = `${MOONTREK_HOME}#v=0.1&x=${x}&y=${y}&z=8&p=${encodeURIComponent(projection)}&d=`;
  return { tool: "Moon Trek", href, centred: true };
}

/** "−89.4555°, 222.6190° E", to type into either tool. */
export function coordinatesText(latDeg: number, lonEastDeg: number): string {
  return `${formatNumber(latDeg, 4)}°, ${formatNumber(lonEastDeg, 4)}° E`;
}
