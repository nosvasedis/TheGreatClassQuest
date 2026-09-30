// ui/modals/adventurersGuideView.js
// Pure markup for the Adventurer's Guide field guide. No state, DOM or Firebase imports:
// the controller (adventurersGuide.js) passes the plan and the teacher's name in.

import {
    GUIDE_CHAPTERS,
    LESSON_ROUTE,
    THREE_RACES,
    NAMES_APART,
    HEADER_KEYS,
    CLASS_DAY,
    PLAN_TIERS
} from '../../config/guide/adventurersGuide.js';

const TIER_ORDER = { starter: 0, pro: 1, elite: 2 };
const TIER_NAMES = { starter: 'Starter', pro: 'Pro', elite: 'Elite' };

export function escapeGuideHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const esc = escapeGuideHtml;

export function guideTierIncludes(planTier, requiredTier) {
    return (TIER_ORDER[planTier] ?? 0) >= (TIER_ORDER[requiredTier] ?? 0);
}

export function getGuideChapters(audience) {
    return GUIDE_CHAPTERS[audience] || GUIDE_CHAPTERS.teacher;
}

export function findGuideChapter(audience, chapterId) {
    const chapters = getGuideChapters(audience);
    return chapters.find((c) => c.id === chapterId) || chapters[0];
}

/** Plain-text search over every entry of one audience. Returns [{ chapter, entry }]. */
export function searchGuide(audience, query) {
    const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const hits = [];
    getGuideChapters(audience).forEach((chapter) => {
        (chapter.entries || []).forEach((entry) => {
            const hay = `${entry.name} ${entry.where || ''} ${entry.text} ${entry.why || ''} ${entry.keys || ''} ${chapter.title}`.toLowerCase();
            if (words.every((w) => hay.includes(w))) {
                const inName = words.every((w) => entry.name.toLowerCase().includes(w));
                hits.push({ chapter, entry, score: inName ? 0 : 1 });
            }
        });
    });
    return hits.sort((a, b) => a.score - b.score);
}

