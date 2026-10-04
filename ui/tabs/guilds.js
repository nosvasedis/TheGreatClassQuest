// /ui/tabs/guilds.js — Guild Hall: month banners, the Crown Race, lore overlay, guild sounds, anthem modal

import { getCrownRoadKeys, getGuildLeaderboardData } from '../../features/guildScoring.js';
import { CHAPTER_CROWNS, UNITY_SEAL, chapterDaysLeft, chapterName, chapterShortName, sharedPlaces } from '../../features/guildScoringCore.js';
import { getGuildById, getGuildEmblemUrl, GUILD_IDS } from '../../features/guilds.js';
import { yearChronicles } from '../../features/guildChronicleCore.js';
import { isSpeaking, isTtsSupported, speakText, stopSpeech } from '../../features/tts.js';
import { detectLowPowerTier } from '../../utils/devicePerformance.mjs';
import { openGuildHeroesModal } from '../modals/guildHeroes.js';
import { hideModal, showAnimatedModal } from '../modals/base.js';
import { openFortunesWheel, advanceWheel, triggerSpin, closeFortunesWheel, canSpinThisWeek, getWheelState } from '../../features/fortunesWheel.js';
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
const ANTHEM_LAST_LINE_SECONDS = 4.4; // how long the final line is sung (no next line to measure from)
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
                return `<p class="guild-anthem-line karaoke-upcoming" data-time="${times[i]}" style="--line-dur:${dur.toFixed(2)}s"><span class="guild-anthem-line__text"><span class="guild-anthem-line__ink">${_escapeHtml(line.text)}</span></span></p>`;
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

    // Light the matching banner in the Hall
    document.querySelectorAll('.gh-banner').forEach((el) => {
        el.classList.toggle('is-active', el.dataset.guild === guildId);
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
    document.querySelectorAll('.gh-banner.is-active').forEach((el) => el.classList.remove('is-active'));
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
// The Hall is built once and then patched in place: numbers roll, vials pour, Crown Race rows
// glide to their new places. Data arriving from the listeners never tears it down, so nothing
// flashes back to 0 and a teacher never sees it redraw.

const _lite = (() => { try { return detectLowPowerTier(); } catch { return false; } })();
const _reduceMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
const PLACE_CLASS = ['gold', 'silver', 'bronze', 'iron'];
let _hallSig = '';
let _chronicleView = null;
let _chronicleViewLoading = false;
let _chronicleKey = null;
let _renderFrame = 0;
const _htmlCache = new WeakMap(); // element → the HTML it last received
const _shown = new Map(); // `${guildId}:${field}` → the number on screen

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
        ? `<img src="${emblemUrl}" alt="" class="${cls}" loading="lazy" decoding="async" width="64" height="64">`
        : `<span class="${cls} ${cls}--initial">${initial}</span>`;
}

/** Year places: guilds share a place only when Crowns and the year's Glory per member are both level. */
function _yearPlaces(rows) {
    return sharedPlaces(rows, (r) => (Number(r.crowns) || 0) * 100000 + Math.round((Number(r.yearGloryPerMember) || 0) * 100) / 100);
}

/** Replace an element's HTML only when it really changed. */
function _setHtml(el, html) {
    if (!el || _htmlCache.get(el) === html) return false;
    _htmlCache.set(el, html);
    el.innerHTML = html;
    return true;
}

function _setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
}

/** Re-run a one-shot CSS animation class (place change, Unity sealed, Glory gained). */
function _pulse(el, cls) {
    if (!el || _reduceMotion()) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
}

/** The vials share one scale: a round mark just above this Chapter's leader (never under 10). */
function _vialScale(top) {
    const marks = [10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200, 300, 500, 1000];
    return marks.find((m) => m >= top * 1.12) || Math.ceil((top * 1.12) / 500) * 500;
}

function _hallModel(now = new Date()) {
    const seasonLive = isGuildSeasonLive();
    const scores = state.get('allGuildScores') || {};
    const students = state.get('allStudents') || [];
    const loading = !state.get('allGuildScoresLoaded') || (!students.length && Object.keys(scores).length > 0);
    const rows = getGuildLeaderboardData(now);
    const byId = new Map(rows.map((r) => [r.guildId, r]));
    const liveKey = rows[0]?.live?.key || '';
    const top = Math.max(0, ...rows.map((r) => Number(r.live?.perMember) || 0));
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return {
        seasonLive,
        loading,
        rows,
        byId,
        places: _yearPlaces(rows),
        liveKey,
        counts: rows[0]?.live?.counts !== false,
        roadKeys: getCrownRoadKeys(),
        scale: _vialScale(top),
        daysLeft: chapterDaysLeft(now),
        daysInMonth,
    };
}

// ── Shell (built once per season state) ──────────────────────────────────────

function _actionButtonsHtml(seasonLive) {
    return `
            <button type="button" id="fortunes-wheel-btn" class="gh-action gh-action--wheel${seasonLive ? '' : ' is-season-frozen'}"
                    data-fw-state="${seasonLive ? 'waiting' : 'locked'}" ${seasonLive ? '' : 'disabled'}
                    aria-label="${seasonLive ? "Open Fortune's Wheel" : "Fortune's Wheel is locked until the school year begins."}">
                <span class="gh-action__icon" aria-hidden="true"><i class="fa-solid ${seasonLive ? 'fa-dharmachakra' : 'fa-snowflake'}"></i></span>
                <span class="gh-action__text">
                    <span class="gh-action__title">Fortune's Wheel</span>
                    <span id="fortunes-wheel-window" class="gh-action__sub" data-state="${seasonLive ? 'waiting' : 'locked'}">${seasonLive ? 'Pick a class first' : 'Season frozen'}</span>
                </span>
            </button>`;
}

