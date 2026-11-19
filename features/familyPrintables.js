// features/familyPrintables.js — the pages a family login is printed on: the school's QR poster,
// the bilingual family slips (Greek first, smaller English beneath) and a class's sheet of
// notebook QR cards with cut lines. Loaded only when something is printed (see familyAccessKit.js).

import { escapeHtml } from '../utils/html.mjs';
import { getFamilyLoginUrl, getParentLoginUrl, renderQrSvg } from './familyAccessKit.js';

const LOGO_URL = new URL('../assets/great-class-quest-logo.svg', import.meta.url).href;

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

// Greek is what most families read first, so every slip line is Greek with the English beneath it, smaller.
const SLIP_COPY = {
    title: (name) => ({ el: `Σύνδεση οικογένειας για ${name}`, en: `Family login for ${name}` }),
    child: { el: 'το παιδί σας', en: 'your child' },
    badge: { el: 'Ιδιωτικό', en: 'Private' },
    username: { el: 'Όνομα χρήστη', en: 'Username' },
    password: { el: 'Κωδικός', en: 'Password' },
    steps: [
        { el: 'Ανοίξτε την κάμερα του κινητού σας και στρέψτε τη στον κωδικό QR.', en: 'Open your phone’s camera and point it at the QR code.' },
        { el: 'Πατήστε τον σύνδεσμο που εμφανίζεται. Η σελίδα γονέα ανοίγει μόνη της.', en: 'Tap the link that appears. The Parent page opens by itself.' },
        { el: 'Γράψτε τον κωδικό ακριβώς όπως είναι εδώ και πατήστε «Sign in».', en: 'Type the password exactly as written and tap “Sign in”.' }
    ],
    scan: { el: 'Σκανάρετε για σύνδεση', en: 'Scan to sign in' },
    keep: { el: 'Κρατήστε αυτό το χαρτί σε ασφαλές μέρος.', en: 'Keep this slip private.' },
    orType: { el: 'Ή γράψτε:', en: 'Or type:' }
};

const bi = (pair, tag = 'span') => `<${tag} class="bi"><span class="el" lang="el">${pair.el}</span><span class="en" lang="en">${pair.en}</span></${tag}>`;

/**
 * Family login slips, two to an A4 page with a cut line between them.
 * slips: [{ studentName, className, username, password, qrSvg? }]. Each slip's QR opens the Parent
 * door with its username already typed, so the family only types the password.
 */
