import { db } from '../firebase.js';
import { collection, query, where, getDocs, addDoc, writeBatch, serverTimestamp, orderBy, limit, doc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import * as state from '../state.js';
import * as utils from '../utils.js';
import { callGeminiApi } from '../api.js';
import * as constants from '../constants.js';

// Proper Fisher-Yates shuffle for true variety
function shuffleDeck(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
let directorTimeout = null;
let wallpaperTimerInterval = null;
let clockInterval = null;
let escListener = null;
let isRunning = false;

const HISTORY_KEY = 'gcq_wall_history'; 
const SESSION_KEY = 'gcq_wall_session'; 
const CARD_DURATION = 60000; 
const MEMORY_LIMIT = 100; 

let solarData = {
    sunrise: new Date().setHours(6, 30, 0, 0),
    sunset: new Date().setHours(20, 30, 0, 0)
};

export function toggleWallpaperMode() {
    const wallpaperEl = document.getElementById('dynamic-wallpaper-screen');
    const isHidden = wallpaperEl.classList.contains('hidden') || wallpaperEl.classList.contains('wallpaper-exit');

    if (isHidden) {
        isRunning = true;
        wallpaperEl.classList.remove('hidden');
        wallpaperEl.classList.remove('wallpaper-exit');
        wallpaperEl.classList.add('wallpaper-enter');

        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(e => console.log("Fullscreen blocked", e));
        }

        if (escListener) document.removeEventListener('keydown', escListener);
        escListener = (e) => { if (e.key === 'Escape') toggleWallpaperMode(); };
        document.addEventListener('keydown', escListener);

        utils.fetchSolarCycle();
        startWallpaperClock();

        initSeasonalAtmosphere();
        initializeDailyAIContent(); 
        directorGameLoop(); 

    } else {
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
            if (wallpaperTimerInterval) clearInterval(wallpaperTimerInterval);
            clearInterval(clockInterval);
            document.getElementById('wall-floating-area').innerHTML = '';
            document.getElementById('wall-quote-container').style.opacity = '0';
        }, 600); 
    }
}

function startWallpaperClock() {
    const wall = document.getElementById('dynamic-wallpaper-screen');
    const hubName = document.getElementById('wall-class-name');
    const hubLevel = document.getElementById('wall-class-level');
    const timeEl = document.getElementById('wall-time');
    const dateEl = document.getElementById('wall-date');

    const update = () => {
        if (!isRunning) return;
        const now = new Date();
        // 1. Update Text (Keep the clock ticking!)
        timeEl.innerText = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        dateEl.innerText = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

        // 2. Check Night Mode from Global State (Fixes Issue #2)
        const isNight = document.body.classList.contains('night-mode');

        // 3. Dynamic Glow - Varied Colors (Fixes Issue #5)
        // Uses time-based seed so colors shift throughout the day
        const uniqueTimeSeed = now.getDate() + now.getHours() + (now.getMinutes() * 13);
        const hue = (uniqueTimeSeed * 137.508) % 360; 
        
        let textShadowStyle;
        if (isNight) {
             const color = `hsl(${hue}, 80%, 60%)`; 
             textShadowStyle = `0 4px 8px rgba(0,0,0,0.9), 0 0 30px ${color}`;
        } else {
             const color = `hsl(${hue}, 90%, 50%)`;
             textShadowStyle = `0 4px 6px rgba(0,0,0,0.6), 0 0 20px ${color}`;
        }

        // 4. Apply Styles
        timeEl.style.textShadow = textShadowStyle;
        dateEl.style.textShadow = textShadowStyle;
        
        // Ensure base classes are set
        timeEl.className = 'font-title text-[9rem] text-white leading-none transition-colors duration-1000';
        dateEl.className = 'font-title text-4xl text-white/95 mt-2 mb-6 tracking-wide transition-colors duration-1000';

        const currentClass = identifyCurrentClass();
        
        if (currentClass) {
            if (hubName.dataset.currentId !== currentClass.id) {
                state.setGlobalSelectedClass(currentClass.id);
                hubName.innerHTML = `<span class="mr-3 text-5xl align-middle">${currentClass.logo}</span>${currentClass.name}`;
                hubLevel.innerText = `Quest League: ${currentClass.questLevel}`;
                hubName.dataset.currentId = currentClass.id;
            }
        } else {
            if (hubName.dataset.currentId !== 'global') {
                state.setGlobalSelectedClass(null);
                hubName.innerHTML = `<span class="mr-3 text-5xl">🏫</span>Prodigies School`;
                hubLevel.innerText = "Global Quest Network";
                hubName.dataset.currentId = 'global';
            }
        }
    };
    update();
    clockInterval = setInterval(update, 1000);
}

function identifyCurrentClass() {
    const manualId = state.get('globalSelectedClassId');
    if (manualId && !state.get('isProgrammaticSelection')) return state.get('allSchoolClasses').find(c => c.id === manualId);
    
    const now = new Date();
    const todayStr = utils.getTodayDateString();
    const currentTime = now.toTimeString().slice(0, 5);
    const todaysClasses = utils.getClassesOnDay(todayStr, state.get('allSchoolClasses'), state.get('allScheduleOverrides'));
    return todaysClasses.find(c => c.timeStart && c.timeEnd && currentTime >= c.timeStart && currentTime <= c.timeEnd) || null;
}

function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}

function setSession(cardData, startTime) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ card: cardData, start: startTime }));
}

function getHistory() {
    try { 
        const h = JSON.parse(localStorage.getItem(HISTORY_KEY)); 
        return Array.isArray(h) ? h : [];
    } catch { return []; }
}

function addToHistory(cardId) {
    let history = getHistory();
    history.push({ id: cardId, time: Date.now() });
    if (history.length > MEMORY_LIMIT) history = history.slice(history.length - MEMORY_LIMIT);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function getCooldownForType(type) {
    if (type.startsWith('ai_') || type === 'motivation_poster') {
        return 10 * 60 * 1000; 
    }
    if (type === 'story_sentence' || type === 'story_image' || type.startsWith('recent_award') || type.startsWith('log') || type.includes('bounty')) {
        return 20 * 60 * 1000; 
    }
    return 15 * 60 * 1000; 
}

function hasBeenShownRecently(cardId) {
    const history = getHistory();
    const now = Date.now();
    const duration = getCooldownForType(cardId);
    const recent = history.find(h => h.id === cardId && (now - h.time) < duration);
    return !!recent;
}

async function initializeDailyAIContent() {
    const today = utils.getTodayDateString();
    const storageKey = `gcq_daily_ai_${today}`;
    if (localStorage.getItem(storageKey)) return;

    const contentCollection = collection(db, "artifacts/great-class-quest/public/data/daily_ai_content");
    const q = query(contentCollection, where("date", "==", today));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        console.log("Generating fresh AI content for the day...");
        const systemPrompt = `You are a creative content engine for a classroom. Generate a JSON array of 20 objects. 
        Types: 'fact_science', 'fact_history', 'fact_nature', 'joke', 'riddle', 'word', 'idiom'.
        Structure: { "type": "string", "content": "string", "answer": "string (optional, for riddles/words)" }.
        Content must be kid-friendly, educational, and fun. No markdown.`;
        
        try {
            const jsonStr = await callGeminiApi(systemPrompt, "Generate 20 items.");
            const cleanJson = jsonStr.replace(/```json|```/g, '').trim();
            const items = JSON.parse(cleanJson);
            
            const batch = writeBatch(db);
            const teacherId = state.get('currentUserId');
            const teacherName = state.get('currentTeacherName');

            items.forEach(item => {
                const docRef = doc(contentCollection); 
                batch.set(docRef, {
                    ...item,
                    date: today,
                    createdBy: { uid: teacherId, name: teacherName },
                    createdAt: serverTimestamp()
                });
            });
            
            await batch.commit();
            localStorage.setItem(storageKey, "loaded"); 
            cleanupOldAIContent();

        } catch (e) {
            console.error("AI Content Gen Error:", e);
        }
    } else {
        localStorage.setItem(storageKey, "loaded");
    }
}

