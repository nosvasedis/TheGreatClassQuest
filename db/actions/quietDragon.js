// db/actions/quietDragon.js — the Quiet Dragon's gift.
// A calm session counts as a completed class bounty (saved in quest_bounties with the teacher's
// reward), and the hoard gift the teacher chose is paid here: Gold or a Calm Star for every hero
// who is here, or a Team Quest boost for the class. Paid once per session (the bounty's id is the
// session's, and it lists the heroes already paid). Nothing is ever taken away.
import { db, doc, collection, runTransaction, serverTimestamp, increment, updateDoc } from '../../firebase.js';
import * as state from '../../state.js';
import { getTodayDateString } from '../../utils.js';
import { updateGuildScores } from '../../features/guildScoring.js';
import { applyClassQuestBonusDelta } from './fortuneWheelEffects.js';
import { withActiveScoreYear, withSchoolYear } from '../../utils/schoolYear.js';
import { getLiveYearGold, getLiveYearGoldContextFromState } from '../../utils/yearGold.js';
import { normalizeGift, describeGift, levelByKey } from '../../features/quietDragonCore.mjs';
import { PUBLIC_DATA_PATH } from '../../utils/tenant.mjs';
import { monthlyStarsChange } from './monthlyStars.js';
import { getStartOfMonthString } from '../../utils.js';

export const QUIET_DRAGON_REASON = 'quiet_dragon';
// The security rules may look up at most 20 documents in one request, and every hero's score
// costs one lookup (their student record) on top of the teacher's own profile and school year.
// A whole class in one transaction ran past that limit and the Gold never saved, so heroes are
// paid in small groups, each its own transaction, and the session's bounty remembers who has
// been paid. A retry simply carries on with the heroes still waiting.
const HEROES_PER_WRITE = 5;

function chunk(list, size) {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
}

/**
 * Pays the gift for one calm session. Safe to call again: heroes already paid are skipped.
 * @returns {{ paid: boolean, alreadyPaid?: boolean, heroes: number, missed?: number, gift: object, questBonus: number }}
 */
export async function payQuietDragonGift({ classId, sessionId, gift, heroIds = [], minutes = 0, levelKey = 'whisper', wakes = 0 }) {
    const clean = normalizeGift(gift);
    const { hoard } = clean;
    const yearKey = state.getActiveSchoolYearKey();
    const teacher = { uid: state.get('currentUserId'), name: state.get('currentTeacherName') };
    const goldContext = getLiveYearGoldContextFromState(state);
    const ids = [...new Set(heroIds.map(String))];
    const perHero = hoard.key === 'gold' || hoard.key === 'stars';
    const bountyRef = doc(db, `${PUBLIC_DATA_PATH}/quest_bounties`, `quiet_dragon_${sessionId}`);
    const level = levelByKey(levelKey);
    const title = `The Quiet Dragon: ${minutes} calm minute${minutes === 1 ? '' : 's'}`;

    // 1. The session's bounty: written once, then it keeps the list of heroes already paid.
    const opened = await runTransaction(db, async (transaction) => {
        const bountySnap = await transaction.get(bountyRef);
        if (bountySnap.exists()) {
            const qd = bountySnap.data().quietDragon || {};
            // Older sessions (one transaction for everyone) have no list: they were paid in full.
            const paidIds = Array.isArray(qd.paidIds) ? qd.paidIds.map(String) : (perHero ? ids : []);
            return { fresh: false, paidIds, questPaid: qd.questPaid !== false };
        }
        const now = new Date().toISOString();
        transaction.set(bountyRef, withSchoolYear({
            classId,
            title,
            reward: describeGift(clean),
            type: 'standard',
            source: QUIET_DRAGON_REASON,
            audience: { kind: 'class', guildId: null, studentIds: [], label: '' },
            target: 0,
            currentProgress: 0,
            deadline: now,
            status: 'completed',
            quietDragon: { minutes, level: level.key, wakes, gift: clean, heroes: perHero ? ids.length : 0, paidIds: [], questPaid: hoard.key !== 'quest' },
            createdBy: teacher,
            createdAt: serverTimestamp(),
            claimedAt: serverTimestamp()
        }, yearKey));
        return { fresh: true, paidIds: [], questPaid: hoard.key !== 'quest' };
    });

    // 2. Gold or a Calm Star for every hero here, a few heroes per write.
    const paidNow = [];
    let missed = 0;
    if (perHero) {
        const waiting = ids.filter((id) => !opened.paidIds.includes(id));
        for (const group of chunk(waiting, HEROES_PER_WRITE)) {
            try {
                const done = await payHeroes({ group, bountyRef, hoard, classId, minutes, teacher, yearKey, goldContext });
                paidNow.push(...done);
            } catch (error) {
                console.error('Quiet Dragon gift failed for a group of heroes:', error);
                missed += group.length;
            }
        }
        // Glory follows the stars, the same as any other star.
        if (hoard.key === 'stars') {
            for (const studentId of paidNow) {
                await updateGuildScores(studentId, hoard.amount, QUIET_DRAGON_REASON).catch((error) => {
                    console.warn('Quiet Dragon Glory failed for a hero:', error);
                });
            }
        }
    }

    // 3. The Team Quest boost, once.
    let questBonus = 0;
    if (hoard.key === 'quest' && !opened.questPaid) {
        const result = await applyClassQuestBonusDelta(classId, hoard.amount, 'The Quiet Dragon').catch((error) => {
            console.warn('Quiet Dragon Team Quest boost failed:', error);
            return null;
        });
        if (result) {
            questBonus = Number(result?.classQuestDelta) || 0;
            await updateDoc(bountyRef, { 'quietDragon.questPaid': true }).catch((error) => console.warn('Quiet Dragon quest mark failed:', error));
        } else {
            missed += 1;
        }
    }

    const heroes = perHero ? opened.paidIds.length + paidNow.length : 0;
    const nothingNew = !opened.fresh && !paidNow.length && !questBonus;
    return { paid: missed === 0, alreadyPaid: nothingNew && missed === 0, heroes, missed, gift: clean, questBonus };
}

