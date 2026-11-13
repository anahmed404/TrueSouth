import * as THREE from "three";
import type { CameraViewId } from "../../../app/scene";
import type { DecodedApron, DecodedTerrain } from "../../../data";
import { sceneImageUrl } from "../../../data";
import { EARTH_RADIUS_KM, MOON_RADIUS_M, SQUEEZED_DISTANCE, SQUEEZED_SUN_RADIUS, SUN_RADIUS_KM, type ApronGrid } from "../../../lib/geo";
import { altitudeOf, type SiteFrame } from "./camera";
import { apronGeometry, apronUpGrid, patchGeometry, patchOutline, patchUpGrid, smoothGroundGeometry, type GroundSite } from "./ground";
import { GroundLook } from "./ground-material";
import { aimLander, createLander, LANDER_HEIGHT_M, partAxis, type Lander } from "./lander";
import { earthMaterial, landerMaterial, moonMaterial, solidTexture, sunMaterial } from "./materials";
import { smooth, type V3 } from "./vec";

/**
 * Everything drawn in the one scene (docs/features/system-view.md): the Moon with its polar
 * cap, Earth, the Sun, the axis and equator, the two sight-lines, and, once a flight
 * descends, the ground around the focused site with Pip standing on it. Built from the
 * approved prototype. It owns every geometry, material and texture it makes and releases
 * them in `dispose`.
 */

export type WorldSite = {
  id: string;
  name: string;
  latDeg: number;
  lonDeg: number;
  groundHeightM: number;
  frame: SiteFrame;
  sphere: boolean;
};

export type WorldInputs = {
  /**
   * True when the current hour's row of system.bin is in. Without it the Sun and Earth are
   * not drawn, the Moon gets an even light, and nothing below means anything.
   */
  bodies: boolean;
  /** From the sub-solar and sub-Earth points (science.md §14). */
  sunDir: V3;
  earthDir: V3;
  earthCentre: V3;
  earthRadius: number;
  trueScale: boolean;
  earthDistKm: number;
  sunDistKm: number;
  hourIndex: number;
  site: WorldSite | null;
  /** The focused site's sight-lines: directions from the series, states from the hour flags. */
  sight: { sunDir: V3; earthDir: V3; sunGood: boolean | null; earthGood: boolean | null } | null;
  /** The camera view. Views without ground (any but Local terrain and Lander's eye) show no lander. */
  view: CameraViewId;
};

/** Pip is drawn this many times larger than life in Local terrain, and a plate says so. */
export const LANDER_SCALE = 300;
/** The globe hides its pixels under the apron, within 140 km of the site, once the ground is in. */
const HIDE_RADIUS = 140_000 / MOON_RADIUS_M;

export type Anchors = {
  near: number;
  /** False when the Sun and Earth are not drawn (no system.bin). */
  bodies: boolean;
  sun: THREE.Vector3 | null;
  /** The Sun's true direction from the Moon, for the edge marker at true scale. */
  sunDirection: THREE.Vector3;
  sunRadius: number;
  earth: THREE.Vector3;
  earthRadius: number;
  site: THREE.Vector3 | null;
  sightEnds: { sun: THREE.Vector3; earth: THREE.Vector3 } | null;
  lander: THREE.Vector3 | null;
};

