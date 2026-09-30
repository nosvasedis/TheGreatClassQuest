// /ui/tabs/guilds.js — Guild Hall: crystal-column rankings, lore overlay, guild sounds, anthem modal

import { compareGuildLeaderboardRows, getGuildLeaderboardData } from '../../features/guildScoring.js';
import { getGuildBadgeHtml, getGuildById, getGuildEmblemUrl, GUILD_IDS, GUILDS } from '../../features/guilds.js';
import { openGuildHeroesModal } from '../modals/guildHeroes.js';
import { hideModal, showAnimatedModal } from '../modals/base.js';
import { openFortunesWheel, advanceWheel, triggerSpin, closeFortunesWheel, canSpinThisWeek } from '../../features/fortunesWheel.js';
import { GLORY_EMOJI } from '../../constants.js';
import * as state from '../../state.js';
import { getGuildModifierChipPresentation, escapeHtmlAttr as _escapeChipAttr } from '../../features/wheelModifierUi.js';
import { isGameplaySeasonLiveFromAppState } from '../../utils/schoolYear.js';

/** Guild scores stay frozen while the school year is sealed. */
function isGuildSeasonLive() {
    return isGameplaySeasonLiveFromAppState(state);
}

// ─── Guild Power explainer overlay ───────────────────────────────────────────
let _powerExplainerWired = false;
/** The Guild Power explainer card. Exported so the guidebook capture renders the real card. */
export function guildPowerExplainerCardHtml() {
    const parts = [
        {
            key: 'season', icon: '⚜️', name: 'Glory per member this year',
            copy: 'All the Glory the guild earned this school year, shared out per member. This one number is the Guild Power and decides the order.',
        },
        {
            key: 'week', icon: '📅', name: 'This week’s form',
            copy: 'Glory per member this week, members taking part and the week-on-week trend. Fun to watch, but it never moves the ranking.',
        },
        {
            key: 'active', icon: '⚖️', name: 'Every guild size is equal',
            copy: 'Fortune’s Wheel Glory is sized to each guild, so every member of every guild gains or loses the same.',
        },
        {
            key: 'momentum', icon: '🚪', name: 'Leavers take their Glory with them',
            copy: 'If a student leaves the school, the Glory they earned leaves the guild too, so no guild climbs by getting smaller.',
        },
    ];
    return `
        <div class="guild-power-explainer-card pop-in">
            <button type="button" class="guild-power-explainer-close" data-gpex-close="true" aria-label="Close">
                <i class="fas fa-xmark" aria-hidden="true"></i>
            </button>
            <header class="guild-power-explainer-head">
                <span class="guild-power-explainer-bolt" aria-hidden="true"><i class="fas fa-bolt"></i></span>
                <h3 id="guild-power-explainer-title" class="guild-power-explainer-title font-title">How Guild Power works</h3>
                <p class="guild-power-explainer-copy">
                    The <strong>Glory each member has earned this year</strong>, on average. It only moves when this
                    guild earns Glory, so a small guild where everyone joins in can beat a big guild where only a few do.
                    In June the guild with the highest Guild Power is crowned.
                </p>
            </header>


            <ul class="guild-power-explainer-list">
                ${parts.map((p) => `
                <li class="guild-power-explainer-item guild-power-explainer-item--${p.key}">
                    <span class="guild-power-explainer-item__icon" aria-hidden="true">${p.icon}</span>
                    <span class="guild-power-explainer-item__body">
                        <span class="guild-power-explainer-item__name">${p.name}</span>
                        <span class="guild-power-explainer-item__copy">${p.copy}</span>
                    </span>
                </li>`).join('')}
            </ul>

            <p class="guild-power-explainer-note">
                Glory comes from stars (${GLORY_EMOJI}2 each), boons, Mystic Market relics, Quiz of the Week and Fortune’s Wheel,
                and every change is written in the Glory ledger — so the standings can always be checked.
            </p>
            <button type="button" class="guild-power-explainer-ok" data-gpex-close="true">Got it</button>
        </div>
    `;
}

function _ensurePowerExplainerOverlay() {
    if (_powerExplainerWired) return;
    _powerExplainerWired = true;

    // Created once. Opens / closes through the shared modal shell (showAnimatedModal / hideModal),
    // so it pops in and out like every other modal: the overlay carries the backdrop colour, the card is the .pop-in.
    if (!document.getElementById('guild-power-explainer-overlay')) {
        const el = document.createElement('div');
        el.id = 'guild-power-explainer-overlay';
        el.className = 'guild-power-explainer-overlay hidden';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-labelledby', 'guild-power-explainer-title');
        el.innerHTML = guildPowerExplainerCardHtml();
        document.body.appendChild(el);
    }

    const overlay = document.getElementById('guild-power-explainer-overlay');
    if (!overlay) return;

    overlay.addEventListener('click', (e) => {
        const target = e.target;
        if (!(target instanceof Element)) return;
        if (target === overlay || target.closest('[data-gpex-close="true"]')) _closePowerExplainer();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || overlay.classList.contains('hidden')) return;
        e.stopImmediatePropagation();
        _closePowerExplainer();
    });
}

function _openPowerExplainer() {
    _ensurePowerExplainerOverlay();
    showAnimatedModal('guild-power-explainer-overlay');
    requestAnimationFrame(() => {
        document.querySelector('#guild-power-explainer-overlay .guild-power-explainer-ok')?.focus({ preventScroll: true });
    });
}

