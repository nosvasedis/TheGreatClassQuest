import { questLeagues } from '../constants.js';

export function getNaturalProgressionLeague(previousLeague) {
    const idx = questLeagues.indexOf(previousLeague);
    if (idx < 0 || idx + 1 >= questLeagues.length) return null;
    return questLeagues[idx + 1];
}

export function getUnplacedStudents(students = []) {
    return students.filter((student) => student.enrollmentStatus === 'pendingPlacement');
}

export function scoreStudentForClass(student, targetClass) {
    const prevLeague = student.previousQuestLevel || '';
    const targetLeague = targetClass?.questLevel || '';
    const nextLeague = getNaturalProgressionLeague(prevLeague);
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
        reason = reason ? `${reason} • was with you last year` : 'Was with you last year';
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
