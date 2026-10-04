// features/bountyAudience.mjs — who a bounty is for: the whole class, one guild, or a chosen group of heroes.
// Pure: no DOM, no Firebase. The poster (ui/modals/bountyPoster.js) builds the audience,
// db/actions/bounties.js counts stars against it, and the bounty cards label it.

export const AUDIENCE_KINDS = ['class', 'guild', 'heroes'];

/** Reads a bounty's audience; bounties from before group bounties are whole-class. */
export function normalizeAudience(source) {
    const raw = source?.audience ?? source ?? null;
    const kind = AUDIENCE_KINDS.includes(raw?.kind) ? raw.kind : 'class';
    if (kind === 'guild' && raw.guildId) {
        return { kind, guildId: String(raw.guildId), studentIds: [], label: String(raw.label || '') };
    }
    if (kind === 'heroes') {
        const studentIds = [...new Set((raw.studentIds || []).map(String).filter(Boolean))];
        if (studentIds.length) return { kind, guildId: null, studentIds, label: String(raw.label || '') };
    }
    return { kind: 'class', guildId: null, studentIds: [], label: '' };
}

export function isGroupBounty(bounty) {
    return normalizeAudience(bounty).kind !== 'class';
}

/** True when this student's stars count toward the bounty. */
export function audienceIncludes(bounty, student) {
    if (!student) return false;
    const audience = normalizeAudience(bounty);
    if (audience.kind === 'guild') return student.guildId === audience.guildId;
    if (audience.kind === 'heroes') return audience.studentIds.includes(String(student.id));
    return true;
}

/** The students of a class that a bounty is for. */
export function audienceMembers(bounty, classStudents = []) {
    return (classStudents || []).filter((student) => audienceIncludes(bounty, student));
}

/**
 * Stars a bounty gains from one award. `starsAdded` is the total for the award and
 * `studentIds` the heroes who earned it (shared equally). Without studentIds only
 * whole-class bounties count, because nobody knows whose stars they were.
 */
export function bountyStarsFromAward(bounty, starsAdded, studentIds, studentsById) {
    const total = Number(starsAdded) || 0;
    if (!total) return 0;
    const audience = normalizeAudience(bounty);
    if (audience.kind === 'class') return total;
    const ids = (studentIds || []).filter(Boolean);
    if (!ids.length) return 0;
    const each = total / ids.length;
    const lookup = (id) => (studentsById instanceof Map ? studentsById.get(id) : studentsById?.[id]) || null;
    const counted = ids.filter((id) => audienceIncludes(bounty, lookup(id) || { id })).length;
    return Math.round(each * counted * 100) / 100;
}

/** Short words for cards and the poster: "Whole class", "Dragon Flame", "5 heroes". */
export function describeAudience(bounty, { guildName = null, guildEmoji = '' } = {}) {
    const audience = normalizeAudience(bounty);
    if (audience.kind === 'guild') {
        const name = guildName || audience.label || 'One guild';
        return { kind: 'guild', short: name, emoji: guildEmoji || '🛡️', who: name };
    }
    if (audience.kind === 'heroes') {
        const n = audience.studentIds.length;
        const named = audience.label || `${n} ${n === 1 ? 'hero' : 'heroes'}`;
        return { kind: 'heroes', short: named, emoji: '🧭', who: named };
    }
    return { kind: 'class', short: 'Whole class', emoji: '🏰', who: 'The whole class' };
}

/** Star-target scale for a group: its share of the class, never below a fifth. */
export function audienceShare(memberCount, classCount) {
    const members = Number(memberCount) || 0;
    const all = Number(classCount) || 0;
    if (!all || !members) return 1;
    return Math.min(1, Math.max(0.2, members / all));
}
