#!/usr/bin/env python3
"""Frees the village windmills' sails from the painted land so they can turn.

For each season the two windmills were cut from land-<season>-2560.webp as
384 px squares (centred on WINDMILLS below, upscaled to 768) and an image
model repainted each square without the sails (prompt in README.md). This
script compares each repainted square with the original:

  * where they differ (the sails), the repainted pixels go into the land, at
    2560 and 1600, so the painting keeps no sails of its own;
  * one blade of the front autumn windmill (pixels that were brighter in the
    original) is cut out and repeated four times round a wooden hub as
    sails.webp, which worldArt turns in front of both windmills (the far one
    sees them at an angle, worldArt.mjs#WINDMILLS).

Usage: free_windmills.py <folder with <season>-<k>.png and e-<season>-<k>.png>
Needs numpy, pillow and opencv-python-headless. Run it once, after a bake.
"""
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get('PAINTED_OUT') or os.path.join(HERE, '..', '..', 'assets', 'team-quest-map', 'painted')
SEASONS = ['autumn', 'winter', 'spring', 'summer']
SIDE = 384  # each square, in 2560 px
# Square centres in the 2560 painting, and the front windmill's hub inside its square.
WINDMILLS = [(488, 816), (237, 1176)]
HUB = (205, 213)
SAIL_RADIUS = 92


def load(folder, name):
    img = Image.open(os.path.join(folder, name)).convert('RGB').resize((SIDE, SIDE), Image.LANCZOS)
    return np.asarray(img).astype(np.float32)


def difference(orig, edit):
    a = cv2.GaussianBlur(orig, (0, 0), 1.2)
    b = cv2.GaussianBlur(edit, (0, 0), 1.2)
    return np.abs(a - b).max(axis=2)


def biggest(mask, share=0.04):
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8))
    keep = np.zeros(mask.shape, np.uint8)
    if count > 1:
        top = stats[1:, cv2.CC_STAT_AREA].max()
        for k in range(1, count):
            if stats[k, cv2.CC_STAT_AREA] >= share * top:
                keep[labels == k] = 1
    return keep


def circle(radius):
    yy, xx = np.mgrid[0:SIDE, 0:SIDE]
    return ((xx - SIDE / 2) ** 2 + (yy - SIDE / 2) ** 2) <= radius ** 2


def paste_mask(diff):
    region = biggest((diff > 30) & circle(130), 0.02)
    region = cv2.dilate(region, np.ones((7, 7), np.uint8))
    return cv2.GaussianBlur(region.astype(np.float32), (0, 0), 2.2).clip(0, 1)


def sail_alpha(orig, edit, diff):
    brighter = orig.mean(axis=2) > edit.mean(axis=2) + 12
    sails = (diff > 38) & circle(120) & brighter
    sails = cv2.morphologyEx(sails.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    sails = biggest(sails)
    sails = cv2.dilate(sails, np.ones((2, 2), np.uint8))
    return cv2.GaussianBlur(sails.astype(np.float32), (0, 0), 0.7).clip(0, 1)


def build_sails(orig, alpha):
    """Four copies of the front windmill's upper-right blade round a hub (blade up at rest)."""
    r = SAIL_RADIUS
    hx, hy = HUB
    sp = np.dstack([orig, alpha * 255])[hy - r:hy + r, hx - r:hx + r]
    yy, xx = np.mgrid[0:2 * r, 0:2 * r]
    ang = np.degrees(np.arctan2(yy - r, xx - r))
    rad = np.hypot(xx - r, yy - r)
    sel = (sp[..., 3] > 60) & (ang > -95) & (ang < -30) & (rad > 12)
    weight = sp[..., 3][sel]
    axis = math.degrees(math.atan2((yy[sel] * weight).sum() / weight.sum() - r, (xx[sel] * weight).sum() / weight.sum() - r))
    keep = (np.abs((ang - axis + 180) % 360 - 180) < 26) & (rad > 10)
    blade = sp.copy()
    blade[..., 3] *= keep
    up = Image.fromarray(blade.clip(0, 255).astype(np.uint8), 'RGBA').rotate(axis + 90, resample=Image.BICUBIC, center=(r, r))
    reach = int(rad[sel].max())
    out = Image.new('RGBA', (2 * r, 2 * r), (0, 0, 0, 0))
    for k in range(4):
        layer = Image.new('RGBA', out.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        draw.rectangle([r - 2.2, r - reach + 2, r + 2.2, r], fill=(118, 78, 44, 255))  # the stock
        draw.line([r - 1, r - reach + 3, r - 1, r], fill=(168, 120, 72, 255), width=1)
        layer.alpha_composite(up)
        out.alpha_composite(layer.rotate(-90 * k, resample=Image.BICUBIC, center=(r, r)))
    draw = ImageDraw.Draw(out)
    draw.ellipse([r - 8, r - 8, r + 8, r + 8], fill=(96, 62, 34, 255))
    draw.ellipse([r - 6, r - 6, r + 6, r + 6], fill=(150, 104, 60, 255))
    draw.ellipse([r - 3, r - 4, r + 1, r], fill=(205, 160, 104, 255))
    draw.ellipse([r - 2, r - 2, r + 2, r + 2], outline=(80, 50, 28, 255))
    out.save(os.path.join(OUT, 'sails.webp'), 'WEBP', quality=90, method=6)
    print('sails: the painted blade pointed at', round(axis + 90, 1), 'degrees from upright')


def patch(land, box, edit, mask):
    x0, y0, x1, y1 = box
    region = land[y0:y1, x0:x1]
    w, h = x1 - x0, y1 - y0
    e = cv2.resize(edit, (w, h), interpolation=cv2.INTER_AREA)
    m = cv2.resize(mask, (w, h), interpolation=cv2.INTER_AREA)[..., None]
    region[..., :3] = region[..., :3] * (1 - m) + e * m


def main(folder):
    for season in SEASONS:
        big = np.asarray(Image.open(os.path.join(OUT, f'land-{season}-2560.webp')).convert('RGBA')).astype(np.float32).copy()
        small = np.asarray(Image.open(os.path.join(OUT, f'land-{season}-1600.webp')).convert('RGBA')).astype(np.float32).copy()
        for k, (cx, cy) in enumerate(WINDMILLS):
            orig = load(folder, f'{season}-{k}.png')
            edit = load(folder, f'e-{season}-{k}.png')
            diff = difference(orig, edit)
            mask = paste_mask(diff)
            x0, y0 = cx - SIDE // 2, cy - SIDE // 2
            patch(big, (x0, y0, x0 + SIDE, y0 + SIDE), edit, mask)
            s = 1600 / 2560
            patch(small, (round(x0 * s), round(y0 * s), round((x0 + SIDE) * s), round((y0 + SIDE) * s)), edit, mask)
            if k == 0 and season == 'autumn':
                build_sails(orig, sail_alpha(orig, edit, diff))
        Image.fromarray(big.clip(0, 255).astype(np.uint8), 'RGBA').save(
            os.path.join(OUT, f'land-{season}-2560.webp'), 'WEBP', quality=84, method=6)
        Image.fromarray(small.clip(0, 255).astype(np.uint8), 'RGBA').save(
            os.path.join(OUT, f'land-{season}-1600.webp'), 'WEBP', quality=84, method=6)
        print(season, 'done')


if __name__ == '__main__':
    main(sys.argv[1])
