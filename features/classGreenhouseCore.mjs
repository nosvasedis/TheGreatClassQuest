// features/classGreenhouseCore.mjs
// The Class Greenhouse's reading engine: the whole-class companion to the Hero's Chronicle.
// It reads every child's recent stars, papers, attendance and Chronicle notes, places each
// child on the growth map (effort against achievement), raises the signals a teacher should
// act on, and turns all of it into a class reading, a next-lesson plan and matched techniques.
// Pure: no DOM, no Firebase. The modal (ui/modals/classGreenhouse.js) gathers the records.
//
// Input records (already reduced by the caller):
//   students  [{ id, name, avatar?, heroClass?, guildId? }]
//   awards    [{ studentId, date, stars, reason }]          date: DD-MM-YYYY or YYYY-MM-DD
//   trials    [{ studentId, date, pct, type, title }]       pct 0..100 or null
//   absences  [{ studentId, date }]
//   notes     [{ studentId, category, createdAtMs, text? }]
//   oaths     [{ studentId, status }]                      optional

import { VIRTUE_TECHNIQUES, getTechnique } from './classGreenhousePlaybook.mjs';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const WINDOW_DAYS = 42;   // six weeks: the growing season the reading looks at
export const RECENT_DAYS = 14;   // the last two weeks, compared with the four before

export const VIRTUES = [
    { id: 'teamwork', label: 'Teamwork', icon: 'fa-users' },
    { id: 'creativity', label: 'Creativity', icon: 'fa-lightbulb' },
    { id: 'respect', label: 'Respect', icon: 'fa-handshake' },
    { id: 'focus', label: 'Focus', icon: 'fa-bullseye' }
];
const VIRTUE_IDS = new Set(VIRTUES.map((v) => v.id));

// Rows that are not a teacher noticing a child (attendance bookkeeping, wheel luck, fixes).
const NOT_RECOGNITION = new Set(['marked_present', 'wheel_fortune', 'wheel_curse', 'correction', 'pathfinder_map', 'welcome_back']);

/** The five growth profiles: where a child sits on the growth map. */
export const PROFILES = {
    bloom: { id: 'bloom', label: 'In full bloom', short: 'Bloom', icon: 'fa-sun',
        meaning: 'Working hard and doing well. Keep them challenged so they keep growing.' },
    reaching: { id: 'reaching', label: 'Reaching for light', short: 'Reaching', icon: 'fa-arrow-up-long',
        meaning: 'Trying hard, but the papers do not show it yet. They need scaffolds, not more pressure.' },
    roots: { id: 'roots', label: 'Quiet roots', short: 'Quiet roots', icon: 'fa-water',
        meaning: 'Capable, but rarely noticed in lessons. Draw them into the light.' },
    tending: { id: 'tending', label: 'Needs tending', short: 'Tending', icon: 'fa-hand-holding-droplet',
        meaning: 'Low on effort and on results. Small wins and a personal check-in first.' },
    steady: { id: 'steady', label: 'Steady growth', short: 'Steady', icon: 'fa-seedling',
        meaning: 'Growing at a steady pace, close to the middle of the class.' },
    planted: { id: 'planted', label: 'Just planted', short: 'New', icon: 'fa-leaf',
        meaning: 'Not enough records yet to read. Give it a couple of lessons.' }
};
export const PROFILE_ORDER = ['tending', 'reaching', 'roots', 'steady', 'bloom', 'planted'];

// ---------------------------------------------------------------- small helpers

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const sd = (xs) => {
    if (xs.length < 2) return 0;
    const m = mean(xs);
    return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length);
};
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function firstName(name) {
    return String(name || '').trim().split(/\s+/)[0] || 'This hero';
}

/** Day number (days since 1970-01-01, calendar date only) for DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD or a Date/ms. */
export function toDay(value) {
    if (value == null || value === '') return null;
    if (value instanceof Date) return Math.floor(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / DAY_MS);
    if (typeof value === 'number') return toDay(new Date(value));
    const s = String(value).trim();
    let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m) return Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY_MS);
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (m) return Math.floor(Date.UTC(+m[3], +m[2] - 1, +m[1]) / DAY_MS);
    return null;
}

