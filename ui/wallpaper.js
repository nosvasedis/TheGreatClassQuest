import { db } from '../firebase.js';
import { collection, query, where, getDocs, addDoc, writeBatch, serverTimestamp, orderBy, limit, doc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import * as state from '../state.js';
import * as utils from '../utils.js';
import { callGeminiApi } from '../api.js';
import { canUseFeature } from '../utils/subscription.js';
import * as constants from '../constants.js';
import { renderFamiliarSprite } from '../features/familiars.js';
import { getEggAlertState } from '../features/familiarProgression.mjs';
import { getNextAssessmentOccurrenceForToday, getUpcomingScheduledAssessment } from '../features/assessmentConfig.js';
import { getClassQuestProgressData, getQuestMapZoneForProgressPercent } from '../features/worldMap.js';

// Proper Fisher-Yates shuffle for true variety
function shuffleDeck(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Returns a human-readable age/level description for AI prompts
function getLevelLabel(questLevel) {
    const map = {
        'Junior A': 'young children aged 7-8 (very simple words, short sentences, playful tone)',
        'Junior B': 'children aged 8-9 (simple language, fun facts, short sentences)',
        'A': 'students aged 9-10 (clear and friendly language, interesting facts)',
        'B': 'students aged 10-11 (moderate vocabulary, engaging content)',
        'C': 'students aged 11-12 (good vocabulary, thought-provoking content)',
        'D': 'students aged 12-13 (advanced vocabulary, challenging content okay)'
    };
    return map[questLevel] || 'students aged 9-12 (clear, fun, and educational language)';
}

// Returns a simple tier for conditional logic
function getLevelTier(questLevel) {
    if (!questLevel) return 'mid';
    if (questLevel === 'Junior A' || questLevel === 'Junior B') return 'junior';
    if (questLevel === 'A' || questLevel === 'B') return 'mid';
    return 'senior';
}

const AI_CARD_TYPES = new Set([
    'ai_fact_science', 'ai_fact_history', 'ai_fact_nature', 'ai_fact_geography',
    'ai_fact_math', 'ai_did_you_know',
    'ai_word', 'ai_joke', 'ai_riddle', 'ai_idiom', 'ai_brain_teaser', 'ai_tongue_twister'
]);

const CARD_FEATURE_REQUIREMENTS = {
    ...Object.fromEntries([...AI_CARD_TYPES].map((type) => [type, 'eliteAI'])),
    school_upcoming_event: 'calendar',
    class_test_luck: 'scholarScroll',
    upcoming_test_countdown: 'scholarScroll',
    guild_leaderboard: 'guilds',
    story_sentence: 'storyWeavers',
    class_familiar_parade: 'familiars',
    class_familiar_hatch_watch: 'familiars',
    school_adventure_count: 'adventureLog',
    reigning_hero_spotlight: 'adventureLog',
    log: 'adventureLog'
};

function getCardBaseType(cardType) {
    return String(cardType || '').split(':')[0];
}

function getWallpaperCapabilities() {
    return {
        guilds: canUseFeature('guilds'),
        calendar: canUseFeature('calendar'),
        scholarScroll: canUseFeature('scholarScroll'),
        storyWeavers: canUseFeature('storyWeavers'),
        familiars: canUseFeature('familiars'),
        adventureLog: canUseFeature('adventureLog'),
        eliteAI: canUseFeature('eliteAI')
    };
}

function canRenderCardForTier(cardType, capabilities = getWallpaperCapabilities()) {
    const requiredFeature = CARD_FEATURE_REQUIREMENTS[getCardBaseType(cardType)];
    if (!requiredFeature) return true;
    return capabilities[requiredFeature] === true;
}

function filterDeckForTier(cards, capabilities = getWallpaperCapabilities()) {
    return cards.filter((cardType) => canRenderCardForTier(cardType, capabilities));
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
// Timed blur: answer stays blurred for (CARD_DURATION - BLUR_FULLY_VISIBLE_LAST_MS), then fully visible for last 10s
const BLUR_FULLY_VISIBLE_LAST_MS = 10000;
const BLUR_REVEAL_MS = CARD_DURATION - BLUR_FULLY_VISIBLE_LAST_MS; // 50s of gradual unblur
const BLUR_MAX_PX = 12;

let solarData = {
    sunrise: new Date().setHours(6, 30, 0, 0),
    sunset: new Date().setHours(20, 30, 0, 0)
};

const clockHandAngles = {
    hour: null,
    minute: null,
    second: null
};

function resetWallpaperClockHandAngles() {
    clockHandAngles.hour = null;
    clockHandAngles.minute = null;
    clockHandAngles.second = null;
}

function setContinuousClockRotation(hand, key, angle) {
    if (!hand) return;
    let nextAngle = angle;
    const previous = clockHandAngles[key];
    if (previous !== null) {
        while (nextAngle < previous) nextAngle += 360;
    }
    clockHandAngles[key] = nextAngle;
    hand.style.transform = `rotate(${nextAngle}deg)`;
}

function getWallpaperTimerTone(deadline) {
    const tone = utils.getCountdownTone(deadline);
    if (tone === 'critical') {
        return {
            cardClass: 'float-card-red animate-pulse',
            icon: '🔥',
            accent: 'text-rose-100'
        };
    }
    if (tone === 'warning') {
        return {
            cardClass: 'float-card-orange',
            icon: '⏳',
            accent: 'text-amber-100'
        };
    }
    return {
        cardClass: 'float-card-indigo',
        icon: '⏰',
        accent: 'text-sky-100'
    };
}

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
            resetWallpaperClockHandAngles();
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
    // Analogue clock elements
    const clockHour = document.getElementById('wall-clock-hour');
    const clockMinute = document.getElementById('wall-clock-minute');
    const clockSecond = document.getElementById('wall-clock-second');

    // Inject 60 minute-tick marks into the SVG once on start-up
    const minTicksGroup = document.getElementById('clock-minor-ticks');
    if (minTicksGroup && minTicksGroup.children.length === 0) {
        for (let i = 0; i < 60; i++) {
            if (i % 5 === 0) continue; // major ticks already drawn
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            const angle = i * 6; // 360 / 60
            const rad = (angle - 90) * (Math.PI / 180);
            const outerR = 85, innerR = 79;
            line.setAttribute('x1', 100 + outerR * Math.cos(rad));
            line.setAttribute('y1', 100 + outerR * Math.sin(rad));
            line.setAttribute('x2', 100 + innerR * Math.cos(rad));
            line.setAttribute('y2', 100 + innerR * Math.sin(rad));
            minTicksGroup.appendChild(line);
        }
    }

    const update = () => {
        if (!isRunning) return;
        const now = new Date();
        const h = now.getHours() % 12;
        const m = now.getMinutes();
        const s = now.getSeconds();

        // 1. Update Text (Keep the clock ticking!)
        timeEl.innerText = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        dateEl.innerText = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

        // 2. Drive the analogue clock hands
        if (clockHour && clockMinute && clockSecond) {
            const hourDeg = (h * 30) + (m * 0.5) + (s * (0.5 / 60)); // 30° per hour + minute/second offset
            const minuteDeg = (m * 6) + (s * 0.1);                       // 6° per minute + second offset
            const secondDeg = s * 6;                                       // 6° per second
            setContinuousClockRotation(clockHour, 'hour', hourDeg);
            setContinuousClockRotation(clockMinute, 'minute', minuteDeg);
            setContinuousClockRotation(clockSecond, 'second', secondDeg);
        }

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
                const schoolName = state.get('schoolName') || constants.DEFAULT_SCHOOL_NAME;
                hubName.innerHTML = `<span class="mr-3 text-5xl">🏫</span>${schoolName}`;
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

    // Non-Elite schools should not spend reads on AI content collections.
    if (!canUseFeature('eliteAI')) {
        localStorage.setItem(storageKey, "loaded");
        return;
    }

    const contentCollection = collection(db, "artifacts/great-class-quest/public/data/daily_ai_content");
    const q = query(contentCollection, where("date", "==", today));
    const snapshot = await getDocs(q);

    // Determine the audience level from the currently viewed class
    const cls = state.get('allSchoolClasses').find(c => c.id === state.get('globalSelectedClassId'));
    const levelLabel = getLevelLabel(cls?.questLevel);

    if (snapshot.empty) {
        console.log("Generating fresh AI content for the day...");
        const systemPrompt = `You are a creative content engine for an English language school in Greece.
        Target audience: ${levelLabel}.
        Generate a JSON array of EXACTLY 30 objects. Use a diverse mix of these types:
        - 'fact_science' (curious science facts)
        - 'fact_history' (history facts about ancient Greece, UK, USA, world history – use 4-5 of each)
        - 'fact_nature' (animals, plants, environment)
        - 'fact_geography' (UK, USA, Greece, world – cities, landmarks, records)
        - 'fact_math' (fun numbers, patterns, records)
        - 'did_you_know' (surprising general knowledge)
        - 'joke' (clean, funny, age-appropriate)
        - 'riddle' (simple logic riddle with answer)
        - 'brain_teaser' (short logic puzzle with answer)
        - 'word' (interesting English word with its meaning as answer)
        - 'idiom' (English idiom with its meaning as answer)
        - 'tongue_twister' (fun English tongue twister)
        Structure: { "type": "string", "content": "string", "answer": "string (only for riddles, brain_teasers, words, idioms)" }.
        IMPORTANT: Calibrate all language complexity and content to be appropriate for ${levelLabel}.
        Content must be kid-friendly, educational, and fun. No markdown. Return ONLY the JSON array.`;

        try {
            const jsonStr = await callGeminiApi(systemPrompt, "Generate 30 items now.");
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
                    levelLabel: levelLabel,
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

    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
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
                const legacyTimeDisplay = `${minutes}:${String(seconds).padStart(2, '0')}`;

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
                            <div class="font-title text-5xl text-white drop-shadow-md leading-none font-variant-numeric:tabular-nums">${legacyTimeDisplay}</div>
                        </div>
                    </div>`;
                const tone = getWallpaperTimerTone(activeTimer.deadline);
                const timeDisplay = utils.formatCountdownClock(activeTimer.deadline, { expiredLabel: '00:00:00' });
                const urgencyLabel = utils.formatCountdownCompact(activeTimer.deadline, 'Expired');
                timerOverlay.innerHTML = `
                    <div class="wallpaper-float-card ${tone.cardClass} !w-auto !min-w-[360px] !rounded-[28px] !p-5 shadow-2xl border-4" style="position: relative; transform: none; animation: none;">
                        <div class="flex items-center justify-between gap-6">
                            <div class="flex items-center gap-4">
                                <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-4xl shadow-inner shadow-white/10">${tone.icon}</div>
                                <div class="text-left">
                                    <div class="text-[10px] font-black uppercase tracking-[0.28em] text-white/70 leading-none mb-2">Timed Quest</div>
                                    <h3 class="font-title text-2xl text-white leading-tight truncate max-w-[180px]">${activeTimer.title}</h3>
                                    <div class="mt-2 text-sm font-bold ${tone.accent}">Clock pressure is active</div>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="font-title text-5xl text-white drop-shadow-md leading-none font-variant-numeric:tabular-nums">${timeDisplay}</div>
                                <div class="mt-2 text-xs font-black uppercase tracking-[0.24em] text-white/65">${urgencyLabel}</div>
                            </div>
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
            if (oldEl._blurIntervalId) clearInterval(oldEl._blurIntervalId);
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
            if (el._blurIntervalId) clearInterval(el._blurIntervalId);
            el.style.opacity = '0';
            el.style.transform = 'translateY(-50px) scale(0.9)';
        }
        setTimeout(() => {
            // Only clear if not timer end
            if (container && (!el || el.dataset.cardId !== 'timer_end')) container.innerHTML = '';
            directorGameLoop();
        }, 5000);
    }, remainingTime);
}

async function selectNextCard(classId) {
    try {
        const capabilities = getWallpaperCapabilities();
        let potentialCards = buildDeckList(classId, capabilities);
        potentialCards = shuffleDeck(potentialCards);

        for (const cardType of potentialCards) {
            if (!hasBeenShownRecently(cardType)) {
                const card = await safeHydrate(cardType, classId, capabilities);
                if (card) return card;
            }
        }

        for (const cardType of potentialCards) {
            const card = await safeHydrate(cardType, classId, capabilities);
            if (card) return card;
        }

        return getSchoolPulseCard();

    } catch (error) {
        console.error("Director Error:", error);
        return getSchoolPulseCard();
    }
}

async function safeHydrate(type, classId, capabilities) {
    try {
        return await hydrateCard(type, classId, capabilities);
    } catch (e) {
        console.warn(`Failed to hydrate card ${type}:`, e);
        return null;
    }
}

function buildDeckList(classId, capabilities = getWallpaperCapabilities()) {
    let list = [];
    const now = new Date();
    const dateMatch = `-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const hour = now.getHours();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
    const todayStr = utils.getTodayDateString();

    // --- Determine lesson phase for time-aware card weighting ---
    // We detect how far into the current lesson we are
    let lessonPhase = 'main'; // 'opening', 'main', 'winddown'
    if (classId) {
        const cls = state.get('allSchoolClasses').find(c => c.id === classId);
        if (cls?.timeStart) {
            const [sh, sm] = cls.timeStart.split(':').map(Number);
            const lessonStartMs = sh * 60 + sm;
            const nowMs = now.getHours() * 60 + now.getMinutes();
            const minIntoLesson = nowMs - lessonStartMs;
            if (minIntoLesson < 20) lessonPhase = 'opening';
            else if (minIntoLesson >= 70) lessonPhase = 'winddown';
        }
    }

    // --- 1. THE "ALWAYS FRESH" GLOBAL POOL ---
    const globalPool = [
        'school_pulse', 'treasury_school', 'school_leader_top3',
        'school_active_bounties', 'school_adventure_count', 'school_upcoming_event',
        'season_visual', 'motivation_poster', 'school_top_student', 'school_gold_leader',
        'school_avg_attendance',
        // AI-generated variety
        'ai_fact_science', 'ai_fact_history', 'ai_fact_nature', 'ai_fact_geography',
        'ai_fact_math', 'ai_did_you_know',
        'ai_word', 'ai_joke', 'ai_riddle', 'ai_idiom', 'ai_brain_teaser', 'ai_tongue_twister',
        // Contextual trivia
        'weather', 'holiday', 'this_day_history', 'world_record',
        'study_tip', 'thought_experiment', 'emoji_riddle', 'math_challenge',
        'greek_nameday_today', 'orthodox_calendar',
        // New cards
        'guild_leaderboard', 'fun_english_phrase'
    ];

    // --- 2. THE CLASS-SPECIFIC POOL ---
    const classPool = [
        'class_quest', 'treasury_class', 'streak', 'timekeeper',
        'story_sentence', 'class_bounty', 'next_lesson',
        'attendance_summary', 'absent_heroes', 'mindfulness',
        'quest_map_position', 'class_rank_vs_school', 'class_gold_ranking',
        'reigning_hero_spotlight', 'lesson_milestone',
        // New cards
        'class_familiar_parade', 'class_familiar_hatch_watch', 'class_gold_top_trio'
    ];

    if (!classId) {
        // Mode: School Overview
        list = [...globalPool];
    } else {
        // Mode: Specific Class
        // Phase-aware mixing
        const globalSample = lessonPhase === 'opening' ? 6 :
            lessonPhase === 'winddown' ? 10 : 8;
        list = [...classPool, ...globalPool.sort(() => 0.5 - Math.random()).slice(0, globalSample)];

        const students = state.get('allStudents').filter(s => s.classId === classId);
        const scores = state.get('allStudentScores');

        // --- Test Today: big luck boost ---
        const hasTestToday = getNextAssessmentOccurrenceForToday(classId).some((item) =>
            item.phase === 'later_today' || item.phase === 'today' || item.phase === 'in_progress');
        if (hasTestToday) list.push('class_test_luck', 'class_test_luck', 'class_test_luck');

        // --- Upcoming Test Countdown (within 7 days but not today) ---
        const nextTest = getUpcomingScheduledAssessment(classId);
        if (nextTest && nextTest.dayDiff > 0 && nextTest.dayDiff <= 7) {
            list.push('upcoming_test_countdown', 'upcoming_test_countdown');
        }

        // STUDENT SPOTLIGHTS (Filter out absents)
        const absents = state.get('allAttendanceRecords')
            .filter(r => r.classId === classId && r.date === todayStr)
            .map(r => r.studentId);
        const presentStudents = students.filter(s => !absents.includes(s.id));

        // Spotlight cards (up to 6)
        presentStudents.sort(() => 0.5 - Math.random()).slice(0, 6)
            .forEach(s => list.push(`stu_spotlight:${s.id}`));

        // Student fun-fact cards (up to 5, distinct from spotlights)
        presentStudents.sort(() => 0.5 - Math.random()).slice(0, 5)
            .forEach(s => list.push(`stu_funfact:${s.id}`));

        // RECENT AWARDS (One per student to avoid clumping)
        const awardLogs = state.get('allAwardLogs')
            .filter(l => l.classId === classId)
            .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
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

        // BIRTHDAYS/NAMEDAYS (doubled for celebration priority)
        students.forEach(s => {
            if (s.birthday?.endsWith(dateMatch)) list.push(`bday:${s.id}`, `bday:${s.id}`);
            if (s.nameday?.endsWith(dateMatch)) list.push(`name:${s.id}`, `name:${s.id}`);
        });

        if (lessonPhase === 'opening') {
            list.push('mindfulness', 'context_morning');
            // Check if it's been a while since the last lesson (Holiday Welcome)
            const attendance = state.get('allAttendanceRecords').filter(r => r.classId === classId);
            const sortedDates = [...new Set(attendance.map(r => r.date))].sort().reverse();
            if (sortedDates.length > 0) {
                const last = utils.parseFlexibleDate(sortedDates[0]);
                const diff = (now - last) / (1000 * 60 * 60 * 24);
                if (diff > 7) list.push('post_holiday_welcome', 'post_holiday_welcome');
            }
        }
        if (lessonPhase === 'winddown') {
            list.push('mindfulness', 'study_tip', 'thought_experiment', 'class_season_snapshot');
        }
    }

    // --- Global time-of-day context cards ---
    if (hour < 9) list.push('context_morning');
    if (hour >= 13 && hour < 15) list.push('context_afternoon');
    if (hour >= 19) list.push('context_night');

    // Day-of-week context
    if (dayOfWeek === 1) list.push('context_monday', 'context_monday'); // Monday gets double
    if (dayOfWeek === 5) list.push('context_friday', 'context_friday'); // Friday gets double

    // Pre-holiday hype (within 7 days of a holiday)
    const nextHoliday = (state.get('schoolHolidayRanges') || [])
        .filter(h => new Date(h.start) >= now)
        .sort((a, b) => new Date(a.start) - new Date(b.start))[0];
    if (nextHoliday) {
        const daysToHoliday = Math.ceil((new Date(nextHoliday.start) - now) / (1000 * 60 * 60 * 24));
        if (daysToHoliday <= 7 && daysToHoliday > 0) {
            list.push('pre_holiday_hype', 'pre_holiday_hype');
        }
    }

    return shuffleDeck(filterDeckForTier(list, capabilities));
}

async function hydrateCard(type, classId, capabilities = getWallpaperCapabilities()) {
    if (!canRenderCardForTier(type, capabilities)) return null;

    const [baseType, dataId] = type.split(':');
    const baseObj = { id: type };
    let content = null;

    // Get current class info for level-aware cards
    const cls = classId ? state.get('allSchoolClasses').find(c => c.id === classId) : null;
    const questLevel = cls?.questLevel || null;

    if (baseType === 'bday') content = getBirthdayCard(dataId);
    else if (baseType === 'name') content = getNamedayCard(dataId);
    else if (baseType === 'stu_spotlight') content = getStudentSpotlightCard(dataId, questLevel);
    else if (baseType === 'stu_funfact') content = getStudentFunFactCard(dataId, classId, questLevel);
    else if (baseType === 'log') content = getSpecificLogCard(dataId);
    else if (baseType === 'top_student_monthly') content = getTopMonthlyStudentCard(classId, dataId);
    else if (baseType === 'top_student_daily') content = getTopDailyStudentCard(classId, dataId);
    else if (baseType === 'recent_award') content = getRecentAwardCard(classId, dataId);
    else {
        switch (type) {
            // --- School-wide cards ---
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

            // --- Static/generated visual cards ---
            case 'season_visual': content = getSeasonalCard(); break;
            case 'giant_clock': content = getGiantClockCard(); break;
            case 'motivation_poster': content = getMotivationCard(questLevel); break;
            case 'holiday': content = getNextHolidayCard(); break;
            case 'weather': content = getWeatherCard(); break;
            case 'class_test_luck': content = getTestLuckCard(classId, questLevel); break;
            case 'upcoming_test_countdown': content = getUpcomingTestCountdownCard(classId, questLevel); break;
            case 'pre_holiday_hype': content = getPreHolidayHypeCard(); break;

            // --- AI-generated knowledge cards ---
            case 'ai_fact_science': content = await getAIFromDB('fact_science'); break;
            case 'ai_fact_history': content = await getAIFromDB('fact_history'); break;
            case 'ai_fact_nature': content = await getAIFromDB('fact_nature'); break;
            case 'ai_fact_geography': content = await getAIFromDB('fact_geography'); break;
            case 'ai_fact_math': content = await getAIFromDB('fact_math'); break;
            case 'ai_did_you_know': content = await getAIFromDB('did_you_know'); break;
            case 'ai_joke': content = await getAIFromDB('joke'); break;
            case 'ai_riddle': content = await getAIFromDB('riddle'); break;
            case 'ai_brain_teaser': content = await getAIFromDB('brain_teaser'); break;
            case 'ai_word': content = await getAIFromDB('word'); break;
            case 'ai_idiom': content = await getAIFromDB('idiom'); break;
            case 'ai_tongue_twister': content = await getAIFromDB('tongue_twister'); break;

            // --- Hardcoded knowledge & trivia ---
            case 'this_day_history': content = getThisDayInHistoryCard(questLevel); break;
            case 'world_record': content = getWorldRecordCard(questLevel); break;
            case 'study_tip': content = getStudyTipCard(questLevel); break;
            case 'thought_experiment': content = getThoughtExperimentCard(questLevel); break;
            case 'emoji_riddle': content = getEmojiRiddleCard(questLevel); break;
            case 'math_challenge': content = getMathChallengeCard(questLevel); break;
            case 'greek_nameday_today': content = getGreekNamedayCard(); break;
            case 'orthodox_calendar': content = getOrthodoxCalendarCard(); break;

            // --- Class-specific cards ---
            case 'class_quest': content = getClassQuestCard(classId); break;
            case 'treasury_class': content = getTreasuryCard(classId); break;
            case 'streak': content = getAttendanceStreakCard(classId); break;
            case 'timekeeper': content = getTimekeeperCard(classId); break;
            case 'story_sentence': content = getStoryCard(classId, 'text'); break;
            case 'class_bounty': content = getClassBountyCard(classId); break;
            case 'next_lesson': content = getNextLessonCard(classId); break;
            case 'attendance_summary': content = getClassAttendanceCard(classId); break;
            case 'absent_heroes': content = getAbsentHeroesCard(classId); break;
            case 'mindfulness': content = getMindfulnessCard(questLevel); break;
            case 'quest_map_position': content = getQuestMapPositionCard(classId); break;
            case 'class_rank_vs_school': content = getClassRankVsSchoolCard(classId); break;
            case 'class_gold_ranking': content = getClassGoldRankingCard(classId); break;
            case 'reigning_hero_spotlight': content = getReigningHeroCard(classId); break;
            case 'lesson_milestone': content = getLessonMilestoneCard(classId); break;
            // New class cards
            case 'class_familiar_parade': content = getClassFamiliarParadeCard(classId); break;
            case 'class_familiar_hatch_watch': content = getClassFamiliarHatchWatchCard(classId); break;
            case 'class_gold_top_trio': content = getClassGoldTopTrioCard(classId); break;

            // --- Context cards ---
            case 'context_morning': content = getContextCard('morning', questLevel); break;
            case 'context_afternoon': content = getContextCard('afternoon', questLevel); break;
            case 'context_night': content = getContextCard('night', questLevel); break;
            case 'context_monday': content = getContextCard('monday', questLevel); break;
            case 'context_friday': content = getContextCard('friday', questLevel); break;
            case 'post_holiday_welcome': content = getPostHolidayWelcomeCard(); break;
            case 'class_season_snapshot': content = getClassSeasonSnapshotCard(classId); break;
            // New global cards
            case 'guild_leaderboard': content = getGuildLeaderboardCard(); break;
            case 'fun_english_phrase': content = getFunEnglishPhraseCard(questLevel); break;


            default: content = getSchoolPulseCard();
        }
    }

    if (!content) return null;
    return { ...baseObj, ...content };
}

// ─── Guild Leaderboard ────────────────────────────────────────────────────────
function getGuildLeaderboardCard() {
    const allGuildScores = state.get('allGuildScores') || {};
    const allStudents = state.get('allStudents') || [];
    const allStudentScores = state.get('allStudentScores') || [];
    const guildIds = ['dragon_flame', 'grizzly_might', 'owl_wisdom', 'phoenix_rising'];
    const guildMeta = {
        dragon_flame: { name: 'Dragon Flame', emoji: '🔥', color: '#ef4444' },
        grizzly_might: { name: 'Grizzly Might', emoji: '🐻', color: '#d97706' },
        owl_wisdom: { name: 'Owl Wisdom', emoji: '🦉', color: '#3b82f6' },
        phoenix_rising: { name: 'Phoenix Rising', emoji: '🦅', color: '#ec4899' },
    };

    const guilds = guildIds.map(gid => {
        const scoreDoc = allGuildScores[gid] || {};
        const members = allStudents.filter(s => s.guildId === gid);
        const memberCount = members.length || 1;
        const monthlyStars = members.reduce((sum, s) => {
            const sc = allStudentScores.find(sc => sc.id === s.id);
            return sum + (Number(sc?.monthlyStars) || 0);
        }, 0);
        const perCapita = Math.round((monthlyStars / memberCount) * 10) / 10;
        const meta = guildMeta[gid] || { name: gid, emoji: '⚔️', color: '#9ca3af' };
        return { gid, name: meta.name, emoji: meta.emoji, color: meta.color, monthlyStars, memberCount, perCapita };
    }).sort((a, b) => b.perCapita - a.perCapita);

    const maxPerCapita = Math.max(...guilds.map(g => g.perCapita)) || 1;
    const rankEmoji = ['🥇', '🥈', '🥉', '4️⃣'];

    const rows = guilds.map((g, i) => {
        const barWidth = Math.max(8, Math.round((g.perCapita / maxPerCapita) * 100));
        return `<div class="flex items-center gap-3 mb-2">
            <span class="text-xl w-7 text-center">${rankEmoji[i]}</span>
            <span class="text-2xl">${g.emoji}</span>
            <div class="flex-1">
                <div class="flex justify-between items-center mb-0.5">
                    <span class="font-bold text-sm" style="color:${g.color}">${g.name}</span>
                    <span class="text-xs font-bold opacity-70">${g.perCapita} ⭐/member</span>
                </div>
                <div class="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div class="h-full rounded-full" style="width:${barWidth}%;background:${g.color};"></div>
                </div>
            </div>
        </div>`;
    }).join('');

    return {
        html: `<div class="w-full px-2">
            <div class="badge-pill bg-purple-100 text-purple-800">⚔️ Guild Rankings</div>
            <p class="text-purple-600 text-xs font-bold uppercase tracking-widest mt-2 mb-4">Per-member this month</p>
            ${rows}
        </div>`,
        css: 'float-card-purple'
    };
}

// ─── Fun English Phrase ───────────────────────────────────────────────────────
function getFunEnglishPhraseCard(questLevel) {
    const tier = getLevelTier(questLevel);
    const phrases = {
        junior: [
            { phrase: 'Break a leg!', meaning: 'Good luck! (We say this to wish someone well before a performance.)' },
            { phrase: 'It\'s raining cats and dogs!', meaning: 'It\'s raining very heavily!' },
            { phrase: 'You\'re on fire!', meaning: 'You\'re doing an amazing job!' },
            { phrase: 'Hit the books!', meaning: 'Time to study!' },
            { phrase: 'Piece of cake!', meaning: 'It\'s very easy!' },
        ],
        mid: [
            { phrase: 'Bite the bullet!', meaning: 'Do something difficult or unpleasant that cannot be avoided.' },
            { phrase: 'Beat around the bush.', meaning: 'Avoid talking about something directly.' },
            { phrase: 'Kill two birds with one stone.', meaning: 'Solve two problems with one action.' },
            { phrase: 'The ball is in your court.', meaning: 'It\'s your turn to take action or make a decision.' },
            { phrase: 'Costs an arm and a leg.', meaning: 'Very expensive.' },
        ],
        senior: [
            { phrase: 'Bite off more than you can chew.', meaning: 'Take on more responsibility than you can handle.' },
            { phrase: 'Burn the midnight oil.', meaning: 'Work late into the night.' },
            { phrase: 'The devil is in the details.', meaning: 'Small details are actually the most important things.' },
            { phrase: 'A blessing in disguise.', meaning: 'Something that seems bad at first but turns out to be beneficial.' },
            { phrase: 'Cut corners.', meaning: 'Do something the easy way, but with lower quality results.' },
        ],
    };
    const pool = phrases[tier] || phrases.mid;
    const item = pool[Math.floor(Math.random() * pool.length)];
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-teal-100 text-teal-800">🗣️ English Phrase</div>
            <div class="text-6xl my-4">💬</div>
            <h3 class="font-title text-4xl text-teal-900 mb-3">"${item.phrase}"</h3>
            <p class="font-serif text-lg text-teal-700 italic leading-relaxed px-2">${item.meaning}</p>
        </div>`,
        css: 'float-card-cyan'
    };
}

// ─── Class Familiar Parade ────────────────────────────────────────────────────
function getClassFamiliarParadeCard(classId) {
    const allStudentScores = state.get('allStudentScores') || [];
    const students = state.get('allStudents').filter(s => s.classId === classId);
    if (!students.length) return null;

    const familiars = students.map(s => {
        const score = allStudentScores.find(sc => sc.id === s.id) || {};
        const familiar = score.familiar;
        if (!familiar) return null;
        const badge = familiar.state === 'egg' ? '🥚' : familiar.level >= 2 ? '✨' : '🐣';
        return `<div class="flex flex-col items-center gap-1">
            <div>${renderFamiliarSprite(familiar, 'medium', s.id)}</div>
            <span class="text-[9px] font-bold opacity-50">${badge}</span>
            <span class="text-[9px] text-center truncate max-w-[48px]">${s.name.split(' ')[0]}</span>
        </div>`;
    }).filter(Boolean);

    if (!familiars.length) return null;

    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-pink-100 text-pink-800">🐾 Class Familiars</div>
            <p class="text-pink-600 text-sm font-bold mt-2 mb-4">Meet our magical companions!</p>
            <div class="flex flex-wrap justify-center gap-3 max-h-40 overflow-hidden">
                ${familiars.slice(0, 16).join('')}
            </div>
            ${familiars.length > 16 ? `<p class="text-pink-400 text-xs mt-2">+${familiars.length - 16} more companions!</p>` : ''}
        </div>`,
        css: 'float-card-pink'
    };
}

function getClassFamiliarHatchWatchCard(classId) {
    const allStudentScores = state.get('allStudentScores') || [];
    const students = state.get('allStudents').filter(s => s.classId === classId);
    if (!students.length) return null;

    const hatchWatch = students.map((student) => {
        const score = allStudentScores.find(sc => sc.id === student.id) || {};
        const familiar = score.familiar;
        if (!familiar) return null;

        const alert = getEggAlertState(familiar, score.totalStars || 0);
        if (!alert) return null;

        const badge = alert.kind === 'ready'
            ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">READY</span>`
            : `<span class="inline-flex items-center px-2 py-0.5 rounded-full bg-fuchsia-100 text-fuchsia-700 text-[10px] font-bold">${alert.remaining} LEFT</span>`;

        return {
            remaining: alert.remaining,
            html: `<div class="flex items-center gap-3 rounded-2xl bg-white/85 border border-pink-200 px-3 py-2 shadow-sm">
                <div class="shrink-0">${renderFamiliarSprite(familiar, 'small', student.id)}</div>
                <div class="min-w-0 text-left">
                    <div class="text-xs font-bold text-slate-700 truncate">${student.name.split(' ')[0]}</div>
                    <div class="text-[10px] text-slate-500">${alert.kind === 'ready' ? 'Egg can hatch now' : `${alert.remaining} more star${alert.remaining === 1 ? '' : 's'} to hatch`}</div>
                </div>
                <div class="ml-auto shrink-0">${badge}</div>
            </div>`
        };
    }).filter(Boolean).sort((a, b) => a.remaining - b.remaining);

    if (!hatchWatch.length) return null;

    const readyCount = hatchWatch.filter(item => item.remaining === 0).length;
    const subtitle = readyCount > 0
        ? `${readyCount} egg${readyCount === 1 ? '' : 's'} can hatch right now`
        : 'Some familiars are close to hatching';

    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-pink-100 text-pink-800">🥚 Hatch Watch</div>
            <p class="text-pink-600 text-sm font-bold mt-2 mb-4">${subtitle}</p>
            <div class="grid gap-2">
                ${hatchWatch.slice(0, 5).map(item => item.html).join('')}
            </div>
            ${hatchWatch.length > 5 ? `<p class="text-pink-400 text-xs mt-2">+${hatchWatch.length - 5} more nearly-ready eggs</p>` : ''}
        </div>`,
        css: 'float-card-pink'
    };
}

// ─── Class Gold Top Trio ──────────────────────────────────────────────────────
function getClassGoldTopTrioCard(classId) {
    const allStudentScores = state.get('allStudentScores') || [];
    const students = state.get('allStudents').filter(s => s.classId === classId);
    if (!students.length) return null;

    const ranked = students.map(s => {
        const score = allStudentScores.find(sc => sc.id === s.id) || {};
        return { ...s, gold: Number(score.gold) || 0 };
    }).filter(s => s.gold > 0).sort((a, b) => b.gold - a.gold).slice(0, 3);

    if (!ranked.length) return null;

    const rankStyles = [
        { emoji: '🥇', bg: 'from-yellow-500/20 to-amber-600/20', border: 'border-yellow-500/30', color: 'text-yellow-400', size: 'text-5xl' },
        { emoji: '🥈', bg: 'from-gray-400/20 to-slate-500/20', border: 'border-gray-400/30', color: 'text-gray-300', size: 'text-4xl' },
        { emoji: '🥉', bg: 'from-orange-700/20 to-amber-800/20', border: 'border-orange-600/30', color: 'text-orange-400', size: 'text-3xl' },
    ];

    const cards = ranked.map((s, i) => {
        const style = rankStyles[i];
        const avatar = s.avatar
            ? `<img src="${s.avatar}" class="w-14 h-14 rounded-full object-cover border-2 mx-auto mb-2" style="border-color: rgba(251,191,36,0.4);">`
            : `<div class="w-14 h-14 rounded-full bg-indigo-700 flex items-center justify-center text-2xl font-bold text-white mx-auto mb-2">${s.name.charAt(0)}</div>`;
        return `<div class="flex-1 bg-gradient-to-b ${style.bg} border ${style.border} rounded-2xl p-3 text-center">
            <div class="text-2xl mb-1">${style.emoji}</div>
            ${avatar}
            <div class="font-bold text-white text-sm truncate">${s.name.split(' ')[0]}</div>
            <div class="${style.color} font-title text-lg mt-1">${s.gold.toLocaleString()} 🪙</div>
        </div>`;
    }).join('');

    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-yellow-100 text-yellow-800">💰 Wealthiest Adventurers</div>
            <p class="text-yellow-700 text-sm font-bold mt-2 mb-5">The class treasury leaders!</p>
            <div class="flex gap-3">${cards}</div>
        </div>`,
        css: 'float-card-gold'
    };
}