function _statsButtonHtml(seasonLive) {
    const open = seasonLive && _guildHallStatsExpanded;
    return `
            <button type="button" id="guild-stats-expand-toggle" class="gh-action gh-action--stats${seasonLive ? '' : ' is-season-frozen'}"
                    ${seasonLive ? '' : 'disabled'} aria-expanded="${open ? 'true' : 'false'}"
                    aria-label="${seasonLive ? (open ? 'Hide' : 'Show') + ' Guild Stats' : 'Guild Stats wake with the school year.'}">
                <span class="gh-action__icon" aria-hidden="true"><i class="fas ${seasonLive ? 'fa-ranking-star' : 'fa-snowflake'}"></i></span>
                <span class="gh-action__text">
                    <span class="gh-action__title">Guild Stats</span>
                    <span class="gh-action__sub" data-gh="statsSub">${seasonLive ? (open ? 'Fold them away' : 'Heroes and numbers') : 'Season frozen'}</span>
                </span>
                <span class="gh-action__chev" aria-hidden="true"><i class="fas fa-chevron-down"></i></span>
            </button>`;
}

function _payoutHtml() {
    const medals = ['🥇', '🥈', '🥉', '4th'];
    return CHAPTER_CROWNS.map((c, i) => `<li class="gh-payout__item gh-payout__item--${PLACE_CLASS[i]}"><span class="gh-payout__place">${medals[i]}</span><b>${c}</b><i class="fas fa-crown" aria-hidden="true"></i></li>`).join('')
        + `<li class="gh-payout__item gh-payout__item--unity" title="Unity Seal: at least 4 in 5 members earn ${UNITY_SEAL.minGlory} Glory (3 stars) this month"><span class="gh-payout__place">🤝</span><b>+${UNITY_SEAL.crowns}</b><i class="fas fa-crown" aria-hidden="true"></i></li>`;
}

function _bannerShellHtml(guildId, i, seasonLive) {
    const g = getGuildById(guildId) || {};
    const name = g.name || guildId;
    return `
            <article class="gh-banner${seasonLive ? '' : ' is-frozen'}" data-guild="${guildId}"
                     style="--g1:${g.primary || '#6b7280'};--g2:${g.secondary || '#9ca3af'};--gg:${g.glow || '#e5e7eb'};--i:${i};">
                <span class="gh-banner__rod" aria-hidden="true"></span>
                <div class="gh-banner__cloth">
                    <span class="gh-banner__place" data-gh="place" aria-live="polite"></span>
                    <div class="gh-banner__crest" data-guild-id="${guildId}" role="button" tabindex="0" aria-label="Unfurl the ${_escapeHtml(name)} banner">
                        ${_emblemBadge(guildId, name, 'gh-banner__emblem')}
                        <button type="button" class="gh-banner__anthem" data-anthem-guild="${guildId}" aria-label="Play the ${_escapeHtml(name)} anthem"><i class="fas fa-music" aria-hidden="true"></i></button>
                    </div>
                    <h3 class="gh-banner__name">${_escapeHtml(name)}</h3>
                    <div class="gh-vial" aria-hidden="true">
                        <div class="gh-vial__liquid" data-gh="liquid" style="transform:translate3d(0,100%,0)">
                            <span class="gh-vial__surface"></span>
                            <span class="gh-vial__bubbles"><i></i><i></i><i></i></span>
                        </div>
                        <span class="gh-vial__frost"></span>
                        <span class="gh-vial__shine"></span>
                    </div>
                    <div class="gh-banner__score">
                        <span class="gh-banner__num-wrap"><b class="gh-banner__num" data-gh="num">${seasonLive ? '0' : '—'}</b><span class="gh-banner__gain" data-gh="gain" aria-hidden="true"></span></span>
                        <span class="gh-banner__unit">${GLORY_EMOJI} Glory per member</span>
                    </div>
                    <div class="gh-banner__prize" data-gh="prize">${seasonLive ? '' : '<span class="gh-prize__big"><i class="fas fa-snowflake" aria-hidden="true"></i></span><span class="gh-prize__small">wakes with the school year</span>'}</div>
                    <div class="gh-unity" data-gh="unity">
                        <span class="gh-unity__seal" data-gh="unitySeal" aria-hidden="true"><span>🤝</span></span>
                        <span class="gh-unity__text"><b>Unity Seal</b><small data-gh="unityText"></small></span>
                    </div>
                    <div class="gh-banner__standards" data-gh="standards"></div>
                </div>
                <div class="gh-banner__details${_guildHallStatsExpanded && seasonLive ? ' is-open' : ''}" data-gh="details">
                    <div class="gh-banner__details-clip"><div class="gh-ds" data-gh="detailsInner"></div></div>
                </div>
            </article>`;
}

function _raceShellHtml(model) {
    const months = model.roadKeys.map((k) => `<span class="gh-race__month${k === model.liveKey ? ' is-live' : ''}" title="${chapterName(k)}">${chapterShortName(k)}</span>`).join('');
    const rows = model.rows.map((r) => {
        const g = getGuildById(r.guildId) || {};
        return `
                <li class="gh-race__row" data-guild="${r.guildId}" style="--g1:${g.primary || '#6b7280'};--g2:${g.secondary || '#9ca3af'};--gg:${g.glow || '#e5e7eb'};">
                    <span class="gh-race__place" data-gh="rplace"></span>
                    <span class="gh-race__guild">${_emblemBadge(r.guildId, r.guildName, 'gh-race__emblem')}<span class="gh-race__name">${_escapeHtml(r.guildName)}</span></span>
                    <span class="gh-race__track" data-gh="track"></span>
                    <span class="gh-race__total" title="Crowns from finished months"><i class="fas fa-crown" aria-hidden="true"></i><b data-gh="rcrowns">0</b></span>
                </li>`;
    }).join('');
    return `
            <section class="gh-race" aria-label="The Crown Race" style="--months:${Math.max(1, model.roadKeys.length)};">
                <header class="gh-race__head">
                    <h3 class="gh-race__title"><i class="fas fa-crown" aria-hidden="true"></i>The Crown Race</h3>
                    <p class="gh-race__summary" data-gh="raceSummary"></p>
                    <button type="button" class="gh-info" data-guild-power-info="true" aria-label="How the Crown Race works">?</button>
                </header>
                <div class="gh-race__board">
                    <div class="gh-race__row gh-race__row--head" aria-hidden="true">
                        <span class="gh-race__place"></span><span class="gh-race__guild">Guild</span>
                        <span class="gh-race__track">${months}</span>
                        <span class="gh-race__total"><i class="fas fa-crown"></i></span>
                    </div>
                    <ol class="gh-race__rows" data-gh="raceRows">${rows}</ol>
                </div>
                <div class="gh-chron" data-gh="chronicle" aria-live="polite" hidden></div>
            </section>`;
}

