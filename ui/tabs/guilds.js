// /ui/tabs/guilds.js — Guild Hall: crystal-column rankings, lore overlay, guild sounds, anthem modal

import { getGuildLeaderboardData } from '../../features/guildScoring.js';
import { getGuildBadgeHtml, getGuildById, getGuildEmblemUrl, GUILD_IDS, GUILDS } from '../../features/guilds.js';
import { openGuildHeroesModal } from '../modals/guildHeroes.js';
import { openFortunesWheel, advanceWheel, triggerSpin, closeFortunesWheel, canSpinThisWeek } from '../../features/fortunesWheel.js';
import { GLORY_EMOJI } from '../../constants.js';
import * as state from '../../state.js';
import { getGuildModifierChipPresentation, escapeHtmlAttr as _escapeChipAttr } from '../../features/wheelModifierUi.js';

// ─── Guild Power explainer overlay ───────────────────────────────────────────
let _powerExplainerWired = false;
function _ensurePowerExplainerOverlay() {
    if (_powerExplainerWired) return;
    _powerExplainerWired = true;

    // Create once (in case the template doesn't include it)
    if (!document.getElementById('guild-power-explainer-overlay')) {
        const el = document.createElement('div');
        el.id = 'guild-power-explainer-overlay';
        el.className = 'guild-power-explainer-overlay hidden';
        el.innerHTML = `
            <div class="guild-power-explainer-bg" data-gpex-close="true"></div>
            <div class="guild-power-explainer-card pop-in" role="dialog" aria-modal="true" aria-label="Guild Power explained">
                <button class="guild-power-explainer-close" data-gpex-close="true" aria-label="Close">✕</button>
                <div class="guild-power-explainer-title font-title">⚡ Guild Power</div>
                <p class="guild-power-explainer-copy">
                    Guild Power is a live composite score that helps compare guild momentum fairly, even when guild sizes differ.
                </p>
                <div class="guild-power-explainer-grid">
                    <div class="guild-power-explainer-item">
                        <div class="k">⚜️ Glory per member</div>
                        <div class="v">Most important input</div>
                    </div>
                    <div class="guild-power-explainer-item">
                        <div class="k">📈 Momentum</div>
                        <div class="v">Week-over-week Glory change</div>
                    </div>
                    <div class="guild-power-explainer-item">
                        <div class="k">🔥 Activity</div>
                        <div class="v">Active heroes this week</div>
                    </div>
                </div>
                <div class="guild-power-explainer-note">
                    Wheel effects can instantly change Glory and also add temporary modifiers that alter how future stars generate Glory.
                </div>
            </div>
        `;
        document.body.appendChild(el);
    }

    const overlay = document.getElementById('guild-power-explainer-overlay');
    if (!overlay) return;

    const close = () => overlay.classList.add('hidden');
    overlay.addEventListener('click', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.dataset.gpexClose === 'true') close();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close();
    });
}

function _openPowerExplainer() {
    _ensurePowerExplainerOverlay();
    document.getElementById('guild-power-explainer-overlay')?.classList.remove('hidden');
}

/** When true, detailed stats panels are visible for every guild column */
let _guildHallStatsExpanded = false;

// ─── Guild Power change tracking (for live arrow indicators) ─────────────────
const _prevGuildPower = new Map(); // guildId → { power, rank, lastPowerDelta, lastRankDelta }
let _guildPowerIndicatorsReady = false;

// ─── Sound cache ─────────────────────────────────────────────────────────────
const _audioCache = {};
function playGuildSound(guildId) {
    const guild = getGuildById(guildId);
    if (!guild?.sound) return;
    try {
        if (!_audioCache[guildId]) {
            _audioCache[guildId] = new Audio(guild.sound);
            _audioCache[guildId].volume = 0.65;
        }
        const audio = _audioCache[guildId];
        audio.currentTime = 0;
        audio.play().catch(() => { });
    } catch (_) { }
}

// ─── Anthem audio ─────────────────────────────────────────────────────────────
const _anthemCache = {};
let _currentAnthemId = null;
let _fadeTimer = null;
let _endFadeScheduled = false;
let _endFadeCleanup = null;
const FADE_BEFORE_END = 1.5; // seconds before track end to start auto-fade

function _cancelFade() {
    if (_fadeTimer !== null) { clearInterval(_fadeTimer); _fadeTimer = null; }
}

function _teardownEndFade() {
    if (_endFadeCleanup) { _endFadeCleanup(); _endFadeCleanup = null; }
    _endFadeScheduled = false;
}

function _setupEndFade(audio) {
    _teardownEndFade();

    function onTimeUpdate() {
        if (_endFadeScheduled) return;
        const dur = audio.duration;
        if (!dur || dur === Infinity) return;
        const remaining = dur - audio.currentTime;
        if (remaining > 0 && remaining <= FADE_BEFORE_END) {
            _endFadeScheduled = true;
            fadeOutAndStopAnthem(remaining * 1000);
        }
    }

    function onEnded() {
        // Fires if the fade didn't fully pause before the browser raised 'ended'
        _teardownEndFade();
        _cancelFade();
        _currentAnthemId = null;
        try { audio.volume = 0.80; audio.currentTime = 0; } catch (_) { }
    }

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    _endFadeCleanup = () => {
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('ended', onEnded);
    };
}

function playGuildAnthem(guildId) {
    _cancelFade();
    _teardownEndFade();
    const guild = getGuildById(guildId);
    if (!guild?.anthem) return;
    try {
        if (!_anthemCache[guildId]) {
            _anthemCache[guildId] = new Audio(guild.anthem);
        }
        const audio = _anthemCache[guildId];
        audio.loop = false; // play once; restart only on re-open
        audio.volume = 0.80;
        audio.currentTime = 0;
        _currentAnthemId = guildId;
        _setupEndFade(audio);
        audio.play().catch(() => { });
    } catch (_) { }
}

function fadeOutAndStopAnthem(duration = 1400) {
    _cancelFade();
    const id = _currentAnthemId;
    _currentAnthemId = null; // stop karaoke updates immediately
    if (!id || !_anthemCache[id]) return;
    const audio = _anthemCache[id];
    const steps = 28;
    const tick = duration / steps;
    const startV = audio.volume;
    let step = 0;
    _fadeTimer = setInterval(() => {
        step++;
        audio.volume = Math.max(0, startV * (1 - step / steps));
        if (step >= steps) {
            _cancelFade();
            try { audio.pause(); audio.currentTime = 0; } catch (_) { }
            audio.volume = 0.80; // restore for next play
        }
    }, tick);
}

// ─── Karaoke sync ─────────────────────────────────────────────────────────────
let _karaokeCleanup = null;