function css(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export type TextureState = { moon: "none" | "2k" | "4k" | "8k"; cap: boolean; earth: boolean };

export class World {
  readonly root = new THREE.Group();
  private readonly owned: { dispose: () => void }[] = [];
  private readonly textures = new Set<THREE.Texture>();
  private disposed = false;
  private readonly invalidate: () => void;
  private readonly maxAnisotropy: number;
  private blankTexture: THREE.Texture;

  private readonly moon;
  private readonly moonMesh: THREE.Mesh;
  private readonly earth;
  private readonly earthMesh: THREE.Mesh;
  private readonly sun;
  private readonly sunMesh: THREE.Mesh;
  private readonly guides: THREE.Group;
  private readonly guideMaterials: { material: THREE.LineBasicMaterial; opacity: number }[] = [];
  private readonly terminator: THREE.Line;
  private readonly sightGroup = new THREE.Group();
  private readonly sightLines: { sun: THREE.Line; earth: THREE.Line };
  private readonly ground = new THREE.Group();
  /** The ground's material and its quality levels (ground-material.ts). */
  readonly groundLook: GroundLook;
  private groundMeshes: THREE.Object3D[] = [];
  private groundFor: string | null = null;
  private readonly lander: Lander;
  private readonly landerMat: THREE.ShaderMaterial;
  private readonly landerUp = { value: new THREE.Vector3(0, -1, 0) };
  private readonly colours: { go: THREE.Color; nogo: THREE.Color };
  private inputs: WorldInputs | null = null;
  private moonRes: "4k" | "8k" = "4k";
  textureState: TextureState = { moon: "none", cap: false, earth: false };
  /** Draw the cap's fixed top-left lighting (the flat map's look) instead of the real Sun: 0 to 1. */
  draw = 0;

  constructor(invalidate: () => void, maxAnisotropy: number) {
    this.invalidate = invalidate;
    this.maxAnisotropy = maxAnisotropy;
    const blank = this.own(solidTexture(40, 40, 40));
    this.blankTexture = blank;
    const flat = this.own(solidTexture(180, 180, 180));
    const flatSlope = this.own(solidTexture(128, 128, 128));

    this.moon = moonMaterial(blank, flat, flatSlope);
    this.moonMesh = new THREE.Mesh(this.own(new THREE.SphereGeometry(1, 384, 192)), this.own(this.moon.material));
    this.moonMesh.name = "moon";
    this.root.add(this.moonMesh);

    this.earth = earthMaterial(blank, new THREE.Color(css("--earth", "#6cc4ff")));
    this.earthMesh = new THREE.Mesh(this.own(new THREE.SphereGeometry(1, 96, 48)), this.own(this.earth.material));
    this.earthMesh.name = "earth";
    this.root.add(this.earthMesh);

    this.sun = sunMaterial(new THREE.Color(css("--sun-core", "#fff4d8")), new THREE.Color(css("--sun", "#ffe2a0")));
    this.sunMesh = new THREE.Mesh(this.own(new THREE.PlaneGeometry(2, 2)), this.own(this.sun.material));
    this.sunMesh.name = "sun";
    this.sunMesh.frustumCulled = false;
    this.root.add(this.sunMesh);

    // The Moon's axis and a faint equator, so the pole is easy to find; a dashed day/night line.
    this.guides = new THREE.Group();
    const guide = (opacity: number, dashed = false) => {
      const material = dashed
        ? new THREE.LineDashedMaterial({ color: 0xb3b3b8, dashSize: 0.03, gapSize: 0.03, transparent: true, opacity })
        : new THREE.LineBasicMaterial({ color: 0x8c8c93, transparent: true, opacity });
      this.guideMaterials.push({ material, opacity });
      return this.own(material);
    };
    const axis = new THREE.Line(
      this.own(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -1.32, 0), new THREE.Vector3(0, 1.32, 0)])),
      guide(0.35),
    );
    const ring = (radius: number) => {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 256; i += 1) {
        const a = (i / 256) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
      }
      return this.own(new THREE.BufferGeometry().setFromPoints(points));
    };
    const equator = new THREE.Line(ring(1.002), guide(0.16));
    this.terminator = new THREE.Line(ring(1.003), guide(0.45, true));
    this.terminator.computeLineDistances();
    this.guides.add(axis, equator, this.terminator);
    this.root.add(this.guides);

    // Sight-lines: colour and dash come from the series, set in `update`.
    this.colours = { go: new THREE.Color(css("--status-go", "#45c98b")), nogo: new THREE.Color(css("--status-nogo", "#f0646d")) };
    const line = () => {
      const geometry = this.own(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]));
      const material = this.own(new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 1, gapSize: 0 }));
      const l = new THREE.Line(geometry, material);
      l.frustumCulled = false;
      this.sightGroup.add(l);
      return l;
    };
    this.sightLines = { sun: line(), earth: line() };
    this.root.add(this.sightGroup);

    const mu = this.moon.uniforms;
    this.groundLook = this.own(
      new GroundLook(
        { light: mu.uSun, noLight: mu.uNoSun },
        { map: mu.uMap, loaded: mu.uLoaded, capSlope: mu.uCapN, coreSlope: mu.uCoreN, capLoaded: mu.uCapLoaded },
        invalidate,
      ),
    );
    this.ground.visible = false;
    this.root.add(this.ground);

    this.landerMat = this.own(landerMaterial(this.moon.uniforms.uSun, this.landerUp, this.moon.uniforms.uNoSun));
    this.lander = createLander(this.landerMat, {
      grey: new THREE.Color(css("--terrain-rim", "#a8a8af")),
      sun: new THREE.Color(css("--sun", "#ffe2a0")),
      earth: new THREE.Color(css("--earth", "#6cc4ff")),
    });
    this.owned.push({ dispose: () => this.lander.dispose() });
    this.lander.group.visible = false;
    this.root.add(this.lander.group);
  }

  private own<T extends { dispose: () => void }>(thing: T): T {
    this.owned.push(thing);
    return thing;
  }

  get landerTriangles(): number {
    return this.lander.triangles;
  }

  // ── Textures: 2K first, then 4K (or the 8K halves), the cap, Earth ─────────

  private load(file: string, colour: boolean, clamp = false): Promise<THREE.Texture | null> {
    return new Promise((resolve) => {
      new THREE.TextureLoader().load(
        sceneImageUrl(file),
        (texture) => {
          if (this.disposed) {
            texture.dispose();
            resolve(null);
            return;
          }
          texture.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          texture.anisotropy = Math.min(8, this.maxAnisotropy);
          texture.wrapS = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.generateMipmaps = true;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          this.textures.add(texture);
          resolve(texture);
        },
        undefined,
        () => resolve(null),
      );
    });
  }

  private loading: "idle" | "running" | "done" = "idle";

  /**
   * React may unmount and mount the scene again with the same world (StrictMode, Fast
   * Refresh): everything released in `dispose` is uploaded again on first use.
   */
  revive(): void {
    this.disposed = false;
  }

  /** Starts loading. The Moon is plain grey with the same lighting until its colour arrives. */
  async loadTextures(moon8k: boolean, onState: (state: TextureState) => void): Promise<void> {
    if (this.loading !== "idle") return;
    this.loading = "running";
    try {
      await this.loadAll(moon8k, onState);
    } finally {
      this.loading = this.disposed ? "idle" : "done";
    }
  }

  private async loadAll(moon8k: boolean, onState: (state: TextureState) => void): Promise<void> {
    const u = this.moon.uniforms;
    const [m2, height, earth] = await Promise.all([
      this.load("scene/moon_2k.webp", true),
      this.load("scene/moon_height_1440.png", false),
      this.load("scene/earth_2k.jpg", true),
    ]);
    if (this.disposed) return;
    if (m2) {
      u.uMap.value = m2;
      this.showMoon([m2]);
      u.uLoaded.value = 1;
      this.textureState = { ...this.textureState, moon: "2k" };
    }
    if (height) u.uH.value = height;
    if (earth) {
      this.earth.uniforms.uMap.value = earth;
      this.earth.uniforms.uLoaded.value = 1;
      this.textureState = { ...this.textureState, earth: true };
    }
    onState(this.textureState);
    this.invalidate();
    const [cap, core, slope, slopeCore] = await Promise.all([
      this.load("maps/hillshade_4k.webp", false, true),
      this.load("scene/hillshade_core_2048.webp", false, true),
      this.load("scene/cap_slope.webp", false, true),
      this.load("scene/cap_slope_core.webp", false, true),
    ]);
    if (this.disposed) return;
    if (cap && core && slope && slopeCore) {
      u.uCap.value = cap;
      u.uCore.value = core;
      u.uCapN.value = slope;
      u.uCoreN.value = slopeCore;
      u.uCapLoaded.value = 1;
      this.textureState = { ...this.textureState, cap: true };
      onState(this.textureState);
      this.invalidate();
    }
    await this.setMoonResolution(moon8k ? "8k" : "4k", onState);
  }

  private hiRes: { m4?: THREE.Texture | null; w?: THREE.Texture | null; e?: THREE.Texture | null } = {};
  /** The Moon colour textures on screen now: the 2K, the 4K, or the two 8K halves. */
  private shownMoon: THREE.Texture[] = [];

  private release(texture: THREE.Texture | null | undefined): void {
    if (!texture) return;
    texture.dispose();
    this.textures.delete(texture);
    if (this.hiRes.m4 === texture) this.hiRes.m4 = null;
    if (this.hiRes.w === texture) this.hiRes.w = null;
    if (this.hiRes.e === texture) this.hiRes.e = null;
  }

  /** Puts new Moon colour textures on screen and releases the ones they replace. */
  private showMoon(textures: THREE.Texture[]): void {
    const old = this.shownMoon;
    this.shownMoon = textures;
    for (const texture of old) if (!textures.includes(texture)) this.release(texture);
  }

  /**
   * The 4K Moon (the default) or the optional 8K halves. The lower resolution stays on screen
   * only while the higher one loads; once it is replaced it is released.
   */
  async setMoonResolution(which: "4k" | "8k", onState: (state: TextureState) => void): Promise<void> {
    this.moonRes = which;
    const u = this.moon.uniforms;
    if (which === "8k") {
      this.hiRes.w ??= await this.load("scene/moon_8k_w.webp", true, true);
      this.hiRes.e ??= await this.load("scene/moon_8k_e.webp", true, true);
      if (this.disposed) return;
      if (this.moonRes !== "8k") {
        // Switched back while these loaded: they were never shown.
        if (!this.shownMoon.includes(this.hiRes.w as THREE.Texture)) this.release(this.hiRes.w);
        if (!this.shownMoon.includes(this.hiRes.e as THREE.Texture)) this.release(this.hiRes.e);
        return;
      }
      if (this.hiRes.w && this.hiRes.e) {
        u.uMap.value = this.hiRes.w;
        u.uMapE.value = this.hiRes.e;
        u.uSplit.value = 1;
        u.uLoaded.value = 1;
        this.showMoon([this.hiRes.w, this.hiRes.e]);
        this.textureState = { ...this.textureState, moon: "8k" };
      }
    } else {
      this.hiRes.m4 ??= await this.load("scene/moon_4k.webp", true);
      if (this.disposed) return;
      if (this.moonRes !== "4k") {
        if (!this.shownMoon.includes(this.hiRes.m4 as THREE.Texture)) this.release(this.hiRes.m4);
        return;
      }
      if (this.hiRes.m4) {
        u.uMap.value = this.hiRes.m4;
        u.uMapE.value = this.blankTexture;
        u.uSplit.value = 0;
        u.uLoaded.value = 1;
        this.showMoon([this.hiRes.m4]);
        this.textureState = { ...this.textureState, moon: "4k" };
      }
    }
    onState(this.textureState);
    this.invalidate();
  }

  // ── The ground around the focused site ──────────────────────────────────

  private clearGround(): void {
    for (const object of this.groundMeshes) {
      this.ground.remove(object);
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        object.geometry.dispose();
        if (object instanceof THREE.Line) (object.material as THREE.Material).dispose();
      }
    }
    this.groundMeshes = [];
    this.groundFor = null;
    this.groundLook.clearHeights();
  }

  /**
   * Builds the focused site's ground: the patch inside its apron, or the smooth Moon for a
   * sphere-tier site. The previous site's geometry is released.
   */
  setGround(
    site: WorldSite | null,
    terrain: { data: DecodedTerrain; size: number; windowKm: number } | null,
    apron: { data: DecodedApron; grid: ApronGrid } | null,
    smooth = false,
  ): void {
    const key = site ? `${site.id}|${terrain ? "t" : ""}|${apron ? "a" : ""}|${smooth ? "s" : ""}` : null;
    if (key === this.groundFor) return;
    this.clearGround();
    if (!site) {
      this.invalidate();
      return;
    }
    const g: GroundSite = { latDeg: site.latDeg, lonDeg: site.lonDeg, groundHeightM: site.groundHeightM };
    const meshes: THREE.Object3D[] = [];
    if (site.sphere || smooth) {
      // A sphere-tier site, or a site whose terrain file failed: the smooth Moon.
      // It sits at the site's own height, where Pip and the camera stand.
      meshes.push(new THREE.Mesh(smoothGroundGeometry(g), this.groundLook.material));
    } else if (terrain) {
      const patch = patchGeometry(terrain.data, terrain.size, terrain.windowKm, g);
      meshes.push(new THREE.Mesh(patch, this.groundLook.material));
      const withApron = Boolean(apron && apron.grid.windowM / 2_000 > terrain.windowKm / 2);
      if (apron && withApron) {
        meshes.push(new THREE.Mesh(apronGeometry(apron.data, apron.grid, terrain.windowKm / 2, g), this.groundLook.material));
      }
      this.groundLook.setHeights(
        { heights: patchUpGrid(terrain.data, terrain.size), columns: terrain.size, rows: terrain.size, halfKm: terrain.windowKm / 2 },
        apron && withApron
          ? { heights: apronUpGrid(apron.data, apron.grid, g), columns: apron.grid.columns, rows: apron.grid.rows, halfKm: apron.grid.windowM / 2_000 }
          : null,
      );
      const lift = new THREE.Vector3(...site.frame.up).multiplyScalar(4 / MOON_RADIUS_M);
      const outline = new THREE.LineLoop(
        patchOutline(patch, terrain.size, lift),
        new THREE.LineBasicMaterial({ color: new THREE.Color(css("--terrain-rim", "#a8a8af")), transparent: true, opacity: 0.55 }),
      );
      meshes.push(outline);
    } else {
      this.invalidate();
      return;
    }
    for (const mesh of meshes) {
      mesh.frustumCulled = false;
      if (mesh instanceof THREE.Mesh) this.groundLook.attach(mesh);
      this.ground.add(mesh);
    }
    this.groundMeshes = meshes;
    this.groundFor = key;
    this.ground.position.set(...site.frame.ground);
    this.groundLook.setFrame(site.frame);
    this.invalidate();
  }

  get hasGround(): boolean {
    return this.groundMeshes.length > 0;
  }

  private prepTarget: THREE.WebGLRenderTarget | null = null;

  /**
   * Draws the ground once into a 1 × 1 target, so its meshes, height textures and shader are
   * on the GPU before the first flight into Local terrain needs them (a stall of about 375 ms
   * on a software GPU otherwise). Nothing on screen changes.
   */
  prepareGround(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
    if (!this.hasGround) return;
    this.prepTarget ??= this.own(new THREE.WebGLRenderTarget(1, 1));
    const visible = this.ground.visible;
    const fade = this.groundLook.uniforms.uFade.value;
    const previous = renderer.getRenderTarget();
    this.ground.visible = true;
    this.groundLook.fade = 1;
    this.ground.updateMatrixWorld(true);
    // The shader as the screen draws it (three.js compiles a separate variant for a render
    // target), then one draw off-screen to upload the meshes and height textures.
    renderer.compile(this.ground, camera);
    renderer.setRenderTarget(this.prepTarget);
    renderer.render(this.ground, camera);
    renderer.setRenderTarget(previous);
    this.ground.visible = visible;
    this.groundLook.fade = fade;
  }

  // ── Per-frame layout ────────────────────────────────────────────────────

  setInputs(inputs: WorldInputs): void {
    this.inputs = inputs;
    this.moon.uniforms.uNoSun.value = inputs.bodies ? 0 : 1;
    this.moon.uniforms.uSun.value.set(...inputs.sunDir);
    this.earth.uniforms.uSun.value.set(...inputs.sunDir);
    this.groundLook.setBodies(inputs.sunDir, inputs.earthDir, inputs.bodies);
    const site = inputs.site;
    if (site) {
      aimLander(
        this.lander,
        site.frame.up,
        site.frame.north,
        inputs.sight?.sunDir ?? inputs.sunDir,
        inputs.sight?.earthDir ?? inputs.earthDir,
      );
      this.landerUp.value.set(...site.frame.up);
    }
    this.invalidate();
  }

  /** Places the bodies, guides, sight-lines, ground and lander for the camera. */
  layout(camera: THREE.Camera): Anchors {
    const inputs = this.inputs;
    const cam = camera.position;
    const alt = altitudeOf([cam.x, cam.y, cam.z]);
    const site = inputs?.site ?? null;
    const siteGround = site ? new THREE.Vector3(...site.frame.ground) : null;
    // 1 when the camera is close to the ground: the bodies are then drawn at their true
    // angular size, centred on the site, along the series' directions.
    const near = site ? smooth(0.06, 0.012, alt) : 0;
    const anchors: Anchors = {
      near,
      bodies: inputs?.bodies ?? false,
      sun: null,
      sunDirection: new THREE.Vector3(...(inputs?.sunDir ?? [1, 0, 0])),
      sunRadius: 0,
      earth: new THREE.Vector3(),
      earthRadius: 0,
      site: siteGround,
      sightEnds: null,
      lander: null,
    };
    if (!inputs) return anchors;

    const lerp = THREE.MathUtils.lerp;
    const nearCentre = siteGround ?? new THREE.Vector3();
    const earthNearDir = new THREE.Vector3(...(inputs.sight?.earthDir ?? inputs.earthDir));
    const sunNearDir = new THREE.Vector3(...(inputs.sight?.sunDir ?? inputs.sunDir));
    const earthNearDistance = 60;
    const sunNearDistance = 300;
    const earthNear = nearCentre.clone().add(earthNearDir.multiplyScalar(earthNearDistance));
    const sunNear = nearCentre.clone().add(sunNearDir.multiplyScalar(sunNearDistance));

    const earthFar = new THREE.Vector3(...inputs.earthCentre);
    this.earthMesh.visible = inputs.bodies;
    this.earthMesh.position.lerpVectors(earthFar, earthNear, near);
    const earthRadius = lerp(inputs.earthRadius, earthNearDistance * (EARTH_RADIUS_KM / inputs.earthDistKm), near);
    this.earthMesh.scale.setScalar(earthRadius);
    // Earth turns once every 23.934 h of the clock. Decoration; nothing reads from it.
    this.earthMesh.rotation.set(0, (inputs.hourIndex / 23.934) * Math.PI * 2, 0);
    anchors.earth.copy(this.earthMesh.position);
    anchors.earthRadius = earthRadius;

    const sunFar = new THREE.Vector3(...inputs.sunDir).multiplyScalar(SQUEEZED_DISTANCE);
    this.sunMesh.position.lerpVectors(sunFar, sunNear, near);
    const sunRadius = lerp(SQUEEZED_SUN_RADIUS, sunNearDistance * (SUN_RADIUS_KM / inputs.sunDistKm), near);
    this.sun.uniforms.uExt.value = lerp(1.8, 1.5, near);
    this.sunMesh.scale.setScalar(sunRadius * this.sun.uniforms.uExt.value);
    this.sunMesh.quaternion.copy(camera.quaternion);
    // At true scale the Sun is only a direction, marked at the screen's edge.
    this.sunMesh.visible = inputs.bodies && !(inputs.trueScale && near < 0.5);
    anchors.sun = this.sunMesh.visible ? this.sunMesh.position.clone() : null;
    anchors.sunRadius = sunRadius;

    // Guides fade as the camera nears the ground, and stay off over the Polar map.
    const far = 1 - smooth(0.5, 0.15, alt);
    for (const { material, opacity } of this.guideMaterials) material.opacity = opacity * far;
    this.guides.visible = far > 0.01 && inputs.view !== "map";
    this.terminator.visible = inputs.bodies;
    this.terminator.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...inputs.sunDir));

    // The ground dissolves in between 52 and 28 km altitude: only during flights, since the
    // System view's zoom stops at 60 km.
    const groundFade = site && this.hasGround ? smooth(0.03, 0.016, alt) : 0;
    this.ground.visible = groundFade > 0.001;
    this.groundLook.fade = groundFade;
    const u = this.moon.uniforms;
    if (groundFade > 0.999 && site) {
      u.uHideDir.value.set(...site.frame.up);
      u.uHideCos.value = Math.cos(HIDE_RADIUS);
    } else {
      u.uHideCos.value = 2;
    }
    u.uDraw.value = this.draw;

    // Pip: only near the ground, larger than life, gone as the camera drops to its eye.
    let landerScale = 0;
    if (site && siteGround && (inputs.view === "terrain" || inputs.view === "panorama")) {
      const metres = cam.distanceTo(siteGround) * MOON_RADIUS_M;
      landerScale = smooth(0.012, 0.03, alt) > 0.999 ? 0 : 1;
      landerScale *= smooth(250, 1_800, metres);
    }
    this.lander.group.visible = landerScale > 0.01;
    if (siteGround) {
      this.lander.group.position.copy(siteGround);
      this.lander.group.scale.setScalar((LANDER_SCALE * Math.max(landerScale, 0.01)) / MOON_RADIUS_M);
      this.lander.group.updateMatrixWorld(true);
      anchors.lander = this.lander.group.visible
        ? siteGround.clone().add(new THREE.Vector3(...site!.frame.up).multiplyScalar((LANDER_SCALE * LANDER_HEIGHT_M * landerScale) / MOON_RADIUS_M))
        : null;
    }

    // Sight-lines: true directions from the site (or from Pip's panel and dish).
    const sight = inputs.sight;
    const show = Boolean(site && sight && siteGround && inputs.view !== "map" && inputs.view !== "panorama");
    this.sightGroup.visible = show;
    if (show && site && sight && siteGround) {
      this.sightGroup.position.copy(siteGround);
      const length = lerp(1.15, 8_000 / MOON_RADIUS_M, smooth(0.4, 0.005, alt));
      const lift = lerp(0.004, 2 / MOON_RADIUS_M, near);
      const up = new THREE.Vector3(...site.frame.up);
      const ends = { sun: new THREE.Vector3(), earth: new THREE.Vector3() };
      for (const key of ["sun", "earth"] as const) {
        const l = this.sightLines[key];
        const good = key === "sun" ? sight.sunGood : sight.earthGood;
        const dir = new THREE.Vector3(...(key === "sun" ? sight.sunDir : sight.earthDir));
        let from = up.clone().multiplyScalar(lift);
        if (this.lander.group.visible) {
          from = partAxis(key === "sun" ? this.lander.panel : this.lander.dish).centre.sub(siteGround);
        }
        const to = from.clone().add(dir.multiplyScalar(length));
        const position = l.geometry.getAttribute("position") as THREE.BufferAttribute;
        position.setXYZ(0, from.x, from.y, from.z);
        position.setXYZ(1, to.x, to.y, to.z);
        position.needsUpdate = true;
        l.geometry.computeBoundingSphere();
        l.computeLineDistances();
        const material = l.material as THREE.LineDashedMaterial;
        l.visible = good !== null;
        material.color.copy(good ? this.colours.go : this.colours.nogo);
        material.dashSize = good ? 1e3 : length / 30;
        material.gapSize = good ? 0 : length / 60;
        ends[key] = to.add(siteGround);
      }
      anchors.sightEnds = ends;
    }
    return anchors;
  }

  /** Releases every geometry, material and texture on the GPU. */
  /** The Moon's spheres by segment count, made when first needed (perf.ts, `moonSegments`). */
  private readonly moonLods = new Map<number, THREE.BufferGeometry>();
  private moonSegmentsNow = 384;

  /**
   * Level of detail: draws the Moon with `segments` around (and half as many pole to pole).
   * Shading is per pixel from the normalised position, so this moves only the silhouette, by
   * under a quarter of a pixel at the size the Director asks for it. 384 is the full mesh.
   */
  setMoonSegments(segments: number): void {
    if (segments === this.moonSegmentsNow) return;
    if (this.moonLods.size === 0) this.moonLods.set(this.moonSegmentsNow, this.moonMesh.geometry);
    let geometry = this.moonLods.get(segments);
    if (!geometry) {
      geometry = this.own(new THREE.SphereGeometry(1, segments, segments / 2));
      this.moonLods.set(segments, geometry);
    }
    this.moonMesh.geometry = geometry;
    this.moonSegmentsNow = segments;
  }

  dispose(): void {
    this.disposed = true;
    this.clearGround();
    for (const texture of this.textures) texture.dispose();
    for (const thing of this.owned) thing.dispose();
  }
}
