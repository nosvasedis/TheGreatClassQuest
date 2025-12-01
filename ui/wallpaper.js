// ui/wallpaper.js
import * as state from '../state.js';
import * as utils from '../utils.js';
import { callGeminiApi } from '../api.js';
import * as constants from '../constants.js';

let directorTimeout = null;
let quoteInterval = null;
let clockInterval = null;
let escListener = null;
let isRunning = false;

// The Deck System (Prevents Repetition)
let cardDeck = [];
let sessionHistory = new Set(); // Tracks unique IDs shown this session

// Solar Data (Greece Defaults)
let solarData = {
    sunrise: new Date().setHours(6, 30, 0, 0),
    sunset: new Date().setHours(20, 30, 0, 0)
};

export function toggleWallpaperMode() {
    const wallpaperEl = document.getElementById('dynamic-wallpaper-screen');
    const isHidden = wallpaperEl.classList.contains('hidden') || wallpaperEl.classList.contains('wallpaper-exit');

    if (isHidden) {
        // --- START ---
        isRunning = true;
        cardDeck = []; // Reset deck
        
        wallpaperEl.classList.remove('hidden');
        wallpaperEl.classList.remove('wallpaper-exit');
        wallpaperEl.classList.add('wallpaper-enter');

        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(e => console.log("Fullscreen blocked", e));
        }

        if (escListener) document.removeEventListener('keydown', escListener);
        escListener = (e) => { if (e.key === 'Escape') toggleWallpaperMode(); };
        document.addEventListener('keydown', escListener);

        fetchSolarCycle();
        startWallpaperClock();
        
        // Start Loops
        directorGameLoop(); 
        updateQuote();
        quoteInterval = setInterval(updateQuote, 600000); 

    } else {
        // --- STOP ---
        isRunning = false;
        wallpaperEl.classList.remove('wallpaper-enter');
        wallpaperEl.classList.add('wallpaper-exit');
        
        if (escListener) {
            document.removeEventListener('keydown', escListener);
            escListener = null;
        }

        setTimeout(() => {
            wallpaperEl.classList.add('hidden');
            if (document.exitFullscreen && document.fullscreenElement) {
                document.exitFullscreen();
            }
            clearTimeout(directorTimeout);
            clearInterval(quoteInterval);
            clearInterval(clockInterval);
            document.getElementById('wall-floating-area').innerHTML = '';
            document.getElementById('wall-quote-container').style.opacity = '0';
        }, 600); 
    }
}

// --- REAL-TIME CLOCK ---
function startWallpaperClock() {
    const dayClasses = ['shadow-sun', 'shadow-mon', 'shadow-tue', 'shadow-wed', 'shadow-thu', 'shadow-fri', 'shadow-sat'];
    const wall = document.getElementById('dynamic-wallpaper-screen');
    const hubName = document.getElementById('wall-class-name');
    const hubLevel = document.getElementById('wall-class-level');
    const timeEl = document.getElementById('wall-time');
    const dateEl = document.getElementById('wall-date');

    const update = () => {
        if (!isRunning) return;
        const now = new Date();
        const nowTime = now.getTime();
        
        timeEl.innerText = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        dateEl.innerText = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
        
        const dayIndex = now.getDay();
        timeEl.className = 'font-title text-[9rem] text-white leading-none wall-shadow-text transition-colors duration-1000';
        timeEl.classList.add(dayClasses[dayIndex]);

        const isNight = nowTime >= solarData.sunset || nowTime < solarData.sunrise;
        if (isNight && !wall.classList.contains('is-night')) wall.classList.add('is-night');
        else if (!isNight && wall.classList.contains('is-night')) wall.classList.remove('is-night');

        const currentClass = identifyCurrentClass();
        if (currentClass) {
            if (hubName.dataset.currentId !== currentClass.id) {
                state.setGlobalSelectedClass(currentClass.id);
                hubName.innerHTML = `<span class="mr-3 text-5xl align-middle">${currentClass.logo}</span>${currentClass.name}`;
                hubLevel.innerText = `Quest League: ${currentClass.questLevel}`;
                hubName.dataset.currentId = currentClass.id;
                // Reset deck to force fresh class content
                cardDeck = []; 
            }
        } else {
            if (hubName.dataset.currentId !== 'global') {
                state.setGlobalSelectedClass(null);
                hubName.innerHTML = `<span class="mr-3 text-5xl">🏫</span>Prodigies School`;
                hubLevel.innerText = "Global Quest Network";
                hubName.dataset.currentId = 'global';
                // Reset deck to force fresh global content
                cardDeck = []; 
            }
        }
    };
    update();
    clockInterval = setInterval(update, 1000);
}

function identifyCurrentClass() {
    const manualId = state.get('globalSelectedClassId');
    if (manualId && !state.get('isProgrammaticSelection')) {
        return state.get('allSchoolClasses').find(c => c.id === manualId);
    }
    const now = new Date();
    const todayStr = utils.getTodayDateString();
    const currentTime = now.toTimeString().slice(0, 5);
    const todaysClasses = utils.getClassesOnDay(todayStr, state.get('allSchoolClasses'), state.get('allScheduleOverrides'));
    return todaysClasses.find(c => c.timeStart && c.timeEnd && currentTime >= c.timeStart && currentTime <= c.timeEnd) || null;
}

