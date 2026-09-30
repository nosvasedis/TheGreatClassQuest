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
import { canUseFeature } from '../../utils/subscription.js';
import { getAssessmentValueLabel, getNormalizedPercentForScore } from '../../features/assessmentConfig.js';
import { showToast } from '../effects.js';
import { auth } from '../../firebase.js';
import { getAwardLogMonthlyStarCredit } from '../../features/awardLogReasonMeta.js';
import { loadPdfTools } from '../../utils/lazyLibraries.js';
import { HERO_SKILL_TREE } from '../../features/heroSkillTree.js';
import {
    buildCertificateModel,
    buildCertificatePrompt,
    certificateStyleVars,
    cleanCitation,
    escapeHtml,
    renderCertificateInner,
    CERTIFICATE_WIDTH,
    CERTIFICATE_HEIGHT,
} from '../../features/certificateCore.mjs';

let currentCertStudentId = null;
let currentCertScope = 'monthly';

// ─── Weekly Report ("The Week's Scroll") ────────────────────────────────────
// Numbers come from features/weeklyReportCore.mjs (Mon–Sun lesson week, compared with the week
// before); markup from ./weeklyReportView.mjs. The Oracle's reading is written on top and cached
// per class + week for this session. History holds ~30 days of award logs, so the week picker
// goes back at most three weeks (each week also needs the one before it).

const REPORT_MIN_OFFSET = -3;
const reportReadings = new Map();
let reportClassId = null;
let reportOffset = 0;
let reportModel = null;
let reportReadingState = { status: 'idle' };
let reportToken = 0;
let reportCore = null;
let reportView = null;

async function loadReportModules() {
    if (!reportCore || !reportView) {
        [reportCore, reportView] = await Promise.all([
            import('../../features/weeklyReportCore.mjs'),
            import('./weeklyReportView.mjs'),
        ]);
    }
    return { core: reportCore, view: reportView };
}

function reportReadingKey() {
    return reportModel ? `${reportModel.classId}:${reportModel.week.key}` : '';
}

function buildReportModelFor(classData, offset) {
    const week = reportCore.getReportWeek(new Date(), offset);
    const students = (state.get('allStudents') || [])
        .filter((s) => s.classId === classData.id && s.enrollmentStatus !== 'inactive');
    return reportCore.buildWeeklyReportModel({
        classData,
        students,
        awardLogs: state.get('allAwardLogs') || [],
        writtenScores: state.get('allWrittenScores') || [],
        attendance: state.get('allAttendanceRecords') || [],
        adventureLogs: state.get('allAdventureLogs') || [],
        week,
        starCredit: getAwardLogMonthlyStarCredit,
        scorePercent: (score) => {
            const pct = getNormalizedPercentForScore(score, classData);
            return Number.isFinite(Number(pct)) ? Number(pct) : null;
        },
        scoreLabel: (score) => getAssessmentValueLabel(score, classData),
        youngLearners: utils.getAgeCategoryForLeague(classData.questLevel) === 'early',
    });
}

function setReportButtonsEnabled(enabled) {
    ['report-copy-btn', 'report-pdf-btn'].forEach((id) => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = !enabled;
    });
}

function renderReportHeader(classData) {
    const logo = document.getElementById('report-modal-logo');
    if (logo) logo.textContent = classData.logo || '📚';
    const sub = document.getElementById('report-modal-sub');
    if (sub) sub.textContent = `${classData.name}${classData.questLevel ? ` · ${classData.questLevel}` : ''}`;
    const week = reportCore.getReportWeek(new Date(), reportOffset);
    const name = document.getElementById('report-week-name');
    const label = document.getElementById('report-week-label');
    if (name) name.textContent = week.name;
    if (label) label.textContent = week.label;
    const prev = document.getElementById('report-week-prev');
    const next = document.getElementById('report-week-next');
    if (prev) prev.disabled = reportOffset <= REPORT_MIN_OFFSET;
    if (next) next.disabled = reportOffset >= 0;
}

function renderReportBody() {
    const contentEl = document.getElementById('report-modal-content');
    if (!contentEl || !reportModel) return;
    contentEl.innerHTML = reportView.renderWeeklyReportMarkup(reportModel, reportReadingState, {
        canGoBack: reportOffset > REPORT_MIN_OFFSET,
    });
    setReportButtonsEnabled(!reportModel.isEmpty);
}