function getMindfulnessCard(questLevel) {

    const tier = getLevelTier(questLevel);
    const prompts = {
        junior: ['Take a big breath in... and out! 😊', 'Close your eyes and count to 5!', 'Shake your hands, take a breath, smile!'],
        mid: ['Breathe in for 4... hold for 4... out for 4.', 'Close your eyes. Think of your happy place.', 'Roll your shoulders back. Deep breath. Ready!'],
        senior: ['Box breathing: in 4, hold 4, out 4, hold 4.', 'Ground yourself: 5 things you can see right now.', 'One deep breath resets your focus. Try it.']
    };
    const opts = prompts[tier] || prompts.mid;
    const msg = opts[Math.floor(Math.random() * opts.length)];
    return {
        html: `
            <div class="text-center w-full">
                <div class="badge-pill bg-teal-100 text-teal-800">Mindfulness Moment</div>
                <div class="relative w-44 h-44 mx-auto my-6 flex items-center justify-center">
                    <div class="absolute inset-0 bg-teal-300 rounded-full opacity-30 mindfulness-pulse"></div>
                    <div class="absolute inset-4 bg-teal-400 rounded-full opacity-40 mindfulness-pulse" style="animation-delay:0.5s"></div>
                    <div class="absolute inset-8 bg-teal-500 rounded-full opacity-50 mindfulness-pulse" style="animation-delay:1s"></div>
                    <i class="fas fa-wind text-white text-5xl relative z-10"></i>
                </div>
                <h3 class="font-title text-3xl text-teal-700">${msg}</h3>
            </div>`,
        css: 'float-card-teal'
    };
}

