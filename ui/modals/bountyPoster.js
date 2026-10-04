// ui/modals/bountyPoster.js — the Post a Bounty poster (templates/modals/misc.js#create-bounty-modal)
// Fills the poster for the chosen class and keeps its smart picks and live summary in step.
// Saving stays in db/actions/bounties.js, which reads the same field ids.
import * as state from '../../state.js';
import { parseDDMMYYYY, getTodayDateString } from '../../utils.js';
import { GUILD_IDS, getGuildById } from '../../features/guilds.js';
import { audienceShare, describeAudience } from '../../features/bountyAudience.mjs';
import { teamsForDay, teamBanner } from '../../features/teamMakerCore.mjs';
import { readClassField } from './classTools.js';

const STAR_BOUNTY_HOURS = 2; // matches the expiry handleCreateBounty gives star bounties
const MODE_KEY = 'gcq.bountyPoster.mode';

const TITLE_IDEAS = {
    standard: ['English Only', 'Great Teamwork', 'Helping Hands', 'Super Listeners', 'Best Effort'],
    timer: ['Rapid Clean Up', 'Silent Reading', 'Worksheet Sprint', 'Vocabulary Race', 'Pack Up Fast']
};
const REWARD_IDEAS = ['5 min free time', 'A class game', 'Music while we work', 'Pick the story', 'Sit where you like'];
const TIME_PRESETS = [5, 10, 15, 20, 30];

const $ = (id) => document.getElementById(id);

// Who the bounty is for. Reset with every fresh poster.
const audience = { kind: 'class', guildId: null, heroIds: new Set(), team: null };

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function readSavedMode() {
    try { return localStorage.getItem(MODE_KEY) === 'timer' ? 'timer' : 'standard'; } catch { return 'standard'; }
}

function saveMode(mode) {
    try { localStorage.setItem(MODE_KEY, mode); } catch { /* private mode: fine to forget */ }
}