function ensureAnthemOverlayRoot() {
    const overlay = document.getElementById('guild-anthem-overlay');
    if (!overlay || overlay.parentElement === document.body) return overlay;
    document.body.appendChild(overlay);
    return overlay;
}

function startKaraokeSync(guildId) {
    stopKaraokeSync();
    const audio = _anthemCache[guildId];
    const lyricsEl = document.getElementById('guild-anthem-lyrics');
    if (!audio || !lyricsEl) return;

    const lines = Array.from(lyricsEl.querySelectorAll('.guild-anthem-line[data-time]'));
    if (!lines.length) return;

    let lastActiveIdx = -1;

    function onTimeUpdate() {
        if (!_currentAnthemId) return;
        const ct = audio.currentTime;
        let activeIdx = -1;
        for (let i = 0; i < lines.length; i++) {
            if (ct >= parseFloat(lines[i].dataset.time)) activeIdx = i;
        }
        if (activeIdx === lastActiveIdx) return;
        lastActiveIdx = activeIdx;
        lines.forEach((line, i) => {
            line.classList.toggle('karaoke-active', i === activeIdx);
            line.classList.toggle('karaoke-past', i < activeIdx);
            line.classList.toggle('karaoke-upcoming', i > activeIdx);
        });
        if (activeIdx >= 0) {
            lines[activeIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    audio.addEventListener('timeupdate', onTimeUpdate);
    _karaokeCleanup = () => audio.removeEventListener('timeupdate', onTimeUpdate);
}

function stopKaraokeSync() {
    if (_karaokeCleanup) { _karaokeCleanup(); _karaokeCleanup = null; }
    // reset all line states
    document.querySelectorAll('.guild-anthem-line').forEach(l => {
        l.classList.remove('karaoke-active', 'karaoke-past', 'karaoke-upcoming');
    });
}

// ─── Anthem modal ─────────────────────────────────────────────────────────────
function openAnthemModal(guildId) {
    const overlay = ensureAnthemOverlayRoot();
    const card = document.getElementById('guild-anthem-card');
    if (!overlay || !card) return;

    const guild = getGuildById(guildId);
    const primary = guild?.primary || '#7c3aed';
    const secondary = guild?.secondary || '#a78bfa';
    const glow = guild?.glow || primary;

    card.style.setProperty('--anthem-primary', primary);
    card.style.setProperty('--anthem-secondary', secondary);
    card.style.setProperty('--anthem-glow', glow);
    card.style.background = `linear-gradient(160deg, ${primary} 0%, ${secondary} 65%, ${primary}cc 100%)`;
    card.style.boxShadow = `0 0 0 1.5px rgba(255,255,255,0.2), 0 32px 80px rgba(0,0,0,0.7), 0 0 80px ${glow}55`;

    const titleEl = document.getElementById('guild-anthem-title');
    if (titleEl) titleEl.textContent = `${guild?.name || guildId} Anthem`;

    const lyricsEl = document.getElementById('guild-anthem-lyrics');
    if (lyricsEl && guild?.anthemLyrics) {
        lyricsEl.innerHTML = guild.anthemLyrics.map(section => {
            const sectionClass = section.type === 'chorus' ? 'guild-anthem-chorus' : 'guild-anthem-verse';
            const label = section.type === 'chorus' ? '🎶 Chorus' : '🎵 Verse';
            return `
                <div class="${sectionClass}">
                    <span class="guild-anthem-section-label">${label}</span>
                    ${section.lines.map(line =>
                `<p class="guild-anthem-line karaoke-upcoming" data-time="${line.time}">${line.text}</p>`
            ).join('')}
                </div>`;
        }).join('');
    }

    card.classList.remove('pop-in');
    void card.offsetWidth;
    card.classList.add('pop-in');

    overlay.classList.remove('hidden');
    playGuildAnthem(guildId);
    startKaraokeSync(guildId);
}

function closeAnthemModal() {
    stopKaraokeSync();
    _teardownEndFade();
    fadeOutAndStopAnthem();
    setTimeout(() => {
        document.getElementById('guild-anthem-overlay')?.classList.add('hidden');
    }, 300);
}

function wireAnthemListeners() {
    const overlay = ensureAnthemOverlayRoot();
    if (!overlay || overlay._anthemWired) return;
    overlay._anthemWired = true;

    document.getElementById('guild-anthem-close')?.addEventListener('click', closeAnthemModal);
    document.getElementById('guild-anthem-overlay-bg')?.addEventListener('click', closeAnthemModal);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAnthemModal();
    });
}

// ─── Lore overlay ────────────────────────────────────────────────────────────
function openGuildLore(guildId, gData) {
    const overlay = document.getElementById('guild-lore-overlay');
    const card = document.getElementById('guild-lore-card');
    if (!overlay || !card) return;

    const guild = getGuildById(guildId);
    const emblemUrl = getGuildEmblemUrl(guildId);
    const primary = guild?.primary || '#7c3aed';
    const secondary = guild?.secondary || '#a78bfa';
    const glow = guild?.glow || primary;
    const motto = guild?.motto || '';
    const traits = guild?.traits || [];

    // Style card with guild gradient
    card.style.background = `linear-gradient(145deg, ${primary} 0%, ${secondary} 70%, ${primary}cc 100%)`;
    card.style.setProperty('--lore-glow', glow);
    card.style.boxShadow = `
        inset 0 1px 0 rgba(255,255,255,0.22),
        0 0 0 1px rgba(0,0,0,0.12),
        0 36px 92px rgba(0,0,0,0.68),
        0 0 84px ${glow}52
    `.trim().replace(/\s+/g, ' ');

    // Emblem
    const emblemWrap = document.getElementById('guild-lore-emblem-wrap');
    if (emblemWrap) {
        const loreInitial = String(guild?.name || guildId || '?').trim().charAt(0).toUpperCase() || '?';
        emblemWrap.innerHTML = emblemUrl
            ? `<img src="${emblemUrl}" alt="${guild?.name}" class="guild-lore-emblem"
                    style="border-color: rgba(255,255,255,0.5); box-shadow: 0 0 40px ${glow}cc, 0 0 80px ${glow}55;">`
            : `<div class="guild-lore-emblem guild-lore-emblem-fallback"
                    style="background: rgba(255,255,255,0.15);">
                    <span class="guild-lore-emblem-initial" style="font-size:2.5rem;font-weight:800;color:${primary}">${loreInitial}</span>
               </div>`;
    }

    // Text fields
    const emojiEl = document.getElementById('guild-lore-emoji');
    const nameEl = document.getElementById('guild-lore-name');
    const mottoEl = document.getElementById('guild-lore-motto');
    const traitsEl = document.getElementById('guild-lore-traits');
    const statsEl = document.getElementById('guild-lore-stats');

    if (emojiEl) {
        emojiEl.textContent = '';
        emojiEl.hidden = true;
    }
    if (nameEl) nameEl.textContent = guild?.name || guildId;
    if (mottoEl) mottoEl.textContent = `"${motto}"`;
    if (traitsEl) {
        traitsEl.innerHTML = traits.map(t =>
            `<span class="guild-lore-trait" style="background:rgba(255,255,255,0.18);border-color:rgba(255,255,255,0.35);">${t}</span>`
        ).join('');
    }
    if (statsEl) {
        const stars = gData?.totalStars || 0;
        const perCapita = gData?.perCapitaStars || 0;
        const members = gData?.memberCount || 0;
        const guildPower = Math.round(Number(gData?.guildPower) || 0);
        const totalGlory = Math.round(Number(gData?.totalGlory) || 0);
        const weeklyGlory = Math.round(Number(gData?.weeklyGlory) || 0);
        const perCapitaGlory = Number(gData?.perCapitaGlory) || 0;

        statsEl.innerHTML = `
            <div class="guild-lore-metrics-primary">
                <div class="guild-lore-metric-tile guild-lore-metric-tile--power">
                    <div class="guild-lore-metric-tile__label">
                        <span aria-hidden="true">⚡</span> Guild Power
                        <button type="button" class="guild-lore-power-hint"
                            aria-label="Explain Guild Power" data-guild-lore-power-info="true">?</button>
                    </div>
                    <div class="guild-lore-metric-tile__value">${guildPower}</div>
                    <div class="guild-lore-metric-tile__hint">Composite leaderboard score</div>
                </div>
                <div class="guild-lore-metric-tile guild-lore-metric-tile--glory">
                    <div class="guild-lore-metric-tile__label">
                        <span aria-hidden="true">${GLORY_EMOJI}</span> Total Glory
                    </div>
                    <div class="guild-lore-metric-tile__value">${totalGlory}</div>
                    <div class="guild-lore-metric-tile__hint">
                        ${weeklyGlory} this week · ${perCapitaGlory.toFixed(1)} ${GLORY_EMOJI}/member
                    </div>
                </div>
            </div>
            <div class="guild-lore-metrics-secondary">
                <span class="guild-lore-stat guild-lore-stat--pill"><span aria-hidden="true">⭐</span> <strong>${stars}</strong> stars</span>
                <span class="guild-lore-stat guild-lore-stat--pill"><span aria-hidden="true">⚖️</span> <strong>${perCapita.toFixed(1)}</strong> ★/member</span>
                <span class="guild-lore-stat guild-lore-stat--pill"><span aria-hidden="true">👥</span> <strong>${members}</strong> member${members === 1 ? '' : 's'}</span>
            </div>`;
    }

    // Reset animation
    card.classList.remove('pop-in');
    void card.offsetWidth;
    card.classList.add('pop-in');

    overlay.classList.remove('hidden');

    // Glow the matching column emblem
    document.querySelectorAll('.guild-crystal-col').forEach(col => {
        col.classList.toggle('guild-active', col.dataset.guild === guildId);
    });

    playGuildSound(guildId);
}

function closeGuildLore() {
    document.getElementById('guild-lore-overlay')?.classList.add('hidden');
    document.querySelectorAll('.guild-crystal-col.guild-active').forEach(c => c.classList.remove('guild-active'));
}

function wireGuildLoreListeners() {
    const overlay = document.getElementById('guild-lore-overlay');
    if (!overlay || overlay._guildLoreWired) return;
    overlay._guildLoreWired = true;

    overlay.addEventListener('click', (e) => {
        const btn = e.target?.closest?.('[data-guild-lore-power-info="true"]');
        if (!btn) return;
        e.stopPropagation();
        e.preventDefault();
        _ensurePowerExplainerOverlay();
        _openPowerExplainer();
    });
    document.getElementById('guild-lore-close')?.addEventListener('click', closeGuildLore);
    document.getElementById('guild-lore-overlay-bg')?.addEventListener('click', closeGuildLore);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeGuildLore();
    });
}

