// /ui/tabs/guilds.js — Guild Hall: crystal-column rankings, lore overlay, guild sounds, anthem modal

import { getCrownRoadKeys, getGuildLeaderboardData } from '../../features/guildScoring.js';
import { CHAPTER_CROWNS, UNITY_SEAL, chapterDaysLeft, chapterName, chapterShortName, sharedPlaces } from '../../features/guildScoringCore.js';
import { getGuildBadgeHtml, getGuildById, getGuildEmblemUrl, GUILD_IDS, GUILDS } from '../../features/guilds.js';
import { openGuildHeroesModal } from '../modals/guildHeroes.js';
import { hideModal, showAnimatedModal } from '../modals/base.js';
import { openFortunesWheel, advanceWheel, triggerSpin, closeFortunesWheel, canSpinThisWeek } from '../../features/fortunesWheel.js';
import { GLORY_EMOJI } from '../../constants.js';
import * as state from '../../state.js';
import { isGameplaySeasonLiveFromAppState } from '../../utils/schoolYear.js';

/** Guild scores stay frozen while the school year is sealed. */
function isGuildSeasonLive() {
    return isGameplaySeasonLiveFromAppState(state);
}

// ─── Crown Race explainer overlay ────────────────────────────────────────────
let _powerExplainerWired = false;
/** The "How the Crown Race works" card. Exported so the guidebook capture renders the real card. */
export function guildPowerExplainerCardHtml() {
    const [first, second, third, fourth] = CHAPTER_CROWNS;
    const parts = [
        {
            key: 'season', icon: '📜', name: 'Every month is a Chapter',
            copy: 'On the 1st every guild starts at 0. The guild whose members earn the most Glory each, on average, wins the Chapter. Size never matters.',
        },
        {
            key: 'week', icon: '👑', name: 'Chapters pay Crowns',
            copy: `When a Chapter ends: 1st ${first} Crowns, 2nd ${second}, 3rd ${third}, 4th ${fourth}. A guild that earned no Glory gets none.`,
        },
        {
            key: 'active', icon: '🤝', name: 'The Unity Seal: +1 Crown',
            copy: `Any guild where at least 4 in 5 members earned ${UNITY_SEAL.minGlory} Glory (3 stars) that month. Bring the quiet heroes along!`,
        },
        {
            key: 'momentum', icon: '🏰', name: 'The June crown',
            copy: 'Most Crowns at the Grand Guild Ceremony wins the year. A tie goes to the most Glory per member this year.',
        },
    ];
    return `
        <div class="guild-power-explainer-card pop-in">
            <button type="button" class="guild-power-explainer-close" data-gpex-close="true" aria-label="Close">
                <i class="fas fa-xmark" aria-hidden="true"></i>
            </button>
            <header class="guild-power-explainer-head">
                <span class="guild-power-explainer-bolt" aria-hidden="true"><i class="fas fa-crown"></i></span>
                <h3 id="guild-power-explainer-title" class="guild-power-explainer-title font-title">How the Crown Race works</h3>
                <p class="guild-power-explainer-copy">
                    Every star a member earns is <strong>${GLORY_EMOJI}2 Glory</strong> for their guild. Win the month,
                    take the Crowns, and the guild with the most Crowns is crowned in June.
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
                Glory comes from stars, Quiz of the Week, Fortune’s Wheel and a few Mystic Market relics. Nothing random
                takes Glory away, and every change is written in the Glory ledger, so the standings can always be checked.
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

// ─── Chapter Glory change tracking (for live arrow indicators) ───────────────
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
const ANTHEM_LAST_LINE_SECONDS = 3.6; // how long the final line is sung (no next line to measure from)
const KARAOKE_LEAD_SECONDS = 0.08;    // light a line a hair early so eyes reach it as the voice does

function ensureAnthemOverlayRoot() {
    const overlay = document.getElementById('guild-anthem-overlay');
    if (!overlay || overlay.parentElement === document.body) return overlay;
    document.body.appendChild(overlay);
    return overlay;
}

function _setAnthemStatus(text) {
    const el = document.getElementById('guild-anthem-now-playing-text');
    if (el && el.textContent !== text) el.textContent = text;
}

function _setAnthemProgress(fraction) {
    const fill = document.getElementById('guild-anthem-progress-fill');
    if (fill) fill.style.transform = `scaleX(${Math.max(0, Math.min(1, fraction || 0))})`;
}

/** Glide the lyric panel (not the page) so the sung line sits a little above centre. */
function _centerLyricLine(lyricsEl, line, smooth = true) {
    if (!lyricsEl || !line || lyricsEl.scrollHeight <= lyricsEl.clientHeight + 1) return;
    const boxRect = lyricsEl.getBoundingClientRect();
    const lineRect = line.getBoundingClientRect();
    const target = lyricsEl.scrollTop + (lineRect.top - boxRect.top) - (lyricsEl.clientHeight * 0.4 - lineRect.height / 2);
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    lyricsEl.scrollTo({ top: Math.max(0, target), behavior: smooth && !reduceMotion ? 'smooth' : 'auto' });
}

function startKaraokeSync(guildId) {
    stopKaraokeSync();
    const audio = _anthemCache[guildId];
    const lyricsEl = document.getElementById('guild-anthem-lyrics');
    if (!audio || !lyricsEl) return;

    const lines = Array.from(lyricsEl.querySelectorAll('.guild-anthem-line[data-time]'));
    if (!lines.length) return;
    const times = lines.map(line => parseFloat(line.dataset.time) || 0);
    const sections = Array.from(lyricsEl.children);

    let lastActiveIdx = -2;
    let rafId = 0;
    let finished = false;

    function paint(activeIdx, ct) {
        lines.forEach((line, i) => {
            const active = i === activeIdx;
            if (active) {
                // Start the gold sweep where the song actually is (re-opens / late frames)
                line.style.setProperty('--line-offset', `${-Math.max(0, ct - times[i]).toFixed(2)}s`);
            }
            line.classList.toggle('karaoke-active', active);
            line.classList.toggle('karaoke-past', i < activeIdx);
            line.classList.toggle('karaoke-upcoming', i > activeIdx);
            line.classList.toggle('karaoke-next', i === activeIdx + 1);
        });
        const activeLine = lines[activeIdx];
        const singingSection = activeLine?.closest('.guild-anthem-verse, .guild-anthem-chorus') || null;
        sections.forEach(section => section.classList.toggle('is-singing', section === singingSection));
        if (activeIdx < 0) {
            _setAnthemStatus('Get ready to sing…');
            _centerLyricLine(lyricsEl, lines[0], false);
        } else {
            _setAnthemStatus(`Sing the ${singingSection?.dataset.section || 'song'}!`);
            _centerLyricLine(lyricsEl, activeLine);
        }
    }

    function update() {
        if (!_currentAnthemId) {
            // The anthem has faded out (or the alcove was closed): the last line stays lit as the curtain call
            if (!finished) {
                finished = true;
                _setAnthemStatus('Bravo! 🎉');
                _setAnthemProgress(1);
            }
            rafId = 0;
            return;
        }
        const ct = audio.currentTime;
        const lead = ct + KARAOKE_LEAD_SECONDS;
        let activeIdx = -1;
        for (let i = 0; i < times.length; i++) {
            if (lead >= times[i]) activeIdx = i;
        }
        if (activeIdx !== lastActiveIdx) {
            lastActiveIdx = activeIdx;
            paint(activeIdx, ct);
        }
        if (audio.duration && Number.isFinite(audio.duration)) _setAnthemProgress(ct / audio.duration);
        rafId = requestAnimationFrame(update);
    }

    // Frame-accurate while visible; timeupdate keeps it honest if frames are throttled
    function onTimeUpdate() { if (!rafId && !finished) update(); }
    audio.addEventListener('timeupdate', onTimeUpdate);
    rafId = requestAnimationFrame(update);

    _karaokeCleanup = () => {
        audio.removeEventListener('timeupdate', onTimeUpdate);
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
    };
}

function stopKaraokeSync() {
    if (_karaokeCleanup) { _karaokeCleanup(); _karaokeCleanup = null; }
    // reset all line states
    document.querySelectorAll('.guild-anthem-line').forEach(l => {
        l.classList.remove('karaoke-active', 'karaoke-past', 'karaoke-upcoming', 'karaoke-next');
        l.style.removeProperty('--line-offset');
    });
    document.querySelectorAll('#guild-anthem-lyrics .is-singing').forEach(s => s.classList.remove('is-singing'));
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
        // Each line knows how long it is sung (until the next line starts), so the
        // gold ink can sweep across it in time with the singers.
        const times = guild.anthemLyrics.flatMap(section => section.lines.map(line => Number(line.time) || 0));
        let lineIdx = 0;
        lyricsEl.innerHTML = guild.anthemLyrics.map(section => {
            const sectionClass = section.type === 'chorus' ? 'guild-anthem-chorus' : 'guild-anthem-verse';
            const label = section.type === 'chorus' ? '🎶 Chorus' : '🎵 Verse';
            return `
                <div class="${sectionClass}" data-section="${section.type === 'chorus' ? 'Chorus' : 'Verse'}">
                    <span class="guild-anthem-section-label">${label}</span>
                    ${section.lines.map(line => {
                const i = lineIdx++;
                const next = times[i + 1];
                const dur = Math.min(6, Math.max(1.2, (next ?? times[i] + ANTHEM_LAST_LINE_SECONDS) - times[i]));
                return `<p class="guild-anthem-line karaoke-upcoming" data-time="${times[i]}" style="--line-dur:${dur.toFixed(2)}s"><span class="guild-anthem-line__text">${_escapeHtml(line.text)}</span></p>`;
            }).join('')}
                </div>`;
        }).join('');
        lyricsEl.scrollTop = 0;
    }
    _setAnthemStatus('Now Playing…');
    _setAnthemProgress(0);
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
            const crowns = Number(gData?.crowns) || 0;
            const live = gData?.live || {};
            const chapter = chapterName(live.key) || 'This month';
            const wins = (gData?.chapterWins || []).map(chapterShortName);
            statsEl.innerHTML = `
                <div class="guild-lore-metrics-primary">
                    <div class="guild-lore-metric-tile guild-lore-metric-tile--power">
                        <div class="guild-lore-metric-tile__label">
                            <span aria-hidden="true">👑</span> Crowns
                            <button type="button" class="guild-lore-power-hint"
                                aria-label="Explain the Crown Race" data-guild-lore-power-info="true">?</button>
                        </div>
                        <div class="guild-lore-metric-tile__value">${crowns}</div>
                        <div class="guild-lore-metric-tile__hint">${wins.length ? `Won ${wins.join(', ')}` : 'No Chapter won yet'}</div>
                    </div>
                    <div class="guild-lore-metric-tile guild-lore-metric-tile--glory">
                        <div class="guild-lore-metric-tile__label">
                            <span aria-hidden="true">${GLORY_EMOJI}</span> ${chapter}
                        </div>
                        <div class="guild-lore-metric-tile__value">${_fmtGlory(live.perMember)}</div>
                        <div class="guild-lore-metric-tile__hint">Glory per member this Chapter${live.place ? ` · ${_ordinal(live.place)} place` : ''}</div>
                    </div>
                </div>
                <div class="guild-lore-metrics-secondary">
                    <span class="guild-lore-stat guild-lore-stat--pill"><span aria-hidden="true">🤝</span> <strong>${Number(live.unityCount) || 0}/${members}</strong> Unity</span>
                    <span class="guild-lore-stat guild-lore-stat--pill"><span aria-hidden="true">${GLORY_EMOJI}</span> <strong>${_fmtGlory(gData?.yearGloryPerMember)}</strong> per member this year</span>
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
        // The Crown Race explainer can sit on top of the lore card — Escape closes only the top one.
        const explainer = document.getElementById('guild-power-explainer-overlay');
        if (explainer && !explainer.classList.contains('hidden')) return;
        closeGuildLore();
    });
}