async function cleanupOldAIContent() {
    const today = utils.getTodayDateString();
    const contentCollection = collection(db, "artifacts/great-class-quest/public/data/daily_ai_content");
    const q = query(contentCollection, where("date", "!=", today), limit(50)); 
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
        const batch = writeBatch(db);
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        console.log("Cleaned up old AI content.");
    }
}

async function fetchRandomDailyAI(typeFilter = null) {
    const today = utils.getTodayDateString();
    const contentCollection = collection(db, "artifacts/great-class-quest/public/data/daily_ai_content");
    const q = query(contentCollection, where("date", "==", today));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    const items = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
    const filtered = typeFilter ? items.filter(i => i.type.startsWith(typeFilter)) : items;
    
    if (filtered.length === 0) return null;

    const history = getHistory(); 
    const freshItems = filtered.filter(item => !history.some(h => h.id === item.id)); 
    
    const pool = freshItems.length > 0 ? freshItems : filtered;
    
    return pool[Math.floor(Math.random() * pool.length)];
}

async function directorGameLoop() {
    clearTimeout(directorTimeout);
    if (!isRunning) return;

    const container = document.getElementById('wall-floating-area');
    const classId = state.get('globalSelectedClassId');
    const now = Date.now();

    // --- PRIORITY 1: ACTIVE TIMER (Real-Time Logic) ---
    const activeTimer = state.get('allQuestBounties').find(b => b.classId === classId && b.status === 'active' && b.type === 'timer');
    let timerOverlay = document.getElementById('wall-timer-overlay');
    
    if (!timerOverlay) {
        timerOverlay = document.createElement('div');
        timerOverlay.id = 'wall-timer-overlay';
        timerOverlay.className = 'absolute bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-500';
        document.getElementById('dynamic-wallpaper-screen').appendChild(timerOverlay);
    }

    // Clear any existing timer interval to prevent stacking
    if (wallpaperTimerInterval) clearInterval(wallpaperTimerInterval);

    if (activeTimer) {
        const updateTimerVisuals = async () => {
            const currentNow = Date.now();
            const deadline = new Date(activeTimer.deadline).getTime();
            const timeLeftMs = deadline - currentNow;

            if (timeLeftMs > 0) {
                const minutes = Math.floor(timeLeftMs / 60000);
                const seconds = Math.floor((timeLeftMs % 60000) / 1000);
                const timeDisplay = `${minutes}:${String(seconds).padStart(2, '0')}`;
                
                // Color Logic
                let cssClass = 'float-card-indigo'; // Default
                let icon = '⏳';
                
                if (timeLeftMs < 60000) { // Less than 1 min
                    cssClass = 'float-card-red animate-pulse'; // Red & Pulse
                    icon = '🔥';
                } else if (timeLeftMs < 180000) { // Less than 3 mins
                    cssClass = 'float-card-orange';
                }

                timerOverlay.innerHTML = `
                    <div class="wallpaper-float-card ${cssClass} !w-auto !min-w-[320px] !p-4 !rounded-2xl shadow-2xl border-4" style="position: relative; transform: none; animation: none;">
                        <div class="flex items-center justify-between gap-6">
                            <div class="flex items-center gap-3">
                                <div class="text-3xl">${icon}</div>
                                <div class="text-left">
                                    <div class="text-[10px] font-black uppercase text-white/70 leading-none mb-1">Time Remaining</div>
                                    <h3 class="font-title text-lg text-white leading-tight truncate max-w-[150px]">${activeTimer.title}</h3>
                                </div>
                            </div>
                            <div class="font-title text-5xl text-white drop-shadow-md leading-none font-variant-numeric:tabular-nums">${timeDisplay}</div>
                        </div>
                    </div>`;
            } else {
                // --- TIMER FINISHED ---
                clearInterval(wallpaperTimerInterval);
                timerOverlay.innerHTML = ''; 
                
                // 1. Mark complete in DB
                const { updateDoc, doc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
                await updateDoc(doc(db, "artifacts/great-class-quest/public/data/quest_bounties", activeTimer.id), { status: 'completed' });

                // 2. Play Sound
                const { playSound } = await import('../audio.js');
                playSound('magic_chime');

                // 3. Show "Time's Up" Card briefly
                container.innerHTML = '';
                const html = `
                    <div class="text-center w-full">
                        <div class="text-9xl mb-4 animate-bounce">⏰</div>
                        <h2 class="font-title text-6xl text-white drop-shadow-xl mb-4">Time's Up!</h2>
                        <p class="text-3xl text-white font-serif italic">"Pencils down, heroes!"</p>
                    </div>`;
                const el = spawnCard(container, { html, css: 'float-card-purple', id: 'timer_end' });
                el.style.top = '50%'; el.style.left = '50%'; 
                el.style.transform = 'translate(-50%, -50%) scale(1.2)';
                
                // Pause director briefly then resume
                clearTimeout(directorTimeout);
                directorTimeout = setTimeout(directorGameLoop, 8000);
            }
        };

        // Run immediately then set interval
        updateTimerVisuals();
        wallpaperTimerInterval = setInterval(updateTimerVisuals, 1000);

    } else {
        timerOverlay.innerHTML = ''; 
    }

    // --- STANDARD CARD LOGIC (Running in background) ---
    const session = getSession();
    let currentCardData = null;
    let remainingTime = 0;

    if (session && (now - session.start < CARD_DURATION)) {
        currentCardData = session.card;
        remainingTime = CARD_DURATION - (now - session.start);
    } else {
        // Clear previous card
        if (container.children.length > 0 && !session) {
             const oldEl = container.firstElementChild;
             oldEl.style.opacity = '0';
             oldEl.style.transform = 'translateY(-50px) scale(0.9)';
             await new Promise(r => setTimeout(r, 500));
             container.innerHTML = '';
        }

        if (session && (now - session.start < CARD_DURATION + 5000)) {
             remainingTime = (CARD_DURATION + 5000) - (now - session.start);
             directorTimeout = setTimeout(directorGameLoop, remainingTime);
             return;
        }
        currentCardData = await selectNextCard(classId);
        if (currentCardData) {
            setSession(currentCardData, now);
            addToHistory(currentCardData.id);
            remainingTime = CARD_DURATION;
        } else {
            remainingTime = 5000; 
        }
    }

    const existingCard = container.firstElementChild;
    if (currentCardData && (!existingCard || existingCard.dataset.cardId !== currentCardData.id)) {
        // Don't overwrite if showing Time's Up
        if (!existingCard || existingCard.dataset.cardId !== 'timer_end') {
            container.innerHTML = ''; 
            spawnCard(container, currentCardData);
        }
    }

    // Loop logic
    directorTimeout = setTimeout(async () => {
        const el = container.firstElementChild;
        // Don't fade out if it's the timer end card, let the timeout above handle it
        if (el && el.dataset.cardId !== 'timer_end') {
            el.style.opacity = '0';
            el.style.transform = 'translateY(-50px) scale(0.9)';
        }
        setTimeout(() => {
            // Only clear if not timer end
            if(container && (!el || el.dataset.cardId !== 'timer_end')) container.innerHTML = ''; 
            directorGameLoop(); 
        }, 5000); 
    }, remainingTime);
}

async function selectNextCard(classId) {
    try {
        let potentialCards = buildDeckList(classId);
        potentialCards = shuffleDeck(potentialCards);
        
        for (const cardType of potentialCards) {
            if (!hasBeenShownRecently(cardType)) {
                const card = await safeHydrate(cardType, classId);
                if (card) return card;
            }
        }
        
        for (const cardType of potentialCards) {
             const card = await safeHydrate(cardType, classId);
             if (card) return card;
        }

        return getSchoolPulseCard();

    } catch (error) {
        console.error("Director Error:", error);
        return getSchoolPulseCard(); 
    }
}

async function safeHydrate(type, classId) {
    try {
        return await hydrateCard(type, classId);
    } catch (e) {
        console.warn(`Failed to hydrate card ${type}:`, e);
        return null;
    }
}

function buildDeckList(classId) {
    let list = [];
    const now = new Date();
    const dateMatch = `-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const hour = now.getHours();

    // --- 1. THE "ALWAYS FRESH" GLOBAL POOL ---
    // These cards appear in BOTH School and Class modes to ensure variety
    const globalPool = [
        'school_pulse', 'treasury_school', 'school_leader_top3', 
        'school_active_bounties', 'school_adventure_count', 'school_upcoming_event',
        'season_visual', 'motivation_poster', 'school_top_student',
        'ai_fact_science', 'ai_fact_history', 'ai_fact_nature', 
        'ai_word', 'ai_joke', 'ai_riddle', 'ai_idiom', 'weather', 'holiday'
    ];

    // --- 2. THE CLASS-SPECIFIC POOL ---
    const classPool = [
        'class_quest', 'treasury_class', 'streak', 'timekeeper', 
        'story_sentence', 'class_bounty', 'next_lesson',
        'attendance_summary', 'absent_heroes', 'mindfulness'
    ];

    if (!classId) {
        // Mode: School Overview
        list = [...globalPool];
    } else {
        // Mode: Specific Class (Lessons: 1.5h - 2h)
        // Mix: 60% Class Data + 40% Global Facts/School Trivia
        list = [...classPool, ...globalPool.sort(() => 0.5 - Math.random()).slice(0, 8)];

        const students = state.get('allStudents').filter(s => s.classId === classId);
        const scores = state.get('allStudentScores');
        const todayStr = utils.getTodayDateString();

        // Check for Test Luck
        const hasTest = state.get('allQuestAssignments').some(a => a.classId === classId && a.testData && utils.datesMatch(a.testData.date, todayStr));
        if (hasTest) list.push('class_test_luck', 'class_test_luck');

        // STUDENT SPOTLIGHTS (Filter out absents)
        const absents = state.get('allAttendanceRecords').filter(r => r.classId === classId && r.date === todayStr).map(r => r.studentId);
        const presentStudents = students.filter(s => !absents.includes(s.id));
        presentStudents.sort(() => 0.5 - Math.random()).slice(0, 6).forEach(s => list.push(`stu_spotlight:${s.id}`));

        // RECENT AWARDS (Fix: One per student to avoid clumping!)
        const awardLogs = state.get('allAwardLogs')
            .filter(l => l.classId === classId)
            .sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        
        const featuredStudents = new Set();
        awardLogs.forEach(l => {
            if (!featuredStudents.has(l.studentId) && featuredStudents.size < 8) {
                list.push(`recent_award:${l.id}`);
                featuredStudents.add(l.studentId);
            }
        });

        // RECENT ADVENTURES (Last 4)
        state.get('allAdventureLogs')
            .filter(l => l.classId === classId && l.imageUrl)
            .slice(0, 4)
            .forEach(l => list.push(`log:${l.id}`));

        // BIRTHDAYS/NAMEDAYS
        students.forEach(s => {
            if (s.birthday?.endsWith(dateMatch)) list.push(`bday:${s.id}`, `bday:${s.id}`);
            if (s.nameday?.endsWith(dateMatch)) list.push(`name:${s.id}`, `name:${s.id}`);
        });
    }

    // Contextual time-based injections
    if (hour < 9) list.push('context_morning');
    if (hour >= 13 && hour < 15) list.push('context_afternoon');
    if (hour >= 19) list.push('context_night');

    return shuffleDeck(list); // Use the new proper shuffle!
}

async function hydrateCard(type, classId) {
    const [baseType, dataId] = type.split(':');
    const baseObj = { id: type }; 
    let content = null;

    if (baseType === 'bday') content = getBirthdayCard(dataId);
    else if (baseType === 'name') content = getNamedayCard(dataId);
    else if (baseType === 'stu_spotlight') content = getStudentSpotlightCard(dataId);
    else if (baseType === 'log') content = getSpecificLogCard(dataId);
    else if (baseType === 'top_student_monthly') content = getTopMonthlyStudentCard(classId, dataId);
    else if (baseType === 'top_student_daily') content = getTopDailyStudentCard(classId, dataId);
    else if (baseType === 'recent_award') content = getRecentAwardCard(classId, dataId);
    else {
        switch(type) {
            case 'school_pulse': content = getSchoolPulseCard(); break;
            case 'treasury_school': content = getTreasuryCard(null); break;
            case 'league_race': content = getRandomLeagueRaceCard(); break;
            case 'school_leader_top3': content = getSchoolLeaderboardCard(); break;
            case 'school_active_bounties': content = getSchoolActiveBountiesCard(); break;
            case 'school_adventure_count': content = getSchoolAdventureCountCard(); break;
            case 'school_upcoming_event': content = getSchoolUpcomingEventCard(); break;
            case 'school_top_student': content = getSchoolTopStudentCard(); break;
            case 'school_avg_attendance': content = getSchoolAttendanceCard(); break;
            case 'school_gold_leader': content = getSchoolGoldLeaderCard(); break;
            case 'season_visual': content = getSeasonalCard(); break;
            case 'giant_clock': content = getGiantClockCard(); break;
            case 'motivation_poster': content = await getMotivationCard(); break;
            case 'holiday': content = getNextHolidayCard(); break;
            case 'weather': content = getWeatherCard(); break;
            case 'class_test_luck': content = getTestLuckCard(classId); break;

            case 'ai_fact_science': content = await getAIFromDB('fact_science'); break;
            case 'ai_fact_history': content = await getAIFromDB('fact_history'); break;
            case 'ai_fact_nature': content = await getAIFromDB('fact_nature'); break;
            case 'ai_joke': content = await getAIFromDB('joke'); break;
            case 'ai_riddle': content = await getAIFromDB('riddle'); break;
            case 'ai_word': content = await getAIFromDB('word'); break;
            case 'ai_idiom': content = await getAIFromDB('idiom'); break;

            case 'class_quest': content = getClassQuestCard(classId); break;
            case 'treasury_class': content = getTreasuryCard(classId); break;
            case 'streak': content = getAttendanceStreakCard(classId); break;
            case 'timekeeper': content = getTimekeeperCard(classId); break;
            case 'story_sentence': content = getStoryCard(classId, 'text'); break;
            case 'class_bounty': content = getClassBountyCard(classId); break;
            case 'next_lesson': content = getNextLessonCard(classId); break;
            case 'attendance_summary': content = getClassAttendanceCard(classId); break;
            case 'absent_heroes': content = getAbsentHeroesCard(classId); break;
            case 'mindfulness': content = getMindfulnessCard(); break;
            
            case 'context_morning': content = { html: `<div class="text-center"><div class="text-8xl mb-2 animate-bounce-slow">☀️</div><h2 class="font-title text-5xl text-amber-500">Good Morning!</h2><p class="text-gray-500 text-xl font-bold">Let's make today legendary.</p></div>`, css: 'float-card-gold' }; break;
            case 'context_afternoon': content = { html: `<div class="text-center"><div class="text-8xl mb-2">⚡</div><h2 class="font-title text-5xl text-blue-500">Power Up!</h2><p class="text-gray-500 text-xl font-bold">Stay focused. You got this.</p></div>`, css: 'float-card-blue' }; break;
            case 'context_night': content = { html: `<div class="text-center"><div class="text-8xl mb-2 animate-pulse-slow">🌙</div><h2 class="font-title text-5xl text-indigo-300">Rest & Recharge</h2><p class="text-indigo-200 text-xl font-bold">Great work today.</p></div>`, css: 'float-card-indigo' }; break;
            case 'context_monday': content = { html: `<div class="text-center"><div class="text-8xl mb-2">🚀</div><h2 class="font-title text-5xl text-red-500">New Week</h2><p class="text-gray-500 text-xl font-bold">New goals. New adventures.</p></div>`, css: 'float-card-red' }; break;
            case 'context_friday': content = { html: `<div class="text-center"><div class="text-8xl mb-2 animate-bounce">🎉</div><h2 class="font-title text-5xl text-purple-500">Fri-YAY!</h2><p class="text-gray-500 text-xl font-bold">Finish strong!</p></div>`, css: 'float-card-purple' }; break;

            default: content = getSchoolPulseCard();
        }
    }
    
    if (!content) return null;
    return { ...baseObj, ...content };
}

