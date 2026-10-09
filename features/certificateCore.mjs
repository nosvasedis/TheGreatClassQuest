// features/certificateCore.mjs — pure model + markup for the Hero Certificate.
// No DOM, no state, no Firebase: reports.js gathers the records and passes them in,
// so the maths (which month counts, which virtue leads, which honours print) is testable.

import { getAwardLogMonthlyStarCredit } from './awardLogReasonMeta.js';
import { getLegendQuest, readLegendRecord } from './legendQuestCore.mjs';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Reasons that are bookkeeping, not a virtue a child showed. */
const NON_VIRTUE_REASONS = new Set([
    'correction', 'wheel_fortune', 'wheel_curse', 'marked_present', 'pathfinder_map', 'welcome_back_gold',
]);

export const VIRTUE_META = Object.freeze({
    respect: { label: 'Respect', emoji: '🤝' },
    teamwork: { label: 'Teamwork', emoji: '🧩' },
    focus: { label: 'Focus', emoji: '🎯' },
    creativity: { label: 'Creativity', emoji: '🎨' },
    scholar_s_bonus: { label: 'Scholarship', emoji: '📜' },
    story_weaver: { label: 'Storytelling', emoji: '✒️' },
    welcome_back: { label: 'Coming Back Strong', emoji: '👟' },
    peer_boon: { label: 'Generosity', emoji: '💝' },
    teacher_boon: { label: "Teacher's Boon", emoji: '🎁' },
    excellence: { label: 'Excellence', emoji: '🌟' },
    quiz_of_the_week: { label: 'Quiz Mastery', emoji: '🧠' },
    special_quest: { label: 'Special Quest', emoji: '🗺️' },
});

export function virtueMeta(reason) {
    const key = String(reason || '').toLowerCase();
    if (VIRTUE_META[key]) return { key, ...VIRTUE_META[key] };
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Excellence';
    return { key, label, emoji: '⭐' };
}

/** Age band for a league's ageCategory. Unknown bands fall back to the teen certificate, as leagues do. */
export function certificateBand(ageCategory) {
    return ['early', 'junior', 'mid', 'senior'].includes(ageCategory) ? ageCategory : 'senior';
}

/**
 * "YYYY-MM" from any date the app stores: DD-MM-YYYY (award logs), YYYY-MM-DD, DD/MM/YYYY,
 * a Firestore Timestamp ({ seconds } / toDate()) or a Date. '' when unreadable.
 */
