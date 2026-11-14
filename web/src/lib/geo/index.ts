// Degree and radian conversion stays inside lib/geo: angles cross this boundary in degrees.
export {
  signedAzimuthDifference,
  wrapAzimuth,
  wrapLongitude,
} from "./angles";
export {
  LOCAL_TERRAIN_HALF_M,
  LOCAL_TERRAIN_SIZE,
  MOON_RADIUS_M,
  SKYLINE_BIN_DEG,
  SKYLINE_BINS,
  SKYLINE_WALL_RADIUS_KM,
} from "./constants";
export { azimuthElevation, destination, localBasis, unitVector, type Vec3 } from "./frames";
export { skylineBinCentreDeg, skylineBinForAzimuth, terrainIndex, terrainOffsetM, terrainRowCol } from "./mesh";
export {
  latLonToPixel,
  pixelToLatLon,
  polarStereoForward,
  polarStereoInverse,
  polarStereoScale,
  type MapImage,
} from "./projection";
export {
  azimuthElevationToScene,
  enuToScene,
  sceneToAzimuthElevation,
  sceneToEnu,
  skylineWallHeightKm,
  trueLocalPosition,
  trueLocalToSceneKm,
} from "./scene";
export { latLonToScene, moonFixedToScene, sceneToLatLon, sceneToMoonFixed, sunElevationDeg } from "./system";
export {
  CAP_CORE_HALF_WIDTH_M,
  CAP_HALF_WIDTH_M,
  EARTH_RADIUS_KM,
  MOON_RADIUS_KM,
  SUN_RADIUS_KM,
  apronCellLocalKm,
  apronCellOffsetM,
  bodyDirections,
  capUv,
  localDirectionToScene,
  localKmToSceneOffset,
  sceneDirectionAtSite,
  siteFrameScene,
  siteGroundScene,
  surfacePointScene,
  trueEarthPlacement,
  type ApronGrid,
  type BodyPlacement,
  type SystemHour,
} from "./placement";
