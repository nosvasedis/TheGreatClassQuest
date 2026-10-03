// Pure view model for the Home "class roster" peek modal (no DOM, no Firestore).
// Kept free of app imports so `node --test` can exercise it directly.

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

function toScoreLookup(scores) {
    if (scores instanceof Map) return (id) => scores.get(id) || {};
    if (Array.isArray(scores)) {
        const map = new Map(scores.map((s) => [s.id, s]));
        return (id) => map.get(id) || {};
    }
    const obj = scores || {};
    return (id) => obj[id] || {};
}

export function initialsFor(name = '') {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    const first = parts[0].charAt(0);
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
    return (first + last).toUpperCase();
}

/** `MM-DD` suffix that birthday / nameday strings (YYYY-MM-DD or --MM-DD) end with. */
export function occasionSuffix(date = new Date()) {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `-${mm}-${dd}`;
}

/**
 * Build the roster view for one class.
 * @param {object} opts
 * @param {Array} opts.students        students already filtered to the class
 * @param {Map|Array|object} opts.scores student_scores keyed by student id
 * @param {(score:object)=>number} [opts.goldFor] live year gold for a score doc
 * @param {Date} [opts.today]
 * @param {string|null} [opts.heroStudentId] latest Hero of the Day
 * @param {boolean} [opts.gentle] Growth mode (Pre-Junior): no ranks, no podium
 */
