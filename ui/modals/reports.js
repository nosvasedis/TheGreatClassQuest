// /ui/modals/reports.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import * as constants from '../../constants.js';
import { HERO_CLASSES } from '../../features/heroClasses.js';
import { getGuildById, getGuildEmblemUrl } from '../../features/guilds.js';
import { showAnimatedModal } from './base.js';
import { ensureHistoryLoaded } from '../../db/actions.js';
import { callGeminiApi } from '../../api.js';
import { requireEliteAI } from '../../utils/upgradePrompt.js';
import { getAssessmentValueLabel, getNormalizedPercentForScore } from '../../features/assessmentConfig.js';
import { showToast } from '../effects.js';

let currentCertStudentId = null;
let currentCertScope = 'monthly';

export async function handleGenerateReport(classId) {
    if (!requireEliteAI({ feature: 'Weekly report' })) return;
    await ensureHistoryLoaded();
    const classData = state.get('allTeachersClasses').find(c => c.id === classId);
    if (!classData) return;
    const contentEl = document.getElementById('report-modal-content');
    contentEl.innerHTML = `<p class="text-center"><i class="fas fa-spinner fa-spin mr-2"></i> Generating your report from the Quest Log...</p>`;
    showAnimatedModal('report-modal');

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toLocaleDateString('en-GB');

    const logs = state.get('allAwardLogs').filter(log => log.classId === classId && log.date >= oneWeekAgoStr);
    const totalStars = logs.reduce((sum, log) => sum + log.stars, 0);
    const reasonCounts = logs.reduce((acc, log) => { acc[log.reason] = (acc[log.reason] || 0) + log.stars; return acc; }, {});
    const reasonsString = Object.entries(reasonCounts).map(([reason, count]) => `${reason}: ${count}`).join(', ');
    const behaviorNotes = logs.filter(log => log.note).map(log => `On ${log.date}, a note mentioned: "${log.note}"`).join('. ');
    
    const academicScores = state.get('allWrittenScores').filter(score => score.classId === classId && score.date >= oneWeekAgoStr);
    const academicNotes = academicScores.filter(s => s.note).map(s => `For a ${s.type} on ${s.date}, a note said: "${s.note}"`).join('. ');
    const academicSummary = academicScores.map(s => `A ${s.type} score of ${getAssessmentValueLabel(s)}${Number.isFinite(Number(s.normalizedPercent)) ? ` (${Number(s.normalizedPercent).toFixed(0)}%)` : ''}`).join(', ');

    const systemPrompt = "You are the 'Quest Master,' a helpful AI assistant. You write encouraging, insightful reports for teachers. Format your response beautifully using markdown, with clear headings (##) for 'Weekly Summary' and 'Suggested Mini-Quest'. Use bold text (**) for emphasis on important metrics or traits. Your analysis must be based on ALL provided data: behavioral (stars) and academic (scores), including any teacher notes.";
    const userPrompt = `Class "${classData.name}" (League: ${classData.questLevel}) this week:
- Behavior Data: Earned ${totalStars} stars. Breakdown: ${reasonsString || 'None'}. Notes: ${behaviorNotes || 'None'}.
- Academic Data: Recent scores: ${academicSummary || 'None'}. Notes on scores: ${academicNotes || 'None'}.
Write a 2-paragraph summary highlighting connections between behavior and academics, and suggest a 'mini-quest' for next week based on this combined data.`;
    
    try {
        const report = await callGeminiApi(systemPrompt, userPrompt);
        const htmlReport = typeof marked !== 'undefined' ? marked.parse(report) : report.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
        contentEl.innerHTML = `
            <div class="flex items-center gap-3 mb-6 pb-4 border-b border-emerald-100">
                <span class="text-4xl drop-shadow-md">${classData.logo}</span>
                <h3 class="font-title text-3xl text-emerald-700">${classData.name}</h3>
            </div>
            <div class="prose prose-emerald prose-lg max-w-none prose-headings:font-title prose-headings:text-emerald-800 prose-p:text-gray-700 prose-strong:text-emerald-700 prose-ul:text-gray-700">
                ${htmlReport}
            </div>
        `;
    } catch (error) {
        console.error("AI Report Generation Error:", error);
        contentEl.innerHTML = `
            <div class="flex flex-col items-center justify-center py-10 text-center">
                <i class="fas fa-exclamation-triangle text-4xl text-rose-400 mb-4 animate-pulse"></i>
                <h3 class="font-title text-2xl text-rose-600 mb-2">The Oracle is resting</h3>
                <p class="text-gray-600">The Quest Master is currently on another adventure. Please try again later.</p>
            </div>
        `;
    }
}

