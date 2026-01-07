import { db } from '../firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import * as ceremony from '../features/ceremony.js';
import * as state from '../state.js';
import * as utils from '../utils.js';
import * as tabs from '../ui/tabs.js';
import * as modals from '../ui/modals.js';
import { callGeminiApi } from '../api.js';

export { initializeHeaderQuote };

let homeInterval = null;
let renderDebounce = null;
let currentRenderedViewId = null;

// --- 1. DAILY SPICE (Cached AI) ---
async function fetchDailySpice() {
    // We fetch two DISTINCT items: one for header, one for the dashboard widget
    const [headerQuote, weatherQuote] = await Promise.all([
        getAICachedContent('quote_header'),   // Unique key for header
        getAICachedContent('quote_widget')    // Unique key for weather widget
    ]);
    
    updateHeaderQuote(headerQuote); // Update header immediately
    
    return {
        quote: weatherQuote, // Return the second quote for the widget
    };
}

function initializeHeaderQuote() {
    fetchDailySpice();
}

// --- NEW HELPER FUNCTION ---
function updateHeaderQuote(quote) {
    const container = document.getElementById('header-quote-container');
    const textEl = document.getElementById('header-quote-text');
    if (container && textEl) {
        textEl.innerText = `"${quote}"`;
        container.classList.remove('hidden');
    }
}

// --- 2. MAIN RENDER ---
export function renderHomeTab() {
    const container = document.getElementById('home-dashboard-container');
    if (!container) return;

    // Skeleton check
    if (!state.get('allSchoolClasses')) {
        container.innerHTML = getSkeleton();
        return;
    }

    if (renderDebounce) clearTimeout(renderDebounce);
    renderDebounce = setTimeout(executeRenderHome, 100);
}

async function executeRenderHome() {
    const container = document.getElementById('home-dashboard-container');
    if (!container) return;

    // --- CONTEXT ---
    const activeClassId = state.get('globalSelectedClassId');
    const teacherName = state.get('currentTeacherName') || "Quest Master";
    const hour = new Date().getHours();
    
    // Dynamic Weather/Theme
    const weatherData = await fetchWeatherData();
    let theme = {};

    // --- STEP 1: CALCULATE WEATHER STATE ---
    if (weatherData) {
        theme.temp = `${weatherData.temp}°C`;
        const code = weatherData.code;
        
        // Determine Background Class
        if (code === 0) {
            theme.weatherBg = 'w-day'; theme.weatherIcon = 'fa-sun'; theme.weatherText = 'Sunny';
        } else if (code <= 2) {
        // Codes 1 & 2: Mainly Clear / Partly Cloudy -> Keep Blue Sky (w-day)
        theme.weatherBg = 'w-day'; theme.weatherIcon = 'fa-cloud-sun'; theme.weatherText = 'Partly Cloudy';
        } else if (code === 3) {
        // Code 3: Overcast -> Gray Sky
        theme.weatherBg = 'w-cloudy'; theme.weatherIcon = 'fa-cloud'; theme.weatherText = 'Overcast';
        } else if (code <= 48) {
            theme.weatherBg = 'w-cloudy'; theme.weatherIcon = 'fa-smog'; theme.weatherText = 'Foggy';
        } else if (code <= 67 || (code >= 80 && code <= 82)) {
            theme.weatherBg = 'w-rainy'; theme.weatherIcon = 'fa-cloud-rain'; theme.weatherText = 'Rainy';
        } else if (code <= 77 || (code >= 85 && code <= 86)) {
            theme.weatherBg = 'w-snowy'; theme.weatherIcon = 'fa-snowflake'; theme.weatherText = 'Snowy';
        } else if (code >= 95) {
            theme.weatherBg = 'w-stormy'; theme.weatherIcon = 'fa-bolt'; theme.weatherText = 'Stormy';
        } else {
            theme.weatherBg = 'w-cloudy'; theme.weatherIcon = 'fa-cloud'; theme.weatherText = 'Cloudy';
        }

        // Night Override (Solar Cycle)
        const nowTime = new Date().getTime();
        const sunset = utils.solarData?.sunset || new Date().setHours(20, 0, 0, 0);
        const sunrise = utils.solarData?.sunrise || new Date().setHours(6, 0, 0, 0);
        const isNight = nowTime >= sunset || nowTime < sunrise;

        if (isNight) {
            // FIX: Only switch to generic "Night" if weather is mild (Clear or Cloudy).
            // If it is Stormy, Rainy, or Snowy, we KEEP that effect because it looks cool/dark enough.
            if (theme.weatherBg === 'w-day' || theme.weatherBg === 'w-cloudy') {
                theme.weatherBg = 'w-night';
            }

            // Adjust Icons & Text for Night Context
            if (theme.weatherIcon === 'fa-sun') theme.weatherIcon = 'fa-moon';
            if (theme.weatherIcon === 'fa-cloud-sun') theme.weatherIcon = 'fa-cloud-moon';
            if (theme.weatherText === 'Sunny') theme.weatherText = 'Clear Night';
            if (theme.weatherText === 'Partly Cloudy') theme.weatherText = 'Cloudy Night';
        }
    } else {
        // Fallback
        theme.temp = "--°C";
        theme.weatherBg = 'w-day'; theme.weatherIcon = 'fa-cloud-sun'; theme.weatherText = 'Clear';
    }

    // --- STEP 2: APPLY HEADER THEME ---
    const header = document.querySelector('header');
    if (header) {
        // 1. Clean old classes
        header.classList.remove('header-night', 'header-stormy', 'header-rainy', 'header-snowy', 'header-cloudy');
        
        // 2. Reset Background
        header.style.background = '';
        header.className = "relative overflow-hidden z-10 flex justify-between p-4 shadow-md transition-all duration-1000";
        
        // 3. Apply New State
        if (theme.weatherBg === 'w-night') {
            header.classList.add('header-night');
        } else {
            // Day Time Logic
            switch (theme.weatherBg) {
                case 'w-stormy':
                    header.classList.add('header-stormy');
                    break;
                case 'w-rainy':
                    header.classList.add('header-rainy');
                    break;
                case 'w-snowy':
                    header.classList.add('header-snowy');
                    break;
                case 'w-cloudy':
                    header.classList.add('header-cloudy');
                    break;
                default:
                    // Default Sunny/Clear Gradient
                    header.style.background = 'linear-gradient(to right, #89f7fe 0%, #66a6ff 100%)';
            }
        }
    }

    // --- STEP 3: CALCULATE TIME GRADIENTS ---
    let timeGreeting = "Good Day";
    let greetingGradient = "";
    
    if (hour >= 5 && hour < 12) {
        timeGreeting = "Good Morning";
        greetingGradient = "from-amber-400 via-orange-400 to-rose-400"; 
    } else if (hour >= 12 && hour < 17) {
        timeGreeting = "Good Afternoon";
        greetingGradient = "from-blue-400 via-cyan-400 to-teal-400"; 
    } else if (hour >= 17 && hour < 21) {
        timeGreeting = "Good Evening";
        greetingGradient = "from-indigo-500 via-purple-500 to-pink-500"; 
    } else {
        timeGreeting = "Good Night";
        greetingGradient = "from-indigo-900 via-purple-900 to-slate-800"; 
    }

    theme.greeting = timeGreeting;
    theme.greetingGradient = greetingGradient;
    theme.nameGradient = "from-slate-700 to-slate-500"; 
    
    // --- STEP 4: FETCH SPICE & RENDER ---
    const spice = await fetchDailySpice();

    const allClasses = state.get('allSchoolClasses') || [];
    let viewId = 'general';
    let contentHtml = '';

    if (activeClassId) {
        const classData = allClasses.find(c => c.id === activeClassId);
        if (classData) {
            viewId = `class_${activeClassId}`;
            contentHtml = getActiveDashboard(classData, teacherName, theme, spice);
        } else contentHtml = getGeneralDashboard(teacherName, theme, spice);
    } else {
        contentHtml = getGeneralDashboard(teacherName, theme, spice);
    }

    // DOM Update
    const isViewChange = currentRenderedViewId !== viewId;
    currentRenderedViewId = viewId;

    if (isViewChange) container.innerHTML = `<div class="home-fade w-full h-full">${contentHtml}</div>`;
    else container.innerHTML = `<div class="w-full h-full">${contentHtml}</div>`;

    attachListeners(container);
    startHomeSmartLogic();
}

