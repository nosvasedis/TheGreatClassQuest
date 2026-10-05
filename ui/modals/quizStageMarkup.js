// /ui/modals/quizStageMarkup.js — Pure markup for the Quiz of the Week show stage.
// No state, DOM or Firebase imports: the live modal and the guidebook captures both build from here.
import { QUIZ_KIND_INFO, questionKind } from '../../features/quizKindsCore.mjs';

const GEMS = ['a', 'b', 'c', 'd'];
const GEM_LETTERS = ['A', 'B', 'C', 'D'];

export const QUIZ_TIERS = {
    legendary: { label: 'Legendary', icon: 'fa-crown', tagline: 'A flawless show! Every question on the first try.' },
    epic: { label: 'Epic', icon: 'fa-star', tagline: 'A dazzling show! Nearly every answer landed first time.' },
    rare: { label: 'Rare', icon: 'fa-gem', tagline: 'A strong show! Most questions fell on the first try.' },
    common: { label: 'Common', icon: 'fa-bullseye', tagline: 'A solid show. A little more practice and the gems will shine.' },
    heroic: { label: 'Heroic', icon: 'fa-shield-heart', tagline: 'A heroic effort! Every try counts, and next week is a new show.' }
};

export function computeQuizTier(pct) {
    if (pct === 100) return 'legendary';
    if (pct >= 80) return 'epic';
    if (pct >= 60) return 'rare';
    if (pct >= 40) return 'common';
    return 'heroic';
}

export function escapeQuizHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const esc = escapeQuizHtml;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const ordinal = (n) => (n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);

/**
 * Outcome of each question in the order it was played:
 * 'first' (right on the first try), 'late' (solved after a pass), 'missed' (nobody solved it), 'skipped'.
 */
export function computeQuizTrail(answeredQuestions = [], attempts = []) {
    return answeredQuestions.map((question) => {
        const tries = attempts.filter((attempt) => attempt.questionId === question.id);
        if (question.forceSkipped) return tries.length ? 'missed' : 'skipped';
        const first = tries.find((attempt) => Number(attempt.attemptNumber) === 1);
        return first?.correct ? 'first' : 'late';
    });
}

const TRAIL_LABELS = { first: 'right first try', late: 'solved after a pass', missed: 'nobody solved it', skipped: 'skipped' };

function trailHtml(trail = [], total = 0, currentIndex = -1) {
    if (!total) return '';
    const pips = Array.from({ length: total }, (_, i) => {
        const outcome = trail[i];
        const isCurrent = !outcome && i === currentIndex;
        const cls = outcome ? ` is-${outcome}` : isCurrent ? ' is-current' : '';
        const label = outcome ? `Question ${i + 1}: ${TRAIL_LABELS[outcome]}` : isCurrent ? `Question ${i + 1}: now playing` : `Question ${i + 1}: still to come`;
        return `<li class="qs-pip${cls}" title="${label}"><span class="sr-only">${label}</span></li>`;
    }).join('');
    return `<ol class="qs-trail" aria-label="Question trail">${pips}</ol>`;
}

function marqueeHtml(sub = '') {
    return `
        <div class="qs-marquee">
            <span class="qs-marquee__bulbs" aria-hidden="true"></span>
            <h2 id="qs-title" class="qs-marquee__title">Quiz <em>of the</em> Week</h2>
            ${sub ? `<span class="qs-marquee__sub">${esc(sub)}</span>` : ''}
        </div>`;
}

function closeButtonHtml({ pause = false } = {}) {
    const label = pause ? 'Pause the quiz' : 'Close';
    return `<button type="button" class="qs-close" id="quiz-close-btn" aria-label="${label}" title="${label}"><i class="fas ${pause ? 'fa-pause' : 'fa-xmark'}"></i></button>`;
}

function topBarHtml({ sub = '', middle = '', pause = false } = {}) {
    return `
        <header class="qs-top">
            ${marqueeHtml(sub)}
            <div class="qs-top__middle">${middle}</div>
            ${closeButtonHtml({ pause })}
        </header>`;
}

