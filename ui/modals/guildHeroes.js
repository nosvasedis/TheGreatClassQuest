// /ui/modals/guildHeroes.js

import { getGuildHeroAnalytics } from '../../features/guildHeroAnalytics.js';
import { getGuildEmblemUrl } from '../../features/guilds.js';
import { hideModal, showAnimatedModal } from './base.js';
import * as state from '../../state.js';

let _wired = false;
let _selectedGuildId = null;
let _activeView = 'overview';
let _unsubscribeRealtime = null;
let _cachedPayload = null;
let _rosterSearch = '';
let _rosterSort = 'total_desc'; // total_desc | month_desc | name_asc | class_asc

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

function _renderGuildRoleBadges(hero, guild) {
    if (!hero || !guild) return '';
    const badges = [];

    if (guild.champions.monthlyChampion?.studentId === hero.studentId) {
        badges.push(`<span class="guild-heroes-role-badge champion">⚔️ Champion</span>`);
    }
    if (guild.champions.allTimeChampion?.studentId === hero.studentId) {
        badges.push(`<span class="guild-heroes-role-badge top-hero">🏅 Top Hero</span>`);
    }

    if (!badges.length) return '';
    return `<div class="guild-heroes-role-badges">${badges.join('')}</div>`;
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
                    <span class="guild-heroes-rank">#${g.comparison.rankByGuildPower}</span>
                    <span class="guild-heroes-name">${_guildEmblem(g)} ${_escapeHtml(g.guildName)}</span>
                </div>
                <div class="guild-heroes-overview-body">
                    ${_heroAvatar(champ, g.colors.primary)}
                    <div class="guild-heroes-overview-meta">
                        <div class="guild-heroes-overview-line"><strong>${Math.round(g.totals.guildPower)}</strong> ⚡ Power · <strong>${_fmtNumber(g.totals.totalGlory)}</strong> ⚜️ Glory</div>
                        <div class="guild-heroes-overview-line">${g.totals.momentumArrow} ${champ ? `${_escapeHtml(champ.name)} · ${_fmtNumber(champ.monthlyStars)}⭐` : 'No monthly champion yet'}</div>
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
            <div class="guild-heroes-kpi"><span>⚡ Guild Power</span><strong>${Math.round(guild.totals.guildPower)}</strong></div>
            <div class="guild-heroes-kpi"><span>⚜️ Total Glory</span><strong>${_fmtNumber(guild.totals.totalGlory)}</strong></div>
            <div class="guild-heroes-kpi"><span>⚜️ / Member</span><strong>${_fmtOne(guild.totals.perCapitaGlory)}</strong></div>
            <div class="guild-heroes-kpi"><span>${guild.totals.momentumArrow} Momentum</span><strong>${_fmtOne(guild.totals.momentumScore)}</strong></div>
            <div class="guild-heroes-kpi"><span>🔥 Activity</span><strong>${_fmtOne(guild.totals.activityScore)}</strong></div>
            <div class="guild-heroes-kpi"><span>⚜️ This Week</span><strong>${_fmtNumber(guild.totals.weeklyGlory)}</strong></div>
            <div class="guild-heroes-kpi"><span>⭐ Total Stars</span><strong>${_fmtNumber(guild.totals.totalStars)}</strong></div>
            <div class="guild-heroes-kpi"><span>👥 Members</span><strong>${_fmtNumber(guild.totals.memberCount)}</strong></div>
        </div>
    `;
}

function _renderWheelPanel(guild) {
    const now = Date.now();
    const activeMods = (state.get('allGuildScores')?.[guild.guildId]?.gloryModifiers || [])
        .filter(m => (Number(m.expiresAt) || 0) > now)
        .sort((a, b) => (Number(a.expiresAt) || 0) - (Number(b.expiresAt) || 0));

    const modsHtml = activeMods.length
        ? `<div class="gh-wheel-mods">
                ${activeMods.slice(0, 6).map(m => {
                    const ms = Math.max(0, (Number(m.expiresAt) || 0) - now);
                    const hrs = Math.floor(ms / 3_600_000);
                    const mins = Math.floor((ms % 3_600_000) / 60_000);
                    const eta = hrs > 0 ? `${hrs}h ${mins}m` : `${Math.max(mins, 1)}m`;
                    const label = _escapeHtml(m.label || m.type || 'Effect');
                    return `<div class="gh-wheel-mod">
                        <div class="t">${label}</div>
                        <div class="s">⏳ ${eta} left</div>
                    </div>`;
                }).join('')}
           </div>`
        : `<div class="gh-wheel-empty">No active Wheel modifiers right now.</div>`;

    const logs = state.get('fortuneWheelLog') || [];
    const omenRows = logs.flatMap(entry => {
        const spunAt = entry.spunAt?.toDate ? entry.spunAt.toDate() : (entry.spunAt ? new Date(entry.spunAt) : null);
        const dateStr = spunAt ? spunAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
        const results = Array.isArray(entry.results) ? entry.results : [];
        return results
            .filter(r => r?.guildId === guild.guildId)
            .map(r => ({
                dateStr,
                weekKey: entry.weekKey || '',
                segmentLabel: r.segmentLabel || r.segmentId || 'Omen',
                gloryDelta: Number(r.gloryDelta) || 0
            }));
    }).slice(0, 6);

    const omensHtml = omenRows.length
        ? `<div class="gh-wheel-omens">
                ${omenRows.map(o => `
                    <div class="gh-wheel-omen">
                        <div class="a">
                            <div class="t">${_escapeHtml(o.segmentLabel)}</div>
                            <div class="s">${_escapeHtml(o.dateStr)}${o.weekKey ? ` · ${_escapeHtml(o.weekKey)}` : ''}</div>
                        </div>
                        <div class="b ${o.gloryDelta < 0 ? 'neg' : 'pos'}">
                            ${o.gloryDelta === 0 ? '—' : `${o.gloryDelta > 0 ? '+' : ''}${o.gloryDelta} ⚜️`}
                        </div>
                    </div>
                `).join('')}
           </div>`
        : `<div class="gh-wheel-empty">No recent omens for this guild yet.</div>`;

    return `
        <div class="gh-wheel-panel">
            <div class="gh-wheel-panel__head">
                <div class="gh-wheel-panel__title">Wheel of Fortune</div>
                <div class="gh-wheel-panel__subtitle">Recent omens and active modifiers for this guild</div>
            </div>
            <div class="gh-wheel-panel__grid">
                <section class="gh-wheel-card">
                    <div class="h">🧿 Recent Omens</div>
                    ${omensHtml}
                </section>
                <section class="gh-wheel-card">
                    <div class="h">✨ Active Modifiers</div>
                    ${modsHtml}
                </section>
            </div>
        </div>
    `;
}

function _renderOverviewView(payload, guild) {
    const leader = payload.guilds[0];
    const rivalryLine = leader && leader.guildId !== guild.guildId
        ? `Rivalry: ${_escapeHtml(guild.guildName)} trails ${_escapeHtml(leader.guildName)} by ${_fmtNumber(guild.comparison.deltaToLeaderGlory)} Glory.`
        : `${_escapeHtml(guild.guildName)} is currently leading the guild race!`;
    const mover = payload.overview?.biggestMover;
    const active = payload.overview?.mostActive;
    return `
        ${_renderKpis(guild)}
        <div class="gh-snapshot-grid">
            <section class="guild-heroes-fancy-banner">
                <div class="title">Guild Storyline</div>
                <p>${rivalryLine}</p>
                <p>Top 3 heroes carry <strong>${_fmtOne(guild.breakdown.top3SharePct)}%</strong> of this guild's total power.</p>
                ${mover ? `<p>📈 <strong>${_escapeHtml(mover.guildName)}</strong> is this week's biggest mover (${_fmtOne(mover.momentumPct)}% momentum).</p>` : ''}
                ${active ? `<p>🔥 <strong>${_escapeHtml(active.guildName)}</strong> has the highest activity score (${_fmtOne(active.activityScore)}).</p>` : ''}
            </section>
            ${_renderWheelPanel(guild)}
        </div>
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
                        ${_renderGuildRoleBadges(h, guild)}
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

    const q = String(_rosterSearch || '').trim().toLowerCase();
    const filtered = q
        ? selected.filter(h => {
            const hay = `${h.name || ''} ${h.heroClass || ''} ${h.className || ''}`.toLowerCase();
            return hay.includes(q);
        })
        : selected;

    const sorted = [...filtered];
    if (_rosterSort === 'month_desc') {
        sorted.sort((a, b) => b.monthlyStars - a.monthlyStars || b.totalStars - a.totalStars || a.name.localeCompare(b.name));
    } else if (_rosterSort === 'name_asc') {
        sorted.sort((a, b) => a.name.localeCompare(b.name) || b.totalStars - a.totalStars);
    } else if (_rosterSort === 'class_asc') {
        sorted.sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name));
    } else {
        sorted.sort((a, b) => b.totalStars - a.totalStars || b.monthlyStars - a.monthlyStars || a.name.localeCompare(b.name));
    }
    
    const selectedRows = sorted.length
        ? sorted.map((h, idx) => {
            const badgeClass = idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : 'other';
            return `
                <div class="guild-heroes-leaderboard-item">
                    <div class="guild-heroes-rank-badge ${badgeClass}">#${idx + 1}</div>
                    ${_heroAvatar(h, guild.colors.primary)}
                    <div class="guild-heroes-hero-info" style="flex:1">
                        <div class="name">${_escapeHtml(h.name)}</div>
                        ${_renderGuildRoleBadges(h, guild)}
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
        : `<div class="guild-heroes-empty">${q ? 'No matching heroes.' : 'No heroes in this guild yet.'}</div>`;

    return `
        <div class="guild-heroes-leaderboard">
            <div class="guild-heroes-leaderboard-header">
                <div class="gh-roster-head">
                    <h4>📋 ${_escapeHtml(guild.guildName)} Roster</h4>
                    <div class="gh-roster-controls">
                        <input class="gh-roster-search" type="search" value="${_escapeHtml(_rosterSearch)}" placeholder="Search heroes…" data-roster-search="true" />
                        <select class="gh-roster-sort" data-roster-sort="true">
                            <option value="total_desc" ${_rosterSort === 'total_desc' ? 'selected' : ''}>Sort: Total ⭐</option>
                            <option value="month_desc" ${_rosterSort === 'month_desc' ? 'selected' : ''}>Sort: Month ⭐</option>
                            <option value="name_asc" ${_rosterSort === 'name_asc' ? 'selected' : ''}>Sort: Name</option>
                            <option value="class_asc" ${_rosterSort === 'class_asc' ? 'selected' : ''}>Sort: Class</option>
                        </select>
                    </div>
                </div>
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
        ? `Needs ${_fmtNumber(guild.comparison.deltaToLeaderGlory)} more Glory to match #1 ${_escapeHtml(leader.guildName)}.`
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
                        <div class="label">Guild Power Rank</div>
                        <div class="value">#${_fmtNumber(guild.comparison.rankByGuildPower)} by ⚡ Guild Power</div>
                    </div>
                </div>
                
                <div class="guild-heroes-health-metric">
                    <div class="icon">${guild.totals.momentumArrow}</div>
                    <div class="info">
                        <div class="label">Momentum</div>
                        <div class="value">${_fmtOne(guild.totals.momentumScore)} score · ${_fmtOne(guild.totals.momentumPct)}% week-over-week</div>
                        <div class="guild-heroes-health-bar">
                            <div class="guild-heroes-health-fill" style="width: ${Math.min(Math.max(guild.totals.momentumPct, 0), 100)}%"></div>
                        </div>
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
    if (subtitle) subtitle.textContent = `${guild.guildName} · Power Rank #${guild.comparison.rankByGuildPower} · Snapshot ${payload.generatedAtMonthKey}`;

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

function _startRealtimeIfOpen() {
    const modal = document.getElementById('guild-heroes-modal');
    if (!modal || modal.classList.contains('hidden')) return;

    // Tear down any previous subscription
    if (_unsubscribeRealtime) {
        try { _unsubscribeRealtime(); } catch (_) { }
        _unsubscribeRealtime = null;
    }

    // Subscribe to state keys that affect analytics
    _unsubscribeRealtime = state.subscribe(
        ['allGuildScores', 'allStudents', 'allStudentScores', 'guildChampions', 'fortuneWheelLog', 'allSchoolClasses'],
        () => {
            // Only recompute when open; otherwise keep it cheap
            const m = document.getElementById('guild-heroes-modal');
            if (!m || m.classList.contains('hidden')) return;
            _cachedPayload = getGuildHeroAnalytics();
            _renderAll(_cachedPayload);
        }
    );
}

function _stopRealtime() {
    if (_unsubscribeRealtime) {
        try { _unsubscribeRealtime(); } catch (_) { }
        _unsubscribeRealtime = null;
    }
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
            _renderAll(_cachedPayload || getGuildHeroAnalytics());
            return;
        }
        const viewBtn = e.target.closest('[data-view-switch]');
        if (viewBtn) {
            _activeView = viewBtn.dataset.viewSwitch || 'overview';
            _renderAll(_cachedPayload || getGuildHeroAnalytics());
        }
    });

    // Input events (roster search/sort)
    modal.addEventListener('input', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.dataset.rosterSearch === 'true') {
            _rosterSearch = target.value || '';
            _renderAll(_cachedPayload || getGuildHeroAnalytics());
        }
    });
    modal.addEventListener('change', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.dataset.rosterSort === 'true') {
            _rosterSort = target.value || 'total_desc';
            _renderAll(_cachedPayload || getGuildHeroAnalytics());
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (modal.classList.contains('hidden')) return;
        hideModal('guild-heroes-modal');
    });

    // Cleanup when modal is hidden (handles close from other codepaths too)
    const observer = new MutationObserver(() => {
        if (modal.classList.contains('hidden')) {
            _stopRealtime();
        }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
}

export function openGuildHeroesModal(initialGuildId) {
    _wireListeners();
    _cachedPayload = getGuildHeroAnalytics();
    const payload = _cachedPayload;
    _selectedGuildId = initialGuildId || payload.guilds[0]?.guildId || null;
    _activeView = 'overview';
    _renderAll(payload);
    showAnimatedModal('guild-heroes-modal');
    _startRealtimeIfOpen();
}