// --- 3. TEMPLATES (VIBRANT HORIZONS) ---

function getSkeleton() {
    return `<div class="animate-pulse space-y-6 max-w-7xl mx-auto p-4"><div class="grid grid-cols-12 gap-6"><div class="h-48 bg-gray-200 rounded-3xl col-span-8"></div><div class="h-48 bg-gray-200 rounded-3xl col-span-4"></div></div><div class="grid grid-cols-12 gap-6"><div class="h-40 bg-gray-200 rounded-3xl col-span-4"></div><div class="h-40 bg-gray-200 rounded-3xl col-span-4"></div><div class="h-40 bg-gray-200 rounded-3xl col-span-4"></div></div></div>`;
}

function getGeneralDashboard(name, theme, spice) {
    const today = utils.getTodayDateString();
    
    const myClasses = state.get('allTeachersClasses') || [];
    const totalStudents = state.get('allStudents').length;
    const allScores = state.get('allStudentScores') || [];
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const schoolStars = state.get('allAwardLogs').reduce((sum, log) => {
        const d = utils.parseDDMMYYYY(log.date);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            return sum + log.stars;
        }
        return sum;
    }, 0);

    const totalGold = allScores.reduce((sum, s) => sum + (s.gold !== undefined ? s.gold : s.totalStars), 0);

    const tools = [
        { icon: 'fa-trophy', label: 'Hero Ranks', action: 'open-student-ranks' },
        { icon: 'fa-plus-circle', label: 'New', action: 'create-class' },
        { icon: 'fa-globe', label: 'Team History', action: 'open-team-history' },
        { icon: 'fa-umbrella-beach', label: 'Holiday', action: 'open-holidays' },
        { icon: 'fa-calendar-alt', label: 'Plan', action: 'open-day-planner' },
        { icon: 'fa-cog', label: 'Setup', action: 'open-settings' },
    ];
    
    return getLayout(
        name, theme, spice, getSelector(null),
        `
        <div class="vibrant-card h-span-6 stat-card-pop card-gradient-sun">
            <span class="text-xs font-bold text-amber-600 uppercase tracking-widest mb-2"><i class="fas fa-star mr-1"></i> School Stars</span>
            <div class="stat-value-big text-amber-500 animate-pulse">${schoolStars}</div>
            <div class="text-sm font-bold text-amber-700/60">Total Monthly</div>
        </div>
        <div class="vibrant-card h-span-3 stat-card-pop card-gradient-sky">
            <span class="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2"><i class="fas fa-users mr-1"></i> Heroes</span>
            <div class="stat-value-big text-blue-500">${totalStudents}</div>
            <div class="text-sm font-bold text-blue-700/60">Active Students</div>
        </div>
        <div class="vibrant-card h-span-3 stat-card-pop card-gradient-royal">
            <span class="text-xs font-bold text-purple-600 uppercase tracking-widest mb-2"><i class="fas fa-coins mr-1"></i> Treasury</span>
            <div class="stat-value-big text-purple-500">${totalGold}</div>
            <div class="text-sm font-bold text-purple-700/60">Gold Coins</div>
        </div>
        `,
        `
        <div class="vibrant-card h-span-4 card-glass-white">
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest p-4 pb-0">Global Tools</h3>
            <div class="tools-grid-v2">
                ${tools.map(t => `<div class="tool-btn-pop shortcut-action-btn" data-action="${t.action}"><i class="fas ${t.icon}"></i><span>${t.label}</span></div>`).join('')}
            </div>
        </div>
        <div class="vibrant-card h-span-8 card-glass-white">
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest p-4 pb-0">School Schedule</h3>
            <div class="schedule-list-v2 mt-4">
                ${getScheduleHtml(today, null)}
            </div>
        </div>
        `
    );
}

