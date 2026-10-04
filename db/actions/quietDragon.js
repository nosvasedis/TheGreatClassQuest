// db/actions/quietDragon.js — the Quiet Dragon's gift.
// A calm session counts as a completed class bounty (saved in quest_bounties with the teacher's
// reward), and the hoard gift the teacher chose is paid here: Gold or a Calm Star for every hero
// who is here, or a Team Quest boost for the class. Paid once per session (the bounty's id is the
// session's). Nothing is ever taken away.
import { db, doc, collection, runTransaction, serverTimestamp, increment } from '../../firebase.js';
import * as state from '../../state.js';
import { getTodayDateString } from '../../utils.js';
import { updateGuildScores } from '../../features/guildScoring.js';
import { applyClassQuestBonusDelta } from './fortuneWheelEffects.js';
import { withActiveScoreYear, withSchoolYear } from '../../utils/schoolYear.js';
import { getLiveYearGold, getLiveYearGoldContextFromState } from '../../utils/yearGold.js';
import { normalizeGift, describeGift, levelByKey } from '../../features/quietDragonCore.mjs';

const PUBLIC_DATA_PATH = 'artifacts/great-class-quest/public/data';
const ALREADY_PAID = 'quiet-dragon-already-paid';
export const QUIET_DRAGON_REASON = 'quiet_dragon';

/**
 * Pays the gift for one calm session.
 * @returns {{ paid: boolean, alreadyPaid?: boolean, heroes: number, gift: object, questBonus: number }}
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

    try {
        await runTransaction(db, async (transaction) => {
            const bountySnap = await transaction.get(bountyRef);
            if (bountySnap.exists()) throw new Error(ALREADY_PAID);
            const reads = perHero
                ? await Promise.all(ids.map(async (studentId) => {
                    const scoreRef = doc(db, `${PUBLIC_DATA_PATH}/student_scores`, studentId);
                    return { studentId, scoreRef, scoreSnap: await transaction.get(scoreRef) };
                }))
                : [];

            for (const { studentId, scoreRef, scoreSnap } of reads) {
                const gold = hoard.key === 'gold' ? hoard.amount : 0;
                const stars = hoard.key === 'stars' ? hoard.amount : 0;
                if (scoreSnap.exists()) {
                    const updates = {};
                    if (gold) updates.gold = getLiveYearGold(scoreSnap.data(), goldContext) + gold;
                    if (stars) {
                        updates.totalStars = increment(stars);
                        updates.monthlyStars = increment(stars);
                    }
                    transaction.update(scoreRef, updates);
                } else {
                    const student = state.get('allStudents')?.find((s) => s.id === studentId);
                    transaction.set(scoreRef, withActiveScoreYear({
                        totalStars: stars, monthlyStars: stars, gold, inventory: [],
                        createdBy: student?.createdBy || teacher
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
                quietDragon: { minutes, level: level.key, wakes, gift: clean, heroes: perHero ? ids.length : 0 },
                createdBy: teacher,
                createdAt: serverTimestamp(),
                claimedAt: serverTimestamp()
            }, yearKey));
        });
    } catch (error) {
        if (error?.message === ALREADY_PAID) return { paid: false, alreadyPaid: true, heroes: 0, gift: clean, questBonus: 0 };
        throw error;
    }

    // Glory follows the stars, the same as any other star.
    if (hoard.key === 'stars') {
        for (const studentId of ids) {
            await updateGuildScores(studentId, hoard.amount, QUIET_DRAGON_REASON).catch((error) => {
                console.warn('Quiet Dragon Glory failed for a hero:', error);
            });
        }
    }
    let questBonus = 0;
    if (hoard.key === 'quest') {
        const result = await applyClassQuestBonusDelta(classId, hoard.amount, 'The Quiet Dragon').catch((error) => {
            console.warn('Quiet Dragon Team Quest boost failed:', error);
            return null;
        });
        questBonus = Number(result?.classQuestDelta) || 0;
    }
    return { paid: true, heroes: perHero ? ids.length : 0, gift: clean, questBonus };
}
