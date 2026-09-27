// ui/modals/classRoster.js — Home › School Schedule class peek (lazy).
// Shows any class on today's schedule: the teacher's own classes (with shortcuts)
// and colleagues' classes (read-only). View-model math lives in classRosterCore.mjs.
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { getQuestLeagueDefinition } from '../../constants.js';
import { getGuildById, getGuildEmblemUrl } from '../../features/guilds.js';
import { HERO_CLASSES } from '../../features/heroClasses.js';
import { getHeroTitle } from '../../features/heroSkillTree.js';
import { canUseFeature } from '../../utils/subscription.js';
import { getLiveYearGoldFromAppState } from '../../utils/yearGold.js';
import { escapeHtml } from '../../features/roles/shared.js';
import { showAnimatedModal, hideModal } from './base.js';
import { buildClassRosterView, filterRosterHeroes, sortRosterHeroes } from '../../features/classRosterCore.mjs';

const MODAL_ID = 'class-roster-modal';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Same order as the Home schedule card gradients (features/home.js) so the modal
// wears the colour of the card that opened it: [light, mid, deep accent].
const CLASS_TONES = [
    ['#fee2e2', '#fecaca', '#dc2626'], ['#ffedd5', '#fed7aa', '#ea580c'],
    ['#fef3c7', '#fde68a', '#d97706'], ['#dcfce7', '#bbf7d0', '#16a34a'],
    ['#d1fae5', '#a7f3d0', '#059669'], ['#ccfbf1', '#99f6e4', '#0d9488'],
    ['#cffafe', '#a5f3fc', '#0891b2'], ['#e0f2fe', '#bae6fd', '#0284c7'],
    ['#dbeafe', '#bfdbfe', '#2563eb'], ['#e0e7ff', '#c7d2fe', '#4f46e5'],
    ['#ede9fe', '#ddd6fe', '#7c3aed'], ['#f3e8ff', '#e9d5ff', '#9333ea'],
    ['#fae8ff', '#f5d0fe', '#c026d3'], ['#fce7f3', '#fbcfe8', '#db2777'],
    ['#ffe4e6', '#fecdd3', '#e11d48']
];

const AVATAR_TONES = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];

const num = (n) => {
    const v = Math.round((Number(n) || 0) * 10) / 10;
    return v.toLocaleString('en-GB');
};
const plainText = (html) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function classTone(classId) {
    return CLASS_TONES[utils.simpleHashCode(String(classId)) % CLASS_TONES.length];
}

function formatLesson(dateKey) {
    if (!dateKey) return 'Not scheduled';
    const d = utils.parseDDMMYYYY(dateKey);
    if (!d || Number.isNaN(d.getTime())) return dateKey;
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function scheduleDaysLabel(classData) {
    const days = (classData.scheduleDays || [])
        .map(Number)
        .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)) // Monday first
        .map((d) => WEEKDAYS[d])
        .filter(Boolean);
    return days.length ? days.join(' · ') : 'Days not set';
}

function latestByCreated(items) {
    return items.slice().sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))[0] || null;
}

function latestLogFor(classId) {
    return (state.get('allAdventureLogs') || [])
        .filter((l) => l.classId === classId)
        .sort((a, b) => (utils.parseDDMMYYYY(b.date) || 0) - (utils.parseDDMMYYYY(a.date) || 0))[0] || null;
}

function gatherContext(classData) {
    const classId = classData.id;
    const myIds = new Set((state.get('allTeachersClasses') || []).map((c) => c.id));
    const isMine = myIds.has(classId);
    const league = getQuestLeagueDefinition(classData.questLevel);
    const gentle = league?.ageCategory === 'early';
    const students = (state.get('allStudents') || []).filter((s) => s.classId === classId);
    const scoreList = state.get('allStudentScores') || [];
    const scores = new Map(scoreList.map((s) => [s.id, s]));
    const log = latestLogFor(classId);

    let heroStudentId = log?.heroStudentId || null;
    if (!heroStudentId && log?.hero) heroStudentId = students.find((s) => s.name === log.hero)?.id || null;

    const view = buildClassRosterView({
        students,
        scores,
        goldFor: (score) => getLiveYearGoldFromAppState(score, state),
        heroStudentId,
        gentle
    });

    const { totalStars } = utils.getClassMonthlyQuestStars(classData, students, scoreList, new Date(), scores);
    let goal = utils.calculateMonthlyClassGoal(
        classData, view.totals.count, state.get('schoolHolidayRanges'), state.get('allScheduleOverrides')
    );
    if (!goal || goal < 18) goal = 18;
    const progress = Math.min(100, Math.round((totalStars / goal) * 100));

    const classes = state.get('allSchoolClasses') || [];
    const overrides = state.get('allScheduleOverrides') || [];
    const holidays = state.get('schoolHolidayRanges') || [];
    const endDates = state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {};

    return {
        classData,
        isMine,
        league,
        gentle,
        view,
        heroStudentId,
        log,
        assignment: latestByCreated((state.get('allQuestAssignments') || []).filter((a) => a.classId === classId)),
        classStars: Math.round(totalStars * 10) / 10,
        goal,
        progress,
        live: utils.isNowInClassWindow(classData.timeStart, classData.timeEnd),
        nextLesson: utils.getNextLessonDate(classId, classes, overrides, holidays, endDates),
        showGuilds: canUseFeature('guilds'),
        showHeroPath: canUseFeature('heroProgression')
    };
}