export async function handleGenerateCertificate(studentId, scope = 'monthly') {
    await ensureHistoryLoaded();
    
    if (studentId) currentCertStudentId = studentId;
    currentCertScope = scope;
    
    const student = state.get('allStudents').find(s => s.id === currentCertStudentId);
    const studentClass = state.get('allSchoolClasses').find(c => c.id === student?.classId);
    if (!student || !studentClass) return;

    // Update Tab UI
    const tabMonthly = document.getElementById('cert-tab-monthly');
    const tabAllTime = document.getElementById('cert-tab-alltime');
    
    if (tabMonthly && tabAllTime) {
        if (currentCertScope === 'monthly') {
            tabMonthly.className = 'flex-1 py-2.5 rounded-xl font-title text-sm transition-all bubbly-button bg-white text-indigo-600 shadow-sm';
            tabAllTime.className = 'flex-1 py-2.5 rounded-xl font-title text-sm transition-all bubbly-button text-indigo-400 hover:text-indigo-600';
        } else {
            tabAllTime.className = 'flex-1 py-2.5 rounded-xl font-title text-sm transition-all bubbly-button bg-white text-indigo-600 shadow-sm';
            tabMonthly.className = 'flex-1 py-2.5 rounded-xl font-title text-sm transition-all bubbly-button text-indigo-400 hover:text-indigo-600';
        }

        tabMonthly.onclick = () => handleGenerateCertificate(null, 'monthly');
        tabAllTime.onclick = () => handleGenerateCertificate(null, 'alltime');
    }

    const contentEl = document.getElementById('certificate-modal-content');
    const downloadBtn = document.getElementById('download-certificate-btn');
    
    // Initial state (Not auto-generating) - Immersive "Mystic Forge" look
    contentEl.innerHTML = `
        <div class="w-full py-6 min-h-[350px] flex flex-col justify-center animate-fade-in">
            <div class="relative flex flex-col items-center">
                <!-- Decorative background elements -->
                <div class="absolute inset-0 bg-gradient-to-b from-indigo-50/20 to-purple-50/20 rounded-3xl -z-10"></div>
                <div class="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none" style="background-image: url('https://www.transparenttextures.com/patterns/cubes.png');"></div>

                <div class="relative mb-6">
                    <div class="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full animate-pulse"></div>
                    <div class="relative w-28 h-28 rounded-[2rem] bg-white p-1 shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500">
                        <img src="${student.avatar || ''}" class="w-full h-full rounded-[1.8rem] object-cover ${student.avatar ? '' : 'hidden'}">
                        <div class="absolute -bottom-3 -right-3 w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-2xl flex items-center justify-center shadow-lg border-4 border-white transform -rotate-6">
                            <i class="fas fa-quill-magic text-xl"></i>
                        </div>
                    </div>
                </div>

                <div class="text-center space-y-2 mb-8">
                    <h3 class="font-title text-3xl text-indigo-900 tracking-tight">Forge ${student.name}'s Legacy</h3>
                    <div class="flex items-center justify-center gap-3">
                        <span class="h-px w-8 bg-indigo-200"></span>
                        <span class="text-xs font-black uppercase tracking-widest text-indigo-500/80">${currentCertScope === 'monthly' ? 'Monthly Achievement' : "Grand Hero's Journey"}</span>
                        <span class="h-px w-8 bg-indigo-200"></span>
                    </div>
                    <p class="text-indigo-600/70 text-sm max-w-xs mx-auto pt-2 leading-relaxed font-medium">
                        The Oracle is ready to weave ${student.name}'s deeds into a masterpiece. 
                        Choose your mode and let the magic begin.
                    </p>
                </div>

                <div class="grid grid-cols-2 gap-4 w-full max-w-md mb-8">
                    <div class="bg-white/40 backdrop-blur-sm p-4 rounded-2xl border border-white/60 flex flex-col items-center text-center">
                        <i class="fas fa-star text-amber-500 mb-1"></i>
                        <span class="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">Stars Earned</span>
                        <span class="text-lg font-title text-indigo-900">${currentCertScope === 'monthly' ? 'This Month' : 'Total'}</span>
                    </div>
                    <div class="bg-white/40 backdrop-blur-sm p-4 rounded-2xl border border-white/60 flex flex-col items-center text-center">
                        <i class="fas fa-shield-halved text-indigo-500 mb-1"></i>
                        <span class="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">Class Level</span>
                        <span class="text-lg font-title text-indigo-900">${studentClass.questLevel || 'League'}</span>
                    </div>
                </div>

                <button id="generate-cert-btn" class="group relative bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-title text-2xl py-4 px-12 rounded-[1.5rem] shadow-xl shadow-indigo-200/50 transition-all hover:scale-[1.03] active:scale-[0.97] overflow-hidden">
                    <div class="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    <span class="relative flex items-center gap-3">
                        <i class="fas fa-wand-sparkles text-xl animate-bounce"></i>
                        Forge Certificate
                    </span>
                </button>
            </div>
        </div>
    `;
    
    const genBtn = document.getElementById('generate-cert-btn');
    if (genBtn) genBtn.onclick = () => executeCertificateGeneration();
    
    downloadBtn.classList.add('hidden');
    showAnimatedModal('certificate-modal');
}