// ─── Main render ─────────────────────────────────────────────────────────────
/**
 * Guild champion + next three by estimated lifetime Glory (stars × GLORY_PER_STAR).
 * Wheel-only guild adjustments are not attributed per student here; see scoring copy in the UI.
 */
function _buildGuildChampionPanel(g, primary) {
    const guildId = g.guildId;
    const spotlightBtn = `
                    <button type="button" class="guild-power-info-btn guild-analytics-info-btn guild-crystal-champion-panel__info"
                            data-top-heroes-guild="${guildId}"
                            title="Guild spotlight"
                            aria-label="Open guild spotlight">i</button>`;
    const header = `
                <header class="guild-crystal-champion-panel__header">
                    <span class="guild-crystal-champion-panel__burst" aria-hidden="true"><i class="fas fa-crown"></i></span>
                    <div class="guild-crystal-champion-panel__headlines">
                        <h4 class="guild-crystal-champion-panel__title">Top champion</h4>
                        <p class="guild-crystal-champion-panel__subtitle">${GLORY_EMOJI} Glory lead from lifetime stars</p>
                    </div>
                    ${spotlightBtn}
                </header>`;
    const champ = g.topContributors?.[0];
    if (!champ) {
        return `
            <section class="guild-crystal-champion-panel guild-crystal-champion-panel--balanced" style="--guild-champion-accent:${primary};" aria-label="Guild champion">
                ${header}
                <div class="guild-crystal-champion-panel__body">
                    <p class="guild-crystal-champion-panel__vacant" role="status">Throne vacant — the first spark will claim it.</p>
                </div>
            </section>`;
    }
    const glory = Number(champ.gloryEstimate) || 0;
    const initialHero = String(champ.name || '?').trim().charAt(0).toUpperCase() || '?';
    const avatarInner = champ.avatar
        ? `<img src="${champ.avatar}" alt="" class="guild-crystal-champion-panel__avatar-img" loading="lazy" decoding="async" width="44" height="44">`
        : `<span class="guild-crystal-champion-panel__avatar-fallback">${initialHero}</span>`;
    return `
            <section class="guild-crystal-champion-panel guild-crystal-champion-panel--balanced" style="--guild-champion-accent:${primary};" aria-label="Guild champion">
                ${header}
                <div class="guild-crystal-champion-panel__body">
                    <div class="guild-crystal-champion-panel__card" style="--hero-tile-accent:${primary};" title="${champ.name} — ${glory} ${GLORY_EMOJI} from lifetime stars">
                        <span class="guild-crystal-champion-panel__avatar" aria-hidden="true">${avatarInner}</span>
                        <span class="guild-crystal-champion-panel__text">
                            <span class="guild-crystal-champion-panel__name">${champ.name}</span>
                            <span class="guild-crystal-champion-panel__glory">
                                <span class="guild-crystal-champion-panel__glory-num">${glory}</span>
                                <span class="guild-crystal-champion-panel__glory-unit" aria-hidden="true">${GLORY_EMOJI}</span>
                                <span class="guild-crystal-champion-panel__glory-hint">from stars</span>
                            </span>
                        </span>
                        <span class="guild-crystal-champion-panel__medal" role="img" aria-label="First place">🥇</span>
                    </div>
                </div>
            </section>`;
}

