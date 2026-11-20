// features/parent/progress.js — how a child is growing: stars by month, results, attendance
import { normalizeHeroClass } from '../heroClassNames.mjs';
import * as state from '../../state.js';
import { getGuildById } from '../guilds.js';
import {
    escapeHtml,
    getSnapshot,
    firstName,
    shortDate,
    monthShort,
    heroClassMeta,
    snapshotAssessmentUses,
    tr,
    isGreek
} from './helpers.js';
import { countWord, STAR_WORDS, LESSON_WORDS, bi, gameName, gameNameHtml } from './i18n.js';
import { renderTreasures } from './treasures.js';
import { GOLD_COIN_HTML } from '../../utils/goldCoin.js';
import { HERO_SKILL_TREE } from '../heroSkillTree.js';
import { JAR_SKILLS, jarSkillOf, miniStar, skillName, skillStarDefs } from './starJar.js';

const VISIBLE_RESULTS = 5;

function formatStars(value) {
    const n = Number(value || 0);
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonthKey(key) {
    const [y, m] = key.split('-').map(Number);
    return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/**
 * This school year's finished months, oldest first. The server lists every month since
 * September (0 when no stars were earned); an older summary may skip quiet months, so gaps
 * between two known months are filled with 0 here.
 */
function schoolYearMonths(snapshot) {
    const now = new Date();
    const yearStart = `${now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1}-09`;
    const thisMonth = currentMonthKey();
    const known = new Map();
    (Array.isArray(snapshot.starsHistory) ? snapshot.starsHistory : []).forEach((item) => {
        const key = String(item?.month || '');
        if (/^\d{4}-\d{2}$/.test(key) && key >= yearStart && key < thisMonth) known.set(key, Number(item.stars || 0));
    });
    const keys = [...known.keys()].sort();
    if (!keys.length) return [];
    const months = [];
    for (let key = keys[0]; key <= keys[keys.length - 1]; key = nextMonthKey(key)) {
        const month = Number(key.slice(5));
        if ((month === 7 || month === 8) && !known.has(key)) continue;
        months.push({ month: key, stars: known.get(key) || 0 });
    }
    return months;
}

/** Every month of the school year so far, as pencil marks on a doorframe. */
function renderGrowthChart(snapshot, name) {
    const history = schoolYearMonths(snapshot);
    const months = [...history, { month: currentMonthKey(), stars: Number(snapshot.progress?.monthlyStars || 0), current: true }];
    const max = Math.max(10, ...months.map((item) => Number(item.stars || 0)));
    const best = history.reduce((top, item) => (item.stars > (top?.stars || 0) ? item : top), null);
    const monthName = (key) => monthShort(`${key}-01`);
    // The average of the finished months, drawn as a dashed pencil line across the chart.
    const average = history.length >= 2 ? history.reduce((a, item) => a + Number(item.stars || 0), 0) / history.length : null;
    const avgLine = average !== null && average > 0 ? ` style="--avg:${Math.round((average / max) * 100)}%"` : '';
    // Newest on the right; with many months the row scrolls and opens on this month.
    const wide = months.length > 6;
    return `
        <article class="fp-card fp-growth fp-rise" style="--fp-delay:1">
            <div class="fp-card__row">
                <div>
                    <p class="fp-kicker">${tr('Growing tall', 'Μεγαλώνει')}</p>
                    <h3 class="fp-card__title">${isGreek() ? 'Αστέρια, μήνα με τον μήνα' : `${escapeHtml(name)}'s stars, month by month`}</h3>
                </div>
            </div>
            <div class="fp-doorframe${wide ? ' fp-doorframe--wide' : ''}${avgLine ? ' has-avg' : ''}"${avgLine} role="img" aria-label="${months.map((m) => `${monthName(m.month)}: ${countWord(m.stars, STAR_WORDS, formatStars)}`).join(', ')}">
                ${months.slice().reverse().map((item, index) => {
                    const height = Math.max(4, Math.round((Number(item.stars || 0) / max) * 100));
                    return `
                        <div class="fp-doorframe__col${item.current ? ' is-current' : ''}${best && item.month === best.month ? ' is-best' : ''}" style="--h:${height}%;--i:${months.length - 1 - index}">
                            <div class="fp-doorframe__track">
                                <span class="fp-doorframe__mark"><span class="fp-doorframe__value">${formatStars(item.stars)}</span></span>
                            </div>
                            <span class="fp-doorframe__month">${escapeHtml(monthName(item.month))}${item.current ? `<em>${tr('so far', 'ως τώρα')}</em>` : ''}</span>
                        </div>`;
                }).join('')}
            </div>
            ${history.length
                ? (best && best.stars > 0
                    ? `<div class="fp-growth__foot">
                        <span class="fp-growth__chip fp-growth__chip--best"><i class="fas fa-crown" aria-hidden="true"></i> ${escapeHtml(tr(`Best: ${monthName(best.month)}, ${countWord(best.stars, STAR_WORDS, formatStars)}`, `Καλύτερος: ${monthName(best.month)}, ${countWord(best.stars, STAR_WORDS, formatStars)}`))}</span>
                        ${avgLine ? `<span class="fp-growth__chip fp-growth__chip--avg"><span class="fp-growth__dash" aria-hidden="true"></span> ${escapeHtml(tr(`Monthly average ${formatStars(Math.round(average * 10) / 10)}`, `Μέσος όρος μήνα ${formatStars(Math.round(average * 10) / 10)}`))}</span>` : ''}
                        ${wide ? `<span class="fp-growth__swipe"><i class="fas fa-hand-pointer" aria-hidden="true"></i> ${escapeHtml(tr('Swipe for earlier months', 'Σύρετε για προηγούμενους μήνες'))}</span>` : ''}
                    </div>`
                    : '')
                : `<p class="fp-card__foot">${tr('Each month of the school year gets its own mark here, like a height chart on the kitchen door.', 'Κάθε μήνας της σχολικής χρονιάς παίρνει εδώ το δικό του σημάδι, σαν τις γραμμές ύψους στην πόρτα της κουζίνας.')}</p>`}
        </article>`;
}

function toneForPercent(percent) {
    if (percent === null || percent === undefined) return 'neutral';
    if (percent >= 85) return 'sage';
    if (percent >= 65) return 'amber';
    return 'rose';
}

function typeLabel(type) {
    if (type === 'dictation') return tr('Dictation', 'Ορθογραφία');
    if (type === 'test') return tr('Test', 'Διαγώνισμα');
    return tr('Result', 'Αποτέλεσμα');
}

function renderResults(snapshot) {
    const uses = snapshotAssessmentUses(snapshot);
    if (!uses.any) {
        return `<p class="fp-tip fp-rise" style="--fp-delay:2"><i class="fas fa-circle-info" aria-hidden="true"></i> ${tr('This class does not record tests or dictations, so progress is told through stars and attendance.', 'Αυτό το τμήμα δεν καταγράφει διαγωνίσματα ή ορθογραφίες, οπότε η πρόοδος φαίνεται από τα αστέρια και τις παρουσίες.')}</p>`;
    }
    const history = Array.isArray(snapshot.gradeHistory) ? snapshot.gradeHistory : [];
    const showAll = state.get('parentView')?.showAllResults === true;
    const visible = showAll ? history : history.slice(0, VISIBLE_RESULTS);
    const average = Number.isFinite(Number(snapshot.gradeAveragePercent)) && snapshot.gradeAveragePercent !== null
        ? Number(snapshot.gradeAveragePercent)
        : null;
    return `
        <article class="fp-card fp-report fp-rise" style="--fp-delay:2">
            <div class="fp-card__row">
                <div>
                    <p class="fp-kicker">${tr('Report card', 'Βαθμολογίες')}</p>
                    <h3 class="fp-card__title">${uses.tests && uses.dictations ? tr('Recent tests and dictations', 'Πρόσφατα διαγωνίσματα και ορθογραφίες') : uses.tests ? tr('Recent tests', 'Πρόσφατα διαγωνίσματα') : tr('Recent dictations', 'Πρόσφατες ορθογραφίες')}</h3>
                </div>
                ${average !== null ? `
                    <span class="fp-ring fp-ring--${toneForPercent(average)}" style="--p:${average}" role="img" aria-label="${tr('Average', 'Μέσος όρος')} ${average}%">
                        <span class="fp-ring__value">${average}<small>%</small></span>
                        <span class="fp-ring__label">${tr('average', 'μ.ό.')}</span>
                    </span>` : ''}
            </div>
            ${history.length ? `<div class="fp-report__glance">
                ${(typeAverages(history).length > 1 ? typeAverages(history) : []).map((avg) => `<span class="fp-report__avg fp-report__avg--${avg.type}"><span>${escapeHtml(avg.type === 'test' ? tr('Tests', 'Διαγωνίσματα') : tr('Dictations', 'Ορθογραφίες'))}</span><b>${avg.value}%</b></span>`).join('')}
                ${resultsTrend(history)}
            </div>` : ''}
            ${visible.length ? `
                <ul class="fp-results">
                    ${visible.map((item) => {
                        const percent = Number.isFinite(Number(item.percent)) && item.percent !== null ? Number(item.percent) : null;
                        const title = item.type === 'dictation' && (!item.title || item.title === 'dictation') ? typeLabel('dictation') : (item.title || typeLabel(item.type));
                        return `
                            <li class="fp-result">
                                <span class="fp-result__type fp-result__type--${escapeHtml(item.type || 'other')}">${escapeHtml(typeLabel(item.type))}</span>
                                <span class="fp-result__copy">
                                    <span class="fp-result__title">${escapeHtml(title)}</span>
                                    <span class="fp-result__date">${escapeHtml(shortDate(item.date))}</span>
                                </span>
                                <span class="fp-result__score fp-result__score--${toneForPercent(percent)}"${item.scoreLabel === '?' ? ` title="${escapeHtml(tr('Could not be marked', 'Δεν μπόρεσε να βαθμολογηθεί'))}"` : ''}>${escapeHtml(item.scoreLabel || '—')}</span>
                                ${percent !== null ? `<span class="fp-result__bar" aria-hidden="true"><span style="width:${Math.max(3, percent)}%"></span></span>` : ''}
                            </li>`;
                    }).join('')}
                </ul>
                ${history.length > VISIBLE_RESULTS ? `
                    <button type="button" class="fp-link" data-parent-toggle-results>
                        ${showAll ? tr('Show fewer', 'Λιγότερα') : tr(`Show all ${history.length}`, `Όλα (${history.length})`)} <i class="fas fa-chevron-${showAll ? 'up' : 'down'}" aria-hidden="true"></i>
                    </button>` : ''}` : `<p class="fp-empty-line">${tr('Results appear here once the teacher records them.', 'Οι βαθμοί εμφανίζονται εδώ μόλις καταγραφούν.')}</p>`}
        </article>`;
}

function renderAttendance(snapshot, name) {
    const attendance = snapshot.attendanceSummary || {};
    const absences = Number(attendance.absences || 0);
    const dates = Array.isArray(attendance.absenceDates) ? attendance.absenceDates : [];
    return `
        <article class="fp-card fp-attendance fp-rise" style="--fp-delay:3">
            <p class="fp-kicker">${tr('Attendance', 'Παρουσίες')}</p>
            ${absences === 0 ? `
                <div class="fp-attendance__perfect">
                    <span class="fp-bubble fp-bubble--sage fp-bubble--lg"><i class="fas fa-calendar-check" aria-hidden="true"></i></span>
                    <div>
                        <h3 class="fp-card__title">${bi('At every lesson so far', 'Σε όλα τα μαθήματα ως τώρα')}</h3>
                        <p class="fp-card__foot">${isGreek() ? 'Δεν έχει χάσει κανένα μάθημα φέτος.' : `${escapeHtml(name)} has not missed a lesson this year.`}</p>
                    </div>
                </div>` : `
                <h3 class="fp-card__title">${bi(`Missed ${countWord(absences, LESSON_WORDS)} this year`, `Έχασε ${countWord(absences, LESSON_WORDS)} φέτος`)}</h3>
                ${dates.length ? `<div class="fp-date-chips">${dates.map((date) => `<span class="fp-date-chip">${escapeHtml(shortDate(date))}</span>`).join('')}</div>` : ''}
                <p class="fp-card__foot">${isGreek()
                    ? 'Αν πρόκειται να χάσει κάποιο μάθημα, στείλτε ένα <button type="button" class="fp-inline-link" data-parent-compose="absence">σημείωμα απουσίας</button>.'
                    : `If ${escapeHtml(name)} will miss a lesson, send an <button type="button" class="fp-inline-link" data-parent-compose="absence">absence note</button>.`}</p>`}
        </article>`;
}

/** The hero class's own path: level, title and stars to the next title. */
function heroPath(snapshot) {
    const cls = normalizeHeroClass(snapshot.heroClass || '');
    const tree = cls ? HERO_SKILL_TREE[cls] : null;
    if (!tree) return null;
    const level = Math.max(0, Math.min(tree.levels.length, Number(snapshot.progress?.heroLevel || 0)));
    const pathStars = snapshot.progress?.heroPathStars;
    const have = pathStars && typeof pathStars === 'object' ? Number(pathStars[tree.reason]) : NaN;
    const next = tree.levels[level]?.threshold ?? null;
    const prev = level > 0 ? tree.levels[level - 1]?.threshold || 0 : 0;
    return {
        cls,
        tree,
        level,
        max: tree.levels.length,
        title: level > 0 ? tree.titles[level - 1] : null,
        nextTitle: next !== null ? tree.titles[level] : null,
        left: next !== null && Number.isFinite(have) ? Math.max(0, Math.ceil(next - have)) : null,
        percent: next !== null && Number.isFinite(have) ? Math.max(4, Math.min(100, Math.round(((have - prev) / Math.max(1, next - prev)) * 100))) : null
    };
}

function renderHeroCard(snapshot, name) {
    const hero = heroClassMeta(snapshot.heroClass);
    const guild = getGuildById(snapshot.guildId);
    const progress = snapshot.progress || {};
    const path = heroPath(snapshot);
    const aura = path?.tree?.auraColor || '#b5793b';
    const crowns = Number(snapshot.heroOfDayWins || 0);
    const cls = snapshot.heroClass && normalizeHeroClass(snapshot.heroClass);
    // One pip per level; the next one fills as the path's stars come in.
    const pips = path ? Array.from({ length: path.max }, (_, i) => {
        const next = i === path.level && path.percent !== null;
        return `<span class="fp-path__pip${i < path.level ? ' is-on' : ''}${next ? ' is-next' : ''}" style="--i:${i}${next ? `;--fill:${path.percent}%` : ''}"></span>`;
    }).join('') : '';
    return `
        <article class="fp-card fp-game fp-rise" style="--fp-delay:4;--fp-aura:${escapeHtml(aura)}">
            <p class="fp-kicker">${tr('In the class game', 'Στο παιχνίδι της τάξης')}</p>
            <h3 class="fp-card__title">${isGreek() ? 'Ο ήρωας της τάξης' : `${escapeHtml(name)}'s hero`}</h3>
            <div class="fp-game__hero">
                <span class="fp-game__medal" aria-hidden="true"><span class="fp-game__glyph">${hero ? hero.icon : '🌱'}</span></span>
                <div class="fp-game__who">
                    <span class="fp-game__label">${tr('Hero class', 'Ρόλος ήρωα')}</span>
                    <span class="fp-game__class">${cls ? gameNameHtml(cls, escapeHtml) : escapeHtml(tr('Not chosen yet', 'Δεν έχει επιλεγεί'))}</span>
                    ${hero ? `<span class="fp-game__gift"><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>${escapeHtml(hero.gift)}</span>` : ''}
                </div>
            </div>
            ${path ? `
                <div class="fp-path">
                    <div class="fp-path__row">
                        <span class="fp-path__title">${path.title ? gameNameHtml(path.title, escapeHtml) : escapeHtml(tr('Starting out', 'Στην αρχή του δρόμου'))}</span>
                        <span class="fp-path__level">${escapeHtml(tr(`Level ${path.level} of ${path.max}`, `Επίπεδο ${path.level} από ${path.max}`))}</span>
                    </div>
                    <div class="fp-path__pips" aria-hidden="true">${pips}</div>
                    ${path.nextTitle ? `
                        <p class="fp-path__next">${path.left !== null
                            ? (isGreek()
                                ? `Ακόμη <strong>${countWord(path.left, STAR_WORDS)}</strong> στο μονοπάτι του ρόλου για τον τίτλο <strong>${escapeHtml(gameName(path.nextTitle))}</strong>.`
                                : `<strong>${countWord(path.left, STAR_WORDS)}</strong> more on the hero path to become <strong>${escapeHtml(path.nextTitle)}</strong>.`)
                            : (isGreek()
                                ? `Επόμενος τίτλος: <strong>${escapeHtml(gameName(path.nextTitle))}</strong>.`
                                : `Next title: <strong>${escapeHtml(path.nextTitle)}</strong>.`)}</p>`
                        : `<p class="fp-path__next"><i class="fas fa-crown" aria-hidden="true"></i> ${escapeHtml(tr('The top of the hero path!', 'Η κορυφή του μονοπατιού του ήρωα!'))}</p>`}
                </div>` : ''}
            <div class="fp-game__tiles">
                <div class="fp-game__tile fp-game__tile--guild"${guild ? ` style="--fp-g1:${escapeHtml(guild.primary || '#7a5a3a')};--fp-g2:${escapeHtml(guild.secondary || '#b5793b')}"` : ''}>
                    ${guild ? `<img class="fp-game__emblem" src="${escapeHtml(guild.emblem)}" alt="" loading="lazy" decoding="async">` : '<span class="fp-game__emoji" aria-hidden="true">🏰</span>'}
                    <span class="fp-game__tlabel">${tr('Guild', 'Συντεχνία')}</span>
                    <span class="fp-game__tvalue">${guild?.name ? gameNameHtml(guild.name, escapeHtml) : escapeHtml(tr('Not sorted yet', 'Δεν έχει μπει ακόμη'))}</span>
                    ${guild?.motto ? `<span class="fp-game__thint">“${escapeHtml(gameName(guild.motto))}”</span>` : ''}
                </div>
                <div class="fp-game__tile fp-game__tile--gold">
                    <span class="fp-game__coin" aria-hidden="true">${GOLD_COIN_HTML}</span>
                    <span class="fp-game__tlabel">${tr('Gold', 'Χρυσός')}</span>
                    <span class="fp-game__tvalue fp-game__tvalue--big">${formatStars(progress.gold || 0)}</span>
                    <span class="fp-game__thint">${tr('to spend in the class market', 'για την αγορά της τάξης')}</span>
                </div>
                ${crowns > 0 ? `
                    <div class="fp-game__tile fp-game__tile--crown">
                        <span class="fp-game__emoji" aria-hidden="true">👑</span>
                        <span class="fp-game__tlabel">${tr('Hero of the Day', 'Ήρωας της Ημέρας')}</span>
                        <span class="fp-game__tvalue fp-game__tvalue--big">${crowns}<small> ${isGreek() ? (crowns === 1 ? 'φορά' : 'φορές') : (crowns === 1 ? 'time' : 'times')}</small></span>
                        <span class="fp-game__thint">${tr('this school year', 'αυτή τη σχολική χρονιά')}</span>
                    </div>` : ''}
            </div>
            <details class="fp-explain">
                <summary><i class="fas fa-circle-question" aria-hidden="true"></i> ${tr('How the class game works', 'Πώς λειτουργεί το παιχνίδι της τάξης')}</summary>
                <ul>${isGreek() ? `
                    <li><strong>Τα αστέρια</strong> επιβραβεύουν την ομαδικότητα, τη δημιουργικότητα, τον σεβασμό και τη συγκέντρωση στο μάθημα των Αγγλικών. Δεν είναι δεύτερος βαθμός.</li>
                    <li><strong>Τα αστέρια του μήνα</strong> ξεκινούν από την αρχή κάθε μήνα· τα αστέρια της χρονιάς συνεχίζουν να αθροίζονται.</li>
                    <li><strong>Ο ρόλος ήρωα</strong> έχει το δικό του μονοπάτι: με αστέρια στη δεξιότητα του ρόλου ανεβαίνει επίπεδο και παίρνει νέο τίτλο.</li>
                    <li><strong>Η συντεχνία</strong> είναι η ομάδα του παιδιού σας για όλη τη χρονιά. Οι συντεχνίες εμψυχώνουν η μία την άλλη.</li>
                    <li><strong>Ο χρυσός</strong> αγοράζει μικρές ανταμοιβές στην αγορά της τάξης. Κερδίζεται μόνο μέσα στην τάξη και ποτέ δεν αγοράζεται.</li>
                    <li><strong>Το Σακίδιο</strong> φυλάει κάθε θησαυρό που έχει αγοράσει ή κερδίσει. Κάποιοι είναι κειμήλια με μια δύναμη που χρησιμοποιείται μία φορά στην τάξη.</li>
                    <li><strong>Το ζωάκι-σύντροφος</strong> βγαίνει από ένα αυγό. Κάθε αστέρι του παιδιού το μοιράζεται μαζί του, και σε 20, 80, 160, 300 και 500 αστέρια μαζί παίρνει νέα μορφή.</li>` : `
                    <li><strong>Stars</strong> reward teamwork, creativity, respect and focus in English class. They are not a second grade.</li>
                    <li><strong>This month's stars</strong> start again each month; stars for the year keep adding up.</li>
                    <li><strong>The hero class</strong> has its own path: stars in the class's skill raise its level and bring a new title.</li>
                    <li><strong>The guild</strong> is ${escapeHtml(name)}'s team for good. Guilds cheer each other on all year.</li>
                    <li><strong>Gold</strong> buys small rewards in the class market. It is earned in class, never bought.</li>
                    <li><strong>The Satchel</strong> keeps every treasure ${escapeHtml(name)} has bought or won. Some are relics with a one-time power in class.</li>
                    <li><strong>The familiar</strong> hatches from an egg. It shares every star ${escapeHtml(name)} earns and takes a new form at 20, 80, 160, 300 and 500 stars together.</li>`}
                </ul>
            </details>
        </article>`;
}

/** A sky banner with the school year at a glance. */
function renderYearBanner(snapshot, name) {
    const progress = snapshot.progress || {};
    const total = Number(progress.totalStars || 0);
    const month = Number(progress.monthlyStars || 0);
    const history = schoolYearMonths(snapshot);
    const best = history.reduce((top, item) => (item.stars > (top?.stars || 0) ? item : top), null);
    const absences = Number(snapshot.attendanceSummary?.absences || 0);
    const crowns = Number(snapshot.heroOfDayWins || 0);
    const chips = [
        { icon: 'fa-calendar-day', text: tr(`${formatStars(month)} this month`, `${formatStars(month)} αυτόν τον μήνα`) },
        best && best.stars > 0 && best.stars >= month ? { icon: 'fa-crown', text: tr(`Best month: ${monthShort(`${best.month}-01`)}`, `Καλύτερος μήνας: ${monthShort(`${best.month}-01`)}`) } : null,
        crowns > 0 ? { icon: 'fa-chess-king', text: isGreek() ? `Ήρωας της Ημέρας ×${crowns}` : `Hero of the Day ×${crowns}` } : null,
        { icon: absences === 0 ? 'fa-calendar-check' : 'fa-calendar-xmark', text: absences === 0 ? tr('Every lesson so far', 'Σε όλα τα μαθήματα') : tr(`${countWord(absences, LESSON_WORDS)} missed`, `${absences} ${absences === 1 ? 'απουσία' : 'απουσίες'}`) }
    ].filter(Boolean);
    const twinkles = Array.from({ length: 9 }, (_, i) => `<span class="fp-year__twinkle" style="--x:${(i * 37 + 11) % 96}%;--y:${(i * 23 + 7) % 70}%;--d:${(i % 5) * 0.6}s"></span>`).join('');
    return `
        <section class="fp-year fp-rise" style="--fp-delay:0" aria-label="${escapeHtml(tr('The year so far', 'Η χρονιά ως τώρα'))}">
            <div class="fp-year__sky" aria-hidden="true">${twinkles}</div>
            <div class="fp-year__main">
                <span class="fp-year__star" aria-hidden="true"><i class="fas fa-star"></i></span>
                <div>
                    <p class="fp-year__kicker">${isGreek() ? 'Η χρονιά ως τώρα' : `${escapeHtml(name)}'s year so far`}</p>
                    <p class="fp-year__total"><strong>${formatStars(total)}</strong> ${isGreek() ? (total === 1 ? 'αστέρι φέτος' : 'αστέρια φέτος') : (total === 1 ? 'star this year' : 'stars this year')}</p>
                </div>
            </div>
            <ul class="fp-year__chips">${chips.map((chip, i) => `<li style="--i:${i}"><i class="fas ${chip.icon}" aria-hidden="true"></i>${escapeHtml(chip.text)}</li>`).join('')}</ul>
        </section>`;
}

/** This month's stars by soft skill, with the same stars as the jar on Home. */
function renderSkills(snapshot, name) {
    const tally = snapshot.monthReasons;
    if (!tally || typeof tally !== 'object') return '';
    const totals = new Map(JAR_SKILLS.map((skill) => [skill.id, 0]));
    Object.entries(tally).forEach(([reason, value]) => {
        const n = Number(value) || 0;
        if (n > 0 && !['correction', 'wheel_curse', 'marked_present'].includes(reason)) totals.set(jarSkillOf(reason), totals.get(jarSkillOf(reason)) + n);
    });
    const sum = [...totals.values()].reduce((a, b) => a + b, 0);
    if (sum <= 0) return '';
    const max = Math.max(...totals.values());
    const cls = normalizeHeroClass(snapshot.heroClass || '');
    const pathSkill = HERO_SKILL_TREE[cls]?.reason;
    const top = JAR_SKILLS.filter((skill) => skill.id !== 'special').sort((a, b) => totals.get(b.id) - totals.get(a.id))[0];
    const topValue = totals.get(top.id);
    const rows = JAR_SKILLS
        .filter((skill) => skill.id !== 'special' || totals.get('special') > 0)
        .map((skill, i) => {
            const value = Math.round(totals.get(skill.id) * 10) / 10;
            return `
                <li class="fp-skill fp-skill--${skill.id}${value ? '' : ' is-zero'}" style="--i:${i};--w:${max ? Math.max(value ? 6 : 0, Math.round((value / max) * 100)) : 0}%">
                    ${miniStar(skill.id, 'fp-skl', 'fp-skill__star')}
                    <span class="fp-skill__name">${skillName(skill)}${skill.id === pathSkill ? `<span class="fp-skill__tag">${tr('hero path', 'μονοπάτι ρόλου')}</span>` : ''}</span>
                    <b class="fp-skill__count">${formatStars(value)}</b>
                    <span class="fp-skill__bar" aria-hidden="true"><span></span></span>
                </li>`;
        }).join('');
    return `
        <article class="fp-card fp-skills fp-rise" style="--fp-delay:1">
            ${skillStarDefs('fp-skl')}
            <p class="fp-kicker">${tr('This month', 'Αυτόν τον μήνα')}</p>
            <h3 class="fp-card__title">${tr('Stars by skill', 'Αστέρια ανά δεξιότητα')}</h3>
            ${topValue > 0 ? `<p class="fp-skills__lead">${miniStar(top.id, 'fp-skl', 'fp-skills__leadstar')}<span>${isGreek()
                ? `Ξεχωρίζει στην <strong>${escapeHtml(skillName(top).toLocaleLowerCase('el'))}</strong>.`
                : `${escapeHtml(name)} shines at <strong>${escapeHtml(skillName(top).toLowerCase())}</strong>.`}</span></p>` : ''}
            <ul class="fp-skills__list">${rows}</ul>
        </article>`;
}

/** Recent percentages, oldest to newest, as a small hand-drawn line. */
function resultsTrend(history) {
    const points = history.map((item) => (Number.isFinite(Number(item.percent)) && item.percent !== null ? Number(item.percent) : null))
        .filter((value) => value !== null).slice(0, 8).reverse();
    if (points.length < 3) return '';
    const w = 120;
    const h = 34;
    const xy = points.map((p, i) => [Math.round((i * (w - 8)) / (points.length - 1)) + 4, Math.round(h - 4 - (p / 100) * (h - 8))]);
    const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('');
    const last = xy[xy.length - 1];
    return `
        <div class="fp-trend">
            <span class="fp-trend__label">${tr('Recent results', 'Πορεία')}</span>
            <svg class="fp-trend__svg" viewBox="0 0 ${w} ${h}" aria-hidden="true">
                <path class="fp-trend__area" d="${line}L${last[0]} ${h}L${xy[0][0]} ${h}Z"/>
                <path class="fp-trend__line" d="${line}"/>
                ${xy.map(([x, y], i) => `<circle class="fp-trend__dot${i === xy.length - 1 ? ' is-last' : ''}" cx="${x}" cy="${y}" r="${i === xy.length - 1 ? 3.4 : 2.2}"/>`).join('')}
            </svg>
        </div>`;
}

function typeAverages(history) {
    const by = { test: [], dictation: [] };
    history.forEach((item) => {
        const p = Number(item.percent);
        if (item.percent !== null && Number.isFinite(p) && by[item.type]) by[item.type].push(p);
    });
    return Object.entries(by)
        .filter(([, list]) => list.length)
        .map(([type, list]) => ({ type, value: Math.round(list.reduce((a, b) => a + b, 0) / list.length), count: list.length }));
}

export function renderParentProgress() {
    const snapshot = getSnapshot();
    const name = firstName(snapshot.studentName);
    return `
        <header class="fp-pagehead fp-rise">
            <span class="fp-pagehead__icon fp-pagehead__icon--sage" aria-hidden="true"><i class="fas fa-seedling"></i></span>
            <div>
                <h2 class="fp-pagehead__title">${bi('Progress', 'Πρόοδος')}</h2>
                <p class="fp-pagehead__sub">${isGreek() ? 'Πώς προχωρά φέτος.' : `How ${escapeHtml(name)} is growing this year.`}</p>
            </div>
        </header>
        <div class="fp-progress">
            ${renderYearBanner(snapshot, name)}
            ${renderGrowthChart(snapshot, name)}
            ${renderSkills(snapshot, name)}
            ${renderResults(snapshot)}
            ${renderAttendance(snapshot, name)}
            ${renderHeroCard(snapshot, name)}
            ${renderTreasures()}
        </div>`;
}
