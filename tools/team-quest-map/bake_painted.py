#!/usr/bin/env python3
"""
Bakes the painted Team Quest world into the web assets the map loads.

The source paintings were generated once with an image model (see README.md)
on a flat magenta sky, plus a prop sheet on a green screen. This script:

  * keys the sky out (alpha + colour unmixing, so glows stay soft),
  * lifts the two small floating islets out of the land so they can bob,
  * builds the night "lights" layer (windows, lamps, the stair and the portal)
    from the night painting, to be added over any season's graded day,
  * draws the ink sketch the map shows while the scroll unrolls,
  * cuts the clouds, the wax seal and the ribbon from the prop sheet,
  * and prints the spots (water glints, islets) worldArt needs, in world units.

Usage:  python3 tools/team-quest-map/bake_painted.py <sources-dir>
Needs numpy, pillow and opencv-python-headless.
"""

import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'team-quest-map', 'painted')
SEASONS = ['autumn', 'winter', 'spring', 'summer']
WORLD_W, WORLD_H = 1600, 900
SIZES = [1600, 2560]


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def load(path):
    return np.array(Image.open(path).convert('RGB')).astype(np.float32)


def key_magenta(im):
    """Alpha from how magenta a pixel is, limited to regions joined to the sky."""
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    m = np.minimum(r, b) - g
    strong = m > 150
    sky = np.median(im[strong], axis=0)
    _, lab = cv2.connectedComponents((m > 60).astype(np.uint8), connectivity=8)
    labels = np.unique(lab[strong])
    region = np.isin(lab, labels[labels > 0])
    region = cv2.dilate(region.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
    a = np.where(region, 1 - smooth(70, 165, m), 1.0)
    A = np.maximum(a, 0.02)[..., None]
    c = np.clip((im - (1 - A) * sky) / A, 0, 255)
    near = cv2.dilate(region.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool)
    over = np.clip(np.minimum(c[..., 0], c[..., 2]) - c[..., 1] - 25, 0, None) * near
    c[..., 0] -= over * 0.6
    c[..., 2] -= over * 0.6
    c[..., 1] += over * 0.3
    a[a < 0.02] = 0
    return np.clip(c, 0, 255), a


def key_green(im):
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    m = g - np.maximum(r, b)
    keycol = np.median(im[m > 150], axis=0)
    a = 1 - smooth(40, 140, m)
    A = np.maximum(a, 0.02)[..., None]
    c = np.clip((im - (1 - A) * keycol) / A, 0, 255)
    spill = np.clip(c[..., 1] - np.maximum(c[..., 0], c[..., 2]), 0, None)
    c[..., 1] -= spill
    a[a < 0.03] = 0
    return c, a


def rgba(c, a):
    return Image.fromarray(np.dstack([c, a * 255]).astype(np.uint8), 'RGBA')


def save_webp(img, name, quality=82, **kw):
    path = os.path.join(OUT, name)
    img.save(path, 'WEBP', quality=quality, method=6, **kw)
    return os.path.getsize(path)


def islets(alpha):
    """The small floating islets: alpha blobs in the sky that do not touch the land."""
    h, w = alpha.shape
    solid = (alpha > 0.5).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(solid, connectivity=8)
    found = []
    for i in range(1, n):
        x, y, bw, bh, area = stats[i]
        if area < 200 or area > 0.01 * w * h:
            continue
        if x < w * 0.7 or y > h * 0.5:
            continue
        found.append((x, y, bw, bh, i))
    return found, lab


def main(src):
    os.makedirs(OUT, exist_ok=True)
    report = {'files': {}, 'islets': [], 'water': []}
    scale_x = WORLD_W / 2752
    scale_y = WORLD_H / 1536

    # Islets are found on the autumn day painting and cut at the same boxes in every season.
    autumn = load(os.path.join(src, 'day-autumn.png'))
    _, autumn_alpha = key_magenta(autumn)
    boxes, labels = islets(autumn_alpha)
    pad = 10
    for k, (x, y, bw, bh, label) in enumerate(boxes):
        report['islets'].append({
            'id': k,
            'x': round((x - pad) * scale_x, 1), 'y': round((y - pad) * scale_y, 1),
            'w': round((bw + pad * 2) * scale_x, 1), 'h': round((bh + pad * 2) * scale_y, 1)
        })

    for season in SEASONS:
        c, a = key_magenta(load(os.path.join(src, f'day-{season}.png')))
        for k, (x, y, bw, bh, label) in enumerate(boxes):
            x0, y0, x1, y1 = x - pad, y - pad, x + bw + pad, y + bh + pad
            piece = rgba(c[y0:y1, x0:x1], a[y0:y1, x0:x1])
            piece = piece.resize((round(piece.width * 0.75), round(piece.height * 0.75)), Image.LANCZOS)
            report['files'][f'islet-{season}-{k}.webp'] = save_webp(piece, f'islet-{season}-{k}.webp', 86)
            a[y0:y1, x0:x1] = 0
        land = rgba(c, a)
        for width in SIZES:
            img = land.resize((width, round(width * 9 / 16)), Image.LANCZOS)
            report['files'][f'land-{season}-{width}.webp'] = save_webp(img, f'land-{season}-{width}.webp', 80)

    # Night lights: the warm windows and lamps, and the cool magic of the stair
    # and the portal, lifted from the night painting where they outshine their
    # surroundings. Added ('lighter') over any season's graded day.
    nc, na = key_magenta(load(os.path.join(src, 'night-autumn.png')))
    lum = (nc * [0.2126, 0.7152, 0.0722]).sum(-1)
    warm = smooth(10, 60, nc[..., 0] - nc[..., 2]) * smooth(90, 170, lum)
    cool = smooth(170, 230, lum) * smooth(25, 70, nc[..., 2] - nc[..., 0])
    emit = np.maximum(warm, cool)
    emit *= smooth(5, 40, lum - cv2.GaussianBlur(lum, (0, 0), 12) * 0.8)
    emit = cv2.GaussianBlur(emit, (0, 0), 1.2)
    lit = nc * emit[..., None]
    lights = np.clip(lit + cv2.GaussianBlur(lit, (0, 0), 9) * 0.9, 0, 255) * na[..., None]
    lights_img = Image.fromarray(lights.astype(np.uint8), 'RGB').resize((1600, 900), Image.LANCZOS)
    report['files']['lights-1600.webp'] = save_webp(lights_img, 'lights-1600.webp', 78)

    # Ink sketch on parchment for the unrolling scroll.
    ac, aa = key_magenta(autumn)
    small = cv2.resize(ac, (1600, 900), interpolation=cv2.INTER_AREA)
    alpha_small = cv2.resize(aa, (1600, 900), interpolation=cv2.INTER_AREA)
    gray = (small * [0.299, 0.587, 0.114]).sum(-1)
    dog = cv2.GaussianBlur(gray, (0, 0), 0.9) - cv2.GaussianBlur(gray, (0, 0), 2.6)
    ink = smooth(4, 22, -dog)
    wash = smooth(40, 230, 255 - gray) * 0.42
    shade = np.maximum(ink, wash)
    ink_rgb = np.array([74, 46, 20], np.float32)
    sketch_a = np.clip(shade * alpha_small, 0, 1)
    sketch = rgba(np.broadcast_to(ink_rgb, small.shape), sketch_a).resize((1280, 720), Image.LANCZOS)
    report['files']['sketch-1280.webp'] = save_webp(sketch, 'sketch-1280.webp', 60, alpha_quality=45)

    # Water glints: bright blue water below the skyline, spread out.
    water = (small[..., 2] > small[..., 0] + 40) & (small[..., 2] > 150) & (alpha_small > 0.99)
    water[:480] = False
    water[:560, 1270:] = False
    ys, xs = np.nonzero(water)
    rng = np.random.default_rng(7)
    picks = []
    for i in rng.permutation(len(xs)):
        x, y = int(xs[i]), int(ys[i])
        if all((x - px) ** 2 + (y - py) ** 2 > 48 ** 2 for px, py in picks):
            picks.append((x, y))
        if len(picks) >= 22:
            break
    report['water'] = sorted(picks)

    # Props: four clouds, the wax seal, the ribbon.
    pc, pa = key_green(load(os.path.join(src, 'props.png')))
    sx = 2752 / 1600
    props = {
        'cloud-0': (30, 180, 480, 385), 'cloud-1': (520, 100, 865, 420),
        'cloud-2': (925, 175, 1275, 400), 'cloud-3': (1330, 230, 1545, 370),
        'seal': (65, 520, 385, 835), 'ribbon': (445, 612, 1265, 742)
    }
    widths = {'cloud-0': 520, 'cloud-1': 400, 'cloud-2': 400, 'cloud-3': 260, 'seal': 220, 'ribbon': 900}
    for name, (x0, y0, x1, y1) in props.items():
        box = [round(v * sx) for v in (x0, y0, x1, y1)]
        piece = rgba(pc[box[1]:box[3], box[0]:box[2]], pa[box[1]:box[3], box[0]:box[2]])
        bbox = piece.getbbox()
        if bbox:
            piece = piece.crop(bbox)
        w = widths[name]
        piece = piece.resize((w, round(piece.height * w / piece.width)), Image.LANCZOS)
        report['files'][f'{name}.webp'] = save_webp(piece, f'{name}.webp', 84)

    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])