function _hallShellHtml(model) {
    const live = model.seasonLive;
    const chapter = chapterName(model.liveKey) || 'This month';
    return `
        <div class="gh${live ? '' : ' gh--frozen'}${_lite ? ' gh--lite' : ''}">
            <div class="gh-bar">
                ${_actionButtonsHtml(live)}
                <div class="gh-chapter" data-gh="chapter">
                    ${live ? `
                    <span class="gh-chapter__dial" data-gh="dial" aria-hidden="true"><span class="gh-chapter__days" data-gh="days"></span><small>days left</small></span>
                    <span class="gh-chapter__text">
                        <span class="gh-chapter__kicker">The race this month</span>
                        <span class="gh-chapter__name"><span data-gh="chapterName">${chapter}</span> Chapter</span>
                        <ol class="gh-payout" aria-label="Crowns paid when the month ends">${_payoutHtml()}</ol>
                    </span>
                    <button type="button" class="gh-info" data-guild-power-info="true" aria-label="How the Crown Race works">?</button>` : `
                    <span class="gh-chapter__dial gh-chapter__dial--frozen" aria-hidden="true"><i class="fas fa-snowflake"></i></span>
                    <span class="gh-chapter__text">
                        <span class="gh-chapter__kicker">Guild Hall frozen</span>
                        <span class="gh-chapter__name">The race wakes with the school year</span>
                    </span>`}
                </div>
                ${_statsButtonHtml(live)}
            </div>
            <div class="gh-banners">${GUILD_IDS.map((id, i) => _bannerShellHtml(id, i, live)).join('')}</div>
            ${live ? _raceShellHtml(model) : ''}
        </div>`;
}

// ── Patching ─────────────────────────────────────────────────────────────────

/** Roll a number from what is on screen to its new value. Returns the value it rolled from. */
function _roll(el, key, to, fmt, { fromZero = false } = {}) {
    if (!el) return to;
    const had = _shown.has(key);
    const from = had ? _shown.get(key) : (fromZero ? 0 : to);
    _shown.set(key, to);
    if (el._rollFrame) cancelAnimationFrame(el._rollFrame);
    if (from === to || _reduceMotion()) {
        _setText(el, fmt(to));
        return from;
    }
    const start = performance.now();
    const duration = 1100;
    const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        _setText(el, fmt(from + (to - from) * eased));
        el._rollFrame = t < 1 ? requestAnimationFrame(step) : 0;
    };
    el._rollFrame = requestAnimationFrame(step);
    return from;
}

function _prizeHtml(model, live, tied) {
    if (!model.counts) return '<span class="gh-prize__big">Warm-up</span><span class="gh-prize__small">no Crowns this month</span>';
    if (!live.place) return '<span class="gh-prize__big">—</span><span class="gh-prize__small">no Glory yet this month</span>';
    const crowns = Number(live.crowns) || 0;
    return `<span class="gh-prize__big">+${crowns} <i class="fas fa-crown" aria-hidden="true"></i></span><span class="gh-prize__small">${tied ? 'tied, ' : ''}if the month ended now</span>`;
}

function _detailsHtml(row) {
    const live = row.live || {};
    const g = getGuildById(row.guildId) || {};
    const month = chapterName(live.key) || 'this month';
    const wins = (row.chapterWins || []).map(chapterShortName);
    const earning = Number(live.contributors) || 0;
    const members = Number(row.memberCount) || 0;
    const face = (p, cls) => {
        const initial = String(p.name || '?').trim().charAt(0).toUpperCase() || '?';
        return p.avatar
            ? `<span class="${cls}"><img src="${p.avatar}" alt="" loading="lazy" decoding="async" width="40" height="40"></span>`
            : `<span class="${cls}">${_escapeHtml(initial)}</span>`;
    };
    const stars = (row.chapterTop || []).slice(0, 3);
    const podium = [1, 0, 2].filter((i) => stars[i]).map((i) => `
                            <li class="gh-ds__step gh-ds__step--${i + 1}">
                                ${i === 0 ? '<span class="gh-ds__crown" aria-hidden="true">👑</span>' : ''}
                                ${face(stars[i], 'gh-ds__face')}
                                <span class="gh-ds__who">${_escapeHtml(stars[i].name)}</span>
                                <span class="gh-ds__pts">${_fmtGlory(stars[i].glory)} ${GLORY_EMOJI}</span>
                                <span class="gh-ds__block" aria-hidden="true">${i + 1}</span>
                            </li>`).join('');
    const legends = (row.topContributors || []).slice(0, 3).map((p, i) => `
                            <li class="gh-ds__legend">
                                <span class="gh-ds__medal" aria-hidden="true">${['🥇', '🥈', '🥉'][i]}</span>
                                ${face(p, 'gh-ds__face gh-ds__face--sm')}
                                <span class="gh-ds__who">${_escapeHtml(p.name)}</span>
                                <span class="gh-ds__pts">${_fmtGlory(p.gloryEstimate)} ${GLORY_EMOJI}</span>
                            </li>`).join('');
    return `
                        <ul class="gh-ds__facts">
                            <li style="--k:0"><span aria-hidden="true">${GLORY_EMOJI}</span><b>${_fmtGlory(live.glory)}</b><small>Glory in ${month}</small></li>
                            <li style="--k:1"><span aria-hidden="true">🙋</span><b>${earning}<i>/${members}</i></b><small>heroes earning</small></li>
                            <li style="--k:2"><span aria-hidden="true">📈</span><b>${_fmtGlory(row.yearGloryPerMember)}</b><small>year, per member</small></li>
                            <li style="--k:3"><span aria-hidden="true">🏆</span><b>${wins.length ? wins.join(' ') : '—'}</b><small>${wins.length === 1 ? 'month won' : 'months won'}</small></li>
                        </ul>
                        <div class="gh-ds__earning" title="${earning} of ${members} members have earned Glory in ${month}"><span style="transform:scaleX(${members ? (earning / members).toFixed(3) : 0})"></span></div>
                        <h4 class="gh-ds__title" style="--k:4">Stars of ${month}</h4>
                        ${podium ? `<ol class="gh-ds__podium" style="--k:5">${podium}</ol>` : '<p class="gh-ds__empty" style="--k:5">The first star this month takes the top step.</p>'}
                        <h4 class="gh-ds__title" style="--k:6">Legends of the year</h4>
                        ${legends ? `<ol class="gh-ds__legends" style="--k:7">${legends}</ol>` : '<p class="gh-ds__empty" style="--k:7">No Glory earned yet this year.</p>'}
                        <button type="button" class="gh-ds__spotlight" data-top-heroes-guild="${row.guildId}" style="--k:8"><i class="fas fa-star" aria-hidden="true"></i>Open the ${_escapeHtml(g.name || 'guild')} Spotlight</button>`;
}

