// /ui/tabs/leaderboard.js
import * as state from '../../state.js';
import { getLeaderboardEffectiveLeague } from '../../state.js';
import * as utils from '../../utils.js';
import * as modals from '../modals.js';
import { HERO_CLASSES } from '../../features/heroClasses.js';
import { getGuildLeaderboardData, getGuildChampionsForMonth } from '../../features/guildScoring.js';
import { getGuildById, getGuildEmblemUrl, getGuildBadgeHtml } from '../../features/guilds.js';
import { getHeroTitle, HERO_SKILL_TREE } from '../../features/heroSkillTree.js';
import { renderFamiliarSprite } from '../../features/familiars.js';
import { getEggAlertState } from '../../features/familiarProgression.mjs';
import { wrapAvatarWithLevelUpIndicator } from '../core/avatar.js';
import { canUseFeature } from '../../utils/subscription.js';
import { getNormalizedPercentForScore } from '../../features/assessmentConfig.js';
import { getActiveLivingQuestMap, initializeLivingQuestMap, QUEST_MAP_ZONES, renderLeagueMapInto } from '../../features/worldMap.js';
import { getQuestNextStop } from '../../features/teamQuestRace.mjs';
import { renderQuestChroniclesHtml } from './teamQuestChronicles.js';
import { getLiveYearGoldFromAppState } from '../../utils/yearGold.js';
import { getSchoolYearStartMonthDate } from '../../utils/schoolYear.js';
import {
    getAwardLogMonthlyStarCredit,
    mergeMonthlyStarsFromArchivedHistoryAndAwardLogs,
    sumMonthlyStarCreditsByStudentFromAwardLogs
} from '../../features/awardLogReasonMeta.js';
import {
    buildHeroTieStats,
    currentMonthStarsFromScore,
    pickProdigyWinners,
    rankHeroes
} from '../../features/heroRanking.js';
import {
    annotateStandingsChanges,
    buildStandingsSnapshot,
    playStandingsChanges,
    playStandingsEntrance,
    readStandingsSnapshot,
    renderStandingsHeraldHtml,
    renderStandingsSectionHtml,
    writeStandingsSnapshot
} from './heroStandings.js';

const TEAM_QUEST_ANALYTICS_ASSETS = {
    bronze: new URL('../../assets/team-quest-map/living-atlas/badge-bronze.webp', import.meta.url).href,
    silver: new URL('../../assets/team-quest-map/living-atlas/badge-silver.webp', import.meta.url).href,
    gold: new URL('../../assets/team-quest-map/living-atlas/badge-gold.webp', import.meta.url).href,
    crystal: new URL('../../assets/team-quest-map/living-atlas/badge-crystal.webp', import.meta.url).href,
    rankGold: new URL('../../assets/team-quest-map/living-atlas/token-gold.webp', import.meta.url).href,
    rankSilver: new URL('../../assets/team-quest-map/living-atlas/token-silver.webp', import.meta.url).href,
    rankBronze: new URL('../../assets/team-quest-map/living-atlas/token-bronze.webp', import.meta.url).href,
    rankSlate: new URL('../../assets/team-quest-map/living-atlas/token-slate.webp', import.meta.url).href
};

const TEACHER_QUEST_COMPACT_MEDIA = '(max-width: 1023px)';
let teacherQuestCompactMediaListenerBound = false;

function escapeLeaderboardHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function isCompactTeacherQuestViewport() {
    return state.get('currentUserRole') === 'teacher'
        && (
            (typeof document !== 'undefined' && document.body?.classList.contains('gcq-mobile'))
            || (
                typeof window !== 'undefined'
                && typeof window.matchMedia === 'function'
                && window.matchMedia(TEACHER_QUEST_COMPACT_MEDIA).matches
            )
        );
}

