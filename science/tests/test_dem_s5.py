import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin

from truesouth.frames import polar_stereo_inverse
from truesouth.dem import DemStore, prepare_map

CRS = "+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +a=1737400 +b=1737400 +units=m +no_defs"


def raster(path, data, origin=(-20, 20), pixel=10, crs=CRS):
    with rasterio.open(path, "w", driver="GTiff", width=data.shape[1], height=data.shape[0], count=1, dtype="float32", crs=crs, transform=from_origin(*origin, pixel, pixel), nodata=-9999) as dst:
        dst.write(data.astype("float32"), 1)


def point(x, y):
    return polar_stereo_inverse(np.asarray(x), np.asarray(y))


def test_prepare_sample_and_tiers(tmp_path):
    core = np.arange(16, dtype=float).reshape(4, 4)
    core[1, 1] = 100
    core[3, 3] = -9999
    wide = np.full((8, 8), 7.)
    raster(tmp_path / "core.tif", core)
    raster(tmp_path / "wide.tif", wide, (-40, 40))
    prepare_map(tmp_path / "core.tif", tmp_path / "core.npy")
    prepare_map(tmp_path / "wide.tif", tmp_path / "wide.npy")
    store = DemStore(tmp_path / "core.npy", tmp_path / "wide.npy")
    lat, lon = point(np.array([-5, 25, 100, 15]), np.array([5, 0, 0, -15]))
    heights, missing = store.sample(lat, lon)
    assert heights[0] == pytest.approx(100)
    assert heights[1] == pytest.approx(7)
    assert np.isnan(heights[2:]).all()
    assert missing == 2
    assert list(store.tiers(lat, lon)) == ["core80", "wide240", "sphere", "core80"]
    lat, lon = point(0, 10)
    assert store.sample(lat, lon)[0] == pytest.approx((100 + 6 + 1 + 2) / 4)
    assert point(10, 0)[1] == pytest.approx(90)
    assert prepare_map(tmp_path / "core.tif", tmp_path / "core.npy") is False


def test_wrong_projection(tmp_path):
    raster(tmp_path / "wrong.tif", np.ones((4, 4)), crs="EPSG:4326")
    with pytest.raises(ValueError, match="projection"):
        prepare_map(tmp_path / "wrong.tif", tmp_path / "wrong.npy")