export function quizAvatarHtml(student, className = 'qs-avatar') {
    const name = student?.name || 'Hero';
    const initial = esc(name.trim().charAt(0).toUpperCase() || '?');
    return student?.avatar
        ? `<span class="${className}"><img src="${esc(student.avatar)}" alt="" loading="lazy" decoding="async"></span>`
        : `<span class="${className} ${className}--initial" aria-hidden="true">${initial}</span>`;
}

// ─── Stage shell ────────────────────────────────────────────────────────────

export function quizStageShellHtml(modalId = 'quiz-of-week-modal') {
    return `
<div id="${modalId}" class="qs-backdrop fixed inset-0 z-[90] flex items-center justify-center hidden">
    <div id="quiz-modal-inner" class="qs-stage" role="dialog" aria-modal="true" aria-labelledby="qs-title">
        <div class="qs-stage__valance" aria-hidden="true"></div>
        <div class="qs-stage__drape qs-stage__drape--l" aria-hidden="true"></div>
        <div class="qs-stage__drape qs-stage__drape--r" aria-hidden="true"></div>
        <div class="qs-stage__beam" aria-hidden="true"></div>
        <div id="quiz-modal-content" class="qs-stage__content"></div>
    </div>
</div>`;
}

// ─── Intro ──────────────────────────────────────────────────────────────────

/**
 * @param {{ questionCount:number, contestants:Array<{name,avatar}>, absentCount?:number, topic?:string, resume?:{questionNumber:number, total:number}|null }} data
 */
/** This week's formats, e.g. 3 Listen and choose · 2 Picture questions, with a sound check when anything is spoken. */
export function quizMixHtml(kinds = null) {
    if (!kinds) return '';
    const order = ['listen', 'picture', 'fix', 'choice'].filter((kind) => (Number(kinds[kind]) || 0) > 0);
    // A quiz of classic questions only (every older quiz) keeps the stage as it was.
    if (!order.some((kind) => kind !== 'choice')) return '';
    const chips = order.map((kind) => {
        const info = QUIZ_KIND_INFO[kind];
        return `<li class="qs-mix__chip qs-mix__chip--${kind}" title="${esc(info.label)}"><i class="fas ${info.icon}" aria-hidden="true"></i><b>${kinds[kind]}</b> ${esc(info.short)}</li>`;
    }).join('');
    const sound = kinds.listen > 0
        ? `<li><button type="button" class="qs-mix__sound" id="quiz-sound-check"><i class="fas fa-volume-high" aria-hidden="true"></i><span>Test the sound</span></button></li>`
        : '';
    return `<ul class="qs-mix" aria-label="This week's question formats">${chips}${sound}</ul>`;
}