function getMindfulnessCard() {
    return {
        html: `
            <div class="text-center w-full">
                <div class="badge-pill bg-teal-100 text-teal-800">Mindfulness Moment</div>
                <div class="relative w-48 h-48 mx-auto my-6 flex items-center justify-center">
                    <div class="absolute inset-0 bg-teal-300 rounded-full opacity-30 mindfulness-pulse"></div>
                    <div class="absolute inset-4 bg-teal-400 rounded-full opacity-40 mindfulness-pulse" style="animation-delay: 0.5s"></div>
                    <div class="absolute inset-8 bg-teal-500 rounded-full opacity-50 mindfulness-pulse" style="animation-delay: 1s"></div>
                    <i class="fas fa-wind text-white text-5xl relative z-10"></i>
                </div>
                <h3 class="font-title text-3xl text-teal-700">Breathe In... Breathe Out...</h3>
            </div>`,
        css: 'float-card-teal'
    };
}

function getSchoolLeaderboardCard() {
    const classes = state.get('allSchoolClasses');
    if (classes.length === 0) return null;
    
    const classScores = classes.map(c => {
        const students = state.get('allStudents').filter(s => s.classId === c.id);
        const stars = students.reduce((sum, s) => {
            const score = state.get('allStudentScores').find(sc => sc.id === s.id);
            return sum + (score?.totalStars || 0);
        }, 0);
        return { name: c.name, logo: c.logo, stars };
    }).sort((a,b) => b.stars - a.stars).slice(0, 3);

    const listHtml = classScores.map((c, i) => 
        `<div class="flex items-center justify-between bg-white/20 rounded-lg p-2 mb-2">
            <span class="font-bold text-white text-lg"><span class="mr-2">${i===0?'🥇':(i===1?'🥈':'🥉')}</span>${c.logo} ${c.name}</span>
            <span class="font-title text-amber-300 text-xl">${c.stars}</span>
        </div>`
    ).join('');

    return {
        html: `<div class="w-full"><h3 class="font-title text-3xl text-white text-center mb-4 border-b-2 border-white/20 pb-2">Top Classes</h3>${listHtml}</div>`,
        css: 'float-card-indigo'
    };
}