function _patchBanner(el, row, model, { fresh }) {
    const q = (k) => el.querySelector(`[data-gh="${k}"]`);
    const live = row.live || {};
    const per = Number(live.perMember) || 0;
    const place = model.counts && live.place ? live.place : null;
    const tied = place && model.rows.some((r) => r.guildId !== row.guildId && r.live?.place === place);

    el.classList.toggle('is-leading', place === 1);
    PLACE_CLASS.forEach((c, i) => el.classList.toggle(`is-${c}`, place === i + 1));

    const placeEl = q('place');
    const placeHtml = place ? `<span class="gh-place__n">${_ordinal(place)}</span><span class="gh-place__sub">${tied ? 'tied' : 'this month'}</span>` : '<span class="gh-place__n">·</span>';
    if (_setHtml(placeEl, placeHtml) && !fresh) _pulse(placeEl, 'is-pop');

    const pct = per > 0.005 ? Math.max(4, Math.min(94, (per / model.scale) * 94)) : 0;
    const liquid = q('liquid');
    if (liquid) {
        liquid.dataset.target = `translate3d(0, ${(100 - pct).toFixed(2)}%, 0)`;
        if (!fresh) liquid.style.transform = liquid.dataset.target;
    }

    const from = _roll(q('num'), `${row.guildId}:per`, Math.round(per * 10) / 10, _fmtGlory, { fromZero: fresh });
    if (!fresh && per - from > 0.04) {
        const gain = q('gain');
        _setText(gain, `+${_fmtGlory(per - from)}`);
        _pulse(gain, 'is-up');
    }

    _setHtml(q('prize'), _prizeHtml(model, live, tied));

    const have = Number(live.unityCount) || 0;
    const need = Math.max(1, Number(live.unityNeeded) || 0);
    const unity = q('unity');
    const sealed = Boolean(live.unity) && model.counts;
    if (unity) {
        const was = unity.classList.contains('is-sealed');
        unity.classList.toggle('is-sealed', sealed);
        if (sealed && !was && !fresh) _pulse(unity, 'is-stamped');
        unity.title = `Unity Seal: +${UNITY_SEAL.crowns} Crown when at least ${need} of ${row.memberCount} members earn ${UNITY_SEAL.minGlory} Glory (3 stars) this month.`;
    }
    q('unitySeal')?.style.setProperty('--p', String(Math.min(1, have / need)));
    _setText(q('unityText'), sealed ? `Sealed! +${UNITY_SEAL.crowns} Crown` : `${Math.min(have, need)} of ${need} members ready`);

    const names = [...new Set((row.standards || []).map((s) => s?.name).filter(Boolean))];
    _setHtml(q('standards'), names.length
        ? `<span class="gh-standard" title="Raised with a Guild Standard from the Mystic Market"><i class="fas fa-flag" aria-hidden="true"></i>${names.slice(0, 2).map(_escapeHtml).join(' · ')}${names.length > 2 ? ` +${names.length - 2}` : ''}</span>`
        : '');

    _setHtml(q('detailsInner'), _detailsHtml(row));
}

function _stonesHtml(row, model) {
    const byKey = new Map((row.chapters || []).map((c) => [c.key, c]));
    return model.roadKeys.map((k) => {
        const sealed = byKey.get(k);
        if (sealed) {
            const p = Number(sealed.place) || 0;
            const tip = p
                ? `${chapterName(k)}: ${_ordinal(p)} place${sealed.unity ? ' + Unity Seal' : ''}, ${sealed.crowns} Crown${sealed.crowns === 1 ? '' : 's'}`
                : `${chapterName(k)}: no Glory, no Crowns`;
            return `<span class="gh-stone is-${p ? PLACE_CLASS[p - 1] : 'empty'}${sealed.unity ? ' has-unity' : ''}" data-chronicle-key="${k}" title="${tip}. Tap for its chronicle.">${p === 1 ? '<i class="fas fa-crown gh-stone__crown" aria-hidden="true"></i>' : ''}<b>${sealed.crowns || '·'}</b></span>`;
        }
        if (k === model.liveKey) {
            const c = model.counts ? Number(row.live?.crowns) || 0 : 0;
            return `<span class="gh-stone is-live" title="${chapterName(k)} is still running${c ? `: ${c} Crown${c === 1 ? '' : 's'} if it ended now` : ''}"><b>${c ? `+${c}` : '…'}</b></span>`;
        }
        return '<span class="gh-stone is-future" aria-hidden="true"></span>';
    }).join('');
}