export function buildFamilySlipsHtml({ schoolName = '', slips = [], qrSvg = '', url = '', logoUrl = LOGO_URL } = {}) {
    const slip = (item) => {
        const name = escapeHtml(item.studentName || '');
        const title = item.studentName ? SLIP_COPY.title(name) : SLIP_COPY.title(SLIP_COPY.child.el);
        if (!item.studentName) title.en = `Family login for ${SLIP_COPY.child.en}`;
        return `
    <section class="slip">
        <header>
            <img class="crest" src="${escapeHtml(logoUrl)}" alt="">
            <div class="head-copy">
                <p class="school">${escapeHtml(schoolName || 'The Great Class Quest')}</p>
                <h1 lang="el">${title.el}</h1>
                <p class="h1-en" lang="en">${title.en}</p>
                ${item.className ? `<p class="class">${escapeHtml(item.className)}</p>` : ''}
            </div>
            <span class="copy">${SLIP_COPY.badge.el} · <span lang="en">${SLIP_COPY.badge.en}</span></span>
        </header>
        <div class="body">
            <div class="keys">
                <div class="key">${bi(SLIP_COPY.username)}<strong>${escapeHtml(item.username)}</strong></div>
                <div class="key">${bi(SLIP_COPY.password)}<strong>${escapeHtml(item.password)}</strong></div>
                <ol>
                    ${SLIP_COPY.steps.map((step) => `<li>${bi(step)}</li>`).join('\n                    ')}
                </ol>
            </div>
            <div class="qr-wrap">
                <div class="qr">${item.qrSvg || qrSvg}</div>
                <p class="scan" lang="el">${SLIP_COPY.scan.el}</p>
                <p class="scan-en" lang="en">${SLIP_COPY.scan.en}</p>
            </div>
        </div>
        <p class="private"><strong lang="el">${SLIP_COPY.keep.el}</strong> <strong class="en" lang="en">${SLIP_COPY.keep.en}</strong>${url ? ` <span class="url">${SLIP_COPY.orType.el} / <span lang="en">${SLIP_COPY.orType.en}</span> ${escapeHtml(url)}</span>` : ''}</p>
    </section>`;
    };
    const pages = [];
    for (let i = 0; i < slips.length; i += 2) {
        const pair = slips.slice(i, i + 2);
        pages.push(`<div class="page">${pair.map(slip).join('<div class="cut">✂ κόψτε εδώ · cut here</div>')}</div>`);
    }
    const title = slips.length === 1 ? `Family login · ${escapeHtml(slips[0].studentName)}` : `Family logins · ${slips.length} slips`;
    return `<!doctype html><html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>${PRINT_FONT}${GREEK_FONT}
<style>
    ${PRINT_BASE_CSS}
    @page { size: A4 portrait; margin: 10mm; }
    .page { width: 190mm; margin: 0 auto; break-after: page; }
    .page:last-child { break-after: auto; }
    .slip { position: relative; height: 132mm; padding: 8mm 9mm 6mm; border: 0.6mm solid #f5b94a; border-radius: 6mm; background: linear-gradient(180deg, #fffaf0 0%, #ffffff 40%); display: flex; flex-direction: column; break-inside: avoid; overflow: hidden; }
    .cut { height: 12mm; display: flex; align-items: center; gap: 3mm; color: #94a3b8; font-size: 8pt; }
    .cut::before, .cut::after { content: ''; flex: 1; border-top: 0.4mm dashed #cbd5e1; }
    header { display: flex; align-items: center; gap: 5mm; }
    .crest { width: 15mm; height: 15mm; flex: 0 0 auto; }
    .head-copy { min-width: 0; }
    .school { margin: 0; font-size: 8pt; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #b45309; }
    h1 { margin: 1mm 0 0; font-family: 'Comfortaa', 'Open Sans', system-ui, sans-serif; font-weight: 700; font-size: 16pt; line-height: 1.15; }
    .h1-en { margin: 0.6mm 0 0; font-size: 9pt; font-weight: 600; color: #64748b; }
    .class { margin: 0.8mm 0 0; font-size: 9pt; color: #64748b; }
    .copy { margin-left: auto; align-self: flex-start; flex: 0 0 auto; padding: 1mm 3mm; border-radius: 99px; background: #ffe4e6; color: #9f1239; font-size: 7.5pt; font-weight: 700; }
    .copy span { font-weight: 600; opacity: 0.8; }
    .body { display: flex; gap: 7mm; align-items: center; margin-top: 4mm; flex: 1; min-height: 0; }
    .keys { flex: 1; min-width: 0; }
    .bi { display: flex; flex-direction: column; }
    .bi .en { font-size: 0.8em; color: #94a3b8; font-weight: 400; }
    .key { display: flex; flex-direction: column; margin-bottom: 2mm; padding: 1.8mm 4mm; border-radius: 3.5mm; background: #ffffff; border: 0.4mm solid #e2e8f0; }
    .key .bi { flex-direction: row; align-items: baseline; gap: 2mm; }
    .key .bi .el { font-size: 9pt; font-weight: 700; color: #475569; }
    .key .bi .en { font-size: 7pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    .key strong { margin-top: 0.5mm; font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace; font-size: 16pt; color: #1f2a44; letter-spacing: 0.02em; overflow-wrap: anywhere; }
    ol { margin: 3mm 0 0; padding-left: 5mm; }
    ol li { margin-bottom: 1.4mm; }
    ol li::marker { font-weight: 700; color: #d97706; }
    ol .el { font-size: 9.5pt; line-height: 1.3; color: #334155; }
    ol .en { font-size: 7.5pt; line-height: 1.25; }
    .qr-wrap { width: 50mm; flex: 0 0 auto; text-align: center; }
    .qr { padding: 2.5mm; border-radius: 4mm; background: #ffffff; box-shadow: 0 0 0 0.6mm #f5b94a; }
    .scan { margin: 2.5mm 0 0; font-family: 'Comfortaa', 'Open Sans', system-ui, sans-serif; font-weight: 700; font-size: 11pt; color: #92400e; }
    .scan-en { margin: 0.6mm 0 0; font-size: 8pt; font-weight: 600; color: #b45309; opacity: 0.85; }
    .private { margin: 2mm 0 0; flex: 0 0 auto; font-size: 8.5pt; color: #64748b; overflow-wrap: anywhere; }
    .private strong { color: #9f1239; }
    .private strong.en { font-size: 7.5pt; font-weight: 600; opacity: 0.8; }
    .private .url { display: block; margin-top: 0.6mm; font-size: 7.5pt; }
    @media screen { body { background: #e2e8f0; padding: 8mm 0; } .page { background: #ffffff; padding: 10mm; width: 210mm; margin-bottom: 8mm; } }
</style></head><body>
${pages.join('\n')}
</body></html>`;
}

