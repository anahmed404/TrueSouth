import json
import numpy as np
import rasterio
from rasterio.transform import from_origin
from PIL import Image

from truesouth import maps
from truesouth.commands import build_maps
from truesouth.contracts import MapMeta
from truesouth.dem import EXPECTED_CRS
from truesouth.frames import polar_stereo_forward, polar_stereo_inverse


def test_shade_plane_and_cone():
    y, x = np.mgrid[-10:11, -10:11]
    flat = maps.hillshade(x * 0, 1)
    toward = maps.hillshade(x + y, 1)
    away = maps.hillshade(-x - y, 1)
    assert np.isclose(flat[10, 10], 1 / np.sqrt(2))
    assert toward[10, 10] > flat[10, 10] > away[10, 10]
    cone = maps.hillshade(-np.hypot(x, y), 1)
    assert cone[5, 5] > cone[15, 15]


def test_encoding_and_valid_mean():
    a = maps.encode_lookup(np.array([0, .5, .999, 1, np.nan]))
    assert a.tolist() == [0, 128, 254, 254, 255]
    fractions = np.linspace(0, 1, 1001)
    assert np.max(np.abs(maps.encode_lookup(fractions) / 255 - fractions)) <= 1 / 255
    data = np.array([[0.2, np.nan], [0.8, np.nan]], dtype=np.float32)
    sums = np.zeros(4); counts = np.zeros(4, dtype=np.uint32)
    maps.accumulate_lookup(data, (.5, 0, -1, 0, -.5, 1), 2, 2, sums, counts)
    grid = maps.lookup_mean(sums, counts, 2)
    assert np.isclose(grid[0, 0], .5)
    assert maps.encode_lookup(grid)[1, 1] == 255


def test_orientation_quadrants(tmp_path):
    source = np.zeros((9, 9), dtype=np.float32)
    transform = (1, 0, -4.5, 0, -1, 4.5)
    for row, col in [(1, 2), (2, 7), (7, 1), (6, 7)]:
        source.fill(0); source[row, col] = 1
        x, y = col - 4, 4 - row
        lat, lon = polar_stereo_inverse(x, y)
        xx, yy = polar_stereo_forward(lat, lon)
        expected = (round(4 - yy), round(xx + 4))
        sampled = maps.sample_grid(source, transform, 9, 4.5)
        sums = np.zeros(81); counts = np.zeros(81, dtype=np.uint32)
        maps.accumulate_lookup(source, transform, 9, 4.5, sums, counts)
        lookup = maps.lookup_mean(sums, counts, 9)
        assert np.unravel_index(np.nanargmax(sampled), sampled.shape) == expected
        assert np.unravel_index(np.nanargmax(lookup), lookup.shape) == expected
        for name in ('sunlight', 'earthvis'):
            build_maps.make_visibility(source, transform, None, None, name, tmp_path, 9, 9, 4.5)
            pixels = np.asarray(Image.open(tmp_path / f'{name}_4k.webp').convert('L'))
            stored = np.fromfile(tmp_path / f'{name}_u8.bin', dtype=np.uint8).reshape(9, 9)
            assert np.unravel_index(np.argmax(pixels), pixels.shape) == expected
            assert np.unravel_index(np.argmax(stored), stored.shape) == expected
        for altered in (sampled[::-1], sampled[:, ::-1], sampled.T):
            assert np.unravel_index(np.nanargmax(altered), altered.shape) != expected


def test_matching_sources_seam():
    core = np.full((4, 4), .6, dtype=np.float32)
    wide = np.full((8, 8), .6, dtype=np.float32)
    ct = (1, 0, -2, 0, -1, 2); wt = (1, 0, -4, 0, -1, 4)
    mask = build_maps.core_mask(core, ct, wt)
    sums = np.zeros(64); counts = np.zeros(64, dtype=np.uint32)
    maps.accumulate_lookup(core, ct, 8, 4, sums, counts)
    maps.accumulate_lookup(wide, wt, 8, 4, sums, counts, mask)
    assert np.allclose(maps.lookup_mean(sums, counts, 8), .6)


def test_synthetic_build_repeatable(tmp_path, monkeypatch):
    raw = tmp_path / 'raw'; raw.mkdir()
    prep = tmp_path / 'prepared'; prep.mkdir()
    derived = tmp_path / 'derived'; derived.mkdir()
    dem = np.zeros((16, 16), dtype=np.float32)
    np.save(prep / 'LDEM_80S_80MPP_ADJ.npy', dem)
    (prep / 'LDEM_80S_80MPP_ADJ.json').write_text(json.dumps({'pixel_x': 1, 'pixel_y': -1, 'origin_x': -8, 'origin_y': 8}), encoding='utf-8')
    for suffix in ('', '_EARTH'):
        for extent, pixels in [('85S_060M', 16), ('75S_120M', 16)]:
            path = raw / f'AVGVISIB_{extent}_201608{suffix}.TIF'
            with rasterio.open(path, 'w', driver='GTiff', width=pixels, height=pixels, count=1, dtype='int16', crs=EXPECTED_CRS.to_wkt(), transform=from_origin(-8, 8, 1, 1), nodata=-32768) as dst:
                dst.write(np.full((pixels, pixels), 5000, dtype=np.int16), 1)
                dst.scales = (0.0001,); dst.offsets = (0,)
    monkeypatch.setattr(build_maps, 'prepared_dir', lambda: prep)
    monkeypatch.setattr(build_maps, 'raw_dir', lambda: raw)
    monkeypatch.setattr(build_maps, 'derived_dir', lambda: derived)
    original = build_maps.build
    monkeypatch.setattr(build_maps, 'build', lambda folder: original(folder, 16, 32, 8, 8))
    from truesouth.cli import main
    assert main(['build-maps']) == 0
    first = {p.name: p.read_bytes() for p in (derived / 'maps').iterdir()}
    MapMeta.model_validate_json(first['meta.json'])
    assert main(['build-maps']) == 0
    assert first == {p.name: p.read_bytes() for p in (derived / 'maps').iterdir()}