// ─── Rendering ────────────────────────────────────────────────────────────────
function avatarHtml(hero, size = 'md') {
    const cls = `crm-avatar crm-avatar--${size}`;
    if (hero.avatar) {
        return `<span class="${cls}"><img src="${escapeHtml(hero.avatar)}" alt="" loading="lazy" decoding="async" class="enlargeable-avatar" data-student-id="${escapeHtml(hero.id)}"></span>`;
    }
    const tone = AVATAR_TONES[utils.simpleHashCode(hero.id) % AVATAR_TONES.length];
    return `<span class="${cls} crm-avatar--initials" style="--crm-avatar:${tone}">${escapeHtml(hero.initials)}</span>`;
}

function renderHeader(ctx) {
    const { classData, league, isMine, live } = ctx;
    const teacher = classData.createdBy?.name || 'Unknown teacher';
    const time = [classData.timeStart, classData.timeEnd].filter(Boolean).join(' – ') || 'Time not set';
    const leagueChip = league
        ? `<span class="crm-chip crm-chip--league"><i class="fas ${escapeHtml(league.pickerIcon)}"></i>${escapeHtml(league.name)}<small>Ages ${escapeHtml(league.ageGroup.replace('-', '–'))}</small></span>`
        : `<span class="crm-chip crm-chip--league"><i class="fas fa-flag"></i>${escapeHtml(classData.questLevel || 'Quest League')}</span>`;
    return `
        <header class="crm-head">
            <span class="crm-head__mesh" aria-hidden="true"></span>
            <span class="crm-sparkles" aria-hidden="true">${Array.from({ length: 8 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</span>
            <div class="crm-head__main">
                <span class="crm-logo" aria-hidden="true">${escapeHtml(classData.logo || '📚')}</span>
                <div class="crm-head__text">
                    <p class="crm-eyebrow">${isMine ? '<i class="fas fa-crown"></i> Your class' : '<i class="fas fa-eye"></i> Colleague’s class · view only'}</p>
                    <h2 id="crm-title" class="font-title crm-title">${escapeHtml(classData.name || 'Class')}</h2>
                    <div class="crm-chips">
                        ${leagueChip}
                        <span class="crm-chip"><i class="fas fa-chalkboard-teacher"></i>${escapeHtml(teacher)}</span>
                        <span class="crm-chip"><i class="fas fa-clock"></i>${escapeHtml(time)}</span>
                        <span class="crm-chip"><i class="fas fa-calendar-week"></i>${escapeHtml(scheduleDaysLabel(classData))}</span>
                        ${live ? '<span class="crm-chip crm-chip--live"><span class="crm-live-dot"></span>In session now</span>' : ''}
                    </div>
                </div>
            </div>
            <button type="button" class="crm-close" data-crm-close aria-label="Close"><i class="fas fa-times"></i></button>
        </header>`;
}

function renderStats(ctx) {
    const { view, classStars, goal, progress } = ctx;
    const ring = `conic-gradient(var(--crm-accent) ${progress * 3.6}deg, rgba(148,163,184,0.18) 0deg)`;
    return `
        <section class="crm-stats" aria-label="Class at a glance">
            <div class="crm-stat crm-stat--sky"><i class="fas fa-users"></i><strong>${view.totals.count}</strong><span>Heroes</span></div>
            <div class="crm-stat crm-stat--amber"><i class="fas fa-star"></i><strong>${num(classStars)}</strong><span>Stars this month</span></div>
            <div class="crm-stat crm-stat--violet"><i class="fas fa-medal"></i><strong>${num(view.totals.total)}</strong><span>Stars all year</span></div>
            <div class="crm-stat crm-stat--gold"><i class="fas fa-coins"></i><strong>${num(view.totals.gold)}</strong><span>Gold treasury</span></div>
            <div class="crm-quest">
                <span class="crm-ring" style="background:${ring}"><b>${progress}%</b></span>
                <div class="crm-quest__text">
                    <strong>Team Quest</strong>
                    <span>${num(classStars)} of ${goal} ⭐ monthly goal</span>
                    <span class="crm-bar"><span style="width:${progress}%"></span></span>
                </div>
            </div>
        </section>`;
}