export async function executeCertificateGeneration() {
    if (!requireEliteAI({ feature: 'Certificate text' })) return;
    
    const student = state.get('allStudents').find(s => s.id === currentCertStudentId);
    const studentClass = state.get('allSchoolClasses').find(c => c.id === student?.classId);
    if (!student || !studentClass) return;

    const contentEl = document.getElementById('certificate-modal-content');
    const downloadBtn = document.getElementById('download-certificate-btn');

    contentEl.innerHTML = `
        <div class="flex flex-col items-center gap-4 py-8">
            <div class="relative">
                <div class="w-20 h-20 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></div>
                <div class="absolute inset-0 flex items-center justify-center">
                    <i class="fas fa-magic text-2xl text-indigo-500 animate-pulse"></i>
                </div>
            </div>
            <div>
                <p class="text-xl font-title text-indigo-900">${currentCertScope === 'monthly' ? 'Crafting Achievement...' : 'Sealing the Legend...'}</p>
                <p class="text-sm text-indigo-600/70 font-semibold uppercase tracking-wider">Consulting the Oracle</p>
            </div>
        </div>
    `;

    const ageCategory = utils.getAgeCategoryForLeague(studentClass.questLevel);
    let stylePool = constants.midCertificateStyles;
    if (ageCategory === 'junior') stylePool = constants.juniorCertificateStyles;
    if (ageCategory === 'senior') stylePool = constants.seniorCertificateStyles;
    const randomStyle = stylePool[Math.floor(Math.random() * stylePool.length)];

    const certTemplate = document.getElementById('certificate-template');
    certTemplate.style.borderColor = randomStyle.borderColor;
    certTemplate.style.backgroundColor = randomStyle.bgColor;
    certTemplate.style.color = randomStyle.textColor;

    // Style the corner ornaments to match the border colour
    ['cert-corner-tl', 'cert-corner-tr', 'cert-corner-bl', 'cert-corner-br'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.borderColor = randomStyle.borderColor;
    });

    const certAvatarEl = document.getElementById('cert-avatar');
    if (student.avatar) {
        certAvatarEl.src = student.avatar;
        certAvatarEl.style.display = 'block';
    } else {
        certAvatarEl.style.display = 'none';
    }

    const certLogoEl = document.getElementById('cert-app-logo');
    if (certLogoEl) {
        certLogoEl.src = new URL('assets/great-class-quest-logo.svg', window.location.href).toString();
        certLogoEl.style.display = 'block';
    }

    // --- Guild & Hero data for styling and wording ---
    const guildId = student.guildId;
    const guild = guildId ? getGuildById(guildId) : null;
    const guildName = guild?.name || null;
    const guildEmoji = guild?.emoji || '🛡️';
    const guildMotto = guild?.motto || '';
    const guildTraits = (guild?.traits || []).join(', ');

    const heroClassId = student.heroClass || '';
    const heroDef = heroClassId && HERO_CLASSES[heroClassId] ? HERO_CLASSES[heroClassId] : null;
    const heroLabel = heroDef
        ? `${heroDef.icon || ''} ${heroClassId}`.trim()
        : (heroClassId || 'Novice');

    // Extra progression data for richer certificate
    const scoreData = state.get('allStudentScores').find(sc => sc.id === currentCertStudentId);
    const heroLevel = scoreData?.heroLevel || 0;
    const totalStarsAllTime = scoreData?.totalStars || 0;

    const startOfMonth = new Date(new Date().setDate(1)).toLocaleDateString('en-GB');
    const allLogs = state.get('allAwardLogs').filter(log => log.studentId === currentCertStudentId && log.teacherId === state.get('currentUserId'));
    
    let scopeLogs = [];
    if (currentCertScope === 'monthly') {
        scopeLogs = allLogs.filter(log => log.date >= startOfMonth);
    } else {
        scopeLogs = allLogs;
    }

    const scopeStars = scopeLogs.reduce((sum, log) => sum + log.stars, 0);
    const topReason = Object.entries(scopeLogs.reduce((acc, log) => {
        acc[log.reason] = (acc[log.reason] || 0) + 1;
        return acc;
    }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || 'all-around excellence';

    // Crest icon + title colours
    document.getElementById('cert-icon').innerText = currentCertScope === 'monthly' ? randomStyle.icon : '🏆';
    document.getElementById('cert-icon').style.color = randomStyle.borderColor;
    const titleEl = document.getElementById('cert-title');
    titleEl.style.color = randomStyle.titleColor;
    // Slightly different title flavour for older students
    if (currentCertScope === 'monthly') {
        if (ageCategory === 'senior') titleEl.innerText = 'Quest Certificate of Achievement';
        else if (ageCategory === 'junior') titleEl.innerText = 'Hero of the Quest';
        else titleEl.innerText = 'Great Class Quest Certificate';
    } else {
        if (ageCategory === 'senior') titleEl.innerText = "Legend's Grand Achievement";
        else if (ageCategory === 'junior') titleEl.innerText = 'Ultimate Quest Hero';
        else titleEl.innerText = 'Master of The Great Quest';
    }

    // Hero-class pill colors (by role / theme)
    const HERO_PILL_COLORS = {
        Guardian: { bg: '#2563eb', color: '#fff', border: '#1d4ed8' },
        Sage: { bg: '#7c3aed', color: '#fff', border: '#6d28d9' },
        Paladin: { bg: '#dc2626', color: '#fff', border: '#b91c1c' },
        Artificer: { bg: '#0d9488', color: '#fff', border: '#0f766e' },
        Scholar: { bg: '#b45309', color: '#fff', border: '#92400e' },
        Weaver: { bg: '#059669', color: '#fff', border: '#047857' },
        Nomad: { bg: '#475569', color: '#f1f5f9', border: '#334155' },
    };
    const defaultHeroPill = { bg: '#4b5563', color: '#f9fafb', border: '#374151' };

    // League pill colours by age band
    const LEAGUE_PILL_STYLES = {
        junior: {
            bg: 'linear-gradient(135deg, #ec4899 0%, #f97316 100%)',
            color: '#fff',
            border: 'rgba(255,255,255,0.55)'
        },
        mid: {
            bg: 'linear-gradient(135deg, #6366f1 0%, #22c55e 100%)',
            color: '#f9fafb',
            border: 'rgba(255,255,255,0.55)'
        },
        senior: {
            bg: 'linear-gradient(135deg, #0f172a 0%, #4b5563 100%)',
            color: '#e5e7eb',
            border: 'rgba(255,255,255,0.45)'
        }
    };
    const defaultLeaguePill = {
        bg: 'linear-gradient(135deg, #4b5563 0%, #6b7280 100%)',
        color: '#f9fafb',
        border: 'rgba(255,255,255,0.45)'
    };

    // Virtue/top-reason pill styles (mapped from common reasons)
    const VIRTUE_PILL_STYLES = {
        respect: {
            emoji: '🤝',
            bg: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            color: '#fff',
            border: 'rgba(255,255,255,0.55)'
        },
        teamwork: {
            emoji: '🐻',
            bg: 'linear-gradient(135deg, #92400e 0%, #d97706 100%)',
            color: '#fff',
            border: 'rgba(255,255,255,0.55)'
        },
        focus: {
            emoji: '🎯',
            bg: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
            color: '#ecfeff',
            border: 'rgba(255,255,255,0.55)'
        },
        creativity: {
            emoji: '🎨',
            bg: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
            color: '#fdf2ff',
            border: 'rgba(255,255,255,0.55)'
        },
        'all-around excellence': {
            emoji: '🌟',
            bg: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
            color: '#fff7ed',
            border: 'rgba(255,255,255,0.55)'
        }
    };
    const defaultVirtuePill = {
        emoji: '⭐',
        bg: 'linear-gradient(135deg, #4b5563 0%, #6b7280 100%)',
        color: '#f9fafb',
        border: 'rgba(255,255,255,0.45)'
    };

    // Class pill — friendly “class/team” color (e.g. emerald)
    const classLabel = `${studentClass.logo || '🏰'} ${studentClass.name || ''}`.trim();
    const classNameEl = document.getElementById('cert-class-name');
    if (classNameEl) {
        classNameEl.innerText = classLabel;
        classNameEl.style.background = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
        classNameEl.style.color = '#fff';
        classNameEl.style.border = '1px solid rgba(255,255,255,0.4)';
        classNameEl.style.boxShadow = '0 0 12px rgba(5,150,105,0.4)';
    }

    const guildPillEl = document.getElementById('cert-guild-pill');
    if (guildPillEl) {
        guildPillEl.style.display = 'inline-flex';
        if (guildName && guild?.primary && guild?.secondary) {
            guildPillEl.innerText = `${guildEmoji} ${guildName} Guild`;
            guildPillEl.style.background = `linear-gradient(135deg, ${guild.primary} 0%, ${guild.secondary} 100%)`;
            guildPillEl.style.color = guild.textColor || '#ffffff';
            guildPillEl.style.border = `1px solid rgba(255,255,255,0.4)`;
            guildPillEl.style.boxShadow = `0 0 18px ${(guild.glow || guild.primary)}66`;
        } else {
            guildPillEl.innerText = 'Guild: Not yet sorted';
            guildPillEl.style.background = 'linear-gradient(135deg, #475569 0%, #64748b 100%)';
            guildPillEl.style.color = '#f1f5f9';
            guildPillEl.style.border = '1px solid rgba(255,255,255,0.25)';
            guildPillEl.style.boxShadow = 'none';
        }
    }

    const heroPillEl = document.getElementById('cert-hero-pill');
    if (heroPillEl) {
        const levelSuffix = heroLevel > 0 ? ` · Lv.${heroLevel}` : '';
        heroPillEl.innerText = `${heroLabel}${levelSuffix}`;
        const heroColors = (heroClassId && HERO_PILL_COLORS[heroClassId]) ? HERO_PILL_COLORS[heroClassId] : defaultHeroPill;
        heroPillEl.style.background = heroColors.bg;
        heroPillEl.style.color = heroColors.color;
        heroPillEl.style.border = `1px solid ${heroColors.border}`;
        heroPillEl.style.boxShadow = `0 0 12px ${heroColors.bg}66`;
    }

    const starsPillEl = document.getElementById('cert-stars-pill');
    if (starsPillEl) {
        starsPillEl.innerText = currentCertScope === 'monthly' ? `⭐ ${scopeStars} Stars This Month` : `⭐ ${scopeStars} Total Stars`;
        starsPillEl.style.background = 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)';
        starsPillEl.style.color = '#fff';
        starsPillEl.style.border = '1px solid rgba(255,255,255,0.4)';
        starsPillEl.style.boxShadow = '0 0 12px rgba(217,119,6,0.45)';
    }

    // League pill (Quest League / age band)
    const leaguePillEl = document.getElementById('cert-league-pill');
    if (leaguePillEl) {
        const leagueLabel = studentClass.questLevel || 'League Explorer';
        let leagueEmoji = '🏰';
        if (ageCategory === 'junior') leagueEmoji = '🌈';
        else if (ageCategory === 'mid') leagueEmoji = '🛡️';
        else if (ageCategory === 'senior') leagueEmoji = '🏆';
        leaguePillEl.innerText = `${leagueEmoji} ${leagueLabel}`;

        const leagueStyle = LEAGUE_PILL_STYLES[ageCategory] || defaultLeaguePill;
        leaguePillEl.style.background = leagueStyle.bg;
        leaguePillEl.style.color = leagueStyle.color;
        leaguePillEl.style.border = `1px solid ${leagueStyle.border}`;
        leaguePillEl.style.boxShadow = '0 0 12px rgba(15,23,42,0.35)';
        leaguePillEl.style.display = 'inline-flex';
    }

    // Top virtue / reason pill
    const virtuePillEl = document.getElementById('cert-virtue-pill');
    if (virtuePillEl) {
        if (topReason) {
            const key = topReason.toLowerCase();
            const cfg = VIRTUE_PILL_STYLES[key] || defaultVirtuePill;
            const capitalisedReason = topReason.charAt(0).toUpperCase() + topReason.slice(1);
            virtuePillEl.innerText = `${cfg.emoji} ${capitalisedReason}`;
            virtuePillEl.style.background = cfg.bg;
            virtuePillEl.style.color = cfg.color;
            virtuePillEl.style.border = `1px solid ${cfg.border}`;
            virtuePillEl.style.boxShadow = '0 0 12px rgba(15,23,42,0.35)';
            virtuePillEl.style.display = 'inline-flex';
        } else {
            virtuePillEl.style.display = 'none';
        }
    }

    // Optional guild emblem crest
    const emblemEl = document.getElementById('cert-guild-emblem');
    if (emblemEl) {
        const emblemUrl = guildId ? getGuildEmblemUrl(guildId) : '';
        if (emblemUrl) {
            emblemEl.src = emblemUrl;
            emblemEl.style.display = 'block';
        } else {
            emblemEl.style.display = 'none';
        }
    }

    // Name & signature colours
    document.getElementById('cert-student-name').style.color = randomStyle.nameColor;
    document.getElementById('cert-teacher-name').style.borderTopColor = randomStyle.borderColor;
    document.getElementById('cert-date').style.borderTopColor = randomStyle.borderColor;

    const scopeAcademicLogs = state.get('allWrittenScores').filter(score => score.studentId === currentCertStudentId && (currentCertScope === 'monthly' ? score.date >= startOfMonth : true));
    const topScore = [...scopeAcademicLogs].sort((a, b) => (getNormalizedPercentForScore(b) || 0) - (getNormalizedPercentForScore(a) || 0))[0];
    const topScoreString = topScore ? `a top score of ${getAssessmentValueLabel(topScore)}` : "";
    const academicNotes = scopeAcademicLogs.filter(s => s.note).map(s => `(Academic note: '${s.note}')`).join(' ');

    // Decorative flair row under the AI text (simple icon shapes tuned by age band)
    const flairRowEl = document.getElementById('cert-flair-row');
    if (flairRowEl) {
        flairRowEl.innerHTML = '';
        let icons = [];
        if (ageCategory === 'junior') {
            icons = ['🌈', '📚', '⭐'];
        } else if (ageCategory === 'mid') {
            icons = ['🛡️', '📖', '⚔️'];
        } else {
            icons = ['🏆', '📚', '🌟'];
        }
        icons.forEach(icon => {
            const bubble = document.createElement('span');
            bubble.textContent = icon;
            bubble.style.width = '28px';
            bubble.style.height = '28px';
            bubble.style.borderRadius = '9999px';
            bubble.style.display = 'flex';
            bubble.style.alignItems = 'center';
            bubble.style.justifyContent = 'center';
            bubble.style.background = 'rgba(255,255,255,0.22)';
            bubble.style.boxShadow = '0 2px 6px rgba(0,0,0,0.18)';
            bubble.style.fontSize = '18px';
            flairRowEl.appendChild(bubble);
        });
    }

    // Mini meta summary printed under the AI text (not generated by AI).
    // We keep this subtle and non-duplicative: just a total-journey stars line if available.
    const metaEl = document.getElementById('cert-meta');
    if (metaEl) {
        metaEl.innerText = totalStarsAllTime ? `Total stars: ${totalStarsAllTime}` : '';
    }

    let systemPrompt = "";
    if (ageCategory === 'junior') {
        systemPrompt = `You are an AI writing for a young child's (ages 7-9) fantasy classroom achievement certificate in a world called 'The Great Class Quest'.
        Current Scope: ${currentCertScope === 'monthly' ? 'Monthly Achievement' : 'Grand Hero Journey (End of Year)'}.
        Use very simple English, short sentences, and a cheerful, magical tone. Mention the child as a hero in their guild and class. Do NOT use markdown. Write 1-2 very short sentences. Focus on ${currentCertScope === 'monthly' ? 'this month\'s efforts' : 'their entire journey as a legend'}.`;
    } else if (ageCategory === 'mid') {
        systemPrompt = `You are an AI writing for a pre-teen's (ages 9-12) fantasy RPG-themed certificate.
        Current Scope: ${currentCertScope === 'monthly' ? 'Monthly Achievement' : 'Grand Hero Journey (End of Year)'}.
        Use positive, encouraging language that sounds cool. Do NOT use markdown. Write 2 brief sentences. Connect their ${currentCertScope === 'monthly' ? 'monthly stars' : 'long-term legendary status'} to their growth.`;
    } else {
        systemPrompt = `You are an AI writing for a teenager's (ages 12+) fantasy-themed certificate.
        Current Scope: ${currentCertScope === 'monthly' ? 'Monthly Achievement' : 'Grand Hero Journey (End of Year)'}.
        Use clear, positive, and inspiring language. Do NOT use markdown. Write 2 brief, powerful sentences. Acknowledge ${currentCertScope === 'monthly' ? 'this month\'s progress' : 'their overall mastery and dedication throughout the quest'}.`;
    }

    const userPrompt = `Write a short certificate message for ${student.name}.
They are in class "${studentClass.name}" (League: ${studentClass.questLevel}).
Guild: ${guildName || 'None yet'}${guildEmoji ? ` (${guildEmoji})` : ''}. Guild motto: "${guildMotto || 'None'}". Guild traits: ${guildTraits || 'None'}.
Hero role: ${heroLabel}${heroLevel > 0 ? ` (Hero Level ${heroLevel})` : ''}.
Period: ${currentCertScope === 'monthly' ? 'this past month' : 'the entire year'}.
They showed great ${topReason}, earned ${scopeStars} stars${totalStarsAllTime > 0 ? ` (${totalStarsAllTime} total stars on their journey)` : ''}, and achieved ${topScoreString || 'good results on their trials'}.
Teacher's academic notes: ${academicNotes || 'None'}.
Keep it brief but vivid, so it feels like a moment from their adventure in The Great Class Quest.`;

    try {
        const text = await callGeminiApi(systemPrompt, userPrompt);
        contentEl.innerHTML = `
            <div class="w-full space-y-6 animate-fade-in">
                <div class="flex flex-col items-center">
                    <div class="relative mb-4">
                        <div class="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full animate-pulse"></div>
                        <img src="${student.avatar || ''}" class="relative w-24 h-24 rounded-full border-4 border-white shadow-xl object-cover ${student.avatar ? '' : 'hidden'}">
                        <div class="absolute -bottom-2 -right-2 bg-gradient-to-br from-amber-400 to-orange-500 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-4 border-white">
                            <i class="fas fa-star"></i>
                        </div>
                    </div>
                    <h3 class="text-3xl font-title text-indigo-900 mb-1">${student.name}</h3>
                    <div class="px-4 py-1.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black uppercase tracking-widest border border-indigo-200/50">
                        ${heroLabel}
                    </div>
                </div>
                
                <div class="relative px-8 py-6 bg-indigo-50/50 rounded-3xl border border-indigo-100 italic text-indigo-900/90 text-lg leading-relaxed text-center quote-container">
                    <i class="fas fa-quote-left absolute top-4 left-4 text-indigo-200 text-2xl"></i>
                    ${text}
                    <i class="fas fa-quote-right absolute bottom-4 right-4 text-indigo-200 text-2xl"></i>
                </div>
                
                <div class="flex justify-center gap-3">
                    <div class="flex flex-col items-center">
                        <span class="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">${currentCertScope === 'monthly' ? 'Monthly Stars' : 'Total Stars'}</span>
                        <span class="text-xl font-title text-amber-600">${scopeStars}</span>
                    </div>
                    <div class="w-px h-8 bg-indigo-100 self-center"></div>
                    <div class="flex flex-col items-center">
                        <span class="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">Level</span>
                        <span class="text-xl font-title text-indigo-600">${heroLevel}</span>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('cert-student-name').innerText = student.name;
        document.getElementById('cert-text').innerText = text;
        document.getElementById('cert-teacher-name').innerText = state.get('currentTeacherName');
        document.getElementById('cert-date').innerText = currentCertScope === 'monthly' ? new Date().toLocaleDateString('en-GB', { month: 'long', day: 'numeric', year: 'numeric' }) : `End of Year ${new Date().getFullYear()}`;
        downloadBtn.classList.remove('hidden');
    } catch (error) {
        console.error("AI Certificate Generation Error:", error);
        contentEl.innerHTML = `<p class="text-red-600">There was an error generating the certificate text. Please try again.</p>`;
    }
}

export async function downloadCertificateAsPdf() {
    const btn = document.getElementById('download-certificate-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Preparing PDF...`;
    
    const { jsPDF } = window.jspdf;
    const certificateElement = document.getElementById('certificate-template');
    const studentName = document.getElementById('cert-student-name').innerText;

    const waitForImageReady = (imgEl) => new Promise((resolve) => {
        if (!imgEl || !imgEl.src || imgEl.style.display === 'none') {
            resolve();
            return;
        }
        if (imgEl.complete && imgEl.naturalWidth > 0) {
            resolve();
            return;
        }
        const done = () => resolve();
        imgEl.addEventListener('load', done, { once: true });
        imgEl.addEventListener('error', done, { once: true });
    });

    // Robust Image-to-DataURL conversion helper
    const toDataURL = async (url) => {
        if (!url) return '';
        if (url.startsWith('data:')) return url;
        try {
            const absoluteUrl = new URL(url, window.location.href).toString();
            const response = await fetch(absoluteUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.warn("Could not convert image to DataURL:", url, e);
            return url; 
        }
    };

    try {
        // Pre-convert all key images to DataURLs to ensure html2canvas sees them
        const avatarImg = document.getElementById('cert-avatar');
        const emblemImg = document.getElementById('cert-guild-emblem');
        const logoImg = document.getElementById('cert-app-logo');
        const imageNodes = [avatarImg, emblemImg, logoImg].filter(Boolean);

        if (avatarImg && avatarImg.src && !avatarImg.src.startsWith('data:')) {
            avatarImg.src = await toDataURL(avatarImg.src);
        }
        if (emblemImg && emblemImg.src && !emblemImg.src.startsWith('data:')) {
            emblemImg.src = await toDataURL(emblemImg.src);
        }
        if (logoImg && logoImg.src && !logoImg.src.startsWith('data:')) {
            logoImg.src = await toDataURL(logoImg.src);
        }

        await Promise.all(imageNodes.map(waitForImageReady));
        
        const canvas = await html2canvas(certificateElement, { 
            scale: 2, 
            useCORS: true,
            allowTaint: false,
            logging: false,
            imageTimeout: 20000,
            backgroundColor: '#ffffff'
        });
        
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [800, 600] });
        pdf.addImage(imgData, 'PNG', 0, 0, 800, 600);
        
        const fileSuffix = currentCertScope === 'monthly' ? 'Monthly_Quest' : 'Legends_Journey';
        pdf.save(`${studentName}_${fileSuffix}.pdf`);
    } catch (error) {
        console.error("Error generating PDF:", error);
        showToast('Could not generate PDF.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-download mr-2"></i> Download as PDF`;
    }
}