export function quizIntroHtml({ questionCount = 0, contestants = [], absentCount = 0, topic = '', resume = null, kinds = null } = {}) {
    const shown = contestants.slice(0, 14);
    const extra = contestants.length - shown.length;
    const cast = shown.map((student, i) => `
            <li class="qs-cast__member" style="--i:${i}" title="${esc(student.name)}">
                ${quizAvatarHtml(student, 'qs-cast__avatar')}
                <span class="qs-cast__name">${esc(student.name)}</span>
            </li>`).join('') + (extra > 0 ? `<li class="qs-cast__member qs-cast__member--more" style="--i:${shown.length}"><span class="qs-cast__avatar qs-cast__avatar--initial">+${extra}</span><span class="qs-cast__name">more</span></li>` : '');

    const lead = resume
        ? `<p class="qs-intro__eyebrow">Welcome back</p>
           <h3 class="qs-intro__title">The show is paused</h3>
           <p class="qs-intro__lede">Question ${resume.questionNumber} of ${resume.total} is waiting on the stage.</p>`
        : `<p class="qs-intro__eyebrow">This week's challenge</p>
           <h3 class="qs-intro__title">Ready, Quest Heroes?</h3>
           ${topic ? `<p class="qs-intro__topic"><i class="fas fa-book-open"></i>${esc(topic)}</p>` : ''}`;

    return `
        ${topBarHtml()}
        <div class="qs-body qs-body--intro">
            <section class="qs-intro">
                ${lead}
                <div class="qs-tickets">
                    <div class="qs-ticket"><span class="qs-ticket__num">${questionCount}</span><span class="qs-ticket__label">${questionCount === 1 ? 'question' : 'questions'}</span></div>
                    <div class="qs-ticket"><span class="qs-ticket__num">${contestants.length}</span><span class="qs-ticket__label">${contestants.length === 1 ? 'hero on stage' : 'heroes on stage'}</span></div>
                    ${absentCount > 0 ? `<div class="qs-ticket qs-ticket--muted"><span class="qs-ticket__num">${absentCount}</span><span class="qs-ticket__label">absent today</span></div>` : ''}
                </div>
                ${quizMixHtml(kinds)}
                ${cast ? `<ul class="qs-cast" aria-label="Heroes in the spotlight pool">${cast}</ul>` : ''}
                ${resume ? '' : `
                <ol class="qs-rules">
                    <li><span class="qs-rules__icon"><i class="fas fa-lightbulb"></i></span><span>The spotlight picks a hero for each question.</span></li>
                    <li><span class="qs-rules__icon"><i class="fas fa-people-arrows"></i></span><span>A wrong answer passes the question to someone new.</span></li>
                    <li><span class="qs-rules__icon"><i class="fas fa-star"></i></span><span>Right first time: 1 star. Rescue a passed question: ½ star.</span></li>
                    <li><span class="qs-rules__icon"><i class="fas fa-crown"></i></span><span>The Quiz Champion wins a treasure from the Mystic Market.</span></li>
                </ol>`}
            </section>
        </div>
        <footer class="qs-foot">
            <span class="qs-keys" aria-hidden="true"><kbd>Enter</kbd> to ${resume ? 'carry on' : 'start'}</span>
            <button type="button" class="qs-btn qs-btn--go" id="quiz-begin-btn">
                <i class="fas ${resume ? 'fa-play' : 'fa-wand-magic-sparkles'}"></i>
                <span>${resume ? 'Resume the show' : 'Raise the curtain'}</span>
            </button>
        </footer>`;
}

// ─── A turn: one hero, one question ─────────────────────────────────────────

/** The answer gems. Picture answers show their picture; their names appear once the question is over. */
function answersHtml(question, kind, tried) {
    const options = (question?.options || []).slice(0, 4);
    const pictures = kind === 'picture' && Array.isArray(question.optionImages) ? question.optionImages : null;
    return options.map((option, i) => {
        const isTried = tried.has(i);
        const common = `class="qs-answer${pictures ? ' qs-answer--picture' : ''}${isTried ? ' is-tried' : ''}" data-gem="${GEMS[i]}" data-answer-index="${i}" data-answer-text="${esc(option)}"${isTried ? ' disabled aria-disabled="true"' : ''} style="--i:${i}"`;
        if (pictures) {
            return `
            <button type="button" ${common} aria-label="Picture ${GEM_LETTERS[i]}">
                <span class="qs-answer__pic"><img src="${esc(pictures[i] || '')}" alt="" decoding="async" draggable="false"></span>
                <span class="qs-answer__gem" aria-hidden="true">${GEM_LETTERS[i]}</span>
                <span class="qs-answer__name">${esc(option)}</span>
                <span class="qs-answer__mark" aria-hidden="true"></span>
                <kbd class="qs-answer__key" aria-hidden="true">${i + 1}</kbd>
            </button>`;
        }
        return `
            <button type="button" ${common}>
                <span class="qs-answer__gem" aria-hidden="true">${GEM_LETTERS[i]}</span>
                <span class="qs-answer__text">${esc(option)}</span>
                <span class="qs-answer__mark" aria-hidden="true"></span>
                <kbd class="qs-answer__key" aria-hidden="true">${i + 1}</kbd>
            </button>`;
    }).join('');
}

