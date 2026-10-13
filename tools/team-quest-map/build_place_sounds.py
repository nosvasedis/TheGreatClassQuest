#!/usr/bin/env python3
"""Builds the short sound that greets each place on the Team Quest map.

Recordings are CC0 from BigSoundBank (Joseph Sardin, https://bigsoundbank.com),
fetched by id from https://bigsoundbank.com/UPLOAD/mp3/<id>.mp3 into a folder
of their own; the crystal shimmer and the Portal's swell are synthesised here.

  meadows   countryside birds (0097), a cow (2382), sheep (2345); a second take
            with a rooster (0440) and a goat (1380)
  peaks     whistling mountain wind (0147) and steps in the snow (3363)
  citadel   an outdoor market crowd (2728) with a far-off cheer (0019)
  crystal   dream chimes (2079, 2087) over a glassy shimmer
  portal    a deep swell, a rising whirl of air, a reversed chime that turns
            into dream chimes (2080, 0040) and a shining chord

Usage: build_place_sounds.py <folder with the <id>.mp3 files>
Needs numpy and ffmpeg. Writes assets/team-quest-map/sounds/<place>.mp3.
"""
import os
import subprocess
import sys

import numpy as np

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'assets', 'team-quest-map', 'sounds')
SRC = sys.argv[1] if len(sys.argv) > 1 else '.'
rng = np.random.default_rng(7)


