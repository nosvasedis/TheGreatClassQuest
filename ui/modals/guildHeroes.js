// /ui/modals/guildHeroes.js

import { getGuildHeroAnalytics } from '../../features/guildHeroAnalytics.js';
import { hideModal, showAnimatedModal } from './base.js';

let _wired = false;
let _selectedGuildId = null;
let _activeView = 'overview';

function _escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function _fmtNumber(n) {
    return Number(n || 0).toLocaleString();
}

function _fmtOne(n) {
    return (Math.round((Number(n) || 0) * 10) / 10).toFixed(1);
}

function _heroAvatar(hero, fallbackColor) {
    if (!hero) return `<div class="guild-heroes-avatar fallback" style="background:${fallbackColor || '#64748b'};">?</div>`;
    if (hero.avatar) return `<img src="${hero.avatar}" alt="${_escapeHtml(hero.name)}" class="guild-heroes-avatar">`;
    return `<div class="guild-heroes-avatar fallback" style="background:${fallbackColor || '#64748b'};">${_escapeHtml((hero.name || '?').charAt(0))}</div>`;
}

function _allHeroesAcrossGuilds(payload) {
    return payload.guilds.flatMap((g) =>
        g.heroesAll.map((h) => ({
            ...h,
            guildId: g.guildId,
            guildName: g.guildName,
            guildEmoji: g.emoji,
            guildColors: g.colors
        }))
    ).sort((a, b) => b.totalStars - a.totalStars || b.monthlyStars - a.monthlyStars || a.name.localeCompare(b.name));
}

function _allHeroesForSelectedGuild(guild) {
    return guild.heroesAll;
}

function _renderOverviewCards(payload) {
    const wrap = document.getElementById('guild-heroes-overview');
    if (!wrap) return;
    wrap.innerHTML = payload.guilds.map((g) => {
        const champ = g.champions.monthlyChampion;
        return `
            <button class="guild-heroes-overview-card ${g.guildId === _selectedGuildId ? 'active' : ''}"
                    data-guild-switch="${g.guildId}"
                    style="--gh-primary:${g.colors.primary};--gh-glow:${g.colors.glow};--gh-secondary:${g.colors.secondary};">
                <div class="guild-heroes-overview-head">
                    <span class="guild-heroes-rank">#${g.comparison.rankByPerCapita}</span>
                    <span class="guild-heroes-name">${_escapeHtml(g.emoji)} ${_escapeHtml(g.guildName)}</span>
                </div>
                <div class="guild-heroes-overview-body">
                    ${_heroAvatar(champ, g.colors.primary)}
                    <div class="guild-heroes-overview-meta">
                        <div class="guild-heroes-overview-line"><strong>${_fmtNumber(g.totals.totalStars)}</strong> total ⭐</div>
                        <div class="guild-heroes-overview-line">${champ ? `${_escapeHtml(champ.name)} · ${_fmtNumber(champ.monthlyStars)}⭐` : 'No monthly champion yet'}</div>
                    </div>
                </div>
            </button>`;
    }).join('');
}

function _renderGuildTabs(payload) {
    const tabs = document.getElementById('guild-heroes-tabs');
    if (!tabs) return;
    tabs.innerHTML = payload.guilds.map((g) => `
        <button class="guild-heroes-tab-btn ${g.guildId === _selectedGuildId ? 'active' : ''}"
                data-guild-switch="${g.guildId}"
                style="--gh-tab:${g.colors.primary};">
            ${_escapeHtml(g.emoji)} ${_escapeHtml(g.guildName)}
        </button>
    `).join('');
}

function _renderViewTabs() {
    const tabs = document.getElementById('guild-heroes-view-tabs');
    if (!tabs) return;
    const options = [
        ['overview', '✨ Snapshot'],
        ['champions', '👑 Champions'],
        ['top', '⚔️ Top Heroes'],
        ['all', '🧙 All Guild Heroes'],
        ['health', '📊 Team Health']
    ];
    tabs.innerHTML = options.map(([id, label]) => `
        <button class="guild-heroes-view-tab ${_activeView === id ? 'active' : ''}" data-view-switch="${id}">
            ${label}
        </button>
    `).join('');
}

