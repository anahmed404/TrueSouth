"""Slope maps of the south polar cap, so the globe's cap is lit by the true Sun.

Reads NASA's 80 m LOLA map (the pipeline's prepared copy, read only) and writes two
images to the prototype's assets folder:
  cap_slope.webp       the whole cap, +-304 km, 1,900 px, 320 m a pixel (4 x 4 block mean)
  cap_slope_core.webp  the centre, +-76 km, 950 px, 160 m a pixel (2 x 2 block mean)
Red = dz/dx (east on the map, +x right), green = dz/dy (+y up), each stored as
128 + 160 * slope, clamped; blue is 128. Axes follow docs/science.md section 2.3.

Usage (from the repo root):
  uv run python design/variants/space-first/tools/make_cap_slopes.py DEM.npy OUT_DIR
"""
import sys, json, pathlib
import numpy as np
from PIL import Image

dem, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
meta = json.load(open(str(dem).replace('.npy', '.json')))
Z = np.load(dem, mmap_mode='r')
n = Z.shape[0]


def slopes(arr, px_m, f, name, lossless=False):
    # exact block mean by an integer factor: no resampling beat pattern
    m = arr.shape[0] // f * f
    h = np.asarray(arr[:m, :m], dtype=np.float64).reshape(m // f, f, m // f, f).mean(axis=(1, 3))
    size, step = h.shape[0], px_m * f
    gy, gx = np.gradient(h, step)          # gy: down the rows; map +y is up
    dzdx, dzdy = gx, -gy
    enc = lambda g: np.clip(np.round(128 + 160 * g), 0, 255).astype(np.uint8)
    rgb = np.dstack([enc(dzdx), enc(dzdy), np.full_like(enc(dzdx), 128)])
    p = out / name
    Image.fromarray(rgb, 'RGB').save(p, **({'lossless': True} if lossless else {'quality': 92}), method=6)
    print(name, size, round(step, 1), 'm/px', round(p.stat().st_size / 1e6, 2), 'MB')


px = meta['pixel_x']
slopes(Z, px, 4, 'cap_slope.webp')
c, k = n // 2, int(round(76000 / px))
slopes(Z[c - k:c + k, c - k:c + k], px, 2, 'cap_slope_core.webp', lossless=True)