function getSchoolActiveBountiesCard() {
    const bounties = state.get('allQuestBounties').filter(b => b.status === 'active');
    if (bounties.length === 0) return null;
    
    return {
        html: `<div class="text-center"><div class="badge-pill bg-red-100 text-red-800">Action Required</div><div class="text-8xl mb-2 animate-pulse">🎯</div><h2 class="font-title text-6xl text-white">${bounties.length}</h2><p class="text-red-100 font-bold text-xl">Active Bounties School-Wide!</p></div>`,
        css: 'float-card-red'
    };
}

function getSchoolAdventureCountCard() {
    const count = state.get('allAdventureLogs').length;
    return {
        html: `<div class="text-center"><div class="text-8xl mb-2">📚</div><h2 class="font-title text-5xl text-emerald-900">${count}</h2><p class="text-emerald-700 font-bold">Adventures Chronicled</p></div>`,
        css: 'float-card-green'
    };
}

function getSchoolUpcomingEventCard() {
    const now = new Date();
    const events = state.get('allQuestEvents')
        .filter(e => new Date(e.date) >= now)
        .sort((a,b) => new Date(a.date) - new Date(b.date));
    
    if(events.length === 0) return null;
    const e = events[0];
    const dateStr = new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });

    return {
        html: `<div class="text-center"><div class="badge-pill bg-purple-100 text-purple-800">Coming Soon</div><h3 class="font-title text-4xl text-white mb-2">${e.details.title}</h3><p class="text-purple-100 text-2xl">${dateStr}</p></div>`,
        css: 'float-card-purple'
    };
}

function getGiantClockCard() {
    const now = new Date();
    return {
        html: `<div class="text-center"><h1 class="font-title text-[8rem] text-white leading-none drop-shadow-lg">${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}</h1><p class="text-white/80 text-2xl font-bold uppercase tracking-widest">${now.toLocaleDateString('en-GB', {weekday:'long'})}</p></div>`,
        css: 'float-card-dark' 
    };
}

function getSeasonalCard() {
    const m = new Date().getMonth();
    let icon = '☀️', text = 'Summer Vibes', css = 'float-card-gold';
    if(m > 8 && m < 11) { icon = '🍂'; text = 'Autumn Leaves'; css = 'float-card-orange'; }
    if(m === 11 || m < 2) { icon = '❄️'; text = 'Winter Wonder'; css = 'float-card-blue'; }
    if(m > 1 && m < 5) { icon = '🌸'; text = 'Spring Bloom'; css = 'float-card-pink'; }
    
    return {
        html: `<div class="text-center"><div class="text-9xl mb-4 animate-float-slow">${icon}</div><h3 class="font-title text-5xl text-gray-700">${text}</h3></div>`,
        css: css
    };
}

async function getMotivationCard() {
    const quotes = [
        "Mistakes are proof that you are trying.",
        "Learning is a treasure that follows its owner everywhere.",
        "The expert in anything was once a beginner.",
        "Be curious, not judgmental.",
        "Every day is a fresh start."
    ];
    const q = quotes[Math.floor(Math.random() * quotes.length)];
    return {
        html: `<div class="text-center p-4"><i class="fas fa-quote-left text-4xl text-white/50 mb-4 block"></i><p class="font-serif text-3xl text-white italic leading-relaxed">"${q}"</p></div>`,
        css: 'float-card-teal'
    };
}

function getTopMonthlyStudentCard(classId, studentId) {
    if (!classId || !studentId) return null;
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return null;
    const scores = state.get('allStudentScores');
    const sc = scores.find(x => x.id === studentId);
    const mStars = sc?.monthlyStars || 0;
    
    const allStudents = state.get('allStudents').filter(s => s.classId === classId);
    const sorted = allStudents.map(s => {
        const sc = scores.find(x => x.id === s.id);
        return { id: s.id, stars: sc?.monthlyStars || 0 };
    }).sort((a,b) => b.stars - a.stars);
    
    const rank = sorted.findIndex(x => x.id === studentId) + 1;
    
    let title = "Quest Hero";
    let css = "float-card-blue";
    
    if (rank === 1) { title = "Monthly Champion"; css = "float-card-gold"; }
    else if (rank <= 3) { title = "Top Scholar"; css = "float-card-purple"; }
    else { title = "Rising Star"; css = "float-card-green"; }

    const avatar = student.avatar ? `<img src="${student.avatar}" class="w-32 h-32 rounded-full border-4 border-white shadow-lg mx-auto mb-2 object-cover">` : `<div class="w-32 h-32 rounded-full bg-white flex items-center justify-center text-6xl mx-auto mb-2 text-indigo-500 font-bold">${student.name.charAt(0)}</div>`;

    return {
        html: `<div class="text-center"><div class="badge-pill bg-white/90 text-indigo-900">${title}</div>${avatar}<h2 class="font-title text-4xl text-white">${student.name}</h2><p class="text-white/90 font-bold text-xl mt-1">${mStars} Monthly Stars</p></div>`,
        css: css
    };
}

function getRecentAwardCard(classId, logId) {
    if (!classId || !logId) return null;
    const log = state.get('allAwardLogs').find(l => l.id === logId);
    if (!log) return null;
    const student = state.get('allStudents').find(s => s.id === log.studentId);
    if (!student) return null;

    const reasonMap = {
        teamwork: { icon: 'fa-users', color: 'text-purple-600', css: 'float-card-purple', bg: 'bg-purple-100' },
        creativity: { icon: 'fa-lightbulb', color: 'text-pink-600', css: 'float-card-pink', bg: 'bg-pink-100' },
        respect: { icon: 'fa-hands-helping', color: 'text-green-600', css: 'float-card-green', bg: 'bg-green-100' },
        focus: { icon: 'fa-brain', color: 'text-yellow-600', css: 'float-card-gold', bg: 'bg-yellow-100' },
        welcome_back: { icon: 'fa-door-open', color: 'text-cyan-600', css: 'float-card-cyan', bg: 'bg-cyan-100' },
        scholar_s_bonus: { icon: 'fa-scroll', color: 'text-amber-700', css: 'float-card-orange', bg: 'bg-amber-100' },
        correction: { icon: 'fa-wrench', color: 'text-gray-600', css: 'float-card-white', bg: 'bg-gray-100' }
    };

    const style = reasonMap[log.reason] || { icon: 'fa-star', color: 'text-indigo-600', css: 'float-card-indigo', bg: 'bg-indigo-100' };
    const starText = log.stars === 1 ? 'Star' : 'Stars';

    const avatarHtml = student.avatar
        ? `<img src="${student.avatar}" class="w-24 h-24 rounded-full border-4 border-white object-cover shadow-lg">`
        : `<div class="w-24 h-24 rounded-full bg-white flex items-center justify-center text-5xl text-indigo-500 font-bold">${student.name.charAt(0)}</div>`;

    return {
        html: `
        <div class="text-center w-full">
            <div class="badge-pill ${style.bg} ${style.color.replace('text', 'text-opacity-80')}">Recent Award</div>
            <div class="flex justify-center items-center gap-4 my-4">
                <div class="text-6xl animate-bounce text-amber-400 drop-shadow-sm">⭐</div>
                ${avatarHtml}
                <div class="text-6xl animate-pulse ${style.color} drop-shadow-sm"><i class="fas ${style.icon}"></i></div>
            </div>
            <h3 class="font-title text-4xl text-gray-800 mb-1">${student.name}</h3>
            <p class="text-2xl font-bold ${style.color}">+${log.stars} ${starText}</p>
            <p class="text-gray-500 font-bold text-sm uppercase tracking-widest mt-2">${log.reason.replace(/_/g,' ')}</p>
        </div>`,
        css: style.css
    };
}