function getActiveDashboard(classData, name, theme, spice) {
    const classId = classData.id;
    const today = utils.getTodayDateString();
    
    const students = state.get('allStudents').filter(s => s.classId === classId);
    const scores = state.get('allStudentScores') || [];
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // SOURCE OF TRUTH: Sum the actual Monthly Star scores for every student in the class
    // This ensures Starfall, Story Weaver, and all bonuses are included.
    const monthlyStars = students.reduce((sum, s) => {
        const scoreData = scores.find(sc => sc.id === s.id);
        return sum + (scoreData ? (scoreData.monthlyStars || 0) : 0);
    }, 0);

    // NEW: Dynamic goal based on actual lessons, holidays, and overrides
    // NEW: Pass the full classData to match Leaderboard logic
    let goal = calculateMonthlyClassGoal(classData, students.length);
    if (goal < 18) goal = 18; // Shared safety floor
    const progress = Math.min(100, (monthlyStars / goal) * 100).toFixed(0);

    // FIX: Fetch story data directly if missing, instead of relying on the Ideas tab UI
    if (!state.get('currentStoryData')[classId]) {
        const storyRef = doc(db, `artifacts/great-class-quest/public/data/story_data`, classId);
        getDoc(storyRef).then((docSnap) => {
            if (docSnap.exists()) {
                const currentData = state.get('currentStoryData');
                currentData[classId] = docSnap.data();
                state.setCurrentStoryData(currentData);
                // Trigger a re-render to update the text immediately
                renderHomeTab();
            }
        }).catch(err => console.log("Silent story fetch error", err));
    }
    const story = state.get('currentStoryData')[classId];
    const storyText = (story && story.currentSentence) ? `"...${story.currentSentence}..."` : "The story awaits its first chapter...";
    const storyWord = (story && story.currentWord) ? story.currentWord : "Pending";

    const lastAssignment = state.get('allQuestAssignments')
        .filter(a => a.classId === classId)
        .sort((a,b) => (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0))[0];
    
    let assignmentText = lastAssignment ? lastAssignment.text : "No active homework.";

   // Append Test Info if available
    if (lastAssignment && lastAssignment.testData) {
        // Use smart parser to handle YYYY-MM-DD safely
        const tDate = utils.parseFlexibleDate(lastAssignment.testData.date);
        
        let dateDisplay = 'Upcoming';
        let badgeColor = 'bg-red-50 text-red-600 border-red-100'; // Default styling
        let icon = 'exclamation-circle';

        if (tDate) {
            // Logic to determine Today vs Tomorrow
            const checkNow = new Date();
            checkNow.setHours(0,0,0,0); // Reset time to midnight
            
            // Clone date to ensure we don't mutate original if used elsewhere
            const checkTest = new Date(tDate);
            checkTest.setHours(0,0,0,0); // Reset time to midnight
            
            // Calculate difference in Days
            const diffTime = checkTest - checkNow;
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
                // Past test - should ideally be cleared, but just in case
                dateDisplay = "Past Due";
            } else if (diffDays === 0) {
                dateDisplay = "TODAY!";
                badgeColor = "bg-red-600 text-white border-red-700 shadow-md animate-pulse"; // Urgent style
                icon = "bell";
            } else if (diffDays === 1) {
                dateDisplay = "Tomorrow";
            } else {
                dateDisplay = tDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            }
        }
        
        assignmentText = `
            <div class="flex flex-col gap-1">
                <span>${lastAssignment.text}</span>
                <span class="text-xs font-bold px-2 py-1 rounded border ${badgeColor} self-start flex items-center gap-1 mt-1">
                    <i class="fas fa-${icon}"></i> TEST: ${lastAssignment.testData.title} (${dateDisplay})
                </span>
            </div>`;
    }
    
    const logs = state.get('allAdventureLogs').filter(l => l.classId === classId).sort((a,b) => utils.parseDDMMYYYY(b.date) - utils.parseDDMMYYYY(a.date));
    const lastLogText = logs.length > 0 ? logs[0].text : "No adventures chronicled yet.";
    const lastLogDate = logs.length > 0 ? new Date(utils.parseDDMMYYYY(logs[0].date)).toLocaleDateString('en-GB', {weekday:'short', day:'numeric'}) : '';

    const rosterHtml = students.length > 0
        ? students.sort((a, b) => a.name.localeCompare(b.name)).map(s => {
             const scoreData = scores.find(sc => sc.id === s.id);
             const stars = scoreData?.monthlyStars || 0;
             const avatarHtml = s.avatar 
                ? `<img src="${s.avatar}" alt="${s.name}" class="roster-avatar enlargeable-avatar" data-student-id="${s.id}" title="${s.name} (${stars} ⭐)">`
                : `<div class="roster-avatar bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs enlargeable-avatar" data-student-id="${s.id}" title="${s.name} (${stars} ⭐)">${s.name.charAt(0)}</div>`;
             return `<div class="relative group -ml-2 first:ml-0 transition-transform hover:z-50">${avatarHtml}</div>`;
        }).join('')
        : '<span class="text-xs text-gray-400 pl-2">Empty Roster</span>';

    const classLogs = state.get('allAwardLogs').filter(l => l.classId === classId);
    const reasons = {};
    classLogs.forEach(l => { if(l.reason) reasons[l.reason] = (reasons[l.reason] || 0) + l.stars; });
    const topReasonEntry = Object.entries(reasons).sort((a,b) => b[1] - a[1])[0];
    const topSkill = topReasonEntry ? topReasonEntry[0] : null;

    const tools = [
        { icon: 'fa-clipboard-check', label: 'Roll Call', action: 'open-attendance' },
        { icon: 'fa-magic', label: 'Report', action: 'open-report', id: classId },
        { icon: 'fa-feather-alt', label: 'Story', target: 'reward-ideas-tab' },
        { icon: 'fa-scroll', label: 'Trials', target: 'scholars-scroll-tab' },
        { icon: 'fa-crosshairs', label: 'Bounty', target: 'award-stars-tab' },
        { icon: 'fa-pencil-alt', label: 'Edit', action: 'edit-class', id: classId },
    ];

    return getLayout(
        name, theme, spice, getSelector(classId),
        `
        <div class="vibrant-card h-span-8 p-6 flex flex-col justify-center relative overflow-hidden card-gradient-sky">
            <div class="absolute -right-4 -top-4 text-9xl opacity-5 pointer-events-none">${classData.logo}</div>
            <div class="flex justify-between items-end mb-3">
                <div>
                    <h3 class="font-bold text-blue-400 text-xs uppercase tracking-widest"><i class="fas fa-route mr-1"></i> Quest Progress</h3>
                    <div class="font-title text-5xl text-blue-600">${progress}%</div>
                </div>
                <div class="text-right">
                    <div class="font-title text-4xl text-amber-500">${monthlyStars} ⭐</div>
                    <p class="text-xs font-bold text-amber-600/70">Monthly Collected</p>
                </div>
            </div>
            <div class="w-full bg-white/60 h-4 rounded-full overflow-hidden border border-blue-100">
                <div class="h-full bg-gradient-to-r from-blue-400 to-indigo-500 transition-all duration-1000 relative" style="width: ${progress}%">
                    <div class="absolute top-0 left-0 w-full h-full bg-white opacity-20 animate-pulse"></div>
                </div>
            </div>
        </div>
        
        <div class="vibrant-card h-span-4 p-5 flex flex-col justify-between card-gradient-mint">
            <div>
                <h3 class="text-xs font-bold text-green-600 uppercase tracking-widest mb-1"><i class="fas fa-bolt mr-1"></i> Top Skill</h3>
                ${getTopSkillHtml(topSkill)}
            </div>
            <div class="mt-4">
                <h3 class="text-xs font-bold text-green-600 uppercase tracking-widest mb-2 flex justify-between">
                    <span>Heroes</span>
                </h3>
                <div class="flex items-center flex-wrap pl-2 gap-y-2">
                    ${rosterHtml}
                </div>
            </div>
        </div>
        `,
        `
        <div class="vibrant-card h-span-8 p-5 bg-gray-50/50 backdrop-blur-sm">
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4"><i class="fas fa-history mr-2"></i> The Chronicle</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
                <div class="chronicle-item chronicle-homework">
                    <div class="flex items-center gap-2 mb-2">
                        <div class="bg-white/80 p-1.5 rounded-lg text-indigo-600"><i class="fas fa-book"></i></div>
                        <span class="text-xs font-bold text-indigo-700 uppercase">Homework</span>
                    </div>
                    <p class="text-sm text-indigo-900 font-medium leading-snug line-clamp-3">${assignmentText}</p>
                </div>

                <div class="chronicle-item chronicle-story">
                    <div class="flex items-center gap-2 mb-2">
                        <div class="bg-white/80 p-1.5 rounded-lg text-cyan-600"><i class="fas fa-feather-alt"></i></div>
                        <span class="text-xs font-bold text-cyan-700 uppercase">Story: ${storyWord}</span>
                    </div>
                    <p class="text-sm text-cyan-900 font-serif italic leading-snug line-clamp-3">${storyText}</p>
                </div>

                <div class="chronicle-item chronicle-log">
                    <div class="flex items-center gap-2 mb-2">
                        <div class="bg-white/80 p-1.5 rounded-lg text-green-600"><i class="fas fa-compass"></i></div>
                        <span class="text-xs font-bold text-green-700 uppercase">${lastLogDate}</span>
                    </div>
                    <p class="text-sm text-green-900 font-medium leading-snug line-clamp-3">${lastLogText}</p>
                </div>
            </div>
        </div>

        <div class="vibrant-card h-span-4 card-glass-white">
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest p-4 pb-0">Class Actions</h3>
            <div class="grid grid-cols-3 gap-3 p-4 pt-3">
                ${tools.map(t => {
                    const attr = t.target ? `data-target="${t.target}" class="tool-btn-pop shortcut-tab-btn"` : `data-action="${t.action}" data-id="${t.id || ''}" class="tool-btn-pop shortcut-action-btn"`;
                    return `<div ${attr} style="aspect-ratio: 1/0.8"><i class="fas ${t.icon} text-xl mb-1"></i><span style="font-size: 0.65rem">${t.label}</span></div>`;
                }).join('')}
            </div>
        </div>
        `
    );
}