// ─── Context Cards (level-aware) ────────────────────────────────────────────
function getContextCard(moment, questLevel) {
    const tier = getLevelTier(questLevel);
    const cards = {
        morning: {
            junior: { icon: '☀️', title: 'Good Morning!', sub: 'Ready to learn something amazing today?' },
            mid: { icon: '☀️', title: 'Good Morning!', sub: "Let's make today legendary!" },
            senior: { icon: '🌅', title: 'Rise & Shine!', sub: 'Every great day starts with a great attitude.' }
        },
        afternoon: {
            junior: { icon: '⚡', title: 'Keep Going!', sub: "You're doing great! Don't stop now!" },
            mid: { icon: '⚡', title: 'Power Hour!', sub: 'Stay focused – the finish line is near!' },
            senior: { icon: '💪', title: 'Push Through!', sub: 'Discipline now = success later.' }
        },
        night: {
            junior: { icon: '🌙', title: 'Great Job Today!', sub: 'Time to rest your super brain! 🧠' },
            mid: { icon: '🌙', title: 'Rest & Recharge', sub: 'Great work today, hero!' },
            senior: { icon: '🌠', title: 'Day Well Done', sub: 'Rest is part of the growth process.' }
        },
        monday: {
            junior: { icon: '🚀', title: 'New Week!', sub: 'New adventures are waiting for you!' },
            mid: { icon: '🚀', title: 'New Week!', sub: 'New goals. New challenges. Let\'s go!' },
            senior: { icon: '🏁', title: 'Monday Mission', sub: 'The week is your canvas. Make it count.' }
        },
        friday: {
            junior: { icon: '🎉', title: 'FRI-YAY!', sub: 'You made it through the week! Amazing!' },
            mid: { icon: '🎉', title: 'Fri-YAY!', sub: 'Finish strong – weekend is earned!' },
            senior: { icon: '🔥', title: 'End of Week Strong', sub: 'No shortcuts on Fridays. Finish with pride.' }
        }
    };
    const c = (cards[moment] || cards.morning)[tier] || (cards[moment] || cards.morning).mid;
    const cssMap = { morning: 'float-card-gold', afternoon: 'float-card-blue', night: 'float-card-indigo', monday: 'float-card-red', friday: 'float-card-purple' };
    return {
        html: `<div class="text-center"><div class="text-8xl mb-3 animate-bounce-slow">${c.icon}</div><h2 class="font-title text-5xl text-white">${c.title}</h2><p class="text-white/80 text-xl font-bold mt-2">${c.sub}</p></div>`,
        css: cssMap[moment] || 'float-card-gold'
    };
}