// --- THE DIRECTOR ENGINE ---
async function directorGameLoop() {
    if (!isRunning) return;

    const container = document.getElementById('wall-floating-area');
    const classId = state.get('globalSelectedClassId');

    // 1. CLEANUP: Fade out old
    if(container.children.length > 0) {
        Array.from(container.children).forEach(child => {
            child.style.opacity = '0';
            child.style.transform = 'translateY(-30px) scale(0.95)';
            setTimeout(() => child.remove(), 2000);
        });
    }

    // 2. BREATH: Wait 5 seconds
    await new Promise(r => setTimeout(r, 5000));
    if (!isRunning) return;

    // 3. DECISION: Draw from Deck
    const cardHtml = await drawCardFromDeck(classId);
    
    // 4. SPAWN
    if (cardHtml) {
        spawnCard(container, cardHtml);
    }

    // 5. LOOP: 60s Show + 2s Transition allowance
    directorTimeout = setTimeout(directorGameLoop, 60000); 
}

// --- THE DECK SYSTEM (Ensures Variety) ---
async function drawCardFromDeck(classId) {
    // If deck is empty, rebuild it based on current context
    if (cardDeck.length === 0) {
        buildDeck(classId);
    }
    
    // If still empty (no data), fallback
    if (cardDeck.length === 0) return getSchoolPulseCard();

    // Draw top card
    const cardType = cardDeck.pop();
    
    console.log("Director dealing card:", cardType);

    if (cardType.startsWith('birthday_')) {
    const studentId = cardType.split('_')[1];
    return getBirthdayCard(studentId);
}
if (cardType.startsWith('nameday_')) {
    const studentId = cardType.split('_')[1];
    return getNamedayCard(studentId);
}

    // Build the card
    switch(cardType) {
        // Common
        case 'school_pulse': return getSchoolPulseCard();
        case 'good_month': return getGoodMonthCard();
        case 'seasonal_winter': return getSeasonalCard('winter');
        case 'seasonal_halloween': return getSeasonalCard('halloween');
        case 'seasonal_summer': return getSeasonalCard('summer');
        case 'treasury': return getTreasuryCard(classId);
        case 'skill': return getTopSkillCard(classId);
        case 'word': return await getAIWordCard(classId);
        case 'fact': return await getAIFactCard(classId);
        
        // Class Specific
        case 'hero': return getStudentHighlightCard(classId);
        case 'class_quest': return getClassQuestCard(classId);
        case 'timekeeper': return getTimekeeperCard(classId);
        case 'streak': return getAttendanceStreakCard(classId);
        case 'story': return getStoryCard(classId);
        case 'homework': return getHomeworkCard(classId);
        case 'flashback': return getAdventureFlashbackCard(classId);
        case 'academic': return getAcademicMVPCard(classId);
        
        // Global Specific
        case 'global_hero': return getGlobalHeroCard();
        case 'league_race': return getRandomLeagueRaceCard();
        case 'class_spotlight': return getRandomClassSpotlightCard();
        case 'bounty': return getBountyCard(classId); // Can apply to both if classId matches
        
        default: return getSchoolPulseCard();
    }
}

