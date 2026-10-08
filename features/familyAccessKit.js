// features/familyAccessKit.js — everything a family login is handed over with:
// a suggested username, an easy-to-read password, the Parent sign-in QR code,
// and printable pages (one family's slip, or the school's QR poster).
// Shared by the Secretary's Family Logins desk and the teacher's access card.
// The QR is drawn in the browser (qrcode-generator, MIT); no outside service is called.

import { DEFAULT_SCHOOL_ID, getSchoolId, normalizeSchoolId } from '../utils/tenant.mjs';

const LOGO_URL = new URL('../assets/great-class-quest-logo.svg', import.meta.url).href;

// ── Usernames ───────────────────────────────────────────────────────────────

const GREEK_TO_LATIN = [
    ['ου', 'ou'], ['ού', 'ou'], ['αι', 'ai'], ['ει', 'ei'], ['οι', 'oi'], ['μπ', 'b'], ['ντ', 'd'], ['γκ', 'g'], ['γγ', 'ng'],
    ['θ', 'th'], ['χ', 'ch'], ['ψ', 'ps'], ['ξ', 'x'],
    ['α', 'a'], ['β', 'v'], ['γ', 'g'], ['δ', 'd'], ['ε', 'e'], ['ζ', 'z'], ['η', 'i'], ['ι', 'i'], ['κ', 'k'], ['λ', 'l'],
    ['μ', 'm'], ['ν', 'n'], ['ο', 'o'], ['π', 'p'], ['ρ', 'r'], ['σ', 's'], ['ς', 's'], ['τ', 't'], ['υ', 'y'], ['φ', 'f'], ['ω', 'o']
];

/** Latin letters for a (possibly Greek) name: "Μαρία Παπαδοπούλου" → "maria papadopoulou". */
export function latinizeName(value) {
    let text = String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    GREEK_TO_LATIN.forEach(([greek, latin]) => { text = text.split(greek).join(latin); });
    return text.replace(/[^a-z0-9\s.-]/g, '').replace(/\s+/g, ' ').trim();
}

export function normalizeFamilyUsername(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, '')
        .replace(/^\.+|\.+$/g, '');
}

/** A short username from the student's name that no other family is using: "maria.p", then "maria.pa", "maria.p2"… */
export function suggestFamilyUsername(studentName, takenUsernames = []) {
    const taken = new Set([...takenUsernames].map((item) => String(item || '').toLowerCase()));
    const parts = latinizeName(studentName).split(' ').filter(Boolean);
    const first = normalizeFamilyUsername(parts[0] || 'family') || 'family';
    const last = normalizeFamilyUsername(parts.slice(1).join('')) || '';
    const candidates = [];
    if (last) {
        candidates.push(`${first}.${last.slice(0, 1)}`, `${first}.${last.slice(0, 2)}`, `${first}.${last.slice(0, 3)}`, `${first}.${last}`);
    } else {
        candidates.push(first, `${first}.family`);
    }
    const free = candidates.find((candidate) => candidate.length >= 3 && !taken.has(candidate));
    if (free) return free;
    const base = candidates[0].length >= 3 ? candidates[0] : `${candidates[0]}.family`;
    for (let n = 2; n < 100; n += 1) {
        if (!taken.has(`${base}${n}`)) return `${base}${n}`;
    }
    return `${base}${Date.now() % 1000}`;
}

// ── Passwords ───────────────────────────────────────────────────────────────

// Short, friendly English words with no look-alike letters, so a family can type them from paper.
const PASSWORD_WORDS_A = ['brave', 'sunny', 'happy', 'swift', 'lucky', 'merry', 'bold', 'calm', 'bright', 'jolly', 'noble', 'quick', 'kind', 'proud', 'warm', 'wise'];
const PASSWORD_WORDS_B = ['otter', 'falcon', 'tiger', 'panda', 'comet', 'maple', 'river', 'rocket', 'dragon', 'dolphin', 'meadow', 'harbor', 'castle', 'garden', 'planet', 'forest'];

function randomIndex(max) {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi?.getRandomValues) {
        const buffer = new Uint32Array(1);
        cryptoApi.getRandomValues(buffer);
        return buffer[0] % max;
    }
    return Math.floor(Math.random() * max);
}

/** "sunny-otter-47": easy to read aloud, type on a phone and copy from a slip. */
export function generateFamilyPassword() {
    const a = PASSWORD_WORDS_A[randomIndex(PASSWORD_WORDS_A.length)];
    const b = PASSWORD_WORDS_B[randomIndex(PASSWORD_WORDS_B.length)];
    const n = String(randomIndex(90) + 10);
    return `${a}-${b}-${n}`;
}

