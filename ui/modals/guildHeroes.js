// /ui/modals/guildHeroes.js — Guild spotlight modal (tabbed, plain-language copy)

import { getGuildHeroAnalytics } from '../../features/guildHeroAnalytics.js';
import { getGuildEmblemUrl } from '../../features/guilds.js';
import { hideModal, showAnimatedModal } from './base.js';
import * as state from '../../state.js';
import { GLORY_EMOJI } from '../../constants.js';

let _wired = false;
let _selectedGuildId = null;
/** @type {'glance'|'heroes'|'wheel'|'together'} */
let _activeView = 'glance';
let _unsubscribeRealtime = null;
let _cachedPayload = null;
let _rosterSearch = '';
let _rosterSort = 'total_desc';

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

function _momentumSentence(guild) {
    const pct = Number(guild.totals.momentumPct) || 0;
    const arrow = guild.totals.momentumArrow || '';
    if (Math.abs(pct) < 0.5) return `${arrow} About the same Glory pace as last week.`;
    const dir = pct > 0 ? 'up' : 'down';
    return `${arrow} Glory is ${dir} about ${_fmtOne(Math.abs(pct))}% compared to last week.`;
}

function _rankPhrase(guild, payload) {
    const r = guild.comparison.rankByGuildPower;
    const leader = payload.guilds[0];
    if (!leader) return '';
    if (guild.guildId === leader.guildId) return `Your guild is #1 for Guild Power right now.`;
    const gap = guild.comparison.deltaToLeaderGlory || 0;
    return `#${r} of ${payload.guilds.length}. About ${_fmtNumber(gap)} ${GLORY_EMOJI} behind ${leader.guildName}.`;
}

function _renderOverviewCards(payload) {
    const wrap = document.getElementById('guild-heroes-overview');
    if (!wrap) return;
    wrap.innerHTML = payload.guilds.map((g) => {
        const champ = g.champions.monthlyChampion;
        return `
            <button type="button" class="guild-heroes-overview-card ${g.guildId === _selectedGuildId ? 'active' : ''}"
                    data-guild-switch="${g.guildId}"
                    style="--gh-primary:${g.colors.primary};--gh-glow:${g.colors.glow};--gh-secondary:${g.colors.secondary};">
                <div class="guild-heroes-overview-head">
                    <span class="guild-heroes-rank">#${g.comparison.rankByGuildPower}</span>
                    <span class="guild-heroes-name">${_guildEmblem(g)} ${_escapeHtml(g.guildName)}</span>
                </div>
                <div class="guild-heroes-overview-body">
                    ${_heroAvatar(champ, g.colors.primary)}
                    <div class="guild-heroes-overview-meta">
                        <div class="guild-heroes-overview-line"><strong>${Math.round(g.totals.guildPower)}</strong> power · <strong>${_fmtNumber(g.totals.totalGlory)}</strong> ${GLORY_EMOJI}</div>
                        <div class="guild-heroes-overview-line">${champ ? `${_escapeHtml(champ.name)} · ${_fmtNumber(champ.monthlyStars)}⭐ this month` : 'Pick your guild above'}</div>
                    </div>
                </div>
            </button>`;
    }).join('');
}

function _renderViewTabs() {
    const tabs = document.getElementById('guild-heroes-view-tabs');
    if (!tabs) return;
    const options = [
        ['glance', '✨ At a glance'],
        ['heroes', '⚔️ Heroes'],
        ['wheel', '🎡 Wheel'],
        ['together', '🤝 Our team']
    ];
    tabs.innerHTML = options.map(([id, label]) => `
        <button type="button" role="tab" class="guild-heroes-view-tab ${_activeView === id ? 'active' : ''}"
                data-view-switch="${id}" aria-selected="${_activeView === id ? 'true' : 'false'}">
            ${label}
        </button>
    `).join('');
}