function getLayout(name, theme, spice, selector, row2, row3) {
    return `
    <div class="w-full max-w-7xl mx-auto p-4">
        <div class="horizons-grid">
            
            <div class="vibrant-card h-span-8 greeting-panel">
                <div class="greeting-bg-mesh"></div>
                <div class="relative z-10 flex flex-col justify-between h-full">
                    
                    <div class="flex justify-between items-start mb-2 gap-4 min-h-[44px]">
                        <div id="home-reminders-container" class="flex flex-wrap items-center gap-3 py-1">
                            ${getReminderPills(state.get('globalSelectedClassId'))}
                        </div>
                        <div class="flex-shrink-0 relative z-50">
                            ${selector}
                        </div>
                    </div>

                    <div>
                        <h1 class="font-title text-4xl md:text-6xl text-slate-800 drop-shadow-sm mb-2">
                            <span class="text-transparent bg-clip-text bg-gradient-to-r ${theme.greetingGradient}">${theme.greeting}</span>, 
                            <span class="text-transparent bg-clip-text bg-gradient-to-r ${theme.nameGradient} whitespace-nowrap">${name}</span>!
                        </h1>
                        <p class="text-gray-500 font-semibold text-lg">Prodigies Language School</p>
                    </div>
                </div>
            </div>

            <div class="vibrant-card h-span-4 weather-card ${theme.weatherBg}">
                <i class="fas ${theme.weatherIcon} weather-sun"></i>
                <i class="fas fa-cloud weather-cloud"></i>
                
                <div class="relative z-10">
                    <div class="text-6xl font-title drop-shadow-md mb-2">${theme.temp}</div>
                    <div class="text-xl font-bold uppercase tracking-widest opacity-90">${theme.weatherText}</div>
                </div>
                <div class="relative z-10 text-right mt-auto pt-4">
                    <div class="text-xs font-bold opacity-75 uppercase mb-1">Daily Wisdom</div>
                    <div class="text-sm font-medium leading-tight font-serif italic">"${spice.quote}"</div>
                </div>
            </div>

            ${row2}
            ${row3}

        </div>
    </div>`;
}

// --- HELPERS ---

