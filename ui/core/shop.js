// /ui/core/shop.js
import * as state from '../../state.js';
import { showToast } from '../effects.js';
import * as modals from '../modals.js';

// --- SHOP UI LOGIC ---

export function openShopModal() {
    // 1. Determine Context
    let league = state.get('globalSelectedLeague');
    let classId = state.get('globalSelectedClassId');

    // If viewing Hero Stats for a specific student, try to get their class/league
    if (!league && classId) {
        const cls = state.get('allTeachersClasses').find(c => c.id === classId);
        if (cls) league = cls.questLevel;
    }

    if (!league) {
        showToast("Please select a League or Class first to enter the correct market.", "error");
        return;
    }

    // 2. Set UI Text
    const monthName = new Date().toLocaleString('en-US', { month: 'long' });
    document.getElementById('shop-title').innerText = "The Mystic Market"; // Title is now static
    document.getElementById('shop-month').innerText = monthName; // Month has its own element
    
    document.getElementById('shop-student-select').innerHTML = `<option value="">Select Shopper...</option>`;
    document.getElementById('shop-student-gold').innerText = "0 🪙";

    // 3. Filter Students (Only show MY students in this League)
    // FIX: Use 'allTeachersClasses' instead of 'allSchoolClasses'
    const myClassesInLeague = state.get('allTeachersClasses').filter(c => c.questLevel === league);
    const myClassIds = myClassesInLeague.map(c => c.id);
    
    const validStudents = state.get('allStudents')
        .filter(s => myClassIds.includes(s.classId))
        .sort((a,b) => a.name.localeCompare(b.name));

    const selectEl = document.getElementById('shop-student-select');
    selectEl.innerHTML = `<option value="">Select Shopper...</option>` + 
        validStudents.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    renderShopUI();
    modals.showAnimatedModal('shop-modal');
}

export function renderShopUI() {
    const container = document.getElementById('shop-items-container');
    const emptyState = document.getElementById('shop-empty-state');
    const currentMonthKey = new Date().toISOString().substring(0, 7);
    
    let league = state.get('globalSelectedLeague');
    if (!league) {
        const classId = state.get('globalSelectedClassId');
        const cls = state.get('allSchoolClasses').find(c => c.id === classId);
        if (cls) league = cls.questLevel;
    }

    // 1. Get Seasonal Items
    const seasonalItems = state.get('currentShopItems')
        .filter(i => i.monthKey === currentMonthKey && i.league === league)
        .sort((a,b) => a.price - b.price);

    // 2. Get Legendary Artifacts (from our new file)
    import('../../features/powerUps.js').then(m => {
        const artifacts = m.LEGENDARY_ARTIFACTS;
        
        if (seasonalItems.length === 0 && artifacts.length === 0) {
            container.innerHTML = '';
            container.classList.add('hidden');
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            container.classList.remove('hidden');

            let html = `
                <div class="col-span-full mb-4 border-b-2 border-indigo-500/30 pb-2">
                    <h3 class="font-title text-2xl text-indigo-300 flex items-center gap-2">
                        <i class="fas fa-scroll"></i> Legendary Artifacts
                        <span class="text-xs bg-indigo-500/20 px-2 py-1 rounded text-indigo-400 font-sans uppercase">Limit: 2 per month</span>
                    </h3>
                </div>
            `;

            html += artifacts.map(item => renderShopItemCard(item, true)).join('');

            html += `
                <div class="col-span-full mt-8 mb-4 border-b-2 border-amber-500/30 pb-2">
                    <h3 class="font-title text-2xl text-amber-300 flex items-center gap-2">
                        <i class="fas fa-leaf"></i> Seasonal Treasures
                        <span class="text-xs bg-amber-500/20 px-2 py-1 rounded text-amber-400 font-sans uppercase">Month: ${new Date().toLocaleString('en-US', {month: 'long'})}</span>
                    </h3>
                </div>
            `;

            html += seasonalItems.map(item => renderShopItemCard(item, false)).join('');
            
            container.innerHTML = html;
            
            const currentStudentId = document.getElementById('shop-student-select').value;
            if(currentStudentId) updateShopStudentDisplay(currentStudentId);
        }
    });
}

/**
 * Shared card renderer to keep things neat
 */