// ─── Enhanced Student Spotlight ──────────────────────────────────────────────
function getStudentSpotlightCard(studentId, questLevel) {
    const s = state.get('allStudents').find(x => x.id === studentId);
    if (!s) return null;
    const sc = state.get('allStudentScores').find(x => x.id === studentId);
    if (!sc) return null;

    // Calculate Rank
    const allClassStudents = state.get('allStudents').filter(x => x.classId === s.classId);
    const scored = allClassStudents.map(stu => ({ id: stu.id, stars: state.get('allStudentScores').find(x => x.id === stu.id)?.monthlyStars || 0 }))
        .sort((a, b) => b.stars - a.stars);
    const rank = scored.findIndex(x => x.id === studentId) + 1;

    const totalStars = sc.totalStars || 0;
    const monthlyStars = sc.monthlyStars || 0;
    const hero = s.hero || 'Adventurer';
    const tier = getLevelTier(questLevel);

    // Superlatives
    const superlatives = [
        'Star of the Week ⭐', 'Legendary Effort 🏆', 'Quest Master ⚔️',
        'Ancient Sage 📜', 'Fastest Thinker ⚡', 'Golden Heart 💛'
    ];
    const superL = superlatives[Math.floor(Math.random() * superlatives.length)];

    const tagline = tier === 'junior' ? 'Super Learner! 🌟' : tier === 'mid' ? 'Class Adventurer ⚔️' : 'Quest Scholar 📜';
    const avatar = s.avatar
        ? `<img src="${s.avatar}" class="w-40 h-40 rounded-full border-8 border-white shadow-xl mx-auto mb-4 object-cover">`
        : `<div class="w-40 h-40 rounded-full bg-indigo-200 flex items-center justify-center text-7xl mx-auto mb-4 border-8 border-white font-bold">${s.name.charAt(0)}</div>`;

    return {
        html: `<div class="text-center">
            <div class="badge-pill bg-purple-100 text-purple-700">Hero Spotlight</div>
            ${avatar}
            <h2 class="font-title text-5xl text-purple-900">${s.name}</h2>
            <div class="flex justify-center gap-2 mt-1">
                <span class="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-bold">${hero}</span>
                <span class="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-bold">#${rank} Rank</span>
            </div>
            <p class="text-purple-500 font-bold mt-2 text-xl">${superL}</p>
            <p class="text-purple-700 font-title text-3xl mt-2">⭐ ${monthlyStars} <span class="text-sm uppercase font-bold text-purple-400">Stars this month</span></p>
            <p class="text-purple-400 font-bold text-xs mt-1">Total Career Stars: ${totalStars}</p>
        </div>`,
        css: 'float-card-purple'
    };
}

// ─── Student Fun-Fact Card ────────────────────────────────────────────────────
function getStudentFunFactCard(studentId, classId, questLevel) {
    const s = state.get('allStudents').find(x => x.id === studentId);
    if (!s) return null;
    const sc = state.get('allStudentScores').find(x => x.id === studentId);
    const scores = state.get('allStudentScores');
    const allClassStudents = state.get('allStudents').filter(x => x.classId === classId);

    const sorted = allClassStudents.map(stu => ({ id: stu.id, stars: scores.find(sc => sc.id === stu.id)?.monthlyStars || 0 })).sort((a, b) => b.stars - a.stars);
    const rank = sorted.findIndex(x => x.id === studentId) + 1;
    const monthlyStars = sc?.monthlyStars || 0;
    const totalStars = sc?.totalStars || 0;

    const tier = getLevelTier(questLevel);
    const superlatives = [
        { condition: rank === 1, label: '🏆 #1 This Month!', sub: `Leading with ${monthlyStars} stars` },
        { condition: rank <= 3 && rank > 1, label: `🥈 Top ${rank} This Month!`, sub: `${monthlyStars} monthly stars` },
        { condition: totalStars >= 100, label: '💯 Century Club!', sub: tier === 'junior' ? 'Over 100 stars – WOW!' : `${totalStars} total stars earned` },
        { condition: monthlyStars >= 20, label: '🔥 On Fire!', sub: `${monthlyStars} stars this month!` },
        { condition: true, label: '⭐ Quest Hero', sub: `${totalStars} stars earned so far` }
    ];
    const fact = superlatives.find(x => x.condition);
    const avatar = s.avatar
        ? `<img src="${s.avatar}" class="w-32 h-32 rounded-full border-4 border-white shadow-lg mx-auto mb-3 object-cover">`
        : `<div class="w-32 h-32 rounded-full bg-amber-200 flex items-center justify-center text-6xl mx-auto mb-3 border-4 border-white font-bold">${s.name.charAt(0)}</div>`;
    return {
        html: `<div class="text-center">
            <div class="badge-pill bg-amber-100 text-amber-800">Student Stats</div>
            ${avatar}
            <h2 class="font-title text-4xl text-amber-900">${s.name}</h2>
            <p class="font-title text-3xl text-amber-600 mt-2">${fact.label}</p>
            <p class="text-amber-700 font-bold text-lg mt-1">${fact.sub}</p>
        </div>`,
        css: 'float-card-gold'
    };
}

// ─── Quest Map Position ───────────────────────────────────────────────────────
function getQuestMapPositionCard(classId) {
    const cls = state.get('allSchoolClasses').find(c => c.id === classId);
    if (!cls) return null;
    const mapZones = {
        'Junior A': { zone: 'The Starter Village', icon: '🏘️', desc: 'Every legend begins here!' },
        'Junior B': { zone: 'The Whispering Woods', icon: '🌲', desc: 'Brave explorers ahead!' },
        'A': { zone: 'The Crystal Caves', icon: '💎', desc: 'Treasures await the bold!' },
        'B': { zone: 'The Dragon Highlands', icon: '🐲', desc: 'Only the strong persist!' },
        'C': { zone: 'The Storm Peaks', icon: '⛰️', desc: 'Near the top – keep climbing!' },
        'D': { zone: 'The Sky Citadel', icon: '🏰', desc: 'Elite territory, champion!' }
    };
    const progress = getClassQuestProgressData(cls);
    const zone = getQuestMapZoneForProgressPercent(progress.pct);
    const totalStars = progress.starsDisplay;
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-emerald-100 text-emerald-800">Quest Map Position</div>
            <div class="text-7xl my-4">${zone.icon}</div>
            <h3 class="font-title text-3xl text-emerald-900">${zone.label}</h3>
            <p class="text-emerald-600 font-bold text-lg mt-1">${zone.desc}</p>
            <div class="mt-4 bg-emerald-100 rounded-xl p-3">
                <p class="text-emerald-800 font-bold">${progress.progressDisplay}% progress &nbsp;|&nbsp; Goal: ${progress.goal}</p>
                <p class="text-emerald-800 font-bold">League: ${cls.questLevel} &nbsp;|&nbsp; ${totalStars} ⭐ this month</p>
            </div>
        </div>`,
        css: 'float-card-green'
    };
}

// ─── Class Rank vs School ─────────────────────────────────────────────────────
function getClassRankVsSchoolCard(classId) {
    const classes = state.get('allSchoolClasses');
    if (classes.length < 2) return null;
    const scores = state.get('allStudentScores');
    const ranked = classes.map(c => {
        const students = state.get('allStudents').filter(s => s.classId === c.id);
        const stars = students.reduce((sum, s) => { const sc = scores.find(x => x.id === s.id); return sum + (sc?.monthlyStars || 0); }, 0);
        return { id: c.id, name: c.name, logo: c.logo, stars };
    }).sort((a, b) => b.stars - a.stars);
    const rank = ranked.findIndex(c => c.id === classId) + 1;
    if (rank === 0) return null;
    const total = ranked.length;
    const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
    const msgs = rank === 1
        ? ['You\'re in the lead! Can you hold it? 🔥', 'TOP OF THE SCHOOL! Keep it up! 🏆']
        : rank <= 3
            ? [`Almost at the top – only ${rank - 1} class${rank - 1 > 1 ? 'es' : ''} ahead!`, 'Push harder – the podium is in sight!']
            : [`${rank === total ? 'Room to grow – every point counts!' : `${total - rank} more push and you move up!`}`];
    const msg = msgs[Math.floor(Math.random() * msgs.length)];
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-blue-100 text-blue-800">School Ranking</div>
            <div class="text-8xl my-4">${rankEmoji}</div>
            <h3 class="font-title text-4xl text-blue-900">Rank ${rank} of ${total}</h3>
            <p class="text-blue-600 font-bold text-xl mt-2">${msg}</p>
            <p class="text-blue-400 font-bold text-sm mt-2">${ranked[0].logo} Leader: ${ranked[0].name} (${ranked[0].stars} ⭐)</p>
        </div>`,
        css: 'float-card-blue'
    };
}