export function dayLabel(day) {
    const d = new Date(day * DAY_MS);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** Gini coefficient of a list of non-negative amounts: 0 = perfectly shared, 1 = one child has it all. */
export function gini(values) {
    const xs = values.map((v) => Math.max(0, Number(v) || 0)).sort((a, b) => a - b);
    const n = xs.length;
    const total = xs.reduce((a, b) => a + b, 0);
    if (n < 2 || total === 0) return 0;
    let weighted = 0;
    xs.forEach((x, i) => { weighted += (i + 1) * x; });
    return (2 * weighted) / (n * total) - (n + 1) / n;
}

function zoneOf(z, known = true) {
    if (!known) return 'unknown';
    if (z > 0.35) return 'hi';
    if (z < -0.35) return 'lo';
    return 'mid';
}

export function profileFor(effortZone, achZone) {
    if (effortZone === 'hi' && achZone !== 'lo') return 'bloom';
    if (effortZone === 'mid' && achZone === 'hi') return 'bloom';
    if (achZone === 'lo' && effortZone !== 'lo') return 'reaching';
    if (effortZone === 'lo' && achZone === 'lo') return 'tending';
    if (effortZone === 'lo') return 'roots';
    return 'steady';
}

// ---------------------------------------------------------------- the reading

/**
 * Builds the whole Greenhouse reading.
 * @returns {{ today, lessons, students, classReading, plan, fingerprint }}
 */
export function buildGreenhouse({
    students = [], awards = [], trials = [], absences = [], notes = [], oaths = [], now = new Date()
} = {}) {
    const today = toDay(now);
    const windowStart = today - WINDOW_DAYS + 1;
    const recentStart = today - RECENT_DAYS + 1;
    const ids = new Set(students.map((s) => s.id));

    const inWindow = (d) => d != null && d >= windowStart && d <= today;

    // --- normalise records ---
    const awardRows = awards
        .map((a) => ({ studentId: a.studentId, day: toDay(a.date), stars: Number(a.stars) || 0, reason: String(a.reason || '') }))
        .filter((a) => ids.has(a.studentId) && a.day != null && a.day <= today);
    const absenceRows = absences
        .map((a) => ({ studentId: a.studentId, day: toDay(a.date) }))
        .filter((a) => ids.has(a.studentId) && a.day != null && a.day <= today);
    const trialRows = trials
        .map((t) => ({
            studentId: t.studentId,
            day: toDay(t.date),
            pct: Number.isFinite(Number(t.pct)) && t.pct !== null ? Math.max(0, Math.min(100, Number(t.pct))) : null,
            type: String(t.type || 'test'),
            title: String(t.title || '').trim()
        }))
        .filter((t) => ids.has(t.studentId) && t.day != null && t.day <= today);
    const noteRows = notes
        .map((n) => ({ studentId: n.studentId, day: toDay(n.createdAtMs ?? n.date), category: String(n.category || 'General') }))
        .filter((n) => ids.has(n.studentId) && n.day != null);

    // --- lesson days: any day the class has records for, inside the window ---
    const lessonSet = new Set();
    awardRows.forEach((a) => { if (inWindow(a.day)) lessonSet.add(a.day); });
    absenceRows.forEach((a) => { if (inWindow(a.day)) lessonSet.add(a.day); });
    trialRows.forEach((t) => { if (inWindow(t.day)) lessonSet.add(t.day); });
    const lessonDays = [...lessonSet].sort((a, b) => a - b);
    const recentLessons = lessonDays.filter((d) => d >= recentStart);
    const priorLessons = lessonDays.filter((d) => d < recentStart);

    // --- papers: one per title/day/type; the class result of each ---
    const papers = new Map();
    trialRows.forEach((t) => {
        const key = `${t.day}|${t.type}|${t.title.toLowerCase()}`;
        t.key = key;
        if (!papers.has(key)) papers.set(key, { key, day: t.day, type: t.type, title: t.title, marks: [] });
        if (t.pct != null) papers.get(key).marks.push({ studentId: t.studentId, pct: t.pct });
    });
    papers.forEach((p) => { p.avg = mean(p.marks.map((m) => m.pct)); });
    const paperList = [...papers.values()].sort((a, b) => a.day - b.day);

    // --- per child ---
    const byStudent = (rows) => {
        const map = new Map(students.map((s) => [s.id, []]));
        rows.forEach((r) => map.get(r.studentId)?.push(r));
        return map;
    };
    const awardsBy = byStudent(awardRows);
    const absencesBy = byStudent(absenceRows);
    const trialsBy = byStudent(trialRows);
    const notesBy = byStudent(noteRows);
    const oathsBy = byStudent(oaths.filter((o) => ids.has(o.studentId)));

    const readings = students.map((s) => readStudent({
        student: s,
        awards: awardsBy.get(s.id),
        absences: absencesBy.get(s.id),
        trials: trialsBy.get(s.id),
        notes: notesBy.get(s.id),
        oaths: oathsBy.get(s.id),
        papers: paperList,
        lessonDays, recentLessons, priorLessons, today, windowStart, recentStart
    }));

    placeOnGrowthMap(readings);
    readings.forEach((r) => raiseSignals(r, { today }));

    const classReading = readClass(readings, {
        lessonDays, recentLessons, priorLessons, papers: paperList, awards: awardRows, absences: absenceRows,
        today, windowStart, recentStart
    });
    const plan = planNextLesson(readings, classReading);

    readings.sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));

    return {
        today,
        lessons: { all: lessonDays.length, recent: recentLessons.length, prior: priorLessons.length, last: lessonDays[lessonDays.length - 1] ?? null },
        students: readings,
        classReading,
        plan,
        fingerprint: fingerprintOf(readings, classReading)
    };
}