function buildDeck(classId) {
    cardDeck = []; // Clear

    // === HIGH PRIORITY CELEBRATIONS (CLASS ONLY) ===
    if (classId) {
    const today = new Date();
    // Format as MM-DD for comparison
    const todayMMDD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const studentsInClass = state.get('allStudents').filter(s => s.classId === classId);
    studentsInClass.forEach(student => {
        // The 'birthday' and 'nameday' fields are stored as 'YYYY-MM-DD'
        if (student.birthday && student.birthday.endsWith(todayMMDD)) {
            cardDeck.push(`birthday_${student.id}`); // Add with high priority
        }
        if (student.nameday && student.nameday.endsWith(todayMMDD)) {
            cardDeck.push(`nameday_${student.id}`); // Add with high priority
        }
    });
}

    // === 1. ALWAYS AVAILABLE ===
    cardDeck.push('school_pulse', 'treasury', 'skill', 'word', 'fact');

    // === 2. TIME-SENSITIVE & SEASONAL CARDS ===
    const now = new Date();
    const dayOfMonth = now.getDate();
    const monthIndex = now.getMonth(); // 0-11

    // "Good Month" card for the first 3 days of the month
    if (dayOfMonth <= 3) {
        cardDeck.push('good_month', 'good_month'); // Add twice for higher chance
    }
    // Seasonal cards based on the month
    if (monthIndex === 11 || monthIndex === 0) { // Dec, Jan
        cardDeck.push('seasonal_winter');
    } else if (monthIndex === 9) { // October
        cardDeck.push('seasonal_halloween');
    } else if (monthIndex >= 5 && monthIndex <= 7) { // June, July, Aug
        cardDeck.push('seasonal_summer');
    }

    if (classId) {
        // === ACTIVE CLASS MODE ===
        // Add multiple heroes for variety
        cardDeck.push('hero', 'hero', 'hero'); 
        cardDeck.push('class_quest', 'timekeeper', 'streak');
        
        // Conditional adds
        const storyData = state.get('currentStoryData')[classId];
        if (storyData && storyData.currentSentence) cardDeck.push('story');
        
        const bounties = state.get('allQuestBounties').filter(b => b.classId === classId && b.status !== 'completed');
        if (bounties.length > 0) cardDeck.push('bounty', 'bounty'); // High Priority
        
        const assignments = state.get('allQuestAssignments').filter(a => a.classId === classId);
        if (assignments.length > 0) cardDeck.push('homework');
        
        const logs = state.get('allAdventureLogs').filter(l => l.classId === classId);
        if (logs.length > 0) cardDeck.push('flashback');
        
        const scores = state.get('allWrittenScores').filter(s => s.classId === classId);
        if (scores.length > 0) cardDeck.push('academic');

    } else {
        // === GLOBAL MODE ===
        cardDeck.push('global_hero', 'global_hero');
        cardDeck.push('league_race', 'league_race');
        cardDeck.push('class_spotlight', 'class_spotlight');
        cardDeck.push('school_pulse'); // Extra pulse for global
    }

    // Shuffle Deck (Fisher-Yates)
    for (let i = cardDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cardDeck[i], cardDeck[j]] = [cardDeck[j], cardDeck[i]];
    }
    
    console.log("Director rebuilt deck:", cardDeck);
}

// --- CARD BUILDERS ---

function getSchoolPulseCard() {
    const allScores = state.get('allStudentScores');
    const totalStars = allScores.reduce((sum, s) => sum + (s.totalStars || 0), 0);
    const students = state.get('allStudents');
    const totalStudents = students.length;
    
    return {
        html: `
            <div class="text-center">
                <div class="inline-block bg-indigo-100 text-indigo-700 text-xs font-bold px-4 py-2 rounded-full mb-4 uppercase tracking-widest border border-indigo-200">School Pulse</div>
                <div class="flex flex-col gap-4">
                    <div class="flex items-center justify-center gap-4">
                        <div class="text-5xl">⭐</div>
                        <div class="text-left">
                            <div class="font-title text-4xl text-indigo-900 leading-none">${totalStars}</div>
                            <div class="text-xs text-indigo-500 font-bold uppercase tracking-wide">Total Stars</div>
                        </div>
                    </div>
                    <div class="w-3/4 h-px bg-indigo-100 mx-auto"></div>
                    <div class="flex items-center justify-center gap-4">
                        <div class="text-5xl">🎒</div>
                        <div class="text-left">
                            <div class="font-title text-4xl text-teal-600 leading-none">${totalStudents}</div>
                            <div class="text-xs text-teal-500 font-bold uppercase tracking-wide">Adventurers</div>
                        </div>
                    </div>
                </div>
            </div>`,
        css: 'float-card-blue'
    };
}

function getHomeworkCard(classId) {
    const assignments = state.get('allQuestAssignments')
        .filter(a => a.classId === classId)
        .sort((a,b) => b.createdAt - a.createdAt);
        
    if (assignments.length === 0) return null;
    const task = assignments[0];

    return {
        html: `
            <div class="text-center">
                <div class="inline-block bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full mb-3 uppercase tracking-widest border border-red-200">Current Mission</div>
                <div class="text-5xl mb-2">📜</div>
                <h3 class="font-title text-2xl text-red-900 mb-2">Homework</h3>
                <div class="bg-white/60 p-4 rounded-xl border border-red-200 shadow-sm text-left relative">
                    <i class="fas fa-check-circle absolute top-2 right-2 text-red-200"></i>
                    <p class="font-serif text-red-900 text-lg leading-snug line-clamp-3">"${task.text}"</p>
                </div>
            </div>`,
        css: 'float-card-red'
    };
}

function getAdventureFlashbackCard(classId) {
    const logs = state.get('allAdventureLogs')
        .filter(l => l.classId === classId)
        .sort((a,b) => utils.parseDDMMYYYY(b.date) - utils.parseDDMMYYYY(a.date));
        
    if (logs.length === 0) return null;
    const log = logs[0]; // Last entry

    return {
        html: `
            <div class="text-center">
                <div class="inline-block bg-teal-100 text-teal-700 text-xs font-bold px-3 py-1 rounded-full mb-3 uppercase tracking-widest border border-teal-200">Previously...</div>
                <div class="text-xs text-teal-500 font-bold mb-2 uppercase">${log.date}</div>
                <div class="bg-white/60 p-4 rounded-xl border border-teal-200 shadow-sm relative">
                    ${log.imageUrl ? `<img src="${log.imageUrl}" class="w-full h-32 object-cover rounded-lg mb-2 opacity-90">` : ''}
                    <p class="font-serif italic text-teal-900 text-md leading-snug line-clamp-3">"${log.text}"</p>
                </div>
            </div>`,
        css: 'float-card-green'
    };
}

