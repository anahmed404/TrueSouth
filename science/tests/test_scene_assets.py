"""Scene images and aprons. Synthetic inputs only; no NASA files."""
import json

import numpy as np
import pytest
from PIL import Image

from truesouth.contracts import SceneMeta
from truesouth.dem import DemStore
from truesouth.frames import destination, polar_stereo_forward
from truesouth.scene_assets import (
    apron_axes, apron_heights, assert_moon_colour, block_mean, build_scene, crop_centre,
    decode_apron, encode_apron, encode_height_km, equirect_pixel, fixture_apron_heights,
    normalize_equirectangular, read_raster, slope_rgb, split_east_west, write_fixture_scene,
)
from truesouth.commands.build_scene_assets import is_current
from truesouth.terrain_mesh import _offset_axes


def _geotiff(path, image, west, top, pixel_lon, pixel_lat):
    import rasterio
    from rasterio.transform import Affine

    array = np.asarray(image)
    if array.ndim == 2:
        data = array[None, ...]
    else:
        data = np.transpose(array, (2, 0, 1))
    transform = Affine(pixel_lon, 0, west, 0, pixel_lat, top)
    with rasterio.open(path, 'w', driver='GTiff', height=array.shape[0], width=array.shape[1], count=data.shape[0], dtype=str(data.dtype), transform=transform, crs='EPSG:4326') as dst:
        dst.write(data)


def _mark_source(west, top, pixel_lon, pixel_lat, lon, lat, value=255):
    """A 36 by 18 degree grid with one bright pixel at a geographic point."""
    image = np.zeros((18, 36), np.uint8)
    column = int(np.floor((lon - west) / pixel_lon))
    row = int(np.floor((lat - top) / pixel_lat))
    image[row, column] = value
    return image, row, column


def test_equirectangular_mark_survives_roll_and_flip(tmp_path):
    # Pixel centres: longitude 25, latitude 25. Output cell is row 6, column 20.
    expect = equirect_pixel(25, 25, 36, 18)
    assert expect == (6, 20)
    cases = [
        (-180, 90, 10, -10, 25, 25),
        (0, 90, 10, -10, 25, 25),
        (-180, -90, 10, 10, 25, 25),
    ]
    for index, (west, top, pixel_lon, pixel_lat, lon, lat) in enumerate(cases):
        image, _row, _column = _mark_source(west, top, pixel_lon, pixel_lat, lon, lat)
        path = tmp_path / f'source-{index}.tif'
        _geotiff(path, image, west, top, pixel_lon, pixel_lat)
        stored, grid, note = read_raster(path)
        assert grid is not None
        assert 'crs' in note
        oriented = normalize_equirectangular(stored, *grid)
        row, column = expect
        assert oriented[row, column] == 255
        assert int(oriented.sum()) == 255
        assert oriented[::-1][row, column] != 255
        assert np.roll(oriented, 1, axis=1)[row, column] != 255