/** The cue card: what the class reads (and, for Listen and choose, the button that speaks). */
function cueHtml(question, kind, { questionNumber, total, passed, attemptNumber }) {
    const info = QUIZ_KIND_INFO[kind];
    const ribbon = kind === 'choice' ? '' : `<span class="qs-kind qs-kind--${kind}"><i class="fas ${info.icon}" aria-hidden="true"></i>${esc(info.label)}</span>`;
    const tag = `<span class="qs-cue__tag">Question ${questionNumber} of ${total}${passed ? ` · ${ordinal(attemptNumber)} try` : ''}</span>`;
    const text = `<p class="qs-cue__text" data-quiz-question-text>${esc(question?.question || '')}</p>`;
    if (kind === 'listen') {
        return `
            <section class="qs-cue qs-cue--listen">
                ${tag}${ribbon}
                <div class="qs-listen-row">
                    <button type="button" class="qs-listen" id="quiz-listen-btn" title="Hear it again (L)" aria-label="Hear it again">
                        <span class="qs-listen__ring" aria-hidden="true"></span>
                        <span class="qs-listen__ring qs-listen__ring--2" aria-hidden="true"></span>
                        <span class="qs-listen__icon" aria-hidden="true"><i class="fas fa-volume-high"></i></span>
                    </button>
                    ${text}
                </div>
                <p class="qs-heard hidden" data-quiz-heard><span>You heard</span>“${esc(question.listen || '')}”</p>
                <p class="qs-listen-help hidden" data-quiz-listen-help role="status"></p>
            </section>`;
    }
    if (kind === 'fix') {
        return `
            <section class="qs-cue qs-cue--fix">
                ${tag}${ribbon}
                ${question.broken ? `<p class="qs-fix"><span class="qs-fix__crack" aria-hidden="true"><i class="fas fa-heart-crack"></i></span><span class="qs-fix__broken">${esc(question.broken)}</span></p>` : ''}
                ${text}
            </section>`;
    }
    return `
            <section class="qs-cue${kind === 'picture' ? ' qs-cue--picture' : ''}">
                ${tag}${ribbon}
                ${text}
            </section>`;
}

/**
 * @param {{ question:{question:string, options:string[], kind?:string, listen?:string, optionImages?:string[], broken?:string},
 *           questionNumber:number, total:number, attemptNumber?:number,
 *           student:{name,avatar}|null, stars?:number, trail?:string[], firstTryCount?:number, triedIndexes?:number[], rolling?:boolean }} data
 */
export function quizTurnHtml({
    question, questionNumber = 1, total = 1, attemptNumber = 1, student = null, stars = 0,
    trail = [], firstTryCount = 0, triedIndexes = [], rolling = false
} = {}) {
    const tried = new Set(triedIndexes);
    const passed = attemptNumber > 1;
    const kind = questionKind(question);
    const longSentences = (question?.options || []).some((option) => String(option).length > (kind === 'fix' ? 30 : 34));
    const answersClass = kind === 'picture' && Array.isArray(question.optionImages) ? ' qs-answers--pictures' : longSentences ? ' qs-answers--sentences' : '';

    const middle = `
        ${trailHtml(trail, total, questionNumber - 1)}
        <span class="qs-score" title="Answered right on the first try"><i class="fas fa-star"></i><strong>${firstTryCount}</strong><span>first try</span></span>`;

    return `
        ${topBarHtml({ middle, pause: true })}
        <div class="qs-body qs-body--turn" data-kind="${kind}">
            <section class="qs-podium${rolling ? ' is-rolling' : ' is-landed'}${passed ? ' is-passed' : ''}" aria-live="polite">
                <span class="qs-podium__beam" aria-hidden="true"></span>
                <span class="qs-podium__ring">
                    ${quizAvatarHtml(rolling ? null : student, 'qs-podium__avatar')}
                </span>
                <span class="qs-podium__copy">
                    <span class="qs-podium__call">${rolling ? 'The spotlight is choosing…' : passed ? 'The question passes to' : 'In the spotlight'}</span>
                    <strong class="qs-podium__name" data-quiz-contestant>${rolling ? '…' : esc(student?.name || 'Hero')}</strong>
                </span>
                <span class="qs-podium__stars" title="Stars so far"><i class="fas fa-star"></i>${Number(stars) || 0}</span>
            </section>
            ${cueHtml(question, kind, { questionNumber, total, passed, attemptNumber })}
            <div class="qs-answers${answersClass}" role="group" aria-label="Answers">${answersHtml(question, kind, tried)}</div>
            <div id="quiz-explanation-area" class="qs-verdict hidden" role="status"></div>
        </div>
        <footer class="qs-foot">
            <button type="button" class="qs-btn qs-btn--quiet" id="quiz-skip-btn"><i class="fas fa-forward"></i><span>Skip question</span></button>
            <span class="qs-keys" aria-hidden="true"><kbd>1</kbd>–<kbd>4</kbd> answer${kind === 'listen' ? ' · <kbd>L</kbd> hear again' : ''}</span>
            <button type="button" class="qs-btn qs-btn--go hidden" id="quiz-next-btn"><i class="fas fa-arrow-right"></i><span>Next question</span></button>
        </footer>`;
}