function readStudent({ student, awards, absences, trials, notes, oaths, papers, lessonDays, recentLessons, priorLessons, today, windowStart, recentStart }) {
    const absentDays = new Set(absences.map((a) => a.day));
    const present = (days) => days.filter((d) => !absentDays.has(d));
    const presentAll = present(lessonDays);
    const presentRecent = present(recentLessons);
    const presentPrior = present(priorLessons);

    // Stars
    const recognition = awards.filter((a) => a.stars > 0 && !NOT_RECOGNITION.has(a.reason) && a.day >= windowStart);
    const sumStars = (from, to) => recognition.filter((a) => a.day >= from && a.day <= to).reduce((t, a) => t + a.stars, 0);
    const starsWindow = sumStars(windowStart, today);
    const starsRecent = sumStars(recentStart, today);
    const starsPrior = sumStars(windowStart, recentStart - 1);
    const perLessonRecent = presentRecent.length ? starsRecent / presentRecent.length : null;
    const perLessonPrior = presentPrior.length ? starsPrior / presentPrior.length : null;
    const perLesson = presentAll.length ? starsWindow / presentAll.length : null;
    // Effort weights the last two weeks double: today's child matters more than last month's.
    const effort = perLessonRecent != null && perLessonPrior != null
        ? (2 * perLessonRecent + perLessonPrior) / 3
        : (perLessonRecent ?? perLessonPrior ?? null);

    const starDays = new Set(recognition.map((a) => a.day));
    const lastStarDay = recognition.length ? Math.max(...recognition.map((a) => a.day)) : null;
    const lessonsWithoutStar = presentAll.filter((d) => lastStarDay == null || d > lastStarDay).length;

    const weekly = Array.from({ length: 6 }, (_, i) => {
        const from = today - (6 - i) * 7 + 1;
        return round1(sumStars(from, from + 6));
    });

    const virtues = Object.fromEntries(VIRTUES.map((v) => [v.id, 0]));
    recognition.forEach((a) => { if (VIRTUE_IDS.has(a.reason)) virtues[a.reason] += a.stars; });
    const virtueTotal = Object.values(virtues).reduce((a, b) => a + b, 0);
    const topVirtue = virtueTotal > 0 ? VIRTUES.reduce((best, v) => (virtues[v.id] > virtues[best.id] ? v : best), VIRTUES[0]) : null;

    // Papers
    const marked = trials.filter((t) => t.pct != null).sort((a, b) => a.day - b.day);
    const avgPct = mean(marked.map((t) => t.pct));
    const rel = marked
        .map((t) => papers.find((p) => p.key === t.key))
        .map((p, i) => (p && p.marks.length >= 2 ? marked[i].pct - p.avg : null))
        .filter((x) => x != null);
    const relIndex = rel.length ? mean(rel) : null;
    let gradeTrend = null;
    if (marked.length >= 4) {
        const recentN = Math.min(3, Math.ceil(marked.length / 2));
        const recentMarks = marked.slice(-recentN).map((t) => t.pct);
        const earlierMarks = marked.slice(Math.max(0, marked.length - recentN - 3), marked.length - recentN).map((t) => t.pct);
        gradeTrend = mean(recentMarks) - mean(earlierMarks);
    }
    const typeAvg = (type) => mean(marked.filter((t) => t.type === type).map((t) => t.pct));
    const best = marked.length ? marked.reduce((b, t) => (t.pct > b.pct ? t : b), marked[0]) : null;
    const latest = marked.length ? marked[marked.length - 1] : null;

    // Whole-class papers in the last two months this child has no mark for
    const firstSeen = Math.min(
        ...[...awards.map((a) => a.day), ...trials.map((t) => t.day), ...absences.map((a) => a.day)].filter((d) => d != null),
        Infinity
    );
    const mine = new Set(trials.map((t) => t.key));
    const missedPapers = papers
        .filter((p) => p.day >= today - 60 && p.day >= firstSeen && p.marks.length >= 2 && !mine.has(p.key))
        .map((p) => ({ title: p.title || (p.type === 'dictation' ? 'Dictation' : 'Test'), day: p.day, type: p.type, wasAbsent: absentDays.has(p.day) }));

    // Attendance
    const absWindow = lessonDays.filter((d) => absentDays.has(d)).length;
    let absentStreak = 0;
    for (let i = lessonDays.length - 1; i >= 0 && absentDays.has(lessonDays[i]); i -= 1) absentStreak += 1;
    const attendanceRate = lessonDays.length ? 1 - absWindow / lessonDays.length : null;
    const absentLastLesson = lessonDays.length > 0 && absentDays.has(lessonDays[lessonDays.length - 1]);

    // Chronicle notes
    const noteDays = notes.map((n) => n.day).filter((d) => d != null);
    const lastNoteDay = noteDays.length ? Math.max(...noteDays) : null;
    const behaviourNotes = notes.filter((n) => n.category === 'Behavior' && n.day >= today - 30).length;

    // Ember oaths
    const oathsActive = oaths.filter((o) => o.status === 'active' || o.status === 'pending').length;
    const oathsKept = oaths.filter((o) => o.status === 'kept' || o.status === 'fulfilled').length;

    return {
        id: student.id,
        name: student.name,
        first: firstName(student.name),
        avatar: student.avatar || '',
        heroClass: student.heroClass || '',
        guildId: student.guildId || '',
        stars: {
            window: round1(starsWindow), recent: round1(starsRecent), prior: round1(starsPrior),
            perLesson: perLesson == null ? null : round1(perLesson),
            perLessonRecent: perLessonRecent == null ? null : round1(perLessonRecent),
            perLessonPrior: perLessonPrior == null ? null : round1(perLessonPrior),
            effort, lastStarDay, lessonsWithoutStar, weekly, starDays: starDays.size
        },
        virtues, virtueTotal, topVirtue,
        papers: {
            count: marked.length,
            avg: avgPct == null ? null : Math.round(avgPct),
            rel: relIndex == null ? null : Math.round(relIndex),
            trend: gradeTrend == null ? null : Math.round(gradeTrend),
            test: typeAvg('test') == null ? null : Math.round(typeAvg('test')),
            dictation: typeAvg('dictation') == null ? null : Math.round(typeAvg('dictation')),
            best: best ? { title: best.title, pct: Math.round(best.pct), day: best.day } : null,
            latest: latest ? { title: latest.title, pct: Math.round(latest.pct), day: latest.day } : null,
            series: marked.slice(-8).map((t) => Math.round(t.pct)),
            missed: missedPapers
        },
        attendance: {
            lessons: lessonDays.length, present: presentAll.length, absences: absWindow,
            rate: attendanceRate, streak: absentStreak, absentLastLesson
        },
        notes: {
            total: notes.length,
            lastDay: lastNoteDay,
            daysSince: lastNoteDay == null ? null : today - lastNoteDay,
            behaviour30: behaviourNotes
        },
        oaths: { active: oathsActive, kept: oathsKept },
        hasData: presentAll.length >= 2 || marked.length >= 1
    };
}

/** Effort and achievement as z-scores within the class; zones, profile and map position follow. */
function placeOnGrowthMap(readings) {
    const effortKnown = readings.filter((r) => r.stars.effort != null);
    const effortVals = effortKnown.map((r) => r.stars.effort);
    const eMean = mean(effortVals) ?? 0;
    const eSd = sd(effortVals);

    const achOf = (r) => (r.papers.rel != null ? r.papers.rel : null);
    // Without paper-by-paper comparisons, fall back to distance from the class average mark.
    const avgs = readings.map((r) => r.papers.avg).filter((x) => x != null);
    const classAvg = mean(avgs);
    const achVals = readings.map((r) => achOf(r) ?? (r.papers.avg != null && classAvg != null ? r.papers.avg - classAvg : null));
    const known = achVals.filter((x) => x != null);
    const aMean = mean(known) ?? 0;
    const aSd = sd(known);

    readings.forEach((r, i) => {
        const ez = r.stars.effort != null && eSd > 0.05 ? (r.stars.effort - eMean) / eSd : 0;
        const ach = achVals[i];
        const az = ach != null && aSd > 1 ? (ach - aMean) / aSd : 0;
        r.effortZ = round1(ez);
        r.achZ = ach != null ? round1(az) : null;
        r.zones = { effort: zoneOf(ez, r.stars.effort != null), ach: zoneOf(az, ach != null) };
        if (r.zones.effort === 'unknown') r.zones.effort = 'mid';
        r.profile = r.hasData ? profileFor(r.zones.effort, r.zones.ach) : 'planted';
        // Map position 0..1 on each axis (clamped at ±2 sd); unknown achievement sits on the middle line.
        r.map = {
            x: Math.max(0, Math.min(1, 0.5 + ez / 4)),
            y: r.achZ == null ? 0.5 : Math.max(0, Math.min(1, 0.5 + az / 4)),
            achKnown: r.achZ != null
        };
    });
}

