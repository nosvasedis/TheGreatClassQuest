// /ui/tabs/guilds.js — Guild Hall: crystal-column rankings, lore overlay, guild sounds, anthem modal

import { getGuildLeaderboardData } from '../../features/guildScoring.js';
import { getGuildById, getGuildEmblemUrl, GUILD_IDS, GUILDS } from '../../features/guilds.js';
import { openGuildHeroesModal } from '../modals/guildHeroes.js';
import { openFortunesWheel, advanceWheel, triggerSpin, closeFortunesWheel, canSpinThisWeek } from '../../features/fortunesWheel.js';
import { GLORY_EMOJI } from '../../constants.js';
import * as state from '../../state.js';

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
    const overlay = document.getElementById('guild-anthem-overlay');
    const card = document.getElementById('guild-anthem-card');
    if (!overlay || !card) return;

    const guild = getGuildById(guildId);
    const primary = guild?.primary || '#7c3aed';
    const secondary = guild?.secondary || '#a78bfa';
    const glow = guild?.glow || primary;
    const emoji = guild?.emoji || '🎵';

    card.style.background = `linear-gradient(160deg, ${primary} 0%, ${secondary} 65%, ${primary}cc 100%)`;
    card.style.boxShadow = `0 0 0 1.5px rgba(255,255,255,0.2), 0 32px 80px rgba(0,0,0,0.7), 0 0 80px ${glow}55`;

    const titleEl = document.getElementById('guild-anthem-title');
    if (titleEl) titleEl.textContent = `${emoji} ${guild?.name || guildId} Anthem`;

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
    const overlay = document.getElementById('guild-anthem-overlay');
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
    const emoji = guild?.emoji || '⚔️';
    const motto = guild?.motto || '';
    const traits = guild?.traits || [];

    // Style card with guild gradient
    card.style.background = `linear-gradient(145deg, ${primary} 0%, ${secondary} 70%, ${primary}cc 100%)`;
    card.style.setProperty('--lore-glow', glow);
    card.style.boxShadow = `0 0 0 1.5px rgba(255,255,255,0.2), 0 32px 80px rgba(0,0,0,0.7), 0 0 80px ${glow}55`;

    // Emblem
    const emblemWrap = document.getElementById('guild-lore-emblem-wrap');
    if (emblemWrap) {
        emblemWrap.innerHTML = emblemUrl
            ? `<img src="${emblemUrl}" alt="${guild?.name}" class="guild-lore-emblem"
                    style="border-color: rgba(255,255,255,0.5); box-shadow: 0 0 40px ${glow}cc, 0 0 80px ${glow}55;">`
            : `<div class="guild-lore-emblem guild-lore-emblem-fallback"
                    style="background: rgba(255,255,255,0.15);">
                    <span style="font-size:3.5rem">${emoji}</span>
               </div>`;
    }

    // Text fields
    const emojiEl = document.getElementById('guild-lore-emoji');
    const nameEl = document.getElementById('guild-lore-name');
    const mottoEl = document.getElementById('guild-lore-motto');
    const traitsEl = document.getElementById('guild-lore-traits');
    const statsEl = document.getElementById('guild-lore-stats');

    if (emojiEl) emojiEl.textContent = emoji;
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
        statsEl.innerHTML = `
            <span class="guild-lore-stat">⭐ <strong>${stars}</strong> Total Stars</span>
            <span class="guild-lore-stat">⚖️ <strong>${perCapita.toFixed(1)}</strong> ★/member total</span>
            <span class="guild-lore-stat">👥 <strong>${members}</strong> Member${members === 1 ? '' : 's'}</span>`;
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

    document.getElementById('guild-lore-close')?.addEventListener('click', closeGuildLore);
    document.getElementById('guild-lore-overlay-bg')?.addEventListener('click', closeGuildLore);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeGuildLore();
    });
}