/** One small transaction: pays these heroes and adds them to the bounty's paid list. */
async function payHeroes({ group, bountyRef, hoard, classId, minutes, teacher, yearKey, goldContext }) {
    return runTransaction(db, async (transaction) => {
        const bountySnap = await transaction.get(bountyRef);
        const already = new Set((bountySnap.data()?.quietDragon?.paidIds || []).map(String));
        const todo = group.filter((id) => !already.has(id));
        if (!todo.length) return [];
        const reads = await Promise.all(todo.map(async (studentId) => {
            const scoreRef = doc(db, `${PUBLIC_DATA_PATH}/student_scores`, studentId);
            return { studentId, scoreRef, scoreSnap: await transaction.get(scoreRef) };
        }));
        const gold = hoard.key === 'gold' ? hoard.amount : 0;
        const stars = hoard.key === 'stars' ? hoard.amount : 0;
        for (const { studentId, scoreRef, scoreSnap } of reads) {
            if (scoreSnap.exists()) {
                const updates = {};
                if (gold) updates.gold = getLiveYearGold(scoreSnap.data(), goldContext) + gold;
                if (stars) {
                    updates.totalStars = increment(stars);
                    Object.assign(updates, monthlyStarsChange(transaction, studentId, scoreSnap.data(), stars));
                }
                transaction.update(scoreRef, updates);
            } else {
                transaction.set(scoreRef, withActiveScoreYear({
                    totalStars: stars, monthlyStars: stars, gold, inventory: [],
                    lastMonthlyResetDate: getStartOfMonthString(),
                    createdBy: teacher
                }, yearKey));
            }
            if (stars) {
                transaction.set(doc(collection(db, `${PUBLIC_DATA_PATH}/award_log`)), withSchoolYear({
                    studentId,
                    classId,
                    teacherId: teacher.uid,
                    stars,
                    appliedStarCredit: stars,
                    reason: QUIET_DRAGON_REASON,
                    note: `The Quiet Dragon: ${minutes} calm minutes`,
                    date: getTodayDateString(),
                    createdAt: serverTimestamp(),
                    createdBy: teacher
                }, yearKey));
            }
        }
        transaction.update(bountyRef, { 'quietDragon.paidIds': [...already, ...todo] });
        return todo;
    });
}
