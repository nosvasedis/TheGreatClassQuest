#!/usr/bin/env python3
"""
Redraws the ink sketch the scroll shows while it unrolls (sketch-1280.webp)
from the land as it is now, so the sketch matches the painted map: the autumn
land, the two floating islets at their spots and the windmill sails at their
resting angle, put together at world size (1600x900) and inked with the same
filter bake_painted.py uses.

Run after any edit to the land: python3 tools/team-quest-map/bake_sketch.py
Needs numpy, pillow and opencv-python-headless.
"""
import os

import cv2
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'team-quest-map', 'painted')
W, H = 1600, 900
# Kept in step with ISLET_BOXES and WINDMILLS in features/questWorld/worldArt.mjs.
ISLETS = [(1220.9, 155.3, 51.7, 81.4), (1475.6, 251.4, 58.1, 85.5)]
MILLS = [(313.1, 523.1, 115, 26.4, None), (144.4, 738.1, 115, 0, (0.729, 0.444, -0.424, 1.035))]


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def over(base, piece, M):
    """Draws an RGBA piece onto the RGBA float base through the 2x3 affine M."""
    warped = cv2.warpAffine(piece, M, (W, H), flags=cv2.INTER_AREA if M[0, 0] < 1 else cv2.INTER_LINEAR,
                            borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    a = warped[..., 3:4] / 255
    base[..., :3] = base[..., :3] * (1 - a) + warped[..., :3] * a
    base[..., 3:4] = np.maximum(base[..., 3:4], warped[..., 3:4])


def load(name):
    return np.asarray(Image.open(os.path.join(OUT, name)).convert('RGBA')).astype(np.float32)


def main():
    land = load('land-autumn-2560.webp')
    world = cv2.resize(land, (W, H), interpolation=cv2.INTER_AREA)
    for i, (x, y, w, h) in enumerate(ISLETS):
        piece = load(f'islet-autumn-{i}.webp')
        sx, sy = w / piece.shape[1], h / piece.shape[0]
        over(world, piece, np.float32([[sx, 0, x], [0, sy, y]]))
    sails = load('sails.webp')
    for x, y, size, rest, plane in MILLS:
        s = size / sails.shape[1]
        r = np.deg2rad(rest)
        rot = np.array([[np.cos(r), -np.sin(r)], [np.sin(r), np.cos(r)]]) * s
        lin = rot if plane is None else np.array([[plane[0], plane[2]], [plane[1], plane[3]]]) @ rot
        c = np.array([sails.shape[1] / 2, sails.shape[0] / 2])
        t = np.array([x, y]) - lin @ c
        over(world, sails, np.float32(np.hstack([lin, t[:, None]])))

    rgb, alpha = world[..., :3], world[..., 3] / 255
    gray = (rgb * [0.299, 0.587, 0.114]).sum(-1)
    dog = cv2.GaussianBlur(gray, (0, 0), 0.9) - cv2.GaussianBlur(gray, (0, 0), 2.6)
    ink = smooth(4, 22, -dog)
    wash = smooth(40, 230, 255 - gray) * 0.42
    shade = np.maximum(ink, wash)
    sketch_a = np.clip(shade * alpha, 0, 1)
    ink_rgb = np.broadcast_to(np.array([74, 46, 20], np.float32), rgb.shape)
    img = Image.fromarray(np.dstack([ink_rgb, sketch_a * 255]).astype(np.uint8), 'RGBA').resize((1280, 720), Image.LANCZOS)
    img.save(os.path.join(OUT, 'sketch-1280.webp'), 'WEBP', quality=60, method=6, alpha_quality=45)


if __name__ == '__main__':
    main()
