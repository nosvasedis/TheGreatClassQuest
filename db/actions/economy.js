// /db/actions/economy.js — shop, trials, gold, occasions
import {
    db,
    doc,
    setDoc,
    updateDoc,
    collection,
    runTransaction,
    writeBatch,
    serverTimestamp,
    increment
} from '../../firebase.js';
import * as state from '../../state.js';
import { showToast, showPraiseToast } from '../../ui/effects.js';
import { callGeminiApi, extractJsonFromAiText } from '../../api.js';
import { shopRestockToast, shopItemStock } from '../../utils/shopRestock.js';
import { requireEliteAI } from '../../utils/upgradePrompt.js';
import { canUseFeature } from '../../utils/subscription.js';
import { getTodayDateString, parseFlexibleDate, getSeasonalShopPriceMeta, normalizeToDateString, getLocalIsoDateString } from '../../utils.js';
import { handleMarkAbsent } from './log.js';
import { playSound } from '../../audio.js';
import { reconcileFamiliarLifecycle } from '../../features/familiars.js';
import { classUsesDictations, classUsesTests, createAssessmentScorePayload, getNormalizedPercentForScore, qualifiesForHighScore } from '../../features/assessmentConfig.js';
import { handleUseItem, isItemUsable } from '../../features/powerUps.js';
import { withSchoolYear, isGameplaySeasonLiveFromAppState } from '../../utils/schoolYear.js';
import { getLiveYearGold, getLiveYearGoldContextFromState } from '../../utils/yearGold.js';
import { getYearScopedHeroOfDayWinsFromAppState } from '../../utils/yearLegend.js';
// GUILD_IDS not needed at module level but kept for reference

// --- THE ECONOMY (SHOP & INVENTORY) ---
let isGeneratingShopStock = false;

