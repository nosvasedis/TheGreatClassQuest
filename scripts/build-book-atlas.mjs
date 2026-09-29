/**
 * Reproducible dev-only atlas build. Private inputs stay in docs/agent-atlas/book-sources.
 * Publisher headings are curated below against the extracted scope/contents PDFs;
 * vocabulary is parsed from the school's CSV and the supplied publisher/OCR JSON.
 * No textbook pages, exercises, or reading passages are shipped.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sources = path.join(root, 'docs/agent-atlas/book-sources');
const output = path.join(root, 'features/bookAtlas/data');
const read = file => fs.readFileSync(path.join(sources, file), 'utf8').replace(/^\uFEFF/, '');
const json = file => JSON.parse(read(file));
const books = [];
const date = '2026-09-27';
fs.mkdirSync(output, { recursive: true });
function writeWords(ref, data) { fs.writeFileSync(path.join(output, ref + '.json'), JSON.stringify(data) + '\n'); }
function book(id, title, kind, leagues, aliases, source, extra = {}) {
    const entry = { id, title, series: title.replace(/\s(?:B[12]\+?|\d)$/, ''), level: title.match(/(?:B[12]\+?|\d)$/)?.[0] || '',
        edition: '', publisher: '', kind, defaultLeagues: leagues, prevBookId: null, nextBookId: null,
        aliases, source: { ...source, retrievedAt: date }, units: [], ...extra };
    books.push(entry); return entry;
}
export function parseSemicolonCsv(text) {
    const rows = []; let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
        else if (ch === ';' && !quoted) { row.push(cell); cell = ''; }
        else if (ch === '\n' && !quoted) { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
        else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
}
const cppGrammar = [
    ['be: affirmative, negative and questions', 'this/that/these/those; possessive adjectives', 'there is/are; prepositions of place', 'present simple: affirmative, negative and questions', 'like + -ing; possessive s', 'have/has; wh- questions', 'can/cannot; countable and uncountable nouns', 'want/need; wh- questions', 'present continuous: affirmative, negative and questions'],
    ['prepositions of time and place', 'adverbs of frequency; subject and object pronouns', 'quantifiers; how much/how many', 'past simple of be', 'past simple irregular verbs; possessive pronouns', 'past simple regular verbs', 'past simple irregular verbs; wh- questions', 'comparatives and superlatives', 'should; may/can for permission'],
    ['could for ability; tense review', 'present continuous for future; should/must', 'past continuous; interrupted past', 'comparative/superlative adjectives and adverbs', 'comparatives; gerunds as subjects and objects', 'zero conditional; have to', 'may/might; give/send/take/bring/show', 'will; going to', 'will for promises and offers; past continuous with while']
];
for (let level = 1; level <= 3; level++) {
    const units = {}, review = [];
    for (const row of parseSemicolonCsv(read('cpp/Primary Path ' + level + ' - Wordlist.csv'))) {
        const [u, location, , page, w, pos, gr, example] = row;
        if (!w || (!/^\d+$/.test(u) && u !== 'REVIEW')) continue;
        const entry = { w: w.trim(), pos: (pos || '').trim(), gr: (gr || '').trim(), example: (example || '').trim(),
            page: Number(page) || null, location: location || '', component: /workbook/i.test(location) ? 'wb' : 'sb' };
        if (u === 'REVIEW') review.push(entry); else (units[u] ||= []).push(entry);
    }
    const scope = read('publisher/cambridge-primary-path-level-' + level + '-scope-and-sequence.pdf.txt');
    const titles = [...new Set([...scope.matchAll(/\d+\s+Big Question:\s*([^\n]+)/g)].map(m => m[1].trim()))];
    if (titles.length !== 9 || Object.keys(units).length !== 9) throw Error('Incomplete CPP source: ' + level);
    const id = 'primary-path-' + level;
    const item = book(id, 'Cambridge Primary Path ' + level, 'coursebook', [['A'], ['B'], ['C']][level - 1],
        ['cambridge primary path ', 'primary path ', 'cpp ', 'cpp', 'pp ', 'pp', 'cp ', 'primary ', 'path ', 'cambridge primary '].map(a => a + level),
        { kind: 'school-wordlist-and-publisher-scope', file: 'Primary Path ' + level + ' - Wordlist.csv' },
        { edition: '2e', publisher: 'Cambridge University Press', wordlistRef: 'cpp' + level,
            prevBookId: level > 1 ? 'primary-path-' + (level - 1) : null, nextBookId: level < 3 ? 'primary-path-' + (level + 1) : null });
    item.units = titles.map((title, i) => {
        const rangeFor = comp => {
            const pages = units[i + 1].filter(w => w.component === comp && w.page > 0).map(w => w.page);
            return pages.length ? [Math.min(...pages), Math.max(...pages)] : null;
        };
        const pages = { sb: rangeFor('sb'), wb: rangeFor('wb') };
        return { n: i + 1, title, theme: title, grammar: cppGrammar[level - 1][i], pageRange: pages.sb, pages, reviewAfter: true };
    });
    writeWords('cpp' + level, { bookId: id, edition: '2e', units, review });
}
const closeup = [
    { ref: 'b1', id: 'close-up-b1', level: 'B1', league: 'D',
        titles: ['Perfect for the job', 'Delicious!', 'It’s natural', 'That’s the fashion', 'Where we live', 'Go for it!', 'Have a great trip!', 'My own time', 'Digital world', 'Show time!', 'Life lessons', 'Body and mind'],
        themes: ['jobs and personality', 'food and cooking', 'nature and the environment', 'clothes and shopping', 'homes and household objects', 'sports', 'travel and holidays', 'free time', 'computers and technology', 'film and television', 'education', 'health and the body'],
        grammar: ['present simple/continuous; stative verbs; countable/uncountable nouns; quantifiers', 'past simple/continuous; used to/would; be/get used to', 'present perfect simple/continuous; articles', 'relative clauses; clauses with time expressions', 'will; going to; future plans and predictions', 'zero, first and second conditional; unless', 'question tags; subject/object questions; past perfect simple/continuous', 'modals and semi-modals', 'passive voice; passive with modals; by/with', 'reported statements, questions and requests', 'causative; gerunds and infinitives', 'adjectives/adverbs; so/such; comparison'] },
    { ref: 'b1plus', id: 'close-up-b1-plus', level: 'B1+', league: 'E',
        titles: ['Your world', 'Mysterious world', 'Fit as a fiddle', 'Technological wonders', 'Going places', 'Living history', 'Wild world', 'Media matters', 'Making a living', 'See the world', 'Crime time', 'You are what you wear'],
        themes: ['feelings and people', 'mysteries', 'health and fitness', 'technology', 'ambition and success', 'history', 'natural disasters', 'the media', 'work', 'holidays and travel', 'crime', 'fashion and shopping'],
        grammar: ['present simple/continuous; articles', 'past simple/continuous; used to/would; be/get used to', 'present perfect simple/continuous; quantifiers', 'will/going to; future continuous/perfect', 'modals, semi-modals and perfect modals', 'past perfect simple/continuous; question tags; pronouns', 'gerunds/infinitives; comparison; too/enough/so/such', 'passive voice including gerunds, infinitives and modals', 'reported statements/questions/commands/requests; reporting verbs', 'zero, first, second, third and mixed conditionals', 'defining/non-defining/reduced relative clauses', 'causative; inversion'] }
];
for (const c of closeup) {
    const vocabulary = json('closeup/closeup-' + (c.ref === 'b1' ? 'b1' : 'b1-plus') + '.json');
    const aliases = c.ref === 'b1' ? ['close up b1', 'closeup b1', 'new close up b1', 'cu b1', 'ncu b1', 'b1', 'close up intermediate']
        : ['close up b1+', 'closeup b1+', 'new close up b1+', 'cu b1+', 'ncu b1+', 'b1+', 'b1 plus', 'close up plus', 'close up upper intermediate'];
    const item = book(c.id, 'New Close-Up ' + c.level, 'coursebook', [c.league], aliases,
        { kind: 'publisher-scope-and-wordlist', url: 'https://www.eltngl.com/assets/downloads/newcloseup_pro0000009154/newcloseup-' + c.ref + '-scopeandsequence.pdf' },
        { publisher: 'National Geographic Learning', edition: '3e', wordlistRef: c.id,
            prevBookId: c.ref === 'b1' ? null : 'close-up-b1', nextBookId: c.ref === 'b1' ? 'close-up-b1-plus' : null });
    // Verified against the third-edition scope (newcloseup-b1[-plus]-3e-scope.pdf): the twelve units are
    // contiguous twelve-page units from p5 and all reviews sit at the end (Review units 1-12 pp149-160),
    // so unit 12 starts on p137. (The two-page interleaved reviews belong to the older edition's contents.)
    item.units = c.titles.map((title, i) => ({ n: i + 1, title, theme: c.themes[i], grammar: c.grammar[i], pageRange: [5 + i * 12, 16 + i * 12], pages: { sb: [5 + i * 12, 16 + i * 12] }, reviewAfter: false }));
    // Page annotations from the publisher's wordlists enable targeted retrieval.
    const raw = read('closeup/' + c.ref + '-closeup-wordlists.txt');
    const pageByWord = new Map(); let currentPage = null;
    for (const line of raw.split(/\r?\n/)) {
        const p = line.match(/^(?:Reading |Vocabulary |Grammar |Listening |Speaking |Writing |Video |Use your English )?Pages?\s+(\d+)/i);
        if (p) currentPage = Number(p[1]);
        const w = line.match(/^(\d+)\.\d+\s+(.+?)\s+\([a-zA-Z.,\s\/-]+\)/);
        if (w && currentPage) pageByWord.set(w[1] + ':' + w[2].trim(), currentPage);
    }
    for (const [u, words] of Object.entries(vocabulary.units)) for (const word of words) {
        const page = pageByWord.get(u + ':' + word.w); if (page) word.page = page;
        word.component = 'sb';
    }
    writeWords(c.id, { ...vocabulary, edition: '3e' });
}
for (const [ref, id, title, league, aliases] of [
    ['bamboo', 'bamboo', 'English with Bamboo 1', 'Junior A', ['bamboo', 'bamboo 1', 'english with bamboo', 'ewb', 'bamboo junior a', 'bamboo a', 'hamilton bamboo']],
    ['yeti', 'yeti-2', 'Yeti and Friends Primary 2', 'Junior B', ['yeti 2', 'yeti and friends 2', 'yeti and friends primary 2', 'yeti primary 2', 'yeti junior b', 'yeti b', 'yf 2', 'y&f 2', 'hamilton yeti 2']]
]) {
    const input = json('ebook/' + ref + '-atlas.json');
    const rows = input.lessons || input.units;
    const units = Object.fromEntries(rows.map(u => [u.lesson || u.unit, u.words.map(w => ({ w, pos: '', component: 'sb' }))]));
    const item = book(id, title, 'coursebook', [league], aliases, { kind: 'school-ebook-ocr', file: ref + '-atlas.json' },
        { publisher: 'Hamilton House', wordlistRef: ref === 'bamboo' ? 'bamboo1' : 'yeti2' });
    // OCR image names denote blocks, not printed page numbers. Never guess a page mapping.
    item.units = rows.map(u => ({ n: u.lesson || u.unit, title: u.title || ('Lesson ' + u.unit),
        theme: u.title || u.words.slice(0, 4).join(', '), grammar: u.grammar || '', pageRange: null, pages: {}, reviewAfter: false }));
    const companion = ref === 'yeti' ? Object.fromEntries(Object.entries(json('ebook/yeti-companion-words.json')).map(([u, ws]) =>
        [u, ws.map(w => ({ w, pos: '', component: 'companion' }))])) : {};
    writeWords(item.wordlistRef, { bookId: id, units, companion, pictureDictionary: input.pictureDictionary || input.picture_dictionary || [] });
}
for (let level = 1; level <= 3; level++) {
    const text = read('publisher/burlington-my-grammar-book-' + level + '-toc.pdf.txt');
    const matches = [...text.matchAll(/Unit\s+(\d+)\s+([\s\S]*?)(?=\nUnit\s+\d+|\n\d+\s*\n|\nChain Drills)/g)];
    const entries = matches.map(m => {
        const body = m[2].replace(/\s+/g, ' ').trim();
        const pg = body.match(/\b(\d{1,3})(?:\s|$)/);
        const title = body.replace(/\b\d{1,3}\b/, '').trim().replace(/\s+/g, ' ');
        return { n: Number(m[1]), title, theme: title, grammar: title, start: Number(pg?.[1]) };
    }).sort((a, b) => a.n - b.n);
    const expected = level === 3 ? 26 : 22;
    if (entries.length !== expected || entries.some(u => !u.start)) throw Error('Incomplete Burlington ' + level);
    const item = book('burlington-grammar-' + level, 'Burlington My Grammar Book ' + level, 'grammar', [['A'], ['B'], ['C']][level - 1],
        ['burlington my grammar book ', 'my grammar book ', 'burlington grammar ', 'burlington ', 'my grammar ', 'mgb ', 'bmg ', 'mg ', 'grammar book ', 'grammar '].map(a => a + level),
        { kind: 'publisher-contents', file: 'burlington-my-grammar-book-' + level + '-toc.pdf' }, { publisher: 'Burlington Books' });
    item.units = entries.map((u, i) => {
        const { start, ...rest } = u;
        const range = [start, (entries[i + 1]?.start || start + 5) - 1];
        return { ...rest, pageRange: range, pages: { grammar: range }, reviewAfter: false };
    });
}
for (const level of ['b1', 'b2']) {
    const text = read('publisher/grammalysis-' + level + '-sample.pdf.txt');
    const units = [];
    if (level === 'b1') {
        for (const m of text.matchAll(/LESSON (\d+) a (.+?) (?:Phrasal Verbs.*?|Prepositional Phrases|Prepositions|Derivatives) (\d+)\r?\nb (.+?) (?:Phrasal Verbs.*?|Prepositional Phrases|Prepositions|Derivatives) (\d+)/g)) {
            units.push({ n: +m[1], title: m[2], theme: m[2], grammar: m[2] + '; ' + m[4], pageRange: [+m[3], +m[5] + 2],
                lessons: [{ code: m[1] + 'a', title: m[2], pageRange: [+m[3], +m[5] - 1] }, { code: m[1] + 'b', title: m[4], pageRange: [+m[5], +m[5] + 2] }] });
        }
    } else for (const m of text.matchAll(/^LESSON (\d+) Gr (.+?) (\d+)\r?\nVoc (.+?) (\d+)/gm)) {
        units.push({ n: +m[1], title: m[2], theme: m[2], grammar: m[2], vocabulary: m[4], pageRange: [+m[3], +m[5]] });
    }
    if (units.length !== (level === 'b1' ? 20 : 36)) throw Error('Incomplete Grammalysis ' + level + ': ' + units.length);
    const item = book('grammalysis-' + level, 'Grammalysis ' + level.toUpperCase(), 'grammar', [level === 'b1' ? 'D' : 'Lower'],
        ['grammalysis ' + level, 'grammalysis ' + (level === 'b1' ? '1' : '2'), 'grammalysis for all ' + level],
        { kind: 'publisher-contents', file: 'grammalysis-' + level + '-sample.pdf' }, { publisher: 'Super Course' });
    item.units = units.map(u => ({ ...u, pages: { grammar: u.pageRange } }));
}
// Curated per-component page maps for collections whose parts are not published as scope PDFs.
// Filled from public publisher material (see book-sources/README.md); unknown parts stay absent.
let componentPages = {};
try { componentPages = json('publisher/component-pages.json'); } catch { /* optional, curated by hand */ }
for (const b of books) {
    const byUnit = componentPages[b.id] || {};
    for (const u of b.units) {
        const extra = byUnit[String(u.n)];
        if (extra && typeof extra === 'object') u.pages = { ...(u.pages || {}), ...extra };
        u.pages = u.pages || {};
        u.pageRange = u.pages.sb || u.pages.grammar || u.pageRange || null;
    }
}
fs.writeFileSync(path.join(root, 'features/bookAtlas.data.mjs'), '// Generated by scripts/build-book-atlas.mjs. Source dates and provenance are per book.\nexport const BOOK_ATLAS = ' + JSON.stringify(books, null, 2) + ';\nexport default BOOK_ATLAS;\n');
console.log('Book Atlas: ' + books.length + ' books, ' + books.reduce((n, b) => n + b.units.length, 0) + ' units. Vocabulary written to features/bookAtlas/data.');