function getClassBountyCard(classId) {
    const bounty = state.get('allQuestBounties').find(b => b.classId === classId && b.status === 'active');
    if(!bounty) return null;
    
    const pct = Math.round((bounty.currentProgress / bounty.target) * 100);
    
    return {
        html: `<div class="text-center w-full"><div class="badge-pill bg-red-100 text-red-800">Active Bounty</div><h3 class="font-title text-2xl text-white mb-2">${bounty.title}</h3><div class="w-full bg-black/20 h-6 rounded-full overflow-hidden mb-2"><div class="bg-red-500 h-full transition-all" style="width:${pct}%"></div></div><p class="text-white font-bold">${bounty.currentProgress} / ${bounty.target} ⭐</p></div>`,
        css: 'float-card-red'
    };
}

function getNextLessonCard(classId) {
    const cls = state.get('allSchoolClasses').find(c => c.id === classId);
    if(!cls) return null;
    
    const today = new Date().getDay();
    const days = (cls.scheduleDays || []).map(Number).sort();
    let nextDay = days.find(d => d > today);
    if (nextDay === undefined) nextDay = days[0]; 
    
    if (nextDay === undefined) return null; 
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    return {
        html: `<div class="text-center"><div class="text-6xl mb-2">📅</div><h3 class="font-title text-3xl text-indigo-900">Next Adventure</h3><p class="text-indigo-600 text-2xl font-bold">${dayNames[nextDay]}</p><p class="text-indigo-400">${cls.timeStart || ''}</p></div>`,
        css: 'float-card-indigo'
    };
}

function getClassAttendanceCard(classId) {
    const students = state.get('allStudents').filter(s => s.classId === classId).length;
    const absents = state.get('allAttendanceRecords').filter(r => r.classId === classId && r.date === utils.getTodayDateString()).length;
    
    if (students === 0) return null;
    const present = students - absents;
    const pct = Math.round((present/students)*100);
    
    return {
        html: `<div class="text-center"><div class="text-6xl mb-2">🎒</div><h3 class="font-title text-4xl text-emerald-900">${pct}% Present</h3><p class="text-emerald-600 font-bold">Heroes Assembled</p></div>`,
        css: 'float-card-green'
    };
}

function getHighScoreCard(classId, type) {
    const scores = state.get('allWrittenScores').filter(s => s.classId === classId && s.type === type);
    if (scores.length === 0) return null;
    
    scores.sort((a,b) => new Date(b.date) - new Date(a.date));
    const recent = scores[0];
    const student = state.get('allStudents').find(s => s.id === recent.studentId);
    if (!student) return null;
    
    const scoreText = recent.scoreQualitative || `${recent.scoreNumeric}%`;
    const label = type === 'test' ? 'Test Champion' : 'Dictation Hero';
    
    return {
        html: `<div class="text-center"><div class="badge-pill bg-blue-100 text-blue-800">${label}</div><h3 class="font-title text-3xl text-white mb-2">${student.name}</h3><p class="text-white text-xl">Recent Score: <b>${scoreText}</b></p></div>`,
        css: 'float-card-blue'
    };
}

async function getAIFromDB(typeFilter) {
    const item = await fetchRandomDailyAI(typeFilter);
    if (!item) return null; // Returning null tells the app to skip this card and pick a different one
    
    let icon = '🤖';
    let css = 'float-card-indigo';
    let title = 'AI Wisdom';
    
    if (item.type.includes('fact')) { icon = '🧠'; css = 'float-card-blue'; title = 'Did You Know?'; }
    if (item.type === 'joke') { icon = '🤣'; css = 'float-card-orange'; title = 'Quest Joke'; }
    if (item.type === 'riddle') { icon = '🧩'; css = 'float-card-purple'; title = 'Riddle Me This'; }
    if (item.type === 'word') { icon = '📖'; css = 'float-card-pink'; title = 'Word of the Day'; }
    if (item.type === 'idiom') { icon = '💬'; css = 'float-card-green'; title = 'Phrase of the Day'; }
    
   let answerHtml = '';
    if (item.answer) {
        answerHtml = `
            <div class="mt-5 pt-4 border-t border-white/30">
                <div class="text-xs font-bold text-white/70 uppercase tracking-widest mb-1">Answer</div>
                <div class="text-2xl font-bold text-white drop-shadow-md">
                    ${item.answer}
                </div>
            </div>`;
    }

    return {
        html: `
            <div class="text-center w-full h-full flex flex-col justify-center">
                <div class="badge-pill bg-white/90 text-indigo-900 border-2 border-white shadow-md mx-auto mb-4">${title}</div>
                <div class="text-7xl mb-4 animate-float-slow filter drop-shadow-lg">${icon}</div>
                <p class="font-serif text-2xl text-white font-medium leading-relaxed drop-shadow-md px-2">
                    "${item.content}"
                </p>
                ${answerHtml}
            </div>`,
        css: css
    };
}

function getTopDailyStudentCard(classId, studentId) {
    if (!classId || !studentId) return null;
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return null;
    const todayStars = state.get('todaysStars');
    const stars = todayStars[studentId]?.stars || 0;
    
    const avatar = student.avatar ? `<img src="${student.avatar}" class="w-32 h-32 rounded-full border-4 border-white shadow-md mx-auto mb-2 object-cover">` : `<div class="w-32 h-32 rounded-full bg-white/50 flex items-center justify-center text-6xl mx-auto mb-2 font-bold">${student.name.charAt(0)}</div>`;
    return {
        html: `<div class="text-center"><div class="badge-pill bg-yellow-100 text-yellow-800">Daily MVP</div>${avatar}<h2 class="font-title text-4xl text-yellow-900">${student.name}</h2><p class="text-yellow-700 font-bold text-xl mt-1">+${stars} Stars Today!</p></div>`,
        css: 'float-card-gold'
    };
}

function getNextHolidayCard() {
    const holidays = state.get('schoolHolidayRanges') || [];
    const now = new Date();
    const sorted = holidays.filter(h => new Date(h.end) >= now).sort((a,b) => new Date(a.start) - new Date(b.start));
    const next = sorted[0];
    if (!next) return null;
    
    const diffDays = Math.ceil((new Date(next.start) - now) / (1000*60*60*24));
    
    // Default: Generic Holiday
    let icon = '🏖️'; 
    let css = 'float-card-blue'; 
    let subtext = 'Break Time';

    const name = next.name.toLowerCase();

    // Christmas Logic
    if (name.includes('christmas') || name.includes('winter')) { 
        icon = '🎄'; 
        css = 'float-card-red'; 
        subtext = 'Winter Holidays'; 
    } 
    // Easter Logic (NEW)
    else if (name.includes('easter') || name.includes('spring')) {
        icon = '🐰'; // Big Bunny Icon
        css = 'float-card-pink'; 
        subtext = 'Spring Celebration';
    }

    return {
        html: `<div class="text-center"><div class="badge-pill bg-white/80 text-gray-800 font-bold">${subtext}</div><div class="text-8xl mb-4 animate-bounce-slow">${icon}</div><h3 class="font-title text-4xl text-gray-900 mb-2">${next.name}</h3><p class="text-2xl font-bold opacity-90">In ${diffDays} Days</p></div>`,
        css: css
    };
}