// ── Class QR sheet ─────────────────────────────────────────────────────────

export const QR_SHEET_PER_PAGE = 12; // 3 across, 4 down: each card about 64 × 66 mm, notebook sized

/** A name long enough to need a smaller size, so it still fits whole on its card. */
function nameSizeClass(name) {
    const length = String(name || '').length;
    if (length > 30) return ' name--xs';
    if (length > 22) return ' name--sm';
    return '';
}

/**
 * Every student of a class on A4 sheets of cut-out QR cards, for sticking in notebooks.
 * cards: [{ studentName, username, qrSvg }]. A student without a login still gets a card.
 */
export function buildClassQrSheetHtml({ schoolName = '', className = '', cards = [], logoUrl = LOGO_URL } = {}) {
    const card = (item) => `
        <div class="card">
            <p class="name${nameSizeClass(item.studentName)}">${escapeHtml(item.studentName)}</p>
            <div class="qr">${item.qrSvg}</div>
            <p class="scan" lang="el">Σκανάρετε με την κάμερα του κινητού</p>
            <p class="scan-en" lang="en">Scan with your phone camera</p>
            ${item.username
                ? `<p class="user"><span lang="el">Όνομα χρήστη</span> <span class="en" lang="en">Username</span> <code>${escapeHtml(item.username)}</code></p>`
                : '<p class="user user--none"><span lang="el">Ζητήστε στοιχεία σύνδεσης από το σχολείο</span> <span class="en" lang="en">Ask the school for a login</span></p>'}
            <p class="foot">${escapeHtml(className || schoolName || 'The Great Class Quest')}</p>
        </div>`;
    const pages = [];
    for (let i = 0; i < cards.length; i += QR_SHEET_PER_PAGE) {
        const group = cards.slice(i, i + QR_SHEET_PER_PAGE);
        const pageNo = pages.length + 1;
        const total = Math.ceil(cards.length / QR_SHEET_PER_PAGE);
        pages.push(`
    <div class="page">
        <header class="sheet-head">
            <img class="crest" src="${escapeHtml(logoUrl)}" alt="">
            <div>
                <strong>${escapeHtml(className || 'Class')}</strong>
                <span>${escapeHtml(schoolName || 'The Great Class Quest')} · <span lang="el">Κωδικοί QR για τα τετράδια</span> · <span lang="en">Notebook QR codes</span></span>
            </div>
            <span class="tip">✂ <span lang="el">Κόψτε στις διακεκομμένες γραμμές</span><br><span lang="en">Cut along the dashed lines</span>${total > 1 ? `<br><b>${pageNo} / ${total}</b>` : ''}</span>
        </header>
        <div class="grid">${group.map(card).join('')}</div>
    </div>`);
    }
    return `<!doctype html><html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>QR cards · ${escapeHtml(className || 'Class')}</title>${PRINT_FONT}${GREEK_FONT}
<style>
    ${PRINT_BASE_CSS}
    @page { size: A4 portrait; margin: 8mm; }
    .page { width: 194mm; height: 280mm; margin: 0 auto; break-after: page; display: flex; flex-direction: column; overflow: hidden; }
    .page:last-child { break-after: auto; }
    .sheet-head { display: flex; align-items: center; gap: 3mm; height: 13mm; padding: 0 1mm 2mm; }
    .sheet-head .crest { width: 10mm; height: 10mm; }
    .sheet-head strong { display: block; font-family: 'Fredoka One', 'Comfortaa', system-ui, sans-serif; font-weight: 400; font-size: 13pt; color: #1f2a44; }
    .sheet-head div span { font-size: 7.5pt; color: #64748b; }
    .sheet-head .tip { margin-left: auto; text-align: right; font-size: 7.5pt; line-height: 1.3; color: #64748b; }
    .grid { flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(4, 1fr); border-top: 0.35mm dashed #94a3b8; border-left: 0.35mm dashed #94a3b8; }
    .card { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2.5mm 3mm; text-align: center; overflow: hidden;
        border-right: 0.35mm dashed #94a3b8; border-bottom: 0.35mm dashed #94a3b8; }
    .card::before { content: ''; position: absolute; inset: 2mm; border: 0.5mm solid #f5b94a; border-radius: 4mm; background: linear-gradient(180deg, #fffaf0 0%, #ffffff 45%); z-index: -1; }
    .name { margin: 0; max-width: 100%; font-family: 'Comfortaa', 'Open Sans', system-ui, sans-serif; font-weight: 700; font-size: 12pt; line-height: 1.12; color: #1f2a44; overflow-wrap: anywhere; }
    .name--sm { font-size: 10pt; }
    .name--xs { font-size: 8.5pt; }
    .qr { width: 33mm; margin: 1.6mm auto 0; }
    .scan { margin: 1.2mm 0 0; font-size: 7.5pt; font-weight: 700; line-height: 1.2; color: #92400e; }
    .scan-en { margin: 0.3mm 0 0; font-size: 6.3pt; line-height: 1.2; color: #b45309; opacity: 0.85; }
    .user { margin: 1.2mm 0 0; font-size: 6.5pt; line-height: 1.25; color: #64748b; }
    .user .en { font-size: 5.8pt; opacity: 0.85; }
    .user code { display: block; font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace; font-size: 9.5pt; font-weight: 700; color: #1f2a44; }
    .user--none span { display: block; }
    .foot { margin: 0.8mm 0 0; font-size: 5.8pt; letter-spacing: 0.12em; text-transform: uppercase; color: #b45309; font-weight: 700; max-width: 100%; overflow-wrap: anywhere; }
    @media screen { body { background: #e2e8f0; padding: 8mm 0; } .page { background: #ffffff; padding: 8mm; width: 210mm; height: 297mm; margin-bottom: 8mm; box-shadow: 0 10px 40px rgba(0,0,0,.15); } }
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


const qrFor = (username) => renderQrSvg(getFamilyLoginUrl(username), { title: 'Family sign-in QR code' });

/** Prints one or many family slips: slips = [{ studentName, className, username, password }]. */
export async function printFamilySlips({ schoolName, slips = [] } = {}) {
    if (!slips.length) return;
    const url = getParentLoginUrl();
    const withQr = await Promise.all(slips.map(async (item) => ({ ...item, qrSvg: await qrFor(item.username) })));
    await printHtml(buildFamilySlipsHtml({ schoolName, slips: withQr, url }));
}

/** Prints a class's notebook QR cards: cards = [{ studentName, username }]. */
export async function printClassQrSheet({ schoolName, className, cards = [] } = {}) {
    if (!cards.length) return;
    const withQr = await Promise.all(cards.map(async (item) => ({ ...item, qrSvg: await qrFor(item.username) })));
    await printHtml(buildClassQrSheetHtml({ schoolName, className, cards: withQr }));
}