function renderShopItemCard(item, isLegendary) {
    const badge = isLegendary 
        ? `<div class="absolute top-2 right-2 z-10 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow transform -rotate-2 border border-indigo-400">ARTIFACT</div>`
        : `<div class="absolute top-2 right-2 z-10 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow transform rotate-3 border border-red-400">ONLY 1 LEFT!</div>`;

    const imageHtml = item.image 
        ? `<img src="${item.image}" class="relative w-full h-full object-contain filter drop-shadow-md group-hover:scale-110 transition-transform duration-500">`
        : `<div class="text-7xl group-hover:scale-125 transition-transform duration-500">${item.icon || '📦'}</div>`;

    return `
        <div class="shop-item-card group bg-indigo-950 border-2 border-indigo-800 rounded-2xl overflow-hidden hover:border-amber-400 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_20px_rgba(251,191,36,0.3)] flex flex-col relative">
            ${badge}
            <div class="relative h-40 bg-white/5 flex items-center justify-center overflow-hidden">
                <div class="absolute inset-0 bg-radial-gradient from-white/10 to-transparent opacity-50"></div>
                ${imageHtml}
            </div>
            <div class="p-4 flex-grow flex flex-col">
                <h3 class="font-title text-xl text-amber-300 leading-tight mb-1">${item.name}</h3>
                <p class="text-indigo-300 text-xs mb-3 line-clamp-2 flex-grow">${item.description}</p>
                <div class="flex justify-between items-center mt-auto pt-3 border-t border-indigo-800">
                    <div class="flex items-center gap-1 font-bold text-white text-lg">
                        <span>${item.price}</span>
                        <span>🪙</span>
                    </div>
                    <button class="shop-buy-btn bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:text-indigo-500 disabled:cursor-not-allowed text-white text-xs font-bold py-2 px-4 rounded-lg uppercase tracking-wider transition-colors" 
                            data-id="${item.id}" data-type="${isLegendary ? 'legendary' : 'seasonal'}" disabled>
                        Select Student
                    </button>
                </div>
            </div>
        </div>
    `;
}