function getAcademicMVPCard(classId) {
    const scores = state.get('allWrittenScores')
        .filter(s => s.classId === classId && s.type === 'test')
        .sort((a,b) => (b.scoreNumeric/b.maxScore) - (a.scoreNumeric/a.maxScore));
        
    if (scores.length === 0) return null;
    const best = scores[0];
    const student = state.get('allStudents').find(s => s.id === best.studentId);
    if (!student) return null;

    return {
        html: `
            <div class="text-center">
                <div class="inline-block bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1 rounded-full mb-3 uppercase tracking-widest border border-purple-200">Academic MVP</div>
                <div class="text-6xl mb-2">🧠</div>
                <h3 class="font-title text-3xl text-purple-900 mb-1">${student.name}</h3>
                <p class="text-purple-600 font-bold">Top Score: ${best.scoreNumeric}/${best.maxScore}</p>
                <p class="text-xs text-purple-400 mt-2">On test: "${best.title || 'Recent Test'}"</p>
            </div>`,
        css: 'float-card-purple'
    };
}

async function getAIWordCard(classId) {
    const cls = classId ? state.get('allSchoolClasses').find(c => c.id === classId) : null;
    const level = cls ? cls.questLevel : "Global";
    const wordData = await getAICachedContent("word", level);
    return {
        html: `
            <div class="text-center">
                <div class="inline-block bg-pink-100 text-pink-700 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-widest border border-pink-200">Word of the Moment</div>
                <h3 class="font-title text-4xl text-pink-900 mb-2">"${wordData.word}"</h3>
                <p class="font-serif italic text-pink-700 text-lg opacity-80">${wordData.def}</p>
            </div>`,
        css: 'float-card-purple' 
    };
}

async function getAIFactCard(classId) {
    const cls = classId ? state.get('allSchoolClasses').find(c => c.id === classId) : null;
    const level = cls ? cls.questLevel : "Global";
    const fact = await getAICachedContent("fact", level);
    return {
        html: `
            <div class="text-center">
                <div class="inline-block bg-teal-100 text-teal-700 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-widest border border-teal-200">Did You Know?</div>
                <div class="text-5xl mb-3">💡</div>
                <p class="font-serif text-xl text-teal-900 leading-relaxed">"${fact}"</p>
            </div>`,
        css: 'float-card-green'
    };
}

function getRandomLeagueRaceCard() {
    const allClasses = state.get('allSchoolClasses');
    const leagues = [...new Set(allClasses.map(c => c.questLevel))];
    if (leagues.length === 0) return null;
    const league = leagues[Math.floor(Math.random() * leagues.length)];
    const classesInLeague = allClasses.filter(c => c.questLevel === league);
    
    const leagueStats = classesInLeague.map(c => {
        const s = state.get('allStudents').filter(st => st.classId === c.id);
        const total = s.reduce((sum, stu) => sum + (state.get('allStudentScores').find(sc => sc.id === stu.id)?.monthlyStars || 0), 0);
        const goal = Math.max(18, s.length * 18);
        return { name: c.name, logo: c.logo, pct: Math.min(100, Math.round((total/goal)*100)) };
    }).sort((a,b) => b.pct - a.pct).slice(0, 3);

    const rows = leagueStats.map((c, i) => `
        <div class="mb-3 last:mb-0">
            <div class="flex justify-between items-center mb-1 text-sm font-bold text-amber-900">
                <span class="flex items-center gap-2">
                    <span class="bg-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] border border-amber-300 shadow-sm">${i+1}</span>
                    ${c.logo} ${c.name}
                </span>
                <span>${c.pct}%</span>
            </div>
            <div class="w-full bg-white/50 h-3 rounded-full overflow-hidden border border-white/60">
                <div class="bg-gradient-to-r from-amber-400 to-orange-500 h-full rounded-full" style="width: ${c.pct}%"></div>
            </div>
        </div>
    `).join('');

    return {
        html: `
            <div>
                <h3 class="font-title text-xl text-amber-800 mb-4 text-center border-b-2 border-amber-200/50 pb-2">
                    <i class="fas fa-flag-checkered mr-2 text-amber-600"></i> League ${league} Race
                </h3>
                ${rows}
            </div>`,
        css: 'float-card-gold'
    };
}

