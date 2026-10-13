// db/actions/showdownStars.js — the Showdown Arena's reward stars (Quest Remote).
// A Showdown star is a bonus on top of the lesson: it goes to the hero's monthly and total stars (and
// the Gold and Glory any star brings), with its own award_log row, but it never touches today's stars
// (today_stars), so the hero can still earn the day's stars on the Award Stars screen afterwards.
// Paid once per show: every row has a deterministic id (show + hero), so a second tap or a resent
// command pays nobody twice.
import { db, doc, runTransaction, serverTimestamp, increment } from '../../firebase.js';
import * as state from '../../state.js';
import { getTodayDateString } from '../../utils.js';
import { updateGuildScores } from '../../features/guildScoring.js';
import { withActiveScoreYear, withSchoolYear } from '../../utils/schoolYear.js';
import { getLiveYearGold, getLiveYearGoldContextFromState } from '../../utils/yearGold.js';
import { PUBLIC_DATA_PATH } from '../../utils/tenant.mjs';
import { monthlyStarsChange } from './monthlyStars.js';
import { getStartOfMonthString } from '../../utils.js';
import { SHOWDOWN_AWARD_REASON } from '../../features/awardLogReasonMeta.js';

export { SHOWDOWN_AWARD_REASON };

/** The award_log id of one hero's reward from one show. */
export function showdownAwardLogId(showId, studentId) {
    return `showdown_${String(showId).replace(/[^\w-]/g, '').slice(0, 40)}_${studentId}`;
}

/**
 * Pays `stars` (1–3) to each hero in one transaction. `note` (or `noteOf(studentId)`) says what the
 * stars were for, in the logbook.
 * @returns {Promise<{ paid: string[], already: string[] }>}
 */
export async function payShowdownStars({ classId, showId, heroIds = [], stars = 1, note = 'Showdown Arena', noteOf = null }) {
    const amount = Math.max(1, Math.min(3, Math.round(Number(stars) || 1)));
    const ids = [...new Set(heroIds.map(String))].filter(Boolean);
    const yearKey = state.getActiveSchoolYearKey();
    const teacher = { uid: state.get('currentUserId'), name: state.get('currentTeacherName') };
    const goldContext = getLiveYearGoldContextFromState(state);
    const paid = [];
    const already = [];
    if (!ids.length || !showId) return { paid, already };

    await runTransaction(db, async (transaction) => {
        paid.length = 0;
        already.length = 0;
        const reads = await Promise.all(ids.map(async (studentId) => {
            const scoreRef = doc(db, `${PUBLIC_DATA_PATH}/student_scores`, studentId);
            const logRef = doc(db, `${PUBLIC_DATA_PATH}/award_log`, showdownAwardLogId(showId, studentId));
            const [scoreSnap, logSnap] = await Promise.all([transaction.get(scoreRef), transaction.get(logRef)]);
            return { studentId, scoreRef, scoreSnap, logRef, logSnap };
        }));
        for (const { studentId, scoreRef, scoreSnap, logRef, logSnap } of reads) {
            if (logSnap.exists()) { already.push(studentId); continue; }
            if (scoreSnap.exists()) {
                // monthly and total only (never today_stars), with the Gold a star always brings
                transaction.update(scoreRef, {
                    totalStars: increment(amount),
                    ...monthlyStarsChange(transaction, studentId, scoreSnap.data(), amount),
                    gold: getLiveYearGold(scoreSnap.data(), goldContext) + amount
                });
            } else {
                const student = state.get('allStudents')?.find((s) => s.id === studentId);
                transaction.set(scoreRef, withActiveScoreYear({
                    totalStars: amount, monthlyStars: amount, gold: amount, inventory: [],
                    lastMonthlyResetDate: getStartOfMonthString(),
                    createdBy: student?.createdBy || teacher
                }, yearKey));
            }
            transaction.set(logRef, withSchoolYear({
                studentId,
                classId,
                teacherId: teacher.uid,
                stars: amount,
                appliedStarCredit: amount,
                reason: SHOWDOWN_AWARD_REASON,
                note: String((typeof noteOf === 'function' && noteOf(studentId)) || note || 'Showdown Arena').slice(0, 140),
                showdownId: String(showId),
                date: getTodayDateString(),
                createdAt: serverTimestamp(),
                createdBy: teacher
            }, yearKey));
            paid.push(studentId);
        }
    });

    // Glory follows the stars, the same as any other star.
    for (const studentId of paid) {
        await updateGuildScores(studentId, amount, SHOWDOWN_AWARD_REASON, { idempotencyKey: showdownAwardLogId(showId, studentId) }).catch((error) => {
            console.warn('Showdown Glory failed for a hero:', error);
        });
    }
    return { paid, already };
}