function bindTeacherQuestCompactViewportListener() {
    if (teacherQuestCompactMediaListenerBound || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia(TEACHER_QUEST_COMPACT_MEDIA);
    let wasCompact = mediaQuery.matches;
    const handleViewportChange = (event) => {
        if (event.matches === wasCompact) return;
        wasCompact = event.matches;

        const tab = document.getElementById('class-leaderboard-tab');
        if (!tab || tab.classList.contains('hidden') || state.get('currentUserRole') !== 'teacher') return;
        renderClassLeaderboardTab();
    };

    if (typeof mediaQuery.addEventListener === 'function') mediaQuery.addEventListener('change', handleViewportChange);
    else mediaQuery.addListener?.(handleViewportChange);
    teacherQuestCompactMediaListenerBound = true;
}

function formatQuestNumber(value) {
    const number = Number(value) || 0;
    return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function getRaceRankFrame(rank) {
    if (rank === 1) return { asset: TEAM_QUEST_ANALYTICS_ASSETS.rankGold, tier: 'gold' };
    if (rank === 2) return { asset: TEAM_QUEST_ANALYTICS_ASSETS.rankSilver, tier: 'silver' };
    if (rank === 3) return { asset: TEAM_QUEST_ANALYTICS_ASSETS.rankBronze, tier: 'bronze' };
    return { asset: TEAM_QUEST_ANALYTICS_ASSETS.rankSlate, tier: 'slate' };
}

function generateTeacherMobileRaceHtml(classScores, activeClassId = null) {
    const realmKeyHtml = QUEST_MAP_ZONES.map((zone) => `
        <div class="tq-mobile-race__realm tq-mobile-race__realm--${zone.id}">
            <img src="${TEAM_QUEST_ANALYTICS_ASSETS[zone.id]}" alt="" draggable="false" aria-hidden="true">
            <span>${zone.label}</span>
        </div>
    `).join('');

    const raceCardsHtml = classScores.map((classroom, index) => {
        const rank = classroom.rank || index + 1;
        const rankFrame = getRaceRankFrame(rank);
        const progress = Math.min(100, Math.max(0, Number(classroom.progress) || 0));
        const goal = Number(classroom.goals?.diamond) || 0;
        const stars = Number(classroom.currentMonthlyStars) || 0;
        const weeklyStars = Number(classroom.weeklyStars) || 0;
        const zone = QUEST_MAP_ZONES.reduce(
            (current, candidate) => (progress >= candidate.minPercent ? candidate : current),
            QUEST_MAP_ZONES[0]
        );
        const nextMilestone = getQuestNextStop(progress, stars, goal);
        const nextStepText = nextMilestone.complete
            ? 'The portal is open!'
            : `${nextMilestone.starsNeeded} ${nextMilestone.starsNeeded === 1 ? 'star' : 'stars'} to ${nextMilestone.label}`;
        const isMine = Boolean(activeClassId) && classroom.id === activeClassId;
        const pathfinderText = classroom.classQuestBonus > 0
            ? `<span class="tq-mobile-race-card__bonus"><i class="fas fa-compass" aria-hidden="true"></i> +${formatQuestNumber(classroom.classQuestBonus)} Pathfinder</span>`
            : '';

        return `
            <article class="tq-mobile-race-card tq-mobile-race-card--${zone.id}${isMine ? ' is-mine' : ''}" data-chronicle-open="${escapeLeaderboardHtml(classroom.id || '')}" style="--race-progress: ${progress}%; --race-delay: ${Math.min(index * 70, 560)}ms;">
                <header class="tq-mobile-race-card__header">
                    <span class="tq-mobile-race-card__rank tq-mobile-race-card__rank--${rankFrame.tier}" aria-label="League rank ${rank}">
                        <img src="${rankFrame.asset}" alt="" draggable="false" aria-hidden="true">
                        <strong>${rank}</strong>
                    </span>
                    <span class="tq-mobile-race-card__logo" aria-hidden="true">${escapeLeaderboardHtml(classroom.logo || '📚')}</span>
                    <span class="tq-mobile-race-card__identity">
                        <strong>${escapeLeaderboardHtml(classroom.name)}</strong>
                        <span class="tq-mobile-race-card__zone">
                            <img src="${TEAM_QUEST_ANALYTICS_ASSETS[zone.id]}" alt="" draggable="false" aria-hidden="true">
                            ${zone.label}
                        </span>
                    </span>
                    <span class="tq-mobile-race-card__percent">${progress.toFixed(0)}<small>%</small></span>
                </header>

                <div class="tq-mobile-race-card__trail" role="progressbar" aria-label="${escapeLeaderboardHtml(classroom.name)} monthly quest progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.toFixed(1)}">
                    <span class="tq-mobile-race-card__segments" aria-hidden="true">
                        <i class="tq-mobile-race-card__segment tq-mobile-race-card__segment--bronze"></i>
                        <i class="tq-mobile-race-card__segment tq-mobile-race-card__segment--silver"></i>
                        <i class="tq-mobile-race-card__segment tq-mobile-race-card__segment--gold"></i>
                        <i class="tq-mobile-race-card__segment tq-mobile-race-card__segment--crystal"></i>
                    </span>
                    <span class="tq-mobile-race-card__fill" aria-hidden="true"></span>
                    <span class="tq-mobile-race-card__checkpoint tq-mobile-race-card__checkpoint--30" aria-hidden="true"></span>
                    <span class="tq-mobile-race-card__checkpoint tq-mobile-race-card__checkpoint--60" aria-hidden="true"></span>
                    <span class="tq-mobile-race-card__checkpoint tq-mobile-race-card__checkpoint--85" aria-hidden="true"></span>
                    <span class="tq-mobile-race-card__finish" aria-hidden="true"><i class="fas fa-flag-checkered"></i></span>
                    <span class="tq-mobile-race-card__marker" aria-hidden="true">${escapeLeaderboardHtml(classroom.logo || '📚')}</span>
                </div>

                <footer class="tq-mobile-race-card__footer">
                    <span class="tq-mobile-race-card__stars"><i class="fas fa-star" aria-hidden="true"></i><strong>${formatQuestNumber(stars)}</strong><small>/ ${formatQuestNumber(goal)}</small></span>
                    <span class="tq-mobile-race-card__next ${nextMilestone.complete ? 'is-complete' : ''}">${nextStepText}</span>
                    <span class="tq-mobile-race-card__weekly"><i class="fas fa-arrow-trend-up" aria-hidden="true"></i> +${formatQuestNumber(weeklyStars)} this week</span>
                    ${pathfinderText}
                </footer>
            </article>
        `;
    }).join('');

    return `
        <section class="tq-mobile-race" aria-labelledby="tq-mobile-race-title">
            <div class="tq-mobile-race__glow tq-mobile-race__glow--one" aria-hidden="true"></div>
            <div class="tq-mobile-race__glow tq-mobile-race__glow--two" aria-hidden="true"></div>
            <header class="tq-mobile-race__header">
                <span class="tq-mobile-race__crest" aria-hidden="true"><i class="fas fa-route"></i></span>
                <span class="tq-mobile-race__title">
                    <h3 id="tq-mobile-race-title">Monthly Race</h3>
                    <p>${classScores.length} ${classScores.length === 1 ? 'class is' : 'classes are'} on the trail</p>
                </span>
                <button type="button" id="toggle-map-list-btn" class="tq-mobile-race__analysis" aria-controls="league-standings-container" aria-expanded="false">
                    <i class="fas fa-book-open" aria-hidden="true"></i>
                    <span>Chronicles</span>
                </button>
            </header>

            <div class="tq-mobile-race__realms" aria-label="Quest route realms">
                ${realmKeyHtml}
            </div>

            <div class="tq-mobile-race__cards">
                ${raceCardsHtml}
            </div>
        </section>
    `;
}

// --- REIGNING PRODIGY CACHE ---
// Fetches previous month's award logs once per session (cached by monthKey).
// Returns { [classId]: Set<studentId> } — a Set to support co-prodigies (ties).
let _prodigyCacheKey = null;
let _prodigyCache = {}; // classId -> Set of winner studentIds

async function getReigningProdigies() {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const cacheKey = `${state.getActiveSchoolYearKey() || 'legacy'}:${prevMonth.getFullYear()}-${prevMonth.getMonth()}`;
    const yearStart = getSchoolYearStartMonthDate(
        state.getActiveSchoolYearStartDate(),
        state.getActiveSchoolYearKey()
    );

    if (_prodigyCacheKey === cacheKey) return _prodigyCache;

    if (yearStart && prevMonth < yearStart) {
        _prodigyCacheKey = cacheKey;
        _prodigyCache = {};
        return _prodigyCache;
    }

    try {
        const { fetchLogsForMonth } = await import('../../db/queries.js');
        const { fetchMonthlyHistory } = await import('../../state.js');

        const monthKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
        const logs = await fetchLogsForMonth(prevMonth.getFullYear(), prevMonth.getMonth() + 1);
        const archived = await fetchMonthlyHistory(monthKey).catch(() => ({}));
        const allScores = state.get('allWrittenScores') || [];

        // Group logs by class
        const logsByClass = {};
        logs.forEach(l => {
            if (!l.classId) return;
            if (!logsByClass[l.classId]) logsByClass[l.classId] = [];
            logsByClass[l.classId].push(l);
        });

        const result = {};
        const vm = prevMonth.getMonth();
        const vy = prevMonth.getFullYear();

        Object.entries(logsByClass).forEach(([classId, classLogs]) => {
            const students = state.get('allStudents').filter(s => s.classId === classId);
            const fromLogsTotals = sumMonthlyStarCreditsByStudentFromAwardLogs(classLogs);
            const mergedTotals = mergeMonthlyStarsFromArchivedHistoryAndAwardLogs(fromLogsTotals, archived || {});

            // Same rules as the Ceremony and the Hall of Prodigies (features/heroRanking.js).
            const ranked = rankHeroes(students.map(s => {
                const sScores = allScores.filter(sc => {
                    const scDate = utils.parseFlexibleDate(sc.date);
                    return sc.studentId === s.id && scDate && scDate.getMonth() === vm && scDate.getFullYear() === vy;
                });
                return {
                    id: s.id,
                    name: s.name,
                    stars: Number(mergedTotals[s.id]) || 0,
                    stats: buildHeroTieStats(classLogs.filter(l => l.studentId === s.id), sScores, getNormalizedPercentForScore)
                };
            }));
            const winners = pickProdigyWinners(ranked);
            if (winners.length === 0) return;

            result[classId] = new Set(winners.map(w => w.id));
        });

        _prodigyCacheKey = cacheKey;
        _prodigyCache = result;
    } catch (e) {
        console.warn('Could not load reigning prodigies:', e);
    }
    return _prodigyCache;
}

/** Hall of Prodigies + Trophy Room open for the selected class. */
function syncHeroChallengeHalls() {
    const enable = Boolean(state.get('globalSelectedClassId'));
    const prodigyBtn = document.getElementById('open-prodigy-btn');
    const trophyBtn = document.getElementById('open-trophy-room-btn');
    if (prodigyBtn) prodigyBtn.disabled = !enable;
    if (trophyBtn) trophyBtn.disabled = !enable;
}

// --- TAB CONTENT RENDERERS ---

export async function renderClassLeaderboardTab({ freshVisit = false } = {}) {
    const list = document.getElementById('class-leaderboard-list');
    if (!list) return;
    bindTeacherQuestCompactViewportListener();
    const useCompactTeacherRaceView = isCompactTeacherQuestViewport();

    // Update the month name in the title
    const monthNameEl = document.getElementById('quest-month-name');
    if (monthNameEl) {
        const monthName = new Date().toLocaleString('en-US', { month: 'long' });
        monthNameEl.textContent = monthName;
    }

    const league = getLeaderboardEffectiveLeague();
    if (!league) {
        teardownTeamQuestBoard();
        list.__tqSignature = null;
        list.innerHTML = renderTeamQuestEmptyState('fa-compass', 'Choose a Quest League', `Pick a league above to unroll its Team Quest ${useCompactTeacherRaceView ? 'race' : 'map'}.`);
        initializeLivingQuestMap(null);
        return;
    }

    const classesInLeague = state.get('allSchoolClasses').filter(c => c.questLevel === league);

    if (classesInLeague.length === 0) {
        teardownTeamQuestBoard();
        list.__tqSignature = null;
        list.innerHTML = renderTeamQuestEmptyState('fa-flag', 'The road is quiet', 'No classes have joined this Quest League yet.');
        initializeLivingQuestMap(null);
        return;
    }

    // Yield so the UI can paint (e.g. league picker closing) before heavy string/DOM work.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    // --- CALCULATIONS ---
    const allStudentScores = state.get('allStudentScores') || [];
    const allStudents = state.get('allStudents') || [];
    const allAwardLogs = state.get('allAwardLogs') || [];
    const allAdventureLogs = state.get('allAdventureLogs') || [];

    const now = new Date();
    const currentMonth = now.getMonth();
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - daysToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const scoresByStudentId = new Map(allStudentScores.map(sc => [sc.id, sc]));

    const studentsByClassId = new Map();
    for (const s of allStudents) {
        if (!s.classId) continue;
        let bucket = studentsByClassId.get(s.classId);
        if (!bucket) {
            bucket = [];
            studentsByClassId.set(s.classId, bucket);
        }
        bucket.push(s);
    }

    const awardLogsByClassId = new Map();
    const weeklyStarsByClassId = new Map();
    for (const log of allAwardLogs) {
        if (!log.classId) continue;
        let bucket = awardLogsByClassId.get(log.classId);
        if (!bucket) {
            bucket = [];
            awardLogsByClassId.set(log.classId, bucket);
        }
        bucket.push(log);

        const logDate = utils.parseDDMMYYYY(log.date);
        if (logDate && logDate >= startOfWeek) {
            weeklyStarsByClassId.set(
                log.classId,
                (weeklyStarsByClassId.get(log.classId) || 0) + getAwardLogMonthlyStarCredit(log)
            );
        }
    }

    const adventureCountByClassId = new Map();
    for (const l of allAdventureLogs) {
        if (!l.classId) continue;
        const advDate = utils.parseDDMMYYYY(l.date);
        if (!advDate || advDate.getMonth() !== currentMonth) continue;
        adventureCountByClassId.set(l.classId, (adventureCountByClassId.get(l.classId) || 0) + 1);
    }

    const classScores = utils.assignUniqueTeamQuestRanks(classesInLeague.map(c => {
        const studentsInClass = studentsByClassId.get(c.id) || [];
        const studentCount = studentsInClass.length;

        const goalValue = utils.calculateMonthlyClassGoal(
            c,
            studentCount,
            state.get('schoolHolidayRanges'),
            state.get('allScheduleOverrides')
        );

        const goals = { diamond: goalValue };

        const dbDifficulty = c.difficultyLevel || 0;
        let isCompletedThisMonth = false;
        let goalDifference = 0;

        if (studentCount > 0) {
            if (c.questCompletedAt) {
                const completedDate = typeof c.questCompletedAt.toDate === 'function' ? c.questCompletedAt.toDate() : new Date(c.questCompletedAt);
                if (completedDate.getMonth() === now.getMonth() && completedDate.getFullYear() === now.getFullYear()) {
                    isCompletedThisMonth = true;
                }
            }
            const effectiveDiff = isCompletedThisMonth ? Math.max(0, dbDifficulty - 1) : dbDifficulty;
            const originalGoalTotal = Math.round(studentCount * (18 + (effectiveDiff * 2.5)));
            goalDifference = goalValue - originalGoalTotal;
        }

        const { totalStars: teamQuestStars, classBonus: classTeamBonus } = utils.getClassMonthlyQuestStars(
            c,
            studentsInClass,
            allStudentScores,
            now,
            scoresByStudentId
        );

        const classLogs = awardLogsByClassId.get(c.id) || [];
        const weeklyStars = weeklyStarsByClassId.get(c.id) || 0;

        const totalGold = studentsInClass.reduce((sum, s) => {
            const scoreData = scoresByStudentId.get(s.id);
            const gold = getLiveYearGoldFromAppState(scoreData, state);
            return sum + (Number(gold) || 0);
        }, 0);

        const adventureCount = adventureCountByClassId.get(c.id) || 0;

        const topHeroes = studentsInClass
            .map(s => {
                const scoreData = scoresByStudentId.get(s.id);
                return {
                    name: s.name,
                    avatar: s.avatar,
                    stars: currentMonthStarsFromScore(scoreData, utils.getStartOfMonthString())
                };
            })
            .sort((a, b) => b.stars - a.stars)
            .slice(0, 3);

        const hasPathfinder = classTeamBonus >= 10;

        const reasons = {};
        classLogs.forEach(l => {
            if (l.reason) {
                reasons[l.reason] = (reasons[l.reason] || 0) + getAwardLogMonthlyStarCredit(l);
            }
        });
        const topSkill = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

        let progress = goals.diamond > 0 ? (teamQuestStars / goals.diamond) * 100 : 0;
        // Removed: Don't force progress to 100% - show actual progress for accuracy

        return {
            ...c,
            studentCount,
            goals,
            goalDifference,
            currentMonthlyStars: teamQuestStars,
            classQuestBonus: classTeamBonus,
            weeklyStars,
            totalGold,
            adventureCount,
            topHeroes,
            hasPathfinder,
            topSkill,
            progress,
            difficulty: dbDifficulty
        };
    }));

    const activeClassId = state.get('globalSelectedClassId') || null;
    const monthName = now.toLocaleString('en-US', { month: 'long' });
    const mode = useCompactTeacherRaceView ? 'compact' : 'map';

    // Live listeners call this often; leave the board (and any journey in
    // progress) alone when nothing on it changed.
    const signature = JSON.stringify([
        league, mode, activeClassId, monthName,
        classScores.map((c) => [
            c.id, c.name, c.logo, c.rank, Math.round((Number(c.progress) || 0) * 100),
            c.currentMonthlyStars, c.goals?.diamond, c.goalDifference, c.classQuestBonus,
            c.weeklyStars, c.totalGold, c.adventureCount, c.topSkill, c.studentCount, c.difficulty,
            c.topHeroes.map((h) => [h.name, h.stars, String(h.avatar || '').slice(-32)])
        ])
    ]);

    let board = list.querySelector(':scope > [data-tq-board]');
    if (!freshVisit && board && board.dataset.mode === mode && list.__tqSignature === signature) return;
    list.__tqSignature = signature;

    if (freshVisit || !board || board.dataset.league !== league) {
        teamQuestUi.chroniclesOpen = false;
        teamQuestUi.openIds = new Set(activeClassId ? [activeClassId] : []);
    }

    if (!board || board.dataset.mode !== mode) {
        teardownTeamQuestBoard();
        list.innerHTML = renderTeamQuestBoardShell(mode);
        board = list.querySelector(':scope > [data-tq-board]');
        bindTeamQuestBoard(board);
    }
    board.dataset.league = league;

    const mapSlot = board.querySelector('[data-tq-map-slot]');
    if (mode === 'map') {
        renderLeagueMapInto(mapSlot, classScores, { activeClassId });
        initializeLivingQuestMap(mapSlot, { leagueKey: league, replay: freshVisit });
    } else {
        initializeLivingQuestMap(null);
        mapSlot.innerHTML = generateTeacherMobileRaceHtml(classScores, activeClassId);
    }

    const chronicles = board.querySelector('[data-tq-chronicles]');
    chronicles.innerHTML = renderQuestChroniclesHtml(classScores, {
        monthName,
        leagueName: league,
        activeClassId,
        openIds: teamQuestUi.openIds,
        showFind: mode === 'map'
    });
    teamQuestUi.entries = classScores;
    setChroniclesOpen(board, teamQuestUi.chroniclesOpen, { animate: false });
}

// --- TEAM QUEST BOARD (map/race + Quest Chronicles) ---

const teamQuestUi = {
    chroniclesOpen: false,
    openIds: new Set(),
    entries: [],
    observer: null
};

function renderTeamQuestEmptyState(icon, title, text) {
    return `
        <div class="tq-empty">
            <span class="tq-empty__icon" aria-hidden="true"><i class="fas ${icon}"></i></span>
            <strong>${title}</strong>
            <p>${text}</p>
        </div>`;
}

function renderTeamQuestBoardShell(mode) {
    return `
        <div class="tq-board tq-board--${mode}" data-tq-board data-mode="${mode}">
            <div class="tq-board__race ${mode === 'map' ? 'teacher-quest-map-view' : 'teacher-quest-compact-view'}" data-tq-map-slot></div>
            <section id="league-standings-container" class="tq-chronicles" data-tq-chronicles aria-label="Quest Chronicles" hidden></section>
            <button type="button" class="tq-map-return" data-tq-return aria-label="${mode === 'map' ? 'Back to the map' : 'Back to the race'}">
                <span class="tq-map-return__rose" aria-hidden="true"><i class="fas ${mode === 'map' ? 'fa-compass' : 'fa-flag-checkered'}"></i></span>
                <span class="tq-map-return__label">${mode === 'map' ? 'Map' : 'Race'}</span>
            </button>
        </div>`;
}

function teardownTeamQuestBoard() {
    teamQuestUi.observer?.disconnect();
    teamQuestUi.observer = null;
}

function syncChronicleToggleButtons(board) {
    board.querySelectorAll('#toggle-map-list-btn').forEach((button) => {
        button.setAttribute('aria-expanded', teamQuestUi.chroniclesOpen ? 'true' : 'false');
    });
}

function syncMapReturnButton(board, mapVisible) {
    const button = board.querySelector('[data-tq-return]');
    if (!button) return;
    button.classList.toggle('is-visible', teamQuestUi.chroniclesOpen && !mapVisible);
}

function setChroniclesOpen(board, open, { animate = true } = {}) {
    const chronicles = board.querySelector('[data-tq-chronicles]');
    if (!chronicles) return;
    teamQuestUi.chroniclesOpen = open;
    clearTimeout(chronicles.__tqHideTimer);
    if (open) {
        chronicles.hidden = false;
        if (animate) {
            chronicles.classList.remove('is-open');
            chronicles.classList.add('is-entering');
            void chronicles.offsetWidth;
            clearTimeout(chronicles.__tqEnterTimer);
            chronicles.__tqEnterTimer = setTimeout(() => chronicles.classList.remove('is-entering'), 1400);
        }
        chronicles.classList.add('is-open');
    } else {
        chronicles.classList.remove('is-open');
        if (animate) chronicles.__tqHideTimer = setTimeout(() => { chronicles.hidden = true; }, 280);
        else chronicles.hidden = true;
        syncMapReturnButton(board, true);
    }
    syncChronicleToggleButtons(board);
}

function scrollToElement(element, block = 'start') {
    if (!element) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    element.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block });
}