function _renderWheelPanel(guild) {
    const now = Date.now();
    const activeMods = (state.get('allGuildScores')?.[guild.guildId]?.gloryModifiers || [])
        .filter(m => (Number(m.expiresAt) || 0) > now)
        .sort((a, b) => (Number(a.expiresAt) || 0) - (Number(b.expiresAt) || 0));

    const modsHtml = activeMods.length
        ? `<div class="gh-wheel-mods">
                ${activeMods.slice(0, 8).map(m => {
                    const ms = Math.max(0, (Number(m.expiresAt) || 0) - now);
                    const hrs = Math.floor(ms / 3_600_000);
                    const mins = Math.floor((ms % 3_600_000) / 60_000);
                    const eta = hrs > 0 ? `${hrs}h ${mins}m` : `${Math.max(mins, 1)}m`;
                    const label = _escapeHtml(m.label || m.type || 'Boost');
                    return `<div class="gh-wheel-mod">
                        <div class="t">${label}</div>
                        <div class="s">${eta} left</div>
                    </div>`;
                }).join('')}
           </div>`
        : `<div class="gh-wheel-empty">No lucky boosts active right now — spin the Wheel when it opens!</div>`;

    const logs = state.get('fortuneWheelLog') || [];
    const omenRows = logs.flatMap(entry => {
        const spunAt = entry.spunAt?.toDate ? entry.spunAt.toDate() : (entry.spunAt ? new Date(entry.spunAt) : null);
        const dateStr = spunAt ? spunAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
        const results = Array.isArray(entry.results) ? entry.results : [];
        return results
            .filter(r => r?.guildId === guild.guildId)
            .map(r => ({
                dateStr,
                segmentLabel: r.segmentLabel || r.segmentId || 'Spin',
                gloryDelta: Number(r.gloryDelta) || 0
            }));
    }).slice(0, 8);

    const omensHtml = omenRows.length
        ? `<div class="gh-wheel-omens">
                ${omenRows.map(o => `
                    <div class="gh-wheel-omen">
                        <div class="a">
                            <div class="t">${_escapeHtml(o.segmentLabel)}</div>
                            <div class="s">${_escapeHtml(o.dateStr)}</div>
                        </div>
                        <div class="b ${o.gloryDelta < 0 ? 'neg' : 'pos'}">
                            ${o.gloryDelta === 0 ? '—' : `${o.gloryDelta > 0 ? '+' : ''}${o.gloryDelta} ${GLORY_EMOJI}`}
                        </div>
                    </div>
                `).join('')}
           </div>`
        : `<div class="gh-wheel-empty">No Wheel results for this guild yet.</div>`;

    return `
        <div class="gh-wheel-panel gh-wheel-panel--modal">
            <div class="gh-wheel-panel__grid">
                <section class="gh-wheel-card">
                    <div class="h">Recent spins</div>
                    ${omensHtml}
                </section>
                <section class="gh-wheel-card">
                    <div class="h">Active boosts</div>
                    ${modsHtml}
                </section>
            </div>
        </div>`;
}

function _renderGlanceView(payload, guild) {
    const t = guild.totals;
    const activityPct = Math.round(Number(t.activityScore) || 0);
    return `
        <div class="gh-spotlight">
            <div class="gh-spotlight-hero" style="--gh-spot:${guild.colors.primary};--gh-spot-glow:${guild.colors.glow};">
                <div class="gh-spotlight-hero__icon">${_guildEmblem(guild)}</div>
                <div class="gh-spotlight-hero__text">
                    <div class="gh-spotlight-hero__name">${_escapeHtml(guild.guildName)}</div>
                    <p class="gh-spotlight-hero__lede">${_rankPhrase(guild, payload)}</p>
                </div>
            </div>
            <div class="gh-stat-grid">
                <div class="gh-stat-tile">
                    <span class="gh-stat-tile__label">Guild Power</span>
                    <span class="gh-stat-tile__value">${Math.round(t.guildPower)}</span>
                    <span class="gh-stat-tile__hint">Overall strength score</span>
                </div>
                <div class="gh-stat-tile">
                    <span class="gh-stat-tile__label">Total ${GLORY_EMOJI}</span>
                    <span class="gh-stat-tile__value">${_fmtNumber(t.totalGlory)}</span>
                    <span class="gh-stat-tile__hint">${_fmtOne(t.perCapitaGlory)} per hero on average</span>
                </div>
                <div class="gh-stat-tile">
                    <span class="gh-stat-tile__label">Weekly pace</span>
                    <span class="gh-stat-tile__value">${t.momentumArrow} ${_fmtOne(Math.abs(t.momentumPct))}%</span>
                    <span class="gh-stat-tile__hint">${_momentumSentence(guild)}</span>
                </div>
                <div class="gh-stat-tile">
                    <span class="gh-stat-tile__label">Showing up</span>
                    <span class="gh-stat-tile__value">${activityPct}%</span>
                    <span class="gh-stat-tile__hint">Heroes who earned stars this week</span>
                </div>
            </div>
            <p class="gh-soft-note">${_fmtNumber(t.weeklyGlory)} ${GLORY_EMOJI} earned this week · ${_fmtNumber(t.memberCount)} heroes in the guild</p>
        </div>`;
}