function getSchoolPulseCard() {
    const scores = state.get('allStudentScores');
    const totalStars = scores.reduce((a, b) => a + (b.totalStars || 0), 0);
    return { html: `<div class="text-center"><div class="badge-pill bg-indigo-100 text-indigo-700">School Pulse</div><div class="text-7xl mb-2 animate-pulse">⭐</div><h2 class="text-5xl font-title text-indigo-900">${totalStars}</h2><p class="text-indigo-500 font-bold uppercase">Total Stars Earned</p></div>`, css: 'float-card-indigo' };
}

function getTreasuryCard(classId) {
    let total = 0;
    const scores = state.get('allStudentScores');
    if(classId) state.get('allStudents').filter(s => s.classId === classId).forEach(s => { const sc = scores.find(x => x.id === s.id); if(sc) total += (sc.gold !== undefined ? sc.gold : sc.totalStars); });
    else total = scores.reduce((sum, s) => sum + (s.gold !== undefined ? s.gold : s.totalStars), 0);
    return { html: `<div class="text-center"><div class="badge-pill bg-amber-100 text-amber-800">Treasury</div><div class="text-8xl mb-2 animate-bounce-slow">💰</div><h2 class="text-6xl font-title text-amber-900">${total}</h2><p class="text-amber-600 font-bold">Gold Coins</p></div>`, css: 'float-card-gold' };
}