function animateShopGoldChange(newGoldBalance, durationMs = 650) {
    const goldDisplay = document.getElementById('shop-student-gold');
    if (!goldDisplay) return;

    const oldGold = parseInt(String(goldDisplay.innerText || '0').replace(/[^\d-]/g, ''), 10);
    if (isNaN(oldGold)) {
        goldDisplay.innerText = `${newGoldBalance} 🪙`;
        return;
    }
    if (oldGold === newGoldBalance) return;

    const start = performance.now();
    const diff = newGoldBalance - oldGold;
    goldDisplay.classList.add('coin-update-anim');
    goldDisplay.style.color = diff < 0 ? '#fca5a5' : '#86efac';
    goldDisplay.style.transform = 'scale(1.15)';

    function step(ts) {
        const elapsed = ts - start;
        const t = Math.min(1, elapsed / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        const val = Math.round(oldGold + (diff * eased));
        goldDisplay.innerText = `${val} 🪙`;
        if (t < 1) {
            requestAnimationFrame(step);
        } else {
            goldDisplay.innerText = `${newGoldBalance} 🪙`;
            setTimeout(() => {
                goldDisplay.style.color = '';
                goldDisplay.style.transform = '';
                goldDisplay.classList.remove('coin-update-anim');
            }, 220);
        }
    }
    requestAnimationFrame(step);
}

function showShopPurchasePopup({
    itemName,
    itemDescription,
    itemVisualHtml,
    finalPrice,
    newGoldBalance,
    studentName,
    cta = 'Awesome!',
    useContext = null
}) {
    const purchaseModal = document.getElementById('shop-purchase-modal');
    if (!purchaseModal) return false;

    document.getElementById('shop-purchase-icon').innerHTML = itemVisualHtml;
    document.getElementById('shop-purchase-name').innerText = itemName;
    document.getElementById('shop-purchase-desc').innerText = itemDescription || 'A rare artifact for your collection!';
    document.getElementById('shop-purchase-cost').innerText = `-${finalPrice} 🪙`;
    document.getElementById('shop-purchase-balance').innerText = `${newGoldBalance} 🪙`;
    document.getElementById('shop-purchase-student').innerHTML = `<i class="fas fa-user mr-2"></i><span class="font-bold">${studentName}</span>'s inventory`;
    document.getElementById('shop-purchase-close-btn').innerHTML = `<i class="fas fa-check mr-2"></i>${cta}`;

    purchaseModal.classList.remove('hidden');

    const timerBar = document.getElementById('shop-purchase-timer-bar');
    if (timerBar) {
        timerBar.style.transition = 'none';
        timerBar.style.width = '100%';
        timerBar.offsetWidth;
        timerBar.style.transition = 'width 3s linear';
        timerBar.style.width = '0%';
    }

    const closeBtn = document.getElementById('shop-purchase-close-btn');
    const useBtn = document.getElementById('shop-purchase-use-btn');
    let autoCloseTimer = null;
    let useInFlight = false;
    const closeModal = () => {
        if (useInFlight) return;
        clearTimeout(autoCloseTimer);
        purchaseModal.classList.add('hidden');
        if (useBtn) {
            useBtn.disabled = false;
            useBtn.innerHTML = '<i class="fas fa-bolt mr-2"></i>Use Now';
        }
        if (timerBar) {
            timerBar.style.transition = 'none';
            timerBar.style.width = '100%';
        }
    };

    if (useBtn) {
        useBtn.classList.add('hidden');
        useBtn.onclick = null;
        useBtn.disabled = false;
        useBtn.innerHTML = '<i class="fas fa-bolt mr-2"></i>Use Now';
    }

    const canUseNow = Boolean(
        useContext &&
        useContext.studentId &&
        Number.isInteger(useContext.itemIndex) && useContext.itemIndex >= 0 &&
        isItemUsable(useContext.itemName)
    );

    if (canUseNow && useBtn) {
        useBtn.classList.remove('hidden');
        useBtn.onclick = async () => {
            if (useInFlight) return;
            useInFlight = true;
            clearTimeout(autoCloseTimer);
            useBtn.disabled = true;
            useBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Using...';

            try {
                const result = await handleUseItem(useContext.studentId, useContext.itemIndex);
                if (result?.success) {
                    useInFlight = false;
                    closeModal();
                    return;
                }
            } catch (error) {
                console.error('Use from purchase modal failed:', error);
            } finally {
                useInFlight = false;
            }

            useBtn.disabled = false;
            useBtn.innerHTML = '<i class="fas fa-bolt mr-2"></i>Use Now';
            autoCloseTimer = setTimeout(closeModal, 3000);
        };
    }

    closeBtn.onclick = closeModal;
    autoCloseTimer = setTimeout(closeModal, 3000);
    return true;
}

function assertGameplaySeasonLive(actionLabel = 'The market') {
    if (isGameplaySeasonLiveFromAppState(state)) return true;
    showToast(`${actionLabel} stays sealed until the school year opens.`, 'error');
    return false;
}

function resolveShopLeague() {
    let league = state.get('globalSelectedLeague');
    if (!league) {
        const classId = state.get('globalSelectedClassId');
        if (classId) {
            const cls = state.get('allSchoolClasses').find(c => c.id === classId);
            if (cls) league = cls.questLevel;
        }
    }
    return league;
}

async function runShopStockJob(mode, { toast = false } = {}) {
    if (isGeneratingShopStock) {
        if (toast) showToast('Shop restock is already running in the background.', 'info');
        return null;
    }

    if (!requireEliteAI({ feature: 'Shop item generator' })) return null;
    if (!assertGameplaySeasonLive('The market')) return null;

    const league = resolveShopLeague();
    if (!league) {
        if (toast) showToast("Please select a Class or League first!", "error");
        return null;
    }

    isGeneratingShopStock = true;
    const { setShopRestockBusy } = await import('../../ui/core/shop.js');
    const { ensureShopStock } = await import('../../utils/adminRuntime.js');
    setShopRestockBusy(true);
    if (toast) {
        const started = shopRestockToast({
            mode: mode === 'replace-monthly' ? 'started-replace' : 'ensure-started',
            league
        });
        showToast(started.message, started.type);
    }

    try {
        const result = await ensureShopStock({ league, mode });
        if (toast) {
            if (result?.skipped) {
                showToast('The merchant is already restocking. New treasures will appear as they arrive.', 'info');
            } else if (!result?.monthly) {
                showToast(
                    mode === 'replace-monthly'
                        ? `The merchant could not start a new stall for ${league} just now. Try Restock again in a moment.`
                        : `This month's stall for ${league} is already full.`,
                    'info'
                );
            } else {
                const monthly = result.monthly;
                const done = shopRestockToast({
                    mode: monthly.mode || mode,
                    savedThisRun: monthly.savedThisRun || 0,
                    completeCount: monthly.completeCount || 0,
                    league
                });
                showToast(done.message, done.type);
            }
        }
        return result;
    } catch (error) {
        console.error("Shop generation failed:", error);
        if (toast) showToast('The Merchant got lost. Try again.', 'error');
        return null;
    } finally {
        isGeneratingShopStock = false;
        setShopRestockBusy(false);
    }
}

export async function handleGenerateShopStock() {
    return runShopStockJob('replace-monthly', { toast: true });
}

export async function handleEnsureShopStock() {
    if (!canUseFeature('eliteAI')) return null;
    if (!isGameplaySeasonLiveFromAppState(state)) return null;
    if (!resolveShopLeague()) return null;
    return runShopStockJob('ensure', { toast: false });
}

export async function handleBulkSaveTrial() {
    const modal = document.getElementById('bulk-trial-modal');
    const classId = modal.dataset.classId;
    const type = modal.dataset.type;
    const classData = state.get('allSchoolClasses').find((item) => item.id === classId);

    const date = document.getElementById('bulk-trial-date').value;
    const title = document.getElementById('bulk-trial-name').value.trim();

    if (!date) {
        showToast('Please select a date.', 'error');
        return;
    }

    if (type === 'test' && !title) {
        showToast('Please enter a title for the test.', 'error');
        return;
    }

    const usesType = type === 'dictation' ? classUsesDictations(classData) : classUsesTests(classData);
    if (!usesType) {
        showToast(type === 'dictation' ? 'This class does not use dictations.' : 'This class does not use tests.', 'info');
        return;
    }

    const rows = document.querySelectorAll('.bulk-log-item');
    if (rows.length === 0) return;

    const btn = document.getElementById('bulk-trial-save-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Saving...`;

    const batch = writeBatch(db);
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const scoresCollection = collection(db, `${publicDataPath}/written_scores`);

    let operationsCount = 0;
    const absentStudentIds = [];
    const potentialStarfallStudents = [];
    const savedScoresData = []; // Collection for personal best check

    const canonicalDate = normalizeToDateString(date);
    if (!canonicalDate) {
        showToast('Invalid date selected.', 'error');
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-save mr-2"></i> Save All`;
        return;
    }

    try {
        rows.forEach(row => {
            const studentId = row.dataset.studentId;
            const trialId = row.dataset.trialId;
            const isAbsent = row.querySelector('.toggle-absent-btn').classList.contains('is-absent');
            const input = row.querySelector('.bulk-grade-input');
            const val = input.value;

            if (isAbsent) {
                absentStudentIds.push(studentId);
                if (trialId) {
                    batch.delete(doc(scoresCollection, trialId));
                    operationsCount++;
                }
                return;
            }

            if (!val) return;

            let scoreData;
            try {
                scoreData = createAssessmentScorePayload({
                    studentId,
                    classId,
                    type,
                    title,
                    teacherId: state.get('currentUserId'),
                    date,
                    value: val,
                    classData
                });
            } catch (error) {
                showToast(error.message || 'Could not save this assessment type.', 'error');
                throw error;
            }

            savedScoresData.push({ ...scoreData, id: trialId || 'new' });

            // Logic for Starfall Eligibility Check
            let bonusAmount = 0;
            let isEligible = false;

            if (type === 'test') {
                if (qualifiesForHighScore(scoreData, 'test', classData)) {
                    bonusAmount = 1;
                    isEligible = true;
                }
            } else if (type === 'dictation') {
                if (qualifiesForHighScore(scoreData, 'dictation', classData)) {
                    potentialStarfallStudents.push({ studentId, type: 'dictation', bonusAmount: 0.5 });
                }
            }

            if (isEligible && type === 'test') {
                potentialStarfallStudents.push({ studentId, scoreData, type, bonusAmount });
            }

            if (trialId) {
                batch.update(doc(scoresCollection, trialId), scoreData);
            } else {
                const newRef = doc(scoresCollection);
                scoreData.createdAt = serverTimestamp();
                batch.set(newRef, withSchoolYear(scoreData, state.getActiveSchoolYearKey()));
            }
            operationsCount++;
        });

        const shouldCommitBatch = operationsCount > 0;
        if (!shouldCommitBatch && absentStudentIds.length === 0) {
            showToast('No changes to save.', 'info');
            import('../../ui/modals.js').then(m => m.hideModal('bulk-trial-modal'));
            return;
        }

        if (shouldCommitBatch) {
            await batch.commit();
        }

        let absentApplied = 0;
        for (const sid of absentStudentIds) {
            const absentResult = await handleMarkAbsent(sid, classId, true, canonicalDate, { silent: true });
            if (absentResult === 'marked_absent') absentApplied++;
        }

        // Students who were absent when the modal opened but are now toggled back to present
        const nowPresentIds = [];
        rows.forEach(row => {
            const btn = row.querySelector('.toggle-absent-btn');
            if (!btn) return;
            const wasAbsent = btn.dataset.wasAbsent === 'true';
            const isCurrentlyAbsent = btn.classList.contains('is-absent');
            if (wasAbsent && !isCurrentlyAbsent) {
                nowPresentIds.push(row.dataset.studentId);
            }
        });
        for (const sid of nowPresentIds) {
            await handleMarkAbsent(sid, classId, false, canonicalDate);
        }

        if (shouldCommitBatch) {
            showToast('All grades saved successfully!', 'success');

            // Dynamic import to avoid circular dependency issues
            import('../../ui/modals.js').then(m => m.hideModal('bulk-trial-modal'));

            // --- PERSONAL BEST CHECK ---
            savedScoresData.forEach(savedScore => {
                if (savedScore.type === 'test') {
                    const studentId = savedScore.studentId;
                    const student = state.get('allStudents').find(s => s.id === studentId);
                    const newScorePercent = getNormalizedPercentForScore(savedScore, classData) || 0;

                    const previousScores = state.get('allWrittenScores')
                        .filter(s => s.studentId === studentId && s.type === 'test' && s.id !== savedScore.id);

                    const maxPreviousScore = previousScores.length > 0
                        ? Math.max(...previousScores.map(s => getNormalizedPercentForScore(s, classData) || 0))
                        : 0;

                    if (newScorePercent > maxPreviousScore && maxPreviousScore > 0) {
                        setTimeout(() => {
                            showPraiseToast(`${student.name} just set a new Personal Best on their test!`, '🏆');
                        }, 700);
                    }
                }
            });

            // --- PROCESS STARFALL FOR BATCH ---
            const finalEligibleStudents = [];

            // Test Bonuses
            const testWinners = potentialStarfallStudents.filter(p => p.type === 'test');
            testWinners.forEach(w => {
                const s = state.get('allStudents').find(st => st.id === w.studentId);
                if (s) finalEligibleStudents.push({ studentId: s.id, name: s.name, bonusAmount: w.bonusAmount, trialType: 'test' });
            });

            // Dictation Bonuses
            const dictationCandidates = potentialStarfallStudents.filter(p => p.type === 'dictation');
            if (dictationCandidates.length > 0) {
                const refDate = parseFlexibleDate(date);
                const refYear = refDate ? refDate.getFullYear() : 0;
                const refMonth = refDate ? refDate.getMonth() : -1;

                dictationCandidates.forEach(cand => {
                    const studentScoresThisMonth = state.get('allWrittenScores').filter(s => {
                        const d = parseFlexibleDate(s.date);
                        return s.studentId === cand.studentId && s.type === 'dictation' && d && d.getFullYear() === refYear && d.getMonth() === refMonth;
                    });

                    let highCount = 1; // Current one counts
                    highCount += studentScoresThisMonth.filter(s => qualifiesForHighScore(s, 'dictation', classData)).length;

                    if (highCount >= 3) {
                        const bonusLogsThisMonth = state.get('allAwardLogs').filter(log => {
                            const d = parseFlexibleDate(log.date);
                            return log.studentId === cand.studentId && log.reason === 'scholar_s_bonus' && d && d.getFullYear() === refYear && d.getMonth() === refMonth && log.note && log.note.includes('dictation');
                        }).length;

                        if (bonusLogsThisMonth < 2) {
                            const s = state.get('allStudents').find(st => st.id === cand.studentId);
                            if (s) finalEligibleStudents.push({ studentId: s.id, name: s.name, bonusAmount: 0.5, trialType: 'dictation' });
                        }
                    }
                });
            }

            if (finalEligibleStudents.length > 0) {
                setTimeout(() => {
                    import('../../ui/modals.js').then(m => m.showBatchStarfallModal(finalEligibleStudents));
                }, 500);
            }

        } else if (absentStudentIds.length > 0) {
            import('../../ui/modals.js').then(m => m.hideModal('bulk-trial-modal'));
        }

        if (absentStudentIds.length > 0) {
            if (absentApplied > 0) {
                showToast(`Marked ${absentApplied} student(s) absent in attendance.`, 'success');
            } else if (!shouldCommitBatch) {
                showToast('Absent students were already recorded in attendance.', 'info');
            }
        }

    } catch (error) {
        console.error("Bulk save error:", error);
        showToast("Failed to save scores. Please try again.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-save mr-2"></i> Save All`;
    }
}

export async function handleBuyItem(studentId, itemId) {
    if (!assertGameplaySeasonLive('The market')) return;
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;

    // 1. Determine if it's Legendary or Seasonal
    const isLegendary = itemId.startsWith('leg_');
    let item;

    if (isLegendary) {
        const { LEGENDARY_ARTIFACTS } = await import('../../features/powerUps.js');
        item = LEGENDARY_ARTIFACTS.find(i => i.id === itemId);
    } else {
        item = state.get('currentShopItems').find(i => i.id === itemId);
    }

    if (!item) return;

    // --- NEW: Hero of the Day + Voucher Discount Logic ---
    const reigningHero = state.get('reigningHero');
    const isHero = reigningHero && reigningHero.id === studentId;
    const scoreData = state.get('allStudentScores').find((score) => score.id === studentId);
    const heroOfDayWins = getYearScopedHeroOfDayWinsFromAppState(scoreData, state);
    const currentMonthKey = getLocalIsoDateString().substring(0, 7);
    let finalPrice = item.price;
    let voucherUsed = false;

    // 2. UI Pre-check and Optimistic Update preparation
    const buyBtn = document.querySelector(`.shop-buy-btn[data-id="${itemId}"]`);

    // 3. DB Transaction
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);

    try {
        let newGoldBalance = 0;
        let appliedFinalPrice = item.price;
        let purchasedItemIndex = -1;
        let remainingAfterBuy = 0;

        await runTransaction(db, async (transaction) => {
            const scoreDoc = await transaction.get(scoreRef);
            if (!scoreDoc.exists()) throw "Student data missing";

            // If it's seasonal, we MUST verify it still exists in the database
            if (!isLegendary) {
                const itemRef = doc(db, `${publicDataPath}/shop_items`, itemId);
                const itemDoc = await transaction.get(itemRef);
                if (!itemDoc.exists()) throw "Item already sold!";
                const remaining = shopItemStock(itemDoc.data()) - 1;
                if (remaining < 0) throw "Item already sold!";
                remainingAfterBuy = remaining;
                if (remaining <= 0) {
                    transaction.delete(itemRef);
                } else {
                    transaction.update(itemRef, { stock: remaining });
                }
            }

            const data = scoreDoc.data();
            const currentDbGold = getLiveYearGold(data, getLiveYearGoldContextFromState(state));
            const currentInventory = data.inventory || [];
            purchasedItemIndex = currentInventory.length;

            let calculatedPrice = item.price;

            if (!isLegendary) {
                calculatedPrice = getSeasonalShopPriceMeta(item.price, {
                    isReigningHero: !!isHero,
                    heroOfDayWins
                }).finalPrice;
            }

            const aurumVoucherPercent = Number(data.aurumVoucherPercent) || 0;
            const hasAurumVoucher = data.aurumVoucherMonth === currentMonthKey && aurumVoucherPercent > 0;
            if (hasAurumVoucher) {
                calculatedPrice = Math.max(1, Math.round(calculatedPrice * ((100 - aurumVoucherPercent) / 100)));
            }

            appliedFinalPrice = calculatedPrice;
            finalPrice = calculatedPrice;

            if (currentDbGold < calculatedPrice) throw "Not enough gold!";

            // Mask of the Protagonist: 1 per student per month
            if (itemId === 'leg_protagonist') {
                const alreadyBoughtThisMonth = data.lastProtagonistPurchaseMonth === currentMonthKey || currentInventory.some(i => i.id === 'leg_protagonist' && i.acquiredAt && i.acquiredAt.startsWith(currentMonthKey));
                if (alreadyBoughtThisMonth) throw "You can only buy the Mask of the Protagonist once per month!";
            }

            // Pathfinder Map: 1 per class per month (enforced inside transaction)
            if (itemId === 'leg_pathfinder' && student.classId) {
                const classDocRef = doc(db, `${publicDataPath}/classes`, student.classId);
                const classDoc = await transaction.get(classDocRef);
                if (classDoc.exists()) {
                    const bonuses = classDoc.data().teamQuestBonuses || {};
                    if ((bonuses[currentMonthKey] || 0) >= 10) throw "A Pathfinder Map was already used in your class this month!";
                }
            }

            newGoldBalance = currentDbGold - calculatedPrice; // Calculate for UI

            const nextUpdate = {
                gold: increment(-calculatedPrice),
                inventory: [...currentInventory, {
                    id: item.id,
                    name: item.name,
                    image: item.image || null,
                    icon: item.icon || null, // NEW: Save the icon for legendaries
                    description: item.description,
                    acquiredAt: new Date().toISOString()
                }]
            };

            if (itemId === 'leg_protagonist') {
                nextUpdate.lastProtagonistPurchaseMonth = currentMonthKey;
            }

            if (hasAurumVoucher) {
                nextUpdate.aurumVoucherPercent = 0;
                nextUpdate.aurumVoucherMonth = null;
                voucherUsed = true;
            }

            transaction.update(scoreRef, nextUpdate);
        });

        // --- SUCCESS: Update UI Immediately ---
        playSound('cash');

        // 1. Update Gold Display with tweened subtraction animation
        animateShopGoldChange(newGoldBalance);

        // 2. Update seasonal card copies, or remove it when the last one sells
        if (!isLegendary && buyBtn) {
            const card = buyBtn.closest('.shop-item-card');
            if (remainingAfterBuy <= 0 && card) {
                card.style.transition = 'all 0.5s';
                card.style.transform = 'scale(0) rotate(10deg)';
                card.style.opacity = '0';
                setTimeout(() => card.remove(), 500);
            } else if (card) {
                const stockEl = card.querySelector('.shop-item-stock');
                if (stockEl) stockEl.textContent = remainingAfterBuy <= 1 ? 'Only 1' : `${remainingAfterBuy} left`;
            }
            const shopItems = state.get('currentShopItems') || [];
            const shopIndex = shopItems.findIndex((entry) => entry.id === itemId);
            if (shopIndex !== -1) {
                if (remainingAfterBuy <= 0) {
                    shopItems.splice(shopIndex, 1);
                } else {
                    shopItems[shopIndex] = { ...shopItems[shopIndex], stock: remainingAfterBuy };
                }
                state.setCurrentShopItems([...shopItems]);
            }
        }

        // 3. Show Nice Purchase Modal
        const popupShown = showShopPurchasePopup({
            itemName: item.name,
            itemDescription: item.description || 'A rare artifact for your collection!',
            itemVisualHtml: item.icon ? item.icon : (item.image ? `<img src="${item.image}" class="w-16 h-16 object-contain mx-auto">` : '🎁'),
            finalPrice: appliedFinalPrice,
            newGoldBalance,
            studentName: student.name,
            useContext: {
                studentId,
                itemIndex: purchasedItemIndex,
                itemName: item.name
            },
            cta: 'Awesome!'
        });
        if (!popupShown) {
            showToast(`${student.name} bought "${item.name}" for ${appliedFinalPrice}🪙${voucherUsed ? ' (Aurum discount applied)' : ''}.`, 'success');
        }

        // --- FIX: Update Local State Immediately ---
        const allScores = state.get('allStudentScores');
        const studentIndex = allScores.findIndex(s => s.id === studentId);
        if (studentIndex !== -1) {
            // Update the local state object directly so the UI render sees the new gold
            allScores[studentIndex].gold = newGoldBalance;
            // Also push the new item to inventory so the button says "Owned" immediately
            if (!allScores[studentIndex].inventory) allScores[studentIndex].inventory = [];

            allScores[studentIndex].inventory.push({
                id: item.id,
                name: item.name,
                image: item.image || null,
                icon: item.icon || null,
                description: item.description,
                acquiredAt: new Date().toISOString()
            });
            if (itemId === 'leg_protagonist') {
                allScores[studentIndex].lastProtagonistPurchaseMonth = currentMonthKey;
            }
            if (voucherUsed) {
                allScores[studentIndex].aurumVoucherPercent = 0;
                allScores[studentIndex].aurumVoucherMonth = null;
            }
            state.setAllStudentScores(allScores);
        }

        // 4. Refresh buttons logic (disable items they can no longer afford)
        import('../../ui/core.js').then(m => m.updateShopStudentDisplay(studentId));

    } catch (error) {
        console.error(error);
        showToast(typeof error === 'string' ? error : "Transaction failed.", "error");
        import('../../ui/core.js').then(m => m.renderShopUI());
    }
}

function getClosingMonthKey(lastMonthlyResetDate, currentMonthStart) {
    if (typeof lastMonthlyResetDate === 'string' && lastMonthlyResetDate.length >= 7) {
        return lastMonthlyResetDate.substring(0, 7);
    }
    const match = String(currentMonthStart || '').match(/^(\d{4})-(\d{2})/);
    if (!match) return null;
    let year = Number(match[1]);
    let month = Number(match[2]) - 1;
    if (month < 1) {
        month = 12;
        year -= 1;
    }
    return `${year}-${String(month).padStart(2, '0')}`;
}

export async function checkAndResetMonthlyStars(studentId, currentMonthStart) {
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
    try {
        await runTransaction(db, async (transaction) => {
            const scoreDoc = await transaction.get(scoreRef);
            if (!scoreDoc.exists()) return;
            const scoreData = scoreDoc.data();

            if (scoreData.lastMonthlyResetDate !== currentMonthStart) {
                const lastMonthScore = scoreData.monthlyStars || 0;
                const yearMonthKey = getClosingMonthKey(scoreData.lastMonthlyResetDate, currentMonthStart);
                const historyRef = yearMonthKey
                    ? doc(db, `${publicDataPath}/student_scores/${studentId}/monthly_history/${yearMonthKey}`)
                    : null;

                if (lastMonthScore > 0 && historyRef) {
                    transaction.set(historyRef, withSchoolYear({ stars: lastMonthScore, month: yearMonthKey }, scoreData.activeSchoolYearKey || state.getActiveSchoolYearKey()));
                }

                const currentGold = getLiveYearGold(scoreData, getLiveYearGoldContextFromState(state));

                transaction.update(scoreRef, {
                    monthlyStars: 0,
                    lastMonthlyResetDate: currentMonthStart,
                    gold: currentGold
                });
            }
        });

        // After resetting this student, check and persist guild champions for the closing month
        // Fire-and-forget — runs once per student reset but only writes if this student is a guild champion
        _checkAndPersistGuildChampion(studentId, currentMonthStart).catch(e => console.warn('Guild champion persist failed:', e));

    } catch (error) {
        console.error(`Failed monthly reset & archive for ${studentId}:`, error);
    }
}

/** Persists the current guild champion for the student's guild to guild_champions collection. */
async function _checkAndPersistGuildChampion(studentId, currentMonthStart) {
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student?.guildId) return;

    const allStudents = state.get('allStudents');
    const allStudentScores = state.get('allStudentScores');

    // Find top monthly earner in this student's guild
    const guildId = student.guildId;
    const guildMembers = allStudents.filter(s => s.guildId === guildId);
    let champion = null;
    let topStars = -1;

    for (const member of guildMembers) {
        const score = allStudentScores.find(sc => sc.id === member.id);
        const monthlyStars = score?.monthlyStars || 0;
        if (monthlyStars > topStars) {
            topStars = monthlyStars;
            champion = { studentId: member.id, studentName: member.name, monthlyStars };
        }
    }

    if (!champion || champion.monthlyStars <= 0) return;

    const closingMonthKey = currentMonthStart.substring(0, 7); // e.g. "2026-01"
    const docId = `${closingMonthKey}_${guildId}`;
    const champRef = doc(db, `${publicDataPath}/guild_champions`, docId);

    await setDoc(champRef, withSchoolYear({
        guildId,
        monthKey: closingMonthKey,
        studentId: champion.studentId,
        studentName: champion.studentName,
        monthlyStars: champion.monthlyStars,
        updatedAt: serverTimestamp()
    }, state.getActiveSchoolYearKey()), { merge: true });
}

export async function handleManualGoldUpdate() {
    const studentId = document.getElementById('economy-student-select').value;
    const newGold = parseInt(document.getElementById('economy-gold-input').value);

    if (!studentId || isNaN(newGold)) {
        showToast('Please select a student and enter a valid amount.', 'error');
        return;
    }

    const btn = document.getElementById('save-gold-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const publicDataPath = "artifacts/great-class-quest/public/data";
        const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);

        await updateDoc(scoreRef, {
            gold: newGold
        });

        showToast('Gold updated successfully!', 'success');

        // Update the visual pill if visible
        const goldDisplay = document.getElementById(`student-gold-display-${studentId}`);
        if (goldDisplay) goldDisplay.innerText = newGold;

    } catch (error) {
        console.error("Error updating gold:", error);
        showToast("Failed to update gold.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save mr-2"></i> Update Balance';
    }
}

const specialOccasionBonusInFlight = new Set();

export async function handleSpecialOccasionBonus(studentId, type) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;

    const bonus = type === 'birthday' ? 2.5 : 1.5;
    const reason = type === 'birthday' ? 'Birthday Bonus' : 'Nameday Bonus';
    const icon = type === 'birthday' ? '🎂' : '🎈';

    const inFlightKey = `${studentId}:${type}`;
    if (specialOccasionBonusInFlight.has(inFlightKey)) return;
    specialOccasionBonusInFlight.add(inFlightKey);

    try {
        let alreadyGiven = false;
        await runTransaction(db, async (transaction) => {
            alreadyGiven = false;
            const publicDataPath = "artifacts/great-class-quest/public/data";
            const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
            // One celebration per student, occasion and day: a double-click or a
            // retried request lands on the same log document.
            const newLogRef = doc(
                db,
                `${publicDataPath}/award_log`,
                `occasion_${type === 'birthday' ? 'birthday' : 'nameday'}_${studentId}_${getTodayDateString()}`,
            );
            const existingLog = await transaction.get(newLogRef);
            if (existingLog.exists()) {
                alreadyGiven = true;
                return;
            }
            const scoreDoc = await transaction.get(scoreRef);
            if (!scoreDoc.exists()) throw new Error('Student score record not found.');
            const currentGold = getLiveYearGold(scoreDoc.data(), getLiveYearGoldContextFromState(state));

            // Add to totals WITHOUT affecting daily cap (only total/monthly)
            transaction.update(scoreRef, {
                totalStars: increment(bonus),
                monthlyStars: increment(bonus),
                gold: currentGold + bonus // They get gold too!
            });

            // Log it
            const logData = withSchoolYear({
                studentId,
                classId: student.classId,
                teacherId: state.get('currentUserId'),
                stars: bonus,
                appliedStarCredit: bonus,
                reason: 'scholar_s_bonus', // Use scholar bonus type to prevent standard stats skew
                note: `${icon} ${reason} Celebration!`,
                date: getTodayDateString(),
                createdAt: serverTimestamp(),
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
            }, state.getActiveSchoolYearKey());
            transaction.set(newLogRef, logData);
        });

        if (alreadyGiven) {
            showToast(`${student.name} already received this celebration bonus today.`, 'info');
            import('../../ui/modals.js').then(m => m.hideModal('celebration-bonus-modal'));
            return;
        }

        reconcileFamiliarLifecycle(studentId, { announce: true, source: 'special-occasion' }).catch((e) => console.warn('Special occasion familiar reconciliation failed:', e));
        showToast(`${student.name} received +${bonus} Stars for their special day!`, 'success');
        import('../../ui/modals.js').then(m => m.hideModal('celebration-bonus-modal'));
        playSound('magic_chime');

    } catch (error) {
        console.error("Bonus Error:", error);
        showToast("Error applying bonus.", "error");
    } finally {
        specialOccasionBonusInFlight.delete(inFlightKey);
    }
}

// --- FAMILIAR EGG PURCHASE ---

export async function handleBuyFamiliarEgg(studentId, typeId) {
    if (!studentId) { showToast('Please select a student first.', 'error'); return; }
    if (!assertGameplaySeasonLive('The market')) return;

    const { canUseFeature } = await import('../../utils/subscription.js');
    const { showUpgradePrompt } = await import('../../utils/upgradePrompt.js');
    if (!canUseFeature('familiars')) {
        showUpgradePrompt({ feature: 'Familiars', tier: 'Elite', message: 'Familiars are magical companion eggs that hatch and evolve as students earn stars. Available on the Elite plan.' });
        return;
    }

    const { FAMILIAR_TYPES, buildFamiliarInitData } = await import('../../features/familiars.js');
    const typeDef = FAMILIAR_TYPES[typeId];
    if (!typeDef) { showToast('Unknown familiar type.', 'error'); return; }
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) { showToast('Student not found.', 'error'); return; }

    const publicDataPath = 'artifacts/great-class-quest/public/data';
    const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);

    try {
        let newGoldBalance = 0;
        let familiarData = null;
        let finalPrice = typeDef.price;
        let voucherUsed = false;
        const currentMonthKey = getLocalIsoDateString().substring(0, 7);
        await runTransaction(db, async (transaction) => {
            const scoreDoc = await transaction.get(scoreRef);
            if (!scoreDoc.exists()) throw new Error('Score document not found.');
            const scoreData = scoreDoc.data();

            if (scoreData.familiar) throw new Error('This student already owns a Familiar!');

            const currentGold = getLiveYearGold(scoreData, getLiveYearGoldContextFromState(state));
            const aurumVoucherPercent = Number(scoreData.aurumVoucherPercent) || 0;
            const hasAurumVoucher = scoreData.aurumVoucherMonth === currentMonthKey && aurumVoucherPercent > 0;
            finalPrice = hasAurumVoucher
                ? Math.max(1, Math.round(typeDef.price * ((100 - aurumVoucherPercent) / 100)))
                : typeDef.price;
            if (currentGold < finalPrice) throw new Error(`Not enough Gold! Need ${finalPrice}🪙.`);
            newGoldBalance = currentGold - finalPrice;
            familiarData = buildFamiliarInitData(typeId, scoreData.totalStars || 0, studentId);

            const scoreUpdate = {
                gold: increment(-finalPrice),
                familiar: familiarData
            };

            if (hasAurumVoucher) {
                scoreUpdate.aurumVoucherPercent = 0;
                scoreUpdate.aurumVoucherMonth = null;
                voucherUsed = true;
            }

            transaction.update(scoreRef, scoreUpdate);
        });

        playSound('cash');
        animateShopGoldChange(newGoldBalance);
        const popupShown = showShopPurchasePopup({
            itemName: `${typeDef.name} Egg`,
            itemDescription: `A new companion has joined ${student.name}. Earn ${20} stars to hatch it!`,
            itemVisualHtml: `<div class="text-6xl familiar-egg-wobble" style="filter:drop-shadow(0 0 12px ${typeDef.eggColor});">🥚</div>`,
            finalPrice,
            newGoldBalance,
            studentName: student.name,
            cta: 'Egg Acquired!'
        });
        if (!popupShown) {
            showToast(`${typeDef.name} Egg purchased! Earn ${20} stars to hatch it!`, 'success');
        }

        const allScores = state.get('allStudentScores');
        const idx = allScores.findIndex(s => s.id === studentId);
        if (idx !== -1) {
            allScores[idx] = {
                ...allScores[idx],
                gold: newGoldBalance,
                familiar: familiarData
            };
            if (voucherUsed) {
                allScores[idx].aurumVoucherPercent = 0;
                allScores[idx].aurumVoucherMonth = null;
            }
            state.setAllStudentScores(allScores);
        }
        import('../../ui/core.js').then(m => m.updateShopStudentDisplay(studentId));
    } catch (error) {
        showToast(typeof error === 'string' ? error : error.message || 'Purchase failed.', 'error');
    }
}

// --- GENDER RESOLVER (Quota Saver - Rule Safe) ---

export async function resolveMissingGenders() {
    const currentUserId = state.get('currentUserId'); // Get your ID
    const allStudents = state.get('allStudents');

    // 1. Find students WITHOUT gender AND created by YOU
    // This prevents the batch from failing due to Firebase "isOwner" rules
    const unclassified = allStudents.filter(s =>
        !s.gender &&
        s.createdBy &&
        s.createdBy.uid === currentUserId
    );

    if (unclassified.length === 0) return;

    if (!canUseFeature('eliteAI')) return;


    // 2. Prepare the list for the AI (ID + Name)
    const listToAnalyze = unclassified.map(s => ({ id: s.id, name: s.name.split(' ')[0] }));

    // 3. Ask AI (ONE single call for everyone)
    const systemPrompt = "You are a name classifier. You will receive a list of student names. Classify them as 'boy' or 'girl' based on Greek and International naming conventions. If ambiguous, guess based on common probability. Return strictly valid JSON: { 'student_id': 'boy'|'girl', ... }.";
    const userPrompt = `Classify these students: ${JSON.stringify(listToAnalyze)}`;

    try {
        const jsonStr = await callGeminiApi(systemPrompt, userPrompt);
        const resultMap = extractJsonFromAiText(jsonStr);

        // 4. Batch Save to Firebase
        const batch = writeBatch(db);
        let count = 0;

        Object.entries(resultMap).forEach(([id, gender]) => {
            if (listToAnalyze.find(s => s.id === id)) {
                const docRef = doc(db, "artifacts/great-class-quest/public/data/students", id);
                batch.update(docRef, { gender: gender.toLowerCase() });
                count++;
            }
        });

        if (count > 0) {
            await batch.commit();
        }

    } catch (e) {
        console.error("Gender resolution failed (Quota saved, will try next time):", e);
    }
}