function setChronicleCardOpen(card, open) {
    const id = card.dataset.chronicleId;
    card.classList.toggle('is-open', open);
    card.querySelector('[data-chronicle-toggle]')?.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) teamQuestUi.openIds.add(id);
    else teamQuestUi.openIds.delete(id);
}

function syncExpandAllButton(board) {
    const button = board.querySelector('[data-chronicles-expand-all]');
    if (!button) return;
    const cards = [...board.querySelectorAll('.tqc-card')];
    const allOpen = cards.length > 0 && cards.every((card) => card.classList.contains('is-open'));
    button.setAttribute('aria-pressed', allOpen ? 'true' : 'false');
    button.innerHTML = `<i class="fas ${allOpen ? 'fa-compress' : 'fa-expand'}" aria-hidden="true"></i>${allOpen ? 'Close all pages' : 'Open all pages'}`;
}

function openChronicleForClass(board, classId) {
    setChroniclesOpen(board, true);
    const card = [...board.querySelectorAll('.tqc-card')].find((candidate) => candidate.dataset.chronicleId === String(classId));
    if (!card) {
        scrollToElement(board.querySelector('[data-tq-chronicles]'));
        return;
    }
    setChronicleCardOpen(card, true);
    syncExpandAllButton(board);
    requestAnimationFrame(() => {
        scrollToElement(card, 'center');
        card.classList.remove('is-flash');
        void card.offsetWidth;
        card.classList.add('is-flash');
        setTimeout(() => card.classList.remove('is-flash'), 1800);
    });
}