/** The verdict under the answers once a hero has answered. */
export function quizVerdictHtml({ kind, attemptNumber = 1, correctLetter = '', correctAnswer = '', explanation = '' }) {
    if (kind === 'correct') {
        return `
            <span class="qs-verdict__icon"><i class="fas ${attemptNumber === 1 ? 'fa-star' : 'fa-check'}"></i></span>
            <span class="qs-verdict__copy">
                <strong>${attemptNumber === 1 ? 'Correct, first try!' : 'Correct! Well rescued.'}</strong>
                ${explanation ? `<span>${esc(explanation)}</span>` : ''}
            </span>`;
    }
    if (kind === 'pass') {
        return `
            <span class="qs-verdict__icon"><i class="fas fa-people-arrows"></i></span>
            <span class="qs-verdict__copy">
                <strong>Not quite!</strong>
                <span>That answer is out. The question passes to another hero.</span>
            </span>`;
    }
    return `
        <span class="qs-verdict__icon"><i class="fas fa-lightbulb"></i></span>
        <span class="qs-verdict__copy">
            <strong>Nobody cracked this one.</strong>
            <span>The answer was <b>${esc(correctLetter)}: ${esc(correctAnswer)}</b>.${explanation ? ` ${esc(explanation)}` : ''}</span>
        </span>`;
}

/** In-stage "pause?" card shown over a running quiz. */
export function quizPauseCardHtml() {
    return `
        <div class="qs-pause" id="quiz-pause-card" role="alertdialog" aria-labelledby="qs-pause-title">
            <div class="qs-pause__card">
                <span class="qs-pause__icon"><i class="fas fa-pause"></i></span>
                <h3 id="qs-pause-title">Pause the show?</h3>
                <p>Open the quiz again from Home to carry on where you stopped. Reloading the page starts it over.</p>
                <div class="qs-pause__actions">
                    <button type="button" class="qs-btn qs-btn--quiet" id="quiz-pause-stay">Keep playing</button>
                    <button type="button" class="qs-btn qs-btn--go" id="quiz-pause-leave"><i class="fas fa-pause"></i><span>Pause quiz</span></button>
                </div>
            </div>
        </div>`;
}

// ─── Results: the curtain call ──────────────────────────────────────────────

export function quizTallyHtml() {
    return `
        ${topBarHtml({ sub: 'Curtain call' })}
        <div class="qs-body qs-body--tally">
            <div class="qs-tally">
                <span class="qs-tally__drum" aria-hidden="true"><i class="fas fa-drum"></i></span>
                <p>The judges are tallying the scores…</p>
            </div>
        </div>`;
}

function accuracyRingHtml(pct) {
    const r = 34;
    const c = 2 * Math.PI * r;
    const offset = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
    return `
        <svg class="qs-ring" viewBox="0 0 80 80" aria-hidden="true">
            <circle class="qs-ring__track" cx="40" cy="40" r="${r}"/>
            <circle class="qs-ring__fill" cx="40" cy="40" r="${r}" style="--ring-c:${c.toFixed(1)};--ring-offset:${offset.toFixed(1)}"/>
        </svg>`;
}

const fmt = (n) => {
    const num = Number(n) || 0;
    return Number.isInteger(num) ? String(num) : String(Math.round(num * 100) / 100);
};

/**
 * Full curtain-call markup. Sections stagger in with CSS (--i); `replay` marks a finished week's quiz reopened.
 */
