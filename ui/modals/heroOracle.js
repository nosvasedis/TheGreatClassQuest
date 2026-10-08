// /ui/modals/heroOracle.js
// The Oracle page of the Hero's Chronicle.
//
//   Reading    opens first, free and instant: what the notes say about this child, read on
//              this computer (features/chronicleReadingCore.mjs): threads to pick up, bright
//              spots, what was tried and whether it helped, background to handle with care,
//              notes against numbers, classmates and passions, and what the notes miss.
//   Counsels   Elite AI (Teaching Plan, Deep Reading, Hero's Goal, Parent Summary): each reads
//              the teacher's own notes plus that reading, and cites the notes it rests on.
//              Answers are kept in daily_cache/oracle_<teacher>_<student>_<counsel> with a
//              fingerprint of the records, so every computer opens the same page without a new
//              AI call; only "Write a fresh counsel" asks again.
//   Ask        a free question about the child, answered from the same brief.
//
// Markup: templates/modals/hero.js (#hero-chronicle-content-oracle) · styles: styles/hero_oracle.css

import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { db, doc, getDoc, setDoc } from '../../firebase.js';
import { dataPath } from '../../utils/tenant.mjs';
import { callGeminiApi } from '../../api.js';
import { getQuestLeagueDefinition } from '../../constants.js';
import { getClassAssessmentUsage, getNormalizedPercentForScore } from '../../features/assessmentConfig.js';
import { TRIAL_TYPE_GUIDE, normalizeTrialType } from '../../features/trialTypesCore.mjs';
import { buildFolio, oracleMarkdown } from '../../features/scholarFolioCore.mjs';
import { esc } from '../../features/scholarScrollCore.mjs';
import { noteTheme } from '../../features/classGreenhouseNotes.mjs';
import { buildChronicleReading, oracleBrief, readingFingerprint, readOracleNote, themeMeta, TREND_LABEL } from '../../features/chronicleReadingCore.mjs';
import { ORACLE_COUNSELS, ORACLE_PARENT_PROMPT, ORACLE_SYSTEM_PROMPT, getCounsel, questionTask } from '../../features/heroOracleCounsels.mjs';
import { canUseFeature } from '../../utils/subscription.js';
import { requireEliteAI } from '../../utils/upgradePrompt.js';
import { publishParentSummary as publishParentSummaryToRuntime } from '../../utils/adminRuntime.js';
import { showToast } from '../effects.js';
import '../../styles/hero_oracle.css';

const OUTPUT_ID = 'hero-chronicle-ai-output';
const PROMPT_VERSION = 'oracle-v2';
const VIRTUE_IDS = ['teamwork', 'creativity', 'respect', 'focus'];
const OUTCOME = {
    helping: { label: 'Seems to help', tone: 'good', icon: 'fa-seedling' },
    'not-yet': { label: 'Not yet', tone: 'worry', icon: 'fa-hourglass-half' },
    unclear: { label: 'Mixed so far', tone: 'mixed', icon: 'fa-scale-balanced' },
    'no-word-yet': { label: 'No later note', tone: 'quiet', icon: 'fa-feather' }
};
const CROSS = {
    agree: { icon: 'fa-link', label: 'Notes and numbers agree' },
    disagree: { icon: 'fa-code-compare', label: 'Notes and numbers disagree' },
    unseen: { icon: 'fa-eye-slash', label: 'In the numbers, not in the notes' },
    quiet: { icon: 'fa-hourglass-end', label: 'The chronicle has gone quiet' }
};

const view = {
    studentId: null,
    model: null,       // { student, first, reading, fingerprint, league, ageGroup, heroClass, oaths }
    showing: 'reading',
    busy: false,
    answers: new Map() // studentId → [{ question, text }]
};

const $ = (id) => document.getElementById(id);
const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'This hero';

function findClass(classId) {
    return (state.get('allSchoolClasses') || []).find((c) => c.id === classId)
        || (state.get('allTeachersClasses') || []).find((c) => c.id === classId)
        || null;
}

const timeOf = (value) => {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    if (Number.isFinite(value?.seconds)) return value.seconds * 1000;
    return null;
};