function _closePowerExplainer() {
    hideModal('guild-power-explainer-overlay');
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

// ─── Banner & anthem open / close choreography ───────────────────────────────
// `<prefix>--opening` / `<prefix>--closing` on the overlay drive the keyframes in styles/guilds.css;
// the overlay is hidden only once the closing animation has played out.
const _overlayCloseTimers = new WeakMap();
const LORE_CLOSE_MS = 720;
const ANTHEM_CLOSE_MS = 520;

function _playOverlayOpen(overlay, prefix) {
    clearTimeout(_overlayCloseTimers.get(overlay));
    overlay.classList.remove('hidden', `${prefix}--closing`, `${prefix}--opening`);
    void overlay.offsetWidth; // restart the opening keyframes
    overlay.classList.add(`${prefix}--opening`);
}

function _playOverlayClose(overlay, prefix, duration) {
    if (!overlay || overlay.classList.contains('hidden') || overlay.classList.contains(`${prefix}--closing`)) return;
    overlay.classList.remove(`${prefix}--opening`);
    overlay.classList.add(`${prefix}--closing`);
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    _overlayCloseTimers.set(overlay, setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove(`${prefix}--closing`);
    }, reduceMotion ? 180 : duration));
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
    if (!overlay || !fillGuildAnthemCard(guildId)) return;

    _playOverlayOpen(overlay, 'guild-anthem-overlay');
    playGuildAnthem(guildId);
    startKaraokeSync(guildId);
}

/**
 * Dress the anthem alcove for a guild: colours, crest, title and the lyric sheet.
 * Exported so the guidebook capture renders the real alcove. Returns false when the card is missing.
 */
export function fillGuildAnthemCard(guildId) {
    const card = document.getElementById('guild-anthem-card');
    if (!card) return false;

    const guild = getGuildById(guildId);
    const primary = guild?.primary || '#7c3aed';
    const secondary = guild?.secondary || '#a78bfa';
    const glow = guild?.glow || primary;

    card.style.setProperty('--anthem-primary', primary);
    card.style.setProperty('--anthem-secondary', secondary);
    card.style.setProperty('--anthem-glow', glow);
    const emblemUrl = getGuildEmblemUrl(guildId);
    card.style.setProperty('--anthem-emblem', emblemUrl ? `url("${emblemUrl}")` : 'none');

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
    return true;
}