// ─── Main render ─────────────────────────────────────────────────────────────

/** Glory as shown: one decimal below 100 (0.4, 23.5), whole numbers above. */
function _fmtGlory(n) {
    const v = Math.max(0, Number(n) || 0);
    return v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
}

function _ordinal(n) {
    return ['1st', '2nd', '3rd', '4th'][Number(n) - 1] || `#${n}`;
}

function _escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function _emblemBadge(guildId, guildName, cls) {
    const emblemUrl = getGuildEmblemUrl(guildId);
    const initial = String(guildName || guildId || '?').trim().charAt(0).toUpperCase() || '?';
    return emblemUrl
        ? `<img src="${emblemUrl}" alt="" class="${cls}" loading="lazy" decoding="async" width="28" height="28">`
        : `<span class="${cls} ${cls}--initial">${initial}</span>`;
}

/** Year places: guilds share a place only when Crowns and the year's Glory per member are both level. */
function _yearPlaces(rows) {
    return sharedPlaces(rows, (r) => (Number(r.crowns) || 0) * 100000 + Math.round((Number(r.yearGloryPerMember) || 0) * 100) / 100);
}

/**
 * The Crown Road: one row per guild in year order, its Crowns, and a stone per Chapter
 * (sealed: the Crowns it paid; running: what it would pay today; still to come: empty).
 */