function _patchRace(hall, model, { fresh }) {
    const list = hall.querySelector('[data-gh="raceRows"]');
    if (!list) return;
    const rowEls = new Map([...list.children].map((li) => [li.dataset.guild, li]));
    const anyCrowns = model.rows.some((r) => r.crowns > 0);

    model.rows.forEach((r, i) => {
        const li = rowEls.get(r.guildId);
        if (!li) return;
        const place = model.places[i];
        li.classList.toggle('is-leader', anyCrowns && place === 0);
        _setHtml(li.querySelector('[data-gh="rplace"]'), anyCrowns ? `<span class="gh-medal gh-medal--${PLACE_CLASS[place] || 'iron'}">${place + 1}</span>` : '<span class="gh-medal gh-medal--none">·</span>');
        _setHtml(li.querySelector('[data-gh="track"]'), _stonesHtml(r, model));
        _roll(li.querySelector('[data-gh="rcrowns"]'), `${r.guildId}:crowns`, Number(r.crowns) || 0, (v) => String(Math.round(v)), { fromZero: fresh });
    });

    // Glide rows into their new order (FLIP: measure, reorder, slide from the old spot).
    const order = model.rows.map((r) => rowEls.get(r.guildId)).filter(Boolean);
    const current = [...list.children];
    if (order.some((li, i) => current[i] !== li)) {
        const before = new Map(current.map((li) => [li, li.getBoundingClientRect().top]));
        order.forEach((li) => list.appendChild(li));
        if (!_reduceMotion() && !fresh) {
            order.forEach((li) => {
                const dy = (before.get(li) || 0) - li.getBoundingClientRect().top;
                if (!dy) return;
                li.style.transition = 'none';
                li.style.transform = `translate3d(0, ${dy}px, 0)`;
                requestAnimationFrame(() => {
                    li.style.transition = '';
                    li.style.transform = '';
                });
            });
        }
    }

    const leader = model.rows[0];
    const second = model.rows[1];
    const gap = leader && second ? leader.crowns - second.crowns : 0;
    const chapter = chapterName(model.liveKey) || 'this month';
    _setHtml(hall.querySelector('[data-gh="raceSummary"]'), !anyCrowns
        ? `The first Crowns go to the winners of <strong>${chapter}</strong>.`
        : gap > 0
            ? `<strong>${_escapeHtml(leader.guildName)}</strong> lead by <strong>${gap}</strong> Crown${gap === 1 ? '' : 's'}`
            : 'Level on Crowns at the top. The year’s Glory per member splits them.');
}

/** The Chapter chronicle scroll under the Crown Race (its view and CSS load on first need). */
function _patchChronicle(hall) {
    const box = hall.querySelector('[data-gh="chronicle"]');
    if (!box) return;
    const list = yearChronicles();
    if (!list.length) { box.hidden = true; return; }
    if (!_chronicleView) {
        if (!_chronicleViewLoading) {
            _chronicleViewLoading = true;
            import('../../features/guildChronicleView.js')
                .then((m) => { _chronicleView = m; requestGuildHallRender(); })
                .catch((e) => console.warn('Chronicle view unavailable:', e))
                .finally(() => { _chronicleViewLoading = false; });
        }
        return;
    }
    let index = list.findIndex((c) => c.key === _chronicleKey);
    if (index < 0) index = list.length - 1;
    const chronicle = list[index];
    box.hidden = false;
    _setHtml(box, _chronicleView.chroniclePanelHtml(chronicle, { index, total: list.length, canSpeak: isTtsSupported() }));
    hall.querySelectorAll('.gh-stone[data-chronicle-key]').forEach((el) => el.classList.toggle('is-chronicled', el.dataset.chronicleKey === chronicle.key));
}

function _chronicleAction(hall, t) {
    const nav = t.closest('[data-chronicle-nav]');
    const stone = t.closest('[data-chronicle-key]');
    const read = t.closest('[data-chronicle-read]');
    if (!nav && !stone && !read) return false;
    const list = yearChronicles();
    const shown = hall.querySelector('[data-chronicle-shown]')?.dataset.chronicleShown;
    if (read) {
        const c = list.find((x) => x.key === shown);
        if (c && isTtsSupported()) {
            if (isSpeaking()) stopSpeech();
            else speakText(`The chronicle of ${c.month}. ${c.lines.join(' ')}`, { voiceHint: 'en', rate: 0.92 });
        }
        return true;
    }
    if (nav && !nav.disabled) {
        const i = list.findIndex((x) => x.key === shown);
        _chronicleKey = list[Math.max(0, Math.min(list.length - 1, i + Number(nav.dataset.chronicleNav)))]?.key || null;
    } else if (stone) {
        _chronicleKey = stone.dataset.chronicleKey;
    }
    _patchChronicle(hall);
    return true;
}

function _patchHall(hall, model, { fresh }) {
    hall.classList.toggle('is-loading', model.loading);
    if (model.seasonLive) {
        // The calendar never waits for scores.
        const dial = hall.querySelector('[data-gh="dial"]');
        if (dial) {
            dial.style.setProperty('--p', String(1 - (model.daysLeft - 1) / model.daysInMonth));
            dial.classList.toggle('is-last-day', model.daysLeft <= 1);
        }
        _setText(hall.querySelector('[data-gh="days"]'), String(model.daysLeft));
        _setText(hall.querySelector('[data-gh="chapterName"]'), chapterName(model.liveKey) || 'This month');
    }
    if (model.loading) return;
    const first = fresh || hall.dataset.ghReady !== '1';
    hall.dataset.ghReady = '1';
    if (!model.seasonLive) return;

    hall.querySelectorAll('.gh-banner').forEach((el) => {
        const row = model.byId.get(el.dataset.guild);
        if (row) _patchBanner(el, row, model, { fresh: first });
    });
    _patchRace(hall, model, { fresh: first });
    _patchChronicle(hall);

    if (first) {
        // The vials pour from empty on the first paint with data.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            hall.querySelectorAll('[data-gh="liquid"]').forEach((l) => { l.style.transform = l.dataset.target || ''; });
        }));
    }
}