function getRandomClassSpotlightCard() {
    const allClasses = state.get('allSchoolClasses');
    if (allClasses.length === 0) return null;
    const cls = allClasses[Math.floor(Math.random() * allClasses.length)];
    const students = state.get('allStudents').filter(s => s.classId === cls.id);
    const totalStars = students.reduce((sum, s) => sum + (state.get('allStudentScores').find(sc => sc.id === s.id)?.monthlyStars || 0), 0);
    const goal = Math.max(18, students.length * 18);
    const pct = Math.min(100, Math.round((totalStars/goal)*100));

    return {
        html: `
            <div class="text-center">
                <div class="inline-block bg-teal-100 text-teal-700 text-xs font-bold px-3 py-1 rounded-full mb-3 uppercase tracking-widest border border-teal-200">Spotlight</div>
                <div class="text-7xl mb-3 filter drop-shadow-md animate-bounce">${cls.logo}</div>
                <h3 class="font-title text-3xl text-teal-900 mb-1">${cls.name}</h3>
                <p class="text-teal-600 font-bold mb-4 uppercase text-sm tracking-wide">League ${cls.questLevel}</p>
                <div class="w-full bg-white/50 h-6 rounded-full overflow-hidden border border-white relative shadow-inner">
                    <div class="bg-gradient-to-r from-teal-400 to-emerald-500 h-full rounded-full" style="width: ${pct}%"></div>
                    <span class="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-teal-900">${pct}% Goal</span>
                </div>
            </div>`,
        css: 'float-card-green'
    };
}

function getStudentHighlightCard(classId) {
    let students = classId 
        ? state.get('allStudents').filter(s => s.classId === classId)
        : state.get('allStudents');
    if (students.length === 0) return null;
    
    // Weighted Random: Prefer students who earned stars today
    const activeStudents = students.filter(s => state.get('todaysStars')[s.id]?.stars > 0);
    const pool = activeStudents.length > 0 && Math.random() > 0.3 ? activeStudents : students;
    
    const student = pool[Math.floor(Math.random() * pool.length)];
    const score = state.get('allStudentScores').find(s => s.id === student.id);
    const todayScore = state.get('todaysStars')[student.id]?.stars || 0;
    const avatarHtml = student.avatar 
        ? `<img src="${student.avatar}" class="w-32 h-32 rounded-full border-[6px] border-white shadow-xl mx-auto mb-4 object-cover bg-white">` 
        : `<div class="w-32 h-32 rounded-full bg-indigo-100 flex items-center justify-center text-6xl mx-auto mb-4 border-[6px] border-white shadow-xl font-title text-indigo-500">${student.name.charAt(0)}</div>`;
    
    return {
        html: `
            <div class="text-center">
                <div class="inline-block bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-widest border border-indigo-200">Class Hero</div>
                ${avatarHtml}
                <h3 class="font-title text-3xl text-indigo-900 mb-2">${student.name}</h3>
                <div class="flex justify-center gap-2 mt-2">
                    <span class="bg-white/60 px-3 py-1 rounded-lg text-indigo-800 font-bold border border-white/50">${score?.totalStars || 0} ⭐ Total</span>
                    ${todayScore > 0 ? `<span class="bg-green-100 text-green-700 px-3 py-1 rounded-lg font-bold border border-green-200 animate-pulse">+${todayScore} Today</span>` : ''}
                </div>
            </div>`,
        css: 'float-card-blue'
    };
}

function getGlobalHeroCard() {
    const allScores = state.get('allStudentScores');
    const sorted = [...allScores].sort((a,b) => (b.monthlyStars||0) - (a.monthlyStars||0));
    const topScore = sorted[0];
    if (!topScore || topScore.monthlyStars === 0) return null;
    const student = state.get('allStudents').find(s => s.id === topScore.id);
    if (!student) return null;
    const cls = state.get('allSchoolClasses').find(c => c.id === student.classId);
    const avatarHtml = student.avatar ? `<img src="${student.avatar}" class="w-32 h-32 rounded-full border-[6px] border-white shadow-xl mx-auto mb-4 object-cover bg-white">` : `<div class="w-32 h-32 rounded-full bg-white flex items-center justify-center text-6xl mx-auto mb-4 border-[6px] border-purple-200 shadow-xl font-title text-purple-500">${student.name.charAt(0)}</div>`;

    return {
        html: `
            <div class="text-center">
                <div class="inline-block bg-purple-100 text-purple-600 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-widest border border-purple-200">School Leader</div>
                ${avatarHtml}
                <h3 class="font-title text-2xl text-purple-900 drop-shadow-sm">${student.name}</h3>
                <p class="text-purple-600 font-bold mb-2 text-sm">${cls?.name || 'Unknown Class'}</p>
                <div class="text-5xl font-title text-amber-500 drop-shadow-md">${topScore.monthlyStars} ⭐</div>
            </div>`,
        css: 'float-card-purple'
    };
}

function getClassQuestCard(classId) {
    const cls = state.get('allSchoolClasses').find(c => c.id === classId);
    const students = state.get('allStudents').filter(s => s.classId === classId);
    const scores = state.get('allStudentScores');
    const total = students.reduce((sum, stu) => sum + (scores.find(sc => sc.id === stu.id)?.monthlyStars || 0), 0);
    const goal = Math.max(18, students.length * 18);
    const pct = Math.min(100, Math.round((total/goal)*100));

    return {
        html: `
            <div class="text-center">
                <div class="inline-block bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-widest border border-amber-200">Quest Progress</div>
                <div class="text-7xl mb-4 filter drop-shadow-md animate-bounce">${cls.logo}</div>
                <div class="w-full bg-white h-8 rounded-full overflow-hidden border-2 border-amber-200 shadow-inner relative mb-2">
                    <div class="bg-gradient-to-r from-amber-300 to-orange-500 h-full transition-all duration-1000" style="width: ${pct}%"></div>
                </div>
                <p class="font-title text-amber-900 text-3xl">${pct}%</p>
                <p class="text-amber-700 text-sm font-bold uppercase">Monthly Goal</p>
            </div>`,
        css: 'float-card-gold'
    };
}