function bindTeamQuestBoard(board) {
    const mapSlot = board.querySelector('[data-tq-map-slot]');

    board.addEventListener('click', (event) => {
        const target = event.target;

        if (target.closest('#toggle-map-list-btn')) {
            setChroniclesOpen(board, true);
            requestAnimationFrame(() => scrollToElement(board.querySelector('[data-tq-chronicles]')));
            return;
        }
        if (target.closest('[data-chronicles-close]') || target.closest('[data-tq-return]')) {
            scrollToElement(mapSlot);
            return;
        }
        const zone = target.closest('.zone-trigger');
        if (zone) {
            import('../modals.js').then((m) => m.openZoneOverviewModal(zone.dataset.zone));
            return;
        }
        const toggle = target.closest('[data-chronicle-toggle]');
        if (toggle) {
            const card = toggle.closest('.tqc-card');
            if (card) setChronicleCardOpen(card, !card.classList.contains('is-open'));
            syncExpandAllButton(board);
            return;
        }
        if (target.closest('[data-chronicles-expand-all]')) {
            const cards = [...board.querySelectorAll('.tqc-card')];
            const openAll = !cards.every((card) => card.classList.contains('is-open'));
            cards.forEach((card) => setChronicleCardOpen(card, openAll));
            syncExpandAllButton(board);
            return;
        }
        const raceCard = target.closest('[data-chronicle-open]');
        if (raceCard) {
            openChronicleForClass(board, raceCard.dataset.chronicleOpen);
            return;
        }
        const find = target.closest('[data-chronicle-find]');
        if (find) {
            const map = getActiveLivingQuestMap();
            if (!map || !map.focusClass(find.dataset.chronicleFind)) scrollToElement(mapSlot);
        }
    });

    board.addEventListener('tq:open-chronicle', (event) => {
        openChronicleForClass(board, event.detail?.classId);
    });

    teardownTeamQuestBoard();
    if (typeof IntersectionObserver === 'function') {
        const observer = new IntersectionObserver((entries) => {
            const entry = entries[entries.length - 1];
            syncMapReturnButton(board, Boolean(entry?.isIntersecting));
        }, { threshold: 0.12 });
        observer.observe(mapSlot);
        teamQuestUi.observer = observer;
    }
}