function _toggleStats(hall) {
    _guildHallStatsExpanded = !_guildHallStatsExpanded;
    hall.querySelectorAll('[data-gh="details"]').forEach((d) => {
        d.classList.toggle('is-open', _guildHallStatsExpanded);
        // The facts, podium and legends step in one after another, only when opened by hand.
        if (_guildHallStatsExpanded && !_reduceMotion()) {
            d.classList.remove('is-revealing');
            void d.offsetWidth;
            d.classList.add('is-revealing');
            clearTimeout(d._revealTimer);
            d._revealTimer = setTimeout(() => d.classList.remove('is-revealing'), 1600);
        }
    });
    const btn = hall.querySelector('#guild-stats-expand-toggle');
    btn?.setAttribute('aria-expanded', _guildHallStatsExpanded ? 'true' : 'false');
    btn?.setAttribute('aria-label', `${_guildHallStatsExpanded ? 'Hide' : 'Show'} Guild Stats`);
    _setText(hall.querySelector('[data-gh="statsSub"]'), _guildHallStatsExpanded ? 'Fold them away' : 'Heroes and numbers');
}

function _wireHall(hall) {
    const activate = (e) => {
        const t = e.target;
        if (!(t instanceof Element)) return;
        if (t.closest('[data-guild-power-info="true"]')) { e.stopPropagation(); _openPowerExplainer(); return; }
        if (_chronicleAction(hall, t)) { e.stopPropagation(); return; }
        const spot = t.closest('[data-top-heroes-guild]');
        if (spot) { e.stopPropagation(); openGuildHeroesModal(spot.dataset.topHeroesGuild); return; }
        const anthem = t.closest('[data-anthem-guild]');
        if (anthem) { e.stopPropagation(); openAnthemModal(anthem.dataset.anthemGuild); return; }
        if (t.closest('#guild-stats-expand-toggle')) {
            const btn = t.closest('#guild-stats-expand-toggle');
            if (!btn.disabled && isGuildSeasonLive()) _toggleStats(hall);
            return;
        }
        const crest = t.closest('.gh-banner__crest');
        if (!crest) return;
        e.stopPropagation();
        const guildId = crest.dataset.guildId;
        openGuildLore(guildId, getGuildLeaderboardData().find((r) => r.guildId === guildId));
    };
    hall.addEventListener('click', activate);
    hall.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target instanceof Element && e.target.matches('.gh-banner__crest')) {
            e.preventDefault();
            activate(e);
        }
    });
}

export function renderGuildsTab() {
    const list = document.getElementById('guilds-leaderboard-list');
    if (!list) return;
    if (_renderFrame) { cancelAnimationFrame(_renderFrame); _renderFrame = 0; }

    _ensurePowerExplainerOverlay();
    wireGuildLoreListeners();
    wireAnthemListeners();

    const model = _hallModel();
    const sig = `${model.seasonLive ? 'live' : 'frozen'}|${model.roadKeys.join(',')}|${model.liveKey}`;
    let hall = list.querySelector(':scope > .gh');
    const fresh = !hall || _hallSig !== sig;
    if (fresh) {
        list.innerHTML = _hallShellHtml(model);
        hall = list.querySelector(':scope > .gh');
        _hallSig = sig;
        _shown.clear();
        _wireHall(hall);
    }
    _patchHall(hall, model, { fresh });

    _wireFortunesWheel();
    _initFortuneLedgerCollapse();
    _initFortuneLedgerNav();
    _renderFortunesLog();
}

/** For data listeners: one patch per frame, even when several listeners fire together. */
export function requestGuildHallRender() {
    if (_renderFrame) return;
    _renderFrame = requestAnimationFrame(() => {
        _renderFrame = 0;
        renderGuildsTab();
    });
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
        toggle.setAttribute('aria-label', open ? 'Close the Fortune Ledger' : 'Open the Fortune Ledger');
        panel.classList.toggle('is-open', open);
        panel.setAttribute('aria-hidden', open ? 'false' : 'true');
        if (open) panel.removeAttribute('inert');
        else panel.setAttribute('inert', '');
        root.dataset.ledgerExpanded = open ? 'true' : 'false';
        if (open && !_reduceMotion()) {
            // The pages turn in one after another when the book opens.
            root.classList.remove('is-opening');
            void root.offsetWidth;
            root.classList.add('is-opening');
            clearTimeout(root._openTimer);
            root._openTimer = setTimeout(() => root.classList.remove('is-opening'), 1800);
        }
    };

    toggle.addEventListener('click', () => {
        apply(toggle.getAttribute('aria-expanded') !== 'true');
    });

    apply(false);
}

// ─── Fortune's Wheel wiring ──────────────────────────────────────────────────

// The spin check reads Firestore; the Hall patches often, so the answer is kept briefly
// (and dropped as soon as a new spin lands in the wheel log).
const _spinCheck = { key: '', at: 0, value: null };
async function _canSpinCached(classId) {
    const key = `${classId}|${(state.get('fortuneWheelLog') || []).length}`;
    if (_spinCheck.key === key && _spinCheck.value && Date.now() - _spinCheck.at < 30000) return _spinCheck.value;
    _spinCheck.key = key;
    _spinCheck.at = Date.now();
    _spinCheck.value = canSpinThisWeek(classId).catch((e) => { _spinCheck.key = ''; throw e; });
    return _spinCheck.value;
}

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
            const canSpin = await _canSpinCached(classId);
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
            // Mid-challenge (a riddle, a coin, a chest) only the close button ends the ceremony.
            if (getWheelState().phase === 'staging') return;
            closeFortunesWheel();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (modal.classList.contains('hidden')) return;
        if (getWheelState().phase === 'staging') return;
        closeFortunesWheel();
    });
}

// ─── Fortune Ledger ──────────────────────────────────────────────────────────