// ------------------------------------------------------------------ the records

/** Papers, stars and attendance for one child, in the shape the reading expects. */
function collectNumbers(student, classmates) {
    const numbers = { trials: null, stars: null, absences30: 0, missedPapers: 0 };
    const monthAgo = Date.now() - 30 * 86400000;
    try {
        const classData = findClass(student.classId);
        const usage = getClassAssessmentUsage(classData);
        const entries = [];
        (state.get('allWrittenScores') || []).forEach((s) => {
            if (s.classId !== student.classId || (s.type !== 'test' && s.type !== 'dictation')) return;
            const date = utils.parseFlexibleDate(s.date);
            const pct = getNormalizedPercentForScore(s, classData);
            if (!date || !Number.isFinite(pct)) return;
            entries.push({ id: s.id, studentId: s.studentId, type: normalizeTrialType(s.type), title: String(s.title || '').trim(), date: s.date, time: date.getTime(), pct });
        });
        const absenceDates = (state.get('allAttendanceRecords') || [])
            .filter((r) => r.studentId === student.id && r.classId === student.classId)
            .map((r) => r.date)
            .filter((d) => (utils.parseFlexibleDate(d)?.getTime() || 0) >= monthAgo);
        const folio = buildFolio({
            studentId: student.id,
            firstName: firstName(student.name),
            classStudentIds: classmates.map((s) => s.id).concat(student.id),
            entries,
            usage,
            joinedAt: timeOf(student.createdAt),
            absenceDates
        });
        numbers.absences30 = folio.absences.length;
        numbers.missedPapers = folio.missed.length;
        if (folio.counts.all) {
            numbers.trials = {
                count: folio.counts.all,
                avg: folio.avg.overall, classAvg: folio.classAvg.overall,
                testAvg: folio.avg.test, classTestAvg: folio.classAvg.test,
                dictAvg: folio.avg.dictation, classDictAvg: folio.classAvg.dictation,
                momentum: folio.momentum,
                recent: folio.trials.slice(-4).map((t) => `${t.name} ${Math.round(t.pct)}%${Number.isFinite(t.classAvg) ? ` (class ${Math.round(t.classAvg)}%)` : ''}`)
            };
        }
    } catch (error) {
        console.warn('Oracle: papers could not be read', error);
    }
    const logs = (state.get('allAwardLogs') || []).filter((l) => l.studentId === student.id);
    if (logs.length) {
        const byVirtue = Object.fromEntries(VIRTUE_IDS.map((v) => [v, 0]));
        let total = 0;
        let recent30 = 0;
        logs.forEach((l) => {
            const stars = Number(l.stars) || 0;
            if (stars <= 0) return;
            total += stars;
            if (VIRTUE_IDS.includes(l.reason)) byVirtue[l.reason] += stars;
            if ((utils.parseFlexibleDate(l.date)?.getTime() || 0) >= monthAgo) recent30 += stars;
        });
        const recentNotes = logs
            .filter((l) => String(l.note || '').trim() && VIRTUE_IDS.includes(l.reason))
            .sort((a, b) => (utils.parseFlexibleDate(b.date)?.getTime() || 0) - (utils.parseFlexibleDate(a.date)?.getTime() || 0))
            .slice(0, 5)
            .map((l) => `${l.reason}: ${String(l.note).trim().slice(0, 90)}`);
        numbers.stars = { total, recent30, byVirtue, recentNotes };
    }
    return numbers;
}

let oathsPromise = null;
async function oathsFor(studentId) {
    if (!canUseFeature('heroCampfire')) return [];
    try {
        let all = state.get('allEmberOaths');
        if (!Array.isArray(all) || !all.length) {
            oathsPromise = oathsPromise || import('../../db/actions/emberOaths.js').then((m) => m.loadEmberOaths());
            all = await oathsPromise;
        }
        return (all || []).filter((o) => o.studentId === studentId);
    } catch {
        return [];
    }
}