function closeAnthemModal() {
    stopKaraokeSync();
    _teardownEndFade();
    fadeOutAndStopAnthem();
    _playOverlayClose(document.getElementById('guild-anthem-overlay'), 'guild-anthem-overlay', ANTHEM_CLOSE_MS);
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
// Lives on <body> (like the anthem overlay) so the banner hangs above the app header and nav
// instead of inside the tab's stacking context, where they clipped its rod and crest.
function ensureLoreOverlayRoot() {
    const overlay = document.getElementById('guild-lore-overlay');
    if (!overlay || overlay.parentElement === document.body) return overlay;
    document.body.appendChild(overlay);
    return overlay;
}

function openGuildLore(guildId, gData) {
    const overlay = ensureLoreOverlayRoot();
    if (!overlay || !fillGuildLoreCard(guildId, gData)) return;

    // Unfurl the banner
    _playOverlayOpen(overlay, 'guild-lore-overlay');

    // Glow the matching column emblem
    document.querySelectorAll('.guild-crystal-col').forEach(col => {
        col.classList.toggle('guild-active', col.dataset.guild === guildId);
    });

    playGuildSound(guildId);
}

/**
 * Dress the hanging banner for a guild: colours, crest, name, motto, traits and Power.
 * Exported so the guidebook capture renders the real banner. Returns false when the card is missing.
 */
export function fillGuildLoreCard(guildId, gData, { seasonLive = isGuildSeasonLive() } = {}) {
    const card = document.getElementById('guild-lore-card');
    if (!card) return false;

    const guild = getGuildById(guildId);
    const emblemUrl = getGuildEmblemUrl(guildId);
    const primary = guild?.primary || '#7c3aed';
    const secondary = guild?.secondary || '#a78bfa';
    const glow = guild?.glow || primary;
    const motto = guild?.motto || '';
    const traits = guild?.traits || [];

    // The banner cloth, trim and glow are drawn in CSS from the guild's colours
    card.style.setProperty('--lore-primary', primary);
    card.style.setProperty('--lore-secondary', secondary);
    card.style.setProperty('--lore-glow', glow);

    // Emblem
    const emblemWrap = document.getElementById('guild-lore-emblem-wrap');
    if (emblemWrap) {
        const loreInitial = String(guild?.name || guildId || '?').trim().charAt(0).toUpperCase() || '?';
        emblemWrap.innerHTML = emblemUrl
            ? `<img src="${emblemUrl}" alt="${guild?.name}" class="guild-lore-emblem">`
            : `<div class="guild-lore-emblem guild-lore-emblem-fallback">
                    <span class="guild-lore-emblem-initial">${loreInitial}</span>
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
            `<span class="guild-lore-trait">${t}</span>`
        ).join('');
    }
    if (statsEl) {
        const members = gData?.memberCount || 0;
        if (!seasonLive) {
            statsEl.innerHTML = `
                <div class="guild-lore-metrics-primary guild-lore-metrics-primary--frozen">
                    <div class="guild-lore-metric-tile guild-lore-metric-tile--power">
                        <div class="guild-lore-metric-tile__label">
                            <span aria-hidden="true">❄️</span> Season frozen
                        </div>
                        <div class="guild-lore-metric-tile__value">—</div>
                        <div class="guild-lore-metric-tile__hint">Guild scores awaken when the school year begins</div>
                    </div>
                </div>
                <div class="guild-lore-metrics-secondary">
                    <span class="guild-lore-stat guild-lore-stat--pill"><span aria-hidden="true">👥</span> <strong>${members}</strong> member${members === 1 ? '' : 's'}</span>
                </div>`;
        } else {
            const stars = gData?.totalStars || 0;
            const perCapita = gData?.perCapitaStars || 0;
            const guildPower = Math.round(Number(gData?.guildPower) || 0);
            const totalGlory = Math.round(Number(gData?.totalGlory) || 0);
            const weeklyGlory = Math.round(Number(gData?.weeklyGlory) || 0);
            const perCapitaGlory = Number(gData?.perCapitaGlory) || 0;
            const weeklyPerCapitaGlory = Number(gData?.weeklyPerCapitaGlory) || 0;

            statsEl.innerHTML = `
                <div class="guild-lore-metrics-primary">
                    <div class="guild-lore-metric-tile guild-lore-metric-tile--power">
                        <div class="guild-lore-metric-tile__label">
                            <span aria-hidden="true">⚡</span> Guild Power
                            <button type="button" class="guild-lore-power-hint"
                                aria-label="Explain Guild Power" data-guild-lore-power-info="true">?</button>
                        </div>
                        <div class="guild-lore-metric-tile__value">${guildPower}</div>
                        <div class="guild-lore-metric-tile__hint">Season-fair score from the Glory ledger</div>
                    </div>
                    <div class="guild-lore-metric-tile guild-lore-metric-tile--glory">
                        <div class="guild-lore-metric-tile__label">
                            <span aria-hidden="true">${GLORY_EMOJI}</span> Total Glory
                        </div>
                        <div class="guild-lore-metric-tile__value">${totalGlory}</div>
                        <div class="guild-lore-metric-tile__hint">
                            ${weeklyGlory} this week · ${perCapitaGlory.toFixed(1)} season ${GLORY_EMOJI}/member · ${weeklyPerCapitaGlory.toFixed(1)} weekly ${GLORY_EMOJI}/member
                        </div>
                    </div>
                </div>
                <div class="guild-lore-metrics-secondary">
                    <span class="guild-lore-stat guild-lore-stat--pill"><span aria-hidden="true">⭐</span> <strong>${stars}</strong> stars</span>
                    <span class="guild-lore-stat guild-lore-stat--pill"><span aria-hidden="true">⚖️</span> <strong>${perCapita.toFixed(1)}</strong> ★/member</span>
                    <span class="guild-lore-stat guild-lore-stat--pill"><span aria-hidden="true">👥</span> <strong>${members}</strong> member${members === 1 ? '' : 's'}</span>
                </div>`;
        }
    }
    return true;
}

function closeGuildLore() {
    _playOverlayClose(document.getElementById('guild-lore-overlay'), 'guild-lore-overlay', LORE_CLOSE_MS);
    document.querySelectorAll('.guild-crystal-col.guild-active').forEach(c => c.classList.remove('guild-active'));
}

function wireGuildLoreListeners() {
    const overlay = ensureLoreOverlayRoot();
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
        if (e.key !== 'Escape') return;
        // The Guild Power explainer can sit on top of the lore card — Escape closes only the top one.
        const explainer = document.getElementById('guild-power-explainer-overlay');
        if (explainer && !explainer.classList.contains('hidden')) return;
        closeGuildLore();
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

/**
 * Balance-of-power ribbon above the columns: each guild's share of the summed Guild Power,
 * in standings order, plus a one-line leader summary. Live season only.
 */
function _buildGuildRaceTrack(displayData) {
    if (!displayData.length) return '';
    const powers = displayData.map((g) => Math.max(0, Math.round(Number(g.guildPower) || 0)));
    const total = powers.reduce((sum, p) => sum + p, 0);

    const segments = displayData.map((g, i) => {
        const guild = getGuildById(g.guildId);
        const primary = guild?.primary || '#6b7280';
        const secondary = guild?.secondary || '#9ca3af';
        const glow = guild?.glow || primary;
        const emblemUrl = getGuildEmblemUrl(g.guildId);
        const initial = String(g.guildName || g.guildId || '?').trim().charAt(0).toUpperCase() || '?';
        const pct = total > 0 ? Math.round((powers[i] / total) * 100) : Math.round(100 / displayData.length);
        const grow = total > 0 ? powers[i] : 1;
        const badge = emblemUrl
            ? `<img src="${emblemUrl}" alt="" class="guild-race-track__emblem" loading="lazy" decoding="async" width="22" height="22">`
            : `<span class="guild-race-track__emblem guild-race-track__emblem--initial">${initial}</span>`;
        return `
                    <div class="guild-race-track__seg${i === 0 ? ' is-leader' : ''}"
                         style="flex:${grow} 1 0;--seg-primary:${primary};--seg-secondary:${secondary};--seg-glow:${glow};"
                         title="${g.guildName}: ${powers[i]} Guild Power (${pct}% of the hall)">
                        ${badge}
                        <span class="guild-race-track__pct">${pct}%</span>
                    </div>`;
    }).join('');

    const leader = displayData[0];
    const runnerUp = displayData[1];
    const leadGap = runnerUp ? powers[0] - powers[1] : powers[0];
    const leaderLine = leadGap > 0
        ? `<strong>${leader.guildName}</strong> leads the season race by <strong>${leadGap}</strong> Power`
        : 'Dead heat at the top &mdash; every star counts!';

    return `
            <div class="guild-race-track" role="group" aria-label="Balance of power between the guilds">
                <div class="guild-race-track__bar">${segments}</div>
                <div class="guild-race-track__legend">
                    <span class="guild-race-track__leader"><i class="fas fa-crown" aria-hidden="true"></i>${leaderLine}</span>
                    <span class="guild-race-track__goal"><i class="fas fa-circle-info" aria-hidden="true"></i>Each colour = that guild's share of all Guild Power</span>
                </div>
            </div>`;
}

/** Short "chase" line under each column's Guild Power (gap to the guild one place above). */
function _guildChaseLine(displayData, index, rankLabels) {
    const power = (row) => Math.max(0, Number(row?.seasonGloryPerMember ?? row?.guildPower) || 0);
    const fmt = (gap) => (gap >= 10 ? String(Math.round(gap)) : gap.toFixed(1));
    if (index === 0) {
        const gap = displayData[1] ? power(displayData[0]) - power(displayData[1]) : 0;
        if (gap >= 0.05) return { tone: 'lead', icon: 'fa-crown', text: `${fmt(gap)} Power ahead of 2nd` };
        return { tone: 'tie', icon: 'fa-scale-balanced', text: gap > 0 ? 'Neck and neck with 2nd' : 'Tied for 1st' };
    }
    const target = rankLabels[index - 1] || `#${index}`;
    const gap = power(displayData[index - 1]) - power(displayData[index]);
    if (gap >= 0.05) return { tone: 'chase', icon: 'fa-flag-checkered', text: `${fmt(gap)} Power behind ${target}` };
    return { tone: 'tie', icon: 'fa-scale-balanced', text: gap > 0 ? `Neck and neck with ${target}` : `Tied with ${target}` };
}

/**
 * "Latest" row under the chase line: the most recent Guild Power change and any place change,
 * written out in words. Empty (but still reserving its row, so columns stay aligned) until something moves.
 */
function _guildTrendRow(delta, isFirstRender, index, rankLabels) {
    const items = [];
    if (delta && !isFirstRender) {
        if (delta.powerDelta) {
            const up = delta.powerDelta > 0;
            const abs = Math.abs(delta.powerDelta);
            items.push(`<span class="guild-crystal-trend__item guild-crystal-trend__item--${up ? 'up' : 'down'}"
                title="Guild Power ${up ? 'rose' : 'fell'} by ${abs} with the latest Glory change">
                <i class="fas ${up ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}" aria-hidden="true"></i>${up ? '+' : '−'}${abs} Power</span>`);
        }
        if (delta.rankDelta) {
            const climbed = delta.rankDelta > 0;
            const place = rankLabels[index] || `#${index + 1}`;
            items.push(`<span class="guild-crystal-trend__item guild-crystal-trend__item--${climbed ? 'climb' : 'slip'}"
                title="${climbed ? 'Climbed' : 'Slipped'} to ${place} place with the latest Glory change">
                <i class="fas ${climbed ? 'fa-circle-up' : 'fa-circle-down'}" aria-hidden="true"></i>${climbed ? 'Up' : 'Down'} to ${place}</span>`);
        }
    }
    return `<div class="guild-crystal-trend${items.length ? '' : ' guild-crystal-trend--quiet'}">${items.length
        ? `<span class="guild-crystal-trend__label">Latest</span>${items.join('')}`
        : ''}</div>`;
}

/** Rolls each changed Guild Power number from its previous value (skipped for reduced motion). */
let _powerCountToken = 0;
function _animateGuildPowerCounters(root) {
    const token = ++_powerCountToken;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const jobs = [...root.querySelectorAll('.guild-crystal-count-num[data-count-to]')]
        .map((el) => ({ el, from: Number(el.dataset.countFrom), to: Number(el.dataset.countTo) }))
        .filter((j) => Number.isFinite(j.from) && Number.isFinite(j.to) && j.from !== j.to);
    if (!jobs.length) return;
    jobs.forEach((j) => { j.el.textContent = String(j.from); });
    const duration = 1200;
    const start = performance.now();
    const step = (now) => {
        if (token !== _powerCountToken) return;
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        jobs.forEach((j) => { j.el.textContent = String(Math.round(j.from + (j.to - j.from) * eased)); });
        if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

export function renderGuildsTab() {
    const list = document.getElementById('guilds-leaderboard-list');
    if (!list) return;

    _ensurePowerExplainerOverlay();

    wireGuildLoreListeners();
    wireAnthemListeners();

    const seasonLive = isGuildSeasonLive();
    const rawData = getGuildLeaderboardData();

    // Always render all 4 guilds (zero stars = empty crystal, still looks great)
    let displayData = GUILD_IDS.map((gid) => {
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
            countedGlory: found?.countedGlory ?? found?.totalGlory ?? 0,
            seasonGloryPerMember: found?.seasonGloryPerMember ?? 0,
            weeklyGlory: found?.weeklyGlory || 0,
            previousWeekGlory: found?.previousWeekGlory || 0,
            perCapitaGlory: found?.perCapitaGlory || 0,
            weeklyPerCapitaGlory: found?.weeklyPerCapitaGlory || 0,
            guildPower: found?.guildPower || 0,
            seasonGloryScore: found?.seasonGloryScore ?? found?.gloryScore ?? 0,
            weeklyGloryScore: found?.weeklyGloryScore ?? 0,
            gloryScore: found?.gloryScore ?? 0,
            momentumScore: found?.momentumScore ?? 0,
            momentumPct: Number.isFinite(Number(found?.momentumPct))
                ? Math.round(Number(found.momentumPct))
                : 0,
            momentumArrow: found?.momentumArrow || '➡️',
            activityScore: found?.activityScore ?? 0,
            gloryModifiers: found?.gloryModifiers || [],
        };
    });
    // Frozen season: keep stable guild order (no false rankings from baseline power)
    if (seasonLive) {
        displayData = displayData.sort(compareGuildLeaderboardRows);
    }

    // ── Compute power deltas for live indicators ──────────────────────────────
    const powerDeltas = new Map(); // guildId → { powerDelta, rankDelta, prevPower, prevRank, freshChange }
    const isFirstRender = !_guildPowerIndicatorsReady;
    if (seasonLive) {
        displayData.forEach((g, index) => {
            const prev = _prevGuildPower.get(g.guildId);
            if (prev) {
                const powerDelta = Math.round((Number(g.guildPower) - Number(prev.power)) * 10) / 10;
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
    }

    const rankLabels = ['1st', '2nd', '3rd', '4th'];

    const columns = displayData.map((g, index) => {
        const guild = getGuildById(g.guildId);
        const emblemUrl = getGuildEmblemUrl(g.guildId);
        const primary = guild?.primary || '#6b7280';
        const secondary = guild?.secondary || '#9ca3af';
        const glow = guild?.glow || primary;
        const initial = String(g.guildName || g.guildId || '?').trim().charAt(0).toUpperCase() || '?';
        const maxPower = Math.max(...displayData.map((row) => row.guildPower)) || 1;
        const fillPct = seasonLive
            ? Math.max(5, Math.round((g.guildPower / maxPower) * 90))
            : 0;

        const emblemHtml = emblemUrl
            ? `<img src="${emblemUrl}" alt="${g.guildName}" class="guild-crystal-emblem"
                    style="border-color:${primary}; box-shadow: 0 0 16px ${glow}77;">`
            : `<div class="guild-crystal-emblem guild-crystal-emblem-fallback"
                    style="background:linear-gradient(135deg,${primary},${secondary}); box-shadow:0 0 16px ${glow}77;">
                   <span class="guild-crystal-emblem-initial" style="color:${primary}">${initial}</span>
               </div>`;

        const legendRunners = seasonLive ? g.topContributors.slice(1, 4) : [];
        const legendMedals = ['🥈', '🥉', '✨'];
        const legendPlaceLabels = ['2nd place', '3rd place', '4th place'];

        const topHeroesBody = !seasonLive
            ? `<p class="guild-crystal-heroes-panel__empty" role="status">Legends sleep until the school year begins.</p>`
            : legendRunners.length
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

        const championPanelHtml = seasonLive
            ? _buildGuildChampionPanel(g, primary)
            : `
            <section class="guild-crystal-champion-panel guild-crystal-champion-panel--balanced guild-crystal-champion-panel--frozen" style="--guild-champion-accent:${primary};" aria-label="Guild champion">
                <header class="guild-crystal-champion-panel__header">
                    <span class="guild-crystal-champion-panel__burst" aria-hidden="true"><i class="fas fa-snowflake"></i></span>
                    <div class="guild-crystal-champion-panel__headlines">
                        <h4 class="guild-crystal-champion-panel__title">Throne frozen</h4>
                        <p class="guild-crystal-champion-panel__subtitle">Champions awaken with the new school year</p>
                    </div>
                </header>
                <div class="guild-crystal-champion-panel__body">
                    <p class="guild-crystal-champion-panel__vacant" role="status">No standings yet — the halls are sealed in frost.</p>
                </div>
            </section>`;

        const topHtml = `
            <section class="guild-crystal-heroes-panel guild-crystal-heroes-panel--balanced" style="--guild-heroes-accent:${primary};">
                <header class="guild-crystal-heroes-panel__header">
                    <span class="guild-crystal-heroes-panel__burst" aria-hidden="true"><i class="fas ${seasonLive ? 'fa-dragon' : 'fa-snowflake'}"></i></span>
                    <div class="guild-crystal-heroes-panel__headlines">
                        <h4 class="guild-crystal-heroes-panel__title">${seasonLive ? 'Legends of the guild' : 'Legends awaiting'}</h4>
                        <p class="guild-crystal-heroes-panel__subtitle">${seasonLive ? `Next warriors by lifetime ${GLORY_EMOJI} (from stars)` : 'Glory ledgers open when classes begin'}</p>
                    </div>
                </header>
                <div class="guild-crystal-heroes-panel__roster">${topHeroesBody}</div>
            </section>`;

        const now = Date.now();
        const activeModsSorted = seasonLive
            ? [...(g.gloryModifiers || [])]
                .filter((m) => (Number(m.expiresAt) || 0) > now)
                .sort((a, b) => (Number(a.expiresAt) || 0) - (Number(b.expiresAt) || 0))
            : [];
        const shownWheelMods = activeModsSorted.slice(0, 2);
        const overflowMods = Math.max(0, activeModsSorted.length - shownWheelMods.length);
        const modsChipsInner = !seasonLive
            ? `<p class="guild-crystal-effects-panel__empty" role="status"><span aria-hidden="true">❄</span> Fortune's Wheel rests until the season thaws</p>`
            : activeModsSorted.length
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
                        <p class="guild-crystal-effects-panel__subtitle">${seasonLive ? "Blessings cast by Fortune's Wheel &mdash; hover a charm for what it actually does." : 'Wheel magic stays sealed until the school year begins.'}</p>
                    </div>
                </header>
                <div class="guild-crystal-effects-panel__chips">${modsChipsInner}</div>
            </section>`;

        const powerNow = Math.round(Number(g.guildPower) || 0);
        const prevPowerEntry = _prevGuildPower.get(g.guildId);
        const powerFrom = prevPowerEntry ? Math.round(Number(prevPowerEntry.power) || 0) : 0;
        const chase = seasonLive ? _guildChaseLine(displayData, index, rankLabels) : null;

        const countBlock = seasonLive
            ? `
                <div class="guild-crystal-count" style="color:${primary};">
                    <span class="guild-crystal-count-num${(() => { const d = powerDeltas.get(g.guildId); if (!d || isFirstRender) return ''; return d.powerDelta > 0 ? ' guild-power-boost' : d.powerDelta < 0 ? ' guild-power-drop' : ''; })()}" data-guild-id="${g.guildId}" data-count-from="${powerFrom}" data-count-to="${powerNow}">${powerNow}</span>
                    <span class="guild-crystal-count-label">
                        ⚡ Guild Power
                        <button class="guild-power-info-btn" type="button" aria-label="Explain Guild Power" data-guild-power-info="true">?</button>
                    </span>
                    <span class="guild-crystal-chase guild-crystal-chase--${chase.tone}"><i class="fas ${chase.icon}" aria-hidden="true"></i>${chase.text}</span>
                    ${_guildTrendRow(powerDeltas.get(g.guildId), isFirstRender, index, rankLabels)}
                    <div class="guild-crystal-power-strip guild-crystal-power-strip--tiles" aria-label="How ${g.guildName} is doing">
                        <span class="guild-crystal-power-tile" title="All the Glory this guild's current members earned this year. Guild Power is this shared out per member."><strong>${Math.round(Number(g.countedGlory) || 0)}</strong><small>${GLORY_EMOJI} earned<br>this year</small></span>
                        <span class="guild-crystal-power-tile" title="This week's Glory per member. This week's form never changes the ranking."><strong>${g.weeklyPerCapitaGlory.toFixed(1)}</strong><small>${GLORY_EMOJI} per member<br>this week</small></span>
                        <span class="guild-crystal-power-tile" title="Share of members who earned Glory this week. This week's form never changes the ranking."><strong>${Math.round(Number(g.activityScore) || 0)}%</strong><small>🔥 members<br>active this week</small></span>
                        <span class="guild-crystal-power-tile guild-crystal-power-tile--${g.momentumPct > 0 ? 'up' : g.momentumPct < 0 ? 'down' : 'flat'}" title="This week's Glory compared with last week's. This week's form never changes the ranking."><strong>${g.momentumPct >= 0 ? '+' : ''}${g.momentumPct}%</strong><small>${g.momentumArrow} Glory vs<br>last week</small></span>
                    </div>
                </div>`
            : `
                <div class="guild-crystal-count guild-crystal-count--frozen" style="color:${primary};">
                    <span class="guild-crystal-count-num guild-crystal-count-num--frozen" data-guild-id="${g.guildId}" aria-label="Guild Power frozen">—</span>
                    <span class="guild-crystal-count-label">
                        <i class="fas fa-snowflake" aria-hidden="true"></i> Frozen
                    </span>
                    <div class="guild-crystal-power-strip guild-crystal-power-strip--frozen" aria-label="Season not started">
                        <span>No scores yet</span>
                        <span>${g.memberCount} member${g.memberCount === 1 ? '' : 's'}</span>
                    </div>
                </div>`;

        const metricsBlock = seasonLive
            ? `
                            <div class="guild-crystal-metrics" style="--guild-metric-accent:${primary};">
                                <div class="guild-crystal-metric">
                                    <div class="guild-crystal-metric__label">Season Glory/member</div>
                                    <div class="guild-crystal-metric__value">${g.perCapitaGlory.toFixed(1)} <span class="guild-crystal-metric__unit">${GLORY_EMOJI}</span></div>
                                    <div class="guild-crystal-metric__hint">This is the Guild Power</div>
                                </div>
                                <div class="guild-crystal-metric">
                                    <div class="guild-crystal-metric__label">Weekly Glory/member</div>
                                    <div class="guild-crystal-metric__value">${g.weeklyPerCapitaGlory.toFixed(1)} <span class="guild-crystal-metric__unit">${GLORY_EMOJI}</span></div>
                                    <div class="guild-crystal-metric__hint">This week's form</div>
                                </div>
                                <div class="guild-crystal-metric">
                                    <div class="guild-crystal-metric__label">Activity + momentum</div>
                                    <div class="guild-crystal-metric__value">${Math.round(Number(g.activityScore) || 0)}% · ${g.momentumArrow}</div>
                                    <div class="guild-crystal-metric__hint">${g.momentumPct >= 0 ? '+' : ''}${g.momentumPct}% vs last week</div>
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
                            </div>`
            : `
                            <div class="guild-crystal-metrics guild-crystal-metrics--frozen" style="--guild-metric-accent:${primary};">
                                <div class="guild-crystal-metric">
                                    <div class="guild-crystal-metric__label">Season Glory</div>
                                    <div class="guild-crystal-metric__value">—</div>
                                    <div class="guild-crystal-metric__hint">Awaiting school year</div>
                                </div>
                                <div class="guild-crystal-metric">
                                    <div class="guild-crystal-metric__label">Weekly Glory</div>
                                    <div class="guild-crystal-metric__value">—</div>
                                    <div class="guild-crystal-metric__hint">Not counting yet</div>
                                </div>
                                <div class="guild-crystal-metric">
                                    <div class="guild-crystal-metric__label">Momentum</div>
                                    <div class="guild-crystal-metric__value">❄</div>
                                    <div class="guild-crystal-metric__hint">Awaiting activity</div>
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
                                    <span class="guild-crystal-roster-ribbon__figure guild-crystal-roster-ribbon__figure--accent">—</span>
                                    <span class="guild-crystal-roster-ribbon__fine">season not live</span>
                                </div>
                            </div>`;

        return `
            <div class="guild-crystal-col ${seasonLive ? `is-rank-${index + 1}` : 'is-frozen'}${(() => { if (!seasonLive) return ''; const d = powerDeltas.get(g.guildId); return (!isFirstRender && d && d.freshChange && d.rankDelta !== 0) ? ' guild-rank-changed' : ''; })()}" data-guild="${g.guildId}"
                 style="--guild-primary:${primary};--guild-secondary:${secondary};--guild-glow:${glow};">

                <!-- ── Rank ── -->
                <div class="guild-crystal-rank"><span class="guild-crystal-rank__label">${seasonLive && index === 0 ? '<i class="fas fa-crown guild-crystal-rank__crown" aria-hidden="true"></i>' : ''}${seasonLive ? (rankLabels[index] || `#${index + 1}`) : '❄'}</span></div>

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
                    <div class="guild-crystal-name guild-crystal-name--ribbon">${g.guildName}</div>
                </div>

                <!-- ── Crystal tube (fixed height, fills from bottom) ── -->
                <div class="guild-crystal-tube-wrap${seasonLive ? '' : ' guild-crystal-tube-wrap--frozen'}">
                    ${seasonLive ? '' : `
                    <div class="guild-crystal-seal-badge">
                        <i class="fas fa-snowflake" aria-hidden="true"></i><span>Sealed</span>
                    </div>`}
                    <div class="guild-crystal-tube${seasonLive ? '' : ' guild-crystal-tube--frozen'}"
                         style="border-color:${primary}44; box-shadow:inset 0 0 16px rgba(0,0,0,0.08), 0 0 32px ${glow}1a;">
                        ${seasonLive ? `
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
                        </div>` : `
                        <div class="guild-crystal-fill guild-crystal-fill--frozen" data-fill-target="0" style="height:0%;"></div>
                        <div class="guild-crystal-frost" aria-hidden="true">
                            <span class="guild-crystal-frost__flake" style="--fx:18%;--fy:22%;--fs:0.7rem;--fd:0s;">❄</span>
                            <span class="guild-crystal-frost__flake" style="--fx:62%;--fy:38%;--fs:0.95rem;--fd:0.4s;">❅</span>
                            <span class="guild-crystal-frost__flake" style="--fx:40%;--fy:58%;--fs:0.65rem;--fd:0.9s;">❄</span>
                            <span class="guild-crystal-frost__flake" style="--fx:78%;--fy:70%;--fs:0.8rem;--fd:1.3s;">❅</span>
                            <span class="guild-crystal-frost__flake" style="--fx:28%;--fy:82%;--fs:0.55rem;--fd:1.7s;">❄</span>
                        </div>`}
                        <div class="guild-crystal-glass-shine"></div>
                        <div class="guild-crystal-glow-top" style="background:radial-gradient(ellipse at 50% 0%,${glow}22,transparent 70%);"></div>
                    </div>
                </div>

                ${countBlock}

                <div id="guild-crystal-details-${g.guildId}" class="guild-crystal-details-expander ${_guildHallStatsExpanded ? 'is-expanded' : ''}">
                    <div class="guild-crystal-details">
                        <div class="guild-crystal-details-inner">
                            ${metricsBlock}
                            ${modsHtml}
                            ${championPanelHtml}
                            ${topHtml}
                        </div>
                    </div>
                </div>
            </div>`;
    });

    list.innerHTML = `
        <div class="guild-crystal-hall${seasonLive ? '' : ' guild-crystal-hall--frozen'}">
            <div class="guild-crystal-arena-header${seasonLive ? '' : ' guild-crystal-arena-header--frozen'}">
                <div class="guild-crystal-fortune-wrap">
                    <button type="button"
                            id="fortunes-wheel-btn"
                            class="guild-crystal-expand-btn guild-crystal-expand-btn--fortune${seasonLive ? '' : ' is-season-frozen'}"
                            data-fw-state="${seasonLive ? 'waiting' : 'locked'}"
                            ${seasonLive ? '' : 'disabled'}
                            aria-label="${seasonLive ? "Open Fortune's Wheel. Select a class to see when the ritual window opens." : "Fortune's Wheel is locked until the school year begins."}">
                        <div class="guild-crystal-expand-btn__icon">
                            <i class="fa-solid ${seasonLive ? 'fa-dharmachakra' : 'fa-snowflake'}"></i>
                        </div>
                        <span class="guild-crystal-expand-btn__col">
                            <span class="guild-crystal-expand-btn__text">Fortune's Wheel</span>
                            <span id="fortunes-wheel-window" class="guild-crystal-expand-btn__sub" data-state="${seasonLive ? 'waiting' : 'locked'}">${seasonLive ? 'Pick a class first' : 'Season frozen'}</span>
                        </span>
                    </button>
                </div>
                ${seasonLive
                    ? `<h2 class="guild-crystal-arena-title guild-crystal-arena-title--ornate font-title">
                        <span class="guild-crystal-arena-title__flourish" aria-hidden="true"></span>
                        <span class="guild-crystal-arena-title__text">Standings</span>
                        <span class="guild-crystal-arena-title__flourish guild-crystal-arena-title__flourish--end" aria-hidden="true"></span>                    </h2>`
                    : `<div class="guild-frozen-badge" role="status" tabindex="0" aria-label="Guild Hall Frozen — wakes with the new school year">
                        <span class="guild-frozen-badge__icon" aria-hidden="true"><i class="fas fa-snowflake"></i></span>
                        <span class="guild-frozen-badge__title" aria-hidden="true">Guild Hall Frozen</span>
                        <span class="guild-frozen-badge__tooltip" aria-hidden="true">Wakes with the new school year</span>
                    </div>`}
                <div class="guild-crystal-expand-all-wrap">
                    <button type="button"
                            id="guild-stats-expand-toggle"
                            class="guild-crystal-expand-btn guild-crystal-expand-btn--global${seasonLive ? '' : ' is-season-frozen'}"
                            data-stats-state="${seasonLive ? (_guildHallStatsExpanded ? 'ready' : 'waiting') : 'locked'}"
                            ${seasonLive ? '' : 'disabled'}
                            aria-expanded="${seasonLive && _guildHallStatsExpanded ? 'true' : 'false'}"
                            aria-label="${seasonLive ? (_guildHallStatsExpanded ? 'Hide' : 'Show') + ' detailed guild analytics' : 'Magical Analytics is locked until the school year begins.'}">
                        <div class="guild-crystal-expand-btn__icon">
                            <i class="fas ${seasonLive ? 'fa-chart-pie' : 'fa-snowflake'}"></i>
                        </div>
                        <span class="guild-crystal-expand-btn__col">
                            <span class="guild-crystal-expand-btn__text">Magical Analytics</span>
                            <span class="guild-crystal-expand-btn__sub" data-state="${seasonLive ? (_guildHallStatsExpanded ? 'ready' : 'waiting') : 'locked'}">${seasonLive ? (_guildHallStatsExpanded ? 'Hide the stats' : 'Show all stats') : 'Season frozen'}</span>
                        </span>
                        <span class="guild-crystal-expand-btn__chev" aria-hidden="true">${seasonLive ? (_guildHallStatsExpanded ? '▲' : '▼') : ''}</span>
                    </button>
                </div>
            </div>
            ${seasonLive ? _buildGuildRaceTrack(displayData) : ''}
            <div class="guild-crystal-arena${_guildHallStatsExpanded && seasonLive ? ' guild-crystal-arena--stats-expanded' : ''}${seasonLive ? '' : ' guild-crystal-arena--frozen'}">${columns.join('')}</div>
        </div>`;

    // ── Update power tracking for next render ─────────────────────────────────
    displayData.forEach((g, index) => {
        const d = powerDeltas.get(g.guildId);
        _prevGuildPower.set(g.guildId, {
            power: Number(g.guildPower) || 0,
            rank: index,
            lastPowerDelta: d?.powerDelta || 0,
            lastRankDelta: d?.rankDelta || 0,
        });
    });
    _guildPowerIndicatorsReady = true;

    // ── Trigger entrance animations for trend indicators ──────────────────────
    if (!isFirstRender) {
        requestAnimationFrame(() => {
            list.querySelectorAll('.guild-crystal-trend__item').forEach(el => {
                el.classList.add('guild-crystal-trend__item--visible');
            });
        });
    }

    list.querySelector('.guild-crystal-expand-all-wrap')?.classList.toggle('guild-crystal-expand-all-wrap--open', Boolean(_guildHallStatsExpanded && seasonLive));

    const expandToggle = list.querySelector('#guild-stats-expand-toggle');
    expandToggle?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!seasonLive || expandToggle.disabled || expandToggle.classList.contains('is-season-frozen')) return;
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
        const sub = expandToggle.querySelector('.guild-crystal-expand-btn__sub');
        if (sub) {
            sub.textContent = _guildHallStatsExpanded ? 'Hide the stats' : 'Show all stats';
            sub.dataset.state = _guildHallStatsExpanded ? 'ready' : 'waiting';
        }
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

    // ── Roll Guild Power numbers up/down to their new values ─────────────────
    if (seasonLive) _animateGuildPowerCounters(list);

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
        toggle.setAttribute('aria-label', open ? 'Hide Fortune Ledger' : 'Show Fortune Ledger');
        panel.classList.toggle('is-open', open);
        panel.setAttribute('aria-hidden', open ? 'false' : 'true');
        if (open) panel.removeAttribute('inert');
        else panel.setAttribute('inert', '');
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

    if (!btn._fwWired) {
        btn._fwWired = true;
        btn.addEventListener('click', () => {
            if (!isGuildSeasonLive() || btn.disabled || btn.classList.contains('is-season-frozen')) return;
            openFortunesWheel();
        });
    }

    if (!isGuildSeasonLive()) {
        const frozenMsg = 'Fortune\'s Wheel stays sealed until the school year begins.';
        if (statusEl) statusEl.textContent = frozenMsg;
        if (windowEl) {
            windowEl.textContent = 'Season frozen';
            windowEl.dataset.state = 'locked';
        }
        btn.dataset.fwState = 'locked';
        btn.disabled = true;
        btn.classList.add('is-season-frozen');
        btn.setAttribute('aria-label', frozenMsg);
        btn.title = frozenMsg;
        section.dataset.state = 'locked';
        return;
    }

    btn.disabled = false;
    btn.classList.remove('is-season-frozen');

    const classId = state.get('globalSelectedClassId');
    const allClasses = state.get('allTeachersClasses') || [];
    const selectedClass = allClasses.find(c => c.id === classId) || null;
    let statusMsg = '';
    let statusTone = 'waiting';
    let windowMsg = 'Pick a class first';

    try {
        if (classId) {
            const canSpin = await canSpinThisWeek(classId);
            if (canSpin) {
                statusMsg = 'This class is in its final lesson before the weekend — you can run the wheel now.';
                statusTone = 'ready';
                windowMsg = 'Ready to spin!';
            } else {
                statusMsg = 'The wheel unlocks only during this class\'s final lesson of the week (before the weekend).';
                statusTone = 'locked';
                windowMsg = 'Opens in the last lesson of the week';
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
    section.dataset.state = statusTone;

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