function _renderChampionCards(guild) {
    const monthlyChampion = guild.champions.monthlyChampion;
    const allTimeChampion = guild.champions.allTimeChampion;
    return `
        <div class="gh-heroes-section">
            <h4 class="gh-section-title">Standouts</h4>
            <div class="guild-heroes-champions">
                <div class="guild-heroes-champion-card" style="--gh-primary:${guild.colors.primary};--gh-secondary:${guild.colors.secondary};">
                    <div class="label">Star of the month</div>
                    <div class="body">
                        ${_heroAvatar(monthlyChampion, guild.colors.primary)}
                        <div>
                            <div class="name">${monthlyChampion ? _escapeHtml(monthlyChampion.name) : 'Waiting for the first star earners'}</div>
                            <div class="meta">${monthlyChampion ? `${_fmtNumber(monthlyChampion.monthlyStars)}⭐ this month` : ''}</div>
                        </div>
                    </div>
                </div>
                <div class="guild-heroes-champion-card" style="--gh-primary:${guild.colors.secondary};--gh-secondary:${guild.colors.primary};">
                    <div class="label">All-time strongest</div>
                    <div class="body">
                        ${_heroAvatar(allTimeChampion, guild.colors.secondary)}
                        <div>
                            <div class="name">${allTimeChampion ? _escapeHtml(allTimeChampion.name) : 'No totals yet'}</div>
                            <div class="meta">${allTimeChampion ? `${_fmtNumber(allTimeChampion.totalStars)}⭐ lifetime` : ''}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
}

function _renderTopHeroesCompact(guild) {
    const maxStars = guild.heroesTop.length ? Math.max(...guild.heroesTop.map(h => h.totalStars)) : 1;
    const rows = guild.heroesTop.length
        ? guild.heroesTop.map((h, idx) => {
            const rankIcon = idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
            const progressPct = maxStars > 0 ? (h.totalStars / maxStars) * 100 : 0;
            return `
                <div class="gh-top-row">
                    <span class="gh-top-rank">${rankIcon}</span>
                    ${_heroAvatar(h, guild.colors.primary)}
                    <div class="gh-top-info">
                        <div class="gh-top-name">${_escapeHtml(h.name)}</div>
                        <div class="gh-top-meta">${_escapeHtml(h.className)}</div>
                        <div class="gh-top-bar"><span style="width:${progressPct}%"></span></div>
                    </div>
                    <div class="gh-top-stars">${_fmtNumber(h.totalStars)}⭐</div>
                </div>`;
        }).join('')
        : `<div class="guild-heroes-empty">No heroes in this guild yet.</div>`;

    return `
        <div class="gh-heroes-section">
            <h4 class="gh-section-title">Star leaders</h4>
            <div class="gh-top-list">${rows}</div>
        </div>`;
}

function _renderRosterSection(payload, guild) {
    const selected = guild.heroesAll;
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
                </div>`;
        }).join('')
        : `<div class="guild-heroes-empty">${q ? 'No names match.' : 'No heroes yet.'}</div>`;

    return `
        <div class="gh-heroes-section">
            <div class="gh-roster-head">
                <h4 class="gh-section-title gh-section-title--inline">Everyone</h4>
                <div class="gh-roster-controls">
                    <input class="gh-roster-search" type="search" value="${_escapeHtml(_rosterSearch)}" placeholder="Find a hero…" data-roster-search="true" aria-label="Search roster" />
                    <select class="gh-roster-sort" data-roster-sort="true" aria-label="Sort roster">
                        <option value="total_desc" ${_rosterSort === 'total_desc' ? 'selected' : ''}>Most stars (all time)</option>
                        <option value="month_desc" ${_rosterSort === 'month_desc' ? 'selected' : ''}>Most stars (month)</option>
                        <option value="name_asc" ${_rosterSort === 'name_asc' ? 'selected' : ''}>Name A–Z</option>
                        <option value="class_asc" ${_rosterSort === 'class_asc' ? 'selected' : ''}>Class</option>
                    </select>
                </div>
            </div>
            <div class="guild-heroes-leaderboard-list gh-roster-list">${selectedRows}</div>
        </div>`;
}

function _renderHeroesView(payload, guild) {
    return `
        <div class="gh-heroes-stack">
            ${_renderChampionCards(guild)}
            ${_renderTopHeroesCompact(guild)}
            ${_renderRosterSection(payload, guild)}
        </div>`;
}

