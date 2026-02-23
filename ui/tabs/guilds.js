// /ui/tabs/guilds.js — Guild Hall: crystal-column rankings, lore overlay, guild sounds

import { getGuildLeaderboardData } from '../../features/guildScoring.js';
import { getGuildById, getGuildEmblemUrl, GUILD_IDS, GUILDS } from '../../features/guilds.js';

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
        audio.play().catch(() => {}); // gracefully handle browser autoplay policies
    } catch (_) {}
}

// ─── Lore overlay ────────────────────────────────────────────────────────────
function openGuildLore(guildId, gData) {
    const overlay = document.getElementById('guild-lore-overlay');
    const card    = document.getElementById('guild-lore-card');
    if (!overlay || !card) return;

    const guild      = getGuildById(guildId);
    const emblemUrl  = getGuildEmblemUrl(guildId);
    const primary    = guild?.primary   || '#7c3aed';
    const secondary  = guild?.secondary || '#a78bfa';
    const glow       = guild?.glow      || primary;
    const emoji      = guild?.emoji     || '⚔️';
    const motto      = guild?.motto     || '';
    const traits     = guild?.traits    || [];

    // Style card with guild gradient
    card.style.background       = `linear-gradient(145deg, ${primary} 0%, ${secondary} 70%, ${primary}cc 100%)`;
    card.style.setProperty('--lore-glow', glow);
    card.style.boxShadow        = `0 0 0 1.5px rgba(255,255,255,0.2), 0 32px 80px rgba(0,0,0,0.7), 0 0 80px ${glow}55`;

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
    const emojiEl  = document.getElementById('guild-lore-emoji');
    const nameEl   = document.getElementById('guild-lore-name');
    const mottoEl  = document.getElementById('guild-lore-motto');
    const traitsEl = document.getElementById('guild-lore-traits');
    const statsEl  = document.getElementById('guild-lore-stats');

    if (emojiEl)  emojiEl.textContent  = emoji;
    if (nameEl)   nameEl.textContent   = guild?.name || guildId;
    if (mottoEl)  mottoEl.textContent  = `"${motto}"`;
    if (traitsEl) {
        traitsEl.innerHTML = traits.map(t =>
            `<span class="guild-lore-trait" style="background:rgba(255,255,255,0.18);border-color:rgba(255,255,255,0.35);">${t}</span>`
        ).join('');
    }
    if (statsEl) {
        const stars   = gData?.totalStars  || 0;
        const members = gData?.memberCount || 0;
        statsEl.innerHTML = `
            <span class="guild-lore-stat">⭐ <strong>${stars}</strong> Total Stars</span>
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
export function renderGuildsTab() {
    const list = document.getElementById('guilds-leaderboard-list');
    if (!list) return;

    wireGuildLoreListeners();

    const rawData = getGuildLeaderboardData();

    // Always render all 4 guilds (zero stars = empty crystal, still looks great)
    const displayData = GUILD_IDS.map((gid) => {
        const found = rawData.find((d) => d.guildId === gid);
        const guild = GUILDS[gid];
        return {
            guildId:        gid,
            guildName:      guild?.name        || gid,
            totalStars:     found?.totalStars  || 0,
            memberCount:    found?.memberCount || 0,
            topContributors: found?.topContributors || [],
        };
    }).sort((a, b) => b.totalStars - a.totalStars);

    const maxStars   = Math.max(...displayData.map(g => g.totalStars)) || 1;
    const rankEmoji  = ['🥇', '🥈', '🥉', '4️⃣'];

    const columns = displayData.map((g, index) => {
        const guild     = getGuildById(g.guildId);
        const emblemUrl = getGuildEmblemUrl(g.guildId);
        const primary   = guild?.primary   || '#6b7280';
        const secondary = guild?.secondary || '#9ca3af';
        const glow      = guild?.glow      || primary;
        const emoji     = guild?.emoji     || '⚔️';
        // Fill: leader gets up to 90%, others scale proportionally; minimum 5%
        const fillPct   = Math.max(5, Math.round((g.totalStars / maxStars) * 90));

        const emblemHtml = emblemUrl
            ? `<img src="${emblemUrl}" alt="${g.guildName}" class="guild-crystal-emblem"
                    style="border-color:${primary}; box-shadow: 0 0 16px ${glow}77;">`
            : `<div class="guild-crystal-emblem guild-crystal-emblem-fallback"
                    style="background:linear-gradient(135deg,${primary},${secondary}); box-shadow:0 0 16px ${glow}77;">
                   <span style="font-size:2rem">${emoji}</span>
               </div>`;

        const topHtml = g.topContributors.length
            ? `<div class="guild-crystal-heroes">
                   <span class="guild-crystal-heroes-label">⚔️ Top Heroes</span>
                   ${g.topContributors.slice(0, 3).map(c => `
                       <span class="guild-crystal-hero-chip" style="color:${primary};border-color:${primary}33;">
                           ${c.name}
                           <span style="opacity:0.65;font-size:0.6rem">${c.totalStars}⭐</span>
                       </span>`).join('')}
               </div>`
            : `<div class="guild-crystal-heroes">
                   <span class="guild-crystal-heroes-label" style="opacity:0.45">No heroes yet</span>
               </div>`;

        return `
            <div class="guild-crystal-col" data-guild="${g.guildId}">

                <!-- ── Rank ── -->
                <div class="guild-crystal-rank">${rankEmoji[index] || `#${index + 1}`}</div>

                <!-- ── Header section (fixed min-height so all columns align at tube start) ── -->
                <div class="guild-crystal-header">
                    <!-- Emblem is the click target for lore + sound -->
                    <div class="guild-crystal-emblem-wrapper"
                         data-guild-id="${g.guildId}"
                         role="button" tabindex="0"
                         aria-label="Discover ${g.guildName}"
                         style="--glow-color:${glow};">
                        ${emblemHtml}
                        <div class="guild-emblem-ring" style="border-color:${glow};box-shadow:0 0 24px ${glow}88;"></div>
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
                    <span class="guild-crystal-count-num">${g.totalStars.toLocaleString()}</span>
                    <span class="guild-crystal-count-label">⭐ stars</span>
                </div>
                <div class="guild-crystal-members">${g.memberCount} member${g.memberCount === 1 ? '' : 's'}</div>

                ${topHtml}
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
        const wrapper = e.target.closest('.guild-crystal-emblem-wrapper');
        if (!wrapper) return;
        e.stopPropagation();
        const guildId = wrapper.dataset.guildId;
        const gData   = displayData.find(d => d.guildId === guildId);
        openGuildLore(guildId, gData);
    };

    arena.addEventListener('click', handleGuildActivate);
    arena.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') handleGuildActivate(e);
    });
}