function formatClock(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function currentClass() {
    const classId = $('bounty-class-id')?.value;
    return (state.get('allSchoolClasses') || []).find(c => c.id === classId) || null;
}

function className() {
    return currentClass()?.name || 'The class';
}

function classStudents() {
    const classId = $('bounty-class-id')?.value;
    return (state.get('allStudents') || [])
        .filter(s => s.classId === classId)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

/** Today's Team Maker teams for this class (ids still in the class only). */
function classTeams() {
    const classId = $('bounty-class-id')?.value;
    const today = classId ? teamsForDay(readClassField(classId, 'teamMaker'), getTodayDateString()) : null;
    if (!today) return [];
    const known = new Set(classStudents().map(s => s.id));
    return today.teams
        .map((ids, index) => ({ index, banner: teamBanner(index), ids: ids.filter(id => known.has(id)) }))
        .filter(t => t.ids.length);
}

/** Guilds with at least one hero in this class, in the usual guild order. */
function classGuilds() {
    const counts = new Map();
    for (const s of classStudents()) {
        if (s.guildId && GUILD_IDS.includes(s.guildId)) counts.set(s.guildId, (counts.get(s.guildId) || 0) + 1);
    }
    return GUILD_IDS.filter(id => counts.has(id)).map(id => ({ guild: getGuildById(id), count: counts.get(id) }));
}

function audienceRecord() {
    if (audience.kind === 'guild' && audience.guildId) {
        return { kind: 'guild', guildId: audience.guildId, label: getGuildById(audience.guildId)?.name || '' };
    }
    if (audience.kind === 'heroes' && audience.heroIds.size) {
        const ids = classStudents().map(s => s.id).filter(id => audience.heroIds.has(id));
        return audience.team ? { kind: 'heroes', studentIds: ids, label: audience.team.label } : { kind: 'heroes', studentIds: ids };
    }
    return { kind: 'class' };
}

function audienceMemberCount() {
    if (audience.kind === 'guild') return classGuilds().find(g => g.guild.id === audience.guildId)?.count || 0;
    if (audience.kind === 'heroes') return audience.heroIds.size;
    return classStudents().length;
}

/** Name for the proclamation and tagline: the class name, the guild, or "these 4 heroes". */
function audienceWho() {
    if (audience.kind === 'guild') return getGuildById(audience.guildId)?.name || 'The guild';
    if (audience.kind === 'heroes') {
        if (audience.team) return audience.team.label;
        const n = audience.heroIds.size;
        if (!n) return 'The chosen heroes';
        if (n <= 3) {
            const names = classStudents().filter(s => audience.heroIds.has(s.id)).map(s => String(s.name || '').split(' ')[0]);
            return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
        }
        return `These ${n} heroes`;
    }
    return className();
}

function heroFaceHtml(student) {
    if (student.avatar) return `<span class="bp-hero__face"><img src="${escapeHtml(student.avatar)}" alt="" loading="lazy"></span>`;
    return `<span class="bp-hero__face">${escapeHtml(String(student.name || '?').charAt(0))}</span>`;
}

function renderAudience() {
    const guilds = classGuilds();
    const total = classStudents().length;
    if (audience.kind === 'guild' && !guilds.some(g => g.guild.id === audience.guildId)) {
        audience.kind = 'class';
        audience.guildId = null;
    }
    const chip = (key, seal, label, count, style = '') => {
        const on = key === 'class' ? audience.kind === 'class'
            : key === 'heroes' ? audience.kind === 'heroes' && !audience.team
                : key.startsWith('team:') ? audience.kind === 'heroes' && audience.team?.key === key
                    : audience.kind === 'guild' && audience.guildId === key;
        return `<button type="button" class="bp-chip bp-chip--audience${on ? ' is-picked' : ''}" data-bp-audience="${escapeHtml(key)}" aria-pressed="${on}"${style}>
            <span class="bp-chip__seal" aria-hidden="true">${seal}</span>${escapeHtml(label)}${count != null ? `<small>${count}</small>` : ''}</button>`;
    };
    $('bp-audience-picks').innerHTML = [
        chip('class', '🏰', 'Whole class', total || null),
        ...guilds.map(({ guild, count }) => chip(guild.id, guild.emoji, guild.name, count,
            ` style="--bp-seal:${guild.primary}33;--bp-seal-ink:${guild.primary}"`)),
        ...classTeams().map(({ index, banner, ids }) => chip(`team:${index}`, banner.emoji, banner.short, ids.length,
            ` style="--bp-seal:${banner.primary}33;--bp-seal-ink:${banner.deep}" title="${escapeHtml(banner.name)}, today's Team Maker team"`)),
        chip('heroes', '🧭', 'Chosen heroes', audience.kind === 'heroes' && !audience.team && audience.heroIds.size ? audience.heroIds.size : null)
    ].join('');

    const heroesBox = $('bp-audience-heroes');
    const keepScroll = heroesBox.scrollTop;
    if (audience.kind === 'heroes') {
        heroesBox.innerHTML = classStudents().map(s => {
            const on = audience.heroIds.has(s.id);
            return `<button type="button" class="bp-hero${on ? ' is-picked' : ''}" data-bp-hero="${escapeHtml(s.id)}" aria-pressed="${on}">${heroFaceHtml(s)}${escapeHtml(String(s.name || '').split(' ')[0])}</button>`;
        }).join('') || '<span class="bp-hint">No heroes in this class yet.</span>';
        heroesBox.classList.remove('hidden');
        heroesBox.scrollTop = keepScroll;
    } else {
        heroesBox.innerHTML = '';
        heroesBox.classList.add('hidden');
    }

    const hint = $('bp-audience-hint');
    if (audience.kind === 'guild') {
        hint.innerHTML = `Only stars earned by <b>${escapeHtml(audienceWho())}</b> heroes count. The rest of the class carries on as usual.`;
    } else if (audience.kind === 'heroes' && audience.team) {
        hint.innerHTML = `Only stars earned by the <b>${escapeHtml(audience.team.label)}</b> count. Tap a face to change the team for this bounty.`;
    } else if (audience.kind === 'heroes') {
        hint.innerHTML = audience.heroIds.size
            ? 'Only stars earned by the chosen heroes count. Good for one table or a small team.'
            : 'Tap the heroes who take this on, for example one table.';
    } else {
        hint.innerHTML = guilds.length ? 'Or aim it at one guild or a few chosen heroes.' : 'Or aim it at a few chosen heroes, for example one table.';
    }
    $('bounty-audience').value = JSON.stringify(audienceRecord());
}

/** Stars this class usually earns in one lesson: the median of its recent lesson days, today left out. */
function typicalLessonStars(classId) {
    const today = getTodayDateString();
    const byDate = new Map();
    for (const log of state.get('allAwardLogs') || []) {
        if (log.classId !== classId || !log.date || log.date === today) continue;
        byDate.set(log.date, (byDate.get(log.date) || 0) + (Number(log.stars) || 0));
    }
    const recent = [...byDate.entries()]
        .filter(([, stars]) => stars > 0)
        .map(([date, stars]) => ({ time: parseDDMMYYYY(date).getTime(), stars }))
        .filter(day => Number.isFinite(day.time))
        .sort((a, b) => b.time - a.time)
        .slice(0, 8)
        .map(day => day.stars)
        .sort((a, b) => a - b);

    if (recent.length >= 2) {
        const mid = Math.floor(recent.length / 2);
        const median = recent.length % 2 ? recent[mid] : (recent[mid - 1] + recent[mid]) / 2;
        return { stars: Math.max(4, Math.round(median)), lessons: recent.length };
    }
    const heroes = (state.get('allStudents') || []).filter(s => s.classId === classId).length;
    return { stars: Math.max(8, Math.round((heroes || 10) * 1.5)), lessons: 0, heroes };
}

function targetTiers(typical) {
    const tiers = [
        { key: 'quick', label: 'Quick win', value: Math.max(3, Math.round(typical * 0.5)) },
        { key: 'fair', label: 'Fair fight', value: Math.max(4, Math.round(typical * 0.8)) },
        { key: 'heroic', label: 'Heroic', value: Math.max(5, Math.round(typical * 1.1)) }
    ];
    for (let i = 1; i < tiers.length; i++) {
        if (tiers[i].value <= tiers[i - 1].value) tiers[i].value = tiers[i - 1].value + 1;
    }
    return tiers;
}

/** Recent bounties for this class (newest first), used to offer titles and rewards again. */
function recentBounties(classId, type) {
    const createdMs = (b) => b.createdAt?.toMillis?.() ?? (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.deadline || 0).getTime());
    return (state.get('allQuestBounties') || [])
        .filter(b => b.classId === classId && (!type || (b.type || 'standard') === type))
        .sort((a, b) => createdMs(b) - createdMs(a));
}

function uniqueCaseless(list) {
    const seen = new Set();
    return list.filter(item => {
        const key = String(item || '').trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function chipHtml({ value, label, attr, recent = false, extraClass = '' }) {
    return `<button type="button" class="bp-chip ${recent ? 'bp-chip--recent' : ''} ${extraClass}" ${attr}="${escapeHtml(value)}"${recent ? ' title="Used before with this class"' : ''}>${recent ? '<i class="fas fa-rotate-left" aria-hidden="true"></i>' : ''}${label}</button>`;
}

function renderTitleIdeas(mode) {
    const classId = $('bounty-class-id').value;
    const recent = recentBounties(classId, mode).map(b => b.title).slice(0, 6);
    const recentSet = new Set(uniqueCaseless(recent).slice(0, 2).map(t => t.toLowerCase()));
    const ideas = uniqueCaseless([...recent.filter(t => recentSet.has(String(t).trim().toLowerCase())), ...TITLE_IDEAS[mode]]).slice(0, 5);
    $('bp-title-ideas').innerHTML = ideas.map(title => chipHtml({
        value: title,
        label: escapeHtml(title),
        attr: 'data-bp-title',
        recent: recentSet.has(title.trim().toLowerCase())
    })).join('');
}

function renderRewardIdeas() {
    const classId = $('bounty-class-id').value;
    const recent = uniqueCaseless(recentBounties(classId, 'standard').map(b => b.reward)).slice(0, 2);
    const recentSet = new Set(recent.map(r => r.toLowerCase()));
    const ideas = uniqueCaseless([...recent, ...REWARD_IDEAS]).slice(0, 5);
    $('bp-reward-ideas').innerHTML = ideas.map(reward => chipHtml({
        value: reward,
        label: escapeHtml(reward),
        attr: 'data-bp-reward',
        recent: recentSet.has(reward.toLowerCase())
    })).join('');
}

function renderTargetPicks() {
    const classId = $('bounty-class-id').value;
    const typical = typicalLessonStars(classId);
    const share = audience.kind === 'class' ? 1 : audienceShare(audienceMemberCount(), classStudents().length);
    const tiers = targetTiers(Math.max(3, Math.round(typical.stars * share)));
    $('bp-target-picks').innerHTML = tiers.map(tier => `
        <button type="button" class="bp-chip bp-chip--tier" data-bp-target="${tier.value}" data-tier="${tier.key}">
            <span class="bp-chip__tier">${tier.label}</span>
            <span class="bp-chip__value">${tier.value}<i class="fas fa-star" aria-hidden="true"></i></span>
        </button>`).join('');
    const name = escapeHtml(className());
    let basis = typical.lessons
        ? `${name} usually earns about <b>${typical.stars}</b> stars a lesson.`
        : `A class of ${typical.heroes || 'your'} heroes earns about <b>${typical.stars}</b> stars a lesson.`;
    if (share < 1) basis += ` The picks are sized for ${escapeHtml(audienceWho())}.`;
    $('bp-target-hint').innerHTML = `${basis} Stars count from when it's pinned, for ${STAR_BOUNTY_HOURS} hours.`;
    return tiers;
}

function minutesUntilBell() {
    const classData = currentClass();
    if (!classData?.timeEnd) return null;
    const [h, m] = classData.timeEnd.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    const bell = new Date();
    bell.setHours(h, m, 0, 0);
    const mins = Math.floor((bell - new Date()) / 60000);
    return mins > 0 && mins < 180 ? mins : null;
}

function renderTimePresets() {
    const bell = minutesUntilBell();
    const presets = TIME_PRESETS.map(min => `<button type="button" class="bp-chip bp-chip--time smart-time-btn" data-mins="${min}">${min}<small>min</small></button>`);
    if (bell) {
        presets.push(`<button type="button" class="bp-chip bp-chip--time bp-chip--bell smart-time-btn" data-mins="${bell}" data-bell="1"><i class="fas fa-bell" aria-hidden="true"></i>Until the bell<small>${bell} min</small></button>`);
    }
    $('bounty-smart-options').innerHTML = presets.join('');
}

function renderOnBoard() {
    const classId = $('bounty-class-id').value;
    const now = new Date();
    const live = (state.get('allQuestBounties') || [])
        .filter(b => b.classId === classId && b.status === 'active' && new Date(b.deadline) > now);
    const box = $('bp-on-board');
    if (!live.length) {
        box.classList.add('hidden');
        box.innerHTML = '';
        return;
    }
    const items = live.slice(0, 2).map(b => b.type === 'timer'
        ? `<b>${escapeHtml(b.title)}</b> <span>(time's up at ${formatClock(new Date(b.deadline))})</span>`
        : `<b>${escapeHtml(b.title)}</b> <span>(${Number(b.currentProgress) || 0}/${b.target} stars)</span>`);
    const more = live.length > 2 ? ` and ${live.length - 2} more` : '';
    box.innerHTML = `<i class="fas fa-thumbtack" aria-hidden="true"></i><span>Already on the board: ${items.join(', ')}${more}. A new bounty runs alongside it.</span>`;
    box.classList.remove('hidden');
}

/** When the countdown ends, as handleCreateBounty will compute it. */
function timerDeadline() {
    const end = $('bounty-timer-end').value;
    const mins = parseInt($('bounty-timer-minutes').value, 10);
    if (end) {
        const [h, m] = end.split(':').map(Number);
        const deadline = new Date();
        deadline.setHours(h, m, 0, 0);
        let tomorrow = false;
        if (deadline < new Date()) { deadline.setDate(deadline.getDate() + 1); tomorrow = true; }
        return { deadline, mins: Math.round((deadline - new Date()) / 60000), tomorrow };
    }
    if (mins > 0) {
        const deadline = new Date();
        deadline.setMinutes(deadline.getMinutes() + mins);
        return { deadline, mins, tomorrow: false };
    }
    return null;
}

function syncTimeChips() {
    const mins = $('bounty-timer-minutes').value;
    const usingEnd = !!$('bounty-timer-end').value;
    $('bounty-smart-options').querySelectorAll('.smart-time-btn').forEach(btn => {
        const on = !usingEnd && btn.dataset.mins === mins;
        btn.classList.toggle('is-picked', on);
        btn.setAttribute('aria-pressed', String(on));
    });
}

function syncPickedChips() {
    const target = $('bounty-target').value;
    $('bp-target-picks').querySelectorAll('[data-bp-target]').forEach(btn => btn.classList.toggle('is-picked', btn.dataset.bpTarget === target));
    const reward = $('bounty-reward').value.trim().toLowerCase();
    $('bp-reward-ideas').querySelectorAll('[data-bp-reward]').forEach(btn => btn.classList.toggle('is-picked', btn.dataset.bpReward.toLowerCase() === reward));
    const title = $('bounty-title').value.trim().toLowerCase();
    $('bp-title-ideas').querySelectorAll('[data-bp-title]').forEach(btn => btn.classList.toggle('is-picked', btn.dataset.bpTitle.toLowerCase() === title));
    syncTimeChips();
}

function renderProclamation() {
    const mode = $('bounty-type').value;
    const name = escapeHtml(audienceWho());
    const title = $('bounty-title').value.trim();
    const quest = title ? `<em>${escapeHtml(title)}</em>` : '<span class="bp-blank">the quest</span>';
    const readout = $('bp-time-readout');

    if (mode === 'timer') {
        const timing = timerDeadline();
        if (timing) {
            const day = timing.tomorrow ? 'tomorrow at ' : '';
            readout.innerHTML = `<i class="fas fa-hourglass-start" aria-hidden="true"></i> Time's up ${day}<b>${formatClock(timing.deadline)}</b> <span>(${timing.mins} min)</span>`;
            readout.classList.add('is-set');
            $('bp-proclamation').innerHTML = `${name} ${audience.kind === 'heroes' && audience.heroIds.size > 1 ? 'have' : 'has'} <b>${timing.mins} minutes</b> for ${quest}. The sand runs out at <b>${formatClock(timing.deadline)}</b>.`;
        } else {
            readout.innerHTML = 'Pick a time and the hourglass is set.';
            readout.classList.remove('is-set');
            $('bp-proclamation').innerHTML = `${name} races the clock on ${quest}.`;
        }
        return;
    }

    const target = parseInt($('bounty-target').value, 10);
    const reward = $('bounty-reward').value.trim();
    const stars = target > 0 ? `<b>${target} stars</b>` : '<span class="bp-blank">the stars</span>';
    const prize = reward ? `<b>${escapeHtml(reward)}</b>` : '<span class="bp-blank">a reward</span>';
    const verb = audience.kind === 'heroes' && audience.heroIds.size > 1 ? 'earn' : 'earns';
    $('bp-proclamation').innerHTML = `When ${name} ${verb} ${stars} for ${quest}, they win ${prize}.`;
}

function refresh() {
    syncPickedChips();
    renderProclamation();
}

function setMode(mode) {
    const isTimer = mode === 'timer';
    $('bounty-type').value = isTimer ? 'timer' : 'standard';
    $('create-bounty-modal').querySelector('.bp-sheet').dataset.mode = $('bounty-type').value;
    $('bounty-mode-stars').classList.toggle('is-active', !isTimer);
    $('bounty-mode-timer').classList.toggle('is-active', isTimer);
    $('bounty-mode-stars').setAttribute('aria-pressed', String(!isTimer));
    $('bounty-mode-timer').setAttribute('aria-pressed', String(isTimer));
    $('bounty-inputs-stars').classList.toggle('hidden', isTimer);
    $('bounty-inputs-timer').classList.toggle('hidden', !isTimer);
    syncTagline();
    $('bp-title-label').textContent = isTimer ? 'What must be done in time?' : "What's the quest?";
    $('bounty-title').placeholder = isTimer ? 'Name the task' : 'Name the challenge';
    setSubmitLabel();
    renderTitleIdeas($('bounty-type').value);
    clearInvalid();
    refresh();
}

function syncTagline() {
    const isTimer = $('bounty-type').value === 'timer';
    if (isTimer) { $('bp-tagline').textContent = 'Finish before the sand runs out'; return; }
    const who = describeAudience({ audience: audienceRecord() }, { guildName: getGuildById(audience.guildId)?.name });
    $('bp-tagline').textContent = who.kind === 'class' ? 'The whole class takes it on together'
        : who.kind === 'guild' ? `${who.short} takes it on together` : 'A chosen band takes it on together';
}

function setAudienceQuietly(key) {
    const team = classTeams().find(t => `team:${t.index}` === key);
    if (!team) return;
    audience.kind = 'heroes';
    audience.guildId = null;
    audience.heroIds = new Set(team.ids);
    audience.team = { key, label: team.banner.name };
}

function setAudience(key) {
    if (key === 'class') { audience.kind = 'class'; audience.guildId = null; audience.team = null; }
    else if (key === 'heroes') { audience.kind = 'heroes'; audience.guildId = null; }
    else if (key.startsWith('team:')) {
        const team = classTeams().find(t => `team:${t.index}` === key);
        if (team) {
            audience.kind = 'heroes';
            audience.guildId = null;
            audience.heroIds = new Set(team.ids);
            audience.team = { key, label: team.banner.name };
        }
    }
    else if (GUILD_IDS.includes(key)) { audience.kind = 'guild'; audience.guildId = key; audience.team = null; }
    renderAudience();
    const tiers = renderTargetPicks();
    // Keep a hand-typed target, but move a picked one to the matching tier for the new group.
    const pickedTier = $('bounty-target').dataset.tier;
    if (pickedTier) {
        const match = tiers.find(t => t.key === pickedTier);
        if (match) $('bounty-target').value = String(match.value);
    }
    syncTagline();
    clearInvalid();
    refresh();
}

function setSubmitLabel() {
    const isTimer = $('bounty-type').value === 'timer';
    $('bounty-submit-btn').innerHTML = `
        <span class="bp-submit__seal" aria-hidden="true"><i class="fas ${isTimer ? 'fa-hourglass-start' : 'fa-thumbtack'}"></i></span>
        <span class="bp-submit__label">${isTimer ? 'Start the clock' : 'Pin it to the board'}</span>`;
}

function clearInvalid() {
    $('create-bounty-modal').querySelectorAll('.bp-field.is-invalid').forEach(el => el.classList.remove('is-invalid'));
}

function markInvalid(fieldKey, focusEl) {
    const field = $('create-bounty-modal').querySelector(`[data-bp-field="${fieldKey}"]`);
    if (field) {
        field.classList.remove('is-invalid');
        void field.offsetWidth;
        field.classList.add('is-invalid');
    }
    focusEl?.focus();
}

/**
 * Checks the poster before saving; marks the first missing line instead of only toasting.
 * Returns true when handleCreateBounty can go ahead.
 */
export function validateBountyPoster() {
    clearInvalid();
    if (!$('bounty-title').value.trim()) { markInvalid('title', $('bounty-title')); return false; }
    if (audience.kind === 'heroes' && !audience.heroIds.size) { markInvalid('audience', $('bp-audience-heroes').querySelector('button')); return false; }
    if ($('bounty-type').value === 'timer') {
        if (!timerDeadline()) { markInvalid('time', $('bounty-timer-minutes')); return false; }
        return true;
    }
    if (!(parseInt($('bounty-target').value, 10) > 0)) { markInvalid('target', $('bounty-target')); return false; }
    if (!$('bounty-reward').value.trim()) { markInvalid('reward', $('bounty-reward')); return false; }
    return true;
}

/**
 * Fills a fresh poster for this class. Call before showing the modal.
 * `team` ({ ids, label }) opens it aimed at one Team Maker team.
 */
export function prepareBountyPoster(classId, { team = null } = {}) {
    $('bounty-class-id').value = classId;
    const classData = currentClass();
    $('bp-class-logo').textContent = classData?.logo || '📚';
    $('bp-class-name').textContent = classData?.name || 'This class';

    $('bounty-title').value = '';
    $('bounty-reward').value = '';
    $('bounty-timer-minutes').value = '';
    $('bounty-timer-end').value = '';

    audience.kind = 'class';
    audience.guildId = null;
    audience.heroIds = new Set();
    audience.team = null;
    const teamKey = team ? classTeams().find(t => t.banner.name === team.label)?.index : undefined;
    if (teamKey !== undefined) setAudienceQuietly(`team:${teamKey}`);
    else if (team?.ids?.length) {
        audience.kind = 'heroes';
        audience.heroIds = new Set(team.ids.map(String));
        audience.team = { key: 'team:given', label: team.label || 'team' };
    }
    renderAudience();

    const tiers = renderTargetPicks();
    $('bounty-target').value = String(tiers[1].value);
    $('bounty-target').dataset.tier = tiers[1].key;
    renderRewardIdeas();
    renderTimePresets();
    renderOnBoard();
    setMode(readSavedMode());
}

/** Focus the quest line once the poster is on screen (not on touch, where it would pop the keyboard). */
export function focusBountyPoster() {
    if (window.matchMedia?.('(pointer: coarse)').matches) return;
    setTimeout(() => $('bounty-title')?.focus({ preventScroll: true }), 220);
}

export function setupBountyPoster() {
    const modal = $('create-bounty-modal');
    if (!modal || modal.dataset.bpWired) return;
    modal.dataset.bpWired = '1';

    $('bounty-mode-stars').addEventListener('click', () => { setMode('standard'); saveMode('standard'); });
    $('bounty-mode-timer').addEventListener('click', () => { setMode('timer'); saveMode('timer'); });

    modal.addEventListener('click', (e) => {
        const titleChip = e.target.closest('[data-bp-title]');
        if (titleChip) { $('bounty-title').value = titleChip.dataset.bpTitle; clearInvalid(); refresh(); return; }

        const rewardChip = e.target.closest('[data-bp-reward]');
        if (rewardChip) { $('bounty-reward').value = rewardChip.dataset.bpReward; clearInvalid(); refresh(); return; }

        const targetChip = e.target.closest('[data-bp-target]');
        if (targetChip) { $('bounty-target').value = targetChip.dataset.bpTarget; $('bounty-target').dataset.tier = targetChip.dataset.tier || ''; clearInvalid(); refresh(); return; }

        const audienceChip = e.target.closest('[data-bp-audience]');
        if (audienceChip) { setAudience(audienceChip.dataset.bpAudience); return; }

        const heroChip = e.target.closest('[data-bp-hero]');
        if (heroChip) {
            const id = heroChip.dataset.bpHero;
            if (audience.heroIds.has(id)) audience.heroIds.delete(id); else audience.heroIds.add(id);
            audience.team = null; // a hand-picked group is no longer exactly the team
            setAudience('heroes');
            $('bp-audience-heroes').querySelector(`[data-bp-hero="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
            return;
        }

        const step = e.target.closest('[data-bp-step]');
        if (step) {
            const current = parseInt($('bounty-target').value, 10) || 0;
            $('bounty-target').dataset.tier = '';
            $('bounty-target').value = String(Math.min(500, Math.max(1, current + Number(step.dataset.bpStep))));
            clearInvalid();
            refresh();
            return;
        }

        const timeChip = e.target.closest('.smart-time-btn');
        if (timeChip) {
            $('bounty-timer-minutes').value = timeChip.dataset.mins;
            $('bounty-timer-end').value = '';
            clearInvalid();
            refresh();
        }
    });

    $('bounty-timer-minutes').addEventListener('input', () => {
        if ($('bounty-timer-minutes').value) $('bounty-timer-end').value = '';
        refresh();
    });
    $('bounty-timer-end').addEventListener('input', () => {
        if ($('bounty-timer-end').value) $('bounty-timer-minutes').value = '';
        refresh();
    });
    ['bounty-title', 'bounty-target', 'bounty-reward'].forEach(id => {
        $(id).addEventListener('input', () => {
            if (id === 'bounty-target') $(id).dataset.tier = '';
            $(id).closest('.bp-field')?.classList.remove('is-invalid');
            refresh();
        });
    });

    // The countdown readout says "time's up at…", so keep it honest while the poster stays open.
    setInterval(() => {
        if (!modal.classList.contains('hidden') && $('bounty-type').value === 'timer') renderProclamation();
    }, 20000);
}