function renderReportReading() {
    const body = document.getElementById('wr-reading-body');
    if (body) body.innerHTML = reportView.renderReadingMarkup(reportReadingState);
}

async function requestReportReading({ force = false } = {}) {
    if (!reportModel || reportModel.isEmpty) return;
    const key = reportReadingKey();
    if (!force && reportReadings.has(key)) {
        reportReadingState = { status: 'ready', reading: reportReadings.get(key) };
        renderReportReading();
        return;
    }
    if (!canUseFeature('eliteAI')) {
        reportReadingState = { status: 'locked' };
        renderReportReading();
        return;
    }
    const token = reportToken;
    reportReadingState = { status: 'loading' };
    renderReportReading();
    try {
        const { system, user } = reportCore.buildWeeklyReportPrompt(reportModel, {
            audience: utils.getLeagueAiAudience?.(reportModel.league) || 'young learners',
        });
        const reading = reportCore.parseWeeklyReading(await callGeminiApi(system, user));
        if (!reading) throw new Error('Empty reading');
        reportReadings.set(key, reading);
        if (token !== reportToken || key !== reportReadingKey()) return;
        reportReadingState = { status: 'ready', reading };
    } catch (error) {
        console.error('AI Report Generation Error:', error);
        if (token !== reportToken || key !== reportReadingKey()) return;
        reportReadingState = { status: 'error' };
    }
    renderReportReading();
}

async function showReportWeek(offset) {
    const classData = (state.get('allTeachersClasses') || []).find((c) => c.id === reportClassId);
    if (!classData) return;
    reportToken += 1;
    reportOffset = Math.max(REPORT_MIN_OFFSET, Math.min(0, offset));
    reportModel = buildReportModelFor(classData, reportOffset);
    const cached = reportReadings.get(reportReadingKey());
    reportReadingState = cached ? { status: 'ready', reading: cached } : { status: 'idle' };
    renderReportHeader(classData);
    renderReportBody();
    const contentEl = document.getElementById('report-modal-content');
    if (contentEl) contentEl.scrollTop = 0;
    if (!cached) requestReportReading();
}

async function copyToClipboard(text, okMessage) {
    try {
        await navigator.clipboard.writeText(text);
        showToast(okMessage, 'success');
    } catch (_) {
        showToast('Could not copy. Select the text and copy it by hand.', 'error');
    }
}

function wireReportModal() {
    const modal = document.getElementById('report-modal');
    if (!modal || modal.dataset.wrWired === '1') return;
    modal.dataset.wrWired = '1';
    document.getElementById('report-week-prev')?.addEventListener('click', () => showReportWeek(reportOffset - 1));
    document.getElementById('report-week-next')?.addEventListener('click', () => showReportWeek(reportOffset + 1));
    document.getElementById('report-copy-btn')?.addEventListener('click', () => {
        if (!reportModel) return;
        const reading = reportReadingState.status === 'ready' ? reportReadingState.reading : null;
        copyToClipboard(reportCore.buildWeeklyReportText(reportModel, reading), 'Weekly report copied.');
    });
    document.getElementById('report-pdf-btn')?.addEventListener('click', () => downloadWeeklyReportPdf());
    modal.addEventListener('click', (event) => {
        const action = event.target.closest('[data-wr-action]')?.dataset.wrAction;
        if (action === 'reading') requestReportReading({ force: reportReadingState.status === 'ready' });
        else if (action === 'prev') showReportWeek(reportOffset - 1);
        else if (action === 'copy-family') {
            const note = reportReadingState.reading?.familyNote;
            if (note) copyToClipboard(note, 'Family note copied.');
        }
    });
    modal.addEventListener('keydown', (event) => {
        if (event.target.closest('input, textarea, select')) return;
        if (event.key === 'ArrowLeft' && reportOffset > REPORT_MIN_OFFSET) showReportWeek(reportOffset - 1);
        else if (event.key === 'ArrowRight' && reportOffset < 0) showReportWeek(reportOffset + 1);
    });
}