function renderPodium(ctx) {
    const { podium } = ctx.view;
    if (ctx.gentle || !podium.length) return '';
    const medals = ['🥇', '🥈', '🥉'];
    // Visual order: 2nd · 1st · 3rd
    const order = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium.length === 2 ? [podium[1], podium[0]] : podium;
    return `
        <section class="crm-section">
            <h3 class="crm-section__title"><i class="fas fa-trophy"></i> Stars of the month</h3>
            <div class="crm-podium">
                ${order.map((h) => `
                    <div class="crm-podium__slot crm-podium__slot--${h.rank}">
                        ${avatarHtml(h, 'lg')}
                        <span class="crm-podium__medal" aria-hidden="true">${medals[h.rank - 1] || '⭐'}</span>
                        <strong>${escapeHtml(h.firstName)}</strong>
                        <span>${num(h.monthlyStars)} ⭐</span>
                        <span class="crm-podium__step"></span>
                    </div>`).join('')}
            </div>
        </section>`;
}

function renderHighlights(ctx) {
    const { log, assignment, nextLesson, view, showGuilds } = ctx;
    const hero = view.heroes.find((h) => h.isHero);
    const cards = [];
    cards.push(`
        <article class="crm-note crm-note--sky">
            <i class="fas fa-calendar-check"></i>
            <div><p>Next lesson</p><strong>${escapeHtml(formatLesson(nextLesson))}</strong></div>
        </article>`);
    if (hero || log?.hero) {
        cards.push(`
            <article class="crm-note crm-note--gold">
                <i class="fas fa-crown"></i>
                <div><p>Latest Hero of the Day</p><strong>${escapeHtml(hero?.name || log.hero)}</strong><small>${escapeHtml(formatLesson(log?.date))}</small></div>
            </article>`);
    }
    const hw = plainText(assignment?.text) || assignment?.testData?.title || '';
    if (hw) {
        cards.push(`
            <article class="crm-note crm-note--indigo crm-note--wide">
                <i class="fas fa-book"></i>
                <div><p>Latest Quest Assignment</p><strong class="crm-clamp">${escapeHtml(hw)}</strong></div>
            </article>`);
    }
    if (log && (log.title || log.text)) {
        cards.push(`
            <article class="crm-note crm-note--emerald crm-note--wide">
                <i class="fas fa-compass"></i>
                <div><p>Last adventure · ${escapeHtml(formatLesson(log.date))}</p><strong class="crm-clamp">${escapeHtml(plainText(log.title || log.text))}</strong></div>
            </article>`);
    }
    if (view.celebrations.length) {
        cards.push(`
            <article class="crm-note crm-note--rose crm-note--wide">
                <i class="fas fa-birthday-cake"></i>
                <div><p>Celebrating today</p><strong>${view.celebrations.map((h) => `${h.isBirthday ? '🎂' : '🎈'} ${escapeHtml(h.firstName)}`).join(' · ')}</strong></div>
            </article>`);
    }
    const guilds = showGuilds && view.guilds.length
        ? `<div class="crm-guilds" aria-label="Guild houses">${view.guilds.map(({ guildId, count }) => {
            const g = getGuildById(guildId);
            if (!g) return '';
            const url = getGuildEmblemUrl(guildId);
            const art = url ? `<img src="${escapeHtml(url)}" alt="">` : `<span>${escapeHtml(g.emoji || '🛡️')}</span>`;
            return `<span class="crm-guild" style="--crm-guild:${g.primary}" title="${escapeHtml(g.name)}">${art}<b>${count}</b><small>${escapeHtml(g.name)}</small></span>`;
        }).join('')}</div>`
        : '';
    return `<section class="crm-notes">${cards.join('')}</section>${guilds}`;
}