/**
 * Signals: things to act on (severity 1-3) and things to celebrate (kind 'good').
 * Every signal is a plain sentence the teacher can read at a glance.
 */
function raiseSignals(r, { today }) {
    const signals = [];
    const add = (id, sev, icon, text, techniques = []) => signals.push({ id, sev, icon, text, techniques, kind: sev > 0 ? 'act' : 'good' });
    const s = r.stars;
    const p = r.papers;
    const a = r.attendance;

    if (r.hasData && s.lessonsWithoutStar >= 3) {
        add('unseen', s.lessonsWithoutStar >= 5 ? 3 : 2, 'fa-eye-slash',
            s.lastStarDay == null
                ? `No star in the last ${plural(s.lessonsWithoutStar, 'lesson')} they attended.`
                : `${plural(s.lessonsWithoutStar, 'lesson')} without a star (last one ${dayLabel(s.lastStarDay)}).`,
            ['name-cards', 'two-by-ten']);
    }
    if (s.perLessonPrior != null && s.perLessonRecent != null && s.perLessonPrior >= 0.6
        && s.perLessonRecent <= s.perLessonPrior * 0.5 && r.attendance.present >= 3) {
        add('wilting', 2, 'fa-arrow-trend-down',
            `Stars fell from ${s.perLessonPrior} to ${s.perLessonRecent} a lesson in the last two weeks.`,
            ['check-in', 'promise-chat']);
    }
    if (s.perLessonPrior != null && s.perLessonRecent != null && s.perLessonRecent >= s.perLessonPrior * 1.5
        && s.perLessonRecent - s.perLessonPrior >= 0.5) {
        add('sprouting', 0, 'fa-arrow-trend-up',
            `Stars rising: ${s.perLessonRecent} a lesson now, up from ${s.perLessonPrior}.`, ['specific-praise']);
    }
    if (p.trend != null && p.trend <= -10) {
        add('grades-down', p.trend <= -20 ? 3 : 2, 'fa-chart-line',
            `Recent papers ${Math.abs(p.trend)} points lower than the ones before.`,
            ['check-in', 'retrieval-starter', 'chunk-task']);
    }
    if (p.trend != null && p.trend >= 10) {
        add('grades-up', 0, 'fa-ranking-star', `Recent papers ${p.trend} points higher than before.`, ['postcard-home']);
    }
    if (p.avg != null && p.avg < 50 && p.count >= 2) {
        add('low-marks', 2, 'fa-life-ring', `Papers average ${p.avg}%.`, ['pre-teach', 'success-first', 'sentence-frames']);
    }
    if (a.streak >= 2) {
        add('absent-streak', a.streak >= 3 ? 3 : 2, 'fa-door-closed',
            `Absent the last ${plural(a.streak, 'lesson')} in a row.`,
            a.streak >= 3 ? ['family-check', 'welcome-back'] : ['welcome-back', 'missed-it-card']);
    } else if (a.rate != null && a.lessons >= 4 && a.rate < 0.75) {
        add('attendance', 2, 'fa-calendar-xmark',
            `Missed ${a.absences} of the last ${a.lessons} lessons.`, ['missed-it-card', 'welcome-back']);
    } else if (a.absentLastLesson) {
        add('absent-last', 1, 'fa-door-open', 'Was absent last lesson.', ['welcome-back']);
    }
    if (p.missed.length) {
        add('missed-papers', p.missed.length >= 2 ? 2 : 1, 'fa-file-circle-question',
            `No mark for ${p.missed.length === 1 ? `"${p.missed[0].title}"` : plural(p.missed.length, 'class paper')}.`,
            ['catch-up-paper']);
    }
    if (r.notes.behaviour30 >= 2) {
        add('behaviour', 2, 'fa-masks-theater',
            `${r.notes.behaviour30} behaviour notes in the last 30 days.`, ['restorative-chat', 'seat-near']);
    }
    if (r.hasData && (r.notes.daysSince == null || r.notes.daysSince > 45)) {
        add('unnoted', 1, 'fa-feather-pointed',
            r.notes.daysSince == null ? 'No Chronicle notes yet.' : `No Chronicle note for ${r.notes.daysSince} days.`,
            ['chronicle-sweep']);
    }
    if (r.virtueTotal >= 8 && r.topVirtue && r.virtues[r.topVirtue.id] / r.virtueTotal >= 0.8) {
        const other = VIRTUES.filter((v) => v.id !== r.topVirtue.id).sort((x, y) => r.virtues[x.id] - r.virtues[y.id])[0];
        add('one-virtue', 0, r.topVirtue.icon,
            `Almost always starred for ${r.topVirtue.label}. Watch for ${other.label} too.`, VIRTUE_TECHNIQUES[other.id] || []);
    }
    if (a.lessons >= 6 && a.absences === 0) add('present', 0, 'fa-calendar-check', `Present at all ${a.lessons} lessons.`);
    if (p.best && p.best.pct >= 90) add('best-paper', 0, 'fa-medal', `Best paper: ${p.best.pct}% in ${p.best.title || 'a paper'}.`);
    if (r.oaths.kept > 0) add('oath-kept', 0, 'fa-fire', `Kept ${plural(r.oaths.kept, 'Ember Oath')}.`);

    signals.sort((x, y) => y.sev - x.sev);
    r.signals = signals;
    const profileWeight = { tending: 3, reaching: 2, roots: 2, steady: 0, bloom: 0, planted: 0 }[r.profile] || 0;
    r.priority = signals.reduce((t, x) => t + x.sev, 0) + profileWeight;
    r.summary = studentSummary(r);
    r.techniques = studentTechniques(r);
    r.action = studentAction(r);
}

