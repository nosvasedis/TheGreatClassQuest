import { getQuestLeagueDefinition } from '../constants.js';

export const CEREMONY_MODES = Object.freeze({ CLASSIC: 'classic_arena', GROWTH: 'growth_festival' });

export function resolveCeremonyMode(league) {
    const definition = typeof league === 'object' ? league : getQuestLeagueDefinition(league);
    if (!definition) return { ok: false, mode: null, reason: 'This class has no valid Quest League. Ceremony preparation is blocked.' };
    return { ok: true, mode: definition.ageCategory === 'early' ? CEREMONY_MODES.GROWTH : CEREMONY_MODES.CLASSIC, definition };
}

export function seededHash(seed = '') {
    let hash = 2166136261;
    for (const char of String(seed)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return hash >>> 0;
}

export function seededShuffle(items = [], seed = '') {
    const output = [...items];
    let value = seededHash(seed) || 1;
    for (let i = output.length - 1; i > 0; i -= 1) {
        value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
        const j = value % (i + 1);
        [output[i], output[j]] = [output[j], output[i]];
    }
    return output;
}

export function rankClassResults(results = []) {
    return [...results].sort((a, b) => (Number(a.score) || 0) - (Number(b.score) || 0)).map((result, index) => ({ ...result, rank: index + 1 }));
}

export function rankStudentResults(results = []) {
    const sorted = [...results].sort((a, b) => {
        const fields = ['score', 'count3', 'count2', 'uniqueReasons'];
        for (const field of fields) { const delta = (Number(b[field]) || 0) - (Number(a[field]) || 0); if (delta) return delta; }
        return (Number(b.academicAvg) || 0) - (Number(a.academicAvg) || 0);
    });
    return sorted.map((result, index) => ({ ...result, rank: index + 1 }));
}

export function chooseCanonicalWinners({ classResults = [], studentResults = [] } = {}) {
    const rankedClasses = rankClassResults(classResults);
    const rankedStudents = rankStudentResults(studentResults);
    const positiveStudents = rankedStudents.filter((student) => (Number(student.score) || 0) > 0);
    const classWinner = rankedClasses.length ? rankedClasses[rankedClasses.length - 1] : null;
    if (!positiveStudents.length) return { classResults: rankedClasses, studentResults: rankedStudents, classWinner, prodigyWinners: [], collectiveClose: true };
    const top = positiveStudents[0];
    const prodigyWinners = positiveStudents.filter((student) => ['score', 'count3', 'count2', 'uniqueReasons', 'academicAvg'].every((field) => (Number(student[field]) || 0) === (Number(top[field]) || 0)));
    return { classResults: rankedClasses, studentResults: rankedStudents, classWinner, prodigyWinners, collectiveClose: false };
}

const REASONS = ['teamwork', 'creativity', 'respect', 'focus'];
const REASON_LABELS = { teamwork: 'Teamwork Bloom', creativity: 'Bright Idea Bloom', respect: 'Kind Heart Bloom', focus: 'Steady Star Bloom' };

function positiveLogs(studentLogs = []) {
    return studentLogs.filter((log) => (Number(log.appliedStarCredit ?? log.stars) || 0) > 0 && !['welcome_back', 'absence', 'special_quest'].includes(log.reason));
}

function distinctDates(logs) { return new Set(logs.map((log) => log.date).filter(Boolean)); }

export function buildGrowthSpotlight(student, { currentLogs = [], previousLogs = [], attendedLessons = [], currentMonthKey = '', hasTeacherBoon = false } = {}) {
    const logs = positiveLogs(currentLogs);
    const reasonStats = Object.fromEntries(REASONS.map((reason) => [reason, { credit: 0, dates: new Set(), count: 0, first: '9999-99-99' }]));
    logs.forEach((log) => {
        if (!REASONS.includes(log.reason)) return;
        const stat = reasonStats[log.reason]; stat.credit += Number(log.appliedStarCredit ?? log.stars) || 0; stat.count += 1; if (log.date) stat.dates.add(log.date); if (log.date < stat.first) stat.first = log.date;
    });
    const currentByDate = new Map(); logs.forEach((log) => currentByDate.set(log.date, (currentByDate.get(log.date) || 0) + (Number(log.appliedStarCredit ?? log.stars) || 0)));
    const previousPositive = positiveLogs(previousLogs);
    const previousByDate = new Map(); previousPositive.forEach((log) => previousByDate.set(log.date, (previousByDate.get(log.date) || 0) + (Number(log.appliedStarCredit ?? log.stars) || 0)));
    const attended = [...new Set((attendedLessons || []).map((item) => typeof item === 'string' ? item : item.date).filter(Boolean))];
    const enoughGrowthData = attended.length >= 2 && [...currentByDate.keys()].filter(Boolean).length >= 2 && previousByDate.size >= 2;
    const currentAvg = attended.length ? attended.reduce((sum, date) => sum + (currentByDate.get(date) || 0), 0) / attended.length : 0;
    const previousDates = [...previousByDate.keys()];
    const previousAvg = previousDates.length ? previousDates.reduce((sum, date) => sum + previousByDate.get(date), 0) / previousDates.length : 0;
    const reasonCount = REASONS.filter((reason) => reasonStats[reason].count > 0).length;
    let candidate;
    if (hasTeacherBoon) candidate = { key: 'teacher_special_bloom', title: "Teacher's Special Bloom", evidence: 'Teacher Boon recognised this month.', publicText: `${student.name} received a special bloom from their teacher.` };
    else if (enoughGrowthData && previousAvg > 0 && currentAvg >= previousAvg * 1.2 && currentAvg - previousAvg >= 0.25 && currentByDate.size >= 2) candidate = { key: 'growing_stronger', title: 'Growing Stronger', evidence: 'Positive stars per attended lesson increased.', publicText: `${student.name} helped our class garden grow stronger.` };
    else if (reasonCount >= 3) candidate = { key: 'rainbow_of_strengths', title: 'Rainbow of Strengths', evidence: `${reasonCount} different strengths were recognised.`, publicText: `${student.name} brought many beautiful strengths to our garden.` };
    else if (attended.length >= 3 && attended.filter((date) => (currentByDate.get(date) || 0) > 0).length / attended.length >= 0.6) candidate = { key: 'steady_little_light', title: 'Steady Little Light', evidence: 'Positive recognition appeared across most attended lessons.', publicText: `${student.name} was a steady little light in our garden.` };
    else {
        const strongest = REASONS.map((reason) => ({ reason, ...reasonStats[reason] })).filter((item) => item.count >= 2).sort((a, b) => b.credit - a.credit || b.dates.size - a.dates.size || a.first.localeCompare(b.first) || REASONS.indexOf(a.reason) - REASONS.indexOf(b.reason))[0];
        if (strongest) candidate = { key: strongest.reason, title: REASON_LABELS[strongest.reason], evidence: `${strongest.title || REASON_LABELS[strongest.reason]} recognised on ${strongest.dates.size} separate lesson days.`, publicText: `${student.name} helped our class garden grow with ${strongest.reason === 'respect' ? 'kindness and care' : strongest.reason}.` };
    }
    return candidate || { key: 'special_part', title: 'A Special Part of Our Garden', evidence: 'A warm welcome for every learner.', publicText: `${student.name} is a special part of our class garden.` };
}

export function buildGrowthSpotlights(students = [], optionsByStudent = {}, { classId = '', monthKey = '', snapshotVersion = 1 } = {}) {
    const cards = students.map((student) => ({ studentId: student.id, studentName: student.name, ...buildGrowthSpotlight(student, optionsByStudent[student.id] || {}) }));
    return seededShuffle(cards, `${classId}+${monthKey}+${snapshotVersion}`);
}

export function buildGrowthPublicSequence({ classes = [], spotlights = [], classId = '', monthKey = '', snapshotVersion = 1 } = {}) {
    return {
        garden: seededShuffle(classes.map((item) => ({ ...item, rank: undefined })), `${classId}:${monthKey}:garden`),
        parade: seededShuffle(spotlights, `${classId}:${monthKey}:${snapshotVersion}:parade`),
    };
}

export function buildCeremonySnapshot({ classId, className, classLogo, questLeague, monthKey, schoolYearKey, classResults = [], studentResults = [], students = [], spotlightOptions = {}, snapshotVersion = 1, createdBy } = {}) {
    const modeResult = resolveCeremonyMode(questLeague);
    if (!modeResult.ok) throw new Error(modeResult.reason);
    const winners = chooseCanonicalWinners({ classResults, studentResults });
    const spotlights = modeResult.mode === CEREMONY_MODES.GROWTH ? buildGrowthSpotlights(students, spotlightOptions, { classId, monthKey, snapshotVersion }) : [];
    const publicSequence = modeResult.mode === CEREMONY_MODES.GROWTH ? buildGrowthPublicSequence({ classes: classResults, spotlights, classId, monthKey, snapshotVersion }) : { classes: winners.classResults, students: winners.studentResults };
    return {
        schemaVersion: 1, schoolYearKey, classId, className, classLogo, questLeague, monthKey, mode: modeResult.mode, status: 'draft',
        classResults: winners.classResults, studentResultsPrivate: winners.studentResults, classWinner: winners.classWinner, prodigyWinners: winners.prodigyWinners,
        publicSequence, spotlights, sourceFingerprint: JSON.stringify({ classResults, studentResults, monthKey }), sourceGeneratedAt: new Date(), snapshotVersion,
        playback: { phase: 'intro', index: 0, updatedAt: new Date() }, createdBy,
    };
}

