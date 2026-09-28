// ui/modals/bountyPoster.js — the Post a Bounty poster (templates/modals/misc.js#create-bounty-modal)
// Fills the poster for the chosen class and keeps its smart picks and live summary in step.
// Saving stays in db/actions/bounties.js, which reads the same field ids.
import * as state from '../../state.js';
import { parseDDMMYYYY, getTodayDateString } from '../../utils.js';

const STAR_BOUNTY_HOURS = 2; // matches the expiry handleCreateBounty gives star bounties
const MODE_KEY = 'gcq.bountyPoster.mode';

const TITLE_IDEAS = {
    standard: ['English Only', 'Great Teamwork', 'Helping Hands', 'Super Listeners', 'Best Effort'],
    timer: ['Rapid Clean Up', 'Silent Reading', 'Worksheet Sprint', 'Vocabulary Race', 'Pack Up Fast']
};
const REWARD_IDEAS = ['5 min free time', 'A class game', 'Music while we work', 'Pick the story', 'Sit where you like'];
const TIME_PRESETS = [5, 10, 15, 20, 30];

const $ = (id) => document.getElementById(id);

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
    const tiers = targetTiers(typical.stars);
    $('bp-target-picks').innerHTML = tiers.map(tier => `
        <button type="button" class="bp-chip bp-chip--tier" data-bp-target="${tier.value}" data-tier="${tier.key}">
            <span class="bp-chip__tier">${tier.label}</span>
            <span class="bp-chip__value">${tier.value}<i class="fas fa-star" aria-hidden="true"></i></span>
        </button>`).join('');
    const name = escapeHtml(className());
    const basis = typical.lessons
        ? `${name} usually earns about <b>${typical.stars}</b> stars a lesson.`
        : `A class of ${typical.heroes || 'your'} heroes earns about <b>${typical.stars}</b> stars a lesson.`;
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
    const name = escapeHtml(className());
    const title = $('bounty-title').value.trim();
    const quest = title ? `<em>${escapeHtml(title)}</em>` : '<span class="bp-blank">the quest</span>';
    const readout = $('bp-time-readout');

    if (mode === 'timer') {
        const timing = timerDeadline();
        if (timing) {
            const day = timing.tomorrow ? 'tomorrow at ' : '';
            readout.innerHTML = `<i class="fas fa-hourglass-start" aria-hidden="true"></i> Time's up ${day}<b>${formatClock(timing.deadline)}</b> <span>(${timing.mins} min)</span>`;
            readout.classList.add('is-set');
            $('bp-proclamation').innerHTML = `${name} has <b>${timing.mins} minutes</b> for ${quest}. The sand runs out at <b>${formatClock(timing.deadline)}</b>.`;
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
    $('bp-proclamation').innerHTML = `When ${name} earns ${stars} for ${quest}, they win ${prize}.`;
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
    $('bp-tagline').textContent = isTimer ? 'Finish before the sand runs out' : 'The whole class takes it on together';
    $('bp-title-label').textContent = isTimer ? 'What must be done in time?' : "What's the quest?";
    $('bounty-title').placeholder = isTimer ? 'Name the task' : 'Name the challenge';
    setSubmitLabel();
    renderTitleIdeas($('bounty-type').value);
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
    if ($('bounty-type').value === 'timer') {
        if (!timerDeadline()) { markInvalid('time', $('bounty-timer-minutes')); return false; }
        return true;
    }
    if (!(parseInt($('bounty-target').value, 10) > 0)) { markInvalid('target', $('bounty-target')); return false; }
    if (!$('bounty-reward').value.trim()) { markInvalid('reward', $('bounty-reward')); return false; }
    return true;
}

/** Fills a fresh poster for this class. Call before showing the modal. */
export function prepareBountyPoster(classId) {
    $('bounty-class-id').value = classId;
    const classData = currentClass();
    $('bp-class-logo').textContent = classData?.logo || '📚';
    $('bp-class-name').textContent = classData?.name || 'This class';

    $('bounty-title').value = '';
    $('bounty-reward').value = '';
    $('bounty-timer-minutes').value = '';
    $('bounty-timer-end').value = '';

    const tiers = renderTargetPicks();
    $('bounty-target').value = String(tiers[1].value);
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
        if (targetChip) { $('bounty-target').value = targetChip.dataset.bpTarget; clearInvalid(); refresh(); return; }

        const step = e.target.closest('[data-bp-step]');
        if (step) {
            const current = parseInt($('bounty-target').value, 10) || 0;
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
            $(id).closest('.bp-field')?.classList.remove('is-invalid');
            refresh();
        });
    });

    // The countdown readout says "time's up at…", so keep it honest while the poster stays open.
    setInterval(() => {
        if (!modal.classList.contains('hidden') && $('bounty-type').value === 'timer') renderProclamation();
    }, 20000);
}
