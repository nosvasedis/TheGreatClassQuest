// ui/modals/weeklyReportView.mjs
// Pure markup for the Weekly Report ("The Week's Scroll"). The model comes from
// features/weeklyReportCore.mjs; ui/modals/reports.js mounts it and wires the buttons.

import { buildWeeklyHighlights, formatStars } from '../../features/weeklyReportCore.mjs';

export function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

function avatar(hero, size = 'md') {
    const img = hero.avatar && /^(https?:|data:image\/)/.test(hero.avatar)
        ? `<img src="${esc(hero.avatar)}" alt="" loading="lazy" decoding="async">`
        : `<span>${esc(initials(hero.name))}</span>`;
    return `<span class="wr-avatar wr-avatar--${size}" aria-hidden="true">${img}</span>`;
}

function changeChip(model) {
    if (model.isEmpty) return '';
    if (model.starChange === null) return '<span class="wr-chip wr-chip--up"><i class="fas fa-seedling"></i> new</span>';
    if (model.starChange === 0) return '<span class="wr-chip">same as before</span>';
    const up = model.starChange > 0;
    const running = model.week.current && !up ? ' title="This week is still running"' : '';
    return `<span class="wr-chip wr-chip--${up ? 'up' : 'down'}"${running}><i class="fas fa-arrow-${up ? 'up' : 'down'}"></i> ${Math.abs(model.starChange)}%</span>`;
}

function statTiles(model) {
    const ring = model.heroCount ? Math.round((model.noticed / model.heroCount) * 100) : 0;
    const tiles = [
        `<div class="wr-stat wr-stat--stars">
            <span class="wr-stat__icon"><i class="fas fa-star"></i></span>
            <span class="wr-stat__value">${formatStars(model.totalStars)}</span>
            <span class="wr-stat__label">Stars earned</span>
            <span class="wr-stat__foot">${changeChip(model)}<span>week before: ${formatStars(model.prevStars)}</span></span>
        </div>`,
        `<div class="wr-stat">
            <span class="wr-stat__icon"><i class="fas fa-chalkboard-user"></i></span>
            <span class="wr-stat__value">${model.lessonCount}</span>
            <span class="wr-stat__label">${model.lessonCount === 1 ? 'Lesson' : 'Lessons'}</span>
            <span class="wr-stat__foot"><span>${model.lessonCount ? `${formatStars(model.starsPerLesson)} ★ per lesson` : 'no lessons logged'}</span></span>
        </div>`,
        `<div class="wr-stat">
            <span class="wr-ring" style="--p:${ring}" aria-hidden="true"><span>${ring}%</span></span>
            <span class="wr-stat__value">${model.noticed}<small>/${model.heroCount}</small></span>
            <span class="wr-stat__label">Heroes recognised</span>
            <span class="wr-stat__foot"><span>${model.unseen.length ? `${model.unseen.length} waiting` : 'everyone seen'}</span></span>
        </div>`,
        `<div class="wr-stat">
            <span class="wr-stat__icon"><i class="fas fa-user-check"></i></span>
            <span class="wr-stat__value">${model.attendanceRate === null ? '–' : `${model.attendanceRate}<small>%</small>`}</span>
            <span class="wr-stat__label">Attendance</span>
            <span class="wr-stat__foot"><span>${model.absences === 1 ? '1 absence' : `${model.absences} absences`}</span></span>
        </div>`,
    ];
    if (!model.youngLearners) {
        tiles.push(`<div class="wr-stat">
            <span class="wr-stat__icon"><i class="fas fa-scroll"></i></span>
            <span class="wr-stat__value">${model.trialAverage === null ? '–' : `${model.trialAverage}<small>%</small>`}</span>
            <span class="wr-stat__label">Trial average</span>
            <span class="wr-stat__foot"><span>${model.trials.length === 1 ? '1 trial' : `${model.trials.length} trials`}</span></span>
        </div>`);
    }
    return `<section class="wr-stats" aria-label="The week in numbers">${tiles.join('')}</section>`;
}

function highlights(model) {
    const list = buildWeeklyHighlights(model);
    if (!list.length) return '';
    return `<ul class="wr-highlights" aria-label="Quick observations">${list.map((h) => `
        <li class="wr-highlight wr-highlight--${h.tone}"><i class="fas ${esc(h.icon)}" aria-hidden="true"></i><span>${esc(h.text)}</span></li>`).join('')}
    </ul>`;
}

function weekChart(model) {
    const max = Math.max(1, ...model.days.map((d) => d.stars));
    const bars = model.days.map((d) => {
        const h = d.stars > 0 ? Math.max(8, Math.round((d.stars / max) * 100)) : 0;
        const peak = model.peakDay && model.peakDay.label === d.label && d.stars > 0;
        const cls = ['wr-day', d.lesson ? 'is-lesson' : '', d.future ? 'is-future' : '', peak ? 'is-peak' : ''].filter(Boolean).join(' ');
        return `<div class="${cls}">
            <span class="wr-day__value">${d.stars > 0 ? formatStars(d.stars) : ''}</span>
            <span class="wr-day__track"><span class="wr-day__bar" style="--h:${h}%"></span></span>
            <span class="wr-day__label">${d.label}<small>${d.date}</small></span>
        </div>`;
    }).join('');
    return `<section class="wr-card">
        <h3 class="wr-card__title"><i class="fas fa-chart-column"></i> Stars through the week</h3>
        <div class="wr-days" role="img" aria-label="${esc(model.days.map((d) => `${d.label} ${formatStars(d.stars)} stars`).join(', '))}">${bars}</div>
        <p class="wr-card__note"><span class="wr-dot"></span> lesson day${model.otherStars > 0 ? ` · ${formatStars(model.otherStars)} ★ came from boons, quests and bonuses` : ''}</p>
    </section>`;
}