function getTopSkillCard(classId) {
    const logs = state.get('allAwardLogs');
    const relevantLogs = classId ? logs.filter(l => l.classId === classId) : logs;
    const reasons = {};
    relevantLogs.forEach(l => { if(l.reason) reasons[l.reason] = (reasons[l.reason] || 0) + 1; });
    
    // Pick random top 3 to keep it fresh
    const entries = Object.entries(reasons).sort((a,b) => b[1] - a[1]);
    const displayEntry = entries.length > 0 ? entries[Math.floor(Math.random() * Math.min(3, entries.length))] : ['courage', 0];
    
    const displayReason = displayEntry[0];
    const formattedName = displayReason.replace('_', ' ').toUpperCase();
    const icons = {'teamwork': '🤝', 'creativity': '🎨', 'respect': '🙌', 'focus': '🧠', 'welcome_back': '👋', 'courage': '🦁', 'kindness': '❤️'};
    
    return {
        html: `
            <div class="text-center">
                <div class="inline-block bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-widest border border-yellow-200">${classId ? 'Class' : 'School'} Superpower</div>
                <div class="text-8xl mb-4 animate-bounce filter drop-shadow-md">${icons[displayReason] || '⚡'}</div>
                <h3 class="font-title text-3xl text-white drop-shadow-md tracking-wide">${formattedName}</h3>
                <p class="text-yellow-50 mt-2 font-semibold text-sm">Key strength this month</p>
            </div>`,
        css: 'float-card-dark'
    };
}

function getTreasuryCard(classId) {
    let totalGold = 0;
    const scores = state.get('allStudentScores');
    if (classId) {
        state.get('allStudents').filter(s => s.classId === classId).forEach(s => {
            const sc = scores.find(score => score.id === s.id);
            if(sc) totalGold += (sc.gold !== undefined ? sc.gold : sc.totalStars);
        });
    } else {
        totalGold = scores.reduce((sum, sc) => sum + (sc.gold !== undefined ? sc.gold : sc.totalStars), 0);
    }
    return {
        html: `
            <div class="text-center">
                <div class="inline-block bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full mb-3 uppercase tracking-widest border border-amber-200">Treasury</div>
                <div class="text-7xl mb-2 filter drop-shadow-md">💰</div>
                <h3 class="font-title text-5xl text-amber-900 mb-1">${totalGold}</h3>
                <p class="text-amber-700 font-bold uppercase text-sm tracking-wide">Gold Coins Collected</p>
            </div>`,
        css: 'float-card-gold'
    };
}

function getBountyCard(b) {
    if (!b) return null;
    const pct = Math.min(100, (b.currentProgress / b.target) * 100);
    return {
        html: `
            <div class="text-center relative overflow-hidden">
                <div class="inline-block bg-red-100 text-red-600 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-widest animate-pulse border border-red-200">Active Bounty</div>
                <h3 class="font-title text-2xl text-gray-800 mb-1 leading-tight">${b.title}</h3>
                <p class="text-sm text-gray-600 mb-4 bg-white/50 rounded-lg p-1 inline-block border border-gray-200">🎁 Reward: ${b.reward}</p>
                <div class="w-full bg-gray-200 h-8 rounded-full overflow-hidden border-2 border-white shadow-inner mb-2">
                    <div class="bg-gradient-to-r from-red-400 to-rose-500 h-full transition-all duration-1000 relative" style="width: ${pct}%"></div>
                </div>
                <p class="font-bold text-red-600 text-xl">${b.currentProgress} / ${b.target}</p>
            </div>`,
        css: 'float-card-red'
    };
}

function getStoryCard(classId) {
    const storyData = state.get('currentStoryData')[classId];
    if (!storyData || !storyData.currentSentence) return null;
    return {
        html: `
            <div class="text-center">
                <div class="inline-block bg-teal-100 text-teal-700 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-widest border border-teal-200">Story Chronicle</div>
                <div class="bg-white/60 p-6 rounded-2xl border border-teal-200 shadow-sm mb-4 relative italic text-teal-900 text-xl leading-relaxed font-serif">
                    "...${storyData.currentSentence}..."
                </div>
                <p class="text-sm text-teal-700 font-bold bg-white/40 inline-block px-4 py-2 rounded-lg border border-white/50">Word: ${storyData.currentWord || 'Mystery'}</p>
            </div>`,
        css: 'float-card-green'
    };
}

