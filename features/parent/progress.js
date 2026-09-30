// features/parent/progress.js — how a child is growing: stars by month, results, attendance
import * as state from '../../state.js';
import { getGuildById } from '../guilds.js';
import {
    escapeHtml,
    getSnapshot,
    firstName,
    shortDate,
    monthShort,
    heroClassMeta,
    snapshotAssessmentUses
} from './helpers.js';

const VISIBLE_RESULTS = 5;

function formatStars(value) {
    const n = Number(value || 0);
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Past months plus this month, as pencil marks on a doorframe. */
function renderGrowthChart(snapshot, name) {
    const history = (Array.isArray(snapshot.starsHistory) ? snapshot.starsHistory : [])
        .filter((item) => item.month !== currentMonthKey())
        .slice(-5);
    const months = [...history, { month: currentMonthKey(), stars: Number(snapshot.progress?.monthlyStars || 0), current: true }];
    const max = Math.max(10, ...months.map((item) => Number(item.stars || 0)));
    return `
        <article class="fp-card fp-growth fp-rise" style="--fp-delay:1">
            <div class="fp-card__row">
                <div>
                    <p class="fp-kicker">Growing tall</p>
                    <h3 class="fp-card__title">${escapeHtml(name)}'s stars, month by month</h3>
                </div>
                <span class="fp-pill"><i class="fas fa-star" aria-hidden="true"></i> ${formatStars(snapshot.progress?.totalStars || 0)} this year</span>
            </div>
            <div class="fp-doorframe" role="img" aria-label="${months.map((m) => `${monthShort(`${m.month}-01`)}: ${formatStars(m.stars)} stars`).join(', ')}">
                ${months.map((item, index) => {
                    const height = Math.max(4, Math.round((Number(item.stars || 0) / max) * 100));
                    return `
                        <div class="fp-doorframe__col${item.current ? ' is-current' : ''}" style="--h:${height}%;--i:${index}">
                            <div class="fp-doorframe__track">
                                <span class="fp-doorframe__mark"><span class="fp-doorframe__value">${formatStars(item.stars)}</span></span>
                            </div>
                            <span class="fp-doorframe__month">${escapeHtml(monthShort(`${item.month}-01`))}${item.current ? '<em>so far</em>' : ''}</span>
                        </div>`;
                }).join('')}
            </div>
            ${history.length ? '' : '<p class="fp-card__foot">Each month gets its own mark here, like a height chart on the kitchen door.</p>'}
        </article>`;
}

function toneForPercent(percent) {
    if (percent === null || percent === undefined) return 'neutral';
    if (percent >= 85) return 'sage';
    if (percent >= 65) return 'amber';
    return 'rose';
}

function typeLabel(type) {
    if (type === 'dictation') return 'Dictation';
    if (type === 'test') return 'Test';
    return 'Result';
}

function renderResults(snapshot) {
    const uses = snapshotAssessmentUses(snapshot);
    if (!uses.any) {
        return `<p class="fp-tip fp-rise" style="--fp-delay:2"><i class="fas fa-circle-info" aria-hidden="true"></i> This class does not record tests or dictations, so progress is told through stars and attendance.</p>`;
    }
    const history = Array.isArray(snapshot.gradeHistory) ? snapshot.gradeHistory : [];
    const showAll = state.get('parentView')?.showAllResults === true;
    const visible = showAll ? history : history.slice(0, VISIBLE_RESULTS);
    const average = Number.isFinite(Number(snapshot.gradeAveragePercent)) && snapshot.gradeAveragePercent !== null
        ? Number(snapshot.gradeAveragePercent)
        : null;
    return `
        <article class="fp-card fp-report fp-rise" style="--fp-delay:2">
            <div class="fp-card__row">
                <div>
                    <p class="fp-kicker">Report card</p>
                    <h3 class="fp-card__title">Recent ${uses.tests && uses.dictations ? 'tests and dictations' : uses.tests ? 'tests' : 'dictations'}</h3>
                </div>
                ${average !== null ? `
                    <span class="fp-ring fp-ring--${toneForPercent(average)}" style="--p:${average}" role="img" aria-label="Average ${average} percent">
                        <span class="fp-ring__value">${average}<small>%</small></span>
                        <span class="fp-ring__label">average</span>
                    </span>` : ''}
            </div>
            ${visible.length ? `
                <ul class="fp-results">
                    ${visible.map((item) => {
                        const percent = Number.isFinite(Number(item.percent)) && item.percent !== null ? Number(item.percent) : null;
                        const title = item.type === 'dictation' && (!item.title || item.title === 'dictation') ? 'Dictation' : (item.title || typeLabel(item.type));
                        return `
                            <li class="fp-result">
                                <span class="fp-result__type fp-result__type--${escapeHtml(item.type || 'other')}">${escapeHtml(typeLabel(item.type))}</span>
                                <span class="fp-result__copy">
                                    <span class="fp-result__title">${escapeHtml(title)}</span>
                                    <span class="fp-result__date">${escapeHtml(shortDate(item.date))}</span>
                                </span>
                                <span class="fp-result__score fp-result__score--${toneForPercent(percent)}">${escapeHtml(item.scoreLabel || '—')}</span>
                                ${percent !== null ? `<span class="fp-result__bar" aria-hidden="true"><span style="width:${Math.max(3, percent)}%"></span></span>` : ''}
                            </li>`;
                    }).join('')}
                </ul>
                ${history.length > VISIBLE_RESULTS ? `
                    <button type="button" class="fp-link" data-parent-toggle-results>
                        ${showAll ? 'Show fewer' : `Show all ${history.length}`} <i class="fas fa-chevron-${showAll ? 'up' : 'down'}" aria-hidden="true"></i>
                    </button>` : ''}` : `<p class="fp-empty-line">Results appear here once the teacher records them.</p>`}
        </article>`;
}

function renderAttendance(snapshot, name) {
    const attendance = snapshot.attendanceSummary || {};
    const absences = Number(attendance.absences || 0);
    const dates = Array.isArray(attendance.absenceDates) ? attendance.absenceDates : [];
    return `
        <article class="fp-card fp-attendance fp-rise" style="--fp-delay:3">
            <p class="fp-kicker">Attendance</p>
            ${absences === 0 ? `
                <div class="fp-attendance__perfect">
                    <span class="fp-bubble fp-bubble--sage fp-bubble--lg"><i class="fas fa-calendar-check" aria-hidden="true"></i></span>
                    <div>
                        <h3 class="fp-card__title">At every lesson so far</h3>
                        <p class="fp-card__foot">${escapeHtml(name)} has not missed a lesson this year.</p>
                    </div>
                </div>` : `
                <h3 class="fp-card__title">Missed ${absences} lesson${absences === 1 ? '' : 's'} this year</h3>
                ${dates.length ? `<div class="fp-date-chips">${dates.map((date) => `<span class="fp-date-chip">${escapeHtml(shortDate(date))}</span>`).join('')}</div>` : ''}
                <p class="fp-card__foot">If ${escapeHtml(name)} will miss a lesson, send an <button type="button" class="fp-inline-link" data-parent-compose="absence">absence note</button>.</p>`}
        </article>`;
}

function renderHeroCard(snapshot, name) {
    const hero = heroClassMeta(snapshot.heroClass);
    const guild = getGuildById(snapshot.guildId);
    const progress = snapshot.progress || {};
    return `
        <article class="fp-card fp-hero fp-rise" style="--fp-delay:4">
            <p class="fp-kicker">In the class game</p>
            <div class="fp-hero__grid">
                <div class="fp-hero__item">
                    <span class="fp-hero__badge" aria-hidden="true">${hero ? hero.icon : '🌱'}</span>
                    <span class="fp-hero__label">Hero class</span>
                    <span class="fp-hero__value">${escapeHtml(snapshot.heroClass || 'Not chosen yet')}</span>
                    ${hero ? `<span class="fp-hero__hint">${escapeHtml(hero.gift)}</span>` : ''}
                </div>
                <div class="fp-hero__item">
                    ${guild ? `<img class="fp-hero__emblem" src="${escapeHtml(guild.emblem)}" alt="" loading="lazy" decoding="async">` : '<span class="fp-hero__badge" aria-hidden="true">🏰</span>'}
                    <span class="fp-hero__label">Guild</span>
                    <span class="fp-hero__value">${escapeHtml(guild?.name || 'Not sorted yet')}</span>
                    ${guild?.motto ? `<span class="fp-hero__hint">“${escapeHtml(guild.motto)}”</span>` : ''}
                </div>
                <div class="fp-hero__item">
                    <span class="fp-hero__badge" aria-hidden="true">⭐</span>
                    <span class="fp-hero__label">Hero level</span>
                    <span class="fp-hero__value">${Number(progress.heroLevel || 0)}</span>
                </div>
                <div class="fp-hero__item">
                    <span class="fp-hero__badge" aria-hidden="true">🪙</span>
                    <span class="fp-hero__label">Gold</span>
                    <span class="fp-hero__value">${formatStars(progress.gold || 0)}</span>
                    <span class="fp-hero__hint">to spend in the class market</span>
                </div>
            </div>
            <details class="fp-explain">
                <summary>How the class game works</summary>
                <ul>
                    <li><strong>Stars</strong> reward effort, teamwork and kindness in English class. They are not a second grade.</li>
                    <li><strong>This month's stars</strong> start again each month; stars for the year keep adding up.</li>
                    <li><strong>The guild</strong> is ${escapeHtml(name)}'s team for good. Guilds cheer each other on all year.</li>
                    <li><strong>Gold</strong> buys small rewards in the class market. It is earned in class, never bought.</li>
                </ul>
            </details>
        </article>`;
}

export function renderParentProgress() {
    const snapshot = getSnapshot();
    const name = firstName(snapshot.studentName);
    return `
        <header class="fp-pagehead fp-rise">
            <span class="fp-pagehead__icon fp-pagehead__icon--sage" aria-hidden="true"><i class="fas fa-seedling"></i></span>
            <div>
                <h2 class="fp-pagehead__title">Progress</h2>
                <p class="fp-pagehead__sub">How ${escapeHtml(name)} is growing this year.</p>
            </div>
        </header>
        <div class="fp-progress">
            ${renderGrowthChart(snapshot, name)}
            ${renderResults(snapshot)}
            ${renderAttendance(snapshot, name)}
            ${renderHeroCard(snapshot, name)}
        </div>`;
}
