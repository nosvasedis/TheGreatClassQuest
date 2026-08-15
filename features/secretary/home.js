import * as state from '../../state.js';
import { escapeHtml, formatFlexibleDate } from '../roles/shared.js';
import {
    getStudentMap,
    getClassMap,
    getLatestScoreSummary,
    getThreadTypeMeta,
    getThreadStudentLabel
} from './helpers.js';
import { canUseFeature, getTier } from '../../utils/subscription.js';
import { DEFAULT_SCHOOL_NAME } from '../../constants.js';

function getSecretaryHomeTheme() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
        return {
            greeting: 'Good Morning',
            greetingGradient: 'from-amber-400 via-orange-400 to-rose-400',
            weatherBg: 'w-day',
            weatherIcon: 'fa-school',
            isNight: false
        };
    }
    if (hour >= 12 && hour < 17) {
        return {
            greeting: 'Good Afternoon',
            greetingGradient: 'from-blue-400 via-cyan-400 to-teal-400',
            weatherBg: 'w-day',
            weatherIcon: 'fa-school',
            isNight: false
        };
    }
    if (hour >= 17 && hour < 21) {
        return {
            greeting: 'Good Evening',
            greetingGradient: 'from-indigo-500 via-purple-500 to-pink-500',
            weatherBg: 'w-day',
            weatherIcon: 'fa-school-flag',
            isNight: false
        };
    }
    return {
        greeting: 'Good Night',
        greetingGradient: 'from-indigo-900 via-purple-900 to-slate-800',
        weatherBg: 'w-night',
        weatherIcon: 'fa-moon',
        isNight: true
    };
}

function reminderPillsHtml({ unreadThreads, hasFullConsole, tier }) {
    const pills = [];
    const plan = planBadgeMeta(tier);
    if (hasFullConsole && unreadThreads > 0) {
        pills.push(`
            <button type="button" class="secretary-home-pill secretary-home-pill--messages" data-secretary-tab-link="messages">
                <span class="secretary-home-pill__icon" aria-hidden="true">💬</span>
                <span class="secretary-home-pill__label">${unreadThreads} message${unreadThreads === 1 ? '' : 's'} waiting</span>
            </button>
        `);
    }
    pills.push(`
        <div class="secretary-plan-pill secretary-plan-pill--${plan.key}">
            <span class="secretary-plan-pill__icon" aria-hidden="true"><i class="fas ${plan.icon}"></i></span>
            <span class="secretary-plan-pill__label">${escapeHtml(plan.label)} plan</span>
        </div>
    `);
    return pills.join('');
}

function planBadgeMeta(tier) {
    const key = String(tier || 'starter').toLowerCase();
    if (key === 'elite') return { key, label: 'Elite', icon: 'fa-gem' };
    if (key === 'pro') return { key, label: 'Pro', icon: 'fa-bolt' };
    if (key === 'expired') return { key, label: 'Expired', icon: 'fa-hourglass-half' };
    return { key: 'starter', label: 'Starter', icon: 'fa-seedling' };
}