// ─── Class Gold Ranking ───────────────────────────────────────────────────────
function getClassGoldRankingCard(classId) {
    const classes = state.get('allSchoolClasses');
    if (classes.length < 2) return null;
    const scores = state.get('allStudentScores');
    const ranked = classes.map(c => {
        const students = state.get('allStudents').filter(s => s.classId === c.id);
        const gold = students.reduce((sum, s) => { const sc = scores.find(x => x.id === s.id); return sum + (sc?.gold || 0); }, 0);
        return { id: c.id, name: c.name, logo: c.logo, gold };
    }).sort((a, b) => b.gold - a.gold);
    const myData = ranked.find(c => c.id === classId);
    const rank = ranked.findIndex(c => c.id === classId) + 1;
    if (!myData) return null;
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-amber-100 text-amber-800">Gold Treasury Rank</div>
            <div class="text-7xl my-3">💰</div>
            <h3 class="font-title text-4xl text-amber-900">#${rank} Richest Class</h3>
            <p class="font-title text-3xl text-amber-600">${myData.gold} Gold Coins</p>
            ${rank === 1 ? '<p class="text-amber-700 font-bold mt-2">👑 Wealthiest in school!</p>' : `<p class="text-amber-600 font-bold mt-2">${ranked[0].logo} ${ranked[0].name}: ${ranked[0].gold} 💰</p>`}
        </div>`,
        css: 'float-card-gold'
    };
}

// ─── Reigning Hero Spotlight ──────────────────────────────────────────────────
function getReigningHeroCard(classId) {
    const hero = state.get('reigningHero');
    if (!hero) return null;
    const logs = state.get('allAdventureLogs').filter((l) => {
        if (l.classId !== classId) return false;
        if (l.heroStudentId && hero.id) return l.heroStudentId === hero.id;
        return l.hero === hero.name;
    });
    const lastLog = logs.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))[0];
    if (!lastLog) return null;
    const avatar = hero.avatar
        ? `<img src="${hero.avatar}" class="w-36 h-36 rounded-full border-4 border-yellow-300 shadow-xl mx-auto mb-3 object-cover">`
        : `<div class="w-36 h-36 rounded-full bg-yellow-200 flex items-center justify-center text-6xl mx-auto mb-3 border-4 border-yellow-300 font-bold">${hero.name.charAt(0)}</div>`;
    const excerpt = lastLog.text ? `"${lastLog.text.slice(0, 80)}${lastLog.text.length > 80 ? '...' : ''}"` : '';
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-yellow-100 text-yellow-800">👑 Reigning Hero</div>
            ${avatar}
            <h2 class="font-title text-5xl text-yellow-900">${hero.name}</h2>
            ${excerpt ? `<p class="font-serif italic text-yellow-700 text-lg mt-2 px-2">${excerpt}</p>` : ''}
            <p class="text-yellow-600 font-bold text-sm mt-2">${lastLog.date}</p>
        </div>`,
        css: 'float-card-gold'
    };
}

// ─── Lesson Milestone ─────────────────────────────────────────────────────────
function getLessonMilestoneCard(classId) {
    const logs = state.get('allAwardLogs').filter(l => l.classId === classId);
    const dates = [...new Set(logs.map(l => l.date))].length;
    if (dates < 5) return null;
    const milestones = [5, 10, 15, 20, 25, 30, 40, 50];
    const hit = milestones.filter(m => dates >= m).pop();
    if (!hit) return null;
    const icons = { 5: '🌱', 10: '🌿', 15: '🌳', 20: '🏅', 25: '🎖️', 30: '🏆', 40: '💎', 50: '👑' };
    return {
        html: `<div class="text-center">
            <div class="badge-pill bg-cyan-100 text-cyan-800">Lesson Milestone</div>
            <div class="text-9xl my-4 animate-bounce">${icons[hit] || '🏆'}</div>
            <h3 class="font-title text-5xl text-cyan-900">${hit} Lessons Together!</h3>
            <p class="text-cyan-600 font-bold text-lg mt-2">What an adventure it's been! 🎉</p>
        </div>`,
        css: 'float-card-cyan'
    };
}

// ─── Study Tip (age-aware) ────────────────────────────────────────────────────
function getStudyTipCard(questLevel) {
    const tier = getLevelTier(questLevel);
    const tips = {
        junior: [
            '📏 Read each question TWICE before answering!',
            '✏️ If you don\'t know, draw a picture to help you think!',
            '🌟 Work slowly – slow and steady wins the race!',
            '🤫 When you\'re stuck, take a big breath and try again!',
            '👀 Check your work before you say you\'re done!'
        ],
        mid: [
            '🧠 Read the whole question before writing anything.',
            '⏰ In a test: do the easy ones first, then come back to the hard ones!',
            '📝 Underline KEY words in the question.',
            '🔁 Repeat new words out loud 3 times to remember them better.',
            '💡 Stuck? Skip it and come back – your brain keeps working!'
        ],
        senior: [
            '🎯 Active recall beats re-reading: cover the notes and quiz yourself.',
            '⏱️ The Pomodoro method: 25 min focus, 5 min break. Repeat.',
            '🗂️ Teach what you\'ve learned to someone – if you can explain it, you know it.',
            '📊 Spaced repetition: review yesterday\'s material before today\'s.',
            '🧩 Connect new knowledge to things you already know.'
        ]
    };
    const pool = tips[tier] || tips.mid;
    const tip = pool[Math.floor(Math.random() * pool.length)];
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-sky-100 text-sky-800">Study Tip</div>
            <div class="text-7xl my-4">📚</div>
            <p class="font-serif text-2xl text-sky-900 italic leading-relaxed px-2">${tip}</p>
        </div>`,
        css: 'float-card-blue'
    };
}

// ─── Thought Experiment (age-aware) ───────────────────────────────────────────
function getThoughtExperimentCard(questLevel) {
    const tier = getLevelTier(questLevel);
    const questions = {
        junior: [
            'If you could talk to any animal, which would you pick? 🐘',
            'What superpower would make school more fun? 🦸',
            'If you could fly anywhere right now, where would you go? ✈️',
            'What would you invent to help your friends? 🔧',
            'If your pet could talk, what do you think it would say? 🐶'
        ],
        mid: [
            'If you could live in any time period of history, when would it be and why?',
            'You can master any skill instantly – what do you choose?',
            'If animals could vote, which animal would win an election? 🗳️',
            'What would the world look like if everyone was kind all the time?',
            'If you could change one school rule, what would it be?'
        ],
        senior: [
            'If you had to explain colours to someone born blind, how would you do it?',
            'Would you rather be the best at something nobody cares about, or average at something everybody loves?',
            'If history could be rewritten by AI, should it be? Why or why not?',
            'If you could only keep 3 things from modern technology, what would they be?',
            'Is it ever right to break a rule? Defend your answer.'
        ]
    };
    const pool = questions[tier] || questions.mid;
    const q = pool[Math.floor(Math.random() * pool.length)];
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-violet-100 text-violet-800">Thought Experiment</div>
            <div class="text-7xl my-4">🤔</div>
            <p class="font-serif text-2xl text-violet-900 italic leading-relaxed px-2">"${q}"</p>
            <p class="text-violet-500 font-bold text-sm mt-4">(Discuss with a friend!)</p>
        </div>`,
        css: 'float-card-purple'
    };
}

// ─── World Records (age-aware) ────────────────────────────────────────────────
function getWorldRecordCard(questLevel) {
    const tier = getLevelTier(questLevel);
    const records = {
        junior: [
            { fact: 'The longest pizza ever made was 1,930 metres long! 🍕', icon: '🍕' },
            { fact: 'The tallest sandcastle was over 17 metres high – taller than a 5-floor building! 🏰', icon: '🏖️' },
            { fact: 'The fastest ever sneeze was recorded at 166 km/h! Bless you! 🤧', icon: '🤧' },
            { fact: 'The world\'s biggest lego tower used 500,000 bricks! 🧱', icon: '🧱' },
            { fact: 'A dog named Pal earned more in one movie than most actors at the time! 🐕', icon: '🎬' }
        ],
        mid: [
            { fact: 'The Olympic flame has been burning continuously since 1936 at times! 🔥', icon: '🏅' },
            { fact: 'The Eiffel Tower grows 15cm taller in summer due to heat! 🗼', icon: '🗼' },
            { fact: 'A bolt of lightning contains enough energy to toast 100,000 slices of bread! ⚡', icon: '⚡' },
            { fact: 'The world\'s deepest lake (Baikal, Russia) holds 20% of all fresh water on Earth! 🌊', icon: '💧' },
            { fact: 'The UK has the world\'s oldest working public railway – opened in 1825! 🚂', icon: '🚂' }
        ],
        senior: [
            { fact: 'Oxford University (UK) is older than the Aztec Empire by two centuries! 🎓', icon: '🏛️' },
            { fact: 'If you removed all empty space from atoms, all humans would fit in a sugar cube! ⚛️', icon: '⚛️' },
            { fact: 'The USA has the world\'s largest economy, yet ranks 27th in maths education globally. 📊', icon: '📊' },
            { fact: 'The Great Wall of China took over 1,000 years and multiple dynasties to build! 🏯', icon: '🏯' },
            { fact: 'Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid! 🌙', icon: '🌙' }
        ]
    };
    const pool = records[tier] || records.mid;
    const rec = pool[Math.floor(Math.random() * pool.length)];
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-orange-100 text-orange-800">🏅 World Record</div>
            <div class="text-8xl my-4">${rec.icon}</div>
            <p class="font-serif text-2xl text-orange-900 italic leading-relaxed px-2">${rec.fact}</p>
        </div>`,
        css: 'float-card-orange'
    };
}

// ─── This Day in History (age-aware) ──────────────────────────────────────────
function getThisDayInHistoryCard(questLevel) {
    const now = new Date();
    const mmdd = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const tier = getLevelTier(questLevel);

    const events = {
        '01-15': { icon: '✏️', junior: 'Martin Luther King Jr. was born today in 1929 – he fought for everyone to be treated the same!', mid: 'MLK Jr. born 1929 – civil rights hero who changed the USA forever.', senior: 'MLK Jr. born 1929: his "I Have a Dream" speech is one of the most important in US history.' },
        '01-25': { icon: '💡', junior: 'Thomas Edison made the first phone call today in 1915 – across the whole USA!', mid: 'First transcontinental telephone call made (1915) – NYC to San Francisco!', senior: 'First transcontinental telephone call, 1915: Alexander Graham Bell spoke to his assistant Watson across the USA.' },
        '02-12': { icon: '🔬', junior: "Charles Darwin was born today in 1809 – he discovered how animals change over a really long time!", mid: 'Darwin born 1809 – his theory of evolution changed science forever.', senior: 'Darwin born 1809 – published On the Origin of Species in 1859, revolutionising biology.' },
        '02-14': { icon: '💌', junior: "It's Valentine's Day! People have been sending love notes since the 1400s! 💝", mid: "Valentine's Day origins trace to the Middle Ages – Chaucer linked it to romantic love!", senior: "The earliest known Valentine's letter was written by Charles, Duke of Orleans, in 1415 from the Tower of London." },
        '03-06': { icon: '🌍', junior: 'Ghana became a free country today in 1957 – the first African country to win independence!', mid: 'Ghana gained independence 1957 – first sub-Saharan African country to do so.', senior: 'Ghana\'s independence 1957 sparked a wave of African decolonisation throughout the continent.' },
        '03-25': { icon: '🇬🇷', junior: "Today is Greek Independence Day! In 1821, Greece started fighting to be free!", mid: "25 March 1821: Greece began the War of Independence from the Ottoman Empire!", senior: "25 March 1821: The Greek Revolution began – after nearly 400 years of Ottoman rule, Greece reclaimed independence." },
        '04-23': { icon: '✍️', junior: 'William Shakespeare was born today in 1564 – he wrote amazing plays and stories!', mid: 'Shakespeare born 1564 – wrote 37 plays and 154 sonnets!', senior: 'Shakespeare born 1564 in Stratford-upon-Avon; his works shaped the English language itself.' },
        '05-06': { icon: '🏃', junior: 'Roger Bannister ran a mile in under 4 minutes today in 1954 – people thought it was impossible!', mid: 'Roger Bannister broke the 4-minute mile (1954) – once thought physically impossible.', senior: 'Bannister\'s 1954 sub-4-minute mile inspired a psychological breakthrough: within a year, others did it too.' },
        '07-04': { icon: '🇺🇸', junior: 'Happy 4th of July! Today in 1776, the USA declared it was a free country!', mid: 'US Independence Day 1776 – the Declaration of Independence was signed.', senior: 'US Declaration of Independence, 1776 – drafted mainly by Thomas Jefferson, it inspired revolutions worldwide.' },
        '09-05': { icon: '🌌', junior: 'Voyager 1 launched today in 1977 – it\'s now the farthest man-made object in space!', mid: 'Voyager 1 launched 1977 – it entered interstellar space in 2012!', senior: 'Voyager 1 (1977) carries a Golden Record with sounds of Earth for any extraterrestrial life.' },
        '10-12': { icon: '⛵', junior: 'Columbus sailed to America today in 1492 – he was looking for a shortcut to India!', mid: 'Columbus reached the Americas in 1492, changing world history forever.', senior: 'Columbus\'s 1492 voyage connected two worlds – but also began the era of colonialism.' },
        '11-09': { icon: '🧱', junior: 'The Berlin Wall came down today in 1989 – families were finally allowed to be together again!', mid: 'Berlin Wall fell 1989 – East and West Germany reunited after 28 years.', senior: 'The fall of the Berlin Wall (1989) symbolised the end of the Cold War era.' },
        '12-17': { icon: '✈️', junior: 'The Wright brothers flew the first airplane today in 1903 – for just 12 seconds!', mid: 'Wright Brothers\' first powered flight, 1903 – only 12 seconds, but it changed everything!', senior: 'First powered flight 1903 – just 59 years later, humans were in orbit around the Earth.' },
    };

    const entry = events[mmdd];
    if (!entry) {
        // Fallback: random pick
        const all = Object.values(events);
        const fallback = all[Math.floor(Math.random() * all.length)];
        return {
            html: `<div class="text-center w-full"><div class="badge-pill bg-rose-100 text-rose-800">This Day in History</div><div class="text-7xl my-4">${fallback.icon}</div><p class="font-serif text-2xl text-rose-900 italic leading-relaxed px-2">${fallback[tier] || fallback.mid}</p></div>`,
            css: 'float-card-red'
        };
    }
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-rose-100 text-rose-800">📅 This Day in History</div>
            <div class="text-7xl my-4">${entry.icon}</div>
            <p class="font-serif text-2xl text-rose-900 italic leading-relaxed px-2">${entry[tier] || entry.mid}</p>
        </div>`,
        css: 'float-card-red'
    };
}