export async function handleGenerateReport(classId) {
    if (!requireEliteAI({ feature: 'Weekly report' })) return;
    const classData = (state.get('allTeachersClasses') || []).find(c => c.id === classId);
    if (!classData) return;
    reportClassId = classId;
    reportModel = null;
    const contentEl = document.getElementById('report-modal-content');
    if (contentEl) {
        contentEl.innerHTML = `<div class="wr-gathering"><i class="fas fa-feather-pointed fa-beat-fade"></i> Gathering the week from the Quest Log…</div>`;
    }
    setReportButtonsEnabled(false);
    const logo = document.getElementById('report-modal-logo');
    if (logo) logo.textContent = classData.logo || '📚';
    const sub = document.getElementById('report-modal-sub');
    if (sub) sub.textContent = classData.name;
    showAnimatedModal('report-modal');

    await Promise.all([ensureHistoryLoaded(), loadReportModules()]);
    wireReportModal();
    if (reportClassId !== classId) return;

    // Early in the week there is often nothing yet: open on last week instead.
    const thisWeek = buildReportModelFor(classData, 0);
    await showReportWeek(thisWeek.isEmpty || thisWeek.lessonCount === 0 ? -1 : 0);
}

async function downloadWeeklyReportPdf() {
    const btn = document.getElementById('report-pdf-btn');
    const source = document.getElementById('report-modal-content');
    if (!btn || !source || !reportModel || reportModel.isEmpty) return;
    const idle = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing…';
    let host = null;
    try {
        const { html2canvas, jsPDF } = await loadPdfTools();
        // Print a detached copy: fixed width, no scroll, cross-origin portraits as initials.
        const width = 900;
        host = document.createElement('div');
        host.className = 'wr-print-host';
        Object.assign(host.style, { position: 'fixed', left: '-12000px', top: '0', width: `${width}px`, pointerEvents: 'none', zIndex: '-1' });
        host.innerHTML = `
            <div class="wr-print-title">
                <span class="wr-print-title__logo">${escapeHtml(reportModel.classLogo)}</span>
                <div><p>Weekly Report · ${escapeHtml(reportModel.week.label)}</p><h1>${escapeHtml(reportModel.className)}</h1></div>
            </div>`;
        const clone = source.cloneNode(true);
        clone.removeAttribute('id');
        clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
        clone.querySelectorAll('button').forEach((el) => el.remove());
        clone.querySelectorAll('.wr-avatar img').forEach((img) => {
            const hero = img.closest('.wr-shine, .wr-unseen__hero');
            const name = hero?.querySelector('.wr-shine__name')?.textContent || hero?.textContent || '';
            const span = document.createElement('span');
            span.textContent = name.trim().charAt(0).toUpperCase();
            img.replaceWith(span);
        });
        clone.className = 'wr-body wr-body--print';
        host.appendChild(clone);
        document.body.appendChild(host);
        await withTimeout(document.fonts?.ready, 2000, null);

        const canvas = await html2canvas(host, { scale: 2, backgroundColor: '#fbf7ec', logging: false, width, windowWidth: width });
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const margin = 8;
        const imgW = pageW - margin * 2;
        const pxPerMm = canvas.width / imgW;
        const sliceHpx = Math.floor((pageH - margin * 2) * pxPerMm);
        for (let y = 0, page = 0; y < canvas.height; y += sliceHpx, page += 1) {
            const h = Math.min(sliceHpx, canvas.height - y);
            const slice = document.createElement('canvas');
            slice.width = canvas.width;
            slice.height = h;
            slice.getContext('2d').drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
            if (page > 0) pdf.addPage();
            pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, imgW, h / pxPerMm);
        }
        pdf.setProperties({ title: `${reportModel.className}: Weekly Report ${reportModel.week.label}`, creator: 'The Great Class Quest' });
        const safe = String(reportModel.className).replace(/[^A-Za-z0-9Ͱ-ϿЀ-ӿ]+/g, '_').replace(/^_+|_+$/g, '') || 'Class';
        pdf.save(`${safe}_Weekly_Report_${reportModel.week.key}.pdf`);
    } catch (error) {
        console.error('Weekly report PDF error:', error);
        showToast('Could not create the PDF.', 'error');
    } finally {
        host?.remove();
        btn.disabled = false;
        btn.innerHTML = idle;
    }
}


// ─── Hero Certificate ────────────────────────────────────────────────────────
// The page itself is modelled and drawn by features/certificateCore.mjs; this file gathers the
// records, runs the Herald's Folio modal (live preview + Oracle citation) and prints the PDF.