function buildModel(studentId, oaths = []) {
    const students = state.get('allStudents') || [];
    const student = students.find((s) => s.id === studentId);
    if (!student) return null;
    const classmates = students.filter((s) => s.classId === student.classId && s.id !== studentId);
    const notes = (state.get('allHeroChronicleNotes') || []).filter((n) => n.studentId === studentId);
    const first = firstName(student.name);
    const numbers = collectNumbers(student, classmates);
    const reading = buildChronicleReading({ notes, firstName: first, classmates, numbers });
    const classData = findClass(student.classId);
    const league = classData?.questLevel || '';
    const oathKey = oaths.map((o) => `${o.id}:${o.status}`).join(',');
    return {
        student,
        first,
        reading,
        oaths,
        league,
        ageGroup: getQuestLeagueDefinition(league)?.ageGroup || '',
        heroClass: student.heroClass || '',
        fingerprint: readingFingerprint(reading, `${PROMPT_VERSION}|${oathKey}`)
    };
}

// ------------------------------------------------------------------ the reading page

const pill = (trend) => `<span class="hco-pill hco-pill--${trend}">${esc(TREND_LABEL[trend] || trend)}</span>`;
const cite = (reading, ref) => {
    const note = reading.notes.find((n) => n.ref === ref);
    if (!note) return '';
    const when = note.time ? new Date(note.time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
    return `<button type="button" class="hco-cite" data-note-id="${esc(note.id || '')}" title="${esc(`${when} · ${note.text.slice(0, 160)}`)}">${esc(ref)}</button>`;
};
const quote = (reading, mention) => `<blockquote class="hco-quote">“${esc(mention.quote)}” ${cite(reading, mention.ref)}</blockquote>`;

function threadHtml(reading, t, tone) {
    const latest = t.mentions[t.mentions.length - 1];
    const meta = noteTheme(t.id);
    const move = tone !== 'good' && typeof meta?.action === 'function' ? meta.action(reading.firstName) : '';
    return `
        <li class="hco-thread hco-thread--${tone}">
            <span class="hco-thread__icon" aria-hidden="true"><i class="fas ${esc(t.icon)}"></i></span>
            <div class="hco-thread__body">
                <p class="hco-thread__head"><b>${esc(t.label)}</b>${pill(t.trend)}<span class="hco-thread__count">${t.count} note${t.count === 1 ? '' : 's'}</span></p>
                ${quote(reading, latest)}
                ${t.count > 1 && t.mentions[0].ref !== latest.ref ? `<p class="hco-thread__first">First written ${esc(new Date(t.firstTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))}: “${esc(t.mentions[0].quote)}” ${cite(reading, t.mentions[0].ref)}</p>` : ''}
                ${move ? `<p class="hco-thread__move"><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> ${esc(move)}</p>` : ''}
            </div>
        </li>`;
}

function section(title, icon, body, extraClass = '') {
    return `<section class="hco-sec ${extraClass}"><h4 class="hco-sec__title font-title"><i class="fas ${icon}" aria-hidden="true"></i> ${title}</h4>${body}</section>`;
}

function readingHtml(model) {
    const { reading } = model;
    const n = reading.firstName;
    const spanText = reading.span ? `${new Date(reading.span.from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} to ${new Date(reading.span.to).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : '';
    const lastText = reading.daysSinceNote == null ? '' : reading.daysSinceNote === 0 ? 'last note today' : reading.daysSinceNote === 1 ? 'last note yesterday' : `last note ${reading.daysSinceNote} days ago`;
    const toneTotal = Math.max(1, reading.tone.good + reading.tone.worry + reading.tone.mixed + reading.tone.neutral);
    const toneBar = reading.writtenCount ? `
        <div class="hco-tone" role="img" aria-label="${reading.tone.good} encouraging notes, ${reading.tone.worry} worried, ${reading.tone.mixed} mixed, ${reading.tone.neutral} plain">
            ${['good', 'mixed', 'worry', 'neutral'].map((k) => reading.tone[k] ? `<span class="hco-tone__part hco-tone__part--${k}" style="flex:${reading.tone[k] / toneTotal}"></span>` : '').join('')}
        </div>
        <p class="hco-tone__legend"><span class="is-good">${reading.tone.good} encouraging</span><span class="is-mixed">${reading.tone.mixed} mixed</span><span class="is-worry">${reading.tone.worry} worried</span></p>` : '';

    const parts = [];
    parts.push(`
        <header class="hco-lede">
            <p class="hco-kicker"><i class="fas fa-eye" aria-hidden="true"></i> The Oracle's reading of your notes</p>
            <p class="hco-headline">${esc(reading.headline)}</p>
            ${reading.noteCount ? `<p class="hco-meta">${reading.noteCount} note${reading.noteCount === 1 ? '' : 's'}${spanText ? ` · ${esc(spanText)}` : ''}${lastText ? ` · ${esc(lastText)}` : ''}</p>` : ''}
            ${toneBar}
        </header>`);

    if (reading.balance === 'only-worries') parts.push(`<p class="hco-nudge"><i class="fas fa-scale-unbalanced" aria-hidden="true"></i> So far the notes hold only worries. Write down one thing ${esc(n)} did well this week: the counsels build their plans on strengths.</p>`);
    if (reading.balance === 'only-praise') parts.push(`<p class="hco-nudge"><i class="fas fa-scale-unbalanced-flip" aria-hidden="true"></i> So far the notes hold only praise. If something is hard for ${esc(n)}, a line about it lets the counsels plan the next step.</p>`);

    const open = reading.openThreads.filter((t) => t.kind !== 'context');
    if (open.length) parts.push(section('Threads to pick up', 'fa-thread', `<ul class="hco-threads">${open.slice(0, 4).map((t) => threadHtml(reading, t, 'worry')).join('')}</ul>`));
    if (reading.brightSpots.length) parts.push(section('Bright spots', 'fa-sun', `<ul class="hco-threads">${reading.brightSpots.slice(0, 3).map((t) => threadHtml(reading, t, 'good')).join('')}</ul>`));
    if (reading.background.length) {
        parts.push(section('Handle with care', 'fa-hand-holding-heart', `
            <p class="hco-sec__hint">Background you wrote for yourself. The Parent Summary never mentions it.</p>
            <ul class="hco-threads">${reading.background.map((t) => threadHtml(reading, t, 'care')).join('')}</ul>`, 'hco-sec--care'));
    }
    if (reading.tried.length) {
        parts.push(section('What you have tried', 'fa-flask', `<ul class="hco-tried">${reading.tried.slice(-5).reverse().map((t) => {
            const o = OUTCOME[t.outcome];
            return `<li class="hco-tried__item"><p>“${esc(t.text)}” ${cite(reading, t.ref)}</p><span class="hco-outcome hco-outcome--${o.tone}"><i class="fas ${o.icon}" aria-hidden="true"></i> ${o.label}${t.followedBy.length ? ` · ${t.followedBy.slice(-3).map((r) => cite(reading, r)).join(' ')}` : ''}</span></li>`;
        }).join('')}</ul>`));
    }
    if (reading.cross.length) {
        parts.push(section('Notes and numbers', 'fa-chart-line', `<ul class="hco-cross">${reading.cross.map((c) => `<li class="hco-cross__item hco-cross__item--${c.kind}"><i class="fas ${CROSS[c.kind]?.icon || 'fa-circle-info'}" aria-hidden="true" title="${esc(CROSS[c.kind]?.label || '')}"></i><span>${esc(c.text)}</span></li>`).join('')}</ul>`));
    }
    if (reading.people.length || reading.passions.length) {
        const people = reading.people.slice(0, 5).map((p) => {
            const kind = p.friction > p.warm ? 'friction' : p.warm ? 'warm' : 'plain';
            const label = kind === 'friction' ? 'friction' : kind === 'warm' ? 'works well together' : 'named together';
            return `<span class="hco-chip hco-chip--${kind}"><i class="fas ${kind === 'friction' ? 'fa-people-arrows' : 'fa-user-group'}" aria-hidden="true"></i> ${esc(p.first)} <small>${label}</small></span>`;
        }).join('');
        const passions = reading.passions.map((p) => `<span class="hco-chip hco-chip--passion" title="${esc((p.words || []).slice(0, 6).join(', '))}"><span aria-hidden="true">${p.icon}</span> ${esc(p.label)}</span>`).join('');
        parts.push(section('Classmates and passions', 'fa-heart', `<div class="hco-chips">${people}${passions}</div>${passions ? `<p class="hco-sec__hint">Passions make good lesson hooks: a sentence frame, a reading text or a speaking task about them.</p>` : ''}`));
    }
    if (reading.keptOaths.length) {
        parts.push(section('Promises kept', 'fa-fire-flame-curved', `<ul class="hco-oaths">${reading.keptOaths.slice(-3).reverse().map((o) => `<li>${esc(o.text.replace(/^Kept (?:a promise|[^:]+): /, ''))}</li>`).join('')}</ul>`));
    }
    if (reading.gaps.length) {
        parts.push(section('Not in your notes yet', 'fa-circle-question', `
            <p class="hco-sec__hint">A full picture of an English learner covers these too. Tap one to write about it.</p>
            <div class="hco-gaps">${reading.gaps.map((g) => `<button type="button" class="hco-gap" data-gap-ask="${esc(g.ask)}"><b>${esc(g.label)}</b><span>${esc(g.ask)}</span></button>`).join('')}</div>`));
    }
    if (reading.themes.length > 2) {
        parts.push(section('Every theme in the notes', 'fa-tags', `<div class="hco-chips">${reading.themes.map((t) => {
            const tone = t.kind === 'context' ? 'care' : t.lastTone === 'worry' ? 'worry' : 'good';
            return `<span class="hco-chip hco-chip--${tone}" title="${esc(TREND_LABEL[t.trend] || '')}"><i class="fas ${esc(t.icon)}" aria-hidden="true"></i> ${esc(t.label)} <small>${t.count}</small></span>`;
        }).join('')}</div>`));
    }

    const elite = canUseFeature('eliteAI');
    parts.push(`<p class="hco-foot"><i class="fas fa-laptop" aria-hidden="true"></i> Read on this computer from your notes, papers and stars; no AI was used for this page.${elite ? ' Choose a counsel for a full plan built on it.' : ''}</p>`);
    const answers = view.answers.get(model.student.id) || [];
    if (answers.length) parts.push(section('Your questions', 'fa-comments', answers.map((a) => answerBlock(model, a.question, a.text)).join(''), 'hco-sec--asked'));
    return `<div class="hco-reading">${parts.join('')}</div>`;
}

function answerBlock(model, question, text) {
    return `<article class="hco-asked"><p class="hco-asked__q"><i class="fas fa-circle-question" aria-hidden="true"></i> ${esc(question)}</p><div class="hco-answer__text">${answerMarkup(model, text)}</div></article>`;
}

/** Markdown with every [N3] turned into a chip that opens the note it cites. */
function answerMarkup(model, text) {
    const html = oracleMarkdown(text);
    return html.replace(/\[((?:N\d+)(?:\s*[,;]\s*N\d+)*)\]/g, (_, refs) => refs.split(/\s*[,;]\s*/).map((ref) => cite(model.reading, ref) || esc(ref)).join(''));
}

export function renderOracleReading(studentId) {
    const out = $(OUTPUT_ID);
    if (!out) return;
    bindOracle();
    view.studentId = studentId;
    view.showing = 'reading';
    view.model = buildModel(studentId, view.model?.student?.id === studentId ? view.model.oaths : []);
    if (!view.model) return;
    out.dataset.view = 'reading';
    out.innerHTML = readingHtml(view.model);
    markChosen(null);
    // Oaths arrive a moment later; they only change the fingerprint and the AI brief.
    oathsFor(studentId).then((oaths) => {
        if (view.studentId !== studentId || !oaths.length || view.model?.oaths?.length) return;
        view.model = buildModel(studentId, oaths);
    });
}

/** Called when the notes change: keeps an open reading page up to date. */
export function refreshOracleReading(studentId) {
    const out = $(OUTPUT_ID);
    if (!out || view.studentId !== studentId || out.dataset.view !== 'reading' || view.busy) return;
    const scroll = out.scrollTop;
    renderOracleReading(studentId);
    out.scrollTop = scroll;
}

function markChosen(counselId) {
    document.querySelectorAll('#hero-chronicle-content-oracle .ai-insight-btn').forEach((btn) => {
        btn.classList.toggle('is-chosen', btn.dataset.type === counselId);
    });
}

// ------------------------------------------------------------------ counsels

function counselRef(studentId, counselId) {
    const teacher = state.get('currentUserId') || 'teacher';
    return doc(db, dataPath('daily_cache'), `oracle_${teacher}_${studentId}_${counselId}`);
}

function thinking(text) {
    const out = $(OUTPUT_ID);
    if (!out) return;
    out.dataset.view = 'thinking';
    out.innerHTML = `<div class="hc-oracle-empty is-thinking"><span class="hc-orb" aria-hidden="true"></span><p>${esc(text)}</p></div>`;
}

function failed(text) {
    const out = $(OUTPUT_ID);
    if (!out) return;
    out.dataset.view = 'error';
    out.innerHTML = `
        <div class="hc-oracle-empty is-error">
            <i class="fas fa-cloud-bolt" aria-hidden="true"></i>
            <p>${esc(text)}</p>
            <button type="button" class="hc-ghost-btn" data-oracle-back>Back to the reading</button>
        </div>`;
}

async function writeCounsel(model, counsel) {
    const brief = oracleBrief(model.reading, {
        audience: counsel.audience || 'teacher',
        league: model.league,
        ageGroup: model.ageGroup,
        heroClass: model.heroClass,
        oaths: model.oaths
    });
    const system = counsel.audience === 'parent' ? ORACLE_PARENT_PROMPT : `${ORACLE_SYSTEM_PROMPT}\n\n${TRIAL_TYPE_GUIDE}`;
    const content = String(await callGeminiApi(
        system,
        `Here is ${model.first}'s record.\n\n${brief}\n\n---\n${counsel.task(model.first)}`,
        { maxTokens: counsel.maxTokens || 1000, timeoutMs: 60000 }
    ) || '').trim();
    if (!content) throw new Error('The Oracle returned an empty page.');
    return content;
}

