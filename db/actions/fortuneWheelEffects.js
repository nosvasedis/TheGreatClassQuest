import {
    db,
    doc,
    runTransaction,
    serverTimestamp,
    collection
} from '../../firebase.js';
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { LEGENDARY_ARTIFACTS } from '../../features/powerUps.js';

const publicDataPath = 'artifacts/great-class-quest/public/data';

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function pickRandom(items, count) {
    if (!Array.isArray(items) || items.length === 0 || count <= 0) return [];
    return shuffleArray([...items]).slice(0, Math.min(count, items.length));
}

function buildWheelLogPayload({ studentId, classId, deltaStars = 0, deltaGold = 0, artifactsGranted = 0, artifactsRemoved = 0, note = '' }) {
    return {
        studentId,
        classId,
        teacherId: state.get('currentUserId'),
        stars: 0,
        reason: deltaStars < 0 ? 'wheel_curse' : 'wheel_fortune',
        note: String(note || '').trim() || 'Wheel of Fortune',
        date: utils.getTodayDateString(),
        createdAt: serverTimestamp(),
        createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') },
        wheel: {
            deltaStars,
            deltaGold,
            artifactsGranted,
            artifactsRemoved
        }
    };
}

function ensureScoreDoc(transaction, scoreRef, studentId, existing) {
    if (existing) return existing;
    const init = {
        totalStars: 0,
        monthlyStars: 0,
        gold: 0,
        inventory: [],
        starsByReason: {},
        heroLevel: 0,
        heroSkills: [],
        pendingSkillChoice: false,
        lastMonthlyResetDate: utils.getStartOfMonthString(),
        createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
    };
    transaction.set(scoreRef, init);
    return init;
}

export async function applyWheelStudentEffects({
    classId,
    students = [],
    count = 0,
    starsDelta = 0,
    goldDelta = 0,
    artifactsGrantCount = 0,
    artifactsRemoveCount = 0,
    note = ''
}) {
    const selected = pickRandom(students, count);
    if (selected.length === 0) {
        return {
            affectedStudents: [],
            starsDelta: 0,
            goldDelta: 0,
            artifactsGranted: 0,
            artifactsRemoved: 0
        };
    }

    const affectedStudentIds = selected.map(s => s.id);
    const totalStarsDelta = starsDelta * affectedStudentIds.length;
    const totalGoldDelta = goldDelta * affectedStudentIds.length;

    let artifactsGranted = 0;
    let artifactsRemoved = 0;

    await runTransaction(db, async (transaction) => {
        const scoreSnapshots = new Map();
        for (const studentId of affectedStudentIds) {
            const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
            const scoreSnap = await transaction.get(scoreRef);
            scoreSnapshots.set(studentId, { scoreRef, scoreSnap });
        }

        for (const studentId of affectedStudentIds) {
            const { scoreRef, scoreSnap } = scoreSnapshots.get(studentId) || {};
            if (!scoreRef || !scoreSnap) continue;
            const scoreData = ensureScoreDoc(transaction, scoreRef, studentId, scoreSnap.exists() ? scoreSnap.data() : null);

            const currentTotalStars = Number(scoreData.totalStars) || 0;
            const currentMonthlyStars = Number(scoreData.monthlyStars) || 0;
            const currentGold = typeof scoreData.gold === 'number' ? scoreData.gold : currentTotalStars;
            const currentInventory = Array.isArray(scoreData.inventory) ? [...scoreData.inventory] : [];

            const next = {};

            if (starsDelta !== 0) {
                const nextTotal = Math.max(0, currentTotalStars + starsDelta);
                const nextMonthly = Math.max(0, currentMonthlyStars + starsDelta);
                next.totalStars = nextTotal;
                next.monthlyStars = nextMonthly;
            }

            if (goldDelta !== 0) {
                next.gold = Math.max(0, currentGold + goldDelta);
            }

            let nextInventory = currentInventory;

            if (artifactsGrantCount > 0) {
                for (let i = 0; i < artifactsGrantCount; i++) {
                    const pick = LEGENDARY_ARTIFACTS[Math.floor(Math.random() * LEGENDARY_ARTIFACTS.length)];
                    if (!pick) continue;
                    nextInventory = [...nextInventory, {
                        id: pick.id,
                        name: pick.name,
                        image: null,
                        icon: pick.icon || null,
                        description: pick.description,
                        acquiredAt: new Date().toISOString()
                    }];
                    artifactsGranted += 1;
                }
            }

            if (artifactsRemoveCount > 0 && nextInventory.length > 0) {
                const removeCount = Math.min(artifactsRemoveCount, nextInventory.length);
                const indices = shuffleArray([...Array(nextInventory.length).keys()]).slice(0, removeCount).sort((a, b) => b - a);
                const mutable = [...nextInventory];
                for (const idx of indices) {
                    mutable.splice(idx, 1);
                    artifactsRemoved += 1;
                }
                nextInventory = mutable;
            }

            if (artifactsGrantCount > 0 || artifactsRemoveCount > 0) {
                next.inventory = nextInventory;
            }

            if (Object.keys(next).length > 0) {
                transaction.update(scoreRef, next);
            }

            const logRef = doc(collection(db, `${publicDataPath}/award_log`));
            transaction.set(logRef, buildWheelLogPayload({
                studentId,
                classId,
                deltaStars: starsDelta,
                deltaGold: goldDelta,
                artifactsGranted: artifactsGrantCount,
                artifactsRemoved: artifactsRemoveCount,
                note
            }));
        }
    });

    return {
        affectedStudents: affectedStudentIds,
        starsDelta: totalStarsDelta,
        goldDelta: totalGoldDelta,
        artifactsGranted,
        artifactsRemoved
    };
}

export async function applyClassQuestBonusDelta(classId, delta, note = '') {
    if (!classId || !delta) {
        return { classQuestDelta: 0, description: '' };
    }

    const monthKey = utils.getMonthKey(new Date());
    const classRef = doc(db, `${publicDataPath}/classes`, classId);

    let appliedDelta = 0;

    await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(classRef);
        if (!snap.exists()) return;
        const data = snap.data() || {};
        const current = Number(data.teamQuestBonuses?.[monthKey]) || 0;
        const next = Math.max(0, current + delta);
        appliedDelta = next - current;
        if (appliedDelta === 0) return;
        transaction.update(classRef, {
            [`teamQuestBonuses.${monthKey}`]: next,
            lastWheelQuestBonusAt: serverTimestamp(),
            lastWheelQuestBonusNote: String(note || '').slice(0, 160)
        });
    });

    return { classQuestDelta: appliedDelta };
}

export function pickWheelStudents(students, count) {
    return pickRandom(students, count);
}