function _renderKpis(guild) {
    return `
        <div class="guild-heroes-kpis">
            <div class="guild-heroes-kpi"><span>Total Stars</span><strong>${_fmtNumber(guild.totals.totalStars)}</strong></div>
            <div class="guild-heroes-kpi"><span>Monthly Stars</span><strong>${_fmtNumber(guild.totals.monthlyStars)}</strong></div>
            <div class="guild-heroes-kpi"><span>Members</span><strong>${_fmtNumber(guild.totals.memberCount)}</strong></div>
            <div class="guild-heroes-kpi"><span>Per Member</span><strong>${_fmtOne(guild.totals.perCapitaStars)}⭐</strong></div>
            <div class="guild-heroes-kpi"><span>Month / Member</span><strong>${_fmtOne(guild.totals.monthlyPerCapitaStars)}⭐</strong></div>
        </div>
    `;
}

function _renderOverviewView(payload, guild) {
    const leader = payload.guilds[0];
    const rivalryLine = leader && leader.guildId !== guild.guildId
        ? `Rivalry: ${_escapeHtml(guild.guildName)} trails ${_escapeHtml(leader.guildName)} by ${_fmtOne(guild.comparison.deltaToLeaderPerCapita)} per-member stars.`
        : `${_escapeHtml(guild.guildName)} is currently leading the guild race.`;
    return `
        ${_renderKpis(guild)}
        <section class="guild-heroes-fancy-banner">
            <div class="title">Guild Storyline</div>
            <p>${rivalryLine}</p>
            <p>Top 3 heroes carry <strong>${_fmtOne(guild.breakdown.top3SharePct)}%</strong> of this guild's total power.</p>
        </section>
    `;
}

function _renderChampionsView(guild) {
    const monthlyChampion = guild.champions.monthlyChampion;
    const allTimeChampion = guild.champions.allTimeChampion;
    return `
        <div class="guild-heroes-champions">
            <div class="guild-heroes-champion-card">
                <div class="label">Monthly Champion</div>
                <div class="body">
                    ${_heroAvatar(monthlyChampion, guild.colors.primary)}
                    <div>
                        <div class="name">${monthlyChampion ? _escapeHtml(monthlyChampion.name) : 'No champion yet'}</div>
                        <div class="meta">${monthlyChampion ? `${_fmtNumber(monthlyChampion.monthlyStars)}⭐ this month` : 'Awaiting first monthly stars'}</div>
                    </div>
                </div>
            </div>
            <div class="guild-heroes-champion-card">
                <div class="label">All-Time Top Champion</div>
                <div class="body">
                    ${_heroAvatar(allTimeChampion, guild.colors.secondary)}
                    <div>
                        <div class="name">${allTimeChampion ? _escapeHtml(allTimeChampion.name) : 'No champion yet'}</div>
                        <div class="meta">${allTimeChampion ? `${_fmtNumber(allTimeChampion.totalStars)}⭐ total` : 'Awaiting first total stars'}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function _renderTopHeroesView(guild) {
    const rows = guild.heroesTop.length
        ? guild.heroesTop.map((h, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td>
                    <div class="guild-heroes-cell-hero">
                        ${_heroAvatar(h, guild.colors.primary)}
                        <div>
                            <div class="name">${_escapeHtml(h.name)}</div>
                            <div class="meta">${_escapeHtml(h.heroClass)} · ${_escapeHtml(h.className)}</div>
                        </div>
                    </div>
                </td>
                <td>${_fmtNumber(h.totalStars)}</td>
                <td>${_fmtNumber(h.monthlyStars)}</td>
                <td>${_fmtOne(h.contributionPct)}%</td>
            </tr>
        `).join('')
        : `<tr><td colspan="5" class="guild-heroes-empty-row">No heroes in this guild yet.</td></tr>`;

    return `
        <section class="guild-heroes-panel">
            <h4>Top Heroes of ${_escapeHtml(guild.guildName)}</h4>
            <div class="guild-heroes-table-wrap">
                <table class="guild-heroes-table">
                    <thead><tr><th>#</th><th>Hero</th><th>Total</th><th>Month</th><th>Share</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </section>
    `;
}

