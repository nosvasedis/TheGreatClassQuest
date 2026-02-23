// /db/actions/economy.js — shop, trials, gold, occasions
import {
    db,
    doc,
    setDoc,
    addDoc,
    updateDoc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    runTransaction,
    writeBatch,
    serverTimestamp,
    increment,
    orderBy,
    limit
} from '../../firebase.js';
import * as state from '../../state.js';
import { showToast } from '../../ui/effects.js';
import { callGeminiApi, callCloudflareAiImageApi } from '../../api.js';
import { getAgeGroupForLeague, getStartOfMonthString, compressImageBase64, simpleHashCode, parseFlexibleDate } from '../../utils.js';
// GUILD_IDS not needed at module level but kept for reference

// --- THE ECONOMY (SHOP & INVENTORY) ---

export async function handleGenerateShopStock() {
    // 1. Determine Context (League)
    let league = state.get('globalSelectedLeague');
    
    // Fallback: If no league selected, try to infer from class ID
    if (!league) {
        const classId = state.get('globalSelectedClassId');
        if (classId) {
            const cls = state.get('allSchoolClasses').find(c => c.id === classId);
            if (cls) league = cls.questLevel;
        }
    }

    if (!league) {
        showToast("Please select a Class or League first!", "error");
        return;
    }

    const btn = document.getElementById('generate-shop-btn');
    const loader = document.getElementById('shop-loader');
    const container = document.getElementById('shop-items-container');
    const emptyState = document.getElementById('shop-empty-state');
    const monthKey = new Date().toISOString().substring(0, 7); // YYYY-MM
    
    btn.disabled = true;
    loader.classList.remove('hidden');
    container.innerHTML = ''; 
    emptyState.classList.add('hidden');

    try {
        // --- STEP 0: CLEAR OLD STOCK ---
        const publicDataPath = "artifacts/great-class-quest/public/data";
        
        const q = query(
            collection(db, `${publicDataPath}/shop_items`),
            where("league", "==", league),
            where("monthKey", "==", monthKey),
            where("teacherId", "==", state.get('currentUserId'))
        );
        
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const batch = writeBatch(db);
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        }

        // --- STEP 1: PREPARE PROMPT ---
        const now = new Date();
        const currentMonth = now.getMonth(); 
        const currentYear = now.getFullYear();
        const ageCategory = getAgeGroupForLeague(league); 
        const isJunior = ageCategory === '7-8' || ageCategory === '8-9' || league.includes('Junior');

        // Smart Season Context
        let seasonContext = "";
        if (currentMonth === 11) seasonContext = "Winter, Christmas, Festive, Snow, Holidays, Gifts";
        else if (currentMonth === 3 && currentYear === 2026) seasonContext = "Spring, Orthodox Easter, Red Eggs, Candles";
        else if (currentMonth === 0 || currentMonth === 1) seasonContext = "Winter, Ice, Frost";
        else if (currentMonth >= 2 && currentMonth <= 4) seasonContext = "Spring, Flowers, Nature";
        else if (currentMonth >= 5 && currentMonth <= 7) seasonContext = "Summer, Beach, Sun";
        else if (currentMonth >= 8 && currentMonth <= 10) seasonContext = "Autumn, Halloween";

        // Style Context - FORCING ICONS/STICKERS
        let styleContext = "";
        let itemContext = "";
        let languageInstruction = "";
        
        if (isJunior) {
            // Junior: Force "Sticker" style to ensure isolation
            styleContext = "a die-cut vector sticker, thick white outline, flat color, simple shapes, cartoon style, white background";
            itemContext = "magical toys, cute pets, colorful candies, fun hats";
            languageInstruction = "Use simple English (7-9yo). Max 8 words.";
        } else {
            // Senior: Force "Game Icon" style to ensure single object
            styleContext = "a fantasy rpg inventory icon, 3d render, centered, neutral background, high detail";
            itemContext = "ancient artifacts, scrolls, potions, enchanted gear";
            languageInstruction = "Use exciting English (10-13yo). Max 10 words.";
        }

        const systemPrompt = `You are a creative RPG item generator for a school app. 
        Target Audience: ${league} students (approx age ${ageCategory}).
        Theme: ${seasonContext}.
        
        Requirements:
        1. Generate 15 UNIQUE handheld objects.
        2. PRICE TIERS (CRITICAL):
           - 5 "Common" items: 10-18 Gold (Easy to get in 1 month).
           - 5 "Rare" items: 35-50 Gold (Requires saving for 2-3 months).
           - 5 "Legendary" items: 80-120 Gold (Long-term "End of Term" trophies).
        3. DESCRIPTIONS: ${languageInstruction}
        4. Output Format: A valid JSON array of objects: [{"name": "string", "desc": "string", "price": number}].
        Do NOT use markdown.`;
        
        const jsonString = await callGeminiApi(systemPrompt, "Generate the JSON list now.");
        const cleanJson = jsonString.replace(/```json|```/g, '').trim();
        let itemsData = [];
        try {
            itemsData = JSON.parse(cleanJson);
        } catch (e) {
            console.error("JSON Parse failed, retrying...");
            const fixedJson = await callGeminiApi("Fix this JSON:", cleanJson);
            itemsData = JSON.parse(fixedJson.replace(/```json|```/g, '').trim());
        }

        // --- STEP 2: GENERATE IMAGES & SAVE ---
        const { uploadImageToStorage } = await import('../../utils.js');
        
        const chunkSize = 3;
        for (let i = 0; i < itemsData.length; i += chunkSize) {
            const chunk = itemsData.slice(i, i + chunkSize);
            await Promise.all(chunk.map(async (item) => {
                try {
                    // FIX: Prompt Engineering for Isolation
                    // 1. Put the Name FIRST.
                    // 2. Wrap Name in ((brackets)) to emphasize it.
                    // 3. Explicitly state "single isolated object".
                    const positivePrompt = `(single isolated object) of ((${item.name})), ${item.desc}. ${styleContext}. centered, full shot, high quality.`;
                    
                    // FIX: Aggressive Anti-Texture Negative Prompt
                    const negativePrompt = "pattern, texture, wallpaper, seamless, repeating, tiling, grid, background, scenery, landscape, text, watermark, blurry, noise, cropped, multiple objects, pile, heap";
                    
                    const base64 = await callCloudflareAiImageApi(positivePrompt, negativePrompt);
                    const compressed = await compressImageBase64(base64, 256, 256);
                    const path = `shop_items/${state.get('currentUserId')}/${monthKey}_${simpleHashCode(item.name)}_${Date.now()}.jpg`;
                    const url = await uploadImageToStorage(compressed, path);

                    const docRef = doc(collection(db, `${publicDataPath}/shop_items`));
                    await setDoc(docRef, {
                        name: item.name,
                        description: item.desc,
                        price: item.price,
                        image: url,
                        league: league, 
                        monthKey: monthKey,
                        teacherId: state.get('currentUserId'),
                        createdAt: serverTimestamp(),
                        createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
                    });
                } catch (err) {
                    console.error("Item gen failed:", item.name, err);
                }
            }));
        }

        showToast(`${itemsData.length} new seasonal treasures arrived for ${league}!`, 'success');
        import('../../ui/core.js').then(m => m.renderShopUI());

    } catch (error) {
        console.error("Shop generation failed:", error);
        showToast('The Merchant got lost. Try again.', 'error');
    } finally {
        btn.disabled = false;
        loader.classList.add('hidden');
    }
}

