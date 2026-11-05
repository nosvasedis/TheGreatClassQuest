// tools/anthem-video/estimate-word-times.mjs — first-pass word timings for the anthem music videos.
// Decodes each anthem with ffmpeg, finds vocal onsets and lines them up with the lyric words.
// Usage: node tools/anthem-video/estimate-word-times.mjs  (prints JSON for features/anthemVideo/anthemWordTimings.js)
// Fine-tune by ear afterwards with tools/anthem-video/tuner.html.
import { spawnSync } from 'node:child_process';
import { GUILDS, GUILD_IDS } from '../../features/guilds.js';
import { buildWordTimeline, splitWords } from '../../features/anthemVideo/anthemVideoCore.mjs';

const RATE = 16000;
const HOP = 160; // 10 ms
const WIN = 640; // 40 ms

function decode(file, filter) {
    const args = ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(RATE)];
    if (filter) args.push('-af', filter);
    args.push('-f', 'f32le', '-');
    const res = spawnSync('ffmpeg', args, { maxBuffer: 1 << 28 });
    if (res.status !== 0) throw new Error(`ffmpeg failed for ${file}: ${res.stderr}`);
    const buf = res.stdout;
    return new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
}

function onsetEnvelope(samples) {
    const frames = Math.floor((samples.length - WIN) / HOP);
    const energy = new Float32Array(frames);
    for (let f = 0; f < frames; f++) {
        let s = 0;
        const o = f * HOP;
        for (let i = 0; i < WIN; i++) s += samples[o + i] * samples[o + i];
        energy[f] = Math.log10(1e-6 + s / WIN);
    }
    const flux = new Float32Array(frames);
    for (let f = 2; f < frames; f++) flux[f] = Math.max(0, energy[f] - Math.max(energy[f - 1], energy[f - 2]));
    return flux;
}

function peaks(env, from, to, minGap = 12) {
    const out = [];
    const a = Math.max(1, Math.floor(from * 100));
    const b = Math.min(env.length - 2, Math.floor(to * 100));
    for (let f = a; f <= b; f++) {
        if (env[f] > 0.04 && env[f] >= env[f - 1] && env[f] > env[f + 1]) {
            const last = out[out.length - 1];
            if (last && f - last.f < minGap) { if (env[f] > last.s) { last.f = f; last.s = env[f]; } continue; }
            out.push({ f, s: env[f] });
        }
    }
    return out.map(p => ({ t: p.f / 100, s: p.s }));
}

/** Pick one onset per word, in order, close to the syllable estimate and strong. Words without a good onset keep the estimate. */
function align(estimates, cands) {
    const n = estimates.length;
    const m = cands.length;
    const maxS = Math.max(0.0001, ...cands.map(c => c.s));
    const skipCost = 0.22;
    const cost = (i, j) => Math.abs(cands[j].t - estimates[i]) * 1.6 - (cands[j].s / maxS) * 0.25;
    // dp[i][j]: best cost for first i words using candidates before j
    const INF = 1e9;
    const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(INF));
    const choice = Array.from({ length: n + 1 }, () => new Int32Array(m + 1).fill(-2));
    for (let j = 0; j <= m; j++) dp[0][j] = 0;
    for (let i = 1; i <= n; i++) {
        for (let j = 0; j <= m; j++) {
            // word i-1 uses the estimate
            let best = dp[i - 1][j] + skipCost; let pick = -1;
            // word i-1 uses candidate j-1
            if (j > 0) {
                if (dp[i][j - 1] < best) { best = dp[i][j - 1]; pick = -3; }
                const c = dp[i - 1][j - 1] + cost(i - 1, j - 1);
                if (Math.abs(cands[j - 1].t - estimates[i - 1]) < 0.6 && c < best) { best = c; pick = j - 1; }
            }
            dp[i][j] = best; choice[i][j] = pick;
        }
    }
    const out = new Array(n);
    let i = n; let j = m;
    while (i > 0) {
        const c = choice[i][j];
        if (c === -3) { j--; continue; }
        if (c === -1) { out[i - 1] = estimates[i - 1]; i--; continue; }
        out[i - 1] = cands[c].t; i--; j = c;
    }
    for (let k = 1; k < n; k++) if (out[k] <= out[k - 1] + 0.08) out[k] = Math.round((out[k - 1] + 0.1) * 100) / 100;
    return out.map(v => Math.round(v * 100) / 100);
}

/** Each lyric line is two 4/4 bars, so the line spacing gives the tempo; the beat comb refines it and finds the phase. */
function estimateTempo(env, lineStarts) {
    const spacing = (lineStarts[lineStarts.length - 1] - lineStarts[0]) / (lineStarts.length - 1);
    const bestLag = (spacing / 8) * 100;
    const score = (period) => {
        let s = 0; let bestOff = 0; let bestScore = -Infinity;
        for (let off = 0; off < period; off += 1) {
            s = 0;
            for (let t = off; t < env.length; t += period) s += env[Math.round(t)] || 0;
            if (s > bestScore) { bestScore = s; bestOff = off; }
        }
        return { score: bestScore, off: bestOff };
    };
    let bestP = bestLag; let bestRes = score(bestLag);
    for (let p = bestLag * 0.97; p <= bestLag * 1.03; p += 0.02) {
        const r = score(p);
        if (r.score > bestRes.score) { bestRes = r; bestP = p; }
    }
    return { bpm: Math.round((6000 / bestP) * 10) / 10, beatOffset: Math.round(bestRes.off) / 100 };
}

const out = {};
for (const id of GUILD_IDS) {
    const g = GUILDS[id];
    const file = g.anthem.replace(/^\.\//, '');
    const full = onsetEnvelope(decode(file));
    const vocal = onsetEnvelope(decode(file, 'highpass=f=350,lowpass=f=3200'));
    const tl = buildWordTimeline(g.anthemLyrics, {});
    const words = tl.lines.map(line => {
        const estimates = line.words.map(w => w.start);
        const cands = peaks(vocal, line.start - 0.3, line.end - 0.15);
        const aligned = align(estimates, cands);
        aligned[0] = Math.abs(aligned[0] - line.start) <= 0.3 ? aligned[0] : line.start;
        return aligned;
    });
    const tempo = estimateTempo(full, tl.lines.map(l => l.start));
    out[id] = { ...tempo, outroAt: Math.round(tl.end * 100) / 100, words };
    const check = tl.lines.map((l, i) => `${splitWords(l.text).map((w, k) => `${w}@${words[i][k]}`).join(' ')}`);
    console.error(`\n${id} bpm=${tempo.bpm} offset=${tempo.beatOffset}\n  ${check.join('\n  ')}`);
}
console.log(JSON.stringify(out, null, 1));