export function quizResultsHtml(results = {}, { replay = false } = {}) {
    const rewards = results.rewards || {};
    const pct = Number(results.firstTryCorrectPct) || 0;
    const tier = QUIZ_TIERS[rewards.tier || results.tier] ? (rewards.tier || results.tier) : computeQuizTier(pct);
    const tierInfo = QUIZ_TIERS[tier];
    const heroes = rewards.correctStudentDetails || [];
    const guilds = rewards.guildDetails || [];
    const artifacts = rewards.awardedArtifacts || [];
    const stats = Array.isArray(results.questionStats) ? results.questionStats : [];
    const starsGranted = (rewards.studentRewards || []).reduce((sum, reward) => sum + (Number(reward.stars) || 0), 0);
    const total = Number(results.totalQuestions) || stats.length || 0;
    const firstTry = Number(results.correctFirstTry) || 0;
    let step = 0;
    const next = () => step++;

    const statsHtml = `
        <div class="qs-scoreboard" style="--i:${next()}">
            <div class="qs-stat qs-stat--ring">
                <span class="qs-ring-wrap">
                    ${accuracyRingHtml(pct)}
                    <span class="qs-stat__value"><span data-count-to="${pct}">${pct}</span><small>%</small></span>
                </span>
                <span class="qs-stat__label">first-try accuracy</span>
            </div>
            <div class="qs-stat"><span class="qs-stat__value"><span data-count-to="${firstTry}">${firstTry}</span><small>/${total}</small></span><span class="qs-stat__label">right first time</span></div>
            <div class="qs-stat"><span class="qs-stat__value"><i class="fas fa-star"></i><span data-count-to="${fmt(starsGranted)}">${fmt(starsGranted)}</span></span><span class="qs-stat__label">stars granted</span></div>
            ${rewards.questBonus ? `<div class="qs-stat"><span class="qs-stat__value">+<span data-count-to="${fmt(rewards.questBonus)}">${fmt(rewards.questBonus)}</span></span><span class="qs-stat__label">Team Quest bonus</span></div>` : ''}
        </div>`;

    // Older quizzes stored a random artifact; newer ones one champion prize from the Market.
    const prize = rewards.prize || null;
    const prizeFor = new Map(artifacts.map((award) => [award.studentId, award.artifact]));
    if (prize?.kind === 'treasure') prizeFor.set(prize.studentId, prize.item);
    const heroMeta = (hero) => {
        if (hero.brave) return 'Brave try';
        const parts = [];
        if (hero.firstTry) parts.push(`${hero.firstTry} first try`);
        if (hero.rescues) parts.push(plural(hero.rescues, 'rescue'));
        return parts.length ? parts.join(' · ') : plural(hero.correctCount || 0, 'right answer');
    };
    const heroesHtml = heroes.length ? `
        <section class="qs-section" style="--i:${next()}">
            <h4 class="qs-section__title"><i class="fas fa-medal"></i> Stars of the show</h4>
            <ul class="qs-heroes">
                ${heroes.map((hero, i) => {
                    const won = prizeFor.get(hero.id);
                    const champion = prize?.studentId === hero.id;
                    return `
                    <li class="qs-hero${champion ? ' is-champion' : ''}" style="--j:${i}">
                        ${quizAvatarHtml(hero, 'qs-hero__avatar')}
                        <span class="qs-hero__copy">
                            <span class="qs-hero__line">
                                <strong class="qs-hero__name">${champion ? '<i class="fas fa-crown" aria-hidden="true"></i> ' : ''}${esc(hero.name || 'Hero')}</strong>
                                <span class="qs-hero__meta">${esc(heroMeta(hero))}</span>
                            </span>
                            <span class="qs-hero__loot">
                                ${(hero.awardedStars || 0) > 0 ? `<span class="qs-loot qs-loot--star">+${fmt(hero.awardedStars)} <i class="fas fa-star"></i></span>` : ''}
                                ${(hero.awardedGold || 0) > 0 ? `<span class="qs-loot qs-loot--gold">+${fmt(hero.awardedGold)} <i class="fas fa-coins"></i></span>` : ''}
                                ${won ? `<span class="qs-loot qs-loot--relic" title="${esc(won.name || 'Treasure')}">${won.icon ? esc(won.icon) : '🎁'} ${esc(won.name || '')}</span>` : ''}
                                ${champion && prize.kind === 'gold' ? `<span class="qs-loot qs-loot--gold">+${fmt(prize.gold)} <i class="fas fa-coins"></i> prize</span>` : ''}
                            </span>
                        </span>
                    </li>`;
                }).join('')}
            </ul>
        </section>` : '';

    const maxGlory = Math.max(1, ...guilds.map((guild) => Number(guild.glory) || 0));
    const guildsHtml = guilds.length ? `
        <section class="qs-section" style="--i:${next()}">
            <h4 class="qs-section__title"><i class="fas fa-shield-halved"></i> Glory for the guilds</h4>
            <ul class="qs-guilds">
                ${guilds.map((guild, i) => `
                    <li class="qs-guild" style="--guild:${esc(guild.primary || '#fbbf24')};--j:${i};--share:${Math.round(((Number(guild.glory) || 0) / maxGlory) * 100)}%">
                        <span class="qs-guild__emoji" aria-hidden="true">${esc(guild.emoji || '⚜️')}</span>
                        <span class="qs-guild__copy">
                            <strong>${esc(guild.name)}</strong>
                            ${(guild.contributors || []).length ? `<span>${guild.contributors.slice(0, 4).map((c) => esc(c.name)).join(', ')}</span>` : ''}
                        </span>
                        <span class="qs-guild__bar" aria-hidden="true"><span></span></span>
                        <span class="qs-guild__glory">+${fmt(guild.glory)} Glory</span>
                    </li>`).join('')}
            </ul>
        </section>` : '';

    const championName = (id) => esc(heroes.find((h) => h.id === id)?.name || 'a hero');
    const prizeHtml = prize ? `
        <section class="qs-section" style="--i:${next()}">
            <h4 class="qs-section__title"><i class="fas fa-crown"></i> Quiz Champion</h4>
            <ul class="qs-relics">
                <li class="qs-relic">
                    <span class="qs-relic__icon" aria-hidden="true">${prize.kind === 'treasure' && prize.item?.image
                        ? `<img src="${esc(prize.item.image)}" alt="">`
                        : (prize.kind === 'treasure' ? esc(prize.item?.icon || '🎁') : '🪙')}</span>
                    <span class="qs-relic__copy">
                        <strong>${championName(prize.studentId)} wins ${prize.kind === 'treasure' ? esc(prize.item?.name || 'a treasure') : `${fmt(prize.gold)} Gold`}</strong>
                        <span>${prize.kind === 'treasure'
                            ? `A gift from the Mystic Market stall${prize.item?.description ? ` · ${esc(prize.item.description)}` : ''}`
                            : 'The Mystic Market stall was empty, so the prize is paid in Gold.'}</span>
                    </span>
                </li>
            </ul>
        </section>` : artifacts.length ? `
        <section class="qs-section" style="--i:${next()}">
            <h4 class="qs-section__title"><i class="fas fa-gift"></i> Treasure from the stage</h4>
            <ul class="qs-relics">
                ${artifacts.map((award) => `
                    <li class="qs-relic">
                        <span class="qs-relic__icon" aria-hidden="true">${esc(award.artifact?.icon || '🎁')}</span>
                        <span class="qs-relic__copy">
                            <strong>${esc(award.artifact?.name || 'Artifact')}</strong>
                            <span>for ${championName(award.studentId)}</span>
                        </span>
                    </li>`).join('')}
            </ul>
        </section>` : '';

    const recapHtml = stats.length ? `
        <section class="qs-section qs-section--recap" style="--i:${next()}">
            <h4 class="qs-section__title"><i class="fas fa-list-check"></i> Question recap</h4>
            <ol class="qs-recap">
                ${stats.map((stat, i) => {
                    const outcome = !stat.asked ? 'skipped' : stat.firstTryCorrect ? 'first' : stat.solved ? 'late' : 'missed';
                    const letter = GEM_LETTERS[Number(stat.correctIndex)] || '';
                    const note = { first: 'First try', late: 'Solved after a pass', missed: 'Nobody solved it', skipped: 'Skipped' }[outcome];
                    const kind = questionKind(stat);
                    const picture = kind === 'picture' && Array.isArray(stat.optionImages) ? stat.optionImages[Number(stat.correctIndex)] : '';
                    const prompt = kind === 'listen' && stat.listen ? `“${stat.listen}”` : stat.question;
                    return `
                    <li class="qs-recap__row is-${outcome}">
                        <span class="qs-recap__num">${i + 1}</span>
                        <span class="qs-recap__copy">
                            <span class="qs-recap__q">${kind !== 'choice' ? `<i class="fas ${QUIZ_KIND_INFO[kind].icon} qs-recap__kind" title="${esc(QUIZ_KIND_INFO[kind].label)}" aria-label="${esc(QUIZ_KIND_INFO[kind].label)}"></i>` : ''}${esc(prompt)}</span>
                            <span class="qs-recap__a">${picture ? `<img class="qs-recap__pic" src="${esc(picture)}" alt="" loading="lazy" decoding="async">` : ''}${letter ? `<b>${letter}</b> ` : ''}${esc(stat.correctAnswer)}</span>
                        </span>
                        <span class="qs-recap__note">${note}</span>
                    </li>`;
                }).join('')}
            </ol>
            ${stats.some((stat) => !stat.firstTryCorrect) ? '<p class="qs-recap__hint"><i class="fas fa-rotate"></i> Questions the class missed can come back next week: turn on "Bring back questions they missed" in Settings › Quiz.</p>' : ''}
        </section>` : '';

    const emptyHtml = !heroes.length && !guilds.length ? `
        <p class="qs-section qs-empty" style="--i:${next()}">Nobody landed an answer this time. Every try still counts, and next week brings a new show.</p>` : '';

    return `
        ${topBarHtml({ sub: replay ? "This week's show" : 'Curtain call' })}
        <div class="qs-body qs-body--results" id="quiz-results-stage">
            <section class="qs-crest tier-${tier}" style="--i:${next()}">
                <span class="qs-crest__rays" aria-hidden="true"></span>
                <span class="qs-crest__medal" aria-hidden="true"><i class="fas ${tierInfo.icon}"></i></span>
                <span class="qs-crest__copy">
                    <span class="qs-crest__kicker">${replay ? 'This week the class earned' : 'Today the class earned'}</span>
                    <strong class="qs-crest__tier">${tierInfo.label}</strong>
                    <span class="qs-crest__tagline">${tierInfo.tagline}</span>
                </span>
            </section>
            ${statsHtml}
            ${heroesHtml}
            ${guildsHtml}
            ${prizeHtml}
            ${emptyHtml}
            ${recapHtml}
        </div>
        <footer class="qs-foot">
            <span class="qs-keys" aria-hidden="true">${replay ? '' : 'Rewards are already in the heroes’ pockets.'}</span>
            <button type="button" class="qs-btn qs-btn--go" id="quiz-finish-btn"><i class="fas fa-flag-checkered"></i><span>${replay ? 'Close' : 'Finish the show'}</span></button>
        </footer>`;
}

// ─── Home launcher ──────────────────────────────────────────────────────────

export function quizLaunchButtonHtml({ completed = false, questionCount = 0 } = {}) {
    const sub = completed ? 'See the results' : questionCount ? `${questionCount} questions · Play` : 'Play now';
    return `
        <div class="quiz-week-btn-wrap">
            <button type="button" class="quiz-week-btn${completed ? ' quiz-btn-completed' : ''}" id="quiz-week-trigger-btn" title="${completed ? 'See this week’s quiz results' : 'Start the Quiz of the Week'}">
                <span class="quiz-week-btn__gem" aria-hidden="true"><i class="fas ${completed ? 'fa-check' : 'fa-question'}"></i></span>
                <span class="quiz-week-btn__copy">
                    <span class="quiz-week-btn__kicker">Quiz of the Week</span>
                    <span class="quiz-week-btn__title">${sub}</span>
                </span>
            </button>
        </div>`;
}