const PROFILE_TECHNIQUES = {
    bloom: ['must-should-could', 'expert-role', 'extension-question'],
    reaching: ['pre-teach', 'chunk-task', 'sentence-frames'],
    roots: ['name-cards', 'choral-drill', 'expert-role'],
    tending: ['two-by-ten', 'success-first', 'check-in'],
    steady: ['specific-praise', 'think-pair-share', 'retrieval-starter'],
    planted: ['welcome-back', 'buddy', 'chronicle-sweep']
};

function studentTechniques(r) {
    const ids = [];
    r.signals.filter((s) => s.kind === 'act').forEach((s) => s.techniques.forEach((t) => ids.push(t)));
    (PROFILE_TECHNIQUES[r.profile] || []).forEach((t) => ids.push(t));
    return [...new Set(ids)].filter((id) => getTechnique(id)).slice(0, 3);
}

/** The one thing to do for this child next lesson. */
function studentAction(r) {
    const top = r.signals.find((s) => s.kind === 'act' && s.sev >= 2);
    const name = r.first;
    const byId = {
        'absent-streak': `Welcome ${name} back by name and give a two-minute "what you missed".`,
        attendance: `Hand ${name} a "what you missed" card and check the homework is clear.`,
        'absent-last': `Tell ${name} the one thing they missed last lesson.`,
        unseen: `Catch ${name} doing something right in the first ten minutes and give a star.`,
        wilting: `Quiet check-in with ${name} during pair work: "What is tricky today?"`,
        'grades-down': `Ask ${name} one question from the last unit and see where it slips.`,
        'low-marks': `Give ${name} the key words before the task, and an easy first win.`,
        'missed-papers': `Give ${name} the catch-up for "${r.papers.missed[0]?.title || 'the missed paper'}".`,
        behaviour: `Teach from beside ${name} at the start of tasks; one calm word, not a warning.`,
        unnoted: `Watch ${name} today and write one line in the Chronicle afterwards.`
    };
    if (top && byId[top.id]) return byId[top.id];
    if (r.profile === 'bloom') return `Give ${name} the "could" task or a helper role.`;
    if (r.profile === 'roots') return `Invite ${name} to answer early, after a pair rehearsal.`;
    if (r.profile === 'reaching') return `Praise ${name}'s effort out loud and scaffold the next task.`;
    if (r.profile === 'tending') return `Two minutes of non-school chat with ${name}.`;
    const minor = r.signals.find((s) => s.kind === 'act');
    if (minor && byId[minor.id]) return byId[minor.id];
    return `Notice one specific thing ${name} does well.`;
}

function studentSummary(r) {
    const parts = [];
    const s = r.stars;
    const p = r.papers;
    if (!r.hasData) return 'Too few records yet for a reading. A couple more lessons will tell.';
    if (s.perLesson != null) parts.push(`${s.perLesson} ${s.perLesson === 1 ? 'star' : 'stars'} a lesson`);
    if (p.avg != null) parts.push(`papers ${p.avg}%${p.rel != null && Math.abs(p.rel) >= 3 ? ` (${p.rel > 0 ? '+' : ''}${p.rel} vs class)` : ''}`);
    if (r.attendance.rate != null && r.attendance.lessons >= 3) parts.push(`${Math.round(r.attendance.rate * 100)}% attendance`);
    if (r.topVirtue) parts.push(`shines in ${r.topVirtue.label}`);
    return parts.join(' · ');
}

// ---------------------------------------------------------------- the class

