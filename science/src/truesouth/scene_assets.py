"""Scene images and apron grids.

Moon and Earth sources are equirectangular. Longitude 0 degrees is the centre
of the image and row 0 is north. The south-polar images follow science.md
section 2.3: +x right, +y up. An apron uses the same walk and the same
north-to-south, west-to-east axes as the 20 km patch in terrain_mesh.py.
The patch itself stays in sites/<id>/terrain.bin and is not written again.
"""
import hashlib
import json
import warnings
from pathlib import Path

import numpy as np
from PIL import Image

from truesouth.constants import MOON_RADIUS_M
from truesouth.contracts import ApronLayout, SceneApronFile, SceneImage, SceneInput, SceneMeta
from truesouth.dem import DemStore, PreparedMap
from truesouth.frames import destination
from truesouth.terrain_mesh import _offset_axes

MOON_CREDIT = 'NASA Scientific Visualization Studio; LRO LROC and LOLA teams. SVS 4720.'
EARTH_CREDIT = 'NASA Earth Observatory, Reto St\u00f6ckli. Blue Marble Next Generation, March 2004.'
LOLA_CREDIT = 'NASA LOLA / PGDA, LDEM_80S_80MPP_ADJ, via the TrueSouth pipeline.'
HEIGHT_LO_KM = -9.0
HEIGHT_HI_KM = 10.6
APRON_OFFSET_M = 12000.0
APRON_SCALE = 2.0
APRON_MISSING = 65535
APRON_SIZE = 161
APRON_WINDOW_M = 300_000.0
CAP_HALF_M = 304_000.0
CORE_HALF_M = 76_000.0
SLOPE_OFFSET = 128.0
SLOPE_GAIN = 160.0

EQUIRECT = 'equirectangular_lon0_center_north_up'
POLAR = 'south_polar_stereographic_x_right_y_up'


def equirect_pixel(lon_deg, lat_deg, width, height):
    """Row and column of the cell that contains this east longitude and latitude.

    Longitude 0 degrees is the centre. Row 0 is north. The antimeridian, 180
    degrees, is the left edge.
    """
    width, height = int(width), int(height)
    frac_x = ((float(lon_deg) + 180.0) % 360.0) / 360.0
    col = int(np.floor(frac_x * width))
    if col >= width:
        col = 0
    frac_y = (90.0 - float(lat_deg)) / 180.0
    row = int(np.floor(frac_y * height))
    return min(max(row, 0), height - 1), col


def _wrap_signed(degrees):
    return (float(degrees) + 180.0) % 360.0 - 180.0


def normalize_equirectangular(image, west_edge_deg, top_edge_deg, pixel_lon_deg, pixel_lat_deg):
    """Roll and flip so longitude 0 is centred and north is up.

    Edges are the outer edges of the corner pixels, in degrees. pixel_lon_deg
    is positive when longitude increases to the right. pixel_lat_deg is
    negative when north is up. The grid must already be a full 360 by 180
    degree equirectangular map aligned to a pixel, so this never resamples.
    """
    image = np.asarray(image)
    height, width = image.shape[:2]
    west, top = float(west_edge_deg), float(top_edge_deg)
    pixel_lon, pixel_lat = float(pixel_lon_deg), float(pixel_lat_deg)
    if pixel_lon == 0 or pixel_lat == 0:
        raise ValueError('equirectangular pixel size must be non-zero')
    if pixel_lon < 0:
        image = image[:, ::-1]
        west = west + width * pixel_lon
        pixel_lon = -pixel_lon
    if pixel_lat > 0:
        image = image[::-1]
        top = top + height * pixel_lat
        pixel_lat = -pixel_lat
    span_lon = width * pixel_lon
    span_lat = height * -pixel_lat
    if abs(span_lon - 360.0) > 1e-3 or abs(span_lat - 180.0) > 1e-3:
        raise ValueError(f'equirectangular span is {span_lon} by {span_lat} degrees, not 360 by 180')
    if abs(top - 90.0) > 1e-3:
        raise ValueError(f'north edge is {top} degrees, not 90')
    shift = _wrap_signed(west - (-180.0)) / pixel_lon
    if abs(shift - round(shift)) > 1e-3:
        raise ValueError('longitude 0 is not on a pixel boundary')
    roll = int(round(shift)) % width
    if roll:
        image = np.roll(image, -roll, axis=1)
    return np.ascontiguousarray(image)