const LEDGER_PAGE = 4;
const LEDGER_RARITY = {
    common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic',
    legendary: 'Legendary', mythic: 'Mythic', cursed: 'Twist',
    storm: 'Storm', twist: 'Twist', trial: 'Trial',
};
const LEDGER_RARITY_RANK = { storm: 0, cursed: 0, twist: 1, common: 1, trial: 2, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6 };
let _ledgerShown = LEDGER_PAGE;
/** 'all' or a guild id */
let _ledgerGuild = 'all';

function _ledgerDate(entry) {
    const v = entry?.spunAt;
    if (!v) return null;
    const d = typeof v.toDate === 'function' ? v.toDate() : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}

/** "⚜️ Glory Storm" → ['⚜️', 'Glory Storm'] */
function _ledgerSplitLabel(label) {
    const m = String(label || '').match(/^(\p{Extended_Pictographic}\uFE0F?)\s*(.*)$/u);
    return m ? [m[1], m[2]] : ['✨', String(label || 'A spin')];
}

/** +3 / −1 with a real minus sign. */
function _signed(n) {
    const v = Number(n) || 0;
    return `${v < 0 ? '−' : '+'}${_fmtNumber(Math.abs(v))}`;
}

function _ledgerGifts(r) {
    const out = [];
    const chip = (n, what, cls = '') => {
        const v = Number(n) || 0;
        if (!v) return;
        out.push(`<span class="fl-gift${cls}${v < 0 ? ' fl-gift--loss' : ''}">${_signed(v)} ${what}</span>`);
    };
    chip(r.gloryDelta, GLORY_EMOJI, ' fl-gift--glory');
    chip(r.starsDelta, '⭐');
    chip(r.goldDelta, '🪙');
    if (Number(r.artifactsGranted) > 0) out.push(`<span class="fl-gift">+${_fmtNumber(r.artifactsGranted)} 🎁</span>`);
    chip(r.classQuestDelta, 'Team Quest ⭐');
    if (r.braved) out.push('<span class="fl-gift fl-gift--braved">🛡️ Braved</span>');
    else if (r.decision) out.push(`<span class="fl-gift fl-gift--quiet">${_escapeHtml(r.decision)}</span>`);
    if (!out.length) out.push(`<span class="fl-gift fl-gift--quiet">${r.segmentId === 'trickster' || r.rarity === 'cursed' ? 'A harmless trick' : r.rarity === 'storm' ? 'The storm found nothing' : 'A little magic'}</span>`);
    return out.join('');
}

function _fmtNumber(n) {
    return Number(n || 0).toLocaleString();
}

function _ledgerTallies(logs) {
    const t = Object.fromEntries(GUILD_IDS.map((id) => [id, { glory: 0, stars: 0, gold: 0, finds: 0, braved: 0, best: null }]));
    logs.forEach((entry) => (entry.results || []).forEach((r) => {
        const row = t[r?.guildId];
        if (!row) return;
        row.finds += 1;
        row.glory += Number(r.gloryDelta) || 0;
        row.stars += Number(r.starsDelta) || 0;
        row.gold += Number(r.goldDelta) || 0;
        if (r.braved) row.braved += 1;
        const rank = (x) => (LEDGER_RARITY_RANK[x?.rarity] ?? 1) * 1000 + (Number(x?.gloryDelta) || 0);
        if (!row.best || rank(r) > rank(row.best)) row.best = r;
    }));
    return t;
}