function readClass(readings, { lessonDays, recentLessons, priorLessons, papers, awards, absences, today, windowStart, recentStart }) {
    const n = readings.length;
    const insights = [];
    const add = (id, tone, title, text, techniques) => insights.push({ id, tone, title, text, techniques: techniques.filter((t) => getTechnique(t)) });

    // Stars a lesson for the whole class (per child present)
    const recognition = awards.filter((a) => a.stars > 0 && !NOT_RECOGNITION.has(a.reason) && a.day >= windowStart);
    const sumIn = (from, to) => recognition.filter((a) => a.day >= from && a.day <= to).reduce((t, a) => t + a.stars, 0);
    const absentOn = new Map();
    absences.forEach((a) => absentOn.set(a.day, (absentOn.get(a.day) || 0) + 1));
    const childLessons = (days) => days.reduce((t, d) => t + Math.max(0, n - (absentOn.get(d) || 0)), 0);
    const perChildRecent = recentLessons.length ? sumIn(recentStart, today) / Math.max(1, childLessons(recentLessons)) : null;
    const perChildPrior = priorLessons.length ? sumIn(windowStart, recentStart - 1) / Math.max(1, childLessons(priorLessons)) : null;
    const starTrend = perChildRecent != null && perChildPrior != null && perChildPrior > 0 ? (perChildRecent - perChildPrior) / perChildPrior : null;

    // Spotlight spread
    const windowStars = readings.map((r) => r.stars.window);
    const totalStars = windowStars.reduce((a, b) => a + b, 0);
    const topCount = Math.max(1, Math.round(n * 0.2));
    const topShare = totalStars > 0 ? [...windowStars].sort((a, b) => b - a).slice(0, topCount).reduce((a, b) => a + b, 0) / totalStars : null;
    const spread = gini(windowStars);
    const unseen = readings.filter((r) => r.signals.some((s) => s.id === 'unseen'));

    // Virtue mix
    const virtueTotals = Object.fromEntries(VIRTUES.map((v) => [v.id, 0]));
    readings.forEach((r) => VIRTUES.forEach((v) => { virtueTotals[v.id] += r.virtues[v.id]; }));
    const virtueSum = Object.values(virtueTotals).reduce((a, b) => a + b, 0);
    const virtueMix = VIRTUES.map((v) => ({ ...v, stars: round1(virtueTotals[v.id]), share: virtueSum ? virtueTotals[v.id] / virtueSum : 0 }));
    const weakestVirtue = virtueSum >= 10 ? [...virtueMix].sort((a, b) => a.share - b.share)[0] : null;

    // Papers
    const childAvgs = readings.map((r) => r.papers.avg).filter((x) => x != null);
    const classAvg = childAvgs.length ? Math.round(mean(childAvgs)) : null;
    const abilitySpread = childAvgs.length >= 4 ? Math.round(sd(childAvgs)) : null;
    const markedPapers = papers.filter((p) => p.avg != null && p.marks.length >= 2);
    let paperTrend = null;
    if (markedPapers.length >= 4) {
        const k = Math.min(3, Math.floor(markedPapers.length / 2));
        paperTrend = Math.round(mean(markedPapers.slice(-k).map((p) => p.avg)) - mean(markedPapers.slice(-2 * k, -k).map((p) => p.avg)));
    }
    const typeAvg = (type) => {
        const xs = markedPapers.filter((p) => p.type === type).map((p) => p.avg);
        return xs.length ? Math.round(mean(xs)) : null;
    };
    const testAvg = typeAvg('test');
    const dictationAvg = typeAvg('dictation');
    const bands = [
        { id: 'support', label: 'Under 50%', count: childAvgs.filter((x) => x < 50).length },
        { id: 'core-lo', label: '50–69%', count: childAvgs.filter((x) => x >= 50 && x < 70).length },
        { id: 'core-hi', label: '70–84%', count: childAvgs.filter((x) => x >= 70 && x < 85).length },
        { id: 'stretch', label: '85% +', count: childAvgs.filter((x) => x >= 85).length }
    ];
    const lastPaper = markedPapers[markedPapers.length - 1] || null;

    // Attendance
    const childLessonsAll = lessonDays.length * n;
    const absencesAll = absences.filter((a) => a.day >= windowStart && lessonDays.includes(a.day)).length;
    const attendanceRate = childLessonsAll ? 1 - absencesAll / childLessonsAll : null;
    const weekdayAbs = new Map();
    lessonDays.forEach((d) => {
        const wd = new Date(d * DAY_MS).getUTCDay();
        const e = weekdayAbs.get(wd) || { lessons: 0, absent: 0 };
        e.lessons += 1;
        e.absent += absentOn.get(d) || 0;
        weekdayAbs.set(wd, e);
    });
    const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let worstWeekday = null;
    if (weekdayAbs.size >= 2 && attendanceRate != null) {
        weekdayAbs.forEach((e, wd) => {
            const rate = 1 - e.absent / (e.lessons * Math.max(1, n));
            if (e.lessons >= 2 && rate < attendanceRate - 0.08 && (!worstWeekday || rate < worstWeekday.rate)) worstWeekday = { day: WEEKDAYS[wd], rate };
        });
    }

    // Notes coverage
    const noted = readings.filter((r) => r.notes.daysSince != null && r.notes.daysSince <= 45).length;
    const behaviourChildren = readings.filter((r) => r.notes.behaviour30 >= 2);

    // Profiles
    const profileCounts = Object.fromEntries(PROFILE_ORDER.map((id) => [id, readings.filter((r) => r.profile === id).length]));

    // ---- insights: what this class needs, strongest first ----
    if (lessonDays.length < 3) {
        add('few-records', 'info', 'The greenhouse is still filling',
            `Only ${plural(lessonDays.length, 'lesson')} with records in the last six weeks. Every star, paper and absence you log sharpens this reading.`,
            ['chronicle-sweep']);
    }
    if (topShare != null && n >= 5 && topShare >= 0.45 && totalStars >= 15) {
        add('spotlight', 'warn', 'The spotlight is narrow',
            `The top ${plural(topCount, 'child', 'children')} hold ${Math.round(topShare * 100)}% of the stars from the last six weeks.${unseen.length ? ` ${plural(unseen.length, 'child', 'children')} had no star in 3+ lessons.` : ''}`,
            ['name-cards', 'spotlight-rotation', 'specific-praise']);
    } else if (unseen.length >= Math.max(2, Math.ceil(n * 0.2))) {
        add('unseen', 'warn', 'Some children are unseen',
            `${unseen.map((r) => r.first).slice(0, 5).join(', ')}${unseen.length > 5 ? ` and ${unseen.length - 5} more` : ''} went 3+ lessons without a star.`,
            ['name-cards', 'two-by-ten', 'spotlight-rotation']);
    }
    if (starTrend != null && starTrend <= -0.3 && recentLessons.length >= 2) {
        add('energy-down', 'warn', 'Energy is dipping',
            `Stars per child a lesson fell ${Math.round(Math.abs(starTrend) * 100)}% in the last two weeks.`,
            ['fresh-goal', 'bounty-board', 'tpr-warmup']);
    } else if (starTrend != null && starTrend >= 0.3 && recentLessons.length >= 2) {
        add('energy-up', 'good', 'The class is on a roll',
            `Stars per child a lesson rose ${Math.round(starTrend * 100)}% in the last two weeks. Say so to the class.`,
            ['specific-praise', 'fresh-goal']);
    }
    if (weakestVirtue && weakestVirtue.share < 0.12) {
        add(`virtue-${weakestVirtue.id}`, 'idea', `${weakestVirtue.label} is rarely starred`,
            `Only ${Math.round(weakestVirtue.share * 100)}% of virtue stars went to ${weakestVirtue.label}. Build a moment for it into the lesson.`,
            VIRTUE_TECHNIQUES[weakestVirtue.id] || []);
    }
    if (paperTrend != null && paperTrend <= -6) {
        add('papers-down', 'warn', 'Papers are sliding',
            `The last papers average ${Math.abs(paperTrend)} points lower than the ones before.`,
            ['retrieval-starter', 'spiral-review', 'error-hunt']);
    } else if (paperTrend != null && paperTrend >= 6) {
        add('papers-up', 'good', 'Papers are climbing',
            `The last papers average ${paperTrend} points higher than the ones before.`, ['postcard-home']);
    }
    if (testAvg != null && dictationAvg != null && testAvg - dictationAvg >= 10) {
        add('spelling', 'idea', 'Spelling lags behind',
            `Dictations average ${dictationAvg}%, tests ${testAvg}%. The gap is spelling, not understanding.`,
            ['look-cover-write', 'phonics-chunks']);
    }
    if (abilitySpread != null && abilitySpread >= 16) {
        add('wide-spread', 'idea', 'A wide range of levels',
            `Marks spread widely (${bands.map((b) => `${b.count} ${b.label}`).join(', ')}). One task in three layers keeps everyone working.`,
            ['must-should-could', 'sentence-frames', 'buddy']);
    }
    if (bands[0].count >= Math.max(2, Math.ceil(childAvgs.length * 0.25))) {
        add('support-group', 'warn', 'A group needs a lifeline',
            `${plural(bands[0].count, 'child', 'children')} average under 50% on papers.`,
            ['pre-teach', 'chunk-task', 'greek-bridge']);
    }
    if (attendanceRate != null && lessonDays.length >= 4 && attendanceRate < 0.88) {
        add('attendance', 'warn', 'Attendance is low',
            `${Math.round(attendanceRate * 100)}% attendance over six weeks${worstWeekday ? `, lowest on ${worstWeekday.day}s` : ''}.`,
            ['missed-it-card', 'welcome-back', 'family-check']);
    } else if (worstWeekday) {
        add('weekday', 'idea', `${worstWeekday.day}s are emptier`,
            `More children miss ${worstWeekday.day} lessons. Keep new language for the fuller days, or recap it next time.`,
            ['missed-it-card']);
    }
    if (behaviourChildren.length >= 2) {
        add('behaviour', 'warn', 'Behaviour notes are gathering',
            `${behaviourChildren.map((r) => r.first).join(', ')} have 2+ behaviour notes this month.`,
            ['quiet-signal', 'restorative-chat', 'countdown-start']);
    }
    if (n >= 4 && noted / n < 0.5) {
        add('notes', 'idea', 'Few recent Chronicle notes',
            `Only ${noted} of ${n} children have a Chronicle note from the last six weeks. Notes make every reading sharper.`,
            ['chronicle-sweep']);
    }
    if (!insights.some((i) => i.tone === 'warn') && lessonDays.length >= 3) {
        add('healthy', 'good', 'A healthy greenhouse',
            'No warning signs across the class. Keep stretching the strongest and noticing the quiet ones.',
            ['must-should-could', 'name-cards']);
    }

    const toneRank = { warn: 0, idea: 1, info: 2, good: 3 };
    insights.sort((a, b) => toneRank[a.tone] - toneRank[b.tone]);

    // Health dial: 0..100 from recognition reach, attendance, marks and trend (only parts we know)
    const parts = [];
    if (n) parts.push({ w: 3, v: 1 - unseen.length / n });
    if (attendanceRate != null) parts.push({ w: 2, v: Math.max(0, (attendanceRate - 0.6) / 0.4) });
    if (classAvg != null) parts.push({ w: 2, v: Math.max(0, Math.min(1, (classAvg - 40) / 50)) });
    if (starTrend != null) parts.push({ w: 1, v: Math.max(0, Math.min(1, 0.5 + starTrend)) });
    if (n) parts.push({ w: 1, v: 1 - Math.min(1, spread / 0.6) });
    const wSum = parts.reduce((t, x) => t + x.w, 0);
    const health = wSum ? Math.round((parts.reduce((t, x) => t + x.w * x.v, 0) / wSum) * 100) : null;

    return {
        size: n,
        health,
        stars: {
            perChildRecent: perChildRecent == null ? null : Math.round(perChildRecent * 100) / 100,
            perChildPrior: perChildPrior == null ? null : Math.round(perChildPrior * 100) / 100,
            trend: starTrend, total: round1(totalStars), topShare, spread: Math.round(spread * 100) / 100, unseen: unseen.length
        },
        virtueMix,
        papers: { classAvg, spread: abilitySpread, trend: paperTrend, testAvg, dictationAvg, bands, count: markedPapers.length,
            last: lastPaper ? { title: lastPaper.title, avg: Math.round(lastPaper.avg), day: lastPaper.day } : null },
        attendance: { rate: attendanceRate, worstWeekday },
        notes: { noted, behaviourChildren: behaviourChildren.length },
        profiles: profileCounts,
        insights
    };
}