// ─── Main render ─────────────────────────────────────────────────────────────
function _getChampionHtml(gData, primary, glow) {
    const champ = gData?.topContributors?.[0];
    if (!champ) return '';
    const avatarHtml = champ.avatar
        ? `<img src="${champ.avatar}" class="w-8 h-8 rounded-full object-cover border-2 flex-shrink-0" style="border-color:${primary}">`
        : `<div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style="background:${primary}">${champ.name?.charAt(0) || '?'}</div>`;
    return `
        <div class="guild-crystal-champion mt-3 flex items-center gap-2 px-3 py-2 rounded-xl border" style="border-color:${primary}44;background:${glow}11;">
            <span class="text-sm">⚔️</span>
            ${avatarHtml}
            <div class="min-w-0">
                <div class="text-[10px] font-bold uppercase tracking-wider opacity-60" style="color:${primary}">Top Champion</div>
                <div class="text-xs font-bold truncate text-white">${champ.name}</div>
                <div class="text-[10px]" style="color:rgba(255,255,255,0.78)">${champ.totalStars} ⭐ total</div>
            </div>
        </div>`;
}

export function renderGuildsTab() {
    const list = document.getElementById('guilds-leaderboard-list');
    if (!list) return;

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
            // Glory & Power fields
            totalGlory: found?.totalGlory || 0,
            weeklyGlory: found?.weeklyGlory || 0,
            perCapitaGlory: found?.perCapitaGlory || 0,
            guildPower: found?.guildPower || 0,
            momentumArrow: found?.momentumArrow || '—',
            activityScore: found?.activityScore || 0,
        };
    }).sort((a, b) => b.guildPower - a.guildPower || b.perCapitaGlory - a.perCapitaGlory || b.perCapitaStars - a.perCapitaStars);

    const maxStars = Math.max(...displayData.map(g => g.totalStars)) || 1;
    const rankEmoji = ['🥇', '🥈', '🥉', '4️⃣'];

    const columns = displayData.map((g, index) => {
        const guild = getGuildById(g.guildId);
        const emblemUrl = getGuildEmblemUrl(g.guildId);
        const primary = guild?.primary || '#6b7280';
        const secondary = guild?.secondary || '#9ca3af';
        const glow = guild?.glow || primary;
        const emoji = guild?.emoji || '⚔️';
        // Fill based on Guild Power (composite score), leader gets 90%
        const maxPower = Math.max(...displayData.map(g => g.guildPower)) || 1;
        const fillPct = Math.max(5, Math.round((g.guildPower / maxPower) * 90));

        const emblemHtml = emblemUrl
            ? `<img src="${emblemUrl}" alt="${g.guildName}" class="guild-crystal-emblem"
                    style="border-color:${primary}; box-shadow: 0 0 16px ${glow}77;">`
            : `<div class="guild-crystal-emblem guild-crystal-emblem-fallback"
                    style="background:linear-gradient(135deg,${primary},${secondary}); box-shadow:0 0 16px ${glow}77;">
                   <span style="font-size:2rem">${emoji}</span>
               </div>`;

        const topHtml = g.topContributors.length
            ? `<div class="guild-crystal-heroes">
                   <div class="guild-top-heroes-header">
                       <span class="guild-top-heroes-title">⚔️ Top Heroes</span>
                       <button class="guild-info-btn" data-top-heroes-guild="${g.guildId}" title="View Guild Analytics">
                           ℹ️
                       </button>
                   </div>
                   ${g.topContributors.slice(0, 3).map(c => `
                       <span class="guild-crystal-hero-chip" style="color:${primary};border-color:${primary}33;">
                           ${c.name}
                           <span style="opacity:0.65;font-size:0.6rem">${c.totalStars}⭐ total</span>
                       </span>`).join('')}
               </div>`
            : `<div class="guild-crystal-heroes">
                   <div class="guild-top-heroes-header">
                       <span class="guild-top-heroes-title">⚔️ Top Heroes</span>
                       <button class="guild-info-btn" data-top-heroes-guild="${g.guildId}" title="View Guild Analytics">
                           ℹ️
                       </button>
                   </div>
                   <span class="guild-crystal-heroes-label" style="opacity:0.45">No heroes yet</span>
               </div>`;

        return `
            <div class="guild-crystal-col" data-guild="${g.guildId}">

                <!-- ── Rank ── -->
                <div class="guild-crystal-rank">${rankEmoji[index] || `#${index + 1}`}</div>

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
                                style="--anthem-color:${primary};--anthem-glow:${glow};">🎵</button>
                    </div>
                    <div class="guild-crystal-name" style="color:${primary};">${emoji} ${g.guildName}</div>
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
                    <span class="guild-crystal-count-num">${Math.round(g.guildPower)}</span>
                    <span class="guild-crystal-count-label">⚡ Guild Power</span>
                </div>
                <div class="guild-crystal-members" style="opacity:0.65;">
                    ${g.perCapitaGlory.toFixed(1)} ${GLORY_EMOJI}/member · ${g.momentumArrow} · ${g.memberCount} member${g.memberCount === 1 ? '' : 's'}
                </div>

                ${topHtml}
                ${_getChampionHtml(g, primary, glow)}
            </div>`;
    });

    list.innerHTML = `<div class="guild-crystal-arena">${columns.join('')}</div>`;

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
        const infoBtn = e.target.closest('.guild-info-btn');
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
    _renderFortunesLog();
}

// ─── Fortune's Wheel wiring ──────────────────────────────────────────────────

async function _wireFortunesWheel() {
    const section = document.getElementById('fortunes-wheel-section');
    const btn = document.getElementById('fortunes-wheel-btn');
    const statusEl = document.getElementById('fortunes-wheel-status');
    if (!section || !btn) return;

    // Section is always visible — the button always opens the modal.
    // The modal itself handles gating (locked state, lesson check, spin check).
    const classId = state.get('globalSelectedClassId');
    let statusMsg = '';

    try {
        if (classId) {
            const canSpin = await canSpinThisWeek(classId);
            statusMsg = canSpin
                ? '✨ The wheel awaits your command — once per week per class.'
                : '✓ Already spun this week! Return next week for another spin.';
        } else {
            statusMsg = '🔮 The wheel is ready… select a class to reveal your fate.';
        }
    } catch (_) {
        statusMsg = '⚜️ Fortune\'s Wheel awaits…';
    }

    if (statusEl) statusEl.textContent = statusMsg;

    // Button is NEVER disabled — always opens the modal
    btn.disabled = false;
    btn.classList.remove('opacity-50');

    // Late-bind listeners
    if (!btn._fwWired) {
        btn._fwWired = true;
        btn.addEventListener('click', () => {
            const cid = state.get('globalSelectedClassId');
            const allClasses = state.get('allTeachersClasses') || [];
            const cls = allClasses.find(c => c.id === cid) || null;
            const league = cls?.questLevel || state.get('globalSelectedLeague') || 'B';
            openFortunesWheel(cid, league);
        });
    }

    // Wire modal action buttons (once)
    _wireWheelModalButtons();
}

function _wireWheelModalButtons() {
    const modal = document.getElementById('fortunes-wheel-modal');
    if (!modal || modal._fwWired) return;
    modal._fwWired = true;

    document.getElementById('fw-spin-btn')?.addEventListener('click', () => triggerSpin());
    document.getElementById('fw-next-btn')?.addEventListener('click', () => advanceWheel());
    document.getElementById('fw-close-btn')?.addEventListener('click', () => closeFortunesWheel());
}

// ─── Fortune's Log ───────────────────────────────────────────────────────────

function _renderFortunesLog() {
    const section = document.getElementById('fortunes-log-section');
    const listEl = document.getElementById('fortunes-log-list');
    if (!section || !listEl) return;

    const logs = state.get('fortuneWheelLog') || [];
    if (logs.length === 0) return;

    section.classList.remove('hidden');

    listEl.innerHTML = logs.map(entry => {
        const date = entry.spunAt?.toDate ? entry.spunAt.toDate() : new Date(entry.spunAt);
        const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const results = entry.results || [];
        return `
            <div class="p-2 rounded-lg bg-white/5 border border-violet-500/10">
                <div class="text-xs opacity-50 mb-1">${dateStr} — Week ${entry.weekKey || '?'}</div>
                <div class="flex flex-wrap gap-2">
                    ${results.map(r => {
                        const gDef = getGuildById(r.guildId);
                        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                                    style="background:${gDef?.primary || '#666'}22;color:${gDef?.primary || '#ccc'};">
                                    ${gDef?.emoji || '⚔️'} ${r.segmentLabel || r.segmentId}
                                    ${r.gloryDelta ? `<span class="opacity-60">(${r.gloryDelta >= 0 ? '+' : ''}${r.gloryDelta}⚜️)</span>` : ''}
                                </span>`;
                    }).join('')}
                </div>
            </div>`;
    }).join('');
}
