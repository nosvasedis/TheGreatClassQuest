// Monthly star counter writes inside a transaction. The rule lives in
// features/monthlyStarsCore.mjs; this file only turns it into Firestore writes.
import { db, doc, increment } from "../../firebase.js";
import * as state from "../../state.js";
import { getStartOfMonthString } from "../../utils.js";
import { withSchoolYear } from "../../utils/schoolYear.js";
import { PUBLIC_DATA_PATH } from "../../utils/tenant.mjs";
import { planMonthlyRollover } from "../../features/monthlyStarsCore.mjs";

/**
 * Rolls a stale monthly counter over (archiving last month's stars) and returns
 * { base, fields }: base = the counter's value for this month before the change,
 * fields = the stamp to merge into the score update. Call after the transaction's reads.
 */
export function rollMonthlyStars(transaction, studentId, scoreData, monthStart = getStartOfMonthString()) {
    const plan = planMonthlyRollover(scoreData, monthStart);
    if (plan.archive) {
        transaction.set(
            doc(db, `${PUBLIC_DATA_PATH}/student_scores/${studentId}/monthly_history/${plan.archive.month}`),
            withSchoolYear(
                { stars: plan.archive.stars, month: plan.archive.month },
                scoreData?.activeSchoolYearKey || state.getActiveSchoolYearKey(),
            ),
        );
    }
    return { base: plan.base, stale: plan.stale, fields: plan.stamp };
}

/**
 * Score fields that add `delta` stars to this month's counter (negative takes them back).
 * A stale counter is rolled over first, so the stars land in this month.
 */
export function monthlyStarsChange(transaction, studentId, scoreData, delta) {
    const { stale, fields } = rollMonthlyStars(transaction, studentId, scoreData);
    return stale
        ? { ...fields, monthlyStars: Math.max(0, delta) }
        : { ...fields, monthlyStars: increment(delta) };
}