// ---------------------------------------------------------------- next lesson

function planNextLesson(readings, classReading) {
    const byPriority = [...readings].sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
    const focus = byPriority.filter((r) => r.signals.some((s) => s.sev >= 2)).slice(0, 4)
        .map((r) => ({ id: r.id, name: r.name, first: r.first, action: r.action, reason: r.signals.find((s) => s.kind === 'act')?.text || '', technique: r.techniques[0] || null }));
    const focusIds = new Set(focus.map((f) => f.id));

    const spotlight = byPriority
        .filter((r) => !focusIds.has(r.id) && r.hasData && (r.signals.some((s) => s.id === 'unseen') || r.profile === 'roots'))
        .sort((a, b) => b.stars.lessonsWithoutStar - a.stars.lessonsWithoutStar)
        .slice(0, 3)
        .map((r) => ({ id: r.id, name: r.name, first: r.first, lessonsWithoutStar: r.stars.lessonsWithoutStar }));

    const welcome = readings.filter((r) => r.attendance.absentLastLesson).map((r) => ({ id: r.id, name: r.name, first: r.first, streak: r.attendance.streak }));
    const catchUps = readings.filter((r) => r.papers.missed.length)
        .map((r) => ({ id: r.id, name: r.name, first: r.first, papers: r.papers.missed.map((m) => m.title) }));

    // Ability crews for ONE differentiated activity (guilds are never touched).
    const graded = readings.filter((r) => r.papers.avg != null).sort((a, b) => b.papers.avg - a.papers.avg);
    let crews = null;
    if (graded.length >= 6) {
        const third = Math.round(graded.length / 3);
        crews = [
            { id: 'stretch', label: 'Stretch', hint: 'The "could" layer, or a helper role', technique: 'must-should-could', members: graded.slice(0, third) },
            { id: 'core', label: 'Core', hint: 'The main task with a sentence frame', technique: 'sentence-frames', members: graded.slice(third, graded.length - third) },
            { id: 'support', label: 'Support', hint: 'Pre-taught words and chunked steps, with you nearby', technique: 'chunk-task', members: graded.slice(graded.length - third) }
        ].map((c) => ({ ...c, members: c.members.map((r) => ({ id: r.id, first: r.first, avg: r.papers.avg })) }));
    }

    // Mixed-ability partners: the top half folds onto the bottom half, so gaps stay moderate.
    let pairs = null;
    if (graded.length >= 4) {
        const half = Math.floor(graded.length / 2);
        pairs = [];
        for (let i = 0; i < half; i += 1) pairs.push([graded[i], graded[i + half]]);
        if (graded.length % 2) pairs[pairs.length - 1].push(graded[graded.length - 1]);
        pairs = pairs.map((group) => group.map((r) => ({ id: r.id, first: r.first })));
    }

    const classMove = classReading.insights.find((i) => i.tone === 'warn' || i.tone === 'idea');
    return {
        focus, spotlight, welcome, catchUps, crews, pairs,
        classMove: classMove ? { insight: classMove.id, title: classMove.title, technique: classMove.techniques[0] || null } : null
    };
}