function _renderTogetherView(payload, guild) {
    const leader = payload.guilds[0];
    const active = guild.breakdown.activeHeroes || 0;
    const members = guild.totals.memberCount || 0;
    const rate = members > 0 ? Math.round((active / members) * 100) : 0;
    const top3 = guild.breakdown.top3SharePct || 0;

    const classBars = guild.breakdown.classContributions.length
        ? guild.breakdown.classContributions.slice(0, 6).map(c => `
            <div class="gh-class-row">
                <span class="gh-class-name">${_escapeHtml(c.className)}</span>
                <div class="gh-class-track"><span style="width:${Math.min(c.sharePct, 100)}%"></span></div>
                <span class="gh-class-pct">${_fmtOne(c.sharePct)}%</span>
            </div>`).join('')
        : `<p class="gh-soft-note">Class splits will show up once heroes earn stars.</p>`;

    const chase = leader && leader.guildId !== guild.guildId
        ? `To catch <strong>${_escapeHtml(leader.guildName)}</strong>, earn about <strong>${_fmtNumber(guild.comparison.deltaToLeaderGlory)}</strong> more ${GLORY_EMOJI} as a guild.`
        : `<strong>${_escapeHtml(guild.guildName)}</strong> is out front — keep the hall cheering!`;

    return `
        <div class="gh-together">
            <div class="gh-together-card">
                <h4 class="gh-section-title">Who’s playing this month</h4>
                <p class="gh-together-lede">${active} of ${members} heroes earned at least one star · ${rate}% joined in</p>
                <div class="gh-together-bar"><span style="width:${rate}%"></span></div>
            </div>
            <div class="gh-together-card">
                <h4 class="gh-section-title">Star balance</h4>
                <p class="gh-together-lede">Your top three heroes hold about <strong>${_fmtOne(top3)}%</strong> of the guild’s total stars.</p>
            </div>
            <div class="gh-together-card">
                <h4 class="gh-section-title">Stars by class</h4>
                <div class="gh-class-list">${classBars}</div>
            </div>
            <p class="gh-together-foot">${chase}</p>
        </div>`;
}

function _renderBody(payload) {
    const content = document.getElementById('guild-heroes-content');
    const subtitle = document.getElementById('guild-heroes-subtitle');
    if (!content) return;

    const guild = payload.guilds.find(g => g.guildId === _selectedGuildId) || payload.guilds[0];
    if (!guild) {
        content.innerHTML = `<div class="guild-heroes-empty">No guild data yet.</div>`;
        if (subtitle) subtitle.textContent = '';
        return;
    }

    _selectedGuildId = guild.guildId;
    if (subtitle) {
        subtitle.innerHTML = `<span class="gh-sub-pill" style="--gh-pill:${guild.colors.primary};">${_escapeHtml(guild.guildName)}</span><span class="gh-sub-muted">Power rank #${guild.comparison.rankByGuildPower}</span>`;
    }

    if (_activeView === 'heroes') content.innerHTML = _renderHeroesView(payload, guild);
    else if (_activeView === 'wheel') content.innerHTML = _renderWheelPanel(guild);
    else if (_activeView === 'together') content.innerHTML = _renderTogetherView(payload, guild);
    else content.innerHTML = _renderGlanceView(payload, guild);
}

function _renderAll(payload) {
    if (!payload.guilds.length) return;
    if (!_selectedGuildId || !payload.guilds.find(g => g.guildId === _selectedGuildId)) {
        _selectedGuildId = payload.guilds[0].guildId;
    }
    _renderOverviewCards(payload);
    _renderViewTabs();
    _renderBody(payload);
}

function _startRealtimeIfOpen() {
    const modal = document.getElementById('guild-heroes-modal');
    if (!modal || modal.classList.contains('hidden')) return;

    if (_unsubscribeRealtime) {
        try { _unsubscribeRealtime(); } catch (_) { }
        _unsubscribeRealtime = null;
    }

    _unsubscribeRealtime = state.subscribe(
        ['allGuildScores', 'allStudents', 'allStudentScores', 'guildChampions', 'fortuneWheelLog', 'allSchoolClasses'],
        () => {
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
            _activeView = /** @type {typeof _activeView} */ (viewBtn.dataset.viewSwitch || 'glance');
            _renderAll(_cachedPayload || getGuildHeroAnalytics());
        }
    });

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
    _activeView = 'glance';
    _rosterSearch = '';
    _rosterSort = 'total_desc';
    _renderAll(payload);
    showAnimatedModal('guild-heroes-modal');
    _startRealtimeIfOpen();
}