function renderHeroCard(hero, ctx) {
    const pct = ctx.view.maxMonthly > 0 ? Math.round((hero.monthlyStars / ctx.view.maxMonthly) * 100) : 0;
    const guild = ctx.showGuilds && hero.guildId ? getGuildById(hero.guildId) : null;
    const heroClass = ctx.showHeroPath && hero.heroClass && HERO_CLASSES[hero.heroClass] ? HERO_CLASSES[hero.heroClass] : null;
    const title = heroClass ? (hero.heroLevel > 0 ? getHeroTitle(hero.heroClass, hero.heroLevel) : hero.heroClass) : '';
    const badges = [
        hero.isHero ? '<span class="crm-badge crm-badge--crown" title="Latest Hero of the Day">👑</span>' : '',
        hero.isBirthday ? '<span class="crm-badge" title="Birthday today">🎂</span>' : '',
        hero.isNameday ? '<span class="crm-badge" title="Name day today">🎈</span>' : ''
    ].join('');
    const rank = hero.rank && hero.rank <= 3 ? `<span class="crm-rank crm-rank--${hero.rank}">${hero.rank}</span>` : '';
    const tag = ctx.isMine ? 'button type="button"' : 'div';
    const close = ctx.isMine ? 'button' : 'div';
    return `
        <${tag} class="crm-hero${ctx.isMine ? ' crm-hero--open' : ''}${hero.isHero ? ' crm-hero--crowned' : ''}" data-crm-student="${escapeHtml(hero.id)}"
            style="${guild ? `--crm-guild:${guild.primary};` : ''}"
            title="${escapeHtml(hero.name)}${ctx.isMine ? ' — open Hero stats' : ''}">
            <span class="crm-hero__avatar">${avatarHtml(hero)}${rank}${badges ? `<span class="crm-hero__badges">${badges}</span>` : ''}</span>
            <span class="crm-hero__body">
                <strong class="crm-hero__name">${escapeHtml(hero.name)}</strong>
                <span class="crm-hero__meta">
                    ${heroClass ? `<span class="crm-pill crm-pill--path">${heroClass.icon} ${escapeHtml(title)}</span>` : ''}
                    ${guild ? `<span class="crm-pill crm-pill--guild">${escapeHtml(guild.emoji || '🛡️')} ${escapeHtml(guild.name)}</span>` : ''}
                </span>
                <span class="crm-hero__bar" aria-hidden="true"><span style="width:${pct}%"></span></span>
                <span class="crm-hero__nums">
                    <span title="Stars this month"><i class="fas fa-star"></i>${num(hero.monthlyStars)}</span>
                    <span title="Stars all year"><i class="fas fa-medal"></i>${num(hero.totalStars)}</span>
                    <span title="Gold"><i class="fas fa-coins"></i>${num(hero.gold)}</span>
                </span>
            </span>
        </${close}>`;
}

function renderRosterList(ctx, ui) {
    const list = sortRosterHeroes(filterRosterHeroes(ctx.view.heroes, ui.query), ui.sort);
    if (!ctx.view.heroes.length) {
        return '<div class="crm-empty"><span>🏕️</span><strong>No heroes seated yet</strong><p>Students added to this class will appear here.</p></div>';
    }
    if (!list.length) return `<div class="crm-empty crm-empty--small"><span>🔎</span><strong>No hero named “${escapeHtml(ui.query)}”</strong></div>`;
    return list.map((h) => renderHeroCard(h, ctx)).join('');
}

function renderRosterSection(ctx, ui) {
    const showTools = ctx.view.heroes.length > 1;
    return `
        <section class="crm-section">
            <div class="crm-roster-head">
                <h3 class="crm-section__title"><i class="fas fa-user-friends"></i> Class roster <span class="crm-count">${ctx.view.totals.count}</span></h3>
                ${showTools ? `
                <div class="crm-tools">
                    ${ctx.view.heroes.length > 6 ? `<label class="crm-search"><i class="fas fa-search"></i><input type="search" placeholder="Find a hero" value="${escapeHtml(ui.query)}" data-crm-search aria-label="Find a hero"></label>` : ''}
                    ${ctx.gentle ? '' : `
                    <div class="crm-sort" role="group" aria-label="Sort roster">
                        <button type="button" data-crm-sort="name" aria-pressed="${ui.sort === 'name'}">A–Z</button>
                        <button type="button" data-crm-sort="stars" aria-pressed="${ui.sort === 'stars'}"><i class="fas fa-star"></i> Stars</button>
                    </div>`}
                </div>` : ''}
            </div>
            <div class="crm-roster" data-crm-roster>${renderRosterList(ctx, ui)}</div>
        </section>`;
}