// What each Hero's Challenge board looked like when this visit to the tab began
// (drives the ▲/+N chips), and what was last drawn (drives the motion).
const _heroVisitBaselines = new Map();
const _heroLastShown = new Map();

function syncHeroStandingsSwitches() {
    const view = state.get('studentLeaderboardView') === 'league' ? 'league' : 'class';
    const metric = state.get('studentStarMetric') === 'total' ? 'total' : 'monthly';
    const setGroup = (ids, activeIndex) => {
        ids.forEach((id, i) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.classList.toggle('is-active', i === activeIndex);
            btn.setAttribute('aria-pressed', i === activeIndex ? 'true' : 'false');
            btn.parentElement?.style.setProperty('--seg-i', String(activeIndex));
        });
    };
    setGroup(['view-by-class', 'view-by-league'], view === 'league' ? 1 : 0);
    setGroup(['metric-monthly', 'metric-total'], metric === 'total' ? 1 : 0);
}

function clearHeroStandingsList(list, html) {
    list.dataset.hcsBoard = '';
    list.__hcsHtml = '';
    list.__hcsToken = null;
    list.className = 'hcs-list';
    list.innerHTML = html;
}

export async function renderStudentLeaderboardTab({ freshVisit = false } = {}) {
    const list = document.getElementById('student-leaderboard-list');
    if (!list) return;

    syncHeroChallengeHalls();
    syncHeroStandingsSwitches();

    const heroProgressionEnabled = canUseFeature('heroProgression');

    // Match Team Quest: always refresh ribbon month (static HTML placeholder e.g. "February"
    // would otherwise survive until after a league is chosen).
    const heroMonthNameEl = document.getElementById('hero-month-name');
    if (heroMonthNameEl) {
        const monthName = new Date().toLocaleString('en-US', { month: 'long' });
        heroMonthNameEl.textContent = monthName;
    }

    const league = getLeaderboardEffectiveLeague();
    if (!league) {
        clearHeroStandingsList(list, `<div class="hcs-empty"><i class="fas fa-shield-halved" aria-hidden="true"></i><p>Choose a Quest League to see its heroes.</p></div>`);
        return;
    }

    const classesInLeague = state.get('allSchoolClasses').filter(c => c.questLevel === league);
    if (classesInLeague.length === 0) {
        clearHeroStandingsList(list, `<div class="hcs-empty"><i class="fas fa-flag" aria-hidden="true"></i><p>No classes in this Quest League yet.</p></div>`);
        return;
    }

    // --- DATA PREPARATION ---
    const allLogs = state.get('allAwardLogs');
    const allScores = state.get('allWrittenScores');
    const allStudents = state.get('allStudents') || [];
    const allStudentScores = state.get('allStudentScores') || [];
    const persistedGuildChampions = state.get('guildChampions') || {};
    const computedGuildChampions = getGuildChampionsForMonth(allStudents, allStudentScores);
    const guildChampions = { ...computedGuildChampions, ...persistedGuildChampions };
    const topHeroByGuild = {};
    getGuildLeaderboardData().forEach((guildRow) => {
        const topHero = guildRow.topContributors?.[0];
        if (topHero?.studentId) {
            topHeroByGuild[guildRow.guildId] = topHero.studentId;
        }
    });

    // 1. HELPER: Calculate Stats & Tie-Breakers
    const getStudentStats = (studentId) => {
        const studentLogs = allLogs.filter(log => log.studentId === studentId);
        const studentScores = allScores.filter(s => s.studentId === studentId);

        const now = new Date();
        const currentMonthIndex = now.getMonth();
        const currentYear = now.getFullYear();

        const monthlyLogs = studentLogs.filter(log => {
            const logDate = utils.parseDDMMYYYY(log.date);
            return logDate.getMonth() === currentMonthIndex &&
                logDate.getFullYear() === currentYear &&
                log.reason !== 'pathfinder_bonus';
        });

        // A. Weekly Stars (Monday to Friday)
        const dayOfWeek = now.getDay(); // 0 (Sun) to 6 (Sat)
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Calculate days to go back to Monday
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - daysToMonday);
        startOfWeek.setHours(0, 0, 0, 0);

        const weeklyStars = studentLogs
            .filter(log => utils.parseDDMMYYYY(log.date) >= startOfWeek)
            .reduce((sum, log) => sum + getAwardLogMonthlyStarCredit(log), 0);

        // B. 3-Star Streak Calculation (Consecutive lessons with 3+ stars)
        // We exclude small bonuses like 'welcome_back' so they don't break the streak
        const streakLogs = studentLogs
            .filter(l => !['welcome_back', 'scholar_s_bonus', 'story_weaver'].includes(l.reason))
            .sort((a, b) => utils.parseDDMMYYYY(b.date) - utils.parseDDMMYYYY(a.date)); // Newest first

        let streak = 0;
        for (const log of streakLogs) {
            if (getAwardLogMonthlyStarCredit(log) >= 3) {
                streak++;
            } else {
                break; // Streak ends if a main lesson wasn't 3 stars
            }
        }

        // C. Top Reason of the Month
        const reasonCounts = {};
        monthlyLogs.forEach(log => {
            if (log.reason) {
                reasonCounts[log.reason] = (reasonCounts[log.reason] || 0) + getAwardLogMonthlyStarCredit(log);
            }
        });

        // Sort reasons by highest star count
        const topReasonEntry = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];
        const topSkill = topReasonEntry ? topReasonEntry[0] : null;

        // D. Tie-breakers, by the same rules as the Ceremony (features/heroRanking.js)
        const monthlyScores = studentScores.filter(s => {
            if (!s.date) return false;
            const sDate = utils.parseFlexibleDate(s.date);
            return sDate && sDate.getMonth() === currentMonthIndex && sDate.getFullYear() === currentYear;
        });

        return {
            weeklyStars, topSkill, streak,
            ...buildHeroTieStats(monthlyLogs, monthlyScores, getNormalizedPercentForScore)
        };
    };

    const monthStart = utils.getStartOfMonthString();
    let studentsInLeague = allStudents
        .filter(s => classesInLeague.some(c => c.id === s.classId))
        .map(s => {
            const studentClass = state.get('allSchoolClasses').find(c => c.id === s.classId);
            const scoreData = allStudentScores.find(sc => sc.id === s.id) || {};
            const score = state.get('studentStarMetric') === 'monthly'
                ? currentMonthStarsFromScore(scoreData, monthStart)
                : (Number(scoreData.totalStars) || 0);
            const totalStars = scoreData.totalStars || 0;

            // NEW: Get Gold
            const gold = getLiveYearGoldFromAppState(scoreData, state);

            const stats = getStudentStats(s.id);

            return {
                ...s,
                score,
                totalStars,
                gold,
                stats,
                heroLevel: heroProgressionEnabled ? (scoreData.heroLevel || 0) : 0,
                pendingSkillChoice: heroProgressionEnabled ? !!scoreData.pendingSkillChoice : false,
                familiar: scoreData.familiar || null,
                className: studentClass?.name || '?',
                classLogo: studentClass?.logo || '📚'
            };
        });
    // --- REIGNING PRODIGY (previous month's winners, with co-prodigy/tie support) ---
    const prodigyByClass = await getReigningProdigies();

    // --- RENDER HELPERS ---
    const reasonInfo = {
        teamwork: { icon: 'fa-users', color: 'bg-purple-100 text-purple-700', name: 'Teamwork' },
        creativity: { icon: 'fa-lightbulb', color: 'bg-pink-100 text-pink-700', name: 'Creativity' },
        respect: { icon: 'fa-hands-helping', color: 'bg-green-100 text-green-700', name: 'Respect' },
        focus: { icon: 'fa-brain', color: 'bg-yellow-100 text-yellow-700', name: 'Focus' },
        welcome_back: { icon: 'fa-hand-sparkles', color: 'bg-cyan-100 text-cyan-700', name: 'Back!' },
        story_weaver: { icon: 'fa-feather-alt', color: 'bg-cyan-100 text-cyan-700', name: 'Story' },
        scholar_s_bonus: { icon: 'fa-graduation-cap', color: 'bg-amber-100 text-amber-800', name: 'Scholar' },
        teacher_boon: { icon: 'fa-wand-magic-sparkles', color: 'bg-fuchsia-100 text-fuchsia-700', name: 'Teacher Boon' },
        pathfinder_map: { icon: 'fa-map', color: 'bg-indigo-100 text-indigo-700', name: 'Pathfinder' }
    };

    const getAvatarHtml = (s, sizeClass = "w-12 h-12") => {
        const hoverEffects = "transform transition-transform duration-200 hover:scale-110 hover:rotate-3 cursor-pointer enlargeable-avatar";
        const heroLevel = s.heroLevel || 0;
        const auraColor = heroProgressionEnabled && heroLevel >= 3 && s.heroClass && HERO_SKILL_TREE[s.heroClass] ? HERO_SKILL_TREE[s.heroClass].auraColor : null;
        const auraStyle = auraColor ? `style="box-shadow: 0 0 0 3px ${auraColor}, 0 0 14px 4px ${auraColor}88; border-color: ${auraColor};"` : '';
        let inner;
        if (s.avatar) {
            inner = `<img src="${s.avatar}" alt="${escapeLeaderboardHtml(s.name)}" data-student-id="${s.id}" loading="lazy" decoding="async" class="${sizeClass} rounded-full object-cover border-4 border-white shadow-md ${hoverEffects}" ${auraStyle}>`;
        } else {
            inner = `<div data-student-id="${s.id}" class="${sizeClass} rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg border-4 border-white shadow-md ${hoverEffects}" ${auraStyle}>${escapeLeaderboardHtml((s.name || '').charAt(0))}</div>`;
        }
        return wrapAvatarWithLevelUpIndicator(inner, s.pendingSkillChoice);
    };

    const getGuildRoleBadgesHtml = (s) => {
        if (!s.guildId) return '';
        const guild = getGuildById(s.guildId);
        const color = guild?.primary || '#7c3aed';
        const badges = [];

        if (guildChampions[s.guildId]?.studentId === s.id) {
            badges.push(`<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white" style="background:${color};" title="Guild Champion this month">⚔️ Champion</span>`);
        }
        if (topHeroByGuild[s.guildId] === s.id) {
            badges.push(`<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300" title="Top Hero for this guild">🏅 Top Hero</span>`);
        }

        return badges.join('');
    };

    /** Hero rank title (e.g. Tinkerer, Sentinel) as a styled pill using class aura color. */
    const getHeroTitleBadgeHtml = (s) => {
        if (!heroProgressionEnabled) return '';
        if (!s.heroClass) return '';
        const level = s.heroLevel || 0;
        const title = level > 0 ? getHeroTitle(s.heroClass, level) : (s.heroClass || 'Novice');
        const tree = HERO_SKILL_TREE[s.heroClass];
        const auraColor = tree?.auraColor || '#7c3aed';
        const icon = HERO_CLASSES[s.heroClass]?.icon || '';
        return `<span class="hero-title-pill inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold text-white shadow-sm border border-white/30" style="background: linear-gradient(135deg, ${auraColor}, ${auraColor}dd); box-shadow: 0 1px 3px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.2);" title="Hero rank">${icon ? `<span class="opacity-90">${icon}</span>` : ''}<span>${title}</span></span>`;
    };

    const getPillsHtml = (s) => {
        let html = '';

        // Badge 0: Reigning Prodigy of the Month (previous month's winner, supports co-prodigies)
        if (prodigyByClass[s.classId]?.has(s.id)) {
            html += `<div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 shadow-sm border border-amber-300" title="Reigning Prodigy of the Month!">👑 Prodigy</div>`;
        }

        // Badge 1: Stars THIS WEEK
        if (s.stats.weeklyStars > 0) {
            html += `<div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-600 shadow-sm border border-orange-200" title="${s.stats.weeklyStars} stars this week"><i class="fas fa-fire"></i> Week: ${s.stats.weeklyStars}</div>`;
        }

        // Badge 2: Streak of Perfect 3-Stars
        if (s.stats.streak > 1) {
            html += `<div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-600 shadow-sm border border-indigo-200" title="Streak of ${s.stats.streak} perfect lessons!"><i class="fas fa-bolt"></i> Streak: ${s.stats.streak}</div>`;
        }

        // Badge 3: Top Reason of the MONTH
        if (s.stats.topSkill) {
            const info = reasonInfo[s.stats.topSkill] || { icon: 'fa-star', color: 'bg-gray-100 text-gray-600', name: 'Star' };
            html += `<div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${info.color} shadow-sm border border-white/50" title="Top Skill this Month"><i class="fas ${info.icon}"></i> <span>${info.name}</span></div>`;
        }

        const eggAlert = s.familiar ? getEggAlertState(s.familiar, s.totalStars) : null;
        if (eggAlert?.kind === 'ready') {
            html += `<div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 shadow-sm border border-emerald-300" title="This egg is ready to hatch now">🥚 Ready!</div>`;
        } else if (eggAlert?.kind === 'soon') {
            html += `<div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-fuchsia-100 text-fuchsia-700 shadow-sm border border-fuchsia-300" title="${eggAlert.remaining} more star(s) until hatch">🥚 ${eggAlert.remaining} left</div>`;
        }

        return html;
    };

    const starMetric = state.get('studentStarMetric') === 'monthly' ? 'monthly' : 'total';
    const view = state.get('studentLeaderboardView') === 'league' ? 'league' : 'class';
    const now = new Date();
    const monthName = now.toLocaleString('en-US', { month: 'long' });
    const myClassIdSet = new Set((state.get('allTeachersClasses') || []).map((c) => c.id));

    const toEntry = (s, rank, { showClass }) => ({
        id: s.id,
        name: s.name || '',
        rank,
        score: s.score,
        gold: s.gold,
        heroIcon: heroProgressionEnabled && s.heroClass && HERO_CLASSES[s.heroClass] ? HERO_CLASSES[s.heroClass].icon : '',
        avatarHtml: getAvatarHtml(s, 'w-12 h-12 sm:w-14 sm:h-14'),
        avatarLargeHtml: getAvatarHtml(s, rank === 1 ? 'w-20 h-20 sm:w-24 sm:h-24' : 'w-16 h-16 sm:w-20 sm:h-20'),
        familiarHtml: s.familiar
            ? `<div class="familiar-chip hero-challenge-familiar-chip">${renderFamiliarSprite(s.familiar, 'small', s.id)}</div>`
            : '',
        guildBadgeHtml: s.guildId ? `<span class="hcs-guild">${getGuildBadgeHtml(s.guildId, 'w-6 h-6')}</span>` : '',
        titleBadgeHtml: getHeroTitleBadgeHtml(s),
        roleBadgesHtml: getGuildRoleBadgesHtml(s),
        pillsHtml: getPillsHtml(s),
        className: s.className,
        classLogo: s.classLogo,
        showClass
    });

    // This month: the Ceremony's rules, so the board crowns whoever the
    // Ceremony will. All-time: only this month's awards are loaded, so they
    // can't fairly split a year of stars; equal stars share the place.
    const rankGroup = (students, opts) => rankHeroes(
        students.map((s) => ({ ...s, stars: s.score })),
        { starsOnly: starMetric !== 'monthly' }
    ).map((s) => toEntry(s, s.rank, opts));

    const sumStars = (students) => students.reduce((sum, s) => sum + (Number(s.score) || 0), 0);
    const starFact = (n) => `<i class="fas fa-star" aria-hidden="true"></i>${n} ${starMetric === 'monthly' ? `star${n === 1 ? '' : 's'} in ${escapeLeaderboardHtml(monthName)}` : `star${n === 1 ? '' : 's'} all-time`}`;
    const heroFact = (n) => `<i class="fas fa-users" aria-hidden="true"></i>${n} hero${n === 1 ? '' : 'es'}`;

    const sections = [];
    if (view === 'league') {
        // === GLOBAL VIEW === (top 50 across the league)
        const entries = rankGroup(studentsInLeague, { showClass: true }).slice(0, 50);
        sections.push({
            id: `league:${league}`,
            title: `${league} League`,
            logo: '',
            facts: [heroFact(studentsInLeague.length), `<i class="fas fa-flag" aria-hidden="true"></i>${classesInLeague.length} class${classesInLeague.length === 1 ? '' : 'es'}`, starFact(sumStars(studentsInLeague))],
            mine: false,
            entries
        });
    } else {
        // === BY CLASS VIEW === (the teacher's own classes first)
        const classesMap = studentsInLeague.reduce((acc, student) => {
            if (!acc[student.classId]) acc[student.classId] = { name: student.className, logo: student.classLogo, students: [] };
            acc[student.classId].students.push(student);
            return acc;
        }, {});
        const allClassIds = Object.keys(classesMap);
        const myClassIds = allClassIds.filter((id) => myClassIdSet.has(id));
        const otherClassIds = allClassIds.filter((id) => !myClassIdSet.has(id));
        const nameSort = (a, b) => classesMap[a].name.localeCompare(classesMap[b].name);
        [...myClassIds.sort(nameSort), ...otherClassIds.sort(nameSort)].forEach((classId) => {
            const classData = classesMap[classId];
            sections.push({
                id: classId,
                title: classData.name,
                logo: classData.logo,
                facts: [heroFact(classData.students.length), starFact(sumStars(classData.students))],
                mine: myClassIdSet.has(classId),
                entries: rankGroup(classData.students, { showClass: false })
            });
        });
    }

    // --- Rank changes since this device last looked ---
    const boardKey = [
        state.getActiveSchoolYearKey() || 'legacy',
        league,
        view,
        starMetric,
        starMetric === 'monthly' ? `${now.getFullYear()}-${now.getMonth() + 1}` : 'all'
    ].join('|');
    const dataReady = allStudentScores.length > 0;
    if (freshVisit) _heroVisitBaselines.clear();
    if (dataReady && !_heroVisitBaselines.has(boardKey)) {
        _heroVisitBaselines.set(boardKey, readStandingsSnapshot(boardKey));
    }
    const baseline = dataReady ? _heroVisitBaselines.get(boardKey) : null;
    const previous = _heroLastShown.get(boardKey) || baseline;
    const moved = annotateStandingsChanges(sections, baseline, previous);

    const outputHtml = renderStandingsHeraldHtml(sections, { byClass: view === 'class' })
        + sections.map((section, i) => renderStandingsSectionHtml(section, { monthName, metric: starMetric, delayIndex: i })).join('');

    if (dataReady) {
        const snap = buildStandingsSnapshot(sections);
        _heroLastShown.set(boardKey, snap);
        // First look at this board on this device: it becomes the baseline,
        // so stars awarded while the tab is open still earn their chips.
        if (!_heroVisitBaselines.get(boardKey)) _heroVisitBaselines.set(boardKey, snap);
        writeStandingsSnapshot(boardKey, snap);
    }

    // Live data re-renders often; leave the board alone (and any show in
    // progress) when nothing on it changed. Where heroes came from is motion
    // only, so it is left out of the comparison.
    const boardSignature = outputHtml.replace(/ data-(?:hcs-)?from="[^"]*"|--hcs-power-from:[^;"]*;?/g, '');
    const sameBoard = list.dataset.hcsBoard === boardKey;
    if (!freshVisit && sameBoard && list.__hcsHtml === boardSignature) return;
    list.dataset.hcsBoard = boardKey;
    list.__hcsHtml = boardSignature;
    list.__hcsToken = null;
    list.className = 'hcs-list';
    list.innerHTML = outputHtml;

    if (moved) playStandingsChanges(list, sections);
    else if (freshVisit || !sameBoard) playStandingsEntrance(list);
}