function getSelector(currentId) {
    const classes = state.get('allTeachersClasses').sort((a,b) => a.name.localeCompare(b.name));
    
    let currentSelectionText = '🏫 General View';
    if (currentId) {
        const selectedClass = classes.find(c => c.id === currentId);
        if (selectedClass) {
            currentSelectionText = `${selectedClass.logo} ${selectedClass.name}`;
        }
    }

    return `
        <div class="relative z-50">
            <button id="home-class-selector-btn" class="flex items-center justify-between w-64 px-4 py-3 rounded-2xl bg-white shadow-lg border-2 border-indigo-100 hover:border-indigo-300 hover:scale-105 transition-all duration-200 group">
                <span class="font-bold text-indigo-900 text-sm truncate pr-2 group-hover:text-indigo-600 transition-colors">${currentSelectionText}</span>
                <i class="fas fa-chevron-down text-indigo-400 bg-indigo-50 p-1.5 rounded-full text-xs group-hover:bg-indigo-100 transition-colors"></i>
            </button>
            
            <div id="home-class-selector-panel" class="absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl z-50 hidden overflow-hidden border-2 border-indigo-50 ring-4 ring-indigo-50/50 transform transition-all origin-top-right">
                <div class="max-h-80 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    <div class="home-class-item p-3 flex items-center gap-3 hover:bg-indigo-50 rounded-xl cursor-pointer transition-colors" data-id="">
                        <span class="text-2xl w-10 text-center bg-indigo-100 rounded-lg py-1">🏫</span>
                        <span class="font-bold text-indigo-800 text-sm">General View</span>
                    </div>
                    ${classes.map(c => `
                        <div class="home-class-item flex items-center gap-3 p-3 hover:bg-indigo-50 rounded-xl cursor-pointer transition-colors" data-id="${c.id}">
                            <span class="text-2xl w-10 text-center bg-white border border-gray-100 rounded-lg py-1 shadow-sm">${c.logo}</span>
                            <span class="font-bold text-gray-700 text-sm">${c.name}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function getScheduleHtml(dateString, activeClassId) {
    const allSchoolClasses = state.get('allSchoolClasses') || [];
    const allScheduleOverrides = state.get('allScheduleOverrides') || [];
    const myClasses = state.get('allTeachersClasses') || [];
    const myClassIds = myClasses.map(c => c.id);
    
    const todaysClasses = utils.getClassesOnDay(dateString, allSchoolClasses, allScheduleOverrides);

    if (todaysClasses.length === 0) {
        const dayOfWeek = new Date().getDay(); // 0 = Sunday, 6 = Saturday
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        const title = isWeekend ? "Weekend Break" : "Heroes' Camp";
        const message = isWeekend 
            ? "Enjoy your weekend! Recharge your mana for next week." 
            : "No lessons today. The party is resting!";
        const icon = isWeekend ? "🏖️" : "⛺";

        return `
        <div class="schedule-empty-camp" style="min-height: 325px;">
            <div class="text-7xl mb-4 animate-bounce-slow filter drop-shadow-sm">${icon}</div>
            <h4 class="font-title text-3xl text-emerald-800 mb-2">${title}</h4>
            <p class="text-base text-emerald-600 font-bold opacity-80">${message}</p>
        </div>`;
    }

    const gradients = [
        "bg-gradient-to-br from-red-100 to-red-200", "bg-gradient-to-br from-orange-100 to-orange-200",
        "bg-gradient-to-br from-amber-100 to-amber-200", "bg-gradient-to-br from-green-100 to-green-200",
        "bg-gradient-to-br from-emerald-100 to-emerald-200", "bg-gradient-to-br from-teal-100 to-teal-200",
        "bg-gradient-to-br from-cyan-100 to-cyan-200", "bg-gradient-to-br from-sky-100 to-sky-200",
        "bg-gradient-to-br from-blue-100 to-blue-200", "bg-gradient-to-br from-indigo-100 to-indigo-200",
        "bg-gradient-to-br from-violet-100 to-violet-200", "bg-gradient-to-br from-purple-100 to-purple-200",
        "bg-gradient-to-br from-fuchsia-100 to-fuchsia-200", "bg-gradient-to-br from-pink-100 to-pink-200",
        "bg-gradient-to-br from-rose-100 to-rose-200"
    ];

    return todaysClasses.map(c => {
        const isMine = myClassIds.includes(c.id);
        const timeStr = (c.timeStart) ? `${c.timeStart}` : 'TBD';
        const isActive = c.id === activeClassId;
        const league = c.questLevel || 'Quest';
        const teacherName = c.createdBy?.name || 'Unknown';
        const colorIndex = utils.simpleHashCode(c.id) % gradients.length;
        const bgGradient = gradients[colorIndex];

        let cardClass = `schedule-card-square ${bgGradient}`;
        if (isActive) cardClass += ' active-lesson';
        if (!isMine) cardClass += ' locked';
        
        const interactionAttr = isMine 
            ? `class="${cardClass} quick-class-select-btn" data-id="${c.id}"` 
            : `class="${cardClass}"`;

        const lockIcon = !isMine ? '<div class="absolute top-2 right-2 text-gray-400/30 text-xs"><i class="fas fa-lock"></i></div>' : '';

        return `
        <div ${interactionAttr} title="${c.name} • ${teacherName}">
            ${lockIcon}
            <div class="time-pill">${timeStr}</div>
            <div class="logo">${c.logo}</div>
            <div class="info-stack">
                <div class="name">${c.name}</div>
                <div class="league">${league}</div>
                <div class="teacher">${teacherName}</div>
            </div>
        </div>`;
    }).join('');
}

function attachListeners(container) {
    const selectorBtn = document.getElementById('home-class-selector-btn');
    const selectorPanel = document.getElementById('home-class-selector-panel');
    if (selectorBtn && selectorPanel) {
        selectorBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = selectorPanel.classList.contains('hidden');
            if (isHidden) {
                selectorPanel.classList.remove('hidden');
                setTimeout(() => selectorPanel.style.transform = 'scale(1)', 10);
            } else {
                selectorPanel.style.transform = 'scale(0.95)';
                setTimeout(() => selectorPanel.classList.add('hidden'), 200);
            }
        });
        selectorPanel.addEventListener('click', (e) => {
            e.stopPropagation(); 
            const item = e.target.closest('.home-class-item');
            if (item) {
                state.setGlobalSelectedClass(item.dataset.id || null, true);
                renderHomeTab();
                selectorPanel.classList.add('hidden');
            }
        });
        document.addEventListener('click', (e) => {
            if (!selectorBtn.contains(e.target) && !selectorPanel.contains(e.target)) {
                 selectorPanel.classList.add('hidden');
            }
        }, { once: true });
    }

    container.querySelectorAll('.chronicle-item').forEach(item => {
        item.addEventListener('click', (e) => {
            container.querySelectorAll('.chronicle-item.expanded').forEach(expandedItem => {
                if (expandedItem !== item) expandedItem.classList.remove('expanded');
            });
            item.classList.toggle('expanded');
        });
    });

    container.querySelectorAll('.quick-class-select-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); 
            state.setGlobalSelectedClass(btn.dataset.id, true);
            renderHomeTab();
        });
    });
    container.querySelectorAll('.shortcut-tab-btn').forEach(btn => btn.addEventListener('click', () => tabs.showTab(btn.dataset.target)));
    container.querySelectorAll('.shortcut-action-btn').forEach(btn => btn.addEventListener('click', () => handleAction(btn.dataset.action, btn.dataset)));
}