function getTimekeeperCard(classId) {
    const cls = state.get('allSchoolClasses').find(c => c.id === classId);
    if (!cls || !cls.timeEnd) return null;
    const now = new Date();
    const [endH, endM] = cls.timeEnd.split(':').map(Number);
    const endTime = new Date(); endTime.setHours(endH, endM, 0);
    const diffMs = endTime - now;
    if (diffMs <= 0 || diffMs > 45 * 60000) return null;
    const diffMins = Math.ceil(diffMs / 60000);
    
    return {
        html: `
            <div class="text-center">
                <div class="inline-block bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-widest border border-red-200">Timekeeper</div>
                <div class="relative w-32 h-32 mx-auto mb-4 flex items-center justify-center">
                    <svg class="absolute inset-0 w-full h-full transform -rotate-90">
                        <circle cx="64" cy="64" r="56" stroke="#FECACA" stroke-width="12" fill="none" />
                        <circle cx="64" cy="64" r="56" stroke="#EF4444" stroke-width="12" fill="none" stroke-dasharray="351" stroke-dashoffset="${351 * (1 - diffMins/45)}" />
                    </svg>
                    <span class="font-title text-5xl text-red-600">${diffMins}</span>
                </div>
                <p class="text-red-800 font-bold text-xl uppercase tracking-wide">Minutes Left</p>
            </div>`,
        css: 'float-card-red'
    };
}

function getAttendanceStreakCard(classId) {
    const logs = state.get('allAwardLogs').filter(l => l.classId === classId);
    if (logs.length < 5) return null;
    const randomStreak = Math.floor(Math.random() * 5) + 3;
    return {
        html: `
            <div class="text-center">
                <div class="inline-block bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-widest border border-green-200">Team Spirit</div>
                <div class="text-8xl mb-4 animate-bounce">🔥</div>
                <h3 class="font-title text-5xl text-green-800 mb-2">${randomStreak} Days</h3>
                <p class="text-green-600 font-bold text-sm uppercase tracking-wide">Participation Streak!</p>
            </div>`,
        css: 'float-card-green'
    };
}

// --- SPAWN HELPER (Safe Zones) ---
function spawnCard(container, cardData) {
    const card = document.createElement('div');
    card.className = `wallpaper-float-card ${cardData.css} absolute`;
    card.innerHTML = cardData.html;
    
    // Strict Positioning: 4rem from edge to ensure full visibility
    const side = Math.random() > 0.5 ? 'left' : 'right';
    const randomY = 15 + Math.random() * 55; // 15% to 70% vertical (Center Safe)
    
    card.style.top = `${randomY}%`;
    if (side === 'left') {
        card.style.left = '4rem'; 
        card.style.right = 'auto'; 
    } else {
        card.style.right = '4rem';
        card.style.left = 'auto'; 
    }

    card.style.opacity = '0';
    card.style.transform = 'translateY(40px) scale(0.9)';
    
    container.appendChild(card);
    
    requestAnimationFrame(() => {
        card.style.opacity = '1';
        card.style.transform = 'translateY(0) scale(1)';
    });
}

// --- DATA FETCHING & AI ---
async function fetchSolarCycle() {
    try {
        const response = await fetch('https://api.sunrise-sunset.org/json?lat=37.9838&lng=23.7275&formatted=0');
        const data = await response.json();
        if (data.status === 'OK') {
            solarData.sunrise = new Date(data.results.sunrise).getTime();
            solarData.sunset = new Date(data.results.sunset).getTime();
        }
    } catch (e) { console.warn("Using default solar times."); }
}

async function updateQuote() {
    const container = document.getElementById('wall-quote-container');
    const textEl = document.getElementById('wall-quote-text');
    container.style.opacity = '0';
    setTimeout(async () => {
        const cls = state.get('globalSelectedClassId') ? state.get('allSchoolClasses').find(c => c.id === state.get('globalSelectedClassId')) : null;
        const level = cls ? cls.questLevel : "Global";
        const quote = await getQuote(level);
        textEl.innerText = `"${quote}"`;
        container.style.opacity = '1';
    }, 1000);
}

async function getQuote(levelContext) {
    return getAICachedContent("quote", levelContext);
}

// Unified Cache
async function getAICachedContent(type, levelContext) {
    const now = Date.now();
    const storageKeyTime = `wall_${type}_time`;
    const storageKeyText = `wall_${type}_text`;
    const lastFetch = localStorage.getItem(storageKeyTime);
    const cached = localStorage.getItem(storageKeyText);
    
    if (lastFetch && (now - parseInt(lastFetch) < 3600000) && cached) return cached;
    
    const ageGroup = utils.getAgeGroupForLeague(levelContext || "Global");
    let systemPrompt, userPrompt;

    if (type === "quote") {
        systemPrompt = `You are a wise sage. Generate a short, inspiring quote (max 10 words) for students aged ${ageGroup}. No markdown.`;
        userPrompt = "One quote.";
    } else if (type === "word") {
        systemPrompt = `Generate a single interesting English word and a 3-word definition for students aged ${ageGroup}. Format: Word - Definition. No markdown.`;
        userPrompt = "One word.";
    } else if (type === "fact") {
        systemPrompt = `Generate a fascinating, short educational fact (max 12 words) for students aged ${ageGroup}. No markdown.`;
        userPrompt = "One fact.";
    }

    try {
        let result = await callGeminiApi(systemPrompt, userPrompt);
        if (type === "word") {
            const parts = result.split('-');
            if (parts.length > 1) return { word: parts[0].trim(), def: parts[1].trim() };
            return { word: result, def: "A mystery word" };
        }
        localStorage.setItem(storageKeyTime, now);
        localStorage.setItem(storageKeyText, result);
        return result;
    } catch (e) {
        if (type === "word") return { word: "Serendipity", def: "A happy accident" };
        return "Learning is a journey.";
    }
}