function _buildCrownRoad(rows, keys) {
    const liveKey = rows[0]?.live?.key;
    const daysLeft = chapterDaysLeft();
    const anyCrowns = rows.some((r) => r.crowns > 0);
    const places = _yearPlaces(rows);
    const head = keys.map((k) => `<span class="crown-road__month${k === liveKey ? ' is-live' : ''}" title="${chapterName(k)}">${chapterShortName(k)}</span>`).join('');
    const body = rows.map((r, i) => {
        const guild = getGuildById(r.guildId);
        const byKey = new Map(r.chapters.map((c) => [c.key, c]));
        const stones = keys.map((k) => {
            const sealed = byKey.get(k);
            if (sealed) {
                const won = sealed.place === 1;
                const tip = sealed.place
                    ? `${chapterName(k)}: ${_ordinal(sealed.place)} place${sealed.unity ? ' + Unity Seal' : ''} · ${sealed.crowns} Crown${sealed.crowns === 1 ? '' : 's'}`
                    : `${chapterName(k)}: no Glory, no Crowns`;
                return `<span class="crown-road__stone is-sealed${won ? ' is-won' : ''}${sealed.unity ? ' has-unity' : ''}" title="${tip}">${won ? '<i class="fas fa-crown" aria-hidden="true"></i>' : ''}<b>${sealed.crowns || '·'}</b></span>`;
            }
            if (k === liveKey && r.live?.counts) {
                const c = Number(r.live.crowns) || 0;
                return `<span class="crown-road__stone is-live" title="${chapterName(k)} is still running: ${c ? `${c} Crown${c === 1 ? '' : 's'} if it ended today` : 'no Glory yet'}"><b>${c ? `+${c}` : '…'}</b></span>`;
            }
            return `<span class="crown-road__stone is-future" aria-hidden="true"></span>`;
        }).join('');
        return `
                <div class="crown-road__row${places[i] === 0 && anyCrowns ? ' is-leader' : ''}" style="--road-primary:${guild?.primary || '#6b7280'};--road-glow:${guild?.glow || '#fff'};">
                    <span class="crown-road__guild">${_emblemBadge(r.guildId, r.guildName, 'crown-road__emblem')}<span class="crown-road__name">${r.guildName}</span></span>
                    <span class="crown-road__crowns" title="${r.crowns} Crown${r.crowns === 1 ? '' : 's'} from sealed Chapters"><i class="fas fa-crown" aria-hidden="true"></i>${r.crowns}</span>
                    <span class="crown-road__stones">${stones}</span>
                </div>`;
    }).join('');
    const leader = rows[0];
    const second = rows[1];
    const gap = leader && second ? leader.crowns - second.crowns : 0;
    const summary = !anyCrowns
        ? `The first Chapter is under way. Win ${chapterName(liveKey) || 'it'} to take the first ${CHAPTER_CROWNS[0]} Crowns.`
        : gap > 0
            ? `<strong>${leader.guildName}</strong> leads the Crown Race by <strong>${gap}</strong> Crown${gap === 1 ? '' : 's'}`
            : 'Level on Crowns at the top: the year’s Glory per member splits them';
    return `
            <section class="crown-road" aria-label="The Crown Race">
                <header class="crown-road__head">
                    <span class="crown-road__title"><i class="fas fa-crown" aria-hidden="true"></i>The Crown Race</span>
                    <span class="crown-road__summary">${summary}</span>
                    <span class="crown-road__chapter">${chapterName(liveKey)} Chapter · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left
                        <button class="guild-power-info-btn" type="button" aria-label="Explain the Crown Race" data-guild-power-info="true">?</button></span>
                </header>
                <div class="crown-road__grid" style="--road-months:${keys.length};">
                    <div class="crown-road__row crown-road__row--head"><span class="crown-road__guild"></span><span class="crown-road__crowns"><i class="fas fa-crown" aria-hidden="true"></i></span><span class="crown-road__stones">${head}</span></div>
                    ${body}
                </div>
            </section>`;
}