export async function handleBulkSaveTrial() {
    const modal = document.getElementById('bulk-trial-modal');
    const classId = modal.dataset.classId;
    const type = modal.dataset.type;
    const isJunior = modal.dataset.isJunior === 'true';
    
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

    const rows = document.querySelectorAll('.bulk-log-item');
    if (rows.length === 0) return;

    const btn = document.getElementById('bulk-trial-save-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Saving...`;

    const batch = writeBatch(db);
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const scoresCollection = collection(db, `${publicDataPath}/written_scores`);
    
    let operationsCount = 0;
    const potentialStarfallStudents = [];
    const savedScoresData = []; // Collection for personal best check

    try {
        rows.forEach(row => {
            const studentId = row.dataset.studentId;
            const trialId = row.dataset.trialId; 
            const isAbsent = row.querySelector('.toggle-absent-btn').classList.contains('is-absent');
            const input = row.querySelector('.bulk-grade-input');
            const val = input.value;

            if (isAbsent) {
                if (trialId) {
                    batch.delete(doc(scoresCollection, trialId));
                    operationsCount++;
                }
                return;
            }

            if (!val) return;

            const maxScore = (isJunior && type === 'test') ? 40 : 100;
            
            let scoreData = {
                studentId,
                classId,
                date,
                type,
                title: type === 'test' ? title : null,
                teacherId: state.get('currentUserId'),
                notes: null,
                scoreNumeric: null,
                scoreQualitative: null,
                maxScore: maxScore
            };

            if (isJunior && type === 'dictation') {
                scoreData.scoreQualitative = val;
            } else {
                scoreData.scoreNumeric = parseInt(val, 10);
            }

            savedScoresData.push({ ...scoreData, id: trialId || 'new' }); 

            // Logic for Starfall Eligibility Check
            let bonusAmount = 0;
            let isEligible = false;

            if (type === 'test') {
                const threshold = isJunior ? 38 : 96; 
                if (scoreData.scoreNumeric >= threshold) {
                    bonusAmount = 1;
                    isEligible = true;
                }
            } else if (type === 'dictation') {
                let isHighDictation = false;
                if (isJunior) {
                    if (val === 'Great!!!') isHighDictation = true;
                } else {
                    if ((scoreData.scoreNumeric / maxScore) * 100 > 85) isHighDictation = true;
                }

                if (isHighDictation) {
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
                batch.set(newRef, scoreData);
            }
            operationsCount++;
        });

        if (operationsCount > 0) {
            await batch.commit();
            showToast('All grades saved successfully!', 'success');
            
            // Dynamic import to avoid circular dependency issues
            import('../../ui/modals.js').then(m => m.hideModal('bulk-trial-modal'));

            // --- PERSONAL BEST CHECK ---
            savedScoresData.forEach(savedScore => {
                if (savedScore.type === 'test' && savedScore.scoreNumeric !== null) {
                    const studentId = savedScore.studentId;
                    const student = state.get('allStudents').find(s => s.id === studentId);
                    const newScorePercent = (savedScore.scoreNumeric / savedScore.maxScore) * 100;

                    const previousScores = state.get('allWrittenScores')
                        .filter(s => s.studentId === studentId && s.type === 'test' && s.id !== savedScore.id);

                    const maxPreviousScore = previousScores.length > 0 
                        ? Math.max(...previousScores.map(s => (s.scoreNumeric / s.maxScore) * 100))
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
                if(s) finalEligibleStudents.push({ studentId: s.id, name: s.name, bonusAmount: w.bonusAmount, trialType: 'test' });
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
                    if (isJunior) {
                        highCount += studentScoresThisMonth.filter(s => s.scoreQualitative === 'Great!!!').length;
                    } else {
                        highCount += studentScoresThisMonth.filter(s => (s.scoreNumeric / s.maxScore) * 100 > 85).length;
                    }

                    if (highCount >= 3) {
                        const bonusLogsThisMonth = state.get('allAwardLogs').filter(log => {
                            const d = parseFlexibleDate(log.date);
                            return log.studentId === cand.studentId && log.reason === 'scholar_s_bonus' && d && d.getFullYear() === refYear && d.getMonth() === refMonth && log.note && log.note.includes('dictation');
                        }).length;

                        if (bonusLogsThisMonth < 2) { 
                            const s = state.get('allStudents').find(st => st.id === cand.studentId);
                            if(s) finalEligibleStudents.push({ studentId: s.id, name: s.name, bonusAmount: 0.5, trialType: 'dictation' });
                        }
                    }
                });
            }

            if (finalEligibleStudents.length > 0) {
                setTimeout(() => {
                    import('../../ui/modals.js').then(m => m.showBatchStarfallModal(finalEligibleStudents));
                }, 500);
            }

        } else {
            showToast('No changes to save.', 'info');
            import('../../ui/modals.js').then(m => m.hideModal('bulk-trial-modal'));
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

    // --- NEW: Hero of the Day Discount Logic ---
    let finalPrice = item.price;
    const reigningHero = state.get('reigningHero');
    const isHero = reigningHero && reigningHero.id === studentId;
    
    // Discount applies ONLY to Seasonal items (not Legendary)
    if (isHero && !isLegendary) {
        finalPrice = Math.floor(item.price * 0.75); // 25% Discount
    }

    // 2. UI Pre-check and Optimistic Update preparation
    const buyBtn = document.querySelector(`.shop-buy-btn[data-id="${itemId}"]`);
    
    // 3. DB Transaction
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
    
    try {
        let newGoldBalance = 0;

        await runTransaction(db, async (transaction) => {
            const scoreDoc = await transaction.get(scoreRef);
            if (!scoreDoc.exists()) throw "Student data missing";

            // If it's seasonal, we MUST verify it still exists in the database
            if (!isLegendary) {
                const itemRef = doc(db, `${publicDataPath}/shop_items`, itemId);
                const itemDoc = await transaction.get(itemRef);
                if (!itemDoc.exists()) throw "Item already sold!";
                transaction.delete(itemRef);
            }

            const data = scoreDoc.data();
            const currentDbGold = data.gold !== undefined ? data.gold : (data.totalStars || 0);
            const currentInventory = data.inventory || [];

            if (currentDbGold < finalPrice) throw "Not enough gold!";
            
            newGoldBalance = currentDbGold - finalPrice; // Calculate for UI

            transaction.update(scoreRef, {
                gold: increment(-finalPrice), 
                inventory: [...currentInventory, {
                    id: item.id,
                    name: item.name,
                    image: item.image || null,
                    icon: item.icon || null, // NEW: Save the icon for legendaries
                    description: item.description,
                    acquiredAt: new Date().toISOString()
                }]
            });
        });
        
        // --- SUCCESS: Update UI Immediately ---
        playSound('cash');
        
        // 1. Update Gold Display Instantly
        const goldDisplay = document.getElementById('shop-student-gold');
        if (goldDisplay) {
            goldDisplay.innerText = `${newGoldBalance} 🪙`;
            // Add a flash effect
            goldDisplay.style.color = '#ef4444'; // Red momentarily
            setTimeout(() => goldDisplay.style.color = '', 500);
        }

        // 2. Remove item card if seasonal
        if (!isLegendary && buyBtn) {
            const card = buyBtn.closest('.shop-item-card');
            if(card) {
                card.style.transition = 'all 0.5s';
                card.style.transform = 'scale(0)';
                setTimeout(() => card.remove(), 500);
            }
        }

        // 3. Show Proper Popup (Modal)
        showModal(
            'Purchase Successful!', 
            `${student.name} bought "${item.name}" for ${finalPrice} Gold.\n\nRemaining Balance: ${newGoldBalance} Gold.`, 
            () => {}, // No action needed on confirm
            'Awesome!'
        );

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
                description: item.description,
                acquiredAt: new Date().toISOString()
            });
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
                const lastMonthDateString = scoreData.lastMonthlyResetDate; 
                const yearMonthKey = lastMonthDateString.substring(0, 7); 
                const historyRef = doc(db, `${publicDataPath}/student_scores/${studentId}/monthly_history/${yearMonthKey}`);
                
                if (lastMonthScore > 0) {
                    transaction.set(historyRef, { stars: lastMonthScore, month: yearMonthKey });
                }
                
                const currentGold = scoreData.gold !== undefined ? scoreData.gold : (scoreData.totalStars || 0);

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

    await setDoc(champRef, {
        guildId,
        monthKey: closingMonthKey,
        studentId: champion.studentId,
        studentName: champion.studentName,
        monthlyStars: champion.monthlyStars,
        updatedAt: serverTimestamp()
    }, { merge: true });
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

        showToast('Coin balance updated successfully!', 'success');
        
        // Update the visual pill if visible
        const goldDisplay = document.getElementById(`student-gold-display-${studentId}`);
        if(goldDisplay) goldDisplay.innerText = newGold;

    } catch (error) {
        console.error("Error updating gold:", error);
        showToast("Failed to update gold.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save mr-2"></i> Update Balance';
    }
}

export async function handleSpecialOccasionBonus(studentId, type) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;
    
    const bonus = type === 'birthday' ? 2.5 : 1.5;
    const reason = type === 'birthday' ? 'Birthday Bonus' : 'Nameday Bonus';
    const icon = type === 'birthday' ? '🎂' : '🎈';

    try {
        await runTransaction(db, async (transaction) => {
            const publicDataPath = "artifacts/great-class-quest/public/data";
            const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
            const newLogRef = doc(collection(db, `${publicDataPath}/award_log`));

            // Add to totals WITHOUT affecting daily cap (only total/monthly)
            transaction.update(scoreRef, {
                totalStars: increment(bonus),
                monthlyStars: increment(bonus),
                gold: increment(bonus) // They get gold too!
            });

            // Log it
            const logData = {
                studentId,
                classId: student.classId,
                teacherId: state.get('currentUserId'),
                stars: bonus,
                reason: 'scholar_s_bonus', // Use scholar bonus type to prevent standard stats skew
                note: `${icon} ${reason} Celebration!`,
                date: getTodayDateString(),
                createdAt: serverTimestamp(),
                createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
            };
            transaction.set(newLogRef, logData);
        });
        
        showToast(`${student.name} received +${bonus} Stars for their special day!`, 'success');
        import('../../ui/modals.js').then(m => m.hideModal('celebration-bonus-modal'));
        playSound('magic_chime');

    } catch (error) {
        console.error("Bonus Error:", error);
        showToast("Error applying bonus.", "error");

        
    }
}

// --- FAMILIAR EGG PURCHASE ---

export async function handleBuyFamiliarEgg(studentId, typeId) {
    if (!studentId) { showToast('Please select a student first.', 'error'); return; }

    const { FAMILIAR_TYPES, buildFamiliarInitData } = await import('../../features/familiars.js');
    const typeDef = FAMILIAR_TYPES[typeId];
    if (!typeDef) { showToast('Unknown familiar type.', 'error'); return; }

    const publicDataPath = 'artifacts/great-class-quest/public/data';
    const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);

    try {
        await runTransaction(db, async (transaction) => {
            const scoreDoc = await transaction.get(scoreRef);
            if (!scoreDoc.exists()) throw new Error('Score document not found.');
            const scoreData = scoreDoc.data();

            if (scoreData.familiar) throw new Error('This student already owns a Familiar!');

            const currentGold = typeof scoreData.gold === 'number' ? scoreData.gold : (scoreData.totalStars || 0);
            if (currentGold < typeDef.price) throw new Error(`Not enough Gold! Need ${typeDef.price}🪙.`);

            transaction.update(scoreRef, {
                gold: currentGold - typeDef.price,
                familiar: buildFamiliarInitData(typeId, scoreData.totalStars || 0)
            });
        });
        showToast(`${typeDef.name} Egg purchased! Earn ${20} stars to hatch it!`, 'success');
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

    console.log(`Resolving genders for ${unclassified.length} of your students...`);

    // 2. Prepare the list for the AI (ID + Name)
    const listToAnalyze = unclassified.map(s => ({ id: s.id, name: s.name.split(' ')[0] }));

    // 3. Ask AI (ONE single call for everyone)
    const systemPrompt = "You are a name classifier. You will receive a list of student names. Classify them as 'boy' or 'girl' based on Greek and International naming conventions. If ambiguous, guess based on common probability. Return strictly valid JSON: { 'student_id': 'boy'|'girl', ... }.";
    const userPrompt = `Classify these students: ${JSON.stringify(listToAnalyze)}`;

    try {
        const jsonStr = await callGeminiApi(systemPrompt, userPrompt);
        const cleanJson = jsonStr.replace(/```json|```/g, '').trim();
        const resultMap = JSON.parse(cleanJson);

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
            console.log(`Gender resolved and saved for ${count} students.`);
        }

    } catch (e) {
        console.error("Gender resolution failed (Quota saved, will try next time):", e);
    }
}