function getGoodMonthCard() {
    const monthName = new Date().toLocaleString('en-US', { month: 'long' });
    return {
        html: `
            <div class="text-center">
                <div class="inline-block bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-widest border border-amber-200">A New Chapter</div>
                <div class="text-8xl mb-4 animate-bounce">🎉</div>
                <h3 class="font-title text-3xl text-amber-900 leading-tight">Wishing Everyone a Wonderful</h3>
                <h2 class="font-title text-5xl text-orange-600">${monthName}!</h2>
            </div>`,
        css: 'float-card-gold'
    };
}
function getSeasonalCard(season) {
    let card = {};
    switch (season) {
        case 'winter':
            card = {
                html: `
                    <div class="text-center">
                        <div class="text-8xl mb-4">❄️</div>
                        <h3 class="font-title text-3xl text-blue-800">Winter Wonders!</h3>
                        <p class="text-blue-600 mt-2 font-semibold">Stay warm and keep the quest spirits bright!</p>
                    </div>`,
                css: 'float-card-blue'
            };
            break;
        case 'halloween':
            card = {
                html: `
                    <div class="text-center">
                        <div class="text-8xl mb-4 animate-bounce">🎃</div>
                        <h3 class="font-title text-3xl text-white">Happy Halloween!</h3>
                        <p class="text-yellow-50 mt-2 font-semibold">Wishing you a spooky and fun adventure!</p>
                    </div>`,
                css: 'float-card-dark'
            };
            break;
        case 'summer':
            card = {
                html: `
                    <div class="text-center">
                        <div class="text-8xl mb-4">☀️</div>
                        <h3 class="font-title text-3xl text-orange-700">Hello, Sunshine!</h3>
                        <p class="text-orange-600 mt-2 font-semibold">Enjoy the bright and sunny questing days!</p>
                    </div>`,
                css: 'float-card-gold'
            };
            break;
    }
    return card;
}

function getBirthdayCard(studentId) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return null;

    const avatarHtml = student.avatar
        ? `<img src="${student.avatar}" class="w-32 h-32 rounded-full border-[6px] border-white shadow-xl mx-auto mb-4 object-cover bg-white">`
        : `<div class="w-32 h-32 rounded-full bg-blue-100 flex items-center justify-center text-6xl mx-auto mb-4 border-[6px] border-white shadow-xl font-title text-blue-500">${student.name.charAt(0)}</div>`;

    return {
        html: `
            <div class="text-center relative">
                <div class="absolute -top-4 -left-4 text-5xl animate-bounce">🎉</div>
                <div class="absolute -top-4 -right-4 text-5xl animate-bounce" style="animation-delay: 0.5s;">🎂</div>
                <div class="inline-block bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-widest border border-blue-200">Happy Birthday!</div>
                ${avatarHtml}
                <h3 class="font-title text-4xl text-blue-900 drop-shadow-sm">${student.name}</h3>
                <p class="text-blue-600 font-bold mt-2">Wishing you a fantastic day!</p>
            </div>`,
        css: 'float-card-blue'
    };
}

function getNamedayCard(studentId) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return null;

    const avatarHtml = student.avatar
        ? `<img src="${student.avatar}" class="w-32 h-32 rounded-full border-[6px] border-white shadow-xl mx-auto mb-4 object-cover bg-white">`
        : `<div class="w-32 h-32 rounded-full bg-green-100 flex items-center justify-center text-6xl mx-auto mb-4 border-[6px] border-white shadow-xl font-title text-green-500">${student.name.charAt(0)}</div>`;

    return {
        html: `
            <div class="text-center relative">
                <div class="absolute -top-4 -left-4 text-5xl animate-bounce">✨</div>
                <div class="absolute -top-4 -right-4 text-5xl animate-bounce" style="animation-delay: 0.5s;">🇬🇷</div>
                <div class="inline-block bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-widest border border-green-200">Happy Nameday!</div>
                ${avatarHtml}
                <h3 class="font-title text-4xl text-green-900 drop-shadow-sm">${student.name}</h3>
                <p class="text-green-600 font-bold mt-2">Χρόνια Πολλά!</p>
            </div>`,
        css: 'float-card-green'
    };
}