export function renderGuildsTab() {
    const list = document.getElementById('guilds-leaderboard-list');
    if (!list) return;

    _ensurePowerExplainerOverlay();

    wireGuildLoreListeners();
    wireAnthemListeners();

    const rawData = getGuildLeaderboardData();

    // Always render all 4 guilds (zero stars = empty crystal, still looks great)
    const displayData = GUILD_IDS.map((gid) => {
        const found = rawData.find((d) => d.guildId === gid);
        const guild = GUILDS[gid];
        return {
            guildId: gid,
            guildName: guild?.name || gid,
            totalStars: found?.totalStars || 0,
            monthlyStars: found?.monthlyStars || 0,
            memberCount: found?.memberCount || 0,
            perCapitaStars: found?.perCapitaStars || 0,
            monthlyPerCapitaStars: found?.monthlyPerCapitaStars || 0,
            topContributors: found?.topContributors || [],
            // Glory & Power fields (must mirror getGuildLeaderboardData / calculateGuildPower)
            totalGlory: found?.totalGlory || 0,
            weeklyGlory: found?.weeklyGlory || 0,
            previousWeekGlory: found?.previousWeekGlory || 0,
            perCapitaGlory: found?.perCapitaGlory || 0,
            guildPower: found?.guildPower || 0,
            gloryScore: found?.gloryScore ?? 0,
            momentumScore: found?.momentumScore ?? 0,
            momentumPct: Number.isFinite(Number(found?.momentumPct))
                ? Math.round(Number(found.momentumPct))
                : 0,
            momentumArrow: found?.momentumArrow || '➡️',
            activityScore: found?.activityScore ?? 0,
            gloryModifiers: found?.gloryModifiers || [],
        };
    }).sort((a, b) => b.guildPower - a.guildPower || b.perCapitaGlory - a.perCapitaGlory || b.perCapitaStars - a.perCapitaStars);

    // ── Compute power deltas for live indicators ──────────────────────────────
    const powerDeltas = new Map(); // guildId → { powerDelta, rankDelta, prevPower, prevRank, freshChange }
    const isFirstRender = !_guildPowerIndicatorsReady;
    displayData.forEach((g, index) => {
        const prev = _prevGuildPower.get(g.guildId);
        if (prev) {
            const powerDelta = Math.round(g.guildPower) - prev.power;
            const rankDelta = prev.rank - index; // positive = moved up
            // If nothing changed, carry forward the last known trend
            if (powerDelta === 0 && rankDelta === 0) {
                powerDeltas.set(g.guildId, {
                    powerDelta: prev.lastPowerDelta || 0,
                    rankDelta: prev.lastRankDelta || 0,
                    prevPower: prev.power,
                    prevRank: prev.rank,
                    freshChange: false,
                });
            } else {
                powerDeltas.set(g.guildId, { powerDelta, rankDelta, prevPower: prev.power, prevRank: prev.rank, freshChange: true });
            }
        }
    });

    const rankLabels = ['1st', '2nd', '3rd', '4th'];

    const columns = displayData.map((g, index) => {
        const guild = getGuildById(g.guildId);
        const emblemUrl = getGuildEmblemUrl(g.guildId);
        const primary = guild?.primary || '#6b7280';
        const secondary = guild?.secondary || '#9ca3af';
        const glow = guild?.glow || primary;
        const initial = String(g.guildName || g.guildId || '?').trim().charAt(0).toUpperCase() || '?';
        // Fill based on Guild Power (composite score), leader gets 90%
        const maxPower = Math.max(...displayData.map(g => g.guildPower)) || 1;
        const fillPct = Math.max(5, Math.round((g.guildPower / maxPower) * 90));

        const emblemHtml = emblemUrl
            ? `<img src="${emblemUrl}" alt="${g.guildName}" class="guild-crystal-emblem"
                    style="border-color:${primary}; box-shadow: 0 0 16px ${glow}77;">`
            : `<div class="guild-crystal-emblem guild-crystal-emblem-fallback"
                    style="background:linear-gradient(135deg,${primary},${secondary}); box-shadow:0 0 16px ${glow}77;">
                   <span class="guild-crystal-emblem-initial" style="color:${primary}">${initial}</span>
               </div>`;

        const legendRunners = g.topContributors.slice(1, 4);
        const legendMedals = ['🥈', '🥉', '✨'];
        const legendPlaceLabels = ['2nd place', '3rd place', '4th place'];

        const topHeroesBody = legendRunners.length
            ? legendRunners.map((c, hi) => {
                const rankMedal = legendMedals[hi] || '✨';
                const placeLabel = legendPlaceLabels[hi] || `${hi + 2}nd place`;
                const initialHero = String(c.name || '?').trim().charAt(0).toUpperCase() || '?';
                const glory = Number(c.gloryEstimate) || 0;
                const avatarInner = c.avatar
                    ? `<img src="${c.avatar}" alt="" class="guild-crystal-hero-tile__avatar-img" loading="lazy" decoding="async" width="36" height="36">`
                    : `<span class="guild-crystal-hero-tile__avatar-fallback">${initialHero}</span>`;
                return `
                       <span class="guild-crystal-hero-tile"
                             style="--hero-tile-accent:${primary};"
                             title="${c.name} — ${glory} ${GLORY_EMOJI} from lifetime stars">
                           <span class="guild-crystal-hero-tile__avatar" aria-hidden="true">${avatarInner}</span>
                           <span class="guild-crystal-hero-tile__body">
                               <span class="guild-crystal-hero-tile__name">${c.name}</span>
                               <span class="guild-crystal-hero-tile__glory">
                                   <span class="guild-crystal-hero-tile__glory-num">${glory}</span>
                                   <span class="guild-crystal-hero-tile__glory-icon" aria-hidden="true">${GLORY_EMOJI}</span>
                                   <span class="guild-crystal-hero-tile__glory-hint">lifetime</span>
                               </span>
                           </span>
                           <span class="guild-crystal-hero-tile__medal" role="img" aria-label="${placeLabel}">${rankMedal}</span>
                       </span>`;
            }).join('')
            : (g.topContributors.length === 0
                ? `<p class="guild-crystal-heroes-panel__empty" role="status">Summon stars to crown your first legends.</p>`
                : `<p class="guild-crystal-heroes-panel__empty" role="status">The court awaits more guildmates ranked by ${GLORY_EMOJI}.</p>`);

        const championPanelHtml = _buildGuildChampionPanel(g, primary);

        const topHtml = `
            <section class="guild-crystal-heroes-panel guild-crystal-heroes-panel--balanced" style="--guild-heroes-accent:${primary};">
                <header class="guild-crystal-heroes-panel__header">
                    <span class="guild-crystal-heroes-panel__burst" aria-hidden="true"><i class="fas fa-dragon"></i></span>
                    <div class="guild-crystal-heroes-panel__headlines">
                        <h4 class="guild-crystal-heroes-panel__title">Legends of the guild</h4>
                        <p class="guild-crystal-heroes-panel__subtitle">Next warriors by lifetime ${GLORY_EMOJI} (from stars)</p>
                    </div>
                </header>
                <div class="guild-crystal-heroes-panel__roster">${topHeroesBody}</div>
            </section>`;

        const now = Date.now();
        const activeModsSorted = [...(g.gloryModifiers || [])]
            .filter((m) => (Number(m.expiresAt) || 0) > now)
            .sort((a, b) => (Number(a.expiresAt) || 0) - (Number(b.expiresAt) || 0));
        const shownWheelMods = activeModsSorted.slice(0, 2);
        const overflowMods = Math.max(0, activeModsSorted.length - shownWheelMods.length);
        const modsChipsInner = activeModsSorted.length
            ? `${shownWheelMods.map((m) => {
                const p = getGuildModifierChipPresentation(m);
                const headSafe = _escapeChipAttr((p.headlinePlain || '').slice(0, 64));
                return `<span class="guild-crystal-effect-chip" tabindex="0" aria-label="${p.headlineAttr}" title="${p.hoverExplainerAttr}">
                        <span class="guild-crystal-effect-chip__pulse" aria-hidden="true"></span>
                        <span class="guild-crystal-effect-chip__ico" aria-hidden="true"><i class="${p.iconClass}"></i></span>
                        <span class="guild-crystal-effect-chip__label">${headSafe}</span>
                    </span>`;
            }).join('')}
               ${overflowMods > 0 ? `
                    <span class="guild-crystal-effect-chip guild-crystal-effect-chip--more" tabindex="0"
                          aria-label="${_escapeChipAttr(`${overflowMods} more active Glory perk${overflowMods === 1 ? '' : 's'}`)}"
                          title="${_escapeChipAttr(`${overflowMods} more Glory perk${overflowMods === 1 ? '' : 's'} are stacking on this guild (${activeModsSorted.length} total right now). Open Guild spotlight (${GLORY_EMOJI} Legends card) → Wheel tab to read them all.`)}">
                        <span class="guild-crystal-effect-chip__ico" aria-hidden="true"><i class="fa-solid fa-layer-group"></i></span>
                        <span class="guild-crystal-effect-chip__label">+${overflowMods}</span>
                    </span>` : ''}`
            : `<p class="guild-crystal-effects-panel__empty" role="status"><span aria-hidden="true">✶</span> No wheel magic right now &mdash; spin Fortune's Wheel to stir the halls</p>`;

        const modsHtml = `
            <section class="guild-crystal-effects-panel guild-crystal-effects-panel--balanced" style="--guild-effects-accent:${primary};">
                <header class="guild-crystal-effects-panel__header">
                    <span class="guild-crystal-effects-panel__wheel" aria-hidden="true"><i class="fa-solid fa-dharmachakra"></i></span>
                    <div class="guild-crystal-effects-panel__headlines">
                        <h4 class="guild-crystal-effects-panel__title">Wheel boons</h4>
                        <p class="guild-crystal-effects-panel__subtitle">Blessings cast by Fortune's Wheel &mdash; hover a charm for what it actually does.</p>
                    </div>
                </header>
                <div class="guild-crystal-effects-panel__chips">${modsChipsInner}</div>
            </section>`;

        return `
            <div class="guild-crystal-col is-rank-${index + 1}${(() => { const d = powerDeltas.get(g.guildId); return (!isFirstRender && d && d.freshChange && d.rankDelta !== 0) ? ' guild-rank-changed' : ''; })()}" data-guild="${g.guildId}">

                <!-- ── Rank ── -->
                <div class="guild-crystal-rank"><span class="guild-crystal-rank__label">${rankLabels[index] || `#${index + 1}`}</span></div>

                <!-- ── Header section (fixed min-height so all columns align at tube start) ── -->
                <div class="guild-crystal-header">
                    <!-- Emblem is the click target for lore + sound; anthem btn lives inside, bottom-left -->
                    <div class="guild-crystal-emblem-wrapper"
                         data-guild-id="${g.guildId}"
                         role="button" tabindex="0"
                         aria-label="Discover ${g.guildName}"
                         style="--glow-color:${glow};">
                        ${emblemHtml}
                        <div class="guild-emblem-ring" style="border-color:${glow};box-shadow:0 0 24px ${glow}88;"></div>
                        <button class="guild-anthem-btn" data-anthem-guild="${g.guildId}"
                                aria-label="Play ${g.guildName} anthem"
                                style="--anthem-color:${primary};--anthem-glow:${glow};"><i class="fas fa-music" aria-hidden="true"></i></button>
                    </div>
                    <div class="guild-crystal-name" style="color:${primary};">${g.guildName}</div>
                </div>

                <!-- ── Crystal tube (fixed height, fills from bottom) ── -->
                <div class="guild-crystal-tube-wrap">
                    <div class="guild-crystal-tube"
                         style="border-color:${primary}44; box-shadow:inset 0 0 16px rgba(0,0,0,0.08), 0 0 32px ${glow}1a;">
                        <div class="guild-crystal-fill"
                             data-fill-target="${fillPct}"
                             style="height:5%;
                                    background:linear-gradient(to top,${primary} 0%,${secondary} 60%,${glow} 100%);
                                    box-shadow:0 -6px 28px ${glow}cc;">
                            <div class="guild-crystal-shimmer"></div>
                            <div class="guild-crystal-bubbles">
                                <span class="guild-bubble" style="--delay:0s;   --left:18%;--size:7px;background:${glow}aa"></span>
                                <span class="guild-bubble" style="--delay:0.7s; --left:50%;--size:5px;background:${glow}88"></span>
                                <span class="guild-bubble" style="--delay:1.4s; --left:76%;--size:6px;background:${glow}99"></span>
                                <span class="guild-bubble" style="--delay:2.1s; --left:35%;--size:4px;background:${glow}77"></span>
                            </div>
                        </div>
                        <div class="guild-crystal-glass-shine"></div>
                        <div class="guild-crystal-glow-top" style="background:radial-gradient(ellipse at 50% 0%,${glow}22,transparent 70%);"></div>
                    </div>
                </div>

                <!-- ── Bottom stats ── -->
                <div class="guild-crystal-count" style="color:${primary};">
                    <span class="guild-crystal-count-num${(() => { const d = powerDeltas.get(g.guildId); if (!d || isFirstRender) return ''; return d.powerDelta > 0 ? ' guild-power-boost' : d.powerDelta < 0 ? ' guild-power-drop' : ''; })()}" data-guild-id="${g.guildId}">${Math.round(g.guildPower)}</span>
                    ${(() => { const d = powerDeltas.get(g.guildId); if (!d || isFirstRender || d.powerDelta === 0) return ''; const dir = d.powerDelta > 0 ? 'up' : 'down'; const abs = Math.abs(d.powerDelta); return `<span class="guild-crystal-count-arrow guild-crystal-count-arrow--${dir}" aria-label="Power ${dir === 'up' ? 'increased' : 'decreased'} by ${abs}">${dir === 'up' ? '▲' : '▼'}<span class="guild-crystal-count-arrow__delta">${dir === 'up' ? '+' : '−'}${abs}</span></span>`; })()}
                    ${(() => { const d = powerDeltas.get(g.guildId); if (!d || isFirstRender || d.rankDelta === 0) return ''; return `<span class="guild-crystal-rank-change-badge" aria-label="Rank ${d.rankDelta > 0 ? 'up' : 'down'} by ${Math.abs(d.rankDelta)}">${d.rankDelta > 0 ? '⬆' : '⬇'} ${Math.abs(d.rankDelta)}</span>`; })()}
                    <span class="guild-crystal-count-label">
                        ⚡ Guild Power
                        <button class="guild-power-info-btn" type="button" aria-label="Explain Guild Power" data-guild-power-info="true">?</button>
                    </span>
                </div>

                <div id="guild-crystal-details-${g.guildId}" class="guild-crystal-details-expander ${_guildHallStatsExpanded ? 'is-expanded' : ''}">
                    <div class="guild-crystal-details">
                        <div class="guild-crystal-details-inner">
                            <div class="guild-crystal-metrics" style="--guild-metric-accent:${primary};">
                                <div class="guild-crystal-metric">
                                    <div class="guild-crystal-metric__label">Glory per member</div>
                                    <div class="guild-crystal-metric__value">${g.perCapitaGlory.toFixed(1)} <span class="guild-crystal-metric__unit">${GLORY_EMOJI}</span></div>
                                    <div class="guild-crystal-metric__hint">Average ⚜️ across roster</div>
                                </div>
                                <div class="guild-crystal-metric">
                                    <div class="guild-crystal-metric__label">Weekly momentum</div>
                                    <div class="guild-crystal-metric__value">${g.momentumArrow} ${g.momentumPct >= 0 ? '+' : ''}${g.momentumPct}%</div>
                                    <div class="guild-crystal-metric__hint">This week vs last week’s Glory</div>
                                </div>
                                <div class="guild-crystal-metric">
                                    <div class="guild-crystal-metric__label">Weekly activity</div>
                                    <div class="guild-crystal-metric__value">${Math.round(Number(g.activityScore) || 0)}%</div>
                                    <div class="guild-crystal-metric__hint">Members active this week</div>
                                </div>
                            </div>
                            <div class="guild-crystal-roster-ribbon" style="--guild-roster-accent:${primary};">
                                <div class="guild-crystal-roster-ribbon__seg" role="group" aria-label="Guild roster size">
                                    <span class="guild-crystal-roster-ribbon__eyebrow"><i class="fas fa-users" aria-hidden="true"></i>Roster</span>
                                    <span class="guild-crystal-roster-ribbon__figure">${g.memberCount}</span>
                                    <span class="guild-crystal-roster-ribbon__fine">${g.memberCount === 1 ? 'guildmate' : 'guildmates'}</span>
                                </div>
                                <div class="guild-crystal-roster-ribbon__rule" aria-hidden="true"></div>
                                <div class="guild-crystal-roster-ribbon__seg guild-crystal-roster-ribbon__seg--glory" role="group" aria-label="Glory earned this week">
                                    <span class="guild-crystal-roster-ribbon__eyebrow"><span aria-hidden="true">${GLORY_EMOJI}</span>This week</span>
                                    <span class="guild-crystal-roster-ribbon__figure guild-crystal-roster-ribbon__figure--accent">${Math.round(g.weeklyGlory || 0)}</span>
                                    <span class="guild-crystal-roster-ribbon__fine">weekly ${GLORY_EMOJI} tally</span>
                                </div>
                            </div>
                            ${modsHtml}
                            ${championPanelHtml}
                            ${topHtml}
                        </div>
                    </div>
                </div>
            </div>`;
    });

    list.innerHTML = `
        <div class="guild-crystal-hall">
            <div class="guild-crystal-arena-header">
                <div class="guild-crystal-fortune-wrap">
                    <button type="button"
                            id="fortunes-wheel-btn"
                            class="guild-crystal-expand-btn guild-crystal-expand-btn--fortune"
                            data-fw-state="waiting"
                            aria-label="Open Fortune's Wheel. Select a class to see when the ritual window opens.">
                        <div class="guild-crystal-expand-btn__icon">
                            <i class="fa-solid fa-dharmachakra"></i>
                        </div>
                        <span class="guild-crystal-expand-btn__col">
                            <span class="guild-crystal-expand-btn__text">Fortune's Wheel</span>
                            <span id="fortunes-wheel-window" class="guild-crystal-expand-btn__sub" data-state="waiting">Awaiting a class</span>
                        </span>
                    </button>
                </div>
                <h2 class="guild-crystal-arena-title font-title">Standings</h2>
                <div class="guild-crystal-expand-all-wrap">
                    <button type="button"
                            id="guild-stats-expand-toggle"
                            class="guild-crystal-expand-btn guild-crystal-expand-btn--global"
                            aria-expanded="${_guildHallStatsExpanded ? 'true' : 'false'}"
                            aria-label="${_guildHallStatsExpanded ? 'Hide' : 'Show'} detailed guild analytics">
                        <div class="guild-crystal-expand-btn__icon">
                            <i class="fas fa-chart-pie"></i>
                        </div>
                        <span class="guild-crystal-expand-btn__text">Magical Analytics</span>
                        <span class="guild-crystal-expand-btn__chev" aria-hidden="true">${_guildHallStatsExpanded ? '▲' : '▼'}</span>
                    </button>
                </div>
            </div>
            <div class="guild-crystal-arena${_guildHallStatsExpanded ? ' guild-crystal-arena--stats-expanded' : ''}">${columns.join('')}</div>
        </div>`;

    // ── Update power tracking for next render ─────────────────────────────────
    displayData.forEach((g, index) => {
        const d = powerDeltas.get(g.guildId);
        _prevGuildPower.set(g.guildId, {
            power: Math.round(g.guildPower),
            rank: index,
            lastPowerDelta: d?.powerDelta || 0,
            lastRankDelta: d?.rankDelta || 0,
        });
    });
    _guildPowerIndicatorsReady = true;

    // ── Trigger entrance animations for trend indicators ──────────────────────
    if (!isFirstRender) {
        requestAnimationFrame(() => {
            list.querySelectorAll('.guild-crystal-count-arrow').forEach(el => {
                el.classList.add('guild-crystal-count-arrow--visible');
            });
            list.querySelectorAll('.guild-crystal-rank-change-badge').forEach(el => {
                el.classList.add('guild-crystal-rank-change-badge--visible');
            });
        });
    }

    list.querySelector('.guild-crystal-expand-all-wrap')?.classList.toggle('guild-crystal-expand-all-wrap--open', _guildHallStatsExpanded);

    const expandToggle = list.querySelector('#guild-stats-expand-toggle');
    expandToggle?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        _guildHallStatsExpanded = !_guildHallStatsExpanded;
        
        list.querySelectorAll('.guild-crystal-details-expander').forEach((expander) => {
            expander.classList.toggle('is-expanded', _guildHallStatsExpanded);
            // Remove inline styles to let the CSS class take over
            expander.style.gridTemplateRows = '';
            expander.style.opacity = '';
        });

        expandToggle.setAttribute('aria-expanded', _guildHallStatsExpanded ? 'true' : 'false');
        expandToggle.setAttribute(
            'aria-label',
            _guildHallStatsExpanded ? 'Hide detailed guild analytics' : 'Show detailed guild analytics'
        );
        const chev = expandToggle.querySelector('.guild-crystal-expand-btn__chev');
        if (chev) chev.textContent = _guildHallStatsExpanded ? '▲' : '▼';
        list.querySelector('.guild-crystal-arena')?.classList.toggle('guild-crystal-arena--stats-expanded', _guildHallStatsExpanded);
        list.querySelector('.guild-crystal-expand-all-wrap')?.classList.toggle('guild-crystal-expand-all-wrap--open', _guildHallStatsExpanded);
    });

    // ── Animate crystal fills in ──────────────────────────────────────────────
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            document.querySelectorAll('.guild-crystal-fill').forEach(el => {
                const target = el.dataset.fillTarget;
                if (target) el.style.height = `${target}%`;
            });
        });
    });

    // ── Wire emblem click / keyboard ──────────────────────────────────────────
    const arena = list.querySelector('.guild-crystal-arena');
    if (!arena) return;

    const handleGuildActivate = (e) => {
        const powerInfoBtn = e.target.closest?.('[data-guild-power-info="true"]');
        if (powerInfoBtn) {
            e.stopPropagation();
            _openPowerExplainer();
            return;
        }
        const infoBtn = e.target.closest('[data-top-heroes-guild]');
        if (infoBtn) {
            e.stopPropagation();
            openGuildHeroesModal(infoBtn.dataset.topHeroesGuild);
            return;
        }

        // Anthem button takes priority
        const anthemBtn = e.target.closest('.guild-anthem-btn');
        if (anthemBtn) {
            e.stopPropagation();
            openAnthemModal(anthemBtn.dataset.anthemGuild);
            return;
        }
        const wrapper = e.target.closest('.guild-crystal-emblem-wrapper');
        if (!wrapper) return;
        e.stopPropagation();
        const guildId = wrapper.dataset.guildId;
        const gData = displayData.find(d => d.guildId === guildId);
        openGuildLore(guildId, gData);
    };

    arena.addEventListener('click', handleGuildActivate);
    arena.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') handleGuildActivate(e);
    });

    // ── Fortune's Wheel button ────────────────────────────────────────────────
    _wireFortunesWheel();

    // ── Fortune's Log ─────────────────────────────────────────────────────────
    _initFortuneLedgerCollapse();
    _initFortuneLedgerNav();
    _renderFortunesLog();
}

function _initFortuneLedgerCollapse() {
    const toggle = document.getElementById('fortune-ledger-toggle');
    const panel = document.getElementById('fortune-ledger-panel');
    const root = document.getElementById('fortunes-wheel-section');
    if (!toggle || !panel || !root) return;
    if (toggle._fortuneLedgerCollapseWired) return;
    toggle._fortuneLedgerCollapseWired = true;

    const apply = (open) => {
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        panel.classList.toggle('is-open', open);
        root.dataset.ledgerExpanded = open ? 'true' : 'false';
    };

    toggle.addEventListener('click', () => {
        apply(toggle.getAttribute('aria-expanded') !== 'true');
    });

    apply(false);
}

// ─── Fortune's Wheel wiring ──────────────────────────────────────────────────

async function _wireFortunesWheel() {
    const section = document.getElementById('fortunes-wheel-section');
    const btn = document.getElementById('fortunes-wheel-btn');
    const statusEl = document.getElementById('fortunes-wheel-status');
    const windowEl = document.getElementById('fortunes-wheel-window');
    const classEl = document.getElementById('fortunes-wheel-class');
    if (!section || !btn) return;

    const classId = state.get('globalSelectedClassId');
    const allClasses = state.get('allTeachersClasses') || [];
    const selectedClass = allClasses.find(c => c.id === classId) || null;
    let statusMsg = '';
    let statusTone = 'waiting';
    let windowMsg = 'Awaiting a class';

    try {
        if (classId) {
            const canSpin = await canSpinThisWeek(classId);
            if (canSpin) {
                statusMsg = 'This class is in its final lesson before the weekend — you can run the wheel now.';
                statusTone = 'ready';
                windowMsg = 'Open now — final lesson';
            } else {
                statusMsg = 'The wheel unlocks only during this class\'s final lesson of the week (before the weekend).';
                statusTone = 'locked';
                windowMsg = 'Not in ritual window';
            }
        } else {
            statusMsg = 'Choose a class above to see when the ritual window opens and to run the wheel for that class.';
        }
    } catch (_) {
        statusMsg = 'Fortune\'s Wheel follows your class schedule; details will appear when a class is selected.';
        statusTone = 'locked';
        windowMsg = 'Schedule unavailable';
    }

    if (statusEl) statusEl.textContent = statusMsg;
    if (windowEl) {
        windowEl.textContent = windowMsg;
        windowEl.dataset.state = statusTone;
    }
    btn.dataset.fwState = statusTone;

    const ariaReady = statusTone === 'ready'
        ? 'Open Fortune\'s Wheel — ritual window is open for the selected class.'
        : 'Open Fortune\'s Wheel. Review schedule and spin when the ritual window opens.';
    btn.setAttribute('aria-label', ariaReady);
    btn.title = statusMsg || windowMsg;

    if (classEl) {
        classEl.textContent = selectedClass
            ? `${selectedClass.name} · League ${selectedClass.questLevel || 'B'}`
            : 'No class selected';
    }
    const barMeta = document.getElementById('fortune-ledger-bar-meta');
    if (barMeta) {
        const logs = state.get('fortuneWheelLog') || [];
        const n = logs.length;
        const bits = [];
        if (selectedClass) bits.push(selectedClass.name);
        bits.push(windowMsg);
        if (n > 0) bits.push(`${n} ritual${n === 1 ? '' : 's'} on record`);
        barMeta.textContent = bits.join(' · ');
    }
    section.dataset.state = statusTone;

    if (!btn._fwWired) {
        btn._fwWired = true;
        btn.addEventListener('click', () => {
            openFortunesWheel();
        });
    }

    _wireWheelModalButtons();
}

function _wireWheelModalButtons() {
    const modal = document.getElementById('fortunes-wheel-modal');
    if (!modal || modal._fwWired) return;
    modal._fwWired = true;

    document.getElementById('fw-spin-btn')?.addEventListener('click', () => triggerSpin());
    document.getElementById('fw-next-btn')?.addEventListener('click', () => advanceWheel());
    document.getElementById('fw-close-btn')?.addEventListener('click', () => closeFortunesWheel());

    modal.addEventListener('click', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.id === 'fortunes-wheel-modal' || target.classList.contains('fw-backdrop')) {
            closeFortunesWheel();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (modal.classList.contains('hidden')) return;
        closeFortunesWheel();
    });
}

// ─── Fortune's Log ───────────────────────────────────────────────────────────

let _fortuneLedgerPage = 0;
const _fortuneLedgerPageSize = 3;

function _renderFortunesLog() {
    const section = document.getElementById('fortunes-log-section');
    const listEl = document.getElementById('fortunes-log-list');
    if (!section || !listEl) return;

    const logs = state.get('fortuneWheelLog') || [];
    if (logs.length === 0) {
        listEl.innerHTML = `
            <div class="guild-fortune-ledger__empty">
                <div class="guild-fortune-ledger__empty-title">No recent rituals</div>
                <p class="guild-fortune-ledger__empty-copy">When a class completes the ceremony, the latest guild omens will appear here.</p>
            </div>`;
        _updateLedgerNavButtons(0, 0);
        return;
    }

    // Calculate pagination
    const start = _fortuneLedgerPage * _fortuneLedgerPageSize;
    const end = start + _fortuneLedgerPageSize;
    const pagedLogs = logs.slice(start, end);
    const totalPages = Math.ceil(logs.length / _fortuneLedgerPageSize);

    listEl.innerHTML = pagedLogs.map(entry => {
        const date = entry.spunAt?.toDate ? entry.spunAt.toDate() : new Date(entry.spunAt);
        const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const results = entry.results || [];
        const totalGlorySwing = results.reduce((sum, result) => sum + (Number(result.gloryDelta) || 0), 0);
        return `
            <article class="guild-fortune-ledger__entry">
                <div class="guild-fortune-ledger__entry-topline">
                    <div>
                        <div class="guild-fortune-ledger__entry-date">${dateStr}</div>
                        <div class="guild-fortune-ledger__entry-week">Week ${entry.weekKey || '?'}</div>
                    </div>
                    <div class="guild-fortune-ledger__entry-swing ${totalGlorySwing < 0 ? 'guild-fortune-ledger__entry-swing--negative' : ''}">
                        ${totalGlorySwing >= 0 ? '+' : ''}${totalGlorySwing} ${GLORY_EMOJI}
                    </div>
                </div>
                <div class="guild-fortune-ledger__entry-results">
                    ${results.map(r => {
                        const gDef = getGuildById(r.guildId);
                        const badgeHtml = getGuildBadgeHtml(r.guildId, 'w-8 h-8');
                        return `
                            <div class="guild-fortune-ledger__result" style="--guild-primary:${gDef?.primary || '#666'};--guild-secondary:${gDef?.secondary || '#999'};">
                                <div class="guild-fortune-ledger__result-badge">${badgeHtml}</div>
                                <div class="guild-fortune-ledger__result-copy">
                                    <div class="guild-fortune-ledger__result-guild">${gDef?.name || r.guildId}</div>
                                    <div class="guild-fortune-ledger__result-label">${r.segmentLabel || r.segmentId}</div>
                                </div>
                                <div class="guild-fortune-ledger__result-impact ${Number(r.gloryDelta) < 0 ? 'guild-fortune-ledger__result-impact--negative' : ''}">
                                    ${r.gloryDelta ? `${r.gloryDelta >= 0 ? '+' : ''}${r.gloryDelta} ${GLORY_EMOJI}` : 'Effect'}
                                </div>
                            </div>`;
                    }).join('')}
                </div>
            </article>`;
    }).join('');

    _updateLedgerNavButtons(_fortuneLedgerPage, totalPages);
}

function _updateLedgerNavButtons(currentPage, totalPages) {
    const prevBtn = document.getElementById('fortune-ledger-prev');
    const nextBtn = document.getElementById('fortune-ledger-next');
    if (!prevBtn || !nextBtn) return;

    prevBtn.disabled = currentPage === 0;
    nextBtn.disabled = currentPage >= totalPages - 1 || totalPages === 0;
}

function _initFortuneLedgerNav() {
    const prevBtn = document.getElementById('fortune-ledger-prev');
    const nextBtn = document.getElementById('fortune-ledger-next');
    if (!prevBtn || !nextBtn) return;
    if (prevBtn._ledgerNavWired) return;
    prevBtn._ledgerNavWired = true;

    prevBtn.addEventListener('click', () => {
        if (_fortuneLedgerPage > 0) {
            _fortuneLedgerPage--;
            _renderFortunesLog();
        }
    });

    nextBtn.addEventListener('click', () => {
        const logs = state.get('fortuneWheelLog') || [];
        const totalPages = Math.ceil(logs.length / _fortuneLedgerPageSize);
        if (_fortuneLedgerPage < totalPages - 1) {
            _fortuneLedgerPage++;
            _renderFortunesLog();
        }
    });
}