function handleAction(action, data) {
    if (action === 'open-day-planner') modals.openDayPlannerModal(utils.getTodayDateString(), document.body);
    else if (action === 'open-attendance') {
        const id = state.get('globalSelectedClassId');
        if(id) modals.openAttendanceChronicle(); else tabs.showTab('adventure-log-tab');
    }
    else if (action === 'open-team-history') modals.openHistoryModal('team'); 
    else if (action === 'open-settings' || action === 'open-holidays') tabs.showTab('options-tab');
    else if (action === 'open-student-ranks') modals.openStudentRankingsModal(); 
    else if (action === 'create-class') tabs.showTab('my-classes-tab'); 
    else if (action === 'edit-class') modals.openEditClassModal(data.id);
    else if (action === 'open-report') modals.handleGenerateReport(data.id);
}

function startHomeSmartLogic() {
    if (homeInterval) clearInterval(homeInterval);
    homeInterval = setInterval(() => {
        const tab = document.querySelector('.app-tab:not(.hidden)');
        if (tab && tab.id !== 'about-tab') return;
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);
        const todayStr = utils.getTodayDateString();
        
        const todaysClasses = utils.getClassesOnDay(todayStr, state.get('allSchoolClasses'), state.get('allScheduleOverrides'));
        const myClasses = state.get('allTeachersClasses');
        const myTodaysClasses = todaysClasses.filter(c => myClasses.some(mc => mc.id === c.id));

        const currentActiveLesson = myTodaysClasses.find(c => c.timeStart && c.timeEnd && currentTime >= c.timeStart && currentTime <= c.timeEnd);

        if (currentActiveLesson) {
            const currentSelectedId = state.get('globalSelectedClassId');
            if (currentSelectedId !== currentActiveLesson.id) {
                state.setGlobalSelectedClass(currentActiveLesson.id, false); 
                renderHomeTab();
            }
        }
    }, 60000);
}

export function setupHomeListeners() {
    const infoBtn = document.getElementById('app-info-btn');
    if(infoBtn) {
        const newBtn = infoBtn.cloneNode(true);
        infoBtn.parentNode.replaceChild(newBtn, infoBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            modals.openAppInfoModal();
        });
    }

    const closeBtn = document.getElementById('app-info-close-btn');
    if(closeBtn) {
        const newClose = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newClose, closeBtn);
        newClose.addEventListener('click', () => modals.hideModal('app-info-modal'));
    }

    const sBtn = document.getElementById('info-btn-students');
    const tBtn = document.getElementById('info-btn-teachers');
    const sContent = document.getElementById('info-content-students');
    const tContent = document.getElementById('info-content-teachers');

    if (sBtn && tBtn) {
        const newS = sBtn.cloneNode(true); sBtn.parentNode.replaceChild(newS, sBtn);
        const newT = tBtn.cloneNode(true); tBtn.parentNode.replaceChild(newT, tBtn);

        newS.addEventListener('click', () => {
            newS.classList.add('bg-cyan-500', 'text-white', 'shadow-md'); newS.classList.remove('bg-white', 'text-green-700');
            newT.classList.remove('bg-green-500', 'text-white', 'shadow-md'); newT.classList.add('bg-white', 'text-green-700');
            sContent.classList.remove('hidden'); tContent.classList.add('hidden');
        });
        newT.addEventListener('click', () => {
            newT.classList.add('bg-green-500', 'text-white', 'shadow-md'); newT.classList.remove('bg-white', 'text-green-700');
            newS.classList.remove('bg-cyan-500', 'text-white', 'shadow-md'); newS.classList.add('bg-white', 'text-cyan-700');
            tContent.classList.remove('hidden'); sContent.classList.add('hidden');
        });
    }
}