function _renderAllHeroesView(payload, guild) {
    const allAcross = _allHeroesAcrossGuilds(payload);
    const selected = _allHeroesForSelectedGuild(guild);
    const crossRows = allAcross.length
        ? allAcross.map((h, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td>
                    <div class="guild-heroes-cell-hero">
                        ${_heroAvatar(h, h.guildColors.primary)}
                        <div>
                            <div class="name">${_escapeHtml(h.name)}</div>
                            <div class="meta">${_escapeHtml(h.heroClass)} · ${_escapeHtml(h.className)}</div>
                        </div>
                    </div>
                </td>
                <td>${_escapeHtml(h.guildEmoji)} ${_escapeHtml(h.guildName)}</td>
                <td>${_fmtNumber(h.totalStars)}</td>
                <td>${_fmtNumber(h.monthlyStars)}</td>
            </tr>
        `).join('')
        : `<tr><td colspan="5" class="guild-heroes-empty-row">No heroes yet.</td></tr>`;

    const selectedRows = selected.length
        ? selected.map((h, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td>${_escapeHtml(h.name)}</td>
                <td>${_fmtNumber(h.totalStars)}</td>
                <td>${_fmtNumber(h.monthlyStars)}</td>
            </tr>
        `).join('')
        : `<tr><td colspan="4" class="guild-heroes-empty-row">No heroes in this guild yet.</td></tr>`;

    return `
        <div class="guild-heroes-grid">
            <section class="guild-heroes-panel">
                <h4>All Guild Heroes (Cross-Guild)</h4>
                <div class="guild-heroes-table-wrap">
                    <table class="guild-heroes-table">
                        <thead><tr><th>#</th><th>Hero</th><th>Guild</th><th>Total</th><th>Month</th></tr></thead>
                        <tbody>${crossRows}</tbody>
                    </table>
                </div>
            </section>
            <section class="guild-heroes-panel">
                <h4>Selected Guild Roster</h4>
                <p class="guild-heroes-note">Full roster for ${_escapeHtml(guild.guildName)} sorted by total stars.</p>
                <div class="guild-heroes-table-wrap">
                    <table class="guild-heroes-table">
                        <thead><tr><th>#</th><th>Hero</th><th>Total</th><th>Month</th></tr></thead>
                        <tbody>${selectedRows}</tbody>
                    </table>
                </div>
            </section>
        </div>
    `;
}

function _renderHealthView(payload, guild) {
    const leader = payload.guilds[0];
    const classContrib = guild.breakdown.classContributions.length
        ? guild.breakdown.classContributions.slice(0, 8).map(c =>
            `<li>${_escapeHtml(c.className)}: <strong>${_fmtNumber(c.totalStars)}⭐</strong> (${_fmtOne(c.sharePct)}%)</li>`
        ).join('')
        : '<li>No class contribution data yet.</li>';
    const heroClassMix = guild.breakdown.heroClassMix.length
        ? guild.breakdown.heroClassMix.map(c =>
            `<li>${_escapeHtml(c.heroClass)}: <strong>${_fmtNumber(c.count)}</strong></li>`
        ).join('')
        : '<li>No hero class mix data yet.</li>';

    const rivalryLine = leader && leader.guildId !== guild.guildId
        ? `Needs ${_fmtOne(guild.comparison.deltaToLeaderPerCapita)} per-member stars to match #1 ${_escapeHtml(leader.guildName)}.`
        : 'Holding first place. Defend the lead!';

    return `
        <div class="guild-heroes-grid">
            <section class="guild-heroes-panel">
                <h4>Team Health Metrics</h4>
                <ul class="guild-heroes-bullets">
                    <li>Active heroes this month: <strong>${_fmtNumber(guild.breakdown.activeHeroes)}</strong> / ${_fmtNumber(guild.totals.memberCount)} (${_fmtOne(guild.breakdown.activeRatePct)}%)</li>
                    <li>Top 3 heroes share: <strong>${_fmtOne(guild.breakdown.top3SharePct)}%</strong></li>
                    <li>Guild rank by per-member stars: <strong>#${_fmtNumber(guild.comparison.rankByPerCapita)}</strong></li>
                </ul>
                <div class="guild-heroes-rivalry">${rivalryLine}</div>
            </section>
            <section class="guild-heroes-panel">
                <h5>Class Contributions</h5>
                <ul class="guild-heroes-bullets">${classContrib}</ul>
                <h5>Hero Class Mix</h5>
                <ul class="guild-heroes-bullets">${heroClassMix}</ul>
            </section>
        </div>
    `;
}

function _renderBody(payload) {
    const content = document.getElementById('guild-heroes-content');
    const subtitle = document.getElementById('guild-heroes-subtitle');
    if (!content) return;

    const guild = payload.guilds.find(g => g.guildId === _selectedGuildId) || payload.guilds[0];
    if (!guild) {
        content.innerHTML = `<div class="guild-heroes-empty">No guild data available yet.</div>`;
        if (subtitle) subtitle.textContent = '';
        return;
    }

    _selectedGuildId = guild.guildId;
    if (subtitle) subtitle.textContent = `${guild.guildName} · Rank #${guild.comparison.rankByPerCapita} · Snapshot ${payload.generatedAtMonthKey}`;

    if (_activeView === 'champions') content.innerHTML = _renderChampionsView(guild);
    else if (_activeView === 'top') content.innerHTML = _renderTopHeroesView(guild);
    else if (_activeView === 'all') content.innerHTML = _renderAllHeroesView(payload, guild);
    else if (_activeView === 'health') content.innerHTML = _renderHealthView(payload, guild);
    else content.innerHTML = _renderOverviewView(payload, guild);
}

function _renderAll(payload) {
    if (!payload.guilds.length) return;
    if (!_selectedGuildId || !payload.guilds.find(g => g.guildId === _selectedGuildId)) _selectedGuildId = payload.guilds[0].guildId;
    _renderOverviewCards(payload);
    _renderGuildTabs(payload);
    _renderViewTabs();
    _renderBody(payload);
}

function _wireListeners() {
    const modal = document.getElementById('guild-heroes-modal');
    if (!modal || _wired) return;
    _wired = true;

    document.getElementById('guild-heroes-close-btn')?.addEventListener('click', () => hideModal('guild-heroes-modal'));
    document.getElementById('guild-heroes-overlay-bg')?.addEventListener('click', () => hideModal('guild-heroes-modal'));

    modal.addEventListener('click', (e) => {
        const guildBtn = e.target.closest('[data-guild-switch]');
        if (guildBtn) {
            _selectedGuildId = guildBtn.dataset.guildSwitch;
            _renderAll(getGuildHeroAnalytics());
            return;
        }
        const viewBtn = e.target.closest('[data-view-switch]');
        if (viewBtn) {
            _activeView = viewBtn.dataset.viewSwitch || 'overview';
            _renderAll(getGuildHeroAnalytics());
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (modal.classList.contains('hidden')) return;
        hideModal('guild-heroes-modal');
    });
}

export function openGuildHeroesModal(initialGuildId) {
    _wireListeners();
    const payload = getGuildHeroAnalytics();
    _selectedGuildId = initialGuildId || payload.guilds[0]?.guildId || null;
    _activeView = 'overview';
    _renderAll(payload);
    showAnimatedModal('guild-heroes-modal');
}
