// /ui/modals/reports.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import * as constants from '../../constants.js';
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

    document.getElementById('cert-icon').innerText = randomStyle.icon;
    document.getElementById('cert-icon').style.color = randomStyle.borderColor;
    document.getElementById('cert-title').style.color = randomStyle.titleColor;
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

    let systemPrompt = "";
    if (ageCategory === 'junior') { 
        systemPrompt = "You are an AI writing for a young child's (ages 7-9) achievement certificate. Use very simple English, short sentences, and a cheerful tone. Do NOT use markdown. Write 1-2 brief, simple sentences. Focus on being encouraging. If specific notes are provided, try to incorporate their theme simply.";
    } else if (ageCategory === 'mid') { 
        systemPrompt = "You are an AI writing for a pre-teen's (ages 9-12) certificate. Use positive, encouraging language that sounds cool and acknowledges their effort. Do NOT use markdown. Write 2 brief, well-structured sentences. Refer to specific achievements if notes are provided.";
    } else {
        systemPrompt = "You are an AI writing for a teenager's (ages 12+) certificate. The student is an English language learner. Use clear, positive, and inspiring language, avoiding overly complex vocabulary. The tone should respect their effort. Do NOT use markdown. Write 2 brief, powerful sentences. Use the teacher's notes and academic scores to make the message specific and impactful.";
    }
    const userPrompt = `Write a short certificate message for ${student.name}. This month they showed great ${topReason}, earned ${monthlyStars} stars, and achieved ${topScoreString || 'good results on their trials'}. Teacher's academic notes: ${academicNotes || 'None'}. Keep it brief.`;

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