function virtueCompass(model) {
    const max = Math.max(1, ...model.virtues.map((v) => v.stars));
    const rows = model.virtues.map((v) => {
        const diff = Math.round((v.stars - v.prevStars) * 4) / 4;
        const trend = diff === 0 ? '' : `<span class="wr-trend wr-trend--${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '+' : ''}${formatStars(diff)}</span>`;
        return `<li class="wr-virtue" style="--vc:${v.color}">
            <span class="wr-virtue__icon"><i class="fas ${v.icon}"></i></span>
            <span class="wr-virtue__name">${v.label}${model.leadVirtue?.id === v.id ? ' <i class="fas fa-crown wr-virtue__crown" title="Led the week"></i>' : ''}</span>
            <span class="wr-virtue__track"><span style="--w:${Math.round((v.stars / max) * 100)}%"></span></span>
            <span class="wr-virtue__value">${formatStars(v.stars)} ${trend}</span>
        </li>`;
    }).join('');
    return `<section class="wr-card">
        <h3 class="wr-card__title"><i class="fas fa-compass"></i> Virtue compass</h3>
        <ul class="wr-virtues">${rows}</ul>
        <p class="wr-card__note">Change is against the week before.</p>
    </section>`;
}

function heroesCard(model) {
    const shining = model.shining.length
        ? `<ol class="wr-shining">${model.shining.map((h, i) => `
            <li class="wr-shine wr-shine--${i + 1}">
                ${avatar(h, i === 0 ? 'lg' : 'md')}
                <span class="wr-shine__name">${esc(h.firstName)}</span>
                <span class="wr-shine__meta">${h.stars === null ? '' : `${formatStars(h.stars)} ★`}${h.topVirtue ? ` · ${esc(h.topVirtue)}` : ''}</span>
            </li>`).join('')}</ol>`
        : '<p class="wr-empty-line">No stars awarded yet this week.</p>';
    const crowns = model.crowns.length
        ? `<div class="wr-crowns"><span class="wr-sub-label"><i class="fas fa-crown"></i> Heroes of the Day</span>
            <div class="wr-crowns__list">${model.crowns.map((c) => `<span class="wr-crown"><b>${esc(c.day)}</b> ${esc(c.name)}</span>`).join('')}</div></div>`
        : '';
    return `<section class="wr-card wr-card--heroes">
        <h3 class="wr-card__title"><i class="fas fa-sun"></i> Shining this week</h3>
        ${shining}
        ${crowns}
    </section>`;
}

function unseenCard(model) {
    const body = model.unseen.length
        ? `<p class="wr-card__lead">Present, but no star yet. A small, specific word of praise next lesson goes a long way.</p>
           <div class="wr-unseen">${model.unseen.map((h) => `<span class="wr-unseen__hero">${avatar(h, 'sm')}${esc(h.firstName)}</span>`).join('')}</div>`
        : `<p class="wr-all-seen"><i class="fas fa-hands-clapping"></i> ${model.lessonCount ? 'Every hero who came was recognised.' : 'No lessons logged yet.'}</p>`;
    const absent = model.frequentAbsent.length
        ? `<p class="wr-absent"><i class="fas fa-door-open"></i> Missed 2+ lessons: ${model.frequentAbsent.map((h) => `${esc(h.firstName)} (${h.absences})`).join(', ')}</p>`
        : '';
    return `<section class="wr-card wr-card--unseen">
        <h3 class="wr-card__title"><i class="fas fa-eye"></i> Waiting to be noticed</h3>
        ${body}
        ${absent}
    </section>`;
}

function trialsCard(model) {
    if (!model.trials.length) return '';
    const rows = model.trials.map((t) => `
        <li class="wr-trial">
            <span class="wr-trial__icon"><i class="fas ${/dict/i.test(t.type) ? 'fa-feather-pointed' : 'fa-file-signature'}"></i></span>
            <span class="wr-trial__name">${esc(t.title)}<small>${t.count} ${t.count === 1 ? 'hero' : 'heroes'}${t.type ? ` · ${esc(t.type)}` : ''}</small></span>
            ${t.average === null
                ? `<span class="wr-trial__value">${esc(t.sampleLabel || 'logged')}</span>`
                : `<span class="wr-trial__track"><span style="--w:${t.average}%"></span></span><span class="wr-trial__value">${t.average}%<small>best ${t.best}%</small></span>`}
        </li>`).join('');
    return `<section class="wr-card wr-card--wide">
        <h3 class="wr-card__title"><i class="fas fa-scroll"></i> Scholar's desk</h3>
        <ul class="wr-trials">${rows}</ul>
    </section>`;
}

