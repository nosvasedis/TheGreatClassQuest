// /ui/modals/reports.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import * as constants from '../../constants.js';
import { HERO_CLASSES } from '../../features/heroClasses.js';
import { getGuildById, getGuildEmblemUrl } from '../../features/guilds.js';
import { showAnimatedModal } from './base.js';
import { ensureHistoryLoaded } from '../../db/actions.js';
import { callGeminiApi } from '../../api.js';

export async function handleGenerateReport(classId) {
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
    const academicSummary = academicScores.map(s => `A ${s.type} score of ${s.scoreNumeric || s.scoreQualitative}`).join(', ');

    const systemPrompt = "You are the 'Quest Master,' a helpful AI assistant. You write encouraging, insightful reports for teachers. Do not use markdown. Format your response into two paragraphs with clear headings. The first paragraph is a 'Weekly Summary,' and the second is a 'Suggested Mini-Quest.' Your analysis must be based on ALL provided data: behavioral (stars) and academic (scores), including any teacher notes.";
    const userPrompt = `Class "${classData.name}" (League: ${classData.questLevel}) this week:
- Behavior Data: Earned ${totalStars} stars. Breakdown: ${reasonsString || 'None'}. Notes: ${behaviorNotes || 'None'}.
- Academic Data: Recent scores: ${academicSummary || 'None'}. Notes on scores: ${academicNotes || 'None'}.
Write a 2-paragraph summary highlighting connections between behavior and academics, and suggest a 'mini-quest' for next week based on this combined data.`;
    
    try {
        const report = await callGeminiApi(systemPrompt, userPrompt);
        contentEl.innerHTML = `<h3 class="font-title text-2xl text-green-600 mb-2">${classData.logo} ${classData.name}</h3>` + report.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
    } catch (error) {
        console.error("AI Report Generation Error:", error);
        contentEl.innerHTML = `<p class="text-red-600">The Quest Master is currently on another adventure. Please try again later.</p>`;
    }
}