// ─── Greek Orthodox Nameday ────────────────────────────────────────────────────
function getGreekNamedayCard() {
    const now = new Date();
    const mmdd = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const NAMEDAYS = {
        '01-01': ['Vassilis', 'Vassiliki'], '01-06': ['Fotis', 'Fotini'], '01-07': ['Ioannis', 'Giannis', 'Ioanna'],
        '01-17': ['Antonis', 'Antonia'], '01-18': ['Athanasios', 'Nassos', 'Nassia'],
        '02-02': ['Ypapanti'], '02-10': ['Charalampos', 'Chara'], '02-11': ['Theodora'],
        '03-04': ['Gerasimos'], '03-17': ['Alexios'], '03-25': ['Annunciation', 'Evangelia', 'Vangelis'],
        '04-23': ['Georgios', 'Giorgis', 'Georgia'], '04-25': ['Markos'],
        '05-01': ['May Day'], '05-05': ['Irene'], '05-21': ['Konstantinos', 'Eleni', 'Nikos'],
        '06-11': ['Barnabas'], '06-24': ['John the Baptist', 'Giannis'],
        '06-29': ['Petros', 'Pavlos'],
        '07-17': ['Marina'], '07-20': ['Elias', 'Elianna'], '07-22': ['Mary Magdalene'],
        '07-26': ['Paraskevi'], '07-27': ['Panteleimon'],
        '08-06': ['Sotiris', 'Sotiria'], '08-15': ['Holy Mary', 'Maria', 'Panagiotis'],
        '09-08': ['Maria', 'Nativity'], '09-14': ['Stavros', 'Stavroula'],
        '10-18': ['Loukas'], '10-26': ['Dimitrios', 'Dimitra', 'Mitsos'],
        '11-08': ['Archangels'], '11-14': ['Philippos'], '11-25': ['Aikaterini', 'Katerina'],
        '11-30': ['Andreas'],
        '12-04': ['Varvara'], '12-05': ['Savvas'], '12-06': ['Nikolaos', 'Nikos', 'Nikoleta'],
        '12-09': ['Anna'], '12-12': ['Spyridon', 'Spyros'], '12-17': ['Dionysios'],
        '12-25': ['Christmas'], '12-27': ['Stefanos', 'Stefania']
    };
    const names = NAMEDAYS[mmdd];
    if (!names || names.length === 0) return null;
    const nameList = names.join(' & ');
    return {
        html: `<div class="text-center relative">
            <div class="absolute -top-4 left-1/2 -translate-x-1/2 text-5xl animate-bounce">✨</div>
            <div class="badge-pill bg-green-100 text-green-700 mt-4">Greek Nameday</div>
            <div class="text-8xl my-4">🎈</div>
            <h2 class="font-title text-4xl text-green-900">${nameList}</h2>
            <p class="font-serif italic text-2xl text-green-600 mt-3">Happy Nameday! 🎉</p>
            <p class="text-green-500 text-sm mt-1">Today is the nameday of ${nameList}!</p>
        </div>`,
        css: 'float-card-green'
    };
}

// ─── Orthodox Calendar Card ────────────────────────────────────────────────────
function getOrthodoxCalendarCard() {
    const now = new Date();
    const mmdd = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    // Key Orthodox events/fasting periods (approximate fixed dates)
    const events = [
        { start: '11-15', end: '12-24', name: 'Nativity Fast', icon: '⛪', info: 'Fasting season before Christmas' },
        { start: '01-07', end: '01-07', name: 'After Christmas', icon: '✝️', info: 'Orthodox Christmas celebrations' },
        { start: '03-25', end: '03-25', name: 'Annunciation', icon: '🇬🇷', info: 'National & religious celebration!' },
        { start: '04-01', end: '04-15', name: 'Great Lent', icon: '🕊️', info: 'Holy Week approaching – big celebrations ahead!' },
        { start: '04-16', end: '04-22', name: 'Holy Week', icon: '🕯️', info: 'The most sacred week of the Orthodox year' },
        { start: '08-01', end: '08-14', name: 'Dormition Fast', icon: '🌸', info: 'Fasting before the feast of the Virgin Mary (Aug 15)' },
        { start: '08-15', end: '08-15', name: 'Dormition of the Theotokos', icon: '🌹', info: 'Major feast day – Best wishes to all Marias!' },
        { start: '09-14', end: '09-14', name: 'Holy Cross Day', icon: '✝️', info: 'Feast of the Exaltation of the Holy Cross' },
    ];
    const toNum = s => parseInt(s.replace('-', ''), 10);
    const todayNum = toNum(mmdd);
    const current = events.find(e => todayNum >= toNum(e.start) && todayNum <= toNum(e.end));
    if (!current) return null;
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-indigo-100 text-indigo-800">Orthodox Calendar</div>
            <div class="text-8xl my-4">${current.icon}</div>
            <h3 class="font-title text-4xl text-indigo-900">${current.name}</h3>
            <p class="text-indigo-600 font-bold text-xl mt-2">${current.info}</p>
        </div>`,
        css: 'float-card-indigo'
    };
}

// ─── Emoji Riddle ─────────────────────────────────────────────────────────────
function getEmojiRiddleCard(questLevel) {
    const tier = getLevelTier(questLevel);
    const riddles = {
        junior: [
            { q: '🐱 + 🏠 = ?', a: 'Cat House / Cathouse' },
            { q: '🌧️ + 🌈 = ?', a: 'Rainbows come after rain!' },
            { q: '🐝 + 🌸 = ?', a: 'A bee on a flower – making honey!' },
            { q: '🔑 + 🚪 = ?', a: 'Open the door!' },
            { q: '🌙 + ⭐ = ?', a: 'Night sky!' }
        ],
        mid: [
            { q: '🌍 + 🌊 + ☀️ = ?', a: 'Earth: land, sea, and sun – our planet!' },
            { q: '📚 + 🧠 = ?', a: 'Learning = Knowledge!' },
            { q: '🍎 + ⚡ + 💡 = ?', a: 'Apple + Electricity = Edison? Or iPhone!', },
            { q: '🏃 + 🏁 + 🥇 = ?', a: 'Win the race!' },
            { q: '🦁 + 👑 = ?', a: 'The Lion King!' }
        ],
        senior: [
            { q: '🧬 + 🔬 + 💊 = ?', a: 'DNA research → medicine' },
            { q: '🌍 + 🔥 + 💧 = ?', a: 'Climate change: Earth + heat + water crisis' },
            { q: '📱 + 🌐 + 👥 = ?', a: 'Social media connecting the world' },
            { q: '⚖️ + 🏛️ + 👨‍⚖️ = ?', a: 'Justice system / Democracy' },
            { q: '🚀 + 🌕 + 🇺🇸 = ?', a: 'NASA Moon landing 1969' }
        ]
    };
    const pool = riddles[tier] || riddles.mid;
    const r = pool[Math.floor(Math.random() * pool.length)];
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-pink-100 text-pink-800">Emoji Riddle</div>
            <div class="text-5xl my-6 tracking-widest">${r.q}</div>
            <div class="wallpaper-card-answer-blur mt-4 pt-4 border-t border-pink-200">
                <div class="text-xs font-bold text-pink-400 uppercase tracking-widest mb-1">Answer</div>
                <p class="text-2xl font-bold text-pink-700">${r.a}</p>
            </div>
        </div>`,
        css: 'float-card-pink',
        timedBlurAnswer: true
    };
}

