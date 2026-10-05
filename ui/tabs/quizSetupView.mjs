/**
 * Teacher Settings → Quiz of the Week: what the teacher sees about this week's quiz.
 * Pure (no DOM, no Firestore) so the guidebook capture and tests can render it.
 * Behaviour lives in ui/tabs/quizSetup.js.
 */
import { mondayFromIsoWeekKey } from '../../features/quizCurriculumCore.mjs';
import { countKinds, describeKindMix } from '../../features/quizKindsCore.mjs';

export { expectedQuestionCount } from '../../features/quizCurriculumCore.mjs';

export const QUIZ_TYPES = [
    { id: 'mix', icon: '🔀', label: 'Mix', hint: 'Words and grammar together' },
    { id: 'vocabulary', icon: '📚', label: 'Vocabulary', hint: 'Meaning, spelling and use of words' },
    { id: 'grammar', icon: '📐', label: 'Grammar', hint: 'Forms and sentence patterns' }
];

const TIER_EMOJI = { legendary: '👑', epic: '🌟', rare: '💎', common: '🎯', heroic: '🛡️' };
const TIER_NAME = { legendary: 'Legendary', epic: 'Epic', rare: 'Rare', common: 'Common', heroic: 'Heroic' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function escapeQuizText(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

const plural = (n, word) => `${n} ${n === 1 ? word : (word === 'hero' ? 'heroes' : `${word}s`)}`;

function parseIso(iso) {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** "5 Oct" */
export function shortDate(date) {
    return date ? `${date.getDate()} ${MONTHS[date.getMonth()]}` : '';
}

/** "Week of 28 Sep" from "2026-W40". */
export function weekLabel(weekKey) {
    const monday = parseIso(mondayFromIsoWeekKey(weekKey));
    return monday ? `Week of ${shortDate(monday)}` : (weekKey ? `Week ${String(weekKey).replace(/^\d{4}-W/, '')}` : '');
}

/** "5 – 9 Oct" (or "28 Sep – 2 Oct") for the school days of a week. */
export function weekRangeLabel(mondayIso) {
    const monday = parseIso(mondayIso);
    if (!monday) return '';
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    return monday.getMonth() === friday.getMonth()
        ? `${monday.getDate()} – ${shortDate(friday)}`
        : `${shortDate(monday)} – ${shortDate(friday)}`;
}

/** "Mon 5 Oct, 17:00" */
export function lessonLabel(lesson) {
    if (!lesson?.date) return '';
    const day = `${WEEKDAYS[lesson.date.getDay()]} ${shortDate(lesson.date)}`;
    return lesson.timeStart ? `${day}, ${lesson.timeStart}` : day;
}

/**
 * Where this week's quiz stands, as one model the card renders.
 * `phase` is the step of Plan → Create → Check → Play that is in progress (5 = all done).
 */
export function describeQuizWeek({ quiz = null, nextLesson = null, generating = false, error = '' } = {}) {
    const status = generating ? 'generating' : error ? 'error' : (quiz?.status || 'none');
    const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
    const count = questions.length;
    const carried = questions.filter((q) => q?.carriedFrom).length;
    const type = quiz?.curriculum?.type || quiz?.curriculum?.lessonFocus?.type || '';
    const typeLabel = QUIZ_TYPES.find((t) => t.id === type)?.label || '';
    const playsAt = lessonLabel(nextLesson);
    const facts = [];
    if (count) facts.push({ icon: 'fa-circle-question', text: plural(count, 'question') });
    if (typeLabel) facts.push({ icon: 'fa-shapes', text: typeLabel });
    if (carried) facts.push({ icon: 'fa-rotate', text: `${carried} back from last time` });
    const kinds = countKinds(questions);
    // Older quizzes are all classic questions: their card stays as it was.
    if (count && kinds.choice < count) facts.push({ icon: 'fa-layer-group', text: describeKindMix(kinds) });

    const base = { status, facts, count, actions: [] };
    switch (status) {
        case 'generating':
            return { ...base, phase: 2, tone: 'busy', icon: '🪄', title: 'Writing the questions…', sub: 'The questions are written in a few parts and the pictures are drawn once. This can take a minute or two.' };
        case 'error':
            return { ...base, phase: 2, tone: 'error', icon: '⚠️', title: 'The questions could not be made', sub: error || 'Please try again in a moment.' };
        case 'pending':
            return { ...base, phase: 2, tone: 'idle', icon: '📝', title: 'The plan is saved, the questions are not', sub: 'Press Create the quiz below to try again.', actions: ['reset'] };
        case 'review':
            return {
                ...base, phase: 3, tone: 'attention', icon: '🧐', title: `${plural(count, 'question')} waiting for your check`,
                sub: 'Nothing reaches the class until you approve them.', actions: ['review', 'reset']
            };
        case 'ready':
        case 'active':
            if (playsAt) facts.push({ icon: 'fa-calendar-day', text: `Next lesson ${playsAt}`, strong: true });
            return {
                ...base, phase: 4, tone: 'ready', icon: '🎟️', title: 'Ready to play',
                sub: playsAt
                    ? 'The quiz ticket appears on Home during the lesson. You can still read and edit the questions.'
                    : 'No lessons left this week, so the ticket will not appear. Next week needs a new quiz.',
                actions: status === 'active' ? ['play'] : ['play', 'edit', 'reset']
            };
        case 'completed': {
            const results = quiz?.results || {};
            const tier = results.tier || 'common';
            const pct = Number(results.firstTryCorrectPct) || 0;
            const heroes = Array.isArray(results.allParticipating) ? results.allParticipating.length : 0;
            const doneFacts = [{ icon: 'fa-bullseye', text: `${pct}% right first try`, strong: true }];
            if (count) doneFacts.push({ icon: 'fa-circle-question', text: plural(count, 'question') });
            if (heroes) doneFacts.push({ icon: 'fa-users', text: plural(heroes, 'hero') });
            return {
                ...base, facts: doneFacts, phase: 5, tone: 'done', icon: TIER_EMOJI[tier] || '🏆',
                title: `Played this week: ${TIER_NAME[tier] || 'Complete'}`,
                sub: 'Next week\'s quiz can be planned from Saturday.',
                tier, actions: ['results']
            };
        }
        default:
            return {
                ...base, phase: 1, tone: 'idle', icon: '✨', title: 'No quiz for this week yet',
                sub: playsAt
                    ? `Choose what it covers below and press Create the quiz. Next lesson: ${playsAt}.`
                    : 'Choose what it covers below and press Create the quiz.'
            };
    }
}

const TRACK = [
    { label: 'Plan', icon: 'fa-list-check' },
    { label: 'Create', icon: 'fa-wand-magic-sparkles' },
    { label: 'Check', icon: 'fa-eye', optional: true },
    { label: 'Play', icon: 'fa-play' }
];

export function quizTrackHtml(phase, { skippedCheck = false } = {}) {
    return TRACK.map((step, i) => {
        const n = i + 1;
        const state = n < phase ? 'done' : n === phase ? 'now' : 'next';
        const skipped = step.optional && skippedCheck && n < phase;
        const icon = state === 'done' ? (skipped ? 'fa-forward' : 'fa-check') : step.icon;
        return `<li class="qwk-track__step is-${state}${skipped ? ' is-skipped' : ''}"${state === 'now' ? ' aria-current="step"' : ''}>
            <span class="qwk-track__dot"><i class="fas ${icon}" aria-hidden="true"></i></span>
            <span class="qwk-track__label">${step.label}${step.optional ? '<small>optional</small>' : ''}</span>
        </li>`;
    }).join('');
}

export function quizFactsHtml(facts = []) {
    return facts.map((f) => `<span class="qwk-fact${f.strong ? ' qwk-fact--strong' : ''}"><i class="fas ${f.icon}" aria-hidden="true"></i>${escapeQuizText(f.text)}</span>`).join('');
}

/** One line that says what the saved plan covers ("Mix · Unit 4 · friend, kind, share +2"). */
export function planSummaryText(curriculum) {
    if (!curriculum) return '';
    const focus = curriculum.lessonFocus;
    const type = QUIZ_TYPES.find((t) => t.id === curriculum.type)?.label || '';
    const parts = [type];
    if (focus && focus.source !== 'manual') {
        const unit = (focus.units || [])[0];
        if (unit?.unit != null) parts.push(`Unit ${unit.unit}`);
        const words = focus.words || [];
        if (words.length) parts.push(words.slice(0, 3).join(', ') + (words.length > 3 ? ` +${words.length - 3}` : ''));
        else if ((focus.grammarPoints || []).length) parts.push(focus.grammarPoints[0]);
    } else {
        const cats = curriculum.categories || [];
        if (cats.length) parts.push(cats.slice(0, 2).join(', ') + (cats.length > 2 ? ` +${cats.length - 2}` : ''));
        else if (curriculum.keywords) parts.push(String(curriculum.keywords).slice(0, 60));
    }
    return parts.filter(Boolean).join(' · ');
}

export function quizHistoryHtml(history = []) {
    return history.map((h) => {
        const tier = h.results?.tier || 'common';
        const pct = Math.max(0, Math.min(100, Number(h.results?.firstTryCorrectPct) || 0));
        const qc = Number(h.results?.totalQuestions) || (h.questions || []).length || 0;
        const heroes = Array.isArray(h.results?.allParticipating) ? h.results.allParticipating.length : 0;
        const topic = planSummaryText(h.curriculum);
        return `<li class="qwk-past">
            <span class="qwk-past__medal qwk-tier--${tier}" title="${TIER_NAME[tier] || tier}">${TIER_EMOJI[tier] || '🏆'}</span>
            <span class="qwk-past__copy">
                <span class="qwk-past__week">${escapeQuizText(weekLabel(h.weekKey))}</span>
                <span class="qwk-past__topic">${escapeQuizText(topic || `${TIER_NAME[tier] || ''} quiz`)}</span>
            </span>
            <span class="qwk-past__score">
                <span class="qwk-past__pct"><b>${pct}%</b> first try</span>
                <span class="qwk-past__bar" aria-hidden="true"><span style="width:${pct}%"></span></span>
                <span class="qwk-past__meta">${qc ? plural(qc, 'question') : ''}${qc && heroes ? ' · ' : ''}${heroes ? plural(heroes, 'hero') : ''}</span>
            </span>
        </li>`;
    }).join('');
}