/** Chapter line under the big number: place in this month's race and the Crowns it would pay. */
function _chapterLine(g, rows) {
    const live = g.live || {};
    if (!live.counts) return { tone: 'tie', icon: 'fa-hourglass-start', text: 'Warm-up Chapter: no Crowns yet' };
    if (!live.place) return { tone: 'tie', icon: 'fa-hourglass-start', text: 'No Glory yet this Chapter' };
    const tied = rows.some((r) => r.guildId !== g.guildId && r.live?.place === live.place);
    const crowns = Number(live.crowns) || 0;
    return {
        tone: live.place === 1 ? 'lead' : 'chase',
        icon: live.place === 1 ? 'fa-crown' : 'fa-flag-checkered',
        text: `${tied ? 'Tied ' : ''}${_ordinal(live.place)} now · +${crowns} 👑 so far`,
    };
}

/** How far this guild is from the Unity Seal this Chapter. */
function _unityMeterHtml(g) {
    const live = g.live || {};
    const have = Number(live.unityCount) || 0;
    const need = Math.max(1, Number(live.unityNeeded) || 0);
    const members = Number(g.memberCount) || 0;
    const pct = members ? Math.min(100, Math.round((have / need) * 100)) : 0;
    const sealed = Boolean(live.unity);
    const title = `Unity Seal: +${UNITY_SEAL.crowns} Crown when at least ${need} of ${members} members earn ${UNITY_SEAL.minGlory} Glory (3 stars) this Chapter.`;
    return `
                    <div class="guild-unity-meter${sealed ? ' is-sealed' : ''}" title="${title}">
                        <span class="guild-unity-meter__label"><span aria-hidden="true">🤝</span>${sealed ? 'Unity Seal won' : 'Unity Seal'}</span>
                        <span class="guild-unity-meter__bar" aria-hidden="true"><span style="width:${pct}%"></span></span>
                        <span class="guild-unity-meter__count">${have}/${need}</span>
                    </div>`;
}

