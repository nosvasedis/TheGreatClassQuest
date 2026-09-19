import { questLeagues } from '../constants.js';

export const PLACEMENT_GROUP_MODES = Object.freeze({
    CLASS: 'class',
    LEAGUE: 'league',
    ALPHA: 'alpha'
});

const UNKNOWN_CLASS_TITLE = 'Previous class unknown';
const UNKNOWN_LEAGUE_TITLE = 'League not recorded';

export function getNaturalProgressionLeague(previousLeague) {
    const idx = questLeagues.indexOf(previousLeague);
    if (idx < 0 || idx + 1 >= questLeagues.length) return null;
    return questLeagues[idx + 1];
}

export function getUnplacedStudents(students = []) {
    return students.filter((student) => student.enrollmentStatus === 'pendingPlacement');
}

export function getActivePlacementClasses(classes = []) {
    return (classes || []).filter((classData) => classData.status !== 'archived');
}

export function buildRosterCounts(students = []) {
    const counts = {};
    for (const student of students || []) {
        if (student.enrollmentStatus === 'pendingPlacement') continue;
        const classId = student.classId;
        if (!classId) continue;
        counts[classId] = (counts[classId] || 0) + 1;
    }
    return counts;
}

export function studentMatchesPlacementSearch(student, query = '') {
    const needle = String(query || '').trim().toLowerCase();
    if (!needle) return true;
    const name = String(student?.name || '').toLowerCase();
    const className = String(student?.previousClassName || '').toLowerCase();
    const league = String(student?.previousQuestLevel || '').toLowerCase();
    const teacher = String(student?.previousTeacher?.name || '').toLowerCase();
    return name.includes(needle)
        || className.includes(needle)
        || league.includes(needle)
        || teacher.includes(needle);
}

export function filterPendingStudents(students = [], query = '') {
    return getUnplacedStudents(students).filter((student) => studentMatchesPlacementSearch(student, query));
}

function sameTeacherReason(targetClass, perspective) {
    if (perspective === 'secretary') {
        const teacherName = targetClass?.createdBy?.name;
        return teacherName
            ? `same teacher as last year (${teacherName})`
            : 'same teacher as last year';
    }
    return 'was with you last year';
}

export function scoreStudentForClass(student, targetClass, options = {}) {
    const prevLeague = student.previousQuestLevel || '';
    const targetLeague = targetClass?.questLevel || '';
    const nextLeague = getNaturalProgressionLeague(prevLeague);
    const perspective = options.perspective || 'teacher';
    let score = 0;
    let reason = '';

    if (nextLeague && targetLeague === nextLeague) {
        score = 100;
        reason = `Natural step up from ${prevLeague || 'last year'}`;
    } else if (prevLeague && targetLeague === prevLeague) {
        score = 60;
        reason = `Same league as last year (${prevLeague})`;
    } else if (prevLeague && targetLeague) {
        const prevIdx = questLeagues.indexOf(prevLeague);
        const targetIdx = questLeagues.indexOf(targetLeague);
        if (targetIdx === prevIdx + 2) {
            score = 35;
            reason = `May fit after skipping a league from ${prevLeague}`;
        }
    }

    if (score > 0 && student.previousTeacher?.uid && targetClass?.createdBy?.uid === student.previousTeacher.uid) {
        score += 15;
        const teacherReason = sameTeacherReason(targetClass, perspective);
        reason = reason ? `${reason} • ${teacherReason}` : teacherReason;
    }

    return {
        score,
        reason,
        prevLeague,
        previousClassName: student.previousClassName || ''
    };
}

export function buildReturningStudentGroups(students = [], targetClass) {
    const unplaced = getUnplacedStudents(students);
    const scored = unplaced.map((student) => {
        const match = scoreStudentForClass(student, targetClass);
        return { student, ...match };
    });
    const suggested = scored
        .filter((entry) => entry.score >= 40)
        .sort((a, b) => b.score - a.score || a.student.name.localeCompare(b.student.name));
    const others = scored
        .filter((entry) => entry.score < 40)
        .sort((a, b) => a.student.name.localeCompare(b.student.name));
    return { suggested, others, total: unplaced.length };
}