export function buildClassRosterView({
    students = [],
    scores = null,
    goldFor = (score) => Number(score?.gold || 0),
    today = new Date(),
    heroStudentId = null,
    gentle = false
} = {}) {
    const scoreOf = toScoreLookup(scores);
    const suffix = occasionSuffix(today);

    const heroes = students
        .filter((s) => s && s.id && s.enrollmentStatus !== 'inactive')
        .map((s) => {
            const score = scoreOf(s.id);
            const name = String(s.name || 'Hero');
            return {
                id: s.id,
                name,
                firstName: name.split(/\s+/)[0],
                initials: initialsFor(name),
                avatar: s.avatar || '',
                guildId: s.guildId || null,
                heroClass: s.heroClass || null,
                heroLevel: Number(score.heroLevel || 0),
                monthlyStars: round1(score.monthlyStars),
                totalStars: round1(score.totalStars),
                gold: Math.round(Number(goldFor(score)) || 0),
                isBirthday: typeof s.birthday === 'string' && s.birthday.endsWith(suffix),
                isNameday: typeof s.nameday === 'string' && s.nameday.endsWith(suffix),
                isHero: !!heroStudentId && s.id === heroStudentId,
                pendingSkillChoice: !!score.pendingSkillChoice,
                rank: null
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

    const byStars = heroes.slice().sort((a, b) => (b.monthlyStars - a.monthlyStars) || a.name.localeCompare(b.name));
    if (!gentle) {
        // Competition ranking (1, 2, 2, 4) — only heroes who earned stars get a rank.
        let lastStars = null;
        let lastRank = 0;
        byStars.forEach((h, i) => {
            if (h.monthlyStars <= 0) return;
            if (h.monthlyStars !== lastStars) { lastRank = i + 1; lastStars = h.monthlyStars; }
            h.rank = lastRank;
        });
    }

    const podium = gentle ? [] : byStars.filter((h) => h.rank && h.rank <= 3).slice(0, 3);
    const maxMonthly = byStars.length ? Math.max(0, byStars[0].monthlyStars) : 0;

    const guildMap = new Map();
    heroes.forEach((h) => { if (h.guildId) guildMap.set(h.guildId, (guildMap.get(h.guildId) || 0) + 1); });
    const guilds = [...guildMap.entries()]
        .map(([guildId, count]) => ({ guildId, count }))
        .sort((a, b) => b.count - a.count || a.guildId.localeCompare(b.guildId));

    const totals = heroes.reduce((acc, h) => {
        acc.monthly += h.monthlyStars;
        acc.total += h.totalStars;
        acc.gold += h.gold;
        return acc;
    }, { count: heroes.length, monthly: 0, total: 0, gold: 0 });
    totals.monthly = round1(totals.monthly);
    totals.total = round1(totals.total);

    return {
        heroes,
        byStars,
        podium,
        maxMonthly,
        guilds,
        totals,
        celebrations: heroes.filter((h) => h.isBirthday || h.isNameday)
    };
}

/** Sort heroes for display: 'name' (A–Z) or 'stars' (monthly, desc). */
export function sortRosterHeroes(heroes = [], mode = 'name') {
    const list = heroes.slice();
    if (mode === 'stars') return list.sort((a, b) => (b.monthlyStars - a.monthlyStars) || a.name.localeCompare(b.name));
    return list.sort((a, b) => a.name.localeCompare(b.name));
}

/** Case- and accent-insensitive name filter (Greek names included). */
export function filterRosterHeroes(heroes = [], query = '') {
    const fold = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const q = fold(query).trim();
    if (!q) return heroes.slice();
    return heroes.filter((h) => fold(h.name).includes(q));
}

const VIRTUE_KEYS = ['teamwork', 'creativity', 'respect', 'focus'];

function logDateValue(dateKey) {
    const parts = String(dateKey || '').split(/[-/]/);
    if (parts.length !== 3) return 0;
    const [a, b, c] = parts.map(Number);
    // DD-MM-YYYY or YYYY-MM-DD
    return parts[0].length === 4 ? a * 10000 + b * 100 + c : c * 10000 + b * 100 + a;
}

/**
 * One student's month from award_log rows (already scoped to the current month).
 * @param {object} opts
 * @param {Array} opts.logs
 * @param {string} opts.studentId
 * @param {(log:object)=>number} [opts.creditFor] star credit of one row
 * @param {(log:object)=>boolean} [opts.isVisible] rows that belong in a star list
 * @param {number} [opts.recentLimit]
 */
export function buildHeroMonthSummary({
    logs = [],
    studentId,
    creditFor = (log) => Number(log?.stars) || 0,
    isVisible = () => true,
    recentLimit = 5
} = {}) {
    const mine = logs.filter((log) => log && log.studentId === studentId && isVisible(log));
    const byReason = new Map();
    let peerBoons = 0;
    mine.forEach((log) => {
        const reason = log.reason || 'other';
        byReason.set(reason, (byReason.get(reason) || 0) + creditFor(log));
        if (reason === 'peer_boon') peerBoons += 1;
    });
    const virtues = VIRTUE_KEYS.map((key) => ({ key, stars: round1(byReason.get(key) || 0) }));
    const virtueMax = Math.max(0, ...virtues.map((v) => v.stars));
    const extras = [...byReason.entries()]
        .filter(([reason, stars]) => !VIRTUE_KEYS.includes(reason) && round1(stars) !== 0)
        .map(([reason, stars]) => ({ reason, stars: round1(stars) }))
        .sort((a, b) => b.stars - a.stars);
    const recent = mine
        .slice()
        .sort((a, b) => logDateValue(b.date) - logDateValue(a.date)
            || (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
        .slice(0, recentLimit)
        .map((log) => ({ date: log.date || '', reason: log.reason || 'other', stars: round1(creditFor(log)) }));
    return { virtues, virtueMax, extras, peerBoons, recent, count: mine.length };
}

/**
 * Teacher Boon status for one student: 2★, one student per class per month,
 * only in the month's last 7 days (see features/boons.js#awardTeacherBoon).
 * @returns {{ state: 'received'|'given_to_other'|'open'|'closed', opensOn: Date }}
 */
export function resolveTeacherBoonStatus({ boon = null, studentId = '', today = new Date() } = {}) {
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const opensOn = new Date(today.getFullYear(), today.getMonth(), lastDay - 6);
    if (boon?.studentId) {
        return { state: boon.studentId === studentId ? 'received' : 'given_to_other', opensOn };
    }
    return { state: today.getDate() >= lastDay - 6 ? 'open' : 'closed', opensOn };
}

/**
 * Scholar's Scroll progress for the hero view: trials oldest → newest, one series per type
 * (null where the other type sits, so the chart can span gaps).
 * @param {Array<{type:string,date:string}>} scores
 * @param {{ percentFor: (score:object)=>number|null, dateOf: (score:object)=>Date|null }} fns
 */
export function buildTrialSeries(scores = [], { percentFor, dateOf }) {
    const time = (s) => dateOf(s)?.getTime?.() || 0;
    const sorted = (Array.isArray(scores) ? scores : []).filter(Boolean).slice().sort((a, b) => time(a) - time(b));
    const pct = (s) => {
        const v = Number(percentFor(s));
        return Number.isFinite(v) ? Math.round(v * 10) / 10 : null;
    };
    return {
        points: sorted,
        dates: sorted.map((s) => dateOf(s)),
        tests: sorted.map((s) => (s.type === 'test' ? pct(s) : null)),
        dictations: sorted.map((s) => (s.type === 'dictation' ? pct(s) : null)),
    };
}

/** Best test by normalised percent (first one wins a tie); null when there are none. */
export function pickBestTest(scores = [], percentFor) {
    let best = null;
    let bestPct = -Infinity;
    for (const s of Array.isArray(scores) ? scores : []) {
        if (s?.type !== 'test') continue;
        const v = Number(percentFor(s));
        if (Number.isFinite(v) && v > bestPct) { best = s; bestPct = v; }
    }
    return best ? { score: best, percent: Math.round(bestPct) } : null;
}