const CERT_CITATION_MAX = 320;
const certCitations = new Map();
let certModel = null;
let certAssets = {};
let certRenderToken = 0;
let certGenerating = false;
let certError = '';
let certPreviewObserver = null;

function certCitationKey() {
    return `${currentCertStudentId}:${currentCertScope}:${utils.getLocalMonthKey()}`;
}

function getCertCitation() {
    return certCitations.get(certCitationKey()) || '';
}

function withTimeout(promise, ms, fallback) {
    return Promise.race([
        Promise.resolve(promise).catch(() => fallback),
        new Promise((resolve) => window.setTimeout(() => resolve(fallback), ms)),
    ]);
}

function formatCertSchoolYear() {
    const key = state.getActiveSchoolYearKey?.() || '';
    const m = /^(\d{4})\D+(\d{4})$/.exec(String(key));
    return m ? `${m[1]}–${m[2].slice(2)}` : '';
}

async function loadCertificateOaths() {
    if (!state.get('hasLoadedEmberOaths')) {
        try {
            const { loadEmberOaths } = await import('../../db/actions/emberOaths.js');
            await withTimeout(loadEmberOaths(), 3000, null);
        } catch (_) {
            // Hero Campfire is a Pro feature; without it there are simply no oaths to print.
        }
    }
    return state.get('allEmberOaths') || [];
}

async function loadCertificateProdigyWins(student) {
    try {
        const { getProdigyCountsForClass } = await import('./rankings.js');
        const result = await withTimeout(getProdigyCountsForClass(student.classId), 6000, null);
        return Number(result?.winCounts?.get(student.id)) || 0;
    } catch (_) {
        return 0;
    }
}

async function buildCurrentCertificateModel(student, studentClass) {
    const scope = currentCertScope;
    const [oaths, prodigyWins, familiarTypes] = await Promise.all([
        loadCertificateOaths(),
        scope === 'alltime' ? loadCertificateProdigyWins(student) : Promise.resolve(0),
        import('../../features/familiars.js').then((m) => m.FAMILIAR_TYPES).catch(() => ({})),
    ]);
    const heroClass = student.heroClass || '';
    return buildCertificateModel({
        scope,
        now: new Date(),
        student,
        studentClass,
        scoreData: state.get('allStudentScores').find((sc) => sc.id === student.id) || null,
        ageCategory: utils.getAgeCategoryForLeague(studentClass.questLevel),
        awardLogs: state.get('allAwardLogs') || [],
        writtenScores: state.get('allWrittenScores') || [],
        oaths,
        prodigyWins,
        guild: student.guildId ? getGuildById(student.guildId) || null : null,
        heroDef: heroClass ? HERO_CLASSES[heroClass] || null : null,
        heroTree: heroClass ? HERO_SKILL_TREE[heroClass] || null : null,
        familiarTypes,
        scorePercent: (score) => getNormalizedPercentForScore(score, studentClass),
        scoreLabel: (score) => getAssessmentValueLabel(score, studentClass),
        teacherName: state.get('currentTeacherName') || '',
        schoolName: state.get('schoolName') || '',
        schoolYearLabel: formatCertSchoolYear(),
    });
}

function resolveCertAssets(model, student) {
    const emblem = student.guildId ? getGuildEmblemUrl(student.guildId) : '';
    return {
        avatar: model.avatar || '',
        guildEmblem: emblem ? new URL(emblem, document.baseURI).href : '',
        appLogo: new URL('../../assets/great-class-quest-logo.svg', import.meta.url).toString(),
    };
}

function updateCertTabs() {
    const tabs = { monthly: document.getElementById('cert-tab-monthly'), alltime: document.getElementById('cert-tab-alltime') };
    Object.entries(tabs).forEach(([scope, tab]) => {
        if (!tab) return;
        const active = scope === currentCertScope;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
        tab.onclick = () => { if (!active) handleGenerateCertificate(null, scope); };
    });
}

/** Paint #certificate-template (the print source) and mirror it, id-free, into the preview. */
function renderCertificatePage() {
    const tpl = document.getElementById('certificate-template');
    if (!tpl || !certModel) return;
    tpl.className = `gcq-cert gcq-cert--${certModel.band}`;
    tpl.setAttribute('style', certificateStyleVars(certModel));
    tpl.innerHTML = renderCertificateInner(certModel, {
        citation: getCertCitation(),
        placeholder: certGenerating ? 'The Oracle is writing…' : 'The Oracle’s citation will be inscribed here.',
        assets: certAssets,
    });
    fitCertificateText(tpl);
    renderCertificatePreview();
}