def test_landmark_check_rejects_a_flip_and_a_shift():
    image = np.full((180, 360, 3), 100, np.uint8)
    for lon, lat, colour in ((348.8, -43.3, 255), (59.0, 17.0, 0)):
        row, column = equirect_pixel(lon, lat, 360, 180)
        image[row - 5:row + 6, column - 5:column + 6] = colour
    assert_moon_colour(image)
    with pytest.raises(ValueError, match='Tycho'):
        assert_moon_colour(image[::-1])
    with pytest.raises(ValueError, match='Tycho|Crisium'):
        assert_moon_colour(np.roll(image, image.shape[1] // 2, axis=1))


def test_east_west_split_joins_without_a_seam():
    image = np.arange(4 * 8 * 3, dtype=np.uint8).reshape(4, 8, 3)
    west, east = split_east_west(image)
    assert west.shape == (4, 4, 3)
    assert np.array_equal(west[:, -1], image[:, 3])
    assert np.array_equal(east[:, 0], image[:, 4])
    assert np.array_equal(np.concatenate([west, east], axis=1), image)


def test_height_mapping_clips_and_scales():
    encoded = encode_height_km(np.array([[-9.0, 10.6], [0.8, -20.0]]))
    assert encoded.tolist() == [[0, 255], [128, 0]]


def test_slope_of_a_tilted_plane_and_the_north_sign():
    step = 100.0
    columns = np.arange(5)
    rows = np.arange(5)
    x = columns * step
    y = (4 - rows) * step
    heights = 0.05 * x[None, :] + 0.02 * y[:, None]
    rgb = slope_rgb(heights, step)
    assert rgb[2, 2, 0] == 136
    assert rgb[2, 2, 1] == 131
    assert rgb[2, 2, 2] == 128
    assert rgb[2, 2, 1] > 128


def test_core_crop_is_centred_to_the_pixel():
    image = np.arange(32 * 32).reshape(32, 32)
    assert np.array_equal(crop_centre(image, 8), image[12:20, 12:20])
    with pytest.raises(ValueError, match='centred'):
        crop_centre(image, 7)


def test_apron_axes_match_the_patch():
    east, north = apron_axes(161, 300_000)
    half = 150_000.0
    index = np.arange(161)
    assert np.allclose(east, half * (-1 + 2 * index / 160))
    assert np.allclose(north, half * (1 - 2 * index / 160))
    patch_east, patch_north = _offset_axes(161, 300)
    assert np.array_equal(east, patch_east)
    assert np.array_equal(north, patch_north)
    assert north[0] > north[-1]
    assert east[0] < east[-1]


def test_apron_peak_lands_on_the_predicted_cell_and_matches_demstore(tmp_path):
    lat, lon = -85.0, 0.0
    peak_east, peak_north = 2000.0, 1000.0
    distance = float(np.hypot(peak_east, peak_north))
    azimuth = float(np.degrees(np.arctan2(peak_east, peak_north)))
    peak_lat, peak_lon = destination(lat, lon, azimuth, distance)
    x, y = polar_stereo_forward(peak_lat, peak_lon)
    pixel = 200.0
    row = column = 40
    origin_x = float(x) - (column + 0.5) * pixel
    origin_y = float(y) + (row + 0.5) * pixel
    heights = np.full((80, 80), 250.0, np.float32)
    heights[row - 1:row + 2, column - 1:column + 2] = 5000.0
    dem = tmp_path / 'dem.npy'
    np.save(dem, heights)
    projection = 'PROJECTION["Polar_Stereographic"] PARAMETER["latitude_of_origin",-90] PARAMETER["central_meridian",0]'
    # The pole of this small map is not its centre, so slope_maps is not used here.
    (dem.with_suffix('.json')).write_text(json.dumps({
        'origin_x': origin_x, 'origin_y': origin_y, 'pixel_x': pixel, 'pixel_y': -pixel,
        'projection': projection, 'shape': [80, 80],
    }), encoding='utf-8')
    store = DemStore(core=dem)
    sampled = apron_heights(store.sample, lat, lon, 9, 8_000)
    encoded = encode_apron(sampled)
    assert encoded.shape == (9, 9)
    assert encoded[3, 6] == 34000
    assert encoded[6, 3] != 34000
    assert encoded[5, 6] != 34000
    decoded = decode_apron(encoded)
    again, _missing = store.sample(*_walked(lat, lon, 9, 8_000))
    finite = np.isfinite(again)
    assert finite[3, 6]
    assert np.allclose(decoded[finite], again[finite], atol=0.25)
    assert np.isnan(decoded[encoded == 65535]).all()


def _walked(lat, lon, size, window_m):
    east, north = apron_axes(size, window_m)
    east_m = np.broadcast_to(east, (size, size))
    north_m = np.broadcast_to(north[:, None], (size, size))
    distance = np.hypot(east_m, north_m)
    azimuth = np.degrees(np.arctan2(east_m, north_m))
    return destination(lat, lon, azimuth, distance)


def test_block_mean_is_exact():
    values = np.arange(16, dtype=np.float64).reshape(4, 4)
    mean = block_mean(values, 2)
    assert mean.shape == (2, 2)
    assert mean[0, 0] == np.mean(values[:2, :2])
    assert mean[1, 1] == np.mean(values[2:, 2:])


def _tiny_sources(tmp_path):
    from PIL import Image as PILImage

    raw = tmp_path / 'raw'
    raw.mkdir()
    rgb = np.zeros((16, 32, 3), np.uint8)
    rgb[1, 2] = (255, 0, 0)
    rgb[14, 30] = (0, 0, 255)
    PILImage.fromarray(rgb, 'RGB').save(raw / 'moon4.tif')
    wide = np.zeros((16, 32, 3), np.uint8)
    wide[:, :, 0] = np.arange(32, dtype=np.uint8)[None, :]
    PILImage.fromarray(wide, 'RGB').save(raw / 'moon8.tif')
    height = np.zeros((8, 16), np.float32)
    height[1, 1] = 1.5
    np.save(tmp_path / 'height.npy', height)  # replaced by a tiff below
    import rasterio
    from rasterio.transform import Affine
    with rasterio.open(raw / 'height.tif', 'w', driver='GTiff', height=8, width=16, count=1, dtype='float32', transform=Affine.identity(), crs=None) as dst:
        dst.write(height[None, ...])
    PILImage.fromarray(rgb, 'RGB').save(raw / 'earth.jpg', quality=90)
    maps = tmp_path / 'maps'
    maps.mkdir()
    grey = (np.arange(32 * 32).reshape(32, 32) % 251).astype(np.uint8)
    for name in ('hillshade_4k.webp', 'hillshade_8k.webp', 'sunlight_4k.webp', 'earthvis_4k.webp'):
        PILImage.fromarray(grey, 'L').save(maps / name, format='WEBP', lossless=True, method=6)
    (maps / 'meta.json').write_text(json.dumps({'half_width_m': 304000, 'projection': 'south_polar_stereographic'}), encoding='utf-8')
    dem = tmp_path / 'dem.npy'
    grid = np.full((32, 32), 1500, np.float32)
    np.save(dem, grid)
    (dem.with_suffix('.json')).write_text(json.dumps({
        'origin_x': -64000.0, 'origin_y': 64000.0, 'pixel_x': 4000.0, 'pixel_y': -4000.0,
        'projection': 'PROJECTION["Polar_Stereographic"] PARAMETER["latitude_of_origin",-90] PARAMETER["central_meridian",0]',
        'shape': [32, 32],
    }), encoding='utf-8')
    sites = [
        {'id': 'ridge', 'lat_deg': -89.9, 'lon_deg': 0.0, 'terrain_tier': 'core80'},
        {'id': 'plain', 'lat_deg': 0.0, 'lon_deg': 20.0, 'terrain_tier': 'sphere'},
    ]
    sites_path = tmp_path / 'sites.json'
    sites_path.write_text(json.dumps(sites), encoding='utf-8')
    return {
        'moon_4k': raw / 'moon4.tif', 'moon_8k': raw / 'moon8.tif', 'moon_height': raw / 'height.tif',
        'earth': raw / 'earth.jpg', 'dem': dem, 'wide': None, 'maps': maps, 'sites': sites_path,
    }


def test_build_matches_disk_and_repeats_byte_for_byte(tmp_path):
    paths = _tiny_sources(tmp_path)
    first = tmp_path / 'one'
    second = tmp_path / 'two'
    meta = build_scene(first, paths, '2026-01-01T00:00:00Z', [], production=False)
    build_scene(second, paths, '2026-01-01T00:00:00Z', [], production=False)
    files = sorted(path.relative_to(first).as_posix() for path in first.rglob('*') if path.is_file())
    assert files == sorted(path.relative_to(second).as_posix() for path in second.rglob('*') if path.is_file())
    for rel in files:
        assert (first / rel).read_bytes() == (second / rel).read_bytes()
    loaded = SceneMeta.model_validate_json((first / 'meta.json').read_text(encoding='utf-8'))
    assert loaded == meta
    assert [apron.site_id for apron in loaded.aprons] == ['ridge']
    moon8, _grid, _note = read_raster(paths['moon_8k'])
    west = np.asarray(Image.open(first / 'moon_8k_w.webp'))
    east = np.asarray(Image.open(first / 'moon_8k_e.webp'))
    # WebP is lossy, so the seam test uses the split of the source, which the
    # build writes from. Re-reading WebP is not a byte copy. Check shapes and
    # that the two halves cover the source width with no extra column.
    assert west.shape[1] + east.shape[1] == moon8.shape[1]
    assert west.shape[0] == moon8.shape[0]
    for image in loaded.images:
        if not image.file.startswith('scene/'):
            assert (paths['maps'] / 'hillshade_4k.webp').is_file()
            continue
        path = first / image.file.removeprefix('scene/')
        assert path.is_file()
        if path.suffix == '.bin':
            continue
        with Image.open(path) as opened:
            assert (opened.width, opened.height) == (image.width_px, image.height_px)
    apron = first / 'aprons' / 'ridge.bin'
    assert apron.stat().st_size == 5 * 5 * 2
    assert not (first / 'aprons' / 'plain.bin').exists()
    from truesouth.scene_assets import scene_inputs
    current = scene_inputs([paths['moon_4k']])
    # Rewrite meta inputs to those fingerprints and confirm the skip check.
    text = json.loads((first / 'meta.json').read_text(encoding='utf-8'))
    text['inputs'] = [item.model_dump() for item in current]
    (first / 'meta.json').write_text(json.dumps(text), encoding='utf-8')
    assert is_current(first, current)
    current[0] = current[0].model_copy(update={'bytes': current[0].bytes + 1})
    assert not is_current(first, current)


def test_missing_source_names_the_file(tmp_path):
    paths = _tiny_sources(tmp_path)
    paths['moon_height'] = tmp_path / 'ldem_4.tif'
    with pytest.raises(FileNotFoundError, match='ldem_4.tif'):
        build_scene(tmp_path / 'out', paths, '2026-01-01T00:00:00Z', [], production=False)


def test_fixture_scene_apron_cells_differ_under_a_transpose(tmp_path):
    sites = [
        {'id': 'fixture_ridge', 'terrain_tier': 'core80'},
        {'id': 'fixture_sphere', 'terrain_tier': 'sphere'},
    ]
    maps = tmp_path / 'maps'
    maps.mkdir()
    Image.fromarray(np.zeros((4, 4), np.uint8), 'L').save(maps / 'hillshade_4k.webp', format='WEBP', lossless=True)
    write_fixture_scene(tmp_path, sites, '2026-01-01T00:00:00Z')
    raw = np.frombuffer((tmp_path / 'scene' / 'aprons' / 'fixture_ridge.bin').read_bytes(), dtype='<u2').reshape(5, 5)
    assert raw[0, 1] == 26020
    assert raw[1, 0] == 26200
    assert not (tmp_path / 'scene' / 'aprons' / 'fixture_sphere.bin').exists()
    SceneMeta.model_validate_json((tmp_path / 'scene' / 'meta.json').read_text(encoding='utf-8'))
    heights = fixture_apron_heights()
    assert decode_apron(raw)[0, 1] == heights[0, 1]