// ── Links & QR ──────────────────────────────────────────────────────────────

/** The address that opens the sign-in screen straight on the Parent door. Other schools' links
 *  carry their school code, so a family's new phone opens their school's gate, not the founding one. */
export function getParentLoginUrl(baseHref = globalThis.location?.href || '', schoolId = getSchoolId()) {
    const school = normalizeSchoolId(schoolId);
    const query = school && school !== DEFAULT_SCHOOL_ID ? `?school=${school}&login=parent` : '?login=parent';
    try {
        const url = new URL(baseHref);
        url.hash = '';
        url.pathname = url.pathname.replace(/index\.html$/, '');
        url.search = query;
        return url.toString();
    } catch (_) {
        return query;
    }
}

let qrLibPromise = null;
function loadQrLib() {
    qrLibPromise ??= import('qrcode-generator').then((mod) => mod.default || mod.qrcode || mod);
    return qrLibPromise;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * The QR as an SVG string. High error correction leaves room for the star in the middle,
 * and the three corner eyes are drawn round so it feels like part of the app.
 */
export function buildQrSvg(qrcode, text, { color = '#1f2a44', accent = '#d97706', title = 'QR code', emblem = true } = {}) {
    const qr = qrcode(0, 'H');
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    const quiet = 4;
    const size = count + quiet * 2;
    const isEye = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= count - 7) || (r >= count - 7 && c < 7);
    const emblemSize = emblem ? Math.max(5, Math.round(count * 0.2) | 1) : 0;
    const emblemStart = Math.floor((count - emblemSize) / 2);
    const inEmblem = (r, c) => emblem && r >= emblemStart - 1 && r < emblemStart + emblemSize + 1 && c >= emblemStart - 1 && c < emblemStart + emblemSize + 1;
    let modules = '';
    for (let r = 0; r < count; r += 1) {
        for (let c = 0; c < count; c += 1) {
            if (!qr.isDark(r, c) || isEye(r, c) || inEmblem(r, c)) continue;
            modules += `M${c + quiet} ${r + quiet}h1v1h-1z`;
        }
    }
    const eye = (x, y) => `
        <rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="1.8" fill="none" stroke="${color}" stroke-width="1"/>
        <rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.9" fill="${accent}"/>`;
    const centre = quiet + emblemStart + emblemSize / 2;
    const star = emblem ? `
        <rect x="${quiet + emblemStart - 0.5}" y="${quiet + emblemStart - 0.5}" width="${emblemSize + 1}" height="${emblemSize + 1}" rx="${(emblemSize + 1) / 3.2}" fill="#ffffff"/>
        <rect x="${quiet + emblemStart + 0.3}" y="${quiet + emblemStart + 0.3}" width="${emblemSize - 0.6}" height="${emblemSize - 0.6}" rx="${emblemSize / 3.4}" fill="${accent}"/>
        <path transform="translate(${centre} ${centre}) scale(${emblemSize / 24})" d="M0 -8.5 L2.5 -2.9 L8.6 -2.6 L3.9 1.3 L5.4 7.2 L0 4 L-5.4 7.2 L-3.9 1.3 L-8.6 -2.6 L-2.5 -2.9 Z" fill="#ffffff"/>` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="${escapeHtml(title)}">
        <title>${escapeHtml(title)}</title>
        <rect width="${size}" height="${size}" fill="#ffffff"/>
        <path d="${modules}" fill="${color}"/>
        <g shape-rendering="geometricPrecision">
            ${eye(quiet, quiet)}${eye(quiet + count - 7, quiet)}${eye(quiet, quiet + count - 7)}
            ${star}
        </g>
    </svg>`;
}

export async function renderQrSvg(text, options = {}) {
    const qrcode = await loadQrLib();
    return buildQrSvg(qrcode, text, options);
}

// ── Printable pages ─────────────────────────────────────────────────────────

const PRINT_FONT = '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Fredoka+One&family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet">';

const PRINT_BASE_CSS = `
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #ffffff; color: #1f2a44; font-family: 'Open Sans', system-ui, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h1, h2, .display { font-family: 'Fredoka One', 'Fredoka', system-ui, sans-serif; font-weight: 400; }
    .qr svg { display: block; width: 100%; height: auto; }
`;

const POSTER_COPY = {
    en: {
        title: 'Family sign-in QR',
        heading: 'Follow your child’s <span>quest</span><br>from home',
        lede: 'Homework, stars, progress and notes from school, all in The Great Class Quest family app.',
        scan: 'Scan to sign in',
        steps: [
            'Open your phone’s camera and point it at the code.',
            'Tap the link. The Parent sign-in opens by itself.',
            'Type the username and password the school gave you.'
        ],
        foot: 'No login yet? Ask your child’s teacher or the school office.'
    },
    el: {
        title: 'QR σύνδεσης γονέων',
        heading: 'Ακολουθήστε την <span>περιπέτεια</span><br>του παιδιού σας από το σπίτι',
        lede: 'Εργασίες, αστέρια, πρόοδος και σημειώσεις από το σχολείο, όλα στην εφαρμογή οικογένειας του The Great Class Quest.',
        scan: 'Σκανάρετε για σύνδεση',
        steps: [
            'Ανοίξτε την κάμερα του κινητού σας και στρέψτε τη στον κωδικό.',
            'Πατήστε τον σύνδεσμο. Η σύνδεση γονέα ανοίγει αυτόματα.',
            'Πληκτρολογήστε το όνομα χρήστη και τον κωδικό που σας έδωσε το σχολείο.'
        ],
        foot: 'Δεν έχετε ακόμη λογαριασμό; Ρωτήστε τον εκπαιδευτικό του παιδιού σας ή τη γραμματεία.'
    }
};

// Fredoka has no Greek letters, so the Greek poster uses Comfortaa, a rounded face that does.
const GREEK_FONT = '<link href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&display=swap" rel="stylesheet">';

/** The school's QR poster (A4), for the notice board, the front door or a letter home. lang: 'en' or 'el'. */
export function buildFamilyPosterHtml({ schoolName = '', qrSvg = '', url = '', logoUrl = LOGO_URL, lang = 'en' } = {}) {
    const school = escapeHtml(schoolName || 'The Great Class Quest');
    const greek = lang === 'el';
    const copy = POSTER_COPY[greek ? 'el' : 'en'];
    return `<!doctype html><html lang="${greek ? 'el' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${copy.title} · ${school}</title>${PRINT_FONT}${greek ? GREEK_FONT : ''}
<style>
    ${PRINT_BASE_CSS}
    @page { size: A4 portrait; margin: 0; }
    .poster { position: relative; width: 210mm; height: 297mm; overflow: hidden; padding: 16mm 16mm 12mm; display: flex; flex-direction: column; align-items: center; text-align: center;
        background: radial-gradient(120% 55% at 50% 0%, #fff7e6 0%, #fffdf8 55%, #ffffff 100%); }
    .poster::before { content: ''; position: absolute; left: -10%; right: -10%; bottom: -12mm; height: 70mm; border-radius: 50% 50% 0 0 / 60% 60% 0 0; background: linear-gradient(180deg, #bfe9cf 0%, #8fd3a8 100%); z-index: 0; }
    .poster::after { content: ''; position: absolute; left: 30%; right: -20%; bottom: -20mm; height: 55mm; border-radius: 50% 50% 0 0 / 70% 70% 0 0; background: linear-gradient(180deg, #7cc896 0%, #5bb57c 100%); z-index: 0; }
    .poster > * { position: relative; z-index: 1; }
    .crest { width: 22mm; height: 22mm; }
    .school { margin: 3mm 0 0; font-size: 11pt; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: #b45309; }
    h1 { margin: 3mm 0 0; font-size: 34pt; line-height: 1.05; color: #1f2a44; }
    h1 span { color: #d97706; }
    .lede { margin: 4mm auto 0; max-width: 150mm; font-size: 13pt; line-height: 1.45; color: #475569; }
    .gate { margin: 8mm auto 0; width: 104mm; padding: 16mm 10mm 8mm; border-radius: 60mm 60mm 8mm 8mm / 26mm 26mm 8mm 8mm; background: #ffffff;
        box-shadow: 0 0 0 3mm #fde7c2, 0 0 0 3.6mm #f5b94a, 0 12mm 24mm -12mm rgba(31, 42, 68, 0.35); position: relative; }
    .keystone { position: absolute; top: -6mm; left: 50%; transform: translateX(-50%); width: 18mm; height: 13mm; background: linear-gradient(160deg, #fbbf24, #d97706); clip-path: polygon(0 0, 100% 0, 84% 100%, 16% 100%);
        color: #ffffff; font-family: 'Fredoka One', system-ui; font-size: 12pt; display: grid; place-items: center; padding-bottom: 1mm; }
    .qr { width: 78mm; margin: 0 auto; }
    .scan { margin: 5mm 0 0; font-size: 17pt; color: #92400e; }
    .url { margin: 2mm 0 0; font-size: 9pt; color: #64748b; overflow-wrap: anywhere; }
    .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5mm; width: 100%; max-width: 178mm; margin: 10mm auto 0; padding: 0; list-style: none; }
    .steps li { background: rgba(255, 255, 255, 0.92); border-radius: 5mm; padding: 5mm 4mm; font-size: 10.5pt; line-height: 1.4; color: #334155; box-shadow: 0 2mm 5mm -3mm rgba(31, 42, 68, 0.3); }
    .steps b { display: grid; place-items: center; width: 9mm; height: 9mm; margin: 0 auto 2mm; border-radius: 3mm; background: #d97706; color: #ffffff; font-family: 'Fredoka One', system-ui; font-weight: 400; font-size: 13pt; }
    .foot { margin-top: auto; font-size: 9pt; color: #1f5132; font-weight: 600; }
    .poster:lang(el) h1, .poster:lang(el) .display, .poster:lang(el) .steps b { font-family: 'Comfortaa', 'Open Sans', system-ui, sans-serif; font-weight: 700; }
    .poster:lang(el) h1 { font-size: 28pt; line-height: 1.12; }
    .poster:lang(el) .scan { font-size: 15pt; }
    .poster:lang(el) .steps li { font-size: 10pt; }
    @media screen { body { background: #e2e8f0; padding: 8mm 0; } .poster { margin: 0 auto; box-shadow: 0 10px 40px rgba(0,0,0,.15); } }
</style></head><body>
<main class="poster">
    <img class="crest" src="${escapeHtml(logoUrl)}" alt="">
    <p class="school">${school}</p>
    <h1>${copy.heading}</h1>
    <p class="lede">${copy.lede}</p>
    <div class="gate">
        <div class="keystone">★</div>
        <div class="qr">${qrSvg}</div>
        <p class="scan display">${copy.scan}</p>
        ${url ? `<p class="url">${escapeHtml(url)}</p>` : ''}
    </div>
    <ol class="steps">
        ${copy.steps.map((step, i) => `<li><b>${i + 1}</b>${step}</li>`).join('\n        ')}
    </ol>
    <p class="foot">${copy.foot}</p>
</main>
</body></html>`;
}

/**
 * Family login slips, two to an A4 page with a cut line between them.
 * slips: [{ studentName, className, username, password }]
 */
export function buildFamilySlipsHtml({ schoolName = '', slips = [], qrSvg = '', url = '', logoUrl = LOGO_URL } = {}) {
    const slip = (item) => `
    <section class="slip">
        <header>
            <img class="crest" src="${escapeHtml(logoUrl)}" alt="">
            <div>
                <p class="school">${escapeHtml(schoolName || 'The Great Class Quest')}</p>
                <h1>Family login for ${escapeHtml(item.studentName || 'your child')}</h1>
                ${item.className ? `<p class="class">${escapeHtml(item.className)}</p>` : ''}
            </div>
            <span class="copy">Private</span>
        </header>
        <div class="body">
            <div class="keys">
                <div class="key"><span>Username</span><strong>${escapeHtml(item.username)}</strong></div>
                <div class="key"><span>Password</span><strong>${escapeHtml(item.password)}</strong></div>
                <ol>
                    <li>Scan the code with your phone’s camera.</li>
                    <li>Type the username and password exactly as written.</li>
                    <li>Tip: add the page to your home screen to find it again.</li>
                </ol>
            </div>
            <div class="qr-wrap">
                <div class="qr">${qrSvg}</div>
                <p>Scan to sign in</p>
            </div>
        </div>
        <p class="private"><strong>Keep this slip private.</strong> ${url ? `Or type: ${escapeHtml(url)}` : ''}</p>
    </section>`;
    const pages = [];
    for (let i = 0; i < slips.length; i += 2) {
        const pair = slips.slice(i, i + 2);
        pages.push(`<div class="page">${pair.map(slip).join('<div class="cut">✂ cut here</div>')}</div>`);
    }
    const title = slips.length === 1 ? `Family login · ${escapeHtml(slips[0].studentName)}` : `Family logins · ${slips.length} slips`;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>${PRINT_FONT}
<style>
    ${PRINT_BASE_CSS}
    @page { size: A4 portrait; margin: 10mm; }
    .page { width: 190mm; margin: 0 auto; break-after: page; }
    .page:last-child { break-after: auto; }
    .slip { position: relative; height: 132mm; padding: 9mm 10mm 7mm; border: 0.6mm solid #f5b94a; border-radius: 6mm; background: linear-gradient(180deg, #fffaf0 0%, #ffffff 40%); display: flex; flex-direction: column; break-inside: avoid; }
    .cut { height: 12mm; display: flex; align-items: center; gap: 3mm; color: #94a3b8; font-size: 8pt; }
    .cut::before, .cut::after { content: ''; flex: 1; border-top: 0.4mm dashed #cbd5e1; }
    header { display: flex; align-items: center; gap: 5mm; }
    .crest { width: 16mm; height: 16mm; flex: 0 0 auto; }
    .school { margin: 0; font-size: 8.5pt; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #b45309; }
    h1 { margin: 1mm 0 0; font-size: 19pt; line-height: 1.1; }
    .class { margin: 1mm 0 0; font-size: 10pt; color: #64748b; }
    .copy { margin-left: auto; align-self: flex-start; padding: 1mm 3mm; border-radius: 99px; background: #ffe4e6; color: #9f1239; font-size: 8pt; font-weight: 700; }
    .body { display: flex; gap: 8mm; align-items: center; margin-top: 6mm; flex: 1; }
    .keys { flex: 1; }
    .key { display: flex; flex-direction: column; margin-bottom: 3.5mm; padding: 3mm 4mm; border-radius: 3.5mm; background: #ffffff; border: 0.4mm solid #e2e8f0; }
    .key span { font-size: 8pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #94a3b8; }
    .key strong { margin-top: 0.8mm; font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace; font-size: 17pt; color: #1f2a44; letter-spacing: 0.02em; }
    ol { margin: 4mm 0 0; padding-left: 5mm; font-size: 9.5pt; line-height: 1.5; color: #475569; }
    .qr-wrap { width: 52mm; text-align: center; }
    .qr { padding: 2.5mm; border-radius: 4mm; background: #ffffff; box-shadow: 0 0 0 0.6mm #f5b94a; }
    .qr-wrap p { margin: 2.5mm 0 0; font-family: 'Fredoka One', system-ui; font-size: 12pt; color: #92400e; }
    .private { margin: 4mm 0 0; font-size: 8.5pt; color: #64748b; overflow-wrap: anywhere; }
    .private strong { color: #9f1239; }
    @media screen { body { background: #e2e8f0; padding: 8mm 0; } .page { background: #ffffff; padding: 10mm; width: 210mm; margin-bottom: 8mm; } }
</style></head><body>
${pages.join('\n')}
</body></html>`;
}

/** Prints a page through a hidden frame, so no pop-up blocker gets in the way. */
export function printHtml(html) {
    return new Promise((resolve) => {
        const frame = document.createElement('iframe');
        frame.setAttribute('aria-hidden', 'true');
        frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';
        document.body.appendChild(frame);
        const doc = frame.contentDocument;
        doc.open();
        doc.write(html);
        doc.close();
        const go = async () => {
            try {
                await Promise.race([doc.fonts?.ready, new Promise((r) => setTimeout(r, 1500))]);
                await Promise.all([...doc.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))));
                frame.contentWindow.focus();
                frame.contentWindow.print();
            } finally {
                setTimeout(() => { frame.remove(); resolve(); }, 1000);
            }
        };
        if (doc.readyState === 'complete') void go();
        else frame.addEventListener('load', () => void go(), { once: true });
    });
}

export async function printFamilyPoster({ schoolName, lang = 'en' } = {}) {
    const url = getParentLoginUrl();
    const qrSvg = await renderQrSvg(url, { title: 'Family sign-in QR code' });
    await printHtml(buildFamilyPosterHtml({ schoolName, qrSvg, url, lang }));
}

/** Prints one or many family slips: slips = [{ studentName, className, username, password }]. */
export async function printFamilySlips({ schoolName, slips = [] } = {}) {
    if (!slips.length) return;
    const url = getParentLoginUrl();
    const qrSvg = await renderQrSvg(url, { title: 'Family sign-in QR code' });
    await printHtml(buildFamilySlipsHtml({ schoolName, slips, qrSvg, url }));
}

export async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (_) {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(area);
        area.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (__) { ok = false; }
        area.remove();
        return ok;
    }
}
