// features/weeklyReportCore.mjs
// Pure model for the Weekly Report ("The Week's Scroll"): picks the lesson week, counts what the
// class did in it (stars by day and virtue, heroes, attendance, trials, crowns), compares it with
// the week before, and builds / parses the compact Oracle prompt. No DOM, no Firebase.

import { TRIAL_TYPE_GUIDE, getTrialTypeMeta } from './trialTypesCore.mjs';

export const VIRTUES = [
    { id: 'teamwork', label: 'Teamwork', icon: 'fa-users', color: '#7c3aed' },
    { id: 'creativity', label: 'Creativity', icon: 'fa-lightbulb', color: '#db2777' },
    { id: 'respect', label: 'Respect', icon: 'fa-handshake', color: '#059669' },
    { id: 'focus', label: 'Focus', icon: 'fa-bullseye', color: '#d97706' },
];

const VIRTUE_IDS = new Set(VIRTUES.map((v) => v.id));
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 24 * 60 * 60 * 1000;

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Stars read nicely: 12, 12.5, 12.25. */
export function formatStars(n) {
    return String(Math.round((Number(n) || 0) * 4) / 4);
}

export function firstName(name) {
    return String(name || '').trim().split(/\s+/)[0] || '';
}

/** DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, Date, Firestore Timestamp → local Date at midnight (or null). */
export function parseReportDate(value) {
    if (!value) return null;
    let d = null;
    if (value instanceof Date) d = new Date(value.getTime());
    else if (typeof value?.toDate === 'function') d = value.toDate();
    else if (typeof value === 'object' && Number.isFinite(value?.seconds)) d = new Date(value.seconds * 1000);
    else {
        const str = String(value).trim();
        let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(str);
        if (m) d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        else {
            m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(str);
            if (m) d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
        }
    }
    if (!d || Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
}

function isoDay(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Monday-to-Sunday lesson week. offset 0 = the week containing `now`, -1 = the week before. */
export function getReportWeek(now = new Date(), offset = 0) {
    const today = parseReportDate(now) || parseReportDate(new Date());
    const mondayIndex = (today.getDay() + 6) % 7;
    const start = new Date(today);
    start.setDate(today.getDate() - mondayIndex + (Number(offset) || 0) * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
    });
    const sameMonth = start.getMonth() === end.getMonth();
    const sameYear = start.getFullYear() === end.getFullYear();
    const label = sameMonth
        ? `${start.getDate()}–${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`
        : `${start.getDate()} ${MONTHS[start.getMonth()]}${sameYear ? '' : ` ${start.getFullYear()}`} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
    const current = offset === 0;
    return {
        offset: Number(offset) || 0,
        key: isoDay(start),
        start,
        end,
        days,
        label,
        // days of the week that have already happened (the current week is still running)
        elapsedDays: current ? mondayIndex + 1 : 7,
        name: current ? 'This week' : offset === -1 ? 'Last week' : `${Math.abs(offset)} weeks ago`,
    };
}

/** Index 0–6 (Mon–Sun) of a date inside the week, or -1. */
export function dayIndexInWeek(week, value) {
    const d = parseReportDate(value);
    if (!d || !week) return -1;
    const diff = Math.round((d.getTime() - week.start.getTime()) / DAY_MS);
    return diff >= 0 && diff < 7 ? diff : -1;
}

function sumBy(list, fn) {
    return list.reduce((sum, item) => sum + (Number(fn(item)) || 0), 0);
}

function virtueOf(reason) {
    const r = String(reason || '').toLowerCase();
    return VIRTUE_IDS.has(r) ? r : null;
}

function pctChange(now, before) {
    if (!before) return now > 0 ? null : 0;
    return Math.round(((now - before) / Math.abs(before)) * 100);
}

/**
 * @param {object} input
 * @param {object} input.classData   the class doc ({ id, name, logo, questLevel, scheduleDays })
 * @param {object[]} input.students  active students of the class ({ id, name, avatar })
 * @param {object[]} input.awardLogs award_log docs (any class; filtered here)
 * @param {object[]} input.writtenScores written_scores docs
 * @param {object[]} input.attendance attendance (absence) docs
 * @param {object[]} input.adventureLogs adventure_logs docs ({ classId, date, hero })
 * @param {object} input.week        from getReportWeek
 * @param {(log:object)=>number} [input.starCredit]  award credit (defaults to log.stars)
 * @param {(score:object)=>number|null} [input.scorePercent]
 * @param {(score:object)=>string} [input.scoreLabel]
 * @param {boolean} [input.youngLearners] Pre-Junior: no rankings or averages
 */
export function buildWeeklyReportModel(input = {}) {
    const {
        classData = {},
        students = [],
        awardLogs = [],
        writtenScores = [],
        attendance = [],
        adventureLogs = [],
        week,
        starCredit = (log) => Number(log?.stars) || 0,
        scorePercent = (score) => (Number.isFinite(Number(score?.normalizedPercent)) ? Number(score.normalizedPercent) : null),
        scoreLabel = (score) => String(score?.scoreValue ?? score?.value ?? ''),
        youngLearners = false,
    } = input;
    const classId = classData.id;
    const prevWeek = getReportWeek(week.start, -1);
    const studentIds = new Set(students.map((s) => s.id));
    const byClass = (item) => item && item.classId === classId;

    const inWeek = (w) => (item) => dayIndexInWeek(w, item.date) >= 0;
    const logs = awardLogs.filter(byClass).filter(inWeek(week));
    const prevLogs = awardLogs.filter(byClass).filter(inWeek(prevWeek));

    // Stars by day and by virtue
    const dayStars = Array(7).fill(0);
    const virtueStars = Object.fromEntries(VIRTUES.map((v) => [v.id, 0]));
    let otherStars = 0;
    const perStudent = new Map();
    const notes = [];
    for (const log of logs) {
        const credit = Number(starCredit(log)) || 0;
        dayStars[dayIndexInWeek(week, log.date)] += credit;
        const virtue = virtueOf(log.reason);
        if (virtue) virtueStars[virtue] += credit;
        else otherStars += credit;
        if (log.studentId && studentIds.has(log.studentId)) {
            const entry = perStudent.get(log.studentId) || { stars: 0, virtues: {} };
            entry.stars += credit;
            if (virtue) entry.virtues[virtue] = (entry.virtues[virtue] || 0) + credit;
            perStudent.set(log.studentId, entry);
        }
        if (log.note && String(log.note).trim()) notes.push(String(log.note).trim());
    }
    const totalStars = round2(sumBy(logs, starCredit));
    const prevStars = round2(sumBy(prevLogs, starCredit));

    const prevVirtueStars = Object.fromEntries(VIRTUES.map((v) => [v.id, 0]));
    for (const log of prevLogs) {
        const virtue = virtueOf(log.reason);
        if (virtue) prevVirtueStars[virtue] += Number(starCredit(log)) || 0;
    }

    // Lesson days = days with any awards, an Adventure Log entry, trials or attendance marks
    const lessonDaySet = new Set();
    const markDay = (item) => { const i = dayIndexInWeek(week, item.date); if (i >= 0) lessonDaySet.add(i); };
    logs.forEach(markDay);
    const weekAdventure = adventureLogs.filter(byClass).filter(inWeek(week));
    weekAdventure.forEach(markDay);
    const weekScores = writtenScores.filter(byClass).filter(inWeek(week)).filter((s) => !s.studentId || studentIds.has(s.studentId));
    weekScores.forEach(markDay);
    const weekAbsences = attendance.filter((a) => a && (a.classId === classId || (a.studentId && studentIds.has(a.studentId))))
        .filter(inWeek(week)).filter((a) => studentIds.has(a.studentId));
    weekAbsences.forEach(markDay);
    const lessonDays = [...lessonDaySet].sort((a, b) => a - b);

    const virtueTotal = sumBy(VIRTUES, (v) => virtueStars[v.id]);
    const virtues = VIRTUES.map((v) => ({
        ...v,
        stars: round2(virtueStars[v.id]),
        prevStars: round2(prevVirtueStars[v.id]),
        share: virtueTotal > 0 ? Math.round((virtueStars[v.id] / virtueTotal) * 100) : 0,
    }));
    const rankedVirtues = [...virtues].sort((a, b) => b.stars - a.stars);
    const leadVirtue = virtueTotal > 0 ? rankedVirtues[0] : null;
    const quietVirtue = virtueTotal > 0 && rankedVirtues[3].stars < rankedVirtues[0].stars ? rankedVirtues[3] : null;

    // Heroes
    const absencesByStudent = new Map();
    for (const a of weekAbsences) absencesByStudent.set(a.studentId, (absencesByStudent.get(a.studentId) || 0) + 1);
    const heroes = students.map((s) => {
        const entry = perStudent.get(s.id) || { stars: 0, virtues: {} };
        const topVirtue = Object.entries(entry.virtues).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        return {
            id: s.id,
            name: s.name || '',
            firstName: firstName(s.name),
            avatar: s.avatar || '',
            stars: round2(entry.stars),
            topVirtue,
            absences: absencesByStudent.get(s.id) || 0,
        };
    });
    const shining = heroes.filter((h) => h.stars > 0)
        .sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name))
        .slice(0, 3);
    // Present at least once but not yet recognised: the heroes to notice next week.
    const lessonCount = lessonDays.length;
    const unseen = lessonCount > 0
        ? heroes.filter((h) => h.stars <= 0 && h.absences < lessonCount).sort((a, b) => a.name.localeCompare(b.name))
        : [];
    const noticed = heroes.filter((h) => h.stars > 0).length;

    // Attendance
    const possible = lessonCount * students.length;
    const attendanceRate = possible > 0 ? Math.max(0, Math.round(((possible - weekAbsences.length) / possible) * 100)) : null;
    const frequentAbsent = heroes.filter((h) => h.absences >= 2).sort((a, b) => b.absences - a.absences);

    // Trials (tests / dictations)
    const groups = new Map();
    for (const score of weekScores) {
        const typeMeta = getTrialTypeMeta(score.type);
        const title = String(score.title || '').trim() || typeMeta.label;
        const key = `${title}|${score.type || ''}`;
        const g = groups.get(key) || { title, type: String(score.type || ''), typeLabel: typeMeta.label, date: score.date, percents: [], count: 0, labels: [] };
        g.count += 1;
        const pct = scorePercent(score);
        if (Number.isFinite(pct)) g.percents.push(pct);
        const label = scoreLabel(score);
        if (label) g.labels.push(label);
        groups.set(key, g);
    }
    const trials = [...groups.values()].map((g) => ({
        title: g.title,
        type: g.type,
        typeLabel: g.typeLabel,
        date: g.date,
        count: g.count,
        average: g.percents.length ? Math.round(g.percents.reduce((a, b) => a + b, 0) / g.percents.length) : null,
        best: g.percents.length ? Math.round(Math.max(...g.percents)) : null,
        sampleLabel: g.labels[0] || '',
    })).sort((a, b) => (parseReportDate(a.date)?.getTime() || 0) - (parseReportDate(b.date)?.getTime() || 0));
    const allPercents = weekScores.map(scorePercent).filter((p) => Number.isFinite(p));
    const trialAverage = allPercents.length ? Math.round(allPercents.reduce((a, b) => a + b, 0) / allPercents.length) : null;

    // Hero of the Day crowns
    const crowns = weekAdventure
        .filter((l) => l.hero && String(l.hero).trim())
        .sort((a, b) => dayIndexInWeek(week, a.date) - dayIndexInWeek(week, b.date))
        .map((l) => ({ day: DAY_LABELS[dayIndexInWeek(week, l.date)], name: String(l.hero).trim() }));

    const days = week.days.map((d, i) => ({
        label: DAY_LABELS[i],
        date: d.getDate(),
        stars: round2(dayStars[i]),
        lesson: lessonDaySet.has(i),
        future: i >= week.elapsedDays,
    }));

    return {
        classId,
        className: classData.name || 'Class',
        classLogo: classData.logo || '📚',
        league: classData.questLevel || '',
        youngLearners: !!youngLearners,
        week: { key: week.key, label: week.label, name: week.name, offset: week.offset, current: week.offset === 0 },
        totalStars,
        prevStars,
        starChange: pctChange(totalStars, prevStars),
        starsPerLesson: lessonCount ? round1(totalStars / lessonCount) : 0,
        otherStars: round2(otherStars),
        lessonCount,
        days,
        peakDay: days.reduce((best, d) => (d.stars > (best?.stars || 0) ? d : best), null),
        virtues,
        leadVirtue,
        quietVirtue,
        heroCount: students.length,
        noticed,
        shining: youngLearners ? shining.map((h) => ({ ...h, stars: null })) : shining,
        unseen,
        absences: weekAbsences.length,
        attendanceRate,
        frequentAbsent,
        trials: youngLearners ? trials.map((t) => ({ ...t, average: null, best: null })) : trials,
        trialAverage: youngLearners ? null : trialAverage,
        crowns,
        notes: notes.slice(0, 6),
        isEmpty: logs.length === 0 && weekAdventure.length === 0 && weekScores.length === 0 && weekAbsences.length === 0,
    };
}

/** Short, deterministic observations shown even without the Oracle. */
export function buildWeeklyHighlights(model) {
    const out = [];
    if (!model || model.isEmpty) return out;
    if (model.starChange === null && model.totalStars > 0) out.push({ tone: 'up', icon: 'fa-seedling', text: `A fresh start: ${formatStars(model.totalStars)} stars after a quiet week.` });
    else if (model.starChange >= 10) out.push({ tone: 'up', icon: 'fa-arrow-trend-up', text: `Stars are up ${model.starChange}% on the week before.` });
    else if (model.starChange <= -10 && !model.week.current) out.push({ tone: 'down', icon: 'fa-arrow-trend-down', text: `Stars fell ${Math.abs(model.starChange)}% on the week before.` });
    if (model.leadVirtue) out.push({ tone: 'up', icon: model.leadVirtue.icon, text: `${model.leadVirtue.label} led the way with ${model.leadVirtue.share}% of virtue stars.` });
    if (model.quietVirtue && model.quietVirtue.share < 15) out.push({ tone: 'watch', icon: model.quietVirtue.icon, text: `${model.quietVirtue.label} was quiet (${model.quietVirtue.share}%). Worth a spotlight next lesson.` });
    if (model.heroCount && model.noticed === model.heroCount) out.push({ tone: 'up', icon: 'fa-hands-clapping', text: 'Every hero earned at least one star.' });
    else if (model.unseen.length) out.push({ tone: 'watch', icon: 'fa-eye', text: `${model.unseen.length} ${model.unseen.length === 1 ? 'hero was' : 'heroes were'} present but not yet recognised.` });
    if (model.frequentAbsent.length) out.push({ tone: 'watch', icon: 'fa-door-open', text: `${model.frequentAbsent.map((h) => h.firstName).join(', ')} missed two or more lessons.` });
    return out.slice(0, 4);
}

/** Compact prompt: the proxy caps output around 1200 tokens, so ask for short JSON. */
export function buildWeeklyReportPrompt(model, { audience = 'young learners' } = {}) {
    const system = [
        "You are the Quest Master, a warm, practical coach for a teacher of English as a foreign language at a private school in Greece.",
        'You read one class\'s week and reply with ONLY a JSON object, no markdown fences.',
        'Stars reward observable actions (Teamwork, Creativity, Respect, Focus); they are not grades.',
        TRIAL_TYPE_GUIDE,
        'Be specific, kind and brief. Never invent facts or names that are not in the data. Use first names only.',
    ].join(' ');
    const data = {
        class: model.className,
        league: model.league,
        learners: audience,
        week: model.week.label,
        weekIsStillRunning: model.week.current,
        lessons: model.lessonCount,
        stars: model.totalStars,
        starsWeekBefore: model.prevStars,
        virtues: Object.fromEntries(model.virtues.map((v) => [v.label, v.stars])),
        otherStars: model.otherStars,
        shining: model.shining.map((h) => h.firstName),
        notYetRecognised: model.unseen.slice(0, 6).map((h) => h.firstName),
        attendancePercent: model.attendanceRate,
        heroesOfTheDay: model.crowns.map((c) => firstName(c.name)),
        trials: model.trials.map((t) => ({ title: t.title, type: t.type, averagePercent: t.average })),
        teacherNotes: model.notes.map((n) => n.slice(0, 140)),
    };
    const user = `Class data for the week:\n${JSON.stringify(data)}\n\nReply with this JSON shape (keep every string short):\n{"headline":"a 4–8 word title for the week","story":"2 short paragraphs (max 90 words) linking behaviour and learning","wins":["2–3 concrete wins"],"watch":["1–2 gentle things to watch"],"miniQuest":{"name":"quest name","goal":"what the class must do next week","howToWin":"how the teacher checks it","reward":"a small in-class reward"},"familyNote":"2 sentences a teacher can send to families, no student names"}`;
    return { system, user };
}

function cleanLine(value, max = 400) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanList(value, max = 3) {
    if (!Array.isArray(value)) return [];
    return value.map((v) => cleanLine(typeof v === 'string' ? v : v?.text, 220)).filter(Boolean).slice(0, max);
}

/** Parse the Oracle's reply. Falls back to treating plain text as the story. */
export function parseWeeklyReading(text) {
    const raw = String(text || '').replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    if (!raw) return null;
    let obj = null;
    try { obj = JSON.parse(raw); } catch (_) {
        const s = raw.indexOf('{');
        const e = raw.lastIndexOf('}');
        if (s !== -1 && e > s) {
            try { obj = JSON.parse(raw.slice(s, e + 1)); } catch (_) { obj = null; }
        }
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        const story = raw.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').trim();
        return story ? { headline: '', story: story.slice(0, 1400), wins: [], watch: [], miniQuest: null, familyNote: '' } : null;
    }
    const q = obj.miniQuest && typeof obj.miniQuest === 'object' ? obj.miniQuest : null;
    const miniQuest = q && (q.name || q.goal)
        ? { name: cleanLine(q.name, 80) || 'Mini-Quest', goal: cleanLine(q.goal, 240), howToWin: cleanLine(q.howToWin, 240), reward: cleanLine(q.reward, 160) }
        : null;
    const story = Array.isArray(obj.story) ? obj.story.join('\n\n') : String(obj.story || '');
    const reading = {
        headline: cleanLine(obj.headline, 90),
        story: story.split(/\n{2,}/).map((p) => cleanLine(p, 900)).filter(Boolean).join('\n\n'),
        wins: cleanList(obj.wins, 3),
        watch: cleanList(obj.watch, 2),
        miniQuest,
        familyNote: cleanLine(obj.familyNote, 400),
    };
    return reading.story || reading.wins.length || miniQuest ? reading : null;
}

/** Plain-text version for the clipboard. */
export function buildWeeklyReportText(model, reading = null) {
    const lines = [];
    lines.push(`${model.classLogo} ${model.className}: Weekly Report`);
    lines.push(`${model.week.label}${model.league ? ` · ${model.league}` : ''}`);
    lines.push('');
    if (reading?.headline) lines.push(reading.headline, '');
    lines.push(`Stars: ${formatStars(model.totalStars)} (week before: ${formatStars(model.prevStars)})`);
    lines.push(`Lessons: ${model.lessonCount}`);
    if (model.attendanceRate !== null) lines.push(`Attendance: ${model.attendanceRate}%`);
    lines.push(`Heroes recognised: ${model.noticed}/${model.heroCount}`);
    lines.push(`Virtues: ${model.virtues.map((v) => `${v.label} ${formatStars(v.stars)}`).join(', ')}`);
    if (model.shining.length) lines.push(`Shining: ${model.shining.map((h) => h.name).join(', ')}`);
    if (model.unseen.length) lines.push(`Not yet recognised: ${model.unseen.map((h) => h.name).join(', ')}`);
    if (model.crowns.length) lines.push(`Heroes of the Day: ${model.crowns.map((c) => `${c.day} ${c.name}`).join(', ')}`);
    if (model.trials.length) {
        lines.push('Trials:');
        model.trials.forEach((t) => lines.push(`  - ${t.title}${t.average !== null ? `: class average ${t.average}%` : ''} (${t.count})`));
    }
    if (reading) {
        if (reading.story) lines.push('', reading.story);
        if (reading.wins.length) lines.push('', 'Wins:', ...reading.wins.map((w) => `  - ${w}`));
        if (reading.watch.length) lines.push('', 'To watch:', ...reading.watch.map((w) => `  - ${w}`));
        if (reading.miniQuest) {
            const q = reading.miniQuest;
            lines.push('', `Mini-Quest: ${q.name}`);
            if (q.goal) lines.push(`  Goal: ${q.goal}`);
            if (q.howToWin) lines.push(`  How to win: ${q.howToWin}`);
            if (q.reward) lines.push(`  Reward: ${q.reward}`);
        }
        if (reading.familyNote) lines.push('', `For families: ${reading.familyNote}`);
    }
    return lines.join('\n');
}
