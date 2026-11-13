import * as THREE from "three";

/**
 * The star background (docs/features/system-view.md, "Stars"): the Yale Bright Star
 * Catalogue to magnitude 6.5, from web/public/stars.bin (how it is made, its source and the
 * fixed orientation it uses: web/dev/build-stars.mjs). Stars are decoration: they never
 * decide or imply a result, and they are not positioned for the scrubber's time.
 *
 * One draw of points, sized and dimmed by magnitude and faintly tinted by colour index. Each
 * star is a direction at infinity, so it moves with the camera's turn, never with its
 * position. It draws first, with no depth test, so the Moon, Earth, the Sun and the ground
 * always cover it. Nothing here runs per frame but two uniforms.
 */

export const STARS_URL = "/stars.bin";
const MAGIC = "TSSTARS1";

export type StarData = { directions: Float32Array; magnitudes: Float32Array; colours: Float32Array; count: number };

/** Decodes stars.bin (see build-stars.mjs for the layout). */
export function decodeStars(buffer: ArrayBuffer): StarData {
  const view = new DataView(buffer);
  const magic = new TextDecoder("latin1").decode(new Uint8Array(buffer, 0, 8));
  if (magic !== MAGIC) throw new Error("stars.bin: not a star file");
  const count = view.getUint32(8, true);
  if (buffer.byteLength < 12 + count * 8) throw new Error("stars.bin: too short");
  const directions = new Float32Array(count * 3);
  const magnitudes = new Float32Array(count);
  const colours = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const o = 12 + i * 8;
    for (let k = 0; k < 3; k += 1) directions[i * 3 + k] = view.getInt16(o + k * 2, true) / 32767;
    magnitudes[i] = view.getUint8(o + 6) / 20 - 2;
    colours[i] = view.getInt8(o + 7) / 50;
  }
  return { directions, magnitudes, colours, count };
}

/**
 * How bright a star of V magnitude `m` is drawn, 0 to 1. Starlight goes as 10^(−0.4 m); the
 * exponent is softened to 10^(−0.17 m), as a photograph's tone curve does, so that the stars
 * brighter than 2.5 are full white, a 4th-magnitude star about half, and the 6th-magnitude
 * stars that make up most of the catalogue about a quarter: there, but faint.
 * (The vertex shader in this file uses the same curve.)
 */
export function starBrightness(m: number): number {
  return Math.min(1, Math.max(0, 10 ** (-0.17 * (m - 2.5))));
}

/** The drawn diameter in CSS pixels: 1 px for faint stars, up to 2.6 px for the brightest. */
export function starSize(m: number): number {
  return Math.min(2.6, Math.max(1, 2.3 - 0.3 * m));
}

/**
 * How much starlight the camera would record, 0.35 to 1: a lit Moon filling the view, like a
 * short exposure, washes out the faint stars. `moonFill` is the share of the view the Moon's
 * disc covers.
 */
export function starExposure(moonFill: number): number {
  const t = Math.min(1, Math.max(0, (moonFill - 0.12) / (0.7 - 0.12)));
  return 1 - 0.65 * t * t * (3 - 2 * t);
}

const vertex = /* glsl */ `
  attribute float magnitude;
  attribute float colourIndex;
  uniform float pixelRatio;
  uniform float exposure;
  uniform vec3 sunDir;
  uniform float sunOn;
  varying vec3 vColour;
  varying float vAlpha;

  vec3 tint(float bv) {
    // B−V to a star's colour, then mostly washed to white: a faint tint, not a colour.
    vec3 blue = vec3(0.78, 0.86, 1.0);
    vec3 white = vec3(1.0);
    vec3 yellow = vec3(1.0, 0.92, 0.78);
    vec3 orange = vec3(1.0, 0.80, 0.62);
    vec3 c = bv < 0.3 ? mix(blue, white, clamp((bv + 0.3) / 0.6, 0.0, 1.0))
           : bv < 1.0 ? mix(white, yellow, (bv - 0.3) / 0.7)
           : mix(yellow, orange, clamp((bv - 1.0) / 0.8, 0.0, 1.0));
    return mix(white, c, 0.6);
  }

  void main() {
    // A direction at infinity: only the camera's turn moves it.
    vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * position, 0.0);
    clip.z = 0.0;
    gl_Position = clip;
    float b = clamp(pow(10.0, -0.17 * (magnitude - 2.5)), 0.0, 1.0);
    // Near the Sun the glare hides the stars.
    float glare = sunOn * smoothstep(0.94, 0.995, dot(normalize(position), sunDir));
    vAlpha = b * exposure * (1.0 - glare);
    vColour = tint(colourIndex);
    gl_PointSize = clamp(2.3 - 0.3 * magnitude, 1.0, 2.6) * pixelRatio;
  }
`;

const fragment = /* glsl */ `
  varying vec3 vColour;
  varying float vAlpha;
  void main() {
    // A hard-edged dot with one pixel of soft edge: no halo.
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = vAlpha * (1.0 - smoothstep(0.6, 1.0, d));
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColour * a, a);
  }
`;

export class Stars {
  readonly points: THREE.Points;
  private readonly material: THREE.ShaderMaterial;
  private readonly geometry = new THREE.BufferGeometry();
  private disposed = false;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        pixelRatio: { value: 1 },
        exposure: { value: 1 },
        sunDir: { value: new THREE.Vector3(1, 0, 0) },
        sunOn: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
      // Additive, premultiplied: a star only ever lightens the black of space.
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendEquation: THREE.AddEquation,
      transparent: false,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    // Drawn before everything else, so every body and the ground covers it.
    this.points.renderOrder = -1_000;
    this.points.visible = false;
  }

  /** Loads stars.bin. Without it there are simply no stars. */
  async load(onReady: () => void): Promise<void> {
    try {
      const response = await fetch(STARS_URL);
      if (!response.ok) return;
      const data = decodeStars(await response.arrayBuffer());
      if (this.disposed) return;
      this.geometry.setAttribute("position", new THREE.BufferAttribute(data.directions, 3));
      this.geometry.setAttribute("magnitude", new THREE.BufferAttribute(data.magnitudes, 1));
      this.geometry.setAttribute("colourIndex", new THREE.BufferAttribute(data.colours, 1));
      this.points.visible = true;
      onReady();
    } catch {
      // Stars are decoration: a failed load leaves plain space.
    }
  }

  /**
   * Sets the uniforms for the next frame. `sunDir` is the Sun's direction in scene axes, or
   * null when it is not drawn. Called once a drawn frame; it allocates nothing.
   */
  update(pixelRatio: number, exposure: number, sunDir: readonly [number, number, number] | null): void {
    const u = this.material.uniforms;
    u.pixelRatio!.value = pixelRatio;
    u.exposure!.value = exposure;
    u.sunOn!.value = sunDir ? 1 : 0;
    if (sunDir) (u.sunDir!.value as THREE.Vector3).set(sunDir[0], sunDir[1], sunDir[2]);
  }

  dispose(): void {
    this.disposed = true;
    this.geometry.dispose();
    this.material.dispose();
  }
}