function renderFooter(ctx) {
    if (!ctx.isMine) {
        return `<footer class="crm-foot crm-foot--readonly"><i class="fas fa-lock"></i><span>This class belongs to <b>${escapeHtml(ctx.classData.createdBy?.name || 'another teacher')}</b>. You can look, but only they can award or edit.</span><button type="button" class="crm-btn crm-btn--ghost" data-crm-close>Close</button></footer>`;
    }
    return `
        <footer class="crm-foot">
            <button type="button" class="crm-btn crm-btn--ghost" data-crm-action="edit"><i class="fas fa-pencil-alt"></i> Edit class</button>
            <button type="button" class="crm-btn crm-btn--star" data-crm-action="award"><i class="fas fa-star"></i> Award Stars</button>
            <button type="button" class="crm-btn crm-btn--primary" data-crm-action="enter"><i class="fas fa-door-open"></i> Enter class</button>
        </footer>`;
}

// ─── Shell + wiring ───────────────────────────────────────────────────────────
function ensureShell() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'fixed inset-0 bg-black/55 z-[70] flex items-center justify-center p-3 sm:p-5 hidden backdrop-blur-sm';
    modal.innerHTML = '<div class="crm-shell pop-in" role="dialog" aria-modal="true" aria-labelledby="crm-title"></div>';
    document.body.append(modal);
    return modal;
}

let session = null;

/**
 * Open the roster peek for a class on the school schedule.
 * @param {string} classId
 * @param {{ onEnterClass?: (id:string)=>void, onAwardStars?: (id:string)=>void, onEditClass?: (id:string)=>void, onOpenStudent?: (id:string, el:Element)=>void }} [hooks]
 */
export function openClassRosterModal(classId, hooks = {}) {
    const classData = (state.get('allSchoolClasses') || []).find((c) => c.id === classId);
    if (!classData) return;
    session?.dispose();

    const modal = ensureShell();
    const shell = modal.querySelector('.crm-shell');
    const ctx = gatherContext(classData);
    const ui = { sort: 'name', query: '' };
    const [light, mid, accent] = classTone(classId);
    shell.style.setProperty('--crm-light', light);
    shell.style.setProperty('--crm-mid', mid);
    shell.style.setProperty('--crm-accent', accent);
    shell.classList.toggle('crm-shell--mine', ctx.isMine);

    shell.innerHTML = `
        ${renderHeader(ctx)}
        <div class="crm-body">
            ${renderStats(ctx)}
            ${renderHighlights(ctx)}
            ${renderPodium(ctx)}
            ${renderRosterSection(ctx, ui)}
        </div>
        ${renderFooter(ctx)}`;

    const refreshRoster = () => {
        const host = shell.querySelector('[data-crm-roster]');
        if (host) host.innerHTML = renderRosterList(ctx, ui);
        shell.querySelectorAll('[data-crm-sort]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.crmSort === ui.sort)));
    };

    const close = () => { session?.dispose(); hideModal(MODAL_ID); };

    const onClick = (event) => {
        if (event.target === modal) return close();
        if (event.target.closest('.enlargeable-avatar')) return; // portrait zoom handles itself
        const el = event.target.closest('[data-crm-close], [data-crm-sort], [data-crm-action], [data-crm-student]');
        if (!el) return;
        if (el.hasAttribute('data-crm-close')) return close();
        if (el.dataset.crmSort) { ui.sort = el.dataset.crmSort; refreshRoster(); return; }
        if (!ctx.isMine) return;
        const action = el.dataset.crmAction;
        if (action) {
            close();
            if (action === 'enter') hooks.onEnterClass?.(classId);
            else if (action === 'award') hooks.onAwardStars?.(classId);
            else if (action === 'edit') hooks.onEditClass?.(classId);
            return;
        }
        if (el.dataset.crmStudent) hooks.onOpenStudent?.(el.dataset.crmStudent, el);
    };
    const onInput = (event) => {
        if (!event.target.matches('[data-crm-search]')) return;
        ui.query = event.target.value;
        refreshRoster();
    };
    const onKey = (event) => {
        if (event.key !== 'Escape' || modal.classList.contains('hidden')) return;
        // Let a Hero stats modal opened on top close first.
        if (!document.getElementById('hero-stats-modal')?.classList.contains('hidden')) return;
        if (document.querySelector('.enlarged-avatar-container')) return;
        event.stopPropagation();
        close();
    };

    modal.addEventListener('click', onClick);
    modal.addEventListener('input', onInput);
    document.addEventListener('keydown', onKey, true);
    session = {
        dispose() {
            modal.removeEventListener('click', onClick);
            modal.removeEventListener('input', onInput);
            document.removeEventListener('keydown', onKey, true);
            session = null;
        }
    };

    showAnimatedModal(MODAL_ID);
    requestAnimationFrame(() => shell.querySelector('.crm-close')?.focus({ preventScroll: true }));
}