function getReminderPills(classId) {
    const now = new Date();
    now.setHours(0, 0, 0, 0); 
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999); 

    let pills = [];

    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todaySuffix = `-${mm}-${dd}`;

    // 1. STUDENT BIRTHDAYS & NAMEDAYS
    let relevantStudents = state.get('allStudents');
    if (classId) {
        relevantStudents = relevantStudents.filter(s => s.classId === classId);
    } else {
        const myClassIds = state.get('allTeachersClasses').map(c => c.id);
        relevantStudents = relevantStudents.filter(s => myClassIds.includes(s.classId));
    }

    relevantStudents.forEach(s => {
        if (s.birthday && s.birthday.endsWith(todaySuffix)) {
            pills.push(`
                <div class="date-pill bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg flex items-center gap-2 px-4 py-2 rounded-full transform hover:scale-110 transition-all duration-300 animate-bounce cursor-default border-2 border-white/50">
                    <span class="text-xl">🎂</span>
                    <span class="font-bold text-shadow-sm">Happy Birthday, ${s.name.split(' ')[0]}!</span>
                </div>
            `);
        }
        if (s.nameday && s.nameday.endsWith(todaySuffix)) {
            pills.push(`
                <div class="date-pill bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg flex items-center gap-2 px-4 py-2 rounded-full transform hover:scale-110 transition-all duration-300 cursor-default border-2 border-white/50">
                    <span class="text-xl">🎈</span>
                    <span class="font-bold text-shadow-sm">${s.name.split(' ')[0]}'s Nameday!</span>
                </div>
            `);
        }
    });

    // 2. CEREMONY REMINDER (Restored)
    if (classId) {
        const cls = state.get('allSchoolClasses').find(c => c.id === classId);
        if (cls) {
            let prevMonth = now.getMonth() - 1;
            let prevYear = now.getFullYear();
            if (prevMonth < 0) { prevMonth = 11; prevYear -= 1; }
            const monthKey = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;
            
            const isDone = cls.ceremonyHistory && cls.ceremonyHistory[monthKey] && cls.ceremonyHistory[monthKey].complete;
            
            if (!isDone) {
                const monthName = new Date(monthKey + "-02").toLocaleString('en-GB', { month: 'long' });
                pills.push(`
                    <button id="trigger-ceremony-btn" class="date-pill bg-gradient-to-r from-indigo-600 to-purple-600 text-white border border-indigo-400 shadow-lg animate-pulse flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer hover:scale-105 transition-transform" data-class-id="${classId}">
                        <i class="fas fa-trophy text-yellow-300"></i>
                        <span class="font-bold">${monthName} Ceremony!</span>
                    </button>
                `);
                
                setTimeout(() => {
                    const btn = document.getElementById('trigger-ceremony-btn');
                    if (btn) {
                        btn.onclick = (e) => {
                            e.stopPropagation();
                            import('./ceremony.js').then(m => {
                                m.checkAndInitCeremony(classId).then(params => {
                                    if(params) m.startCeremony(params);
                                });
                            });
                        };
                    }
                }, 100);
            }
        }
    }

    // 3. UPCOMING HOLIDAYS (Restored)
    const holidays = state.get('schoolHolidayRanges') || [];
    const upcomingHoliday = holidays.find(h => {
        const startDate = new Date(h.start);
        return startDate >= now && startDate <= endOfMonth;
    });

    if (upcomingHoliday) {
        const startDate = new Date(upcomingHoliday.start);
        const diffTime = startDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        
        let label = upcomingHoliday.name;
        let icon = 'fa-umbrella-beach';
        let style = 'bg-pink-50 text-pink-700 border-pink-200 shadow-sm';
        let timeText = diffDays === 0 ? "Starts Today!" : (diffDays === 1 ? "Starts Tomorrow!" : `in ${diffDays} days`);

        if (label.toLowerCase().includes('christmas') || label.toLowerCase().includes('winter')) {
            icon = 'fa-snowflake'; 
            style = 'bg-red-50 text-red-800 border-red-200 shadow-sm';
            label = `🎄 ${label}`; 
        } else if (label.toLowerCase().includes('easter')) {
            icon = 'fa-egg';
            style = 'bg-green-50 text-green-800 border-green-200 shadow-sm';
            label = `🐰 ${label}`; // Added Bunny Emoji here!
        }

        pills.push(`
            <div class="date-pill ${style} border flex items-center gap-2 px-4 py-2 rounded-full transition-transform hover:scale-105 cursor-default">
                <i class="fas ${icon}"></i> 
                <span class="font-bold">${label}</span> 
                <span class="bg-white/60 px-2 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wide ml-1">${timeText}</span>
            </div>
        `);
    }

   // 4. QUEST EVENTS (Test/Vocab/etc) - FIXED & BEAUTIFIED
    const events = state.get('allQuestEvents') || [];
    
    // Ταξινομούμε τα events ώστε τα σημερινά να εμφανίζονται πάντα πρώτα
    const sortedEvents = [...events].sort((a, b) => utils.parseDDMMYYYY(a.date) - utils.parseDDMMYYYY(b.date));

    sortedEvents.forEach(e => {
        const eventDate = utils.parseDDMMYYYY(e.date);
        
        // Φιλτράρουμε ώστε να δείχνουμε μόνο από σήμερα και μετά, μέχρι το τέλος του μήνα
        if (eventDate < now || eventDate > endOfMonth) return;

        const diffTime = eventDate - now;
        // Χρησιμοποιούμε round για να αποφύγουμε μικρολάθη στα milliseconds
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        const timeText = diffDays === 0 ? "Today!" : (diffDays === 1 ? "Tomorrow!" : `in ${diffDays} days`);
        
        const title = e.details.title || e.type;
        const isDoubleStar = title.toLowerCase().includes('2x star');
        
        // Ορίζουμε το στυλ: Αν είναι 2x Star Day, βάζουμε χρυσό gradient και animation
        let pillStyle = "bg-purple-50 text-purple-700 border-purple-200";
        let icon = "fa-magic";
        let specialClass = "";

        if (isDoubleStar) {
            pillStyle = "bg-gradient-to-r from-amber-400 via-orange-500 to-yellow-400 text-white border-white shadow-[0_0_20px_rgba(251,191,36,0.6)]";
            icon = "fa-bolt-lightning";
            specialClass = "animate-bounce-slow star-day-glow";
        }

        pills.push(`
            <div class="date-pill ${pillStyle} ${specialClass} border-2 flex items-center gap-2 px-4 py-2 rounded-full transition-all hover:scale-110 cursor-default">
                <i class="fas ${icon} ${isDoubleStar ? 'animate-pulse' : ''}"></i>
                <span class="font-bold tracking-tight">${title}</span>
                <span class="bg-white/30 backdrop-blur-sm px-2 py-0.5 rounded-full text-[10px] font-black uppercase ml-1">${timeText}</span>
            </div>
        `);
    });

    // 5. ACTIVE BOUNTY / TIMER (Corrected Logic)
    if (classId) {
        const activeTimer = state.get('allQuestBounties').find(b => b.classId === classId && b.status === 'active' && b.type === 'timer');
        const activeBounty = state.get('allQuestBounties').find(b => b.classId === classId && b.status === 'active' && b.type === 'standard');

        if (activeTimer) {
             // Just show the Title and Icon (No minutes)
             pills.push(`
                <div class="date-pill bg-red-50 text-red-700 border border-red-200 shadow-sm animate-pulse flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer" onclick="document.getElementById('bounty-board-container').scrollIntoView({behavior: 'smooth'})">
                    <i class="fas fa-hourglass-half"></i>
                    <span class="font-bold">${activeTimer.title}</span>
                </div>
             `);
        }
            
        else if (activeBounty) {
             pills.push(`
                <div class="date-pill bg-amber-50 text-amber-700 border border-amber-200 shadow-sm flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer" onclick="document.getElementById('bounty-board-container').scrollIntoView({behavior: 'smooth'})">
                    <i class="fas fa-bullseye"></i>
                    <span class="font-bold">Active Bounty</span>
                </div>
             `);
        }
    }

    // Hero of the Day Pill
const reigningHero = state.get('reigningHero');
if (reigningHero && classId) {
    const avatarHtml = reigningHero.avatar 
        ? `<img src="${reigningHero.avatar}" class="w-6 h-6 rounded-full border border-white shadow-sm">`
        : `<span class="bg-indigo-400 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold">${reigningHero.name.charAt(0)}</span>`;
    
    pills.push(`
        <div class="date-pill bg-gradient-to-r from-indigo-600 to-blue-700 text-white shadow-lg flex items-center gap-2 px-4 py-2 rounded-full transform hover:scale-105 transition-all border-2 border-indigo-400">
            ${avatarHtml}
            <div class="flex flex-col leading-none">
                <span class="text-[10px] uppercase font-black tracking-tighter opacity-80">Reigning Hero</span>
                <span class="font-bold text-shadow-sm">${reigningHero.name.split(' ')[0]}</span>
            </div>
            <div class="flex gap-1 ml-1">
                <i class="fas fa-shield-alt text-xs text-indigo-300" title="Hero's Boon (+1 Star)"></i>
                <i class="fas fa-tags text-xs text-indigo-300" title="Merchant's Favorite (-2 Gold)"></i>
            </div>
        </div>
    `);
}
    
    if (pills.length === 0) return '';
    return pills.join('');
}