export async function handleGenerateCertificate(studentId) {
    await ensureHistoryLoaded();
    const student = state.get('allStudents').find(s => s.id === studentId);
    const studentClass = state.get('allSchoolClasses').find(c => c.id === student.classId);
    if (!student || !studentClass) return;

    const contentEl = document.getElementById('certificate-modal-content');
    const downloadBtn = document.getElementById('download-certificate-btn');
    contentEl.innerHTML = `<p class="text-center"><i class="fas fa-spinner fa-spin mr-2"></i> Generating unique certificate...</p>`;
    downloadBtn.classList.add('hidden');
    showAnimatedModal('certificate-modal');

    const ageCategory = utils.getAgeCategoryForLeague(studentClass.questLevel);
    let stylePool = constants.midCertificateStyles;
    if (ageCategory === 'junior') stylePool = constants.juniorCertificateStyles;
    if (ageCategory === 'senior') stylePool = constants.seniorCertificateStyles;
    const randomStyle = stylePool[Math.floor(Math.random() * stylePool.length)];

    const certTemplate = document.getElementById('certificate-template');
    certTemplate.style.borderColor = randomStyle.borderColor;
    certTemplate.style.backgroundColor = randomStyle.bgColor;
    certTemplate.style.color = randomStyle.textColor;

    const certAvatarEl = document.getElementById('cert-avatar');
    if (student.avatar) {
        certAvatarEl.src = student.avatar;
        certAvatarEl.style.display = 'block';
    } else {
        certAvatarEl.style.display = 'none';
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

    // Crest icon + title colours
    document.getElementById('cert-icon').innerText = randomStyle.icon;
    document.getElementById('cert-icon').style.color = randomStyle.borderColor;
    const titleEl = document.getElementById('cert-title');
    titleEl.style.color = randomStyle.titleColor;
    // Slightly different title flavour for older students
    if (ageCategory === 'senior') {
        titleEl.innerText = 'Quest Certificate of Achievement';
    } else if (ageCategory === 'junior') {
        titleEl.innerText = 'Hero of the Quest';
    } else {
        titleEl.innerText = 'Great Class Quest Certificate';
    }

    // Class / guild / hero badges
    const classLabel = `${studentClass.logo || '🏰'} ${studentClass.name || ''}`.trim();
    const classNameEl = document.getElementById('cert-class-name');
    if (classNameEl) classNameEl.innerText = classLabel;

    const guildPillEl = document.getElementById('cert-guild-pill');
    if (guildPillEl) {
        if (guildName) {
            guildPillEl.innerText = `${guildEmoji} ${guildName} Guild`;
            guildPillEl.style.display = 'inline-flex';
            if (guild?.primary && guild?.secondary) {
                guildPillEl.style.background = `linear-gradient(135deg, ${guild.primary} 0%, ${guild.secondary} 100%)`;
                guildPillEl.style.color = guild.textColor || '#ffffff';
                guildPillEl.style.boxShadow = `0 0 18px ${(guild.glow || guild.primary)}66`;
            }
        } else {
            guildPillEl.innerText = 'Guild: Not yet sorted';
            guildPillEl.style.display = 'inline-flex';
        }
    }

    const heroPillEl = document.getElementById('cert-hero-pill');
    if (heroPillEl) {
        heroPillEl.innerText = heroLabel;
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

    const startOfMonth = new Date(new Date().setDate(1)).toLocaleDateString('en-GB');
    const logs = state.get('allAwardLogs').filter(log => log.studentId === studentId && log.teacherId === state.get('currentUserId') && log.date >= startOfMonth);
    const monthlyStars = logs.reduce((sum, log) => sum + log.stars, 0);
    const topReason = Object.entries(logs.reduce((acc, log) => {
        acc[log.reason] = (acc[log.reason] || 0) + 1;
        return acc;
    }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || 'all-around excellence';
    
    const academicScores = state.get('allWrittenScores').filter(score => score.studentId === studentId && score.date >= startOfMonth);
    const topScore = academicScores.sort((a, b) => (b.scoreNumeric / b.maxScore) - (a.scoreNumeric / a.scoreNumeric))[0];
    const topScoreString = topScore ? `a top score of ${topScore.scoreNumeric || topScore.scoreQualitative}` : "";
    const academicNotes = academicScores.filter(s => s.note).map(s => `(Academic note: '${s.note}')`).join(' ');

    // Mini meta summary printed under the AI text (not generated by AI)
    const metaEl = document.getElementById('cert-meta');
    if (metaEl) {
        const leagueLabel = studentClass.questLevel ? `League: ${studentClass.questLevel}` : '';
        const starsLabel = `Stars this month: ${monthlyStars}`;
        const reasonLabel = topReason ? `Top virtue: ${topReason}` : '';
        metaEl.innerText = [leagueLabel, starsLabel, reasonLabel].filter(Boolean).join(' • ');
    }

    let systemPrompt = "";
    if (ageCategory === 'junior') {
        systemPrompt = "You are an AI writing for a young child's (ages 7-9) fantasy classroom achievement certificate in a world called 'The Great Class Quest'. Use very simple English, short sentences, and a cheerful, magical tone. Mention the child as a hero in their guild and class (for example 'Dragon Flame Guild' or 'Grizzly Might'), and optionally their hero role. Do NOT use markdown. Write 1-2 very short sentences (max ~12 words each). You may use 1-2 fun emojis (like ⭐, 🐻, 📚) that fit the data. Focus on encouragement, effort, and being a kind teammate.";
    } else if (ageCategory === 'mid') {
        systemPrompt = "You are an AI writing for a pre-teen's (ages 9-12) fantasy RPG-themed certificate in a classroom game called 'The Great Class Quest'. Use positive, encouraging language that sounds cool and acknowledges their effort over the month. Do NOT use markdown. Write 2 brief, well-structured sentences. If available, weave in their guild name, guild values (traits), and hero role, and connect stars and scores to the idea of quests, guild races, or the Hero's Challenge. You may use 1-3 fitting emojis that match the data (shields, stars, books, etc.).";
    } else {
        systemPrompt = "You are an AI writing for a teenager's (ages 12+) fantasy-themed certificate. The student is an English language learner playing in a classroom RPG called 'The Great Class Quest'. Use clear, positive, and inspiring language, avoiding overly complex vocabulary and not sounding childish. Do NOT use markdown. Write 2 brief, powerful sentences that respect their effort. Where appropriate, briefly reference their guild, hero role, and how their stars and academic work show growth on their quests. Emojis are optional; if you use them, use at most one subtle emoji.";
    }

    const userPrompt = `Write a short certificate message for ${student.name}.
They are in class "${studentClass.name}" (League: ${studentClass.questLevel}).
Guild: ${guildName || 'None yet'}${guildEmoji ? ` (${guildEmoji})` : ''}. Guild motto: "${guildMotto || 'None'}". Guild traits: ${guildTraits || 'None'}.
Hero role: ${heroLabel}.
This month they showed great ${topReason}, earned ${monthlyStars} stars, and achieved ${topScoreString || 'good results on their trials'}.
Teacher's academic notes: ${academicNotes || 'None'}.
Keep it brief but vivid, so it feels like a moment from their adventure in The Great Class Quest.`;

    try {
        const text = await callGeminiApi(systemPrompt, userPrompt);
        contentEl.innerHTML = `<p class="text-lg text-center p-4">${text}</p>`;
        document.getElementById('cert-student-name').innerText = student.name;
        document.getElementById('cert-text').innerText = text;
        document.getElementById('cert-teacher-name').innerText = state.get('currentTeacherName');
        document.getElementById('cert-date').innerText = new Date().toLocaleDateString('en-GB', { month: 'long', day: 'numeric', year: 'numeric' });
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

    try {
        const canvas = await html2canvas(certificateElement, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [800, 600] });
        pdf.addImage(imgData, 'PNG', 0, 0, 800, 600);
        pdf.save(`${studentName}_Certificate_of_Achievement.pdf`);
    } catch (error) {
        console.error("Error generating PDF:", error);
        showToast('Could not generate PDF.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-download mr-2"></i> Download as PDF`;
    }
}