// ─── Math Challenge (age-aware) ───────────────────────────────────────────────
function getMathChallengeCard(questLevel) {
    const tier = getLevelTier(questLevel);
    let q, a;
    if (tier === 'junior') {
        const n1 = Math.floor(Math.random() * 10) + 1;
        const n2 = Math.floor(Math.random() * 10) + 1;
        const ops = ['+', '-'].filter(op => op !== '-' || n1 >= n2);
        const op = ops[Math.floor(Math.random() * ops.length)];
        a = op === '+' ? n1 + n2 : n1 - n2;
        q = `${n1} ${op} ${n2} = ?`;
    } else if (tier === 'mid') {
        const n1 = Math.floor(Math.random() * 12) + 2;
        const n2 = Math.floor(Math.random() * 10) + 2;
        const ops = ['+', '×', '-'];
        const op = ops[Math.floor(Math.random() * ops.length)];
        if (op === '+') { a = n1 * 10 + n2; q = `${n1 * 10} + ${n2} = ?`; }
        else if (op === '×') { a = n1 * n2; q = `${n1} × ${n2} = ?`; }
        else { const big = n1 * 10; a = big - n2; q = `${big} − ${n2} = ?`; }
    } else {
        // Senior: percentage or fraction challenge
        const opts = [
            () => { const p = [10, 20, 25, 50][Math.floor(Math.random() * 4)]; const n = [40, 80, 120, 200][Math.floor(Math.random() * 4)]; return { q: `${p}% of ${n} = ?`, a: (p * n / 100).toString() }; },
            () => { const n = Math.floor(Math.random() * 15) + 5; return { q: `${n}² = ?`, a: (n * n).toString() }; },
            () => { const n = Math.floor(Math.random() * 9) + 2; const m = Math.floor(Math.random() * 9) + 2; return { q: `(${n} + ${m}) × ${Math.floor(Math.random() * 4) + 2} = ?`, a: ((n + m) * (Math.floor(Math.random() * 4) + 2)).toString() }; }
        ];
        const chosen = opts[Math.floor(Math.random() * opts.length)]();
        q = chosen.q; a = chosen.a;
    }
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-blue-100 text-blue-800">⚡ Math Challenge</div>
            <div class="text-7xl my-4">🔢</div>
            <p class="font-title text-5xl text-blue-900">${q}</p>
            <div class="wallpaper-card-answer-blur mt-6 pt-4 border-t border-blue-200">
                <div class="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">Answer</div>
                <p class="font-title text-5xl text-blue-600">${a}</p>
            </div>
        </div>`,
        css: 'float-card-blue',
        timedBlurAnswer: true
    };
}

// ─── Upcoming Test Countdown ───────────────────────────────────────────────────
function getUpcomingTestCountdownCard(classId, questLevel) {
    const upcoming = getUpcomingScheduledAssessment(classId);
    if (!upcoming || upcoming.dayDiff < 1) return null;
    const days = upcoming.dayDiff;
    const tier = getLevelTier(questLevel);
    const countdownTarget = upcoming.startAt || upcoming.scheduledDate || null;
    const msgs = {
        junior: [`Only ${days} days until your test! You've got this! 💪`, `${days} more sleeps until the test – keep practising! 🌟`],
        mid: [`Test in ${days} day${days > 1 ? 's' : ''}! Time to review your notes!`, `${days} day countdown to "${upcoming.testData.title}" – start preparing!`],
        senior: [`${days} day${days > 1 ? 's' : ''} until "${upcoming.testData.title}" – plan your revision now.`, `T-minus ${days}: use active recall to prepare for "${upcoming.testData.title}".`]
    };
    const pool = msgs[tier] || msgs.mid;
    const msg = pool[Math.floor(Math.random() * pool.length)];
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-amber-100 text-amber-800">⏰ Test Countdown</div>
            <div class="text-8xl my-4 animate-bounce-slow">📝</div>
            <h3 class="font-title text-5xl text-amber-900">${days} Day${days > 1 ? 's' : ''}</h3>
            ${countdownTarget ? `<p class="mt-3 text-sm font-black uppercase tracking-[0.28em] text-amber-500">${utils.formatCountdownCompact(countdownTarget, 'Today')}</p>` : ''}
            <p class="text-amber-700 font-bold text-xl mt-2">${msg}</p>
            <p class="text-amber-600 font-bold mt-2">📖 "${upcoming.testData.title}"</p>
            <p class="text-amber-500 font-bold mt-1">${upcoming.detailLabel}</p>
        </div>`,
        css: 'float-card-gold'
    };
}

// ─── Pre-Holiday Hype ─────────────────────────────────────────────────────────
function getPreHolidayHypeCard() {
    const now = new Date();
    const next = (state.get('schoolHolidayRanges') || [])
        .filter(h => new Date(h.start) > now)
        .sort((a, b) => new Date(a.start) - new Date(b.start))[0];
    if (!next) return null;
    const days = Math.ceil((new Date(next.start) - now) / (1000 * 60 * 60 * 24));
    const name = next.name || 'Holiday';
    const lname = name.toLowerCase();
    let icon = '🎉', css = 'float-card-purple';
    if (lname.includes('christmas') || lname.includes('xmas')) { icon = '🎄'; css = 'float-card-red'; }
    else if (lname.includes('easter') || lname.includes('πάσχα')) { icon = '🐣'; css = 'float-card-pink'; }
    else if (lname.includes('summer') || lname.includes('καλοκαίρι')) { icon = '🏖️'; css = 'float-card-gold'; }
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-white/80 text-purple-800">Holiday Countdown! 🎊</div>
            <div class="text-9xl my-4 animate-bounce">${icon}</div>
            <h2 class="font-title text-6xl text-white drop-shadow-md">${days} ${days === 1 ? 'Day' : 'Days'}!</h2>
            <p class="text-white/90 font-bold text-2xl mt-2">Until ${name}!</p>
            <p class="text-white/70 font-bold text-lg mt-1">${days === 1 ? 'Tomorrow is the day! 🎉' : 'The countdown is ON! 🚀'}</p>
        </div>`,
        css: css
    };
}

// ─── Updated getMotivationCard (level-aware, bigger pool) ─────────────────────
function getMotivationCard(questLevel) {
    const tier = getLevelTier(questLevel);
    const quotes = {
        junior: [
            'Every expert was once a beginner! 🌱',
            'Mistakes help you learn – try again! 💪',
            'You are braver than you think! 🦁',
            'One step at a time – you\'ve got this! 🐢',
            'Ask questions – curious minds go far! 🔍',
            'Your best is always good enough! ⭐'
        ],
        mid: [
            '"Mistakes are proof that you are trying."',
            '"The expert in anything was once a beginner."',
            '"Be curious, not judgmental." – Walt Whitman',
            '"Every day is a fresh start."',
            '"Hard work beats talent when talent doesn\'t work hard."',
            '"Success is the sum of small efforts repeated every day."',
            '"You don\'t have to be great to start, but you have to start to be great."'
        ],
        senior: [
            '"The more I read, the more I acquire, the more certain I am that I know nothing." – Voltaire',
            '"An investment in knowledge pays the best interest." – Benjamin Franklin',
            '"Education is the most powerful weapon which you can use to change the world." – Mandela',
            '"The function of education is to teach one to think intensively and to think critically." – MLK Jr.',
            '"It does not matter how slowly you go as long as you do not stop." – Confucius',
            '"Live as if you were to die tomorrow. Learn as if you were to live forever." – Gandhi',
            '"Education is a second sun for people." – Heraclitus',
            '"Knowledge is power."'
        ]
    };
    const pool = quotes[tier] || quotes.mid;
    const q = pool[Math.floor(Math.random() * pool.length)];
    return {
        html: `<div class="text-center p-4">
            <i class="fas fa-quote-left text-4xl text-white/50 mb-4 block"></i>
            <p class="font-serif text-3xl text-white italic leading-relaxed">${q}</p>
        </div>`,
        css: 'float-card-teal'
    };
}

// ─── Updated getTestLuckCard (level-aware) ────────────────────────────────────
function getTestLuckCard(classId, questLevel) {
    const test = getUpcomingScheduledAssessment(classId) || getNextAssessmentOccurrenceForToday(classId)[0] || null;
    if (!test || !test.isToday || test.phase === 'completed_today' || test.phase === 'window_passed') return null;
    const title = test.testData.title || 'The Big Exam';
    const tier = getLevelTier(questLevel);
    const msgs = {
        junior: ['You\'ve been working hard – that means you\'re ready! ⭐', 'Just do your best and you\'ll be amazing! 🌟', 'Breathe in, breathe out, and show what you know! 🍀'],
        mid: ['You\'ve prepared – now show off what you know!', 'Take a deep breath. Believe in yourself. You\'ve got this!', 'Hard work + confidence = success. Go get \'em!'],
        senior: ['Trust your preparation. Stay calm, think carefully, and execute.', 'Anxiety is just excitement without the breath – breathe, and begin.', 'You\'ve done the work. Now demonstrate it.']
    };
    const students = state.get('allStudents').filter(s => s.classId === classId);
    const todayLog = state.get('allAttendanceRecords').filter(r => r.classId === classId && r.date === utils.getTodayDateString()).map(r => r.studentId);
    const presentNames = students.filter(s => todayLog.includes(s.id)).map(s => s.name.split(' ')[0]);
    const namesList = presentNames.length > 0 ? presentNames.slice(0, 5).join(', ') + (presentNames.length > 5 ? ' & more!' : '') : 'Everyone';

    const pool = msgs[tier] || msgs.mid;
    const msg = pool[Math.floor(Math.random() * pool.length)];

    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-white/90 text-red-600 border border-red-200">⚔️ Challenge Day</div>
            <div class="text-8xl mb-4 mt-2 animate-bounce">🍀</div>
            <h2 class="font-title text-5xl text-white drop-shadow-md mb-2">Good Luck!</h2>
            <p class="text-white/90 text-xl font-bold mb-1">${namesList}</p>
            <p class="font-title text-2xl text-yellow-300" style="text-shadow:0 2px 4px rgba(0,0,0,0.5);">${title}</p>
            <p class="text-white/80 text-xl font-bold mt-3">${msg}</p>
            <p class="text-white/70 text-base font-bold mt-2">${test.statusLabel} • ${test.chipLabel}</p>
        </div>`,
        css: 'float-card-red'
    };
}

// ─── Post-Holiday Welcome Card ──────────────────────────────────────────────
function getPostHolidayWelcomeCard() {
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-sky-100 text-sky-800">Welcome Back!</div>
            <div class="text-8xl my-4 animate-bounce">🎒</div>
            <h2 class="font-title text-5xl text-sky-900">Great to see you again!</h2>
            <p class="text-sky-600 font-bold text-2xl mt-3">Welcome back to our English quest! ⚔️</p>
            <p class="text-sky-500 font-bold text-lg mt-2 italic">Ready for new adventures? 🎉</p>
        </div>`,
        css: 'float-card-blue'
    };
}

// ─── Class Season Snapshot Card ─────────────────────────────────────────────
function getClassSeasonSnapshotCard(classId) {
    const students = state.get('allStudents').filter(s => s.classId === classId);
    const scores = state.get('allStudentScores');
    const totalStars = students.reduce((sum, s) => {
        const sc = scores.find(x => x.id === s.id);
        return sum + (sc?.monthlyStars || 0);
    }, 0);
    const monthName = new Date().toLocaleString('default', { month: 'long' });
    return {
        html: `<div class="text-center w-full">
            <div class="badge-pill bg-purple-100 text-purple-800">Season Progress</div>
            <div class="text-7xl my-4">📈</div>
            <h3 class="font-title text-3xl text-purple-900">This Month: ${monthName}</h3>
            <p class="font-title text-5xl text-purple-600 mt-2">${totalStars} ⭐</p>
            <p class="text-purple-700 font-bold text-lg mt-1">Total Stars Earned by Class</p>
        </div>`,
        css: 'float-card-purple'
    };
}

// ─── Updated getAIFromDB (also handles new types) ─────────────────────────────

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
    }).sort((a, b) => b.stars - a.stars).slice(0, 3);

    const listHtml = classScores.map((c, i) =>
        `<div class="flex items-center justify-between bg-white/20 rounded-lg p-2 mb-2">
            <span class="font-bold text-white text-lg"><span class="mr-2">${i === 0 ? '🥇' : (i === 1 ? '🥈' : '🥉')}</span>${c.logo} ${c.name}</span>
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
    now.setHours(0, 0, 0, 0);
    const events = state.get('allQuestEvents')
        .map(e => ({ e, d: utils.parseFlexibleDate(e.date) }))
        .filter(({ d }) => d && d >= now)
        .sort((a, b) => a.d - b.d);

    if (events.length === 0) return null;
    const e = events[0].e;
    const dateStr = events[0].d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });

    return {
        html: `<div class="text-center"><div class="badge-pill bg-purple-100 text-purple-800">Coming Soon</div><h3 class="font-title text-4xl text-white mb-2">${e.details.title}</h3><p class="text-purple-100 text-2xl">${dateStr}</p></div>`,
        css: 'float-card-purple'
    };
}

function getGiantClockCard() {
    const now = new Date();
    return {
        html: `<div class="text-center"><h1 class="font-title text-[8rem] text-white leading-none drop-shadow-lg">${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}</h1><p class="text-white/80 text-2xl font-bold uppercase tracking-widest">${now.toLocaleDateString('en-GB', { weekday: 'long' })}</p></div>`,
        css: 'float-card-dark'
    };
}

function getSeasonalCard() {
    const m = new Date().getMonth();
    let icon = '☀️', text = 'Summer Vibes', css = 'float-card-gold';
    if (m > 8 && m < 11) { icon = '🍂'; text = 'Autumn Leaves'; css = 'float-card-orange'; }
    if (m === 11 || m < 2) { icon = '❄️'; text = 'Winter Wonder'; css = 'float-card-blue'; }
    if (m > 1 && m < 5) { icon = '🌸'; text = 'Spring Bloom'; css = 'float-card-pink'; }

    return {
        html: `<div class="text-center"><div class="text-9xl mb-4 animate-float-slow">${icon}</div><h3 class="font-title text-5xl text-gray-700">${text}</h3></div>`,
        css: css
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
    }).sort((a, b) => b.stars - a.stars);

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
        correction: { icon: 'fa-wrench', color: 'text-gray-600', css: 'float-card-white', bg: 'bg-gray-100' },
        pathfinder_map: { icon: 'fa-map', color: 'text-indigo-600', css: 'float-card-indigo', bg: 'bg-indigo-100' }
    };

    const style = reasonMap[log.reason] || { icon: 'fa-star', color: 'text-indigo-600', css: 'float-card-indigo', bg: 'bg-indigo-100' };
    const rewardText = log.reason === 'pathfinder_map'
        ? '+10 Class Quest'
        : `+${log.stars} ${log.stars === 1 ? 'Star' : 'Stars'}`;

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
            <p class="text-2xl font-bold ${style.color}">${rewardText}</p>
            <p class="text-gray-500 font-bold text-xs uppercase tracking-widest mt-2">
                ${log.reason.replace(/_/g, ' ')}
            </p>
        </div>`,
        css: style.css
    };
}