// ---------------------------------------------------------------- AI almanac support

/** A short, stable hash of the reading's substance (what the AI saw), for the shared cache. */
export function fingerprintOf(readings, classReading) {
    const basis = JSON.stringify([
        classReading.size, classReading.papers.classAvg, classReading.papers.count, classReading.stars.total,
        readings.map((r) => [r.id, r.profile, r.signals.map((s) => s.id).join(','), r.papers.count, Math.round(r.stars.window)]).sort()
    ]);
    let h = 2166136261;
    for (let i = 0; i < basis.length; i += 1) {
        h ^= basis.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
}

/** The compact class brief the Almanac's AI reads: numbers and signals only, never private note text. */
export function almanacBrief(green, { className = '', level = '' } = {}) {
    const c = green.classReading;
    const lines = [];
    lines.push(`Class: ${className}${level ? ` (${level})` : ''}, ${c.size} children, ESL (English) lessons in Greece.`);
    lines.push(`Lessons with records in the last 6 weeks: ${green.lessons.all}.`);
    if (c.papers.classAvg != null) lines.push(`Papers: class average ${c.papers.classAvg}%${c.papers.trend != null ? `, recent trend ${c.papers.trend > 0 ? '+' : ''}${c.papers.trend} points` : ''}${c.papers.testAvg != null ? `, tests ${c.papers.testAvg}%` : ''}${c.papers.dictationAvg != null ? `, dictations ${c.papers.dictationAvg}%` : ''}.`);
    if (c.stars.perChildRecent != null) lines.push(`Stars per child per lesson: ${c.stars.perChildRecent} now${c.stars.perChildPrior != null ? `, ${c.stars.perChildPrior} before` : ''}. Top 20% hold ${c.stars.topShare != null ? Math.round(c.stars.topShare * 100) : '?'}% of stars.`);
    lines.push(`Virtue stars: ${c.virtueMix.map((v) => `${v.label} ${Math.round(v.share * 100)}%`).join(', ')}.`);
    if (c.attendance.rate != null) lines.push(`Attendance: ${Math.round(c.attendance.rate * 100)}%.`);
    lines.push(`Growth profiles: ${PROFILE_ORDER.filter((p) => c.profiles[p]).map((p) => `${PROFILES[p].label} ${c.profiles[p]}`).join(', ')}.`);
    lines.push(`Class signals: ${c.insights.map((i) => i.title).join('; ') || 'none'}.`);
    lines.push('Children (first name: profile; stars a lesson; papers average; signals):');
    green.students.forEach((r) => {
        const sig = r.signals.filter((s) => s.kind === 'act').map((s) => s.id).join(', ');
        const good = r.signals.filter((s) => s.kind === 'good').map((s) => s.id).join(', ');
        lines.push(`- ${r.first}: ${PROFILES[r.profile].label}; ${r.stars.perLesson ?? '?'}★; ${r.papers.avg != null ? `${r.papers.avg}%` : 'no papers'}${r.topVirtue ? `; best virtue ${r.topVirtue.label}` : ''}${sig ? `; watch: ${sig}` : ''}${good ? `; good: ${good}` : ''}`);
    });
    return lines.join('\n');
}

export const ALMANAC_COUNSELS = [
    { id: 'fortnight', label: 'Two-week plan', icon: 'fa-calendar-week', hint: 'A lesson-by-lesson plan for the whole class',
        task: 'Write a practical two-week plan for this class (about four lessons). Use markdown headings "### Lesson 1" to "### Lesson 4". Under each, 2-3 bullets: one whole-class move and one or two named children to focus on, with exactly what to do. End with "### Watch for" and 2 bullets.' },
    { id: 'groups', label: 'Pairs & groups', icon: 'fa-people-group', hint: 'Who works well with whom, for activities',
        task: 'Suggest how to pair and group these children for pair work and group activities over the next weeks (temporary activity groups only; never suggest changing guilds or teams, they are permanent). Use "### Pairs" (bullets of pairs with a one-line reason), "### Small groups" (3-4 groups with a role for each child), and "### Seating tips" (2 bullets).' },
    { id: 'parents', label: 'Class letter home', icon: 'fa-envelope-open-text', hint: 'A warm whole-class update for families',
        task: 'Write a short, warm letter to the families of this class about how the class as a whole is doing: what the class is good at, what we are working on together, and two simple ways families can help at home. Never name or single out any child and never quote numbers about individual children. About 150 words, plain paragraphs, no headings.' },
    { id: 'coach', label: 'Coach me', icon: 'fa-chalkboard-user', hint: 'Honest coaching on how this class is being taught',
        task: 'Act as a teaching coach. Based on these patterns, give honest coaching to the teacher. Use "### What is working" (2-3 bullets), "### Blind spots" (2-3 bullets, e.g. who gets recognised and who does not), and "### Try this week" (3 concrete bullets). Be specific to the data; no generic advice.' }
];

export const ALMANAC_SYSTEM_PROMPT = 'You are an experienced primary ESL teacher and mentor in Greece, coaching a colleague who teaches English to Greek children through a gamified class quest (stars for the virtues Teamwork, Creativity, Respect and Focus; test and dictation papers; permanent guilds that must never be changed). You read a data summary of one whole class and give practical, warm, specific advice that can be used in the very next lessons. Use the children\'s first names when the task allows it. Keep it concise. Never invent data that is not in the summary.';