export async function updateShopStudentDisplay(studentId) {
    const goldDisplay = document.getElementById('shop-student-gold');
    const buyBtns = document.querySelectorAll('.shop-buy-btn');
    const shopHeader = document.getElementById('shop-student-select').parentElement; // Get container for visual effects
    
    // Reset visual effects
    shopHeader.classList.remove('ring-4', 'ring-amber-400', 'bg-amber-50', 'rounded-xl', 'p-2');
    const existingBadge = document.getElementById('shop-hero-badge');
    if(existingBadge) existingBadge.remove();

    if (!studentId) {
        goldDisplay.innerText = "0 🪙";
        buyBtns.forEach(btn => {
            btn.disabled = true;
            btn.innerText = "Select Student";
            btn.classList.remove('bg-green-600', 'bg-red-500', 'bg-indigo-600');
            btn.classList.add('bg-indigo-600');
        });
        return;
    }

    const scoreData = state.get('allStudentScores').find(s => s.id === studentId);
    const gold = scoreData && scoreData.gold !== undefined ? scoreData.gold : (scoreData?.totalStars || 0);
    const inventory = scoreData?.inventory || [];
    const student = state.get('allStudents').find(s => s.id === studentId);

    // --- CHECK HERO STATUS ---
    const reigningHero = state.get('reigningHero');
    const isHero = reigningHero && reigningHero.id === studentId;

    if (isHero) {
        // Add Hero Visuals
        shopHeader.classList.add('ring-4', 'ring-amber-400', 'bg-amber-50', 'rounded-xl', 'p-2', 'transition-all');
        const badge = document.createElement('div');
        badge.id = 'shop-hero-badge';
        badge.className = 'w-full text-center bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-sm uppercase tracking-widest py-1 rounded shadow-md mb-2 animate-pulse';
        badge.innerHTML = '<i class="fas fa-crown mr-2"></i>HERO OF THE DAY<i class="fas fa-crown ml-2"></i>';
        shopHeader.insertBefore(badge, shopHeader.firstChild);
    }

    // LIMIT CHECK 1: Individual Legendary limit (2 per month)
    const currentMonthKey = new Date().toISOString().substring(0, 7);
    const legendariesThisMonth = inventory.filter(i => i.id && i.id.startsWith('leg_') && i.acquiredAt && i.acquiredAt.startsWith(currentMonthKey));
    const legLimitReached = legendariesThisMonth.length >= 2;

    // LIMIT CHECK 2: Pathfinder Map (1 per class per month)
    const { LEGENDARY_ARTIFACTS } = await import('../../features/powerUps.js');
    const pathfinderLog = state.get('allAwardLogs').find(l => 
        l.classId === student.classId && 
        l.reason === 'pathfinder_bonus' && 
        l.date.substring(3) === `${currentMonthKey.substring(5)}-${currentMonthKey.substring(0,4)}`
    );
    
    const classStudents = state.get('allStudents').filter(s => s.classId === student.classId);
    const classScores = state.get('allStudentScores').filter(sc => classStudents.some(cs => cs.id === sc.id));
    const pathfinderHeldBySomeone = classScores.some(sc => sc.inventory?.some(i => i.id === 'leg_pathfinder'));
    const pathfinderLockedForClass = !!pathfinderLog || pathfinderHeldBySomeone;

    // Update UI Display
    goldDisplay.innerText = `${gold} 🪙`;

    buyBtns.forEach(btn => {
        const itemId = btn.dataset.id;
        const isLegendary = btn.dataset.type === 'legendary';
        
        // --- PRICE CALCULATION ---
        let basePrice = 10;
        if (isLegendary) {
            basePrice = LEGENDARY_ARTIFACTS.find(a => a.id === itemId)?.price || 0;
        } else {
            basePrice = state.get('currentShopItems').find(i => i.id === itemId)?.price || 10;
        }

        let finalPrice = basePrice;
        let discountLabel = "";

        // Apply Discount (Seasonal Only for Hero)
        if (isHero && !isLegendary) {
            finalPrice = Math.floor(basePrice * 0.75);
            discountLabel = " (Hero -25%)";
        }

        const alreadyOwned = inventory.some(i => i.id === itemId);
        btn.classList.remove('bg-green-600', 'bg-red-500', 'bg-indigo-600');

        if (alreadyOwned && isLegendary) {
            btn.disabled = true;
            btn.innerText = "Owned";
            btn.classList.add('bg-green-600');
        } 
        else if (isLegendary && legLimitReached) {
            btn.disabled = true;
            btn.innerText = "Monthly limit (2/2)";
            btn.classList.add('bg-red-500');
        }
        else if (itemId === 'leg_pathfinder' && pathfinderLockedForClass) {
            btn.disabled = true;
            btn.innerText = "Class limit reached";
            btn.classList.add('bg-red-500');
        }
        else if (gold >= finalPrice) {
            btn.disabled = false;
            btn.innerText = `Buy ${finalPrice}🪙${discountLabel}`;
            btn.classList.add('bg-indigo-600');
        } 
        else {
            btn.disabled = true;
            btn.innerText = `Need ${finalPrice}🪙`;
            btn.classList.add('bg-gray-500');
        }
    });
}

export function renderEconomyStudentSelect() {
    const select = document.getElementById('economy-student-select');
    if (!select) return;
    
    const currentVal = select.value;
    
    // Get all students and group by class
    const allTeachersClasses = state.get('allTeachersClasses');
    const classesMap = allTeachersClasses.reduce((acc, c) => {
        acc[c.id] = { name: c.name, students: [] };
        return acc;
    }, {});
    
    state.get('allStudents').forEach(s => {
        if (classesMap[s.classId]) {
            classesMap[s.classId].students.push(s);
        }
    });

    let html = '<option value="">Select a student...</option>';
    
    Object.keys(classesMap).sort((a, b) => classesMap[a].name.localeCompare(classesMap[b].name)).forEach(classId => {
        const classData = classesMap[classId];
        if (classData.students.length > 0) {
            html += `<optgroup label="${classData.name}">`;
            classData.students.sort((a,b) => a.name.localeCompare(b.name)).forEach(s => {
                html += `<option value="${s.id}">${s.name}</option>`;
            });
            html += `</optgroup>`;
        }
    });

    select.innerHTML = html;
    select.value = currentVal;
}