def split_east_west(image):
    """Exact west and east halves. The halves join back into the same pixels."""
    image = np.asarray(image)
    width = image.shape[1]
    if width % 2:
        raise ValueError(f'cannot split an odd width of {width}')
    mid = width // 2
    return np.ascontiguousarray(image[:, :mid]), np.ascontiguousarray(image[:, mid:])


def encode_height_km(heights_km, lo=HEIGHT_LO_KM, hi=HEIGHT_HI_KM):
    """Map kilometres to 8-bit grey. lo is 0 and hi is 255. Outside values clip."""
    values = np.nan_to_num(np.asarray(heights_km, dtype=np.float64), nan=lo, posinf=hi, neginf=lo)
    scaled = (values - lo) / (hi - lo) * 255.0 + 0.5
    return np.clip(scaled, 0, 255).astype(np.uint8)


def crop_centre(image, size):
    """Crop a square centred on the image, to the pixel."""
    image = np.asarray(image)
    height, width = image.shape[:2]
    size = int(size)
    if size > height or size > width or (height - size) % 2 or (width - size) % 2:
        raise ValueError(f'a {size} crop is not centred on {width}x{height} to the pixel')
    top = (height - size) // 2
    left = (width - size) // 2
    return np.ascontiguousarray(image[top:top + size, left:left + size])


