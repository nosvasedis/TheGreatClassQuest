// Student Star Manager writes (Settings › Student Tools). Loaded only when the Star Manager
// is opened. The rules live in features/starManagerCore.mjs.
import {
    db,
    doc,
    collection,
    query,
    where,
    getDocs,
    runTransaction,
    serverTimestamp,
    increment,
} from "../../firebase.js";
import * as state from "../../state.js";
import { getTodayDateString, getStartOfMonthString } from "../../utils.js";
import { withSchoolYear } from "../../utils/schoolYear.js";
import { PUBLIC_DATA_PATH } from "../../utils/tenant.mjs";
import { recordGuildGloryEvent, updateGuildScores } from "../../features/guildScoring.js";
import { reconcileFamiliarLifecycle } from "../../features/familiars.js";
import { STAR_MANAGER_SOURCE } from "../../features/awardLogReasonMeta.js";
import { monthlyStarsChange, rollMonthlyStars } from "./monthlyStars.js";
import { planMonthlyRollover } from "../../features/monthlyStarsCore.mjs";
import { getTodayStarsDocId } from "./stars.js";
import { planMonthTarget, toDDMMYYYY, roundToHalf } from "../../features/starManagerCore.mjs";

/** award_log rows of one class on one day (the day the teacher is mending). */
export async function fetchClassDayAwardLogs(classId, ddmmyyyy) {
    if (!classId || !ddmmyyyy) return [];
    const snap = await getDocs(query(
        collection(db, `${PUBLIC_DATA_PATH}/award_log`),
        where("classId", "==", classId),
        where("date", "==", ddmmyyyy),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Adds one dated award_log row for one student and credits the month it belongs to:
 * this month's counter, a counter still holding that month, or that month's archive.
 * Never touches today's stars (a Star Manager row is a repair, not the day's award).
 */
async function addMissedStarsForStudent({ student, logDate, stars, reason, now, announce }) {
    const studentId = student.id;
    const dateForDb = toDDMMYYYY(logDate);
    let target = null;
    await runTransaction(db, async (transaction) => {
        const scoreRef = doc(db, `${PUBLIC_DATA_PATH}/student_scores`, studentId);
        const scoreDoc = await transaction.get(scoreRef);
        if (!scoreDoc.exists()) throw new Error("no star record yet (give them a star in Award Stars first)");
        const scoreData = scoreDoc.data();
        target = planMonthTarget(logDate, scoreData, now);
        const historyRef = target.kind === "history"
            ? doc(db, `${PUBLIC_DATA_PATH}/student_scores/${studentId}/monthly_history/${target.monthKey}`)
            : null;
        const historyDoc = historyRef ? await transaction.get(historyRef) : null;

        transaction.set(doc(collection(db, `${PUBLIC_DATA_PATH}/award_log`)), withSchoolYear({
            studentId,
            classId: student.classId,
            teacherId: state.get("currentUserId"),
            stars,
            appliedStarCredit: stars,
            reason,
            source: STAR_MANAGER_SOURCE,
            date: dateForDb,
            createdAt: serverTimestamp(),
            createdBy: {
                uid: state.get("currentUserId"),
                name: state.get("currentTeacherName"),
            },
        }, state.getActiveSchoolYearKey()));

        const updates = { totalStars: increment(stars) };
        if (target.kind === "current") {
            // A counter still holding last month's stars is rolled over first, or these
            // stars would be hidden from Team Quest and later filed under last month.
            Object.assign(updates, monthlyStarsChange(transaction, studentId, scoreData, stars));
        } else if (target.kind === "counter") {
            updates.monthlyStars = increment(stars);
        } else if (historyDoc?.exists()) {
            transaction.update(historyRef, { stars: (Number(historyDoc.data().stars) || 0) + stars });
        } else {
            transaction.set(historyRef, withSchoolYear(
                { stars, month: target.monthKey },
                scoreData.activeSchoolYearKey || state.getActiveSchoolYearKey(),
            ));
        }
        transaction.update(scoreRef, updates);
    });

    // Glory goes to the Chapter of the lesson's month, as a deleted row takes it back from.
    updateGuildScores(studentId, stars, "manual_star_add", { chapter: target?.monthKey || true })
        .catch((error) => console.warn("Star Manager Guild Glory failed:", error));
    reconcileFamiliarLifecycle(studentId, { announce, source: "manual-log" })
        .catch((e) => console.warn("Star Manager familiar reconciliation failed:", e));
    return target;
}

/**
 * Adds `stars` for `reason` on `logDate` to each student, one after another, so one
 * failure never stops the rest. Resolves to { added: [ids], failed: [{ id, message }] }.
 */
export async function addMissedStars({ students = [], logDate, stars, reason, now = new Date(), onProgress = () => {} }) {
    const added = [];
    const failed = [];
    const months = new Set();
    for (const student of students) {
        try {
            const target = await addMissedStarsForStudent({ student, logDate, stars, reason, now, announce: students.length === 1 });
            if (target?.monthKey && target.kind !== "current") months.add(target.monthKey);
            added.push(student.id);
        } catch (error) {
            console.error("Star Manager add failed:", student?.id, error);
            failed.push({ id: student.id, message: error?.message || "could not be saved" });
        }
        onProgress({ done: added.length + failed.length, total: students.length });
    }
    // A finished month's ceremony check must look again at the stars it now holds.
    if (months.size) {
        import("../../features/ceremonyStarCheck.js")
            .then((m) => months.forEach((key) => m.forgetCeremonyStarVerdict?.(key)))
            .catch(() => {});
    }
    return { added, failed };
}

export class StarCountsChangedError extends Error {
    constructor() {
        super("This student's stars changed while you were editing.");
        this.name = "StarCountsChangedError";
    }
}

/**
 * Sets one student's counters. `baseline` holds the values the form started from; if the
 * saved values moved since (an award in another tab, another teacher), nothing is written
 * and StarCountsChangedError is thrown, so a stale form never wipes fresh stars.
 */
export async function setStudentStarCounts({ studentId, values, baseline }) {
    const teacherId = state.get("currentUserId");
    const todayString = getTodayDateString();
    const todayRow = state.get("todaysStars")?.[studentId] || null;
    let previousTotal = 0;
    await runTransaction(db, async (transaction) => {
        const scoreRef = doc(db, `${PUBLIC_DATA_PATH}/student_scores`, studentId);
        const todayRef = todayRow?.docId ? doc(db, `${PUBLIC_DATA_PATH}/today_stars`, todayRow.docId) : null;
        const scoreDoc = await transaction.get(scoreRef);
        if (!scoreDoc.exists()) throw new Error("This student has no star record yet.");
        const todayDoc = todayRef ? await transaction.get(todayRef) : null;
        const scoreData = scoreDoc.data();

        const liveMonthly = planMonthlyRollover(scoreData, getStartOfMonthString()).base;
        const liveTotal = Number(scoreData.totalStars) || 0;
        const liveToday = todayDoc?.exists() ? Number(todayDoc.data().stars) || 0 : 0;
        if (baseline && (
            roundToHalf(liveMonthly) !== roundToHalf(baseline.monthly)
            || roundToHalf(liveTotal) !== roundToHalf(baseline.total)
            || roundToHalf(liveToday) !== roundToHalf(baseline.today)
        )) {
            throw new StarCountsChangedError();
        }
        previousTotal = liveTotal;

        // The value typed is this month's: file a counter still holding last month first
        // and stamp it, or every board would keep reading it as last month's (0).
        const { fields: monthStamp } = rollMonthlyStars(transaction, studentId, scoreData);
        transaction.update(scoreRef, {
            ...monthStamp,
            monthlyStars: values.monthly,
            totalStars: values.total,
        });

        if (values.today > 0) {
            if (todayDoc?.exists()) {
                transaction.update(todayRef, { stars: values.today });
            } else {
                transaction.set(
                    doc(db, `${PUBLIC_DATA_PATH}/today_stars`, getTodayStarsDocId(teacherId, studentId, todayString)),
                    withSchoolYear({
                        studentId,
                        stars: values.today,
                        date: todayString,
                        teacherId,
                        createdBy: { uid: teacherId, name: state.get("currentTeacherName") },
                    }, state.getActiveSchoolYearKey()),
                );
            }
        } else if (todayDoc?.exists()) {
            transaction.delete(todayRef);
        }
    });

    const student = (state.get("allStudents") || []).find((s) => s.id === studentId);
    const totalDelta = values.total - previousTotal;
    if (student?.guildId && totalDelta !== 0) {
        recordGuildGloryEvent({
            guildId: student.guildId,
            studentId,
            classId: student.classId || null,
            source: "manual_score_override",
            starDelta: totalDelta,
            // A correction of the year's total, not something earned this month.
            chapter: false,
            note: "Manual student score override",
        }).catch((e) => console.warn("Override Guild Glory adjustment failed:", e));
    }
    if (totalDelta > 0) {
        reconcileFamiliarLifecycle(studentId, { announce: true, source: "score-override" })
            .catch((e) => console.warn("Override familiar reconciliation failed:", e));
    }
    return { totalDelta };
}