// --- NEW: Database-backed Shared Caching ---
async function getAICachedContent(type) {
    const todayKey = new Date().toISOString().split('T')[0];
    const docId = `daily_content_${todayKey}_${type}`;
    
    // 1. Check Firebase First (Shared Cache)
    try {
        const docRef = doc(db, "artifacts/great-class-quest/public/data/daily_cache", docId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return docSnap.data().content;
        }
    } catch (e) {
        console.warn("Cache fetch skipped, trying generation.");
    }

    // 2. Generate if not found
    try {
        let systemPrompt = "You are a wise sage for a classroom. Generate a short, inspiring quote (max 10 words). No markdown. Just the text.";
        let userPrompt = "Generate a quote.";

        if (type === 'quote_header') {
            userPrompt = "Generate a short quote about new beginnings or focus.";
        } else if (type === 'quote_widget') {
            userPrompt = "Generate a short quote about curiosity or nature.";
        }
        
        const content = await callGeminiApi(systemPrompt, userPrompt);
        
        // 3. Save to Firebase (So others don't have to generate)
        try {
            const { setDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
            await setDoc(doc(db, "artifacts/great-class-quest/public/data/daily_cache", docId), {
                content: content,
                date: todayKey,
                type: type
            });
        } catch (e) { console.error("Failed to save to cache", e); }

        return content;
    } catch (e) {
        console.error(e);
        return "The adventure begins with a single step.";
    }
}

async function fetchWeatherData() {
    const storageKey = 'gcq_weather_data_open_meteo';
    const now = Date.now();
    
    const cached = localStorage.getItem(storageKey);
    if (cached) {
        try {
            const data = JSON.parse(cached);
            if (now - data.timestamp < 3600000) {
                return data.weather;
            }
        } catch(e) { localStorage.removeItem(storageKey); }
    }

    try {
        const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=37.9667&longitude=23.6667&current=temperature_2m,weather_code&timezone=auto');
        if (!response.ok) throw new Error('Weather API failed');
        const data = await response.json();
        
        const weather = {
            temp: Math.round(data.current.temperature_2m),
            code: data.current.weather_code
        };

        localStorage.setItem(storageKey, JSON.stringify({ timestamp: now, weather }));
        return weather;
    } catch (e) {
        console.error("Open-Meteo fetch failed:", e);
        return null; 
    }
}

/**
 * SOURCE OF TRUTH: This function implements the EXACT math from the Team Quest (tabs.js).
 * It uses a monthly modifier based on holidays rather than counting lessons.
 */
function calculateMonthlyClassGoal(classData, studentCount) {
    if (studentCount === 0) return 18;

    const BASE_GOAL = 18; 
    const SCALING_FACTOR = 2.5; 
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // 1. Calculate Holiday Days Lost (Exact Leaderboard logic)
    let holidayDaysLost = 0;
    const ranges = state.get('schoolHolidayRanges') || [];
    
    ranges.forEach(range => {
        const start = new Date(range.start);
        const end = new Date(range.end);
        const monthStart = new Date(currentYear, currentMonth, 1);
        const monthEnd = new Date(currentYear, currentMonth + 1, 0);
        const overlapStart = start > monthStart ? start : monthStart;
        const overlapEnd = end < monthEnd ? end : monthEnd;
        if (overlapStart <= overlapEnd) {
            const diffTime = Math.abs(overlapEnd - overlapStart);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            holidayDaysLost += diffDays;
        }
    });

    // 2. Apply Month Modifier (Exact Leaderboard logic)
    let monthModifier = (daysInMonth - holidayDaysLost) / daysInMonth;
    if (currentMonth === 5) { // June
        monthModifier = 0.5;
    } else {
        monthModifier = Math.max(0.6, Math.min(1.0, monthModifier));
    }

    // 3. Handle Difficulty & Completion (Exact Leaderboard logic)
    let isCompletedThisMonth = false;
    if (classData.questCompletedAt) {
        const completedDate = classData.questCompletedAt.toDate();
        if (completedDate.getMonth() === currentMonth && completedDate.getFullYear() === currentYear) {
            isCompletedThisMonth = true;
        }
    }
    const dbDifficulty = classData.difficultyLevel || 0;
    const effectiveDifficulty = isCompletedThisMonth ? Math.max(0, dbDifficulty - 1) : dbDifficulty;

    // 4. Final Calculation
    const adjustedGoalPerStudent = (BASE_GOAL + (effectiveDifficulty * SCALING_FACTOR)) * monthModifier;
    return Math.round(studentCount * adjustedGoalPerStudent);
}

function getTopSkillHtml(skill) {
    if (!skill) {
        return `<div class="font-title text-3xl text-green-800 truncate">Ready to Quest!</div>`;
    }

    const reasonInfo = {
        teamwork: { icon: 'fa-users', color: 'purple', name: 'Teamwork' },
        creativity: { icon: 'fa-lightbulb', color: 'pink', name: 'Creativity' },
        respect: { icon: 'fa-hands-helping', color: 'green', name: 'Respect' },
        focus: { icon: 'fa-brain', color: 'yellow', name: 'Focus' },
        welcome_back: { icon: 'fa-hand-sparkles', color: 'cyan', name: 'Welcome' },
        story_weaver: { icon: 'fa-feather-alt', color: 'cyan', name: 'Story' },
        scholar_s_bonus: { icon: 'fa-graduation-cap', color: 'amber', name: 'Scholar' }
    };

    const info = reasonInfo[skill] || { icon: 'fa-star', color: 'gray', name: skill.replace('_', ' ') };

    return `
        <div class="flex items-center gap-3">
            <div class="text-4xl text-${info.color}-500"><i class="fas ${info.icon}"></i></div>
            <div class="text-left">
                <div class="font-title text-2xl text-${info.color}-800 truncate capitalize">${info.name}</div>
            </div>
        </div>
    `;
}