export function filterStudentsBySearch(entries = [], query = '') {
    const needle = String(query || '').trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter(({ student, prevLeague, previousClassName }) => {
        const name = String(student.name || '').toLowerCase();
        const className = String(previousClassName || student.previousClassName || '').toLowerCase();
        const league = String(prevLeague || student.previousQuestLevel || '').toLowerCase();
        return name.includes(needle) || className.includes(needle) || league.includes(needle);
    });
}

function compareNames(a, b) {
    return String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base' });
}

function pickMajority(students, getKey) {
    const counts = new Map();
    const samples = new Map();
    for (const student of students) {
        const key = getKey(student);
        if (!key) continue;
        counts.set(key, (counts.get(key) || 0) + 1);
        if (!samples.has(key)) samples.set(key, student);
    }
    let bestKey = null;
    let bestCount = 0;
    for (const [key, count] of counts) {
        if (count > bestCount) {
            bestKey = key;
            bestCount = count;
        }
    }
    return { key: bestKey, count: bestCount, sample: bestKey ? samples.get(bestKey) : null };
}

function majorityPreviousLeague(students = []) {
    return pickMajority(students, (student) => String(student.previousQuestLevel || '').trim()).key;
}

function majorityPreviousTeacher(students = []) {
    const picked = pickMajority(students, (student) => String(student.previousTeacher?.uid || '').trim());
    return picked.sample?.previousTeacher || null;
}

function majorityPreviousClassName(students = []) {
    return pickMajority(students, (student) => String(student.previousClassName || '').trim()).key || '';
}

function alphaLetter(name) {
    const letter = String(name || '').trim().charAt(0).toUpperCase();
    return /[A-Z]/.test(letter) ? letter : '#';
}

function leagueSortIndex(leagueName) {
    const idx = questLeagues.indexOf(leagueName);
    return idx < 0 ? questLeagues.length + 1 : idx;
}

function sortGroups(groups, mode) {
    return groups.sort((a, b) => {
        if (Boolean(a.unknown) !== Boolean(b.unknown)) return a.unknown ? 1 : -1;
        if (mode === PLACEMENT_GROUP_MODES.LEAGUE) {
            return leagueSortIndex(a.previousLeague || a.title) - leagueSortIndex(b.previousLeague || b.title)
                || compareNames(a.title, b.title);
        }
        if (mode === PLACEMENT_GROUP_MODES.ALPHA) {
            if (a.title === '#' && b.title !== '#') return 1;
            if (b.title === '#' && a.title !== '#') return -1;
            return compareNames(a.title, b.title);
        }
        return compareNames(a.title, b.title);
    });
}

function describeGroup(mode, group) {
    const count = group.students.length;
    const heroLabel = count === 1 ? '1 hero' : `${count} heroes`;
    if (mode === PLACEMENT_GROUP_MODES.ALPHA) return heroLabel;
    const teacherName = group.previousTeacher?.name || '';
    const nextLeague = group.naturalNextLeague;
    const bits = [heroLabel];
    if (teacherName) bits.push(teacherName);
    if (nextLeague) bits.push(`natural next: ${nextLeague}`);
    return bits.join(' · ');
}