def block_mean(values, factor):
    """Mean of exact factor-by-factor blocks. A partial edge block is dropped."""
    factor = int(factor)
    values = np.asarray(values)
    if factor < 1:
        raise ValueError('block factor must be at least 1')
    rows = values.shape[0] // factor * factor
    cols = values.shape[1] // factor * factor
    if rows == 0 or cols == 0:
        raise ValueError('block factor is larger than the map')
    block = np.asarray(values[:rows, :cols], dtype=np.float64)
    return block.reshape(rows // factor, factor, cols // factor, factor).mean(axis=(1, 3))


def slope_rgb(heights_m, step_m):
    """Red is dz/dx with +x east, green is dz/dy with +y north, blue is 128.

    Stored as round(128 + 160 * slope), clamped to 0..255. A missing slope
    is stored as 128, which reads back as flat.
    """
    heights = np.asarray(heights_m, dtype=np.float64)
    gy, gx = np.gradient(heights, float(step_m))
    dzdx = np.where(np.isfinite(gx), gx, 0.0)
    dzdy = np.where(np.isfinite(gy), -gy, 0.0)

    def encode(slope):
        return np.clip(np.rint(SLOPE_OFFSET + SLOPE_GAIN * slope), 0, 255).astype(np.uint8)

    blue = np.full(dzdx.shape, int(SLOPE_OFFSET), dtype=np.uint8)
    return np.dstack((encode(dzdx), encode(dzdy), blue))


def apron_axes(size, window_m):
    """East and north offsets in metres. Row 0 is north, column 0 is west."""
    return _offset_axes(int(size), float(window_m) / 1000.0)


def apron_heights(sample, lat_deg, lon_deg, size=APRON_SIZE, window_m=APRON_WINDOW_M):
    """Heights from sample(lat, lon), walked like the patch. sample matches DemStore.sample."""
    east, north = apron_axes(size, window_m)
    east_m = np.broadcast_to(east, (size, size))
    north_m = np.broadcast_to(north[:, None], (size, size))
    distance = np.hypot(east_m, north_m)
    azimuth = np.degrees(np.arctan2(east_m, north_m))
    lat, lon = destination(lat_deg, lon_deg, azimuth, distance)
    heights, _missing = sample(lat, lon)
    return np.asarray(heights, dtype=np.float64)


def encode_apron(heights):
    """Little-endian uint16. 65535 means no height. Finite values are (z + 12000) * 2."""
    heights = np.asarray(heights, dtype=np.float64)
    encoded = np.full(heights.shape, APRON_MISSING, dtype='<u2')
    valid = np.isfinite(heights)
    raw = np.rint((heights[valid] + APRON_OFFSET_M) * APRON_SCALE)
    if raw.size and (np.any(raw < 0) or np.any(raw >= APRON_MISSING)):
        raise ValueError('apron height is outside the uint16 range')
    encoded[valid] = raw.astype(np.uint16)
    return np.ascontiguousarray(encoded)


def decode_apron(encoded):
    """Inverse of encode_apron. 65535 becomes NaN."""
    raw = np.asarray(encoded)
    heights = raw.astype(np.float64) / APRON_SCALE - APRON_OFFSET_M
    return np.where(raw == APRON_MISSING, np.nan, heights)


def _box_mean(values, row, col, radius):
    r0, r1 = max(0, row - radius), min(values.shape[0], row + radius + 1)
    c0, c1 = max(0, col - radius), min(values.shape[1], col + radius + 1)
    return float(np.mean(values[r0:r1, c0:c1]))


def assert_moon_colour(image, name='lroc_color_poles_4k.tif'):
    """Tycho is bright rayed terrain and Mare Crisium is dark mare.

    The SVS colour TIFFs have no geotransform. Of the four axis-aligned
    arrangements, only longitude 0 at the centre and north up satisfies both.
    """
    grey = image.astype(np.float64)
    if grey.ndim == 3:
        grey = grey @ np.array([0.2126, 0.7152, 0.0722])
    height, width = grey.shape
    mean = float(grey.mean())
    tycho = _box_mean(grey, *equirect_pixel(348.8, -43.3, width, height), 5)
    crisium = _box_mean(grey, *equirect_pixel(59.0, 17.0, width, height), 5)
    if not tycho > mean:
        raise ValueError(f'{name}: Tycho is not bright ({tycho:.1f} against the image mean {mean:.1f}); the map is flipped or shifted')
    if not crisium < mean:
        raise ValueError(f'{name}: Mare Crisium is not dark ({crisium:.1f} against the image mean {mean:.1f}); the map is flipped or shifted')
    return {'tycho': tycho, 'crisium': crisium, 'mean': mean}


def assert_height_orientation(heights_km):
    """Shackleton's pixel is a depression, which it is only for this orientation."""
    height, width = heights_km.shape
    row, col = equirect_pixel(129.2, -89.67, width, height)
    centre = float(heights_km[row, col])
    around = _box_mean(heights_km, row, col, 2)
    if not centre < around:
        raise ValueError(f'ldem_4.tif: Shackleton is not a depression ({centre} km against {around} km); the height map is flipped or shifted')
    return {'shackleton_km': centre, 'around_km': around}


def assert_earth_orientation(image):
    """Sahara is tan land and the dateline is dark ocean, only for this orientation."""
    height, width = image.shape[:2]
    sahara = image[equirect_pixel(12.0, 23.0, width, height)]
    pacific = image[equirect_pixel(180.0, 0.0, width, height)]
    if float(sahara[0]) < 150 or float(sahara[0]) < float(sahara[2]) + 40:
        raise ValueError('world.topo.bathy.200403.3x5400x2700.jpg: the Sahara pixel is not tan land; the Earth map is flipped or shifted')
    if float(pacific.mean()) > 40:
        raise ValueError('world.topo.bathy.200403.3x5400x2700.jpg: the dateline pixel is not dark ocean; the Earth map is flipped or shifted')
    return {'sahara': [int(v) for v in sahara[:3]], 'pacific': [int(v) for v in pacific[:3]]}


def _save_webp(array, path, *, quality=None, lossless=False):
    image = _pil(array)
    if lossless:
        image.save(path, format='WEBP', lossless=True, method=6, exact=True)
    else:
        image.save(path, format='WEBP', quality=int(quality), method=6, exact=True)


def _save_jpeg(array, path):
    _pil(array).save(path, format='JPEG', quality=84, optimize=True, progressive=True, subsampling=2)


def _save_png(array, path):
    import io
    buffer = io.BytesIO()
    _pil(array).save(buffer, format='PNG', optimize=True)
    path.write_bytes(_png_without_time(buffer.getvalue()))


def _pil(array):
    array = np.ascontiguousarray(array)
    if array.ndim == 2:
        return Image.fromarray(array, 'L')
    if array.shape[2] == 3:
        return Image.fromarray(array, 'RGB')
    raise ValueError(f'cannot encode shape {array.shape}')


def _png_without_time(data):
    """Drop ancillary chunks so a repeat build does not pick up the clock."""
    signature = b'\x89PNG\r\n\x1a\n'
    if not data.startswith(signature):
        raise ValueError('PNG encoder did not write a PNG')
    keep = {b'IHDR', b'PLTE', b'IDAT', b'IEND'}
    out = bytearray(signature)
    index = len(signature)
    while index + 8 <= len(data):
        length = int.from_bytes(data[index:index + 4], 'big')
        kind = data[index + 4:index + 8]
        chunk = data[index:index + 12 + length]
        index += 12 + length
        if kind in keep:
            out += chunk
        if kind == b'IEND':
            break
    return bytes(out)


def _write_encoded(path, array, encoding):
    path.parent.mkdir(parents=True, exist_ok=True)
    if encoding == 'png_grey8':
        _save_png(array, path)
    elif encoding == 'jpeg_q84_progressive':
        _save_jpeg(array, path)
    elif encoding == 'webp_lossless_m6':
        _save_webp(array, path, lossless=True)
    else:
        quality = {'webp_q82_m6': 82, 'webp_q80_m6': 80, 'webp_q85_m6': 85, 'webp_q92_m6': 92}[encoding]
        _save_webp(array, path, quality=quality)


def resize_lanczos(array, width, height):
    array = np.asarray(array)
    if array.shape[1] == width and array.shape[0] == height:
        return np.ascontiguousarray(array)
    resized = _pil(array).resize((int(width), int(height)), Image.Resampling.LANCZOS)
    return np.asarray(resized)


def read_raster(path):
    """Return (image, grid or None, note). grid is (west, top, pixel_lon, pixel_lat).

    A file with no CRS and an identity transform has no projection. The note
    records the tags the file does carry.
    """
    import rasterio
    from rasterio.errors import NotGeoreferencedWarning

    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(f'missing source file: {path.name}')
    with warnings.catch_warnings():
        warnings.simplefilter('ignore', NotGeoreferencedWarning)
        with rasterio.open(path) as src:
            data = src.read()
            transform = src.transform
            tags = src.tags()
            note = f'{path.name}: size {src.width}x{src.height}, bands {src.count}, dtype {src.dtypes[0]}, crs {src.crs}, transform {transform}'
            if tags:
                shown = ', '.join(f'{key}={tags[key]}' for key in sorted(tags)[:6])
                note += f'; tags {shown}'
            identity = src.crs is None and transform.a == 1 and transform.e == 1 and transform.b == 0 and transform.d == 0 and transform.c == 0 and transform.f == 0
            grid = None
            if not identity:
                if transform.b != 0 or transform.d != 0:
                    raise ValueError(f'{path.name}: raster is rotated ({transform})')
                grid = (transform.c, transform.f, transform.a, transform.e)
    if data.shape[0] == 1:
        image = data[0]
    elif data.shape[0] >= 3:
        image = np.transpose(data[:3], (1, 2, 0))
    else:
        raise ValueError(f'{path.name}: unsupported band count {data.shape[0]}')
    return image, grid, note


def orient_equirectangular(image, grid, name):
    """Apply a file's own geotransform. An unprojected 2:1 image stays in file order."""
    if grid is None:
        height, width = image.shape[:2]
        if width != 2 * height:
            raise ValueError(f'{name}: no projection tags and size {width}x{height} is not a 2:1 equirectangular map')
        return np.ascontiguousarray(image)
    return normalize_equirectangular(image, *grid)


def _as_grey(image):
    image = np.asarray(image)
    if image.ndim == 2:
        return image
    return np.asarray(Image.fromarray(image, 'RGB').convert('L'))


def _dem_pole(meta):
    """Fractional pixel-centre row and column of the south pole, from the sidecar."""
    text = meta['projection'].replace(' ', '')
    if 'Polar_Stereographic' not in text or 'PARAMETER["latitude_of_origin",-90]' not in text or 'PARAMETER["central_meridian",0]' not in text:
        raise ValueError('prepared DEM projection is not south-polar stereographic with central meridian 0')
    pixel_x, pixel_y = float(meta['pixel_x']), float(meta['pixel_y'])
    if pixel_x <= 0 or pixel_y >= 0:
        raise ValueError(f'DEM axes are not +x east and +y north (pixel_x {pixel_x}, pixel_y {pixel_y})')
    if abs(pixel_x + pixel_y) > 1e-6:
        raise ValueError('DEM pixels are not square')
    column = -float(meta['origin_x']) / pixel_x - 0.5
    row = -float(meta['origin_y']) / pixel_y - 0.5
    return row, column, pixel_x


def slope_maps(dem, full_factor=4, core_half_m=CORE_HALF_M, core_factor=2):
    """Whole-cap and core slope images. The pole must be the centre of the DEM."""
    meta = dem.meta
    row, column, pixel = _dem_pole(meta)
    data = dem.data
    height, width = data.shape
    if height != width or abs(row - (height / 2 - 0.5)) > 1e-3 or abs(column - (width / 2 - 0.5)) > 1e-3:
        raise ValueError(f'DEM pole is at pixel ({row}, {column}) of {height}x{width}, not the centre')
    full = slope_rgb(block_mean(data, full_factor), pixel * full_factor)
    if core_half_m is None:
        side = (height // 2) // core_factor * core_factor
    else:
        half = int(round(float(core_half_m) / pixel))
        side = 2 * half
    core_heights = crop_centre(np.asarray(data), side)
    core = slope_rgb(block_mean(core_heights, core_factor), pixel * core_factor)
    return full, core


def _image_entry(file, array, encoding, orientation, source, operation, credit, optional=False):
    return SceneImage(
        file=file, width_px=int(array.shape[1]), height_px=int(array.shape[0]), encoding=encoding,
        orientation=orientation, source=source, operation=operation, credit=credit, optional=optional,
    )


def _fingerprint(path):
    """Size and content hash. Not the modification time: that differs on every checkout,
    and scene/meta.json is committed."""
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1 << 20), b''):
            digest.update(block)
    return SceneInput(name=Path(path).name, bytes=Path(path).stat().st_size, sha256=digest.hexdigest())