export function toMonthKey(value) {
    if (!value) return '';
    if (typeof value === 'string') {
        const s = value.trim();
        let m = /^(\d{4})-(\d{2})-\d{2}/.exec(s);
        if (m) return `${m[1]}-${m[2]}`;
        m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
        if (m) return `${m[3]}-${m[2].padStart(2, '0')}`;
        return '';
    }
    const d = typeof value.toDate === 'function' ? value.toDate()
        : (typeof value.seconds === 'number' ? new Date(value.seconds * 1000) : (value instanceof Date ? value : null));
    if (!d || Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthKeyOf(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(date) {
    return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Stars for the certificate's period. Monthly uses the score doc only when it was reset this
 * month; a stale doc (no award yet since the month turned) would print last month's total.
 */
export function scopeStars({ scope, scoreData, scopedLogs, now }) {
    if (scope !== 'monthly') return Math.max(0, Number(scoreData?.totalStars) || 0);
    const monthStart = `${monthKeyOf(now)}-01`;
    const fresh = !scoreData?.lastMonthlyResetDate || scoreData.lastMonthlyResetDate === monthStart;
    if (fresh && Number.isFinite(Number(scoreData?.monthlyStars))) return Math.max(0, Number(scoreData.monthlyStars));
    const fromLogs = scopedLogs.reduce((sum, log) => sum + getAwardLogMonthlyStarCredit(log), 0);
    return Math.max(0, Math.round(fromLogs * 10) / 10);
}

/** The virtue with the most stars (not the most log rows) in the period. */
export function leadingVirtue({ scopedLogs, starsByReason = null }) {
    const totals = new Map();
    if (starsByReason && typeof starsByReason === 'object') {
        for (const [reason, stars] of Object.entries(starsByReason)) {
            const n = Number(stars);
            if (!NON_VIRTUE_REASONS.has(reason) && n > 0) totals.set(reason, n);
        }
    }
    if (!totals.size) {
        for (const log of scopedLogs) {
            const reason = String(log?.reason || '');
            const n = Number(log?.stars);
            if (!reason || NON_VIRTUE_REASONS.has(reason) || !(n > 0)) continue;
            totals.set(reason, (totals.get(reason) || 0) + n);
        }
    }
    const best = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (!best) return null;
    return { ...virtueMeta(best[0]), stars: Math.round(best[1] * 10) / 10 };
}

function hexToRgb(hex) {
    const raw = String(hex || '').replace('#', '');
    const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
    const n = Number.parseInt(full, 16);
    if (Number.isNaN(n) || full.length !== 6) return [100, 100, 100];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mixHex(a, b, t) {
    const x = hexToRgb(a), y = hexToRgb(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

const BAND_PALETTES = {
    early: { primary: '#db2777', secondary: '#f59e0b' },
    junior: { primary: '#0d9488', secondary: '#22c55e' },
    mid: { primary: '#4f46e5', secondary: '#0ea5e9' },
    senior: { primary: '#1e3a8a', secondary: '#64748b' },
};

/** Colours for the whole certificate: the student's guild when sorted, the age band otherwise. */
export function certificatePalette(guild, band) {
    const base = guild?.primary ? { primary: guild.primary, secondary: guild.secondary || guild.primary } : BAND_PALETTES[band] || BAND_PALETTES.senior;
    return {
        primary: base.primary,
        secondary: base.secondary,
        ink: mixHex(base.primary, '#1c1917', 0.55),
        wash: mixHex(base.primary, '#fffaf0', 0.9),
        gold: '#b8862f',
        goldLight: '#e9c46a',
        paper: '#fdf8ec',
        paperEdge: '#efe2c4',
        text: '#3b2f25',
    };
}

const TITLES = {
    early: { monthly: 'Little Hero of the Month', alltime: 'Little Legend of the Year' },
    junior: { monthly: 'Hero of the Quest', alltime: 'Ultimate Quest Hero' },
    mid: { monthly: 'Certificate of Valour', alltime: 'Master of the Great Quest' },
    senior: { monthly: 'Certificate of Achievement', alltime: "Legend's Grand Achievement" },
};

const PRESENTED = {
    early: 'This shiny award goes to',
    junior: 'Proudly presented to',
    mid: 'Proudly presented to',
    senior: 'Awarded with distinction to',
};

/**
 * Everything the certificate prints, from raw records.
 *
 * @param {object} input
 * @param {'monthly'|'alltime'} input.scope
 * @param {Date} input.now
 * @param {object} input.student            { id, name, avatar, heroClass, guildId }
 * @param {object} input.studentClass       { name, logo, questLevel }
 * @param {object|null} input.scoreData     students_scores doc
 * @param {string} input.ageCategory        league ageCategory
 * @param {object[]} input.awardLogs        award_log rows (any student; filtered here)
 * @param {object[]} input.writtenScores    written_scores rows
 * @param {object[]} input.oaths            ember_oaths rows
 * @param {number} [input.prodigyWins]      Prodigy of the Month crowns this school year
 * @param {object|null} [input.guild]       GUILDS entry
 * @param {object|null} [input.heroDef]     HERO_CLASSES entry
 * @param {object|null} [input.heroTree]    HERO_SKILL_TREE entry for the class
 * @param {object} [input.familiarTypes]    FAMILIAR_TYPES
 * @param {(s:object)=>number|null} [input.scorePercent]
 * @param {(s:object)=>string} [input.scoreLabel]
 * @param {string} [input.teacherName]
 * @param {string} [input.schoolName]
 * @param {string} [input.schoolYearLabel]  e.g. "2026–27"
 */
export function buildCertificateModel(input) {
    const {
        scope: rawScope, now = new Date(), student, studentClass, scoreData = null, ageCategory,
        awardLogs = [], writtenScores = [], oaths = [], prodigyWins = 0,
        guild = null, heroDef = null, heroTree = null, familiarTypes = {},
        scorePercent = defaultScorePercent, scoreLabel = defaultScoreLabel,
        teacherName = '', schoolName = '', schoolYearLabel = '',
    } = input;
    const scope = rawScope === 'alltime' ? 'alltime' : 'monthly';
    const band = certificateBand(ageCategory);
    const monthKey = monthKeyOf(now);
    const inScope = (value) => scope !== 'monthly' || toMonthKey(value) === monthKey;

    const studentLogs = awardLogs.filter((log) => log && log.studentId === student.id);
    const scopedLogs = studentLogs.filter((log) => inScope(log.date));
    const stars = scopeStars({ scope, scoreData, scopedLogs, now });
    const totalStars = Math.max(0, Number(scoreData?.totalStars) || 0);
    const virtue = leadingVirtue({ scopedLogs, starsByReason: scope === 'alltime' ? scoreData?.starsByReason : null });

    // Hero path
    let hero = null;
    const heroClass = student.heroClass || '';
    if (heroClass && heroDef) {
        const maxLevel = heroTree?.levels?.length || 0;
        const rawLevel = Math.max(0, Number(scoreData?.heroLevel) || 0);
        const level = maxLevel ? Math.min(rawLevel, maxLevel) : rawLevel;
        const titles = heroTree?.titles || [];
        const skills = (scoreData?.heroSkills || []).map((id) => {
            for (const lvl of heroTree?.levels || []) {
                const branch = (lvl.branches || []).find((b) => b.id === id);
                if (branch) return { name: branch.name, icon: branch.icon || '✦' };
            }
            return null;
        }).filter(Boolean);
        const legendRecord = readLegendRecord(heroClass, scoreData?.legendQuest);
        const legendDef = getLegendQuest(heroClass);
        const legendInScope = legendRecord.completedAt && legendDef
            && (scope !== 'monthly' || toMonthKey(legendRecord.completedAt) === monthKey);
        hero = {
            className: heroClass,
            legend: legendInScope ? { name: legendDef.legend, quest: legendDef.quest, completedAt: legendRecord.completedAt } : null,
            icon: heroDef.icon || '🛡️',
            level,
            maxLevel,
            title: level > 0 ? (titles[level - 1] || heroClass) : `Apprentice ${heroClass}`,
            accent: heroDef.theme?.accent || heroTree?.auraColor || null,
            skills,
        };
    }

    // Familiar companion (hatched only; an egg is a promise, not yet a companion)
    let familiar = null;
    const fam = scoreData?.familiar;
    if (fam && fam.typeId) {
        const type = familiarTypes[fam.typeId] || null;
        const typeName = type?.name || fam.typeId.charAt(0).toUpperCase() + fam.typeId.slice(1);
        if (fam.state === 'egg') {
            familiar = { name: typeName, stage: 'Egg', hatched: false, typeName };
        } else {
            const level = Math.max(1, Number(fam.level) || 1);
            familiar = { name: fam.name || typeName, stage: type?.levelNames?.[level - 1] || `Level ${level}`, hatched: true, typeName, level };
        }
    }

    // Ember Oaths kept in the period
    const keptOaths = oaths.filter((o) => o && o.studentId === student.id && o.status === 'kept' && inScope(o.keptAt || o.updatedAt || o.dueDate));
    const oath = keptOaths.length ? {
        count: keptOaths.length,
        text: String(keptOaths[keptOaths.length - 1].text || '').trim(),
    } : null;

    // Trophy Room treasures gathered in the period (usable relics included; they are still loot)
    const inventory = Array.isArray(scoreData?.inventory) ? scoreData.inventory.filter((i) => i && i.name) : [];
    const treasures = scope === 'monthly' ? inventory.filter((i) => toMonthKey(i.acquiredAt) === monthKey).length : inventory.length;

    // Best trial in the period
    const trials = writtenScores.filter((s) => s && s.studentId === student.id && inScope(s.date || s.createdAt));
    const bestTrial = [...trials]
        .map((s) => ({ s, p: scorePercent(s) }))
        .filter((x) => Number.isFinite(x.p))
        .sort((a, b) => b.p - a.p)[0];
    const topTrial = bestTrial ? { label: scoreLabel(bestTrial.s) || `${Math.round(bestTrial.p)}%`, title: bestTrial.s.title || '', percent: bestTrial.p } : null;
    const trialNotes = trials.map((s) => String(s.note || '').trim()).filter(Boolean).slice(0, 3);

    const crowns = Math.max(0, Number(prodigyWins) || 0);
    const palette = certificatePalette(guild, band);
    const periodLabel = scope === 'monthly' ? monthLabel(now) : (schoolYearLabel ? `School Year ${schoolYearLabel}` : `${now.getFullYear()}`);

    const honours = [];
    honours.push({ key: 'stars', icon: '⭐', value: formatNumber(stars), label: scope === 'monthly' ? 'Stars this month' : 'Stars on the journey' });
    if (virtue) honours.push({ key: 'virtue', icon: virtue.emoji, value: virtue.label, label: 'Shining virtue' });
    if (hero) honours.push({ key: 'hero', icon: hero.icon, value: hero.level > 0 ? `Level ${hero.level}` : 'Path begun', label: `${hero.className} path` });
    if (crowns > 0) honours.push({ key: 'prodigy', icon: '👑', value: crowns === 1 ? 'Crowned once' : `Crowned ×${crowns}`, label: 'Prodigy of the Month' });
    if (oath) honours.push({ key: 'oath', icon: '🔥', value: oath.count === 1 ? 'Oath kept' : `${oath.count} oaths kept`, label: 'Ember Oath' });
    if (topTrial) honours.push({ key: 'trial', icon: '📜', value: topTrial.label, label: 'Best trial' });
    if (familiar?.hatched) honours.push({ key: 'familiar', icon: familiarSigil(fam?.typeId), value: familiar.name, label: familiar.stage });
    if (treasures > 0) honours.push({ key: 'treasures', icon: '💎', value: String(treasures), label: treasures === 1 ? 'Treasure won' : 'Treasures won' });

    return {
        scope,
        band,
        palette,
        title: TITLES[band][scope],
        presentedTo: PRESENTED[band],
        crestIcon: scope === 'monthly' ? '⭐' : '🏆',
        eyebrow: scope === 'monthly' ? 'Monthly Quest' : "Legend's Journey",
        periodLabel,
        name: String(student.name || '').trim(),
        avatar: student.avatar || '',
        initial: String(student.name || '?').trim().charAt(0).toUpperCase() || '?',
        className: studentClass?.name || '',
        classLogo: studentClass?.logo || '🏰',
        league: studentClass?.questLevel || '',
        guild: guild ? { id: guild.id, name: guild.name, emoji: guild.emoji || '🛡️', motto: guild.motto || '', traits: guild.traits || [] } : null,
        hero,
        familiar,
        oath,
        virtue,
        topTrial,
        trialNotes,
        treasures,
        prodigyWins: crowns,
        stars,
        totalStars,
        honours: honours.slice(0, 6),
        allHonours: honours,
        teacherName: String(teacherName || '').trim(),
        schoolName: String(schoolName || '').trim(),
        dateLabel: `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`,
    };
}

function familiarSigil(typeId) {
    return { emberfang: '🐉', frostpaw: '🦊', thornback: '🐸', veilshade: '🦇', sparkling: '✨' }[typeId] || '🐾';
}

function formatNumber(n) {
    const v = Number(n) || 0;
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

// A "?" (unmarkable) trial has no score: it never counts as a percent.
function defaultScorePercent(s) {
    if (s?.unmarkable === true) return null;
    if (s?.normalizedPercent != null && s.normalizedPercent !== '' && Number.isFinite(Number(s.normalizedPercent))) return Number(s.normalizedPercent);
    const max = Number(s?.maxScore), val = Number(s?.scoreNumeric);
    return max > 0 && Number.isFinite(val) ? (val / max) * 100 : null;
}

function defaultScoreLabel(s) {
    if (s?.unmarkable === true) return '?';
    if (s?.scoreQualitative) return String(s.scoreQualitative);
    const max = Number(s?.maxScore);
    return max > 0 && Number.isFinite(Number(s?.scoreNumeric)) ? `${s.scoreNumeric}/${max}` : '';
}

// ─── AI prompt ───────────────────────────────────────────────────────────────

const VOICE = {
    early: 'a very young child (ages 5-7). Use tiny words, one idea per sentence, warm and magical. Write 1-2 very short sentences (under 30 words in total).',
    junior: 'a young child (ages 7-9). Use very simple English, short sentences and a cheerful, magical tone. Write 2 short sentences (under 40 words in total).',
    mid: 'a pre-teen (ages 9-12). Use positive language that sounds cool and adventurous, never babyish. Write 2 brief sentences (under 45 words in total).',
    senior: 'a teenager (ages 12+). Use clear, sincere, inspiring language, never childish. Write 2 brief, powerful sentences (under 50 words in total).',
};

/** System + user prompt for the citation, built only from facts the certificate also prints. */
export function buildCertificatePrompt(model) {
    const firstName = model.name.split(/\s+/)[0] || model.name;
    const period = model.scope === 'monthly' ? `this month (${model.periodLabel})` : `the whole school year${model.periodLabel ? ` (${model.periodLabel})` : ''}`;
    const system = `You write the citation on a fantasy-themed classroom achievement certificate in a world called "The Great Class Quest". The reader is ${VOICE[model.band]}
Speak directly to the student ("you"). Mention one or two of the real deeds you are given, and never invent achievements, numbers, grades or names.
Plain text only: no markdown, no quotation marks around the text, no emoji, no greeting and no sign-off.`;

    const facts = [
        `Student: ${firstName} (full name ${model.name}).`,
        `Class: "${model.className}"${model.league ? ` in the ${model.league} league` : ''}.`,
        `Period: ${period}.`,
        `Stars earned in this period: ${model.stars}${model.scope === 'monthly' && model.totalStars ? ` (${model.totalStars} on their whole journey)` : ''}.`,
    ];
    if (model.virtue) facts.push(`Strongest virtue: ${model.virtue.label}.`);
    if (model.guild) facts.push(`Guild: ${model.guild.name}, motto "${model.guild.motto}", known for ${model.guild.traits.join(', ') || 'courage'}.`);
    if (model.hero) {
        facts.push(`Hero path: ${model.hero.className}${model.hero.level > 0 ? `, level ${model.hero.level}, title "${model.hero.title}"` : ', just beginning'}.`);
        if (model.hero.skills.length) facts.push(`Skills learned: ${model.hero.skills.map((s) => s.name).join(', ')}.`);
        if (model.hero.legend) facts.push(`Fulfilled the Legend Quest "${model.hero.legend.quest}" and became a ${model.hero.legend.name}.`);
    }
    if (model.familiar?.hatched) facts.push(`Companion creature: ${model.familiar.name}, a ${model.familiar.stage}.`);
    if (model.oath) facts.push(model.oath.text ? `Kept an Ember Oath (a personal promise): "${model.oath.text}".` : 'Kept a personal Ember Oath (keep its contents private).');
    if (model.prodigyWins > 0) facts.push(`Crowned Prodigy of the Month ${model.prodigyWins === 1 ? 'once' : `${model.prodigyWins} times`} this school year.`);
    if (model.topTrial) facts.push(`Best trial result: ${model.topTrial.label}${model.topTrial.title ? ` in "${model.topTrial.title}"` : ''}.`);
    if (model.trialNotes.length) facts.push(`Teacher notes: ${model.trialNotes.map((n) => `"${n}"`).join('; ')}.`);

    const user = `Write the certificate citation using these facts:\n${facts.map((f) => `- ${f}`).join('\n')}\nMake it feel like a proud moment from their adventure.`;
    return { system, user };
}

/** Clean a model reply into one printable paragraph. */
export function cleanCitation(text, maxLength = 320) {
    let t = String(text || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/[*_#>`~]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    t = t.replace(/^["“'‘]+|["”'’]+$/g, '').trim();
    if (t.length > maxLength) {
        const cut = t.slice(0, maxLength);
        const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
        t = end > maxLength * 0.5 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
    }
    return t;
}

// ─── Markup ──────────────────────────────────────────────────────────────────

export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const CORNER_SVG = (c) => `<svg viewBox="0 0 90 90" width="90" height="90" aria-hidden="true"><path d="M8 84V28Q8 8 28 8h56" fill="none" stroke="${c.gold}" stroke-width="2.2"/><path d="M15 84V31q0-16 16-16h53" fill="none" stroke="${c.gold}" stroke-width=".9" opacity=".7"/><path d="M31 22c9-1 13 6 8 11-3 3-7 0-5-3M22 31c-1 9 6 13 11 8 3-3 0-7-3-5" fill="none" stroke="${c.gold}" stroke-width="1.5" stroke-linecap="round"/><path d="M18 8.5 27.5 18 18 27.5 8.5 18Z" fill="${c.primary}" stroke="${c.goldLight}" stroke-width="1.6"/><circle cx="18" cy="18" r="2.6" fill="${c.goldLight}"/><circle cx="48" cy="11.5" r="1.6" fill="${c.gold}"/><circle cx="11.5" cy="48" r="1.6" fill="${c.gold}"/></svg>`;

const SEAL_SVG = (c) => `<svg viewBox="0 0 120 120" width="118" height="118" aria-hidden="true"><path d="M60 4l9 7 11-3 5 10 11 2 1 11 9 6-4 10 6 9-7 8 2 11-10 4-3 11-11-1-7 9-9-6-10 5-6-9-11 0-2-11-10-4 2-11-7-8 6-9-4-10 9-6 1-11 11-2 5-10 11 3z" fill="${c.primary}"/><circle cx="60" cy="60" r="41" fill="${c.ink}" opacity=".28"/><circle cx="60" cy="60" r="38" fill="none" stroke="${c.goldLight}" stroke-width="2"/><circle cx="60" cy="60" r="33" fill="none" stroke="${c.goldLight}" stroke-width="1" stroke-dasharray="2 3"/></svg>`;

const RIBBON_SVG = (c) => `<svg viewBox="0 0 120 70" width="96" height="56" aria-hidden="true"><path d="M30 0h24l-6 70-15-14-14 10z" fill="${c.secondary}"/><path d="M66 0h24l7 66-14-10-15 14z" fill="${c.primary}"/></svg>`;

const LAUREL_SVG = (c, flip = false) => `<svg viewBox="0 0 60 120" width="46" height="92" aria-hidden="true" style="${flip ? 'transform:scaleX(-1);' : ''}"><path d="M48 116C18 96 10 60 26 8" fill="none" stroke="${c.gold}" stroke-width="2.2" stroke-linecap="round"/>${[18, 34, 50, 66, 82, 98].map((y, i) => `<ellipse cx="${30 - i * 1.6}" cy="${y}" rx="9" ry="4.2" transform="rotate(${-38 + i * 4} ${30 - i * 1.6} ${y})" fill="${i % 2 ? c.gold : c.goldLight}"/><ellipse cx="${40 - i * 0.8}" cy="${y + 6}" rx="8" ry="3.6" transform="rotate(${30 - i * 3} ${40 - i * 0.8} ${y + 6})" fill="${i % 2 ? c.goldLight : c.gold}"/>`).join('')}</svg>`;

/**
 * Inner markup of #certificate-template. Element ids are kept stable (cert-title, cert-student-name,
 * cert-text, cert-avatar, cert-guild-emblem, cert-teacher-name, cert-date, cert-app-logo, …) so
 * callers and the guidebook capture can still find them. `assets` carries resolved image URLs.
 */
export function renderCertificateInner(model, { citation = '', placeholder = '', assets = {} } = {}) {
    const c = model.palette;
    const e = escapeHtml;
    const hero = model.hero;
    const guild = model.guild;
    const citationHtml = citation
        ? e(citation)
        : `<span class="gcq-cert__placeholder">${e(placeholder || 'The Oracle’s citation will be inscribed here.')}</span>`;

    const avatar = model.avatar
        ? `<img id="cert-avatar" data-cert-stamp="circle" src="${e(assets.avatar || model.avatar)}" alt="" loading="eager" decoding="sync" class="gcq-cert__avatar-img">`
        : `<img id="cert-avatar" src="" alt="" style="display:none"><span class="gcq-cert__avatar-initial">${e(model.initial)}</span>`;

    const emblem = guild && assets.guildEmblem
        ? `<img id="cert-guild-emblem" data-cert-stamp="contain" src="${e(assets.guildEmblem)}" alt="" loading="eager" decoding="sync" class="gcq-cert__emblem-img">`
        : `<img id="cert-guild-emblem" src="" alt="" style="display:none"><span class="gcq-cert__emblem-emoji">${e(guild?.emoji || model.classLogo)}</span>`;

    const pillIds = { stars: 'cert-stars-pill', virtue: 'cert-virtue-pill', hero: 'cert-hero-pill' };
    const honours = model.honours.map((h) => `
        <div class="gcq-cert__honour"${pillIds[h.key] ? ` id="${pillIds[h.key]}"` : ''}>
            <span class="gcq-cert__honour-icon">${e(h.icon)}</span>
            <span class="gcq-cert__honour-value">${e(h.value)}</span>
            <span class="gcq-cert__honour-label">${e(h.label)}</span>
        </div>`).join('');

    const skills = hero?.skills?.length
        ? `<span class="gcq-cert__skills-label">Skills mastered</span>${hero.skills.map((s) => `<span class="gcq-cert__skill">${e(s.icon)} ${e(s.name)}</span>`).join('<span class="gcq-cert__skill-sep">✦</span>')}`
        : '';

    const legendLine = hero?.legend
        ? `<p id="cert-legend" class="gcq-cert__legend"><span class="gcq-cert__legend-crown">👑</span>${e(hero.legend.name)}<span class="gcq-cert__legend-sub">Legend Quest fulfilled: ${e(hero.legend.quest)}</span></p>`
        : '';

    const metaBits = [
        `${model.classLogo} ${model.className}`.trim(),
        model.league ? `${model.league} League` : '',
        model.scope === 'monthly' && model.totalStars ? `${model.totalStars} stars on the journey` : '',
    ].filter(Boolean);

    return `
        <div class="gcq-cert__paper">
            <div class="gcq-cert__rule gcq-cert__rule--outer"></div>
            <div class="gcq-cert__rule gcq-cert__rule--gold"></div>
            <div class="gcq-cert__rule gcq-cert__rule--inner"></div>
            <div id="cert-corner-tl" class="gcq-cert__corner gcq-cert__corner--tl">${CORNER_SVG(c)}</div>
            <div id="cert-corner-tr" class="gcq-cert__corner gcq-cert__corner--tr">${CORNER_SVG(c)}</div>
            <div id="cert-corner-bl" class="gcq-cert__corner gcq-cert__corner--bl">${CORNER_SVG(c)}</div>
            <div id="cert-corner-br" class="gcq-cert__corner gcq-cert__corner--br">${CORNER_SVG(c)}</div>

            <header class="gcq-cert__head">
                <div class="gcq-cert__banner">
                    <img id="cert-app-logo" data-cert-stamp="contain" class="gcq-cert__logo" src="${e(assets.appLogo || '')}" alt="" loading="eager" decoding="sync"${assets.appLogo ? '' : ' style="display:none"'}>
                    <span>The Great Class Quest</span>
                    <span class="gcq-cert__banner-dot">•</span>
                    <span>${e(model.eyebrow)}</span>
                </div>
                <div class="gcq-cert__crest-row">
                    <span class="gcq-cert__laurel">${LAUREL_SVG(c)}</span>
                    <div id="cert-icon" class="gcq-cert__crest">${e(model.crestIcon)}</div>
                    <span class="gcq-cert__laurel">${LAUREL_SVG(c, true)}</span>
                </div>
                <h1 id="cert-title" class="gcq-cert__title">${e(model.title)}</h1>
                <p class="gcq-cert__period">${e(model.periodLabel)}</p>
            </header>

            <section class="gcq-cert__body">
                <div class="gcq-cert__side gcq-cert__side--hero">
                    <div class="gcq-cert__medallion">
                        <div class="gcq-cert__medallion-ring">${avatar}</div>
                        ${hero ? `<span class="gcq-cert__medallion-badge">${e(hero.icon)}</span>` : ''}
                    </div>
                    <p class="gcq-cert__side-title">${e(hero ? hero.title : 'Rising Hero')}</p>
                    <p class="gcq-cert__side-sub">${e(hero ? `${hero.className}${hero.level > 0 ? ` · Level ${hero.level}` : ''}` : (model.league ? `${model.league} League` : 'Hero of the Quest'))}</p>
                </div>

                <div class="gcq-cert__center">
                    <p class="gcq-cert__presented">${e(model.presentedTo)}</p>
                    <p id="cert-student-name" class="gcq-cert__name">${e(model.name)}</p>
                    <div class="gcq-cert__flourish"><span></span><i>❦</i><span></span></div>
                    <div id="cert-text" class="gcq-cert__citation">${citationHtml}</div>
                </div>

                <div class="gcq-cert__side gcq-cert__side--guild" id="cert-guild-pill">
                    <div class="gcq-cert__shield">${emblem}</div>
                    <p class="gcq-cert__side-title">${e(guild ? guild.name : model.className)}</p>
                    <p class="gcq-cert__side-sub">${e(guild ? (guild.motto || 'Guild of the Quest') : 'Class of the Quest')}</p>
                </div>
            </section>

            <div id="cert-badges" class="gcq-cert__honours">${honours}</div>
            <div id="cert-flair-row" class="gcq-cert__skills">${skills}</div>
            ${legendLine}
            <p id="cert-meta" class="gcq-cert__meta"><span id="cert-class-name">${e(metaBits[0] || '')}</span>${metaBits.slice(1).map((b, i) => `<span class="gcq-cert__meta-dot">•</span><span${i === 0 && model.league ? ' id="cert-league-pill"' : ''}>${e(b)}</span>`).join('')}</p>

            <footer class="gcq-cert__foot">
                <div class="gcq-cert__sign">
                    <p id="cert-teacher-name" class="gcq-cert__sign-name">${e(model.teacherName)}</p>
                    <p class="gcq-cert__sign-label">Quest Master</p>
                </div>
                <div class="gcq-cert__seal">
                    <div class="gcq-cert__seal-ribbon">${RIBBON_SVG(c)}</div>
                    <div class="gcq-cert__seal-wax">${SEAL_SVG(c)}<span class="gcq-cert__seal-mark">${e(guild?.emoji || model.crestIcon)}</span></div>
                    <p class="gcq-cert__school" data-school-name>${e(model.schoolName || 'Your School')}</p>
                </div>
                <div class="gcq-cert__sign">
                    <p id="cert-date" class="gcq-cert__sign-name">${e(model.dateLabel)}</p>
                    <p class="gcq-cert__sign-label">Date of Issue</p>
                </div>
            </footer>
        </div>`;
}

/** CSS custom properties that theme the certificate root. */
export function certificateStyleVars(model) {
    const c = model.palette;
    return `--cert-primary:${c.primary};--cert-secondary:${c.secondary};--cert-ink:${c.ink};--cert-wash:${c.wash};--cert-gold:${c.gold};--cert-gold-light:${c.goldLight};--cert-paper:${c.paper};--cert-paper-edge:${c.paperEdge};--cert-text:${c.text};`;
}

export const CERTIFICATE_WIDTH = 1123;
export const CERTIFICATE_HEIGHT = 794;