def load(ident, start=0.0, length=None):
    cmd = ['ffmpeg', '-v', 'error', '-ss', str(start), '-i', os.path.join(SRC, f'{ident}.mp3')]
    if length:
        cmd += ['-t', str(length)]
    raw = subprocess.run(cmd + ['-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


def silence(seconds):
    return np.zeros((int(seconds * SR), 2), np.float32)


def place(bed, clip, at, gain_db=0.0, pan=0.0):
    i = int(at * SR)
    clip = clip[: max(0, len(bed) - i)] * (10 ** (gain_db / 20))
    left, right = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    clip = clip * np.array([left, right], np.float32) * np.sqrt(2)
    bed[i:i + len(clip)] += clip
    return bed


def fades(x, fin=0.35, fout=1.2):
    n = len(x)
    a, b = int(fin * SR), int(fout * SR)
    env = np.ones(n, np.float32)
    env[:a] = np.linspace(0, 1, a) ** 2
    env[n - b:] = np.linspace(1, 0, b) ** 1.6
    return x * env[:, None]


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)


def level(x, target=-24.0):
    """Every place speaks at the same loudness; peaks never pass -3 dB."""
    x = x * 10 ** ((target - rms_db(x)) / 20)
    peak = np.abs(x).max()
    return x * min(1.0, 0.7 / peak)


def reverb(x, seconds=1.6, wet=0.3):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        ir = rng.standard_normal(n).astype(np.float32) * np.exp(-t * 6.5 / seconds)
        ir /= np.sqrt(np.sum(ir ** 2))
        wetc = np.fft.irfft(np.fft.rfft(x[:, ch], len(x) + n) * np.fft.rfft(ir, len(x) + n))[: len(x)]
        out[:, ch] = x[:, ch] * (1 - wet) + wetc * wet
    return out


def tone(freqs, seconds, attack=0.02, decay=1.2, vibrato=0.0, gain=1.0):
    t = np.arange(int(seconds * SR)) / SR
    y = np.zeros_like(t)
    for k, f in enumerate(freqs):
        ph = 2 * np.pi * f * t + vibrato * np.sin(2 * np.pi * (4.6 + k * 0.3) * t)
        y += np.sin(ph) / len(freqs)
    env = np.minimum(1, t / attack) * np.exp(-t / decay)
    y = (y * env * gain).astype(np.float32)
    return np.stack([y, y], 1)


def lowpass(x, cutoff):
    spec = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    spec *= (1 / np.sqrt(1 + (f / cutoff) ** 4))[:, None]
    return np.fft.irfft(spec, len(x), axis=0).astype(np.float32)


def meadows(take):
    bed = load('0097', 4.0, 5.0) * 0.8
    if take == 1:
        place(bed, load('2382'), 0.35, -3, -0.35)
        place(bed, load('2345'), 2.55, -6, 0.45)
    else:
        place(bed, load('0440'), 0.4, -11, 0.5)
        place(bed, load('1380'), 2.1, -5, -0.4)
    return fades(bed[: int(4.6 * SR)], 0.4, 1.3)


def peaks():
    bed = load('0147', 46.0, 4.8)
    place(bed, load('3363', 3.0, 2.2), 1.1, -8, 0.2)
    return fades(bed, 0.6, 1.5)


def citadel():
    bed = load('2728', 16.0, 4.8)
    cheer = fades(load('0019', 2.0, 2.4), 0.6, 1.2)
    place(bed, cheer, 1.6, -12, 0.3)
    return fades(bed, 0.5, 1.4)


def shimmer(seconds, base=1046.5):
    """Glass partials: inharmonic, each ringing out at its own pace."""
    out = silence(seconds)
    for k, ratio in enumerate([1, 2.76, 5.4, 8.93]):
        for j, at in enumerate([0.0, 0.42, 0.9, 1.5]):
            f = base * ratio * [1, 1.189, 1.335, 1.498][j]
            hit = tone([f], seconds - at, attack=0.004, decay=0.9 / (1 + k * 0.6), gain=0.5 / (1 + k))
            place(out, hit, at, -6, [-0.6, 0.3, -0.2, 0.6][j])
    return out


def crystal():
    bed = shimmer(4.6)
    place(bed, load('2079'), 0.15, -2, -0.3)
    place(bed, load('2087'), 1.5, -6, 0.4)
    return fades(reverb(bed, 2.2, 0.38), 0.05, 1.4)


def portal():
    seconds = 5.6
    t = np.arange(int(seconds * SR)) / SR
    bed = silence(seconds)
    # A deep swell that breathes in.
    sub = np.sin(2 * np.pi * 55 * t + 0.6 * np.sin(2 * np.pi * 0.7 * t)) * np.sin(np.pi * np.minimum(1, t / 4.2)) ** 2
    bed += np.stack([sub, sub], 1).astype(np.float32) * 0.5
    # A whirl of air rising and circling the room.
    noise = rng.standard_normal((len(t), 2)).astype(np.float32)
    whirl = lowpass(noise, 1800) * (np.sin(np.pi * np.clip(t / 3.2, 0, 1)) ** 2)[:, None]
    pan = np.sin(2 * np.pi * 0.9 * t)
    whirl[:, 0] *= (1 - pan) / 2 + 0.3
    whirl[:, 1] *= (1 + pan) / 2 + 0.3
    bed += whirl * 0.35
    # A chime drawn backwards into the opening, then the chimes themselves.
    rev = load('2080')[::-1].copy()
    place(bed, rev, max(0.0, 2.3 - len(rev) / SR), -2)
    place(bed, load('0040', 0.0, 3.2), 2.3, -4)
    place(bed, load('2079'), 2.45, -5, 0.4)
    # A shining chord (A, E, A, C#, B) with a slow vibrato.
    place(bed, tone([220, 329.6, 440, 554.4, 659.3, 987.8], 3.4, attack=0.6, decay=1.6, vibrato=0.004, gain=0.9), 2.2, -6)
    return fades(reverb(bed, 2.6, 0.42), 0.3, 1.6)


def write(name, x):
    x = level(x)
    path = os.path.join(OUT, f'{name}.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-',
                    '-ac', '2', '-b:a', '96k', path], input=x.astype(np.float32).tobytes(), check=True)
    print(name, round(len(x) / SR, 2), 's', os.path.getsize(path) // 1024, 'KB')


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    write('meadows-1', meadows(1))
    write('meadows-2', meadows(2))
    write('peaks', peaks())
    write('citadel', citadel())
    write('crystal', crystal())
    write('portal', portal())