function getClassBountyCard(classId) {
    const bounty = state.get('allQuestBounties').find(b => b.classId === classId && b.status === 'active' && b.type === 'standard');
    if (!bounty) return null;

    const pct = Math.round((bounty.currentProgress / bounty.target) * 100);

    return {
        html: `<div class="text-center w-full"><div class="badge-pill bg-red-100 text-red-800">Active Bounty</div><h3 class="font-title text-2xl text-white mb-2">${bounty.title}</h3><div class="w-full bg-black/20 h-6 rounded-full overflow-hidden mb-2"><div class="bg-red-500 h-full transition-all" style="width:${pct}%"></div></div><p class="text-white font-bold">${bounty.currentProgress} / ${bounty.target} ⭐</p></div>`,
        css: 'float-card-red'
    };
}

function getNextLessonCard(classId) {
    const cls = state.get('allSchoolClasses').find(c => c.id === classId);
    if (!cls) return null;

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
    const pct = Math.round((present / students) * 100);

    return {
        html: `<div class="text-center"><div class="text-6xl mb-2">🎒</div><h3 class="font-title text-4xl text-emerald-900">${pct}% Present</h3><p class="text-emerald-600 font-bold">Heroes Assembled</p></div>`,
        css: 'float-card-green'
    };
}

function getHighScoreCard(classId, type) {
    const scores = state.get('allWrittenScores').filter(s => s.classId === classId && s.type === type);
    if (scores.length === 0) return null;

    scores.sort((a, b) => (utils.parseFlexibleDate(b.date) || 0) - (utils.parseFlexibleDate(a.date) || 0));
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

    if (item.type.includes('fact')) {
        icon = '🧠'; css = 'float-card-blue'; title = 'Did You Know?';
        if (item.type === 'fact_science') icon = '🧪';
        if (item.type === 'fact_history') icon = '📜';
        if (item.type === 'fact_nature') icon = '🌿';
        if (item.type === 'fact_geography') icon = '🌍';
        if (item.type === 'fact_math') icon = '🔢';
    }
    if (item.type === 'did_you_know') { icon = '💡'; css = 'float-card-gold'; title = 'Insight'; }
    if (item.type === 'brain_teaser') { icon = '🤯'; css = 'float-card-purple'; title = 'Brain Teaser'; }
    if (item.type === 'tongue_twister') { icon = '👅'; css = 'float-card-pink'; title = 'Tongue Twister'; }
    if (item.type === 'joke') { icon = '🤣'; css = 'float-card-orange'; title = 'Quest Joke'; }
    if (item.type === 'riddle') { icon = '🧩'; css = 'float-card-purple'; title = 'Riddle Me This'; }
    if (item.type === 'word') { icon = '📖'; css = 'float-card-pink'; title = 'Word of the Day'; }
    if (item.type === 'idiom') { icon = '💬'; css = 'float-card-green'; title = 'Phrase of the Day'; }

    let answerHtml = '';
    if (item.answer) {
        answerHtml = `
            <div class="wallpaper-card-answer-blur mt-5 pt-4 border-t border-white/30">
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
        css: css,
        timedBlurAnswer: item.answer ? true : false
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
    const sorted = holidays.filter(h => new Date(h.end) >= now).sort((a, b) => new Date(a.start) - new Date(b.start));
    const next = sorted[0];
    if (!next) return null;

    const diffDays = Math.ceil((new Date(next.start) - now) / (1000 * 60 * 60 * 24));

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
    if (classId) state.get('allStudents').filter(s => s.classId === classId).forEach(s => { const sc = scores.find(x => x.id === s.id); if (sc) total += (sc.gold !== undefined ? sc.gold : sc.totalStars); });
    else total = scores.reduce((sum, s) => sum + (s.gold !== undefined ? s.gold : s.totalStars), 0);
    return { html: `<div class="text-center"><div class="badge-pill bg-amber-100 text-amber-800">Treasury</div><div class="text-8xl mb-2 animate-bounce-slow">💰</div><h2 class="text-6xl font-title text-amber-900">${total}</h2><p class="text-amber-600 font-bold">Gold Coins</p></div>`, css: 'float-card-gold' };
}

function getClassQuestCard(classId) {
    const cls = state.get('allSchoolClasses').find(c => c.id === classId);
    if (!cls) return null;

    const students = state.get('allStudents').filter(s => s.classId === classId);
    const scores = state.get('allStudentScores') || [];

    const { totalStars: monthlyStars, classBonus: classQuestBonus } = utils.getClassMonthlyQuestStars(cls, students, scores);

    // Calculate Dynamic Goal (Sync with Home logic)
    const goal = utils.calculateMonthlyClassGoal(
        cls,
        students.length,
        state.get('schoolHolidayRanges'),
        state.get('allScheduleOverrides')
    );

    const pct = Math.min(100, Math.round((monthlyStars / goal) * 100));

    return {
        html: `<div class="text-center w-full"><div class="badge-pill bg-blue-100 text-blue-700">Quest Progress</div><div class="text-9xl mb-4 filter drop-shadow-md animate-pulse">${cls.logo}</div><div class="w-full bg-white h-8 rounded-full overflow-hidden border-2 border-blue-200 mb-2 shadow-inner"><div class="bg-gradient-to-r from-blue-400 to-indigo-500 h-full" style="width:${pct}%"></div></div><p class="font-title text-4xl text-blue-900">${pct}% Complete</p>${classQuestBonus > 0 ? `<p class="text-sm font-bold text-indigo-600 mt-2">Includes +${classQuestBonus} Pathfinder bonus</p>` : ''}</div>`,
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

    const sortedDates = Object.keys(starsByDate).sort((a, b) =>
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

function getBirthdayCard(studentId) {
    const s = state.get('allStudents').find(x => x.id === studentId);
    if (!s) return null;
    return {
        html: `<div class="text-center relative">
            <div class="absolute -top-6 -left-6 text-7xl animate-bounce">🎉</div>
            <div class="absolute -top-6 -right-6 text-7xl animate-bounce" style="animation-delay:0.5s">🎂</div>
            <div class="absolute -bottom-4 -left-8 text-4xl animate-pulse">🎊</div>
            <div class="absolute -bottom-4 -right-8 text-4xl animate-pulse">✨</div>
            <div class="badge-pill bg-pink-100 text-pink-700">Birthday Celebration!</div>
            <div class="w-40 h-40 mx-auto my-4 rounded-full bg-white flex items-center justify-center text-8xl shadow-inner border-4 border-pink-200">🥳</div>
            <h2 class="font-title text-5xl text-pink-600">Happy Birthday!</h2>
            <h3 class="font-title text-4xl text-pink-800 mt-2">${s.name}</h3>
            <p class="font-serif italic text-2xl text-pink-500 mt-4">Happy Birthday! 🎈</p>
        </div>`,
        css: 'float-card-pink'
    };
}

function getNamedayCard(studentId) { const s = state.get('allStudents').find(x => x.id === studentId); if (!s) return null; return { html: `<div class="text-center relative"><div class="absolute -top-4 left-1/2 -translate-x-1/2 text-6xl animate-pulse">✨</div><div class="inline-block bg-green-100 text-green-700 text-xs font-bold px-4 py-2 rounded-full mb-6 uppercase tracking-widest border border-green-200">Happy Nameday!</div><div class="text-8xl mb-4">🎈</div><h2 class="font-title text-5xl text-green-900 mb-2">${s.name}</h2><p class="font-serif italic text-2xl text-green-600 mt-2">Happy Nameday!</p></div>`, css: 'float-card-green' }; }

function getStoryCard(classId, mode) {
    const story = state.get('currentStoryData')[classId]; if (!story) return null;
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

function getHomeworkCard(classId) { const assignments = state.get('allQuestAssignments').filter(a => a.classId === classId); if (assignments.length === 0) return null; return { html: `<div class="text-center"><div class="badge-pill bg-amber-100 text-amber-800">Mission</div><div class="text-7xl mb-2">📜</div><div class="bg-white/80 p-6 rounded-xl border-l-4 border-amber-400 text-left shadow-sm"><p class="font-handwriting text-2xl text-amber-900">${assignments[assignments.length - 1].text}</p></div></div>`, css: 'float-card-gold' }; }

function getWeatherCard() { return { html: `<div class="text-center"><div class="badge-pill bg-sky-100 text-sky-700">Forecast</div><div class="text-8xl mb-2 animate-pulse-slow">🌤️</div><h3 class="font-title text-4xl text-sky-900">Look Outside!</h3><p class="text-sky-600 font-bold">The world is beautiful.</p></div>`, css: 'float-card-blue' }; }

function getRandomLeagueRaceCard() { return { html: `<div class="text-center"><div class="text-8xl mb-4">🏁</div><h3 class="font-title text-4xl text-gray-800">League Race</h3><p class="text-gray-600 font-bold">Who will take the lead?</p></div>`, css: 'float-card-white' }; }

function getSchoolGoldLeaderCard() {
    const classes = state.get('allSchoolClasses');
    if (classes.length === 0) return null;
    let topClass = null, maxGold = -1;
    classes.forEach(c => {
        const students = state.get('allStudents').filter(s => s.classId === c.id);
        const gold = students.reduce((sum, s) => {
            const sc = state.get('allStudentScores').find(score => score.id === s.id);
            return sum + (sc?.gold || 0);
        }, 0);
        if (gold > maxGold) { maxGold = gold; topClass = c; }
    });
    if (!topClass) return null;
    return {
        html: `<div class="text-center"><div class="badge-pill bg-amber-100 text-amber-800">Richest Realm</div><div class="text-7xl mb-2">💰</div><h3 class="font-title text-4xl text-amber-900">${topClass.name}</h3><p class="text-amber-700 text-xl font-bold">${maxGold} Gold Coins</p></div>`,
        css: 'float-card-gold'
    };
}

function getSchoolTopStudentCard() {
    const scores = state.get('allStudentScores');
    const students = state.get('allStudents');
    if (scores.length === 0) return null;

    const sorted = scores.sort((a, b) => b.totalStars - a.totalStars);
    const topScore = sorted[0];
    const student = students.find(s => s.id === topScore.id);
    if (!student) return null;

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

    if (card.timedBlurAnswer) {
        const answerBlock = el.querySelector('.wallpaper-card-answer-blur');
        if (answerBlock) {
            const tick = () => {
                const session = getSession();
                if (!session) return;
                const elapsed = Date.now() - session.start;
                if (elapsed >= BLUR_REVEAL_MS) {
                    answerBlock.style.filter = 'blur(0)';
                    return;
                }
                const blurPx = BLUR_MAX_PX * (1 - elapsed / BLUR_REVEAL_MS);
                answerBlock.style.filter = `blur(${blurPx}px)`;
            };
            tick();
            el._blurIntervalId = setInterval(tick, 1000);
        }
    }

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
    const location = utils.getActiveWeatherLocation();

    const cacheKey = utils.getWeatherCacheKey('gcq_weather_data_open_meteo', location);
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        try {
            const data = JSON.parse(cached);
            if (Date.now() - data.timestamp < 3 * 60 * 60 * 1000) {
                weatherCode = data.weather.code;
            }
        } catch (e) { }
    }

    if (weatherCode === null) {
        try {
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=weather_code&timezone=auto`);
            const d = await res.json();
            weatherCode = d.current.weather_code;
        } catch (e) { console.log("Weather fetch failed, using seasonal fallback."); }
    }

    let effectHTML = '';
    let usedRealWeather = false;

    // Helper to generate "A LOT" of clouds
    const generateHeavyClouds = (count = 15, opacity = 0.8) => {
        let clouds = '';
        for (let i = 0; i < count; i++) {
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
