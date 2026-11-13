"""Make the web textures for the space-first prototype. Inputs are read only.

Usage (from the repo root):
  uv run python design/variants/space-first/tools/make_assets.py DL DL2 OUT MAPS DEM
    DL    folder with lroc_color_poles_4k.tif, lroc_color_poles_8k.tif, ldem_4.tif (NASA SVS 4720)
    DL2   folder with world.topo.bathy.200403.3x5400x2700.jpg (NASA Blue Marble NG)
    OUT   design/variants/space-first/assets
    MAPS  data/derived/maps (from main, PR #48)
    DEM   the prepared LDEM_80S_80MPP_ADJ.npy (with its .json sidecar)
Downloads used httpx with truststore (never with certificate checks off).
"""
import sys, json, os, shutil, pathlib
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
DL, DL2, OUT, MAPS, DEM = [pathlib.Path(p) for p in sys.argv[1:6]]
OUT.mkdir(parents=True, exist_ok=True)
sizes = {}
def save(im, name, **kw):
    p = OUT / name; im.save(p, **kw); sizes[name] = p.stat().st_size; print(name, im.size, round(sizes[name]/1e6, 2), 'MB', flush=True)

# Moon colour, 4K (and 2K for phones), 8K split into west/east halves
m4 = Image.open(DL / 'lroc_color_poles_4k.tif').convert('RGB')
save(m4, 'moon_4k.webp', quality=82, method=6)
save(m4.resize((2048, 1024), Image.LANCZOS), 'moon_2k.webp', quality=82, method=6)
m8 = Image.open(DL / 'lroc_color_poles_8k.tif').convert('RGB')
save(m8.crop((0, 0, 4096, 4096)), 'moon_8k_w.webp', quality=80, method=6)
save(m8.crop((4096, 0, 8192, 4096)), 'moon_8k_e.webp', quality=80, method=6)
# Height map (km) -> 8-bit, for relief along the day/night line
h = np.array(Image.open(DL / 'ldem_4.tif'), dtype=np.float32)
lo, hi = -9.0, 10.6
save(Image.fromarray(np.clip((h - lo) / (hi - lo) * 255 + .5, 0, 255).astype(np.uint8), 'L'), 'moon_height_1440.png', optimize=True)
# Earth, March Blue Marble
e = Image.open(DL2 / 'world.topo.bathy.200403.3x5400x2700.jpg').convert('RGB')
save(e.resize((2048, 1024), Image.LANCZOS), 'earth_2k.jpg', quality=84, optimize=True, progressive=True)
# Polar cap maps from TrueSouth's pipeline
for f in ['hillshade_4k.webp', 'meta.json']:
    shutil.copy(MAPS / f, OUT / f); sizes[f] = (OUT / f).stat().st_size
hs8 = Image.open(MAPS / 'hillshade_8k.webp').convert('L')
c = 8192 // 2
save(hs8.crop((c - 1024, c - 1024, c + 1024, c + 1024)), 'hillshade_core_2048.webp', quality=85, method=6)
for f in ['sunlight', 'earthvis']:
    save(Image.open(MAPS / f'{f}_4k.webp').convert('L').resize((2048, 2048), Image.LANCZOS), f'{f}_2k.webp', quality=85, method=6)

# Terrain patches for the four polar sites, from the 80 m map (section 2.2, 2.3, 13)
R = 1737400.0
meta = json.load(open(str(DEM).replace('.npy', '.json')))
Z = np.load(DEM, mmap_mode='r')
ox, oy, px = meta['origin_x'], meta['origin_y'], meta['pixel_x']
# a 640 m copy for the apron (block mean of 8 x 8)
Zc = np.asarray(Z, dtype=np.float32).reshape(950, 8, 950, 8).mean(axis=(1, 3))
def sample(arr, step, lat, lon):
    rho = 2 * R * np.tan(np.radians(45 + lat / 2)); x = rho * np.sin(np.radians(lon)); y = rho * np.cos(np.radians(lon))
    c = (x - ox) / step - .5; r = (oy - y) / step - .5
    c0 = np.clip(np.floor(c).astype(int), 0, arr.shape[1] - 2); r0 = np.clip(np.floor(r).astype(int), 0, arr.shape[0] - 2)
    fc = np.clip(c - c0, 0, 1); fr = np.clip(r - r0, 0, 1)
    a = arr[r0, c0]; b = arr[r0, c0 + 1]; d = arr[r0 + 1, c0]; e = arr[r0 + 1, c0 + 1]
    return (a * (1 - fc) + b * fc) * (1 - fr) + (d * (1 - fc) + e * fc) * fr
def walk(lat1, lon1, E, N):
    s = np.hypot(E, N); A = np.arctan2(E, N); g = s / R; p1 = np.radians(lat1)
    p2 = np.arcsin(np.sin(p1) * np.cos(g) + np.cos(p1) * np.sin(g) * np.cos(A))
    l2 = np.radians(lon1) + np.arctan2(np.sin(A) * np.sin(g) * np.cos(p1), np.cos(g) - np.sin(p1) * np.sin(p2))
    return np.degrees(p2), np.degrees(l2) % 360
SITES = {'cr': (-89.4555, 222.6192), 'mal': (-85.9948, 359.7642), 'mou': (-85.4266, 31.7428), 'dgr': (-88.2300, 295.3716)}
info = {}
for sid, (lat, lon) in SITES.items():
    out = []
    for n, half, arr, step in [(257, 10000.0, Z, px), (161, 150000.0, Zc, px * 8)]:
        t = np.linspace(-half, half, n); E, N = np.meshgrid(t, t[::-1])  # row 0 = north edge
        la, lo_ = walk(lat, lon, E, N); z = sample(arr, step, la, lo_)
        out.append(np.clip(np.round((z + 12000) * 2), 0, 65535).astype('<u2'))
    z0 = float(sample(Z, px, np.array([lat]), np.array([lon]))[0])
    blob = np.concatenate([out[0].ravel(), out[1].ravel()]).tobytes()
    (OUT / f'terrain_{sid}.bin').write_bytes(blob); sizes[f'terrain_{sid}.bin'] = len(blob)
    info[sid] = {'lat': lat, 'lon': lon, 'z0_m': round(z0, 1), 'patch': [257, 20000], 'apron': [161, 300000], 'encoding': 'uint16 LE, (height_m + 12000) * 2, rows north to south'}
    print(sid, 'z0', round(z0, 1), 'patch range', (out[0].min() / 2 - 12000, out[0].max() / 2 - 12000))
json.dump(info, open(OUT / 'terrain.json', 'w'), indent=1)
print('TOTAL', round(sum(sizes.values()) / 1e6, 2), 'MB')
