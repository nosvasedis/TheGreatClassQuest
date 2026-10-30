// tools/ceremony-music/render.cjs — renders the Grand Guild Ceremony music offline.
// Usage: node tools/ceremony-music/render.cjs [festival story suspense crowning hall]
// Needs Playwright's Chromium (or CHROMIUM_PATH=/path/to/chrome) and ffmpeg. Writes assets/ceremony/music/grand-*.mp3.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync, spawnSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'assets/ceremony/music');
const TARGET_MEAN_DB = -19;

function wav({ sampleRate, channels }) {
    const frames = channels[0].length;
    const buf = Buffer.alloc(44 + frames * 4);
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + frames * 4, 4); buf.write('WAVE', 8);
    buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
    buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
    buf.write('data', 36); buf.writeUInt32LE(frames * 4, 40);
    for (let i = 0; i < frames; i += 1) {
        for (let c = 0; c < 2; c += 1) {
            const v = Math.max(-1, Math.min(1, channels[c][i]));
            buf.writeInt16LE(Math.round(v * 32767), 44 + i * 4 + c * 2);
        }
    }
    return buf;
}

function meanDb(file) {
    // volumedetect reports on stderr.
    return spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
}

async function main() {
    const keys = process.argv.slice(2);
    const server = http.createServer((req, res) => {
        const url = decodeURIComponent(req.url.split('?')[0]);
        if (url === '/') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><title>render</title>'); return; }
        const file = path.join(ROOT, url);
        if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.statusCode = 404; res.end(); return; }
        res.setHeader('content-type', file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
        fs.createReadStream(file).pipe(res);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const page = await browser.newPage();
    page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
    page.on('pageerror', (e) => console.error('[page]', e.message));
    await page.goto(`${base}/`);
    await page.addScriptTag({ url: `${base}/node_modules/tone/build/Tone.js` });
    const all = await page.evaluate(async (src) => Object.keys((await import(src)).GRAND_SCORE), `${base}/tools/ceremony-music/grandCeremonyScore.js`);
    const todo = keys.length ? keys : all;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'grand-music-'));
    for (const key of todo) {
        const started = Date.now();
        const result = await page.evaluate(async ({ src, key }) => {
            const mod = await import(src);
            const { sampleRate, channels } = await mod.renderGrandTrack(key);
            return { sampleRate, file: mod.GRAND_SCORE[key].file, channels: channels.map((c) => Array.from(c)) };
        }, { src: `${base}/tools/ceremony-music/grandCeremonyScore.js`, key });
        const raw = path.join(tmp, `${result.file}.wav`);
        fs.writeFileSync(raw, wav(result));
        const stats = meanDb(raw);
        const mean = Number((stats.match(/mean_volume: (-?[\d.]+) dB/) || [])[1]);
        const max = Number((stats.match(/max_volume: (-?[\d.]+) dB/) || [])[1]);
        const gain = Math.min(TARGET_MEAN_DB - mean, -1.5 - max);
        const mp3 = path.join(OUT, `${result.file}.mp3`);
        execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', raw, '-af', `volume=${gain.toFixed(2)}dB`,
            '-codec:a', 'libmp3lame', '-b:a', '96k', mp3]);
        const after = meanDb(mp3);
        console.log(`${key}: ${(result.channels[0].length / result.sampleRate).toFixed(1)}s, mean ${mean} → ${(after.match(/mean_volume: (-?[\d.]+)/) || [])[1]} dB, max ${(after.match(/max_volume: (-?[\d.]+)/) || [])[1]} dB, ${(fs.statSync(mp3).size / 1024).toFixed(0)} KiB, ${((Date.now() - started) / 1000).toFixed(1)}s`);
    }
    await browser.close();
    server.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