function highlight(text, query) {
    const safe = esc(text);
    const words = String(query || '').toLowerCase().split(/\s+/).filter((w) => w.length > 1);
    if (!words.length) return safe;
    const pattern = new RegExp(`(${words.map((w) => esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    return safe.replace(pattern, '<mark>$1</mark>');
}

function chapterStyle(chapter) {
    return `--ag-c:${chapter.color};`;
}

// ── Index (thumb tabs) ────────────────────────────────────────────────────

export function buildGuideIndexHtml({ audience, activeChapterId, searching = false }) {
    const chapters = getGuideChapters(audience);
    return chapters.map((chapter, i) => {
        const active = !searching && chapter.id === activeChapterId;
        const count = chapter.entries ? chapter.entries.length : 0;
        return `
        <button type="button" class="ag-tab${active ? ' is-active' : ''}" data-ag-chapter="${esc(chapter.id)}"
            style="${chapterStyle(chapter)}" ${active ? 'aria-current="page"' : ''}>
            <span class="ag-tab__thumb" aria-hidden="true"><i class="fas ${esc(chapter.icon)}"></i></span>
            <span class="ag-tab__label">${esc(chapter.title)}</span>
            <span class="ag-tab__no" aria-hidden="true">${count ? count : (i === 0 ? '★' : '')}</span>
        </button>`;
    }).join('');
}

// ── Entries ─────────────────────────────────────────────────────────────────

function tierChipHtml(entry, planTier) {
    if (entry.tier === 'starter') return '';
    const has = guideTierIncludes(planTier, entry.tier);
    const name = TIER_NAMES[entry.tier];
    return has
        ? `<span class="ag-tier ag-tier--${entry.tier}" title="Included in your ${name} plan"><i class="fas fa-check" aria-hidden="true"></i> ${name}</span>`
        : `<span class="ag-tier ag-tier--locked" title="Unlocks with ${name}"><i class="fas fa-lock" aria-hidden="true"></i> ${name}</span>`;
}

function entryHtml(entry, { planTier, audience, query = '', chapter = null, index = 0 }) {
    const has = guideTierIncludes(planTier, entry.tier);
    const showGo = audience === 'teacher' && entry.go && has;
    const chapterTag = chapter
        ? `<span class="ag-entry__chapter" style="${chapterStyle(chapter)}"><i class="fas ${esc(chapter.icon)}" aria-hidden="true"></i> ${esc(chapter.title)}</span>`
        : '';
    return `
    <article class="ag-entry${has ? '' : ' is-locked'}" id="ag-entry-${esc(entry.id)}" data-ag-entry="${esc(entry.id)}"
        style="--ag-i:${Math.min(index, 8)};${chapter ? chapterStyle(chapter) : ''}">
        <div class="ag-entry__icon" aria-hidden="true"><i class="fas ${esc(entry.icon)}"></i></div>
        <div class="ag-entry__main">
            ${chapterTag}
            <div class="ag-entry__top">
                <h4 class="ag-entry__name">${highlight(entry.name, query)}</h4>
                ${tierChipHtml(entry, planTier)}
            </div>
            ${entry.where && audience === 'teacher' ? `<p class="ag-entry__where"><i class="fas fa-location-dot" aria-hidden="true"></i> ${highlight(entry.where, query)}</p>` : ''}
            <p class="ag-entry__text">${highlight(entry.text, query)}</p>
            ${entry.why && audience === 'teacher' ? `<p class="ag-entry__why">${highlight(entry.why, query)}</p>` : ''}
            ${!has ? `<p class="ag-entry__lock">Unlocks with the ${TIER_NAMES[entry.tier]} plan.</p>` : ''}
            ${showGo ? `<button type="button" class="ag-go" data-ag-go="${esc(entry.go)}">Take me there <i class="fas fa-arrow-right" aria-hidden="true"></i></button>` : ''}
        </div>
    </article>`;
}

function chapterHeadHtml(chapter, number) {
    return `
    <header class="ag-chapter__head">
        <span class="ag-chapter__medal" aria-hidden="true"><i class="fas ${esc(chapter.icon)}"></i></span>
        <div>
            <p class="ag-chapter__no">Chapter ${number}</p>
            <h3 class="ag-chapter__title" id="ag-chapter-title">${esc(chapter.title)}</h3>
            <p class="ag-chapter__intro">${esc(chapter.intro)}</p>
        </div>
    </header>`;
}

function chapterFootHtml(audience, chapterId) {
    const chapters = getGuideChapters(audience);
    const i = chapters.findIndex((c) => c.id === chapterId);
    const prev = chapters[i - 1];
    const next = chapters[i + 1];
    return `
    <footer class="ag-chapter__foot">
        ${prev ? `<button type="button" class="ag-turn ag-turn--prev" data-ag-chapter="${esc(prev.id)}"><i class="fas fa-arrow-left" aria-hidden="true"></i><span><small>Back</small>${esc(prev.title)}</span></button>` : '<span></span>'}
        ${next ? `<button type="button" class="ag-turn ag-turn--next" data-ag-chapter="${esc(next.id)}"><span><small>Next chapter</small>${esc(next.title)}</span><i class="fas fa-arrow-right" aria-hidden="true"></i></button>` : ''}
    </footer>`;
}

// ── Special pages ───────────────────────────────────────────────────────────

function teacherStartHtml({ planTier, teacherName }) {
    const greeting = teacherName ? `Welcome, ${esc(teacherName)}.` : 'Welcome, Quest Master.';
    const route = LESSON_ROUTE.map((step, i) => `
        <li class="ag-route__stop" style="--ag-i:${i};">
            <span class="ag-route__pin" aria-hidden="true">${i + 1}</span>
            <div>
                <h5><i class="fas ${esc(step.icon)}" aria-hidden="true"></i> ${esc(step.title)}</h5>
                <p>${esc(step.text)}</p>
            </div>
        </li>`).join('');

    const races = THREE_RACES.map((race) => {
        const has = guideTierIncludes(planTier, race.tier);
        return `
        <div class="ag-race${has ? '' : ' is-locked'}">
            <span class="ag-race__icon" aria-hidden="true"><i class="fas ${esc(race.icon)}"></i></span>
            <h5>${esc(race.name)}${has ? '' : ` <span class="ag-tier ag-tier--locked"><i class="fas fa-lock" aria-hidden="true"></i> ${TIER_NAMES[race.tier]}</span>`}</h5>
            <dl>
                <div><dt>Who</dt><dd>${esc(race.who)}</dd></div>
                <div><dt>How long</dt><dd>${esc(race.when)}</dd></div>
                <div><dt>Crowned at</dt><dd>${esc(race.crown)}</dd></div>
            </dl>
        </div>`;
    }).join('');

    const pairs = NAMES_APART.map((pair) => `
        <div class="ag-pair">
            <div><strong>${esc(pair.a)}</strong><span>${esc(pair.aNote)}</span></div>
            <span class="ag-pair__not" aria-label="is not">≠</span>
            <div><strong>${esc(pair.b)}</strong><span>${esc(pair.bNote)}</span></div>
        </div>`).join('');

    const keys = HEADER_KEYS.map((k) => `<li><span class="ag-key" aria-hidden="true"><i class="fas ${esc(k.icon)}"></i></span>${esc(k.name)}</li>`).join('');

    return `
    <div class="ag-welcome">
        <p class="ag-welcome__hello">${greeting}</p>
        <p>This guide is a short tour of The Great Class Quest as it is today. Pick a chapter, search for anything, and use <strong>Take me there</strong> to jump straight to a feature. Anything your plan does not include is marked with a lock.</p>
    </div>

    <section class="ag-block">
        <h4 class="ag-block__title"><i class="fas fa-route" aria-hidden="true"></i> A lesson, start to finish</h4>
        <ol class="ag-route">${route}</ol>
        <p class="ag-margin-note">Anytime: tap the TV for Projector Mode. It is a wallpaper for the classroom screen, not a step you must take.</p>
    </section>

    <section class="ag-block">
        <h4 class="ag-block__title"><i class="fas fa-flag-checkered" aria-hidden="true"></i> Three races, never mixed</h4>
        <div class="ag-races">${races}</div>
    </section>

    <section class="ag-block">
        <h4 class="ag-block__title"><i class="fas fa-code-compare" aria-hidden="true"></i> Names to keep apart</h4>
        <div class="ag-pairs">${pairs}</div>
    </section>

    <section class="ag-block">
        <h4 class="ag-block__title"><i class="fas fa-map-signs" aria-hidden="true"></i> Where things live</h4>
        <p class="ag-block__text">Ten clouds along the bottom are the classroom tabs, with Home first. The header holds the class picker and these buttons:</p>
        <ul class="ag-keys">${keys}</ul>
    </section>`;
}

function classWelcomeHtml() {
    const steps = CLASS_DAY.map((step, i) => `
        <li class="ag-day" style="--ag-i:${i};">
            <span class="ag-day__icon" aria-hidden="true"><i class="fas ${esc(step.icon)}"></i></span>
            <h5>${esc(step.title)}</h5>
            <p>${esc(step.text)}</p>
        </li>`).join('');
    return `
    <div class="ag-welcome ag-welcome--class">
        <p class="ag-welcome__hello">Hello, heroes!</p>
        <p>Every lesson is a chapter of your class's adventure. You earn stars for being a great teammate and a brave English speaker, and those stars move your class, your guild and your own hero forward.</p>
    </div>
    <ol class="ag-days">${steps}</ol>
    <p class="ag-margin-note">Tap a chapter to learn how stars, races, Gold and your hero work.</p>`;
}

function plansHtml({ planTier }) {
    const cards = PLAN_TIERS.map((plan) => {
        const current = plan.tier === planTier;
        const included = guideTierIncludes(planTier, plan.tier);
        return `
        <div class="ag-plan ag-plan--${plan.tier}${current ? ' is-current' : ''}${included ? '' : ' is-locked'}">
            ${current ? '<span class="ag-plan__ribbon">Your school</span>' : ''}
            <h5 class="ag-plan__name">${esc(plan.name)}</h5>
            <p class="ag-plan__line">${esc(plan.line)}</p>
            <ul>${plan.items.map((item) => `<li><i class="fas ${included ? 'fa-check' : 'fa-lock'}" aria-hidden="true"></i> ${esc(item)}</li>`).join('')}</ul>
        </div>`;
    }).join('');
    const note = planTier === 'elite'
        ? 'Every tool in the Quest is open for your school. Thank you for being a founding legend.'
        : 'Interested in more? Contact us to upgrade. Nothing to set up, your classes and stars stay as they are.';
    return `
    <div class="ag-plans">${cards}</div>
    <p class="ag-margin-note">${esc(note)}</p>`;
}

// ── Page ────────────────────────────────────────────────────────────────────

export function buildGuideChapterHtml({ audience, chapterId, planTier, teacherName = '' }) {
    const chapters = getGuideChapters(audience);
    const chapter = findGuideChapter(audience, chapterId);
    const number = chapters.indexOf(chapter) + 1;
    let body;
    if (chapter.special === 'teacher-start') body = teacherStartHtml({ planTier, teacherName });
    else if (chapter.special === 'class-welcome') body = classWelcomeHtml();
    else if (chapter.special === 'plans') body = plansHtml({ planTier });
    else body = `<div class="ag-entries">${chapter.entries.map((entry, i) => entryHtml(entry, { planTier, audience, index: i })).join('')}</div>`;

    return `
    <section class="ag-chapter ag-chapter--${esc(chapter.id)}" style="${chapterStyle(chapter)}" aria-labelledby="ag-chapter-title">
        ${chapterHeadHtml(chapter, number)}
        ${body}
        ${chapterFootHtml(audience, chapter.id)}
    </section>`;
}

export function buildGuideSearchHtml({ audience, query, planTier }) {
    const hits = searchGuide(audience, query);
    if (!hits.length) {
        return `
        <section class="ag-chapter ag-search-page">
            <div class="ag-empty">
                <i class="fas fa-binoculars" aria-hidden="true"></i>
                <p>Nothing in the guide matches “${esc(query)}”.</p>
                <span>Try a shorter word, such as <em>gold</em>, <em>quiz</em> or <em>guild</em>.</span>
            </div>
        </section>`;
    }
    return `
    <section class="ag-chapter ag-search-page">
        <p class="ag-search-count">${hits.length} ${hits.length === 1 ? 'find' : 'finds'} for “${esc(query)}”</p>
        <div class="ag-entries ag-entries--search">
            ${hits.map((hit, i) => entryHtml(hit.entry, { planTier, audience, query, chapter: hit.chapter, index: i })).join('')}
        </div>
    </section>`;
}

export function buildGuidePlanStampHtml(planTier) {
    const labels = {
        elite: ['Elite plan', 'Every tool unlocked'],
        pro: ['Pro plan', 'Guilds, diary and calendar'],
        starter: ['Starter plan', 'The core Quest']
    };
    const [name, line] = labels[planTier] || labels.starter;
    return `<span class="ag-stamp__name">${esc(name)}</span><span class="ag-stamp__line">${esc(line)}</span>`;
}