function _standardsHtml(g) {
    const names = [...new Set((g.standards || []).map((s) => s?.name).filter(Boolean))];
    if (!names.length) return '';
    return `<div class="guild-standards" title="Raised with a Guild Standard from the Mystic Market"><span aria-hidden="true">🚩</span>${names.slice(0, 3).map(_escapeHtml).join(' · ')}${names.length > 3 ? ` +${names.length - 3}` : ''}</div>`;
}

function _heroTile(c, primary, medal, placeLabel, hint) {
    const initialHero = String(c.name || '?').trim().charAt(0).toUpperCase() || '?';
    const avatarInner = c.avatar
        ? `<img src="${c.avatar}" alt="" class="guild-crystal-hero-tile__avatar-img" loading="lazy" decoding="async" width="36" height="36">`
        : `<span class="guild-crystal-hero-tile__avatar-fallback">${initialHero}</span>`;
    return `
                       <span class="guild-crystal-hero-tile" style="--hero-tile-accent:${primary};" title="${c.name} — ${_fmtGlory(c.glory)} ${GLORY_EMOJI} ${hint}">
                           <span class="guild-crystal-hero-tile__avatar" aria-hidden="true">${avatarInner}</span>
                           <span class="guild-crystal-hero-tile__body">
                               <span class="guild-crystal-hero-tile__name">${c.name}</span>
                               <span class="guild-crystal-hero-tile__glory">
                                   <span class="guild-crystal-hero-tile__glory-num">${_fmtGlory(c.glory)}</span>
                                   <span class="guild-crystal-hero-tile__glory-icon" aria-hidden="true">${GLORY_EMOJI}</span>
                                   <span class="guild-crystal-hero-tile__glory-hint">${hint}</span>
                               </span>
                           </span>
                           <span class="guild-crystal-hero-tile__medal" role="img" aria-label="${placeLabel}">${medal}</span>
                       </span>`;
}

/** Chapter champion: the member who has earned the most Glory this Chapter. */
function _buildGuildChampionPanel(g, primary) {
    const header = `
                <header class="guild-crystal-champion-panel__header">
                    <span class="guild-crystal-champion-panel__burst" aria-hidden="true"><i class="fas fa-crown"></i></span>
                    <div class="guild-crystal-champion-panel__headlines">
                        <h4 class="guild-crystal-champion-panel__title">Chapter champion</h4>
                        <p class="guild-crystal-champion-panel__subtitle">Most ${GLORY_EMOJI} Glory in ${chapterName(g.live?.key) || 'this Chapter'}</p>
                    </div>
                    <button type="button" class="guild-power-info-btn guild-analytics-info-btn guild-crystal-champion-panel__info"
                            data-top-heroes-guild="${g.guildId}" title="Guild spotlight" aria-label="Open guild spotlight">i</button>
                </header>`;
    const champ = g.chapterTop?.[0];
    return `
            <section class="guild-crystal-champion-panel guild-crystal-champion-panel--balanced" style="--guild-champion-accent:${primary};" aria-label="Chapter champion">
                ${header}
                <div class="guild-crystal-champion-panel__body">
                    ${champ ? _heroTile(champ, primary, '🥇', 'Chapter champion', 'this Chapter') : '<p class="guild-crystal-champion-panel__vacant" role="status">Throne vacant: the first star this Chapter claims it.</p>'}
                </div>
            </section>`;
}

/** The crystal tubes share one scale: the next round mark above the Chapter leader (never under 10). */
function _crystalTubeScale(displayData) {
    const top = Math.max(0, ...displayData.map((g) => Number(g.live?.perMember) || 0));
    const marks = [10, 20, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000];
    const mark = marks.find((m) => m >= top * 1.1);
    return mark || Math.ceil((top * 1.1) / 500) * 500;
}

function _crystalFillPct(value, scale) {
    if (!(value > 0.005)) return 0;
    return Math.max(3, Math.min(92, Math.round((value / scale) * 92)));
}