/** Shrink single-line headings (long names, long titles) until they fit their column. */
function fitCertificateText(root) {
    root.querySelectorAll('.gcq-cert__name, .gcq-cert__title').forEach((el) => {
        el.style.fontSize = '';
        let size = parseFloat(window.getComputedStyle(el).fontSize) || 0;
        const min = size * 0.5;
        while (size > min && el.scrollWidth > el.clientWidth + 1) {
            size -= 1;
            el.style.fontSize = `${size}px`;
        }
    });
}

function renderCertificatePreview() {
    const tpl = document.getElementById('certificate-template');
    const preview = document.getElementById('cert-preview');
    if (!tpl || !preview) return;
    const clone = tpl.cloneNode(true);
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
    clone.setAttribute('aria-hidden', 'true');
    preview.replaceChildren(clone);
    fitCertificatePreview();
}

function fitCertificatePreview() {
    const preview = document.getElementById('cert-preview');
    const page = preview?.firstElementChild;
    if (!preview || !page) return;
    const scale = preview.clientWidth / CERTIFICATE_WIDTH;
    if (scale > 0) page.style.transform = `scale(${scale})`;
}

function renderCertificateHonoursList(model) {
    return model.allHonours.map((h) => `
        <li>
            <span class="cert-h-icon" aria-hidden="true">${escapeHtml(h.icon)}</span>
            <span class="cert-h-text">
                <span class="cert-h-value">${escapeHtml(h.value)}</span>
                <span class="cert-h-label">${escapeHtml(h.label)}</span>
            </span>
        </li>`).join('');
}

function renderCertificateInscriptionCard() {
    const citation = getCertCitation();
    const error = certError ? `<p class="cert-inscription__error" role="alert">${escapeHtml(certError)}</p>` : '';
    if (!citation) {
        return `
            <p class="cert-card__label">The Oracle's citation</p>
            <p class="cert-inscription__intro">The Oracle reads ${escapeHtml(certModel.name.split(/\s+/)[0])}'s ${certModel.scope === 'monthly' ? 'month' : 'year'} and writes a short citation in words for the ${escapeHtml(certModel.league || 'class')} league. You can edit it before sealing.</p>
            <button id="generate-cert-btn" type="button" class="cert-btn cert-btn--oracle" ${certGenerating ? 'disabled' : ''}>
                ${certGenerating ? '<i class="fas fa-feather-alt fa-beat-fade"></i> The Oracle is writing…' : '<i class="fas fa-wand-sparkles"></i> Ask the Oracle'}
            </button>
            ${error}`;
    }
    return `
        <label class="cert-card__label" for="cert-inscription-input">The Oracle's citation</label>
        <textarea id="cert-inscription-input" class="cert-inscription__input" maxlength="${CERT_CITATION_MAX}" spellcheck="true">${escapeHtml(citation)}</textarea>
        <div class="cert-inscription__meta"><span>Edit freely; the page updates as you type.</span><span id="cert-inscription-count">${citation.length}/${CERT_CITATION_MAX}</span></div>
        <div class="cert-inscription__actions">
            <button id="generate-cert-btn" type="button" class="cert-btn cert-btn--quiet" ${certGenerating ? 'disabled' : ''}>
                ${certGenerating ? '<i class="fas fa-feather-alt fa-beat-fade"></i> Writing…' : '<i class="fas fa-rotate"></i> Write a new one'}
            </button>
        </div>
        ${error}`;
}