/** Opens a counsel: the stored page when there is one, otherwise a new one (shared by every computer). */
async function getCounselPage(studentId, counselId, { fresh = false } = {}) {
    const counsel = getCounsel(counselId);
    const model = buildModel(studentId, await oathsFor(studentId));
    if (!counsel || !model) throw new Error('This hero could not be found.');
    view.model = model;
    const ref = counselRef(studentId, counselId);
    if (!fresh) {
        const snap = await getDoc(ref).catch(() => null);
        const data = snap?.exists?.() ? snap.data() : null;
        if (data?.content) return { content: data.content, createdAt: data.createdAt, noteCount: data.noteCount, stale: data.fingerprint !== model.fingerprint, counsel, model };
    }
    const content = await writeCounsel(model, counsel);
    const createdAt = Date.now();
    await setDoc(ref, {
        type: 'hero_oracle', studentId, counsel: counselId, content, fingerprint: model.fingerprint, createdAt,
        noteCount: model.reading.noteCount, teacherId: state.get('currentUserId') || ''
    }).catch((e) => console.warn('Oracle page could not be shared:', e?.message));
    return { content, createdAt, noteCount: model.reading.noteCount, stale: false, counsel, model };
}

function showCounselPage(page) {
    const out = $(OUTPUT_ID);
    if (!out) return;
    const { counsel, model } = page;
    const when = page.createdAt ? new Date(page.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : '';
    out.dataset.view = 'answer';
    view.showing = counsel.id;
    out.innerHTML = `
        <article class="hco-answer">
            <div class="hco-answer__bar">
                <button type="button" class="hco-back" data-oracle-back><i class="fas fa-arrow-left" aria-hidden="true"></i> The reading</button>
                <p class="hco-answer__dateline"><span aria-hidden="true">${counsel.glyph}</span> ${esc(counsel.label)}${when ? ` · written ${esc(when)}` : ''}${page.noteCount ? ` · from ${page.noteCount} note${page.noteCount === 1 ? '' : 's'}` : ''}</p>
            </div>
            ${page.stale ? `
                <div class="hco-stale">
                    <p><i class="fas fa-feather-pointed" aria-hidden="true"></i> New notes or results have come in since this page was written.</p>
                    <button type="button" class="hco-fresh" data-oracle-fresh="${counsel.id}"><i class="fas fa-rotate" aria-hidden="true"></i> Write a fresh ${esc(counsel.label.toLowerCase())}</button>
                </div>` : ''}
            <div class="hco-answer__text">${answerMarkup(model, page.content)}</div>
            ${counsel.id === 'parent' ? '<p class="hco-answer__note">Not sent anywhere yet. "Publish to Parent Portal" sends this summary to the family.</p>' : ''}
        </article>`;
    out.scrollTop = 0;
}

export async function askOracleCounsel(studentId, counselId, { fresh = false } = {}) {
    if (!requireEliteAI({ feature: 'The Oracle' })) return;
    if (view.busy) return;
    const counsel = getCounsel(counselId);
    if (!counsel) return;
    view.busy = true;
    markChosen(counselId);
    thinking(fresh ? `Writing a fresh ${counsel.label.toLowerCase()}…` : 'The Oracle is reading your notes…');
    $(OUTPUT_ID)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    try {
        const page = await getCounselPage(studentId, counselId, { fresh });
        if (view.studentId === studentId) showCounselPage(page);
    } catch (error) {
        console.error('Oracle counsel error:', error);
        if (view.studentId === studentId) failed('The Oracle could not write this counsel right now. Try again in a little while.');
    } finally {
        view.busy = false;
    }
}

export async function askOracleQuestion(studentId, question) {
    const q = String(question || '').trim();
    if (!q) return;
    if (!requireEliteAI({ feature: 'The Oracle' })) return;
    if (view.busy) return;
    view.busy = true;
    markChosen(null);
    thinking('The Oracle is thinking about your question…');
    try {
        const model = buildModel(studentId, await oathsFor(studentId));
        if (!model) throw new Error('missing student');
        const brief = oracleBrief(model.reading, { league: model.league, ageGroup: model.ageGroup, heroClass: model.heroClass, oaths: model.oaths });
        const text = String(await callGeminiApi(
            `${ORACLE_SYSTEM_PROMPT}\n\n${TRIAL_TYPE_GUIDE}`,
            `Here is ${model.first}'s record.\n\n${brief}\n\n---\n${questionTask(model.first, q)}`,
            { maxTokens: 800, timeoutMs: 45000 }
        ) || '').trim();
        const list = view.answers.get(studentId) || [];
        list.unshift({ question: q, text: text || 'The Oracle had nothing to say. Try asking another way.' });
        view.answers.set(studentId, list.slice(0, 6));
        const input = $('hero-chronicle-ask-input');
        if (input) input.value = '';
        view.busy = false;
        if (view.studentId === studentId) {
            renderOracleReading(studentId);
            document.querySelector(`#${OUTPUT_ID} .hco-sec--asked`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
    } catch (error) {
        console.error('Oracle question error:', error);
        view.busy = false;
        if (view.studentId === studentId) failed('The Oracle could not answer just now. Try again in a moment.');
    }
}

/** The portal and the parent's message show plain text: headings become lines, bullets dots. */
function plainForFamilies(markdown) {
    return String(markdown || '')
        .replace(/\r/g, '')
        .split('\n')
        .map((line) => line
            .replace(/^\s*#{1,6}\s*(.+)$/, '$1')
            .replace(/^\s*[-*•]\s+/, '• ')
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1$2')
            .trimEnd())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export async function publishOracleParentSummary(studentId) {
    if (!requireEliteAI({ feature: 'The Oracle' })) return;
    if (view.busy) return;
    const publishBtn = $('hero-chronicle-publish-parent-btn');
    const publishBtnHtml = publishBtn?.innerHTML;
    if (publishBtn) {
        publishBtn.disabled = true;
        publishBtn.innerHTML = '<span class="hc-publish__icon" aria-hidden="true"><i class="fas fa-spinner fa-spin"></i></span><span class="hc-publish__text"><span class="hc-publish__name">Publishing...</span></span>';
    }
    view.busy = true;
    markChosen('parent');
    thinking('Preparing a parent-safe summary…');
    try {
        // The stored summary is reused when nothing has changed since it was written.
        let page = await getCounselPage(studentId, 'parent');
        if (page.stale) page = await getCounselPage(studentId, 'parent', { fresh: true });
        await publishParentSummaryToRuntime({ studentId, summary: plainForFamilies(page.content) });
        if (view.studentId === studentId) {
            showCounselPage(page);
            const note = document.querySelector(`#${OUTPUT_ID} .hco-answer__note`);
            if (note) {
                note.classList.add('is-published');
                note.innerHTML = '<i class="fas fa-circle-check" aria-hidden="true"></i> Published to the Parent Portal';
            }
        }
        showToast('Parent summary published to the portal.', 'success');
    } catch (error) {
        console.error('Could not publish parent summary:', error);
        if (view.studentId === studentId) failed('The summary could not be published right now.');
        showToast(error?.message || 'Could not publish the parent summary.', 'error');
    } finally {
        view.busy = false;
        if (publishBtn) {
            publishBtn.disabled = false;
            publishBtn.innerHTML = publishBtnHtml;
        }
    }
}

// ------------------------------------------------------------------ wiring

function bindOracle() {
    const out = $(OUTPUT_ID);
    if (out && !out.dataset.oracleBound) {
        out.dataset.oracleBound = 'true';
        out.addEventListener('click', (e) => {
            const citeBtn = e.target.closest('.hco-cite');
            if (citeBtn) {
                const noteId = citeBtn.dataset.noteId;
                if (noteId) import('./hero.js').then((m) => m.showChronicleNote(noteId));
                return;
            }
            if (e.target.closest('[data-oracle-back]')) {
                if (view.studentId) renderOracleReading(view.studentId);
                return;
            }
            const fresh = e.target.closest('[data-oracle-fresh]');
            if (fresh && view.studentId) {
                askOracleCounsel(view.studentId, fresh.dataset.oracleFresh, { fresh: true });
                return;
            }
            const gap = e.target.closest('[data-gap-ask]');
            if (gap) import('./hero.js').then((m) => m.startChronicleNote({ prompt: gap.dataset.gapAsk }));
        });
    }
    const form = $('hero-chronicle-ask-form');
    if (form && !form.dataset.oracleBound) {
        form.dataset.oracleBound = 'true';
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const studentId = $('hero-chronicle-modal')?.dataset.studentId;
            if (studentId) askOracleQuestion(studentId, $('hero-chronicle-ask-input')?.value);
        });
    }
}

/** What the quill hears while the teacher writes: themes and tone, live, on this computer. */
export function quillHears(text) {
    const value = String(text || '').trim();
    if (value.length < 8) return '';
    const note = readOracleNote({ noteText: value });
    const chips = note.themes.map((t) => {
        const label = themeMeta(t.id).label;
        const tone = t.tone === 'context' ? 'care' : t.tone === 'worry' ? 'worry' : 'good';
        return `<span class="hc-hears__chip hc-hears__chip--${tone}">${esc(label)}${t.tone === 'better' ? ' ↑' : ''}</span>`;
    }).join('');
    const tip = !note.themes.length && value.length > 30
        ? 'Tip: name the skill or habit (spelling, speaking, homework…) so the Oracle can follow it.'
        : note.tone === 'worry' && !note.tried.length && value.length > 40
            ? 'Tip: add what you tried or will try, so the Oracle can tell what works.'
            : '';
    if (!chips && !tip) return '';
    return `${chips ? `<span class="hc-hears__label"><i class="fas fa-eye" aria-hidden="true"></i> The Oracle hears</span>${chips}` : ''}${tip ? `<span class="hc-hears__tip">${esc(tip)}</span>` : ''}`;
}

export { ORACLE_COUNSELS };
