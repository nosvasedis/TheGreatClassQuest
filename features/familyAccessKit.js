// features/familyAccessKit.js — everything a family login is handed over with:
// a suggested username, an easy-to-read password, the Parent sign-in QR code,
// and printable pages (one family's slip, or the school's QR poster).
// Shared by the Secretary's Family Logins desk and the teacher's access card.
// The QR is drawn in the browser (qrcode-generator, MIT); no outside service is called.

import { escapeHtml } from '../utils/html.mjs';
import { DEFAULT_SCHOOL_ID, getSchoolId, normalizeSchoolId } from '../utils/tenant.mjs';


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

/** The Parent sign-in address with the family's username already filled in, for a slip or a notebook card. */
export function getFamilyLoginUrl(username = '', baseHref, schoolId) {
    const url = getParentLoginUrl(baseHref, schoolId);
    const user = normalizeFamilyUsername(username);
    return user ? `${url}&u=${encodeURIComponent(user)}` : url;
}

let qrLibPromise = null;
function loadQrLib() {
    qrLibPromise ??= import('qrcode-generator').then((mod) => mod.default || mod.qrcode || mod);
    return qrLibPromise;
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
// The printable pages themselves live in familyPrintables.js and load only when something is printed.

function loadPrintables() {
    return import('./familyPrintables.js');
}

/** The school's QR poster (A4). lang: 'en' or 'el'. */
export async function printFamilyPoster(options = {}) {
    const kit = await loadPrintables();
    await kit.printFamilyPoster(options);
}

/** Prints one or many family slips: slips = [{ studentName, className, username, password }]. */
export async function printFamilySlips(options = {}) {
    if (!options.slips?.length) return;
    const kit = await loadPrintables();
    await kit.printFamilySlips(options);
}

/** One A4 sheet (or more) of every student's QR card in a class, with cut lines, to stick in notebooks.
 *  cards = [{ studentName, username }]; a student without a login still gets a card. */
export async function printClassQrSheet(options = {}) {
    if (!options.cards?.length) return;
    const kit = await loadPrintables();
    await kit.printClassQrSheet(options);
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
