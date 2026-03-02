// /ui/modals/guildHeroes.js

import { getGuildHeroAnalytics } from '../../features/guildHeroAnalytics.js';
import { getGuildEmblemUrl } from '../../features/guilds.js';
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

function _guildEmblem(guild) {
    const emblemUrl = getGuildEmblemUrl(guild.guildId);
    if (emblemUrl) {
        return `<img src="${emblemUrl}" alt="${_escapeHtml(guild.guildName)}" class="guild-heroes-emblem-mini" 
                style="border-color:${guild.colors.primary}; box-shadow: 0 0 8px ${guild.colors.glow}77;">`;
    }
    return `<div class="guild-heroes-emblem-mini guild-heroes-emblem-fallback" 
                style="background:linear-gradient(135deg,${guild.colors.primary},${guild.colors.secondary}); box-shadow:0 0 8px ${guild.colors.glow}77;">
                <span>${_escapeHtml(guild.emoji)}</span>
            </div>`;
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
                    <span class="guild-heroes-name">${_guildEmblem(g)} ${_escapeHtml(g.guildName)}</span>
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
    // Guild tabs removed - using overview cards only for guild selection
    const tabs = document.getElementById('guild-heroes-tabs');
    if (tabs) tabs.innerHTML = '';
}

function _renderViewTabs() {
    const tabs = document.getElementById('guild-heroes-view-tabs');
    if (!tabs) return;
    const options = [
        ['overview', '✨ Snapshot'],
        ['champions', '👑 Champions'],
        ['top', '⚔️ Top Heroes'],
        ['all', '📋 Roster'],
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
            <div class="guild-heroes-champion-card" style="--gh-primary:${guild.colors.primary};--gh-secondary:${guild.colors.secondary};">
                <div class="label">Monthly Champion</div>
                <div class="body">
                    ${_heroAvatar(monthlyChampion, guild.colors.primary)}
                    <div>
                        <div class="name">${monthlyChampion ? _escapeHtml(monthlyChampion.name) : 'No champion yet'}</div>
                        <div class="meta">${monthlyChampion ? `${_fmtNumber(monthlyChampion.monthlyStars)}⭐ this month` : 'Awaiting first monthly stars'}</div>
                    </div>
                </div>
            </div>
            <div class="guild-heroes-champion-card" style="--gh-primary:${guild.colors.secondary};--gh-secondary:${guild.colors.primary};">
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
    const maxStars = guild.heroesTop.length ? Math.max(...guild.heroesTop.map(h => h.totalStars)) : 1;
    
    const rows = guild.heroesTop.length
        ? guild.heroesTop.map((h, idx) => {
            const rankClass = idx === 0 ? 'top-1' : idx === 1 ? 'top-2' : idx === 2 ? 'top-3' : '';
            const badgeClass = idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : 'other';
            const rankIcon = idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
            const progressPct = maxStars > 0 ? (h.totalStars / maxStars) * 100 : 0;
            
            return `
                <div class="guild-heroes-leaderboard-item ${rankClass}">
                    <div class="guild-heroes-rank-badge ${badgeClass}">${rankIcon}</div>
                    ${_heroAvatar(h, guild.colors.primary)}
                    <div class="guild-heroes-hero-info">
                        <div class="name">${_escapeHtml(h.name)}</div>
                        <div class="meta">${_escapeHtml(h.heroClass)} · ${_escapeHtml(h.className)}</div>
                        <div class="guild-heroes-progress-bar">
                            <div class="guild-heroes-progress-fill" style="width: ${progressPct}%"></div>
                        </div>
                    </div>
                    <div class="guild-heroes-stat">
                        <div class="value">${_fmtNumber(h.totalStars)}</div>
                        <div class="label">Total ⭐</div>
                    </div>
                    <div class="guild-heroes-stat">
                        <div class="value">${_fmtNumber(h.monthlyStars)}</div>
                        <div class="label">Month ⭐</div>
                    </div>
                    <div class="guild-heroes-stat">
                        <div class="value">${_fmtOne(h.contributionPct)}%</div>
                        <div class="label">Share</div>
                    </div>
                </div>
            `;
        }).join('')
        : `<div class="guild-heroes-empty">No heroes in this guild yet. Be the first!</div>`;

    return `
        <div class="guild-heroes-leaderboard">
            <div class="guild-heroes-leaderboard-header">
                <h4>⚔️ Top Heroes of ${_escapeHtml(guild.guildName)}</h4>
            </div>
            <div class="guild-heroes-leaderboard-list">
                ${rows}
            </div>
        </div>
    `;
}

function _renderAllHeroesView(payload, guild) {
    const selected = _allHeroesForSelectedGuild(guild);
    
    const selectedRows = selected.length
        ? selected.map((h, idx) => {
            const badgeClass = idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : 'other';
            return `
                <div class="guild-heroes-leaderboard-item">
                    <div class="guild-heroes-rank-badge ${badgeClass}">#${idx + 1}</div>
                    ${_heroAvatar(h, guild.colors.primary)}
                    <div class="guild-heroes-hero-info" style="flex:1">
                        <div class="name">${_escapeHtml(h.name)}</div>
                        <div class="meta">${_escapeHtml(h.heroClass)} · ${_escapeHtml(h.className)}</div>
                    </div>
                    <div class="guild-heroes-stat">
                        <div class="value">${_fmtNumber(h.totalStars)}</div>
                        <div class="label">Total ⭐</div>
                    </div>
                    <div class="guild-heroes-stat">
                        <div class="value">${_fmtNumber(h.monthlyStars)}</div>
                        <div class="label">Month ⭐</div>
                    </div>
                </div>
            `;
        }).join('')
        : `<div class="guild-heroes-empty">No heroes in this guild yet.</div>`;

    return `
        <div class="guild-heroes-leaderboard">
            <div class="guild-heroes-leaderboard-header">
                <h4>📋 ${_escapeHtml(guild.guildName)} Roster</h4>
            </div>
            <div class="guild-heroes-leaderboard-list">
                ${selectedRows}
            </div>
        </div>
    `;
}

function _renderHealthView(payload, guild) {
    const leader = payload.guilds[0];
    const activeRate = guild.breakdown.activeRatePct || 0;
    const top3Share = guild.breakdown.top3SharePct || 0;
    
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
            <div class="guild-heroes-health-card">
                <h4>💚 Team Health Metrics</h4>
                
                <div class="guild-heroes-health-metric">
                    <div class="icon">⚡</div>
                    <div class="info">
                        <div class="label">Active Heroes This Month</div>
                        <div class="value">${_fmtNumber(guild.breakdown.activeHeroes)} / ${_fmtNumber(guild.totals.memberCount)}</div>
                        <div class="guild-heroes-health-bar">
                            <div class="guild-heroes-health-fill" style="width: ${activeRate}%"></div>
                        </div>
                    </div>
                    <div class="guild-heroes-stat">
                        <div class="value">${_fmtOne(activeRate)}%</div>
                    </div>
                </div>
                
                <div class="guild-heroes-health-metric">
                    <div class="icon">⭐</div>
                    <div class="info">
                        <div class="label">Top 3 Heroes Power Share</div>
                        <div class="value">${_fmtOne(top3Share)}% of guild total</div>
                        <div class="guild-heroes-health-bar">
                            <div class="guild-heroes-health-fill" style="width: ${Math.min(top3Share, 100)}%"></div>
                        </div>
                    </div>
                </div>
                
                <div class="guild-heroes-health-metric">
                    <div class="icon">🏆</div>
                    <div class="info">
                        <div class="label">Guild Rank</div>
                        <div class="value">#${_fmtNumber(guild.comparison.rankByPerCapita)} by per-member stars</div>
                    </div>
                </div>
                
                <div class="guild-heroes-rivalry">${rivalryLine}</div>
            </div>
            
            <div class="guild-heroes-panel">
                <h4>📊 Class Breakdown</h4>
                <h5>Class Contributions</h5>
                <ul class="guild-heroes-bullets">${classContrib}</ul>
                <h5>Hero Class Mix</h5>
                <ul class="guild-heroes-bullets">${heroClassMix}</ul>
            </div>
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