export function renderSecretaryHome() {
    const classes = state.get('allSchoolClasses') || [];
    const students = state.get('allStudents') || [];
    const scores = state.get('allStudentScores') || [];
    const threads = state.get('currentCommunicationThreads') || [];
    const totalStars = scores.reduce((sum, item) => sum + Number(item.totalStars || 0), 0);
    const totalGold = scores.reduce((sum, item) => sum + Number(item.gold || 0), 0);
    const unreadThreads = threads.filter((t) => !t.lastReadAt || t.lastReadAt < t.lastMessageAt).length;
    const latestThread = threads[0] || null;
    const latestScoreInfo = getLatestScoreSummary();
    const studentMap = getStudentMap();
    const classMap = getClassMap();
    const profile = state.get('currentUserProfile') || {};
    const schoolName = state.get('schoolName') || DEFAULT_SCHOOL_NAME;
    const hasFullConsole = canUseFeature('secretaryAccess');
    const tier = String(getTier() || 'starter');
    const secretaryName = profile.displayName || 'Secretary';
    const theme = getSecretaryHomeTheme();

    const tools = [
        { icon: 'fa-chalkboard', label: 'Classes', tab: 'school', schoolSub: 'classes' },
        { icon: 'fa-user-graduate', label: 'Students', tab: 'school', schoolSub: 'students' },
        ...(hasFullConsole ? [
            { icon: 'fa-chart-simple', label: 'Grades', tab: 'grades' },
            { icon: 'fa-comments', label: 'Messages', tab: 'messages' }
        ] : []),
        { icon: 'fa-cog', label: 'Settings', tab: 'admin' }
    ];

    const latestGradeHtml = latestScoreInfo
        ? `<button type="button" class="chronicle-item chronicle-homework w-full text-left"${hasFullConsole ? ' data-secretary-tab-link="grades"' : ''}>
                <div class="chronicle-card-accent chronicle-accent-homework"></div>
                <div class="flex items-center gap-2.5 mb-3">
                    <div class="chronicle-icon-badge bg-indigo-500/15 text-indigo-600"><i class="fas fa-star text-sm"></i></div>
                    <span class="text-xs font-bold text-indigo-700 uppercase tracking-wider">Latest grade</span>
                </div>
                <p class="text-sm text-indigo-900 font-medium leading-snug line-clamp-3 flex-1">${escapeHtml(latestScoreInfo.score.title || latestScoreInfo.score.type || 'Assessment')}</p>
                <p class="text-[11px] text-indigo-700/70 mt-2 font-semibold">${escapeHtml(latestScoreInfo.student?.name || 'Student')} • ${escapeHtml(latestScoreInfo.classData?.name || 'Class')} • ${escapeHtml(formatFlexibleDate(latestScoreInfo.score.date))}</p>
                <span class="role-score-pill mt-3 self-start">${escapeHtml(latestScoreInfo.label)}</span>
           </button>`
        : `<div class="chronicle-item chronicle-homework">
                <div class="chronicle-card-accent chronicle-accent-homework"></div>
                <div class="flex items-center gap-2.5 mb-3">
                    <div class="chronicle-icon-badge bg-indigo-500/15 text-indigo-600"><i class="fas fa-star text-sm"></i></div>
                    <span class="text-xs font-bold text-indigo-700 uppercase tracking-wider">Latest grade</span>
                </div>
                <p class="text-sm text-indigo-900/70 font-medium leading-snug">New grades will appear here when teachers add them.</p>
           </div>`;

    const latestMessageHtml = latestThread && hasFullConsole
        ? (() => {
            const meta = getThreadTypeMeta(latestThread.threadType);
            const labels = getThreadStudentLabel(latestThread, studentMap, classMap);
            return `<button type="button" class="chronicle-item chronicle-story w-full text-left" data-secretary-thread="${latestThread.id}" data-secretary-open-messages="1">
                <div class="chronicle-card-accent chronicle-accent-story"></div>
                <div class="flex items-center gap-2.5 mb-3">
                    <div class="chronicle-icon-badge bg-cyan-500/15 text-cyan-600"><i class="fas ${meta.icon} text-sm"></i></div>
                    <span class="text-xs font-bold text-cyan-700 uppercase tracking-wider">${escapeHtml(meta.label)}</span>
                </div>
                <p class="text-sm text-cyan-900 font-medium leading-snug line-clamp-3 flex-1">${escapeHtml(labels.studentName)}</p>
                <p class="text-[11px] text-cyan-700/70 mt-2 font-semibold">${escapeHtml(labels.className)}</p>
            </button>`;
        })()
        : `<div class="chronicle-item chronicle-story">
                <div class="chronicle-card-accent chronicle-accent-story"></div>
                <div class="flex items-center gap-2.5 mb-3">
                    <div class="chronicle-icon-badge bg-cyan-500/15 text-cyan-600"><i class="fas fa-comments text-sm"></i></div>
                    <span class="text-xs font-bold text-cyan-700 uppercase tracking-wider">Latest conversation</span>
                </div>
                <p class="text-sm text-cyan-900/70 font-medium leading-snug">${hasFullConsole ? 'Family conversations will appear here when they begin.' : 'Family messaging is available with the Elite plan.'}</p>
           </div>`;

    return `
    <div class="w-full max-w-7xl mx-auto">
        <div class="horizons-grid">
            <div class="vibrant-card h-span-8 greeting-panel">
                <div class="greeting-bg-mesh"></div>
                <div class="greeting-hero-asset">🏫</div>
                <div class="relative z-10 flex flex-col justify-between h-full">
                    <div class="flex justify-between items-start mb-4 gap-4">
                        <div class="flex flex-wrap items-center gap-3 py-1">
                            ${reminderPillsHtml({ unreadThreads, hasFullConsole, tier })}
                        </div>
                    </div>
                    <div>
                        <h2 class="font-title text-4xl md:text-5xl text-slate-800 drop-shadow-sm mb-1">
                            <span class="text-transparent bg-clip-text bg-gradient-to-r ${theme.greetingGradient}">${theme.greeting}</span>,
                            <span class="text-transparent bg-clip-text bg-gradient-to-r from-slate-700 to-slate-500 whitespace-nowrap">${escapeHtml(secretaryName)}</span>!
                        </h2>
                        <p class="text-gray-500 font-bold text-base opacity-75" data-school-name>
                            <i class="fas fa-university mr-2"></i>${escapeHtml(schoolName)}
                        </p>
                    </div>
                </div>
            </div>

            <div class="vibrant-card h-span-4 weather-card ${theme.weatherBg}${theme.isNight ? ' weather-night' : ''}">
                <i class="fas ${theme.weatherIcon} weather-sun"></i>
                <i class="fas fa-cloud weather-cloud"></i>
                <div class="weather-info">
                    <div class="text-7xl font-title">${students.length.toLocaleString()}</div>
                    <div class="text-2xl font-bold uppercase tracking-widest opacity-95">Students</div>
                </div>
                <div class="absolute bottom-4 right-4 z-10 text-white/90 text-xs font-bold uppercase tracking-widest">
                    ${classes.length.toLocaleString()} classes
                </div>
            </div>

            <div class="vibrant-card h-span-6 stat-card-pop card-gradient-sun">
                <span class="text-xs font-bold text-amber-600 uppercase tracking-widest mb-2"><i class="fas fa-star mr-1"></i> School Stars</span>
                <div class="stat-value-big text-amber-500">${totalStars.toLocaleString()}</div>
                <div class="text-sm font-bold text-amber-700/60">Earned so far</div>
            </div>
            <div class="vibrant-card h-span-3 stat-card-pop card-gradient-sky">
                <span class="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2"><i class="fas fa-chalkboard mr-1"></i> Classes</span>
                <div class="stat-value-big text-blue-500">${classes.length.toLocaleString()}</div>
                <div class="text-sm font-bold text-blue-700/60">Across the school</div>
            </div>
            <div class="vibrant-card h-span-3 stat-card-pop card-gradient-royal">
                <span class="text-xs font-bold text-purple-600 uppercase tracking-widest mb-2"><i class="fas fa-coins mr-1"></i> Treasury</span>
                <div class="stat-value-big text-purple-500">${totalGold.toLocaleString()}</div>
                <div class="text-sm font-bold text-purple-700/60">Gold</div>
            </div>

            <div class="vibrant-card h-span-4 card-glass-white">
                <div class="flex items-center justify-between gap-3 p-4 pb-0">
                    <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest">School tools</h3>
                </div>
                <div class="tools-grid-v2">
                    ${tools.map((tool) => `
                        <button type="button" class="tool-btn-pop"
                            data-secretary-tab-link="${tool.tab}"
                            ${tool.schoolSub ? `data-secretary-school-subtab="${tool.schoolSub}"` : ''}
                            title="${escapeHtml(tool.label)}">
                            <i class="fas ${tool.icon}"></i>
                            <span>${escapeHtml(tool.label)}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
            <div class="vibrant-card h-span-8 p-5 bg-gray-50/50 backdrop-blur-sm">
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4"><i class="fas fa-history mr-2"></i> Latest at school</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${latestGradeHtml}
                    ${latestMessageHtml}
                </div>
            </div>
        </div>
    </div>`;
}