/** The Oracle's reading. state: { status: 'idle'|'loading'|'ready'|'error'|'locked', reading } */
export function renderReadingMarkup(readingState = {}) {
    const { status, reading } = readingState;
    if (status === 'locked') {
        return `<div class="wr-reading__locked"><i class="fas fa-lock"></i><p>The Oracle's reading is part of the Elite plan.</p></div>`;
    }
    if (status === 'loading') {
        return `<div class="wr-reading__loading" aria-live="polite">
            <p><i class="fas fa-feather-pointed fa-beat-fade"></i> The Oracle is reading the week…</p>
            <span class="wr-shimmer" style="--w:62%"></span><span class="wr-shimmer" style="--w:94%"></span><span class="wr-shimmer" style="--w:88%"></span><span class="wr-shimmer" style="--w:71%"></span>
        </div>`;
    }
    if (status === 'error' || (status === 'ready' && !reading)) {
        return `<div class="wr-reading__error" role="alert">
            <i class="fas fa-moon"></i>
            <div><p class="wr-reading__error-title">The Oracle is resting</p><p>The numbers above are complete. Try the reading again in a moment.</p></div>
            <button type="button" class="wr-btn wr-btn--ghost" data-wr-action="reading"><i class="fas fa-rotate"></i> Try again</button>
        </div>`;
    }
    if (status !== 'ready') {
        return `<div class="wr-reading__idle"><button type="button" class="wr-btn wr-btn--oracle" data-wr-action="reading"><i class="fas fa-wand-sparkles"></i> Ask the Oracle</button></div>`;
    }
    const paragraphs = reading.story ? reading.story.split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`).join('') : '';
    const list = (items, cls, icon, title) => items.length
        ? `<div class="wr-list wr-list--${cls}"><span class="wr-sub-label"><i class="fas ${icon}"></i> ${title}</span><ul>${items.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>`
        : '';
    const q = reading.miniQuest;
    const quest = q ? `<div class="wr-quest">
            <span class="wr-quest__seal" aria-hidden="true"><i class="fas fa-flag"></i></span>
            <p class="wr-quest__kicker">Mini-Quest for next week</p>
            <h4 class="wr-quest__name">${esc(q.name)}</h4>
            ${q.goal ? `<p><b>Goal</b> ${esc(q.goal)}</p>` : ''}
            ${q.howToWin ? `<p><b>How to win</b> ${esc(q.howToWin)}</p>` : ''}
            ${q.reward ? `<p><b>Reward</b> ${esc(q.reward)}</p>` : ''}
        </div>` : '';
    const family = reading.familyNote ? `<div class="wr-family">
            <div class="wr-family__head"><span class="wr-sub-label"><i class="fas fa-people-roof"></i> Note for families</span>
            <button type="button" class="wr-mini-btn" data-wr-action="copy-family"><i class="far fa-copy"></i> Copy</button></div>
            <p>${esc(reading.familyNote)}</p>
        </div>` : '';
    return `
        ${reading.headline ? `<h4 class="wr-reading__headline">${esc(reading.headline)}</h4>` : ''}
        <div class="wr-reading__story">${paragraphs}</div>
        <div class="wr-lists">${list(reading.wins, 'wins', 'fa-trophy', 'Wins')}${list(reading.watch, 'watch', 'fa-binoculars', 'To watch')}</div>
        ${quest}
        ${family}
        <div class="wr-reading__again"><button type="button" class="wr-mini-btn" data-wr-action="reading"><i class="fas fa-rotate"></i> Write a new reading</button></div>`;
}

export function renderWeeklyReportMarkup(model, readingState = {}, { canGoBack = false } = {}) {
    if (model.isEmpty) {
        return `<div class="wr-emptyweek">
            <span class="wr-emptyweek__icon" aria-hidden="true">🕯️</span>
            <h3>A quiet page</h3>
            <p>No stars, logs, trials or attendance were recorded for ${esc(model.className)} in ${esc(model.week.label)}.</p>
            ${canGoBack ? '<button type="button" class="wr-btn wr-btn--ghost" data-wr-action="prev"><i class="fas fa-chevron-left"></i> See the week before</button>' : ''}
        </div>`;
    }
    return `
        ${statTiles(model)}
        ${highlights(model)}
        <div class="wr-grid">
            ${weekChart(model)}
            ${virtueCompass(model)}
            ${heroesCard(model)}
            ${unseenCard(model)}
            ${trialsCard(model)}
        </div>
        <section class="wr-reading" aria-labelledby="wr-reading-title">
            <div class="wr-reading__head">
                <span class="wr-reading__orb" aria-hidden="true"><i class="fas fa-eye"></i></span>
                <div><p class="wr-kicker wr-kicker--dark">Oracle AI</p><h3 id="wr-reading-title" class="wr-reading__title">The Oracle's reading</h3></div>
            </div>
            <div id="wr-reading-body" class="wr-reading__body">${renderReadingMarkup(readingState)}</div>
        </section>`;
}