function getClassQuestCard(classId) {
    const cls = state.get('allSchoolClasses').find(c => c.id === classId);
    if (!cls) return null;
    
    const students = state.get('allStudents').filter(s => s.classId === classId);
    const scores = state.get('allStudentScores') || [];
    
    // Calculate actual monthly stars
    const monthlyStars = students.reduce((sum, s) => {
        const scoreData = scores.find(sc => sc.id === s.id);
        return sum + (scoreData ? (scoreData.monthlyStars || 0) : 0);
    }, 0);

    // Calculate Dynamic Goal (Sync with Home logic)
    const BASE_GOAL = 18; 
    const SCALING_FACTOR = 2.5; 
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    
    // Holiday Logic
    let holidayDaysLost = 0;
    const ranges = state.get('schoolHolidayRanges') || [];
    ranges.forEach(range => {
        const start = new Date(range.start);
        const end = new Date(range.end);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const overlapStart = start > monthStart ? start : monthStart;
        const overlapEnd = end < monthEnd ? end : monthEnd;
        if (overlapStart <= overlapEnd) {
            holidayDaysLost += (Math.ceil(Math.abs(overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1);
        }
    });

    let monthModifier = (daysInMonth - holidayDaysLost) / daysInMonth;
    monthModifier = now.getMonth() === 5 ? 0.5 : Math.max(0.6, Math.min(1.0, monthModifier));
    
    const dbDifficulty = cls.difficultyLevel || 0;
    const adjustedGoalPerStudent = (BASE_GOAL + (dbDifficulty * SCALING_FACTOR)) * monthModifier;
    const goal = Math.round(Math.max(18, students.length * adjustedGoalPerStudent));
    
    const pct = Math.min(100, Math.round((monthlyStars/goal)*100));
    
    return { 
        html: `<div class="text-center w-full"><div class="badge-pill bg-blue-100 text-blue-700">Quest Progress</div><div class="text-9xl mb-4 filter drop-shadow-md animate-pulse">${cls.logo}</div><div class="w-full bg-white h-8 rounded-full overflow-hidden border-2 border-blue-200 mb-2 shadow-inner"><div class="bg-gradient-to-r from-blue-400 to-indigo-500 h-full" style="width:${pct}%"></div></div><p class="font-title text-4xl text-blue-900">${pct}% Complete</p></div>`, 
        css: 'float-card-blue' 
    };
}

function getTimekeeperCard(classId) {
    const cls = state.get('allSchoolClasses').find(c => c.id === classId);
    if (!cls || !cls.timeEnd) return null;
    const now = new Date(); const [h, m] = cls.timeEnd.split(':').map(Number); const end = new Date(); end.setHours(h, m, 0);
    
    // Calculate total duration (assumed 60 mins if start missing, or calc from start)
    let totalDuration = 60; 
    if (cls.timeStart) {
        const [sh, sm] = cls.timeStart.split(':').map(Number);
        const start = new Date(); start.setHours(sh, sm, 0);
        totalDuration = (end - start) / 60000;
    }

    const diff = Math.ceil((end - now) / 60000);
    if (diff <= 0 || diff > 120) return null;

    // Calculate percentage for ring
    const percent = Math.max(0, Math.min(100, (diff / totalDuration) * 100));
    const degree = percent * 3.6; // 360 degrees

    return { 
        html: `
        <div class="text-center">
            <div class="badge-pill bg-red-100 text-red-700">Timekeeper</div>
            <div class="relative w-48 h-48 mx-auto mb-4 flex items-center justify-center bg-white rounded-full shadow-lg"
                 style="background: conic-gradient(#ef4444 ${degree}deg, #f3f4f6 0deg);">
                <div class="absolute inset-4 bg-white rounded-full flex items-center justify-center flex-col">
                    <span class="font-title text-6xl text-red-600 leading-none">${diff}</span>
                    <span class="text-xs font-bold text-red-400 uppercase">Mins</span>
                </div>
            </div>
            <p class="text-red-900 font-bold text-2xl">Until Adventure Ends</p>
        </div>`, 
        css: 'float-card-red' 
    };
}

function getAttendanceStreakCard(classId) {
    const logs = state.get('allAwardLogs').filter(l => l.classId === classId);
    if (logs.length === 0) return null;

    const starsByDate = logs.reduce((acc, log) => {
        acc[log.date] = (acc[log.date] || 0) + log.stars;
        return acc;
    }, {});

    const sortedDates = Object.keys(starsByDate).sort((a,b) => 
        utils.parseDDMMYYYY(b) - utils.parseDDMMYYYY(a)
    );

    let streak = 0;
    for (const date of sortedDates) {
        if (starsByDate[date] >= 5) {
            streak++;
        } else {
            break; 
        }
    }

    if (streak < 2) return null; 

    return {
        html: `<div class="text-center"><div class="badge-pill bg-orange-100 text-orange-700">On Fire!</div><div class="text-9xl mb-4 animate-bounce">🔥</div><h3 class="font-title text-6xl text-orange-600">${streak} Lessons</h3><p class="text-orange-800 font-bold">Consecutive "Super Days" (>5 Stars)</p></div>`,
        css: 'float-card-orange'
    };
}

function getStudentSpotlightCard(studentId) {
    const s = state.get('allStudents').find(x => x.id === studentId); if (!s) return null;
    const avatar = s.avatar ? `<img src="${s.avatar}" class="w-40 h-40 rounded-full border-8 border-white shadow-xl mx-auto mb-4 object-cover">` : `<div class="w-40 h-40 rounded-full bg-indigo-200 flex items-center justify-center text-7xl mx-auto mb-4 border-8 border-white">${s.name.charAt(0)}</div>`;
    return { html: `<div class="text-center"><div class="badge-pill bg-purple-100 text-purple-700">Hero Spotlight</div>${avatar}<h2 class="font-title text-5xl text-purple-900">${s.name}</h2><p class="text-purple-500 font-bold mt-2">Class Adventurer</p></div>`, css: 'float-card-purple' };
}

function getBirthdayCard(studentId) { const s = state.get('allStudents').find(x => x.id === studentId); if(!s) return null; return { html: `<div class="text-center relative"><div class="absolute -top-6 -left-6 text-7xl animate-bounce">🎉</div><div class="absolute -top-6 -right-6 text-7xl animate-bounce" style="animation-delay:0.5s">🎂</div><div class="badge-pill bg-pink-100 text-pink-700">Celebration!</div><div class="w-40 h-40 mx-auto my-4 rounded-full bg-white flex items-center justify-center text-8xl shadow-inner border-4 border-pink-200">🥳</div><h2 class="font-title text-5xl text-pink-600">Happy Birthday!</h2><h3 class="font-title text-4xl text-pink-800 mt-2">${s.name}</h3></div>`, css: 'float-card-pink' }; }

function getNamedayCard(studentId) { const s = state.get('allStudents').find(x => x.id === studentId); if(!s) return null; return { html: `<div class="text-center relative"><div class="absolute -top-4 left-1/2 -translate-x-1/2 text-6xl animate-pulse">✨</div><div class="inline-block bg-green-100 text-green-700 text-xs font-bold px-4 py-2 rounded-full mb-6 uppercase tracking-widest border border-green-200">Happy Nameday!</div><div class="text-8xl mb-4">🎈</div><h2 class="font-title text-5xl text-green-900 mb-2">${s.name}</h2><p class="font-serif italic text-2xl text-green-600 mt-2">Χρόνια Πολλά!</p></div>`, css: 'float-card-green' }; }

function getStoryCard(classId, mode) {
    const story = state.get('currentStoryData')[classId]; if(!story) return null;
    if (mode === 'image' && story.currentImageUrl) return { html: `<div class="text-center"><div class="badge-pill bg-cyan-100 text-cyan-700">Visual Chronicle</div><div class="p-2 bg-white rounded-2xl shadow-lg rotate-1"><img src="${story.currentImageUrl}" class="w-full h-56 object-cover rounded-xl"></div><p class="text-cyan-900 font-serif italic mt-3 text-sm">"From our story..."</p></div>`, css: 'float-card-cyan' };
    return { html: `<div class="text-center"><div class="badge-pill bg-cyan-100 text-cyan-700">Story So Far</div><div class="bg-white/60 p-6 rounded-2xl border border-cyan-200 mt-4 relative shadow-sm"><i class="fas fa-quote-left absolute top-2 left-2 text-cyan-300 text-4xl opacity-50"></i><p class="font-serif text-2xl text-cyan-900 italic leading-relaxed">"${story.currentSentence}"</p></div></div>`, css: 'float-card-cyan' };
}

function getSpecificLogCard(logId) {
    const log = state.get('allAdventureLogs').find(l => l.id === logId);
    if (!log) return null;
    return {
        html: `<div class="text-center"><div class="badge-pill bg-teal-100 text-teal-700">Flashback</div><p class="text-xs text-teal-600 font-bold uppercase mb-2">${log.date}</p><div class="bg-white p-2 rounded-2xl shadow-lg rotate-2 mb-2"><img src="${log.imageUrl}" class="w-full h-40 object-cover rounded-xl"></div><p class="font-serif text-teal-900 text-sm line-clamp-4">"${log.text}"</p></div>`,
        css: 'float-card-teal'
    };
}

function getHomeworkCard(classId) { const assignments = state.get('allQuestAssignments').filter(a => a.classId === classId); if(assignments.length === 0) return null; return { html: `<div class="text-center"><div class="badge-pill bg-amber-100 text-amber-800">Mission</div><div class="text-7xl mb-2">📜</div><div class="bg-white/80 p-6 rounded-xl border-l-4 border-amber-400 text-left shadow-sm"><p class="font-handwriting text-2xl text-amber-900">${assignments[assignments.length-1].text}</p></div></div>`, css: 'float-card-gold' }; }

function getWeatherCard() { return { html: `<div class="text-center"><div class="badge-pill bg-sky-100 text-sky-700">Forecast</div><div class="text-8xl mb-2 animate-pulse-slow">🌤️</div><h3 class="font-title text-4xl text-sky-900">Look Outside!</h3><p class="text-sky-600 font-bold">The world is beautiful.</p></div>`, css: 'float-card-blue' }; }

function getRandomLeagueRaceCard() { return { html: `<div class="text-center"><div class="text-8xl mb-4">🏁</div><h3 class="font-title text-4xl text-gray-800">League Race</h3><p class="text-gray-600 font-bold">Who will take the lead?</p></div>`, css: 'float-card-white' }; }

function getSchoolGoldLeaderCard() {
    const classes = state.get('allSchoolClasses');
    if(classes.length === 0) return null;
    let topClass = null, maxGold = -1;
    classes.forEach(c => {
        const students = state.get('allStudents').filter(s => s.classId === c.id);
        const gold = students.reduce((sum, s) => {
            const sc = state.get('allStudentScores').find(score => score.id === s.id);
            return sum + (sc?.gold || 0);
        }, 0);
        if(gold > maxGold) { maxGold = gold; topClass = c; }
    });
    if(!topClass) return null;
    return {
        html: `<div class="text-center"><div class="badge-pill bg-amber-100 text-amber-800">Richest Realm</div><div class="text-7xl mb-2">💰</div><h3 class="font-title text-4xl text-amber-900">${topClass.name}</h3><p class="text-amber-700 text-xl font-bold">${maxGold} Gold Coins</p></div>`,
        css: 'float-card-gold'
    };
}

function getSchoolTopStudentCard() {
    const scores = state.get('allStudentScores');
    const students = state.get('allStudents');
    if(scores.length === 0) return null;
    
    const sorted = scores.sort((a,b) => b.totalStars - a.totalStars);
    const topScore = sorted[0];
    const student = students.find(s => s.id === topScore.id);
    if(!student) return null;
    
    return {
        html: `<div class="text-center"><div class="badge-pill bg-purple-100 text-purple-800">School Champion</div><div class="text-7xl mb-2">👑</div><h3 class="font-title text-4xl text-purple-900">${student.name}</h3><p class="text-purple-700 text-xl font-bold">${topScore.totalStars} Total Stars</p></div>`,
        css: 'float-card-purple'
    };
}

function getSchoolAttendanceCard() {
    const students = state.get('allStudents');
    if (students.length === 0) return null;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const records = state.get('allAttendanceRecords').filter(r => {
        const d = utils.parseFlexibleDate(r.date);
        return d && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    if (records.length === 0) return null;

    const absentsToday = state.get('allAttendanceRecords').filter(r => 
        r.date === utils.getTodayDateString()
    ).length;
    
    const totalStudents = students.length;
    const presentToday = totalStudents - absentsToday;
    const pct = Math.round((presentToday / totalStudents) * 100);

    return {
        html: `<div class="text-center"><div class="text-7xl mb-2">📊</div><h3 class="font-title text-4xl text-indigo-900">${pct}% Present</h3><p class="text-indigo-600 font-bold">School-Wide Today</p></div>`,
        css: 'float-card-indigo'
    };
}

function spawnCard(container, card) {
    const el = document.createElement('div');
    el.className = `wallpaper-float-card ${card.css} absolute`;
    el.innerHTML = card.html;
    el.dataset.cardId = card.id; 
    
    const zones = [
        { top: '8%', left: '5%', bottom: 'auto', right: 'auto' },      
        { top: '8%', right: '5%', bottom: 'auto', left: 'auto' },      
        { bottom: '10%', left: '5%', top: 'auto', right: 'auto' },     
        { bottom: '10%', right: '5%', top: 'auto', left: 'auto' }      
    ];
    
    const pos = zones[Math.floor(Math.random() * zones.length)];
    
    el.style.top = pos.top;
    el.style.bottom = pos.bottom;
    el.style.left = pos.left;
    el.style.right = pos.right;

    el.style.opacity = '0';
    el.style.transform = 'translateY(50px) scale(0.9)'; 
    
    container.appendChild(el);
    
    void el.offsetWidth;
    
    el.style.opacity = '1';
    el.style.transform = 'translateY(0) scale(1) rotate(' + (Math.random() * 2 - 1) + 'deg)';
    
    return el;
}

export async function initSeasonalAtmosphere() {
    const wall = document.getElementById('dynamic-wallpaper-screen');
    
    const existingEffects = document.getElementById('seasonal-effects-layer');
    if (existingEffects) existingEffects.remove();
    
    const existingFog = document.getElementById('wall-fog-overlay');
    if (existingFog) existingFog.remove();

    wall.classList.remove('weather-clear', 'weather-cloudy', 'weather-rainy', 'weather-snowy', 'weather-stormy');

    const layer = document.createElement('div');
    layer.id = 'seasonal-effects-layer';
    layer.className = 'absolute inset-0 pointer-events-none z-0 overflow-hidden';
    
    let weatherCode = null;
    
    const cached = localStorage.getItem('gcq_weather_data_open_meteo');
    if (cached) {
        try {
            const data = JSON.parse(cached);
            if (Date.now() - data.timestamp < 3 * 60 * 60 * 1000) {
                weatherCode = data.weather.code;
            }
        } catch(e) {}
    }

    if (weatherCode === null) {
        try {
            const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=37.9667&longitude=23.6667&current=weather_code&timezone=auto');
            const d = await res.json();
            weatherCode = d.current.weather_code;
        } catch(e) { console.log("Weather fetch failed, using seasonal fallback."); }
    }

    let effectHTML = '';
    let usedRealWeather = false;

    // Helper to generate "A LOT" of clouds
    const generateHeavyClouds = (count = 15, opacity = 0.8) => {
        let clouds = '';
        for(let i=0; i<count; i++) {
            const top = Math.random() * 60; // Top half of screen
            const left = Math.random() * 100;
            const size = 10 + Math.random() * 20; // Massive clouds
            const duration = 120 + Math.random() * 60; // Slow drift
            const delay = -Math.random() * 100;
            // Use existing font-awesome cloud class logic from CSS (color changes by weather type)
            clouds += `<i class="fas fa-cloud absolute" style="font-size:${size}rem; top:${top}%; left:${left}%; opacity:${opacity}; animation: float-clouds-right ${duration}s linear infinite; animation-delay:${delay}s;"></i>`;
        }
        return clouds;
    };

    if (weatherCode !== null) {
        usedRealWeather = true;
        
        // 0: Clear Sky
        if (weatherCode === 0) {
            wall.classList.add('weather-clear'); 
            layer.classList.add('summer-glow'); 
        }
        
        // 1-2: Mainly Clear / Partly Cloudy (NO extra clouds, sun visible)
        // 1-2: Mainly Clear / Partly Cloudy (Blue Sky + Some Clouds)
        else if (weatherCode <= 2) {
            wall.classList.add('weather-clear'); // Uses the Blue Sky Gradient
            effectHTML += generateHeavyClouds(8, 0.5); // Add some light clouds manually
        }
            
        // 3, 45, 48: Overcast / Fog (ADD extra clouds to obscure sun)
        else if (weatherCode <= 48) {
            wall.classList.add('weather-cloudy');
            effectHTML += generateHeavyClouds(12, 0.6); // Add heavy cloud layer
            
            if (weatherCode >= 45) { 
                const fog = document.createElement('div');
                fog.id = 'wall-fog-overlay';
                fog.className = 'wall-fog-layer'; 
                wall.appendChild(fog);
            }
        }
        
        // 51-67, 80-82: Rain (ADD extra clouds)
        else if ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82)) {
            wall.classList.add('weather-rainy'); 
            effectHTML += generateHeavyClouds(15, 0.7); // Darker, denser clouds
            for (let i = 0; i < 60; i++) { 
                const left = Math.random() * 100;
                const delay = Math.random() * 2;
                const duration = 1.5 + Math.random() * 1.0; 
                effectHTML += `<div class="seasonal-particle rain" style="left:${left}%; animation-delay:-${delay}s; animation-duration:${duration}s;"></div>`;
            }
        }
        
        // 71-77, 85-86: Snow (ADD extra clouds)
        else if ((weatherCode >= 71 && weatherCode <= 77) || (weatherCode >= 85 && weatherCode <= 86)) {
            wall.classList.add('weather-snowy');
            effectHTML += generateHeavyClouds(15, 0.7); // White heavy clouds
            for (let i = 0; i < 40; i++) {
                const left = Math.random() * 100;
                const delay = Math.random() * 5;
                const duration = 10 + Math.random() * 8;
                effectHTML += `<div class="seasonal-particle snow" style="left:${left}%; animation-delay:-${delay}s; animation-duration:${duration}s;">❄️</div>`;
            }
        }

        // 95+: Thunderstorm (ADD extra clouds)
        else if (weatherCode >= 95) {
            wall.classList.add('weather-stormy');
            effectHTML += generateHeavyClouds(20, 0.9); // Very dense, dark clouds
            for (let i = 0; i < 100; i++) { 
                const left = Math.random() * 100;
                const delay = Math.random() * 2;
                const duration = 1.0 + Math.random() * 0.8; 
                effectHTML += `<div class="seasonal-particle rain" style="left:${left}%; animation-delay:-${delay}s; animation-duration:${duration}s; height: 40px; opacity: 0.7;"></div>`;
            }
        }
    }

    // Seasonal Fallback (Slowed)
    if (!usedRealWeather) {
        const month = new Date().getMonth();
        if (month === 11 || month <= 1) { 
             effectHTML += generateHeavyClouds(10, 0.6); // Winter clouds
             for (let i = 0; i < 30; i++) {
                const left = Math.random() * 100;
                const delay = Math.random() * 5;
                const duration = 10 + Math.random() * 8;
                effectHTML += `<div class="seasonal-particle snow" style="left:${left}%; animation-delay:-${delay}s; animation-duration:${duration}s;">❄️</div>`;
            }
        } else if (month >= 8 && month <= 10) { 
             for (let i = 0; i < 15; i++) {
                const left = Math.random() * 100;
                const delay = Math.random() * 5;
                const duration = 12 + Math.random() * 5; 
                effectHTML += `<div class="seasonal-particle leaf" style="left:${left}%; animation-delay:-${delay}s; animation-duration:${duration}s;">🍂</div>`;
            }
        } else if (month >= 2 && month <= 4) { 
             for (let i = 0; i < 15; i++) {
                const left = Math.random() * 100;
                const delay = Math.random() * 5;
                const duration = 15 + Math.random() * 5; 
                effectHTML += `<div class="seasonal-particle petal" style="left:${left}%; animation-delay:-${delay}s; animation-duration:${duration}s;">🌸</div>`;
            }
        } else { 
            wall.classList.add('weather-clear');
            layer.classList.add('summer-glow');
        }
    }

    layer.innerHTML = effectHTML;
    const hub = document.getElementById('wall-center-hub');
    wall.insertBefore(layer, hub);
}

function getAbsentHeroesCard(classId) {
    const today = utils.getTodayDateString();
    const absents = state.get('allAttendanceRecords')
        .filter(r => r.classId === classId && r.date === today)
        .map(r => {
            const s = state.get('allStudents').find(stu => stu.id === r.studentId);
            return s ? s.name.split(' ')[0] : null;
        })
        .filter(Boolean);

    if (absents.length === 0) return null;

    const namesHtml = absents.map(n => `<span class="inline-block bg-white/50 px-2 py-1 rounded m-1 text-red-800 font-bold">${n}</span>`).join('');

    return {
        html: `
        <div class="text-center">
            <div class="badge-pill bg-red-100 text-red-800">Missing Heroes</div>
            <div class="text-7xl mb-4 opacity-80">🛡️</div>
            <h3 class="font-title text-3xl text-red-900 mb-2">We miss you!</h3>
            <div class="flex flex-wrap justify-center text-lg">
                ${namesHtml}
            </div>
            <p class="text-red-700/60 text-sm mt-3 font-bold">Hope to see you next time!</p>
        </div>`,
        css: 'float-card-red'
    };
}

function getTestLuckCard(classId) {
    const assignments = state.get('allQuestAssignments');
    const todayStr = utils.getTodayDateString();
    
    // Find the specific test details
    const test = assignments.find(a => 
        a.classId === classId && 
        a.testData && 
        utils.datesMatch(a.testData.date, todayStr)
    );
    
    const title = test ? test.testData.title : "The Big Exam";

    return {
        html: `
        <div class="text-center w-full">
            <div class="badge-pill bg-white/90 text-red-600 border border-red-200">⚔️ Challenge Event</div>
            <div class="text-8xl mb-4 animate-bounce">🍀</div>
            <h2 class="font-title text-5xl text-white drop-shadow-md mb-2">Good Luck!</h2>
            <p class="text-white text-xl font-bold opacity-90">You are ready for</p>
            <p class="font-title text-3xl text-yellow-300 mt-1" style="text-shadow: 0 2px 4px rgba(0,0,0,0.5);">${title}</p>
        </div>`,
        css: 'float-card-red'
    };
}