def scene_inputs(paths):
    """Fingerprints of every file a rebuild must notice, including this module."""
    module = Path(__file__)
    unique = []
    seen = set()
    for path in list(paths) + [module]:
        path = Path(path)
        if path in seen or not path.is_file():
            continue
        seen.add(path)
        unique.append(_fingerprint(path))
    return unique


def _require(path):
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(f'missing source file: {path.name}')
    return path


def build_scene(output, sources, generated_utc, inputs, *, production=True):
    """Write every scene file and meta.json into output. sources is a dict of paths.

    production checks the NASA shapes and the landmark orientation. A test build
    keeps each synthetic source's own size.
    """
    output = Path(output)
    moon_4k_path = _require(sources['moon_4k'])
    moon_8k_path = _require(sources['moon_8k'])
    height_path = _require(sources['moon_height'])
    earth_path = _require(sources['earth'])
    dem_path = _require(sources['dem'])
    _require(Path(dem_path).with_suffix('.json'))
    maps = Path(sources['maps'])
    for name in ('hillshade_4k.webp', 'hillshade_8k.webp', 'sunlight_4k.webp', 'earthvis_4k.webp', 'meta.json'):
        _require(maps / name)
    sites_path = _require(sources['sites'])
    wide = sources.get('wide')
    if wide and not Path(wide).is_file():
        raise FileNotFoundError(f'missing source file: {Path(wide).name}')

    moon4, grid4, note4 = read_raster(moon_4k_path)
    moon8, grid8, note8 = read_raster(moon_8k_path)
    heights, grid_h, note_h = read_raster(height_path)
    earth, grid_e, note_e = read_raster(earth_path)
    moon4 = orient_equirectangular(moon4, grid4, moon_4k_path.name)
    moon8 = orient_equirectangular(moon8, grid8, moon_8k_path.name)
    heights = orient_equirectangular(heights, grid_h, height_path.name)
    earth = orient_equirectangular(earth, grid_e, earth_path.name)
    if production:
        if moon4.shape[:2] != (2048, 4096):
            raise ValueError(f'{moon_4k_path.name}: size {moon4.shape[1]}x{moon4.shape[0]}, expected 4096x2048')
        if moon8.shape[:2] != (4096, 8192):
            raise ValueError(f'{moon_8k_path.name}: size {moon8.shape[1]}x{moon8.shape[0]}, expected 8192x4096')
        if heights.shape[:2] != (720, 1440):
            raise ValueError(f'{height_path.name}: size {heights.shape[1]}x{heights.shape[0]}, expected 1440x720')
        if earth.shape[:2] != (2700, 5400):
            raise ValueError(f'{earth_path.name}: size {earth.shape[1]}x{earth.shape[0]}, expected 5400x2700')
        assert_moon_colour(moon4, moon_4k_path.name)
        assert_moon_colour(moon8, moon_8k_path.name)
        assert_height_orientation(heights)
        assert_earth_orientation(earth)
        moon2 = resize_lanczos(moon4, 2048, 1024)
        earth_out = resize_lanczos(earth, 2048, 1024)
        overlay_side, core_side = 2048, 2048
        slope_kwargs = {}
    else:
        moon2 = resize_lanczos(moon4, moon4.shape[1] // 2, moon4.shape[0] // 2)
        earth_out = resize_lanczos(earth, max(2, earth.shape[1] // 2), max(2, earth.shape[0] // 2))
        overlay_side, core_side = None, None
        slope_kwargs = {'full_factor': 2, 'core_half_m': None, 'core_factor': 2}
    west, east = split_east_west(moon8)
    if production and (west.shape != east.shape or west.shape[:2] != (4096, 4096)):
        raise ValueError('the 8K split is not two 4096x4096 halves')
    height_image = encode_height_km(heights)

    hill8 = _as_grey(np.asarray(Image.open(maps / 'hillshade_8k.webp')))
    if production:
        meta = json.loads((maps / 'meta.json').read_text(encoding='utf-8'))
        half = float(meta['half_width_m'])
        if hill8.shape[0] != hill8.shape[1]:
            raise ValueError('hillshade_8k.webp is not square')
        pixel = 2 * half / hill8.shape[0]
        if abs(core_side * pixel - 2 * CORE_HALF_M) > 1e-6:
            raise ValueError('the hillshade core crop is not plus or minus 76 km')
        hill_core = crop_centre(hill8, core_side)
        sun = resize_lanczos(_as_grey(np.asarray(Image.open(maps / 'sunlight_4k.webp'))), overlay_side, overlay_side)
        earthvis = resize_lanczos(_as_grey(np.asarray(Image.open(maps / 'earthvis_4k.webp'))), overlay_side, overlay_side)
    else:
        hill_core = crop_centre(hill8, hill8.shape[0] // 2)
        sun = resize_lanczos(_as_grey(np.asarray(Image.open(maps / 'sunlight_4k.webp'))), max(2, hill8.shape[0] // 2), max(2, hill8.shape[0] // 2))
        earthvis = resize_lanczos(_as_grey(np.asarray(Image.open(maps / 'earthvis_4k.webp'))), sun.shape[1], sun.shape[0])
    dem = PreparedMap(dem_path)
    slope, slope_core = slope_maps(dem, **slope_kwargs)

    store = DemStore(core=dem_path, wide=wide)
    sites = json.loads(Path(sites_path).read_text(encoding='utf-8'))
    apron_size = APRON_SIZE if production else 5
    apron_window = APRON_WINDOW_M if production else 8_000.0
    aprons = []
    apron_arrays = {}
    for site in sites:
        if site['terrain_tier'] == 'sphere':
            continue
        sampled = apron_heights(store.sample, site['lat_deg'], site['lon_deg'], apron_size, apron_window)
        centre = sampled[apron_size // 2, apron_size // 2]
        if not np.isfinite(centre):
            raise RuntimeError(f"{site['id']}: apron centre has no height; the terrain map does not cover the site")
        encoded = encode_apron(sampled)
        rel = f"aprons/{site['id']}.bin"
        apron_arrays[rel] = encoded
        aprons.append(SceneApronFile(site_id=site['id'], file=f'scene/{rel}', rows=apron_size, columns=apron_size, window_m=apron_window))

    hill_ref = Image.open(maps / 'hillshade_4k.webp')
    images = [
        _image_entry('scene/moon_2k.webp', moon2, 'webp_q82_m6', EQUIRECT, note4, 'Lanczos resize of the oriented 4K colour map.', MOON_CREDIT),
        _image_entry('scene/moon_4k.webp', moon4, 'webp_q82_m6', EQUIRECT, note4, 'Re-encoded at the source size. No resample.', MOON_CREDIT),
        _image_entry('scene/moon_8k_w.webp', west, 'webp_q80_m6', EQUIRECT, note8, 'Exact west half, 180 W to 0, columns [0, width/2).', MOON_CREDIT, optional=True),
        _image_entry('scene/moon_8k_e.webp', east, 'webp_q80_m6', EQUIRECT, note8, 'Exact east half, 0 to 180 E, columns [width/2, width). The halves join with no overlap and no gap.', MOON_CREDIT, optional=True),
        _image_entry('scene/moon_height_1440.png', height_image, 'png_grey8', EQUIRECT, note_h, 'Heights in kilometres, from -9.0 to +10.6, mapped linearly to 0-255.', MOON_CREDIT),
        _image_entry('scene/earth_2k.jpg', earth_out, 'jpeg_q84_progressive', EQUIRECT, note_e, 'Lanczos resize to 2048x1024.' if production else 'Lanczos resize of the oriented Blue Marble.', EARTH_CREDIT),
        _image_entry('maps/hillshade_4k.webp', np.zeros((hill_ref.height, hill_ref.width), np.uint8), 'webp_q80_m4', POLAR, 'data/derived/maps/hillshade_4k.webp', 'Not copied. The scene reads the polar-map hillshade.', LOLA_CREDIT),
        _image_entry('scene/hillshade_core_2048.webp', hill_core, 'webp_q85_m6', POLAR, 'data/derived/maps/hillshade_8k.webp', 'Centre crop. At 8192 pixels over plus or minus 304 km this is plus or minus 76 km, centred on the pole to the pixel.', LOLA_CREDIT),
        _image_entry('scene/sunlight_2k.webp', sun, 'webp_q85_m6', POLAR, 'data/derived/maps/sunlight_4k.webp', 'Lanczos resize to grey. 0 is black and 1 is white, as in maps/.', LOLA_CREDIT),
        _image_entry('scene/earthvis_2k.webp', earthvis, 'webp_q85_m6', POLAR, 'data/derived/maps/earthvis_4k.webp', 'Lanczos resize to grey. 0 is black and 1 is white, as in maps/.', LOLA_CREDIT),
        _image_entry('scene/cap_slope.webp', slope, 'webp_q92_m6', POLAR, 'prepared LDEM_80S_80MPP_ADJ', 'Exact 4x4 block mean, then central differences. Red is dz/dx (+x east), green is dz/dy (+y north), stored as round(128 + 160 * slope).', LOLA_CREDIT),
        _image_entry('scene/cap_slope_core.webp', slope_core, 'webp_lossless_m6', POLAR, 'prepared LDEM_80S_80MPP_ADJ', 'Centre plus or minus 76 km, exact 2x2 block mean, same slope encoding, lossless.', LOLA_CREDIT),
    ]
    # The referenced hillshade entry used a dummy array only for its declared size.
    images[6] = images[6].model_copy(update={'width_px': hill_ref.width, 'height_px': hill_ref.height})
    arrays = {
        'moon_2k.webp': (moon2, 'webp_q82_m6'),
        'moon_4k.webp': (moon4, 'webp_q82_m6'),
        'moon_8k_w.webp': (west, 'webp_q80_m6'),
        'moon_8k_e.webp': (east, 'webp_q80_m6'),
        'moon_height_1440.png': (height_image, 'png_grey8'),
        'earth_2k.jpg': (earth_out, 'jpeg_q84_progressive'),
        'hillshade_core_2048.webp': (hill_core, 'webp_q85_m6'),
        'sunlight_2k.webp': (sun, 'webp_q85_m6'),
        'earthvis_2k.webp': (earthvis, 'webp_q85_m6'),
        'cap_slope.webp': (slope, 'webp_q92_m6'),
        'cap_slope_core.webp': (slope_core, 'webp_lossless_m6'),
    }
    output.mkdir(parents=True, exist_ok=True)
    (output / 'aprons').mkdir(exist_ok=True)
    for name, (array, encoding) in arrays.items():
        _write_encoded(output / name, array, encoding)
    for rel, encoded in apron_arrays.items():
        (output / rel).write_bytes(encoded.tobytes())
    meta = SceneMeta(generated_utc=generated_utc, images=images, aprons=aprons, apron=ApronLayout(), inputs=list(inputs))
    text = json.dumps(meta.model_dump(mode='json'), indent=2, ensure_ascii=False) + '\n'
    (output / 'meta.json').write_bytes(text.encode('utf-8'))
    return meta


def write_fixture_scene(root, sites, generated_utc):
    """Tiny asymmetric scene files. One apron for each non-sphere fixture site."""
    root = Path(root)
    scene = root / 'scene'
    aprons = scene / 'aprons'
    aprons.mkdir(parents=True, exist_ok=True)

    def rgb(height, width):
        image = np.zeros((height, width, 3), np.uint8)
        image[0, 0] = (255, 0, 0)
        image[0, -1] = (0, 180, 0)
        image[-1, 0] = (0, 0, 220)
        image[-1, -1] = (255, 255, 255)
        image[0, width // 2] = (40, 40, 40)
        return image

    def grey(height, width):
        row, col = np.mgrid[0:height, 0:width]
        return (row * 17 + col * 3).astype(np.uint8)

    files = {
        'moon_2k.webp': (rgb(8, 16), 'webp_q82_m6'),
        'moon_4k.webp': (rgb(16, 32), 'webp_q82_m6'),
        'moon_8k_w.webp': (rgb(16, 16), 'webp_q80_m6'),
        'moon_8k_e.webp': (rgb(16, 16), 'webp_q80_m6'),
        'moon_height_1440.png': (grey(8, 16), 'png_grey8'),
        'earth_2k.jpg': (rgb(8, 16), 'jpeg_q84_progressive'),
        'hillshade_core_2048.webp': (grey(16, 16), 'webp_q85_m6'),
        'sunlight_2k.webp': (grey(16, 16), 'webp_q85_m6'),
        'earthvis_2k.webp': (grey(16, 16), 'webp_q85_m6'),
        'cap_slope.webp': (rgb(8, 8), 'webp_q92_m6'),
        'cap_slope_core.webp': (rgb(8, 8), 'webp_lossless_m6'),
    }
    # Make the east half differ so a swapped split is obvious.
    east = rgb(16, 16)
    east[:, :, 2] = np.minimum(east[:, :, 2].astype(np.uint16) + 30, 255).astype(np.uint8)
    files['moon_8k_e.webp'] = (east, 'webp_q80_m6')
    for name, (array, encoding) in files.items():
        _write_encoded(scene / name, array, encoding)
    heights = fixture_apron_heights()
    encoded = encode_apron(heights)
    apron_files = []
    for site in sites:
        if site['terrain_tier'] == 'sphere':
            continue
        (aprons / f"{site['id']}.bin").write_bytes(encoded.tobytes())
        apron_files.append(SceneApronFile(
            site_id=site['id'], file=f"scene/aprons/{site['id']}.bin", rows=5, columns=5, window_m=8000.0,
        ))
    hill = Image.open(root / 'maps' / 'hillshade_4k.webp')
    images = []
    described = {
        'moon_2k.webp': ('webp_q82_m6', EQUIRECT, False),
        'moon_4k.webp': ('webp_q82_m6', EQUIRECT, False),
        'moon_8k_w.webp': ('webp_q80_m6', EQUIRECT, True),
        'moon_8k_e.webp': ('webp_q80_m6', EQUIRECT, True),
        'moon_height_1440.png': ('png_grey8', EQUIRECT, False),
        'earth_2k.jpg': ('jpeg_q84_progressive', EQUIRECT, False),
        'hillshade_core_2048.webp': ('webp_q85_m6', POLAR, False),
        'sunlight_2k.webp': ('webp_q85_m6', POLAR, False),
        'earthvis_2k.webp': ('webp_q85_m6', POLAR, False),
        'cap_slope.webp': ('webp_q92_m6', POLAR, False),
        'cap_slope_core.webp': ('webp_lossless_m6', POLAR, False),
    }
    for name, (encoding, orientation, optional) in described.items():
        array = files[name][0]
        images.append(SceneImage(
            file=f'scene/{name}', width_px=array.shape[1], height_px=array.shape[0], encoding=encoding,
            orientation=orientation, source='synthetic fixture', operation='Asymmetric pattern, not a NASA image.',
            credit='Synthetic fixture. Not a scientific image.', optional=optional,
        ))
    images.insert(6, SceneImage(
        file='maps/hillshade_4k.webp', width_px=hill.width, height_px=hill.height, encoding='webp_lossless',
        orientation=POLAR, source='data/fixtures/maps/hillshade_4k.webp', operation='Not copied. Fixture polar-map hillshade.',
        credit='Synthetic fixture. Not a scientific image.',
    ))
    meta = SceneMeta(generated_utc=generated_utc, images=images, aprons=apron_files, apron=ApronLayout(), inputs=[])
    text = json.dumps(meta.model_dump(mode='json'), indent=2, ensure_ascii=False) + '\n'
    (scene / 'meta.json').write_bytes(text.encode('utf-8'))
    return meta


def fixture_apron_heights():
    """5 by 5 heights. (row 0, col 1) and (row 1, col 0) differ, so a transpose is obvious.

    Height at row r, column c is 1000 + 100 * r + 10 * c metres.
    """
    row, col = np.mgrid[0:5, 0:5]
    return (1000 + 100 * row + 10 * col).astype(np.float64)