/** Rolls each changed Chapter number from its previous value (skipped for reduced motion). */
let _powerCountToken = 0;
function _animateGuildPowerCounters(root) {
    const token = ++_powerCountToken;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const jobs = [...root.querySelectorAll('.guild-crystal-count-num[data-count-to]')]
        .map((el) => ({ el, from: Number(el.dataset.countFrom), to: Number(el.dataset.countTo) }))
        .filter((j) => Number.isFinite(j.from) && Number.isFinite(j.to) && j.from !== j.to);
    if (!jobs.length) return;
    jobs.forEach((j) => { j.el.textContent = _fmtGlory(j.from); });
    const duration = 1200;
    const start = performance.now();
    const step = (now) => {
        if (token !== _powerCountToken) return;
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        jobs.forEach((j) => { j.el.textContent = _fmtGlory(j.from + (j.to - j.from) * eased); });
        if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

/**
 * "Latest" row: the last change to this Chapter's Glory per member and any change of year place,
 * in words. Empty (but still reserving its row, so columns stay aligned) until something moves.
 */
function _guildTrendRow(delta, isFirstRender, placeIndex) {
    const items = [];
    if (delta && !isFirstRender) {
        if (delta.powerDelta) {
            const up = delta.powerDelta > 0;
            const abs = Math.abs(delta.powerDelta);
            items.push(`<span class="guild-crystal-trend__item guild-crystal-trend__item--${up ? 'up' : 'down'}"
                title="This Chapter's Glory per member ${up ? 'rose' : 'fell'} by ${abs}">
                <i class="fas ${up ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}" aria-hidden="true"></i>${up ? '+' : '−'}${abs} ${GLORY_EMOJI}</span>`);
        }
        if (delta.rankDelta) {
            const climbed = delta.rankDelta > 0;
            const place = _ordinal(placeIndex + 1);
            items.push(`<span class="guild-crystal-trend__item guild-crystal-trend__item--${climbed ? 'climb' : 'slip'}"
                title="${climbed ? 'Climbed' : 'Slipped'} to ${place} in the Crown Race">
                <i class="fas ${climbed ? 'fa-circle-up' : 'fa-circle-down'}" aria-hidden="true"></i>${climbed ? 'Up' : 'Down'} to ${place}</span>`);
        }
    }
    return `<div class="guild-crystal-trend${items.length ? '' : ' guild-crystal-trend--quiet'}">${items.length
        ? `<span class="guild-crystal-trend__label">Latest</span>${items.join('')}`
        : ''}</div>`;
}

export function renderGuildsTab() {
    const list = document.getElementById('guilds-leaderboard-list');
    if (!list) return;

    _ensurePowerExplainerOverlay();

    wireGuildLoreListeners();
    wireAnthemListeners();

    const seasonLive = isGuildSeasonLive();
    const rows = getGuildLeaderboardData();
    // Frozen season: stable guild order (no false rankings).
    const displayData = seasonLive ? rows : GUILD_IDS.map((gid) => rows.find((r) => r.guildId === gid)).filter(Boolean);
    const places = _yearPlaces(displayData);

    // ── Changes since the last render, for the "Latest" row ───────────────────
    const powerDeltas = new Map();
    const isFirstRender = !_guildPowerIndicatorsReady;
    if (seasonLive) {
        displayData.forEach((g, index) => {
            const prev = _prevGuildPower.get(g.guildId);
            if (!prev) return;
            const powerDelta = Math.round(((Number(g.live?.perMember) || 0) - Number(prev.power)) * 10) / 10;
            const rankDelta = prev.rank - index; // positive = moved up
            if (powerDelta === 0 && rankDelta === 0) {
                powerDeltas.set(g.guildId, { powerDelta: prev.lastPowerDelta || 0, rankDelta: prev.lastRankDelta || 0, freshChange: false });
            } else {
                powerDeltas.set(g.guildId, { powerDelta, rankDelta, freshChange: true });
            }
        });
    }

    const tubeScale = _crystalTubeScale(displayData);
    const anyCrowns = displayData.some((g) => g.crowns > 0);

    const columns = displayData.map((g, index) => {
        const guild = getGuildById(g.guildId);
        const emblemUrl = getGuildEmblemUrl(g.guildId);
        const primary = guild?.primary || '#6b7280';
        const secondary = guild?.secondary || '#9ca3af';
        const glow = guild?.glow || primary;
        const initial = String(g.guildName || g.guildId || '?').trim().charAt(0).toUpperCase() || '?';
        const live = g.live || {};
        const perMember = Number(live.perMember) || 0;
        const fillPct = seasonLive ? _crystalFillPct(perMember, tubeScale) : 0;
        const chapter = chapterName(live.key) || 'This month';

        const emblemHtml = emblemUrl
            ? `<img src="${emblemUrl}" alt="${g.guildName}" class="guild-crystal-emblem"
                    style="border-color:${primary}; box-shadow: 0 0 16px ${glow}77;">`
            : `<div class="guild-crystal-emblem guild-crystal-emblem-fallback"
                    style="background:linear-gradient(135deg,${primary},${secondary}); box-shadow:0 0 16px ${glow}77;">
                   <span class="guild-crystal-emblem-initial" style="color:${primary}">${initial}</span>
               </div>`;

        const legends = seasonLive ? (g.topContributors || []).slice(0, 3) : [];
        const legendMedals = ['🥇', '🥈', '🥉'];
        const topHeroesBody = !seasonLive
            ? `<p class="guild-crystal-heroes-panel__empty" role="status">Legends sleep until the school year begins.</p>`
            : legends.length
                ? legends.map((c, hi) => _heroTile({ ...c, glory: c.gloryEstimate }, primary, legendMedals[hi] || '✨', `${_ordinal(hi + 1)} this year`, 'this year')).join('')
                : `<p class="guild-crystal-heroes-panel__empty" role="status">Summon stars to crown your first legends.</p>`;

        const championPanelHtml = seasonLive
            ? _buildGuildChampionPanel(g, primary)
            : `
            <section class="guild-crystal-champion-panel guild-crystal-champion-panel--balanced guild-crystal-champion-panel--frozen" style="--guild-champion-accent:${primary};" aria-label="Chapter champion">
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
                        <h4 class="guild-crystal-heroes-panel__title">${seasonLive ? 'Legends of the year' : 'Legends awaiting'}</h4>
                        <p class="guild-crystal-heroes-panel__subtitle">${seasonLive ? `Most ${GLORY_EMOJI} Glory earned this school year` : 'Glory ledgers open when classes begin'}</p>
                    </div>
                </header>
                <div class="guild-crystal-heroes-panel__roster">${topHeroesBody}</div>
            </section>`;

        const prevEntry = _prevGuildPower.get(g.guildId);
        const countFrom = prevEntry ? _fmtGlory(prevEntry.power) : '0';
        const line = seasonLive ? _chapterLine(g, displayData) : null;
        const wins = (g.chapterWins || []).map(chapterShortName);

        const countBlock = seasonLive
            ? `
                <div class="guild-crystal-count" style="color:${primary};">
                    <span class="guild-crystal-count-num${(() => { const d = powerDeltas.get(g.guildId); if (!d || isFirstRender) return ''; return d.powerDelta > 0 ? ' guild-power-boost' : d.powerDelta < 0 ? ' guild-power-drop' : ''; })()}" data-guild-id="${g.guildId}" data-count-from="${countFrom}" data-count-to="${_fmtGlory(perMember)}">${_fmtGlory(perMember)}</span>
                    <span class="guild-crystal-count-label">
                        ${GLORY_EMOJI} per member · ${chapter}
                        <button class="guild-power-info-btn" type="button" aria-label="Explain the Crown Race" data-guild-power-info="true">?</button>
                    </span>
                    <span class="guild-crystal-chase guild-crystal-chase--${line.tone}"><i class="fas ${line.icon}" aria-hidden="true"></i>${line.text}</span>
                    ${_guildTrendRow(powerDeltas.get(g.guildId), isFirstRender, places[index])}
                    ${_unityMeterHtml(g)}
                    <div class="guild-crystal-power-strip guild-crystal-power-strip--tiles guild-crystal-power-strip--crowns" aria-label="How ${g.guildName} is doing">
                        <span class="guild-crystal-power-tile guild-crystal-power-tile--crowns" title="Crowns from sealed Chapters. Most Crowns in June wins the year."><strong>👑 ${g.crowns}</strong><small>Crowns<br>this year</small></span>
                        <span class="guild-crystal-power-tile" title="Chapters this guild has won${wins.length ? `: ${wins.join(', ')}` : ''}"><strong>${wins.length}</strong><small>Chapters<br>won</small></span>
                        <span class="guild-crystal-power-tile" title="Glory each member earned this school year, on average. Splits a tie on Crowns."><strong>${_fmtGlory(g.yearGloryPerMember)}</strong><small>${GLORY_EMOJI} per member<br>this year</small></span>
                    </div>
                    ${_standardsHtml(g)}
                </div>`
            : `
                <div class="guild-crystal-count guild-crystal-count--frozen" style="color:${primary};">
                    <span class="guild-crystal-count-num guild-crystal-count-num--frozen" data-guild-id="${g.guildId}" aria-label="Guild Hall frozen">—</span>
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
                                    <div class="guild-crystal-metric__label">${chapter} Glory</div>
                                    <div class="guild-crystal-metric__value">${_fmtGlory(live.glory)} <span class="guild-crystal-metric__unit">${GLORY_EMOJI}</span></div>
                                    <div class="guild-crystal-metric__hint">${_fmtGlory(perMember)} per member</div>
                                </div>
                                <div class="guild-crystal-metric">
                                    <div class="guild-crystal-metric__label">Members contributing</div>
                                    <div class="guild-crystal-metric__value">${Number(live.contributors) || 0} / ${g.memberCount}</div>
                                    <div class="guild-crystal-metric__hint">earned Glory this Chapter</div>
                                </div>
                                <div class="guild-crystal-metric">
                                    <div class="guild-crystal-metric__label">Chapters won</div>
                                    <div class="guild-crystal-metric__value">${wins.length ? wins.join(' · ') : '—'}</div>
                                    <div class="guild-crystal-metric__hint">${g.crowns} Crown${g.crowns === 1 ? '' : 's'} so far</div>
                                </div>
                            </div>
                            <div class="guild-crystal-roster-ribbon" style="--guild-roster-accent:${primary};">
                                <div class="guild-crystal-roster-ribbon__seg" role="group" aria-label="Guild roster size">
                                    <span class="guild-crystal-roster-ribbon__eyebrow"><i class="fas fa-users" aria-hidden="true"></i>Roster</span>
                                    <span class="guild-crystal-roster-ribbon__figure">${g.memberCount}</span>
                                    <span class="guild-crystal-roster-ribbon__fine">${g.memberCount === 1 ? 'guildmate' : 'guildmates'}</span>
                                </div>
                                <div class="guild-crystal-roster-ribbon__rule" aria-hidden="true"></div>
                                <div class="guild-crystal-roster-ribbon__seg guild-crystal-roster-ribbon__seg--glory" role="group" aria-label="Glory earned this year">
                                    <span class="guild-crystal-roster-ribbon__eyebrow"><span aria-hidden="true">${GLORY_EMOJI}</span>This year</span>
                                    <span class="guild-crystal-roster-ribbon__figure guild-crystal-roster-ribbon__figure--accent">${Math.round(Number(g.countedGlory) || 0)}</span>
                                    <span class="guild-crystal-roster-ribbon__fine">Glory earned</span>
                                </div>
                            </div>`
            : `
                            <div class="guild-crystal-metrics guild-crystal-metrics--frozen" style="--guild-metric-accent:${primary};">
                                <div class="guild-crystal-metric">
                                    <div class="guild-crystal-metric__label">Chapter Glory</div>
                                    <div class="guild-crystal-metric__value">—</div>
                                    <div class="guild-crystal-metric__hint">Awaiting school year</div>
                                </div>
                                <div class="guild-crystal-metric">
                                    <div class="guild-crystal-metric__label">Crowns</div>
                                    <div class="guild-crystal-metric__value">❄</div>
                                    <div class="guild-crystal-metric__hint">Not counting yet</div>
                                </div>
                            </div>`;

        const rankClass = seasonLive ? `is-rank-${places[index] + 1}` : 'is-frozen';
        const rankLabel = !seasonLive ? '❄' : !anyCrowns && !displayData.some((r) => r.yearGloryPerMember > 0) ? '—' : _ordinal(places[index] + 1);
        const showCrown = seasonLive && rankLabel !== '—' && places[index] === 0;

        return `
            <div class="guild-crystal-col ${rankClass}${(() => { if (!seasonLive) return ''; const d = powerDeltas.get(g.guildId); return (!isFirstRender && d && d.freshChange && d.rankDelta !== 0) ? ' guild-rank-changed' : ''; })()}" data-guild="${g.guildId}"
                 style="--guild-primary:${primary};--guild-secondary:${secondary};--guild-glow:${glow};">

                <!-- ── Place in the Crown Race ── -->
                <div class="guild-crystal-rank"><span class="guild-crystal-rank__label">${showCrown ? '<i class="fas fa-crown guild-crystal-rank__crown" aria-hidden="true"></i>' : ''}${rankLabel}</span></div>

                <div class="guild-crystal-header">
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

                <!-- ── Crystal tube: this Chapter's Glory per member ── -->
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
                             style="height:0%;
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
            ${seasonLive ? _buildCrownRoad(displayData, getCrownRoadKeys()) : ''}
            <div class="guild-crystal-arena${_guildHallStatsExpanded && seasonLive ? ' guild-crystal-arena--stats-expanded' : ''}${seasonLive ? '' : ' guild-crystal-arena--frozen'}">${columns.join('')}</div>
        </div>`;

    // ── Remember this render for the next "Latest" row ────────────────────────
    displayData.forEach((g, index) => {
        const d = powerDeltas.get(g.guildId);
        _prevGuildPower.set(g.guildId, {
            power: Number(g.live?.perMember) || 0,
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

    // ── Roll Chapter Glory numbers up/down to their new values ───────────────
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

    list.querySelector('.crown-road')?.addEventListener('click', (e) => {
        if (e.target.closest?.('[data-guild-power-info="true"]')) _openPowerExplainer();
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