function renderCertificateFolio() {
    const contentEl = document.getElementById('certificate-modal-content');
    if (!contentEl || !certModel) return;
    const studentLine = document.getElementById('certificate-modal-student');
    if (studentLine) studentLine.textContent = `${certModel.name} · ${certModel.classLogo} ${certModel.className}`;

    contentEl.innerHTML = `
        <div class="cert-desk">
            <div id="cert-preview" class="cert-preview" role="img" aria-label="${escapeHtml(`Preview of ${certModel.name}'s ${certModel.title}`)}"></div>
        </div>
        <aside class="cert-scribe">
            <section class="cert-card">
                <p class="cert-card__label">Honours on the page</p>
                <ul class="cert-honours-list">${renderCertificateHonoursList(certModel)}</ul>
                <p class="cert-honours-note">${certModel.scope === 'monthly'
                    ? `Counted from ${escapeHtml(certModel.periodLabel)} only.`
                    : 'Counted across the whole school year.'}${certModel.allHonours.length > certModel.honours.length ? ' The first six are printed.' : ''}</p>
            </section>
            <section id="cert-inscription" class="cert-card cert-inscription">${renderCertificateInscriptionCard()}</section>
        </aside>`;

    wireCertificateInscription();
    renderCertificatePage();
    document.getElementById('cert-preview')?.classList.toggle('is-inscribing', certGenerating);

    certPreviewObserver?.disconnect();
    const preview = document.getElementById('cert-preview');
    if (preview && typeof ResizeObserver !== 'undefined') {
        certPreviewObserver = new ResizeObserver(() => fitCertificatePreview());
        certPreviewObserver.observe(preview);
    }
    document.getElementById('download-certificate-btn')?.classList.toggle('hidden', !getCertCitation() || certGenerating);
}

function refreshCertificateInscription() {
    const card = document.getElementById('cert-inscription');
    if (!card || !certModel) return;
    card.innerHTML = renderCertificateInscriptionCard();
    wireCertificateInscription();
    renderCertificatePage();
    document.getElementById('cert-preview')?.classList.toggle('is-inscribing', certGenerating);
    document.getElementById('download-certificate-btn')?.classList.toggle('hidden', !getCertCitation() || certGenerating);
}

function wireCertificateInscription() {
    const genBtn = document.getElementById('generate-cert-btn');
    if (genBtn) genBtn.onclick = () => executeCertificateGeneration();
    const input = document.getElementById('cert-inscription-input');
    if (!input) return;
    let frame = 0;
    input.addEventListener('input', () => {
        const value = input.value.replace(/\s+/g, ' ').trimStart();
        certCitations.set(certCitationKey(), value);
        const count = document.getElementById('cert-inscription-count');
        if (count) count.textContent = `${value.length}/${CERT_CITATION_MAX}`;
        document.getElementById('download-certificate-btn')?.classList.toggle('hidden', !value.trim());
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => renderCertificatePage());
    });
}

export async function handleGenerateCertificate(studentId, scope = 'monthly') {
    await ensureHistoryLoaded();

    if (studentId) currentCertStudentId = studentId;
    currentCertScope = scope === 'alltime' ? 'alltime' : 'monthly';

    const student = state.get('allStudents').find(s => s.id === currentCertStudentId);
    const studentClass = state.get('allSchoolClasses').find(c => c.id === student?.classId);
    if (!student || !studentClass) return;

    const token = ++certRenderToken;
    certError = '';
    certGenerating = false;
    updateCertTabs();

    const modal = document.getElementById('certificate-modal');
    const contentEl = document.getElementById('certificate-modal-content');
    const downloadBtn = document.getElementById('download-certificate-btn');
    downloadBtn?.classList.add('hidden');
    if (contentEl && (!certModel || studentId)) {
        contentEl.innerHTML = `
            <div class="cert-desk" style="grid-column:1/-1;min-height:240px;">
                <p class="cert-folio__student"><i class="fas fa-feather-alt fa-beat-fade"></i> Gathering ${escapeHtml(student.name.split(/\s+/)[0])}'s deeds…</p>
            </div>`;
    }
    if (modal?.classList.contains('hidden')) showAnimatedModal('certificate-modal');

    const model = await buildCurrentCertificateModel(student, studentClass);
    if (token !== certRenderToken) return;
    certModel = model;
    certAssets = resolveCertAssets(model, student);
    renderCertificateFolio();
    if (contentEl) contentEl.scrollTop = 0;
}

export async function executeCertificateGeneration() {
    if (!requireEliteAI({ feature: 'Certificate text' })) return;
    if (!certModel || certGenerating) return;

    const token = certRenderToken;
    const key = certCitationKey();
    certGenerating = true;
    certError = '';
    refreshCertificateInscription();

    try {
        const { system, user } = buildCertificatePrompt(certModel);
        const text = cleanCitation(await callGeminiApi(system, user), CERT_CITATION_MAX);
        if (!text) throw new Error('Empty citation');
        certCitations.set(key, text);
    } catch (error) {
        console.error("AI Certificate Generation Error:", error);
        certError = 'The Oracle could not write the citation just now. Please try again.';
    } finally {
        certGenerating = false;
        if (token === certRenderToken) refreshCertificateInscription();
    }
}

function certFileName(model) {
    const safe = (value) => String(value || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/[^A-Za-z0-9Ͱ-ϿЀ-ӿ]+/g, '_').replace(/^_+|_+$/g, '');
    const suffix = model.scope === 'monthly' ? `Monthly_Quest_${model.periodLabel}` : `Legends_Journey_${model.periodLabel}`;
    return `${safe(model.name) || 'Hero'}_${safe(suffix)}.pdf`;
}

async function waitForCertificateFonts() {
    if (!document.fonts?.load) return;
    const faces = [
        '700 42px "Cinzel Decorative"', '700 20px "Cinzel"', 'italic 400 17px "Lora"', 'italic 700 19px "Lora"',
        '400 17px "Lora"', '400 40px "Fredoka One"', '700 11px "Open Sans"', '600 11px "Open Sans"',
    ];
    await withTimeout(Promise.all(faces.map((f) => document.fonts.load(f).catch(() => null))), 4000, null);
    await withTimeout(document.fonts.ready, 2000, null);
}

export async function downloadCertificateAsPdf() {
    const btn = document.getElementById('download-certificate-btn');
    if (!certModel || !btn) return;
    const citation = getCertCitation().trim();
    if (!citation) {
        showToast('Ask the Oracle for a citation first.', 'info');
        return;
    }
    const idleLabel = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Sealing the certificate…`;

    let captureHost = null;
    try {
        // Make sure the print source carries the final (possibly edited) citation.
        certCitations.set(certCitationKey(), citation);
        renderCertificatePage();

        const [{ html2canvas, jsPDF }] = await Promise.all([loadPdfTools(), waitForCertificateFonts()]);
        const certificateElement = document.getElementById('certificate-template');

        const waitForImageReady = (imgEl) => new Promise((resolve) => {
            if (!imgEl || !imgEl.src || imgEl.style.display === 'none') return resolve();
            if (imgEl.complete && imgEl.naturalWidth > 0) return resolve();
            const done = () => resolve();
            imgEl.addEventListener('load', done, { once: true });
            imgEl.addEventListener('error', done, { once: true });
            window.setTimeout(done, 4000);
        });

        const loadImageElement = (src) => new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (err) => reject(err);
            img.src = src;
        });

        const blobToDataURL = (blob) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

        // Robust Image-to-DataURL conversion (Firebase Storage goes through the worker proxy).
        const toDataURL = async (url) => {
            if (!url) return '';
            if (url.startsWith('data:')) return url;
            const isFirebaseStorageUrl = url.startsWith('gs://') || url.includes('firebasestorage.googleapis.com');
            if (isFirebaseStorageUrl && constants.certificateImageProxyUrl) {
                const workerProxyUrl = `${constants.certificateImageProxyUrl}/storage-proxy?url=${encodeURIComponent(url)}`;
                try {
                    const [idToken, appCheckHeaders] = await Promise.all([
                        auth?.currentUser?.getIdToken?.().catch(() => ''),
                        import('../../firebaseAppCheck.js')
                            .then(({ getAppCheckHeader }) => getAppCheckHeader())
                            .catch(() => ({}))
                    ]);
                    const proxiedResponse = await fetch(workerProxyUrl, {
                        headers: idToken ? { 'x-firebase-token': idToken, ...appCheckHeaders } : {},
                    });
                    if (!proxiedResponse.ok) throw new Error(`Proxy status ${proxiedResponse.status}`);
                    return await blobToDataURL(await proxiedResponse.blob());
                } catch (proxyError) {
                    console.warn('Worker storage proxy unavailable for image URL:', url, proxyError);
                    return url;
                }
            }
            try {
                const response = await fetch(new URL(url, window.location.href).toString());
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return await blobToDataURL(await response.blob());
            } catch (e) {
                console.warn("Could not convert image to DataURL:", url, e);
                return url;
            }
        };

        // Re-draw an image the way CSS shows it (circle crop, cover or contain) for the PDF stamp.
        const toStampPng = async (src, fit, boxW, boxH) => {
            try {
                const loaded = await loadImageElement(await toDataURL(src));
                const sw = Math.max(1, loaded.naturalWidth || loaded.width || 1);
                const sh = Math.max(1, loaded.naturalHeight || loaded.height || 1);
                const px = 4; // stamp at 4× CSS px for crisp print
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(boxW * px));
                canvas.height = Math.max(1, Math.round(boxH * px));
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                if (fit === 'contain') {
                    const s = Math.min(canvas.width / sw, canvas.height / sh);
                    const w = sw * s, h = sh * s;
                    ctx.drawImage(loaded, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
                } else {
                    if (fit === 'circle') {
                        ctx.beginPath();
                        ctx.arc(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) / 2, 0, Math.PI * 2);
                        ctx.closePath();
                        ctx.clip();
                    }
                    const s = Math.max(canvas.width / sw, canvas.height / sh);
                    const w = sw * s, h = sh * s;
                    ctx.drawImage(loaded, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
                }
                return canvas.toDataURL('image/png');
            } catch (_) {
                return '';
            }
        };

        // Render from a detached clone so the live preview never flickers.
        captureHost = document.createElement('div');
        Object.assign(captureHost.style, {
            position: 'fixed', left: '-12000px', top: '0', width: `${CERTIFICATE_WIDTH}px`, height: `${CERTIFICATE_HEIGHT}px`,
            overflow: 'hidden', pointerEvents: 'none', zIndex: '-1',
        });
        const captureTemplate = certificateElement.cloneNode(true);
        captureTemplate.removeAttribute('id');
        captureHost.appendChild(captureTemplate);
        document.body.appendChild(captureHost);

        const imageNodes = [...captureTemplate.querySelectorAll('img')].filter((img) => img.getAttribute('src') && img.style.display !== 'none');
        await Promise.all(imageNodes.map(async (img) => {
            img.loading = 'eager';
            img.decoding = 'sync';
            if (!img.src.startsWith('data:')) img.src = await toDataURL(img.src);
        }));
        await Promise.all(imageNodes.map(waitForImageReady));

        const canvas = await html2canvas(captureTemplate, {
            scale: 2.5,
            useCORS: true,
            allowTaint: false,
            logging: false,
            imageTimeout: 20000,
            backgroundColor: certModel.palette.paper,
            width: CERTIFICATE_WIDTH,
            height: CERTIFICATE_HEIGHT,
        });

        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageW, pageH);

        // Stamp the pictures on top at full resolution, in case html2canvas dropped a cross-origin one.
        const certRect = captureTemplate.getBoundingClientRect();
        const mmX = pageW / (certRect.width || CERTIFICATE_WIDTH);
        const mmY = pageH / (certRect.height || CERTIFICATE_HEIGHT);
        for (const el of captureTemplate.querySelectorAll('img[data-cert-stamp]')) {
            if (!el.src || el.style.display === 'none') continue;
            const cs = window.getComputedStyle(el);
            const inset = (side) => (parseFloat(cs[`border${side}Width`]) || 0) + (parseFloat(cs[`padding${side}`]) || 0);
            const box = el.getBoundingClientRect();
            const x = box.left + inset('Left') - certRect.left;
            const y = box.top + inset('Top') - certRect.top;
            const w = box.width - inset('Left') - inset('Right');
            const h = box.height - inset('Top') - inset('Bottom');
            if (w <= 0 || h <= 0) continue;
            const png = await toStampPng(el.src, el.dataset.certStamp, w, h);
            if (!png) continue;
            try {
                pdf.addImage(png, 'PNG', x * mmX, y * mmY, w * mmX, h * mmY);
            } catch (_) {
                // A failed stamp still leaves html2canvas's own drawing underneath.
            }
        }

        pdf.setProperties({
            title: `${certModel.name}: ${certModel.title}`,
            subject: `${certModel.eyebrow} · ${certModel.periodLabel}`,
            author: certModel.teacherName || 'The Great Class Quest',
            creator: 'The Great Class Quest',
        });
        pdf.save(certFileName(certModel));
    } catch (error) {
        console.error("Error generating PDF:", error);
        showToast('Could not generate PDF.', 'error');
    } finally {
        if (captureHost && captureHost.parentNode) captureHost.parentNode.removeChild(captureHost);
        btn.disabled = false;
        btn.innerHTML = idleLabel.includes('fa-spinner') ? `<i class="fas fa-stamp"></i> Seal &amp; Download PDF` : idleLabel;
    }
}