function _renderLedgerChrome(logs, tallies) {
    const summary = document.getElementById('fortune-ledger-summary');
    const peek = document.getElementById('fortune-ledger-peek');
    const tallyEl = document.getElementById('fortune-ledger-tally');
    const filterEl = document.getElementById('fortune-ledger-filter');
    const totalGlory = Object.values(tallies).reduce((s, r) => s + r.glory, 0);
    const last = _ledgerDate(logs[0]);
    if (summary) {
        _setText(summary, logs.length
            ? `${logs.length} spin${logs.length === 1 ? '' : 's'} · ${_signed(totalGlory)} Glory${last ? ` · last spin ${last.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}`
            : 'No spins yet this year');
    }
    const topGlory = Math.max(...GUILD_IDS.map((id) => tallies[id].glory));
    const isLucky = (id) => totalGlory > 0 && tallies[id].glory === topGlory;
    _setHtml(peek, logs.length ? GUILD_IDS.map((id) => {
        const g = getGuildById(id) || {};
        return `<span class="fl-peek__g${isLucky(id) ? ' is-lucky' : ''}" style="--g1:${g.primary || '#666'};--g2:${g.secondary || '#999'};">${_emblemBadge(id, g.name, 'fl-peek__emblem')}<b>${_signed(tallies[id].glory)}</b></span>`;
    }).join('') : '');

    _setHtml(tallyEl, logs.length ? `
                                <h4 class="fl-tally__title">Fortune count this year</h4>
                                <ul class="fl-tally__list">${GUILD_IDS.map((id, i) => {
        const g = getGuildById(id) || {};
        const t = tallies[id];
        const [bestIcon, bestName] = t.best ? _ledgerSplitLabel(t.best.segmentLabel) : ['', ''];
        return `
                                    <li class="fl-chest${isLucky(id) ? ' is-lucky' : ''}" style="--g1:${g.primary || '#666'};--g2:${g.secondary || '#999'};--i:${i};">
                                        ${isLucky(id) ? '<span class="fl-chest__ribbon">Luckiest guild</span>' : ''}
                                        <span class="fl-chest__head">${_emblemBadge(id, g.name, 'fl-chest__emblem')}<span class="fl-chest__name">${_escapeHtml(g.name || id)}</span></span>
                                        <span class="fl-chest__glory"><b>${_signed(t.glory)}</b> ${GLORY_EMOJI} Glory</span>
                                        <span class="fl-chest__more">${t.finds} spin${t.finds === 1 ? '' : 's'} · ${_signed(t.stars)} ⭐ · ${_signed(t.gold)} 🪙${t.braved ? ` · 🛡️ ${t.braved}` : ''}</span>
                                        ${t.best ? `<span class="fl-chest__best fl-r--${_escapeHtml(t.best.rarity || 'common')}" title="Best find"><span aria-hidden="true">${bestIcon}</span>${_escapeHtml(bestName)}</span>` : ''}
                                    </li>`;
    }).join('')}</ul>` : '');

    if (!logs.length) { _setHtml(filterEl, ''); return; }
    const chip = (id, label, extra = '') => `<button type="button" class="fl-chip${_ledgerGuild === id ? ' is-active' : ''}" data-ledger-guild="${id}" aria-pressed="${_ledgerGuild === id}"${extra}>${label}</button>`;
    _setHtml(filterEl, chip('all', '<i class="fa-solid fa-book-open" aria-hidden="true"></i>All guilds') + GUILD_IDS.map((id) => {
        const g = getGuildById(id) || {};
        return chip(id, `${_emblemBadge(id, g.name, 'fl-chip__emblem')}${_escapeHtml(g.name || id)}`, ` style="--g1:${g.primary || '#666'};--g2:${g.secondary || '#999'};"`);
    }).join(''));
}

function _ledgerEntryHtml(entry, i, classNames) {
    const date = _ledgerDate(entry);
    const results = (entry.results || []).filter((r) => r && (_ledgerGuild === 'all' || r.guildId === _ledgerGuild));
    const total = results.reduce((sum, r) => sum + (Number(r.gloryDelta) || 0), 0);
    const className = classNames.get(entry.classId) || '';
    const by = entry.spunBy?.name || '';
    return `
                <li class="fl-entry" style="--i:${i};">
                    <span class="fl-entry__date" aria-label="${date ? date.toDateString() : 'Unknown date'}">
                        <small>${date ? date.toLocaleDateString(undefined, { weekday: 'short' }) : '—'}</small>
                        <b>${date ? date.getDate() : '?'}</b>
                        <small>${date ? date.toLocaleDateString(undefined, { month: 'short' }) : ''}</small>
                    </span>
                    <div class="fl-entry__main">
                        <header class="fl-entry__head">
                            ${className ? `<span class="fl-entry__class"><i class="fa-solid fa-chalkboard-user" aria-hidden="true"></i>${_escapeHtml(className)}</span>` : ''}
                            ${by ? `<span class="fl-entry__by">spun with ${_escapeHtml(by)}</span>` : ''}
                            <span class="fl-entry__total${total < 0 ? ' is-loss' : ''}">${_signed(total)} ${GLORY_EMOJI}</span>
                        </header>
                        <ul class="fl-cards${results.length === 1 ? ' fl-cards--one' : ''}">${results.map((r, k) => {
        const g = getGuildById(r.guildId) || {};
        const [icon, name] = _ledgerSplitLabel(r.segmentLabel || r.segmentId);
        return `
                            <li class="fl-card fl-r--${_escapeHtml(r.rarity || 'common')}" style="--g1:${g.primary || '#666'};--g2:${g.secondary || '#999'};--k:${k};" title="${_escapeHtml(r.description || r.segmentDescription || '')}">
                                <span class="fl-card__guild">${_emblemBadge(r.guildId, g.name, 'fl-card__emblem')}<span>${_escapeHtml(g.name || r.guildId)}</span></span>
                                <span class="fl-card__icon" aria-hidden="true">${icon}</span>
                                <b class="fl-card__name">${_escapeHtml(name)}${r.favored ? ' <span title="Gilded by Fortune’s Favor">✨</span>' : ''}</b>
                                <span class="fl-card__rarity">${LEDGER_RARITY[r.rarity] || 'Find'}</span>
                                <span class="fl-card__gifts">${_ledgerGifts(r)}</span>
                            </li>`;
    }).join('')}</ul>
                    </div>
                </li>`;
}

/** Draws the Ledger from state.fortuneWheelLog. Exported so the guidebook capture renders the real book. */
export function renderFortuneLedger() {
    _initFortuneLedgerNav();
    _renderFortunesLog();
}

function _renderFortunesLog() {
    const listEl = document.getElementById('fortunes-log-list');
    const more = document.getElementById('fortune-ledger-more');
    if (!listEl) return;

    const logs = state.get('fortuneWheelLog') || [];
    const tallies = _ledgerTallies(logs);
    _renderLedgerChrome(logs, tallies);

    if (!logs.length) {
        _setHtml(listEl, `
            <li class="fl-empty">
                <span class="fl-empty__wheel" aria-hidden="true">🎡</span>
                <b>The first page is still blank</b>
                <p>Spin Fortune’s Wheel in a class’s last lesson of the week. Every guild’s treasure is written here.</p>
            </li>`);
        if (more) more.hidden = true;
        return;
    }

    const classNames = new Map([...(state.get('allSchoolClasses') || []), ...(state.get('allTeachersClasses') || [])].map((c) => [c.id, c.name]));
    const visible = _ledgerGuild === 'all' ? logs : logs.filter((e) => (e.results || []).some((r) => r?.guildId === _ledgerGuild));
    const page = visible.slice(0, _ledgerShown);
    _setHtml(listEl, page.length
        ? page.map((entry, i) => _ledgerEntryHtml(entry, i, classNames)).join('')
        : '<li class="fl-empty"><b>No spins for this guild yet</b></li>');
    if (more) {
        more.hidden = visible.length <= _ledgerShown;
        const left = visible.length - _ledgerShown;
        _setText(more.querySelector('span'), `Show older spins (${Math.max(0, left)})`);
    }
}

function _initFortuneLedgerNav() {
    const section = document.getElementById('fortunes-wheel-section');
    if (!section || section._ledgerNavWired) return;
    section._ledgerNavWired = true;
    section.addEventListener('click', (e) => {
        const t = e.target;
        if (!(t instanceof Element)) return;
        const chip = t.closest('[data-ledger-guild]');
        if (chip) {
            _ledgerGuild = chip.dataset.ledgerGuild || 'all';
            _ledgerShown = LEDGER_PAGE;
            _renderFortunesLog();
            return;
        }
        if (t.closest('#fortune-ledger-more')) {
            _ledgerShown += LEDGER_PAGE;
            _renderFortunesLog();
        }
    });
}