export function groupPendingStudents(students = [], mode = PLACEMENT_GROUP_MODES.CLASS, query = '') {
    const grouping = Object.values(PLACEMENT_GROUP_MODES).includes(mode)
        ? mode
        : PLACEMENT_GROUP_MODES.CLASS;
    const unplaced = filterPendingStudents(students, query);
    const buckets = new Map();

    for (const student of unplaced) {
        let key;
        let title;
        let unknown = false;

        if (grouping === PLACEMENT_GROUP_MODES.LEAGUE) {
            const league = String(student.previousQuestLevel || '').trim();
            unknown = !league;
            key = league ? `league:${league}` : 'league:unknown';
            title = league || UNKNOWN_LEAGUE_TITLE;
        } else if (grouping === PLACEMENT_GROUP_MODES.ALPHA) {
            const letter = alphaLetter(student.name);
            key = `alpha:${letter}`;
            title = letter;
            unknown = letter === '#';
        } else {
            const classId = String(student.previousClassId || '').trim();
            const className = String(student.previousClassName || '').trim();
            unknown = !classId && !className;
            key = classId
                ? `classid:${classId}`
                : (className ? `classname:${className}` : 'class:unknown');
            title = className || UNKNOWN_CLASS_TITLE;
        }

        if (!buckets.has(key)) {
            buckets.set(key, {
                key,
                title,
                unknown,
                students: []
            });
        }
        buckets.get(key).students.push(student);
    }

    const groups = Array.from(buckets.values()).map((group) => {
        group.students.sort((a, b) => compareNames(a.name, b.name));
        group.previousLeague = grouping === PLACEMENT_GROUP_MODES.LEAGUE && !group.unknown
            ? group.title
            : majorityPreviousLeague(group.students);
        group.previousTeacher = majorityPreviousTeacher(group.students);
        group.previousClassName = grouping === PLACEMENT_GROUP_MODES.CLASS && !group.unknown
            ? group.title
            : majorityPreviousClassName(group.students);
        group.naturalNextLeague = getNaturalProgressionLeague(group.previousLeague);
        group.subtitle = describeGroup(grouping, group);
        return group;
    });

    return sortGroups(groups, grouping);
}

function rankClassEntries(entries) {
    return entries.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.rosterCount !== b.rosterCount) return a.rosterCount - b.rosterCount;
        return compareNames(a.classData.name, b.classData.name);
    });
}

function markBestDestination(ranked) {
    if (!ranked.length) return ranked;
    ranked[0].isBest = true;
    if (!ranked[0].reason) {
        ranked[0].reason = 'Available September class';
    }
    return ranked;
}

export function suggestClassesForStudent(student, classes = [], options = {}) {
    const rosterCounts = options.rosterCounts || {};
    const perspective = options.perspective || 'teacher';
    const ranked = getActivePlacementClasses(classes).map((targetClass) => {
        const match = scoreStudentForClass(student, targetClass, { perspective });
        return {
            classData: targetClass,
            score: match.score,
            reason: match.reason,
            prevLeague: match.prevLeague,
            previousClassName: match.previousClassName,
            rosterCount: Number(rosterCounts[targetClass.id] || 0),
            isBest: false
        };
    });
    return markBestDestination(rankClassEntries(ranked));
}

export function suggestDestinationClasses(group, classes = [], options = {}) {
    const students = group?.students || [];
    const rosterCounts = options.rosterCounts || {};
    const perspective = options.perspective || 'teacher';
    const majorityLeague = group?.previousLeague || majorityPreviousLeague(students);
    const majorityTeacher = group?.previousTeacher || majorityPreviousTeacher(students);
    const previousClassName = group?.previousClassName || majorityPreviousClassName(students);
    const synthetic = {
        previousQuestLevel: majorityLeague || '',
        previousTeacher: majorityTeacher,
        previousClassName
    };

    const ranked = getActivePlacementClasses(classes).map((targetClass) => {
        const match = scoreStudentForClass(synthetic, targetClass, { perspective });
        return {
            classData: targetClass,
            score: match.score,
            reason: match.reason,
            prevLeague: match.prevLeague,
            previousClassName: match.previousClassName,
            rosterCount: Number(rosterCounts[targetClass.id] || 0),
            isBest: false
        };
    });
    return markBestDestination(rankClassEntries(ranked));
}
