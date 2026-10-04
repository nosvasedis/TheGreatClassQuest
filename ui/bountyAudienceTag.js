// ui/bountyAudienceTag.js — the "for Dragon Flame" / "for 4 heroes" tag on bounty cards.
// Whole-class bounties get no tag, so older bounties look exactly as before.
import { getGuildById } from '../features/guilds.js';
import { describeAudience, normalizeAudience } from '../features/bountyAudience.mjs';

function esc(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Plain words: "Dragon Flame", "4 heroes", or "" for the whole class. */
export function bountyAudienceLabel(bounty) {
    const audience = normalizeAudience(bounty);
    if (audience.kind === 'class') return '';
    const guild = audience.kind === 'guild' ? getGuildById(audience.guildId) : null;
    return describeAudience(bounty, { guildName: guild?.name }).short;
}

/** Tag markup; `tone` "dark" is for cards on a coloured background. */
export function bountyAudienceTagHtml(bounty, { tone = 'light', names = null } = {}) {
    const audience = normalizeAudience(bounty);
    if (audience.kind === 'class') return '';
    const guild = audience.kind === 'guild' ? getGuildById(audience.guildId) : null;
    const who = describeAudience(bounty, { guildName: guild?.name, guildEmoji: guild?.emoji });
    const style = guild
        ? (tone === 'dark' ? `--bat-bg:${guild.primary}cc;--bat-ink:#fff` : `--bat-bg:${guild.primary}22;--bat-ink:${guild.primary}`)
        : (tone === 'dark' ? '--bat-bg:rgba(0,0,0,0.25);--bat-ink:#fff' : '--bat-bg:rgba(79,70,229,0.12);--bat-ink:#4338ca');
    const title = names?.length ? ` title="${esc(names.join(', '))}"` : '';
    return `<span class="bounty-audience-tag" style="${style}"${title}><span aria-hidden="true">${esc(who.emoji)}</span>For ${esc(who.short)}</span>`;
}
